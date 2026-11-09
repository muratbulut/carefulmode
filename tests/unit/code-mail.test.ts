import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand";
import { codeMail } from "@/lib/mail/code-mail";

// Üst şeritteki logo resmi (lib/mail/logo.ts) maildeki tek <img> olabilir; gerisi kaçışlı metin olmalı.
const withoutMailLogo = (html: string) => html.replace(/<img src="[^"]*\/mail\/logo\.png"[^>]*>/, "");

const base = { to: "ayse@ornek.com", code: "482913", minutes: 10, siteUrl: "https://ornek.com" };

describe("kod maili", () => {
  it("konu amaca göre değişir, kod düz metinde 3+3 gruplanır", () => {
    const mail = codeMail({ ...base, purpose: "verify", name: "Ayşe" });
    expect(mail.to).toBe("ayse@ornek.com");
    expect(mail.subject).toBe(`${brand.name} doğrulama kodun`);
    expect(mail.text).toContain("Merhaba Ayşe,");
    expect(mail.text).toContain("    482 913");
    expect(mail.text).toContain("10 dakika geçerli");
    expect(mail.text).toContain("https://ornek.com/kvkk");
    expect(codeMail({ ...base, purpose: "reset" }).subject).toBe(`${brand.name} şifre sıfırlama kodun`);
  });

  it("HTML'de her rakam ayrı kutuda, mailde tıklanacak bağlantı yalnızca KVKK metni", () => {
    const { html } = codeMail({ ...base, purpose: "verify" });
    for (const digit of base.code) expect(html).toContain(`>${digit}</div>`);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://ornek.com/kvkk"');
  });

  it("görünen ad HTML olarak işlenmez", () => {
    const { html } = codeMail({ ...base, purpose: "verify", name: '<img src=x onerror="a()">' });
    expect(withoutMailLogo(html)).not.toContain("<img");
    expect(html).toContain("&#60;img src=x onerror=&#34;a()&#34;&#62;");
  });

  it("ad yoksa genel selam", () => {
    expect(codeMail({ ...base, purpose: "verify", name: null }).text.startsWith("Merhaba,")).toBe(true);
  });
});
