package com.narayanix.dialoo.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

/** Central permission check for staff (SRS 21): role -> permission mapping lives in the database. */
@Service
public class PermissionService {
  private final JdbcTemplate db; private final CurrentUser me;
  public PermissionService(JdbcTemplate db, CurrentUser me) { this.db = db; this.me = me; }

  public boolean has(Authentication a, String permission) {
    String role = me.role(a);
    Integer n = db.queryForObject("SELECT COUNT(*) FROM role_permissions WHERE role_code=? AND permission_code=?", Integer.class, role, permission);
    return n != null && n > 0;
  }
  public void require(Authentication a, String permission) {
    if (!has(a, permission)) throw new ForbiddenException("You do not have permission for this action (" + permission + ").");
  }
}
