-- V9: Schema for Emergency, Agri, Rentals, Projects, Business/Labour teams, files (SRS 23.9 - 23.13, 32 - 35).
-- Tables are created now (feature-flagged in the app) so later phases need no destructive change.

CREATE TABLE file_assets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL UNIQUE,
  owner_type VARCHAR(30) NOT NULL,
  owner_id BIGINT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  INDEX idx_fa_owner (owner_type, owner_id)
);

-- Emergency (Phase 2)
CREATE TABLE emergency_types (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  group_name VARCHAR(20) NOT NULL,          -- VEHICLE / HOME / OTHER
  requires_authorized_provider BOOLEAN NOT NULL DEFAULT FALSE,   -- fuel assistance guard (SRS 11.1)
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO emergency_types(code,label,group_name,requires_authorized_provider) VALUES
('VEHICLE_BATTERY','Battery / jump-start','VEHICLE',FALSE),('VEHICLE_PUNCTURE','Puncture','VEHICLE',FALSE),
('VEHICLE_BREAKDOWN','Breakdown','VEHICLE',FALSE),('VEHICLE_TOWING','Towing','VEHICLE',FALSE),
('VEHICLE_LOCK','Key / lock help','VEHICLE',FALSE),('VEHICLE_FUEL','Fuel assistance (authorized only)','VEHICLE',TRUE),
('HOME_ELECTRICAL','Electrical failure / short circuit','HOME',FALSE),('HOME_WATER','Water leakage / pipe burst','HOME',FALSE),
('HOME_LOCK','Lock / door emergency','HOME',FALSE),('HOME_APPLIANCE','AC / fridge breakdown','HOME',FALSE);

ALTER TABLE emergency_requests
  ADD COLUMN public_code VARCHAR(20) NULL,
  ADD COLUMN emergency_type_id BIGINT NULL,
  ADD COLUMN latitude DECIMAL(9,6) NULL,
  ADD COLUMN longitude DECIMAL(9,6) NULL,
  ADD COLUMN city_id BIGINT NULL,
  ADD COLUMN matched_at DATETIME NULL,
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT fk_er_type FOREIGN KEY (emergency_type_id) REFERENCES emergency_types(id),
  ADD INDEX idx_er_status (status, created_at),
  ADD INDEX idx_er_geo (latitude, longitude),
  ADD INDEX idx_er_customer (customer_id, created_at);
UPDATE emergency_requests SET public_code=CONCAT('DLE',LPAD(id,7,'0')) WHERE public_code IS NULL;

CREATE TABLE emergency_matches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  emergency_request_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  distance_km DECIMAL(6,2) NULL,
  response VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  notified_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  responded_at DATETIME NULL,
  CONSTRAINT fk_em_req FOREIGN KEY (emergency_request_id) REFERENCES emergency_requests(id),
  CONSTRAINT fk_em_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE KEY uq_em (emergency_request_id, provider_id),
  INDEX idx_em_provider (provider_id, response)
);

-- Agriculture equipment (Phase 2)
CREATE TABLE equipment_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  icon VARCHAR(16) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO equipment_categories(name,icon) VALUES
('Tractor','🚜'),('Trolley','🛻'),('Harvester','🌾'),('Thresher','🌽'),('Rotavator','⚙️'),('Sprayer','💧'),
('Water Pump','🚰'),('Water Tanker','🚚'),('JCB / Loader','🏗️'),('Generator','🔌');
CREATE TABLE equipment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_provider_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  brand VARCHAR(60) NULL,
  model VARCHAR(60) NULL,
  manufacture_year SMALLINT NULL,
  hourly_price DECIMAL(10,2) NULL,
  daily_price DECIMAL(10,2) NULL,
  seasonal_price DECIMAL(10,2) NULL,
  with_driver BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  service_area_km DECIMAL(6,2) NOT NULL DEFAULT 20,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_eq_owner FOREIGN KEY (owner_provider_id) REFERENCES providers(id),
  CONSTRAINT fk_eq_cat FOREIGN KEY (category_id) REFERENCES equipment_categories(id),
  INDEX idx_eq_cat (category_id, status)
);
CREATE TABLE equipment_availability (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  equipment_id BIGINT NOT NULL,
  available_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  booking_id BIGINT NULL,
  CONSTRAINT fk_ea_eq FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  UNIQUE KEY uq_ea (equipment_id, available_date)         -- double-booking guard at constraint level
);
CREATE TABLE equipment_bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  equipment_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_eb_eq FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  CONSTRAINT fk_eb_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT chk_eb_dates CHECK (end_date >= start_date),
  INDEX idx_eb_customer (customer_id, created_at)
);

-- Rentals (Phase 3): categories are data, not code
CREATE TABLE rental_categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  icon VARCHAR(16) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO rental_categories(name,icon) VALUES
('Generator','🔌'),('Construction Equipment','🏗️'),('Scaffolding','🪜'),('Event Equipment','🎪'),('Power Tools','🔧'),('Water Tanker','🚚');
CREATE TABLE rental_bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  listing_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_rb_listing FOREIGN KEY (listing_id) REFERENCES rental_listings(id),
  CONSTRAINT fk_rb_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT chk_rb_dates CHECK (end_date >= start_date),
  INDEX idx_rb_listing (listing_id, start_date)
);

-- Projects (Phase 3): milestones
ALTER TABLE projects ADD COLUMN accepted_quote_id BIGINT NULL, ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ADD INDEX idx_project_status (status, created_at);
CREATE TABLE project_milestones (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  title VARCHAR(160) NOT NULL,
  due_date DATE NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_pm_project (project_id, status)
);

-- Business accounts & labour teams (Phase 3)
CREATE TABLE businesses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(30) NOT NULL UNIQUE,
  owner_user_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  city_id BIGINT NULL,
  address VARCHAR(255) NULL,
  working_hours JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_biz_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT fk_biz_city FOREIGN KEY (city_id) REFERENCES cities(id)
);
CREATE TABLE business_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  business_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  role_in_business VARCHAR(40) NOT NULL DEFAULT 'TECHNICIAN',
  joined_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_bmem_biz FOREIGN KEY (business_id) REFERENCES businesses(id),
  CONSTRAINT fk_bmem_prov FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE KEY uq_bmem (business_id, provider_id)
);
CREATE TABLE labour_teams (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  lead_provider_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  mistri_count INT NOT NULL DEFAULT 1,
  labour_count INT NOT NULL DEFAULT 0,
  day_rate DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_lt_lead FOREIGN KEY (lead_provider_id) REFERENCES providers(id)
);
