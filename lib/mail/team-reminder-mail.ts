// Yönetim ekibinin hatırlatma maili (Kullanıcılar > öğretmen çekmecesi > "Hatırlat"). Okul
// sorumlusunun hatırlatmasıyla aynı konu, başlık, gövde ve düğme (school.mails.reminder); fark
// kimin gönderdiğidir: "okul sorumlun" değil, ekip. Görünüm teacher-mail.ts'teki ortak kalıptan.

import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import type { MailMessage } from "@/lib/mail";
import { buildMail, type ReminderKind } from "@/lib/mail/teacher-mail";
import { routes } from "@/lib/navigation";

/** Ekibin hatırlatması: öğretmenin kurulum adımına göre "sınıfını kur", "ilk ödevi ver"... */
export function teamReminderMail(input: { to: string; name: string | null; siteUrl: string; kind: ReminderKind }): MailMessage {
  const t = getMessages().school.mails.reminder;
  const team = getMessages().adminUsers.mail;
  const values = { brand: brand.name };
  return buildMail({
    ...input,
    subject: format(t.subject[input.kind], values),
    title: t.title[input.kind],
    paragraphs: [format(team.intro, values), format(t.body[input.kind], values)],
    after: [format(team.why, values)],
    action: { label: t.action[input.kind], url: `${input.siteUrl}${routes.classes}` },
  });
}
