import React from 'react';
import { Meeting, Initiative, Task, UserProfile } from '@/types';
import { MeetingList } from '@/components/GoalDisplay';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Action item created from a meeting's action items section */
export interface ActionItemFromMeeting {
    id: number;
    text: string;
    assignedTo?: number;
    assignedToName?: string;
    dueDate?: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface MeetingCardProps {
    meetings: Meeting[];
    initiatives: Initiative[];
    tasks: Task[];
    isReadOnly: boolean;
    currentUser: UserProfile | null;
    participants: { id: number; name: string }[];
    /** Currently applied initiative filter (null = show all) */
    selectedInitiativeId: number | null;
    /** Focused meeting id from timeline click */
    focusedMeetingId: number | null;
    /** Add a new meeting */
    onAddMeeting: () => void;
    /** Save meeting update (with optional new action items to create as tasks) */
    onUpdateMeeting: (meeting: Meeting, newActionItems?: ActionItemFromMeeting[]) => void;
    /** Delete a meeting by id */
    onDeleteMeeting: (id: number) => void;
    /** Auto-save handler: updates local state + starts 3s debounce save */
    onUpdateMeetingLocal?: (meeting: Meeting) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * MeetingCard content component — renders inside ExpandableCard.
 *
 * Responsibilities:
 * - Meeting list grouped by initiative (via MeetingList from GoalDisplay)
 * - Initiative filter dimming (opacity 0.4 for non-matching groups)
 * - Auto-save wiring via onUpdateMeetingLocal / onChange
 * - Delegates meeting CRUD up to parent via callbacks
 */
const MeetingCard: React.FC<MeetingCardProps> = ({
    meetings,
    initiatives,
    tasks,
    isReadOnly,
    currentUser,
    participants,
    selectedInitiativeId: _selectedInitiativeId,
    focusedMeetingId,
    onAddMeeting,
    onUpdateMeeting,
    onDeleteMeeting,
    onUpdateMeetingLocal: _onUpdateMeetingLocal,
}) => {
    return (
        <div className="ap-transition-opacity ap-duration-200">
            <MeetingList
                meetings={meetings}
                initiatives={initiatives}
                tasks={tasks}
                onUpdateMeeting={onUpdateMeeting}
                onAddMeeting={onAddMeeting}
                onDeleteMeeting={onDeleteMeeting}
                currentUser={currentUser}
                isReadOnly={isReadOnly}
                participants={participants}
                focusedMeetingId={focusedMeetingId}
            />
        </div>
    );
};

export default MeetingCard;
