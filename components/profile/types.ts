import type { EducationStatus } from "@/lib/account/shared";
import type { DeviceKind } from "@/lib/account/user-agent";
import type { AvatarCode } from "@/lib/avatars";
import type { BadgeCode, BadgeState } from "@/lib/progress/badges";
import type { LevelInfo } from "@/lib/progress/levels";

/** Profil sayfasına sunucudan gelen veri. Tarihler hazır metindir (lib/account/dates.ts). */
export type ProfileUser = {
  name: string;
  email: string;
  emailVerified: boolean;
  birthYear: number | null;
  educationStatus: EducationStatus | null;
  gradeLevel: string | null;
  avatar: AvatarCode;
  memberSince: string;
  /** Silme istenmişse silineceği gün ("17 Ekim'de"). */
  deletionOn: string | null;
};

/** Açık oturum. Oturum anahtarı ve IP tarayıcıya gönderilmez. */
export type ProfileSession = {
  id: string;
  kind: DeviceKind;
  browser: string | null;
  os: string | null;
  /** "3 gün önce"; null ise "şu an". */
  lastActive: string | null;
  current: boolean;
};

/** Rozet: kazanıldı mı, kazanılmadıysa ilerlemesi. */
export type ProfileBadge = Pick<BadgeState, "code" | "earned" | "progress">;

/** Puan, seviye ve rozetler (lib/progress/summary.ts). */
export type ProfileProgress = {
  level: LevelInfo;
  stats: { labsDone: number; cardsRead: number; reports: number };
  badges: ProfileBadge[];
  showcase: BadgeCode[];
};

// Sıra Tur 2 kararı: Hesap bilgileri, Rozetler, Avatar, Görünüm, Güvenlik, Hesabı sil.
export const sectionKeys = ["account", "badges", "avatar", "appearance", "security", "delete"] as const;
export type SectionKey = (typeof sectionKeys)[number];
