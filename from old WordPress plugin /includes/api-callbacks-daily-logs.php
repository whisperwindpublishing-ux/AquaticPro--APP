<?php
/**
 * Daily Logs REST API Callbacks
 * 
 * Implementation of endpoint handlers for:
 * - Time Slots CRUD
 * - Permissions Management  
 * - Daily Logs CRUD
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// ===== TIME SLOT ENDPOINTS =====

/**
 * GET /time-slots
 * Get all time slots (optionally active only)
 */
function mp_get_time_slots($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_time_slots';

    $active_only = $request->get_param('active_only') === 'true';
    $cache_key = 'mp_time_slots_' . ($active_only ? 'active' : 'all');
    
    // Try to get from cache first
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return rest_ensure_response($cached);
    }

    $where = $active_only ? 'WHERE is_active = 1' : '';
    $slots = $wpdb->get_results("
        SELECT id, slug, label, description, sort_order AS sortOrder, is_active AS isActive, color, 
               created_at AS createdAt, updated_at AS updatedAt
        FROM $table
        $where
        ORDER BY sort_order ASC, label ASC
    ");
    
    // Cache for 1 hour (time slots rarely change)
    set_transient($cache_key, $slots, HOUR_IN_SECONDS);

    return rest_ensure_response($slots);
}

/**
 * POST /time-slots
 * Create new time slot (Tier 5/6 only)
 */
function mp_create_time_slot($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_time_slots';

    $slug = sanitize_title($request->get_param('slug'));
    $label = sanitize_text_field($request->get_param('label'));
    $description = sanitize_textarea_field($request->get_param('description'));
    $sort_order = $request->get_param('sort_order') ?? 999;
    $color = sanitize_hex_color($request->get_param('color'));

    // Check if slug already exists
    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE slug = %s", $slug));
    if ($exists) {
        return new WP_Error('slug_exists', 'A time slot with this slug already exists', ['status' => 400]);
    }

    $result = $wpdb->insert(
        $table,
        [
            'slug' => $slug,
            'label' => $label,
            'description' => $description,
            'sort_order' => $sort_order,
            'color' => $color
        ],
        ['%s', '%s', '%s', '%d', '%s']
    );

    if (!$result) {
        return new WP_Error('db_error', 'Failed to create time slot', ['status' => 500]);
    }
    
    // Invalidate time slots cache
    delete_transient('mp_time_slots_active');
    delete_transient('mp_time_slots_all');

    $slot_id = $wpdb->insert_id;
    $slot = $wpdb->get_row($wpdb->prepare("
        SELECT id, slug, label, description, sort_order AS sortOrder, is_active AS isActive, color,
               created_at AS createdAt, updated_at AS updatedAt
        FROM $table WHERE id = %d
    ", $slot_id));

    return rest_ensure_response($slot);
}

/**
 * PUT /time-slots/{id}
 * Update time slot (Tier 5/6 only)
 */
function mp_update_time_slot($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_time_slots';

    $slot_id = $request->get_param('id');

    // Check if slot exists
    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE id = %d", $slot_id));
    if (!$exists) {
        return new WP_Error('not_found', 'Time slot not found', ['status' => 404]);
    }

    $update_data = [];
    $update_format = [];

    if ($request->has_param('slug')) {
        $update_data['slug'] = sanitize_title($request->get_param('slug'));
        $update_format[] = '%s';
    }
    if ($request->has_param('label')) {
        $update_data['label'] = sanitize_text_field($request->get_param('label'));
        $update_format[] = '%s';
    }
    if ($request->has_param('description')) {
        $update_data['description'] = sanitize_textarea_field($request->get_param('description'));
        $update_format[] = '%s';
    }
    if ($request->has_param('sort_order') || $request->has_param('sortOrder')) {
        $sort_order = $request->get_param('sort_order') ?? $request->get_param('sortOrder');
        $update_data['sort_order'] = intval($sort_order);
        $update_format[] = '%d';
    }
    if ($request->has_param('is_active') || $request->has_param('isActive')) {
        $is_active = $request->get_param('is_active') ?? $request->get_param('isActive');
        $update_data['is_active'] = $is_active ? 1 : 0;
        $update_format[] = '%d';
    }
    if ($request->has_param('color')) {
        $update_data['color'] = sanitize_hex_color($request->get_param('color'));
        $update_format[] = '%s';
    }

    if (empty($update_data)) {
        return new WP_Error('no_data', 'No valid data to update', ['status' => 400]);
    }

    $wpdb->update($table, $update_data, ['id' => $slot_id], $update_format, ['%d']);
    
    // Invalidate time slots cache
    delete_transient('mp_time_slots_active');
    delete_transient('mp_time_slots_all');

    $slot = $wpdb->get_row($wpdb->prepare("
        SELECT id, slug, label, description, sort_order AS sortOrder, is_active AS isActive, color,
               created_at AS createdAt, updated_at AS updatedAt
        FROM $table WHERE id = %d
    ", $slot_id));

    return rest_ensure_response($slot);
}

/**
 * DELETE /time-slots/{id}
 * Soft delete time slot (Tier 5/6 only)
 */
function mp_delete_time_slot($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_time_slots';

    $slot_id = $request->get_param('id');

    // Check if slot exists
    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE id = %d", $slot_id));
    if (!$exists) {
        return new WP_Error('not_found', 'Time slot not found', ['status' => 404]);
    }

    // Soft delete (set is_active = 0)
    $wpdb->update(
        $table,
        ['is_active' => 0],
        ['id' => $slot_id],
        ['%d'],
        ['%d']
    );
    
    // Invalidate time slots cache
    delete_transient('mp_time_slots_active');
    delete_transient('mp_time_slots_all');

    return rest_ensure_response(['success' => true, 'message' => 'Time slot deactivated']);
}

/**
 * POST /time-slots/reorder
 * Reorder time slots by updating sort_order (Tier 5/6 only)
 */
function mp_reorder_time_slots($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_time_slots';

    $slot_ids = $request->get_param('slot_ids');

    if (!is_array($slot_ids) || empty($slot_ids)) {
        return new WP_Error('invalid_data', 'slot_ids must be a non-empty array', ['status' => 400]);
    }

    // Update sort_order for each slot
    foreach ($slot_ids as $index => $slot_id) {
        $wpdb->update(
            $table,
            ['sort_order' => $index + 1],
            ['id' => intval($slot_id)],
            ['%d'],
            ['%d']
        );
    }

    // Return updated slots
    $slots = $wpdb->get_results("
        SELECT id, slug, label, description, sort_order, is_active AS isActive, color,
               created_at AS createdAt, updated_at AS updatedAt
        FROM $table
        WHERE is_active = 1
        ORDER BY sort_order ASC
    ");

    return rest_ensure_response($slots);
}

// ===== PERMISSION ENDPOINTS =====

/**
 * GET /daily-log-permissions
 * Get daily log permissions for all job roles (Tier 5/6 only)
 */
function mp_get_daily_log_permissions() {
    global $wpdb;
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $roles_table = $wpdb->prefix . 'pg_job_roles';

    $permissions = $wpdb->get_results("
        SELECT 
            p.id,
            p.job_role_id AS jobRoleId,
            r.name AS jobRoleName,
            r.tier AS jobRoleTier,
            p.can_view AS canView,
            p.can_create AS canCreate,
            p.can_edit AS canEdit,
            p.can_delete AS canDelete,
            p.can_moderate_all AS canModerateAll,
            p.created_at AS createdAt,
            p.updated_at AS updatedAt
        FROM $permissions_table p
        JOIN $roles_table r ON p.job_role_id = r.id
        ORDER BY r.tier DESC, r.name ASC
    ");

    return rest_ensure_response($permissions);
}

/**
 * PUT /daily-log-permissions/{job_role_id}
 * Update permissions for a specific job role (Tier 5/6 only)
 */
function mp_update_daily_log_permissions($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_daily_log_permissions';

    $job_role_id = $request->get_param('job_role_id');

    // Check if permission entry exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE job_role_id = %d",
        $job_role_id
    ));

    $update_data = [];
    if ($request->has_param('can_view') || $request->has_param('canView')) {
        $update_data['can_view'] = $request->get_param('can_view') ?? $request->get_param('canView') ? 1 : 0;
    }
    if ($request->has_param('can_create') || $request->has_param('canCreate')) {
        $update_data['can_create'] = $request->get_param('can_create') ?? $request->get_param('canCreate') ? 1 : 0;
    }
    if ($request->has_param('can_edit') || $request->has_param('canEdit')) {
        $update_data['can_edit'] = $request->get_param('can_edit') ?? $request->get_param('canEdit') ? 1 : 0;
    }
    if ($request->has_param('can_delete') || $request->has_param('canDelete')) {
        $update_data['can_delete'] = $request->get_param('can_delete') ?? $request->get_param('canDelete') ? 1 : 0;
    }
    if ($request->has_param('can_moderate_all') || $request->has_param('canModerateAll')) {
        $update_data['can_moderate_all'] = $request->get_param('can_moderate_all') ?? $request->get_param('canModerateAll') ? 1 : 0;
    }

    if (empty($update_data)) {
        return new WP_Error('no_data', 'No valid permission data provided', ['status' => 400]);
    }

    if ($exists) {
        // Update existing
        $wpdb->update(
            $table,
            $update_data,
            ['job_role_id' => $job_role_id],
            array_fill(0, count($update_data), '%d'),
            ['%d']
        );
    } else {
        // Insert new
        $update_data['job_role_id'] = $job_role_id;
        $wpdb->insert($table, $update_data);
    }

    // Return updated permission
    $permission = $wpdb->get_row($wpdb->prepare("
        SELECT 
            p.job_role_id AS jobRoleId,
            p.can_view AS canView,
            p.can_create AS canCreate,
            p.can_edit AS canEdit,
            p.can_delete AS canDelete,
            p.can_moderate_all AS canModerateAll
        FROM $table p
        WHERE p.job_role_id = %d
    ", $job_role_id));

    return rest_ensure_response($permission);
}

/**
 * POST /daily-log-permissions/batch
 * Batch update permissions for multiple roles (Tier 5/6 only)
 */
function mp_batch_update_daily_log_permissions($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_daily_log_permissions';

    $updates = $request->get_param('updates');

    if (!is_array($updates) || empty($updates)) {
        return new WP_Error('invalid_data', 'updates must be a non-empty array', ['status' => 400]);
    }

    $results = [];

    foreach ($updates as $update) {
        $job_role_id = $update['jobRoleId'] ?? $update['job_role_id'];
        $permissions = $update['permissions'];

        if (!$job_role_id || !is_array($permissions)) {
            continue;
        }

        $update_data = [];
        if (isset($permissions['canView']) || isset($permissions['can_view'])) {
            $update_data['can_view'] = ($permissions['canView'] ?? $permissions['can_view']) ? 1 : 0;
        }
        if (isset($permissions['canCreate']) || isset($permissions['can_create'])) {
            $update_data['can_create'] = ($permissions['canCreate'] ?? $permissions['can_create']) ? 1 : 0;
        }
        if (isset($permissions['canEdit']) || isset($permissions['can_edit'])) {
            $update_data['can_edit'] = ($permissions['canEdit'] ?? $permissions['can_edit']) ? 1 : 0;
        }
        if (isset($permissions['canDelete']) || isset($permissions['can_delete'])) {
            $update_data['can_delete'] = ($permissions['canDelete'] ?? $permissions['can_delete']) ? 1 : 0;
        }
        if (isset($permissions['canModerateAll']) || isset($permissions['can_moderate_all'])) {
            $update_data['can_moderate_all'] = ($permissions['canModerateAll'] ?? $permissions['can_moderate_all']) ? 1 : 0;
        }

        if (!empty($update_data)) {
            $wpdb->replace($table, array_merge(['job_role_id' => $job_role_id], $update_data));
            $results[] = $job_role_id;
        }
    }

    return rest_ensure_response([
        'success' => true,
        'updated_roles' => $results,
        'count' => count($results)
    ]);
}

/**
 * GET /job-roles (enhanced version with permissions)
 * Get all job roles including their daily log permissions
 */
function mp_get_job_roles_with_permissions() {
    global $wpdb;
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';

    $roles = $wpdb->get_results("
        SELECT 
            r.id,
            r.title,
            r.description,
            r.tier,
            r.color,
            p.can_view AS canView,
            p.can_create AS canCreate,
            p.can_edit AS canEdit,
            p.can_delete AS canDelete,
            p.can_moderate_all AS canModerateAll
        FROM $roles_table r
        LEFT JOIN $permissions_table p ON r.id = p.job_role_id
        ORDER BY r.tier DESC, r.title ASC
    ");

    // Format with nested dailyLogPermissions object
    $formatted_roles = array_map(function($role) {
        return [
            'id' => (int) $role->id,
            'name' => $role->title,
            'title' => $role->title,
            'description' => $role->description,
            'tier' => (int) $role->tier,
            'color' => $role->color,
            'dailyLogPermissions' => [
                'jobRoleId' => (int) $role->id,
                'canView' => (bool) $role->canView,
                'canCreate' => (bool) $role->canCreate,
                'canEdit' => (bool) $role->canEdit,
                'canDelete' => (bool) $role->canDelete,
                'canModerateAll' => (bool) $role->canModerateAll
            ]
        ];
    }, $roles);

    return rest_ensure_response($formatted_roles);
}

/**
 * POST /daily-log-permissions/sync
 * Sync permissions for all job roles (creates missing permissions)
 */
function mp_sync_daily_log_permissions_api() {
    // Call the sync function from the main plugin file
    $result = mp_sync_daily_log_permissions();
    
    if ($result['success']) {
        return rest_ensure_response([
            'success' => true,
            'message' => sprintf(
                'Synced permissions: %d added, %d already existed (%d total roles)',
                $result['added'],
                $result['skipped'],
                $result['total']
            ),
            'added' => $result['added'],
            'skipped' => $result['skipped'],
            'total' => $result['total']
        ]);
    } else {
        return new WP_Error('sync_failed', $result['message'], ['status' => 500]);
    }
}

// ===== DAILY LOGS CRUD ENDPOINTS =====

/**
 * GET /daily-logs
 * Get daily logs with optional filtering and grouping
 */
function mp_get_daily_logs($request) {
    $start_time = microtime(true);
    error_log('=== DAILY LOGS API: GET /daily-logs START ===');
    
    global $wpdb;
    
    $location_id = $request->get_param('location_id');
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    $time_slot_id = $request->get_param('time_slot_id');
    $user_id_filter = $request->get_param('user_id'); // Filter by specific author
    $search_term = $request->get_param('search'); // Search term
    $grouped = $request->get_param('grouped') === 'true';
    $current_user_id = get_current_user_id();
    
    // Plugin admins (WP admin or Tier 6+) can see ALL posts including other users' drafts
    $is_admin = function_exists('mp_is_plugin_admin') && mp_is_plugin_admin($current_user_id);
    if ($is_admin) {
        $post_status_clause = "p.post_status IN ('publish', 'draft')";
    } else {
        $post_status_clause = "(p.post_status = 'publish' OR (p.post_status = 'draft' AND p.post_author = " . intval($current_user_id) . "))";
    }
    
    // Pagination parameters
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50))); // Default 50, max 100
    $offset = ($page - 1) * $per_page;
    
    error_log(sprintf('Params: location=%s, date_from=%s, date_to=%s, time_slot=%s, grouped=%s, page=%d, per_page=%d',
        $location_id ?: 'all', $date_from ?: 'none', $date_to ?: 'none', $time_slot_id ?: 'all', 
        $grouped ? 'yes' : 'no', $page, $per_page));
    
    // Build query
    $query = "
        SELECT 
            p.ID as id,
            p.post_title as title,
            p.post_content as content,
            p.post_author as authorId,
            p.post_status as status,
            p.post_date as createdAt,
            p.post_modified as updatedAt,
            u.display_name as authorName,
            pm_location.meta_value as locationId,
            pm_date.meta_value as logDate,
            pm_slots.meta_value as timeSlotIds,
            pm_role.meta_value as jobRoleId,
            pm_tags.meta_value as tags,
            pm_blocks.meta_value as blocksJson
        FROM {$wpdb->posts} p
        LEFT JOIN {$wpdb->users} u ON p.post_author = u.ID
        LEFT JOIN {$wpdb->postmeta} pm_location ON p.ID = pm_location.post_id AND pm_location.meta_key = '_location_id'
        LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_log_date'
        LEFT JOIN {$wpdb->postmeta} pm_slots ON p.ID = pm_slots.post_id AND pm_slots.meta_key = '_time_slot_ids'
        LEFT JOIN {$wpdb->postmeta} pm_role ON p.ID = pm_role.post_id AND pm_role.meta_key = '_job_role_id'
        LEFT JOIN {$wpdb->postmeta} pm_tags ON p.ID = pm_tags.post_id AND pm_tags.meta_key = '_tags'
        LEFT JOIN {$wpdb->postmeta} pm_blocks ON p.ID = pm_blocks.post_id AND pm_blocks.meta_key = '_blocks_json'
        WHERE p.post_type = 'mp_daily_log'
        AND " . $post_status_clause . "
    ";
    
    $where_clauses = [];
    if ($location_id) $where_clauses[] = $wpdb->prepare("pm_location.meta_value = %d", $location_id);
    if ($date_from) $where_clauses[] = $wpdb->prepare("pm_date.meta_value >= %s", $date_from);
    if ($date_to) $where_clauses[] = $wpdb->prepare("pm_date.meta_value <= %s", $date_to);
    if ($time_slot_id) $where_clauses[] = $wpdb->prepare("pm_slots.meta_value LIKE %s", '%' . $wpdb->esc_like($time_slot_id) . '%');
    if ($user_id_filter) $where_clauses[] = $wpdb->prepare("p.post_author = %d", $user_id_filter);
    if ($search_term) {
        $like = '%' . $wpdb->esc_like($search_term) . '%';
        $where_clauses[] = $wpdb->prepare("(p.post_title LIKE %s OR p.post_content LIKE %s OR pm_blocks.meta_value LIKE %s)", $like, $like, $like);
    }
    
    if (!empty($where_clauses)) {
        $query .= " AND " . implode(' AND ', $where_clauses);
    }
    
    // Get total count before applying pagination
    // Use a simpler count query without JOINs to avoid duplicates
    $count_start = microtime(true);
    
    if (empty($where_clauses)) {
        // No filters - simple count
        if ($is_admin) {
            $count_query = "
                SELECT COUNT(*) as total
                FROM {$wpdb->posts}
                WHERE post_type = 'mp_daily_log'
                AND post_status IN ('publish', 'draft')
            ";
        } else {
            $count_query = $wpdb->prepare("
                SELECT COUNT(*) as total
                FROM {$wpdb->posts}
                WHERE post_type = 'mp_daily_log'
                AND (
                    post_status = 'publish' 
                    OR (post_status = 'draft' AND post_author = %d)
                )
            ", $current_user_id);
        }
        $total_count = (int) $wpdb->get_var($count_query);
    } else {
        // With filters - need to use subquery to avoid duplicates from JOINs
        $count_query = "
            SELECT COUNT(*) FROM (
                SELECT DISTINCT p.ID
                FROM {$wpdb->posts} p
                LEFT JOIN {$wpdb->postmeta} pm_location ON p.ID = pm_location.post_id AND pm_location.meta_key = '_location_id'
                LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_log_date'
                LEFT JOIN {$wpdb->postmeta} pm_slots ON p.ID = pm_slots.post_id AND pm_slots.meta_key = '_time_slot_ids'
                WHERE p.post_type = 'mp_daily_log'
                AND " . $post_status_clause . "
                AND " . implode(' AND ', $where_clauses) . "
            ) as filtered_posts
        ";
        $total_count = (int) $wpdb->get_var($count_query);
    }
    $count_time = (microtime(true) - $count_start) * 1000;
    error_log(sprintf('Count query: %.2fms, total=%d', $count_time, $total_count));
    
    $query .= " ORDER BY pm_date.meta_value DESC, p.post_date DESC";
    $query .= $wpdb->prepare(" LIMIT %d OFFSET %d", $per_page, $offset);
    
    $query_start = microtime(true);
    $logs = $wpdb->get_results($query);
    $query_time = (microtime(true) - $query_start) * 1000;
    error_log(sprintf('Main query: %.2fms, rows=%d', $query_time, count($logs)));
    
    // Get all time slots for hydration
    $time_slots_table = $wpdb->prefix . 'mp_time_slots';
    $all_time_slots = $wpdb->get_results("SELECT id, slug, label, color FROM $time_slots_table WHERE is_active = 1");
    $slots_by_id = [];
    foreach ($all_time_slots as $slot) {
        $slots_by_id[(int) $slot->id] = [
            'id' => (int) $slot->id,
            'slug' => $slot->slug,
            'label' => $slot->label,
            'color' => $slot->color
        ];
    }
    
    // Get all locations for hydration
    $locations_table = $wpdb->prefix . 'pg_locations';
    $all_locations = $wpdb->get_results("SELECT id, name FROM $locations_table");
    $locations_by_id = [];
    foreach ($all_locations as $location) {
        $locations_by_id[(int) $location->id] = $location->name;
    }
    
    // Get all job roles for hydration
    $job_roles_table = $wpdb->prefix . 'pg_job_roles';
    $all_job_roles = $wpdb->get_results("SELECT id, title FROM $job_roles_table");
    $job_roles_by_id = [];
    foreach ($all_job_roles as $role) {
        $job_roles_by_id[(int) $role->id] = [
            'id' => (int) $role->id,
            'name' => $role->title
        ];
    }
    
    // BATCH FETCH: Get all log IDs for batch queries
    $log_ids = array_map(function($log) { return (int) $log->id; }, $logs);
    
    // BATCH FETCH: Get all reactions in one query (eliminates N+1)
    $reactions_by_log = [];
    if (!empty($log_ids)) {
        // UNIFIED REACTION SYSTEM
        $reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
        $ids_placeholder = implode(',', array_fill(0, count($log_ids), '%d'));
        
        // Get reaction counts grouped by log_id (object_id)
        $reactions_query = $wpdb->prepare("
            SELECT object_id as log_id, reaction_type, COUNT(*) as count
            FROM $reactions_table
            WHERE object_id IN ($ids_placeholder)
            AND object_type = 'daily_log'
            GROUP BY object_id, reaction_type
        ", ...$log_ids);
        $all_reactions = $wpdb->get_results($reactions_query);
        
        // Get current user's reactions
        $user_reactions = [];
        if ($current_user_id) {
            $user_reactions_query = $wpdb->prepare("
                SELECT object_id as log_id, reaction_type
                FROM $reactions_table
                WHERE object_id IN ($ids_placeholder) AND user_id = %d
                AND object_type = 'daily_log'
            ", ...array_merge($log_ids, [$current_user_id]));
            $user_reactions_raw = $wpdb->get_results($user_reactions_query);
            foreach ($user_reactions_raw as $ur) {
                $user_reactions[(int) $ur->log_id] = $ur->reaction_type;
            }
        }
        
        // Initialize all logs with zero counts
        foreach ($log_ids as $lid) {
            $reactions_by_log[$lid] = [
                'thumbs_up' => 0,
                'thumbs_down' => 0,
                'heart' => 0,
                'userReaction' => $user_reactions[$lid] ?? null
            ];
        }
        
        // Fill in actual counts
        foreach ($all_reactions as $r) {
            $lid = (int) $r->log_id;
            if (isset($reactions_by_log[$lid][$r->reaction_type])) {
                $reactions_by_log[$lid][$r->reaction_type] = (int) $r->count;
            }
        }
    }
    
    // BATCH FETCH: Get all comment counts in one query (eliminates N+1)
    $comment_counts = [];
    if (!empty($log_ids)) {
        $ids_placeholder = implode(',', array_fill(0, count($log_ids), '%d'));
        $comments_query = $wpdb->prepare("
            SELECT comment_post_ID as log_id, COUNT(*) as count
            FROM {$wpdb->comments}
            WHERE comment_post_ID IN ($ids_placeholder) AND comment_approved = '1'
            GROUP BY comment_post_ID
        ", ...$log_ids);
        $comment_results = $wpdb->get_results($comments_query);
        foreach ($comment_results as $c) {
            $comment_counts[(int) $c->log_id] = (int) $c->count;
        }
    }
    
    // BATCH FETCH: Pre-fetch all author user data (eliminates N+1 get_userdata calls)
    $author_ids = array_unique(array_filter(array_map(function($log) { 
        return (int) $log->authorId; 
    }, $logs)));
    $authors_by_id = [];
    if (!empty($author_ids)) {
        foreach ($author_ids as $aid) {
            $author_data = get_userdata($aid);
            if ($author_data) {
                $custom_avatar = get_user_meta($author_data->ID, 'mentorship_avatar_url', true);
                $authors_by_id[$aid] = [
                    'id' => (int) $author_data->ID,
                    'firstName' => get_user_meta($author_data->ID, 'first_name', true) ?: $author_data->display_name,
                    'lastName' => get_user_meta($author_data->ID, 'last_name', true) ?: '',
                    'avatarUrl' => $custom_avatar ?: get_avatar_url($author_data->ID)
                ];
            }
        }
    }
    
    // Format logs (now using pre-fetched data - no N+1 queries)
    $formatted_logs = array_map(function($log) use ($slots_by_id, $locations_by_id, $job_roles_by_id, $reactions_by_log, $comment_counts, $authors_by_id) {
        $time_slot_ids = $log->timeSlotIds ? array_map('intval', explode(',', $log->timeSlotIds)) : [];
        $tags = $log->tags ? explode(',', $log->tags) : [];
        $blocks = $log->blocksJson ? json_decode($log->blocksJson, true) : [];
        
        // Use pre-fetched reactions (no query)
        $log_id = (int) $log->id;
        $reactions = $reactions_by_log[$log_id] ?? [
            'thumbs_up' => 0, 'thumbs_down' => 0, 'heart' => 0, 'userReaction' => null
        ];
        
        // Use pre-fetched comment count (no query)
        $comment_count = $comment_counts[$log_id] ?? 0;
        
        // Use pre-fetched author data (no query)
        $author = $authors_by_id[(int) $log->authorId] ?? null;
        
        // Hydrate time slots
        $time_slots = [];
        foreach ($time_slot_ids as $slot_id) {
            if (isset($slots_by_id[$slot_id])) {
                $time_slots[] = $slots_by_id[$slot_id];
            }
        }
        
        // Hydrate job role
        $job_role = null;
        if ($log->jobRoleId && isset($job_roles_by_id[(int) $log->jobRoleId])) {
            $job_role = $job_roles_by_id[(int) $log->jobRoleId];
        }
        
        // Get location name
        $location_name = $locations_by_id[(int) $log->locationId] ?? 'Unknown Location';
        
        return [
            'id' => (int) $log->id,
            'title' => $log->title,
            'content' => $log->content,
            'blocksJson' => $blocks,
            'authorId' => (int) $log->authorId,
            'author' => $author,
            'locationId' => (int) $log->locationId,
            'locationName' => $location_name,
            'logDate' => $log->logDate,
            'timeSlotIds' => $time_slot_ids,
            'timeSlots' => $time_slots,
            'jobRole' => $job_role,
            'jobRoleId' => (int) $log->jobRoleId,
            'tags' => $tags,
            'status' => $log->status,
            'createdAt' => $log->createdAt,
            'updatedAt' => $log->updatedAt,
            'reactionCounts' => [
                'thumbs_up' => $reactions['thumbs_up'],
                'thumbs_down' => $reactions['thumbs_down'],
                'heart' => $reactions['heart']
            ],
            'userReaction' => $reactions['userReaction'],
            'commentCount' => (int) $comment_count
        ];
    }, $logs);
    
    // Prepare response with pagination metadata
    $response_data = [
        'logs' => $formatted_logs,
        'pagination' => [
            'page' => $page,
            'per_page' => $per_page,
            'total' => $total_count,
            'total_pages' => ceil($total_count / $per_page),
            'has_more' => ($page * $per_page) < $total_count
        ]
    ];
    
    // If grouped, organize by location -> date -> time slot
    if ($grouped) {
        $group_start = microtime(true);
        $grouped_data = mp_group_daily_logs($formatted_logs);
        $response_data['logs'] = $grouped_data;
        $group_time = (microtime(true) - $group_start) * 1000;
        error_log(sprintf('Grouping: %.2fms', $group_time));
    }
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== DAILY LOGS API: GET /daily-logs END - Total: %.2fms ===', $total_time));
    
    return rest_ensure_response($response_data);
}

/**
 * Helper: Format a single daily log for API response
 */
function mp_format_single_daily_log($log_id) {
    global $wpdb;
    
    $log = get_post($log_id);
    if (!$log || $log->post_type !== 'mp_daily_log') {
        return null;
    }
    
    $author = get_userdata($log->post_author);
    $location_id = get_post_meta($log_id, '_location_id', true);
    $log_date = get_post_meta($log_id, '_log_date', true);
    $time_slot_ids = get_post_meta($log_id, '_time_slot_ids', true);
    $job_role_id = get_post_meta($log_id, '_job_role_id', true);
    $tags = get_post_meta($log_id, '_tags', true);
    $blocks_json = get_post_meta($log_id, '_blocks_json', true);
    
    $time_slot_ids_array = $time_slot_ids ? array_map('intval', explode(',', $time_slot_ids)) : [];
    $tags_array = $tags ? explode(',', $tags) : [];
    $blocks = $blocks_json ? json_decode($blocks_json, true) : [];
    
    $reactions = mp_get_log_reactions($log_id);
    error_log('=== FORMAT SINGLE LOG: Reactions returned: ' . print_r($reactions, true));
    
    // Get accurate comment count
    $comment_count = $wpdb->get_var($wpdb->prepare("
        SELECT COUNT(*) 
        FROM {$wpdb->comments} 
        WHERE comment_post_ID = %d 
        AND comment_approved = '1'
    ", $log_id));
    
    // Get location name
    $locations_table = $wpdb->prefix . 'pg_locations';
    $location_name = $wpdb->get_var($wpdb->prepare("SELECT name FROM $locations_table WHERE id = %d", $location_id));
    
    // Get time slots
    $time_slots_table = $wpdb->prefix . 'mp_time_slots';
    $time_slots = [];
    if (!empty($time_slot_ids_array)) {
        $ids_placeholder = implode(',', array_fill(0, count($time_slot_ids_array), '%d'));
        $time_slots = $wpdb->get_results($wpdb->prepare(
            "SELECT id, slug, label, color FROM $time_slots_table WHERE id IN ($ids_placeholder)",
            ...$time_slot_ids_array
        ));
    }
    
    // Get job role
    $job_role = null;
    if ($job_role_id) {
        $job_roles_table = $wpdb->prefix . 'pg_job_roles';
        $job_role_data = $wpdb->get_row($wpdb->prepare("SELECT id, title, color FROM $job_roles_table WHERE id = %d", $job_role_id));
        if ($job_role_data) {
            $job_role = [
                'id' => (int) $job_role_data->id,
                'name' => $job_role_data->title,
                'color' => $job_role_data->color
            ];
        }
    }
    
    $custom_avatar = $author ? get_user_meta($author->ID, 'mentorship_avatar_url', true) : '';
    
    return [
        'id' => (int) $log->ID,
        'title' => html_entity_decode($log->post_title, ENT_QUOTES, 'UTF-8'),
        'content' => html_entity_decode($log->post_content, ENT_QUOTES, 'UTF-8'),
        'blocksJson' => $blocks,
        'authorId' => (int) $log->post_author,
        'author' => $author ? [
            'id' => (int) $author->ID,
            'firstName' => get_user_meta($author->ID, 'first_name', true) ?: $author->display_name,
            'lastName' => get_user_meta($author->ID, 'last_name', true) ?: '',
            'avatarUrl' => $custom_avatar ?: get_avatar_url($author->ID)
        ] : null,
        'locationId' => (int) $location_id,
        'locationName' => $location_name ?: 'Unknown Location',
        'logDate' => $log_date,
        'timeSlotIds' => $time_slot_ids_array,
        'timeSlots' => array_map(function($slot) {
            return [
                'id' => (int) $slot->id,
                'slug' => $slot->slug,
                'label' => $slot->label,
                'color' => $slot->color
            ];
        }, $time_slots),
        'jobRole' => $job_role,
        'jobRoleId' => (int) $job_role_id,
        'tags' => $tags_array,
        'status' => $log->post_status,
        'createdAt' => $log->post_date,
        'updatedAt' => $log->post_modified,
        'reactionCounts' => [
            'thumbs_up' => $reactions['thumbs_up'],
            'thumbs_down' => $reactions['thumbs_down'],
            'heart' => $reactions['heart']
        ],
        'userReaction' => $reactions['userReaction'],
        'commentCount' => (int) $comment_count
    ];
}

/**
 * Helper: Get reactions for a log
 */
function mp_get_log_reactions($log_id) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    $user_id = get_current_user_id();
    
    // Get reaction counts
    $reactions = $wpdb->get_results($wpdb->prepare("
        SELECT reaction_type, COUNT(*) as count
        FROM $table
        WHERE object_id = %d AND object_type = 'daily_log'
        GROUP BY reaction_type
    ", $log_id));
    
    $counts = ['thumbs_up' => 0, 'thumbs_down' => 0, 'heart' => 0];
    foreach ($reactions as $reaction) {
        $counts[$reaction->reaction_type] = (int) $reaction->count;
    }
    
    // Get current user's reaction
    $user_reaction = null;
    if ($user_id) {
        $user_reaction = $wpdb->get_var($wpdb->prepare("
            SELECT reaction_type
            FROM $table
            WHERE object_id = %d AND user_id = %d AND object_type = 'daily_log'
        ", $log_id, $user_id));
    }
    
    $counts['userReaction'] = $user_reaction;
    
    return $counts;
}

/**
 * Helper: Group logs by location -> date -> time slot
 */
function mp_group_daily_logs($logs) {
    global $wpdb;
    
    // Get all time slots ordered by sort_order (for determining first slot)
    $time_slots_table = $wpdb->prefix . 'mp_time_slots';
    $time_slots = $wpdb->get_results("SELECT id, slug, label, color, sort_order FROM $time_slots_table WHERE is_active = 1 ORDER BY sort_order ASC");
    $slots_by_id = [];
    $slot_sort_order = [];
    foreach ($time_slots as $slot) {
        $slots_by_id[(int) $slot->id] = [
            'id' => (int) $slot->id,
            'slug' => $slot->slug,
            'label' => $slot->label,
            'color' => $slot->color
        ];
        $slot_sort_order[(int) $slot->id] = (int) $slot->sort_order;
    }
    
    // Get locations (from Professional Growth module)
    $locations_table = $wpdb->prefix . 'pg_locations';
    $locations = $wpdb->get_results("SELECT id, name FROM $locations_table");
    $locations_by_id = [];
    foreach ($locations as $location) {
        $locations_by_id[(int) $location->id] = $location->name;
    }
    
    // Group logs
    $grouped = [];
    
    foreach ($logs as $log) {
        $location_id = $log['locationId'];
        $location_name = $locations_by_id[$location_id] ?? 'Unknown Location';
        $log_date = $log['logDate'];
        
        // Initialize location group
        if (!isset($grouped[$location_id])) {
            $grouped[$location_id] = [
                'locationId' => $location_id,
                'locationName' => $location_name,
                'dates' => []
            ];
        }
        
        // Initialize date group
        if (!isset($grouped[$location_id]['dates'][$log_date])) {
            $grouped[$location_id]['dates'][$log_date] = [
                'date' => $log_date,
                'timeSlots' => []
            ];
        }
        
        // Add log to ONLY its first time slot (by sort_order)
        // This prevents duplicates when a log has multiple time slots
        if (!empty($log['timeSlotIds'])) {
            // Find the slot with the lowest sort_order
            $first_slot_id = $log['timeSlotIds'][0];
            $lowest_sort = $slot_sort_order[$first_slot_id] ?? 9999;
            
            foreach ($log['timeSlotIds'] as $slot_id) {
                $sort = $slot_sort_order[$slot_id] ?? 9999;
                if ($sort < $lowest_sort) {
                    $lowest_sort = $sort;
                    $first_slot_id = $slot_id;
                }
            }
            
            $slot_key = (string) $first_slot_id;
            
            if (!isset($grouped[$location_id]['dates'][$log_date]['timeSlots'][$slot_key])) {
                $grouped[$location_id]['dates'][$log_date]['timeSlots'][$slot_key] = [
                    'slot' => $slots_by_id[$first_slot_id] ?? ['id' => $first_slot_id, 'slug' => 'unknown', 'label' => 'Unknown', 'color' => '#888888'],
                    'logs' => []
                ];
            }
            
            $grouped[$location_id]['dates'][$log_date]['timeSlots'][$slot_key]['logs'][] = $log;
        }
    }
    
    // Re-key by location name for frontend consumption
    $result = [];
    foreach ($grouped as $location_data) {
        $location_name = $location_data['locationName'];
        $result[$location_name] = $location_data;
    }
    
    return $result;
}

/**
 * POST /daily-logs
 * Create a new daily log
 */
function mp_create_daily_log($request) {
    $start_time = microtime(true);
    error_log('=== DAILY LOGS API: POST /daily-logs (CREATE) START ===');
    
    $user_id = get_current_user_id();
    
    $title = sanitize_text_field($request->get_param('title'));
    // Use wp_kses with all allowed HTML tags to preserve quotes and apostrophes
    $content = wp_kses($request->get_param('content'), wp_kses_allowed_html('post'));
    $blocks = $request->get_param('blocks');
    $location_id = (int) $request->get_param('locationId');
    $log_date = sanitize_text_field($request->get_param('logDate'));
    $time_slot_ids = $request->get_param('timeSlotIds');
    $job_role_id = (int) $request->get_param('jobRoleId');
    $tags = $request->get_param('tags');
    $status = $request->get_param('status') === 'draft' ? 'draft' : 'publish';
    
    // Plugin admins can create logs on behalf of another user
    $author_id = $user_id;
    if ($request->has_param('authorId')) {
        $requested_author = (int) $request->get_param('authorId');
        if ($requested_author && $requested_author !== $user_id) {
            $is_admin = function_exists('mp_is_plugin_admin') && mp_is_plugin_admin($user_id);
            if ($is_admin && get_userdata($requested_author)) {
                $author_id = $requested_author;
            }
        }
    }
    
    // Create post
    $post_id = wp_insert_post([
        'post_type' => 'mp_daily_log',
        'post_title' => $title,
        'post_content' => $content,
        'post_status' => $status,
        'post_author' => $author_id,
        'comment_status' => 'open'
    ]);
    
    if (is_wp_error($post_id)) {
        return new WP_Error('create_failed', 'Failed to create daily log', ['status' => 500]);
    }
    
    // Save meta
    update_post_meta($post_id, '_location_id', $location_id);
    update_post_meta($post_id, '_log_date', $log_date);
    update_post_meta($post_id, '_time_slot_ids', implode(',', $time_slot_ids));
    update_post_meta($post_id, '_job_role_id', $job_role_id);
    update_post_meta($post_id, '_tags', is_array($tags) ? implode(',', $tags) : $tags);
    update_post_meta($post_id, '_blocks_json', json_encode($blocks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    
    // Return created log
    $log = get_post($post_id);
    return rest_ensure_response([
        'id' => $post_id,
        'title' => $log->post_title,
        'content' => $log->post_content,
        'blocks' => $blocks,
        'authorId' => $author_id,
        'locationId' => $location_id,
        'logDate' => $log_date,
        'timeSlotIds' => $time_slot_ids,
        'jobRoleId' => $job_role_id,
        'tags' => is_array($tags) ? $tags : explode(',', $tags),
        'status' => $status,
        'createdAt' => $log->post_date,
        'updatedAt' => $log->post_modified
    ]);
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== DAILY LOGS API: POST /daily-logs END - Total: %.2fms, log_id=%d ===', $total_time, $post_id));
    
    return $formatted_log;
}

/**
 * PUT /daily-logs/{id}
 * Update an existing daily log
 */
function mp_update_daily_log($request) {
    $start_time = microtime(true);
    error_log('=== DAILY LOGS API: PUT /daily-logs/{id} (UPDATE) START ===');
    $log_id = (int) $request->get_param('id');
    error_log(sprintf('Updating log ID: %d', $log_id));
    $user_id = get_current_user_id();
    
    $log = get_post($log_id);
    if (!$log || $log->post_type !== 'mp_daily_log') {
        return new WP_Error('not_found', 'Daily log not found', ['status' => 404]);
    }
    
    // Check ownership or moderation permission
    $can_moderate = mp_check_daily_log_permission('can_moderate_all');
    if ($log->post_author != $user_id && !$can_moderate) {
        return new WP_Error('forbidden', 'You can only edit your own logs', ['status' => 403]);
    }
    
    // Update post
    $update_data = ['ID' => $log_id];
    
    // Plugin admins can change the author
    if ($request->has_param('authorId')) {
        $requested_author = (int) $request->get_param('authorId');
        if ($requested_author) {
            $is_admin = function_exists('mp_is_plugin_admin') && mp_is_plugin_admin($user_id);
            if ($is_admin && get_userdata($requested_author)) {
                $update_data['post_author'] = $requested_author;
            }
        }
    }
    
    if ($request->has_param('title')) {
        $update_data['post_title'] = sanitize_text_field($request->get_param('title'));
    }
    if ($request->has_param('content')) {
        // Use wp_kses with all allowed HTML tags to preserve quotes and apostrophes
        $update_data['post_content'] = wp_kses($request->get_param('content'), wp_kses_allowed_html('post'));
    }
    if ($request->has_param('status')) {
        $update_data['post_status'] = $request->get_param('status') === 'draft' ? 'draft' : 'publish';
    }
    
    wp_update_post($update_data);
    
    // Update meta
    if ($request->has_param('locationId')) {
        update_post_meta($log_id, '_location_id', (int) $request->get_param('locationId'));
    }
    if ($request->has_param('logDate')) {
        update_post_meta($log_id, '_log_date', sanitize_text_field($request->get_param('logDate')));
    }
    if ($request->has_param('timeSlotIds')) {
        $time_slot_ids = $request->get_param('timeSlotIds');
        update_post_meta($log_id, '_time_slot_ids', implode(',', $time_slot_ids));
    }
    if ($request->has_param('jobRoleId')) {
        update_post_meta($log_id, '_job_role_id', (int) $request->get_param('jobRoleId'));
    }
    if ($request->has_param('tags')) {
        $tags = $request->get_param('tags');
        update_post_meta($log_id, '_tags', is_array($tags) ? implode(',', $tags) : $tags);
    }
    if ($request->has_param('blocks')) {
        update_post_meta($log_id, '_blocks_json', json_encode($request->get_param('blocks'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    
    // Return updated log
    $updated_log = get_post($log_id);
    $time_slot_ids = get_post_meta($log_id, '_time_slot_ids', true);
    $tags = get_post_meta($log_id, '_tags', true);
    $blocks = get_post_meta($log_id, '_blocks_json', true);
    
    return rest_ensure_response([
        'id' => $log_id,
        'title' => $updated_log->post_title,
        'content' => $updated_log->post_content,
        'blocks' => json_decode($blocks, true),
        'authorId' => (int) $updated_log->post_author,
        'locationId' => (int) get_post_meta($log_id, '_location_id', true),
        'logDate' => get_post_meta($log_id, '_log_date', true),
        'timeSlotIds' => array_map('intval', explode(',', $time_slot_ids)),
        'jobRoleId' => (int) get_post_meta($log_id, '_job_role_id', true),
        'tags' => explode(',', $tags),
        'status' => $updated_log->post_status,
        'createdAt' => $updated_log->post_date,
        'updatedAt' => $updated_log->post_modified
    ]);
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== DAILY LOGS API: PUT /daily-logs/{id} END - Total: %.2fms, log_id=%d ===', $total_time, $log_id));
    
    return $formatted_log;
}

/**
 * DELETE /daily-logs/{id}
 * Delete a daily log
 */
function mp_delete_daily_log($request) {
    $start_time = microtime(true);
    error_log('=== DAILY LOGS API: DELETE /daily-logs/{id} START ===');
    
    $log_id = (int) $request->get_param('id');
    error_log(sprintf('Deleting log ID: %d', $log_id));
    $user_id = get_current_user_id();
    
    $log = get_post($log_id);
    if (!$log || $log->post_type !== 'mp_daily_log') {
        return new WP_Error('not_found', 'Daily log not found', ['status' => 404]);
    }
    
    // Check ownership or moderation permission
    $can_moderate = mp_check_daily_log_permission('can_moderate_all');
    if ($log->post_author != $user_id && !$can_moderate) {
        return new WP_Error('forbidden', 'You can only delete your own logs', ['status' => 403]);
    }
    
    $result = wp_delete_post($log_id, true);
    
    if (!$result) {
        return new WP_Error('delete_failed', 'Failed to delete daily log', ['status' => 500]);
    }
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== DAILY LOGS API: DELETE /daily-logs/{id} END - Total: %.2fms, log_id=%d ===', $total_time, $log_id));
    
    return rest_ensure_response(['success' => true, 'id' => $log_id]);
}

/**
 * POST /daily-logs/{id}/reactions
 * Add or update a reaction
 */
function mp_add_daily_log_reaction($request) {
    global $wpdb;
    
    $log_id = (int) $request->get_param('id');
    $user_id = get_current_user_id();
    $reaction_type = sanitize_text_field($request->get_param('reaction_type'));
    
    // Validate reaction type
    $valid_types = ['thumbs_up', 'thumbs_down', 'heart'];
    if (!in_array($reaction_type, $valid_types)) {
        return new WP_Error('invalid_reaction', 'Invalid reaction type', ['status' => 400]);
    }
    
    // Check if log exists
    $log = get_post($log_id);
    if (!$log || $log->post_type !== 'mp_daily_log') {
        return new WP_Error('not_found', 'Daily log not found', ['status' => 404]);
    }
    
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Upsert reaction using INSERT ... ON DUPLICATE KEY UPDATE
    $wpdb->query($wpdb->prepare(
        "INSERT INTO $table (object_id, object_type, user_id, reaction_type, item_author_id)
         VALUES (%d, 'daily_log', %d, %s, %d)
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type)",
        $log_id, $user_id, $reaction_type, $log->post_author
    ));
    
    // Return full log object
    return rest_ensure_response(mp_format_single_daily_log($log_id));
}

/**
 * DELETE /daily-logs/{id}/reactions
 * Remove user's reaction
 */
function mp_remove_daily_log_reaction($request) {
    global $wpdb;
    
    $log_id = (int) $request->get_param('id');
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    $wpdb->delete(
        $table,
        ['object_id' => $log_id, 'user_id' => $user_id, 'object_type' => 'daily_log'],
        ['%d', '%d', '%s']
    );
    
    // Return full log object
    return rest_ensure_response(mp_format_single_daily_log($log_id));
}

/**
 * GET /daily-logs/{id}/reactions/details
 * Get list of users who reacted to a log, grouped by reaction type
 */
function mp_get_daily_log_reaction_details($request) {
    global $wpdb;
    
    $log_id = (int) $request->get_param('id');
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Get all reactions with user info
    $reactions = $wpdb->get_results($wpdb->prepare("
        SELECT reaction_type, user_id, created_at
        FROM $table
        WHERE object_id = %d AND object_type = 'daily_log'
        ORDER BY created_at ASC
    ", $log_id));
    
    // Group by reaction type and format user data
    $grouped = [
        'thumbs_up' => [],
        'thumbs_down' => [],
        'heart' => []
    ];
    
    foreach ($reactions as $reaction) {
        $user = get_userdata($reaction->user_id);
        if ($user) {
            $user_profile = mentorship_platform_prepare_user_for_api($user);
            $grouped[$reaction->reaction_type][] = [
                'user' => $user_profile,
                'createdAt' => $reaction->created_at
            ];
        }
    }
    
    return rest_ensure_response($grouped);
}

/**
 * POST /comments/{id}/reactions
 * Add or update user's reaction to a comment
 */
function mp_add_comment_reaction($request) {
    global $wpdb;
    
    $comment_id = (int) $request->get_param('id');
    $reaction_type = sanitize_text_field($request->get_param('reaction_type'));
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Get comment author
    $comment = get_comment($comment_id);
    $author_id = $comment ? $comment->user_id : 0;
    
    // Upsert reaction
    $wpdb->query($wpdb->prepare(
        "INSERT INTO $table (object_id, object_type, user_id, reaction_type, item_author_id)
         VALUES (%d, 'comment', %d, %s, %d)
         ON DUPLICATE KEY UPDATE reaction_type = VALUES(reaction_type)",
        $comment_id, $user_id, $reaction_type, $author_id
    ));
    
    // Return reaction counts
    return rest_ensure_response(mp_get_comment_reactions($comment_id));
}

/**
 * DELETE /comments/{id}/reactions
 * Remove user's reaction from a comment
 */
function mp_remove_comment_reaction($request) {
    global $wpdb;
    
    $comment_id = (int) $request->get_param('id');
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    $wpdb->delete(
        $table,
        ['object_id' => $comment_id, 'user_id' => $user_id, 'object_type' => 'comment'],
        ['%d', '%d', '%s']
    );
    
    // Return reaction counts
    return rest_ensure_response(mp_get_comment_reactions($comment_id));
}

/**
 * GET /comments/{id}/reactions/details
 * Get list of users who reacted to a comment, grouped by reaction type
 */
function mp_get_comment_reaction_details($request) {
    global $wpdb;
    
    $comment_id = (int) $request->get_param('id');
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Get all reactions with user info
    $reactions = $wpdb->get_results($wpdb->prepare("
        SELECT reaction_type, user_id, created_at
        FROM $table
        WHERE object_id = %d AND object_type = 'comment'
        ORDER BY created_at ASC
    ", $comment_id));
    
    // Group by reaction type and format user data
    $grouped = [
        'thumbs_up' => [],
        'thumbs_down' => [],
        'heart' => []
    ];
    
    foreach ($reactions as $reaction) {
        $user = get_userdata($reaction->user_id);
        if ($user) {
            $user_profile = mentorship_platform_prepare_user_for_api($user);
            $grouped[$reaction->reaction_type][] = [
                'user' => $user_profile,
                'createdAt' => $reaction->created_at
            ];
        }
    }
    
    return rest_ensure_response($grouped);
}

/**
 * Helper: Get reactions for a comment
 */
function mp_get_comment_reactions($comment_id) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_unified_reactions';
    $user_id = get_current_user_id();
    
    // Get reaction counts
    $reactions = $wpdb->get_results($wpdb->prepare("
        SELECT reaction_type, COUNT(*) as count
        FROM $table
        WHERE object_id = %d AND object_type = 'comment'
        GROUP BY reaction_type
    ", $comment_id));
    
    $counts = ['thumbs_up' => 0, 'thumbs_down' => 0, 'heart' => 0];
    foreach ($reactions as $reaction) {
        $counts[$reaction->reaction_type] = (int) $reaction->count;
    }
    
    // Get current user's reaction
    $user_reaction = null;
    if ($user_id) {
        $user_reaction = $wpdb->get_var($wpdb->prepare("
            SELECT reaction_type
            FROM $table
            WHERE object_id = %d AND user_id = %d AND object_type = 'comment'
        ", $comment_id, $user_id));
    }
    
    return [
        'commentId' => $comment_id,
        'reactionCounts' => $counts,
        'userReaction' => $user_reaction
    ];
}

/**
 * Helper: Ensure reactions table exists
 */
function mp_ensure_reactions_table() {
    global $wpdb;
    
    $table = $wpdb->prefix . 'mp_daily_log_reactions';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        log_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_reaction (log_id, user_id),
        KEY idx_log (log_id),
        KEY idx_user (user_id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// ===== IMPORT WORDPRESS POSTS TO DAILY LOGS =====

/**
 * GET /daily-logs/import/preview
 * Preview WordPress posts that can be imported within a date range
 */
function mp_preview_import_posts($request) {
    global $wpdb;
    
    $start_date = sanitize_text_field($request->get_param('startDate'));
    $end_date = sanitize_text_field($request->get_param('endDate'));
    $post_type = sanitize_text_field($request->get_param('postType')) ?: 'post';
    
    if (!$start_date || !$end_date) {
        return new WP_Error('missing_dates', 'Start date and end date are required', ['status' => 400]);
    }
    
    // Validate dates
    $start_timestamp = strtotime($start_date);
    $end_timestamp = strtotime($end_date);
    
    if (!$start_timestamp || !$end_timestamp) {
        return new WP_Error('invalid_dates', 'Invalid date format', ['status' => 400]);
    }
    
    if ($start_timestamp > $end_timestamp) {
        return new WP_Error('invalid_range', 'Start date must be before end date', ['status' => 400]);
    }
    
    // Get posts in the date range (exclude mp_daily_log to avoid importing existing logs)
    $posts = $wpdb->get_results($wpdb->prepare("
        SELECT ID, post_title, post_content, post_date, post_author, post_status
        FROM {$wpdb->posts}
        WHERE post_type = %s
        AND post_status IN ('publish', 'draft')
        AND post_date >= %s
        AND post_date <= %s
        ORDER BY post_date DESC
    ", $post_type, $start_date . ' 00:00:00', $end_date . ' 23:59:59'));
    
    // OPTIMIZED: Check which posts have already been imported in a single query instead of N queries
    $already_imported = [];
    if ( ! empty( $posts ) ) {
        $post_ids = wp_list_pluck( $posts, 'ID' );
        $placeholders = implode( ',', array_fill( 0, count( $post_ids ), '%d' ) );
        
        $imported_results = $wpdb->get_col( $wpdb->prepare(
            "SELECT meta_value 
            FROM {$wpdb->postmeta} 
            WHERE meta_key = '_imported_from_post_id' 
            AND meta_value IN ({$placeholders})",
            ...$post_ids
        ) );
        
        $already_imported = array_map( 'intval', $imported_results );
    }
    
    // Format for frontend
    $formatted = [];
    foreach ($posts as $post) {
        $author = get_userdata($post->post_author);
        $formatted[] = [
            'id' => (int) $post->ID,
            'title' => html_entity_decode($post->post_title, ENT_QUOTES, 'UTF-8'),
            'excerpt' => wp_trim_words(wp_strip_all_tags($post->post_content), 30),
            'postDate' => $post->post_date,
            'author' => $author ? [
                'id' => (int) $author->ID,
                'name' => $author->display_name,
                'firstName' => get_user_meta($author->ID, 'first_name', true) ?: $author->display_name,
                'lastName' => get_user_meta($author->ID, 'last_name', true) ?: ''
            ] : null,
            'status' => $post->post_status,
            'alreadyImported' => in_array($post->ID, $already_imported)
        ];
    }
    
    return rest_ensure_response([
        'posts' => $formatted,
        'total' => count($formatted),
        'alreadyImported' => count($already_imported)
    ]);
}

/**
 * GET /daily-logs/import/post-types
 * Get available post types for import
 */
function mp_get_importable_post_types() {
    $post_types = get_post_types(['public' => true], 'objects');
    
    $formatted = [];
    foreach ($post_types as $post_type) {
        // Exclude daily logs and attachments
        if (in_array($post_type->name, ['mp_daily_log', 'attachment'])) {
            continue;
        }
        $formatted[] = [
            'name' => $post_type->name,
            'label' => $post_type->label,
            'count' => wp_count_posts($post_type->name)->publish
        ];
    }
    
    return rest_ensure_response($formatted);
}

/**
 * POST /daily-logs/import
 * Import WordPress posts as daily logs
 */
function mp_import_posts_to_daily_logs($request) {
    global $wpdb;
    
    $post_ids = $request->get_param('postIds');
    $default_location_id = (int) $request->get_param('defaultLocationId');
    $default_time_slot_ids = $request->get_param('defaultTimeSlotIds') ?: [];
    $default_job_role_id = (int) $request->get_param('defaultJobRoleId');
    $preserve_author = $request->get_param('preserveAuthor') !== false;
    $preserve_date = $request->get_param('preserveDate') !== false;
    $skip_already_imported = $request->get_param('skipAlreadyImported') !== false;
    
    if (empty($post_ids) || !is_array($post_ids)) {
        return new WP_Error('missing_posts', 'No posts selected for import', ['status' => 400]);
    }
    
    if (!$default_location_id) {
        return new WP_Error('missing_location', 'Default location is required', ['status' => 400]);
    }
    
    $imported = [];
    $skipped = [];
    $errors = [];
    
    // OPTIMIZED: Pre-fetch all already-imported mappings in one query instead of N queries
    $already_imported_map = [];
    if ($skip_already_imported && !empty($post_ids)) {
        $int_post_ids = array_map('intval', $post_ids);
        $placeholders = implode(',', array_fill(0, count($int_post_ids), '%d'));
        
        $imported_results = $wpdb->get_results($wpdb->prepare(
            "SELECT post_id, meta_value 
            FROM {$wpdb->postmeta} 
            WHERE meta_key = '_imported_from_post_id' 
            AND meta_value IN ({$placeholders})",
            ...$int_post_ids
        ), OBJECT);
        
        foreach ($imported_results as $row) {
            $already_imported_map[(int)$row->meta_value] = (int)$row->post_id;
        }
    }
    
    foreach ($post_ids as $post_id) {
        $post_id = (int) $post_id;
        
        // Check if already imported using pre-fetched map
        if ($skip_already_imported && isset($already_imported_map[$post_id])) {
            $skipped[] = [
                'id' => $post_id,
                'reason' => 'Already imported as daily log #' . $already_imported_map[$post_id]
            ];
            continue;
        }
        
        // Get the original post
        $post = get_post($post_id);
        if (!$post) {
            $errors[] = [
                'id' => $post_id,
                'reason' => 'Post not found'
            ];
            continue;
        }
        
        // Determine author
        $author_id = $preserve_author ? $post->post_author : get_current_user_id();
        
        // Determine log date
        $log_date = $preserve_date ? date('Y-m-d', strtotime($post->post_date)) : date('Y-m-d');
        
        // Create the daily log post
        $new_post_id = wp_insert_post([
            'post_type' => 'mp_daily_log',
            'post_title' => $post->post_title,
            'post_content' => $post->post_content,
            'post_status' => 'publish',
            'post_author' => $author_id,
            'comment_status' => 'open',
            'post_date' => $preserve_date ? $post->post_date : current_time('mysql'),
            'post_date_gmt' => $preserve_date ? $post->post_date_gmt : current_time('mysql', true)
        ]);
        
        if (is_wp_error($new_post_id)) {
            $errors[] = [
                'id' => $post_id,
                'reason' => $new_post_id->get_error_message()
            ];
            continue;
        }
        
        // Save meta
        update_post_meta($new_post_id, '_location_id', $default_location_id);
        update_post_meta($new_post_id, '_log_date', $log_date);
        update_post_meta($new_post_id, '_time_slot_ids', implode(',', array_map('intval', $default_time_slot_ids)));
        update_post_meta($new_post_id, '_job_role_id', $default_job_role_id);
        update_post_meta($new_post_id, '_tags', '');
        
        // Convert content to blocks format (basic paragraph blocks)
        $content_blocks = mp_convert_content_to_blocks($post->post_content);
        update_post_meta($new_post_id, '_blocks_json', json_encode($content_blocks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        
        // Track the source post
        update_post_meta($new_post_id, '_imported_from_post_id', $post_id);
        update_post_meta($new_post_id, '_imported_at', current_time('mysql'));
        
        $imported[] = [
            'originalId' => $post_id,
            'newId' => $new_post_id,
            'title' => $post->post_title
        ];
    }
    
    return rest_ensure_response([
        'success' => true,
        'imported' => $imported,
        'importedCount' => count($imported),
        'skipped' => $skipped,
        'skippedCount' => count($skipped),
        'errors' => $errors,
        'errorCount' => count($errors)
    ]);
}

/**
 * Helper: Convert HTML content to BlockNote-compatible blocks
 */
function mp_convert_content_to_blocks($html_content) {
    $blocks = [];
    
    // Simple conversion: split by paragraphs and convert to paragraph blocks
    // This handles basic WordPress post content
    
    // First, normalize the content
    $content = wpautop($html_content);
    
    // Split into blocks based on common HTML elements
    $dom = new DOMDocument();
    
    // Suppress warnings for potentially malformed HTML
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="UTF-8">' . '<div>' . $content . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    
    $xpath = new DOMXPath($dom);
    $container = $dom->getElementsByTagName('div')->item(0);
    
    if ($container) {
        foreach ($container->childNodes as $node) {
            $block = mp_dom_node_to_block($node);
            if ($block) {
                $blocks[] = $block;
            }
        }
    }
    
    // If no blocks were created, create a single paragraph block
    if (empty($blocks) && !empty(trim(strip_tags($html_content)))) {
        $blocks[] = [
            'id' => wp_generate_uuid4(),
            'type' => 'paragraph',
            'props' => [
                'textColor' => 'default',
                'backgroundColor' => 'default',
                'textAlignment' => 'left'
            ],
            'content' => [
                ['type' => 'text', 'text' => strip_tags($html_content), 'styles' => new stdClass()]
            ],
            'children' => []
        ];
    }
    
    return $blocks;
}

/**
 * Helper: Convert DOM node to BlockNote block
 */
function mp_dom_node_to_block($node) {
    if ($node->nodeType === XML_TEXT_NODE) {
        $text = trim($node->textContent);
        if (empty($text)) {
            return null;
        }
        return [
            'id' => wp_generate_uuid4(),
            'type' => 'paragraph',
            'props' => [
                'textColor' => 'default',
                'backgroundColor' => 'default',
                'textAlignment' => 'left'
            ],
            'content' => [
                ['type' => 'text', 'text' => $text, 'styles' => new stdClass()]
            ],
            'children' => []
        ];
    }
    
    if ($node->nodeType !== XML_ELEMENT_NODE) {
        return null;
    }
    
    $tag = strtolower($node->nodeName);
    $innerHTML = mp_get_inner_html($node);
    $text = trim(strip_tags($innerHTML));
    
    if (empty($text)) {
        return null;
    }
    
    switch ($tag) {
        case 'h1':
            return [
                'id' => wp_generate_uuid4(),
                'type' => 'heading',
                'props' => [
                    'textColor' => 'default',
                    'backgroundColor' => 'default',
                    'textAlignment' => 'left',
                    'level' => 1
                ],
                'content' => mp_parse_inline_content($node),
                'children' => []
            ];
            
        case 'h2':
            return [
                'id' => wp_generate_uuid4(),
                'type' => 'heading',
                'props' => [
                    'textColor' => 'default',
                    'backgroundColor' => 'default',
                    'textAlignment' => 'left',
                    'level' => 2
                ],
                'content' => mp_parse_inline_content($node),
                'children' => []
            ];
            
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            return [
                'id' => wp_generate_uuid4(),
                'type' => 'heading',
                'props' => [
                    'textColor' => 'default',
                    'backgroundColor' => 'default',
                    'textAlignment' => 'left',
                    'level' => 3
                ],
                'content' => mp_parse_inline_content($node),
                'children' => []
            ];
            
        case 'ul':
            $items = [];
            foreach ($node->childNodes as $li) {
                if ($li->nodeName === 'li') {
                    $items[] = [
                        'id' => wp_generate_uuid4(),
                        'type' => 'bulletListItem',
                        'props' => [
                            'textColor' => 'default',
                            'backgroundColor' => 'default',
                            'textAlignment' => 'left'
                        ],
                        'content' => mp_parse_inline_content($li),
                        'children' => []
                    ];
                }
            }
            return !empty($items) ? $items : null;
            
        case 'ol':
            $items = [];
            foreach ($node->childNodes as $li) {
                if ($li->nodeName === 'li') {
                    $items[] = [
                        'id' => wp_generate_uuid4(),
                        'type' => 'numberedListItem',
                        'props' => [
                            'textColor' => 'default',
                            'backgroundColor' => 'default',
                            'textAlignment' => 'left'
                        ],
                        'content' => mp_parse_inline_content($li),
                        'children' => []
                    ];
                }
            }
            return !empty($items) ? $items : null;
            
        case 'blockquote':
            // BlockNote doesn't have native blockquote, use styled paragraph
            return [
                'id' => wp_generate_uuid4(),
                'type' => 'paragraph',
                'props' => [
                    'textColor' => 'gray',
                    'backgroundColor' => 'default',
                    'textAlignment' => 'left'
                ],
                'content' => mp_parse_inline_content($node),
                'children' => []
            ];
            
        case 'p':
        default:
            return [
                'id' => wp_generate_uuid4(),
                'type' => 'paragraph',
                'props' => [
                    'textColor' => 'default',
                    'backgroundColor' => 'default',
                    'textAlignment' => 'left'
                ],
                'content' => mp_parse_inline_content($node),
                'children' => []
            ];
    }
}

/**
 * Helper: Parse inline content (bold, italic, links, etc.)
 */
function mp_parse_inline_content($node) {
    $content = [];
    
    foreach ($node->childNodes as $child) {
        if ($child->nodeType === XML_TEXT_NODE) {
            $text = $child->textContent;
            if (!empty($text)) {
                $content[] = [
                    'type' => 'text',
                    'text' => $text,
                    'styles' => new stdClass()
                ];
            }
        } elseif ($child->nodeType === XML_ELEMENT_NODE) {
            $tag = strtolower($child->nodeName);
            $text = $child->textContent;
            
            if (empty($text)) {
                continue;
            }
            
            $styles = [];
            
            switch ($tag) {
                case 'strong':
                case 'b':
                    $styles['bold'] = true;
                    break;
                case 'em':
                case 'i':
                    $styles['italic'] = true;
                    break;
                case 'u':
                    $styles['underline'] = true;
                    break;
                case 's':
                case 'strike':
                case 'del':
                    $styles['strike'] = true;
                    break;
                case 'a':
                    $href = $child->getAttribute('href');
                    if ($href) {
                        $content[] = [
                            'type' => 'link',
                            'href' => $href,
                            'content' => [
                                ['type' => 'text', 'text' => $text, 'styles' => new stdClass()]
                            ]
                        ];
                        continue 2;
                    }
                    break;
            }
            
            $content[] = [
                'type' => 'text',
                'text' => $text,
                'styles' => !empty($styles) ? (object) $styles : new stdClass()
            ];
        }
    }
    
    // If no content parsed, try to get plain text
    if (empty($content)) {
        $text = trim($node->textContent);
        if (!empty($text)) {
            $content[] = [
                'type' => 'text',
                'text' => $text,
                'styles' => new stdClass()
            ];
        }
    }
    
    return $content;
}

/**
 * Helper: Get inner HTML of a DOM node
 */
function mp_get_inner_html($node) {
    $innerHTML = '';
    foreach ($node->childNodes as $child) {
        $innerHTML .= $node->ownerDocument->saveHTML($child);
    }
    return $innerHTML;
}

// ===== USER REACTION STATS =====

/**
 * GET /users/{id}/reaction-stats
 * Get lifetime reaction stats for a user (reactions received on their daily logs)
 */
function mp_get_user_reaction_stats($request) {
    global $wpdb;
    
    $user_id = (int) $request->get_param('id');
    
    if (!$user_id) {
        return new WP_Error('invalid_user', 'Invalid user ID', ['status' => 400]);
    }
    
    $reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Get reaction counts for logs authored by this user
    // Uses item_author_id stored in unified reactions table for efficient lookup
    $stats = $wpdb->get_results($wpdb->prepare("
        SELECT reaction_type, COUNT(*) as count
        FROM $reactions_table
        WHERE item_author_id = %d
        AND object_type = 'daily_log'
        GROUP BY reaction_type
    ", $user_id), ARRAY_A);
    
    // Format the response
    $result = [
        'userId' => $user_id,
        'thumbs_up' => 0,
        'thumbs_down' => 0,
        'heart' => 0,
        'total' => 0
    ];
    
    foreach ($stats as $stat) {
        $type = $stat['reaction_type'];
        $count = (int) $stat['count'];
        if (isset($result[$type])) {
            $result[$type] = $count;
            $result['total'] += $count;
        }
    }
    
    return rest_ensure_response($result);
}

/**
 * POST /users/reaction-stats/batch
 * Get lifetime reaction stats for multiple users at once (for efficient batch loading)
 */
function mp_get_batch_user_reaction_stats($request) {
    global $wpdb;
    
    $user_ids = $request->get_param('user_ids');
    
    if (empty($user_ids) || !is_array($user_ids)) {
        return new WP_Error('invalid_params', 'user_ids must be a non-empty array', ['status' => 400]);
    }
    
    // Sanitize and limit to prevent abuse (max 100 users per request)
    $user_ids = array_map('intval', $user_ids);
    $user_ids = array_slice(array_unique($user_ids), 0, 100);
    
    if (empty($user_ids)) {
        return rest_ensure_response([]);
    }
    
    $reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Build placeholders for IN clause
    $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));
    
    // Get reaction counts for all requested users in a single query
    // Uses item_author_id stored in unified reactions table for efficient lookup
    $stats = $wpdb->get_results($wpdb->prepare("
        SELECT item_author_id as author_id, reaction_type, COUNT(*) as count
        FROM $reactions_table
        WHERE item_author_id IN ($placeholders)
        AND object_type = 'daily_log'
        GROUP BY item_author_id, reaction_type
    ", ...$user_ids), ARRAY_A);
    
    // Initialize results for all requested users
    $results = [];
    foreach ($user_ids as $uid) {
        $results[$uid] = [
            'userId' => $uid,
            'thumbs_up' => 0,
            'thumbs_down' => 0,
            'heart' => 0,
            'total' => 0
        ];
    }
    
    // Populate with actual stats
    foreach ($stats as $stat) {
        $author_id = (int) $stat['author_id'];
        $type = $stat['reaction_type'];
        $count = (int) $stat['count'];
        
        if (isset($results[$author_id]) && isset($results[$author_id][$type])) {
            $results[$author_id][$type] = $count;
            $results[$author_id]['total'] += $count;
        }
    }
    
    return rest_ensure_response($results);
}
