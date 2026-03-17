import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { formatLocalDate } from '@/utils/dateUtils';
import { UserProfile, Goal, Task, GoalStatus, Update, Meeting, Initiative, InitiativeStatus, Attachment } from '@/types';
import { Button } from '@/components/ui/Button';
import { uploadFile } from '@/services/api';
import { ACCEPTED_FILE_TYPES } from '@/utils/fileUpload';
import { 
    HiOutlinePlusCircle as PlusCircleIcon,
    HiOutlineCalendarDays as CalendarDaysIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlinePencil as PencilIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlineTrash as TrashIcon,
    HiOutlineRocketLaunch as RocketLaunchIcon,
    HiOutlineBars2 as Bars2Icon,
    HiOutlinePaperClip as PaperClipIcon,
    HiOutlineDocument as DocumentIcon,
    HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleOvalLeftEllipsisIcon,
    HiOutlineBookmark as BookmarkIcon,
    HiOutlineChevronDown as ChevronDownIcon,
    HiOutlineChevronRight as ChevronRightIcon,
    HiOutlineClock as ClockIcon,
    HiOutlineUser as UserIcon,
    HiOutlineEnvelope as EnvelopeIcon,
    HiOutlineChatBubbleLeftRight as ChatIcon,
    HiOutlineShare as ShareIcon,
    HiOutlineClipboardDocument as ClipboardIcon
} from 'react-icons/hi2';
import { FaLinkedin, FaTelegram, FaSignalMessenger } from 'react-icons/fa6';
import RichTextEditor from '@/components/RichTextEditor';
import BlockEditor from '@/components/BlockEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { CSS } from '@dnd-kit/utilities';
import CommentSection from './CommentSection';
import MentorshipTimeline from './MentorshipTimeline';
import EnhancedMeetingForm from './EnhancedMeetingForm';

// Note: We removed MentorshipDashboard and AddGoalModal from this file.
// We added 'isReadOnly' to the props.

type TabName = 'Timeline' | 'Initiatives' | 'Tasks' | 'Meetings' | 'Updates';

interface TabButtonProps {
    name: TabName;
    icon: React.ReactNode;
    activeTab: TabName;
    onClick: (name: TabName) => void;
}

interface GoalDisplayProps {
    goal: Goal;
    onUpdate: (updatedGoal: Goal) => void;
    currentUser: UserProfile | null; // Allow null for public view
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
    saveStatus?: import('@/hooks/useAutoSave').AutoSaveStatus;
}

const TaskList: React.FC<{
    tasks: Task[];
    initiatives: Initiative[];
    onUpdateTask: (task: Task) => void;
    onDeleteTask: (id: number) => void;
    onAddTask: () => void;
    activeId: string | null;
    isReadOnly: boolean; // <-- ADDED
    goalTitle?: string; // For Google Calendar context
    participants?: { id: number; name: string }[]; // Mentor and mentee for assignment
    focusedTaskId?: number | null;
}> = ({ tasks, initiatives, onUpdateTask, onDeleteTask, onAddTask: _onAddTask, activeId: _activeId, isReadOnly, goalTitle, participants = [], focusedTaskId }) => {
    const tasksByInitiative = useMemo(() => {
        const grouped: { [key: string]: Task[] } = {
            'no-initiative': []
        };
        initiatives.forEach(i => {
            grouped[i.id] = [];
        });
        tasks.forEach(t => {
            if (t.initiativeId && grouped[t.initiativeId]) {
                grouped[t.initiativeId].push(t);
            } else {
                grouped['no-initiative'].push(t);
            }
        });
        return grouped;
    }, [tasks, initiatives]);

    const sortedInitiativeIds = useMemo(() => {
        const initiativeIds = initiatives.map(i => i.id.toString()).sort((a, b) => {
            const initiativeA = initiatives.find(i => i.id.toString() === a)!;
            const initiativeB = initiatives.find(i => i.id.toString() === b)!;
            return initiativeA.title.localeCompare(initiativeB.title);
        });
        // Put no-initiative FIRST so new tasks appear at the top
        return ['no-initiative', ...initiativeIds];
    }, [initiatives]);

    const [collapsedInitiatives, setCollapsedInitiatives] = useState<Set<string>>(new Set());

    const toggleInitiativeCollapse = useCallback((initiativeId: string) => {
        setCollapsedInitiatives(prev => {
            const next = new Set(prev);
            if (next.has(initiativeId)) {
                next.delete(initiativeId);
            } else {
                next.add(initiativeId);
            }
            return next;
        });
    }, []);

    return (
        <div className="ap-space-y-4">
            {sortedInitiativeIds.map(initiativeId => {
                const initiative = initiatives.find(i => i.id.toString() === initiativeId);
                const initiativeTasks = tasksByInitiative[initiativeId];
                const isCollapsed = collapsedInitiatives.has(initiativeId);
                return (
                    <DroppableInitiativeContainer
                        key={initiativeId}
                        id={initiativeId}
                        title={initiative ? initiative.title : 'No Initiative'}
                        taskCount={initiativeTasks.length}
                        isCollapsed={isCollapsed}
                        onToggleCollapse={() => toggleInitiativeCollapse(initiativeId)}
                    >
                        <SortableContext items={initiativeTasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
                                <div className="ap-space-y-2 ap-min-h-[20px]">
                                    {initiativeTasks.map(task => (
                                        <TaskItem
                                            key={task.id}
                                            id={task.id.toString()}
                                            task={task}
                                            initiatives={initiatives}
                                            onUpdate={onUpdateTask}
                                            onDelete={onDeleteTask}
                                            isReadOnly={isReadOnly} // <-- PASS PROP
                                            goalTitle={goalTitle}
                                            participants={participants}
                                            isFocused={focusedTaskId === task.id}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                    </DroppableInitiativeContainer>
                );
            })}
        </div>
    );
};

const MeetingList: React.FC<{
    meetings: Meeting[];
    initiatives: Initiative[];
    tasks: Task[];
    onUpdateMeeting: (meeting: Meeting, newActionItems?: { id: number; text: string; assignedTo?: number; assignedToName?: string; dueDate?: string }[]) => void;
    onDeleteMeeting: (id: number) => void;
    onAddMeeting: () => void;
    isReadOnly: boolean;
    currentUser: UserProfile | null;
    participants: { id: number; name: string }[];
    focusedMeetingId?: number | null;
}> = ({ meetings, initiatives, tasks, onUpdateMeeting, onDeleteMeeting, onAddMeeting: _onAddMeeting, isReadOnly, currentUser, participants, focusedMeetingId }) => {
    const sortedMeetings = useMemo(() => {
        return [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [meetings]);

    const meetingsByInitiative = useMemo(() => {
        const grouped: { [key: string]: Meeting[] } = {
            'no-initiative': []
        };
        initiatives.forEach(i => {
            grouped[i.id] = [];
        });
        sortedMeetings.forEach(m => {
            if (m.initiativeId && grouped[m.initiativeId]) {
                grouped[m.initiativeId].push(m);
            } else {
                grouped['no-initiative'].push(m);
            }
        });
        return grouped;
    }, [sortedMeetings, initiatives]);

    const sortedInitiativeIds = useMemo(() => {
        const initiativeIds = initiatives.map(i => i.id.toString()).sort((a, b) => {
            const initiativeA = initiatives.find(i => i.id.toString() === a)!;
            const initiativeB = initiatives.find(i => i.id.toString() === b)!;
            return initiativeA.title.localeCompare(initiativeB.title);
        });
        // Put "General / No Initiative" FIRST so new meetings appear at the top
        return ['no-initiative', ...initiativeIds];
    }, [initiatives]);

    return (
        <div className="ap-space-y-4">
            {sortedInitiativeIds.map(initiativeId => {
                const initiative = initiatives.find(i => i.id.toString() === initiativeId);
                const initiativeMeetings = meetingsByInitiative[initiativeId];
                if (initiativeMeetings.length === 0) return null;

                return (
                    <div key={initiativeId} className="ap-bg-gray-50/50 ap-rounded-lg ap-p-3">
                        <h3 className="ap-text-lg ap-font-semibold ap-mb-2">{initiative ? initiative.title : 'General Meetings'}</h3>
                        <div className="ap-space-y-2">
                            {initiativeMeetings.map(meeting => (
                                <MeetingItem
                                    key={meeting.id}
                                    meeting={meeting}
                                    initiatives={initiatives}
                                    tasks={tasks}
                                    onUpdate={onUpdateMeeting}
                                    onDelete={onDeleteMeeting}
                                    currentUser={currentUser}
                                    isReadOnly={isReadOnly}
                                    participants={participants}
                                    isFocused={focusedMeetingId === meeting.id}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
            {meetings.length === 0 && <EmptyState>No meetings scheduled. Add one to plan your next sync.</EmptyState>}
        </div>
    );
};

// Connect With Section - Shows contact options for the other party
const ConnectWithSection: React.FC<{
    currentUser: UserProfile;
    mentor: UserProfile;
    mentee: UserProfile;
}> = ({ currentUser, mentor, mentee }) => {
    // Determine which person to show - if current user is mentor, show mentee info and vice versa
    const isMentor = currentUser.id === mentor.id;
    const otherPerson = isMentor ? mentee : mentor;
    const roleLabel = isMentor ? 'Mentee' : 'Mentor';
    
    // Use contactEmail if set, otherwise fall back to email
    const displayEmail = otherPerson.contactEmail || otherPerson.email;
    
    // Check if there are any contact methods available
    const hasContactMethods = displayEmail || 
                              otherPerson.bookingLink ||
                              otherPerson.linkedinUrl || 
                              otherPerson.groupmeUsername || 
                              otherPerson.signalUsername || 
                              otherPerson.telegramUsername;
    
    if (!hasContactMethods) {
        return null;
    }

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-4">
            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-3">
                <ChatIcon className="ap-h-5 ap-w-5 ap-text-purple-600" />
                <h3 className="ap-font-semibold ap-text-gray-900">Connect with your {roleLabel}</h3>
            </div>
            <div className="ap-flex ap-flex-wrap ap-gap-2">
                {/* Email - use contactEmail if set, otherwise default email */}
                {displayEmail && (
                    <a
                        href={`mailto:${displayEmail}`}
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-gray-100 hover:ap-bg-gray-200 ap-rounded-lg ap-text-sm ap-text-gray-700 ap-transition-colors ap-no-underline"
                        title={`Email ${otherPerson.firstName}`}
                    >
                        <EnvelopeIcon className="ap-h-4 ap-w-4 ap-text-gray-600" />
                        <span>Email</span>
                    </a>
                )}
                
                {/* Booking Link */}
                {otherPerson.bookingLink && (
                    <a
                        href={otherPerson.bookingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-blue-50 hover:ap-bg-blue-100 ap-rounded-lg ap-text-sm ap-text-blue-700 ap-transition-colors ap-no-underline"
                        title={`Book a meeting with ${otherPerson.firstName}`}
                    >
                        <CalendarDaysIcon className="ap-h-4 ap-w-4" />
                        <span>Book Meeting</span>
                    </a>
                )}
                
                {/* LinkedIn */}
                {otherPerson.linkedinUrl && (
                    <a
                        href={otherPerson.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-[#0077b5]/10 hover:ap-bg-[#0077b5]/20 ap-rounded-lg ap-text-sm ap-text-[#0077b5] ap-transition-colors ap-no-underline"
                        title={`Connect on LinkedIn`}
                    >
                        <FaLinkedin className="ap-h-4 ap-w-4" />
                        <span>LinkedIn</span>
                    </a>
                )}
                
                {/* GroupMe */}
                {otherPerson.groupmeUsername && (
                    <a
                        href={`https://groupme.com/contact/${otherPerson.groupmeUsername.replace('@', '')}/message`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-[#00aff0]/10 hover:ap-bg-[#00aff0]/20 ap-rounded-lg ap-text-sm ap-text-[#00aff0] ap-transition-colors ap-no-underline"
                        title={`Message on GroupMe: ${otherPerson.groupmeUsername}`}
                    >
                        <svg className="ap-h-4 ap-w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.18 1.88 5.82L2 22l4.18-1.88C7.82 21.3 9.83 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.93 0-3.72-.56-5.24-1.53l-.37-.23-2.48 1.12 1.12-2.48-.23-.37C3.56 15.72 3 13.93 3 12c0-4.96 4.04-9 9-9s9 4.04 9 9-4.04 9-9 9z"/>
                        </svg>
                        <span>GroupMe</span>
                    </a>
                )}
                
                {/* Signal */}
                {otherPerson.signalUsername && (
                    <a
                        href={`https://signal.me/#p/${otherPerson.signalUsername.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-[#3a76f0]/10 hover:ap-bg-[#3a76f0]/20 ap-rounded-lg ap-text-sm ap-text-[#3a76f0] ap-transition-colors ap-no-underline"
                        title={`Message on Signal: ${otherPerson.signalUsername}`}
                    >
                        <FaSignalMessenger className="ap-h-4 ap-w-4" />
                        <span>Signal</span>
                    </a>
                )}
                
                {/* Telegram */}
                {otherPerson.telegramUsername && (
                    <a
                        href={`https://t.me/${otherPerson.telegramUsername.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ap-inline-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-bg-[#0088cc]/10 hover:ap-bg-[#0088cc]/20 ap-rounded-lg ap-text-sm ap-text-[#0088cc] ap-transition-colors ap-no-underline"
                        title={`Message on Telegram: ${otherPerson.telegramUsername}`}
                    >
                        <FaTelegram className="ap-h-4 ap-w-4" />
                        <span>Telegram</span>
                    </a>
                )}
            </div>
        </div>
    );
};

// This is the new name for the component
const GoalDisplay: React.FC<GoalDisplayProps> = ({ goal, onUpdate, currentUser, isReadOnly, onAddUpdate, onUpdateUpdate, onDeleteUpdate, onAddMeeting, onUpdateMeeting, onUpdateMeetingLocal: _onUpdateMeetingLocal, onDeleteMeeting, onUpdateUpdateLocal: _onUpdateUpdateLocal, saveStatus: _saveStatus }) => {
    const [activeTab, setActiveTab] = useState<TabName>('Timeline');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState(goal.title);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editingDescription, setEditingDescription] = useState(goal.description);
    const [newUpdateText, setNewUpdateText] = useState('');
    const [newUpdateAttachments, setNewUpdateAttachments] = useState<Attachment[]>([]);
    const [isPostingUpdate, setIsPostingUpdate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    // Focused item from timeline click (to expand and scroll to)
    const [focusedItemId, setFocusedItemId] = useState<number | null>(null);
    const [focusedItemType, setFocusedItemType] = useState<'meeting' | 'update' | 'task' | null>(null);

    // Use a ref to always have the latest goal without causing re-renders
    const goalRef = useRef(goal);
    useEffect(() => {
        goalRef.current = goal;
    }, [goal]);

    // Memoize the description change handler
    const handleDescriptionChange = useCallback((html: string) => {
        setEditingDescription(html);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragStart(event: DragStartEvent) {
        if (isReadOnly) return;
        setActiveId(event.active.id.toString());
    }

    function handleDragCancel() {
        if (isReadOnly) return;
        setActiveId(null);
    }

    function handleDragEnd(event: DragEndEvent) {
        if (isReadOnly) return;
        
        setActiveId(null);
        const { active, over } = event;

        if (!over) {
            return;
        }

        const currentGoal = goalRef.current;
        const activeTask = currentGoal.tasks.find(t => t.id.toString() === active.id);
        if (!activeTask) { return; }

        const activeContainer = active.data.current?.sortable.containerId;
        const overIsInitiative = over.data.current?.type === 'initiative-container';
        const overContainer = overIsInitiative ? over.id.toString() : over.data.current?.sortable.containerId.toString();

        if (!overContainer) {
            return;
        }

        const oldIndex = currentGoal.tasks.findIndex(t => t.id.toString() === active.id);
        
        if (activeContainer === overContainer) {
            if (active.id === over.id) {
                return;
            }

            const newIndex = currentGoal.tasks.findIndex(t => t.id.toString() === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newTasks = arrayMove(currentGoal.tasks, oldIndex, newIndex);
                updateGoal({ tasks: newTasks });
            }
        } else {
            const newInitiativeId = overContainer === 'no-initiative' ? null : Number(overContainer);
            
            let newIndex: number;
            
            if (overIsInitiative) {
                const tasksInNewContainer = currentGoal.tasks.filter(t => (t.initiativeId?.toString() ?? 'no-initiative') === overContainer);
                const lastTaskInNewContainer = tasksInNewContainer[tasksInNewContainer.length - 1];
                
                if(lastTaskInNewContainer) {
                    newIndex = currentGoal.tasks.indexOf(lastTaskInNewContainer);
                } else {
                    newIndex = currentGoal.tasks.length - 1; 
                }

            } else {
                newIndex = currentGoal.tasks.findIndex(t => t.id.toString() === over.id);
            }

            if (oldIndex !== -1) {
                const newTasks = currentGoal.tasks.map(t => 
                    t.id.toString() === active.id 
                    ? { ...t, initiativeId: newInitiativeId } 
                    : t
                );
                
                const movedTask = newTasks[oldIndex];
                newTasks.splice(oldIndex, 1);

                const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
                
                newTasks.splice(adjustedNewIndex, 0, movedTask);

                updateGoal({ tasks: newTasks });
            }
        }
    }

    const updateGoal = useCallback((updates: Partial<Goal>) => {
        onUpdate({ ...goalRef.current, ...updates });
    }, [onUpdate]);

    const handleTitleSave = useCallback(() => {
        if (editingTitle.trim()) {
            updateGoal({ title: editingTitle });
        } else {
            setEditingTitle(goalRef.current.title);
        }
        setIsEditingTitle(false);
    }, [editingTitle, updateGoal]);

    const handleDescriptionSave = useCallback(() => {
        updateGoal({ description: editingDescription });
        setIsEditingDescription(false);
    }, [editingDescription, updateGoal]);

    const handleStatusChange = useCallback((newStatus: GoalStatus) => {
        updateGoal({ status: newStatus });
    }, [updateGoal]);

    const handlePortfolioToggle = useCallback(() => {
        updateGoal({ isPortfolio: !goalRef.current.isPortfolio });
    }, [updateGoal]);

    // Share goal link functionality
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
    const handleShareGoal = useCallback(() => {
        // Get the portfolio owner (mentee) to build the share URL
        const goalOwnerId = goal.mentee?.id || goal.mentor?.id;
        if (!goalOwnerId) return;
        
        const goalUrl = `${window.location.origin}${window.location.pathname}?view=portfolio&user_id=${goalOwnerId}&goal_id=${goal.id}`;
        navigator.clipboard.writeText(goalUrl).then(() => {
            setShareStatus('copied');
            setTimeout(() => {
                setShareStatus('idle');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
        });
    }, [goal.id, goal.mentee?.id, goal.mentor?.id]);

    // Check if current user can share this goal (owner, admin, or tier 6+)
    const wpData = (window as any).mentorshipPlatformData;
    const isAdmin = wpData?.is_admin || false;
    const canShare = goal.isPortfolio && currentUser && (
        currentUser.id === goal.mentee?.id ||  // Is the goal owner (mentee)
        currentUser.id === goal.mentor?.id ||  // Is the mentor
        isAdmin ||                              // Is WordPress admin
        (currentUser.tier && currentUser.tier >= 6)  // Is Tier 6+
    );

    const handleAddTask = useCallback(() => {
        const newTask: Task = {
            id: -Date.now(),
            text: 'New Task',
            isCompleted: false,
            initiativeId: null,
        };
        updateGoal({ tasks: [...goalRef.current.tasks, newTask] });
    }, [updateGoal]);

    const handleUpdateTask = useCallback((updatedTask: Task) => {
        updateGoal({
            tasks: goalRef.current.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t)),
        });
    }, [updateGoal]);

    const handleDeleteTask = useCallback((taskId: number) => {
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return;
        }
        const updatedTasks = goalRef.current.tasks.filter(t => t.id !== taskId);
        updateGoal({ tasks: updatedTasks });
    }, [updateGoal]);

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
        const updatedInitiatives = goalRef.current.initiatives.map(i => i.id === updatedInitiative.id ? updatedInitiative : i);
        updateGoal({ initiatives: updatedInitiatives });
    }, [updateGoal]);

    const handleDeleteInitiative = useCallback((initiativeId: number) => {
        if (!window.confirm('Are you sure you want to delete this initiative? Tasks linked to it will be unassigned.')) {
            return;
        }
        const updatedInitiatives = goalRef.current.initiatives.filter(i => i.id !== initiativeId);
        const updatedTasks = goalRef.current.tasks.map(t => t.initiativeId === initiativeId ? { ...t, initiativeId: null } : t);
        updateGoal({ initiatives: updatedInitiatives, tasks: updatedTasks });
    }, [updateGoal]);

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

    // Handle meeting update with optional action items creation
    const handleMeetingUpdate = useCallback((meeting: Meeting, newActionItems?: ActionItemFromMeeting[]) => {
        // First update the meeting
        if (onUpdateMeeting) {
            onUpdateMeeting(meeting);
        }
        
        // If there are new action items, create them as tasks
        if (newActionItems && newActionItems.length > 0) {
            const newTasks: Task[] = newActionItems.map(item => ({
                id: -Date.now() - Math.random(), // Temporary negative ID for new tasks
                text: item.text,
                isCompleted: false,
                initiativeId: meeting.initiativeId, // Link to same initiative as meeting
                assignedTo: item.assignedTo,
                assignedToName: item.assignedToName,
                dueDate: item.dueDate,
                createdFromMeetingId: meeting.id,
            }));
            
            updateGoal({ 
                tasks: [...goalRef.current.tasks, ...newTasks],
                // Also update the meeting's actionItems to include the new task IDs
                meetings: goalRef.current.meetings.map(m => 
                    m.id === meeting.id 
                        ? { ...meeting, actionItems: [...(meeting.actionItems || []), ...newTasks.map(t => t.id)] }
                        : m
                )
            });
        }
    }, [onUpdateMeeting, updateGoal]);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        try {
            const uploadedAttachment = await uploadFile(file);
            setNewUpdateAttachments(prev => [...prev, uploadedAttachment]);
        } catch (error) {
            console.error("File upload failed", error);
            alert("File upload failed. Please try again.");
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const handlePostUpdate = useCallback(async () => {
        if (!newUpdateText.trim() || !currentUser || !onAddUpdate) return;
        setIsPostingUpdate(true);
        const newUpdate: Omit<Update, 'id' | 'author' | 'date'> = {
            text: newUpdateText,
            initiativeId: null,
            attachments: newUpdateAttachments,
        };

        await onAddUpdate(newUpdate);

        // Reset form
        setNewUpdateText('');
        setNewUpdateAttachments([]);
        setIsPostingUpdate(false);
    }, [newUpdateText, currentUser, onAddUpdate, newUpdateAttachments]);

    const getTabColors = (tabName: TabName) => {
        switch (tabName) {
            case 'Timeline': return { activeColor: 'var(--tab-timeline-active, #6366f1)', bgColor: 'var(--tab-timeline-bg, #f5f3ff)' };
            case 'Initiatives': return { activeColor: 'var(--tab-roadmap-active)', bgColor: 'var(--tab-roadmap-bg)' };
            case 'Tasks': return { activeColor: 'var(--tab-tasks-active)', bgColor: 'var(--tab-tasks-bg)' };
            case 'Meetings': return { activeColor: 'var(--tab-meetings-active)', bgColor: 'var(--tab-meetings-bg)' };
            case 'Updates': return { activeColor: 'var(--tab-updates-active)', bgColor: 'var(--tab-updates-bg)' };
            default: return { activeColor: 'var(--brand-primary)', bgColor: 'transparent' };
        }
    };

    const { bgColor: activeTabBgColor } = getTabColors(activeTab);

    // Handlers for timeline clicks
    const handleTimelineMeetingClick = useCallback((meeting: Meeting) => {
        setFocusedItemId(meeting.id);
        setFocusedItemType('meeting');
        setActiveTab('Meetings');
        // Scroll to meeting after tab switch
        setTimeout(() => {
            const element = document.getElementById(`meeting-${meeting.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }, []);

    const handleTimelineUpdateClick = useCallback((update: Update) => {
        setFocusedItemId(update.id);
        setFocusedItemType('update');
        setActiveTab('Updates');
        setTimeout(() => {
            const element = document.getElementById(`update-${update.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }, []);

    const handleTimelineTaskClick = useCallback((task: Task) => {
        setFocusedItemId(task.id);
        setFocusedItemType('task');
        setActiveTab('Tasks');
        setTimeout(() => {
            const element = document.getElementById(`task-${task.id}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }, []);

    // Helper to render the content for the active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'Timeline':
                return (
                    <MentorshipTimeline
                        goal={goal}
                        currentUser={currentUser}
                        onMeetingClick={handleTimelineMeetingClick}
                        onUpdateClick={handleTimelineUpdateClick}
                        onTaskClick={handleTimelineTaskClick}
                    />
                );
            case 'Initiatives':
                return (
                    <div className="ap-space-y-4">
                        {/* --- HIDE BUTTON IF READ-ONLY --- */}
                        {!isReadOnly && (
                            <div className="ap-flex ap-justify-end">
                                <Button onClick={handleAddInitiative} variant="link" size="sm" leftIcon={<PlusCircleIcon className="ap-h-5 ap-w-5" />}>
                                    Add Initiative
                                </Button>
                            </div>
                        )}
                        {goal.initiatives.length > 0 ? (
                            goal.initiatives.map(initiative => (
                                <InitiativeItem
                                    key={initiative.id}
                                    initiative={initiative}
                                    onUpdate={handleUpdateInitiative}
                                    onDelete={handleDeleteInitiative}
                                    isReadOnly={isReadOnly} // <-- PASS PROP
                                />
                            ))
                        ) : <EmptyState>No initiatives yet. Add one to break down this goal.</EmptyState>}
                    </div>
                );
            case 'Tasks':
                // Build participants list from mentor and mentee for task assignment
                const taskParticipants: { id: number; name: string }[] = [];
                if (goal.mentee) {
                    taskParticipants.push({ 
                        id: goal.mentee.id, 
                        name: `${goal.mentee.firstName} ${goal.mentee.lastName}` 
                    });
                }
                if (goal.mentor) {
                    taskParticipants.push({ 
                        id: goal.mentor.id, 
                        name: `${goal.mentor.firstName} ${goal.mentor.lastName}` 
                    });
                }
                
                return (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                    >
                        <TaskList 
                            tasks={goal.tasks} 
                            initiatives={goal.initiatives} 
                            onUpdateTask={handleUpdateTask} 
                            onDeleteTask={handleDeleteTask} 
                            onAddTask={handleAddTask} 
                            activeId={activeId}
                            isReadOnly={isReadOnly} // <-- PASS PROP
                            goalTitle={goal.title}
                            participants={taskParticipants}
                            focusedTaskId={focusedItemType === 'task' ? focusedItemId : null}
                        />
                        {createPortal(
                            <DragOverlay
                                dropAnimation={{
                                    duration: 250,
                                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                                }}
                            >
                                {activeId ? (() => {
                                    const task = goal.tasks.find(t => t.id.toString() === activeId);
                                    if (!task) return null;
                                    return (
                                        <div style={{
                                            backgroundColor: 'white',
                                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                            borderRadius: '8px',
                                            border: '2px solid #3b82f6',
                                            outline: '4px solid rgba(59, 130, 246, 0.3)',
                                            transform: 'rotate(2deg) scale(1.05)',
                                            pointerEvents: 'none',
                                            minWidth: '300px',
                                            fontFamily: 'system-ui, -apple-system, sans-serif',
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '8px 12px',
                                                gap: '12px',
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '2px',
                                                    color: '#3b82f6',
                                                }}>
                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={task.isCompleted}
                                                    readOnly
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: '2px solid #9ca3af',
                                                        accentColor: '#3b82f6',
                                                    }}
                                                />
                                                <span style={{
                                                    fontSize: '14px',
                                                    color: task.isCompleted ? '#6b7280' : '#111827',
                                                    textDecoration: task.isCompleted ? 'ap-line-through' : 'none',
                                                    flex: 1,
                                                }}>
                                                    {task.text}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })() : null}
                            </DragOverlay>,
                            document.body
                        )}
                    </DndContext>
                );
            case 'Meetings':
                // Build participants list from mentor and mentee
                const meetingParticipants: { id: number; name: string }[] = [];
                if (goal.mentee) {
                    meetingParticipants.push({ 
                        id: goal.mentee.id, 
                        name: `${goal.mentee.firstName} ${goal.mentee.lastName}` 
                    });
                }
                if (goal.mentor) {
                    meetingParticipants.push({ 
                        id: goal.mentor.id, 
                        name: `${goal.mentor.firstName} ${goal.mentor.lastName}` 
                    });
                }
                
                return (
                    <MeetingList
                        meetings={goal.meetings}
                        initiatives={goal.initiatives}
                        tasks={goal.tasks}
                        onUpdateMeeting={handleMeetingUpdate}
                        onAddMeeting={handleAddMeeting}
                        onDeleteMeeting={onDeleteMeeting as (id: number) => void}
                        currentUser={currentUser}
                        isReadOnly={isReadOnly}
                        participants={meetingParticipants}
                        focusedMeetingId={focusedItemType === 'meeting' ? focusedItemId : null}
                    />
                );
            case 'Updates':
                return (
                    <div className="ap-space-y-6">
                        {/* --- HIDE ENTIRE FORM IF READ-ONLY --- */}
                        {!isReadOnly && currentUser && (
                            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                                <RichTextEditor
                                    value={newUpdateText}
                                    onChange={setNewUpdateText}
                                    placeholder="Post an update, ask a question, or share a win..."
                                />
                                {newUpdateAttachments.length > 0 && (
                                    <div className="ap-p-2 ap-border-t ap-border-gray-200">
                                        <p className="ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-2">Attachments:</p>
                                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                                            {newUpdateAttachments.map(att => (
                                                <div key={att.id} className="ap-bg-gray-100 ap-rounded-full ap-px-3 ap-py-1 ap-text-sm ap-flex ap-items-center ap-gap-2">
                                                    <DocumentIcon className="ap-h-4 ap-w-4" />
                                                    <span>{att.fileName}</span>
                                                    <Button onClick={() => setNewUpdateAttachments(p => p.filter(a => a.id !== att.id))} variant="ghost" size="xs" className="!ap-p-1 !ap-min-h-0 ap-text-gray-500 hover:ap-text-red-500"><XMarkIcon className="ap-h-3 ap-w-3" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="ap-flex ap-flex-wrap ap-justify-between ap-items-center ap-gap-2 ap-pt-2 ap-border-t ap-border-gray-200 ap-mt-2">
                                    <Button onClick={() => fileInputRef.current?.click()} variant="icon">
                                        <PaperClipIcon className="ap-h-5 ap-w-5" />
                                    </Button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept={ACCEPTED_FILE_TYPES} className="ap-hidden" />
                                    <Button onClick={handlePostUpdate} disabled={!newUpdateText.trim() || isPostingUpdate} variant="primary" loading={isPostingUpdate}>
                                        {isPostingUpdate ? 'Posting...' : 'Post'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Updates List */}
                        <div className="ap-space-y-6">
                            {goal.updates.map(update => (
                                <UpdateItem 
                                    key={update.id} 
                                    update={update} 
                                    currentUser={currentUser} // Pass current user (can be null)
                                    onUpdate={onUpdateUpdate}
                                    onDelete={onDeleteUpdate}
                                    isReadOnly={isReadOnly} // <-- PASS PROP
                                    isFocused={focusedItemType === 'update' && focusedItemId === update.id}
                                />
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="ap-space-y-6">
            {/* Mentorship Relationship Banner */}
            {goal.mentor && goal.mentee && (
                <div className="ap-bg-gradient-to-r ap-from-blue-50 ap-to-indigo-50 ap-rounded-lg ap-shadow-sm ap-border-2 ap-border-blue-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-justify-center ap-gap-8 ap-flex-wrap">
                        {/* Mentee (Goal Owner) */}
                        <a 
                            href={`${window.location.pathname}?view=portfolio&user_id=${goal.mentee.id}`}
                            className="ap-flex ap-items-center ap-gap-3 hover:ap-opacity-80 ap-transition-opacity ap-no-underline"
                        >
                            <img 
                                src={goal.mentee.avatarUrl || ''} 
                                alt={`${goal.mentee.firstName} ${goal.mentee.lastName}`} 
                                className="ap-h-12 ap-w-12 ap-rounded-full ap-object-cover ap-border-2 ap-border-green-400"
                            />
                            <div>
                                <p className="ap-text-xs ap-font-semibold ap-text-green-600 ap-uppercase ap-tracking-wide">Goal Owner</p>
                                <p className="ap-font-bold ap-text-gray-900">{goal.mentee.firstName} {goal.mentee.lastName}</p>
                            </div>
                        </a>
                        
                        {/* Separator */}
                        <div className="ap-text-2xl ap-text-gray-400">⟷</div>
                        
                        {/* Mentor */}
                        <a 
                            href={`${window.location.pathname}?view=portfolio&user_id=${goal.mentor.id}`}
                            className="ap-flex ap-items-center ap-gap-3 hover:ap-opacity-80 ap-transition-opacity ap-no-underline"
                        >
                            <img 
                                src={goal.mentor.avatarUrl || ''} 
                                alt={`${goal.mentor.firstName} ${goal.mentor.lastName}`} 
                                className="ap-h-12 ap-w-12 ap-rounded-full ap-object-cover ap-border-2 ap-border-blue-400"
                            />
                            <div>
                                <p className="ap-text-xs ap-font-semibold ap-text-blue-600 ap-uppercase ap-tracking-wide">Mentor</p>
                                <p className="ap-font-bold ap-text-gray-900">{goal.mentor.firstName} {goal.mentor.lastName}</p>
                            </div>
                        </a>
                    </div>
                </div>
            )}
            
            {/* Connect With Section - Show other party's contact info */}
            {goal.mentor && goal.mentee && currentUser && (
                <ConnectWithSection
                    currentUser={currentUser}
                    mentor={goal.mentor}
                    mentee={goal.mentee}
                />
            )}
            
            {/* Goal Header */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6 ap-border-t-4 ap-border-purple-600/40">
                {/* Title and Description */}
                <div className="ap-mb-4">
                    {isEditingTitle && !isReadOnly ? (
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={handleTitleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                                className="ap-text-2xl ap-font-bold ap-bg-gray-100 ap-rounded-md ap-p-1 -ap-m-1"
                                autoFocus
                            />
                            <Button onClick={handleTitleSave} variant="success" size="sm" title="Save"><CheckIcon className="ap-h-5 ap-w-5" /></Button>
                            <Button onClick={() => { setIsEditingTitle(false); setEditingTitle(goal.title); }} variant="danger" size="sm" title="Cancel"><XMarkIcon className="ap-h-5 ap-w-5" /></Button>
                        </div>
                    ) : (
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <h2 className="ap-text-xl ap-font-bold ap-text-blue-600">{goal.title}</h2>
                            {/* --- HIDE BUTTON IF READ-ONLY --- */}
                            {!isReadOnly && (
                                <Button onClick={() => setIsEditingTitle(true)} variant="icon" className="ap-text-gray-400 hover:ap-text-purple-600" title="Edit title"><PencilIcon className="ap-h-4 ap-w-4" /></Button>
                            )}
                        </div>
                    )}

                    {isEditingDescription && !isReadOnly ? (
                        <div className="ap-mt-2">
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
                        <div className="ap-flex ap-items-start ap-gap-2 ap-mt-2">
                            <div className="ap-prose ap-max-w-none ap-text-gray-600 ap-break-words" dangerouslySetInnerHTML={{ __html: goal.description || '' }} />
                            {/* --- HIDE BUTTON IF READ-ONLY --- */}
                            {!isReadOnly && (
                                <Button onClick={() => setIsEditingDescription(true)} variant="icon" className="ap-text-gray-400 hover:ap-text-purple-600 ap-flex-shrink-0" title="Edit description"><PencilIcon className="ap-h-4 ap-w-4" /></Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Status and Portfolio Controls - Separate Row */}
                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-4 ap-pt-4 ap-border-t ap-border-gray-200">
                    <GoalStatusDropdown 
                        currentStatus={goal.status} 
                        onStatusChange={handleStatusChange} 
                        isReadOnly={isReadOnly} // <-- PASS PROP
                    />
                    <PortfolioToggle 
                        isPortfolio={goal.isPortfolio} 
                        onToggle={handlePortfolioToggle} 
                        isReadOnly={isReadOnly} // <-- PASS PROP
                    />
                    {/* Share Goal Button - Only show when goal is public and user can share */}
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
                </div>
            </div>

            {/* --- ADD THIS NEW COMMENT SECTION --- */}
            <CommentSection 
                postId={goal.id} 
                currentUser={currentUser} 
                isReadOnly={isReadOnly} 
                initialCount={goal.commentCount || 0} // <-- PASS GOAL'S COMMENT COUNT (not total)
            />
            {/* ----------------------------------- */}

            {/* Tab Navigation */}
            <div className="ap-flex ap-flex-wrap ap-items-center ap-border-b ap-border-gray-300">
                <TabButton name="Timeline" icon={<ClockIcon className="ap-h-5 ap-w-5 ap-mr-2" />} activeTab={activeTab} onClick={setActiveTab} />
                <TabButton name="Initiatives" icon={<RocketLaunchIcon className="ap-h-5 ap-w-5 ap-mr-2" />} activeTab={activeTab} onClick={setActiveTab} /> 
                <TabButton name="Tasks" icon={<Bars2Icon className="ap-h-5 ap-w-5 ap-mr-2" />} activeTab={activeTab} onClick={setActiveTab} />
                <TabButton name="Meetings" icon={<CalendarDaysIcon className="ap-h-5 ap-w-5 ap-mr-2" />} activeTab={activeTab} onClick={setActiveTab} />
                <TabButton name="Updates" icon={<ChatBubbleOvalLeftEllipsisIcon className="ap-h-5 ap-w-5 ap-mr-2" />} activeTab={activeTab} onClick={setActiveTab} />
            </div>

            {/* Tab Content Area */}
            <div className="ap-mt-6 ap-p-4 ap-rounded-lg" style={{ backgroundColor: activeTabBgColor }}>
                {renderTabContent()}
            </div>
        </div>
    );
};

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-4">{children}</p>
);

const GoalStatusDropdown: React.FC<{ currentStatus: GoalStatus, onStatusChange: (status: GoalStatus) => void, isReadOnly: boolean }> = ({ currentStatus, onStatusChange, isReadOnly }) => {
    const [isOpen, setIsOpen] = useState(false);
    const statuses: GoalStatus[] = ['Not Started', 'In Progress', 'Completed'];
    const statusColors: Record<GoalStatus, string> = {
        'Not Started': 'ap-bg-gray-200 ap-text-gray-800',
        'In Progress': 'ap-bg-yellow-200 ap-text-yellow-800',
        'Completed': 'ap-bg-green-200 ap-text-green-800'
    };
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
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
                disabled={isReadOnly} // <-- DISABLE IF READ-ONLY
            >
                {currentStatus}
                <ChevronDownIcon className="ap-h-3 ap-w-3" />
            </Button>
            {isOpen && !isReadOnly && ( // <-- CHECK READ-ONLY
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

const PortfolioToggle: React.FC<{ isPortfolio: boolean, onToggle: () => void, isReadOnly: boolean }> = ({ isPortfolio, onToggle, isReadOnly }) => {
    return (
        <div className="ap-flex ap-items-center ap-gap-2">
            <BookmarkIcon className={`ap-h-4 ap-w-4 ap-flex-shrink-0 ${isPortfolio ? 'ap-text-blue-600' : 'ap-text-gray-400'}`} />
            <span className="ap-text-xs ap-text-gray-500 ap-whitespace-nowrap">Public Portfolio</span>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isReadOnly) {
                        onToggle();
                    }
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

const DroppableInitiativeContainer: React.FC<{
    id: string;
    title: string;
    taskCount: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    children: React.ReactNode;
}> = ({ id, title, taskCount, isCollapsed, onToggleCollapse, children }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: {
            type: 'initiative-container',
            accepts: ['task']
        },
    });

    const style = {
        backgroundColor: isOver ? 'rgba(191, 219, 254, 0.5)' : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} className="ap-bg-gray-50/50 ap-rounded-lg ap-transition-colors ap-overflow-hidden">
            <button
                onClick={onToggleCollapse}
                className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-3 ap-py-2.5 hover:ap-bg-gray-100 ap-transition-colors ap-select-none ap-text-left"
                aria-expanded={!isCollapsed}
                aria-label={`${title} — ${isCollapsed ? 'expand' : 'collapse'}`}
            >
                <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0">
                    {isCollapsed ? (
                        <ChevronRightIcon className="ap-h-4 ap-w-4 ap-text-gray-500 ap-flex-shrink-0" />
                    ) : (
                        <ChevronDownIcon className="ap-h-4 ap-w-4 ap-text-gray-500 ap-flex-shrink-0" />
                    )}
                    <h3 className="ap-text-lg ap-font-semibold ap-break-words ap-min-w-0">{title}</h3>
                </div>
                {isCollapsed && taskCount > 0 && (
                    <span className="ap-text-xs ap-text-gray-400 ap-bg-gray-200 ap-rounded-full ap-px-2 ap-py-0.5 ap-flex-shrink-0 ap-ml-2">
                        {taskCount} task{taskCount !== 1 ? 's' : ''}
                    </span>
                )}
            </button>
            {!isCollapsed && (
                <div className="ap-px-3 ap-pb-3">
                    {children}
                </div>
            )}
        </div>
    );
};

// Helper function to generate Google Calendar event URL
const generateGoogleCalendarUrl = (task: Task, goalTitle?: string): string => {
    const baseUrl = 'https://calendar.google.com/calendar/render';
    const params = new URLSearchParams();
    
    params.set('action', 'TEMPLATE');
    params.set('text', `📋 ${task.text}`);
    
    // Add description with context
    let description = 'Task from AquaticPro Mentorship';
    if (goalTitle) {
        description += `\n\nGoal: ${goalTitle}`;
    }
    if (task.assignedToName) {
        description += `\nAssigned to: ${task.assignedToName}`;
    }
    if (task.priority) {
        description += `\nPriority: ${task.priority}`;
    }
    params.set('details', description);
    
    // Set date - if due date exists, use it; otherwise use today
    if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        // Format as YYYYMMDD for all-day event
        const dateStr = dueDate.toISOString().split('T')[0].replace(/-/g, '');
        params.set('dates', `${dateStr}/${dateStr}`);
    } else {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        params.set('dates', `${dateStr}/${dateStr}`);
    }
    
    return `${baseUrl}?${params.toString()}`;
};

const TaskItem: React.FC<{
    id: string;
    task: Task;
    initiatives: Initiative[];
    onUpdate: (task: Task) => void;
    onDelete: (id: number) => void;
    isReadOnly: boolean; // <-- ADDED
    goalTitle?: string; // For Google Calendar context
    participants?: { id: number; name: string }[]; // For assignment dropdown
    isFocused?: boolean;
}> = ({ id, task, onUpdate, initiatives, onDelete, isReadOnly, goalTitle, participants = [], isFocused = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(task.text);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id, disabled: isReadOnly }); // <-- DISABLE DRAG IF READ-ONLY

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease',
        opacity: isDragging ? 0 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 50 : 'auto',
    };

    const handleSave = () => {
        if (text.trim()) {
            onUpdate({ ...task, text });
            setIsEditing(false);
        } else {
            setText(task.text);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setText(task.text);
        setIsEditing(false);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isNowCompleted = e.target.checked;
        onUpdate({ 
            ...task, 
            isCompleted: isNowCompleted,
            completedDate: isNowCompleted ? new Date().toISOString() : undefined
        });
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style}
            {...attributes}
            id={`task-${task.id}`}
            className={`ap-p-2 ap-rounded-md ap-bg-white hover:ap-bg-blue-50 ap-transition-colors ${!isReadOnly ? 'ap-cursor-grab active:ap-cursor-grabbing ap-touch-manipulation' : ''} ${isFocused ? 'ap-ring-2 ap-ring-blue-400 ap-bg-blue-50' : ''}`}
        >
            <div className="ap-flex ap-items-center ap-gap-3">
                {/* --- DRAG HANDLE --- */}
                {!isReadOnly && (
                    <div {...listeners} className="ap-flex ap-flex-col ap-items-center ap-gap-0.5 ap-text-gray-300 ap-cursor-grab active:ap-cursor-grabbing ap-touch-none">
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                    </div>
                )}
                <input
                    type="checkbox"
                    checked={task.isCompleted}
                    onChange={handleCheckboxChange}
                    className="ap-h-5 ap-w-5 ap-rounded ap-border-2 ap-border-gray-400 ap-bg-white ap-text-blue-600 focus:ap-ring-2 focus:ap-ring-blue-500 ap-mt-1 ap-self-start ap-flex-shrink-0"
                    disabled={isReadOnly}
                />
                <div className="ap-flex-grow">
                    {isEditing && !isReadOnly ? (
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <input
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') handleCancel();
                                }}
                                className="ap-flex-grow ap-bg-white ap-border ap-border-blue-500 ap-rounded ap-px-2 ap-py-1 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500"
                                autoFocus
                            />
                            <Button onClick={handleSave} variant="success" size="sm" title="Save">
                                <CheckIcon className="ap-h-4 ap-w-4" />
                            </Button>
                            <Button onClick={handleCancel} variant="danger" size="sm" title="Cancel">
                                <XMarkIcon className="ap-h-4 ap-w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <span onClick={() => !isReadOnly && setIsEditing(true)} className={`ap-block ${isReadOnly ? '' : 'cursor-pointer'} ${task.isCompleted ? 'ap-line-through ap-text-gray-500' : ''}`}>
                                {task.text}
                            </span>
                            {/* Task metadata: assignee, due date, priority */}
                            {(task.assignedToName || task.dueDate || task.priority) && (
                                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-2 ap-mt-1.5">
                                    {task.assignedToName && (
                                        <span className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-bg-blue-50 ap-text-blue-700 ap-px-2 ap-py-0.5 ap-rounded-full">
                                            <UserIcon className="ap-h-3 ap-w-3" />
                                            {task.assignedToName}
                                        </span>
                                    )}
                                    {task.dueDate && (
                                        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${
                                            new Date(task.dueDate) < new Date() && !task.isCompleted
                                                ? 'ap-bg-red-50 ap-text-red-700' : 'ap-bg-gray-100 ap-text-gray-600'
                                        }`}>
                                            <CalendarDaysIcon className="ap-h-3 ap-w-3" />
                                            {formatLocalDate(task.dueDate)}
                                        </span>
                                    )}
                                    {task.priority && task.priority !== 'medium' && (
                                        <span className={`ap-inline-flex ap-items-center ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${
                                            task.priority === 'high' 
                                                ? 'ap-bg-orange-50 ap-text-orange-700' : 'ap-bg-gray-50 ap-text-gray-500'
                                        }`}>
                                            {task.priority === 'high' ? '↑ High' : '↓ Low'}
                                        </span>
                                    )}
                                </div>
                            )}
                            {task.isCompleted && task.completedDate && (
                                <span className="ap-text-xs ap-text-gray-400 ap-block ap-mt-0.5">
                                    Completed on {formatLocalDate(task.completedDate)}
                                    {task.completedBy && ` by ${task.completedBy.name}`}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {/* Action buttons - Google Calendar is always visible, delete only when not read-only */}
                {!isEditing && (
                    <div className="ap-flex ap-items-center ap-gap-1 ap-self-start ap-flex-shrink-0">
                        {/* Add to Google Calendar button - always visible */}
                        <Button
                            onClick={() => {
                                const url = generateGoogleCalendarUrl(task, goalTitle);
                                window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            variant="icon"
                            className="ap-text-gray-400 hover:ap-text-blue-500"
                            title="Add to Google Calendar"
                        >
                            <svg className="ap-h-4 ap-w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                                <path d="M12 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </Button>
                        {!isReadOnly && (
                            <Button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this task?')) {
                                    onDelete(task.id);
                                }
                            }} variant="icon" className="ap-text-gray-400 hover:ap-text-red-500" title="Delete"><TrashIcon className="ap-h-4 ap-w-4" /></Button>
                        )}
                    </div>
                )}
            </div>
            {/* Task settings: Initiative, Assignee, Due Date - responsive layout */}
            {!isReadOnly && (
                <div className="ap-pl-9 ap-mt-2 ap-flex ap-flex-wrap ap-items-start ap-gap-2">
                    {/* Initiative - can grow to full width if needed */}
                    <select
                        value={task.initiativeId || ''}
                        onChange={(e) => onUpdate({ ...task, initiativeId: e.target.value ? Number(e.target.value) : null })}
                        className="ap-text-xs ap-bg-gray-100 ap-border-none ap-rounded-md focus:ap-ring-0 ap-min-w-[120px] ap-max-w-full"
                    >
                        <option value="">No Initiative</option>
                        {initiatives.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                    </select>
                    
                    {/* Assignee */}
                    {participants.length > 0 && (
                        <select
                            value={task.assignedTo || ''}
                            onChange={(e) => {
                                const userId = e.target.value ? Number(e.target.value) : undefined;
                                const userName = participants.find(p => p.id === userId)?.name;
                                onUpdate({ 
                                    ...task, 
                                    assignedTo: userId,
                                    assignedToName: userName
                                });
                            }}
                            className="ap-text-xs ap-bg-gray-100 ap-border-none ap-rounded-md focus:ap-ring-0 ap-min-w-[100px] ap-max-w-[180px]"
                        >
                            <option value="">Unassigned</option>
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                    
                    {/* Due Date */}
                    <div className="ap-flex ap-items-center ap-gap-1 ap-flex-shrink-0">
                        <CalendarDaysIcon className="ap-h-3.5 ap-w-3.5 ap-text-gray-400" />
                        <input
                            type="date"
                            value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                            onChange={(e) => onUpdate({ 
                                ...task, 
                                dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                            })}
                            className="ap-text-xs ap-bg-gray-100 ap-border-none ap-rounded-md focus:ap-ring-0 ap-w-[140px]"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const InitiativeItem: React.FC<{ initiative: Initiative, onUpdate: (initiative: Initiative) => void, onDelete: (id: number) => void, isReadOnly: boolean }> = ({ initiative, onUpdate, onDelete, isReadOnly }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initiative.title);
    const [description, setDescription] = useState(initiative.description);

    const handleSave = () => {
        if (title.trim()) {
            onUpdate({ ...initiative, title, description });
            setIsEditing(false);
        } else {
            setTitle(initiative.title);
        }
    };

    const handleCancel = () => {
        setTitle(initiative.title);
        setDescription(initiative.description);
        setIsEditing(false);
    };

    return (
        <div className="ap-bg-gray-50/50 ap-rounded-lg ap-p-3">
            {isEditing && !isReadOnly ? ( // <-- CHECK READ-ONLY
                <div className="ap-space-y-2">
                    <input 
                        type="text" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        className="ap-w-full ap-p-2 ap-font-semibold ap-bg-white ap-border ap-border-gray-300 ap-rounded-md focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500" 
                        placeholder="Initiative Title"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSave();
                            }
                            if (e.key === 'Escape') handleCancel();
                        }}
                    />
                    <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Initiative Description"
                    />
                    <div className="ap-flex ap-justify-end ap-gap-2">
                        <Button onClick={handleSave} variant="primary" size="xs" leftIcon={<CheckIcon className="ap-h-4 ap-w-4" />}>
                            Save
                        </Button>
                        <Button onClick={handleCancel} variant="secondary" size="xs" leftIcon={<XMarkIcon className="ap-h-4 ap-w-4" />}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="ap-flex ap-justify-between ap-items-start">
                        <div className="ap-flex-1 ap-min-w-0">
                            <p className="ap-font-semibold ap-break-words">{initiative.title}</p>
                            <div className="ap-prose ap-max-w-none ap-text-sm ap-text-gray-600" dangerouslySetInnerHTML={{ __html: initiative.description || '' }} />
                        </div>
                        {/* --- HIDE BUTTONS IF READ-ONLY --- */}
                        {!isReadOnly && (
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <select
                                    value={initiative.status}
                                    onChange={(e) => onUpdate({ ...initiative, status: e.target.value as InitiativeStatus })}
                                    className="ap-text-xs ap-bg-transparent ap-border-none ap-rounded-md focus:ap-ring-0"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <option>Not Started</option>
                                    <option>In Progress</option>
                                    <option>Completed</option>
                                </select>
                                <Button onClick={() => setIsEditing(true)} variant="icon" title="Edit"><PencilIcon className="ap-h-4 ap-w-4" /></Button>
                                <Button onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this initiative? Tasks linked to it will be unassigned.')) {
                                        onDelete(initiative.id);
                                    }
                                }} variant="icon" className="ap-text-gray-400 hover:ap-text-red-500" title="Delete"><TrashIcon className="ap-h-4 ap-w-4" /></Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Component to render HTML content with proper link truncation
const ProseContent: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Find all links in the rendered content
            const links = contentRef.current.querySelectorAll('a');
            links.forEach(link => {
                // Apply truncation styles directly to each link
                link.style.display = 'inline-block';
                link.style.maxWidth = '100%';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.whiteSpace = 'nowrap';
                link.style.verticalAlign = 'bottom';
                link.style.wordBreak = 'break-all';
            });
        }
    }, [html]);

    return (
        <div 
            ref={contentRef}
            className={className}
            style={{ overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

// Action item type for new items created from meeting
interface ActionItemFromMeeting {
    id: number;
    text: string;
    assignedTo?: number;
    assignedToName?: string;
    dueDate?: string;
}

const MeetingItem: React.FC<{ 
    meeting: Meeting, 
    initiatives: Initiative[], 
    tasks: Task[],
    onUpdate?: (meeting: Meeting, newActionItems?: ActionItemFromMeeting[]) => void, 
    onDelete?: (id: number) => void, 
    isReadOnly: boolean, 
    currentUser: UserProfile | null,
    participants: { id: number; name: string }[],
    isFocused?: boolean
}> = ({ meeting, initiatives, tasks, onUpdate, onDelete, isReadOnly, currentUser, participants, isFocused = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(isFocused); // Auto-expand if focused

    // Update expansion when focus changes
    React.useEffect(() => {
        if (isFocused) {
            setIsExpanded(true);
        }
    }, [isFocused]);

    const handleSave = (updatedMeeting: Meeting, newActionItems?: ActionItemFromMeeting[]) => {
        if (onUpdate) {
            onUpdate(updatedMeeting, newActionItems);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const initiative = initiatives.find(i => i.id === meeting.initiativeId);
    
    // Check if meeting has structured content
    const hasAgenda = meeting.agenda && meeting.agenda.length > 0;
    const hasDecisions = meeting.decisions && meeting.decisions.length > 0;
    const hasFollowUp = meeting.followUp && meeting.followUp.length > 0;
    const hasActionItems = meeting.actionItems && meeting.actionItems.length > 0;
    const hasStructuredContent = hasAgenda || hasDecisions || hasFollowUp || hasActionItems;

    return (
        <div 
            id={`meeting-${meeting.id}`}
            className={`ap-bg-white ap-rounded-lg ap-border ap-overflow-hidden ap-transition-all ${isFocused ? 'ap-border-blue-400 ap-ring-2 ap-ring-blue-200' : 'ap-border-gray-200'}`}
        >
            {isEditing && !isReadOnly ? (
                <div className="ap-p-4">
                    <EnhancedMeetingForm
                        meeting={meeting}
                        initiatives={initiatives}
                        tasks={tasks}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isReadOnly={isReadOnly}
                        participants={participants}
                    />
                </div>
            ) : (
                <div>
                    {/* Meeting Header - Always visible */}
                    <div 
                        className="ap-p-4 ap-cursor-pointer hover:ap-bg-gray-50 ap-transition-colors"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="ap-flex ap-justify-between ap-items-start ap-gap-2">
                            <div className="ap-flex-1 ap-min-w-0">
                                <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                                    <p className="ap-font-semibold ap-text-gray-900">{meeting.topic}</p>
                                    {meeting.recurringPattern && meeting.recurringPattern !== 'none' && (
                                        <span className="ap-text-xs ap-text-purple-600 ap-bg-purple-100 ap-px-2 ap-py-0.5 ap-rounded-full">
                                            {meeting.recurringPattern === 'weekly' ? 'Weekly' : 
                                             meeting.recurringPattern === 'biweekly' ? 'Biweekly' : 'Monthly'}
                                        </span>
                                    )}
                                    <span className="ap-text-xs ap-text-gray-500 ap-bg-gray-100 ap-px-2 ap-py-0.5 ap-rounded-full">
                                        By {meeting.author.firstName} {meeting.author.lastName}
                                    </span>
                                </div>
                                <p className="ap-text-sm ap-text-gray-500 ap-flex ap-items-center ap-gap-1 ap-mt-1">
                                    <CalendarDaysIcon className="ap-h-4 ap-w-4" /> 
                                    {formatLocalDate(meeting.date, { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    })}
                                    {meeting.duration && (
                                        <span className="ap-text-gray-400 ap-ml-2">({meeting.duration} min)</span>
                                    )}
                                </p>
                                
                                {initiative && (
                                    <p className="ap-text-xs ap-font-medium ap-text-blue-600 ap-bg-blue-50 ap-rounded-full ap-px-2 ap-py-0.5 ap-inline-block ap-mt-1">
                                        {initiative.title}
                                    </p>
                                )}

                                {/* Quick summary badges */}
                                {hasStructuredContent && (
                                    <div className="ap-flex ap-items-center ap-gap-2 ap-mt-2 ap-flex-wrap">
                                        {hasAgenda && (
                                            <span className="ap-text-xs ap-text-gray-500 ap-bg-gray-100 ap-px-2 ap-py-0.5 ap-rounded">
                                                {meeting.agenda!.length} agenda items
                                            </span>
                                        )}
                                        {hasDecisions && (
                                            <span className="ap-text-xs ap-text-amber-600 ap-bg-amber-50 ap-px-2 ap-py-0.5 ap-rounded">
                                                {meeting.decisions!.length} decisions
                                            </span>
                                        )}
                                        {hasFollowUp && (
                                            <span className="ap-text-xs ap-text-green-600 ap-bg-green-50 ap-px-2 ap-py-0.5 ap-rounded">
                                                {meeting.followUp!.length} follow-ups
                                            </span>
                                        )}
                                        {hasActionItems && (
                                            <span className="ap-text-xs ap-text-teal-600 ap-bg-teal-50 ap-px-2 ap-py-0.5 ap-rounded">
                                                {meeting.actionItems!.length} action items
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Actions */}
                            <div className="ap-flex ap-items-center ap-gap-2 ap-flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {!isReadOnly && (
                                    <>
                                        <Button onClick={() => setIsEditing(true)} variant="icon" title="Edit">
                                            <PencilIcon className="ap-h-4 ap-w-4" />
                                        </Button>
                                        {onDelete && (
                                            <Button 
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this meeting?')) {
                                                        onDelete(meeting.id);
                                                    }
                                                }} 
                                                variant="icon"
                                                className="ap-text-gray-400 hover:ap-text-red-500" 
                                                title="Delete"
                                            >
                                                <TrashIcon className="ap-h-4 ap-w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <div className="ap-border-t ap-border-gray-100 ap-p-4 ap-space-y-4 ap-bg-gray-50/50">
                            {/* Meeting Link */}
                            {meeting.meetingLink && (
                                <div>
                                    <a 
                                        href={meeting.meetingLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="ap-text-sm ap-text-blue-600 hover:ap-text-blue-700 ap-flex ap-items-center ap-gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span>🔗</span> Join Meeting
                                    </a>
                                </div>
                            )}

                            {/* Agenda Items */}
                            {hasAgenda && (
                                <div>
                                    <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Agenda</h4>
                                    <ul className="ap-space-y-1">
                                        {meeting.agenda!.map(item => (
                                            <li key={item.id} className={`ap-text-sm ap-flex ap-items-start ap-gap-2 ${item.isDiscussed ? 'ap-text-gray-400 ap-line-through' : 'ap-text-gray-700'}`}>
                                                <span>{item.isDiscussed ? '✓' : '•'}</span>
                                                <span>{item.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Notes - BlockEditor (notesJson) or legacy HTML (notes) */}
                            {(meeting.notesJson || meeting.notes) && (
                                <div>
                                    <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Discussion Notes</h4>
                                    {meeting.notesJson ? (
                                        <div className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-600">
                                            <BlockEditor
                                                initialContent={meeting.notesJson}
                                                editable={false}
                                                onChange={() => {}}
                                            />
                                        </div>
                                    ) : meeting.notes ? (
                                        <ProseContent 
                                            html={meeting.notes}
                                            className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-600"
                                        />
                                    ) : null}
                                </div>
                            )}

                            {/* Decisions */}
                            {hasDecisions && (
                                <div>
                                    <h4 className="ap-text-sm ap-font-medium ap-text-amber-700 ap-mb-2">Decisions Made</h4>
                                    <ul className="ap-space-y-1">
                                        {meeting.decisions!.map(decision => (
                                            <li key={decision.id} className="ap-text-sm ap-text-gray-700 ap-flex ap-items-start ap-gap-2">
                                                <span className="ap-text-amber-500">💡</span>
                                                <span>{decision.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Follow-ups */}
                            {hasFollowUp && (
                                <div>
                                    <h4 className="ap-text-sm ap-font-medium ap-text-green-700 ap-mb-2">Follow-up Items</h4>
                                    <ul className="ap-space-y-1">
                                        {meeting.followUp!.map(item => (
                                            <li key={item.id} className={`ap-text-sm ap-flex ap-items-start ap-gap-2 ${item.isAddressed ? 'ap-text-gray-400 ap-line-through' : 'ap-text-gray-700'}`}>
                                                <span>{item.isAddressed ? '✓' : '○'}</span>
                                                <span>{item.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Action Items */}
                            {hasActionItems && (
                                <div>
                                    <h4 className="ap-text-sm ap-font-medium ap-text-teal-700 ap-mb-2">Action Items</h4>
                                    <ul className="ap-space-y-1">
                                        {meeting.actionItems!.map(taskId => {
                                            const task = tasks.find(t => t.id === taskId);
                                            // Handle case where task might have been deleted or not loaded
                                            if (!task) return null;
                                            return (
                                                <li key={task.id} className={`ap-text-sm ap-flex ap-items-start ap-gap-2 ${task.isCompleted ? 'ap-text-gray-400 ap-line-through' : 'ap-text-gray-700'}`}>
                                                    <span>{task.isCompleted ? '✓' : '○'}</span>
                                                    <span className="ap-flex-1">{task.text}</span>
                                                    {task.assignedToName && (
                                                        <span className="ap-text-xs ap-text-gray-500 ap-whitespace-nowrap">→ {task.assignedToName}</span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Comments */}
                            <div className="ap-pt-2 ap-border-t ap-border-gray-200">
                                <CommentSection 
                                    postId={meeting.id} 
                                    currentUser={currentUser} 
                                    isReadOnly={isReadOnly} 
                                    initialCount={meeting.commentCount || 0}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const UpdateItem: React.FC<{ 
    update: Update, 
    currentUser: UserProfile | null, 
    isReadOnly: boolean,
    onUpdate?: (update: Update) => Promise<void>,
    onDelete?: (id: number) => Promise<void>,
    isFocused?: boolean,
}> = ({ update, currentUser, isReadOnly, onUpdate, onDelete, isFocused = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(update.text);
    const [editAttachments, setEditAttachments] = useState<Attachment[]>(update.attachments);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const canEdit = !isReadOnly && currentUser && update.author && (currentUser.id === update.author.id || currentUser.id === 1);

    const handleSave = () => {
        if (onUpdate && (editText.trim() !== update.text || JSON.stringify(editAttachments) !== JSON.stringify(update.attachments))) {
            onUpdate({ ...update, text: editText, attachments: editAttachments });
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(update.text);
        setEditAttachments(update.attachments);
        setIsEditing(false);
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAttachment(true);
        try {
            const uploadedAttachment = await uploadFile(file);
            setEditAttachments(prev => [...prev, uploadedAttachment]);
        } catch (error) {
            console.error('Failed to upload file:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setIsUploadingAttachment(false);
            if (editFileInputRef.current) {
                editFileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveAttachment = (attachmentId: string) => {
        setEditAttachments(prev => prev.filter(a => a.id !== attachmentId));
    };


    return (
        <div 
            id={`update-${update.id}`}
            className={`ap-bg-white ap-rounded-lg ap-shadow ap-p-4 ap-transition-all ${isFocused ? 'ap-ring-2 ap-ring-blue-400 ap-border-blue-400' : ''}`}
        >
            <div className="ap-flex ap-items-start ap-gap-3">
                {update.author ? (
                    <img src={update.author.avatarUrl || ''} alt={update.author.firstName || 'User'} className="ap-h-10 ap-w-10 ap-rounded-full" />
                ) : (
                    <div className="ap-h-10 ap-w-10 ap-rounded-full ap-bg-gray-200 ap-flex ap-items-center ap-justify-center">
                        <UserIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                    </div>
                )}
                <div className="ap-flex-grow ap-min-w-0 ap-overflow-hidden">
                    <p>
                        <span className="ap-font-semibold ap-text-gray-900">
                            {update.author ? `${update.author.firstName} ${update.author.lastName}` : 'Unknown User'}
                        </span>
                        <span className="ap-text-sm ap-text-gray-500 ap-ml-2">{new Date(update.date).toLocaleString()}</span>
                    </p>
                    {isEditing && canEdit ? (
                        <div className="ap-mt-2">
                            <RichTextEditor value={editText} onChange={setEditText} />
                            
                            {/* Attachment management during editing */}
                            <div className="ap-mt-3">
                                <div className="ap-flex ap-items-center ap-justify-between ap-mb-2">
                                    <p className="ap-text-xs ap-font-medium ap-text-gray-500">Attachments:</p>
                                    <Button 
                                        onClick={() => editFileInputRef.current?.click()} 
                                        disabled={isUploadingAttachment}
                                        variant="link"
                                        size="xs"
                                        className="!ap-p-0 ap-text-gray-600 hover:ap-text-gray-900"
                                        leftIcon={<PaperClipIcon className="ap-h-3 ap-w-3" />}
                                    >
                                        {isUploadingAttachment ? 'Uploading...' : 'Add File'}
                                    </Button>
                                    <input 
                                        ref={editFileInputRef} 
                                        type="file" 
                                        onChange={handleAttachmentUpload} 
                                        accept={ACCEPTED_FILE_TYPES}
                                        className="ap-hidden" 
                                    />
                                </div>
                                {editAttachments.length > 0 && (
                                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                                        {editAttachments.map(att => (
                                            <div key={att.id} className="ap-bg-gray-100 ap-rounded-full ap-px-3 ap-py-1 ap-text-sm ap-flex ap-items-center ap-gap-2">
                                                <DocumentIcon className="ap-h-4 ap-w-4" />
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="hover:ap-underline">
                                                    {att.fileName}
                                                </a>
                                                <Button 
                                                    onClick={() => handleRemoveAttachment(att.id)} 
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 ap-text-gray-500 hover:ap-text-red-500"
                                                >
                                                    <XMarkIcon className="ap-h-3 ap-w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="ap-flex ap-gap-2 ap-mt-2">
                                <Button onClick={handleSave} variant="primary" size="xs" leftIcon={<CheckIcon className="ap-h-4 ap-w-4" />}>
                                    Save
                                </Button>
                                <Button onClick={handleCancel} variant="secondary" size="xs" leftIcon={<XMarkIcon className="ap-h-4 ap-w-4" />}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <ProseContent 
                            html={update.text}
                            className="ap-prose ap-max-w-none ap-text-gray-700 ap-mt-1 ap-break-words"
                        />
                    )}

                    {update.attachments.length > 0 && (
                        <div className="ap-mt-3">
                            <p className="ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-2">Attachments:</p>
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                {update.attachments.map(att => (
                                    <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="ap-bg-gray-100 ap-rounded-full ap-px-3 ap-py-1 ap-text-sm ap-flex ap-items-center ap-gap-2 hover:ap-bg-gray-200">
                                        <DocumentIcon className="ap-h-4 ap-w-4" />
                                        <span>{att.fileName}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- REPLACE THE OLD COMMENT LOGIC WITH THIS --- */}
                    <CommentSection 
                        postId={update.id} 
                        currentUser={currentUser} 
                        isReadOnly={isReadOnly} 
                        initialCount={update.commentCount || 0} // <-- PASS UPDATE COUNT
                    />
                    {/* ----------------------------------------------- */}
                </div>
                {canEdit && !isEditing && (
                    <div className="ap-flex ap-items-center ap-gap-2 ap-flex-shrink-0">
                        <Button onClick={() => setIsEditing(true)} variant="icon" className="ap-text-gray-400 hover:ap-text-purple-600" title="Edit">
                            <PencilIcon className="ap-h-4 ap-w-4" />
                        </Button>
                        {onDelete && (
                            <Button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this update?')) {
                                    onDelete(update.id);
                                }
                            }} variant="icon" className="ap-text-gray-400 hover:ap-text-red-500" title="Delete">
                                <TrashIcon className="ap-h-4 ap-w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- RENAMED COMPONENT ---
export default GoalDisplay;

// --- TabButton and ChevronDownIcon are now defined inside GoalDisplay or imported
const TabButton: React.FC<TabButtonProps> = ({ name, icon, activeTab, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isActive = activeTab === name;

    const getTabColors = (tabName: TabName) => {
        switch (tabName) {
            case 'Timeline': return { activeColor: 'var(--tab-timeline-active, #6366f1)' };
            case 'Initiatives': return { activeColor: 'var(--tab-roadmap-active)' };
            case 'Tasks': return { activeColor: 'var(--tab-tasks-active)' };
            case 'Meetings': return { activeColor: 'var(--tab-meetings-active)' };
            case 'Updates': return { activeColor: 'var(--tab-updates-active)' };
            default: return { activeColor: 'var(--brand-primary)' };
        }
    };
    const { activeColor } = getTabColors(name);

    const style: React.CSSProperties = {
        border: '2px solid',
        borderRadius: '0.5rem 0.5rem 0 0',
    };
    
    if (isActive || isHovered) {
        style.backgroundColor = activeColor;
        style.color = 'white';
        style.borderColor = activeColor;
    } else {
        style.backgroundColor = '#f3e8ff';
        style.color = '#6b21a8';
        style.borderColor = '#d8b4fe';
    }

    style.borderBottomColor = isActive ? activeColor : 'transparent';

    return (
        <Button
            onClick={() => onClick(name)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            variant="ghost"
            className={`tab-button ${isActive ? 'active' : ''}`}
            style={style}
        >
            {icon}
            {name}
        </Button>
    );
};

// Named exports for GoalWorkspace to reuse
export { TaskList, MeetingList, UpdateItem, ConnectWithSection, EmptyState };