package com.narayanix.dialoo.service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Component;

/** Small helper so inserts return their own generated id on the SAME connection (LAST_INSERT_ID() in a second call is unsafe with a pool). */
@Component
public class Sql {
  private final JdbcTemplate db;
  public Sql(JdbcTemplate db) { this.db = db; }

  public long insert(String sql, Object... args) {
    GeneratedKeyHolder keys = new GeneratedKeyHolder();
    db.update(con -> {
      PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
      for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
      return ps;
    }, keys);
    Number k = keys.getKey();
    if (k == null) throw new IllegalStateException("Insert did not return an id");
    return k.longValue();
  }
}
