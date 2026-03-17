import React, { useEffect, useRef } from 'react';
import { Goal, UserProfile, Meeting, Update, Task, Initiative } from '@/types';
import MentorshipTimeline from '@/components/MentorshipTimeline';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FocusedItem {
    type: 'meeting' | 'update' | 'task';
    id: number;
}

interface TimelineRailProps {
    goal: Goal;
    currentUser: UserProfile | null;
    /** The currently focused item (highlighted in timeline + scrolled to in cards) */
    focusedItem: FocusedItem | null;
    /** Unified callback when a timeline item is clicked */
    onFocusItem: (item: FocusedItem) => void;
    /** Optional initiative filter — dims non-matching items when set */
    selectedInitiativeId?: number | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Left rail wrapper for the mentorship timeline.
 *
 * Responsibilities:
 * - Renders MentorshipTimeline with independent vertical scroll
 * - Translates individual click callbacks into unified `onFocusItem`
 * - Passes active item state down for highlight styling
 * - Auto-scrolls the timeline item into view when focused externally
 */
const TimelineRail: React.FC<TimelineRailProps> = ({
    goal,
    currentUser,
    focusedItem,
    onFocusItem,
    selectedInitiativeId,
}) => {
    const railRef = useRef<HTMLDivElement>(null);

    // ── Click handlers: translate individual types → unified FocusedItem ─────
    const handleMeetingClick = (meeting: Meeting) => {
        onFocusItem({ type: 'meeting', id: meeting.id });
    };

    const handleUpdateClick = (update: Update) => {
        onFocusItem({ type: 'update', id: update.id });
    };

    const handleTaskClick = (task: Task) => {
        onFocusItem({ type: 'task', id: task.id });
    };

    const handleInitiativeClick = (initiative: Initiative) => {
        // Initiatives don't focus a card — handled by the strip filter.
        // This is a no-op for now; may wire to initiative strip in a later phase.
        void initiative;
    };

    // ── Auto-scroll timeline to focused item ────────────────────────────────
    useEffect(() => {
        if (!focusedItem || !railRef.current) return;

        // Timeline items get IDs like "timeline-meeting-42" inside MentorshipTimeline
        const timelineItemId = `timeline-${focusedItem.type}-${focusedItem.id}`;
        const el = railRef.current.querySelector(`[data-timeline-id="${timelineItemId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [focusedItem]);

    return (
        <div
            ref={railRef}
            className="ap-h-full ap-overflow-y-auto ap-p-3"
        >
            <MentorshipTimeline
                goal={goal}
                currentUser={currentUser}
                onMeetingClick={handleMeetingClick}
                onUpdateClick={handleUpdateClick}
                onTaskClick={handleTaskClick}
                onInitiativeClick={handleInitiativeClick}
                activeItemId={focusedItem?.id ?? null}
                activeItemType={focusedItem?.type ?? null}
                selectedInitiativeId={selectedInitiativeId ?? null}
            />
        </div>
    );
};

export default TimelineRail;
