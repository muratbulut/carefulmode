import { defineConfig, devices } from "@playwright/test";
import { mailOutboxDir } from "./tests/e2e/support/outbox-dir";

// Yerelde tarayıcı indirmeden çalışmak için: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium
// CI'da "npx playwright install --with-deps chromium" kurar, bu değişken boş kalır.
const chromiumPath = process.env.PW_CHROMIUM_PATH;
const port = Number(process.env.PORT ?? 3000);
// Canlı siteyi doğrulamak için: PW_BASE_URL=https://... (o zaman yerel sunucu açılmaz).
const liveUrl = process.env.PW_BASE_URL;
const baseURL = liveUrl ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI makinesi 2 çekirdek; Playwright kendiliğinden tek işçi açar ve her proje ~20 dakika sürer
  // (sınır 30). Testler paralel çalışmaya göre yazıldı (fullyParallel), iki işçi süreyi ve
  // Actions dakikasını kısaltır.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "tr-TR",
    trace: "retain-on-failure",
    // CI'da da tam Chromium (yeni başsız kip): "headless shell"in PDF görüntüleyicisi yok, belgenin
    // önizlemesi orada açılmaz, indirmeye döner. Yerelde PW_CHROMIUM_PATH de tam Chromium'u gösterir.
    channel: chromiumPath ? undefined : "chromium",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      // 390 px telefon (tasarımdaki ölçü), Chromium ile.
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  // Testler üretim derlemesine karşı çalışır: önce "npm run build".
  webServer: liveUrl
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Hesap testleri: kod mailleri dosyaya yazılır, testler kodu oradan okur (lib/mail).
        env: {
          BETTER_AUTH_URL: baseURL,
          BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-test-secret-0123456789abcdef0123456789abcdef",
          MAIL_OUTBOX_DIR: mailOutboxDir,
          // Durum ekranları önizlemesi (/onizleme) yalnızca bu değişkenle açılır; canlıda 404 (proxy.ts).
          PREVIEW_PAGE: "1",
        },
      },
});
