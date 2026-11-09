// Öğretmenlik talebine eklenen belgenin kuralları (doküman Bölüm 8): PDF, JPG ya da PNG, en fazla
// 5 MB. Dosyanın türü adına ya da tarayıcının söylediği türe göre değil, ilk baytlarına
// ("sihirli baytlar") bakılarak bulunur. Sunucu (lib/teacher/application-actions.ts) ve tarayıcı
// (components/profile/teaching/prepare-document.ts) aynı kuralları kullanır; asıl denetim sunucudadır.

import { format, getMessages } from "@/lib/i18n";

export const documentRules = {
  maxBytes: 5 * 1024 * 1024,
  /** Görsel tarayıcıda yeniden çizilip küçültüleceği için seçilen ham dosya daha büyük olabilir. */
  maxImageInputBytes: 25 * 1024 * 1024,
  maxNameLength: 100,
  /** Görselin uzun kenarı en fazla bu kadar piksel olur. */
  imageMaxEdge: 2000,
  jpegQuality: 0.85,
} as const;

export type DocumentMime = "application/pdf" | "image/jpeg" | "image/png";

const signatures: { mime: DocumentMime; bytes: readonly number[] }[] = [
  // "%PDF-"
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/** Dosyanın ilk baytlarından türü; tanınmayan dosyada null. */
export function detectDocumentType(head: Uint8Array): DocumentMime | null {
  for (const { mime, bytes } of signatures) {
    if (head.length >= bytes.length && bytes.every((b, i) => head[i] === b)) return mime;
  }
  return null;
}

const extensions: Record<DocumentMime, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/**
 * Ekranda ve yönetimde görünen belge adı: klasör kısmı ve kontrol karakterleri atılır, uzantı
 * dosyanın gerçek türüne göre yazılır, ad en fazla 100 karakter olur. Ad boş kalırsa `fallback`.
 */
export function cleanDocumentName(name: string, mime: DocumentMime, fallback: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .normalize("NFC")
    // Kontrol karakterleri ve yön değiştiren Unicode işaretleri (ad başka uzantı gibi görünmesin).
    .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const stem = base.replace(/\.[^.]*$/, "").replace(/^\.+/, "").trim() || fallback;
  const ext = `.${extensions[mime]}`;
  return `${stem.slice(0, documentRules.maxNameLength - ext.length).trim()}${ext}`;
}

export type DocumentError = "size" | "type";

export type CheckedDocument = { mimeType: DocumentMime; data: Uint8Array<ArrayBuffer>; name: string; size: number };

/**
 * Formdan gelen belgeyi denetler. Alan boşsa (dosya seçilmemişse) `null`: belge isteğe bağlıdır.
 * Dosyanın içeriği okunur ve türü baytlarından bulunur; bildirilen tür ve uzantı yok sayılır.
 */
export async function readDocument(
  value: FormDataEntryValue | null,
  fallbackName: string,
): Promise<{ ok: true; document: CheckedDocument | null } | { ok: false; error: DocumentError }> {
  if (value === null || typeof value === "string") return { ok: true, document: null };
  if (value.size === 0) return value.name ? { ok: false, error: "type" } : { ok: true, document: null };
  if (value.size > documentRules.maxBytes) return { ok: false, error: "size" };
  const data = new Uint8Array(await value.arrayBuffer());
  if (data.byteLength > documentRules.maxBytes) return { ok: false, error: "size" };
  const mimeType = detectDocumentType(data);
  if (!mimeType) return { ok: false, error: "type" };
  return { ok: true, document: { mimeType, data, name: cleanDocumentName(value.name, mimeType, fallbackName), size: data.byteLength } };
}

/** "240 KB", "1,2 MB". */
export function formatFileSize(bytes: number): string {
  const units = getMessages().teaching.size;
  if (bytes < 1024 * 1024) return format(units.kb, { n: Math.max(1, Math.round(bytes / 1024)) });
  return format(units.mb, { n: new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024)) });
}
