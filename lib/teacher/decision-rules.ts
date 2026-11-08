// Öğretmen talebi kararlarının saf kuralları: geri al süresi, ret notu ve soru uzunluğu, hangi
// kayıtların geri alınacağı, kararın sonuçlarının (mail, belge silme) ne zaman uygulanacağı.
// lib/teacher/decide.ts kullanır; veritabanına dokunmaz, birim testlidir.

import type { AuditAction } from "@/lib/audit";

/**
 * "Geri al" süresi. Ekrandaki bildirim 5 saniye durur; sunucu yavaş bağlantıyı da düşünerek
 * 30 saniyeye kadar kabul eder. Mail ve belge silme bu süre bitmeden yapılmaz.
 */
export const undoWindowMs = 30_000;

/** Kararın sonuçları (mail, belge silme) geri al süresinden biraz sonra uygulanır. */
export const finalizeDelayMs = undoWindowMs + 5_000;

/**
 * Karar maili gönderilemezse (mail servisi kapalı gibi) saatlik temizlik bu süre boyunca yeniden
 * dener. Belge ise süre sınırı olmadan, karar kesinleşince her zaman silinir.
 */
export const mailRetryMs = 7 * 24 * 60 * 60 * 1000;

/** Ret notu öğretmenin profiline gider (doküman Bölüm 3): en az 10 karakter. */
export const rejectionNoteLimits = { min: 10, max: 500 } as const;

/** "Bilgi iste" sorusu öğretmenin profiline gider. */
export const questionLimits = { min: 10, max: 500 } as const;

/** Serbest metin: baştaki ve sondaki boşluk atılır, satır içi boşluklar ve boş satırlar sadeleşir. */
export function cleanText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textOk(value: string, limits: { min: number; max: number }): boolean {
  return value.length >= limits.min && value.length <= limits.max;
}

/** Geri alınabilen kararlar (kayıt defterindeki türleri). */
export const decisionActions = [
  "application.approved",
  "application.rejected",
  "application.info_requested",
  "application.endorsed",
  "application.not_recognized",
] as const satisfies readonly AuditAction[];

export type DecisionAction = (typeof decisionActions)[number];

export const isDecisionAction = (action: string): action is DecisionAction => (decisionActions as readonly string[]).includes(action);

export type DecisionEntry = { id: string; actorId: string; action: string; createdAt: Date };

const newestFirst = (a: DecisionEntry, b: DecisionEntry) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * "Geri al" neyi geri alır? Talebin kayıtları en yeniden geriye okunur: aynı kişinin süre
 * içindeki kesintisiz kararları birlikte geri alınır (Okulum'daki "Okulumda çalışıyor, onayla"
 * hem görüş hem onay yazar, ikisi birden döner). Arada başka birinin kaydı, daha önce yapılmış bir
 * geri alma ya da gönderilmiş mail varsa orada durulur. Boş liste: geri alınacak bir şey yok.
 */
export function entriesToUndo<T extends DecisionEntry>(entries: readonly T[], actorId: string, now: Date): T[] {
  const result: T[] = [];
  for (const entry of [...entries].sort(newestFirst)) {
    if (!isDecisionAction(entry.action) || entry.actorId !== actorId) break;
    const age = now.getTime() - entry.createdAt.getTime();
    if (age > undoWindowMs || age < -5_000) break;
    result.push(entry);
  }
  return result;
}

export type FinalizeKind = "approved" | "rejected" | "infoRequested";

type ApplicationState = { status: "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED"; decidedAt: Date | null; questionAt: Date | null };

/** Kararın türü ve zamanı (mail ve belge silme için); bekleyen talepte null. */
export function decisionOf(app: ApplicationState): { kind: FinalizeKind; at: Date } | null {
  if (app.status === "APPROVED" && app.decidedAt) return { kind: "approved", at: app.decidedAt };
  if (app.status === "REJECTED" && app.decidedAt) return { kind: "rejected", at: app.decidedAt };
  if (app.status === "INFO_REQUESTED" && app.questionAt) return { kind: "infoRequested", at: app.questionAt };
  return null;
}

/** Geri al süresi bitti mi? Bitmeden ne mail gider ne belge silinir. */
export function undoWindowOver(at: Date, now: Date): boolean {
  return now.getTime() - at.getTime() >= undoWindowMs;
}

/** Belge yalnızca kesin kararda (onay ya da ret) silinir; bilgi istenince öğretmen belge ekleyebilir. */
export const deletesDocument = (kind: FinalizeKind) => kind !== "infoRequested";
