-- Live provider tracking (Leaflet + OpenStreetMap + OpenRouteService).
-- Only the LATEST position of a provider is kept, and only while the booking is ON_THE_WAY
-- (the row is deleted as soon as the booking leaves that status).
CREATE TABLE booking_tracking (
  booking_id BIGINT NOT NULL PRIMARY KEY,
  provider_id BIGINT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  accuracy_m DECIMAL(8,1) NULL,
  speed_mps DECIMAL(6,2) NULL,
  heading_deg DECIMAL(5,1) NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_tracking_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_tracking_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  INDEX idx_tracking_updated (updated_at)
);
