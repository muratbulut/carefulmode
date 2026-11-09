// İstek sayfaya gelmeden önceki hızlı kontrol: oturum çerezi olmayan ziyaretçi, giriş
// gerektiren sayfalardan hemen giriş sayfasına yönlendirilir. Bu yalnızca bir kısayoldur;
// asıl kontrol sayfada ve sunucu eyleminde yapılır (lib/session.ts), çerezin geçerliliğine
// burada bakılmaz.
//
// Durum ekranları önizlemesi (/onizleme) ekibin ve testlerin sayfasıdır: yalnızca PREVIEW_PAGE=1
// olan sunucuda açılır (geliştirme ve uçtan uca testler). Canlıda bu değişken yoktur, sayfa 404 olur
// (4 Kasım, Murat: kullanıma açılırken geliştirme sayfaları canlıda durmasın).

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/onizleme") {
    if (process.env.PREVIEW_PAGE === "1") return NextResponse.next();
    // Var olmayan bir adrese yeniden yazılır: sitenin kendi 404 sayfası, 404 durumuyla.
    return NextResponse.rewrite(new URL("/onizleme-kapali", request.url));
  }
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = new URL("/giris", request.url);
  url.searchParams.set("sonra", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/onizleme", "/profil/:path*", "/dogrula", "/oda/:path*", "/yonetim/:path*", "/siniflarim/:path*", "/okulum"],
};
