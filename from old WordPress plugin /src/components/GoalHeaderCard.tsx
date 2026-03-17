import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Goal, GoalStatus, UserProfile } from '@/types';
import { Button } from '@/components/ui/Button';
import RichTextEditor from '@/components/RichTextEditor';
import CommentSection from '@/components/CommentSection';
import {
    HiOutlinePencil as PencilIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlineBookmark as BookmarkIcon,
    HiOutlineChevronDown as ChevronDownIcon,
    HiOutlineShare as ShareIcon,
    HiOutlineClipboardDocument as ClipboardIcon,
    HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleIcon,
    HiOutlinePrinter as PrinterIcon,
    HiOutlineUserGroup as UserGroupIcon,
} from 'react-icons/hi2';

interface GoalHeaderCardProps {
    goal: Goal;
    currentUser: UserProfile | null;
    isReadOnly: boolean;
    onUpdateGoal: (updates: Partial<Goal>) => void;
}

/**
 * Goal header card with inline editing for title & description,
 * status dropdown, portfolio toggle, share button, and collapsible comments.
 *
 * This component was extracted from GoalDisplay to sit at the top
 * of the new workspace layout.
 */
const GoalHeaderCard: React.FC<GoalHeaderCardProps> = ({
    goal,
    currentUser,
    isReadOnly,
    onUpdateGoal,
}) => {
    // Title editing
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState(goal.title);

    // Description editing
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editingDescription, setEditingDescription] = useState(goal.description);

    // Comments visibility
    const [showComments, setShowComments] = useState(false);

    // Share state
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

    // Participants editing state (admin / tier-6 only)
    const [showParticipants, setShowParticipants] = useState(false);
    const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [newMentorId, setNewMentorId] = useState(0);
    const [newMenteeId, setNewMenteeId] = useState(0);
    const [isSavingParticipants, setIsSavingParticipants] = useState(false);
    const [participantError, setParticipantError] = useState<string | null>(null);

    // Keep editing state in sync when goal changes externally
    const goalRef = useRef(goal);
    React.useEffect(() => {
        goalRef.current = goal;
        if (!isEditingTitle) setEditingTitle(goal.title);
        if (!isEditingDescription) setEditingDescription(goal.description);
    }, [goal, isEditingTitle, isEditingDescription]);

    const handleDescriptionChange = useCallback((html: string) => {
        setEditingDescription(html);
    }, []);

    const handleTitleSave = useCallback(() => {
        if (editingTitle.trim()) {
            onUpdateGoal({ title: editingTitle });
        } else {
            setEditingTitle(goalRef.current.title);
        }
        setIsEditingTitle(false);
    }, [editingTitle, onUpdateGoal]);

    const handleDescriptionSave = useCallback(() => {
        onUpdateGoal({ description: editingDescription });
        setIsEditingDescription(false);
    }, [editingDescription, onUpdateGoal]);

    const handleStatusChange = useCallback((newStatus: GoalStatus) => {
        onUpdateGoal({ status: newStatus });
    }, [onUpdateGoal]);

    const handlePortfolioToggle = useCallback(() => {
        onUpdateGoal({ isPortfolio: !goalRef.current.isPortfolio });
    }, [onUpdateGoal]);

    const handleShareGoal = useCallback(() => {
        const goalOwnerId = goal.mentee?.id || goal.mentor?.id;
        if (!goalOwnerId) return;

        const goalUrl = `${window.location.origin}${window.location.pathname}?view=portfolio&user_id=${goalOwnerId}&goal_id=${goal.id}`;
        navigator.clipboard.writeText(goalUrl).then(() => {
            setShareStatus('copied');
            setTimeout(() => setShareStatus('idle'), 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
        });
    }, [goal.id, goal.mentee?.id, goal.mentor?.id]);

    // Sync the selects with current participants when the panel opens; lazy-load user list
    useEffect(() => {
        if (!showParticipants) return;
        setNewMentorId(goal.mentor?.id ?? 0);
        setNewMenteeId(goal.mentee?.id ?? 0);
        if (allUsers.length > 0) return;
        setIsLoadingUsers(true);
        const wpd = (window as any).mentorshipPlatformData;
        fetch(`${wpd?.api_url || ''}/admin/all-users`, {
            headers: { 'X-WP-Nonce': wpd?.nonce || '' },
        })
            .then(r => r.json())
            .then(data => setAllUsers(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setIsLoadingUsers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showParticipants]);

    const handleSaveParticipants = useCallback(async () => {
        if (!newMentorId || !newMenteeId) {
            setParticipantError('Please select both a mentor and a mentee.');
            return;
        }
        if (newMentorId === newMenteeId) {
            setParticipantError('Mentor and mentee must be different people.');
            return;
        }
        setIsSavingParticipants(true);
        setParticipantError(null);
        try {
            const wpd = (window as any).mentorshipPlatformData;
            const res = await fetch(`${wpd?.api_url || ''}/goals/${goal.id}/participants`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': wpd?.nonce || '' },
                body: JSON.stringify({ mentor_id: newMentorId, mentee_id: newMenteeId }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Failed to update participants.');
            }
            const updatedGoal = await res.json();
            onUpdateGoal({ mentor: updatedGoal.mentor, mentee: updatedGoal.mentee });
            setShowParticipants(false);
        } catch (err) {
            setParticipantError(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setIsSavingParticipants(false);
        }
    }, [newMentorId, newMenteeId, goal.id, onUpdateGoal]);

    // Share permission check
    const wpData = (window as any).mentorshipPlatformData;
    const isAdmin = wpData?.is_admin || false;
    const canShare = goal.isPortfolio && currentUser && (
        currentUser.id === goal.mentee?.id ||
        currentUser.id === goal.mentor?.id ||
        isAdmin ||
        (currentUser.tier && currentUser.tier >= 6)
    );
    const canEditParticipants = isAdmin || ((currentUser?.tier ?? 0) >= 6);

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-5 ap-border-t-4 ap-border-t-purple-600/40">
            {/* Title */}
            <div className="ap-mb-3">
                {isEditingTitle && !isReadOnly ? (
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                            className="ap-text-xl ap-font-bold ap-bg-gray-100 ap-rounded-md ap-p-1 -ap-m-1 ap-flex-1"
                            autoFocus
                        />
                        <Button onClick={handleTitleSave} variant="success" size="sm" title="Save">
                            <CheckIcon className="ap-h-5 ap-w-5" />
                        </Button>
                        <Button onClick={() => { setIsEditingTitle(false); setEditingTitle(goal.title); }} variant="danger" size="sm" title="Cancel">
                            <XMarkIcon className="ap-h-5 ap-w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <h2 className="ap-text-xl ap-font-bold ap-text-blue-600">{goal.title}</h2>
                        {!isReadOnly && (
                            <Button onClick={() => setIsEditingTitle(true)} variant="icon" className="ap-text-gray-400 hover:ap-text-purple-600" title="Edit title">
                                <PencilIcon className="ap-h-4 ap-w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="ap-mb-4">
                {isEditingDescription && !isReadOnly ? (
                    <div>
                        <RichTextEditor
                            value={editingDescription}
                            onChange={handleDescriptionChange}
                        />
                        <div className="ap-flex ap-items-center ap-gap-2 ap-mt-2">
                            <Button onClick={handleDescriptionSave} variant="primary">Save</Button>
                            <Button onClick={() => { setIsEditingDescription(false); setEditingDescription(goal.description); }} variant="secondary">Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <div className="ap-flex ap-items-start ap-gap-2">
                        <div
                            className="ap-prose ap-max-w-none ap-text-gray-600 ap-text-sm ap-break-words"
                            dangerouslySetInnerHTML={{ __html: goal.description || '' }}
                        />
                        {!isReadOnly && (
                            <Button onClick={() => setIsEditingDescription(true)} variant="icon" className="ap-text-gray-400 hover:ap-text-purple-600 ap-flex-shrink-0" title="Edit description">
                                <PencilIcon className="ap-h-4 ap-w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Status / Portfolio / Share / Comments row */}
            <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-3 ap-pt-3 ap-border-t ap-border-gray-200">
                <GoalStatusDropdown
                    currentStatus={goal.status}
                    onStatusChange={handleStatusChange}
                    isReadOnly={isReadOnly}
                />
                <PortfolioToggle
                    isPortfolio={goal.isPortfolio}
                    onToggle={handlePortfolioToggle}
                    isReadOnly={isReadOnly}
                />
                {canShare && (
                    <Button
                        type="button"
                        onClick={handleShareGoal}
                        variant="ghost"
                        size="xs"
                        className="ap-text-blue-700 ap-bg-blue-50 hover:ap-bg-blue-100"
                        title="Copy a shareable link to this public goal"
                    >
                        {shareStatus === 'copied' ? (
                            <>
                                <ClipboardIcon className="ap-h-4 ap-w-4" />
                                Link Copied!
                            </>
                        ) : (
                            <>
                                <ShareIcon className="ap-h-4 ap-w-4" />
                                Share Goal
                            </>
                        )}
                    </Button>
                )}

                {/* Edit Participants — admin / tier-6 only */}
                {canEditParticipants && (
                    <button
                        type="button"
                        onClick={() => setShowParticipants(prev => !prev)}
                        className={`ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-font-medium ap-px-2 ap-py-1 ap-rounded ap-transition-colors no-print ${
                            showParticipants
                                ? 'ap-bg-amber-200 ap-text-amber-900'
                                : 'ap-bg-amber-100 ap-text-amber-800 hover:ap-bg-amber-200'
                        }`}
                        title="Reassign the mentor or mentee on this goal"
                    >
                        <UserGroupIcon className="ap-h-4 ap-w-4" />
                        Participants
                    </button>
                )}

                {/* Export PDF button */}
                <button
                    onClick={() => window.print()}
                    className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-font-medium ap-px-2 ap-py-1 ap-rounded ap-bg-gray-100 hover:ap-bg-gray-200 ap-text-gray-600 hover:ap-text-gray-800 ap-transition-colors no-print"
                    title="Export this goal as a PDF"
                >
                    <PrinterIcon className="ap-h-4 ap-w-4" />
                    Export PDF
                </button>

                {/* Comment toggle button */}
                <button
                    onClick={() => setShowComments(prev => !prev)}
                    className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-font-medium ap-px-2 ap-py-1 ap-rounded ap-bg-gray-100 hover:ap-bg-gray-200 ap-text-gray-600 hover:ap-text-gray-800 ap-transition-colors"
                >
                    <ChatBubbleIcon className="ap-h-4 ap-w-4" />
                    Comments
                    {(goal.commentCount ?? 0) > 0 && (
                        <span className="ap-ml-1 ap-bg-purple-100 ap-text-purple-700 ap-rounded-full ap-px-1.5 ap-py-0.5 ap-text-xs ap-font-semibold">
                            {goal.commentCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Inline Comments Section — collapsible */}
            {showComments && (
                <div className="ap-mt-4 ap-pt-3 ap-border-t ap-border-gray-100">
                    <CommentSection
                        postId={goal.id}
                        currentUser={currentUser}
                        isReadOnly={isReadOnly}
                        initialCount={goal.commentCount || 0}
                    />
                </div>
            )}

            {/* Edit Participants Panel — admin / tier-6 only */}
            {showParticipants && canEditParticipants && (
                <div className="ap-mt-4 ap-p-4 ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg no-print">
                    <h4 className="ap-text-sm ap-font-semibold ap-text-amber-900 ap-mb-3">Edit Goal Participants</h4>
                    {isLoadingUsers ? (
                        <p className="ap-text-sm ap-text-amber-700 ap-italic">Loading users…</p>
                    ) : (
                        <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 ap-gap-4">
                            <div>
                                <label className="ap-block ap-text-xs ap-font-medium ap-text-amber-800 ap-mb-1">
                                    Mentor
                                    {goal.mentor && (
                                        <span className="ap-ml-1 ap-font-normal ap-text-amber-600">
                                            (currently: {goal.mentor.firstName} {goal.mentor.lastName})
                                        </span>
                                    )}
                                </label>
                                <select
                                    value={newMentorId}
                                    onChange={e => setNewMentorId(parseInt(e.target.value) || 0)}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-amber-300 ap-rounded-lg ap-bg-white focus:ap-ring-2 focus:ap-ring-amber-500"
                                >
                                    <option value="0">— Select Mentor —</option>
                                    {allUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="ap-block ap-text-xs ap-font-medium ap-text-amber-800 ap-mb-1">
                                    Mentee
                                    {goal.mentee && (
                                        <span className="ap-ml-1 ap-font-normal ap-text-amber-600">
                                            (currently: {goal.mentee.firstName} {goal.mentee.lastName})
                                        </span>
                                    )}
                                </label>
                                <select
                                    value={newMenteeId}
                                    onChange={e => setNewMenteeId(parseInt(e.target.value) || 0)}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-amber-300 ap-rounded-lg ap-bg-white focus:ap-ring-2 focus:ap-ring-amber-500"
                                >
                                    <option value="0">— Select Mentee —</option>
                                    {allUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    {participantError && (
                        <p className="ap-mt-2 ap-text-xs ap-text-red-700">{participantError}</p>
                    )}
                    <div className="ap-flex ap-gap-2 ap-mt-3">
                        <button
                            type="button"
                            onClick={handleSaveParticipants}
                            disabled={isSavingParticipants || isLoadingUsers}
                            className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-font-medium ap-px-3 ap-py-1.5 ap-rounded ap-bg-amber-600 ap-text-white hover:ap-bg-amber-700 disabled:ap-opacity-50 ap-transition-colors"
                        >
                            {isSavingParticipants ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowParticipants(false); setParticipantError(null); }}
                            className="ap-inline-flex ap-items-center ap-text-xs ap-font-medium ap-px-3 ap-py-1.5 ap-rounded ap-bg-white ap-text-amber-800 ap-border ap-border-amber-300 hover:ap-bg-amber-100 ap-transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalHeaderCard;

// ─── Sub-components (ported from GoalDisplay) ────────────────────────────────

const GoalStatusDropdown: React.FC<{
    currentStatus: GoalStatus;
    onStatusChange: (status: GoalStatus) => void;
    isReadOnly: boolean;
}> = ({ currentStatus, onStatusChange, isReadOnly }) => {
    const [isOpen, setIsOpen] = useState(false);
    const statuses: GoalStatus[] = ['Not Started', 'In Progress', 'Completed'];
    const statusColors: Record<GoalStatus, string> = {
        'Not Started': 'ap-bg-gray-200 ap-text-gray-800',
        'In Progress': 'ap-bg-yellow-200 ap-text-yellow-800',
        'Completed': 'ap-bg-green-200 ap-text-green-800',
    };
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="ap-relative" ref={dropdownRef}>
            <Button
                onClick={() => setIsOpen(!isOpen)}
                variant="ghost"
                size="xs"
                className={`!ap-px-3 !ap-py-1 ap-text-xs ap-font-semibold ap-rounded-full ${statusColors[currentStatus]}`}
                disabled={isReadOnly}
            >
                {currentStatus}
                <ChevronDownIcon className="ap-h-3 ap-w-3" />
            </Button>
            {isOpen && !isReadOnly && (
                <div className="ap-absolute ap-right-0 ap-mt-2 ap-w-40 ap-bg-white ap-rounded-md ap-shadow-lg ap-z-10">
                    {statuses.map(status => (
                        <Button
                            key={status}
                            onClick={() => { onStatusChange(status); setIsOpen(false); }}
                            variant="ghost"
                            size="sm"
                            className="!ap-w-full !ap-justify-start !ap-rounded-none ap-text-gray-700 hover:ap-bg-gray-100"
                        >
                            {status}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
};

const PortfolioToggle: React.FC<{
    isPortfolio: boolean;
    onToggle: () => void;
    isReadOnly: boolean;
}> = ({ isPortfolio, onToggle, isReadOnly }) => {
    return (
        <div className="ap-flex ap-items-center ap-gap-2">
            <BookmarkIcon className={`ap-h-4 ap-w-4 ap-flex-shrink-0 ${isPortfolio ? 'ap-text-blue-600' : 'ap-text-gray-400'}`} />
            <span className="ap-text-xs ap-text-gray-500 ap-whitespace-nowrap">Public Portfolio</span>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isReadOnly) onToggle();
                }}
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: '36px',
                    height: '20px',
                    flexShrink: 0,
                    borderRadius: '9999px',
                    backgroundColor: isPortfolio ? '#2563eb' : '#d1d5db',
                    transition: 'background-color 0.2s',
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    opacity: isReadOnly ? 0.5 : 1,
                    border: 'none',
                    padding: 0,
                    lineHeight: 1,
                    fontSize: '14px',
                    boxSizing: 'content-box',
                }}
                role="switch"
                aria-checked={isPortfolio}
                disabled={isReadOnly}
            >
                <span
                    style={{
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        borderRadius: '9999px',
                        backgroundColor: 'white',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.2s',
                        transform: isPortfolio ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                />
            </button>
        </div>
    );
};
