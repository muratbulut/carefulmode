// Gündem yönetiminin ortak parçaları: sekmeler, durum rozetinin rengi ve eksikler satırı.

import { format, getMessages } from "@/lib/i18n";
import { readinessKeys, type ArticleState, type ReadinessKey } from "@/lib/news/content";

export type NewsTab = ArticleState;

/** Sekmenin adresteki adı (/yonetim/gundem?sekme=taslak); düzenleyiciden dönünce aynı sekme açılır. */
export const tabParams: Record<NewsTab, string> = { live: "yayinda", scheduled: "planli", draft: "taslak" };

export function tabFromParam(value: unknown): NewsTab {
  const found = (Object.keys(tabParams) as NewsTab[]).find((key) => tabParams[key] === value);
  return found ?? "live";
}

/** Durum rozeti: yayında yeşil, planlı mavi, taslak gri (Gundem-Son). Tailwind sınıfları tam yazılır. */
export const stateBadge: Record<ArticleState, string> = {
  live: "bg-success/12 text-success-fg",
  scheduled: "bg-accent/12 text-accent-fg",
  draft: "bg-fg-3/12 text-fg-3",
};

/** "Yayına hazır mı?" listesinin zorunlu maddeleri (yayın haftası hariç; lab önerilir). */
const contentKeys = readinessKeys.filter((key) => key !== "week" && key !== "lab");

/** Listedeki eksikler satırı: "6/8 hazır · eksik: kaynak, güvenilir kaynak" (ilk iki eksik). */
export function missingText(missing: readonly ReadinessKey[]) {
  const t = getMessages().news.admin;
  const names = missing.slice(0, 2).map((key) => t.editor.missingShort[key]);
  return format(t.partlyReady, { done: contentKeys.length - missing.length, total: contentKeys.length, missing: names.join(", ") });
}
