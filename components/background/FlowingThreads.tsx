import { cn } from "@/lib/utils";
import { patterns, type PatternName } from "./patterns";

/**
 * Tema H'nin "akan iplikler" arka planı: soluk camgöbeği çizgiler, nefes alan noktalar
 * ve çizgi boyunca kayan bir ışık. Süs içindir, ekran okuyucudan gizlidir.
 */
export function FlowingThreads({ pattern, className }: { pattern: PatternName; className?: string }) {
  const { width, height, threads } = patterns[pattern];
  const id = `thread-${pattern}`;
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" style={{ stopColor: "var(--glow)" }} stopOpacity=".9" />
          <stop offset=".35" style={{ stopColor: "var(--accent)" }} stopOpacity=".35" />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={pattern === "mobile" ? "anim-drift-mobile" : "anim-drift"}>
        {threads.map((thread, i) => {
          const pathId = `${id}-${i}`;
          return (
            <g key={pathId}>
              <path
                id={pathId}
                d={thread.d}
                fill="none"
                strokeWidth={pattern === "mobile" ? 1.4 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--accent)", strokeOpacity: "var(--thread-opacity)" }}
              />
              <path
                d={thread.d}
                fill="none"
                style={{ stroke: "var(--accent)" }}
                strokeOpacity=".05"
                strokeWidth={pattern === "mobile" ? 6 : 7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {thread.dots.map((dot) => (
                <circle
                  key={`${dot.x}-${dot.y}`}
                  className="anim-breathe"
                  style={{ animationDelay: `${dot.delay}s` }}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.r}
                  fill={`url(#${id}-glow)`}
                />
              ))}
              {"traveler" in thread && thread.traveler ? (
                <circle className="thread-traveler" r={thread.traveler.r} fill={`url(#${id}-glow)`}>
                  <animateMotion dur={`${thread.traveler.duration}s`} begin={`${thread.traveler.start}s`} repeatCount="indefinite">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
