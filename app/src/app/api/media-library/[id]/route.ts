import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, forbidden, notFound, serverError } from "@/lib/utils/api-helpers";
import { deleteFile } from "@/lib/storage/upload";

/** DELETE /api/media-library/[id] — delete a media file from storage + DB */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (isNaN(fileId)) return notFound();

    const record = await prisma.mediaFile.findUnique({ where: { id: fileId } });
    if (!record) return notFound();

    // Users can delete their own files; admins + moderators can delete any
    const perms = await resolvePermissions(user.id);
    let canDelete = perms.isAdmin || record.uploaderId === user.id;
    if (!canDelete) {
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { userId: user.id }, select: { jobRoleId: true },
      });
      const roleIds = assignments.map((a) => a.jobRoleId);
      if (roleIds.length > 0) {
        const modRows = await prisma.mpDailyLogPermission.findMany({
          where: { jobRoleId: { in: roleIds }, canModerateAll: true },
        });
        canDelete = modRows.length > 0;
      }
    }
    if (!canDelete) return forbidden("Cannot delete another user's file");

    // Delete from Supabase Storage first
    await deleteFile(record.bucket, record.storagePath);

    // Then remove the DB record
    await prisma.mediaFile.delete({ where: { id: fileId } });

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
