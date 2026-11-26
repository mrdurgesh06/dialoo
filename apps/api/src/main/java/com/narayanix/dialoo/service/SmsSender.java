package com.narayanix.dialoo.service;

/** Abstraction for SMS delivery (log / twilio / msg91 - selected with app.sms.provider). */
public interface SmsSender {
  void send(String mobile, String message);

  /**
   * Delivers a one-time code. Providers with registered OTP templates (MSG91/DLT) override this and
   * use only the code; the default simply sends the free-text message.
   */
  default void sendOtp(String mobile, String otp, int ttlMinutes, String message) { send(mobile, message); }
}
