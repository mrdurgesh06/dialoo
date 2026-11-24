package com.narayanix.dialoo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Local-only sender. It deliberately does not claim that an SMS was delivered. */
@Component
@ConditionalOnProperty(name="app.sms.provider", havingValue="log", matchIfMissing=true)
public class LoggingSmsSender implements SmsSender {
  private static final Logger log = LoggerFactory.getLogger(LoggingSmsSender.class);
  @Override public void send(String mobile, String message) {
    String masked = mobile.length() > 4 ? "******" + mobile.substring(mobile.length() - 4) : "****";
    log.warn("[DEV SMS ONLY] No real SMS sent to {}. Configure app.sms.provider=twilio for delivery.", masked);
  }
}
