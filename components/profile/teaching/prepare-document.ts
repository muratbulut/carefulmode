// Seçilen belgeyi gönderime hazırlar (yalnızca tarayıcıda). Türü ilk baytlarından bulunur
// (lib/teacher/document.ts). JPG ve PNG bir tuvale yeniden çizilip JPEG olarak kaydedilir: uzun
// kenar en fazla 2000 piksel olur ve fotoğraftaki konum, cihaz gibi gizli bilgiler (EXIF) gitmez.
// PDF olduğu gibi gönderilir. Sunucu dosyayı yine de kendisi denetler.

import { cleanDocumentName, detectDocumentType, documentRules } from "@/lib/teacher/document";

export type PreparedDocument = { file: File; name: string; size: number };

export type PrepareError = "size" | "type" | "unreadable";

export async function prepareDocument(file: File, fallbackName: string): Promise<{ ok: true; document: PreparedDocument } | { ok: false; error: PrepareError }> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const mime = detectDocumentType(head);
  if (!mime) return { ok: false, error: "type" };

  if (mime === "application/pdf") {
    if (file.size > documentRules.maxBytes) return { ok: false, error: "size" };
    const name = cleanDocumentName(file.name, mime, fallbackName);
    return { ok: true, document: { file: new File([file], name, { type: mime }), name, size: file.size } };
  }

  if (file.size > documentRules.maxImageInputBytes) return { ok: false, error: "size" };
  const blob = await redrawImage(file);
  if (!blob) return { ok: false, error: "unreadable" };
  if (blob.size > documentRules.maxBytes) return { ok: false, error: "size" };
  const name = cleanDocumentName(file.name, "image/jpeg", fallbackName);
  return { ok: true, document: { file: new File([blob], name, { type: "image/jpeg" }), name, size: blob.size } };
}

/** Görseli küçültüp beyaz zemin üstüne yeniden çizer (PNG'nin saydam yerleri siyah çıkmasın). */
async function redrawImage(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    // Fotoğrafın yönü (EXIF) çizimden önce uygulanır, sonra bilgi atılır.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, documentRules.imageMaxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", documentRules.jpegQuality));
  } finally {
    bitmap.close();
  }
}
