<?php
/**
 * New Hires API Routes
 * 
 * REST API endpoints for new hire management
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register new hire REST routes
 */
function aquaticpro_register_new_hire_routes() {
    $namespace = 'mentorship-platform/v1';
    
    // ============================================
    // PUBLIC ENDPOINTS (NO AUTH)
    // ============================================
    
    // Submit new hire application (public)
    register_rest_route( $namespace, '/new-hires/apply', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_new_hire_submit_application',
        'permission_callback' => '__return_true', // Public endpoint
    ) );
    
    // Get available positions (public)
    register_rest_route( $namespace, '/new-hires/positions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_positions',
        'permission_callback' => '__return_true',
    ) );
    
    // Get public organization info (public - for form header)
    register_rest_route( $namespace, '/new-hires/organization-info', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_organization_info',
        'permission_callback' => '__return_true',
    ) );
    
    // ============================================
    // ADMIN ENDPOINTS (REQUIRE AUTH)
    // ============================================
    
    // Get all applications
    register_rest_route( $namespace, '/new-hires', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_applications',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // Get single application
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_application',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Update application status (approve/reject)
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)/status', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_new_hire_update_status',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Delete application
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_new_hire_delete_application',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Get stats
    register_rest_route( $namespace, '/new-hires/stats', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_stats',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // ============================================
    // LETTER OF INTENT ENDPOINTS
    // ============================================
    
    // Get LOI settings
    register_rest_route( $namespace, '/new-hires/loi-settings', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_loi_settings',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // Update LOI settings
    register_rest_route( $namespace, '/new-hires/loi-settings', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_new_hire_update_loi_settings',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // Preview LOI for an application
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)/loi-preview', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_preview_loi',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Generate LOI PDF
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)/loi-pdf', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_generate_loi_pdf',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Send LOI email
    register_rest_route( $namespace, '/new-hires/(?P<id>\d+)/send-loi', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_new_hire_send_loi',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
        'args' => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );
    
    // Bulk archive/unarchive applications
    register_rest_route( $namespace, '/new-hires/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_new_hire_bulk_archive',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // ============================================
    // POSITION MANAGEMENT
    // ============================================
    
    // Get/update available positions
    register_rest_route( $namespace, '/new-hires/positions-config', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_positions_config',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    register_rest_route( $namespace, '/new-hires/positions-config', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_new_hire_update_positions_config',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // ============================================
    // NOTIFICATION SETTINGS HELPERS
    // ============================================
    
    // Get WordPress roles for notification picker
    register_rest_route( $namespace, '/new-hires/wp-roles', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_wp_roles',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
    
    // Get users for notification picker
    register_rest_route( $namespace, '/new-hires/notification-users', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_new_hire_get_notification_users',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );

    // Admin manual create new hire
    register_rest_route( $namespace, '/new-hires/admin-create', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_new_hire_admin_create',
        'permission_callback' => 'aquaticpro_new_hire_can_manage',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_new_hire_routes' );

/**
 * Permission callback - can manage new hires
 */
function aquaticpro_new_hire_can_manage() {
    return current_user_can( 'edit_users' ) || current_user_can( 'manage_options' );
}

// ============================================
// PUBLIC CALLBACKS
// ============================================

/**
 * Submit new hire application
 */
function aquaticpro_new_hire_submit_application( $request ) {
    $params = $request->get_json_params();
    
    // Simple honeypot check
    if ( ! empty( $params['website'] ) ) {
        // Bot detected (honeypot field should be empty)
        return new WP_Error( 'spam', 'Invalid submission', array( 'status' => 400 ) );
    }
    
    // Rate limiting check (simple implementation)
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $transient_key = 'new_hire_submit_' . md5( $ip );
    
    $recent_submissions = get_transient( $transient_key );
    if ( $recent_submissions && $recent_submissions >= 3 ) {
        return new WP_Error( 'rate_limit', 'Too many submissions. Please try again later.', array( 'status' => 429 ) );
    }
    
    $result = AquaticPro_New_Hires::submit_application( $params );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    // Update rate limit counter
    set_transient( $transient_key, ( $recent_submissions ?? 0 ) + 1, 300 ); // 5 minute window
    
    return rest_ensure_response( $result );
}

/**
 * Get available positions (public)
 */
function aquaticpro_new_hire_get_positions( $request ) {
    $positions = get_option( 'aquaticpro_new_hire_positions', array(
        'Lifeguard / Swim Instructor',
        'Cashier & Concessions'
    ) );
    
    return rest_ensure_response( array(
        'success' => true,
        'positions' => $positions
    ) );
}

/**
 * Get public organization info (for form header)
 * Only returns values explicitly set in LOI settings (no defaults/fallbacks)
 */
function aquaticpro_new_hire_get_organization_info( $request ) {
    return rest_ensure_response( array(
        'success' => true,
        'organization' => array(
            'name' => get_option( 'aquaticpro_loi_organization_name', '' ),
            'address' => get_option( 'aquaticpro_loi_organization_address', '' ),
            'phone' => get_option( 'aquaticpro_loi_organization_phone', '' ),
            'email' => get_option( 'aquaticpro_loi_organization_email', '' ),
            'header_image' => get_option( 'aquaticpro_loi_header_image', '' ),
            'sender_name' => get_option( 'aquaticpro_loi_sender_name', '' ),
            'sender_title' => get_option( 'aquaticpro_loi_sender_title', '' ),
        )
    ) );
}

// ============================================
// ADMIN CALLBACKS
// ============================================

/**
 * Get all applications
 */
function aquaticpro_new_hire_get_applications( $request ) {
    $filters = array(
        'status' => $request->get_param( 'status' ),
        'needs_work_permit' => $request->get_param( 'needs_work_permit' ),
        'position' => $request->get_param( 'position' ),
        'loi_sent' => $request->get_param( 'loi_sent' ),
        'search' => $request->get_param( 'search' ),
        'orderby' => $request->get_param( 'orderby' ),
        'order' => $request->get_param( 'order' )
    );
    
    $applications = AquaticPro_New_Hires::get_applications( $filters );
    
    return rest_ensure_response( array(
        'success' => true,
        'applications' => $applications
    ) );
}

/**
 * Get single application
 */
function aquaticpro_new_hire_get_application( $request ) {
    $id = $request->get_param( 'id' );
    
    $application = AquaticPro_New_Hires::get_application( $id );
    
    if ( ! $application ) {
        return new WP_Error( 'not_found', 'Application not found', array( 'status' => 404 ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'application' => $application
    ) );
}

/**
 * Update application status
 */
function aquaticpro_new_hire_update_status( $request ) {
    $id = $request->get_param( 'id' );
    $params = $request->get_json_params();
    
    $status = $params['status'] ?? null;
    $notes = $params['notes'] ?? null;
    $add_as_member = isset( $params['add_as_member'] ) ? (bool) $params['add_as_member'] : true; // Default to true for approved users
    
    if ( ! $status ) {
        return new WP_Error( 'missing_status', 'Status is required', array( 'status' => 400 ) );
    }
    
    $result = AquaticPro_New_Hires::update_status( $id, $status, $notes, $add_as_member );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    // Return updated application
    $application = AquaticPro_New_Hires::get_application( $id );
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => $result['message'],
        'application' => $application
    ) );
}

/**
 * Delete application
 */
function aquaticpro_new_hire_delete_application( $request ) {
    global $wpdb;
    
    $id = $request->get_param( 'id' );
    
    $table = $wpdb->prefix . 'aquaticpro_new_hires';
    
    $deleted = $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete application', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Application deleted'
    ) );
}

/**
 * Get stats
 */
function aquaticpro_new_hire_get_stats( $request ) {
    $stats = AquaticPro_New_Hires::get_stats();
    
    return rest_ensure_response( array(
        'success' => true,
        'stats' => $stats
    ) );
}

// ============================================
// LOI CALLBACKS
// ============================================

/**
 * Get LOI settings
 */
function aquaticpro_new_hire_get_loi_settings( $request ) {
    $settings = AquaticPro_New_Hires::get_loi_settings();
    
    return rest_ensure_response( array(
        'success' => true,
        'settings' => $settings
    ) );
}

/**
 * Update LOI settings
 */
function aquaticpro_new_hire_update_loi_settings( $request ) {
    $params = $request->get_json_params();
    
    $settings = AquaticPro_New_Hires::update_loi_settings( $params );
    
    return rest_ensure_response( array(
        'success' => true,
        'settings' => $settings
    ) );
}

/**
 * Preview LOI
 */
function aquaticpro_new_hire_preview_loi( $request ) {
    $id = $request->get_param( 'id' );
    
    // Use PDF generator to get HTML version for preview
    $pdf_data = AquaticPro_New_Hires::generate_loi_pdf( $id );
    
    if ( is_wp_error( $pdf_data ) ) {
        return $pdf_data;
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'html' => $pdf_data['html'],
        'content' => $pdf_data['html'], // Keep for backwards compatibility
        'application' => $pdf_data['application']
    ) );
}

/**
 * Generate LOI PDF
 */
function aquaticpro_new_hire_generate_loi_pdf( $request ) {
    $id = $request->get_param( 'id' );
    
    $pdf_data = AquaticPro_New_Hires::generate_loi_pdf( $id );
    
    if ( is_wp_error( $pdf_data ) ) {
        return $pdf_data;
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'html' => $pdf_data['html'],
        'filename' => $pdf_data['filename'],
        'application' => $pdf_data['application']
    ) );
}

/**
 * Send LOI email
 */
function aquaticpro_new_hire_send_loi( $request ) {
    $id = $request->get_param( 'id' );
    
    $result = AquaticPro_New_Hires::send_loi_email( $id );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    // Return updated application
    $application = AquaticPro_New_Hires::get_application( $id );
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => $result['message'],
        'application' => $application
    ) );
}

/**
 * Bulk archive/unarchive applications
 */
function aquaticpro_new_hire_bulk_archive( $request ) {
    $params = $request->get_json_params();
    
    $ids = isset( $params['ids'] ) ? array_map( 'intval', $params['ids'] ) : array();
    $archive = isset( $params['archive'] ) ? (bool) $params['archive'] : true;
    
    if ( empty( $ids ) ) {
        return new WP_Error( 'missing_ids', 'No application IDs provided', array( 'status' => 400 ) );
    }
    
    $result = AquaticPro_New_Hires::archive_applications( $ids, $archive );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    return rest_ensure_response( $result );
}

// ============================================
// POSITION CONFIG CALLBACKS
// ============================================

/**
 * Get positions config
 */
function aquaticpro_new_hire_get_positions_config( $request ) {
    $positions = get_option( 'aquaticpro_new_hire_positions', array(
        'Lifeguard / Swim Instructor',
        'Cashier & Concessions'
    ) );
    
    return rest_ensure_response( array(
        'success' => true,
        'positions' => $positions
    ) );
}

/**
 * Update positions config
 */
function aquaticpro_new_hire_update_positions_config( $request ) {
    $params = $request->get_json_params();
    
    $positions = $params['positions'] ?? array();
    
    // Sanitize
    $positions = array_map( 'sanitize_text_field', $positions );
    $positions = array_filter( $positions ); // Remove empty
    $positions = array_values( $positions ); // Re-index
    
    update_option( 'aquaticpro_new_hire_positions', $positions );
    
    return rest_ensure_response( array(
        'success' => true,
        'positions' => $positions
    ) );
}

// ============================================
// NOTIFICATION SETTINGS CALLBACKS
// ============================================

/**
 * Get plugin job roles for notification picker
 * Returns AquaticPro job roles (from pg_job_roles table) instead of WordPress roles
 */
function aquaticpro_new_hire_get_wp_roles( $request ) {
    global $wpdb;
    
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if the table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$roles_table'" );
    if ( ! $table_exists ) {
        error_log('[New Hires] pg_job_roles table does not exist');
        return rest_ensure_response( array( 
            'success' => true,
            'roles' => array() 
        ) );
    }
    
    // Get all job roles - pg_job_roles table doesn't have is_active column
    // Just order by tier and title
    $job_roles = $wpdb->get_results(
        "SELECT id, title, tier, description FROM $roles_table ORDER BY tier ASC, title ASC",
        ARRAY_A
    );
    
    if ( $wpdb->last_error ) {
        error_log('[New Hires] Error fetching job roles: ' . $wpdb->last_error);
    }
    
    $roles = array();
    foreach ( $job_roles as $role ) {
        $roles[] = array(
            'slug' => (string) $role['id'], // Use ID as slug for consistency with storage
            'name' => $role['title'],
            'tier' => isset( $role['tier'] ) ? (int) $role['tier'] : null,
            'description' => isset( $role['description'] ) ? $role['description'] : '',
        );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'roles' => $roles
    ) );
}

/**
 * Get users for notification picker
 */
function aquaticpro_new_hire_get_notification_users( $request ) {
    $users = get_users( array(
        'fields' => array( 'ID', 'display_name', 'user_email' ),
        'orderby' => 'display_name',
        'order' => 'ASC',
    ) );
    
    $formatted_users = array();
    foreach ( $users as $user ) {
        $first_name = get_user_meta( $user->ID, 'first_name', true );
        $last_name = get_user_meta( $user->ID, 'last_name', true );
        
        // Build display name
        if ( ! empty( $first_name ) || ! empty( $last_name ) ) {
            $display_name = trim( $first_name . ' ' . $last_name );
        } else {
            $display_name = $user->display_name;
        }
        
        $formatted_users[] = array(
            'id' => (int) $user->ID,
            'name' => $display_name,
            'email' => $user->user_email,
        );
    }
    
    // Sort by name
    usort( $formatted_users, function( $a, $b ) {
        return strcasecmp( $a['name'], $b['name'] );
    } );
    
    return rest_ensure_response( array(
        'success' => true,
        'users' => $formatted_users
    ) );
}

/**
 * Admin-created new hire (bypass honeypot & rate limiting)
 */
function aquaticpro_new_hire_admin_create( $request ) {
    $params = $request->get_json_params();

    $result = AquaticPro_New_Hires::submit_application( $params );

    if ( is_wp_error( $result ) ) {
        return $result;
    }

    return rest_ensure_response( $result );
}
