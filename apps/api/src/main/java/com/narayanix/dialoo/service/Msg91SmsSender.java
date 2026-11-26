package com.narayanix.dialoo.service;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Real OTP delivery through the MSG91 OTP API (v5).
 * The code is generated, hashed and verified by OtpService; MSG91 only delivers it using your DLT-approved
 * OTP template (the template must contain the ##OTP## variable). Credentials are environment-only.
 */
@Component
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "msg91")
public class Msg91SmsSender implements SmsSender {
  private static final Logger log = LoggerFactory.getLogger(Msg91SmsSender.class);
  private static final String OTP_URL = "https://control.msg91.com/api/v5/otp";

  private final String authKey, templateId, countryCode;
  private final RestClient client = RestClient.builder().build();

  public Msg91SmsSender(@Value("${app.sms.msg91.auth-key:}") String authKey,
      @Value("${app.sms.msg91.template-id:}") String templateId,
      @Value("${app.sms.msg91.country-code:91}") String countryCode) {
    this.authKey = authKey.trim(); this.templateId = templateId.trim(); this.countryCode = countryCode.trim();
    if (this.authKey.isBlank() || this.templateId.isBlank())
      throw new IllegalStateException("MSG91 selected but MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required");
  }

  @Override public void send(String mobile, String message) {
    // MSG91 India only delivers DLT-approved templates, so free-text SMS is intentionally unsupported.
    throw new UnsupportedOperationException("MSG91 sender delivers OTP codes only (use sendOtp)");
  }

  @Override public void sendOtp(String mobile, String otp, int ttlMinutes, String message) {
    String number = mobile.startsWith("+") ? mobile.substring(1) : (mobile.length() == 10 ? countryCode + mobile : mobile);
    var uri = UriComponentsBuilder.fromUriString(OTP_URL)
        .queryParam("template_id", templateId).queryParam("mobile", number)
        .queryParam("otp", otp).queryParam("otp_expiry", ttlMinutes).build().toUri();
    @SuppressWarnings("unchecked")
    Map<String, Object> res = client.post().uri(uri).header("authkey", authKey)
        .header("Content-Type", "application/json").body(Map.of()).retrieve().body(Map.class);
    // MSG91 often answers HTTP 200 with {"type":"error", ...}, so the body must be checked.
    if (res == null || !"success".equalsIgnoreCase(String.valueOf(res.get("type")))) {
      String masked = number.length() > 4 ? "******" + number.substring(number.length() - 4) : "****";
      log.error("MSG91 rejected OTP for {}: {}", masked, res);
      throw new IllegalStateException("MSG91 rejected the OTP request: " + (res == null ? "empty response" : res.get("message")));
    }
  }
}
