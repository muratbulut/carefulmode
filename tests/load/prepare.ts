// Yük testi hazırlığı: hesaplar, sınıflar, örnek içerik ve oturum çerezleri.
//
//   DATABASE_URL=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=http://localhost:3205 \
//     node tests/load/prepare.ts [--students 100] [--teachers 4] [--out tests/load/.data/users.json]
//
// Yalnızca bu makinedeki veritabanında çalışır (safety.ts checkLocalDatabase). Önce eski
// yük testi verisini siler (cleanup.ts ile aynı), sonra:
// - N öğrenci (e-postası doğrulanmış, mahallelerin eğitim labları bitmiş: senaryo labları açık),
// - birkaç öğretmen, her birinin sınıfı ve açık ödevi (öğrenciler sınıflara sırayla dağılır),
//   ayrıca okul-IP denemesi için boş bir sınıf,
// - bir yönetici (rol ADMIN),
// - gündemde yayında birkaç haber ve havuzda birkaç ipucu (yerel veritabanı boşsa sayfalar
//   gerçekte olduğundan hafif kalmasın diye).
// Oturumlar uygulamanın kendisi gibi Better Auth ile sunucu tarafında açılır (giriş eylemi IP
// başına sınırlı olduğu için 100 giriş tek IP'den formla yapılamaz). Çerezler k6'ya bir JSON
// dosyasıyla verilir; bu dosya depoya girmez (.gitignore: tests/load/.data/).
//
// Oturum imzası (BETTER_AUTH_SECRET) ve adres (BETTER_AUTH_URL) uygulamanınkiyle aynı olmalı:
// çerezin adı adresten (HTTPS ise "__Secure-"), imzası gizli anahtardan gelir.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { hashPassword } from "better-auth/crypto";
import { assertLocalDatabase, connect, deleteLoadData, loadEmailDomain, loadSlugPrefix, type Db } from "./accounts.ts";
import { newLoadPassword } from "./safety.ts";

const { values: args } = parseArgs({
  options: {
    students: { type: "string", default: "100" },
    teachers: { type: "string", default: "4" },
    out: { type: "string", default: "tests/load/.data/users.json" },
  },
});

const studentCount = Number.parseInt(args.students, 10);
const teacherCount = Number.parseInt(args.teachers, 10);
if (!(studentCount > 0 && teacherCount > 0)) {
  console.error("--students ve --teachers pozitif sayı olmalı.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const where = assertLocalDatabase(databaseUrl);
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;
if (!secret || !baseURL) {
  console.error("BETTER_AUTH_SECRET ve BETTER_AUTH_URL uygulamanınkiyle aynı verilmeli.");
  process.exit(1);
}

/** Yük hesaplarının bu koşuya özel ortak şifresi (users.json'da; elle girip bakmak için). */
const password = newLoadPassword();
const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function joinCode(index: number) {
  // Rastgele değil: aynı koşu tekrarlanınca aynı kodlar gelir. "Y" ile başlar, sayıdan üretilir.
  let n = index + 1;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = joinCodeAlphabet[n % joinCodeAlphabet.length] + code;
    n = Math.floor(n / joinCodeAlphabet.length);
  }
  return `Y${code}`;
}

const email = (role: string, n: number) => `${role}-${String(n).padStart(3, "0")}@${loadEmailDomain}`;

type Role = "STUDENT" | "TEACHER" | "ADMIN";
type Created = { id: string; email: string; role: Role };

async function createUsers(db: Db, role: Role, count: number, passwordHash: string): Promise<Created[]> {
  const label = role.toLowerCase();
  const rows = Array.from({ length: count }, (_, i) => ({
    email: email(label, i + 1),
    displayName: role === "STUDENT" ? `Yük Öğrenci ${i + 1}` : role === "TEACHER" ? `Yük Öğretmen ${i + 1}` : "Yük Yönetici",
    role,
    emailVerified: true,
    birthYear: role === "STUDENT" ? 2011 + (i % 4) : 1985,
    kvkkConsentAt: new Date(),
  }));
  await db.user.createMany({ data: rows });
  const users = await db.user.findMany({ where: { email: { in: rows.map((r) => r.email) } }, select: { id: true, email: true, role: true }, orderBy: { email: "asc" } });
  // Better Auth'un e-posta + şifre hesabı (Account, providerId "credential").
  await db.account.createMany({ data: users.map((u) => ({ userId: u.id, accountId: u.id, providerId: "credential", password: passwordHash })) });
  return users as Created[];
}

const newsBody = (n: number) => ({
  whatsHappening:
    `Yük testi haberi ${n}. Son günlerde öğrencilere kargo, oyun ve sosyal medya kılığında sahte mesajlar geliyor. ` +
    "Mesajlar acele ettiriyor ve bir bağlantıya tıklamanı istiyor.",
  example: { sender: "Kargo Takip", text: "Paketiniz teslim edilemedi, 24 saat içinde adresinizi güncelleyin." },
  signs: [
    { sign: "Acele ettiriyor", explanation: "\"24 saat içinde\" gibi cümleler düşünmeni engellemek içindir." },
    { sign: "Tanımadığın adres", explanation: "Gönderen adresinin @ işaretinden sonrasına bak." },
    { sign: "Bağlantı istiyor", explanation: "Bilgi güncellemek için bağlantı gönderen firmaya şüpheyle bak." },
  ],
  actions: ["Bağlantıya tıklama, uygulamayı kendin aç.", "Şüphelendiğin mesajı bir büyüğüne göster."],
  takeaways: ["Acele = şüphe", "Adrese bak", "Bağlantıya değil uygulamaya güven"],
});

async function createContent(db: Db, adminId: string) {
  const neighborhoods = await db.neighborhood.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const now = Date.now();
  const articles = Array.from({ length: 6 }, (_, i) => ({
    slug: `${loadSlugPrefix}haber-${i + 1}`,
    title: `Yük testi haberi ${i + 1}: sahte kargo mesajları`,
    summary: "Yük testi için yazılmış örnek haber. Sahte kargo mesajları öğrencileri hedef alıyor.",
    content: newsBody(i + 1),
    sourceName: "Örnek Kaynak",
    sourceUrl: "https://ornek.invalid/haber",
    neighborhoodId: neighborhoods[i % Math.max(1, neighborhoods.length)]?.id ?? null,
    status: "PUBLISHED" as const,
    publishedAt: new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000),
    authorId: adminId,
  }));
  await db.newsArticle.createMany({ data: articles });
  await db.dailyTip.createMany({
    data: Array.from({ length: 3 }, (_, i) => ({
      text: `[yük testi] Şifreni kimseyle paylaşma, en yakın arkadaşınla bile (${i + 1}).`,
      reason: "Paylaşılan şifre artık senin kontrolünde değildir; arkadaşının telefonu çalınabilir.",
      status: "POOL" as const,
      neighborhoodId: neighborhoods[0]?.id ?? null,
      authorId: adminId,
    })),
  });
  return articles.map((a) => a.slug);
}

/** Better Auth'un uygulamadaki ayarlarından oturum açmak için gerekenler (lib/auth.ts ile aynı). */
function createAuth(db: Db) {
  return betterAuth({
    baseURL,
    secret,
    database: prismaAdapter(db, { provider: "postgresql" }),
    user: { fields: { name: "displayName", image: "avatar" } },
    session: { expiresIn: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    rateLimit: { enabled: false },
    advanced: { database: { generateId: false } },
  });
}

/** Set-Cookie başlığından oturum çerezini ("ad=değer") ayıklar. */
function sessionCookie(setCookie: string | null) {
  const match = /((?:__Secure-)?better-auth\.session_token)=([^;]+)/.exec(setCookie ?? "");
  if (!match) throw new Error("Better Auth oturum çerezi vermedi");
  return { name: match[1], value: match[2] };
}

const db = connect(databaseUrl!);
try {
  console.log(`Veritabanı: ${where}`);
  const removed = await deleteLoadData(db);
  if (removed.users > 0) console.log(`Eski yük testi verisi silindi: ${removed.users} hesap, ${removed.attempts} deneme.`);

  const passwordHash = await hashPassword(password);
  const students = await createUsers(db, "STUDENT", studentCount, passwordHash);
  const teachers = await createUsers(db, "TEACHER", teacherCount, passwordHash);
  const [admin] = await createUsers(db, "ADMIN", 1, passwordHash);

  // Mahallelerin eğitim labları bitmiş sayılır: senaryo labları açılır (Tur 2 kilit kuralı).
  const labs = await db.lab.findMany({
    where: { status: "PUBLISHED", publishedVersion: { not: null } },
    select: { id: true, slug: true, type: true, template: true, neighborhood: { select: { slug: true, sortOrder: true } } },
    orderBy: [{ neighborhood: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const trainings = labs.filter((l) => l.type === "TRAINING");
  await db.trainingProgress.createMany({
    data: students.flatMap((s) => trainings.map((l) => ({ userId: s.id, labId: l.id, cardIndex: 99, completedAt: new Date() }))),
  });

  // Her öğretmenin bir sınıfı ve açık ödevi; öğrenciler sınıflara sırayla dağılır.
  const assignmentNeighborhood = labs.find((l) => l.type === "SCENARIO")?.neighborhood.slug;
  const neighborhood = assignmentNeighborhood ? await db.neighborhood.findUnique({ where: { slug: assignmentNeighborhood }, select: { id: true } }) : null;
  const classrooms: { id: string; teacherIndex: number; joinCode: string; members: number }[] = [];
  for (const [i, teacher] of teachers.entries()) {
    const room = await db.classroom.create({
      data: {
        name: `Yük ${i + 1}-A`,
        level: "7. sınıf",
        teacherId: teacher.id,
        joinCode: joinCode(i),
        assignments: neighborhood ? { create: { neighborhoodId: neighborhood.id, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } : undefined,
      },
      select: { id: true, joinCode: true },
    });
    classrooms.push({ id: room.id, teacherIndex: i, joinCode: room.joinCode, members: 0 });
  }
  await db.classroomMembership.createMany({
    data: students.map((s, i) => {
      const room = classrooms[i % classrooms.length];
      room.members++;
      return { classroomId: room.id, userId: s.id };
    }),
  });
  // Okul-IP denemesinin (school-ip.js) katılacağı boş sınıf.
  const schoolRoom = await db.classroom.create({
    data: { name: "Yük okul-IP", level: "7. sınıf", teacherId: teachers[0].id, joinCode: joinCode(teachers.length) },
    select: { id: true, joinCode: true },
  });

  const news = await createContent(db, admin.id);

  // Oturumlar: uygulamanın kendi yolu (Better Auth, e-posta + şifre), sunucu tarafında.
  const auth = createAuth(db);
  const everyone = [...students, ...teachers, admin];
  const sessions = new Map<string, { name: string; value: string }>();
  const started = Date.now();
  for (const user of everyone) {
    const { headers } = await auth.api.signInEmail({ body: { email: user.email, password, rememberMe: true }, returnHeaders: true });
    sessions.set(user.id, sessionCookie(headers.get("set-cookie")));
  }
  console.log(`${everyone.length} oturum açıldı (${((Date.now() - started) / 1000).toFixed(1)} sn).`);

  // k6'nın olay gönderebilmesi için yayındaki sürümün öğe ve görev kimlikleri. Sahte/gerçek bilgisi
  // yalnızca yük üretecinin "bazı öğrenciler tuzağa düşer" karışımı içindir; tarayıcıya gitmez.
  const publishedContent = async (labId: string) => {
    const row = await db.lab.findUnique({ where: { id: labId }, select: { publishedVersion: true } });
    const version = await db.labVersion.findUnique({ where: { labId_version: { labId, version: row!.publishedVersion! } }, select: { content: true } });
    return version?.content;
  };
  const trainingViews = [];
  for (const lab of trainings) {
    const content = (await publishedContent(lab.id)) as { cards?: { id: string; type: string; options?: unknown[]; question?: { options?: unknown[] } | null }[] } | null;
    const cards = (content?.cards ?? []).map((c) => ({ id: c.id, options: (c.type === "quiz" ? c.options?.length : c.type === "video" ? c.question?.options?.length : 0) ?? 0 }));
    trainingViews.push({ slug: lab.slug, neighborhood: lab.neighborhood.slug, cards });
  }
  const scenarioLabs = labs.filter((l) => l.type === "SCENARIO" && (l.template === "INBOX" || l.template === "MESSAGING"));
  const scenarios = [];
  for (const lab of scenarioLabs) {
    const content = (await publishedContent(lab.id)) as {
      items?: { id: string; kind: string; link: unknown; attachment: unknown }[];
      tasks?: { id: string; type: string; options?: unknown[] }[];
      trap?: { secret?: string };
    } | null;
    scenarios.push({
      slug: lab.slug,
      template: lab.template,
      neighborhood: lab.neighborhood.slug,
      items: (content?.items ?? []).map((i) => ({ id: i.id, fake: i.kind === "fake", link: !!i.link, attachment: !!i.attachment })),
      tasks: (content?.tasks ?? []).map((t) => ({ id: t.id, type: t.type, options: t.options?.length ?? 0 })),
      secret: !!content?.trap?.secret?.trim(),
    });
  }
  const out = {
    createdAt: new Date().toISOString(),
    baseUrl: baseURL,
    cookieName: sessions.get(admin.id)!.name,
    password,
    labs: {
      scenario: scenarios,
      training: trainingViews,
    },
    neighborhoods: [...new Set(labs.map((l) => l.neighborhood.slug))],
    news,
    schoolClass: { joinCode: schoolRoom.joinCode },
    students: students.map((s, i) => ({ email: s.email, cookie: sessions.get(s.id)!.value, classroom: classrooms[i % classrooms.length].id })),
    teachers: teachers.map((t, i) => ({ email: t.email, cookie: sessions.get(t.id)!.value, classrooms: classrooms.filter((c) => c.teacherIndex === i).map((c) => c.id) })),
    admins: [{ email: admin.email, cookie: sessions.get(admin.id)!.value }],
  };
  const file = path.resolve(args.out);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log(
    `Hazır: ${students.length} öğrenci, ${teachers.length} öğretmen (${classrooms.length} sınıf + okul-IP sınıfı ${schoolRoom.joinCode}), 1 yönetici, ` +
      `${news.length} haber, ${scenarioLabs.length} senaryo labı. Çerezler: ${path.relative(process.cwd(), file)}`,
  );
  if (scenarioLabs.length === 0) console.warn("Uyarı: yayında senaryo labı yok; öğrenciler lab oynayamaz (npm run db:seed).");
} finally {
  await db.$disconnect();
}
