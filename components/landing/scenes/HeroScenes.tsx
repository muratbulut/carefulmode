"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { SceneStore } from "./rotation";
import "./scene.css";

type Props = {
  /** Sahneler; ilki Postam'dır ve sayfa canlanana kadar yedek olarak o görünür. */
  scenes: ReactNode[];
};

/**
 * Tanıtım sayfasının giriş bölümündeki dönen sahneler. Sayfa statik kalsın diye sunucuda sahne
 * seçilmez: sunucu yalnızca Postam'ı gecikmeli solan bir yedek olarak çizer (JS gelmezse de alan
 * boş kalmaz). Tarayıcıda altı sahne karıştırılır, 10 saniyede bir çapraz solmayla değişir; fare
 * alanın üstündeyken ya da sekme arka plandayken durur. Hareketi azalt açıksa tek sahne kalır.
 * Ekranda yalnızca gösterilen sahne ve solmakta olan çizilir; her gösterimde yeniden kurulduğu
 * için animasyonu baştan başlar.
 */
export function HeroScenes({ scenes }: Props) {
  const [store] = useState(() => new SceneStore({ count: scenes.length }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  // Yedek ile giden katman aynı anahtarı (0) taşır: sayfa canlandığında Postam görünüyorsa aynı
  // öğe yerinde kalıp söner, animasyonu sıfırlanmaz.
  const layers = snapshot
    ? [
        ...(snapshot.leaving ? [{ ...snapshot.leaving, state: "leave" as const }] : []),
        { ...snapshot.current, state: "enter" as const, opacity: 1 },
      ]
    : [{ key: 0, scene: 0, state: "fallback" as const, opacity: 1 }];

  return (
    <div
      className="keep-dark hs-area relative mx-auto h-[320px] w-full max-w-[358px] lg:h-[440px] lg:max-w-[500px]"
      data-testid="hero-scenes"
      // Yalnızca fare: telefonda dokunmak sayacı durdurmasın (dokunuşta "ayrılma" gelmez, takılı kalırdı).
      onPointerEnter={(event) => event.pointerType === "mouse" && store.setHover(true)}
      onPointerLeave={() => store.setHover(false)}
    >
      {layers.map((layer) => (
        <div
          key={layer.key}
          ref={layer.state === "fallback" ? store.setFallback : undefined}
          className={`hs-layer hs-${layer.state}`}
          style={layer.state === "leave" ? { opacity: layer.opacity } : undefined}
          aria-hidden={layer.state === "leave" || undefined}
          data-scene={layer.scene}
          data-state={layer.state}
        >
          {scenes[layer.scene]}
        </div>
      ))}
    </div>
  );
}
