-- Repeatable migration (SRS 26): re-applied automatically whenever this file's checksum changes.

CREATE OR REPLACE VIEW v_provider_search AS
SELECT p.id, p.public_id, p.business_name, p.description, p.address, p.city, p.city_id, p.category_id,
       c.name AS category, c.slug AS category_slug, c.eta_minutes, p.price_from, p.years_experience,
       p.verified, p.verification_level, p.available_now, p.average_rating, p.review_count,
       p.completed_jobs_count, p.avg_response_minutes, p.latitude, p.longitude, p.service_radius_km,
       p.emergency_available, p.avatar_emoji, p.languages, u.full_name AS provider_name, p.user_id
FROM providers p
JOIN categories c ON c.id = p.category_id
JOIN users u ON u.id = p.user_id
WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL AND u.enabled = TRUE;

CREATE OR REPLACE VIEW v_admin_bookings AS
SELECT b.id, b.booking_code, b.status, b.created_at, b.updated_at, b.scheduled_at, b.service_address,
       b.description, b.total_amount, b.discount_amount, b.coupon_code, b.payment_status, b.urgency,
       b.cancel_reason, b.customer_id, cu.full_name AS customer_name, cu.phone AS customer_phone,
       b.provider_id, p.business_name, pu.phone AS provider_phone, c.name AS category, b.city_id
FROM bookings b
JOIN users cu ON cu.id = b.customer_id
JOIN providers p ON p.id = b.provider_id
JOIN users pu ON pu.id = p.user_id
JOIN categories c ON c.id = b.category_id;

CREATE OR REPLACE VIEW v_daily_booking_stats AS
SELECT DATE(created_at) AS day,
       COUNT(*) AS bookings,
       SUM(status = 'COMPLETED') AS completed,
       SUM(status IN ('CANCELLED','REJECTED','EXPIRED')) AS lost,
       COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount END), 0) AS gmv
FROM bookings
GROUP BY DATE(created_at);
