// Ziyaretçi sayfalarının adresleri ve menü listeleri (Tur 4 masaüstü üst menü, Tur 5 M2 alt menü).
// Henüz yapılmamış sayfalar da burada; o sayfalar gelene kadar "hazırlanıyor" sayfası açılır.
// Adresler Türkçedir. Bağlantı adları sözlükte: t.nav.links[anahtar], açıklamalar t.nav.hints[anahtar].

import type { Messages } from "@/lib/i18n";

export type NavKey = keyof Messages["nav"]["links"];
export type HintKey = keyof Messages["nav"]["hints"];

export const routes = {
  home: "/",
  roadmap: "/yol-haritasi",
  labs: "/odalar",
  news: "/gundem",
  teachers: "/ogretmenler",
  faq: "/sss",
  signIn: "/giris",
  signUp: "/kayit",
  kvkk: "/kvkk",
  privacy: "/gizlilik",
  terms: "/kosullar",
  verify: "/dogrula",
  resetPassword: "/sifre-sifirla",
  profile: "/profil",
  // Öğretmen ve okul sorumlusu (Faz 4).
  classes: "/siniflarim",
  mySchool: "/okulum",
} as const satisfies Record<NavKey, string>;

// Giriş yapmış kullanıcının menüsü (Tur 2, Gundem-G2-Ogrenci; doküman Bölüm 3): masaüstünde
// Ana sayfa, Yol haritası, Odalar, Gündem. Telefonda alt menü Ana sayfa, Yol haritası, ortada
// "Kaldığın yerden devam et", Odalar, Profil (Gündem yok; ana sayfadaki karttan gelinir).
/** Mahalle, oda (kodda lab), rapor ve yönetim adresleri (değişken parçalı). */
export const paths = {
  neighborhood: (slug: string) => `${routes.roadmap}/${encodeURIComponent(slug)}`,
  lab: (slug: string) => `/oda/${encodeURIComponent(slug)}`,
  labPlay: (slug: string) => `/oda/${encodeURIComponent(slug)}/oyna`,
  labReport: (slug: string, attemptId: string) => `/oda/${encodeURIComponent(slug)}/sonuc/${encodeURIComponent(attemptId)}`,
  admin: "/yonetim",
  /** Yönetim menüsü (Tur 5 sırası): Özet, Canlı nabız, Öğretmen talepleri, Kullanıcılar, Odalar, Günün ipucu, Gündem, Kayıt defteri. */
  adminPulse: "/yonetim/canli-nabiz",
  adminApplications: "/yonetim/talepler",
  adminUsers: "/yonetim/kullanicilar",
  adminTips: "/yonetim/ipucu",
  adminNews: "/yonetim/gundem",
  adminNewArticle: "/yonetim/gundem/yeni",
  adminArticle: (id: string) => `/yonetim/gundem/${encodeURIComponent(id)}`,
  adminAudit: "/yonetim/kayit-defteri",
  adminLabs: "/yonetim/odalar",
  adminNewLab: "/yonetim/odalar/yeni",
  adminLab: (id: string) => `/yonetim/odalar/${encodeURIComponent(id)}`,
  /** Taslağı öğrenci gibi oynatma: tam ekran, yönetim çerçevesi olmadan. */
  adminLabPreview: (id: string) => `/yonetim/odalar/${encodeURIComponent(id)}/onizle`,
  /** Gündem haberi (herkese açık). */
  article: (slug: string) => `${routes.news}/${encodeURIComponent(slug)}`,
  /** Profilde bir bölüm (telefonda o bölümün sayfası açılır). */
  profileSection: (key: ProfileSectionParam) => `${routes.profile}?bolum=${profileSectionParams[key]}`,
  /** Sınıflarım, yeni sınıf penceresi açık (profildeki "İlk sınıfını oluştur"). */
  newClass: `${routes.classes}?yeni=1`,
  /** Öğretmenin sınıfı (Sınıf detayı); sekme isteğe bağlı. */
  classroom: (id: string, tab?: "ogrenciler" | "konular") => `${routes.classes}/${encodeURIComponent(id)}${tab ? `?sekme=${tab}` : ""}`,
  /** Sınıf koduyla katılma bağlantısı (öğretmen paylaşır, QR da buraya gider). */
  join: (code: string) => `/katil/${encodeURIComponent(code)}`,
  /** Öğretmen davet bağlantısı (Okulum): profildeki Öğretmenlik formu okulu seçili açar. */
  teacherInvite: (schoolId: string) => `${routes.profile}?bolum=${profileSectionParams.teaching}&okul=${encodeURIComponent(schoolId)}`,
} as const;

/** Profil bölümlerinin adresteki adları (/profil?bolum=...). */
export const profileSectionParams = {
  account: "hesap",
  badges: "rozetler",
  avatar: "avatar",
  appearance: "gorunum",
  security: "guvenlik",
  classroom: "sinif",
  teaching: "ogretmenlik",
  delete: "sil",
} as const;

export type ProfileSectionParam = keyof typeof profileSectionParams;

export const memberNav = {
  top: ["home", "roadmap", "labs", "news"],
  // Öğretmende Sınıflarım eklenir (Tur 3); okul sorumlusunda ayrıca Okulum (Tur 4).
  teacher: ["home", "roadmap", "labs", "news", "classes"],
  coordinator: ["home", "roadmap", "labs", "news", "classes", "mySchool"],
} as const satisfies { top: NavKey[]; teacher: NavKey[]; coordinator: NavKey[] };

export const visitorNav = {
  top: ["roadmap", "labs", "news", "teachers", "faq"],
  // Telefonda "Daha fazla" penceresi; her bağlantının altında kısa açıklaması var.
  more: ["labs", "teachers", "faq"],
  legal: ["kvkk", "privacy", "terms"],
  footer: ["kvkk", "privacy", "terms", "faq"],
} as const satisfies { top: NavKey[]; more: HintKey[]; legal: NavKey[]; footer: NavKey[] };
