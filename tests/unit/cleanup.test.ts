import { beforeEach, describe, expect, it, vi } from "vitest";

// Hesap silme (lib/cleanup.ts deleteAccount). Veritabanı taklit edilir: işlemdeki adımların sırası
// kaydedilir. Gerçek veritabanında öğretmenin sınıfı (Classroom.teacherId, ON DELETE RESTRICT)
// silinmeden hesap silinemez; silme isteği sessizce yerine getirilmiyordu (güvenlik turu 3).
// Kalıcı kayıtlarda izi olan hesap (kayıt defteri, haber, ipucu, okul, karar, verilen izin) da
// silinemiyordu; artık anonimleştirilir (sabah soruları 10).

const mocks = vi.hoisted(() => ({ steps: [] as string[], calls: {} as Record<string, unknown>, traces: [] as string[] }));

vi.mock("@/lib/db", () => {
  const step = (name: string) => async (args: unknown) => {
    mocks.steps.push(`${name} ${JSON.stringify(args)}`);
    return { count: 0 };
  };
  // Kalıcı iz sorguları: mocks.traces'te adı geçen tabloda kayıt varmış gibi döner.
  const trace = (name: string) => async () => (mocks.traces.includes(name) ? { id: "x", userId: "x" } : null);
  const tx = {
    labAttempt: { deleteMany: step("labAttempt.deleteMany") },
    classroom: { deleteMany: step("classroom.deleteMany") },
    user: { delete: step("user.delete"), update: step("user.update") },
    session: { deleteMany: step("session.deleteMany") },
    account: { deleteMany: step("account.deleteMany") },
    teamPermission: { deleteMany: step("teamPermission.deleteMany"), findFirst: trace("teamPermission") },
    school: { updateMany: step("school.updateMany"), findFirst: trace("school") },
    teacherApplication: { deleteMany: step("teacherApplication.deleteMany"), findFirst: trace("teacherApplication") },
    classroomMembership: { deleteMany: step("classroomMembership.deleteMany") },
    trainingProgress: { deleteMany: step("trainingProgress.deleteMany") },
    earnedBadge: { deleteMany: step("earnedBadge.deleteMany") },
    tipView: { deleteMany: step("tipView.deleteMany") },
    auditLog: { findFirst: trace("auditLog") },
    dailyTip: { findFirst: trace("dailyTip") },
    newsArticle: { findFirst: trace("newsArticle") },
  };
  return {
    db: {
      user: { findMany: async (args: unknown) => ((mocks.calls["user.findMany"] = args), []) },
      session: { deleteMany: async () => ({ count: 0 }) },
      verification: { deleteMany: async () => ({ count: 0 }) },
      applicationDocument: { deleteMany: async (args: unknown) => ((mocks.calls["applicationDocument.deleteMany"] = args), { count: 2 }) },
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    },
  };
});
vi.mock("@/lib/teacher/decide", () => ({ finalizeDueDecisions: async () => 0 }));
vi.mock("@/lib/rate-limit", () => ({ deleteExpiredRateLimits: async () => 0 }));

const { deleteAccount, pendingDocumentRetentionDays, runCleanup, unverifiedRetentionDays } = await import("@/lib/cleanup");

describe("hesap silme", () => {
  beforeEach(() => {
    mocks.steps = [];
    mocks.traces = [];
  });

  it("öğretmenin sınıfları hesapla aynı işlemde, hesaptan önce silinir", async () => {
    expect(await deleteAccount("u1")).toBe("deleted");
    expect(mocks.steps).toEqual([
      `labAttempt.deleteMany {"where":{"userId":"u1"}}`,
      `classroom.deleteMany {"where":{"teacherId":"u1"}}`,
      `user.delete {"where":{"id":"u1"}}`,
    ]);
  });

  for (const table of ["auditLog", "teamPermission", "school", "teacherApplication", "dailyTip", "newsArticle"]) {
    it(`kalıcı izi olan hesap (${table}) silinmez, anonimleştirilir`, async () => {
      mocks.traces = [table];
      expect(await deleteAccount("u1")).toBe("anonymized");
      expect(mocks.steps.some((s) => s.startsWith("user.delete"))).toBe(false);
    });
  }

  it("anonimleştirme kişisel veriyi ve girişi siler, adı Silinmiş kullanıcı yapar, okul sorumluluğunu kaldırır", async () => {
    mocks.traces = ["auditLog"];
    await deleteAccount("u1");
    const deleted = mocks.steps.filter((s) => s.includes(".deleteMany")).map((s) => s.split(" ")[0]);
    expect(deleted).toEqual([
      "labAttempt.deleteMany",
      "classroom.deleteMany",
      "session.deleteMany",
      "account.deleteMany",
      "teamPermission.deleteMany",
      "teacherApplication.deleteMany",
      "classroomMembership.deleteMany",
      "trainingProgress.deleteMany",
      "earnedBadge.deleteMany",
      "tipView.deleteMany",
    ]);
    expect(mocks.steps).toContain(`school.updateMany {"where":{"coordinatorId":"u1"},"data":{"coordinatorId":null}}`);
    const update = mocks.steps.find((s) => s.startsWith("user.update "))!;
    expect(JSON.parse(update.slice("user.update ".length))).toEqual({
      where: { id: "u1" },
      data: {
        displayName: "Silinmiş kullanıcı",
        email: "silinmis-u1@silinmis.invalid",
        emailVerified: false,
        role: "DELETED",
        birthYear: null,
        educationStatus: null,
        gradeLevel: null,
        schoolId: null,
        avatar: null,
        kvkkConsentAt: null,
        lastActiveAt: null,
        suspended: true,
        deletionScheduledAt: null,
      },
    });
  });
});

describe("saatlik temizlik", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const daysBefore = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("doğrulanmamış hesap 7 gün sonra silinir (sabah soruları 18); anonimleştirilen hesap yeniden ele alınmaz", async () => {
    expect(unverifiedRetentionDays).toBe(7);
    await runCleanup(now);
    expect(mocks.calls["user.findMany"]).toMatchObject({
      where: { role: { not: "DELETED" }, OR: [{ deletionScheduledAt: { lte: now } }, { emailVerified: false, createdAt: { lt: daysBefore(7) } }] },
    });
  });

  it("karar verilmeyen talebin belgesi yüklendikten 60 gün sonra silinir; karar verilen talebe dokunulmaz (soru 11)", async () => {
    expect(pendingDocumentRetentionDays).toBe(60);
    const result = await runCleanup(now);
    expect(mocks.calls["applicationDocument.deleteMany"]).toEqual({
      where: { createdAt: { lt: daysBefore(60) }, application: { status: { in: ["PENDING", "INFO_REQUESTED"] } } },
    });
    expect(result.documents).toBe(2);
  });
});
