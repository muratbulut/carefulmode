// "Açık oturumların" listesi için tarayıcı kimliğinden kısa bir cihaz adı çıkarır
// ("Telefon · Safari, iOS"). Kesin değildir; yalnızca kullanıcının cihazını tanıması için.

export type DeviceKind = "desktop" | "phone" | "tablet";

export type Device = { kind: DeviceKind; browser: string | null; os: string | null };

const browsers: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/YaBrowser\//, "Yandex"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const systems: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(ua: string | null | undefined): Device {
  if (!ua) return { kind: "desktop", browser: null, os: null };
  const browser = browsers.find(([re]) => re.test(ua))?.[1] ?? null;
  const os = systems.find(([re]) => re.test(ua))?.[1] ?? null;
  const kind: DeviceKind = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? "tablet"
    : /Mobile|iPhone|iPod/.test(ua)
      ? "phone"
      : "desktop";
  return { kind, browser, os };
}
