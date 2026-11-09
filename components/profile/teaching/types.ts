// Profil > Öğretmenlik bölümüne sunucudan gelen veri (lib/teacher/application.ts). Tarihler ve
// boyutlar hazır metindir. Belgenin kendisi tarayıcıya hiç gönderilmez; yalnızca adı ve boyutu.

export type SchoolOption = { id: string; name: string };

/**
 * Formun başlangıç değerleri: davet bağlantısındaki okul ya da reddedilen talebin bilgileri.
 * Okul listesi yok (sabah soruları 26b): öğretmen okulunun adını yazar; formda yalnızca davetteki
 * ya da önceki talebinin bağlandığı okul seçili gelir.
 */
export type ApplicationDraft = {
  province: string;
  district: string;
  /** Bilinen okul (davet ya da önceki talep); yoksa null ve öğretmen adı yazar. */
  school: SchoolOption | null;
  newSchoolName: string;
  subject: string;
  institutionalEmail: string;
};

/** Gönderilen talebin özeti (inceleniyor ve bilgi istendi halleri). */
export type ApplicationSummary = {
  /** Öğretmen okulun sistemde olup olmadığını görmez ("yeni okul" etiketi yalnızca yönetimde). */
  school: string;
  /** "İstanbul · Bahçelievler" */
  place: string;
  subject: string;
  institutionalEmail: string | null;
  /** deleted: talep 60 gün sonuçlanmadığı için belge silindi (ad kalır). */
  document: { name: string; size: string; deleted: boolean } | null;
  /** "10 Ekim" */
  sentOn: string;
};

export type TeachingSectionData =
  /** Talep yok. Davet bağlantısıyla gelindiyse (invited) form okul seçili açılır. */
  | { state: "none"; draft: ApplicationDraft | null; invited: boolean }
  /** İnceleniyor. Bilgi istenip cevaplandıysa answeredOn dolu ("Bugün"). */
  | { state: "pending"; application: ApplicationSummary; answeredOn: string | null }
  /** Yönetici bilgi istedi; askedAt "Dün 18:55" gibi. */
  | { state: "info"; application: ApplicationSummary; question: string; askedAt: string }
  /** Öğretmen hesabı açık (talep onaylandı ya da rol zaten öğretmen/yönetici). hasClass: hiç sınıf açtı mı. */
  | { state: "approved"; approvedOn: string | null; school: string | null; documentDeleted: boolean; hasClass: boolean }
  /** Onaylanmadı; "yeniden gönder" formu draft ile dolu açılır. */
  | { state: "rejected"; decidedOn: string | null; note: string | null; documentDeleted: boolean; draft: ApplicationDraft };
