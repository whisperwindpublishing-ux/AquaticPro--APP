import React, { useState, useEffect } from 'react';
import { TimeSlotDefinition, UserProfile } from '@/types';
import { createDailyLog, updateDailyLog, getJobRoles, getTimeSlots, getAllDailyLogTags, getAllUsersAdmin } from '@/services/api';
import BlockEditor from './BlockEditor';
import LoadingSpinner from './LoadingSpinner';
import { Button, Input, Select, Label } from './ui';
import { HiOutlineCheck as CheckIcon, HiOutlineXMark as XIcon } from 'react-icons/hi2';

// Helper to get local date string in YYYY-MM-DD format (not UTC)
const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

interface DailyLogFormProps {
    currentUser: UserProfile;
    editingLog?: {
        id: number;
        title: string;
        blocks?: any; // API returns 'blocks' not 'blocksJson'
        blocksJson?: any; // Keep for backwards compatibility
        locationId: number;
        logDate: string;
        timeSlotIds: number[];
        jobRoleId?: number;
        tags: string[] | string; // API might return string or array
        status: 'publish' | 'draft';
    } | null;
    onSuccess: () => void;
    onCancel: () => void;
}

/**
 * DailyLogForm component - Form for creating/editing daily logs
 * 
 * Features:
 * - Location dropdown
 * - Date picker
 * - Multi-select time slots (user can work multiple shifts)
 * - Job role selector
 * - Block editor (Gutenberg-style)
 * - Tags input
 * - Publish/Draft toggle
 */
export const DailyLogForm: React.FC<DailyLogFormProps> = ({
    editingLog,
    onSuccess,
    onCancel
}) => {
    const [title, setTitle] = useState(editingLog?.title || '');
    const [blocksJson, setBlocksJson] = useState(editingLog?.blocksJson || null);
    const [locationId, setLocationId] = useState(editingLog?.locationId || 0);
    const [logDate, setLogDate] = useState(
        editingLog?.logDate || getLocalDateString()
    );
    const [selectedTimeSlotIds, setSelectedTimeSlotIds] = useState<number[]>(
        editingLog?.timeSlotIds || []
    );
    const [jobRoleId, setJobRoleId] = useState(editingLog?.jobRoleId || 0);
    const [tags, setTags] = useState(
        Array.isArray(editingLog?.tags) ? editingLog.tags.join(', ') : (editingLog?.tags || '')
    );
    const [status, setStatus] = useState<'publish' | 'draft'>(editingLog?.status || 'publish');
    const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlotDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

    // Admin author override
    const wpData = window.mentorshipPlatformData;
    const isPluginAdmin = wpData?.is_plugin_admin === true || wpData?.is_plugin_admin === 'true';
    const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedAuthorId, setSelectedAuthorId] = useState<number>(
        editingLog ? (editingLog as any).authorId || 0 : 0
    );

    // Update form state when editingLog changes
    useEffect(() => {
        if (editingLog) {
            setTitle(editingLog.title || '');
            // API returns 'blocks' not 'blocksJson'
            setBlocksJson(editingLog.blocks || editingLog.blocksJson || null);
            setLocationId(editingLog.locationId || 0);
            setLogDate(editingLog.logDate || getLocalDateString());
            setSelectedTimeSlotIds(editingLog.timeSlotIds || []);
            setJobRoleId(editingLog.jobRoleId || 0);
            setTags(Array.isArray(editingLog.tags) ? editingLog.tags.join(', ') : (editingLog.tags || ''));
            setStatus(editingLog.status || 'publish');
            setSelectedAuthorId((editingLog as any).authorId || 0);
        } else {
            // Reset form for new log
            setTitle('');
            setBlocksJson(null);
            setLocationId(0);
            setLogDate(getLocalDateString());
            setSelectedTimeSlotIds([]);
            setJobRoleId(0);
            setTags('');
            setStatus('publish');
            setSelectedAuthorId(0);
        }
    }, [editingLog]);

    // Fetch locations, time slots and auto-determine job role on mount
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch locations, time slots, and tag suggestions
                const { getLocations } = await import('@/services/api');
                const [locs, slots, tags] = await Promise.all([
                    getLocations(),
                    getTimeSlots(true),
                    getAllDailyLogTags()
                ]);
                setLocations(locs.map((loc: any) => ({ id: loc.id, name: loc.name })));
                // Ensure slot IDs are numbers
                setTimeSlots(slots.map((slot: any) => ({ ...slot, id: Number(slot.id) })));
                setSuggestedTags(tags);
                
                // Plugin admins can select a different author
                if (isPluginAdmin) {
                    try {
                        const users = await getAllUsersAdmin();
                        setAllUsers(users);
                    } catch (err) {
                        console.error('Failed to fetch users for admin author picker:', err);
                    }
                }
                
                // Auto-detect user's job role if not editing
                if (!editingLog?.jobRoleId) {
                    const roles = await getJobRoles();
                    // Find first role with create permission (user's active role)
                    const activeRole = roles.find(r => r.dailyLogPermissions?.canCreate);
                    if (activeRole) {
                        setJobRoleId(activeRole.id);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch data or determine job role:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [editingLog?.jobRoleId]);

    // Autosave effect - save draft every 5 minutes
    useEffect(() => {
        // Only autosave if we have required fields and we're editing an existing log
        if (!title.trim() || !locationId || selectedTimeSlotIds.length === 0) {
            return;
        }

        // Clear existing timer
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }

        // Set new timer for 5 minutes (300000 ms)
        const timer = setTimeout(async () => {
            try {
                console.log('Autosaving draft...');
                const logData = {
                    title: title.trim(),
                    blocksJson,
                    locationId,
                    logDate,
                    timeSlotIds: selectedTimeSlotIds,
                    jobRoleId: jobRoleId || undefined,
                    tags: tags
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(Boolean),
                    status: 'draft' as const // Always save as draft for autosave
                };

                if (editingLog?.id) {
                    await updateDailyLog(editingLog.id, logData);
                    setLastSaved(new Date());
                    console.log('Autosave successful');
                }
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        }, 300000); // 5 minutes

        setAutoSaveTimer(timer);

        // Cleanup on unmount
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [title, blocksJson, locationId, logDate, selectedTimeSlotIds, jobRoleId, tags, editingLog?.id]);

    const handleTimeSlotToggle = (slotId: number) => {
        setSelectedTimeSlotIds(prev => {
            if (prev.includes(slotId)) {
                return prev.filter(id => id !== slotId);
            } else {
                return [...prev, slotId];
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent, submitStatus?: 'publish' | 'draft') => {
        e.preventDefault();

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Use the passed status or fall back to state
        const finalStatus = submitStatus || status;

        // Validation
        if (!title.trim()) {
            alert('Please enter a title');
            return;
        }
        if (!locationId) {
            alert('Please select a location');
            return;
        }
        if (selectedTimeSlotIds.length === 0) {
            alert('Please select at least one time slot');
            return;
        }

        setIsSaving(true);

        try {
            const logData = {
                title: title.trim(),
                blocksJson,
                locationId,
                logDate,
                timeSlotIds: selectedTimeSlotIds,
                jobRoleId: jobRoleId || undefined,
                tags: tags
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(Boolean),
                status: finalStatus,
                ...(isPluginAdmin && selectedAuthorId ? { authorId: selectedAuthorId } : {})
            };

            if (editingLog?.id) {
                await updateDailyLog(editingLog.id, logData);
            } else {
                await createDailyLog(logData as any);
            }

            onSuccess();
        } catch (error) {
            console.error('Failed to save daily log:', error);
            alert('Failed to save daily log. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="ap-space-y-6 ap-max-w-4xl ap-mx-auto">
            {/* Header */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <div>
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                        {editingLog?.id ? 'Edit Daily Log' : 'New Daily Log'}
                    </h2>
                    {lastSaved && (
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                            Last saved: {lastSaved.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="ap-flex ap-items-center ap-gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={isSaving}
                        leftIcon={<XIcon className="ap-h-5 ap-w-5" />}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={(e) => handleSubmit(e as any, 'draft')}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={(e) => handleSubmit(e as any, 'publish')}
                        disabled={isSaving}
                        leftIcon={<CheckIcon className="ap-h-5 ap-w-5" />}
                    >
                        {isSaving ? 'Publishing...' : editingLog?.id ? 'Update & Publish' : 'Publish'}
                    </Button>
                </div>
            </div>

            {/* Admin: Author Selector */}
            {isPluginAdmin && allUsers.length > 0 && (
                <div className="ap-bg-amber-50 ap-border ap-border-amber-300 ap-rounded-lg ap-p-4">
                    <Label htmlFor="authorSelect">
                        Author <span className="ap-text-amber-600 ap-text-xs ap-font-normal">(Admin Override)</span>
                    </Label>
                    <Select
                        id="authorSelect"
                        value={selectedAuthorId}
                        onChange={(e) => setSelectedAuthorId(Number(e.target.value))}
                    >
                        <option value={0}>— Current User (default) —</option>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </Select>
                </div>
            )}

            {/* Title */}
            <div>
                <Label htmlFor="title" required>
                    Title
                </Label>
                <Input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Morning Pool Operations"
                    required
                />
            </div>

            {/* Location and Date */}
            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                <div>
                    <Label htmlFor="location" required>
                        Location
                    </Label>
                    <Select
                        id="location"
                        value={locationId}
                        onChange={(e) => setLocationId(Number(e.target.value))}
                        required
                    >
                        <option value={0}>Select a location</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>
                                {loc.name}
                            </option>
                        ))}
                    </Select>
                </div>

                <div>
                    <Label htmlFor="logDate" required>
                        Date
                    </Label>
                    <Input
                        type="date"
                        id="logDate"
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        required
                    />
                </div>
            </div>

            {/* Time Slots (Multi-select) */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Time Slots * <span className="ap-text-gray-500 ap-text-xs">(Select all that apply)</span>
                </label>
                <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-3">
                    {timeSlots.map(slot => {
                        const isSelected = selectedTimeSlotIds.includes(slot.id);
                        const slotColor = slot.color || '#2563eb';
                        return (
                        <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleTimeSlotToggle(slot.id)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: isSelected ? `2px solid ${slotColor}` : '2px solid #000000',
                                backgroundColor: isSelected ? `${slotColor}15` : '#ffffff',
                                color: isSelected ? slotColor : '#374151',
                                fontWeight: isSelected ? 600 : 500,
                                fontSize: '0.875rem',
                                minHeight: '44px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
                            }}
                        >
                            {isSelected && (
                                <CheckIcon className="ap-h-5 ap-w-5 ap-inline ap-mr-1" />
                            )}
                            {slot.label}
                        </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Editor */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Content *
                </label>
                <BlockEditor
                    initialContent={blocksJson}
                    onChange={setBlocksJson}
                    editable={true}
                />
            </div>

            {/* Tags */}
            <div>
                <Label htmlFor="tags">
                    Tags <span className="ap-text-gray-500 ap-text-xs ap-font-normal">(comma-separated)</span>
                </Label>
                <Input
                    type="text"
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g., safety, maintenance, training"
                />
                {suggestedTags.length > 0 && (
                    <div className="ap-mt-2">
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-1">Previously used tags:</p>
                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                            {suggestedTags.slice(0, 12).map((tag) => {
                                const currentTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                                const isAlreadyAdded = currentTags.includes(tag.toLowerCase());
                                
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                            if (!isAlreadyAdded) {
                                                const newTags = tags ? `${tags}, ${tag}` : tag;
                                                setTags(newTags);
                                            }
                                        }}
                                        disabled={isAlreadyAdded}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '9999px',
                                            border: '1px solid #000000',
                                            backgroundColor: isAlreadyAdded ? '#e5e7eb' : '#eff6ff',
                                            color: isAlreadyAdded ? '#9ca3af' : '#2563eb',
                                            cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s ease',
                                            opacity: isAlreadyAdded ? 0.6 : 1,
                                            boxShadow: isAlreadyAdded ? 'none' : '1px 1px 0 0 rgba(0,0,0,0.5)',
                                        }}
                                        title={isAlreadyAdded ? 'Already added' : 'Click to add'}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action Buttons - Duplicate of top buttons for convenience */}
            <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-pt-4 ap-border-t ap-border-gray-200">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSaving}
                    leftIcon={<XIcon className="ap-h-5 ap-w-5" />}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => handleSubmit(e as any, 'draft')}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    onClick={(e) => handleSubmit(e as any, 'publish')}
                    disabled={isSaving}
                    leftIcon={<CheckIcon className="ap-h-5 ap-w-5" />}
                >
                    {isSaving ? 'Publishing...' : editingLog?.id ? 'Update & Publish' : 'Publish'}
                </Button>
            </div>
        </form>
    );
};

export default DailyLogForm;
