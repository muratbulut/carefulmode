// Okul-IP denemesi (school-ip.js) için kod maillerini k6'ya veren küçük sunucu. Uygulama kod
// maillerini MAIL_OUTBOX_DIR klasörüne JSON olarak yazar (lib/mail); k6 deneme sırasında dosya
// okuyamadığı için kodu buradan ister. Yalnızca 127.0.0.1'de dinler, yalnızca yük testi alan
// adındaki adreslerin kodunu verir.
//
//   node tests/load/outbox-server.ts <klasör> [port=13205]
//   GET /code?email=<adres>  ->  {"code":"123456"} ya da 404

import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { loadEmailDomain } from "./accounts.ts";

const dir = process.argv[2];
const port = Number(process.argv[3] ?? 13205);
if (!dir) {
  console.error("Kullanım: node tests/load/outbox-server.ts <klasör> [port]");
  process.exit(1);
}

type Mail = { to: string; text: string; sentAt: string };

async function latestCode(email: string): Promise<string | null> {
  const files = await readdir(dir).catch(() => [] as string[]);
  let best: Mail | null = null;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const mail = JSON.parse(await readFile(path.join(dir, file), "utf8")) as Mail;
    if (mail.to === email && (!best || mail.sentAt > best.sentAt)) best = mail;
  }
  const match = best?.text.match(/(\d{3}) (\d{3})/);
  return match ? match[1] + match[2] : null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const email = url.searchParams.get("email") ?? "";
  if (url.pathname !== "/code" || !email.endsWith(`@${loadEmailDomain}`)) {
    res.writeHead(404).end();
    return;
  }
  const code = await latestCode(email);
  if (!code) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ code }));
}).listen(port, "127.0.0.1", () => console.log(`Kod sunucusu: http://127.0.0.1:${port}/code?email=… (${dir})`));
