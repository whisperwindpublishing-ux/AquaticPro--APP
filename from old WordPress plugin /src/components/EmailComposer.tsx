/**
 * EmailComposer — Custom Email Sending Module
 *
 * Allows Tier 6 / WP Admin users to:
 * - Compose rich emails using the BlockNote editor
 * - Select recipients by job role or individually
 * - Insert images from the WordPress Media Library (as linked images)
 * - Save/load email templates for reuse
 * - View send history
 *
 * Three tabs: Compose, Templates, History
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import BlockEditor from '@/components/BlockEditor';
import { blocksJsonToHtml } from '@/services/api';
import {
    sendEmail,
    previewRecipients,
    getEmailUsers,
    getEmailRoles,
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    getEmailHistory,
    getEmailSeasons,
    EmailRecipientUser,
    EmailRole,
    EmailTemplate,
    EmailHistoryEntry,
    EmailSeason,
    PreviewRecipientsResult,
} from '@/services/emailComposerService';
import {
    HiOutlineEnvelope,
    HiOutlineDocumentDuplicate,
    HiOutlineClock,
    HiOutlinePaperAirplane,
    HiOutlineUserGroup,
    HiOutlineUser,
    HiOutlineMagnifyingGlass,
    HiOutlineXMark,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineArchiveBox,
    HiOutlineEye,
    HiOutlineBookmarkSquare,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
} from 'react-icons/hi2';

type Tab = 'compose' | 'templates' | 'history';

const EmailComposer: React.FC = () => {
    // --- Tab state ---
    const [activeTab, setActiveTab] = useState<Tab>('compose');

    // --- Compose state ---
    const [subject, setSubject] = useState('');
    const [bodyJson, setBodyJson] = useState<any>(undefined);
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [roleSearch, setRoleSearch] = useState('');
    const [showUserPicker, setShowUserPicker] = useState(false);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [recipientPreview, setRecipientPreview] = useState<PreviewRecipientsResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // --- Seasonal Return Filter ---
    const [seasons, setSeasons] = useState<EmailSeason[]>([]);
    const [seasonsAvailable, setSeasonsAvailable] = useState(false);
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
    const [selectedReturnStatus, setSelectedReturnStatus] = useState<string | null>(null);

    // --- Data ---
    const [users, setUsers] = useState<EmailRecipientUser[]>([]);
    const [roles, setRoles] = useState<EmailRole[]>([]);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [history, setHistory] = useState<EmailHistoryEntry[]>([]);

    // --- UI state ---
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; sentCount: number; failedCount: number } | null>(null);
    const [error, setError] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

    const userPickerRef = useRef<HTMLDivElement>(null);
    const rolePickerRef = useRef<HTMLDivElement>(null);

    // --- Load initial data ---
    useEffect(() => {
        loadRoles();
        loadSeasons();
    }, []);

    useEffect(() => {
        loadUsers();
    }, [includeArchived]);

    useEffect(() => {
        if (activeTab === 'templates') loadTemplates();
        if (activeTab === 'history') loadHistory();
    }, [activeTab]);

    const loadUsers = async () => {
        try {
            const data = await getEmailUsers(includeArchived);
            setUsers(data);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    const loadRoles = async () => {
        try {
            const data = await getEmailRoles();
            setRoles(data);
        } catch (err) {
            console.error('Failed to load roles:', err);
        }
    };

    const loadSeasons = async () => {
        try {
            const data = await getEmailSeasons();
            setSeasons(data.seasons);
            setSeasonsAvailable(data.available);
        } catch (err) {
            console.error('Failed to load seasons:', err);
        }
    };

    const loadTemplates = async () => {
        try {
            const data = await getEmailTemplates();
            setTemplates(data);
        } catch (err) {
            console.error('Failed to load templates:', err);
        }
    };

    const loadHistory = async () => {
        try {
            const data = await getEmailHistory();
            setHistory(data);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    // --- Filtered lists ---
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const s = userSearch.toLowerCase();
        return users.filter(u =>
            u.name.toLowerCase().includes(s) ||
            u.email.toLowerCase().includes(s)
        );
    }, [users, userSearch]);

    const filteredRoles = useMemo(() => {
        if (!roleSearch.trim()) return roles;
        const s = roleSearch.toLowerCase();
        return roles.filter(r => r.title.toLowerCase().includes(s));
    }, [roles, roleSearch]);

    // Selected user/role objects for display
    const selectedUsers = useMemo(() =>
        users.filter(u => selectedUserIds.includes(u.id)),
        [users, selectedUserIds]
    );

    const selectedRoles = useMemo(() =>
        roles.filter(r => selectedRoleIds.includes(r.id)),
        [roles, selectedRoleIds]
    );

    // --- Handlers ---
    const toggleRole = (roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
        setRecipientPreview(null);
    };

    const toggleUser = (userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
        setRecipientPreview(null);
    };

    const removeUser = (userId: number) => {
        setSelectedUserIds(prev => prev.filter(id => id !== userId));
        setRecipientPreview(null);
    };

    const removeRole = (roleId: number) => {
        setSelectedRoleIds(prev => prev.filter(id => id !== roleId));
        setRecipientPreview(null);
    };

    const handlePreviewRecipients = async () => {
        try {
            const result = await previewRecipients(selectedUserIds, selectedRoleIds, selectedSeasonId, selectedReturnStatus);
            setRecipientPreview(result);
            setShowPreview(true);
        } catch (err) {
            console.error('Failed to preview recipients:', err);
        }
    };

    const handleSend = async () => {
        setError('');
        setSendResult(null);

        if (!subject.trim()) {
            setError('Subject is required.');
            return;
        }

        const html = blocksJsonToHtml(bodyJson);
        if (!html.trim()) {
            setError('Email body cannot be empty.');
            return;
        }

        if (selectedUserIds.length === 0 && selectedRoleIds.length === 0) {
            setError('Select at least one recipient or role.');
            return;
        }

        setIsSending(true);
        try {
            const result = await sendEmail({
                subject: subject.trim(),
                bodyHtml: html,
                bodyJson: JSON.stringify(bodyJson),
                userIds: selectedUserIds,
                roleIds: selectedRoleIds,
                seasonId: selectedSeasonId,
                returnStatus: selectedReturnStatus,
            });
            setSendResult(result);
            if (result.success) {
                // Don't clear form — user might want to save as template
            }
        } catch (err: any) {
            setError(err.message || 'Failed to send email.');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!templateName.trim()) return;

        const html = blocksJsonToHtml(bodyJson);
        try {
            if (editingTemplateId) {
                await updateEmailTemplate(editingTemplateId, {
                    name: templateName.trim(),
                    subject: subject.trim(),
                    bodyJson: JSON.stringify(bodyJson),
                    bodyHtml: html,
                });
            } else {
                await createEmailTemplate({
                    name: templateName.trim(),
                    subject: subject.trim(),
                    bodyJson: JSON.stringify(bodyJson),
                    bodyHtml: html,
                });
            }
            setShowSaveTemplate(false);
            setTemplateName('');
            setEditingTemplateId(null);
            loadTemplates();
        } catch (err: any) {
            setError(err.message || 'Failed to save template.');
        }
    };

    const handleLoadTemplate = (template: EmailTemplate) => {
        setSubject(template.subject || '');
        try {
            const parsed = template.bodyJson ? JSON.parse(template.bodyJson) : undefined;
            setBodyJson(parsed);
        } catch {
            setBodyJson(undefined);
        }
        setActiveTab('compose');
        setSendResult(null);
        setError('');
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await deleteEmailTemplate(id);
            loadTemplates();
        } catch (err: any) {
            setError(err.message || 'Failed to delete template.');
        }
    };

    const handleClearForm = () => {
        setSubject('');
        setBodyJson(undefined);
        setSelectedRoleIds([]);
        setSelectedUserIds([]);
        setSelectedSeasonId(null);
        setSelectedReturnStatus(null);
        setSendResult(null);
        setError('');
        setRecipientPreview(null);
        setShowPreview(false);
    };

    // Close pickers when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
                setShowUserPicker(false);
            }
            if (rolePickerRef.current && !rolePickerRef.current.contains(e.target as Node)) {
                setShowRolePicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Total recipients estimate
    const recipientEstimate = selectedRoleIds.reduce((sum, rid) => {
        const role = roles.find(r => r.id === rid);
        return sum + (role?.userCount || 0);
    }, 0) + selectedUserIds.length;

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="ap-max-w-5xl ap-mx-auto">
            {/* Header */}
            <div className="ap-mb-6">
                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-800">Email Composer</h1>
                <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                    Send custom emails to users or entire job roles
                </p>
            </div>

            {/* Tabs */}
            <div className="ap-flex ap-gap-2 ap-mb-6">
                {([
                    { key: 'compose' as Tab, label: 'Compose', icon: HiOutlineEnvelope },
                    { key: 'templates' as Tab, label: 'Templates', icon: HiOutlineDocumentDuplicate },
                    { key: 'history' as Tab, label: 'Send History', icon: HiOutlineClock },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`ap-flex ap-items-center ap-gap-2 ap-px-4 ap-py-2 ap-rounded-full ap-text-sm ap-font-medium ap-transition-colors ${
                            activeTab === tab.key
                                ? 'ap-bg-indigo-100 ap-text-indigo-700 ap-border ap-border-indigo-200'
                                : 'ap-text-gray-600 ap-border ap-border-gray-200 hover:ap-bg-gray-50'
                        }`}
                    >
                        <tab.icon className="ap-w-4 ap-h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ============================================ */}
            {/* COMPOSE TAB */}
            {/* ============================================ */}
            {activeTab === 'compose' && (
                <div className="ap-space-y-6">
                    {/* Success / Error Messages */}
                    {sendResult && sendResult.success && (
                        <div className="ap-flex ap-items-center ap-gap-3 ap-p-4 ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg">
                            <HiOutlineCheckCircle className="ap-w-6 ap-h-6 ap-text-green-500 ap-flex-shrink-0" />
                            <div>
                                <p className="ap-font-medium ap-text-green-800">
                                    Email sent successfully!
                                </p>
                                <p className="ap-text-sm ap-text-green-600">
                                    Delivered to {sendResult.sentCount} recipient{sendResult.sentCount !== 1 ? 's' : ''}.
                                    {sendResult.failedCount > 0 && ` (${sendResult.failedCount} failed)`}
                                </p>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="ap-flex ap-items-center ap-gap-3 ap-p-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg">
                            <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-500 ap-flex-shrink-0" />
                            <p className="ap-text-sm ap-text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Recipients Section */}
                    <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-5">
                        <h2 className="ap-text-sm ap-font-semibold ap-text-gray-700 ap-mb-4 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineUserGroup className="ap-w-4 ap-h-4" />
                            Recipients
                            {recipientEstimate > 0 && (
                                <span className="ap-text-xs ap-font-normal ap-text-gray-400">
                                    (~{recipientEstimate} recipient{recipientEstimate !== 1 ? 's' : ''}, may overlap)
                                </span>
                            )}
                        </h2>

                        {/* By Role */}
                        <div className="ap-mb-4">
                            <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-2">
                                By Job Role (sends to all active members with that role)
                            </label>
                            <div className="ap-relative" ref={rolePickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowRolePicker(!showRolePicker)}
                                    className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg ap-text-sm hover:ap-border-gray-400 ap-transition-colors ap-bg-white"
                                >
                                    <span className="ap-text-gray-500">
                                        {selectedRoleIds.length === 0
                                            ? 'Select job roles...'
                                            : `${selectedRoleIds.length} role${selectedRoleIds.length !== 1 ? 's' : ''} selected`
                                        }
                                    </span>
                                    {showRolePicker ? <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-gray-400" /> : <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-gray-400" />}
                                </button>
                                {showRolePicker && (
                                    <div className="ap-absolute ap-z-20 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-60 ap-overflow-y-auto">
                                        <div className="ap-p-2 ap-border-b ap-border-gray-100">
                                            <div className="ap-relative">
                                                <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={roleSearch}
                                                    onChange={e => setRoleSearch(e.target.value)}
                                                    placeholder="Search roles..."
                                                    className="ap-w-full ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm ap-border ap-border-gray-200 ap-rounded-md focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-indigo-200"
                                                />
                                            </div>
                                        </div>
                                        {filteredRoles.map(role => (
                                            <label
                                                key={role.id}
                                                className="ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRoleIds.includes(role.id)}
                                                    onChange={() => toggleRole(role.id)}
                                                    className="ap-rounded ap-text-indigo-600"
                                                />
                                                <div className="ap-flex-1 ap-min-w-0">
                                                    <span className="ap-text-sm ap-text-gray-700">{role.title}</span>
                                                    <span className="ap-text-xs ap-text-gray-400 ap-ml-2">
                                                        Tier {role.tier} · {role.userCount} member{role.userCount !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                        {filteredRoles.length === 0 && (
                                            <p className="ap-text-sm ap-text-gray-400 ap-p-3 ap-text-center">No roles found</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Selected role chips */}
                            {selectedRoles.length > 0 && (
                                <div className="ap-flex ap-flex-wrap ap-gap-1.5 ap-mt-2">
                                    {selectedRoles.map(role => (
                                        <span
                                            key={role.id}
                                            className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2.5 ap-py-1 ap-text-xs ap-bg-indigo-50 ap-text-indigo-700 ap-rounded-full ap-border ap-border-indigo-100"
                                        >
                                            <HiOutlineUserGroup className="ap-w-3 ap-h-3" />
                                            {role.title}
                                            <span className="ap-text-indigo-400">({role.userCount})</span>
                                            <button
                                                type="button"
                                                onClick={() => removeRole(role.id)}
                                                className="ap-ml-0.5 hover:ap-text-indigo-900"
                                            >
                                                <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Seasonal Return Filter */}
                        {seasonsAvailable && seasons.length > 0 && (
                            <div className="ap-mb-4 ap-p-4 ap-bg-sky-50/60 ap-border ap-border-sky-200 ap-rounded-lg">
                                <label className="ap-text-xs ap-font-semibold ap-text-sky-800 ap-mb-2 ap-flex ap-items-center ap-gap-1.5">
                                    <svg className="ap-w-4 ap-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    Filter by Seasonal Return Status
                                    <span className="ap-text-xs ap-font-normal ap-text-sky-500">(optional)</span>
                                </label>
                                <p className="ap-text-xs ap-text-sky-600 ap-mb-3">
                                    Narrow role-based recipients to only those with a specific return status for a season.
                                </p>
                                <div className="ap-flex ap-flex-wrap ap-gap-3">
                                    <div className="ap-flex-1 ap-min-w-[180px]">
                                        <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-1">Season</label>
                                        <select
                                            value={selectedSeasonId ?? ''}
                                            onChange={e => {
                                                const val = e.target.value ? Number(e.target.value) : null;
                                                setSelectedSeasonId(val);
                                                if (!val) setSelectedReturnStatus(null);
                                                setRecipientPreview(null);
                                            }}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg ap-bg-white focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-sky-200"
                                        >
                                            <option value="">— No season filter —</option>
                                            {seasons.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.year}){s.isCurrent ? ' ★ Current' : ''}{s.isActive ? '' : ' (Inactive)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ap-flex-1 ap-min-w-[180px]">
                                        <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-1">Return Status</label>
                                        <select
                                            value={selectedReturnStatus ?? ''}
                                            onChange={e => {
                                                setSelectedReturnStatus(e.target.value || null);
                                                setRecipientPreview(null);
                                            }}
                                            disabled={!selectedSeasonId}
                                            className={`ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg ap-bg-white focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-sky-200 ${
                                                !selectedSeasonId ? 'ap-opacity-50 ap-cursor-not-allowed' : ''
                                            }`}
                                        >
                                            <option value="">— All statuses —</option>
                                            <option value="returning">✅ Returning</option>
                                            <option value="not_returning">❌ Not Returning</option>
                                            <option value="pending">⏳ Pending / No Response</option>
                                        </select>
                                    </div>
                                </div>
                                {selectedSeasonId && selectedReturnStatus && (
                                    <div className="ap-mt-2 ap-flex ap-items-center ap-gap-2">
                                        <span className="ap-text-xs ap-text-sky-700 ap-bg-sky-100 ap-px-2.5 ap-py-1 ap-rounded-full ap-border ap-border-sky-200">
                                            Filtering: {seasons.find(s => s.id === selectedSeasonId)?.name} — {selectedReturnStatus === 'returning' ? 'Returning' : selectedReturnStatus === 'not_returning' ? 'Not Returning' : 'Pending'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedSeasonId(null);
                                                setSelectedReturnStatus(null);
                                                setRecipientPreview(null);
                                            }}
                                            className="ap-text-xs ap-text-sky-500 hover:ap-text-sky-700"
                                        >
                                            Clear filter
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* By Individual User */}
                        <div>
                            <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-2">
                                Individual Users
                            </label>
                            <div className="ap-relative" ref={userPickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowUserPicker(!showUserPicker)}
                                    className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg ap-text-sm hover:ap-border-gray-400 ap-transition-colors ap-bg-white"
                                >
                                    <span className="ap-text-gray-500">
                                        {selectedUserIds.length === 0
                                            ? 'Search and select users...'
                                            : `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? 's' : ''} selected`
                                        }
                                    </span>
                                    {showUserPicker ? <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-gray-400" /> : <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-gray-400" />}
                                </button>
                                {showUserPicker && (
                                    <div className="ap-absolute ap-z-20 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-72 ap-overflow-y-auto">
                                        <div className="ap-p-2 ap-border-b ap-border-gray-100 ap-space-y-2">
                                            <div className="ap-relative">
                                                <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={userSearch}
                                                    onChange={e => setUserSearch(e.target.value)}
                                                    placeholder="Search users..."
                                                    className="ap-w-full ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm ap-border ap-border-gray-200 ap-rounded-md focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-indigo-200"
                                                />
                                            </div>
                                            <label className="ap-flex ap-items-center ap-gap-2 ap-text-xs ap-text-gray-500 ap-cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={includeArchived}
                                                    onChange={e => setIncludeArchived(e.target.checked)}
                                                    className="ap-rounded ap-text-indigo-600"
                                                />
                                                Include archived users
                                            </label>
                                        </div>
                                        {filteredUsers.map(user => (
                                            <label
                                                key={user.id}
                                                className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2 hover:ap-bg-gray-50 ap-cursor-pointer ${user.archived ? 'ap-opacity-60' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUserIds.includes(user.id)}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="ap-rounded ap-text-indigo-600"
                                                />
                                                <div className="ap-flex-1 ap-min-w-0">
                                                    <span className="ap-text-sm ap-text-gray-700">{user.name}</span>
                                                    <span className="ap-text-xs ap-text-gray-400 ap-ml-2">{user.email}</span>
                                                    {user.archived && (
                                                        <span className="ap-ml-1.5 ap-text-xs ap-text-amber-600 ap-bg-amber-50 ap-px-1.5 ap-py-0.5 ap-rounded">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <p className="ap-text-sm ap-text-gray-400 ap-p-3 ap-text-center">No users found</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Selected user chips */}
                            {selectedUsers.length > 0 && (
                                <div className="ap-flex ap-flex-wrap ap-gap-1.5 ap-mt-2">
                                    {selectedUsers.map(user => (
                                        <span
                                            key={user.id}
                                            className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2.5 ap-py-1 ap-text-xs ap-rounded-full ap-border ${
                                                user.archived
                                                    ? 'ap-bg-amber-50 ap-text-amber-700 ap-border-amber-100'
                                                    : 'ap-bg-blue-50 ap-text-blue-700 ap-border-blue-100'
                                            }`}
                                        >
                                            <HiOutlineUser className="ap-w-3 ap-h-3" />
                                            {user.name}
                                            {user.archived && <HiOutlineArchiveBox className="ap-w-3 ap-h-3 ap-text-amber-500" />}
                                            <button
                                                type="button"
                                                onClick={() => removeUser(user.id)}
                                                className="ap-ml-0.5 hover:ap-text-red-600"
                                            >
                                                <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Preview Recipients */}
                        {(selectedUserIds.length > 0 || selectedRoleIds.length > 0) && (
                            <div className="ap-mt-4 ap-pt-4 ap-border-t ap-border-gray-100">
                                <button
                                    type="button"
                                    onClick={handlePreviewRecipients}
                                    className="ap-text-sm ap-text-indigo-600 hover:ap-text-indigo-800 ap-flex ap-items-center ap-gap-1"
                                >
                                    <HiOutlineEye className="ap-w-4 ap-h-4" />
                                    Preview final recipient list (de-duplicated)
                                </button>
                                {showPreview && recipientPreview && (
                                    <div className="ap-mt-2 ap-bg-gray-50 ap-rounded-lg ap-p-3">
                                        <p className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            {recipientPreview.totalCount} recipient{recipientPreview.totalCount !== 1 ? 's' : ''} will receive this email:
                                        </p>
                                        <div className="ap-flex ap-flex-wrap ap-gap-1">
                                            {recipientPreview.recipients.map(r => (
                                                <span
                                                    key={r.id}
                                                    className={`ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${
                                                        r.archived
                                                            ? 'ap-bg-amber-100 ap-text-amber-700'
                                                            : 'ap-bg-white ap-text-gray-600 ap-border ap-border-gray-200'
                                                    }`}
                                                >
                                                    {r.name} {r.archived ? '(archived)' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Subject */}
                    <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-5">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Subject *
                        </label>
                        <Input
                            type="text"
                            value={subject}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                            placeholder="Email subject line..."
                            className="ap-w-full"
                        />
                    </div>

                    {/* Body Editor */}
                    <div className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-5">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Email Body *
                        </label>
                        <p className="ap-text-xs ap-text-gray-400 ap-mb-3">
                            Use the slash (/) menu or toolbar to format text, add headings, lists, and more. Type /media to insert images, PDFs, videos, or other files from the Media Library. Media are sent as links in the email.
                        </p>
                        <BlockEditor
                            key={bodyJson === undefined ? 'empty' : 'loaded'}
                            initialContent={bodyJson}
                            onChange={setBodyJson}
                            editable={true}
                        />
                    </div>

                    {/* Actions */}
                    <div className="ap-flex ap-items-center ap-justify-between ap-flex-wrap ap-gap-3">
                        <div className="ap-flex ap-gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearForm}
                                className="ap-text-gray-500"
                            >
                                Clear
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowSaveTemplate(true);
                                    setEditingTemplateId(null);
                                    setTemplateName('');
                                }}
                                className="ap-text-indigo-600"
                            >
                                <HiOutlineBookmarkSquare className="ap-w-4 ap-h-4 ap-mr-1" />
                                Save as Template
                            </Button>
                        </div>
                        <Button
                            onClick={handleSend}
                            disabled={isSending || !subject.trim() || (selectedUserIds.length === 0 && selectedRoleIds.length === 0)}
                            className="ap-bg-indigo-600 hover:ap-bg-indigo-700 ap-text-white ap-px-6"
                        >
                            {isSending ? (
                                <>
                                    <svg className="ap-animate-spin ap-w-4 ap-h-4 ap-mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <HiOutlinePaperAirplane className="ap-w-4 ap-h-4 ap-mr-1" />
                                    Send Email
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Save Template Modal */}
                    {showSaveTemplate && (
                        <div className="ap-fixed ap-inset-0 ap-bg-black/30 ap-flex ap-items-center ap-justify-center ap-z-50" onClick={() => setShowSaveTemplate(false)}>
                            <div className="ap-bg-white ap-rounded-xl ap-shadow-xl ap-p-6 ap-w-full ap-max-w-md ap-mx-4" onClick={e => e.stopPropagation()}>
                                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-mb-4">
                                    {editingTemplateId ? 'Update Template' : 'Save as Template'}
                                </h3>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Template Name *
                                </label>
                                <Input
                                    type="text"
                                    value={templateName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
                                    placeholder="e.g., Weekly Update, Safety Reminder..."
                                    className="ap-w-full ap-mb-4"
                                />
                                <div className="ap-flex ap-justify-end ap-gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveAsTemplate}
                                        disabled={!templateName.trim()}
                                        className="ap-bg-indigo-600 hover:ap-bg-indigo-700 ap-text-white"
                                    >
                                        {editingTemplateId ? 'Update' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ============================================ */}
            {/* TEMPLATES TAB */}
            {/* ============================================ */}
            {activeTab === 'templates' && (
                <div className="ap-space-y-4">
                    {templates.length === 0 ? (
                        <div className="ap-text-center ap-py-12 ap-text-gray-400">
                            <HiOutlineDocumentDuplicate className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-3 ap-opacity-50" />
                            <p className="ap-text-sm">No saved templates yet.</p>
                            <p className="ap-text-xs ap-mt-1">Compose an email and click "Save as Template" to save it for reuse.</p>
                        </div>
                    ) : (
                        templates.map(template => (
                            <div
                                key={template.id}
                                className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 hover:ap-border-gray-300 ap-transition-colors"
                            >
                                <div className="ap-flex ap-items-start ap-justify-between ap-gap-4">
                                    <div className="ap-flex-1 ap-min-w-0">
                                        <h3 className="ap-font-semibold ap-text-gray-800">{template.name}</h3>
                                        {template.subject && (
                                            <p className="ap-text-sm ap-text-gray-500 ap-mt-0.5">
                                                Subject: {template.subject}
                                            </p>
                                        )}
                                        <p className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                            Created by {template.createdBy} · Updated {formatLocalDate(template.updatedAt)}
                                        </p>
                                    </div>
                                    <div className="ap-flex ap-gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => handleLoadTemplate(template)}
                                            className="ap-text-indigo-600 hover:ap-bg-indigo-50"
                                            title="Use this template"
                                        >
                                            <HiOutlineEnvelope className="ap-w-4 ap-h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => {
                                                handleLoadTemplate(template);
                                                setEditingTemplateId(template.id);
                                                setTemplateName(template.name);
                                                setShowSaveTemplate(true);
                                            }}
                                            className="ap-text-gray-500 hover:ap-bg-gray-100"
                                            title="Edit template"
                                        >
                                            <HiOutlinePencilSquare className="ap-w-4 ap-h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="ap-text-red-500 hover:ap-bg-red-50"
                                            title="Delete template"
                                        >
                                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                        </Button>
                                    </div>
                                </div>
                                {/* Preview of body content */}
                                {template.bodyHtml && (
                                    <div
                                        className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-100 ap-text-sm ap-text-gray-500 ap-line-clamp-3 ap-leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: template.bodyHtml }}
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ============================================ */}
            {/* HISTORY TAB */}
            {/* ============================================ */}
            {activeTab === 'history' && (
                <div className="ap-space-y-4">
                    {history.length === 0 ? (
                        <div className="ap-text-center ap-py-12 ap-text-gray-400">
                            <HiOutlineClock className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-3 ap-opacity-50" />
                            <p className="ap-text-sm">No emails sent yet.</p>
                        </div>
                    ) : (
                        history.map(entry => (
                            <div
                                key={entry.id}
                                className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-4"
                            >
                                <div className="ap-flex ap-items-start ap-justify-between ap-gap-4">
                                    <div className="ap-flex-1 ap-min-w-0">
                                        <h3 className="ap-font-medium ap-text-gray-800">{entry.subject}</h3>
                                        <div className="ap-flex ap-flex-wrap ap-gap-3 ap-text-xs ap-text-gray-400 ap-mt-1">
                                            <span>Sent by {entry.sentBy}</span>
                                            <span>{formatLocalDateTime(entry.sentAt)}</span>
                                            <span className="ap-text-indigo-500 ap-font-medium">
                                                {entry.recipientCount} recipient{entry.recipientCount !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {entry.recipientSummary.length > 0 && (
                                    <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mt-2">
                                        {entry.recipientSummary.slice(0, 20).map((name, i) => (
                                            <span
                                                key={i}
                                                className="ap-text-xs ap-px-2 ap-py-0.5 ap-bg-gray-50 ap-text-gray-500 ap-rounded-full ap-border ap-border-gray-100"
                                            >
                                                {name}
                                            </span>
                                        ))}
                                        {entry.recipientSummary.length > 20 && (
                                            <span className="ap-text-xs ap-text-gray-400">
                                                +{entry.recipientSummary.length - 20} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default EmailComposer;
