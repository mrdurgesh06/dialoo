package com.narayanix.dialoo.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Issues access (JWT) + refresh tokens. Refresh tokens are random, stored hashed, rotated on use, and revocable (SRS 21). */
@Service
public class TokenService {
  private final JdbcTemplate db; private final JwtService jwt; private final int refreshDays; private final SecureRandom random = new SecureRandom();
  public TokenService(JdbcTemplate db, JwtService jwt, @Value("${app.jwt.refresh-expiration-days:30}") int refreshDays) { this.db = db; this.jwt = jwt; this.refreshDays = refreshDays; }

  public Map<String, Object> issue(long userId, String phone, String role, String device) {
    byte[] raw = new byte[48]; random.nextBytes(raw);
    String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    db.update("INSERT INTO refresh_tokens(user_id,token_hash,device_info,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))", userId, sha256(refresh), device == null ? null : device.substring(0, Math.min(255, device.length())), refreshDays);
    return Map.of("token", jwt.create(phone, role), "refreshToken", refresh, "tokenType", "Bearer");
  }

  /** Rotates a refresh token. Re-use of a revoked token revokes every session for that user (theft signal). */
  public Map<String, Object> rotate(String refresh, String device) {
    if (refresh == null || refresh.isBlank()) throw new IllegalArgumentException("Session expired. Please log in again.");
    List<Map<String, Object>> rows = db.queryForList("SELECT id,user_id,revoked_at,expires_at>UTC_TIMESTAMP() AS valid FROM refresh_tokens WHERE token_hash=?", sha256(refresh));
    if (rows.isEmpty()) throw new IllegalArgumentException("Session expired. Please log in again.");
    Map<String, Object> r = rows.get(0); long uid = ((Number) r.get("user_id")).longValue();
    if (r.get("revoked_at") != null) { revokeAll(uid); throw new IllegalArgumentException("Session expired. Please log in again."); }
    if (((Number) r.get("valid")).intValue() != 1) throw new IllegalArgumentException("Session expired. Please log in again.");
    db.update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE id=?", ((Number) r.get("id")).longValue());
    var u = db.queryForMap("SELECT phone,role,enabled FROM users WHERE id=?", uid);
    if (!Boolean.TRUE.equals(u.get("enabled"))) throw new IllegalArgumentException("Account is disabled");
    if (java.util.Set.of("ADMIN", "SUPER_ADMIN", "SUPPORT").contains((String) u.get("role"))) throw new IllegalArgumentException("Session expired. Please log in again.");
    return issue(uid, (String) u.get("phone"), (String) u.get("role"), device);
  }

  public void revoke(String refresh) { if (refresh != null && !refresh.isBlank()) db.update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=? AND revoked_at IS NULL", sha256(refresh)); }
  public void revokeAll(long userId) { db.update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", userId); }

  private static String sha256(String s) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }
}
