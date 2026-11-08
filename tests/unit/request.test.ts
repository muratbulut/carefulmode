import { describe, expect, it } from "vitest";
import { clientIp, ipNetwork } from "@/lib/request";

describe("istek sınırının ziyaretçi anahtarı (güvenlik turu 4)", () => {
  it("IPv4 adresi olduğu gibi kalır", () => {
    expect(ipNetwork("203.0.113.7")).toBe("203.0.113.7");
    expect(ipNetwork(" 10.0.0.1 ")).toBe("10.0.0.1");
  });

  it("IPv6'da anahtar /64 ağıdır: aynı ağdaki her adres aynı anahtarı alır", () => {
    const keys = ["2001:db8:a:b::1", "2001:db8:a:b::2", "2001:0db8:000a:000b:ffff:ffff:ffff:ffff", "2001:DB8:A:B:1:2:3:4", "[2001:db8:a:b::5]", "2001:db8:a:b::6%eth0"].map(
      ipNetwork,
    );
    expect(new Set(keys)).toEqual(new Set(["2001:db8:a:b::/64"]));
    expect(ipNetwork("2001:db8:a:c::1")).toBe("2001:db8:a:c::/64");
    expect(ipNetwork("::1")).toBe("0:0:0:0::/64");
    expect(ipNetwork("fe80::1:2:3:4")).toBe("fe80:0:0:0::/64");
  });

  it("IPv6 içinde yazılmış IPv4 adresi IPv4 sayılır", () => {
    expect(ipNetwork("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipNetwork("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("okunamayan değer olduğu gibi kalır (yalnızca anahtar)", () => {
    for (const value of ["unknown", "1:2:3", "2001:db8::a::b", "gggg::1", "1:2:3:4:5:6:7:8:9", "999.1.1.1"]) expect(ipNetwork(value)).toBe(value);
  });

  it("X-Forwarded-For'un ilk değeri, yoksa X-Real-IP okunur", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8:1:2::9, 10.0.0.1" }))).toBe("2001:db8:1:2::/64");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
