import { Check, EyeOff, Lock } from "lucide-react";
import { brand } from "@/lib/brand";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// "İki ekran, bir ders" çizimleri (Ogretmen-Tanitim-Son). Gerçek ekranların sade, örnek verili
// kopyaları; hiçbir veri okunmaz. Adlar ve sayılar tahtadaki örneklerdir.

const t = getMessages().teachersPage.tour;

/** Her adımda içerik hafifçe yukarı kayarak gelir, telefon biraz sonra ("Hareketi azalt"ta hareket yok). */
const stepIn = "animate-[fade-up_0.35s_ease-out_both]";
const phoneIn = "animate-[fade-up_0.35s_ease-out_0.15s_both]";
/** Adımın asıl olayı (öğrenci katıldı, ödev bandı, kutu doldu) içerikten biraz sonra belirir. */
const popLate = "animate-[pop_0.25s_ease-out_0.5s_both]";

/** Mahalle satırlarının renkleri (Hesap Kalesi, Oltalama Limanı, Zararlı Yazılım Ormanı). */
const districtDots = ["bg-success", "bg-accent", "bg-purple"];

/** Ödev tablosu: öğrenci × lab. Ayşe'nin ilk kutusu "oda biter" adımında dolar. */
const matrix = [
  [false, false, false, false],
  [true, true, false, false],
  [true, true, true, true],
  [true, false, false, false],
];

function SampleBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-warning/14 px-2 text-[10px] font-extrabold tracking-[1px] text-warning-fg">
      {t.sample}
    </span>
  );
}

export function ScreenLabel({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2 text-[11px] font-bold tracking-[1.5px] text-fg-3 lg:text-xs">
      {children}
      <SampleBadge />
    </span>
  );
}

function CodeBoxes({ size }: { size: "board" | "phone" }) {
  return (
    <span className={cn("flex", size === "board" ? "gap-[5px]" : "gap-1")}>
      {t.code.split("").map((char, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center justify-center font-mono font-bold text-accent-fg",
            size === "board"
              ? "h-[46px] w-[34px] rounded-lg border border-line bg-surface text-2xl"
              : "h-[34px] flex-1 rounded-lg border border-accent bg-surface text-base",
          )}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

function Cell({ done, fresh = false }: { done: boolean; fresh?: boolean }) {
  return (
    <span className="flex justify-center">
      {done ? (
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-md border-[1.5px] border-accent/40 bg-accent/18",
            fresh && popLate,
          )}
        >
          <Check className="size-[11px] text-accent-fg" strokeWidth={2.8} />
        </span>
      ) : (
        <span className="size-5 rounded-md border-[1.5px] border-dashed border-line" />
      )}
    </span>
  );
}

/** Öğretmenin ekranı: adıma göre kod, ödev, tablo ya da sınıfın toplamı. */
export function TeacherScreen({ step }: { step: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-deep shadow-card lg:flex-1">
      <div className="flex items-center gap-1.5 border-b border-card bg-surface-raised px-3 py-2.5">
        <span className="size-[9px] rounded-full bg-danger" />
        <span className="size-[9px] rounded-full bg-warning" />
        <span className="size-[9px] rounded-full bg-success" />
        <span className="ml-2 text-xs text-fg-4">{t.teacherName}</span>
      </div>
      <div className="flex min-h-[236px] flex-1 flex-col justify-center p-3 lg:min-h-[250px] lg:p-4">
        {step === 0 ? (
          <div key="code" className={cn("flex flex-col items-center gap-3 py-2", stepIn)}>
            <div className="flex flex-col items-center gap-2 rounded-[14px] bg-surface-raised p-3.5">
              <span className="text-[10px] font-bold tracking-[2px] text-fg-3">{t.join}</span>
              <CodeBoxes size="board" />
            </div>
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold text-success-fg", popLate)}>
              <span className="size-2 rounded-full bg-success" />
              {t.joined}
            </span>
          </div>
        ) : null}

        {step === 1 ? (
          <div key="assign" className={cn("flex flex-col gap-2", stepIn)}>
            {t.districts.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] border-[1.5px] px-3 py-[9px]",
                  i === 1 ? "border-accent bg-accent/8" : "border-line",
                )}
              >
                <span className={cn("size-[9px] rounded-full", districtDots[i])} />
                <b className="flex-1 text-[13px]">{name}</b>
                {i === 1 ? (
                  <span className={cn("rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent", popLate)}>
                    {t.assigned}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div key="table" className={cn("flex flex-col gap-2.5", stepIn)}>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold tracking-[1px] text-fg-3">{t.homework}</span>
              <b className="text-[13px]">{t.homeworkDistrict}</b>
              <span className="h-1.5 flex-1 rounded-full bg-card">
                <span className="anim-bar-in block h-full w-[62%] rounded-full bg-accent" />
              </span>
              <b className="text-[13px]">{t.homeworkDone}</b>
            </div>
            <div className="grid grid-cols-[78px_repeat(4,minmax(0,1fr))] items-end gap-1 border-b border-line pb-1.5">
              <span />
              {t.labs.map((lab) => (
                <span key={lab} className="text-center text-[9px] leading-[1.2] font-bold text-fg-3">
                  {lab}
                </span>
              ))}
            </div>
            {t.students.map((name, row) => (
              <div key={name} className="grid grid-cols-[78px_repeat(4,minmax(0,1fr))] items-center gap-1 border-b border-card py-[5px] last:border-b-0">
                <span className="truncate text-[11px] font-bold">{name}</span>
                {matrix[row].map((done, col) => (
                  <Cell key={col} done={done || (row === 0 && col === 0)} fresh={row === 0 && col === 0} />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div key="summary" className={cn("flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5", stepIn)}>
            <span className="text-[10px] font-bold tracking-[1.5px] text-fg-3">{t.summary.label}</span>
            {t.summary.rows.map((row) => (
              <div key={row.lab} className="flex flex-col gap-0.5 border-b border-card pb-2 last:border-b-0 last:pb-0">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="text-[13px]">{row.lab}</b>
                  <span className="flex-none text-[11px] text-fg-3">{row.done}</span>
                </span>
                <span className="text-[11px] leading-[1.45]">
                  <span className="text-fg-3">{t.summary.noticed}</span>
                  <span className="text-success-fg">{row.first}</span>
                  <span className="mx-1 text-fg-4">·</span>
                  <span className="text-success-fg">{row.last}</span>
                </span>
              </div>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-4">
              <EyeOff className="size-3" strokeWidth={2} />
              {t.summary.note}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Öğrencinin telefonu: adıma göre sınıfa katılma, ödev kutusu, lab sonucu, sıradaki lab. */
export function StudentPhone({ step }: { step: number }) {
  const p = t.phone;
  return (
    <div className="h-[380px] w-[200px] flex-none rounded-[34px] border border-line bg-scene-phone-edge p-2.5 shadow-card lg:h-[430px] lg:w-[230px]">
      <div className="flex h-full flex-col overflow-hidden rounded-[26px] bg-canvas text-fg">
        <div className="flex flex-none items-center justify-between px-3.5 pt-3 pb-2 text-[11px] text-fg-3">
          <b className="text-fg">{brand.name}</b>
          <span>{p.user}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-3.5 py-2">
          {step === 0 ? (
            <div key="join" className={cn("flex flex-col gap-2.5", phoneIn)}>
              <b className="text-sm">{p.joinTitle}</b>
              <CodeBoxes size="phone" />
              <span className="flex h-9 items-center justify-center rounded-[10px] bg-accent text-[13px] font-bold text-on-accent">{p.joinButton}</span>
            </div>
          ) : null}

          {step === 1 ? (
            <div key="homework" className={phoneIn}>
              <div className="anim-pop flex flex-col gap-2 rounded-[14px] border border-accent/45 bg-surface bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_60%)] p-3">
                <span className="text-[10px] font-bold tracking-[1px] text-accent-light">{p.homeworkLabel}</span>
                <b className="text-[15px]">{t.homeworkDistrict}</b>
                <span className="text-[11px] text-fg-3">{p.homeworkDue}</span>
                <span className="flex h-8 items-center justify-center rounded-[9px] bg-accent px-2 text-center text-xs font-bold text-on-accent">{p.homeworkStart}</span>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div key="done" className={cn("flex flex-col items-center gap-2 px-2 py-3.5 text-center", phoneIn)}>
              <span className="anim-pop flex size-[52px] items-center justify-center rounded-full bg-success/16">
                <Check className="size-[26px] text-success-fg" strokeWidth={2.6} />
              </span>
              <b className="text-[15px]">{p.safe}</b>
              <span className="text-[11px] text-fg-3">{p.points}</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-fg-4">
                <Lock className="size-[11px]" strokeWidth={2} />
                {p.private}
              </span>
            </div>
          ) : null}

          {step === 3 ? (
            <div key="next" className={cn("flex flex-col gap-2", phoneIn)}>
              <span className="text-[11px] text-fg-3">{p.nextLabel}</span>
              <div className="flex flex-col rounded-xl border border-line bg-surface p-2.5">
                <b className="text-[13px]">{p.nextLab}</b>
                <span className="text-[11px] text-fg-3">{p.nextMeta}</span>
              </div>
              <span className="text-[11px] leading-[1.45] text-fg-3">{p.nextText}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
