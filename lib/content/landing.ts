// Tanıtım sayfasının sabit içeriği (tasarımdaki metinler). Mahalleler veritabanında da durur;
// buradaki liste tanıtım sayfasındaki yol haritası içindir. Günün ipucu veritabanından gelir,
// havuz boşken buradaki ipucu görünür. Gündem tamamen veritabanındadır (lib/news).

export type NeighborhoodColor = "success" | "accent" | "purple" | "warning" | "pink";
export type NeighborhoodIconName = "castle" | "lock" | "mail" | "download" | "card" | "heart";

export type LandingNeighborhood = {
  slug: string;
  name: string;
  topic: string;
  color: NeighborhoodColor;
  icon: NeighborhoodIconName;
};

// Adlar ileride değişecek (doküman Bölüm 3, "Siber şehir ve lablar").
export const neighborhoods: LandingNeighborhood[] = [
  { slug: "hesap-kalesi", name: "Hesap Kalesi", topic: "Hesap güvenliği", color: "success", icon: "castle" },
  { slug: "oltalama-limani", name: "Oltalama Limanı", topic: "Oltalama", color: "accent", icon: "mail" },
  { slug: "yazilim-ormani", name: "Yazılım Ormanı", topic: "Zararlı yazılım", color: "purple", icon: "download" },
  { slug: "para-carsisi", name: "Para Çarşısı", topic: "Kişisel veri ve para", color: "warning", icon: "card" },
  { slug: "dostluk-parki", name: "Dostluk Parkı", topic: "Güvenli iletişim", color: "pink", icon: "heart" },
];

export const dailyTip = {
  text: 'Doğrulama kodunu isteyen kişi "banka" ya da "öğretmen" olsa bile kodu kimseye söyleme.',
  reason:
    "Doğrulama kodu, hesabına girişin son kilididir. Kodu bilen kişi şifreni bilmese de hesabına girebilir. Gerçek bir banka ya da okul bu kodu asla sormaz.",
};
