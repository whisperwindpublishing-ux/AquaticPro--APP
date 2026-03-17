import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    HiSearch as SearchIcon,
    HiChartBar as ChartIcon,
    HiDownload as DownloadIcon,
    HiRefresh as RefreshIcon
} from 'react-icons/hi';
import { Button } from './ui';
import LoadingSpinner from './LoadingSpinner';
import {
    getScanAuditComplianceReport,
    getLiveDrillComplianceReport,
    getInServiceComplianceReport,
    type UserComplianceData
} from '../services/api-professional-growth';
import { downloadCSV } from '../utils/csvExport';
import { UserProfile } from '../types';

type TimeFrame = '3months' | '6months' | '12months' | 'custom';
type ReportTab = 'inservice' | 'scan_audits' | 'live_drills';
type ResultFilter = 'all' | 'pass' | 'remediation' | 'fail';
type TargetFilter = 'all' | 'met' | 'not_met';

interface ReportFilters {
    timeFrame: TimeFrame;
    startDate: string;
    endDate: string;
    searchQuery: string;
    targetCount: number;
    includeArchived: boolean;
    resultFilter: ResultFilter;
    targetFilter: TargetFilter;
}

// Use the imported type
type UserReportData = UserComplianceData;

interface ComplianceReportsProps {
    currentUser: UserProfile;
}

const ComplianceReports: React.FC<ComplianceReportsProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<ReportTab>('scan_audits');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<UserReportData[]>([]);
    const [sortColumn, setSortColumn] = useState<string>('display_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [canViewAllRecords, setCanViewAllRecords] = useState(false);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Check if user can view all records
    useEffect(() => {
        const checkPermissions = async () => {
            try {
                const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
                const nonce = window.mentorshipPlatformData?.nonce || '';
                
                // Admin always has access
                if (window.mentorshipPlatformData?.is_admin) {
                    setCanViewAllRecords(true);
                    setPermissionsLoaded(true);
                    return;
                }
                
                // Check user's job role permissions
                const response = await fetch(`${apiUrl}/professional-growth/my-permissions`, {
                    headers: { 'X-WP-Nonce': nonce },
                });
                
                if (response.ok) {
                    const perms = await response.json();
                    setCanViewAllRecords(perms.reportsPermissions?.canViewAllRecords ?? false);
                }
            } catch (err) {
                console.error('Failed to check reports permissions:', err);
            } finally {
                setPermissionsLoaded(true);
            }
        };
        
        checkPermissions();
    }, []);

    // Calculate default date ranges
    const getDefaultDateRange = (timeFrame: TimeFrame): { start: string; end: string } => {
        const end = new Date();
        const start = new Date();
        
        switch (timeFrame) {
            case '3months':
                start.setMonth(start.getMonth() - 3);
                break;
            case '6months':
                start.setMonth(start.getMonth() - 6);
                break;
            case '12months':
                start.setFullYear(start.getFullYear() - 1);
                break;
            default:
                start.setMonth(start.getMonth() - 3);
        }
        
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    };

    const [filters, setFilters] = useState<ReportFilters>(() => {
        const defaultRange = getDefaultDateRange('3months');
        return {
            timeFrame: '3months',
            startDate: defaultRange.start,
            endDate: defaultRange.end,
            searchQuery: '',
            targetCount: 2, // Default target
            includeArchived: false,
            resultFilter: 'all',
            targetFilter: 'all'
        };
    });

    // Update date range when timeframe changes
    useEffect(() => {
        if (filters.timeFrame !== 'custom') {
            const dateRange = getDefaultDateRange(filters.timeFrame);
            setFilters(prev => ({
                ...prev,
                startDate: dateRange.start,
                endDate: dateRange.end
            }));
        }
    }, [filters.timeFrame]);

    // Load report data when filters or tab changes
    useEffect(() => {
        if (permissionsLoaded) {
            loadReportData();
        }
    }, [activeTab, filters.timeFrame, filters.startDate, filters.endDate, filters.includeArchived, permissionsLoaded, canViewAllRecords]);

    // Auto-refresh every 5 minutes while the page is open
    useEffect(() => {
        if (!permissionsLoaded) return;
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = setInterval(() => {
            loadReportData({ silent: true });
        }, 5 * 60 * 1000);
        return () => {
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        };
    }, [activeTab, filters.timeFrame, filters.startDate, filters.endDate, filters.includeArchived, permissionsLoaded, canViewAllRecords]);

    const loadReportData = async ({ forceRefresh = false, silent = false }: { forceRefresh?: boolean; silent?: boolean } = {}) => {
        // Visitor Mode Bypass
        if (window.mentorshipPlatformData?.visitor_mode) {
            setReportData([]);
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        if (forceRefresh) setIsRefreshing(true);
        try {
            const apiFilters = {
                start_date: filters.startDate,
                end_date: filters.endDate,
                include_archived: filters.includeArchived,
                force_refresh: forceRefresh,
            };

            let data: UserComplianceData[] = [];
            
            switch (activeTab) {
                case 'scan_audits':
                    data = await getScanAuditComplianceReport(apiFilters);
                    break;
                case 'live_drills':
                    data = await getLiveDrillComplianceReport(apiFilters);
                    break;
                case 'inservice':
                    data = await getInServiceComplianceReport(apiFilters);
                    break;
            }

            // Filter data based on permissions
            if (!canViewAllRecords && currentUser) {
                data = data.filter(user => user.user_id === currentUser.id);
            }

            // Apply target count from filters to all users
            data = data.map(user => ({
                ...user,
                target_count: filters.targetCount
            }));

            setReportData(data);
            setLastRefreshed(new Date());
        } catch (error) {
            console.error('Error loading report data:', error);
            setReportData([]);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleTimeFrameChange = (timeFrame: TimeFrame) => {
        setFilters(prev => ({ ...prev, timeFrame }));
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleDownloadCSV = () => {
        if (reportData.length === 0) {
            alert('No data to export');
            return;
        }

        let reportName = '';
        let csvData: any[] = [];

        switch (activeTab) {
            case 'scan_audits':
                reportName = 'scan_audits_compliance_report';
                csvData = reportData.map(user => ({
                    'Name': user.display_name,
                    'Role': user.job_role || '',
                    'Participated': user.participated_count || 0,
                    'Conducted': user.conducted_count || 0,
                    'Target': user.target_count || 0,
                    '% of Target': user.target_count > 0 ? `${Math.round((user.participated_count / user.target_count) * 100)}%` : 'N/A',
                    'Last Audit': user.last_activity_date || 'Never',
                }));
                break;

            case 'live_drills':
                reportName = 'live_drills_compliance_report';
                csvData = reportData.map(user => ({
                    'Name': user.display_name,
                    'Role': user.job_role || '',
                    'Subject Of (Total)': user.participated_count || 0,
                    'Pass': user.participated_pass || 0,
                    'Passed w/ Remediation': user.participated_remediation || 0,
                    'Fail': user.participated_fail || 0,
                    'Conducted': user.conducted_count || 0,
                    'Target': user.target_count || 0,
                    '% of Target': user.target_count > 0 ? `${Math.round((user.participated_count / user.target_count) * 100)}%` : 'N/A',
                    'Last Drill': user.last_date || 'Never',
                }));
                break;

            case 'inservice':
                reportName = 'inservice_training_compliance_report';
                csvData = reportData.map(user => ({
                    'Name': user.display_name,
                    'Role': user.job_role || '',
                    'Sessions Attended': user.attended_count || 0,
                    'Hours Attended': user.hours_attended ?? 0,
                    'Sessions Led': user.sessions_led || user.led_count || 0,
                    'Hours Led': user.hours_led ?? 0,
                    'No-Shows': user.no_show_count || 0,
                    'Last Training': user.last_date ? new Date(user.last_date).toLocaleDateString() : 'Never',
                }));
                break;
        }

        downloadCSV(csvData, reportName);
    };

    const getRowBackgroundColor = (count: number, target: number): string => {
        if (target === 0) return 'bg-white';
        
        const percentage = (count / target) * 100;
        
        if (percentage >= 100) return 'bg-green-100';
        if (percentage >= 80) return 'bg-green-50';
        if (percentage >= 30) return 'bg-orange-50';
        return 'bg-red-50';
    };

    const getPercentage = (count: number, target: number): number => {
        if (target === 0) return 0;
        return Math.round((count / target) * 100);
    };

    // Filter data by search query, result type, and target status
    const filteredData = reportData.filter(user => {
        // Search filter
        const matchesSearch = user.display_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
            user.job_role.toLowerCase().includes(filters.searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;
        
        // Result type filter (only for live drills)
        if (activeTab === 'live_drills' && filters.resultFilter !== 'all') {
            switch (filters.resultFilter) {
                case 'pass':
                    if ((user.participated_pass || 0) === 0) return false;
                    break;
                case 'remediation':
                    if ((user.participated_remediation || 0) === 0) return false;
                    break;
                case 'fail':
                    if ((user.participated_fail || 0) === 0) return false;
                    break;
            }
        }
        
        // Target filter (met/not met based on PASS count for live drills, total for others)
        if (filters.targetFilter !== 'all') {
            const targetCount = filters.targetCount;
            let countToCompare = user.participated_count || 0;
            
            // For live drills, "Met Target" should be based on PASS count (including remediation as a pass)
            if (activeTab === 'live_drills') {
                countToCompare = (user.participated_pass || 0) + (user.participated_remediation || 0);
            } else if (activeTab === 'inservice') {
                countToCompare = user.attended_count || 0;
            }
            
            const metTarget = countToCompare >= targetCount;
            
            if (filters.targetFilter === 'met' && !metTarget) return false;
            if (filters.targetFilter === 'not_met' && metTarget) return false;
        }
        
        return true;
    });

    // Sort data
    const sortedData = [...filteredData].sort((a, b) => {
        let aVal: any = a[sortColumn as keyof UserReportData];
        let bVal: any = b[sortColumn as keyof UserReportData];
        
        if (sortColumn === 'percentage') {
            aVal = getPercentage(a.participated_count, a.target_count);
            bVal = getPercentage(b.participated_count, b.target_count);
        } else if (sortColumn === 'display_name') {
            // Sort by last name, then first name
            const aNames = a.display_name.split(' ');
            const bNames = b.display_name.split(' ');
            const aLast = (aNames.length > 1 ? aNames[aNames.length - 1] : a.display_name).toLowerCase();
            const bLast = (bNames.length > 1 ? bNames[bNames.length - 1] : b.display_name).toLowerCase();
            const aFirst = (aNames.length > 1 ? aNames.slice(0, -1).join(' ') : '').toLowerCase();
            const bFirst = (bNames.length > 1 ? bNames.slice(0, -1).join(' ') : '').toLowerCase();
            
            const lastNameCompare = aLast.localeCompare(bLast);
            if (lastNameCompare !== 0) {
                return sortDirection === 'asc' ? lastNameCompare : -lastNameCompare;
            }
            const firstNameCompare = aFirst.localeCompare(bFirst);
            return sortDirection === 'asc' ? firstNameCompare : -firstNameCompare;
        }
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = (bVal as string).toLowerCase();
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const renderScanAuditsTable = () => (
        <div className="ap-overflow-x-auto">
            <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                <thead className="ap-bg-gray-50">
                    <tr>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('display_name')}
                        >
                            Name {sortColumn === 'display_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('job_role')}
                        >
                            Role {sortColumn === 'job_role' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('participated_count')}
                        >
                            Participated {sortColumn === 'participated_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('conducted_count')}
                        >
                            Conducted {sortColumn === 'conducted_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('target_count')}
                        >
                            Target {sortColumn === 'target_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('percentage')}
                        >
                            % of Target {sortColumn === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                            Last Audit
                        </th>
                    </tr>
                </thead>
                <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                    {sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-500">
                                No data available for the selected time period
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((user) => (
                            <tr 
                                key={user.user_id}
                                className={getRowBackgroundColor(user.participated_count, user.target_count)}
                            >
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                    {user.display_name}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.job_role}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                    {user.participated_count}
                                    <span className="ap-text-xs ap-text-gray-500 ap-ml-2">
                                        (Pass: <span className="ap-text-green-600 ap-font-medium">{user.participated_pass}</span> / 
                                        Fail: <span className="ap-text-red-600 ap-font-medium">{user.participated_fail}</span>)
                                    </span>
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                    {user.conducted_count}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.target_count}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                    {getPercentage(user.participated_count, user.target_count)}%
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.last_date ? new Date(user.last_date).toLocaleDateString() : 'Never'}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderLiveDrillsTable = () => (
        <div className="ap-overflow-x-auto">
            {/* Legend for result types */}
            <div className="ap-mb-3 ap-px-4 ap-py-2 ap-bg-gray-50 ap-rounded-t-lg ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-4 ap-text-xs ap-text-gray-600">
                    <span className="ap-font-medium">Subject Of results:</span>
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-bg-green-500 ap-rounded-full"></span>
                        <span className="ap-text-green-600 ap-font-medium">Pass</span>
                    </span>
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-bg-amber-500 ap-rounded-full"></span>
                        <span className="ap-text-amber-600 ap-font-medium">Passed w/ Remediation</span>
                    </span>
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-bg-red-500 ap-rounded-full"></span>
                        <span className="ap-text-red-600 ap-font-medium">Fail</span>
                    </span>
                    <span className="ap-ml-4 ap-text-gray-500 ap-italic">
                        ("Met Target" = Pass + Remediation count ≥ Target)
                    </span>
                </div>
            </div>
            <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                <thead className="ap-bg-gray-50">
                    <tr>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('display_name')}
                        >
                            Name {sortColumn === 'display_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('job_role')}
                        >
                            Role {sortColumn === 'job_role' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('participated_count')}
                        >
                            Subject Of {sortColumn === 'participated_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('conducted_count')}
                        >
                            Conducted {sortColumn === 'conducted_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('target_count')}
                        >
                            Target {sortColumn === 'target_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('percentage')}
                        >
                            % of Target {sortColumn === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                            Last Drill
                        </th>
                    </tr>
                </thead>
                <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                    {sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-500">
                                No data available for the selected time period
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((user) => (
                            <tr 
                                key={user.user_id}
                                className={getRowBackgroundColor(user.participated_count, user.target_count)}
                            >
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                    {user.display_name}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.job_role}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                    {user.participated_count}
                                    <span className="ap-text-xs ap-text-gray-500 ap-ml-2">
                                        (<span className="ap-text-green-600 ap-font-medium">{user.participated_pass}</span>
                                        {(user.participated_remediation ?? 0) > 0 && (
                                            <> / <span className="ap-text-amber-600 ap-font-medium">{user.participated_remediation}</span></>
                                        )}
                                         / <span className="ap-text-red-600 ap-font-medium">{user.participated_fail}</span>)
                                    </span>
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                    {user.conducted_count}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.target_count}
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                    {getPercentage(user.participated_count, user.target_count)}%
                                </td>
                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                    {user.last_date ? new Date(user.last_date).toLocaleDateString() : 'Never'}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderInServiceTable = () => (
        <div className="ap-overflow-x-auto">
            <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                <thead className="ap-bg-gray-50">
                    <tr>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('display_name')}
                        >
                            Name {sortColumn === 'display_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('job_role')}
                        >
                            Role {sortColumn === 'job_role' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('attended_count')}
                        >
                            Attended {sortColumn === 'attended_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('led_count')}
                        >
                            Led {sortColumn === 'led_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('no_show_count')}
                        >
                            No-Shows {sortColumn === 'no_show_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('target_count')}
                        >
                            Target {sortColumn === 'target_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                            className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                            onClick={() => handleSort('percentage')}
                        >
                            % of Target {sortColumn === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                            Last Training
                        </th>
                    </tr>
                </thead>
                <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                    {sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-500">
                                No data available for the selected time period
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((user) => {
                            const hasNoShows = (user.no_show_count || 0) > 0;
                            const rowColor = hasNoShows 
                                ? 'bg-yellow-50' 
                                : getRowBackgroundColor(user.attended_count || 0, user.target_count);
                            
                            return (
                                <tr 
                                    key={user.user_id}
                                    className={rowColor}
                                >
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                        {user.display_name}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                        {user.job_role}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                        {user.attended_count || 0}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                        {user.led_count || 0}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm">
                                        <span className={hasNoShows ? 'ap-text-amber-700 ap-font-medium' : 'ap-text-gray-900'}>
                                            {user.no_show_count || 0}
                                        </span>
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                        {user.target_count}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                        {getPercentage(user.attended_count || 0, user.target_count)}%
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                        {user.last_date ? new Date(user.last_date).toLocaleDateString() : 'Never'}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="ap-max-w-7xl ap-mx-auto ap-px-4 ap-py-6">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg">
                {/* Header */}
                <div className="ap-px-6 ap-py-5 ap-border-b ap-border-gray-200">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                        <div className="ap-flex ap-items-center">
                            <ChartIcon className="ap-h-8 ap-w-8 ap-text-blue-600 ap-mr-3" />
                            <div>
                                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Compliance Reports</h1>
                                <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                                    Track participation and fair distribution of audits, drills, and training
                                </p>
                                {lastRefreshed && (
                                    <p className="ap-text-xs ap-text-gray-400 ap-mt-0.5">
                                        Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-4 ap-gap-4 ap-mt-4">
                        {/* Time Frame Selector */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Time Period
                            </label>
                            <select
                                value={filters.timeFrame}
                                onChange={(e) => handleTimeFrameChange(e.target.value as TimeFrame)}
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                            >
                                <option value="3months">Last 3 Months</option>
                                <option value="6months">Last 6 Months</option>
                                <option value="12months">Last 12 Months</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {filters.timeFrame === 'custom' && (
                            <>
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {/* Target Count */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Target Count
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={filters.targetCount}
                                onChange={(e) => setFilters(prev => ({ ...prev, targetCount: parseInt(e.target.value) || 1 }))}
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                            />
                        </div>

                        {/* Search */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Search Users
                            </label>
                            <div className="ap-relative">
                                <div className="ap-absolute ap-inset-y-0 ap-left-0 ap-pl-3 ap-flex ap-items-center ap-pointer-events-none">
                                    <SearchIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={filters.searchQuery}
                                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                                    placeholder="Search by name..."
                                    className="ap-block ap-w-full ap-pl-10 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-leading-5 ap-bg-white ap-placeholder-gray-500 focus:ap-outline-none focus:ap-placeholder-gray-400 focus:ap-ring-1 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Include Archived Toggle and Export Button */}
                    <div className="ap-mt-4 ap-flex ap-items-center ap-justify-between">
                        <label className="ap-inline-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.includeArchived}
                                onChange={(e) => setFilters(prev => ({ ...prev, includeArchived: e.target.checked }))}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">Include archived records</span>
                        </label>
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <Button
                                onClick={() => loadReportData({ forceRefresh: true })}
                                variant="outline"
                                size="sm"
                                title="Force-refresh data from server, bypassing cache"
                                disabled={isRefreshing}
                            >
                                <RefreshIcon className={`ap-h-4 ap-w-4 ap-mr-1 ${isRefreshing ? 'ap-animate-spin' : ''}`} />
                                {isRefreshing ? 'Refreshing…' : 'Refresh'}
                            </Button>
                            <Button
                                onClick={handleDownloadCSV}
                                variant="outline"
                                size="sm"
                                title="Download current report as CSV"
                            >
                                <DownloadIcon className="ap-h-4 ap-w-4 ap-mr-2" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                    
                    {/* Result Type and Target Filters */}
                    <div className="ap-mt-4 ap-flex ap-flex-wrap ap-items-center ap-gap-4">
                        {/* Target Met Filter - always show */}
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <span className="ap-text-sm ap-font-medium ap-text-gray-700">Target Status:</span>
                            <div className="ap-flex ap-gap-1">
                                <Button
                                    onClick={() => setFilters(prev => ({ ...prev, targetFilter: 'all' }))}
                                    variant="ghost"
                                    size="xs"
                                    className={filters.targetFilter === 'all'
                                        ? '!ap-bg-gray-800 !ap-text-white' : '!ap-bg-gray-100 !ap-text-gray-700 hover:!ap-bg-gray-200'
                                    }
                                >
                                    All
                                </Button>
                                <Button
                                    onClick={() => setFilters(prev => ({ ...prev, targetFilter: 'met' }))}
                                    variant="ghost"
                                    size="xs"
                                    className={filters.targetFilter === 'met'
                                        ? '!ap-bg-green-600 !ap-text-white' : '!ap-bg-green-100 !ap-text-green-700 hover:!ap-bg-green-200'
                                    }
                                >
                                    Met Target
                                </Button>
                                <Button
                                    onClick={() => setFilters(prev => ({ ...prev, targetFilter: 'not_met' }))}
                                    variant="ghost"
                                    size="xs"
                                    className={filters.targetFilter === 'not_met'
                                        ? '!ap-bg-red-600 !ap-text-white' : '!ap-bg-red-100 !ap-text-red-700 hover:!ap-bg-red-200'
                                    }
                                >
                                    Not Met
                                </Button>
                            </div>
                        </div>
                        
                        {/* Result Type Filter - only show for live drills */}
                        {activeTab === 'live_drills' && (
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <span className="ap-text-sm ap-font-medium ap-text-gray-700">Has Result:</span>
                                <div className="ap-flex ap-gap-1">
                                    <Button
                                        onClick={() => setFilters(prev => ({ ...prev, resultFilter: 'all' }))}
                                        variant="ghost"
                                        size="xs"
                                        className={filters.resultFilter === 'all'
                                            ? '!ap-bg-gray-800 !ap-text-white' : '!ap-bg-gray-100 !ap-text-gray-700 hover:!ap-bg-gray-200'
                                        }
                                    >
                                        All
                                    </Button>
                                    <Button
                                        onClick={() => setFilters(prev => ({ ...prev, resultFilter: 'pass' }))}
                                        variant="ghost"
                                        size="xs"
                                        className={filters.resultFilter === 'pass'
                                            ? '!ap-bg-green-600 !ap-text-white' : '!ap-bg-green-100 !ap-text-green-700 hover:!ap-bg-green-200'
                                        }
                                    >
                                        Pass
                                    </Button>
                                    <Button
                                        onClick={() => setFilters(prev => ({ ...prev, resultFilter: 'remediation' }))}
                                        variant="ghost"
                                        size="xs"
                                        className={filters.resultFilter === 'remediation'
                                            ? '!ap-bg-amber-600 !ap-text-white' : '!ap-bg-amber-100 !ap-text-amber-700 hover:!ap-bg-amber-200'
                                        }
                                    >
                                        Remediation
                                    </Button>
                                    <Button
                                        onClick={() => setFilters(prev => ({ ...prev, resultFilter: 'fail' }))}
                                        variant="ghost"
                                        size="xs"
                                        className={filters.resultFilter === 'fail'
                                            ? '!ap-bg-red-600 !ap-text-white' : '!ap-bg-red-100 !ap-text-red-700 hover:!ap-bg-red-200'
                                        }
                                    >
                                        Fail
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        {/* Filter info */}
                        <div className="ap-text-sm ap-text-gray-500">
                            Showing {sortedData.length} of {reportData.length} users
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="ap-border-b ap-border-gray-200">
                    <nav className="-ap-mb-px ap-flex ap-flex-wrap ap-gap-2 ap-px-4 sm:ap-px-6">
                        <Button
                            onClick={() => setActiveTab('scan_audits')}
                            variant="ghost"
                            className={`${
                                activeTab === 'scan_audits'
                                    ? '!ap-border-blue-500 !ap-bg-blue-50 !ap-text-blue-600 !ap-border-b-0' : '!ap-border-purple-300 !ap-bg-purple-100 !ap-text-gray-700 hover:!ap-bg-blue-50 hover:!ap-border-blue-500'
                            } !ap-whitespace-nowrap !ap-py-2.5 !ap-px-3 sm:!ap-py-3 sm:!ap-px-4 !ap-border-2 !ap-rounded-t-lg !ap-font-medium !ap-text-xs sm:!ap-text-sm`}
                        >
                            Scan Audits
                        </Button>
                        <Button
                            onClick={() => setActiveTab('live_drills')}
                            variant="ghost"
                            className={`${
                                activeTab === 'live_drills'
                                    ? '!ap-border-blue-500 !ap-bg-blue-50 !ap-text-blue-600 !ap-border-b-0' : '!ap-border-purple-300 !ap-bg-purple-100 !ap-text-gray-700 hover:!ap-bg-blue-50 hover:!ap-border-blue-500'
                            } !ap-whitespace-nowrap !ap-py-2.5 !ap-px-3 sm:!ap-py-3 sm:!ap-px-4 !ap-border-2 !ap-rounded-t-lg !ap-font-medium !ap-text-xs sm:!ap-text-sm`}
                        >
                            Live Recognition Drills
                        </Button>
                        <Button
                            onClick={() => setActiveTab('inservice')}
                            variant="ghost"
                            className={`${
                                activeTab === 'inservice'
                                    ? '!ap-border-blue-500 !ap-bg-blue-50 !ap-text-blue-600 !ap-border-b-0' : '!ap-border-purple-300 !ap-bg-purple-100 !ap-text-gray-700 hover:!ap-bg-blue-50 hover:!ap-border-blue-500'
                            } !ap-whitespace-nowrap !ap-py-2.5 !ap-px-3 sm:!ap-py-3 sm:!ap-px-4 !ap-border-2 !ap-rounded-t-lg !ap-font-medium !ap-text-xs sm:!ap-text-sm`}
                        >
                            In-Service Training
                        </Button>
                    </nav>
                </div>

                {/* Table Content */}
                <div className="ap-p-6">
                    {loading ? (
                        <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                            <LoadingSpinner />
                            <span className="ap-ml-3 ap-text-gray-600">Loading report data...</span>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'scan_audits' && renderScanAuditsTable()}
                            {activeTab === 'live_drills' && renderLiveDrillsTable()}
                            {activeTab === 'inservice' && renderInServiceTable()}
                        </>
                    )}
                </div>

                {/* Color Legend */}
                <div className="ap-px-6 ap-pb-6">
                    <div className="ap-flex ap-items-center ap-space-x-6 ap-text-xs ap-text-gray-600">
                        <div className="ap-flex ap-items-center">
                            <div className="ap-w-4 ap-h-4 ap-bg-red-50 ap-border ap-border-gray-200 ap-rounded ap-mr-2"></div>
                            <span>&lt; 30% of target</span>
                        </div>
                        <div className="ap-flex ap-items-center">
                            <div className="ap-w-4 ap-h-4 ap-bg-orange-50 ap-border ap-border-gray-200 ap-rounded ap-mr-2"></div>
                            <span>30-79% of target</span>
                        </div>
                        <div className="ap-flex ap-items-center">
                            <div className="ap-w-4 ap-h-4 ap-bg-green-50 ap-border ap-border-gray-200 ap-rounded ap-mr-2"></div>
                            <span>80-99% of target</span>
                        </div>
                        <div className="ap-flex ap-items-center">
                            <div className="ap-w-4 ap-h-4 ap-bg-green-100 ap-border ap-border-gray-200 ap-rounded ap-mr-2"></div>
                            <span>≥ 100% of target</span>
                        </div>
                        {activeTab === 'inservice' && (
                            <div className="ap-flex ap-items-center">
                                <div className="ap-w-4 ap-h-4 ap-bg-yellow-50 ap-border ap-border-gray-200 ap-rounded ap-mr-2"></div>
                                <span>Has no-shows (warning)</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplianceReports;
