"use server";

// Rozet vitrini (Profil-Son): kazanılan bir rozet vitrine eklenir ya da çıkarılır. Vitrin en
// fazla 5 rozettir ve ana sayfadaki profil kartında görünür. Rozetin kazanılmış olduğu sunucuda
// EarnedBadge kaydına bakılarak doğrulanır; tarayıcının söylediğine güvenilmez.

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { getUser } from "@/lib/session";
import { isBadgeCode, showcaseSize, type BadgeCode } from "./badges";

export type ShowcaseResult =
  | { ok: true; showcase: BadgeCode[]; added: boolean }
  | { ok: false; reason: "auth" | "invalid" | "not_earned" | "full" | "rate_limited" };

export async function toggleShowcase(code: string): Promise<ShowcaseResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "auth" };
  if (typeof code !== "string" || !isBadgeCode(code)) return { ok: false, reason: "invalid" };
  const limit = await rateLimit.consume(rateRules.labActions, user.id);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const result = await db.$transaction(async (tx) => {
    const rows = await tx.earnedBadge.findMany({ where: { userId: user.id }, select: { badgeCode: true, showcaseOrder: true } });
    const row = rows.find((r) => r.badgeCode === code);
    if (!row) return { ok: false as const, reason: "not_earned" as const };

    const current = rows
      .filter((r) => r.showcaseOrder !== null && isBadgeCode(r.badgeCode))
      .sort((a, b) => a.showcaseOrder! - b.showcaseOrder!)
      .map((r) => r.badgeCode as BadgeCode);
    const added = !current.includes(code);
    if (added && current.length >= showcaseSize) return { ok: false as const, reason: "full" as const };
    const next = added ? [...current, code] : current.filter((c) => c !== code);

    // Sıra boşluksuz yeniden yazılır (0, 1, 2...).
    await tx.earnedBadge.updateMany({ where: { userId: user.id }, data: { showcaseOrder: null } });
    for (const [index, badge] of next.entries()) {
      await tx.earnedBadge.update({ where: { userId_badgeCode: { userId: user.id, badgeCode: badge } }, data: { showcaseOrder: index } });
    }
    return { ok: true as const, showcase: next, added };
  });

  if (result.ok) refresh();
  return result;
}
