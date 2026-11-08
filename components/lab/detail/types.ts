import type { CallerLook, CardIcon } from "@/lib/lab/content";
import type { ReportStatus } from "@/lib/lab/data";
import type { DistrictInfo, LabDifficulty, LabState } from "@/lib/lab/route";

/**
 * Lab detayının verisi (sunucuda app/(visitor)/oda/[oda]/page.tsx hazırlar). Yalnızca kapak
 * bilgisi ve öğrencinin kendi ilerlemesi; doğru kararlar ve puanlama alanları yok. Tarihler hazır
 * metindir.
 */
export type LabDetailData = {
  slug: string;
  name: string;
  title: string;
  story: string;
  learn: { title: string; text: string }[];
  template: "INBOX" | "MESSAGING";
  difficulty: LabDifficulty;
  durationMin: number;
  district: DistrictInfo;
  state: LabState;
  verified: boolean;
  /** Labı bitiren öğrenci sayısı ve son 7 gündekiler (isim yok). */
  completions: number;
  week: number;
  /** Mahallenin eğitim labı (adımların ilki). */
  training: { name: string; done: boolean; doneOn: string | null; href: string } | null;
  /** Yarım deneme: kaçıncı görevde. */
  attempt: { current: number; total: number; done: number } | null;
  inProgress: boolean;
  best: number | null;
  finishedCount: number;
  last: { score: number | null; status: ReportStatus; date: string | null; href: string } | null;
  phone: { date: string; time: string; notifications: { sender: string; text: string; time: string | null }[] };
  /** Görevli odanın kapağı (arayan ve hikâye kartları); görevsiz odada null, sağda `phone` görünür. */
  cover: MissionCoverData | null;
  /**
   * "Seni neler bekliyor" (3 Kasım, 8. revize D): odayı henüz bitirmeyen öğrenciye kim arayacak,
   * kaç mail ya da mesaj, hangi mağaza ya da ilan ve kaç görev. Hangisinin sahte olduğu yok.
   */
  ahead: {
    caller: string | null;
    items: number;
    /** shop: mağazanın adı ve kartın sahibi ("Annenin"); sale: pazar yeri ve ürün. */
    deal: { kind: "shop"; name: string; owner: string } | { kind: "sale"; name: string; product: string } | null;
    tasks: number;
  };
};

/**
 * Görevli oda kapağının görseli (Murat, 3 Kasım: tuvalde "3 sade"): telefonda gelen arama,
 * çevresinde yazısız hikâye kartları. Yalnızca arayan, görev türü, ürünün ikonu ve fiyatı, ilk iki
 * öğenin gönderenlerinin baş harfi ve hazırlık maddesi sayısı gelir; hangisinin sahte olduğu gelmez.
 */
export type MissionCoverData = {
  caller: string;
  look: CallerLook;
  /** shop: alış görevi (Postam), sale: satış görevi (Mesajlar). */
  kind: "shop" | "sale";
  icon: CardIcon;
  price: string;
  /** İlk iki mailin ya da mesajın göndereni: baş harf ve renk sırası (aynı gönderen aynı renk). */
  senders: { initial: string; tone: number }[];
  /** Satışta kargodan önceki hazırlık maddesi sayısı (en çok 3 ikon). */
  steps: number;
  /** Etiketin ikonu (alışta `mission.coverIcon`); satışta yok, etiket cüzdanlardır. */
  badge: CardIcon | null;
};
