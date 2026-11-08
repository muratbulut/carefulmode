"use client";

import { useMemo } from "react";
import { ScenarioPlayer, type ScenarioPlayerProps } from "./frame/ScenarioPlayer";
import { serverDriver, serverTrainingDriver } from "./server-driver";
import { TrainingPlayer, type TrainingPlayerProps } from "./training/TrainingPlayer";

/** Öğrencinin senaryo labı: oynatıcı sunucu sürücüsüyle (puan ve rapor sunucuda). */
export function LabPlay({ slug, ...props }: Omit<ScenarioPlayerProps, "driver"> & { slug: string }) {
  const driver = useMemo(() => serverDriver(slug), [slug]);
  return <ScenarioPlayer driver={driver} {...props} />;
}

/** Öğrencinin eğitim labı: doğru cevaplar ve ilerleme sunucuda. */
export function TrainingPlay({ slug, ...props }: Omit<TrainingPlayerProps, "driver"> & { slug: string }) {
  const driver = useMemo(() => serverTrainingDriver(slug), [slug]);
  return <TrainingPlayer driver={driver} {...props} />;
}
