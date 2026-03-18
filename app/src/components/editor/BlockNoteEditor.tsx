"use client";

/**
 * BlockNoteEditor
 *
 * A full-featured rich-text editor using BlockNote 0.47.x + Mantine.
 * Supports images, files, video, audio with uploads to /api/media-library/upload.
 *
 * Usage:
 *   <BlockNoteEditor
 *     initialContent={blocksJson ? JSON.parse(blocksJson) : undefined}
 *     onChange={(json) => setBlocksJson(JSON.stringify(json))}
 *     editable={true}
 *     logId={123}  // optional: associates uploaded media with a specific log
 *   />
 *
 * For read-only display:
 *   <BlockNoteEditor initialContent={JSON.parse(log.blocksJson)} editable={false} />
 */

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";

interface BlockNoteEditorProps {
  initialContent?: Block[];
  onChange?: (blocks: Block[]) => void;
  editable?: boolean;
  logId?: number;
  placeholder?: string;
  /** Minimum height in px, defaults to 200 */
  minHeight?: number;
}

export default function BlockNoteEditor({
  initialContent,
  onChange,
  editable = true,
  logId,
  minHeight = 200,
}: BlockNoteEditorProps) {
  /**
   * File upload handler — sends the file to our media library API and returns
   * the public URL that BlockNote stores in the block JSON.
   */
  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    if (logId) formData.append("logId", String(logId));

    const res = await fetch("/api/media-library/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url as string;
  }

  const editor = useCreateBlockNote({
    uploadFile,
    initialContent,
  });

  return (
    <div style={{ minHeight }} className="blocknote-wrapper">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        onChange={() => {
          if (onChange) onChange(editor.document);
        }}
      />
    </div>
  );
}
