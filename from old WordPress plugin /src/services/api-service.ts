let apiRoot = ''; // This will be '.../wp-json/'
let apiNonce = '';

// Export getters for other services that need raw fetch with headers
export const getApiRoot = () => apiRoot;
export const getApiNonce = () => apiNonce;

export const configureApiService = (baseUrl: string, nonce: string) => {
    if (baseUrl && baseUrl.includes('/wp-json/')) {
        const jsonIndex = baseUrl.indexOf('/wp-json/');
        apiRoot = baseUrl.substring(0, jsonIndex + '/wp-json/'.length);
    } else {
        // Fallback for invalid baseUrl or local dev environments
        console.warn('Invalid API base URL provided. Falling back to relative path.', baseUrl);
        apiRoot = '/wp-json/'; 
    }
    
    apiNonce = nonce;
};

// This helper now takes a FULL path from the /wp-json/ root
const fetchApi = async (path: string, options: RequestInit = {}) => {
    if (!apiRoot) {
        throw new Error('API service not configured.');
    }

    const headers = new Headers(options.headers || {});
    // Only set nonce if we have one (skip for public/unauthenticated requests)
    if (apiNonce) {
        headers.set('X-WP-Nonce', apiNonce);
    }
    if (!options.body || !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${apiRoot}${path}`, {
        ...options,
        headers,
        cache: 'no-store',
    });

    if (!response.ok) {
        // Try to get a specific error message from the response
        const errorData = await response.json().catch(() => ({ 
            message: `HTTP error ${response.status}: ${response.statusText}`,
            code: ''
        }));
        
        // Check for session expiration (cookie/nonce validation failure)
        // WordPress returns 'rest_cookie_invalid_nonce' or 'Cookie check failed' when session expires
        if (response.status === 403 && 
            (errorData.code === 'rest_cookie_invalid_nonce' || 
             errorData.message?.includes('Cookie check failed') ||
             errorData.message?.includes('cookie nonce'))) {
            // Session has expired - prompt user to reload
            const shouldReload = window.confirm(
                'Your session has expired. Please reload the page to continue.\n\n' +
                'Click OK to reload now, or Cancel to stay on this page.'
            );
            if (shouldReload) {
                window.location.reload();
            }
            throw new Error('Session expired. Please reload the page.');
        }
        
        // Use the 'message' field if it exists, otherwise fall back
        throw new Error(errorData.message || `API request failed for ${path}`);
    }
    
    // Handle 204 No Content (like a successful delete)
    if (response.status === 204) { 
        return null;
    }

    return response.json();
};

// --- API Methods ---

// 1. For our custom plugin routes (e.g., /mentorship-platform/v1/goals)
export const pluginGet = async (endpoint: string) => {
    console.log('[pluginGet] Fetching:', endpoint);
    const result = await fetchApi(`mentorship-platform/v1/${endpoint}`, { method: 'GET' });
    console.log('[pluginGet] Result for', endpoint, ':', result);
    return result;
};

export const pluginPost = (endpoint: string, data: any, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST') => {
    return fetchApi(`mentorship-platform/v1/${endpoint}`, {
        method: method,
        body: JSON.stringify(data),
    });
};

export const pluginUpload = (endpoint: string, formData: FormData) => {
    // Don't set Content-Type for FormData, browser does it
    return fetchApi(`mentorship-platform/v1/${endpoint}`, {
        method: 'POST',
        body: formData,
    });
};

// 2. For native WordPress routes (e.g., /wp/v2/comments)
export const wpGet = (path: string) => {
    return fetchApi(path, { method: 'GET' });
};

export const wpPost = (path: string, data: any) => {
    return fetchApi(path, {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const wpPut = (path: string, data: any) => {
    return fetchApi(path, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const wpDelete = (path: string) => {
    return fetchApi(path, {
        method: 'DELETE',
    });
};