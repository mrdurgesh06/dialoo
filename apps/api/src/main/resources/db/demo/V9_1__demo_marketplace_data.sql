-- DEMO DATA (local only). Loaded from classpath:db/demo when DEMO_DATA=true. Never enable in production.
-- Demo provider users have NO password: sign in with OTP (dev OTP is shown on screen) using 9000000001 ... 9000000008.

INSERT INTO users(full_name,phone,email,password_hash,role,enabled,public_id) VALUES
('Ramesh Kumar','9000000001',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Sharma Ji','9000000002',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Aman Verma','9000000003',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Sahil Khan','9000000004',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Neha Singh','9000000005',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Iqbal Ahmed','9000000006',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Vikas Yadav','9000000007',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Pooja Sharma','9000000008',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)));

INSERT INTO providers(user_id,business_name,category_id,description,address,city,price_from,years_experience,verified,available_now,status,
  average_rating,review_count,public_id,city_id,verification_level,completed_jobs_count,avg_response_minutes,avatar_emoji,emergency_available,latitude,longitude)
SELECT u.id,x.bn,c.id,x.d,x.addr,'Sahaswan',x.price,x.yrs,x.ver,x.av,'APPROVED',x.rt,x.rc,CONCAT('DL-',x.pid),ci.id,
  IF(x.ver,'DIALOO_VERIFIED','MOBILE_VERIFIED'),x.jobs,x.resp,x.em,x.emerg,28.0730+x.dl,78.7530+x.dl
FROM (
 SELECT '9000000001' ph,'Ramesh Electrical Works' bn,'electrician' cs,'Home wiring, fan, inverter and electrical repair.' d,'Main Market, Sahaswan' addr,199 price,8 yrs,TRUE ver,TRUE av,4.8 rt,128 rc,'ELC102938' pid,214 jobs,8 resp,'⚡' em,TRUE emerg,0.004 dl UNION ALL
 SELECT '9000000002','Sharma Plumbing Services','plumber','Leakage, tap fitting, bathroom and pipe repair.','Civil Lines, Sahaswan',149,6,TRUE,TRUE,4.7,96,'PLB204811',160,10,'🚰',TRUE,0.008 UNION ALL
 SELECT '9000000003','Aman Home Care','house-cleaning','Deep cleaning for homes, kitchens and bathrooms.','Station Road, Sahaswan',299,5,TRUE,FALSE,4.9,74,'CLN309142',98,20,'🧹',FALSE,0.012 UNION ALL
 SELECT '9000000004','Sahil Auto Garage','car-repair','Car diagnostics, battery, servicing and roadside help.','Main Market, Sahaswan',249,10,TRUE,TRUE,4.6,215,'CAR410273',402,12,'🚗',TRUE,0.016 UNION ALL
 SELECT '9000000005','Neha Beauty Studio','beauty-parlour','At-home salon and beauty services.','Civil Lines, Sahaswan',399,4,FALSE,TRUE,4.8,62,'BTY512384',77,15,'💄',FALSE,0.02 UNION ALL
 SELECT '9000000006','Iqbal Wood Works','carpenter','Furniture repair, doors, fittings and custom work.','Station Road, Sahaswan',199,12,TRUE,TRUE,4.5,51,'CRP613495',133,18,'🪚',FALSE,0.024 UNION ALL
 SELECT '9000000007','Vikas Bike Care','bike-repair','Bike servicing, puncture and doorstep repair.','Main Market, Sahaswan',99,7,TRUE,TRUE,4.6,88,'BKE714506',260,9,'🏍️',TRUE,0.006 UNION ALL
 SELECT '9000000008','Pooja AC & Appliance','ac-appliance-repair','AC service, fridge and washing machine repair.','Civil Lines, Sahaswan',299,6,TRUE,TRUE,4.7,69,'ACR815617',121,14,'❄️',FALSE,0.01
) x
JOIN users u ON u.phone=x.ph JOIN categories c ON c.slug=x.cs JOIN cities ci ON ci.name='Sahaswan';

INSERT INTO provider_services(provider_id,service_id,price)
SELECT p.id,s.id,s.base_price FROM providers p JOIN services s ON s.category_id=p.category_id WHERE p.public_id LIKE 'DL-%';

INSERT INTO provider_subscriptions(provider_id,plan_id,status,current_period_end)
SELECT p.id,(SELECT id FROM subscription_plans WHERE name='Free'),'TRIAL',DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY) FROM providers p;
