package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.AdminAuthService;
import com.narayanix.dialoo.service.CurrentUser;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/admin/auth")
public class AdminAuthController {
  public record Login(@NotBlank String identifier, @NotBlank String password) {}
  public record Forgot(@NotBlank String identifier) {}
  public record Reset(@NotBlank String resetToken, @NotBlank @Pattern(regexp = "[0-9]{6}") String otp, @NotBlank String newPassword) {}
  public record ChangeInitial(@NotBlank String changeToken, @NotBlank String newPassword) {}
  public record Verify(@NotBlank String mfaToken, @NotBlank @Pattern(regexp = "[0-9]{6}") String otp) {}

  private final AdminAuthService auth; private final CurrentUser me; private final com.narayanix.dialoo.service.JwtService jwt;
  public AdminAuthController(AdminAuthService auth, CurrentUser me, com.narayanix.dialoo.service.JwtService jwt) { this.auth = auth; this.me = me; this.jwt = jwt; }

  @PostMapping("/login") public Map<String, Object> login(@Valid @RequestBody Login l, HttpServletRequest req) {
    return auth.login(l.identifier(), l.password(), req.getRemoteAddr(), req.getHeader("User-Agent"));
  }
  @PostMapping("/verify") public Map<String, Object> verify(@Valid @RequestBody Verify v, HttpServletRequest req) {
    return auth.verifyOtp(v.mfaToken(), v.otp(), req.getRemoteAddr(), req.getHeader("User-Agent"));
  }
  @PostMapping("/forgot") public Map<String, Object> forgot(@Valid @RequestBody Forgot f, HttpServletRequest req) { return auth.forgot(f.identifier(), req.getRemoteAddr()); }
  @PostMapping("/reset") public Map<String, Object> reset(@Valid @RequestBody Reset r, HttpServletRequest req) { return auth.reset(r.resetToken(), r.otp(), r.newPassword(), req.getRemoteAddr()); }
  @PostMapping("/change-initial") public Map<String, Object> changeInitial(@Valid @RequestBody ChangeInitial c, HttpServletRequest req) {
    return auth.changeInitial(c.changeToken(), c.newPassword(), req.getRemoteAddr(), req.getHeader("User-Agent"));
  }
  @GetMapping("/me") public Map<String, Object> me(Authentication a) { return auth.userWithPermissions(me.id(a)); }

  @PostMapping("/extend") public Map<String, Object> extend(Authentication a, HttpServletRequest req) {
    Claims c = jwt.parse(req.getHeader("Authorization").substring(7));
    return auth.extend(c.get("sid", String.class), a.getName(), me.role(a));
  }
  @PostMapping("/logout") public Map<String, Object> logout(HttpServletRequest req) {
    String h = req.getHeader("Authorization");
    try { if (h != null && h.startsWith("Bearer ")) auth.logout(jwt.parse(h.substring(7)).get("sid", String.class)); } catch (Exception ignored) { }
    return Map.of("message", "Signed out");
  }
}
