package com.narayanix.dialoo.tracking;

import com.narayanix.dialoo.service.JwtService;
import io.jsonwebtoken.Claims;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Same rules as the HTTP JwtFilter: role and enabled flag come from the database, staff need a live admin session, refresh tokens are refused. */
@Component
public class WsAuthenticator {
  private static final Set<String> STAFF = Set.of("ADMIN", "SUPER_ADMIN", "SUPPORT");
  private final JwtService jwt; private final JdbcTemplate db;
  public WsAuthenticator(JwtService jwt, JdbcTemplate db) { this.jwt = jwt; this.db = db; }

  /** @return the authenticated user, or null when the token is missing, invalid, expired or the account is disabled. */
  public WsUser authenticate(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) return null;
    try {
      Claims claims = jwt.parse(authorizationHeader.substring(7));
      if (claims.get("typ") != null) return null;
      String phone = claims.getSubject();
      List<Map<String, Object>> u = db.queryForList("SELECT id,role,enabled FROM users WHERE phone=?", phone);
      if (u.isEmpty() || !Boolean.TRUE.equals(u.get(0).get("enabled"))) return null;
      String role = (String) u.get(0).get("role");
      String actor = "PROVIDER".equals(claims.get("actor", String.class)) ? "PROVIDER" : "CUSTOMER";
      if (STAFF.contains(role)) {
        String sid = claims.get("sid", String.class);
        boolean live = sid != null && !db.queryForList("SELECT 1 FROM admin_sessions WHERE id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()", sid).isEmpty();
        if (!live) role = "CUSTOMER";
      }
      long exp = claims.getExpiration() == null ? System.currentTimeMillis() + 3_600_000 : claims.getExpiration().getTime();
      return new WsUser(phone, ((Number) u.get(0).get("id")).longValue(), role, actor, exp);
    } catch (Exception e) { return null; }
  }
}
