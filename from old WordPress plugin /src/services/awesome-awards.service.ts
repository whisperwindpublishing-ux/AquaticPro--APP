/**
 * Awesome Awards API Service
 * 
 * Centralized API functions for the Awesome Awards module.
 */

import {
  AwardPeriod,
  AwardCategory,
  AwardPermissions,
  Nomination,
  NominationStatus,
  Vote,
  SimpleUser,
} from '@/types/awesome-awards';

// Get API configuration from WordPress
const API_BASE = () => (window as any).mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
const NONCE = () => (window as any).mentorshipPlatformData?.nonce || '';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// PERIOD MANAGEMENT
// ============================================

/**
 * Get all award periods (optionally filtered by archived status)
 */
export async function getPeriods(params?: { include_archived?: boolean }): Promise<AwardPeriod[]> {
  const query = params?.include_archived ? '?include_archived=true' : '';
  return apiFetch<AwardPeriod[]>(`/awesome-awards/periods${query}`);
}

/**
 * Get active periods (open for nominations or voting)
 */
export async function getActivePeriods(): Promise<AwardPeriod[]> {
  return apiFetch<AwardPeriod[]>('/awesome-awards/active-periods');
}

/**
 * Get a single period by ID
 */
export async function getPeriod(id: number): Promise<AwardPeriod> {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}`);
}

/**
 * Create a new period
 */
export async function createPeriod(data: Partial<AwardPeriod>): Promise<AwardPeriod> {
  return apiFetch<AwardPeriod>('/awesome-awards/periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing period
 */
export async function updatePeriod(
  id: number,
  data: Partial<AwardPeriod>
): Promise<AwardPeriod> {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Update period status
 */
export async function updatePeriodStatus(
  id: number,
  status: AwardPeriod['status']
): Promise<AwardPeriod> {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

/**
 * Archive/unarchive a period
 */
export async function toggleArchivePeriod(id: number): Promise<AwardPeriod> {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}/archive`, {
    method: 'PUT',
  });
}

/**
 * Delete a period (must be draft)
 */
export async function deletePeriod(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/awesome-awards/periods/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

/**
 * Get categories for a period
 */
export async function getCategories(periodId: number): Promise<AwardCategory[]> {
  return apiFetch<AwardCategory[]>(`/awesome-awards/periods/${periodId}/categories`);
}

/**
 * Create a category
 */
export async function createCategory(
  periodId: number,
  data: Partial<AwardCategory>
): Promise<AwardCategory> {
  return apiFetch<AwardCategory>(`/awesome-awards/periods/${periodId}/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update a category
 * Note: Route is /awesome-awards/categories/{id} not nested under periods
 */
export async function updateCategory(
  categoryId: number,
  data: Partial<AwardCategory>
): Promise<AwardCategory> {
  return apiFetch<AwardCategory>(
    `/awesome-awards/categories/${categoryId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Delete a category (must be draft period)
 * Note: Route is /awesome-awards/categories/{id} not nested under periods
 */
export async function deleteCategory(
  categoryId: number
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/awesome-awards/categories/${categoryId}`,
    { method: 'DELETE' }
  );
}

// ============================================
// NOMINATIONS
// ============================================

export interface NominationFilters {
  period_id?: number;
  category_id?: number;
  status?: NominationStatus;
}

/**
 * Get nominations with optional filters
 */
export async function getNominations(filters?: NominationFilters): Promise<Nomination[]> {
  const query = new URLSearchParams();
  if (filters?.period_id) query.append('period_id', String(filters.period_id));
  if (filters?.category_id) query.append('category_id', String(filters.category_id));
  if (filters?.status) query.append('status', filters.status);
  const queryStr = query.toString() ? `?${query}` : '';
  return apiFetch<Nomination[]>(`/awesome-awards/nominations${queryStr}`);
}

/**
 * Get a single nomination by ID
 */
export async function getNomination(id: number): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${id}`);
}

/**
 * Create a new nomination
 */
export async function createNomination(data: {
  period_id: number;
  category_id: number;
  nominee_id: number;
  reason_text: string;
  reason_json?: string;
  is_anonymous?: boolean;
}): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/periods/${data.period_id}/nominations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get pending nominations for approval queue
 */
export async function getPendingNominations(): Promise<Nomination[]> {
  return apiFetch<Nomination[]>('/awesome-awards/nominations/pending');
}

/**
 * Get count of pending nominations
 */
export async function getPendingCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/awesome-awards/nominations/pending-count');
}

/**
 * Approve or reject a nomination
 */
export async function approveNomination(
  id: number,
  action: 'approve' | 'reject'
): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
}

/**
 * Select a nomination as winner
 */
export async function selectWinner(id: number): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${id}/winner`, {
    method: 'POST',
  });
}

// ============================================
// VOTING
// ============================================

/**
 * Cast a vote on a nomination
 */
export async function castVote(nominationId: number): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/vote`, {
    method: 'POST',
  });
}

/**
 * Remove a vote from a nomination
 */
export async function removeVote(nominationId: number): Promise<Nomination> {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/vote`, {
    method: 'DELETE',
  });
}

/**
 * Get user's votes for a period
 */
export async function getMyVotes(periodId: number): Promise<Vote[]> {
  return apiFetch<Vote[]>(`/awesome-awards/periods/${periodId}/my-votes`);
}

// ============================================
// PERMISSIONS
// ============================================

/**
 * Get current user's permissions
 */
export async function getMyPermissions(): Promise<AwardPermissions> {
  return apiFetch<AwardPermissions>('/awesome-awards/my-permissions');
}

/**
 * Get permissions for all job roles (admin only)
 */
export async function getPermissions(): Promise<AwardPermissions[]> {
  return apiFetch<AwardPermissions[]>('/awesome-awards/permissions');
}

/**
 * Get all role permissions (admin only) - alias for component usage
 */
export async function getAllRolePermissions(): Promise<any[]> {
  return apiFetch<any[]>('/awesome-awards/permissions');
}

/**
 * Update permissions for a job role (admin only)
 */
export async function updatePermissions(
  jobRoleId: number,
  permissions: Partial<AwardPermissions>
): Promise<AwardPermissions> {
  return apiFetch<AwardPermissions>(`/awesome-awards/permissions/${jobRoleId}`, {
    method: 'PUT',
    body: JSON.stringify(permissions),
  });
}

/**
 * Update role permissions - POST to permissions endpoint with role_id
 */
export async function updateRolePermissions(
  roleId: number,
  permissions: Record<string, boolean>
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/awesome-awards/permissions', {
    method: 'POST',
    body: JSON.stringify({ role_id: roleId, permissions }),
  });
}

/**
 * Batch update permissions (admin only)
 */
export async function batchUpdatePermissions(
  updates: Array<{ job_role_id: number } & Partial<AwardPermissions>>
): Promise<{ success: boolean; updated_count: number }> {
  return apiFetch<{ success: boolean; updated_count: number }>(
    '/awesome-awards/permissions/batch',
    {
      method: 'PUT',
      body: JSON.stringify({ permissions: updates }),
    }
  );
}

// ============================================
// USERS
// ============================================

/**
 * Get simple user list for nomination dropdown
 */
export async function getSimpleUsers(search?: string): Promise<SimpleUser[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<SimpleUser[]>(`/awesome-awards/users/simple${query}`);
}

// ============================================
// USER STATS & BADGES
// ============================================

export interface UserAwardStats {
  user_id: number;
  display_name: string;
  avatar_url: string;
  total_wins: number;
  weekly_wins: number;
  monthly_wins: number;
  nominations_received: number;
  nominations_given: number;
  votes_cast: number;
  recent_wins: Array<{
    id: number;
    selected_winner_at: string;
    category_name: string;
    period_name: string;
    period_type: string;
  }>;
}

/**
 * Get user's award statistics
 */
export async function getUserStats(userId: number): Promise<UserAwardStats> {
  return apiFetch<UserAwardStats>(`/awesome-awards/users/${userId}/stats`);
}

// ============================================
// RECENT WINNERS
// ============================================

export interface RecentWinner {
  id: number;
  nominee_id: number;
  nominee_name: string;
  nominee_avatar: string;
  reason_text: string;
  selected_winner_at: string;
  vote_count: number;
  category_id: number;
  category_name: string;
  emoji: string;
  period_id: number;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
}

/**
 * Get recent winners for dashboard widget
 */
export async function getRecentWinners(limit: number = 5): Promise<RecentWinner[]> {
  return apiFetch<RecentWinner[]>(`/awesome-awards/winners/recent?limit=${limit}`);
}

// ============================================
// WINNER ANNOUNCEMENTS
// ============================================

export interface WinnerAnnouncement {
  id: number;
  nominee_id: number;
  nominee_name: string;
  nominee_avatar: string;
  reason_text: string;
  selected_winner_at: string;
  vote_count: number;
  category_name: string;
  emoji: string;
  period_name: string;
  period_type: string;
  is_current_user: boolean;
}

/**
 * Get unseen winner announcements
 */
export async function getAnnouncements(): Promise<WinnerAnnouncement[]> {
  return apiFetch<WinnerAnnouncement[]>('/awesome-awards/announcements');
}

/**
 * Mark an announcement as seen
 */
export async function markAnnouncementSeen(nominationId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/awesome-awards/announcements/${nominationId}/seen`, {
    method: 'POST',
  });
}
