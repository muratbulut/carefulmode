// Yeni labın ilk taslağı: şablona göre boş ama geçerli içerik ya da "örnek içerikle başla"
// seçildiyse şablonun örnek labı (labs/examples/). Örnekler derlemeye gömülür; sunucuda
// dosya okunmaz. Örnekler yayındaki labların doğru cevaplarını içerir: "server-only" bu dosya
// yanlışlıkla bir tarayıcı bileşenine eklenirse derlemeyi durdurur.

import "server-only";
import inboxExample from "@/labs/examples/sahte-kargo-maili.json";
import messagingExample from "@/labs/examples/kodu-soran-arkadas.json";
import trainingExample from "@/labs/examples/oltalama-egitimi.json";
import { scenarioSchema, trainingSchema, type LabContent, type Template } from "@/lib/lab/content";

const examples: Record<Template, unknown> = {
  TRAINING: trainingExample.content,
  INBOX: inboxExample.content,
  MESSAGING: messagingExample.content,
};

/** Şablonun boş taslağı: yalnızca ad dolu, geri kalanı varsayılan. */
export function emptyContent(template: Template, name: string): LabContent {
  const input = { meta: { name } };
  return template === "TRAINING" ? trainingSchema.parse(input) : scenarioSchema.parse(input);
}

/** Şablonun örnek labının kopyası; adı verilen adla değişir. */
export function exampleContent(template: Template, name: string): LabContent {
  const copy = structuredClone(examples[template]) as { meta: Record<string, unknown> };
  copy.meta = { ...copy.meta, name };
  return template === "TRAINING" ? trainingSchema.parse(copy) : scenarioSchema.parse(copy);
}
