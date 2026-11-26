-- V7: Marketplace growth layer: banners, coupons, saved addresses, favourites, payments, invoices (SRS 10.2, 12.6, 23.8).

CREATE TABLE banners (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  subtitle VARCHAR(200) NULL,
  emoji VARCHAR(16) NULL,
  gradient VARCHAR(80) NOT NULL DEFAULT '#164ecb,#1f68ed',
  cta_label VARCHAR(40) NULL,
  target_category_slug VARCHAR(120) NULL,
  coupon_code VARCHAR(30) NULL,
  display_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  INDEX idx_banner_active (is_active, display_order)
);

CREATE TABLE coupons (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(200) NULL,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'FLAT',     -- FLAT / PERCENT
  discount_value DECIMAL(10,2) NOT NULL,
  max_discount DECIMAL(10,2) NULL,
  min_order DECIMAL(10,2) NOT NULL DEFAULT 0,
  first_booking_only BOOLEAN NOT NULL DEFAULT FALSE,
  usage_limit INT NULL,
  per_user_limit INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  valid_from DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  valid_until DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT chk_coupon_type CHECK (discount_type IN ('FLAT','PERCENT')),
  INDEX idx_coupon_active (is_active, valid_until)
);
CREATE TABLE coupon_redemptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  coupon_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  booking_id BIGINT NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_cr_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  CONSTRAINT fk_cr_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_cr_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  UNIQUE KEY uq_cr_booking (booking_id),
  INDEX idx_cr_user (coupon_id, user_id)
);

CREATE TABLE customer_addresses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  label VARCHAR(10) NOT NULL DEFAULT 'HOME',     -- HOME / OFFICE / FARM / SHOP / OTHER
  address_line VARCHAR(255) NOT NULL,
  city_id BIGINT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  deleted_at DATETIME NULL,
  CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ca_city FOREIGN KEY (city_id) REFERENCES cities(id),
  INDEX idx_ca_user (user_id, deleted_at)
);

CREATE TABLE favourite_providers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_fp_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_fp_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE KEY uq_fav (user_id, provider_id)
);

CREATE TABLE search_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  term VARCHAR(120) NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  INDEX idx_search_term (term, created_at)
);

-- Payments: only a verified server-side callback may mark PAID (SRS 30).
CREATE TABLE payment_orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_reference VARCHAR(40) NOT NULL UNIQUE,
  payer_id BIGINT NOT NULL,
  context_type VARCHAR(30) NOT NULL,         -- BOOKING / SUBSCRIPTION
  context_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(12) NOT NULL DEFAULT 'CREATED',
  gateway VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_po_user FOREIGN KEY (payer_id) REFERENCES users(id),
  INDEX idx_po_context (context_type, context_id)
);
CREATE TABLE payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  payment_order_id BIGINT NOT NULL,
  gateway_payment_id VARCHAR(80) NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(12) NOT NULL,
  method VARCHAR(20) NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_pay_order FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id)
);
CREATE TABLE invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL UNIQUE,
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  labour_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  material_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  travel_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(12) NOT NULL DEFAULT 'UNPAID',
  issued_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_inv_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE TABLE subscription_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_subscription_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_id BIGINT NULL,
  type VARCHAR(12) NOT NULL DEFAULT 'CHARGE',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_st_sub FOREIGN KEY (provider_subscription_id) REFERENCES provider_subscriptions(id),
  CONSTRAINT fk_st_pay FOREIGN KEY (payment_id) REFERENCES payments(id)
);

ALTER TABLE provider_subscriptions
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP());

INSERT INTO banners(title,subtitle,emoji,gradient,cta_label,target_category_slug,coupon_code,display_order) VALUES
('Flat ₹50 OFF on your first booking','Use code WELCOME50 at checkout','🎉','#164ecb,#1f68ed','Book now',NULL,'WELCOME50',10),
('Electrician in 30 minutes','Verified electricians near you','⚡','#7c3aed,#a855f7','Book electrician','electrician',NULL,20),
('Plumber at your door, fast','Leakage fixed today','🚰','#0891b2,#06b6d4','Book plumber','plumber',NULL,30),
('Join Dialoo as a Provider','Get more customers, build your digital dukaan','🛠️','#ea580c,#f59e0b','Join now',NULL,NULL,40);

INSERT INTO coupons(code,description,discount_type,discount_value,max_discount,min_order,first_booking_only,per_user_limit,valid_until) VALUES
('WELCOME50','Flat ₹50 off on your first booking','FLAT',50,NULL,99,TRUE,1,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)),
('DIALOO10','10% off up to ₹100','PERCENT',10,100,199,FALSE,5,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)),
('FREEVISIT','Visit fee waived','FLAT',49,NULL,149,FALSE,3,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 180 DAY));
