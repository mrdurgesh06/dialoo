package com.narayanix.dialoo.service;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {
  private final JdbcTemplate db;
  public CurrentUser(JdbcTemplate db) { this.db = db; }

  public long id(Authentication a) {
    if (a == null) throw new ForbiddenException("Please sign in to continue.");
    List<Long> rows = db.queryForList("SELECT id FROM users WHERE phone=?", Long.class, a.getName());
    if (rows.isEmpty()) throw new ForbiddenException("Please sign in to continue.");
    return rows.get(0);
  }

  public Map<String, Object> row(long userId) {
    return db.queryForMap("SELECT id,full_name,phone,email,role FROM users WHERE id=?", userId);
  }

  public String role(Authentication a) {
    return a.getAuthorities().stream().map(g -> g.getAuthority()).filter(x -> x.startsWith("ROLE_")).findFirst().map(x -> x.substring(5)).orElse("CUSTOMER");
  }

  /** Which side of Dialoo this login session belongs to: "CUSTOMER" or "PROVIDER" (a partner). Staff sessions count as CUSTOMER. */
  public String actor(Authentication a) {
    if (a == null) return "CUSTOMER";
    return a.getAuthorities().stream().anyMatch(g -> "ACTOR_PROVIDER".equals(g.getAuthority())) ? "PROVIDER" : "CUSTOMER";
  }

  public boolean isStaff(Authentication a) {
    String r = role(a);
    return "ADMIN".equals(r) || "SUPER_ADMIN".equals(r) || "SUPPORT".equals(r);
  }
}
