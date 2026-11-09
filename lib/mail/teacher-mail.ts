// Öğretmenlik talebi ve Okulum mailleri: talep onaylandı, onaylanmadı (ret notuyla), bilgi
// istendi (soruyla) ve okul sorumlusunun hatırlatması. Görünüm kod mailiyle aynıdır
// (lib/mail/code-mail.ts): mail istemcileri CSS değişkenlerini ve flex'i güvenilir desteklemez,
// bu yüzden tablolar ve satır içi stiller kullanılır, renkler sitenin açık temasından kopyalanır.
// Kişinin yazdığı her metin (ad, okul adı, ret notu, soru) HTML olarak işlenmez.

import { brand } from "@/lib/brand";
import { mailLogo } from "@/lib/mail/logo";
import { format, getMessages } from "@/lib/i18n";
import type { MailMessage } from "@/lib/mail";
import { paths, routes } from "@/lib/navigation";

// code-mail.ts ile aynı renkler (açık tema).
const colors = {
  page: "#E4E7EE",
  card: "#FFFFFF",
  border: "#D5DCEA",
  header: "#0B1020",
  headerText: "#E8ECF8",
  text: "#0F172A",
  body: "#334155",
  muted: "#5B6683",
  quoteBg: "#F1F4FA",
  quoteBorder: "#0E7490",
  button: "#22D3EE",
  buttonText: "#0B1020",
  footer: "#7A859F",
  footerBorder: "#E6EAF3",
  link: "#0E7490",
};

const fonts = {
  heading: "'Space Grotesk', Arial, sans-serif",
  body: "'DM Sans', Arial, sans-serif",
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Satır sonları korunur (ret notu ve soru birkaç satır olabilir). */
const multiline = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");

type MailParts = {
  to: string;
  subject: string;
  name: string | null;
  title: string;
  paragraphs: string[];
  /** Ret notu ya da soru: kutu içinde, başlığıyla. */
  quote?: { label: string; text: string };
  after?: string[];
  action: { label: string; url: string };
  siteUrl: string;
};

export function buildMail(parts: MailParts): MailMessage {
  const t = getMessages().school.mails;
  const values = { brand: brand.name, year: new Date().getFullYear() };
  const greeting = parts.name ? format(t.greeting, { name: parts.name }) : t.greetingNoName;
  const footer = format(t.footer, values);
  const kvkkUrl = `${parts.siteUrl}${routes.kvkk}`;
  const after = parts.after ?? [];

  const paragraph = (text: string) => `<tr><td style="padding:8px 28px;font-size:16px;line-height:1.6;color:${colors.body}">${multiline(text)}</td></tr>`;
  const quote = parts.quote
    ? `<tr><td style="padding:10px 28px 14px"><div style="padding:14px 16px;border-radius:12px;background:${colors.quoteBg};border-left:4px solid ${colors.quoteBorder};font-size:15px;line-height:1.55;color:${colors.text}"><div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${colors.muted};margin-bottom:6px">${escapeHtml(parts.quote.label)}</div>${multiline(parts.quote.text)}</div></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(parts.subject)}</title></head>
<body style="margin:0;padding:0;background:${colors.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.page};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${colors.card};border:1px solid ${colors.border};border-radius:16px;overflow:hidden;font-family:${fonts.body};color:${colors.text}">
<tr><td style="background:${colors.header};padding:22px 28px;font-family:${fonts.heading};font-size:20px;font-weight:700;color:${colors.headerText}">${mailLogo({ font: fonts.heading, color: colors.headerText })}</td></tr>
<tr><td style="padding:32px 28px 4px;font-size:16px;color:${colors.body}">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:4px 28px 8px;font-family:${fonts.heading};font-size:24px;font-weight:700">${escapeHtml(parts.title)}</td></tr>
${parts.paragraphs.map(paragraph).join("\n")}
${quote}
${after.map(paragraph).join("\n")}
<tr><td style="padding:18px 28px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${colors.button}"><a href="${escapeHtml(parts.action.url)}" style="display:inline-block;padding:13px 22px;font-family:${fonts.body};font-size:16px;font-weight:700;color:${colors.buttonText};text-decoration:none">${escapeHtml(parts.action.label)}</a></td></tr></table></td></tr>
<tr><td style="padding:4px 28px 28px;font-size:13px;line-height:1.6;color:${colors.muted}">${escapeHtml(t.linkHint)}<br><span style="color:${colors.link};word-break:break-all">${escapeHtml(parts.action.url)}</span></td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${colors.footerBorder};font-size:12px;line-height:1.6;color:${colors.footer}">${escapeHtml(footer)}<br><a href="${escapeHtml(kvkkUrl)}" style="color:${colors.link}">${escapeHtml(t.kvkk)}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    "",
    parts.title,
    "",
    ...parts.paragraphs.flatMap((p) => [p, ""]),
    ...(parts.quote ? [parts.quote.label, ...parts.quote.text.split("\n").map((line) => `> ${line}`), ""] : []),
    ...after.flatMap((p) => [p, ""]),
    `${parts.action.label}: ${parts.action.url}`,
    "",
    "--",
    footer,
    `${t.kvkk}: ${kvkkUrl}`,
  ].join("\n");

  return { to: parts.to, subject: parts.subject, html, text };
}

type Recipient = { to: string; name: string | null; siteUrl: string };

/** Talep onaylandı: "Öğretmen hesabın açıldı", Sınıflarım'a bağlantı. */
export function approvedMail(input: Recipient & { schoolName: string | null; documentDeleted: boolean }): MailMessage {
  const t = getMessages().school.mails.approved;
  const values = { brand: brand.name, school: input.schoolName ?? "" };
  return buildMail({
    ...input,
    subject: format(t.subject, values),
    title: t.title,
    paragraphs: [format(input.schoolName ? t.intro : t.introNoSchool, values), t.privacy],
    after: input.documentDeleted ? [getMessages().school.mails.documentDeleted] : [],
    action: { label: t.action, url: `${input.siteUrl}${routes.classes}` },
  });
}

/** Talep onaylanmadı: inceleyenin notu, profildeki Öğretmenlik bölümüne bağlantı. */
export function rejectedMail(input: Recipient & { note: string; documentDeleted: boolean }): MailMessage {
  const t = getMessages().school.mails.rejected;
  return buildMail({
    ...input,
    subject: format(t.subject, { brand: brand.name }),
    title: t.title,
    paragraphs: [t.intro],
    quote: { label: t.noteLabel, text: input.note },
    after: [t.after, ...(input.documentDeleted ? [getMessages().school.mails.documentDeleted] : [])],
    action: { label: t.action, url: `${input.siteUrl}${paths.profileSection("teaching")}` },
  });
}

/** Bilgi istendi: sorulan soru, cevap profildeki Öğretmenlik bölümüne yazılır. */
export function infoRequestedMail(input: Recipient & { question: string }): MailMessage {
  const t = getMessages().school.mails.infoRequested;
  return buildMail({
    ...input,
    subject: format(t.subject, { brand: brand.name }),
    title: t.title,
    paragraphs: [t.intro],
    quote: { label: t.questionLabel, text: input.question },
    after: [t.after],
    action: { label: t.action, url: `${input.siteUrl}${paths.profileSection("teaching")}` },
  });
}

/** Hatırlatmanın türü öğretmenin kurulum adımından çıkar (lib/school/bulletin-model.ts). */
export type ReminderKind = "createClass" | "shareCode" | "firstAssignment" | "remindAssignment";

/** Okul sorumlusunun hatırlatması: adımına göre "sınıfını kur", "ilk ödevi ver"... */
export function reminderMail(input: Recipient & { kind: ReminderKind; coordinatorName: string; schoolName: string }): MailMessage {
  const t = getMessages().school.mails.reminder;
  const values = { brand: brand.name, coordinator: input.coordinatorName, school: input.schoolName };
  return buildMail({
    ...input,
    subject: format(t.subject[input.kind], values),
    title: t.title[input.kind],
    paragraphs: [format(t.intro, values), format(t.body[input.kind], values)],
    after: [t.why],
    action: { label: t.action[input.kind], url: `${input.siteUrl}${routes.classes}` },
  });
}
