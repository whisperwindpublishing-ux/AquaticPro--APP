/**
 * WordPress dependencies
 */
const { apiFetch } = wp;

/**
 * API Abstraction Layer
 *
 * This file centralizes all communication with the backend.
 * By using this abstraction, we can easily swap out the backend
 * implementation in the future without needing to change the React components.
 *
 * For now, it's a simple wrapper around wp.apiFetch.
 */

/**
 * Fetches a single page of data from a REST API endpoint.
 * @param {string} path - The initial API path.
 * @param {number} page - The page number to fetch.
 * @returns {Promise<{data: Array, totalPages: number}>} A promise that resolves to an object with the data and total pages.
 */
const fetchPage = async (path, page = 1) => {
    const separator = path.includes('?') ? '&' : '?';
    const response = await apiFetch({ path: `${path}${separator}page=${page}`, parse: false });
    const data = await response.json();
    const totalPagesHeader = response.headers.get('X-WP-TotalPages');
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
    return { data, totalPages };
};

/**
 * Fetches the groups data.
 * @param {object} postTypes - An object mapping post type names to their slugs.
 * @returns {Promise<Array>} A promise that resolves to an array of groups.
 */
const fetchGroups = ({ postTypes }) => {
    // Note: This still uses a pattern that fetches all items.
    // This should be refactored to use pagination in the UI if performance is an issue.
    const path = `/wp/v2/${postTypes.group}?context=edit&per_page=100`;
    return apiFetch({ path });
};

/**
 * Fetches a single page of groups, optionally with a search term.
 * @param {object} postTypes - An object mapping post type names to their slugs.
 * @param {number} page - The page number to fetch.
 * @param {string} searchTerm - The search term to filter by.
 * @returns {Promise<{data: Array, totalPages: number}>} A promise that resolves to the paginated group data.
 */
const fetchGroupsPage = ({ postTypes }, page = 1, searchTerm = '') => {
    let path = `/wp/v2/${postTypes.group}?context=edit&per_page=100`;
    if (searchTerm) path += `&search=${encodeURIComponent(searchTerm)}`;
    return fetchPage(path, page);
};

const fetchSwimmersPage = ({ postTypes }, page = 1, searchTerm = '') => {
    let path = `/wp/v2/${postTypes.swimmer}?context=edit&per_page=100&orderby=title&order=asc`;
    if (searchTerm) path += `&search=${encodeURIComponent(searchTerm)}`;
    return fetchPage(path, page);
};

/**
 * Fetches a set of swimmers by their IDs.
 * @param {object} postTypes - An object mapping post type names to their slugs.
 * @param {Array<number>} ids - An array of swimmer IDs to fetch.
 * @returns {Promise<Array>} A promise that resolves to an array of swimmer objects.
 */
const fetchSwimmersByIds = ({ postTypes }, ids = []) => {
    if (!ids.length) {
        return Promise.resolve([]);
    }
    const path = `/wp/v2/${postTypes.swimmer}?context=edit&per_page=100&include=${ids.join(',')}&_fields=id,title,meta`;
    return apiFetch({ path });
};

/**
 * Fetches a set of users by their IDs.
 * @param {Array<number>} ids - An array of user IDs to fetch.
 * @returns {Promise<Array>} A promise that resolves to an array of user objects.
 */
const fetchUsersByIds = (ids = []) => {
    if (!ids.length) {
        return Promise.resolve([]);
    }
    // Using context=edit to get more fields if needed, like email.
    const path = `/wp/v2/users?context=edit&per_page=100&include=${ids.join(',')}`;
    return apiFetch({ path });
};

/**
 * Searches for users by display name.
 * @param {string} searchTerm - The search term.
 * @returns {Promise<Array>} A promise that resolves to an array of user objects.
 */
const searchUsers = (searchTerm) => {
    if (!searchTerm) {
        return Promise.resolve([]);
    }
    const path = `/lm/v1/users/search?search=${encodeURIComponent(searchTerm)}`;
    return apiFetch({ path });
};
/**
 * Fetches the evaluations data.
 * @param {object} postTypes - An object mapping post type names to their slugs.
 * @param {number} page - The page number to fetch.
 * @param {string} searchTerm - The search term for swimmer name.
 * @param {object} postTypes - An object mapping post type names to their slugs.
 * @returns {Promise<{data: Array, totalPages: number}>} A promise that resolves to the first page of evaluations.
 */
const fetchEvaluationsPage = ({ postTypes }, page = 1, searchTerm = '') => {
    let path = `/wp/v2/${postTypes.evaluation}?context=edit&per_page=100`;
    if (searchTerm) {
        path += `&swimmer_search=${encodeURIComponent(searchTerm)}`;
    }
    return fetchPage(path, page);
};

/**
 * Fetches all evaluations for a specific swimmer.
 * @param {number} swimmerId - The ID of the swimmer.
 * @param {string} slug - The CPT slug for evaluations.
 * @returns {Promise<Array>} A promise that resolves to an array of evaluation objects.
 */
const fetchEvaluationsForSwimmer = (swimmerId, slug) => {
    if (!swimmerId) return Promise.resolve([]);
    return apiFetch({ path: `/wp/v2/${slug}?swimmer=${swimmerId}&context=edit&per_page=100` });
};

/**
 * Saves a group (creates or updates).
 * @param {object} group - The group object to save.
 * @param {boolean} isCreating - True if creating a new group.
 * @param {string} slug - The CPT slug for groups.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
export const saveGroup = async (group, skipConflictCheck = false) => {
    const path = group.id ? `/lm/v1/groups/${group.id}` : '/lm/v1/groups';
    const payload = {
        title: group.title,
        status: 'publish',
        meta: {
            ...group.meta,
            instructor: (group.meta.instructor || []).map(id => parseInt(String(id), 10)),
            swimmers: (group.meta.swimmers || []).map(id => parseInt(String(id), 10)),
            swimmer_grouping: group.meta.swimmer_grouping || {},
            notes: group.meta.notes || '',
        },
        // Also include taxonomies in the payload for the custom endpoint
        lm_camp: (group.lm_camp || []).map(id => parseInt(String(id), 10)),
        lm_animal: (group.lm_animal || []).map(id => parseInt(String(id), 10)),
        lm_lesson_type: (group.lm_lesson_type || []).map(id => parseInt(String(id), 10)),
    };
    
    // Include the original modified date for conflict detection
    // UNLESS we're skipping it (e.g., after a force takeover)
    if (group.modified && !skipConflictCheck) {
        payload.original_modified = group.modified;
    }
    
    return apiFetch({ path, method: 'POST', data: payload }).then(result => {
        console.log('[API] saveGroup success:', { path, result });
        return result;
    }).catch(error => {
        console.error('[API] saveGroup failed:', {
            path,
            error: error?.message || error?.code || error,
            status: error?.status,
            errorCode: error?.code,
            errorResponse: error?.response,
            fullError: error
        });
        throw error;
    });
};

/**
 * Deletes a group.
 * @param {number} groupId - The ID of the group to delete.
 * @param {string} slug - The CPT slug for groups.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
const deleteGroup = (groupId, slug) => {
    const path = `/wp/v2/${slug}/${groupId}`;
    return apiFetch({ path, method: 'DELETE', data: { force: true } });
};

/**
 * Saves a swimmer (creates or updates).
 * @param {object} swimmer - The swimmer object to save.
 * @param {boolean} isCreating - True if creating a new swimmer.
 * @param {string} slug - The CPT slug for swimmers.
 * @param {Array} skills - The list of all skills, for level mastery calculation.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
const saveSwimmer = (swimmer, isCreating, slug, skills) => {
    // --- Automatic Level Mastery Logic ---
    const skillsByLevel = skills.reduce((acc, skill) => {
        const levelId = skill.meta.level_associated;
        if (levelId) {
            if (!acc[levelId]) acc[levelId] = [];
            acc[levelId].push(skill.id);
        }
        return acc;
    }, {});

    const masteredSkillIds = (swimmer.meta.skills_mastered || []).map(s => s.skill_id);
    const masteredLevelIds = [];
    for (const levelId in skillsByLevel) {
        const allSkillsInLevelMastered = skillsByLevel[levelId].every(skillId => masteredSkillIds.includes(skillId));
        if (allSkillsInLevelMastered) {
            masteredLevelIds.push(parseInt(levelId, 10));
        }
    }
    // --- End of Logic ---

    const path = isCreating ? `/wp/v2/${slug}` : `/wp/v2/${slug}/${swimmer.id}`;
    const payload = {
        title: swimmer.title,
        status: 'publish',
        meta: { ...swimmer.meta, levels_mastered: masteredLevelIds },
    };
    
    // Include original modified timestamp for conflict detection
    if (swimmer.modified && !isCreating) {
        payload.original_modified = swimmer.modified;
    }

    return apiFetch({ path, method: 'POST', data: payload }).then(result => {
        console.log('[API] saveSwimmer:', { path, isCreating, swimmerTitle: swimmer.title, result });
        return result;
    }).catch(error => {
        console.error('[API] saveSwimmer failed:', {
            path,
            isCreating,
            error: error?.message || error?.code || error,
            status: error?.status,
            errorCode: error?.code
        });
        throw error;
    });
};

/**
 * Saves an evaluation (creates or updates).
 * @param {object} evaluationData - The evaluation object to save.
 * @param {string} evaluationCptSlug - The CPT slug for evaluations.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
const saveEvaluation = (evaluationData, evaluationCptSlug) => {
    const isCreating = !evaluationData.id;
    const path = isCreating ? `/wp/v2/${evaluationCptSlug}` : `/wp/v2/${evaluationCptSlug}/${evaluationData.id}`;
    const payload = {
        title: evaluationData.title,
        content: evaluationData.content,
        status: 'publish',
        meta: { ...evaluationData.meta },
    };
    
    // Include original modified timestamp for conflict detection
    if (evaluationData.modified && !isCreating) {
        payload.original_modified = evaluationData.modified;
    }
    
    return apiFetch({ path, method: 'POST', data: payload }).then(result => {
        console.log('[API] saveEvaluation:', { path, isCreating, evalTitle: evaluationData.title, result });
        return result;
    }).catch(error => {
        console.error('[API] saveEvaluation failed:', {
            path,
            isCreating,
            error: error?.message || error?.code || error,
            status: error?.status,
            errorCode: error?.code
        });
        throw error;
    });
};

/**
 * Deletes an evaluation.
 * @param {number} evaluationId - The ID of the evaluation to delete.
 * @param {string} slug - The CPT slug for evaluations.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
const deleteEvaluation = (evaluationId, slug) => {
    const path = `/wp/v2/${slug}/${evaluationId}`;
    return apiFetch({ path, method: 'DELETE', data: { force: true } });
};

/**
 * Deletes a swimmer.
 * @param {number} swimmerId - The ID of the swimmer to delete.
 * @param {string} slug - The CPT slug for swimmers.
 * @returns {Promise<object>} A promise that resolves with the API response.
 */
const deleteSwimmer = (swimmerId, slug) => {
    const path = `/wp/v2/${slug}/${swimmerId}`;
    return apiFetch({ path, method: 'DELETE' });
};

/**
 * Generates a shareable evaluation link for a swimmer.
 * @param {number} swimmerId - The ID of the swimmer.
 * @returns {Promise<object>} A promise that resolves with the API response containing the link.
 */
export const generateShareLink = (swimmerId) => {
    const path = `/lm/v1/swimmers/${swimmerId}/share-link`;
    return apiFetch({ path, method: 'POST' });
};

/**
 * Clears the server-side transient and re-fetches essential data.
 * @param {Function} populateState - The function from DataContext to update the state.
 */
const refreshEssentialData = async (populateState) => {
    try {
        // 1. Tell the server to clear its cache.
        await apiFetch({ path: '/lm/v1/clear-cache', method: 'POST' });
        // 2. Fetch the fresh data.
        const freshData = await apiFetch({ path: '/lm/v1/essential-data' });
        // 3. Populate the app's state with the new data.
        populateState(freshData);
    } catch (error) {
        console.error('Error refreshing essential data:', error);
    }
};

/**
 * Check if a post is locked by another user.
 * @param {string} postType - The post type slug (e.g., 'lm-swimmer').
 * @param {number} postId - The post ID.
 * @returns {Promise<object>} Object with locked status and user info.
 */
const checkLock = (postType, postId) => {
    const path = `/lm/v1/check-lock/${postType}/${postId}`;
    console.log('[API] Checking lock:', path);
    return apiFetch({ path }).then(response => {
        console.log('[API] Check lock response:', response);
        return response;
    }).catch(error => {
        console.error('[API] Check lock error:', error);
        throw error;
    });
};

/**
 * Set a lock on a post for the current user.
 * @param {string} postType - The post type slug (e.g., 'lm-swimmer').
 * @param {number} postId - The post ID.
 * @returns {Promise<object>} Response with success status.
 */
const setLock = (postType, postId) => {
    const path = `/lm/v1/lock/${postType}/${postId}`;
    console.log('[API] Setting lock:', path);
    return apiFetch({ path, method: 'POST' }).then(response => {
        console.log('[API] Set lock response:', response);
        return response;
    }).catch(error => {
        console.error('[API] Set lock error:', error);
        throw error;
    });
};

/**
 * Remove a lock from a post.
 * @param {string} postType - The post type slug (e.g., 'lm-swimmer').
 * @param {number} postId - The post ID.
 * @returns {Promise<object>} Response with success status.
 */
const removeLock = (postType, postId) => {
    const path = `/lm/v1/unlock/${postType}/${postId}`;
    console.log('[API] Removing lock:', path);
    return apiFetch({ path, method: 'POST' }).then(response => {
        console.log('[API] Remove lock response:', response);
        return response;
    }).catch(error => {
        console.error('[API] Remove lock error:', error);
        throw error;
    });
};

/**
 * Force remove a lock from a post (remove any existing lock).
 * @param {string} postType - The post type slug (e.g., 'lm-swimmer').
 * @param {number} postId - The post ID.
 * @returns {Promise<object>} Response with success status.
 */
const forceUnlock = (postType, postId) => {
    const path = `/lm/v1/force-unlock/${postType}/${postId}`;
    console.log('[API] Force unlocking:', path);
    return apiFetch({ path, method: 'POST' }).then(response => {
        console.log('[API] Force unlock response:', response);
        return response;
    }).catch(error => {
        console.error('[API] Force unlock error:', error);
        throw error;
    });
};

export const apiClient = {
    fetchGroups,
    fetchGroupsPage,    
    fetchSwimmersByIds,
    searchUsers,
    fetchUsersByIds,
    fetchSwimmersPage,    
    fetchEvaluationsPage,
    fetchEvaluationsForSwimmer,
    saveSwimmer,
    deleteGroup,
    saveEvaluation,
    deleteEvaluation,
    deleteSwimmer,
    refreshEssentialData,
    checkLock,
    setLock,
    removeLock,
    forceUnlock,
};