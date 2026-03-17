import React, { useMemo } from 'react';
import { Goal, ActivityItem, ActivityType, UserProfile, Meeting, Update, Task, Initiative } from '@/types';
import { 
    HiOutlineCalendarDays as CalendarIcon,
    HiOutlineChatBubbleOvalLeftEllipsis as UpdateIcon,
    HiOutlineCheckCircle as TaskIcon,
    HiOutlineRocketLaunch as InitiativeIcon,
    HiOutlineFlag as GoalIcon,
    HiOutlineDocumentText as NotesIcon,
    HiOutlineLightBulb as DecisionIcon,
    HiOutlineClipboardDocumentList as ActionIcon,
} from 'react-icons/hi2';

/** Strip HTML tags and collapse whitespace for plain-text excerpts */
const stripHtml = (html: string): string => {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
};

interface MentorshipTimelineProps {
    goal: Goal;
    currentUser: UserProfile | null;
    onMeetingClick?: (meeting: Meeting) => void;
    onUpdateClick?: (update: Update) => void;
    onTaskClick?: (task: Task) => void;
    onInitiativeClick?: (initiative: Initiative) => void;
    /** ID of the currently active/focused item (highlighted in timeline) */
    activeItemId?: number | null;
    /** Type of the currently active/focused item */
    activeItemType?: 'meeting' | 'update' | 'task' | null;
    /** Initiative filter — dims non-matching items */
    selectedInitiativeId?: number | null;
}

// Helper to generate activity items from goal data
function generateActivityItems(goal: Goal): ActivityItem[] {
    const activities: ActivityItem[] = [];

    // Add meetings
    goal.meetings.forEach(meeting => {
        // Meeting scheduled/held
        activities.push({
            id: `meeting_${meeting.id}`,
            type: 'meeting_held',
            timestamp: meeting.date,
            actor: meeting.author,
            title: meeting.topic,
            description: meeting.notes ? meeting.notes.substring(0, 150) + (meeting.notes.length > 150 ? '...' : '') : undefined,
            sourceType: 'meeting',
            sourceId: meeting.id,
            initiativeId: meeting.initiativeId,
            metadata: {
                meetingLink: meeting.meetingLink,
                duration: meeting.duration,
                hasAgenda: meeting.agenda && meeting.agenda.length > 0,
                hasDecisions: meeting.decisions && meeting.decisions.length > 0,
                hasActionItems: meeting.actionItems && meeting.actionItems.length > 0,
            }
        });
    });

    // Add updates
    goal.updates.forEach(update => {
        activities.push({
            id: `update_${update.id}`,
            type: 'update_posted',
            timestamp: update.date,
            actor: update.author,
            title: 'Posted an update',
            description: update.text ? update.text.substring(0, 200) + (update.text.length > 200 ? '...' : '') : undefined,
            sourceType: 'update',
            sourceId: update.id,
            initiativeId: update.initiativeId,
            metadata: {
                hasAttachments: update.attachments && update.attachments.length > 0,
                attachmentCount: update.attachments?.length || 0,
            }
        });
    });

    // Add completed tasks
    goal.tasks.filter(task => task.isCompleted && task.completedDate).forEach(task => {
        activities.push({
            id: `task_completed_${task.id}`,
            type: 'task_completed',
            timestamp: task.completedDate!,
            actor: task.completedBy ? {
                id: task.completedBy.id,
                firstName: task.completedBy.name.split(' ')[0] || '',
                lastName: task.completedBy.name.split(' ').slice(1).join(' ') || '',
                avatarUrl: '',
                tagline: '',
                mentorOptIn: false,
                skills: [],
                bioDetails: '',
                experience: '',
                customLinks: [],
            } : goal.mentee || goal.mentor || {
                id: 0,
                firstName: 'Unknown',
                lastName: '',
                avatarUrl: '',
                tagline: '',
                mentorOptIn: false,
                skills: [],
                bioDetails: '',
                experience: '',
                customLinks: [],
            },
            title: `Completed: ${task.text}`,
            sourceType: 'task',
            sourceId: task.id,
            initiativeId: task.initiativeId,
            metadata: {
                assignedTo: task.assignedTo,
                assignedToName: task.assignedToName,
                createdFromMeetingId: task.createdFromMeetingId,
            }
        });
    });

    // Sort by timestamp descending (most recent first)
    return activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

// Get icon for activity type
function getActivityIcon(type: ActivityType): React.ReactNode {
    switch (type) {
        case 'meeting_scheduled':
        case 'meeting_held':
            return <CalendarIcon className="ap-h-5 ap-w-5" />;
        case 'meeting_notes_added':
            return <NotesIcon className="ap-h-5 ap-w-5" />;
        case 'update_posted':
            return <UpdateIcon className="ap-h-5 ap-w-5" />;
        case 'task_created':
        case 'task_completed':
            return <TaskIcon className="ap-h-5 ap-w-5" />;
        case 'initiative_created':
        case 'initiative_status_changed':
            return <InitiativeIcon className="ap-h-5 ap-w-5" />;
        case 'goal_status_changed':
            return <GoalIcon className="ap-h-5 ap-w-5" />;
        case 'action_item_created':
            return <ActionIcon className="ap-h-5 ap-w-5" />;
        case 'decision_made':
            return <DecisionIcon className="ap-h-5 ap-w-5" />;
        default:
            return <UpdateIcon className="ap-h-5 ap-w-5" />;
    }
}

// Get color class for activity type
function getActivityColor(type: ActivityType): string {
    switch (type) {
        case 'meeting_scheduled':
        case 'meeting_held':
        case 'meeting_notes_added':
            return 'ap-bg-blue-100 ap-text-blue-600 ap-border-blue-200';
        case 'update_posted':
            return 'ap-bg-purple-100 ap-text-purple-600 ap-border-purple-200';
        case 'task_created':
        case 'task_completed':
            return 'ap-bg-green-100 ap-text-green-600 ap-border-green-200';
        case 'initiative_created':
        case 'initiative_status_changed':
            return 'ap-bg-orange-100 ap-text-orange-600 ap-border-orange-200';
        case 'goal_status_changed':
            return 'ap-bg-yellow-100 ap-text-yellow-600 ap-border-yellow-200';
        case 'action_item_created':
            return 'ap-bg-teal-100 ap-text-teal-600 ap-border-teal-200';
        case 'decision_made':
            return 'ap-bg-indigo-100 ap-text-indigo-600 ap-border-indigo-200';
        default:
            return 'ap-bg-gray-100 ap-text-gray-600 ap-border-gray-200';
    }
}

// Get human-readable label for activity type
function getActivityLabel(type: ActivityType): string {
    switch (type) {
        case 'meeting_scheduled': return 'Meeting Scheduled';
        case 'meeting_held': return 'Meeting';
        case 'meeting_notes_added': return 'Notes Added';
        case 'update_posted': return 'Update';
        case 'task_created': return 'Task Created';
        case 'task_completed': return 'Task Completed';
        case 'initiative_created': return 'Initiative Created';
        case 'initiative_status_changed': return 'Initiative Updated';
        case 'goal_status_changed': return 'Goal Updated';
        case 'action_item_created': return 'Action Item';
        case 'decision_made': return 'Decision Made';
        default: return 'Activity';
    }
}

// Format date for timeline display
function formatTimelineDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

// Format time
function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

// Activity Item Component
const TimelineItem: React.FC<{
    activity: ActivityItem;
    onMeetingClick?: (meeting: Meeting) => void;
    onUpdateClick?: (update: Update) => void;
    onTaskClick?: (task: Task) => void;
    goal: Goal;
    /** Whether this item is the currently active/focused one */
    isActive?: boolean;
    /** Whether this item is dimmed by initiative filter */
    isDimmed?: boolean;
}> = ({ activity, onMeetingClick, onUpdateClick, onTaskClick, goal, isActive = false, isDimmed = false }) => {
    const handleClick = () => {
        switch (activity.sourceType) {
            case 'meeting':
                const meeting = goal.meetings.find(m => m.id === activity.sourceId);
                if (meeting && onMeetingClick) onMeetingClick(meeting);
                break;
            case 'update':
                const update = goal.updates.find(u => u.id === activity.sourceId);
                if (update && onUpdateClick) onUpdateClick(update);
                break;
            case 'task':
                const task = goal.tasks.find(t => t.id === activity.sourceId);
                if (task && onTaskClick) onTaskClick(task);
                break;
        }
    };

    // Find initiative title if applicable
    const initiativeTitle = activity.initiativeId 
        ? goal.initiatives.find(i => i.id === activity.initiativeId)?.title 
        : null;

    // Build class list: active highlight + initiative dim
    const itemClasses = [
        'ap-relative ap-flex ap-gap-4 ap-pb-8 last:ap-pb-0 ap-cursor-pointer',
        '-ap-mx-4 ap-px-4 ap-py-2 ap-rounded-lg ap-transition-all ap-duration-300',
        isActive
            ? 'ap-bg-blue-50 ap-ring-2 ap-ring-blue-300 ap-ring-inset timeline-pulse'
            : 'hover:ap-bg-gray-50',
        isDimmed ? 'ap-opacity-40' : '',
    ].filter(Boolean).join(' ');

    // Active icon ring: filled dot instead of outline
    const iconRingClass = isActive
        ? 'ap-ring-2 ap-ring-blue-400 ap-ring-offset-2'
        : '';

    return (
        <div
            className={itemClasses}
            onClick={handleClick}
            data-timeline-id={`timeline-${activity.sourceType}-${activity.sourceId}`}
        >
            {/* Timeline line */}
            <div className="ap-absolute ap-left-[1.65rem] ap-top-12 ap-bottom-0 ap-w-0.5 ap-bg-gray-200 last:ap-hidden" />
            
            {/* Icon */}
            <div className={`ap-flex-shrink-0 ap-w-10 ap-h-10 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-border-2 ${getActivityColor(activity.type)} ${iconRingClass}`}>
                {getActivityIcon(activity.type)}
            </div>

            {/* Content */}
            <div className="ap-flex-1 ap-min-w-0">
                <div className="ap-flex ap-items-start ap-justify-between ap-gap-2">
                    <div>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                            <span className={`ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full ${getActivityColor(activity.type)}`}>
                                {getActivityLabel(activity.type)}
                            </span>
                            {initiativeTitle && (
                                <span className="ap-text-xs ap-text-gray-500 ap-bg-gray-100 ap-px-2 ap-py-0.5 ap-rounded-full">
                                    {initiativeTitle}
                                </span>
                            )}
                        </div>
                        <h4 className="ap-font-medium ap-text-gray-900 ap-mt-1 ap-text-sm ap-truncate">{activity.title}</h4>
                        {activity.description && (
                            <p className="ap-text-xs ap-text-gray-500 ap-mt-0.5 ap-truncate">
                                {stripHtml(activity.description)}
                            </p>
                        )}
                        
                        {/* Meeting metadata */}
                        {activity.type === 'meeting_held' && activity.metadata && (
                            <div className="ap-flex ap-items-center ap-gap-3 ap-mt-2 ap-text-xs ap-text-gray-500">
                                {activity.metadata.hasAgenda && (
                                    <span className="ap-flex ap-items-center ap-gap-1">
                                        <ActionIcon className="ap-h-3.5 ap-w-3.5" />
                                        Has agenda
                                    </span>
                                )}
                                {activity.metadata.hasDecisions && (
                                    <span className="ap-flex ap-items-center ap-gap-1">
                                        <DecisionIcon className="ap-h-3.5 ap-w-3.5" />
                                        Decisions made
                                    </span>
                                )}
                                {activity.metadata.hasActionItems && (
                                    <span className="ap-flex ap-items-center ap-gap-1">
                                        <TaskIcon className="ap-h-3.5 ap-w-3.5" />
                                        Action items
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Task metadata */}
                        {activity.type === 'task_completed' && activity.metadata?.assignedToName && (
                            <div className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                Assigned to: {activity.metadata.assignedToName}
                            </div>
                        )}
                    </div>
                    
                    <div className="ap-text-right ap-flex-shrink-0">
                        <div className="ap-text-sm ap-text-gray-500">{formatTimelineDate(activity.timestamp)}</div>
                        <div className="ap-text-xs ap-text-gray-400">{formatTime(activity.timestamp)}</div>
                    </div>
                </div>

                {/* Actor */}
                <div className="ap-flex ap-items-center ap-gap-2 ap-mt-2">
                    <div className="ap-w-6 ap-h-6 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-purple-600 ap-flex ap-items-center ap-justify-center ap-text-white ap-text-xs ap-font-medium ap-overflow-hidden">
                        {activity.actor.avatarUrl ? (
                            <img src={activity.actor.avatarUrl} alt={activity.actor.firstName} className="ap-w-full ap-h-full ap-object-cover" />
                        ) : (
                            `${activity.actor.firstName[0]}${activity.actor.lastName?.[0] || ''}`
                        )}
                    </div>
                    <span className="ap-text-xs ap-text-gray-500">
                        {activity.actor.firstName} {activity.actor.lastName}
                    </span>
                </div>
            </div>
        </div>
    );
};

// Group activities by date
function groupActivitiesByDate(activities: ActivityItem[]): Map<string, ActivityItem[]> {
    const grouped = new Map<string, ActivityItem[]>();
    
    activities.forEach(activity => {
        const date = new Date(activity.timestamp);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(activity);
    });
    
    return grouped;
}

// Format date header
function formatDateHeader(dateKey: string): string {
    const date = new Date(dateKey + 'T12:00:00'); // Noon to avoid timezone issues
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

const MentorshipTimeline: React.FC<MentorshipTimelineProps> = ({
    goal,
    currentUser: _currentUser, // Reserved for future use (e.g., highlighting own activity)
    onMeetingClick,
    onUpdateClick,
    onTaskClick,
    onInitiativeClick: _onInitiativeClick, // Reserved for future use
    activeItemId = null,
    activeItemType = null,
    selectedInitiativeId = null,
}) => {
    const activities = useMemo(() => generateActivityItems(goal), [goal]);
    const groupedActivities = useMemo(() => groupActivitiesByDate(activities), [activities]);

    if (activities.length === 0) {
        return (
            <div className="ap-text-center ap-py-12">
                <div className="ap-w-16 ap-h-16 ap-bg-gray-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                    <CalendarIcon className="ap-h-8 ap-w-8 ap-text-gray-400" />
                </div>
                <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-2">No activity yet</h3>
                <p className="ap-text-gray-500 ap-max-w-sm ap-mx-auto">
                    Schedule a meeting, post an update, or complete a task to see activity here.
                </p>
            </div>
        );
    }

    return (
        <div className="ap-space-y-8">
            {Array.from(groupedActivities.entries()).map(([dateKey, dayActivities]) => (
                <div key={dateKey}>
                    {/* Date header */}
                    <div className="ap-sticky ap-top-0 ap-bg-white/95 ap-backdrop-blur-sm ap-z-10 ap-py-2 -ap-mx-4 ap-px-4 ap-border-b ap-border-gray-100 ap-mb-4">
                        <h3 className="ap-text-sm ap-font-semibold ap-text-gray-700">
                            {formatDateHeader(dateKey)}
                        </h3>
                    </div>
                    
                    {/* Activities for this date */}
                    <div className="ap-space-y-0">
                        {dayActivities.map(activity => {
                            // Active: matches focused item type + id
                            const isActive = activeItemType === activity.sourceType
                                && activeItemId === activity.sourceId;

                            // Dimmed: initiative filter is active and item doesn't belong to it
                            const isDimmed = selectedInitiativeId !== null
                                && activity.initiativeId !== selectedInitiativeId;

                            return (
                                <TimelineItem
                                    key={activity.id}
                                    activity={activity}
                                    goal={goal}
                                    onMeetingClick={onMeetingClick}
                                    onUpdateClick={onUpdateClick}
                                    onTaskClick={onTaskClick}
                                    isActive={isActive}
                                    isDimmed={isDimmed}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MentorshipTimeline;
