import React, { useState, useEffect, useMemo } from 'react';
import { HiChevronDown, HiChevronRight, HiFilter, HiArrowLeft, HiEye } from 'react-icons/hi';
import { UserMetadata } from '../services/api-user-management';
import { getCachedUsers } from '../services/userCache';
import { Button } from './ui/Button';
import { getInServiceSummaryBatch, getJobRoles, getInServiceLogs, JobRole, InServiceSummary, InServiceLog, InServiceSummaryBatchUser } from '../services/api-professional-growth';
import UserSelector, { UserOption } from './UserSelector';
import { sortUsersByName } from '../utils/userSorting';

interface UserWithRoles extends UserMetadata {
    roleSummaries: Array<{
        role: JobRole;
        lastMonth: InServiceSummary;
        currentMonth: InServiceSummary;
    }>;
}

type FilterStatus = 'all' | 'met' | 'not-met';

const InServiceUserTable: React.FC = () => {
    const [users, setUsers] = useState<UserWithRoles[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    // Note: Using 25 items per page, configured server-side
    
    // Detail view state
    const [viewMode, setViewMode] = useState<'table' | 'detail'>('table');
    const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserWithRoles | null>(null);
    const [userLogs, setUserLogs] = useState<{
        attended: InServiceLog[];
        led: InServiceLog[];
        noShow: InServiceLog[];
    }>({ attended: [], led: [], noShow: [] });
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    
    // Filters
    const [selectedRole, setSelectedRole] = useState<number | 'all'>('all');
    const [selectedUserId, setSelectedUserId] = useState<number>(0); // 0 means 'all'
    const [lastMonthFilter, setLastMonthFilter] = useState<FilterStatus>('all');
    const [currentMonthFilter, setCurrentMonthFilter] = useState<FilterStatus>('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (_page = 1, append = false) => {
        try {
            if (append) {
                setIsLoadingMore(true);
            } else {
                setIsLoading(true);
            }
            
            const currentMonth = new Date().toISOString().substring(0, 7);
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const lastMonthStr = lastMonth.toISOString().substring(0, 7);

            // Load users, roles, and batch summaries in parallel (3 API calls instead of ~200)
            const [usersData, rolesData, batchSummaries] = await Promise.all([
                getCachedUsers(),
                getJobRoles(),
                getInServiceSummaryBatch([lastMonthStr, currentMonth])
            ]);

            // Set state
            setTotalUsers(usersData.length);
            setTotalPages(1);
            setCurrentPage(1);
            setJobRoles(rolesData);

            console.log('Loaded users:', usersData.length);
            console.log('Loaded roles:', rolesData.length);
            console.log('Loaded batch summaries:', batchSummaries.length);

            // Create a map for quick lookup of summaries by user_id
            const summariesByUserId = new Map<number, InServiceSummaryBatchUser>();
            batchSummaries.forEach(summary => {
                summariesByUserId.set(summary.user_id, summary);
            });

            // Process users with their summaries (no additional API calls needed)
            const usersWithData = usersData.map(user => {
                // Parse role IDs from the comma-separated string
                const roleIds = user.job_role_ids 
                    ? user.job_role_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
                    : [];

                if (roleIds.length === 0) {
                    return {
                        ...user,
                        roleSummaries: []
                    };
                }

                // Get the batch summary for this user
                const userSummary = summariesByUserId.get(user.user_id);
                
                // Map role IDs to role data and summaries
                const roleSummaries = roleIds.map(roleId => {
                    const role = rolesData.find(r => Number(r.id) === Number(roleId));
                    if (!role) {
                        return null;
                    }

                    // Get summary data from batch response
                    const lastMonthData = userSummary?.summaries?.[lastMonthStr];
                    const currentMonthData = userSummary?.summaries?.[currentMonth];

                    // Build InServiceSummary objects compatible with the existing interface
                    const lastMonthSummary: Partial<InServiceSummary> = {
                        current_month_hours: lastMonthData?.hours ?? 0,
                        previous_month_hours: 0, // Not needed for last month display
                        required_hours: lastMonthData?.required_hours ?? role.inservice_hours ?? 4,
                        current_meets_requirement: lastMonthData?.meets_requirement ?? false,
                        previous_meets_requirement: lastMonthData?.meets_requirement ?? false
                    };

                    const currentMonthSummary: Partial<InServiceSummary> = {
                        current_month_hours: currentMonthData?.hours ?? 0,
                        previous_month_hours: lastMonthData?.hours ?? 0, 
                        required_hours: currentMonthData?.required_hours ?? role.inservice_hours ?? 4,
                        current_meets_requirement: currentMonthData?.meets_requirement ?? false,
                        previous_meets_requirement: lastMonthData?.meets_requirement ?? false
                    };

                    return {
                        role,
                        lastMonth: lastMonthSummary,
                        currentMonth: currentMonthSummary
                    };
                }).filter(Boolean) as Array<{
                    role: JobRole;
                    lastMonth: InServiceSummary;
                    currentMonth: InServiceSummary;
                }>;

                return {
                    ...user,
                    roleSummaries
                };
            });

            console.log('Final users with data:', usersWithData.length);
            
            // Append or replace users based on pagination mode
            if (append) {
                setUsers(prevUsers => [...prevUsers, ...usersWithData]);
            } else {
                setUsers(usersWithData);
            }
        } catch (error) {
            console.error('Error loading user training data:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };
    
    const loadMoreUsers = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            loadData(currentPage + 1, true);
        }
    };

    const toggleUser = (userId: number) => {
        setExpandedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleViewUserDetails = async (user: UserWithRoles) => {
        setIsLoadingDetails(true);
        setSelectedUserForDetails(user);
        setViewMode('detail');

        try {
            // Get all in-service logs (including archived)
            const allLogs = await getInServiceLogs({ include_archived: true });

            // Filter logs by user participation
            const attended = allLogs.filter(log => 
                log.attendees?.some(a => a.id === user.user_id)
            );
            const led = allLogs.filter(log => 
                log.leaders?.some(l => l.id === user.user_id)
            );
            const noShow = allLogs.filter(log => 
                log.no_shows?.some(n => n.id === user.user_id)
            );

            setUserLogs({ attended, led, noShow });
        } catch (error) {
            console.error('Error loading user training details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleBackToTable = () => {
        setViewMode('table');
        setSelectedUserForDetails(null);
        setUserLogs({ attended: [], led: [], noShow: [] });
    };

    // Filter users and their role summaries based on selected role
    const filteredUsers = useMemo(() => {
        const filtered = users
            .filter(user => {
                // Filter by selected user first (0 means 'all')
                if (selectedUserId !== 0) {
                    if (Number(user.user_id) !== Number(selectedUserId)) return false;
                }
                // Filter by role
                if (selectedRole !== 'all') {
                    const hasRole = user.roleSummaries.some(rs => Number(rs.role.id) === Number(selectedRole));
                    if (!hasRole) return false;
                }

                // Filter by last month status
                if (lastMonthFilter !== 'all') {
                    const meetsLastMonth = user.roleSummaries.some(rs => 
                        rs.lastMonth.previous_meets_requirement
                    );
                    if (lastMonthFilter === 'met' && !meetsLastMonth) return false;
                    if (lastMonthFilter === 'not-met' && meetsLastMonth) return false;
                }

                // Filter by current month status
                if (currentMonthFilter !== 'all') {
                    const meetsCurrentMonth = user.roleSummaries.some(rs => 
                        rs.currentMonth.current_meets_requirement
                    );
                    if (currentMonthFilter === 'met' && !meetsCurrentMonth) return false;
                    if (currentMonthFilter === 'not-met' && meetsCurrentMonth) return false;
                }

                return true;
            })
            .map(user => {
                // If a specific role is selected, filter the user's roleSummaries to only that role
                if (selectedRole !== 'all') {
                    return {
                        ...user,
                        roleSummaries: user.roleSummaries.filter(rs => Number(rs.role.id) === Number(selectedRole))
                    };
                }
                return user;
            });
        
        // Sort by last name, then first name
        return sortUsersByName(filtered);
    }, [users, selectedRole, selectedUserId, lastMonthFilter, currentMonthFilter]);

    const getStatusBadge = (met: boolean, label: string) => {
        return (
            <span className={`ap-inline-flex ap-items-center ap-px-2 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ${
                met 
                    ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-red-100 ap-text-red-800'
            }`}>
                {met ? '✓' : '✗'} {label}
            </span>
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    if (isLoading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    // Detail View
    if (viewMode === 'detail' && selectedUserForDetails) {
        return (
            <div className="ap-space-y-4">
                {/* Back Button */}
                <div>
                    <Button
                        onClick={handleBackToTable}
                        variant="outline"
                        leftIcon={<HiArrowLeft className="ap-w-4 ap-h-4" />}
                    >
                        Back to User Compliance
                    </Button>
                </div>

                {/* User Header */}
                <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-6">
                    <div className="ap-flex ap-items-center ap-space-x-4">
                        <div className="ap-flex-shrink-0 ap-h-16 ap-w-16 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-purple-600 ap-flex ap-items-center ap-justify-center ap-text-white ap-text-xl ap-font-semibold">
                            {selectedUserForDetails.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                                {selectedUserForDetails.display_name}
                            </h2>
                            <p className="ap-text-gray-600">{selectedUserForDetails.user_email}</p>
                            {selectedUserForDetails.job_role_titles && (
                                <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                                    {selectedUserForDetails.job_role_titles}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {isLoadingDetails ? (
                    <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                        <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
                    </div>
                ) : (
                    <div className="ap-space-y-6">
                        {/* Attended Trainings */}
                        <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                            <div className="ap-bg-green-50 ap-border-b ap-border-green-200 ap-px-6 ap-py-3">
                                <h3 className="ap-text-lg ap-font-semibold ap-text-green-900">
                                    Attended Trainings ({userLogs.attended.length})
                                </h3>
                            </div>
                            <div className="ap-overflow-x-auto">
                                {userLogs.attended.length === 0 ? (
                                    <p className="ap-text-gray-500 ap-text-center ap-py-8">No attended trainings</p>
                                ) : (
                                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                        <thead className="ap-bg-gray-50">
                                            <tr>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Date</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Topic</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Duration</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Location</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Leaders</th>
                                            </tr>
                                        </thead>
                                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                            {userLogs.attended.map(log => (
                                                <tr key={log.id} className="hover:ap-bg-gray-50">
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {formatDate(log.training_date)}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-900">{log.topic}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {log.duration_hours} hrs
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">{log.location || '-'}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">
                                                        {log.leaders?.map(l => l.name).join(', ') || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Led Trainings */}
                        <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                            <div className="ap-bg-blue-50 ap-border-b ap-border-blue-200 ap-px-6 ap-py-3">
                                <h3 className="ap-text-lg ap-font-semibold ap-text-blue-900">
                                    Led Trainings ({userLogs.led.length})
                                </h3>
                            </div>
                            <div className="ap-overflow-x-auto">
                                {userLogs.led.length === 0 ? (
                                    <p className="ap-text-gray-500 ap-text-center ap-py-8">No led trainings</p>
                                ) : (
                                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                        <thead className="ap-bg-gray-50">
                                            <tr>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Date</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Topic</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Duration</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Location</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Attendees</th>
                                            </tr>
                                        </thead>
                                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                            {userLogs.led.map(log => (
                                                <tr key={log.id} className="hover:ap-bg-gray-50">
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {formatDate(log.training_date)}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-900">{log.topic}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {log.duration_hours} hrs
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">{log.location || '-'}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">
                                                        {log.attendees?.length || 0} attendees
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* No-Shows */}
                        <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                            <div className="ap-bg-red-50 ap-border-b ap-border-red-200 ap-px-6 ap-py-3">
                                <h3 className="ap-text-lg ap-font-semibold ap-text-red-900">
                                    No-Shows ({userLogs.noShow.length})
                                </h3>
                            </div>
                            <div className="ap-overflow-x-auto">
                                {userLogs.noShow.length === 0 ? (
                                    <p className="ap-text-gray-500 ap-text-center ap-py-8">No recorded no-shows</p>
                                ) : (
                                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                        <thead className="ap-bg-gray-50">
                                            <tr>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Date</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Topic</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Duration</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Location</th>
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Leaders</th>
                                            </tr>
                                        </thead>
                                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                            {userLogs.noShow.map(log => (
                                                <tr key={log.id} className="hover:ap-bg-gray-50">
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {formatDate(log.training_date)}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-900">{log.topic}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {log.duration_hours} hrs
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">{log.location || '-'}</td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500">
                                                        {log.leaders?.map(l => l.name).join(', ') || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Table View
    return (
        <div className="ap-space-y-4">
            {/* Filters */}
            <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-4">
                <div className="ap-flex ap-items-center ap-gap-2 ap-mb-3">
                    <HiFilter className="ap-w-5 ap-h-5 ap-text-gray-600" />
                    <h3 className="ap-font-semibold ap-text-gray-900">Filters</h3>
                </div>
                
                {/* User Filter - Full Width Row */}
                <div className="ap-mb-4">
                    <UserSelector
                        users={[
                            { id: 0, name: 'All Users', email: '', job_role: undefined, tier: undefined },
                            ...users.map(u => ({
                                id: u.user_id,
                                name: u.display_name,
                                email: u.user_email || '',
                                job_role: u.job_role_titles || undefined,
                                tier: u.tier
                            } as UserOption))
                        ]}
                        selectedUserId={selectedUserId}
                        onChange={setSelectedUserId}
                        label="Filter by User"
                        isLoading={isLoading}
                    />
                </div>

                {/* Other Filters - 3 Column Grid */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-4">
                    {/* Role Filter */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Job Role
                        </label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                        >
                            <option value="all">All Roles</option>
                            {jobRoles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.title} (Tier {role.tier})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Last Month Filter */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Last Month Status
                        </label>
                        <select
                            value={lastMonthFilter}
                            onChange={(e) => setLastMonthFilter(e.target.value as FilterStatus)}
                            className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                        >
                            <option value="all">All</option>
                            <option value="met">Met Requirement</option>
                            <option value="not-met">Did Not Meet</option>
                        </select>
                    </div>

                    {/* Current Month Filter */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Current Month Status
                        </label>
                        <select
                            value={currentMonthFilter}
                            onChange={(e) => setCurrentMonthFilter(e.target.value as FilterStatus)}
                            className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                        >
                            <option value="all">All</option>
                            <option value="met">Met Requirement</option>
                            <option value="not-met">Did Not Meet</option>
                        </select>
                    </div>
                </div>
                <div className="ap-mt-3 ap-text-sm ap-text-gray-600">
                    Showing {filteredUsers.length} of {users.length} users
                </div>
            </div>

            {/* User Table */}
            {filteredUsers.length === 0 ? (
                <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200">
                    <p className="ap-text-gray-600">No users match the selected filters.</p>
                </div>
            ) : (
                <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-w-8">
                                    {/* Expand/Collapse */}
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Employee
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Roles
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Last Month
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Current Month
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {filteredUsers.map(user => (
                                <React.Fragment key={user.user_id}>
                                    {/* User Row */}
                                    <tr className="hover:ap-bg-gray-50 ap-cursor-pointer" onClick={() => toggleUser(user.user_id)}>
                                        <td className="ap-px-6 ap-py-4">
                                            {user.roleSummaries.length > 0 && (
                                                expandedUsers.has(user.user_id) ? (
                                                    <HiChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                                ) : (
                                                    <HiChevronRight className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                                )
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-flex ap-items-center">
                                                <div className="ap-flex-shrink-0 ap-h-10 ap-w-10 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-purple-600 ap-flex ap-items-center ap-justify-center ap-text-white ap-font-semibold">
                                                    {user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                </div>
                                                <div className="ap-ml-4">
                                                    <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                        {user.display_name}
                                                    </div>
                                                    <div className="ap-text-sm ap-text-gray-500">
                                                        {user.user_email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-text-sm ap-text-gray-900">
                                                {user.roleSummaries.length === 0 ? (
                                                    <span className="ap-text-gray-400 ap-italic">No roles assigned</span>
                                                ) : (
                                                    <span>{user.roleSummaries.length} role{user.roleSummaries.length > 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            {user.roleSummaries.length > 0 && user.roleSummaries[0].lastMonth && (
                                                <div className="ap-space-y-1">
                                                    <div className="ap-text-sm ap-font-semibold ap-text-gray-900">
                                                        {user.roleSummaries[0].lastMonth.current_month_hours} hrs
                                                    </div>
                                                    {getStatusBadge(
                                                        user.roleSummaries[0].lastMonth.current_meets_requirement,
                                                        user.roleSummaries[0].lastMonth.current_meets_requirement ? 'Met' : 'Not Met'
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            {user.roleSummaries.length > 0 && user.roleSummaries[0].currentMonth && (
                                                <div className="ap-space-y-1">
                                                    <div className="ap-text-sm ap-font-semibold ap-text-gray-900">
                                                        {user.roleSummaries[0].currentMonth.current_month_hours} hrs
                                                    </div>
                                                    {getStatusBadge(
                                                        user.roleSummaries[0].currentMonth.current_meets_requirement,
                                                        user.roleSummaries[0].currentMonth.current_meets_requirement ? 'On Track' : 'Behind'
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewUserDetails(user);
                                                }}
                                                variant="outline"
                                                size="sm"
                                                leftIcon={<HiEye className="ap-w-4 ap-h-4" />}
                                            >
                                                Details
                                            </Button>
                                        </td>
                                    </tr>

                                    {/* Expanded Role Rows */}
                                    {expandedUsers.has(user.user_id) && user.roleSummaries.map((summary) => (
                                        <tr key={`${user.user_id}-${summary.role.id}`} className="ap-bg-blue-50">
                                            <td className="ap-px-6 ap-py-3"></td>
                                            <td className="ap-px-6 ap-py-3 ap-pl-16" colSpan={2}>
                                                <div className="ap-flex ap-items-center ap-space-x-3">
                                                    <div className="ap-flex-shrink-0">
                                                        <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-blue-100 ap-text-blue-800">
                                                            Tier {summary.role.tier}
                                                        </span>
                                                    </div>
                                                    <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                        {summary.role.title}
                                                    </div>
                                                    <div className="ap-text-xs ap-text-gray-500">
                                                        Requires {summary.role.inservice_hours} hrs/month
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-3">
                                                <div className="ap-space-y-1">
                                                    <div className="ap-text-sm">
                                                        <span className="ap-font-semibold ap-text-gray-900">
                                                            {summary.lastMonth.current_month_hours}
                                                        </span>
                                                        <span className="ap-text-gray-500"> / {summary.role.inservice_hours} hrs</span>
                                                    </div>
                                                    {getStatusBadge(
                                                        summary.lastMonth.current_meets_requirement,
                                                        summary.lastMonth.current_meets_requirement ? 'Met' : 'Not Met'
                                                    )}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-3">
                                                <div className="ap-space-y-1">
                                                    <div className="ap-text-sm">
                                                        <span className="ap-font-semibold ap-text-gray-900">
                                                            {summary.currentMonth.current_month_hours}
                                                        </span>
                                                        <span className="ap-text-gray-500"> / {summary.role.inservice_hours} hrs</span>
                                                    </div>
                                                    {getStatusBadge(
                                                        summary.currentMonth.current_meets_requirement,
                                                        summary.currentMonth.current_meets_requirement ? 'On Track' : 'Behind'
                                                    )}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-3"></td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
                <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-flex ap-items-center ap-justify-between">
                    <div className="ap-text-sm ap-text-gray-700">
                        Showing {users.length} of {totalUsers} users
                        {currentPage < totalPages && (
                            <span className="ap-text-gray-500"> (Page {currentPage} of {totalPages})</span>
                        )}
                    </div>
                    
                    {currentPage < totalPages && (
                        <Button
                            onClick={loadMoreUsers}
                            disabled={isLoadingMore}
                            variant="primary"
                            size="sm"
                            loading={isLoadingMore}
                        >
                            {isLoadingMore ? 'Loading...' : 'Load More Users'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default InServiceUserTable;
