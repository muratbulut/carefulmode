"use client";

import { ArrowLeft, Ban, MessageCircle, Paperclip, Search, SendHorizontal, Trash2, TriangleAlert, Undo2, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
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
  /** Cevabı gönderir; metin tarayıcıda kalır, sunucuya yalnızca kodu içerip içermediği gider. */
  onReply: (id: string, text: string) => Promise<boolean>;
  /** Sahne masaüstünde telefon çerçevesinin içinde (satış görevli oda): her ekranda telefon düzeni. */
  phone?: boolean;
};

const folderIcons: Record<Folder, LucideIcon> = { inbox: MessageCircle, spam: Ban, trash: Trash2 };

export function MessagesLogo() {
  const t = getMessages().lab.messaging;
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-[-0.3px] text-scene-ink">
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-md bg-scene-green text-scene-white">
        <MessageCircle className="size-4" strokeWidth={2.2} />
      </span>
      {t.app}
    </span>
  );
}

/**
 * Mesajlar sahnesi (mesajlaşma şablonu; tasarımı Postam çerçevesiyle aynı, sohbet görünümü
 * Lab-Duzenle-Son-SMS önizlemesinden). Öğrenci her konuşmaya cevap yazabilir; hangi konuşmanın
 * sahte olduğu tarayıcıda bilinmez. Yazdığı metin bu ekranda kalır, hiçbir yere gönderilmez.
 */
export function MessagingScene({ items, state, avatar, onOpen, onMove, onAttachment, onLink, onReply, phone = false }: Props) {
  const t = getMessages().lab.messaging;
  const [box, setBox] = useState<Folder>("inbox");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "item">("list");
  const [confirm, setConfirm] = useState<"spam" | "trash" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  // Bu oturumda gönderilen cevaplar (yalnızca ekranda).
  const [sent, setSent] = useState<Record<string, string[]>>({});

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
    const desktop = !phone && window.matchMedia("(min-width: 1024px)").matches;
    setSelected(desktop ? (rest[0]?.id ?? null) : null);
    if (desktop && rest[0] && !state.opened.includes(rest[0].id)) onOpen(rest[0].id);
    setView("list");
  }

  async function reply(id: string, text: string) {
    const delivered = await onReply(id, text);
    if (!delivered) return false;
    setSent((all) => ({ ...all, [id]: [...(all[id] ?? []), text] }));
    setToast(t.toasts.sent);
    return true;
  }

  const folderList = (["inbox", "spam", "trash"] as const).map((folder) => ({ folder, count: inFolder(folder).length }));

  return (
    <div className="relative flex h-full flex-col bg-scene-white font-sans text-scene-ink">
      <div className="flex flex-none items-center gap-4 border-b border-scene-line bg-scene-paper px-3.5 py-2.5">
        <MessagesLogo />
        <div className="hidden h-[38px] max-w-[420px] flex-1 items-center gap-2 rounded-[10px] border border-scene-line bg-scene-white px-3 text-sm text-scene-ink-faint desk:flex">
          <Search className="size-4" strokeWidth={2} aria-hidden="true" />
          {t.search}
        </div>
        <span className="ml-auto flex items-center gap-2">
          <Search className="size-5 text-scene-ink-2 desk:hidden" strokeWidth={2} aria-hidden="true" />
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-scene-line text-lg">
            {avatar}
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav aria-label={t.folderNav} className="hidden w-[190px] flex-none flex-col gap-1 border-r border-scene-line p-3 desk:flex">
          {folderList.map(({ folder, count }) => {
            const Icon = folderIcons[folder];
            const active = box === folder;
            return (
              <button
                key={folder}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => goFolder(folder)}
                className={cn(
                  "flex h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-left text-sm",
                  active ? "bg-scene-paper font-bold text-scene-green" : "font-medium text-scene-ink-2",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
                <span className="flex-1">{t.folders[folder]}</span>
                <span className={active ? "" : "text-scene-ink-muted"}>{count}</span>
              </button>
            );
          })}
        </nav>

        <div className={cn("min-w-0 flex-1 overflow-y-auto border-scene-line desk:w-[290px] desk:flex-none desk:border-r", view === "item" && "max-desk:hidden")}>
          <div className="px-4 pt-4 pb-3 desk:hidden">
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
                    box === folder ? "border-scene-green bg-scene-paper text-scene-green" : "border-scene-line bg-scene-white text-scene-ink-2",
                  )}
                >
                  {t.foldersShort[folder]}
                  <span className="text-scene-ink-muted">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="hidden border-b border-scene-line-soft p-3 text-[13px] font-bold text-scene-ink-muted desk:block">{t.folders[box]}</div>
          <ul className="border-t border-scene-line-soft desk:border-t-0">
            {shown.map((item) => {
              const unread = !state.opened.includes(item.id);
              const mine = sent[item.id]?.at(-1);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item.id)}
                    aria-current={current?.id === item.id ? "true" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 border-b border-scene-line-soft p-3 text-left max-desk:px-4",
                      current?.id === item.id ? "desk:bg-scene-paper" : "bg-scene-white",
                    )}
                  >
                    <SenderAvatar name={item.sender} index={items.indexOf(item)} className="size-10 text-[15px]" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex justify-between gap-2">
                        <span className={cn("truncate text-[15px]", unread ? "font-bold" : "font-medium")}>{item.sender}</span>
                        <span className="flex-none text-xs text-scene-ink-muted">{item.time}</span>
                      </span>
                      <span className={cn("truncate text-[13px]", unread ? "font-bold text-scene-ink" : "text-scene-ink-muted")}>
                        {mine ?? paragraphs(item.body).join(" ").replace(/\*\*/g, "")}
                      </span>
                    </span>
                    {unread ? (
                      <span className="size-2.5 flex-none rounded-full bg-scene-green">
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

        <div className={cn("flex min-w-0 flex-1 flex-col", view === "list" && "max-desk:hidden")}>
          {current ? (
            <Thread
              key={current.id}
              item={current}
              index={items.indexOf(current)}
              box={box}
              sent={sent[current.id] ?? []}
              repliedBefore={state.replied.includes(current.id) && !sent[current.id]}
              onBack={() => setView("list")}
              onAsk={setConfirm}
              onRestore={() => move("inbox")}
              onAttachment={() => {
                onAttachment(current.id);
                setToast(getMessages().lab.inbox.toasts.attachment);
              }}
              onLink={() => onLink(current.id)}
              onPeek={(show) => setPeek(show && current.link ? current.link.url : null)}
              onReply={(text) => reply(current.id, text)}
            />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-sm text-scene-ink-faint">{t.pick}</p>
          )}
        </div>
      </div>

      {peek ? (
        <div aria-hidden="true" className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-16px)] truncate rounded-md border border-scene-line-strong bg-scene-paper px-2 py-1 font-mono text-xs text-scene-ink-2 max-desk:bottom-[76px]">
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

function Thread({
  item,
  index,
  box,
  sent,
  repliedBefore,
  onBack,
  onAsk,
  onRestore,
  onAttachment,
  onLink,
  onPeek,
  onReply,
}: {
  item: ClientItem;
  index: number;
  box: Folder;
  sent: string[];
  repliedBefore: boolean;
  onBack: () => void;
  onAsk: (what: "spam" | "trash") => void;
  onRestore: () => void;
  onAttachment: () => void;
  onLink: () => void;
  onPeek: (show: boolean) => void;
  onReply: (text: string) => Promise<boolean>;
}) {
  const t = getMessages().lab.messaging;
  const peek = useLinkPeek(onPeek);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const inputId = useId();
  const inInbox = box === "inbox";
  const outgoing = repliedBefore ? [t.sentHidden] : sent;
  const lines = paragraphs(item.body);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onReply(text);
    setSending(false);
    if (ok) setDraft("");
  }

  return (
    <>
      <div className="flex flex-none items-center gap-2.5 border-b border-scene-line px-2 py-2 desk:px-4">
        <button type="button" onClick={onBack} aria-label={t.back} className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-scene-green desk:hidden">
          <ArrowLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <SenderAvatar name={item.sender} index={index} className="size-9 text-sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[15px]">{item.sender}</b>
          <span className="truncate text-xs text-scene-ink-muted">{item.address}</span>
        </span>
        {inInbox ? (
          <>
            <button
              type="button"
              onClick={() => onAsk("spam")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-scene-orange-line bg-scene-orange-soft px-2.5 text-[13px] font-bold text-scene-orange-strong"
            >
              <Ban className="size-4" strokeWidth={2} aria-hidden="true" />
              <span className="max-wide:sr-only">{t.report}</span>
            </button>
            <button
              type="button"
              onClick={() => onAsk("trash")}
              aria-label={t.delete}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-scene-line text-scene-ink-2"
            >
              <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </>
        ) : (
          <button type="button" onClick={onRestore} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-scene-line px-3 text-[13px] font-bold text-scene-ink-2">
            <Undo2 className="size-4" strokeWidth={2} aria-hidden="true" />
            {t.restore}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-scene-paper px-3.5 py-4 desk:px-5">
        {!inInbox ? (
          <FolderBanner icon={<TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden="true" />}>{t.banner[box]}</FolderBanner>
        ) : null}
        {item.time ? <span className="self-center text-[11px] text-scene-ink-muted">{item.time}</span> : null}
        {lines.map((line, i) => (
          <div
            key={i}
            aria-label={i === 0 ? format(t.messageFrom, { sender: item.sender }) : undefined}
            className="max-w-[82%] self-start rounded-[16px_16px_16px_4px] bg-scene-white px-3 py-2.5 text-[15px] leading-normal text-scene-body shadow-[0_1px_2px_var(--scene-shadow)]"
          >
            <RichLine text={line} />
            {i === lines.length - 1 && item.link ? (
              <button
                type="button"
                {...peek.handlers}
                onClick={() => {
                  if (peek.consumePress()) onLink();
                }}
                className="mt-1.5 block cursor-pointer text-left font-mono text-xs break-all text-scene-blue underline [-webkit-touch-callout:none] select-none"
              >
                {item.link.url}
              </button>
            ) : null}
          </div>
        ))}
        {item.attachment ? (
          <button
            type="button"
            onClick={onAttachment}
            className="inline-flex max-w-[82%] cursor-pointer items-center gap-2 self-start rounded-xl border border-scene-line-strong bg-scene-white px-3 py-2 text-[13px] text-scene-ink-2"
          >
            <Paperclip className="size-4" strokeWidth={2} aria-hidden="true" />
            {format(getMessages().lab.inbox.attachmentChip, { name: item.attachment.name, size: item.attachment.size })}
          </button>
        ) : null}
        {outgoing.map((text, i) => (
          <div key={i} className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-scene-green px-3 py-2.5 text-[15px] leading-normal break-words text-scene-white">
            {text}
          </div>
        ))}
        {outgoing.length > 0 ? <span className="self-end text-[11px] text-scene-ink-muted">{t.delivered}</span> : null}
      </div>

      {inInbox ? (
        <div className="flex flex-none items-center gap-2 border-t border-scene-line bg-scene-white px-3 py-2.5">
          <label htmlFor={inputId} className="sr-only">
            {t.placeholder}
          </label>
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            autoComplete="off"
            data-1p-ignore=""
            data-lpignore="true"
            placeholder={t.placeholder}
            className="h-10 min-w-0 flex-1 rounded-full bg-scene-paper px-4 text-[15px] text-scene-ink outline-none placeholder:text-scene-ink-faint focus:ring-2 focus:ring-scene-green"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            aria-label={t.send}
            className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-full bg-scene-green text-scene-white disabled:cursor-default disabled:opacity-40"
          >
            <SendHorizontal className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  );
}
