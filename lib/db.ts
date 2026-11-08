// Sunucu tarafı Prisma istemcisi. Yalnızca sunucu kodundan (route handler, server
// component, server action) içe aktarılır; istemci bileşenine girmemelidir.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

function createClient() {
  // Bağlantı ilk sorguda açılır; build sırasında DATABASE_URL olmasa da içe aktarma hata vermez.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Veritabanına ulaşılamazsa istek sonsuza dek beklemesin.
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

// Geliştirmede sıcak yenileme her seferinde yeni bağlantı havuzu açmasın diye istemci saklanır.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
