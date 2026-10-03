-- Namuna ma'lumotlar (faqat lokal dev uchun).
INSERT OR IGNORE INTO users (id, phone, name) VALUES
  (1, '+998901112233', 'Aziz Karimov'),
  (2, '+998935556677', 'Malika Yusupova');

INSERT OR IGNORE INTO hashars (id, title, description, address, lat, lng, date_time, items, status, creator_id) VALUES
  (1, 'Mahalla bog''ini tozalash', 'Bog''dagi axlatlarni yig''amiz va skameykalarni tartibga keltiramiz.', 'Chilonzor, 9-kvartal', 41.2756, 69.2043, '2027-10-11T09:00', '["Qo''lqop","Axlat qoplari","Belkurak"]', 'PENDING', 1),
  (2, 'Ko''cha bo''yiga 50 ta ko''chat ekish', 'Amir Temur shoh ko''chasi bo''ylab yangi daraxtlar ekamiz.', 'Yunusobod, 4-mavze', 41.3646, 69.2878, '2027-10-12T08:30', '["Ko''chat","Belkurak","Suv"]', 'PENDING', 2),
  (3, 'Bolalar maydonchasini bo''yash', 'Eski maydonchani yangi ranglar bilan jonlantiramiz.', 'Mirzo Ulug''bek, Qorasaroy', 41.3392, 69.3341, '2027-10-18T10:00', '["Bo''yoq","Cho''tka","Qo''lqop"]', 'PENDING', 1),
  (4, 'Ariq bo''yini tozalash', 'Ariq atrofi axlatdan tozalanib, ko''kalamzor qilindi.', 'Sergeli, Yangi Sergeli', 41.2273, 69.2189, '2026-09-27T08:00', '["Belkurak","Etik"]', 'COMPLETED', 2);

INSERT OR IGNORE INTO hashar_media (id, hashar_id, photo_type, r2_url) VALUES
  (1, 4, 'BEFORE', '/demo/before.svg'),
  (2, 4, 'AFTER',  '/demo/after.svg');

INSERT OR IGNORE INTO volunteers (hashar_id, user_id) VALUES (1, 2), (4, 1);
