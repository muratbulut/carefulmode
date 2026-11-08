import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Arayüz metni bileşene yazılmaz, sözlükten okunur (lib/i18n). JSX içindeki düz metni yakalar;
  // niteliklerdeki ve koddaki metinleri tests/unit/i18n.test.ts yakalar.
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: ["404", "·", "!"] }],
    },
  },
  // Zod yalnızca lib/zod.ts'ten alınır: orada tarayıcı için CSP'ye uygun ayar yapılır (eval yok).
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["lib/zod.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "zod", message: 'Zod\'u "@/lib/zod"tan al (CSP ayarı orada).' }],
          patterns: [{ group: ["zod/*"], message: 'Zod\'u "@/lib/zod"tan al (CSP ayarı orada).' }],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma'nın ürettiği istemci ve test çıktıları
    "lib/generated/**",
    "playwright-report/**",
    "test-results/**",
    // Claude Code'un yereldeki ayrı çalışma kopyaları (git'e girmez)
    ".claude/**",
  ]),
]);

export default eslintConfig;
