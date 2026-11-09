import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Odanın çizimi (7.1. revize, `lib/lab/art.ts`). Süstür: odanın adı hep yanında yazılı olduğu için
 * ekran okuyucuya ayrıca okunmaz (boş alt).
 */
export function RoomArt({ src, className }: { src: string; className?: string }) {
  return <Image src={src} alt={""} aria-hidden="true" width={640} height={320} unoptimized className={cn("object-cover", className)} />;
}
