// Eğitim kartlarındaki etkileşimlerin denetimi (tıkla-bul, mini test, video sorusu, eşleştirme,
// boşluk doldurma). Doğru
// cevaplar tarayıcıya gitmez; öğrenci seçince sunucu bakar ve açıklamayı döner (lib/lab/actions.ts).

import { fillParts, type Card } from "./content";

type ClickFind = Extract<Card, { type: "clickFind" }>;
type Quiz = { options: string[]; answer: number; explain: string };

/** Tıklanan parça şüpheli mi? Şüpheliyse sırası (1, 2, 3...) ve açıklaması. */
export function checkSpot(card: ClickFind, part: string) {
  const index = card.spots.findIndex((spot) => spot.part === part);
  return index < 0 ? null : { index, text: card.spots[index].text };
}

/** Parçaya göre genel ipucu (yazar ipucu yazmadıysa). */
const partHints: Record<string, string> = {
  sender: "Gönderenin adına bak: tanıdığın biri mi?",
  address: "Gönderenin e-posta adresine harf harf bak.",
  subject: "Konu satırını bir daha oku.",
  button: "Düğmeye bak: seni nereye götürmek istiyor?",
  footer: "Mailin en altındaki küçük yazıyı oku.",
};
const bodyHint = "Mailin metnini satır satır oku: senden ne istiyor, ne kadar acele ettiriyor?";

/**
 * "İpucu al": bulunmamış şüpheli parçalardan birinin ipucu, sırayla (n. istek, bulunmamışlar
 * arasında döner). Parçanın kendisi söylenmez; hepsi bulunduysa null.
 */
export function hintFor(card: ClickFind, found: readonly string[], n: number) {
  const left = card.spots.filter((spot) => !found.includes(spot.part));
  if (left.length === 0) return null;
  const spot = left[((n % left.length) + left.length) % left.length];
  return spot.hint || partHints[spot.part] || bodyHint;
}

/** İpucu isteğinin biçimi: bulunan parçalar (en çok 12, parça adı) ve sıra numarası. */
export function validHintRequest(found: unknown, n: unknown): found is string[] {
  return (
    Array.isArray(found) &&
    found.length <= 12 &&
    found.every((p) => typeof p === "string" && /^(sender|address|subject|button|footer|p[0-5])$/.test(p)) &&
    Number.isInteger(n) &&
    (n as number) >= 0 &&
    (n as number) < 1000
  );
}

export function checkQuiz(quiz: Quiz, option: number) {
  return { correct: option === quiz.answer, answer: quiz.answer, explain: quiz.explain };
}

/** Kartın sorusu: mini testin kendisi ya da videonun sorusu. */
export function quizOf(card: Card): Quiz | null {
  if (card.type === "quiz") return card;
  if (card.type === "video") return card.question;
  return null;
}

/**
 * Yerleştirmeli kartlar: öğrenci kutudaki seçenekleri yerlere koyar. Eşleştirmede yerler sol sütun,
 * boşluk doldurmada boşluklar, kutulara ayırmada bilgilerdir (seçenekler kutular).
 */
export type PlacementCard = Extract<Card, { type: "match" | "fill" | "sort" }>;

export function isPlacement(card: Card): card is PlacementCard {
  return card.type === "match" || card.type === "fill" || card.type === "sort";
}

/** Eşleştirme ve boşluk doldurmada her yerin doğru cevabı: sağdaki eş ya da parantezdeki kelime. */
function answerWords(card: Extract<Card, { type: "match" | "fill" }>): string[] {
  return card.type === "match" ? card.pairs.map((p) => p.right.trim()) : card.sentences.flatMap((s) => fillParts(s).answers);
}

/**
 * Öğrencinin gördüğü seçenekler. Eşleştirme ve boşluk doldurmada tekrarsız ve alfabetik: yazarın
 * sırası (doğru eşler) böylece tarayıcıya gitmez. Kutulara ayırmada kutular yazarın sırasıyla
 * (hepsi zaten görünür, sırası cevabı ele vermez). Sunucu cevabı bu sıradaki numaralarla okur.
 */
export function placementBank(card: PlacementCard): string[] {
  if (card.type === "sort") return card.bins.map((b) => b.label);
  const words = card.type === "match" ? answerWords(card) : [...answerWords(card), ...card.extra.map((w) => w.trim())];
  return [...new Set(words.filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Her yerin doğru seçeneği, kutudaki numarasıyla. */
export function placementAnswer(card: PlacementCard): number[] {
  if (card.type === "sort") return card.items.map((i) => i.bin);
  const bank = placementBank(card);
  return answerWords(card).map((a) => bank.indexOf(a));
}

export type PlacementResult = {
  /** Hepsi doğru mu. */
  correct: boolean;
  /** Her yer doğru mu (yerlerin sırasıyla). */
  slots: boolean[];
  /** Her yerin doğru seçeneği (kutudaki sırası). */
  answer: number[];
  explain: string;
  /**
   * Hoşgörülü kutulara ayırmada (`lenient`): doğrusundan daha kapalı kutuya konan yerler. Bu yerler
   * `slots`ta doğru sayılır; öğrenci yalnızca anlayışlı bir not görür. Yalnızca böyle kartta gelir.
   */
  soft?: boolean[];
};

/** Seçimler biçimce geçerli mi: her yere bir seçenek, kutudaki bir numara. */
export function validPicks(card: PlacementCard, picks: unknown): picks is number[] {
  const size = placementBank(card).length;
  return (
    Array.isArray(picks) &&
    picks.length === placementAnswer(card).length &&
    picks.every((p) => Number.isInteger(p) && p >= 0 && p < size)
  );
}

export function checkPlacement(card: PlacementCard, picks: readonly number[]): PlacementResult {
  const answer = placementAnswer(card);
  if (card.type === "sort" && card.lenient) {
    const soft = answer.map((a, i) => picks[i] > a);
    const slots = answer.map((a, i) => picks[i] === a || soft[i]);
    return { correct: slots.every(Boolean), slots, answer, explain: card.explain, soft };
  }
  const slots = answer.map((a, i) => picks[i] === a);
  return { correct: slots.every(Boolean), slots, answer, explain: card.explain };
}

/** Bitirmeden önce cevaplanması gereken kart: soru, sorulu video, eşleştirme, kutulara ayırma, boşluk doldurma. */
export function needsAnswer(card: Card) {
  return quizOf(card) !== null || isPlacement(card);
}

/**
 * Eğitim bitirilmeden önce cevaplanması gereken ilk soru kartının sırası; hepsi cevaplandıysa
 * null (güvenlik turu 2, B1). Oynatıcı da soru kartında cevap vermeden ilerletmez; sunucu bitişi
 * tarayıcının "son kart" demesine bırakmaz. Bilgi, tıkla-bul ve sorusuz video kartında
 * denetlenecek bir cevap yoktur. Yanlış cevap da cevaptır.
 */
export function firstUnanswered(cards: readonly Card[], answered: readonly string[]): number | null {
  const index = cards.findIndex((card) => needsAnswer(card) && !answered.includes(card.id));
  return index < 0 ? null : index;
}
