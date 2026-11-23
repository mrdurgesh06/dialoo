DROP TABLE IF EXISTS streets;
-- Cities/districts added by V11 may already be referenced by providers or bookings; switch them off instead of deleting:
-- UPDATE cities c JOIN districts d ON d.id=c.district_id SET c.is_active=FALSE WHERE d.name NOT IN ('Budaun','Bareilly','Meerut');
