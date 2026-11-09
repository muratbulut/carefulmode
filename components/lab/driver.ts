// Lab SDK'nın tarayıcı tarafı: oynatıcı sunucuyla bu arayüzden konuşur. Öğrencide sunucu
// eylemleri (lib/lab/actions.ts) kullanılır; yönetimdeki "Önizle" aynı oynatıcıyı tarayıcıda
// çalışan bir sürücüyle açar. Oynatıcı hiçbir zaman doğru cevabı bilmez: bağlantının ne
// açacağını, hacklenip hacklenmediğini ve raporu hep sürücü söyler.

import type { HackedStory, LinkPage, ShopSms } from "@/lib/lab/story";
import type { BatchEvent } from "@/lib/lab/events";
import type { PlacementResult } from "@/lib/lab/training";
import type { BadgeCode } from "@/lib/progress/badges";

export type FailReason = "auth" | "unverified" | "not_found" | "locked" | "ended" | "rate_limited" | "invalid";
export type Fail = { ok: false; reason: FailReason };

export type QueuedEvent = { seq: number; event: BatchEvent };

export type LabDriver = {
  /** "Hazırım, başla": deneme açar (ya da yarım denemeyi verir). */
  start(): Promise<{ ok: true; attemptId: string; version: number } | Fail>;
  send(attemptId: string, batch: QueuedEvent[]): Promise<{ ok: true } | Fail>;
  openLink(attemptId: string, seq: number, itemId: string): Promise<{ ok: true; page: LinkPage } | Fail>;
  submitTrap(attemptId: string, seq: number, itemId: string): Promise<{ ok: true; hacked: HackedStory } | Fail>;
  sendReply(attemptId: string, seq: number, itemId: string, withSecret: boolean): Promise<{ ok: true; hacked: HackedStory | null } | Fail>;
  /** Görevli oda: mağazada "Öde". Velinin telefonuna gelen SMS döner. */
  payShop(attemptId: string, seq: number, itemId: string): Promise<{ ok: true; sms: ShopSms } | Fail>;
  /**
   * Görevli oda: onay kodunu yazdı (enter) ya da yazmadı; satış görevinde ödeme isteğini onayladı
   * ya da reddetti. Sahtede onaylayınca hacklendi; yoksa velinin (ya da bankanın) cevabı ve işin
   * doğru yerden yapılıp yapılmadığı.
   */
  answerCode(
    attemptId: string,
    seq: number,
    itemId: string,
    enter: boolean,
  ): Promise<{ ok: true; hacked: HackedStory } | { ok: true; hacked: null; reply: string; done: boolean } | Fail>;
  /**
   * Satış görevi: siparişi kargoya verir. prepared: hazırlık maddelerinin hepsi işaretli. Hazırlamadan
   * gönderdiyse alıcının mesajı döner; done: iş doğru yapıldı (gerçek sipariş, hazırlanarak).
   */
  shipOrder(attemptId: string, seq: number, itemId: string, prepared: boolean): Promise<{ ok: true; reply: string; done: boolean } | Fail>;
  /**
   * Labı bitirir; sonra rapor sayfasına gidilir (önizlemede rapor yerinde açılır). Görevli odada iş
   * doğru yerden yapıldıysa önce iyi bitiş araması gösterilir.
   */
  finish(attemptId: string): Promise<{ ok: true; reportPath: string; call?: EndingCall | null } | Fail>;
};

/** Görevli odanın iyi bitiş araması (lib/lab/story.ts goodCall). */
export type EndingCall = { caller: string; lines: string[]; voice: (string | null)[]; title: string };

/** Eğitim labının sürücüsü: tıkla-bul ve soruların doğrusu ile ilerlemenin kaydı. */
export type TrainingDriver = {
  /** Tıklanan parça şüpheli mi? Şüpheliyse sırası ve açıklaması, değilse null. */
  spot(cardId: string, part: string): Promise<{ ok: true; spot: { index: number; text: string } | null } | Fail>;
  /** Tıkla-bulda ipucu: bulunmamış bir parça için nereye bakılacağı (parçanın kendisi değil). */
  hint(cardId: string, found: string[], n: number): Promise<{ ok: true; hint: string | null } | Fail>;
  answer(cardId: string, option: number): Promise<{ ok: true; result: { correct: boolean; answer: number; explain: string } } | Fail>;
  /** Eşleştirme ve boşluk doldurma: her yere kutudaki seçeneğin numarası. Her yerin doğrusu döner. */
  place(cardId: string, picks: number[]): Promise<{ ok: true; result: PlacementResult } | Fail>;
  /**
   * Kaldığı kart; kart sayısı verilince eğitim tamamlanır. Cevaplanmamış soru varsa tamamlanmaz:
   * "unanswered" ve o soru kartının sırası döner.
   */
  save(cardIndex: number): Promise<{ ok: true; badges?: BadgeCode[] } | Fail | Unanswered>;
};

/** Eğitim bitirilmek istendi ama bu sıradaki soru kartı cevaplanmadı. */
export type Unanswered = { ok: false; reason: "unanswered"; card: number };
