"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Toast } from "@/components/status/Toast";
import { withNext } from "@/lib/account/shared";
import type { HackedStory, LinkPage, ShopSms } from "@/lib/lab/story";
import type { ClientItem, ClientScenario } from "@/lib/lab/client";
import { containsSecret, emptyState, taskProgress, type Folder, type SceneState } from "@/lib/lab/events";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import type { EndingCall, FailReason, LabDriver } from "../driver";
import { HackedAlarm } from "../hacked/HackedAlarm";
import { HackedScene } from "../hacked/HackedScene";
import { BrowserPage } from "../inbox/BrowserPage";
import { InboxScene } from "../inbox/InboxScene";
import { MessagingScene } from "../messaging/MessagingScene";
import { MissionCall } from "../mission/MissionCall";
import { useLabSession, type SessionProblem } from "../useLabSession";
import { LabBar } from "./LabBar";
import { PhoneFrame } from "./PhoneFrame";
import { ExitDialog, StartDialog } from "./StartDialog";
import { TaskAside, TaskSheet } from "./TaskPanel";

export type Resume = { attemptId: string; state: SceneState; nextSeq: number };

export type ScenarioPlayerProps = {
  driver: LabDriver;
  scenario: ClientScenario;
  /** Sayfanın çizdiği içerik sürümü; süren deneme başka sürümdeyse sayfa yenilenir. */
  version: number;
  avatar: string;
  resume: Resume | null;
  /** "Çık" ve bitmiş denemede dönülecek yer (lab sayfası ya da yönetimde düzenleme formu). */
  exitHref: string;
  /** "Tekrar dene" ve girişten sonra dönülecek yer. */
  playHref: string;
  /** Yönetim önizlemesi: rapor sayfaya gidilmeden yerinde açılır, "Tekrar dene" oynatıcıyı sıfırlar. */
  onReport?: () => void;
};

/** call: görevli odada başlangıç kartından önce velinin araması. */
type Phase = "call" | "intro" | "playing" | "hacked" | "scene";

/** Görevli odanın bitiş araması: iyi (odayı bitirince) ya da kötü (kodu sahte siteye yazınca). */
type Ending = { kind: "good"; call: EndingCall; reportPath: string } | { kind: "bad"; story: HackedStory };

/**
 * Senaryo labı oynatıcısı (Lab-Cerceve): üst şerit, uygulama penceresi (Postam ya da Mesajlar),
 * görev paneli, başlangıç ve çıkış pencereleri, hacklendin alarmı ve açıklaması. Doğru/yanlış
 * burada bilinmez: her eylem sürücüye gider, bağlantının ne açacağına, ele geçirilmeye ve rapora
 * sunucu (yönetim önizlemesinde tarayıcıdaki taslak) karar verir.
 */
export function ScenarioPlayer({ driver, scenario, version, avatar, resume, exitHref, playHref, onReport }: ScenarioPlayerProps) {
  const t = getMessages().lab;
  const router = useRouter();
  const session = useLabSession({
    driver,
    attemptId: resume?.attemptId ?? null,
    initialState: resume?.state ?? emptyState(),
    initialSeq: resume?.nextSeq ?? 0,
  });
  const mission = scenario.mission;
  // Önce perde ve "Başlamadan önce" (18. revize), görevli odada sonra velinin araması.
  const [phase, setPhase] = useState<Phase>(resume ? "playing" : "intro");
  // Görevli odada istek ve kart, arama kabul edilince (ya da yarım denemede hemen) panele yerleşir.
  const [missionShown, setMissionShown] = useState(!!resume);
  const [replay, setReplay] = useState(false);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [starting, setStarting] = useState(false);
  const [browser, setBrowser] = useState<{ item: ClientItem; page: LinkPage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [story, setStory] = useState<HackedStory | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<SessionProblem | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const { state } = session;
  const { template, items, tasks } = scenario;
  const progress = taskProgress(tasks, state, !!mission?.sale);
  const problem = failure ?? session.problem;
  const title = scenario.meta.title || scenario.meta.name;

  // Oturum düştüyse ya da e-posta doğrulanmamışsa ilgili sayfaya, dönüşte yine buraya.
  // Deneme başka yerde bittiyse ya da lab kaldırıldıysa kısa bir bildirimden sonra lab sayfasına.
  useEffect(() => {
    if (problem === "auth") window.location.assign(withNext(routes.signIn, playHref));
    else if (problem === "unverified") window.location.assign(withNext(routes.verify, playHref));
    else if (problem === "ended" || problem === "not_found") {
      const timer = window.setTimeout(() => router.replace(exitHref), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [problem, playHref, exitHref, router]);

  const problemText = problem ? problemMessage(problem) : null;

  function fail(reason: FailReason) {
    setFailure(reason);
  }

  function clearToast() {
    setNotice(null);
    setFailure(null);
    session.clearProblem();
  }

  async function start() {
    setStarting(true);
    let result: Awaited<ReturnType<LabDriver["start"]>>;
    try {
      result = await driver.start();
    } catch {
      setStarting(false);
      return setFailure("offline");
    }
    if (!result.ok) {
      setStarting(false);
      return fail(result.reason);
    }
    // Başka bir sekmede başka sürümle başlamış bir deneme var: o sürümle açılsın.
    if (result.version !== version) return window.location.reload();
    session.begin(result.attemptId);
    setPhase(mission ? "call" : "playing");
    setStarting(false);
  }

  function open(id: string) {
    session.track({ type: "item_opened", item: id });
  }

  function move(id: string, to: Folder) {
    session.track({ type: "item_moved", item: id, to });
  }

  function attachment(id: string) {
    session.track({ type: "attachment_opened", item: id });
  }

  async function openLink(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item?.link || busy) return;
    setBusy(true);
    const result = await session.immediate((attemptId, seq) => driver.openLink(attemptId, seq, id));
    setBusy(false);
    if (!result) return;
    if (!result.ok) return fail(result.reason);
    session.applyLocal({ type: "link_clicked", item: id });
    setBrowser({ item, page: result.page });
  }

  function hacked(next: HackedStory) {
    setBrowser(null);
    setStory(next);
    setPhase("hacked");
  }

  async function submitTrap() {
    if (!browser || busy) return;
    const id = browser.item.id;
    setBusy(true);
    const result = await session.immediate((attemptId, seq) => driver.submitTrap(attemptId, seq, id));
    setBusy(false);
    if (!result) return;
    if (!result.ok) return fail(result.reason);
    session.applyLocal({ type: "info_entered", item: id });
    hacked(result.hacked);
  }

  async function reply(id: string, text: string) {
    // Yazılan metin bu tarayıcıda kalır; sunucuya yalnızca kodun içinde olup olmadığı gider.
    const withSecret = containsSecret(text, scenario.secret);
    const result = await session.immediate((attemptId, seq) => driver.sendReply(attemptId, seq, id, withSecret));
    if (!result) return false;
    if (!result.ok) {
      fail(result.reason);
      return false;
    }
    session.applyLocal({ type: "reply_sent", item: id, secret: withSecret });
    if (result.hacked) hacked(result.hacked);
    return true;
  }

  function reviewDone() {
    session.track({ type: "review_done" });
    setNotice(t.frame.toasts.decision);
  }

  function answer(task: string, option: number) {
    session.track({ type: "answer", task, option });
    setNotice(t.frame.toasts.answer);
  }

  async function finish() {
    setFinishing(true);
    const result = await session.immediate((attemptId) => driver.finish(attemptId));
    if (!result || !result.ok) {
      setFinishing(false);
      if (result) fail(result.reason);
      return;
    }
    // Görevli odada iş doğru yerden yapıldıysa önce velinin teşekkür araması.
    if (result.call && result.call.lines.length > 0) return setEnding({ kind: "good", call: result.call, reportPath: result.reportPath });
    showReport(result.reportPath);
  }

  function showReport(reportPath: string) {
    if (onReport) onReport();
    else router.push(reportPath);
  }

  /** Görevli oda, mağazada "Öde": yalnızca "bilgi girildi" gider, veliye gelen SMS döner. */
  async function payShop(id: string): Promise<ShopSms | null> {
    const result = await session.immediate((attemptId, seq) => driver.payShop(attemptId, seq, id));
    if (!result) return null;
    if (!result.ok) {
      fail(result.reason);
      return null;
    }
    session.applyLocal({ type: "info_entered", item: id });
    return result.sms;
  }

  /** Onay kodu kararı. Sahte sitede yazınca kötü bitiş araması, ardından alarm. */
  async function answerCode(id: string, enter: boolean) {
    const result = await session.immediate((attemptId, seq) => driver.answerCode(attemptId, seq, id, enter));
    if (!result) return null;
    if (!result.ok) {
      fail(result.reason);
      return null;
    }
    session.applyLocal({ type: enter ? "code_entered" : "code_refused", item: id });
    if (result.hacked) {
      const story = result.hacked;
      if (story.call && story.call.lines.length > 0) {
        setBrowser(null);
        setEnding({ kind: "bad", story });
      } else hacked(story);
      return null;
    }
    setNotice(result.done ? t.mission.ordered : null);
    return { reply: result.reply, done: result.done };
  }

  /** Satış görevi: siparişi kargoya verir; hazırlamadan gönderdiyse alıcının mesajı döner. */
  async function shipOrder(id: string, prepared: boolean) {
    const result = await session.immediate((attemptId, seq) => driver.shipOrder(attemptId, seq, id, prepared));
    if (!result) return null;
    if (!result.ok) {
      fail(result.reason);
      return null;
    }
    session.applyLocal({ type: "item_shipped", item: id, prepared });
    setNotice(t.mission.shipped);
    return { reply: result.reply, done: result.done };
  }

  async function leave() {
    setLeaving(true);
    await session.flush();
    router.push(exitHref);
  }

  // Alarmdan sonra sonuç sahnesi (22. revize); "Devam" raporu açar. Açıklama ekranı kalktı (19).
  function showScene() {
    window.scrollTo(0, 0);
    setPhase("scene");
  }

  if (phase === "scene" && story) return <HackedScene story={story} avatar={avatar} onContinue={() => showReport(story.reportPath)} />;

  const panel = {
    template,
    tasks,
    done: progress.done,
    current: progress.current,
    finished: progress.finished,
    answers: state.answers,
    opened: state.opened.filter((id) => items.some((i) => i.id === id)).length,
    itemCount: items.length,
    finishing,
    onReviewDone: reviewDone,
    onAnswer: answer,
    onFinish: finish,
    footer: t.frame.footer[template],
    mission,
    missionShown,
    onReplay: () => setReplay(true),
  };

  const sceneProps = { items, state, avatar, onOpen: open, onMove: move, onAttachment: attachment, onLink: openLink };

  // Satış görevli odada sahne masaüstünde bir telefonun içinde açılır (PhoneFrame).
  const phone = template === "MESSAGING" && !!mission?.sale;
  const sceneBody = (
    <>
      {template === "INBOX" ? <InboxScene {...sceneProps} /> : <MessagingScene {...sceneProps} onReply={reply} phone={phone} />}
      {browser ? (
        <div className="absolute inset-0 z-20 [animation:fade-in_.2s_ease-out_both]">
          <BrowserPage
            app={template}
            page={browser.page}
            linkText={browser.item.link?.text ?? ""}
            busy={busy}
            onClose={() => setBrowser(null)}
            onSubmit={submitTrap}
            shop={
              mission
                ? {
                    mission,
                    onPay: () => payShop(browser.item.id),
                    onCode: (enter) => answerCode(browser.item.id, enter),
                    onShip: (prepared) => shipOrder(browser.item.id, prepared),
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className="flex flex-col max-lg:h-dvh max-lg:overflow-hidden"
      style={{ "--lab-height": "clamp(560px, calc(100dvh - 120px), 760px)" } as CSSProperties}
      data-testid="scenario-player"
    >
      <LabBar
        kicker={t.kindsUpper.SCENARIO}
        title={title}
        decisions={state.decisions}
        taskNo={Math.min(progress.current + 1, tasks.length)}
        total={tasks.length}
        done={progress.done}
        onExit={() => setExitOpen(true)}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 gap-5 lg:items-start lg:px-6 lg:pt-5 lg:pb-8">
        {phone ? (
          <PhoneFrame inert={phase === "intro" || phase === "call"}>{sceneBody}</PhoneFrame>
        ) : (
          <div
            inert={phase === "intro" || phase === "call"}
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-scene-white lg:h-[var(--lab-height)] lg:rounded-2xl lg:border lg:border-scene-line-strong lg:shadow-card"
          >
            {sceneBody}
          </div>
        )}
        <TaskAside {...panel} />
      </main>

      <div inert={phase === "intro" || phase === "call"} className="flex-none lg:hidden">
        <TaskSheet {...panel} />
      </div>

      {mission && (phase === "call" || replay) ? (
        <MissionCall
          key={replay ? "replay" : "intro"}
          caller={mission.caller}
          look={mission.look}
          lines={mission.lines}
          voice={mission.voice}
          sheet={{
            kicker: t.call.taskKicker,
            title: mission.title,
            points: mission.points,
            pointIcons: mission.pointIcons,
            button: mission.accept,
            onButton: () => {
              setMissionShown(true);
              if (replay) setReplay(false);
              else setPhase("playing");
            },
          }}
        />
      ) : null}
      {mission && ending?.kind === "good" ? (
        <MissionCall
          caller={ending.call.caller}
          look={mission.look}
          lines={ending.call.lines}
          voice={ending.call.voice}
          autoAnswer
          confetti
          sheet={{ kicker: t.call.goodKicker, title: ending.call.title, button: t.call.report, alt: true, onButton: () => showReport(ending.reportPath) }}
        />
      ) : null}
      {mission && ending?.kind === "bad" ? (
        <MissionCall
          caller={ending.story.call?.caller ?? mission.caller}
          look={mission.look}
          lines={ending.story.call?.lines ?? []}
          voice={ending.story.call?.voice}
          tone="red"
          autoAnswer
          shake
          onLinesDone={() => {
            const story = ending.story;
            setEnding(null);
            hacked(story);
          }}
        />
      ) : null}
      {phase === "intro" ? <StartDialog name={title} template={template} starting={starting} onStart={start} /> : null}
      <ExitDialog open={exitOpen} leaving={leaving} onStay={() => setExitOpen(false)} onLeave={leave} />
      {phase === "hacked" && story ? <HackedAlarm kind={story.kind} account={story.account} avatar={avatar} contact={story.contact} alarm={story.alarm} onDone={showScene} /> : null}
      <Toast message={problemText ?? notice} onClose={clearToast} className="max-lg:bottom-[84px]" />
    </div>
  );
}

function problemMessage(problem: SessionProblem) {
  const t = getMessages().lab.frame.toasts;
  switch (problem) {
    case "offline":
      return t.offline;
    case "ended":
      return t.ended;
    case "locked":
      return t.locked;
    case "auth":
    case "unverified":
      return null;
    default:
      return t.error;
  }
}
