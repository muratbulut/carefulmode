import { rm } from "node:fs/promises";
import { deleteTestLabs } from "./admin";
import { withDb } from "./db";
import { mailOutboxDir } from "./outbox-dir";

/**
 * Yerel ve CI koşusundan önce: eski kod maillerini ve istek sınırı sayaçlarını temizler.
 * Testler hep aynı IP'den (127.0.0.1) kayıt olduğu için, art arda koşularda sayaçlar dolmasın.
 * Yarıda kalmış eski koşuların açtığı "e2e-" lablarını da siler (yarım saatten eski olanları;
 * aynı anda koşan başka bir test grubunun labı yerinde kalır).
 * Canlı siteye karşı (PW_BASE_URL) hiçbir şey yapmaz.
 */
export default async function globalSetup() {
  if (process.env.PW_BASE_URL) return;
  await rm(mailOutboxDir, { recursive: true, force: true });
  await withDb((client) => client.query('DELETE FROM "RateLimit"'));
  await deleteTestLabs({ olderThanMinutes: 30 });
}
