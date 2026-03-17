import { useState, useEffect } from 'react';
import { getJobRoles, getUserAssignments } from '../services/api-professional-growth';

export interface EffectiveLiveDrillPermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to get the current user's effective live drill permissions
 * based on their assigned job roles. Uses OR logic - if ANY assigned role
 * grants a permission, the user has that permission.
 */
export function useLiveDrillPermissions(currentUserId?: number): EffectiveLiveDrillPermissions {
    const [permissions, setPermissions] = useState<EffectiveLiveDrillPermissions>({
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
            // Visitor Mode Bypass: Allow viewing framework AND opening forms (but not submit)
            if (window.mentorshipPlatformData?.visitor_mode) {
                setPermissions({
                    canView: true,
                    canCreate: true, // Allow opening the "New" form
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

                        // Fetch all job roles and user job assignments in parallel
        const [jobRoles, userAssignments] = await Promise.all([
            getJobRoles(),
            getUserAssignments(currentUserId)
        ]);

        console.log('[useLiveDrillPermissions] Fetched job roles:', jobRoles);
        console.log('[useLiveDrillPermissions] Fetched user assignments:', userAssignments);

        // Filter to only roles user has assigned - ensure numeric comparison
        const userRoleIds = userAssignments.map((ua: any) => Number(ua.job_role_id));
        const userRoles = jobRoles.filter((role: any) => userRoleIds.includes(Number(role.id)));
        
        console.log('[useLiveDrillPermissions] User role IDs:', userRoleIds);
        console.log('[useLiveDrillPermissions] User roles:', userRoles);

                        // Aggregate permissions using OR logic
        // If ANY role grants a permission, the user has it
        const aggregatedPermissions = userRoles.reduce((acc: Omit<EffectiveLiveDrillPermissions, 'loading' | 'error'>, role: any) => {
            if (role.liveDrillPermissions) {
                console.log('[useLiveDrillPermissions] Processing role:', role.name, 'permissions:', role.liveDrillPermissions);
                return {
                    canView: acc.canView || role.liveDrillPermissions.canView,
                    canCreate: acc.canCreate || role.liveDrillPermissions.canCreate,
                    canEdit: acc.canEdit || role.liveDrillPermissions.canEdit,
                    canDelete: acc.canDelete || role.liveDrillPermissions.canDelete,
                    canModerateAll: acc.canModerateAll || role.liveDrillPermissions.canModerateAll
                };
            }
            console.log('[useLiveDrillPermissions] Role has no liveDrillPermissions:', role.name);
            return acc;
        }, { canView: false, canCreate: false, canEdit: false, canDelete: false, canModerateAll: false });

        console.log('[useLiveDrillPermissions] Final aggregated permissions:', aggregatedPermissions);
        setPermissions({ ...aggregatedPermissions, loading: false, error: null });
            } catch (err) {
                console.error('Failed to fetch live drill permissions:', err);
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
