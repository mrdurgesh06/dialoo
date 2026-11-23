-- V11: All 75 districts of Uttar Pradesh with their headquarters city, extra towns, major localities and a street table.
-- Coordinates are approximate (good for "nearest city" within ~60 km and for centring maps). Admins can refine them in the panel.
-- Idempotent: INSERT IGNORE + the unique keys from V4, so re-running over existing data is safe.

INSERT IGNORE INTO districts(state_id,name)
SELECT s.id, x.name FROM states s JOIN (
 SELECT 'Agra' name UNION ALL SELECT 'Aligarh' UNION ALL SELECT 'Ambedkar Nagar' UNION ALL SELECT 'Amethi' UNION ALL SELECT 'Amroha' UNION ALL SELECT 'Auraiya'
 UNION ALL SELECT 'Ayodhya' UNION ALL SELECT 'Azamgarh' UNION ALL SELECT 'Baghpat' UNION ALL SELECT 'Bahraich' UNION ALL SELECT 'Ballia' UNION ALL SELECT 'Balrampur'
 UNION ALL SELECT 'Banda' UNION ALL SELECT 'Barabanki' UNION ALL SELECT 'Bareilly' UNION ALL SELECT 'Basti' UNION ALL SELECT 'Bhadohi' UNION ALL SELECT 'Bijnor'
 UNION ALL SELECT 'Budaun' UNION ALL SELECT 'Bulandshahr' UNION ALL SELECT 'Chandauli' UNION ALL SELECT 'Chitrakoot' UNION ALL SELECT 'Deoria' UNION ALL SELECT 'Etah'
 UNION ALL SELECT 'Etawah' UNION ALL SELECT 'Farrukhabad' UNION ALL SELECT 'Fatehpur' UNION ALL SELECT 'Firozabad' UNION ALL SELECT 'Gautam Buddha Nagar' UNION ALL SELECT 'Ghaziabad'
 UNION ALL SELECT 'Ghazipur' UNION ALL SELECT 'Gonda' UNION ALL SELECT 'Gorakhpur' UNION ALL SELECT 'Hamirpur' UNION ALL SELECT 'Hapur' UNION ALL SELECT 'Hardoi'
 UNION ALL SELECT 'Hathras' UNION ALL SELECT 'Jalaun' UNION ALL SELECT 'Jaunpur' UNION ALL SELECT 'Jhansi' UNION ALL SELECT 'Kannauj' UNION ALL SELECT 'Kanpur Dehat'
 UNION ALL SELECT 'Kanpur Nagar' UNION ALL SELECT 'Kasganj' UNION ALL SELECT 'Kaushambi' UNION ALL SELECT 'Kushinagar' UNION ALL SELECT 'Lakhimpur Kheri' UNION ALL SELECT 'Lalitpur'
 UNION ALL SELECT 'Lucknow' UNION ALL SELECT 'Maharajganj' UNION ALL SELECT 'Mahoba' UNION ALL SELECT 'Mainpuri' UNION ALL SELECT 'Mathura' UNION ALL SELECT 'Mau'
 UNION ALL SELECT 'Meerut' UNION ALL SELECT 'Mirzapur' UNION ALL SELECT 'Moradabad' UNION ALL SELECT 'Muzaffarnagar' UNION ALL SELECT 'Pilibhit' UNION ALL SELECT 'Pratapgarh'
 UNION ALL SELECT 'Prayagraj' UNION ALL SELECT 'Raebareli' UNION ALL SELECT 'Rampur' UNION ALL SELECT 'Saharanpur' UNION ALL SELECT 'Sambhal' UNION ALL SELECT 'Sant Kabir Nagar'
 UNION ALL SELECT 'Shahjahanpur' UNION ALL SELECT 'Shamli' UNION ALL SELECT 'Shravasti' UNION ALL SELECT 'Siddharthnagar' UNION ALL SELECT 'Sitapur' UNION ALL SELECT 'Sonbhadra'
 UNION ALL SELECT 'Sultanpur' UNION ALL SELECT 'Unnao' UNION ALL SELECT 'Varanasi'
) x WHERE s.code='UP';

-- District headquarters + selected towns: (district, city, latitude, longitude)
INSERT IGNORE INTO cities(district_id,name,latitude,longitude,is_active,launched_at)
SELECT d.id, x.city, x.lat, x.lng, TRUE, UTC_TIMESTAMP()
FROM (
 SELECT 'Agra' district,'Agra' city,27.176700 lat,78.008100 lng UNION ALL SELECT 'Aligarh','Aligarh',27.897400,78.088000 UNION ALL SELECT 'Ambedkar Nagar','Akbarpur',26.430000,82.540000
 UNION ALL SELECT 'Amethi','Gauriganj',26.162000,81.800000 UNION ALL SELECT 'Amroha','Amroha',28.903300,78.467200 UNION ALL SELECT 'Auraiya','Auraiya',26.465000,79.516000
 UNION ALL SELECT 'Ayodhya','Ayodhya',26.792200,82.199800 UNION ALL SELECT 'Azamgarh','Azamgarh',26.068500,83.185900 UNION ALL SELECT 'Baghpat','Baghpat',28.945000,77.218000
 UNION ALL SELECT 'Bahraich','Bahraich',27.574200,81.594700 UNION ALL SELECT 'Ballia','Ballia',25.758500,84.147000 UNION ALL SELECT 'Balrampur','Balrampur',27.430000,82.180000
 UNION ALL SELECT 'Banda','Banda',25.476000,80.335000 UNION ALL SELECT 'Barabanki','Barabanki',26.926000,81.183000 UNION ALL SELECT 'Bareilly','Bareilly',28.367000,79.430000
 UNION ALL SELECT 'Basti','Basti',26.800000,82.730000 UNION ALL SELECT 'Bhadohi','Bhadohi',25.395000,82.570000 UNION ALL SELECT 'Bijnor','Bijnor',29.372400,78.136400
 UNION ALL SELECT 'Budaun','Budaun',28.036000,79.126000 UNION ALL SELECT 'Bulandshahr','Bulandshahr',28.407000,77.850000 UNION ALL SELECT 'Chandauli','Chandauli',25.266700,83.266700
 UNION ALL SELECT 'Chitrakoot','Karwi',25.202000,80.902000 UNION ALL SELECT 'Deoria','Deoria',26.502400,83.779100 UNION ALL SELECT 'Etah','Etah',27.559000,78.663000
 UNION ALL SELECT 'Etawah','Etawah',26.785500,79.021500 UNION ALL SELECT 'Farrukhabad','Fatehgarh',27.391000,79.581000 UNION ALL SELECT 'Fatehpur','Fatehpur',25.930000,80.814000
 UNION ALL SELECT 'Firozabad','Firozabad',27.159100,78.395700 UNION ALL SELECT 'Gautam Buddha Nagar','Noida',28.535500,77.391000 UNION ALL SELECT 'Ghaziabad','Ghaziabad',28.669200,77.453800
 UNION ALL SELECT 'Ghazipur','Ghazipur',25.588000,83.578000 UNION ALL SELECT 'Gonda','Gonda',27.134000,81.961000 UNION ALL SELECT 'Gorakhpur','Gorakhpur',26.760600,83.373200
 UNION ALL SELECT 'Hamirpur','Hamirpur',25.956000,80.147000 UNION ALL SELECT 'Hapur','Hapur',28.730600,77.775900 UNION ALL SELECT 'Hardoi','Hardoi',27.395000,80.131000
 UNION ALL SELECT 'Hathras','Hathras',27.595000,78.050000 UNION ALL SELECT 'Jalaun','Orai',25.990000,79.450000 UNION ALL SELECT 'Jaunpur','Jaunpur',25.746000,82.683000
 UNION ALL SELECT 'Jhansi','Jhansi',25.448400,78.568500 UNION ALL SELECT 'Kannauj','Kannauj',27.055000,79.919000 UNION ALL SELECT 'Kanpur Dehat','Akbarpur (Kanpur Dehat)',26.425000,79.650000
 UNION ALL SELECT 'Kanpur Nagar','Kanpur',26.449900,80.331900 UNION ALL SELECT 'Kasganj','Kasganj',27.808000,78.645000 UNION ALL SELECT 'Kaushambi','Manjhanpur',25.532000,81.360000
 UNION ALL SELECT 'Kushinagar','Padrauna',26.902000,83.981000 UNION ALL SELECT 'Lakhimpur Kheri','Lakhimpur',27.947000,80.774000 UNION ALL SELECT 'Lalitpur','Lalitpur',24.690000,78.410000
 UNION ALL SELECT 'Lucknow','Lucknow',26.846700,80.946200 UNION ALL SELECT 'Maharajganj','Maharajganj',27.130000,83.560000 UNION ALL SELECT 'Mahoba','Mahoba',25.292000,79.873000
 UNION ALL SELECT 'Mainpuri','Mainpuri',27.235000,79.027000 UNION ALL SELECT 'Mathura','Mathura',27.492400,77.673700 UNION ALL SELECT 'Mau','Mau',25.941700,83.561100
 UNION ALL SELECT 'Meerut','Meerut',28.984500,77.706400 UNION ALL SELECT 'Mirzapur','Mirzapur',25.146000,82.569000 UNION ALL SELECT 'Moradabad','Moradabad',28.838600,78.773300
 UNION ALL SELECT 'Muzaffarnagar','Muzaffarnagar',29.472700,77.708500 UNION ALL SELECT 'Pilibhit','Pilibhit',28.631000,79.804000 UNION ALL SELECT 'Pratapgarh','Pratapgarh',25.897000,81.995000
 UNION ALL SELECT 'Prayagraj','Prayagraj',25.435800,81.846300 UNION ALL SELECT 'Raebareli','Rae Bareli',26.212400,81.233100 UNION ALL SELECT 'Rampur','Rampur',28.805000,79.025000
 UNION ALL SELECT 'Saharanpur','Saharanpur',29.968000,77.546000 UNION ALL SELECT 'Sambhal','Sambhal',28.585000,78.570000 UNION ALL SELECT 'Sant Kabir Nagar','Khalilabad',26.771000,83.071000
 UNION ALL SELECT 'Shahjahanpur','Shahjahanpur',27.883000,79.910000 UNION ALL SELECT 'Shamli','Shamli',29.450000,77.310000 UNION ALL SELECT 'Shravasti','Bhinga',27.710000,81.930000
 UNION ALL SELECT 'Siddharthnagar','Naugarh',27.280000,83.090000 UNION ALL SELECT 'Sitapur','Sitapur',27.568000,80.682000 UNION ALL SELECT 'Sonbhadra','Robertsganj',24.690000,83.070000
 UNION ALL SELECT 'Sultanpur','Sultanpur',26.264000,82.073000 UNION ALL SELECT 'Unnao','Unnao',26.547000,80.488000 UNION ALL SELECT 'Varanasi','Varanasi',25.317600,82.973900
 -- extra towns (tehsils / big towns)
 UNION ALL SELECT 'Budaun','Sahaswan',28.073000,78.753000 UNION ALL SELECT 'Budaun','Bisauli',28.310000,78.940000 UNION ALL SELECT 'Budaun','Dataganj',27.997000,79.412000
 UNION ALL SELECT 'Budaun','Gunnaur',28.233000,78.435000 UNION ALL SELECT 'Budaun','Ujhani',28.002000,79.024000 UNION ALL SELECT 'Budaun','Bilsi',28.185000,78.910000
 UNION ALL SELECT 'Bareilly','Aonla',28.275000,79.165000 UNION ALL SELECT 'Bareilly','Faridpur',28.207000,79.540000 UNION ALL SELECT 'Bareilly','Nawabganj',28.536000,79.634000
 UNION ALL SELECT 'Gautam Buddha Nagar','Greater Noida',28.474400,77.504000 UNION ALL SELECT 'Bulandshahr','Khurja',28.252000,77.856000 UNION ALL SELECT 'Saharanpur','Deoband',29.693000,77.680000
 UNION ALL SELECT 'Shamli','Kairana',29.394000,77.206000 UNION ALL SELECT 'Bijnor','Najibabad',29.613000,78.342000 UNION ALL SELECT 'Sambhal','Chandausi',28.450000,78.780000
) x
JOIN districts d ON d.name=x.district JOIN states s ON s.id=d.state_id AND s.code='UP';

-- Every Uttar Pradesh city is switched on (admins can switch any city off again in the panel)
UPDATE cities c JOIN districts d ON d.id=c.district_id JOIN states s ON s.id=d.state_id
   SET c.is_active=TRUE, c.launched_at=COALESCE(c.launched_at, UTC_TIMESTAMP())
 WHERE s.code='UP';

-- Major localities (area name, pincode, centre point) used for "nearest area" when the map service is unreachable
INSERT IGNORE INTO localities(city_id,name,pincode,latitude,longitude)
SELECT c.id, x.loc, x.pin, x.lat, x.lng FROM (
 SELECT 'Lucknow' city,'Hazratganj' loc,'226001' pin,26.850000 lat,80.940000 lng UNION ALL SELECT 'Lucknow','Gomti Nagar','226010',26.856000,81.001000
 UNION ALL SELECT 'Lucknow','Aliganj','226024',26.890000,80.940000 UNION ALL SELECT 'Lucknow','Chowk','226003',26.869000,80.913000
 UNION ALL SELECT 'Lucknow','Indira Nagar','226016',26.876000,80.999000 UNION ALL SELECT 'Lucknow','Alambagh','226005',26.810000,80.900000
 UNION ALL SELECT 'Kanpur','Civil Lines','208001',26.478000,80.350000 UNION ALL SELECT 'Kanpur','Swaroop Nagar','208002',26.475000,80.317000
 UNION ALL SELECT 'Kanpur','Kakadeo','208025',26.473000,80.300000 UNION ALL SELECT 'Kanpur','Govind Nagar','208006',26.445000,80.310000
 UNION ALL SELECT 'Varanasi','Godowlia','221001',25.309000,83.010000 UNION ALL SELECT 'Varanasi','Lanka','221005',25.280000,82.990000
 UNION ALL SELECT 'Varanasi','Sigra','221010',25.320000,82.980000 UNION ALL SELECT 'Varanasi','Cantt','221002',25.325000,82.970000
 UNION ALL SELECT 'Agra','Sadar Bazar','282001',27.159000,78.012000 UNION ALL SELECT 'Agra','Sanjay Place','282002',27.195000,78.009000
 UNION ALL SELECT 'Agra','Taj Ganj','282001',27.165000,78.042000 UNION ALL SELECT 'Agra','Kamla Nagar','282005',27.206000,78.027000
 UNION ALL SELECT 'Prayagraj','Civil Lines','211001',25.452000,81.834000 UNION ALL SELECT 'Prayagraj','Katra','211002',25.450000,81.860000
 UNION ALL SELECT 'Prayagraj','Allahpur','211006',25.465000,81.870000 UNION ALL SELECT 'Meerut','Begum Bridge','250001',28.984000,77.705000
 UNION ALL SELECT 'Meerut','Sadar Bazar','250001',28.990000,77.700000 UNION ALL SELECT 'Gorakhpur','Golghar','273001',26.758000,83.373000
 UNION ALL SELECT 'Gorakhpur','Basharatpur','273004',26.740000,83.370000 UNION ALL SELECT 'Noida','Sector 18','201301',28.570000,77.321000
 UNION ALL SELECT 'Noida','Sector 62','201309',28.627000,77.365000 UNION ALL SELECT 'Noida','Sector 15','201301',28.585000,77.308000
 UNION ALL SELECT 'Ghaziabad','Raj Nagar','201002',28.670000,77.440000 UNION ALL SELECT 'Ghaziabad','Vaishali','201010',28.645000,77.340000
 UNION ALL SELECT 'Ghaziabad','Indirapuram','201014',28.646000,77.370000 UNION ALL SELECT 'Bareilly','Subhash Nagar','243122',28.360000,79.420000
) x JOIN cities c ON c.name=x.city;

-- Street level: lets the app say "near <street>, <area>" even when the external map service is down.
CREATE TABLE streets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  city_id BIGINT NOT NULL,
  locality_id BIGINT NULL,
  name VARCHAR(160) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'ADMIN',        -- ADMIN / SEED_APPROX
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_street_city FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT fk_street_locality FOREIGN KEY (locality_id) REFERENCES localities(id) ON DELETE SET NULL,
  UNIQUE KEY uq_street (city_id, name),
  INDEX idx_street_geo (latitude, longitude)
);
-- A few well-known roads as examples (approximate points - verify and add more from Admin > Locations)
INSERT IGNORE INTO streets(city_id,locality_id,name,latitude,longitude,source)
SELECT c.id,(SELECT l.id FROM localities l WHERE l.city_id=c.id AND l.name=x.loc LIMIT 1),x.name,x.lat,x.lng,'SEED_APPROX' FROM (
 SELECT 'Lucknow' city,'Hazratganj' loc,'MG Marg' name,26.850500 lat,80.946000 lng
 UNION ALL SELECT 'Kanpur','Civil Lines','The Mall Road',26.469000,80.348000
 UNION ALL SELECT 'Sahaswan','Station Road','Station Road',28.071000,78.756000
) x JOIN cities c ON c.name=x.city;
