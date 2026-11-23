package com.narayanix.dialoo.service;

import io.jsonwebtoken.Claims;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Admin sign-in (SRS 21, 37): password (step 1) + SMS OTP (step 2), account lockout, per-IP throttle,
 * and a server-side session so a stolen token can be revoked. A normal customer login can never reach /admin.
 */
@Service
public class AdminAuthService {
  private static final String GENERIC = "Invalid credentials.";
  private final JdbcTemplate db; private final PasswordEncoder encoder; private final JwtService jwt; private final OtpService otp;
  private final SettingsService settings; private final AuditService audit; private final SecureRandom random = new SecureRandom();

  public AdminAuthService(JdbcTemplate db, PasswordEncoder encoder, JwtService jwt, OtpService otp, SettingsService settings, AuditService audit) {
    this.db = db; this.encoder = encoder; this.jwt = jwt; this.otp = otp; this.settings = settings; this.audit = audit;
  }

  public Map<String, Object> login(String identifier, String password, String ip, String ua) {
    String id = identifier == null ? "" : identifier.trim();
    Integer ipFails = db.queryForObject("SELECT COUNT(*) FROM login_attempts WHERE scope='ADMIN' AND success=FALSE AND ip_address=? AND created_at>DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)", Integer.class, ip);
    if (ipFails != null && ipFails >= 20) throw new TooManyRequestsException("Too many failed attempts from this network. Try again later.", 900);

    List<Map<String, Object>> rows = db.queryForList(
      "SELECT id,phone,password_hash,role,enabled,failed_login_count,(locked_until IS NOT NULL AND locked_until>UTC_TIMESTAMP()) AS locked, TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),locked_until) AS lock_left " +
      "FROM users WHERE (phone=? OR LOWER(email)=LOWER(?)) AND role IN ('ADMIN','SUPER_ADMIN','SUPPORT') LIMIT 1", id, id);
    if (rows.isEmpty()) { attempt(id, ip, false, "UNKNOWN"); encoder.matches(password == null ? "" : password, "$2a$10$7EqJtq98hPqEX7fNZaFWoOa3rN0m9y0p5v5Zk0mZ9yq1b3r1o5K3a"); throw new IllegalArgumentException(GENERIC); }
    Map<String, Object> u = rows.get(0); long uid = ((Number) u.get("id")).longValue();
    if (((Number) u.get("locked")).intValue() == 1) {
      int left = Math.max(60, ((Number) u.get("lock_left")).intValue());
      attempt(id, ip, false, "LOCKED");
      throw new TooManyRequestsException("Account temporarily locked after repeated failures. Try again later.", left);
    }
    boolean ok = Boolean.TRUE.equals(u.get("enabled")) && u.get("password_hash") != null && password != null && encoder.matches(password, (String) u.get("password_hash"));
    if (!ok) {
      attempt(id, ip, false, "BAD_PASSWORD");
      int max = settings.getInt("ADMIN_MAX_FAILED_LOGINS", 5), lockMin = settings.getInt("ADMIN_LOCK_MINUTES", 15);
      db.update("UPDATE users SET failed_login_count=failed_login_count+1, locked_until=IF(failed_login_count+1>=?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), locked_until) WHERE id=?", max, lockMin, uid);
      audit.log(uid, "ADMIN_LOGIN_FAILED", "USER", String.valueOf(uid), "Bad password", ip);
      throw new IllegalArgumentException(GENERIC);
    }
    String phone = (String) u.get("phone");
    Map<String, Object> out = new HashMap<>();
    if (settings.flag("ADMIN_2FA_REQUIRED", true)) {
      var issued = otp.request(phone, ip, "ADMIN_2FA");
      out.put("mfaRequired", true);
      out.put("mfaToken", jwt.createMfaChallenge(phone, 300));
      out.put("maskedPhone", "******" + phone.substring(Math.max(0, phone.length() - 4)));
      out.put("expiresInSeconds", issued.expiresInSeconds());
      out.put("resendInSeconds", issued.resendInSeconds());
      if (issued.devOtp() != null) out.put("devOtp", issued.devOtp());
      return out;
    }
    out.putAll(openSession(uid, phone, (String) u.get("role"), ip, ua));
    out.put("mfaRequired", false);
    return out;
  }

  public Map<String, Object> verifyOtp(String mfaToken, String code, String ip, String ua) {
    Claims c;
    try { c = jwt.parse(mfaToken); } catch (Exception e) { throw new IllegalArgumentException("Sign-in step expired. Please start again."); }
    if (!"mfa".equals(c.get("typ"))) throw new IllegalArgumentException("Sign-in step expired. Please start again.");
    String phone = c.getSubject();
    try { otp.verify(phone, code, "ADMIN_2FA"); }
    catch (IllegalArgumentException e) { attempt(phone, ip, false, "BAD_OTP"); throw e; }
    List<Map<String, Object>> rows = db.queryForList("SELECT id,role,enabled,must_change_password FROM users WHERE phone=? AND role IN ('ADMIN','SUPER_ADMIN','SUPPORT')", phone);
    if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("enabled"))) throw new IllegalArgumentException(GENERIC);
    Map<String, Object> u = rows.get(0);
    if (Boolean.TRUE.equals(u.get("must_change_password"))) {
      // temporary password: no session yet - the person must choose their own password first
      Map<String, Object> out = new HashMap<>();
      out.put("mustChangePassword", true);
      out.put("changeToken", jwt.createChallenge(phone, "pwchange", 600));
      return out;
    }
    return openSession(((Number) u.get("id")).longValue(), phone, (String) u.get("role"), ip, ua);
  }

  /** First sign-in with a temporary password: choose a new password, then the admin session opens. */
  public Map<String, Object> changeInitial(String changeToken, String newPassword, String ip, String ua) {
    Claims c;
    try { c = jwt.parse(changeToken); } catch (Exception e) { throw new IllegalArgumentException("This step expired. Please sign in again."); }
    if (!"pwchange".equals(c.get("typ"))) throw new IllegalArgumentException("This step expired. Please sign in again.");
    PasswordPolicy.check(newPassword);
    String phone = c.getSubject();
    List<Map<String, Object>> rows = db.queryForList("SELECT id,role,password_hash FROM users WHERE phone=? AND enabled=TRUE AND must_change_password=TRUE AND role IN ('ADMIN','SUPER_ADMIN','SUPPORT')", phone);
    if (rows.isEmpty()) throw new IllegalArgumentException("This step expired. Please sign in again.");
    long uid = ((Number) rows.get(0).get("id")).longValue();
    if (encoder.matches(newPassword, (String) rows.get(0).get("password_hash"))) throw new IllegalArgumentException("Choose a password different from the temporary one.");
    db.update("UPDATE users SET password_hash=?, must_change_password=FALSE, password_changed_at=UTC_TIMESTAMP(), failed_login_count=0, locked_until=NULL WHERE id=?", encoder.encode(newPassword), uid);
    audit.log(uid, "ADMIN_PASSWORD_CHOSEN", "USER", String.valueOf(uid), "First sign-in password set", ip);
    return openSession(uid, phone, (String) rows.get(0).get("role"), ip, ua);
  }

  /**
   * Forgot password (step 1). The person may type the admin's mobile number OR email. The code is always sent to the
   * registered mobile number. The reply looks the same whether or not the account exists.
   */
  public Map<String, Object> forgot(String identifier, String ip) {
    String id = identifier == null ? "" : identifier.trim();
    if (id.length() < 5) throw new IllegalArgumentException("Enter your registered mobile number or email.");
    Integer recent = db.queryForObject("SELECT COUNT(*) FROM admin_password_resets WHERE ip_address=? AND created_at>DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)", Integer.class, ip);
    if (recent != null && recent >= 10) throw new TooManyRequestsException("Too many reset requests. Please try again later.", 900);
    List<Map<String, Object>> rows = db.queryForList("SELECT id,phone FROM users WHERE (phone=? OR LOWER(email)=LOWER(?)) AND role IN ('ADMIN','SUPER_ADMIN','SUPPORT') AND enabled=TRUE LIMIT 1", id, id);
    Map<String, Object> out = new HashMap<>();
    out.put("message", "If this account exists, a verification code has been sent to its registered mobile number.");
    out.put("expiresInSeconds", 300);
    out.put("resendInSeconds", 30);
    if (rows.isEmpty()) {
      db.update("INSERT INTO admin_password_resets(user_id,identifier,ip_address,status) VALUES(NULL,?,?,'FAILED')", id.substring(0, Math.min(190, id.length())), ip);
      int h = Math.abs(id.toLowerCase().hashCode()) % 10000;
      out.put("resetToken", jwt.createChallenge("0000000000", "pwreset", 600));
      out.put("maskedPhone", "******" + String.format("%04d", h));
      return out;
    }
    long uid = ((Number) rows.get(0).get("id")).longValue(); String phone = (String) rows.get(0).get("phone");
    var issued = otp.request(phone, ip, "ADMIN_RESET");
    db.update("INSERT INTO admin_password_resets(user_id,identifier,ip_address,status) VALUES(?,?,?,'REQUESTED')", uid, id.substring(0, Math.min(190, id.length())), ip);
    audit.log(uid, "ADMIN_RESET_REQUESTED", "USER", String.valueOf(uid), null, ip);
    out.put("resetToken", jwt.createChallenge(phone, "pwreset", 600));
    out.put("maskedPhone", "******" + phone.substring(Math.max(0, phone.length() - 4)));
    out.put("resendInSeconds", issued.resendInSeconds());
    if (issued.devOtp() != null) out.put("devOtp", issued.devOtp());
    return out;
  }

  /** Forgot password (step 2): code + new password. Revokes every admin session of that account. */
  public Map<String, Object> reset(String resetToken, String code, String newPassword, String ip) {
    Claims c;
    try { c = jwt.parse(resetToken); } catch (Exception e) { throw new IllegalArgumentException("This reset link expired. Please start again."); }
    if (!"pwreset".equals(c.get("typ"))) throw new IllegalArgumentException("This reset link expired. Please start again.");
    PasswordPolicy.check(newPassword);
    String phone = c.getSubject();
    try { otp.verify(phone, code, "ADMIN_RESET"); }
    catch (IllegalArgumentException e) { attempt(phone, ip, false, "BAD_RESET_OTP"); throw e; }
    List<Map<String, Object>> rows = db.queryForList("SELECT id FROM users WHERE phone=? AND enabled=TRUE AND role IN ('ADMIN','SUPER_ADMIN','SUPPORT')", phone);
    if (rows.isEmpty()) throw new IllegalArgumentException("Invalid or expired code.");
    long uid = ((Number) rows.get(0).get("id")).longValue();
    db.update("UPDATE users SET password_hash=?, must_change_password=FALSE, password_changed_at=UTC_TIMESTAMP(), failed_login_count=0, locked_until=NULL, token_version=token_version+1 WHERE id=?", encoder.encode(newPassword), uid);
    db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", uid);
    db.update("UPDATE admin_password_resets SET status='COMPLETED' WHERE user_id=? AND status='REQUESTED'", uid);
    audit.log(uid, "ADMIN_PASSWORD_RESET", "USER", String.valueOf(uid), "Password reset with OTP; all sessions revoked", ip);
    return Map.of("message", "Password changed. Please sign in with your new password.");
  }

  private Map<String, Object> openSession(long uid, String phone, String role, String ip, String ua) {
    int minutes = settings.getInt("ADMIN_SESSION_MINUTES", 30);
    byte[] raw = new byte[16]; random.nextBytes(raw);
    String sid = HexFormat.of().formatHex(raw);
    db.update("INSERT INTO admin_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))", sid, uid, ip, ua == null ? null : ua.substring(0, Math.min(255, ua.length())), minutes);
    db.update("UPDATE users SET failed_login_count=0, locked_until=NULL, last_login_at=UTC_TIMESTAMP(), last_login_ip=? WHERE id=?", ip, uid);
    attempt(phone, ip, true, "OK");
    audit.log(uid, "ADMIN_LOGIN", "USER", String.valueOf(uid), "Session " + sid.substring(0, 6), ip);
    Map<String, Object> out = new HashMap<>();
    out.put("token", jwt.createAdmin(phone, role, sid, minutes));
    out.put("sessionMinutes", minutes);
    out.put("user", userWithPermissions(uid));
    return out;
  }

  /** Sliding session: a still-valid admin token gets a fresh expiry (used while the admin is actively working). */
  public Map<String, Object> extend(String sid, String phone, String role) {
    int minutes = settings.getInt("ADMIN_SESSION_MINUTES", 30);
    int n = db.update("UPDATE admin_sessions SET expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), last_seen_at=UTC_TIMESTAMP() WHERE id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()", minutes, sid);
    if (n == 0) throw new IllegalArgumentException("Session expired. Please sign in again.");
    return Map.of("token", jwt.createAdmin(phone, role, sid, minutes), "sessionMinutes", minutes);
  }

  public void logout(String sid) { if (sid != null) db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE id=? AND revoked_at IS NULL", sid); }

  public Map<String, Object> userWithPermissions(long uid) {
    Map<String, Object> u = new HashMap<>(db.queryForMap("SELECT id,public_id,full_name,phone,email,role FROM users WHERE id=?", uid));
    u.put("permissions", db.queryForList("SELECT permission_code FROM role_permissions WHERE role_code=?", String.class, u.get("role")));
    return u;
  }

  private void attempt(String identifier, String ip, boolean ok, String reason) {
    db.update("INSERT INTO login_attempts(identifier,ip_address,scope,success,reason) VALUES(?,?,'ADMIN',?,?)", identifier.substring(0, Math.min(190, identifier.length())), ip, ok, reason);
  }
}
