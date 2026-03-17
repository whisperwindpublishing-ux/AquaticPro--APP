import React, { useState, useEffect } from 'react';
import {
    getTeamList,
    getBatchProgress,
    getTeamMemberDetailedProgress,
    getJobRoles,
    getCriterionActivitiesBatch,
    TeamMember,
    TeamMemberDetailedProgress,
    JobRole,
    CriterionActivity as Activity,
} from '../services/api-professional-growth';
import { HiChevronUp as ChevronUpIcon, HiChevronDown as ChevronDownIcon, HiChevronRight as ChevronRightIcon } from 'react-icons/hi';
import { HiCheckCircle as CheckCircleIcon, HiXCircle as XCircleIcon } from 'react-icons/hi2';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';
import CriterionActivity from './CriterionActivity';
import { Button } from './ui/Button';

// --- SupervisorCriterionEditor --- Displays criterion with activity log
interface SupervisorCriterionEditorProps {
    criterion: any;
    member: TeamMember;
    refreshProgress: () => Promise<void> | void;
    preloadedActivities?: Activity[]; // Pre-loaded activities to avoid individual fetches
}

const SupervisorCriterionEditor: React.FC<SupervisorCriterionEditorProps> = ({ criterion, member, refreshProgress, preloadedActivities }) => {
    // Anyone with access to Team Progress page can edit team member progress
    // The page itself should be restricted to supervisors via WordPress permissions
    const canApprove = true;
    const isCounter = criterion.criterion_type === 'counter';
    const isLinked = criterion.criterion_type === 'linked_module' || criterion.criterion_type === 'linked';
    const showCount = (isCounter || isLinked) && criterion.target_value;
    const targetReached = showCount && criterion.current_value >= criterion.target_value;

    return (
        <div className="ap-border ap-rounded-lg ap-p-3 ap-bg-gray-50">
            <div className="ap-flex ap-items-start ap-gap-2">
                {criterion.is_completed ? <CheckCircleIcon className="ap-w-5 ap-h-5 ap-text-green-600" /> : <XCircleIcon className="ap-w-5 ap-h-5 ap-text-gray-300" />}
                <div className="ap-flex-1">
                    <div className="ap-flex ap-justify-between ap-items-start">
                        <div className="ap-flex-1">
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <p className={`ap-text-sm ap-font-medium ${criterion.is_completed ? 'ap-text-gray-700' : 'ap-text-gray-600'}`}>
                                    {criterion.title}
                                </p>
                                {targetReached && <span className="ap-text-xs ap-bg-green-100 ap-text-green-800 ap-px-2 ap-py-0.5 ap-rounded-full">Target Reached</span>}
                                {isLinked && <span className="ap-ml-2 ap-text-xs ap-text-blue-600 ap-bg-blue-50 ap-px-2 ap-py-0.5 ap-rounded">Auto-tracked</span>}
                            </div>
                            {criterion.description && <p className="ap-text-xs ap-text-gray-500 ap-mt-0.5">{criterion.description}</p>}
                        </div>
                    </div>

                    {showCount && (
                        <div className="ap-mt-2">
                            <p className={`ap-text-sm ${targetReached ? 'ap-text-green-700 ap-font-medium' : 'ap-text-gray-600'}`}>
                                Progress: {criterion.current_value || 0} / {criterion.target_value}
                            </p>
                        </div>
                    )}

                    {criterion.completion_date && <p className="ap-text-xs ap-text-green-600 ap-mt-1">✓ Completed: {formatLocalDate(criterion.completion_date)}</p>}

                    {/* Activity Log Component */}
                    <div className="ap-mt-3">
                        <CriterionActivity
                            criterionId={criterion.id}
                            affectedUserId={member.id}
                            criterionType={criterion.criterion_type}
                            currentValue={criterion.current_value}
                            targetValue={criterion.target_value}
                            isCompleted={Boolean(criterion.is_completed)}
                            canEdit={canApprove}
                            onRefresh={refreshProgress}
                            preloadedActivities={preloadedActivities}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const TeamView: React.FC = () => {
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
    const [userProgressCache, setUserProgressCache] = useState<Record<number, TeamMemberDetailedProgress>>({});
    const [userActivitiesCache, setUserActivitiesCache] = useState<Record<number, Record<number, Activity[]>>>({});
    const [loadingDetailsFor, setLoadingDetailsFor] = useState<number | null>(null);
    const [sortField, setSortField] = useState<'display_name' | 'tier' | 'progress'>('display_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [isLoadingProgress, setIsLoadingProgress] = useState(false);

    useEffect(() => { loadInitial(); }, []);

    const loadInitial = async () => {
        setIsLoading(true);
        try {
            const roles = await getJobRoles();
            setJobRoles(roles);
        } catch (err) {
            console.error('Failed to load job roles', err);
        } finally {
            setIsLoading(false);
        }
    };

    // NEW: Fast loading - get user list instantly, then load progress in background
    const loadTeamMembers = async (roleId?: number) => {
        try {
            setIsLoading(true);
            setTeamMembers([]);
            
            // FAST: Load just user names/emails (no progress calculation)
            const users = await getTeamList(roleId);
            
            // Show users immediately (they can search/filter now!)
            setTeamMembers(users);
            setIsLoading(false);
            
            // BACKGROUND: Load progress data in batches
            if (users.length > 0) {
                setIsLoadingProgress(true);
                await loadProgressForMembers(users, roleId);
                setIsLoadingProgress(false);
            }
        } catch (err) {
            console.error('Failed to load team members', err);
            setIsLoading(false);
            setIsLoadingProgress(false);
        }
    };

    // NEW: Batch load progress for all users at once (much faster than individual calls)
    const loadProgressForMembers = async (members: TeamMember[], roleId?: number) => {
        try {
            const userIds = members.map(m => m.id);
            
            // Batch API call - single request for all users
            const progressData = await getBatchProgress(userIds, roleId);
            
            // Update team members with progress data
            setTeamMembers(prev => {
                return prev.map(member => {
                    const progressItem = progressData.find(p => p.user_id === member.id);
                    if (progressItem) {
                        return { ...member, progress: progressItem.progress };
                    }
                    return member;
                });
            });
        } catch (err) {
            console.error('Failed to load progress', err);
        }
    };

    const refreshUserProgress = async (userId: number) => {
        try {
            const p = await getTeamMemberDetailedProgress(userId);
            setUserProgressCache(prev => ({ ...prev, [userId]: p }));
        } catch (err) {
            console.error('Failed to refresh user progress', err);
        }
    };

    const handleRowClick = async (userId: number, forceRefresh: boolean = false) => {
        const was = expandedUserId === userId;
        setExpandedUserId(was ? null : userId);
        if (!was && (!userProgressCache[userId] || forceRefresh)) {
            setLoadingDetailsFor(userId);
            try {
                console.log(`[TeamView] ${forceRefresh ? 'Force refreshing' : 'Loading'} detailed progress for user ${userId}`);
                const p = await getTeamMemberDetailedProgress(userId);
                console.log(`[TeamView] Received progress data:`, p);
                console.log(`[TeamView] Roles in response: ${p.roles.length}`);
                p.roles.forEach(r => {
                    console.log(`  - Role ${r.job_role_title} (ID ${r.job_role_id}): ${r.criteria.length} criteria`);
                });
                setUserProgressCache(prev => ({ ...prev, [userId]: p }));
                
                // BATCH LOAD: Get all criterion IDs and load activities at once
                const criterionIds = p.roles.flatMap(r => r.criteria.map(c => c.id));
                if (criterionIds.length > 0) {
                    console.log(`[TeamView] Batch loading activities for ${criterionIds.length} criteria`);
                    try {
                        const activitiesByCriterion = await getCriterionActivitiesBatch(criterionIds, userId);
                        setUserActivitiesCache(prev => ({ ...prev, [userId]: activitiesByCriterion }));
                        console.log(`[TeamView] Loaded activities for ${Object.keys(activitiesByCriterion).length} criteria`);
                    } catch (actErr) {
                        console.error('Failed to batch load activities:', actErr);
                    }
                }
            } catch (err) {
                console.error('Failed to load detailed progress', err);
            } finally {
                setLoadingDetailsFor(null);
            }
        }
    };

    const handleUserSelect = async (userId: number) => {
        setSelectedUserId(userId);
        setExpandedUserId(userId);
        const isCached = !!userProgressCache[userId];
        if (!isCached) {
            setLoadingDetailsFor(userId);
            try {
                console.log(`[TeamView] Loading detailed progress for user ${userId}`);
                const p = await getTeamMemberDetailedProgress(userId);
                console.log(`[TeamView] Received progress data:`, p);
                console.log(`[TeamView] Roles in response: ${p.roles.length}`);
                p.roles.forEach(r => {
                    console.log(`  - Role ${r.job_role_title} (ID ${r.job_role_id}): ${r.criteria.length} criteria`);
                });
                setUserProgressCache(prev => ({ ...prev, [userId]: p }));
                
                // BATCH LOAD activities
                const criterionIds = p.roles.flatMap(r => r.criteria.map(c => c.id));
                if (criterionIds.length > 0) {
                    try {
                        const activitiesByCriterion = await getCriterionActivitiesBatch(criterionIds, userId);
                        setUserActivitiesCache(prev => ({ ...prev, [userId]: activitiesByCriterion }));
                    } catch (actErr) {
                        console.error('Failed to batch load activities:', actErr);
                    }
                }
            } catch (err) {
                console.error('Failed to load progress for user', err);
            } finally { setLoadingDetailsFor(null); }
        } else {
            console.log(`[TeamView] Using cached progress data for user ${userId}`);
        }
    };

    const handleClearUserFilter = () => { setSelectedUserId(null); setUserSearchTerm(''); setExpandedUserId(null); };

    const filteredMembers = teamMembers.filter(m => {
        if (selectedUserId) return m.id === selectedUserId;
        if (userSearchTerm.trim()) {
            const s = userSearchTerm.toLowerCase();
            const displayName = (m.display_name || '').toLowerCase();
            const userEmail = (m.user_email || '').toLowerCase();
            return displayName.includes(s) || userEmail.includes(s);
        }
        return true;
    });

    const sortedMembers = [...filteredMembers].sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;
        if (sortField === 'progress') {
            aValue = a.progress?.percentage || 0;
            bValue = b.progress?.percentage || 0;
        } else if (sortField === 'tier') {
            aValue = a.tier || 0;
            bValue = b.tier || 0;
        } else {
            const aDisplayName = a.display_name || '';
            const bDisplayName = b.display_name || '';
            const aNames = aDisplayName.split(' ');
            const bNames = bDisplayName.split(' ');
            const aLast = aNames.length > 1 ? aNames[aNames.length - 1].toLowerCase() : aDisplayName.toLowerCase();
            const bLast = bNames.length > 1 ? bNames[bNames.length - 1].toLowerCase() : bDisplayName.toLowerCase();
            const aFirst = aNames.length > 1 ? aNames.slice(0, -1).join(' ').toLowerCase() : '';
            const bFirst = bNames.length > 1 ? bNames.slice(0, -1).join(' ').toLowerCase() : '';
            const lastNameCompare = aLast.localeCompare(bLast);
            if (lastNameCompare !== 0) return sortDirection === 'asc' ? lastNameCompare : -lastNameCompare;
            const firstNameCompare = aFirst.localeCompare(bFirst);
            return sortDirection === 'asc' ? firstNameCompare : -firstNameCompare;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const getProgressColor = (percentage: number): string => {
        if (percentage >= 80) return 'ap-text-green-600 ap-bg-green-100';
        if (percentage >= 60) return 'ap-text-yellow-600 ap-bg-yellow-100';
        if (percentage >= 40) return 'ap-text-orange-600 ap-bg-orange-100';
        return 'ap-text-red-600 ap-bg-red-100';
    };

    const getProgressBarColor = (percentage: number): string => {
        if (percentage >= 80) return 'bg-green-500';
        if (percentage >= 60) return 'bg-yellow-500';
        if (percentage >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const SortIcon = ({ field }: { field: 'display_name' | 'tier' | 'progress' }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ChevronUpIcon className="ap-w-4 ap-h-4 ap-inline ap-ml-1" /> : <ChevronDownIcon className="ap-w-4 ap-h-4 ap-inline ap-ml-1" />;
    };

    return (
        <div className="ap-max-w-7xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg ap-p-4 ap-border-t-4 ap-border-blue-500">
                <div className="ap-mb-4">
                    <h2 className="ap-text-xl ap-font-bold ap-text-blue-600">Team Progress</h2>
                    <p className="ap-text-gray-600 ap-mt-1 ap-text-sm">Select a job role tab to view team members' progress toward that role. Click any row to expand and see detailed criteria for the selected role.</p>
                </div>

                {isLoading ? (
                    <div className="ap-flex ap-flex-col ap-items-center ap-justify-center ap-py-12">
                        <LoadingSpinner />
                        <p className="ap-text-gray-600 ap-mt-6 ap-text-sm ap-font-medium">{selectedRoleId ? 'Loading team members...' : 'Loading job roles...'}</p>
                    </div>
                ) : jobRoles.length === 0 ? (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">No job roles configured yet. Please configure job roles in the Admin panel first.</div>
                ) : (
                    <>
                        <div className="ap-mb-4">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Select Job Role
                            </label>
                            <select
                                value={selectedRoleId || ''}
                                onChange={(e) => {
                                    const roleId = Number(e.target.value);
                                    setSelectedRoleId(roleId);
                                    setExpandedUserId(null);
                                    setUserProgressCache({}); // Clear cache when switching roles
                                    loadTeamMembers(roleId);
                                }}
                                className="ap-w-full ap-max-w-md ap-px-4 ap-py-2.5 ap-border-2 ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-bg-white ap-text-gray-900 ap-font-medium"
                            >
                                <option value="">-- Select a Job Role --</option>
                                {jobRoles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.title} (Tier {role.tier})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {teamMembers.length > 0 && (
                            <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3">
                                <label className="ap-text-sm ap-font-medium ap-text-gray-700">Filter by User:</label>
                                <div className="ap-flex-1 ap-max-w-md ap-relative">
                                    <input type="text" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Search by name or email..." className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent" disabled={!!selectedUserId} />
                                    {userSearchTerm && !selectedUserId && (
                                        <div className="ap-absolute ap-z-50 ap-mt-1 ap-w-full ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-60 ap-overflow-auto">
                                            {filteredMembers.slice(0, 10).map(member => (
                                                <button key={member.id} onClick={() => { handleUserSelect(member.id); setUserSearchTerm(member.display_name || ''); }} className="ap-w-full ap-text-left ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-flex ap-items-center ap-justify-between">
                                                    <div>
                                                        <div className="ap-font-medium ap-text-gray-900">{member.display_name || 'Unknown User'}</div>
                                                        <div className="ap-text-xs ap-text-gray-500">{member.user_email || ''}</div>
                                                    </div>
                                                    <span className="ap-text-xs ap-text-gray-400">Tier {member.tier || 0}</span>
                                                </button>
                                            ))}
                                            {filteredMembers.length === 0 && (<div className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-500">No users found</div>)}
                                        </div>
                                    )}
                                </div>
                                {selectedUserId && (<Button onClick={handleClearUserFilter} variant="secondary" size="sm">Clear Filter</Button>)}
                            </div>
                        )}

                        {!selectedRoleId ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">Select a job role above to view team members' progress.</div>
                        ) : teamMembers.length === 0 && !isLoading ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">No team members found for this role. Team members may not have this role assigned yet.</div>
                        ) : teamMembers.length > 0 ? (
                            <>
                                <div className="ap-overflow-auto ap-max-h-[600px] ap-border ap-border-gray-200 ap-rounded">
                                    <div className="ap-overflow-x-auto">
                                        <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                            <thead className="ap-bg-gray-50 ap-sticky ap-top-0 ap-z-10">
                                                <tr>
                                                    <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-w-8"></th>
                                                    <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-cursor-pointer hover:ap-bg-gray-100" onClick={() => { if (sortField === 'display_name') setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('display_name'); setSortDirection('asc'); } }}>
                                                        Team Member <SortIcon field="display_name" />
                                                    </th>
                                                    <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Current Role</th>
                                                    <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-cursor-pointer hover:ap-bg-gray-100" onClick={() => { if (sortField === 'tier') setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('tier'); setSortDirection('asc'); } }}>Tier <SortIcon field="tier" /></th>
                                                    <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-cursor-pointer hover:ap-bg-gray-100" onClick={() => { if (sortField === 'progress') setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('progress'); setSortDirection('asc'); } }}>{selectedRoleId ? `Progress to ${jobRoles.find(r => r.id === selectedRoleId)?.title || 'Role'}` : 'Current Progress'} <SortIcon field="progress" /></th>
                                                </tr>
                                            </thead>
                                            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                                {sortedMembers.map(member => {
                                                    const isExpanded = expandedUserId === member.id;
                                                    const cached = userProgressCache[member.id];
                                                    const roleProgress = cached?.roles.find(r => r.job_role_id === selectedRoleId);
                                                    const displayProgress = roleProgress?.progress || member.progress || { completed: 0, total: 0, percentage: 0 };
                                                    const allRoles = cached?.roles || [];
                                                    const rolesToShow = selectedRoleId ? allRoles.filter(r => r.job_role_id === selectedRoleId) : allRoles;
                                                    
                                                    if (isExpanded && cached) {
                                                        console.log(`[TeamView] Expanded user ${member.id} (${member.display_name})`);
                                                        console.log(`  - All roles in cache: ${allRoles.length}`);
                                                        console.log(`  - Selected role filter: ${selectedRoleId}`);
                                                        console.log(`  - Roles to show after filter: ${rolesToShow.length}`);
                                                        rolesToShow.forEach(r => {
                                                            console.log(`    * ${r.job_role_title} (ID ${r.job_role_id}): ${r.criteria.length} criteria`);
                                                        });
                                                    }

                                                    return (
                                                        <React.Fragment key={member.id}>
                                                            <tr className="hover:ap-bg-gray-50 ap-cursor-pointer ap-transition-colors" onClick={(e) => handleRowClick(member.id, e.shiftKey)}>
                                                                <td className="ap-px-3 ap-py-3">{isExpanded ? <ChevronDownIcon className="ap-w-5 ap-h-5 ap-text-gray-500" /> : <ChevronRightIcon className="ap-w-5 ap-h-5 ap-text-gray-500" />}</td>
                                                                <td className="ap-px-3 ap-py-3">
                                                                    <div className="ap-text-sm ap-font-medium ap-text-gray-900">{member.display_name || 'Unknown User'}</div>
                                                                    <div className="ap-text-xs ap-text-gray-500">{member.user_email || ''}</div>
                                                                </td>
                                                                <td className="ap-px-3 ap-py-3 ap-text-sm ap-text-gray-900">{member.job_role || 'Not assigned'}</td>
                                                                <td className="ap-px-3 ap-py-3 ap-text-sm ap-text-gray-900">Tier {member.tier || 0}</td>
                                                                <td className="ap-px-3 ap-py-3">
                                                                    <div className="ap-flex ap-items-center ap-space-x-3">
                                                                        <div className="ap-flex-1 ap-min-w-[100px]">
                                                                            <div className="ap-w-full ap-bg-gray-200 ap-rounded-full ap-h-2"><div className={`ap-h-2 ap-rounded-full ap-transition-all ap-duration-300 ${getProgressBarColor(displayProgress.percentage)}`} style={{ width: `${displayProgress.percentage}%` }}></div></div>
                                                                        </div>
                                                                        <div className="ap-text-xs ap-text-gray-700 ap-whitespace-nowrap">{displayProgress.completed}/{displayProgress.total}</div>
                                                                        <span className={`ap-px-2 ap-py-1 ap-text-xs ap-font-semibold ap-rounded-full ${getProgressColor(displayProgress.percentage)}`}>{displayProgress.percentage}%</span>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={5} className="ap-px-3 ap-py-4 ap-bg-gray-50">
                                                                        {loadingDetailsFor === member.id ? (<div className="ap-text-center ap-py-4 ap-text-gray-500">Loading detailed progress...</div>) : userProgressCache[member.id] ? (
                                                                            <div className="ap-space-y-4">
                                                                                {rolesToShow.map(role => (
                                                                                    <div key={role.job_role_id} className="ap-bg-white ap-rounded-lg ap-p-4 ap-shadow-sm">
                                                                                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                                                                                            <h4 className="ap-font-semibold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">{role.job_role_title} (Tier {role.tier}){role.is_current_role && <span className="ap-text-xs ap-bg-blue-100 ap-text-blue-700 ap-px-2 ap-py-1 ap-rounded">Current Role</span>}</h4>
                                                                                            <div className="ap-text-sm ap-text-gray-600">{role.progress.completed} of {role.progress.total} completed ({role.progress.percentage}%)</div>
                                                                                        </div>
                                                                                        {role.criteria.length === 0 ? (<p className="ap-text-sm ap-text-gray-500 ap-italic">No criteria defined for this role yet.</p>) : (
                                                                                            <div className="ap-space-y-2">{role.criteria.map((criterion: any) => {
                                                                                                const preloadedActivities = userActivitiesCache[member.id]?.[criterion.id];
                                                                                                return (<SupervisorCriterionEditor key={criterion.id} criterion={criterion} member={member} refreshProgress={() => refreshUserProgress(member.id)} preloadedActivities={preloadedActivities} />);
                                                                                            })}</div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (<div className="ap-text-center ap-py-4 ap-text-gray-500">Failed to load detailed progress.</div>)}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="ap-mt-3 ap-text-xs ap-text-gray-500 ap-flex ap-justify-between ap-items-center">
                                    <span>Showing {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}{isLoadingProgress && <span className="ap-ml-2 ap-text-blue-600">(loading progress...)</span>}</span>
                                    <span className="ap-text-gray-400">💡 Click row to expand | Shift+Click to refresh data</span>
                                </div>
                            </>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export default TeamView;
