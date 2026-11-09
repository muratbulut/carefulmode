-- Depodaki oda dosyasının (labs/rooms/) parmak izi (27 Ekim, Murat: odanın asıl yeri dosyadır).
-- Formla açılan ve var olan odalarda boş kalır; başlangıç verisi dosya değişince odayı günceller.
ALTER TABLE "Lab" ADD COLUMN     "sourceHash" TEXT;
