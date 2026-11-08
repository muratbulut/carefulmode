// İstek başına sunucu maliyeti: her istek türü sırayla (yük yokken) N kez atılır; uygulama ve
// veritabanı konteynerlerinin harcadığı CPU süresi (cgroup sayaçları) istek başına bölünür.
// Yük testinde yavaş çıkan bir yolun nedenini (çizim mi, sorgu mu) ayırmak için.
//
//   node tests/load/cost.ts [--n 20] [--base http://localhost:3205] [--project cg-load]
//
// prepare.ts'in yazdığı çerezleri kullanır (tests/load/.data/users.json). Yalnızca yerel yığın.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "20" },
    base: { type: "string", default: "http://localhost:3205" },
    project: { type: "string", default: "cg-load" },
    only: { type: "string" },
  },
});
const rounds = Number.parseInt(args.n, 10);
const base = args.base;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Yalnızca yerel yığın (http://localhost:<port>).");
  process.exit(1);
}

type Users = {
  cookieName: string;
  students: { cookie: string }[];
  teachers: { cookie: string; classrooms: string[] }[];
  admins: { cookie: string }[];
  news: string[];
  neighborhoods: string[];
  labs: { scenario: { slug: string; neighborhood: string }[]; training: { slug: string }[] };
};
const users = JSON.parse(readFileSync("tests/load/.data/users.json", "utf8")) as Users;

/** Konteynerin toplam CPU süresi (ns): cgroup v2 cpu.stat ya da v1 cpuacct.usage. */
function cpuNs(container: string): number {
  const id = execFileSync("docker", ["inspect", container, "--format", "{{.Id}}"], { encoding: "utf8" }).trim();
  const v1 = `/sys/fs/cgroup/cpuacct/docker/${id}/cpuacct.usage`;
  if (existsSync(v1)) return Number(readFileSync(v1, "utf8"));
  for (const dir of [`/sys/fs/cgroup/system.slice/docker-${id}.scope`, `/sys/fs/cgroup/docker/${id}`]) {
    if (existsSync(`${dir}/cpu.stat`)) return Number(/usage_usec (\d+)/.exec(readFileSync(`${dir}/cpu.stat`, "utf8"))![1]) * 1000;
  }
  throw new Error(`CPU sayacı bulunamadı: ${container}`);
}

const rsc = (pf: string | undefined, seg: string | undefined, tree: string | undefined, nextUrl: string) =>
  createHash("sha256")
    .update([pf ?? "0", seg ?? "0", tree ?? "0", nextUrl].join(","))
    .digest()
    .subarray(0, 12)
    .toString("base64url");

const params: Record<string, string> = { "yol-haritasi/1": "mahalle", "gundem/1": "haber", "siniflarim/1": "sinif", "lab/1": "lab", "lab/3": "deneme" };

/** k6 tarafındaki routerTree'nin aynısı (tests/load/lib/next.js), "/" sayfasından geçiş için. */
function tree(path: string) {
  const parts = path.split("/").filter(Boolean);
  const group = parts[0] === "lab" && parts.length > 2 ? "(focus)" : parts[0] === "yonetim" ? null : "(visitor)";
  const segments: unknown[] = parts.map((p, i) => (params[`${parts[0]}/${i}`] ? [params[`${parts[0]}/${i}`], p, "d", null] : p));
  const segs = group ? [group, ...segments] : segments;
  const prev = ["(visitor)"];
  let diverge = segs.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(prev[i]));
  if (diverge < 0) diverge = segs.length - 1;
  let node: unknown = ["__PAGE__", {}, null, null, segments.length ? 162 : 130];
  let underParam = segments.some(Array.isArray);
  for (let i = segs.length - 1; i >= 0; i--) {
    const flag = i === 0 && group ? 2 : underParam ? 98 : 66;
    if (Array.isArray(segs[i])) underParam = false;
    node = [segs[i], { children: node }, null, i === diverge ? "refetch" : null, flag];
  }
  return encodeURIComponent(JSON.stringify(["", { children: node }, null, null, 18]));
}

type Probe = { label: string; path: string; cookie?: string; kind: "page" | "rsc" | "prefetch" };

function request(probe: Probe) {
  const headers: Record<string, string> = { "accept-encoding": "gzip", "x-forwarded-for": "198.51.100.250" };
  if (probe.cookie) headers.cookie = `${users.cookieName}=${probe.cookie}`;
  let url = base + probe.path;
  if (probe.kind !== "page") {
    const t = tree(probe.path);
    const pf = probe.kind === "prefetch" ? "3" : undefined;
    Object.assign(headers, { rsc: "1", "next-router-state-tree": t, "next-url": "/" }, pf ? { "next-router-prefetch": pf } : {});
    url += `?_rsc=${rsc(pf, undefined, t, "/")}`;
  }
  return fetch(url, { headers, redirect: "manual" }).then(async (r) => ({ status: r.status, bytes: (await r.arrayBuffer()).byteLength }));
}

const student = users.students[0].cookie;
const teacher = users.teachers[0];
const lab = users.labs.scenario[0];
const probes: Probe[] = [];
const add = (label: string, path: string, cookie: string | undefined, kinds: Probe["kind"][] = ["page", "rsc", "prefetch"]) =>
  kinds.forEach((kind) => probes.push({ label: `${kind} ${label}`, path, cookie, kind }));
add("/ (öğrenci)", "/", student);
add("/ (ziyaretçi)", "/", undefined, ["page"]);
add("/yol-haritasi", "/yol-haritasi", student);
add("/yol-haritasi/[mahalle]", `/yol-haritasi/${users.neighborhoods[0]}`, student, ["rsc"]);
add("/odalar", "/odalar", student, ["rsc", "prefetch"]);
if (lab) add("/oda/[oda]", `/oda/${lab.slug}`, student, ["rsc", "prefetch"]);
if (lab) add("/oda/[oda]/oyna", `/oda/${lab.slug}/oyna`, student, ["page", "rsc"]);
add("/gundem", "/gundem", student, ["rsc"]);
add("/gundem/[haber]", `/gundem/${users.news[0]}`, student, ["rsc"]);
add("/profil", "/profil", student, ["rsc", "prefetch"]);
add("/sss", "/sss", undefined, ["rsc"]);
add("/siniflarim", "/siniflarim", teacher.cookie, ["rsc"]);
add("/siniflarim/[sinif]", `/siniflarim/${teacher.classrooms[0]}`, teacher.cookie, ["rsc"]);
add("/yonetim", "/yonetim", users.admins[0].cookie, ["rsc"]);

const app = `${args.project}-app-1`;
const db = `${args.project}-db-1`;
console.log(`${"istek".padEnd(34)}${"durum".padStart(6)}${"KB".padStart(7)}${"süre".padStart(8)}${"app CPU".padStart(9)}${"db CPU".padStart(8)}  (istek başına, ${rounds} tekrar)`);
for (const probe of probes) {
  if (args.only && !probe.label.includes(args.only)) continue;
  await request(probe); // ısınma
  const [a0, d0, t0] = [cpuNs(app), cpuNs(db), performance.now()];
  let last = { status: 0, bytes: 0 };
  for (let i = 0; i < rounds; i++) last = await request(probe);
  const [a1, d1, t1] = [cpuNs(app), cpuNs(db), performance.now()];
  const per = (ns: number) => `${(ns / 1e6 / rounds).toFixed(1)}ms`;
  console.log(
    `${probe.label.padEnd(34)}${String(last.status).padStart(6)}${(last.bytes / 1024).toFixed(0).padStart(7)}${`${((t1 - t0) / rounds).toFixed(0)}ms`.padStart(8)}${per(a1 - a0).padStart(9)}${per(d1 - d0).padStart(8)}`,
  );
}
