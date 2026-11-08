// E-posta gönderimi. Taşıyıcı ortam değişkenlerine göre seçilir:
// - RESEND_API_KEY varsa Resend (canlı site),
// - MAIL_OUTBOX_DIR varsa her mail o klasöre JSON dosyası olarak yazılır (uçtan uca testler kodu oradan okur),
// - ikisi de yoksa geliştirmede konsola yazılır; üretimde mail gönderilmez ve hata kaydı düşülür.
// Kodlar ve mail içeriği üretimde asla kayıtlara (log) yazılmaz.

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { brand } from "@/lib/brand";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type Transport = (message: MailMessage & { from: string }) => Promise<void>;

function fromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS || "no-reply@localhost";
  return `${brand.name} <${address}>`;
}

/**
 * Hiçbir zaman teslim edilemeyecek adres: ".invalid" ile biten alan adı (RFC 2606). Örnek veri
 * hesapları (ornek.invalid, prisma/demo-data.ts) böyledir; canlı sitede onlarla denenen akışların
 * (karar maili, hatırlatma, kod maili) Resend'e gitmesi yalnızca geri dönen mail (bounce) üretir ve
 * gönderen adresin itibarını düşürür. Test taşıyıcıları (klasör, konsol) bu adresleri yine yazar.
 */
export function isUndeliverable(address: string): boolean {
  const domain = address.trim().toLowerCase().split("@").pop() ?? "";
  return domain === "invalid" || domain.endsWith(".invalid");
}

function resendTransport(apiKey: string): Transport {
  const resend = new Resend(apiKey);
  return async (message) => {
    if (isUndeliverable(message.to)) {
      console.info("[mail] teslim edilemeyen adrese (.invalid) gönderilmedi");
      return;
    }
    const { error } = await resend.emails.send(message);
    if (error) throw new Error(`Resend: ${error.name}`);
  };
}

function outboxTransport(dir: string): Transport {
  return async (message) => {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2));
  };
}

const consoleTransport: Transport = async (message) => {
  console.info(`[mail] ${message.to} · ${message.subject}\n${message.text}`);
};

function selectTransport(): Transport | null {
  if (process.env.RESEND_API_KEY) return resendTransport(process.env.RESEND_API_KEY);
  if (process.env.MAIL_OUTBOX_DIR) return outboxTransport(process.env.MAIL_OUTBOX_DIR);
  if (process.env.NODE_ENV !== "production") return consoleTransport;
  return null;
}

/** Maili gönderir; gönderemezse hata fırlatır (mesajda içerik yoktur). */
export async function sendMail(message: MailMessage) {
  const transport = selectTransport();
  if (!transport) throw new Error("E-posta servisi ayarlı değil (RESEND_API_KEY)");
  await transport({ ...message, from: fromAddress() });
}
