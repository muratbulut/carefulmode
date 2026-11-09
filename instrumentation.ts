// Sunucu açılırken bir kez çalışır (Next.js instrumentation). Zamanlanmış temizliği kurar.
// Derleme sırasında ve Edge ortamında çalışmaz.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startCleanupSchedule } = await import("@/lib/cleanup");
  startCleanupSchedule();
}
