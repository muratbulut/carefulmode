// Tanıtım sayfasındaki sahnelerin dönme sırası ve sayacı. React'ten bağımsız: sıra saf
// fonksiyonlarla, süre duraklatılabilen bir sayaçla, ikisi birlikte HeroScenes'in okuduğu küçük bir
// depoyla yürür (tests/unit/hero-scenes.test.ts).

/** Bir sahnenin ekranda kalma süresi. */
export const SCENE_MS = 10_000;
/** Çapraz solma süresi; giden sahne bu kadar sonra kaldırılır. */
export const FADE_MS = 600;

export type Random = () => number;

/**
 * 0..count-1 arasındaki sahneleri karıştırır (Fisher-Yates). Yeni turun ilki bir önceki turun son
 * sahnesiyle aynı çıkarsa ikinciyle yer değiştirir: aynı sahne arka arkaya gelmez.
 */
export function shuffleScenes(count: number, previous: number | null, random: Random = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (count > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

/** Bu ziyaretin sırası ve sıradaki yer. */
export type Rotation = { order: number[]; position: number };

export function startRotation(count: number, random: Random = Math.random): Rotation {
  return { order: shuffleScenes(count, null, random), position: 0 };
}

export function currentScene(rotation: Rotation): number {
  return rotation.order[rotation.position];
}

/** Sıradaki sahneye geçer; tur bitince yeniden karıştırır. */
export function nextRotation(rotation: Rotation, random: Random = Math.random): Rotation {
  if (rotation.position + 1 < rotation.order.length) return { ...rotation, position: rotation.position + 1 };
  return { order: shuffleScenes(rotation.order.length, currentScene(rotation), random), position: 0 };
}

/**
 * Duraklatılabilen geri sayım. Bir ya da daha çok "tutma" nedeni (fare üstünde, sekme arka planda,
 * hareketi azalt) varken durur, hepsi kalkınca kalan süreden devam eder. Süre dolunca onDone
 * çağrılır ve sayaç yeni bir tam süreyle yeniden kurulur.
 */
export class Countdown {
  private readonly holds = new Set<string>();
  private remaining: number;
  private due = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly duration: number,
    private readonly onDone: () => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.remaining = duration;
  }

  /** Bir tutma nedenini koyar ya da kaldırır. */
  hold(reason: string, held: boolean) {
    if (held) {
      this.holds.add(reason);
      this.pause();
    } else {
      this.holds.delete(reason);
      this.run();
    }
  }

  get running() {
    return this.timer !== null;
  }

  stop() {
    this.stopped = true;
    this.pause();
  }

  private run() {
    if (this.stopped || this.timer !== null || this.holds.size > 0) return;
    this.due = this.now() + this.remaining;
    this.timer = setTimeout(() => this.fire(), this.remaining);
  }

  private pause() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.remaining = Math.max(0, this.due - this.now());
  }

  private fire() {
    this.timer = null;
    this.remaining = this.duration;
    this.onDone();
    this.run();
  }
}

/** Ekrandaki katman: `key` her gösterimde yenidir, böylece sahne yeniden kurulur ve animasyonu baştan başlar. */
export type SceneLayer = { key: number; scene: number };
/** Giden katman: solmaya başladığı andaki saydamlığıyla (yedek Postam yarı görünürken de yumuşak geçsin). */
export type LeavingLayer = SceneLayer & { opacity: number };
export type SceneSnapshot = { current: SceneLayer; leaving: LeavingLayer | null };

export type SceneStoreOptions = {
  count: number;
  random?: Random;
  now?: () => number;
};

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Sahne deposu (useSyncExternalStore ile okunur). Sunucuda ve hidrasyonda anlık görüntü yoktur
 * (null: yedek Postam görünür); ilk abone gelince, yani yalnızca tarayıcıda, sıra karıştırılır ve
 * sayaç kurulur. Hareketi azalt açıksa seçilen tek sahne kalır, sayaç tutulur.
 */
export class SceneStore {
  private rotation: Rotation | null = null;
  private snapshot: SceneSnapshot | null = null;
  private countdown: Countdown | null = null;
  private listeners = new Set<() => void>();
  private nextKey = 1;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanup: (() => void) | null = null;
  private reduced = false;
  private hovered = false;
  private fallback: Element | null = null;

  constructor(private readonly options: SceneStoreOptions) {}

  /** Sunucunun çizdiği yedek sahnenin kabı (geri çağırmalı ref); canlanınca saydamlığı okunur. */
  setFallback = (element: Element | null) => {
    this.fallback = element;
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  /** Fare sahne alanının üstüne geldi ya da çıktı. */
  setHover(hovered: boolean) {
    this.hovered = hovered;
    this.countdown?.hold("hover", hovered);
  }

  private start() {
    const { count, random = Math.random, now } = this.options;
    const media = typeof window.matchMedia === "function" ? window.matchMedia(REDUCE_QUERY) : null;
    this.reduced = media?.matches ?? false;

    // Geliştirmedeki çift abonelikte (StrictMode) sıra ve gösterilen sahne korunur.
    this.rotation ??= startRotation(count, random);
    if (!this.snapshot) {
      const fallback = this.fallback ? Number(getComputedStyle(this.fallback).opacity) : 0;
      this.show(currentScene(this.rotation), fallback > 0.01 && !this.reduced ? { key: 0, scene: 0, opacity: fallback } : null);
    }

    const countdown = new Countdown(SCENE_MS, () => this.advance(), now);
    this.countdown = countdown;
    countdown.hold("reduce", this.reduced);
    countdown.hold("hover", this.hovered);
    countdown.hold("hidden", document.hidden);

    const onVisibility = () => countdown.hold("hidden", document.hidden);
    const onMotion = (event: MediaQueryListEvent) => {
      this.reduced = event.matches;
      countdown.hold("reduce", event.matches);
    };
    document.addEventListener("visibilitychange", onVisibility);
    media?.addEventListener("change", onMotion);
    this.cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibility);
      media?.removeEventListener("change", onMotion);
    };
  }

  private stop() {
    this.countdown?.stop();
    this.countdown = null;
    this.cleanup?.();
    this.cleanup = null;
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    if (this.snapshot?.leaving) this.snapshot = { ...this.snapshot, leaving: null };
  }

  private advance() {
    if (!this.rotation || !this.snapshot) return;
    this.rotation = nextRotation(this.rotation, this.options.random);
    const leaving = this.reduced ? null : { ...this.snapshot.current, opacity: 1 };
    this.show(currentScene(this.rotation), leaving);
  }

  private show(scene: number, leaving: LeavingLayer | null) {
    this.snapshot = { current: { key: this.nextKey++, scene }, leaving };
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    if (leaving) {
      this.fadeTimer = setTimeout(() => {
        this.fadeTimer = null;
        if (this.snapshot) this.snapshot = { ...this.snapshot, leaving: null };
        this.emit();
      }, FADE_MS);
    }
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
