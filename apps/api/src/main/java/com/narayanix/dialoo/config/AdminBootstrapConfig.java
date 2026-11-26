package com.narayanix.dialoo.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Creates the first SUPER_ADMIN. ADMIN_PHONE and ADMIN_PASSWORD MUST be supplied in every environment (local, test, production);
 * there is no built-in phone or password, so a forgotten variable can never create an admin with a publicly known login. The password is only written when the account is created, or when
 * ADMIN_RESET_PASSWORD=true is set deliberately - a normal restart never overwrites it.
 */
@Configuration
public class AdminBootstrapConfig {
  @Bean
  ApplicationRunner bootstrapAdmin(JdbcTemplate db, PasswordEncoder encoder, Environment env) {
    return args -> {
      String phone = env.getProperty("ADMIN_PHONE", "").replaceAll("[^0-9]", "");
      String password = env.getProperty("ADMIN_PASSWORD", "");
      String name = env.getProperty("ADMIN_NAME", "Dialoo Admin");
      boolean reset = Boolean.parseBoolean(env.getProperty("ADMIN_RESET_PASSWORD", "false"));
      if (phone.isBlank() || password.isBlank()) {
        System.out.println("Dialoo admin bootstrap skipped: set ADMIN_PHONE and ADMIN_PASSWORD to create the first admin.");
        return;
      }
      if (!phone.matches("[6-9][0-9]{9}")) throw new IllegalStateException("ADMIN_PHONE must be a 10-digit Indian mobile number (needed for the admin OTP).");
      if (password.length() < 12) throw new IllegalStateException("ADMIN_PASSWORD must be at least 12 characters.");
      var rows = db.queryForList("SELECT id FROM users WHERE phone=?", phone);
      if (rows.isEmpty()) {
        db.update("INSERT INTO users(full_name,phone,email,password_hash,role,enabled,public_id,password_changed_at) VALUES(?,?,NULL,?,'SUPER_ADMIN',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)),UTC_TIMESTAMP())",
          name, phone, encoder.encode(password));
        System.out.println("Dialoo SUPER_ADMIN created for phone: " + phone);
      } else if (reset) {
        db.update("UPDATE users SET full_name=?,password_hash=?,role='SUPER_ADMIN',enabled=TRUE,failed_login_count=0,locked_until=NULL,password_changed_at=UTC_TIMESTAMP() WHERE phone=?", name, encoder.encode(password), phone);
        System.out.println("Dialoo admin password reset for phone: " + phone);
      } else {
        db.update("UPDATE users SET role='SUPER_ADMIN', enabled=TRUE WHERE phone=?", phone);
        System.out.println("Dialoo admin already exists for phone: " + phone + " (password unchanged; set ADMIN_RESET_PASSWORD=true to reset).");
      }
    };
  }
}
