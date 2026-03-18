"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader } from "@/components/ui";

interface Goal {
  id: number;
  title: string;
  content: string | null;
  status: string;
  isPortfolio: boolean;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, "success" | "info" | "neutral" | "warning"> = {
  "Completed": "success",
  "In Progress": "info",
  "Not Started": "neutral",
  "On Hold": "warning",
};

function GoalModal({ goal, onClose, onSaved }: { goal?: Goal; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle]     = useState(goal?.title ?? "");
  const [content, setContent] = useState(goal?.content ?? "");
  const [status, setStatus]   = useState(goal?.status ?? "Not Started");
  const [saving, setSaving]   = useState(false);
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (goal?.id) {
        await apiClient.patch("/api/goals", { id: goal.id, title, content: content || null, status });
      } else {
        await apiClient.post("/api/goals", { title, content: content || null, status, mentorshipId: 1 });
      }
      onSaved();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{goal ? "Edit Goal" : "New Goal"}</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <textarea className={`${inputCls} h-24 resize-none`} value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              {["Not Started", "In Progress", "Completed", "On Hold"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
            <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { data, loading, error, refetch } = useApi<{ goals: Goal[]; total: number }>("/api/goals");
  const [editing, setEditing]   = useState<Goal | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  // Realtime: re-fetch goals whenever any row in MentorshipGoal changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "MentorshipGoal" },
        () => { refetch(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refetch]);

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load goals" description="Please refresh." />;

  const goals = data.goals ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Goals" description="Your mentorship and growth goals.">
        <Button size="sm" onClick={() => { setEditing(undefined); setShowModal(true); }}>+ New Goal</Button>
      </PageHeader>

      {(showModal || editing !== undefined) && (
        <GoalModal
          goal={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={refetch}
        />
      )}

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" description="Create your first goal to get started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map(g => (
            <div key={g.id} className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{g.title}</h3>
                <Badge variant={STATUS_VARIANT[g.status] ?? "neutral"}>{g.status}</Badge>
              </div>
              {g.content && <p className="text-xs text-gray-500 line-clamp-3">{g.content}</p>}
              <button onClick={() => { setEditing(g); setShowModal(false); }} className="mt-auto self-end text-xs text-brand-600 hover:underline">
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
