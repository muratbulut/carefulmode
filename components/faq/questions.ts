// SSS'nin yapısı (4 Kasım, Murat: tasarım B "Yanda konular"): 25 soru, 5 konu. Metinler sözlükte
// (t.faq.items); burada hangi sorunun hangi konuda olduğu, bağlantı adı (#slug) ve hangilerinin
// bu turda eklendiği (YENİ) durur. Bir konu açıkken yalnızca onun soruları görünür; arama bütün
// konularda arar.

import type { Messages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";

export type FaqQuestionId = keyof Messages["faq"]["items"];

export const faqTopics = ["general", "rooms", "students", "teachers", "privacy"] as const;
export type FaqTopic = (typeof faqTopics)[number];

/** `slug`: sorunun kendi bağlantısı (/sss#kilitli-odalar). `isNew`: listede "YENİ" işareti. */
export type FaqQuestion = { id: FaqQuestionId; topic: FaqTopic; slug: string; isNew?: boolean };

/** Tuvaldeki sırayla bütün sorular. */
export const faqQuestions: readonly FaqQuestion[] = [
  { id: "about", topic: "general", slug: "nedir" },
  { id: "free", topic: "general", slug: "ucretli-mi" },
  { id: "safe", topic: "general", slug: "odalar-guvenli-mi" },
  { id: "install", topic: "general", slug: "kurulum" },
  { id: "withoutAccount", topic: "general", slug: "hesapsiz" },
  { id: "news", topic: "general", slug: "gundem" },
  { id: "hacked", topic: "rooms", slug: "hacklenirsem" },
  { id: "locked", topic: "rooms", slug: "kilitli-odalar", isNew: true },
  { id: "caller", topic: "rooms", slug: "arayan-kim", isNew: true },
  { id: "report", topic: "rooms", slug: "oda-raporu", isNew: true },
  { id: "levels", topic: "rooms", slug: "seviye-rozet" },
  { id: "tip", topic: "rooms", slug: "gunun-ipucu", isNew: true },
  { id: "whoSees", topic: "students", slug: "puanimi-kim-gorur" },
  { id: "joinClass", topic: "students", slug: "sinifa-katil" },
  { id: "forgotPassword", topic: "students", slug: "sifremi-unuttum" },
  { id: "teacherAccount", topic: "teachers", slug: "ogretmen-hesabi" },
  { id: "teacherScores", topic: "teachers", slug: "ogrenci-puanlari" },
  { id: "homework", topic: "teachers", slug: "odev" },
  { id: "applicationRejected", topic: "teachers", slug: "talep-onaylanmadi" },
  { id: "school", topic: "teachers", slug: "okulum", isNew: true },
  { id: "dataStored", topic: "privacy", slug: "saklanan-bilgiler" },
  { id: "messaging", topic: "privacy", slug: "mesajlasma" },
  { id: "deleteAccount", topic: "privacy", slug: "hesap-silme" },
  { id: "family", topic: "privacy", slug: "aile-destegi" },
  { id: "parentHomework", topic: "privacy", slug: "veli-odev", isNew: true },
];

/** Açık konu adreste durur: /sss?konu=odalar (paylaşılınca aynı konu açılır). */
export const faqTopicParam = "konu";
export const topicParams: Record<FaqTopic, string> = {
  general: "genel",
  rooms: "odalar",
  students: "ogrenciler",
  teachers: "ogretmenler",
  privacy: "gizlilik",
};

/** Eski "Sen kimsin?" adresleri (/sss?ben=ogretmen) ilgili konuyu açar. */
const legacyRoleParam = "ben";
const legacyRoles: Record<string, FaqTopic> = { ogrenci: "students", ogretmen: "teachers", aile: "privacy", ziyaretci: "general" };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Adresteki konuyu okur (önce ?konu=, sonra eski ?ben=); bilinmeyen değer konusuz sayılır. */
export function parseFaqTopic(params: Params): FaqTopic | null {
  const topic = first(params[faqTopicParam]);
  const fromTopic = faqTopics.find((key) => topicParams[key] === topic);
  if (fromTopic) return fromTopic;
  const role = first(params[legacyRoleParam]);
  return role && Object.hasOwn(legacyRoles, role) ? legacyRoles[role] : null;
}

/** Konunun SSS adresi; konu yoksa düz /sss. */
export function faqHref(topic: FaqTopic | null): string {
  return topic ? `${routes.faq}?${faqTopicParam}=${topicParams[topic]}` : routes.faq;
}

/** Giriş yapmış kişinin varsayılan konusu: öğrenci Öğrenciler, öğretmen Öğretmenler; diğerleri Genel. */
export function defaultFaqTopic(userRole: string | null | undefined): FaqTopic {
  if (userRole === "STUDENT") return "students";
  if (userRole === "TEACHER") return "teachers";
  return "general";
}

export const questionsOf = (topic: FaqTopic) => faqQuestions.filter((q) => q.topic === topic);

export const questionBySlug = (slug: string) => faqQuestions.find((q) => q.slug === slug) ?? null;

/** Türkçe küçük harfe çevirip boşlukları sadeleştirir: "İPUCU" ile "ipucu" aynı aranır. */
export function normalizeQuery(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}
