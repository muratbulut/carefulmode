// Hazır avatarlar (Tur 1 fikri, Tur 2 profil tahtası). Fotoğraf yüklenmez; öğrenci bu listeden
// birini seçer. Şimdilik emoji; gerçek avatar seti çizilince "emoji" yerine resim dosyası gelir.
// Veritabanında yalnızca kod durur (User.avatar). Adlar sözlükte: t.profile.avatar.names[kod].

export const avatars = [
  { code: "fox", emoji: "🦊" },
  { code: "panda", emoji: "🐼" },
  { code: "owl", emoji: "🦉" },
  { code: "tiger", emoji: "🐯" },
  { code: "frog", emoji: "🐸" },
  { code: "octopus", emoji: "🐙" },
  { code: "lion", emoji: "🦁" },
  { code: "koala", emoji: "🐨" },
  { code: "penguin", emoji: "🐧" },
  { code: "robot", emoji: "🤖" },
  { code: "alien", emoji: "👾" },
  { code: "dragon", emoji: "🐲" },
] as const;

export type AvatarCode = (typeof avatars)[number]["code"];

export function isAvatarCode(value: unknown): value is AvatarCode {
  return typeof value === "string" && avatars.some((a) => a.code === value);
}

/**
 * Kullanıcının avatarı. Henüz seçmediyse kimliğinden hep aynı avatar çıkar; böylece
 * herkesin bir avatarı olur ve sayfadan sayfaya değişmez.
 */
export function avatarOf(user: { id: string; avatar?: string | null }) {
  if (isAvatarCode(user.avatar)) return avatars.find((a) => a.code === user.avatar)!;
  let hash = 0;
  for (const ch of user.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return avatars[hash % avatars.length];
}
