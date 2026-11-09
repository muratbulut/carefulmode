// 6 haneli kod maili (Tur 1, ekran 7 "Giden mail tasarımı"; tahta: Dogrulama-Maili).
// Mail istemcileri CSS değişkenlerini ve flex'i güvenilir desteklemez; bu yüzden görünüm
// tablolarla ve satır içi stillerle kurulur, renkler sitenin açık temasından buraya kopyalanır.

import { brand } from "@/lib/brand";
import { mailLogo } from "@/lib/mail/logo";
import { format, getMessages } from "@/lib/i18n";
import type { MailMessage } from "@/lib/mail";

export type CodePurpose = "verify" | "reset" | "changeEmail";

const colors = {
  page: "#E4E7EE",
  card: "#FFFFFF",
  border: "#D5DCEA",
  header: "#0B1020",
  headerText: "#E8ECF8",
  text: "#0F172A",
  body: "#334155",
  muted: "#5B6683",
  digitBg: "#F1F4FA",
  warnBg: "#FEF3C7",
  warnBorder: "#F59E0B",
  warnText: "#78350F",
  footer: "#7A859F",
  footerBorder: "#E6EAF3",
  link: "#0E7490",
};

const fonts = {
  heading: "'Space Grotesk', Arial, sans-serif",
  body: "'DM Sans', Arial, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function codeMail(input: {
  to: string;
  code: string;
  purpose: CodePurpose;
  name?: string | null;
  minutes: number;
  siteUrl: string;
}): MailMessage {
  const t = getMessages().mail.code;
  const values = { brand: brand.name, minutes: input.minutes, year: new Date().getFullYear() };
  const greeting = input.name ? format(t.greeting, { name: input.name }) : t.greetingNoName;
  const intro = format(t.intro[input.purpose], values);
  const validity = format(t.validity, values);
  const warning = format(t.warning, values);
  const footer = format(t.footer, values);
  const kvkkUrl = `${input.siteUrl}/kvkk`;

  const digits = input.code
    .split("")
    .map(
      (digit, i) =>
        `${i === 3 ? '<td style="width:12px"></td>' : ""}<td style="padding:0 4px"><div style="width:48px;height:60px;line-height:60px;border-radius:12px;background:${colors.digitBg};border:1px solid ${colors.border};text-align:center;font-family:${fonts.mono};font-size:30px;font-weight:700;color:${colors.text}">${escapeHtml(digit)}</div></td>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(format(t.subject[input.purpose], values))}</title></head>
<body style="margin:0;padding:0;background:${colors.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.page};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${colors.card};border:1px solid ${colors.border};border-radius:16px;overflow:hidden;font-family:${fonts.body};color:${colors.text}">
<tr><td style="background:${colors.header};padding:22px 28px;font-family:${fonts.heading};font-size:20px;font-weight:700;color:${colors.headerText}">${mailLogo({ font: fonts.heading, color: colors.headerText })}</td></tr>
<tr><td style="padding:32px 28px 8px;font-family:${fonts.heading};font-size:24px;font-weight:700">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:8px 28px;font-size:16px;line-height:1.6;color:${colors.body}">${escapeHtml(intro)}</td></tr>
<tr><td align="center" style="padding:18px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table></td></tr>
<tr><td align="center" style="padding:0 28px 18px;font-size:14px;color:${colors.muted}">${escapeHtml(validity)}</td></tr>
<tr><td style="padding:0 28px 18px"><div style="padding:16px;border-radius:12px;background:${colors.warnBg};border:1px solid ${colors.warnBorder};font-size:15px;line-height:1.55;color:${colors.warnText}"><b>${escapeHtml(t.warningTitle)}</b> ${escapeHtml(warning)}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:14px;line-height:1.6;color:${colors.muted}">${escapeHtml(t.ignore)}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${colors.footerBorder};font-size:12px;line-height:1.6;color:${colors.footer}">${escapeHtml(footer)}<br><a href="${escapeHtml(kvkkUrl)}" style="color:${colors.link}">${escapeHtml(t.kvkk)}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    greeting,
    "",
    intro,
    "",
    `    ${input.code.slice(0, 3)} ${input.code.slice(3)}`,
    "",
    validity,
    "",
    `${t.warningTitle} ${warning}`,
    "",
    t.ignore,
    "",
    "--",
    footer,
    `${t.kvkk}: ${kvkkUrl}`,
  ].join("\n");

  return { to: input.to, subject: format(t.subject[input.purpose], values), html, text };
}
