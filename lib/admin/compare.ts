// Lab içeriği karşılaştırma ve yayına hazırlık. Hem sunucuda (eylemler, liste) hem lab düzenleme
// formunda (canlı "Değişiklik yok" ve "Yayına hazır mı?") aynı fonksiyonlar çalışır. Saf modül.

import { isReady, scenarioChecklist, trainingChecklist } from "@/lib/lab/checklist";
import type { LabContent, ScenarioContent, Template, TrainingContent } from "@/lib/lab/content";

/** Alan sırasından bağımsız JSON metni (iki içeriği karşılaştırmak ve özetlemek için). */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : v,
  );
}

/** İki içerik aynı mı (alan sırası önemsiz). "Değişiklik yok" ve "yayınlanmamış değişiklik" için. */
export function sameContent(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

export function checklistFor(template: Template, content: LabContent) {
  return template === "TRAINING"
    ? trainingChecklist(content as TrainingContent)
    : scenarioChecklist(content as ScenarioContent, template);
}

export function isPublishable(template: Template, content: LabContent) {
  return isReady(checklistFor(template, content));
}
