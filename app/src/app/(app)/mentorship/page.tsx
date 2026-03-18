"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Badge, Button, PageHeader } from "@/components/ui";

const TABS = ["Requests", "Goals", "Meetings"] as const;
type Tab = typeof TABS[number];

interface Request  { id: number; authorId: number; receiverId: number; status: string; createdAt: string; }
interface Goal     { id: number; title: string; status: string; content: string | null; }
interface Meeting  { id: number; title: string; meetingDate: string | null; content: string | null; goalId: number; }

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function RequestsList({ requests }: { requests: Request[] }) {
  if (!requests.length) return <EmptyState title="No requests" description="Mentorship connection requests will appear here." />;
  return (
    <ul className="divide-y divide-gray-100">
      {requests.map(r => (
        <li key={r.id} className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-gray-700">Request #{r.id}</span>
          <Badge variant={r.status === "Pending" ? "warning" : r.status === "Accepted" ? "success" : "neutral"}>{r.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function GoalsList({ goals }: { goals: Goal[] }) {
  if (!goals.length) return <EmptyState title="No goals" description="Create goals on the Goals page." />;
  return (
    <ul className="divide-y divide-gray-100">
      {goals.map(g => (
        <li key={g.id} className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{g.title}</p>
            {g.content && <p className="text-xs text-gray-500 line-clamp-1">{g.content}</p>}
          </div>
          <Badge variant={g.status === "Completed" ? "success" : g.status === "In Progress" ? "info" : "neutral"}>{g.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  if (!meetings.length) return <EmptyState title="No meetings" description="Scheduled meetings will appear here." />;
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD";
  return (
    <ul className="divide-y divide-gray-100">
      {meetings.map(m => (
        <li key={m.id} className="px-5 py-4">
          <p className="text-sm font-medium text-gray-900">{m.title}</p>
          <p className="text-xs text-gray-400">{fmt(m.meetingDate)}</p>
          {m.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.content}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function MentorshipPage() {
  const [tab, setTab]           = useState<Tab>("Requests");
  const [showReqModal, setShowReqModal] = useState(false);
  const [receiverId, setReceiverId]     = useState("");
  const [saving, setSaving]             = useState(false);

  const { data: reqData,  loading: l1, refetch: r1 } = useApi<{ requests: Request[] }>("/api/mentorship?section=requests");
  const { data: goalData, loading: l2 }              = useApi<{ goals: Goal[] }>("/api/mentorship?section=goals");
  const { data: mtgData,  loading: l3 }              = useApi<{ meetings: Meeting[] }>("/api/mentorship?section=meetings");

  const loading = l1 || l2 || l3;
  if (loading) return <FullPageSpinner />;

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await apiClient.post("/api/mentorship", { action: "request", receiverId: Number(receiverId) }); r1(); setShowReqModal(false); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Mentorship" description="Manage your mentorship connections, goals, and meetings.">
        <Button size="sm" onClick={() => setShowReqModal(true)}>+ Request Mentor</Button>
      </PageHeader>

      {showReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Request Mentor</h2>
            <form onSubmit={sendRequest} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Mentor User ID</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" type="number" value={receiverId} onChange={e => setReceiverId(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowReqModal(false)}>Cancel</Button>
                <Button size="sm" type="submit" disabled={saving}>{saving ? "Sending…" : "Send"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex border-b border-gray-100 px-2">
          {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
        </div>
        <div className="py-2">
          {tab === "Requests" && <RequestsList requests={reqData?.requests ?? []} />}
          {tab === "Goals"    && <GoalsList    goals={goalData?.goals ?? []} />}
          {tab === "Meetings" && <MeetingsList meetings={mtgData?.meetings ?? []} />}
        </div>
      </div>
    </div>
  );
}
