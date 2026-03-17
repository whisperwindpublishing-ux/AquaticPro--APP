"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { apiClient, ApiError } from "@/lib/api-client";
import { FullPageSpinner, EmptyState, Button, PageHeader, Badge } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deck  { id: number; deckName: string; description: string | null; isPublic: boolean }
interface List  { id: number; deckId: number; listName: string; sortOrder: number }
interface Card  { id: number; listId: number; title: string; description: string | null; isComplete: boolean; assignedTo: number | null; dueDate: string | null }

interface DecksResponse { decks: Deck[]; total: number }
interface BoardResponse { deck: Deck; lists: List[]; cards: Card[] }

// ─── Deck Grid ────────────────────────────────────────────────────────────────

function DeckGrid({ onSelect }: { onSelect: (id: number) => void }) {
  const { data, loading, error } = useApi<DecksResponse>("/api/taskdeck", { section: "decks" });

  if (loading) return <FullPageSpinner />;
  if (error)   return <EmptyState title="Could not load decks" description={error.status === 403 ? "TaskDeck access required." : "An error occurred."} />;
  if (!data?.decks.length) return <EmptyState title="No decks found" description="Ask your admin to create a task deck." />;

  return (
    <div className="ap-grid ap-grid-cols-1 ap-gap-4 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
      {data.decks.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className="ap-rounded-xl ap-border ap-border-gray-100 ap-bg-white ap-p-5 ap-text-left ap-shadow-sm ap-transition-shadow hover:ap-shadow-md"
        >
          <div className="ap-flex ap-items-start ap-justify-between ap-gap-2">
            <h3 className="ap-text-sm ap-font-semibold ap-text-gray-900">{d.deckName}</h3>
            {d.isPublic && <Badge variant="info">Public</Badge>}
          </div>
          {d.description && <p className="ap-mt-1.5 ap-text-xs ap-text-gray-500 ap-line-clamp-2">{d.description}</p>}
        </button>
      ))}
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ card, onToggle }: { card: Card; onToggle: (id: number, done: boolean) => void }) {
  const overdue = card.dueDate && !card.isComplete && new Date(card.dueDate) < new Date();
  return (
    <div className={`ap-rounded-lg ap-border ap-bg-white ap-p-3 ap-shadow-sm ${card.isComplete ? "ap-opacity-60" : ""}`}>
      <div className="ap-flex ap-items-start ap-gap-2">
        <input
          type="checkbox"
          checked={card.isComplete}
          onChange={() => onToggle(card.id, !card.isComplete)}
          className="ap-mt-0.5 ap-h-4 ap-w-4 ap-cursor-pointer ap-rounded ap-border-gray-300"
        />
        <div className="ap-min-w-0 ap-flex-1">
          <p className={`ap-text-sm ap-font-medium ${card.isComplete ? "ap-line-through ap-text-gray-400" : "ap-text-gray-800"}`}>
            {card.title}
          </p>
          {card.description && <p className="ap-mt-0.5 ap-text-xs ap-text-gray-400 ap-line-clamp-2">{card.description}</p>}
          {card.dueDate && (
            <p className={`ap-mt-1 ap-text-xs ap-font-medium ${overdue ? "ap-text-error-600" : "ap-text-gray-400"}`}>
              Due {new Date(card.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ deckId, onBack }: { deckId: number; onBack: () => void }) {
  const { data, loading, error, refetch } = useApi<BoardResponse>("/api/taskdeck", { section: "cards", deckId: String(deckId) });
  const [newCardListId, setNewCardListId] = useState<number | null>(null);
  const [newCardTitle,  setNewCardTitle]  = useState("");
  const [submitting,    setSubmitting]    = useState(false);

  async function toggleCard(id: number, isComplete: boolean) {
    await apiClient.patch("/api/taskdeck", { type: "card", id, isComplete });
    refetch();
  }

  async function addCard(listId: number) {
    if (!newCardTitle.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/api/taskdeck", { type: "card", listId, title: newCardTitle.trim() });
      setNewCardTitle(""); setNewCardListId(null); refetch();
    } catch (e) {
      alert(e instanceof ApiError ? JSON.stringify(e.data) : "Failed.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <FullPageSpinner />;
  if (error || !data) return <EmptyState title="Could not load board" description="An error occurred." />;

  const byList = data.lists.reduce<Record<number, Card[]>>((acc, l) => {
    acc[l.id] = data.cards.filter((c) => c.listId === l.id);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={data.deck.deckName}
        subtitle={data.deck.description ?? undefined}
        right={<Button variant="ghost" size="sm" onClick={onBack}>← Back to Decks</Button>}
      />
      <div className="ap-flex ap-gap-4 ap-overflow-x-auto ap-pb-4">
        {data.lists.map((list) => (
          <div key={list.id} className="ap-w-72 ap-shrink-0">
            <div className="ap-mb-2 ap-flex ap-items-center ap-justify-between">
              <h3 className="ap-text-sm ap-font-semibold ap-text-gray-700">{list.listName}</h3>
              <span className="ap-text-xs ap-text-gray-400">{byList[list.id]?.length ?? 0}</span>
            </div>
            <div className="ap-space-y-2 ap-rounded-xl ap-border ap-border-gray-100 ap-bg-gray-50 ap-p-2 ap-min-h-24">
              {(byList[list.id] ?? []).map((card) => (
                <KanbanCard key={card.id} card={card} onToggle={toggleCard} />
              ))}
              {newCardListId === list.id ? (
                <div className="ap-rounded-lg ap-border ap-border-brand-200 ap-bg-white ap-p-2">
                  <input
                    autoFocus value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard(list.id)}
                    placeholder="Card title…"
                    className="ap-w-full ap-bg-transparent ap-p-1 ap-text-sm ap-text-gray-800 focus:ap-outline-none"
                  />
                  <div className="ap-mt-2 ap-flex ap-gap-1.5">
                    <Button size="sm" loading={submitting} onClick={() => addCard(list.id)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setNewCardListId(null); setNewCardTitle(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setNewCardListId(list.id); setNewCardTitle(""); }}
                  className="ap-flex ap-w-full ap-items-center ap-gap-1 ap-rounded-lg ap-px-2 ap-py-1.5 ap-text-xs ap-text-gray-400 hover:ap-bg-gray-100 hover:ap-text-gray-600"
                >
                  <svg className="ap-h-3.5 ap-w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add card
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaskDeckPage() {
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);

  if (activeDeckId !== null)
    return <div className="ap-mx-auto ap-max-w-full"><KanbanBoard deckId={activeDeckId} onBack={() => setActiveDeckId(null)} /></div>;

  return (
    <div className="ap-mx-auto ap-max-w-4xl">
      <PageHeader title="Task Deck" subtitle="Manage your task boards and cards" />
      <DeckGrid onSelect={setActiveDeckId} />
    </div>
  );
}
