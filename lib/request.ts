// İstek sınırlarının ziyaretçi anahtarı. Sunucuda nginx, diğer kurulumlarda Caddy
// X-Forwarded-For'u ziyaretçinin adresiyle yazar; ilk değer ziyaretçidir.
//
// IPv6'da bir ev, bir telefon ya da kiralık bir sunucu bütün bir /64 ağı alır ve içindeki
// adresleri istediği gibi değiştirebilir (2^64 adres). Anahtar adres olsaydı her istek yeni bir
// adresten gelip IP sınırlarını ve gündemdeki "aynı IP'den günde bir okuma" kuralını aşardı.
// Bu yüzden IPv6'da anahtar /64 ağıdır; IPv4'te adresin kendisi (okul ağı zaten tek IP'dir).

/** Sayaç anahtarı: IPv4 adresi ya da IPv6 /64 ağı ("2001:db8:1:2::/64"). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ipNetwork(forwarded || headers.get("x-real-ip") || "unknown");
}

const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** IPv6 adresinin 8 grubu; okunamazsa null. Sondaki IPv4 yazımı (::ffff:1.2.3.4) da okunur. */
function ipv6Groups(address: string): number[] | null {
  let value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);
  const embedded = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (embedded) {
    const bytes = embedded.slice(1).map(Number);
    if (bytes.some((b) => b > 255)) return null;
    value = `${value.slice(0, embedded.index)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === "" ? [] : part.split(":"));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (![...head, ...tail].every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...head, ...Array.from({ length: missing }, () => "0"), ...tail].map((g) => Number.parseInt(g, 16));
}

/**
 * Adresin sayaç anahtarı: IPv4 olduğu gibi; IPv6'nın ilk 64 biti; IPv6 içinde yazılmış IPv4
 * (::ffff:203.0.113.7) IPv4 sayılır. Okunamayan değer olduğu gibi kalır (yalnızca anahtardır).
 */
export function ipNetwork(address: string): string {
  const value = address.trim();
  const v4 = ipv4.exec(value);
  if (v4) return v4.slice(1).every((b) => Number(b) <= 255) ? v4.slice(1).map(Number).join(".") : value;
  if (!value.includes(":")) return value;
  const groups = ipv6Groups(value);
  if (!groups) return value;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}
