package com.narayanix.dialoo.service;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/** Real SMS delivery through the Twilio Messages REST API. Credentials are environment-only. */
@Component
@ConditionalOnProperty(name="app.sms.provider", havingValue="twilio")
public class TwilioSmsSender implements SmsSender {
  private final String accountSid, authToken, from;
  private final RestClient client = RestClient.builder().build();
  public TwilioSmsSender(@Value("${app.sms.twilio.account-sid:}") String accountSid,
      @Value("${app.sms.twilio.auth-token:}") String authToken,
      @Value("${app.sms.twilio.from-number:}") String from) {
    this.accountSid=accountSid; this.authToken=authToken; this.from=from;
    if(accountSid.isBlank()||authToken.isBlank()||from.isBlank()) throw new IllegalStateException("Twilio selected but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are required");
  }
  @Override public void send(String mobile, String message) {
    MultiValueMap<String,String> form=new LinkedMultiValueMap<>();
    form.add("To", mobile.startsWith("+")?mobile:"+91"+mobile); form.add("From",from); form.add("Body",message);
    client.post().uri("https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",accountSid)
      .contentType(MediaType.APPLICATION_FORM_URLENCODED).headers(h->h.setBasicAuth(accountSid,authToken))
      .body(form).retrieve().toBodilessEntity();
  }
}
