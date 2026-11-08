// Yük testinin bıraktığı hesapları ve verileri siler (accounts.ts deleteLoadData).
//
//   DATABASE_URL=... node tests/load/cleanup.ts
//
// Yalnızca yerel ya da test veritabanında çalışır. Yük testi dışındaki hiçbir satıra dokunmaz:
// silinenler yük alan adındaki hesaplar, onların denemeleri, sınıfları, haberleri ve ipuçları,
// yük testi IP'lerinin istek sınırı sayaçlarıdır.

import { rm } from "node:fs/promises";
import { assertLocalDatabase, connect, deleteLoadData } from "./accounts.ts";

const url = process.env.DATABASE_URL;
const where = assertLocalDatabase(url);
const db = connect(url!);
try {
  const removed = await deleteLoadData(db);
  console.log(
    `Veritabanı ${where}: ${removed.users} hesap, ${removed.attempts} deneme, ${removed.classrooms} sınıf, ` +
      `${removed.news} haber, ${removed.tips} ipucu, ${removed.rateLimits} istek sayacı silindi.`,
  );
  if (removed.keptForAudit.length > 0) {
    console.warn(`Kayıt defterinde izi olduğu için silinmeyen hesaplar: ${removed.keptForAudit.join(", ")}`);
  }
  // Çerez dosyası artık geçersiz; yanlışlıkla yeniden kullanılmasın.
  await rm("tests/load/.data/users.json", { force: true });
} finally {
  await db.$disconnect();
}
