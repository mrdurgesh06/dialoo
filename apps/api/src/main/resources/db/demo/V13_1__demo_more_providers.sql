-- DEMO DATA (local only): more providers across new categories and Uttar Pradesh cities. Loaded from classpath:db/demo.
-- OTP login with 9000000009 ... 9000000020 (dev OTP is shown on screen). Coordinates are approximate.
INSERT INTO users(full_name,phone,email,password_hash,role,enabled,public_id) VALUES
('Rohit Singh','9000000009',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Imran Qureshi','9000000010',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Anita Verma','9000000011',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Deepak Mishra','9000000012',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Farhan Ali','9000000013',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Suman Gupta','9000000014',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Manoj Tiwari','9000000015',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Kavita Rani','9000000016',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Arvind Pal','9000000017',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Sunil Chauhan','9000000018',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Pankaj Saxena','9000000019',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26))),
('Rekha Yadav','9000000020',NULL,NULL,'PROVIDER',TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)));

INSERT INTO providers(user_id,business_name,category_id,description,address,city,city_id,price_from,years_experience,verified,available_now,status,
  average_rating,review_count,public_id,verification_level,completed_jobs_count,avg_response_minutes,avatar_emoji,emergency_available,latitude,longitude)
SELECT u.id,x.bn,c.id,x.d,x.addr,ci.name,ci.id,x.price,x.yrs,x.ver,x.av,'APPROVED',x.rt,x.rc,CONCAT('DL-',x.pid),IF(x.ver,'DIALOO_VERIFIED','MOBILE_VERIFIED'),
  x.jobs,x.resp,x.em,x.emerg,ci.latitude+x.dlat,ci.longitude+x.dlng
FROM (
 SELECT '9000000009' ph,'Rohit Pest Solutions' bn,'pest-control' cs,'Cockroach, termite and bed-bug treatment for homes and shops.' d,'Main Market' addr,'Sahaswan' cn,899 price,6 yrs,TRUE ver,TRUE av,4.6 rt,41 rc,'PST901001' pid,88 jobs,20 resp,'🐜' em,FALSE emerg,0.006 dlat,0.004 dlng UNION ALL
 SELECT '9000000010','Imran RO Care','ro-water-purifier','RO service, filter change and new RO installation.','Civil Lines','Sahaswan',499,5,TRUE,TRUE,4.7,63,'ROW901002',140,15,'💧',FALSE,0.010,0.002 UNION ALL
 SELECT '9000000011','Anita Mehndi Art','mehndi-artist','Bridal and festival mehndi designs.','Station Road','Sahaswan',399,7,FALSE,TRUE,4.9,35,'MHN901003',52,25,'🌸',FALSE,0.003,0.009 UNION ALL
 SELECT '9000000012','Deepak Mobile Clinic','mobile-laptop-repair','Mobile screen, battery and laptop repair at your door.','Main Market','Budaun',499,8,TRUE,TRUE,4.5,77,'MBL901004',210,12,'📱',FALSE,0.004,0.003 UNION ALL
 SELECT '9000000013','Farhan Packers & Movers','packers-movers','Safe home and shop shifting with tempo and labour.','Civil Lines','Bareilly',3999,9,TRUE,FALSE,4.4,29,'PKR901005',64,30,'🚚',FALSE,0.008,0.006 UNION ALL
 SELECT '9000000014','Suman Home Chef','cook-chef','Daily cook, party chef and tiffin service.','Gomti Nagar','Lucknow',1999,6,FALSE,TRUE,4.8,52,'CHF901006',97,18,'👨‍🍳',FALSE,0.009,0.055 UNION ALL
 SELECT '9000000015','Manoj CCTV & Security','cctv-security','CCTV installation, repair and digital locks.','Hazratganj','Lucknow',1299,10,TRUE,TRUE,4.6,88,'CTV901007',176,14,'📹',FALSE,0.004,0.004 UNION ALL
 SELECT '9000000016','Kavita Yoga Studio','yoga-fitness','Home yoga and fitness coaching.','Civil Lines','Kanpur',2000,5,TRUE,TRUE,4.9,44,'YOG901008',61,20,'🧘',FALSE,0.006,0.012 UNION ALL
 SELECT '9000000017','Arvind Car Wash','car-wash','Doorstep car wash and interior cleaning.','Main Market','Sahaswan',199,4,FALSE,TRUE,4.3,26,'CWS901009',73,10,'🚿',FALSE,0.002,0.007 UNION ALL
 SELECT '9000000018','Sunil Tyre & Puncture','tyre-shop','Quick puncture repair and tyre change, roadside help.','Station Road','Sahaswan',99,11,TRUE,TRUE,4.7,120,'TYR901010',330,8,'🛞',TRUE,0.001,0.011 UNION ALL
 SELECT '9000000019','Pankaj Solar Services','solar-panel','Solar panel cleaning, repair and installation.','Civil Lines','Budaun',499,7,TRUE,TRUE,4.5,31,'SLR901011',48,25,'☀️',FALSE,0.009,0.001 UNION ALL
 SELECT '9000000020','Rekha Tailors & Boutique','tailor','Stitching and alteration for ladies and gents.','Main Market','Sahaswan',99,12,FALSE,TRUE,4.6,58,'TLR901012',150,16,'🧵',FALSE,0.005,0.001
) x
JOIN users u ON u.phone=x.ph JOIN categories c ON c.slug=x.cs JOIN cities ci ON ci.name=x.cn;

INSERT INTO provider_services(provider_id,service_id,price)
SELECT p.id,s.id,s.base_price FROM providers p JOIN services s ON s.category_id=p.category_id
WHERE p.public_id IN ('DL-PST901001','DL-ROW901002','DL-MHN901003','DL-MBL901004','DL-PKR901005','DL-CHF901006','DL-CTV901007','DL-YOG901008','DL-CWS901009','DL-TYR901010','DL-SLR901011','DL-TLR901012');

INSERT INTO provider_subscriptions(provider_id,plan_id,status,current_period_end)
SELECT p.id,(SELECT id FROM subscription_plans WHERE name='Free'),'TRIAL',DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY) FROM providers p
WHERE p.public_id IN ('DL-PST901001','DL-ROW901002','DL-MHN901003','DL-MBL901004','DL-PKR901005','DL-CHF901006','DL-CTV901007','DL-YOG901008','DL-CWS901009','DL-TYR901010','DL-SLR901011','DL-TLR901012');
