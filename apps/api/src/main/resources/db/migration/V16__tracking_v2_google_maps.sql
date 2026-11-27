-- V16: Live tracking v2 (Google Maps Platform + WebSocket/STOMP). Purely additive - nothing existing is dropped or rewritten.
-- Extends V14 (booking_tracking = latest position of the active journey) and V7 (customer_addresses).

-- 1) Journey lifecycle. At most ONE ACTIVE session per booking (enforced by the generated unique key below).
--    status: ACTIVE -> ARRIVED | ENDED.   Booking status itself is unchanged (ON_THE_WAY ... IN_PROGRESS ...).
CREATE TABLE tracking_sessions (
  id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  started_at DATETIME NOT NULL,
  arrived_at DATETIME NULL,
  ended_at DATETIME NULL,
  last_location_at DATETIME NULL,
  last_seq BIGINT NOT NULL DEFAULT 0,
  approach_notified BOOLEAN NOT NULL DEFAULT FALSE,
  end_reason VARCHAR(24) NULL,
  active_booking_id BIGINT GENERATED ALWAYS AS (IF(status = 'ACTIVE', booking_id, NULL)) STORED,
  UNIQUE KEY uq_session_one_active (active_booking_id),
  INDEX idx_session_booking (booking_id, status),
  INDEX idx_session_status (status, last_location_at),
  CONSTRAINT fk_session_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- 2) booking_tracking keeps only the LATEST position (restart recovery). Add the session link and the last accepted sequence number.
ALTER TABLE booking_tracking
  ADD COLUMN session_id BIGINT NULL,
  ADD COLUMN seq BIGINT NOT NULL DEFAULT 0,
  ADD INDEX idx_tracking_session (session_id);

-- 3) Sampled history of a journey (one row per persist interval, not per GPS fix). Deleted by the retention job.
CREATE TABLE booking_location_history (
  id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  accuracy_m DECIMAL(8,1) NULL,
  speed_mps DECIMAL(6,2) NULL,
  heading_deg DECIMAL(5,1) NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_blh_session (session_id, recorded_at),
  INDEX idx_blh_recorded (recorded_at),
  CONSTRAINT fk_blh_session FOREIGN KEY (session_id) REFERENCES tracking_sessions(id) ON DELETE CASCADE
);

-- 4) Latest location of an ONLINE partner without an active journey (used only for nearby discovery; exact coordinates are never sent to customers).
CREATE TABLE provider_live_location (
  provider_id BIGINT NOT NULL PRIMARY KEY,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  accuracy_m DECIMAL(8,1) NULL,
  location_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_pll_geo (latitude, longitude),
  INDEX idx_pll_updated (updated_at),
  CONSTRAINT fk_pll_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- 5) Google Maps Platform request counters (one row per UTC day and API) for the admin usage panel and billing sanity checks.
CREATE TABLE maps_api_usage (
  usage_day DATE NOT NULL,
  api VARCHAR(40) NOT NULL,
  calls INT UNSIGNED NOT NULL DEFAULT 0,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_day, api)
);

-- 6) Saved addresses: structured fields + Google place id. address_line stays the display string, so existing code keeps working.
--    Google ToS: place_id may be stored indefinitely; latitude/longitude of the customer's own chosen address is user data.
ALTER TABLE customer_addresses
  ADD COLUMN place_id VARCHAR(255) NULL,
  ADD COLUMN house_no VARCHAR(60) NULL,
  ADD COLUMN building VARCHAR(160) NULL,
  ADD COLUMN landmark VARCHAR(120) NULL,
  ADD COLUMN locality VARCHAR(120) NULL,
  ADD COLUMN district VARCHAR(80) NULL,
  ADD COLUMN state VARCHAR(80) NULL,
  ADD COLUMN pincode VARCHAR(10) NULL,
  ADD COLUMN country VARCHAR(60) NULL,
  ADD COLUMN updated_at DATETIME NULL;
