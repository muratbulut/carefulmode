import { existsSync } from "node:fs";
import pg from "pg";

/**
 * Testlerin veritabanına doğrudan eriştiği birkaç yer için (sayaç temizliği). Yalnızca yerel ve
 * CI koşusunda kullanılır; canlı siteye karşı hiç çağrılmaz.
 */
export async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T | undefined> {
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  if (!process.env.DATABASE_URL) return undefined;
  // Prisma'ya özgü "?schema=" eki pg sürücüsünde tanınmaz.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL.replace(/\?schema=\w+$/, "") });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
