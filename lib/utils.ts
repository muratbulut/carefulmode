import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind sınıflarını birleştirir; çakışan sınıflarda sonuncusu kazanır (shadcn/ui ile aynı). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
