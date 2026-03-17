import { pluginGet, pluginPost } from './api-service';

export interface UserMetadata {
    user_id: number;
    display_name: string;
    user_email?: string;
    user_registered?: string;
    phone_number?: string;
    employee_id?: string;
    hire_date?: string;
    notes?: string;
    archived?: boolean;
    archived_date?: string;
    eligible_for_rehire?: boolean;
    is_member?: boolean | null; // true = employee, false = site user, null = auto-detect
    job_role_id?: number;
    job_role_ids?: string; // Comma-separated list of role IDs
    job_role_title?: string; // Can be single title or comma-separated titles
    job_role_titles?: string; // Comma-separated list of all role titles
    tier?: number; // Highest tier
    last_login?: string;
    first_name?: string;
    last_name?: string;
    is_new_hire?: boolean | number | string;
    address?: string;
}

export interface PaginatedUsersResponse {
    users: UserMetadata[];
    total: number;
    total_pages: number;
    page: number;
    per_page: number;
}

export interface CreateUserData {
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    employee_id?: string;
    hire_date?: string;
    notes?: string;
    eligible_for_rehire?: boolean;
    job_role_id?: number;
    send_email?: boolean;
    address?: string;
    is_new_hire?: boolean;
}

export interface UpdateUserData {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
    employee_id?: string;
    hire_date?: string;
    notes?: string;
    wp_role?: string;
    job_role_id?: number;
    address?: string;
    is_new_hire?: boolean;
    eligible_for_rehire?: boolean;
}

export interface BulkImportResult {
    total_processed: number;
    successful: number;
    failed: number;
    results: {
        success: Array<{
            name: string;
            email: string;
            username: string;
            password: string;
        }>;
        errors: string[];
    };
}

/**
 * Get all users with metadata
 * @param archived - Filter by archived status: 'true', 'false', or undefined for all
 * @param search - Search term for name, email, or employee ID
 * @param page - Page number for pagination (1-indexed)
 * @param perPage - Number of items per page
 * @param fields - Field set to return: 'basic' for minimal fields, undefined for all
 * @param member - Filter by member status: 'true' (members only), 'false' (non-members only), 'all' (everyone)
 */
export const getUsersWithMetadata = async (
    archived?: string, 
    search?: string,
    page?: number,
    perPage?: number,
    fields?: 'basic',
    member?: string
): Promise<UserMetadata[]> => {
    const params = new URLSearchParams();
    if (archived !== undefined) {
        params.append('archived', archived);
    }
    if (search) {
        params.append('search', search);
    }
    if (page !== undefined) {
        params.append('page', page.toString());
    }
    if (perPage !== undefined) {
        params.append('per_page', perPage.toString());
    }
    if (fields) {
        params.append('fields', fields);
    }
    if (member !== undefined) {
        params.append('member', member);
    }
    
    // Add timestamp to prevent caching
    params.append('_t', new Date().getTime().toString());
    
    const queryString = params.toString();
    const endpoint = `admin/users${queryString ? `?${queryString}` : ''}`;
    
    return pluginGet(endpoint);
};

/**
 * Get users with metadata with pagination info
 * @param archived - Filter by archived status: 'true', 'false', or undefined for all
 * @param search - Search term for name, email, or employee ID
 * @param page - Page number for pagination (1-indexed)
 * @param perPage - Number of items per page
 * @param fields - Field set to return: 'basic' for minimal fields, undefined for all
 */
export const getUsersWithMetadataPaginated = async (
    archived?: string, 
    search?: string,
    page: number = 1,
    perPage: number = 50,
    fields?: 'basic'
): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams();
    if (archived !== undefined) {
        params.append('archived', archived);
    }
    if (search) {
        params.append('search', search);
    }
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    if (fields) {
        params.append('fields', fields);
    }

    // Add timestamp to prevent caching
    params.append('_t', new Date().getTime().toString());
    
    const queryString = params.toString();
    
    const wpData = (window as any).mentorshipPlatformData;
    if (!wpData || !wpData.api_url) {
        throw new Error('API configuration not found');
    }
    
    const url = `${wpData.api_url}/admin/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': wpData.nonce,
        },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const users = await response.json();
    
    // Extract pagination headers
    const total = parseInt(response.headers.get('X-WP-Total') || '0');
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
    const currentPage = parseInt(response.headers.get('X-WP-Page') || '1');
    const itemsPerPage = parseInt(response.headers.get('X-WP-PerPage') || perPage.toString());
    
    return {
        users,
        total,
        total_pages: totalPages,
        page: currentPage,
        per_page: itemsPerPage,
    };
};

/**
 * Get all users with metadata for dropdown/autocomplete lists
 * Uses public endpoint accessible to any logged-in user
 * Used in forms that need user selection (in-services, scan audits, live drills)
 * @param archived - Filter by archived status: 'true', 'false', 'all' (default: 'false')
 * @param member - Filter by member status: 'true', 'false', 'all' (default: 'true' - only members)
 */
export const getAllUsersWithMetadata = async (
    archived: string = 'false',
    member: string = 'true'
): Promise<UserMetadata[]> => {
    const params = new URLSearchParams();
    params.append('archived', archived);
    params.append('member', member);
    
    const queryString = params.toString();
    const endpoint = `users/list${queryString ? `?${queryString}` : ''}`;
    
    return pluginGet(endpoint);
};

/**
 * Create a new user
 */
export const createUser = async (userData: CreateUserData): Promise<{
    success: boolean;
    user_id: number;
    username: string;
    password: string;
    message: string;
}> => {
    return pluginPost('admin/users', userData);
};

/**
 * Update an existing user
 */
export const updateUser = async (userId: number, userData: UpdateUserData): Promise<{
    success: boolean;
    message: string;
}> => {
    return pluginPost(`admin/users/${userId}`, userData, 'PUT');
};

/**
 * Delete a user
 */
export const deleteUser = async (userId: number): Promise<{
    success: boolean;
    message: string;
}> => {
    return pluginPost(`admin/users/${userId}`, {}, 'DELETE');
};

/**
 * Archive a user
 */
export const archiveUser = async (userId: number): Promise<{
    success: boolean;
    message: string;
}> => {
    return pluginPost(`admin/users/${userId}/archive`, {});
};

/**
 * Unarchive a user
 */
export const unarchiveUser = async (userId: number): Promise<{
    success: boolean;
    message: string;
}> => {
    return pluginPost(`admin/users/${userId}/unarchive`, {});
};

/**
 * Set user member status (employee vs site user)
 * @param userId - The user ID
 * @param isMember - true = employee/member, false = site user/visitor, null = auto-detect based on job roles
 */
export const setMemberStatus = async (userId: number, isMember: boolean | null): Promise<{
    success: boolean;
    message: string;
    is_member: boolean;
    is_member_explicit: number | null;
}> => {
    return pluginPost(`admin/users/${userId}/member-status`, { is_member: isMember });
};

/**
 * Bulk import users from CSV data
 */
export const bulkImportUsers = async (csvData: string, sendEmails: boolean): Promise<BulkImportResult> => {
    return pluginPost('admin/users/bulk-import', {
        csv_data: csvData,
        send_emails: sendEmails
    });
};

/**
 * Bulk assign job role to multiple users
 */
export const bulkAssignJobRole = async (userIds: number[], jobRoleId: number, syncWpRole: boolean): Promise<{
    success: boolean;
    message: string;
    total_processed: number;
    successful: number;
    failed: number;
    errors: string[];
}> => {
    return pluginPost('admin/users/bulk-assign-job-role', {
        user_ids: userIds,
        job_role_id: jobRoleId,
        sync_wp_role: syncWpRole
    });
};

/**
 * Generate CSV template for bulk import
 */
export const generateCSVTemplate = (): string => {
    const headers = [
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'employee_id',
        'hire_date',
        'job_role_id',
        'wp_role'
    ];
    
    const exampleRow = [
        'John',
        'Doe',
        'john.doe@example.com',
        '555-1234',
        'EMP001',
        '2024-01-15',
        '1',
        'subscriber'
    ];
    
    return `${headers.join(',')}\n${exampleRow.join(',')}`;
};

/**
 * Download CSV template
 */
export const downloadCSVTemplate = (): void => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

/**
 * Fix user display names - removes trailing digits and reconstructs from first/last names
 */
export const fixUserDisplayNames = async (): Promise<{
    success: boolean;
    message: string;
    fixed: number;
    total: number;
}> => {
    return pluginPost('admin/users/fix-display-names', {});
};
