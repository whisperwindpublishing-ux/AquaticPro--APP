// Fix: Define and export all necessary types for the application.
export type MentorshipRequestStatus = 'Pending' | 'Accepted' | 'Rejected';
export type GoalStatus = 'In Progress' | 'Completed' | 'Not Started';
export type InitiativeStatus = 'In Progress' | 'Completed' | 'Not Started';

export interface CustomLink {
    label: string;
    url: string;
}

export interface JobRole {
    id: number;
    title: string;
    tier: number;
}

export interface UserProfile {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string;
    tagline: string;
    mentorOptIn: boolean;
    skills: string[];
    bioDetails: string;
    experience: string;
    linkedinUrl?: string;
    bookingLink?: string;
    notifyByEmail?: boolean;
    customLinks: CustomLink[];
    tier?: number;
    capabilities?: {
        manage_options?: boolean;
    };
    jobRoles?: JobRole[];
    // Contact methods for messaging
    email?: string;
    contactEmail?: string; // Custom contact email (if blank, uses default email)
    groupmeUsername?: string;
    signalUsername?: string;
    telegramUsername?: string;
}

export interface Comment {
    id: number;
    author: UserProfile;
    content: string;
    date: string; // ISO string
    parentId?: number;
    reactionCounts?: {
        thumbs_up: number;
        thumbs_down: number;
        heart: number;
    };
    userReaction?: ReactionType;
}

export interface Attachment {
    id: string;
    fileName: string;
    fileType: string;
    url: string;
}

// Talking Point / Agenda Item for meetings
export interface TalkingPoint {
    id: number;
    text: string;
    addedBy: number; // User ID who added this point
    addedByName?: string;
    isDiscussed: boolean;
    createdAt: string;
}

// Decision made during a meeting
export interface Decision {
    id: number;
    text: string;
    madeAt: string; // ISO string
}

// Follow-up item for next meeting
export interface FollowUp {
    id: number;
    text: string;
    isAddressed: boolean;
}

// Recurring meeting pattern
export type RecurringPattern = 'none' | 'weekly' | 'biweekly' | 'monthly';

// Enhanced Task with ownership and meeting linkage (ActionItem)
export interface Task {
    id: number;
    text: string;
    isCompleted: boolean;
    initiativeId: number | null;
    completedDate?: string; // ISO string - date when task was marked complete
    completedBy?: {
        id: number;
        name: string;
    }; // User who marked the task as complete
    // New fields for action item support
    assignedTo?: number; // User ID of assignee
    assignedToName?: string;
    dueDate?: string; // ISO string
    createdFromMeetingId?: number; // Link to the meeting that created this action item
    priority?: 'low' | 'medium' | 'high';
}

// Enhanced Meeting with structured notes
export interface Meeting {
    id: number;
    topic: string;
    date: string; // ISO string
    notes?: string; // Legacy notes field (plain text/HTML)
    notesJson?: any; // BlockNote JSON structure for rich notes
    initiativeId: number | null;
    meetingLink?: string;
    author: UserProfile;
    comments: Comment[];
    commentCount?: number;
    // New fields for enhanced meeting structure
    agenda?: TalkingPoint[]; // Talking points / agenda items
    decisions?: Decision[]; // Decisions made during meeting
    actionItems?: number[]; // Task IDs created as action items
    followUp?: FollowUp[]; // Items for next meeting
    recurringPattern?: RecurringPattern;
    recurringParentId?: number; // Link to parent meeting for recurring series
    duration?: number; // Duration in minutes
    attendees?: number[]; // User IDs of attendees
    attachments?: Attachment[]; // Files attached to the meeting
}

export interface Update {
    id: number;
    author: UserProfile;
    text: string;
    date: string; // ISO string
    initiativeId: number | null;
    attachments: Attachment[];
    comments?: Comment[];
    commentCount?: number;
}

export interface Initiative {
    id: number;
    title: string;
    description: string;
    status: InitiativeStatus;
    comments: Comment[];
}

// Activity types for the unified timeline
export type ActivityType = 
    | 'meeting_scheduled'
    | 'meeting_held'
    | 'meeting_notes_added'
    | 'update_posted'
    | 'task_created'
    | 'task_completed'
    | 'initiative_created'
    | 'initiative_status_changed'
    | 'goal_status_changed'
    | 'action_item_created'
    | 'decision_made';

// Unified Activity Item for timeline view
export interface ActivityItem {
    id: string; // Composite ID like "meeting_123" or "task_456"
    type: ActivityType;
    timestamp: string; // ISO string for sorting
    actor: UserProfile; // Who performed the action
    title: string; // Display title
    description?: string; // Optional details
    // Reference to the source object
    sourceType: 'meeting' | 'update' | 'task' | 'initiative' | 'goal';
    sourceId: number;
    // Additional context
    initiativeId?: number | null;
    initiativeTitle?: string;
    metadata?: Record<string, any>; // Type-specific metadata
}

export interface Goal {
    id: number;
    title: string;
    description: string;
    status: GoalStatus;
    isPortfolio: boolean;
    initiatives: Initiative[];
    tasks: Task[];
    meetings: Meeting[];
    updates: Update[];
    comments?: Comment[];
    commentCount?: number; // Just the goal's comments
    totalCommentCount?: number; // Total across goal, meetings, and updates
    mentor?: UserProfile; // The mentor in the mentorship relationship
    mentee?: UserProfile; // The mentee (goal owner) in the mentorship relationship
}

export interface MentorshipRequest {
    id: number;
    sender: UserProfile;
    receiver: UserProfile;
    message: string;
    status: MentorshipRequestStatus;
    requestDate: string; // ISO string
    goals: Goal[];
}

// Daily Logs types
export type ReactionType = 'thumbs_up' | 'thumbs_down' | 'heart';

// Location Definition (customizable by tier 5/6 admins)
export interface Location {
    id: number;
    name: string; // e.g., 'Station 1', 'Headquarters', 'Training Center'
    description?: string;
    sort_order: number; // Display order
    is_active: boolean; // Can be disabled without deleting
    created_at: string;
    updated_at: string;
}

// Time Slot Definition (customizable by tier 5/6 admins)
export interface TimeSlotDefinition {
    id: number;
    slug: string; // e.g., 'morning', 'midday', 'custom_shift_1'
    label: string; // e.g., 'Morning Shift', 'Night Shift'
    description?: string;
    sortOrder: number; // For display ordering
    isActive: boolean; // Can be disabled without deleting
    color?: string; // Optional color for badges
    createdAt: string;
    updatedAt: string;
}

// Daily Log Permissions per Job Role
export interface DailyLogPermissions {
    jobRoleId: number;
    jobRoleName?: string; // Only included when fetching all permissions
    jobRoleTier?: number; // Only included when fetching all permissions
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean; // Can edit their own logs
    canDelete: boolean; // Can delete their own logs
    canModerateAll: boolean; // Can edit/delete any log (for tier 5/6)
}

export interface JobRole {
    id: number;
    name: string;
    description?: string;
    color?: string; // For badge styling
    dailyLogPermissions?: DailyLogPermissions; // Permissions for this role
}

export interface DailyLogReaction {
    id: number;
    userId: number;
    reactionType: ReactionType;
    user?: UserProfile;
}

export interface DailyLog {
    id: number;
    authorId: number; // Always present - the user ID who created the log
    author?: UserProfile; // Optional - may be undefined for drafts or incomplete data
    locationId: number;
    locationName: string;
    logDate: string; // ISO date string (YYYY-MM-DD)
    timeSlotIds: number[]; // Array of TimeSlotDefinition IDs
    timeSlots?: TimeSlotDefinition[]; // Full time slot objects for display (may be undefined for drafts)
    jobRole?: JobRole;
    jobRoleId?: number;
    title: string;
    content: string; // HTML content for display
    blocksJson: any; // BlockNote JSON structure
    tags: string[];
    status: 'publish' | 'draft';
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
    reactions?: DailyLogReaction[]; // Optional for drafts
    reactionCounts?: {
        thumbs_up: number;
        thumbs_down: number;
        heart: number;
    };
    userReaction?: ReactionType; // Current user's reaction
    comments?: Comment[];
    commentCount?: number;
}

export interface GroupedDailyLogs {
    [locationName: string]: {
        locationId: number;
        dates: {
            [date: string]: {
                timeSlots: {
                    [slotId: string]: {
                        slot: TimeSlotDefinition;
                        logs: DailyLog[];
                    };
                };
            };
        };
    };
}

// TaskDeck Types
export interface TaskDeck {
    deck_id: number;
    deck_name: string;
    deck_description?: string;
    created_by: number;
    creator_name?: string;
    is_public: number;
    created_at: string;
    updated_at: string;
    is_archived: number;
}

export interface TaskList {
    list_id: number;
    deck_id: number;
    list_name: string;
    sort_order: number;
    created_at: string;
}

export interface TaskCard {
    card_id: number;
    list_id: number;
    title: string;
    description?: string;
    created_by: number;
    creator_name?: string;
    assigned_to?: number | null;
    assignee_name?: string;
    assignee_profile_picture?: string | null;
    assigned_to_role_id?: number | null;
    role_name?: string;
    location_id?: number | null;
    location_name?: string;
    due_date?: string | null;
    category_tag?: string;
    accent_color?: string | null;  // Custom accent color for card (overrides category color)
    is_complete: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
    // Checklist summary for card preview
    checklist_total?: number;
    checklist_completed?: number;
    // Full checklist items for preview and fast modal loading
    checklist_items?: ChecklistItem[];
    // Multi-assignment support
    assignees?: Array<{user_id: number; user_name: string}>;
    assigned_roles?: Array<{role_id: number; role_name: string}>;
    // Checkpoint for thumbnail preview
    attachments?: Array<{attachment_id: number; file_name: string; file_url?: string | null; wp_attachment_id: number}>;
    // Comments metadata for preview
    comments_count?: number;
    commenters?: Array<{user_id: number; user_name: string; profile_picture: string | null}>;
}

export interface CardComment {
    comment_id: number;
    card_id: number;
    user_id: number;
    user_name?: string;
    user_email?: string;
    avatar_url?: string;
    comment_text: string;
    created_at: string;
    reactions?: Record<string, number>;
    user_reaction?: string | null;
}

export interface CardAttachment {
    attachment_id: number;
    card_id: number;
    user_id: number;
    user_name?: string;
    file_name: string;
    wp_attachment_id: number;
    file_url?: string;
    uploaded_at: string;
}

export interface ChecklistItem {
    checklist_id: number;
    card_id: number;
    item_text: string;
    is_complete: number;
    sort_order: number;
    created_at: string;
}

export interface CardActivity {
    log_id: number;
    card_id: number;
    user_id: number;
    user_name?: string;
    action: string;
    created_at: string;
}

export interface TaskLocation {
    location_id: number;
    location_name: string;
}

export interface TaskRole {
    role_id: number;
    role_name: string;
    tier?: number;
}

// ============================================
// SEASONAL RETURNS & PAY MANAGEMENT TYPES
// ============================================

export type PayConfigType = 'base_rate' | 'role_bonus' | 'longevity_tier' | 'time_bonus' | 'pay_cap';
export type EmployeeStatus = 'pending' | 'returning' | 'not_returning' | 'ineligible';
export type EmailTemplateType = 'initial_invite' | 'follow_up' | 'confirmation' | 'reminder' | 'custom';
export type SeasonType = 'summer' | 'winter' | 'school_year';

export interface PayConfig {
    id: number;
    config_type: PayConfigType;
    name: string;
    amount: number;
    job_role_id?: number;
    job_role_name?: string;
    longevity_years?: number;
    start_date?: string; // YYYY-MM-DD
    end_date?: string; // YYYY-MM-DD
    expiration_date?: string; // YYYY-MM-DD - when this config expires
    is_recurring: boolean;
    is_active: boolean;
    effective_date: string; // YYYY-MM-DD
    created_at: string;
    updated_at: string;
}

export interface Season {
    id: number;
    name: string; // e.g., "Summer 2026"
    year: number;
    season_type: SeasonType;
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD
    is_active: boolean; // Currently recruiting
    is_current: boolean; // Currently operating
    created_at: string;
    updated_at: string;
}

export interface EmployeeSeason {
    id: number;
    user_id: number;
    season_id: number;
    status: EmployeeStatus;
    eligible_for_rehire: boolean;
    is_archived: boolean;
    is_new_hire: boolean;
    return_token?: string;
    token_expires_at?: string;
    response_date?: string;
    signature_text?: string;
    comments?: string;
    longevity_years: number;
    created_at: string;
    updated_at: string;
    // Season dates from joined data
    start_date?: string;
    end_date?: string;
    // Enriched data from API
    user?: {
        id: number;
        display_name: string;
        email: string;
        first_name: string;
        last_name: string;
    };
    season_name?: string;
    job_roles?: JobRole[];
}

export interface EmailTemplate {
    id: number;
    name: string;
    subject: string;
    body_html: string;
    body_json?: any; // BlockNote JSON structure
    template_type: EmailTemplateType;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface EmailLog {
    id: number;
    user_id: number;
    season_id: number;
    template_id?: number;
    email_type: 'initial' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3' | 'custom';
    sent_at: string;
    opened_at?: string;
    clicked_at?: string;
    sent_by: number;
}

export interface RetentionStats {
    id?: number;
    season_id: number;
    total_eligible: number;
    total_invited: number;
    total_returning: number;
    total_not_returning: number;
    total_pending: number;
    total_ineligible: number;
    total_new_hires: number;
    retention_rate: number; // Percentage
    calculated_at: string;
    // Enriched from API
    season_name?: string;
    year?: number;
}

export interface RoleBonusData {
    amount: number;
    role_name: string;
    role_id: number;
}

export interface LongevityData {
    years: number;                    // "In their Nth year" display number
    work_years_logged?: number;       // Actual count of years in database
    work_years_list?: number[];       // Array of calendar years (e.g., [2023, 2024])
    bonus: number;
}

export interface TimeBonusData {
    id: number;
    name: string;
    amount: number;
}

export interface PayBreakdown {
    user_id: number;
    as_of_date: string;
    base_rate: number;
    role_bonus: RoleBonusData;
    longevity: LongevityData;
    time_bonuses: TimeBonusData[];
    time_bonus_total: number;
    pay_cap: number;
    is_capped: boolean;
    total: number;
}

export interface ProjectedPayBreakdown {
    user_id: number;
    projection_date: string;
    season_id?: number;
    season_name: string;
    base_rate: number;
    role_bonus: RoleBonusData;
    longevity: {
        current_years: number;
        projected_years: number;
        bonus: number;
    };
    time_bonuses: TimeBonusData[];
    time_bonus_total: number;
    pay_cap: number;
    is_capped: boolean;
    total: number;
}

export interface EmployeePayData {
    user_id: number;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    job_roles: JobRole[];
    pay_breakdown: PayBreakdown;
    projected_pay: ProjectedPayBreakdown;
    is_archived?: boolean;
}

export interface ReturnFormData {
    id: number;
    user_id: number;
    season_id: number;
    season_name: string;
    season_start: string;
    season_end: string;
    status: EmployeeStatus;
    response_date?: string;
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        display_name: string;
    };
    job_roles: JobRole[];
    pay_breakdown: PayBreakdown;
    projected_pay: ProjectedPayBreakdown;
    already_submitted?: boolean;
}

export interface SRMPermissions {
    srm_view_own_pay: boolean;
    srm_view_all_pay: boolean;
    srm_manage_pay_config: boolean;
    srm_send_invites: boolean;
    srm_view_responses: boolean;
    srm_manage_status: boolean;
    srm_manage_templates: boolean;
    srm_view_retention: boolean;
    srm_bulk_actions: boolean;
}

export interface SRMRolePermissions extends SRMPermissions {
    job_role_id: number;
    job_role_name: string;
    job_role_tier: number;
}

// ==============================================
// New Hire Onboarding Types
// ==============================================

export type NewHireStatus = 'pending' | 'approved' | 'rejected';

export interface NewHire {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    position: string;
    is_accepting: boolean;
    needs_work_permit: boolean;
    status: NewHireStatus;
    wp_user_id: number | null;
    loi_sent: boolean;
    loi_sent_date: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

export interface LOISettings {
    header_image: string;
    footer_image: string;
    signature_image: string;
    organization_name: string;
    organization_address: string;
    organization_phone: string;
    organization_email: string;
    sender_name: string;
    sender_title: string;
    email_subject: string;
    email_body: string;
    template_body: string;
    // Notification settings
    notification_roles: string[]; // Array of WordPress role slugs
    notification_users: number[]; // Array of user IDs
}

export interface NewHireApplicationData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    address: string;
    position: string;
    is_accepting: boolean;
    needs_work_permit: boolean;
    honeypot?: string; // Bot trap field
}

export interface NewHireFilters {
    status?: NewHireStatus | 'all';
    needs_work_permit?: boolean | 'all';
    is_archived?: boolean | 'all';
    search?: string;
}