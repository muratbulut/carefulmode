"use client";

import { Info } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { compromiseKinds, hackedScenes, type CompromiseKind, type HackedScene, type ScenarioContent, type ScenarioTemplate } from "@/lib/lab/content";
import { Group, SelectField, TextAreaField, TextField } from "./fields";
import type { Edit } from "./types";

/**
 * Sahte sayfa (gelen kutusu) ya da tuzak anı (mesajlaşma): ne istiyor, verirse ne olur. Mesajlaşmada
 * tuzak cevapta gönderilen kod, isteğe bağlı olarak da sahte mesajdaki bağlantının açtığı sahte
 * sayfadır (M1; sayfa başlığı yazılınca açılır, lib/lab/content.ts usesTrapPage).
 */
export function TrapForm({ content, template, edit }: { content: ScenarioContent; template: ScenarioTemplate; edit: Edit<ScenarioContent> }) {
  const e = getMessages().admin.editor;
  const f = e.trap;
  const trap = content.trap;
  const set = (change: (draft: ScenarioContent["trap"]) => void) => edit((d) => change(d.trap));

  return (
    <>
      {template === "INBOX" ? (
        <>
          <TextField
            label={f.url}
            hint={f.urlHint}
            mono
            value={trap.url}
            maxLength={120}
            onChange={(v) => {
              const url = v.target.value.replace(/[\s<>"']/g, "");
              set((d) => void (d.url = url));
            }}
          />
          <TextField label={f.title} value={trap.title} maxLength={80} placeholder={f.titlePlaceholder} onChange={(v) => set((d) => void (d.title = v.target.value))} />
          <TextAreaField label={f.text} value={trap.text} maxLength={300} rows={2} onChange={(v) => set((d) => void (d.text = v.target.value))} />
          <TextField label={f.ask} value={trap.ask} maxLength={80} placeholder={f.askPlaceholder.INBOX} onChange={(v) => set((d) => void (d.ask = v.target.value))} />
        </>
      ) : (
        <>
          <TextField label={f.ask} value={trap.ask} maxLength={80} placeholder={f.askPlaceholder.MESSAGING} onChange={(v) => set((d) => void (d.ask = v.target.value))} />
          <TextField label={f.secret} hint={f.secretHint} mono value={trap.secret} maxLength={40} onChange={(v) => set((d) => void (d.secret = v.target.value))} />
          <Group title={f.page} hint={f.pageHint}>
            <TextField label={f.title} value={trap.title} maxLength={80} placeholder={f.pageTitlePlaceholder} onChange={(v) => set((d) => void (d.title = v.target.value))} />
            <TextField
              label={f.url}
              hint={f.pageUrlHint}
              mono
              value={trap.url}
              maxLength={120}
              onChange={(v) => {
                const url = v.target.value.replace(/[\s<>"']/g, "");
                set((d) => void (d.url = url));
              }}
            />
            <TextAreaField label={f.text} value={trap.text} maxLength={300} rows={2} onChange={(v) => set((d) => void (d.text = v.target.value))} />
          </Group>
        </>
      )}

      <p className="m-0 flex gap-2.5 rounded-xl border border-alarm-line bg-alarm-pink/7 px-3.5 py-3 text-[13px] leading-normal text-fg-2">
        <Info className="mt-0.5 size-4 flex-none text-alarm-pink" strokeWidth={2.2} aria-hidden="true" />
        <span>{f.hackNote[template]}</span>
      </p>

      <SelectField
        label={f.kind}
        value={trap.kind}
        options={compromiseKinds.map((k) => ({ value: k, label: f.kinds[k] }))}
        onChange={(v) => set((d) => void (d.kind = v.target.value as CompromiseKind))}
      />
      {trap.kind === "account" ? (
        <TextField
          label={f.account}
          hint={f.accountHint}
          value={trap.account}
          maxLength={30}
          placeholder={f.accountPlaceholder}
          onChange={(v) => set((d) => void (d.account = v.target.value))}
        />
      ) : null}
      <SelectField
        label={f.scene}
        hint={f.sceneHint}
        value={trap.scene}
        options={[{ value: "", label: f.scenes.auto }, ...hackedScenes.map((k) => ({ value: k, label: f.scenes[k] }))]}
        onChange={(v) => set((d) => void (d.scene = v.target.value as HackedScene | ""))}
      />
      <TextAreaField
        label={f.realLife}
        hint={f.realLifeHint}
        value={trap.realLife}
        maxLength={500}
        rows={3}
        onChange={(v) => set((d) => void (d.realLife = v.target.value))}
      />
    </>
  );
}
