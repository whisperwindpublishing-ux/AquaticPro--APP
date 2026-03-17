import { createClient } from "@/lib/supabase/server";

interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  upsert?: boolean;
}

/**
 * Upload a file to Supabase Storage.
 * Replaces `wp_handle_upload()` from WordPress.
 */
export async function uploadFile({
  bucket,
  path,
  file,
  contentType,
  upsert = false,
}: UploadOptions) {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert,
    });

  if (error) {
    console.error("[Storage] Upload failed:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
}

/**
 * Get a public URL for a stored file.
 */
export async function getPublicUrl(bucket: string, path: string): Promise<string> {
  const supabase = await createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[Storage] Delete failed:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}
