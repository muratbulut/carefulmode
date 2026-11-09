import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localDriver } from "@/components/lab/preview/local-driver";
import { defaultTryPath, fakeChoicesFor, reportForPath } from "@/lib/admin/try-path";
import { scenarioChecklist } from "@/lib/lab/checklist";
import { toClientScenario } from "@/lib/lab/client";
import { maxScore, opensOrder, opensRequest, parseScenario, rawTotal, type ScenarioContent } from "@/lib/lab/content";
import { reduceEvents, taskProgress, type LabEventData } from "@/lib/lab/events";
import { buildReportView } from "@/lib/lab/report";
import { missionDone, scoreScenario, type ScenarioReport } from "@/lib/lab/scoring";
import { goodCall, linkPageFor } from "@/lib/lab/story";
import { coverOf } from "@/lib/lab/cover";

// Satış görevli oda (Para Çarşısı "Eski telefonunu sat", 2 Kasım): babanın araması, ilan, sahte
// alıcının bankadaki ödeme isteği, pazar yerindeki sipariş ve kargodan önce telefonu sıfırlama.

const file = JSON.parse(readFileSync("labs/rooms/para-carsisi/eski-telefonunu-sat.json", "utf8"));
const room = parseScenario(file.content)!;
const kulaklik = parseScenario(JSON.parse(readFileSync("labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json", "utf8")).content)!;

const opened: LabEventData[] = ["selin", "pazar", "emre", "babam"].map((item) => ({ type: "item_opened", item }));
const sell = (prepared: boolean): LabEventData[] => [
  { type: "link_clicked", item: "pazar" },
  { type: "item_shipped", item: "pazar", prepared },
];
const bestAnswers: LabEventData[] = [
  { type: "answer", task: "onay", option: 0 },
  { type: "answer", task: "sifirla", option: 0 },
];
const score = (events: LabEventData[]) => scoreScenario(room, reduceEvents(events));

describe("satış görevi: şema ve oda dosyası", () => {
  it("oda dosyası şemaya uyuyor, Mesajlar'da, puanı 10 ve yayına hazır", () => {
    expect(file.template).toBe("MESSAGING");
    expect(room.mission?.look).toBe("father");
    expect(room.mission?.sale?.prep).toHaveLength(3);
    expect(maxScore(room)).toBe(rawTotal);
    expect(scenarioChecklist(room, "MESSAGING").filter((c) => !c.ok)).toEqual([]);
  });

  it("satış görevi Postam'da hazır sayılmaz; ödeme isteği ya da sipariş eksikse de", () => {
    const mission = (content: ScenarioContent, template: "INBOX" | "MESSAGING") => scenarioChecklist(content, template).find((c) => c.key === "mission")?.ok;
    expect(mission(room, "INBOX")).toBe(false);
    expect(mission({ ...room, items: room.items.map((i) => ({ ...i, request: undefined })) }, "MESSAGING")).toBe(false);
    expect(mission({ ...room, items: room.items.map((i) => ({ ...i, order: undefined })) }, "MESSAGING")).toBe(false);
    expect(mission({ ...room, mission: { ...room.mission!, sale: { ...room.mission!.sale!, prep: [] } } }, "MESSAGING")).toBe(false);
    // Alış görevi (kart ve mağaza) ile satış görevi karışmaz.
    expect(mission({ ...room, mission: { ...room.mission!, card: { number: "1", expiry: "1" } } }, "MESSAGING")).toBe(false);
    expect(mission(kulaklik, "INBOX")).toBe(true);
  });

  it("eski görevli oda anne çizimiyle okunur, satış alanı yok", () => {
    expect(kulaklik.mission?.look).toBe("mother");
    expect(kulaklik.mission?.sale).toBeUndefined();
    expect(kulaklik.items.every((i) => !i.request && !i.order)).toBe(true);
  });
});

describe("satış görevi: babanın sesi", () => {
  it("her sesli satırın dosyası var; sesi olmayan satır altyazıyla geçer", () => {
    const voice = room.mission!.voice!;
    expect(voice.lines).toHaveLength(room.mission!.lines.length);
    expect(voice.good).toHaveLength(room.mission!.good.length);
    expect(voice.bad).toHaveLength(room.mission!.bad.length);
    for (const src of [...voice.lines, ...voice.good, voice.goodReported, ...voice.bad].filter(Boolean)) {
      expect(existsSync(`public${src}`), src).toBe(true);
    }
    // "Telefonu da sıfırlamışsın" satırı kayıtta yok (2 Kasım): o satır sessiz, teşekkür satırı sesli.
    expect(goodCall(room, true, true)?.voice).toEqual([voice.good[0], voice.good[1], null, voice.goodReported]);
  });
});

describe("satış görevi: tarayıcıya giden içerik", () => {
  const client = toClientScenario(room, "MESSAGING");
  const json = JSON.stringify(client);

  it("ilan ve hazırlık maddeleri gider; istek tutarı, bitişler ve hazırlamadan gönderme mesajı gitmez", () => {
    expect(client.mission?.sale).toMatchObject({ price: "4.000 TL", platform: "İkinci El Pazarı" });
    expect(client.mission?.card).toBeNull();
    expect(client.mission?.shop).toBeNull();
    for (const secret of ["İstek reddedildi", "fotoğrafların duruyor", "hesabından 4.000 TL çıkmış", "Telefonu da sıfırlamışsın", "Hesabından 4.000 TL çıktı", "Selin denen"]) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toContain("request");
    expect(json).not.toContain("order");
  });

  it("sahte mesajın bağlantısı bankanın ödeme isteğini, pazar yerinin bildirimi siparişi açar", () => {
    const selin = room.items.find((i) => i.id === "selin")!;
    const pazar = room.items.find((i) => i.id === "pazar")!;
    expect(opensRequest(room, selin)).toBe(true);
    expect(opensOrder(room, pazar)).toBe(true);
    expect(linkPageFor(room, "MESSAGING", { ...selin, link: selin.link! })).toEqual({
      kind: "request",
      url: "bankam.com.tr/odeme-istegi/48213",
      bank: "Bankam",
      from: "Selin K.",
      amount: "4.000 TL",
    });
    const order = linkPageFor(room, "MESSAGING", { ...pazar, link: pazar.link! });
    expect(order).toMatchObject({ kind: "order", buyer: "Emre T.", sale: { unprepared: "" } });
  });
});

describe("satış görevi: puan ve görev", () => {
  it("sıfırlayıp gerçek alıcıya gönderen, sahteyi bildiren: 100, güvende", () => {
    const report = score([...opened, ...sell(true), { type: "item_moved", item: "selin", to: "spam" }, { type: "review_done" }, ...bestAnswers]);
    expect(report).toMatchObject({ status: "safe", title: "caught", score: 100 });
    expect(report.rows.find((r) => r.type === "mission")).toMatchObject({ done: true, points: 1 });
  });

  it("sıfırlamadan gönderen: görev yarım (0), hacklenmez", () => {
    const state = reduceEvents([...opened, ...sell(false)]);
    expect(missionDone(room, state)).toBe(false);
    expect(taskProgress(room.tasks, state, true).done[1]).toBe(true);
    const report = scoreScenario(room, state);
    expect(report.status).not.toBe("hacked");
    expect(report.rows.find((r) => r.type === "mission")).toMatchObject({ done: false, points: 0 });
  });

  it("ödeme isteğini reddetmek görevi bitirmez; onaylamak hacklenmektir (Para türü)", () => {
    const refused = reduceEvents([...opened, { type: "link_clicked", item: "selin" }, { type: "code_refused", item: "selin" }]);
    expect(taskProgress(room.tasks, refused, true).done[1]).toBe(false);
    const hacked = score([...opened, { type: "link_clicked", item: "selin" }, { type: "code_entered", item: "selin" }]);
    expect(hacked).toMatchObject({ status: "hacked", compromise: "financial" });
    expect(hacked.rows[0]).toMatchObject({ outcome: "hacked", by: "request", points: 0 });
  });
});

describe("satış görevi: önizleme sürücüsü (sunucuyla aynı kurallar)", () => {
  function play() {
    let ended: ScenarioReport | null = null;
    const driver = localDriver(room, "MESSAGING", (r) => (ended = r));
    return { driver, ended: () => ended };
  }

  it("bağlantı açılmadan istek kararı ve kargo yok; her biri bir kez", async () => {
    const { driver } = play();
    expect(await driver.answerCode("x", 0, "selin", false)).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.shipOrder("x", 0, "pazar", true)).toEqual({ ok: false, reason: "invalid" });
    await driver.openLink("x", 0, "selin");
    expect(await driver.answerCode("x", 1, "selin", false)).toEqual({
      ok: true,
      hacked: null,
      reply: "Bankam: İstek reddedildi, hesabından para çıkmadı. Satıcı parayı almak için hiçbir isteği onaylamaz.",
      done: false,
    });
    expect(await driver.answerCode("x", 2, "selin", true)).toEqual({ ok: false, reason: "invalid" });
    await driver.openLink("x", 3, "pazar");
    // Sipariş bir kez gönderilir; ödeme isteği olmayan mesajda istek kararı yok.
    expect(await driver.shipOrder("x", 4, "pazar", true)).toEqual({ ok: true, reply: "", done: true });
    expect(await driver.shipOrder("x", 5, "pazar", true)).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.answerCode("x", 6, "pazar", true)).toEqual({ ok: false, reason: "invalid" });
  });

  it("hazırlamadan gönderince alıcının mesajı; bitişte iyi bitiş araması yok", async () => {
    const { driver } = play();
    await driver.openLink("x", 0, "pazar");
    const shipped = await driver.shipOrder("x", 1, "pazar", false);
    expect(shipped).toMatchObject({ ok: true, done: false });
    if (shipped.ok) expect(shipped.reply).toContain("fotoğrafların duruyor");
    expect(await driver.finish("x")).toEqual({ ok: true, reportPath: "", call: null });
  });

  it("ödeme isteğini onaylayınca kötü bitiş araması (baba) ve odaya özgü alarm", async () => {
    const { driver, ended } = play();
    await driver.openLink("x", 0, "selin");
    const result = await driver.answerCode("x", 1, "selin", true);
    if (!result.ok || !result.hacked) throw new Error("hacklenmeliydi");
    expect(result.hacked.via).toBe("request");
    expect(result.hacked.amount).toBe("4.000 TL");
    expect(result.hacked.call?.caller).toBe("Babam");
    expect(result.hacked.alarm?.line).toBe("Hesabından 4.000 TL çıktı.");
    expect(ended()?.status).toBe("hacked");
  });

  it("sıfırlayıp gönderen ve sahteyi bildirene iyi bitişte teşekkür satırı", async () => {
    const { driver } = play();
    await driver.send("x", [{ seq: 0, event: { type: "item_moved", item: "selin", to: "spam" } }]);
    await driver.openLink("x", 1, "pazar");
    await driver.shipOrder("x", 2, "pazar", true);
    const result = await driver.finish("x");
    if (!result.ok) throw new Error("bitmeliydi");
    expect(result.call?.caller).toBe("Babam");
    expect(result.call?.lines.at(-1)).toBe("O Selin denen kişiyi de bildirmişsin, çok iyi yapmışsın.");
    expect(goodCall(room, true, false)?.lines).toHaveLength(3);
  });
});

describe("satış görevi: rapor ve Öğrenci gibi dene", () => {
  it("raporda ödeme isteği cümlesi ve görev satırı", () => {
    const view = buildReportView(room, "MESSAGING", score([...opened, { type: "link_clicked", item: "selin" }, { type: "code_entered", item: "selin" }]));
    expect(view.rows[0].did).toBe("Ödeme isteğini onayladın; para senin hesabından çıktı.");
    expect(view.rows[0].right).toContain("onaylamadan");
    const done = buildReportView(room, "MESSAGING", score([...opened, ...sell(true)]));
    expect(done.rows.find((r) => r.kind === "mission")).toMatchObject({ tag: "BABANIN GÖREVİ", did: "Telefonu sıfırlayıp İkinci El Pazarı'ndaki gerçek alıcıya gönderdin." });
  });

  it("Öğrenci gibi dene: varsayılan yol 100, son anda durma yok, görevi yapmama seçilebilir", () => {
    expect(fakeChoicesFor(room)).not.toContain("stopped");
    const path = defaultTryPath(room);
    expect(reportForPath(room, "MESSAGING", path).score).toBe(100);
    expect(reportForPath(room, "MESSAGING", { ...path, missionDone: false }).score).toBe(90);
    const hacked = reportForPath(room, "MESSAGING", { ...path, items: { ...path.items, selin: "hacked" } });
    expect(hacked.status).toBe("hacked");
  });
});

describe("satış görevi: kapak görseli (MissionCover)", () => {
  it("baban arıyor, ilanın ikonu ve fiyatı, iki farklı alıcı iki renk, üç hazırlık adımı, etiket cüzdanlar", () => {
    expect(coverOf({ scenario: room })).toEqual({
      caller: "Babam",
      look: "father",
      kind: "sale",
      icon: "phone",
      price: "4.000 TL",
      senders: [
        { initial: "S", tone: 0 },
        { initial: "İ", tone: 1 },
      ],
      steps: 3,
      badge: null,
    });
  });
});
