import Link from "next/link";
import { ArrowRight, ChevronRight, CircleCheck, Link2, PenLine, Play, UserPlus } from "lucide-react";
import { RoomArt } from "@/components/lab/RoomArt";
import { NeighborhoodIcon, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { brand } from "@/lib/brand";
import { format, getMessages, rich } from "@/lib/i18n";
import type { LabDifficulty } from "@/lib/lab/route";
import { paragraphsOf, type ArticleContent } from "@/lib/news/content";
import type { CoverView } from "@/lib/news/cover";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";
import { LabSignUpButton } from "./LabSignUpButton";
import { LeaveSiteButton } from "./LeaveSiteButton";
import { ReportBox } from "./ReportBox";
import { TopicChip, TopicDot } from "./TopicChip";

/** Haberin konusu (mahalle): etiket konunun adıyla, lab kutusu mahallenin adıyla yazılır. */
export type ArticleTopicView = { name: string; topic: string; color: string; icon: string };

/** "Bunu odada dene" kutusundaki lab (yalnızca yayındaki lab). */
export type ArticleLabView = {
  name: string;
  href: string;
  district: string;
  difficulty: LabDifficulty;
  durationMin: number;
  icon: string;
  color: string;
  /** Odanın çizimi (lib/lab/art.ts); yoksa mahallenin ikonu. */
  art: string | null;
  /** Öğrenci bu labı bitirdi mi (ziyaretçide hep false). */
  done: boolean;
};

export type ArticleViewData = {
  title: string;
  summary: string;
  /** "9 Ekim 2026" */
  date: string;
  minutes: number;
  topic: ArticleTopicView | null;
  content: ArticleContent;
  sourceName: string;
  /** Güvenilir listedeki https adres; değilse null ("Kaynağa git" çizilmez). */
  sourceUrl: string | null;
  lab: ArticleLabView | null;
  cover: CoverView | null;
};

export type OtherArticleView = { slug: string; title: string; day: string; topic: ArticleTopicView | null; cover: CoverView | null };

/** Bölüm başlıklarının numara rengi: Ne oluyor? camgöbeği, Nasıl anlarsın? kırmızı, Ne yapmalısın? yeşil. */
const sectionTone = ["bg-accent/18 text-accent-fg", "bg-danger/18 text-danger-fg", "bg-success/18 text-success-fg"] as const;

/**
 * Haber sayfası, tasarım A "Dergi" (4 Kasım, Murat; Tur 8 Gündem tuvali): tam genişlikte kapak,
 * ortada başlık ve özet, altında üç "Kısaca" kartı; metin 700 px'lik orta sütunda (Ne oluyor?,
 * Nasıl anlarsın?, Ne yapmalısın?). Örnek mesaj ortada bir telefonda, altında üç işaret. Sonda
 * "Bunu odada dene", kaynak ve "Nereye bildirilir"; en altta diğer haberler. Yönetimdeki önizleme
 * de bu bileşeni çizer: düzen kutu genişliğine göre değişir (container query), önizlemedeki 390 px
 * çerçevede telefon düzeni görünür. Bütün metin düz yazıdır; bağlantı yalnızca denetlenmiş kaynak
 * adresinden olur.
 */
export function ArticleView({ article, member, others }: { article: ArticleViewData; member: boolean; others: OtherArticleView[] }) {
  const t = getMessages();
  const a = t.news.article;
  const c = article.content;
  const takeaways = c.takeaways.filter((x) => x.trim() !== "");
  const column = "mx-auto flex w-full max-w-[700px] flex-col gap-[18px]";

  return (
    <div className="@container">
      <div className="flex flex-col gap-10 @3xl:gap-12">
        <article className="flex flex-col gap-[22px]">
          <nav aria-label={a.breadcrumb} className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-3">
            {/* Dokunma alanı 40 px; eksi kenar boşluğu satırın yüksekliğini değiştirmez. */}
            <Link href={routes.news} className="-my-2.5 inline-flex min-h-10 items-center text-fg-3 no-underline hover:text-fg">
              {t.nav.links.news}
            </Link>
            <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
            <span aria-current="page">{article.topic?.topic ?? article.title}</span>
          </nav>

          <CoverImage
            cover={article.cover}
            topic={article.topic}
            credit
            priority
            className="aspect-[16/9] w-full max-w-full rounded-[20px] border border-card @3xl:aspect-[21/9]"
            glyphClassName="@3xl:right-[10%]"
          />

          <header className="mx-auto flex max-w-[820px] flex-col items-center gap-3 text-center">
            {article.topic ? <TopicChip name={article.topic.topic} color={article.topic.color} /> : null}
            <h1 className="m-0 font-heading text-[30px] leading-[1.12] font-bold text-balance break-words @3xl:text-[44px]">{article.title}</h1>
            <p className="m-0 text-[17px] leading-[1.55] text-fg-2 @3xl:text-xl">{article.summary}</p>
            <span className="flex items-center gap-2.5 text-[13px] text-fg-3">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-card">
                <PenLine className="size-3.5 text-fg-2" strokeWidth={2} aria-hidden="true" />
              </span>
              {format(a.byline, { brand: brand.name, date: article.date, minutes: article.minutes })}
            </span>
          </header>

          <div className={column}>
            {takeaways.length > 0 ? (
              <section aria-label={a.takeaways} className="grid grid-cols-1 gap-2.5 @3xl:grid-cols-3">
                {takeaways.map((item, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-2xl border border-orange/35 bg-orange/7 p-3.5 text-[14.5px] leading-normal break-words text-fg-2">
                    <span className="font-heading text-xs font-bold tracking-[1px] text-orange-fg">{format(a.takeawayN, { n: i + 1 })}</span>
                    {item}
                  </div>
                ))}
              </section>
            ) : null}

            <SectionHeading n={1}>{a.whatsHappening}</SectionHeading>
            {paragraphsOf(c.whatsHappening).map((p, i) => (
              <p key={i} className="m-0 text-base leading-[1.75] break-words text-fg-2 @3xl:text-lg">
                {p}
              </p>
            ))}

            <SectionHeading n={2}>{a.howToTell}</SectionHeading>
            <p className="m-0 text-base leading-[1.7] text-fg-2 @3xl:text-lg">{c.example ? a.signsWithExample : a.signsPlain}</p>
          </div>

          <div className="flex flex-col items-center gap-[18px] rounded-[22px] bg-[radial-gradient(70%_90%_at_50%_0%,color-mix(in_oklab,var(--danger)_14%,transparent),transparent_70%)] px-0 py-[22px] @3xl:px-4">
            {c.example ? <ExamplePhone sender={c.example.sender} text={c.example.text} /> : null}
            <ol className="m-0 grid w-full max-w-[900px] list-none grid-cols-1 gap-2.5 p-0 @3xl:grid-cols-3">
              {c.signs.map((s, i) => (
                <li key={i} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4">
                  <span aria-hidden="true" className="flex size-7 flex-none items-center justify-center rounded-full bg-danger text-sm font-bold text-on-danger">
                    {i + 1}
                  </span>
                  <b className="text-[15px] leading-snug break-words text-fg @3xl:text-base">{s.sign}</b>
                  <span className="text-sm leading-[1.55] break-words text-fg-2">{s.explanation}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={column}>
            <SectionHeading n={3}>{a.whatToDo}</SectionHeading>
            <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 @3xl:grid-cols-2">
              {c.actions.map((item, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5 text-[15px] leading-[1.55] break-words text-fg-2">
                  <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-success/16 text-success-fg">
                    <CircleCheck className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 self-center">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={column}>
            {article.lab ? <LabBox lab={article.lab} member={member} /> : null}
            <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-2">
              <SourceBox name={article.sourceName} url={article.sourceUrl} />
              <ReportBox />
            </div>
          </div>
        </article>

        {others.length > 0 ? (
          <section aria-labelledby="article-others" className="flex flex-col gap-3.5 border-t border-line pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="article-others" className="m-0 font-heading text-[21px] font-bold @3xl:text-[26px]">
                {a.others}
              </h2>
              <Link href={routes.news} className="inline-flex items-center gap-1.5 font-bold text-accent-fg no-underline hover:underline">
                {a.allNews}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 @3xl:grid-cols-3">
              {others.map((other) => (
                <li key={other.slug} className="flex">
                  <Link
                    href={paths.article(other.slug)}
                    className="flex flex-1 items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 text-fg no-underline transition-[transform,border-color] hover:-translate-y-0.5 hover:border-accent"
                  >
                    <CoverImage cover={other.cover ? { ...other.cover, alt: "" } : null} topic={other.topic} className="size-[72px] flex-none rounded-xl" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", other.topic ? toneOf(other.topic.color).text : "text-fg-3")}>
                        {other.topic ? <TopicDot color={other.topic.color} className="size-[7px]" /> : null}
                        {other.topic ? `${other.topic.topic} · ` : null}
                        <span className="font-medium text-fg-3">{other.day}</span>
                      </span>
                      <span className="font-heading text-[15px] leading-tight font-bold break-words">{other.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({ n, children }: { n: 1 | 2 | 3; children: string }) {
  return (
    <h2 className="m-0 mt-2 flex items-center gap-3 font-heading text-[21px] leading-tight font-bold @3xl:text-[26px]">
      <span aria-hidden="true" className={cn("flex size-8 flex-none items-center justify-center rounded-[10px] text-base", sectionTone[n - 1])}>
        {n}
      </span>
      {children}
    </h2>
  );
}

/** Haberdeki örnek mesaj: telefon ekranında tek bir balon. */
function ExamplePhone({ sender, text }: { sender: string; text: string }) {
  const t = getMessages().news.article;
  const name = sender.trim() || t.unknownSender;
  return (
    <figure
      aria-label={t.exampleLabel}
      className="m-0 flex w-[340px] max-w-full flex-col gap-2.5 rounded-[28px] border-[6px] border-scene-phone-edge bg-scene-paper px-3 pt-3.5 pb-[18px] text-scene-ink"
    >
      <figcaption className="flex flex-col items-center gap-0.5">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-scene-ink-muted font-bold text-scene-white">
          {(Array.from(name)[0] ?? "").toLocaleUpperCase("tr-TR")}
        </span>
        <span className="max-w-full truncate text-[13px] font-bold">{name}</span>
        <span className="text-[11px] text-scene-ink-muted">{t.exampleKind}</span>
      </figcaption>
      <p className="m-0 max-w-[88%] rounded-[16px_16px_16px_4px] bg-scene-white px-3 py-2.5 text-sm leading-normal break-words whitespace-pre-line">{text}</p>
    </figure>
  );
}

/** "Bunu odada dene": odanın çizimi solda; ziyaretçide kayıt penceresi, öğrencide "Odaya gir". */
function LabBox({ lab, member }: { lab: ArticleLabView; member: boolean }) {
  const t = getMessages();
  const a = t.news.article;
  const button = "flex h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-accent text-[15px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110 @3xl:w-auto @3xl:self-start @3xl:px-5";
  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-[18px] border border-accent/45 bg-surface bg-[radial-gradient(80%_140%_at_0%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_60%)] @3xl:grid-cols-[260px_minmax(0,1fr)]">
      <span className="relative flex aspect-[2/1] items-center justify-center bg-surface-deep @3xl:aspect-auto @3xl:h-full">
        {lab.art ? (
          <RoomArt src={lab.art} className="absolute inset-0 size-full" />
        ) : (
          <NeighborhoodIcon icon={lab.icon} color={lab.color} className="size-16" iconClassName="size-8" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-2.5 p-[18px]">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold tracking-[2px] text-accent-fg">{a.practice}</span>
          {member && lab.done ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-success-fg">
              <CircleCheck className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              {a.labDone}
            </span>
          ) : null}
        </span>
        <span className="font-heading text-lg leading-tight font-bold break-words">{lab.name}</span>
        <span className="text-[13px] text-fg-3">
          {format(a.labMeta, { district: lab.district, difficulty: t.lab.difficulty[lab.difficulty], minutes: lab.durationMin })}
        </span>
        {member ? (
          <Link href={lab.href} className={button}>
            <Play className="size-4" strokeWidth={2.4} aria-hidden="true" />
            {a.startLab}
          </Link>
        ) : (
          <LabSignUpButton target={{ name: lab.name, href: lab.href, icon: lab.icon, color: lab.color }} className={button}>
            <UserPlus className="size-4" strokeWidth={2.4} aria-hidden="true" />
            {a.signUpAndTry}
          </LabSignUpButton>
        )}
      </span>
    </section>
  );
}

/** Kaynak kutusu: kaynağın adı ve "Kaynağa git" (önce "ayrılıyorsun" penceresi). */
function SourceBox({ name, url }: { name: string; url: string | null }) {
  const a = getMessages().news.article;
  if (!name.trim() && !url) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5">
      <Link2 className="size-[18px] flex-none text-fg-3" strokeWidth={2} aria-hidden="true" />
      <p className="m-0 min-w-0 flex-[1_1_220px] text-sm leading-normal text-fg-2">
        {rich(a.source, { b: () => <b className="text-fg">{name}</b> })}
      </p>
      {url ? <LeaveSiteButton href={url} /> : null}
    </section>
  );
}
