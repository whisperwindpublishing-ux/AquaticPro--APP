<?php
/**
 * REST API Routes for Daily Logs
 * 
 * Endpoints:
 * - Time Slots (CRUD + Reorder)
 * - Daily Log Permissions (Read + Update)
 * - Daily Logs (CRUD + Reactions)
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register Daily Logs REST Routes
 */
function mp_register_daily_logs_routes() {
    $namespace = 'mentorship-platform/v1';

    // ===== TIME SLOTS =====
    
    // GET /time-slots - Get all time slots
    register_rest_route($namespace, '/time-slots', [
        'methods' => 'GET',
        'callback' => 'mp_get_time_slots',
        'permission_callback' => 'is_user_logged_in'
    ]);

    // POST /time-slots - Create time slot (Tier 5/6 only)
    register_rest_route($namespace, '/time-slots', [
        'methods' => 'POST',
        'callback' => 'mp_create_time_slot',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'slug' => ['required' => true, 'type' => 'string'],
            'label' => ['required' => true, 'type' => 'string'],
            'description' => ['required' => false, 'type' => 'string'],
            'sort_order' => ['required' => false, 'type' => 'integer'],
            'color' => ['required' => false, 'type' => 'string']
        ]
    ]);

    // PUT /time-slots/{id} - Update time slot (Tier 5/6 only)
    register_rest_route($namespace, '/time-slots/(?P<id>\d+)', [
        'methods' => 'PUT',
        'callback' => 'mp_update_time_slot',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // DELETE /time-slots/{id} - Soft delete time slot (Tier 5/6 only)
    register_rest_route($namespace, '/time-slots/(?P<id>\d+)', [
        'methods' => 'DELETE',
        'callback' => 'mp_delete_time_slot',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // POST /time-slots/reorder - Reorder time slots (Tier 5/6 only)
    register_rest_route($namespace, '/time-slots/reorder', [
        'methods' => 'POST',
        'callback' => 'mp_reorder_time_slots',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'slot_ids' => ['required' => true, 'type' => 'array']
        ]
    ]);

    // ===== DAILY LOG PERMISSIONS =====
    
    // GET /daily-log-permissions - Get all role permissions
    register_rest_route($namespace, '/daily-log-permissions', [
        'methods' => 'GET',
        'callback' => 'mp_get_daily_log_permissions',
        'permission_callback' => 'mp_check_tier_5_permission'
    ]);

    // PUT /daily-log-permissions/{job_role_id} - Update permissions for a role (Tier 5/6 only)
    register_rest_route($namespace, '/daily-log-permissions/(?P<job_role_id>\d+)', [
        'methods' => 'PUT',
        'callback' => 'mp_update_daily_log_permissions',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'job_role_id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // POST /daily-log-permissions/batch - Batch update permissions (Tier 5/6 only)
    register_rest_route($namespace, '/daily-log-permissions/batch', [
        'methods' => 'POST',
        'callback' => 'mp_batch_update_daily_log_permissions',
        'permission_callback' => 'mp_check_tier_5_permission',
        'args' => [
            'updates' => ['required' => true, 'type' => 'array']
        ]
    ]);

    // POST /daily-log-permissions/sync - Sync permissions for all roles (Tier 5/6 only)
    register_rest_route($namespace, '/daily-log-permissions/sync', [
        'methods' => 'POST',
        'callback' => 'mp_sync_daily_log_permissions_api',
        'permission_callback' => 'mp_check_tier_5_permission'
    ]);

    // ===== DAILY LOGS =====
    
    // GET /daily-logs - Get daily logs with filtering and grouping
    register_rest_route($namespace, '/daily-logs', [
        'methods' => 'GET',
        'callback' => 'mp_get_daily_logs',
        'permission_callback' => 'mp_check_daily_log_view_permission'
    ]);

    // POST /daily-logs - Create daily log
    register_rest_route($namespace, '/daily-logs', [
        'methods' => 'POST',
        'callback' => 'mp_create_daily_log',
        'permission_callback' => 'mp_check_daily_log_create_permission',
        'args' => [
            'title' => ['required' => true, 'type' => 'string'],
            'blocksJson' => ['required' => false], // Allow null/empty for drafts - blocks field also sent
            'blocks' => ['required' => false], // Alternative field name used by frontend
            'locationId' => ['required' => true, 'type' => 'integer'],
            'logDate' => ['required' => true, 'type' => 'string'],
            'timeSlotIds' => ['required' => true, 'type' => 'array'],
            'jobRoleId' => ['required' => false, 'type' => 'integer'],
            'tags' => ['required' => false, 'type' => 'array'],
            'status' => ['required' => false, 'type' => 'string'],
            'authorId' => ['required' => false, 'type' => 'integer']
        ]
    ]);

    // ===== IMPORT ROUTES =====
    
    // GET /daily-logs/import/post-types - Get available post types for import
    register_rest_route($namespace, '/daily-logs/import/post-types', [
        'methods' => 'GET',
        'callback' => 'mp_get_importable_post_types',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
    
    // GET /daily-logs/import/preview - Preview posts to import
    register_rest_route($namespace, '/daily-logs/import/preview', [
        'methods' => 'GET',
        'callback' => 'mp_preview_import_posts',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => [
            'startDate' => ['required' => true, 'type' => 'string'],
            'endDate' => ['required' => true, 'type' => 'string'],
            'postType' => ['required' => false, 'type' => 'string']
        ]
    ]);
    
    // POST /daily-logs/import - Import posts as daily logs
    register_rest_route($namespace, '/daily-logs/import', [
        'methods' => 'POST',
        'callback' => 'mp_import_posts_to_daily_logs',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => [
            'postIds' => ['required' => true, 'type' => 'array'],
            'defaultLocationId' => ['required' => true, 'type' => 'integer'],
            'defaultTimeSlotIds' => ['required' => false, 'type' => 'array'],
            'defaultJobRoleId' => ['required' => false, 'type' => 'integer'],
            'preserveAuthor' => ['required' => false, 'type' => 'boolean'],
            'preserveDate' => ['required' => false, 'type' => 'boolean'],
            'skipAlreadyImported' => ['required' => false, 'type' => 'boolean']
        ]
    ]);

    // PUT /daily-logs/{id} - Update daily log
    register_rest_route($namespace, '/daily-logs/(?P<id>\d+)', [
        'methods' => 'PUT',
        'callback' => 'mp_update_daily_log',
        'permission_callback' => 'mp_check_daily_log_edit_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer'],
            'authorId' => ['required' => false, 'type' => 'integer']
        ]
    ]);

    // DELETE /daily-logs/{id} - Delete daily log
    register_rest_route($namespace, '/daily-logs/(?P<id>\d+)', [
        'methods' => 'DELETE',
        'callback' => 'mp_delete_daily_log',
        'permission_callback' => 'mp_check_daily_log_delete_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // POST /daily-logs/{id}/reactions - Add/update reaction
    register_rest_route($namespace, '/daily-logs/(?P<id>\d+)/reactions', [
        'methods' => 'POST',
        'callback' => 'mp_add_daily_log_reaction',
        'permission_callback' => 'mp_check_daily_log_view_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer'],
            'reaction_type' => ['required' => true, 'type' => 'string']
        ]
    ]);

    // DELETE /daily-logs/{id}/reactions - Remove reaction
    register_rest_route($namespace, '/daily-logs/(?P<id>\d+)/reactions', [
        'methods' => 'DELETE',
        'callback' => 'mp_remove_daily_log_reaction',
        'permission_callback' => 'mp_check_daily_log_view_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // GET /daily-logs/{id}/reactions/details - Get list of users who reacted
    register_rest_route($namespace, '/daily-logs/(?P<id>\d+)/reactions/details', [
        'methods' => 'GET',
        'callback' => 'mp_get_daily_log_reaction_details',
        'permission_callback' => 'mp_check_daily_log_view_permission',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // ===== COMMENT REACTIONS =====
    
    // POST /comments/{id}/reactions - Add/update reaction to comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions', [
        'methods' => 'POST',
        'callback' => 'mp_add_comment_reaction',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer'],
            'reaction_type' => ['required' => true, 'type' => 'string']
        ]
    ]);

    // DELETE /comments/{id}/reactions - Remove reaction from comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions', [
        'methods' => 'DELETE',
        'callback' => 'mp_remove_comment_reaction',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // GET /comments/{id}/reactions/details - Get list of users who reacted to comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions/details', [
        'methods' => 'GET',
        'callback' => 'mp_get_comment_reaction_details',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // GET /job-roles - Get all job roles (already exists, but ensure it includes permissions)    // ===== COMMENT REACTIONS =====
    
    // POST /comments/{id}/reactions - Add/update reaction to a comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions', [
        'methods' => 'POST',
        'callback' => 'mp_add_comment_reaction',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer'],
            'reaction_type' => ['required' => true, 'type' => 'string']
        ]
    ]);

    // DELETE /comments/{id}/reactions - Remove reaction from a comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions', [
        'methods' => 'DELETE',
        'callback' => 'mp_remove_comment_reaction',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // GET /comments/{id}/reactions/details - Get list of users who reacted to a comment
    register_rest_route($namespace, '/comments/(?P<id>\d+)/reactions/details', [
        'methods' => 'GET',
        'callback' => 'mp_get_comment_reaction_details',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);

    // GET /job-roles - Get all job roles (already exists, but ensure it includes permissions)
    register_rest_route($namespace, '/job-roles', [
        'methods' => 'GET',
        'callback' => 'mp_get_job_roles_with_permissions',
        'permission_callback' => 'is_user_logged_in'
    ]);

    // ===== USER REACTION STATS =====
    
    // GET /users/{id}/reaction-stats - Get lifetime reaction stats for a user
    register_rest_route($namespace, '/users/(?P<id>\d+)/reaction-stats', [
        'methods' => 'GET',
        'callback' => 'mp_get_user_reaction_stats',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'id' => ['required' => true, 'type' => 'integer']
        ]
    ]);
    
    // POST /users/reaction-stats/batch - Get reaction stats for multiple users at once
    register_rest_route($namespace, '/users/reaction-stats/batch', [
        'methods' => 'POST',
        'callback' => 'mp_get_batch_user_reaction_stats',
        'permission_callback' => 'is_user_logged_in',
        'args' => [
            'user_ids' => ['required' => true, 'type' => 'array']
        ]
    ]);
}

add_action('rest_api_init', 'mp_register_daily_logs_routes');

// ===== PERMISSION CALLBACKS =====

/**
 * Check if user is Tier 5+ (for admin functions)
 */
function mp_check_tier_5_permission() {
    if (!is_user_logged_in()) {
        return false;
    }

    $user_id = get_current_user_id();
    
    // WordPress admins always have access
    if (current_user_can('manage_options')) {
        return true;
    }

    // Check user's highest tier job role
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';

    $highest_tier = $wpdb->get_var($wpdb->prepare("
        SELECT MAX(r.tier)
        FROM $assignments_table a
        JOIN $roles_table r ON a.job_role_id = r.id
        WHERE a.user_id = %d
    ", $user_id));

    return $highest_tier >= 5;
}

/**
 * Check if user can view daily logs
 */
function mp_check_daily_log_view_permission() {
    if (!is_user_logged_in()) {
        return false;
    }

    return mp_check_daily_log_permission('can_view');
}

/**
 * Check if user can create daily logs
 */
function mp_check_daily_log_create_permission() {
    if (!is_user_logged_in()) {
        return false;
    }

    return mp_check_daily_log_permission('can_create');
}

/**
 * Check if user can edit daily logs
 */
function mp_check_daily_log_edit_permission($request) {
    if (!is_user_logged_in()) {
        return false;
    }

    $log_id = $request->get_param('id');
    $user_id = get_current_user_id();

    // Check if user can moderate all logs
    if (mp_check_daily_log_permission('can_moderate_all')) {
        return true;
    }

    // Check if user owns this log and has edit permission
    if (mp_check_daily_log_permission('can_edit')) {
        $post = get_post($log_id);
        return $post && $post->post_author == $user_id;
    }

    return false;
}

/**
 * Check if user can delete daily logs
 */
function mp_check_daily_log_delete_permission($request) {
    if (!is_user_logged_in()) {
        return false;
    }

    $log_id = $request->get_param('id');
    $user_id = get_current_user_id();

    // Check if user can moderate all logs
    if (mp_check_daily_log_permission('can_moderate_all')) {
        return true;
    }

    // Check if user owns this log and has delete permission
    if (mp_check_daily_log_permission('can_delete')) {
        $post = get_post($log_id);
        return $post && $post->post_author == $user_id;
    }

    return false;
}

/**
 * Helper: Check if user has specific Daily Log permission
 */
function mp_check_daily_log_permission($permission_type) {
    $user_id = get_current_user_id();

    // Plugin Admins (WP admins and Tier 6+) always have full access
    if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin($user_id)) {
        return true;
    }

    global $wpdb;
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';

    // Get user's job role permissions (check highest permission across all roles)
    $has_permission = $wpdb->get_var($wpdb->prepare("
        SELECT MAX(p.$permission_type)
        FROM $permissions_table p
        JOIN $assignments_table a ON p.job_role_id = a.job_role_id
        WHERE a.user_id = %d
    ", $user_id));

    return (bool) $has_permission;
}

// Continue in next file due to length...
// This is just the route registration and permission checks
// The actual endpoint callbacks will go in separate includes
