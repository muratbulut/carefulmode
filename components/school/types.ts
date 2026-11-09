// Okulum sayfasının verisi (lib/school/bulletin.ts hazırlar, components/school çizer). Tarayıcıya
// giden her şey buradadır: öğrenci adı, puanı, raporu; öğretmenin ve başvuranın e-postası;
// talepteki belge ve kurumsal e-posta adresi hiçbir alanda yoktur (yalnızca "var / yok").

import type { ReminderKind } from "@/lib/mail/teacher-mail";
import type { SetupStep, Signal } from "@/lib/school/bulletin-model";

export type ClassAttention = { kind: "noMembers" } | { kind: "noAssignment" } | { kind: "notStarted"; n: number };

export type SchoolClass = {
  id: string;
  name: string;
  /** Düzey adı ("7. sınıf", "Karma"); yoksa boş. */
  level: string;
  members: number;
  teacher: string;
  /** Ödevin mahallesi (adı ve tema rengi adı); ödev yoksa null. */
  topic: { name: string; color: string } | null;
  /** Ödevin toplam yüzdesi; ödev yoksa null. */
  pct: number | null;
  /** Bu hafta biten lab (sınıfın toplamı). */
  week: number;
  /** "17 Ekim'e kadar"; son tarih yoksa null. */
  due: string | null;
  attention: ClassAttention | null;
};

export type TeacherHint =
  | { kind: "good" | "assigned" | "joined" | "fresh" | "waiting" }
  | { kind: "created"; n: number }
  | { kind: "waitingDays"; days: number };

export type SchoolTeacher = {
  id: string;
  name: string;
  avatar: string;
  /** Branş (onaylanan talepten); bilinmiyorsa boş. */
  subject: string;
  me: boolean;
  /** "Bugün 09:15"; bilinmiyorsa null. */
  lastSeen: string | null;
  step: SetupStep;
  signal: Signal;
  /** Bu öğretmen için "Hatırlat" düğmesi (adımına göre); hatırlatılamıyorsa null. */
  remind: ReminderKind | null;
  /** Son 24 saatte hatırlatma gitti mi. */
  reminded: boolean;
  hint: TeacherHint;
  classes: SchoolClass[];
  students: number;
};

export type SchoolRequest = {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  when: string;
  hasInstitutionalEmail: boolean;
  hasDocument: boolean;
  /** Doğum yılına göre 18 yaşından küçük olabilir (yıl sorumluya gösterilmez). */
  minor: boolean;
};

export type HandledRequest = { id: string; name: string; kind: "approved" | "endorsed" | "notRecognized" };

export type SchoolBulletin = {
  week: number;
  range: string;
  preparedBy: string;
  counts: { teachers: number; classes: number; students: number; weekDone: number };
  sentences: { labs: string; homework: string; teachers: string; requests: string };
  chart: { label: string; count: number; current: boolean }[];
  trend: { tone: "up" | "down" | "same"; text: string };
};

export type SchoolView = {
  school: { id: string; name: string; province: string; district: string; coordinatorApproves: boolean };
  /** Sorumlu aynı zamanda bu okulun öğretmeni mi (başlıktaki satır). */
  meTeacher: boolean;
  inviteUrl: string;
  mailto: string;
  bulletin: SchoolBulletin;
  requests: SchoolRequest[];
  handled: HandledRequest[];
  teachers: SchoolTeacher[];
};
