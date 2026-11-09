// Örnek verinin (demo) içeriği: okullar, öğretmenler, öğrenciler, talepler, sınıflar, lab
// ilerlemesi, günün ipuçları ve gündem haberleri. Ekleyip silen betik prisma/demo.ts'dir; bu dosya
// yalnızca veridir ve saf fonksiyonlardır (veritabanı yok).
//
// Neden burada ve lib/ değil: betik migration imajında çalışır (docker/Dockerfile, migrate). O
// imajda yalnızca prisma/, labs/ ve üretilmiş Prisma istemcisi vardır; lib/'deki kod ("@/"
// adresleri, uzantısız içe aktarmalar) orada çalışmaz. Bu yüzden burada lib/'e hiç bağlanılmaz;
// uygulamanın kurallarıyla (puanlama, okul adı, sınıf kodu, ipucu ve haber sınırları, şifre biçimi)
// tutarlılığı birim testi denetler: tests/unit/demo-data.test.ts.
//
// Kurallar:
// - Bütün örnek satırların kimliği "demo-" ile başlar. Uygulamanın ürettiği kimlikler cuid'dir,
//   "demo-" ile başlamaz; silme yalnızca bu öneke bakar (e-postaya değil: herkes ornek.invalid
//   adresiyle kayıt olabilir, ama kimliğini seçemez).
// - E-postalar ornek.invalid alan adındadır (RFC 2606: hiçbir zaman teslim edilemez); canlı site
//   bu adreslere mail göndermez (lib/mail).
// - Kişiler, okullar ve haberler kurgusaldır. Haber başlıkları "Örnek:" ile başlar. Gerçek marka adı
//   yoktur (lab kuralı).
// - Kayıt defterine hiçbir şey yazılmaz: kayıt defteri silinmez, örnek veri ise silinebilir olmalı.
// - Tarihler betiğin çalıştığı ana göre hesaplanır (ör. "12 gün önce"); her eklemede tazelenir.

import { randomBytes, scrypt } from "node:crypto";
import { deflateSync } from "node:zlib";

export const demoIdPrefix = "demo-";
export const demoEmailDomain = "ornek.invalid";
/** Giriş yapılabilen örnek hesapların şifresi (DEMO_PASSWORD) için alt ve üst sınır. */
export const demoPasswordLimits = { min: 12, max: 128 } as const;

export const demoId = (kind: string, key: string) => `${demoIdPrefix}${kind}-${key}`;
export const isDemoId = (id: string) => id.startsWith(demoIdPrefix);

// ---------------------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** Tekrarlanabilir rastgele sayılar (mulberry32): her eklemede aynı dağılım. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const turkishAscii: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** "Elif Nur Şen" -> "elif.nur.sen" (e-posta için). */
export function emailSlug(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) => turkishAscii[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** Türkiye takvim günü ("2026-10-12"); günün ipucu tabloları bu günle tutulur (UTC+3). */
export function turkeyDayKey(date: Date): string {
  return new Date(date.getTime() + 3 * HOUR).toISOString().slice(0, 10);
}

export const dayKeyToDate = (key: string) => new Date(`${key}T00:00:00.000Z`);

/** Better Auth'un şifre biçimi (@better-auth/utils/password): scrypt, "tuz:anahtar" (hex). */
export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const N = 16384;
  const r = 16;
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p: 1, maxmem: 128 * N * r * 2 }, (error, key) => {
      if (error) reject(error);
      else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

/** Okul adının karşılaştırma anahtarı (lib/school/names.ts schoolNameKey ile aynı). */
export const nameKeyOf = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

/** Sınıf kodu (lib/classroom/rules.ts ile aynı): 0/O ve 1/I gibi karışan karakterler yok. */
export const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const joinCodeLength = 6;

/** Ödevin son günü: o günün sonu, Türkiye saatiyle 23.59 (lib/classroom/teacher-rules.ts parseDueDate). */
export function dueDateIn(now: Date, days: number): Date {
  const day = Date.parse(`${turkeyDayKey(new Date(now.getTime() + days * DAY))}T00:00:00Z`);
  return new Date(day + DAY - 3 * HOUR - 1);
}

// ---------------------------------------------------------------------------------------
// Okullar ve öğretmenler
// ---------------------------------------------------------------------------------------

export type DemoSchool = { key: string; name: string; province: string; district: string; createdDaysAgo: number };

export const demoSchools: DemoSchool[] = [
  { key: "ortaokul", name: "Örnek Ortaokulu", province: "İzmir", district: "Bornova", createdDaysAgo: 31 },
  { key: "lise", name: "Örnek Anadolu Lisesi", province: "İzmir", district: "Bornova", createdDaysAgo: 16 },
];

/** Okul sorumlusu (Okulum): onay okul sorumlusunda (coordinatorApproves). */
export const demoCoordinator = { school: "ortaokul", teacher: "sorumlu" } as const;

/**
 * Giriş yapılabilen hesaplar (hoca sunumu, Murat'ın isteği 1 Kasım): üç öğrenci, öğretmen, okul
 * sorumlusu ve yönetici; şifreleri DEMO_PASSWORD. E-postaları `<anahtar>@ornek.invalid`. Diğer
 * örnek hesapların şifresi yoktur.
 */
export const demoLogins = ["ogrenci", "ogrenci2", "ogrenci3", "ogretmen", "sorumlu", "yonetici"] as const;
const isDemoLogin = (key: string) => (demoLogins as readonly string[]).includes(key);

/**
 * Örnek yönetici (rol ADMIN): sunumda yönetim panelini göstermek için. Örnek okulları, ipuçlarını ve
 * haberleri yine ilk gerçek yönetici eklemiş görünür. Silinince (demo-data-remove) kayıt defterinde
 * izi varsa askıya alınır ve rolü STUDENT olur, yoksa silinir.
 */
export const demoAdmin = { key: "yonetici", name: "Örnek Yönetici", email: `yonetici@${demoEmailDomain}`, birthYear: 1987, avatar: "owl" } as const;

export type DemoTeacher = {
  key: string;
  name: string;
  email: string;
  school: string;
  subject: string;
  birthYear: number;
  avatar: string;
  /** Talebin onaylandığı gün. Karar maili yalnızca son 7 gündeki kararlar için gönderilir
   * (lib/teacher/decision-rules.ts mailRetryMs); örnek kararlar daha eskidir, mail kuyruğuna girmez. */
  approvedDaysAgo: number;
  /** Talebi kim onayladı: okul sorumlusu ya da yönetim (ilk yönetici). */
  approvedBy: "coordinator" | "admin";
};

export const demoTeachers: DemoTeacher[] = [
  { key: "sorumlu", name: "Örnek Sorumlu", email: `sorumlu@${demoEmailDomain}`, school: "ortaokul", subject: "Matematik", birthYear: 1979, avatar: "owl", approvedDaysAgo: 30, approvedBy: "admin" },
  { key: "ogretmen", name: "Örnek Öğretmen", email: `ogretmen@${demoEmailDomain}`, school: "ortaokul", subject: "Bilişim Teknolojileri", birthYear: 1988, avatar: "robot", approvedDaysAgo: 27, approvedBy: "coordinator" },
  { key: "selin", name: "Selin Aksoy", email: `selin.aksoy@${demoEmailDomain}`, school: "ortaokul", subject: "Türkçe", birthYear: 1991, avatar: "fox", approvedDaysAgo: 19, approvedBy: "coordinator" },
  { key: "burak", name: "Burak Demir", email: `burak.demir@${demoEmailDomain}`, school: "ortaokul", subject: "Sosyal Bilgiler", birthYear: 1985, avatar: "lion", approvedDaysAgo: 9, approvedBy: "coordinator" },
  { key: "elif", name: "Elif Kaya", email: `elif.kaya@${demoEmailDomain}`, school: "lise", subject: "Bilgisayar Bilimi", birthYear: 1990, avatar: "penguin", approvedDaysAgo: 15, approvedBy: "admin" },
];

// ---------------------------------------------------------------------------------------
// Bekleyen ve sonuçlanmış talepler (başvuranlar henüz öğretmen değil: öğrenci rolünde)
// ---------------------------------------------------------------------------------------

export type DemoApplicant = {
  key: string;
  name: string;
  birthYear: number;
  avatar: string;
  createdDaysAgo: number;
  application: {
    status: "PENDING" | "INFO_REQUESTED" | "REJECTED";
    /** Listedeki okul ya da "okulum listede yok" (yeni okul adı). */
    school: { listed: string } | { newName: string; province: string; district: string };
    subject: string;
    institutionalEmail: string | null;
    /** Talebin gönderildiği an (saat önce). */
    sentHoursAgo: number;
    document: { kind: "pdf" | "png"; name: string } | null;
    question?: { text: string; daysAgo: number };
    rejection?: { note: string; daysAgo: number; documentName: string; documentSize: number };
  };
};

export const demoApplicants: DemoApplicant[] = [
  {
    key: "can",
    name: "Can Yıldız",
    birthYear: 1992,
    avatar: "tiger",
    createdDaysAgo: 3,
    application: {
      status: "PENDING",
      school: { listed: "ortaokul" },
      subject: "Fen Bilimleri",
      institutionalEmail: `can.yildiz@okul.${demoEmailDomain}`,
      sentHoursAgo: 50,
      document: { kind: "pdf", name: "gorev-yeri-belgesi.pdf" },
    },
  },
  {
    key: "zeynep",
    name: "Zeynep Arslan",
    birthYear: 1994,
    avatar: "koala",
    createdDaysAgo: 1,
    application: {
      status: "PENDING",
      school: { newName: "Örnek Fen Lisesi", province: "İzmir", district: "Karşıyaka" },
      subject: "Fizik",
      institutionalEmail: null,
      sentHoursAgo: 6,
      document: { kind: "png", name: "ogretmen-kimligi.png" },
    },
  },
  {
    key: "mert",
    name: "Mert Çelik",
    birthYear: 1987,
    avatar: "frog",
    createdDaysAgo: 12,
    application: {
      status: "INFO_REQUESTED",
      school: { listed: "lise" },
      subject: "Matematik",
      institutionalEmail: null,
      sentHoursAgo: 11 * 24,
      document: { kind: "pdf", name: "belge.pdf" },
      question: { text: "Belgende okul adı okunmuyor. Okulunun adının göründüğü bir görev yeri belgesi ekler misin?", daysAgo: 8 },
    },
  },
  {
    key: "deniz",
    name: "Deniz Şahin",
    birthYear: 1996,
    avatar: "octopus",
    createdDaysAgo: 16,
    application: {
      status: "REJECTED",
      school: { listed: "ortaokul" },
      subject: "Beden Eğitimi",
      institutionalEmail: null,
      sentHoursAgo: 15 * 24,
      document: null,
      rejection: {
        note: "Belgedeki okul bu okul değil. Bu okulda çalışıyorsan okulunun verdiği belgeyle yeniden başvurabilirsin.",
        daysAgo: 12,
        documentName: "belge.jpg",
        documentSize: 184_320,
      },
    },
  },
];

// ---------------------------------------------------------------------------------------
// Lab ilerlemesi: eğitim (oltalama-egitimi) ve senaryo (sahte-kargo-maili)
// ---------------------------------------------------------------------------------------

export const trainingSlug = "oltalama-egitimi";
export const scenarioSlug = "sahte-kargo-maili";
/** Ödevler bu mahalleye verilir (iki labı da yayında). */
export const assignmentNeighborhood = "oltalama-limani";

export type TrainingCard = { id: string; type: string; question?: unknown };

/** Eğitimdeki soru kartları ve sıraları: mini test ve sorulu video (lib/lab/training.ts quizOf). */
export function questionCards(cards: readonly TrainingCard[]): { id: string; index: number }[] {
  return cards.flatMap((card, index) => (card.type === "quiz" || (card.type === "video" && card.question) ? [{ id: card.id, index }] : []));
}

/** Senaryo olayları (lib/lab/events.ts; LabEvent.type + data). */
export type DemoEvent =
  | { type: "item_opened"; item: string }
  | { type: "item_moved"; item: string; to: "inbox" | "spam" | "trash" }
  | { type: "review_done" }
  | { type: "answer"; task: string; option: number }
  | { type: "link_clicked"; item: string }
  | { type: "info_entered"; item: string };

const open = (item: string): DemoEvent => ({ type: "item_opened", item });
const move = (item: string, to: "inbox" | "spam" | "trash"): DemoEvent => ({ type: "item_moved", item, to });
const answer = (task: string, option: number): DemoEvent => ({ type: "answer", task, option });
const review: DemoEvent = { type: "review_done" };

export type AttemptProfile = "perfect" | "deleted" | "falseAlarm" | "clickedReported" | "ignored" | "hacked";

/**
 * sahte-kargo-maili için örnek denemeler. Olaylar öğrencinin yapacağı sırayla; rapor puanlama
 * fonksiyonunun (lib/lab/scoring.ts scoreScenario) bu olaylardan çıkardığıdır. Birim testi raporları
 * labs/examples/sahte-kargo-maili.json içeriğiyle yeniden hesaplar; içerik değişirse test düşer.
 */
export const attemptProfiles: Record<AttemptProfile, { events: DemoEvent[]; status: "COMPLETED" | "HACKED"; report: unknown }> = {
  // Sahte maili linke dokunmadan bildirdi, soruların en iyi cevabı.
  perfect: {
    events: [open("okul"), open("kargo"), move("kargo", "spam"), open("market"), open("elif"), review, answer("okul-sorusu", 2), answer("market-sorusu", 1)],
    status: "COMPLETED",
    report: {
      status: "safe",
      title: "caught",
      score: 100,
      rows: [
        { type: "fake", item: "kargo", outcome: "reported", state: "ok", points: 4, max: 4 },
        { type: "real", item: "okul", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: 2, state: "ok", points: 2, max: 2 },
        { type: "question", task: "market-sorusu", option: 1, state: "ok", points: 1, max: 1 },
      ],
      tips: [],
      genericTips: 3,
      caught: true,
      compromise: null,
    },
  },
  // Sahte maili sildi (bildirmedi).
  deleted: {
    events: [open("kargo"), move("kargo", "trash"), open("okul"), open("market"), open("elif"), review, answer("okul-sorusu", 0), answer("market-sorusu", 1)],
    status: "COMPLETED",
    report: {
      status: "safe",
      title: "safeButMissed",
      score: 70,
      rows: [
        { type: "fake", item: "kargo", outcome: "deleted", state: "part", points: 2, max: 4 },
        { type: "real", item: "okul", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: 0, state: "part", points: 1, max: 2 },
        { type: "question", task: "market-sorusu", option: 1, state: "ok", points: 1, max: 1 },
      ],
      tips: [2],
      genericTips: 2,
      caught: false,
      compromise: null,
    },
  },
  // Sahteyi bildirdi ama gerçek okul duyurusunu da sahte sandı.
  falseAlarm: {
    events: [open("okul"), move("okul", "spam"), open("kargo"), move("kargo", "spam"), open("market"), review, answer("okul-sorusu", 1), answer("market-sorusu", 1)],
    status: "COMPLETED",
    report: {
      status: "safe",
      title: "safeButMissed",
      score: 70,
      rows: [
        { type: "fake", item: "kargo", outcome: "reported", state: "ok", points: 4, max: 4 },
        { type: "real", item: "okul", outcome: "reported", state: "bad", points: 0, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: 1, state: "bad", points: 0, max: 2 },
        { type: "question", task: "market-sorusu", option: 1, state: "ok", points: 1, max: 1 },
      ],
      tips: [3],
      genericTips: 2,
      caught: true,
      compromise: null,
    },
  },
  // Linke tıkladı, bilgi girmeden geri dönüp bildirdi.
  clickedReported: {
    events: [open("kargo"), { type: "link_clicked", item: "kargo" }, move("kargo", "spam"), open("okul"), open("market"), open("elif"), review, answer("okul-sorusu", 2), answer("market-sorusu", 0)],
    status: "COMPLETED",
    report: {
      status: "safe",
      title: "safeButMissed",
      score: 70,
      rows: [
        { type: "fake", item: "kargo", outcome: "reportedAfterEngaging", by: "link", state: "part", points: 2, max: 4 },
        { type: "real", item: "okul", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: 2, state: "ok", points: 2, max: 2 },
        { type: "question", task: "market-sorusu", option: 0, state: "bad", points: 0, max: 1 },
      ],
      tips: [0, 2],
      genericTips: 1,
      caught: false,
      compromise: null,
    },
  },
  // Sahte maile dokunmadı, gelen kutusunda bıraktı.
  ignored: {
    events: [open("market"), open("okul"), open("kargo"), open("elif"), review, answer("okul-sorusu", 0), answer("market-sorusu", 0)],
    status: "COMPLETED",
    report: {
      status: "risky",
      title: "missed",
      score: 50,
      rows: [
        { type: "fake", item: "kargo", outcome: "ignored", state: "part", points: 1, max: 4 },
        { type: "real", item: "okul", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: 0, state: "part", points: 1, max: 2 },
        { type: "question", task: "market-sorusu", option: 0, state: "bad", points: 0, max: 1 },
      ],
      tips: [2],
      genericTips: 2,
      caught: false,
      compromise: null,
    },
  },
  // Linke tıklayıp sahte sayfaya bilgi girdi: hacklendi (deneme o anda biter).
  hacked: {
    events: [open("okul"), open("kargo"), { type: "link_clicked", item: "kargo" }, { type: "info_entered", item: "kargo" }],
    status: "HACKED",
    report: {
      status: "hacked",
      title: "hacked",
      score: 30,
      rows: [
        { type: "fake", item: "kargo", outcome: "hacked", by: "link", state: "bad", points: 0, max: 4 },
        { type: "real", item: "okul", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "market", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "real", item: "elif", outcome: "kept", state: "ok", points: 1, max: 1 },
        { type: "question", task: "okul-sorusu", option: null, state: "skip", points: 0, max: 2 },
        { type: "question", task: "market-sorusu", option: null, state: "skip", points: 0, max: 1 },
      ],
      tips: [0, 1, 2],
      genericTips: 0,
      caught: false,
      compromise: "account",
    },
  },
};

/** Yarım kalan deneme (öğrenci şu an labda). */
export const inProgressEvents: DemoEvent[] = [open("okul"), open("kargo")];

/** Eğitim labında öğrencinin durumu: bitirdi, yarıda, hiç başlamadı. */
export type TrainingState = "done" | "half" | "none";

export type DemoStudent = {
  key: string;
  name: string;
  training: TrainingState;
  attempts?: AttemptProfile[];
  /** Senaryo labında yarım kalmış bir denemesi var. */
  inProgress?: boolean;
  /** Son denemesi bugün (yönetim özetindeki "bugün" sayıları boş kalmasın). */
  today?: boolean;
  theme?: "GRAY";
};

export type DemoClass = {
  key: string;
  name: string;
  level: string;
  teacher: string;
  createdDaysAgo: number;
  /** Ödev (oltalama-limani): son gün bugünden kaç gün sonra (eksi: geçmiş). null: ödev yok. */
  assignmentDueInDays: number | null;
  students: DemoStudent[];
};

export const demoClasses: DemoClass[] = [
  {
    key: "7a",
    name: "7-A",
    level: "7",
    teacher: "ogretmen",
    createdDaysAgo: 25,
    assignmentDueInDays: 5,
    students: [
      { key: "ogrenci", name: "Örnek Öğrenci", training: "done", attempts: ["hacked", "perfect"] },
      { key: "ayse", name: "Ayşe Yılmaz", training: "done", attempts: ["perfect"], today: true },
      { key: "mehmet", name: "Mehmet Kara", training: "done", attempts: ["hacked", "deleted"] },
      { key: "zehra", name: "Zehra Öztürk", training: "done", attempts: ["falseAlarm"], theme: "GRAY" },
      { key: "emir", name: "Emir Aydın", training: "done", attempts: ["clickedReported"] },
      { key: "defne", name: "Defne Koç", training: "done", attempts: ["perfect"] },
      { key: "yusuf", name: "Yusuf Polat", training: "done", attempts: ["ignored"] },
      { key: "elifnur", name: "Elif Nur Şen", training: "done", attempts: ["hacked"] },
      { key: "kerem", name: "Kerem Acar", training: "done" },
      { key: "ecrin", name: "Ecrin Yalçın", training: "done", attempts: ["deleted"] },
      { key: "ali", name: "Ali Kurt", training: "half" },
      { key: "nehir", name: "Nehir Doğan", training: "none" },
    ],
  },
  {
    key: "8b",
    name: "8-B",
    level: "8",
    teacher: "ogretmen",
    createdDaysAgo: 22,
    assignmentDueInDays: null,
    students: [
      { key: "eymen", name: "Eymen Taş", training: "done", attempts: ["perfect"] },
      { key: "asel", name: "Asel Güneş", training: "done", inProgress: true },
      { key: "omer", name: "Ömer Çınar", training: "half" },
      { key: "lina", name: "Lina Erdem", training: "done", attempts: ["hacked"] },
      { key: "mirac", name: "Miraç Keskin", training: "none" },
    ],
  },
  {
    key: "5a",
    name: "5-A",
    level: "5",
    teacher: "selin",
    createdDaysAgo: 16,
    assignmentDueInDays: 3,
    students: [
      { key: "alparslan", name: "Alparslan Uçar", training: "done", attempts: ["deleted"] },
      { key: "duru", name: "Duru Aksu", training: "done" },
      { key: "poyraz", name: "Poyraz Tekin", training: "half" },
      { key: "masal", name: "Masal Ercan", training: "none" },
      { key: "aras", name: "Aras Uysal", training: "half" },
      { key: "ikra", name: "İkra Bilgin", training: "none" },
    ],
  },
  {
    key: "10a",
    name: "10-A Bilişim",
    level: "10",
    teacher: "elif",
    createdDaysAgo: 13,
    assignmentDueInDays: -2,
    students: [
      { key: "ogrenci2", name: "Berat Özkan", training: "done", attempts: ["perfect"] },
      { key: "hiranur", name: "Hiranur Altun", training: "done", attempts: ["ignored", "perfect"] },
      { key: "kuzey", name: "Kuzey Turan", training: "done", attempts: ["hacked"] },
      { key: "melis", name: "Melis Aslan", training: "done", theme: "GRAY" },
      { key: "efe", name: "Efe Karaca", training: "half" },
      { key: "zumra", name: "Zümra Işık", training: "done", attempts: ["clickedReported"], today: true },
    ],
  },
  {
    key: "6c",
    name: "6-C",
    level: "6",
    teacher: "sorumlu",
    createdDaysAgo: 5,
    assignmentDueInDays: null,
    students: [
      { key: "goktug", name: "Göktuğ Avcı", training: "done" },
      { key: "ada", name: "Ada Sevim", training: "half" },
      { key: "ruzgar", name: "Rüzgar Coşkun", training: "none" },
    ],
  },
];

/** Hiçbir sınıfta olmayan öğrenciler (kendi başına kayıt olanlar). */
export const demoLoneStudents: (DemoStudent & { createdDaysAgo: number })[] = [
  { key: "sena", name: "Sena Ünal", training: "done", attempts: ["perfect"], today: true, createdDaysAgo: 6 },
  { key: "ogrenci3", name: "Batuhan Yavuz", training: "none", createdDaysAgo: 2 },
];

/** Düzeyin doğum yılı ve kademesi (kayıt formundaki listeden). */
export function studentProfile(level: string, now: Date): { birthYear: number; gradeLevel: string } {
  const grade = level === "mixed" ? 7 : Number(level);
  return { birthYear: now.getFullYear() - (grade + 6), gradeLevel: grade <= 8 ? "Ortaokul" : "Lise" };
}

export const studentAvatars = ["fox", "panda", "owl", "tiger", "frog", "octopus", "lion", "koala", "penguin", "robot", "alien", "dragon"] as const;

/** Öğrencinin e-postası; giriş yapılabilen örnek öğrencilerinki kısa (ogrenci, ogrenci2, ogrenci3). */
export const studentEmail = (student: { key: string; name: string }) =>
  isDemoLogin(student.key) ? `${student.key}@${demoEmailDomain}` : `${emailSlug(student.name)}@${demoEmailDomain}`;

export type Timeline = {
  createdAt: Date;
  joinedAt: Date;
  training: { updatedAt: Date; completedAt: Date | null; cardFraction: number } | null;
  attempts: { profile: AttemptProfile; startedAt: Date; eventGapsSec: number[]; endedAt: Date }[];
  inProgress: { startedAt: Date; eventGapsSec: number[] } | null;
  lastActiveAt: Date;
};

/**
 * Öğrencinin zaman çizelgesi: kayıt, sınıfa katılma, eğitim, denemeler. Hepsi "şimdi"den önce ve
 * sıralı (kayıt < katılma < eğitim < denemeler). Rastgelelik tohumludur: her eklemede aynı dağılım.
 */
export function studentTimeline(student: DemoStudent, classCreatedAt: Date, seed: number, now: Date): Timeline {
  const random = seededRandom(seed);
  const between = (from: number, to: number) => from + random() * (to - from);
  const createdAt = new Date(classCreatedAt.getTime() + between(1, 20) * HOUR);
  const joinedAt = new Date(createdAt.getTime() + between(2, 15) * MINUTE);
  const trainingAt = Math.min(joinedAt.getTime() + between(4, 30) * HOUR, now.getTime() - 8 * HOUR);

  let training: Timeline["training"] = null;
  if (student.training !== "none") {
    const done = student.training === "done";
    const at = new Date(trainingAt);
    training = { updatedAt: at, completedAt: done ? at : null, cardFraction: done ? 1 : 0.5 };
  }

  // Denemeler eğitimle "6 saat önce" arasına eşit aralıklarla (biraz kaydırılarak) dağılır; "bugün"
  // işaretli öğrencinin son denemesi son birkaç saattedir.
  const profiles = student.attempts ?? [];
  const spanEnd = now.getTime() - 6 * HOUR;
  const slot = (spanEnd - trainingAt) / (profiles.length + 1);
  const attempts: Timeline["attempts"] = profiles.map((profile, index) => {
    const isLast = index === profiles.length - 1;
    const startMs = student.today && isLast ? now.getTime() - between(1.5, 5) * HOUR : trainingAt + slot * (index + 1) + between(-0.2, 0.2) * slot;
    const startedAt = new Date(startMs);
    const eventGapsSec = attemptProfiles[profile].events.map(() => Math.round(between(8, 70)));
    const endedAt = new Date(startMs + (eventGapsSec.reduce((a, b) => a + b, 0) + 15) * 1000);
    return { profile, startedAt, eventGapsSec, endedAt };
  });

  const inProgress = student.inProgress
    ? { startedAt: new Date(now.getTime() - between(10, 35) * MINUTE), eventGapsSec: inProgressEvents.map(() => Math.round(between(10, 40))) }
    : null;

  const moments = [joinedAt.getTime(), training?.updatedAt.getTime() ?? 0, ...attempts.map((a) => a.endedAt.getTime()), inProgress?.startedAt.getTime() ?? 0];
  return { createdAt, joinedAt, training, attempts, inProgress, lastActiveAt: new Date(Math.max(...moments)) };
}

// ---------------------------------------------------------------------------------------
// Günün ipucu
// ---------------------------------------------------------------------------------------

export type DemoTip = { key: string; status: "POOL" | "DRAFT" | "ARCHIVED"; neighborhood: string; lab?: string; text: string; reason: string };

export const demoTips: DemoTip[] = [
  {
    key: "adres",
    status: "POOL",
    neighborhood: "oltalama-limani",
    lab: trainingSlug,
    text: "Linke tıklamadan önce gönderen adresine bak: tanıdık bir ad, tanımadık bir adresten gelebilir.",
    reason: "Oltalama maillerinde görünen ad gerçek bir kuruma benzer ama adres bambaşka bir alan adındandır. Adrese bakmak tuzakların çoğunu ilk saniyede yakalar.",
  },
  {
    key: "acele",
    status: "POOL",
    neighborhood: "oltalama-limani",
    text: "\"24 saat içinde\" diye acele ettiren bir mesaj gelirse dur ve kendine bir dakika ver.",
    reason: "Dolandırıcılar düşünmeden tıklaman için süre baskısı kurar. Gerçek kurumlar seni dakikalar içinde karar vermeye zorlamaz.",
  },
  {
    key: "farkli-sifre",
    status: "POOL",
    neighborhood: "hesap-kalesi",
    text: "Her hesap için farklı bir şifre kullan; biri sızarsa diğerleri güvende kalır.",
    reason: "Bir sitede sızan şifre başka sitelerde de otomatik olarak denenir. Farklı şifreler bu zincirleme ele geçirmeyi durdurur.",
  },
  {
    key: "kod",
    status: "POOL",
    neighborhood: "hesap-kalesi",
    text: "Sana gelen doğrulama kodunu kimseyle paylaşma, en yakın arkadaşın istese bile.",
    reason: "Kodu isteyen kişinin hesabı ele geçirilmiş olabilir. Kod hesabının anahtarıdır; kodu veren hesabı da vermiş olur.",
  },
  {
    key: "magaza",
    status: "POOL",
    neighborhood: "yazilim-ormani",
    text: "Uygulamaları yalnızca telefonunun resmi uygulama mağazasından indir.",
    reason: "Mağaza dışından indirilen dosyalar zararlı yazılım taşıyabilir ve telefonundaki fotoğraflara, mesajlara erişebilir.",
  },
  {
    key: "kampanya",
    status: "POOL",
    neighborhood: "para-carsisi",
    text: "İnanılmayacak kadar ucuz bir kampanya görürsen linke değil, mağazanın kendi uygulamasına git.",
    reason: "Sahte kampanyalar kart bilgini toplamak için gerçeğine çok benzeyen sayfalar kurar. Mağazayı kendin açarsan sahte sayfaya düşmezsin.",
  },
  {
    key: "cift-uzanti",
    status: "DRAFT",
    neighborhood: "yazilim-ormani",
    text: "Ekteki dosyanın adı \".pdf.exe\" gibi iki uzantılıysa açma.",
    reason: "Asıl uzantı sondakidir: belge gibi görünen dosya aslında bir programdır ve açılınca bilgisayarda çalışır.",
  },
  {
    key: "cikis",
    status: "ARCHIVED",
    neighborhood: "hesap-kalesi",
    text: "Okuldaki ortak bilgisayarda işin bitince hesabından çıkış yapmayı unutma.",
    reason: "Açık kalan oturumla senden sonra oturan kişi hesabına girebilir; tarayıcıyı kapatmak her zaman yetmez.",
  },
];

/** Geçmiş günlerde gösterilen ipuçları (TipDay): dünden geriye bu kadar gün. Bugünü site seçer. */
export const tipHistoryDays = 6;

// ---------------------------------------------------------------------------------------
// Gündem
// ---------------------------------------------------------------------------------------

export type DemoArticle = {
  key: string;
  /** Taslağın adresi geçicidir ("_taslak-" ile başlar, lib/news/content.ts draftSlugPrefix). */
  slug: string;
  /** Yayın haftası (fridayAt): 0 en son yayın Cuması, 1 bir sonraki, -1 bir önceki. Taslakta null. */
  week: number | null;
  status: "PUBLISHED" | "SCHEDULED" | "DRAFT";
  title: string;
  summary: string;
  neighborhood: string | null;
  relatedLab: string | null;
  sourceName: string;
  sourceUrl: string;
  readCount: number;
  content: {
    whatsHappening: string;
    example: { sender: string; text: string } | null;
    signs: { sign: string; explanation: string }[];
    actions: string[];
    takeaways: string[];
  };
};

export const demoArticles: DemoArticle[] = [
  {
    key: "kargo",
    slug: "ornek-sahte-kargo-mesajlari",
    week: -2,
    status: "PUBLISHED",
    title: "Örnek: Sahte kargo mesajları yine artışta",
    summary: "Paketin teslim edilemediğini söyleyen mesajlar adres güncelleme bahanesiyle şifre ve kart bilgisi istiyor.",
    neighborhood: "oltalama-limani",
    relatedLab: scenarioSlug,
    sourceName: "USOM",
    sourceUrl: "https://www.usom.gov.tr/",
    readCount: 128,
    content: {
      whatsHappening:
        "Son günlerde paketinin depoda beklediğini söyleyen mesajlar yeniden çoğaldı. Mesajdaki link gerçeğine benzeyen bir kargo sayfası açıyor.\nSayfa önce adres, sonra şifre ya da kart bilgisi istiyor. Girilen bilgiler doğrudan dolandırıcılara gidiyor.",
      example: { sender: "KARGO-BILGI", text: "Paketiniz teslim edilemedi. Adresinizi 24 saat içinde güncelleyin: kargo-teslimat-tr.xyz/adres" },
      signs: [
        { sign: "Tanımadığın bir alan adı", explanation: "Kargo firmasının kendi adresi değil; sonu .xyz gibi tuhaf bir uzantıyla bitiyor." },
        { sign: "Süre baskısı", explanation: "\"24 saat içinde\" gibi ifadeler düşünmeden tıklaman için yazılır." },
        { sign: "Beklemediğin bir paket", explanation: "Sipariş vermediysen ya da siparişin zaten geldiyse mesaj büyük ihtimalle sahtedir." },
      ],
      actions: ["Mesajdaki linke tıklama.", "Kargonu firmanın kendi uygulamasından ya da sitesinden takip et.", "Mesajı bir büyüğüne göster, sonra sil."],
      takeaways: ["Kargo mesajındaki linke değil, firmanın kendi uygulamasına git.", "Adres güncellemek için şifre gerekmez.", "Acele ettiren mesaj bir uyarı işaretidir."],
    },
  },
  {
    key: "oyun",
    slug: "ornek-oyun-parasi-vaadi",
    week: -1,
    status: "PUBLISHED",
    title: "Örnek: Ücretsiz oyun parası vaadine dikkat",
    summary: "Ücretsiz oyun parası ya da kostüm vaat eden sayfalar oyun hesabının şifresini istiyor; hesap birkaç dakikada el değiştiriyor.",
    neighborhood: "hesap-kalesi",
    relatedLab: null,
    sourceName: "ESET WeLiveSecurity",
    sourceUrl: "https://www.welivesecurity.com/",
    readCount: 86,
    content: {
      whatsHappening:
        "Video yorumlarında ve mesajlaşma gruplarında \"ücretsiz oyun parası\" dağıtan sayfaların linkleri paylaşılıyor. Sayfa ödülü vermek için oyun hesabıyla giriş yapmanı istiyor.\nGiriş yapan oyuncunun hesabı kısa süre içinde başkasına geçiyor ve şifresi değiştiriliyor.",
      example: null,
      signs: [
        { sign: "Gerçek olamayacak kadar iyi", explanation: "Oyunun kendisi bile vermediği bir ödülü tanımadığın bir sayfa veremez." },
        { sign: "Oyun dışında giriş", explanation: "Ödül için oyunun kendi ekranı yerine başka bir sitede şifre isteniyor." },
        { sign: "Paylaş, daha çok kazan", explanation: "Linki arkadaşlarına göndermen istenirse tuzak yayılmaya çalışıyordur." },
      ],
      actions: ["Oyun hesabının şifresini yalnızca oyunun kendi uygulamasına yaz.", "Hesabında iki adımlı doğrulamayı aç.", "Şifreni girdiysen hemen değiştir ve bir büyüğüne haber ver."],
      takeaways: ["Ücretsiz oyun parası sayfaları hesap toplar.", "Şifre yalnızca oyunun kendi ekranına yazılır.", "İki adımlı doğrulama çalınan şifreyi işe yaramaz hale getirir."],
    },
  },
  {
    key: "kod",
    slug: "ornek-kodu-atar-misin",
    week: 0,
    status: "PUBLISHED",
    title: "Örnek: Arkadaşından gelen \"kodu atar mısın?\" mesajı",
    summary: "Hesabı ele geçirilen bir arkadaşın adına gelen mesaj, sana gelen doğrulama kodunu istiyor. Kodu gönderen kendi hesabını da kaybediyor.",
    neighborhood: "hesap-kalesi",
    relatedLab: null,
    sourceName: "USOM",
    sourceUrl: "https://www.usom.gov.tr/",
    readCount: 41,
    content: {
      whatsHappening:
        "Mesajlaşma uygulamalarında tanıdık birinden \"yanlışlıkla sana kod gönderdim, atar mısın?\" diye mesaj geliyor. Aslında o kod senin hesabını yeni bir telefona taşımak için gönderilmiş oluyor.\nKodu gönderen öğrencinin hesabı da ele geçiriliyor ve aynı mesaj bu kez onun arkadaşlarına gidiyor.",
      example: { sender: "Ece (arkadaşın)", text: "Pardon, sana yanlışlıkla 6 haneli bir kod gönderdim. Bana atar mısın, acil lazım!" },
      signs: [
        { sign: "Kod isteyen bir arkadaş", explanation: "Gerçek bir arkadaş sana gelen kodu istemez; kod yalnızca sana aittir." },
        { sign: "Acil ve telaşlı dil", explanation: "\"Acil lazım\" gibi ifadeler düşünmeden göndermen içindir." },
        { sign: "Alışılmadık yazım", explanation: "Arkadaşın normalde böyle yazmıyorsa hesabı başkasının elinde olabilir." },
      ],
      actions: ["Kodu kimseyle paylaşma.", "Arkadaşına başka bir yoldan, örneğin telefonla ulaşıp sor.", "Hesabında iki adımlı doğrulamayı aç."],
      takeaways: ["Doğrulama kodu hesabının anahtarıdır.", "Kod isteyen arkadaşın hesabı ele geçirilmiş olabilir.", "Şüphelenirsen başka bir yoldan doğrula."],
    },
  },
  {
    key: "burs",
    slug: "ornek-sahte-burs-sayfalari",
    week: 1,
    status: "SCHEDULED",
    title: "Örnek: Sahte burs başvuru sayfaları",
    summary: "Öğrencilere burs vaat eden sahte sayfalar kimlik bilgisi ve \"başvuru ücreti\" istiyor. Gerçek burslar başvuru ücreti almaz.",
    neighborhood: "para-carsisi",
    relatedLab: null,
    sourceName: "USOM",
    sourceUrl: "https://www.usom.gov.tr/",
    readCount: 0,
    content: {
      whatsHappening:
        "Sosyal medyada \"herkese karşılıksız burs\" diyen paylaşımlar dolaşıyor. Link, gerçek bir kuruma benzeyen bir başvuru sayfası açıyor.\nSayfa kimlik bilgilerini ve küçük bir \"başvuru ücreti\" için kart bilgisini istiyor.",
      example: null,
      signs: [
        { sign: "Başvuru ücreti", explanation: "Gerçek burslar başvurmak için para istemez." },
        { sign: "Resmi olmayan adres", explanation: "Resmi kurumların adresi .gov.tr ile biter." },
        { sign: "Herkese, hemen", explanation: "Koşulsuz ve sınırsız burs vaadi gerçekçi değildir." },
      ],
      actions: ["Burs duyurusunu kurumun kendi sitesinden doğrula.", "Kart bilgisi isteyen başvuru sayfasını kapat.", "Bir öğretmenine ya da ailene danış."],
      takeaways: ["Gerçek burs başvuru ücreti almaz.", "Resmi adresler .gov.tr ile biter.", "Önce doğrula, sonra başvur."],
    },
  },
  {
    key: "uzanti",
    slug: "_taslak-ornek-cift-uzantili-ekler",
    week: null,
    status: "DRAFT",
    title: "Örnek: Çift uzantılı ek dosyalar",
    summary: "",
    neighborhood: "yazilim-ormani",
    relatedLab: null,
    sourceName: "",
    sourceUrl: "",
    readCount: 0,
    content: {
      whatsHappening: "Ödev ya da fatura gibi görünen ekler aslında program olabiliyor.",
      example: null,
      signs: [
        { sign: "İki uzantı", explanation: "" },
        { sign: "", explanation: "" },
        { sign: "", explanation: "" },
      ],
      actions: [],
      takeaways: ["", "", ""],
    },
  },
];

/**
 * Yayın haftasının anı: Cuma 08.00 Türkiye saati (05.00 UTC; lib/news/content.ts). 0 en son geçmiş
 * yayın anı (bugün Cuma ve saat 08.00'i geçmediyse geçen Cuma), 1 bir sonraki, -1 bir önceki.
 */
export function fridayAt(now: Date, weekOffset: number): Date {
  const today = Date.parse(`${turkeyDayKey(now)}T00:00:00Z`);
  const back = (new Date(today).getUTCDay() - 5 + 7) % 7;
  let last = today - back * DAY + 5 * HOUR;
  if (last > now.getTime()) last -= 7 * DAY;
  return new Date(last + weekOffset * 7 * DAY);
}

// ---------------------------------------------------------------------------------------
// Talep belgeleri: küçük bir PDF ve bir PNG (gerçek bir belge değil, üzerinde "ÖRNEK" yazar)
// ---------------------------------------------------------------------------------------

// PDF'in yazı tipi (Helvetica) WinAnsi kodlamasında ğ, ş, ı, İ yoktur; bunlar 128-133'e eşlenir.
const pdfExtra = ["ğ", "Ğ", "ş", "Ş", "ı", "İ"];
const pdfExtraNames = ["gbreve", "Gbreve", "scedilla", "Scedilla", "dotlessi", "Idotaccent"];

function pdfText(text: string): string {
  let out = "";
  for (const ch of text) {
    const extra = pdfExtra.indexOf(ch);
    const code = extra >= 0 ? 128 + extra : ch.charCodeAt(0);
    if (code > 255) throw new Error(`PDF'te yazılamayan karakter: ${ch}`);
    const c = String.fromCharCode(code);
    out += c === "(" || c === ")" || c === "\\" ? `\\${c}` : c;
  }
  return out;
}

/** Tek sayfalık PDF; satırlar yukarıdan aşağı. */
export function pdfDocument(lines: { text: string; size: number; bold?: boolean; gap?: number }[]): Buffer {
  let y = 770;
  const stream = lines
    .map((line) => {
      y -= line.gap ?? line.size + 12;
      return `BT /${line.bold ? "F1" : "F2"} ${line.size} Tf 72 ${y} Td (${pdfText(line.text)}) Tj ET`;
    })
    .concat(["0.6 G 72 120 m 300 120 l S"])
    .join("\n");
  const encoding = `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [128 ${pdfExtraNames.map((n) => `/${n}`).join(" ")}] >>`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding 6 0 R >>",
    encoding,
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * Telefonla çekilmiş bir belge fotoğrafı yerine geçen PNG: kâğıt, başlık şeridi, satırlar ve
 * mühür. Yazı yoktur (görüntüdür); dosya adı ve talepteki bilgiler "örnek" olduğunu söyler.
 */
export function pngDocument(width = 480, height = 640): Buffer {
  type Rgb = [number, number, number];
  const desk: Rgb = [70, 74, 82];
  const paper: Rgb = [246, 244, 238];
  const ink: Rgb = [120, 124, 132];
  const header: Rgb = [38, 70, 120];
  const stamp: Rgb = [178, 54, 54];
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const inPaper = (x: number, y: number) => x >= 40 && x < width - 40 && y >= 40 && y < height - 40;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      let color = desk;
      if (inPaper(x, y)) {
        color = paper;
        if (y >= 70 && y < 100 && x >= 70 && x < width - 70) color = header;
        const line = y - 130;
        // Metin satırları: 22 piksel arayla, her satırın uzunluğu biraz farklı.
        if (line >= 0 && line < 320 && line % 22 < 6 && x >= 70 && x < width - 70 - ((line / 22) % 4) * 40) color = ink;
        const dx = x - (width - 130);
        const dy = y - (height - 130);
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r >= 40 && r < 46) color = stamp;
      }
      raw.set(color, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

/** Başvuranın belgesi: PDF'te adı, okulu ve branşı yazar; hepsinde "ÖRNEK BELGE". */
export function applicationDocument(applicant: DemoApplicant, schoolName: string, place: string): { mimeType: string; data: Buffer } | null {
  const document = applicant.application.document;
  if (!document) return null;
  if (document.kind === "png") return { mimeType: "image/png", data: pngDocument() };
  const data = pdfDocument([
    { text: "ÖRNEK BELGE", size: 22, bold: true },
    { text: "Bu belge örnek veridir; gerçek bir kuruma ya da kişiye ait değildir.", size: 10, gap: 22 },
    { text: "Görev Yeri Belgesi", size: 16, bold: true, gap: 44 },
    { text: `Adı Soyadı: ${applicant.name}`, size: 12, gap: 34 },
    { text: `Okulu: ${schoolName}`, size: 12 },
    { text: `İl / İlçe: ${place}`, size: 12 },
    { text: `Branşı: ${applicant.application.subject}`, size: 12 },
    { text: "Görevi: Öğretmen", size: 12 },
    { text: "İlgilinin okulumuzda görevli olduğunu bildiririz.", size: 12, gap: 40 },
    { text: "Okul Müdürlüğü (örnek imza)", size: 11, gap: 200 },
  ]);
  return { mimeType: "application/pdf", data };
}
