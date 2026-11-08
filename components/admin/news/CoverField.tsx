"use client";

import { useId, useRef, useState, useTransition, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ImagePlus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { CoverImage } from "@/components/news/CoverImage";
import { Spinner } from "@/components/status/Spinner";
import { format, getMessages } from "@/lib/i18n";
import { removeNewsCover, uploadNewsCover, type NewsActionError } from "@/lib/news/actions";
import { clampFocus, coverRules, scaledSize, type CoverView } from "@/lib/news/cover";
import { cn } from "@/lib/utils";
import { inputClass } from "../editor/fields";

/** Sunucudaki kapak (yüklendikten sonra); odak, alt metin ve kaynak formda durur. */
export type SavedCover = { src: string; width: number; height: number };

export type CoverMeta = { focusX: number; focusY: number; alt: string; credit: string };

/**
 * Formdaki "Kapak görseli" bölümü (4 Kasım, Murat: 15). Her boyutta görsel seçilir; tarayıcı
 * onu yeniden çizer (en çok 1600 px genişlik, WebP; tarayıcı WebP yazamıyorsa JPEG). Yeniden
 * çizmek EXIF'i (konum, cihaz) siler. Görsel hemen yüklenir (taslak kaydetmeyi beklemez); odak
 * noktası, alt metin ve kaynak formla birlikte kaydedilir. Görselin üstüne tıklamak (ya da ok
 * tuşları) odak noktasını seçer; altta haber kapağı, liste ve telefon kırpımları görünür.
 * Görsel yokken haber konunun çizimiyle görünür.
 */
export function CoverField({
  articleId,
  cover,
  onCover,
  meta,
  onMeta,
  topic,
  onError,
  onDone,
}: {
  articleId: string | null;
  cover: SavedCover | null;
  onCover: (cover: SavedCover | null) => void;
  meta: CoverMeta;
  onMeta: (meta: CoverMeta) => void;
  topic: { color: string; icon: string } | null;
  onError: (error: NewsActionError | "coverUnreadable") => void;
  onDone: (message: string) => void;
}) {
  const t = getMessages().news.admin.cover;
  const inputRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const creditId = useId();
  const [busy, setBusy] = useState<null | "upload" | "remove">(null);
  const [dragging, setDragging] = useState(false);
  /** Seçilen dosyanın asıl boyutu (yalnızca bu oturumda; küçük görsel uyarısı için). */
  const [picked, setPicked] = useState<{ width: number; height: number } | null>(null);
  const [, startTransition] = useTransition();

  const view: CoverView | null = cover ? { ...cover, ...meta } : null;
  const small = picked ? picked.width < coverRules.minSharpWidth : cover ? cover.width < coverRules.minSharpWidth : false;
  const setFocus = (x: number, y: number) => onMeta({ ...meta, focusX: clampFocus(x), focusY: clampFocus(y) });

  function pick(file: File | undefined) {
    if (!file || !articleId || busy) return;
    if (file.size > coverRules.maxInputBytes) return onError("coverInvalid");
    const id = articleId;
    setBusy("upload");
    startTransition(async () => {
      try {
        const drawn = await redraw(file);
        if (!drawn) return onError("coverUnreadable");
        const form = new FormData();
        form.set("file", drawn.blob, drawn.blob.type === "image/webp" ? "kapak.webp" : "kapak.jpg");
        const result = await uploadNewsCover(id, form);
        if (!result.ok) return onError(result.error);
        setPicked(drawn.original);
        onCover({ src: result.src, width: result.width, height: result.height });
        onDone(cover ? t.replaced : t.uploaded);
      } catch {
        onError("failed");
      } finally {
        setBusy(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove() {
    if (!articleId || busy) return;
    const id = articleId;
    setBusy("remove");
    startTransition(async () => {
      try {
        const result = await removeNewsCover(id);
        if (!result.ok) return onError(result.error);
        setPicked(null);
        onCover(null);
        onDone(t.removed);
      } catch {
        onError("failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  const hidden = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => pick(event.target.files?.[0])}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {!articleId ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-deep px-4 py-5 text-sm leading-normal text-fg-3">
          <ImagePlus className="size-5 flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
          {t.saveFirst}
        </div>
      ) : !view ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors",
            dragging ? "border-accent bg-accent/8" : "border-line bg-surface-deep",
          )}
        >
          <ImagePlus className="size-7 text-accent-fg" strokeWidth={1.8} aria-hidden="true" />
          <span className="flex flex-col gap-1">
            <b className="text-[15px] text-fg">{t.dropTitle}</b>
            <span className="text-[13px] leading-normal text-fg-3">{format(t.recommended, coverRules.recommended)}</span>
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
            data-testid="cover-pick"
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-60"
          >
            {busy === "upload" ? <Spinner /> : null}
            {busy === "upload" ? t.uploading : t.pick}
          </button>
          {hidden}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-bold text-fg-2">{t.focus}</span>
          <FocusPicker view={view} onFocus={setFocus} />
          <span className="text-xs leading-normal text-fg-4">{t.focusHint}</span>
          {small ? (
            <span role="status" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/8 px-3 py-2.5 text-[13px] leading-normal text-warning-fg">
              <TriangleAlert className="mt-px size-4 flex-none" strokeWidth={2} aria-hidden="true" />
              {format(t.small, { width: (picked ?? view).width, height: (picked ?? view).height, min: coverRules.minSharpWidth })}
            </span>
          ) : null}
          <div className="grid grid-cols-[minmax(0,16fr)_minmax(0,9fr)_minmax(0,7.2fr)] items-end gap-2.5">
            <Crop label={t.crops.article} className="aspect-video" view={view} topic={topic} />
            <Crop label={t.crops.list} className="aspect-square" view={view} topic={topic} />
            <Crop label={t.crops.phone} className="aspect-[4/5]" view={view} topic={topic} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              data-testid="cover-pick"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-deep px-3.5 text-sm font-bold text-fg disabled:opacity-60"
            >
              {busy === "upload" ? <Spinner /> : <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />}
              {busy === "upload" ? t.uploading : t.replace}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-transparent px-3.5 text-sm font-bold text-fg-3 hover:text-danger-fg disabled:opacity-60"
            >
              {busy === "remove" ? <Spinner /> : <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />}
              {t.remove}
            </button>
            {hidden}
          </div>
          <span className="text-xs leading-normal text-fg-4">{t.immediate}</span>
        </div>
      )}

      {!view ? (
        <div className="flex items-center gap-3">
          <CoverImage cover={null} topic={topic} className="aspect-video w-[132px] flex-none rounded-xl" />
          <span className="text-[13px] leading-normal text-fg-3">{t.fallback}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-[2_1_300px]">
          <span className="flex items-baseline justify-between gap-3">
            <label htmlFor={altId} className="text-sm font-bold text-fg-2">
              {t.alt}
            </label>
            <span className="text-xs text-fg-4">{format(getMessages().news.admin.editor.counter, { n: meta.alt.length, max: coverRules.alt })}</span>
          </span>
          <input
            id={altId}
            type="text"
            value={meta.alt}
            maxLength={coverRules.alt}
            placeholder={t.altPlaceholder}
            aria-describedby={`${altId}-note`}
            onChange={(event) => onMeta({ ...meta, alt: event.target.value })}
            className={cn(inputClass, "h-[46px] text-[15px]")}
          />
          <span id={`${altId}-note`} className={cn("text-xs leading-[1.45]", view && !meta.alt.trim() ? "text-warning-fg" : "text-fg-4")}>
            {view && !meta.alt.trim() ? t.altMissing : t.altHint}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-[1_1_200px]">
          <label htmlFor={creditId} className="text-sm font-bold text-fg-2">
            {t.credit}
          </label>
          <input
            id={creditId}
            type="text"
            value={meta.credit}
            maxLength={coverRules.credit}
            placeholder={t.creditPlaceholder}
            aria-describedby={`${creditId}-note`}
            onChange={(event) => onMeta({ ...meta, credit: event.target.value })}
            className={cn(inputClass, "h-[46px] text-[15px]")}
          />
          <span id={`${creditId}-note`} className="text-xs leading-[1.45] text-fg-4">
            {t.creditHint}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Görselin tamamı; tıklanan yer (ya da ok tuşları, 5'er) odak noktası olur. */
function FocusPicker({ view, onFocus }: { view: CoverView; onFocus: (x: number, y: number) => void }) {
  const t = getMessages().news.admin.cover;
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    onFocus(((event.clientX - box.left) / box.width) * 100, ((event.clientY - box.top) / box.height) * 100);
  }
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onFocus(view.focusX + move[0], view.focusY + move[1]);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={format(t.focusLabel, { x: view.focusX, y: view.focusY })}
      data-testid="cover-focus"
      className="relative mx-auto block cursor-crosshair overflow-hidden rounded-xl border border-line bg-surface-deep p-0"
      // En çok 360 px yükseklik: genişlik orana göre daralır, böylece kutu görselle birebir örtüşür
      // (tıklanan yer görselin aynı yüzdesidir, kenarda boşluk kalmaz).
      style={{ aspectRatio: `${view.width} / ${view.height}`, width: `min(100%, ${Math.round((360 * view.width) / view.height)}px)` }}
    >
      {/* Kapak bizim sunucumuzdan (CSP img-src 'self'); next/image dönüştürücüsü kullanılmıyor. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={view.src} alt={""} width={view.width} height={view.height} className="absolute inset-0 size-full object-contain" draggable={false} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-scene-white bg-accent/40 shadow-[0_0_0_2px_var(--color-scene-scrim)]"
        style={{ left: `${view.focusX}%`, top: `${view.focusY}%` }}
      />
    </button>
  );
}

function Crop({ label, className, view, topic }: { label: string; className: string; view: CoverView; topic: { color: string; icon: string } | null }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1.5">
      <CoverImage cover={view} topic={topic} className={cn("w-full rounded-lg", className)} />
      <figcaption className="truncate text-[11px] font-bold tracking-wide text-fg-4 uppercase">{label}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------
// Yeniden çizim
// ---------------------------------------------------------------------------------------

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Dosyayı açar (EXIF'teki yöne göre döndürülmüş), en çok 1600 px genişliğe küçültür ve WebP
 * (yazamıyorsa JPEG) olarak yeniden yazar. Yeniden yazılan dosyada EXIF yoktur. 2 MB'ı geçerse
 * kalite düşürülür. Açılamayan dosyada null.
 */
async function redraw(file: File): Promise<{ blob: Blob; original: { width: number; height: number } } | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const original = { width: bitmap.width, height: bitmap.height };
    if (original.width < 1 || original.height < 1) return null;
    const size = scaledSize(original.width, original.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    const draw = (opaque: boolean) => {
      context.clearRect(0, 0, size.width, size.height);
      if (opaque) {
        // JPEG saydamlık tutmaz: saydam yerler sahnenin beyazıyla dolar (tema değişkeni).
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--scene-white").trim() || "white";
        context.fillRect(0, 0, size.width, size.height);
      }
      context.drawImage(bitmap, 0, 0, size.width, size.height);
    };
    for (const type of ["image/webp", "image/jpeg"] as const) {
      draw(type === "image/jpeg");
      for (const quality of [coverRules.quality, 0.75, 0.6]) {
        const blob = await toBlob(canvas, type, quality);
        // Bazı tarayıcılar WebP yazamaz ve PNG verir: o zaman JPEG denenir.
        if (!blob || blob.type !== type) break;
        if (blob.size <= coverRules.maxBytes) return { blob, original };
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
