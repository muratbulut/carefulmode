
/**
 * Odak sayfalarının çerçevesi: alt bilgi ve alt menü yok. Oynatıcıda üst menü de yok, yalnızca
 * oynatıcının kendi şeridi (Çık ve ilerleme) kalır (oyna/layout.tsx); sonuç raporunda masaüstünde
 * üst menü durur (sonuc/layout.tsx).
 */
export default function FocusLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      {children}
    </div>
  );
}
