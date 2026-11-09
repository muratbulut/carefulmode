// Kullanıcılar sayfasının tarayıcıya giden verisi (lib/admin/users.ts doldurur). Tarihler
// sunucuda metne çevrilir.
//
// Gizlilik: öğrencinin e-postası ve tam adı hiçbir alanda yoktur; ad yalnızca "Ad S." olarak
// gider (shortName). Öğrencinin puanı, raporu, deneme sayısı ve hacklenme bilgisi de yoktur;
// yalnızca hangi labı ne zaman bitirdiği. Öğretmen satırlarında öğrenci adı yoktur, sınıflar
// yalnızca toplamlarla gelir. Öğretmenin e-postası yalnızca yöneticinin açtığı çekmecede görünür.

import type { ReminderKind } from "@/lib/mail/teacher-mail";
import type { SetupStep, Signal } from "@/lib/school/bulletin-model";
import type { CalendarCell, PageInfo } from "@/lib/admin/users-model";
import type { ClassCardView, AttentionView } from "@/components/classroom/types";
import type { TeacherHint } from "@/components/school/types";

export type UsersCounts = {
  /** Genel görünümdeki kişi sayısı (bütün hesaplar). */
  people: number;
  students: number;
  teachers: number;
  team: number;
  schools: number;
  /** Bekleyen öğretmenlik talepleri (PENDING). */
  pending: number;
};

export type StudentRow = {
  id: string;
  /** "Ayşe Y." */
  name: string;
  avatar: string;
  /** "7-A · Ahmet Çelik"; sınıfı yoksa null. */
  classLabel: string | null;
  labs: number;
  joined: string;
  /** "Bugün", "3 gün önce"; hiç girmediyse null. */
  lastSeen: string | null;
};

export type StudentPage = PageInfo & { rows: StudentRow[] };

/** Öğretmenin sınıfı (çekmece ve okul kartı): toplamlar; öğrenci adı yok. */
export type AdminClass = {
  id: string;
  name: string;
  /** "7. sınıf", "Karma"; yoksa boş. */
  level: string;
  members: number;
  /** Ödevin mahallesi; ödev yoksa null. */
  topic: { name: string; color: string } | null;
  pct: number | null;
};

export type AdminTeacher = {
  id: string;
  name: string;
  avatar: string;
  /** Öğretmenin e-postası (yalnızca çekmecede gösterilir). */
  email: string;
  /** Branş; bilinmiyorsa boş. */
  subject: string;
  isAdmin: boolean;
  school: { id: string; name: string; place: string } | null;
  /** Okul sorumlusuysa okulun adı. */
  coordinatorOf: string | null;
  /** "28 Eylül · onaylayan Murat B."; talep kaydı yoksa null. */
  approved: { date: string; by: string | null } | null;
  /** "Bugün 09:15"; hiç girmediyse null. */
  lastSeen: string | null;
  step: SetupStep;
  signal: Signal;
  hint: TeacherHint;
  /** "Hatırlat" düğmesinin türü; hatırlatılamıyorsa null. */
  remind: ReminderKind | null;
  /** Son 24 saatte hatırlatma gitti mi (okul sorumlusundan ya da ekipten). */
  reminded: boolean;
  /** Bakan yöneticinin kendisi mi (kendini çıkaramaz, kendine hatırlatmaz). */
  me: boolean;
  classes: AdminClass[];
  students: number;
};

/** Öğretmenler sekmesinin bir sayfası (ad sırasıyla). */
export type TeacherPage = PageInfo & { rows: AdminTeacher[] };

export type AdminSchool = {
  id: string;
  name: string;
  place: string;
  coordinator: { id: string; name: string; isTeacher: boolean } | null;
  coordinatorApproves: boolean;
  pending: number;
  /** Okulun sınıflarındaki öğrenci (bir kez sayılır). */
  students: number;
  /** Okulun onaylı öğretmenlerinin kimlikleri (SchoolsOverview.teachers içinden). */
  teacherIds: string[];
  /** Kurulum hunisi: her adıma ulaşan öğretmen sayısı. */
  funnel: [number, number, number, number, number];
};

/** Okullar görünümü: bütün okulların toplamları ve aramaya uyan okulların bir sayfası. */
export type SchoolsOverview = PageInfo & {
  schools: AdminSchool[];
  /** Bu sayfadaki okulların öğretmenleri (okul kartı ve çekmece). */
  teachers: AdminTeacher[];
  summary: { schools: number; teachers: number; pending: number; students: number };
  /** Listede olmayan okul için gelen ("Yeni okul") bekleyen talepler. */
  pendingNoSchool: number;
};

export type ProfileLab = { id: string; name: string; neighborhood: string; color: string; training: boolean; when: string };

export type StudentProfile = {
  id: string;
  name: string;
  avatar: string;
  /** "7-A · Ahmet Çelik · Bahçelievler Ortaokulu"; sınıfı yoksa null (kendi başına). */
  classLine: string | null;
  moreClasses: number;
  /** Yönetim ekibindeyse izinlerinin kısa adları. */
  team: string[] | null;
  labs: number;
  lastActive: string | null;
  weekly: string;
  joined: string;
  cells: CalendarCell[];
  activeDays: number;
  current: { name: string; neighborhood: string; color: string } | null;
  neighborhoods: { id: string; name: string; color: string; done: number; total: number }[];
  finished: ProfileLab[];
};

/** "Öğretmenin gözünden": öğretmenin Sınıflarım özeti. Sınıf kodu, QR ve davet adresi gitmez. */
export type GazeView = {
  teacherId: string;
  name: string;
  firstName: string;
  summary: { classes: number; students: number; week: number };
  classes: Omit<ClassCardView, "code" | "qr">[];
  attention: AttentionView[];
};
