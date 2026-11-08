// Başlangıç verisi: siber şehrin beş mahallesi, depodaki odalar (labs/rooms/) ve örnek lablar
// (labs/examples/). Tekrar çalıştırmak güvenlidir. Var olan mahalleye ve örnek laba dokunulmaz: ad,
// renk ve örnek lab içeriği yönetim panelinden değiştirilebildiği için sonraki çalıştırmalar o
// değişikliklerin üzerine yazmaz; silinmiş bir örnek lab ise yeniden eklenir. Depodaki oda ise
// dosyası değişince güncellenir (kurallar prisma/rooms.ts'te).
// Çalıştırma: npm run db:seed (Node 22 TypeScript'i doğrudan çalıştırır). Yayında migration
// imajı her yüklemede çalıştırır (docker/Dockerfile).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { createRoom, readRooms, roomsDir, syncRooms } from "./rooms.ts";
import type { RoomFile } from "./rooms.ts";

// Renk ve ikon adları tema değişkenlerine ve ikon listesine karşılık gelir (sabit renk kodu yok).
const neighborhoods = [
  { slug: "hesap-kalesi", name: "Hesap Kalesi", topic: "Hesap güvenliği", color: "success", icon: "castle", sortOrder: 1 },
  { slug: "oltalama-limani", name: "Oltalama Limanı", topic: "Oltalama", color: "accent", icon: "mail", sortOrder: 2 },
  { slug: "yazilim-ormani", name: "Yazılım Ormanı", topic: "Zararlı yazılım", color: "purple", icon: "download", sortOrder: 3 },
  { slug: "para-carsisi", name: "Para Çarşısı", topic: "Kişisel veri ve para", color: "warning", icon: "card", sortOrder: 4 },
  // 15 Ekim (Murat): siber zorbalık, internetten tanışılan yabancı, fotoğrafla şantaj, dijital iyi oluş.
  { slug: "dostluk-parki", name: "Dostluk Parkı", topic: "Güvenli iletişim", color: "pink", icon: "heart", sortOrder: 5 },
];

const examplesDir = path.join(import.meta.dirname, "..", "labs", "examples");

async function readExamples(): Promise<RoomFile[]> {
  const files = (await readdir(examplesDir)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(examplesDir, f), "utf8")) as RoomFile));
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  for (const neighborhood of neighborhoods) {
    await db.neighborhood.upsert({
      where: { slug: neighborhood.slug },
      update: {},
      create: neighborhood,
    });
  }
  console.log(`${neighborhoods.length} mahalle hazır.`);

  // Testler başka bir klasör verebilir (tests/e2e/room-files.spec.ts).
  const rooms = await syncRooms(db, await readRooms(process.env.ROOMS_DIR ?? roomsDir));
  console.log(
    `Oda dosyaları: ${rooms.created} eklendi, ${rooms.updated} güncellendi (${rooms.versions} yeni sürüm), ` +
      `${rooms.unchanged} değişmedi, ${rooms.skipped} atlandı.`,
  );

  let added = 0;
  for (const example of await readExamples()) {
    if (await db.lab.findUnique({ where: { slug: example.slug }, select: { id: true } })) continue;
    const neighborhood = await db.neighborhood.findUnique({ where: { slug: example.neighborhood }, select: { id: true } });
    if (!neighborhood) {
      console.error(`Örnek lab atlandı (${example.slug}): mahalle yok.`);
      continue;
    }
    await createRoom(db, example, neighborhood.id, null);
    added++;
  }
  console.log(`Örnek lablar: ${added} eklendi.`);
} finally {
  await db.$disconnect();
}
