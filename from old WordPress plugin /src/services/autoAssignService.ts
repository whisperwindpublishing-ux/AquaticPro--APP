/**
 * LMS Auto-Assign API Service
 * Handles API calls for course auto-assignment by role
 */

const API_BASE = '/wp-json/aquaticpro/v1';

const getNonce = (): string => {
    return window.mentorshipPlatformData?.nonce || '';
};

const fetchOptions = (method: string = 'GET', body?: object): RequestInit => ({
    method,
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': getNonce(),
    },
    ...(body && { body: JSON.stringify(body) }),
});

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP error ${response.status}`);
    }
    return response.json();
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AutoAssignRule {
    id: number;
    courseId: number;
    courseTitle: string;
    courseStatus: string;
    jobRoleId: number;
    roleTitle: string;
    sendNotification: boolean;
    createdBy: number;
    createdByName: string;
    createdAt: string;
}

export interface CourseAutoAssignRuleForCourse {
    id: number;
    courseId: number;
    jobRoleId: number;
    roleTitle: string;
    sendNotification: boolean;
    createdAt: string;
}

export interface CourseAssignment {
    id: number;
    courseId: number;
    courseTitle: string;
    courseDescription?: string;
    featuredImage?: string;
    source: string;
    status: 'assigned' | 'in-progress' | 'completed';
    totalLessons: number;
    completedLessons: number;
    progress: number;
    dueDate?: string;
    assignedAt: string;
    completedAt?: string;
}

export interface AdminCourseAssignment {
    id: number;
    courseId: number;
    courseTitle: string;
    userId: number;
    userName: string;
    userEmail: string;
    source: string;
    sourceRoleId?: number;
    roleTitle: string;
    status: string;
    totalLessons: number;
    completedLessons: number;
    progress: number;
    dueDate?: string;
    assignedAt: string;
    completedAt?: string;
}

export interface CourseSummary {
    courseId: number;
    courseTitle: string;
    courseStatus: string;
    lessonCount: number;
    totalAssigned: number;
    totalCompleted: number;
    totalInProgress: number;
    totalNotStarted: number;
    completionRate: number;
    assignedRoles: string;
}

export interface ResyncResult {
    success: boolean;
    courseId: number;
    assigned: number;
    skipped: number;
}

export interface CreateRuleResult {
    success: boolean;
    id: number;
    courseId: number;
    courseTitle: string;
    jobRoleId: number;
    roleTitle: string;
    retroactive: { assigned: number; skipped: number };
}

export interface BulkUpdateRulesResult {
    success: boolean;
    added: number;
    removed: number;
    retroactive: { assigned: number; skipped: number };
}

// ============================================
// API FUNCTIONS
// ============================================

/** Get all auto-assign rules */
export async function getAutoAssignRules(): Promise<AutoAssignRule[]> {
    const response = await fetch(`${API_BASE}/auto-assign-rules`, fetchOptions());
    return handleResponse<AutoAssignRule[]>(response);
}

/** Create a new auto-assign rule */
export async function createAutoAssignRule(
    courseId: number,
    jobRoleId: number,
    sendNotification: boolean = true,
    retroactive: boolean = true
): Promise<CreateRuleResult> {
    const response = await fetch(`${API_BASE}/auto-assign-rules`, fetchOptions('POST', {
        courseId,
        jobRoleId,
        sendNotification,
        retroactive,
    }));
    return handleResponse<CreateRuleResult>(response);
}

/** Delete an auto-assign rule */
export async function deleteAutoAssignRule(id: number): Promise<{ deleted: boolean; id: number }> {
    const response = await fetch(`${API_BASE}/auto-assign-rules/${id}`, fetchOptions('DELETE'));
    return handleResponse<{ deleted: boolean; id: number }>(response);
}

/** Get auto-assign rules for a specific course */
export async function getCourseAutoAssignRules(courseId: number): Promise<CourseAutoAssignRuleForCourse[]> {
    const response = await fetch(`${API_BASE}/auto-assign-rules/course/${courseId}`, fetchOptions());
    return handleResponse<CourseAutoAssignRuleForCourse[]>(response);
}

/** Bulk update auto-assign rules for a course (set which roles are auto-assigned) */
export async function bulkUpdateCourseRules(
    courseId: number,
    roleIds: number[],
    sendNotification: boolean = true,
    retroactive: boolean = true
): Promise<BulkUpdateRulesResult> {
    const response = await fetch(`${API_BASE}/auto-assign-rules/course/${courseId}/bulk`, fetchOptions('POST', {
        roleIds,
        sendNotification,
        retroactive,
    }));
    return handleResponse<BulkUpdateRulesResult>(response);
}

/** Get current user's assigned courses */
export async function getMyCourseAssignments(): Promise<CourseAssignment[]> {
    const response = await fetch(`${API_BASE}/my-course-assignments`, fetchOptions());
    return handleResponse<CourseAssignment[]>(response);
}

/** Get all course assignments (admin) */
export async function getCourseAssignments(courseId?: number, roleId?: number): Promise<AdminCourseAssignment[]> {
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', String(courseId));
    if (roleId) params.set('roleId', String(roleId));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE}/course-assignments${qs}`, fetchOptions());
    return handleResponse<AdminCourseAssignment[]>(response);
}

/** Sync progress for current user's course assignments */
export async function syncCourseAssignmentProgress(): Promise<{ synced: number }> {
    const response = await fetch(`${API_BASE}/course-assignments/sync`, fetchOptions('POST'));
    return handleResponse<{ synced: number }>(response);
}

/** Re-sync: retroactively assign a course to all current members of its linked roles */
export async function resyncCourseAssignments(courseId: number): Promise<ResyncResult> {
    const response = await fetch(`${API_BASE}/auto-assign-rules/course/${courseId}/resync`, fetchOptions('POST'));
    return handleResponse<ResyncResult>(response);
}

/** Get per-course assignment summary (admin dashboard) */
export async function getCourseAssignmentSummary(): Promise<CourseSummary[]> {
    const response = await fetch(`${API_BASE}/course-assignments/summary`, fetchOptions());
    return handleResponse<CourseSummary[]>(response);
}

/** Manually assign a course to specific users and/or roles */
export async function createManualCourseAssignment(
    courseId: number,
    userIds: number[],
    jobRoleIds: number[],
    sendNotification: boolean = true,
): Promise<{ success: boolean; courseId: number; assigned: number; skipped: number }> {
    const response = await fetch(`${API_BASE}/course-assignments`, fetchOptions('POST', {
        courseId,
        userIds,
        jobRoleIds,
        sendNotification,
    }));
    return handleResponse(response);
}
