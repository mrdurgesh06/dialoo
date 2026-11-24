package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.AuditService;
import com.narayanix.dialoo.service.OtpService;
import com.narayanix.dialoo.service.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
 private final JdbcTemplate db; private final PasswordEncoder encoder; private final TokenService tokens; private final OtpService otp; private final AuditService audit;
 public AuthController(JdbcTemplate db,PasswordEncoder encoder,TokenService tokens,OtpService otp,AuditService audit){this.db=db;this.encoder=encoder;this.tokens=tokens;this.otp=otp;this.audit=audit;}
 public record Register(@NotBlank @Size(min=2,max=120) String fullName,@NotBlank @Pattern(regexp="[0-9+ -]{10,20}") String phone,@NotBlank @Size(min=8,max=72) String password,String email){}
 public record Login(@NotBlank String phone,@NotBlank String password){}
 public record ForgotRequest(@NotBlank String mobile){}
 public record PasswordReset(@NotBlank String mobile,@NotBlank @Pattern(regexp="[0-9]{6}") String otp,@NotBlank @Size(min=8,max=72) String newPassword){}
 public record OtpRequest(@NotBlank String mobile){}
 public record OtpVerify(@NotBlank String mobile,@NotBlank @Pattern(regexp="[0-9]{6}") String otp){}
 public record RefreshRequest(@NotBlank String refreshToken){}
 public record ProfileUpdate(@Size(min=2,max=120) String fullName,@Size(max=190) String email,@Pattern(regexp="en|hi") String preferredLanguage){}

 // ---- Existing password flow (unchanged behaviour) ----
 @PostMapping("/register") public Map<String,Object> register(@Valid @RequestBody Register r,HttpServletRequest req){
   String phone=r.phone().replaceAll("[ -]",""); if(db.queryForList("SELECT id FROM users WHERE phone=?",phone).size()>0) throw new IllegalArgumentException("This mobile number is already registered");
   db.update("INSERT INTO users(full_name,phone,email,password_hash,role,public_id) VALUES(?,?,?,?, 'CUSTOMER', UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)))",r.fullName().trim(),phone,r.email(),encoder.encode(r.password()));
   return loginResult(phone,req);
 }
 @PostMapping("/login") public Map<String,Object> login(@Valid @RequestBody Login l,HttpServletRequest req){
   String identifier=l.phone().trim();
   var rows=db.queryForList("SELECT full_name,phone,password_hash,role,enabled FROM users WHERE phone=? OR LOWER(email)=LOWER(?) ORDER BY CASE WHEN phone=? THEN 0 ELSE 1 END LIMIT 1",identifier,identifier,identifier);
   if(rows.isEmpty()||!Boolean.TRUE.equals(rows.get(0).get("enabled"))||rows.get(0).get("password_hash")==null||!encoder.matches(l.password(),(String)rows.get(0).get("password_hash"))) throw new IllegalArgumentException("Invalid phone or password");
   rejectStaff((String)rows.get(0).get("role"));
   return loginResult((String)rows.get(0).get("phone"),req);
 }

 // ---- New: passwordless OTP flow (SRS 10.1, 21) ----
 @PostMapping("/otp/request") public Map<String,Object> otpRequest(@Valid @RequestBody OtpRequest r,HttpServletRequest req){
   var issued=otp.request(r.mobile(),req.getRemoteAddr());
   Map<String,Object> out=new HashMap<>(); out.put("message","OTP sent"); out.put("expiresInSeconds",issued.expiresInSeconds()); out.put("resendInSeconds",issued.resendInSeconds());
   if(issued.devOtp()!=null) out.put("devOtp",issued.devOtp()); // only when app.otp.dev-mode=true
   return out;
 }
 @PostMapping("/otp/verify") public Map<String,Object> otpVerify(@Valid @RequestBody OtpVerify r,HttpServletRequest req){
   String mobile=otp.verify(r.mobile(),r.otp());
   var rows=db.queryForList("SELECT id,phone,role,enabled FROM users WHERE phone IN (?,?) ORDER BY id LIMIT 1",mobile,"+91"+mobile);
   boolean isNew=rows.isEmpty();
   if(isNew){ db.update("INSERT INTO users(full_name,phone,password_hash,role,public_id) VALUES('Dialoo User',?,NULL,'CUSTOMER',UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)))",mobile); }
   else if(!Boolean.TRUE.equals(rows.get(0).get("enabled"))) throw new IllegalArgumentException("This account is disabled. Please contact support.");
   else rejectStaff((String)rows.get(0).get("role"));
   String phone=isNew?mobile:(String)rows.get(0).get("phone");
   db.update("UPDATE users SET last_login_at=UTC_TIMESTAMP() WHERE phone=?",phone);
   Map<String,Object> out=new HashMap<>(loginResult(phone,req)); out.put("isNewUser",isNew);
   Long uid=((Number)((Map<?,?>)out.get("user")).get("id")).longValue();
   audit.log(uid,isNew?"AUTH_OTP_REGISTER":"AUTH_OTP_LOGIN","USER",String.valueOf(uid),null,req.getRemoteAddr());
   return out;
 }

 // Email login uses the same password flow; account recovery is OTP-verified over the registered mobile.
 @PostMapping("/password/forgot/request") public Map<String,Object> forgotRequest(@Valid @RequestBody ForgotRequest r,HttpServletRequest req){
   String mobile=OtpService.normalize(r.mobile());
   Integer exists=db.queryForObject("SELECT COUNT(*) FROM users WHERE phone IN (?,?) AND enabled=TRUE",Integer.class,mobile,"+91"+mobile);
   if(exists==null||exists==0) throw new IllegalArgumentException("No active account found for this mobile number.");
   var issued=otp.request(mobile,req.getRemoteAddr(),"PASSWORD_RESET");
   Map<String,Object> out=new HashMap<>(); out.put("message","If the account is eligible, a reset code has been issued."); out.put("expiresInSeconds",issued.expiresInSeconds()); out.put("resendInSeconds",issued.resendInSeconds());
   if(issued.devOtp()!=null) out.put("devOtp",issued.devOtp());
   return out;
 }
 @PostMapping("/password/forgot/reset") public Map<String,Object> forgotReset(@Valid @RequestBody PasswordReset r){
   String mobile=otp.verify(r.mobile(),r.otp(),"PASSWORD_RESET");
   List<Map<String,Object>> accounts=db.queryForList("SELECT id FROM users WHERE phone IN (?,?) AND enabled=TRUE",mobile,"+91"+mobile);
   if(accounts.isEmpty()) throw new IllegalArgumentException("Password could not be reset for this account.");
   long userId=((Number)accounts.get(0).get("id")).longValue();
   db.update("UPDATE users SET password_hash=? WHERE id=?",encoder.encode(r.newPassword()),userId);
   db.update("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL",userId);
   return Map.of("message","Password reset successfully. Please sign in again.");
 }

 private static void rejectStaff(String role){ if("ADMIN".equals(role)||"SUPER_ADMIN".equals(role)||"SUPPORT".equals(role)) throw new IllegalArgumentException("Staff accounts must sign in from the secure admin console."); }
 @PostMapping("/refresh") public Map<String,Object> refresh(@Valid @RequestBody RefreshRequest r,HttpServletRequest req){return tokens.rotate(r.refreshToken(),req.getHeader("User-Agent"));}
 @PostMapping("/logout") public Map<String,Object> logout(@RequestBody(required=false) Map<String,String> body){tokens.revoke(body==null?null:body.get("refreshToken"));return Map.of("message","Logged out");}

 private Map<String,Object> loginResult(String phone,HttpServletRequest req){
   var u=db.queryForMap("SELECT id,full_name,phone,email,role,preferred_language FROM users WHERE phone=?",phone);
   var t=tokens.issue(((Number)u.get("id")).longValue(),phone,(String)u.get("role"),req.getHeader("User-Agent"));
   Map<String,Object> out=new HashMap<>(t); out.put("user",u); return out;
 }
 @GetMapping("/me") public Map<String,Object> me(org.springframework.security.core.Authentication a){return db.queryForMap("SELECT id,public_id,full_name,phone,email,role,preferred_language,created_at FROM users WHERE phone=?",a.getName());}
 @PatchMapping("/me") public Map<String,Object> updateMe(@Valid @RequestBody ProfileUpdate p,org.springframework.security.core.Authentication a){
   db.update("UPDATE users SET full_name=COALESCE(?,full_name),email=COALESCE(?,email),preferred_language=COALESCE(?,preferred_language) WHERE phone=?",p.fullName()==null?null:p.fullName().trim(),(p.email()==null||p.email().isBlank())?null:p.email().trim(),p.preferredLanguage(),a.getName());
   return me(a);
 }
}
