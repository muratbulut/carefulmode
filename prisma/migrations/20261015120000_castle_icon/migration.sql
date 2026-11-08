-- Hesap Kalesi'nin ikonu asma kilitten kaleye: yol haritasındaki "Kilitli" işaretiyle karışıyordu.
-- Yalnızca hâlâ başlangıçtaki ikonu taşıyorsa değişir.
UPDATE "Neighborhood" SET "icon" = 'castle' WHERE "slug" = 'hesap-kalesi' AND "icon" = 'lock';
