// Yasal metinler (Tur 5, Y2 "Kısaca + tam metin"): KVKK aydınlatma metni, gizlilik politikası,
// kullanım koşulları. Her bölümde öğrencinin anlayacağı tek cümlelik "Kısaca" ve tam metin var.
//
// Metinler TASLAKTIR, hukuki kontrolden geçmeden yayına çıkmaz (doküman Bölüm 3, "Çerez ve yasal
// metinler"). Köşeli parantezli yerler ([VERİ SORUMLUSU] gibi) bilgi gelince doldurulur.
//
// Neden dil sözlüğünde değil: bu metinler bölüm bölüm bir bütün olarak okunur, hukuki kontrolde
// tek dosyada düzeltilir ve her belgenin kendi sürümü ile tarihi vardır. Sayfanın kendi metinleri
// (sekmeler, "Sadece kısaca oku", "TASLAK") sözlükte durur: t.legal. İkinci dil gelince her belgenin
// çevirisi aşağıdaki listeye dile göre eklenir. Ürün adı yerine "{brand}" yazılır.

import { defaultLocale, type Locale } from "@/lib/i18n";

/** Belgelerin sırası (üstteki sekmeler). Anahtarlar routes ve t.pages ile aynıdır. */
export const legalDocumentKeys = ["kvkk", "privacy", "terms"] as const;
export type LegalDocumentKey = (typeof legalDocumentKeys)[number];

export type LegalSection = {
  title: string;
  /** Öğrencinin anlayacağı kısa hali. */
  short: string;
  /** Tam metin. */
  full: string;
};

export type LegalDocument = {
  version: string;
  updated: string;
  sections: LegalSection[];
};

const tr: Record<LegalDocumentKey, LegalDocument> = {
  kvkk: {
    version: "1.2",
    updated: "13 Ekim 2026",
    sections: [
      {
        title: "Veri sorumlusu",
        short: "Bu sitedeki bilgilerinden [VERİ SORUMLUSU] sorumlu.",
        full: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla [VERİ SORUMLUSU] ("{brand}") tarafından aşağıda açıklanan kapsamda işlenmektedir.',
      },
      {
        title: "Hangi verileri işliyoruz?",
        short:
          "Görünen adın (takma ad olabilir), e-postan, doğum yılın ve odalardaki ilerlemen. Telefonunu, adresini, fotoğrafını istemiyoruz.",
        full: "Kimlik ve iletişim: görünen ad (gerçek ad zorunlu değildir, takma ad kullanılabilir) ve e-posta adresi. Hesap: doğum yılı, isteğe bağlı eğitim durumu (ortaokul, lise), seçilen avatar, tema tercihi ve şifrenin geri döndürülemez özeti; şifrenin kendisi saklanmaz. Kullanım: tamamlanan odalar, puan, seviye, rozetler, oda raporları, sınıf üyeliği. Güvenlik: oturum kaydı (IP adresi ve tarayıcı bilgisi). Öğretmen hesapları için ayrıca okul, branş ve isteğe bağlı kurumsal e-posta ya da belge. TC kimlik numarası, tam doğum tarihi, telefon numarası, açık adres ve fotoğraf işlenmez.",
      },
      {
        title: "Neden işliyoruz?",
        short: "Hesabını açmak, ilerlemeni kaydetmek ve öğretmenine sadece bitirdiğin odaları göstermek için.",
        full: "Üyelik işlemlerinin yürütülmesi, eğitim içeriğinin sunulması ve kişiye özel ilerlemenin saklanması, öğretmen ile sınıf arasındaki tamamlama bilgisinin paylaşılması, platform güvenliğinin sağlanması ve hizmetin isimsiz istatistiklerle iyileştirilmesi amaçlarıyla. Veriler kayıt formundan ve platformun kullanımı sırasında elektronik ortamda toplanır; KVKK'nın 5. maddesindeki sözleşmenin kurulması ve ifası, hukuki yükümlülük ve meşru menfaat sebeplerine, isteğe bağlı istatistik çerezi için ise açık rızaya dayanılarak işlenir.",
      },
      {
        title: "Kimlerle paylaşıyoruz?",
        short:
          "Kimseye satmıyoruz. Öğretmenin sadece hangi odayı bitirdiğini görür; puanın ve raporların sende kalır. Bilgilerin Türkiye'deki sunucumuzda durur.",
        full: "Kişisel verileriniz üçüncü kişilere satılmaz, reklam amacıyla kullanılmaz. Sınıfa katılan öğrencinin yalnızca oda tamamlama bilgisi ilgili öğretmenle paylaşılır; öğretmen öğrencinin e-posta adresini, puanını ve raporlarını görmez. Veriler Türkiye'deki sunucuda saklanır; barındırma hizmeti yurt içi sağlayıcı DeHost tarafından sağlanmaktadır. Doğrulama e-postaları Resend e-posta hizmeti üzerinden gönderilir, site Cloudflare üzerinden yayınlanır. [YURT DIŞINA AKTARIM: bu iki hizmet için hukuki kontrolde netleşecek] Yasal zorunluluk hâlinde yetkili kurumlarla paylaşılabilir.",
      },
      {
        title: "Ne kadar saklıyoruz?",
        short: "Hesabın açık olduğu sürece. Hesabını silersen bilgilerin 7 gün sonra silinir; bu sürede giriş yaparsan silme iptal olur. Silinen bilgiler sunucu yedeklerinde en çok 7 gün daha kalır.",
        full: "Veriler üyelik süresince saklanır. E-postası 7 gün içinde doğrulanmayan hesaplar silinir. Odalardaki ham olay kayıtları 1 yıl sonra silinir; deneme özeti ve puan kalır. Öğretmen belgeleri talep sonuçlanınca, sonuçlanmayan talepte ise yüklendikten en geç 60 gün sonra silinir. Hesap silme isteğinden 7 gün sonra hesap ve ona bağlı kişisel veriler silinir ya da anonim hâle getirilir; bu süre içinde hesaba giriş yapılırsa istek iptal olur. Süresi dolan oturum kayıtları kendiliğinden silinir. Kayıt defterindeki yönetim işlemleri [SÜRE] boyunca saklanır. Veritabanı yedekleri yalnızca kendi sunucumuzda tutulur ve en çok 7 gün sonra silinir; bu yüzden silinen bir veri yedeklerde en çok 7 gün daha kalabilir.",
      },
      {
        title: "Hakların",
        short:
          "Hangi bilgini sakladığımızı sorabilir, düzeltmemizi ya da silmemizi isteyebilirsin. Hesabını profilinden kendin de silebilirsin.",
        full: "KVKK'nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde ya da yurt dışında aktarıldığı kişileri bilme, eksik ya da yanlış işlenmişse düzeltilmesini, silinmesini ya da yok edilmesini isteme, bu işlemlerin aktarıldığı kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz. Hesabınızı ve bütün verilerinizi profilinizden silebilirsiniz.",
      },
      {
        title: "Nasıl başvurursun?",
        short: "[KVKK BAŞVURU E-POSTASI] adresine yaz, en geç 30 gün içinde cevap veririz.",
        full: "Başvurularınızı [KVKK BAŞVURU E-POSTASI] adresine iletebilirsiniz. Başvurular en geç otuz gün içinde ücretsiz olarak sonuçlandırılır. 18 yaşından küçük kullanıcılar adına veli ya da yasal temsilci de başvurabilir.",
      },
    ],
  },

  privacy: {
    version: "1.2",
    updated: "4 Kasım 2026",
    sections: [
      {
        title: "Çerezler",
        short: "Sadece sitenin çalışması için gereken çerezler: giriş ve tema. Reklam, takip ve istatistik çerezi yok.",
        full: "Yalnızca hizmetin çalışması için zorunlu çerezler kullanılır: oturum çerezi (giriş yaptığınızı hatırlar; çıkış yapınca ya da oturum bitince silinir) ve tema çerezi (koyu ya da gri temayı hatırlar; 1 yıl). Reklam, takip ve istatistik çerezi kullanılmaz. İleride isimsiz bir istatistik aracı eklenirse açık rızanız alınmadan çalışmaz ve bu metin güncellenir.",
      },
      {
        title: "Güvenlik önlemleri",
        short: "Şifren geri çözülemeyen bir özet olarak saklanır; kimse göremez, biz de.",
        full: "Şifreler geri döndürülemez biçimde (özet olarak) saklanır, bağlantılar şifrelidir (HTTPS). Giriş, kayıt ve doğrulama kodlarında istek sınırı uygulanır; art arda hatalı girişlerden sonra bir süre beklemek gerekir. Yönetim işlemleri kayıt defterine yazılır ve silinemez.",
      },
      {
        title: "Çocukların gizliliği",
        short: "Öğrenciler birbirine mesaj atamaz, kimse sana dışarıdan ulaşamaz.",
        full: "Platformda öğrenciler arası mesajlaşma, yorum ve herkese açık profil bulunmaz. Herkese açık sayfalarda ve özet ekranlarında öğrenci adı yer almaz, yalnızca toplam sayılar gösterilir. Öğretmenler öğrencinin puanını, seviyesini, e-posta adresini ve rapor içeriğini göremez. [VELİ ONAYI: karar sonrası yazılacak]",
      },
      {
        title: "Odalardaki sahte içerik",
        short: "Odalardaki mailler ve siteler sahte ama zararsız; gerçek bilgi girmen istenmez.",
        full: 'Oda ortamındaki e-posta, mesaj ve web sayfaları eğitim amaçlı benzetimdir; hiçbir gerçek siteye yönlendirmez, gerçek dosya indirmez ve gerçek kişisel veri toplamaz. Odadaki sahte formlara yazılan değerler saklanmaz; yalnızca yapılan seçim (ör. "bildir", "tıkla", "bilgi girildi") rapor için kaydedilir.',
      },
      {
        title: "Değişiklikler",
        short: "Bu metin değişirse sana haber veririz.",
        full: "Bu politika güncellendiğinde değişiklik tarihi sayfanın başında belirtilir; önemli değişiklikler kullanıcılara e-posta ya da platform içi bildirimle duyurulur.",
      },
    ],
  },

  terms: {
    version: "1.1",
    updated: "13 Ekim 2026",
    sections: [
      {
        title: "Kimler kullanabilir?",
        short: "Ortaokul ve lise öğrencileri, öğretmenler ve aileler. Ücretsiz.",
        full: "{brand} ücretsiz ve reklamsız bir eğitim platformudur. Öğrenci hesapları ortaokul ve lise öğrencileri içindir; öğretmen hesapları yönetici onayıyla açılır. [YAŞ SINIRI ve VELİ ONAYI: karar sonrası yazılacak]",
      },
      {
        title: "Öğrendiğini nerede kullanırsın?",
        short: "Kendini ve çevreni korumak için. Başkasının hesabını denemek suç.",
        full: "Platformda öğrenilen bilgiler yalnızca kişinin kendini ve çevresini korumak amacıyla kullanılabilir. Başkasına ait hesaplara, sistemlere ya da cihazlara izinsiz erişim girişimi Türk Ceza Kanunu kapsamında suçtur ve hesabın kapatılmasına yol açar.",
      },
      {
        title: "Hesabın",
        short: "Şifreni kimseyle paylaşma. Hesabın sana özel.",
        full: "Hesap kişiseldir, devredilemez. Şifrenin gizliliğinden kullanıcı sorumludur; şüpheli bir durumda şifrenin değiştirilmesi ve [İLETİŞİM E-POSTASI] adresine bildirilmesi gerekir. Kullanıcı hesabını istediği zaman profilinden silebilir.",
      },
      {
        title: "Davranış",
        short: "Sahte hesap açma, sistemi zorlama, başkasının yerine oda çözme yok.",
        full: "Sahte ya da başkası adına hesap açılması, platformun işleyişini bozmaya yönelik girişimler ve puan sisteminin kötüye kullanılması yasaktır.",
      },
      {
        title: "İçerik",
        short: "Odalar ve haberler {brand} ekibine ait; kaynak gösterilerek paylaşılabilir.",
        full: "Platformdaki oda, görsel ve metinler {brand} ekibine aittir. Eğitim amaçlı, kaynak gösterilerek ve ticari olmayan biçimde paylaşılabilir. Gündem haberlerinde dış kaynağın adı belirtilir.",
      },
      {
        title: "Hizmetin değişmesi",
        short: "Odaları ekleyip değiştirebiliriz; ilerlemen silinmez.",
        full: "{brand} içerikleri güncelleme, gizleme ya da kaldırma hakkını saklı tutar. Gizlenen bir odadaki ilerleme, puan ve rozetler silinmez.",
      },
    ],
  },
};

const legalDocuments: Record<Locale, Record<LegalDocumentKey, LegalDocument>> = { tr };

export function getLegalDocument(key: LegalDocumentKey, locale: Locale = defaultLocale): LegalDocument {
  return legalDocuments[locale][key];
}
