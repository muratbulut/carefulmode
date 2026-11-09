// k6 sonuç özeti (handleSummary): türlere ve yollara göre süreler, istek hızı, hata oranı, eşikler.
// Ham özet JSON olarak da yazılır (README'deki sonuç tabloları ondan doldurulur).

const pad = (value, width) => String(value).padStart(width);
const ms = (v) => (v === undefined ? "-" : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);

/** Eşik seçicisindeki submetrik: http_req_duration{kind:page} -> "page". */
function tagOf(metric, key) {
  const match = new RegExp(`[{,]${key}:([^,}]+)`).exec(metric);
  return match ? match[1] : null;
}

export function summarize(summary, { file, title }) {
  const m = summary.metrics;
  const seconds = summary.state.testRunDurationMs / 1000;
  const lines = [];
  lines.push("", title, `Süre ${Math.round(seconds)} sn · en çok ${m.vus_max ? m.vus_max.values.max : "?"} VU`);
  const reqs = m.http_reqs ? m.http_reqs.values : { count: 0, rate: 0 };
  const failed = m.http_req_failed ? m.http_req_failed.values.rate : 0;
  const checks = m.checks ? m.checks.values : { rate: 1, fails: 0 };
  lines.push(
    `İstek: ${reqs.count} (${reqs.rate.toFixed(1)}/sn) · başarısız: %${(failed * 100).toFixed(2)} · kontroller: %${(checks.rate * 100).toFixed(2)} (${checks.fails} hata)`,
  );

  const kinds = ["api", "page", "rsc", "prefetch", "action", "tree", "static"];
  lines.push("", `${"tür".padEnd(10)}${pad("sayı", 8)}${pad("istek/sn", 10)}${pad("ort", 8)}${pad("ortanca", 9)}${pad("p95", 8)}${pad("p99", 8)}${pad("en çok", 8)}  eşik`);
  for (const kind of kinds) {
    const key = kind === "api" ? "http_req_duration{api:yes}" : `http_req_duration{kind:${kind}}`;
    const trend = m[key];
    if (!trend) continue;
    const v = trend.values;
    const thresholds = trend.thresholds || {};
    const verdict = Object.keys(thresholds).length === 0 ? "" : Object.values(thresholds).every((t) => t.ok) ? "geçti" : "KALDI";
    lines.push(
      `${(kind === "api" ? "API (hepsi)" : kind).padEnd(10)}${pad(v.count, 8)}${pad((v.count / seconds).toFixed(1), 10)}${pad(ms(v.avg), 8)}${pad(ms(v.med), 9)}${pad(ms(v["p(95)"]), 8)}${pad(ms(v["p(99)"]), 8)}${pad(ms(v.max), 8)}  ${verdict}`,
    );
  }

  // Yollara göre (tür + şablon): p95'e göre en yavaşlar.
  const routes = Object.keys(m)
    .filter((k) => k.startsWith("http_req_duration{") && tagOf(k, "name"))
    .map((k) => ({ kind: tagOf(k, "kind") || "-", name: tagOf(k, "name"), v: m[k].values }))
    .filter((r) => r.v.count > 0)
    .sort((a, b) => b.v["p(95)"] - a.v["p(95)"]);
  if (routes.length > 0) {
    lines.push("", `${"yol".padEnd(48)}${pad("sayı", 7)}${pad("ortanca", 9)}${pad("p95", 8)}${pad("en çok", 8)}`);
    for (const r of routes.slice(0, 25)) {
      lines.push(`${`${r.kind} ${r.name}`.padEnd(48)}${pad(r.v.count, 7)}${pad(ms(r.v.med), 9)}${pad(ms(r.v["p(95)"]), 8)}${pad(ms(r.v.max), 8)}`);
    }
  }

  const counters = Object.keys(m).filter((k) => m[k].type === "counter" && !k.startsWith("http_") && !k.startsWith("data_") && k !== "iterations");
  if (counters.length > 0) lines.push("", counters.map((k) => `${k}: ${m[k].values.count}`).join(" · "));

  const broken = Object.entries(m)
    .filter(([, metric]) => metric.thresholds && Object.values(metric.thresholds).some((t) => !t.ok))
    .map(([name, metric]) => `${name} ${Object.keys(metric.thresholds).filter((t) => !metric.thresholds[t].ok).join(", ")}`);
  lines.push("", broken.length === 0 ? "Bütün eşikler geçti." : `Eşiği aşanlar:\n  ${broken.join("\n  ")}`, "");

  return { stdout: lines.join("\n"), [file]: JSON.stringify(summary, null, 2) };
}

/** Yol ve tür başına süre satırları için her zaman geçen eşikler (k6 yalnızca eşikli alt ölçüleri özetler). */
export function routeThresholds(pairs) {
  return Object.fromEntries(pairs.map(([kind, name]) => [`http_req_duration{kind:${kind},name:${name}}`, ["max>=0"]]));
}
