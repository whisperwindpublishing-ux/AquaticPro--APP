import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, GroupedDailyLogs, TimeSlotDefinition, DailyLog } from '@/types';
import { getDailyLogs, getTimeSlots, deleteDailyLog, getBatchUserReactionStats, UserReactionStats } from '@/services/api';
import DailyLogCard from './DailyLogCard';
import LoadingSpinner from './LoadingSpinner';
import { Button, Input, Select, Label } from './ui';
import { useDailyLogPermissions } from '@/hooks/useDailyLogPermissions';
import {
    HiOutlineFunnel,
    HiOutlinePlus
} from 'react-icons/hi2';

interface DailyLogListProps {
    currentUser: UserProfile;
    filterByCurrentUser?: boolean;
    showCreateButton?: boolean;
    readOnlyMode?: boolean;
    onCreateNew?: () => void;
    onEditLog?: (log: DailyLog) => void;
}

/**
 * DailyLogList component - Displays daily logs in a flat, mobile-friendly design
 * 
 * Features:
 * - Tab/dropdown filter for locations (mobile responsive)
 * - Flat list design (no nested accordions)
 * - Last 4 days fully expanded by default
 * - Mobile-responsive reactions and comments
 */
export const DailyLogList: React.FC<DailyLogListProps> = ({
    currentUser,
    filterByCurrentUser = false,
    showCreateButton = true,
    readOnlyMode = false,
    onCreateNew,
    onEditLog
}) => {
    const [groupedLogs, setGroupedLogs] = useState<GroupedDailyLogs | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlotDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Author reaction stats cache (userId -> stats)
    const [authorReactionStats, setAuthorReactionStats] = useState<Record<number, UserReactionStats>>({});

    const permissions = useDailyLogPermissions();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalLogs, setTotalLogs] = useState(0);
    const logsPerPage = 50;

    // Filters
    const [selectedLocationName, setSelectedLocationName] = useState<string>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
    const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Fetch time slots on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const slots = await getTimeSlots(true);
                setTimeSlots(slots);
            } catch (error) {
                console.error('Failed to fetch time slots:', error);
            }
        };

        fetchData();
    }, []);

    // Fetch logs
    const fetchLogs = async (resetPagination = true) => {
        // Visitor Mode Bypass
        if (window.mentorshipPlatformData?.visitor_mode) {
             setGroupedLogs({});
             setIsLoading(false);
             setIsLoadingMore(false);
             return;
        }

        if (resetPagination) {
            setIsLoading(true);
            setCurrentPage(1);
        } else {
            setIsLoadingMore(true);
        }
        setError(null);
        
        try {
            const params: any = { 
                grouped: true,
                page: resetPagination ? 1 : currentPage + 1,
                per_page: logsPerPage
            };
            
            // Only pass date range to API if both dates are set, otherwise filter client-side
            if (startDate && endDate) {
                params.dateRange = { start: startDate, end: endDate };
            }
            // Only pass time slot to API if set, otherwise filter client-side
            if (selectedTimeSlot) params.timeSlot = selectedTimeSlot;
            if (filterByCurrentUser) params.userId = currentUser.id;
            if (searchTerm) params.search = searchTerm;

            const response = await getDailyLogs(params);
            const newLogs = response.logs as GroupedDailyLogs;
            
            // Update pagination state
            setHasMore(response.pagination.has_more);
            setTotalLogs(response.pagination.total);
            
            if (resetPagination) {
                setGroupedLogs(newLogs);
            } else {
                // Merge new logs with existing ones
                setGroupedLogs(prevLogs => {
                    if (!prevLogs) return newLogs;
                    
                    const merged = { ...prevLogs };
                    
                    // Merge location by location
                    Object.entries(newLogs).forEach(([locationName, locationData]) => {
                        if (!merged[locationName]) {
                            merged[locationName] = locationData;
                        } else {
                            // Merge dates within this location
                            merged[locationName] = {
                                ...merged[locationName],
                                dates: {
                                    ...merged[locationName].dates,
                                    ...locationData.dates
                                }
                            };
                        }
                    });
                    
                    return merged;
                });
                setCurrentPage(prev => prev + 1);
            }
        } catch (err) {
            console.error('Failed to fetch daily logs:', err);
            setError('Failed to load daily logs. Please try again.');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filterByCurrentUser, currentUser.id]);

    // Get all location names from grouped logs
    const locationNames = useMemo(() => {
        if (!groupedLogs) return [];
        return Object.keys(groupedLogs).sort();
    }, [groupedLogs]);

    // Extract unique authors from all logs
    const uniqueAuthors = useMemo(() => {
        if (!groupedLogs) return [];
        const authorsMap = new Map<number, { id: number; name: string }>();
        
        Object.values(groupedLogs).forEach(locationData => {
            Object.values(locationData.dates).forEach(dateData => {
                Object.values(dateData.timeSlots).forEach(slotData => {
                    slotData.logs.forEach(log => {
                        if (log.author && !authorsMap.has(log.authorId)) {
                            authorsMap.set(log.authorId, {
                                id: log.authorId,
                                name: `${log.author.firstName} ${log.author.lastName}`
                            });
                        }
                    });
                });
            });
        });
        
        return Array.from(authorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [groupedLogs]);

    // Fetch author reaction stats when unique authors change
    useEffect(() => {
        const fetchAuthorStats = async () => {
            if (uniqueAuthors.length === 0) return;
            
            // Get author IDs we don't have stats for yet
            const missingAuthorIds = uniqueAuthors
                .map(a => a.id)
                .filter(id => !authorReactionStats[id]);
            
            if (missingAuthorIds.length === 0) return;
            
            try {
                const stats = await getBatchUserReactionStats(missingAuthorIds);
                setAuthorReactionStats(prev => ({ ...prev, ...stats }));
            } catch (error) {
                console.error('Failed to fetch author reaction stats:', error);
            }
        };
        
        fetchAuthorStats();
    }, [uniqueAuthors]);

    // Extract unique tags from all logs
    const uniqueTags = useMemo(() => {
        if (!groupedLogs) return [];
        const tagsSet = new Set<string>();
        
        Object.values(groupedLogs).forEach(locationData => {
            Object.values(locationData.dates).forEach(dateData => {
                Object.values(dateData.timeSlots).forEach(slotData => {
                    slotData.logs.forEach(log => {
                        if (log.tags && Array.isArray(log.tags)) {
                            log.tags.forEach(tag => tagsSet.add(tag));
                        }
                    });
                });
            });
        });
        
        return Array.from(tagsSet).sort();
    }, [groupedLogs]);

    // Flatten logs by date across all locations (or selected location)
    const flattenedLogs = useMemo(() => {
        if (!groupedLogs) return [];

        const logsByDate: { [date: string]: DailyLog[] } = {};

        Object.entries(groupedLogs).forEach(([locationName, locationData]) => {
            // Skip if not matching selected location
            if (selectedLocationName !== 'all' && locationName !== selectedLocationName) {
                return;
            }

            Object.entries(locationData.dates).forEach(([date, dateData]) => {
                // Skip if date is outside the selected range
                if (startDate && date < startDate) return;
                if (endDate && date > endDate) return;

                if (!logsByDate[date]) {
                    logsByDate[date] = [];
                }

                // Collect all logs from all time slots for this date
                Object.entries(dateData.timeSlots).forEach(([slotId, slotData]) => {
                    // Skip if time slot doesn't match filter
                    if (selectedTimeSlot && slotId !== selectedTimeSlot) return;

                    if (slotData && slotData.logs) {
                        // Filter by author and tag
                        const filteredLogs = slotData.logs.filter(log => {
                            // Author filter
                            if (selectedAuthorId && log.authorId !== parseInt(selectedAuthorId)) {
                                return false;
                            }
                            // Tag filter
                            if (selectedTag && (!log.tags || !log.tags.includes(selectedTag))) {
                                return false;
                            }
                            return true;
                        });
                        logsByDate[date].push(...filteredLogs);
                    }
                });
            });
        });

        // Convert to array, filter out empty dates, and sort by date (newest first)
        return Object.entries(logsByDate)
            .filter(([_, logs]) => logs.length > 0) // Only include dates that have logs after filtering
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, logs]) => ({ date, logs }));
    }, [groupedLogs, selectedLocationName, startDate, endDate, selectedTimeSlot, selectedAuthorId, selectedTag]);

    // Determine which dates should be fully expanded (last 4 days)
    const shouldExpandDate = (dateString: string): boolean => {
        const logDate = new Date(dateString + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fourDaysAgo = new Date(today);
        fourDaysAgo.setDate(today.getDate() - 3);

        return logDate >= fourDaysAgo && logDate <= today;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (date.getTime() === today.getTime()) {
            return 'Today';
        } else if (date.getTime() === yesterday.getTime()) {
            return 'Yesterday';
        }

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const clearFilters = () => {
        setSelectedLocationName('all');
        setStartDate('');
        setEndDate('');
        setSelectedTimeSlot('');
        setSelectedAuthorId('');
        setSearchTerm('');
        setSelectedTag('');
        fetchLogs(true); // Reset pagination and refetch
    };

    const applyFilters = () => {
        fetchLogs(true); // Reset pagination and refetch with new filters
    };

    const handleEdit = (log: DailyLog) => {
        if (onEditLog) {
            onEditLog(log);
        }
    };

    const handleDelete = async (log: DailyLog) => {
        if (!confirm(`Are you sure you want to delete "${log.title}"?`)) {
            return;
        }
        
        try {
            await deleteDailyLog(log.id);
            
            // Remove the deleted log from the current state instead of re-fetching everything
            setGroupedLogs(prevGrouped => {
                if (!prevGrouped) return prevGrouped;
                
                const newGrouped = { ...prevGrouped };
                
                // Find and remove the specific log
                Object.keys(newGrouped).forEach(locationName => {
                    Object.keys(newGrouped[locationName].dates).forEach(date => {
                        Object.keys(newGrouped[locationName].dates[date].timeSlots).forEach(slotId => {
                            const logs = newGrouped[locationName].dates[date].timeSlots[slotId].logs;
                            const logIndex = logs.findIndex((l: DailyLog) => l.id === log.id);
                            if (logIndex !== -1) {
                                // Remove this specific log
                                newGrouped[locationName].dates[date].timeSlots[slotId].logs = logs.filter((l: DailyLog) => l.id !== log.id);
                            }
                        });
                    });
                });
                
                return newGrouped;
            });
            
            // Update total count
            setTotalLogs(prev => prev - 1);
        } catch (error) {
            console.error('Failed to delete log:', error);
            alert('Failed to delete log. Please try again.');
        }
    };

    const handleLogUpdate = (updatedLog: DailyLog) => {
        if (!groupedLogs) return;
        
        setGroupedLogs(prevGrouped => {
            if (!prevGrouped) return prevGrouped;
            
            const newGrouped = { ...prevGrouped };
            
            Object.keys(newGrouped).forEach(locationName => {
                Object.keys(newGrouped[locationName].dates).forEach(date => {
                    Object.keys(newGrouped[locationName].dates[date].timeSlots).forEach(slotId => {
                        const logs = newGrouped[locationName].dates[date].timeSlots[slotId].logs;
                        const logIndex = logs.findIndex((l: DailyLog) => l.id === updatedLog.id);
                        if (logIndex !== -1) {
                            logs[logIndex] = updatedLog;
                        }
                    });
                });
            });
            
            return newGrouped;
        });
    };

    // Helper to get local date string in YYYY-MM-DD format (not UTC)
    const getLocalDateString = (date: Date = new Date()): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Date range presets
    const setDateRangePreset = (preset: 'today' | 'week' | 'month' | 'clear') => {
        const today = new Date();
        let newStartDate = '';
        let newEndDate = '';
        
        switch (preset) {
            case 'today':
                const todayStr = getLocalDateString(today);
                newStartDate = todayStr;
                newEndDate = todayStr;
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                newStartDate = getLocalDateString(weekAgo);
                newEndDate = getLocalDateString(today);
                break;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(today.getMonth() - 1);
                newStartDate = getLocalDateString(monthAgo);
                newEndDate = getLocalDateString(today);
                break;
            case 'clear':
                newStartDate = '';
                newEndDate = '';
                break;
        }
        
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        
        // Apply filters immediately after preset is selected
        setTimeout(() => fetchLogs(true), 0);
    };

    if (isLoading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-text-center ap-py-12">
                <p className="ap-text-red-600">{error}</p>
                <Button
                    onClick={() => fetchLogs(true)}
                    variant="primary"
                    className="ap-mt-4"
                >
                    Try Again
                </Button>
            </div>
        );
    }

    const hasLogs = flattenedLogs.length > 0;

    return (
        <div className="ap-space-y-6">
            {/* Header with Create Button */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row ap-items-start sm:ap-items-center ap-justify-between ap-gap-4">
                <div>
                    <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                        {filterByCurrentUser ? 'My Daily Logs' : 'Team Daily Logs'}
                    </h1>
                    <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
                        {filterByCurrentUser 
                            ? 'Create and manage your daily activity logs' : 'View team daily activities and shifts across locations'
                        }
                    </p>
                </div>
                {showCreateButton && permissions.canCreate && onCreateNew && (
                    <Button
                        onClick={onCreateNew}
                        variant="primary"
                        disabled={permissions.isLoading}
                        className="ap-w-full sm:ap-w-auto ap-justify-center"
                        leftIcon={<HiOutlinePlus className="ap-h-5 ap-w-5" />}
                    >
                        New Log
                    </Button>
                )}
                {showCreateButton && !permissions.canCreate && !permissions.isLoading && (
                    <div className="ap-text-sm ap-text-gray-500 ap-italic">
                        You don't have permission to create daily logs
                    </div>
                )}
            </div>

            {/* Location Filter Buttons - Wraps on Mobile */}
            {locationNames.length > 1 && (
                <div className="md:ap-bg-white md:ap-rounded-lg md:ap-shadow-sm md:ap-border md:ap-border-gray-200 md:ap-p-4">
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        <Button
                            variant={selectedLocationName === 'all' ? 'neobrutalist' : 'neobrutalist-outline'}
                            size="sm"
                            onClick={() => setSelectedLocationName('all')}
                            className="!ap-whitespace-nowrap"
                        >
                            All Locations
                        </Button>
                        {locationNames.map(location => (
                            <Button
                                key={location}
                                variant={selectedLocationName === location ? 'neobrutalist' : 'neobrutalist-outline'}
                                size="sm"
                                onClick={() => setSelectedLocationName(location)}
                                className="!ap-whitespace-nowrap"
                            >
                                {location}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="md:ap-bg-white md:ap-rounded-lg md:ap-shadow-sm md:ap-border md:ap-border-gray-200 md:ap-p-4">
                <Button
                    variant="ghost"
                    onClick={() => setShowFilters(!showFilters)}
                    className="!ap-w-full !ap-justify-between !ap-px-2 !ap-text-gray-700 !ap-font-medium"
                >
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineFunnel className="ap-h-5 ap-w-5" />
                        <span>Filters</span>
                    </div>
                    <span className="ap-text-sm ap-text-gray-500">
                        {showFilters ? 'Hide' : 'Show'}
                    </span>
                </Button>

                {showFilters && (
                    <div className="ap-mt-4 ap-space-y-4">
                        {/* Search */}
                        <div>
                            <Label>Search Logs</Label>
                            <Input
                                type="text"
                                placeholder="Search title, content, or blocks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ap-w-full"
                            />
                        </div>

                        {/* Date Range Presets */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Quick Date Ranges
                            </label>
                            <div className="ap-grid ap-grid-cols-2 sm:ap-grid-cols-4 ap-gap-2">
                                <Button
                                    variant="neobrutalist"
                                    size="sm"
                                    onClick={() => setDateRangePreset('today')}
                                >
                                    Today
                                </Button>
                                <Button
                                    variant="neobrutalist-outline"
                                    size="sm"
                                    onClick={() => setDateRangePreset('week')}
                                >
                                    Last 7 Days
                                </Button>
                                <Button
                                    variant="neobrutalist-outline"
                                    size="sm"
                                    onClick={() => setDateRangePreset('month')}
                                >
                                    Last 30 Days
                                </Button>
                                <Button
                                    variant="neobrutalist-outline"
                                    size="sm"
                                    onClick={() => setDateRangePreset('clear')}
                                    className="!ap-text-gray-500"
                                >
                                    All Time
                                </Button>
                            </div>
                        </div>

                        <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-3 ap-gap-4">
                            {/* Start Date */}
                            <div>
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>

                            {/* Time Slot Filter */}
                            <div>
                                <Label>Time Slot</Label>
                                <Select
                                    value={selectedTimeSlot}
                                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                >
                                    <option value="">All Time Slots</option>
                                    {timeSlots.map(slot => (
                                        <option key={slot.id} value={slot.id.toString()}>
                                            {slot.label}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Author Filter */}
                            <div>
                                <Label>Author</Label>
                                <Select
                                    value={selectedAuthorId}
                                    onChange={(e) => setSelectedAuthorId(e.target.value)}
                                >
                                    <option value="">All Authors</option>
                                    {uniqueAuthors.map(author => (
                                        <option key={author.id} value={author.id.toString()}>
                                            {author.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Tag Filter */}
                            <div>
                                <Label>Tag</Label>
                                <Select
                                    value={selectedTag}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                >
                                    <option value="">All Tags</option>
                                    {uniqueTags.map(tag => (
                                        <option key={tag} value={tag}>
                                            {tag}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        {/* Filter Actions */}
                        <div className="ap-flex ap-gap-4 ap-items-center">
                            <Button
                                onClick={applyFilters}
                                className="ap-min-w-[120px]"
                            >
                                Apply Filters
                            </Button>
                            <Button
                                variant="link"
                                onClick={clearFilters}
                                className="!ap-text-brand-500 hover:!ap-text-brand-600"
                            >
                                Clear All
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Logs List - Flat Design */}
            {!hasLogs ? (
                <div className="ap-text-center ap-py-12 ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
                    <p className="ap-text-gray-600">No daily logs found.</p>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-2">
                        Try adjusting your filters or create a new log.
                    </p>
                </div>
            ) : (
                <div className="ap-space-y-8">
                    {flattenedLogs.map(({ date, logs }) => {
                        const isRecent = shouldExpandDate(date);
                        
                        return (
                            <div key={date}>
                                {/* Date Header */}
                                <div 
                                    className="ap-sticky ap-top-0 ap-z-10 ap-rounded-t-lg ap-shadow-md ap-px-4 sm:ap-px-6 ap-py-1.5 ap-flex ap-items-center ap-justify-between ap-gap-4"
                                    style={{
                                        background: 'linear-gradient(to right, #581c87, #7c3aed)',
                                        color: '#ffffff',
                                    }}
                                >
                                    <h2 className="ap-text-sm sm:ap-text-base ap-font-semibold" style={{ color: '#ffffff' }}>
                                        {formatDate(date)}
                                    </h2>
                                    <span className="ap-text-xs ap-whitespace-nowrap" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                                        {logs.length} {logs.length === 1 ? 'log' : 'logs'}
                                    </span>
                                </div>

                                {/* Logs for this date */}
                                <div className="ap-bg-white ap-rounded-b-lg ap-shadow-sm ap-p-4 sm:ap-p-6 ap-space-y-6">
                                    {logs.map(log => (
                                        <DailyLogCard
                                            key={log.id}
                                            log={log}
                                            currentUser={currentUser}
                                            onUpdate={handleLogUpdate}
                                            onEdit={readOnlyMode ? undefined : () => handleEdit(log)}
                                            onDelete={readOnlyMode ? undefined : () => handleDelete(log)}
                                            canEdit={readOnlyMode ? false : permissions.canEdit}
                                            canDelete={readOnlyMode ? false : permissions.canDelete}
                                            canModerateAll={readOnlyMode ? false : permissions.canModerateAll}
                                            expandCommentsByDefault={isRecent}
                                            expandContentByDefault={isRecent}
                                            authorReactionStats={authorReactionStats[log.authorId]}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="ap-flex ap-flex-col ap-items-center ap-justify-center ap-py-8 ap-gap-3">
                            <p className="ap-text-sm ap-text-gray-600">
                                Showing {Object.values(groupedLogs || {}).reduce((count, loc) => 
                                    count + Object.values(loc.dates).reduce((c, dateData) => 
                                        c + Object.values(dateData.timeSlots).reduce((slotCount, slotData) => 
                                            slotCount + slotData.logs.length, 0
                                        ), 0
                                    ), 0
                                )} of {totalLogs} logs
                            </p>
                            <Button
                                onClick={() => fetchLogs(false)}
                                disabled={isLoadingMore}
                                className="ap-min-w-[200px]"
                            >
                                {isLoadingMore ? 'Loading...' : 'Load More Logs'}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DailyLogList;
