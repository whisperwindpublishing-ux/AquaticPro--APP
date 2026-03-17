import React, { useState, useEffect, useMemo } from 'react';
import { Button, Modal } from '../ui';
import {
    getSeasons,
    getTemplates,
    getResponses,
    sendBatchInvites,
    sendFollowUps,
    getMyPermissions,
    bulkVoidInvites
} from '@/services/seasonalReturnsService';
import {
    getJobRoles as fetchAllJobRoles,
    getUserAssignments,
    assignUserToRole,
    removeAssignment,
    JobRole as PGJobRole,
    UserJobAssignment,
} from '@/services/api-professional-growth';
import {
    Season,
    EmailTemplate,
    EmployeeSeason,
    SRMPermissions,
    EmployeeStatus
} from '@/types';
import {
    HiOutlinePaperAirplane,
    HiOutlineUserGroup,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock,
    HiOutlineMagnifyingGlass,
    HiOutlineExclamationTriangle,
    HiOutlineInformationCircle,
    HiOutlineArrowPath,
    HiOutlineTrash,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineBriefcase,
    HiOutlinePencilSquare,
    HiOutlinePlus,
    HiOutlineStar
} from 'react-icons/hi2';

const SRM_DEFAULT_SEASON_KEY = 'srm_default_season_id';

/** Read the stored default season ID as a number (or null if unset). */
function getDefaultSeasonId(): number | null {
    const raw = localStorage.getItem(SRM_DEFAULT_SEASON_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * ReturnInviteManager - Send return intent invitations to employees
 * 
 * Features:
 * - Select a season to invite employees for
 * - View employees by response status (pending, not invited, returning, not returning)
 * - Select email template for initial or follow-up emails
 * - Bulk select employees to send invites
 * - Track email send status
 */

type InviteTab = 'not_invited' | 'pending' | 'returning' | 'not_returning';

interface EmployeeForInvite {
    user_id: number;
    display_name: string;
    email: string;
    first_name: string;
    last_name: string;
    status: EmployeeStatus | 'not_invited';
    invite_sent: boolean;
    follow_up_count: number;
    last_email_date?: string;
    created_at?: string;
    job_roles?: string[];
    comments?: string;
}

const ReturnInviteManager: React.FC = () => {
    // Data state
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [employees, setEmployees] = useState<EmployeeForInvite[]>([]);
    const [permissions, setPermissions] = useState<SRMPermissions | null>(null);
    
    // UI state
    const [loading, setLoading] = useState(true);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [sending, setSending] = useState(false);
    const [voiding, setVoiding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Selection state
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<InviteTab>('not_invited');
    
    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    
    // Job Role Summary state
    const [showRoleSummary, setShowRoleSummary] = useState(true);
    
    // Job Role editing modal state
    const [editingRolesFor, setEditingRolesFor] = useState<EmployeeForInvite | null>(null);
    const [allJobRoles, setAllJobRoles] = useState<PGJobRole[]>([]);
    const [userAssignments, setUserAssignments] = useState<UserJobAssignment[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [savingRole, setSavingRole] = useState(false);
    const [selectedNewRoleId, setSelectedNewRoleId] = useState<number | ''>('');    
    useEffect(() => {
        loadInitialData();
    }, []);
    
    useEffect(() => {
        if (selectedSeasonId) {
            // Clear existing data immediately when season changes
            setEmployees([]);
            setSelectedEmployees(new Set());
            loadEmployeesForSeason(selectedSeasonId);
        } else {
            setEmployees([]);
            setSelectedEmployees(new Set());
        }
    }, [selectedSeasonId]);
    
    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [seasonsData, templatesData, perms] = await Promise.all([
                getSeasons(),
                getTemplates(),
                getMyPermissions()
            ]);
            
            setSeasons(seasonsData || []);
            setTemplates(templatesData || []);
            setPermissions(perms);
            
            // Auto-select season: saved default > current season > first season
            const savedDefaultId = getDefaultSeasonId();
            const savedDefault = savedDefaultId ? seasonsData?.find(s => Number(s.id) === savedDefaultId) : null;
            const activeSeason = savedDefault || seasonsData?.find(s => s.is_current) || seasonsData?.[0];
            if (activeSeason) {
                setSelectedSeasonId(activeSeason.id);
            }
            
            // Auto-select initial invite template
            const initialTemplate = templatesData?.find(t => t.template_type === 'initial_invite');
            if (initialTemplate) {
                setSelectedTemplateId(initialTemplate.id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };
    
    const loadEmployeesForSeason = async (seasonId: number) => {
        try {
            setLoadingEmployees(true);
            // Get responses for this season
            console.log('🔍 Loading responses for season:', seasonId);
            const responses = await getResponses(seasonId);
            console.log('📊 Received responses:', responses?.length || 0, responses);
            
            // Get all users from the mentorship platform (use /users/list endpoint)
            const allUsersResponse = await fetch('/wp-json/mentorship-platform/v1/users/list', {
                credentials: 'include',
                cache: 'no-store',
                headers: {
                    'X-WP-Nonce': window.mentorshipPlatformData?.nonce || ''
                }
            });
            
            if (!allUsersResponse.ok) {
                throw new Error('Failed to load users');
            }
            
            const allUsers = await allUsersResponse.json();
            
            // Map responses to lookup - ensure user_id is converted to number for consistent comparison
            const responseMap = new Map<number, EmployeeSeason>();
            responses?.forEach(r => {
                const numericUserId = typeof r.user_id === 'string' ? parseInt(r.user_id, 10) : r.user_id;
                console.log('  👤 Response for user', numericUserId, '- status:', r.status);
                responseMap.set(numericUserId, r);
            });
            
            console.log('📋 Response map created with', responseMap.size, 'entries');
            
            // Build employee list - handle the /users/list response format
            const employeeList: EmployeeForInvite[] = allUsers.map((user: any) => {
                // Ensure user_id is a number for Map lookup
                const userId = typeof user.user_id === 'string' ? parseInt(user.user_id, 10) : user.user_id;
                const response = responseMap.get(userId);
                const firstName = user.first_name || '';
                const lastName = user.last_name || '';
                const displayName = user.display_name || `${firstName} ${lastName}`.trim() || 'Unknown';
                
                if (response) {
                    console.log('  ✅ Matched user', userId, displayName, 'with response status:', response.status);
                }
                
                return {
                    user_id: userId,
                    display_name: displayName,
                    email: user.user_email || user.email || '',
                    first_name: firstName,
                    last_name: lastName,
                    status: response?.status || 'not_invited',
                    invite_sent: !!response,
                    follow_up_count: 0,
                    created_at: response?.created_at,
                    job_roles: user.job_role_titles ? user.job_role_titles.split(', ') : [],
                    comments: response?.comments
                };
            });
            
            // Sort by last name, then first name
            employeeList.sort((a, b) => {
                const lastCmp = a.last_name.localeCompare(b.last_name);
                if (lastCmp !== 0) return lastCmp;
                return a.first_name.localeCompare(b.first_name);
            });
            
            const statusCounts = employeeList.reduce((acc, emp) => {
                acc[emp.status] = (acc[emp.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log('📈 Employee status breakdown:', statusCounts);
            
            setEmployees(employeeList);
        } catch (err: any) {
            console.error('Failed to load employees:', err);
            setError(err.message || 'Failed to load employees');
        } finally {
            setLoadingEmployees(false);
        }
    };
    
    // Filter employees by tab and search
    const filteredEmployees = useMemo(() => {
        let filtered = employees;
        
        // Filter by tab
        switch (activeTab) {
            case 'not_invited':
                filtered = filtered.filter(e => e.status === 'not_invited' || !e.invite_sent);
                break;
            case 'pending':
                filtered = filtered.filter(e => e.status === 'pending');
                break;
            case 'returning':
                filtered = filtered.filter(e => e.status === 'returning');
                break;
            case 'not_returning':
                filtered = filtered.filter(e => e.status === 'not_returning');
                break;
        }
        
        // Filter by role
        if (filterRole) {
            filtered = filtered.filter(e => 
                e.job_roles && e.job_roles.some(role => role === filterRole)
            );
        }
        
        // Filter by search
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(e => 
                e.display_name.toLowerCase().includes(search) ||
                e.email.toLowerCase().includes(search)
            );
        }
        
        return filtered;
    }, [employees, activeTab, searchTerm, filterRole]);
    
    // Get unique roles for filter dropdown
    const uniqueRoles = useMemo(() => {
        const roles = new Set<string>();
        employees.forEach(emp => {
            if (emp.job_roles && emp.job_roles.length > 0) {
                emp.job_roles.forEach(role => roles.add(role));
            }
        });
        return Array.from(roles).sort();
    }, [employees]);
    
    // Compute job role summary with status counts
    const roleSummary = useMemo(() => {
        const summary: Record<string, { role: string; not_invited: number; pending: number; returning: number; not_returning: number; total: number }> = {};
        
        employees.forEach(emp => {
            const roles = emp.job_roles && emp.job_roles.length > 0 ? emp.job_roles : ['No Role Assigned'];
            const empStatus = emp.status || 'not_invited';
            
            roles.forEach(role => {
                if (!summary[role]) {
                    summary[role] = { role, not_invited: 0, pending: 0, returning: 0, not_returning: 0, total: 0 };
                }
                summary[role].total++;
                if (empStatus === 'not_invited' || !emp.invite_sent) {
                    summary[role].not_invited++;
                } else if (empStatus in summary[role]) {
                    (summary[role] as any)[empStatus]++;
                }
            });
        });
        
        return Object.values(summary).sort((a, b) => b.total - a.total);
    }, [employees]);
    
    // Tab counts
    const tabCounts = useMemo(() => ({
        not_invited: employees.filter(e => e.status === 'not_invited' || !e.invite_sent).length,
        pending: employees.filter(e => e.status === 'pending').length,
        returning: employees.filter(e => e.status === 'returning').length,
        not_returning: employees.filter(e => e.status === 'not_returning').length
    }), [employees]);
    
    const handleSelectAll = () => {
        if (selectedEmployees.size === filteredEmployees.length) {
            setSelectedEmployees(new Set());
        } else {
            setSelectedEmployees(new Set(filteredEmployees.map(e => e.user_id)));
        }
    };
    
    const handleToggleEmployee = (userId: number) => {
        const newSelected = new Set(selectedEmployees);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedEmployees(newSelected);
    };
    
    const handleSendInvites = async () => {
        if (!selectedSeasonId || !selectedTemplateId || selectedEmployees.size === 0) {
            setError('Please select a season, template, and at least one employee');
            return;
        }
        
        setSending(true);
        setError(null);
        setSuccess(null);
        
        try {
            const userIds = Array.from(selectedEmployees);
            const isFollowUp = activeTab === 'pending';
            
            let result;
            if (isFollowUp) {
                result = await sendFollowUps(userIds, selectedSeasonId, selectedTemplateId, 1);
            } else {
                result = await sendBatchInvites(userIds, selectedSeasonId, selectedTemplateId);
            }
            
            setSuccess(`Successfully sent ${result.sent_count} of ${result.total} emails`);
            setSelectedEmployees(new Set());
            
            // Reload employee data to show updated invite status
            console.log('📧 Invites sent, reloading employee list for season:', selectedSeasonId);
            await loadEmployeesForSeason(selectedSeasonId);
            console.log('✅ Employee list reloaded');
            
            if (result.errors && result.errors.length > 0) {
                setError(`Some emails failed: ${result.errors.slice(0, 3).join(', ')}`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to send invites');
        } finally {
            setSending(false);
        }
    };
    
    const handleVoidInvites = async () => {
        if (!selectedSeasonId || selectedEmployees.size === 0) {
            setError('Please select at least one employee to void');
            return;
        }
        
        const count = selectedEmployees.size;
        if (!confirm(`Are you sure you want to void ${count} pending invite(s)? This will remove their pending status and they'll need to be re-invited.`)) {
            return;
        }
        
        setVoiding(true);
        setError(null);
        setSuccess(null);
        
        try {
            const userIds = Array.from(selectedEmployees);
            const result = await bulkVoidInvites({
                user_ids: userIds,
                season_id: selectedSeasonId
            });
            
            setSuccess(result.message);
            setSelectedEmployees(new Set());
            
            // Reload employee data to show updated status
            await loadEmployeesForSeason(selectedSeasonId);
        } catch (err: any) {
            setError(err.message || 'Failed to void invites');
        } finally {
            setVoiding(false);
        }
    };
    
    const handleEditRoles = async (employee: EmployeeForInvite) => {
        setEditingRolesFor(employee);
        setSelectedNewRoleId('');
        setLoadingRoles(true);
        
        try {
            const [roles, assignments] = await Promise.all([
                fetchAllJobRoles(),
                getUserAssignments(employee.user_id),
            ]);
            setAllJobRoles(roles);
            setUserAssignments(assignments);
        } catch (err: any) {
            console.error('Failed to load job roles:', err);
            setError(err.message || 'Failed to load job roles');
            setAllJobRoles([]);
            setUserAssignments([]);
        } finally {
            setLoadingRoles(false);
        }
    };
    
    const handleAddRole = async () => {
        if (!editingRolesFor || !selectedNewRoleId) return;
        
        setSavingRole(true);
        setError(null);
        
        try {
            await assignUserToRole({
                user_id: editingRolesFor.user_id,
                job_role_id: Number(selectedNewRoleId),
            });
            
            // Refresh assignments
            const assignments = await getUserAssignments(editingRolesFor.user_id);
            setUserAssignments(assignments);
            setSelectedNewRoleId('');
            
            // Update local employee data to reflect new role
            const updatedRoleTitles = assignments.map(a => a.job_role_title || '').filter(Boolean);
            setEmployees(prev => prev.map(e => 
                e.user_id === editingRolesFor.user_id 
                    ? { ...e, job_roles: updatedRoleTitles }
                    : e
            ));
            
            setSuccess('Job role assigned successfully');
        } catch (err: any) {
            setError(err.message || 'Failed to assign job role');
        } finally {
            setSavingRole(false);
        }
    };
    
    const handleRemoveRole = async (assignment: UserJobAssignment) => {
        if (!editingRolesFor || !assignment.id) return;
        if (!confirm(`Remove "${assignment.job_role_title}" from ${editingRolesFor.display_name}?`)) return;
        
        setSavingRole(true);
        setError(null);
        
        try {
            await removeAssignment(assignment.id);
            
            // Refresh assignments
            const assignments = await getUserAssignments(editingRolesFor.user_id);
            setUserAssignments(assignments);
            
            // Update local employee data to reflect removed role
            const updatedRoleTitles = assignments.map(a => a.job_role_title || '').filter(Boolean);
            setEmployees(prev => prev.map(e =>
                e.user_id === editingRolesFor.user_id
                    ? { ...e, job_roles: updatedRoleTitles }
                    : e
            ));
            
            setSuccess('Job role removed successfully');
        } catch (err: any) {
            setError(err.message || 'Failed to remove job role');
        } finally {
            setSavingRole(false);
        }
    };
    
    const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
    
    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }
    
    if (!permissions?.srm_send_invites) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-yellow-800">You don't have permission to send return invites.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="ap-p-6 ap-max-w-7xl ap-mx-auto">
            {/* Header */}
            <div className="ap-mb-6">
                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Return Invitations</h1>
                <p className="ap-text-gray-600 ap-mt-1">Send return intent invitations to seasonal employees</p>
            </div>
            
            {/* Alerts */}
            {error && (
                <div className="ap-mb-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div>
                        <p className="ap-text-red-800">{error}</p>
                        <Button 
                            variant="link"
                            onClick={() => setError(null)}
                            className="!ap-text-sm !ap-text-red-600 hover:!ap-text-red-800 !ap-p-0 !ap-h-auto !ap-mt-1"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}
            
            {success && (
                <div className="ap-mb-4 ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div>
                        <p className="ap-text-green-800">{success}</p>
                        <Button 
                            variant="link"
                            onClick={() => setSuccess(null)}
                            className="!ap-text-sm !ap-text-green-600 hover:!ap-text-green-800 !ap-p-0 !ap-h-auto !ap-mt-1"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Configuration Row */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6 ap-mb-6">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Invite Configuration</h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectedSeasonId && loadEmployeesForSeason(selectedSeasonId)}
                        disabled={loadingEmployees || !selectedSeasonId}
                        className="!ap-text-blue-600 hover:!ap-bg-blue-50"
                        title="Refresh employee list"
                    >
                        <HiOutlineArrowPath className={`ap-w-4 ap-h-4 ${loadingEmployees ? 'ap-animate-spin' : ''}`} />
                        {loadingEmployees ? 'Loading...' : 'Refresh'}
                    </Button>
                </div>
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-6">
                    {/* Season Selection */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Select Season
                        </label>
                        <select
                            value={selectedSeasonId || ''}
                            onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">Choose a season...</option>
                            {seasons.map(season => {
                                const isDefault = Number(season.id) === getDefaultSeasonId();
                                return (
                                    <option key={season.id} value={season.id}>
                                        {season.name} {season.is_current ? '(Current)' : ''}{isDefault ? ' ★' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="ap-mt-2 ap-flex ap-items-center ap-gap-3">
                            {selectedSeason && (
                                <p className="ap-text-sm ap-text-gray-500">
                                    {new Date(selectedSeason.start_date).toLocaleDateString()} - {new Date(selectedSeason.end_date).toLocaleDateString()}
                                </p>
                            )}
                            {selectedSeasonId && (
                                <>
                                    {Number(selectedSeasonId) === getDefaultSeasonId() ? (
                                        <span className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-text-amber-600 ap-font-medium">
                                            <HiOutlineStar className="ap-w-3.5 ap-h-3.5 ap-fill-amber-400 ap-text-amber-500" />
                                            Default
                                            <button
                                                onClick={() => {
                                                    localStorage.removeItem(SRM_DEFAULT_SEASON_KEY);
                                                    setSuccess('Default season cleared.');
                                                    setSeasons([...seasons]);
                                                }}
                                                className="ap-text-xs ap-text-gray-400 hover:ap-text-red-500 ap-ml-1 ap-transition-colors"
                                                title="Clear default"
                                            >
                                                (clear)
                                            </button>
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                localStorage.setItem(SRM_DEFAULT_SEASON_KEY, String(selectedSeasonId));
                                                setSuccess('Default season saved — this season will auto-select on future visits.');
                                                setSeasons([...seasons]);
                                            }}
                                            className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-text-gray-500 hover:ap-text-amber-600 ap-transition-colors"
                                            title="Set this season as your default"
                                        >
                                            <HiOutlineStar className="ap-w-3.5 ap-h-3.5" />
                                            Set as Default
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    
                    {/* Template Selection */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Email Template
                        </label>
                        <select
                            value={selectedTemplateId || ''}
                            onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">Choose a template...</option>
                            {templates.map(template => (
                                <option key={template.id} value={template.id}>
                                    {template.name} ({template.template_type.replace('_', ' ')})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            
            {/* Stats Cards */}
            <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-4 ap-mb-6">
                <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-gray-100 ap-rounded-lg">
                            <HiOutlineUserGroup className="ap-w-6 ap-h-6 ap-text-gray-600" />
                        </div>
                        <div>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{tabCounts.not_invited}</p>
                            <p className="ap-text-sm ap-text-gray-500">Not Invited</p>
                        </div>
                    </div>
                </div>
                
                <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-yellow-100 ap-rounded-lg">
                            <HiOutlineClock className="ap-w-6 ap-h-6 ap-text-yellow-600" />
                        </div>
                        <div>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{tabCounts.pending}</p>
                            <p className="ap-text-sm ap-text-gray-500">Pending Response</p>
                        </div>
                    </div>
                </div>
                
                <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-green-100 ap-rounded-lg">
                            <HiOutlineCheckCircle className="ap-w-6 ap-h-6 ap-text-green-600" />
                        </div>
                        <div>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{tabCounts.returning}</p>
                            <p className="ap-text-sm ap-text-gray-500">Returning</p>
                        </div>
                    </div>
                </div>
                
                <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-red-100 ap-rounded-lg">
                            <HiOutlineXCircle className="ap-w-6 ap-h-6 ap-text-red-600" />
                        </div>
                        <div>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{tabCounts.not_returning}</p>
                            <p className="ap-text-sm ap-text-gray-500">Not Returning</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Job Role Summary */}
            {roleSummary.length > 0 && (
                <div className="ap-bg-white ap-rounded-lg ap-shadow-md ap-mb-6">
                    <button
                        onClick={() => setShowRoleSummary(!showRoleSummary)}
                        className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-text-left hover:ap-bg-gray-50 ap-transition-colors ap-rounded-lg"
                    >
                        <div className="ap-flex ap-items-center ap-gap-3">
                            <div className="ap-p-2 ap-bg-purple-100 ap-rounded-lg">
                                <HiOutlineBriefcase className="ap-w-5 ap-h-5 ap-text-purple-600" />
                            </div>
                            <div>
                                <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Job Role Summary</h2>
                                <p className="ap-text-sm ap-text-gray-500">
                                    {roleSummary.length} role{roleSummary.length !== 1 ? 's' : ''} — see how many positions are filled vs. open
                                </p>
                            </div>
                        </div>
                        {showRoleSummary 
                            ? <HiOutlineChevronUp className="ap-w-5 ap-h-5 ap-text-gray-400" /> 
                            : <HiOutlineChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                        }
                    </button>
                    
                    {showRoleSummary && (
                        <div className="ap-px-6 ap-pb-6">
                            <div className="ap-overflow-x-auto">
                                <table className="ap-w-full">
                                    <thead>
                                        <tr className="ap-border-b ap-border-gray-200">
                                            <th className="ap-py-2 ap-pr-4 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Job Role
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Not Invited
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-yellow-600 ap-uppercase ap-tracking-wider">
                                                Pending
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-green-600 ap-uppercase ap-tracking-wider">
                                                Returning
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-red-600 ap-uppercase ap-tracking-wider">
                                                Not Returning
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Total
                                            </th>
                                            <th className="ap-py-2 ap-pl-4 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Fill Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="ap-divide-y ap-divide-gray-100">
                                        {roleSummary.map(item => {
                                            const fillRate = item.total > 0 
                                                ? Math.round((item.returning / item.total) * 100) 
                                                : 0;
                                            const isNoRole = item.role === 'No Role Assigned';
                                            return (
                                                <tr 
                                                    key={item.role} 
                                                    className="hover:ap-bg-gray-50 ap-cursor-pointer ap-transition-colors"
                                                    onClick={() => {
                                                        if (!isNoRole) {
                                                            setFilterRole(filterRole === item.role ? '' : item.role);
                                                        }
                                                    }}
                                                >
                                                    <td className="ap-py-3 ap-pr-4">
                                                        <div className="ap-flex ap-items-center ap-gap-2">
                                                            <span className={`ap-font-medium ${isNoRole ? 'ap-text-gray-400 ap-italic' : 'ap-text-gray-900'}`}>
                                                                {item.role}
                                                            </span>
                                                            {filterRole === item.role && (
                                                                <span className="ap-px-1.5 ap-py-0.5 ap-bg-blue-100 ap-text-blue-700 ap-rounded ap-text-xs ap-font-medium">
                                                                    filtered
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-center">
                                                        <span className={`ap-inline-flex ap-items-center ap-justify-center ap-min-w-[28px] ap-px-2 ap-py-0.5 ap-rounded-full ap-text-sm ap-font-semibold ${
                                                            item.not_invited > 0 ? 'ap-bg-gray-100 ap-text-gray-700' : 'ap-text-gray-300'
                                                        }`}>
                                                            {item.not_invited}
                                                        </span>
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-center">
                                                        <span className={`ap-inline-flex ap-items-center ap-justify-center ap-min-w-[28px] ap-px-2 ap-py-0.5 ap-rounded-full ap-text-sm ap-font-semibold ${
                                                            item.pending > 0 ? 'ap-bg-yellow-100 ap-text-yellow-700' : 'ap-text-gray-300'
                                                        }`}>
                                                            {item.pending}
                                                        </span>
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-center">
                                                        <span className={`ap-inline-flex ap-items-center ap-justify-center ap-min-w-[28px] ap-px-2 ap-py-0.5 ap-rounded-full ap-text-sm ap-font-semibold ${
                                                            item.returning > 0 ? 'ap-bg-green-100 ap-text-green-700' : 'ap-text-gray-300'
                                                        }`}>
                                                            {item.returning}
                                                        </span>
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-center">
                                                        <span className={`ap-inline-flex ap-items-center ap-justify-center ap-min-w-[28px] ap-px-2 ap-py-0.5 ap-rounded-full ap-text-sm ap-font-semibold ${
                                                            item.not_returning > 0 ? 'ap-bg-red-100 ap-text-red-700' : 'ap-text-gray-300'
                                                        }`}>
                                                            {item.not_returning}
                                                        </span>
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-center ap-font-semibold ap-text-gray-700">
                                                        {item.total}
                                                    </td>
                                                    <td className="ap-py-3 ap-pl-4 ap-text-center">
                                                        <div className="ap-flex ap-items-center ap-gap-2 ap-justify-center">
                                                            <div className="ap-w-16 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                                <div 
                                                                    className={`ap-h-full ap-rounded-full ap-transition-all ${
                                                                        fillRate >= 75 ? 'ap-bg-green-500' 
                                                                        : fillRate >= 50 ? 'ap-bg-yellow-500' 
                                                                        : fillRate > 0 ? 'ap-bg-red-500'
                                                                        : 'ap-bg-gray-300'
                                                                    }`}
                                                                    style={{ width: `${fillRate}%` }}
                                                                />
                                                            </div>
                                                            <span className={`ap-text-xs ap-font-medium ap-min-w-[36px] ${
                                                                fillRate >= 75 ? 'ap-text-green-600' 
                                                                : fillRate >= 50 ? 'ap-text-yellow-600' 
                                                                : 'ap-text-red-600'
                                                            }`}>
                                                                {fillRate}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="ap-border-t-2 ap-border-gray-300 ap-bg-gray-50">
                                            <td className="ap-py-3 ap-pr-4 ap-font-bold ap-text-gray-900">Totals</td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-gray-700">
                                                {roleSummary.reduce((sum, r) => sum + r.not_invited, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-yellow-700">
                                                {roleSummary.reduce((sum, r) => sum + r.pending, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-green-700">
                                                {roleSummary.reduce((sum, r) => sum + r.returning, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-red-700">
                                                {roleSummary.reduce((sum, r) => sum + r.not_returning, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-gray-900">
                                                {roleSummary.reduce((sum, r) => sum + r.total, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-pl-4"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="ap-mt-3 ap-text-xs ap-text-gray-500 ap-italic">
                                Click a row to filter the employee list by that role. Employees with multiple roles are counted once per role.
                            </p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Employee List */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-md">
                {/* Tabs */}
                <div className="ap-border-b ap-border-gray-200">
                    <nav className="ap-flex -ap-mb-px">
                        {[
                            { id: 'not_invited', label: 'Not Invited', count: tabCounts.not_invited },
                            { id: 'pending', label: 'Pending', count: tabCounts.pending },
                            { id: 'returning', label: 'Returning', count: tabCounts.returning },
                            { id: 'not_returning', label: 'Not Returning', count: tabCounts.not_returning }
                        ].map(tab => (
                            <Button
                                key={tab.id}
                                variant="ghost"
                                onClick={() => {
                                    setActiveTab(tab.id as InviteTab);
                                    setSelectedEmployees(new Set());
                                }}
                                className={`!ap-rounded-none !ap-px-6 !ap-py-4 !ap-text-sm !ap-font-medium !ap-border-b-2 ${
                                    activeTab === tab.id
                                        ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                }`}
                            >
                                {tab.label}
                                <span className={`ap-ml-2 ap-px-2 ap-py-0.5 ap-rounded-full ap-text-xs ${
                                    activeTab === tab.id ? 'ap-bg-blue-50' : 'ap-bg-gray-100'
                                }`}>
                                    {tab.count}
                                </span>
                            </Button>
                        ))}
                    </nav>
                </div>
                
                {/* Search & Actions */}
                <div className="ap-p-4 ap-border-b ap-border-gray-200 ap-flex ap-flex-col md:ap-flex-row ap-gap-4 ap-items-center ap-justify-between">
                    {/* Search and Filter */}
                    <div className="ap-flex ap-flex-1 ap-gap-3 ap-items-center ap-w-full md:ap-w-auto">
                        {/* Search */}
                        <div className="ap-relative ap-flex-1 ap-max-w-md">
                            <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-text-gray-400 ap-w-5 ap-h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>
                        
                        {/* Role Filter */}
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">All Roles</option>
                            {uniqueRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Send Button */}
                    <div className="ap-flex ap-items-center ap-gap-4">
                        <span className="ap-text-sm ap-text-gray-500">
                            {selectedEmployees.size} selected
                        </span>
                        
                        {/* Void Button (Pending tab only) */}
                        {activeTab === 'pending' && (
                            <Button
                                variant="outline"
                                onClick={handleVoidInvites}
                                disabled={voiding || selectedEmployees.size === 0}
                                className="!ap-border-red-300 !ap-text-red-600 hover:!ap-bg-red-50"
                            >
                                {voiding ? (
                                    <>
                                        <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-red-600"></div>
                                        Voiding...
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                        Void Selected
                                    </>
                                )}
                            </Button>
                        )}
                        
                        <Button
                            variant="primary"
                            onClick={handleSendInvites}
                            disabled={sending || selectedEmployees.size === 0 || !selectedTemplateId}
                        >
                            {sending ? (
                                <>
                                    <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-white"></div>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <HiOutlinePaperAirplane className="ap-w-5 ap-h-5" />
                                    {activeTab === 'pending' ? 'Send Follow-up' : 'Send Invites'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
                
                {/* Help Text */}
                {activeTab === 'not_invited' && (
                    <div className="ap-px-4 ap-py-3 ap-bg-blue-50 ap-border-b ap-border-blue-100 ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-blue-700">
                        <HiOutlineInformationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                        <p>Select employees below and click "Send Invites" to send them return intent forms.</p>
                    </div>
                )}
                
                {activeTab === 'pending' && (
                    <div className="ap-px-4 ap-py-3 ap-bg-yellow-50 ap-border-b ap-border-yellow-100 ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-yellow-700">
                        <HiOutlineInformationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                        <p>These employees have been invited but haven't responded. Select them to send follow-up reminders, or void invites to remove their pending status.</p>
                    </div>
                )}
                
                {/* Employee Table */}
                <div className="ap-overflow-x-auto">
                    <table className="ap-w-full">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 ap-py-3 ap-text-left">
                                    <input
                                        type="checkbox"
                                        checked={filteredEmployees.length > 0 && selectedEmployees.size === filteredEmployees.length}
                                        onChange={handleSelectAll}
                                        className="ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                                    />
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Employee
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Roles
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Email
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Status
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Notes
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Invited
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-200">
                            {loadingEmployees ? (
                                <tr>
                                    <td colSpan={8} className="ap-px-4 ap-py-12 ap-text-center">
                                        <div className="ap-flex ap-flex-col ap-items-center ap-justify-center ap-gap-3">
                                            <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-500"></div>
                                            <p className="ap-text-gray-500">Loading employees...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="ap-px-4 ap-py-12 ap-text-center ap-text-gray-500">
                                        {!selectedSeasonId 
                                            ? 'Select a season to view employees'
                                            : searchTerm 
                                            ? 'No employees match your search'
                                            : `No employees in "${activeTab.replace('_', ' ')}" status`
                                        }
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map(employee => (
                                    <tr 
                                        key={employee.user_id}
                                        className={`hover:ap-bg-gray-50 ${selectedEmployees.has(employee.user_id) ? 'ap-bg-blue-50' : ''}`}
                                    >
                                        <td className="ap-px-4 ap-py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployees.has(employee.user_id)}
                                                onChange={() => handleToggleEmployee(employee.user_id)}
                                                className="ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                                            />
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-3">
                                                <div className="ap-w-10 ap-h-10 ap-rounded-full ap-bg-blue-50 ap-flex ap-items-center ap-justify-center">
                                                    <span className="ap-text-blue-600 ap-font-medium">
                                                        {employee.first_name?.[0]}{employee.last_name?.[0]}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="ap-font-medium ap-text-gray-900">{employee.display_name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-1.5">
                                                <div className="ap-flex ap-flex-wrap ap-gap-1 ap-flex-1">
                                                    {employee.job_roles && employee.job_roles.length > 0 ? (
                                                        employee.job_roles.map((role, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="ap-px-2 ap-py-0.5 ap-bg-purple-50 ap-text-purple-700 ap-rounded-full ap-text-xs ap-font-medium ap-whitespace-nowrap"
                                                            >
                                                                {role}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="ap-text-xs ap-text-gray-400 ap-italic">None</span>
                                                    )}
                                                </div>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditRoles(employee);
                                                    }}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 ap-text-gray-400 hover:ap-text-purple-600 ap-flex-shrink-0"
                                                    title="Edit job roles"
                                                >
                                                    <HiOutlinePencilSquare className="ap-w-4 ap-h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                            {employee.email}
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <StatusBadge status={employee.status} />
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-sm ap-text-gray-600 ap-max-w-xs ap-truncate" title={employee.comments || ''}>
                                            {employee.comments || '-'}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-sm ap-text-gray-500">
                                            {employee.created_at ? (
                                                <div>
                                                    <div>{new Date(employee.created_at).toLocaleDateString()}</div>
                                                    <div className="ap-text-xs ap-text-gray-400">
                                                        {new Date(employee.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="ap-text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right">
                                            {employee.invite_sent && (
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEmployees(new Set([employee.user_id]));
                                                        handleSendInvites();
                                                    }}
                                                    disabled={sending || !selectedTemplateId}
                                                    className="!ap-text-blue-600 hover:!ap-bg-blue-50 !ap-text-xs"
                                                    title="Resend invite to this employee"
                                                >
                                                    <HiOutlineArrowPath className="ap-w-3.5 ap-h-3.5" />
                                                    Resend
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Edit Job Roles Modal */}
            <Modal
                isOpen={!!editingRolesFor}
                onClose={() => setEditingRolesFor(null)}
                size="md"
            >
                <Modal.Header showCloseButton onClose={() => setEditingRolesFor(null)}>
                    <Modal.Title>Edit Job Roles</Modal.Title>
                    {editingRolesFor && (
                        <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                            {editingRolesFor.display_name}
                        </p>
                    )}
                </Modal.Header>
                
                <Modal.Body>
                    {loadingRoles ? (
                        <div className="ap-flex ap-justify-center ap-py-8">
                            <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-purple-500"></div>
                        </div>
                    ) : (
                        <div className="ap-space-y-4">
                            {/* Current roles */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Current Roles</label>
                                <div className="ap-flex ap-flex-wrap ap-gap-2">
                                    {userAssignments.length === 0 ? (
                                        <span className="ap-text-sm ap-text-gray-500 ap-italic">No roles assigned</span>
                                    ) : (
                                        userAssignments.map((assignment) => (
                                            <span
                                                key={assignment.id}
                                                className="ap-inline-flex ap-items-center ap-gap-1.5 ap-px-3 ap-py-1.5 ap-bg-purple-50 ap-text-purple-700 ap-rounded-full ap-text-sm ap-font-medium ap-border ap-border-purple-200"
                                            >
                                                {assignment.job_role_title}
                                                {assignment.tier !== undefined && (
                                                    <span className="ap-text-xs ap-text-purple-500">(T{assignment.tier})</span>
                                                )}
                                                <Button
                                                    onClick={() => handleRemoveRole(assignment)}
                                                    variant="ghost"
                                                    size="xs"
                                                    disabled={savingRole}
                                                    className="!ap-p-0.5 !ap-min-h-0 ap-text-purple-400 hover:ap-text-red-600"
                                                    title={`Remove ${assignment.job_role_title}`}
                                                >
                                                    <HiOutlineTrash className="ap-w-3.5 ap-h-3.5" />
                                                </Button>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            {/* Add new role */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Add Role</label>
                                <div className="ap-flex ap-gap-2 ap-items-center">
                                    <select
                                        value={selectedNewRoleId}
                                        onChange={(e) => setSelectedNewRoleId(e.target.value ? Number(e.target.value) : '')}
                                        className="ap-flex-1 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg ap-text-sm focus:ap-ring-2 focus:ap-ring-purple-500 focus:ap-border-transparent"
                                        disabled={savingRole}
                                    >
                                        <option value="">Select a role...</option>
                                        {allJobRoles
                                            .filter(role => !userAssignments.some(a => a.job_role_id === role.id))
                                            .map(role => (
                                                <option key={role.id} value={role.id}>
                                                    {role.title} (Tier {role.tier})
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <Button
                                        onClick={handleAddRole}
                                        disabled={savingRole || !selectedNewRoleId}
                                        size="sm"
                                        loading={savingRole}
                                        className="ap-whitespace-nowrap"
                                    >
                                        <HiOutlinePlus className="ap-w-4 ap-h-4" /> Add
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                
                <Modal.Footer>
                    <Button
                        onClick={() => setEditingRolesFor(null)}
                        variant="secondary"
                    >
                        Done
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

// Status Badge component
const StatusBadge: React.FC<{ status: EmployeeStatus | 'not_invited' }> = ({ status }) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        not_invited: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Not Invited' },
        pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
        returning: { bg: 'bg-green-100', text: 'text-green-700', label: 'Returning' },
        not_returning: { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Returning' },
        ineligible: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Ineligible' }
    };
    
    const { bg, text, label } = config[status] || config.not_invited;
    
    return (
        <span className={`ap-inline-flex ap-px-2.5 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
};

export default ReturnInviteManager;
