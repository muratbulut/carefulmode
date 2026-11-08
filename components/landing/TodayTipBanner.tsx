import { dailyTip } from "@/lib/content/landing";
import { getTodayTip } from "@/lib/tips/data";
import { TipBanner } from "./TipBanner";

/**
 * Tanıtım sayfasındaki günün ipucu: öğrencinin bugün gördüğü ipucu. Havuz boşsa (ekip henüz ipucu
 * yazmadıysa) hazır gelen ipucu. Ziyaretçi için görülme kaydı tutulmaz.
 */
export async function TodayTipBanner() {
  const tip = (await getTodayTip()) ?? dailyTip;
  return <TipBanner text={tip.text} reason={tip.reason} />;
}
