import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui';
import {
    HiOutlinePlus as PlusIcon,
    HiOutlineCheckCircle as PassIcon,
    HiOutlineXCircle as FailIcon,
    HiOutlineMagnifyingGlass as SearchIcon,
    HiOutlinePencil as EditIcon,
    HiOutlineCalendar as CalendarIcon,
    HiOutlineClock as ClockIcon,
} from 'react-icons/hi2';
import { HiDownload as DownloadIcon } from 'react-icons/hi';
import LiveDrillForm from './LiveDrillForm';
import LoadingSpinner from './LoadingSpinner';
import { getLiveDrills, type AuditLog } from '@/services/api-professional-growth';
import { useLiveDrillPermissions } from '@/hooks/useLiveDrillPermissions';
import { downloadCSV, formatDateForCSV, formatBooleanForCSV } from '../utils/csvExport';

interface LiveDrillsViewProps {
    currentUser: {
        id: number;
        name: string;
        isAdmin: boolean;
    };
}

type SortField = 'drill_date' | 'conductor_name' | 'result' | 'location';

const LiveDrillsView: React.FC<LiveDrillsViewProps> = ({ currentUser }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingDrill, setEditingDrill] = useState<AuditLog | null>(null);
    const [drills, setDrills] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('drill_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedDrills, setSelectedDrills] = useState<number[]>([]);
    
    // Get permissions for current user
    const permissions = useLiveDrillPermissions(currentUser.id);
    
    console.log('[LiveDrillsView] Current User ID:', currentUser.id);
    console.log('[LiveDrillsView] Permissions:', permissions);

    useEffect(() => {
        loadDrills();
    }, [showArchived]);

    const loadDrills = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Visitor Mode: Bypass API call
            if (window.mentorshipPlatformData?.visitor_mode) {
                setDrills([]);
                setLoading(false);
                return;
            }

            const data = await getLiveDrills({ include_archived: showArchived });
            setDrills(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load live drills');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingDrill(null);
        loadDrills();
    };

    const handleOpenForm = (drill?: AuditLog) => {
        if (drill) {
            setEditingDrill(drill);
        } else {
            setEditingDrill(null);
        }
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingDrill(null);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Parse drill notes JSON
    const parseDrillData = (notesJson: string | undefined) => {
        if (!notesJson) return null;
        try {
            return JSON.parse(notesJson);
        } catch {
            return null;
        }
    };

    // Filter and sort drills
    const filteredAndSortedDrills = useMemo(() => {
        let filtered = drills;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = drills.filter(drill => {
                const drillData = parseDrillData(drill.notes);
                return (
                    drill.conductor_name?.toLowerCase().includes(query) ||
                    drill.location?.toLowerCase().includes(query) ||
                    drill.result.toLowerCase().includes(query) ||
                    drillData?.scenario_type?.toLowerCase().includes(query) ||
                    drillData?.comments?.toLowerCase().includes(query)
                );
            });
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: any, bVal: any;

            switch (sortField) {
                case 'drill_date':
                    aVal = new Date(a.drill_date || '').getTime();
                    bVal = new Date(b.drill_date || '').getTime();
                    break;
                case 'conductor_name':
                    aVal = a.conductor_name || '';
                    bVal = b.conductor_name || '';
                    break;
                case 'result':
                    aVal = a.result || '';
                    bVal = b.result || '';
                    break;
                case 'location':
                    aVal = a.location || '';
                    bVal = b.location || '';
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            } else {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
        });

        return sorted;
    }, [drills, searchQuery, sortField, sortDirection]);

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

    const handleToggleSelect = (drillId: number) => {
        setSelectedDrills(prev => 
            prev.includes(drillId) 
                ? prev.filter(id => id !== drillId)
                : [...prev, drillId]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedDrills.length === filteredAndSortedDrills.length) {
            setSelectedDrills([]);
        } else {
            setSelectedDrills(filteredAndSortedDrills.map(drill => drill.id));
        }
    };

    const handleBulkArchive = async () => {
        const nonArchivedSelected = selectedDrills.filter(id => 
            !drills.find(drill => drill.id === id)?.archived
        );

        if (nonArchivedSelected.length === 0) {
            alert('No non-archived drills selected');
            return;
        }

        if (!confirm(`Are you sure you want to archive ${nonArchivedSelected.length} live drill(s)?`)) {
            return;
        }

        try {
            const { bulkArchiveLiveDrills } = await import('../services/api-professional-growth');
            await bulkArchiveLiveDrills(nonArchivedSelected);
            setSelectedDrills([]);
            loadDrills();
        } catch (error) {
            console.error('Error bulk archiving live drills:', error);
            alert('Failed to archive live drills');
        }
    };

    const handleBulkRestore = async () => {
        const archivedSelected = selectedDrills.filter(id => 
            drills.find(drill => drill.id === id)?.archived
        );

        if (archivedSelected.length === 0) {
            alert('No archived drills selected');
            return;
        }

        if (!confirm(`Are you sure you want to restore ${archivedSelected.length} live drill(s)?`)) {
            return;
        }

        try {
            const { bulkRestoreLiveDrills } = await import('../services/api-professional-growth');
            await bulkRestoreLiveDrills(archivedSelected);
            setSelectedDrills([]);
            loadDrills();
        } catch (error) {
            console.error('Error bulk restoring live drills:', error);
            alert('Failed to restore live drills');
        }
    };

    const handleDownloadCSV = async () => {
        try {
            // Fetch all drills including archived
            const allDrills = await getLiveDrills({ include_archived: true });
            
            if (allDrills.length === 0) {
                alert('No live drills to export');
                return;
            }

            // Prepare data for CSV
            const csvData = allDrills.map(drill => {
                const drillData = parseDrillData(drill.notes);
                
                // Extract staff involved names
                let staffInvolvedNames = '';
                if (drillData?.staff_involved && Array.isArray(drillData.staff_involved)) {
                    staffInvolvedNames = drillData.staff_involved.map((s: any) => s.name || s).join('; ');
                }
                
                // Get the recognized in 30s value
                const recognizedIn30s = drillData?.staff_recognized_30s !== undefined 
                    ? formatBooleanForCSV(drillData.staff_recognized_30s)
                    : 'N/A';
                
                return {
                    'Date': formatDateForCSV(drill.drill_date),
                    'Conductor': drill.conductor_name || '',
                    'Location': drill.location || '',
                    'Staff Recognized Subject in <30s': recognizedIn30s,
                    'Result': drill.result || '',
                    'Staff Involved': staffInvolvedNames,
                    'Notes': drillData?.notes || drillData?.comments || '',
                    'Attachments': drill.attachments ? JSON.parse(drill.attachments).map((a: any) => a.url).join('; ') : '',
                    'Archived': drill.archived ? 'Yes' : 'No',
                    'Created By': drill.auditor_name || '',
                    'Created At': formatDateForCSV(drill.created_at),
                };
            });

            downloadCSV(csvData, 'live_drills');
        } catch (error) {
            console.error('Error downloading CSV:', error);
            alert('Failed to generate CSV export');
        }
    };

    const stripHtmlTags = (html: string) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    // Show form if in create/edit mode
    if (showForm) {
        return (
            <LiveDrillForm
                currentUser={currentUser}
                editingDrill={editingDrill}
                onSuccess={handleFormSuccess}
                onCancel={handleCloseForm}
            />
        );
    }

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="ap-max-w-7xl ap-mx-auto">
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-red-800">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-7xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg ap-p-6">
                {/* Header */}
                <div className="ap-flex ap-justify-between ap-items-start ap-mb-6">
                    <div>
                        <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Live Recognition Drills</h2>
                        <p className="ap-text-gray-600 ap-mt-2">
                            Track and manage live recognition drill scenarios
                        </p>
                    </div>
                    {(permissions.canCreate || currentUser.isAdmin) && (
                        <Button
                            variant="primary"
                            onClick={() => handleOpenForm()}
                        >
                            <PlusIcon className="ap-w-5 ap-h-5 ap-mr-2" />
                            New Drill
                        </Button>
                    )}
                </div>

                {/* Search and Filters */}
                <div className="ap-mb-6 ap-flex ap-flex-col sm:ap-flex-row ap-gap-4">
                    <div className="ap-flex-1">
                        <div className="ap-relative">
                            <SearchIcon className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-text-gray-400 ap-w-5 ap-h-5" />
                            <input
                                type="text"
                                placeholder="Search drills..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDownloadCSV}
                            title="Download all records as CSV"
                        >
                            <DownloadIcon className="ap-h-4 ap-w-4 ap-mr-2" />
                            Export CSV
                        </Button>
                        <label className="ap-flex ap-items-center ap-cursor-pointer">
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

                {/* Results Count */}
                <div className="ap-mb-4 ap-text-sm ap-text-gray-600">
                    Showing {filteredAndSortedDrills.length} of {drills.length} drills
                </div>

                {/* Bulk Actions */}
                {selectedDrills.length > 0 && (
                    <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3">
                        <span className="ap-text-sm ap-font-medium ap-text-blue-900">
                            {selectedDrills.length} item{selectedDrills.length !== 1 ? 's' : ''} selected
                        </span>
                        {selectedDrills.some(id => !drills.find(drill => drill.id === id)?.archived) && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleBulkArchive}
                                className="!ap-bg-orange-600 hover:!ap-bg-orange-700 focus:!ap-ring-orange-500"
                            >
                                Archive Selected
                            </Button>
                        )}
                        {selectedDrills.some(id => drills.find(drill => drill.id === id)?.archived) && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleBulkRestore}
                                className="!ap-bg-green-600 hover:!ap-bg-green-700 focus:!ap-ring-green-500"
                            >
                                Restore Selected
                            </Button>
                        )}
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => setSelectedDrills([])}
                            className="ap-ml-auto !ap-text-gray-600 hover:!ap-text-gray-900"
                        >
                            Clear Selection
                        </Button>
                    </div>
                )}

                {/* Drills Table */}
                {filteredAndSortedDrills.length === 0 ? (
                    <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg ap-border-2 ap-border-dashed ap-border-gray-300">
                        <p className="ap-text-gray-600 ap-mb-4">No live drills recorded yet</p>
                        <Button
                            variant="primary"
                            onClick={() => handleOpenForm()}
                        >
                            <PlusIcon className="ap-w-5 ap-h-5 ap-mr-2" />
                            Record First Drill
                        </Button>
                    </div>
                ) : (
                    <div className="ap-overflow-x-auto ap-border ap-border-gray-200 ap-rounded-lg ap-relative">
                        <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    <th className="ap-px-6 ap-py-3 ap-text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedDrills.length === filteredAndSortedDrills.length && filteredAndSortedDrills.length > 0}
                                            onChange={handleToggleSelectAll}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            title="Select all"
                                        />
                                    </th>
                                    <th
                                        onClick={() => handleSort('drill_date')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Date & Time{getSortIcon('drill_date')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('conductor_name')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Conductor{getSortIcon('conductor_name')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('location')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Location{getSortIcon('location')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('result')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Result{getSortIcon('result')}
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-min-w-[350px]">
                                        Scenario
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Staff
                                    </th>
                                    <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                {filteredAndSortedDrills.map((drill) => {
                                    const drillData = parseDrillData(drill.notes);
                                    return (
                                        <tr key={drill.id} className={`group hover:ap-bg-gray-50 ${drill.archived ? 'ap-bg-gray-100' : ''}`}>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDrills.includes(drill.id)}
                                                    onChange={() => handleToggleSelect(drill.id)}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                                />
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-flex ap-items-center ap-text-sm">
                                                    <CalendarIcon className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mr-2" />
                                                    <div>
                                                        <div className="ap-font-medium ap-text-gray-900">
                                                            {formatDate(drill.drill_date || '')}
                                                        </div>
                                                        {drill.drill_date && (
                                                            <div className="ap-text-gray-500 ap-text-xs ap-flex ap-items-center">
                                                                <ClockIcon className="ap-w-3 ap-h-3 ap-mr-1" />
                                                                {formatTime(drill.drill_date)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {drill.conductor_name || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-text-gray-900">
                                                    {drill.location || '-'}
                                                </div>
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                {drill.result === 'Pass' ? (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-800">
                                                        <PassIcon className="ap-w-4 ap-h-4 ap-mr-1" />
                                                        Pass
                                                    </span>
                                                ) : drill.result === 'Passed with Remediation' ? (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-amber-100 ap-text-amber-800">
                                                        <PassIcon className="ap-w-4 ap-h-4 ap-mr-1" />
                                                        Passed w/ Remediation
                                                    </span>
                                                ) : (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-red-100 ap-text-red-800">
                                                        <FailIcon className="ap-w-4 ap-h-4 ap-mr-1" />
                                                        Fail
                                                    </span>
                                                )}
                                                {drill.archived && (
                                                    <span className="ap-ml-2 ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-gray-200 ap-text-gray-700">
                                                        [ARCHIVED]
                                                    </span>
                                                )}
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-min-w-[350px]">
                                                <div className="ap-text-sm ap-text-gray-900">
                                                    {drillData?.scenario_type 
                                                        ? stripHtmlTags(drillData.scenario_type)
                                                        : '-'
                                                    }
                                                </div>
                                                {drillData?.daily_drill && (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-blue-100 ap-text-blue-800 ap-mt-1">
                                                        Daily Drill
                                                    </span>
                                                )}
                                            </td>
                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-text-gray-900">
                                                    {drillData?.staff_involved?.length || 0} staff
                                                </div>
                                            </td>
                                            <td className="ap-sticky ap-right-0 ap-bg-white group-hover:ap-bg-gray-50 ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                                                {(() => {
                                                    const isOwner = Number(drill.drill_conductor_id) === currentUser.id;
                                                    const canEditThis = (isOwner && permissions.canEdit) || permissions.canModerateAll || currentUser.isAdmin;
                                                    
                                                    console.log('[LiveDrillsView] Drill ID:', drill.id, 'Conductor ID:', drill.drill_conductor_id, 'Current User ID:', currentUser.id);
                                                    console.log('[LiveDrillsView] isOwner:', isOwner, 'canEdit:', permissions.canEdit, 'canModerateAll:', permissions.canModerateAll, 'canEditThis:', canEditThis);
                                                    
                                                    return canEditThis ? (
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            onClick={() => handleOpenForm(drill)}
                                                        >
                                                            <EditIcon className="ap-w-4 ap-h-4 ap-mr-1" />
                                                            Edit
                                                        </Button>
                                                    ) : null;
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveDrillsView;
