"use client";

import { useEffect, useRef } from "react";
import { recordArticleRead } from "@/lib/news/reads";

/**
 * Haber sayfası açılınca okuma sayısını bir kez artırır (sunucuda aynı IP'den aynı habere günde
 * bir). Kimin okuduğu saklanmaz; çerez ya da tarayıcı deposu kullanılmaz. Ekranda bir şey çizmez.
 */
export function ReadTracker({ articleId }: { articleId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordArticleRead(articleId).catch(() => {});
  }, [articleId]);
  return null;
}
