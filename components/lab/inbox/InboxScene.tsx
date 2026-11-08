"use client";

import {
  ArrowLeft,
  CornerUpLeft,
  Flag,
  Inbox,
  Mail,
  Paperclip,
  Search,
  Send,
  Share,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { ClientItem } from "@/lib/lab/client";
import { paragraphs } from "@/lib/lab/content";
import { folderOf, type Folder, type SceneState } from "@/lib/lab/events";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { FolderBanner, RichLine, SceneConfirm, SceneToast, SenderAvatar, useLinkPeek } from "../scene/parts";

type Props = {
  items: ClientItem[];
  state: SceneState;
  avatar: string;
  onOpen: (id: string) => void;
  onMove: (id: string, to: Folder) => void;
  onAttachment: (id: string) => void;
  onLink: (id: string) => void;
};

const folderIcons: Record<Folder, LucideIcon> = { inbox: Inbox, spam: TriangleAlert, trash: Trash2 };

/** Postam'ın logosu: kurgusal mail uygulaması (gerçek marka yok). */
export function PostamLogo({ className }: { className?: string }) {
  const t = getMessages().lab.inbox;
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-bold tracking-[-0.3px] text-scene-ink", className)}>
      <span aria-hidden="true" className="relative flex size-6 items-center justify-center rounded-md bg-scene-orange text-scene-white">
        <Mail className="size-4" strokeWidth={2.2} />
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full border-[1.5px] border-scene-orange bg-scene-amber-line" />
      </span>
      {t.app}
    </span>
  );
}

/**
 * Postam gelen kutusu sahnesi (Lab-Cerceve-Masaustu, Lab-Cerceve-Mobil-1/2). Masaüstünde üç
 * sütun: klasörler, liste, okuma alanı. Telefonda liste ve mail ayrı görünümler. Hiçbir maile
 * "sahte" ya da "gerçek" denmez; öğrencinin yaptığı her şey olay olarak oynatıcıya gider.
 */
export function InboxScene({ items, state, avatar, onOpen, onMove, onAttachment, onLink }: Props) {
  const t = getMessages().lab.inbox;
  const [box, setBox] = useState<Folder>("inbox");
  const [selected, setSelected] = useState<string | null>(null);
  // Telefonda liste mi, mail mi açık.
  const [view, setView] = useState<"list" | "item">("list");
  const [confirm, setConfirm] = useState<"spam" | "trash" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);

  const inFolder = (folder: Folder) => items.filter((item) => folderOf(state, item.id) === folder);
  const shown = inFolder(box);
  const current = items.find((item) => item.id === selected && folderOf(state, item.id) === box) ?? null;

  function open(id: string) {
    setSelected(id);
    setView("item");
    setPeek(null);
    if (!state.opened.includes(id)) onOpen(id);
  }

  function goFolder(folder: Folder) {
    setBox(folder);
    setSelected(null);
    setView("list");
    setConfirm(null);
  }

  function move(to: Folder) {
    if (!current) return;
    const rest = shown.filter((item) => item.id !== current.id);
    onMove(current.id, to);
    setConfirm(null);
    setToast(t.toasts[to]);
    // Masaüstünde sıradaki mail açılır, telefonda listeye dönülür.
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    setSelected(desktop ? (rest[0]?.id ?? null) : null);
    if (desktop && rest[0] && !state.opened.includes(rest[0].id)) onOpen(rest[0].id);
    setView("list");
  }

  const folderList = (["inbox", "spam", "trash"] as const).map((folder) => ({ folder, count: inFolder(folder).length }));

  return (
    <div className="relative flex h-full flex-col bg-scene-white font-sans text-scene-ink">
      {/* Üst şerit */}
      <div className="flex flex-none items-center gap-4 border-b border-scene-line bg-scene-paper px-3.5 py-2.5">
        <PostamLogo />
        <div className="hidden h-[38px] max-w-[420px] flex-1 items-center gap-2 rounded-[10px] border border-scene-line bg-scene-white px-3 text-sm text-scene-ink-faint lg:flex">
          <Search className="size-4" strokeWidth={2} aria-hidden="true" />
          {t.search}
        </div>
        <span className="ml-auto flex items-center gap-2 text-[13px] text-scene-ink-3">
          <Search className="size-5 text-scene-ink-2 lg:hidden" strokeWidth={2} aria-hidden="true" />
          <span className="hidden lg:inline">{t.account}</span>
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-scene-line text-lg">
            {avatar}
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Klasörler (masaüstü) */}
        <nav aria-label={t.folderNav} className="hidden w-[190px] flex-none flex-col gap-1 border-r border-scene-line p-3 lg:flex">
          <button
            type="button"
            onClick={() => setToast(t.toasts.compose)}
            className="mb-2 flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-scene-orange text-sm font-bold text-scene-white"
          >
            {t.compose}
          </button>
          <FolderButton folder="inbox" count={folderList[0].count} active={box === "inbox"} onClick={() => goFolder("inbox")} strong />
          <button type="button" onClick={() => setToast(t.toasts.unused)} className={mutedFolderClass}>
            <Star className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
            <span className="flex-1">{t.folders.starred}</span>
          </button>
          <button type="button" onClick={() => setToast(t.toasts.unused)} className={mutedFolderClass}>
            <Send className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
            <span className="flex-1">{t.folders.sent}</span>
          </button>
          <FolderButton folder="spam" count={folderList[1].count} active={box === "spam"} onClick={() => goFolder("spam")} />
          <FolderButton folder="trash" count={folderList[2].count} active={box === "trash"} onClick={() => goFolder("trash")} />
        </nav>

        {/* Liste */}
        <div className={cn("min-w-0 flex-1 overflow-y-auto border-scene-line lg:w-[290px] lg:flex-none lg:border-r", view === "item" && "max-lg:hidden")}>
          <div className="px-4 pt-4 pb-3 lg:hidden">
            <h2 className="text-[22px] font-bold">{t.folders[box]}</h2>
            <div className="mt-3 flex gap-2" role="group" aria-label={t.folderNav}>
              {folderList.map(({ folder, count }) => (
                <button
                  key={folder}
                  type="button"
                  aria-pressed={box === folder}
                  onClick={() => goFolder(folder)}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold",
                    box === folder ? "border-scene-orange-line bg-scene-orange-tint text-scene-orange-ink" : "border-scene-line bg-scene-white text-scene-ink-2",
                  )}
                >
                  {t.foldersShort[folder]}
                  <span className={box === folder ? "text-scene-orange-strong" : "text-scene-ink-muted"}>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="hidden border-b border-scene-line-soft p-3 text-[13px] font-bold text-scene-ink-muted lg:block">{t.folders[box]}</div>
          <ul className="border-t border-scene-line-soft lg:border-t-0">
            {shown.map((item) => {
              const unread = !state.opened.includes(item.id);
              const index = items.indexOf(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item.id)}
                    aria-current={current?.id === item.id ? "true" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2.5 border-b border-scene-line-soft p-3 text-left max-lg:px-4",
                      current?.id === item.id ? "lg:bg-scene-orange-soft" : "bg-scene-white",
                    )}
                  >
                    <SenderAvatar name={item.sender} index={index} className="size-[34px] text-sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex justify-between gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>{item.sender}</span>
                        <span className="flex-none text-xs text-scene-ink-muted">{item.time}</span>
                      </span>
                      {item.subject ? <span className={cn("truncate text-[13px]", unread ? "font-bold" : "font-medium")}>{item.subject}</span> : null}
                      <span className="truncate text-xs text-scene-ink-muted">{preview(item.body)}</span>
                    </span>
                    {unread ? (
                      <span className="mt-1.5 size-2 flex-none rounded-full bg-scene-orange">
                        <span className="sr-only">{t.unread}</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? <p className="px-4 py-10 text-center text-sm text-scene-ink-faint">{t.empty}</p> : null}
        </div>

        {/* Okuma alanı */}
        <div className={cn("flex min-w-0 flex-1 flex-col", view === "list" && "max-lg:hidden")}>
          {current ? (
            <MailView
              item={current}
              index={items.indexOf(current)}
              box={box}
              onBack={() => setView("list")}
              onReply={() => setToast(t.toasts.reply)}
              onForward={() => setToast(t.toasts.forward)}
              onAsk={setConfirm}
              onRestore={() => move("inbox")}
              onAttachment={() => {
                onAttachment(current.id);
                setToast(t.toasts.attachment);
              }}
              onLink={() => onLink(current.id)}
              onPeek={(show) => setPeek(show && current.link ? current.link.url : null)}
            />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-sm text-scene-ink-faint">{t.pick}</p>
          )}
        </div>
      </div>

      {/* Bağlantının adresi (tarayıcının durum çubuğu gibi) */}
      {peek ? (
        <div aria-hidden="true" className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-16px)] truncate rounded-md border border-scene-line-strong bg-scene-paper px-2 py-1 font-mono text-xs text-scene-ink-2 max-lg:bottom-[76px]">
          {peek}
        </div>
      ) : null}

      <SceneToast message={toast} onClose={() => setToast(null)} />
      <SceneConfirm
        open={confirm !== null}
        title={confirm ? t.confirm[confirm].title : ""}
        text={confirm ? t.confirm[confirm].text : ""}
        confirmLabel={confirm ? t.confirm[confirm].ok : ""}
        cancelLabel={t.confirm.cancel}
        onConfirm={() => confirm && move(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

const mutedFolderClass = "flex h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-sm text-scene-ink-faint";

function FolderButton({ folder, count, active, onClick, strong }: { folder: Folder; count: number; active: boolean; onClick: () => void; strong?: boolean }) {
  const t = getMessages().lab.inbox;
  const Icon = folderIcons[folder];
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-sm",
        active ? "bg-scene-orange-tint font-bold text-scene-orange-ink" : "font-medium text-scene-ink-2",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
      <span className="flex-1">{t.folders[folder]}</span>
      {strong ? <b>{count}</b> : <span className="text-scene-ink-muted">{count}</span>}
    </button>
  );
}

function preview(body: string) {
  return paragraphs(body).join(" ").replace(/\*\*/g, "");
}

function MailView({
  item,
  index,
  box,
  onBack,
  onReply,
  onForward,
  onAsk,
  onRestore,
  onAttachment,
  onLink,
  onPeek,
}: {
  item: ClientItem;
  index: number;
  box: Folder;
  onBack: () => void;
  onReply: () => void;
  onForward: () => void;
  onAsk: (what: "spam" | "trash") => void;
  onRestore: () => void;
  onAttachment: () => void;
  onLink: () => void;
  onPeek: (show: boolean) => void;
}) {
  const t = getMessages().lab.inbox;
  const peek = useLinkPeek(onPeek);
  const inInbox = box === "inbox";
  const toolClass =
    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-scene-line bg-scene-white px-3 text-[13px] font-bold text-scene-ink-2";

  return (
    <>
      {/* Telefonda geri */}
      <div className="flex flex-none items-center border-b border-scene-line-soft px-2 py-1 lg:hidden">
        <button type="button" onClick={onBack} className="inline-flex h-11 cursor-pointer items-center gap-2 px-2 text-[15px] font-bold text-scene-orange-strong">
          <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">{t.back}</span>
          <span aria-hidden="true">{t.folders[box]}</span>
        </button>
      </div>

      {/* Masaüstü araç çubuğu */}
      <div className="hidden flex-none flex-wrap gap-2 border-b border-scene-line-soft px-4 py-2.5 lg:flex">
        {inInbox ? (
          <>
            <button type="button" onClick={onReply} className={toolClass}>
              <CornerUpLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              {t.reply}
            </button>
            <button type="button" onClick={onForward} className={toolClass}>
              <Share className="size-4" strokeWidth={2} aria-hidden="true" />
              {t.forward}
            </button>
            <button type="button" onClick={() => onAsk("trash")} className={toolClass}>
              <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
              {t.delete}
            </button>
            <button
              type="button"
              onClick={() => onAsk("spam")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-scene-orange-line bg-scene-orange-soft px-3 text-[13px] font-bold text-scene-orange-strong"
            >
              <Flag className="size-4" strokeWidth={2} aria-hidden="true" />
              {t.report}
            </button>
          </>
        ) : (
          <button type="button" onClick={onRestore} className={toolClass}>
            <Undo2 className="size-4" strokeWidth={2} aria-hidden="true" />
            {t.restore}
          </button>
        )}
      </div>

      <article key={item.id} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [animation:fade-in_.2s_ease-out_both] lg:px-6">
        {!inInbox ? (
          <FolderBanner icon={<TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden="true" />}>
            {t.banner[box]}
          </FolderBanner>
        ) : null}
        <div className="flex flex-col gap-3.5">
          {item.subject ? <h2 className="text-[22px] leading-tight font-bold">{item.subject}</h2> : null}
          <div className="flex items-center gap-2.5">
            <SenderAvatar name={item.sender} index={index} className="size-[38px]" />
            <div className="flex min-w-0 flex-col gap-px text-[13px]">
              <span>
                <b className="text-sm">{item.sender}</b> <span className="text-scene-ink-3 [overflow-wrap:anywhere]">{format(t.address, { address: item.address })}</span>
              </span>
              <span className="text-scene-ink-muted">{format(t.to, { time: item.time })}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-[15px] leading-[1.65] text-scene-body">
            {paragraphs(item.body).map((p, i) => (
              <p key={i}>
                <RichLine text={p} />
              </p>
            ))}
            {item.link ? (
              <div>
                <button
                  type="button"
                  {...peek.handlers}
                  onClick={() => {
                    if (peek.consumePress()) onLink();
                  }}
                  className="inline-flex h-[42px] cursor-pointer items-center rounded-lg bg-scene-blue px-5 text-[15px] font-bold text-scene-white [-webkit-touch-callout:none] select-none"
                >
                  {item.link.text || item.link.url}
                </button>
              </div>
            ) : null}
            {item.attachment ? (
              <button
                type="button"
                onClick={onAttachment}
                aria-label={format(t.attachment, { name: item.attachment.name })}
                className="inline-flex cursor-pointer items-center gap-2 self-start rounded-[10px] border border-scene-line-strong px-3 py-2 text-[13px] text-scene-ink-2"
              >
                <Paperclip className="size-4" strokeWidth={2} aria-hidden="true" />
                {format(t.attachmentChip, { name: item.attachment.name, size: item.attachment.size })}
              </button>
            ) : null}
            {item.footer ? (
              <p className="text-[13px] leading-normal text-scene-ink-muted">
                {item.footer.split("\n").map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      </article>

      {/* Telefonda alt çubuk */}
      <div className="grid flex-none grid-cols-4 border-t border-scene-line bg-scene-paper lg:hidden">
        {inInbox ? (
          <>
            <BarButton Icon={CornerUpLeft} label={t.reply} onClick={onReply} />
            <BarButton Icon={Share} label={t.forward} onClick={onForward} />
            <BarButton Icon={Trash2} label={t.delete} onClick={() => onAsk("trash")} />
            <BarButton Icon={Flag} label={t.reportShort} onClick={() => onAsk("spam")} accent />
          </>
        ) : (
          <div className="col-span-4 flex justify-center">
            <BarButton Icon={Undo2} label={t.restore} onClick={onRestore} />
          </div>
        )}
      </div>
    </>
  );
}

function BarButton({ Icon, label, onClick, accent }: { Icon: LucideIcon; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-1 px-2 text-xs font-bold",
        accent ? "text-scene-orange-strong" : "text-scene-ink-2",
      )}
    >
      <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
      {label}
    </button>
  );
}
