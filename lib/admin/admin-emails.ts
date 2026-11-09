// İlk yönetici: ADMIN_EMAILS ortam değişkenindeki (virgülle ayrılmış) adreslerden biriyle
// e-postasını doğrulamış kullanıcı yönetici olur (lib/admin/promote.ts). Yöneticilik hiçbir
// zaman kendiliğinden geri alınmaz; listeden çıkan adres yönetici kalır.

const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** " A@ornek.com, b@ornek.com ,, yanlis " -> ["a@ornek.com", "b@ornek.com"] */
export function parseAdminEmails(value: string | null | undefined): string[] {
  const emails = (value ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => emailPattern.test(part));
  return [...new Set(emails)];
}

export function isConfiguredAdminEmail(email: string, value: string | null | undefined = process.env.ADMIN_EMAILS): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && parseAdminEmails(value).includes(normalized);
}
