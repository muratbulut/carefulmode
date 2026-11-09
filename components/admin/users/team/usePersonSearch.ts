"use client";

import { useEffect, useRef, useState } from "react";
import { searchLimits } from "@/lib/admin/team-rules";

type SearchResult<P> = { ok: true; people: P[] } | { ok: false; error: string };

type SearchState<P> = {
  /** null: henüz aranmadı (en az 3 harf gerekir). */
  people: P[] | null;
  loading: boolean;
  /** Sunucu hatası (hata kodu). */
  error: string | null;
};

/**
 * Kişi arama kutusunun durumu ("Ekibe kişi ekle", okul sorumlusu). Yazarken 250 ms bekleyip arar;
 * eski bir aramanın cevabı yenisinin üstüne yazılmaz. `initial` verilirse pencere açılınca boş
 * aramayla başlar (okulun öğretmenleri). En az 3 harf; boş arama yalnızca `allowEmpty` ile.
 */
export function usePersonSearch<P>(fetcher: (query: string) => Promise<SearchResult<P>>, { allowEmpty = false, initial = false } = {}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState<P>>({ people: null, loading: initial, error: null });
  const timer = useRef<number | null>(null);
  const ticket = useRef(0);
  const fetchRef = useRef(fetcher);

  useEffect(() => {
    fetchRef.current = fetcher;
  });

  useEffect(() => {
    const clear = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
    if (!initial) return clear;
    const mine = ++ticket.current;
    fetchRef
      .current("")
      .catch(() => null)
      .then((result) => {
        if (mine === ticket.current) setState(toState(result));
      });
    return clear;
    // Yalnızca pencere açılırken bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(value: string) {
    setQuery(value);
    if (timer.current !== null) window.clearTimeout(timer.current);
    const mine = ++ticket.current;
    const q = value.trim();
    if (q.length < searchLimits.min && !(allowEmpty && q.length === 0)) {
      setState({ people: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    timer.current = window.setTimeout(() => {
      fetchRef
        .current(q)
        .catch(() => null)
        .then((result) => {
          if (mine === ticket.current) setState(toState(result));
        });
    }, 250);
  }

  return { query, change, ...state };
}

function toState<P>(result: SearchResult<P> | null): SearchState<P> {
  if (!result) return { people: [], loading: false, error: "failed" };
  return result.ok ? { people: result.people, loading: false, error: null } : { people: [], loading: false, error: result.error };
}
