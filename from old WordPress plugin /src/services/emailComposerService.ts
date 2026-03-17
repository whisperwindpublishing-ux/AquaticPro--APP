/**
 * Email Composer API Service
 *
 * Client-side service for the custom email composer module.
 * Handles sending emails, managing templates, and fetching users/roles.
 */

import { pluginGet, pluginPost } from './api-service';

// ============================================
// TYPES
// ============================================

export interface EmailRecipientUser {
    id: number;
    name: string;
    email: string;
    archived: boolean;
    jobRoles?: { id: number; title: string; tier: number }[];
}

export interface EmailRole {
    id: number;
    title: string;
    tier: number;
    userCount: number;
}

export interface EmailTemplate {
    id: number;
    name: string;
    subject: string;
    bodyJson: string | null;
    bodyHtml: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface SendEmailPayload {
    subject: string;
    bodyHtml: string;
    bodyJson?: string;
    userIds: number[];
    roleIds: number[];
    seasonId?: number | null;
    returnStatus?: string | null;
}

export interface SendEmailResult {
    success: boolean;
    sentCount: number;
    failedCount: number;
    totalRecipients: number;
}

export interface PreviewRecipientsResult {
    totalCount: number;
    recipients: { id: number; name: string; email: string; archived: boolean }[];
}

export interface EmailHistoryEntry {
    id: number;
    subject: string;
    recipientCount: number;
    sentBy: string;
    sentAt: string;
    recipientSummary: string[];
}

export interface EmailSeason {
    id: number;
    name: string;
    year: number;
    isActive: boolean;
    isCurrent: boolean;
}

// ============================================
// API CALLS
// ============================================

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
    return pluginPost('email-composer/send', payload) as Promise<SendEmailResult>;
}

export async function previewRecipients(
    userIds: number[],
    roleIds: number[],
    seasonId?: number | null,
    returnStatus?: string | null,
): Promise<PreviewRecipientsResult> {
    const payload: Record<string, any> = { userIds, roleIds };
    if (seasonId) payload.seasonId = seasonId;
    if (returnStatus) payload.returnStatus = returnStatus;
    return pluginPost('email-composer/preview-recipients', payload) as Promise<PreviewRecipientsResult>;
}

export async function getEmailUsers(includeArchived = false, search = ''): Promise<EmailRecipientUser[]> {
    let endpoint = `email-composer/users?include_archived=${includeArchived}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    return pluginGet(endpoint) as Promise<EmailRecipientUser[]>;
}

export async function getEmailRoles(): Promise<EmailRole[]> {
    return pluginGet('email-composer/roles') as Promise<EmailRole[]>;
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
    return pluginGet('email-composer/templates') as Promise<EmailTemplate[]>;
}

export async function createEmailTemplate(data: { name: string; subject: string; bodyJson?: string; bodyHtml?: string }): Promise<{ id: number; success: boolean }> {
    return pluginPost('email-composer/templates', data) as Promise<{ id: number; success: boolean }>;
}

export async function updateEmailTemplate(id: number, data: Partial<{ name: string; subject: string; bodyJson: string; bodyHtml: string }>): Promise<{ success: boolean }> {
    return pluginPost(`email-composer/templates/${id}`, data, 'PUT') as Promise<{ success: boolean }>;
}

export async function deleteEmailTemplate(id: number): Promise<{ deleted: boolean }> {
    return pluginPost(`email-composer/templates/${id}`, {}, 'DELETE') as Promise<{ deleted: boolean }>;
}

export async function getEmailHistory(): Promise<EmailHistoryEntry[]> {
    return pluginGet('email-composer/history') as Promise<EmailHistoryEntry[]>;
}

export async function getEmailSeasons(): Promise<{ seasons: EmailSeason[]; available: boolean }> {
    return pluginGet('email-composer/seasons') as Promise<{ seasons: EmailSeason[]; available: boolean }>;
}
