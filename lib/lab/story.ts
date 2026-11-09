// Bağlantının açacağı sayfa ve hacklendin hikâyesi (alarm ve sonuç sahnesi). Öğrencide sunucu eylemleri
// (lib/lab/actions.ts), yönetimdeki önizlemede tarayıcıdaki sürücü (components/lab/preview/)
// aynı fonksiyonları kullanır. Veritabanına ve oturuma dokunmaz.

import { getMessages } from "@/lib/i18n";
import { siteTimeZone } from "@/lib/site";
import { domainOf, opensOrder, opensRequest, opensShop, usesTrapPage, voicedLines, type CompromiseKind, type HackedScene, type Item, type Mission, type ScenarioContent, type ScenarioTemplate } from "./content";

export type LinkPage =
  | { kind: "trap"; url: string; site: string; title: string; text: string; ask: string; compromise: CompromiseKind; account: CompromisedAccount }
  | { kind: "site"; url: string }
  /**
   * Görevli odada mağaza sayfası. Gerçek ve sahte bağlantıda aynıdır (fark adres çubuğunda);
   * hangisinin sahte olduğunu söylemez. Ödeme sonrası SMS ayrıca, ödeyince gelir.
   */
  | { kind: "shop"; url: string; shop: NonNullable<Mission["shop"]> }
  /**
   * Satış görevli odada bankanın ödeme isteği ekranı (bankanın kendi ekranı, sahte site yok):
   * kimden, ne kadar. Onaylamak öğrencinin hesabından para çıkarır.
   */
  | { kind: "request"; url: string; bank: string; from: string; amount: string }
  /** Satış görevli odada pazar yerindeki sipariş: ilan, alıcı ve kargodan önceki hazırlık. */
  | { kind: "order"; url: string; sale: NonNullable<Mission["sale"]>; buyer: string };

/** Görevli odada ödeyince veliden gelen SMS (sunucu ödeme anında söyler). */
export type ShopSms = { shop: string; amount: string; code: string; note: string };

/** Hesap türünde ele geçirilen hesap. mail: Postam hesabı (bildirimler "mail", sahte sayfa Postam girişi). */
export type CompromisedAccount = { name: string; mail: boolean };

/** Lab yazarının "Hangi hesap?" alanı; boşsa Postam (sabah soruları 25d). */
export function compromisedAccount(name: string): CompromisedAccount {
  const mailApp = getMessages().lab.hacked.defaultAccount;
  const trimmed = name.trim();
  return { name: trimmed || mailApp, mail: !trimmed || trimmed.toLocaleLowerCase("tr") === mailApp.toLocaleLowerCase("tr") };
}

/**
 * Nasıl hacklendi: sahte sayfaya bilgi girerek, mesajlaşmada kodu cevapta göndererek, görevli
 * odada sahte mağazaya ödeyip onay kodunu yazarak ya da (satış görevi) ödeme isteğini onaylayarak.
 */
export type HackedVia = "link" | "reply" | "code" | "request";

/** Alarmın odaya özgü satırı ve bildirimleri (tuzaktaki `alarm`); yoksa türün genel metinleri. */
export type AlarmText = { line: string; notifications: { title: string; text: string }[] };

/** Hacklendin hikâyesi: alarmın ve sonuç sahnesinin metinleri (saatler eski açıklama ekranından, kullanılmıyor). */
export type HackedStory = {
  kind: CompromiseKind;
  template: ScenarioTemplate;
  via: HackedVia;
  sender: string;
  linkText: string;
  domain: string;
  ask: string;
  account: CompromisedAccount;
  /** Alarmdaki "yeni mail" bildirimi için gerçek bir öğenin göndereni. */
  contact: string;
  times: [string, string, string];
  realLife: string;
  actions: string[];
  reportPath: string;
  /** Görevli oda: SMS'teki tutar ("4.850 TL"), kötü bitiş aramasının satırları ve arayan. */
  amount?: string;
  call?: { caller: string; lines: string[]; voice: (string | null)[] };
  alarm?: AlarmText;
  /** Alarmdan sonraki sonuç sahnesi (22. revize); sceneFor. */
  scene: HackedScene;
};

/**
 * Odada sahne seçilmediyse türden: ödeme isteği onaylandıysa bakiye düşer (tutar gerekir), kart
 * ya da parada harcama bildirimleri, bilgi sızıntısında biri evine yaklaşır, hesap ve fidyede
 * profilin değişir. Bakiye sahnesi tutarsız açılamaz; o zaman harcama bildirimleri gelir.
 */
export function sceneFor(chosen: HackedScene | "", kind: CompromiseKind, via: HackedVia, amount: string): HackedScene {
  const scene: HackedScene = chosen || (via === "request" ? "money" : kind === "financial" ? "card" : kind === "data_leak" ? "home" : "account");
  return scene === "money" && !amountValue(amount) ? "card" : scene;
}

/** "4.000 TL" -> 4000; okunamazsa 0. */
export function amountValue(amount: string): number {
  const digits = amount.replace(/[^\d,]/g, "").replace(",", ".");
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * Mail ya da mesaj içindeki bağlantı: sahte öğedeyse (ve odada sahte sayfa varsa) sahte sayfa,
 * gerçekteyse yalnızca adres gösterilir.
 */
export function linkPageFor(content: ScenarioContent, template: ScenarioTemplate, item: Item & { link: NonNullable<Item["link"]> }): LinkPage {
  const trap = content.trap;
  if (content.mission?.shop && opensShop(content, item)) return { kind: "shop", url: item.link.url, shop: content.mission.shop };
  if (content.mission?.sale && item.request && opensRequest(content, item)) {
    return { kind: "request", url: item.link.url, bank: item.request.bank, from: item.request.from, amount: item.request.amount };
  }
  if (content.mission?.sale && item.order && opensOrder(content, item)) {
    // Hazırlamadan gönderince gelen mesaj kargoya verince söylenir (shipOrder).
    return { kind: "order", url: item.link.url, sale: { ...content.mission.sale, unprepared: "" }, buyer: item.order.buyer };
  }
  return item.kind === "fake" && usesTrapPage(content, template)
    ? {
        kind: "trap",
        url: trap.url || item.link.url,
        site: item.sender,
        title: trap.title,
        text: trap.text,
        ask: trap.ask,
        compromise: trap.kind,
        account: compromisedAccount(trap.account),
      }
    : { kind: "site", url: item.link.url };
}

const clock = (d: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: siteTimeZone, hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * first: bağlantıya tıkladığı (cevapla hacklendiyse cevabı gönderdiği) an, second: bilgiyi girdiği
 * an. Üçüncü adım (hesabın ele geçirilmesi) bir dakika sonra gösterilir.
 */
export function hackedStory(
  content: ScenarioContent,
  template: ScenarioTemplate,
  item: Item,
  via: HackedVia,
  times: { first: Date; second: Date },
  reportPath: string,
): HackedStory {
  const account = compromisedAccount(content.trap.account);
  const mission = via === "code" || via === "request" ? content.mission : undefined;
  const amount = mission ? (item.payment?.amount ?? item.request?.amount ?? "") : "";
  return {
    kind: content.trap.kind,
    template,
    via,
    sender: item.sender,
    linkText: item.link?.text ?? "",
    domain: domainOf(content.trap.url || item.link?.url || ""),
    ask: content.trap.ask,
    account,
    // Hesabın kendi uygulamasından gelen gerçek öğe (ör. Postam'ın kod mesajı) "Bu linki sen mi
    // gönderdin?" diye yazamaz; ondan başka bir gerçek gönderen seçilir.
    contact: content.items.find((i) => i.kind === "real" && i.sender.trim() !== account.name)?.sender ?? "",
    times: [clock(times.first), clock(times.second), clock(new Date(times.second.getTime() + 60_000))],
    realLife: content.trap.realLife,
    actions: content.trap.actions.filter((a) => a.trim()),
    reportPath,
    scene: sceneFor(content.trap.scene, content.trap.kind, via, amount),
    ...(mission
      ? {
          amount,
          call: { caller: mission.caller, ...voicedLines(mission.bad, mission.voice?.bad) },
        }
      : {}),
    ...(content.trap.alarm && (content.trap.alarm.line.trim() || content.trap.alarm.notifications.length > 0)
      ? { alarm: { line: content.trap.alarm.line, notifications: content.trap.alarm.notifications } }
      : {}),
  };
}

/** Ödeme sonrası veliye gelen SMS; öğede ödeme yazılı değilse null. */
export function smsFor(content: ScenarioContent, item: Item): ShopSms | null {
  if (!content.mission?.shop || !item.payment) return null;
  return { shop: item.payment.shop, amount: item.payment.amount, code: content.mission.code, note: item.payment.note };
}

/**
 * İyi bitiş araması: görevli odada iş doğru yerden yapıldıysa odayı bitirince gösterilir. Sahte
 * maili bildirdiyse teşekkür satırı eklenir. Rapor hesaplandıktan sonra döner (doğrusu artık açık).
 */
export function goodCall(content: ScenarioContent, done: boolean, reportedFake: boolean) {
  const mission = content.mission;
  if (!mission || !done) return null;
  const voice = mission.voice;
  const call = voicedLines(
    [...mission.good, ...(reportedFake ? [mission.goodReported] : [])],
    [...mission.good.map((_, i) => voice?.good[i] ?? ""), ...(reportedFake ? [voice?.goodReported ?? ""] : [])],
  );
  return { caller: mission.caller, ...call, title: mission.goodTitle };
}
