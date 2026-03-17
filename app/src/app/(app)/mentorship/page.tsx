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
      className={`ap-px-4 ap-py-2 ap-text-sm ap-font-medium ap-border-b-2 ap-transition-colors ${
        active ? "ap-border-brand-500 ap-text-brand-600" : "ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function RequestsList({ requests }: { requests: Request[] }) {
  if (!requests.length) return <EmptyState title="No requests" description="Mentorship connection requests will appear here." />;
  return (
    <ul className="ap-divide-y ap-divide-gray-100">
      {requests.map(r => (
        <li key={r.id} className="ap-flex ap-items-center ap-justify-between ap-px-5 ap-py-4">
          <span className="ap-text-sm ap-text-gray-700">Request #{r.id}</span>
          <Badge variant={r.status === "Pending" ? "warning" : r.status === "Accepted" ? "success" : "neutral"}>{r.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function GoalsList({ goals }: { goals: Goal[] }) {
  if (!goals.length) return <EmptyState title="No goals" description="Create goals on the Goals page." />;
  return (
    <ul className="ap-divide-y ap-divide-gray-100">
      {goals.map(g => (
        <li key={g.id} className="ap-flex ap-items-center ap-justify-between ap-px-5 ap-py-4">
          <div>
            <p className="ap-text-sm ap-font-medium ap-text-gray-900">{g.title}</p>
            {g.content && <p className="ap-text-xs ap-text-gray-500 ap-line-clamp-1">{g.content}</p>}
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
    <ul className="ap-divide-y ap-divide-gray-100">
      {meetings.map(m => (
        <li key={m.id} className="ap-px-5 ap-py-4">
          <p className="ap-text-sm ap-font-medium ap-text-gray-900">{m.title}</p>
          <p className="ap-text-xs ap-text-gray-400">{fmt(m.meetingDate)}</p>
          {m.content && <p className="ap-text-xs ap-text-gray-500 ap-mt-1 ap-line-clamp-2">{m.content}</p>}
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
    <div className="ap-mx-auto ap-max-w-3xl ap-space-y-4">
      <PageHeader title="Mentorship" description="Manage your mentorship connections, goals, and meetings.">
        <Button size="sm" onClick={() => setShowReqModal(true)}>+ Request Mentor</Button>
      </PageHeader>

      {showReqModal && (
        <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-bg-gray-900/50">
          <div className="ap-w-full ap-max-w-sm ap-rounded-2xl ap-bg-white ap-p-6 ap-shadow-xl">
            <h2 className="ap-mb-4 ap-text-lg ap-font-semibold ap-text-gray-900">Request Mentor</h2>
            <form onSubmit={sendRequest} className="ap-space-y-4">
              <div>
                <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Mentor User ID</label>
                <input className="ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm" type="number" value={receiverId} onChange={e => setReceiverId(e.target.value)} required />
              </div>
              <div className="ap-flex ap-justify-end ap-gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowReqModal(false)}>Cancel</Button>
                <Button size="sm" type="submit" disabled={saving}>{saving ? "Sending…" : "Send"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-shadow-sm">
        <div className="ap-flex ap-border-b ap-border-gray-100 ap-px-2">
          {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
        </div>
        <div className="ap-py-2">
          {tab === "Requests" && <RequestsList requests={reqData?.requests ?? []} />}
          {tab === "Goals"    && <GoalsList    goals={goalData?.goals ?? []} />}
          {tab === "Meetings" && <MeetingsList meetings={mtgData?.meetings ?? []} />}
        </div>
      </div>
    </div>
  );
}
