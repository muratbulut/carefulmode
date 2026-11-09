// Okul gerçeği: bir sınıfın bütün öğrencileri okulun tek IP'sinden gelir. 35 kişilik bir sınıf
// aynı ders saatinde kayıt olup kodla doğrulayabiliyor, sınıfa katılabiliyor ve (bir sonraki derste,
// okulun ortak bilgisayarından) yeniden giriş yapabiliyor mu? İstek sınırları lib/rate-limit.ts.
//
// Her öğrenci (VU) bir kez: kayıt sayfası -> form (düşünme) -> kayıt eylemi -> doğrulama sayfası ->
// mailden kod -> doğrulama eylemi -> ana sayfa -> sınıf koduyla katılma -> (yeni tarayıcı) giriş
// sayfası -> giriş eylemi. Öğrenciler ders başında WINDOW içinde rastgele gelir.
//
// Kod mailleri uygulamanın MAIL_OUTBOX_DIR klasöründen tests/load/outbox-server.ts ile okunur.
//   bash tests/load/stack.sh school                      # 1 sınıf, 35 öğrenci
//   CLASSES=2 bash tests/load/stack.sh school            # aynı saatte iki sınıf (70 öğrenci)
// Ortam: STUDENTS (35), CLASSES (1), WINDOW (dakika, 4), SCHOOL_IP (her koşuda yeni bir
// 203.0.113.x; aynı IP ile tekrar koşmak önceki koşunun sayaçlarına takılır).

import exec from "k6/execution";
import { SharedArray } from "k6/data";
import http from "k6/http";
import { Counter } from "k6/metrics";
import { check, sleep } from "k6";
import { Browser } from "./lib/next.js";

const data = new SharedArray("users", () => [JSON.parse(open("./.data/users.json"))])[0];
const actions = new SharedArray("actions", () => [JSON.parse(open("./.data/actions.json"))])[0];

const base = __ENV.BASE_URL || data.baseUrl;
const outbox = __ENV.OUTBOX_URL || "http://127.0.0.1:13205";
const perClass = Number(__ENV.STUDENTS || 35);
const classes = Number(__ENV.CLASSES || 1);
const windowMin = Number(__ENV.WINDOW || 4);
const password = "Mavi!Kedi7Deniz";

export const options = {
  scenarios: {
    school: { executor: "per-vu-iterations", vus: perClass * classes, iterations: 1, maxDuration: "30m" },
  },
  noConnectionReuse: true,
  // Bu denemenin ölçtüğü şey sınırlar: süre eşiği yok, sonuçlar adım adım sayılır.
  thresholds: { checks: ["rate>=0"] },
};

const results = {};
for (const step of ["signup", "verify", "join", "signin"]) {
  for (const result of ["ok", "limited", "error"]) results[`${step}_${result}`] = new Counter(`${step}_${result}`);
}

function record(step, result) {
  results[`${step}_${result}`].add(1);
  return result === "ok";
}

/** Eylem sonucundan adımın sonucu: ok, limited (istek sınırı) ya da error. */
function outcome(res, result, okWhen) {
  if (res.status !== 200) return "error";
  if (okWhen(res, result)) return "ok";
  return result && (result.code === "rate_limited" || result.code === "locked") ? "limited" : "error";
}

export function setup() {
  // Her koşuda yeni bir okul IP'si: sayaçlar (lib/rate-limit.ts) önceki koşudan dolu kalmasın.
  return { ip: __ENV.SCHOOL_IP || `203.0.113.${100 + Math.floor(Math.random() * 150)}`, run: Date.now().toString(36) };
}

export default function student({ ip, run }) {
  const n = exec.vu.idInTest;
  // Sınıflar aynı saatte: her sınıfın öğrencileri ders başında WINDOW içinde gelir.
  sleep(Math.random() * windowMin * 60 * 0.5);
  const email = `okul-${run}-${n}@load.carefulmode.invalid`;
  const b = new Browser({ base, ip });

  b.open("/kayit");
  sleep(20 + Math.random() * 40); // formu doldurur

  const signUp = b.action("signUp", actions["lib/account/actions.ts#signUp"], {
    form: { name: `Okul Öğrenci ${n}`, email, password, birthYear: "2012", education: "", guardian: "on", kvkk: "on" },
  });
  if (!record("signup", outcome(signUp.res, signUp.result, (r) => (r.headers["X-Action-Redirect"] || "").startsWith("/dogrula")))) {
    if (signUp.result && signUp.result.code !== "rate_limited") console.warn(`kayıt: ${JSON.stringify(signUp.result).slice(0, 200)}`);
    return;
  }
  b.navigate("/dogrula");

  // Kod maili (Better Auth arka planda gönderir).
  let code = null;
  for (let i = 0; i < 20 && !code; i++) {
    sleep(1);
    const r = http.get(`${outbox}/code?email=${encodeURIComponent(email)}`, { tags: { kind: "outbox" }, responseCallback: http.expectedStatuses(200, 404) });
    if (r.status === 200) code = r.json("code");
  }
  if (!check(code, { "kod maili geldi": (c) => !!c })) {
    record("verify", "error");
    return;
  }
  sleep(10 + Math.random() * 20); // maili açar, kodu yazar

  const verify = b.action("verifyEmail", actions["lib/account/actions.ts#verifyEmail"], { form: { code, next: "/" } });
  if (!record("verify", outcome(verify.res, verify.result, (r, x) => x && x.status === "ok"))) {
    console.warn(`doğrulama: ${JSON.stringify(verify.result).slice(0, 200)}`);
    return;
  }
  b.navigate("/");
  sleep(10 + Math.random() * 20); // öğretmen kodu tahtaya yazar

  // Sınıf kodu tahtada; denemede bütün sınıflar okul-IP sınıfına katılır (sınır IP ve kişi başına,
  // sınıf başına değil).
  const join = b.action("joinClassroom", actions["lib/classroom/student-actions.ts#joinClassroom"], [data.schoolClass.joinCode], { page: "/" });
  record("join", outcome(join.res, join.result, (r, x) => x && x.status === "ok"));
  sleep(20 + Math.random() * 40);

  // Sonraki ders: okulun ortak bilgisayarı, yeni tarayıcı; giriş formu.
  b.reset();
  b.open("/giris");
  sleep(10 + Math.random() * 10);
  const signIn = b.action("signIn", actions["lib/account/actions.ts#signIn"], { form: { email, password } });
  record("signin", outcome(signIn.res, signIn.result, (r) => !!r.headers["X-Action-Redirect"]));
}

export function handleSummary(summary) {
  const m = summary.metrics;
  const count = (name) => (m[name] ? m[name].values.count : 0);
  const lines = ["", `Okul-IP denemesi: ${classes} sınıf × ${perClass} öğrenci, aynı IP, ${windowMin} dk içinde gelen öğrenciler`];
  lines.push(`${"adım".padEnd(16)}${"başarılı".padStart(10)}${"sınıra takıldı".padStart(16)}${"hata".padStart(6)}`);
  for (const [step, label] of [
    ["signup", "kayıt"],
    ["verify", "doğrulama"],
    ["join", "sınıfa katılma"],
    ["signin", "giriş"],
  ]) {
    lines.push(`${label.padEnd(16)}${String(count(`${step}_ok`)).padStart(10)}${String(count(`${step}_limited`)).padStart(16)}${String(count(`${step}_error`)).padStart(6)}`);
  }
  lines.push("");
  return { stdout: lines.join("\n"), [__ENV.SUMMARY || "/load/.data/school-summary.json"]: JSON.stringify(summary, null, 2) };
}
