/**
 * POST /api/upload
 * Uploads a file to Supabase Storage and returns its public URL.
 * Replaces wp_handle_upload() from WordPress.
 *
 * Form fields:
 *   file     — the File blob
 *   bucket   — storage bucket name (avatars | attachments | certificates | lesson-files)
 *   path     — storage path within the bucket, e.g. "user-42/avatar.jpg"
 */
import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { uploadFile, getPublicUrl } from "@/lib/storage/upload";
import { ok, badRequest, serverError } from "@/lib/utils/api-helpers";

const ALLOWED_BUCKETS = new Set([
  "avatars",
  "attachments",
  "certificates",
  "lesson-files",
]);

// 10 MB
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const [, authErr] = await requireSession();
    if (authErr) return authErr;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) ?? "attachments";
    const path = formData.get("path") as string | null;

    if (!file) return badRequest("file is required");
    if (!path) return badRequest("path is required");
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return badRequest(
        `bucket must be one of: ${[...ALLOWED_BUCKETS].join(", ")}`
      );
    }
    if (file.size > MAX_BYTES) {
      return badRequest("File exceeds maximum size of 10 MB");
    }

    await uploadFile({
      bucket,
      path,
      file,
      contentType: file.type || undefined,
      upsert: true,
    });

    const publicUrl = await getPublicUrl(bucket, path);

    return ok({ url: publicUrl, bucket, path, size: file.size, type: file.type });
  } catch (e) {
    return serverError(e);
  }
}
