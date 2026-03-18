"use client";

/**
 * MediaLibraryModal
 *
 * Browse + upload files from the central media library.
 * Permission-aware: regular users see their own files; canModerateAll users see all.
 *
 * Usage:
 *   <MediaLibraryModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSelect={(file) => insertIntoEditor(file.publicUrl)}
 *   />
 */

import { useState, useCallback, useRef } from "react";
import { useApi } from "@/hooks/useApi";

interface MediaFileItem {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  publicUrl: string;
  altText: string | null;
  uploaderName: string;
  isOwn: boolean;
  createdAt: string;
}

interface MediaResponse {
  files: MediaFileItem[];
  total: number;
  page: number;
  limit: number;
}

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when user picks a file to insert */
  onSelect?: (file: MediaFileItem) => void;
  /** Filter to show only images or files */
  typeFilter?: "all" | "image" | "file";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export default function MediaLibraryModal({
  open,
  onClose,
  onSelect,
  typeFilter = "all",
}: MediaLibraryModalProps) {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [typeTab, setTypeTab]   = useState<"all" | "image" | "file">(typeFilter);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [selected, setSelected]   = useState<MediaFileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {
    page: String(page), limit: "40", type: typeTab,
    ...(search ? { search } : {}),
  };
  const { data, loading, refetch } = useApi<MediaResponse>("/api/media-library", params);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media-library/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }
      await refetch();
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [refetch]);

  const handleDelete = useCallback(async (fileId: number) => {
    if (!confirm("Delete this file from the media library?")) return;
    await fetch(`/api/media-library/${fileId}`, { method: "DELETE" });
    if (selected?.id === fileId) setSelected(null);
    await refetch();
  }, [selected, refetch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              Upload
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-6 py-3">
          {/* Type tabs */}
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm">
            {(["all", "image", "file"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTypeTab(t); setPage(1); }}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                  typeTab === t
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t === "all" ? "All" : t === "image" ? "Images" : "Files"}
              </button>
            ))}
          </div>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by filename…"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {data && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {data.total} file{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {uploadErr && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{uploadErr}</p>
            )}
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : data?.files.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No files found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {data?.files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelected(file)}
                    className={`group relative cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                      selected?.id === file.id
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                      {isImage(file.mimeType) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.publicUrl}
                          alt={file.altText ?? file.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 p-2 text-gray-400">
                          <FileTypeIcon mimeType={file.mimeType} />
                          <span className="text-xs text-center break-all leading-tight">
                            {file.fileName.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-700 truncate">{file.fileName}</p>
                      <p className="text-xs text-gray-400">{formatBytes(file.fileSize)}</p>
                    </div>
                    {/* Delete */}
                    {file.isOwn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                        className="absolute right-1 top-1 hidden rounded-full bg-red-500 p-1 text-white group-hover:flex hover:bg-red-600 transition-colors"
                        title="Delete file"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data && data.total > data.limit && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {Math.ceil(data.total / data.limit)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.total / data.limit)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-64 shrink-0 border-l border-gray-200 flex flex-col overflow-y-auto">
              <div className="p-4 flex flex-col gap-4">
                {/* Preview */}
                <div className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                  {isImage(selected.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.publicUrl}
                      alt={selected.altText ?? selected.fileName}
                      className="h-full w-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400 p-4">
                      <FileTypeIcon mimeType={selected.mimeType} large />
                      <span className="text-sm font-medium">{selected.fileName.split(".").pop()?.toUpperCase()}</span>
                    </div>
                  )}
                </div>
                {/* Meta */}
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900 break-words">{selected.fileName}</p>
                  <p className="text-gray-500">{formatBytes(selected.fileSize)}</p>
                  <p className="text-gray-500">{selected.mimeType}</p>
                  <p className="text-gray-400 text-xs">
                    Uploaded by {selected.uploaderName}<br />
                    {new Date(selected.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2 mt-auto">
                  {onSelect && (
                    <button
                      onClick={() => { onSelect(selected); onClose(); }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Insert File
                    </button>
                  )}
                  <a
                    href={selected.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Open in New Tab
                  </a>
                  {selected.isOwn && (
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File Type Icon ───────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType, large = false }: { mimeType: string; large?: boolean }) {
  const cls = large ? "h-12 w-12" : "h-8 w-8";

  if (mimeType.startsWith("video/")) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType.startsWith("audio/")) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}
