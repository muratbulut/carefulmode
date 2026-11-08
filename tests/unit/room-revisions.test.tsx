import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AheadBox, LockedLearn } from "@/components/lab/detail/DetailParts";
import type { LabDetailData } from "@/components/lab/detail/types";
import { StartDialog } from "@/components/lab/frame/StartDialog";
import { difficultyTone, durationTone } from "@/components/lab/LabTags";
import { ReportSteps } from "@/components/lab/report/ReportSteps";
import { amountValue, sceneFor } from "@/lib/lab/story";
import { tipKind } from "@/lib/lab/tip-kind";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("hacklendin sonrası sahne (19 ve 22. revize)", () => {
  it("tutar yazılırsa (4.000 TL) sayıya çevrilir, yoksa 0", () => {
    expect(amountValue("4.000 TL")).toBe(4000);
    expect(amountValue("1.250,50 TL")).toBe(1251);
    expect(amountValue("")).toBe(0);
  });

  it("odanın seçtiği sahne geçerli; seçilmediyse tuzağın türünden gelir", () => {
    expect(sceneFor("home", "account", "link", "")).toBe("home");
    expect(sceneFor("", "account", "link", "")).toBe("account");
    expect(sceneFor("", "financial", "code", "")).toBe("card");
    expect(sceneFor("", "data_leak", "reply", "")).toBe("home");
    expect(sceneFor("", "account", "request", "4.000 TL")).toBe("money");
  });

  it("tutarı olmayan odada bakiye sahnesi açılmaz, harcama bildirimleri gelir", () => {
    expect(sceneFor("money", "financial", "link", "")).toBe("card");
    expect(sceneFor("", "account", "request", "")).toBe("card");
  });
});

describe("rapor: Bir dahaki sefere (14. revize)", () => {
  it("ipucunun başlığı anahtar kelimeden seçilir", () => {
    expect(tipKind("Şüpheli maili silme, bildir.")).toBe("report");
    expect(tipKind("SMS'teki kodu kimseye söyleme.")).toBe("code");
    expect(tipKind("Gönderenin adresine bak.")).toBe("address");
    expect(tipKind("Siteyi kendin yazarak aç.")).toBe("self");
    expect(tipKind("Acele ettiren mesajda dur.")).toBe("hurry");
    expect(tipKind("Kart bilgisi isteyen yere dikkat.")).toBe("card");
    expect(tipKind("Şifreni sık değiştir.")).toBe("tip");
  });

  it("Odada ne oldu: doğru olmayan kararın Doğrusu ve Neden'i kendiliğinden açık, doğru kararınki yok", () => {
    render(
      <ReportSteps
        rows={[
          { key: "a", kind: "fake", title: "Kargo maili", tag: "SAHTE", state: "bad", points: 0, max: 30, did: "Bağlantıya tıkladın.", right: "Bildir ve sil.", why: "Adres tutmuyordu." },
          { key: "b", kind: "real", title: "Okul maili", tag: "GERÇEK", state: "ok", points: 20, max: 20, did: "Okudun.", right: "Oku.", why: "Gerçekti." },
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAttribute("data-state", "bad");
    expect(rows[0]).toHaveTextContent("Bildir ve sil.");
    expect(rows[0]).toHaveTextContent("Adres tutmuyordu.");
    expect(rows[1]).not.toHaveTextContent("Gerçekti.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("perde (18. revize)", () => {
  it("perde odanın adını harf harf yazar, sonra Başlamadan önce kutusu gelir", () => {
    vi.useFakeTimers();
    stubMotion(false);
    render(<StartDialog name="Kulaklık" template="INBOX" starting={false} onStart={() => {}} />);
    expect(screen.getByTestId("start-curtain")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => void vi.advanceTimersByTime(500 + 3 * 60));
    expect(screen.getByTestId("start-curtain")).toHaveTextContent("Kul");
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.queryByTestId("start-curtain")).toBeNull();
    expect(screen.getByRole("dialog")).toHaveTextContent("BAŞLAMADAN ÖNCE");
  });

  it('"Hareketi azalt" açıksa perde yok, kutu hemen gelir', () => {
    vi.useFakeTimers();
    stubMotion(true);
    render(<StartDialog name="Kulaklık" template="INBOX" starting={false} onStart={() => {}} />);
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("start-curtain")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("oda kapağı (8. revize D) ve etiketler (15. revize A)", () => {
  const data = {
    template: "INBOX",
    ahead: { caller: "Annem", items: 4, deal: { kind: "shop", name: "TeknoPazar", owner: "Annenin" }, tasks: 5 },
  } as unknown as LabDetailData;

  it("Seni neler bekliyor: arayan, mail sayısı, mağaza ve görev sayısı", () => {
    render(<AheadBox data={data} />);
    const box = screen.getByTestId("detail-ahead");
    expect(box).toHaveTextContent("Annem arayacak");
    expect(box).toHaveTextContent("Postam'da 4 mail");
    expect(box).toHaveTextContent("TeknoPazar");
    expect(box).toHaveTextContent("Annenin kartıyla ödeme yapacaksın");
    expect(box).toHaveTextContent("100 puan, 5 görev");
  });

  it("görevsiz odada arayan ve mağaza satırı yok", () => {
    render(<AheadBox data={{ ...data, template: "MESSAGING", ahead: { caller: null, items: 3, deal: null, tasks: 0 } }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("detail-ahead")).toHaveTextContent("Mesajlar'da 3 mesaj");
  });

  it("dersler oda bitene kadar kilitli: başlık yok, yalnızca kaç ders olduğu", () => {
    render(<LockedLearn count={3} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("3. ders · odayı bitirince açılır");
  });

  it("süre 6 dk ve altı yeşil, 7-10 sarı, 11 ve üstü kırmızı; zorluk da aynı renklerde", () => {
    expect([5, 6, 7, 10, 11, 15].map(durationTone)).toEqual(["good", "good", "mid", "mid", "hard", "hard"]);
    expect(difficultyTone).toEqual({ EASY: "good", MEDIUM: "mid", HARD: "hard" });
  });
});
