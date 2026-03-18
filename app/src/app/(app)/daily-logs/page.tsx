"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import dynamic from "next/dynamic";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import { apiClient, ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import type { Block } from "@blocknote/core";

// BlockNote must be client-only (no SSR)
const BlockNoteEditor = dynamic(
  () => import("@/components/editor/BlockNoteEditor"),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-gray-100" /> }
);

const MediaLibraryModal = dynamic(
  () => import("@/components/media/MediaLibraryModal"),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface HydratedLog {
  id: number;
  logDate: string;
  authorId: number;
  author: { id: number; name: string; avatarUrl: string | null };
  location: { id: number; name: string } | null;
  timeSlots: Array<{ id: number; label: string; color: string | null }>;
  tags: string | null;
  blocksJson: string | null;
  status: string;
  reactions: Record<string, number>;
  myReaction: string | null;
  commentCount: number;
  createdAt: string;
}

interface DateGroup {
  date: string;
  logs: HydratedLog[];
}

interface FeedResponse {
  groups: DateGroup[];
  total: number;
  page: number;
  limit: number;
}

interface TimeSlot {
  id: number;
  label: string;
  color: string | null;
}

interface Location {
  id: number;
  name: string;
}

interface CommentItem {
  id: number;
  logId: number;
  userId: number;
  content: string;
  createdAt: string;
  author: { id: number; name: string; avatarUrl: string | null };
  reactions: Record<string, number>;
  myReaction: string | null;
  isOwn: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMOJI: Record<string, string> = { thumbs_up: "\uD83D\uDC4D", heart: "\u2764\uFE0F", thumbs_down: "\uD83D\uDC4E" };
const REACTION_TYPES = ["thumbs_up", "heart", "thumbs_down"] as const;

function fmtDateHeader(iso: string): string {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (iso === today)     return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

function Avatar({ name, url, size = 8 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={"h-" + size + " w-" + size + " rounded-full object-cover"} />;
  }
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={"h-" + size + " w-" + size + " rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0"}>
      {initials || "?"}
    </div>
  );
}

function contentPreview(blocksJson: string | null): string {
  if (!blocksJson) return "";
  try {
    const blocks = JSON.parse(blocksJson) as Array<{ type: string; content?: unknown[] }>;
    const texts: string[] = [];
    for (const block of blocks.slice(0, 3)) {
      if (Array.isArray(block.content)) {
        for (const part of block.content) {
          if (typeof part === "object" && part !== null && "text" in part) {
            texts.push((part as { text: string }).text);
          }
        }
      }
    }
    return texts.join(" ").slice(0, 200);
  } catch {
    return "";
  }
}

// ─── Reaction Bar ─────────────────────────────────────────────────────────────

function ReactionBar({
  reactions,
  myReaction,
  onReact,
  commentCount,
  onCommentClick,
}: {
  reactions: Record<string, number>;
  myReaction: string | null;
  onReact: (type: string) => void;
  commentCount: number;
  onCommentClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTION_TYPES.map((type) => {
        const count = reactions[type] ?? 0;
        const active = myReaction === type;
        return (
          <button
            key={type}
            onClick={() => onReact(type)}
            className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-all " + (
              active
                ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                : count > 0
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "text-gray-400 hover:bg-gray-100"
            )}
          >
            <span>{EMOJI[type]}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
      <button
        onClick={onCommentClick}
        className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {commentCount > 0 && <span>{commentCount}</span>}
      </button>
    </div>
  );
}

// ─── Comments Section ─────────────────────────────────────────────────────────

function CommentsSection({
  logId,
  currentUserId,
}: {
  logId: number;
  currentUserId: number | undefined;
}) {
  void currentUserId;
  const { data: comments, loading, refetch } = useApi<CommentItem[]>(
    `/api/daily-logs/${logId}/comments`
  );
  const [text, setText] = useState("");
  const [submitting, startSubmit] = useTransition();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    startSubmit(async () => {
      await apiClient.post(`/api/daily-logs/${logId}/comments`, { content: text });
      setText("");
      refetch();
    });
  }, [text, logId, refetch]);

  const handleDeleteComment = useCallback(async (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/daily-logs/${logId}/comments?commentId=${commentId}`, { method: "DELETE" });
    refetch();
  }, [logId, refetch]);

  const handleCommentReact = useCallback(async (commentId: number, reactionType: string) => {
    await apiClient.post(`/api/daily-logs/${logId}/reactions`, {
      reactionType,
      objectType: "comment",
      objectId:   commentId,
    });
    refetch();
  }, [logId, refetch]);

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {loading && <p className="text-sm text-gray-400 py-2">Loading comments…</p>}
      {comments && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.author.name} url={c.author.avatarUrl} size={7} />
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl bg-gray-50 px-4 py-2.5">
                  <p className="text-xs font-semibold text-gray-800">{c.author.name}</p>
                  <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-gray-400">{fmtRelTime(c.createdAt)}</span>
                  {REACTION_TYPES.map((type) => {
                    const count = c.reactions[type] ?? 0;
                    const active = c.myReaction === type;
                    return (
                      <button
                        key={type}
                        onClick={() => handleCommentReact(c.id, type)}
                        className={"text-xs " + (active ? "font-semibold text-blue-600" : "text-gray-400 hover:text-gray-600")}
                      >
                        {EMOJI[type]}{count > 0 ? " " + count : ""}
                      </button>
                    );
                  })}
                  {c.isOwn && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 items-start">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Post
        </button>
      </form>
    </div>
  );
}

// ─── Log Composer ─────────────────────────────────────────────────────────────

function LogComposer({ locations, timeSlots, onCreated, onCancel, defaultDate }: {
  locations: Location[];
  timeSlots: TimeSlot[];
  onCreated: (log: HydratedLog) => void;
  onCancel: () => void;
  defaultDate?: string;
}) {
  const [date, setDate]             = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");
  const [selectedTs, setSelectedTs] = useState<number[]>([]);
  const [tags, setTags]             = useState("");
  const [blocks, setBlocks]         = useState<Block[]>([]);
  const [submitting, startSubmit]   = useTransition();
  const [err, setErr]               = useState<string | null>(null);

  function toggleTimeSlot(id: number) {
    setSelectedTs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) { setErr("Log date is required"); return; }
    startSubmit(async () => {
      setErr(null);
      try {
        const payload = {
          logDate:     date,
          locationId:  locationId ? parseInt(locationId, 10) : undefined,
          timeSlotIds: selectedTs.length > 0 ? selectedTs.join(",") : undefined,
          tags:        tags.trim() || undefined,
          blocksJson:  blocks.length > 0 ? JSON.stringify(blocks) : undefined,
          status:      "publish",
        };
        const log = await apiClient.post<HydratedLog>("/api/daily-logs", payload);
        onCreated(log);
      } catch (e) {
        setErr(e instanceof ApiError ? String(e.message) : "Failed to create log");
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm">
      <div className="flex items-center gap-2 border-b border-blue-100 px-5 py-3.5">
        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h3 className="text-sm font-semibold text-blue-900">New Daily Log</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Log Date <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">No location</option>
              {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          </div>
        </div>
        {timeSlots.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Time Slots</label>
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((ts) => (
                <button key={ts.id} type="button" onClick={() => toggleTimeSlot(ts.id)}
                  className={"rounded-full px-3 py-1 text-xs font-medium border transition-all " + (selectedTs.includes(ts.id) ? "border-blue-500 bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")}
                  style={ts.color && selectedTs.includes(ts.id) ? { backgroundColor: ts.color, borderColor: ts.color } : {}}>
                  {ts.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="lifeguard, inservice, certification"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Content</label>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <BlockNoteEditor onChange={setBlocks} editable={true} minHeight={200} />
          </div>
        </div>
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Publish Log
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({ log, currentUserId, onReact, onDeleted, onUpdated }: {
  log: HydratedLog;
  currentUserId: number | undefined;
  onReact: (logId: number, type: string) => void;
  onDeleted: (logId: number) => void;
  onUpdated: (log: HydratedLog) => void;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [editBlocks,   setEditBlocks]   = useState<Block[]>([]);
  const [editTags,     setEditTags]     = useState(log.tags ?? "");
  const [editLocation, setEditLocation] = useState(log.location ? String(log.location.id) : "");
  const [editSlots,    setEditSlots]    = useState<number[]>(log.timeSlots.map((t) => t.id));
  const [saving,       startSave]       = useTransition();
  const [deleting,     startDelete]     = useTransition();
  const [err,          setErr]          = useState<string | null>(null);

  const { data: locationsData } = useApi<Location[]>("/api/locations");
  const { data: timeSlotsData } = useApi<TimeSlot[]>("/api/time-slots");
  const locations = locationsData ?? [];
  const timeSlots = timeSlotsData ?? [];

  const isOwn      = currentUserId === log.author.id;
  const preview    = contentPreview(log.blocksJson);
  const hasContent = !!log.blocksJson;

  function handleDelete() {
    if (!confirm("Delete this log entry?")) return;
    startDelete(async () => {
      await fetch("/api/daily-logs/" + log.id, { method: "DELETE" });
      onDeleted(log.id);
    });
  }

  function startEdit() {
    setEditBlocks([]);
    setEditTags(log.tags ?? "");
    setEditLocation(log.location ? String(log.location.id) : "");
    setEditSlots(log.timeSlots.map((t) => t.id));
    setEditing(true);
    setExpanded(true);
  }

  function handleSave() {
    startSave(async () => {
      setErr(null);
      try {
        const updated = await apiClient.put<HydratedLog>("/api/daily-logs/" + log.id, {
          tags:        editTags.trim() || null,
          locationId:  editLocation ? parseInt(editLocation, 10) : null,
          timeSlotIds: editSlots.length > 0 ? editSlots.join(",") : null,
          blocksJson:  editBlocks.length > 0 ? JSON.stringify(editBlocks) : log.blocksJson,
        });
        onUpdated(updated);
        setEditing(false);
      } catch {
        setErr("Failed to save changes.");
      }
    });
  }

  function toggleSlot(id: number) {
    setEditSlots((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const initialContent = (() => {
    if (!log.blocksJson) return undefined;
    try { return JSON.parse(log.blocksJson) as Block[]; } catch { return undefined; }
  })();

  return (
    <article className={"rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md " + (editing ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200")}>
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <Avatar name={log.author.name} url={log.author.avatarUrl} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{log.author.name}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">{fmtRelTime(log.createdAt)}</span>
            {log.location && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {log.location.name}
                </span>
              </>
            )}
          </div>
          {log.timeSlots.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {log.timeSlots.map((ts) => (
                <span key={ts.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: ts.color ?? "#6366f1" }}>
                  {ts.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {isOwn && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={startEdit} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Edit">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={handleDelete} disabled={deleting} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {!editing && log.tags && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {log.tags.split(",").map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">#{tag}</span>
          ))}
        </div>
      )}

      {/* Edit mode */}
      {editing ? (
        <div className="px-5 pb-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <select value={editLocation} onChange={(e) => setEditLocation(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">No location</option>
                {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
              <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          {timeSlots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((ts) => (
                <button key={ts.id} type="button" onClick={() => toggleSlot(ts.id)}
                  className={"rounded-full px-3 py-1 text-xs font-medium border transition-all " + (editSlots.includes(ts.id) ? "border-blue-500 bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")}
                  style={ts.color && editSlots.includes(ts.id) ? { backgroundColor: ts.color, borderColor: ts.color } : {}}>
                  {ts.label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <BlockNoteEditor key={"edit-" + log.id} initialContent={initialContent} onChange={setEditBlocks} editable={true} minHeight={200} />
          </div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5">
          {hasContent ? (
            expanded ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden mb-3">
                <BlockNoteEditor key={"view-" + log.id} initialContent={initialContent} editable={false} minHeight={100} />
              </div>
            ) : (
              preview && <p className="pb-3 text-sm text-gray-700 line-clamp-3 leading-relaxed">{preview}</p>
            )
          ) : (
            <p className="pb-3 text-sm italic text-gray-400">No content written yet.</p>
          )}
          {hasContent && (
            <button onClick={() => setExpanded((v) => !v)} className="mb-3 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              {expanded ? "Show less ↑" : "Show more ↓"}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      {!editing && (
        <div className="border-t border-gray-100 px-5 py-3">
          <ReactionBar
            reactions={log.reactions}
            myReaction={log.myReaction}
            onReact={(type) => onReact(log.id, type)}
            commentCount={log.commentCount}
            onCommentClick={() => setExpanded((v) => !v)}
          />
          {expanded && <CommentsSection logId={log.id} currentUserId={currentUserId} />}
        </div>
      )}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DailyLogsPage() {
  const { data: meData } = usePermissions();
  const currentUserId = meData?.user.id;

  const [composerOpen,   setComposerOpen]   = useState(false);
  const [mediaLibOpen,   setMediaLibOpen]   = useState(false);
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [searchFilter,   setSearchFilter]   = useState("");
  const [page,           setPage]           = useState(1);
  const [groups,         setGroups]         = useState<DateGroup[] | null>(null);

  const { data: locationsData } = useApi<Location[]>("/api/locations");
  const { data: timeSlotsData } = useApi<TimeSlot[]>("/api/time-slots");

  const feedParams: Record<string, string> = {
    page: String(page), grouped: "true", limit: "50",
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
    ...(locationFilter ? { locationId: locationFilter } : {}),
    ...(searchFilter   ? { search: searchFilter }       : {}),
  };
  const { data: feedData, loading } = useApi<FeedResponse>("/api/daily-logs", feedParams);

  useEffect(() => { if (feedData) setGroups(feedData.groups); }, [feedData]);

  const locations = locationsData ?? [];
  const timeSlots = timeSlotsData  ?? [];

  const handleLogCreated = useCallback((newLog: HydratedLog) => {
    setComposerOpen(false);
    setGroups((prev) => {
      const base = prev ?? [];
      const existing = base.find((g) => g.date === newLog.logDate);
      if (existing) {
        return base.map((g) => g.date === newLog.logDate ? { ...g, logs: [newLog, ...g.logs] } : g);
      }
      return [...base, { date: newLog.logDate, logs: [newLog] }].sort((a, b) => b.date.localeCompare(a.date));
    });
  }, []);

  const handleLogDeleted = useCallback((logId: number) => {
    setGroups((prev) =>
      prev
        ? prev.map((g) => ({ ...g, logs: g.logs.filter((l) => l.id !== logId) })).filter((g) => g.logs.length > 0)
        : prev
    );
  }, []);

  const handleLogUpdated = useCallback((updated: HydratedLog) => {
    setGroups((prev) => {
      if (!prev) return prev;
      return prev
        .map((g) => {
          if (g.logs.some((l) => l.id === updated.id)) {
            if (g.date === updated.logDate) return { ...g, logs: g.logs.map((l) => l.id === updated.id ? updated : l) };
            return { ...g, logs: g.logs.filter((l) => l.id !== updated.id) };
          }
          return g;
        })
        .filter((g) => g.logs.length > 0);
    });
  }, []);

  const handleReact = useCallback(async (logId: number, reactionType: string) => {
    const res = await apiClient.post<{ reactions: Record<string, number>; myReaction: string | null }>(
      "/api/daily-logs/" + logId + "/reactions", { reactionType }
    );
    setGroups((prev) =>
      prev ? prev.map((g) => ({
        ...g,
        logs: g.logs.map((l) => l.id === logId ? { ...l, reactions: res.reactions, myReaction: res.myReaction } : l),
      })) : prev
    );
  }, []);

  const activeGroups = groups ?? feedData?.groups ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <PageHeader
        title="Daily Logs"
        subtitle="Journal entries grouped by date"
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setMediaLibOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Media Library
            </button>
            {!composerOpen && (
              <button onClick={() => setComposerOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Log
              </button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <input type="text" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
          placeholder="Search tags…"
          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        {locations.length > 0 && (
          <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" title="From date" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" title="To date" />
        </div>
        {(searchFilter || locationFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearchFilter(""); setLocationFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Clear filters</button>
        )}
      </div>

      {/* Inline composer */}
      {composerOpen && (
        <LogComposer locations={locations} timeSlots={timeSlots} onCreated={handleLogCreated} onCancel={() => setComposerOpen(false)} />
      )}

      {/* Feed */}
      {loading && !feedData ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : activeGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium">No daily logs found</p>
          {!composerOpen && (
            <button onClick={() => setComposerOpen(true)}
              className="mt-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Write the first entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {activeGroups.map((group) => (
            <section key={group.date}>
              <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 bg-white/90 py-2 backdrop-blur-sm">
                <h2 className="text-sm font-bold text-gray-900">{fmtDateHeader(group.date)}</h2>
                <div className="flex-1 border-t border-gray-200" />
                <span className="shrink-0 text-xs text-gray-400">
                  {group.logs.length} entr{group.logs.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <div className="space-y-4">
                {group.logs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentUserId={currentUserId}
                    onReact={handleReact}
                    onDeleted={handleLogDeleted}
                    onUpdated={handleLogUpdated}
                  />
                ))}
              </div>
            </section>
          ))}
          {feedData && feedData.total > feedData.limit && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                ← Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {Math.ceil(feedData.total / feedData.limit)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(feedData.total / feedData.limit)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {mediaLibOpen && (
        <MediaLibraryModal open={mediaLibOpen} onClose={() => setMediaLibOpen(false)} />
      )}
    </div>
  );
}
