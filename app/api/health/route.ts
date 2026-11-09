import { connection } from "next/server";
import { db } from "@/lib/db";

// Docker sağlık kontrolü ve izleme bu adresi kullanır.
const TIMEOUT_MS = 3_000;
const HEADERS = { "Cache-Control": "no-store" };

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("zaman aşımı")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function GET() {
  // Build sırasında önceden üretilmesin, her istekte çalışsın.
  await connection();

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, TIMEOUT_MS);
    return Response.json({ status: "ok", database: "ok", time: new Date().toISOString() }, { headers: HEADERS });
  } catch (error) {
    // Ayrıntı yalnızca sunucu günlüğüne yazılır, yanıta konmaz.
    console.error("Sağlık kontrolü: veritabanına ulaşılamadı.", error instanceof Error ? error.message : error);
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503, headers: HEADERS });
  }
}
