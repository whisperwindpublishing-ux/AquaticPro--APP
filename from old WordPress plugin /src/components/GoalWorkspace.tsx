import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UserProfile, Goal, Task, Update, Meeting, Initiative } from '@/types';
import {
    HiOutlineBars2 as Bars2Icon,
    HiOutlineCalendarDays as CalendarDaysIcon,
    HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleIcon,
    HiOutlineChevronDown as ChevronDownIcon,
    HiOutlineChevronUp as ChevronUpIcon,
} from 'react-icons/hi2';

import MentorshipTimeline from '@/components/MentorshipTimeline';
import GoalHeaderCard from '@/components/GoalHeaderCard';
import InitiativesStrip from '@/components/InitiativesStrip';
import WorkspaceColumns from '@/components/WorkspaceColumns';
import TaskCard from '@/components/TaskCard';
import MeetingCard from '@/components/MeetingCard';
import UpdatesFeed from '@/components/UpdatesFeed';
import MobileDrawer from '@/components/MobileDrawer';
import UpdateToast from '@/components/UpdateToast';
import GoalPrintView from '@/components/GoalPrintView';
import '@/styles/print.css';
import type { FocusedItem } from '@/components/TimelineRail';
import { useGoalPolling } from '@/hooks/useGoalPolling';
import type { ChangeNotification } from '@/hooks/useGoalPolling';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';
import { ConnectWithSection } from '@/components/GoalDisplay';

// ─── Props ───────────────────────────────────────────────────────────────────

interface GoalWorkspaceProps {
    goal: Goal;
    onUpdate: (updatedGoal: Goal) => void;
    currentUser: UserProfile | null;
    isReadOnly: boolean;
    onAddUpdate?: (newUpdate: Omit<Update, 'id' | 'author' | 'date'>) => Promise<void>;
    onUpdateUpdate?: (update: Update) => Promise<void>;
    onDeleteUpdate?: (updateId: number) => Promise<void>;
    onAddMeeting?: (newMeeting: Omit<Meeting, 'id' | 'comments' | 'commentCount'>) => Promise<void>;
    onUpdateMeeting?: (meeting: Meeting) => Promise<void>;
    /** Auto-save handler: updates local state + starts 3s debounce save */
    onUpdateMeetingLocal?: (meeting: Meeting) => void;
    onDeleteMeeting?: (meetingId: number) => Promise<void>;
    /** Auto-save handler for updates: updates local state + starts 3s debounce save */
    onUpdateUpdateLocal?: (update: Update) => void;
    /** Aggregated save status from parent */
    saveStatus?: AutoSaveStatus;
}

// ─── Component ───────────────────────────────────────────────────────────────

const GoalWorkspace: React.FC<GoalWorkspaceProps> = ({
    goal,
    onUpdate,
    currentUser,
    isReadOnly,
    onAddUpdate,
    onUpdateUpdate,
    onDeleteUpdate,
    onAddMeeting,
    onUpdateMeeting,
    onUpdateMeetingLocal,
    onDeleteMeeting,
    onUpdateUpdateLocal: _onUpdateUpdateLocal,
    saveStatus: _saveStatus,
}) => {
    // ── Workspace layout state ──────────────────────────────────────────────
    const [selectedInitiativeId, setSelectedInitiativeId] = useState<number | null>(null);
    const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);
    const [timelineCollapsed, setTimelineCollapsed] = useState(false);

    // ── Mobile drawer state ─────────────────────────────────────────────────
    const [mobileDrawer, setMobileDrawer] = useState<'tasks' | 'meetings' | 'updates' | null>(null);
    const closeMobileDrawer = useCallback(() => setMobileDrawer(null), []);

    // ── Refs ────────────────────────────────────────────────────────────────
    const goalRef = useRef(goal);
    useEffect(() => {
        goalRef.current = goal;
    }, [goal]);

    // ── Real-time polling ───────────────────────────────────────────────────
    const { notifications, dismissNotification, latestChanges } = useGoalPolling({
        goalId: goal.id,
        currentUserId: currentUser?.id ?? 0,
        enabled: !isReadOnly || true, // Poll for both active and read-only views
        hasUnsavedChanges: false, // TODO: Wire to useSaveStatus isDirty in Phase 8
    });

    // ── Merge polled changes into local state ────────────────────────────────
    useEffect(() => {
        if (!latestChanges) return;

        // If the full goal changed, replace it wholesale
        if (latestChanges.goalChanged && latestChanges.changedGoal) {
            onUpdate(latestChanges.changedGoal);
            return;
        }

        // Merge individual changes
        let needsUpdate = false;
        let updatedGoal = { ...goalRef.current };

        if (latestChanges.newUpdates.length > 0) {
            const existingIds = new Set(updatedGoal.updates.map(u => u.id));
            const brandNew = latestChanges.newUpdates.filter(u => !existingIds.has(u.id));
            if (brandNew.length > 0) {
                updatedGoal = { ...updatedGoal, updates: [...brandNew, ...updatedGoal.updates] };
                needsUpdate = true;
            }
        }

        if (latestChanges.changedMeetings.length > 0) {
            const changedMap = new Map(latestChanges.changedMeetings.map(m => [m.id, m]));
            updatedGoal = {
                ...updatedGoal,
                meetings: updatedGoal.meetings.map(m => changedMap.get(m.id) ?? m),
            };
            needsUpdate = true;
        }

        if (needsUpdate) {
            onUpdate(updatedGoal);
        }
    }, [latestChanges, onUpdate]);

    // ── Memoized data ───────────────────────────────────────────────────────
    const participants = useMemo(() => {
        const p: { id: number; name: string }[] = [];
        if (goal.mentee) {
            p.push({ id: goal.mentee.id, name: `${goal.mentee.firstName} ${goal.mentee.lastName}` });
        }
        if (goal.mentor) {
            p.push({ id: goal.mentor.id, name: `${goal.mentor.firstName} ${goal.mentor.lastName}` });
        }
        return p;
    }, [goal.mentee, goal.mentor]);

    // ── Core update function ────────────────────────────────────────────────
    const updateGoal = useCallback((updates: Partial<Goal>) => {
        onUpdate({ ...goalRef.current, ...updates });
    }, [onUpdate]);

    // ── Initiative handlers ─────────────────────────────────────────────────
    const handleAddInitiative = useCallback(() => {
        const newInitiative: Initiative = {
            id: Date.now(),
            title: 'New Initiative',
            description: '',
            status: 'Not Started',
            comments: [],
        };
        updateGoal({ initiatives: [...goalRef.current.initiatives, newInitiative] });
    }, [updateGoal]);

    const handleUpdateInitiative = useCallback((updatedInitiative: Initiative) => {
        updateGoal({
            initiatives: goalRef.current.initiatives.map(i =>
                i.id === updatedInitiative.id ? updatedInitiative : i
            ),
        });
    }, [updateGoal]);

    const handleDeleteInitiative = useCallback((initiativeId: number) => {
        if (!window.confirm('Are you sure you want to delete this initiative? Tasks linked to it will be unassigned.')) {
            return;
        }
        updateGoal({
            initiatives: goalRef.current.initiatives.filter(i => i.id !== initiativeId),
            tasks: goalRef.current.tasks.map(t =>
                t.initiativeId === initiativeId ? { ...t, initiativeId: null } : t
            ),
        });
        if (selectedInitiativeId === initiativeId) {
            setSelectedInitiativeId(null);
        }
    }, [updateGoal, selectedInitiativeId]);

    // ── Task handlers ───────────────────────────────────────────────────────
    const handleAddTask = useCallback(() => {
        const newTask: Task = {
            id: -Date.now(),
            text: 'New Task',
            isCompleted: false,
            initiativeId: null,
        };
        updateGoal({ tasks: [newTask, ...goalRef.current.tasks] });
    }, [updateGoal]);

    const handleUpdateTask = useCallback((updatedTask: Task) => {
        updateGoal({
            tasks: goalRef.current.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t)),
        });
    }, [updateGoal]);

    const handleDeleteTask = useCallback((taskId: number) => {
        updateGoal({ tasks: goalRef.current.tasks.filter(t => t.id !== taskId) });
    }, [updateGoal]);

    const handleReorderTasks = useCallback((newTasks: Task[]) => {
        updateGoal({ tasks: newTasks });
    }, [updateGoal]);

    // ── Meeting handlers ────────────────────────────────────────────────────
    const handleAddMeeting = useCallback(() => {
        if (!onAddMeeting || !currentUser) return;
        const newMeeting: Omit<Meeting, 'id' | 'comments' | 'commentCount'> = {
            topic: 'New Meeting',
            date: new Date().toISOString(),
            notes: '',
            initiativeId: null,
            meetingLink: '',
            author: currentUser,
        };
        onAddMeeting(newMeeting);
    }, [onAddMeeting, currentUser]);

    const handleMeetingUpdate = useCallback(
        (
            meeting: Meeting,
            newActionItems?: {
                id: number;
                text: string;
                assignedTo?: number;
                assignedToName?: string;
                dueDate?: string;
            }[]
        ) => {
            if (onUpdateMeeting) {
                onUpdateMeeting(meeting);
            }

            if (newActionItems && newActionItems.length > 0) {
                const newTasks: Task[] = newActionItems.map(item => ({
                    id: -Date.now() - Math.random(),
                    text: item.text,
                    isCompleted: false,
                    initiativeId: meeting.initiativeId,
                    assignedTo: item.assignedTo,
                    assignedToName: item.assignedToName,
                    dueDate: item.dueDate,
                    createdFromMeetingId: meeting.id,
                }));

                updateGoal({
                    tasks: [...goalRef.current.tasks, ...newTasks],
                    meetings: goalRef.current.meetings.map(m =>
                        m.id === meeting.id
                            ? {
                                  ...meeting,
                                  actionItems: [
                                      ...(meeting.actionItems || []),
                                      ...newTasks.map(t => t.id),
                                  ],
                              }
                            : m
                    ),
                });
            }
        },
        [onUpdateMeeting, updateGoal]
    );

    // ── Timeline click-to-focus (unified handler) ────────────────────────────
    const handleFocusItem = useCallback(
        (item: FocusedItem) => {
            setFocusedItem(item);

            // Scroll to the item in its column + apply highlight pulse
            setTimeout(() => {
                const elId = `${item.type}-${item.id}`;
                const el = document.getElementById(elId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('focus-highlight-pulse');
                    el.addEventListener(
                        'animationend',
                        () => el.classList.remove('focus-highlight-pulse'),
                        { once: true }
                    );
                }
            }, 100);
        },
        []
    );

    // ── Clear focus after 3s (auto-dismiss active highlighting) ─────────────
    useEffect(() => {
        if (!focusedItem) return;
        const timer = setTimeout(() => setFocusedItem(null), 3000);
        return () => clearTimeout(timer);
    }, [focusedItem]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="ap-flex ap-flex-col ap-space-y-3">
            {/* ── Top section ── */}
            <div className="ap-space-y-3">
                {/* Mentorship Relationship Banner */}
                {goal.mentor && goal.mentee && (
                    <div className="ap-bg-gradient-to-r ap-from-blue-50 ap-to-indigo-50 ap-rounded-lg ap-shadow-sm ap-border-2 ap-border-blue-200 ap-p-3">
                        <div className="ap-flex ap-items-center ap-justify-center ap-gap-8 ap-flex-wrap">
                            <a
                                href={`${window.location.pathname}?view=portfolio&user_id=${goal.mentee.id}`}
                                className="ap-flex ap-items-center ap-gap-2 hover:ap-opacity-80 ap-transition-opacity ap-no-underline"
                            >
                                <img src={goal.mentee.avatarUrl || ''} alt={`${goal.mentee.firstName} ${goal.mentee.lastName}`}
                                    className="ap-h-10 ap-w-10 ap-rounded-full ap-object-cover ap-border-2 ap-border-green-400" />
                                <div>
                                    <p className="ap-text-xs ap-font-semibold ap-text-green-600 ap-uppercase ap-tracking-wide">Goal Owner</p>
                                    <p className="ap-font-bold ap-text-gray-900 ap-text-sm">{goal.mentee.firstName} {goal.mentee.lastName}</p>
                                </div>
                            </a>
                            <div className="ap-text-xl ap-text-gray-400">⟷</div>
                            <a
                                href={`${window.location.pathname}?view=portfolio&user_id=${goal.mentor.id}`}
                                className="ap-flex ap-items-center ap-gap-2 hover:ap-opacity-80 ap-transition-opacity ap-no-underline"
                            >
                                <img src={goal.mentor.avatarUrl || ''} alt={`${goal.mentor.firstName} ${goal.mentor.lastName}`}
                                    className="ap-h-10 ap-w-10 ap-rounded-full ap-object-cover ap-border-2 ap-border-blue-400" />
                                <div>
                                    <p className="ap-text-xs ap-font-semibold ap-text-blue-600 ap-uppercase ap-tracking-wide">Mentor</p>
                                    <p className="ap-font-bold ap-text-gray-900 ap-text-sm">{goal.mentor.firstName} {goal.mentor.lastName}</p>
                                </div>
                            </a>
                        </div>
                    </div>
                )}

                {/* Connect With Section */}
                {goal.mentor && goal.mentee && currentUser && (
                    <ConnectWithSection currentUser={currentUser} mentor={goal.mentor} mentee={goal.mentee} />
                )}

                {/* Goal Header Card */}
                <GoalHeaderCard goal={goal} currentUser={currentUser} isReadOnly={isReadOnly} onUpdateGoal={updateGoal} />

                {/* Initiatives — vertical list */}
                <InitiativesStrip
                    initiatives={goal.initiatives}
                    isReadOnly={isReadOnly}
                    onAddInitiative={handleAddInitiative}
                    onUpdateInitiative={handleUpdateInitiative}
                    onDeleteInitiative={handleDeleteInitiative}
                    selectedInitiativeId={selectedInitiativeId}
                    onSelectInitiative={setSelectedInitiativeId}
                />

                {/* Timeline — collapsible, default expanded */}
                <div className="ap-hidden lg:ap-block ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-purple-200 ap-overflow-hidden">
                    <button
                        onClick={() => setTimelineCollapsed(prev => !prev)}
                        className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2.5 ap-bg-purple-600 hover:ap-bg-purple-700 ap-transition-colors ap-select-none"
                        aria-expanded={!timelineCollapsed}
                        aria-label={`Timeline feed — ${timelineCollapsed ? 'expand' : 'collapse'}`}
                    >
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <CalendarDaysIcon className="ap-h-4 ap-w-4 ap-text-white" />
                            <span className="ap-text-sm ap-font-semibold ap-text-white">Timeline</span>
                        </div>
                        {timelineCollapsed ? (
                            <ChevronDownIcon className="ap-h-4 ap-w-4 ap-text-purple-200" />
                        ) : (
                            <ChevronUpIcon className="ap-h-4 ap-w-4 ap-text-purple-200" />
                        )}
                    </button>
                    {!timelineCollapsed && (
                        <div className="ap-border-t ap-border-gray-100 ap-p-3">
                            <MentorshipTimeline
                                goal={goal}
                                currentUser={currentUser}
                                onMeetingClick={(m) => handleFocusItem({ type: 'meeting', id: m.id })}
                                onUpdateClick={(u) => handleFocusItem({ type: 'update', id: u.id })}
                                onTaskClick={(t) => handleFocusItem({ type: 'task', id: t.id })}
                                activeItemId={focusedItem?.id ?? null}
                                activeItemType={focusedItem?.type ?? null}
                                selectedInitiativeId={selectedInitiativeId}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── 3-Column Workspace: Tasks | Meetings | Updates ── */}
            <WorkspaceColumns
                taskCount={goal.tasks.length}
                meetingCount={goal.meetings.length}
                updateCount={goal.updates.length}
                tasksSlot={
                    <div>
                        {/* Sticky header */}
                        <div className="ap-sticky ap-top-0 ap-z-10 ap-bg-blue-600 ap-px-3 ap-py-2 ap-flex ap-items-center ap-justify-between">
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <Bars2Icon className="ap-h-5 ap-w-5 ap-text-white" />
                                <h3 className="ap-font-semibold ap-text-white ap-text-sm">Tasks</h3>
                                <span className="ap-text-xs ap-font-semibold ap-px-2 ap-py-0.5 ap-rounded-full ap-bg-white/20 ap-text-white">
                                    {goal.tasks.length}
                                </span>
                            </div>
                            {!isReadOnly && (
                                <button
                                    onClick={handleAddTask}
                                    className="ap-text-xs ap-font-semibold ap-px-2 ap-py-1 ap-rounded ap-bg-white/20 hover:ap-bg-white/30 ap-text-white ap-transition-colors"
                                >
                                    + New
                                </button>
                            )}
                        </div>
                        <div className="ap-p-3">
                            <TaskCard
                                tasks={goal.tasks}
                                initiatives={goal.initiatives}
                                isReadOnly={isReadOnly}
                                goalTitle={goal.title}
                                participants={participants}
                                selectedInitiativeId={selectedInitiativeId}
                                focusedTaskId={focusedItem?.type === 'task' ? focusedItem.id : null}
                                onAddTask={handleAddTask}
                                onUpdateTask={handleUpdateTask}
                                onDeleteTask={handleDeleteTask}
                                onReorderTasks={handleReorderTasks}
                            />
                        </div>
                    </div>
                }
                meetingsSlot={
                    <div>
                        {/* Sticky header */}
                        <div className="ap-sticky ap-top-0 ap-z-10 ap-bg-green-600 ap-px-3 ap-py-2 ap-flex ap-items-center ap-justify-between">
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <CalendarDaysIcon className="ap-h-5 ap-w-5 ap-text-white" />
                                <h3 className="ap-font-semibold ap-text-white ap-text-sm">Meetings</h3>
                                <span className="ap-text-xs ap-font-semibold ap-px-2 ap-py-0.5 ap-rounded-full ap-bg-white/20 ap-text-white">
                                    {goal.meetings.length}
                                </span>
                            </div>
                            {!isReadOnly && (
                                <button
                                    onClick={handleAddMeeting}
                                    className="ap-text-xs ap-font-semibold ap-px-2 ap-py-1 ap-rounded ap-bg-white/20 hover:ap-bg-white/30 ap-text-white ap-transition-colors"
                                >
                                    + New
                                </button>
                            )}
                        </div>
                        <div className="ap-p-3">
                            <MeetingCard
                                meetings={goal.meetings}
                                initiatives={goal.initiatives}
                                tasks={goal.tasks}
                                isReadOnly={isReadOnly}
                                currentUser={currentUser}
                                participants={participants}
                                selectedInitiativeId={selectedInitiativeId}
                                focusedMeetingId={focusedItem?.type === 'meeting' ? focusedItem.id : null}
                                onAddMeeting={handleAddMeeting}
                                onUpdateMeeting={handleMeetingUpdate}
                                onDeleteMeeting={onDeleteMeeting as (id: number) => void}
                                onUpdateMeetingLocal={onUpdateMeetingLocal}
                            />
                        </div>
                    </div>
                }
                updatesSlot={
                    <div>
                        {/* Sticky header */}
                        <div className="ap-sticky ap-top-0 ap-z-10 ap-bg-orange-500 ap-px-3 ap-py-2 ap-flex ap-items-center ap-justify-between">
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <ChatBubbleIcon className="ap-h-5 ap-w-5 ap-text-white" />
                                <h3 className="ap-font-semibold ap-text-white ap-text-sm">Updates</h3>
                                <span className="ap-text-xs ap-font-semibold ap-px-2 ap-py-0.5 ap-rounded-full ap-bg-white/20 ap-text-white">
                                    {goal.updates.length}
                                </span>
                            </div>
                        </div>
                        <UpdatesFeed
                            goalId={goal.id}
                            updates={goal.updates}
                            currentUser={currentUser}
                            isReadOnly={isReadOnly}
                            focusedUpdateId={focusedItem?.type === 'update' ? focusedItem.id : null}
                            onAddUpdate={onAddUpdate}
                            onUpdateUpdate={onUpdateUpdate}
                            onDeleteUpdate={onDeleteUpdate}
                            isExpanded={true}
                            onToggleExpanded={() => {}}
                            variant="mobile"
                        />
                    </div>
                }
            />

            {/* ── Mobile layout (< lg): Timeline + drawer trigger bar ── */}
            <div className="lg:ap-hidden ap-space-y-4 ap-pb-20">
                {/* Timeline — default visible content on mobile */}
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-3">
                    <MentorshipTimeline
                        goal={goal}
                        currentUser={currentUser}
                        onMeetingClick={(m) => {
                            handleFocusItem({ type: 'meeting', id: m.id });
                            setMobileDrawer('meetings');
                        }}
                        onUpdateClick={(u) => {
                            handleFocusItem({ type: 'update', id: u.id });
                            setMobileDrawer('updates');
                        }}
                        onTaskClick={(t) => {
                            handleFocusItem({ type: 'task', id: t.id });
                            setMobileDrawer('tasks');
                        }}
                        activeItemId={focusedItem?.id ?? null}
                        activeItemType={focusedItem?.type ?? null}
                        selectedInitiativeId={selectedInitiativeId}
                    />
                </div>

                {/* Drawer trigger bar — fixed at bottom of viewport */}
                <div className="ap-fixed ap-bottom-0 ap-left-0 ap-right-0 ap-bg-white ap-shadow-lg ap-border-t ap-border-gray-200 ap-p-2 ap-flex ap-gap-2 ap-safe-area-bottom" style={{ zIndex: 99998 }} role="toolbar" aria-label="Open content panels">
                    <button
                        onClick={() => setMobileDrawer('tasks')}
                        className="ap-flex-1 ap-flex ap-items-center ap-justify-center ap-gap-2 ap-py-3 ap-rounded-lg ap-bg-blue-50 hover:ap-bg-blue-100 ap-text-blue-700 ap-font-medium ap-text-sm ap-transition-colors"
                        aria-label={`Open tasks panel (${goal.tasks.length} tasks)`}
                    >
                        <Bars2Icon className="ap-h-4 ap-w-4" />
                        Tasks
                        <span className="ap-text-xs ap-bg-blue-200 ap-text-blue-800 ap-px-1.5 ap-py-0.5 ap-rounded-full ap-font-semibold">
                            {goal.tasks.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setMobileDrawer('meetings')}
                        className="ap-flex-1 ap-flex ap-items-center ap-justify-center ap-gap-2 ap-py-3 ap-rounded-lg ap-bg-green-50 hover:ap-bg-green-100 ap-text-green-700 ap-font-medium ap-text-sm ap-transition-colors"
                        aria-label={`Open meetings panel (${goal.meetings.length} meetings)`}
                    >
                        <CalendarDaysIcon className="ap-h-4 ap-w-4" />
                        Meetings
                        <span className="ap-text-xs ap-bg-green-200 ap-text-green-800 ap-px-1.5 ap-py-0.5 ap-rounded-full ap-font-semibold">
                            {goal.meetings.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setMobileDrawer('updates')}
                        className="ap-flex-1 ap-flex ap-items-center ap-justify-center ap-gap-2 ap-py-3 ap-rounded-lg ap-bg-orange-50 hover:ap-bg-orange-100 ap-text-orange-700 ap-font-medium ap-text-sm ap-transition-colors"
                        aria-label={`Open updates panel (${goal.updates.length} updates)`}
                    >
                        <ChatBubbleIcon className="ap-h-4 ap-w-4" />
                        Updates
                        <span className="ap-text-xs ap-bg-orange-200 ap-text-orange-800 ap-px-1.5 ap-py-0.5 ap-rounded-full ap-font-semibold">
                            {goal.updates.length}
                        </span>
                    </button>
                </div>

                {/* ── Mobile Drawers ────────────────────────────────────── */}
                <MobileDrawer isOpen={mobileDrawer === 'tasks'} onClose={closeMobileDrawer} title="Tasks" icon={<Bars2Icon className="ap-h-5 ap-w-5" />} count={goal.tasks.length} accentColor="#3b82f6">
                    <TaskCard tasks={goal.tasks} initiatives={goal.initiatives} isReadOnly={isReadOnly} goalTitle={goal.title} participants={participants} selectedInitiativeId={selectedInitiativeId} focusedTaskId={focusedItem?.type === 'task' ? focusedItem.id : null} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onReorderTasks={handleReorderTasks} />
                </MobileDrawer>

                <MobileDrawer isOpen={mobileDrawer === 'meetings'} onClose={closeMobileDrawer} title="Meetings" icon={<CalendarDaysIcon className="ap-h-5 ap-w-5" />} count={goal.meetings.length} accentColor="#10b981">
                    <MeetingCard meetings={goal.meetings} initiatives={goal.initiatives} tasks={goal.tasks} isReadOnly={isReadOnly} currentUser={currentUser} participants={participants} selectedInitiativeId={selectedInitiativeId} focusedMeetingId={focusedItem?.type === 'meeting' ? focusedItem.id : null} onAddMeeting={handleAddMeeting} onUpdateMeeting={handleMeetingUpdate} onDeleteMeeting={onDeleteMeeting as (id: number) => void} onUpdateMeetingLocal={onUpdateMeetingLocal} />
                </MobileDrawer>

                <MobileDrawer isOpen={mobileDrawer === 'updates'} onClose={closeMobileDrawer} title="Updates" icon={<ChatBubbleIcon className="ap-h-5 ap-w-5" />} count={goal.updates.length} accentColor="#f97316">
                    <UpdatesFeed goalId={goal.id} updates={goal.updates} currentUser={currentUser} isReadOnly={isReadOnly} focusedUpdateId={focusedItem?.type === 'update' ? focusedItem.id : null} onAddUpdate={onAddUpdate} onUpdateUpdate={onUpdateUpdate} onDeleteUpdate={onDeleteUpdate} isExpanded={true} onToggleExpanded={() => {}} variant="mobile" />
                </MobileDrawer>
            </div>

            {/* ── Print-only linearized view ──────────────────────── */}
            <GoalPrintView goal={goal} />

            {/* ── Real-time change toasts ──────────────────────────── */}
            <UpdateToast
                notifications={notifications}
                onDismiss={dismissNotification}
                onClick={(n: ChangeNotification) => {
                    if (n.type === 'update') {
                        handleFocusItem({ type: 'update', id: n.itemId });
                    } else if (n.type === 'meeting') {
                        handleFocusItem({ type: 'meeting', id: n.itemId });
                    }
                }}
            />
        </div>
    );
};

export default GoalWorkspace;
