-- Giriş zamanları (9 Kasım, hoca öncesi kontrol 23): ana sayfadaki "Son girişin" şeridi için.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSignInAt" TIMESTAMP(3),
ADD COLUMN     "previousSignInAt" TIMESTAMP(3);
