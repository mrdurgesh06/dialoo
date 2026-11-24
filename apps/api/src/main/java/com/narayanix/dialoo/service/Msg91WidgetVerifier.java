package com.narayanix.dialoo.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * MSG91 OTP Widget support. The browser sends/verifies the OTP through the MSG91 widget and receives a JWT
 * access token. This service re-verifies that token server-side with the secret Authkey and returns the
 * mobile number MSG91 itself verified - the mobile number sent by the browser is never trusted.
 * Enabled automatically when MSG91_WIDGET_ID, MSG91_TOKEN_AUTH and MSG91_AUTH_KEY are all set.
 */
@Service
public class Msg91WidgetVerifier {
  private static final Logger log = LoggerFactory.getLogger(Msg91WidgetVerifier.class);
  private static final String VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
  private static final long REPLAY_WINDOW_MS = 15 * 60 * 1000L;

  private final String widgetId, tokenAuth, authKey;
  private final RestClient client = RestClient.builder().build();
  private final Map<String, Long> usedTokens = new ConcurrentHashMap<>();

  public Msg91WidgetVerifier(@Value("${app.otp.msg91.widget-id:}") String widgetId,
      @Value("${app.otp.msg91.token-auth:}") String tokenAuth,
      @Value("${app.otp.msg91.auth-key:}") String authKey) {
    this.widgetId = widgetId.trim(); this.tokenAuth = tokenAuth.trim(); this.authKey = authKey.trim();
  }

  public boolean enabled() { return !widgetId.isBlank() && !tokenAuth.isBlank() && !authKey.isBlank(); }
  /** widgetId and tokenAuth are public by design (MSG91 embeds them in the browser); Authkey never leaves the server. */
  public String widgetId() { return widgetId; }
  public String tokenAuth() { return tokenAuth; }

  /** Returns the verified 10-digit Indian mobile number, or throws IllegalArgumentException. */
  public String verify(String accessToken) {
    if (!enabled()) throw new IllegalStateException("MSG91 OTP widget is not configured on the server");
    if (accessToken == null || accessToken.length() < 20 || accessToken.length() > 4000) throw new IllegalArgumentException("OTP verification failed. Please try again.");
    long now = System.currentTimeMillis();
    usedTokens.values().removeIf(t -> now - t > REPLAY_WINDOW_MS);
    String fingerprint = sha256(accessToken);
    if (usedTokens.putIfAbsent(fingerprint, now) != null) throw new IllegalArgumentException("This OTP was already used. Please request a new OTP.");
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> res = client.post().uri(VERIFY_URL).contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON)
          .body(Map.of("authkey", authKey, "access-token", accessToken)).retrieve().body(Map.class);
      String type = res == null ? "" : String.valueOf(res.get("type"));
      boolean failed = res == null || "error".equalsIgnoreCase(type) || "fail".equalsIgnoreCase(String.valueOf(res.get("status"))) || Boolean.TRUE.equals(res.get("hasError"));
      String digits = res == null || res.get("message") == null ? "" : String.valueOf(res.get("message")).replaceAll("[^0-9]", "");
      if (failed || digits.length() < 10) {
        usedTokens.remove(fingerprint);
        log.warn("MSG91 access-token verification rejected: {}", res);
        throw new IllegalArgumentException("OTP verification failed. Please try again.");
      }
      return OtpService.normalize(digits);
    } catch (RestClientResponseException e) {
      usedTokens.remove(fingerprint);
      log.error("MSG91 verifyAccessToken HTTP {}: {}", e.getStatusCode().value(), e.getResponseBodyAsString());
      if (e.getStatusCode().is4xxClientError()) throw new IllegalStateException("MSG91 refused the verification request. Check MSG91_AUTH_KEY and the Authkey IP whitelist (Render outbound IPs).", e);
      throw new IllegalStateException("MSG91 is temporarily unavailable. Please try again.", e);
    }
  }

  private static String sha256(String s) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }
}
