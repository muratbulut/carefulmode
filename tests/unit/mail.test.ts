// Mail gönderimi: canlı taşıyıcı (Resend) teslim edilemeyecek adreslere (.invalid; örnek veri
// hesapları) hiç göndermez, diğer adreslere gönderir.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn(async () => ({ data: { id: "x" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { isUndeliverable, sendMail } = await import("@/lib/mail");

const message = (to: string) => ({ to, subject: "Konu", html: "<p>Metin</p>", text: "Metin" });

describe("isUndeliverable", () => {
  it(".invalid alan adlarını tanır, gerçek adresleri değil", () => {
    expect(isUndeliverable("ogrenci@ornek.invalid")).toBe(true);
    expect(isUndeliverable("Biri@Okul.ORNEK.INVALID ")).toBe(true);
    expect(isUndeliverable("x@invalid")).toBe(true);
    expect(isUndeliverable("murat@example.com")).toBe(false);
    expect(isUndeliverable("x@invalid.com")).toBe(false);
    expect(isUndeliverable("x@notinvalid")).toBe(false);
  });
});

describe("sendMail (Resend)", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    send.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("örnek hesaba (.invalid) göndermez, hata da vermez", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendMail(message("ogretmen@ornek.invalid"))).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("diğer adreslere gönderir", async () => {
    await sendMail(message("murat@example.com"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]).toMatchObject([{ to: "murat@example.com" }]);
  });
});
