import type { NextRequest } from "next/server";
import { getPermittedAccess } from "@/lib/admin/access";
import { db } from "@/lib/db";
import { articleState } from "@/lib/news/content";
import { detectCoverType } from "@/lib/news/cover";

// Haberin kapak görseli (4 Kasım, 15). Yayındaki haberin kapağı herkese açıktır ve uzun süre
// önbellekte kalır (adresteki ?v= sürümü kapak değişince değişir). Taslak ya da planlı haberin
// kapağını yalnızca Gündem izni olan yönetici görür (düzenleyici ve önizleme); başkasına, haber ya
// da kapak yoksa aynı boş 404 döner. Tür baytlardan yeniden denetlenir, tarayıcı tahmin etmez.

const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/kapak/[id]">) {
  const { id } = await ctx.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return notFound();
  const row = await db.newsArticle.findUnique({
    where: { id },
    select: { status: true, publishedAt: true, cover: { select: { mimeType: true, data: true } } },
  });
  if (!row?.cover) return notFound();
  const live = articleState(row, new Date()) === "live";
  if (!live && !(await getPermittedAccess("NEWS"))) return notFound();

  const bytes = new Uint8Array(row.cover.data);
  const mimeType = detectCoverType(bytes);
  if (!mimeType || mimeType !== row.cover.mimeType) return notFound();
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": live ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
