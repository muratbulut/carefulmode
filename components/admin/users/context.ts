"use client";

import { createContext, use } from "react";
import type { AdminTeacher } from "./types";

/** Kullanıcılar sayfasının ortak işleri (UsersWorkspace sağlar). */
export type UsersContextValue = {
  teachers: AdminTeacher[];
  /** Son 24 saatte hatırlatılan (sunucudan gelen ya da bu sayfada gönderilen). */
  isReminded: (teacher: AdminTeacher) => boolean;
  /** Hatırlatması gönderilmekte olan öğretmen. */
  reminding: string | null;
  openTeacher: (id: string) => void;
  openStudent: (id: string) => void;
  gaze: (teacher: Pick<AdminTeacher, "id" | "name">) => void;
  remind: (teacher: AdminTeacher) => void;
};

export const UsersContext = createContext<UsersContextValue | null>(null);

export function useUsers(): UsersContextValue {
  const value = use(UsersContext);
  if (!value) throw new Error("useUsers outside UsersWorkspace");
  return value;
}
