import {
    UserProfile,
    Goal,
    Update,
    Meeting,
    Attachment, 
    Comment,
    MentorshipRequest,
    DailyLog,
    JobRole,
    ReactionType,
    GroupedDailyLogs,
    TimeSlotDefinition,
    DailyLogPermissions,
    Location
} from '@/types';
// Import all our new API service methods
import { pluginGet, pluginPost, wpGet, wpPost, wpDelete, pluginUpload } from './api-service';

// --- USER ---
export const getCurrentUser = (userId: number): Promise<UserProfile> => {
    return pluginGet(`users/${userId}`);
};

export const updateUserProfile = async (userId: number, data: Partial<UserProfile>): Promise<UserProfile> => {
    const result = await pluginPost(`users/${userId}`, data, 'PUT');
    // Ensure required arrays exist to prevent .map() errors
    return {
        ...result,
        skills: result.skills || [],
        customLinks: result.customLinks || [],
    };
};

// --- Pagination Types ---
export interface PaginationInfo {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}

// --- MENTOR DIRECTORY & PORTFOLIO ---
export const getMentorDirectory = (page: number = 1, perPage: number = 50): Promise<{ mentors: UserProfile[], skills: string[], pagination: PaginationInfo }> => {
    return pluginGet(`directory?page=${page}&per_page=${perPage}`);
};

// --- THIS IS THE NEW FUNCTION ---
export const getPortfolioDirectory = (page: number = 1, perPage: number = 50): Promise<{ users: UserProfile[], pagination: PaginationInfo }> => {
    return pluginGet(`portfolio-directory?page=${page}&per_page=${perPage}`);
};

export const getUserPortfolio = (userId: number): Promise<{ user: UserProfile, goals: Goal[] }> => {
    return pluginGet(`portfolio/${userId}`);
};

// --- MENTORSHIP ---
export const getMyMentorships = (page: number = 1, perPage: number = 50): Promise<{ requests: MentorshipRequest[], pagination: PaginationInfo }> => {
    return pluginGet(`requests?page=${page}&per_page=${perPage}`);
};

export const getMentorshipDetails = (mentorshipId: number): Promise<MentorshipRequest> => {
    return pluginGet(`requests/${mentorshipId}`);
};

export const requestMentorship = (mentorId: number, message: string): Promise<any> => {
    return pluginPost('requests', { receiverId: mentorId, message });
};

export const updateMentorshipRequestStatus = (requestId: number, status: 'Accepted' | 'Rejected'): Promise<MentorshipRequest> => {
    return pluginPost(`requests/${requestId}/status`, { status }, 'PUT');
};

export const deleteMentorship = (mentorshipId: number): Promise<{ success: boolean, message: string, deleted: any }> => {
    return wpDelete(`mentorship-platform/v1/requests/${mentorshipId}`);
};

// --- ADMIN MENTORSHIP FUNCTIONS ---
export const getAllMentorshipsAdmin = (page: number = 1, perPage: number = 50): Promise<{ mentorships: MentorshipRequest[], pagination: PaginationInfo }> => {
    return pluginGet(`admin/all-mentorships?page=${page}&per_page=${perPage}`);
};

export const getMentorshipDetailsAdmin = (mentorshipId: number): Promise<MentorshipRequest> => {
    return pluginGet(`admin/mentorship-details/${mentorshipId}`);
};

export const getAllUsersAdmin = (): Promise<{id: number, name: string}[]> => {
    return pluginGet('admin/all-users');
};

export const createMentorshipAdmin = (mentorId: number, menteeId: number): Promise<MentorshipRequest> => {
    return pluginPost('admin/create-mentorship', { mentor_id: mentorId, mentee_id: menteeId });
};

// --- GOALS ---
export const addGoal = (mentorshipId: number, title: string, description: string): Promise<Goal> => {
    return pluginPost('goals', { mentorshipId, title, description, status: 'Not Started' });
};

export const updateGoal = (goal: Goal): Promise<Goal> => {
    return pluginPost(`goals/${goal.id}`, goal, 'PUT');
};

// --- FILE UPLOAD ---
export const uploadFile = (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    return pluginUpload('upload', formData);
};

// --- MEETINGS (NEW) ---
export const createMeeting = (meetingData: Omit<Meeting, 'id' | 'comments' | 'commentCount'> & { goalId: number }): Promise<Meeting> => {
    return pluginPost('meetings', meetingData);
};

export const updateMeeting = (meeting: Meeting): Promise<Meeting> => {
    return pluginPost(`meetings/${meeting.id}`, meeting, 'PUT');
};

export const deleteMeeting = (meetingId: number): Promise<void> => {
    return pluginPost(`meetings/${meetingId}`, {}, 'DELETE');
};

// --- UPDATES (NEW) ---
export const createUpdate = (updateData: Omit<Update, 'id' | 'author' | 'date'> & { goalId: number }): Promise<Update> => {
    return pluginPost('updates', updateData);
};

export const updateUser = (update: Update): Promise<Update> => {
    return pluginPost(`updates/${update.id}`, update, 'PUT');
};

export const updateUpdate = (update: Update): Promise<Update> => {
    return pluginPost(`updates/${update.id}`, update, 'PUT');
};

export const deleteUpdate = (updateId: number): Promise<void> => {
    return pluginPost(`updates/${updateId}`, {}, 'DELETE');
};


// --- NATIVE WORDPRESS COMMENT FUNCTIONS (FIXED) ---

/**
 * Fetches native WordPress comments for a specific post (update, initiative, etc.).
 */
export const getComments = (postId: number): Promise<Comment[]> => {
    // Calls GET /wp-json/wp/v2/comments?post=123
    // Added status=approve to only fetch approved comments (excluding trash, spam, etc.)
    return wpGet(`wp/v2/comments?post=${postId}&status=approve&orderby=date&order=asc&_embed=author`)
        .then((response: any) => {
            // Adapt the native WP comment structure to our 'Comment' type
            return response.map((wpComment: any) => ({
                id: wpComment.id,
                author: {
                    id: wpComment.author,
                    firstName: wpComment.author_name,
                    lastName: '', // Native WP doesn't provide this easily
                    avatarUrl: wpComment.author_avatar_urls['96'] || '',
                },
                content: wpComment.content.rendered,
                date: wpComment.date,
                parentId: wpComment.parent || undefined,
            }));
        });
};

/**
 * Adds a native WordPress comment to a specific post.
 */
export const addComment = (postId: number, content: string, currentUser: UserProfile, parentId?: number): Promise<Comment> => {
    // Calls POST /wp-json/wp/v2/comments
    const payload: any = {
        post: postId, // The ID of the CPT (e.g., the 'Update' post)
        content: content,
    };
    
    if (parentId) {
        payload.parent = parentId;
    }
    
    return wpPost('wp/v2/comments', payload).then((response: any) => {
        // Return a comment object with the current user's info for an optimistic update
        // This ensures the user's avatar and name appear instantly
        return {
            id: response.id,
            author: currentUser,
            content: response.content.rendered,
            date: response.date,
            parentId: parentId,
        };
    });
};

/**
 * Updates a WordPress comment.
 */
export const updateComment = (commentId: number, content: string): Promise<Comment> => {
    return wpPost(`wp/v2/comments/${commentId}`, {
        content: content,
    }).then((response: any) => {
        return {
            id: response.id,
            author: {
                id: response.author,
                firstName: response.author_name || '',
                lastName: '',
                avatarUrl: response.author_avatar_urls?.['96'] || '',
                tagline: '',
                mentorOptIn: false,
                skills: [],
                bioDetails: '',
                experience: '',
                customLinks: [],
            },
            content: response.content.rendered,
            date: response.date,
            parentId: response.parent || undefined,
        };
    });
};

/**
 * Deletes a WordPress comment.
 */
export const deleteComment = (commentId: number): Promise<void> => {
    return wpDelete(`wp/v2/comments/${commentId}?force=true`).then(() => {
        // WordPress API returns the deleted comment, but we don't need it
        return;
    });
};

// --- DAILY LOGS ---

/**
 * Fetches daily logs with optional filters and grouping
 */
export const getDailyLogs = (params?: {
    locationId?: number;
    logDate?: string;
    dateRange?: { start: string; end: string };
    timeSlot?: string;
    jobRoleId?: number;
    userId?: number;
    tags?: string[];
    search?: string;
    grouped?: boolean;
    page?: number;
    per_page?: number;
}): Promise<{ logs: DailyLog[] | GroupedDailyLogs; pagination: { page: number; per_page: number; total: number; total_pages: number; has_more: boolean } }> => {
    const queryParams = new URLSearchParams();
    
    if (params?.locationId) queryParams.append('location_id', params.locationId.toString());
    if (params?.logDate) queryParams.append('log_date', params.logDate);
    if (params?.dateRange) {
        queryParams.append('date_from', params.dateRange.start);
        queryParams.append('date_to', params.dateRange.end);
    }
    if (params?.timeSlot) queryParams.append('time_slot', params.timeSlot);
    if (params?.jobRoleId) queryParams.append('job_role_id', params.jobRoleId.toString());
    if (params?.userId) queryParams.append('user_id', params.userId.toString());
    if (params?.tags && params.tags.length > 0) {
        queryParams.append('tags', params.tags.join(','));
    }
    if (params?.search) queryParams.append('search', params.search);
    if (params?.grouped) queryParams.append('grouped', 'true');
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    
    const queryString = queryParams.toString();
    return pluginGet(`daily-logs${queryString ? `?${queryString}` : ''}`);
};

/**
 * Creates a new daily log
 */
export const createDailyLog = (logData: {
    title: string;
    blocksJson: any;
    locationId: number;
    logDate: string;
    timeSlotIds: number[];
    jobRoleId?: number;
    tags?: string[];
    status?: 'publish' | 'draft';
    authorId?: number;
}): Promise<DailyLog> => {
    // Convert BlockNote JSON to HTML for content field
    const content = blocksJsonToHtml(logData.blocksJson);
    
    return pluginPost('daily-logs', {
        ...logData,
        blocks: logData.blocksJson,
        content
    });
};

/**
 * Helper: Convert BlockNote JSON to HTML
 * Handles all BlockNote block types including images, videos, and rich formatting
 */
export function blocksJsonToHtml(blocks: any): string {
    if (!blocks || !Array.isArray(blocks)) return '';
    
    return blocks.map((block: any) => {
        const props = block.props || {};
        
        // Helper: Process inline content with styles
        const processInlineContent = (content: any[]): string => {
            if (!content || !Array.isArray(content)) return '';
            
            return content.map((item: any) => {
                if (item.type === 'text') {
                    let text = item.text || '';
                    const styles = item.styles || {};
                    
                    // Apply text styles
                    if (styles.bold) text = `<strong>${text}</strong>`;
                    if (styles.italic) text = `<em>${text}</em>`;
                    if (styles.underline) text = `<u>${text}</u>`;
                    if (styles.strikethrough) text = `<s>${text}</s>`;
                    if (styles.code) text = `<code>${text}</code>`;
                    
                    return text;
                } else if (item.type === 'link') {
                    const linkText = processInlineContent(item.content || []);
                    return `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
                }
                return '';
            }).join('');
        };
        
        const inlineContent = processInlineContent(block.content || []);
        
        // Handle different block types
        switch (block.type) {
            case 'heading':
                const level = props.level || 1;
                return `<h${level}>${inlineContent}</h${level}>`;
                
            case 'paragraph':
                return inlineContent ? `<p>${inlineContent}</p>` : '<p><br></p>';
                
            case 'bulletListItem':
                return `<ul><li>${inlineContent}</li></ul>`;
                
            case 'numberedListItem':
                return `<ol><li>${inlineContent}</li></ol>`;
                
            case 'checkListItem':
                const checked = props.checked ? 'checked' : '';
                return `<div class="checklist-item"><input type="checkbox" ${checked} disabled> ${inlineContent}</div>`;
                
            case 'image':
                const imgUrl = props.url || '';
                const imgCaption = props.caption || '';
                const imgAlt = props.name || imgCaption || 'Image';
                const imgWidth = props.previewWidth ? `style="max-width: ${props.previewWidth}px;"` : '';
                return imgUrl ? `<figure ${imgWidth}><img src="${imgUrl}" alt="${imgAlt}" />${imgCaption ? `<figcaption>${imgCaption}</figcaption>` : ''}</figure>` : '';
                
            case 'video':
                const videoUrl = props.url || '';
                const videoCaption = props.caption || '';
                const videoWidth = props.previewWidth ? `style="max-width: ${props.previewWidth}px;"` : '';
                return videoUrl ? `<figure ${videoWidth}><video src="${videoUrl}" controls></video>${videoCaption ? `<figcaption>${videoCaption}</figcaption>` : ''}</figure>` : '';
                
            case 'audio':
                const audioUrl = props.url || '';
                const audioCaption = props.caption || '';
                return audioUrl ? `<figure><audio src="${audioUrl}" controls></audio>${audioCaption ? `<figcaption>${audioCaption}</figcaption>` : ''}</figure>` : '';
                
            case 'file':
                const fileUrl = props.url || '';
                const fileName = props.name || 'Download file';
                return fileUrl ? `<p><a href="${fileUrl}" download>${fileName}</a></p>` : '';
                
            case 'table':
                // Tables are complex - just show placeholder for now
                return '<p>[Table content]</p>';
                
            case 'codeBlock':
                const code = inlineContent || '';
                const language = props.language || '';
                return `<pre><code class="language-${language}">${code}</code></pre>`;
                
            case 'blockquote':
                return `<blockquote>${inlineContent}</blockquote>`;
                
            default:
                return inlineContent ? `<p>${inlineContent}</p>` : '';
        }
    }).join('\n');
}

/**
 * Updates an existing daily log
 */
export const updateDailyLog = (logId: number, logData: Partial<{
    title: string;
    blocksJson: any;
    locationId: number;
    logDate: string;
    timeSlotIds: number[];
    jobRoleId?: number;
    tags?: string[];
    status?: 'publish' | 'draft';
    authorId?: number;
}>): Promise<DailyLog> => {
    // Convert BlockNote JSON to HTML if blocks are provided
    const payload: any = { ...logData };
    if (logData.blocksJson) {
        payload.content = blocksJsonToHtml(logData.blocksJson);
        payload.blocks = logData.blocksJson;
        delete payload.blocksJson;
    }
    
    return pluginPost(`daily-logs/${logId}`, payload, 'PUT');
};

/**
 * Deletes a daily log
 */
export const deleteDailyLog = (logId: number): Promise<void> => {
    return pluginPost(`daily-logs/${logId}`, {}, 'DELETE');
};

/**
 * Adds a reaction to a daily log
 */
export const addDailyLogReaction = (logId: number, reactionType: ReactionType): Promise<DailyLog> => {
    return pluginPost(`daily-logs/${logId}/reactions`, { reaction_type: reactionType });
};

/**
 * Removes a reaction from a daily log
 */
export const removeDailyLogReaction = (logId: number): Promise<DailyLog> => {
    return pluginPost(`daily-logs/${logId}/reactions`, {}, 'DELETE');
};

/**
 * Get detailed list of who reacted to a daily log
 */
export const getDailyLogReactionDetails = (logId: number): Promise<{
    thumbs_up: Array<{ user: UserProfile; createdAt: string }>;
    thumbs_down: Array<{ user: UserProfile; createdAt: string }>;
    heart: Array<{ user: UserProfile; createdAt: string }>;
}> => {
    return pluginGet(`daily-logs/${logId}/reactions/details`);
};

/**
 * Get lifetime reaction stats for a user (reactions received on their daily logs)
 */
export interface UserReactionStats {
    userId: number;
    thumbs_up: number;
    thumbs_down: number;
    heart: number;
    total: number;
}

export const getUserReactionStats = (userId: number): Promise<UserReactionStats> => {
    return pluginGet(`users/${userId}/reaction-stats`);
};

/**
 * Get lifetime reaction stats for multiple users at once (batch request)
 * Returns a map of userId -> stats
 */
export const getBatchUserReactionStats = (userIds: number[]): Promise<Record<number, UserReactionStats>> => {
    if (userIds.length === 0) {
        return Promise.resolve({});
    }
    return pluginPost('users/reaction-stats/batch', { user_ids: userIds });
};

/**
 * Adds a reaction to a comment
 */
export const addCommentReaction = (commentId: number, reactionType: ReactionType): Promise<{
    commentId: number;
    reactionCounts: { thumbs_up: number; thumbs_down: number; heart: number };
    userReaction: ReactionType | null;
}> => {
    return pluginPost(`comments/${commentId}/reactions`, { reaction_type: reactionType });
};

/**
 * Removes a reaction from a comment
 */
export const removeCommentReaction = (commentId: number): Promise<{
    commentId: number;
    reactionCounts: { thumbs_up: number; thumbs_down: number; heart: number };
    userReaction: ReactionType | null;
}> => {
    return pluginPost(`comments/${commentId}/reactions`, {}, 'DELETE');
};

/**
 * Get detailed list of who reacted to a comment
 */
export const getCommentReactionDetails = (commentId: number): Promise<{
    thumbs_up: Array<{ user: UserProfile; createdAt: string }>;
    thumbs_down: Array<{ user: UserProfile; createdAt: string }>;
    heart: Array<{ user: UserProfile; createdAt: string }>;
}> => {
    return pluginGet(`comments/${commentId}/reactions/details`);
};

/**
 * Fetches all job roles
 */
export const getJobRoles = (): Promise<JobRole[]> => {
    return pluginGet('job-roles');
};

// --- TIME SLOT MANAGEMENT (ADMIN - Tier 5/6) ---

/**
 * Fetches all time slot definitions (active and inactive)
 */
export const getTimeSlots = (activeOnly: boolean = true): Promise<TimeSlotDefinition[]> => {
    return pluginGet(`time-slots${activeOnly ? '?active_only=true' : ''}`);
};

/**
 * Creates a new time slot definition
 */
export const createTimeSlot = (slotData: {
    slug: string;
    label: string;
    description?: string;
    sortOrder?: number;
    color?: string;
}): Promise<TimeSlotDefinition> => {
    return pluginPost('time-slots', slotData);
};

/**
 * Updates an existing time slot definition
 */
export const updateTimeSlot = (slotId: number, slotData: Partial<{
    slug: string;
    label: string;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    color?: string;
}>): Promise<TimeSlotDefinition> => {
    return pluginPost(`time-slots/${slotId}`, slotData, 'PUT');
};

/**
 * Deletes a time slot definition (soft delete - sets isActive to false)
 */
export const deleteTimeSlot = (slotId: number): Promise<void> => {
    return pluginPost(`time-slots/${slotId}`, {}, 'DELETE');
};

/**
 * Reorders time slots (updates sortOrder for multiple slots)
 */
export const reorderTimeSlots = (slotIds: number[]): Promise<TimeSlotDefinition[]> => {
    return pluginPost('time-slots/reorder', { slot_ids: slotIds });
};

// --- LOCATION MANAGEMENT (ADMIN - Tier 5/6) ---

/**
 * Fetches all location definitions
 */
export const getLocations = (): Promise<Location[]> => {
    return pluginGet('pg/locations');
};

/**
 * Creates a new location
 */
export const createLocation = (locationData: {
    name: string;
    description?: string;
}): Promise<Location> => {
    return pluginPost('pg/locations', locationData);
};

/**
 * Updates an existing location
 */
export const updateLocation = (locationId: number, locationData: Partial<{
    name: string;
    description?: string;
    sort_order?: number;
}>): Promise<Location> => {
    return pluginPost(`pg/locations/${locationId}`, locationData, 'PUT');
};

/**
 * Deletes a location (soft delete - sets is_active to false)
 */
export const deleteLocation = (locationId: number): Promise<void> => {
    return pluginPost(`pg/locations/${locationId}`, {}, 'DELETE');
};

// --- DAILY LOG PERMISSIONS (ADMIN - Tier 5/6) ---

/**
 * Fetches daily log permissions for all job roles
 */
export const getDailyLogPermissions = (): Promise<DailyLogPermissions[]> => {
    return pluginGet('daily-log-permissions');
};

/**
 * Updates daily log permissions for a specific job role
 */
export const updateDailyLogPermissions = (
    jobRoleId: number,
    permissions: Partial<Omit<DailyLogPermissions, 'jobRoleId'>>
): Promise<DailyLogPermissions> => {
    return pluginPost(`daily-log-permissions/${jobRoleId}`, permissions, 'PUT');
};

/**
 * Batch update permissions for multiple job roles
 */
export const batchUpdateDailyLogPermissions = (
    updates: Array<{ jobRoleId: number; permissions: Partial<Omit<DailyLogPermissions, 'jobRoleId'>> }>
): Promise<DailyLogPermissions[]> => {
    return pluginPost('daily-log-permissions/batch', { updates });
};

/**
 * Sync daily log permissions - creates missing permissions for all job roles
 */
export const syncDailyLogPermissions = (): Promise<{
    success: boolean;
    message: string;
    added: number;
    skipped: number;
    total: number;
}> => {
    return pluginPost('daily-log-permissions/sync', {});
};

/**
 * Get all unique tags used across all daily logs
 */
export const getAllDailyLogTags = async (): Promise<string[]> => {
    try {
        // Fetch recent logs (last 100) to get tag suggestions
        const response = await getDailyLogs({ per_page: 100 });
        const logs = Array.isArray(response.logs) ? response.logs : [];
        
        // Extract and flatten all tags
        const allTags = logs
            .flatMap(log => log.tags || [])
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        // Get unique tags and sort by frequency
        const tagCounts = allTags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1]) // Sort by frequency
            .map(([tag]) => tag);
    } catch (error) {
        console.error('Error fetching tags:', error);
        return [];
    }
};