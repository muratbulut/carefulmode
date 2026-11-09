import { after } from "next/server";
import { cache } from "react";
import { getTodayTip, recordTipView } from "@/lib/tips/data";
import { dayLabel } from "@/lib/tips/format";
import { TipCard } from "./TipCard";

type Fallback = { text: string; reason: string; date: string };

// Ana sayfada kart iki yerde çizilir (masaüstü yan sütun, telefon "Bugün" şeridi); görülme
// kaydı istek başına bir kez planlanır ve yanıt gittikten sonra yazılır.
const recordOnce = cache((userId: string, tipId: string, day: string) => {
  after(() => recordTipView(userId, tipId, day));
});

/**
 * Öğrencinin ana sayfasındaki günün ipucu: bugünün ipucu, havuz boşsa hazır gelen ipucu
 * (`fallback`; o zaman hiçbir şey kaydedilmez). Kartı gören öğrenci için günde bir görülme
 * satırı yazılır; "Neden?" o satırı işaretler (TipCard).
 */
export async function TodayTip({ userId, fallback, className }: { userId: string; fallback: Fallback; className?: string }) {
  const tip = await getTodayTip();
  if (!tip) return <TipCard {...fallback} className={className} />;
  recordOnce(userId, tip.id, tip.date);
  return <TipCard text={tip.text} reason={tip.reason} date={dayLabel(tip.date)} tipId={tip.id} className={className} />;
}
