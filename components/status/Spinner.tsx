import { Mascot } from "@/components/mascot/Mascot";
import { cn } from "@/lib/utils";

/**
 * Bekleme işareti: maskotun düğmesi gider gelir (yazısız; yanındaki metin ya da düğmenin
 * aria-busy'si ne beklendiğini söyler). Ana renk ya da tehlike düğmesinin içinde gövde düğmenin
 * yazı rengini alır ki zeminle karışmasın.
 */
export function Spinner({ className, tone = "plain" }: { className?: string; tone?: "plain" | "onAccent" | "onDanger" }) {
  return (
    <Mascot
      mood="loading"
      onAccent={tone !== "plain"}
      className={cn("inline-block h-4 w-[28px] flex-none", tone === "onDanger" && "mc-on-danger", className)}
    />
  );
}
