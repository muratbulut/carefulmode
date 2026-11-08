import { describe, expect, it, vi } from "vitest";
import * as z from "@/lib/zod";

// Güvenlik turu 5 (Faz 6): CSP 'unsafe-eval' vermez. Zod 4 tarayıcıda şema kurulurken
// `new Function` denemesin, yoksa her sayfa bir CSP ihlali yazar (tests/e2e/csp.spec.ts).
describe("Zod ve İçerik Güvenliği Politikası", () => {
  it("tarayıcıda (window varken) Zod eval denemez", () => {
    expect(typeof window).toBe("object");
    expect(z.config().jitless).toBe(true);
  });

  it("nesne şeması kurulup çalışırken Function çağrılmaz", () => {
    const spy = vi.spyOn(globalThis, "Function");
    const schema = z.strictObject({ name: z.string().min(1), age: z.number().int() });
    expect(schema.parse({ name: "Ayşe", age: 13 })).toEqual({ name: "Ayşe", age: 13 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
