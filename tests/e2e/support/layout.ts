import type { Page } from "@playwright/test";

// Telefon düzeni denetimi (Faz 6, mobile-layout.spec.ts): sayfada yatay kaydırma, ekran dışına
// taşan ya da bir kutunun kenarında kesilen yazı ve düğme, yana kaydırılan şeritte görünmeyen seçili
// sekme, açık pencerenin ekrandan taşması ve alt menünün örttüğü içerik aranır.
// Yalnızca anlamlı öğeler sayılır: kendi yazısı olan öğeler, görseller ve denetimler. Süs öğeleri
// (aria-hidden) ve yana kaydırılan şeritlerin (overflow-x: auto) içindekiler sayılmaz.

export type LayoutProblem = { kind: "page-scroll" | "offscreen" | "clipped" | "hidden-selected" | "dialog" | "under-nav"; detail: string };

/** Sayfanın şu anki halinde düzen sorunları (boş liste: sorun yok). */
export async function layoutProblems(page: Page): Promise<LayoutProblem[]> {
  const problems = await page.evaluate(collect, { phase: "top" as const });
  // Alt menü en alta kaydırınca da son satırı örtmemeli.
  if ((await page.locator("[data-bottom-nav]").filter({ visible: true }).count()) === 0) return problems;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const bottom = await page.evaluate(collect, { phase: "bottom" as const });
  await page.evaluate(() => window.scrollTo(0, 0));
  return [...problems, ...bottom];
}

/** Tarayıcıda çalışır (page.evaluate): yardımcılar fonksiyonun içinde tanımlıdır. */
function collect({ phase }: { phase: "top" | "bottom" }): LayoutProblem[] {
  const out: LayoutProblem[] = [];
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const tolerance = 1;

  const describe = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const test = el.getAttribute("data-testid") ? `[data-testid=${el.getAttribute("data-testid")}]` : "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
    const r = el.getBoundingClientRect();
    return `<${el.tagName.toLowerCase()}${id}${test}> "${text}" (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`;
  };

  const shown = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Ekran okuyucuya özel (sr-only) öğeler 1 px'lik kırpılmış kutulardır.
  const screenReaderOnly = (el: Element) => {
    const style = getComputedStyle(el);
    return style.position === "absolute" && (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)");
  };

  // Süs: aria-hidden görsel (arka plandaki iplikler gibi) ya da etkisiz bırakılmış (inert) alan.
  // aria-hidden yazı süs sayılmaz; ekranda okunduğu için o da ekrana sığmalı.
  const decorative = (el: Element) => !!el.closest("[inert]") || (!!el.closest('[aria-hidden="true"]') && !hasOwnText(el));

  const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== "");

  const meaningful = (el: Element) => {
    if (el.matches("img, svg, video, canvas, input, select, textarea, button, a[href], [role=button], [role=tab]")) {
      return !(el.matches("svg") && el.closest("button, a, [role=button]"));
    }
    return hasOwnText(el);
  };

  // Kendi yazısının kutusu (blok öğenin geniş kutusu değil, yazının kendisi).
  const contentRect = (el: Element) => {
    if (el.matches("img, svg, video, canvas, input, select, textarea, button, a[href], [role=button], [role=tab]")) return el.getBoundingClientRect();
    const range = document.createRange();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || node.textContent!.trim() === "") continue;
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width === 0) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
    }
    if (left === Infinity) return null;
    // Bilerek kısaltılan yazı ("..." ile biten, text-overflow: ellipsis): görünen kısmı kutusu kadardır.
    for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).textOverflow !== "ellipsis") continue;
      const box = p.getBoundingClientRect();
      return { left: Math.max(left, box.left), right: Math.min(right, box.right), top, bottom };
    }
    return { left, right, top, bottom };
  };

  // Yana kaydırılan bir şeridin (overflow-x: auto/scroll) içindeyse ve şerit ekrandaysa sorun yok.
  const insideScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.overflowX === "auto" || style.overflowX === "scroll") {
        const r = p.getBoundingClientRect();
        return r.left >= -tolerance && r.right <= vw + tolerance;
      }
    }
    return false;
  };

  // Taşanı kesen (overflow) bir kutunun kenarında yarısı kesilmiş öğe: kaydırılmamış bir alanın
  // üstünden taşan (oraya kaydırılamaz) ya da yana kaydırılmayan bir kutudan yanlara taşan.
  // Tamamen dışarıda kalanlar (kapalı akordeon, sıradaki slayt) ve yana kaydırılan şeridin
  // içindekiler (kaydırınca görünür) sayılmaz.
  const clippedBy = (el: Element, r: { left: number; right: number; top: number; bottom: number }) => {
    let sideScrolls = false;
    for (let c: Element = el, p = el.parentElement; p && p !== document.body; c = p, p = p.parentElement) {
      // Açık pencere (üst katman) ve sabit konumlu öğe, üstündeki kutuların kesmesinden çıkar.
      if (c.matches(":modal, :popover-open") || getComputedStyle(c).position === "fixed") return null;
      const style = getComputedStyle(p);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const box = p.getBoundingClientRect();
      const top = box.top + p.clientTop;
      const left = box.left + p.clientLeft;
      const right = left + p.clientWidth;
      const overlaps = r.bottom > top && r.top < top + p.clientHeight && r.right > left && r.left < right;
      if (!overlaps) return null;
      if (style.overflowY !== "visible" && p.scrollTop === 0 && r.top < top - tolerance) return `üstten kesik (${Math.round(top - r.top)} px)`;
      if (!sideScrolls && (style.overflowX === "hidden" || style.overflowX === "clip") && style.textOverflow !== "ellipsis") {
        if (r.left < left - tolerance || r.right > right + tolerance) return `yandan kesik (${Math.round(Math.max(left - r.left, r.right - right))} px)`;
      }
      if (style.overflowX === "auto" || style.overflowX === "scroll") sideScrolls = true;
    }
    return null;
  };

  // Yana kaydırılan şeritte seçili öğe (sekme, süzgeç, adım) şeridin görünen kısmında olmalı:
  // adresle gelen seçim ekranın dışında kalırsa kullanıcı hangi sekmede olduğunu göremez.
  const hiddenSelected = () => {
    const found: LayoutProblem[] = [];
    const items = document.querySelectorAll('[aria-selected="true"], [aria-current]:not([aria-current="false"]), [aria-pressed="true"]');
    for (const el of Array.from(items)) {
      if (decorative(el) || screenReaderOnly(el) || !shown(el)) continue;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const style = getComputedStyle(p);
        if (style.overflowX !== "auto" && style.overflowX !== "scroll") continue;
        if (p.scrollWidth <= p.clientWidth) break;
        const box = p.getBoundingClientRect();
        const left = Math.max(0, box.left + p.clientLeft);
        const right = Math.min(vw, box.left + p.clientLeft + p.clientWidth);
        const r = el.getBoundingClientRect();
        if (r.left < left - tolerance || r.right > right + tolerance) found.push({ kind: "hidden-selected", detail: describe(el) });
        break;
      }
    }
    return found;
  };

  const fixedAncestor = (el: Element) => {
    for (let p: Element | null = el; p; p = p.parentElement) {
      const position = getComputedStyle(p).position;
      if (position === "fixed" || position === "sticky") return p;
      if (p.matches("dialog[open]")) return p;
    }
    return null;
  };

  const visibleNav = () => Array.from(document.querySelectorAll("[data-bottom-nav]")).find((n) => shown(n)) ?? null;

  if (phase === "top") {
    const scroll = document.documentElement.scrollWidth;
    if (scroll > vw + tolerance) out.push({ kind: "page-scroll", detail: `sayfa ${scroll} px, ekran ${vw} px` });

    // Açık pencere ekranın içinde kalmalı (içi kaydırılabilir olabilir).
    for (const d of Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]'))) {
      if (!shown(d)) continue;
      const r = d.getBoundingClientRect();
      if (r.left < -tolerance || r.right > vw + tolerance || r.top < -tolerance || r.bottom > vh + tolerance) {
        out.push({ kind: "dialog", detail: describe(d) });
      }
    }

    const all = Array.from(document.body.querySelectorAll("*"));
    for (const el of all) {
      if (!meaningful(el) || decorative(el) || screenReaderOnly(el) || !shown(el)) continue;
      const r = contentRect(el);
      if (!r) continue;
      const clip = clippedBy(el, r);
      if (clip) out.push({ kind: "clipped", detail: `${describe(el)} · ${clip}` });
      // Sayfanın akışındaki öğe yatayda ekrana sığmalı; dikeyde kaydırılarak ulaşılır.
      if (r.left >= -tolerance && r.right <= vw + tolerance) continue;
      if (insideScroller(el)) continue;
      out.push({ kind: "offscreen", detail: describe(el) });
    }
    out.push(...hiddenSelected());
    return out;
  }

  // En alttayken: alt menünün kapladığı alanda akıştaki (sabit olmayan) içerik kalmamalı.
  const nav = visibleNav();
  if (!nav) return out;
  const n = nav.getBoundingClientRect();
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (nav.contains(el) || !meaningful(el) || decorative(el) || screenReaderOnly(el) || !shown(el)) continue;
    if (fixedAncestor(el)) continue;
    const r = contentRect(el);
    if (!r) continue;
    if (r.bottom > n.top + tolerance && r.top < n.bottom && r.right > n.left && r.left < n.right) {
      out.push({ kind: "under-nav", detail: describe(el) });
    }
  }
  return out;
}

export type SmallTarget = { size: string; detail: string };

/**
 * 40 px'ten küçük dokunma alanları (rapor için; denetim değil). Yazının içindeki bağlantılar
 * (cümlenin parçası olanlar) sayılmaz.
 */
export async function smallTargets(page: Page, min = 40): Promise<SmallTarget[]> {
  return page.evaluate((min) => {
    const out: { size: string; detail: string }[] = [];
    const targets = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox]');
    for (const el of Array.from(targets)) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Görünüşü küçük kalıp dokunma alanı ::after ile büyütülen düğme.
      const after = getComputedStyle(el, "::after");
      const grown = after.content !== "none" && after.position === "absolute";
      const width = grown ? Math.max(r.width, parseFloat(after.width) || 0) : r.width;
      const height = grown ? Math.max(r.height, parseFloat(after.height) || 0) : r.height;
      if (width >= min && height >= min) continue;
      // Cümlenin içindeki bağlantı: üst öğede bağlantının dışında da yazı var.
      const parent = el.parentElement;
      if (el.matches("a") && parent && style.display === "inline") {
        const own = (el.textContent ?? "").trim();
        const around = (parent.textContent ?? "").trim();
        if (around.length > own.length + 3) continue;
      }
      // Etiketiyle birlikte dokunulan kutu (label içindeki onay kutusu).
      if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) {
        const label = el.closest("label")!.getBoundingClientRect();
        if (label.height >= min) continue;
      }
      const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      out.push({ size: `${Math.round(r.width)}×${Math.round(r.height)}`, detail: `<${el.tagName.toLowerCase()}> "${text}"` });
    }
    return out;
  }, min);
}
