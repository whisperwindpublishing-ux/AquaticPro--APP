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
import ScanAuditForm from './ScanAuditForm';
import LoadingSpinner from './LoadingSpinner';
import { getScanAudits, type AuditLog } from '@/services/api-professional-growth';
import { useScanAuditPermissions } from '@/hooks/useScanAuditPermissions';
import { downloadCSV, formatDateForCSV, formatBooleanForCSV } from '../utils/csvExport';

interface ScanAuditsViewProps {
    currentUser: {
        id: number;
        name: string;
        isAdmin: boolean;
    };
}

type SortField = 'audit_date' | 'audited_user_name' | 'result' | 'location';

const ScanAuditsView: React.FC<ScanAuditsViewProps> = ({ currentUser }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingAudit, setEditingAudit] = useState<AuditLog | null>(null);
    const [audits, setAudits] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('audit_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedAudits, setSelectedAudits] = useState<number[]>([]);
    
    // Get permissions for current user
    const permissions = useScanAuditPermissions(currentUser.id);
    
    console.log('[ScanAuditsView] Current User ID:', currentUser.id);
    console.log('[ScanAuditsView] Permissions:', permissions);

    useEffect(() => {
        loadAudits();
    }, [showArchived]);

    const loadAudits = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Visitor Mode: Bypass API call, return empty list
            if (window.mentorshipPlatformData?.visitor_mode) {
                setAudits([]);
                setLoading(false);
                return;
            }
            
            const data = await getScanAudits({ include_archived: showArchived });
            setAudits(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load scan audits');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingAudit(null);
        loadAudits();
    };

    const handleOpenForm = (audit?: AuditLog) => {
        if (audit) {
            setEditingAudit(audit);
        } else {
            setEditingAudit(null);
        }
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingAudit(null);
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

    // Filter and sort audits
    const filteredAndSortedAudits = useMemo(() => {
        let filtered = audits;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = audits.filter(audit =>
                audit.audited_user_name?.toLowerCase().includes(query) ||
                audit.auditor_name?.toLowerCase().includes(query) ||
                audit.location?.toLowerCase().includes(query) ||
                audit.notes?.toLowerCase().includes(query)
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
    }, [audits, searchQuery, sortField, sortDirection]);

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

    const handleToggleSelect = (auditId: number) => {
        setSelectedAudits(prev => 
            prev.includes(auditId) 
                ? prev.filter(id => id !== auditId)
                : [...prev, auditId]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedAudits.length === filteredAndSortedAudits.length) {
            setSelectedAudits([]);
        } else {
            setSelectedAudits(filteredAndSortedAudits.map(audit => audit.id));
        }
    };

    const handleBulkArchive = async () => {
        const nonArchivedSelected = selectedAudits.filter(id => 
            !audits.find(audit => audit.id === id)?.archived
        );

        if (nonArchivedSelected.length === 0) {
            alert('No non-archived audits selected');
            return;
        }

        if (!confirm(`Are you sure you want to archive ${nonArchivedSelected.length} scan audit(s)?`)) {
            return;
        }

        try {
            const { bulkArchiveScanAudits } = await import('../services/api-professional-growth');
            await bulkArchiveScanAudits(nonArchivedSelected);
            setSelectedAudits([]);
            loadAudits();
        } catch (error) {
            console.error('Error bulk archiving scan audits:', error);
            alert('Failed to archive scan audits');
        }
    };

    const handleBulkRestore = async () => {
        const archivedSelected = selectedAudits.filter(id => 
            audits.find(audit => audit.id === id)?.archived
        );

        if (archivedSelected.length === 0) {
            alert('No archived audits selected');
            return;
        }

        if (!confirm(`Are you sure you want to restore ${archivedSelected.length} scan audit(s)?`)) {
            return;
        }

        try {
            const { bulkRestoreScanAudits } = await import('../services/api-professional-growth');
            await bulkRestoreScanAudits(archivedSelected);
            setSelectedAudits([]);
            loadAudits();
        } catch (error) {
            console.error('Error bulk restoring scan audits:', error);
            alert('Failed to restore scan audits');
        }
    };

    const handleDownloadCSV = async () => {
        try {
            // Fetch all audits including archived
            const allAudits = await getScanAudits({ include_archived: true });
            
            if (allAudits.length === 0) {
                alert('No scan audits to export');
                return;
            }

            // Prepare data for CSV
            const csvData = allAudits.map(audit => ({
                'Date': formatDateForCSV(audit.audit_date),
                'Staff Member': audit.audited_user_name || '',
                'Auditor': audit.auditor_name || '',
                'Location': audit.location || '',
                'Wearing Correct Uniform': formatBooleanForCSV(audit.wearing_correct_uniform),
                'Attentive to Zone': formatBooleanForCSV(audit.attentive_to_zone),
                'Posture Adjustment (5min)': formatBooleanForCSV(audit.posture_adjustment_5min),
                'Result': audit.result || '',
                'Notes': audit.notes || '',
                'Attachments': audit.attachments ? JSON.parse(audit.attachments).map((a: any) => a.url).join('; ') : '',
                'Archived': audit.archived ? 'Yes' : 'No',
                'Created By': audit.auditor_name || '',
                'Created At': formatDateForCSV(audit.created_at),
            }));

            downloadCSV(csvData, 'scan_audits');
        } catch (error) {
            console.error('Error downloading CSV:', error);
            alert('Failed to generate CSV export');
        }
    };

    if (showForm) {
        return (
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6">
                <div className="ap-mb-6">
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                        {editingAudit ? 'Edit Scan Audit' : 'New Scan Audit'}
                    </h2>
                    <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                        {editingAudit 
                            ? 'Update the scan audit details' : 'Record observations ap-from a scan audit'
                        }
                    </p>
                </div>
                <ScanAuditForm
                    editingAudit={editingAudit}
                    onSuccess={handleFormSuccess}
                    onCancel={handleCloseForm}
                />
            </div>
        );
    }

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow">
            {/* Header */}
            <div className="ap-p-6 ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                    <div>
                        <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Scan Audits</h2>
                        <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                            Track scan audit observations and performance
                        </p>
                    </div>
                    {(permissions.canCreate || currentUser.isAdmin) && (
                        <Button
                            variant="primary"
                            onClick={() => handleOpenForm()}
                        >
                            <PlusIcon className="ap-h-5 ap-w-5 ap-mr-2" />
                            New Audit
                        </Button>
                    )}
                </div>

                {/* Search and Filter Controls */}
                <div className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-3 ap-items-start sm:ap-items-center ap-justify-between">
                    <div className="ap-relative ap-flex-1 ap-max-w-md">
                        <div className="ap-absolute ap-inset-y-0 ap-left-0 ap-pl-3 ap-flex ap-items-center ap-pointer-events-none">
                            <SearchIcon className="ap-h-5 ap-w-5 ap-text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search audits..."
                            className="ap-block ap-w-full ap-pl-10 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-leading-5 ap-bg-white ap-placeholder-gray-500 focus:ap-outline-none focus:ap-placeholder-gray-400 focus:ap-ring-1 focus:ap-ring-blue-500 focus:ap-border-blue-500 sm:ap-text-sm"
                        />
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="outline"
                            onClick={handleDownloadCSV}
                            title="Download all records as CSV"
                        >
                            <DownloadIcon className="ap-h-4 ap-w-4 ap-mr-2" />
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
            </div>

            {/* Content */}
            <div className="ap-p-6">
                {loading ? (
                    <div className="ap-text-center ap-py-8">
                        <LoadingSpinner />
                        <span className="ap-ml-3 ap-text-gray-600">Loading audits...</span>
                    </div>
                ) : error ? (
                    <div className="ap-text-center ap-py-12">
                        <p className="ap-text-red-600">{error}</p>
                        <Button
                            variant="link"
                            onClick={loadAudits}
                            className="ap-mt-4"
                        >
                            Try again
                        </Button>
                    </div>
                ) : filteredAndSortedAudits.length === 0 ? (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">
                        {audits.length === 0 
                            ? 'No scan audits yet. Click "New Audit" ap-to create one.' : 'No scan audits match your search criteria.'}
                    </div>
                ) : (
                    <>
                        {/* Bulk Actions */}
                        {selectedAudits.length > 0 && (
                            <div className="ap-mb-4 ap-flex ap-items-center ap-gap-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3">
                                <span className="ap-text-sm ap-font-medium ap-text-blue-900">
                                    {selectedAudits.length} item{selectedAudits.length !== 1 ? 's' : ''} selected
                                </span>
                                {selectedAudits.some(id => !audits.find(audit => audit.id === id)?.archived) && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleBulkArchive}
                                        className="!ap-bg-orange-600 hover:!ap-bg-orange-700 focus:!ap-ring-orange-500"
                                    >
                                        Archive Selected
                                    </Button>
                                )}
                                {selectedAudits.some(id => audits.find(audit => audit.id === id)?.archived) && (
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
                                    onClick={() => setSelectedAudits([])}
                                    className="ap-ml-auto !ap-text-gray-600 hover:!ap-text-gray-900"
                                >
                                    Clear Selection
                                </Button>
                            </div>
                        )}
                        <div className="ap-overflow-x-auto">
                        <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    <th className="ap-px-6 ap-py-3 ap-text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedAudits.length === filteredAndSortedAudits.length && filteredAndSortedAudits.length > 0}
                                            onChange={handleToggleSelectAll}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            title="Select all"
                                        />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('audit_date')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Date{getSortIcon('audit_date')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('audited_user_name')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Audited Staff{getSortIcon('audited_user_name')}
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                        Auditor
                                    </th>
                                    <th 
                                        onClick={() => handleSort('result')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Result{getSortIcon('result')}
                                    </th>
                                    <th 
                                        onClick={() => handleSort('location')}
                                        className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    >
                                        Location{getSortIcon('location')}
                                    </th>
                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-min-w-[350px]">
                                        Details
                                    </th>
                                    <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                {filteredAndSortedAudits.map((audit) => (
                                    <tr key={audit.id} className={`hover:ap-bg-gray-50 ${audit.archived ? 'ap-bg-gray-100 ap-opacity-75' : ''}`}>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={selectedAudits.includes(audit.id)}
                                                onChange={() => handleToggleSelect(audit.id)}
                                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                            />
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-flex ap-items-center ap-text-sm ap-text-gray-900">
                                                {audit.archived && <span className="ap-text-xs ap-text-gray-500 ap-mr-2">[ARCHIVED]</span>}
                                                <CalendarIcon className="ap-w-4 ap-h-4 ap-mr-2 ap-text-gray-400" />
                                                {audit.audit_date && formatDate(audit.audit_date)}
                                            </div>
                                            {audit.audit_date && (
                                                <div className="ap-flex ap-items-center ap-text-xs ap-text-gray-500 ap-mt-1">
                                                    <ClockIcon className="ap-w-3 ap-h-3 ap-mr-1" />
                                                    {formatTime(audit.audit_date)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {audit.audited_user_name || `User #${audit.audited_user_id}`}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-text-sm ap-text-gray-500">
                                                {audit.auditor_name || '-'}
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            {audit.result === 'pass' ? (
                                                <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-800">
                                                    <PassIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                                                    Pass
                                                </span>
                                            ) : (
                                                <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-red-100 ap-text-red-800">
                                                    <FailIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                                                    Fail
                                                </span>
                                            )}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                            {audit.location || '-'}
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-min-w-[350px]">
                                            {audit.notes ? (
                                                <div className="ap-text-xs ap-text-gray-500 line-clamp-3">
                                                    <div dangerouslySetInnerHTML={{ __html: audit.notes }} />
                                                </div>
                                            ) : (
                                                <span className="ap-text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="ap-sticky ap-right-0 ap-bg-white ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                            {(() => {
                                                const isOwner = Number(audit.auditor_id) === currentUser.id;
                                                const canEditThis = (isOwner && permissions.canEdit) || permissions.canModerateAll || currentUser.isAdmin;
                                                
                                                console.log('[ScanAuditsView] Audit ID:', audit.id, 'Auditor ID:', audit.auditor_id, 'Current User ID:', currentUser.id);
                                                console.log('[ScanAuditsView] isOwner:', isOwner, 'canEdit:', permissions.canEdit, 'canModerateAll:', permissions.canModerateAll, 'canEditThis:', canEditThis);
                                                
                                                return canEditThis ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => handleOpenForm(audit)}
                                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-text-blue-900"
                                                        title="Edit audit"
                                                    >
                                                        <EditIcon className="ap-w-5 ap-h-5" />
                                                    </Button>
                                                ) : null;
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScanAuditsView;
