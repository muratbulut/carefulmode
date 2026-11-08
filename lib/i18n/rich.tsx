import { Fragment, type ReactNode } from "react";

/**
 * Sözlük metnindeki "<etiket>parça</etiket>" bölümlerini verilen bileşenlerle çizer:
 * rich("Önce, <accent>burada.</accent>", { accent: (c) => <span className="text-accent-fg">{c}</span> })
 * Metnin geri kalanı düz yazı olarak kalır. İç içe etiket desteklenmez; tanımsız etiketin
 * yalnızca içi yazılır.
 */
export function rich(message: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of message.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) {
    const [whole, name, chunk] = match;
    if (match.index > last) parts.push(message.slice(last, match.index));
    const render = tags[name];
    parts.push(<Fragment key={match.index}>{render ? render(chunk) : chunk}</Fragment>);
    last = match.index + whole.length;
  }
  if (last < message.length) parts.push(message.slice(last));
  return parts;
}
