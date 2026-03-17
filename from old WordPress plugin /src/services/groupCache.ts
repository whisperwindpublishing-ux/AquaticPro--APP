/**
 * Centralized Group Cache Service
 * 
 * Provides site-wide caching for lesson management group lists to avoid redundant database calls.
 * This cache is specifically designed for the Lesson Management module.
 * 
 * Features:
 * - Global singleton cache shared across all lesson management components
 * - Time-based expiration (default 10 minutes - groups change more frequently than swimmers)
 * - Request deduplication (prevents multiple simultaneous API calls)
 * - Pre-sorted by title
 * - Lazy loading - only fetches when lesson management is accessed
 * - localStorage persistence to survive page reloads
 * - Per-camp filtering support
 * 
 * @see swimmerCache.ts - Similar implementation for swimmers
 * @see userCache.ts - Similar implementation for users
 */

// Cache duration in milliseconds (10 minutes - groups may change more frequently than swimmers)
const CACHE_DURATION = 10 * 60 * 1000;
const STORAGE_KEY = 'mp_group_cache';

// Group interface matching the WP REST API response
export interface CachedGroup {
    id: number;
    title: { rendered: string };
    status: string;
    lm_camp?: number[];
    lm_animal?: number[];
    lm_lesson_type?: number[];
    meta?: {
        instructor?: number[];
        swimmers?: number[];
        swimmer_grouping?: Record<string, number[]>;
        level?: number;
        days?: string[];
        group_time?: string;
        notes?: string;
        dates_offered?: string[];
        media?: number;
        year?: number;
        archived?: boolean;
    };
}

// Simple group format for dropdowns
export interface SimpleGroup {
    id: number;
    name: string;
    campId?: number;
    animalId?: number;
}

// Cache state
interface CacheState {
    groups: CachedGroup[] | null;
    lastFetched: number;
    fetchPromise: Promise<CachedGroup[]> | null;
}

const cache: CacheState = {
    groups: null,
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
            if (parsed.groups && parsed.lastFetched) {
                const ageMs = Date.now() - parsed.lastFetched;
                // Only restore if not expired
                if (ageMs < CACHE_DURATION) {
                    cache.groups = parsed.groups;
                    cache.lastFetched = parsed.lastFetched;
                    console.log(`[GroupCache] Restored ${parsed.groups.length} groups from localStorage (age: ${Math.round(ageMs/1000)}s)`);
                } else {
                    console.log(`[GroupCache] localStorage cache expired (age: ${Math.round(ageMs/1000)}s)`);
                }
            }
        } else {
            console.log('[GroupCache] No localStorage cache found');
        }
    } catch (e) {
        console.log('[GroupCache] Failed to restore from localStorage:', e);
    }
};

/**
 * Save cache to localStorage
 */
const saveToStorage = (): void => {
    try {
        if (cache.groups) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                groups: cache.groups,
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
    return cache.groups !== null && (Date.now() - cache.lastFetched) < CACHE_DURATION;
};

/**
 * Fetch all groups from server-side cached endpoint.
 * This is MUCH faster than the paginated WP REST API because:
 * 1. Server caches the result in a WordPress transient (10 min TTL)
 * 2. Single request instead of multiple paginated requests
 * 3. Optimized query with no_found_rows for better performance
 */
const fetchAllGroups = async (): Promise<CachedGroup[]> => {
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    try {
        // Use the server-cached endpoint
        const response = await fetch(`${apiUrl}lm/v1/groups-cached`, { headers });
        
        if (!response.ok) {
            // Fallback to legacy pagination if cached endpoint not available
            console.log('[GroupCache] Cached endpoint failed, falling back to paginated fetch');
            return fetchAllGroupsLegacy();
        }
        
        const data = await response.json();
        console.log(`[GroupCache] Server cache ${data.cached ? 'HIT' : 'MISS'}, got ${data.count} groups`);
        
        // Data is already sorted by title from the server
        return data.groups as CachedGroup[];
    } catch (error) {
        console.log('[GroupCache] Cached endpoint error, falling back to paginated fetch:', error);
        return fetchAllGroupsLegacy();
    }
};

/**
 * Legacy paginated fetch - fallback if cached endpoint not available
 */
const fetchAllGroupsLegacy = async (): Promise<CachedGroup[]> => {
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    const allGroups: CachedGroup[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await fetch(
            `${apiUrl}wp/v2/lm-group?orderby=title&order=asc&per_page=100&page=${page}`,
            { headers }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch groups: ${response.status}`);
        }
        
        const groups: CachedGroup[] = await response.json();
        allGroups.push(...groups);
        
        // Check if there are more pages
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        hasMore = page < totalPages;
        page++;
    }
    
    // Sort by name (title.rendered)
    return allGroups.sort((a, b) => {
        const nameA = (a.title?.rendered || '').toLowerCase();
        const nameB = (b.title?.rendered || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
};

/**
 * Fetch groups and update cache
 * Handles request deduplication automatically
 */
const fetchAndCache = async (): Promise<CachedGroup[]> => {
    // If there's already a fetch in progress, return that promise
    if (cache.fetchPromise) {
        console.log('[GroupCache] Deduped: reusing existing fetch promise');
        return cache.fetchPromise;
    }
    
    const startTime = performance.now();
    console.log('[GroupCache] Starting fresh fetch...');
    
    // Create new fetch promise
    cache.fetchPromise = fetchAllGroups()
        .then((groups) => {
            const fetchTime = performance.now() - startTime;
            console.log(`[GroupCache] Fetch completed in ${fetchTime.toFixed(0)}ms, got ${groups.length} groups`);
            
            cache.groups = groups;
            cache.lastFetched = Date.now();
            cache.fetchPromise = null;
            // Persist to localStorage for cross-page-load caching
            saveToStorage();
            return groups;
        })
        .catch((error) => {
            const errorTime = performance.now() - startTime;
            console.error(`[GroupCache] Fetch failed after ${errorTime.toFixed(0)}ms:`, error);
            cache.fetchPromise = null;
            throw error;
        });
    
    return cache.fetchPromise;
};

/**
 * Get all groups (sorted by name)
 * This is the primary method - use when you need full group data
 */
export const getCachedGroups = async (): Promise<CachedGroup[]> => {
    if (isCacheValid()) {
        const ageSeconds = Math.round((Date.now() - cache.lastFetched) / 1000);
        console.log(`[GroupCache] Cache HIT - ${cache.groups!.length} groups, age ${ageSeconds}s`);
        return cache.groups!;
    }
    console.log('[GroupCache] Cache MISS - fetching fresh data');
    return fetchAndCache();
};

/**
 * Get groups in simple format (id, name, campId, animalId) for dropdowns
 */
export const getSimpleGroups = async (): Promise<SimpleGroup[]> => {
    const groups = await getCachedGroups();
    return groups.map(g => ({
        id: g.id,
        name: g.title?.rendered || `Group #${g.id}`,
        campId: g.lm_camp?.[0],
        animalId: g.lm_animal?.[0],
    }));
};

/**
 * Get a single group by ID from cache, or fetch if not found
 */
export const getGroupById = async (id: number): Promise<CachedGroup | null> => {
    const groups = await getCachedGroups();
    return groups.find(g => g.id === id) || null;
};

/**
 * Get multiple groups by IDs
 */
export const getGroupsByIds = async (ids: number[]): Promise<CachedGroup[]> => {
    const groups = await getCachedGroups();
    const idSet = new Set(ids);
    return groups.filter(g => idSet.has(g.id));
};

/**
 * Get groups filtered by camp ID
 */
export const getGroupsByCamp = async (campId: number, includeArchived: boolean = false): Promise<CachedGroup[]> => {
    const groups = await getCachedGroups();
    return groups.filter(g => {
        const inCamp = g.lm_camp?.includes(campId) || false;
        const isArchived = g.meta?.archived || false;
        return inCamp && (includeArchived || !isArchived);
    });
};

/**
 * Get groups filtered by animal ID
 */
export const getGroupsByAnimal = async (animalId: number, includeArchived: boolean = false): Promise<CachedGroup[]> => {
    const groups = await getCachedGroups();
    return groups.filter(g => {
        const hasAnimal = g.lm_animal?.includes(animalId) || false;
        const isArchived = g.meta?.archived || false;
        return hasAnimal && (includeArchived || !isArchived);
    });
};

/**
 * Get non-archived groups only
 */
export const getActiveGroups = async (): Promise<CachedGroup[]> => {
    const groups = await getCachedGroups();
    return groups.filter(g => !g.meta?.archived);
};

/**
 * Force refresh the cache
 * Use when you know data has changed (e.g., after creating/updating a group)
 */
export const refreshGroupCache = async (): Promise<CachedGroup[]> => {
    cache.groups = null;
    cache.lastFetched = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    return fetchAndCache();
};

/**
 * Invalidate the cache without fetching
 * Use when you want the next request to fetch fresh data
 */
export const invalidateGroupCache = (): void => {
    cache.groups = null;
    cache.lastFetched = 0;
    cache.fetchPromise = null;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore storage errors
    }
    console.log('[GroupCache] Cache invalidated');
};

/**
 * Pre-warm the cache
 * Call when entering lesson management to have data ready
 */
export const preloadGroupCache = (): void => {
    if (!isCacheValid() && !cache.fetchPromise) {
        fetchAndCache().catch(err => {
            console.warn('Failed to preload group cache:', err);
        });
    }
};

/**
 * Get cache status for debugging
 */
export const getGroupCacheStatus = (): { 
    isCached: boolean; 
    groupCount: number; 
    ageMs: number;
    isLoading: boolean;
} => {
    return {
        isCached: cache.groups !== null,
        groupCount: cache.groups?.length ?? 0,
        ageMs: cache.groups ? Date.now() - cache.lastFetched : 0,
        isLoading: cache.fetchPromise !== null,
    };
};

// ============================================================================
// AJAX-Based Functions (No full cache loading)
// Use these for large datasets where loading all data is impractical
// ============================================================================

/**
 * Fetch groups by specific IDs directly from API
 * Use this to display specific groups without loading ALL groups
 * 
 * @param ids Array of group IDs to fetch
 * @returns Array of group data
 */
export const fetchGroupsByIds = async (ids: number[]): Promise<CachedGroup[]> => {
    if (!ids || ids.length === 0) {
        return [];
    }
    
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    try {
        const response = await fetch(`${apiUrl}lm/v1/groups-by-ids`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ids }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch groups by IDs: ${response.status}`);
        }
        
        const data = await response.json();
        return data.groups || [];
    } catch (error) {
        console.error('[GroupCache] fetchGroupsByIds failed:', error);
        throw error;
    }
};

/**
 * Search result interface for AJAX search
 */
export interface GroupSearchResult {
    groups: CachedGroup[];
    page: number;
    totalPages: number;
    hasMore: boolean;
}

/**
 * AJAX search for groups with pagination
 * Use this for searching groups without loading all groups
 * 
 * @param search Search term (empty string returns all alphabetically)
 * @param page Page number (1-indexed)
 * @param campId Optional camp ID filter
 * @returns Paginated search results
 */
export const searchGroups = async (
    search: string, 
    page: number = 1,
    campId?: number
): Promise<GroupSearchResult> => {
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', String(page));
    if (campId) params.append('camp_id', String(campId));
    
    try {
        const response = await fetch(`${apiUrl}lm/v1/search-groups?${params.toString()}`, {
            headers,
        });
        
        if (!response.ok) {
            throw new Error(`Failed to search groups: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            groups: data.groups || [],
            page: data.page || 1,
            totalPages: data.total_pages || 1,
            hasMore: data.has_more || false,
        };
    } catch (error) {
        console.error('[GroupCache] searchGroups failed:', error);
        throw error;
    }
};
