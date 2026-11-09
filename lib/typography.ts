// Başlıklardaki düz tırnağı Türkçe tırnağa çevirir: "kodu atar mısın?" → “kodu atar mısın?”.
// Başlık yazı tipi düz tırnağı iki yanda da ” gibi çiziyor. İçerik veritabanında yazıldığı gibi
// kalır; çeviri yalnızca öğrenciye ve ziyaretçiye gösterilirken yapılır.

/** Sırayla açılış ve kapanış tırnağı koyar; tek kalan tırnak açılış olur. */
export function smartQuotes(text: string): string {
  if (!text.includes('"')) return text;
  let open = true;
  return text.replace(/"/g, () => {
    const mark = open ? "“" : "”";
    open = !open;
    return mark;
  });
}
