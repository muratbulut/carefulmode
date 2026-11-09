import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Countdown,
  FADE_MS,
  SCENE_MS,
  SceneStore,
  currentScene,
  nextRotation,
  shuffleScenes,
  startRotation,
  type Random,
} from "@/components/landing/scenes/rotation";

/** Tekrarlanabilir rastgele sayılar (mulberry32). */
function seeded(seed: number): Random {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sahne sırası", () => {
  it("her karıştırmada altı sahnenin hepsi bir kez var", () => {
    const random = seeded(1);
    for (let i = 0; i < 200; i++) {
      expect([...shuffleScenes(6, null, random)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it("yeni turun ilki önceki sahneyle aynı olmaz", () => {
    // random() hep 0.99 verirse Fisher-Yates sırayı değiştirmez: ilk sahne 0 olurdu.
    expect(shuffleScenes(6, null, () => 0.99)[0]).toBe(0);
    const order = shuffleScenes(6, 0, () => 0.99);
    expect(order[0]).not.toBe(0);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("uzun dönüşte her tur altı farklı sahne, arka arkaya aynı sahne yok", () => {
    const random = seeded(42);
    let rotation = startRotation(6, random);
    const seen = [currentScene(rotation)];
    for (let i = 1; i < 6 * 300; i++) {
      rotation = nextRotation(rotation, random);
      seen.push(currentScene(rotation));
    }
    for (let turn = 0; turn < 300; turn++) expect(new Set(seen.slice(turn * 6, turn * 6 + 6)).size).toBe(6);
    expect(seen.some((scene, i) => i > 0 && scene === seen[i - 1])).toBe(false);
  });

  it("ilk sahne ziyaretten ziyarete değişir", () => {
    const random = seeded(7);
    const firsts = new Set(Array.from({ length: 60 }, () => currentScene(startRotation(6, random))));
    expect(firsts.size).toBe(6);
  });
});

describe("sayaç", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("süre dolunca çalışır ve yeniden kurulur", () => {
    const done = vi.fn();
    const countdown = new Countdown(SCENE_MS, done, () => Date.now());
    countdown.hold("start", false);
    vi.advanceTimersByTime(SCENE_MS - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SCENE_MS);
    expect(done).toHaveBeenCalledTimes(2);
  });

  it("tutulurken durur, kalan süreden devam eder", () => {
    const done = vi.fn();
    const countdown = new Countdown(SCENE_MS, done, () => Date.now());
    countdown.hold("start", false);
    vi.advanceTimersByTime(4_000);
    countdown.hold("hover", true);
    vi.advanceTimersByTime(60_000);
    expect(done).not.toHaveBeenCalled();
    countdown.hold("hover", false);
    vi.advanceTimersByTime(5_999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("birden çok neden varken hepsi kalkana kadar durur", () => {
    const done = vi.fn();
    const countdown = new Countdown(SCENE_MS, done, () => Date.now());
    countdown.hold("hover", true);
    countdown.hold("hidden", true);
    countdown.hold("hover", false);
    vi.advanceTimersByTime(SCENE_MS * 3);
    expect(done).not.toHaveBeenCalled();
    expect(countdown.running).toBe(false);
    countdown.hold("hidden", false);
    expect(countdown.running).toBe(true);
    countdown.stop();
    vi.advanceTimersByTime(SCENE_MS * 3);
    expect(done).not.toHaveBeenCalled();
  });
});

describe("sahne deposu", () => {
  let reduce = false;
  beforeEach(() => {
    vi.useFakeTimers();
    reduce = false;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reduce && query.includes("reduce"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function open(random = seeded(3)) {
    const store = new SceneStore({ count: 6, random, now: () => Date.now() });
    const changes = vi.fn();
    const unsubscribe = store.subscribe(changes);
    return { store, changes, unsubscribe };
  }

  it("sunucuda ve canlanmadan önce sahne seçmez (yedek görünür)", () => {
    const store = new SceneStore({ count: 6 });
    expect(store.getServerSnapshot()).toBeNull();
    expect(store.getSnapshot()).toBeNull();
  });

  it("abone gelince bir sahne seçer, 10 saniyede bir çapraz solmayla değiştirir", () => {
    const { store } = open();
    const first = store.getSnapshot()!;
    expect(first.leaving).toBeNull();
    vi.advanceTimersByTime(SCENE_MS);
    const second = store.getSnapshot()!;
    expect(second.current.scene).not.toBe(first.current.scene);
    expect(second.current.key).not.toBe(first.current.key);
    expect(second.leaving).toMatchObject({ scene: first.current.scene, opacity: 1 });
    vi.advanceTimersByTime(FADE_MS);
    expect(store.getSnapshot()!.leaving).toBeNull();
  });

  it("fare üstündeyken ve sekme arka plandayken değişmez", () => {
    const { store } = open();
    const first = store.getSnapshot()!.current;
    store.setHover(true);
    vi.advanceTimersByTime(SCENE_MS * 5);
    expect(store.getSnapshot()!.current).toEqual(first);
    store.setHover(false);
    vi.advanceTimersByTime(SCENE_MS);
    expect(store.getSnapshot()!.current).not.toEqual(first);

    const second = store.getSnapshot()!.current;
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(SCENE_MS * 5);
    expect(store.getSnapshot()!.current).toEqual(second);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(SCENE_MS);
    expect(store.getSnapshot()!.current).not.toEqual(second);
  });

  it("hareketi azalt açıksa tek sahne kalır", () => {
    reduce = true;
    const { store } = open();
    const first = store.getSnapshot()!;
    vi.advanceTimersByTime(SCENE_MS * 10);
    expect(store.getSnapshot()).toBe(first);
  });

  it("son abone gidince sayaç durur", () => {
    const { store, unsubscribe } = open();
    const first = store.getSnapshot()!.current;
    unsubscribe();
    vi.advanceTimersByTime(SCENE_MS * 3);
    expect(store.getSnapshot()!.current).toEqual(first);
  });
});
