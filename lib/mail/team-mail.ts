// Yönetim ekibi ve okul sorumlusu mailleri: "yönetim ekibine eklendin" (izinleriyle) ve "okul
// sorumlusu oldun". Görünüm talep maillerinin aynısıdır (lib/mail/teacher-mail.ts, lib/mail/code-mail.ts):
// mail istemcileri CSS değişkenlerini ve flex'i güvenilir desteklemez, bu yüzden tablolar ve satır
// içi stiller kullanılır, renkler sitenin açık temasından kopyalanır. Kişilerin yazdığı her metin
// (ad, okul adı) HTML olarak işlenmez. Bağlantılar yalnızca sitenin kendi adresinden kurulur.
//
// Tasarımdaki "ilk girişte iki adımlı doğrulama açması istenir" cümlesi yok: üründe iki adımlı
// doğrulama henüz yok.

import { brand } from "@/lib/brand";
import { mailLogo } from "@/lib/mail/logo";
import type { TeamPermission } from "@/lib/admin/access";
import { format, getMessages } from "@/lib/i18n";
import type { MailMessage } from "@/lib/mail";
import { escapeHtml } from "@/lib/mail/teacher-mail";
import { paths, routes } from "@/lib/navigation";

// teacher-mail.ts ile aynı renkler (açık tema).
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

type MailParts = {
  to: string;
  subject: string;
  name: string | null;
  title: string;
  paragraphs: string[];
  /** Kutu içinde liste (izinler). */
  list?: { label: string; items: string[] };
  after?: string[];
  action: { label: string; url: string };
  siteUrl: string;
};

function buildMail(parts: MailParts): MailMessage {
  // Selamlama, alt bilgi ve bağlantı notu talep mailleriyle ortak.
  const chrome = getMessages().school.mails;
  const values = { brand: brand.name, year: new Date().getFullYear() };
  const greeting = parts.name ? format(chrome.greeting, { name: parts.name }) : chrome.greetingNoName;
  const footer = format(chrome.footer, values);
  const kvkkUrl = `${parts.siteUrl}${routes.kvkk}`;
  const after = parts.after ?? [];

  const paragraph = (text: string) => `<tr><td style="padding:8px 28px;font-size:16px;line-height:1.6;color:${colors.body}">${escapeHtml(text)}</td></tr>`;
  const list = parts.list
    ? `<tr><td style="padding:10px 28px 14px"><div style="padding:14px 16px;border-radius:12px;background:${colors.quoteBg};border-left:4px solid ${colors.quoteBorder};font-size:15px;line-height:1.7;color:${colors.text}"><div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${colors.muted};margin-bottom:6px">${escapeHtml(parts.list.label)}</div>${parts.list.items.map((item) => `&bull; ${escapeHtml(item)}`).join("<br>")}</div></td></tr>`
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
${list}
${after.map(paragraph).join("\n")}
<tr><td style="padding:18px 28px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${colors.button}"><a href="${escapeHtml(parts.action.url)}" style="display:inline-block;padding:13px 22px;font-family:${fonts.body};font-size:16px;font-weight:700;color:${colors.buttonText};text-decoration:none">${escapeHtml(parts.action.label)}</a></td></tr></table></td></tr>
<tr><td style="padding:4px 28px 28px;font-size:13px;line-height:1.6;color:${colors.muted}">${escapeHtml(chrome.linkHint)}<br><span style="color:${colors.link};word-break:break-all">${escapeHtml(parts.action.url)}</span></td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${colors.footerBorder};font-size:12px;line-height:1.6;color:${colors.footer}">${escapeHtml(footer)}<br><a href="${escapeHtml(kvkkUrl)}" style="color:${colors.link}">${escapeHtml(chrome.kvkk)}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    "",
    parts.title,
    "",
    ...parts.paragraphs.flatMap((p) => [p, ""]),
    ...(parts.list ? [parts.list.label, ...parts.list.items.map((item) => `- ${item}`), ""] : []),
    ...after.flatMap((p) => [p, ""]),
    `${parts.action.label}: ${parts.action.url}`,
    "",
    "--",
    footer,
    `${chrome.kvkk}: ${kvkkUrl}`,
  ].join("\n");

  return { to: parts.to, subject: parts.subject, html, text };
}

type Recipient = { to: string; name: string | null; siteUrl: string };

/**
 * Yönetim ekibine eklendin: kimin eklediği, rolü ve (sorumluysa) izinleri; yönetim paneline
 * bağlantı. İzinler ekrandaki adlarıyla yazılır.
 */
export function teamAddedMail(input: Recipient & { actorName: string; role: "ADMIN" | "MEMBER"; permissions: readonly TeamPermission[] }): MailMessage {
  const t = getMessages().adminTeam;
  const m = t.mails.added;
  const values = { brand: brand.name, actor: input.actorName };
  const admin = input.role === "ADMIN";
  return buildMail({
    ...input,
    subject: format(m.subject, values),
    title: m.title,
    paragraphs: [format(admin ? m.introAdmin : m.introMember, values), admin ? m.admin : m.member],
    list: admin ? undefined : { label: m.permissionsLabel, items: input.permissions.map((p) => t.permissions[p].title) },
    after: [m.audit],
    action: { label: m.action, url: `${input.siteUrl}${paths.admin}` },
  });
}

/** Okul sorumlusu oldun: Okulum'da ne görür, okulundan gelen talepleri onaylayabilir mi; Okulum'a bağlantı. */
export function coordinatorMail(input: Recipient & { actorName: string; schoolName: string; coordinatorApproves: boolean }): MailMessage {
  const m = getMessages().adminSchools.mails.coordinator;
  const values = { brand: brand.name, actor: input.actorName, school: input.schoolName };
  return buildMail({
    ...input,
    subject: format(m.subject, values),
    title: m.title,
    paragraphs: [format(m.intro, values), m.sees, input.coordinatorApproves ? m.approves : m.viewOnly],
    action: { label: m.action, url: `${input.siteUrl}${routes.mySchool}` },
  });
}
