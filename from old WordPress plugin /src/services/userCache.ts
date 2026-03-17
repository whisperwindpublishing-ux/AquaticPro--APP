/**
 * Centralized User Cache Service
 * 
 * Provides site-wide caching for user lists to avoid redundant database calls.
 * Features:
 * - Global singleton cache shared across all components
 * - Time-based expiration (default 15 minutes)
 * - Request deduplication (prevents multiple simultaneous API calls)
 * - Pre-sorted by last name, first name
 * - Multiple format options for different use cases
 * - localStorage persistence to survive page reloads
 */

import { getAllUsersWithMetadata, UserMetadata } from './api-user-management';
import { sortUsersByName } from '@/utils/userSorting';

// Cache duration in milliseconds (15 minutes - matches server-side transient cache)
const CACHE_DURATION = 15 * 60 * 1000;
const STORAGE_KEY = 'mp_user_cache';

// Simple user format for basic dropdowns
export interface CachedSimpleUser {
    id: number;
    name: string;
}

// Extended user format with more details
export interface CachedUserWithDetails {
    id: number;
    name: string;
    displayName: string;
    firstName: string | undefined;
    lastName: string | undefined;
    email: string | undefined;
    jobRole: string | undefined;
    tier: number | undefined;
}

// Full metadata format
export type CachedUserMetadata = UserMetadata;

// Cache state
interface CacheState {
    users: UserMetadata[] | null;
    lastFetched: number;
    fetchPromise: Promise<UserMetadata[]> | null;
}

const cache: CacheState = {
    users: null,
    lastFetched: 0,
    fetchPromise: null,
};

/**
 * Try to restore cache from localStorage on module load
 */
const restoreFromStorage = (): void => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.users && parsed.lastFetched) {
                const ageMs = Date.now() - parsed.lastFetched;
                // Only restore if not expired
                if (ageMs < CACHE_DURATION) {
                    cache.users = parsed.users;
                    cache.lastFetched = parsed.lastFetched;
                    console.log(`[UserCache] Restored ${parsed.users.length} users from localStorage (age: ${Math.round(ageMs/1000)}s)`);
                } else {
                    console.log(`[UserCache] localStorage cache expired (age: ${Math.round(ageMs/1000)}s)`);
                }
            }
        } else {
            console.log('[UserCache] No localStorage cache found');
        }
    } catch (e) {
        console.log('[UserCache] Failed to restore from localStorage:', e);
    }
};

/**
 * Save cache to localStorage
 */
const saveToStorage = (): void => {
    try {
        if (cache.users) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                users: cache.users,
                lastFetched: cache.lastFetched,
            }));
        }
    } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
    }
};

// Restore on module load
restoreFromStorage();

/**
 * Check if cache is still valid
 */
const isCacheValid = (): boolean => {
    return cache.users !== null && (Date.now() - cache.lastFetched) < CACHE_DURATION;
};

/**
 * Fetch users and update cache
 * Handles request deduplication automatically
 */
const fetchAndCache = async (): Promise<UserMetadata[]> => {
    // If there's already a fetch in progress, return that promise
    if (cache.fetchPromise) {
        console.log('[UserCache] Deduped: reusing existing fetch promise');
        return cache.fetchPromise;
    }
    
    const startTime = performance.now();
    console.log('[UserCache] Starting fresh fetch...');
    
    // Create new fetch promise - fetch only members who are not archived
    cache.fetchPromise = getAllUsersWithMetadata('false', 'true')
        .then((users) => {
            const fetchTime = performance.now() - startTime;
            console.log(`[UserCache] Fetch completed in ${fetchTime.toFixed(0)}ms, got ${users.length} users`);
            
            // Sort by last name, first name before caching
            const sortedUsers = sortUsersByName(users);
            cache.users = sortedUsers;
            cache.lastFetched = Date.now();
            cache.fetchPromise = null;
            // Persist to localStorage for cross-page-load caching
            saveToStorage();
            
            const totalTime = performance.now() - startTime;
            console.log(`[UserCache] Total processing time: ${totalTime.toFixed(0)}ms`);
            return sortedUsers;
        })
        .catch((error) => {
            const errorTime = performance.now() - startTime;
            console.error(`[UserCache] Fetch failed after ${errorTime.toFixed(0)}ms:`, error);
            cache.fetchPromise = null;
            throw error;
        });
    
    return cache.fetchPromise;
};

/**
 * Get all users with full metadata (sorted by last name, first name)
 * This is the primary method - use when you need all user fields
 */
export const getCachedUsers = async (): Promise<UserMetadata[]> => {
    if (isCacheValid()) {
        const ageSeconds = Math.round((Date.now() - cache.lastFetched) / 1000);
        console.log(`[UserCache] Cache HIT - ${cache.users!.length} users, age ${ageSeconds}s`);
        return cache.users!;
    }
    console.log('[UserCache] Cache MISS - fetching fresh data');
    return fetchAndCache();
};

/**
 * Get users in simple format (id, name) for basic dropdowns
 * Compatible with AdminPanel and UserJobAssignments SimpleUser interface
 */
export const getCachedSimpleUsers = async (): Promise<CachedSimpleUser[]> => {
    const users = await getCachedUsers();
    return users.map(user => ({
        id: user.user_id,
        name: user.display_name,
    }));
};

/**
 * Get users with extended details for rich dropdowns
 * Compatible with TaskDeck/TaskCardModal SimpleUser interface
 */
export const getCachedUsersWithDetails = async (): Promise<CachedUserWithDetails[]> => {
    const users = await getCachedUsers();
    return users.map(user => ({
        id: user.user_id,
        name: user.display_name,
        displayName: user.display_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.user_email,
        jobRole: user.job_role_titles,
        tier: user.tier,
    }));
};

/**
 * Force refresh the cache
 * Use when you know data has changed (e.g., after creating/updating a user)
 */
export const refreshUserCache = async (): Promise<UserMetadata[]> => {
    cache.users = null;
    cache.lastFetched = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    return fetchAndCache();
};

/**
 * Invalidate the cache without fetching
 * Use when you want the next request to fetch fresh data
 */
export const invalidateUserCache = (): void => {
    cache.users = null;
    cache.lastFetched = 0;
    cache.fetchPromise = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
};

/**
 * Pre-warm the cache
 * Call early (e.g., on app init) to have data ready when needed
 */
export const preloadUserCache = (): void => {
    if (!isCacheValid() && !cache.fetchPromise) {
        fetchAndCache().catch(err => {
            console.warn('Failed to preload user cache:', err);
        });
    }
};

/**
 * Get cache status for debugging
 */
export const getCacheStatus = (): { 
    isCached: boolean; 
    userCount: number; 
    ageMs: number;
    isLoading: boolean;
} => {
    return {
        isCached: cache.users !== null,
        userCount: cache.users?.length ?? 0,
        ageMs: cache.users ? Date.now() - cache.lastFetched : 0,
        isLoading: cache.fetchPromise !== null,
    };
};

// ============================================================================
// AJAX-Based Functions (No full cache loading)
// Use these for large datasets where loading all data is impractical
// ============================================================================

/**
 * Fetch instructors (users) by specific IDs directly from API
 * Use this to display group cards without loading ALL users
 * 
 * @param ids Array of user IDs to fetch
 * @returns Array of instructor data { id, name }
 */
export const fetchInstructorsByIds = async (ids: number[]): Promise<CachedSimpleUser[]> => {
    if (!ids || ids.length === 0) {
        return [];
    }

    const idSet = new Set(ids);

    // Fast path: in-memory cache is warm — no API call needed
    if (isCacheValid() && cache.users) {
        const fromCache = cache.users
            .filter(u => idSet.has(u.user_id))
            .map(u => ({ id: u.user_id, name: u.display_name }));
        console.log(`[UserCache] fetchInstructorsByIds: resolved ${fromCache.length}/${ids.length} from memory cache`);
        return fromCache;
    }

    // If a full-cache fetch is already in flight, wait for it and filter
    if (cache.fetchPromise) {
        console.log('[UserCache] fetchInstructorsByIds: awaiting in-progress cache fetch');
        const users = await cache.fetchPromise;
        return users
            .filter(u => idSet.has(u.user_id))
            .map(u => ({ id: u.user_id, name: u.display_name }));
    }

    // Cache miss — fall back to direct by-IDs endpoint
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    try {
        const response = await fetch(`${apiUrl}lm/v1/instructors-by-ids`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ids }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch instructors by IDs: ${response.status}`);
        }
        
        const data = await response.json();
        return data.instructors || [];
    } catch (error) {
        console.error('[UserCache] fetchInstructorsByIds failed:', error);
        throw error;
    }
};
