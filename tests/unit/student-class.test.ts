import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DistrictView, LabView } from "@/lib/lab/route";

// Öğrencinin sınıfı: ana sayfadaki ödev kutusunun hesabı ve katılma / ayrılma eylemleri.
// Veritabanı, oturum ve istek başlıkları bellekte taklit edilir; istek sınırı gerçek kurallarla
// bellekteki bir sayaçta çalışır.

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  row: null as { id: string; emailVerified: boolean; suspended: boolean } | null,
  classroom: null as null | {
    id: string;
    name: string;
    archived: boolean;
    teacherId: string;
    teacher: { displayName: string; role: string; school: { name: string } | null };
  },
  members: new Set<string>(),
  lookups: 0,
  refreshed: 0,
  counters: new Map<string, { count: number; resetAt: Date }>(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: async () => mocks.row },
    classroom: {
      findUnique: async ({ where }: { where: { joinCode: string } }) => {
        mocks.lookups++;
        return where.joinCode === "K7B4X2" ? mocks.classroom : null;
      },
    },
    classroomMembership: {
      create: async ({ data }: { data: { classroomId: string; userId: string } }) => {
        const key = `${data.classroomId}:${data.userId}`;
        if (mocks.members.has(key)) {
          const { Prisma } = await import("@/lib/generated/prisma/client");
          throw new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" });
        }
        mocks.members.add(key);
      },
      deleteMany: async ({ where }: { where: { classroomId: string; userId: string } }) => {
        mocks.members.delete(`${where.classroomId}:${where.userId}`);
        return { count: 1 };
      },
    },
  },
}));
vi.mock("@/lib/session", () => ({ getUser: async () => mocks.user }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.0.0.1" }) }));
vi.mock("next/cache", () => ({ refresh: () => mocks.refreshed++ }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  const store = {
    async hit(key: string, windowSec: number) {
      const row = mocks.counters.get(key);
      const next = row ? { count: row.count + 1, resetAt: row.resetAt } : { count: 1, resetAt: new Date(Date.now() + windowSec * 1000) };
      mocks.counters.set(key, next);
      return next;
    },
    async get(key: string) {
      return mocks.counters.get(key) ?? null;
    },
    async delete(key: string) {
      mocks.counters.delete(key);
    },
  };
  return { ...actual, rateLimit: actual.createRateLimiter(store) };
});

const { joinClassroom, leaveClassroom } = await import("@/lib/classroom/student-actions");
const { assignmentViews, calendarDay, dueBy, isOverdue } = await import("@/lib/classroom/student");

const student = { id: "u1", emailVerified: true, suspended: false };
const teacherClass = () => ({
  id: "c1",
  name: "7-B",
  archived: false,
  teacherId: "t1",
  teacher: { displayName: "Zeynep Kaya", role: "TEACHER", school: { name: "Bahçelievler Ortaokulu" } },
});

beforeEach(() => {
  mocks.user = { id: "u1" };
  mocks.row = { ...student };
  mocks.classroom = teacherClass();
  mocks.members.clear();
  mocks.counters.clear();
  mocks.lookups = 0;
  mocks.refreshed = 0;
});

describe("sınıf koduyla katılma", () => {
  it("doğru kodla katılır; sınıfın adı, öğretmeni ve okulu döner, sayfa yenilenir", async () => {
    const result = await joinClassroom(" k7b-4x2 ");
    expect(result).toEqual({
      status: "ok",
      classroom: { id: "c1", name: "7-B", teacher: "Zeynep Kaya", school: "Bahçelievler Ortaokulu" },
      message: "7-B sınıfına katıldın",
    });
    expect(mocks.members.has("c1:u1")).toBe(true);
    expect(mocks.refreshed).toBe(1);
  });

  it("giriş yoksa, hesap askıdaysa ya da e-posta doğrulanmadıysa sınıfa bakılmaz", async () => {
    mocks.user = null;
    expect(await joinClassroom("K7B4X2")).toMatchObject({ status: "error", code: "auth" });
    mocks.user = { id: "u1" };
    mocks.row = { ...student, suspended: true };
    expect(await joinClassroom("K7B4X2")).toMatchObject({ status: "error", code: "auth" });
    mocks.row = { ...student, emailVerified: false };
    expect(await joinClassroom("K7B4X2")).toMatchObject({ status: "error", code: "unverified", message: "Sınıfa katılmak için önce e-posta adresini doğrula." });
    expect(mocks.lookups).toBe(0);
    expect(mocks.members.size).toBe(0);
  });

  it("türü ya da biçimi yanlış kod veritabanına gitmez ve sınıra sayılmaz", async () => {
    for (const bad of [123, null, { code: "K7B4X2" }, ["K7B4X2"], "K7B4", "K7B4X2Z", "K0B4X2", "x".repeat(100)]) {
      expect(await joinClassroom(bad)).toMatchObject({ status: "error", code: "format" });
    }
    expect(mocks.lookups).toBe(0);
    expect(mocks.counters.size).toBe(0);
  });

  it("yanlış kod, arşivlenen sınıf ve öğretmenliği biten kişinin sınıfı aynı cevabı alır", async () => {
    const notFound = { status: "error", code: "not_found", message: "Bu kodla bir sınıf bulunamadı. Kodu öğretmeninden kontrol et." };
    expect(await joinClassroom("ABCDEF")).toEqual(notFound);
    mocks.classroom = { ...teacherClass(), archived: true };
    expect(await joinClassroom("K7B4X2")).toEqual(notFound);
    mocks.classroom = { ...teacherClass(), teacher: { ...teacherClass().teacher, role: "STUDENT" } };
    expect(await joinClassroom("K7B4X2")).toEqual(notFound);
    expect(mocks.members.size).toBe(0);
  });

  it("zaten üyeyse dostça uyarır (aynı anda iki istek de üye sayılır)", async () => {
    await joinClassroom("K7B4X2");
    expect(await joinClassroom("K7B4X2")).toMatchObject({ status: "error", code: "member", message: "Zaten 7-B sınıfındasın." });
  });

  it("öğretmen kendi sınıfına öğrenci olarak katılamaz", async () => {
    mocks.user = { id: "t1" };
    mocks.row = { ...student, id: "t1" };
    expect(await joinClassroom("K7B4X2")).toMatchObject({ status: "error", code: "own" });
    expect(mocks.members.size).toBe(0);
  });

  it("10 denemeden sonra sınıf aranmadan durur (kod tahmin edilemesin)", async () => {
    for (let i = 0; i < 10; i++) expect(await joinClassroom("ABCDEF")).toMatchObject({ code: "not_found" });
    expect(mocks.lookups).toBe(10);
    const limited = await joinClassroom("K7B4X2");
    expect(limited).toMatchObject({ status: "error", code: "rate_limited" });
    expect(limited.status === "error" && limited.message).toMatch(/^Çok fazla deneme yaptın\. \d+:\d\d sonra tekrar dene\.$/);
    expect(mocks.lookups).toBe(10);
    expect(mocks.members.size).toBe(0);
    // Sayaçlar kullanıcı ve IP başına.
    expect([...mocks.counters.keys()].sort()).toEqual(["join-class-ip:10.0.0.1", "join-class:u1"]);
  });

  it("sınıftan ayrılmak yalnızca kendi üyeliğini siler", async () => {
    await joinClassroom("K7B4X2");
    mocks.members.add("c1:u2");
    expect(await leaveClassroom("c1")).toEqual({ status: "ok", message: "Sınıftan ayrıldın" });
    expect([...mocks.members]).toEqual(["c1:u2"]);
    expect(await leaveClassroom(42)).toMatchObject({ status: "error" });
    mocks.user = null;
    expect(await leaveClassroom("c1")).toMatchObject({ status: "error" });
    expect([...mocks.members]).toEqual(["c1:u2"]);
  });
});

// ---------------------------------------------------------------------------------------

const district = (slug: string, labs: Partial<LabView>[], over: Partial<DistrictView> = {}): DistrictView => {
  const info = { slug, name: slug === "oltalama-limani" ? "Oltalama Limanı" : "Hesap Kalesi", topic: "", color: "accent", icon: "mail", sortOrder: 1 };
  const views = labs.map(
    (l, i) =>
      ({
        slug: `${slug}-${i}`,
        type: i === 0 ? "TRAINING" : "SCENARIO",
        name: `Lab ${i}`,
        state: "open",
        inProgress: false,
        district: info,
        gateSlug: null,
        ...l,
      }) as LabView,
  );
  const doneCount = views.filter((v) => v.state === "done").length;
  return {
    ...info,
    trainings: views.slice(0, 1),
    scenarios: views.slice(1).map((v) => ({ ...v, gateSlug: views[0]?.slug ?? null })),
    doneCount,
    total: views.length,
    trainingDone: views[0]?.state === "done",
    nextSlug: views.find((v) => v.state !== "done")?.slug ?? null,
    ...over,
  };
};

const neighborhoods = [
  { id: "n-olta", slug: "oltalama-limani" },
  { id: "n-hesap", slug: "hesap-kalesi" },
];
const classes = [
  { id: "c1", name: "7-B", teacher: "Zeynep Kaya", school: null },
  { id: "c2", name: "Bilişim kulübü", teacher: "Selin Yıldız", school: null },
];
const now = new Date("2026-10-11T09:00:00Z");

// Mahallelerin yayındaki lablarının kilit bilgisi (ödevin odaları bundan seçilir): ilk eğitim
// temel, gateSlug'ı olan senaryo o eğitime bağlı. Kimlik slug'ın kendisi.
const labsOf = (districts: DistrictView[]) =>
  districts.flatMap((d) => {
    const neighborhoodId = neighborhoods.find((n) => n.slug === d.slug)!.id;
    return [...d.trainings, ...d.scenarios].map((l, i) => ({
      id: l.slug,
      slug: l.slug,
      neighborhoodId,
      type: l.type,
      sortOrder: i,
      unlockedById: l.type === "SCENARIO" ? l.gateSlug : null,
    }));
  });

type Homework = { id: string; classroomId: string; neighborhoodId: string; dueDate: Date | null; createdAt: Date; labIds?: string[] };
const views = (assignments: Homework[], districts: DistrictView[]) =>
  assignmentViews(
    assignments.map((a) => ({ labIds: [], ...a })),
    classes,
    districts,
    neighborhoods,
    labsOf(districts),
    now,
  );

describe("ana sayfadaki ödev kutusu", () => {
  it("mahallenin eğitim ve senaryo labları sayılır; sıradaki lab ve son tarih yazılır", () => {
    const [view] = views(
      [{ id: "a1", classroomId: "c1", neighborhoodId: "n-olta", dueDate: new Date("2026-10-17T20:59:00Z"), createdAt: now }],
      [district("oltalama-limani", [{}, {}, {}, {}])],
    );
    expect(view).toMatchObject({
      classroom: { name: "7-B", teacher: "Zeynep Kaya" },
      district: { slug: "oltalama-limani", name: "Oltalama Limanı", color: "accent" },
      done: 0,
      total: 4,
      due: "17 Ekim'e kadar",
      overdue: false,
      finished: false,
      next: { name: "Lab 0", href: "/oda/oltalama-limani-0/oyna", label: "Lab 0 ile başla" },
    });
  });

  it("düğme: yarım labda devam, biraz bitmişse sıradaki; hepsi bitince bitti", () => {
    const run = (labs: Partial<LabView>[]) =>
      views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: null, createdAt: now }], [district("oltalama-limani", labs)])[0];
    expect(run([{ state: "done" }, { inProgress: true }]).next).toMatchObject({ label: "Devam et: Lab 1", href: "/oda/oltalama-limani-1" });
    expect(run([{ state: "done" }, {}, {}])).toMatchObject({ done: 1, total: 3, next: { label: "Sıradaki: Lab 1" } });
    expect(run([{ state: "done" }, { state: "done" }])).toMatchObject({ done: 2, total: 2, finished: true, next: null, due: null });
  });

  it("seçilen odalar sayılır: senaryoyu açan eğitim ödeve kendiliğinden girer", () => {
    // Rota: eğitim (0), iki senaryo (1, 2). Öğretmen yalnızca 2. senaryoyu seçti.
    const hood = district("oltalama-limani", [{ state: "done" }, {}, {}]);
    const [view] = views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: null, createdAt: now, labIds: ["oltalama-limani-2"] }], [hood]);
    expect(view).toMatchObject({ done: 1, total: 2, finished: false, next: { name: "Lab 2", label: "Sıradaki: Lab 2" } });
    // Ödevde olmayan senaryo bitse de sayılmaz; ödevdekiler bitince ödev biter.
    const other = district("oltalama-limani", [{ state: "done" }, {}, { state: "done" }]);
    expect(views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: null, createdAt: now, labIds: ["oltalama-limani-2"] }], [other])[0]).toMatchObject({
      done: 2,
      total: 2,
      finished: true,
    });
  });

  it("son tarih o günün sonuna kadar sürer (Türkiye saati)", () => {
    // Öğretmen 17 Ekim'i İstanbul'da 00.00 olarak kaydetmiş olabilir.
    const due = new Date("2026-10-16T21:00:00Z");
    expect(calendarDay(due)).toMatchObject({ day: 17, month: 9, key: "2026-10-17" });
    expect(isOverdue(due, new Date("2026-10-17T20:59:00Z"))).toBe(false);
    expect(isOverdue(due, new Date("2026-10-17T21:01:00Z"))).toBe(true);
    expect(dueBy(due)).toBe("17 Ekim'e kadar");
    expect(dueBy(new Date("2026-09-03T09:00:00Z"))).toBe("3 Eylül'e kadar");
    expect(dueBy(new Date("2026-03-03T09:00:00Z"))).toBe("3 Mart'a kadar");
  });

  it("geçmiş son tarih uyarı olur; bitmiş ödev geç sayılmaz", () => {
    const due = new Date("2026-10-05T09:00:00Z");
    const [late] = views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: due, createdAt: now }], [district("oltalama-limani", [{}, {}])]);
    expect(late).toMatchObject({ overdue: true, due: "Son tarih geçti (5 Ekim)" });
    const [done] = views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: due, createdAt: now }], [district("oltalama-limani", [{ state: "done" }])]);
    expect(done).toMatchObject({ overdue: false, finished: true, due: "5 Ekim'e kadar" });
  });

  it("birden çok ödev: geç kalan ve son tarihi yakın olan önce, son tarihsiz sonra, biten en sonda", () => {
    const districts = [district("oltalama-limani", [{}, {}]), district("hesap-kalesi", [{ state: "done" }])];
    const at = (iso: string) => new Date(iso);
    const list = views(
      [
        { id: "none-old", classroomId: "c1", neighborhoodId: "n-olta", dueDate: null, createdAt: at("2026-10-01T09:00:00Z") },
        { id: "finished", classroomId: "c2", neighborhoodId: "n-hesap", dueDate: at("2026-10-12T09:00:00Z"), createdAt: now },
        { id: "later", classroomId: "c2", neighborhoodId: "n-olta", dueDate: at("2026-10-20T09:00:00Z"), createdAt: now },
        { id: "late", classroomId: "c1", neighborhoodId: "n-olta", dueDate: at("2026-10-08T09:00:00Z"), createdAt: now },
        { id: "none-new", classroomId: "c2", neighborhoodId: "n-olta", dueDate: null, createdAt: at("2026-10-09T09:00:00Z") },
        // Öğrencinin görmediği sınıfın ya da bilinmeyen mahallenin ödevi çıkmaz.
        { id: "other", classroomId: "c9", neighborhoodId: "n-olta", dueDate: null, createdAt: now },
        { id: "gone", classroomId: "c1", neighborhoodId: "n-yok", dueDate: null, createdAt: now },
      ],
      districts,
    );
    expect(list.map((v) => v.id)).toEqual(["late", "later", "none-new", "none-old", "finished"]);
  });

  it("mahallede lab yoksa düğme çıkmaz", () => {
    const [view] = views([{ id: "a", classroomId: "c1", neighborhoodId: "n-olta", dueDate: null, createdAt: now }], [district("oltalama-limani", [])]);
    expect(view).toMatchObject({ done: 0, total: 0, finished: false, next: null });
  });
});
