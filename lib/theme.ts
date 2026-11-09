// Tema tercihi: koyu ("dark", varsayılan) ve gri ("gray"). Tercih "theme" çerezinde durur.
// Çerez "gerekli / tercih" sınıfındadır, onay bandını beklemez (Bölüm 8).
// Sayfanın kendisi statik kalır; <head> içindeki küçük betik çerezi okuyup
// ilk boyamadan önce <html data-theme> değerini koyar, böylece tema yanıp sönmez.

export const THEMES = ["dark", "gray"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const THEME_COLOR: Record<Theme, string> = {
  dark: "#0B1020",
  gray: "#DDE1E8",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "gray" : "dark";
}

/** document.cookie metninden tema tercihini okur; yoksa ya da bozuksa null döner. */
export function themeFromCookie(cookies: string): Theme | null {
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isTheme(value) ? value : null;
}

export function themeCookie(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** <head> içinde, ilk boyamadan önce çalışan betik. Yalnızca bilinen değerleri kabul eder. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(dark|gray)(?:;|$)/);if(m){document.documentElement.setAttribute("data-theme",m[1]);var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute("content",m[1]==="gray"?"${THEME_COLOR.gray}":"${THEME_COLOR.dark}")}}catch(e){}})()`;
