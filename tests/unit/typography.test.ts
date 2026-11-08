import { describe, expect, it } from "vitest";
import { smartQuotes } from "@/lib/typography";

describe("başlıkta Türkçe tırnak", () => {
  it("düz tırnak çiftini açılış ve kapanış tırnağına çevirir", () => {
    expect(smartQuotes('"Hediye kazandın" mesajı')).toBe("“Hediye kazandın” mesajı");
    expect(smartQuotes('"a" ve "b"')).toBe("“a” ve “b”");
  });

  it("tırnaksız metne dokunmaz", () => {
    expect(smartQuotes("Sahte kargo maili")).toBe("Sahte kargo maili");
  });
});
