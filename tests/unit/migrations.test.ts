import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Yayın betiği (docker/server/deploy.sh) düşen bir migration'ı "geri alındı" diye işaretleyip
// önceki sürüme döner; bunun güvenli olması, PostgreSQL'in migration dosyasını tek bir örtük
// işlemde çalıştırmasına dayanır: dosya hata verirse hiçbir değişikliği kalmaz. Betik şemanın
// parmak iziyle bunu denetler, ama parmak izi veriyi görmez: kendi içinde COMMIT olan bir
// migration'ın COMMIT'ten önceki veri değişikliği (UPDATE, DELETE) kalıcı olur ve migration yeniden
// uygulanınca ikinci kez çalışırdı. Bu yüzden migration dosyalarında işlemi bölen komut olmaz
// (güvenlik turu 5).

const migrationsDir = "prisma/migrations";
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ name: entry.name, sql: readFileSync(join(migrationsDir, entry.name, "migration.sql"), "utf8") }));

/**
 * Yalnızca komutlar: yorumlar, metinler, tırnaklı adlar ve $$ gövdeleri (PL/pgSQL'in BEGIN ... END'i
 * işlem değildir) boşlukla değiştirilir.
 */
function statementsOnly(sql: string) {
  let out = "";
  let i = 0;
  const skipTo = (end: number, length: number) => {
    i = end < 0 ? sql.length : end + length;
    out += " ";
  };
  while (i < sql.length) {
    const dollar = /^\$([A-Za-z_]*)\$/.exec(sql.slice(i, i + 64));
    if (sql.startsWith("--", i)) skipTo(sql.indexOf("\n", i), 0);
    else if (sql.startsWith("/*", i)) skipTo(sql.indexOf("*/", i + 2), 2);
    else if (dollar) skipTo(sql.indexOf(dollar[0], i + dollar[0].length), dollar[0].length);
    else if (sql[i] === "'" || sql[i] === '"') {
      // Kapanan tırnak; içerideki çift tırnak ('') kaçıştır.
      const quote = sql[i];
      let end = i + 1;
      while (end < sql.length && !(sql[end] === quote && sql[end + 1] !== quote)) end += sql[end] === quote ? 2 : 1;
      skipTo(end, 1);
    } else out += sql[i++];
  }
  return out;
}

/** Bir işlemin içinde çalışamayan ya da işlemi bölen komutlar. */
const splitsTransaction =
  /\b(BEGIN|COMMIT|ROLLBACK|END|ABORT|START\s+TRANSACTION|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION|CONCURRENTLY|VACUUM|CREATE\s+DATABASE|DROP\s+DATABASE|ALTER\s+SYSTEM|CREATE\s+TABLESPACE)\b/i;

describe("migration dosyaları tek işlemde çalışır (yayında geri dönüş, güvenlik turu 5)", () => {
  it("denetim işlemi bölen komutu bulur; $$ gövdesi, yorum, metin ve tırnaklı ad içindekini saymaz", () => {
    expect(statementsOnly("CREATE TABLE a (id int);\nCOMMIT;\nALTER TABLE a ADD b int;")).toMatch(splitsTransaction);
    expect(statementsOnly('CREATE INDEX CONCURRENTLY "i" ON "a"("b");')).toMatch(splitsTransaction);
    expect(statementsOnly("-- migration'ı\nUPDATE a SET b = 'x';\nbegin;")).toMatch(splitsTransaction);
    expect(
      statementsOnly(
        "-- COMMIT değil, migration'ı bölmez\nDO $$\nBEGIN\n  RAISE NOTICE 'it''s COMMIT';\nEND $$;\n" +
          'SELECT \'ROLLBACK\', $x$ BEGIN $x$, "END" FROM t;\n/* END */',
      ),
    ).not.toMatch(splitsTransaction);
  });

  it.each(migrations)("$name", ({ sql }) => {
    expect(statementsOnly(sql)).not.toMatch(splitsTransaction);
  });
});
