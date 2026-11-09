"use server";

// Haberin okuma sayısı. Kimin okuduğu saklanmaz: haber sayfası açılınca tarayıcı bu eylemi bir
// kez çağırır; aynı IP'den aynı habere günde bir okuma sayılır. Sayaç istek sınırı tablosundadır
// (lib/rate-limit.ts); anahtar IP ve haberin gizli anahtarla özetidir, IP'nin kendisi yazılmaz ve
// satır bir gün sonra temizlikte silinir. Çerez ya da tarayıcı deposu kullanılmaz.
//
// "IP" IPv6'da bütün /64 ağıdır (lib/request.ts): ağın içindeki adresleri değiştirerek okuma
// sayısı şişirilemez (güvenlik turu 4). Okul ağında bütün sınıf tek IP'den çıkar: o gün sınıftan
// bir okuma sayılır (sayı alt sınırdır).

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, type RateRule } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { liveWhere } from "./content";

const readRule: RateRule = { name: "news-read", max: 1, windowSec: 24 * 60 * 60 };

function readerKey(ip: string, articleId: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  // Oturum imzasıyla aynı gizli anahtar: girdinin başındaki etiket iki kullanımı birbirinden ayırır.
  return createHmac("sha256", secret).update(`news-read\n${ip}\n${articleId}`).digest("hex").slice(0, 40);
}

/** Yayındaki haberin okuma sayısını (bu IP'den bugün ilk okumaysa) bir artırır. */
export async function recordArticleRead(articleId: string): Promise<void> {
  if (typeof articleId !== "string" || articleId.length === 0 || articleId.length > 64) return;
  try {
    const live = await db.newsArticle.findFirst({ where: { id: articleId, ...liveWhere(new Date()) }, select: { id: true } });
    if (!live) return;
    const ip = clientIp(await headers());
    const { allowed } = await rateLimit.consume(readRule, readerKey(ip, live.id));
    if (!allowed) return;
    await db.newsArticle.update({ where: { id: live.id }, data: { readCount: { increment: 1 } }, select: { id: true } });
  } catch (error) {
    // Sayılamayan okuma öğrenciye hata olarak gösterilmez.
    console.error("[gündem] okuma sayılamadı:", error instanceof Error ? error.message : error);
  }
}
