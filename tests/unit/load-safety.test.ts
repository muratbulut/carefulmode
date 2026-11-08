// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluatePassword } from "@/lib/password-strength";
import { checkLocalDatabase, newLoadPassword } from "../load/safety";

// Yük testi hazırlığı (tests/load/prepare.ts) yönetici dahil hesap açar ve oturum yazar; yalnızca
// bu makinedeki veritabanında çalışmalı. Eski denetim yalnızca URL'deki ana makine adına bakıyordu:
// "?host=" sürücünün bağlanacağı yeri değiştirirken denetimden geçiyordu, sunucudaki yığının
// ağında "db" (canlı veritabanı) da kabul ediliyordu. Hesapların şifresi de depoda sabitti
// (güvenlik turu 5).

const reject = (url: string | undefined) => {
  const check = checkLocalDatabase(url);
  expect(check.ok, url).toBe(false);
};

describe("yük testi: yalnızca bu makinedeki veritabanı", () => {
  it.each([
    ["postgresql://u:gizli@localhost:5432/cg?schema=public", "localhost:5432/cg"],
    ["postgresql://u:gizli@127.0.0.1:15205/cyberguard?schema=public", "127.0.0.1:15205/cyberguard"],
    ["postgresql://u:gizli@[::1]:5433/cg", "::1:5433/cg"],
    ["postgresql://u:gizli@localhost/cg?host=127.0.0.1", "127.0.0.1:5432/cg"],
  ])("kabul: %s", (url, where) => {
    expect(checkLocalDatabase(url)).toEqual({ ok: true, where });
  });

  it("dönen adreste şifre yok", () => {
    const check = checkLocalDatabase("postgresql://u:gizli-sifre@localhost:5432/cg");
    expect(JSON.stringify(check)).not.toContain("gizli-sifre");
  });

  it.each([
    // Sürücü (pg-connection-string) "host" parametresini URL'deki adın yerine kullanır.
    "postgresql://u:p@localhost:5432/cg?host=canli.example.com",
    "postgresql://u:p@localhost:5432/cg?host=127.0.0.1&host=canli.example.com",
    "postgresql://u:p@localhost:5432/cg?h%6Fst=canli.example.com",
    "postgresql://u:p@localhost:5432/cg?schema=public&host=10.0.0.5",
  ])("ret: ?host= sürücünün adresini değiştirir (%s)", reject);

  it.each([
    // Sunucuda yığının ağında "db" canlı veritabanıdır.
    "postgresql://u:p@db:5432/cyberguard",
    "postgresql://u:p@canli.example.com:5432/cg",
    "postgresql://u:p@127.0.0.1.example.com/cg",
    "postgresql://localhost@canli.example.com/cg",
    "postgresql://u:p@localhost,canli.example.com/cg",
    "socket:/var/run/postgresql?db=cg",
    "/var/run/postgresql cg",
    "postgresql://u:p@/cg?host=/var/run/postgresql",
    "postgresql:///cg",
    "bozuk adres",
    "",
    undefined,
  ])("ret: %s", reject);
});

describe("yük testi: hesap şifresi", () => {
  it("her koşuda yeni ve kayıt kuralını geçen bir şifre", () => {
    const first = newLoadPassword();
    const second = newLoadPassword();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(24);
    expect(evaluatePassword(first).accepted).toBe(true);
  });

  it("prepare.ts depoda sabit bir şifre tutmaz", () => {
    const source = readFileSync("tests/load/prepare.ts", "utf8");
    expect(source).toMatch(/const password = newLoadPassword\(\);/);
    expect(source).not.toMatch(/password\s*[:=]\s*["'`]/);
  });
});
