package com.narayanix.dialoo.config;

import com.narayanix.dialoo.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
  @Value("${app.cors.allowed-origin}") private String allowedOrigin;

  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

  @Bean CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration c = new CorsConfiguration();
    c.setAllowedOrigins(List.of(allowedOrigin.split(",")));
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    c.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/**", c);
    return s;
  }

  @Bean SecurityFilterChain filterChain(HttpSecurity http, JwtService jwt, JdbcTemplate db) throws Exception {
    http.csrf(csrf -> csrf.disable()).cors(Customizer.withDefaults())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .headers(h -> h.frameOptions(f -> f.deny()).contentTypeOptions(Customizer.withDefaults())
        .referrerPolicy(r -> r.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
      .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
      .authorizeHttpRequests(a -> a
        // STOMP handshake: identity is proven in the CONNECT frame (JWT) and every SUBSCRIBE/SEND is authorised in StompAuthInterceptor.
        .requestMatchers("/ws/tracking", "/ws/tracking/**").permitAll()
        .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/otp/**", "/api/v1/auth/password/forgot/**",
          "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/health", "/actuator/health/**").permitAll()
        .requestMatchers("/api/v1/admin/auth/login", "/api/v1/admin/auth/verify", "/api/v1/admin/auth/verify-widget", "/api/v1/admin/auth/forgot", "/api/v1/admin/auth/reset", "/api/v1/admin/auth/change-initial").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/**", "/api/v1/providers", "/api/v1/providers/**",
          "/api/v1/rentals", "/api/v1/projects", "/api/v1/subscription-plans", "/api/v1/feature-flags", "/api/v1/banners",
          "/api/v1/cities", "/api/v1/search/**", "/api/v1/geo/**", "/api/v1/coupons/available").permitAll()
        .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN", "SUPPORT")
        // ---- One login = one side. A Consumer session can never call Partner APIs and a Partner session can never call Consumer APIs. ----
        .requestMatchers("/api/v1/provider/**", "/api/v1/providers/apply", "/api/v1/reviews/*/reply").hasAuthority("ACTOR_PROVIDER")
        .requestMatchers(HttpMethod.POST, "/api/v1/projects/*/quotes").hasAuthority("ACTOR_PROVIDER")
        .requestMatchers("/api/v1/partners/nearby").hasAuthority("ACTOR_CUSTOMER")
        .requestMatchers("/api/v1/checkout/**", "/api/v1/me/**", "/api/v1/emergencies").hasAuthority("ACTOR_CUSTOMER")
        .requestMatchers(HttpMethod.POST, "/api/v1/bookings", "/api/v1/reviews", "/api/v1/rentals", "/api/v1/projects").hasAuthority("ACTOR_CUSTOMER")
        .requestMatchers(HttpMethod.GET, "/api/v1/bookings").hasAuthority("ACTOR_CUSTOMER")
        .anyRequest().authenticated())
      .addFilterBefore(new JwtFilter(jwt, db), UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  /**
   * Role is always read from the database (so role changes and disabled accounts apply immediately).
   * Staff roles only count when the token carries a live admin session id (password + OTP sign-in).
   */
  static class JwtFilter extends OncePerRequestFilter {
    private static final Set<String> STAFF = Set.of("ADMIN", "SUPER_ADMIN", "SUPPORT");
    private final JwtService jwt; private final JdbcTemplate db;
    JwtFilter(JwtService jwt, JdbcTemplate db) { this.jwt = jwt; this.db = db; }

    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
      String h = req.getHeader("Authorization");
      if (h != null && h.startsWith("Bearer ")) {
        try {
          Claims claims = jwt.parse(h.substring(7));
          if (claims.get("typ") == null) {
            String phone = claims.getSubject();
            List<Map<String, Object>> u = db.queryForList("SELECT role,enabled FROM users WHERE phone=?", phone);
            if (!u.isEmpty() && Boolean.TRUE.equals(u.get(0).get("enabled"))) {
              String role = (String) u.get(0).get("role");
              String actor = "PROVIDER".equals(claims.get("actor", String.class)) ? "PROVIDER" : "CUSTOMER";   // tokens without the claim (old sessions) count as CUSTOMER
              if (STAFF.contains(role)) {
                String sid = claims.get("sid", String.class);
                boolean live = sid != null && !db.queryForList("SELECT 1 FROM admin_sessions WHERE id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()", sid).isEmpty();
                if (live) db.update("UPDATE admin_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE id=? AND last_seen_at<DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)", sid);
                else role = "CUSTOMER";   // staff account without a live 2-step admin session gets no admin rights
              }
              SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(phone, null, List.of(new SimpleGrantedAuthority("ROLE_" + role), new SimpleGrantedAuthority("ACTOR_" + actor))));
            }
          }
        } catch (Exception ignored) { SecurityContextHolder.clearContext(); }
      }
      chain.doFilter(req, res);
    }
  }
}
