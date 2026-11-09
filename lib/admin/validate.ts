// Lab düzenleme formundan gelen içeriğin sunucu denetimi. Biçim lib/lab/content.ts şemasıyla
// denetlenir; şemanın tek tek bakamadığı kurallar burada: kimlikler lab içinde tekil olmalı ve
// işaretin yeri şablona uymalı (gelen kutusunda "İstek", mesajlaşmada "Bağlantı" yok).
// Saf fonksiyon; birim testli.

import { schemaFor, type LabContent, type SignPlace, type Template } from "@/lib/lab/content";

/** Şablonun işaret yerleri, formdaki sırayla (Lab-Duzenle-Son: Gönderen, Metin, Bağlantı / İstek). */
export const signPlacesFor: Record<Exclude<Template, "TRAINING">, readonly SignPlace[]> = {
  INBOX: ["sender", "text", "link"],
  MESSAGING: ["sender", "text", "ask"],
};

export type ContentCheck = { ok: true; content: LabContent } | { ok: false; issues: string[] };

const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

/**
 * Kaydedilmiş taslak okunabiliyor mu (güvenlik turu 2, D8)? Şema sıkılaşınca (ör. artık izin
 * verilmeyen bir video adresi) eski taslak şemaya uymaz; form onu boş ya da yayındaki haliyle
 * açar. Uymayan alanların yolunu (en fazla 10) döner, okunabiliyorsa null. Okunamayan taslağın
 * üstüne kaydetme ve yayınlama yazmaz: geliştirici veriyi düzeltir (migration).
 */
export function draftIssues(template: Template, json: unknown): string[] | null {
  const parsed = schemaFor(template).safeParse(json);
  if (parsed.success) return null;
  const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "content");
  return [...new Set(paths)].slice(0, 10);
}

export function validateContent(template: Template, input: unknown): ContentCheck {
  const parsed = schemaFor(template).safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => issue.path.join(".") || "content") };
  }
  const content = parsed.data;
  const issues: string[] = [];

  if ("cards" in content) {
    for (const id of duplicates(content.cards.map((c) => c.id))) issues.push(`cards.${id}`);
    content.cards.forEach((card, i) => {
      if (card.type === "quiz" && card.answer >= card.options.length) issues.push(`cards.${i}.answer`);
      if (card.type === "video" && card.question && card.question.answer >= card.question.options.length) {
        issues.push(`cards.${i}.question.answer`);
      }
    });
  } else {
    const places = signPlacesFor[template as Exclude<Template, "TRAINING">];
    for (const id of duplicates(content.items.map((i) => i.id))) issues.push(`items.${id}`);
    for (const id of duplicates(content.tasks.map((t) => t.id))) issues.push(`tasks.${id}`);
    content.items.forEach((item, i) => {
      item.signs.forEach((sign, j) => {
        if (!places.includes(sign.at)) issues.push(`items.${i}.signs.${j}.at`);
      });
    });
  }
  return issues.length ? { ok: false, issues } : { ok: true, content };
}
