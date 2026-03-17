/**
 * CertificatesPage — Main certificate tracking admin page
 *
 * Three tabs:
 *   1. By Certificate — select a cert type and see all users + their status
 *   2. By User — select a user / browse all, see all their certs
 *   3. Manage Types — CRUD for certificate type definitions, role requirements, permissions
 *
 * Features pending-review badge, status colour coding, inline editing,
 * and approval workflow.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    HiOutlineShieldCheck,
    HiOutlineUsers,
    HiOutlineDocumentCheck,
    HiOutlineCog6Tooth,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineExclamationTriangle,
    HiOutlineLink,
    HiOutlineDocumentArrowUp,
    HiOutlineXMark,
    HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import { Button, Modal, Input, Select, Label } from '../ui';
import BulkCertificateModal from './BulkCertificateModal';
import type {
    CertificateType,
    CertificateTypePayload,
    UserCertificate,
    CertificateStatus,
    CertPermissions,
    RoleRequirement,
    RolePermission,
} from '@/services/certificateService';
import * as certService from '@/services/certificateService';

// ============================================
// HELPERS
// ============================================

const STATUS_CONFIG: Record<CertificateStatus, { label: string; colour: string; bg: string; icon: React.ReactNode }> = {
    valid:          { label: 'Valid',          colour: 'ap-text-green-700',  bg: 'ap-bg-green-100',  icon: <HiOutlineCheckCircle className="ap-w-4 ap-h-4" /> },
    expired:        { label: 'Expired',        colour: 'ap-text-red-700',    bg: 'ap-bg-red-100',    icon: <HiOutlineXCircle className="ap-w-4 ap-h-4" /> },
    expiring_soon:  { label: 'Expiring Soon',  colour: 'ap-text-yellow-700', bg: 'ap-bg-yellow-100', icon: <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" /> },
    pending_review: { label: 'Pending Review', colour: 'ap-text-orange-700', bg: 'ap-bg-orange-100', icon: <HiOutlineDocumentArrowUp className="ap-w-4 ap-h-4" /> },
    missing:        { label: 'Missing',        colour: 'ap-text-gray-500',   bg: 'ap-bg-gray-100',   icon: <HiOutlineXMark className="ap-w-4 ap-h-4" /> },
};

function StatusBadge({ status }: { status: CertificateStatus }) {
    const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.missing;
    return (
        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ${c.bg} ${c.colour}`}>
            {c.icon} {c.label}
        </span>
    );
}

/** Row background colour based on certificate status */
function statusRowBg(status: CertificateStatus): string {
    switch (status) {
        case 'expired':        return 'ap-bg-red-50 hover:ap-bg-red-100';
        case 'expiring_soon':  return 'ap-bg-amber-50 hover:ap-bg-amber-100';
        case 'valid':          return 'ap-bg-green-50 hover:ap-bg-green-100';
        case 'pending_review': return 'ap-bg-orange-50 hover:ap-bg-orange-100';
        case 'missing':        return 'ap-bg-gray-50 hover:ap-bg-gray-100';
        default:               return 'hover:ap-bg-gray-50';
    }
}

/** Compute worst status across a set of certificates (priority: expired > expiring_soon > missing > pending_review > valid) */
function worstStatus(records: { status: CertificateStatus }[]): CertificateStatus {
    const priority: CertificateStatus[] = ['expired', 'expiring_soon', 'missing', 'pending_review', 'valid'];
    for (const s of priority) {
        if (records.some(r => r.status === s)) return s;
    }
    return 'valid';
}

function fmtDate(d: string | null) {
    if (!d) return '—';
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface JobRole { id: number; title: string; tier: number; }

// ============================================
// TYPES TAB — Manage Certificate Types
// ============================================

interface TypesTabProps {
    permissions: CertPermissions;
    roles: JobRole[];
}

function ManageTypesTab({ permissions, roles }: TypesTabProps) {
    const [types, setTypes] = useState<CertificateType[]>([]);
    const [requirements, setRequirements] = useState<RoleRequirement[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);
    const [showPermissions, setShowPermissions] = useState(false);
    const [saving, setSaving] = useState(false);

    // form state
    const [form, setForm] = useState<CertificateTypePayload>({
        name: '', description: '', defaultExpiryMonths: 12, trainingLink: '',
        emailAlertsEnabled: true, isActive: true, sortOrder: 0,
    });
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, r] = await Promise.all([certService.getCertificateTypes(), certService.getRoleRequirements()]);
            setTypes(t);
            setRequirements(r);
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditingId('new');
        setForm({ name: '', description: '', defaultExpiryMonths: 12, trainingLink: '', emailAlertsEnabled: true, isActive: true, sortOrder: 0 });
        setSelectedRoles([]);
    };

    const openEdit = (t: CertificateType) => {
        setEditingId(t.id);
        setForm({
            name: t.name, description: t.description, defaultExpiryMonths: t.defaultExpiryMonths,
            trainingLink: t.trainingLink, emailAlertsEnabled: t.emailAlertsEnabled,
            isActive: t.isActive, sortOrder: t.sortOrder,
        });
        setSelectedRoles(requirements.filter(r => r.certificateTypeId === t.id).map(r => r.jobRoleId));
    };

    const closeForm = () => {
        setEditingId(null);
        setSaving(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (editingId !== 'new' && editingId !== null) {
                await certService.updateCertificateType(editingId, form);
                await certService.saveRoleRequirements(editingId, selectedRoles);
            } else {
                const res = await certService.createCertificateType(form);
                if (res.id && selectedRoles.length > 0) {
                    await certService.saveRoleRequirements(res.id, selectedRoles);
                }
            }
            closeForm();
            load();
        } catch { /* */ } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this certificate type and all associated user records? This cannot be undone.')) return;
        await certService.deleteCertificateType(id);
        load();
    };

    const openPermissions = async () => {
        try {
            const res = await certService.getAllPermissions();
            setRolePermissions(res.roles);
            setShowPermissions(true);
        } catch { /* */ }
    };

    const handlePermToggle = async (roleId: number, field: keyof RolePermission, val: boolean) => {
        setRolePermissions(prev => prev.map(r => r.roleId === roleId ? { ...r, [field]: val } : r));
        await certService.updateRolePermissions(roleId, { [field]: val });
    };

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-10 ap-w-10 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800">Certificate Types</h2>
                <div className="ap-flex ap-gap-2">
                    {permissions.canManageTypes && (
                        <>
                            <Button variant="secondary" size="sm" onClick={openPermissions} leftIcon={<HiOutlineCog6Tooth className="ap-w-4 ap-h-4" />}>
                                Permissions
                            </Button>
                            <Button variant="primary" size="sm" onClick={openCreate} leftIcon={<HiOutlinePlus className="ap-w-4 ap-h-4" />}>
                                New Type
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Types Table */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                <table className="ap-w-full ap-text-sm">
                    <thead className="ap-bg-gray-50">
                        <tr>
                            <th className="ap-text-left ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">Name</th>
                            <th className="ap-text-left ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">Expiry</th>
                            <th className="ap-text-left ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">Roles Linked</th>
                            <th className="ap-text-center ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">Alerts</th>
                            <th className="ap-text-center ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">Active</th>
                            {permissions.canManageTypes && <th className="ap-px-4 ap-py-3"></th>}
                        </tr>
                    </thead>
                    <tbody className="ap-divide-y ap-divide-gray-100">
                        {/* Inline form for "New Type" at top of table */}
                        {editingId === 'new' && (
                            <tr>
                                <td colSpan={permissions.canManageTypes ? 6 : 5} className="ap-p-0 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                    <div className="ap-p-4 ap-border-l-4 ap-border-indigo-500 ap-shadow-inner ap-bg-gray-50">
                                        <div className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-overflow-hidden ap-max-w-3xl ap-mx-auto ap-border ap-border-gray-200">
                                            <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-3 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <h3 className="ap-text-base ap-font-semibold ap-text-gray-900">New Certificate Type</h3>
                                                <button onClick={closeForm} className="ap-p-1 ap-rounded-full ap-text-gray-400 hover:ap-bg-gray-200 hover:ap-text-gray-500">
                                                    <HiOutlineXMark className="ap-w-5 ap-h-5" />
                                                </button>
                                            </div>
                                            <div className="ap-p-6 ap-space-y-4">
                                                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                                                    <div>
                                                        <Label>Name *</Label>
                                                        <Input value={form.name ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lifeguard Certificate" />
                                                    </div>
                                                    <div>
                                                        <Label>Description</Label>
                                                        <Input value={form.description ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                                                    <div>
                                                        <Label>Default Expiry (months)</Label>
                                                        <Input type="number" min={0} value={form.defaultExpiryMonths ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, defaultExpiryMonths: e.target.value === '' ? null : parseInt(e.target.value) }))} placeholder="Leave blank for never" />
                                                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Leave empty for never-expires</p>
                                                    </div>
                                                    <div>
                                                        <Label>Sort Order</Label>
                                                        <Input type="number" value={form.sortOrder ?? 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label>Training Link</Label>
                                                    <Input value={form.trainingLink ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, trainingLink: e.target.value }))} placeholder="https://..." />
                                                </div>
                                                <div className="ap-flex ap-items-center ap-gap-4">
                                                    <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer">
                                                        <input type="checkbox" checked={form.emailAlertsEnabled ?? true} onChange={(e) => setForm(f => ({ ...f, emailAlertsEnabled: e.target.checked }))} className="ap-rounded ap-text-indigo-600" />
                                                        Email alerts when expiring/expired
                                                    </label>
                                                    <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer">
                                                        <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} className="ap-rounded ap-text-indigo-600" />
                                                        Active
                                                    </label>
                                                </div>
                                                <div>
                                                    <Label>Role Requirements</Label>
                                                    <p className="ap-text-xs ap-text-gray-500 ap-mb-2">Select job roles that require this certificate.</p>
                                                    <div className="ap-max-h-40 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded ap-p-2 ap-space-y-1">
                                                        {roles.map(role => (
                                                            <label key={role.id} className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer hover:ap-bg-gray-50 ap-px-1 ap-py-0.5 ap-rounded">
                                                                <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={e => setSelectedRoles(prev => e.target.checked ? [...prev, role.id] : prev.filter(x => x !== role.id))} className="ap-rounded ap-text-indigo-600" />
                                                                <span>{role.title}</span>
                                                                <span className="ap-text-gray-400 ap-text-xs">Tier {role.tier}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-4 ap-border-t ap-border-gray-100">
                                                    <Button variant="secondary" onClick={closeForm} disabled={saving}>Cancel</Button>
                                                    <Button variant="primary" onClick={handleSave} disabled={!form.name?.trim() || saving} loading={saving}>
                                                        {saving ? 'Creating...' : 'Create'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {types.map(t => {
                            const linkedRoles = requirements.filter(r => r.certificateTypeId === t.id);
                            const isEditing = editingId === t.id;
                            return (
                                <React.Fragment key={t.id}>
                                    <tr className={isEditing ? 'ap-bg-indigo-50' : 'hover:ap-bg-gray-50'}>
                                        <td className="ap-px-4 ap-py-3">
                                            <span className="ap-font-medium ap-text-gray-800">{t.name}</span>
                                            {t.description && <p className="ap-text-xs ap-text-gray-500 ap-mt-0.5">{t.description}</p>}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                            {t.defaultExpiryMonths !== null ? `${t.defaultExpiryMonths} months` : 'Never'}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                            {linkedRoles.length > 0 ? (
                                                <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                    {linkedRoles.map(lr => {
                                                        const role = roles.find(r => r.id === lr.jobRoleId);
                                                        return (
                                                            <span key={lr.id} className="ap-bg-indigo-50 ap-text-indigo-700 ap-px-2 ap-py-0.5 ap-rounded-full ap-text-xs">
                                                                {role?.title ?? `Role #${lr.jobRoleId}`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : <span className="ap-text-gray-400">None</span>}
                                        </td>
                                        <td className="ap-text-center ap-px-4 ap-py-3">
                                            {t.emailAlertsEnabled ? (
                                                <span className="ap-text-green-600 ap-text-xs ap-font-medium">On</span>
                                            ) : (
                                                <span className="ap-text-gray-400 ap-text-xs">Off</span>
                                            )}
                                        </td>
                                        <td className="ap-text-center ap-px-4 ap-py-3">
                                            {t.isActive ? (
                                                <span className="ap-text-green-600 ap-text-xs ap-font-medium">Active</span>
                                            ) : (
                                                <span className="ap-text-gray-400 ap-text-xs">Inactive</span>
                                            )}
                                        </td>
                                        {permissions.canManageTypes && (
                                            <td className="ap-px-4 ap-py-3 ap-text-right">
                                                <div className="ap-flex ap-justify-end ap-gap-1">
                                                    <button onClick={() => isEditing ? closeForm() : openEdit(t)} className="ap-p-1.5 ap-rounded hover:ap-bg-gray-100 ap-text-gray-500" title={isEditing ? 'Close' : 'Edit'}>
                                                        {isEditing ? <HiOutlineXMark className="ap-w-4 ap-h-4" /> : <HiOutlinePencil className="ap-w-4 ap-h-4" />}
                                                    </button>
                                                    <button onClick={() => handleDelete(t.id)} className="ap-p-1.5 ap-rounded hover:ap-bg-red-50 ap-text-red-500" title="Delete">
                                                        <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                    {/* Inline edit form — expands below the row, like user edit */}
                                    {isEditing && (
                                        <tr>
                                            <td colSpan={permissions.canManageTypes ? 6 : 5} className="ap-p-0 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <div className="ap-p-4 ap-border-l-4 ap-border-indigo-500 ap-shadow-inner ap-bg-gray-50">
                                                    <div className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-overflow-hidden ap-max-w-3xl ap-mx-auto ap-border ap-border-gray-200">
                                                        <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-3 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                            <h3 className="ap-text-base ap-font-semibold ap-text-gray-900">Edit: {t.name}</h3>
                                                            <button onClick={closeForm} className="ap-p-1 ap-rounded-full ap-text-gray-400 hover:ap-bg-gray-200 hover:ap-text-gray-500">
                                                                <HiOutlineXMark className="ap-w-5 ap-h-5" />
                                                            </button>
                                                        </div>
                                                        <div className="ap-p-6 ap-space-y-4">
                                                            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                                                                <div>
                                                                    <Label>Name *</Label>
                                                                    <Input value={form.name ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lifeguard Certificate" />
                                                                </div>
                                                                <div>
                                                                    <Label>Description</Label>
                                                                    <Input value={form.description ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} />
                                                                </div>
                                                            </div>
                                                            <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                                                                <div>
                                                                    <Label>Default Expiry (months)</Label>
                                                                    <Input type="number" min={0} value={form.defaultExpiryMonths ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, defaultExpiryMonths: e.target.value === '' ? null : parseInt(e.target.value) }))} placeholder="Leave blank for never" />
                                                                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Leave empty for never-expires</p>
                                                                </div>
                                                                <div>
                                                                    <Label>Sort Order</Label>
                                                                    <Input type="number" value={form.sortOrder ?? 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <Label>Training Link</Label>
                                                                <Input value={form.trainingLink ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, trainingLink: e.target.value }))} placeholder="https://..." />
                                                            </div>
                                                            <div className="ap-flex ap-items-center ap-gap-4">
                                                                <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer">
                                                                    <input type="checkbox" checked={form.emailAlertsEnabled ?? true} onChange={(e) => setForm(f => ({ ...f, emailAlertsEnabled: e.target.checked }))} className="ap-rounded ap-text-indigo-600" />
                                                                    Email alerts when expiring/expired
                                                                </label>
                                                                <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer">
                                                                    <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} className="ap-rounded ap-text-indigo-600" />
                                                                    Active
                                                                </label>
                                                            </div>
                                                            <div>
                                                                <Label>Role Requirements</Label>
                                                                <p className="ap-text-xs ap-text-gray-500 ap-mb-2">Select job roles that require this certificate.</p>
                                                                <div className="ap-max-h-40 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded ap-p-2 ap-space-y-1">
                                                                    {roles.map(role => (
                                                                        <label key={role.id} className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer hover:ap-bg-gray-50 ap-px-1 ap-py-0.5 ap-rounded">
                                                                            <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={e => setSelectedRoles(prev => e.target.checked ? [...prev, role.id] : prev.filter(x => x !== role.id))} className="ap-rounded ap-text-indigo-600" />
                                                                            <span>{role.title}</span>
                                                                            <span className="ap-text-gray-400 ap-text-xs">Tier {role.tier}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-4 ap-border-t ap-border-gray-100">
                                                                <Button variant="secondary" onClick={closeForm} disabled={saving}>Cancel</Button>
                                                                <Button variant="primary" onClick={handleSave} disabled={!form.name?.trim() || saving} loading={saving}>
                                                                    {saving ? 'Saving...' : 'Save Changes'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {types.length === 0 && (
                            <tr>
                                <td colSpan={6} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-400">
                                    No certificate types defined yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ---- Permissions Modal ---- */}
            {showPermissions && (
                <Modal isOpen={showPermissions} onClose={() => setShowPermissions(false)} size="lg">
                    <Modal.Header showCloseButton onClose={() => setShowPermissions(false)}>
                        <Modal.Title>Certificate Permissions by Role</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <table className="ap-w-full ap-text-sm">
                            <thead>
                                <tr className="ap-bg-gray-50">
                                    <th className="ap-text-left ap-px-3 ap-py-2">Role</th>
                                    <th className="ap-text-center ap-px-3 ap-py-2 ap-text-xs">View All</th>
                                    <th className="ap-text-center ap-px-3 ap-py-2 ap-text-xs">Edit Records</th>
                                    <th className="ap-text-center ap-px-3 ap-py-2 ap-text-xs">Manage Types</th>
                                    <th className="ap-text-center ap-px-3 ap-py-2 ap-text-xs">Approve</th>
                                    <th className="ap-text-center ap-px-3 ap-py-2 ap-text-xs">Bulk Edit</th>
                                </tr>
                            </thead>
                            <tbody className="ap-divide-y ap-divide-gray-100">
                                {rolePermissions.map(rp => (
                                    <tr key={rp.roleId}>
                                        <td className="ap-px-3 ap-py-2 ap-font-medium">{rp.roleTitle} <span className="ap-text-gray-400 ap-text-xs">(T{rp.roleTier})</span></td>
                                        {(['canViewAll', 'canEditRecords', 'canManageTypes', 'canApproveUploads', 'canBulkEdit'] as const).map(field => (
                                            <td key={field} className="ap-px-3 ap-py-2 ap-text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={rp[field]}
                                                    onChange={e => handlePermToggle(rp.roleId, field, e.target.checked)}
                                                    className="ap-rounded ap-text-indigo-600"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-3">WP Administrators and Tier 5-6 users automatically have full access.</p>
                    <div className="ap-flex ap-justify-end ap-pt-4 ap-border-t ap-border-gray-100 ap-mt-4">
                        <Button variant="secondary" onClick={() => setShowPermissions(false)}>Close</Button>
                    </div>
                    </Modal.Body>
                </Modal>
            )}
        </div>
    );
}

// ============================================
// BY CERTIFICATE TAB
// ============================================

interface ByCertTabProps {
    types: CertificateType[];
    permissions: CertPermissions;
}

type SortField = 'employee' | 'status' | 'trainingDate' | 'expirationDate';
type SortDir = 'asc' | 'desc';
type ArchiveFilter = 'active' | 'archived' | 'all';

function ByCertificateTab({ types, permissions }: ByCertTabProps) {
    const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const [records, setRecords] = useState<UserCertificate[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<CertificateStatus | ''>('');
    const [search, setSearch] = useState('');
    const [editRecord, setEditRecord] = useState<UserCertificate | null>(null);
    const [showBulk, setShowBulk] = useState(false);
    const [uploadingEdit, setUploadingEdit] = useState(false);
    const [sortField, setSortField] = useState<SortField>('employee');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [massApproving, setMassApproving] = useState(false);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const loadRecords = useCallback(async (typeId: number) => {
        setLoading(true);
        try {
            const params: any = { certificate_type_id: typeId };
            if (statusFilter) params.status = statusFilter;
            const data = await certService.getCertificateRecords(params);
            setRecords(data);
        } catch { /* */ }
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        if (selectedTypeId) loadRecords(selectedTypeId);
    }, [selectedTypeId, loadRecords]);

    // Clear checkbox selection when type or status filter changes
    useEffect(() => { setSelectedIds(new Set()); }, [selectedTypeId, statusFilter]);

    const filteredRecords = useMemo(() => {
        let recs = records;
        // Archive filter
        if (archiveFilter === 'active') recs = recs.filter(r => !r.isArchived);
        else if (archiveFilter === 'archived') recs = recs.filter(r => r.isArchived);
        // Search
        if (search) {
            const q = search.toLowerCase();
            recs = recs.filter(r => r.userName.toLowerCase().includes(q) || r.userEmail.toLowerCase().includes(q));
        }
        // Sort
        const dir = sortDir === 'asc' ? 1 : -1;
        recs = [...recs].sort((a, b) => {
            switch (sortField) {
                case 'employee': {
                    const cmp = (a.userLastName || a.userName).toLowerCase().localeCompare((b.userLastName || b.userName).toLowerCase());
                    if (cmp !== 0) return cmp * dir;
                    return (a.userFirstName || '').toLowerCase().localeCompare((b.userFirstName || '').toLowerCase()) * dir;
                }
                case 'status': {
                    const order: Record<string, number> = { expired: 0, expiring_soon: 1, missing: 2, pending_review: 3, valid: 4 };
                    return ((order[a.status] ?? 5) - (order[b.status] ?? 5)) * dir;
                }
                case 'trainingDate': {
                    const aD = a.trainingDate || '';
                    const bD = b.trainingDate || '';
                    return aD.localeCompare(bD) * dir;
                }
                case 'expirationDate': {
                    const aD = a.expirationDate || '';
                    const bD = b.expirationDate || '';
                    return aD.localeCompare(bD) * dir;
                }
                default: return 0;
            }
        });
        return recs;
    }, [records, search, sortField, sortDir, archiveFilter]);

    const pendingCount = records.filter(r => r.status === 'pending_review').length;
    const selectedType = types.find(t => t.id === selectedTypeId);

    const handleApprove = async (id: number) => {
        await certService.approveCertificateRecord(id);
        if (selectedTypeId) loadRecords(selectedTypeId);
    };

    const handleReject = async (id: number) => {
        const reason = prompt('Reason for rejection (optional):');
        await certService.rejectCertificateRecord(id, reason ?? undefined);
        if (selectedTypeId) loadRecords(selectedTypeId);
    };

    const handleMassApprove = async () => {
        if (selectedIds.size === 0) return;
        setMassApproving(true);
        try {
            await Promise.all([...selectedIds].map(id => certService.approveCertificateRecord(id)));
            setSelectedIds(new Set());
            if (selectedTypeId) loadRecords(selectedTypeId);
        } catch { /* */ }
        setMassApproving(false);
    };

    const handleSaveEdit = async () => {
        if (!editRecord) return;
        await certService.updateCertificateRecord(editRecord.id, {
            trainingDate: editRecord.trainingDate,
            expirationDate: editRecord.expirationDate,
            notes: editRecord.notes,
            fileAttachmentId: editRecord.fileAttachmentId,
            fileUrl: editRecord.fileUrl || undefined,
        });
        setEditRecord(null);
        if (selectedTypeId) loadRecords(selectedTypeId);
    };

    const handleEditFileUpload = async (file: File) => {
        if (!editRecord) return;
        setUploadingEdit(true);
        try {
            const uploaded = await certService.uploadCertificateFile(file);
            setEditRecord(r => r ? {
                ...r,
                fileAttachmentId: parseInt(uploaded.id, 10),
                fileUrl: uploaded.url,
            } : null);
        } catch (err) {
            console.error('File upload failed', err);
        }
        setUploadingEdit(false);
    };

    return (
        <div className="ap-space-y-4">
            {/* Filters Row */}
            <div className="ap-flex ap-flex-wrap ap-items-end ap-gap-4">
                <div className="ap-flex-1 ap-min-w-[200px]">
                    <Label>Certificate Type</Label>
                    <Select
                        value={selectedTypeId ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTypeId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">— Select certificate type —</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                </div>
                <div className="ap-w-40">
                    <Label>Status</Label>
                    <Select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as CertificateStatus | '')}>
                        <option value="">All</option>
                        <option value="valid">Valid</option>
                        <option value="expired">Expired</option>
                        <option value="expiring_soon">Expiring Soon</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="missing">Missing</option>
                    </Select>
                </div>
                <div className="ap-w-36">
                    <Label>Users</Label>
                    <Select value={archiveFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setArchiveFilter(e.target.value as ArchiveFilter)}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="all">All Users</option>
                    </Select>
                </div>
                <div className="ap-w-56">
                    <Label>Search</Label>
                    <div className="ap-relative">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Search by name..." className="!ap-pl-8" />
                    </div>
                </div>
                {permissions.canBulkEdit && selectedType && (
                    <Button variant="secondary" size="sm" onClick={() => setShowBulk(true)} leftIcon={<HiOutlineUsers className="ap-w-4 ap-h-4" />}>
                        Bulk Assign / Update
                    </Button>
                )}
            </div>

            {/* Pending Banner */}
            {pendingCount > 0 && permissions.canApproveUploads && (
                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-3 ap-bg-orange-50 ap-border ap-border-orange-300 ap-rounded-lg ap-px-4 ap-py-2.5 ap-text-sm ap-text-orange-800">
                    <HiOutlineDocumentArrowUp className="ap-w-5 ap-h-5 ap-text-orange-500 ap-shrink-0" />
                    <span className="ap-font-semibold">{pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}</span>
                    <button
                        onClick={() => setStatusFilter('pending_review')}
                        className="ap-underline hover:ap-text-orange-900"
                    >Show only pending</button>
                    <button
                        onClick={() => setSelectedIds(new Set(filteredRecords.filter(r => r.status === 'pending_review').map(r => r.id)))}
                        className="ap-ml-auto ap-text-xs ap-font-medium ap-bg-orange-100 hover:ap-bg-orange-200 ap-px-2.5 ap-py-1 ap-rounded ap-transition-colors"
                    >
                        Select All Visible Pending
                    </button>
                </div>
            )}

            {/* Mass-approve action bar */}
            {selectedIds.size > 0 && permissions.canApproveUploads && (
                <div className="ap-flex ap-items-center ap-gap-3 ap-bg-indigo-50 ap-border ap-border-indigo-200 ap-rounded-lg ap-px-4 ap-py-2">
                    <span className="ap-font-medium ap-text-indigo-800 ap-text-sm">{selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''} selected</span>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleMassApprove}
                        loading={massApproving}
                        leftIcon={<HiOutlineCheckCircle className="ap-w-4 ap-h-4" />}
                    >
                        Approve {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}
                    </Button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="ap-text-xs ap-text-indigo-600 hover:ap-text-indigo-900 ap-underline"
                    >Clear selection</button>
                </div>
            )}

            {/* Records Table */}
            {selectedTypeId ? (
                loading ? (
                    <div className="ap-flex ap-justify-center ap-py-8">
                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
                    </div>
                ) : (
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                        <table className="ap-w-full ap-text-sm">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    {permissions.canApproveUploads && (
                                        <th className="ap-px-4 ap-py-3 ap-w-8">
                                            <input
                                                type="checkbox"
                                                title="Select / deselect all visible pending"
                                                checked={
                                                    filteredRecords.filter(r => r.status === 'pending_review').length > 0 &&
                                                    filteredRecords.filter(r => r.status === 'pending_review').every(r => selectedIds.has(r.id))
                                                }
                                                onChange={e => {
                                                    const pendingIds = filteredRecords.filter(r => r.status === 'pending_review').map(r => r.id);
                                                    if (e.target.checked) {
                                                        setSelectedIds(prev => new Set([...prev, ...pendingIds]));
                                                    } else {
                                                        setSelectedIds(prev => { const next = new Set(prev); pendingIds.forEach(id => next.delete(id)); return next; });
                                                    }
                                                }}
                                                className="ap-rounded ap-text-indigo-600"
                                            />
                                        </th>
                                    )}
                                    {([['employee', 'Employee'], ['status', 'Status'], ['trainingDate', 'Training Date'], ['expirationDate', 'Expiry Date']] as [SortField, string][]).map(([field, label]) => (
                                        <th
                                            key={field}
                                            onClick={() => toggleSort(field)}
                                            className="ap-text-left ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600 ap-cursor-pointer ap-select-none hover:ap-text-gray-900 ap-transition-colors"
                                        >
                                            <span className="ap-inline-flex ap-items-center ap-gap-1">
                                                {label}
                                                {sortField === field ? (
                                                    <span className="ap-text-indigo-600">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                                                ) : (
                                                    <span className="ap-text-gray-300">\u25B4</span>
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                    <th className="ap-text-left ap-px-4 ap-py-3 ap-font-medium ap-text-gray-600">File</th>
                                    <th className="ap-px-4 ap-py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="ap-divide-y ap-divide-gray-100">
                                {filteredRecords.map(rec => (
                                    <tr key={rec.id} className={`${statusRowBg(rec.status)} ${rec.isArchived ? 'ap-opacity-50' : ''}`}>
                                        {permissions.canApproveUploads && (
                                            <td className="ap-px-4 ap-py-3 ap-w-8">
                                                {rec.status === 'pending_review' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(rec.id)}
                                                        onChange={e => setSelectedIds(prev => {
                                                            const next = new Set(prev);
                                                            if (e.target.checked) next.add(rec.id); else next.delete(rec.id);
                                                            return next;
                                                        })}
                                                        onClick={e => e.stopPropagation()}
                                                        className="ap-rounded ap-text-indigo-600"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        <td className="ap-px-4 ap-py-3">
                                            <span className="ap-font-medium">{rec.userName}</span>
                                            {rec.isArchived && <span className="ap-text-xs ap-text-red-500 ap-ml-1">(archived)</span>}
                                            <p className="ap-text-xs ap-text-gray-500">{rec.userEmail}</p>
                                        </td>
                                        <td className="ap-px-4 ap-py-3"><StatusBadge status={rec.status} /></td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">{fmtDate(rec.trainingDate)}</td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-600">{fmtDate(rec.expirationDate)}</td>
                                        <td className="ap-px-4 ap-py-3">
                                            {rec.fileUrl ? (
                                                <a href={rec.fileUrl} target="_blank" rel="noreferrer" className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                    <HiOutlineLink className="ap-w-3.5 ap-h-3.5" /> View
                                                </a>
                                            ) : <span className="ap-text-gray-400 ap-text-xs">—</span>}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-right">
                                            <div className="ap-flex ap-justify-end ap-gap-1">
                                                {rec.status === 'pending_review' && permissions.canApproveUploads && (
                                                    <>
                                                        <button onClick={() => handleApprove(rec.id)} className="ap-p-1.5 ap-rounded hover:ap-bg-green-50 ap-text-green-600" title="Approve">
                                                            <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                                        </button>
                                                        <button onClick={() => handleReject(rec.id)} className="ap-p-1.5 ap-rounded hover:ap-bg-red-50 ap-text-red-500" title="Reject">
                                                            <HiOutlineXCircle className="ap-w-4 ap-h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {permissions.canEditRecords && (
                                                    <button onClick={() => setEditRecord({ ...rec })} className="ap-p-1.5 ap-rounded hover:ap-bg-gray-100 ap-text-gray-500" title="Edit">
                                                        <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRecords.length === 0 && (
                                    <tr><td colSpan={permissions.canApproveUploads ? 7 : 6} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-400">
                                        {records.length === 0 ? 'No records for this certificate type.' : 'No records match your filters.'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                <div className="ap-text-center ap-py-12 ap-text-gray-400">
                    <HiOutlineDocumentCheck className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-3 ap-opacity-40" />
                    <p>Select a certificate type to view records</p>
                </div>
            )}

            {/* Edit Record Modal */}
            {editRecord && (
                <Modal isOpen={!!editRecord} onClose={() => setEditRecord(null)}>
                    <Modal.Header showCloseButton onClose={() => setEditRecord(null)}>
                        <Modal.Title>Edit — {editRecord.userName}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="ap-space-y-4">
                        <div>
                            <Label>Training Date</Label>
                            <Input type="date" value={editRecord.trainingDate ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, trainingDate: e.target.value || null } : null)} />
                        </div>
                        <div>
                            <Label>Expiration Date</Label>
                            <Input type="date" value={editRecord.expirationDate ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, expirationDate: e.target.value || null } : null)} />
                            <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Leave blank for never-expires</p>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Input value={editRecord.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, notes: e.target.value } : null)} />
                        </div>
                        {/* File Upload */}
                        <div>
                            <Label>Certificate File</Label>
                            {editRecord.fileUrl && (
                                <div className="ap-mb-2">
                                    <a href={editRecord.fileUrl} target="_blank" rel="noreferrer"
                                       className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                        <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" /> View current file
                                    </a>
                                </div>
                            )}
                            <label className="ap-flex ap-items-center ap-justify-center ap-w-full ap-h-20 ap-border-2 ap-border-dashed ap-border-gray-300 ap-rounded-lg ap-cursor-pointer hover:ap-border-indigo-400 hover:ap-bg-indigo-50/30 ap-transition-colors">
                                <div className="ap-flex ap-flex-col ap-items-center ap-text-gray-500 ap-text-sm">
                                    <HiOutlineDocumentArrowUp className="ap-w-5 ap-h-5 ap-mb-1" />
                                    {uploadingEdit ? 'Uploading...' : 'Click to upload or replace file'}
                                </div>
                                <input
                                    type="file"
                                    className="ap-hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    disabled={uploadingEdit}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleEditFileUpload(f);
                                    }}
                                />
                            </label>
                        </div>
                        <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-4 ap-border-t ap-border-gray-100">
                            <Button variant="secondary" onClick={() => setEditRecord(null)}>Cancel</Button>
                            <Button variant="primary" onClick={handleSaveEdit} disabled={uploadingEdit}>Save</Button>
                        </div>
                        </div>
                    </Modal.Body>
                </Modal>
            )}

            {/* Bulk Modal */}
            {showBulk && selectedType && (
                <BulkCertificateModal
                    certType={selectedType}
                    onClose={() => setShowBulk(false)}
                    onComplete={() => { setShowBulk(false); if (selectedTypeId) loadRecords(selectedTypeId); }}
                />
            )}
        </div>
    );
}

// ============================================
// BY USER TAB
// ============================================

interface ByUserTabProps {
    permissions: CertPermissions;
}

function ByUserTab({ permissions }: ByUserTabProps) {
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [allRecords, setAllRecords] = useState<UserCertificate[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [editRecord, setEditRecord] = useState<UserCertificate | null>(null);
    const [uploadingEdit, setUploadingEdit] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [pendingOnlyUsers, setPendingOnlyUsers] = useState(false);
    const [approvingAllPending, setApprovingAllPending] = useState(false);

    // Load all records to group by user
    const loadAllRecords = useCallback(async () => {
        setLoading(true);
        try {
            const data = await certService.getCertificateRecords();
            setAllRecords(data);
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { loadAllRecords(); }, [loadAllRecords]);

    // Group by user
    const usersMap = useMemo(() => {
        const map = new Map<number, { name: string; firstName: string; lastName: string; email: string; isArchived: boolean; records: UserCertificate[] }>();
        allRecords.forEach(r => {
            if (!map.has(r.userId)) {
                map.set(r.userId, { name: r.userName, firstName: r.userFirstName || '', lastName: r.userLastName || '', email: r.userEmail, isArchived: r.isArchived, records: [] });
            }
            map.get(r.userId)!.records.push(r);
        });
        return map;
    }, [allRecords]);

    const filteredUsers = useMemo(() => {
        let entries = Array.from(usersMap.entries());
        // Sort by last name, then first name
        entries.sort(([, a], [, b]) => {
            const cmp = (a.lastName || a.name).toLowerCase().localeCompare((b.lastName || b.name).toLowerCase());
            if (cmp !== 0) return cmp;
            return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase());
        });
        // Pending-only filter
        if (pendingOnlyUsers) {
            entries = entries.filter(([, u]) => u.records.some(r => r.status === 'pending_review'));
        }
        if (!userSearch) return entries;
        const q = userSearch.toLowerCase();
        return entries.filter(([_, u]) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }, [usersMap, userSearch, pendingOnlyUsers]);

    const selectedUserRecords = useMemo(() => {
        if (!selectedUserId) return [];
        return usersMap.get(selectedUserId)?.records ?? [];
    }, [selectedUserId, usersMap]);

    // Approve / Reject handlers
    const handleApprove = async (id: number) => {
        await certService.approveCertificateRecord(id);
        loadAllRecords();
    };

    const handleReject = async (id: number) => {
        const reason = prompt('Reason for rejection (optional):');
        await certService.rejectCertificateRecord(id, reason ?? undefined);
        loadAllRecords();
    };

    const handleApproveAllPending = async () => {
        const pending = selectedUserRecords.filter(r => r.status === 'pending_review');
        if (pending.length === 0) return;
        setApprovingAllPending(true);
        try {
            await Promise.all(pending.map(r => certService.approveCertificateRecord(r.id)));
            loadAllRecords();
        } catch { /* */ }
        setApprovingAllPending(false);
    };

    // Edit handlers
    const handleSaveEdit = async () => {
        if (!editRecord) return;
        setSavingEdit(true);
        try {
            await certService.updateCertificateRecord(editRecord.id, {
                trainingDate: editRecord.trainingDate,
                expirationDate: editRecord.expirationDate,
                notes: editRecord.notes,
                fileAttachmentId: editRecord.fileAttachmentId,
                fileUrl: editRecord.fileUrl || undefined,
            });
            setEditRecord(null);
            loadAllRecords();
        } catch { /* */ }
        setSavingEdit(false);
    };

    const handleEditFileUpload = async (file: File) => {
        if (!editRecord) return;
        setUploadingEdit(true);
        try {
            const uploaded = await certService.uploadCertificateFile(file);
            setEditRecord(r => r ? {
                ...r,
                fileAttachmentId: parseInt(uploaded.id, 10),
                fileUrl: uploaded.url,
            } : null);
        } catch (err) {
            console.error('File upload failed', err);
        }
        setUploadingEdit(false);
    };

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-10 ap-w-10 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-3 ap-gap-6">
            {/* User List */}
            <div className="ap-col-span-1">
                <div className="ap-mb-3 ap-space-y-2">
                    <div className="ap-relative">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                        <Input value={userSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserSearch(e.target.value)} placeholder="Search employees..." className="!ap-pl-8" />
                    </div>
                    {permissions.canApproveUploads && (
                        <button
                            onClick={() => setPendingOnlyUsers(v => !v)}
                            className={`ap-w-full ap-flex ap-items-center ap-justify-center ap-gap-1.5 ap-py-1.5 ap-rounded ap-text-xs ap-font-medium ap-transition-colors ap-border ${
                                pendingOnlyUsers
                                    ? 'ap-bg-orange-100 ap-text-orange-800 ap-border-orange-300'
                                    : 'ap-bg-white ap-text-gray-600 ap-border-gray-200 hover:ap-bg-orange-50 hover:ap-text-orange-700'
                            }`}
                        >
                            <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" />
                            {pendingOnlyUsers ? 'Showing Pending Only' : 'Show Pending Only'}
                        </button>
                    )}
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-max-h-[500px] ap-overflow-y-auto">
                    {filteredUsers.map(([userId, user]) => {
                        const worst = worstStatus(user.records);
                        const hasPending = user.records.some(r => r.status === 'pending_review');
                        const isSelected = selectedUserId === userId;
                        // Row background: selected overrides, then pending-review gets orange, then worst-status colour
                        const rowBg = isSelected
                            ? 'ap-border-l-2 ap-border-l-indigo-500 ap-bg-indigo-50'
                            : hasPending
                                ? 'ap-bg-orange-50 hover:ap-bg-orange-100'
                                : statusRowBg(worst);
                        return (
                            <button
                                key={userId}
                                onClick={() => { setSelectedUserId(userId); setEditRecord(null); }}
                                className={`ap-w-full ap-text-left ap-px-4 ap-py-3 ap-border-b ap-border-gray-100 ap-flex ap-items-center ap-justify-between ap-transition-colors ${rowBg} ${user.isArchived ? 'ap-opacity-50' : ''}`}
                            >
                                <div>
                                    <span className="ap-font-medium ap-text-sm">{user.name}</span>
                                    <p className="ap-text-xs ap-text-gray-500">{user.records.length} cert(s)</p>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-1.5">
                                    {hasPending && !isSelected && (
                                        <span className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-orange-100 ap-text-orange-700">
                                            <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" /> Pending
                                        </span>
                                    )}
                                    {!hasPending && <StatusBadge status={worst} />}
                                </div>
                            </button>
                        );
                    })}
                    {filteredUsers.length === 0 && (
                        <p className="ap-text-center ap-py-6 ap-text-gray-400 ap-text-sm">No users found</p>
                    )}
                </div>
            </div>

            {/* User's Certificates */}
            <div className="ap-col-span-1 lg:ap-col-span-2">
                {selectedUserId && selectedUserRecords.length > 0 ? (
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                        <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-b ap-border-gray-200">
                            <div className="ap-flex ap-items-start ap-justify-between ap-gap-2">
                                <div>
                                    <h3 className="ap-font-semibold ap-text-gray-800">{usersMap.get(selectedUserId)?.name}</h3>
                                    <p className="ap-text-xs ap-text-gray-500">{usersMap.get(selectedUserId)?.email}</p>
                                </div>
                                {permissions.canApproveUploads && selectedUserRecords.some(r => r.status === 'pending_review') && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleApproveAllPending}
                                        loading={approvingAllPending}
                                        leftIcon={<HiOutlineCheckCircle className="ap-w-3.5 ap-h-3.5" />}
                                    >
                                        Approve All Pending
                                    </Button>
                                )}
                            </div>
                        </div>
                        <table className="ap-w-full ap-text-sm">
                            <thead className="ap-bg-gray-50">
                                <tr>
                                    <th className="ap-text-left ap-px-4 ap-py-2 ap-font-medium ap-text-gray-600">Certificate</th>
                                    <th className="ap-text-left ap-px-4 ap-py-2 ap-font-medium ap-text-gray-600">Status</th>
                                    <th className="ap-text-left ap-px-4 ap-py-2 ap-font-medium ap-text-gray-600">Training</th>
                                    <th className="ap-text-left ap-px-4 ap-py-2 ap-font-medium ap-text-gray-600">Expires</th>
                                    <th className="ap-text-left ap-px-4 ap-py-2 ap-font-medium ap-text-gray-600">File</th>
                                    <th className="ap-px-4 ap-py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="ap-divide-y ap-divide-gray-100">
                                {selectedUserRecords.map(rec => {
                                    const isEditing = editRecord?.id === rec.id;
                                    return (
                                        <React.Fragment key={rec.id}>
                                            <tr className={statusRowBg(rec.status)}>
                                                <td className="ap-px-4 ap-py-3 ap-font-medium">{rec.certificateName}</td>
                                                <td className="ap-px-4 ap-py-3"><StatusBadge status={rec.status} /></td>
                                                <td className="ap-px-4 ap-py-3 ap-text-gray-600">{fmtDate(rec.trainingDate)}</td>
                                                <td className="ap-px-4 ap-py-3 ap-text-gray-600">{fmtDate(rec.expirationDate)}</td>
                                                <td className="ap-px-4 ap-py-3">
                                                    {rec.fileUrl ? (
                                                        <a href={rec.fileUrl} target="_blank" rel="noreferrer" className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                            <HiOutlineLink className="ap-w-3.5 ap-h-3.5" /> View
                                                        </a>
                                                    ) : <span className="ap-text-gray-400 ap-text-xs">—</span>}
                                                </td>
                                                <td className="ap-px-4 ap-py-3 ap-text-right">
                                                    <div className="ap-flex ap-justify-end ap-gap-1">
                                                        {rec.status === 'pending_review' && permissions.canApproveUploads && (
                                                            <>
                                                                <button onClick={() => handleApprove(rec.id)} className="ap-p-1.5 ap-rounded hover:ap-bg-green-50 ap-text-green-600" title="Approve">
                                                                    <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                                                </button>
                                                                <button onClick={() => handleReject(rec.id)} className="ap-p-1.5 ap-rounded hover:ap-bg-red-50 ap-text-red-500" title="Reject">
                                                                    <HiOutlineXCircle className="ap-w-4 ap-h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        {permissions.canEditRecords && (
                                                            <button
                                                                onClick={() => isEditing ? setEditRecord(null) : setEditRecord({ ...rec })}
                                                                className="ap-p-1.5 ap-rounded hover:ap-bg-gray-100 ap-text-gray-500"
                                                                title={isEditing ? 'Close' : 'Edit'}
                                                            >
                                                                {isEditing ? <HiOutlineXMark className="ap-w-4 ap-h-4" /> : <HiOutlinePencil className="ap-w-4 ap-h-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Inline edit form */}
                                            {isEditing && editRecord && (
                                                <tr>
                                                    <td colSpan={6} className="ap-p-0 ap-border-b ap-border-gray-200">
                                                        <div className="ap-p-4 ap-border-l-4 ap-border-indigo-500 ap-bg-gray-50">
                                                            <div className="ap-bg-white ap-rounded-xl ap-shadow ap-overflow-hidden ap-max-w-2xl ap-mx-auto ap-border ap-border-gray-200">
                                                                <div className="ap-flex ap-items-center ap-justify-between ap-px-5 ap-py-2.5 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                                    <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900">
                                                                        Edit: {rec.certificateName}
                                                                    </h4>
                                                                    <button onClick={() => setEditRecord(null)} className="ap-p-1 ap-rounded-full ap-text-gray-400 hover:ap-bg-gray-200 hover:ap-text-gray-500">
                                                                        <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="ap-p-5 ap-space-y-3">
                                                                    <div className="ap-grid ap-grid-cols-2 ap-gap-3">
                                                                        <div>
                                                                            <Label>Training Date</Label>
                                                                            <Input
                                                                                type="date"
                                                                                value={editRecord.trainingDate ?? ''}
                                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, trainingDate: e.target.value || null } : null)}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <Label>Expiration Date</Label>
                                                                            <Input
                                                                                type="date"
                                                                                value={editRecord.expirationDate ?? ''}
                                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, expirationDate: e.target.value || null } : null)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <Label>Notes</Label>
                                                                        <Input
                                                                            value={editRecord.notes ?? ''}
                                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRecord(r => r ? { ...r, notes: e.target.value } : null)}
                                                                            placeholder="Optional notes..."
                                                                        />
                                                                    </div>
                                                                    {/* File Upload */}
                                                                    <div>
                                                                        <Label>Certificate File</Label>
                                                                        {editRecord.fileUrl && (
                                                                            <div className="ap-mb-2">
                                                                                <a href={editRecord.fileUrl} target="_blank" rel="noreferrer"
                                                                                   className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                                                    <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" /> View current file
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                        <label className="ap-flex ap-items-center ap-justify-center ap-w-full ap-h-16 ap-border-2 ap-border-dashed ap-border-gray-300 ap-rounded-lg ap-cursor-pointer hover:ap-border-indigo-400 hover:ap-bg-indigo-50/30 ap-transition-colors">
                                                                            <div className="ap-flex ap-flex-col ap-items-center ap-text-gray-500 ap-text-xs">
                                                                                <HiOutlineDocumentArrowUp className="ap-w-4 ap-h-4 ap-mb-1" />
                                                                                {uploadingEdit ? 'Uploading...' : 'Click to upload or replace file'}
                                                                            </div>
                                                                            <input
                                                                                type="file"
                                                                                className="ap-hidden"
                                                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                                                disabled={uploadingEdit}
                                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                                    const f = e.target.files?.[0];
                                                                                    if (f) handleEditFileUpload(f);
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                    <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-3 ap-border-t ap-border-gray-100">
                                                                        <Button variant="secondary" size="sm" onClick={() => setEditRecord(null)} disabled={savingEdit}>Cancel</Button>
                                                                        <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={uploadingEdit || savingEdit} loading={savingEdit}>
                                                                            {savingEdit ? 'Saving...' : 'Save'}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="ap-text-center ap-py-12 ap-text-gray-400">
                        <HiOutlineUsers className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-3 ap-opacity-40" />
                        <p>Select an employee to view their certificates</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// MAIN PAGE
// ============================================

type CertTab = 'by-certificate' | 'by-user' | 'manage-types';

interface CertificatesPageProps {
    currentUser: any;
    adminMode?: boolean;
}

const CertificatesPage: React.FC<CertificatesPageProps> = ({ adminMode = false }) => {
    const [activeTab, setActiveTab] = useState<CertTab>('by-certificate');
    const [permissions, setPermissions] = useState<CertPermissions>({
        canViewAll: false, canEditRecords: false, canManageTypes: false,
        canApproveUploads: false, canBulkEdit: false,
    });
    const [types, setTypes] = useState<CertificateType[]>([]);
    const [roles, setRoles] = useState<JobRole[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [rawPerms, rawTypes] = await Promise.all([
                    certService.getMyPermissions(),
                    certService.getCertificateTypes(),
                ]);
                // Guard against null/unexpected API responses to prevent render-time crashes
                const perms: CertPermissions = (rawPerms && typeof rawPerms === 'object' && 'canViewAll' in rawPerms)
                    ? rawPerms
                    : { canViewAll: false, canEditRecords: false, canManageTypes: false, canApproveUploads: false, canBulkEdit: false };
                const certTypes = Array.isArray(rawTypes) ? rawTypes : [];
                setPermissions(perms);
                setTypes(certTypes);

                // Load pending count if can approve
                if (perms.canApproveUploads) {
                    const pc = await certService.getPendingCount();
                    setPendingCount(pc.count ?? 0);
                }

                // Load roles for manage tab (from professional growth endpoint)
                try {
                    const wpData = (window as any).mentorshipPlatformData;
                    const rolesRes = await fetch(`${wpData.api_url}/pg/job-roles`, {
                        headers: { 'X-WP-Nonce': wpData.nonce },
                    });
                    if (rolesRes.ok) {
                        const rolesData = await rolesRes.json();
                        setRoles(Array.isArray(rolesData) ? rolesData : rolesData.roles ?? []);
                    }
                } catch { /* roles not critical */ }
            } catch (err) {
                console.error('Failed to initialize certificates:', err);
            }
            setLoading(false);
        })();
    }, []);

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-20">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    // Determine which tabs to show based on permissions
    const tabs: { key: CertTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [];

    if (permissions.canViewAll) {
        tabs.push({ key: 'by-certificate', label: 'By Certificate', icon: HiOutlineDocumentCheck });
        tabs.push({ key: 'by-user', label: 'By User', icon: HiOutlineUsers, badge: pendingCount > 0 ? pendingCount : undefined });
    }
    if (permissions.canManageTypes) {
        tabs.push({ key: 'manage-types', label: 'Manage Types', icon: HiOutlineCog6Tooth });
    }

    // If not in admin mode, or user has no admin permissions, show personal certificates
    if (!adminMode || tabs.length === 0) {
        return <MyCertificatesView />;
    }

    // If activeTab is not among the visible tabs, snap to the first valid one.
    // Calling setActiveTab directly during render (not in a hook) is a supported
    // React pattern for adjusting state based on changed props/derived values.
    if (tabs.length > 0 && !tabs.some(t => t.key === activeTab)) {
        setActiveTab(tabs[0].key);
        return null; // React will re-render immediately with the corrected tab
    }

    return (
        <div className="ap-p-6 ap-max-w-7xl ap-mx-auto">
            {/* Header */}
            <div className="ap-mb-6">
                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-800 ap-flex ap-items-center ap-gap-2">
                    <HiOutlineShieldCheck className="ap-w-7 ap-h-7 ap-text-indigo-600" />
                    Certificate Tracking
                </h1>
                <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                    Manage and track employee certifications, training records, and compliance
                </p>
            </div>

            {/* Tabs */}
            <div className="ap-flex ap-gap-2 ap-mb-6">
                {tabs.map(tab => (
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
                        {tab.badge && tab.badge > 0 && (
                            <span className="ap-bg-red-500 ap-text-white ap-text-xs ap-font-bold ap-rounded-full ap-px-1.5 ap-py-0.5 ap-min-w-[20px] ap-text-center">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'by-certificate' && permissions.canViewAll && (
                <ByCertificateTab types={types} permissions={permissions} />
            )}
            {activeTab === 'by-user' && permissions.canViewAll && (
                <ByUserTab permissions={permissions} />
            )}
            {activeTab === 'manage-types' && permissions.canManageTypes && (
                <ManageTypesTab permissions={permissions} roles={roles} />
            )}
        </div>
    );
};

// ============================================
// MY CERTIFICATES (self-service frontline view)
// ============================================

function MyCertificatesView() {
    const [certs, setCerts] = useState<UserCertificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCertId, setEditingCertId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{
        trainingDate: string; expirationDate: string; notes: string;
    }>({ trainingDate: '', expirationDate: '', notes: '' });
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const data = await certService.getMyCertificates();
            setCerts(data);
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const startEdit = (cert: UserCertificate) => {
        setEditingCertId(cert.id);
        setEditForm({
            trainingDate: cert.trainingDate ?? '',
            expirationDate: cert.expirationDate ?? '',
            notes: cert.notes ?? '',
        });
    };

    const handleFileUpload = async (certId: number, file: File) => {
        setUploading(true);
        try {
            const uploaded = await certService.uploadCertificateFile(file);
            await certService.updateMyCertificate(certId, {
                fileAttachmentId: parseInt(uploaded.id, 10),
                fileUrl: uploaded.url,
            });
            await load();
        } catch (err) {
            console.error('File upload failed', err);
        }
        setUploading(false);
    };

    const handleSave = async () => {
        if (!editingCertId) return;
        setSaving(true);
        try {
            await certService.updateMyCertificate(editingCertId, {
                trainingDate: editForm.trainingDate || null,
                expirationDate: editForm.expirationDate || null,
                notes: editForm.notes,
            });
            setEditingCertId(null);
            await load();
        } catch (err) {
            console.error('Save failed', err);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-10 ap-w-10 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="ap-p-6 ap-max-w-4xl ap-mx-auto">
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-800 ap-mb-6 ap-flex ap-items-center ap-gap-2">
                <HiOutlineShieldCheck className="ap-w-7 ap-h-7 ap-text-indigo-600" />
                My Certificates
            </h1>

            {certs.length === 0 ? (
                <div className="ap-text-center ap-py-12 ap-text-gray-400">
                    <HiOutlineDocumentCheck className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-3 ap-opacity-40" />
                    <p>No certificates assigned to you yet.</p>
                </div>
            ) : (
                <div className="ap-space-y-4">
                    {certs.map(cert => {
                        const isEditing = editingCertId === cert.id;
                        return (
                            <div key={cert.id} className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                                <div className="ap-flex ap-items-center ap-justify-between ap-mb-2">
                                    <h3 className="ap-font-semibold ap-text-gray-800">{cert.certificateName}</h3>
                                    <div className="ap-flex ap-items-center ap-gap-2">
                                        <StatusBadge status={cert.status} />
                                        {!isEditing && (
                                            <button
                                                onClick={() => startEdit(cert)}
                                                className="ap-p-1 ap-rounded hover:ap-bg-gray-100 ap-text-gray-400"
                                                title="Edit / Upload"
                                            >
                                                <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {!isEditing && (
                                    <>
                                        <div className="ap-grid ap-grid-cols-2 ap-gap-3 ap-text-sm ap-text-gray-600">
                                            <div>
                                                <span className="ap-font-medium">Training Date:</span> {fmtDate(cert.trainingDate)}
                                            </div>
                                            <div>
                                                <span className="ap-font-medium">Expires:</span> {fmtDate(cert.expirationDate)}
                                            </div>
                                        </div>
                                        <div className="ap-mt-3 ap-flex ap-items-center ap-gap-3">
                                            {cert.trainingLink && (
                                                <a href={cert.trainingLink} target="_blank" rel="noreferrer"
                                                   className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                    <HiOutlineLink className="ap-w-3.5 ap-h-3.5" /> Training Link
                                                </a>
                                            )}
                                            {cert.fileUrl && (
                                                <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                                                   className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                    <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" /> View Upload
                                                </a>
                                            )}
                                        </div>
                                        {cert.notes && (
                                            <p className="ap-text-xs ap-text-gray-500 ap-mt-2 ap-italic">{cert.notes}</p>
                                        )}
                                    </>
                                )}

                                {/* Inline Edit & Upload */}
                                {isEditing && (
                                    <div className="ap-mt-3 ap-space-y-3 ap-bg-gray-50 ap-rounded-lg ap-p-4">
                                        <div className="ap-grid ap-grid-cols-2 ap-gap-3">
                                            <div>
                                                <Label className="!ap-text-xs">Training Date</Label>
                                                <Input
                                                    type="date"
                                                    value={editForm.trainingDate}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(f => ({ ...f, trainingDate: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <Label className="!ap-text-xs">Expiration Date</Label>
                                                <Input
                                                    type="date"
                                                    value={editForm.expirationDate}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(f => ({ ...f, expirationDate: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="!ap-text-xs">Notes</Label>
                                            <Input
                                                value={editForm.notes}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Optional notes..."
                                            />
                                        </div>

                                        {/* File Upload */}
                                        <div>
                                            <Label className="!ap-text-xs">Upload Certificate File</Label>
                                            {cert.fileUrl && (
                                                <div className="ap-mb-2">
                                                    <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                                                       className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                        <HiOutlineDocumentArrowUp className="ap-w-3.5 ap-h-3.5" /> Current file
                                                    </a>
                                                </div>
                                            )}
                                            <label className="ap-flex ap-items-center ap-justify-center ap-w-full ap-h-20 ap-border-2 ap-border-dashed ap-border-gray-300 ap-rounded-lg ap-cursor-pointer hover:ap-border-indigo-400 hover:ap-bg-indigo-50/30 ap-transition-colors">
                                                <div className="ap-flex ap-flex-col ap-items-center ap-text-gray-500 ap-text-xs">
                                                    <HiOutlineDocumentArrowUp className="ap-w-5 ap-h-5 ap-mb-1" />
                                                    {uploading ? 'Uploading...' : 'Click to upload or replace file'}
                                                </div>
                                                <input
                                                    type="file"
                                                    className="ap-hidden"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    disabled={uploading}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleFileUpload(cert.id, f);
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-1">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingCertId(null)}>Cancel</Button>
                                            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                                                Save Changes
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default CertificatesPage;