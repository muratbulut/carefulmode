"use client";

/**
 * Görevli odanın telefon sesleri, dosyasız (Web Audio ile üretilir): gelen aramanın zil sesi ve
 * SMS bildirimi. Ses kapalıysa (components/lab/sound.ts) çağıran hiç başlatmaz. Tarayıcı izin
 * vermezse (öğrenci sayfada henüz hiçbir şeye dokunmadıysa) ses sessizce çalmaz; ilk dokunuşta başlar.
 */

type Ctx = AudioContext;

function context(): Ctx | null {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Context ? new Context() : null;
  } catch {
    return null;
  }
}

/** Yumuşak, marimbaya benzer kısa nota. */
function note(ctx: Ctx, freq: number, at: number, length = 0.22, volume = 0.12) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

// Zil: dört notalık kısa melodi iki kez, sonra sessizlik; 2,6 saniyede bir tekrar.
const ringNotes = [659.25, 830.61, 987.77, 1318.51];
const ringEvery = 2.6;

function ringBar(ctx: Ctx, start: number) {
  for (let r = 0; r < 2; r++) ringNotes.forEach((f, i) => note(ctx, f, start + r * 0.62 + i * 0.13));
}

/** Telefon çalmaya başlar; dönen fonksiyon susturur. */
export function startRing(): () => void {
  const ctx = context();
  if (!ctx) return () => {};
  let next = 0;
  let timer = 0;
  let stopped = false;
  const schedule = () => {
    if (stopped) return;
    // Önümüzdeki iki çalışı zamanla; zamanlayıcı her çalışta bir sonrakini ekler.
    while (next < ctx.currentTime + ringEvery * 2) {
      ringBar(ctx, Math.max(next, ctx.currentTime + 0.05));
      next = Math.max(next, ctx.currentTime + 0.05) + ringEvery;
    }
    timer = window.setTimeout(schedule, ringEvery * 500);
  };
  const resume = () => void ctx.resume().catch(() => {});
  if (ctx.state === "suspended") {
    resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
  }
  next = ctx.currentTime + 0.05;
  schedule();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    void ctx.close().catch(() => {});
  };
}

/** SMS geldi: iki kısa nota. */
export function smsTone() {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime + 0.03;
  note(ctx, 1174.66, now, 0.18, 0.1);
  note(ctx, 1567.98, now + 0.16, 0.26, 0.1);
  window.setTimeout(() => void ctx.close().catch(() => {}), 900);
}

/** Yeni rozet: yükselen dört notalık parlak arpej (3 Kasım, 13. revize). */
export function badgeTone() {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime + 0.03;
  [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => note(ctx, f, now + i * 0.09, i === 3 ? 0.5 : 0.2, 0.1));
  window.setTimeout(() => void ctx.close().catch(() => {}), 1200);
}
