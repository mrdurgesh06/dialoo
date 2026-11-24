package com.narayanix.dialoo.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Mobile OTP issuing and verification (SRS 10.1 / 21).
 * - OTP is never stored in plaintext (HMAC-SHA256 with server secret).
 * - Short TTL, attempt-limited, per-mobile and per-IP rate limited, resend cooldown.
 * Note: SRS recommends Redis for OTP state; this project has no Redis yet, so MySQL is used behind the same interface.
 */
@Service
public class OtpService {
  public record Issued(int expiresInSeconds, int resendInSeconds, String devOtp) {}

  private final JdbcTemplate db; private final SmsSender sms; private final byte[] secret; private final SecureRandom random = new SecureRandom();
  private final int ttlSeconds, cooldownSeconds, maxRequestsPer10Min, maxAttempts, maxPerIp; private final boolean devMode;
  private final Map<String, long[]> ipWindow = new ConcurrentHashMap<>();

  public OtpService(JdbcTemplate db, SmsSender sms,
      @Value("${app.jwt.secret}") String jwtSecret,
      @Value("${app.otp.ttl-seconds:300}") int ttlSeconds,
      @Value("${app.otp.resend-cooldown-seconds:30}") int cooldownSeconds,
      @Value("${app.otp.max-requests-per-10-min:5}") int maxRequestsPer10Min,
      @Value("${app.otp.max-attempts:5}") int maxAttempts,
      @Value("${app.otp.max-requests-per-ip-10-min:20}") int maxPerIp,
      @Value("${app.otp.dev-mode:false}") boolean devMode) {
    this.db = db; this.sms = sms; this.secret = jwtSecret.getBytes(StandardCharsets.UTF_8);
    this.ttlSeconds = ttlSeconds; this.cooldownSeconds = cooldownSeconds; this.maxRequestsPer10Min = maxRequestsPer10Min;
    this.maxAttempts = maxAttempts; this.maxPerIp = maxPerIp; this.devMode = devMode;
  }

  /** Normalizes Indian mobile input to a 10-digit number; throws IllegalArgumentException if invalid. */
  public static String normalize(String raw) {
    String d = raw == null ? "" : raw.replaceAll("[^0-9]", "");
    if (d.length() == 12 && d.startsWith("91")) d = d.substring(2);
    if (d.length() == 11 && d.startsWith("0")) d = d.substring(1);
    if (!d.matches("[6-9][0-9]{9}")) throw new IllegalArgumentException("Enter a valid 10-digit Indian mobile number");
    return d;
  }

  public Issued request(String rawMobile, String ip) { return request(rawMobile, ip, "LOGIN"); }

  public Issued request(String rawMobile, String ip, String purpose) {
    String mobile = normalize(rawMobile);
    checkIp(ip);
    Integer recent = db.queryForObject("SELECT COUNT(*) FROM otp_verifications WHERE mobile_number=? AND purpose=? AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)", Integer.class, mobile, purpose);
    if (recent != null && recent >= maxRequestsPer10Min) throw new TooManyRequestsException("Too many OTP requests. Please try again after some time.", 600);
    List<Map<String, Object>> last = db.queryForList("SELECT TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS age FROM otp_verifications WHERE mobile_number=? AND purpose=? ORDER BY id DESC LIMIT 1", mobile, purpose);
    if (!last.isEmpty()) {
      int age = ((Number) last.get(0).get("age")).intValue();
      if (age < cooldownSeconds) throw new TooManyRequestsException("Please wait before requesting another OTP.", cooldownSeconds - age);
    }
    // Invalidate older unverified codes so only the newest works.
    db.update("UPDATE otp_verifications SET expires_at=UTC_TIMESTAMP() WHERE mobile_number=? AND purpose=? AND verified_at IS NULL AND expires_at>UTC_TIMESTAMP()", mobile, purpose);
    String otp = String.format("%06d", random.nextInt(1_000_000));
    db.update("INSERT INTO otp_verifications(mobile_number,otp_hash,purpose,expires_at,request_ip) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),?)", mobile, hash(mobile, otp, purpose), purpose, ttlSeconds, ip);
    try {
      sms.send(mobile, "Your Dialoo verification code is " + otp + ". It is valid for " + Math.max(1, ttlSeconds / 60) + " minutes. Do not share it with anyone.");
    } catch (RuntimeException deliveryError) {
      // Do not leave an apparently usable OTP behind when the gateway rejects the send.
      db.update("UPDATE otp_verifications SET expires_at=UTC_TIMESTAMP() WHERE mobile_number=? AND purpose=? AND verified_at IS NULL", mobile, purpose);
      throw new IllegalStateException("OTP could not be sent. Check SMS gateway credentials, sender ID/number and provider logs, then try again.", deliveryError);
    }
    return new Issued(ttlSeconds, cooldownSeconds, devMode ? otp : null);
  }

  /** Verifies the OTP; returns the normalized mobile on success, throws IllegalArgumentException otherwise. */
  public String verify(String rawMobile, String otp) { return verify(rawMobile, otp, "LOGIN"); }

  public String verify(String rawMobile, String otp, String purpose) {
    String mobile = normalize(rawMobile);
    if (otp == null || !otp.matches("[0-9]{6}")) throw new IllegalArgumentException("Enter the 6-digit OTP");
    List<Map<String, Object>> rows = db.queryForList("SELECT id,otp_hash,attempt_count FROM otp_verifications WHERE mobile_number=? AND purpose=? AND verified_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY id DESC LIMIT 1", mobile, purpose);
    if (rows.isEmpty()) throw new IllegalArgumentException("OTP expired or not requested. Please request a new OTP.");
    long id = ((Number) rows.get(0).get("id")).longValue(); int attempts = ((Number) rows.get(0).get("attempt_count")).intValue();
    if (attempts >= maxAttempts) { db.update("UPDATE otp_verifications SET expires_at=UTC_TIMESTAMP() WHERE id=?", id); throw new IllegalArgumentException("Too many wrong attempts. Please request a new OTP."); }
    String expected = (String) rows.get(0).get("otp_hash");
    if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), hash(mobile, otp, purpose).getBytes(StandardCharsets.UTF_8))) {
      db.update("UPDATE otp_verifications SET attempt_count=attempt_count+1 WHERE id=?", id);
      int left = maxAttempts - attempts - 1;
      throw new IllegalArgumentException(left > 0 ? "Incorrect OTP. " + left + " attempt(s) left." : "Too many wrong attempts. Please request a new OTP.");
    }
    db.update("UPDATE otp_verifications SET verified_at=UTC_TIMESTAMP() WHERE id=? AND verified_at IS NULL", id);
    return mobile;
  }

  private String hash(String mobile, String otp, String purpose) {
    try { Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret, "HmacSHA256")); return HexFormat.of().formatHex(mac.doFinal((purpose + ":" + mobile + ":" + otp).getBytes(StandardCharsets.UTF_8))); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }

  private void checkIp(String ip) {
    if (ip == null) return; long now = System.currentTimeMillis();
    long[] w = ipWindow.compute(ip, (k, v) -> (v == null || now - v[0] > 600_000) ? new long[]{now, 1} : new long[]{v[0], v[1] + 1});
    if (w[1] > maxPerIp) throw new TooManyRequestsException("Too many requests from this network. Please try again later.", 600);
  }
}
