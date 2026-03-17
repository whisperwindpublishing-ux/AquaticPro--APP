import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile } from '@/types';
import Card from './ui/Card';
import { Button } from '@/components/ui/Button';
import { 
    getInServiceLogs, 
    createInServiceLog,
    updateInServiceLog,
    deleteInServiceLog,
    archiveInServiceLog,
    restoreInServiceLog,
    getInServiceSummary,
    getInServiceTeamStats,
    getJobRoles,
    getMyPermissions,
    InServiceLog as InServiceLogType,
    InServiceSummary,
    JobRole
} from '../services/api-professional-growth';
import { UserMetadata } from '../services/api-user-management';
import { getCachedUsers } from '../services/userCache';
import RichTextEditor from './RichTextEditor';
import UserSelector, { UserOption } from './UserSelector';
import InServiceUserTable from './InServiceUserTable';
import MemoizedHtml from './MemoizedHtml';
import { downloadCSV, formatDateForCSV } from '../utils/csvExport';
import { 
    HiPlus as PlusIcon, 
    HiCalendar as CalendarIcon, 
    HiClock as ClockIcon,
    HiPencil as EditIcon,
    HiSearch as SearchIcon,
    HiArchive as ArchiveIcon,
    HiRefresh as UnarchiveIcon,
    HiCheck as CheckIcon,
    HiDownload as DownloadIcon,
    HiClipboardList as ClipboardListIcon,
    HiChevronDown as ChevronDownIcon,
    HiChevronUp as ChevronUpIcon
} from 'react-icons/hi';

interface InServiceLogProps {
    currentUser: UserProfile;
}

type SortField = 'training_date' | 'topic' | 'duration_hours' | 'location';
type SortDirection = 'asc' | 'desc';

const InServiceLog: React.FC<InServiceLogProps> = ({ currentUser }) => {
    // Get permissions for current user from backend (includes fallback to user meta)
    const [permissions, setPermissions] = useState({
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canModerateAll: false,
        loading: true,
        error: null as string | null,
    });
    
    // Check if in visitor mode
    const isVisitorMode = window.mentorshipPlatformData?.visitor_mode;

    const [logs, setLogs] = useState<InServiceLogType[]>([]);
    const [users, setUsers] = useState<UserMetadata[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [summary, setSummary] = useState<InServiceSummary | null>(null);
    const [lastMonthStats, setLastMonthStats] = useState<{
        month: string;
        total_hours_offered: number;
        employees_count: number;
        employees_met_requirement: number;
        employees_did_not_meet: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingLog, setEditingLog] = useState<InServiceLogType | null>(null);
    const [viewMode, setViewMode] = useState(false);
    
    // User selection for viewing progress
    const [selectedUserId, setSelectedUserId] = useState<number>(currentUser.id);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    
    // Tab selection
    const [activeTab, setActiveTab] = useState<'logs' | 'compliance'>('logs');
    
    // Table controls
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('training_date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showArchived, setShowArchived] = useState(false);
    
    // Bulk selection
    const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
    
    // Training history for selected user
    const [showTrainingHistory, setShowTrainingHistory] = useState(false);
    const [trainingHistory, setTrainingHistory] = useState<InServiceLogType[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    
    // Search filters for each section in modal
    const [leaderSearch, setLeaderSearch] = useState('');
    const [attendeeSearch, setAttendeeSearch] = useState('');
    const [noShowSearch, setNoShowSearch] = useState('');
    
    // Form state
    const [formData, setFormData] = useState({
        training_date: new Date().toISOString().split('T')[0],
        training_time: '',
        location: '',
        duration_hours: 1,
        topic: '',
        details: '',
        leaders: [] as number[],
        attendees: [] as number[],
        no_shows: [] as number[],
        job_roles: [] as number[]
    });

    // Memoized form field update handlers to prevent re-renders
    const updateFormField = useCallback(<K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    // Fetch permissions from backend
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                setPermissions(prev => ({ ...prev, loading: true }));
                const perms = await getMyPermissions();
                setPermissions({
                    canView: perms.inservicePermissions?.canView ?? true,
                    canCreate: perms.inservicePermissions?.canCreate ?? false,
                    canEdit: perms.inservicePermissions?.canEdit ?? false,
                    canDelete: perms.inservicePermissions?.canDelete ?? false,
                    canModerateAll: perms.inservicePermissions?.canModerateAll ?? false,
                    loading: false,
                    error: null,
                });
            } catch (error) {
                console.error('Failed to fetch permissions:', error);
                setPermissions({
                    canView: true,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load permissions',
                });
            }
        };
        fetchPermissions();
    }, []);

    useEffect(() => {
        loadData();
    }, [showArchived]);

    // Load summaries when selected user changes
    useEffect(() => {
        console.log('=== useEffect for selectedUserId triggered ===');
        console.log('isLoading:', isLoading, 'jobRoles.length:', jobRoles.length, 'selectedUserId:', selectedUserId);
        if (!isLoading && jobRoles.length > 0) {
            console.log('Calling loadSummariesForUser with:', selectedUserId);
            loadSummariesForUser(selectedUserId);
        }
    }, [selectedUserId, jobRoles, isLoading]);

    const loadData = async () => {
        try {
            setIsLoading(true);

            // Visitor Mode Bypass
            if (isVisitorMode) {
                setLogs([]);
                setUsers([]);
                setJobRoles([]);
                return;
            }

            const currentMonth = new Date().toISOString().substring(0, 7);
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const lastMonthStr = lastMonth.toISOString().substring(0, 7);
            
            const [logsData, usersData, jobRolesData, teamStatsData] = await Promise.all([
                getInServiceLogs({ include_archived: showArchived }),
                getCachedUsers(), // Use centralized cache - already sorted
                getJobRoles(),
                getInServiceTeamStats(lastMonthStr)
            ]);
            console.log('Users loaded:', usersData.length, 'Sample user:', usersData[0]);
            setLogs(logsData);
            setUsers(usersData);
            setJobRoles(jobRolesData);
            setLastMonthStats(teamStatsData);
            
            // After loading basic data, load summaries for currently selected user
            if (jobRolesData.length > 0) {
                const summaryData = await getInServiceSummary(selectedUserId, currentMonth);
                setSummary(summaryData);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSummariesForUser = async (userId: number) => {
        try {
            setIsSummaryLoading(true);
            const currentMonth = new Date().toISOString().substring(0, 7);
            console.log('=== loadSummariesForUser called ===');
            console.log('userId parameter:', userId);
            console.log('typeof userId:', typeof userId);
            console.log('selectedUserId state:', selectedUserId);
            console.log('currentMonth:', currentMonth);
            const summaryData = await getInServiceSummary(userId, currentMonth);
            console.log('Summary data received:', summaryData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error loading summaries for user:', error);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    // Reset training history when user changes
    useEffect(() => {
        setShowTrainingHistory(false);
        setTrainingHistory([]);
    }, [selectedUserId]);

    const loadTrainingHistory = useCallback(async () => {
        if (showTrainingHistory) {
            // Toggle off
            setShowTrainingHistory(false);
            return;
        }
        try {
            setIsHistoryLoading(true);
            const allLogs = await getInServiceLogs({ user_id: selectedUserId, include_archived: true });
            // Filter to only logs where the selected user is a leader or attendee (not no-show only)
            const participatedLogs = allLogs.filter(log =>
                log.leaders?.some(l => l.id === selectedUserId) ||
                log.attendees?.some(a => a.id === selectedUserId)
            );
            // Sort by date descending
            participatedLogs.sort((a, b) => new Date(b.training_date).getTime() - new Date(a.training_date).getTime());
            setTrainingHistory(participatedLogs);
            setShowTrainingHistory(true);
        } catch (error) {
            console.error('Error loading training history:', error);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [selectedUserId, showTrainingHistory]);

    // Filtered and sorted logs
    const filteredAndSortedLogs = useMemo(() => {
        let filtered = logs;

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = logs.filter(log => 
                log.topic.toLowerCase().includes(query) ||
                log.location?.toLowerCase().includes(query) ||
                log.details?.toLowerCase().includes(query) ||
                log.leaders?.some(l => l.name.toLowerCase().includes(query)) ||
                log.attendees?.some(a => a.name.toLowerCase().includes(query))
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any = a[sortField];
            let bVal: any = b[sortField];

            // Handle null/undefined values
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Compare values
            if (typeof aVal === 'string') {
                return sortDirection === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return sortDirection === 'asc'
                    ? aVal - bVal
                    : bVal - aVal;
            }
        });

        return sorted;
    }, [logs, searchQuery, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? ' ↑' : ' ↓';
    };

    const handleOpenModal = (log?: InServiceLogType, isViewOnly: boolean = false) => {
        if (log) {
            setEditingLog(log);
            setViewMode(isViewOnly);
            setFormData({
                training_date: log.training_date,
                training_time: log.training_time || '',
                location: log.location || '',
                duration_hours: log.duration_hours,
                topic: log.topic,
                details: log.details || '',
                // Ensure IDs are numbers for proper comparison with user.id in checkbox checked state
                leaders: log.leaders?.map(l => Number(l.id)) || [],
                attendees: log.attendees?.map(a => Number(a.id)) || [],
                no_shows: log.no_shows?.map(n => Number(n.id)) || [],
                job_roles: log.job_roles?.map(jr => Number(jr.id)) || []
            });
        } else {
            setEditingLog(null);
            setViewMode(false);
            setFormData({
                training_date: new Date().toISOString().split('T')[0],
                training_time: '',
                location: '',
                duration_hours: 1,
                topic: '',
                details: '',
                leaders: [],
                attendees: [],
                no_shows: [],
                job_roles: []
            });
        }
        setLeaderSearch('');
        setAttendeeSearch('');
        setNoShowSearch('');
        setShowForm(true);
    };

    const handleCloseModal = () => {
        setShowForm(false);
        setEditingLog(null);
        setViewMode(false);
        setLeaderSearch('');
        setAttendeeSearch('');
        setNoShowSearch('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const logData = {
                training_date: formData.training_date,
                training_time: formData.training_time || undefined,
                location: formData.location || undefined,
                duration_hours: formData.duration_hours,
                topic: formData.topic,
                details: formData.details || undefined,
                leaders: formData.leaders,
                attendees: formData.attendees,
                no_shows: formData.no_shows,
                job_roles: formData.job_roles
            };

            if (editingLog) {
                await updateInServiceLog(editingLog.id, logData);
            } else {
                await createInServiceLog(logData);
            }
            
            handleCloseModal();
            loadData();
        } catch (error) {
            console.error('Error saving training log:', error);
            alert('Failed to save training log');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteInServiceLog(id);
            handleCloseModal();
            loadData();
        } catch (error) {
            console.error('Error deleting training log:', error);
            alert('Failed to delete training log');
        }
    };

    const handleArchive = async (id: number) => {
        if (!confirm('Are you sure you want to archive this training log?')) {
            return;
        }

        try {
            await archiveInServiceLog(id);
            handleCloseModal();
            loadData();
        } catch (error) {
            console.error('Error archiving training log:', error);
            alert('Failed to archive training log');
        }
    };

    const handleRestore = async (id: number) => {
        try {
            await restoreInServiceLog(id);
            handleCloseModal();
            loadData();
        } catch (error) {
            console.error('Error restoring training log:', error);
            alert('Failed to restore training log');
        }
    };

    const handleToggleSelect = (logId: number) => {
        setSelectedLogs(prev => 
            prev.includes(logId) 
                ? prev.filter(id => id !== logId)
                : [...prev, logId]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedLogs.length === filteredAndSortedLogs.length) {
            setSelectedLogs([]);
        } else {
            setSelectedLogs(filteredAndSortedLogs.map(log => log.id));
        }
    };

    const handleBulkArchive = async () => {
        const nonArchivedSelected = selectedLogs.filter(id => 
            !logs.find(log => log.id === id)?.archived
        );

        if (nonArchivedSelected.length === 0) {
            alert('No non-archived logs selected');
            return;
        }

        if (!confirm(`Are you sure you want to archive ${nonArchivedSelected.length} training log(s)?`)) {
            return;
        }

        try {
            // Import will be added to api-professional-growth.ts
            const { bulkArchiveInServiceLogs } = await import('../services/api-professional-growth');
            await bulkArchiveInServiceLogs(nonArchivedSelected);
            setSelectedLogs([]);
            loadData();
        } catch (error) {
            console.error('Error bulk archiving training logs:', error);
            alert('Failed to archive training logs');
        }
    };

    const handleBulkRestore = async () => {
        const archivedSelected = selectedLogs.filter(id => 
            logs.find(log => log.id === id)?.archived
        );

        if (archivedSelected.length === 0) {
            alert('No archived logs selected');
            return;
        }

        if (!confirm(`Are you sure you want to restore ${archivedSelected.length} training log(s)?`)) {
            return;
        }

        try {
            // Import will be added to api-professional-growth.ts
            const { bulkRestoreInServiceLogs } = await import('../services/api-professional-growth');
            await bulkRestoreInServiceLogs(archivedSelected);
            setSelectedLogs([]);
            loadData();
        } catch (error) {
            console.error('Error bulk restoring training logs:', error);
            alert('Failed to restore training logs');
        }
    };

    const handleDownloadCSV = async () => {
        try {
            // Fetch all logs including archived
            const allLogs = await getInServiceLogs({ include_archived: true });
            
            if (allLogs.length === 0) {
                alert('No training logs to export');
                return;
            }

            // Prepare data for CSV
            const csvData = allLogs.map(log => {
                const leaderNames = log.leaders?.map(l => l.name).join('; ') || '';
                const attendeeNames = log.attendees?.map(a => a.name).join('; ') || '';
                const noShowNames = log.no_shows?.map(n => n.name).join('; ') || '';
                const jobRoleNames = log.job_roles?.map(r => r.title).join('; ') || '';

                return {
                    'Date': formatDateForCSV(log.training_date),
                    'Time': log.training_time || '',
                    'Location': log.location || '',
                    'Duration (Hours)': log.duration_hours || 0,
                    'Topic': log.topic || '',
                    'Details': (log.details || '').replace(/<[^>]*>/g, ''), // Strip HTML
                    'Leaders': leaderNames,
                    'Attendees': attendeeNames,
                    'No Shows': noShowNames,
                    'Job Roles': jobRoleNames,
                    'Archived': log.archived ? 'Yes' : 'No',
                    'Created By': log.created_by_name || '',
                    'Created At': formatDateForCSV(log.created_at),
                };
            });

            downloadCSV(csvData, 'inservice_training_logs');
        } catch (error) {
            console.error('Error downloading CSV:', error);
            alert('Failed to generate CSV export');
        }
    };

    const handleUserSelection = (userId: number, field: 'leaders' | 'attendees' | 'no_shows') => {
        const currentList = formData[field];
        if (currentList.includes(userId)) {
            setFormData({
                ...formData,
                [field]: currentList.filter(id => id !== userId)
            });
        } else {
            setFormData({
                ...formData,
                [field]: [...currentList, userId]
            });
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Filter users based on search - selected items always shown first
    // Note: users are already sorted by centralized cache
    const getFilteredLeaders = () => {
        const search = leaderSearch.toLowerCase();
        const filtered = search
            ? users.filter(user => user.display_name.toLowerCase().includes(search))
            : users;
        
        // Always include selected leaders at the top
        const selectedIds = new Set(formData.leaders);
        const selectedUsers = users.filter(u => selectedIds.has(u.user_id));
        const unselectedFiltered = filtered.filter(u => !selectedIds.has(u.user_id));
        
        return [...selectedUsers, ...unselectedFiltered].map(u => ({ id: u.user_id, name: u.display_name }));
    };

    const getFilteredAttendees = () => {
        const search = attendeeSearch.toLowerCase();
        const filtered = search
            ? users.filter(user => user.display_name.toLowerCase().includes(search))
            : users;
        
        // Always include selected attendees at the top
        const selectedIds = new Set(formData.attendees);
        const selectedUsers = users.filter(u => selectedIds.has(u.user_id));
        const unselectedFiltered = filtered.filter(u => !selectedIds.has(u.user_id));
        
        return [...selectedUsers, ...unselectedFiltered].map(u => ({ id: u.user_id, name: u.display_name }));
    };

    const getFilteredNoShows = () => {
        // Exclude users who are already selected as leaders or attendees
        const excludedIds = new Set([...formData.leaders, ...formData.attendees]);
        const availableUsers = users.filter(user => !excludedIds.has(user.user_id));
        
        const search = noShowSearch.toLowerCase();
        const filtered = search
            ? availableUsers.filter(user => user.display_name.toLowerCase().includes(search))
            : availableUsers;
        
        // Always include selected no-shows at the top
        const selectedIds = new Set(formData.no_shows);
        const selectedUsers = availableUsers.filter(u => selectedIds.has(u.user_id));
        const unselectedFiltered = filtered.filter(u => !selectedIds.has(u.user_id));
        
        return [...selectedUsers, ...unselectedFiltered].map(u => ({ id: u.user_id, name: u.display_name }));
    };

    // Show form if in create/edit mode
    if (showForm) {
        return (
            <div className="ap-max-w-7xl ap-mx-auto">
                <Card>
                    <Card.Body>
                        <div className="ap-mb-6">
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                                {viewMode ? 'Training Log Details' : (editingLog ? 'Edit Training Log' : 'New Training Log')}
                            </h2>
                            <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                                {viewMode 
                                    ? 'View training log information (read-only)'
                                    : (editingLog 
                                        ? 'Update the training log details' : 'Record a new in-service training session')
                                }
                            </p>
                        </div>
                    
                    <form onSubmit={handleSubmit} className="ap-space-y-6">
                        {/* Date, Time, Location, Duration */}
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-4 ap-gap-4">
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Date *
                                </label>
                                <input
                                    type="date"
                                    value={formData.training_date}
                                    onChange={(e) => updateFormField('training_date', e.target.value)}
                                    className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    required
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                />
                            </div>
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.training_time}
                                    onChange={(e) => updateFormField('training_time', e.target.value)}
                                    className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                />
                            </div>
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Duration (hours) *
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={formData.duration_hours}
                                    onChange={(e) => updateFormField('duration_hours', parseFloat(e.target.value))}
                                    className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    required
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                />
                            </div>
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => updateFormField('location', e.target.value)}
                                    placeholder="e.g., Conference Room A"
                                    className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    readOnly={viewMode}
                                    disabled={viewMode}
                                />
                            </div>
                        </div>

                        {/* Topic */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Topic *
                            </label>
                            <input
                                type="text"
                                value={formData.topic}
                                onChange={(e) => updateFormField('topic', e.target.value)}
                                placeholder="e.g., Customer Service Excellence"
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                required
                                readOnly={viewMode}
                                disabled={viewMode}
                            />
                        </div>

                        {/* Details */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Details
                            </label>
                            <RichTextEditor
                                value={formData.details}
                                onChange={(value) => updateFormField('details', value)}
                                placeholder="Add training details, objectives, or notes..."
                                readOnly={viewMode}
                            />
                        </div>

                        {/* Job Roles */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Applicable Job Roles
                            </label>
                            <div className="ap-space-y-2 ap-max-h-48 ap-overflow-y-auto ap-p-3 ap-border ap-border-gray-300 ap-rounded-md">
                                {jobRoles.map(role => (
                                    <label key={role.id} className="ap-flex ap-items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.job_roles.includes(role.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    updateFormField('job_roles', [...formData.job_roles, role.id]);
                                                } else {
                                                    updateFormField('job_roles', formData.job_roles.filter(id => id !== role.id));
                                                }
                                            }}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                            disabled={viewMode}
                                        />
                                        <span className="ap-ml-2 ap-text-sm ap-text-gray-700">{role.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* User selection sections - Full lists visible in 3-column grid */}
                        <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-3 ap-gap-4">
                            {/* Training Leaders */}
                            <div className="ap-flex ap-flex-col">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Training Leaders ({formData.leaders.length})
                                </label>
                                <div className="ap-border ap-border-gray-300 ap-rounded-md ap-p-3 ap-flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={leaderSearch}
                                        onChange={(e) => setLeaderSearch(e.target.value)}
                                        className="ap-w-full ap-mb-2 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-text-sm"
                                        disabled={viewMode}
                                    />
                                    <div className="ap-space-y-1">
                                        {getFilteredLeaders().map(user => (
                                            <label key={user.id} className="ap-flex ap-items-center ap-px-2 ap-py-1.5 hover:ap-bg-gray-50 ap-rounded ap-cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.leaders.includes(user.id)}
                                                    onChange={() => handleUserSelection(user.id, 'leaders')}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                                    disabled={viewMode}
                                                />
                                                <span className={`ap-ml-2 ap-text-sm ${formData.leaders.includes(user.id) ? 'ap-font-medium ap-text-blue-700' : ''}`}>{user.name}</span>
                                            </label>
                                        ))}
                                        {getFilteredLeaders().length === 0 && (
                                            <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-2">No staff found</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Attendees */}
                            <div className="ap-flex ap-flex-col">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Attendees ({formData.attendees.length})
                                </label>
                                <div className="ap-border ap-border-gray-300 ap-rounded-md ap-p-3 ap-flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={attendeeSearch}
                                        onChange={(e) => setAttendeeSearch(e.target.value)}
                                        className="ap-w-full ap-mb-2 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-text-sm"
                                        disabled={viewMode}
                                    />
                                    <div className="ap-space-y-1">
                                        {getFilteredAttendees().map(user => (
                                            <label key={user.id} className="ap-flex ap-items-center ap-px-2 ap-py-1.5 hover:ap-bg-gray-50 ap-rounded ap-cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.attendees.includes(user.id)}
                                                    onChange={() => handleUserSelection(user.id, 'attendees')}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                                    disabled={viewMode}
                                                />
                                                <span className={`ap-ml-2 ap-text-sm ${formData.attendees.includes(user.id) ? 'ap-font-medium ap-text-blue-700' : ''}`}>{user.name}</span>
                                            </label>
                                        ))}
                                        {getFilteredAttendees().length === 0 && (
                                            <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-2">No staff found</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* No-Shows */}
                            <div className="ap-flex ap-flex-col">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    No-Shows ({formData.no_shows.length})
                                </label>
                                <div className="ap-border ap-border-gray-300 ap-rounded-md ap-p-3 ap-flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={noShowSearch}
                                        onChange={(e) => setNoShowSearch(e.target.value)}
                                        className="ap-w-full ap-mb-2 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-text-sm"
                                        disabled={viewMode}
                                    />
                                    <div className="ap-space-y-1">
                                        {getFilteredNoShows().map(user => (
                                            <label key={user.id} className="ap-flex ap-items-center ap-px-2 ap-py-1.5 hover:ap-bg-gray-50 ap-rounded ap-cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.no_shows.includes(user.id)}
                                                    onChange={() => handleUserSelection(user.id, 'no_shows')}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                                    disabled={viewMode}
                                                />
                                                <span className={`ap-ml-2 ap-text-sm ${formData.no_shows.includes(user.id) ? 'ap-font-medium ap-text-blue-700' : ''}`}>{user.name}</span>
                                            </label>
                                        ))}
                                        {getFilteredNoShows().length === 0 && (
                                            <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-2">No staff found</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Selected Users Summary */}
                        {(formData.leaders.length > 0 || formData.attendees.length > 0 || formData.no_shows.length > 0) && (
                            <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-mt-4">
                                <h3 className="ap-text-sm ap-font-semibold ap-text-blue-900 ap-mb-3">Selected Staff Summary</h3>
                                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-4">
                                    {/* Leaders Summary */}
                                    {formData.leaders.length > 0 && (
                                        <div>
                                            <div className="ap-text-xs ap-font-medium ap-text-blue-700 ap-mb-2 ap-flex ap-items-center">
                                                <span className="ap-w-2 ap-h-2 ap-bg-green-500 ap-rounded-full ap-mr-2"></span>
                                                Leaders ({formData.leaders.length})
                                            </div>
                                            <div className="ap-space-y-1">
                                                {formData.leaders
                                                    .map(userId => users.find(u => String(u.user_id) === String(userId)))
                                                    .filter(user => user !== undefined)
                                                    .sort((a, b) => {
                                                        const aLast = a.display_name.split(' ').pop() || '';
                                                        const bLast = b.display_name.split(' ').pop() || '';
                                                        if (aLast !== bLast) return aLast.localeCompare(bLast);
                                                        return a.display_name.localeCompare(b.display_name);
                                                    })
                                                    .map(user => (
                                                        <div key={user.user_id} className="ap-flex ap-items-center ap-justify-between ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                                                            <span className="ap-text-gray-700">{user.display_name}</span>
                                                            <Button
                                                                type="button"
                                                                onClick={() => handleUserSelection(user.user_id, 'leaders')}
                                                                variant="ghost"
                                                                size="xs"
                                                                className="!ap-text-red-500 hover:!ap-text-red-700 !ap-ml-2 !ap-p-0 !ap-min-h-0"
                                                                title="Remove"
                                                            >
                                                                ×
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attendees Summary */}
                                    {formData.attendees.length > 0 && (
                                        <div>
                                            <div className="ap-text-xs ap-font-medium ap-text-blue-700 ap-mb-2 ap-flex ap-items-center">
                                                <span className="ap-w-2 ap-h-2 ap-bg-blue-500 ap-rounded-full ap-mr-2"></span>
                                                Attendees ({formData.attendees.length})
                                            </div>
                                            <div className="ap-space-y-1">
                                                {formData.attendees
                                                    .map(userId => users.find(u => String(u.user_id) === String(userId)))
                                                    .filter(user => user !== undefined)
                                                    .sort((a, b) => {
                                                        const aLast = a.display_name.split(' ').pop() || '';
                                                        const bLast = b.display_name.split(' ').pop() || '';
                                                        if (aLast !== bLast) return aLast.localeCompare(bLast);
                                                        return a.display_name.localeCompare(b.display_name);
                                                    })
                                                    .map(user => (
                                                        <div key={user.user_id} className="ap-flex ap-items-center ap-justify-between ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                                                            <span className="ap-text-gray-700">{user.display_name}</span>
                                                            <Button
                                                                type="button"
                                                                onClick={() => handleUserSelection(user.user_id, 'attendees')}
                                                                variant="ghost"
                                                                size="xs"
                                                                className="!ap-text-red-500 hover:!ap-text-red-700 !ap-ml-2 !ap-p-0 !ap-min-h-0"
                                                                title="Remove"
                                                            >
                                                                ×
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* No-Shows Summary */}
                                    {formData.no_shows.length > 0 && (
                                        <div>
                                            <div className="ap-text-xs ap-font-medium ap-text-blue-700 ap-mb-2 ap-flex ap-items-center">
                                                <span className="ap-w-2 ap-h-2 ap-bg-red-500 ap-rounded-full ap-mr-2"></span>
                                                No-Shows ({formData.no_shows.length})
                                            </div>
                                            <div className="ap-space-y-1">
                                                {formData.no_shows
                                                    .map(userId => users.find(u => String(u.user_id) === String(userId)))
                                                    .filter(user => user !== undefined)
                                                    .sort((a, b) => {
                                                        const aLast = a.display_name.split(' ').pop() || '';
                                                        const bLast = b.display_name.split(' ').pop() || '';
                                                        if (aLast !== bLast) return aLast.localeCompare(bLast);
                                                        return a.display_name.localeCompare(b.display_name);
                                                    })
                                                    .map(user => (
                                                        <div key={user.user_id} className="ap-flex ap-items-center ap-justify-between ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                                                            <span className="ap-text-gray-700">{user.display_name}</span>
                                                            <Button
                                                                type="button"
                                                                onClick={() => handleUserSelection(user.user_id, 'no_shows')}
                                                                variant="ghost"
                                                                size="xs"
                                                                className="!ap-text-red-500 hover:!ap-text-red-700 !ap-ml-2 !ap-p-0 !ap-min-h-0"
                                                                title="Remove"
                                                            >
                                                                ×
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Form Actions */}
                        <div className="ap-flex ap-flex-wrap ap-items-center ap-justify-between ap-gap-2 ap-pt-4 ap-border-t">
                            {/* Archive/Delete buttons on the left (only for existing logs and not in view mode) */}
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                {editingLog && !viewMode && (
                                    <>
                                        {editingLog.archived ? (
                                            <Button
                                                type="button"
                                                onClick={() => handleRestore(editingLog.id)}
                                                variant="success-outline"
                                                size="sm"
                                                leftIcon={<UnarchiveIcon className="ap-w-4 ap-h-4" />}
                                            >
                                                Restore
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                onClick={() => handleArchive(editingLog.id)}
                                                variant="warning-outline"
                                                size="sm"
                                                leftIcon={<ArchiveIcon className="ap-w-4 ap-h-4" />}
                                            >
                                                Archive
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to delete this training log? This action cannot be undone.')) {
                                                    handleDelete(editingLog.id);
                                                }
                                            }}
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
                                    onClick={handleCloseModal}
                                    variant="outline"
                                    size="sm"
                                >
                                    {viewMode ? 'Close' : 'Cancel'}
                                </Button>
                                {!viewMode && (
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<CheckIcon className="ap-h-5 ap-w-5" />}
                                    >
                                        {editingLog ? 'Update' : 'Save'} Training Log
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                    </Card.Body>
                </Card>
            </div>
        );
    }

    return (
        <div className="ap-max-w-7xl ap-mx-auto">
            <Card>
                <Card.Body>
                <div className="ap-flex ap-justify-between ap-items-start ap-mb-6">
                    <div>
                        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">In-Service Training Log</h2>
                        <p className="ap-text-gray-600 ap-mt-2">
                            Log training sessions and track monthly hours
                        </p>
                    </div>
                    {activeTab === 'logs' && (permissions.canCreate || currentUser.capabilities?.manage_options) && (
                        <Button
                            onClick={() => handleOpenModal()}
                            variant="primary"
                            leftIcon={<PlusIcon className="ap-w-5 ap-h-5" />}
                        >
                            New Training Log
                        </Button>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="ap-border-b ap-border-gray-200 ap-mb-6">
                    <nav className="-ap-mb-px ap-flex ap-flex-wrap ap-gap-2">
                        <Button
                            onClick={() => setActiveTab('logs')}
                            variant="ghost"
                            className={`${activeTab === 'logs'
                                ? '!ap-border-blue-500 !ap-bg-blue-50 !ap-text-blue-600 !ap-border-b-0' : '!ap-border-purple-300 !ap-bg-purple-100 !ap-text-gray-700 hover:!ap-bg-blue-50 hover:!ap-border-blue-500'
                            } !ap-whitespace-nowrap !ap-py-2.5 !ap-px-3 sm:!ap-py-3 sm:!ap-px-4 !ap-border-2 !ap-rounded-t-lg !ap-rounded-b-none !ap-font-medium !ap-text-xs sm:!ap-text-sm !ap-min-h-0`}
                        >
                            Training Logs
                        </Button>
                        <Button
                            onClick={() => setActiveTab('compliance')}
                            variant="ghost"
                            className={`${activeTab === 'compliance'
                                ? '!ap-border-blue-500 !ap-bg-blue-50 !ap-text-blue-600 !ap-border-b-0' : '!ap-border-purple-300 !ap-bg-purple-100 !ap-text-gray-700 hover:!ap-bg-blue-50 hover:!ap-border-blue-500'
                            } !ap-whitespace-nowrap !ap-py-2.5 !ap-px-3 sm:!ap-py-3 sm:!ap-px-4 !ap-border-2 !ap-rounded-t-lg !ap-rounded-b-none !ap-font-medium !ap-text-xs sm:!ap-text-sm !ap-min-h-0`}
                        >
                            User Compliance
                        </Button>
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'compliance' ? (
                    <InServiceUserTable />
                ) : (
                    <>
                        {/* User Selector */}
                <div className="ap-mb-6">
                    <UserSelector
                        users={users.map(u => ({
                            id: u.user_id,
                            name: u.display_name,
                            email: u.user_email || '',
                            job_role: u.job_role_titles || undefined, // Comma-separated string from getUsersWithMetadata
                            tier: u.tier
                        } as UserOption))}
                        selectedUserId={selectedUserId}
                        onChange={(userId) => {
                            console.log('=== UserSelector onChange called ===');
                            console.log('New userId:', userId, 'typeof:', typeof userId);
                            const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
                            console.log('Setting selectedUserId to:', numericUserId);
                            setSelectedUserId(numericUserId);
                        }}
                        label="View Training Progress For"
                        isLoading={isSummaryLoading}
                    />
                </div>

                {/* Monthly Summary */}
                {isSummaryLoading ? (
                    <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-8 ap-mb-6 ap-text-center">
                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto ap-mb-2"></div>
                        <p className="ap-text-gray-600">Loading training summary...</p>
                    </div>
                ) : summary && (
                    <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-mb-6">
                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                            <h3 className="ap-text-lg ap-font-semibold ap-text-blue-900">
                                This Month's Training Summary
                            </h3>
                            {selectedUserId !== currentUser.id && (
                                <span className="ap-text-xs ap-text-blue-700 ap-bg-blue-100 ap-px-2 ap-py-1 ap-rounded">
                                    Viewing: {users.find(u => u.user_id === selectedUserId)?.display_name || 'Unknown User'}
                                </span>
                            )}
                        </div>
                        <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                            <div>
                                <p className="ap-text-sm ap-text-blue-700">Total Hours</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-blue-900">
                                    {summary.current_month_hours}
                                </p>
                            </div>
                            <div>
                                <p className="ap-text-sm ap-text-blue-700">Required Hours</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-blue-900">
                                    {summary.required_hours}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Training History Toggle Button + Collapsible Table */}
                {!isSummaryLoading && summary && (
                    <div className="ap-mb-6">
                        <Button
                            onClick={loadTrainingHistory}
                            variant="outline"
                            size="sm"
                            leftIcon={isHistoryLoading
                                ? <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-2 ap-border-gray-300 ap-border-t-blue-600"></div>
                                : <ClipboardListIcon className="ap-h-4 ap-w-4" />
                            }
                            disabled={isHistoryLoading}
                        >
                            {showTrainingHistory ? 'Hide' : 'Show'} All Training History
                            {showTrainingHistory
                                ? <ChevronUpIcon className="ap-h-4 ap-w-4 ap-ml-1" />
                                : <ChevronDownIcon className="ap-h-4 ap-w-4 ap-ml-1" />
                            }
                        </Button>

                        {showTrainingHistory && (
                            <div className="ap-mt-3 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-b ap-border-gray-200">
                                    <div className="ap-flex ap-items-center ap-justify-between">
                                        <h3 className="ap-text-base ap-font-semibold ap-text-gray-900">
                                            All Training Sessions
                                            <span className="ap-text-sm ap-font-normal ap-text-gray-500 ap-ml-2">
                                                for {users.find(u => u.user_id === selectedUserId)?.display_name || 'Selected User'}
                                            </span>
                                        </h3>
                                        <span className="ap-text-xs ap-text-gray-500 ap-bg-gray-200 ap-rounded-full ap-px-2.5 ap-py-1">
                                            {trainingHistory.length} session{trainingHistory.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                {trainingHistory.length === 0 ? (
                                    <div className="ap-p-6 ap-text-center ap-text-gray-500">
                                        No training sessions found for this user.
                                    </div>
                                ) : (
                                    <div className="ap-overflow-x-auto">
                                        <table className="ap-w-full ap-text-sm">
                                            <thead>
                                                <tr className="ap-bg-gray-50 ap-text-left">
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Date</th>
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Topic</th>
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Hours</th>
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Location</th>
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Role</th>
                                                    <th className="ap-px-4 ap-py-2.5 ap-font-medium ap-text-gray-600">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="ap-divide-y ap-divide-gray-100">
                                                {trainingHistory.map(log => {
                                                    const isLeader = log.leaders?.some(l => l.id === selectedUserId);
                                                    const isAttendee = log.attendees?.some(a => a.id === selectedUserId);
                                                    return (
                                                        <tr key={log.id} className={`hover:ap-bg-gray-50 ${log.archived ? 'ap-opacity-60' : ''}`}>
                                                            <td className="ap-px-4 ap-py-2.5 ap-whitespace-nowrap ap-text-gray-900">
                                                                {new Date(log.training_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </td>
                                                            <td className="ap-px-4 ap-py-2.5 ap-text-gray-900 ap-max-w-xs ap-truncate" title={log.topic}>
                                                                {log.topic}
                                                            </td>
                                                            <td className="ap-px-4 ap-py-2.5 ap-whitespace-nowrap ap-text-gray-700">
                                                                {log.duration_hours}h
                                                            </td>
                                                            <td className="ap-px-4 ap-py-2.5 ap-whitespace-nowrap ap-text-gray-700">
                                                                {log.location || '—'}
                                                            </td>
                                                            <td className="ap-px-4 ap-py-2.5 ap-whitespace-nowrap">
                                                                {isLeader && isAttendee ? (
                                                                    <span className="ap-inline-flex ap-items-center ap-gap-1">
                                                                        <span className="ap-bg-purple-100 ap-text-purple-800 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Leader</span>
                                                                        <span className="ap-bg-blue-100 ap-text-blue-800 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Attendee</span>
                                                                    </span>
                                                                ) : isLeader ? (
                                                                    <span className="ap-bg-purple-100 ap-text-purple-800 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Leader</span>
                                                                ) : isAttendee ? (
                                                                    <span className="ap-bg-blue-100 ap-text-blue-800 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Attendee</span>
                                                                ) : null}
                                                            </td>
                                                            <td className="ap-px-4 ap-py-2.5 ap-whitespace-nowrap">
                                                                {log.archived ? (
                                                                    <span className="ap-bg-gray-100 ap-text-gray-600 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Archived</span>
                                                                ) : (
                                                                    <span className="ap-bg-green-100 ap-text-green-800 ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full">Active</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="ap-bg-gray-50 ap-font-medium">
                                                    <td className="ap-px-4 ap-py-2.5 ap-text-gray-700">Total</td>
                                                    <td className="ap-px-4 ap-py-2.5 ap-text-gray-500">{trainingHistory.length} sessions</td>
                                                    <td className="ap-px-4 ap-py-2.5 ap-text-gray-700">
                                                        {trainingHistory.reduce((sum, l) => sum + l.duration_hours, 0)}h
                                                    </td>
                                                    <td colSpan={3}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Last Month's Team Summary */}
                {lastMonthStats && (
                    <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-mb-6">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-green-900 ap-mb-3">
                            Last Month's Team Summary
                            <span className="ap-text-sm ap-font-normal ap-text-green-700 ap-ml-2">
                                ({new Date(lastMonthStats.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                            </span>
                        </h3>
                        <div className="ap-grid ap-grid-cols-2 sm:ap-grid-cols-4 ap-gap-4">
                            <div>
                                <p className="ap-text-sm ap-text-green-700">Total Hours Offered</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-green-900">
                                    {lastMonthStats.total_hours_offered}
                                </p>
                            </div>
                            <div>
                                <p className="ap-text-sm ap-text-green-700">Total Employees</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-green-900">
                                    {lastMonthStats.employees_count}
                                </p>
                            </div>
                            <div>
                                <p className="ap-text-sm ap-text-green-700">Met Requirements</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-green-900">
                                    {lastMonthStats.employees_met_requirement}
                                    <span className="ap-text-sm ap-font-normal ap-text-green-700 ap-ml-1">
                                        ({lastMonthStats.employees_count > 0 
                                            ? Math.round((lastMonthStats.employees_met_requirement / lastMonthStats.employees_count) * 100)
                                            : 0}%)
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p className="ap-text-sm ap-text-red-700">Did Not Meet</p>
                                <p className="ap-text-2xl ap-font-bold ap-text-red-900">
                                    {lastMonthStats.employees_did_not_meet}
                                    <span className="ap-text-sm ap-font-normal ap-text-red-700 ap-ml-1">
                                        ({lastMonthStats.employees_count > 0 
                                            ? Math.round((lastMonthStats.employees_did_not_meet / lastMonthStats.employees_count) * 100)
                                            : 0}%)
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search and Filter Controls */}
                <div className="ap-mb-4 ap-flex ap-flex-col sm:ap-flex-row ap-gap-3 ap-items-start sm:ap-items-center ap-justify-between">
                    <div className="ap-relative ap-flex-1 ap-max-w-md">
                        <div className="ap-absolute ap-inset-y-0 ap-left-0 ap-pl-3 ap-flex ap-items-center ap-pointer-events-none">
                            <SearchIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search training logs..."
                            className="ap-block ap-w-full ap-pl-10 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-leading-5 ap-bg-white ap-placeholder-gray-500 focus:ap-outline-none focus:ap-placeholder-gray-400 focus:ap-ring-1 focus:ap-ring-blue-500 focus:ap-border-blue-500 sm:ap-text-sm"
                        />
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            onClick={handleDownloadCSV}
                            variant="outline"
                            size="sm"
                            leftIcon={<DownloadIcon className="ap-h-4 ap-w-4" />}
                            title="Download all records as CSV"
                        >
                            Export CSV
                        </Button>
                        <label className="ap-inline-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">Show Archived</span>
                        </label>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedLogs.length > 0 && (
                    <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3">
                        <span className="ap-text-sm ap-font-medium ap-text-blue-900">
                            {selectedLogs.length} item{selectedLogs.length !== 1 ? 's' : ''} selected
                        </span>
                        {selectedLogs.some(id => !logs.find(log => log.id === id)?.archived) && (
                            <Button
                                onClick={handleBulkArchive}
                                variant="warning"
                                size="sm"
                                leftIcon={<ArchiveIcon className="ap-w-4 ap-h-4" />}
                            >
                                Archive Selected
                            </Button>
                        )}
                        {selectedLogs.some(id => logs.find(log => log.id === id)?.archived) && (
                            <Button
                                onClick={handleBulkRestore}
                                variant="success"
                                size="sm"
                                leftIcon={<UnarchiveIcon className="ap-w-4 ap-h-4" />}
                            >
                                Restore Selected
                            </Button>
                        )}
                        <Button
                            onClick={() => setSelectedLogs([])}
                            variant="link"
                            size="sm"
                            className="ap-ml-auto"
                        >
                            Clear Selection
                        </Button>
                    </div>
                )}

                {/* Training Logs List */}
                {isLoading ? (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">Loading training logs...</div>
                ) : filteredAndSortedLogs.length === 0 ? (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">
                        {logs.length === 0 
                            ? "No training logs yet. Click \"New Training Log\" to create one."
                            : "No training logs match your search criteria."}
                    </div>
                ) : (
                    <div className="ap-overflow-x-auto">
                        <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    <th className="ap-px-6 ap-py-3 ap-text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedLogs.length === filteredAndSortedLogs.length && filteredAndSortedLogs.length > 0}
                                            onChange={handleToggleSelectAll}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            title="Select all"
                                        />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('training_date')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Date{getSortIcon('training_date')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('topic')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-min-w-[400px]"
                                    >
                                        Topic{getSortIcon('topic')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('duration_hours')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Duration{getSortIcon('duration_hours')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('location')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Location{getSortIcon('location')}
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Job Roles
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Leaders
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Attendees
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        No-Shows
                                    </th>
                                    <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                        Edit
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                {filteredAndSortedLogs.map((log) => (
                                    <tr key={log.id} className={`hover:ap-bg-gray-50 ${log.archived ? 'ap-bg-gray-100 ap-opacity-75' : ''}`}>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={selectedLogs.includes(log.id)}
                                                onChange={() => handleToggleSelect(log.id)}
                                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            />
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-flex ap-items-center ap-text-sm ap-text-gray-900">{log.archived && <span className="ap-text-xs ap-text-gray-500 ap-mr-2">[ARCHIVED]</span>}
                                                <CalendarIcon className="ap-w-4 ap-h-4 ap-mr-2 ap-text-gray-400" />
                                                {formatDate(log.training_date)}
                                            </div>
                                            {log.training_time && (
                                                <div className="ap-flex ap-items-center ap-text-xs ap-text-gray-500 ap-mt-1">
                                                    <ClockIcon className="ap-w-3 ap-h-3 ap-mr-1" />
                                                    {log.training_time}
                                                </div>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-min-w-[400px]">
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {log.topic}
                                            </div>
                                            {log.details && (
                                                <div className="ap-text-xs ap-text-gray-500 line-clamp-3 ap-mt-1">
                                                    <MemoizedHtml html={log.details} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                            {log.duration_hours}h
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                            {log.location || '-'}
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-text-sm ap-text-gray-900">
                                                {log.job_roles && log.job_roles.length > 0 ? (
                                                    <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                        {log.job_roles.map(role => (
                                                            <span key={role.id} className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-blue-100 ap-text-blue-800">
                                                                {role.title}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="ap-text-gray-400">All</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-text-sm ap-text-gray-900">
                                                {log.leaders && log.leaders.length > 0 ? (
                                                    <div className="ap-space-y-1">
                                                        {log.leaders.map(leader => (
                                                            <div key={leader.id} className="ap-text-xs">
                                                                {leader.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="ap-text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-text-sm ap-text-gray-900">
                                                {log.attendees && log.attendees.length > 0 ? (
                                                    <div className="ap-max-h-24 ap-overflow-y-auto">
                                                        <span className="ap-font-medium ap-text-xs ap-text-gray-500">
                                                            {log.attendees.length} attendee{log.attendees.length > 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="ap-text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <div className="ap-text-sm">
                                                {log.no_shows && log.no_shows.length > 0 ? (
                                                    <span className="ap-text-red-600 ap-font-medium ap-text-xs">
                                                        {log.no_shows.length}
                                                    </span>
                                                ) : (
                                                    <span className="ap-text-gray-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="ap-sticky ap-right-0 ap-bg-white ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                            {(() => {
                                                const isCreator = log.created_by === currentUser.id;
                                                const canEditThis = (isCreator && permissions.canEdit) || permissions.canModerateAll || currentUser.capabilities?.manage_options;
                                                const canViewThis = permissions.canView || canEditThis;
                                                
                                                if (canEditThis) {
                                                    return (
                                                        <Button
                                                            variant="icon"
                                                            onClick={() => handleOpenModal(log, false)}
                                                            className="ap-text-gray-400 hover:ap-text-blue-600"
                                                            title="Edit training log"
                                                        >
                                                            <EditIcon className="ap-w-4 ap-h-4" />
                                                        </Button>
                                                    );
                                                } else if (canViewThis) {
                                                    return (
                                                        <Button
                                                            variant="icon"
                                                            onClick={() => handleOpenModal(log, true)}
                                                            className="ap-text-gray-400 hover:ap-text-gray-600"
                                                            title="View training log details"
                                                        >
                                                            <svg className="ap-w-5 ap-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </Button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                    </>
                )}
                </Card.Body>
            </Card>
        </div>
    );
};

export default InServiceLog;
