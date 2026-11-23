package com.narayanix.dialoo.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final SecretKey key;
  private final long expiryMinutes;

  public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiration-minutes}") long expiryMinutes) {
    if (secret.getBytes(StandardCharsets.UTF_8).length < 32) throw new IllegalArgumentException("JWT_SECRET must be at least 32 bytes");
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expiryMinutes = expiryMinutes;
  }

  public String create(String phone, String role) {
    Instant now = Instant.now();
    return Jwts.builder().subject(phone).claim("role", role).issuedAt(Date.from(now))
      .expiration(Date.from(now.plusSeconds(expiryMinutes * 60))).signWith(key).compact();
  }

  /** Admin access token. Bound to a server-side admin_sessions row (sid) so it can be revoked at any time. */
  public String createAdmin(String phone, String role, String sessionId, long minutes) {
    Instant now = Instant.now();
    return Jwts.builder().subject(phone).claim("role", role).claim("sid", sessionId).claim("amr", "pwd+otp")
      .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(minutes * 60))).signWith(key).compact();
  }

  /** Short-lived step proof (typ = mfa | pwreset | pwchange). It is NOT an access token and cannot call any API. */
  public String createChallenge(String subject, String type, long seconds) {
    Instant now = Instant.now();
    return Jwts.builder().subject(subject).claim("typ", type).issuedAt(Date.from(now))
      .expiration(Date.from(now.plusSeconds(seconds))).signWith(key).compact();
  }

  public String createMfaChallenge(String phone, long seconds) { return createChallenge(phone, "mfa", seconds); }

  public Claims parse(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }
}
