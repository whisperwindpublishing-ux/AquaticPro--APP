/**
 * POST /api/media-library/upload
 * Uploads a file to Supabase Storage (attachments bucket) and records it in the
 * mp_media_files table.
 *
 * Form fields:
 *   file    — the File blob (required)
 *   logId   — the daily log ID this file is being attached to (optional)
 *   altText — accessibility description (optional)
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { uploadFile, getPublicUrl } from "@/lib/storage/upload";
import { ok, badRequest, serverError } from "@/lib/utils/api-helpers";

const BUCKET = "attachments";
// 50 MB — generous for video/audio clips
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const formData = await request.formData();
    const file    = formData.get("file")    as File | null;
    const logId   = formData.get("logId")   as string | null;
    const altText = formData.get("altText") as string | null;

    if (!file) return badRequest("file is required");
    if (file.size > MAX_BYTES) return badRequest("File exceeds 50 MB limit");

    // Build storage path: user-{id}/YYYY-MM/{timestamp}-{sanitized-name}
    const now       = new Date();
    const month     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `user-${user.id}/${month}/${Date.now()}-${safeName}`;

    await uploadFile({
      bucket: BUCKET,
      path: storagePath,
      file,
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    const publicUrl = await getPublicUrl(BUCKET, storagePath);

    const record = await prisma.mediaFile.create({
      data: {
        uploaderId:  user.id,
        fileName:    file.name,
        fileSize:    file.size,
        mimeType:    file.type || "application/octet-stream",
        bucket:      BUCKET,
        storagePath,
        publicUrl,
        altText:     altText || null,
        logId:       logId ? parseInt(logId, 10) : null,
      },
    });

    return ok({
      id:         record.id,
      url:        publicUrl,
      fileName:   record.fileName,
      fileSize:   record.fileSize,
      mimeType:   record.mimeType,
      storagePath,
    });
  } catch (e) {
    return serverError(e);
  }
}
