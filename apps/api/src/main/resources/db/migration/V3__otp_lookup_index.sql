-- Improves purpose-scoped OTP lookup and resend handling for login and password reset.
CREATE INDEX idx_otp_purpose_mobile_created
  ON otp_verifications (purpose, mobile_number, created_at);
