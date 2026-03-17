/**
 * BulkCertificateModal — Bulk assign / update certificate records
 *
 * Allows admins to:
 *   - Select multiple users (or whole roles)
 *   - Assign them to a cert type (creates missing records)
 *   - Set training date and expiration date in bulk
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    HiOutlineUsers,
    HiOutlineCheckCircle,
    HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import { Button, Input, Label, Modal } from '../ui';
import type { CertificateType, BulkResult } from '@/services/certificateService';
import { bulkAssign, bulkUpdate } from '@/services/certificateService';

interface JobRole {
    id: number;
    title: string;
    tier: number;
}

interface SimpleUser {
    id: number;
    name: string;
    email: string;
}

interface Props {
    certType: CertificateType;
    onClose: () => void;
    onComplete: () => void;
}

const BulkCertificateModal: React.FC<Props> = ({ certType, onClose, onComplete }) => {
    const [mode, setMode] = useState<'assign' | 'update'>('assign');
    const [users, setUsers] = useState<SimpleUser[]>([]);
    const [roles, setRoles] = useState<JobRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<BulkResult | null>(null);

    // Selection state
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');

    // Dates (for update mode)
    const [trainingDate, setTrainingDate] = useState('');
    const [expirationDate, setExpirationDate] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const wpData = (window as any).mentorshipPlatformData;
                // Load users and roles
                const [usersRes, rolesRes] = await Promise.all([
                    fetch(`${wpData.api_url}/users`, { headers: { 'X-WP-Nonce': wpData.nonce } }),
                    fetch(`${wpData.api_url}/professional-growth/job-roles`, { headers: { 'X-WP-Nonce': wpData.nonce } }),
                ]);

                if (usersRes.ok) {
                    const data = await usersRes.json();
                    const arr = Array.isArray(data) ? data : data.users ?? [];
                    setUsers(arr.map((u: any) => ({ id: u.id, name: u.display_name || u.name, email: u.email || u.user_email })));
                }
                if (rolesRes.ok) {
                    const data = await rolesRes.json();
                    setRoles(Array.isArray(data) ? data : data.roles ?? []);
                }
            } catch { /* */ }
            setLoading(false);
        })();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!userSearch) return users;
        const q = userSearch.toLowerCase();
        return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }, [users, userSearch]);

    const toggleUser = (id: number) => {
        setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleRole = (id: number) => {
        setSelectedRoleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const selectAll = () => {
        setSelectedUserIds(filteredUsers.map(u => u.id));
    };

    const clearAll = () => {
        setSelectedUserIds([]);
        setSelectedRoleIds([]);
    };

    const handleSubmit = async () => {
        if (selectedUserIds.length === 0 && selectedRoleIds.length === 0) return;

        setSubmitting(true);
        try {
            let res: BulkResult;
            if (mode === 'assign') {
                res = await bulkAssign({
                    certificateTypeId: certType.id,
                    userIds: selectedUserIds,
                    roleIds: selectedRoleIds,
                });
            } else {
                res = await bulkUpdate({
                    certificateTypeId: certType.id,
                    userIds: selectedUserIds,
                    trainingDate: trainingDate || null,
                    expirationDate: expirationDate || null,
                });
            }
            setResult(res);
        } catch { /* */ }
        setSubmitting(false);
    };

    const totalSelected = selectedUserIds.length + selectedRoleIds.length;

    return (
        <Modal isOpen onClose={onClose}>
            <Modal.Header showCloseButton onClose={onClose}>
                <Modal.Title>Bulk {mode === 'assign' ? 'Assign' : 'Update'} — {certType.name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
            {result ? (
                <div className="ap-text-center ap-py-6">
                    <HiOutlineCheckCircle className="ap-w-12 ap-h-12 ap-text-green-500 ap-mx-auto ap-mb-3" />
                    <p className="ap-text-lg ap-font-semibold ap-text-gray-800">{result.message}</p>
                    <div className="ap-mt-4">
                        <Button variant="primary" onClick={onComplete}>Done</Button>
                    </div>
                </div>
            ) : (
                <div className="ap-space-y-4">
                    {/* Mode Toggle */}
                    <div className="ap-flex ap-gap-2">
                        <button
                            onClick={() => setMode('assign')}
                            className={`ap-flex-1 ap-py-2 ap-rounded-lg ap-text-sm ap-font-medium ap-border ap-transition-colors ${
                                mode === 'assign'
                                    ? 'ap-bg-indigo-50 ap-text-indigo-700 ap-border-indigo-200'
                                    : 'ap-text-gray-600 ap-border-gray-200 hover:ap-bg-gray-50'
                            }`}
                        >Assign to Users</button>
                        <button
                            onClick={() => setMode('update')}
                            className={`ap-flex-1 ap-py-2 ap-rounded-lg ap-text-sm ap-font-medium ap-border ap-transition-colors ${
                                mode === 'update'
                                    ? 'ap-bg-indigo-50 ap-text-indigo-700 ap-border-indigo-200'
                                    : 'ap-text-gray-600 ap-border-gray-200 hover:ap-bg-gray-50'
                            }`}
                        >Update Dates</button>
                    </div>

                    {/* By Role */}
                    {mode === 'assign' && roles.length > 0 && (
                        <div>
                            <Label>Select by Role</Label>
                            <div className="ap-max-h-28 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded ap-p-2 ap-space-y-1">
                                {roles.map(role => (
                                    <label key={role.id} className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer hover:ap-bg-gray-50 ap-px-1 ap-py-0.5 ap-rounded">
                                        <input type="checkbox" checked={selectedRoleIds.includes(role.id)} onChange={() => toggleRole(role.id)} className="ap-rounded ap-text-indigo-600" />
                                        <span>{role.title}</span>
                                        <span className="ap-text-gray-400 ap-text-xs">Tier {role.tier}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Individual Users */}
                    <div>
                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-1">
                            <Label>Select Users</Label>
                            <div className="ap-flex ap-gap-2 ap-text-xs">
                                <button onClick={selectAll} className="ap-text-indigo-600 hover:ap-underline">Select all</button>
                                <button onClick={clearAll} className="ap-text-gray-500 hover:ap-underline">Clear</button>
                            </div>
                        </div>
                        <div className="ap-relative ap-mb-2">
                            <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                            <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." className="!ap-pl-8" />
                        </div>
                        <div className="ap-max-h-40 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded ap-p-2 ap-space-y-1">
                            {loading ? (
                                <div className="ap-flex ap-justify-center ap-py-4">
                                    <div className="ap-animate-spin ap-rounded-full ap-h-5 ap-w-5 ap-border-b-2 ap-border-blue-600"></div>
                                </div>
                            ) : filteredUsers.map(user => (
                                <label key={user.id} className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-cursor-pointer hover:ap-bg-gray-50 ap-px-1 ap-py-0.5 ap-rounded">
                                    <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} className="ap-rounded ap-text-indigo-600" />
                                    <span>{user.name}</span>
                                    <span className="ap-text-gray-400 ap-text-xs">{user.email}</span>
                                </label>
                            ))}
                        </div>
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                            {totalSelected} selected
                        </p>
                    </div>

                    {/* Dates (for update mode) */}
                    {mode === 'update' && (
                        <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                            <div>
                                <Label>Training Date</Label>
                                <Input type="date" value={trainingDate} onChange={e => setTrainingDate(e.target.value)} />
                            </div>
                            <div>
                                <Label>Expiration Date</Label>
                                <Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
                                <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Leave blank for never-expires</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="ap-flex ap-justify-end ap-gap-2 ap-pt-4 ap-border-t ap-border-gray-100">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={submitting || totalSelected === 0}
                            leftIcon={submitting ? <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-white"></div> : <HiOutlineUsers className="ap-w-4 ap-h-4" />}
                        >
                            {submitting ? 'Processing...' : mode === 'assign' ? 'Assign' : 'Update'}
                        </Button>
                    </div>
                </div>
            )}
            </Modal.Body>
        </Modal>
    );
};

export default BulkCertificateModal;
