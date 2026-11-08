import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 .env dosyasını kendisi okumaz. Varsa Node'un yerleşik okuyucusuyla yüklenir;
// ortamda zaten tanımlı değişkenlerin üzerine yazılmaz (CI ve Docker ortamı geçerli kalır).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON prisma/seed.ts",
  },
  // `prisma generate` adresi gerektirmez; migrate komutları DATABASE_URL ister.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
