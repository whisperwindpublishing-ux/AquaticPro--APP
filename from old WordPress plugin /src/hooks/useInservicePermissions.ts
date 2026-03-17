import { useState, useEffect } from 'react';
import { getJobRoles, getUserAssignments } from '../services/api-professional-growth';

export interface EffectiveInservicePermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to get the current user's effective in-service training permissions
 * based on their assigned job roles. Uses OR logic - if ANY assigned role
 * grants a permission, the user has that permission.
 */
export function useInservicePermissions(currentUserId?: number): EffectiveInservicePermissions {
    const [permissions, setPermissions] = useState<EffectiveInservicePermissions>({
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
            // Visitor Mode Bypass: Allow viewing framework without data
            if (window.mentorshipPlatformData?.visitor_mode) {
                setPermissions({
                    canView: true,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    loading: false,
                    error: null,
                });
                return;
            }

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

                // Fetch both all roles and user's assignments
                const [allRoles, userAssignments] = await Promise.all([
                    getJobRoles(),
                    getUserAssignments(currentUserId)
                ]);

                // Get the IDs of roles assigned to this user - ensure numeric comparison
                const assignedRoleIds = new Set(userAssignments.map(a => Number(a.job_role_id)));

                // Filter to only roles the user has - ensure numeric comparison
                const userRoles = allRoles.filter(role => assignedRoleIds.has(Number(role.id)));

                // Aggregate permissions with OR logic
                const aggregated = {
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                };

                for (const role of userRoles) {
                    if (role.inservicePermissions) {
                        aggregated.canView = aggregated.canView || role.inservicePermissions.canView;
                        aggregated.canCreate = aggregated.canCreate || role.inservicePermissions.canCreate;
                        aggregated.canEdit = aggregated.canEdit || role.inservicePermissions.canEdit;
                        aggregated.canDelete = aggregated.canDelete || role.inservicePermissions.canDelete;
                        aggregated.canModerateAll = aggregated.canModerateAll || role.inservicePermissions.canModerateAll;
                    }
                }

                setPermissions({
                    ...aggregated,
                    loading: false,
                    error: null,
                });
            } catch (err) {
                console.error('Failed to fetch in-service permissions:', err);
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
