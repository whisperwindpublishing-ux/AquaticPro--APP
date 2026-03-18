"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient } from "@/lib/api-client";
import { usePermissions } from "@/hooks/usePermissions";
import { FullPageSpinner, EmptyState, Button, PageHeader } from "@/components/ui";

interface Template { id: number; name: string; subject: string; body: string; }

export default function EmailComposerPage() {
  const { data: permData } = usePermissions();
  const permissions = permData?.permissions;
  const { data, loading, error } = useApi<{ templates: Template[] }>("/api/email-composer?section=templates");

  const [subject, setSubject]     = useState("");
  const [body, setBody]           = useState("");
  const [recipients, setRecipients] = useState("");
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

  if (!permissions?.isAdmin) return <EmptyState title="Access denied" description="Admin access required." />;
  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load templates" description="Please refresh." />;

  function loadTemplate(t: Template) {
    setSubject(t.subject);
    setBody(t.body);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const recipientIds = recipients.split(",").map(s => Number(s.trim())).filter(Boolean);
      await apiClient.post("/api/email-composer", { action: "send", subject, body, recipientIds });
      setSent(true);
      setSubject(""); setBody(""); setRecipients("");
      setTimeout(() => setSent(false), 3000);
    } finally { setSending(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Email Composer" description="Compose and send emails to staff members." />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Templates sidebar */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Templates</h2>
          {data.templates.length === 0 ? (
            <p className="text-xs text-gray-400">No templates saved</p>
          ) : (
            <ul className="space-y-1">
              {data.templates.map(t => (
                <li key={t.id}>
                  <button onClick={() => loadTemplate(t)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose form */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          {sent && <div className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">✓ Email sent successfully!</div>}
          <form onSubmit={send} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Recipient User IDs <span className="text-gray-400">(comma-separated)</span></label>
              <input className={inputCls} value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="1, 2, 3" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
              <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Body</label>
              <textarea className={`${inputCls} h-48 resize-none font-mono text-xs`} value={body} onChange={e => setBody(e.target.value)} required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send Email"}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
