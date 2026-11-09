"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, type BatchEvent, type LabEventData, type SceneState } from "@/lib/lab/events";
import type { FailReason, LabDriver, QueuedEvent } from "./driver";

/** Toplu olaylar en geç bu kadar bekler; sayfa gizlenince ve anlık eylemlerden önce hemen gider. */
const flushDelayMs = 3000;
const retryDelayMs = 5000;
const maxBatch = 50;

export type SessionProblem = FailReason | "offline";

/**
 * Senaryo labının oturumu: sahne durumu (lib/lab/events.ts), olay sırası ve sunucuya gönderim.
 * Her olay bir sıra numarası alır; sunucu aynı numarayı iki kez yazmaz, böylece bağlantı koparsa
 * aynı toplu gönderim güvenle tekrarlanır. Sorun olursa `problem` dolar, oynatıcı gösterir.
 */
export function useLabSession({
  driver,
  attemptId: initialAttempt,
  initialState,
  initialSeq,
}: {
  driver: LabDriver;
  attemptId: string | null;
  initialState: SceneState;
  initialSeq: number;
}) {
  const [state, setState] = useState(initialState);
  const [attemptId, setAttemptId] = useState(initialAttempt);
  const [problem, setProblem] = useState<SessionProblem | null>(null);
  const attempt = useRef(initialAttempt);
  const seq = useRef(initialSeq);
  const queue = useRef<QueuedEvent[]>([]);
  const sending = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);

  const sendQueued = useCallback(async (): Promise<boolean> => {
    const id = attempt.current;
    if (!id) return queue.current.length === 0;
    while (queue.current.length > 0) {
      const batch = queue.current.slice(0, maxBatch);
      let result: Awaited<ReturnType<LabDriver["send"]>>;
      try {
        result = await driver.send(id, batch);
      } catch {
        // Bağlantı yok: olaylar kuyrukta kalır, biraz sonra yeniden denenir.
        setProblem("offline");
        return false;
      }
      if (!result.ok) {
        // Geçersiz bir toplu gönderim tekrar denenmez (aynı hatayı verir).
        if (result.reason === "invalid") queue.current = queue.current.slice(batch.length);
        setProblem(result.reason);
        return false;
      }
      queue.current = queue.current.slice(batch.length);
      setProblem((p) => (p === "offline" ? null : p));
    }
    return true;
  }, [driver]);

  // Zamanlayıcı her zaman en güncel flush'ı çağırır (flush ile schedule birbirini kullanır).
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flushRef.current();
    }, delay);
  }, []);

  /** Kuyruğu hemen gönderir; aynı anda tek gönderim olur. Hepsi yazıldıysa true. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    while (sending.current) await sending.current;
    const run = sendQueued();
    sending.current = run;
    try {
      const ok = await run;
      if (!ok && queue.current.length > 0) schedule(retryDelayMs);
      return ok;
    } finally {
      sending.current = null;
    }
  }, [sendQueued, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Tarayıcıda olan bir eylem (mail açtı, taşıdı, cevapladı): hemen sahneye, sonra sunucuya. */
  const track = useCallback(
    (event: BatchEvent) => {
      setState((s) => applyEvent(s, event));
      queue.current.push({ seq: seq.current++, event });
      schedule(flushDelayMs);
    },
    [schedule],
  );

  /**
   * Sunucunun karar verdiği eylem (bağlantı, sahte form, cevap, bitirme). Önce kuyruk gider ki
   * sunucu olayları sırasıyla görsün; eylem kendi sıra numarasını alır.
   */
  const immediate = useCallback(
    async <T>(action: (attemptId: string, seq: number) => Promise<T>): Promise<T | null> => {
      const id = attempt.current;
      if (!id || !(await flush())) return null;
      try {
        return await action(id, seq.current++);
      } catch {
        setProblem("offline");
        return null;
      }
    },
    [flush],
  );

  /** Sunucunun yazdığı olay (bağlantıya tıkladı gibi) sahneye de işlenir. */
  const applyLocal = useCallback((event: LabEventData) => setState((s) => applyEvent(s, event)), []);

  const begin = useCallback((id: string) => {
    attempt.current = id;
    setAttemptId(id);
  }, []);

  // Sekme gizlenince ya da sayfa kapanırken bekleyen kararlar gönderilir.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onPageHide);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [flush]);

  return { state, attemptId, problem, clearProblem: () => setProblem(null), track, immediate, applyLocal, begin, flush };
}
