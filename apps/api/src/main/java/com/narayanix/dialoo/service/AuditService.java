package com.narayanix.dialoo.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
  private final JdbcTemplate db;
  public AuditService(JdbcTemplate db) { this.db = db; }

  public void log(Long actorUserId, String action, String entityType, String entityId, String detail, String ip) {
    db.update("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,detail,ip_address) VALUES(?,?,?,?,?,?)",
      actorUserId, action, entityType, entityId, detail == null ? null : detail.substring(0, Math.min(500, detail.length())), ip);
  }
}
