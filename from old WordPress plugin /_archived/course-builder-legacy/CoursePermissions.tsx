/**
 * Course Permissions Component
 * 
 * Admin UI for managing role-based permissions for the Course Builder
 */
import React, { useState, useEffect } from 'react';
import { 
    HiOutlineExclamationTriangle,
    HiOutlineCheck,
    HiOutlineShieldCheck
} from 'react-icons/hi2';
import { CoursePermission } from './types';
import * as api from './api';

const CoursePermissions: React.FC = () => {
    const [permissions, setPermissions] = useState<CoursePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Load permissions
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                setLoading(true);
                const data = await api.getPermissions();
                setPermissions(data);
            } catch (err) {
                setError('Failed to load permissions');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadPermissions();
    }, []);

    const handleToggle = (roleId: number, field: 'can_view' | 'can_edit' | 'can_manage', value: boolean) => {
        setPermissions(prev => prev.map(p => {
            if (p.job_role_id !== roleId) return p;
            
            const updated = { ...p, [field]: value };
            
            // Auto-cascade permissions
            if (field === 'can_manage' && value) {
                updated.can_view = true;
                updated.can_edit = true;
            } else if (field === 'can_edit' && value) {
                updated.can_view = true;
            } else if (field === 'can_view' && !value) {
                updated.can_edit = false;
                updated.can_manage = false;
            } else if (field === 'can_edit' && !value) {
                updated.can_manage = false;
            }
            
            return updated;
        }));
        setHasChanges(true);
        setSuccess(null);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            
            await api.updatePermissions(permissions.map(p => ({
                job_role_id: p.job_role_id,
                can_view: p.can_view,
                can_edit: p.can_edit,
                can_manage: p.can_manage
            })));
            
            setSuccess('Permissions saved successfully');
            setHasChanges(false);
        } catch (err) {
            setError('Failed to save permissions');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // Group permissions by tier
    const groupedPermissions = permissions.reduce((acc, perm) => {
        const tier = perm.tier_id || 0;
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(perm);
        return acc;
    }, {} as Record<number, CoursePermission[]>);

    const tierLabels: Record<number, string> = {
        0: 'No Tier',
        1: 'Tier 1',
        2: 'Tier 2',
        3: 'Tier 3',
        4: 'Tier 4',
        5: 'Tier 5',
        6: 'Tier 6 (Admin)',
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <HiOutlineShieldCheck className="w-7 h-7 text-indigo-600" />
                    Course Builder Permissions
                </h2>
                <p className="mt-2 text-gray-600">
                    Configure which job roles can access and manage courses. Tier 6 and WordPress admins always have full access.
                </p>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                    <HiOutlineExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
                    <HiOutlineCheck className="w-5 h-5 flex-shrink-0" />
                    <span>{success}</span>
                </div>
            )}

            {/* Permissions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Job Role</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 w-28">
                                    <div className="flex flex-col items-center">
                                        <span>View</span>
                                        <span className="text-xs font-normal text-gray-500">Browse courses</span>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 w-28">
                                    <div className="flex flex-col items-center">
                                        <span>Edit</span>
                                        <span className="text-xs font-normal text-gray-500">Create/modify</span>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 w-28">
                                    <div className="flex flex-col items-center">
                                        <span>Manage</span>
                                        <span className="text-xs font-normal text-gray-500">Full admin</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {Object.entries(groupedPermissions)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([tier, roles]) => (
                                    <React.Fragment key={tier}>
                                        {/* Tier Header */}
                                        <tr className="bg-gray-50">
                                            <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                {tierLabels[Number(tier)] || `Tier ${tier}`}
                                            </td>
                                        </tr>
                                        {/* Roles in this tier */}
                                        {roles.map(perm => (
                                            <tr key={perm.job_role_id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {perm.job_role_name}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={perm.can_view}
                                                        onChange={(e) => handleToggle(perm.job_role_id, 'can_view', e.target.checked)}
                                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={perm.can_edit}
                                                        onChange={(e) => handleToggle(perm.job_role_id, 'can_edit', e.target.checked)}
                                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={perm.can_manage}
                                                        onChange={(e) => handleToggle(perm.job_role_id, 'can_manage', e.target.checked)}
                                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${
                        hasChanges && !saving
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {saving ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <HiOutlineCheck className="w-5 h-5" />
                            <span>Save Changes</span>
                        </>
                    )}
                </button>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Permission Levels</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li><strong>View:</strong> Can browse and view courses assigned to their role(s)</li>
                    <li><strong>Edit:</strong> Can create, edit, and delete courses, sections, lessons, topics, and cards</li>
                    <li><strong>Manage:</strong> Full admin access - can assign courses to roles and manage permissions</li>
                </ul>
            </div>
        </div>
    );
};

export default CoursePermissions;
