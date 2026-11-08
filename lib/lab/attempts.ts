// Öğrencinin yarım kalan senaryo denemesi: oynatıcı kaldığı yerden açılır. İçerik denemenin
// başladığı sürümden gelir (lab bu arada güncellendiyse öğrenci eski sürümle bitirir).
// Yalnızca sunucuda.

import { db } from "@/lib/db";
import { parseScenario, type ScenarioContent } from "./content";
import { reduceEvents, rowToEvent, type SceneState } from "./events";

export type OpenAttempt = {
  attemptId: string;
  version: number;
  content: ScenarioContent;
  state: SceneState;
  /** Sıradaki olayın sıra numarası. */
  nextSeq: number;
};

export async function getOpenAttempt(userId: string, labId: string): Promise<OpenAttempt | null> {
  const attempt = await db.labAttempt.findFirst({
    where: { userId, labId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      labVersion: true,
      versionRecord: { select: { content: true } },
      events: { orderBy: { seq: "asc" }, select: { seq: true, type: true, data: true } },
    },
  });
  if (!attempt) return null;
  const content = parseScenario(attempt.versionRecord.content);
  if (!content) return null;
  return {
    attemptId: attempt.id,
    version: attempt.labVersion,
    content,
    state: reduceEvents(attempt.events.map(rowToEvent)),
    nextSeq: attempt.events.reduce((max, e) => Math.max(max, e.seq + 1), 0),
  };
}
