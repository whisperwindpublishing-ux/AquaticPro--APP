/**
 * Seasonal Returns & Pay Management Service
 * 
 * API service layer for all SRM functionality including:
 * - Pay configuration management
 * - Employee pay calculations
 * - Season management
 * - Return intent collection
 * - Email templates
 * - Retention statistics
 */

import {
    PayConfig,
    Season,
    EmployeeSeason,
    EmailTemplate,
    RetentionStats,
    EmployeePayData,
    PayBreakdown,
    ProjectedPayBreakdown,
    ReturnFormData,
    SRMPermissions,
    SRMRolePermissions
} from '../types';

const API_BASE = '/wp-json/mentorship-platform/v1/srm';
const NONCE = () => (window as any).mentorshipPlatformData?.nonce || '';

/**
 * Generic fetch wrapper with authentication
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': NONCE(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

// ============================================
// PERMISSIONS
// ============================================

export async function getMyPermissions(): Promise<SRMPermissions> {
    const data = await apiFetch<{ success: boolean; permissions: SRMPermissions; debug?: any }>('/my-permissions');
    console.log('📊 SRM API Response:', data);
    if (data.debug) {
        console.log('🐛 Debug Info:', data.debug);
    }
    return data.permissions;
}

export async function getAllRolePermissions(): Promise<SRMRolePermissions[]> {
    const data = await apiFetch<{ success: boolean; permissions: SRMRolePermissions[] }>('/permissions');
    return data.permissions;
}

export async function updateRolePermissions(roleId: number, permissions: Partial<SRMPermissions>): Promise<void> {
    await apiFetch(`/permissions/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify(permissions)
    });
}

// ============================================
// PAY CONFIGURATION
// ============================================

export async function getPayConfig(type?: string): Promise<PayConfig[]> {
    const endpoint = type ? `/pay-config?type=${type}` : '/pay-config';
    const data = await apiFetch<{ config: PayConfig[] }>(endpoint);
    return data.config;
}

export async function createPayConfig(config: Partial<PayConfig>): Promise<number> {
    const data = await apiFetch<{ id: number }>('/pay-config', {
        method: 'POST',
        body: JSON.stringify(config)
    });
    return data.id;
}

export async function updatePayConfig(id: number, config: Partial<PayConfig>): Promise<void> {
    await apiFetch(`/pay-config/${id}`, {
        method: 'PUT',
        body: JSON.stringify(config)
    });
}

export async function deletePayConfig(id: number): Promise<void> {
    await apiFetch(`/pay-config/${id}`, {
        method: 'DELETE'
    });
}

// ============================================
// EMPLOYEE PAY CALCULATIONS
// ============================================

export async function getAllEmployeePay(): Promise<EmployeePayData[]> {
    const data = await apiFetch<{ employees: EmployeePayData[] }>('/employees/pay');
    return data.employees;
}

export async function getEmployeePay(userId: number): Promise<{ user_id: number; display_name: string; pay_breakdown: PayBreakdown }> {
    return await apiFetch<{ user_id: number; display_name: string; pay_breakdown: PayBreakdown }>(`/employees/${userId}/pay`);
}

export async function getProjectedPay(
    userId: number,
    seasonId?: number,
    roleOverride?: number[]
): Promise<{ user_id: number; projected_pay: ProjectedPayBreakdown }> {
    const params = new URLSearchParams();
    if (seasonId) params.append('season_id', seasonId.toString());
    if (roleOverride) params.append('role_override', JSON.stringify(roleOverride));
    
    const endpoint = `/employees/${userId}/pay/projected${params.toString() ? '?' + params.toString() : ''}`;
    return await apiFetch<{ user_id: number; projected_pay: ProjectedPayBreakdown }>(endpoint);
}

// ============================================
// BULK EMPLOYEE UPDATES
// ============================================

export interface BulkUpdateResult {
    success: boolean;
    success_count: number;
    failed_count: number;
    errors: string[];
    message: string;
}

export async function bulkUpdateEmployees(
    userIds: number[],
    action: 'longevity' | 'job_role' | 'remove_role',
    value: number | number[]
): Promise<BulkUpdateResult> {
    return await apiFetch<BulkUpdateResult>('/employees/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
            user_ids: userIds,
            action,
            value
        })
    });
}

// ============================================
// SEASON MANAGEMENT
// ============================================

export async function getSeasons(): Promise<Season[]> {
    const data = await apiFetch<{ seasons: Season[] }>('/seasons');
    return data.seasons || [];
}

export async function createSeason(season: Partial<Season>): Promise<number> {
    const data = await apiFetch<{ id: number }>('/seasons', {
        method: 'POST',
        body: JSON.stringify(season)
    });
    return data.id;
}

export async function updateSeason(id: number, season: Partial<Season>): Promise<void> {
    await apiFetch(`/seasons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(season)
    });
}

export async function deleteSeason(id: number): Promise<void> {
    await apiFetch(`/seasons/${id}`, {
        method: 'DELETE'
    });
}

export async function getSeasonStats(seasonId: number): Promise<RetentionStats> {
    const data = await apiFetch<{ stats: RetentionStats }>(`/seasons/${seasonId}/stats`);
    return data.stats;
}

// ============================================
// RETURN INTENT MANAGEMENT
// ============================================

export async function sendBatchInvites(
    userIds: number[],
    seasonId: number,
    templateId: number
): Promise<{ sent_count: number; total: number; errors: string[] }> {
    return await apiFetch<{ sent_count: number; total: number; errors: string[] }>('/invite/batch', {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds, season_id: seasonId, template_id: templateId })
    });
}

export async function sendFollowUps(
    userIds: number[],
    seasonId: number,
    templateId: number,
    followUpNumber: number = 1
): Promise<{ sent_count: number; total: number; errors: string[] }> {
    return await apiFetch<{ sent_count: number; total: number; errors: string[] }>('/follow-up/batch', {
        method: 'POST',
        body: JSON.stringify({
            user_ids: userIds,
            season_id: seasonId,
            template_id: templateId,
            follow_up_number: followUpNumber
        })
    });
}

export interface JobRoleSummaryItem {
    role_id: number;
    role_title: string;
    returning: number;
    not_returning: number;
    pending: number;
    ineligible: number;
    total: number;
}

export interface ResponsesWithSummary {
    responses: EmployeeSeason[];
    job_role_summary: JobRoleSummaryItem[];
}

/**
 * Export responses as CSV with projected pay rates.
 * Returns the raw CSV string + suggested filename for download.
 */
export async function exportResponsesCsv(
    seasonId: number
): Promise<{ csv: string; filename: string }> {
    const data = await apiFetch<{ csv: string; filename: string }>(
        `/responses/export?season_id=${seasonId}`
    );
    return data;
}

export async function getResponses(
    seasonId?: number,
    status?: string
): Promise<EmployeeSeason[]> {
    const params = new URLSearchParams();
    if (seasonId) params.append('season_id', seasonId.toString());
    if (status) params.append('status', status);
    
    // Add cache busting timestamp
    params.append('_t', Date.now().toString());
    
    const endpoint = `/responses${params.toString() ? '?' + params.toString() : ''}`;
    const data = await apiFetch<{ responses: EmployeeSeason[]; job_role_summary?: JobRoleSummaryItem[] }>(endpoint);
    return data.responses;
}

export async function getResponsesWithRoleSummary(
    seasonId?: number,
    status?: string
): Promise<ResponsesWithSummary> {
    const params = new URLSearchParams();
    if (seasonId) params.append('season_id', seasonId.toString());
    if (status) params.append('status', status);
    
    // Add cache busting timestamp
    params.append('_t', Date.now().toString());
    
    const endpoint = `/responses${params.toString() ? '?' + params.toString() : ''}`;
    const data = await apiFetch<{ responses: EmployeeSeason[]; job_role_summary: JobRoleSummaryItem[] }>(endpoint);
    return {
        responses: data.responses,
        job_role_summary: data.job_role_summary || [],
    };
}

export async function getEmployeeSeasons(userId: number): Promise<EmployeeSeason[]> {
    const data = await apiFetch<{ seasons: EmployeeSeason[] }>(`/employees/${userId}/seasons`);
    return data.seasons;
}

export async function updateEmployeeStatus(
    userId: number,
    seasonId: number,
    updates: Partial<EmployeeSeason>
): Promise<void> {
    await apiFetch(`/employees/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, season_id: seasonId })
    });
}

export async function bulkActivateReturning(seasonId: number): Promise<{ activated_count: number; message: string }> {
    const response = await fetch(`${API_BASE}/bulk/activate-returning`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: seasonId })
    });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Failed to activate returning employees');
    }
    
    return data;
}

export async function advanceLongevity(options?: { 
    onlyReturning?: boolean; 
    seasonId?: number;
    addYear?: number;  // New: add specific year to work history
    userIds?: number[];  // Filter to specific users
}): Promise<{ updated_count: number; skipped_count: number; message: string }> {
    const response = await fetch(`${API_BASE}/longevity/advance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE() },
        body: JSON.stringify({ 
            only_returning: options?.onlyReturning ?? false,
            season_id: options?.seasonId,
            add_year: options?.addYear,
            user_ids: options?.userIds
        })
    });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Failed to advance longevity');
    }
    
    return data;
}

export async function removeWorkYearBulk(removeYear: number, userIds?: number[]): Promise<{ removed_count: number; message: string }> {
    const response = await fetch(`${API_BASE}/longevity/remove-year`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': NONCE() },
        body: JSON.stringify({ 
            remove_year: removeYear,
            user_ids: userIds
        })
    });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Failed to remove work year');
    }
    
    return data;
}

// ============================================
// PUBLIC RETURN FORM (NO AUTH)
// ============================================

export async function getReturnFormData(token: string): Promise<{ data: ReturnFormData; already_submitted: boolean }> {
    const response = await fetch(`${API_BASE}/return-form/${token}`, {
        credentials: 'omit', // Prevent WP auth cookie interference on public endpoint
        headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Invalid or expired link');
    }
    
    return data;
}

export async function submitReturnIntent(
    token: string,
    isReturning: boolean,
    signature: string,
    comments?: string
): Promise<{ success: boolean; status: string; message: string }> {
    const response = await fetch(`${API_BASE}/return-form/${token}`, {
        method: 'POST',
        credentials: 'omit', // Prevent WP auth cookie interference on public endpoint
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            is_returning: isReturning,
            signature,
            comments
        })
    });
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'Failed to submit response');
    }
    
    return data;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export async function getTemplates(): Promise<EmailTemplate[]> {
    const data = await apiFetch<{ templates: EmailTemplate[] }>('/templates');
    return data.templates;
}

export async function createTemplate(template: Partial<EmailTemplate>): Promise<number> {
    const data = await apiFetch<{ id: number }>('/templates', {
        method: 'POST',
        body: JSON.stringify(template)
    });
    
    return data.id;
}

export async function updateTemplate(id: number, template: Partial<EmailTemplate>): Promise<void> {
    await apiFetch(`/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(template)
    });
}

export async function deleteTemplate(id: number): Promise<void> {
    await apiFetch(`/templates/${id}`, {
        method: 'DELETE'
    });
}

export async function previewTemplate(
    templateId: number,
    userId: number,
    seasonId: number
): Promise<{ subject: string; body: string; token: string; form_link: string }> {
    const data = await apiFetch<{ preview: { subject: string; body: string; token: string; form_link: string } }>('/templates/preview', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, user_id: userId, season_id: seasonId })
    });
    
    return data.preview;
}

// ============================================
// RETENTION DASHBOARD
// ============================================

export async function getRetentionHistory(limit: number = 5): Promise<RetentionStats[]> {
    const data = await apiFetch<{ history: RetentionStats[] }>(`/retention/history?limit=${limit}`);
    return data.history;
}

export async function saveRetentionSnapshot(seasonId: number): Promise<void> {
    await apiFetch('/retention/snapshot', {
        method: 'POST',
        body: JSON.stringify({ season_id: seasonId })
    });
}

// ============================================
// LONGEVITY RATES BY YEAR
// ============================================

export interface LongevityRate {
    id: number;
    work_year: number;
    rate: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export async function getLongevityRates(): Promise<LongevityRate[]> {
    const data = await apiFetch<{ success: boolean; rates: LongevityRate[] }>('/longevity-rates');
    return data.rates;
}

export async function upsertLongevityRate(
    work_year: number,
    rate: number,
    notes?: string
): Promise<{ id: number; updated: boolean }> {
    return await apiFetch<{ success: boolean; id: number; updated: boolean }>('/longevity-rates', {
        method: 'POST',
        body: JSON.stringify({ work_year, rate, notes })
    });
}

export async function deleteLongevityRate(id: number): Promise<void> {
    await apiFetch(`/longevity-rates/${id}`, {
        method: 'DELETE'
    });
}

export async function bulkUpsertLongevityRates(
    rates: Array<{ work_year: number; rate: number; notes?: string }>
): Promise<{ success: boolean; updated_count: number }> {
    return await apiFetch<{ success: boolean; updated_count: number }>('/longevity-rates/bulk', {
        method: 'POST',
        body: JSON.stringify({ rates })
    });
}

// ============================================
// EMPLOYEE WORK YEARS
// ============================================

export interface EmployeeWorkYear {
    id: number;
    user_id: number;
    display_name: string | null;
    work_year: number;
    verified: number;
    verified_by: number | null;
    verified_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export async function getEmployeeWorkYears(userId?: number): Promise<EmployeeWorkYear[]> {
    const endpoint = userId ? `/employee-work-years?user_id=${userId}` : '/employee-work-years';
    const data = await apiFetch<{ success: boolean; work_years: EmployeeWorkYear[] }>(endpoint);
    return data.work_years;
}

export async function addEmployeeWorkYear(
    userId: number,
    workYear: number,
    notes?: string
): Promise<{ id: number }> {
    return await apiFetch<{ success: boolean; id: number }>('/employee-work-years', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, work_year: workYear, notes })
    });
}

export async function deleteEmployeeWorkYear(id: number): Promise<void> {
    await apiFetch(`/employee-work-years/${id}`, {
        method: 'DELETE'
    });
}

export async function verifyWorkYear(id: number): Promise<void> {
    await apiFetch(`/employee-work-years/${id}/verify`, {
        method: 'POST'
    });
}

// ============================================
// LONGEVITY BONUS CALCULATION
// ============================================

export interface LongevityBreakdown {
    year: number;
    rate: number;
    reason: string | null;
}

export interface CalculatedLongevity {
    user_id: number;
    total_bonus: number;
    years_counted?: number;
    work_years: number[];
    breakdown: LongevityBreakdown[];
    year_details?: Array<{ year: number; rate: number; reason?: string | null }>;
    message?: string;
    needs_migration?: boolean;
}

export async function calculateLongevityBonus(userId: number): Promise<CalculatedLongevity> {
    const data = await apiFetch<{ success: boolean } & CalculatedLongevity>(`/longevity/calculate/${userId}`);
    return data;
}

// ============================================
// LONGEVITY MIGRATION
// ============================================

export interface MigrationResult {
    user_id: number;
    display_name: string;
    longevity_years: number;
    existing_years: number;
    years_to_create: number[];
}

export interface MigrationResponse {
    success: boolean;
    dry_run: boolean;
    users_processed: number;
    years_created: number;
    years_would_create?: number;
    results: MigrationResult[];
    message: string;
}

export async function migrateWorkYears(
    dryRun: boolean = true,
    startYear?: number
): Promise<MigrationResponse> {
    return await apiFetch<MigrationResponse>('/longevity/migrate', {
        method: 'POST',
        body: JSON.stringify({ dry_run: dryRun, start_year: startYear || new Date().getFullYear() })
    });
}

// ============================================
// LONGEVITY SETTINGS
// ============================================

export interface LongevitySettings {
    anniversary_year_mode: 'season' | 'anniversary' | 'fixed_date';
    anniversary_date?: string; // MM-DD format for fixed_date mode
}

export async function getLongevitySettings(): Promise<LongevitySettings> {
    const data = await apiFetch<{ success: boolean; settings: LongevitySettings }>('/longevity/settings');
    return data.settings;
}

export async function updateLongevitySettings(settings: Partial<LongevitySettings>): Promise<LongevitySettings> {
    const data = await apiFetch<{ success: boolean; settings: LongevitySettings }>('/longevity/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
    return data.settings;
}

// ============================================
// BULK VOID INVITES
// ============================================

export async function bulkVoidInvites(params: {
    invite_ids?: number[];
    user_ids?: number[];
    season_id?: number;
}): Promise<{ success: boolean; voided_count: number; message: string }> {
    return await apiFetch<{ success: boolean; voided_count: number; message: string }>('/invites/bulk-void', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}

// ============================================
// MY RETURNS — Employee self-service
// ============================================

export interface MyReturnSeason {
    id: number;
    user_id: number;
    season_id: number;
    status: string; // 'pending' | 'returning' | 'not_returning' | 'ineligible'
    eligible_for_rehire: boolean;
    response_date: string | null;
    longevity_years: number;
    comments: string | null;
    signature_text: string | null;
    created_at: string;
    updated_at: string;
    // Season data
    season_name: string;
    year: number;
    season_type: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    is_active: boolean;
}

export interface MyReturnsData {
    seasons: MyReturnSeason[];
    job_roles: Array<{ id: number; title: string; tier: number }>;
    pay_breakdown: PayBreakdown | null;
}

export async function getMyReturns(): Promise<MyReturnsData> {
    const data = await apiFetch<{ success: boolean; seasons: MyReturnSeason[]; job_roles: Array<{ id: number; title: string; tier: number }>; pay_breakdown: PayBreakdown | null }>('/my-returns');
    return {
        seasons: data.seasons || [],
        job_roles: data.job_roles || [],
        pay_breakdown: data.pay_breakdown || null,
    };
}
