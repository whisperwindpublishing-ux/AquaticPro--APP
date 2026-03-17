<?php
/**
 * Awesome Awards REST API Routes
 *
 * @package AquaticPro
 * @subpackage AwesomeAwards
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register all Awesome Awards REST API routes
 */
function aquaticpro_register_awesome_awards_routes() {
    // Only register if class exists and module is enabled
    if ( ! class_exists( 'Awesome_Awards' ) || ! Awesome_Awards::is_enabled() ) {
        return;
    }

    $namespace = 'mentorship-platform/v1';

    // Get current user's permissions
    register_rest_route( $namespace, '/awesome-awards/my-permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_my_permissions',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // GET pending nominations count (for sidebar badge)
    register_rest_route( $namespace, '/awesome-awards/nominations/pending-count', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_pending_count',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // GET pending nominations (approval queue)
    register_rest_route( $namespace, '/awesome-awards/nominations/pending', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_pending_nominations',
        'permission_callback' => 'aquaticpro_aa_can_approve',
    ) );

    // GET all periods
    register_rest_route( $namespace, '/awesome-awards/periods', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_periods',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // GET all permissions (admin)
    register_rest_route( $namespace, '/awesome-awards/permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_all_permissions',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
    ) );

    // CREATE a new period
    register_rest_route( $namespace, '/awesome-awards/periods', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_create_period',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
    ) );

    // UPDATE a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_aa_update_period',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // Archive/unarchive a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_aa_toggle_archive',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // UPDATE period status (workflow transitions)
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)/status', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_aa_update_period_status',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // DELETE a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_aa_delete_period',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // ============================================
    // CATEGORY MANAGEMENT
    // ============================================

    // GET categories for a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<period_id>\d+)/categories', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_categories',
        'permission_callback' => 'is_user_logged_in',
        'args'                => array(
            'period_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // CREATE category for a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<period_id>\d+)/categories', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_create_category',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'period_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // UPDATE category
    register_rest_route( $namespace, '/awesome-awards/categories/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_aa_update_category',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // DELETE category
    register_rest_route( $namespace, '/awesome-awards/categories/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_aa_delete_category',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // ============================================
    // NOMINATION APPROVAL
    // ============================================

    // Approve/reject a nomination
    register_rest_route( $namespace, '/awesome-awards/nominations/(?P<nomination_id>\d+)/approve', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_aa_approve_nomination',
        'permission_callback' => 'aquaticpro_aa_can_approve',
        'args'                => array(
            'nomination_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // GET all nominations (with query params for filtering)
    register_rest_route( $namespace, '/awesome-awards/nominations', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_all_nominations',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // GET nominations for a period
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<period_id>\d+)/nominations', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_nominations',
        'permission_callback' => 'is_user_logged_in',
        'args'                => array(
            'period_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // CREATE a nomination
    register_rest_route( $namespace, '/awesome-awards/periods/(?P<period_id>\d+)/nominations', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_create_nomination',
        'permission_callback' => 'aquaticpro_aa_can_nominate',
        'args'                => array(
            'period_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // VOTE for a nomination
    register_rest_route( $namespace, '/awesome-awards/nominations/(?P<nomination_id>\d+)/vote', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_vote',
        'permission_callback' => 'aquaticpro_aa_can_vote',
        'args'                => array(
            'nomination_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // Remove vote
    register_rest_route( $namespace, '/awesome-awards/nominations/(?P<nomination_id>\d+)/vote', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_aa_remove_vote',
        'permission_callback' => 'aquaticpro_aa_can_vote',
        'args'                => array(
            'nomination_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // Get active periods (open for nominations or voting)
    register_rest_route( $namespace, '/awesome-awards/active-periods', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_active_periods',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Select winner
    register_rest_route( $namespace, '/awesome-awards/nominations/(?P<nomination_id>\d+)/winner', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_select_winner',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'nomination_id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // Get winners
    register_rest_route( $namespace, '/awesome-awards/winners', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_winners',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Get current/recent winner for banner
    register_rest_route( $namespace, '/awesome-awards/current-winner', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_current_winner',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // User search for nominations
    register_rest_route( $namespace, '/awesome-awards/users', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_search_users',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Simple user list for nominations (excludes current user)
    register_rest_route( $namespace, '/awesome-awards/users/simple', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_simple_users',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // Update permissions (admin)
    register_rest_route( $namespace, '/awesome-awards/permissions', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_update_permissions',
        'permission_callback' => 'aquaticpro_aa_is_admin',
    ) );

    // TaskDeck Integration Routes
    register_rest_route( $namespace, '/awesome-awards/tasklists', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_tasklists',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
    ) );

    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)/tasklist', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_link_tasklist',
        'permission_callback' => 'aquaticpro_aa_can_manage_periods',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    register_rest_route( $namespace, '/awesome-awards/periods/(?P<id>\d+)/tasks', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_aa_get_period_tasks',
        'permission_callback' => 'is_user_logged_in',
        'args'                => array(
            'id' => array(
                'validate_callback' => function($value) { return is_numeric($value); },
            ),
        ),
    ) );

    // Admin route to force cleanup of expired TaskDeck cards (for testing/debugging)
    register_rest_route( $namespace, '/awesome-awards/force-cleanup', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_aa_force_cleanup',
        'permission_callback' => 'aquaticpro_aa_is_admin',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_awesome_awards_routes' );

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Enrich nomination with user data (nested objects for frontend)
 * 
 * Creates nested nominee and nominator objects that the frontend expects,
 * while keeping flat fields for backwards compatibility.
 *
 * @param array $nom Nomination data array (passed by reference)
 * @param int|null $current_user_id Current user ID for vote checking
 * @return void
 */
function aquaticpro_aa_enrich_nomination( &$nom, $current_user_id = null ) {
    global $wpdb;
    
    $nominee = get_userdata( $nom['nominee_id'] );
    $nominator = get_userdata( $nom['nominator_id'] );
    
    // Flat fields (backwards compatibility)
    $nom['nominee_name'] = $nominee ? $nominee->display_name : 'Unknown';
    $nom['nominee_avatar'] = $nominee ? get_avatar_url( $nominee->ID ) : '';
    $nom['nominator_name'] = $nominator ? $nominator->display_name : 'Unknown';
    
    // Nested objects (expected by frontend)
    $nom['nominee'] = $nominee ? array(
        'id'           => (int) $nominee->ID,
        'display_name' => $nominee->display_name,
        'avatar_url'   => get_avatar_url( $nominee->ID ),
    ) : null;
    
    // Nominator object - always include full data, is_anonymous controls display in frontend
    $nom['nominator'] = $nominator ? array(
        'id'           => (int) $nominator->ID,
        'display_name' => $nominator->display_name,
        'avatar_url'   => get_avatar_url( $nominator->ID ),
    ) : null;
    
    // Ensure proper boolean types
    $nom['is_winner'] = (bool) intval( isset( $nom['is_winner'] ) ? $nom['is_winner'] : 0 );
    $nom['is_anonymous'] = (bool) intval( $nom['is_anonymous'] ?? 0 );
    $nom['vote_count'] = (int) ($nom['vote_count'] ?? 0);
    
    // Check if current user has voted for this nomination
    if ( $current_user_id ) {
        $votes_table = $wpdb->prefix . 'awesome_awards_votes';
        $user_voted = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $votes_table WHERE nomination_id = %d AND voter_id = %d",
            $nom['id'],
            $current_user_id
        ));
        $nom['user_voted'] = (int) $user_voted > 0;
    }
}

/**
 * Get current user's Awesome Awards permissions
 */
function aquaticpro_aa_get_my_permissions( $request ) {
    if ( ! class_exists( 'Awesome_Awards' ) ) {
        return rest_ensure_response( array() );
    }
    $user_id = get_current_user_id();
    $permissions = Awesome_Awards::get_user_permissions( $user_id );
    return rest_ensure_response( $permissions );
}

/**
 * Get pending nominations count (for sidebar badge)
 */
function aquaticpro_aa_get_pending_count( $request ) {
    global $wpdb;
    
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array( 'count' => 0 ) );
    }
    
    // Count nominations pending approval (status = 'pending' or no winner selected yet in active periods)
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $count = $wpdb->get_var(
        "SELECT COUNT(*) FROM $nominations_table n
         JOIN $periods_table p ON n.period_id = p.id
         WHERE p.status IN ('nominations_open', 'voting_open', 'pending_approval')
         AND n.is_winner = 0"
    );
    
    return rest_ensure_response( array( 'count' => intval( $count ) ) );
}

/**
 * Get pending nominations (for approval queue)
 */
function aquaticpro_aa_get_pending_nominations( $request ) {
    global $wpdb;
    
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    // Get all pending nominations from active periods
    // Use COALESCE to fall back to period name when category_name is null (categories deprecated)
    $results = $wpdb->get_results(
        "SELECT n.*, p.name as period_name, p.status as period_status, 
         COALESCE(c.name, p.name) as category_name
         FROM $nominations_table n
         JOIN $periods_table p ON n.period_id = p.id
         LEFT JOIN $categories_table c ON n.category_id = c.id
         WHERE n.status = 'pending'
         AND p.status IN ('nominations_open', 'voting_open', 'pending_approval')
         ORDER BY n.created_at DESC",
        ARRAY_A
    );
    
    // Enrich with user data using helper function
    if ( $results ) {
        $current_user_id = get_current_user_id();
        foreach ( $results as &$nom ) {
            aquaticpro_aa_enrich_nomination( $nom, $current_user_id );
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Permission callback: Check if user can manage periods
 * WordPress admins with manage_options capability always have access
 */
function aquaticpro_aa_can_manage_periods() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins always have access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    if ( ! class_exists( 'Awesome_Awards' ) ) {
        return false;
    }
    
    return Awesome_Awards::user_can( 'can_manage_periods' );
}

/**
 * Get all periods
 */
function aquaticpro_aa_get_periods( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    // Build WHERE clause based on filters
    $where_clauses = array();
    
    // Filter by archived status if specified
    if ( $request->has_param( 'archived' ) ) {
        $archived = $request->get_param( 'archived' );
        if ( $archived === 'false' || $archived === false ) {
            $where_clauses[] = 'archived = 0';
        } elseif ( $archived === 'true' || $archived === true ) {
            $where_clauses[] = 'archived = 1';
        }
    }
    
    // Filter by status if specified
    if ( $request->has_param( 'status' ) ) {
        $status = sanitize_text_field( $request->get_param( 'status' ) );
        $where_clauses[] = $wpdb->prepare( 'status = %s', $status );
    }
    
    // Build query
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    $query = "SELECT * FROM $table $where_sql ORDER BY start_date DESC";
    
    $results = $wpdb->get_results( $query, ARRAY_A );
    
    // Cast boolean fields properly for JavaScript and add categories
    if ( $results ) {
        foreach ( $results as &$row ) {
            $row['archived'] = (bool) intval( $row['archived'] );
            $row['taskdeck_enabled'] = (bool) intval( isset( $row['taskdeck_enabled'] ) ? $row['taskdeck_enabled'] : 0 );
            
            // Unserialize and include under both old and new field names
            $nom_roles = maybe_unserialize( $row['nomination_reminder_roles'] ?? '' );
            $vote_roles = maybe_unserialize( $row['voting_reminder_roles'] ?? '' );
            $row['nomination_reminder_roles'] = $nom_roles ?: array();
            $row['voting_reminder_roles'] = $vote_roles ?: array();
            $row['nomination_task_roles'] = $nom_roles ?: array(); // New field name
            $row['voting_task_roles'] = $vote_roles ?: array(); // New field name
            
            // Include new window field names (derived from legacy columns)
            $row['nomination_start'] = $row['start_date'];
            $row['nomination_end'] = $row['nomination_deadline'];
            
            // Include max_winners and allow_pre_voting
            $row['max_winners'] = isset( $row['max_winners'] ) ? (int) $row['max_winners'] : 1;
            $row['allow_pre_voting'] = (bool) intval( isset( $row['allow_pre_voting'] ) ? $row['allow_pre_voting'] : 0 );
            
            // Count winners for this period
            $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
            $winner_count = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM $nominations_table WHERE period_id = %d AND is_winner = 1",
                $row['id']
            ));
            $row['winner_count'] = (int) $winner_count;
            
            // Fetch categories for this period
            $categories = $wpdb->get_results( $wpdb->prepare(
                "SELECT * FROM $categories_table WHERE period_id = %d ORDER BY sort_order ASC, name ASC",
                $row['id']
            ), ARRAY_A );
            $row['categories'] = $categories ? $categories : array();
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Get all permissions for admin
 */
function aquaticpro_aa_get_all_permissions( $request ) {
    if ( ! class_exists( 'Awesome_Awards' ) ) {
        return rest_ensure_response( array() );
    }
    $permissions = Awesome_Awards::get_all_role_permissions();
    return rest_ensure_response( $permissions );
}

/**
 * Permission callback: Check if user can nominate
 */
function aquaticpro_aa_can_nominate() {
    if ( ! is_user_logged_in() || ! class_exists( 'Awesome_Awards' ) ) {
        return false;
    }
    return Awesome_Awards::user_can( 'can_nominate' );
}

/**
 * Permission callback: Check if user can vote
 */
function aquaticpro_aa_can_vote() {
    if ( ! is_user_logged_in() || ! class_exists( 'Awesome_Awards' ) ) {
        return false;
    }
    return Awesome_Awards::user_can( 'can_vote' );
}

/**
 * Create a new period
 */
function aquaticpro_aa_create_period( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'awesome_awards_periods';
    
    // Support both new window-based fields and legacy fields
    // New fields: nomination_start, nomination_end, voting_start, voting_end
    // Legacy fields: start_date, end_date, nomination_deadline
    $nomination_start = sanitize_text_field( $params['nomination_start'] ?? $params['start_date'] ?? '' );
    $nomination_end = sanitize_text_field( $params['nomination_end'] ?? $params['nomination_deadline'] ?? '' );
    $voting_start = sanitize_text_field( $params['voting_start'] ?? $nomination_end );
    $voting_end = sanitize_text_field( $params['voting_end'] ?? $params['end_date'] ?? '' );
    
    // Accept both nomination_task_roles (new) and nomination_reminder_roles (legacy)
    $nomination_roles = $params['nomination_task_roles'] ?? $params['nomination_reminder_roles'] ?? array();
    $voting_roles = $params['voting_task_roles'] ?? $params['voting_reminder_roles'] ?? array();
    
    $data = array(
        'name'           => sanitize_text_field( $params['name'] ?? '' ),
        'period_type'    => sanitize_text_field( $params['period_type'] ?? 'week' ),
        // Store in both legacy and new columns for backwards compatibility
        'start_date'     => $nomination_start,
        'end_date'       => $voting_end,
        'nomination_deadline' => !empty($nomination_end) ? $nomination_end : null,
        'voting_start'   => !empty($voting_start) ? $voting_start : null,
        'voting_end'     => !empty($voting_end) ? $voting_end : null,
        'status'         => 'draft',
        'created_by'     => get_current_user_id(),
        'taskdeck_enabled' => !empty($params['taskdeck_enabled']) ? 1 : 0,
        'nomination_reminder_roles' => !empty($nomination_roles) ? maybe_serialize($nomination_roles) : null,
        'voting_reminder_roles' => !empty($voting_roles) ? maybe_serialize($voting_roles) : null,
        'max_winners'    => isset($params['max_winners']) ? absint($params['max_winners']) : 1,
        'allow_pre_voting' => !empty($params['allow_pre_voting']) ? 1 : 0,
    );
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to create period: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $period_id = $wpdb->insert_id;
    
    // Create categories if provided
    if ( !empty($params['categories']) && is_array($params['categories']) ) {
        $categories_table = $wpdb->prefix . 'awesome_awards_categories';
        foreach ( $params['categories'] as $index => $category ) {
            if ( !empty($category['name']) ) {
                $wpdb->insert( $categories_table, array(
                    'period_id'         => $period_id,
                    'name'              => sanitize_text_field( $category['name'] ),
                    'description'       => sanitize_textarea_field( $category['description'] ?? '' ),
                    'prize_description' => wp_kses_post( $category['prize_description'] ?? '' ),
                    'sort_order'        => $index,
                ));
            }
        }
    }
    
    // Return the full period data with new field names
    $data['id'] = $period_id;
    $data['archived'] = false;
    $data['taskdeck_enabled'] = (bool) $data['taskdeck_enabled'];
    // Include both old and new field names for backwards compatibility
    $data['nomination_start'] = $nomination_start;
    $data['nomination_end'] = $nomination_end;
    $data['nomination_task_roles'] = $nomination_roles;
    $data['voting_task_roles'] = $voting_roles;
    $data['max_winners'] = isset($params['max_winners']) ? absint($params['max_winners']) : 1;
    $data['allow_pre_voting'] = !empty($params['allow_pre_voting']);
    return rest_ensure_response( $data );
}

/**
 * Update a period
 */
function aquaticpro_aa_update_period( $request ) {
    try {
        global $wpdb;
        
        $id = absint( $request['id'] );
        $params = $request->get_json_params();
        $table = $wpdb->prefix . 'awesome_awards_periods';
        
        $data = array();
    
    // Handle basic text fields (including new window fields)
    $text_fields = array( 'name', 'period_type', 'start_date', 'end_date', 'voting_start', 'voting_end', 'status' );
    foreach ( $text_fields as $field ) {
        if ( isset( $params[$field] ) ) {
            $data[$field] = sanitize_text_field( $params[$field] );
        }
    }
    
    // Handle new nomination window fields - map to legacy columns
    if ( isset( $params['nomination_start'] ) ) {
        $data['start_date'] = sanitize_text_field( $params['nomination_start'] );
    }
    if ( isset( $params['nomination_end'] ) ) {
        $data['nomination_deadline'] = sanitize_text_field( $params['nomination_end'] );
    }
    // Only handle legacy nomination_deadline param if nomination_end wasn't provided
    elseif ( array_key_exists( 'nomination_deadline', $params ) ) {
        $data['nomination_deadline'] = ! empty( $params['nomination_deadline'] ) 
            ? sanitize_text_field( $params['nomination_deadline'] ) 
            : null;
    }
    
    // Handle boolean fields
    if ( isset( $params['archived'] ) ) {
        $data['archived'] = $params['archived'] ? 1 : 0;
    }
    if ( isset( $params['taskdeck_enabled'] ) ) {
        $data['taskdeck_enabled'] = $params['taskdeck_enabled'] ? 1 : 0;
    }
    
    // Handle max_winners and allow_pre_voting
    if ( isset( $params['max_winners'] ) ) {
        $data['max_winners'] = absint( $params['max_winners'] );
        if ( $data['max_winners'] < 1 ) {
            $data['max_winners'] = 1;
        }
        if ( $data['max_winners'] > 10 ) {
            $data['max_winners'] = 10;
        }
    }
    if ( isset( $params['allow_pre_voting'] ) ) {
        $data['allow_pre_voting'] = $params['allow_pre_voting'] ? 1 : 0;
    }
    
    // Handle serialized array fields - accept both old and new field names
    $nomination_roles = $params['nomination_task_roles'] ?? $params['nomination_reminder_roles'] ?? null;
    $voting_roles = $params['voting_task_roles'] ?? $params['voting_reminder_roles'] ?? null;
    
    if ( $nomination_roles !== null ) {
        $data['nomination_reminder_roles'] = is_array( $nomination_roles ) 
            ? maybe_serialize( $nomination_roles ) 
            : null;
    }
    if ( $voting_roles !== null ) {
        $data['voting_reminder_roles'] = is_array( $voting_roles ) 
            ? maybe_serialize( $voting_roles ) 
            : null;
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to update period: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $period = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    
    if ( $period ) {
        $period['archived'] = (bool) intval( $period['archived'] );
        $period['taskdeck_enabled'] = (bool) intval( isset( $period['taskdeck_enabled'] ) ? $period['taskdeck_enabled'] : 0 );
        // Unserialize and include under both old and new field names
        $nom_roles = maybe_unserialize( $period['nomination_reminder_roles'] ?? '' );
        $vote_roles = maybe_unserialize( $period['voting_reminder_roles'] ?? '' );
        $period['nomination_reminder_roles'] = $nom_roles;
        $period['voting_reminder_roles'] = $vote_roles;
        $period['nomination_task_roles'] = $nom_roles; // New field name
        $period['voting_task_roles'] = $vote_roles; // New field name
        // Include new window field names (derived from legacy columns)
        $period['nomination_start'] = $period['start_date'];
        $period['nomination_end'] = $period['nomination_deadline'];
        // Include max_winners and allow_pre_voting
        $period['max_winners'] = isset( $period['max_winners'] ) ? (int) $period['max_winners'] : 1;
        $period['allow_pre_voting'] = (bool) intval( isset( $period['allow_pre_voting'] ) ? $period['allow_pre_voting'] : 0 );
    }
    
    return rest_ensure_response( $period );
    } catch ( Exception $e ) {
        return new WP_Error( 'exception', 'Exception: ' . $e->getMessage(), array( 'status' => 500 ) );
    } catch ( Error $e ) {
        return new WP_Error( 'fatal_error', 'Fatal Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine(), array( 'status' => 500 ) );
    }
}

/**
 * Toggle archive status for a period
 */
function aquaticpro_aa_toggle_archive( $request ) {
    global $wpdb;
    
    $id = absint( $request['id'] );
    $table = $wpdb->prefix . 'awesome_awards_periods';
    
    // Get current state first
    $current = $wpdb->get_row( $wpdb->prepare( "SELECT archived FROM $table WHERE id = %d", $id ), ARRAY_A );
    
    if ( ! $current ) {
        return new WP_Error( 'not_found', 'Period not found', array( 'status' => 404 ) );
    }
    
    // Toggle the archived value
    $new_archived = $current['archived'] ? 0 : 1;
    
    $result = $wpdb->update( $table, array( 'archived' => $new_archived ), array( 'id' => $id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to update archive status', array( 'status' => 500 ) );
    }
    
    $period = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    $period['archived'] = (bool) intval( $period['archived'] );
    $period['taskdeck_enabled'] = (bool) intval( isset( $period['taskdeck_enabled'] ) ? $period['taskdeck_enabled'] : 0 );
    return rest_ensure_response( $period );
}

/**
 * Update period status (workflow transitions)
 * Valid transitions:
 * - draft -> nominations_open
 * - nominations_open -> voting_open OR pending_approval
 * - voting_open -> pending_approval
 * - pending_approval -> winner_declared
 */
function aquaticpro_aa_update_period_status( $request ) {
    try {
        global $wpdb;
        
        $id = absint( $request['id'] );
        $params = $request->get_json_params();
        $new_status = sanitize_text_field( $params['status'] ?? '' );
        $table = $wpdb->prefix . 'awesome_awards_periods';
        
        // Valid statuses
        $valid_statuses = array( 'draft', 'nominations_open', 'voting_open', 'pending_approval', 'winner_declared', 'completed' );
        
        if ( ! in_array( $new_status, $valid_statuses, true ) ) {
            return new WP_Error( 'invalid_status', 'Invalid status: ' . $new_status, array( 'status' => 400 ) );
        }
        
        // Get current period
        $period = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
        
        if ( ! $period ) {
            return new WP_Error( 'not_found', 'Period not found', array( 'status' => 404 ) );
        }
        
        $old_status = $period['status'];
        
        // Update status
        $result = $wpdb->update( 
            $table, 
            array( 'status' => $new_status ), 
            array( 'id' => $id ) 
        );
        
        if ( $result === false ) {
            return new WP_Error( 'db_error', 'Failed to update status: ' . $wpdb->last_error, array( 'status' => 500 ) );
        }
        
        // ================================================
        // TASKDECK INTEGRATION: Create/complete cards
        // ================================================
        
        // When moving to nominations_open, create nomination TaskDeck card
        if ( $new_status === 'nominations_open' && $old_status === 'draft' ) {
            $card_result = aquaticpro_aa_create_taskdeck_card( $id, 'nomination', $period );
            if ( is_wp_error( $card_result ) ) {
                error_log( 'Failed to create nomination TaskDeck card: ' . $card_result->get_error_message() );
            }
        }
        
        // When moving to voting_open, complete nomination card and create voting card
        if ( $new_status === 'voting_open' && $old_status === 'nominations_open' ) {
            aquaticpro_aa_complete_taskdeck_card( $id, 'nomination' );
            $card_result = aquaticpro_aa_create_taskdeck_card( $id, 'voting', $period );
            if ( is_wp_error( $card_result ) ) {
                error_log( 'Failed to create voting TaskDeck card: ' . $card_result->get_error_message() );
            }
        }
        
        // When moving to pending_approval from voting, complete voting card
        if ( $new_status === 'pending_approval' && $old_status === 'voting_open' ) {
            aquaticpro_aa_complete_taskdeck_card( $id, 'voting' );
        }
        
        // When moving to pending_approval from nominations (no voting phase), complete nomination card
        if ( $new_status === 'pending_approval' && $old_status === 'nominations_open' ) {
            aquaticpro_aa_complete_taskdeck_card( $id, 'nomination' );
        }
        
        // Get updated period
        $updated = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
        $updated['archived'] = (bool) intval( $updated['archived'] );
        $updated['taskdeck_enabled'] = (bool) intval( isset( $updated['taskdeck_enabled'] ) ? $updated['taskdeck_enabled'] : 0 );
        
        return rest_ensure_response( $updated );
    } catch ( Exception $e ) {
        return new WP_Error( 'exception', 'Exception: ' . $e->getMessage(), array( 'status' => 500 ) );
    } catch ( Error $e ) {
        return new WP_Error( 'fatal_error', 'Fatal Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine(), array( 'status' => 500 ) );
    }
}

/**
 * Delete a period
 */
function aquaticpro_aa_delete_period( $request ) {
    global $wpdb;
    
    $id = absint( $request['id'] );
    $table = $wpdb->prefix . 'awesome_awards_periods';
    
    $result = $wpdb->delete( $table, array( 'id' => $id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to delete period', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'deleted' => true ) );
}

// ============================================
// CATEGORY MANAGEMENT CALLBACKS
// ============================================

/**
 * Get categories for a period
 */
function aquaticpro_aa_get_categories( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['period_id'] );
    $table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM $table WHERE period_id = %d ORDER BY sort_order ASC, name ASC",
        $period_id
    ), ARRAY_A );
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Create a category for a period
 */
function aquaticpro_aa_create_category( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['period_id'] );
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'awesome_awards_categories';
    
    $data = array(
        'period_id'         => $period_id,
        'name'              => sanitize_text_field( $params['name'] ?? '' ),
        'description'       => sanitize_textarea_field( $params['description'] ?? '' ),
        'prize_description' => wp_kses_post( $params['prize_description'] ?? '' ),
        'sort_order'        => absint( $params['sort_order'] ?? 0 ),
    );
    
    if ( empty( $data['name'] ) ) {
        return new WP_Error( 'missing_name', 'Category name is required', array( 'status' => 400 ) );
    }
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to create category', array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    return rest_ensure_response( $data );
}

/**
 * Update a category
 */
function aquaticpro_aa_update_category( $request ) {
    global $wpdb;
    
    $id = absint( $request['id'] );
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'awesome_awards_categories';
    
    $data = array();
    
    if ( isset( $params['name'] ) ) {
        $data['name'] = sanitize_text_field( $params['name'] );
    }
    if ( isset( $params['description'] ) ) {
        $data['description'] = sanitize_textarea_field( $params['description'] );
    }
    if ( isset( $params['prize_description'] ) ) {
        $data['prize_description'] = wp_kses_post( $params['prize_description'] );
    }
    if ( isset( $params['sort_order'] ) ) {
        $data['sort_order'] = absint( $params['sort_order'] );
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to update category', array( 'status' => 500 ) );
    }
    
    $updated = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    return rest_ensure_response( $updated );
}

/**
 * Delete a category
 */
function aquaticpro_aa_delete_category( $request ) {
    global $wpdb;
    
    $id = absint( $request['id'] );
    $table = $wpdb->prefix . 'awesome_awards_categories';
    
    $result = $wpdb->delete( $table, array( 'id' => $id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to delete category', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'deleted' => true ) );
}

// ============================================
// NOMINATION APPROVAL CALLBACKS
// ============================================

/**
 * Approve or reject a nomination
 * Accepts either: { action: 'approve' | 'reject' } or { approved: true | false }
 */
function aquaticpro_aa_approve_nomination( $request ) {
    global $wpdb;
    
    $nomination_id = absint( $request['nomination_id'] );
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'awesome_awards_nominations';
    
    // Support both action format and approved boolean format
    $approved = null;
    if ( isset( $params['action'] ) ) {
        $approved = $params['action'] === 'approve';
    } elseif ( isset( $params['approved'] ) ) {
        $approved = (bool) $params['approved'];
    }
    
    $rejection_reason = sanitize_textarea_field( $params['rejection_reason'] ?? '' );
    
    if ( $approved === null ) {
        return new WP_Error( 'missing_action', 'action field (approve/reject) is required', array( 'status' => 400 ) );
    }
    
    $data = array(
        'status' => $approved ? 'approved' : 'rejected',
    );
    
    if ( ! $approved && ! empty( $rejection_reason ) ) {
        $data['rejection_reason'] = $rejection_reason;
    }
    
    $result = $wpdb->update( $table, $data, array( 'id' => $nomination_id ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to update nomination', array( 'status' => 500 ) );
    }
    
    // Get updated nomination with user data
    $nomination = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $nomination_id ), ARRAY_A );
    
    if ( $nomination ) {
        aquaticpro_aa_enrich_nomination( $nomination, get_current_user_id() );
    }
    
    return rest_ensure_response( $nomination );
}

/**
 * Permission callback: Check if user can approve nominations
 * WordPress admins with manage_options capability always have access
 */
function aquaticpro_aa_can_approve() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins always have access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    if ( ! class_exists( 'Awesome_Awards' ) ) {
        return false;
    }
    
    return Awesome_Awards::user_can( 'can_approve' );
}

/**
 * Get all nominations with optional filtering
 */
function aquaticpro_aa_get_all_nominations( $request ) {
    global $wpdb;
    
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    // Build query with filters
    $where = array( '1=1' );
    $params = array();
    
    // Filter by period_id
    $period_id = $request->get_param( 'period_id' );
    if ( $period_id ) {
        $where[] = 'n.period_id = %d';
        $params[] = absint( $period_id );
    }
    
    // Filter by status
    $status = $request->get_param( 'status' );
    if ( $status ) {
        $where[] = 'n.status = %s';
        $params[] = sanitize_text_field( $status );
    }
    
    $where_clause = implode( ' AND ', $where );
    $query = "SELECT n.*, p.name as period_name, p.status as period_status,
              COALESCE(c.name, p.name) as category_name
              FROM $nominations_table n
              JOIN $periods_table p ON n.period_id = p.id
              LEFT JOIN $categories_table c ON n.category_id = c.id
              WHERE $where_clause 
              ORDER BY n.created_at DESC";
    
    if ( ! empty( $params ) ) {
        $results = $wpdb->get_results( $wpdb->prepare( $query, $params ), ARRAY_A );
    } else {
        $results = $wpdb->get_results( $query, ARRAY_A );
    }
    
    // Enrich with user data using helper function
    if ( $results ) {
        $current_user_id = get_current_user_id();
        foreach ( $results as &$nom ) {
            aquaticpro_aa_enrich_nomination( $nom, $current_user_id );
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Get nominations for a period
 */
function aquaticpro_aa_get_nominations( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['period_id'] );
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    // Join with periods table to get period status, and categories for name
    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT n.*, p.name as period_name, p.status as period_status,
         COALESCE(c.name, p.name) as category_name
         FROM $nominations_table n
         JOIN $periods_table p ON n.period_id = p.id
         LEFT JOIN $categories_table c ON n.category_id = c.id
         WHERE n.period_id = %d 
         ORDER BY n.created_at DESC",
        $period_id
    ), ARRAY_A );
    
    // Enrich with user data using helper function
    if ( $results ) {
        $current_user_id = get_current_user_id();
        foreach ( $results as &$nom ) {
            aquaticpro_aa_enrich_nomination( $nom, $current_user_id );
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Create a nomination
 */
function aquaticpro_aa_create_nomination( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['period_id'] );
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'awesome_awards_nominations';
    
    $data = array(
        'period_id'            => $period_id,
        'category_id'          => absint( $params['category_id'] ?? 0 ),
        'nominee_id'           => absint( $params['nominee_id'] ),
        'nominator_id'         => get_current_user_id(),
        'reason'               => sanitize_textarea_field( $params['reason'] ?? $params['reason_text'] ?? '' ),
        'reason_text'          => sanitize_textarea_field( $params['reason_text'] ?? $params['reason'] ?? '' ),
        'reason_json'          => !empty($params['reason_json']) ? wp_kses_post( $params['reason_json'] ) : null,
        'category'             => sanitize_text_field( $params['category'] ?? '' ),
        'is_anonymous'         => !empty($params['is_anonymous']) ? 1 : 0,
        'is_direct_assignment' => !empty($params['is_direct_assignment']) ? 1 : 0,
        'status'               => 'pending',
    );
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to create nomination: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $nomination_id = $wpdb->insert_id;
    
    // Get the full nomination with user data
    $nomination = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $nomination_id ), ARRAY_A );
    
    if ( $nomination ) {
        aquaticpro_aa_enrich_nomination( $nomination, get_current_user_id() );
    }
    
    return rest_ensure_response( $nomination );
}

/**
 * Permission callback: Check if user is admin
 */
function aquaticpro_aa_is_admin() {
    return current_user_can( 'manage_options' );
}

/**
 * Vote for a nomination
 */
function aquaticpro_aa_vote( $request ) {
    global $wpdb;
    
    $nomination_id = absint( $request['nomination_id'] );
    $user_id = get_current_user_id();
    $table = $wpdb->prefix . 'awesome_awards_votes';
    
    // Check if already voted
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table WHERE nomination_id = %d AND voter_id = %d",
        $nomination_id,
        $user_id
    ) );
    
    if ( $existing ) {
        return new WP_Error( 'already_voted', 'You have already voted for this nomination', array( 'status' => 400 ) );
    }
    
    $result = $wpdb->insert( $table, array(
        'nomination_id' => $nomination_id,
        'voter_id'      => $user_id,
    ) );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to record vote', array( 'status' => 500 ) );
    }
    
    // Update vote count
    if ( class_exists( 'Awesome_Awards' ) ) {
        Awesome_Awards::update_vote_count( $nomination_id );
    }
    
    // Return updated nomination
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $nomination = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $nominations_table WHERE id = %d", $nomination_id ), ARRAY_A );
    
    if ( $nomination ) {
        aquaticpro_aa_enrich_nomination( $nomination, $user_id );
    }
    
    return rest_ensure_response( $nomination );
}

/**
 * Remove vote from a nomination
 */
function aquaticpro_aa_remove_vote( $request ) {
    global $wpdb;
    
    $nomination_id = absint( $request['nomination_id'] );
    $user_id = get_current_user_id();
    $table = $wpdb->prefix . 'awesome_awards_votes';
    
    $result = $wpdb->delete( $table, array(
        'nomination_id' => $nomination_id,
        'voter_id'      => $user_id,
    ) );
    
    // Update vote count
    if ( class_exists( 'Awesome_Awards' ) ) {
        Awesome_Awards::update_vote_count( $nomination_id );
    }
    
    // Return updated nomination
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $nomination = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $nominations_table WHERE id = %d", $nomination_id ), ARRAY_A );
    
    if ( $nomination ) {
        aquaticpro_aa_enrich_nomination( $nomination, $user_id );
    }
    
    return rest_ensure_response( $nomination );
}

/**
 * Get active periods (open for nominations or voting)
 * Periods must have status 'nominations_open', 'voting_open', or 'pending_approval' and not be archived
 */
function aquaticpro_aa_get_active_periods( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    $today = current_time( 'Y-m-d' );
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    // Active periods: status is nominations_open, voting_open, or pending_approval (awaiting winner selection), not archived
    $results = $wpdb->get_results(
        "SELECT * FROM $table 
         WHERE archived = 0 
         AND status IN ('nominations_open', 'voting_open', 'pending_approval')
         ORDER BY start_date DESC",
        ARRAY_A
    );
    
    // Cast boolean fields and add categories
    if ( $results ) {
        foreach ( $results as &$row ) {
            $row['archived'] = (bool) intval( $row['archived'] );
            $row['taskdeck_enabled'] = (bool) intval( isset( $row['taskdeck_enabled'] ) ? $row['taskdeck_enabled'] : 0 );
            
            // Unserialize and include under both old and new field names
            $nom_roles = maybe_unserialize( $row['nomination_reminder_roles'] ?? '' );
            $vote_roles = maybe_unserialize( $row['voting_reminder_roles'] ?? '' );
            $row['nomination_reminder_roles'] = $nom_roles ?: array();
            $row['voting_reminder_roles'] = $vote_roles ?: array();
            $row['nomination_task_roles'] = $nom_roles ?: array(); // New field name
            $row['voting_task_roles'] = $vote_roles ?: array(); // New field name
            
            // Include new window field names (derived from legacy columns)
            $row['nomination_start'] = $row['start_date'];
            $row['nomination_end'] = $row['nomination_deadline'];
            
            // Fetch categories for this period
            $categories = $wpdb->get_results( $wpdb->prepare(
                "SELECT * FROM $categories_table WHERE period_id = %d ORDER BY sort_order ASC, name ASC",
                $row['id']
            ), ARRAY_A );
            $row['categories'] = $categories ? $categories : array();
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Select a nomination as winner
 */
function aquaticpro_aa_select_winner( $request ) {
    global $wpdb;
    
    $nomination_id = absint( $request['nomination_id'] );
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    
    // Get nomination
    $nomination = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $nominations_table WHERE id = %d",
        $nomination_id
    ), ARRAY_A );
    
    if ( ! $nomination ) {
        return new WP_Error( 'not_found', 'Nomination not found', array( 'status' => 404 ) );
    }
    
    // Clear any existing winner for this period - reset both is_winner flag and status
    $wpdb->update(
        $nominations_table,
        array( 
            'is_winner' => 0,
            'status' => 'approved'
        ),
        array( 'period_id' => $nomination['period_id'] ),
        array( '%d', '%s' ),
        array( '%d' )
    );
    
    // Set this nomination as winner - set both is_winner flag and status
    $wpdb->update(
        $nominations_table,
        array( 
            'is_winner' => 1,
            'status' => 'winner'
        ),
        array( 'id' => $nomination_id ),
        array( '%d', '%s' ),
        array( '%d' )
    );
    
    // Update period status to winner_declared (matches frontend type)
    $wpdb->update(
        $periods_table,
        array( 'status' => 'winner_declared' ),
        array( 'id' => $nomination['period_id'] )
    );
    
    // Send notification email to winner
    $winner = get_user_by( 'id', $nomination['nominee_id'] );
    if ( $winner ) {
        $period = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM $periods_table WHERE id = %d",
            $nomination['period_id']
        ), ARRAY_A );
        
        $award_name = $nomination['category_id'] > 0 
            ? $wpdb->get_var( $wpdb->prepare(
                "SELECT name FROM {$wpdb->prefix}awesome_awards_categories WHERE id = %d",
                $nomination['category_id']
            ))
            : ( $period ? $period['name'] : 'Awesome Award' );
        
        $subject = '🏆 Congratulations! You won an Awesome Award!';
        $message = "Congratulations {$winner->display_name}!\n\n";
        $message .= "You have been selected as the winner of: {$award_name}\n\n";
        
        if ( ! empty( $nomination['reason'] ) ) {
            $message .= "Nomination:\n\"{$nomination['reason']}\"\n\n";
        }
        
        $message .= "Your outstanding work and dedication have been recognized by your peers. ";
        $message .= "Thank you for your continued excellence!\n\n";
        $message .= "View all winners: " . home_url( '/awards' ) . "\n";
        
        wp_mail( $winner->user_email, $subject, $message );
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * Get all winners
 */
function aquaticpro_aa_get_winners( $request ) {
    global $wpdb;
    
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $categories_table = $wpdb->prefix . 'awesome_awards_categories';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    $results = $wpdb->get_results(
        "SELECT n.*, p.name as period_name, p.period_type, p.start_date, p.end_date,
         COALESCE(c.name, p.name) as category_name
         FROM $nominations_table n
         JOIN $periods_table p ON n.period_id = p.id
         LEFT JOIN $categories_table c ON n.category_id = c.id
         WHERE n.is_winner = 1 OR n.status = 'winner'
         ORDER BY p.end_date DESC",
        ARRAY_A
    );
    
    // Enrich with user data
    if ( $results ) {
        $current_user_id = get_current_user_id();
        foreach ( $results as &$winner ) {
            aquaticpro_aa_enrich_nomination( $winner, $current_user_id );
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Get current/recent winner for banner display
 */
function aquaticpro_aa_get_current_winner( $request ) {
    global $wpdb;
    
    $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $nominations_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( null );
    }
    
    // Get most recent winner
    $winner = $wpdb->get_row(
        "SELECT n.*, p.name as period_name, p.period_type, p.start_date, p.end_date
         FROM $nominations_table n
         JOIN $periods_table p ON n.period_id = p.id
         WHERE n.is_winner = 1
         ORDER BY p.end_date DESC
         LIMIT 1",
        ARRAY_A
    );
    
    if ( ! $winner ) {
        return rest_ensure_response( null );
    }
    
    aquaticpro_aa_enrich_nomination( $winner, get_current_user_id() );
    
    return rest_ensure_response( $winner );
}

/**
 * Search users for nomination dropdown
 */
function aquaticpro_aa_search_users( $request ) {
    $search = sanitize_text_field( $request->get_param( 'search' ) );
    
    $args = array(
        'number'  => 20,
        'orderby' => 'display_name',
        'order'   => 'ASC',
    );
    
    if ( ! empty( $search ) ) {
        $args['search'] = '*' . $search . '*';
        $args['search_columns'] = array( 'display_name', 'user_login', 'user_email' );
    }
    
    $users = get_users( $args );
    $result = array();
    
    foreach ( $users as $user ) {
        $result[] = array(
            'id'           => $user->ID,
            'display_name' => $user->display_name,
            'avatar_url'   => get_avatar_url( $user->ID ),
        );
    }
    
    return rest_ensure_response( $result );
}

/**
 * Get simple user list for nominations (excludes current user)
 * Sorted by last name, then first name
 * Cached for 15 minutes for performance
 */
function aquaticpro_aa_get_simple_users( $request ) {
    $current_user_id = get_current_user_id();
    
    // Check cache first (15 minute TTL)
    // Cache key includes current user ID since we exclude them from results
    $cache_key = 'aa_simple_users_' . $current_user_id;
    $force_refresh = $request->get_param('refresh') === 'true';
    
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            $response = rest_ensure_response( $cached );
            $response->header( 'X-Cache-Status', 'HIT' );
            // Add HTTP cache headers (15 min browser cache, user-specific)
            if ( function_exists( 'mp_add_cache_headers' ) ) {
                $response = mp_add_cache_headers( $response, 900, 120, true );
            }
            return $response;
        }
    }
    
    // Get all users - we'll sort manually by last/first name
    $args = array(
        'exclude' => array( $current_user_id ), // Can't nominate yourself
        'number'  => 500, // Reasonable limit
    );
    
    $users = get_users( $args );
    $result = array();
    
    foreach ( $users as $user ) {
        // Check platform access if function exists - but don't skip if function doesn't exist
        if ( function_exists( 'mentorship_platform_user_has_access' ) ) {
            if ( ! mentorship_platform_user_has_access( $user->ID ) ) {
                continue;
            }
        }
        
        // Get first and last name for sorting
        $first_name = get_user_meta( $user->ID, 'first_name', true );
        $last_name = get_user_meta( $user->ID, 'last_name', true );
        
        $result[] = array(
            'id'           => $user->ID,
            'display_name' => $user->display_name,
            'first_name'   => $first_name,
            'last_name'    => $last_name,
            'avatar_url'   => get_avatar_url( $user->ID ),
        );
    }
    
    // Sort by last name, then first name
    usort( $result, function( $a, $b ) {
        // Compare last names first (case-insensitive)
        $last_cmp = strcasecmp( $a['last_name'], $b['last_name'] );
        if ( $last_cmp !== 0 ) {
            return $last_cmp;
        }
        // If last names are equal, compare first names
        return strcasecmp( $a['first_name'], $b['first_name'] );
    });
    
    // Cache for 15 minutes
    set_transient( $cache_key, $result, 15 * MINUTE_IN_SECONDS );
    
    $response = rest_ensure_response( $result );
    $response->header( 'X-Cache-Status', 'MISS' );
    // Add HTTP cache headers (15 min browser cache, user-specific)
    if ( function_exists( 'mp_add_cache_headers' ) ) {
        $response = mp_add_cache_headers( $response, 900, 120, true );
    }
    return $response;
}

/**
 * Update role permissions
 */
function aquaticpro_aa_update_permissions( $request ) {
    if ( ! class_exists( 'Awesome_Awards' ) ) {
        return new WP_Error( 'module_disabled', 'Awesome Awards module is not available', array( 'status' => 500 ) );
    }
    
    $params = $request->get_json_params();
    
    if ( ! isset( $params['role_id'] ) || ! isset( $params['permissions'] ) ) {
        return new WP_Error( 'invalid_params', 'Missing role_id or permissions', array( 'status' => 400 ) );
    }
    
    $result = Awesome_Awards::update_role_permissions( $params['role_id'], $params['permissions'] );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}

// ============================================
// TASKDECK INTEGRATION (Phase 5)
// ============================================

/**
 * Get TaskDeck tasklists for dropdown
 */
function aquaticpro_aa_get_tasklists( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'taskdeck_tasklists';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    $results = $wpdb->get_results(
        "SELECT id, name FROM $table ORDER BY name ASC",
        ARRAY_A
    );
    
    return rest_ensure_response( $results ? $results : array() );
}

/**
 * Link a period to a TaskDeck tasklist
 */
function aquaticpro_aa_link_tasklist( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['id'] );
    $params = $request->get_json_params();
    $tasklist_id = isset( $params['tasklist_id'] ) ? absint( $params['tasklist_id'] ) : null;
    
    $table = $wpdb->prefix . 'awesome_awards_periods';
    
    $result = $wpdb->update(
        $table,
        array( 'tasklist_id' => $tasklist_id ),
        array( 'id' => $period_id )
    );
    
    if ( $result === false ) {
        return new WP_Error( 'db_error', 'Failed to link tasklist', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * Get tasks from linked TaskDeck tasklist
 */
function aquaticpro_aa_get_period_tasks( $request ) {
    global $wpdb;
    
    $period_id = absint( $request['id'] );
    
    // Get period with tasklist_id
    $periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $period = $wpdb->get_row( $wpdb->prepare(
        "SELECT tasklist_id FROM $periods_table WHERE id = %d",
        $period_id
    ), ARRAY_A );
    
    if ( ! $period || empty( $period['tasklist_id'] ) ) {
        return rest_ensure_response( array() );
    }
    
    // Get tasks from TaskDeck
    $tasks_table = $wpdb->prefix . 'taskdeck_tasks';
    $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $tasks_table ) );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }
    
    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, title, description, status, priority, due_date, assigned_to 
         FROM $tasks_table 
         WHERE tasklist_id = %d 
         ORDER BY priority DESC, due_date ASC",
        $period['tasklist_id']
    ), ARRAY_A );
    
    // Enrich with assignee names
    if ( $results ) {
        foreach ( $results as &$task ) {
            if ( ! empty( $task['assigned_to'] ) ) {
                $user = get_userdata( $task['assigned_to'] );
                $task['assignee_name'] = $user ? $user->display_name : 'Unknown';
            }
        }
    }
    
    return rest_ensure_response( $results ? $results : array() );
}

// ============================================
// TASKDECK INTEGRATION HELPERS
// ============================================

/**
 * Create a TaskDeck card for an award period
 * 
 * @param int $period_id The award period ID
 * @param string $card_type Either 'nomination' or 'voting'
 * @param array $period The period data (name, dates, roles, etc.)
 * @return int|WP_Error The card ID or error
 */
function aquaticpro_aa_create_taskdeck_card( $period_id, $card_type, $period ) {
    global $wpdb;
    
    error_log( "AA TaskDeck: Attempting to create {$card_type} card for period {$period_id}" );
    
    // Check if TaskDeck is enabled
    $taskdeck_enabled = get_option( 'aquaticpro_enable_taskdeck', false );
    if ( ! $taskdeck_enabled ) {
        error_log( "AA TaskDeck: TaskDeck module is NOT enabled globally (aquaticpro_enable_taskdeck = false)" );
        return new WP_Error( 'taskdeck_disabled', 'TaskDeck module is not enabled' );
    }
    
    // Check if this period has TaskDeck integration enabled
    if ( empty( $period['taskdeck_enabled'] ) ) {
        error_log( "AA TaskDeck: Period {$period_id} does NOT have taskdeck_enabled set" );
        return new WP_Error( 'period_taskdeck_disabled', 'TaskDeck integration is not enabled for this period' );
    }
    
    error_log( "AA TaskDeck: All checks passed, creating card..." );
    
    // Get the primary deck
    $table_decks = $wpdb->prefix . 'aqp_taskdecks';
    $primary_deck = $wpdb->get_row(
        "SELECT * FROM {$table_decks} WHERE is_primary = 1 AND is_archived = 0 LIMIT 1"
    );
    
    if ( ! $primary_deck ) {
        return new WP_Error( 'no_primary_deck', 'No primary TaskDeck configured' );
    }
    
    // Find or create an "Awards" list in the primary deck
    $table_lists = $wpdb->prefix . 'aqp_tasklists';
    $awards_list = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM {$table_lists} WHERE deck_id = %d AND list_name = %s LIMIT 1",
        $primary_deck->deck_id,
        'Awards'
    ) );
    
    if ( ! $awards_list ) {
        // Create the Awards list
        $max_order = $wpdb->get_var( $wpdb->prepare(
            "SELECT MAX(sort_order) FROM {$table_lists} WHERE deck_id = %d",
            $primary_deck->deck_id
        ) );
        
        $wpdb->insert(
            $table_lists,
            array(
                'deck_id' => $primary_deck->deck_id,
                'list_name' => 'Awards',
                'sort_order' => ( $max_order ?? -1 ) + 1,
                'created_at' => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%d', '%s' )
        );
        
        $list_id = $wpdb->insert_id;
    } else {
        $list_id = $awards_list->list_id;
    }
    
    // Determine card title and due date based on type
    $period_name = $period['name'] ?? 'Award Period';
    $due_date = null;
    $assigned_roles = array();
    
    if ( $card_type === 'nomination' ) {
        $title = "🏆 Submit Nominations: {$period_name}";
        $description = "Nominate your colleagues for the {$period_name} Awesome Awards!\n\nClick this card to open the nomination form.";
        $due_date = $period['nomination_deadline'] ?? $period['end_date'] ?? null;
        $assigned_roles = maybe_unserialize( $period['nomination_reminder_roles'] ?? '' );
    } else {
        $title = "🗳️ Vote for Awards: {$period_name}";
        $description = "Cast your votes for the {$period_name} Awesome Awards!\n\nClick this card to view nominees and vote.";
        $due_date = $period['voting_end'] ?? $period['end_date'] ?? null;
        $assigned_roles = maybe_unserialize( $period['voting_reminder_roles'] ?? '' );
    }
    
    // Create the card with action URL
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $max_card_order = $wpdb->get_var( $wpdb->prepare(
        "SELECT MAX(sort_order) FROM {$table_cards} WHERE list_id = %d",
        $list_id
    ) );
    
    // Generate action URL that opens the awards page
    $action_url = admin_url( 'admin.php?page=aquaticpro-awards' );
    
    $inserted = $wpdb->insert(
        $table_cards,
        array(
            'list_id' => $list_id,
            'title' => $title,
            'description' => $description,
            'created_by' => get_current_user_id(),
            'due_date' => $due_date,
            'action_url' => $action_url,
            'accent_color' => $card_type === 'nomination' ? '#f59e0b' : '#8b5cf6', // Orange for nominations, purple for voting
            'sort_order' => ( $max_card_order ?? -1 ) + 1,
            'created_at' => current_time( 'mysql' ),
        ),
        array( '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%s' )
    );
    
    if ( ! $inserted ) {
        return new WP_Error( 'card_creation_failed', 'Failed to create TaskDeck card: ' . $wpdb->last_error );
    }
    
    $card_id = $wpdb->insert_id;
    error_log( "AA TaskDeck: Created card ID {$card_id} for period {$period_id}, type: {$card_type}" );
    
    // Assign the card to the configured roles
    // If no roles are specified, assign to ALL active job roles so everyone can see it
    $table_card_roles = $wpdb->prefix . 'aqp_card_assigned_roles';
    
    if ( ! empty( $assigned_roles ) && is_array( $assigned_roles ) ) {
        // Assign to specific roles
        foreach ( $assigned_roles as $role_id ) {
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
        error_log( "AA TaskDeck: Assigned card {$card_id} to " . count( $assigned_roles ) . " specific roles" );
    } else {
        // No specific roles - assign to ALL active job roles so everyone can see the card
        $table_roles = $wpdb->prefix . 'pg_job_roles';
        $all_roles = $wpdb->get_col( "SELECT id FROM {$table_roles} WHERE is_active = 1" );
        
        if ( ! empty( $all_roles ) ) {
            foreach ( $all_roles as $role_id ) {
                $wpdb->insert(
                    $table_card_roles,
                    array(
                        'card_id' => $card_id,
                        'role_id' => (int) $role_id,
                    ),
                    array( '%d', '%d' )
                );
            }
            error_log( "AA TaskDeck: No roles specified, assigned card {$card_id} to ALL " . count( $all_roles ) . " active roles" );
            $assigned_roles = $all_roles; // Update for tracking table
        } else {
            error_log( "AA TaskDeck: Warning - no active job roles found, card {$card_id} may not be visible to anyone" );
        }
    }
    
    // Track the card in our linking table
    $tracking_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    $wpdb->replace(
        $tracking_table,
        array(
            'period_id' => $period_id,
            'card_type' => $card_type,
            'card_id' => $card_id,
            'assigned_roles' => is_array( $assigned_roles ) ? maybe_serialize( $assigned_roles ) : null,
            'is_completed' => 0,
            'created_at' => current_time( 'mysql' ),
        ),
        array( '%d', '%s', '%d', '%s', '%d', '%s' )
    );
    
    return $card_id;
}

/**
 * Mark a TaskDeck card as complete when a period phase ends
 * 
 * @param int $period_id The award period ID
 * @param string $card_type Either 'nomination' or 'voting'
 */
function aquaticpro_aa_complete_taskdeck_card( $period_id, $card_type ) {
    global $wpdb;
    
    $tracking_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    
    // Get the card record
    $record = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM {$tracking_table} WHERE period_id = %d AND card_type = %s",
        $period_id,
        $card_type
    ) );
    
    if ( ! $record ) {
        return;
    }
    
    // Mark our tracking record as complete
    $wpdb->update(
        $tracking_table,
        array( 
            'is_completed' => 1,
            'completed_at' => current_time( 'mysql' )
        ),
        array( 'id' => $record->id ),
        array( '%d', '%s' ),
        array( '%d' )
    );
    
    // Mark the actual TaskDeck card as complete
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $wpdb->update(
        $table_cards,
        array( 
            'is_complete' => 1,
            'completed_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' )
        ),
        array( 'card_id' => $record->card_id ),
        array( '%d', '%s', '%s' ),
        array( '%d' )
    );
}

/**
 * Auto-complete expired Awesome Awards TaskDeck cards
 * 
 * This runs on init to clean up cards whose deadlines have passed.
 * Also syncs tracking table when users manually complete TaskDeck cards.
 */
function aquaticpro_aa_cleanup_expired_taskdeck_cards() {
    global $wpdb;
    
    // Only run once per hour using a transient (more frequent for better sync)
    if ( get_transient( 'aa_taskdeck_cleanup_ran' ) ) {
        return;
    }
    
    $tracking_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    $table_cards = $wpdb->prefix . 'aqp_taskcards';
    $table_periods = $wpdb->prefix . 'awesome_awards_periods';
    
    // Check if tables exist
    if ( $wpdb->get_var( "SHOW TABLES LIKE '{$tracking_table}'" ) !== $tracking_table ) {
        return;
    }
    
    $completed_count = 0;
    
    // ==========================================================
    // CASE 1: Sync tracking table when TaskDeck card is already complete
    // This handles cases where users manually marked the card complete
    // ==========================================================
    $manually_completed = $wpdb->get_results(
        "SELECT t.id, t.card_id, t.period_id, t.card_type, c.title
         FROM {$tracking_table} t
         INNER JOIN {$table_cards} c ON t.card_id = c.card_id
         WHERE t.is_completed = 0
         AND c.is_complete = 1"
    );
    
    foreach ( $manually_completed as $card ) {
        $wpdb->update(
            $tracking_table,
            array( 
                'is_completed' => 1,
                'completed_at' => current_time( 'mysql' )
            ),
            array( 'id' => $card->id ),
            array( '%d', '%s' ),
            array( '%d' )
        );
        $completed_count++;
        error_log( "AA Cleanup: Synced manually-completed card '{$card->title}' (ID: {$card->card_id})" );
    }
    
    // ==========================================================
    // CASE 2: Auto-complete cards where the period phase has ended
    // This checks the period dates directly, not just the card due date
    // ==========================================================
    $today = current_time( 'Y-m-d' );
    
    // Get nomination cards where nomination period has ended
    $expired_nomination_cards = $wpdb->get_results( $wpdb->prepare(
        "SELECT t.id, t.card_id, t.period_id, c.title, p.nominations_end
         FROM {$tracking_table} t
         INNER JOIN {$table_cards} c ON t.card_id = c.card_id
         INNER JOIN {$table_periods} p ON t.period_id = p.id
         WHERE t.is_completed = 0
         AND t.card_type = 'nomination'
         AND c.is_complete = 0
         AND p.nominations_end < %s",
        $today
    ) );
    
    foreach ( $expired_nomination_cards as $card ) {
        // Mark tracking as complete
        $wpdb->update(
            $tracking_table,
            array( 'is_completed' => 1, 'completed_at' => current_time( 'mysql' ) ),
            array( 'id' => $card->id ),
            array( '%d', '%s' ),
            array( '%d' )
        );
        // Mark TaskDeck card as complete
        $wpdb->update(
            $table_cards,
            array( 'is_complete' => 1, 'completed_at' => current_time( 'mysql' ), 'updated_at' => current_time( 'mysql' ) ),
            array( 'card_id' => $card->card_id ),
            array( '%d', '%s', '%s' ),
            array( '%d' )
        );
        $completed_count++;
        error_log( "AA Cleanup: Auto-completed expired nomination card '{$card->title}' (period ended: {$card->nominations_end})" );
    }
    
    // Get voting cards where voting period has ended
    $expired_voting_cards = $wpdb->get_results( $wpdb->prepare(
        "SELECT t.id, t.card_id, t.period_id, c.title, p.voting_end
         FROM {$tracking_table} t
         INNER JOIN {$table_cards} c ON t.card_id = c.card_id
         INNER JOIN {$table_periods} p ON t.period_id = p.id
         WHERE t.is_completed = 0
         AND t.card_type = 'voting'
         AND c.is_complete = 0
         AND p.voting_end IS NOT NULL
         AND p.voting_end < %s",
        $today
    ) );
    
    foreach ( $expired_voting_cards as $card ) {
        // Mark tracking as complete
        $wpdb->update(
            $tracking_table,
            array( 'is_completed' => 1, 'completed_at' => current_time( 'mysql' ) ),
            array( 'id' => $card->id ),
            array( '%d', '%s' ),
            array( '%d' )
        );
        // Mark TaskDeck card as complete
        $wpdb->update(
            $table_cards,
            array( 'is_complete' => 1, 'completed_at' => current_time( 'mysql' ), 'updated_at' => current_time( 'mysql' ) ),
            array( 'card_id' => $card->card_id ),
            array( '%d', '%s', '%s' ),
            array( '%d' )
        );
        $completed_count++;
        error_log( "AA Cleanup: Auto-completed expired voting card '{$card->title}' (period ended: {$card->voting_end})" );
    }
    
    // ==========================================================
    // CASE 3: Fallback - complete any card overdue by 1+ day
    // Catches any remaining edge cases based on due_date
    // ==========================================================
    $overdue_cards = $wpdb->get_results(
        "SELECT t.id, t.card_id, t.period_id, t.card_type, c.title, c.due_date
         FROM {$tracking_table} t
         INNER JOIN {$table_cards} c ON t.card_id = c.card_id
         WHERE t.is_completed = 0
         AND c.is_complete = 0
         AND c.due_date IS NOT NULL
         AND c.due_date < CURDATE()"
    );
    
    foreach ( $overdue_cards as $card ) {
        // Mark tracking as complete
        $wpdb->update(
            $tracking_table,
            array( 'is_completed' => 1, 'completed_at' => current_time( 'mysql' ) ),
            array( 'id' => $card->id ),
            array( '%d', '%s' ),
            array( '%d' )
        );
        // Mark TaskDeck card as complete
        $wpdb->update(
            $table_cards,
            array( 'is_complete' => 1, 'completed_at' => current_time( 'mysql' ), 'updated_at' => current_time( 'mysql' ) ),
            array( 'card_id' => $card->card_id ),
            array( '%d', '%s', '%s' ),
            array( '%d' )
        );
        $completed_count++;
        error_log( "AA Cleanup: Auto-completed overdue card '{$card->title}' (due: {$card->due_date})" );
    }
    
    if ( $completed_count > 0 ) {
        error_log( "AA Cleanup: Completed {$completed_count} TaskDeck cards total" );
    }
    
    // Run every hour instead of daily for better sync
    set_transient( 'aa_taskdeck_cleanup_ran', 1, HOUR_IN_SECONDS );
}
add_action( 'init', 'aquaticpro_aa_cleanup_expired_taskdeck_cards' );

/**
 * Admin endpoint to force cleanup of expired TaskDeck cards
 * Bypasses the transient check for immediate execution
 */
function aquaticpro_aa_force_cleanup( WP_REST_Request $request ) {
    global $wpdb;
    
    // Delete the transient to allow cleanup to run
    delete_transient( 'aa_taskdeck_cleanup_ran' );
    
    // Run the cleanup
    aquaticpro_aa_cleanup_expired_taskdeck_cards();
    
    // Get current stats
    $tracking_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    $cards_table = $wpdb->prefix . 'aqp_taskcards';
    
    $total_tracked = $wpdb->get_var( "SELECT COUNT(*) FROM {$tracking_table}" );
    $completed_tracked = $wpdb->get_var( "SELECT COUNT(*) FROM {$tracking_table} WHERE is_complete = 1" );
    $incomplete_tracked = $wpdb->get_var( "SELECT COUNT(*) FROM {$tracking_table} WHERE is_complete = 0" );
    
    // Check for any orphaned tracking records (TaskDeck card already deleted)
    $orphaned = $wpdb->get_var( "
        SELECT COUNT(*) FROM {$tracking_table} t
        LEFT JOIN {$cards_table} c ON t.card_id = c.id
        WHERE c.id IS NULL
    " );
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Cleanup executed successfully',
        'stats' => array(
            'total_tracked' => (int) $total_tracked,
            'completed' => (int) $completed_tracked,
            'incomplete' => (int) $incomplete_tracked,
            'orphaned' => (int) $orphaned,
        ),
    ) );
}