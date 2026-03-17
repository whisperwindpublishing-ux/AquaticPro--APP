import { useState, useEffect } from 'react';
import { getJobRoles, getUserAssignments } from '../services/api-professional-growth';

export interface EffectiveScanAuditPermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to get the current user's effective scan audit permissions
 * based on their assigned job roles. Uses OR logic - if ANY assigned role
 * grants a permission, the user has that permission.
 */
export function useScanAuditPermissions(currentUserId?: number): EffectiveScanAuditPermissions {
    const [permissions, setPermissions] = useState<EffectiveScanAuditPermissions>({
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

        console.log('[useScanAuditPermissions] Fetched job roles:', jobRoles);
        console.log('[useScanAuditPermissions] Fetched user assignments:', userAssignments);

        // Filter to only roles user has assigned - ensure numeric comparison
        const userRoleIds = userAssignments.map((ua: any) => Number(ua.job_role_id));
        const userRoles = jobRoles.filter((role: any) => userRoleIds.includes(Number(role.id)));
        
        console.log('[useScanAuditPermissions] User role IDs:', userRoleIds);
        console.log('[useScanAuditPermissions] User roles:', userRoles);

                        // Aggregate permissions using OR logic
        // If ANY role grants a permission, the user has it
        const aggregatedPermissions = userRoles.reduce((acc: Omit<EffectiveScanAuditPermissions, 'loading' | 'error'>, role: any) => {
            if (role.scanAuditPermissions) {
                console.log('[useScanAuditPermissions] Processing role:', role.name, 'permissions:', role.scanAuditPermissions);
                return {
                    canView: acc.canView || role.scanAuditPermissions.canView,
                    canCreate: acc.canCreate || role.scanAuditPermissions.canCreate,
                    canEdit: acc.canEdit || role.scanAuditPermissions.canEdit,
                    canDelete: acc.canDelete || role.scanAuditPermissions.canDelete,
                    canModerateAll: acc.canModerateAll || role.scanAuditPermissions.canModerateAll
                };
            }
            console.log('[useScanAuditPermissions] Role has no scanAuditPermissions:', role.name);
            return acc;
        }, { canView: false, canCreate: false, canEdit: false, canDelete: false, canModerateAll: false });

        console.log('[useScanAuditPermissions] Final aggregated permissions:', aggregatedPermissions);
        setPermissions({ ...aggregatedPermissions, loading: false, error: null });
            } catch (err) {
                console.error('Failed to fetch scan audit permissions:', err);
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
