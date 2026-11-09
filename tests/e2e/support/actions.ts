import { readFileSync } from "node:fs";
import type { APIRequestContext, Page } from "@playwright/test";

// Sunucu eylemlerini arayüzü kullanmadan, elle hazırlanmış istekle çağırmak için (güvenlik
// testleri). Eylemin kimliği yerel üretim derlemesinin listesinden okunur; tarayıcı da eylemi bu
// kimlikle "Next-Action" başlığıyla çağırır. Yalnızca yerel ve CI koşusunda (canlıda derleme yok).

let ids: Map<string, string> | undefined;

/** Eylemin adından kimliği (.next/server/server-reference-manifest.json). */
export function actionId(name: string): string {
  if (!ids) {
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")) as {
      node: Record<string, { exportedName: string }>;
    };
    ids = new Map(Object.entries(manifest.node).map(([id, entry]) => [entry.exportedName, id]));
  }
  const id = ids.get(name);
  if (!id) throw new Error(`sunucu eylemi bulunamadı: ${name}`);
  return id;
}

/** Eylemin dönüş değeri: React'in akışındaki "1:" satırı. */
function resultOf(text: string): unknown {
  const line = text.split("\n").find((l) => l.startsWith("1:"));
  return line ? JSON.parse(line.slice(2)) : undefined;
}

/**
 * Eylemi düz argümanlarla çağırır (tarayıcıdaki gibi JSON dizi). `request` sayfanın isteği
 * (`page.request`): oturum çerezi onunla gider.
 */
export async function callAction(request: APIRequestContext, name: string, args: unknown[], path = "/"): Promise<unknown> {
  const response = await request.post(path, {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return resultOf(await response.text());
}

/**
 * Aynı eylemi aynı anda `count` kez çağırır (yarış durumu denemeleri). Playwright'ın istek
 * bağlamı istekleri sıraya koyabildiği için Node'un fetch'i kullanılır; oturum çerezleri sayfanın
 * bağlamından alınır.
 */
export async function callActionBurst(page: Page, baseURL: string, name: string, args: unknown[], count: number): Promise<unknown[]> {
  const cookie = (await page.context().cookies(baseURL)).map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Cookie: cookie };
  const body = JSON.stringify(args);
  return Promise.all(
    Array.from({ length: count }, async () => resultOf(await (await fetch(new URL("/", baseURL), { method: "POST", headers, body, redirect: "manual" })).text())),
  );
}

/**
 * Form eylemini (useActionState: önceki durum + FormData) tarayıcının kodladığı gibi çağırır:
 * alanlar "_1_" önekiyle, kök değer ("0") en sonda.
 */
export async function callFormAction(
  request: APIRequestContext,
  name: string,
  fields: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>,
  path = "/profil",
): Promise<unknown> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") form.append(`_1_${key}`, value);
    else form.append(`_1_${key}`, new Blob([new Uint8Array(value.buffer)], { type: value.mimeType }), value.name);
  }
  form.append("0", JSON.stringify([{ status: "idle" }, "$K1"]));
  const response = await request.post(path, {
    headers: { "Next-Action": actionId(name), Accept: "text/x-component" },
    multipart: form,
    maxRedirects: 0,
  });
  return resultOf(await response.text());
}
