"use client";

import { FileText, Mail, Shield } from "lucide-react";
import { useState } from "react";
import { format, getMessages } from "@/lib/i18n";
import { endorseApplication, notRecognizeApplication, remindTeacher, undoSchoolDecision, type SchoolActionError } from "@/lib/teacher/school-actions";
import { BulletinCard } from "./BulletinCard";
import { copyText, InviteButton, InviteCard } from "./InviteLink";
import { PrivacyBox } from "./PrivacyBox";
import { RequestsCard } from "./RequestsCard";
import { nextToast, SchoolToast, type SchoolToastData } from "./SchoolToast";
import { TeacherDrawer } from "./TeacherDrawer";
import { TeacherList } from "./TeacherList";
import type { SchoolRequest, SchoolTeacher, SchoolView as SchoolViewData } from "./types";

const secondaryButton =
  "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface font-[inherit] text-[15px] font-bold text-fg no-underline transition-colors hover:border-accent";

/**
 * Okulum (Okulum-O4-Bulten, -Mobil): okul sorumlusunun haftalık okul bülteni. Masaüstünde solda
 * bülten, sağda talepler, öğretmenler ve davet; telefonda hepsi alt alta. Kararlar ve hatırlatma
 * sunucu eylemleriyle (lib/teacher/school-actions.ts); her kararın 5 saniyelik "Geri al"ı var.
 * Sayfa öğrenci adı, puanı ya da raporu hiç almaz (components/school/types.ts).
 */
export function SchoolView({ view }: { view: SchoolViewData }) {
  const t = getMessages().school;
  const [toast, setToast] = useState<SchoolToastData | null>(null);
  const [openTeacher, setOpenTeacher] = useState<string | null>(null);
  const teacher = view.teachers.find((x) => x.id === openTeacher) ?? null;

  const say = (message: string, extra: Omit<SchoolToastData, "id" | "message"> = {}) => setToast(nextToast({ message, ...extra }));
  const sayError = (error: SchoolActionError) => say(t.errors[error], { tone: "error" });

  async function undo(request: SchoolRequest) {
    const result = await undoSchoolDecision(request.id);
    if (result.ok) say(t.requests.toast.undone);
    else sayError(result.error);
  }

  async function endorse(request: SchoolRequest) {
    const result = await endorseApplication(request.id);
    if (!result.ok) return sayError(result.error);
    say(format(result.approved ? t.requests.toast.approved : t.requests.toast.endorsed, { name: result.name }), { undo: () => void undo(request) });
  }

  async function notRecognize(request: SchoolRequest) {
    const result = await notRecognizeApplication(request.id);
    if (!result.ok) return sayError(result.error);
    say(format(t.requests.toast.notRecognized, { name: result.name }), { undo: () => void undo(request) });
  }

  async function remind(target: SchoolTeacher) {
    const result = await remindTeacher(target.id);
    if (!result.ok) return sayError(result.error);
    say(format(t.reminderSent, { name: result.name, what: t.reminderWhat[result.kind] }));
  }

  async function copyInvite() {
    const copied = await copyText(view.inviteUrl);
    say(copied ? t.invite.copied : t.invite.copyFailed, copied ? {} : { tone: "error" });
  }

  function printBulletin() {
    say(t.pdfHint);
    // Yazdırma penceresi sayfayı dondurur; önce bildirim görünsün.
    window.setTimeout(() => window.print(), 250);
  }

  // Çekmece açıkken bildirim onun içinde çizilir: açık <dialog> sayfanın geri kalanının üstündedir.
  const toastBox = <SchoolToast toast={toast} onClose={() => setToast(null)} />;
  const place = format(t.place, { province: view.school.province, district: view.school.district });

  return (
    <div className="relative mx-auto max-w-[1200px] px-4 pt-4 pb-10 lg:px-6 lg:pt-9 lg:pb-[72px] print:max-w-none print:p-0">
      <div className="flex flex-col gap-3.5 lg:gap-[22px]">
        <div className="flex flex-wrap items-start justify-between gap-4 lg:items-end print:hidden">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[2px] text-warning-fg">
              <Shield className="size-[15px]" strokeWidth={2} aria-hidden="true" />
              {t.eyebrow}
            </span>
            <h1 className="m-0 font-heading text-[28px] leading-[1.1] font-bold lg:text-[40px]">{view.school.name}</h1>
            <p className="m-0 text-sm leading-[1.55] text-fg-2 lg:text-base">
              {format(t.subtitle, { place, me: view.meTeacher ? t.meTeacher : t.meOnly })}
            </p>
          </div>
          <InviteButton onCopy={copyInvite} className="max-lg:hidden" />
        </div>

        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6 print:block">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div role="group" aria-label={t.actionsLabel} className="flex flex-wrap gap-2.5 print:hidden">
              <a
                href={view.mailto}
                onClick={() => say(t.principal.opening)}
                className="inline-flex h-12 flex-[1_1_200px] items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
              >
                <Mail className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                {t.sendPrincipal}
              </a>
              <button type="button" onClick={printBulletin} className={`${secondaryButton} flex-[1_1_160px]`}>
                <FileText className="size-[17px] text-fg-2" strokeWidth={2} aria-hidden="true" />
                {t.pdf}
              </button>
            </div>
            <BulletinCard bulletin={view.bulletin} schoolName={view.school.name} />
          </div>

          <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4 print:hidden">
            <RequestsCard
              requests={view.requests}
              handled={view.handled}
              coordinatorApproves={view.school.coordinatorApproves}
              onEndorse={endorse}
              onNotRecognize={notRecognize}
            />
            <TeacherList teachers={view.teachers} onOpen={setOpenTeacher} />
            <InviteCard url={view.inviteUrl} onCopy={copyInvite} />
            <PrivacyBox />
          </div>
        </div>
      </div>

      <TeacherDrawer teacher={teacher} onClose={() => setOpenTeacher(null)} onRemind={remind}>
        {teacher ? toastBox : null}
      </TeacherDrawer>
      {teacher ? null : toastBox}
    </div>
  );
}
