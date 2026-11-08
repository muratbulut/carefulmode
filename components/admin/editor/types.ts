// Lab düzenleme formunun ortak tipleri.

/** Formdaki içeriği değiştirir: verilen fonksiyon içeriğin kopyası üzerinde çalışır. */
export type Edit<T> = (change: (draft: T) => void) => void;

/** Bölümlerin bildirim kutusuna yazdığı kısa mesaj ("Mail eklendi."). */
export type Say = (message: string) => void;
