import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/certificates  Params: userId (admin), typeId, section=types|records */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms    = await resolvePermissions(user.id);
    if (!perms.modules.certificates) return forbidden("Certificates access required");

    const sp       = new URL(request.url).searchParams;
    const section  = sp.get("section") ?? "records";
    const targetId = perms.isAdmin && sp.get("userId") ? parseInt(sp.get("userId")!, 10) : user.id;

    if (section === "types") {
      const types = await prisma.aquaticproCertificateType.findMany({
        where: { isActive: true }, orderBy: { sortOrder: "asc" },
      });
      return ok({ types });
    }

    // records: the user's certs with type info
    const records = await prisma.aquaticproUserCertificate.findMany({
      where: { userId: targetId },
      orderBy: [{ expirationDate: "asc" }],
    });
    const types = await prisma.aquaticproCertificateType.findMany({ where: { isActive: true } });
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t]));
    return ok({ records: records.map((r) => ({ ...r, type: typeMap[r.certificateTypeId] })), userId: targetId });
  } catch (e) { return serverError(e); }
}

/** POST /api/certificates  Create/update a user cert record (admin or self-upload). */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.certificates) return forbidden();

    const body = await parseBody<{
      userId?: number; certificateTypeId: number;
      trainingDate?: string; expirationDate?: string;
      fileUrl?: string; notes?: string; status?: string;
    }>(request);
    if (!body?.certificateTypeId) return badRequest("certificateTypeId required");

    const targetId = perms.isAdmin && body.userId ? body.userId : user.id;

    const cert = await prisma.aquaticproUserCertificate.upsert({
      where:  { userId_certificateTypeId: { userId: targetId, certificateTypeId: body.certificateTypeId } },
      create: {
        userId: targetId, certificateTypeId: body.certificateTypeId,
        trainingDate:  body.trainingDate  ? new Date(body.trainingDate)  : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        fileUrl: body.fileUrl ?? "", notes: body.notes ?? null,
        status: body.status ?? "pending", uploadedBy: user.id,
      },
      update: {
        trainingDate:  body.trainingDate  ? new Date(body.trainingDate)  : undefined,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
        fileUrl: body.fileUrl, notes: body.notes,
        status: body.status, uploadedBy: user.id,
      },
    });
    return created(cert);
  } catch (e) { return serverError(e); }
}
