import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localDriver } from "@/components/lab/preview/local-driver";
import { defaultTryPath, fakeChoicesFor, reportForPath } from "@/lib/admin/try-path";
import { scenarioChecklist } from "@/lib/lab/checklist";
import { toClientScenario } from "@/lib/lab/client";
import { maxScore, parseScenario, rawTotal, usesTrapPage, voicedLines, type ScenarioContent } from "@/lib/lab/content";
import { reduceEvents, taskProgress, type LabEventData } from "@/lib/lab/events";
import { buildReportView } from "@/lib/lab/report";
import { fakeOutcome, scoreScenario, type ScenarioReport } from "@/lib/lab/scoring";
import { coverOf } from "@/lib/lab/cover";
import { goodCall, linkPageFor, smsFor } from "@/lib/lab/story";

// Görevli oda (Para Çarşısı "Kulaklık için veli kartı", 2 Kasım): annenin araması, kartı, mağaza
// sayfası, ödeme sonrası SMS ve onay kodu kararı.

const file = JSON.parse(readFileSync("labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json", "utf8"));
const room = parseScenario(file.content)!;
const kargo = parseScenario(JSON.parse(readFileSync("labs/examples/sahte-kargo-maili.json", "utf8")).content)!;

const opened: LabEventData[] = ["teknopazar-sahte", "teknopazar", "annem", "okul"].map((item) => ({ type: "item_opened", item }));
const buyReal: LabEventData[] = [
  { type: "link_clicked", item: "teknopazar" },
  { type: "info_entered", item: "teknopazar" },
  { type: "code_entered", item: "teknopazar" },
];
const bestAnswers: LabEventData[] = [
  { type: "answer", task: "sms-tutar", option: 0 },
  { type: "answer", task: "guvenli-yol", option: 0 },
];
const score = (events: LabEventData[]) => scoreScenario(room, reduceEvents(events));

describe("görevli oda: şema ve oda dosyası", () => {
  it("oda dosyası şemaya uyuyor, puanı 10 ve yayına hazır", () => {
    expect(room.mission?.caller).toBe("Annem");
    expect(maxScore(room)).toBe(rawTotal);
    expect(scenarioChecklist(room, "INBOX").filter((c) => !c.ok)).toEqual([]);
  });

  it("eski odalar değişmeden okunur: görev, ödeme ve alarm alanı eklenmez", () => {
    expect("mission" in kargo).toBe(false);
    expect(kargo.items.every((i) => !("payment" in i))).toBe(true);
    expect("alarm" in kargo.trap).toBe(false);
    expect(usesTrapPage(kargo, "INBOX")).toBe(true);
  });

  it("görevli odada sahte sayfa yok; görev ve ödeme yalnızca birlikte", () => {
    expect(usesTrapPage(room, "INBOX")).toBe(false);
    const noMission = { ...room, mission: undefined } as ScenarioContent;
    expect(scenarioChecklist(noMission, "INBOX").find((c) => c.key === "mission")?.ok).toBe(false);
    const noFakePayment = { ...room, items: room.items.map((i) => (i.kind === "fake" ? { ...i, payment: undefined } : i)) };
    expect(scenarioChecklist(noFakePayment, "INBOX").find((c) => c.key === "mission")?.ok).toBe(false);
    expect(scenarioChecklist(room, "MESSAGING").find((c) => c.key === "mission")?.ok).toBe(false);
    // Görevsiz, ödemesiz odada görev satırı listede hiç yok (formdaki "Yayına hazır mı?" sayısı değişmez).
    expect(scenarioChecklist(kargo, "INBOX").some((c) => c.key === "mission")).toBe(false);
  });

  it("dört seçenekli sorular yayına hazır (3 ya da 4)", () => {
    expect(room.tasks.filter((t) => t.type === "question").every((t) => t.options.length === 4)).toBe(true);
    expect(scenarioChecklist(room, "INBOX").find((c) => c.key === "options")?.ok).toBe(true);
  });
});

describe("görevli oda: tarayıcıya giden içerik", () => {
  const client = toClientScenario(room, "INBOX");
  const json = JSON.stringify(client);

  it("istek, kart ve mağaza gider; SMS, bitişler ve rapor metinleri gitmez", () => {
    expect(client.mission).toMatchObject({ caller: "Annem", owner: "Annenin", title: "Ege'ye kablosuz kulaklık al" });
    // 12. revize: annen gerçek adresi söyler (sesi yeniden kaydedilene kadar yalnızca altyazı).
    expect(client.mission?.lines).toHaveLength(5);
    expect(client.mission?.lines[2]).toContain("teknopazar.com.tr");
    expect(client.mission?.shop?.price).toBe("1.199 TL");
    for (const secret of ["4.850", "TKNPZR", "481 920", "Tutar doğru", "Sen 1.199 TL demiştin", "İyi ki yazmadın", "Kulaklık yarın geliyormuş", "kartımdan 4.850", "doğru mağazadan aldın"]) {
      expect(json).not.toContain(secret);
    }
    expect(client.items.some((i) => "payment" in i)).toBe(false);
    expect(Object.keys(client.mission!).sort()).toEqual(["accept", "caller", "card", "lines", "look", "owner", "pointIcons", "points", "refuse", "sale", "shop", "title", "voice"]);
    // Yalnızca açılışın sesleri gider; bitişlerin sesi bitişle birlikte gelir.
    expect(client.mission?.voice).toEqual(room.mission!.voice!.lines.map((src) => src || null));
    expect(client.mission?.voice[2]).toBeNull();
    // 10. revize: görev kartı maddeleri ikonlarıyla birlikte, aynı sırayla gider.
    expect(client.mission?.points).toHaveLength(5);
    expect(client.mission?.pointIcons).toEqual(["headphones", "globe", "tag", "card", "lock"]);
    expect(json).not.toContain("iyi-1.mp3");
    expect(json).not.toContain("kotu-1.mp3");
  });

  it("iki bağlantı da aynı mağaza sayfasını açar; fark yalnızca adres", () => {
    const pages = room.items.filter((i) => i.link).map((i) => linkPageFor(room, "INBOX", { ...i, link: i.link! }));
    expect(pages.map((p) => p.kind)).toEqual(["shop", "shop"]);
    const [fake, real] = pages as Extract<(typeof pages)[number], { kind: "shop" }>[];
    expect(fake.shop).toEqual(real.shop);
    expect(fake.url).not.toBe(real.url);
    expect(Object.keys(fake).sort()).toEqual(["kind", "shop", "url"]);
  });

  it("SMS ödeyince gelir: sahtede farklı tutar ve mağaza", () => {
    const [fake, real] = room.items;
    expect(smsFor(room, fake)).toEqual({ shop: "TKNPZR*ODEME", amount: "4.850 TL", code: "481 920", note: "Sen 1.199 TL demiştin?" });
    expect(smsFor(room, real)?.amount).toBe("1.199 TL");
    expect(smsFor(kargo, kargo.items[0])).toBeNull();
  });
});

describe("görevli oda: puan ve görev", () => {
  it("gerçek mağazadan alıp sahteyi bildiren ve soruları doğru cevaplayan: 100, güvende", () => {
    const report = score([...opened, ...buyReal, { type: "item_moved", item: "teknopazar-sahte", to: "spam" }, { type: "review_done" }, ...bestAnswers]);
    expect(report.status).toBe("safe");
    expect(report.score).toBe(100);
    expect(report.rows.find((r) => r.type === "mission")).toMatchObject({ done: true, state: "ok", points: 1, max: 1 });
  });

  it("sahte mağazaya kartla ödeyip kodu yazmayan: hacklenmez, sahte mailden 0 (son anda durdu)", () => {
    const events: LabEventData[] = [
      { type: "link_clicked", item: "teknopazar-sahte" },
      { type: "info_entered", item: "teknopazar-sahte" },
      { type: "code_refused", item: "teknopazar-sahte" },
    ];
    const report = score([...opened, ...events]);
    expect(fakeOutcome(reduceEvents(events), "teknopazar-sahte", true)).toBe("stopped");
    expect(report.status).not.toBe("hacked");
    expect(report.rows[0]).toMatchObject({ type: "fake", outcome: "stopped", points: 0 });
    // Gerçek mağazadan almadığı için görev yarım.
    expect(report.rows.find((r) => r.type === "mission")).toMatchObject({ done: false, points: 0 });
    // Görev maddesi yine de biter (karar verdi), sıradaki göreve geçer.
    expect(taskProgress(room.tasks, reduceEvents([...opened, ...events])).done.slice(0, 2)).toEqual([true, true]);
  });

  it("ödeyip SMS'te karar vermeden çıkan da hacklenmez; kart bilgisi gittiği için 0", () => {
    const report = score([...opened, { type: "link_clicked", item: "teknopazar-sahte" }, { type: "info_entered", item: "teknopazar-sahte" }]);
    expect(report.status).toBe("risky");
    expect(report.rows[0]).toMatchObject({ outcome: "stopped", points: 0 });
  });

  it("sahte sitede onay kodunu yazan: hacklendi, Para türü", () => {
    const report = score([
      ...opened,
      { type: "link_clicked", item: "teknopazar-sahte" },
      { type: "info_entered", item: "teknopazar-sahte" },
      { type: "code_entered", item: "teknopazar-sahte" },
    ]);
    expect(report.status).toBe("hacked");
    expect(report.compromise).toBe("financial");
  });

  it("görevli olmayan odada bilgi girmek yine hacklenmektir", () => {
    expect(fakeOutcome(reduceEvents([{ type: "info_entered", item: "kargo" }]), "kargo")).toBe("hacked");
  });

  it("gerçek mağazada 'Yazma, anneme anlat' diyen de işi doğru yerden yapmış sayılır", () => {
    const report = score([...opened, { type: "link_clicked", item: "teknopazar" }, { type: "info_entered", item: "teknopazar" }, { type: "code_refused", item: "teknopazar" }]);
    expect(report.rows.find((r) => r.type === "mission")).toMatchObject({ done: true, points: 1 });
  });
});

describe("görevli oda: önizleme sürücüsü (sunucuyla aynı kurallar)", () => {
  function play() {
    let ended: ScenarioReport | null = null;
    const driver = localDriver(room, "INBOX", (r) => (ended = r));
    return { driver, ended: () => ended };
  }

  it("bağlantı açılmadan ödeme yok; ödeyince SMS, karar bir kez", async () => {
    const { driver } = play();
    expect(await driver.payShop("x", 0, "teknopazar")).toEqual({ ok: false, reason: "invalid" });
    await driver.openLink("x", 0, "teknopazar");
    const paid = await driver.payShop("x", 1, "teknopazar");
    expect(paid).toMatchObject({ ok: true, sms: { amount: "1.199 TL" } });
    expect(await driver.answerCode("x", 2, "teknopazar", true)).toEqual({ ok: true, hacked: null, reply: "", done: true });
    expect(await driver.answerCode("x", 3, "teknopazar", false)).toEqual({ ok: false, reason: "invalid" });
    // Sahte sayfa formu görevli odada çalışmaz.
    expect(await driver.submitTrap("x", 4, "teknopazar-sahte")).toEqual({ ok: false, reason: "invalid" });
  });

  it("sahte sitede kodu yazınca kötü bitiş araması ve odaya özgü alarm", async () => {
    const { driver, ended } = play();
    await driver.openLink("x", 0, "teknopazar-sahte");
    await driver.payShop("x", 1, "teknopazar-sahte");
    const result = await driver.answerCode("x", 2, "teknopazar-sahte", true);
    if (!result.ok || !result.hacked) throw new Error("hacklenmeliydi");
    expect(result.hacked.via).toBe("code");
    expect(result.hacked.amount).toBe("4.850 TL");
    expect(result.hacked.call?.lines[0]).toContain("4.850 TL");
    expect(result.hacked.alarm?.line).toBe("Annenin kartından 4.850 TL çekildi.");
    expect(result.hacked.domain).toBe("teknopazar-gercek-tr.com");
    expect(ended()?.status).toBe("hacked");
  });

  it("sahte sitede yazmayınca annenin cevabı; bitişte iyi bitiş araması yok (görev yarım)", async () => {
    const { driver } = play();
    await driver.openLink("x", 0, "teknopazar-sahte");
    await driver.payShop("x", 1, "teknopazar-sahte");
    expect(await driver.answerCode("x", 2, "teknopazar-sahte", false)).toEqual({
      ok: true,
      hacked: null,
      reply: "İyi ki yazmadın! Kartı hemen kapattırıyorum, kart bilgileri o siteye gitti.",
      done: false,
    });
    expect(await driver.finish("x")).toEqual({ ok: true, reportPath: "", call: null });
  });

  it("doğru yerden alıp sahteyi bildirince iyi bitişte teşekkür satırı", async () => {
    const { driver } = play();
    await driver.send("x", [{ seq: 0, event: { type: "item_moved", item: "teknopazar-sahte", to: "spam" } }]);
    await driver.openLink("x", 1, "teknopazar");
    await driver.payShop("x", 2, "teknopazar");
    await driver.answerCode("x", 3, "teknopazar", true);
    const result = await driver.finish("x");
    if (!result.ok) throw new Error("bitmeliydi");
    expect(result.call?.lines.at(-1)).toBe("Öbür sahte TeknoPazar mailini de bildirmişsin. Teşekkürler canım!");
    expect(result.call?.title).toBe("Ege'nin kulaklığı yolda");
    expect(goodCall(room, true, false)?.lines).toHaveLength(2);
  });
});

describe("görevli oda: rapor ve Öğrenci gibi dene", () => {
  it("raporda görev satırı ve son anda durma cümlesi", () => {
    const view = buildReportView(room, "INBOX", score([...opened, { type: "link_clicked", item: "teknopazar-sahte" }, { type: "info_entered", item: "teknopazar-sahte" }, { type: "code_refused", item: "teknopazar-sahte" }]));
    expect(view.rows[0].did).toContain("son anda durdun");
    const mission = view.rows.find((r) => r.kind === "mission")!;
    expect(mission).toMatchObject({ title: "Görev: Kulaklığı doğru yerden al", tag: "ANNENİN GÖREVİ", did: "Görev yarım kaldı.", points: 0, max: 10 });
    const done = buildReportView(room, "INBOX", score([...opened, ...buyReal]));
    expect(done.rows.find((r) => r.kind === "mission")?.did).toBe("Ege'nin kulaklığını doğru mağazadan aldın.");
  });

  it("Öğrenci gibi dene: varsayılan yol 100, son anda durma ve görevi yapmama seçilebilir", () => {
    expect(fakeChoicesFor(room)).toContain("stopped");
    expect(fakeChoicesFor(kargo)).not.toContain("stopped");
    const path = defaultTryPath(room);
    expect(reportForPath(room, "INBOX", path).score).toBe(100);
    const stopped = reportForPath(room, "INBOX", { ...path, items: { ...path.items, "teknopazar-sahte": "stopped" }, missionDone: false });
    expect(stopped.rows[0]).toMatchObject({ outcome: "stopped", points: 0 });
    expect(stopped.score).toBe(50);
    expect(reportForPath(room, "INBOX", { ...path, items: { ...path.items, "teknopazar-sahte": "hacked" } }).status).toBe("hacked");
  });
});

describe("görevli oda: arayanın sesi", () => {
  it("oda dosyasındaki her ses sitede var ve satırlarla aynı sayıda", () => {
    const voice = room.mission!.voice!;
    expect(voice.lines).toHaveLength(room.mission!.lines.length);
    expect(voice.good).toHaveLength(room.mission!.good.length);
    expect(voice.bad).toHaveLength(room.mission!.bad.length);
    for (const src of [...voice.lines, ...voice.good, voice.goodReported, ...voice.bad]) {
      expect(existsSync(`public${src}`), src).toBe(true);
    }
  });

  it("yalnızca sitenin kendi mp3 dosyası kabul edilir", () => {
    const withVoice = (src: string) => parseScenario({ ...file.content, mission: { ...file.content.mission, voice: { lines: [src] } } });
    expect(withVoice("/sesler/a.mp3")).not.toBeNull();
    for (const bad of ["https://site.example/a.mp3", "//site.example/a.mp3", "/sesler/a.js", "javascript:alert(1)"]) {
      expect(withVoice(bad), bad).toBeNull();
    }
  });

  it("boş satır sesiyle birlikte düşer, sesi olmayan satır null", () => {
    expect(voicedLines(["Bir", " ", "Üç"], ["/a.mp3", "/b.mp3"])).toEqual({ lines: ["Bir", "Üç"], voice: ["/a.mp3", null] });
    expect(voicedLines(["Bir"])).toEqual({ lines: ["Bir"], voice: [null] });
  });

  it("bitiş aramaları satırlarıyla aynı sırada sesini taşır; ses yoksa yalnızca altyazı", () => {
    const voice = room.mission!.voice!;
    expect(goodCall(room, true, false)?.voice).toEqual(voice.good);
    expect(goodCall(room, true, true)?.voice).toEqual([...voice.good, voice.goodReported]);
    const silent = { ...room, mission: { ...room.mission!, voice: undefined } };
    expect(goodCall(silent, true, true)?.voice).toEqual([null, null, null]);
    expect(goodCall(silent, true, true)?.lines).toHaveLength(3);
  });
});

describe("görevli oda: kapak görseli (MissionCover)", () => {
  it("alış görevi: annen arıyor, ürünün ikonu ve fiyatı, iki aynı gönderen aynı renk, hediye etiketi", () => {
    expect(coverOf({ scenario: room })).toEqual({
      caller: "Annem",
      look: "mother",
      kind: "shop",
      icon: "headphones",
      price: "1.199 TL",
      senders: [
        { initial: "T", tone: 0 },
        { initial: "T", tone: 0 },
      ],
      steps: 0,
      badge: "gift",
    });
  });

  it("görevsiz odada kapak yok, bildirim telefonu kalır", () => {
    expect(coverOf({ scenario: kargo })).toBeNull();
    expect(coverOf({ scenario: null })).toBeNull();
  });

  it("kapağa sahte ya da gerçek bilgisi, adres, tutar ya da bitiş gitmez", () => {
    const text = JSON.stringify(coverOf({ scenario: room }));
    for (const secret of ["teknopazar-gercek", "4.850", "TKNPZR", "fake", "real", room.mission!.code]) expect(text).not.toContain(secret);
  });
});
