import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/Button';
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
import CashierAuditForm from './CashierAuditForm';
import LoadingSpinner from './LoadingSpinner';
import { getCashierAudits, bulkArchiveCashierAudits, bulkRestoreCashierAudits, type CashierAuditLog } from '@/services/api-professional-growth';
import { useCashierAuditPermissions } from '@/hooks/useCashierAuditPermissions';
import { downloadCSV, formatDateForCSV } from '../utils/csvExport';

interface CashierAuditsViewProps {
    currentUser: {
        id: number;
        name: string;
        isAdmin: boolean;
    };
}

type SortField = 'audit_date' | 'audited_user_name';

const CashierAuditsView: React.FC<CashierAuditsViewProps> = ({ currentUser }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingAudit, setEditingAudit] = useState<CashierAuditLog | null>(null);
    const [audits, setAudits] = useState<CashierAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('audit_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showArchived, setShowArchived] = useState(false);
    const [selectedAudits, setSelectedAudits] = useState<number[]>([]);
    
    // Get permissions for current user
    const permissions = useCashierAuditPermissions(currentUser.id);

    useEffect(() => {
        loadAudits();
    }, [showArchived]);

    const loadAudits = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const data = await getCashierAudits({ include_archived: showArchived });
            setAudits(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load cashier audits');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingAudit(null);
        loadAudits();
    };

    const handleOpenForm = (audit?: CashierAuditLog) => {
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
                audit.notes?.toLowerCase().includes(query) ||
                audit.resolved_patron_concerns?.toLowerCase().includes(query)
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
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedAudits(filteredAndSortedAudits.map(a => a.id));
        } else {
            setSelectedAudits([]);
        }
    };

    const handleSelectAudit = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedAudits([...selectedAudits, id]);
        } else {
            setSelectedAudits(selectedAudits.filter(i => i !== id));
        }
    };

    const handleBulkArchive = async () => {
        if (selectedAudits.length === 0) return;
        if (!confirm(`Archive ${selectedAudits.length} selected audit(s)?`)) return;
        
        try {
            await bulkArchiveCashierAudits(selectedAudits);
            setSelectedAudits([]);
            loadAudits();
        } catch (error) {
            console.error('Error bulk archiving cashier audits:', error);
            alert('Failed to archive cashier audits');
        }
    };

    const handleBulkRestore = async () => {
        if (selectedAudits.length === 0) return;
        if (!confirm(`Restore ${selectedAudits.length} selected audit(s)?`)) return;
        
        try {
            await bulkRestoreCashierAudits(selectedAudits);
            setSelectedAudits([]);
            loadAudits();
        } catch (error) {
            console.error('Error bulk restoring cashier audits:', error);
            alert('Failed to restore cashier audits');
        }
    };

    const handleExportCSV = () => {
        if (filteredAndSortedAudits.length === 0) {
            alert('No cashier audits to export');
            return;
        }

        const csvData = filteredAndSortedAudits.map(audit => ({
            'Date': formatDateForCSV(audit.audit_date),
            'Employee': audit.audited_user_name || '',
            'Reviewer': audit.auditor_name || '',
            'Cash Drawer Check': formatYesNoNa(audit.checked_cash_drawer),
            'Attentive to Patrons': formatYesNoNa(audit.attentive_patrons_entered),
            'Welcoming Demeanor': formatYesNoNa(audit.greeted_with_demeanor),
            'One Click Per Person': formatYesNoNa(audit.one_click_per_person),
            'Pool Pass Process': formatYesNoNa(audit.pool_pass_process),
            'Patron Concerns': audit.resolved_patron_concerns || '',
            'Notes': audit.notes || '',
            'Archived': audit.archived ? 'Yes' : 'No',
        }));

        downloadCSV(csvData, `cashier-audits-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const formatYesNoNa = (value?: string): string => {
        switch (value) {
            case 'yes': return 'Yes';
            case 'no': return 'No';
            case 'na': return 'N/A';
            default: return '-';
        }
    };

    const getYesNoNaBadge = (value?: string) => {
        switch (value) {
            case 'yes':
                return (
                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-800">
                        <PassIcon className="ap-h-3 ap-w-3 ap-mr-1" />
                        Yes
                    </span>
                );
            case 'no':
                return (
                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-red-100 ap-text-red-800">
                        <FailIcon className="ap-h-3 ap-w-3 ap-mr-1" />
                        No
                    </span>
                );
            case 'na':
                return (
                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-800">
                        N/A
                    </span>
                );
            default:
                return <span className="ap-text-gray-400">-</span>;
        }
    };

    // Calculate summary stats
    const calculatePassRate = () => {
        const activeAudits = audits.filter(a => !a.archived);
        if (activeAudits.length === 0) return null;
        
        let totalChecks = 0;
        let passedChecks = 0;
        
        activeAudits.forEach(audit => {
            const fields = [
                audit.checked_cash_drawer,
                audit.attentive_patrons_entered,
                audit.greeted_with_demeanor,
                audit.one_click_per_person,
                audit.pool_pass_process,
            ];
            
            fields.forEach(field => {
                if (field === 'yes' || field === 'no') {
                    totalChecks++;
                    if (field === 'yes') passedChecks++;
                }
            });
        });
        
        if (totalChecks === 0) return null;
        return Math.round((passedChecks / totalChecks) * 100);
    };

    if (showForm) {
        return (
            <CashierAuditForm
                editingAudit={editingAudit}
                onSuccess={handleFormSuccess}
                onCancel={handleCloseForm}
            />
        );
    }

    const passRate = calculatePassRate();

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
            {/* Header */}
            <div className="ap-p-6 ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                    <div>
                        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">Cashier Audits</h2>
                        <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                            Observational audits for cashier performance
                        </p>
                    </div>
                    <div className="ap-flex ap-gap-2">
                        <Button
                            onClick={handleExportCSV}
                            variant="secondary"
                            className="!ap-inline-flex !ap-items-center"
                        >
                            <DownloadIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                            Export
                        </Button>
                        {(permissions.canCreate || currentUser.isAdmin) && (
                            <Button
                                onClick={() => handleOpenForm()}
                                variant="primary"
                                className="!ap-inline-flex !ap-items-center"
                            >
                                <PlusIcon className="ap-h-5 ap-w-5 ap-mr-1" />
                                New Audit
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                {passRate !== null && (
                    <div className="ap-mt-4 ap-flex ap-gap-4">
                        <div className="ap-bg-gray-50 ap-rounded-lg ap-px-4 ap-py-2">
                            <div className="ap-text-sm ap-text-gray-500">Total Audits</div>
                            <div className="ap-text-2xl ap-font-bold ap-text-gray-900">{audits.filter(a => !a.archived).length}</div>
                        </div>
                        <div className="ap-bg-green-50 ap-rounded-lg ap-px-4 ap-py-2">
                            <div className="ap-text-sm ap-text-gray-500">Overall Pass Rate</div>
                            <div className="ap-text-2xl ap-font-bold ap-text-green-600">{passRate}%</div>
                        </div>
                    </div>
                )}

                {/* Search and Filters */}
                <div className="ap-mt-4 ap-flex ap-flex-col sm:ap-flex-row ap-gap-4">
                    <div className="ap-relative ap-flex-1">
                        <SearchIcon className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-h-5 ap-w-5 ap-text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="ap-pl-10 ap-w-full ap-rounded-md ap-border-gray-300 ap-shadow-sm focus:ap-border-blue-500 focus:ap-ring-blue-500"
                        />
                    </div>
                    <label className="ap-flex ap-items-center ap-gap-2">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                        />
                        <span className="ap-text-sm ap-text-gray-700">Show Archived</span>
                    </label>
                </div>

                {/* Bulk Actions */}
                {selectedAudits.length > 0 && (permissions.canModerateAll || currentUser.isAdmin) && (
                    <div className="ap-mt-4 ap-flex ap-gap-2 ap-items-center ap-bg-blue-50 ap-p-3 ap-rounded-md">
                        <span className="ap-text-sm ap-text-blue-700">{selectedAudits.length} selected</span>
                        {showArchived ? (
                            <Button
                                onClick={handleBulkRestore}
                                variant="ghost"
                                size="sm"
                                className="!ap-text-blue-600 hover:!ap-text-blue-800 !ap-font-medium"
                            >
                                Restore Selected
                            </Button>
                        ) : (
                            <Button
                                onClick={handleBulkArchive}
                                variant="ghost"
                                size="sm"
                                className="!ap-text-blue-600 hover:!ap-text-blue-800 !ap-font-medium"
                            >
                                Archive Selected
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="ap-overflow-x-auto">
                {loading ? (
                    <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="ap-p-6 ap-text-center ap-text-red-600">{error}</div>
                ) : filteredAndSortedAudits.length === 0 ? (
                    <div className="ap-p-12 ap-text-center ap-text-gray-500">
                        {searchQuery
                            ? 'No cashier audits match your search criteria.' : 'No cashier audits yet. Click "New Audit" ap-to create one.'}
                    </div>
                ) : (
                    <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                {(permissions.canModerateAll || currentUser.isAdmin) && (
                                    <th className="ap-w-10 ap-px-4 ap-py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedAudits.length === filteredAndSortedAudits.length && filteredAndSortedAudits.length > 0}
                                            onChange={handleSelectAll}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                        />
                                    </th>
                                )}
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('audit_date')}
                                >
                                    Date {getSortIcon('audit_date')}
                                </th>
                                <th 
                                    className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100"
                                    onClick={() => handleSort('audited_user_name')}
                                >
                                    Employee {getSortIcon('audited_user_name')}
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Cash Drawer
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Attentive
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Greeting
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    One Click
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Pool Pass
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Reviewer
                                </th>
                                <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {filteredAndSortedAudits.map(audit => (
                                <tr 
                                    key={audit.id} 
                                    className={`hover:ap-bg-gray-50 ${audit.archived ? 'ap-bg-gray-100 ap-opacity-60' : ''}`}
                                >
                                    {(permissions.canModerateAll || currentUser.isAdmin) && (
                                        <td className="ap-w-10 ap-px-4 ap-py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedAudits.includes(audit.id)}
                                                onChange={(e) => handleSelectAudit(audit.id, e.target.checked)}
                                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                            />
                                        </td>
                                    )}
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        <div className="ap-flex ap-items-center ap-text-sm">
                                            <CalendarIcon className="ap-h-4 ap-w-4 ap-text-gray-400 ap-mr-1" />
                                            <span className="ap-text-gray-900">{formatDate(audit.audit_date)}</span>
                                        </div>
                                        <div className="ap-flex ap-items-center ap-text-xs ap-text-gray-500 ap-mt-1">
                                            <ClockIcon className="ap-h-3 ap-w-3 ap-mr-1" />
                                            {formatTime(audit.audit_date)}
                                        </div>
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                            {audit.audited_user_name}
                                        </div>
                                        {audit.archived && (
                                            <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-gray-200 ap-text-gray-600">
                                                Archived
                                            </span>
                                        )}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        {getYesNoNaBadge(audit.checked_cash_drawer)}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        {getYesNoNaBadge(audit.attentive_patrons_entered)}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        {getYesNoNaBadge(audit.greeted_with_demeanor)}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        {getYesNoNaBadge(audit.one_click_per_person)}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap">
                                        {getYesNoNaBadge(audit.pool_pass_process)}
                                    </td>
                                    <td className="ap-px-4 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                        {audit.auditor_name}
                                    </td>
                                    <td className="ap-sticky ap-right-0 ap-bg-white ap-px-4 ap-py-4 ap-whitespace-nowrap ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                        {(permissions.canEdit || permissions.canModerateAll || currentUser.isAdmin || audit.auditor_id === currentUser.id) && (
                                            <Button
                                                onClick={() => handleOpenForm(audit)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-p-1 !ap-min-h-0"
                                                title="Edit"
                                            >
                                                <EditIcon className="ap-h-5 ap-w-5" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CashierAuditsView;
