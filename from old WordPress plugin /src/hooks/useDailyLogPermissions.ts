import { useState, useEffect } from 'react';
import { getJobRoles, getUserAssignments } from '@/services/api-professional-growth';

interface EffectiveDailyLogPermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    isLoading: boolean;
}

/**
 * Custom hook to fetch and expose current user's effective daily log permissions
 * 
 * Combines permissions across all the user's job roles (takes the highest permission for each flag).
 * This avoids repeated API calls and provides a single source of truth for permission checks.
 * 
 * @returns {EffectiveDailyLogPermissions} Current user's permissions and loading state
 */
export const useDailyLogPermissions = (): EffectiveDailyLogPermissions => {
    const [permissions, setPermissions] = useState<EffectiveDailyLogPermissions>({
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canModerateAll: false,
        isLoading: true
    });

    useEffect(() => {
        const fetchPermissions = async () => {
            // Visitor Mode Bypass
            if (window.mentorshipPlatformData?.visitor_mode) {
                setPermissions({
                    canView: true,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    isLoading: false
                });
                return;
            }

            try {
                // Check if user is WordPress admin - they get full access
                const wpData = (window as any).mentorshipPlatformData || {};
                const isAdmin = wpData.is_admin || false;
                const currentUserId = wpData.current_user?.id;
                
                if (isAdmin) {
                    setPermissions({
                        canView: true,
                        canCreate: true,
                        canEdit: true,
                        canDelete: true,
                        canModerateAll: true,
                        isLoading: false
                    });
                    return;
                }
                
                if (!currentUserId) {
                    // No logged-in user
                    setPermissions({
                        canView: false,
                        canCreate: false,
                        canEdit: false,
                        canDelete: false,
                        canModerateAll: false,
                        isLoading: false
                    });
                    return;
                }
                
                // Fetch ALL job roles (with permissions) and user's assignments
                console.log('[useDailyLogPermissions] About to fetch job roles for user:', currentUserId);
                
                let allRoles: Awaited<ReturnType<typeof getJobRoles>> = [];
                let userAssignments: Awaited<ReturnType<typeof getUserAssignments>> = [];
                try {
                    allRoles = await getJobRoles();
                    console.log('[useDailyLogPermissions] Job roles fetch SUCCESS:', allRoles);
                } catch (error) {
                    console.error('[useDailyLogPermissions] Job roles fetch FAILED:', error);
                    allRoles = [];
                }
                
                try {
                    userAssignments = await getUserAssignments(currentUserId);
                    console.log('[useDailyLogPermissions] User assignments fetch SUCCESS:', userAssignments);
                } catch (error) {
                    console.error('[useDailyLogPermissions] User assignments fetch FAILED:', error);
                    userAssignments = [];
                }
                
                console.log('[useDailyLogPermissions] Current User ID:', currentUserId);
                console.log('[useDailyLogPermissions] User Assignments:', userAssignments);
                console.log('[useDailyLogPermissions] All Roles with Permissions:', allRoles);
                
                // Get user's assigned role IDs - ensure numeric comparison
                const assignedRoleIds = new Set(userAssignments.map(a => Number(a.job_role_id)));
                
                // Filter to only user's assigned roles - ensure numeric comparison
                const userRoles = allRoles.filter(role => assignedRoleIds.has(Number(role.id)));
                
                console.log('[useDailyLogPermissions] User\'s Assigned Roles:', userRoles);
                
                // Aggregate permissions (OR logic - if any role grants permission, user has it)
                const effectivePermissions = userRoles.reduce((acc, role) => {
                    const rolePerms = role.dailyLogPermissions;
                    if (!rolePerms) return acc;

                    return {
                        canView: acc.canView || rolePerms.canView,
                        canCreate: acc.canCreate || rolePerms.canCreate,
                        canEdit: acc.canEdit || rolePerms.canEdit,
                        canDelete: acc.canDelete || rolePerms.canDelete,
                        canModerateAll: acc.canModerateAll || rolePerms.canModerateAll
                    };
                }, {
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false
                });

                console.log('[useDailyLogPermissions] Final Effective Permissions:', effectivePermissions);

                setPermissions({
                    ...effectivePermissions,
                    isLoading: false
                });
            } catch (error) {
                console.error('Failed to fetch daily log permissions:', error);
                // On error, default to no permissions
                setPermissions({
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    isLoading: false
                });
            }
        };

        fetchPermissions();
    }, []); // Run once on mount

    return permissions;
};
