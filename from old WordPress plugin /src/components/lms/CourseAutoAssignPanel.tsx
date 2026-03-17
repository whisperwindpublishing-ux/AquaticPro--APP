import React, { useState, useEffect, useCallback } from 'react';
import { HiOutlineUserGroup, HiOutlineXMark, HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineCheck, HiOutlineArrowPath } from 'react-icons/hi2';
import { Button } from '../ui';
import {
    CourseAutoAssignRuleForCourse,
    getCourseAutoAssignRules,
    bulkUpdateCourseRules,
    resyncCourseAssignments,
} from '../../services/autoAssignService';
import { pluginGet } from '../../services/api-service';

interface JobRole {
    id: number;
    title: string;
}

interface CourseAutoAssignPanelProps {
    courseId: number;
}

const CourseAutoAssignPanel: React.FC<CourseAutoAssignPanelProps> = ({ courseId }) => {
    const [expanded, setExpanded] = useState(false);
    const [rules, setRules] = useState<CourseAutoAssignRuleForCourse[]>([]);
    const [allRoles, setAllRoles] = useState<JobRole[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set());
    const [initialRoleIds, setInitialRoleIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendNotification, setSendNotification] = useState(true);
    const [retroactive, setRetroactive] = useState(true);
    const [lastResult, setLastResult] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [roleSearch, setRoleSearch] = useState('');
    const [syncing, setSyncing] = useState(false);

    const hasChanges = (() => {
        if (selectedRoleIds.size !== initialRoleIds.size) return true;
        for (const id of selectedRoleIds) {
            if (!initialRoleIds.has(id)) return true;
        }
        return false;
    })();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rulesData, rolesResp] = await Promise.all([
                getCourseAutoAssignRules(courseId),
                pluginGet('pg/job-roles'),
            ]);
            setRules(rulesData);
            setAllRoles((rolesResp as JobRole[]) || []);

            const currentIds = new Set(rulesData.map((r: CourseAutoAssignRuleForCourse) => r.jobRoleId));
            setSelectedRoleIds(currentIds);
            setInitialRoleIds(currentIds);
        } catch (err) {
            console.error('Failed to load auto-assign data:', err);
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        if (expanded && rules.length === 0 && allRoles.length === 0) {
            loadData();
        }
    }, [expanded, loadData, rules.length, allRoles.length]);

    const handleToggleRole = (roleId: number) => {
        setSelectedRoleIds(prev => {
            const next = new Set(prev);
            if (next.has(roleId)) {
                next.delete(roleId);
            } else {
                next.add(roleId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setLastResult(null);
        try {
            const result = await bulkUpdateCourseRules(
                courseId,
                Array.from(selectedRoleIds),
                sendNotification,
                retroactive
            );
            
            const msgs: string[] = [];
            if (result.added > 0) msgs.push(`${result.added} role(s) added`);
            if (result.removed > 0) msgs.push(`${result.removed} role(s) removed`);
            if (result.retroactive.assigned > 0) msgs.push(`${result.retroactive.assigned} user(s) auto-assigned`);
            if (result.retroactive.skipped > 0) msgs.push(`${result.retroactive.skipped} user(s) already assigned`);
            
            setLastResult(msgs.length > 0 ? msgs.join(', ') : 'No changes needed');
            
            // Reload to sync
            await loadData();
        } catch (err) {
            console.error('Failed to save auto-assign rules:', err);
            setLastResult('Error saving rules');
        } finally {
            setSaving(false);
        }
    };

    const filteredRoles = allRoles.filter(r =>
        r.title.toLowerCase().includes(roleSearch.toLowerCase())
    );

    return (
        <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
            <Button
                variant="icon"
                onClick={() => setExpanded(!expanded)}
                className="!ap-w-full !ap-px-6 !ap-py-4 !ap-flex !ap-items-center !ap-justify-between !ap-rounded-none"
            >
                <div className="ap-flex ap-items-center ap-gap-3">
                    <HiOutlineUserGroup className="ap-w-5 ap-h-5 ap-text-indigo-600" />
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Role Auto-Assignment</h2>
                    {!expanded && rules.length > 0 && (
                        <span className="ap-text-sm ap-text-gray-500">
                            — {rules.length} role{rules.length !== 1 ? 's' : ''} configured
                        </span>
                    )}
                </div>
                {expanded ? (
                    <HiOutlineChevronUp className="ap-w-5 ap-h-5 ap-text-gray-400" />
                ) : (
                    <HiOutlineChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                )}
            </Button>

            {expanded && (
                <div className="ap-px-6 ap-pb-6 ap-border-t ap-border-gray-100">
                    <div className="ap-pt-4 ap-space-y-4">
                        <p className="ap-text-sm ap-text-gray-500">
                            Select which job roles should auto-receive this course. When a user is assigned one of these roles, 
                            the course will be automatically assigned to them.
                        </p>

                        {loading ? (
                            <div className="ap-py-4 ap-text-center">
                                <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-indigo-600 ap-mx-auto"></div>
                                <p className="ap-mt-2 ap-text-sm ap-text-gray-500">Loading roles...</p>
                            </div>
                        ) : (
                            <>
                                {/* Role Picker Dropdown */}
                                <div className="ap-relative">
                                    <button
                                        type="button"
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg ap-bg-white ap-text-left ap-flex ap-items-center ap-justify-between hover:ap-border-gray-300 ap-transition-colors"
                                    >
                                        <span className="ap-text-sm ap-text-gray-700">
                                            {selectedRoleIds.size === 0
                                                ? 'Select roles...'
                                                : `${selectedRoleIds.size} role${selectedRoleIds.size !== 1 ? 's' : ''} selected`}
                                        </span>
                                        <HiOutlineChevronDown className={`ap-w-4 ap-h-4 ap-text-gray-400 ap-transition-transform ${dropdownOpen ? 'ap-rotate-180' : ''}`} />
                                    </button>

                                    {dropdownOpen && (
                                        <div className="ap-absolute ap-z-20 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-60 ap-overflow-hidden">
                                            {/* Search */}
                                            <div className="ap-p-2 ap-border-b ap-border-gray-100">
                                                <input
                                                    type="text"
                                                    value={roleSearch}
                                                    onChange={(e) => setRoleSearch(e.target.value)}
                                                    placeholder="Search roles..."
                                                    className="ap-w-full ap-px-2 ap-py-1.5 ap-text-sm ap-border ap-border-gray-200 ap-rounded"
                                                    autoFocus
                                                />
                                            </div>
                                            {/* Role list */}
                                            <div className="ap-overflow-y-auto ap-max-h-48">
                                                {filteredRoles.length === 0 ? (
                                                    <p className="ap-text-sm ap-text-gray-400 ap-p-3 ap-text-center">No roles found</p>
                                                ) : (
                                                    filteredRoles.map(role => (
                                                        <label
                                                            key={role.id}
                                                            className="ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRoleIds.has(role.id)}
                                                                onChange={() => handleToggleRole(role.id)}
                                                                className="ap-rounded ap-border-gray-300 ap-text-indigo-600 focus:ap-ring-indigo-500"
                                                            />
                                                            <span className="ap-text-sm ap-text-gray-700">{role.title}</span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Click outside to close dropdown */}
                                {dropdownOpen && (
                                    <div
                                        className="ap-fixed ap-inset-0 ap-z-10"
                                        onClick={() => setDropdownOpen(false)}
                                    />
                                )}

                                {/* Selected Role Chips */}
                                {selectedRoleIds.size > 0 && (
                                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                                        {Array.from(selectedRoleIds).map(roleId => {
                                            const role = allRoles.find(r => r.id === roleId);
                                            const existingRule = rules.find(r => r.jobRoleId === roleId);
                                            return (
                                                <span
                                                    key={roleId}
                                                    className={`ap-inline-flex ap-items-center ap-gap-1.5 ap-px-3 ap-py-1 ap-rounded-full ap-text-sm ${
                                                        existingRule
                                                            ? 'ap-bg-indigo-100 ap-text-indigo-700'
                                                            : 'ap-bg-green-100 ap-text-green-700'
                                                    }`}
                                                >
                                                    {existingRule && <HiOutlineCheck className="ap-w-3.5 ap-h-3.5" />}
                                                    {role?.title || `Role #${roleId}`}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleRole(roleId)}
                                                        className="hover:ap-text-red-500 ap-transition-colors"
                                                    >
                                                        <HiOutlineXMark className="ap-w-3.5 ap-h-3.5" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Options */}
                                <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 ap-gap-4">
                                    <div className="ap-flex ap-items-center ap-justify-between ap-p-3 ap-bg-gray-50 ap-rounded-lg">
                                        <div>
                                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700">Send Notification</h4>
                                            <p className="ap-text-xs ap-text-gray-500">Email users when assigned</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={sendNotification}
                                            onClick={() => setSendNotification(!sendNotification)}
                                            className={`ap-relative ap-inline-flex ap-h-5 ap-w-9 ap-flex-shrink-0 ap-cursor-pointer ap-rounded-full ap-border-2 ap-border-transparent ap-transition-colors ap-duration-200 ap-ease-in-out focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-indigo-500 focus:ap-ring-offset-2 ${
                                                sendNotification ? 'ap-bg-indigo-600' : 'ap-bg-gray-200'
                                            }`}
                                        >
                                            <span
                                                className={`ap-pointer-events-none ap-inline-block ap-h-4 ap-w-4 ap-transform ap-rounded-full ap-bg-white ap-shadow ap-ring-0 ap-transition ap-duration-200 ap-ease-in-out ${
                                                    sendNotification ? 'ap-translate-x-4' : 'ap-translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                    <div className="ap-flex ap-items-center ap-justify-between ap-p-3 ap-bg-gray-50 ap-rounded-lg">
                                        <div>
                                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700">Retroactive</h4>
                                            <p className="ap-text-xs ap-text-gray-500">Assign to existing members</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={retroactive}
                                            onClick={() => setRetroactive(!retroactive)}
                                            className={`ap-relative ap-inline-flex ap-h-5 ap-w-9 ap-flex-shrink-0 ap-cursor-pointer ap-rounded-full ap-border-2 ap-border-transparent ap-transition-colors ap-duration-200 ap-ease-in-out focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-indigo-500 focus:ap-ring-offset-2 ${
                                                retroactive ? 'ap-bg-indigo-600' : 'ap-bg-gray-200'
                                            }`}
                                        >
                                            <span
                                                className={`ap-pointer-events-none ap-inline-block ap-h-4 ap-w-4 ap-transform ap-rounded-full ap-bg-white ap-shadow ap-ring-0 ap-transition ap-duration-200 ap-ease-in-out ${
                                                    retroactive ? 'ap-translate-x-4' : 'ap-translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Result message */}
                                {lastResult && (
                                    <div className={`ap-text-sm ap-px-3 ap-py-2 ap-rounded-lg ${
                                        lastResult.includes('Error') ? 'ap-bg-red-50 ap-text-red-700' : 'ap-bg-green-50 ap-text-green-700'
                                    }`}>
                                        {lastResult}
                                    </div>
                                )}

                                {/* Save Button */}
                                {hasChanges && (
                                    <div className="ap-flex ap-justify-end">
                                        <Button
                                            variant="primary"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="!ap-bg-indigo-600 hover:!ap-bg-indigo-700"
                                        >
                                            {saving ? 'Saving...' : 'Save Auto-Assign Rules'}
                                        </Button>
                                    </div>
                                )}

                                {/* Re-sync existing role members */}
                                {rules.length > 0 && !hasChanges && (
                                    <div className="ap-flex ap-items-center ap-justify-between ap-pt-2 ap-border-t ap-border-gray-100">
                                        <div className="ap-text-xs ap-text-gray-400">
                                            {rules.length} active rule{rules.length !== 1 ? 's' : ''} configured
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                setSyncing(true);
                                                setLastResult(null);
                                                try {
                                                    const result = await resyncCourseAssignments(courseId);
                                                    const msgs: string[] = [];
                                                    if (result.assigned > 0) msgs.push(`${result.assigned} user(s) newly assigned`);
                                                    if (result.skipped > 0) msgs.push(`${result.skipped} already assigned`);
                                                    setLastResult(msgs.join(', ') || 'No changes');
                                                } catch {
                                                    setLastResult('Error syncing members');
                                                } finally {
                                                    setSyncing(false);
                                                }
                                            }}
                                            disabled={syncing}
                                            className="!ap-text-indigo-600 hover:!ap-text-indigo-700 !ap-flex !ap-items-center !ap-gap-1"
                                        >
                                            <HiOutlineArrowPath className={`ap-w-3.5 ap-h-3.5 ${syncing ? 'ap-animate-spin' : ''}`} />
                                            {syncing ? 'Syncing...' : 'Sync Existing Members'}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseAutoAssignPanel;
