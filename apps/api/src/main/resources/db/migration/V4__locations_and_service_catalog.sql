-- V4: Location hierarchy (SRS 10.7 / 23.14) + richer service catalog (SRS 10.3 / 23.4) + provider profile depth (SRS 23.3)
-- Additive only. V1-V3 are never edited.

-- ---------- Location hierarchy: State > District > City > Locality ----------
CREATE TABLE states (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(5) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE districts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  state_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_district_state FOREIGN KEY (state_id) REFERENCES states(id),
  UNIQUE KEY uq_district (state_id, name)
);
CREATE TABLE cities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  district_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,  -- city-wise rollout switch (SRS 6 / 78)
  launched_at DATETIME NULL,
  CONSTRAINT fk_city_district FOREIGN KEY (district_id) REFERENCES districts(id),
  UNIQUE KEY uq_city (district_id, name),
  INDEX idx_city_name (name)
);
CREATE TABLE localities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  city_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  pincode CHAR(6) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_locality_city FOREIGN KEY (city_id) REFERENCES cities(id),
  UNIQUE KEY uq_locality (city_id, name),
  INDEX idx_locality_pin (pincode)
);

INSERT INTO states(name,code) VALUES ('Uttar Pradesh','UP'),('Uttarakhand','UK'),('Delhi','DL');
INSERT INTO districts(state_id,name) SELECT id,'Budaun' FROM states WHERE code='UP';
INSERT INTO districts(state_id,name) SELECT id,'Bareilly' FROM states WHERE code='UP';
INSERT INTO districts(state_id,name) SELECT id,'Meerut' FROM states WHERE code='UP';
INSERT INTO districts(state_id,name) SELECT id,'Moradabad' FROM states WHERE code='UP';
INSERT INTO districts(state_id,name) SELECT id,'Lucknow' FROM states WHERE code='UP';
INSERT INTO districts(state_id,name) SELECT id,'Dehradun' FROM states WHERE code='UK';

INSERT INTO cities(district_id,name,latitude,longitude,is_active,launched_at)
SELECT d.id,'Sahaswan',28.073000,78.753000,TRUE,UTC_TIMESTAMP() FROM districts d WHERE d.name='Budaun';
INSERT INTO cities(district_id,name,latitude,longitude,is_active,launched_at)
SELECT d.id,'Budaun',28.036000,79.126000,TRUE,UTC_TIMESTAMP() FROM districts d WHERE d.name='Budaun';
INSERT INTO cities(district_id,name,latitude,longitude,is_active,launched_at)
SELECT d.id,'Bareilly',28.367000,79.430000,TRUE,UTC_TIMESTAMP() FROM districts d WHERE d.name='Bareilly';
INSERT INTO cities(district_id,name,latitude,longitude,is_active,launched_at)
SELECT d.id,'Meerut',28.984000,77.706000,TRUE,UTC_TIMESTAMP() FROM districts d WHERE d.name='Meerut';
INSERT INTO cities(district_id,name,latitude,longitude,is_active) SELECT d.id,'Moradabad',28.839000,78.777000,FALSE FROM districts d WHERE d.name='Moradabad';
INSERT INTO cities(district_id,name,latitude,longitude,is_active) SELECT d.id,'Lucknow',26.847000,80.947000,FALSE FROM districts d WHERE d.name='Lucknow';
INSERT INTO cities(district_id,name,latitude,longitude,is_active) SELECT d.id,'Dehradun',30.316000,78.032000,FALSE FROM districts d WHERE d.name='Dehradun';

INSERT INTO localities(city_id,name,pincode) SELECT id,'Main Market','243638' FROM cities WHERE name='Sahaswan';
INSERT INTO localities(city_id,name,pincode) SELECT id,'Civil Lines','243638' FROM cities WHERE name='Sahaswan';
INSERT INTO localities(city_id,name,pincode) SELECT id,'Station Road','243638' FROM cities WHERE name='Sahaswan';
INSERT INTO localities(city_id,name,pincode) SELECT id,'Civil Lines','243601' FROM cities WHERE name='Budaun';
INSERT INTO localities(city_id,name,pincode) SELECT id,'Civil Lines','243001' FROM cities WHERE name='Bareilly';
INSERT INTO localities(city_id,name,pincode) SELECT id,'Shastri Nagar','250004' FROM cities WHERE name='Meerut';

-- ---------- Categories become a real catalog ----------
ALTER TABLE categories
  ADD COLUMN parent_id BIGINT NULL AFTER id,
  ADD COLUMN description VARCHAR(255) NULL,
  ADD COLUMN display_order INT NOT NULL DEFAULT 100,
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN eta_minutes INT NOT NULL DEFAULT 45,          -- "arrives in ~X min" (quick-commerce style)
  ADD COLUMN base_visit_fee DECIMAL(10,2) NOT NULL DEFAULT 49.00,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ADD CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES categories(id),
  ADD INDEX idx_category_active_order (active, display_order);

UPDATE categories SET display_order=10, is_featured=TRUE, eta_minutes=30, description='Wiring, fans, switches, inverter' WHERE slug='electrician';
UPDATE categories SET display_order=20, is_featured=TRUE, eta_minutes=35, description='Leakage, taps, pipes, bathroom fittings' WHERE slug='plumber';
UPDATE categories SET display_order=30, is_featured=TRUE, eta_minutes=60, description='Furniture repair, doors, custom work' WHERE slug='carpenter';
UPDATE categories SET display_order=40, is_featured=TRUE, eta_minutes=90, description='Deep cleaning for home & kitchen' WHERE slug='house-cleaning';
UPDATE categories SET display_order=50, is_featured=TRUE, eta_minutes=40, description='Servicing, battery, diagnostics' WHERE slug='car-repair';
UPDATE categories SET display_order=60, is_featured=TRUE, eta_minutes=30, description='Bike servicing and quick fixes' WHERE slug='bike-repair';
UPDATE categories SET display_order=70, is_featured=TRUE, eta_minutes=60, description='At-home beauty & grooming' WHERE slug='beauty-parlour';
UPDATE categories SET display_order=80, eta_minutes=120, description='Pickup & delivery laundry' WHERE slug='laundry';
UPDATE categories SET display_order=90, eta_minutes=45, description='Hardware, electrical & paint shops' WHERE slug='local-shops';
UPDATE categories SET display_order=95, eta_minutes=120, description='Tractor, trolley, harvester access' WHERE slug='agri-equipment';
UPDATE categories SET display_order=85, eta_minutes=60, description='AC, appliance & general upkeep' WHERE slug='home-maintenance';

INSERT INTO categories(name,slug,icon,display_order,eta_minutes,description) VALUES
('Tutor','tutor','📚',100,120,'School & competitive exam tutors'),
('AC & Appliance Repair','ac-appliance-repair','❄️',88,60,'AC, fridge, washing machine repair'),
('Painter','painter','🎨',92,180,'Home & office painting'),
('Mason & Labour','mason-labour','🧱',94,180,'Mistri and labour teams');

CREATE TABLE services (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  category_id BIGINT NOT NULL,
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES categories(id),
  UNIQUE KEY uq_service_slug (category_id, slug),
  INDEX idx_service_cat (category_id, is_active)
);

INSERT INTO services(category_id,name,slug,base_price,duration_minutes)
SELECT c.id,s.name,s.slug,s.price,s.mins FROM categories c JOIN (
  SELECT 'electrician' cs,'Fan repair / installation' name,'fan-repair' slug,149 price,45 mins UNION ALL
  SELECT 'electrician','Switchboard & socket repair','switchboard',129,40 UNION ALL
  SELECT 'electrician','House wiring check','wiring-check',299,90 UNION ALL
  SELECT 'electrician','Inverter / battery service','inverter-service',249,60 UNION ALL
  SELECT 'plumber','Tap / pipe leakage repair','leakage-repair',149,45 UNION ALL
  SELECT 'plumber','Bathroom fitting installation','bathroom-fitting',349,120 UNION ALL
  SELECT 'plumber','Water tank cleaning','tank-cleaning',499,120 UNION ALL
  SELECT 'carpenter','Door / window repair','door-repair',199,60 UNION ALL
  SELECT 'carpenter','Furniture assembly','furniture-assembly',299,90 UNION ALL
  SELECT 'house-cleaning','Full home deep cleaning','deep-cleaning',999,240 UNION ALL
  SELECT 'house-cleaning','Kitchen deep cleaning','kitchen-cleaning',499,120 UNION ALL
  SELECT 'car-repair','Car general service','car-service',799,180 UNION ALL
  SELECT 'car-repair','Battery jump-start / replacement','car-battery',299,45 UNION ALL
  SELECT 'bike-repair','Bike general service','bike-service',399,90 UNION ALL
  SELECT 'bike-repair','Puncture repair','bike-puncture',79,20 UNION ALL
  SELECT 'beauty-parlour','Haircut & styling at home','haircut-home',299,60 UNION ALL
  SELECT 'beauty-parlour','Facial & cleanup','facial',499,75 UNION ALL
  SELECT 'ac-appliance-repair','AC service (split)','ac-service',499,60 UNION ALL
  SELECT 'ac-appliance-repair','Washing machine repair','washing-machine',299,60 UNION ALL
  SELECT 'tutor','Home tuition (per month)','home-tuition',1500,60 UNION ALL
  SELECT 'painter','Room painting (per room)','room-painting',2499,480
) s ON s.cs=c.slug;

-- ---------- Provider profile depth (SRS 23.3) ----------
ALTER TABLE providers
  ADD COLUMN public_id VARCHAR(30) NULL,
  ADD COLUMN city_id BIGINT NULL,
  ADD COLUMN locality_id BIGINT NULL,
  ADD COLUMN latitude DECIMAL(9,6) NULL,
  ADD COLUMN longitude DECIMAL(9,6) NULL,
  ADD COLUMN service_radius_km DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN verification_level VARCHAR(30) NOT NULL DEFAULT 'NONE',
  ADD COLUMN pricing_model VARCHAR(20) NOT NULL DEFAULT 'FIXED',
  ADD COLUMN emergency_available BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN home_visit_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN completed_jobs_count INT NOT NULL DEFAULT 0,
  ADD COLUMN avg_response_minutes INT NOT NULL DEFAULT 15,
  ADD COLUMN languages VARCHAR(80) NOT NULL DEFAULT 'Hindi,English',
  ADD COLUMN avatar_emoji VARCHAR(16) NULL,
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ADD COLUMN deleted_at DATETIME NULL;

UPDATE providers SET public_id = CONCAT('DL-', UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,8))) WHERE public_id IS NULL;
UPDATE providers p JOIN cities c ON LOWER(c.name)=LOWER(p.city) SET p.city_id=c.id WHERE p.city_id IS NULL;
UPDATE providers SET verification_level='DIALOO_VERIFIED' WHERE verified=TRUE;
ALTER TABLE providers
  MODIFY public_id VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uq_provider_public (public_id),
  ADD CONSTRAINT fk_provider_city FOREIGN KEY (city_id) REFERENCES cities(id),
  ADD CONSTRAINT fk_provider_locality FOREIGN KEY (locality_id) REFERENCES localities(id),
  ADD INDEX idx_provider_search (city_id, status, available_now),
  ADD INDEX idx_provider_cat_status (category_id, status),
  ADD INDEX idx_provider_geo (latitude, longitude),
  ADD INDEX idx_provider_verif (verification_level, status);

CREATE TABLE provider_services (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_id BIGINT NOT NULL,
  service_id BIGINT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_ps_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  CONSTRAINT fk_ps_service FOREIGN KEY (service_id) REFERENCES services(id),
  UNIQUE KEY uq_provider_service (provider_id, service_id),
  INDEX idx_ps_service (service_id, provider_id)
);

CREATE TABLE provider_working_hours (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_id BIGINT NOT NULL,
  day_of_week TINYINT NOT NULL,           -- 1=Mon ... 7=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_pwh_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  CONSTRAINT chk_pwh_day CHECK (day_of_week BETWEEN 1 AND 7),
  UNIQUE KEY uq_pwh (provider_id, day_of_week)
);

CREATE TABLE provider_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_id BIGINT NOT NULL,
  document_type VARCHAR(40) NOT NULL,      -- AADHAAR / PAN / SKILL_CERT / SHOP_LICENSE
  document_ref VARCHAR(255) NOT NULL,      -- storage key, never a public URL
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_pd_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  INDEX idx_pd_provider (provider_id, document_type)
);

CREATE TABLE provider_verifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_id BIGINT NOT NULL,
  verification_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_pv_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  CONSTRAINT fk_pv_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pv_provider (provider_id, verification_type)
);

-- Existing "Local Shops"/"Agri" listings already exist as categories; flags below gate the rest.
INSERT INTO feature_flags(flag_key,is_enabled,description) VALUES
('QUICK_BOOK_ENABLED',TRUE,'Quick book: nearest available provider (Blinkit-style ETA)'),
('COUPONS_ENABLED',TRUE,'Coupons and offers at checkout'),
('ADMIN_2FA_REQUIRED',TRUE,'Admin sign-in needs password + OTP (second factor)')
ON DUPLICATE KEY UPDATE description=VALUES(description);
