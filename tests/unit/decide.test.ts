import { beforeEach, describe, expect, it, vi } from "vitest";

// Talep kararlarının çekirdeği (lib/teacher/decide.ts), güvenlik turu 3:
// - kilit sırası: önce başvuranın kullanıcı satırı, sonra talep (başvuranın geri çekmesi ve cevabı
//   da bu sırayla kilitler; ters sıra aynı anda gelince kilitlenmeye, yani hataya yol açıyordu),
// - "Bilgi iste": başvuranın yazdığı cevap silinemeyen kayıt defterine kopyalanmaz.
// Veritabanı bellekte taklit edilir; işlemdeki sorgular sırayla kaydedilir.

type Row = {
  id: string;
  userId: string;
  status: "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";
  question: string | null;
  questionAt: Date | null;
  answer: string | null;
  answeredAt: Date | null;
};

const mocks = vi.hoisted(() => ({
  row: null as Row | null,
  queries: [] as string[],
  audit: [] as { action: string; details: unknown; createdAt: Date; id: string; actorId: string }[],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("?").replace(/\s+/g, " ").trim();
      mocks.queries.push(sql);
      if (!mocks.row) return [];
      if (sql.startsWith(`SELECT "userId" FROM "TeacherApplication"`)) return [{ userId: mocks.row.userId }];
      return [{ id: mocks.row.id }];
    },
    teacherApplication: {
      findUniqueOrThrow: async () => ({ ...mocks.row, schoolId: "s1", newSchoolName: null, province: "İstanbul", district: "Kadıköy", documentName: null, coordinatorOpinion: null, decidedById: null, decidedAt: null, rejectionNote: null }),
      update: async ({ data }: { data: Partial<Row> }) => {
        mocks.queries.push(`update ${Object.keys(data).sort().join(",")}`);
        Object.assign(mocks.row!, data);
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; details: unknown; actorId: string } }) => {
        mocks.audit.push({ ...data, createdAt: new Date(), id: `a${mocks.audit.length}` });
      },
      findMany: async () => [...mocks.audit].reverse(),
    },
  };
  return { db: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("next/server", () => ({ after: () => {} }));

const { requestInfo, undoDecision } = await import("@/lib/teacher/decide");

const previousAnswer = "Görev yeri belgem ekte; telefonum 0555 000 00 00.";

describe("talep kararı çekirdeği", () => {
  beforeEach(() => {
    mocks.queries = [];
    mocks.audit = [];
    mocks.row = {
      id: "app1",
      userId: "user1",
      status: "PENDING",
      question: "Okulunun tam adı nedir?",
      questionAt: new Date("2026-10-10T10:00:00Z"),
      answer: previousAnswer,
      answeredAt: new Date("2026-10-10T12:00:00Z"),
    };
  });

  it("önce başvuranın satırını, sonra talebi kilitler", async () => {
    const result = await requestInfo({ applicationId: "app1", actorId: "admin1", question: "Kurumsal e-posta adresin var mı?" });
    expect(result.ok).toBe(true);
    const userLock = mocks.queries.findIndex((q) => q.startsWith(`SELECT "id" FROM "User"`) && q.endsWith("FOR NO KEY UPDATE"));
    const appLock = mocks.queries.findIndex((q) => q.startsWith(`SELECT "id" FROM "TeacherApplication"`) && q.endsWith("FOR UPDATE"));
    expect(userLock).toBeGreaterThanOrEqual(0);
    expect(appLock).toBeGreaterThan(userLock);
  });

  it("bilgi isteyince başvuranın önceki cevabı kayıt defterine yazılmaz, satırda kalır; geri al soruyu geri getirir", async () => {
    await requestInfo({ applicationId: "app1", actorId: "admin1", question: "Kurumsal e-posta adresin var mı?" });
    expect(mocks.row).toMatchObject({ status: "INFO_REQUESTED", question: "Kurumsal e-posta adresin var mı?", answer: previousAnswer });
    expect(mocks.audit).toHaveLength(1);
    expect(JSON.stringify(mocks.audit[0].details)).not.toContain("0555");
    expect(mocks.audit[0].details).toMatchObject({ previous: { question: "Okulunun tam adı nedir?" } });

    const undone = await undoDecision({ applicationId: "app1", actorId: "admin1" });
    expect(undone).toEqual({ ok: true, undone: ["application.info_requested"] });
    expect(mocks.row).toMatchObject({ status: "PENDING", question: "Okulunun tam adı nedir?", answer: previousAnswer });
    expect(mocks.row?.questionAt?.toISOString()).toBe("2026-10-10T10:00:00.000Z");
  });
});
