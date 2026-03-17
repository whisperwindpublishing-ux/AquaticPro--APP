/**
 * API Service for Professional Growth Module
 * Handles all API calls related to career development features
 */

import { pluginGet, pluginPost, getApiRoot, getApiNonce } from './api-service';

// Type Definitions
export interface JobRole {
    id: number;
    title: string;
    tier: number;
    description?: string;
    inservice_hours: number; // Monthly in-service training hours required
    created_at: string;
    updated_at: string;
    dailyLogPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    scanAuditPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    liveDrillPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    inservicePermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    cashierAuditPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    taskDeckPermissions?: {
        canView: boolean;
        canViewOnlyAssigned?: boolean;
        canManageAllPrimaryCards?: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
        canManagePrimaryDeck?: boolean;
        canCreatePublicDecks?: boolean;
    };
    reportsPermissions?: {
        canViewAllRecords: boolean;
    };
    lessonManagementPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    instructorEvaluationPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    lmsPermissions?: {
        canViewCourses: boolean;
        canViewLessons: boolean;
        canCreateCourses: boolean;
        canEditCourses: boolean;
        canDeleteCourses: boolean;
        canCreateLessons: boolean;
        canEditLessons: boolean;
        canDeleteLessons: boolean;
        canManageExcalidraw: boolean;
        canModerateAll: boolean;
    };
    awesomeAwardsPermissions?: {
        canNominate: boolean;
        canVote: boolean;
        canApprove: boolean;
        canDirectAssign: boolean;
        canManagePeriods: boolean;
        canViewNominations: boolean;
        canViewWinners: boolean;
        canViewArchives: boolean;
        canArchive: boolean;
    };
    srmPermissions?: {
        canViewOwnPay: boolean;
        canViewAllPay: boolean;
        canManagePayConfig: boolean;
        canSendInvites: boolean;
        canViewResponses: boolean;
        canManageStatus: boolean;
        canManageTemplates: boolean;
        canViewRetention: boolean;
        canBulkActions: boolean;
    };
    emailPermissions?: {
        canSendEmail: boolean;
        canManageTemplates: boolean;
        canViewHistory: boolean;
    };
    certificatePermissions?: {
        canViewAll: boolean;
        canEditRecords: boolean;
        canManageTypes: boolean;
        canApproveUploads: boolean;
        canBulkEdit: boolean;
    };
    // NOTE: wp_role_slug removed - job roles are now decoupled from WordPress roles
}

export interface PromotionCriterion {
    id: number;
    job_role_id: number;
    title: string;
    description?: string;
    criterion_type: string;
    target_value?: number;
    linked_module?: string;
    sort_order: number;
    is_required: boolean;
}

export interface UserProgress {
    id?: number;
    user_id: number;
    criterion_id: number;
    current_value: number;
    is_completed: boolean;
    completion_date?: string;
    approved_by?: number;
    notes?: string;
    file_url?: string;
    created_at?: string;
    updated_at?: string;
    // Joined fields from criterion
    title?: string;
    description?: string;
    criterion_type?: string;
    target_value?: number;
}

export interface TeamMember {
    id: number;
    display_name: string;
    user_email: string;
    user_login: string;
    tier: number;
    job_role?: string;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
}

export interface DetailedCriterion {
    id: number;
    title: string;
    description: string;
    criterion_type: string;
    target_value: number | null;
    current_value: number | null;
    is_completed: boolean;
    completion_date: string | null;
    notes: string | null;
    file_url: string | null;
}

export interface RoleProgress {
    job_role_id: number;
    job_role_title: string;
    tier: number;
    inservice_hours: number | null;
    is_current_role: boolean;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    criteria: DetailedCriterion[];
}

export interface TeamMemberDetailedProgress {
    user_id: number;
    current_tier: number;
    roles: RoleProgress[];
}

export interface WpRole {
    slug: string;
    name: string;
}

export interface UserJobAssignment {
    id?: number;
    user_id: number;
    job_role_id: number;
    job_role_title?: string;
    tier?: number;
    assigned_by?: number;
    assigned_date?: string;
    // NOTE: wp_role_slug removed - job roles are now decoupled from WordPress roles
    sync_wp_role?: boolean;
    notes?: string;
    display_name?: string;
    user_email?: string;
}

export interface InServiceLog {
    id: number;
    training_date: string;
    training_time?: string;
    location?: string;
    duration_hours: number;
    topic: string;
    details?: string;
    archived: boolean;
    created_by: number;
    created_by_name?: string; // Optional - populated by API
    created_at: string;
    updated_at: string;
    leaders: Array<{ id: number; name: string }>;
    attendees: Array<{ id: number; name: string }>;
    no_shows: Array<{ id: number; name: string }>;
    job_roles: Array<{ id: number; title: string }>;
}

export interface InServiceSummary {
    user_id: number;
    current_month: string;
    current_month_hours: number;
    previous_month_hours: number;
    required_hours: number;
    current_meets_requirement: boolean;
    previous_meets_requirement: boolean;
}

export interface AuditLog {
    id: number;
    audited_user_id?: number;
    drilled_user_id?: number;
    auditor_id: number; // Always present - the user who created the audit
    drill_conductor_id: number; // Always present - the user who conducted the drill
    audit_date?: string;
    drill_date?: string;
    location?: string;
    result: string;
    notes?: string;
    archived: boolean;
    created_at: string;
    updated_at: string;
    audited_user_name?: string;
    drilled_user_name?: string;
    auditor_name?: string;
    conductor_name?: string;
    // Scan audit specific fields
    wearing_correct_uniform?: number;
    attentive_to_zone?: number;
    posture_adjustment_5min?: number;
    attachments?: string; // JSON string
}

// Job Roles API
export async function getJobRoles(): Promise<JobRole[]> {
    return pluginGet('pg/job-roles');
}

export async function getJobRole(id: number): Promise<JobRole> {
    return pluginGet(`pg/job-roles/${id}`);
}

export async function createJobRole(data: Partial<JobRole>): Promise<JobRole> {
    return pluginPost('pg/job-roles', data, 'POST');
}

export async function updateJobRole(id: number, data: Partial<JobRole>): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/job-roles/${id}`, data, 'PUT');
}

export async function deleteJobRole(id: number): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/job-roles/${id}`, {}, 'DELETE');
}

// Promotion Criteria API
export async function getPromotionCriteria(jobRoleId?: number): Promise<PromotionCriterion[]> {
    const endpoint = jobRoleId ? `pg/criteria?job_role_id=${jobRoleId}` : 'pg/criteria';
    return pluginGet(endpoint);
}

export async function createPromotionCriterion(data: Partial<PromotionCriterion>): Promise<PromotionCriterion> {
    return pluginPost('pg/criteria', data, 'POST');
}

export async function updatePromotionCriterion(id: number, data: Partial<PromotionCriterion>): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/criteria/${id}`, data, 'PUT');
}

export async function deletePromotionCriterion(id: number): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/criteria/${id}`, {}, 'DELETE');
}

// Team Management API
export async function getTeamMembers(roleId?: number, page?: number, perPage?: number): Promise<TeamMember[]> {
    const params = new URLSearchParams();
    if (roleId) {
        params.append('role_id', roleId.toString());
    }
    if (page) {
        params.append('page', page.toString());
    }
    if (perPage) {
        params.append('per_page', perPage.toString());
    }
    
    const queryString = params.toString();
    const endpoint = `pg/team${queryString ? `?${queryString}` : ''}`;
    
    return pluginGet(endpoint);
}

export interface PaginatedTeamMembersResponse {
    members: TeamMember[];
    total: number;
    total_pages: number;
    page: number;
    per_page: number;
}

export async function getTeamMembersPaginated(roleId?: number, page: number = 1, perPage: number = 25): Promise<PaginatedTeamMembersResponse> {
    const params = new URLSearchParams();
    if (roleId) {
        params.append('role_id', roleId.toString());
    }
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    
    const queryString = params.toString();
    const endpoint = `pg/team${queryString ? `?${queryString}` : ''}`;
    
    // Use the configured apiRoot and nonce from api-service
    const apiRoot = getApiRoot();
    const nonce = getApiNonce();
    
    const response = await fetch(`${apiRoot}mentorship-platform/v1/${endpoint}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
    }
    
    const members = await response.json();
    
    // Extract pagination headers
    const total = parseInt(response.headers.get('X-WP-Total') || '0');
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
    const currentPage = parseInt(response.headers.get('X-WP-Page') || '1');
    const itemsPerPage = parseInt(response.headers.get('X-WP-PerPage') || perPage.toString());
    
    return {
        members,
        total,
        total_pages: totalPages,
        page: currentPage,
        per_page: itemsPerPage,
    };
}

export async function getTeamMemberDetailedProgress(userId: number): Promise<TeamMemberDetailedProgress> {
    return pluginGet(`pg/team/${userId}/detailed-progress`);
}

// NEW: Get lightweight team list (FAST - no progress calculation)
export async function getTeamList(roleId?: number): Promise<TeamMember[]> {
    const endpoint = roleId ? `pg/team/list?role_id=${roleId}` : 'pg/team/list';
    return pluginGet(endpoint);
}

// NEW: Get batch progress for multiple users (much faster than individual calls)
export async function getBatchProgress(userIds: number[], roleId?: number): Promise<Array<{user_id: number, progress: {completed: number, total: number, percentage: number}}>> {
    if (userIds.length === 0) return [];
    const endpoint = roleId 
        ? `pg/team/batch-progress?user_ids=${userIds.join(',')}&role_id=${roleId}`
        : `pg/team/batch-progress?user_ids=${userIds.join(',')}`;
    return pluginGet(endpoint);
}

// WP Roles
export async function getWpRoles(): Promise<WpRole[]> {
    return pluginGet('pg/wp-roles');
}

// User Job Assignments API
export async function getUserAssignments(userId?: number): Promise<UserJobAssignment[]> {
    const endpoint = userId ? `pg/user-assignments?user_id=${userId}` : 'pg/user-assignments';
    return pluginGet(endpoint);
}

export async function getUserAssignment(userId: number): Promise<UserJobAssignment> {
    return pluginGet(`pg/user-assignments/${userId}`);
}

export async function assignUserToRole(data: {
    user_id: number;
    job_role_id: number;
    sync_wp_role?: boolean;
    notes?: string;
}): Promise<{ success: boolean; user_id: number; job_role_id: number; admin_protected: boolean; wp_role_synced: boolean }> {
    return pluginPost('pg/user-assignments', data, 'POST');
}

export async function updateUserAssignment(userId: number, data: {
    job_role_id?: number;
    sync_wp_role?: boolean;
    notes?: string;
}): Promise<{ success: boolean; user_id: number; job_role_id: number }> {
    return pluginPost(`pg/user-assignments/${userId}`, data, 'PUT');
}

export async function deleteUserAssignment(userId: number): Promise<{ success: boolean; user_id: number }> {
    return pluginPost(`pg/user-assignments/${userId}`, {}, 'DELETE');
}

export async function removeAssignment(assignmentId: number): Promise<{ 
    success: boolean; 
    assignment_id: number; 
    user_id: number;
    wp_role_synced: boolean;
}> {
    return pluginPost(`pg/assignments/${assignmentId}`, {}, 'DELETE');
}

// User Progress API
export async function getUserProgress(userId: number, jobRoleId?: number): Promise<UserProgress[]> {
    const endpoint = jobRoleId 
        ? `pg/progress/${userId}?job_role_id=${jobRoleId}`
        : `pg/progress/${userId}`;
    return pluginGet(endpoint);
}

export async function updateUserProgress(data: Partial<UserProgress>): Promise<{ success: boolean; user_id: number; criterion_id: number }> {
    return pluginPost('pg/progress', data, 'POST');
}

// Criterion Activity Log API
export interface CriterionActivity {
    id: number;
    criterion_id: number;
    user_id: number;
    affected_user_id: number;
    user_job_role_id: number | null;
    activity_type: 'note' | 'checkbox_checked' | 'checkbox_unchecked' | 'counter_update' | 'file_upload';
    content: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    edited_at: string | null;
    edited_by: number | null;
    user_name: string;
    user_role: string;
    edited_by_name: string | null;
}

// BATCH: Get activities for multiple criteria at once (performance optimization)
export async function getCriterionActivitiesBatch(
    criterionIds: number[], 
    affectedUserId: number
): Promise<Record<number, CriterionActivity[]>> {
    return pluginPost('pg/criterion/activities-batch', {
        criterion_ids: criterionIds,
        affected_user_id: affectedUserId
    }, 'POST');
}

export async function getCriterionActivities(criterionId: number, affectedUserId: number): Promise<CriterionActivity[]> {
    return pluginGet(`pg/criterion/${criterionId}/activities?affected_user_id=${affectedUserId}`);
}

export async function addCriterionActivity(data: {
    criterion_id: number;
    affected_user_id: number;
    activity_type: 'note' | 'checkbox_checked' | 'checkbox_unchecked' | 'counter_update' | 'file_upload';
    content?: string;
    old_value?: string;
    new_value?: string;
}): Promise<{ success: boolean; activity_id: number }> {
    return pluginPost('pg/criterion/activity', data, 'POST');
}

export async function updateCriterionActivity(activityId: number, content: string): Promise<{ success: boolean; message: string }> {
    return pluginPost(`pg/criterion/activity/${activityId}`, { content }, 'PUT');
}

export async function deleteCriterionActivity(activityId: number): Promise<{ success: boolean; message: string }> {
    return pluginPost(`pg/criterion/activity/${activityId}`, {}, 'DELETE');
}

// In-Service Training API
export async function getInServiceLogs(params?: {
    user_id?: number;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
}): Promise<InServiceLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_archived) queryParams.append('include_archived', '1');
    
    const endpoint = queryParams.toString() ? `pg/inservice?${queryParams}` : 'pg/inservice';
    return pluginGet(endpoint);
}

export async function createInServiceLog(data: {
    training_date: string;
    training_time?: string;
    location?: string;
    duration_hours: number;
    topic: string;
    details?: string;
    leaders?: number[];
    attendees?: number[];
    no_shows?: number[];
    job_roles?: number[];
}): Promise<InServiceLog> {
    return pluginPost('pg/inservice', data, 'POST');
}

export async function updateInServiceLog(id: number, data: {
    training_date?: string;
    training_time?: string;
    location?: string;
    duration_hours?: number;
    topic?: string;
    details?: string;
    leaders?: number[];
    attendees?: number[];
    no_shows?: number[];
    job_roles?: number[];
}): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/inservice/${id}`, data, 'PUT');
}

export async function deleteInServiceLog(id: number): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/inservice/${id}`, {}, 'DELETE');
}

export async function archiveInServiceLog(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/inservice/${id}/archive`, {}, 'PUT');
}

export async function restoreInServiceLog(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/inservice/${id}/restore`, {}, 'PUT');
}

export async function getInServiceSummary(userId: number, month?: string): Promise<InServiceSummary> {
    console.log('=== getInServiceSummary called ===');
    console.log('userId:', userId, 'typeof:', typeof userId);
    console.log('month:', month);
    const endpoint = month 
        ? `pg/inservice/summary/${userId}?month=${month}`
        : `pg/inservice/summary/${userId}`;
    console.log('API endpoint:', endpoint);
    return pluginGet(endpoint);
}

// Batch summary response type
export interface InServiceSummaryBatchUser {
    user_id: number;
    display_name: string;
    job_role_ids: string;
    job_role_titles: string;
    summaries: {
        [month: string]: {
            month: string;
            hours: number;
            required_hours: number;
            meets_requirement: boolean;
        };
    };
}

/**
 * Get in-service training summaries for ALL users in a single request
 * This is a performance optimization to replace making individual getInServiceSummary calls per user
 */
export async function getInServiceSummaryBatch(months: string[]): Promise<InServiceSummaryBatchUser[]> {
    const monthsParam = months.join(',');
    return pluginGet(`pg/inservice/summary-batch?months=${monthsParam}`);
}

export async function getInServiceTeamStats(month: string): Promise<{
    month: string;
    total_hours_offered: number;
    employees_count: number;
    employees_met_requirement: number;
    employees_did_not_meet: number;
}> {
    return pluginGet(`pg/inservice/team-stats?month=${month}`);
}

// Scan Audit API
export async function getScanAudits(params?: {
    audited_user_id?: number;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
}): Promise<AuditLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.audited_user_id) queryParams.append('audited_user_id', params.audited_user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_archived) queryParams.append('include_archived', '1');
    
    const endpoint = queryParams.toString() ? `pg/scan-audits?${queryParams}` : 'pg/scan-audits';
    const results: any[] = await pluginGet(endpoint);
    
    // Convert archived from string to boolean (MySQL returns tinyint as "0" or "1")
    return results.map(audit => ({
        ...audit,
        archived: Boolean(Number(audit.archived))
    }));
}

export async function createScanAudit(data: {
    audited_user_id: number;
    audit_date: string;
    location?: string;
    wearing_correct_uniform?: number;
    attentive_to_zone?: number;
    posture_adjustment_5min?: number;
    result: string;
    notes?: string;
    attachments?: Array<{ url: string; type: string; name: string }>;
}): Promise<AuditLog> {
    return pluginPost('pg/scan-audits', data, 'POST');
}

export async function updateScanAudit(id: number, data: {
    audited_user_id?: number;
    audit_date?: string;
    location?: string;
    wearing_correct_uniform?: number;
    attentive_to_zone?: number;
    posture_adjustment_5min?: number;
    result?: string;
    notes?: string;
    attachments?: Array<{ url: string; type: string; name: string }>;
}): Promise<AuditLog> {
    return pluginPost(`pg/scan-audits/${id}`, data, 'PUT');
}

export async function deleteScanAudit(id: number): Promise<{ success: boolean }> {
    return pluginPost(`pg/scan-audits/${id}`, {}, 'DELETE');
}

export async function archiveScanAudit(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/scan-audits/${id}/archive`, {}, 'PUT');
}

export async function restoreScanAudit(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/scan-audits/${id}/restore`, {}, 'PUT');
}

// Cashier Observational Audit API
export interface CashierAuditLog {
    id: number;
    audited_user_id: number;
    audited_user_name?: string;
    auditor_id: number;
    auditor_name?: string;
    audit_date: string;
    checked_cash_drawer?: string;
    attentive_patrons_entered?: string;
    greeted_with_demeanor?: string;
    one_click_per_person?: string;
    pool_pass_process?: string;
    resolved_patron_concerns?: string;
    notes?: string;
    archived: boolean;
    created_at: string;
    updated_at: string;
}

export async function getCashierAudits(params?: {
    audited_user_id?: number;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
}): Promise<CashierAuditLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.audited_user_id) queryParams.append('audited_user_id', params.audited_user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_archived) queryParams.append('include_archived', '1');
    
    const endpoint = queryParams.toString() ? `pg/cashier-audits?${queryParams}` : 'pg/cashier-audits';
    const results: any[] = await pluginGet(endpoint);
    
    // Convert archived from string to boolean (MySQL returns tinyint as "0" or "1")
    return results.map(audit => ({
        ...audit,
        archived: Boolean(Number(audit.archived))
    }));
}

export async function createCashierAudit(data: {
    audited_user_id: number;
    audit_date: string;
    checked_cash_drawer?: string;
    attentive_patrons_entered?: string;
    greeted_with_demeanor?: string;
    one_click_per_person?: string;
    pool_pass_process?: string;
    resolved_patron_concerns?: string;
    notes?: string;
}): Promise<CashierAuditLog> {
    return pluginPost('pg/cashier-audits', data, 'POST');
}

export async function updateCashierAudit(id: number, data: {
    audited_user_id?: number;
    audit_date?: string;
    checked_cash_drawer?: string;
    attentive_patrons_entered?: string;
    greeted_with_demeanor?: string;
    one_click_per_person?: string;
    pool_pass_process?: string;
    resolved_patron_concerns?: string;
    notes?: string;
}): Promise<CashierAuditLog> {
    return pluginPost(`pg/cashier-audits/${id}`, data, 'PUT');
}

export async function deleteCashierAudit(id: number): Promise<{ success: boolean }> {
    return pluginPost(`pg/cashier-audits/${id}`, {}, 'DELETE');
}

export async function archiveCashierAudit(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/cashier-audits/${id}/archive`, {}, 'PUT');
}

export async function restoreCashierAudit(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/cashier-audits/${id}/restore`, {}, 'PUT');
}

export async function bulkArchiveCashierAudits(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/cashier-audits/bulk-archive', { ids }, 'POST');
}

export async function bulkRestoreCashierAudits(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/cashier-audits/bulk-restore', { ids }, 'POST');
}

// Live Recognition Drill API
export async function getLiveDrills(params?: {
    drilled_user_id?: number;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
}): Promise<AuditLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.drilled_user_id) queryParams.append('drilled_user_id', params.drilled_user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_archived) queryParams.append('include_archived', '1');
    
    const endpoint = queryParams.toString() ? `pg/live-drills?${queryParams}` : 'pg/live-drills';
    const results: any[] = await pluginGet(endpoint);
    
    // Convert archived from string to boolean (MySQL returns tinyint as "0" or "1")
    return results.map(drill => ({
        ...drill,
        archived: Boolean(Number(drill.archived))
    }));
}

export async function createLiveDrill(data: {
    drilled_user_id: number;
    drill_date: string;
    location?: string;
    result: string;
    notes?: string;
}): Promise<AuditLog> {
    return pluginPost('pg/live-drills', data, 'POST');
}

export async function archiveLiveDrill(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/live-drills/${id}/archive`, {}, 'PUT');
}

export async function restoreLiveDrill(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/live-drills/${id}/restore`, {}, 'PUT');
}

export async function updateLiveDrill(id: number, data: {
    drilled_user_id?: number;
    drill_date?: string;
    location?: string;
    result?: string;
    notes?: string;
}): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/live-drills/${id}`, data, 'PUT');
}

export async function deleteLiveDrill(id: number): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/live-drills/${id}`, {}, 'DELETE');
}

// Bulk Operations
export async function bulkArchiveInServiceLogs(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/inservice-logs/bulk-archive', { ids }, 'POST');
}

export async function bulkRestoreInServiceLogs(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/inservice-logs/bulk-restore', { ids }, 'POST');
}

export async function bulkArchiveScanAudits(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/scan-audits/bulk-archive', { ids }, 'POST');
}

export async function bulkRestoreScanAudits(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/scan-audits/bulk-restore', { ids }, 'POST');
}

export async function bulkArchiveLiveDrills(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/live-drills/bulk-archive', { ids }, 'POST');
}

export async function bulkRestoreLiveDrills(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/live-drills/bulk-restore', { ids }, 'POST');
}

// ============================================================================
// Instructor Evaluation API
// ============================================================================

export interface InstructorEvaluationLog {
    id: number;
    evaluated_user_id: number;
    evaluated_user_name?: string;
    evaluator_id: number;
    evaluator_name?: string;
    evaluation_date: string;
    command_language: number;
    minimizing_downtime: number;
    periodic_challenges: number;
    provides_feedback: number;
    rules_expectations: number;
    learning_environment: number;
    comments: string;
    archived: boolean;
    created_at: string;
    updated_at: string;
}

export async function getInstructorEvaluations(params?: {
    evaluated_user_id?: number;
    start_date?: string;
    end_date?: string;
    include_archived?: boolean;
}): Promise<InstructorEvaluationLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.evaluated_user_id) queryParams.append('evaluated_user_id', params.evaluated_user_id.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.include_archived) queryParams.append('include_archived', '1');
    
    const endpoint = queryParams.toString() ? `pg/instructor-evaluations?${queryParams}` : 'pg/instructor-evaluations';
    const results: any[] = await pluginGet(endpoint);
    
    // Convert archived from string to boolean (MySQL returns tinyint as "0" or "1")
    return results.map(evaluation => ({
        ...evaluation,
        archived: Boolean(Number(evaluation.archived))
    }));
}

export async function createInstructorEvaluation(data: {
    evaluated_user_id: number;
    evaluation_date: string;
    command_language: number;
    minimizing_downtime: number;
    periodic_challenges: number;
    provides_feedback: number;
    rules_expectations: number;
    learning_environment: number;
    comments: string;
}): Promise<InstructorEvaluationLog> {
    return pluginPost('pg/instructor-evaluations', data, 'POST');
}

export async function updateInstructorEvaluation(id: number, data: {
    evaluated_user_id?: number;
    evaluation_date?: string;
    command_language?: number;
    minimizing_downtime?: number;
    periodic_challenges?: number;
    provides_feedback?: number;
    rules_expectations?: number;
    learning_environment?: number;
    comments?: string;
}): Promise<{ success: boolean; id: number }> {
    return pluginPost(`pg/instructor-evaluations/${id}`, data, 'PUT');
}

export async function deleteInstructorEvaluation(id: number): Promise<{ success: boolean }> {
    return pluginPost(`pg/instructor-evaluations/${id}`, {}, 'DELETE');
}

export async function archiveInstructorEvaluation(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/instructor-evaluations/${id}/archive`, {}, 'PUT');
}

export async function restoreInstructorEvaluation(id: number): Promise<{ success: boolean; id: number; archived: boolean }> {
    return pluginPost(`pg/instructor-evaluations/${id}/restore`, {}, 'PUT');
}

export async function bulkArchiveInstructorEvaluations(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/instructor-evaluations/bulk-archive', { ids }, 'POST');
}

export async function bulkRestoreInstructorEvaluations(ids: number[]): Promise<{ success: boolean; updated: number }> {
    return pluginPost('pg/instructor-evaluations/bulk-restore', { ids }, 'POST');
}

// ============================================================================
// Compliance Reports API
// ============================================================================

export interface ComplianceReportFilters {
    start_date: string;
    end_date: string;
    include_archived?: boolean;
    force_refresh?: boolean;
}

export interface UserComplianceData {
    user_id: number;
    display_name: string;
    job_role: string;
    participated_count: number;
    participated_pass: number;
    participated_remediation?: number;
    participated_fail: number;
    conducted_count: number;
    attended_count?: number;
    led_count?: number;
    no_show_count?: number;
    target_count: number;
    last_date: string | null;
    // Additional fields for different report types
    last_activity_date?: string;
    hours_attended?: number;
    hours_led?: number;
    sessions_led?: number;
}

export async function getScanAuditComplianceReport(filters: ComplianceReportFilters): Promise<UserComplianceData[]> {
    const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        include_archived: filters.include_archived ? '1' : '0',
        ...(filters.force_refresh ? { refresh: '1' } : {}),
    });
    return pluginGet(`pg/reports/scan-audits?${params.toString()}`);
}

export async function getLiveDrillComplianceReport(filters: ComplianceReportFilters): Promise<UserComplianceData[]> {
    const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        include_archived: filters.include_archived ? '1' : '0',
        ...(filters.force_refresh ? { refresh: '1' } : {}),
    });
    return pluginGet(`pg/reports/live-drills?${params.toString()}`);
}

export async function getInServiceComplianceReport(filters: ComplianceReportFilters): Promise<UserComplianceData[]> {
    const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        include_archived: filters.include_archived ? '1' : '0',
        ...(filters.force_refresh ? { refresh: '1' } : {}),
    });
    return pluginGet(`pg/reports/inservice?${params.toString()}`);
}

// ============================================================================
// Permissions API
// ============================================================================

export interface MyPermissions {
    dailyLogPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    scanAuditPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    liveDrillPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    inservicePermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    cashierAuditPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    taskDeckPermissions?: {
        canView: boolean;
        canViewOnlyAssigned?: boolean;
        canManageAllPrimaryCards?: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
        canManagePrimaryDeck?: boolean;
        canCreatePublicDecks?: boolean;
    };
    instructorEvaluationPermissions?: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
    };
    reportsPermissions?: {
        canViewAllRecords: boolean;
    }
}

/**
 * Get current user's permissions across all Professional Growth modules
 * This endpoint checks both pg_user_job_assignments table and user meta for backwards compatibility
 */
export async function getMyPermissions(): Promise<MyPermissions> {
    return pluginGet('pg/my-permissions');
}
