/**
 * Centralized Swimmer Cache Service
 * 
 * Provides site-wide caching for swimmer lists to avoid redundant database calls.
 * This cache is specifically designed for the Lesson Management module.
 * 
 * Features:
 * - Global singleton cache shared across all lesson management components
 * - Time-based expiration (default 30 minutes - swimmers change infrequently)
 * - Request deduplication (prevents multiple simultaneous API calls)
 * - Pre-sorted by name
 * - Lazy loading - only fetches when lesson management is accessed
 * - localStorage persistence to survive page reloads
 */

// Cache duration in milliseconds (30 minutes - swimmers change infrequently)
const CACHE_DURATION = 30 * 60 * 1000;
const STORAGE_KEY = 'mp_swimmer_cache';

// Swimmer interface matching the WP REST API response
export interface CachedSwimmer {
    id: number;
    title: { rendered: string };
    meta?: {
        parent_name?: string;
        parent_email?: string;
        date_of_birth?: string;
        notes?: string;
        current_level?: number;
        archived?: boolean;
        skills_mastered?: Array<{ skill_id: number; date: string }>;
        levels_mastered?: number[];
    };
    // Flattened fields that may exist at top level or in meta
    parent_name?: string;
    parent_email?: string;
    date_of_birth?: string;
    notes?: string;
    current_level?: number;
    archived?: boolean;
}

// Simple swimmer format for dropdowns
export interface SimpleSwimmer {
    id: number;
    name: string;
}

// Cache state
interface CacheState {
    swimmers: CachedSwimmer[] | null;
    lastFetched: number;
    fetchPromise: Promise<CachedSwimmer[]> | null;
}

const cache: CacheState = {
    swimmers: null,
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
            if (parsed.swimmers && parsed.lastFetched) {
                const ageMs = Date.now() - parsed.lastFetched;
                // Only restore if not expired
                if (ageMs < CACHE_DURATION) {
                    cache.swimmers = parsed.swimmers;
                    cache.lastFetched = parsed.lastFetched;
                    console.log(`[SwimmerCache] Restored ${parsed.swimmers.length} swimmers from localStorage (age: ${Math.round(ageMs/1000)}s)`);
                } else {
                    console.log(`[SwimmerCache] localStorage cache expired (age: ${Math.round(ageMs/1000)}s)`);
                }
            }
        } else {
            console.log('[SwimmerCache] No localStorage cache found');
        }
    } catch (e) {
        console.log('[SwimmerCache] Failed to restore from localStorage:', e);
    }
};

/**
 * Save cache to localStorage
 */
const saveToStorage = (): void => {
    try {
        if (cache.swimmers) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                swimmers: cache.swimmers,
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
    return cache.swimmers !== null && (Date.now() - cache.lastFetched) < CACHE_DURATION;
};

/**
 * Fetch all swimmers from server-side cached endpoint.
 * This is MUCH faster than the paginated WP REST API because:
 * 1. Server caches the result in a WordPress transient (30 min TTL)
 * 2. Single request instead of multiple paginated requests
 * 3. Optimized query with no_found_rows for better performance
 */
const fetchAllSwimmers = async (): Promise<CachedSwimmer[]> => {
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    try {
        // Use the new server-cached endpoint
        const response = await fetch(`${apiUrl}lm/v1/swimmers-cached`, { headers });
        
        if (!response.ok) {
            // Fallback to legacy pagination if cached endpoint not available
            console.log('[SwimmerCache] Cached endpoint failed, falling back to paginated fetch');
            return fetchAllSwimmersLegacy();
        }
        
        const data = await response.json();
        console.log(`[SwimmerCache] Server cache ${data.cached ? 'HIT' : 'MISS'}, got ${data.count} swimmers`);
        
        // Data is already sorted by title from the server
        return data.swimmers as CachedSwimmer[];
    } catch (error) {
        console.log('[SwimmerCache] Cached endpoint error, falling back to paginated fetch:', error);
        return fetchAllSwimmersLegacy();
    }
};

/**
 * Legacy paginated fetch - fallback if cached endpoint not available
 */
const fetchAllSwimmersLegacy = async (): Promise<CachedSwimmer[]> => {
    const apiUrl = window.mentorshipPlatformData?.restUrl || '/wp-json/';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (nonce) {
        headers['X-WP-Nonce'] = nonce;
    }
    
    const allSwimmers: CachedSwimmer[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await fetch(
            `${apiUrl}wp/v2/lm-swimmer?orderby=title&order=asc&per_page=100&page=${page}`,
            { headers }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch swimmers: ${response.status}`);
        }
        
        const swimmers: CachedSwimmer[] = await response.json();
        allSwimmers.push(...swimmers);
        
        // Check if there are more pages
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        hasMore = page < totalPages;
        page++;
    }
    
    // Sort by name (title.rendered)
    return allSwimmers.sort((a, b) => {
        const nameA = (a.title?.rendered || '').toLowerCase();
        const nameB = (b.title?.rendered || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
};

/**
 * Fetch swimmers and update cache
 * Handles request deduplication automatically
 */
const fetchAndCache = async (): Promise<CachedSwimmer[]> => {
    // If there's already a fetch in progress, return that promise
    if (cache.fetchPromise) {
        console.log('[SwimmerCache] Deduped: reusing existing fetch promise');
        return cache.fetchPromise;
    }
    
    const startTime = performance.now();
    console.log('[SwimmerCache] Starting fresh fetch...');
    
    // Create new fetch promise
    cache.fetchPromise = fetchAllSwimmers()
        .then((swimmers) => {
            const fetchTime = performance.now() - startTime;
            console.log(`[SwimmerCache] Fetch completed in ${fetchTime.toFixed(0)}ms, got ${swimmers.length} swimmers`);
            
            cache.swimmers = swimmers;
            cache.lastFetched = Date.now();
            cache.fetchPromise = null;
            // Persist to localStorage for cross-page-load caching
            saveToStorage();
            return swimmers;
        })
        .catch((error) => {
            const errorTime = performance.now() - startTime;
            console.error(`[SwimmerCache] Fetch failed after ${errorTime.toFixed(0)}ms:`, error);
            cache.fetchPromise = null;
            throw error;
        });
    
    return cache.fetchPromise;
};

/**
 * Get all swimmers (sorted by name)
 * This is the primary method - use when you need full swimmer data
 */
export const getCachedSwimmers = async (): Promise<CachedSwimmer[]> => {
    if (isCacheValid()) {
        const ageSeconds = Math.round((Date.now() - cache.lastFetched) / 1000);
        console.log(`[SwimmerCache] Cache HIT - ${cache.swimmers!.length} swimmers, age ${ageSeconds}s`);
        return cache.swimmers!;
    }
    console.log('[SwimmerCache] Cache MISS - fetching fresh data');
    return fetchAndCache();
};

/**
 * Get swimmers in simple format (id, name) for dropdowns
 */
export const getSimpleSwimmers = async (): Promise<SimpleSwimmer[]> => {
    const swimmers = await getCachedSwimmers();
    return swimmers.map(s => ({
        id: s.id,
        name: s.title?.rendered || `Swimmer #${s.id}`,
    }));
};

/**
 * Get a single swimmer by ID from cache, or fetch if not found
 */
export const getSwimmerById = async (id: number): Promise<CachedSwimmer | null> => {
    const swimmers = await getCachedSwimmers();
    return swimmers.find(s => s.id === id) || null;
};

/**
 * Get multiple swimmers by IDs
 */
export const getSwimmersByIds = async (ids: number[]): Promise<CachedSwimmer[]> => {
    const swimmers = await getCachedSwimmers();
    const idSet = new Set(ids);
    return swimmers.filter(s => idSet.has(s.id));
};

/**
 * Force refresh the cache
 * Use when you know data has changed (e.g., after creating/updating a swimmer)
 */
export const refreshSwimmerCache = async (): Promise<CachedSwimmer[]> => {
    cache.swimmers = null;
    cache.lastFetched = 0;
    return fetchAndCache();
};

/**
 * Invalidate the cache without fetching
 * Use when you want the next request to fetch fresh data
 */
export const invalidateSwimmerCache = (): void => {
    cache.swimmers = null;
    cache.lastFetched = 0;
    cache.fetchPromise = null;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore storage errors
    }
};

/**
 * Pre-warm the cache
 * Call when entering lesson management to have data ready
 */
export const preloadSwimmerCache = (): void => {
    if (!isCacheValid() && !cache.fetchPromise) {
        fetchAndCache().catch(err => {
            console.warn('Failed to preload swimmer cache:', err);
        });
    }
};

/**
 * Get cache status for debugging
 */
export const getSwimmerCacheStatus = (): { 
    isCached: boolean; 
    swimmerCount: number; 
    ageMs: number;
    isLoading: boolean;
} => {
    return {
        isCached: cache.swimmers !== null,
        swimmerCount: cache.swimmers?.length ?? 0,
        ageMs: cache.swimmers ? Date.now() - cache.lastFetched : 0,
        isLoading: cache.fetchPromise !== null,
    };
};

// ============================================================================
// AJAX-Based Functions (No full cache loading)
// Use these for large datasets where loading all data is impractical
// ============================================================================

/**
 * Fetch swimmers by specific IDs directly from API
 * Use this to display group cards without loading ALL swimmers
 * 
 * @param ids Array of swimmer IDs to fetch
 * @returns Array of swimmer data
 */
export const fetchSwimmersByIds = async (ids: number[]): Promise<CachedSwimmer[]> => {
    if (!ids || ids.length === 0) {
        return [];
    }

    const idSet = new Set(ids);

    // Fast path: in-memory cache is warm — no API call needed
    if (isCacheValid() && cache.swimmers) {
        const fromCache = cache.swimmers.filter(s => idSet.has(s.id));
        console.log(`[SwimmerCache] fetchSwimmersByIds: resolved ${fromCache.length}/${ids.length} from memory cache`);
        return fromCache;
    }

    // If a full-cache fetch is already in flight, wait for it and filter
    if (cache.fetchPromise) {
        console.log('[SwimmerCache] fetchSwimmersByIds: awaiting in-progress cache fetch');
        const swimmers = await cache.fetchPromise;
        return swimmers.filter(s => idSet.has(s.id));
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
        const response = await fetch(`${apiUrl}lm/v1/swimmers-by-ids`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ids }),
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch swimmers by IDs: ${response.status}`);
        }
        
        const data = await response.json();
        return data.swimmers || [];
    } catch (error) {
        console.error('[SwimmerCache] fetchSwimmersByIds failed:', error);
        throw error;
    }
};

/**
 * Search result interface for AJAX search
 */
export interface SwimmerSearchResult {
    swimmers: CachedSwimmer[];
    page: number;
    totalPages: number;
    hasMore: boolean;
}

/**
 * AJAX search for swimmers with pagination
 * Use this for adding swimmers to groups instead of loading all swimmers
 * 
 * @param search Search term (empty string returns all alphabetically)
 * @param page Page number (1-indexed)
 * @returns Paginated search results
 */
export const searchSwimmers = async (search: string, page: number = 1): Promise<SwimmerSearchResult> => {
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
    
    try {
        const response = await fetch(`${apiUrl}lm/v1/search-swimmers?${params.toString()}`, {
            headers,
        });
        
        if (!response.ok) {
            throw new Error(`Failed to search swimmers: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            swimmers: data.swimmers || [],
            page: data.page || 1,
            totalPages: data.total_pages || 1,
            hasMore: data.has_more || false,
        };
    } catch (error) {
        console.error('[SwimmerCache] searchSwimmers failed:', error);
        throw error;
    }
};
