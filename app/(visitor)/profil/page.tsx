import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/ProfileView";
import { sectionKeys, type ProfileProgress, type ProfileSession, type ProfileUser, type SectionKey } from "@/components/profile/types";
import { Loading } from "@/components/status/Loading";
import { dayOn, memberSince, timeAgo } from "@/lib/account/dates";
import { withNext } from "@/lib/account/shared";
import { parseUserAgent } from "@/lib/account/user-agent";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { getProgressSummary } from "@/lib/progress/summary";
import { profileSectionParams, routes } from "@/lib/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: getMessages().pages.profile, robots: { index: false } };

export default function ProfilePage({ searchParams }: PageProps<"/profil">) {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileEntry searchParams={searchParams} />
    </Suspense>
  );
}

async function ProfileEntry({ searchParams }: Pick<PageProps<"/profil">, "searchParams">) {
  const session = await getSession();
  if (!session) redirect(withNext(routes.signIn, routes.profile));
  const params = await searchParams;

  // Oturumdaki kopya yerine güncel satır: profilde yapılan değişiklik hemen görünsün.
  const [row, rows, summary] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        id: true,
        displayName: true,
        email: true,
        emailVerified: true,
        birthYear: true,
        educationStatus: true,
        gradeLevel: true,
        avatar: true,
        createdAt: true,
        deletionScheduledAt: true,
      },
    }),
    db.session.findMany({
      where: { userId: session.user.id, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, userAgent: true, updatedAt: true },
    }),
    getProgressSummary(session.user.id),
  ]);

  const user: ProfileUser = {
    name: row.displayName,
    email: row.email,
    emailVerified: row.emailVerified,
    birthYear: row.birthYear,
    educationStatus: row.educationStatus,
    gradeLevel: row.gradeLevel,
    avatar: avatarOf(row).code,
    memberSince: memberSince(row.createdAt),
    deletionOn: row.deletionScheduledAt ? dayOn(row.deletionScheduledAt) : null,
  };

  // Bu cihaz en üstte; diğerleri son kullanıma göre.
  const sessions: ProfileSession[] = rows
    .map((s) => ({
      id: s.id,
      ...parseUserAgent(s.userAgent),
      lastActive: s.id === session.session.id ? null : timeAgo(s.updatedAt),
      current: s.id === session.session.id,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));

  const requested = typeof params.bolum === "string" ? params.bolum : "";
  const sectionByParam = new Map<string, SectionKey>(Object.entries(profileSectionParams).filter(([key]) => (sectionKeys as readonly string[]).includes(key)).map(([key, param]) => [param, key as SectionKey]));
  const requestedSection = sectionByParam.get(requested);
  const initialSection: SectionKey = requestedSection ?? (row.deletionScheduledAt ? "delete" : sectionKeys[0]);
  const notice = params.silme === "iptal" ? getMessages().auth.signIn.deletionCancelled : null;

  const progress: ProfileProgress = {
    level: summary.level,
    stats: summary.stats,
    badges: summary.badges.map(({ code, earned, progress }) => ({ code, earned, progress })),
    showcase: summary.showcase,
  };

  return (
    <ProfileView
      user={user}
      progress={progress}
      sessions={sessions}
      initialSection={initialSection}
      openSection={requestedSection !== undefined}
      notice={notice}
    />
  );
}
