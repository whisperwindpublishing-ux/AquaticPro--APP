/**
 * Assigned Learning API Service
 * Handles all API calls for the Assigned Learning subsystem
 */

const API_BASE = '/wp-json/aquaticpro/v1';

const getNonce = (): string =>
    window.mentorshipPlatformData?.nonce || '';

const fetchOpts = (method = 'GET', body?: object): RequestInit => ({
    method,
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': getNonce(),
    },
    ...(body && { body: JSON.stringify(body) }),
});

async function handleRes<T>(r: Response): Promise<T> {
    if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `HTTP ${r.status}`);
    }
    return r.json();
}

// ============================================
// TYPES
// ============================================

export interface LearningAssignment {
    id: number;
    lessonId: number;
    lessonTitle: string;
    lessonType: string;
    assignedBy: number;
    assignedByName: string;
    title: string;
    description: string;
    dueDate: string | null;
    status: 'draft' | 'active' | 'closed';
    reminderSentAt: string | null;
    totalUsers: number;
    completedUsers: number;
    emailsSent: number;
    createdAt: string;
    updatedAt: string;
    // only on single-get
    users?: AssignmentUser[];
}

export interface AssignmentUser {
    id: number;
    userId: number;
    userName: string;
    userEmail: string;
    source: 'direct' | 'role';
    sourceRoleId: number | null;
    emailStatus: 'pending' | 'sent' | 'failed';
    emailSentAt: string | null;
    reminderSentAt: string | null;
    progressStatus: 'not-started' | 'in-progress' | 'completed';
    quizScore: number | null;
    startedAt: string | null;
    completedAt: string | null;
}

export interface AssignmentProgress {
    assignmentId: number;
    summary: {
        total: number;
        completed: number;
        started: number;
        notStarted: number;
        completionRate: number;
    };
    users: AssignmentUser[];
}

export interface MyAssignment {
    assignmentId: number;
    title: string;
    description: string;
    dueDate: string | null;
    lessonId: number;
    lessonTitle: string;
    lessonType: string;
    progressStatus: 'not-started' | 'in-progress' | 'completed';
    quizScore: number | null;
    startedAt: string | null;
    completedAt: string | null;
    isOverdue: boolean;
    isDueSoon: boolean;
}

export interface CreateAssignmentPayload {
    lessonId: number;
    title: string;
    description?: string;
    dueDate?: string;
}

export interface SendAssignmentPayload {
    jobRoleIds?: number[];
    userIds?: number[];
}

// ============================================
// API CALLS
// ============================================

/** List all assignments (optionally filter by status) */
export async function getAssignments(status?: string): Promise<LearningAssignment[]> {
    const qs = status ? `?status=${status}` : '';
    const r = await fetch(`${API_BASE}/learning-assignments${qs}`, fetchOpts());
    return handleRes<LearningAssignment[]>(r);
}

/** Get single assignment with user list */
export async function getAssignment(id: number): Promise<LearningAssignment> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}`, fetchOpts());
    return handleRes<LearningAssignment>(r);
}

/** Create a draft assignment */
export async function createAssignment(data: CreateAssignmentPayload): Promise<{ id: number }> {
    const r = await fetch(`${API_BASE}/learning-assignments`, fetchOpts('POST', data));
    return handleRes<{ id: number }>(r);
}

/** Update assignment fields */
export async function updateAssignment(id: number, data: Partial<LearningAssignment>): Promise<{ success: boolean }> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}`, fetchOpts('PUT', data));
    return handleRes<{ success: boolean }>(r);
}

/** Delete an assignment */
export async function deleteAssignment(id: number): Promise<{ deleted: boolean }> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}`, fetchOpts('DELETE'));
    return handleRes<{ deleted: boolean }>(r);
}

/** Activate assignment: resolve users and queue emails */
export async function sendAssignment(id: number, payload: SendAssignmentPayload): Promise<{
    success: boolean;
    recipientCount: number;
    newRecipients: number;
    emailsQueued: number;
}> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}/send`, fetchOpts('POST', payload));
    return handleRes(r);
}

/** Send reminder to incomplete users */
export async function remindAssignment(id: number): Promise<{
    success: boolean;
    remindersQueued: number;
}> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}/remind`, fetchOpts('POST'));
    return handleRes(r);
}

/** Get detailed progress for an assignment */
export async function getAssignmentProgress(id: number): Promise<AssignmentProgress> {
    const r = await fetch(`${API_BASE}/learning-assignments/${id}/progress`, fetchOpts());
    return handleRes<AssignmentProgress>(r);
}

/** Get current user's pending assigned lessons */
export async function getMyAssignments(): Promise<MyAssignment[]> {
    const r = await fetch(`${API_BASE}/my-assignments`, fetchOpts());
    return handleRes<MyAssignment[]>(r);
}

// ============================================
// EXPORT OBJECT
// ============================================

export const assignedLearningApi = {
    getAssignments,
    getAssignment,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    sendAssignment,
    remindAssignment,
    getAssignmentProgress,
    getMyAssignments,
};

export default assignedLearningApi;
