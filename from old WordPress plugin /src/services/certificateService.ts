/**
 * Certificate Tracking API Service
 *
 * Client-side service for the certificate tracking module.
 * Handles CRUD for certificate types, user records, bulk operations,
 * approval workflows, permissions, and self-service endpoints.
 */

import { pluginGet, pluginPost, pluginUpload } from './api-service';

// ============================================
// TYPES
// ============================================

export interface CertificateType {
    id: number;
    name: string;
    description: string;
    defaultExpiryMonths: number | null; // null = never expires
    trainingLink: string;
    emailAlertsEnabled: boolean;
    isActive: boolean;
    sortOrder: number;
}

export interface CertificateTypePayload {
    name: string;
    description?: string;
    defaultExpiryMonths?: number | null;
    trainingLink?: string;
    emailAlertsEnabled?: boolean;
    isActive?: boolean;
    sortOrder?: number;
}

export interface UserCertificate {
    id: number;
    userId: number;
    userName: string;
    userFirstName: string;
    userLastName: string;
    userEmail: string;
    isArchived: boolean;
    certificateTypeId: number;
    certificateName: string;
    trainingDate: string | null;
    expirationDate: string | null;
    fileAttachmentId: number | null;
    fileUrl: string;
    status: CertificateStatus;
    notes: string;
    uploadedBy: number | null;
    uploadedByName: string;
    approvedBy: number | null;
    approvedByName: string;
    approvedAt: string | null;
    trainingLink: string;
    defaultExpiryMonths: number | null;
    emailAlertsEnabled: boolean;
}

export type CertificateStatus = 'valid' | 'expired' | 'expiring_soon' | 'pending_review' | 'missing';

export interface RoleRequirement {
    id: number;
    certificateTypeId: number;
    jobRoleId: number;
}

export interface CertPermissions {
    canViewAll: boolean;
    canEditRecords: boolean;
    canManageTypes: boolean;
    canApproveUploads: boolean;
    canBulkEdit: boolean;
}

export interface RolePermission {
    roleId: number;
    roleTitle: string;
    roleTier: number;
    canViewAll: boolean;
    canEditRecords: boolean;
    canManageTypes: boolean;
    canApproveUploads: boolean;
    canBulkEdit: boolean;
}

export interface CertAlerts {
    expired: UserCertificate[];
    expiringSoon: UserCertificate[];
    missing: UserCertificate[];
    pendingReview: UserCertificate[];
}

export interface BulkAssignPayload {
    certificateTypeId: number;
    userIds: number[];
    roleIds?: number[];
}

export interface BulkUpdatePayload {
    certificateTypeId: number;
    userIds: number[];
    trainingDate?: string | null;
    expirationDate?: string | null;
}

export interface BulkResult {
    success: boolean;
    created?: number;
    updated?: number;
    skipped?: number;
    message: string;
}

// ============================================
// PERMISSIONS
// ============================================

export async function getMyPermissions(): Promise<CertPermissions> {
    return pluginGet('certificates/my-permissions');
}

export async function getAllPermissions(): Promise<{ roles: RolePermission[] }> {
    return pluginGet('certificates/permissions');
}

export async function updateRolePermissions(
    roleId: number,
    perms: Partial<Omit<RolePermission, 'roleId' | 'roleTitle' | 'roleTier'>>
): Promise<{ success: boolean }> {
    return pluginPost(`certificates/permissions/${roleId}`, perms, 'PUT');
}

// ============================================
// CERTIFICATE TYPES
// ============================================

export async function getCertificateTypes(): Promise<CertificateType[]> {
    return pluginGet('certificates/types');
}

export async function createCertificateType(payload: CertificateTypePayload): Promise<{ success: boolean; id: number }> {
    return pluginPost('certificates/types', payload);
}

export async function updateCertificateType(id: number, payload: Partial<CertificateTypePayload>): Promise<{ success: boolean }> {
    return pluginPost(`certificates/types/${id}`, payload, 'PUT');
}

export async function deleteCertificateType(id: number): Promise<{ success: boolean }> {
    return pluginPost(`certificates/types/${id}`, {}, 'DELETE');
}

// ============================================
// ROLE REQUIREMENTS
// ============================================

export async function getRoleRequirements(): Promise<RoleRequirement[]> {
    return pluginGet('certificates/role-requirements');
}

export async function saveRoleRequirements(
    certificateTypeId: number,
    roleIds: number[]
): Promise<{ success: boolean; synced: boolean }> {
    return pluginPost('certificates/role-requirements', { certificateTypeId, roleIds });
}

// ============================================
// USER CERTIFICATE RECORDS
// ============================================

export async function getCertificateRecords(params?: {
    certificate_type_id?: number;
    status?: CertificateStatus;
    user_id?: number;
}): Promise<UserCertificate[]> {
    const query = new URLSearchParams();
    if (params?.certificate_type_id) query.set('certificate_type_id', String(params.certificate_type_id));
    if (params?.status) query.set('status', params.status);
    if (params?.user_id) query.set('user_id', String(params.user_id));
    const qs = query.toString();
    return pluginGet(`certificates/records${qs ? '?' + qs : ''}`);
}

export async function getUserCertificates(userId: number): Promise<UserCertificate[]> {
    return pluginGet(`certificates/users/${userId}`);
}

export async function updateCertificateRecord(
    id: number,
    data: {
        trainingDate?: string | null;
        expirationDate?: string | null;
        fileAttachmentId?: number | null;
        fileUrl?: string;
        notes?: string;
    }
): Promise<{ success: boolean }> {
    return pluginPost(`certificates/records/${id}`, data, 'PUT');
}

// ============================================
// APPROVAL WORKFLOW
// ============================================

export async function approveCertificateRecord(id: number): Promise<{ success: boolean }> {
    return pluginPost(`certificates/records/${id}/approve`, {});
}

export async function rejectCertificateRecord(id: number, reason?: string): Promise<{ success: boolean }> {
    return pluginPost(`certificates/records/${id}/reject`, { reason });
}

export async function getPendingCount(): Promise<{ count: number }> {
    return pluginGet('certificates/pending-count');
}

// ============================================
// BULK OPERATIONS
// ============================================

export async function bulkAssign(payload: BulkAssignPayload): Promise<BulkResult> {
    return pluginPost('certificates/bulk-assign', payload);
}

export async function bulkUpdate(payload: BulkUpdatePayload): Promise<BulkResult> {
    return pluginPost('certificates/bulk-update', payload);
}

// ============================================
// SELF-SERVICE (current user)
// ============================================

export async function getMyCertificates(): Promise<UserCertificate[]> {
    return pluginGet('certificates/my-certificates');
}

export async function updateMyCertificate(
    id: number,
    data: {
        trainingDate?: string | null;
        expirationDate?: string | null;
        fileAttachmentId?: number | null;
        fileUrl?: string;
        notes?: string;
    }
): Promise<{ success: boolean }> {
    return pluginPost(`certificates/my-certificates/${id}`, data, 'PUT');
}

export async function getMyAlerts(): Promise<CertAlerts> {
    return pluginGet('certificates/my-alerts');
}

// ============================================
// FILE UPLOAD
// ============================================

export interface UploadedFile {
    id: string;
    fileName: string;
    fileType: string;
    url: string;
}

/**
 * Upload a certificate file via the existing /upload endpoint.
 * Returns the WP attachment id and URL so they can be saved on the record.
 */
export async function uploadCertificateFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);
    return pluginUpload('upload', formData);
}
