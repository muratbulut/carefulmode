// Yük testi betiklerinin (prepare.ts, cleanup.ts) güvenlik denetimleri. Prisma'sız ve saf: birim
// testi (tests/unit/load-safety.test.ts) bunları doğrudan çağırır.

import { randomBytes } from "node:crypto";
import pg from "pg";

/**
 * Bu makinenin adresleri. Docker yığınının iç adı "db" bilerek yok: sunucuda yığının ağında "db"
 * canlı veritabanıdır (güvenlik turu 5). Yerel yük yığını veritabanını 127.0.0.1'de açar.
 */
const loopback = new Set(["localhost", "127.0.0.1", "::1"]);

export type DatabaseCheck = { ok: true; where: string } | { ok: false; reason: string };

/**
 * Adres bu makinedeki bir veritabanı mı? Karar, sürücünün (pg) gerçekten bağlanacağı yere göre
 * verilir: URL'deki ana makine adı "localhost" olsa da "?host=..." onu ezer (pg-connection-string,
 * aynı ad birden çok kez verilirse sonuncusu). URL'in ana makinesi, bütün "host" değerleri ve
 * pg'nin çözdüğü adres; üçü de yerel olmalı. Unix soketi ve boş adres kabul edilmez.
 * Dönen `where` yalnızca ekrana yazmak içindir (şifresiz).
 */
export function checkLocalDatabase(url: string | undefined): DatabaseCheck {
  if (!url) return { ok: false, reason: "DATABASE_URL tanımlı değil." };
  let parsed: URL;
  let driver: pg.Client;
  try {
    parsed = new URL(url);
    driver = new pg.Client({ connectionString: url });
  } catch {
    return { ok: false, reason: "DATABASE_URL okunamadı." };
  }
  const hosts = [parsed.hostname.replace(/^\[(.+)\]$/, "$1"), ...parsed.searchParams.getAll("host"), driver.host];
  const foreign = hosts.find((host) => !loopback.has(host));
  if (foreign !== undefined) {
    return {
      ok: false,
      reason:
        `Bu betik yalnızca bu makinedeki veritabanında çalışır (localhost, 127.0.0.1, ::1). ` +
        `Verilen adres: ${foreign || "(boş)"}. Canlı koşu için tests/load/README.md'ye bakın.`,
    };
  }
  return { ok: true, where: `${driver.host}:${driver.port}/${driver.database ?? ""}` };
}

/**
 * Yük hesaplarının bu koşuya özel şifresi. Depoda sabit bir şifre olsaydı, yük hesapları (biri
 * yönetici) yanlışlıkla başka bir veritabanında açıldığında herkes o şifreyle girebilirdi. Şifre
 * yalnızca users.json'a (0600) yazılır; elle girip bakmak için oradan okunur.
 */
export function newLoadPassword(): string {
  return `Yuk-${randomBytes(18).toString("base64url")}-7`;
}
