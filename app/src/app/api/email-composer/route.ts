import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/email-composer  Params: section=templates|logs, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.emailComposer) return forbidden("Email Composer access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "templates";
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));

    if (section === "templates") {
      const [templates, total] = await Promise.all([
        prisma.aquaticproEmailComposerTemplate.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.aquaticproEmailComposerTemplate.count(),
      ]);
      return ok({ templates, total, page, limit });
    }
    const [logs, total] = await Promise.all([
      prisma.aquaticproEmailComposerLog.findMany({ orderBy: { sentAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.aquaticproEmailComposerLog.count(),
    ]);
    return ok({ logs, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/email-composer  Body: { action: "send"|"save-template", ... } */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.emailComposer) return forbidden("Email Composer access required");

    const body = await parseBody<{ action: string; subject?: string; bodyHtml?: string; bodyJson?: string; name?: string; recipientCount?: number; recipientSummary?: string }>(request);
    if (!body?.action) return badRequest("action required");

    if (body.action === "save-template") {
      if (!body.name || !body.subject) return badRequest("name and subject required");
      const tmpl = await prisma.aquaticproEmailComposerTemplate.create({
        data: { name: body.name, subject: body.subject, bodyJson: body.bodyJson ?? null, bodyHtml: body.bodyHtml ?? null, createdBy: user.id },
      });
      return created(tmpl);
    }

    if (body.action === "send") {
      if (!body.subject) return badRequest("subject required");
      // Actual send goes through the email lib; log the send here.
      const log = await prisma.aquaticproEmailComposerLog.create({
        data: {
          subject: body.subject, bodyHtml: body.bodyHtml ?? null,
          recipientCount: body.recipientCount ?? 0,
          sentBy: user.id, recipientSummary: body.recipientSummary ?? null,
        },
      });
      return ok({ logged: log.id, message: "Email queued for sending" });
    }

    return badRequest("action must be send or save-template");
  } catch (e) { return serverError(e); }
}
