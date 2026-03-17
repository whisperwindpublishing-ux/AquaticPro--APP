import { useState, useEffect } from 'react';

interface LessonManagementPermissions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canModerateAll: boolean;
    isLoading: boolean;
}

/**
 * Hook to fetch lesson management permissions for the current user based on their job role
 */
export const useLessonManagementPermissions = (): LessonManagementPermissions => {
    const [permissions, setPermissions] = useState<LessonManagementPermissions>({
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canModerateAll: false,
        isLoading: true,
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
                    isLoading: false,
                });
                return;
            }

            try {
                const apiUrl = window.mentorshipPlatformData?.api_url;
                const nonce = window.mentorshipPlatformData?.nonce;
                const isAdmin = window.mentorshipPlatformData?.is_admin;

                // Admins have full permissions
                if (isAdmin) {
                    setPermissions({
                        canView: true,
                        canCreate: true,
                        canEdit: true,
                        canDelete: true,
                        canModerateAll: true,
                        isLoading: false,
                    });
                    return;
                }

                // If lesson management is disabled, no permissions
                if (!window.mentorshipPlatformData?.enable_lesson_management) {
                    setPermissions({
                        canView: false,
                        canCreate: false,
                        canEdit: false,
                        canDelete: false,
                        canModerateAll: false,
                        isLoading: false,
                    });
                    return;
                }

                // Fetch from the professional-growth permissions endpoint
                const response = await fetch(`${apiUrl}mentorship-platform/v1/professional-growth/my-permissions`, {
                    headers: {
                        'X-WP-Nonce': nonce || '',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch permissions');
                }

                const data = await response.json();
                
                // Extract lesson management permissions from the role
                const lessonPerms = data.lessonManagementPermissions || {
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                };

                setPermissions({
                    ...lessonPerms,
                    isLoading: false,
                });
            } catch (error) {
                console.error('Error fetching lesson management permissions:', error);
                // Default to view-only if there's an error
                setPermissions({
                    canView: true,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                    canModerateAll: false,
                    isLoading: false,
                });
            }
        };

        fetchPermissions();
    }, []);

    return permissions;
};

export default useLessonManagementPermissions;
