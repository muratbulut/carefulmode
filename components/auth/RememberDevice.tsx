"use client";

import { useEffect } from "react";
import { markSignedIn } from "./device";

/** Giriş yapmış kullanıcının gördüğü bir yere konur; giriş ekranı bir dahakine "Tekrar hoş geldin" der. */
export function RememberDevice() {
  useEffect(() => markSignedIn(), []);
  return null;
}
