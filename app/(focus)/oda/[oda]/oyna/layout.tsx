/** Oda oynatıcısı: üst menü yok, öğrenci odanın içindedir; çıkış oynatıcının şeridindedir. */
export default function PlayLayout({ children }: LayoutProps<"/oda/[oda]/oyna">) {
  return (
    <main id="content" className="flex flex-1 flex-col">
      {children}
    </main>
  );
}
