import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioChecklist, trainingChecklist, isReady } from "@/lib/lab/checklist";
import { toClientCard, toClientScenario } from "@/lib/lab/client";
import { maxScore, parseScenario, parseTraining, type ScenarioContent } from "@/lib/lab/content";
import { containsSecret, reduceEvents, taskProgress, type LabEventData } from "@/lib/lab/events";
import { scoreScenario } from "@/lib/lab/scoring";
import { checkQuiz, checkSpot, firstUnanswered } from "@/lib/lab/training";

const examplesDir = "labs/examples";
const examples = readdirSync(examplesDir).map((file) => ({ file, json: JSON.parse(readFileSync(join(examplesDir, file), "utf8")) }));
const example = (slug: string) => examples.find((e) => e.json.slug === slug)!.json;

const kargo = parseScenario(example("sahte-kargo-maili").content)!;
const sms = parseScenario(example("kodu-soran-arkadas").content)!;

function play(content: ScenarioContent, events: LabEventData[]) {
  return scoreScenario(content, reduceEvents(events));
}

const answers = (okul: number, market: number): LabEventData[] => [
  { type: "answer", task: "okul-sorusu", option: okul },
  { type: "answer", task: "market-sorusu", option: market },
];

describe("örnek lablar (labs/examples)", () => {
  it.each(examples)("$file şemaya uyar ve yayına hazır", ({ json }) => {
    if (json.type === "TRAINING") {
      const content = parseTraining(json.content);
      expect(content).not.toBeNull();
      expect(isReady(trainingChecklist(content!))).toBe(true);
    } else {
      const content = parseScenario(json.content);
      expect(content).not.toBeNull();
      expect(scenarioChecklist(content!, json.template).filter((c) => !c.ok)).toEqual([]);
      expect(maxScore(content!)).toBe(10);
    }
  });

  it("öğe, görev ve kart kimlikleri tekrarsız", () => {
    for (const { json } of examples) {
      const ids = json.type === "TRAINING" ? json.content.cards.map((c: { id: string }) => c.id) : [...json.content.items, ...json.content.tasks].map((x: { id: string }) => x.id);
      expect(new Set(ids).size, json.slug).toBe(ids.length);
    }
  });
});

describe("Sahte kargo maili puanlaması (Rapor-Son)", () => {
  it("sahte maili tıklamadan bildirip gerçekleri bırakan ve en iyi cevapları veren 100/100 alır", () => {
    const report = play(kargo, [{ type: "item_opened", item: "kargo" }, { type: "item_moved", item: "kargo", to: "spam" }, ...answers(2, 1)]);
    expect(report.score).toBe(100);
    expect(report.status).toBe("safe");
    expect(report.title).toBe("caught");
    expect(report.caught).toBe(true);
    // Hiçbir koşul tutmadı; üç genel ipucu eklenir.
    expect(report.tips).toEqual([]);
    expect(report.genericTips).toBe(3);
  });

  it("önce linke tıklayıp sonra bildiren kısmen puan alır, yine de güvende sayılır", () => {
    const report = play(kargo, [{ type: "link_clicked", item: "kargo" }, { type: "item_moved", item: "kargo", to: "spam" }, ...answers(2, 1)]);
    expect(report.rows[0]).toMatchObject({ outcome: "reportedAfterEngaging", points: 2, state: "part" });
    expect(report.score).toBe(80);
    expect(report.status).toBe("safe");
    expect(report.title).toBe("safeButMissed");
    expect(report.tips).toEqual([0, 2]);
  });

  it("dokunmayan kıl payı kurtulur; linke tıklayıp bırakan 0 alır", () => {
    expect(play(kargo, answers(0, 1)).rows[0]).toMatchObject({ outcome: "ignored", points: 1 });
    const clicked = play(kargo, [{ type: "link_clicked", item: "kargo" }, ...answers(0, 1)]);
    expect(clicked.rows[0]).toMatchObject({ outcome: "engagedLeft", points: 0, state: "bad" });
    expect(clicked.status).toBe("risky");
    expect(clicked.title).toBe("missed");
  });

  it("sahte sayfaya bilgi giren hacklenir", () => {
    const report = play(kargo, [{ type: "link_clicked", item: "kargo" }, { type: "info_entered", item: "kargo" }]);
    expect(report.status).toBe("hacked");
    expect(report.compromise).toBe("account");
    expect(report.rows[0]).toMatchObject({ outcome: "hacked", points: 0 });
    // Cevaplanmayan sorular "atlandı", gerçek mailler yerinde: 3 puan.
    expect(report.rows.filter((r) => r.type === "question").every((r) => r.state === "skip")).toBe(true);
    expect(report.score).toBe(30);
  });

  it("gerçek maili bildirmek o maili sıfırlar, silmek 1 puan bırakır", () => {
    const report = play(kargo, [
      { type: "item_moved", item: "kargo", to: "spam" },
      { type: "item_moved", item: "okul", to: "spam" },
      { type: "item_moved", item: "elif", to: "trash" },
      ...answers(2, 1),
    ]);
    expect(report.rows.find((r) => r.type === "real" && r.item === "okul")).toMatchObject({ outcome: "reported", points: 0 });
    expect(report.rows.find((r) => r.type === "real" && r.item === "elif")).toMatchObject({ outcome: "deleted", points: 1 });
    expect(report.score).toBe(90);
    expect(report.tips).toEqual([3]);
  });

  it("geri alınan mail son klasörüne göre puanlanır", () => {
    const report = play(kargo, [
      { type: "item_moved", item: "okul", to: "spam" },
      { type: "item_moved", item: "okul", to: "inbox" },
      { type: "item_moved", item: "kargo", to: "spam" },
      ...answers(2, 1),
    ]);
    expect(report.score).toBe(100);
  });
});

describe("Kodu soran arkadaş (mesajlaşma)", () => {
  it("kodu sahte konuşmaya gönderen hacklenir; gerçek konuşmaya göndermek hacklemez", () => {
    expect(play(sms, [{ type: "reply_sent", item: "deniz", secret: true }]).status).toBe("hacked");
    const safe = play(sms, [{ type: "reply_sent", item: "annem", secret: true }, { type: "item_moved", item: "deniz", to: "spam" }]);
    expect(safe.status).toBe("safe");
  });

  it("kodu vermeden cevap yazıp bırakan 0 alır", () => {
    expect(play(sms, [{ type: "reply_sent", item: "deniz", secret: false }]).rows[0]).toMatchObject({ outcome: "engagedLeft", points: 0 });
  });

  it("kod, yazılan mesajın içinde boşluklu ya da boşluksuz aranır", () => {
    expect(containsSecret("al bakalım 482913", "482 913")).toBe(true);
    expect(containsSecret("4 8 2 9 1 3 işte", "482 913")).toBe(true);
    expect(containsSecret("kodu vermem", "482 913")).toBe(false);
  });
});

describe("görev sırası", () => {
  it("görevler sırayla biter: aç, incele, sorular", () => {
    const tasks = toClientScenario(kargo, "INBOX").tasks;
    expect(taskProgress(tasks, reduceEvents([])).current).toBe(0);
    expect(taskProgress(tasks, reduceEvents([{ type: "item_opened", item: "kargo" }])).current).toBe(1);
    const all = reduceEvents([{ type: "item_opened", item: "kargo" }, { type: "review_done" }, ...answers(0, 0)]);
    expect(taskProgress(tasks, all).finished).toBe(true);
    expect(all.decisions).toBe(3);
  });
});

describe("tarayıcıya giden içerik (Lab güvenliği)", () => {
  it("senaryoda doğru kararlar, puanlar, işaretler ve sahte sayfa gitmez", () => {
    const text = JSON.stringify(toClientScenario(kargo, "INBOX"));
    for (const secret of ['"kind"', '"fake"', '"real"', '"points"', '"signs"', '"why"', '"right"', '"tips"', "Paketiniz depoda bekliyor", "Postam şifresi"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("eğitim kartlarında doğru cevap, şüpheli yerler ve açıklamalar gitmez", () => {
    const training = parseTraining(example("oltalama-egitimi").content)!;
    const text = JSON.stringify(training.cards.map(toClientCard));
    for (const secret of ['"answer"', '"explain"', '"spots"', "Acele ettirmek bir tuzak"]) expect(text, secret).not.toContain(secret);
  });

  it("eğitim cevapları sunucuda denetlenir", () => {
    const training = parseTraining(example("oltalama-egitimi").content)!;
    const find = training.cards.find((c) => c.type === "clickFind")!;
    if (find.type !== "clickFind") throw new Error();
    expect(checkSpot(find, "address")).toMatchObject({ index: 0 });
    expect(checkSpot(find, "subject")).toBeNull();
    const quiz = training.cards.find((c) => c.type === "quiz")!;
    if (quiz.type !== "quiz") throw new Error();
    expect(checkQuiz(quiz, 1).correct).toBe(true);
    expect(checkQuiz(quiz, 0)).toMatchObject({ correct: false, answer: 1 });
  });

  it("eğitim yalnızca bütün soruları cevaplanınca biter: ilk cevaplanmamış soru kartı (B1)", () => {
    const training = parseTraining(example("oltalama-egitimi").content)!;
    const quiz = training.cards.findIndex((c) => c.type === "quiz");
    expect(firstUnanswered(training.cards, [])).toBe(quiz);
    // Bilgi ve tıkla-bul kartlarının cevabı yoktur; yalnızca soru kartı sayılır.
    expect(firstUnanswered(training.cards, training.cards.filter((c) => c.type !== "quiz").map((c) => c.id))).toBe(quiz);
    expect(firstUnanswered(training.cards, [training.cards[quiz].id])).toBeNull();

    const withVideo = parseTraining({
      ...example("oltalama-egitimi").content,
      cards: [
        ...example("oltalama-egitimi").content.cards,
        { id: "izle", type: "video", title: "Video", src: "/videolar/a.mp4" },
        { id: "izle-sor", type: "video", title: "Video", src: "/videolar/b.mp4", question: { at: 30, question: "Ne oldu?", options: ["A", "B"], answer: 0 } },
      ],
    })!;
    // Sorusuz video izlemekle geçilir; sorulu videonun sorusu cevaplanmalı.
    expect(firstUnanswered(withVideo.cards, [training.cards[quiz].id])).toBe(withVideo.cards.length - 1);
    expect(firstUnanswered(withVideo.cards, [training.cards[quiz].id, "izle-sor"])).toBeNull();
  });

  it("eğitim videosu yalnızca sitenin kendi dosyası olabilir; dış adres (//site dahil) reddedilir", () => {
    const withVideo = (src: string) =>
      parseTraining({ meta: example("oltalama-egitimi").content.meta, cards: [{ id: "video", type: "video", title: "Video", src }] });
    expect(withVideo("/videolar/oltalama.mp4")).not.toBeNull();
    expect(withVideo("")).not.toBeNull();
    for (const src of ["//kotu-site.example/video.mp4", "https://kotu-site.example/video.mp4", "javascript:alert(1)", "/videolar/a b.mp4"]) {
      expect(withVideo(src), src).toBeNull();
    }
  });
});

describe("yayına hazır mı listesi", () => {
  it("eksik lab yayına çıkamaz; her eksik maddesiyle görünür", () => {
    const empty = parseScenario({ meta: { name: "" } })!;
    const failed = scenarioChecklist(empty, "INBOX").filter((c) => !c.ok).map((c) => c.key);
    expect(failed).toEqual(["cover", "items", "signs", "trap", "tasks", "total", "tips"]);
  });

  it("toplam puan 10 değilse yayına çıkamaz", () => {
    const changed = { ...kargo, tasks: kargo.tasks.map((t) => (t.id === "market-sorusu" ? { ...t, options: t.options.map((o) => ({ ...o, points: o.points * 2 })) } : t)) };
    expect(scenarioChecklist(changed, "INBOX").find((c) => c.key === "total")!.ok).toBe(false);
  });

  it('"Doğrusu" ve "Neden?" yalnızca soru görevinde istenir; BİLDİR görevinde boş kalabilir (sabah soruları 25b)', () => {
    const rightWhy = (tasks: typeof kargo.tasks) => scenarioChecklist({ ...kargo, tasks }, "INBOX").find((c) => c.key === "rightWhy")!.ok;
    expect(kargo.tasks.find((t) => t.type === "review")).toMatchObject({ right: "", why: "" });
    expect(rightWhy(kargo.tasks)).toBe(true);
    expect(rightWhy(kargo.tasks.map((t) => (t.type === "question" ? { ...t, why: " " } : t)))).toBe(false);
  });
  it("mesajlaşmada tuzak kod ya da sahte sayfa olabilir; sayfa için sahte mesajda bağlantı gerekir (M1)", () => {
    const trapOk = (content: typeof sms) => scenarioChecklist(content, "MESSAGING").find((c) => c.key === "trap")!.ok;
    expect(trapOk(sms)).toBe(true);
    const pageOnly = { ...sms, trap: { ...sms.trap, secret: "", title: "Kargo formu" } };
    expect(trapOk(pageOnly)).toBe(false);
    const withLink = { ...pageOnly, items: sms.items.map((i) => (i.kind === "fake" ? { ...i, link: { url: "cekilis-tablet.xyz", text: "" } } : i)) };
    expect(trapOk(withLink)).toBe(true);
    expect(trapOk({ ...withLink, trap: { ...withLink.trap, ask: "" } })).toBe(false);
  });
});
