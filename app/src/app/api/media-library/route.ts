import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, badRequest, forbidden, serverError } from "@/lib/utils/api-helpers";

/**
 * GET /api/media-library
 * Returns paginated list of media files.
 * Users with canModerateAll on daily-logs see all files; everyone else sees only their own.
 *
 * Query params: page, limit, type (image | file | all), search
 */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);

    // Determine if user can see all media or only their own
    let canSeeAll = perms.isAdmin;
    if (!canSeeAll) {
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { userId: user.id },
        select: { jobRoleId: true },
      });
      const roleIds = assignments.map((a) => a.jobRoleId);
      if (roleIds.length > 0) {
        const moderatorRows = await prisma.mpDailyLogPermission.findMany({
          where: { jobRoleId: { in: roleIds }, canModerateAll: true },
        });
        canSeeAll = moderatorRows.length > 0;
      }
    }

    const sp = new URL(request.url).searchParams;
    const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit  = Math.min(100, parseInt(sp.get("limit") ?? "40", 10));
    const type   = sp.get("type")   ?? "all";
    const search = sp.get("search") ?? "";

    type MimeFilter = { contains: string };
    const where: {
      uploaderId?: number;
      mimeType?: { contains: string };
      OR?: Array<{ fileName: MimeFilter } | { mimeType: MimeFilter }>;
    } = {
      ...(canSeeAll ? {} : { uploaderId: user.id }),
      ...(type === "image" ? { mimeType: { contains: "image/" } } : {}),
      ...(type === "file"  ? { mimeType: { contains: "" } }       : {}),
      ...(search ? {
        OR: [
          { fileName: { contains: search } },
          { mimeType: { contains: search } },
        ],
      } : {}),
    };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, uploaderId: true, fileName: true, fileSize: true,
          mimeType: true, publicUrl: true, altText: true, logId: true, createdAt: true,
        },
      }),
      prisma.mediaFile.count({ where }),
    ]);

    // Hydrate uploader names
    const uploaderIds = [...new Set(files.map((f) => f.uploaderId))];
    const uploaders   = uploaderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, displayName: true, firstName: true, lastName: true },
        })
      : [];
    const uploaderMap: Record<number, string> = {};
    for (const u of uploaders) {
      uploaderMap[u.id] = u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    }

    const hydratedFiles = files.map((f) => ({
      ...f,
      uploaderName: uploaderMap[f.uploaderId] ?? "Unknown",
      isOwn: f.uploaderId === user.id,
    }));

    return ok({ files: hydratedFiles, total, page, limit });
  } catch (e) {
    return serverError(e);
  }
}
