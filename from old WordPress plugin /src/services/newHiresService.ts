/**
 * New Hires & Onboarding Service
 * 
 * API service layer for new hire management including:
 * - Public application submission
 * - Admin application management
 * - Letter of Intent (LOI) generation and sending
 * - LOI template settings
 */

import {
    NewHire,
    NewHireStatus,
    LOISettings,
    NewHireApplicationData,
    NewHireFilters
} from '../types';

const API_BASE = '/wp-json/mentorship-platform/v1/new-hires';
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

/**
 * Public fetch wrapper (no auth required)
 */
async function publicFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

// ==============================================
// Public Endpoints (No Auth Required)
// ==============================================

/**
 * Submit a new hire application (public form)
 */
export async function submitApplication(data: NewHireApplicationData): Promise<{ success: boolean; message: string; application_id?: number }> {
    return publicFetch('/apply', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Get available positions for the application form
 */
export async function getPositions(): Promise<{ positions: string[] }> {
    return publicFetch('/positions');
}

/**
 * Organization info for form header (public)
 */
export interface OrganizationInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    header_image: string;
    sender_name: string;
    sender_title: string;
}

/**
 * Get organization info for the application form header (public)
 */
export async function getOrganizationInfo(): Promise<{ organization: OrganizationInfo }> {
    return publicFetch('/organization-info');
}

// ==============================================
// Admin Endpoints (Auth Required)
// ==============================================

/**
 * Get all new hire applications with optional filters
 */
export async function getApplications(filters?: NewHireFilters): Promise<{ applications: NewHire[] }> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') {
        params.append('status', filters.status);
    }
    if (filters?.needs_work_permit !== undefined && filters.needs_work_permit !== 'all') {
        params.append('needs_work_permit', filters.needs_work_permit ? '1' : '0');
    }
    if (filters?.is_archived !== undefined) {
        if (filters.is_archived === 'all') {
            params.append('is_archived', 'all');
        } else {
            params.append('is_archived', filters.is_archived ? '1' : '0');
        }
    }
    if (filters?.search) {
        params.append('search', filters.search);
    }
    
    const queryString = params.toString();
    return apiFetch(`${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single application by ID
 */
export async function getApplication(id: number): Promise<{ application: NewHire }> {
    return apiFetch(`/${id}`);
}

/**
 * Admin-created new hire entry (bypasses honeypot & rate limiting)
 */
export async function adminCreateApplication(data: Omit<NewHireApplicationData, 'honeypot'>): Promise<{ success: boolean; message: string; id?: number }> {
    return apiFetch('/admin-create', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Update application status (approve/reject)
 * @param id - Application ID
 * @param status - New status
 * @param createUser - Whether to create a WP user (default true)
 * @param addAsMember - Whether to add the user as a member when approved (default true)
 */
export async function updateApplicationStatus(
    id: number, 
    status: NewHireStatus, 
    createUser: boolean = true,
    addAsMember: boolean = true
): Promise<{ success: boolean; message: string; wp_user_id?: number }> {
    return apiFetch(`/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, create_user: createUser, add_as_member: addAsMember }),
    });
}

/**
 * Delete an application
 */
export async function deleteApplication(id: number): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/${id}`, {
        method: 'DELETE',
    });
}

/**
 * Bulk archive or unarchive applications
 */
export async function bulkArchiveApplications(
    ids: number[], 
    archive: boolean = true
): Promise<{ success: boolean; message: string; count: number }> {
    return apiFetch('/bulk-archive', {
        method: 'POST',
        body: JSON.stringify({ ids, archive }),
    });
}

// ==============================================
// Letter of Intent (LOI) Endpoints
// ==============================================

/**
 * Get LOI template settings
 */
export async function getLOISettings(): Promise<{ settings: LOISettings }> {
    return apiFetch('/loi-settings');
}

/**
 * Update LOI template settings
 */
export async function updateLOISettings(settings: Partial<LOISettings>): Promise<{ success: boolean; message: string }> {
    return apiFetch('/loi-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

/**
 * Preview LOI content for a specific application
 */
export async function previewLOI(applicationId: number): Promise<{ html: string; preview_data: Record<string, string> }> {
    return apiFetch(`/${applicationId}/loi-preview`);
}

/**
 * Send LOI email to applicant
 */
export async function sendLOI(applicationId: number): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/${applicationId}/send-loi`, {
        method: 'POST',
    });
}

// ==============================================
// Notification Settings Endpoints
// ==============================================

/**
 * Job Role for notification settings
 * Note: These are AquaticPro plugin job roles (from pg_job_roles table),
 * not WordPress user roles.
 */
export interface WPRole {
    slug: string;  // The job role ID as a string
    name: string;  // The job role title
    tier?: number; // Optional tier level
}

export interface NotificationUser {
    id: number;
    name: string;
    email: string;
}

/**
 * Get job roles for notification picker
 * Returns AquaticPro plugin job roles (not WordPress roles)
 */
export async function getWPRoles(): Promise<{ roles: WPRole[] }> {
    return apiFetch('/wp-roles');
}

/**
 * Get users for notification picker
 */
export async function getNotificationUsers(): Promise<{ users: NotificationUser[] }> {
    return apiFetch('/notification-users');
}

// ==============================================
// Utility Functions
// ==============================================

/**
 * Format a new hire's full name
 */
export function formatName(hire: NewHire): string {
    return `${hire.first_name} ${hire.last_name}`;
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: NewHireStatus): string {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'approved':
            return 'bg-green-100 text-green-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Get status display text
 */
export function getStatusText(status: NewHireStatus): string {
    switch (status) {
        case 'pending':
            return 'Pending Review';
        case 'approved':
            return 'Approved';
        case 'rejected':
            return 'Rejected';
        default:
            return status;
    }
}

/**
 * Check if LOI can be sent for an application
 */
export function canSendLOI(hire: NewHire): boolean {
    return hire.status === 'approved' && hire.needs_work_permit && !hire.loi_sent;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? new Date(dateString + 'T00:00:00') : new Date(dateString);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Format date with time for display
 */
export function formatDateTime(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? new Date(dateString + 'T00:00:00') : new Date(dateString);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default {
    // Public
    submitApplication,
    getPositions,
    // Admin
    getApplications,
    getApplication,
    adminCreateApplication,
    updateApplicationStatus,
    deleteApplication,
    bulkArchiveApplications,
    // LOI / Settings
    getLOISettings,
    updateLOISettings,
    previewLOI,
    sendLOI,
    // Notification settings
    getWPRoles,
    getNotificationUsers,
    // Utilities
    formatName,
    getStatusColor,
    getStatusText,
    canSendLOI,
    formatDate,
    formatDateTime,
};
