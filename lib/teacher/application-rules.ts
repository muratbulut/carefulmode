// Öğretmenlik talebi formunun kuralları (Tur 4, 17 son hali: Ogretmenlik-Son, -Bilgi). Tarayıcı
// formu bunlarla denetler ki eksik alan hemen görünsün; sunucu eylemleri
// (lib/teacher/application-actions.ts) aynı kurallarla yeniden denetler ve tarayıcıya güvenmez.

import * as z from "@/lib/zod";
import { cleanSchoolName, schoolNameOk } from "@/lib/school/names";
import { isPlace } from "@/lib/school/places";

export const applicationLimits = {
  subject: { min: 2, max: 60 },
  /** Bilgi istendiğinde yazılan cevap (belge eklenmediyse en az 5 karakter). */
  answer: { min: 5, max: 300 },
  email: 254,
} as const;

/** Okul listesinde "Okulum listede yok" seçeneğinin değeri. */
export const newSchoolChoice = "new";

/** Baştaki, sondaki ve arka arkaya boşluklar atılır. */
export function cleanLine(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Okul kimliği (cuid): yalnızca harf, rakam, - ve _. */
export function isSchoolId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value);
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(applicationLimits.email));

export type SchoolChoice = { kind: "listed"; id: string } | { kind: "new"; name: string };

export type ApplicationInput = {
  province: string;
  district: string;
  school: SchoolChoice;
  subject: string;
  institutionalEmail: string | null;
};

/** Hatalı alanlar. Mesajlar sözlükte: teaching.errors[alan]. */
export type ApplicationField = "place" | "school" | "newSchoolName" | "subject" | "institutionalEmail";

export type RawApplication = Record<"province" | "district" | "school" | "newSchoolName" | "subject" | "institutionalEmail", unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Formdan gelen değerleri denetler; geçerliyse temizlenmiş halini döner. */
export function parseApplication(raw: RawApplication): { ok: true; value: ApplicationInput } | { ok: false; errors: ApplicationField[] } {
  const errors: ApplicationField[] = [];
  const province = text(raw.province);
  const district = text(raw.district);
  const placeOk = isPlace(province, district);
  if (!placeOk) errors.push("place");

  let school: SchoolChoice | null = null;
  const choice = text(raw.school);
  if (choice === newSchoolChoice) {
    const name = cleanSchoolName(text(raw.newSchoolName));
    if (schoolNameOk(name)) school = { kind: "new", name };
    else if (placeOk) errors.push("newSchoolName");
  } else if (isSchoolId(choice)) {
    school = { kind: "listed", id: choice };
  } else if (placeOk) {
    errors.push("school");
  }

  const subject = cleanLine(text(raw.subject));
  const { min, max } = applicationLimits.subject;
  if (subject.length < min || subject.length > max || !/\p{L}/u.test(subject)) errors.push("subject");

  let institutionalEmail: string | null = null;
  const email = text(raw.institutionalEmail).trim();
  if (email) {
    const parsed = emailSchema.safeParse(email);
    if (parsed.success) institutionalEmail = parsed.data;
    else errors.push("institutionalEmail");
  }

  if (errors.length > 0 || !school) return { ok: false, errors: errors.length > 0 ? errors : ["school"] };
  return { ok: true, value: { province, district, school, subject, institutionalEmail } };
}

/**
 * Bilgi istendiğinde yazılan cevap: satır sonları kalır, kontrol karakterleri atılır, üst üste
 * boş satırlar teke iner. Belge eklendiyse cevap boş olabilir; eklenmediyse en az 5 karakter.
 */
export function parseAnswer(value: unknown, hasDocument: boolean): { ok: true; value: string | null } | { ok: false } {
  const answer = text(value)
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (answer.length > applicationLimits.answer.max) return { ok: false };
  if (answer.length < applicationLimits.answer.min && !hasDocument) return { ok: false };
  return { ok: true, value: answer || null };
}
