import type { NextRequest } from "next/server";
import { getPermittedAccess } from "@/lib/admin/access";
import { isApplicationId } from "@/lib/admin/application-rules";
import {
  documentHeaders,
  documentNotFoundHeaders,
  documentViewAuditWindowMs,
  isServableDocumentType,
} from "@/lib/admin/application-document";
import { auditTarget, writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

// Öğretmenlik belgesi (yalnızca talepleri inceleyenler; Talepler-Son "Belgeyi gör"). Yetki her
// istekte yeniden denetlenir; yetkisi olmayan, talep ya da belge yoksa aynı boş 404 döner.
// Her bakış kayıt defterine "application.document_viewed" olarak yazılır. Belge karar
// kesinleşince silinir (lib/teacher/decide.ts finalizeDecision); sonra bu adres 404 verir.

const notFound = () => new Response(null, { status: 404, headers: documentNotFoundHeaders });

export async function GET(_request: NextRequest, ctx: RouteContext<"/yonetim/talepler/[talep]/belge">) {
  const access = await getPermittedAccess("APPLICATIONS");
  if (!access) return notFound();
  const { talep } = await ctx.params;
  if (!isApplicationId(talep)) return notFound();

  const document = await db.applicationDocument.findUnique({
    where: { applicationId: talep },
    select: { mimeType: true, data: true, application: { select: { userId: true } } },
  });
  if (!document || !isServableDocumentType(document.mimeType)) return notFound();

  const target = auditTarget.application(talep);
  const recent = await db.auditLog.findFirst({
    where: {
      actorId: access.userId,
      action: "application.document_viewed",
      target,
      createdAt: { gte: new Date(Date.now() - documentViewAuditWindowMs) },
    },
    select: { id: true },
  });
  if (!recent) {
    await writeAudit(db, {
      actorId: access.userId,
      action: "application.document_viewed",
      target,
      details: { userId: document.application.userId, mimeType: document.mimeType },
    });
  }

  const bytes = new Uint8Array(document.data);
  return new Response(bytes, { status: 200, headers: documentHeaders(document.mimeType, bytes.byteLength) });
}
