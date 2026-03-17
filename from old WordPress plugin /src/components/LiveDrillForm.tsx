import React, { useState, useEffect, useCallback } from 'react';
import {
    HiOutlineCheckCircle as CheckIcon,
    HiOutlineArchiveBoxArrowDown as ArchiveIcon,
    HiOutlineArrowPath as UnarchiveIcon,
} from 'react-icons/hi2';
import RichTextEditor from './RichTextEditor';
import { Button } from './ui';
import { UserMetadata } from '../services/api-user-management';
import { getCachedUsers } from '../services/userCache';
import { createLiveDrill, updateLiveDrill, deleteLiveDrill, archiveLiveDrill, restoreLiveDrill, type AuditLog } from '@/services/api-professional-growth';
import { sortUsersByName, parseDisplayName } from '../utils/userSorting';

interface LiveDrillFormProps {
    currentUser: {
        id: number;
        name: string;
        isAdmin: boolean;
    };
    editingDrill?: AuditLog | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const LiveDrillForm: React.FC<LiveDrillFormProps> = ({
    currentUser,
    editingDrill,
    onSuccess,
    onCancel,
}) => {
    const [users, setUsers] = useState<UserMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [staffSearch, setStaffSearch] = useState('');
    
    // Parse drill data from notes JSON if editing
    const parsedDrillData = React.useMemo(() => {
        if (!editingDrill?.notes) return null;
        try {
            return JSON.parse(editingDrill.notes);
        } catch {
            return null;
        }
    }, [editingDrill?.notes]);
    
    // Form state
    const [drillDate, setDrillDate] = useState(() => {
        if (editingDrill?.drill_date) {
            return editingDrill.drill_date.split(' ')[0];
        }
        return new Date().toISOString().split('T')[0];
    });
    
    const [drillTime, setDrillTime] = useState(() => {
        if (editingDrill?.drill_date) {
            const timePart = editingDrill.drill_date.split(' ')[1];
            if (timePart) {
                return timePart.substring(0, 5); // HH:MM
            }
        }
        return '';
    });
    
    const [location, setLocation] = useState(editingDrill?.location || '');
    const [scenarioType, setScenarioType] = useState(parsedDrillData?.scenario_type || '');
    const [isDailyDrill, setIsDailyDrill] = useState<boolean>(parsedDrillData?.daily_drill ?? true);
    const [staffInvolved, setStaffInvolved] = useState<number[]>(() => {
        if (parsedDrillData?.staff_involved && Array.isArray(parsedDrillData.staff_involved)) {
            // Ensure we convert to numbers and handle both string and number IDs
            return parsedDrillData.staff_involved.map((s: any) => {
                const id = s.id || s;
                return typeof id === 'string' ? parseInt(id, 10) : Number(id);
            });
        }
        return [];
    });
    const [recognizedIn30Seconds, setRecognizedIn30Seconds] = useState<boolean>(
        parsedDrillData?.recognized_in_30_seconds ?? true
    );
    const [activatedEAP, setActivatedEAP] = useState<boolean>(parsedDrillData?.activated_eap ?? true);
    const [result, setResult] = useState<'Pass' | 'Fail'>(() => {
        // Check if editing an existing drill
        if (editingDrill?.result === 'Fail') return 'Fail';
        if (editingDrill?.result === 'Passed with Remediation') return 'Fail'; // Initial result was fail
        return 'Pass';
    });
    const [passedWithRemediation, setPassedWithRemediation] = useState<boolean | null>(() => {
        // If editing a "Passed with Remediation" drill, set to true
        if (editingDrill?.result === 'Passed with Remediation') return true;
        // If editing a failed drill that wasn't remediated, set to false
        if (editingDrill?.result === 'Fail') return false;
        return null;
    });
    const [remediationDetails, setRemediationDetails] = useState(parsedDrillData?.remediation_details || '');
    const [comments, setComments] = useState(parsedDrillData?.comments || '');

    // Memoized handlers to prevent unnecessary re-renders
    const handleDrillDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDrillDate(e.target.value);
    }, []);
    
    const handleDrillTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDrillTime(e.target.value);
    }, []);
    
    const handleLocationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocation(e.target.value);
    }, []);
    
    const handleScenarioTypeChange = useCallback((value: string) => {
        setScenarioType(value);
    }, []);
    
    const handleCommentsChange = useCallback((value: string) => {
        setComments(value);
    }, []);

    const handleRemediationDetailsChange = useCallback((value: string) => {
        setRemediationDetails(value);
    }, []);

    // Reset passedWithRemediation and remediationDetails when result changes to Pass
    const handleResultChange = useCallback((newResult: 'Pass' | 'Fail') => {
        setResult(newResult);
        if (newResult === 'Pass') {
            setPassedWithRemediation(null);
            setRemediationDetails('');
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            // Use centralized cache - already sorted
            const usersData = await getCachedUsers();
            setUsers(usersData);
        };
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setLoading(true);

        try {
            const drillDateTime = drillTime 
                ? `${drillDate} ${drillTime}:00`
                : `${drillDate} 00:00:00`;

            // Determine final result
            let finalResult: 'Pass' | 'Fail' | 'Passed with Remediation' = result;
            if (result === 'Fail' && passedWithRemediation === true) {
                finalResult = 'Passed with Remediation';
            }

            // Build notes structure with all drill data
            const drillData = {
                scenario_type: scenarioType,
                daily_drill: isDailyDrill,
                staff_involved: staffInvolved.map(id => {
                    const user = users.find(u => Number(u.user_id) === id);
                    return { id: Number(id), name: user?.display_name || '' };
                }),
                recognized_in_30_seconds: recognizedIn30Seconds,
                activated_eap: activatedEAP,
                comments,
                remediation_details: result === 'Fail' ? remediationDetails : undefined,
                passed_with_remediation: result === 'Fail' ? passedWithRemediation : undefined,
            };

            const payload = {
                drilled_user_id: currentUser.id, // Record who conducted the drill
                drill_date: drillDateTime,
                location: location || undefined,
                result: finalResult,
                notes: JSON.stringify(drillData),
            };

            if (editingDrill) {
                await updateLiveDrill(editingDrill.id, payload);
            } else {
                await createLiveDrill(payload);
            }

            onSuccess();
        } catch (error: any) {
            console.error('Error saving live drill:', error);
            alert(error?.message || 'Failed to save live drill');
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async () => {
        if (!editingDrill) return;
        
        if (!confirm('Are you sure you want to archive this drill?')) {
            return;
        }

        try {
            setLoading(true);
            await archiveLiveDrill(editingDrill.id);
            onSuccess();
        } catch (error: any) {
            console.error('Error archiving drill:', error);
            alert(error?.message || 'Failed to archive drill');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!editingDrill) return;

        try {
            setLoading(true);
            await restoreLiveDrill(editingDrill.id);
            onSuccess();
        } catch (error: any) {
            console.error('Error restoring drill:', error);
            alert(error?.message || 'Failed to restore drill');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingDrill) return;
        
        if (!confirm('Are you sure you want to delete this drill? This action cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            await deleteLiveDrill(editingDrill.id);
            onSuccess();
        } catch (error: any) {
            console.error('Error deleting drill:', error);
            alert(error?.message || 'Failed to delete drill');
        } finally {
            setLoading(false);
        }
    };

    const handleStaffSelection = (userId: number) => {
        if (staffInvolved.includes(userId)) {
            setStaffInvolved(staffInvolved.filter(id => id !== userId));
        } else {
            setStaffInvolved([...staffInvolved, userId]);
        }
    };

    const getFilteredStaff = () => {
        const search = staffSearch.toLowerCase();
        const filtered = search
            ? users.filter(user => user.display_name.toLowerCase().includes(search))
            : users;
        
        // Always include selected staff at the top
        const selectedIds = new Set(staffInvolved);
        const selectedUsers = users.filter(u => selectedIds.has(Number(u.user_id)));
        const unselectedFiltered = filtered.filter(u => !selectedIds.has(Number(u.user_id)));
        
        return [...sortUsersByName(selectedUsers), ...sortUsersByName(unselectedFiltered)];
    };

    return (
        <div className="ap-max-w-7xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg ap-p-6">
                <div className="ap-mb-6">
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                        {editingDrill ? 'Edit Live Recognition Drill' : 'New Live Recognition Drill'}
                    </h2>
                    <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                        {editingDrill 
                            ? 'Update the live recognition drill details' : 'Record a new live recognition drill scenario'
                        }
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="ap-space-y-6">
                    {/* Date and Time */}
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={drillDate}
                                onChange={handleDrillDateChange}
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Time
                            </label>
                            <input
                                type="time"
                                value={drillTime}
                                onChange={handleDrillTimeChange}
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Location
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={handleLocationChange}
                            placeholder="e.g., Main Pool, Deep End"
                            className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    </div>

                    {/* Scenario Type */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Scenario Type *
                            <span className="ap-block ap-text-xs ap-font-normal ap-text-gray-500 ap-mt-0.5">
                                Describe the type of emergency that the responders reacted to
                            </span>
                        </label>
                        <RichTextEditor
                            value={scenarioType}
                            onChange={handleScenarioTypeChange}
                            placeholder="Describe the emergency scenario (e.g., passive drowning victim, active distress, medical emergency...)"
                        />
                    </div>

                    {/* Daily Drill */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Daily Drill *
                        </label>
                        <div className="ap-flex ap-gap-3">
                            <Button
                                type="button"
                                onClick={() => setIsDailyDrill(true)}
                                variant={isDailyDrill === true ? 'success' : 'outline'}
                                className={`ap-flex-1 ${
                                    isDailyDrill !== true
                                        ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                                }`}
                            >
                                Yes
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setIsDailyDrill(false)}
                                variant={isDailyDrill === false ? 'danger' : 'outline'}
                                className={`ap-flex-1 ${
                                    isDailyDrill !== false
                                        ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                                }`}
                            >
                                No
                            </Button>
                        </div>
                    </div>

                    {/* Staff Involved */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Staff Involved in Scenario *
                        </label>
                        <div className="ap-border ap-border-gray-300 ap-rounded-md ap-p-3">
                            <input
                                type="text"
                                placeholder="Search staff..."
                                value={staffSearch}
                                onChange={(e) => setStaffSearch(e.target.value)}
                                className="ap-w-full ap-mb-2 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-text-sm"
                            />
                            <div className="ap-max-h-48 ap-overflow-y-auto ap-space-y-1">
                                {getFilteredStaff().map(user => {
                                    const userId = Number(user.user_id);
                                    return (
                                        <label key={user.user_id} className="ap-flex ap-items-center ap-px-2 ap-py-1.5 hover:ap-bg-gray-50 ap-rounded ap-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={staffInvolved.includes(userId)}
                                                onChange={() => handleStaffSelection(userId)}
                                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                            />
                                            <span className="ap-ml-2 ap-text-sm">{user.display_name}</span>
                                        </label>
                                    );
                                })}
                                {getFilteredStaff().length === 0 && (
                                    <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-2">No staff found</p>
                                )}
                            </div>
                        </div>
                        {staffInvolved.length > 0 && (
                            <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
                                {staffInvolved.length} staff member{staffInvolved.length > 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>

                    {/* Selected Staff Summary */}
                    {staffInvolved.length > 0 && (
                        <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                            <h3 className="ap-text-sm ap-font-semibold ap-text-blue-900 ap-mb-3">Selected Staff Summary</h3>
                            <div>
                                <div className="ap-text-xs ap-font-medium ap-text-blue-700 ap-mb-2 ap-flex ap-items-center">
                                    <span className="ap-w-2 ap-h-2 ap-bg-purple-500 ap-rounded-full ap-mr-2"></span>
                                    Staff Involved in Scenario ({staffInvolved.length})
                                </div>
                                <div className="ap-space-y-1">
                                    {staffInvolved
                                        .map(userId => users.find(u => Number(u.user_id) === userId))
                                        .filter(user => user !== undefined)
                                        .sort((a, b) => {
                                            const parsedA = parseDisplayName(a.display_name);
                                            const parsedB = parseDisplayName(b.display_name);
                                            const lastNameCompare = parsedA.lastName.localeCompare(parsedB.lastName, undefined, { sensitivity: 'base' });
                                            if (lastNameCompare !== 0) return lastNameCompare;
                                            return parsedA.firstName.localeCompare(parsedB.firstName, undefined, { sensitivity: 'base' });
                                        })
                                        .map(user => {
                                            const userId = Number(user.user_id);
                                            return (
                                                <div key={user.user_id} className="ap-flex ap-items-center ap-justify-between ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                                                    <span className="ap-text-gray-700">{user.display_name}</span>
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleStaffSelection(userId)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="!ap-text-red-500 hover:!ap-text-red-700 ap-ml-2 !ap-p-0 !ap-min-h-0"
                                                        title="Remove"
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recognition in 30 Seconds */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Did staff recognize and reach the subject in less than 30 seconds? *
                        </label>
                        <div className="ap-flex ap-gap-3">
                            <Button
                                type="button"
                                onClick={() => setRecognizedIn30Seconds(true)}
                                variant={recognizedIn30Seconds === true ? 'success' : 'outline'}
                                className={`ap-flex-1 ${
                                    recognizedIn30Seconds !== true
                                        ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                                }`}
                            >
                                Yes
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setRecognizedIn30Seconds(false)}
                                variant={recognizedIn30Seconds === false ? 'danger' : 'outline'}
                                className={`ap-flex-1 ${
                                    recognizedIn30Seconds !== false
                                        ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                                }`}
                            >
                                No
                            </Button>
                        </div>
                    </div>

                    {/* Activated EAP */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Did staff activate emergency action plan? *
                        </label>
                        <div className="ap-flex ap-gap-3">
                            <Button
                                type="button"
                                onClick={() => setActivatedEAP(true)}
                                variant={activatedEAP === true ? 'success' : 'outline'}
                                className={`ap-flex-1 ${
                                    activatedEAP !== true
                                        ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                                }`}
                            >
                                Yes
                            </Button>
                            <Button
                                type="button"
                                onClick={() => setActivatedEAP(false)}
                                variant={activatedEAP === false ? 'danger' : 'outline'}
                                className={`ap-flex-1 ${
                                    activatedEAP !== false
                                        ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                                }`}
                            >
                                No
                            </Button>
                        </div>
                    </div>

                    {/* Pass/Fail */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Result *
                        </label>
                        <div className="ap-flex ap-gap-3">
                            <Button
                                type="button"
                                onClick={() => handleResultChange('Pass')}
                                variant={result === 'Pass' ? 'success' : 'outline'}
                                className={`ap-flex-1 ${
                                    result !== 'Pass' ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                                }`}
                            >
                                Pass
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handleResultChange('Fail')}
                                variant={result === 'Fail' ? 'danger' : 'outline'}
                                className={`ap-flex-1 ${
                                    result !== 'Fail' ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                                }`}
                            >
                                Fail
                            </Button>
                        </div>
                    </div>

                    {/* Pass with Remediation - only shown when result is Fail */}
                    {result === 'Fail' && (
                        <div className="ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg ap-p-4 ap-space-y-4">
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-amber-900 ap-mb-2">
                                    Pass with remediation? *
                                    <span className="ap-block ap-text-xs ap-font-normal ap-text-amber-700 ap-mt-0.5">
                                        Did the staff successfully complete the drill after coaching or a second attempt?
                                    </span>
                                </label>
                                <div className="ap-flex ap-gap-3">
                                    <Button
                                        type="button"
                                        onClick={() => setPassedWithRemediation(true)}
                                        variant={passedWithRemediation === true ? 'warning' : 'outline'}
                                        className={`ap-flex-1 ${
                                            passedWithRemediation !== true ? 'hover:!ap-bg-amber-50 hover:!ap-border-amber-300' : ''
                                        }`}
                                    >
                                        Yes
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setPassedWithRemediation(false)}
                                        variant={passedWithRemediation === false ? 'warning' : 'outline'}
                                        className={`ap-flex-1 ${
                                            passedWithRemediation !== false ? 'hover:!ap-bg-amber-50 hover:!ap-border-amber-300' : ''
                                        }`}
                                    >
                                        No
                                    </Button>
                                </div>
                            </div>

                            {/* Remediation Details - required when result is Fail */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-amber-900 ap-mb-2">
                                    Remediation Details *
                                    <span className="ap-block ap-text-xs ap-font-normal ap-text-amber-700 ap-mt-0.5">
                                        Describe what coaching or corrections were needed
                                    </span>
                                </label>
                                <RichTextEditor
                                    value={remediationDetails}
                                    onChange={handleRemediationDetailsChange}
                                    placeholder="Describe the remediation steps taken, what was corrected, and the outcome..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Comments
                        </label>
                        <RichTextEditor
                            value={comments}
                            onChange={handleCommentsChange}
                            placeholder="Add any additional observations, notes, or recommendations..."
                        />
                    </div>

                    {/* Form Actions */}
                    <div className="ap-flex ap-flex-wrap ap-items-center ap-justify-between ap-gap-2 ap-pt-4 ap-border-t">
                        {/* Archive/Delete buttons on the left (only for editing) */}
                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                            {editingDrill && (
                                <>
                                    {editingDrill.archived ? (
                                        <Button
                                            type="button"
                                            onClick={handleRestore}
                                            disabled={loading}
                                            variant="success-outline"
                                            size="sm"
                                            leftIcon={<UnarchiveIcon className="ap-w-4 ap-h-4" />}
                                        >
                                            Restore
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            onClick={handleArchive}
                                            disabled={loading}
                                            variant="warning-outline"
                                            size="sm"
                                            leftIcon={<ArchiveIcon className="ap-w-4 ap-h-4" />}
                                        >
                                            Archive
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={loading}
                                        variant="danger-outline"
                                        size="sm"
                                    >
                                        Delete
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Cancel/Save buttons on the right */}
                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                            <Button
                                type="button"
                                onClick={onCancel}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    loading || 
                                    staffInvolved.length === 0 || 
                                    (result === 'Fail' && passedWithRemediation === null) ||
                                    (result === 'Fail' && !remediationDetails.trim())
                                }
                                variant="primary"
                                size="sm"
                                leftIcon={<CheckIcon className="ap-h-5 ap-w-5" />}
                            >
                                {loading ? 'Saving...' : (editingDrill ? 'Update' : 'Save')} Drill
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LiveDrillForm;
