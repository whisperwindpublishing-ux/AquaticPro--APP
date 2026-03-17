import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui';
import { 
    getMyPermissions,
    getAllEmployeePay,
    bulkUpdateEmployees,
    advanceLongevity,
    removeWorkYearBulk
} from '@/services/seasonalReturnsService';
import { 
    EmployeePayData,
    SRMPermissions
} from '@/types';
import { 
    HiOutlineMagnifyingGlass,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineUserGroup,
    HiOutlineCheckCircle,
    HiOutlineXMark,
    HiOutlineClock,
    HiOutlineBriefcase,
    HiOutlineArrowPath,
    HiOutlineExclamationTriangle,
    HiOutlineArrowTrendingUp
} from 'react-icons/hi2';

interface JobRole {
    id: number;
    title: string;
    tier: number;
}

interface BulkAction {
    type: 'add_year' | 'remove_year' | 'job_role' | 'remove_role';
    value: number | number[];
}

/**
 * EmployeeBulkManager - Bulk operations for employee pay configuration
 * 
 * Features:
 * - Select multiple employees via checkboxes
 * - Select all / deselect all
 * - Search and filter by name/role
 * - Bulk assign longevity years
 * - Bulk assign/remove job roles
 * - Preview changes before applying
 */
const EmployeeBulkManager: React.FC = () => {
    const [employees, setEmployees] = useState<EmployeePayData[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [permissions, setPermissions] = useState<SRMPermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    
    // Search and filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    const [filterLongevity, setFilterLongevity] = useState<string>('');
    const [showArchived, setShowArchived] = useState(false);
    
    // Sorting
    const [sortField, setSortField] = useState<'name' | 'longevity' | 'role' | 'pay'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    
    // Bulk action modal
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
    const [applying, setApplying] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null);
    
    // Advance longevity
    const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
    const [advancingLongevity, setAdvancingLongevity] = useState(false);
    const [advanceResult, setAdvanceResult] = useState<{ updated: number; message: string } | null>(null);
    const [selectedWorkYear, setSelectedWorkYear] = useState<number>(new Date().getFullYear());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [perms, employeesData, rolesResponse] = await Promise.all([
                getMyPermissions(),
                getAllEmployeePay(),
                fetch('/wp-json/mentorship-platform/v1/pg/job-roles', { 
                    credentials: 'include',
                    headers: { 'X-WP-Nonce': window.mentorshipPlatformData?.nonce || '' }
                }).then(r => r.json())
            ]);
            
            setPermissions(perms);
            setEmployees(employeesData || []);
            setJobRoles(rolesResponse?.roles || rolesResponse || []);
        } catch (err: any) {
            console.error('Failed to load employee data:', err);
            setError(err.message || 'Failed to load employee data');
        } finally {
            setLoading(false);
        }
    };

    // Get unique values for filters
    const filterOptions = useMemo(() => {
        const roles = new Set<string>();
        const longevityYears = new Set<number>();
        
        employees.forEach(emp => {
            if (emp.pay_breakdown?.role_bonus?.role_name) {
                roles.add(emp.pay_breakdown.role_bonus.role_name);
            }
            if (emp.pay_breakdown?.longevity?.years !== undefined) {
                longevityYears.add(emp.pay_breakdown.longevity.years);
            }
        });
        
        return {
            roles: Array.from(roles).sort(),
            longevityYears: Array.from(longevityYears).sort((a, b) => a - b)
        };
    }, [employees]);

    // Filter and sort employees
    const filteredEmployees = useMemo(() => {
        let filtered = [...employees];

        // Archived filter (hide archived by default)
        if (!showArchived) {
            filtered = filtered.filter(emp => !emp.is_archived);
        }

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(emp => 
                emp.display_name?.toLowerCase().includes(search) ||
                emp.pay_breakdown?.role_bonus?.role_name?.toLowerCase().includes(search)
            );
        }

        // Role filter
        if (filterRole) {
            filtered = filtered.filter(emp => 
                emp.pay_breakdown?.role_bonus?.role_name === filterRole
            );
        }

        // Longevity filter
        if (filterLongevity !== '') {
            const years = parseInt(filterLongevity);
            filtered = filtered.filter(emp => 
                emp.pay_breakdown?.longevity?.years === years
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';

            switch (sortField) {
                case 'name':
                    // Sort by last name, then first name
                    const aLast = (a.last_name || '').toLowerCase();
                    const bLast = (b.last_name || '').toLowerCase();
                    const lastCmp = aLast.localeCompare(bLast);
                    if (lastCmp !== 0) {
                        aVal = aLast;
                        bVal = bLast;
                    } else {
                        aVal = (a.first_name || '').toLowerCase();
                        bVal = (b.first_name || '').toLowerCase();
                    }
                    break;
                case 'longevity':
                    // Sort by actual work years logged (count of years in database)
                    aVal = a.pay_breakdown?.longevity?.work_years_logged ?? a.pay_breakdown?.longevity?.work_years_list?.length ?? 0;
                    bVal = b.pay_breakdown?.longevity?.work_years_logged ?? b.pay_breakdown?.longevity?.work_years_list?.length ?? 0;
                    break;
                case 'role':
                    aVal = (a.pay_breakdown?.role_bonus?.role_name || '').toLowerCase();
                    bVal = (b.pay_breakdown?.role_bonus?.role_name || '').toLowerCase();
                    break;
                case 'pay':
                    aVal = a.pay_breakdown?.total ?? 0;
                    bVal = b.pay_breakdown?.total ?? 0;
                    break;
            }

            if (typeof aVal === 'string') {
                const cmp = aVal.localeCompare(bVal as string);
                return sortDirection === 'asc' ? cmp : -cmp;
            } else {
                return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
            }
        });

        return filtered;
    }, [employees, searchTerm, filterRole, filterLongevity, sortField, sortDirection, showArchived]);

    // Selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEmployees.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEmployees.map(e => e.user_id)));
        }
    };

    const toggleSelect = (userId: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedIds(newSelected);
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon: React.FC<{ field: typeof sortField }> = ({ field }) => {
        if (sortField !== field) {
            return <span className="ap-text-gray-400 ap-ml-1">↕</span>;
        }
        return sortDirection === 'asc' 
            ? <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-ml-1 ap-inline" />
            : <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-ml-1 ap-inline" />;
    };

    // Open bulk action modal
    const openBulkAction = (type: BulkAction['type']) => {
        const defaultYear = new Date().getFullYear();
        setBulkAction({ 
            type, 
            value: type === 'job_role' ? [] : defaultYear 
        });
        setShowBulkModal(true);
        setBulkResult(null);
    };

    // Apply bulk action
    const applyBulkAction = async () => {
        if (!bulkAction || selectedIds.size === 0) return;
        
        setApplying(true);
        setBulkResult(null);
        
        try {
            if (bulkAction.type === 'add_year') {
                // Use advanceLongevity with specific user_ids and year
                const result = await advanceLongevity({ 
                    addYear: bulkAction.value as number,
                    userIds: Array.from(selectedIds)
                });
                
                setBulkResult({
                    success: result.updated_count,
                    failed: result.skipped_count
                });
            } else if (bulkAction.type === 'remove_year') {
                // Use removeWorkYearBulk with user_ids and year
                const result = await removeWorkYearBulk(
                    bulkAction.value as number,
                    Array.from(selectedIds)
                );
                
                setBulkResult({
                    success: result.removed_count,
                    failed: 0
                });
            } else {
                // Legacy job role actions
                const data = await bulkUpdateEmployees(
                    Array.from(selectedIds),
                    bulkAction.type,
                    bulkAction.value
                );
                
                setBulkResult({
                    success: data.success_count || selectedIds.size,
                    failed: data.failed_count || 0
                });
            }
            
            // Reload data to show updates
            await loadData();
            
            // Clear selection after successful update
            setSelectedIds(new Set());
        } catch (err: any) {
            console.error('Bulk update failed:', err);
            setBulkResult({
                success: 0,
                failed: selectedIds.size
            });
        } finally {
            setApplying(false);
        }
    };

    // Advance all employees' longevity by adding a specific work year
    const handleAdvanceLongevity = async () => {
        setAdvancingLongevity(true);
        setAdvanceResult(null);
        
        try {
            const result = await advanceLongevity({ addYear: selectedWorkYear });
            setAdvanceResult({
                updated: result.updated_count,
                message: result.message
            });
            
            // Reload data to show updates
            await loadData();
            
            // Hide confirm dialog after a short delay
            setTimeout(() => {
                setShowAdvanceConfirm(false);
            }, 2000);
        } catch (err: any) {
            console.error('Add work year failed:', err);
            setAdvanceResult({
                updated: 0,
                message: err.message || 'Failed to add work year'
            });
        } finally {
            setAdvancingLongevity(false);
        }
    };

    const formatCurrency = (amount: number | undefined | null): string => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${amount.toFixed(2)}`;
    };

    // Permission check
    if (!permissions?.srm_manage_pay_config && !loading) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-yellow-800">You don't have permission to manage employee pay settings.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-red-800">{error}</p>
                    <Button 
                        variant="link"
                        onClick={loadData}
                        className="!ap-mt-2 !ap-text-red-600 hover:!ap-text-red-800 !ap-p-0"
                    >
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-p-8">
            {/* Header */}
            <div className="ap-mb-6">
                <div className="ap-flex ap-items-center ap-justify-between">
                    <div>
                        <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineUserGroup className="ap-w-7 ap-h-7 ap-text-blue-600" />
                            Employee Pay Management
                        </h1>
                        <p className="ap-text-gray-600 ap-mt-1">
                            Select employees to bulk update longevity years and job roles
                        </p>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="primary"
                            onClick={() => setShowAdvanceConfirm(true)}
                            className="!ap-bg-purple-600 hover:!ap-bg-purple-700"
                        >
                            <HiOutlineArrowTrendingUp className="ap-w-5 ap-h-5" />
                            Add Work Year
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={loadData}
                        >
                            <HiOutlineArrowPath className="ap-w-5 ap-h-5" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Advance Longevity Confirmation */}
            {showAdvanceConfirm && (
                <div className="ap-bg-purple-50 ap-border ap-border-purple-200 ap-rounded-lg ap-p-4 ap-mb-6">
                    <div className="ap-flex ap-items-start ap-gap-3">
                        <HiOutlineArrowTrendingUp className="ap-w-6 ap-h-6 ap-text-purple-600 ap-flex-shrink-0 ap-mt-0.5" />
                        <div className="ap-flex-1">
                            <h3 className="ap-font-semibold ap-text-purple-900">Add Work Year to All Employees</h3>
                            <p className="ap-text-purple-700 ap-text-sm ap-mt-1">
                                This will add the selected year to all employees' work history, indicating they worked that season.
                                Employees who already have this year recorded will be skipped.
                            </p>
                            
                            <div className="ap-mt-3 ap-flex ap-items-center ap-gap-3">
                                <label className="ap-text-sm ap-font-medium ap-text-purple-800">Year to add:</label>
                                <select
                                    value={selectedWorkYear}
                                    onChange={e => setSelectedWorkYear(parseInt(e.target.value))}
                                    className="ap-border ap-border-purple-300 ap-rounded-lg ap-px-3 ap-py-1.5 ap-bg-white ap-text-purple-900 ap-font-medium focus:ap-ring-2 focus:ap-ring-purple-500"
                                    disabled={advancingLongevity}
                                >
                                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {advanceResult && (
                                <div className={`ap-mt-3 ap-p-3 ap-rounded-lg ${advanceResult.updated > 0 ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-yellow-100 ap-text-yellow-800'}`}>
                                    {advanceResult.message}
                                </div>
                            )}
                            
                            <div className="ap-mt-4 ap-flex ap-gap-3">
                                <Button
                                    variant="primary"
                                    onClick={handleAdvanceLongevity}
                                    disabled={advancingLongevity}
                                    className="!ap-bg-purple-600 hover:!ap-bg-purple-700"
                                >
                                    {advancingLongevity ? (
                                        <>
                                            <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-white"></div>
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                                            Add {selectedWorkYear} to All
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setShowAdvanceConfirm(false);
                                        setAdvanceResult(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search, Filter, and Bulk Actions Bar */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-4 ap-mb-6">
                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-4">
                    {/* Search */}
                    <div className="ap-relative ap-flex-1 ap-min-w-[200px]">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or role..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    >
                        <option value="">All Roles</option>
                        {filterOptions.roles.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>

                    {/* Longevity Filter */}
                    <select
                        value={filterLongevity}
                        onChange={e => setFilterLongevity(e.target.value)}
                        className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    >
                        <option value="">All Years</option>
                        {filterOptions.longevityYears.map(years => (
                            <option key={years} value={years}>
                                {years === 1 ? '1st year' : years === 2 ? '2nd year' : years === 3 ? '3rd year' : `${years}th year`}
                            </option>
                        ))}
                    </select>

                    {/* Archived Filter */}
                    <label className="ap-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-text-sm ap-text-gray-700 ap-cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={e => setShowArchived(e.target.checked)}
                            className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                        />
                        <span>Show archived</span>
                    </label>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="ap-flex ap-items-center ap-gap-2 ap-ml-auto">
                            <span className="ap-text-sm ap-text-gray-600 ap-font-medium">
                                {selectedIds.size} selected
                            </span>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openBulkAction('add_year')}
                                className="!ap-bg-purple-600 hover:!ap-bg-purple-700"
                            >
                                <HiOutlineClock className="ap-w-4 ap-h-4" />
                                Add Work Year
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openBulkAction('remove_year')}
                                className="!ap-bg-red-600 hover:!ap-bg-red-700"
                            >
                                <HiOutlineClock className="ap-w-4 ap-h-4" />
                                Remove Year
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openBulkAction('job_role')}
                                className="!ap-bg-green-600 hover:!ap-bg-green-700"
                            >
                                <HiOutlineBriefcase className="ap-w-4 ap-h-4" />
                                Assign Role
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Inline Bulk Action Form - appears when a bulk action is selected */}
            {showBulkModal && bulkAction && (
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-mb-6">
                    <div className="ap-flex ap-items-start ap-justify-between ap-mb-4">
                        <div className="ap-flex ap-items-center ap-gap-3">
                            {bulkAction.type === 'add_year' && (
                                <>
                                    <div className="ap-w-10 ap-h-10 ap-rounded-lg ap-bg-purple-100 ap-flex ap-items-center ap-justify-center">
                                        <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Add Work Year</h3>
                                        <p className="ap-text-sm ap-text-gray-500">
                                            Apply to {selectedIds.size} selected employee{selectedIds.size !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </>
                            )}
                            {bulkAction.type === 'remove_year' && (
                                <>
                                    <div className="ap-w-10 ap-h-10 ap-rounded-lg ap-bg-red-100 ap-flex ap-items-center ap-justify-center">
                                        <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Remove Work Year</h3>
                                        <p className="ap-text-sm ap-text-gray-500">
                                            Remove from {selectedIds.size} selected employee{selectedIds.size !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </>
                            )}
                            {bulkAction.type === 'job_role' && (
                                <>
                                    <div className="ap-w-10 ap-h-10 ap-rounded-lg ap-bg-green-100 ap-flex ap-items-center ap-justify-center">
                                        <HiOutlineBriefcase className="ap-w-5 ap-h-5 ap-text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Assign Job Role</h3>
                                        <p className="ap-text-sm ap-text-gray-500">
                                            Apply to {selectedIds.size} selected employee{selectedIds.size !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setShowBulkModal(false)}
                            className="!ap-p-1.5 !ap-min-h-0 !ap-rounded-full"
                        >
                            <HiOutlineXMark className="ap-w-5 ap-h-5" />
                        </Button>
                    </div>

                    <div className="ap-flex ap-items-end ap-gap-4">
                        {(bulkAction.type === 'add_year' || bulkAction.type === 'remove_year') && (
                            <div className="ap-flex-1 ap-max-w-xs">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    {bulkAction.type === 'add_year' ? 'Year ap-to Add' : 'Year ap-to Remove'}
                                </label>
                                <select
                                    value={bulkAction.value as number}
                                    onChange={e => setBulkAction({ ...bulkAction, value: parseInt(e.target.value) })}
                                    className={`ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 ${
                                        bulkAction.type === 'add_year' 
                                            ? 'focus:ap-ring-purple-500 focus:ap-border-purple-500' : 'focus:ap-ring-red-500 focus:ap-border-red-500'
                                    }`}
                                >
                                    {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                    {bulkAction.type === 'add_year' 
                                        ? 'This will add the selected year to each employee\'s work history'
                                        : 'This will remove the selected year from each employee\'s work history'
                                    }
                                </p>
                            </div>
                        )}

                        {bulkAction.type === 'job_role' && (
                            <div className="ap-flex-1 ap-max-w-xs">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Job Role to Assign
                                </label>
                                <select
                                    value={(bulkAction.value as number[])[0] || ''}
                                    onChange={e => setBulkAction({ ...bulkAction, value: [parseInt(e.target.value)] })}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-green-500 focus:ap-border-green-500"
                                >
                                    <option value="">Select a role...</option>
                                    {jobRoles.map(role => (
                                        <option key={role.id} value={role.id}>
                                            {role.title} (Tier {role.tier})
                                        </option>
                                    ))}
                                </select>
                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                    This will add the role to each employee. Existing roles are preserved.
                                </p>
                            </div>
                        )}

                        <div className="ap-flex ap-items-center ap-gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setShowBulkModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={applyBulkAction}
                                disabled={applying || (bulkAction.type === 'job_role' && !(bulkAction.value as number[])[0])}
                                className={`${
                                    bulkAction.type === 'add_year'
                                        ? '!ap-bg-purple-600 hover:!ap-bg-purple-700'
                                        : bulkAction.type === 'remove_year'
                                        ? '!ap-bg-red-600 hover:!ap-bg-red-700' : '!ap-bg-green-600 hover:!ap-bg-green-700'
                                }`}
                            >
                                {applying ? (
                                    <>
                                        <div className="ap-w-4 ap-h-4 ap-border-2 ap-border-white/30 ap-border-t-white ap-rounded-full ap-animate-spin" />
                                        {bulkAction.type === 'remove_year' ? 'Removing...' : 'Applying...'}
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                        {bulkAction.type === 'add_year' && 'Add Year'}
                                        {bulkAction.type === 'remove_year' && 'Remove Year'}
                                        {bulkAction.type === 'job_role' && 'Assign Role'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Result message */}
                    {bulkResult && (
                        <div className={`ap-mt-4 ap-p-3 ap-rounded-lg ${
                            bulkResult.failed > 0 
                                ? 'ap-bg-yellow-50 ap-border ap-border-yellow-200' : 'ap-bg-green-50 ap-border ap-border-green-200'
                        }`}>
                            <div className="ap-flex ap-items-center ap-gap-2">
                                {bulkResult.failed > 0 ? (
                                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-yellow-600" />
                                ) : (
                                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600" />
                                )}
                                <span className={bulkResult.failed > 0 ? 'ap-text-yellow-800' : 'ap-text-green-800'}>
                                    {bulkResult.success} updated successfully
                                    {bulkResult.failed > 0 && `, ${bulkResult.failed} failed`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Employee Table */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-overflow-x-auto">
                    <table className="ap-w-full">
                        <thead className="ap-bg-gray-50 ap-border-b ap-border-gray-200">
                            <tr>
                                <th className="ap-px-4 ap-py-3 ap-text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                                        onChange={toggleSelectAll}
                                        className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                    />
                                </th>
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-left ap-text-sm ap-font-semibold ap-text-gray-700 ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('name')}
                                >
                                    Employee <SortIcon field="name" />
                                </th>
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-left ap-text-sm ap-font-semibold ap-text-gray-700 ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('role')}
                                >
                                    Primary Role <SortIcon field="role" />
                                </th>
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-center ap-text-sm ap-font-semibold ap-text-gray-700 ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('longevity')}
                                    title="Number of work years logged in the system"
                                >
                                    Years Logged <SortIcon field="longevity" />
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-font-semibold ap-text-gray-700">
                                    Base Rate
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-font-semibold ap-text-gray-700">
                                    Role Bonus
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-font-semibold ap-text-gray-700">
                                    Longevity
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-font-semibold ap-text-gray-700">
                                    Time Bonuses
                                </th>
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-font-semibold ap-text-gray-700 ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('pay')}
                                >
                                    Total <SortIcon field="pay" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-200">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="ap-px-4 ap-py-12 ap-text-center ap-text-gray-500">
                                        {employees.length === 0 
                                            ? 'No employee pay data available.' : 'No employees match your filters.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map(employee => (
                                    <tr 
                                        key={employee.user_id}
                                        className={`hover:ap-bg-gray-50 ap-transition-colors ${
                                            selectedIds.has(employee.user_id) ? 'ap-bg-blue-50' : ''
                                        }`}
                                    >
                                        <td className="ap-px-4 ap-py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(employee.user_id)}
                                                onChange={() => toggleSelect(employee.user_id)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                            />
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-3">
                                                <div className="ap-w-8 ap-h-8 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-blue-600 ap-flex ap-items-center ap-justify-center">
                                                    <span className="ap-text-white ap-text-sm ap-font-medium">
                                                        {employee.display_name?.charAt(0)?.toUpperCase() || '?'}
                                                    </span>
                                                </div>
                                                <span className="ap-font-medium ap-text-gray-900">
                                                    {employee.display_name || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-sm ap-text-gray-600">
                                            {employee.pay_breakdown?.role_bonus?.role_name || (
                                                <span className="ap-text-gray-400 ap-italic">No role</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center">
                                            {(() => {
                                                const longevity = employee.pay_breakdown?.longevity;
                                                const logged = longevity?.work_years_logged ?? 0;
                                                const yearsList = longevity?.work_years_list ?? [];
                                                const isNew = logged === 0 && yearsList.length === 0;
                                                
                                                return (
                                                    <div className="ap-flex ap-flex-col ap-items-center">
                                                        <span 
                                                            className={`ap-inline-flex ap-items-center ap-px-2 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ${
                                                                isNew ? 'ap-bg-amber-100 ap-text-amber-800' : 'ap-bg-purple-100 ap-text-purple-800'
                                                            }`}
                                                            title={yearsList.length > 0 ? `Years: ${yearsList.join(', ')}` : 'No years logged'}
                                                        >
                                                            {isNew ? 'New' : `${yearsList.length || logged} yr${(yearsList.length || logged) !== 1 ? 's' : ''}`}
                                                        </span>
                                                        {yearsList.length > 0 && yearsList.length <= 2 && (
                                                            <span className="ap-text-xs ap-text-gray-400 ap-mt-0.5">
                                                                {yearsList.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right ap-text-sm ap-text-gray-900">
                                            {formatCurrency(employee.pay_breakdown?.base_rate)}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right ap-text-sm">
                                            {employee.pay_breakdown?.role_bonus?.amount ? (
                                                <span className="ap-text-green-600">
                                                    +{formatCurrency(employee.pay_breakdown.role_bonus.amount)}
                                                </span>
                                            ) : (
                                                <span className="ap-text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right ap-text-sm">
                                            {employee.pay_breakdown?.longevity?.bonus ? (
                                                <span className="ap-text-purple-600">
                                                    +{formatCurrency(employee.pay_breakdown.longevity.bonus)}
                                                </span>
                                            ) : (
                                                <span className="ap-text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right ap-text-sm">
                                            {employee.pay_breakdown?.time_bonus_total ? (
                                                <span className="ap-text-orange-600" title={employee.pay_breakdown?.time_bonuses?.map(tb => tb.name).join(', ') || ''}>
                                                    +{formatCurrency(employee.pay_breakdown.time_bonus_total)}
                                                </span>
                                            ) : (
                                                <span className="ap-text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right">
                                            <span className="ap-font-semibold ap-text-gray-900">
                                                {formatCurrency(employee.pay_breakdown?.total)}/hr
                                            </span>
                                            {employee.pay_breakdown?.is_capped && (
                                                <span className="ap-ml-1 ap-text-xs ap-text-orange-600" title={`Capped at ${formatCurrency(employee.pay_breakdown?.pay_cap)}/hr`}>⚠</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer with count */}
                <div className="ap-px-4 ap-py-3 ap-bg-gray-50 ap-border-t ap-border-gray-200 ap-text-sm ap-text-gray-600">
                    Showing {filteredEmployees.length} of {employees.length} employees
                </div>
            </div>
        </div>
    );
};

export default EmployeeBulkManager;
