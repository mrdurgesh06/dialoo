-- V5: Booking engine upgrade (SRS 10.8 - 10.12, 23.4, 23.5): tracking, pricing breakdown, quotations, chat, reviews.

ALTER TABLE bookings
  ADD COLUMN booking_code VARCHAR(20) NULL,
  ADD COLUMN service_id BIGINT NULL,
  ADD COLUMN city_id BIGINT NULL,
  ADD COLUMN urgency VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN latitude DECIMAL(9,6) NULL,
  ADD COLUMN longitude DECIMAL(9,6) NULL,
  ADD COLUMN contact_name VARCHAR(120) NULL,
  ADD COLUMN contact_phone VARCHAR(20) NULL,
  ADD COLUMN start_code CHAR(4) NULL,              -- job-start PIN shown to customer (delivery-OTP style trust check)
  ADD COLUMN eta_minutes INT NULL,
  ADD COLUMN visit_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN service_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN coupon_code VARCHAR(30) NULL,
  ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'PAY_AFTER_SERVICE',
  ADD COLUMN accepted_at DATETIME NULL,
  ADD COLUMN started_at DATETIME NULL,
  ADD COLUMN completed_at DATETIME NULL,
  ADD COLUMN cancelled_at DATETIME NULL,
  ADD COLUMN cancelled_by BIGINT NULL,
  ADD COLUMN cancel_reason VARCHAR(255) NULL,
  ADD COLUMN expires_at DATETIME NULL,
  ADD COLUMN version INT NOT NULL DEFAULT 0;

UPDATE bookings SET booking_code = CONCAT('DLB', LPAD(id, 7, '0')) WHERE booking_code IS NULL;
UPDATE bookings SET total_amount = COALESCE(final_amount, quoted_amount, 0) WHERE total_amount = 0;

ALTER TABLE bookings
  MODIFY booking_code VARCHAR(20) NOT NULL,
  ADD UNIQUE KEY uq_booking_code (booking_code),
  ADD CONSTRAINT fk_booking_service FOREIGN KEY (service_id) REFERENCES services(id),
  ADD CONSTRAINT fk_booking_city FOREIGN KEY (city_id) REFERENCES cities(id),
  ADD CONSTRAINT fk_booking_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_booking_customer (customer_id, created_at),
  ADD INDEX idx_booking_provider (provider_id, status),
  ADD INDEX idx_booking_status (status, created_at),
  ADD INDEX idx_booking_city (city_id, category_id, status),
  ADD INDEX idx_booking_expiry (status, expires_at);

ALTER TABLE booking_status_history
  ADD COLUMN reason VARCHAR(255) NULL,
  ADD COLUMN actor_role VARCHAR(24) NULL;

-- Quotations (SRS 10.11)
CREATE TABLE quotations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  labour_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  material_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  travel_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  valid_until DATETIME NULL,
  notes VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_quote_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_quotation_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  INDEX idx_quotation_booking (booking_id, status)
);
CREATE TABLE quotation_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quotation_id BIGINT NOT NULL,
  description VARCHAR(200) NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_qi_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

-- In-app chat per booking (SRS 10.13 / 23.6)
CREATE TABLE booking_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_bm_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_bm_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_bm_thread (booking_id, created_at)
);

-- Reviews: provider reply + moderation (SRS 10.12 / 23.5)
ALTER TABLE reviews
  ADD COLUMN provider_response VARCHAR(1000) NULL,
  ADD COLUMN responded_at DATETIME NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  ADD INDEX idx_review_provider (provider_id, status, created_at);
CREATE TABLE review_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  review_id BIGINT NOT NULL,
  reported_by BIGINT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_rr_review FOREIGN KEY (review_id) REFERENCES reviews(id),
  CONSTRAINT fk_rr_user FOREIGN KEY (reported_by) REFERENCES users(id)
);
