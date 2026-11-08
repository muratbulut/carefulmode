// Sunucu eylemlerinin kimlikleri. Tarayıcı bir sunucu eylemini, sayfanın adresine "Next-Action:
// <kimlik>" başlığıyla POST ederek çağırır. Kimlikler her derlemede yeniden üretilir; bu yüzden
// k6 senaryosu onları sabit yazamaz, test edilen derlemenin eylem manifestosundan okur
// (.next/server/server-reference-manifest.json).
//
//   node tests/load/actions.ts --next .next                 # yerel derleme (npm run build)
//   node tests/load/actions.ts --container cg-load-app-1    # Docker yığınındaki uygulama
//
// Çıktı (varsayılan tests/load/.data/actions.json): { "lib/lab/actions.ts#startAttempt": "40…", … }.
// k6 betikleri gereken her eylemin burada olduğunu denetler; yoksa hemen durur.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

/** k6 senaryolarının çağırdığı eylemler (dosya#ad). */
export const requiredActions = [
  "lib/lab/actions.ts#startAttempt",
  "lib/lab/actions.ts#sendEvents",
  "lib/lab/actions.ts#openLink",
  "lib/lab/actions.ts#submitTrap",
  "lib/lab/actions.ts#sendReply",
  "lib/lab/actions.ts#finishAttempt",
  "lib/lab/actions.ts#checkTrainingAnswer",
  "lib/lab/actions.ts#saveTrainingProgress",
  "lib/news/reads.ts#recordArticleRead",
  "lib/account/actions.ts#signUp",
  "lib/account/actions.ts#verifyEmail",
  "lib/account/actions.ts#signIn",
  "lib/classroom/student-actions.ts#joinClassroom",
] as const;

type Manifest = { node: Record<string, { exportedName?: string; filename?: string }> };

const manifestPath = ".next/server/server-reference-manifest.json";

const { values: args } = parseArgs({
  options: {
    next: { type: "string" },
    container: { type: "string" },
    out: { type: "string", default: "tests/load/.data/actions.json" },
  },
});

async function readManifest(): Promise<Manifest> {
  if (args.container) {
    // Standalone imajında uygulama /app altındadır (docker/Dockerfile).
    const text = execFileSync("docker", ["exec", args.container, "cat", `/app/${manifestPath}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(text) as Manifest;
  }
  const dir = args.next ?? ".next";
  return JSON.parse(await readFile(path.join(dir, "server", "server-reference-manifest.json"), "utf8")) as Manifest;
}

const manifest = await readManifest();
const actions: Record<string, string> = {};
for (const [id, entry] of Object.entries(manifest.node)) {
  if (entry.filename && entry.exportedName) actions[`${entry.filename}#${entry.exportedName}`] = id;
}
const missing = requiredActions.filter((name) => !actions[name]);
if (missing.length > 0) {
  console.error(`Manifestoda olmayan eylemler: ${missing.join(", ")}. Eylem adı ya da dosyası değiştiyse requiredActions ve k6 betiklerini güncelleyin.`);
  process.exit(1);
}
const file = path.resolve(args.out);
await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(actions, null, 2));
console.log(`${Object.keys(actions).length} eylem kimliği yazıldı: ${path.relative(process.cwd(), file)}`);
