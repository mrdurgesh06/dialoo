CREATE TABLE users (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, full_name VARCHAR(120) NOT NULL, phone VARCHAR(20) NOT NULL UNIQUE,
 email VARCHAR(190) UNIQUE, password_hash VARCHAR(100) NOT NULL, role VARCHAR(24) NOT NULL DEFAULT 'CUSTOMER',
 enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE categories (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL UNIQUE, slug VARCHAR(120) NOT NULL UNIQUE,
 icon VARCHAR(20), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE providers (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL UNIQUE, business_name VARCHAR(160) NOT NULL,
 category_id BIGINT NOT NULL, description VARCHAR(1000), address VARCHAR(500) NOT NULL, city VARCHAR(100) NOT NULL,
 price_from DECIMAL(10,2) NOT NULL DEFAULT 0, years_experience INT NOT NULL DEFAULT 0, verified BOOLEAN NOT NULL DEFAULT FALSE,
 available_now BOOLEAN NOT NULL DEFAULT FALSE, status VARCHAR(24) NOT NULL DEFAULT 'PENDING', average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
 review_count INT NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_provider_user FOREIGN KEY(user_id) REFERENCES users(id), CONSTRAINT fk_provider_category FOREIGN KEY(category_id) REFERENCES categories(id)
);
CREATE TABLE bookings (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, customer_id BIGINT NOT NULL, provider_id BIGINT NOT NULL, category_id BIGINT NOT NULL,
 service_address VARCHAR(500) NOT NULL, description VARCHAR(1000), scheduled_at DATETIME NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED', quoted_amount DECIMAL(10,2), final_amount DECIMAL(10,2),
 payment_status VARCHAR(24) NOT NULL DEFAULT 'UNPAID', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_booking_customer FOREIGN KEY(customer_id) REFERENCES users(id), CONSTRAINT fk_booking_provider FOREIGN KEY(provider_id) REFERENCES providers(id), CONSTRAINT fk_booking_category FOREIGN KEY(category_id) REFERENCES categories(id)
);
CREATE TABLE reviews (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, booking_id BIGINT NOT NULL UNIQUE, customer_id BIGINT NOT NULL, provider_id BIGINT NOT NULL,
 rating INT NOT NULL, comment VARCHAR(1000), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5), CONSTRAINT fk_review_booking FOREIGN KEY(booking_id) REFERENCES bookings(id),
 CONSTRAINT fk_review_customer FOREIGN KEY(customer_id) REFERENCES users(id), CONSTRAINT fk_review_provider FOREIGN KEY(provider_id) REFERENCES providers(id)
);
CREATE TABLE emergency_requests (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, customer_id BIGINT NOT NULL, emergency_type VARCHAR(40) NOT NULL,
 description VARCHAR(1000), address VARCHAR(500) NOT NULL, contact_phone VARCHAR(20) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED', assigned_provider_id BIGINT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_emergency_customer FOREIGN KEY(customer_id) REFERENCES users(id), CONSTRAINT fk_emergency_provider FOREIGN KEY(assigned_provider_id) REFERENCES providers(id)
);
CREATE TABLE rental_listings (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, owner_id BIGINT NOT NULL, title VARCHAR(180) NOT NULL, category VARCHAR(100) NOT NULL,
 description VARCHAR(1000), city VARCHAR(100) NOT NULL, price_per_day DECIMAL(10,2) NOT NULL,
 availability_status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE', active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_rental_owner FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE TABLE projects (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, customer_id BIGINT NOT NULL, title VARCHAR(180) NOT NULL, category VARCHAR(100) NOT NULL,
 scope_description VARCHAR(2000) NOT NULL, city VARCHAR(100) NOT NULL, budget_min DECIMAL(12,2), budget_max DECIMAL(12,2),
 timeline VARCHAR(120), status VARCHAR(24) NOT NULL DEFAULT 'OPEN', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_project_customer FOREIGN KEY(customer_id) REFERENCES users(id)
);
CREATE TABLE project_quotes (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, project_id BIGINT NOT NULL, provider_id BIGINT NOT NULL, amount DECIMAL(12,2) NOT NULL,
 details VARCHAR(1500), estimated_days INT, status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_quote_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_quote_provider FOREIGN KEY(provider_id) REFERENCES providers(id)
);
INSERT INTO categories(name,slug,icon) VALUES
('Electrician','electrician','⚡'),('Plumber','plumber','🚰'),('Carpenter','carpenter','🪚'),('House Cleaning','house-cleaning','🧹'),('Car Repair','car-repair','🚗'),('Bike Repair','bike-repair','🏍️'),('Beauty Parlour','beauty-parlour','💄'),('Laundry','laundry','🧺'),('Local Shops','local-shops','🏪'),('Agricultural Equipment','agri-equipment','🚜'),('Home Maintenance','home-maintenance','🏠');
