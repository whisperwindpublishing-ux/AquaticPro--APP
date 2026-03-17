/**
 * Awesome Awards Module Types
 * Employee recognition system with nominations, voting, and winner announcements
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PeriodType = 'week' | 'month';

export type PeriodStatus = 
  | 'draft'               // Not yet open for nominations
  | 'nominations_open'    // Currently accepting nominations
  | 'voting_open'         // Nominations closed, voting in progress
  | 'pending_approval'    // Voting closed, awaiting winner selection
  | 'winner_declared'     // Winner(s) announced
  | 'closed'              // Period is closed
  | 'completed';          // Archived/finalized (legacy status)

export type NominationStatus = 
  | 'pending'   // Awaiting approval review
  | 'approved'  // Approved and visible for voting
  | 'rejected'  // Not approved
  | 'winner';   // Selected as winner

// ============================================
// CORE ENTITIES
// ============================================

/**
 * Award Period - A timeframe during which nominations and voting occur
 */
export interface AwardPeriod {
  id: number;
  name?: string;               // Custom name like "December Awards"
  period_type: PeriodType;
  // Legacy fields (kept for backwards compatibility)
  start_date: string;          // YYYY-MM-DD (maps to nomination_start)
  end_date: string;            // YYYY-MM-DD (maps to voting_end)
  nomination_deadline: string | null; // YYYY-MM-DD HH:mm:ss (maps to nomination_end)
  // New window fields
  nomination_start?: string;   // When nominations open
  nomination_end?: string;     // When nominations close
  voting_start?: string;       // When voting opens  
  voting_end?: string;         // When voting closes
  status: PeriodStatus;
  archived: boolean;
  max_winners?: number;        // Maximum number of winners allowed (default: 1)
  allow_pre_voting?: boolean;  // Allow votes before voting window opens
  created_by: number;
  created_at: string;
  updated_at: string;
  // TaskDeck integration
  taskdeck_enabled?: boolean;
  nomination_task_roles?: number[];
  voting_task_roles?: number[];
  taskdeck_cards?: {
    nomination: { card_id: number; is_completed: boolean; completed_at: string | null; created_at: string } | null;
    voting: { card_id: number; is_completed: boolean; completed_at: string | null; created_at: string } | null;
  };
  // Populated via joins
  categories?: AwardCategory[];
  category_count?: number;
  winner_count?: number;       // Number of winners already selected
}

/**
 * Award Category - A type of award within a period (e.g., "Best Team Player")
 */
export interface AwardCategory {
  id: number;
  period_id: number;
  name: string;
  description: string;
  prize_description: string;   // Rich text (BlockNote JSON)
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Populated via joins
  nomination_count?: number;
  winner?: Nomination | null;
}

/**
 * Nomination - A peer nomination for an award
 */
export interface Nomination {
  id: number;
  period_id: number;
  category_id: number;
  nominator_id: number;
  nominee_id: number;
  reason_text: string;         // Plain text version
  reason_json: string;         // BlockNote JSON
  is_anonymous: boolean;
  status: NominationStatus;
  vote_count: number;
  approved_by: number | null;
  approved_at: string | null;
  archived: boolean;
  is_winner?: boolean;         // Whether this nomination won
  created_at: string;
  updated_at: string;
  // Populated via API joins (enriched fields)
  nominee_name?: string;       // Display name of nominee
  nominator_name?: string;     // Display name of nominator (or 'Anonymous')
  nominee_avatar?: string;     // Avatar URL of nominee
  nominator_avatar?: string;   // Avatar URL of nominator
  nominator?: NomineeUser;
  nominee?: NomineeUser;
  category?: AwardCategory;
  category_name?: string;      // From API join
  period?: AwardPeriod;
  period_status?: PeriodStatus; // Status of the period
  user_voted?: boolean;        // Whether current user has voted
}

/**
 * Vote - A user's vote on a nomination
 */
export interface Vote {
  id: number;
  nomination_id: number;
  voter_id: number;
  created_at: string;
}

/**
 * User reference for nominations (lightweight user info)
 */
export interface NomineeUser {
  id: number;
  display_name: string;
  avatar_url?: string;
  job_title?: string;
  win_count?: UserWinCount;
}

/**
 * Simple user for dropdown selection
 */
export interface SimpleUser {
  id: number;
  display_name: string;
  email: string;
  avatar_url?: string;
}

/**
 * User win count for badge display
 */
export interface UserWinCount {
  total: number;
  weekly: number;
  monthly: number;
}

// ============================================
// PERMISSIONS
// ============================================

/**
 * Permission flags for Awesome Awards module
 */
export interface AwardPermissions {
  can_nominate: boolean;
  can_vote: boolean;
  can_approve: boolean;
  can_direct_assign: boolean;
  can_manage_periods: boolean;
  can_view_nominations: boolean;
  can_view_winners: boolean;
  can_view_archives: boolean;
  can_archive: boolean;
}

/**
 * Job role with its permissions
 */
export interface RolePermissions {
  job_role_id: number;
  job_role_title: string;
  tier: number;
  permissions: AwardPermissions;
}

/**
 * Permission update payload
 */
export interface PermissionUpdate {
  job_role_id: number;
  permissions: Partial<AwardPermissions>;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Create period request
 */
export interface CreatePeriodRequest {
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  nomination_deadline?: string | null;
  categories?: Omit<CreateCategoryRequest, 'period_id'>[];
}

/**
 * Update period request
 */
export interface UpdatePeriodRequest {
  period_type?: PeriodType;
  start_date?: string;
  end_date?: string;
  nomination_deadline?: string | null;
}

/**
 * Create category request
 */
export interface CreateCategoryRequest {
  period_id?: number;
  name: string;
  description?: string;
  prize_description?: string;
}

/**
 * Update category request
 */
export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  prize_description?: string;
  sort_order?: number;
}

/**
 * Create nomination request
 */
export interface CreateNominationRequest {
  period_id: number;
  category_id: number;
  nominee_id: number;
  reason_text: string;
  reason_json: string;
  is_anonymous?: boolean;
}

/**
 * Nomination approval action
 */
export interface ApprovalAction {
  action: 'approve' | 'reject';
  feedback?: string;
}

/**
 * Select winner action
 */
export interface SelectWinnerAction {
  nomination_id: number;
}

// ============================================
// ANNOUNCEMENTS
// ============================================

/**
 * Winner announcement for display
 */
export interface WinnerAnnouncement {
  nomination_id: number;
  nominee: NomineeUser;
  category_name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  reason_text: string;
  reason_json: string;
  announcement_type: 'winner';
  is_current_user_winner: boolean;
}

/**
 * Rejection notification (only for the nominee)
 */
export interface RejectionNotification {
  nomination_id: number;
  category_name: string;
  period_type: PeriodType;
  announcement_type: 'rejection';
}

export type Announcement = WinnerAnnouncement | RejectionNotification;

// ============================================
// UI STATE TYPES
// ============================================

/**
 * Filter options for period list
 */
export interface PeriodFilters {
  status?: PeriodStatus;
  period_type?: PeriodType;
  archived?: boolean;
}

/**
 * Filter options for nomination list
 */
export interface NominationFilters {
  period_id?: number;
  category_id?: number;
  status?: NominationStatus;
  nominee_id?: number;
}

/**
 * Period management form state
 */
export interface PeriodFormState {
  name: string; // Custom period name like "August Awards" or "Summer Awards"
  period_type: PeriodType;
  // Nomination Window
  nomination_start: string;  // When nominations open
  nomination_end: string;    // When nominations close
  // Voting Window
  voting_start: string;      // When voting opens
  voting_end: string;        // When voting closes
  // Winner settings
  max_winners: number;       // Maximum winners allowed (default 1)
  allow_pre_voting: boolean; // Allow votes before voting window
  winner_id?: number | null; // Selected winner nomination ID (for editing)
  // Categories
  categories: CategoryFormState[];
  // TaskDeck integration
  taskdeck_enabled: boolean;
  nomination_task_roles: number[];  // Job roles that get nomination reminder task
  voting_task_roles: number[];      // Job roles that get voting reminder task
}

/**
 * Category form state (for inline editing)
 */
export interface CategoryFormState {
  id?: number;
  name: string;
  description: string;
  prize_description: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

/**
 * Nomination form state
 */
export interface NominationFormState {
  category_id: number | null;
  nominee_id: number | null;
  reason_text: string;
  reason_json: string;
  is_anonymous: boolean;
}

// ============================================
// TASKDECK INTEGRATION
// ============================================

/**
 * TaskDeck card tracking for period reminders
 */
export interface AwardTaskDeckCard {
  card_id: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

/**
 * TaskDeck card status for a period
 */
export interface TaskDeckCardStatus {
  nomination: AwardTaskDeckCard | null;
  voting: AwardTaskDeckCard | null;
}

/**
 * Award Period with TaskDeck fields
 */
export interface AwardPeriodWithTaskDeck extends AwardPeriod {
  taskdeck_enabled: boolean;
  nomination_reminder_roles: number[];
  voting_reminder_roles: number[];
  taskdeck_cards?: TaskDeckCardStatus;
}

// ============================================
// STATS & ANALYTICS
// ============================================

/**
 * Period statistics
 */
export interface PeriodStats {
  total_nominations: number;
  pending_nominations: number;
  approved_nominations: number;
  rejected_nominations: number;
  total_votes: number;
  unique_voters: number;
  unique_nominees: number;
}

/**
 * User award stats for profile display
 */
export interface UserAwardStats {
  wins: UserWinCount;
  nominations_received: number;
  nominations_given: number;
  votes_cast: number;
}
