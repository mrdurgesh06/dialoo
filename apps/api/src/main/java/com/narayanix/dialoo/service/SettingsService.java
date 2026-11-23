package com.narayanix.dialoo.service;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Admin-configurable values and feature flags - never hardcoded (SRS 22, 77). */
@Service
public class SettingsService {
  private final JdbcTemplate db;
  public SettingsService(JdbcTemplate db) { this.db = db; }

  public String get(String key, String def) {
    List<String> r = db.queryForList("SELECT setting_value FROM system_settings WHERE setting_key=?", String.class, key);
    return r.isEmpty() ? def : r.get(0);
  }
  public int getInt(String key, int def) {
    try { return Integer.parseInt(get(key, String.valueOf(def)).trim()); } catch (NumberFormatException e) { return def; }
  }
  public BigDecimal getDecimal(String key, String def) {
    try { return new BigDecimal(get(key, def).trim()); } catch (NumberFormatException e) { return new BigDecimal(def); }
  }
  public boolean flag(String key, boolean def) {
    List<Boolean> r = db.queryForList("SELECT is_enabled FROM feature_flags WHERE flag_key=?", Boolean.class, key);
    return r.isEmpty() ? def : Boolean.TRUE.equals(r.get(0));
  }
}
