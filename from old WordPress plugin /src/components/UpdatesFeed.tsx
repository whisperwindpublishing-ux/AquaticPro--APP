import React, { useState, useCallback } from 'react';
import { Update, UserProfile } from '@/types';
import {
    HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleIcon,
    HiOutlineArrowsPointingOut as ExpandIcon,
    HiOutlineArrowsPointingIn as CollapseIcon,
} from 'react-icons/hi2';
import { UpdateItem, EmptyState } from '@/components/GoalDisplay';
import UpdateComposer from '@/components/UpdateComposer';

// ─── Props ───────────────────────────────────────────────────────────────────

interface UpdatesFeedProps {
    goalId: number;
    updates: Update[];
    currentUser: UserProfile | null;
    isReadOnly: boolean;
    /** Focused update id from timeline click */
    focusedUpdateId: number | null;
    /** Called to post a new update */
    onAddUpdate?: (newUpdate: Omit<Update, 'id' | 'author' | 'date'>) => Promise<void>;
    /** Called to save edits to an existing update */
    onUpdateUpdate?: (update: Update) => Promise<void>;
    /** Called to delete an update */
    onDeleteUpdate?: (updateId: number) => Promise<void>;
    /** Expanded state of the right panel */
    isExpanded: boolean;
    /** Toggle expanded state */
    onToggleExpanded: () => void;
    /** Variant: 'panel' for right sidebar, 'mobile' for stacked mobile view */
    variant?: 'panel' | 'mobile';
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Updates feed component for the right panel of the workspace.
 *
 * Panel variant: full panel with header, expand/collapse button, composer, and feed.
 * Mobile variant: bare card content without panel header (header provided by parent).
 *
 * Features:
 * - Header with count badge and expand/collapse toggle (panel only)
 * - UpdateComposer with draft persistence at top
 * - Scrollable update list with per-update comments
 * - Focus highlight for timeline click-to-scroll
 */
const UpdatesFeed: React.FC<UpdatesFeedProps> = ({
    goalId,
    updates,
    currentUser,
    isReadOnly,
    focusedUpdateId,
    onAddUpdate,
    onUpdateUpdate,
    onDeleteUpdate,
    isExpanded,
    onToggleExpanded,
    variant = 'panel',
}) => {
    const [isPosting, setIsPosting] = useState(false);

    const handlePost = useCallback(
        async (newUpdate: Omit<Update, 'id' | 'author' | 'date'>) => {
            if (!onAddUpdate) return;
            await onAddUpdate(newUpdate);
        },
        [onAddUpdate]
    );

    if (variant === 'mobile') {
        return (
            <div>
                {/* Composer */}
                {!isReadOnly && currentUser && onAddUpdate && (
                    <UpdateComposer
                        goalId={goalId}
                        onPost={handlePost}
                        isPosting={isPosting}
                        onPostingChange={setIsPosting}
                        variant="mobile"
                    />
                )}

                {/* Feed */}
                <div className="ap-space-y-4">
                    {updates.length > 0 ? (
                        updates.map(update => (
                            <UpdateItem
                                key={update.id}
                                update={update}
                                currentUser={currentUser}
                                onUpdate={onUpdateUpdate}
                                onDelete={onDeleteUpdate}
                                isReadOnly={isReadOnly}
                                isFocused={focusedUpdateId === update.id}
                            />
                        ))
                    ) : (
                        <EmptyState>No updates yet. Share your progress!</EmptyState>
                    )}
                </div>
            </div>
        );
    }

    // ── Panel variant (right sidebar) ───────────────────────────────────────

    return (
        <div className="ap-flex ap-flex-col ap-h-full">
            {/* Panel header */}
            <div className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-3 ap-border-b ap-border-gray-100 ap-flex-shrink-0">
                <div className="ap-flex ap-items-center ap-gap-2">
                    <ChatBubbleIcon className="ap-h-5 ap-w-5 ap-text-orange-500" />
                    <h3 className="ap-font-semibold ap-text-gray-900 ap-text-sm">Updates</h3>
                    <span className="ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full ap-bg-orange-50 ap-text-orange-600">
                        {updates.length}
                    </span>
                </div>
                <button
                    onClick={onToggleExpanded}
                    className="ap-text-gray-400 hover:ap-text-gray-600 ap-transition-colors"
                    title={isExpanded ? 'Collapse panel' : 'Expand panel'}
                >
                    {isExpanded ? (
                        <CollapseIcon className="ap-h-4 ap-w-4" />
                    ) : (
                        <ExpandIcon className="ap-h-4 ap-w-4" />
                    )}
                </button>
            </div>

            {/* Composer */}
            {!isReadOnly && currentUser && onAddUpdate && (
                <UpdateComposer
                    goalId={goalId}
                    onPost={handlePost}
                    isPosting={isPosting}
                    onPostingChange={setIsPosting}
                    variant="panel"
                />
            )}

            {/* Scrollable feed */}
            <div className="ap-flex-1 ap-overflow-y-auto ap-p-3 ap-space-y-4">
                {updates.length > 0 ? (
                    updates.map(update => (
                        <UpdateItem
                            key={update.id}
                            update={update}
                            currentUser={currentUser}
                            onUpdate={onUpdateUpdate}
                            onDelete={onDeleteUpdate}
                            isReadOnly={isReadOnly}
                            isFocused={focusedUpdateId === update.id}
                        />
                    ))
                ) : (
                    <EmptyState>No updates yet. Share your progress!</EmptyState>
                )}
            </div>
        </div>
    );
};

export default UpdatesFeed;
