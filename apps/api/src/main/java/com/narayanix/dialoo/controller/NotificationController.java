package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Notification feed (SRS 10.13) + public platform reads (plans, feature flags). */
@RestController @RequestMapping("/api/v1")
public class NotificationController {
  private final JdbcTemplate db; private final CurrentUser me;
  public NotificationController(JdbcTemplate db, CurrentUser me) { this.db = db; this.me = me; }

  @GetMapping("/subscription-plans") public List<Map<String, Object>> plans() {
    return db.queryForList("SELECT id,name,price,billing_period,features,request_limit FROM subscription_plans WHERE active=TRUE ORDER BY price");
  }

  @GetMapping("/feature-flags") public Map<String, Boolean> flags() {
    Map<String, Boolean> m = new LinkedHashMap<>();
    db.queryForList("SELECT flag_key,is_enabled FROM feature_flags ORDER BY flag_key").forEach(r -> m.put((String) r.get("flag_key"), Boolean.TRUE.equals(r.get("is_enabled"))));
    return m;
  }

  @GetMapping("/notifications") public Map<String, Object> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "false") boolean unreadOnly, Authentication a) {
    long uid = me.id(a); int s = Math.min(Math.max(size, 1), 50), p = Math.max(page, 0);
    var items = db.queryForList("SELECT id,type,title,body,entity_type,entity_id,priority,read_at,created_at FROM notifications WHERE user_id=?" + (unreadOnly ? " AND read_at IS NULL" : "") + " ORDER BY id DESC LIMIT ? OFFSET ?", uid, s, p * s);
    Long unread = db.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL", Long.class, uid);
    return Map.of("items", items, "unread", unread == null ? 0 : unread, "page", p, "size", s);
  }

  @GetMapping("/notifications/unread-count") public Map<String, Object> unread(Authentication a) {
    Long n = db.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL", Long.class, me.id(a));
    Long latest = db.queryForObject("SELECT COALESCE(MAX(id),0) FROM notifications WHERE user_id=?", Long.class, me.id(a));
    return Map.of("unread", n == null ? 0 : n, "latestId", latest == null ? 0 : latest);
  }

  @PatchMapping("/notifications/{id}/read") public Map<String, Object> markRead(@PathVariable long id, Authentication a) {
    db.update("UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND read_at IS NULL", id, me.id(a));
    return Map.of("id", id, "read", true);
  }

  @PostMapping("/notifications/read-all") public Map<String, Object> readAll(Authentication a) {
    int n = db.update("UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL", me.id(a));
    return Map.of("updated", n);
  }
}
