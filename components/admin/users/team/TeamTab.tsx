import { ScrollText } from "lucide-react";
import Link from "next/link";
import { getTeamView, type TeamMemberView } from "@/lib/admin/team";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { siteTimeZone } from "@/lib/site";
import type { TeamCardMember } from "./EditTeamMemberDialog";
import { TeamGrid } from "./TeamGrid";

/**
 * Kullanıcılar · Yönetim ekibi sekmesi (Kullanicilar-Son): yöneticiler ve sorumlular kart kart,
 * "İzinleri düzenle", "Ekibe kişi ekle" ve kayıt defterine bağlantı. Veriyi kendisi okur ve
 * yöneticiliği yeniden denetler (getTeamView → requireAdmin); sayfa bunu <Suspense> içinde çizer.
 */
export async function TeamTab() {
  const { members } = await getTeamView();
  const t = getMessages().adminTeam;
  const now = new Date();
  const cards: TeamCardMember[] = members.map((m) => ({ ...m, meta: metaLine(m, now) }));
  return (
    <div className="flex flex-col gap-3.5 [animation:fade-in_.2s_ease-out_both]">
      <p className="m-0 text-[13px] leading-normal text-fg-3">{t.intro}</p>
      <TeamGrid members={cards} />
      <Link href={paths.adminAudit} className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-accent-fg no-underline hover:underline">
        <ScrollText className="size-4" strokeWidth={2} aria-hidden="true" />
        {t.auditLink}
      </Link>
    </div>
  );
}

/** "5 Ekim · ekleyen Murat B.", "Kurucu · sen" (Kullanicilar-Son kart alt satırı). */
function metaLine(member: TeamMemberView, now: Date): string {
  const t = getMessages().adminTeam;
  const added = member.addedAt ? new Date(member.addedAt) : null;
  const date = added
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        timeZone: siteTimeZone,
        ...(added.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: "numeric" }),
      }).format(added)
    : null;
  return [member.founder ? t.founder : date, member.addedBy ? format(t.addedBy, { name: member.addedBy }) : null, member.me ? t.me : null]
    .filter((part): part is string => !!part)
    .join(" · ");
}
