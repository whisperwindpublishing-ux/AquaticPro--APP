"use client";

/**
 * BlockNoteEditor
 *
 * Rich-text editor using BlockNote 0.47.x + Mantine.
 * Includes a "Media Library" button in the toolbar so users can browse existing
 * uploads and insert them as image / video / audio / file blocks.
 * Any new upload (drag-drop, paste, or the default BlockNote file picker) is
 * automatically sent to /api/media-library/upload so it lands in the media library too.
 */

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";
import MediaLibraryModal from "@/components/media/MediaLibraryModal";

// Mirror the shape from MediaLibraryModal's internal type
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

export interface BlockNoteEditorProps {
  initialContent?: Block[];
  onChange?: (blocks: Block[]) => void;
  editable?: boolean;
  /** Associates new uploads with a specific daily log in the media library */
  logId?: number;
  /** Minimum editor height in px — defaults to 200 */
  minHeight?: number;
}

function mimeToBlockType(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export default function BlockNoteEditor({
  initialContent,
  onChange,
  editable = true,
  logId,
  minHeight = 200,
}: BlockNoteEditorProps) {
  const [mediaLibOpen, setMediaLibOpen] = useState(false);

  // All uploads (drag-drop, paste, toolbar button) go to the media library API
  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    if (logId) formData.append("logId", String(logId));
    const res = await fetch("/api/media-library/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url as string;
  }

  const editor = useCreateBlockNote({ uploadFile, initialContent });

  // Insert a file picked from the media library at the current cursor position
  const handleMediaSelect = useCallback(
    (file: MediaFileItem) => {
      const type = mimeToBlockType(file.mimeType);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block: any = {
        type,
        props: {
          url: file.publicUrl,
          // "name" shows in file/video/audio blocks; "caption" in image blocks
          ...(type === "image"
            ? { caption: file.altText ?? file.fileName }
            : { name: file.fileName }),
        },
      };

      let referenceBlock: Block;
      try {
        referenceBlock = editor.getTextCursorPosition().block;
      } catch {
        // No cursor yet — append to end of document
        referenceBlock = editor.document[editor.document.length - 1];
      }

      editor.insertBlocks([block], referenceBlock, "after");
      setMediaLibOpen(false);
    },
    [editor],
  );

  // Read-only mode — no toolbar, no modal
  if (!editable) {
    return (
      <div style={{ minHeight }} className="blocknote-wrapper">
        <BlockNoteView editor={editor} editable={false} theme="light" />
      </div>
    );
  }

  return (
    <div className="blocknote-wrapper rounded-lg border border-gray-200 overflow-hidden">
      {/* ── Micro-toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setMediaLibOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 border border-transparent hover:border-gray-200 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all"
          title="Browse the media library and insert a file into the editor"
        >
          {/* Photo/film icon */}
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Media Library
        </button>
        <span className="ml-auto text-xs text-gray-400">
          Drag &amp; drop or paste to upload
        </span>
      </div>

      {/* ── Editor ─────────────────────────────────────────────────── */}
      <div style={{ minHeight }}>
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme="light"
          onChange={() => {
            if (onChange) onChange(editor.document);
          }}
        />
      </div>

      {/* ── Media Library Modal ─────────────────────────────────────── */}
      {mediaLibOpen && (
        <MediaLibraryModal
          open
          onClose={() => setMediaLibOpen(false)}
          onSelect={handleMediaSelect}
        />
      )}
    </div>
  );
}
