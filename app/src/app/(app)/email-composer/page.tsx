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

  const inputCls = "ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-px-3 ap-py-2 ap-text-sm focus:ap-border-brand-500 focus:ap-outline-none";

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
    <div className="ap-mx-auto ap-max-w-4xl ap-space-y-4">
      <PageHeader title="Email Composer" description="Compose and send emails to staff members." />

      <div className="ap-grid ap-gap-4 lg:ap-grid-cols-3">
        {/* Templates sidebar */}
        <div className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-4 ap-shadow-sm">
          <h2 className="ap-mb-3 ap-text-xs ap-font-semibold ap-uppercase ap-tracking-wider ap-text-gray-400">Templates</h2>
          {data.templates.length === 0 ? (
            <p className="ap-text-xs ap-text-gray-400">No templates saved</p>
          ) : (
            <ul className="ap-space-y-1">
              {data.templates.map(t => (
                <li key={t.id}>
                  <button onClick={() => loadTemplate(t)} className="ap-w-full ap-rounded-lg ap-px-3 ap-py-2 ap-text-left ap-text-sm ap-text-gray-700 hover:ap-bg-gray-50 ap-transition-colors">
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose form */}
        <div className="lg:ap-col-span-2 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-shadow-sm">
          {sent && <div className="ap-mb-4 ap-rounded-lg ap-bg-green-50 ap-px-4 ap-py-2 ap-text-sm ap-text-green-700">✓ Email sent successfully!</div>}
          <form onSubmit={send} className="ap-space-y-4">
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Recipient User IDs <span className="ap-text-gray-400">(comma-separated)</span></label>
              <input className={inputCls} value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="1, 2, 3" required />
            </div>
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Subject</label>
              <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="ap-mb-1 ap-block ap-text-xs ap-font-medium ap-text-gray-600">Body</label>
              <textarea className={`${inputCls} ap-h-48 ap-resize-none ap-font-mono ap-text-xs`} value={body} onChange={e => setBody(e.target.value)} required />
            </div>
            <div className="ap-flex ap-justify-end">
              <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send Email"}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
