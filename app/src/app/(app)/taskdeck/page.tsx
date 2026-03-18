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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.decks.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className="rounded-xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{d.deckName}</h3>
            {d.isPublic && <Badge variant="info">Public</Badge>}
          </div>
          {d.description && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{d.description}</p>}
        </button>
      ))}
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ card, onToggle }: { card: Card; onToggle: (id: number, done: boolean) => void }) {
  const overdue = card.dueDate && !card.isComplete && new Date(card.dueDate) < new Date();
  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm ${card.isComplete ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={card.isComplete}
          onChange={() => onToggle(card.id, !card.isComplete)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${card.isComplete ? "line-through text-gray-400" : "text-gray-800"}`}>
            {card.title}
          </p>
          {card.description && <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{card.description}</p>}
          {card.dueDate && (
            <p className={`mt-1 text-xs font-medium ${overdue ? "text-error-600" : "text-gray-400"}`}>
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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.lists.map((list) => (
          <div key={list.id} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{list.listName}</h3>
              <span className="text-xs text-gray-400">{byList[list.id]?.length ?? 0}</span>
            </div>
            <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-2 min-h-24">
              {(byList[list.id] ?? []).map((card) => (
                <KanbanCard key={card.id} card={card} onToggle={toggleCard} />
              ))}
              {newCardListId === list.id ? (
                <div className="rounded-lg border border-brand-200 bg-white p-2">
                  <input
                    autoFocus value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard(list.id)}
                    placeholder="Card title…"
                    className="w-full bg-transparent p-1 text-sm text-gray-800 focus:outline-none"
                  />
                  <div className="mt-2 flex gap-1.5">
                    <Button size="sm" loading={submitting} onClick={() => addCard(list.id)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setNewCardListId(null); setNewCardTitle(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setNewCardListId(list.id); setNewCardTitle(""); }}
                  className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
    return <div className="mx-auto max-w-full"><KanbanBoard deckId={activeDeckId} onBack={() => setActiveDeckId(null)} /></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Task Deck" subtitle="Manage your task boards and cards" />
      <DeckGrid onSelect={setActiveDeckId} />
    </div>
  );
}
