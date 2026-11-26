-- V12: Many more service categories and services (data only; the admin panel can edit all of it).

INSERT IGNORE INTO categories(name,slug,icon,description,display_order,eta_minutes,base_visit_fee,is_featured) VALUES
('Pest Control','pest-control','🐜','Cockroach, termite, bed-bug and rodent control',96,90,99,FALSE),
('RO & Water Purifier','ro-water-purifier','💧','RO service, filter change, new installation',97,60,49,FALSE),
('CCTV & Security','cctv-security','📹','CCTV, door locks, alarms and intercom',98,120,99,FALSE),
('Mobile & Laptop Repair','mobile-laptop-repair','📱','Screen, battery, software and data help',99,60,0,FALSE),
('Computer & Networking','computer-networking','💻','Wi-Fi, printers, PC repair and setup',101,90,49,FALSE),
('Gardener (Mali)','gardener','🌿','Lawn, plants and garden care',102,120,49,FALSE),
('Packers & Movers','packers-movers','🚚','Home and shop shifting, tempo and labour',103,180,199,FALSE),
('Barber / Men''s Salon','barber-mens-salon','💈','Haircut, shave and grooming at home',104,45,0,FALSE),
('Photographer','photographer','📷','Wedding, events, product and passport photos',105,240,0,FALSE),
('Cook / Chef at Home','cook-chef','👨‍🍳','Daily cook, party chef and tiffin help',106,120,0,FALSE),
('Driver on Demand','driver-on-demand','🚖','Hourly and outstation drivers',107,60,0,FALSE),
('Welder & Fabrication','welder-fabrication','🔥','Gates, grills, sheds and steel work',108,180,99,FALSE),
('Tiles & Flooring','tiles-flooring','🔲','Tile, marble and floor polishing',109,240,99,FALSE),
('Waterproofing','waterproofing','🌧️','Roof, wall and bathroom leakage proofing',110,240,99,FALSE),
('Solar Panel Service','solar-panel','☀️','Solar installation, cleaning and repair',111,240,99,FALSE),
('Tailor','tailor','🧵','Stitching, alteration and boutique work',112,180,0,FALSE),
('Nurse & Elder Care','nurse-elder-care','🩺','Home nurse, attendant and elder care',113,120,0,FALSE),
('Yoga & Fitness Trainer','yoga-fitness','🧘','Home yoga, gym and diet coaching',114,120,0,FALSE),
('Car Wash & Detailing','car-wash','🚿','Doorstep car and bike wash',115,45,0,FALSE),
('Tyre & Puncture','tyre-shop','🛞','Puncture, tyre change and wheel alignment',116,30,49,FALSE),
('Glass & Aluminium Works','glass-aluminium','🪟','Windows, partitions, mirrors and doors',117,180,99,FALSE),
('Interior Designer','interior-designer','🛋️','Home and shop interiors',118,240,0,FALSE),
('Mehndi Artist','mehndi-artist','🌸','Bridal and festival mehndi',119,120,0,FALSE),
('Event Tent & Decoration','event-tent-decor','🎪','Tent house, flowers and stage decoration',120,240,0,FALSE),
('DJ & Sound','dj-sound','🎧','DJ, sound and lighting for events',121,240,0,FALSE),
('Sofa & Carpet Cleaning','sofa-carpet-cleaning','🛋','Shampoo and steam cleaning',122,120,49,FALSE),
('Music & Dance Classes','music-dance-classes','🎶','Singing, instruments and dance teachers',123,120,0,FALSE),
('Pet Care','pet-care','🐕','Grooming, walking, vet visits and boarding',124,90,49,FALSE),
('Locksmith','locksmith','🔑','Lock opening, key making and lock change',125,30,49,FALSE),
('Inverter & Generator Repair','inverter-generator','🔋','Inverter, UPS, battery and generator repair',126,90,49,FALSE);

-- (category slug, service name, service slug, base price, minutes)
INSERT IGNORE INTO services(category_id,name,slug,base_price,duration_minutes)
SELECT c.id,s.name,s.slug,s.price,s.mins FROM categories c JOIN (
 -- existing categories: more services
 SELECT 'electrician' cs,'Geyser installation / repair' name,'geyser-service' slug,299 price,60 mins UNION ALL
 SELECT 'electrician','MCB / fuse / meter fault','mcb-fuse',199,45 UNION ALL SELECT 'electrician','Light, chandelier & tube fitting','light-fitting',149,45 UNION ALL
 SELECT 'electrician','Doorbell & CCTV wiring','doorbell-wiring',199,60 UNION ALL SELECT 'electrician','Earthing & short-circuit check','earthing-check',349,90 UNION ALL
 SELECT 'plumber','Water motor / pump repair','motor-repair',349,90 UNION ALL SELECT 'plumber','Drain & toilet blockage','drain-blockage',249,60 UNION ALL
 SELECT 'plumber','Geyser & washbasin installation','washbasin-install',299,60 UNION ALL SELECT 'plumber','Borewell & overhead tank fitting','tank-fitting',599,180 UNION ALL
 SELECT 'carpenter','Bed, wardrobe & sofa repair','bed-wardrobe-repair',299,90 UNION ALL SELECT 'carpenter','Modular kitchen work','modular-kitchen',1999,480 UNION ALL
 SELECT 'carpenter','Polish & varnish','polish-varnish',799,240 UNION ALL
 SELECT 'house-cleaning','Bathroom deep cleaning','bathroom-cleaning',399,90 UNION ALL SELECT 'house-cleaning','Move-in / move-out cleaning','move-cleaning',1499,300 UNION ALL
 SELECT 'house-cleaning','Daily maid / part-time help (per month)','maid-monthly',2500,60 UNION ALL
 SELECT 'car-repair','AC gas & cooling check','car-ac',699,120 UNION ALL SELECT 'car-repair','Brake & clutch repair','car-brake',599,120 UNION ALL
 SELECT 'car-repair','Denting & painting','car-denting',1999,480 UNION ALL SELECT 'car-repair','Towing / roadside help','car-towing',799,60 UNION ALL
 SELECT 'bike-repair','Chain, brake & clutch','bike-chain-brake',199,60 UNION ALL SELECT 'bike-repair','Battery jump-start / replacement','bike-battery',249,30 UNION ALL
 SELECT 'bike-repair','Engine tuning','bike-engine',499,120 UNION ALL
 SELECT 'beauty-parlour','Bridal makeup','bridal-makeup',4999,240 UNION ALL SELECT 'beauty-parlour','Waxing & threading','waxing-threading',349,60 UNION ALL
 SELECT 'beauty-parlour','Hair spa & colour','hair-spa',699,90 UNION ALL SELECT 'beauty-parlour','Manicure & pedicure','mani-pedi',499,75 UNION ALL
 SELECT 'laundry','Wash & fold (per kg)','wash-fold',60,1440 UNION ALL SELECT 'laundry','Dry cleaning (per garment)','dry-cleaning',150,1440 UNION ALL
 SELECT 'laundry','Ironing (per piece)','ironing',12,720 UNION ALL
 SELECT 'home-maintenance','Home repair visit (handyman)','handyman-visit',249,60 UNION ALL SELECT 'home-maintenance','Curtain & fixture installation','curtain-fixture',299,90 UNION ALL
 SELECT 'home-maintenance','Annual maintenance (AMC) enquiry','amc-enquiry',0,30 UNION ALL
 SELECT 'tutor','Class 1-5 all subjects (per month)','tutor-primary',1200,60 UNION ALL SELECT 'tutor','Class 6-10 maths & science (per month)','tutor-6-10',1800,60 UNION ALL
 SELECT 'tutor','Class 11-12 / board exams (per month)','tutor-11-12',2500,90 UNION ALL SELECT 'tutor','Spoken English & competitive exams','tutor-english',1500,60 UNION ALL
 SELECT 'ac-appliance-repair','AC installation / uninstall','ac-install',899,120 UNION ALL SELECT 'ac-appliance-repair','Refrigerator repair','fridge-repair',349,60 UNION ALL
 SELECT 'ac-appliance-repair','Microwave, TV & cooler repair','tv-microwave-repair',299,60 UNION ALL SELECT 'ac-appliance-repair','AC gas refill','ac-gas',1799,90 UNION ALL
 SELECT 'painter','Full house painting (per sq ft)','house-painting-sqft',18,2880 UNION ALL SELECT 'painter','Putty & wall repair','putty-repair',2999,720 UNION ALL
 SELECT 'painter','Wall texture & design','wall-texture',3999,720 UNION ALL
 SELECT 'mason-labour','Mistri (per day)','mistri-day',800,480 UNION ALL SELECT 'mason-labour','Labour helper (per day)','labour-day',500,480 UNION ALL
 SELECT 'mason-labour','Plaster, brick & slab work (per sq ft)','masonry-sqft',45,2880 UNION ALL
 -- new categories
 SELECT 'pest-control','General pest control (cockroach, ants)','pest-general',899,90 UNION ALL SELECT 'pest-control','Termite treatment','pest-termite',2499,180 UNION ALL
 SELECT 'pest-control','Bed bug treatment','pest-bedbug',1499,120 UNION ALL SELECT 'pest-control','Rodent control','pest-rodent',999,90 UNION ALL
 SELECT 'ro-water-purifier','RO service & filter change','ro-service',499,45 UNION ALL SELECT 'ro-water-purifier','New RO installation','ro-install',399,60 UNION ALL
 SELECT 'ro-water-purifier','RO repair','ro-repair',349,60 UNION ALL
 SELECT 'cctv-security','CCTV installation (per camera)','cctv-install',1299,120 UNION ALL SELECT 'cctv-security','CCTV repair & DVR setup','cctv-repair',399,60 UNION ALL
 SELECT 'cctv-security','Video door phone & intercom','intercom',999,120 UNION ALL SELECT 'cctv-security','Digital lock installation','digital-lock',799,60 UNION ALL
 SELECT 'mobile-laptop-repair','Mobile screen replacement','mobile-screen',799,45 UNION ALL SELECT 'mobile-laptop-repair','Mobile battery / charging port','mobile-battery',499,45 UNION ALL
 SELECT 'mobile-laptop-repair','Laptop repair & OS install','laptop-repair',499,90 UNION ALL SELECT 'mobile-laptop-repair','Data recovery','data-recovery',999,120 UNION ALL
 SELECT 'computer-networking','Wi-Fi router setup','wifi-setup',299,45 UNION ALL SELECT 'computer-networking','Printer repair & setup','printer-repair',349,60 UNION ALL
 SELECT 'computer-networking','Desktop assembly & repair','desktop-repair',499,90 UNION ALL SELECT 'computer-networking','Office network & LAN wiring','lan-wiring',1499,240 UNION ALL
 SELECT 'gardener','Garden maintenance (visit)','garden-visit',299,120 UNION ALL SELECT 'gardener','Lawn cutting & plant care (monthly)','lawn-monthly',1500,120 UNION ALL
 SELECT 'gardener','Terrace / kitchen garden setup','terrace-garden',2499,300 UNION ALL
 SELECT 'packers-movers','1 BHK shifting (local)','shift-1bhk',3999,300 UNION ALL SELECT 'packers-movers','2-3 BHK shifting (local)','shift-3bhk',6999,480 UNION ALL
 SELECT 'packers-movers','Tempo / mini truck with labour','tempo-labour',1200,180 UNION ALL SELECT 'packers-movers','Shop / office shifting','shift-office',4999,480 UNION ALL
 SELECT 'barber-mens-salon','Haircut at home','barber-haircut',149,30 UNION ALL SELECT 'barber-mens-salon','Haircut + beard','barber-hair-beard',249,45 UNION ALL
 SELECT 'barber-mens-salon','Facial & head massage','barber-facial',399,60 UNION ALL
 SELECT 'photographer','Wedding photography (per day)','wedding-photo',15000,600 UNION ALL SELECT 'photographer','Event / birthday photography','event-photo',3500,240 UNION ALL
 SELECT 'photographer','Product / shop photoshoot','product-photo',2500,180 UNION ALL SELECT 'photographer','Passport size photos at home','passport-photo',199,30 UNION ALL
 SELECT 'cook-chef','Daily cook (per month)','cook-monthly',3000,120 UNION ALL SELECT 'cook-chef','Party chef (per event)','party-chef',1999,300 UNION ALL
 SELECT 'cook-chef','Tiffin service (per month)','tiffin-monthly',2500,30 UNION ALL
 SELECT 'driver-on-demand','Driver per day (8 hours)','driver-day',700,480 UNION ALL SELECT 'driver-on-demand','Outstation driver (per day)','driver-outstation',1200,720 UNION ALL
 SELECT 'driver-on-demand','Monthly driver','driver-monthly',15000,480 UNION ALL
 SELECT 'welder-fabrication','Gate & grill work (per kg)','gate-grill',150,480 UNION ALL SELECT 'welder-fabrication','Shed & roof structure','shed-structure',4999,720 UNION ALL
 SELECT 'welder-fabrication','Welding repair visit','welding-repair',399,90 UNION ALL
 SELECT 'tiles-flooring','Floor tile laying (per sq ft)','tile-laying',60,2880 UNION ALL SELECT 'tiles-flooring','Marble & granite polishing','marble-polish',3999,720 UNION ALL
 SELECT 'tiles-flooring','Tile repair / grouting','tile-repair',499,120 UNION ALL
 SELECT 'waterproofing','Roof waterproofing (per sq ft)','roof-waterproof',35,2880 UNION ALL SELECT 'waterproofing','Bathroom leakage proofing','bathroom-waterproof',2999,480 UNION ALL
 SELECT 'waterproofing','Wall seepage treatment','wall-seepage',1999,360 UNION ALL
 SELECT 'solar-panel','Solar panel cleaning','solar-clean',499,90 UNION ALL SELECT 'solar-panel','Solar system installation enquiry','solar-install',0,60 UNION ALL
 SELECT 'solar-panel','Solar inverter / battery repair','solar-repair',599,120 UNION ALL
 SELECT 'tailor','Blouse / suit stitching','tailor-stitch',499,240 UNION ALL SELECT 'tailor','Alteration','tailor-alter',99,60 UNION ALL
 SELECT 'tailor','Shirt / trouser stitching','tailor-shirt',450,240 UNION ALL
 SELECT 'nurse-elder-care','Home nurse (12 hours)','nurse-12h',1200,720 UNION ALL SELECT 'nurse-elder-care','Elder care attendant (24 hours)','attendant-24h',1800,1440 UNION ALL
 SELECT 'nurse-elder-care','Injection / dressing at home','nurse-injection',299,30 UNION ALL
 SELECT 'yoga-fitness','Home yoga class (per month)','yoga-monthly',2000,60 UNION ALL SELECT 'yoga-fitness','Personal fitness trainer (per month)','fitness-monthly',3000,60 UNION ALL
 SELECT 'yoga-fitness','Diet & weight-loss plan','diet-plan',999,45 UNION ALL
 SELECT 'car-wash','Car wash at doorstep','car-wash-basic',199,45 UNION ALL SELECT 'car-wash','Car interior deep cleaning','car-interior',799,120 UNION ALL
 SELECT 'car-wash','Bike wash','bike-wash',79,20 UNION ALL SELECT 'car-wash','Polish & ceramic coating enquiry','car-polish',1499,240 UNION ALL
 SELECT 'tyre-shop','Puncture repair','tyre-puncture',99,20 UNION ALL SELECT 'tyre-shop','Tyre change','tyre-change',299,45 UNION ALL
 SELECT 'tyre-shop','Wheel balancing & alignment','wheel-align',699,60 UNION ALL
 SELECT 'glass-aluminium','Aluminium window / door','aluminium-window',650,480 UNION ALL SELECT 'glass-aluminium','Glass partition & mirror','glass-partition',450,360 UNION ALL
 SELECT 'glass-aluminium','Glass repair visit','glass-repair',399,60 UNION ALL
 SELECT 'interior-designer','Design consultation','interior-consult',499,90 UNION ALL SELECT 'interior-designer','Full home interior (enquiry)','interior-full',0,120 UNION ALL
 SELECT 'interior-designer','False ceiling work','false-ceiling',95,2880 UNION ALL
 SELECT 'mehndi-artist','Bridal mehndi','mehndi-bridal',2500,240 UNION ALL SELECT 'mehndi-artist','Festival / party mehndi','mehndi-party',399,60 UNION ALL
 SELECT 'event-tent-decor','Tent & chairs (per day)','tent-chairs',4999,480 UNION ALL SELECT 'event-tent-decor','Flower & stage decoration','stage-decor',7999,480 UNION ALL
 SELECT 'event-tent-decor','Birthday / baby shower decoration','birthday-decor',2499,180 UNION ALL
 SELECT 'dj-sound','DJ with sound (per event)','dj-event',6000,300 UNION ALL SELECT 'dj-sound','Sound & lights only','sound-lights',3500,300 UNION ALL
 SELECT 'dj-sound','Band baja / dhol','band-dhol',8000,240 UNION ALL
 SELECT 'sofa-carpet-cleaning','Sofa shampoo (per seat)','sofa-shampoo',199,60 UNION ALL SELECT 'sofa-carpet-cleaning','Carpet steam cleaning','carpet-steam',499,90 UNION ALL
 SELECT 'sofa-carpet-cleaning','Mattress cleaning','mattress-clean',499,60 UNION ALL
 SELECT 'music-dance-classes','Singing / harmonium (per month)','music-vocal',1500,60 UNION ALL SELECT 'music-dance-classes','Guitar / keyboard (per month)','music-instrument',1800,60 UNION ALL
 SELECT 'music-dance-classes','Dance class (per month)','dance-class',1500,60 UNION ALL
 SELECT 'pet-care','Pet grooming at home','pet-grooming',699,90 UNION ALL SELECT 'pet-care','Dog walking (per month)','dog-walking',1500,45 UNION ALL
 SELECT 'pet-care','Vet visit at home','vet-visit',499,60 UNION ALL
 SELECT 'locksmith','Lock opening','lock-open',199,30 UNION ALL SELECT 'locksmith','Duplicate key making','key-duplicate',99,20 UNION ALL
 SELECT 'locksmith','Lock change / new lock fitting','lock-change',299,45 UNION ALL
 SELECT 'inverter-generator','Inverter / UPS repair','inverter-repair',299,60 UNION ALL SELECT 'inverter-generator','New battery fitting','battery-fitting',249,45 UNION ALL
 SELECT 'inverter-generator','Generator servicing','generator-service',799,120
) s ON s.cs=c.slug;
