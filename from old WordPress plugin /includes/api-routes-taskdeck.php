<?php
/**
 * REST API Routes for TaskDeck Module
 *
 * @package AquaticPro
 * @subpackage TaskDeck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register TaskDeck REST API routes
 */
function aquaticpro_register_taskdeck_routes() {
    // Only register routes if TaskDeck module is enabled
    if ( ! get_option( 'aquaticpro_enable_taskdeck', false ) ) {
        return;
    }

    $namespace = 'mentorship-platform/v1';

    // Decks endpoints
    register_rest_route( $namespace, '/taskdecks', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_taskdecks',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_taskdeck',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
            'args'                => array(
                'deck_name' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'deck_description' => array(
                    'sanitize_callback' => 'sanitize_textarea_field',
                ),
            ),
        ),
    ) );

    register_rest_route( $namespace, '/taskdecks/(?P<id>\d+)', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_taskdeck',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'aquaticpro_update_taskdeck',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'aquaticpro_delete_taskdeck',
            'permission_callback' => 'aquaticpro_taskdeck_moderate_permission',
        ),
    ) );

    // Lists endpoints
    register_rest_route( $namespace, '/taskdecks/(?P<deck_id>\d+)/lists', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_tasklists',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_tasklist',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
            'args'                => array(
                'list_name' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ),
    ) );

    register_rest_route( $namespace, '/tasklists/(?P<id>\d+)', array(
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'aquaticpro_update_tasklist',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'aquaticpro_delete_tasklist',
            'permission_callback' => 'aquaticpro_taskdeck_moderate_permission',
        ),
    ) );

    // Cards endpoints
    register_rest_route( $namespace, '/tasklists/(?P<list_id>\d+)/cards', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_taskcards',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_taskcard',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
            'args'                => array(
                'title' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ),
    ) );

    register_rest_route( $namespace, '/taskcards/(?P<id>\d+)', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_taskcard',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'aquaticpro_update_taskcard',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'aquaticpro_delete_taskcard',
            'permission_callback' => 'aquaticpro_taskdeck_moderate_permission',
        ),
    ) );

    // Card move endpoint
    register_rest_route( $namespace, '/taskcards/(?P<id>\d+)/move', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_move_taskcard',
        'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        'args'                => array(
            'list_id' => array(
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
            'sort_order' => array(
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // Comments endpoints
    register_rest_route( $namespace, '/taskcards/(?P<card_id>\d+)/comments', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_card_comments',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_card_comment',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
            'args'                => array(
                'comment_text' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_textarea_field',
                ),
            ),
        ),
    ) );

    register_rest_route( $namespace, '/card-comments/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_delete_card_comment',
        'permission_callback' => 'aquaticpro_taskdeck_moderate_permission',
    ) );

    // Comment Reactions
    register_rest_route( $namespace, '/card-comments/(?P<id>\d+)/reaction', array(
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_toggle_card_comment_reaction',
        'permission_callback' => 'is_user_logged_in',
        'args'                => array(
            'reaction_type' => array(
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ) );

    // Attachments endpoints
    register_rest_route( $namespace, '/taskcards/(?P<card_id>\d+)/attachments', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_card_attachments',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_card_attachment',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
    ) );

    register_rest_route( $namespace, '/card-attachments/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_delete_card_attachment',
        'permission_callback' => 'aquaticpro_taskdeck_moderate_permission',
    ) );

    // Batch load endpoint - loads all lists and cards for a deck in one request
    register_rest_route( $namespace, '/taskdecks/(?P<deck_id>\d+)/batch', array(
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_get_deck_batch',
        'permission_callback' => function() { return is_user_logged_in(); },
        'args'                => array(
            'deck_id' => array(
                'required' => true,
                'type'     => 'integer',
            ),
        ),
    ) );
    
    // Checklists endpoints
    register_rest_route( $namespace, '/taskcards/(?P<card_id>\d+)/checklist', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'aquaticpro_get_card_checklist',
            'permission_callback' => 'aquaticpro_taskdeck_view_permission',
        ),
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'aquaticpro_create_checklist_item',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
            'args'                => array(
                'item_text' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ),
    ) );

    register_rest_route( $namespace, '/checklist-items/(?P<id>\d+)', array(
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'aquaticpro_update_checklist_item',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'aquaticpro_delete_checklist_item',
            'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        ),
    ) );

    // Activity log endpoint
    register_rest_route( $namespace, '/taskcards/(?P<card_id>\d+)/activity', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_card_activity',
        'permission_callback' => 'aquaticpro_taskdeck_view_permission',
    ) );

    // Get all unique categories used in cards
    register_rest_route( $namespace, '/taskdecks/categories', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_card_categories',
        'permission_callback' => 'aquaticpro_taskdeck_view_permission',
    ) );

    // Get all locations from user management
    register_rest_route( $namespace, '/taskdecks/locations', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_locations',
        'permission_callback' => 'aquaticpro_taskdeck_view_permission',
    ) );

    // Get all users for assignment
    register_rest_route( $namespace, '/users', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_all_users',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Get all job roles for role-based assignment
    register_rest_route( $namespace, '/taskdecks/roles', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_job_roles',
        'permission_callback' => 'aquaticpro_taskdeck_view_permission',
    ) );

    // Get cards assigned to current user (for notification banner)
    register_rest_route( $namespace, '/taskcards/my-assigned', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_my_assigned_cards',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Get current user's TaskDeck permissions
    register_rest_route( $namespace, '/taskdecks/my-permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_my_taskdeck_permissions',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Move/reorder list
    register_rest_route( $namespace, '/tasklists/(?P<id>\d+)/move', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_move_tasklist',
        'permission_callback' => 'aquaticpro_taskdeck_edit_permission',
        'args'                => array(
            'id' => array(
                'required'          => true,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param );
                },
            ),
            'sort_order' => array(
                'required'          => true,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param );
                },
            ),
        ),
    ) );

    // Set/unset a deck as the system-wide primary deck
    register_rest_route( $namespace, '/taskdecks/(?P<id>\d+)/set-primary', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_set_primary_deck',
        'permission_callback' => 'aquaticpro_taskdeck_manage_primary_permission',
        'args'                => array(
            'is_primary' => array(
                'required'          => true,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param ) || is_bool( $param );
                },
            ),
        ),
    ) );

    // Get the current primary deck
    register_rest_route( $namespace, '/taskdecks/primary', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_get_primary_deck',
        'permission_callback' => 'aquaticpro_taskdeck_view_permission',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_taskdeck_routes' );

// ============================================================================
// Permission Helper Functions
// ============================================================================

/**
 * Get the current user's TaskDeck permissions based on their job role
 * Returns array with canView, canCreate, canEdit, canDelete, canModerateAll, canViewOnlyAssigned, canManageAllPrimaryCards
 */
function aquaticpro_get_user_taskdeck_permissions( $user_id = null ) {
    global $wpdb;
    
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }
    
    if ( ! $user_id ) {
        return array(
            'canView' => false,
            'canViewOnlyAssigned' => false,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
            'canManagePrimaryDeck' => false,
            'canManageAllPrimaryCards' => false,
        );
    }
    
    // WordPress admins have full permissions
    if ( user_can( $user_id, 'manage_options' ) ) {
        return array(
            'canView' => true,
            'canViewOnlyAssigned' => false,  // Admins see everything
            'canCreate' => true,
            'canEdit' => true,
            'canDelete' => true,
            'canModerateAll' => true,
            'canManagePrimaryDeck' => true,
            'canManageAllPrimaryCards' => true,
        );
    }
    
    // Get user's job role
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'pg_taskdeck_permissions';
    
    $permissions = $wpdb->get_row( $wpdb->prepare(
        "SELECT p.can_view, p.can_view_only_assigned, p.can_create, p.can_edit, p.can_delete, p.can_moderate_all, p.can_manage_primary_deck, p.can_manage_all_primary_cards
         FROM {$assignments_table} a
         JOIN {$permissions_table} p ON a.job_role_id = p.job_role_id
         WHERE a.user_id = %d
         LIMIT 1",
        $user_id
    ), ARRAY_A );
    
    // Default permissions if no role assignment or permissions found
    if ( ! $permissions ) {
        return array(
            'canView' => true,  // Everyone can view by default
            'canViewOnlyAssigned' => false,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
            'canManagePrimaryDeck' => false,
            'canManageAllPrimaryCards' => false,
        );
    }
    
    return array(
        'canView' => (bool) $permissions['can_view'],
        'canViewOnlyAssigned' => (bool) ( $permissions['can_view_only_assigned'] ?? false ),
        'canCreate' => (bool) $permissions['can_create'],
        'canEdit' => (bool) $permissions['can_edit'],
        'canDelete' => (bool) $permissions['can_delete'],
        'canModerateAll' => (bool) $permissions['can_moderate_all'],
        'canManagePrimaryDeck' => (bool) ( $permissions['can_manage_primary_deck'] ?? false ),
        'canManageAllPrimaryCards' => (bool) ( $permissions['can_manage_all_primary_cards'] ?? false ),
    );
}

/**
 * Check if user can perform an action on a specific deck
 * Takes into account: deck ownership, deck privacy, and role permissions
 */
function aquaticpro_user_can_access_deck( $deck_id, $action = 'view', $user_id = null ) {
    global $wpdb;
    
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }
    
    if ( ! $user_id ) {
        return false;
    }
    
    // Get deck info
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    $deck = $wpdb->get_row( $wpdb->prepare(
        "SELECT created_by, is_public FROM {$table_decks} WHERE deck_id = %d",
        $deck_id
    ) );
    
    if ( ! $deck ) {
        return false;
    }
    
    // Deck owner can always do everything with their deck
    if ( (int) $deck->created_by === (int) $user_id ) {
        return true;
    }
    
    // Private decks (is_public = 0) - only owner can access
    if ( ! $deck->is_public ) {
        return false;
    }
    
    // Public decks - check role permissions
    $permissions = aquaticpro_get_user_taskdeck_permissions( $user_id );
    
    switch ( $action ) {
        case 'view':
            return $permissions['canView'];
        case 'create':
            return $permissions['canCreate'];
        case 'edit':
            return $permissions['canEdit'];
        case 'delete':
            return $permissions['canDelete'];
        case 'moderate':
            return $permissions['canModerateAll'];
        default:
            return false;
    }
}

/**
 * Check if user can perform an action on a specific card
 * Takes into account: card ownership, deck ownership, deck privacy, primary deck permissions, and role permissions
 */
function aquaticpro_user_can_access_card( $card_id, $action = 'view', $user_id = null ) {
    global $wpdb;
    
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }
    
    if ( ! $user_id ) {
        return false;
    }
    
    // Get card and deck info
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    $card_info = $wpdb->get_row( $wpdb->prepare(
        "SELECT c.created_by as card_creator, c.assigned_to, d.deck_id, d.created_by as deck_creator, d.is_public, d.is_primary
         FROM {$table_cards} c
         JOIN {$table_lists} l ON c.list_id = l.list_id
         JOIN {$table_decks} d ON l.deck_id = d.deck_id
         WHERE c.card_id = %d",
        $card_id
    ) );
    
    if ( ! $card_info ) {
        return false;
    }
    
    // Deck owner can always do everything
    if ( (int) $card_info->deck_creator === (int) $user_id ) {
        return true;
    }
    
    // Card creator can edit/delete their own cards
    if ( (int) $card_info->card_creator === (int) $user_id && in_array( $action, array( 'view', 'edit' ) ) ) {
        return true;
    }
    
    // Assigned user can view and edit their assigned cards
    if ( (int) $card_info->assigned_to === (int) $user_id && in_array( $action, array( 'view', 'edit' ) ) ) {
        return true;
    }
    
    // Private decks - only owner can access
    if ( ! $card_info->is_public ) {
        return false;
    }
    
    // Public decks - check role permissions
    $permissions = aquaticpro_get_user_taskdeck_permissions( $user_id );
    
    // Special case: Primary deck with canManageAllPrimaryCards permission
    // Users with this permission can view/edit/create any card on the primary deck
    if ( $card_info->is_primary && $permissions['canManageAllPrimaryCards'] ) {
        if ( in_array( $action, array( 'view', 'edit', 'create' ) ) ) {
            return true;
        }
    }
    
    switch ( $action ) {
        case 'view':
            return $permissions['canView'];
        case 'create':
            return $permissions['canCreate'];
        case 'edit':
            return $permissions['canEdit'];
        case 'delete':
            return $permissions['canDelete'];
        case 'moderate':
            return $permissions['canModerateAll'];
        default:
            return false;
    }
}

// ============================================================================
// Permission Callbacks
// ============================================================================

function aquaticpro_taskdeck_view_permission() {
    // Allow any logged-in user to view TaskDeck content
    // More granular permissions are checked in the callback functions
    return is_user_logged_in();
}

function aquaticpro_taskdeck_edit_permission() {
    // Allow logged-in users to edit
    // Can be further restricted by adding capability checks if needed
    return is_user_logged_in();
}

function aquaticpro_taskdeck_moderate_permission() {
    // Allow logged-in users to moderate their own content
    // Admin checks happen in the callback functions
    return is_user_logged_in();
}

/**
 * Permission check for managing primary deck
 * Only users with canManagePrimaryDeck permission or WP admins can set primary decks
 */
function aquaticpro_taskdeck_manage_primary_permission() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $user_id = get_current_user_id();
    
    // WordPress admins always have permission
    if ( user_can( $user_id, 'manage_options' ) ) {
        return true;
    }
    
    // Check for canManagePrimaryDeck permission
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'pg_taskdeck_permissions';
    
    $can_manage = $wpdb->get_var( $wpdb->prepare(
        "SELECT p.can_manage_primary_deck
         FROM {$assignments_table} a
         JOIN {$permissions_table} p ON a.job_role_id = p.job_role_id
         WHERE a.user_id = %d
         LIMIT 1",
        $user_id
    ) );
    
    return (bool) $can_manage;
}

// ============================================================================
// Deck Endpoints
// ============================================================================

/**
 * Invalidate TaskDeck cache for all users
 * Called when decks are created, updated, deleted, or modified
 * 
 * @deprecated Use mp_invalidate_taskdeck_caches() from security-helpers.php instead
 */
function aquaticpro_invalidate_taskdeck_cache() {
    // Delegate to centralized function
    if (function_exists('mp_invalidate_taskdeck_caches')) {
        mp_invalidate_taskdeck_caches('deck');
    }
}

function aquaticpro_get_taskdecks( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $user_id = get_current_user_id();
    $permissions = aquaticpro_get_user_taskdeck_permissions( $user_id );
    
    // Check cache first (5 minute TTL)
    // Cache key includes user ID and permissions hash since results vary by user
    $perm_hash = md5( json_encode( $permissions ) );
    $cache_key = 'td_decks_' . $user_id . '_' . $perm_hash;
    $force_refresh = $request->get_param('refresh') === 'true';
    
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            $response = rest_ensure_response( $cached );
            $response->header( 'X-Cache-Status', 'HIT' );
            // Add HTTP cache headers (5 min browser cache, user-specific)
            if ( function_exists( 'mp_add_cache_headers' ) ) {
                $response = mp_add_cache_headers( $response, 300, 60, true );
            }
            return $response;
        }
    }
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    // Get user's job role for role-based card assignment check
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_role_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT job_role_id FROM {$assignments_table} WHERE user_id = %d LIMIT 1",
        $user_id
    ) );
    
    // Users with canModerateAll can see all decks
    if ( $permissions['canModerateAll'] ) {
        $decks = $wpdb->get_results(
            "SELECT d.*, u.display_name as creator_name 
             FROM {$table_decks} d
             LEFT JOIN {$wpdb->users} u ON d.created_by = u.ID
             WHERE d.is_archived = 0
             ORDER BY d.created_at DESC"
        );
    } else {
        // Get decks the user can access:
        // 1. Decks they created (private or public)
        // 2. Public decks they have view permission for
        // 3. Decks where they have cards assigned (directly or by role)
        $decks = $wpdb->get_results( $wpdb->prepare(
            "SELECT DISTINCT d.*, u.display_name as creator_name 
             FROM {$table_decks} d
             LEFT JOIN {$wpdb->users} u ON d.created_by = u.ID
             LEFT JOIN {$wpdb->prefix}aqp_tasklists l ON d.deck_id = l.deck_id
             LEFT JOIN {$wpdb->prefix}aqp_taskcards c ON l.list_id = c.list_id
             WHERE d.is_archived = 0 
             AND (
                 d.created_by = %d 
                 OR (d.is_public = 1 AND %d = 1)
                 OR c.assigned_to = %d
                 OR (c.assigned_to_role_id = %d AND %d IS NOT NULL)
             )
             ORDER BY d.created_at DESC",
            $user_id,
            $permissions['canView'] ? 1 : 0,
            $user_id,
            $user_role_id ?: 0,
            $user_role_id
        ) );
    }
    
    // Add permission info to each deck for frontend
    foreach ( $decks as $deck ) {
        $is_owner = ( (int) $deck->created_by === (int) $user_id );
        // Normalize numeric fields for JavaScript strict equality
        $deck->deck_id = (int) $deck->deck_id;
        $deck->created_by = (int) $deck->created_by;
        $deck->is_archived = (int) $deck->is_archived;
        $deck->is_public = (int) $deck->is_public;
        $deck->is_primary = isset( $deck->is_primary ) ? (int) $deck->is_primary : 0;
        $deck->user_can_edit = $is_owner || ( $deck->is_public && $permissions['canEdit'] );
        $deck->user_can_delete = $is_owner || ( $deck->is_public && $permissions['canDelete'] );
        $deck->user_is_owner = $is_owner;
    }
    
    // Sort decks with primary deck first
    usort( $decks, function( $a, $b ) {
        // Primary deck always first
        if ( $a->is_primary !== $b->is_primary ) {
            return $b->is_primary - $a->is_primary;
        }
        // Then by creation date (newest first)
        return strcmp( $b->created_at, $a->created_at );
    } );
    
    // Cache for 5 minutes
    set_transient( $cache_key, $decks, 5 * MINUTE_IN_SECONDS );
    
    $response = rest_ensure_response( $decks );
    $response->header( 'X-Cache-Status', 'MISS' );
    // Add HTTP cache headers (5 min browser cache, user-specific)
    if ( function_exists( 'mp_add_cache_headers' ) ) {
        $response = mp_add_cache_headers( $response, 300, 60, true );
    }
    return $response;
}

function aquaticpro_get_taskdeck( $request ) {
    global $wpdb;
    
    $deck_id = $request['id'];
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    $deck = $wpdb->get_row( $wpdb->prepare(
        "SELECT d.*, u.display_name as creator_name 
         FROM {$table_decks} d
         LEFT JOIN {$wpdb->users} u ON d.created_by = u.ID
         WHERE d.deck_id = %d",
        $deck_id
    ) );
    
    if ( ! $deck ) {
        return new WP_Error( 'not_found', 'Deck not found', array( 'status' => 404 ) );
    }
    
    return rest_ensure_response( $deck );
}

function aquaticpro_create_taskdeck( $request ) {
    global $wpdb;
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    $inserted = $wpdb->insert(
        $table_decks,
        array(
            'deck_name'        => $request['deck_name'],
            'deck_description' => $request['deck_description'] ?? '',
            'created_by'       => get_current_user_id(),
            'is_public'        => isset( $request['is_public'] ) ? (int) $request['is_public'] : 0,
            'created_at'       => current_time( 'mysql' ),
        ),
        array( '%s', '%s', '%d', '%d', '%s' )
    );
    
    if ( ! $inserted ) {
        return new WP_Error( 'creation_failed', 'Failed to create deck', array( 'status' => 500 ) );
    }
    
    $deck_id = $wpdb->insert_id;
    
    // Create default lists
    $default_lists = array( 'To Do', 'In Progress', 'Done' );
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    foreach ( $default_lists as $index => $list_name ) {
        $wpdb->insert(
            $table_lists,
            array(
                'deck_id'    => $deck_id,
                'list_name'  => $list_name,
                'sort_order' => $index,
            ),
            array( '%d', '%s', '%d' )
        );
    }
    
    // Invalidate cache for all users
    aquaticpro_invalidate_taskdeck_cache();
    
    return rest_ensure_response( array( 'deck_id' => $deck_id, 'message' => 'Deck created successfully' ) );
}

function aquaticpro_update_taskdeck( $request ) {
    global $wpdb;
    
    $deck_id = $request['id'];
    $user_id = get_current_user_id();
    
    // Check permissions
    if ( ! aquaticpro_user_can_access_deck( $deck_id, 'edit', $user_id ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to edit this deck', array( 'status' => 403 ) );
    }
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    $update_data = array();
    $update_formats = array();
    
    if ( isset( $request['deck_name'] ) ) {
        $update_data['deck_name'] = sanitize_text_field( $request['deck_name'] );
        $update_formats[] = '%s';
    }
    if ( isset( $request['deck_description'] ) ) {
        $update_data['deck_description'] = sanitize_textarea_field( $request['deck_description'] );
        $update_formats[] = '%s';
    }
    if ( isset( $request['is_archived'] ) ) {
        $update_data['is_archived'] = (int) $request['is_archived'];
        $update_formats[] = '%d';
    }
    if ( isset( $request['is_public'] ) ) {
        $update_data['is_public'] = (int) $request['is_public'];
        $update_formats[] = '%d';
    }
    
    if ( empty( $update_data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_decks,
        $update_data,
        array( 'deck_id' => $deck_id ),
        $update_formats,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update deck', array( 'status' => 500 ) );
    }
    
    // Invalidate cache for all users
    aquaticpro_invalidate_taskdeck_cache();
    
    return rest_ensure_response( array( 'message' => 'Deck updated successfully' ) );
}

function aquaticpro_delete_taskdeck( $request ) {
    global $wpdb;
    
    $deck_id = $request['id'];
    $user_id = get_current_user_id();
    
    // Check permissions
    if ( ! aquaticpro_user_can_access_deck( $deck_id, 'delete', $user_id ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to delete this deck', array( 'status' => 403 ) );
    }
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    // Soft delete by archiving
    $updated = $wpdb->update(
        $table_decks,
        array( 'is_archived' => 1 ),
        array( 'deck_id' => $deck_id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete deck', array( 'status' => 500 ) );
    }
    
    // Invalidate cache for all users
    aquaticpro_invalidate_taskdeck_cache();
    
    return rest_ensure_response( array( 'message' => 'Deck archived successfully' ) );
}

/**
 * Set or unset a deck as the system-wide primary deck
 * Only one deck can be primary at a time
 */
function aquaticpro_set_primary_deck( $request ) {
    global $wpdb;
    
    $deck_id = (int) $request['id'];
    $is_primary = (int) $request['is_primary'];
    
    error_log("[set_primary_deck] Starting - deck_id: {$deck_id}, is_primary: {$is_primary}");
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    // Check if is_primary column exists
    $column_exists = $wpdb->get_results("SHOW COLUMNS FROM {$table_decks} LIKE 'is_primary'");
    if (empty($column_exists)) {
        error_log("[set_primary_deck] ERROR: is_primary column does not exist in {$table_decks}");
        // Try to add the column
        $alter_result = $wpdb->query("ALTER TABLE {$table_decks} ADD COLUMN is_primary tinyint(1) NOT NULL DEFAULT 0 AFTER is_public");
        error_log("[set_primary_deck] Added is_primary column: " . ($alter_result !== false ? 'SUCCESS' : 'FAILED - ' . $wpdb->last_error));
    }
    
    // Verify deck exists
    $deck = $wpdb->get_row( $wpdb->prepare(
        "SELECT deck_id FROM {$table_decks} WHERE deck_id = %d AND is_archived = 0",
        $deck_id
    ) );
    
    error_log("[set_primary_deck] Deck lookup result: " . ($deck ? "Found deck {$deck->deck_id}" : "NOT FOUND"));
    
    if ( ! $deck ) {
        return new WP_Error( 'not_found', 'Deck not found', array( 'status' => 404 ) );
    }
    
    // Start transaction
    $wpdb->query( 'START TRANSACTION' );
    
    error_log("[set_primary_deck] Started transaction");
    
    if ( $is_primary ) {
        // First, unset any existing primary deck
        $unset_sql = $wpdb->prepare(
            "UPDATE {$table_decks} SET is_primary = 0 WHERE is_primary = 1 AND deck_id != %d",
            $deck_id
        );
        error_log("[set_primary_deck] Running unset query: {$unset_sql}");
        $unset_result = $wpdb->query( $unset_sql );
        error_log("[set_primary_deck] Unset result: " . ($unset_result === false ? "FALSE - {$wpdb->last_error}" : $unset_result));
        
        // Set the new primary deck (also make it public so everyone can see it)
        $set_sql = $wpdb->prepare(
            "UPDATE {$table_decks} SET is_primary = 1, is_public = 1 WHERE deck_id = %d",
            $deck_id
        );
        error_log("[set_primary_deck] Running set query: {$set_sql}");
        $result = $wpdb->query( $set_sql );
        error_log("[set_primary_deck] Set result: " . ($result === false ? "FALSE - {$wpdb->last_error}" : $result));
        
        if ( $result === false ) {
            $wpdb->query( 'ROLLBACK' );
            error_log("[set_primary_deck] ROLLBACK due to error");
            return new WP_Error( 'update_failed', 'Failed to set primary deck: ' . $wpdb->last_error, array( 'status' => 500 ) );
        }
    } else {
        // Just unset primary status for this deck
        $result = $wpdb->query( $wpdb->prepare(
            "UPDATE {$table_decks} SET is_primary = 0 WHERE deck_id = %d",
            $deck_id
        ) );
        
        if ( $result === false ) {
            $wpdb->query( 'ROLLBACK' );
            return new WP_Error( 'update_failed', 'Failed to unset primary deck: ' . $wpdb->last_error, array( 'status' => 500 ) );
        }
    }
    
    $wpdb->query( 'COMMIT' );
    error_log("[set_primary_deck] COMMIT successful");
    
    // Verify the change
    $updated_deck = $wpdb->get_row( $wpdb->prepare(
        "SELECT is_primary FROM {$table_decks} WHERE deck_id = %d",
        $deck_id
    ) );
    
    error_log("[set_primary_deck] Verification - is_primary: " . ($updated_deck ? $updated_deck->is_primary : "NULL"));
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => $is_primary ? 'Deck set as primary' : 'Primary status removed',
        'deck_id' => $deck_id,
        'is_primary' => (int) $updated_deck->is_primary,
    ) );
}

/**
 * Get the current system-wide primary deck (if any)
 */
function aquaticpro_get_primary_deck( $request ) {
    global $wpdb;
    
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    
    $deck = $wpdb->get_row(
        "SELECT * FROM {$table_decks} WHERE is_primary = 1 AND is_archived = 0 LIMIT 1"
    );
    
    if ( ! $deck ) {
        return rest_ensure_response( null );
    }
    
    // Convert to proper types
    $deck->deck_id = (int) $deck->deck_id;
    $deck->created_by = (int) $deck->created_by;
    $deck->is_public = (int) $deck->is_public;
    $deck->is_primary = (int) $deck->is_primary;
    $deck->is_archived = (int) $deck->is_archived;
    
    return rest_ensure_response( $deck );
}

// ============================================================================
// List Endpoints
// ============================================================================

function aquaticpro_get_tasklists( $request ) {
    global $wpdb;
    
    $deck_id = $request['deck_id'];
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    $lists = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM {$table_lists} WHERE deck_id = %d ORDER BY sort_order ASC",
        $deck_id
    ) );
    
    return rest_ensure_response( $lists );
}

function aquaticpro_create_tasklist( $request ) {
    global $wpdb;
    
    $deck_id = $request['deck_id'];
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    // Use transaction for atomic sort_order assignment
    $wpdb->query( 'START TRANSACTION' );
    
    try {
        // Lock the rows for this deck to prevent race conditions
        $max_order = $wpdb->get_var( $wpdb->prepare(
            "SELECT MAX(sort_order) FROM {$table_lists} WHERE deck_id = %d FOR UPDATE",
            $deck_id
        ) );
        
        $inserted = $wpdb->insert(
            $table_lists,
            array(
                'deck_id'    => $deck_id,
                'list_name'  => $request['list_name'],
                'sort_order' => ( $max_order ?? -1 ) + 1,
            ),
            array( '%d', '%s', '%d' )
        );
        
        if ( ! $inserted ) {
            $wpdb->query( 'ROLLBACK' );
            return new WP_Error( 'creation_failed', 'Failed to create list', array( 'status' => 500 ) );
        }
        
        $list_id = $wpdb->insert_id;
        $wpdb->query( 'COMMIT' );
        
        return rest_ensure_response( array( 'list_id' => $list_id, 'message' => 'List created successfully' ) );
    } catch ( Exception $e ) {
        $wpdb->query( 'ROLLBACK' );
        return new WP_Error( 'creation_failed', 'Failed to create list: ' . $e->getMessage(), array( 'status' => 500 ) );
    }
}

function aquaticpro_update_tasklist( $request ) {
    global $wpdb;
    
    $list_id = $request['id'];
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    $update_data = array();
    
    if ( isset( $request['list_name'] ) ) {
        $update_data['list_name'] = sanitize_text_field( $request['list_name'] );
    }
    if ( isset( $request['sort_order'] ) ) {
        $update_data['sort_order'] = absint( $request['sort_order'] );
    }
    
    $updated = $wpdb->update(
        $table_lists,
        $update_data,
        array( 'list_id' => $list_id ),
        array_fill( 0, count( $update_data ), '%s' ),
        array( '%d' )
    );
    
    return rest_ensure_response( array( 'message' => 'List updated successfully' ) );
}

function aquaticpro_delete_tasklist( $request ) {
    global $wpdb;
    
    $list_id = $request['id'];
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    // Check if list has cards
    $card_count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}aqp_taskcards WHERE list_id = %d",
        $list_id
    ) );
    
    if ( $card_count > 0 ) {
        return new WP_Error( 'has_cards', 'Cannot delete list with cards', array( 'status' => 400 ) );
    }
    
    $deleted = $wpdb->delete( $table_lists, array( 'list_id' => $list_id ), array( '%d' ) );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete list', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'message' => 'List deleted successfully' ) );
}

// ============================================================================
// Batch Endpoint - Load all deck data in one request for fast initial loading
// ============================================================================

function aquaticpro_get_deck_batch( $request ) {
    global $wpdb;
    
    $deck_id = $request['deck_id'];
    $user_id = get_current_user_id();
    
    // Check deck access
    if ( ! aquaticpro_user_can_access_deck( $deck_id, 'view', $user_id ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to view this deck', array( 'status' => 403 ) );
    }
    
    // Get user permissions to check if they should only see assigned cards
    $permissions = aquaticpro_get_user_taskdeck_permissions( $user_id );
    $view_only_assigned = $permissions['canViewOnlyAssigned'] && !$permissions['canModerateAll'];
    
    // WordPress admins (manage_options) bypass role filtering entirely
    $is_wp_admin = user_can( $user_id, 'manage_options' );
    if ( $is_wp_admin ) {
        $view_only_assigned = false;
    }
    
    // Check if this is the primary deck and user has canManageAllPrimaryCards permission
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    $is_primary_deck = (bool) $wpdb->get_var( $wpdb->prepare(
        "SELECT is_primary FROM {$table_decks} WHERE deck_id = %d",
        $deck_id
    ) );
    
    // If user has canManageAllPrimaryCards and this IS the primary deck, they see all cards
    if ( $is_primary_deck && $permissions['canManageAllPrimaryCards'] ) {
        $view_only_assigned = false;
    }
    
    // Get user's job role ID for role-based card filtering
    $user_role_id = null;
    if ( $view_only_assigned ) {
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $user_role_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT job_role_id FROM {$assignments_table} WHERE user_id = %d LIMIT 1",
            $user_id
        ) );
    }
    
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $table_locations = $wpdb->prefix . 'pg_locations';
    $table_roles = $wpdb->prefix . 'pg_job_roles';
    $table_checklist = $wpdb->prefix . 'aqp_card_checklists';
    
    // Get all lists for the deck
    $lists = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM {$table_lists} WHERE deck_id = %d ORDER BY sort_order ASC",
        $deck_id
    ) );
    
    // Normalize list numeric fields
    foreach ( $lists as $list ) {
        $list->list_id = (int) $list->list_id;
        $list->deck_id = (int) $list->deck_id;
        $list->sort_order = (int) $list->sort_order;
    }
    
    if ( empty( $lists ) ) {
        return rest_ensure_response( array(
            'lists' => array(),
            'cards' => array(),
        ) );
    }
    
    // Get all list IDs for the cards query
    $list_ids = array_map( function( $list ) { return (int) $list->list_id; }, $lists );
    $list_ids_string = implode( ',', $list_ids );
    
    // Get ALL cards for all lists in one query with all JOINs
    // Note: Skip profile table join as it may not exist - profile pictures not critical
    $cards = $wpdb->get_results(
        "SELECT c.*, 
         creator.display_name as creator_name,
         assignee.display_name as assignee_name,
         loc.name as location_name,
         role.title as role_name,
         COALESCE(checklist_stats.total, 0) as checklist_total,
         COALESCE(checklist_stats.completed, 0) as checklist_completed
         FROM {$table_cards} c
         LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
         LEFT JOIN {$wpdb->users} assignee ON c.assigned_to = assignee.ID
         LEFT JOIN {$table_locations} loc ON c.location_id = loc.id
         LEFT JOIN {$table_roles} role ON c.assigned_to_role_id = role.id
         LEFT JOIN (
             SELECT card_id, 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as completed
             FROM {$table_checklist}
             GROUP BY card_id
         ) checklist_stats ON c.card_id = checklist_stats.card_id
         WHERE c.list_id IN ({$list_ids_string})
         ORDER BY c.sort_order ASC, c.created_at DESC"
    );
    
    // Fallback to simpler query if the complex one fails
    if ( $wpdb->last_error ) {
        error_log( 'TaskDeck batch query error: ' . $wpdb->last_error );
        $cards = $wpdb->get_results(
            "SELECT c.*, 
             creator.display_name as creator_name,
             assignee.display_name as assignee_name,
             role.title as role_name
             FROM {$table_cards} c
             LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
             LEFT JOIN {$wpdb->users} assignee ON c.assigned_to = assignee.ID
             LEFT JOIN {$table_roles} role ON c.assigned_to_role_id = role.id
             WHERE c.list_id IN ({$list_ids_string})
             ORDER BY c.sort_order ASC, c.created_at DESC"
        );
        
        // Add default values for fields from missing JOINs
        foreach ( $cards as $card ) {
            $card->assignee_profile_picture = null;
            $card->location_name = null;
            $card->checklist_total = 0;
            $card->checklist_completed = 0;
        }
    }
    
    // Handle case where cards is null/false
    if ( ! $cards ) {
        $cards = array();
    }
    
    // Get all card IDs for fetching checklist items, assignees, and roles in bulk
    $card_ids = array_map( function( $card ) { return (int) $card->card_id; }, $cards );
    
    // Fetch ALL checklist items for ALL cards in one query
    $checklist_items_by_card = array();
    if ( ! empty( $card_ids ) ) {
        $card_ids_string = implode( ',', $card_ids );
        $all_checklist_items = $wpdb->get_results(
            "SELECT * FROM {$table_checklist} 
             WHERE card_id IN ({$card_ids_string})
             ORDER BY sort_order ASC, created_at ASC"
        );
        
        // Group checklist items by card_id
        foreach ( $all_checklist_items as $item ) {
            $item->checklist_id = (int) $item->checklist_id;
            $item->card_id = (int) $item->card_id;
            $item->sort_order = (int) $item->sort_order;
            $item->is_complete = (int) $item->is_complete;
            
            $cid = $item->card_id;
            if ( ! isset( $checklist_items_by_card[ $cid ] ) ) {
                $checklist_items_by_card[ $cid ] = array();
            }
            $checklist_items_by_card[ $cid ][] = $item;
        }
    }
    
    // Fetch ALL assignees for ALL cards (multi-user support)
    $assignees_by_card = array();
    if ( ! empty( $card_ids ) ) {
        $card_ids_string = implode( ',', $card_ids );
        $table_assignees = $wpdb->prefix . 'aqp_card_assignees';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_assignees}'");
        
        if ($table_exists) {
            $all_assignees = $wpdb->get_results(
                "SELECT ca.card_id, ca.user_id, u.display_name as user_name
                 FROM {$table_assignees} ca
                 LEFT JOIN {$wpdb->users} u ON ca.user_id = u.ID
                 WHERE ca.card_id IN ({$card_ids_string})
                 ORDER BY ca.assigned_at ASC"
            );
            
            foreach ( $all_assignees as $assignee ) {
                $cid = (int) $assignee->card_id;
                if ( ! isset( $assignees_by_card[ $cid ] ) ) {
                    $assignees_by_card[ $cid ] = array();
                }
                $assignees_by_card[ $cid ][] = array(
                    'user_id' => (int) $assignee->user_id,
                    'user_name' => $assignee->user_name,
                );
            }
        }
    }
    
    // Fetch ALL assigned roles for ALL cards (multi-role support)
    $roles_by_card = array();
    if ( ! empty( $card_ids ) ) {
        $card_ids_string = implode( ',', $card_ids );
        $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_card_roles}'");
        
        if ($table_exists) {
            $all_roles = $wpdb->get_results(
                "SELECT cr.card_id, cr.role_id, r.title as role_name
                 FROM {$table_card_roles} cr
                 LEFT JOIN {$table_roles} r ON cr.role_id = r.id
                 WHERE cr.card_id IN ({$card_ids_string})
                 ORDER BY cr.assigned_at ASC"
            );
            
            foreach ( $all_roles as $role ) {
                $cid = (int) $role->card_id;
                if ( ! isset( $roles_by_card[ $cid ] ) ) {
                    $roles_by_card[ $cid ] = array();
                }
                $roles_by_card[ $cid ][] = array(
                    'role_id' => (int) $role->role_id,
                    'role_name' => $role->role_name,
                );
            }
        }
    }
    
    // Fetch ALL attachments for ALL cards (for thumbnail preview)
    $attachments_by_card = array();
    if ( ! empty( $card_ids ) ) {
        $card_ids_string = implode( ',', $card_ids );
        $table_attachments = $wpdb->prefix . 'aqp_card_attachments';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_attachments}'");
        
        if ($table_exists) {
            $all_attachments = $wpdb->get_results(
                "SELECT attachment_id, card_id, file_name, wp_attachment_id
                 FROM {$table_attachments}
                 WHERE card_id IN ({$card_ids_string})
                 ORDER BY uploaded_at ASC"
            );
            
            foreach ( $all_attachments as $attachment ) {
                $cid = (int) $attachment->card_id;
                // Get the file URL from WordPress
                $file_url = wp_get_attachment_url( $attachment->wp_attachment_id );
                
                if ( ! isset( $attachments_by_card[ $cid ] ) ) {
                    $attachments_by_card[ $cid ] = array();
                }
                $attachments_by_card[ $cid ][] = array(
                    'attachment_id' => (int) $attachment->attachment_id,
                    'file_name' => $attachment->file_name,
                    'file_url' => $file_url ? $file_url : null,
                    'wp_attachment_id' => (int) $attachment->wp_attachment_id,
                );
            }
        }
    }
    
    // Fetch comments metadata for ALL cards (count and recent commenters)
    $comments_by_card = array();
    if ( ! empty( $card_ids ) ) {
        $card_ids_string = implode( ',', $card_ids );
        $table_comments = $wpdb->prefix . 'aqp_card_comments';
        
        // Get comment count per card
        $comment_counts = $wpdb->get_results(
            "SELECT card_id, COUNT(*) as count 
             FROM {$table_comments} 
             WHERE card_id IN ({$card_ids_string}) 
             GROUP BY card_id"
        );
        
        // Get commenters per card (unique users)
        // We fetch commenters and group in PHP to ensure we get unique users per card
        $all_commenters = $wpdb->get_results(
            "SELECT c.card_id, c.user_id, u.display_name, u.user_email
             FROM {$table_comments} c
             JOIN {$wpdb->users} u ON c.user_id = u.ID
             WHERE c.card_id IN ({$card_ids_string})
             ORDER BY c.created_at DESC"
        );
        
        $counts_map = array();
        foreach ($comment_counts as $row) {
            $counts_map[(int)$row->card_id] = (int)$row->count;
        }

        foreach ($all_commenters as $row) {
            $cid = (int)$row->card_id;
            if (!isset($comments_by_card[$cid])) {
                $comments_by_card[$cid] = array(
                    'count' => isset($counts_map[$cid]) ? $counts_map[$cid] : 0,
                    'users' => array(),
                    'user_ids' => array() // Helpers to track uniqueness
                );
            }
            
            // Limit to 4 unique commenters per card for preview
            if (count($comments_by_card[$cid]['users']) < 4 && !in_array($row->user_id, $comments_by_card[$cid]['user_ids'])) {
                 $comments_by_card[$cid]['users'][] = array(
                     'user_id' => (int)$row->user_id,
                     'user_name' => $row->display_name,
                     'profile_picture' => get_avatar_url($row->user_email),
                 );
                 $comments_by_card[$cid]['user_ids'][] = $row->user_id;
            }
        }
        
        // Ensure counts are set for cards with comments even if loop didn't run (though it should have)
        foreach ($counts_map as $cid => $count) {
            if (!isset($comments_by_card[$cid])) {
                $comments_by_card[$cid] = array(
                    'count' => $count,
                    'users' => array(),
                    'user_ids' => array()
                );
            }
        }
    }
    
    // Normalize card numeric fields and group by list_id
    // Also filter cards if user has view_only_assigned permission
    $cards_by_list = array();
    foreach ( $cards as $card ) {
        $card->card_id = (int) $card->card_id;
        $card->list_id = (int) $card->list_id;
        $card->created_by = (int) $card->created_by;
        $card->assigned_to = $card->assigned_to ? (int) $card->assigned_to : null;
        $card->assigned_to_role_id = $card->assigned_to_role_id ? (int) $card->assigned_to_role_id : null;
        $card->location_id = $card->location_id ? (int) $card->location_id : null;
        $card->is_complete = (int) $card->is_complete;
        $card->sort_order = (int) $card->sort_order;
        $card->checklist_total = (int) $card->checklist_total;
        $card->checklist_completed = (int) $card->checklist_completed;
        
        // Attach checklist items to this card
        $card->checklist_items = isset( $checklist_items_by_card[ $card->card_id ] ) 
            ? $checklist_items_by_card[ $card->card_id ] 
            : array();
        
        // Attach multi-assignees (normalized to match React types)
        $card->assignees = isset( $assignees_by_card[ $card->card_id ] )
            ? $assignees_by_card[ $card->card_id ]
            : array();
        // Also keep assigned_users for backward compatibility
        $card->assigned_users = $card->assignees;
        
        // Attach multi-roles (new)
        $card->assigned_roles = isset( $roles_by_card[ $card->card_id ] )
            ? $roles_by_card[ $card->card_id ]
            : array();
        
        // Attach attachments for thumbnail preview (new)
        $card->attachments = isset( $attachments_by_card[ $card->card_id ] )
            ? $attachments_by_card[ $card->card_id ]
            : array();
            
        // Attach comments metadata
        $card_comments = isset( $comments_by_card[ $card->card_id ] ) 
             ? $comments_by_card[ $card->card_id ] 
             : array( 'count' => 0, 'users' => array() );
             
        $card->comments_count = $card_comments['count'];
        $card->commenters = $card_comments['users'];
        
        // For backward compatibility, also set assignee_name from first user and role_name from first role
        if ( empty( $card->assignee_name ) && ! empty( $card->assignees ) ) {
            $card->assignee_name = $card->assignees[0]['user_name'];
        }
        if ( empty( $card->role_name ) && ! empty( $card->assigned_roles ) ) {
            $card->role_name = $card->assigned_roles[0]['role_name'];
        }
        
        // Filter cards if user has view_only_assigned permission
        if ( $view_only_assigned ) {
            $is_assigned_to_user = false;
            
            // Check if directly assigned to user (legacy single assignment)
            if ( $card->assigned_to === $user_id ) {
                $is_assigned_to_user = true;
            }
            
            // Check if in multi-assignees list
            if ( ! $is_assigned_to_user && ! empty( $card->assignees ) ) {
                foreach ( $card->assignees as $assignee ) {
                    if ( (int) $assignee['user_id'] === $user_id ) {
                        $is_assigned_to_user = true;
                        break;
                    }
                }
            }
            
            // Check if assigned to user's role (legacy single role)
            if ( ! $is_assigned_to_user && $user_role_id && $card->assigned_to_role_id === (int) $user_role_id ) {
                $is_assigned_to_user = true;
            }
            
            // Check if in multi-roles list
            if ( ! $is_assigned_to_user && $user_role_id && ! empty( $card->assigned_roles ) ) {
                foreach ( $card->assigned_roles as $role ) {
                    if ( (int) $role['role_id'] === (int) $user_role_id ) {
                        $is_assigned_to_user = true;
                        break;
                    }
                }
            }
            
            // Skip this card if not assigned to user
            if ( ! $is_assigned_to_user ) {
                continue;
            }
        }
        
        // Group cards by list_id
        $list_id = $card->list_id;
        if ( ! isset( $cards_by_list[ $list_id ] ) ) {
            $cards_by_list[ $list_id ] = array();
        }
        $cards_by_list[ $list_id ][] = $card;
    }
    
    error_log( 'TaskDeck Batch: Loaded ' . count($lists) . ' lists and ' . count($cards) . ' cards for deck ' . $deck_id . ' (view_only_assigned: ' . ($view_only_assigned ? 'yes' : 'no') . ')' );
    
    return rest_ensure_response( array(
        'lists' => $lists,
        'cards_by_list' => $cards_by_list,
    ) );
}

// ============================================================================
// Card Endpoints
// ============================================================================

function aquaticpro_get_taskcards( $request ) {
    global $wpdb;
    
    $list_id = $request['list_id'];
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $table_locations = $wpdb->prefix . 'pg_locations';
    $table_roles = $wpdb->prefix . 'pg_job_roles';
    $table_checklist = $wpdb->prefix . 'aqp_card_checklists';
    
    // OPTIMIZED: Single query with all JOINs to eliminate N+1 problem
    // Previously: 1 query + 4 queries per card = 400+ queries for 100 cards
    // Now: 1 query total regardless of card count
    $cards = $wpdb->get_results( $wpdb->prepare(
        "SELECT c.*, 
         creator.display_name as creator_name,
         assignee.display_name as assignee_name,
         loc.name as location_name,
         role.title as role_name,
         COALESCE(checklist_stats.total, 0) as checklist_total,
         COALESCE(checklist_stats.completed, 0) as checklist_completed
         FROM {$table_cards} c
         LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
         LEFT JOIN {$wpdb->users} assignee ON c.assigned_to = assignee.ID
         LEFT JOIN {$table_locations} loc ON c.location_id = loc.id
         LEFT JOIN {$table_roles} role ON c.assigned_to_role_id = role.id
         LEFT JOIN (
             SELECT card_id, 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as completed
             FROM {$table_checklist}
             GROUP BY card_id
         ) checklist_stats ON c.card_id = checklist_stats.card_id
         WHERE c.list_id = %d 
         ORDER BY c.sort_order ASC, c.created_at DESC",
        $list_id
    ) );
    
    if ( $wpdb->last_error ) {
        error_log( 'TaskDeck get_taskcards error: ' . $wpdb->last_error );
        // Fallback to simple query if JOINs fail (table doesn't exist)
        $cards = $wpdb->get_results( $wpdb->prepare(
            "SELECT c.*, 
             creator.display_name as creator_name,
             assignee.display_name as assignee_name
             FROM {$table_cards} c
             LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
             LEFT JOIN {$wpdb->users} assignee ON c.assigned_to = assignee.ID
             WHERE c.list_id = %d 
             ORDER BY c.sort_order ASC, c.created_at DESC",
            $list_id
        ) );
        
        // Add default values for missing fields
        foreach ( $cards as $card ) {
            $card->assignee_profile_picture = null;
            $card->location_name = null;
            $card->role_name = null;
            $card->checklist_total = 0;
            $card->checklist_completed = 0;
        }
    }
    
    // Normalize numeric fields to ensure proper type for JavaScript comparisons
    // MySQL returns all values as strings, but JS needs numbers for strict equality
    foreach ( $cards as $card ) {
        $card->card_id = (int) $card->card_id;
        $card->list_id = (int) $card->list_id;
        $card->created_by = (int) $card->created_by;
        $card->assigned_to = $card->assigned_to ? (int) $card->assigned_to : null;
        $card->assigned_to_role_id = $card->assigned_to_role_id ? (int) $card->assigned_to_role_id : null;
        $card->location_id = $card->location_id ? (int) $card->location_id : null;
        $card->is_complete = (int) $card->is_complete;
        $card->sort_order = (int) $card->sort_order;
        $card->checklist_total = (int) $card->checklist_total;
        $card->checklist_completed = (int) $card->checklist_completed;
    }
    
    error_log( 'TaskDeck: Fetched ' . count($cards) . ' cards for list ' . $list_id );
    
    return rest_ensure_response( $cards );
}

function aquaticpro_get_taskcard( $request ) {
    global $wpdb;
    
    $card_id = $request['id'];
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    
    $card = $wpdb->get_row( $wpdb->prepare(
        "SELECT c.*, 
         creator.display_name as creator_name,
         assignee.display_name as assignee_name
         FROM {$table_cards} c
         LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
         LEFT JOIN {$wpdb->users} assignee ON c.assigned_to = assignee.ID
         WHERE c.card_id = %d",
        $card_id
    ) );
    
    if ( ! $card ) {
        return new WP_Error( 'not_found', 'Card not found', array( 'status' => 404 ) );
    }
    
    // Normalize numeric fields for JavaScript strict equality comparisons
    $card->card_id = (int) $card->card_id;
    $card->list_id = (int) $card->list_id;
    $card->created_by = (int) $card->created_by;
    $card->assigned_to = $card->assigned_to ? (int) $card->assigned_to : null;
    $card->assigned_to_role_id = $card->assigned_to_role_id ? (int) $card->assigned_to_role_id : null;
    $card->location_id = $card->location_id ? (int) $card->location_id : null;
    $card->is_complete = (int) $card->is_complete;
    $card->sort_order = (int) $card->sort_order;
    
    return rest_ensure_response( $card );
}

function aquaticpro_create_taskcard( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $list_id = $request['list_id'];
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $user_id = get_current_user_id();
    
    // Use transaction for atomic sort_order assignment
    $wpdb->query( 'START TRANSACTION' );
    
    try {
        // Lock the rows for this list to prevent race conditions
        $max_order = $wpdb->get_var( $wpdb->prepare(
            "SELECT MAX(sort_order) FROM {$table_cards} WHERE list_id = %d FOR UPDATE",
            $list_id
        ) );
        
        // Validate accent_color if provided
        $accent_color = null;
        if ( isset( $request['accent_color'] ) && ! empty( $request['accent_color'] ) ) {
            if ( preg_match( '/^#[a-fA-F0-9]{6}$/', $request['accent_color'] ) ) {
                $accent_color = sanitize_text_field( $request['accent_color'] );
            }
        }
        
        $inserted = $wpdb->insert(
            $table_cards,
            array(
                'list_id'          => $list_id,
                'title'            => $request['title'],
                'description'      => $request['description'] ?? '',
                'created_by'         => $user_id,
                'assigned_to'        => $request['assigned_to'] ?? null,
                'assigned_to_role_id' => $request['assigned_to_role'] ?? null,
                'location_id'        => $request['location_id'] ?? null,
                'due_date'         => $request['due_date'] ?? null,
                'category_tag'     => $request['category_tag'] ?? null,
                'accent_color'     => $accent_color,
                'sort_order'       => ( $max_order ?? -1 ) + 1,
                'created_at'       => current_time( 'mysql' ),
                'updated_at'       => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
        );
        
        if ( ! $inserted ) {
            $wpdb->query( 'ROLLBACK' );
            return new WP_Error( 'creation_failed', 'Failed to create card', array( 'status' => 500 ) );
        }
        
        $card_id = $wpdb->insert_id;
        $wpdb->query( 'COMMIT' );
        
        // Handle multi-assignment: assignees (multiple users)
        if ( isset( $request['assignees'] ) && is_array( $request['assignees'] ) ) {
            $table_card_assignees = $wpdb->prefix . 'aqp_card_assignees';
            foreach ( $request['assignees'] as $assignee_id ) {
                $assignee_id = absint( $assignee_id );
                if ( $assignee_id > 0 ) {
                    $wpdb->insert(
                        $table_card_assignees,
                        array(
                            'card_id' => $card_id,
                            'user_id' => $assignee_id,
                        ),
                        array( '%d', '%d' )
                    );
                }
            }
        }
        
        // Handle multi-assignment: assigned_roles (multiple roles)
        if ( isset( $request['assigned_roles'] ) && is_array( $request['assigned_roles'] ) ) {
            $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
            foreach ( $request['assigned_roles'] as $role_id ) {
                $role_id = absint( $role_id );
                if ( $role_id > 0 ) {
                    $wpdb->insert(
                        $table_card_roles,
                        array(
                            'card_id' => $card_id,
                            'role_id' => $role_id,
                        ),
                        array( '%d', '%d' )
                    );
                }
            }
        }
        
        // Log activity
        if ( $aquaticpro_taskdeck ) {
            $aquaticpro_taskdeck->log_activity( $card_id, $user_id, 'Card created' );
        }
        
        // Return the full card data (frontend expects complete card object)
        $card = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$table_cards} WHERE card_id = %d",
            $card_id
        ), ARRAY_A );
        
        // Get creator name
        $creator = get_userdata( $user_id );
        $card['creator_name'] = $creator ? $creator->display_name : '';
        
        // Include assignees and roles in response
        $table_card_assignees = $wpdb->prefix . 'aqp_card_assignees';
        $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
        
        $card['assignees'] = $wpdb->get_results( $wpdb->prepare(
            "SELECT ca.user_id, u.display_name 
             FROM {$table_card_assignees} ca
             LEFT JOIN {$wpdb->users} u ON ca.user_id = u.ID
             WHERE ca.card_id = %d",
            $card_id
        ), ARRAY_A );
        
        $card['assigned_roles'] = $wpdb->get_results( $wpdb->prepare(
            "SELECT cr.role_id, r.title as role_name 
             FROM {$table_card_roles} cr
             LEFT JOIN {$wpdb->prefix}pg_job_roles r ON cr.role_id = r.id
             WHERE cr.card_id = %d",
            $card_id
        ), ARRAY_A );
        
        return rest_ensure_response( $card );
    } catch ( Exception $e ) {
        $wpdb->query( 'ROLLBACK' );
        return new WP_Error( 'creation_failed', 'Failed to create card: ' . $e->getMessage(), array( 'status' => 500 ) );
    }
}

function aquaticpro_update_taskcard( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $card_id = $request['id'];
    $user_id = get_current_user_id();
    
    // Check permissions
    if ( ! aquaticpro_user_can_access_card( $card_id, 'edit', $user_id ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to edit this card', array( 'status' => 403 ) );
    }
    
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    
    // Get current card for comparison and optimistic locking
    $old_card = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM {$table_cards} WHERE card_id = %d",
        $card_id
    ) );
    
    if ( ! $old_card ) {
        return new WP_Error( 'not_found', 'Card not found', array( 'status' => 404 ) );
    }
    
    // OPTIMISTIC LOCKING: Check if card was modified by another user since it was loaded
    // Client sends the updated_at timestamp they have; if it doesn't match, another user edited it
    if ( isset( $request['expected_updated_at'] ) ) {
        $expected = strtotime( $request['expected_updated_at'] );
        $actual = strtotime( $old_card->updated_at );
        
        // Allow 2 second tolerance for slight timing differences
        if ( abs( $expected - $actual ) > 2 ) {
            return new WP_Error( 
                'conflict', 
                'This card was modified by another user. Please refresh and try again.',
                array( 
                    'status' => 409,
                    'current_updated_at' => $old_card->updated_at,
                    'modified_by' => $old_card->assigned_to // Could be enhanced to show who modified
                )
            );
        }
    }
    
    $update_data = array();
    $activities = array();
    
    if ( isset( $request['title'] ) && $request['title'] !== $old_card->title ) {
        $update_data['title'] = sanitize_text_field( $request['title'] );
        $activities[] = 'Title updated';
    }
    if ( isset( $request['description'] ) ) {
        $update_data['description'] = sanitize_textarea_field( $request['description'] );
    }
    if ( isset( $request['assigned_to'] ) && $request['assigned_to'] != $old_card->assigned_to ) {
        $update_data['assigned_to'] = absint( $request['assigned_to'] );
        $user = get_userdata( $request['assigned_to'] );
        if ( $user ) {
            $activities[] = sprintf( 'Assigned to %s', $user->display_name );
        }
    }
    if ( isset( $request['assigned_to_role'] ) && $request['assigned_to_role'] != $old_card->assigned_to_role_id ) {
        $update_data['assigned_to_role_id'] = $request['assigned_to_role'] ? absint( $request['assigned_to_role'] ) : null;
        if ( $request['assigned_to_role'] ) {
            $role_name = $wpdb->get_var( $wpdb->prepare(
                "SELECT title FROM {$wpdb->prefix}pg_job_roles WHERE id = %d",
                $request['assigned_to_role']
            ) );
            if ( $role_name ) {
                $activities[] = sprintf( 'Assigned to role: %s', $role_name );
            }
        }
    }
    if ( isset( $request['due_date'] ) && $request['due_date'] !== $old_card->due_date ) {
        $update_data['due_date'] = $request['due_date'];
        $activities[] = 'Due date updated';
    }
    if ( isset( $request['location_id'] ) && $request['location_id'] != $old_card->location_id ) {
        $update_data['location_id'] = $request['location_id'] ? absint( $request['location_id'] ) : null;
        if ( $request['location_id'] ) {
            $location = $wpdb->get_var( $wpdb->prepare(
                "SELECT location_name FROM {$wpdb->prefix}aqp_locations WHERE location_id = %d",
                $request['location_id']
            ) );
            if ( $location ) {
                $activities[] = sprintf( 'Location set to %s', $location );
            }
        }
    }
    if ( isset( $request['category_tag'] ) ) {
        $update_data['category_tag'] = sanitize_text_field( $request['category_tag'] );
    }
    if ( isset( $request['accent_color'] ) ) {
        // Validate hex color format or allow null/empty
        $accent_color = $request['accent_color'];
        if ( empty( $accent_color ) ) {
            $update_data['accent_color'] = null;
        } elseif ( preg_match( '/^#[a-fA-F0-9]{6}$/', $accent_color ) ) {
            $update_data['accent_color'] = sanitize_text_field( $accent_color );
        }
    }
    if ( isset( $request['is_complete'] ) && (int) $request['is_complete'] !== (int) $old_card->is_complete ) {
        $update_data['is_complete'] = (int) $request['is_complete'];
        $activities[] = $request['is_complete'] ? 'Card marked as complete' : 'Card marked as incomplete';
    }
    
    if ( ! empty( $update_data ) ) {
        $updated = $wpdb->update(
            $table_cards,
            $update_data,
            array( 'card_id' => $card_id ),
            array_fill( 0, count( $update_data ), '%s' ),
            array( '%d' )
        );
        
        // Log activities
        if ( $aquaticpro_taskdeck && ! empty( $activities ) ) {
            foreach ( $activities as $activity ) {
                $aquaticpro_taskdeck->log_activity( $card_id, get_current_user_id(), $activity );
            }
        }
    }
    
    // Handle multi-assignment: assignees (multiple users)
    if ( isset( $request['assignees'] ) && is_array( $request['assignees'] ) ) {
        $table_card_assignees = $wpdb->prefix . 'aqp_card_assignees';
        
        // Get current assignees for activity logging
        $old_assignees = $wpdb->get_col( $wpdb->prepare(
            "SELECT user_id FROM {$table_card_assignees} WHERE card_id = %d",
            $card_id
        ) );
        
        // Delete existing assignees
        $wpdb->delete( $table_card_assignees, array( 'card_id' => $card_id ), array( '%d' ) );
        
        // Insert new assignees
        $new_assignee_names = array();
        foreach ( $request['assignees'] as $assignee_id ) {
            $assignee_id = absint( $assignee_id );
            if ( $assignee_id > 0 ) {
                $wpdb->insert(
                    $table_card_assignees,
                    array(
                        'card_id' => $card_id,
                        'user_id' => $assignee_id,
                    ),
                    array( '%d', '%d' )
                );
                $user = get_userdata( $assignee_id );
                if ( $user ) {
                    $new_assignee_names[] = $user->display_name;
                }
            }
        }
        
        // Log activity for assignee changes
        if ( $aquaticpro_taskdeck && count( $request['assignees'] ) !== count( $old_assignees ) || 
             array_diff( $request['assignees'], $old_assignees ) || array_diff( $old_assignees, $request['assignees'] ) ) {
            if ( ! empty( $new_assignee_names ) ) {
                $aquaticpro_taskdeck->log_activity( 
                    $card_id, 
                    get_current_user_id(), 
                    'Assigned to: ' . implode( ', ', $new_assignee_names )
                );
            } else {
                $aquaticpro_taskdeck->log_activity( $card_id, get_current_user_id(), 'Removed all user assignments' );
            }
        }
    }
    
    // Handle multi-assignment: assigned_roles (multiple roles)
    if ( isset( $request['assigned_roles'] ) && is_array( $request['assigned_roles'] ) ) {
        $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
        
        // Get current roles for activity logging
        $old_roles = $wpdb->get_col( $wpdb->prepare(
            "SELECT role_id FROM {$table_card_roles} WHERE card_id = %d",
            $card_id
        ) );
        
        // Delete existing role assignments
        $wpdb->delete( $table_card_roles, array( 'card_id' => $card_id ), array( '%d' ) );
        
        // Insert new role assignments
        $new_role_names = array();
        foreach ( $request['assigned_roles'] as $role_id ) {
            $role_id = absint( $role_id );
            if ( $role_id > 0 ) {
                $wpdb->insert(
                    $table_card_roles,
                    array(
                        'card_id' => $card_id,
                        'role_id' => $role_id,
                    ),
                    array( '%d', '%d' )
                );
                $role_name = $wpdb->get_var( $wpdb->prepare(
                    "SELECT title FROM {$wpdb->prefix}pg_job_roles WHERE id = %d",
                    $role_id
                ) );
                if ( $role_name ) {
                    $new_role_names[] = $role_name;
                }
            }
        }
        
        // Log activity for role changes
        if ( $aquaticpro_taskdeck && count( $request['assigned_roles'] ) !== count( $old_roles ) || 
             array_diff( $request['assigned_roles'], $old_roles ) || array_diff( $old_roles, $request['assigned_roles'] ) ) {
            if ( ! empty( $new_role_names ) ) {
                $aquaticpro_taskdeck->log_activity( 
                    $card_id, 
                    get_current_user_id(), 
                    'Assigned to roles: ' . implode( ', ', $new_role_names )
                );
            } else {
                $aquaticpro_taskdeck->log_activity( $card_id, get_current_user_id(), 'Removed all role assignments' );
            }
        }
    }
    
    // Get the new updated_at timestamp for optimistic locking on subsequent updates
    $new_updated_at = $wpdb->get_var( $wpdb->prepare(
        "SELECT updated_at FROM {$table_cards} WHERE card_id = %d",
        $card_id
    ) );
    
    return rest_ensure_response( array( 
        'message' => 'Card updated successfully',
        'updated_at' => $new_updated_at
    ) );
}

function aquaticpro_delete_taskcard( $request ) {
    global $wpdb;
    
    $card_id = $request['id'];
    $user_id = get_current_user_id();
    
    // Check permissions
    if ( ! aquaticpro_user_can_access_card( $card_id, 'delete', $user_id ) ) {
        return new WP_Error( 'forbidden', 'You do not have permission to delete this card', array( 'status' => 403 ) );
    }
    
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    
    // Use transaction to ensure all related data is deleted atomically
    $wpdb->query( 'START TRANSACTION' );
    
    try {
        // Delete related data
        $wpdb->delete( $wpdb->prefix . 'aqp_card_comments', array( 'card_id' => $card_id ), array( '%d' ) );
        $wpdb->delete( $wpdb->prefix . 'aqp_card_attachments', array( 'card_id' => $card_id ), array( '%d' ) );
        $wpdb->delete( $wpdb->prefix . 'aqp_card_checklists', array( 'card_id' => $card_id ), array( '%d' ) );
        $wpdb->delete( $wpdb->prefix . 'aqp_activity_log', array( 'card_id' => $card_id ), array( '%d' ) );
        
        // Delete card
        $deleted = $wpdb->delete( $table_cards, array( 'card_id' => $card_id ), array( '%d' ) );
        
        if ( ! $deleted ) {
            $wpdb->query( 'ROLLBACK' );
            return new WP_Error( 'delete_failed', 'Failed to delete card', array( 'status' => 500 ) );
        }
        
        $wpdb->query( 'COMMIT' );
        return rest_ensure_response( array( 'message' => 'Card deleted successfully' ) );
    } catch ( Exception $e ) {
        $wpdb->query( 'ROLLBACK' );
        return new WP_Error( 'delete_failed', 'Failed to delete card: ' . $e->getMessage(), array( 'status' => 500 ) );
    }
}

function aquaticpro_move_taskcard( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $card_id = $request['id'];
    $new_list_id = $request['list_id'];
    $new_sort_order = $request['sort_order'];
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    
    // Get card and list info
    $card = $wpdb->get_row( $wpdb->prepare(
        "SELECT c.*, l.list_name as old_list_name 
         FROM {$table_cards} c
         LEFT JOIN {$wpdb->prefix}aqp_tasklists l ON c.list_id = l.list_id
         WHERE c.card_id = %d",
        $card_id
    ) );
    
    if ( ! $card ) {
        return new WP_Error( 'not_found', 'Card not found', array( 'status' => 404 ) );
    }
    
    $new_list = $wpdb->get_row( $wpdb->prepare(
        "SELECT list_name FROM {$wpdb->prefix}aqp_tasklists WHERE list_id = %d",
        $new_list_id
    ) );
    
    $updated = $wpdb->update(
        $table_cards,
        array(
            'list_id'    => $new_list_id,
            'sort_order' => $new_sort_order,
        ),
        array( 'card_id' => $card_id ),
        array( '%d', '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'move_failed', 'Failed to move card', array( 'status' => 500 ) );
    }
    
    // Log activity if list changed
    if ( $card->list_id != $new_list_id && $new_list && $aquaticpro_taskdeck ) {
        $aquaticpro_taskdeck->log_activity(
            $card_id,
            get_current_user_id(),
            sprintf( 'Card moved from "%s" to "%s"', $card->old_list_name, $new_list->list_name )
        );
    }
    
    return rest_ensure_response( array( 'message' => 'Card moved successfully' ) );
}

// ============================================================================
// Comment Endpoints
// ============================================================================

function aquaticpro_get_card_comments( $request ) {
    global $wpdb;
    
    $card_id = $request['card_id'];
    $current_user_id = get_current_user_id();
    $table_comments = $wpdb->prefix . 'aqp_card_comments';
    
    // Switch to Unified Reactions Table
    $table_reactions = $wpdb->prefix . 'aqp_unified_reactions';
    
    $comments = $wpdb->get_results( $wpdb->prepare(
        "SELECT c.*, u.display_name as user_name, u.user_email
         FROM {$table_comments} c
         LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
         WHERE c.card_id = %d
         ORDER BY c.created_at ASC",
        $card_id
    ) );

    // Fetch reactions for these comments
    if (!empty($comments)) {
        $comment_ids = array_column($comments, 'comment_id');
        $placeholders = implode(',', array_fill(0, count($comment_ids), '%d'));
        
        // 1. Get counts per reaction type per comment
        // Note: Using object_id as comment_id, and filtering by object_type
        $counts_query = "SELECT object_id as comment_id, reaction_type, COUNT(*) as count 
                         FROM {$table_reactions} 
                         WHERE object_id IN ($placeholders) 
                         AND object_type = 'card_comment'
                         GROUP BY object_id, reaction_type";
        $counts = $wpdb->get_results($wpdb->prepare($counts_query, $comment_ids));
        
        // 2. Get current user's reactions
        $user_reactions = [];
        if ($current_user_id) {
            $user_query = "SELECT object_id as comment_id, reaction_type 
                           FROM {$table_reactions} 
                           WHERE user_id = %d 
                           AND object_id IN ($placeholders)
                           AND object_type = 'card_comment'";
            // Prepend user_id to args
            $args = array_merge([$current_user_id], $comment_ids);
            $user_reactions_rows = $wpdb->get_results($wpdb->prepare($user_query, $args));
            foreach ($user_reactions_rows as $row) {
                $user_reactions[$row->comment_id] = $row->reaction_type;
            }
        }

        // Map counts to comments
        $reactions_map = [];
        foreach ($counts as $row) {
            if (!isset($reactions_map[$row->comment_id])) {
                $reactions_map[$row->comment_id] = [];
            }
            $reactions_map[$row->comment_id][$row->reaction_type] = (int)$row->count;
        }

        foreach ($comments as $comment) {
            $comment->reactions = isset($reactions_map[$comment->comment_id]) ? $reactions_map[$comment->comment_id] : new stdClass();
            $comment->user_reaction = isset($user_reactions[$comment->comment_id]) ? $user_reactions[$comment->comment_id] : null;
            $comment->avatar_url = get_avatar_url($comment->user_id);
        }
    } else {
        // Empty comments list
        return rest_ensure_response( [] );
    }
    
    return rest_ensure_response( $comments );
}

function aquaticpro_create_card_comment( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $card_id = $request['card_id'];
    $table_comments = $wpdb->prefix . 'aqp_card_comments';
    $user_id = get_current_user_id();
    
    $inserted = $wpdb->insert(
        $table_comments,
        array(
            'card_id'      => $card_id,
            'user_id'      => $user_id,
            'comment_text' => $request['comment_text'],
            'created_at'   => current_time( 'mysql' ),
        ),
        array( '%d', '%d', '%s', '%s' )
    );
    
    if ( ! $inserted ) {
        return new WP_Error( 'creation_failed', 'Failed to create comment', array( 'status' => 500 ) );
    }

    // Capture the comment ID immediately, before any other DB operations overwrite insert_id
    $comment_id = $wpdb->insert_id;
    
    // Log activity
    if ( $aquaticpro_taskdeck ) {
        $aquaticpro_taskdeck->log_activity( $card_id, $user_id, 'Comment added' );
    }
    
    // Fetch the full newly created comment to return to frontend
    // This ensures the frontend has the server-generated timestamp and user details
    $new_comment = $wpdb->get_row( $wpdb->prepare(
        "SELECT c.*, u.display_name as user_name, u.user_email
         FROM {$table_comments} c
         LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
         WHERE c.comment_id = %d",
        $comment_id
    ) );
    
    if ($new_comment) {
        $new_comment->avatar_url = get_avatar_url($new_comment->user_id);
        // Initialize reactions for consistency
        $new_comment->reactions = new stdClass();
        $new_comment->user_reaction = null;
    }
    
    return rest_ensure_response( $new_comment );
}

function aquaticpro_delete_card_comment( $request ) {
    global $wpdb;
    
    $comment_id = $request['id'];
    $table_comments = $wpdb->prefix . 'aqp_card_comments';
    
    $deleted = $wpdb->delete( $table_comments, array( 'comment_id' => $comment_id ), array( '%d' ) );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete comment', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'message' => 'Comment deleted successfully' ) );
}

function aquaticpro_toggle_card_comment_reaction( $request ) {
    global $wpdb;
    
    $comment_id = $request['id'];
    $reaction_type = $request->get_param('reaction_type');
    $user_id = get_current_user_id();
    
    // Switch to Unified Reactions Table
    $table_reactions = $wpdb->prefix . 'aqp_unified_reactions';
    
    // Validate reaction type
    if (!in_array($reaction_type, ['thumbs_up', 'thumbs_down', 'heart'])) {
        return new WP_Error('invalid_reaction', 'Invalid reaction type', ['status' => 400]);
    }
    
    // Check if reaction exists
    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT id, reaction_type FROM $table_reactions 
         WHERE user_id = %d AND object_id = %d AND object_type = 'card_comment'",
        $user_id, $comment_id
    ));
    
    if ($existing) {
        if ($existing->reaction_type === $reaction_type) {
            // Remove reaction (toggle off)
            $wpdb->delete($table_reactions, ['id' => $existing->id], ['%d']);
            $action = 'removed';
        } else {
            // Update reaction (change type)
            $wpdb->update(
                $table_reactions,
                ['reaction_type' => $reaction_type],
                ['id' => $existing->id],
                ['%s'],
                ['%d']
            );
            $action = 'updated';
        }
    } else {
        // Fetch comment author to store in reaction for stats
        $table_comments = $wpdb->prefix . 'aqp_card_comments';
        $comment_author_id = $wpdb->get_var($wpdb->prepare(
            "SELECT user_id FROM $table_comments WHERE comment_id = %d",
            $comment_id
        ));

        // Add new reaction
        $wpdb->insert(
            $table_reactions,
            [
                'object_id' => $comment_id,
                'object_type' => 'card_comment',
                'user_id' => $user_id,
                'reaction_type' => $reaction_type,
                'item_author_id' => $comment_author_id ?: 0
            ],
            ['%d', '%s', '%d', '%s', '%d']
        );
        $action = 'added';
    }
    
    // Return updated counts and user reaction
    $counts = $wpdb->get_results($wpdb->prepare(
        "SELECT reaction_type, COUNT(*) as count 
         FROM $table_reactions 
         WHERE object_id = %d AND object_type = 'card_comment'
         GROUP BY reaction_type",
        $comment_id
    ));
    
    $reactions_map = [];
    foreach ($counts as $row) {
        $reactions_map[$row->reaction_type] = (int)$row->count;
    }
    
    return rest_ensure_response([
        'action' => $action,
        'user_reaction' => $action === 'removed' ? null : $reaction_type,
        'reactions' => $reactions_map
    ]);
}

// ============================================================================
// Attachment Endpoints
// ============================================================================

function aquaticpro_get_card_attachments( $request ) {
    global $wpdb;
    
    $card_id = $request['card_id'];
    $table_attachments = $wpdb->prefix . 'aqp_card_attachments';
    
    $attachments = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.*, u.display_name as user_name
         FROM {$table_attachments} a
         LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
         WHERE a.card_id = %d
         ORDER BY a.uploaded_at DESC",
        $card_id
    ) );
    
    // Add file URLs
    foreach ( $attachments as $attachment ) {
        $attachment->file_url = wp_get_attachment_url( $attachment->wp_attachment_id );
    }
    
    return rest_ensure_response( $attachments );
}

function aquaticpro_create_card_attachment( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $card_id = $request['card_id'];
    
    // Handle file upload
    if ( empty( $_FILES['file'] ) ) {
        return new WP_Error( 'no_file', 'No file uploaded', array( 'status' => 400 ) );
    }
    
    require_once( ABSPATH . 'wp-admin/includes/file.php' );
    require_once( ABSPATH . 'wp-admin/includes/media.php' );
    require_once( ABSPATH . 'wp-admin/includes/image.php' );
    
    $file = $_FILES['file'];
    $upload = wp_handle_upload( $file, array( 'test_form' => false ) );
    
    if ( isset( $upload['error'] ) ) {
        return new WP_Error( 'upload_failed', $upload['error'], array( 'status' => 500 ) );
    }
    
    // Create attachment post
    $attachment_id = wp_insert_attachment(
        array(
            'post_mime_type' => $upload['type'],
            'post_title'     => sanitize_file_name( $file['name'] ),
            'post_content'   => '',
            'post_status'    => 'inherit',
        ),
        $upload['file']
    );
    
    if ( is_wp_error( $attachment_id ) ) {
        return new WP_Error( 'attachment_failed', 'Failed to create attachment', array( 'status' => 500 ) );
    }
    
    // Generate metadata
    wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $upload['file'] ) );
    
    // Save to TaskDeck table
    $table_attachments = $wpdb->prefix . 'aqp_card_attachments';
    $user_id = get_current_user_id();
    
    $inserted = $wpdb->insert(
        $table_attachments,
        array(
            'card_id'          => $card_id,
            'user_id'          => $user_id,
            'file_name'        => sanitize_file_name( $file['name'] ),
            'wp_attachment_id' => $attachment_id,
            'uploaded_at'      => current_time( 'mysql' ),
        ),
        array( '%d', '%d', '%s', '%d', '%s' )
    );
    
    if ( ! $inserted ) {
        return new WP_Error( 'creation_failed', 'Failed to save attachment', array( 'status' => 500 ) );
    }
    
    // Log activity
    if ( $aquaticpro_taskdeck ) {
        $aquaticpro_taskdeck->log_activity( $card_id, $user_id, sprintf( 'Attachment added: %s', $file['name'] ) );
    }
    
    return rest_ensure_response( array(
        'attachment_id' => $wpdb->insert_id,
        'file_url'      => wp_get_attachment_url( $attachment_id ),
        'message'       => 'Attachment uploaded successfully',
    ) );
}

function aquaticpro_delete_card_attachment( $request ) {
    global $wpdb;
    
    $attachment_id = $request['id'];
    $table_attachments = $wpdb->prefix . 'aqp_card_attachments';
    
    // Get attachment info
    $attachment = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM {$table_attachments} WHERE attachment_id = %d",
        $attachment_id
    ) );
    
    if ( ! $attachment ) {
        return new WP_Error( 'not_found', 'Attachment not found', array( 'status' => 404 ) );
    }
    
    // Delete from WordPress media library
    wp_delete_attachment( $attachment->wp_attachment_id, true );
    
    // Delete from table
    $deleted = $wpdb->delete( $table_attachments, array( 'attachment_id' => $attachment_id ), array( '%d' ) );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete attachment', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'message' => 'Attachment deleted successfully' ) );
}

// ============================================================================
// Checklist Endpoints
// ============================================================================

function aquaticpro_get_card_checklist( $request ) {
    global $wpdb;
    
    $card_id = $request['card_id'];
    $table_checklists = $wpdb->prefix . 'aqp_card_checklists';
    
    $checklist = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM {$table_checklists} 
         WHERE card_id = %d 
         ORDER BY sort_order ASC, created_at ASC",
        $card_id
    ) );
    
    // Normalize numeric fields for JavaScript strict equality
    foreach ( $checklist as $item ) {
        $item->checklist_id = (int) $item->checklist_id;
        $item->card_id = (int) $item->card_id;
        $item->sort_order = (int) $item->sort_order;
        $item->is_complete = (int) $item->is_complete;
    }
    
    return rest_ensure_response( $checklist );
}

function aquaticpro_create_checklist_item( $request ) {
    global $wpdb;
    
    $card_id = $request['card_id'];
    $table_checklists = $wpdb->prefix . 'aqp_card_checklists';
    
    // Get max sort order
    $max_order = $wpdb->get_var( $wpdb->prepare(
        "SELECT MAX(sort_order) FROM {$table_checklists} WHERE card_id = %d",
        $card_id
    ) );
    
    $sort_order = ( $max_order ?? -1 ) + 1;
    $created_at = current_time( 'mysql' );
    
    $inserted = $wpdb->insert(
        $table_checklists,
        array(
            'card_id'    => $card_id,
            'item_text'  => $request['item_text'],
            'sort_order' => $sort_order,
            'is_complete' => 0,
            'created_at' => $created_at,
        ),
        array( '%d', '%s', '%d', '%d', '%s' )
    );
    
    if ( ! $inserted ) {
        return new WP_Error( 'creation_failed', 'Failed to create checklist item', array( 'status' => 500 ) );
    }
    
    // Return the full created item
    return rest_ensure_response( array(
        'checklist_id' => $wpdb->insert_id,
        'card_id'      => $card_id,
        'item_text'    => $request['item_text'],
        'sort_order'   => $sort_order,
        'is_complete'  => 0,
        'created_at'   => $created_at,
    ) );
}

function aquaticpro_update_checklist_item( $request ) {
    global $wpdb, $aquaticpro_taskdeck;
    
    $checklist_id = $request['id'];
    $table_checklists = $wpdb->prefix . 'aqp_card_checklists';
    
    $update_data = array();
    $update_formats = array();
    
    if ( isset( $request['item_text'] ) ) {
        $update_data['item_text'] = sanitize_text_field( $request['item_text'] );
        $update_formats[] = '%s';
    }
    if ( isset( $request['is_complete'] ) ) {
        $update_data['is_complete'] = (int) $request['is_complete'];
        $update_formats[] = '%d';
        
        // Log activity
        if ( $aquaticpro_taskdeck ) {
            $item = $wpdb->get_row( $wpdb->prepare(
                "SELECT card_id, item_text FROM {$table_checklists} WHERE checklist_id = %d",
                $checklist_id
            ) );
            if ( $item ) {
                $status = $request['is_complete'] ? 'completed' : 'uncompleted';
                $aquaticpro_taskdeck->log_activity(
                    $item->card_id,
                    get_current_user_id(),
                    sprintf( 'Checklist item "%s" %s', $item->item_text, $status )
                );
            }
        }
    }
    if ( isset( $request['sort_order'] ) ) {
        $update_data['sort_order'] = absint( $request['sort_order'] );
        $update_formats[] = '%d';
    }
    
    if ( empty( $update_data ) ) {
        return new WP_Error( 'no_data', 'No data provided to update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_checklists,
        $update_data,
        array( 'checklist_id' => $checklist_id ),
        $update_formats,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        error_log( 'TaskDeck: Failed to update checklist item ' . $checklist_id . ': ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to update checklist item', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'message' => 'Checklist item updated successfully', 'updated' => $updated ) );
}

function aquaticpro_delete_checklist_item( $request ) {
    global $wpdb;
    
    $checklist_id = $request['id'];
    $table_checklists = $wpdb->prefix . 'aqp_card_checklists';
    
    $deleted = $wpdb->delete( $table_checklists, array( 'checklist_id' => $checklist_id ), array( '%d' ) );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete checklist item', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'message' => 'Checklist item deleted successfully' ) );
}

// ============================================================================
// Activity Log Endpoint
// ============================================================================

function aquaticpro_get_card_activity( $request ) {
    global $wpdb;
    
    $card_id = $request['card_id'];
    $table_activity_log = $wpdb->prefix . 'aqp_activity_log';
    
    $activities = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.*, u.display_name as user_name
         FROM {$table_activity_log} a
         LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
         WHERE a.card_id = %d
         ORDER BY a.created_at DESC",
        $card_id
    ) );
    
    return rest_ensure_response( $activities );
}

// ============================================================================
// Helper Endpoints - Categories and Locations
// ============================================================================

function aquaticpro_get_card_categories( $request ) {
    // 5-minute transient cache — categories rarely change
    $cache_key = 'aqp_card_categories';
    $cached = get_transient( $cache_key );
    if ( false !== $cached ) {
        return rest_ensure_response( $cached );
    }

    global $wpdb;
    
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    
    // Get all unique category tags that have been used
    $categories = $wpdb->get_col(
        "SELECT DISTINCT category_tag 
         FROM {$table_cards} 
         WHERE category_tag IS NOT NULL 
         AND category_tag != ''
         ORDER BY category_tag ASC"
    );
    
    set_transient( $cache_key, $categories, 5 * MINUTE_IN_SECONDS );
    return rest_ensure_response( $categories );
}

function aquaticpro_get_locations( $request ) {
    // 5-minute transient cache — locations rarely change
    $cache_key = 'aqp_locations_list';
    $cached = get_transient( $cache_key );
    if ( false !== $cached ) {
        return rest_ensure_response( $cached );
    }

    global $wpdb;
    
    $table_locations = $wpdb->prefix . 'aqp_locations';
    
    // Get all active locations
    $locations = $wpdb->get_results(
        "SELECT id as location_id, name as location_name 
         FROM {$table_locations} 
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC",
        ARRAY_A
    );

    if ( $wpdb->last_error ) {
        // Table may not exist yet — return empty
        return rest_ensure_response( array() );
    }
    
    set_transient( $cache_key, $locations, 5 * MINUTE_IN_SECONDS );
    return rest_ensure_response( $locations );
}

/**
 * Get all users for assignment dropdown
 */
function aquaticpro_get_all_users( $request ) {
    // 5-minute transient cache — user list rarely changes
    $cache_key = 'aqp_taskdeck_all_users';
    $cached = get_transient( $cache_key );
    if ( false !== $cached ) {
        return rest_ensure_response( $cached );
    }

    global $wpdb;
    
    // Single query with JOIN to avoid N+1 get_user_meta calls
    $users = $wpdb->get_results(
        "SELECT u.ID as id,
                COALESCE(NULLIF(fn.meta_value, ''), u.display_name) as firstName,
                COALESCE(ln.meta_value, '') as lastName,
                u.user_email as email
         FROM {$wpdb->users} u
         LEFT JOIN {$wpdb->usermeta} fn ON fn.user_id = u.ID AND fn.meta_key = 'first_name'
         LEFT JOIN {$wpdb->usermeta} ln ON ln.user_id = u.ID AND ln.meta_key = 'last_name'
         WHERE u.ID != 0
         ORDER BY u.display_name ASC",
        ARRAY_A
    );
    
    set_transient( $cache_key, $users, 5 * MINUTE_IN_SECONDS );
    return rest_ensure_response( $users );
}

/**
 * Get all job roles for role-based assignment
 */
function aquaticpro_get_job_roles( $request ) {
    // 5-minute transient cache — roles rarely change
    $cache_key = 'aqp_taskdeck_job_roles';
    $cached = get_transient( $cache_key );
    if ( false !== $cached ) {
        return rest_ensure_response( $cached );
    }

    global $wpdb;
    
    $table_name = $wpdb->prefix . 'pg_job_roles';
    
    // Get all job roles - sort by tier ASC (lowest first), then alphabetically
    $roles = $wpdb->get_results(
        "SELECT id as role_id, title as role_name, tier
         FROM {$table_name}
         ORDER BY tier ASC, title ASC",
        ARRAY_A
    );
    
    // Cast numeric fields to integers for proper JSON typing
    foreach ($roles as &$role) {
        $role['role_id'] = (int) $role['role_id'];
        $role['tier'] = $role['tier'] ? (int) $role['tier'] : null;
    }
    
    set_transient( $cache_key, $roles, 5 * MINUTE_IN_SECONDS );
    return rest_ensure_response( $roles );
}

/**
 * Get current user's TaskDeck permissions
 */
function aquaticpro_get_my_taskdeck_permissions( $request ) {
    $user_id = get_current_user_id();
    
    if ( ! $user_id ) {
        return new WP_Error( 'not_logged_in', 'User must be logged in', array( 'status' => 401 ) );
    }
    
    $permissions = aquaticpro_get_user_taskdeck_permissions( $user_id );
    
    return rest_ensure_response( $permissions );
}

/**
 * Get cards assigned to the current user (either directly or via role)
 */
function aquaticpro_get_my_assigned_cards( $request ) {
    global $wpdb;
    
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'not_logged_in', 'User must be logged in', array( 'status' => 401 ) );
    }
    
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
    $table_assignments = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Get user's job role IDs from assignments table
    $user_role_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT job_role_id FROM {$table_assignments} WHERE user_id = %d",
        $user_id
    ) );
    
    // Fallback to user meta if no assignments found (backwards compatibility)
    if ( empty( $user_role_ids ) ) {
        $user_meta_roles = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $user_meta_roles ) && is_array( $user_meta_roles ) ) {
            $user_role_ids = array_map( 'intval', $user_meta_roles );
        }
    }
    
    // Build query to get cards assigned to user directly OR via their role(s)
    // Exclude completed cards (is_complete = 1)
    $query_parts = array();
    $query_params = array();
    
    // Cards assigned directly to user
    $query_parts[] = "c.assigned_to = %d";
    $query_params[] = $user_id;
    
    // Cards assigned via assigned_to_role_id column (legacy method)
    if ( ! empty( $user_role_ids ) ) {
        $role_placeholders = implode( ',', array_fill( 0, count( $user_role_ids ), '%d' ) );
        $query_parts[] = "c.assigned_to_role_id IN ($role_placeholders)";
        $query_params = array_merge( $query_params, $user_role_ids );
    }
    
    // Cards assigned via aqp_card_assigned_roles join table (current method used by Awesome Awards)
    if ( ! empty( $user_role_ids ) ) {
        $role_placeholders = implode( ',', array_fill( 0, count( $user_role_ids ), '%d' ) );
        $query_parts[] = "EXISTS (
            SELECT 1 FROM {$table_card_roles} car 
            WHERE car.card_id = c.card_id 
            AND car.role_id IN ($role_placeholders)
        )";
        $query_params = array_merge( $query_params, $user_role_ids );
    }

    // Cards assigned via aqp_card_assignees join table (multi-user assignment - current method)
    $table_card_assignees = $wpdb->prefix . 'aqp_card_assignees';
    if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table_card_assignees}'" ) === $table_card_assignees ) {
        $query_parts[] = "EXISTS (
            SELECT 1 FROM {$table_card_assignees} ca
            WHERE ca.card_id = c.card_id
            AND ca.user_id = %d
        )";
        $query_params[] = $user_id;
    }
    
    $where_clause = '(' . implode( ' OR ', $query_parts ) . ')';
    
    // Exclude cards that are more than 14 days overdue - these are likely orphaned/stale
    // Cards with no due date are still included
    $query = "SELECT DISTINCT c.*, l.list_name, d.deck_name,
         creator.display_name as creator_name
         FROM {$table_cards} c
         LEFT JOIN {$table_lists} l ON c.list_id = l.list_id
         LEFT JOIN {$table_decks} d ON l.deck_id = d.deck_id
         LEFT JOIN {$wpdb->users} creator ON c.created_by = creator.ID
         WHERE $where_clause
         AND (c.is_complete IS NULL OR c.is_complete = 0)
         AND (c.due_date IS NULL OR c.due_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY))
         ORDER BY c.due_date ASC, c.created_at DESC";
    
    $cards = $wpdb->get_results( $wpdb->prepare( $query, ...$query_params ) );
    
    if ( $wpdb->last_error ) {
        error_log( 'TaskDeck get_my_assigned_cards error: ' . $wpdb->last_error );
        return new WP_Error( 'db_error', 'Database error: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    error_log( 'TaskDeck: Found ' . count($cards) . ' cards assigned to user ' . $user_id . ' (roles: ' . implode(',', $user_role_ids) . ')' );
    
    return rest_ensure_response( array(
        'cards' => $cards,
        'count' => count($cards),
    ) );
}

/**
 * Move/reorder a task list
 */
function aquaticpro_move_tasklist( $request ) {
    global $wpdb;
    
    $list_id = $request['id'];
    $new_sort_order = $request['sort_order'];
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    
    // Update the list sort order
    $updated = $wpdb->update(
        $table_lists,
        array( 'sort_order' => $new_sort_order ),
        array( 'list_id' => $list_id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update list order', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}
