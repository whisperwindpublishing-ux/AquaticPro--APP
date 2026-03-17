import { useState, useEffect } from 'react';
import { getJobRoles, getUserAssignments } from '../services/api-professional-growth';

export interface EffectiveCashierAuditPermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    loading: boolean;
    error: string | null;
}

interface PermissionState {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
}

/**
 * Hook to get the current user's effective cashier audit permissions
 * based on their assigned job roles. Uses OR logic - if ANY assigned role
 * grants a permission, the user has that permission.
 */
export function useCashierAuditPermissions(currentUserId?: number): EffectiveCashierAuditPermissions {
    const [permissions, setPermissions] = useState<EffectiveCashierAuditPermissions>({
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canModerateAll: false,
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchPermissions = async () => {
            if (!currentUserId) {
                setPermissions({
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    loading: false,
                    error: 'No user ID provided',
                });
                return;
            }

            try {
                setPermissions((prev) => ({ ...prev, loading: true, error: null }));

                // Fetch all job roles and user job assignments in parallel
                const [jobRoles, userAssignments] = await Promise.all([
                    getJobRoles(),
                    getUserAssignments(currentUserId)
                ]);

                // Filter to only roles user has assigned - ensure numeric comparison
                const userRoleIds = userAssignments.map((ua: any) => Number(ua.job_role_id));
                const userRoles = jobRoles.filter((role: any) => userRoleIds.includes(Number(role.id)));

                // Aggregate permissions using OR logic
                // If ANY role grants a permission, the user has it
                const aggregatedPermissions = userRoles.reduce((acc: PermissionState, role: any) => {
                    if (role.cashierAuditPermissions) {
                        return {
                            canView: acc.canView || role.cashierAuditPermissions.canView,
                            canCreate: acc.canCreate || role.cashierAuditPermissions.canCreate,
                            canEdit: acc.canEdit || role.cashierAuditPermissions.canEdit,
                            canDelete: acc.canDelete || role.cashierAuditPermissions.canDelete,
                            canModerateAll: acc.canModerateAll || role.cashierAuditPermissions.canModerateAll
                        };
                    }
                    return acc;
                }, { canView: false, canCreate: false, canEdit: false, canDelete: false, canModerateAll: false });

                setPermissions({ ...aggregatedPermissions, loading: false, error: null });
            } catch (err) {
                console.error('Failed to fetch cashier audit permissions:', err);
                setPermissions({
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load permissions',
                });
            }
        };

        fetchPermissions();
    }, [currentUserId]);

    return permissions;
}
