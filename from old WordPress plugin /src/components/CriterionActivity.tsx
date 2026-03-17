import React, { useState, useEffect } from 'react';
import { HiCheckCircle, HiDocumentText, HiUser, HiArrowUpTray, HiPencil, HiTrash } from 'react-icons/hi2';
import { Button } from './ui';
import { getCriterionActivities, addCriterionActivity, updateCriterionActivity, deleteCriterionActivity, CriterionActivity as Activity } from '../services/api-professional-growth';

interface CriterionActivityProps {
    criterionId: number;
    affectedUserId: number;
    criterionType: string;
    currentValue?: number;
    targetValue?: number;
    isCompleted: boolean;
    canEdit: boolean;
    onRefresh?: () => void;
    preloadedActivities?: Activity[]; // Pre-loaded activities to avoid fetch
}

/**
 * CriterionActivity - Shows activity log and allows adding notes/updates
 * Each action is logged with user, role, and timestamp
 */
const CriterionActivity: React.FC<CriterionActivityProps> = ({
    criterionId,
    affectedUserId,
    criterionType,
    currentValue = 0,
    targetValue,
    isCompleted,
    canEdit,
    onRefresh,
    preloadedActivities
}) => {
    const [showAddNote, setShowAddNote] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [saving, setSaving] = useState(false);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [markCompleteWithNote, setMarkCompleteWithNote] = useState(false);
    
    // Get current user info from window
    const wpData = (window as any).mentorshipPlatformData || {};
    const currentUser = wpData.current_user || {};
    const currentUserId = currentUser.id || 0;
    const isAdmin = wpData.is_admin || false;
    
    console.log('User detection:', { wpData, currentUser, currentUserId, isAdmin });

    // Load activities on mount and when criterion changes (unless preloaded)
    useEffect(() => {
        if (preloadedActivities) {
            // Use pre-loaded activities (batch loaded by parent)
            console.log(`Using pre-loaded activities for criterion ${criterionId}:`, preloadedActivities.length, 'activities');
            setActivities(preloadedActivities);
            setLoading(false);
        } else if (criterionId && criterionId > 0) {
            // Fall back to individual loading
            loadActivities();
        }
    }, [criterionId, affectedUserId, preloadedActivities]);

    const loadActivities = async () => {
        // Guard against invalid criterionId
        if (!criterionId || criterionId <= 0) {
            console.warn('Cannot load activities: invalid criterionId', criterionId);
            return;
        }
        
        console.log('Loading activities for criterion:', criterionId, 'user:', affectedUserId);
        setLoading(true);
        try {
            const data = await getCriterionActivities(criterionId, affectedUserId);
            console.log('Activities loaded:', data.length, 'activities', data);
            setActivities(data);
        } catch (err) {
            console.error('Failed to load activities:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async () => {
        console.log('handleAddNote called', { noteText, criterionId, affectedUserId });
        if (!noteText.trim()) {
            console.log('Note text is empty');
            return;
        }
        if (!criterionId || criterionId <= 0) {
            console.error('Invalid criterionId:', criterionId);
            alert('Cannot add note: invalid criterion');
            return;
        }
        
        setSaving(true);
        try {
            console.log('Adding note activity...');
            // Add the note
            const result = await addCriterionActivity({
                criterion_id: criterionId,
                affected_user_id: affectedUserId,
                activity_type: 'note',
                content: noteText
            });
            console.log('Note added successfully:', result);
            
            // If checkbox is checked, also mark as complete
            if (markCompleteWithNote && criterionType === 'checkbox' && !isCompleted) {
                console.log('Also marking as complete...');
                await addCriterionActivity({
                    criterion_id: criterionId,
                    affected_user_id: affectedUserId,
                    activity_type: 'checkbox_checked',
                    content: 'Marked as complete',
                    old_value: '0',
                    new_value: '1'
                });
            }
            
            setNoteText('');
            setShowAddNote(false);
            setMarkCompleteWithNote(false);
            console.log('Reloading activities...');
            await loadActivities();
            if (onRefresh) onRefresh();
            console.log('Note save complete');
        } catch (err) {
            console.error('Error adding note:', err);
            alert('Failed to add note: ' + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCheckbox = async () => {
        if (!criterionId || criterionId <= 0) {
            alert('Cannot update: invalid criterion');
            return;
        }
        
        setSaving(true);
        try {
            const activityType = isCompleted ? 'checkbox_unchecked' : 'checkbox_checked';
            await addCriterionActivity({
                criterion_id: criterionId,
                affected_user_id: affectedUserId,
                activity_type: activityType,
                content: isCompleted ? 'Unmarked as complete' : 'Marked as complete',
                old_value: isCompleted ? '1' : '0',
                new_value: isCompleted ? '0' : '1'
            });
            await loadActivities();
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Failed to update checkbox');
        } finally {
            setSaving(false);
        }
    };

    const handleCounterUpdate = async (newValue: number) => {
        if (newValue === currentValue) return;
        if (!criterionId || criterionId <= 0) {
            alert('Cannot update counter: invalid criterion');
            return;
        }
        
        setSaving(true);
        try {
            await addCriterionActivity({
                criterion_id: criterionId,
                affected_user_id: affectedUserId,
                activity_type: 'counter_update',
                content: `Updated count from ${currentValue} to ${newValue}`,
                old_value: String(currentValue),
                new_value: String(newValue)
            });
            await loadActivities();
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Failed to update counter');
        } finally {
            setSaving(false);
        }
    };

    const handleEditActivity = async (activityId: number) => {
        if (!editText.trim()) return;
        
        setSaving(true);
        try {
            await updateCriterionActivity(activityId, editText);
            setEditingActivityId(null);
            setEditText('');
            await loadActivities();
        } catch (err) {
            alert('Failed to update activity');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteActivity = async (activityId: number) => {
        if (!confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
            return;
        }
        
        setSaving(true);
        try {
            await deleteCriterionActivity(activityId);
            await loadActivities();
            if (onRefresh) onRefresh();
        } catch (err) {
            alert('Failed to delete activity');
        } finally {
            setSaving(false);
        }
    };

    const canEditActivity = (activity: Activity) => {
        // User can edit their own notes, or admin can edit any
        return activity.activity_type === 'note' && (activity.user_id === currentUserId || isAdmin);
    };

    const canDeleteActivity = (activity: Activity) => {
        // User can delete their own notes, or admin can delete any notes
        return activity.activity_type === 'note' && (activity.user_id === currentUserId || isAdmin);
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'checkbox': return <HiCheckCircle className="ap-w-4 ap-h-4 ap-text-green-600" />;
            case 'file_upload': return <HiArrowUpTray className="ap-w-4 ap-h-4 ap-text-blue-600" />;
            case 'note': return <HiDocumentText className="ap-w-4 ap-h-4 ap-text-gray-600" />;
            default: return <HiUser className="ap-w-4 ap-h-4 ap-text-gray-600" />;
        }
    };

    // Don't render if criterionId is invalid
    if (!criterionId || criterionId <= 0) {
        console.error('CriterionActivity not rendering: invalid criterionId', criterionId);
        return null;
    }

    // Determine what actions the user can perform
    const canEditCheckboxCounter = canEdit || isAdmin;
    const canAddNotes = true; // Everyone can add notes

    console.log('CriterionActivity rendering with:', {
        criterionId,
        criterionType,
        isCompleted,
        canEdit,
        isAdmin,
        canEditCheckboxCounter,
        canAddNotes,
        showAddNote,
        markCompleteWithNote
    });

    return (
        <div className="ap-border-t ap-pt-3 ap-mt-3 ap-space-y-3">
            {/* Action Buttons */}
            {(canEditCheckboxCounter || canAddNotes) && (
                <div className="ap-flex ap-gap-2 ap-flex-wrap">
                    {(criterionType === 'checkbox' || criterionType === 'notes') && canEditCheckboxCounter && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleCheckbox}
                            disabled={saving}
                            className={isCompleted 
                                ? '!ap-bg-gray-200 !ap-text-gray-700 hover:!ap-bg-gray-300' 
                                : '!ap-bg-green-100 !ap-text-green-700 hover:!ap-bg-green-200'
                            }
                        >
                            {isCompleted ? '☐ Unmark' : '☑ Mark Complete'}
                        </Button>
                    )}
                    
                    {criterionType === 'counter' && targetValue && canEditCheckboxCounter && (
                        <div className="ap-flex ap-items-center ap-gap-2 ap-bg-gray-50 ap-rounded ap-px-2 ap-py-1">
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleCounterUpdate(Math.max(0, currentValue - 1))}
                                disabled={saving || currentValue <= 0}
                                className="!ap-px-2 !ap-py-0.5 !ap-min-h-0 !ap-font-bold"
                            >−</Button>
                            <span className="ap-text-sm ap-font-medium">{currentValue} / {targetValue}</span>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleCounterUpdate(Math.min(targetValue, currentValue + 1))}
                                disabled={saving || currentValue >= targetValue}
                                className="!ap-px-2 !ap-py-0.5 !ap-min-h-0 !ap-font-bold"
                            >+</Button>
                        </div>
                    )}
                    
                    {canAddNotes && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddNote(!showAddNote)}
                            className="!ap-bg-blue-100 !ap-text-blue-700 hover:!ap-bg-blue-200"
                        >
                            + Add Note
                        </Button>
                    )}
                </div>
            )}

            {/* Add Note Form */}
            {showAddNote && (
                <div className="ap-bg-gray-50 ap-rounded ap-p-3 ap-space-y-3">
                    <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add your note or comment..."
                        className="ap-w-full ap-border ap-rounded ap-p-2 ap-text-sm"
                        rows={3}
                    />
                    
                    {/* Mark Complete with Note option for checkbox/note criteria */}
                    {canEditCheckboxCounter && (criterionType === 'checkbox' || criterionType === 'notes') && !isCompleted && (
                        <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-700">
                            <input 
                                type="checkbox" 
                                checked={markCompleteWithNote}
                                onChange={e => setMarkCompleteWithNote(e.target.checked)}
                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300"
                            />
                            <span>Mark criterion as complete with this note</span>
                        </label>
                    )}
                    
                    <div className="ap-flex ap-gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAddNote}
                            disabled={saving || !noteText.trim()}
                        >
                            {saving ? 'Saving...' : 'Save Note'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setShowAddNote(false);
                                setNoteText('');
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Activity Log */}
            {loading ? (
                <div className="ap-text-xs ap-text-gray-500 ap-text-center ap-py-2">Loading activity log...</div>
            ) : activities.length > 0 ? (
                <div className="ap-space-y-2">
                    <h5 className="ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase">Activity Log</h5>
                    {activities.map(activity => (
                        <div key={activity.id} className="ap-flex ap-gap-2 ap-text-xs ap-bg-gray-50 ap-rounded ap-p-2">
                            <div className="ap-flex-shrink-0 ap-mt-0.5">
                                {getActivityIcon(activity.activity_type)}
                            </div>
                            <div className="ap-flex-1 ap-min-w-0">
                                <div className="ap-flex ap-items-baseline ap-gap-2 ap-flex-wrap">
                                    <span className="ap-font-medium ap-text-gray-900">{activity.user_name}</span>
                                    <span className="ap-text-gray-500">({activity.user_role})</span>
                                    <span className="ap-text-gray-400">{new Date(activity.created_at).toLocaleString()}</span>
                                    {activity.edited_at && (
                                        <span className="ap-text-orange-600 ap-italic">
                                            (edited {new Date(activity.edited_at).toLocaleString()}{activity.edited_by_name && ` by ${activity.edited_by_name}`})
                                        </span>
                                    )}
                                </div>
                                
                                {editingActivityId === activity.id ? (
                                    <div className="ap-mt-2 ap-space-y-2">
                                        <textarea
                                            value={editText}
                                            onChange={e => setEditText(e.target.value)}
                                            className="ap-w-full ap-border ap-rounded ap-p-2 ap-text-sm"
                                            rows={2}
                                        />
                                        <div className="ap-flex ap-gap-2">
                                            <Button
                                                variant="primary"
                                                size="xs"
                                                onClick={() => handleEditActivity(activity.id)}
                                                disabled={saving || !editText.trim()}
                                            >
                                                {saving ? 'Saving...' : 'Save'}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="xs"
                                                onClick={() => {
                                                    setEditingActivityId(null);
                                                    setEditText('');
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="ap-text-gray-700 ap-mt-0.5">{activity.content}</p>
                                        {(canEditActivity(activity) || canDeleteActivity(activity)) && (
                                            <div className="ap-flex ap-gap-2 ap-mt-2">
                                                {canEditActivity(activity) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => {
                                                            setEditingActivityId(activity.id);
                                                            setEditText(activity.content || '');
                                                        }}
                                                        className="!ap-bg-blue-100 !ap-text-blue-700 hover:!ap-bg-blue-200 !ap-px-2 !ap-py-0.5 !ap-min-h-0"
                                                    >
                                                        <HiPencil className="ap-w-3 ap-h-3" />
                                                        Edit
                                                    </Button>
                                                )}
                                                {canDeleteActivity(activity) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => handleDeleteActivity(activity.id)}
                                                        className="!ap-bg-red-100 !ap-text-red-700 hover:!ap-bg-red-200 !ap-px-2 !ap-py-0.5 !ap-min-h-0"
                                                        disabled={saving}
                                                    >
                                                        <HiTrash className="ap-w-3 ap-h-3" />
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default CriterionActivity;
