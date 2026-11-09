import { describe, expect, it } from "vitest";
import { errorCode } from "@/lib/errors";

describe("hata kodu", () => {
  it("hata kimliğini 4-4 büyük harfli koda çevirir", () => {
    expect(errorCode("7f3a21c9e0")).toBe("7F3A-21C9");
    expect(errorCode("2174186599")).toBe("2174-1865");
  });

  it("kimlik yoksa ya da çok kısaysa kod yok (null)", () => {
    expect(errorCode(undefined)).toBeNull();
    expect(errorCode("abc")).toBeNull();
  });
});
