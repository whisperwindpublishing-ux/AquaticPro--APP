import React, { useState, useEffect } from 'react';
import { getDailyLogPermissions, batchUpdateDailyLogPermissions, syncDailyLogPermissions } from '@/services/api';
import { DailyLogPermissions } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineArrowPath } from 'react-icons/hi2';
import { Button } from './ui/Button';

/**
 * DailyLogPermissionsManagement Component
 * 
 * Admin interface (Tier 5/6 only) for managing daily log permissions per job role.
 * 
 * Features:
 * - View all job roles and their current permissions
 * - Toggle permissions with checkboxes
 * - Batch save changes
 * - Visual tier indicators
 */
const DailyLogPermissionsManagement: React.FC = () => {
    const [permissions, setPermissions] = useState<DailyLogPermissions[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [modifiedRoles, setModifiedRoles] = useState<Set<number>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getDailyLogPermissions();
            console.log('Fetched permissions:', data);
            
            if (!data || data.length === 0) {
                setError('No permissions found. The permissions table may need to be initialized. Please run the init-daily-log-permissions.php script or reactivate the plugin.');
            }
            
            setPermissions(data);
            setModifiedRoles(new Set());
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
            setError(`Failed to load permissions: ${err instanceof Error ? err.message : 'Unknown error'}. Check browser console for details.`);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePermission = (roleId: number, permissionKey: keyof DailyLogPermissions) => {
        setPermissions(prev =>
            prev.map(p =>
                p.jobRoleId === roleId
                    ? { ...p, [permissionKey]: !(p[permissionKey] as boolean) }
                    : p
            )
        );
        setModifiedRoles(prev => new Set(prev).add(roleId));
    };

    const handleSave = async () => {
        if (modifiedRoles.size === 0) {
            setSuccessMessage('No changes to save.');
            setTimeout(() => setSuccessMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const updates = Array.from(modifiedRoles).map(roleId => {
                const role = permissions.find(p => p.jobRoleId === roleId);
                if (!role) return null;

                return {
                    jobRoleId: roleId,
                    permissions: {
                        canView: role.canView,
                        canCreate: role.canCreate,
                        canEdit: role.canEdit,
                        canDelete: role.canDelete,
                        canModerateAll: role.canModerateAll
                    }
                };
            }).filter(Boolean) as Array<{
                jobRoleId: number;
                permissions: Partial<Omit<DailyLogPermissions, 'jobRoleId' | 'jobRoleName' | 'jobRoleTier'>>;
            }>;

            await batchUpdateDailyLogPermissions(updates);
            setSuccessMessage(`Successfully updated permissions for ${modifiedRoles.size} role(s).`);
            setModifiedRoles(new Set());
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            console.error('Failed to save permissions:', err);
            setError('Failed to save permissions. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        fetchPermissions();
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const result = await syncDailyLogPermissions();
            setSuccessMessage(result.message);
            
            // Refresh permissions after sync
            await fetchPermissions();
        } catch (err) {
            console.error('Failed to sync permissions:', err);
            setError(`Failed to sync permissions: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    const getTierColor = (tier: number) => {
        if (tier >= 5) return 'ap-bg-purple-100 ap-text-purple-800';
        if (tier >= 3) return 'ap-bg-blue-100 ap-text-blue-800';
        return 'ap-bg-gray-100 ap-text-gray-800';
    };

    // Sort permissions by tier (descending) then by role name
    const sortedPermissions = [...permissions].sort((a, b) => {
        const tierDiff = (b.jobRoleTier || 0) - (a.jobRoleTier || 0);
        if (tierDiff !== 0) return tierDiff;
        return (a.jobRoleName || '').localeCompare(b.jobRoleName || '');
    });

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div>
                <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
                    Daily Log Permissions
                </h2>
                <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
                    Configure which job roles can create, edit, and delete daily logs.
                </p>
                <p className="ap-mt-1 ap-text-xs ap-text-purple-600 ap-font-medium">
                    Note: Tier 6 users and WordPress Admins always have full access regardless of these settings.
                </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
                    <HiOutlineXCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
                    <div className="ap-flex-1">{error}</div>
                    {error.includes('table may need to be initialized') && (
                        <Button
                            onClick={handleSync}
                            disabled={isSyncing}
                            variant="danger"
                            size="sm"
                            loading={isSyncing}
                            leftIcon={!isSyncing ? <HiOutlineArrowPath className="ap-h-4 ap-w-4" /> : undefined}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    )}
                </div>
            )}

            {successMessage && (
                <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-text-green-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
                    <HiOutlineCheckCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Permissions Table */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Role
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    View
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Create
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Edit Own
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Delete Own
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Moderate All
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {sortedPermissions.map((perm) => (
                                <tr
                                    key={perm.jobRoleId}
                                    className={
                                        modifiedRoles.has(perm.jobRoleId)
                                            ? 'bg-yellow-50'
                                            : ''
                                    }
                                >
                                    {/* Job Role Name + Tier */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                        <div className="ap-flex ap-items-center ap-gap-3">
                                            <div>
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {perm.jobRoleName || 'Unknown Role'}
                                                </div>
                                                <span
                                                    className={`ap-inline-block ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-rounded ${getTierColor(
                                                        perm.jobRoleTier || 0
                                                    )}`}
                                                >
                                                    Tier {perm.jobRoleTier || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* View Permission */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.canView}
                                            onChange={() => togglePermission(perm.jobRoleId, 'canView')}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                        />
                                    </td>

                                    {/* Create Permission */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.canCreate}
                                            onChange={() => togglePermission(perm.jobRoleId, 'canCreate')}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                        />
                                    </td>

                                    {/* Edit Permission */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.canEdit}
                                            onChange={() => togglePermission(perm.jobRoleId, 'canEdit')}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                        />
                                    </td>

                                    {/* Delete Permission */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.canDelete}
                                            onChange={() => togglePermission(perm.jobRoleId, 'canDelete')}
                                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                        />
                                    </td>

                                    {/* Moderate All Permission */}
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                        <input
                                            type="checkbox"
                                            checked={perm.canModerateAll}
                                            onChange={() =>
                                                togglePermission(perm.jobRoleId, 'canModerateAll')
                                            }
                                            className="ap-h-4 ap-w-4 ap-text-purple-600 focus:ap-ring-purple-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Permission Descriptions */}
            <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                <h3 className="ap-text-sm ap-font-semibold ap-text-blue-900 ap-mb-2">
                    Permission Descriptions:
                </h3>
                <ul className="ap-space-y-1 ap-text-sm ap-text-blue-800">
                    <li>
                        <strong>View:</strong> Can see daily logs in the list
                    </li>
                    <li>
                        <strong>Create:</strong> Can create new daily logs
                    </li>
                    <li>
                        <strong>Edit Own:</strong> Can edit their own logs
                    </li>
                    <li>
                        <strong>Delete Own:</strong> Can delete their own logs
                    </li>
                    <li>
                        <strong>Moderate All:</strong> Can edit/delete any log (moderator privilege)
                    </li>
                </ul>
            </div>

            {/* Action Buttons */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <Button
                    onClick={handleReset}
                    disabled={isSaving || modifiedRoles.size === 0}
                    variant="ghost"
                >
                    Reset Changes
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving || modifiedRoles.size === 0}
                    variant="primary"
                    loading={isSaving}
                >
                    {isSaving ? 'Saving...' : `Save Changes${modifiedRoles.size > 0 ? ` (${modifiedRoles.size})` : ''}`}
                </Button>
            </div>
        </div>
    );
};

export default DailyLogPermissionsManagement;
