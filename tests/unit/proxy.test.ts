import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "https://bitirme.example"), cookie ? { headers: { cookie } } : undefined);

describe("proxy: durum ekranları önizlemesi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("PREVIEW_PAGE yoksa (canlı) /onizleme var olmayan bir adrese yeniden yazılır: 404", () => {
    vi.stubEnv("PREVIEW_PAGE", "");
    const res = proxy(request("/onizleme"));
    expect(res.headers.get("x-middleware-rewrite")).toBe("https://bitirme.example/onizleme-kapali");
  });

  it("PREVIEW_PAGE=1 olan sunucuda (geliştirme, uçtan uca testler) açılır ve giriş istemez", () => {
    vi.stubEnv("PREVIEW_PAGE", "1");
    const res = proxy(request("/onizleme"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("eşleyicide /onizleme var; giriş isteyen adresler hâlâ girişe yönlenir", () => {
    expect(config.matcher).toContain("/onizleme");
    const res = proxy(request("/profil"));
    expect(res.headers.get("location")).toBe("https://bitirme.example/giris?sonra=%2Fprofil");
  });
});
