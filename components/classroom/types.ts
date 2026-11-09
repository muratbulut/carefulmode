// Öğretmen ekranlarına sunucudan giden veri (lib/classroom/teacher.ts doldurur). Tarihler
// sunucuda metne çevrilir. Gizlilik: öğrenci başına yalnızca bitirdi / bitirmedi, katılma ve son
// lab zamanı gider; puan, rapor, deneme sayısı ve hacklenme bilgisi hiç gitmez. Güvende kalma
// oranı yalnızca sınıf toplamıdır.

import type { QrData, StudentStatus } from "@/lib/classroom/teacher-rules";

/** Tahtaya yansıtılan sınıf. */
export type ProjectionTarget = { id: string; name: string; code: string; qr: QrData };

export type ClassCardView = ProjectionTarget & {
  /** Düzey kodu (lib/classroom/rules.ts classLevels); adı sözlükte. */
  level: string;
  students: number;
  isNew: boolean;
  /** Ödev: kaç öğrencinin bütün odaları bitirdiği (yüzde gösterilmez, kafa karıştırıyordu). */
  homework: { name: string; color: string; finished: number; due: string | null } | null;
  /** Bu hafta biten lab sayısı (öğrenci × lab). */
  week: number;
  /** Son lab hareketi ("3 gün önce"); hiç yoksa null. */
  last: string | null;
};

export type AttentionView = { id: string; name: string; text: string };

export type ClassesData = {
  summary: { classes: number; students: number; week: number };
  classes: ClassCardView[];
  attention: AttentionView[];
  /** Sitenin kök adresi; davet bağlantısı bununla kopyalanır. */
  origin: string;
};

export type HoodView = {
  id: string;
  name: string;
  color: string;
  icon: string;
  labCount: number;
  /** Yayındaki odalar, rota sırasıyla; gate: odayı açan eğitim (temel eğitimde null). */
  labs: { id: string; name: string; training: boolean; gate: string | null }[];
  /** Sınıfın o mahalledeki labları bitirme oranı. */
  pct: number;
  current: boolean;
};

/** Tuzağı fark eden öğrencilerin yüzdesi: ilk biten denemesinde ve son biten denemesinde. */
export type NoticeRates = { first: number; last: number };

export type HomeworkLabView = {
  id: string;
  name: string;
  training: boolean;
  /** Labı bitiren öğrenci sayısı. */
  finishers: number;
  /** Sınıf toplamında tuzağı fark edenlerin yüzdesi, ilk seferde ve tekrar sonrası; eğitimde ve az bitirende null. */
  noticed: NoticeRates | null;
};

export type HomeworkView = {
  neighborhoodId: string;
  name: string;
  color: string;
  icon: string;
  /** Ödevin odaları, rota sırasıyla (öğretmenin seçtikleri ve onları açan eğitimler). */
  labs: HomeworkLabView[];
  pct: number;
  finished: number;
  /** Ödeve başlamayanlar (öğretmen kendi öğrencisinin adını görür). */
  notStarted: { id: string; name: string }[];
  /** "17 Ekim'e kadar"; son tarih yoksa null. */
  due: string | null;
  /** "6 gün kaldı", "Bugün son gün", "Son tarih geçti". */
  left: string | null;
  overdue: boolean;
  /** Tarih kutusundaki değer ("YYYY-AA-GG" ya da boş). */
  dueInput: string;
};

export type StudentView = {
  id: string;
  name: string;
  joined: string;
  last: string | null;
  /** Ödevin her labı için bitirdi mi (HomeworkView.labs sırasıyla). */
  homework: boolean[];
  status: StudentStatus | null;
  /** Yayındaki bütün lablardan bitirdiği. */
  total: number;
  /** Her mahallede bitirdiği lab sayısı (ClassroomDetailData.hoods sırasıyla). */
  byHood: number[];
};

export type ClassroomDetailData = ProjectionTarget & {
  level: string;
  origin: string;
  week: number;
  labTotal: number;
  homework: HomeworkView | null;
  students: StudentView[];
  hoods: HoodView[];
  past: { id: string; name: string; color: string; pct: number }[];
  dueBounds: { min: string; max: string };
};

export type DetailTab = "overview" | "students" | "topics";
