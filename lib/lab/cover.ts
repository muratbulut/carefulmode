import type { MissionCoverData } from "@/components/lab/detail/types";
import type { ScenarioContent } from "./content";

/**
 * Görevli odanın kapak görseli (MissionCover): arayan, görevin ürünü ya da ilanı, ilk iki öğenin
 * gönderenleri. Görevi olmayan ya da ne alış ne satış olan odada null (bildirim telefonu kalır).
 */
export function coverOf(lab: { scenario: ScenarioContent | null }): MissionCoverData | null {
  const mission = lab.scenario?.mission;
  if (!mission) return null;
  const deal = mission.sale ?? mission.shop;
  if (!deal) return null;
  const names: string[] = [];
  const senders = (lab.scenario?.items.slice(0, 2) ?? []).map((item) => {
    const name = item.sender.trim();
    if (!names.includes(name)) names.push(name);
    return {
      initial: (name.at(0) ?? "?").toLocaleUpperCase("tr-TR"),
      tone: names.indexOf(name),
    };
  });
  return {
    caller: mission.caller,
    look: mission.look,
    kind: mission.sale ? "sale" : "shop",
    icon: deal.icon,
    price: deal.price,
    senders,
    steps: Math.min(mission.sale?.prep.length ?? 0, 3),
    badge: mission.sale ? null : (mission.coverIcon ?? null),
  };
}
