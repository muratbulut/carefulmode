import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/faq/Accordion";
import { answerLinks } from "@/components/faq/answer";
import { FaqExplorer, searchFaq } from "@/components/faq/FaqExplorer";
import {
  defaultFaqTopic,
  faqHref,
  faqQuestions,
  faqTopics,
  parseFaqTopic,
  questionBySlug,
  questionsOf,
  topicParams,
} from "@/components/faq/questions";
import { LessonTour, tourStepMs } from "@/components/teachers/LessonTour";
import { getMessages } from "@/lib/i18n";

const t = getMessages();

describe("SSS yapısı", () => {
  it("25 soru var, her biri sözlükte bir kez; bağlantı adları tekil ve ASCII", () => {
    const ids = faqQuestions.map((q) => q.id);
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
    expect([...ids].sort()).toEqual(Object.keys(t.faq.items).sort());
    const slugs = faqQuestions.map((q) => q.slug);
    expect(new Set(slugs).size).toBe(25);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(questionBySlug(slug)?.slug).toBe(slug);
    }
  });

  it("5 konu var, her konuda soru var; 6 soru YENİ işaretli", () => {
    expect(faqTopics).toEqual(["general", "rooms", "students", "teachers", "privacy"]);
    for (const topic of faqTopics) expect(questionsOf(topic).length, topic).toBeGreaterThan(0);
    expect(faqQuestions.filter((q) => q.isNew).map((q) => q.id)).toEqual(["locked", "caller", "report", "tip", "school", "parentHomework"]);
  });

  it("konu adreste Türkçe (ASCII) durur; eski ?ben= adresleri ilgili konuyu açar", () => {
    for (const topic of faqTopics) {
      expect(topicParams[topic]).toMatch(/^[a-z]+$/);
      const params = Object.fromEntries(new URLSearchParams(faqHref(topic).split("?")[1]));
      expect(parseFaqTopic(params)).toBe(topic);
    }
    expect(parseFaqTopic({ konu: ["odalar", "genel"] })).toBe("rooms");
    expect(parseFaqTopic({ ben: "ogretmen" })).toBe("teachers");
    expect(parseFaqTopic({ ben: "aile" })).toBe("privacy");
    expect(parseFaqTopic({ konu: "hacker" })).toBeNull();
    expect(parseFaqTopic({ ben: "constructor" })).toBeNull();
    expect(parseFaqTopic({})).toBeNull();
    expect(faqHref(null)).toBe("/sss");
  });

  it("giriş yapmış öğrenci Öğrenciler, öğretmen Öğretmenler konusuyla açar", () => {
    expect(defaultFaqTopic("STUDENT")).toBe("students");
    expect(defaultFaqTopic("TEACHER")).toBe("teachers");
    expect(defaultFaqTopic("ADMIN")).toBe("general");
    expect(defaultFaqTopic(undefined)).toBe("general");
  });

  it("cevaplardaki bağlantı etiketlerinin hepsi bir sayfaya gider, ürün adı metne gömülmez", () => {
    const texts = [
      ...Object.values(t.faq.items).flatMap((item) => [item.q, item.a]),
      ...t.teachersPage.faq.items.flatMap((item) => [item.q, item.a]),
      ...Object.values(t.faq.topics).map((topic) => topic.hint),
    ];
    for (const text of texts) {
      for (const [, tag] of text.matchAll(/<(\w+)>/g)) expect(Object.keys(answerLinks), text).toContain(tag);
      expect(text).not.toContain("Careful Mode");
      expect(text).not.toMatch(/siber güvenli/i);
    }
  });

  it("arama bütün konularda, Türkçe büyük-küçük harfe bakmadan arar; cevap metninde de bulur", () => {
    expect(searchFaq("  ")).toEqual([]);
    expect(searchFaq("KİLİTLİ").map((q) => q.id)).toContain("locked");
    // "rehber" yalnızca cevapta geçer.
    expect(searchFaq("rehber").map((q) => q.id)).toEqual(["caller"]);
    expect(searchFaq("zzzz")).toEqual([]);
  });

  it("iletişim adresi yasal metinlerle aynı yer tutucu", () => {
    expect(t.faq.contact.email).toBe("[İLETİŞİM E-POSTASI]");
  });
});

describe("akordeon", () => {
  it("soru düğmesi cevabı açar ve kapatır, aria-controls cevabı gösterir", async () => {
    render(
      <Accordion
        items={[
          { id: "a", question: "Soru A", answer: "Cevap A" },
          { id: "b", question: "Soru B", answer: "Cevap B" },
        ]}
      />,
    );
    const a = screen.getByRole("button", { name: "Soru A" });
    const b = screen.getByRole("button", { name: "Soru B" });
    expect(a).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(a.getAttribute("aria-controls")!);
    expect(panel).toHaveTextContent("Cevap A");
    // Kapalı cevap gizli (birim testinde CSS yok, sınıfına bakılır; JavaScript kapalıysa açılır).
    expect(panel).toHaveClass("hidden", "noscript:block");

    await userEvent.click(a);
    expect(a).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveClass("hidden");

    // Aynı anda bir cevap açık kalır.
    await userEvent.click(b);
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
  });
});

describe("SSS konuları", () => {
  beforeEach(() => window.history.replaceState(null, "", "/sss"));

  const questionCount = () => document.querySelectorAll("[data-faq-item]").length;
  const topicButton = (name: string) => within(screen.getByRole("navigation", { name: "Konular" })).getByRole("button", { name: new RegExp(`^${name}`) });

  it("açık konunun soruları görünür; konu değişince adres güncellenir", async () => {
    render(<FaqExplorer initialTopic="general" contact={null} />);
    expect(topicButton("Genel")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Genel");
    expect(questionCount()).toBe(6);

    await userEvent.click(topicButton("Odalar"));
    expect(window.location.search).toBe("?konu=odalar");
    expect(topicButton("Odalar")).toHaveAttribute("aria-pressed", "true");
    expect(topicButton("Genel")).toHaveAttribute("aria-pressed", "false");
    expect(questionCount()).toBe(6);
    expect(screen.getAllByText(t.faq.new)).toHaveLength(4);
  });

  it("arama bütün konulardan bulur, konuyu ve sayıyı yazar; temizleyince konuya döner", async () => {
    render(<FaqExplorer initialTopic="general" contact={null} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Soru ara" }), "ödev");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/“ödev” için \d+ soru/);
    expect(document.querySelector('[data-faq-item="homework"]')).not.toBeNull();
    expect(document.querySelector('[data-faq-item="parentHomework"]')).not.toBeNull();
    expect(topicButton("Genel")).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: t.faq.search.clear }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Genel");

    await userEvent.type(screen.getByRole("searchbox", { name: "Soru ara" }), "zzzz");
    expect(screen.getByText(t.faq.search.empty)).toBeInTheDocument();
  });

  it("aynı anda bir cevap açık; bağlantı kopyalama düğmesi yok", async () => {
    render(<FaqExplorer initialTopic="rooms" contact={null} />);
    const locked = screen.getByRole("button", { name: /Neden bazı odalar kilitli\?/ });
    const caller = screen.getByRole("button", { name: /Odada beni arayan kim\?/ });
    await userEvent.click(locked);
    expect(locked).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(caller);
    expect(locked).toHaveAttribute("aria-expanded", "false");
    expect(caller).toHaveAttribute("aria-expanded", "true");

    const panel = document.getElementById(caller.getAttribute("aria-controls")!)!;
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("sorunun bağlantısıyla gelince konusu ve cevabı açık gelir", () => {
    window.history.replaceState(null, "", "/sss#okulum");
    Element.prototype.scrollIntoView = vi.fn();
    render(<FaqExplorer initialTopic="general" contact={null} />);
    expect(topicButton("Öğretmenler")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Okulum sayfası ne işe yarar\?/ })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("İki ekran, bir ders", () => {
  let reduce = false;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reduce && query.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    // Bölüm ekranda sayılsın.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
        observe() {
          this.callback([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    reduce = false;
  });

  const pressed = () => screen.getAllByRole("button", { pressed: true });

  it("adımlar kendiliğinden ilerler, bir adıma dokununca durur", () => {
    render(<LessonTour />);
    const steps = within(screen.getByRole("group", { name: t.teachersPage.tour.steps })).getAllByRole("button");
    expect(steps[0]).toHaveAttribute("aria-pressed", "true");
    act(() => vi.advanceTimersByTime(tourStepMs));
    expect(steps[1]).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(steps[3]);
    expect(pressed()).toEqual([steps[3]]);
    expect(screen.getByRole("button", { name: t.teachersPage.tour.play })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(tourStepMs * 2));
    expect(steps[3]).toHaveAttribute("aria-pressed", "true");
  });

  it("Hareketi azalt açıksa kendiliğinden ilerlemez; önceki ve sonraki düğmeleri çalışır", () => {
    reduce = true;
    render(<LessonTour />);
    const steps = within(screen.getByRole("group", { name: t.teachersPage.tour.steps })).getAllByRole("button");
    act(() => vi.advanceTimersByTime(tourStepMs * 3));
    expect(steps[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(t.teachersPage.tour.leadStill)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t.teachersPage.tour.next }));
    expect(steps[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: t.teachersPage.tour.prev }));
    fireEvent.click(screen.getByRole("button", { name: t.teachersPage.tour.prev }));
    expect(steps[3]).toHaveAttribute("aria-pressed", "true");
  });
});
