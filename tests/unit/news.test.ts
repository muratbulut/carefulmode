import { describe, expect, it } from "vitest";
import {
  articleContentSchema,
  articleDraftContentSchema,
  articleState,
  checkSourceUrl,
  emptyContent,
  fridayPublishTime,
  isDraftSlug,
  isGovernmentHost,
  isTrustedHost,
  liveWhere,
  normalizeContent,
  parseArticleContent,
  readiness,
  readingMinutes,
  sourceParts,
  turkeyDateKey,
  upcomingFridays,
  weekKeyOf,
  type ArticleContent,
  type ArticleDraft,
} from "@/lib/news/content";

/** Yayına hazır bir haberin içeriği (tahtadaki "Sahte kargo SMS'leri" örneği gibi). */
function readyContent(): ArticleContent {
  return {
    whatsHappening:
      "Son haftalarda kargo teslim edilemedi diye başlayan kısa mesajlar yine çoğaldı. Mesajdaki link sahte bir sayfaya gidiyor ve kart bilgisi istiyor.",
    example: { sender: "0532 xxx xx xx", text: "Paketiniz teslim edilemedi: kargo-teslimat-tr.xyz" },
    signs: [
      { sign: "Gönderen kişisel bir numara.", explanation: "Kargo firmaları kendi adıyla yazar." },
      { sign: "Acele ettiriyor.", explanation: "Süre baskısı düşünmeden tıklaman için." },
      { sign: "Link firmanın adresi değil.", explanation: "Adresi baştan sona oku." },
    ],
    actions: ["Takibi firmanın kendi uygulamasından yap.", "SMS'teki linke dokunma."],
    takeaways: ["Teslim edilemedi diyen SMS sahte olabilir.", "Gönderen numaraya ve adrese bak.", "Takibi uygulamadan yap."],
  };
}

function readyDraft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  return {
    title: "Sahte kargo SMS'leri yine arttı",
    summary: "Paketiniz teslim edilemedi diyen mesajlardaki linkler sahte sitelere gidiyor.",
    content: readyContent(),
    neighborhoodId: "oltalama",
    relatedLabId: "lab-1",
    sourceName: "USOM duyuruları",
    sourceUrl: "https://www.usom.gov.tr/duyurular",
    week: "2026-10-16",
    ...overrides,
  };
}

describe("güvenilir kaynak", () => {
  it("listedeki alan adını ve alt alan adlarını kabul eder", () => {
    for (const url of [
      "https://www.usom.gov.tr/duyurular",
      "https://usom.gov.tr",
      "https://www.egm.gov.tr/siber?x=1#a",
      "https://www.bleepingcomputer.com/news/security/x/",
      "https://thehackernews.com/2026/10/a.html",
      "https://www.welivesecurity.com/tr/",
      "https://www.kaspersky.com.tr/blog",
      "https://kaspersky.com/blog",
      "https://www.ncsc.gov.uk/guidance",
      "https://www.cisa.gov/news",
      "HTTPS://WWW.USOM.GOV.TR/Duyurular",
    ]) {
      expect(checkSourceUrl(url).ok, url).toBe(true);
    }
  });

  it("benzer görünen (look-alike) alan adlarını reddeder", () => {
    for (const url of [
      "https://gov.tr.evil.com/x",
      "https://bleepingcomputer.com.evil.io/news",
      "https://evilgov.tr/",
      "https://notbleepingcomputer.com/",
      "https://kaspersky.com.evil.tr/",
      "https://ncsc.gov.uk.example.org/",
      "https://cisa.gov.attacker.net/",
      "https://usom-gov.tr/",
      "https://bleeping-computer.com/",
      // Kiril "о" ile yazılmış benzer ad (tarayıcı punycode'a çevirir)
      "https://bleepingc\u043emputer.com/",
    ]) {
      const check = checkSourceUrl(url);
      expect(check.ok, url).toBe(false);
      if (!check.ok) expect(check.problem, url).toBe("untrusted");
    }
  });

  it("kullanıcı adı ve @ hilesini reddeder", () => {
    for (const url of ["https://gov.tr@evil.com/", "https://www.usom.gov.tr:pass@evil.com/", "https://user@www.usom.gov.tr/"]) {
      const check = checkSourceUrl(url);
      expect(check.ok, url).toBe(false);
    }
    const trick = checkSourceUrl("https://gov.tr@evil.com/");
    expect(trick.ok ? null : trick.problem).toBe("credentials");
  });

  it("https olmayan, bozuk ya da ters bölülü adresi reddeder", () => {
    expect(checkSourceUrl("")).toEqual({ ok: false, problem: "empty", host: null });
    expect(checkSourceUrl("   ")).toMatchObject({ ok: false, problem: "empty" });
    expect(checkSourceUrl("http://www.usom.gov.tr/")).toMatchObject({ ok: false, problem: "notHttps" });
    expect(checkSourceUrl("www.usom.gov.tr/duyurular")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("javascript:alert(1)")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("ftp://www.usom.gov.tr/")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("https://evil.com\\@www.usom.gov.tr/")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("https://www.usom.gov.tr/a b")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("https://www..gov.tr/")).toMatchObject({ ok: false, problem: "invalid" });
    expect(checkSourceUrl("https://www.usom.gov.tr:8443/")).toMatchObject({ ok: false, problem: "untrusted" });
    expect(checkSourceUrl("http://siber-haberleri.blogspot.com/okul-anket")).toMatchObject({ ok: false, problem: "notHttps" });
  });

  it("alan adı karşılaştırması tam etiket üzerinden yapılır", () => {
    expect(isTrustedHost("gov.tr")).toBe(true);
    expect(isTrustedHost("meb.gov.tr.")).toBe(true);
    expect(isTrustedHost("xgov.tr")).toBe(false);
    expect(isTrustedHost("gov.tr.com")).toBe(false);
    expect(isGovernmentHost("www.usom.gov.tr")).toBe(true);
    expect(isGovernmentHost("www.ncsc.gov.uk")).toBe(false);
  });

  it("pencerede adres üç parça gösterilir; güvenilmeyen adres hiç çizilmez", () => {
    expect(sourceParts("https://www.usom.gov.tr/duyurular?a=1")).toEqual({ scheme: "https://", host: "www.usom.gov.tr", rest: "/duyurular?a=1" });
    expect(sourceParts("https://gov.tr.evil.com/")).toBeNull();
  });
});

describe("haber içeriği", () => {
  it("taslak şeması boş alanlara izin verir ama biçimi ve sınırları korur", () => {
    expect(articleDraftContentSchema.safeParse(emptyContent()).success).toBe(true);
    const tooManySigns = { ...emptyContent(), signs: [...emptyContent().signs, { sign: "", explanation: "" }] };
    expect(articleDraftContentSchema.safeParse(tooManySigns).success).toBe(false);
    const longTitle = { ...emptyContent(), whatsHappening: "a".repeat(2001) };
    expect(articleDraftContentSchema.safeParse(longTitle).success).toBe(false);
    const manyActions = { ...emptyContent(), actions: Array.from({ length: 9 }, () => "madde") };
    expect(articleDraftContentSchema.safeParse(manyActions).success).toBe(false);
  });

  it("yayın şeması bütün bölümleri ister, örnek mesaj isteğe bağlı", () => {
    expect(articleContentSchema.safeParse(readyContent()).success).toBe(true);
    expect(articleContentSchema.safeParse({ ...readyContent(), example: null }).success).toBe(true);
    expect(articleContentSchema.safeParse(emptyContent()).success).toBe(false);
  });

  it("bozuk içerik hata atmadan okunur; işaret ve kısaca hep 3 tane", () => {
    const parsed = parseArticleContent({ whatsHappening: 5, signs: [{ sign: "a" }], takeaways: ["x", "y", "z", "fazla"], actions: ["", "  ", "bir"], example: { sender: "", text: " " } });
    expect(parsed.whatsHappening).toBe("");
    expect(parsed.signs).toHaveLength(3);
    expect(parsed.signs[0]).toEqual({ sign: "a", explanation: "" });
    expect(parsed.takeaways).toEqual(["x", "y", "z"]);
    expect(parsed.actions).toEqual(["bir"]);
    expect(parsed.example).toBeNull();
    expect(parseArticleContent(null)).toEqual(emptyContent());
    expect(parseArticleContent("<script>")).toEqual(emptyContent());
  });

  it("kaydedilirken boşluklar kırpılır, boş örnek mesaj kalkar", () => {
    const normalized = normalizeContent({ ...readyContent(), example: { sender: " ", text: "" }, actions: [" a ", "", "b"] });
    expect(normalized.example).toBeNull();
    expect(normalized.actions).toEqual(["a", "b"]);
  });

  it("okuma süresi en az 1 dakika", () => {
    expect(readingMinutes(emptyContent())).toBe(1);
    expect(readingMinutes({ ...emptyContent(), whatsHappening: Array.from({ length: 600 }, () => "kelime").join(" ") })).toBe(6);
  });
});

describe("Yayına hazır mı?", () => {
  it("hazır taslak planlanabilir; lab önerilir, planlamayı engellemez", () => {
    const ready = readiness(readyDraft());
    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);
    expect(ready.done).toBe(ready.total);
    const noLab = readiness(readyDraft({ relatedLabId: null }));
    expect(noLab.ready).toBe(true);
    expect(noLab.items.find((i) => i.key === "lab")).toMatchObject({ ok: false, required: false });
  });

  it("yayın haftası seçilmeden planlanamaz ama içerik hazır sayılır", () => {
    const check = readiness(readyDraft({ week: null }));
    expect(check.contentReady).toBe(true);
    expect(check.ready).toBe(false);
    expect(readiness(readyDraft({ week: "2026-10-15" })).ready).toBe(false);
  });

  it("güvenilir listede olmayan kaynak planlamayı engeller", () => {
    const check = readiness(readyDraft({ sourceUrl: "http://siber-haberleri.blogspot.com/okul-anket" }));
    expect(check.ready).toBe(false);
    expect(check.missing).toEqual(["trustedSource"]);
    const lookAlike = readiness(readyDraft({ sourceUrl: "https://gov.tr.evil.com/duyuru" }));
    expect(lookAlike.missing).toEqual(["trustedSource"]);
    const noName = readiness(readyDraft({ sourceName: " " }));
    expect(noName.missing).toEqual(["source"]);
  });

  it("eksikler sırayla listelenir", () => {
    const check = readiness({ ...readyDraft(), title: "Kısa", content: emptyContent(), neighborhoodId: null, relatedLabId: null, sourceName: "", sourceUrl: "", week: null });
    expect(check.missing).toEqual(["titleSummary", "whatsHappening", "signs", "actions", "takeaways", "topic", "source", "trustedSource"]);
    expect(check.contentReady).toBe(false);
  });

  it("başlık 70, özet 180 karakteri aşarsa hazır değil", () => {
    expect(readiness(readyDraft({ title: "a".repeat(71) })).missing).toContain("titleSummary");
    expect(readiness(readyDraft({ summary: "a".repeat(181) })).missing).toContain("titleSummary");
    expect(readiness(readyDraft({ content: { ...readyContent(), actions: ["tek madde"] } })).missing).toEqual(["actions"]);
  });
});

describe("yayın haftası", () => {
  it("Cuma 08.00 Türkiye saati = 05.00 UTC; Cuma olmayan gün geçersiz", () => {
    expect(fridayPublishTime("2026-10-16")?.toISOString()).toBe("2026-10-16T05:00:00.000Z");
    expect(fridayPublishTime("2026-10-15")).toBeNull();
    expect(fridayPublishTime("2026-02-30")).toBeNull();
    expect(fridayPublishTime("16.10.2026")).toBeNull();
  });

  it("önümüzdeki Cumalar yayın anı geçmemiş olanlardan başlar", () => {
    // Pazar
    expect(upcomingFridays(new Date("2026-10-11T12:00:00Z"), 3)).toEqual(["2026-10-16", "2026-10-23", "2026-10-30"]);
    // Cuma 07.59 (Türkiye): o günün yayını henüz olmadı
    expect(upcomingFridays(new Date("2026-10-16T04:59:00Z"), 1)).toEqual(["2026-10-16"]);
    // Cuma 08.00: sıradaki Cuma
    expect(upcomingFridays(new Date("2026-10-16T05:00:00Z"), 1)).toEqual(["2026-10-23"]);
    // Perşembe 23.30 UTC = Cuma 02.30 Türkiye
    expect(upcomingFridays(new Date("2026-10-15T23:30:00Z"), 1)).toEqual(["2026-10-16"]);
    expect(upcomingFridays(new Date("2026-10-11T12:00:00Z"))).toHaveLength(8);
  });

  it("Türkiye takvim günü ve hafta anahtarı", () => {
    expect(turkeyDateKey(new Date("2026-10-15T21:30:00Z"))).toBe("2026-10-16");
    expect(weekKeyOf(new Date("2026-10-16T05:00:00Z"))).toBe("2026-10-16");
  });

  it("planlı haber yayın anı gelince kendiliğinden yayındadır", () => {
    const at = new Date("2026-10-16T05:00:00Z");
    expect(articleState({ status: "SCHEDULED", publishedAt: at }, new Date("2026-10-16T04:59:59Z"))).toBe("scheduled");
    expect(articleState({ status: "SCHEDULED", publishedAt: at }, at)).toBe("live");
    expect(articleState({ status: "PUBLISHED", publishedAt: at }, new Date("2026-11-01T00:00:00Z"))).toBe("live");
    expect(articleState({ status: "DRAFT", publishedAt: null }, at)).toBe("draft");
    expect(articleState({ status: "DRAFT", publishedAt: at }, new Date("2026-11-01T00:00:00Z"))).toBe("draft");
    expect(liveWhere(at)).toEqual({ status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt: { lte: at } });
  });

  it("taslağın geçici adresi gerçek bir adresle karışmaz", () => {
    expect(isDraftSlug("_taslak-abc")).toBe(true);
    expect(isDraftSlug("sahte-kargo-smsleri")).toBe(false);
  });
});
