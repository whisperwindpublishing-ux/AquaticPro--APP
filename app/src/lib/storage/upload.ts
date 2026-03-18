import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS and has full storage access.
 * Used exclusively for server-side storage operations in API routes.
 * Never exposed to the browser.
 */
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  upsert?: boolean;
}

/**
 * Ensure a public storage bucket exists, creating it if needed.
 */
async function ensureBucket(supabase: ReturnType<typeof createAdminClient>, bucket: string) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error) throw new Error(`Failed to create bucket "${bucket}": ${error.message}`);
  }
}

/**
 * Upload a file to Supabase Storage using the service role key.
 * Replaces `wp_handle_upload()` from WordPress.
 */
export async function uploadFile({
  bucket,
  path,
  file,
  contentType,
  upsert = false,
}: UploadOptions) {
  const supabase = createAdminClient();

  await ensureBucket(supabase, bucket);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert });

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
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[Storage] Delete failed:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}
