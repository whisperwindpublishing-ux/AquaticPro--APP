"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient, ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeSlot {
  id: number;
  slug: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

// ─── Add Slot Form ────────────────────────────────────────────────────────────

function AddSlotForm({ onAdded }: { onAdded: (slot: TimeSlot) => void }) {
  const [label,     setLabel]     = useState("");
  const [color,     setColor]     = useState("#7c3aed");
  const [sortOrder, setSortOrder] = useState("");
  const [saving, start] = useTransition();
  const [err, setErr]   = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setErr("Label is required"); return; }
    start(async () => {
      setErr(null);
      try {
        const slot = await apiClient.post<TimeSlot>("/api/time-slots", {
          label:     label.trim(),
          color:     color,
          sortOrder: sortOrder ? parseInt(sortOrder, 10) : undefined,
          isActive:  true,
        });
        onAdded(slot);
        setLabel("");
        setColor("#7c3aed");
        setSortOrder("");
      } catch (e) {
        setErr(e instanceof ApiError ? String(e.message) : "Failed to create time slot");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Add New Time Slot</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Morning Shift"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="Auto"
            min={0}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded-lg border border-gray-200 p-1"
          />
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: color }}>
            {label || "Preview"}
          </span>
          <span className="text-xs text-gray-400">{color}</span>
        </div>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          Add Time Slot
        </button>
      </div>
    </form>
  );
}

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

function SlotRow({ slot, onUpdated, onDeleted }: {
  slot: TimeSlot;
  onUpdated: (s: TimeSlot) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing,   setEditing]   = useState(false);
  const [label,     setLabel]     = useState(slot.label);
  const [color,     setColor]     = useState(slot.color ?? "#7c3aed");
  const [sortOrder, setSortOrder] = useState(String(slot.sortOrder));
  const [isActive,  setIsActive]  = useState(slot.isActive);
  const [saving, startSave]       = useTransition();
  const [deleting, startDelete]   = useTransition();
  const [err, setErr]             = useState<string | null>(null);

  function handleSave() {
    if (!label.trim()) { setErr("Label is required"); return; }
    startSave(async () => {
      setErr(null);
      try {
        const updated = await apiClient.put<TimeSlot>(`/api/time-slots/${slot.id}`, {
          label:     label.trim(),
          color:     color,
          sortOrder: parseInt(sortOrder, 10) || slot.sortOrder,
          isActive,
        });
        onUpdated(updated);
        setEditing(false);
      } catch (e) {
        setErr(e instanceof ApiError ? String(e.message) : "Failed to save");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${slot.label}"? This cannot be undone.`)) return;
    startDelete(async () => {
      await fetch(`/api/time-slots/${slot.id}`, { method: "DELETE" });
      onDeleted(slot.id);
    });
  }

  function handleToggleActive() {
    startSave(async () => {
      try {
        const updated = await apiClient.put<TimeSlot>(`/api/time-slots/${slot.id}`, {
          isActive: !isActive,
        });
        onUpdated(updated);
        setIsActive(!isActive);
      } catch {
        // noop
      }
    });
  }

  if (editing) {
    return (
      <tr className="bg-purple-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
            />
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: color }}>
              {label || "preview"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{slot.slug}</td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </td>
        <td className="px-4 py-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={isActive} onChange={() => setIsActive((v) => !v)} className="sr-only peer" />
            <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-purple-600 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 after:content-['']" />
          </label>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {err && <span className="text-xs text-red-600">{err}</span>}
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: slot.color ?? "#7c3aed" }}>
          {slot.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-800">{slot.label}</td>
      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{slot.slug}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{slot.sortOrder}</td>
      <td className="px-4 py-3">
        <button onClick={handleToggleActive} disabled={saving}
          className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors " + (
            slot.isActive
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          )}>
          {slot.isActive ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Edit">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDailyLogsPage() {
  const { data, loading, error } = useApi<TimeSlot[]>("/api/time-slots", { all: "true" });
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);

  const activeSlots = slots ?? data ?? [];

  function handleAdded(slot: TimeSlot) {
    setSlots([...activeSlots, slot].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  function handleUpdated(updated: TimeSlot) {
    setSlots(activeSlots.map((s) => s.id === updated.id ? updated : s));
  }

  function handleDeleted(id: number) {
    setSlots(activeSlots.filter((s) => s.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Admin
      </Link>
      <PageHeader
        title="Daily Logs Settings"
        subtitle="Manage time slots that staff can tag on their daily log entries"
      />

      <AddSlotForm onAdded={handleAdded} />

      {/* Time Slots Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">Time Slots</h3>
          <span className="text-xs text-gray-400">{activeSlots.length} slot{activeSlots.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load time slots.</p>
        ) : activeSlots.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            No time slots yet. Add one above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeSlots.map((slot) => (
                  <SlotRow key={slot.id} slot={slot} onUpdated={handleUpdated} onDeleted={handleDeleted} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How time slots work</p>
        <ul className="space-y-1 text-blue-600 text-xs list-disc list-inside">
          <li>Active slots appear in the daily log composer for staff to select.</li>
          <li>Inactive slots are hidden from new logs but preserved on existing entries.</li>
          <li>Each slot has a color that appears as a pill on log cards.</li>
          <li>Sort order controls the display order in the composer.</li>
        </ul>
      </div>
    </div>
  );
}
