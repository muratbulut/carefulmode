// Zod'un projedeki tek giriş kapısı: kod "zod" yerine buradan alır (ESLint no-restricted-imports).
//
// Zod 4 nesne şemalarını hızlandırmak için şema kurulurken `new Function("")` dener. İçerik
// Güvenliği Politikası 'unsafe-eval' vermediği için (next.config.ts) tarayıcı bunu engeller ve
// her sayfada bir CSP ihlali yazar; Zod sonra yavaş yola düşer ama ihlal kalır (tests/e2e/csp.spec.ts
// bunu yakalar). Tarayıcıda denemeyi baştan kapatıyoruz. Sunucuda CSP yok; hızlı yol açık kalır.
// Bu dosya, şema tanımlayan her modülden önce çalışır (ES modül sırası), ayar ilk şemadan önce gelir.

import { config } from "zod";

if (typeof window !== "undefined") config({ jitless: true });

export * from "zod";
