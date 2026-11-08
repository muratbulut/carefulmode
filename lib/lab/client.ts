// Öğrencinin tarayıcısına giden lab içeriği. Doğru kararlar ve puanlama alanları burada çıkarılır
// (CLAUDE.md, "Lab güvenliği"): öğenin sahte mi gerçek mi olduğu, işaretler, sahte sayfa, soru
// puanları, doğru cevaplar, açıklamalar, rapor metinleri ve ipuçları gitmez.

import { fillParts, type Card, type Mission, type LabMeta, type SortColor, type CardIcon, type QuizArt, type ScenarioContent, type ScenarioTemplate, type TaskType, type TrainingContent, iconedPoints, voicedLines } from "./content";
import { placementBank } from "./training";

export type ClientItem = {
  id: string;
  sender: string;
  address: string;
  subject: string;
  time: string;
  body: string;
  footer: string;
  /** Gösterilen adres; tıklanınca ne açılacağını sunucu söyler. */
  link: { url: string; text: string } | null;
  attachment: { name: string; size: string } | null;
};

export type ClientTask = { id: string; type: TaskType; text: string; options: string[] };

export type ClientScenario = {
  template: ScenarioTemplate;
  meta: Pick<LabMeta, "name" | "title">;
  reminders: string[];
  items: ClientItem[];
  tasks: ClientTask[];
  /**
   * Mesajlaşma: gönderilince ele geçirilen kod. Sahnede zaten görünür (gerçek bir mesajın
   * içinde); hangi konuşmanın sahte olduğunu söylemez. Gönderilen metin tarayıcıda kalır.
   */
  secret: string;
  /**
   * Görevli oda: açılış araması, görev kartı, kart ve mağaza. Bitiş aramaları (iyi ve kötü) ve
   * öğelerin ödeme SMS'i gitmez: bitişte ve ödeyince sunucudan gelir.
   */
  mission: ClientMission | null;
};

export type ClientMission = Pick<Mission, "caller" | "look" | "owner" | "lines" | "title" | "points" | "accept" | "refuse"> & {
  /** Açılış satırlarının sesleri (aynı sırayla; sesi olmayan satır null). */
  voice: (string | null)[];
  /** Görev kartı maddelerinin ikonları (aynı sırayla; ikonu olmayan madde null). */
  pointIcons: (CardIcon | null)[];
  /** Alış görevi: kart ve mağaza. Satış görevi: ilan (hazırlamadan gönderince gelen mesaj gitmez). */
  card: Mission["card"] | null;
  shop: Mission["shop"] | null;
  sale: Omit<NonNullable<Mission["sale"]>, "unprepared"> | null;
};

export function toClientScenario(content: ScenarioContent, template: ScenarioTemplate): ClientScenario {
  return {
    template,
    meta: { name: content.meta.name, title: content.meta.title },
    reminders: content.reminders.filter((r) => r.trim()),
    items: content.items.map((item) => ({
      id: item.id,
      sender: item.sender,
      address: item.address,
      subject: item.subject,
      time: item.time,
      body: item.body,
      footer: item.footer,
      link: item.link,
      attachment: item.attachment,
    })),
    tasks: content.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      text: task.text,
      options: task.type === "question" ? task.options.map((o) => o.text) : [],
    })),
    secret: template === "MESSAGING" ? content.trap.secret : "",
    mission: content.mission
      ? {
          caller: content.mission.caller,
          look: content.mission.look,
          owner: content.mission.owner,
          ...voicedLines(content.mission.lines, content.mission.voice?.lines),
          title: content.mission.title,
          ...iconedPoints(content.mission.points, content.mission.pointIcons),
          accept: content.mission.accept,
          refuse: content.mission.refuse,
          card: content.mission.card ?? null,
          shop: content.mission.shop ?? null,
          sale: content.mission.sale
            ? {
                product: content.mission.sale.product,
                price: content.mission.sale.price,
                platform: content.mission.sale.platform,
                icon: content.mission.sale.icon,
                prep: content.mission.sale.prep.filter((p) => p.trim()),
              }
            : null,
        }
      : null,
  };
}

export type ClientCard =
  | Extract<Card, { type: "info" }>
  | (Omit<Extract<Card, { type: "clickFind" }>, "spots"> & { spotCount: number })
  | { id: string; type: "quiz"; question: string; options: string[]; art: QuizArt | null }
  | {
      id: string;
      type: "video";
      title: string;
      src: string;
      duration: string;
      question: { at: number; question: string; options: string[] } | null;
    }
  /** Eşleştirme: sol sütun yazarın sırasıyla, sağ sütun (bank) alfabetik; doğru eşler gitmez. */
  | { id: string; type: "match"; title: string; hint: string; lefts: string[]; icons: (CardIcon | null)[]; bank: string[] }
  /** Boşluk doldurma: her cümle boşluklarla bölünmüş metinler; kelimeler yalnızca alfabetik kutuda. */
  | { id: string; type: "fill"; title: string; hint: string; sentences: string[][]; bank: string[] }
  /** Kutulara ayırma: kutular ve bilgiler yazarın sırasıyla; hangi bilginin hangi kutuya gittiği gitmez. */
  | {
      id: string;
      type: "sort";
      title: string;
      hint: string;
      bins: { label: string; note: string; color: SortColor; icon: CardIcon }[];
      items: { text: string; icon: CardIcon }[];
    };

export function toClientCard(card: Card): ClientCard {
  switch (card.type) {
    case "info":
      return card;
    case "clickFind": {
      const { spots, ...rest } = card;
      return { ...rest, spotCount: spots.length };
    }
    case "quiz":
      return { id: card.id, type: "quiz", question: card.question, options: card.options, art: card.art ?? null };
    case "video":
      return {
        id: card.id,
        type: "video",
        title: card.title,
        src: card.src,
        duration: card.duration,
        question: card.question ? { at: card.question.at, question: card.question.question, options: card.question.options } : null,
      };
    case "match":
      return {
        id: card.id,
        type: "match",
        title: card.title,
        hint: card.hint,
        lefts: card.pairs.map((p) => p.left),
        icons: card.pairs.map((p) => p.icon ?? null),
        bank: placementBank(card),
      };
    case "fill":
      return {
        id: card.id,
        type: "fill",
        title: card.title,
        hint: card.hint,
        sentences: card.sentences.map((s) => fillParts(s).texts),
        bank: placementBank(card),
      };
    case "sort":
      return {
        id: card.id,
        type: "sort",
        title: card.title,
        hint: card.hint,
        bins: card.bins.map((b) => ({ label: b.label, note: b.note, color: b.color, icon: b.icon })),
        items: card.items.map((i) => ({ text: i.text, icon: i.icon })),
      };
  }
}

export function toClientTraining(content: TrainingContent): ClientCard[] {
  return content.cards.map(toClientCard);
}
