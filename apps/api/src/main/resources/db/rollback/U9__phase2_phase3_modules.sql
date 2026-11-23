DROP TABLE IF EXISTS labour_teams, business_members, businesses, project_milestones, rental_bookings, rental_categories,
  equipment_bookings, equipment_availability, equipment, equipment_categories, emergency_matches, file_assets;
ALTER TABLE emergency_requests DROP FOREIGN KEY fk_er_type;
ALTER TABLE emergency_requests DROP COLUMN public_code, DROP COLUMN emergency_type_id, DROP COLUMN latitude, DROP COLUMN longitude,
  DROP COLUMN city_id, DROP COLUMN matched_at, DROP COLUMN version;
DROP TABLE IF EXISTS emergency_types;
