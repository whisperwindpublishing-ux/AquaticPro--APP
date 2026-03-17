/**
 * New Hire Manager
 * 
 * Admin interface for managing new hire applications.
 * 
 * Features:
 * - View all applications with filtering
 * - Approve/reject applications
 * - Visual indicator for work permit needs
 * - Send Letter of Intent
 * - LOI settings configuration
 */

import React, { useState, useEffect, useCallback } from 'react';
import Card from './ui/Card';
import { Modal, Button, Input, Label } from './ui';
import { 
    NewHire, 
    NewHireStatus, 
    NewHireFilters, 
    LOISettings 
} from '../types';
import {
    getApplications,
    adminCreateApplication,
    updateApplicationStatus,
    deleteApplication,
    bulkArchiveApplications,
    getLOISettings,
    updateLOISettings,
    previewLOI,
    sendLOI,
    getWPRoles,
    getNotificationUsers,
    formatName,
    getStatusColor,
    getStatusText,
    formatDate,
    formatDateTime,
    WPRole,
    NotificationUser,
} from '../services/newHiresService';
import {
    HiOutlineUsers,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineDocumentText,
    HiOutlinePaperAirplane,
    HiOutlineCog6Tooth,
    HiOutlineTrash,
    HiOutlineExclamationCircle,
    HiOutlineEye,
    HiOutlineArrowPath,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineMapPin,
    HiOutlineShieldCheck,
    HiOutlinePhoto,
    HiOutlineLink,
    HiOutlineClipboardDocument,
    HiOutlineArchiveBox,
    HiOutlineArchiveBoxXMark,
    HiOutlinePencilSquare,
    HiOutlinePrinter,
    HiOutlineUserPlus,
} from 'react-icons/hi2';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

type TabType = 'applications' | 'settings';

export default function NewHireManager() {
    // State
    const [activeTab, setActiveTab] = useState<TabType>('applications');
    const [applications, setApplications] = useState<NewHire[]>([]);
    const [filters, setFilters] = useState<NewHireFilters>({
        status: 'all',
        needs_work_permit: 'all',
        is_archived: false,
        search: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    
    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    
    // Approval Modal
    const [approvalModal, setApprovalModal] = useState<{ visible: boolean; applicant: NewHire | null; addAsMember: boolean }>({
        visible: false,
        applicant: null,
        addAsMember: true, // Default to true - add as member
    });
    
    // LOI Preview Modal
    const [previewModal, setPreviewModal] = useState<{ visible: boolean; html: string; applicant: NewHire | null }>({
        visible: false,
        html: '',
        applicant: null,
    });
    
    // Expanded rows
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    
    // LOI Settings
    const [loiSettings, setLoiSettings] = useState<LOISettings | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Add New Hire modal
    const [addModal, setAddModal] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [addForm, setAddForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        address: '',
    });

    // Fetch applications
    const fetchApplications = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getApplications(filters);
            setApplications(data.applications || []);
            setSelectedIds(new Set()); // Clear selection on refresh
        } catch (err) {
            console.error('Failed to fetch applications:', err);
            setError(err instanceof Error ? err.message : 'Failed to load applications');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    // Fetch LOI settings when settings tab is active
    useEffect(() => {
        if (activeTab === 'settings' && !loiSettings) {
            fetchLOISettings();
        }
    }, [activeTab]);

    const fetchLOISettings = async () => {
        try {
            setSettingsLoading(true);
            const data = await getLOISettings();
            setLoiSettings(data.settings);
        } catch (err) {
            console.error('Failed to fetch LOI settings:', err);
        } finally {
            setSettingsLoading(false);
        }
    };

    // Handle status update
    const handleStatusUpdate = async (id: number, status: NewHireStatus, addAsMember: boolean = true) => {
        try {
            setActionLoading(id);
            await updateApplicationStatus(id, status, true, addAsMember);
            await fetchApplications();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert(err instanceof Error ? err.message : 'Failed to update status');
        } finally {
            setActionLoading(null);
        }
    };
    
    // Handle approval with confirmation modal
    const openApprovalModal = (applicant: NewHire) => {
        setApprovalModal({
            visible: true,
            applicant,
            addAsMember: true, // Default to true
        });
    };
    
    const handleApprovalConfirm = async () => {
        if (!approvalModal.applicant) return;
        
        await handleStatusUpdate(approvalModal.applicant.id, 'approved', approvalModal.addAsMember);
        setApprovalModal({ visible: false, applicant: null, addAsMember: true });
    };

    // Handle delete
    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this application? This cannot be undone.')) {
            return;
        }
        try {
            setActionLoading(id);
            await deleteApplication(id);
            await fetchApplications();
        } catch (err) {
            console.error('Failed to delete:', err);
            alert(err instanceof Error ? err.message : 'Failed to delete application');
        } finally {
            setActionLoading(null);
        }
    };

    // Handle LOI preview
    const handlePreviewLOI = async (applicant: NewHire) => {
        try {
            setActionLoading(applicant.id);
            const data = await previewLOI(applicant.id);
            setPreviewModal({
                visible: true,
                html: data.html,
                applicant,
            });
        } catch (err) {
            console.error('Failed to preview LOI:', err);
            alert(err instanceof Error ? err.message : 'Failed to generate preview');
        } finally {
            setActionLoading(null);
        }
    };

    // Handle send LOI
    const handleSendLOI = async (id: number) => {
        if (!confirm('Send the Letter of Intent email to this applicant?')) {
            return;
        }
        try {
            setActionLoading(id);
            await sendLOI(id);
            await fetchApplications();
            alert('Letter of Intent sent successfully!');
        } catch (err) {
            console.error('Failed to send LOI:', err);
            alert(err instanceof Error ? err.message : 'Failed to send Letter of Intent');
        } finally {
            setActionLoading(null);
        }
    };

    // Handle print / download LOI as PDF
    const handlePrintLOI = () => {
        if (!previewModal.html || !previewModal.applicant) return;
        const applicantName = formatName(previewModal.applicant);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to print the Letter of Intent.');
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Letter of Intent - ${applicantName}</title>
                <style>
                    @page { margin: 0.5in; size: letter; }
                    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                    .header, .footer { text-align: center; overflow: visible; }
                    .header img, .footer img {
                        max-width: 100%;
                        max-height: 96px;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                        display: inline-block;
                    }
                    .content { padding: 16px 0; min-height: auto; }
                </style>
            </head>
            <body>
                ${previewModal.html}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    // Handle bulk archive/unarchive
    const handleBulkArchive = async (idsOrArchive: number[] | boolean, archiveParam?: boolean) => {
        // Support both signatures: handleBulkArchive(archive) or handleBulkArchive(ids, archive)
        let ids: number[];
        let archive: boolean;
        
        if (typeof idsOrArchive === 'boolean') {
            // Called with just archive boolean - use selectedIds
            ids = Array.from(selectedIds);
            archive = idsOrArchive;
        } else {
            // Called with specific IDs
            ids = idsOrArchive;
            archive = archiveParam ?? true;
        }
        
        if (ids.length === 0) {
            alert('Please select at least one application');
            return;
        }
        
        const action = archive ? 'archive' : 'unarchive';
        if (!confirm(`Are you sure you want to ${action} ${ids.length} application(s)?`)) {
            return;
        }
        
        try {
            setBulkActionLoading(true);
            await bulkArchiveApplications(ids, archive);
            await fetchApplications();
            if (ids.length > 1) {
                alert(`${ids.length} application(s) ${action}d successfully!`);
            }
        } catch (err) {
            console.error(`Failed to ${action} applications:`, err);
            alert(err instanceof Error ? err.message : `Failed to ${action} applications`);
        } finally {
            setBulkActionLoading(false);
        }
    };

    // Toggle selection
    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select all / Deselect all
    const toggleSelectAll = () => {
        if (selectedIds.size === applications.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(applications.map(a => a.id)));
        }
    };

    // Navigate to Users List to edit/manage user (within the plugin)
    const openUserInUsersList = (userName: string) => {
        // Dispatch navigation event to go to Users List with search pre-filled
        const event = new CustomEvent('navigate-to-users-list', { 
            detail: { 
                search: userName,
                returnTo: 'new-hires'
            } 
        });
        window.dispatchEvent(event);
    };

    // Handle settings save
    const handleSettingsSave = async () => {
        if (!loiSettings) return;
        try {
            setSettingsSaving(true);
            await updateLOISettings(loiSettings);
            alert('Settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setSettingsSaving(false);
        }
    };

    // Toggle row expansion
    const toggleRow = (id: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Filter counts
    const pendingCount = applications.filter(a => a.status === 'pending').length;
    const workPermitCount = applications.filter(a => a.needs_work_permit).length;

    // Handle add new hire
    const handleAddNewHire = async () => {
        if (!addForm.first_name || !addForm.last_name || !addForm.email) {
            alert('First name, last name, and email are required.');
            return;
        }
        try {
            setAddSaving(true);
            await adminCreateApplication({
                first_name: addForm.first_name,
                last_name: addForm.last_name,
                email: addForm.email,
                phone: addForm.phone,
                date_of_birth: addForm.date_of_birth,
                address: addForm.address,
                position: '',
                is_accepting: true,
                needs_work_permit: false,
            });
            setAddModal(false);
            setAddForm({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', address: '' });
            await fetchApplications();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to add new hire');
        } finally {
            setAddSaving(false);
        }
    };

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <div>
                    <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-flex ap-items-center ap-gap-3">
                        <HiOutlineUsers className="ap-w-7 ap-h-7 ap-text-blue-600" />
                        New Hire Management
                    </h1>
                    <p className="ap-text-gray-500 ap-mt-1">
                        Review and manage new hire applications
                    </p>
                </div>
                <div className="ap-flex ap-gap-2">
                    <Button
                        onClick={() => setAddModal(true)}
                        variant="primary"
                        leftIcon={<HiOutlineUserPlus className="ap-w-4 ap-h-4" />}
                    >
                        Add New Hire
                    </Button>
                    <Button
                        onClick={fetchApplications}
                        disabled={isLoading}
                        variant="ghost"
                        leftIcon={<HiOutlineArrowPath className={`ap-w-4 ap-h-4 ${isLoading ? 'ap-animate-spin' : ''}`} />}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="ap-border-b ap-border-gray-200">
                <nav className="ap-flex ap-gap-8">
                    <Button
                        onClick={() => setActiveTab('applications')}
                        variant="ghost"
                        size="sm"
                        className={`!ap-pb-3 !ap-px-1 !ap-rounded-none ap-border-b-2 !ap-min-h-0 ${
                            activeTab === 'applications'
                                ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700'
                        }`}
                    >
                        Applications
                        {pendingCount > 0 && (
                            <span className="ap-ml-2 ap-px-2 ap-py-0.5 ap-bg-yellow-100 ap-text-yellow-800 ap-text-xs ap-rounded-full">
                                {pendingCount} pending
                            </span>
                        )}
                    </Button>
                    <Button
                        onClick={() => setActiveTab('settings')}
                        variant="ghost"
                        size="sm"
                        leftIcon={<HiOutlineCog6Tooth className="ap-w-4 ap-h-4" />}
                        className={`!ap-pb-3 !ap-px-1 !ap-rounded-none ap-border-b-2 !ap-min-h-0 ${
                            activeTab === 'settings'
                                ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700'
                        }`}
                    >
                        New Hire Settings
                    </Button>
                </nav>
            </div>

            {/* Applications Tab */}
            {activeTab === 'applications' && (
                <div className="ap-space-y-4">
                    {/* Filters */}
                    <Card>
                        <Card.Body padding="sm">
                            <div className="ap-flex ap-flex-wrap ap-gap-4 ap-items-center">
                                {/* Search */}
                                <div className="ap-flex-1 ap-min-w-[200px]">
                                    <div className="ap-relative">
                                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={filters.search}
                                            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                        />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <HiOutlineFunnel className="ap-w-4 ap-h-4 ap-text-gray-500" />
                                <select
                                    value={filters.status}
                                    onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                                    className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>

                            {/* Work Permit Filter */}
                            <select
                                value={String(filters.needs_work_permit)}
                                onChange={e => setFilters(prev => ({ 
                                    ...prev, 
                                    needs_work_permit: e.target.value === 'all' ? 'all' : e.target.value === 'true'
                                }))}
                                className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            >
                                <option value="all">All Permits</option>
                                <option value="true">Needs Work Permit</option>
                                <option value="false">No Work Permit</option>
                            </select>

                            {/* Archive Filter */}
                            <select
                                value={filters.is_archived === 'all' ? 'all' : filters.is_archived ? 'archived' : 'active'}
                                onChange={e => setFilters(prev => ({ 
                                    ...prev, 
                                    is_archived: e.target.value === 'all' ? 'all' : e.target.value === 'archived'
                                }))}
                                className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            >
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                                <option value="all">All (incl. Archived)</option>
                            </select>
                        </div>

                        {/* Bulk Actions Bar */}
                        {selectedIds.size > 0 && (
                            <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3 ap-flex ap-items-center ap-justify-between">
                                <span className="ap-text-blue-700 ap-font-medium">
                                    {selectedIds.size} selected
                                </span>
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    {filters.is_archived !== true && (
                                        <Button
                                            onClick={() => handleBulkArchive(true)}
                                            disabled={bulkActionLoading}
                                            variant="warning"
                                            size="sm"
                                            leftIcon={<HiOutlineArchiveBox className="ap-w-4 ap-h-4" />}
                                        >
                                            Archive
                                        </Button>
                                    )}
                                    {filters.is_archived !== false && (
                                        <Button
                                            onClick={() => handleBulkArchive(false)}
                                            disabled={bulkActionLoading}
                                            variant="success"
                                            size="sm"
                                            leftIcon={<HiOutlineArchiveBoxXMark className="ap-w-4 ap-h-4" />}
                                        >
                                            Unarchive
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => setSelectedIds(new Set())}
                                        variant="ghost"
                                        size="sm"
                                    >
                                        Clear
                                    </Button>
                                    {bulkActionLoading && (
                                        <AiOutlineLoading3Quarters className="ap-w-4 ap-h-4 ap-text-blue-600 ap-animate-spin" />
                                    )}
                                </div>
                            </div>
                        )}
                        </Card.Body>
                    </Card>

                    {/* Stats Bar */}
                    <div className="ap-grid ap-grid-cols-3 ap-gap-4">
                        <Card>
                            <Card.Body padding="sm">
                                <div className="ap-text-sm ap-text-gray-500">Total Applications</div>
                                <div className="ap-text-2xl ap-font-bold ap-text-gray-900">{applications.length}</div>
                            </Card.Body>
                        </Card>
                        <Card>
                            <Card.Body padding="sm">
                                <div className="ap-text-sm ap-text-gray-500">Pending Review</div>
                                <div className="ap-text-2xl ap-font-bold ap-text-yellow-600">{pendingCount}</div>
                            </Card.Body>
                        </Card>
                        <Card>
                            <Card.Body padding="sm">
                                <div className="ap-text-sm ap-text-gray-500">Need Work Permit</div>
                                <div className="ap-text-2xl ap-font-bold ap-text-amber-600">{workPermitCount}</div>
                            </Card.Body>
                        </Card>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="ap-flex ap-items-center ap-gap-3 ap-p-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-text-red-800">
                            <HiOutlineExclamationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                            <AiOutlineLoading3Quarters className="ap-w-8 ap-h-8 ap-text-blue-600 ap-animate-spin" />
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && !error && applications.length === 0 && (
                        <Card className="ap-text-center ap-py-12">
                            <HiOutlineUsers className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No Applications Found</h3>
                            <p className="ap-text-gray-500">
                                {filters.status !== 'all' || filters.search
                                    ? 'Try adjusting your filters' : 'New hire applications will appear here'}
                            </p>
                        </Card>
                    )}

                    {/* Applications List */}
                    {!isLoading && applications.length > 0 && (
                        <Card padding="none" className="ap-overflow-hidden">
                            <div className="ap-overflow-x-auto">
                            <table className="ap-w-full ap-min-w-[900px]">
                                <thead className="ap-bg-gray-50 ap-border-b">
                                    <tr>
                                        <th className="ap-w-10 ap-px-4 ap-py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.size === applications.length && applications.length > 0}
                                                onChange={toggleSelectAll}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                                            />
                                        </th>
                                        <th className="ap-w-8 ap-px-2 ap-py-3"></th>
                                        <th className="ap-text-left ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600">Applicant</th>
                                        <th className="ap-text-left ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600">Position</th>
                                        <th className="ap-text-left ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600">Status</th>
                                        <th className="ap-text-left ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600">Work Permit</th>
                                        <th className="ap-text-left ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600">Applied</th>
                                        <th className="ap-text-right ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-600 ap-sticky ap-right-0 ap-bg-gray-50 ap-shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="ap-divide-y ap-divide-gray-100">
                                    {applications.map(app => (
                                        <React.Fragment key={app.id}>
                                            <tr className={`group hover:ap-bg-gray-50 ap-transition-colors ${app.is_archived ? 'ap-bg-gray-50 ap-opacity-75' : ''}`}>
                                                <td className="ap-px-4 ap-py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(app.id)}
                                                        onChange={() => toggleSelection(app.id)}
                                                        className="ap-w-4 ap-h-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                                                    />
                                                </td>
                                                <td className="ap-px-2 ap-py-3">
                                                    <Button
                                                        onClick={() => toggleRow(app.id)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="!ap-text-gray-400 hover:!ap-text-gray-600 !ap-p-1 !ap-min-h-0"
                                                    >
                                                        {expandedRows.has(app.id) ? (
                                                            <HiOutlineChevronUp className="ap-w-5 ap-h-5" />
                                                        ) : (
                                                            <HiOutlineChevronDown className="ap-w-5 ap-h-5" />
                                                        )}
                                                    </Button>
                                                </td>
                                                <td className="ap-px-4 ap-py-3">
                                                    <div className="ap-flex ap-items-center ap-gap-2">
                                                        <div>
                                                            <div className="ap-font-medium ap-text-gray-900">{formatName(app)}</div>
                                                            <div className="ap-text-sm ap-text-gray-500">{app.email}</div>
                                                        </div>
                                                        {app.is_archived && (
                                                            <span className="ap-px-1.5 ap-py-0.5 ap-text-xs ap-bg-gray-200 ap-text-gray-600 ap-rounded">
                                                                Archived
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="ap-px-4 ap-py-3 ap-text-gray-700">{app.position}</td>
                                                <td className="ap-px-4 ap-py-3">
                                                    <span className={`ap-inline-flex ap-px-2.5 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ${getStatusColor(app.status)}`}>
                                                        {getStatusText(app.status)}
                                                    </span>
                                                </td>
                                                <td className="ap-px-4 ap-py-3">
                                                    {app.needs_work_permit ? (
                                                        <div className="ap-flex ap-items-center ap-gap-1.5">
                                                            <HiOutlineShieldCheck className="ap-w-4 ap-h-4 ap-text-amber-500" />
                                                            <span className="ap-text-amber-700 ap-text-sm ap-font-medium">Required</span>
                                                            {app.loi_sent && (
                                                                <span className="ap-ml-2 ap-text-xs ap-text-green-600 ap-bg-green-50 ap-px-2 ap-py-0.5 ap-rounded">
                                                                    LOI Sent
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="ap-text-gray-400 ap-text-sm">Not needed</span>
                                                    )}
                                                </td>
                                                <td className="ap-px-4 ap-py-3 ap-text-sm ap-text-gray-500">
                                                    {formatDate(app.created_at)}
                                                </td>
                                                <td className={`ap-px-4 ap-py-3 ap-sticky ap-right-0 ap-shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)] ap-transition-colors ${app.is_archived ? 'ap-bg-gray-50' : 'ap-bg-white group-hover:ap-bg-gray-50'}`}>
                                                    <div className="ap-flex ap-items-center ap-justify-end ap-gap-1 ap-flex-nowrap">
                                                        {/* Status Actions */}
                                                        {app.status === 'pending' && (
                                                            <>
                                                                <Button
                                                                    onClick={() => openApprovalModal(app)}
                                                                    disabled={actionLoading === app.id}
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    className="!ap-p-2 !ap-text-green-600 hover:!ap-bg-green-50 !ap-min-h-0"
                                                                    title="Approve"
                                                                >
                                                                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                                                                </Button>
                                                                <Button
                                                                    onClick={() => handleStatusUpdate(app.id, 'rejected')}
                                                                    disabled={actionLoading === app.id}
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    className="!ap-p-2 !ap-text-red-600 hover:!ap-bg-red-50 !ap-min-h-0"
                                                                    title="Reject"
                                                                >
                                                                    <HiOutlineXCircle className="ap-w-5 ap-h-5" />
                                                                </Button>
                                                            </>
                                                        )}

                                                        {/* LOI Actions */}
                                                        {app.status === 'approved' && app.needs_work_permit && (
                                                            <>
                                                                <Button
                                                                    onClick={() => handlePreviewLOI(app)}
                                                                    disabled={actionLoading === app.id}
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    className="!ap-p-2 !ap-text-blue-600 hover:!ap-bg-blue-50 !ap-min-h-0"
                                                                    title="Preview LOI"
                                                                >
                                                                    <HiOutlineEye className="ap-w-5 ap-h-5" />
                                                                </Button>
                                                                <Button
                                                                    onClick={() => handleSendLOI(app.id)}
                                                                    disabled={actionLoading === app.id}
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    className="!ap-p-2 !ap-text-purple-600 hover:!ap-bg-purple-50 !ap-min-h-0"
                                                                    title={app.loi_sent ? "Resend LOI" : "Send LOI"}
                                                                >
                                                                    <HiOutlinePaperAirplane className="ap-w-5 ap-h-5" />
                                                                </Button>
                                                            </>
                                                        )}

                                                        {/* Archive/Unarchive */}
                                                        <Button
                                                            onClick={() => handleBulkArchive([app.id], !app.is_archived)}
                                                            disabled={bulkActionLoading}
                                                            variant="ghost"
                                                            size="xs"
                                                            className={`!ap-p-2 !ap-min-h-0 ${
                                                                app.is_archived 
                                                                    ? '!ap-text-green-600 hover:!ap-bg-green-50' : '!ap-text-gray-400 hover:!ap-text-gray-600 hover:!ap-bg-gray-100'
                                                            }`}
                                                            title={app.is_archived ? "Unarchive" : "Archive"}
                                                        >
                                                            {app.is_archived ? (
                                                                <HiOutlineArchiveBoxXMark className="ap-w-5 ap-h-5" />
                                                            ) : (
                                                                <HiOutlineArchiveBox className="ap-w-5 ap-h-5" />
                                                            )}
                                                        </Button>

                                                        {/* Edit User in Users List */}
                                                        {app.wp_user_id && (
                                                            <Button
                                                                onClick={() => openUserInUsersList(`${app.first_name} ${app.last_name}`)}
                                                                variant="ghost"
                                                                size="xs"
                                                                className="!ap-p-2 !ap-text-indigo-600 hover:!ap-bg-indigo-50 !ap-min-h-0"
                                                                title="Edit User (Users List)"
                                                            >
                                                                <HiOutlinePencilSquare className="ap-w-5 ap-h-5" />
                                                            </Button>
                                                        )}

                                                        {/* Delete */}
                                                        <Button
                                                            onClick={() => handleDelete(app.id)}
                                                            disabled={actionLoading === app.id}
                                                            variant="ghost"
                                                            size="xs"
                                                            className="!ap-p-2 !ap-text-gray-400 hover:!ap-text-red-600 hover:!ap-bg-red-50 !ap-min-h-0"
                                                            title="Delete"
                                                        >
                                                            <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                                        </Button>

                                                        {/* Loading indicator */}
                                                        {actionLoading === app.id && (
                                                            <AiOutlineLoading3Quarters className="ap-w-5 ap-h-5 ap-text-gray-400 ap-animate-spin" />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Details */}
                                            {expandedRows.has(app.id) && (
                                                <tr className="ap-bg-gray-50">
                                                    <td colSpan={8} className="ap-px-4 ap-py-4 ap-min-w-[900px]">
                                                        <div className="ap-grid ap-grid-cols-3 ap-gap-6 ap-pl-8">
                                                            <div className="ap-flex ap-items-start ap-gap-2">
                                                                <HiOutlineEnvelope className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5" />
                                                                <div>
                                                                    <div className="ap-text-xs ap-text-gray-500">Email</div>
                                                                    <div className="ap-text-sm ap-text-gray-900">{app.email}</div>
                                                                </div>
                                                            </div>
                                                            <div className="ap-flex ap-items-start ap-gap-2">
                                                                <HiOutlinePhone className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5" />
                                                                <div>
                                                                    <div className="ap-text-xs ap-text-gray-500">Phone</div>
                                                                    <div className="ap-text-sm ap-text-gray-900">{app.phone || 'Not provided'}</div>
                                                                </div>
                                                            </div>
                                                            <div className="ap-flex ap-items-start ap-gap-2">
                                                                <HiOutlineMapPin className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5" />
                                                                <div>
                                                                    <div className="ap-text-xs ap-text-gray-500">Address</div>
                                                                    <div className="ap-text-sm ap-text-gray-900">{app.address || 'Not provided'}</div>
                                                                </div>
                                                            </div>
                                                            {app.loi_sent && (
                                                                <div className="ap-flex ap-items-start ap-gap-2">
                                                                    <HiOutlineDocumentText className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5" />
                                                                    <div>
                                                                        <div className="ap-text-xs ap-text-gray-500">LOI Sent</div>
                                                                        <div className="ap-text-sm ap-text-green-600">{formatDateTime(app.loi_sent_date)}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {app.wp_user_id && (
                                                                <div className="ap-flex ap-items-start ap-gap-2">
                                                                    <HiOutlineUsers className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5" />
                                                                    <div>
                                                                        <div className="ap-text-xs ap-text-gray-500">WordPress User</div>
                                                                        <div className="ap-text-sm ap-text-gray-900">ID: {app.wp_user_id}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <LOISettingsEditor
                    settings={loiSettings}
                    loading={settingsLoading}
                    saving={settingsSaving}
                    onSettingsChange={setLoiSettings}
                    onSave={handleSettingsSave}
                />
            )}

            {/* LOI Preview Modal */}
            <Modal 
                isOpen={previewModal.visible} 
                onClose={() => setPreviewModal({ visible: false, html: '', applicant: null })}
                size="lg"
            >
                <Modal.Header showCloseButton onClose={() => setPreviewModal({ visible: false, html: '', applicant: null })}>
                    <Modal.Title>
                        Letter of Intent Preview
                        {previewModal.applicant && (
                            <span className="ap-ml-2 ap-text-gray-500 ap-font-normal ap-text-base">
                                for {formatName(previewModal.applicant)}
                            </span>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="ap-bg-gray-100">
                    {/* Scoped styles for preview - scale images proportionally, don't clip */}
                    <style>{`
                        .loi-preview-container .header,
                        .loi-preview-container .footer {
                            text-align: center !important;
                            overflow: visible !important;
                        }
                        .loi-preview-container .header img,
                        .loi-preview-container .footer img {
                            max-width: 100% !important;
                            max-height: 96px !important;
                            width: auto !important;
                            height: auto !important;
                            object-fit: contain !important;
                            display: inline-block !important;
                        }
                        .loi-preview-container .content {
                            padding: 16px 0 !important;
                            min-height: auto !important;
                        }
                    `}</style>
                    <div 
                        className="loi-preview-container ap-bg-white ap-shadow-lg ap-mx-auto ap-max-w-[8.5in] ap-min-h-[11in] ap-p-8"
                        dangerouslySetInnerHTML={{ __html: previewModal.html }}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => setPreviewModal({ visible: false, html: '', applicant: null })}
                        variant="secondary"
                    >
                        Close
                    </Button>
                    {previewModal.applicant && (
                        <Button
                            onClick={handlePrintLOI}
                            variant="secondary"
                            icon={<HiOutlinePrinter className="ap-w-4 ap-h-4" />}
                        >
                            Print / Save PDF
                        </Button>
                    )}
                    {previewModal.applicant && (
                        <Button
                            onClick={() => {
                                if (previewModal.applicant) {
                                    handleSendLOI(previewModal.applicant.id);
                                    setPreviewModal({ visible: false, html: '', applicant: null });
                                }
                            }}
                            variant="primary"
                            icon={<HiOutlinePaperAirplane className="ap-w-4 ap-h-4" />}
                        >
                            {previewModal.applicant.loi_sent ? 'Resend to Applicant' : 'Send to Applicant'}
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
            
            {/* Approval Confirmation Modal */}
            <Modal 
                isOpen={approvalModal.visible} 
                onClose={() => setApprovalModal({ visible: false, applicant: null, addAsMember: true })}
                size="sm"
            >
                <Modal.Header showCloseButton onClose={() => setApprovalModal({ visible: false, applicant: null, addAsMember: true })}>
                    <Modal.Title>
                        Approve Application
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {approvalModal.applicant && (
                        <div className="ap-space-y-4">
                            <p className="ap-text-gray-700">
                                Approve the application for <strong>{approvalModal.applicant.first_name} {approvalModal.applicant.last_name}</strong>?
                            </p>
                            <p className="ap-text-sm ap-text-gray-500">
                                This will create a WordPress user account for this person and send them a welcome email with login credentials.
                            </p>
                            
                            <div className="ap-border-t ap-pt-4">
                                <label className="ap-flex ap-items-start ap-gap-3 ap-cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={approvalModal.addAsMember}
                                        onChange={(e) => setApprovalModal(prev => ({ ...prev, addAsMember: e.target.checked }))}
                                        className="ap-mt-0.5 ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                                    />
                                    <div>
                                        <span className="ap-text-sm ap-font-medium ap-text-gray-900">Add as Member</span>
                                        <p className="ap-text-xs ap-text-gray-500 ap-mt-0.5">
                                            Members have full access to the platform. Non-members can only view the organization framework.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => setApprovalModal({ visible: false, applicant: null, addAsMember: true })}
                        variant="secondary"
                        disabled={actionLoading !== null}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApprovalConfirm}
                        variant="primary"
                        loading={approvalModal.applicant ? actionLoading === approvalModal.applicant.id : false}
                        icon={<HiOutlineCheckCircle className="ap-w-4 ap-h-4" />}
                    >
                        Approve
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Add New Hire Modal */}
            <Modal isOpen={addModal} onClose={() => setAddModal(false)}>
                <Modal.Header>
                    <Modal.Title>Add New Hire</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="ap-space-y-4">
                        <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                            <div>
                                <Label>First Name *</Label>
                                <Input
                                    value={addForm.first_name}
                                    onChange={e => setAddForm(p => ({ ...p, first_name: e.target.value }))}
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <Label>Last Name *</Label>
                                <Input
                                    value={addForm.last_name}
                                    onChange={e => setAddForm(p => ({ ...p, last_name: e.target.value }))}
                                    placeholder="Last name"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Email *</Label>
                            <Input
                                type="email"
                                value={addForm.email}
                                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input
                                value={addForm.phone}
                                onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder="Phone number"
                            />
                        </div>
                        <div>
                            <Label>Date of Birth</Label>
                            <Input
                                type="date"
                                value={addForm.date_of_birth}
                                onChange={e => setAddForm(p => ({ ...p, date_of_birth: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Input
                                value={addForm.address}
                                onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))}
                                placeholder="Full address"
                            />
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setAddModal(false)} disabled={addSaving}>Cancel</Button>
                    <Button variant="primary" onClick={handleAddNewHire} loading={addSaving}>
                        Add New Hire
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ==============================================
// New Hire Settings Editor Component
// ==============================================

interface LOISettingsEditorProps {
    settings: LOISettings | null;
    loading: boolean;
    saving: boolean;
    onSettingsChange: (settings: LOISettings) => void;
    onSave: () => void;
}

function LOISettingsEditor({ settings, loading, saving, onSettingsChange, onSave }: LOISettingsEditorProps) {
    // State for role and user pickers
    const [wpRoles, setWpRoles] = React.useState<WPRole[]>([]);
    const [allUsers, setAllUsers] = React.useState<NotificationUser[]>([]);
    const [loadingRoles, setLoadingRoles] = React.useState(true);
    const [loadingUsers, setLoadingUsers] = React.useState(true);
    
    // Fetch WP roles and users on mount
    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesData, usersData] = await Promise.all([
                    getWPRoles(),
                    getNotificationUsers()
                ]);
                setWpRoles(rolesData.roles || []);
                setAllUsers(usersData.users || []);
            } catch (err) {
                console.error('Failed to load roles/users:', err);
            } finally {
                setLoadingRoles(false);
                setLoadingUsers(false);
            }
        };
        fetchData();
    }, []);
    
    // Open WordPress media library
    const openMediaLibrary = (field: 'header_image' | 'footer_image' | 'signature_image') => {
        if (!window.wp?.media) {
            alert('WordPress Media Library is not available. Please upload images via the WordPress Media Library and paste the URL.');
            return;
        }

        const mediaUploader = window.wp.media({
            title: 'Select Image',
            button: { text: 'Use this image' },
            multiple: false,
            library: { type: 'image' }
        });

        mediaUploader.on('select', () => {
            const attachment = mediaUploader.state().get('selection').first().toJSON();
            if (settings) {
                onSettingsChange({ ...settings, [field]: attachment.url });
            }
        });

        mediaUploader.open();
    };
    
    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <AiOutlineLoading3Quarters className="ap-w-8 ap-h-8 ap-text-blue-600 ap-animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="ap-text-center ap-py-12 ap-bg-white ap-rounded-xl ap-shadow-sm ap-border">
                <HiOutlineExclamationCircle className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">Failed to Load Settings</h3>
                <p className="ap-text-gray-500">Please refresh the page to try again.</p>
            </div>
        );
    }

    const handleChange = (field: keyof LOISettings, value: string | string[] | number[]) => {
        onSettingsChange({ ...settings, [field]: value });
    };
    
    // Toggle role in notification_roles array
    const toggleRole = (roleSlug: string) => {
        const currentRoles = settings.notification_roles || [];
        const newRoles = currentRoles.includes(roleSlug)
            ? currentRoles.filter(r => r !== roleSlug)
            : [...currentRoles, roleSlug];
        handleChange('notification_roles', newRoles);
    };
    
    // Toggle user in notification_users array
    const toggleUser = (userId: number) => {
        const currentUsers = settings.notification_users || [];
        const newUsers = currentUsers.includes(userId)
            ? currentUsers.filter(u => u !== userId)
            : [...currentUsers, userId];
        handleChange('notification_users', newUsers);
    };

    // Image upload field component
    const ImageUploadField = ({ 
        label, 
        field, 
        maxHeight = 'max-h-24',
        description 
    }: { 
        label: string; 
        field: 'header_image' | 'footer_image' | 'signature_image';
        maxHeight?: string;
        description?: string;
    }) => (
        <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">{label}</label>
            {description && <p className="ap-text-xs ap-text-gray-500 ap-mb-2">{description}</p>}
            <div className="ap-flex ap-gap-2">
                <input
                    type="text"
                    value={settings[field]}
                    onChange={e => handleChange(field, e.target.value)}
                    className="ap-flex-1 ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                    placeholder="https://..."
                />
                <Button
                    type="button"
                    onClick={() => openMediaLibrary(field)}
                    variant="secondary"
                    leftIcon={<HiOutlinePhoto className="ap-w-5 ap-h-5" />}
                >
                    Browse
                </Button>
            </div>
            {settings[field] && (
                <div className="ap-mt-2 ap-p-2 ap-bg-gray-50 ap-border ap-rounded-lg ap-inline-block">
                    <img 
                        src={settings[field]} 
                        alt={`${label} preview`}
                        className={`${maxHeight} ap-object-contain`}
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="ap-space-y-6">
            {/* Application Form URL */}
            <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-xl ap-p-6">
                <div className="ap-flex ap-items-start ap-gap-3">
                    <HiOutlineLink className="ap-w-6 ap-h-6 ap-text-blue-600 ap-mt-0.5 ap-flex-shrink-0" />
                    <div className="ap-flex-1">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-blue-900">New Hire Application Form</h3>
                        <p className="ap-text-sm ap-text-blue-700 ap-mt-1">
                            Share this link with applicants to complete their new hire application:
                        </p>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-mt-3">
                            <code className="ap-flex-1 ap-bg-white ap-border ap-border-blue-200 ap-rounded-lg ap-px-4 ap-py-2 ap-text-sm ap-text-blue-900 ap-font-mono">
                                {window.location.origin}/new-hire-form/
                            </code>
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/new-hire-form/`);
                                    alert('URL copied to clipboard!');
                                }}
                                variant="primary"
                                size="sm"
                                leftIcon={<HiOutlineClipboardDocument className="ap-w-4 ap-h-4" />}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-p-6">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">Application Notifications</h3>
                <p className="ap-text-sm ap-text-gray-500 ap-mb-4">
                    Select which job roles and/or specific users should receive email notifications when a new hire application is submitted.
                </p>
                
                <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-2 ap-gap-6">
                    {/* Role Picker */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Notify Users by Job Role
                        </label>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">
                            All users with these AquaticPro job roles will receive notification emails.
                        </p>
                        {loadingRoles ? (
                            <div className="ap-flex ap-items-center ap-gap-2 ap-text-gray-500 ap-py-4">
                                <AiOutlineLoading3Quarters className="ap-w-4 ap-h-4 ap-animate-spin" />
                                Loading job roles...
                            </div>
                        ) : (
                            <div className="ap-border ap-border-gray-300 ap-rounded-lg ap-max-h-48 ap-overflow-y-auto">
                                {wpRoles.length === 0 ? (
                                    <p className="ap-p-3 ap-text-gray-500 ap-text-sm">No job roles available</p>
                                ) : (
                                    wpRoles.map(role => (
                                        <label
                                            key={role.slug}
                                            className="ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(settings.notification_roles || []).includes(role.slug)}
                                                onChange={() => toggleRole(role.slug)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                                            />
                                            <span className="ap-text-sm ap-text-gray-700">{role.name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}
                        {(settings.notification_roles || []).length > 0 && (
                            <p className="ap-mt-2 ap-text-xs ap-text-blue-600">
                                {(settings.notification_roles || []).length} job role(s) selected
                            </p>
                        )}
                    </div>
                    
                    {/* User Picker */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Notify Specific Users
                        </label>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">
                            These users will always receive notifications regardless of their role.
                        </p>
                        {loadingUsers ? (
                            <div className="ap-flex ap-items-center ap-gap-2 ap-text-gray-500 ap-py-4">
                                <AiOutlineLoading3Quarters className="ap-w-4 ap-h-4 ap-animate-spin" />
                                Loading users...
                            </div>
                        ) : (
                            <div className="ap-border ap-border-gray-300 ap-rounded-lg ap-max-h-48 ap-overflow-y-auto">
                                {allUsers.length === 0 ? (
                                    <p className="ap-p-3 ap-text-gray-500 ap-text-sm">No users available</p>
                                ) : (
                                    allUsers.map(user => (
                                        <label
                                            key={user.id}
                                            className="ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={(settings.notification_users || []).includes(user.id)}
                                                onChange={() => toggleUser(user.id)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                                            />
                                            <div className="ap-flex-1 ap-min-w-0">
                                                <span className="ap-text-sm ap-text-gray-700 ap-block ap-truncate">{user.name}</span>
                                                <span className="ap-text-xs ap-text-gray-400 ap-block ap-truncate">{user.email}</span>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}
                        {(settings.notification_users || []).length > 0 && (
                            <p className="ap-mt-2 ap-text-xs ap-text-blue-600">
                                {(settings.notification_users || []).length} user(s) selected
                            </p>
                        )}
                    </div>
                </div>
                
                {(settings.notification_roles || []).length === 0 && (settings.notification_users || []).length === 0 && (
                    <div className="ap-mt-4 ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg ap-p-3">
                        <p className="ap-text-sm ap-text-amber-800">
                            <strong>Note:</strong> No recipients selected. The site admin email will receive notifications by default.
                        </p>
                    </div>
                )}
            </div>

            {/* Organization Info */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-p-6">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">Organization Information</h3>
                <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Organization Name
                        </label>
                        <input
                            type="text"
                            value={settings.organization_name}
                            onChange={e => handleChange('organization_name', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="Your Organization Name"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Organization Address
                        </label>
                        <input
                            type="text"
                            value={settings.organization_address}
                            onChange={e => handleChange('organization_address', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="123 Main St, City, State 12345"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Organization Phone
                        </label>
                        <input
                            type="text"
                            value={settings.organization_phone}
                            onChange={e => handleChange('organization_phone', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="(555) 123-4567"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Organization Email
                        </label>
                        <input
                            type="email"
                            value={settings.organization_email}
                            onChange={e => handleChange('organization_email', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="info@organization.com"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Sender Name
                        </label>
                        <input
                            type="text"
                            value={settings.sender_name}
                            onChange={e => handleChange('sender_name', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="John Smith"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Sender Title
                        </label>
                        <input
                            type="text"
                            value={settings.sender_title}
                            onChange={e => handleChange('sender_title', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="Director of Operations"
                        />
                    </div>
                </div>
            </div>

            {/* Letterhead Images */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-p-6">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">Letterhead Images</h3>
                <p className="ap-text-sm ap-text-gray-500 ap-mb-2">
                    Click "Browse" to select from your WordPress Media Library, or paste an image URL directly.
                </p>
                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3 ap-mb-4">
                    <p className="ap-text-sm ap-text-blue-800">
                        <strong>📐 Image Dimension Guide:</strong> Images display at their natural size (centered). 
                        For <strong>full-width edge-to-edge</strong> letterhead, use <strong>816 × your height</strong> pixels (8.5" at 96 DPI).
                        For high-quality print, use <strong>2550 × your height</strong> pixels (8.5" at 300 DPI).
                    </p>
                </div>
                <div className="ap-space-y-6">
                    <ImageUploadField 
                        label="Header Image" 
                        field="header_image"
                        maxHeight="max-h-24"
                        description="Top of letter. For edge-to-edge: 816px wide (screen) or 2550px (print quality). Centered if narrower."
                    />
                    <ImageUploadField 
                        label="Footer Image" 
                        field="footer_image"
                        maxHeight="max-h-20"
                        description="Bottom of letter. For edge-to-edge: 816px wide (screen) or 2550px (print quality). Centered if narrower."
                    />
                    <ImageUploadField 
                        label="Signature Image" 
                        field="signature_image"
                        maxHeight="max-h-16"
                        description="Your signature scan. Recommended: 200-400px wide, transparent PNG background."
                    />
                </div>
            </div>

            {/* LOI Body Template */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-p-6">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">Letter of Intent Template</h3>
                <p className="ap-text-sm ap-text-gray-500 ap-mb-2">
                    Customize the body of your Letter of Intent. Available placeholders:
                </p>
                <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-4">
                    {[
                        '{{current_date}}',
                        '{{employee_first_name}}',
                        '{{employee_last_name}}',
                        '{{employee_full_name}}',
                        '{{employee_email}}',
                        '{{employee_phone}}',
                        '{{employee_dob}}',
                        '{{employee_address}}',
                        '{{job_roles}}',
                        '{{organization_name}}',
                        '{{organization_address}}',
                        '{{organization_phone}}',
                        '{{organization_email}}',
                        '{{sender_name}}',
                        '{{sender_title}}',
                        '{{signature}}',
                    ].map(placeholder => (
                        <code 
                            key={placeholder}
                            className="ap-text-xs ap-bg-gray-100 ap-px-2 ap-py-1 ap-rounded ap-cursor-pointer hover:ap-bg-blue-100 ap-transition-colors"
                            onClick={() => navigator.clipboard?.writeText(placeholder)}
                            title="Click to copy"
                        >
                            {placeholder}
                        </code>
                    ))}
                </div>
                <p className="ap-text-xs ap-text-amber-600 ap-mb-3">
                    <strong>Note:</strong> <code className="ap-bg-amber-50 ap-px-1">{`{{job_roles}}`}</code> will show the employee's assigned job roles from Admin → Users List → Job Assignments.
                    Make sure to assign job roles to the employee before sending the LOI.
                </p>
                <textarea
                    value={settings.template_body}
                    onChange={e => handleChange('template_body', e.target.value)}
                    rows={12}
                    className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-font-mono ap-text-sm"
                    placeholder="Enter your letter template..."
                />
            </div>

            {/* Email Settings */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-p-6">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">Email Settings</h3>
                <div className="ap-space-y-4">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Email Subject
                        </label>
                        <input
                            type="text"
                            value={settings.email_subject}
                            onChange={e => handleChange('email_subject', e.target.value)}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="Letter of Intent - {{job_roles}}"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Email Body
                        </label>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                            This text appears in the email. The LOI PDF will be attached. Same placeholders are available.
                        </p>
                        <textarea
                            value={settings.email_body}
                            onChange={e => handleChange('email_body', e.target.value)}
                            rows={6}
                            className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            placeholder="Hello {{employee_first_name}},\n\nPlease find attached your Letter of Intent..."
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="ap-flex ap-justify-end">
                <Button
                    onClick={onSave}
                    disabled={saving}
                    variant="primary"
                    leftIcon={saving ? <AiOutlineLoading3Quarters className="ap-w-5 ap-h-5 ap-animate-spin" /> : undefined}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
