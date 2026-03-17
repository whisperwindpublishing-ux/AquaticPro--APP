import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/Button';
import { 
    getAllEmployeePay, 
    getSeasons,
    getProjectedPay
} from '@/services/seasonalReturnsService';
import { EmployeePayData, Season, ProjectedPayBreakdown } from '@/types';
import { 
    HiOutlineMagnifyingGlass,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineEye,
    HiOutlineXMark,
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineCalendar
} from 'react-icons/hi2';

/**
 * Format years display for clarity
 * Shows: "X years logged" (actual work years in database)
 * Tooltip shows the actual calendar years
 */
const formatYearsDisplay = (longevity: { 
    years?: number; 
    work_years_logged?: number; 
    work_years_list?: number[];
    projected_years?: number;
    current_years?: number;
} | null | undefined, _isProjected: boolean = false) => {
    if (!longevity) {
        return { count: 0, label: '0 years', tooltip: 'No work years logged', isNew: true };
    }
    
    // For projected pay, use the logged years from current (not projected_years which is display year)
    const logged = longevity.work_years_logged ?? 0;
    const yearsList = longevity.work_years_list ?? [];
    
    // Determine actual count from work_years_list if available, otherwise use work_years_logged
    const actualCount = yearsList.length > 0 ? yearsList.length : logged;
    
    // Build label
    const label = actualCount === 1 
        ? '1 year' 
        : `${actualCount} years`;
    
    // Build tooltip with actual years
    let tooltip = '';
    if (yearsList.length > 0) {
        tooltip = `Work years: ${yearsList.join(', ')}`;
    } else if (actualCount > 0) {
        tooltip = `${actualCount} work year(s) logged`;
    } else {
        tooltip = 'No work years logged yet';
    }
    
    // Is this a new employee (0 years logged)?
    const isNew = actualCount === 0;
    
    return { count: actualCount, label, tooltip, isNew, yearsList };
};

/**
 * PayRatesTable - View all employees with their current and projected pay rates
 * 
 * Features:
 * - List of all employees with pay breakdown
 * - Search/filter by name or role
 * - Sort by name, pay rate, longevity
 * - Click to view detailed breakdown
 * - Show projected next-season pay
 */

type SortField = 'name' | 'total_pay' | 'longevity_years' | 'role';
type SortDirection = 'asc' | 'desc';

interface EmployeeWithPay extends Omit<EmployeePayData, 'projected_pay'> {
    projected_pay?: ProjectedPayBreakdown;
}

const PayRatesTable: React.FC = () => {
    const [employees, setEmployees] = useState<EmployeeWithPay[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Search and filter
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string>('');
    
    // Sorting
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    
    // Detail modal
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPay | null>(null);
    const [loadingProjected, setLoadingProjected] = useState(false);
    
    // Track if we've already got the default projected pay from initial load
    const [hasDefaultProjections, setHasDefaultProjections] = useState(false);

    useEffect(() => {
        loadData();
    }, []);
    
    // Only reload projected pay if user selects a DIFFERENT season than the default
    useEffect(() => {
        // Skip if no season selected or we're still loading initial data
        if (!selectedSeasonId || loading) return;
        
        // If we have default projections and this is a new season selection, reload
        if (hasDefaultProjections && employees.length > 0) {
            // Check if the selected season is different from what we loaded
            const firstEmployeeProjection = employees.find(e => e.projected_pay)?.projected_pay;
            if (firstEmployeeProjection && firstEmployeeProjection.season_id !== selectedSeasonId) {
                loadProjectedPayForAll();
            }
        }
    }, [selectedSeasonId, hasDefaultProjections]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [employeesData, seasonsData] = await Promise.all([
                getAllEmployeePay(),
                getSeasons()
            ]);
            
            // The API already returns projected_pay for the default/next season
            // So we can use it directly without re-fetching
            setEmployees(employeesData || []);
            setSeasons(seasonsData || []);
            
            // Mark that we have projections from initial load
            const hasProjections = employeesData?.some(e => e.projected_pay);
            setHasDefaultProjections(hasProjections);
        } catch (err: any) {
            console.error('Failed to load pay data:', err);
            setError(err.message || 'Failed to load employee pay rates');
        } finally {
            setLoading(false);
        }
    };
    
    const loadProjectedPayForAll = async () => {
        if (!selectedSeasonId || employees.length === 0) return;
        
        setLoadingProjected(true);
        
        try {
            // Process in larger batches for speed - these are lightweight queries
            const BATCH_SIZE = 15;
            const updatedEmployees = [...employees];
            
            for (let i = 0; i < employees.length; i += BATCH_SIZE) {
                const batch = employees.slice(i, i + BATCH_SIZE);
                
                // Process batch in parallel
                const batchResults = await Promise.allSettled(
                    batch.map(async (emp) => {
                        const projectedData = await getProjectedPay(emp.user_id, selectedSeasonId);
                        return {
                            user_id: emp.user_id,
                            projected_pay: projectedData.projected_pay
                        };
                    })
                );
                
                // Update employees with batch results
                batchResults.forEach((result, _idx) => {
                    if (result.status === 'fulfilled') {
                        const index = updatedEmployees.findIndex(e => e.user_id === result.value.user_id);
                        if (index !== -1 && result.value.projected_pay) {
                            updatedEmployees[index] = {
                                ...updatedEmployees[index],
                                projected_pay: result.value.projected_pay
                            };
                        }
                    }
                });
                
                // Update state after each batch for progressive loading
                setEmployees([...updatedEmployees]);
            }
        } catch (err) {
            console.error('Failed to load projected pay:', err);
        } finally {
            setLoadingProjected(false);
        }
    };

    // Get unique roles for filter dropdown
    const uniqueRoles = useMemo(() => {
        const roles = new Set<string>();
        employees.forEach(emp => {
            if (emp.job_roles && emp.job_roles.length > 0) {
                emp.job_roles.forEach(role => roles.add(role.title));
            }
        });
        return Array.from(roles).sort();
    }, [employees]);
    
    // Compute display pay (current or projected based on selection)
    const getDisplayPay = (employee: EmployeeWithPay) => {
        if (selectedSeasonId && employee.projected_pay) {
            return {
                base_rate: employee.projected_pay.base_rate,
                role_bonus: employee.projected_pay.role_bonus,
                longevity: employee.projected_pay.longevity,
                time_bonuses: employee.projected_pay.time_bonuses || [],
                time_bonus_total: employee.projected_pay.time_bonus_total || 0,
                pay_cap: employee.projected_pay.pay_cap || 0,
                is_capped: employee.projected_pay.is_capped || false,
                total: employee.projected_pay.total,
                is_projected: true
            };
        }
        return {
            base_rate: employee.pay_breakdown?.base_rate || 0,
            role_bonus: employee.pay_breakdown?.role_bonus || { amount: 0, role_name: '', role_id: 0 },
            longevity: employee.pay_breakdown?.longevity || { years: 0, bonus: 0 },
            time_bonuses: employee.pay_breakdown?.time_bonuses || [],
            time_bonus_total: employee.pay_breakdown?.time_bonus_total || 0,
            pay_cap: employee.pay_breakdown?.pay_cap || 0,
            is_capped: employee.pay_breakdown?.is_capped || false,
            total: employee.pay_breakdown?.total || 0,
            is_projected: false
        };
    };

    // Filter and sort employees
    const filteredEmployees = useMemo(() => {
        let filtered = [...employees];

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(emp => {
                const nameMatch = emp.display_name?.toLowerCase().includes(search);
                const roleMatch = emp.job_roles?.some(role => role.title.toLowerCase().includes(search));
                return nameMatch || roleMatch;
            });
        }

        // Role filter
        if (filterRole) {
            filtered = filtered.filter(emp => 
                emp.job_roles?.some(role => role.title === filterRole)
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
                case 'total_pay':
                    aVal = a.pay_breakdown?.total || 0;
                    bVal = b.pay_breakdown?.total || 0;
                    break;
                case 'longevity_years':
                    // Sort by actual work years logged (count of years in database)
                    aVal = a.pay_breakdown?.longevity?.work_years_logged ?? a.pay_breakdown?.longevity?.work_years_list?.length ?? 0;
                    bVal = b.pay_breakdown?.longevity?.work_years_logged ?? b.pay_breakdown?.longevity?.work_years_list?.length ?? 0;
                    break;
                case 'role':
                    aVal = (a.job_roles?.[0]?.title || '').toLowerCase();
                    bVal = (b.job_roles?.[0]?.title || '').toLowerCase();
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
    }, [employees, searchTerm, filterRole, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (sortField !== field) {
            return <span className="ap-text-gray-400 ap-ml-1">↕</span>;
        }
        return sortDirection === 'asc' 
            ? <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-ml-1 ap-inline" />
            : <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-ml-1 ap-inline" />;
    };

    const openDetailModal = async (employee: EmployeeWithPay) => {
        setSelectedEmployee(employee);
        
        // Load projected pay if not already loaded
        if (!employee.projected_pay) {
            setLoadingProjected(true);
            try {
                // Find next active season
                const activeSeason = seasons.find(s => s.is_active);
                if (activeSeason) {
                    const projectedData = await getProjectedPay(employee.user_id, activeSeason.id);
                    setSelectedEmployee({
                        ...employee,
                        projected_pay: projectedData.projected_pay
                    });
                    // Update in main list too
                    setEmployees(prev => prev.map(e => 
                        e.user_id === employee.user_id 
                            ? { ...e, projected_pay: projectedData.projected_pay }
                            : e
                    ));
                }
            } catch (err) {
                console.error('Failed to load projected pay:', err);
            } finally {
                setLoadingProjected(false);
            }
        }
    };

    const formatCurrency = (amount: number | undefined | null): string => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${amount.toFixed(2)}`;
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-max-w-7xl ap-mx-auto ap-p-6">
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4">
                    <h3 className="ap-text-red-800 ap-font-medium">Error Loading Pay Rates</h3>
                    <p className="ap-text-red-600 ap-text-sm ap-mt-1">{error}</p>
                    <Button 
                        onClick={loadData}
                        variant="ghost"
                        size="sm"
                        className="!ap-mt-3 !ap-text-red-700 hover:!ap-text-red-900 !ap-underline !ap-p-0"
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-7xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg">
                {/* Header */}
                <div className="ap-p-6 ap-border-b ap-border-gray-200">
                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4 ap-mb-4">
                        <div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Employee Pay Rates</h2>
                            <p className="ap-text-gray-600 ap-mt-1">
                                View current and projected pay rates for all employees
                            </p>
                        </div>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-500">
                            <HiOutlineCurrencyDollar className="ap-w-5 ap-h-5" />
                            <span>{employees.length} employees</span>
                        </div>
                    </div>
                    
                    {/* Season Selector */}
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <label className="ap-text-sm ap-font-medium ap-text-gray-700">Viewing Pay For:</label>
                        <select
                            value={selectedSeasonId || ''}
                            onChange={(e) => setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)}
                            className="ap-px-3 ap-py-1.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-text-sm"
                        >
                            <option value="">Current Year</option>
                            {seasons.filter(s => s.is_active || s.is_current).map(season => (
                                <option key={season.id} value={season.id}>
                                    {season.name} {season.is_current ? '(Current)' : '(Upcoming)'}
                                </option>
                            ))}
                        </select>
                        {selectedSeasonId && (
                            <span className="ap-text-xs ap-text-blue-600 ap-font-medium ap-flex ap-items-center ap-gap-1">
                                {loadingProjected && (
                                    <div className="ap-animate-spin ap-rounded-full ap-h-3 ap-w-3 ap-border-b-2 ap-border-blue-600"></div>
                                )}
                                {loadingProjected ? 'Loading Projected Pay...' : 'Showing Projected Pay'}
                            </span>
                        )}
                    </div>

                    {/* Search and Filters */}
                    <div className="ap-mt-4 ap-flex ap-flex-col sm:ap-flex-row ap-gap-3">
                        {/* Search */}
                        <div className="ap-relative ap-flex-1">
                            <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-text-gray-400 ap-w-5 ap-h-5" />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>

                        {/* Role Filter */}
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">All Roles</option>
                            {uniqueRoles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th 
                                    onClick={() => handleSort('name')}
                                    className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Employee <SortIcon field="name" />
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('role')}
                                    className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Primary Role <SortIcon field="role" />
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('longevity_years')}
                                    className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    title="Number of work years logged in the system"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Years Logged <SortIcon field="longevity_years" />
                                    </div>
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Base Rate
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Role Bonus
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Longevity
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Time Bonuses
                                </th>
                                <th 
                                    onClick={() => handleSort('total_pay')}
                                    className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Total Rate <SortIcon field="total_pay" />
                                    </div>
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="ap-px-6 ap-py-12 ap-text-center ap-text-gray-500">
                                        {searchTerm || filterRole 
                                            ? 'No employees match your filters.' : 'No employee pay data available. Configure pay rates first.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((employee) => {
                                    const displayPay = getDisplayPay(employee);
                                    return (
                                    <tr key={employee.user_id} className="hover:ap-bg-gray-50">
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {employee.display_name}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            {employee.job_roles && employee.job_roles.length > 0 ? (
                                                <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                    {employee.job_roles.map(role => (
                                                        <span key={role.id} className="ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                                            {role.title}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-gray-100 ap-text-gray-600">
                                                    No Role
                                                </span>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm">
                                            {(() => {
                                                const yearsInfo = formatYearsDisplay(
                                                    employee.pay_breakdown?.longevity,
                                                    displayPay.is_projected
                                                );
                                                return (
                                                    <div className="ap-flex ap-flex-col">
                                                        <span 
                                                            className={`ap-font-medium ${yearsInfo.isNew ? 'ap-text-amber-600' : 'ap-text-gray-900'}`}
                                                            title={yearsInfo.tooltip}
                                                        >
                                                            {yearsInfo.label}
                                                        </span>
                                                        {yearsInfo.isNew && (
                                                            <span className="ap-text-xs ap-text-amber-500">New</span>
                                                        )}
                                                        {yearsInfo.yearsList && yearsInfo.yearsList.length > 0 && yearsInfo.yearsList.length <= 3 && (
                                                            <span className="ap-text-xs ap-text-gray-400">
                                                                {yearsInfo.yearsList.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                            {formatCurrency(displayPay.base_rate)}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                            {displayPay.role_bonus?.amount 
                                                ? <span className="ap-text-green-600">+{formatCurrency(displayPay.role_bonus.amount)}</span>
                                                : '-'}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                            {displayPay.longevity?.bonus 
                                                ? <span className="ap-text-purple-600">+{formatCurrency(displayPay.longevity.bonus)}</span>
                                                : '-'}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                            {displayPay.time_bonus_total && displayPay.time_bonus_total > 0
                                                ? <span className="ap-text-orange-600" title={displayPay.time_bonuses?.map(tb => tb.name).join(', ') || ''}>+{formatCurrency(displayPay.time_bonus_total)}</span>
                                                : '-'}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <span className="ap-text-sm ap-font-semibold ap-text-gray-900">
                                                {formatCurrency(displayPay.total)}/hr
                                            </span>
                                            {displayPay.is_capped && (
                                                <span className="ap-ml-1 ap-text-xs ap-text-orange-600" title={`Capped at ${formatCurrency(displayPay.pay_cap)}/hr`}>⚠</span>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right">
                                            <Button
                                                onClick={() => openDetailModal(employee)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-p-1 !ap-min-h-0"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="ap-w-5 ap-h-5" />
                                            </Button>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                {filteredEmployees.length > 0 && (
                    <div className="ap-px-6 ap-py-4 ap-bg-gray-50 ap-border-t ap-border-gray-200">
                        <div className="ap-flex ap-flex-wrap ap-gap-6 ap-text-sm">
                            <div>
                                <span className="ap-text-gray-500">Showing:</span>
                                <span className="ap-ml-1 ap-font-medium">{filteredEmployees.length} of {employees.length}</span>
                            </div>
                            <div>
                                <span className="ap-text-gray-500">Avg Pay Rate:</span>
                                <span className="ap-ml-1 ap-font-medium">
                                    {formatCurrency(
                                        filteredEmployees.reduce((sum, e) => sum + getDisplayPay(e).total, 0) / filteredEmployees.length
                                    )}/hr
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Slide-Over Panel */}
            {selectedEmployee && (
                <div 
                    className="ap-fixed ap-inset-0 ap-overflow-hidden ap-z-[9999]" 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div className="ap-absolute ap-inset-0 ap-overflow-hidden">
                        {/* Backdrop */}
                        <div 
                            className="ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity" 
                            onClick={() => setSelectedEmployee(null)}
                        />
                        
                        {/* Slide-over panel */}
                        <div className="ap-fixed ap-inset-y-0 ap-right-0 ap-flex ap-max-w-full ap-pl-10" style={{ position: 'fixed' }}>
                            <div className="ap-w-screen ap-max-w-md">
                                <div className="ap-flex ap-h-full ap-flex-col ap-bg-white ap-shadow-xl">
                                    {/* Header */}
                                    <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-bg-gray-50">
                                        <div>
                                            <h3 className="ap-text-xl ap-font-semibold ap-text-gray-900">
                                                {selectedEmployee.display_name}
                                            </h3>
                                            <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mt-1">
                                                {selectedEmployee.job_roles && selectedEmployee.job_roles.length > 0 ? (
                                                    selectedEmployee.job_roles.map(role => (
                                                        <span key={role.id} className="ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                                            {role.title}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="ap-text-sm ap-text-gray-500">No Role Assigned</span>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => setSelectedEmployee(null)}
                                            variant="ghost"
                                            size="xs"
                                            className="!ap-text-gray-400 hover:!ap-text-gray-600 !ap-rounded-full !ap-p-1 hover:!ap-bg-gray-100 !ap-min-h-0"
                                        >
                                            <HiOutlineXMark className="ap-w-6 ap-h-6" />
                                        </Button>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="ap-flex-1 ap-overflow-y-auto ap-p-6">
                                        {/* Current Pay Breakdown */}
                                        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
                                            <HiOutlineCurrencyDollar className="ap-w-5 ap-h-5 ap-text-gray-500" />
                                            <h4 className="ap-font-semibold ap-text-gray-900">Current Pay Breakdown</h4>
                                        </div>
                            
                                        <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4 ap-space-y-3">
                                            <div className="ap-flex ap-justify-between ap-items-center">
                                                <span className="ap-text-gray-600">Base Rate</span>
                                                <span className="ap-font-medium">{formatCurrency(selectedEmployee.pay_breakdown?.base_rate)}</span>
                                            </div>
                                
                                {selectedEmployee.pay_breakdown?.role_bonus?.amount > 0 && (
                                    <div className="ap-flex ap-justify-between ap-items-center">
                                        <span className="ap-text-gray-600">
                                            Role Bonus ({selectedEmployee.pay_breakdown?.role_bonus?.role_name})
                                        </span>
                                        <span className="ap-font-medium ap-text-green-600">
                                            +{formatCurrency(selectedEmployee.pay_breakdown?.role_bonus?.amount)}
                                        </span>
                                    </div>
                                )}
                                
                                {(selectedEmployee.pay_breakdown?.longevity?.years || 1) >= 1 && (
                                    <div className="ap-flex ap-justify-between ap-items-center">
                                        <span className="ap-text-gray-600">
                                            Longevity (In their {selectedEmployee.pay_breakdown?.longevity?.years || 1}{(selectedEmployee.pay_breakdown?.longevity?.years || 1) === 1 ? 'st' : (selectedEmployee.pay_breakdown?.longevity?.years || 1) === 2 ? 'nd' : (selectedEmployee.pay_breakdown?.longevity?.years || 1) === 3 ? 'rd' : 'th'} year)
                                        </span>
                                        <span className="ap-font-medium ap-text-purple-600">
                                            {selectedEmployee.pay_breakdown?.longevity?.bonus > 0 ? `+${formatCurrency(selectedEmployee.pay_breakdown?.longevity?.bonus)}` : '$0.00'}
                                        </span>
                                    </div>
                                )}
                                
                                {(selectedEmployee.pay_breakdown?.time_bonus_total || 0) > 0 && (
                                    <div className="ap-flex ap-justify-between ap-items-center">
                                        <span className="ap-text-gray-600">Active Time Bonuses</span>
                                        <span className="ap-font-medium ap-text-orange-600">
                                            +{formatCurrency(selectedEmployee.pay_breakdown?.time_bonus_total)}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="ap-pt-3 ap-border-t ap-border-gray-200 ap-flex ap-justify-between ap-items-center">
                                    <span className="ap-font-semibold ap-text-gray-900">Total Hourly Rate</span>
                                    <div className="ap-text-right">
                                        <span className="ap-text-xl ap-font-bold ap-text-gray-900">
                                            {formatCurrency(selectedEmployee.pay_breakdown?.total)}/hr
                                        </span>
                                        {selectedEmployee.pay_breakdown?.is_capped && (
                                            <div className="ap-text-xs ap-text-orange-600 ap-mt-1">
                                                ⚠ Capped at {formatCurrency(selectedEmployee.pay_breakdown.pay_cap)}/hr
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Projected Pay Section */}
                            <div className="ap-mt-6">
                                <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
                                    <HiOutlineArrowTrendingUp className="ap-w-5 ap-h-5 ap-text-gray-500" />
                                    <h4 className="ap-font-semibold ap-text-gray-900">Projected Next Season</h4>
                                </div>
                                
                                {loadingProjected ? (
                                    <div className="ap-flex ap-items-center ap-justify-center ap-py-8">
                                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-500"></div>
                                    </div>
                                ) : selectedEmployee.projected_pay ? (
                                    <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4 ap-space-y-3">
                                        <div className="ap-flex ap-justify-between ap-items-center">
                                            <span className="ap-text-gray-600">Base Rate</span>
                                            <span className="ap-font-medium">{formatCurrency(selectedEmployee.projected_pay?.base_rate)}</span>
                                        </div>
                                        
                                        {selectedEmployee.projected_pay?.role_bonus?.amount > 0 && (
                                            <div className="ap-flex ap-justify-between ap-items-center">
                                                <span className="ap-text-gray-600">Role Bonus</span>
                                                <span className="ap-font-medium ap-text-green-600">
                                                    +{formatCurrency(selectedEmployee.projected_pay?.role_bonus?.amount)}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {((selectedEmployee.pay_breakdown?.longevity?.years || 1) + 1) >= 1 && (
                                            <div className="ap-flex ap-justify-between ap-items-center">
                                                <span className="ap-text-gray-600">
                                                    Longevity (In their {(selectedEmployee.pay_breakdown?.longevity?.years || 1) + 1}{((selectedEmployee.pay_breakdown?.longevity?.years || 1) + 1) === 1 ? 'st' : ((selectedEmployee.pay_breakdown?.longevity?.years || 1) + 1) === 2 ? 'nd' : ((selectedEmployee.pay_breakdown?.longevity?.years || 1) + 1) === 3 ? 'rd' : 'th'} year)
                                                </span>
                                                <span className="ap-font-medium ap-text-purple-600">
                                                    {selectedEmployee.projected_pay?.longevity?.bonus > 0 ? `+${formatCurrency(selectedEmployee.projected_pay?.longevity?.bonus)}` : '$0.00'}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="ap-pt-3 ap-border-t ap-border-blue-200 ap-flex ap-justify-between ap-items-center">
                                            <span className="ap-font-semibold ap-text-gray-900">Projected Rate</span>
                                            <div className="ap-text-right">
                                                <span className="ap-text-xl ap-font-bold ap-text-blue-600">
                                                    {formatCurrency(selectedEmployee.projected_pay?.total)}/hr
                                                </span>
                                                {selectedEmployee.projected_pay?.is_capped && (
                                                    <div className="ap-text-xs ap-text-orange-600 ap-mt-1">
                                                        ⚠ Capped at {formatCurrency(selectedEmployee.projected_pay.pay_cap)}/hr
                                                    </div>
                                                )}
                                                {selectedEmployee.projected_pay?.total > selectedEmployee.pay_breakdown?.total && (
                                                    <div className="ap-text-xs ap-text-green-600">
                                                        +{formatCurrency(selectedEmployee.projected_pay?.total - selectedEmployee.pay_breakdown?.total)} increase
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ap-text-center ap-py-6 ap-text-gray-500">
                                        <HiOutlineCalendar className="ap-w-8 ap-h-8 ap-mx-auto ap-mb-2 ap-opacity-50" />
                                        <p className="ap-text-sm">No active season for projection</p>
                                    </div>
                                )}
                                    </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="ap-px-6 ap-py-4 ap-bg-gray-50 ap-border-t">
                                        <Button
                                            onClick={() => setSelectedEmployee(null)}
                                            variant="secondary"
                                            fullWidth
                                        >
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayRatesTable;
