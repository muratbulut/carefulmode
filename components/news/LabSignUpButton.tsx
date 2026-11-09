"use client";

import { useState, type ReactNode } from "react";
import { SignUpDialog, type SignUpTarget } from "@/components/roadmap/SignUpDialog";

/**
 * Ziyaretçinin "Kayıt ol ve dene" ve "Ücretsiz kayıt ol" düğmeleri: kayıt penceresini açar
 * (Gundem-G2-Zaman, Gundem-Detay-H2-Yan). Kayıt ve giriş bitince `target.href` adresine dönülür.
 */
export function LabSignUpButton({ target, className, children }: { target: SignUpTarget; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <SignUpDialog target={open ? target : null} onClose={() => setOpen(false)} />
    </>
  );
}
