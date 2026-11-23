package com.narayanix.dialoo.service;

/** Abstraction for SMS delivery. Replace LoggingSmsSender with a real provider (MSG91, Twilio, etc.) in production. */
public interface SmsSender {
  void send(String mobile, String message);
}
