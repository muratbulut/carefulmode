import { Suspense } from "react";
import { AddSchoolButton } from "@/components/admin/users/schools/AddSchoolButton";
import { SchoolsView } from "@/components/admin/users/schools/SchoolsView";
import { StudentList } from "@/components/admin/users/StudentList";
import { TeacherTable } from "@/components/admin/users/TeacherTable";
import { AddTeamMemberButton } from "@/components/admin/users/team/AddTeamMemberButton";
import { TeamTab } from "@/components/admin/users/team/TeamTab";
import { UsersWorkspace } from "@/components/admin/users/UsersWorkspace";
import { UserTabs, ViewSwitch } from "@/components/admin/users/UsersNav";
import { Loading } from "@/components/status/Loading";
import { requireAdmin } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getAdminTeachers, getSchoolsOverview, getStudentPage, getTeacherPage, getUsersCounts } from "@/lib/admin/users";
import { parseUsersQuery } from "@/lib/admin/users-model";
import { getMessages } from "@/lib/i18n";
import { requestTime } from "@/lib/lab/data";

export function generateMetadata() {
  return adminMetadata(() => getMessages().adminUsers.title, "ROLES");
}

/**
 * Yönetim · Kullanıcılar (Kullanicilar-Son): iki görünüm, Genel (Öğrenciler, Öğretmenler,
 * Yönetim ekibi) ve Okullar. Görünüm, sekme, arama, sayfa ve açık çekmece adreste durur
 * (?gorunum=okullar, ?sekme=ogretmenler, ?ara=, ?sayfa=, ?ogrenci=, ?ogretmen=). Yalnızca yönetici.
 */
export default function AdminUsersPage(props: PageProps<"/yonetim/kullanicilar">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminUsers searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AdminUsers({ searchParams }: { searchParams: PageProps<"/yonetim/kullanicilar">["searchParams"] }) {
  const access = await requireAdmin();
  const query = parseUsersQuery(await searchParams);
  const now = await requestTime();
  const general = query.view === "genel";
  // Yalnızca açık listenin sayfası okunur. Çekmecenin öğretmenleri: Öğretmenler sayfasındakiler
  // ya da Okullar'da sayfadaki okulların öğretmenleri; adresteki çekmece (?ogretmen=) listede
  // yoksa o da ayrıca okunur.
  const [counts, students, teacherPage, schools] = await Promise.all([
    getUsersCounts(),
    general && query.tab === "ogrenciler" ? getStudentPage(query, now) : null,
    general && query.tab === "ogretmenler" ? getTeacherPage(query, now, access.userId) : null,
    general ? null : getSchoolsOverview(query, now, access.userId),
  ]);
  const listed = teacherPage?.rows ?? schools?.teachers ?? [];
  const extra =
    query.teacher && !listed.some((teacher) => teacher.id === query.teacher) ? await getAdminTeachers(now, access.userId, { ids: [query.teacher] }) : [];
  const teachers = [...listed, ...extra];
  const t = getMessages().adminUsers;

  return (
    <main className="flex flex-col gap-[18px] px-4 pt-5 pb-16 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{t.title}</h1>
          <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">{t.intro}</p>
        </div>
        {general ? <AddTeamMemberButton /> : <AddSchoolButton />}
      </div>

      <ViewSwitch view={query.view} counts={counts} />

      <UsersWorkspace teachers={teachers}>
        {general ? (
          <div className="flex flex-col gap-3.5 lg:gap-[22px]">
            <UserTabs tab={query.tab} counts={counts} />
            {query.tab === "ogrenciler" && students ? <StudentList data={students} /> : null}
            {query.tab === "ogretmenler" && teacherPage ? <TeacherTable pending={counts.pending} data={teacherPage} /> : null}
            {query.tab === "ekip" ? (
              <Suspense fallback={<Loading cardCount={3} />}>
                <TeamTab />
              </Suspense>
            ) : null}
          </div>
        ) : schools ? (
          <SchoolsView overview={schools} />
        ) : null}
      </UsersWorkspace>
    </main>
  );
}
