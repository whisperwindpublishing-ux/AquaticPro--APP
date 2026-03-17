/**
 * UserCertificateSection — Embeddable section for the Edit User form
 *
 * Shows all certificates assigned to a user with inline status badges,
 * training/expiry dates, and inline editing for admins. Can be embedded
 * into any user profile/edit form.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    HiOutlineShieldCheck,
    HiOutlinePencil,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineLink,
    HiOutlineDocumentArrowUp,
    HiOutlineCheck,
} from 'react-icons/hi2';
import { Input, Label } from '../ui';
import type { UserCertificate, CertificateStatus } from '@/services/certificateService';
import { getUserCertificates, updateCertificateRecord, approveCertificateRecord, rejectCertificateRecord, uploadCertificateFile } from '@/services/certificateService';

const STATUS_CONFIG: Record<CertificateStatus, { label: string; colour: string; bg: string }> = {
    valid:          { label: 'Valid',          colour: 'ap-text-green-700',  bg: 'ap-bg-green-100' },
    expired:        { label: 'Expired',        colour: 'ap-text-red-700',    bg: 'ap-bg-red-100' },
    expiring_soon:  { label: 'Expiring Soon',  colour: 'ap-text-yellow-700', bg: 'ap-bg-yellow-100' },
    pending_review: { label: 'Pending Review', colour: 'ap-text-blue-700',   bg: 'ap-bg-blue-100' },
    missing:        { label: 'Missing',        colour: 'ap-text-gray-500',   bg: 'ap-bg-gray-100' },
};

function fmtDate(d: string | null) {
    if (!d) return '—';
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
    userId: number;
    canEdit?: boolean;
    canApprove?: boolean;
}

const UserCertificateSection: React.FC<Props> = ({ userId, canEdit = false, canApprove = false }) => {
    const [certs, setCerts] = useState<UserCertificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{
        trainingDate: string; expirationDate: string; notes: string;
    }>({ trainingDate: '', expirationDate: '', notes: '' });
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await getUserCertificates(userId);
            setCerts(data);
        } catch { /* */ }
        setLoading(false);
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    const startEdit = (c: UserCertificate) => {
        setEditingId(c.id);
        setEditForm({
            trainingDate: c.trainingDate ?? '',
            expirationDate: c.expirationDate ?? '',
            notes: c.notes ?? '',
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        await updateCertificateRecord(editingId, {
            trainingDate: editForm.trainingDate || null,
            expirationDate: editForm.expirationDate || null,
            notes: editForm.notes,
        });
        setEditingId(null);
        load();
    };

    const handleApprove = async (id: number) => {
        await approveCertificateRecord(id);
        load();
    };

    const handleReject = async (id: number) => {
        const reason = prompt('Reason for rejection (optional):');
        await rejectCertificateRecord(id, reason ?? undefined);
        load();
    };

    const handleFileUpload = async (certId: number, file: File) => {
        setUploading(true);
        try {
            const uploaded = await uploadCertificateFile(file);
            await updateCertificateRecord(certId, {
                fileAttachmentId: parseInt(uploaded.id, 10),
                fileUrl: uploaded.url,
            });
            load();
        } catch (err) {
            console.error('File upload failed', err);
        }
        setUploading(false);
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-gap-2 ap-py-4 ap-text-gray-400 ap-text-sm">
                <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-blue-600"></div>
                Loading certificates...
            </div>
        );
    }

    if (certs.length === 0) {
        return (
            <div className="ap-py-4">
                <div className="ap-flex ap-items-center ap-gap-2 ap-text-gray-500 ap-text-sm">
                    <HiOutlineShieldCheck className="ap-w-5 ap-h-5 ap-text-gray-400" />
                    No certificates assigned to this user.
                </div>
            </div>
        );
    }

    return (
        <div className="ap-mt-4">
            <h3 className="ap-text-sm ap-font-semibold ap-text-gray-700 ap-flex ap-items-center ap-gap-2 ap-mb-3">
                <HiOutlineShieldCheck className="ap-w-5 ap-h-5 ap-text-indigo-600" />
                Certificates ({certs.length})
            </h3>
            <div className="ap-space-y-2">
                {certs.map(cert => {
                    const sc = STATUS_CONFIG[cert.status] ?? STATUS_CONFIG.missing;
                    const isEditing = editingId === cert.id;

                    return (
                        <div key={cert.id} className="ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-px-4 ap-py-3">
                            <div className="ap-flex ap-items-center ap-justify-between">
                                <div className="ap-flex ap-items-center ap-gap-3">
                                    <span className="ap-font-medium ap-text-sm ap-text-gray-800">{cert.certificateName}</span>
                                    <span className={`ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ${sc.bg} ${sc.colour}`}>
                                        {sc.label}
                                    </span>
                                </div>
                                <div className="ap-flex ap-gap-1">
                                    {cert.status === 'pending_review' && canApprove && (
                                        <>
                                            <button onClick={() => handleApprove(cert.id)} className="ap-p-1 ap-rounded hover:ap-bg-green-50 ap-text-green-600" title="Approve">
                                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                            </button>
                                            <button onClick={() => handleReject(cert.id)} className="ap-p-1 ap-rounded hover:ap-bg-red-50 ap-text-red-500" title="Reject">
                                                <HiOutlineXCircle className="ap-w-4 ap-h-4" />
                                            </button>
                                        </>
                                    )}
                                    {canEdit && !isEditing && (
                                        <button onClick={() => startEdit(cert)} className="ap-p-1 ap-rounded hover:ap-bg-gray-100 ap-text-gray-500" title="Edit">
                                            <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Display row */}
                            {!isEditing && (
                                <div className="ap-mt-2 ap-flex ap-flex-wrap ap-gap-4 ap-text-xs ap-text-gray-500">
                                    <span>Training: {fmtDate(cert.trainingDate)}</span>
                                    <span>Expires: {fmtDate(cert.expirationDate)}</span>
                                    {cert.fileUrl && (
                                        <a href={cert.fileUrl} target="_blank" rel="noreferrer" className="ap-text-indigo-600 hover:ap-underline ap-inline-flex ap-items-center ap-gap-1">
                                            <HiOutlineLink className="ap-w-3 ap-h-3" /> File
                                        </a>
                                    )}
                                    {cert.trainingLink && (
                                        <a href={cert.trainingLink} target="_blank" rel="noreferrer" className="ap-text-indigo-600 hover:ap-underline ap-inline-flex ap-items-center ap-gap-1">
                                            <HiOutlineDocumentArrowUp className="ap-w-3 ap-h-3" /> Training
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Inline Edit */}
                            {isEditing && (
                                <div className="ap-mt-3 ap-space-y-2 ap-bg-gray-50 ap-rounded ap-p-3">
                                    <div className="ap-grid ap-grid-cols-2 ap-gap-3">
                                        <div>
                                            <Label className="!ap-text-xs">Training Date</Label>
                                            <Input type="date" value={editForm.trainingDate} onChange={e => setEditForm(f => ({ ...f, trainingDate: e.target.value }))} />
                                        </div>
                                        <div>
                                            <Label className="!ap-text-xs">Expiration Date</Label>
                                            <Input type="date" value={editForm.expirationDate} onChange={e => setEditForm(f => ({ ...f, expirationDate: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="!ap-text-xs">Notes</Label>
                                        <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                                    </div>
                                    {/* File Upload */}
                                    <div>
                                        <Label className="!ap-text-xs">Certificate File</Label>
                                        {cert.fileUrl && (
                                            <div className="ap-mb-1">
                                                <a href={cert.fileUrl} target="_blank" rel="noreferrer"
                                                   className="ap-text-indigo-600 hover:ap-underline ap-text-xs ap-inline-flex ap-items-center ap-gap-1">
                                                    <HiOutlineLink className="ap-w-3 ap-h-3" /> Current file
                                                </a>
                                            </div>
                                        )}
                                        <label className="ap-flex ap-items-center ap-justify-center ap-w-full ap-h-16 ap-border-2 ap-border-dashed ap-border-gray-300 ap-rounded ap-cursor-pointer hover:ap-border-indigo-400 hover:ap-bg-indigo-50/30 ap-transition-colors">
                                            <span className="ap-text-gray-500 ap-text-xs ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineDocumentArrowUp className="ap-w-4 ap-h-4" />
                                                {uploading ? 'Uploading...' : 'Upload / replace file'}
                                            </span>
                                            <input
                                                type="file"
                                                className="ap-hidden"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                disabled={uploading}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleFileUpload(cert.id, f);
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="ap-flex ap-justify-end ap-gap-2">
                                        <button onClick={() => setEditingId(null)} className="ap-px-3 ap-py-1.5 ap-text-xs ap-rounded ap-border ap-border-gray-300 ap-text-gray-600 hover:ap-bg-gray-100">
                                            Cancel
                                        </button>
                                        <button onClick={saveEdit} className="ap-px-3 ap-py-1.5 ap-text-xs ap-rounded ap-bg-indigo-600 ap-text-white hover:ap-bg-indigo-700 ap-flex ap-items-center ap-gap-1">
                                            <HiOutlineCheck className="ap-w-3.5 ap-h-3.5" /> Save
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UserCertificateSection;
