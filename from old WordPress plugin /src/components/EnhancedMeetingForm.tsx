import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Meeting, Initiative, Task, TalkingPoint, Decision, FollowUp, RecurringPattern, Attachment } from '@/types';
import { uploadFile } from '@/services/api';
import { ACCEPTED_FILE_TYPES } from '@/utils/fileUpload';
import { 
    HiOutlineCalendarDays as CalendarDaysIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlinePlusCircle as PlusCircleIcon,
    HiOutlineTrash as TrashIcon,
    HiOutlineClipboardDocumentList as AgendaIcon,
    HiOutlineChatBubbleBottomCenterText as NotesIcon,
    HiOutlineLightBulb as DecisionIcon,
    HiOutlineCheckCircle as ActionIcon,
    HiOutlineArrowPath as RecurringIcon,
    HiOutlineChevronDown as ChevronDownIcon,
    HiOutlineChevronUp as ChevronUpIcon,
    HiOutlineLink as LinkIcon,
    HiOutlineClock as DurationIcon,
    HiOutlineRocketLaunch as RocketLaunchIcon,
    HiOutlinePaperClip as PaperClipIcon,
    HiOutlineDocument as DocumentIcon,
} from 'react-icons/hi2';
import BlockEditor from '@/components/BlockEditor';
import { Button } from '@/components/ui/Button';

// Action Item type for new items created in this meeting
interface ActionItem {
    id: number;
    text: string;
    assignedTo?: number;
    assignedToName?: string;
    dueDate?: string;
}

interface EnhancedMeetingFormProps {
    meeting: Meeting;
    initiatives: Initiative[];
    tasks: Task[];
    onSave: (meeting: Meeting, newActionItems?: ActionItem[]) => void;
    onCancel: () => void;
    onCreateTask?: (task: Omit<Task, 'id'>) => void;
    isReadOnly?: boolean;
    participants?: { id: number; name: string }[];
    /** Called on every field change for auto-save (debouncing handled by parent) */
    onChange?: (meeting: Meeting) => void;
}

// Collapsible section component
const CollapsibleSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    count?: number;
    defaultOpen?: boolean;
    children: React.ReactNode;
    accentColor?: string;
}> = ({ title, icon, count, defaultOpen = false, children, accentColor = 'blue' }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden`}>
            <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(!isOpen)}
                className="!ap-w-full !ap-flex !ap-items-center !ap-justify-between !ap-p-3 !ap-bg-gray-50 hover:!ap-bg-gray-100 !ap-rounded-none"
            >
                <div className="ap-flex ap-items-center ap-gap-2">
                    <span className={`ap-text-${accentColor}-500`}>{icon}</span>
                    <span className="ap-font-medium ap-text-gray-700">{title}</span>
                    {count !== undefined && count > 0 && (
                        <span className={`ap-text-xs ap-bg-${accentColor}-100 ap-text-${accentColor}-700 ap-px-2 ap-py-0.5 ap-rounded-full`}>
                            {count}
                        </span>
                    )}
                </div>
                {isOpen ? (
                    <ChevronUpIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                ) : (
                    <ChevronDownIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                )}
            </Button>
            {isOpen && (
                <div className="ap-p-4 ap-border-t ap-border-gray-200">
                    {children}
                </div>
            )}
        </div>
    );
};

// Talking Point Item
const TalkingPointItem: React.FC<{
    point: TalkingPoint;
    index: number;
    onUpdate: (point: TalkingPoint) => void;
    onDelete: () => void;
    isReadOnly?: boolean;
}> = ({ point, onUpdate, onDelete, isReadOnly }) => {
    return (
        <div className="ap-flex ap-items-start ap-gap-3 group ap-py-2 ap-border-b ap-border-gray-100 last:ap-border-b-0">
            <input
                type="checkbox"
                checked={point.isDiscussed}
                onChange={(e) => onUpdate({ ...point, isDiscussed: e.target.checked })}
                className="ap-mt-1 ap-h-4 ap-w-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                disabled={isReadOnly}
            />
            <div className="ap-flex-1 ap-min-w-0">
                <input
                    type="text"
                    value={point.text}
                    onChange={(e) => onUpdate({ ...point, text: e.target.value })}
                    className={`ap-w-full ap-bg-transparent ap-border-none ap-p-0 ap-text-gray-800 focus:ap-ring-0 ${point.isDiscussed ? 'ap-line-through ap-text-gray-400' : ''}`}
                    placeholder="Enter talking point..."
                    disabled={isReadOnly}
                />
            </div>
            {!isReadOnly && (
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onDelete}
                    className="!ap-p-1.5 !ap-min-h-0 ap-opacity-0 group-hover:ap-opacity-100 ap-text-gray-400 hover:!ap-text-red-500 ap-transition-opacity"
                >
                    <TrashIcon className="ap-h-4 ap-w-4" />
                </Button>
            )}
        </div>
    );
};

// Decision Item
const DecisionItem: React.FC<{
    decision: Decision;
    onUpdate: (decision: Decision) => void;
    onDelete: () => void;
    isReadOnly?: boolean;
}> = ({ decision, onUpdate, onDelete, isReadOnly }) => {
    return (
        <div className="ap-flex ap-items-start ap-gap-3 group ap-py-2 ap-border-b ap-border-gray-100 last:ap-border-b-0">
            <div className="ap-mt-1 ap-flex-shrink-0">
                <DecisionIcon className="ap-h-5 ap-w-5 ap-text-amber-500" />
            </div>
            <div className="ap-flex-1 ap-min-w-0">
                <input
                    type="text"
                    value={decision.text}
                    onChange={(e) => onUpdate({ ...decision, text: e.target.value })}
                    className="ap-w-full ap-bg-transparent ap-border-none ap-p-0 ap-text-gray-800 ap-font-medium focus:ap-ring-0"
                    placeholder="What was decided?"
                    disabled={isReadOnly}
                />
            </div>
            {!isReadOnly && (
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onDelete}
                    className="!ap-p-1.5 !ap-min-h-0 ap-opacity-0 group-hover:ap-opacity-100 ap-text-gray-400 hover:!ap-text-red-500 ap-transition-opacity"
                >
                    <TrashIcon className="ap-h-4 ap-w-4" />
                </Button>
            )}
        </div>
    );
};

// Follow-up Item
const FollowUpItem: React.FC<{
    followUp: FollowUp;
    onUpdate: (followUp: FollowUp) => void;
    onDelete: () => void;
    isReadOnly?: boolean;
}> = ({ followUp, onUpdate, onDelete, isReadOnly }) => {
    return (
        <div className="ap-flex ap-items-start ap-gap-3 group ap-py-2 ap-border-b ap-border-gray-100 last:ap-border-b-0">
            <input
                type="checkbox"
                checked={followUp.isAddressed}
                onChange={(e) => onUpdate({ ...followUp, isAddressed: e.target.checked })}
                className="ap-mt-1 ap-h-4 ap-w-4 ap-rounded ap-border-gray-300 ap-text-green-600 focus:ap-ring-green-500"
                disabled={isReadOnly}
            />
            <div className="ap-flex-1 ap-min-w-0">
                <input
                    type="text"
                    value={followUp.text}
                    onChange={(e) => onUpdate({ ...followUp, text: e.target.value })}
                    className={`ap-w-full ap-bg-transparent ap-border-none ap-p-0 ap-text-gray-800 focus:ap-ring-0 ${followUp.isAddressed ? 'ap-line-through ap-text-gray-400' : ''}`}
                    placeholder="Follow-up item..."
                    disabled={isReadOnly}
                />
            </div>
            {!isReadOnly && (
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onDelete}
                    className="!ap-p-1.5 !ap-min-h-0 ap-opacity-0 group-hover:ap-opacity-100 ap-text-gray-400 hover:!ap-text-red-500 ap-transition-opacity"
                >
                    <TrashIcon className="ap-h-4 ap-w-4" />
                </Button>
            )}
        </div>
    );
};

// Recurring pattern selector
const RecurringPatternSelect: React.FC<{
    value: RecurringPattern;
    onChange: (value: RecurringPattern) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const patterns: { value: RecurringPattern; label: string }[] = [
        { value: 'none', label: 'Does not repeat' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'biweekly', label: 'Every 2 weeks' },
        { value: 'monthly', label: 'Monthly' },
    ];

    return (
        <div className="ap-flex ap-items-center ap-gap-2">
            <RecurringIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as RecurringPattern)}
                className="ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                disabled={disabled}
            >
                {patterns.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                ))}
            </select>
        </div>
    );
};

const EnhancedMeetingForm: React.FC<EnhancedMeetingFormProps> = ({
    meeting,
    initiatives,
    tasks,
    onSave,
    onCancel,
    onCreateTask: _onCreateTask, // Reserved for future use
    isReadOnly = false,
    participants = [],
    onChange,
}) => {
    // Basic meeting info
    const [topic, setTopic] = useState(meeting.topic);
    const [date, setDate] = useState(meeting.date.split('T')[0]);
    const [time, setTime] = useState(() => {
        const dateObj = new Date(meeting.date);
        return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    });
    const [duration, setDuration] = useState(meeting.duration || 30);
    const [link, setLink] = useState(meeting.meetingLink || '');
    const [initiativeId, setInitiativeId] = useState(meeting.initiativeId);
    const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>(meeting.recurringPattern || 'none');
    
    // Structured content
    const [agenda, setAgenda] = useState<TalkingPoint[]>(meeting.agenda || []);
    const [notesJson, setNotesJson] = useState<any>(meeting.notesJson || null);
    const [decisions, setDecisions] = useState<Decision[]>(meeting.decisions || []);
    const [followUp, setFollowUp] = useState<FollowUp[]>(meeting.followUp || []);
    // Existing tasks linked to this meeting (read-only, created from previous sessions)
    const linkedTaskIds = meeting.actionItems || [];
    
    // New action items to be created
    const [newActionItems, setNewActionItems] = useState<ActionItem[]>([]);

    // Attachments
    const [attachments, setAttachments] = useState<Attachment[]>(meeting.attachments || []);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const meetingFileInputRef = useRef<HTMLInputElement>(null);

    // Track whether this is the initial mount (skip first onChange call)
    const isInitialMount = useRef(true);
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // Build current meeting state for auto-save notifications
    const buildCurrentMeeting = useCallback((): Meeting => {
        const dateTime = new Date(`${date}T${time}`);
        return {
            ...meeting,
            topic,
            date: dateTime.toISOString(),
            duration,
            meetingLink: link,
            initiativeId,
            recurringPattern,
            agenda: agenda.filter(a => a.text.trim()),
            notesJson,
            decisions: decisions.filter(d => d.text.trim()),
            actionItems: linkedTaskIds,
            followUp: followUp.filter(f => f.text.trim()),
            attachments,
        };
    }, [topic, date, time, duration, link, initiativeId, recurringPattern, agenda, notesJson, decisions, linkedTaskIds, followUp, attachments, meeting]);

    // Notify parent of changes for auto-save (skip initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!isReadOnly && onChangeRef.current) {
            onChangeRef.current(buildCurrentMeeting());
        }
    }, [topic, date, time, duration, link, initiativeId, recurringPattern, agenda, notesJson, decisions, followUp, attachments, isReadOnly, buildCurrentMeeting]);

    // Ctrl+S keyboard shortcut for explicit save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!isReadOnly && topic.trim()) {
                    handleSave();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isReadOnly, topic]);

    // Add new talking point
    const handleAddTalkingPoint = useCallback(() => {
        const newPoint: TalkingPoint = {
            id: Date.now(),
            text: '',
            isDiscussed: false,
            addedBy: meeting.author.id,
            createdAt: new Date().toISOString(),
        };
        setAgenda(prev => [...prev, newPoint]);
    }, [meeting.author.id]);

    // Update talking point
    const handleUpdateTalkingPoint = useCallback((index: number, point: TalkingPoint) => {
        setAgenda(prev => prev.map((p, i) => i === index ? point : p));
    }, []);

    // Delete talking point
    const handleDeleteTalkingPoint = useCallback((index: number) => {
        setAgenda(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Add new decision
    const handleAddDecision = useCallback(() => {
        const newDecision: Decision = {
            id: Date.now(),
            text: '',
            madeAt: new Date().toISOString(),
        };
        setDecisions(prev => [...prev, newDecision]);
    }, []);

    // Update decision
    const handleUpdateDecision = useCallback((index: number, decision: Decision) => {
        setDecisions(prev => prev.map((d, i) => i === index ? decision : d));
    }, []);

    // Delete decision
    const handleDeleteDecision = useCallback((index: number) => {
        setDecisions(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Add new follow-up
    const handleAddFollowUp = useCallback(() => {
        const newFollowUp: FollowUp = {
            id: Date.now(),
            text: '',
            isAddressed: false,
        };
        setFollowUp(prev => [...prev, newFollowUp]);
    }, []);

    // Update follow-up
    const handleUpdateFollowUp = useCallback((index: number, item: FollowUp) => {
        setFollowUp(prev => prev.map((f, i) => i === index ? item : f));
    }, []);

    // Delete follow-up
    const handleDeleteFollowUp = useCallback((index: number) => {
        setFollowUp(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Action item handlers
    const handleAddActionItem = useCallback(() => {
        const newItem: ActionItem = {
            id: Date.now(),
            text: '',
            assignedTo: undefined,
            assignedToName: undefined,
            dueDate: undefined,
        };
        setNewActionItems(prev => [...prev, newItem]);
    }, []);

    const handleUpdateActionItem = useCallback((index: number, item: ActionItem) => {
        setNewActionItems(prev => prev.map((a, i) => i === index ? item : a));
    }, []);

    const handleDeleteActionItem = useCallback((index: number) => {
        setNewActionItems(prev => prev.filter((_, i) => i !== index));
    }, []);

    // File upload handler
    const handleMeetingFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingFile(true);
        try {
            const uploaded = await uploadFile(files[0]);
            setAttachments(prev => [...prev, uploaded]);
        } catch (error) {
            console.error('Meeting file upload failed', error);
            alert('File upload failed. Please try again.');
        } finally {
            setIsUploadingFile(false);
            if (meetingFileInputRef.current) {
                meetingFileInputRef.current.value = '';
            }
        }
    }, []);

    // Handle save
    const handleSave = useCallback(() => {
        if (!topic.trim()) return;

        const dateTime = new Date(`${date}T${time}`);
        
        const updatedMeeting: Meeting = {
            ...meeting,
            topic,
            date: dateTime.toISOString(),
            duration,
            meetingLink: link,
            initiativeId,
            recurringPattern,
            agenda: agenda.filter(a => a.text.trim()),
            notesJson, // BlockNote JSON content
            decisions: decisions.filter(d => d.text.trim()),
            actionItems: linkedTaskIds,
            followUp: followUp.filter(f => f.text.trim()),
            attachments,
        };

        // Pass new action items to be created as tasks
        const validActionItems = newActionItems.filter(a => a.text.trim());
        onSave(updatedMeeting, validActionItems.length > 0 ? validActionItems : undefined);
    }, [topic, date, time, duration, link, initiativeId, recurringPattern, agenda, notesJson, decisions, linkedTaskIds, followUp, meeting, onSave, newActionItems]);

    return (
        <div className="ap-space-y-6 ap-bg-white ap-rounded-lg">
            {/* Header Section */}
            <div className="ap-space-y-4">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="ap-w-full ap-text-xl ap-font-semibold ap-bg-transparent ap-border-none ap-p-0 focus:ap-ring-0 ap-placeholder-gray-400"
                    placeholder="Meeting Title"
                    disabled={isReadOnly}
                />

                {/* Date, Time, Duration, Repeat - responsive row */}
                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-3">
                    {/* Date & Time */}
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <CalendarDaysIcon className="ap-h-5 ap-w-5 ap-text-gray-400 ap-flex-shrink-0" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            disabled={isReadOnly}
                        />
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            disabled={isReadOnly}
                        />
                    </div>

                    {/* Duration */}
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <DurationIcon className="ap-h-5 ap-w-5 ap-text-gray-400 ap-flex-shrink-0" />
                        <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            disabled={isReadOnly}
                        >
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>

                    {/* Recurring Pattern */}
                    <RecurringPatternSelect
                        value={recurringPattern}
                        onChange={setRecurringPattern}
                        disabled={isReadOnly}
                    />
                </div>

                {/* Initiative - own row for better visibility */}
                <div className="ap-flex ap-items-center ap-gap-2">
                    <RocketLaunchIcon className="ap-h-5 ap-w-5 ap-text-gray-400 ap-flex-shrink-0" />
                    <select
                        value={initiativeId || ''}
                        onChange={(e) => setInitiativeId(e.target.value ? Number(e.target.value) : null)}
                        className="ap-flex-1 ap-max-w-md ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        disabled={isReadOnly}
                    >
                        <option value="">No initiative</option>
                        {initiatives.map(i => (
                            <option key={i.id} value={i.id}>{i.title}</option>
                        ))}
                    </select>
                </div>

                {/* Meeting Link */}
                <div className="ap-flex ap-items-center ap-gap-2">
                    <LinkIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                    <input
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        className="ap-flex-1 ap-bg-gray-50 ap-border-gray-200 ap-rounded-lg ap-text-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        placeholder="Meeting link (Google Meet, Zoom, etc.)"
                        disabled={isReadOnly}
                    />
                </div>
            </div>

            {/* Structured Sections */}
            <div className="ap-space-y-4">
                {/* Agenda / Talking Points */}
                <CollapsibleSection
                    title="Agenda / Talking Points"
                    icon={<AgendaIcon className="ap-h-5 ap-w-5" />}
                    count={agenda.length}
                    defaultOpen={agenda.length > 0}
                    accentColor="blue"
                >
                    <div className="ap-space-y-1">
                        {agenda.map((point, index) => (
                            <TalkingPointItem
                                key={point.id}
                                point={point}
                                index={index}
                                onUpdate={(p) => handleUpdateTalkingPoint(index, p)}
                                onDelete={() => handleDeleteTalkingPoint(index)}
                                isReadOnly={isReadOnly}
                            />
                        ))}
                        {!isReadOnly && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={handleAddTalkingPoint}
                                leftIcon={<PlusCircleIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-blue-600 hover:!ap-text-blue-700 ap-mt-2"
                            >
                                Add talking point
                            </Button>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Discussion Notes */}
                <CollapsibleSection
                    title="Discussion Notes"
                    icon={<NotesIcon className="ap-h-5 ap-w-5" />}
                    defaultOpen={!!notesJson}
                    accentColor="purple"
                >
                    <div className="-ap-mx-2">
                        <BlockEditor
                            initialContent={notesJson}
                            onChange={setNotesJson}
                            editable={!isReadOnly}
                        />
                    </div>
                </CollapsibleSection>

                {/* Decisions Made */}
                <CollapsibleSection
                    title="Decisions Made"
                    icon={<DecisionIcon className="ap-h-5 ap-w-5" />}
                    count={decisions.length}
                    defaultOpen={decisions.length > 0}
                    accentColor="amber"
                >
                    <div className="ap-space-y-1">
                        {decisions.map((decision, index) => (
                            <DecisionItem
                                key={decision.id}
                                decision={decision}
                                onUpdate={(d) => handleUpdateDecision(index, d)}
                                onDelete={() => handleDeleteDecision(index)}
                                isReadOnly={isReadOnly}
                            />
                        ))}
                        {!isReadOnly && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={handleAddDecision}
                                leftIcon={<PlusCircleIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-amber-600 hover:!ap-text-amber-700 ap-mt-2"
                            >
                                Add decision
                            </Button>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Follow-up Items */}
                <CollapsibleSection
                    title="Follow-up Items"
                    icon={<ActionIcon className="ap-h-5 ap-w-5" />}
                    count={followUp.length}
                    defaultOpen={followUp.length > 0}
                    accentColor="green"
                >
                    <div className="ap-space-y-1">
                        {followUp.map((item, index) => (
                            <FollowUpItem
                                key={item.id}
                                followUp={item}
                                onUpdate={(f) => handleUpdateFollowUp(index, f)}
                                onDelete={() => handleDeleteFollowUp(index)}
                                isReadOnly={isReadOnly}
                            />
                        ))}
                        {!isReadOnly && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={handleAddFollowUp}
                                leftIcon={<PlusCircleIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-green-600 hover:!ap-text-green-700 ap-mt-2"
                            >
                                Add follow-up
                            </Button>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Action Items - Create new tasks from this meeting */}
                <CollapsibleSection
                    title="Action Items"
                    icon={<ActionIcon className="ap-h-5 ap-w-5" />}
                    count={newActionItems.length + linkedTaskIds.length}
                    defaultOpen={newActionItems.length > 0 || linkedTaskIds.length > 0}
                    accentColor="teal"
                >
                    <div className="ap-space-y-3">
                        <p className="ap-text-xs ap-text-gray-500">
                            Create tasks assigned to participants. These will appear in the Tasks tab.
                        </p>
                        
                        {/* Existing linked tasks (read-only display) */}
                        {linkedTaskIds.length > 0 && (
                            <div className="ap-space-y-1 ap-pb-2 ap-border-b ap-border-gray-100">
                                <p className="ap-text-xs ap-font-medium ap-text-gray-500">Linked from this meeting:</p>
                                {linkedTaskIds.map(taskId => {
                                    const task = tasks.find(t => t.id === taskId);
                                    if (!task) return null;
                                    return (
                                        <div key={taskId} className={`ap-text-sm ap-flex ap-items-center ap-gap-2 ${task.isCompleted ? 'ap-text-gray-400 ap-line-through' : 'ap-text-gray-700'}`}>
                                            <span>{task.isCompleted ? '✓' : '○'}</span>
                                            <span>{task.text}</span>
                                            {task.assignedToName && (
                                                <span className="ap-text-xs ap-text-gray-400">→ {task.assignedToName}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* New action items */}
                        {newActionItems.map((item, index) => (
                            <div key={item.id} className="ap-flex ap-items-start ap-gap-2 group ap-p-2 ap-bg-gray-50 ap-rounded-lg">
                                <div className="ap-flex-1 ap-space-y-2">
                                    <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => handleUpdateActionItem(index, { ...item, text: e.target.value })}
                                        className="ap-w-full ap-bg-white ap-border ap-border-gray-200 ap-rounded ap-px-2 ap-py-1 ap-text-sm focus:ap-ring-teal-500 focus:ap-border-teal-500"
                                        placeholder="What needs to be done?"
                                        disabled={isReadOnly}
                                    />
                                    <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                                        {participants.length > 0 && (
                                            <select
                                                value={item.assignedTo || ''}
                                                onChange={(e) => {
                                                    const selectedId = e.target.value ? Number(e.target.value) : undefined;
                                                    const selectedName = participants.find(p => p.id === selectedId)?.name;
                                                    handleUpdateActionItem(index, { 
                                                        ...item, 
                                                        assignedTo: selectedId,
                                                        assignedToName: selectedName 
                                                    });
                                                }}
                                                className="ap-text-xs ap-bg-white ap-border ap-border-gray-200 ap-rounded ap-px-2 ap-py-1 focus:ap-ring-teal-500"
                                                disabled={isReadOnly}
                                            >
                                                <option value="">Assign to...</option>
                                                {participants.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        )}
                                        <input
                                            type="date"
                                            value={item.dueDate || ''}
                                            onChange={(e) => handleUpdateActionItem(index, { ...item, dueDate: e.target.value })}
                                            className="ap-text-xs ap-bg-white ap-border ap-border-gray-200 ap-rounded ap-px-2 ap-py-1 focus:ap-ring-teal-500"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                {!isReadOnly && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleDeleteActionItem(index)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-opacity-0 group-hover:ap-opacity-100 ap-text-gray-400 hover:!ap-text-red-500 ap-transition-opacity"
                                    >
                                        <TrashIcon className="ap-h-4 ap-w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}

                        {!isReadOnly && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={handleAddActionItem}
                                leftIcon={<PlusCircleIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-teal-600 hover:!ap-text-teal-700"
                            >
                                Add action item
                            </Button>
                        )}
                    </div>
                </CollapsibleSection>

                {/* Attachments */}
                <CollapsibleSection
                    title="Attachments"
                    icon={<PaperClipIcon className="ap-h-5 ap-w-5" />}
                    count={attachments.length}
                    defaultOpen={attachments.length > 0}
                    accentColor="gray"
                >
                    <div className="ap-space-y-3">
                        {attachments.length > 0 && (
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                {attachments.map(att => (
                                    <div key={att.id} className="ap-bg-gray-100 ap-rounded-full ap-px-3 ap-py-1 ap-text-sm ap-flex ap-items-center ap-gap-2">
                                        <DocumentIcon className="ap-h-4 ap-w-4 ap-text-gray-500" />
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="hover:ap-underline ap-truncate ap-max-w-[180px]">
                                            {att.fileName}
                                        </a>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                                className="ap-text-gray-400 hover:ap-text-red-500 ap-transition-colors"
                                            >
                                                <XMarkIcon className="ap-h-3.5 ap-w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isReadOnly && (
                            <>
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => meetingFileInputRef.current?.click()}
                                    disabled={isUploadingFile}
                                    leftIcon={<PaperClipIcon className="ap-h-4 ap-w-4" />}
                                    className="!ap-text-gray-600 hover:!ap-text-gray-800"
                                >
                                    {isUploadingFile ? 'Uploading...' : 'Add file'}
                                </Button>
                                <input
                                    ref={meetingFileInputRef}
                                    type="file"
                                    onChange={handleMeetingFileUpload}
                                    accept={ACCEPTED_FILE_TYPES}
                                    className="ap-hidden"
                                />
                            </>
                        )}
                        {attachments.length === 0 && isReadOnly && (
                            <p className="ap-text-sm ap-text-gray-400 ap-italic">No attachments</p>
                        )}
                    </div>
                </CollapsibleSection>
            </div>

            {/* Action Buttons */}
            {!isReadOnly && (
                <div className="ap-flex ap-justify-end ap-gap-3 ap-pt-4 ap-border-t ap-border-gray-200">
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        leftIcon={<XMarkIcon className="ap-h-4 ap-w-4" />}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={onChange ? 'ghost' : 'primary'}
                        onClick={handleSave}
                        disabled={!topic.trim()}
                        leftIcon={<CheckIcon className="ap-h-4 ap-w-4" />}
                        title={onChange ? 'Changes are auto-saved. Click to save immediately.' : 'Save Meeting'}
                        className={onChange ? '!ap-text-gray-500 hover:!ap-text-gray-700' : ''}
                    >
                        {onChange ? 'Save Now' : 'Save Meeting'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default EnhancedMeetingForm;
