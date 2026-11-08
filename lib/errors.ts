/** Hata kimliğini destek için okunur kısa koda çevirir: "7F3A-21C9". Kimlik yoksa null. */
export function errorCode(digest: string | undefined): string | null {
  const clean = (digest ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();
  if (clean.length < 8) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}
