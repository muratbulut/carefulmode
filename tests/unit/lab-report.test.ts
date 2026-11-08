import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { localDriver, localTrainingDriver } from "@/components/lab/preview/local-driver";
import { splitReminder } from "@/components/lab/frame/StartDialog";
import { parseScenario, parseTraining } from "@/lib/lab/content";
import { reduceEvents, type LabEventData } from "@/lib/lab/events";
import { buildReportView } from "@/lib/lab/report";
import { scoreScenario, type ScenarioReport } from "@/lib/lab/scoring";
import { compromisedAccount, hackedStory, linkPageFor } from "@/lib/lab/story";

const load = (file: string) => JSON.parse(readFileSync(`labs/examples/${file}.json`, "utf8")).content;
const kargo = parseScenario(load("sahte-kargo-maili"))!;
const sms = parseScenario(load("kodu-soran-arkadas"))!;
const training = parseTraining(load("oltalama-egitimi"))!;

const report = (events: LabEventData[]) => scoreScenario(kargo, reduceEvents(events));

describe("rapor ekranı (Rapor-Son)", () => {
  it("hacklenen öğrenci: başlık, kararlar, kaçırdığı işaretler ve en çok üç ipucu", () => {
    const view = buildReportView(kargo, "INBOX", report([
      { type: "link_clicked", item: "kargo" },
      { type: "info_entered", item: "kargo" },
    ]));
    expect(view.status).toBe("hacked");
    expect(view.score).toBe(30);
    expect(view.rows.map((r) => r.key)).toEqual(["i-kargo", "i-okul", "i-market", "i-elif", "q-okul-sorusu", "q-market-sorusu"]);
    expect(view.rows[0]).toMatchObject({ kind: "fake", state: "bad", points: 0, max: 40, title: "Kargo Takip maili" });
    expect(view.rows[4]).toMatchObject({ state: "skip", did: "Cevaplamadın." });
    // Cevapsız soru "yanlış" sayılmaz, ayrı sayılır.
    expect(view.counts).toEqual({ ok: 3, part: 0, bad: 1, skip: 2 });
    expect(view.signs?.heading).toBe("Kaçırdığın işaretler");
    expect(view.signs?.list.map((s) => s.at)).toEqual(["sender", "text", "link"]);
    expect(view.signs?.item.paragraphs.join(" ")).not.toContain("**");
    expect(view.tips.length).toBeLessThanOrEqual(3);
    expect(view.tips.length).toBeGreaterThan(0);
  });

  it("sahte maili bildiren öğrenci: işaretler 'yakaladığın' başlığıyla", () => {
    const view = buildReportView(kargo, "INBOX", report([
      { type: "item_moved", item: "kargo", to: "spam" },
      { type: "answer", task: "okul-sorusu", option: 2 },
      { type: "answer", task: "market-sorusu", option: 1 },
    ]));
    expect(view.status).toBe("safe");
    expect(view.score).toBe(100);
    expect(view.counts).toEqual({ ok: 6, part: 0, bad: 0, skip: 0 });
    expect(view.signs?.heading).toBe("Yakaladığın sahte maildeki işaretler");
  });

  it("raporda içerikte olmayan satır atlanır (eski sürümden kalan rapor)", () => {
    const old: ScenarioReport = { ...report([]), rows: [...report([]).rows, { type: "real", item: "silinmis", outcome: "kept", state: "ok", points: 1, max: 1 }] };
    expect(buildReportView(kargo, "INBOX", old).rows.some((r) => r.key === "i-silinmis")).toBe(false);
  });
});

describe("hatırlatmalar (Lab-Cerceve-Baslangic)", () => {
  it("'Başlık: açıklama' ilk ': ' işaretinden bölünür", () => {
    expect(splitReminder("Gönderen adresine bak: Görünen isim değil, @ işaretinden sonrası önemli.")).toEqual({
      title: "Gönderen adresine bak",
      text: "Görünen isim değil, @ işaretinden sonrası önemli.",
    });
    expect(splitReminder("Saat: 09:41 gibi")).toEqual({ title: "Saat", text: "09:41 gibi" });
    expect(splitReminder("Sadece başlık")).toEqual({ title: "Sadece başlık", text: "" });
  });
});

describe("bağlantı ve hacklendin hikâyesi", () => {
  const fake = kargo.items.find((i) => i.id === "kargo")!;
  const real = kargo.items.find((i) => i.id === "market")!;

  it("sahte maildeki bağlantı sahte sayfayı, gerçekteki yalnızca adresi açar", () => {
    expect(linkPageFor(kargo, "INBOX", { ...fake, link: fake.link! })).toMatchObject({ kind: "trap", compromise: "account", url: kargo.trap.url });
    if (real.link) expect(linkPageFor(kargo, "INBOX", { ...real, link: real.link })).toEqual({ kind: "site", url: real.link.url });
  });

  it("saatler Türkiye saatiyle, üçüncü adım bir dakika sonra", () => {
    const story = hackedStory(kargo, "INBOX", fake, "link", { first: new Date("2026-10-11T19:20:00Z"), second: new Date("2026-10-11T19:21:30Z") }, "/rapor");
    expect(story.times).toEqual(["22:20", "22:21", "22:22"]);
    expect(story).toMatchObject({ kind: "account", sender: "Kargo Takip", domain: "kargo-teslimat-tr.xyz", contact: "Okul Duyuru", reportPath: "/rapor" });
  });

  it('"Hangi hesap?" boşsa Postam hesabı; doluysa o hesap, bildirimler mail demez (sabah soruları 25d)', () => {
    expect(compromisedAccount("")).toEqual({ name: "Postam", mail: true });
    expect(compromisedAccount(" postam ")).toEqual({ name: "postam", mail: true });
    expect(compromisedAccount(" Oyun ")).toEqual({ name: "Oyun", mail: false });
    expect(hackedStory(kargo, "INBOX", fake, "link", { first: new Date(), second: new Date() }, "").account).toEqual({ name: "Postam", mail: true });
    const game = { ...kargo, trap: { ...kargo.trap, account: "Oyun" } };
    expect(hackedStory(game, "INBOX", fake, "link", { first: new Date(), second: new Date() }, "").account).toEqual({ name: "Oyun", mail: false });
    expect(linkPageFor(game, "INBOX", { ...fake, link: fake.link! })).toMatchObject({ kind: "trap", account: { name: "Oyun", mail: false } });
  });

  it('"Bu linki sen mi gönderdin?" diyen kişi hesabın kendi uygulaması olmaz (ör. Postam\'ın kod mesajı)', () => {
    const kod = parseScenario(load("kodu-soran-arkadas"))!;
    const deniz = kod.items.find((i) => i.kind === "fake")!;
    expect(kod.items.find((i) => i.kind === "real")!.sender).toBe("Postam");
    expect(hackedStory(kod, "MESSAGING", deniz, "reply", { first: new Date(), second: new Date() }, "").contact).toBe("Annem");
  });
});

describe("yönetim önizlemesinin sürücüsü (Öğrenci gibi dene)", () => {
  it("sahte sayfaya bilgi girince hacklenir; rapor sunucudakiyle aynı hesaplanır", async () => {
    const onEnd = vi.fn();
    const driver = localDriver(kargo, "INBOX", onEnd);
    const started = await driver.start();
    expect(started.ok).toBe(true);
    const id = started.ok ? started.attemptId : "";
    await driver.send(id, [{ seq: 0, event: { type: "item_opened", item: "kargo" } }]);
    // Tıklamadan bilgi girilemez.
    expect(await driver.submitTrap(id, 1, "kargo")).toEqual({ ok: false, reason: "invalid" });
    const link = await driver.openLink(id, 1, "kargo");
    expect(link.ok && link.page.kind).toBe("trap");
    const trap = await driver.submitTrap(id, 2, "kargo");
    expect(trap.ok && trap.hacked.kind).toBe("account");
    expect(onEnd).toHaveBeenCalledTimes(1);
    const expected = report([
      { type: "item_opened", item: "kargo" },
      { type: "link_clicked", item: "kargo" },
      { type: "info_entered", item: "kargo" },
    ]);
    expect(onEnd.mock.calls[0][0]).toEqual(expected);
    // Lab bittikten sonra yeni karar alınmaz.
    expect(await driver.send(id, [{ seq: 3, event: { type: "item_opened", item: "okul" } }])).toEqual({ ok: false, reason: "ended" });
  });

  it("mesajlaşmada kodu sahte konuşmaya gönderen hacklenir, gerçek konuşmaya gönderen hacklenmez", async () => {
    const onEnd = vi.fn();
    const driver = localDriver(sms, "MESSAGING", onEnd);
    const real = await driver.sendReply("x", 0, "annem", true);
    expect(real).toEqual({ ok: true, hacked: null });
    expect(onEnd).not.toHaveBeenCalled();
    const fake = await driver.sendReply("x", 1, "deniz", true);
    expect(fake.ok && fake.hacked?.template).toBe("MESSAGING");
    expect(onEnd.mock.calls[0][0].status).toBe("hacked");
  });

  it("labı bitirince rapor bir kez verilir", async () => {
    const onEnd = vi.fn();
    const driver = localDriver(kargo, "INBOX", onEnd);
    await driver.send("x", [{ seq: 0, event: { type: "item_moved", item: "kargo", to: "spam" } }]);
    await driver.finish("x");
    await driver.finish("x");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0].status).toBe("safe");
  });

  it("eğitim kartlarının cevapları taslaktan denetlenir", async () => {
    const driver = localTrainingDriver(training);
    const find = training.cards.find((c) => c.type === "clickFind");
    const quiz = training.cards.find((c) => c.type === "quiz");
    if (find?.type === "clickFind") {
      const hit = await driver.spot(find.id, find.spots[0].part);
      expect(hit).toEqual({ ok: true, spot: { index: 0, text: find.spots[0].text } });
    }
    if (quiz?.type === "quiz") {
      const result = await driver.answer(quiz.id, quiz.answer);
      expect(result.ok && result.result.correct).toBe(true);
    }
    expect(await driver.answer("yok", 0)).toEqual({ ok: false, reason: "invalid" });
    expect(await driver.save(99)).toEqual({ ok: true });
  });

  it("önizlemede de soru cevaplanmadan eğitim bitmez (öğrencideki kural, B1)", async () => {
    const driver = localTrainingDriver(training);
    const quiz = training.cards.findIndex((c) => c.type === "quiz");
    expect(await driver.save(1)).toEqual({ ok: true });
    expect(await driver.save(training.cards.length)).toEqual({ ok: false, reason: "unanswered", card: quiz });
    await driver.answer(training.cards[quiz].id, 0);
    expect(await driver.save(training.cards.length)).toEqual({ ok: true });
  });
});

describe("Mesajlar'da bağlantı sahte sayfa açar (M1)", () => {
  // Örnek mesajlaşma odası, sahte mesajına bağlantı ve sahte sayfa eklenmiş hâliyle.
  const page = parseScenario({
    ...load("kodu-soran-arkadas"),
    items: load("kodu-soran-arkadas").items.map((i: { id: string }) =>
      i.id === "deniz" ? { ...i, link: { url: "cekilis-tablet.xyz/form", text: "" } } : i,
    ),
    trap: { ...load("kodu-soran-arkadas").trap, title: "Kargo formu", text: "Tableti göndermek için bilgilerini yaz.", ask: "Ad, okul ve ev adresi", secret: "" },
  })!;
  const deniz = page.items.find((i) => i.id === "deniz")!;

  it("sayfa başlığı yoksa (eski odalar) sahte mesajdaki bağlantı yalnızca adresi açar", () => {
    const old = { ...sms, items: sms.items.map((i) => (i.id === "deniz" ? { ...i, link: { url: "deniz.xyz", text: "" } } : i)) };
    const item = old.items.find((i) => i.id === "deniz")!;
    expect(linkPageFor(old, "MESSAGING", { ...item, link: item.link! })).toEqual({ kind: "site", url: "deniz.xyz" });
  });

  it("sayfa başlığı varsa sahte mesajdaki bağlantı sahte sayfayı açar; adres boşsa mesajdaki bağlantı", () => {
    expect(linkPageFor(page, "MESSAGING", { ...deniz, link: deniz.link! })).toMatchObject({
      kind: "trap",
      url: "cekilis-tablet.xyz/form",
      title: "Kargo formu",
      ask: "Ad, okul ve ev adresi",
    });
  });

  it("önizlemede bağlantıyı açıp bilgi giren hacklenir; hikâye ve rapor bağlantıdan söz eder", async () => {
    const onEnd = vi.fn();
    const driver = localDriver(page, "MESSAGING", onEnd);
    expect(await driver.submitTrap("x", 0, "deniz")).toEqual({ ok: false, reason: "invalid" });
    const link = await driver.openLink("x", 0, "deniz");
    expect(link.ok && link.page.kind).toBe("trap");
    const trap = await driver.submitTrap("x", 1, "deniz");
    expect(trap.ok && trap.hacked).toMatchObject({ template: "MESSAGING", via: "link", domain: "cekilis-tablet.xyz" });
    const result: ScenarioReport = onEnd.mock.calls[0][0];
    expect(result.status).toBe("hacked");
    expect(result.rows[0]).toMatchObject({ type: "fake", outcome: "hacked", by: "link" });
    const view = buildReportView(page, "MESSAGING", result);
    expect(view.rows[0]).toMatchObject({ did: "Bağlantıyı açtın ve sahte sayfaya bilgilerini yazdın.", right: "Bağlantıyı açmadan bildirip engellemek." });
  });

  it("kodla hacklenen eski odada rapor ve hikâye cevaptan söz eder", async () => {
    const onEnd = vi.fn();
    const driver = localDriver(sms, "MESSAGING", onEnd);
    const sent = await driver.sendReply("x", 0, "deniz", true);
    expect(sent.ok && sent.hacked?.via).toBe("reply");
    const view = buildReportView(sms, "MESSAGING", onEnd.mock.calls[0][0]);
    expect(view.rows[0]).toMatchObject({ did: "İstenen kodu sahte mesaja gönderdin.", right: "Cevap yazmadan bildirip engellemek." });
  });

  it("sahte sayfası olmayan odada gelen kutusu dışında sahte sayfaya bilgi girilemez", async () => {
    const driver = localDriver(sms, "MESSAGING", vi.fn());
    expect(await driver.submitTrap("x", 0, "deniz")).toEqual({ ok: false, reason: "invalid" });
  });
});
