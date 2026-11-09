import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand";
import { approvedMail, escapeHtml, infoRequestedMail, rejectedMail, reminderMail, type ReminderKind } from "@/lib/mail/teacher-mail";

// Üst şeritteki logo resmi (lib/mail/logo.ts) maildeki tek <img> olabilir; gerisi kaçışlı metin olmalı.
const withoutMailLogo = (html: string) => html.replace(/<img src="[^"]*\/mail\/logo\.png"[^>]*>/, "");

const base = { to: "ogretmen@ornek.com", name: "Selin", siteUrl: "https://ornek.com" };
const evil = '<img src=x onerror="a()">';
const escapedEvil = "&#60;img src=x onerror=&#34;a()&#34;&#62;";

/** HTML'deki bağlantılar (href değerleri, &amp; kaçışıyla). */
const links = (html: string) => [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);

describe("öğretmenlik talebi mailleri", () => {
  it("onay maili: öğretmen hesabın açıldı, okulun adı, Sınıflarım bağlantısı", () => {
    const mail = approvedMail({ ...base, schoolName: "Bahçelievler Ortaokulu", documentDeleted: false });
    expect(mail.to).toBe("ogretmen@ornek.com");
    expect(mail.subject).toBe(`${brand.name} öğretmen hesabın açıldı`);
    expect(mail.text).toContain("Merhaba Selin,");
    expect(mail.text).toContain("Öğretmen hesabın açıldı");
    expect(mail.text).toContain("Bahçelievler Ortaokulu öğretmeni olarak");
    expect(mail.text).toContain("https://ornek.com/siniflarim");
    expect(mail.text).not.toContain("belge");
    // Tıklanacak iki bağlantı var: Sınıflarım ve KVKK metni.
    expect(links(mail.html)).toEqual(["https://ornek.com/siniflarim", "https://ornek.com/kvkk"]);
  });

  it("onay maili okulsuz da yazılır; belge silindiyse söylenir", () => {
    const mail = approvedMail({ ...base, schoolName: null, documentDeleted: true });
    expect(mail.text).toContain("Öğretmenlik talebin onaylandı. Artık sınıf kurabilir");
    expect(mail.text).toContain("belge, karar verildiği için sunucumuzdan silindi");
  });

  it("ret maili: inceleyenin notu ve profildeki Öğretmenlik bölümü", () => {
    const mail = rejectedMail({ ...base, note: "Görev yeri belgesi okunmuyor.\nYeniden ekler misin?", documentDeleted: true });
    expect(mail.subject).toBe(`${brand.name} öğretmenlik talebin hakkında`);
    expect(mail.text).toContain("İNCELEYENİN NOTU\n> Görev yeri belgesi okunmuyor.\n> Yeniden ekler misin?");
    expect(mail.text).toContain("https://ornek.com/profil?bolum=ogretmenlik");
    expect(mail.html).toContain("Görev yeri belgesi okunmuyor.<br>Yeniden ekler misin?");
    expect(links(mail.html)[0]).toBe("https://ornek.com/profil?bolum=ogretmenlik");
  });

  it("bilgi isteme maili: soru ve cevap için profil bağlantısı", () => {
    const mail = infoRequestedMail({ ...base, question: "Kurumsal e-posta adresini yazar mısın?" });
    expect(mail.subject).toBe(`${brand.name} öğretmenlik talebin için bir soru`);
    expect(mail.text).toContain("SORU\n> Kurumsal e-posta adresini yazar mısın?");
    expect(mail.text).toContain("Cevabımı yaz: https://ornek.com/profil?bolum=ogretmenlik");
  });

  it.each<[ReminderKind, string, string]>([
    ["createClass", "Sınıfını kurmaya ne dersin?", "Sınıfımı kur"],
    ["shareCode", "Sınıf kodunu öğrencilerinle paylaş", "Sınıf kodumu gör"],
    ["firstAssignment", "Sınıfına ilk ödevi ver", "Ödev ver"],
    ["remindAssignment", "Ödevi öğrencilerine hatırlat", "Sınıflarıma git"],
  ])("hatırlatma maili (%s) adıma göre yazılır", (kind, subject, action) => {
    const mail = reminderMail({ ...base, kind, coordinatorName: "Ahmet Çelik", schoolName: "Bahçelievler Ortaokulu" });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain("Ahmet Çelik, Bahçelievler Ortaokulu okul sorumlusu olarak");
    expect(mail.text).toContain(`${action}: https://ornek.com/siniflarim`);
    expect(mail.text).toContain("günde en fazla bir hatırlatma");
  });

  it("kişinin yazdığı hiçbir metin HTML olarak işlenmez", () => {
    const mails = [
      approvedMail({ ...base, name: evil, schoolName: evil, documentDeleted: false }),
      rejectedMail({ ...base, name: evil, note: evil, documentDeleted: false }),
      infoRequestedMail({ ...base, name: evil, question: evil }),
      reminderMail({ ...base, name: evil, kind: "createClass", coordinatorName: evil, schoolName: evil }),
    ];
    for (const mail of mails) {
      expect(withoutMailLogo(mail.html)).not.toContain("<img");
      expect(mail.html).toContain(escapedEvil);
      // Düz metin sürümü olduğu gibi kalır (mail istemcisi onu HTML olarak göstermez).
      expect(mail.text).toContain(evil);
    }
  });

  it("ad yoksa genel selam; yer tutucu gibi görünen ad doldurulmaz", () => {
    expect(approvedMail({ ...base, name: null, schoolName: null, documentDeleted: false }).text.startsWith("Merhaba,")).toBe(true);
    const mail = approvedMail({ ...base, name: "{brand}", schoolName: "{school}", documentDeleted: false });
    expect(mail.text).toContain("Merhaba {brand},");
    expect(mail.text).toContain("{school} öğretmeni olarak");
  });

  it("escapeHtml beş özel karakteri kaçırır", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&#60;a href=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/a&#62;");
  });
});
