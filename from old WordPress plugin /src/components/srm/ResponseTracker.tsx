import React, { useState, useEffect, useMemo } from 'react';
import {
    getSeasons,
    getResponses,
    getResponsesWithRoleSummary,
    updateEmployeeStatus,
    getMyPermissions,
    getSeasonStats,
    getEmployeeSeasons,
    getEmployeeWorkYears,
    addEmployeeWorkYear,
    deleteEmployeeWorkYear,
    getProjectedPay,
    exportResponsesCsv,
    EmployeeWorkYear,
    JobRoleSummaryItem
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
    EmployeeSeason,
    SRMPermissions,
    EmployeeStatus,
    RetentionStats,
    ProjectedPayBreakdown
} from '@/types';
import {
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineMagnifyingGlass,
    HiOutlineChartBar,
    HiOutlinePencil,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineEye,
    HiOutlineCurrencyDollar,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineBriefcase,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineStar,
    HiOutlineArrowDownTray
} from 'react-icons/hi2';

const SRM_DEFAULT_SEASON_KEY = 'srm_default_season_id';

/** Read the stored default season ID as a number (or null if unset). */
function getDefaultSeasonId(): number | null {
    const raw = localStorage.getItem(SRM_DEFAULT_SEASON_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

import { Modal, Button, Select, Label, Checkbox, Input } from '../ui';

/**
 * ResponseTracker - View and manage employee return responses
 * 
 * Features:
 * - View all responses for a season
 * - Filter by status
 * - Manually update employee status
 * - View retention statistics
 */

type StatusTab = 'all' | 'returning' | 'not_returning' | 'pending';

const ResponseTracker: React.FC = () => {
    // Data state
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [responses, setResponses] = useState<EmployeeSeason[]>([]);
    const [stats, setStats] = useState<RetentionStats | null>(null);
    const [permissions, setPermissions] = useState<SRMPermissions | null>(null);
    
    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Selection state
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<StatusTab>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Edit modal state
    const [editingEmployee, setEditingEmployee] = useState<EmployeeSeason | null>(null);
    const [editStatus, setEditStatus] = useState<EmployeeStatus>('pending');
    const [editEligible, setEditEligible] = useState(true);
    const [saving, setSaving] = useState(false);
    const [employeeHistory, setEmployeeHistory] = useState<EmployeeSeason[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Work years state
    const [workYears, setWorkYears] = useState<EmployeeWorkYear[]>([]);
    const [loadingWorkYears, setLoadingWorkYears] = useState(false);
    const [newWorkYears, setNewWorkYears] = useState('');
    const [addingWorkYear, setAddingWorkYear] = useState(false);
    
    // Add to season state
    const [addToSeasonId, setAddToSeasonId] = useState<number | null>(null);
    const [addingToSeason, setAddingToSeason] = useState(false);

    // Retention Rate settings
    const [includePendingInRate, setIncludePendingInRate] = useState(true);
    
    // View Offer modal state
    const [viewingOffer, setViewingOffer] = useState<EmployeeSeason | null>(null);
    const [offerData, setOfferData] = useState<ProjectedPayBreakdown | null>(null);
    const [loadingOffer, setLoadingOffer] = useState(false);

    // Job Role Summary
    const [jobRoleSummary, setJobRoleSummary] = useState<JobRoleSummaryItem[]>([]);
    const [showRoleSummary, setShowRoleSummary] = useState(true);
    const [filterRole, setFilterRole] = useState<string>('');
    const [exporting, setExporting] = useState(false);

    // Job Role editing state (edit modal)
    const [allJobRoles, setAllJobRoles] = useState<PGJobRole[]>([]);
    const [userAssignments, setUserAssignments] = useState<UserJobAssignment[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [savingRole, setSavingRole] = useState(false);
    const [selectedNewRoleId, setSelectedNewRoleId] = useState<number | ''>('');

    const calculatedRetentionRate = useMemo(() => {
        if (!stats) return 0;
        
        const returning = stats.total_returning;
        const notReturning = stats.total_not_returning;
        const pending = stats.total_pending;
        
        // If including pending, the total pool is everyone who has responded OR is pending
        // If NOT including pending, the total pool is only valid responses (returning + not returning)
        const denominator = includePendingInRate 
            ? (returning + notReturning + pending)
            : (returning + notReturning);
            
        if (denominator === 0) return 0;
        
        return (returning / denominator) * 100;
    }, [stats, includePendingInRate]);
    
    useEffect(() => {
        loadInitialData();
    }, []);
    
    useEffect(() => {
        if (selectedSeasonId) {
            loadResponsesForSeason(selectedSeasonId);
        }
    }, [selectedSeasonId]);
    
    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [seasonsData, perms] = await Promise.all([
                getSeasons(),
                getMyPermissions()
            ]);
            
            setSeasons(seasonsData || []);
            setPermissions(perms);
            
            // Auto-select season: saved default > current season > first season
            const savedDefaultId = getDefaultSeasonId();
            const savedDefault = savedDefaultId ? seasonsData?.find(s => Number(s.id) === savedDefaultId) : null;
            const activeSeason = savedDefault || seasonsData?.find(s => s.is_current) || seasonsData?.[0];
            if (activeSeason) {
                setSelectedSeasonId(activeSeason.id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };
    
    const loadResponsesForSeason = async (seasonId: number) => {
        try {
            const [responseData, statsData] = await Promise.all([
                getResponsesWithRoleSummary(seasonId),
                getSeasonStats(seasonId)
            ]);
            
            setResponses(responseData.responses || []);
            setJobRoleSummary(responseData.job_role_summary || []);
            setStats(statsData);
        } catch (err: any) {
            console.error('Failed to load responses:', err);
        }
    };
    
    // Filter responses by tab and search
    const filteredResponses = useMemo(() => {
        let filtered = responses;
        
        // Filter by tab
        if (activeTab !== 'all') {
            filtered = filtered.filter(r => r.status === activeTab);
        }
        
        // Filter by job role
        if (filterRole) {
            filtered = filtered.filter(r => {
                if (!r.job_roles || r.job_roles.length === 0) {
                    return filterRole === 'unassigned';
                }
                return r.job_roles.some(role => role.title === filterRole);
            });
        }
        
        // Filter by search
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(r => {
                const name = r.user?.display_name?.toLowerCase() || '';
                const email = r.user?.email?.toLowerCase() || '';
                return name.includes(search) || email.includes(search);
            });
        }
        
        return filtered;
    }, [responses, activeTab, searchTerm, filterRole]);
    
    // Tab counts
    const tabCounts = useMemo(() => ({
        all: responses.length,
        returning: responses.filter(r => r.status === 'returning').length,
        not_returning: responses.filter(r => r.status === 'not_returning').length,
        pending: responses.filter(r => r.status === 'pending').length
    }), [responses]);
    
    const handleEditClick = async (employee: EmployeeSeason) => {
        setEditingEmployee(employee);
        setEditStatus(employee.status);
        setEditEligible(employee.eligible_for_rehire);
        setSelectedNewRoleId('');
        
        // Load employee season history
        setLoadingHistory(true);
        try {
            const history = await getEmployeeSeasons(employee.user_id);
            setEmployeeHistory(history);
        } catch (err) {
            console.error('Failed to load employee history:', err);
            setEmployeeHistory([]);
        } finally {
            setLoadingHistory(false);
        }
        
        // Load work years
        setLoadingWorkYears(true);
        try {
            const years = await getEmployeeWorkYears(employee.user_id);
            setWorkYears(years);
        } catch (err) {
            console.error('Failed to load work years:', err);
            setWorkYears([]);
        } finally {
            setLoadingWorkYears(false);
        }
        
        // Load job roles and current assignments
        setLoadingRoles(true);
        try {
            const [roles, assignments] = await Promise.all([
                fetchAllJobRoles(),
                getUserAssignments(employee.user_id),
            ]);
            setAllJobRoles(roles);
            setUserAssignments(assignments);
        } catch (err) {
            console.error('Failed to load job roles:', err);
            setAllJobRoles([]);
            setUserAssignments([]);
        } finally {
            setLoadingRoles(false);
        }
    };
    
    const handleAddRole = async () => {
        if (!editingEmployee || !selectedNewRoleId) return;
        
        setSavingRole(true);
        setError(null);
        
        try {
            await assignUserToRole({
                user_id: editingEmployee.user_id,
                job_role_id: Number(selectedNewRoleId),
            });
            
            // Refresh assignments
            const assignments = await getUserAssignments(editingEmployee.user_id);
            setUserAssignments(assignments);
            setSelectedNewRoleId('');
            
            // Refresh responses to update job role data in table and summary
            if (selectedSeasonId) {
                await loadResponsesForSeason(selectedSeasonId);
            }
            
            setSuccess('Job role assigned successfully');
        } catch (err: any) {
            setError(err.message || 'Failed to assign job role');
        } finally {
            setSavingRole(false);
        }
    };
    
    const handleRemoveRole = async (assignment: UserJobAssignment) => {
        if (!editingEmployee || !assignment.id) return;
        if (!confirm(`Remove "${assignment.job_role_title}" from ${editingEmployee.user?.display_name}?`)) return;
        
        setSavingRole(true);
        setError(null);
        
        try {
            await removeAssignment(assignment.id);
            
            // Refresh assignments
            const assignments = await getUserAssignments(editingEmployee.user_id);
            setUserAssignments(assignments);
            
            // Refresh responses to update job role data in table and summary
            if (selectedSeasonId) {
                await loadResponsesForSeason(selectedSeasonId);
            }
            
            setSuccess('Job role removed successfully');
        } catch (err: any) {
            setError(err.message || 'Failed to remove job role');
        } finally {
            setSavingRole(false);
        }
    };
    
    const handleViewOffer = async (employee: EmployeeSeason) => {
        if (!selectedSeasonId) return;
        
        setViewingOffer(employee);
        setLoadingOffer(true);
        setError(null);
        
        try {
            const result = await getProjectedPay(employee.user_id, selectedSeasonId);
            setOfferData(result.projected_pay);
        } catch (err: any) {
            console.error('Failed to load projected pay:', err);
            setError(err.message || 'Failed to load offer details');
            setOfferData(null);
        } finally {
            setLoadingOffer(false);
        }
    };
    
    const handleSaveEdit = async () => {
        if (!editingEmployee || !selectedSeasonId) return;
        
        setSaving(true);
        setError(null);
        
        try {
            await updateEmployeeStatus(editingEmployee.user_id, selectedSeasonId, {
                status: editStatus,
                eligible_for_rehire: editEligible
            });
            
            setSuccess('Employee status updated successfully');
            setEditingEmployee(null);
            
            // Reload data
            await loadResponsesForSeason(selectedSeasonId);
        } catch (err: any) {
            setError(err.message || 'Failed to update employee status');
        } finally {
            setSaving(false);
        }
    };
    
    const handleAddToSeason = async () => {
        if (!editingEmployee || !addToSeasonId) return;
        
        setAddingToSeason(true);
        setError(null);
        
        try {
            await updateEmployeeStatus(editingEmployee.user_id, addToSeasonId, {
                status: 'pending',
                eligible_for_rehire: true
            });
            
            setSuccess(`Added ${editingEmployee.user?.display_name} to season successfully`);
            setAddToSeasonId(null);
            
            // Reload employee history
            const history = await getEmployeeSeasons(editingEmployee.user_id);
            setEmployeeHistory(history);
            
            // If added to currently selected season, reload responses
            if (addToSeasonId === selectedSeasonId) {
                await loadResponsesForSeason(selectedSeasonId);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add employee to season');
        } finally {
            setAddingToSeason(false);
        }
    };

    const handleExportCsv = async () => {
        if (!selectedSeasonId) return;
        setExporting(true);
        try {
            const { csv, filename } = await exportResponsesCsv(selectedSeasonId);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            setError(err.message || 'Failed to export CSV');
        } finally {
            setExporting(false);
        }
    };
    
    const handleAddWorkYears = async () => {
        if (!editingEmployee || !newWorkYears) return;
        
        setAddingWorkYear(true);
        setError(null);
        
        try {
            const yearsInput = newWorkYears.trim();
            let yearsToAdd: number[] = [];
            
            if (yearsInput.includes('-')) {
                const [start, end] = yearsInput.split('-').map(y => parseInt(y.trim()));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let year = Math.min(start, end); year <= Math.max(start, end); year++) {
                        yearsToAdd.push(year);
                    }
                }
            } else if (yearsInput.includes(',')) {
                yearsToAdd = yearsInput.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
            } else {
                const year = parseInt(yearsInput);
                if (!isNaN(year)) {
                    yearsToAdd.push(year);
                }
            }
            
            if (yearsToAdd.length === 0) {
                setError('Please enter valid year(s)');
                return;
            }
            
            let added = 0;
            let skipped = 0;
            for (const year of yearsToAdd) {
                try {
                    await addEmployeeWorkYear(editingEmployee.user_id, year, 'Added via Response Tracker');
                    added++;
                } catch (err: any) {
                    if (err.message?.includes('already exists')) {
                        skipped++;
                    } else {
                        throw err;
                    }
                }
            }
            
            setNewWorkYears('');
            const years = await getEmployeeWorkYears(editingEmployee.user_id);
            setWorkYears(years);
            
            // Reload responses to get updated longevity data
            if (selectedSeasonId) {
                await loadResponsesForSeason(selectedSeasonId);
            }
            
            if (added > 0 && skipped > 0) {
                setSuccess(`Added ${added} year(s), skipped ${skipped} duplicate(s). Longevity updated.`);
            } else if (added > 0) {
                setSuccess(`Added ${added} year(s) successfully. Longevity updated.`);
            } else if (skipped > 0) {
                setSuccess(`All ${skipped} year(s) already exist`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add work years');
        } finally {
            setAddingWorkYear(false);
        }
    };
    
    const handleDeleteWorkYear = async (workYearId: number) => {
        if (!editingEmployee) return;
        if (!confirm('Remove this work year?')) return;
        
        try {
            await deleteEmployeeWorkYear(workYearId);
            const years = await getEmployeeWorkYears(editingEmployee.user_id);
            setWorkYears(years);
            
            // Reload responses to get updated longevity data
            if (selectedSeasonId) {
                await loadResponsesForSeason(selectedSeasonId);
            }
            
            setSuccess('Work year removed. Longevity updated.');
        } catch (err: any) {
            setError(err.message || 'Failed to remove work year');
        }
    };
    
    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }
    
    if (!permissions?.srm_view_responses) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-yellow-800">You don't have permission to view return responses.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="ap-p-6 ap-max-w-7xl ap-mx-auto">
            {/* Header */}
            <div className="ap-mb-6">
                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Response Tracker</h1>
                <p className="ap-text-gray-600 ap-mt-1">Track employee return responses and manage status</p>
            </div>
            
            {/* Alerts */}
            {error && (
                <div className="ap-mb-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div className="ap-flex-1">
                        <p className="ap-text-red-800">{error}</p>
                    </div>
                    <Button onClick={() => setError(null)} variant="ghost" size="xs" className="!ap-p-1.5 !ap-min-h-0 ap-text-red-500 hover:ap-text-red-700">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}
            
            {success && (
                <div className="ap-mb-4 ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div className="ap-flex-1">
                        <p className="ap-text-green-800">{success}</p>
                    </div>
                    <Button onClick={() => setSuccess(null)} variant="ghost" size="xs" className="!ap-p-1.5 !ap-min-h-0 ap-text-green-500 hover:ap-text-green-700">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}
            
            {/* Season Selector & Stats */}
            <div className="ap-grid md:ap-grid-cols-4 ap-gap-6 ap-mb-6">
                <div className="md:ap-col-span-1">
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
                    {selectedSeasonId && (
                        <div className="ap-mt-2 ap-flex ap-items-center ap-gap-2">
                            {Number(selectedSeasonId) === getDefaultSeasonId() ? (
                                <span className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-text-amber-600 ap-font-medium">
                                    <HiOutlineStar className="ap-w-3.5 ap-h-3.5 ap-fill-amber-400 ap-text-amber-500" />
                                    Default Season
                                </span>
                            ) : (
                                <button
                                    onClick={() => {
                                        localStorage.setItem(SRM_DEFAULT_SEASON_KEY, String(selectedSeasonId));
                                        setSuccess('Default season saved — this season will auto-select on future visits.');
                                        // Force re-render to update star indicator
                                        setSeasons([...seasons]);
                                    }}
                                    className="ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-text-gray-500 hover:ap-text-amber-600 ap-transition-colors"
                                    title="Set this season as your default"
                                >
                                    <HiOutlineStar className="ap-w-3.5 ap-h-3.5" />
                                    Set as Default
                                </button>
                            )}
                            {Number(selectedSeasonId) === getDefaultSeasonId() && (
                                <button
                                    onClick={() => {
                                        localStorage.removeItem(SRM_DEFAULT_SEASON_KEY);
                                        setSuccess('Default season cleared.');
                                        setSeasons([...seasons]);
                                    }}
                                    className="ap-text-xs ap-text-gray-400 hover:ap-text-red-500 ap-transition-colors"
                                    title="Clear default"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Stats Cards */}
                {stats && (
                    <>
                        <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4 ap-relative group">
                            <div className="ap-flex ap-items-center ap-gap-3">
                                <div className="ap-p-2 ap-bg-blue-50 ap-rounded-lg">
                                    <HiOutlineChartBar className="ap-w-6 ap-h-6 ap-text-blue-600" />
                                </div>
                                <div>
                                    <p className="ap-text-2xl ap-font-bold ap-text-blue-600">{calculatedRetentionRate.toFixed(1)}%</p>
                                    <p className="ap-text-sm ap-text-gray-500">Retention Rate</p>
                                </div>
                            </div>
                            
                            {/* Calculation Toggle */}
                            <div className="ap-mt-3 ap-pt-2 ap-border-t ap-border-gray-100">
                                <label className="ap-flex ap-items-center ap-gap-2 ap-text-xs ap-text-gray-600 ap-cursor-pointer ap-select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={includePendingInRate} 
                                        onChange={(e) => setIncludePendingInRate(e.target.checked)}
                                        className="ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500 ap-w-3 ap-h-3"
                                    />
                                    Include pending in calculation
                                </label>
                            </div>
                        </div>
                        
                        <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                            <div className="ap-flex ap-items-center ap-gap-3">
                                <div className="ap-p-2 ap-bg-green-100 ap-rounded-lg">
                                    <HiOutlineCheckCircle className="ap-w-6 ap-h-6 ap-text-green-600" />
                                </div>
                                <div>
                                    <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{stats.total_returning}</p>
                                    <p className="ap-text-sm ap-text-gray-500">Returning</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                            <div className="ap-flex ap-items-center ap-gap-3">
                                <div className="ap-p-2 ap-bg-yellow-100 ap-rounded-lg">
                                    <HiOutlineClock className="ap-w-6 ap-h-6 ap-text-yellow-600" />
                                </div>
                                <div>
                                    <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{stats.total_pending}</p>
                                    <p className="ap-text-sm ap-text-gray-500">Pending</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            {/* Job Role Summary */}
            {jobRoleSummary.length > 0 && (
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
                                    {jobRoleSummary.length} role{jobRoleSummary.length !== 1 ? 's' : ''} across {responses.length} employee{responses.length !== 1 ? 's' : ''}
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
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-green-600 ap-uppercase ap-tracking-wider">
                                                Returning
                                            </th>
                                            <th className="ap-py-2 ap-px-4 ap-text-center ap-text-xs ap-font-medium ap-text-yellow-600 ap-uppercase ap-tracking-wider">
                                                Pending
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
                                        {jobRoleSummary.map(item => {
                                            const fillRate = item.total > 0 
                                                ? Math.round((item.returning / item.total) * 100) 
                                                : 0;
                                            return (
                                                <tr 
                                                    key={item.role_id} 
                                                    className="hover:ap-bg-gray-50 ap-cursor-pointer ap-transition-colors"
                                                    onClick={() => setFilterRole(
                                                        filterRole === (item.role_id === 0 ? 'unassigned' : item.role_title) 
                                                        ? '' 
                                                        : (item.role_id === 0 ? 'unassigned' : item.role_title)
                                                    )}
                                                >
                                                    <td className="ap-py-3 ap-pr-4">
                                                        <div className="ap-flex ap-items-center ap-gap-2">
                                                            <span className={`ap-font-medium ${item.role_id === 0 ? 'ap-text-gray-400 ap-italic' : 'ap-text-gray-900'}`}>
                                                                {item.role_title}
                                                            </span>
                                                            {filterRole === (item.role_id === 0 ? 'unassigned' : item.role_title) && (
                                                                <span className="ap-px-1.5 ap-py-0.5 ap-bg-blue-100 ap-text-blue-700 ap-rounded ap-text-xs ap-font-medium">
                                                                    filtered
                                                                </span>
                                                            )}
                                                        </div>
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
                                                            item.pending > 0 ? 'ap-bg-yellow-100 ap-text-yellow-700' : 'ap-text-gray-300'
                                                        }`}>
                                                            {item.pending}
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
                                    {/* Totals row */}
                                    <tfoot>
                                        <tr className="ap-border-t-2 ap-border-gray-300 ap-bg-gray-50">
                                            <td className="ap-py-3 ap-pr-4 ap-font-bold ap-text-gray-900">
                                                Totals
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-green-700">
                                                {jobRoleSummary.reduce((sum, item) => sum + item.returning, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-yellow-700">
                                                {jobRoleSummary.reduce((sum, item) => sum + item.pending, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-red-700">
                                                {jobRoleSummary.reduce((sum, item) => sum + item.not_returning, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-px-4 ap-text-center ap-font-bold ap-text-gray-900">
                                                {jobRoleSummary.reduce((sum, item) => sum + item.total, 0)}
                                            </td>
                                            <td className="ap-py-3 ap-pl-4"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <p className="ap-mt-3 ap-text-xs ap-text-gray-500 ap-italic">
                                Click a row to filter the response table by that role. Employees with multiple roles are counted once per role.
                            </p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Response Table */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-md">
                {/* Tabs */}
                <div className="ap-border-b ap-border-gray-200">
                    <nav className="ap-flex -ap-mb-px">
                        {[
                            { id: 'all', label: 'All', count: tabCounts.all },
                            { id: 'returning', label: 'Returning', count: tabCounts.returning },
                            { id: 'not_returning', label: 'Not Returning', count: tabCounts.not_returning },
                            { id: 'pending', label: 'Pending', count: tabCounts.pending }
                        ].map(tab => (
                            <Button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as StatusTab)}
                                variant="ghost"
                                className={`!ap-rounded-none ap-px-6 ap-py-4 ap-text-sm ap-font-medium ap-border-b-2 ap-transition-colors ${
                                    activeTab === tab.id
                                        ? 'ap-border-blue-500 ap-text-blue-600' : 'ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700 hover:ap-border-gray-300'
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
                
                {/* Search + Role Filter */}
                <div className="ap-p-4 ap-border-b ap-border-gray-200">
                    <div className="ap-flex ap-flex-wrap ap-gap-4 ap-items-center">
                        <div className="ap-relative ap-flex-1 ap-min-w-[200px] ap-max-w-md">
                            <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-text-gray-400 ap-w-5 ap-h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>
                        <div className="ap-min-w-[180px]">
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-text-sm"
                            >
                                <option value="">All Job Roles</option>
                                {jobRoleSummary.map(item => (
                                    <option key={item.role_id} value={item.role_id === 0 ? 'unassigned' : item.role_title}>
                                        {item.role_title} ({item.total})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filterRole && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilterRole('')}
                                className="!ap-text-gray-500 hover:!ap-text-gray-700"
                            >
                                <HiOutlineXMark className="ap-w-4 ap-h-4" /> Clear filter
                            </Button>
                        )}
                        {/* Spacer to push export button right */}
                        <div className="ap-flex-1" />
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!selectedSeasonId || exporting}
                            onClick={handleExportCsv}
                            className="ap-whitespace-nowrap"
                        >
                            <HiOutlineArrowDownTray className="ap-w-4 ap-h-4 ap-mr-1" />
                            {exporting ? 'Exporting…' : 'Export CSV'}
                        </Button>
                    </div>
                </div>
                
                {/* Table */}
                <div className="ap-overflow-x-auto">
                    <table className="ap-w-full">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Employee
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Role
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Status
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Response Date
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Notes
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Eligible
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-200">
                            {filteredResponses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="ap-px-4 ap-py-12 ap-text-center ap-text-gray-500">
                                        {searchTerm || filterRole
                                            ? 'No responses match your filters' : 'No responses recorded yet'
                                        }
                                    </td>
                                </tr>
                            ) : (
                                filteredResponses.map(response => (
                                    <tr key={response.id} className="hover:ap-bg-gray-50">
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-3">
                                                <div className="ap-w-10 ap-h-10 ap-rounded-full ap-bg-blue-50 ap-flex ap-items-center ap-justify-center">
                                                    <span className="ap-text-blue-600 ap-font-medium">
                                                        {response.user?.first_name?.[0]}{response.user?.last_name?.[0]}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="ap-font-medium ap-text-gray-900">
                                                        {response.user?.display_name}
                                                    </p>
                                                    <p className="ap-text-sm ap-text-gray-500">{response.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                {response.job_roles && response.job_roles.length > 0 ? (
                                                    response.job_roles.map((role: any) => (
                                                        <span 
                                                            key={role.id} 
                                                            className="ap-px-2 ap-py-0.5 ap-bg-purple-50 ap-text-purple-700 ap-rounded-full ap-text-xs ap-font-medium ap-whitespace-nowrap"
                                                        >
                                                            {role.title}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="ap-text-xs ap-text-gray-400 ap-italic">None</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <StatusBadge status={response.status} />
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                            {response.response_date 
                                                ? new Date(response.response_date).toLocaleDateString()
                                                : '-'
                                            }
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-sm ap-text-gray-600 ap-min-w-[300px] ap-whitespace-pre-wrap">
                                            {response.comments || '-'}
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            {response.eligible_for_rehire ? (
                                                <span className="ap-text-green-600">Yes</span>
                                            ) : (
                                                <span className="ap-text-red-600">No</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                <Button
                                                    onClick={() => handleViewOffer(response)}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-green-600"
                                                    title="View Offer Details"
                                                >
                                                    <HiOutlineEye className="ap-w-5 ap-h-5" />
                                                </Button>
                                                {permissions?.srm_manage_status && (
                                                    <Button
                                                        onClick={() => handleEditClick(response)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-blue-600"
                                                        title="Edit employee"
                                                    >
                                                        <HiOutlinePencil className="ap-w-5 ap-h-5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Edit Modal */}
            <Modal 
                isOpen={!!editingEmployee} 
                onClose={() => setEditingEmployee(null)}
                size="lg"
            >
                <Modal.Header showCloseButton onClose={() => setEditingEmployee(null)}>
                    <Modal.Title>Edit Employee Status</Modal.Title>
                    {editingEmployee && (
                        <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                            {editingEmployee.user?.display_name}
                        </p>
                    )}
                </Modal.Header>
                
                <Modal.Body>
                    <div className="ap-space-y-4">
                        <div>
                            <Label htmlFor="return-status">Return Status</Label>
                            <Select
                                id="return-status"
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as EmployeeStatus)}
                            >
                                <option value="pending">Pending</option>
                                <option value="returning">Returning</option>
                                <option value="not_returning">Not Returning</option>
                                <option value="ineligible">Ineligible</option>
                            </Select>
                        </div>
                        
                        {editingEmployee?.comments && (
                            <div className="ap-bg-gray-50 ap-p-3 ap-rounded-md ap-border ap-border-gray-200">
                                <span className="ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Employee Note</span>
                                <p className="ap-text-sm ap-text-gray-800 ap-mt-1">{editingEmployee.comments}</p>
                            </div>
                        )}

                        <Checkbox
                            id="eligible"
                            checked={editEligible}
                            onChange={(e) => setEditEligible(e.target.checked)}
                            label="Eligible for rehire"
                        />
                        
                        {/* Job Roles */}
                        <div className="ap-pt-4 ap-border-t">
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Job Roles</h4>
                            {loadingRoles ? (
                                <div className="ap-flex ap-justify-center ap-py-4">
                                    <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-purple-500"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Current assignments */}
                                    <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-3">
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
                                    
                                    {/* Add new role */}
                                    <div className="ap-flex ap-gap-2 ap-items-center">
                                        <select
                                            value={selectedNewRoleId}
                                            onChange={(e) => setSelectedNewRoleId(e.target.value ? Number(e.target.value) : '')}
                                            className="ap-flex-1 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg ap-text-sm focus:ap-ring-2 focus:ap-ring-purple-500 focus:ap-border-transparent"
                                            disabled={savingRole}
                                        >
                                            <option value="">Add a role...</option>
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
                                </>
                            )}
                        </div>
                        
                        {/* Season History */}
                        <div className="ap-pt-4 ap-border-t">
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Season History</h4>
                            {loadingHistory ? (
                                <div className="ap-flex ap-justify-center ap-py-4">
                                    <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-blue-500"></div>
                                </div>
                            ) : employeeHistory.length > 0 ? (
                                <div className="ap-space-y-2 ap-max-h-48 ap-overflow-y-auto">
                                    {employeeHistory.map((season) => (
                                        <div key={season.id} className="ap-flex ap-items-center ap-justify-between ap-text-sm ap-p-2 ap-bg-gray-50 ap-rounded">
                                            <div>
                                                <div className="ap-font-medium ap-text-gray-900">{season.season_name}</div>
                                                {season.start_date && season.end_date && (
                                                    <div className="ap-text-xs ap-text-gray-500">
                                                        {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ap-text-right">
                                                <StatusBadge status={season.status} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="ap-text-sm ap-text-gray-500 ap-italic">No season history available</p>
                            )}
                        </div>
                        
                        {/* Work Years */}
                        <div className="ap-pt-4 ap-border-t">
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Work Years</h4>
                            {loadingWorkYears ? (
                                <div className="ap-flex ap-justify-center ap-py-4">
                                    <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-blue-500"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-3">
                                        {workYears.length === 0 ? (
                                            <span className="ap-text-sm ap-text-gray-500 ap-italic">No work years recorded</span>
                                        ) : (
                                            workYears.sort((a, b) => a.work_year - b.work_year).map((wy) => (
                                                <span
                                                    key={wy.id}
                                                    className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-rounded-full ap-text-sm ${
                                                        wy.verified ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-gray-100 ap-text-gray-800'
                                                    }`}
                                                >
                                                    {wy.work_year}
                                                    {wy.verified && <HiOutlineCheckCircle className="ap-w-3 ap-h-3" />}
                                                    <Button
                                                        onClick={() => handleDeleteWorkYear(wy.id)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="!ap-p-0.5 !ap-min-h-0 ap-ml-1 ap-text-red-600 hover:ap-text-red-800"
                                                        title="Remove year"
                                                    >
                                                        <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                    </Button>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                    <div className="ap-flex ap-gap-2">
                                        <Input
                                            type="text"
                                            value={newWorkYears}
                                            onChange={(e) => setNewWorkYears(e.target.value)}
                                            placeholder="e.g., 2024 or 2020-2024"
                                            size="sm"
                                            className="ap-flex-1"
                                        />
                                        <Button
                                            onClick={handleAddWorkYears}
                                            disabled={addingWorkYear || !newWorkYears}
                                            size="sm"
                                            loading={addingWorkYear}
                                        >
                                            Add Year(s)
                                        </Button>
                                    </div>
                                    <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                        Enter: single year (2024), range (2020-2024), or comma-separated (2020,2022,2024)
                                    </p>
                                </>
                            )}
                        </div>
                        
                        {/* Add to Another Season */}
                        <div className="ap-pt-4 ap-border-t">
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Add to Another Season</h4>
                            <Select
                                value={addToSeasonId?.toString() || ''}
                                onChange={(e) => setAddToSeasonId(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">Select a season...</option>
                                {seasons
                                    .filter(s => !employeeHistory.some(h => h.season_id === s.id))
                                    .map(season => (
                                        <option key={season.id} value={season.id}>
                                            {season.name}
                                        </option>
                                    ))
                                }
                            </Select>
                            {addToSeasonId && (
                                <Button
                                    onClick={handleAddToSeason}
                                    disabled={addingToSeason}
                                    variant="success"
                                    fullWidth
                                    className="ap-mt-3"
                                    loading={addingToSeason}
                                >
                                    Add to Selected Season
                                </Button>
                            )}
                            <p className="ap-mt-2 ap-text-xs ap-text-gray-500">
                                Only seasons the employee is not already part of are shown.
                            </p>
                        </div>
                    </div>
                </Modal.Body>
                
                <Modal.Footer>
                    <Button
                        onClick={() => setEditingEmployee(null)}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        loading={saving}
                    >
                        Save Changes
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* View Offer Modal */}
            {viewingOffer && (
            <Modal 
                isOpen={true} 
                onClose={() => setViewingOffer(null)}
                size="lg"
            >
                <Modal.Header showCloseButton onClose={() => setViewingOffer(null)}>
                    <Modal.Title>Return Offer Details</Modal.Title>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                        {viewingOffer.user?.display_name}
                    </p>
                </Modal.Header>
                
                <Modal.Body>
                    {loadingOffer ? (
                        <div className="ap-flex ap-justify-center ap-py-12">
                            <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
                        </div>
                    ) : offerData ? (
                        <div className="ap-space-y-6">
                            {/* Season Info */}
                            <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4 ap-border ap-border-blue-200">
                                <h3 className="ap-text-lg ap-font-semibold ap-text-blue-900 ap-mb-2">
                                    {offerData.season_name}
                                </h3>
                                <p className="ap-text-sm ap-text-blue-700">
                                    Projected as of {new Date(offerData.projection_date).toLocaleDateString()}
                                </p>
                            </div>
                            
                            {/* Job Roles */}
                            <div>
                                <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Position Offered</h4>
                                <div className="ap-flex ap-flex-wrap ap-gap-2">
                                    {viewingOffer.job_roles && viewingOffer.job_roles.length > 0
                                        ? viewingOffer.job_roles.map((role: any) => (
                                            <span key={role.id} className="ap-px-3 ap-py-1 ap-bg-purple-100 ap-text-purple-700 ap-rounded-full ap-text-sm ap-font-medium">
                                                {role.title}
                                            </span>
                                        ))
                                        : <span className="ap-text-gray-500 ap-italic">No roles assigned</span>
                                    }
                                </div>
                            </div>
                            
                            {/* Pay Rate Breakdown */}
                            <div className="ap-bg-gradient-to-br ap-from-green-50 ap-to-emerald-50 ap-rounded-lg ap-p-6 ap-border ap-border-green-200">
                                <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
                                    <HiOutlineCurrencyDollar className="ap-w-6 ap-h-6 ap-text-green-600" />
                                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Projected Pay Rate</h3>
                                </div>
                                
                                <div className="ap-space-y-3">
                                    {/* Base Rate */}
                                    <div className="ap-flex ap-justify-between ap-items-center">
                                        <span className="ap-text-gray-700">Base Rate</span>
                                        <span className="ap-font-semibold ap-text-gray-900">${offerData.base_rate.toFixed(2)}/hr</span>
                                    </div>
                                    
                                    {/* Role Bonus */}
                                    {offerData.role_bonus && offerData.role_bonus.amount > 0 && (
                                        <div className="ap-flex ap-justify-between ap-items-center ap-pl-4 ap-border-l-2 ap-border-purple-300">
                                            <div>
                                                <span className="ap-text-gray-700">Role Bonus</span>
                                                <p className="ap-text-xs ap-text-gray-500">{offerData.role_bonus.role_title}</p>
                                            </div>
                                            <span className="ap-font-semibold ap-text-purple-600">+${offerData.role_bonus.amount.toFixed(2)}/hr</span>
                                        </div>
                                    )}
                                    
                                    {/* Longevity Bonus */}
                                    {offerData.longevity && offerData.longevity.bonus > 0 && (
                                        <div className="ap-flex ap-justify-between ap-items-center ap-pl-4 ap-border-l-2 ap-border-blue-300">
                                            <div>
                                                <span className="ap-text-gray-700">Longevity Bonus</span>
                                                <p className="ap-text-xs ap-text-gray-500">
                                                    {offerData.longevity.current_years} → {offerData.longevity.projected_years} years
                                                </p>
                                            </div>
                                            <span className="ap-font-semibold ap-text-blue-600">+${offerData.longevity.bonus.toFixed(2)}/hr</span>
                                        </div>
                                    )}
                                    
                                    {/* Time Bonuses */}
                                    {offerData.time_bonuses && offerData.time_bonuses.length > 0 && (
                                        <div className="ap-space-y-2 ap-pl-4 ap-border-l-2 ap-border-amber-300">
                                            <span className="ap-text-gray-700 ap-text-sm ap-font-medium">Time-Based Bonuses</span>
                                            {offerData.time_bonuses.map((bonus, idx) => (
                                                <div key={idx} className="ap-flex ap-justify-between ap-items-center ap-text-sm">
                                                    <span className="ap-text-gray-600">{bonus.name}</span>
                                                    <span className="ap-font-medium ap-text-amber-600">+${bonus.amount.toFixed(2)}/hr</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="ap-h-px ap-bg-green-300 ap-my-4"></div>
                                    
                                    {/* Total */}
                                    <div className="ap-flex ap-justify-between ap-items-center">
                                        <span className="ap-text-lg ap-font-bold ap-text-gray-900">Total Hourly Rate</span>
                                        <span className="ap-text-2xl ap-font-bold ap-text-green-600">${offerData.total.toFixed(2)}/hr</span>
                                    </div>
                                    
                                    {/* Pay Cap Warning */}
                                    {offerData.is_capped && (
                                        <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded ap-p-3 ap-mt-3">
                                            <p className="ap-text-sm ap-text-yellow-800">
                                                ⚠️ Pay rate capped at ${offerData.pay_cap.toFixed(2)}/hr
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Calculation Notes */}
                            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4 ap-text-sm ap-text-gray-600">
                                <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2">How is this calculated?</h4>
                                <ul className="ap-space-y-1 ap-ml-4 ap-list-disc">
                                    <li>Base rate from season pay configuration</li>
                                    <li>Role bonuses from assigned job roles</li>
                                    <li>Longevity increases by +1 year when added to new season</li>
                                    <li>Time-based bonuses (if applicable)</li>
                                    <li>Subject to pay cap limits (if configured)</li>
                                </ul>
                                <p className="ap-mt-3 ap-text-xs ap-text-gray-500 ap-italic">
                                    Note: If you add this employee to a new season, their work years will increase by 1, 
                                    which may increase their longevity bonus for future seasons.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="ap-text-center ap-py-8 ap-text-gray-500">
                            Unable to load offer details
                        </div>
                    )}
                </Modal.Body>
                
                <Modal.Footer>
                    <Button onClick={() => setViewingOffer(null)} variant="secondary">
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
            )}
        </div>
    );
};

// Status Badge component
const StatusBadge: React.FC<{ status: EmployeeStatus }> = ({ status }) => {
    const config: Record<EmployeeStatus, { bg: string; text: string; label: string }> = {
        pending: { bg: 'ap-bg-yellow-100', text: 'ap-text-yellow-700', label: 'Pending' },
        returning: { bg: 'ap-bg-green-100', text: 'ap-text-green-700', label: 'Returning' },
        not_returning: { bg: 'ap-bg-red-100', text: 'ap-text-red-700', label: 'Not Returning' },
        ineligible: { bg: 'ap-bg-gray-100', text: 'ap-text-gray-500', label: 'Ineligible' }
    };
    
    const { bg, text, label } = config[status] || config.pending;
    
    return (
        <span className={`ap-inline-flex ap-px-2.5 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
};

export default ResponseTracker;
