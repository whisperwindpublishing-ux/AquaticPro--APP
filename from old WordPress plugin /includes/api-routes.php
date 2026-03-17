<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Helper function to check if user has admin/management permissions
 * Works with or without Professional Growth module enabled
 */
if ( ! function_exists( 'mentorship_platform_check_admin_permission' ) ) {
    function mentorship_platform_check_admin_permission() {
        // Check if user is a Plugin Admin (WP admin or Tier 6+)
        if ( function_exists('mp_is_plugin_admin') && mp_is_plugin_admin() ) {
            return true;
        }
        // Fallback: Allow WordPress admins
        if ( current_user_can('manage_options') ) {
            return true;
        }
        // Check Professional Growth tier if function exists
        if ( function_exists('mentorship_platform_pg_user_is_management') ) {
            return mentorship_platform_pg_user_is_management();
        }
        return false;
    }
}

if ( ! function_exists( 'mentorship_platform_register_api_routes' ) ) {
    /**
     * Register all custom REST API routes.
     */
    function mentorship_platform_register_api_routes() {
        $namespace = 'mentorship-platform/v1';

        // --- User Routes ---

        // Get all mentors (replaces getMentors)
        register_rest_route( $namespace, '/mentors', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_mentors',
            'permission_callback' => '__return_true', // Publicly viewable
        ) );

        // Get mentor directory with skills (used by MentorDirectory component)
        register_rest_route( $namespace, '/directory', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_directory',
            'permission_callback' => '__return_true', // Publicly viewable
        ) );

        // Get current user (replaces getCurrentUser)
        register_rest_route( $namespace, '/users/me', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_current_user',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ) );

        // Get a specific user's profile (replaces getMentorById)
        register_rest_route( $namespace, '/users/(?P<id>\d+)', array(
            // GET /users/{id}
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => 'mentorship_platform_get_user',
                'permission_callback' => 'is_user_logged_in', // Require authentication
                'args'                => array(
                    'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                ),
            ),
            // POST /users/{id}
            array(
                'methods'             => WP_REST_Server::EDITABLE, // Handles POST, PUT, PATCH
                'callback'            => 'mentorship_platform_update_user',
                'permission_callback' => 'mentorship_platform_user_permission_check',
                'args'                => array(
                    'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                    'firstName'   => array( 'type' => 'string' ),
                    'lastName'    => array( 'type' => 'string' ),
                    'tagline'     => array( 'type' => 'string' ),
                    'mentorOptIn' => array( 'type' => 'boolean' ),
                    'skills'      => array( 'type' => 'array' ),
                    'bioDetails'  => array( 'type' => 'string' ),
                    'experience'  => array( 'type' => 'string' ),
                    'linkedinUrl' => array( 'type' => 'string' ),
                    'customLinks' => array( 'type' => 'array' ),
                    'avatarUrl'   => array( 'type' => 'string' ),
                ),
            ),
        ) );
        
        // --- Mentorship Request Routes ---

        // Get all requests for current user (replaces getMentorshipRequestsForUser)
        // Register multiple endpoints for the same route by passing an array of configurations
        register_rest_route( $namespace, '/requests', array(
            // GET /requests
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => 'mentorship_platform_get_requests',
                'permission_callback' => 'mentorship_platform_check_access_permission',
            ),
            // POST /requests
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => 'mentorship_platform_create_request',
                'permission_callback' => 'mentorship_platform_check_access_permission',
                'args'                => array(
                    'receiverId' => array(
                        'required' => true,
                        'type'     => 'integer',
                    ),
                    'message'    => array(
                        'required' => true,
                        'type'     => 'string',
                    ),
                ),
            ),
        ) );

        // Get full details for one mentorship (replaces getMentorshipDetails)
        register_rest_route( $namespace, '/requests/(?P<id>\d+)', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_request_details',
            'permission_callback' => 'mentorship_platform_request_permission_check',
        ) );
        
        // Update a request status (Accept/Reject)
        register_rest_route( $namespace, '/requests/(?P<id>\d+)/status', array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_update_request_status',
            'permission_callback' => 'mentorship_platform_receiver_permission_check',
            'args'                => array(
                'status' => array(
                    'required' => true,
                    'type'     => 'string',
                    'enum'     => array( 'Accepted', 'Rejected' ),
                ),
            ),
        ) );
        
        // Delete a mentorship (request) and all associated data
        register_rest_route( $namespace, '/requests/(?P<id>\d+)', array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_delete_mentorship',
            'permission_callback' => 'mentorship_platform_admin_permission_check',
            'args'                => array(
                'id' => array( 'required' => true, 'type' => 'integer' ),
            ),
        ) );

        // --- Goal Routes ---

        // Create a new goal (replaces addGoal)
        register_rest_route( $namespace, '/goals', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_create_goal',
            'permission_callback' => 'mentorship_platform_check_access_permission', // Further checks in callback
            'args'                => array(
                'mentorshipId' => array( 'required' => true, 'type' => 'integer' ),
                'title'        => array( 'required' => true, 'type' => 'string' ),
                'description'  => array( 'required' => true, 'type' => 'string' ),
                'status'       => array( 'required' => true, 'type' => 'string' ),
            ),
        ) );

        // Update a goal (replaces updateGoal)
        register_rest_route( $namespace, '/goals/(?P<id>\d+)', array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_update_goal',
            'permission_callback' => 'mentorship_platform_goal_permission_check',
            'args'                => array(
                'id' => array( 'type' => 'integer' ),
                // All other args are validated in the callback
            ),
        ) );

        // Update goal participants — reassign mentor / mentee (WP admin or Tier 6+)
        register_rest_route( $namespace, '/goals/(?P<id>\d+)/participants', array(
            'methods'             => 'PUT',
            'callback'            => 'mentorship_platform_update_goal_participants',
            'permission_callback' => 'mentorship_platform_goal_participants_permission',
            'args'                => array(
                'id'        => array( 'required' => true, 'type' => 'integer' ),
                'mentor_id' => array( 'required' => true, 'type' => 'integer' ),
                'mentee_id' => array( 'required' => true, 'type' => 'integer' ),
            ),
        ) );

        // --- Meeting Routes ---
        register_rest_route( $namespace, '/meetings', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_create_meeting',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ) );

        register_rest_route( $namespace, '/meetings/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => 'mentorship_platform_update_meeting',
                'permission_callback' => 'mentorship_platform_meeting_permission_check',
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => 'mentorship_platform_delete_meeting',
                'permission_callback' => 'mentorship_platform_meeting_permission_check',
            ),
        ) );




        // --- Update Routes ---
        register_rest_route( $namespace, '/updates', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_create_update',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ) );

        register_rest_route( $namespace, '/updates/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => 'mentorship_platform_update_update',
                'permission_callback' => 'mentorship_platform_update_permission_check',
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => 'mentorship_platform_delete_update',
                'permission_callback' => 'mentorship_platform_update_permission_check',
            ),
        ) );




        // --- Portfolio Route ---

        // Get public portfolio (replaces getPublicPortfolio)
        register_rest_route( $namespace, '/portfolio/(?P<user_id>\d+)', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_public_portfolio',
            'permission_callback' => '__return_true', // Publicly viewable
        ) );

        // Get all users with public portfolios
        register_rest_route( $namespace, '/portfolio-directory', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_portfolio_directory',
            'permission_callback' => '__return_true', // Publicly viewable
        ) );

        // --- File Upload Route ---

        // Upload a file (replaces uploadFile)
        register_rest_route( $namespace, '/upload', array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_upload_file',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ) );

        // Admin route to get ALL mentorships
        register_rest_route($namespace, '/admin/all-mentorships', array(
            'methods' => 'GET',
            'callback' => 'get_all_mentorships_admin',
            'permission_callback' => 'mentorship_platform_check_admin_permission'
        ));

        // Admin route to get ALL users for dropdowns
        register_rest_route($namespace, '/admin/all-users', array(
            'methods' => 'GET',
            'callback' => 'get_all_users_admin',
            'permission_callback' => 'mentorship_platform_check_admin_permission'
        ));

        // User Management - Get users with metadata and filters, Create new user
        register_rest_route($namespace, '/admin/users', array(
            array(
                'methods' => 'GET',
                'callback' => 'mentorship_platform_get_users_with_metadata',
                'permission_callback' => 'mentorship_platform_check_admin_permission'
            ),
            array(
                'methods' => 'POST',
                'callback' => 'mentorship_platform_create_user',
                'permission_callback' => 'mentorship_platform_check_admin_permission'
            )
        ));

        // User Management - Update user, Delete user
        register_rest_route($namespace, '/admin/users/(?P<id>\d+)', array(
            array(
                'methods' => 'PUT',
                'callback' => 'mentorship_platform_admin_update_user',
                'permission_callback' => 'mentorship_platform_check_admin_permission',
                'args' => array(
                    'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
                ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => 'mentorship_platform_delete_user',
                'permission_callback' => 'mentorship_platform_check_admin_permission',
                'args' => array(
                    'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
                ),
            )
        ));

        // User Management - Archive user
        register_rest_route($namespace, '/admin/users/(?P<id>\d+)/archive', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_archive_user',
            'permission_callback' => 'mentorship_platform_check_admin_permission',
            'args' => array(
                'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
            ),
        ));

        // User Management - Unarchive user
        register_rest_route($namespace, '/admin/users/(?P<id>\d+)/unarchive', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_unarchive_user',
            'permission_callback' => 'mentorship_platform_check_admin_permission',
            'args' => array(
                'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
            ),
        ));

        // User Management - Set member status (Tier 6+)
        register_rest_route($namespace, '/admin/users/(?P<id>\d+)/member-status', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_set_member_status',
            'permission_callback' => 'mentorship_platform_check_member_management_permission',
            'args' => array(
                'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
                'is_member' => array('required' => true),
            ),
        ));

        // User Management - Bulk import from CSV
        register_rest_route($namespace, '/admin/users/bulk-import', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_bulk_import_users',
            'permission_callback' => 'mentorship_platform_check_admin_permission'
        ));

        // User Management - Bulk assign job role
        register_rest_route($namespace, '/admin/users/bulk-assign-job-role', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_bulk_assign_job_role',
            'permission_callback' => 'mentorship_platform_check_admin_permission'
        ));

        // Public user list for forms (in-services, scan audits, live drills)
        // Any logged-in user can access this to populate attendance/user selection
        register_rest_route($namespace, '/users/list', array(
            'methods' => 'GET',
            'callback' => 'mentorship_platform_get_user_list',
            'permission_callback' => 'is_user_logged_in'
        ));

        // Admin utility to fix display names (remove trailing zeros and spaces)
        register_rest_route($namespace, '/admin/users/fix-display-names', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_fix_user_display_names',
            'permission_callback' => 'mentorship_platform_check_admin_permission'
        ));

        // Admin utility to clear plugin caches
        register_rest_route($namespace, '/admin/cache/clear', array(
            'methods' => 'POST',
            'callback' => 'mentorship_platform_admin_clear_cache',
            'permission_callback' => 'mentorship_platform_check_admin_permission',
            'args' => array(
                'type' => array(
                    'required' => false,
                    'type' => 'string',
                    'default' => 'all',
                    'enum' => array('all', 'users', 'roles', 'lesson-management', 'taskdeck'),
                    'description' => 'Type of cache to clear'
                ),
            ),
        ));

        // Admin route to create a new mentorship
        register_rest_route($namespace, '/admin/create-mentorship', array(
            'methods' => 'POST',
            'callback' => 'create_mentorship_admin',
            'permission_callback' => 'mentorship_platform_check_admin_permission',
            'args' => array(
                'mentor_id' => array(
                    'required' => true,
                    'type' => 'integer',
                ),
                'mentee_id' => array(
                    'required' => true,
                    'type' => 'integer',
                ),
            ),
        ));

        // Admin route to get details for ANY mentorship
        register_rest_route($namespace, '/admin/mentorship-details/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => 'get_mentorship_details_admin',
            'permission_callback' => function() {
                // Allow WordPress admins OR Tier 5-6 users
                if ( current_user_can('manage_options') ) {
                    return true;
                }
                return function_exists('mentorship_platform_pg_user_is_management') 
                    ? mentorship_platform_pg_user_is_management() 
                    : false;
            }
        ));
    }
}

if ( ! function_exists( 'mysql_to_rfc3339' ) ) {
    /**
     * Helper function to convert MySQL datetime to RFC3339 format.
     * Used for consistent date formatting in API responses.
     *
     * @param string $date_string MySQL datetime string.
     * @return string RFC3339 formatted date string.
     */
    function mysql_to_rfc3339( $date_string ) {
        return gmdate( 'Y-m-d\TH:i:s\Z', strtotime( $date_string ) );
    }
}

/**
 * ===================================================================
 * USER API CALLBACKS & HELPERS
 * ===================================================================
 */

if ( ! function_exists( 'mentorship_platform_user_permission_check' ) ) {
    /**
     * Permission check: Allow user to edit their own profile or if the user is an admin.
     * Also checks if user has access to mentorship features (LearnDash group check).
     */
    function mentorship_platform_user_permission_check( $request ) {
        // Admins can always edit any profile
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }
        
        $user_id = (int) $request['id'];
        $current_user_id = get_current_user_id();
        
        // Users can ALWAYS edit their own profile (no access check needed)
        if ( $current_user_id === $user_id ) {
            return true;
        }
        
        // For editing other users' profiles, check platform access
        return false;
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_user_for_api' ) ) {
    /**
     * Helper function to format a WP_User object into the UserProfile structure.
     *
     * @param WP_User $user The WordPress user object. 
     * @return array The user data formatted for the API.
     */
    function mentorship_platform_prepare_user_for_api( $user ) {
        if ( ! $user instanceof WP_User ) { 
            return null;
        }
        $user_id = $user->ID;

        // Get raw meta values
        $tagline           = get_user_meta( $user_id, '_tagline', true );
        $mentor_opt_in     = get_user_meta( $user_id, '_mentor_opt_in', true );
        $skills_json       = get_user_meta( $user_id, '_skills', true );
        $bio_details       = get_user_meta( $user_id, '_bio_details', true );
        $experience      = get_user_meta( $user_id, '_experience', true );
        $linkedin_url      = get_user_meta( $user_id, '_linkedin_url', true );
        $booking_link      = get_user_meta( $user_id, '_booking_link', true );
        $custom_links_json = get_user_meta( $user_id, '_custom_links', true );
        $notify_email      = get_user_meta( $user_id, '_mentorship_notify_email', true );
        $avatar_url = get_user_meta( $user_id, 'mentorship_avatar_url', true );

        // Decode JSON strings, providing defaults
        $skills = json_decode( $skills_json, true );
        if ( ! is_array( $skills ) ) { 
            $skills = array();
        }
        
        $custom_links = json_decode( $custom_links_json, true ); 
        if ( ! is_array( $custom_links ) ) {
            $custom_links = array();
        }

        // Get user tier from job assignments (for permission checks)
        $tier = null;
        if ( function_exists( 'mentorship_platform_pg_get_user_tier' ) ) {
            $tier = mentorship_platform_pg_get_user_tier( $user_id );
        }

        // Get user capabilities
        $capabilities = array();
        if ( $user->has_cap( 'manage_options' ) ) {
            $capabilities['manage_options'] = true;
        }

        // Get user job roles
        global $wpdb;
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        
        $job_roles = array();
        $job_roles_query = $wpdb->prepare(
            "SELECT r.id, r.title, r.tier
            FROM {$assignments_table} a
            INNER JOIN {$roles_table} r ON a.job_role_id = r.id
            WHERE a.user_id = %d
            ORDER BY r.tier DESC",
            $user_id
        );
        $job_roles_results = $wpdb->get_results( $job_roles_query, ARRAY_A );
        if ( $job_roles_results ) {
            foreach ( $job_roles_results as $role ) {
                $job_roles[] = array(
                    'id' => (int) $role['id'],
                    'title' => $role['title'],
                    'tier' => (int) $role['tier'],
                );
            }
        }

        // Contact methods
        $groupme_username = get_user_meta( $user_id, '_groupme_username', true );
        $signal_username = get_user_meta( $user_id, '_signal_username', true );
        $telegram_username = get_user_meta( $user_id, '_telegram_username', true );
        $contact_email = get_user_meta( $user_id, '_contact_email', true );

        return array(
            'id'          => $user_id,
            'firstName'   => $user->first_name,
            'lastName'    => $user->last_name, 
            'avatarUrl'   => $avatar_url ?: get_avatar_url( $user_id ),
            'tagline'     => $tagline ? $tagline : '',
            'mentorOptIn' => (bool) $mentor_opt_in,
            'skills'      => $skills,
            'bioDetails'  => $bio_details ? $bio_details : '',
            'experience'  => $experience ? $experience : '',
            'linkedinUrl' => $linkedin_url ? $linkedin_url : '',
            'bookingLink' => $booking_link ? $booking_link : '',
            'customLinks' => $custom_links,
            'notifyByEmail' => (bool) $notify_email,
            'tier'        => $tier,
            'capabilities' => $capabilities,
            'jobRoles'    => $job_roles,
            'email'       => $user->user_email,
            'contactEmail' => $contact_email ? $contact_email : '',
            'groupmeUsername' => $groupme_username ? $groupme_username : '',
            'signalUsername' => $signal_username ? $signal_username : '',
            'telegramUsername' => $telegram_username ? $telegram_username : '',
        );
    }
}

if ( ! function_exists( 'mentorship_platform_get_mentors' ) ) {
    /**
     * API Callback: Get all users who have opted-in as mentors.
     */
    function mentorship_platform_get_mentors( $request ) {
        $args = array(
            'meta_key'   => '_mentor_opt_in',
            'meta_value' => true,
        );
        $users = get_users( $args );

        $mentors = array_map( 'mentorship_platform_prepare_user_for_api', $users );

        return new WP_REST_Response( $mentors, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_directory' ) ) {
    /**
     * API Callback: Get mentor directory with all unique skills.
     * Only returns users who have opted-in as mentors AND are not archived.
     */
    function mentorship_platform_get_directory( $request ) {
        global $wpdb;
        
        // Pagination parameters
        $page = max(1, intval($request->get_param('page') ?: 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50))); // Default 50, max 100
        
        // Get users who opted in as mentors
        $args = array(
            'meta_key'   => '_mentor_opt_in',
            'meta_value' => true,
        );
        $users = get_users( $args );
        
        // Filter out archived users by checking pg_user_metadata
        // OPTIMIZED: Single query to fetch all archived statuses instead of N queries
        $metadata_table = $wpdb->prefix . 'pg_user_metadata';
        $active_users = array();
        
        if ( ! empty( $users ) ) {
            // Get all user IDs
            $user_ids = wp_list_pluck( $users, 'ID' );
            $placeholders = implode( ',', array_fill( 0, count( $user_ids ), '%d' ) );
            
            // Batch fetch archived status for all users in one query
            $archived_results = $wpdb->get_results( $wpdb->prepare(
                "SELECT user_id, archived FROM {$metadata_table} WHERE user_id IN ({$placeholders})",
                ...$user_ids
            ), OBJECT_K );
            
            // Filter users based on archived status
            foreach ( $users as $user ) {
                $archived = isset( $archived_results[ $user->ID ] ) ? $archived_results[ $user->ID ]->archived : null;
                
                // Include user if they're not archived (NULL or 0) or if they don't have metadata yet
                if ( $archived === null || $archived == 0 ) {
                    $active_users[] = $user;
                }
            }
        }

        // Calculate pagination
        $total_users = count($active_users);
        $total_pages = ceil($total_users / $per_page);
        $offset = ($page - 1) * $per_page;
        
        // Slice for current page
        $paged_users = array_slice($active_users, $offset, $per_page);
        $mentors = array_map( 'mentorship_platform_prepare_user_for_api', $paged_users );

        // Collect all unique skills (from ALL users, not just current page, for filtering)
        $all_skills = array();
        foreach ( $active_users as $user ) {
            $user_skills = get_user_meta( $user->ID, '_mentorship_skills', true );
            if ( ! empty( $user_skills ) && is_array( $user_skills ) ) {
                $all_skills = array_merge( $all_skills, $user_skills );
            }
        }
        $unique_skills = array_values( array_unique( $all_skills ) );
        sort( $unique_skills );

        return new WP_REST_Response( array(
            'mentors' => $mentors,
            'skills' => $unique_skills,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total_users,
                'total_pages' => $total_pages,
            ),
        ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_current_user' ) ) {
    /**
     * API Callback: Get the currently logged-in user's profile.
     */
    function mentorship_platform_get_current_user( $request ) {
        $user = wp_get_current_user();
        if ( ! $user->ID ) {
            return new WP_Error( 'not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
        }

        $user_data = mentorship_platform_prepare_user_for_api( $user );
        return new WP_REST_Response( $user_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_user' ) ) {
    /**
     * API Callback: Get a single user's public profile.
     */
    function mentorship_platform_get_user( $request ) {
        $user_id = (int) $request['id'];
        $user = get_user_by( 'id', $user_id );

        if ( ! $user ) { 
            return new WP_Error( 'user_not_found', 'User not found.', array( 'status' => 404 ) );
        }

        $user_data = mentorship_platform_prepare_user_for_api( $user );
        return new WP_REST_Response( $user_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_update_user' ) ) {
    /**
     * API Callback: Update a user's profile.
     */
    function mentorship_platform_update_user( $request ) {
        $user_id = (int) $request['id'];
        $params = $request->get_json_params();

        // Update core user fields
        $core_data = array( 'ID' => $user_id );
        if ( isset( $params['firstName'] ) ) {
            $core_data['first_name'] = sanitize_text_field( $params['firstName'] );
        }
        if ( isset( $params['lastName'] ) ) {
            $core_data['last_name'] = sanitize_text_field( $params['lastName'] );
        }
        wp_update_user( $core_data );

        // Update user meta
        if ( isset( $params['tagline'] ) ) {
            update_user_meta( $user_id, '_tagline', sanitize_text_field( $params['tagline'] ) );
        }
        if ( isset( $params['mentorOptIn'] ) ) {
            update_user_meta( $user_id, '_mentor_opt_in', (bool) $params['mentorOptIn'] );
        }
        if ( isset( $params['bioDetails'] ) ) {
            // Allow safe HTML
            update_user_meta( $user_id, '_bio_details', wp_kses_post( $params['bioDetails'] ) );
        }
        if ( isset( $params['experience'] ) ) {
            // Allow safe HTML
            update_user_meta( $user_id, '_experience', wp_kses_post( $params['experience'] ) );
        }
        if ( isset( $params['linkedinUrl'] ) ) {
            update_user_meta( $user_id, '_linkedin_url', esc_url_raw( $params['linkedinUrl'] ) );
        }
        if ( isset( $params['bookingLink'] ) ) {
            update_user_meta( $user_id, '_booking_link', esc_url_raw( $params['bookingLink'] ) );
        }
        if ( isset( $params['notifyByEmail'] ) ) {
            update_user_meta( $user_id, '_mentorship_notify_email', rest_sanitize_boolean( $params['notifyByEmail'] ) );
        }
        // Contact methods
        if ( isset( $params['contactEmail'] ) ) {
            update_user_meta( $user_id, '_contact_email', sanitize_email( $params['contactEmail'] ) );
        }
        if ( isset( $params['groupmeUsername'] ) ) {
            update_user_meta( $user_id, '_groupme_username', sanitize_text_field( $params['groupmeUsername'] ) );
        }
        if ( isset( $params['signalUsername'] ) ) {
            update_user_meta( $user_id, '_signal_username', sanitize_text_field( $params['signalUsername'] ) );
        }
        if ( isset( $params['telegramUsername'] ) ) {
            update_user_meta( $user_id, '_telegram_username', sanitize_text_field( $params['telegramUsername'] ) );
        }
        if (isset($params['avatarUrl'])) {
            // We trust the 'uploadFile' function to have already sanitized and checked the file.
            // We just save the URL.
            update_user_meta($user_id, 'mentorship_avatar_url', esc_url_raw($params['avatarUrl']));
        }
        if ( isset( $params['skills'] ) && is_array( $params['skills'] ) ) {
            $sanitized_skills = array_map( 'sanitize_text_field', $params['skills'] );
            update_user_meta( $user_id, '_skills', wp_json_encode( $sanitized_skills ) );
        }
        if ( isset( $params['customLinks'] ) && is_array( $params['customLinks'] ) ) {
            $sanitized_links = array();
            foreach ( $params['customLinks'] as $link ) {
                if ( is_array( $link ) && ! empty( $link['label'] ) && ! empty( $link['url'] ) ) {
                    $sanitized_links[] = array(
                        'label' => sanitize_text_field( $link['label'] ),
                        'url'   => esc_url_raw( $link['url'] ),
                    );
                }
            }
            update_user_meta( $user_id, '_custom_links', wp_json_encode( $sanitized_links ) );
        }
        
        // Note: avatarUrl is handled separately.

        // Return the updated user profile
        $user = get_user_by( 'id', $user_id );
        $user_data = mentorship_platform_prepare_user_for_api( $user );
        
        return new WP_REST_Response( $user_data, 200 );
    }
}

/**
 * ===================================================================
 * PERMISSION CHECK CALLBACKS
 * ===================================================================
 */

if ( ! function_exists( 'mentorship_platform_meeting_permission_check' ) ) {
    /**
     * Check if the user has permission to edit/delete a meeting.
     * Admins or the author of the meeting can edit/delete.
     * Also checks if user has access to mentorship features.
     */
    function mentorship_platform_meeting_permission_check( $request ) {
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }

        $current_user_id = get_current_user_id();
        
        // Check if user has mentorship platform access
        if ( ! mentorship_platform_user_has_access( $current_user_id ) ) {
            return false;
        }

        $meeting_id = (int) $request['id'];
        $meeting = get_post( $meeting_id );

        if ( ! $meeting || $meeting->post_type !== 'mp_meeting' ) {
            return false;
        }

        // The author of the meeting can always edit/delete it.
        if ( $current_user_id === (int) $meeting->post_author ) {
            return true;
        }

        // Check if the user is part of the mentorship (mentor or mentee).
        // If the user is part of the mentorship, they can edit/delete the meeting.
        $goal_id = (int) get_post_meta( $meeting_id, '_goal_id', true );
        $perm_request = new WP_REST_Request();
        $perm_request->set_url_params( array( 'id' => $goal_id ) );
        
        return mentorship_platform_goal_permission_check( $perm_request );
    }
}

if ( ! function_exists( 'mentorship_platform_request_permission_check' ) ) {
    /**
     * Check if the current user is the sender or receiver of a request.
     * Also checks if user has access to mentorship features.
     */
    function mentorship_platform_request_permission_check( $request ) {
        $current_user_id = get_current_user_id();
        
        // Check if user has mentorship platform access
        if ( ! mentorship_platform_user_has_access( $current_user_id ) ) {
            return false;
        }
        
        $request_id = (int) $request['id'];
        $post = get_post( $request_id );

        if ( ! $post || $post->post_type !== 'mp_request' ) {
            return new WP_Error( 'not_found', 'Request not found.', array( 'status' => 404 ) );
        }

        $receiver_id = (int) get_post_meta( $request_id, '_receiver_id', true );
        
        return $current_user_id === (int) $post->post_author || $current_user_id === $receiver_id;
    }
}

if ( ! function_exists( 'mentorship_platform_receiver_permission_check' ) ) {
    /**
     * Check if the current user is the receiver of a request.
     * Also checks if user has access to mentorship features.
     */
    function mentorship_platform_receiver_permission_check( $request ) {
        $current_user_id = get_current_user_id();
        
        // Check if user has mentorship platform access
        if ( ! mentorship_platform_user_has_access( $current_user_id ) ) {
            return false;
        }
        
        $request_id = (int) $request['id'];
        $post = get_post( $request_id );

        if ( ! $post || $post->post_type !== 'mp_request' ) {
            return new WP_Error( 'not_found', 'Request not found.', array( 'status' => 404 ) );
        }

        $receiver_id = (int) get_post_meta( $request_id, '_receiver_id', true );
        
        return $current_user_id === $receiver_id;
    }
}

if ( ! function_exists( 'mentorship_platform_goal_permission_check' ) ) {
    /**
     * Check if the user has permission to edit a goal (or its children).
     */
    function mentorship_platform_goal_permission_check( $request ) {
        // First, check if the user is an admin. If so, grant permission immediately.
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }

        $goal_id = (int) $request['id'];
        $goal = get_post( $goal_id );

        if ( ! $goal || $goal->post_type !== 'mp_goal' ) {
            return new WP_Error( 'not_found', 'Goal not found.', array( 'status' => 404 ) );
        }

        $mentorship_id = (int) get_post_meta( $goal_id, '_mentorship_id', true );
        if ( ! $mentorship_id ) {
            return false;
        }

        // Reuse request permission check
        $fake_request = new WP_REST_Request( 'GET', '/mentorship-platform/v1/requests/' . $mentorship_id );
        $fake_request->set_url_params( array( 'id' => $mentorship_id ) );
        return mentorship_platform_request_permission_check( $fake_request );
    }
}

if ( ! function_exists( 'mentorship_platform_update_permission_check' ) ) {
    /**
     * Check if the user has permission to edit/delete an update.
     * Admins, the author of the update, and participants of the mentorship can edit/delete.
     */
    function mentorship_platform_update_permission_check( $request ) {
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }

        $update_id = (int) $request['id'];
        $update = get_post( $update_id );
        $current_user_id = get_current_user_id();

        if ( ! $update || $update->post_type !== 'mp_update' ) {
            return false;
        }

        // The author of the update can always edit/delete it.
        if ( $current_user_id === (int) $update->post_author ) {
            return true;
        }

        // Fallback to checking goal permissions. If the user is part of the
        // mentorship, they can interact with the update.
        $goal_id = (int) get_post_meta( $update_id, '_goal_id', true );
        $perm_request = new WP_REST_Request();
        $perm_request->set_url_params( array( 'id' => $goal_id ) );
        
        return mentorship_platform_goal_permission_check( $perm_request );
    }
}

/**
 * ===================================================================
 * API HELPER FUNCTIONS (PREPARE FOR API)
 * ===================================================================
 */

if ( ! function_exists( 'mentorship_platform_get_attachments' ) ) {
    /**
     * Helper to get all formatted attachments for an 'mp_update'.
     * Corresponds to Attachment[] in types.ts
     */
    function mentorship_platform_get_attachments( $post_id ) {
        $attachments = get_attached_media( '', $post_id );
        $formatted_attachments = array();

        foreach ( $attachments as $attachment ) {
            $formatted_attachments[] = array(
                'id'       => (string) $attachment->ID,
                'fileName' => get_the_title( $attachment->ID ),
                'fileType' => $attachment->post_mime_type,
                'url'      => wp_get_attachment_url( $attachment->ID ),
            );
        }
        return $formatted_attachments;
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_task_for_api' ) ) {
    /**
     * Format an 'mp_task' post.
     * Corresponds to Task in types.ts
     */
    function mentorship_platform_prepare_task_for_api( $post ) {
        $task_data = array(
            'id'           => $post->ID,
            'text'         => $post->post_title,
            'isCompleted'  => (bool) get_post_meta( $post->ID, '_is_completed', true ),
            'initiativeId' => (int) get_post_meta( $post->ID, '_initiative_id', true ) ?: null,
        );
        
        // Add completion metadata if task is completed
        if ( $task_data['isCompleted'] ) {
            $completed_date = get_post_meta( $post->ID, '_completed_date', true );
            $completed_by_id = get_post_meta( $post->ID, '_completed_by', true );
            
            if ( $completed_date ) {
                $task_data['completedDate'] = $completed_date;
            }
            
            if ( $completed_by_id ) {
                $user = get_userdata( $completed_by_id );
                if ( $user ) {
                    $task_data['completedBy'] = array(
                        'id' => (int) $user->ID,
                        'name' => $user->display_name,
                    );
                }
            }
        }
        
        // Add enhanced action item fields
        $assigned_to = get_post_meta( $post->ID, '_assigned_to', true );
        if ( $assigned_to ) {
            $task_data['assignedTo'] = (int) $assigned_to;
            $assignee = get_userdata( $assigned_to );
            if ( $assignee ) {
                $task_data['assignedToName'] = $assignee->display_name;
            }
        }
        
        $due_date = get_post_meta( $post->ID, '_due_date', true );
        if ( $due_date ) {
            $task_data['dueDate'] = $due_date;
        }
        
        $created_from_meeting_id = get_post_meta( $post->ID, '_created_from_meeting_id', true );
        if ( $created_from_meeting_id ) {
            $task_data['createdFromMeetingId'] = (int) $created_from_meeting_id;
        }
        
        $priority = get_post_meta( $post->ID, '_priority', true );
        if ( $priority ) {
            $task_data['priority'] = $priority;
        }
        
        return $task_data;
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_meeting_for_api' ) ) {
    /**
     * Format an 'mp_meeting' post.
     * Corresponds to Meeting in types.ts
     */
    function mentorship_platform_prepare_meeting_for_api( $post ) {
        $author_user = get_user_by( 'id', $post->post_author );
        
        // Get enhanced meeting data
        $agenda = get_post_meta( $post->ID, '_agenda', true );
        $decisions = get_post_meta( $post->ID, '_decisions', true );
        $action_items = get_post_meta( $post->ID, '_action_items', true );
        $follow_up = get_post_meta( $post->ID, '_follow_up', true );
        $notes_json = get_post_meta( $post->ID, '_notes_json', true );
        $recurring_pattern = get_post_meta( $post->ID, '_recurring_pattern', true );
        $recurring_parent_id = get_post_meta( $post->ID, '_recurring_parent_id', true );
        $duration = get_post_meta( $post->ID, '_duration', true );
        $attendees = get_post_meta( $post->ID, '_attendees', true );
        
        return array(
            'id'               => $post->ID,
            'topic'            => $post->post_title,
            'date'             => get_post_meta( $post->ID, '_meeting_date', true ),
            'notes'            => $post->post_content,
            'notesJson'        => $notes_json ? json_decode( $notes_json, true ) : null,
            'initiativeId'     => (int) get_post_meta( $post->ID, '_initiative_id', true ) ?: null,
            'meetingLink'      => get_post_meta( $post->ID, '_meeting_link', true ),
            'author'           => mentorship_platform_prepare_user_for_api( $author_user ),
            'commentCount'     => get_comments_number($post->ID),
            'comments'         => array(), // Comments are now fetched on demand
            // Enhanced meeting fields
            'agenda'           => $agenda ? json_decode( $agenda, true ) : array(),
            'decisions'        => $decisions ? json_decode( $decisions, true ) : array(),
            'actionItems'      => $action_items ? json_decode( $action_items, true ) : array(),
            'followUp'         => $follow_up ? json_decode( $follow_up, true ) : array(),
            'recurringPattern' => $recurring_pattern ?: 'none',
            'recurringParentId'=> $recurring_parent_id ? (int) $recurring_parent_id : null,
            'duration'         => $duration ? (int) $duration : null,
            'attendees'        => $attendees ? json_decode( $attendees, true ) : array(),
            'attachments'      => mentorship_platform_get_attachments( $post->ID ),
        );
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_update_for_api' ) ) {
    /**
     * Format an 'mp_update' post.
     * Corresponds to Update in types.ts
     */
    function mentorship_platform_prepare_update_for_api( $post ) {
        $author_user = get_user_by( 'id', $post->post_author );
        
        return array(
            'id'           => $post->ID,
            'author'       => mentorship_platform_prepare_user_for_api( $author_user ),
            'text'         => $post->post_content,
            'date'         => get_post_time( 'c', true, $post ), // Use WP function for RFC3339/ISO8601
            'initiativeId' => (int) get_post_meta( $post->ID, '_initiative_id', true ) ?: null,
            'attachments'  => mentorship_platform_get_attachments( $post->ID ),
            'commentCount' => get_comments_number($post->ID),
            // Comments are handled via the native WP REST API for comments on the post.
        );
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_initiative_for_api' ) ) {
    /**
     * Format an 'mp_initiative' post.
     * Corresponds to Initiative in types.ts
     */
    function mentorship_platform_prepare_initiative_for_api( $post ) {
        return array(
            'id'          => $post->ID,
            'title'       => $post->post_title,
            'description' => $post->post_content,
            'status'      => get_post_meta( $post->ID, '_status', true ),
            'comments'    => array(), // Comments are now fetched on demand
        );
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_goal_for_api' ) ) {
    /**
     * Format an 'mp_goal' post.
     * Corresponds to Goal in types.ts
     */
    function mentorship_platform_prepare_goal_for_api( $post ) {
        $goal_id = $post->ID;

        // Get all child CPTs for this goal (with reasonable limits to prevent memory issues)
        $initiatives = get_posts( array( 'post_type' => 'mp_initiative', 'posts_per_page' => 100, 'meta_key' => '_goal_id', 'meta_value' => $goal_id ) );
        $tasks = get_posts( array( 
            'post_type' => 'mp_task', 
            'posts_per_page' => 200, // Tasks can be numerous
            'meta_key' => '_goal_id', 
            'meta_value' => $goal_id,
            'orderby' => 'menu_order',
            'order' => 'ASC',
        ) );
        $meetings = get_posts( array( 'post_type' => 'mp_meeting', 'posts_per_page' => 100, 'meta_key' => '_goal_id', 'meta_value' => $goal_id ) );
        $updates = get_posts( array( 'post_type' => 'mp_update', 'posts_per_page' => 100, 'meta_key' => '_goal_id', 'meta_value' => $goal_id, 'orderby' => 'date', 'order' => 'DESC' ) );

        // Get all post IDs associated with this goal (the goal itself, its updates, and its meetings)
        $all_post_ids = array($goal_id);
        foreach ($updates as $update) {
            $all_post_ids[] = $update->ID;
        }
        foreach ($meetings as $meeting) {
            $all_post_ids[] = $meeting->ID;
        }
        $all_post_ids = array_unique($all_post_ids);

        // Get the total comment count for all related posts
        $comment_query = new WP_Comment_Query(array(
            'post__in' => $all_post_ids,
            'status' => 'approve',
            'count' => true // This just returns the count
        ));
        $total_comment_count = $comment_query->get_comments();

        // Get comment count for just this goal post (not including updates/meetings)
        $goal_comment_count = get_comments_number($goal_id);

        // Get mentor and mentee information.
        // First check for goal-level participant overrides (_mentor_id / _mentee_id on this goal post).
        // These are set by the "Edit Participants" feature and only affect THIS goal, not the whole mentorship.
        // If no overrides exist, fall back to the linked mp_request record.
        $mentor_override_id = (int) get_post_meta( $goal_id, '_mentor_id', true );
        $mentee_override_id = (int) get_post_meta( $goal_id, '_mentee_id', true );
        $mentor = null;
        $mentee = null;

        if ( $mentor_override_id && $mentee_override_id ) {
            // Use goal-level overrides
            $mentor_user = get_user_by( 'id', $mentor_override_id );
            $mentee_user = get_user_by( 'id', $mentee_override_id );
            if ( $mentor_user ) {
                $mentor = mentorship_platform_prepare_user_for_api( $mentor_user );
            }
            if ( $mentee_user ) {
                $mentee = mentorship_platform_prepare_user_for_api( $mentee_user );
            }
        } else {
            // Fall back to the mentorship record
            $mentorship_id = get_post_meta( $goal_id, '_mentorship_id', true );
            if ( $mentorship_id ) {
                $mentorship_post = get_post( $mentorship_id );
                if ( $mentorship_post && $mentorship_post->post_type === 'mp_request' ) {
                    $mentee_user = get_user_by( 'id', $mentorship_post->post_author );
                    $mentor_id   = get_post_meta( $mentorship_id, '_receiver_id', true );
                    $mentor_user = get_user_by( 'id', $mentor_id );
                    if ( $mentee_user ) {
                        $mentee = mentorship_platform_prepare_user_for_api( $mentee_user );
                    }
                    if ( $mentor_user ) {
                        $mentor = mentorship_platform_prepare_user_for_api( $mentor_user );
                    }
                }
            }
        }

        return array(
            'id'           => $goal_id,
            'title'        => $post->post_title,
            'description'  => $post->post_content,
            'status'       => get_post_meta( $goal_id, '_status', true ),
            'isPortfolio'  => (bool) get_post_meta( $goal_id, '_is_portfolio', true ),
            'totalCommentCount' => (int)$total_comment_count,
            'commentCount' => (int)$goal_comment_count,
            'mentor'       => $mentor,
            'mentee'       => $mentee,
            'initiatives'  => array_map( 'mentorship_platform_prepare_initiative_for_api', $initiatives ),
            'tasks'        => array_map( 'mentorship_platform_prepare_task_for_api', $tasks ),
            'meetings'     => array_map( 'mentorship_platform_prepare_meeting_for_api', $meetings ),
            'updates'      => array_map( 'mentorship_platform_prepare_update_for_api', $updates ),
            'comments'     => array(), // Comments are now fetched on demand
        );
    }
}

if ( ! function_exists( 'mentorship_platform_prepare_request_for_api' ) ) {
    /**
     * Format an 'mp_request' post.
     * Corresponds to MentorshipRequest in types.ts
     */
    function mentorship_platform_prepare_request_for_api( $post ) {
        $sender = get_user_by( 'id', $post->post_author );
        $receiver = get_user_by( 'id', get_post_meta( $post->ID, '_receiver_id', true ) );

        if ( ! $sender || ! $receiver ) {
            return null;
        }

        // Get all goals for this mentorship (with reasonable limit)
        $goals_query = get_posts( array(
            'post_type'      => 'mp_goal',
            'posts_per_page' => 50, // Reasonable limit - unlikely to have 50+ goals per mentorship
            'meta_key'       => '_mentorship_id',
            'meta_value'     => $post->ID,
        ) );
        
        $goals = array_map( 'mentorship_platform_prepare_goal_for_api', $goals_query );

        return array(
            'id'          => $post->ID,
            'sender'      => mentorship_platform_prepare_user_for_api( $sender ),
            'receiver'    => mentorship_platform_prepare_user_for_api( $receiver ),
            'message'     => $post->post_content,
            'status'      => get_post_meta( $post->ID, '_status', true ),
            'requestDate' => get_post_time( 'c', true, $post ), // Use WP function for RFC3339/ISO8601
            'goals'       => $goals,
        );
    }
}

/**
 * ===================================================================
 * API CALLBACKS
 * ===================================================================
 */

if ( ! function_exists( 'mentorship_platform_get_requests' ) ) {
    /**
     * API Callback: Get all mentorship requests for the current user.
     */
    function mentorship_platform_get_requests( $request ) {
        $start_time = microtime(true);
        error_log('=== MENTORSHIP API: GET /requests START ===');
        
        $user_id = get_current_user_id();
        
        // Pagination parameters
        $page = max(1, intval($request->get_param('page') ?: 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50))); // Default 50, max 100
        
        error_log(sprintf('Params: user_id=%d, page=%d, per_page=%d', $user_id, $page, $per_page));
        
        $query_start = microtime(true);
        $sent_requests = get_posts( array(
            'post_type'      => 'mp_request',
            'posts_per_page' => -1, // Get all to merge and paginate
            'author'         => $user_id,
        ) );
        $sent_time = (microtime(true) - $query_start) * 1000;
        
        $query_start = microtime(true);
        $received_requests = get_posts( array(
            'post_type'      => 'mp_request',
            'posts_per_page' => -1, // Get all to merge and paginate
            'meta_key'       => '_receiver_id',
            'meta_value'     => $user_id,
        ) );
        $received_time = (microtime(true) - $query_start) * 1000;

        $all_posts = array_unique( array_merge( $sent_requests, $received_requests ), SORT_REGULAR );
        
        // Calculate pagination
        $total = count($all_posts);
        $total_pages = ceil($total / $per_page);
        $offset = ($page - 1) * $per_page;
        
        // Slice for current page
        $paged_posts = array_slice($all_posts, $offset, $per_page);
        
        $formatted_requests = array();
        foreach ( $paged_posts as $post ) {
            $formatted_request = mentorship_platform_prepare_request_for_api( $post );
            if ( $formatted_request ) {
                $formatted_requests[] = $formatted_request;
            }
        }

        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('Sent query: %.2fms, Received query: %.2fms, Total: %.2fms, requests=%d',
            $sent_time, $received_time, $total_time, count($formatted_requests)));
        error_log('=== MENTORSHIP API: GET /requests END ===');

        return new WP_REST_Response( array(
            'requests' => $formatted_requests,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => $total_pages,
            ),
        ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_create_request' ) ) {
    /**
     * API Callback: Create a new mentorship request.
     */
    function mentorship_platform_create_request( $request ) {
        $start_time = microtime(true);
        error_log('=== MENTORSHIP API: POST /requests START ===');
        
        $sender_id = get_current_user_id();
        $params = $request->get_json_params();
        $receiver_id = (int) $params['receiverId'];
        $message = sanitize_textarea_field( $params['message'] );
        
        error_log(sprintf('Params: sender=%d, receiver=%d', $sender_id, $receiver_id));

        if ( $sender_id === $receiver_id ) {
            return new WP_Error( 'self_request', 'Cannot send mentorship request to yourself.', array( 'status' => 400 ) );
        }

        // Check if a pending request already exists
        $existing = get_posts( array(
            'post_type' => 'mp_request',
            'author' => $sender_id,
            'meta_query' => array(
                'relation' => 'AND',
                array( 'key' => '_receiver_id', 'value' => $receiver_id ),
                array( 'key' => '_status', 'value' => 'Pending' ),
            ),
        ) );
        if ( ! empty( $existing ) ) {
            return new WP_Error( 'duplicate_request', 'A pending request to this mentor already exists.', array( 'status' => 409 ) );
        }

        $post_id = wp_insert_post( array(
            'post_type'    => 'mp_request',
            'post_title'   => 'Mentorship Request from ' . wp_get_current_user()->display_name,
            'post_content' => $message,
            'post_status'  => 'publish',
            'post_author'  => $sender_id,
        ) );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, '_receiver_id', $receiver_id );
        update_post_meta( $post_id, '_status', 'Pending' );

        // Send email notification to the receiver (mentor)
        $receiver = get_user_by( 'id', $receiver_id );
        if ( $receiver ) {
            $notify_email = get_user_meta( $receiver_id, '_mentorship_notify_email', true );
            
            // Send email if user has notifications enabled (default to true if not set)
            if ( $notify_email !== '0' && $notify_email !== false ) {
                $sender = wp_get_current_user();
                $subject = sprintf( '[%s] New Mentorship Request from %s', get_bloginfo( 'name' ), $sender->display_name );
                
                $message_body = sprintf(
                    "Hello %s,\n\n" .
                    "You have received a new mentorship request from %s %s.\n\n" .
                    "Message:\n%s\n\n" .
                    "To view and respond to this request, please log in to your account:\n%s\n\n" .
                    "Best regards,\n%s",
                    $receiver->display_name,
                    $sender->first_name,
                    $sender->last_name,
                    $message,
                    home_url(),
                    get_bloginfo( 'name' )
                );
                
                wp_mail( $receiver->user_email, $subject, $message_body );
            }
        }

        $post = get_post( $post_id );
        $response_data = mentorship_platform_prepare_request_for_api( $post );

        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: POST /requests END - Total: %.2fms, request_id=%d ===', $total_time, $post_id));

        return new WP_REST_Response( $response_data, 201 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_request_details' ) ) {
    /**
     * API Callback: Get full details for a single mentorship request.
     */
    function mentorship_platform_get_request_details( $request ) {
        $start_time = microtime(true);
        $request_id = (int) $request['id'];
        error_log(sprintf('=== MENTORSHIP API: GET /requests/%d START ===', $request_id));
        
        $post = get_post( $request_id );

        $formatted_request = mentorship_platform_prepare_request_for_api( $post );

        if ( ! $formatted_request ) {
            $total_time = (microtime(true) - $start_time) * 1000;
            error_log(sprintf('=== MENTORSHIP API: GET /requests/%d END (NOT FOUND) - Total: %.2fms ===', $request_id, $total_time));
            return new WP_Error( 'not_found', 'Request not found.', array( 'status' => 404 ) );
        }

        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: GET /requests/%d END - Total: %.2fms ===', $request_id, $total_time));
        
        return new WP_REST_Response( $formatted_request, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_update_request_status' ) ) {
    /**
     * API Callback: Update a request's status (Accept/Reject).
     */
    function mentorship_platform_update_request_status( $request ) {
        $start_time = microtime(true);
        $request_id = (int) $request['id'];
        $params = $request->get_json_params();
        $status = sanitize_text_field( $params['status'] );
        
        error_log(sprintf('=== MENTORSHIP API: PUT /requests/%d/status START - status=%s ===', $request_id, $status));

        update_post_meta( $request_id, '_status', $status );

        // Send email notification to the sender (mentee)
        $post = get_post( $request_id );
        if ( $post ) {
            $sender_id = $post->post_author;
            $sender = get_user_by( 'id', $sender_id );
            
            if ( $sender ) {
                $notify_email = get_user_meta( $sender_id, '_mentorship_notify_email', true );
                
                // Send email if user has notifications enabled (default to true if not set)
                if ( $notify_email !== '0' && $notify_email !== false ) {
                    $receiver_id = get_post_meta( $request_id, '_receiver_id', true );
                    $receiver = get_user_by( 'id', $receiver_id );
                    
                    if ( $receiver ) {
                        if ( $status === 'Accepted' ) {
                            $subject = sprintf( '[%s] Your Mentorship Request Has Been Accepted!', get_bloginfo( 'name' ) );
                            $message_body = sprintf(
                                "Hello %s,\n\n" .
                                "Great news! %s %s has accepted your mentorship request.\n\n" .
                                "You can now start working together on your goals. Log in to get started:\n%s\n\n" .
                                "Best regards,\n%s",
                                $sender->display_name,
                                $receiver->first_name,
                                $receiver->last_name,
                                home_url(),
                                get_bloginfo( 'name' )
                            );
                        } else {
                            $subject = sprintf( '[%s] Update on Your Mentorship Request', get_bloginfo( 'name' ) );
                            $message_body = sprintf(
                                "Hello %s,\n\n" .
                                "We wanted to let you know that %s %s has declined your mentorship request at this time.\n\n" .
                                "Don't be discouraged! There are many other mentors in our community who may be a great fit.\n\n" .
                                "Find other mentors:\n%s\n\n" .
                                "Best regards,\n%s",
                                $sender->display_name,
                                $receiver->first_name,
                                $receiver->last_name,
                                home_url(),
                                get_bloginfo( 'name' )
                            );
                        }
                        
                        wp_mail( $sender->user_email, $subject, $message_body );
                    }
                }
            }
        }

        $response_data = mentorship_platform_prepare_request_for_api( $post );

        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: PUT /requests/%d/status END - Total: %.2fms ===', $request_id, $total_time));

        return new WP_REST_Response( $response_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_create_goal' ) ) {
    /**
     * API Callback: Create a new goal.
     */
    function mentorship_platform_create_goal( $request ) {
        $start_time = microtime(true);
        error_log('=== MENTORSHIP API: POST /goals START ===');
        
        $params = $request->get_json_params();
        $mentorship_id = (int) $params['mentorshipId'];
        
        error_log(sprintf('Params: mentorship_id=%d', $mentorship_id));
        
        // Check permission for the parent mentorship
        $perm_request = new WP_REST_Request( 'GET', '/mentorship-platform/v1/requests/' . $mentorship_id );
        $perm_request->set_url_params( array( 'id' => $mentorship_id ) ); 
        if ( ! mentorship_platform_request_permission_check( $perm_request ) && ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( 'forbidden', 'You do not have permission to add a goal to this mentorship.', array( 'status' => 403 ) );
        }

        


        $post_id = wp_insert_post( array(
            'post_type'    => 'mp_goal',
            'post_title'   => sanitize_text_field( $params['title'] ),
            'post_content' => wp_kses_post( $params['description'] ),
            'post_status'  => 'publish',
            'post_author'  => get_current_user_id(),
            'comment_status' => 'open',
        ) );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, '_mentorship_id', $mentorship_id );
        update_post_meta( $post_id, '_status', sanitize_text_field( $params['status'] ) );
        update_post_meta( $post_id, '_is_portfolio', false );

        $post = get_post( $post_id );
        $response_data = mentorship_platform_prepare_goal_for_api( $post );

        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: POST /goals END - Total: %.2fms, goal_id=%d ===',
            $total_time, $post_id));

        return new WP_REST_Response( $response_data, 201 );
    }
}

function handle_goal_tasks($tasks_data, $goal_id) {
    $existing_task_ids = get_posts(array(
        'post_type' => 'mp_task',
        'meta_query' => array(
            array(
                'key' => '_goal_id',
                'value' => $goal_id,
            ),
        ),
        'fields' => 'ids',
        'posts_per_page' => 500, // Reasonable limit for tasks per goal
    ));

    $received_task_ids = array();
    $new_tasks = array(); // To hold newly created task objects
    $order_index = 0; // <-- This is the new variable to track order

    foreach ($tasks_data as $task_data) {
        $task_id = isset($task_data['id']) ? intval($task_data['id']) : 0;
        $task_text = sanitize_text_field($task_data['text']);
        $task_completed = rest_sanitize_boolean($task_data['isCompleted']);
        $task_initiative_id = isset($task_data['initiativeId']) ? intval($task_data['initiativeId']) : null;
        $completed_date = isset($task_data['completedDate']) ? sanitize_text_field($task_data['completedDate']) : null;
        
        // Enhanced action item fields
        $assigned_to = isset($task_data['assignedTo']) ? intval($task_data['assignedTo']) : null;
        $due_date = isset($task_data['dueDate']) ? sanitize_text_field($task_data['dueDate']) : null;
        $created_from_meeting_id = isset($task_data['createdFromMeetingId']) ? intval($task_data['createdFromMeetingId']) : null;
        $priority = isset($task_data['priority']) ? sanitize_text_field($task_data['priority']) : null;

        if ($task_id > 0 && in_array($task_id, $existing_task_ids)) {
            // Update existing task
            $was_completed = (bool) get_post_meta($task_id, '_is_completed', true);
            
            wp_update_post(array(
                'ID' => $task_id,
                'post_title' => $task_text,
                'post_status' => 'publish',
                'menu_order' => $order_index, // <-- Save the order index
            ));
            update_post_meta($task_id, '_is_completed', $task_completed);
            update_post_meta($task_id, '_initiative_id', $task_initiative_id);
            
            // Track completion metadata
            if ($task_completed && !$was_completed) {
                // Just marked complete - save who and when
                update_post_meta($task_id, '_completed_date', current_time('mysql'));
                update_post_meta($task_id, '_completed_by', get_current_user_id());
            } elseif (!$task_completed && $was_completed) {
                // Unmarked - clear completion metadata
                delete_post_meta($task_id, '_completed_date');
                delete_post_meta($task_id, '_completed_by');
            } elseif ($task_completed && $completed_date) {
                // Already completed, preserve existing completion date if provided
                update_post_meta($task_id, '_completed_date', $completed_date);
            }
            
            // Enhanced action item fields
            if ($assigned_to) {
                update_post_meta($task_id, '_assigned_to', $assigned_to);
            } else {
                delete_post_meta($task_id, '_assigned_to');
            }
            if ($due_date) {
                update_post_meta($task_id, '_due_date', $due_date);
            } else {
                delete_post_meta($task_id, '_due_date');
            }
            if ($created_from_meeting_id) {
                update_post_meta($task_id, '_created_from_meeting_id', $created_from_meeting_id);
            }
            if ($priority) {
                update_post_meta($task_id, '_priority', $priority);
            } else {
                delete_post_meta($task_id, '_priority');
            }
            
            $received_task_ids[] = $task_id;
        } else {
            // Create new task
            $new_task_id = wp_insert_post(array(
                'post_type' => 'mp_task',
                'post_title' => $task_text,
                'post_status' => 'publish',
                'menu_order' => $order_index, // <-- Save the order index
            ));
            if ($new_task_id) {
                update_post_meta($new_task_id, '_goal_id', $goal_id);
                update_post_meta($new_task_id, '_is_completed', $task_completed);
                update_post_meta($new_task_id, '_initiative_id', $task_initiative_id);
                
                // If newly created task is already completed, save completion metadata
                if ($task_completed) {
                    update_post_meta($new_task_id, '_completed_date', $completed_date ?: current_time('mysql'));
                    update_post_meta($new_task_id, '_completed_by', get_current_user_id());
                }
                
                // Enhanced action item fields
                if ($assigned_to) {
                    update_post_meta($new_task_id, '_assigned_to', $assigned_to);
                }
                if ($due_date) {
                    update_post_meta($new_task_id, '_due_date', $due_date);
                }
                if ($created_from_meeting_id) {
                    update_post_meta($new_task_id, '_created_from_meeting_id', $created_from_meeting_id);
                }
                if ($priority) {
                    update_post_meta($new_task_id, '_priority', $priority);
                }
                
                $received_task_ids[] = $new_task_id;
            }
        }
        $order_index++; // <-- Increment the order index for the next task
    }

    // Delete tasks that were not in the received list
    $tasks_to_delete = array_diff($existing_task_ids, $received_task_ids);
    foreach ($tasks_to_delete as $task_id_to_delete) {
        wp_delete_post($task_id_to_delete, true); // Force delete
    }
}

if ( ! function_exists( 'mentorship_platform_update_goal' ) ) {
    /**
     * API Callback: Update an entire goal.
     */
    function mentorship_platform_update_goal( $request ) {
        $start_time = microtime(true);
        error_log('=== MENTORSHIP API: PUT /goals START ===');
        
        $goal_id = (int) $request['id'];
        $params = $request->get_json_params();
        
        error_log(sprintf('Params: goal_id=%d', $goal_id)); // The entire goal object is passed in the body

        // 1. Update Goal Post
        wp_update_post( array(
            'ID'           => $goal_id,
            'post_title'   => sanitize_text_field( $params['title'] ),
            'post_content' => wp_kses_post( $params['description'] ),
        ) );
        update_post_meta( $goal_id, '_status', sanitize_text_field( $params['status'] ) );
        update_post_meta( $goal_id, '_is_portfolio', (bool) $params['isPortfolio'] );

        // 2. Handle Initiatives
        $existing_initiatives = get_posts( array( 'post_type' => 'mp_initiative', 'posts_per_page' => 100, 'meta_key' => '_goal_id', 'meta_value' => $goal_id ) );
        $existing_initiative_ids = wp_list_pluck( $existing_initiatives, 'ID' );
        $incoming_initiative_ids = array_filter( wp_list_pluck( $params['initiatives'], 'id' ) );
        
        // Delete initiatives that are no longer present
        $initiatives_to_delete = array_diff( $existing_initiative_ids, $incoming_initiative_ids );
        foreach ( $initiatives_to_delete as $init_id ) {
            wp_delete_post( $init_id, true );
        }

        // Add or Update initiatives
        foreach ( $params['initiatives'] as $initiative ) {
            $init_id = (int) $initiative['id'];
            $post_data = array(
                'post_title'   => sanitize_text_field( $initiative['title'] ),
                'post_content' => wp_kses_post( $initiative['description'] ),
                'post_type'    => 'mp_initiative',
                'post_status'  => 'publish',
                'post_author'  => get_current_user_id(),
                'comment_status' => 'open',
            );
            if ( $init_id > 0 && in_array( $init_id, $existing_initiative_ids ) ) {
                // Update
                $post_data['ID'] = $init_id;
                wp_update_post( $post_data );
                
                // Track initiative completion for promotion criteria
                $old_status = get_post_meta( $init_id, '_status', true );
                $new_status = sanitize_text_field( $initiative['status'] );
                
                // If status changed to "Completed", trigger linked module tracking
                if ( $new_status === 'Completed' && $old_status !== 'Completed' ) {
                    // Get the goal's mentorship to find the users
                    $mentorship_id = get_post_meta( $goal_id, '_mentorship_id', true );
                    if ( $mentorship_id ) {
                        // Mentorship structure: post_author = mentee, _receiver_id = mentor
                        $mentorship_post = get_post( $mentorship_id );
                        $mentee_id = $mentorship_post ? $mentorship_post->post_author : null;
                        $mentor_id = get_post_meta( $mentorship_id, '_receiver_id', true );
                        
                        // Load professional growth functions if not already loaded
                        if ( ! function_exists( 'mentorship_platform_pg_update_linked_module_progress' ) ) {
                            require_once plugin_dir_path( __FILE__ ) . 'api-routes-professional-growth.php';
                        }
                        
                        // Track for mentee (all completed initiatives)
                        if ( $mentee_id ) {
                            mentorship_platform_pg_update_linked_module_progress( $mentee_id, 'initiative', 'completed' );
                        }
                        
                        // Track for mentor (initiatives where they are the mentor)
                        if ( $mentor_id ) {
                            mentorship_platform_pg_update_linked_module_progress( $mentor_id, 'mentorship_goal', 'completed' );
                        }
                    }
                }
            } else {
                // Add
                $init_id = wp_insert_post( $post_data );
                
                // If newly created initiative is already marked as completed, track it
                if ( sanitize_text_field( $initiative['status'] ) === 'Completed' ) {
                    $mentorship_id = get_post_meta( $goal_id, '_mentorship_id', true );
                    if ( $mentorship_id ) {
                        // Mentorship structure: post_author = mentee, _receiver_id = mentor
                        $mentorship_post = get_post( $mentorship_id );
                        $mentee_id = $mentorship_post ? $mentorship_post->post_author : null;
                        $mentor_id = get_post_meta( $mentorship_id, '_receiver_id', true );
                        
                        if ( ! function_exists( 'mentorship_platform_pg_update_linked_module_progress' ) ) {
                            require_once plugin_dir_path( __FILE__ ) . 'api-routes-professional-growth.php';
                        }
                        
                        // Track for mentee (all completed initiatives)
                        if ( $mentee_id ) {
                            mentorship_platform_pg_update_linked_module_progress( $mentee_id, 'initiative', 'completed' );
                        }
                        
                        // Track for mentor (initiatives where they are the mentor)
                        if ( $mentor_id ) {
                            mentorship_platform_pg_update_linked_module_progress( $mentor_id, 'mentorship_goal', 'completed' );
                        }
                    }
                }
            }
            update_post_meta( $init_id, '_goal_id', $goal_id );
            update_post_meta( $init_id, '_status', sanitize_text_field( $initiative['status'] ) );
            // Comments are handled separately via WP's native comment API
        }

        // 3. Handle Tasks
        handle_goal_tasks($params['tasks'], $goal_id);

        // 4. Handle Meetings
        $existing_meetings = get_posts( array( 'post_type' => 'mp_meeting', 'posts_per_page' => 100, 'meta_key' => '_goal_id', 'meta_value' => $goal_id ) );
        $existing_meeting_ids = wp_list_pluck( $existing_meetings, 'ID' );
        $incoming_meeting_ids = array_filter( wp_list_pluck( $params['meetings'], 'id' ) );
        $meetings_to_delete = array_diff( $existing_meeting_ids, $incoming_meeting_ids );
        foreach ( $meetings_to_delete as $meeting_id ) { wp_delete_post( $meeting_id, true ); }
        foreach ( $params['meetings'] as $meeting ) {
            $meeting_id = (int) $meeting['id'];
            $post_data = array( 'post_title' => sanitize_text_field( $meeting['topic'] ), 'post_content' => wp_kses_post( $meeting['notes'] ), 'post_type' => 'mp_meeting', 'post_status' => 'publish', 'post_author' => get_current_user_id(), 'comment_status' => 'open', );
            if ( $meeting_id > 0 && in_array( $meeting_id, $existing_meeting_ids ) ) { $post_data['ID'] = $meeting_id; wp_update_post( $post_data ); } else { $meeting_id = wp_insert_post( $post_data ); }
            update_post_meta( $meeting_id, '_goal_id', $goal_id );
            update_post_meta( $meeting_id, '_initiative_id', (int) $meeting['initiativeId'] );
            update_post_meta( $meeting_id, '_meeting_date', sanitize_text_field( $meeting['date'] ) );
            update_post_meta( $meeting_id, '_meeting_link', esc_url_raw( $meeting['meetingLink'] ) );
            // Comments are handled separately
        }
        
        // 5. Handle Updates
        // Updates are now handled by their own dedicated endpoints.

        $updated_post = get_post( $goal_id );
        $response_data = mentorship_platform_prepare_goal_for_api( $updated_post );
        
        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: PUT /goals/%d END - Total: %.2fms ===', $goal_id, $total_time));
        
        return new WP_REST_Response( $response_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_goal_participants_permission' ) ) {
    /**
     * Permission check: WP admin or Tier 6+.
     */
    function mentorship_platform_goal_participants_permission() {
        if ( ! is_user_logged_in() ) {
            return false;
        }
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }
        if ( function_exists( 'mentorship_platform_pg_get_user_tier' ) ) {
            return mentorship_platform_pg_get_user_tier( get_current_user_id() ) >= 6;
        }
        return false;
    }
}

if ( ! function_exists( 'mentorship_platform_update_goal_participants' ) ) {
    /**
     * API Callback: PUT /goals/{id}/participants
     * Reassigns the mentor and mentee for the goal's linked mentorship record.
     */
    function mentorship_platform_update_goal_participants( $request ) {
        $goal_id   = (int) $request['id'];
        $mentor_id = (int) $request->get_param( 'mentor_id' );
        $mentee_id = (int) $request->get_param( 'mentee_id' );

        $mentor_user = get_user_by( 'id', $mentor_id );
        $mentee_user = get_user_by( 'id', $mentee_id );

        if ( ! $mentor_user ) {
            return new WP_Error( 'invalid_mentor', 'Mentor user not found.', array( 'status' => 400 ) );
        }
        if ( ! $mentee_user ) {
            return new WP_Error( 'invalid_mentee', 'Mentee user not found.', array( 'status' => 400 ) );
        }
        if ( $mentor_id === $mentee_id ) {
            return new WP_Error( 'same_user', 'Mentor and mentee must be different people.', array( 'status' => 400 ) );
        }

        $mentorship_id = (int) get_post_meta( $goal_id, '_mentorship_id', true );
        if ( ! $mentorship_id ) {
            return new WP_Error( 'no_mentorship', 'This goal is not linked to a mentorship.', array( 'status' => 400 ) );
        }

        $mentorship_post = get_post( $mentorship_id );
        if ( ! $mentorship_post || $mentorship_post->post_type !== 'mp_request' ) {
            return new WP_Error( 'invalid_mentorship', 'Mentorship record not found.', array( 'status' => 400 ) );
        }

        // Store overrides on the goal post itself — the mentorship record is NOT modified.
        // This means other goals in the same mentorship are unaffected.
        update_post_meta( $goal_id, '_mentor_id', $mentor_id );
        update_post_meta( $goal_id, '_mentee_id', $mentee_id );

        // Return the refreshed goal so the frontend can update its local state
        $goal_post = get_post( $goal_id );
        return new WP_REST_Response( mentorship_platform_prepare_goal_for_api( $goal_post ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_create_meeting' ) ) {
    function mentorship_platform_create_meeting( $request ) {
        $params = $request->get_json_params();
        $goal_id = (int) $params['goalId'];

        // Permission check: Can user edit the parent goal?
        $perm_request = new WP_REST_Request();
        $perm_request->set_url_params( array( 'id' => $goal_id ) );
        if ( ! mentorship_platform_goal_permission_check( $perm_request ) ) {
            return new WP_Error( 'forbidden', 'You do not have permission to add a meeting to this goal.', array( 'status' => 403 ) );
        }

        $post_id = wp_insert_post( array(
            'post_type'    => 'mp_meeting',
            'post_title'   => sanitize_text_field( $params['topic'] ),
            'post_content' => wp_kses_post( $params['notes'] ?? '' ),
            'post_status'  => 'publish',
            'post_author'  => get_current_user_id(),
            'comment_status' => 'open',
        ) );

        if ( is_wp_error( $post_id ) ) { return $post_id; }

        update_post_meta( $post_id, '_goal_id', $goal_id );
        update_post_meta( $post_id, '_initiative_id', (int) ($params['initiativeId'] ?? 0) );
        update_post_meta( $post_id, '_meeting_date', sanitize_text_field( $params['date'] ?? '' ) );
        update_post_meta( $post_id, '_meeting_link', esc_url_raw( $params['meetingLink'] ?? '' ) );
        
        // Enhanced meeting fields
        if ( isset( $params['notesJson'] ) ) {
            update_post_meta( $post_id, '_notes_json', wp_json_encode( $params['notesJson'] ) );
        }
        if ( isset( $params['agenda'] ) ) {
            update_post_meta( $post_id, '_agenda', wp_json_encode( $params['agenda'] ) );
        }
        if ( isset( $params['decisions'] ) ) {
            update_post_meta( $post_id, '_decisions', wp_json_encode( $params['decisions'] ) );
        }
        if ( isset( $params['actionItems'] ) ) {
            update_post_meta( $post_id, '_action_items', wp_json_encode( $params['actionItems'] ) );
        }
        if ( isset( $params['followUp'] ) ) {
            update_post_meta( $post_id, '_follow_up', wp_json_encode( $params['followUp'] ) );
        }
        if ( isset( $params['recurringPattern'] ) ) {
            update_post_meta( $post_id, '_recurring_pattern', sanitize_text_field( $params['recurringPattern'] ) );
        }
        if ( isset( $params['recurringParentId'] ) ) {
            update_post_meta( $post_id, '_recurring_parent_id', (int) $params['recurringParentId'] );
        }
        if ( isset( $params['duration'] ) ) {
            update_post_meta( $post_id, '_duration', (int) $params['duration'] );
        }
        if ( isset( $params['attendees'] ) ) {
            update_post_meta( $post_id, '_attendees', wp_json_encode( $params['attendees'] ) );
        }

        // Handle attachments (files already uploaded via /upload endpoint)
        if ( isset( $params['attachments'] ) && is_array( $params['attachments'] ) ) {
            foreach ( $params['attachments'] as $attachment ) {
                wp_update_post( array( 'ID' => (int) $attachment['id'], 'post_parent' => $post_id ) );
            }
        }

        $post = get_post( $post_id );
        $response_data = mentorship_platform_prepare_meeting_for_api( $post );
        return new WP_REST_Response( $response_data, 201 );
    }
}

if ( ! function_exists( 'mentorship_platform_update_meeting' ) ) {
    function mentorship_platform_update_meeting( $request ) {
        $meeting_id = (int) $request['id'];
        $params = $request->get_json_params();

        wp_update_post( array(
            'ID'           => $meeting_id,
            'post_title'   => sanitize_text_field( $params['topic'] ?? '' ),
            'post_content' => wp_kses_post( $params['notes'] ?? '' ),
        ) );

        update_post_meta( $meeting_id, '_initiative_id', (int) ($params['initiativeId'] ?? 0) );
        update_post_meta( $meeting_id, '_meeting_date', sanitize_text_field( $params['date'] ?? '' ) );
        update_post_meta( $meeting_id, '_meeting_link', esc_url_raw( $params['meetingLink'] ?? '' ) );
        
        // Enhanced meeting fields
        if ( isset( $params['notesJson'] ) ) {
            update_post_meta( $meeting_id, '_notes_json', wp_json_encode( $params['notesJson'] ) );
        }
        if ( isset( $params['agenda'] ) ) {
            update_post_meta( $meeting_id, '_agenda', wp_json_encode( $params['agenda'] ) );
        }
        if ( isset( $params['decisions'] ) ) {
            update_post_meta( $meeting_id, '_decisions', wp_json_encode( $params['decisions'] ) );
        }
        if ( isset( $params['actionItems'] ) ) {
            update_post_meta( $meeting_id, '_action_items', wp_json_encode( $params['actionItems'] ) );
        }
        if ( isset( $params['followUp'] ) ) {
            update_post_meta( $meeting_id, '_follow_up', wp_json_encode( $params['followUp'] ) );
        }
        if ( isset( $params['recurringPattern'] ) ) {
            update_post_meta( $meeting_id, '_recurring_pattern', sanitize_text_field( $params['recurringPattern'] ) );
        }
        if ( isset( $params['recurringParentId'] ) ) {
            update_post_meta( $meeting_id, '_recurring_parent_id', (int) $params['recurringParentId'] );
        }
        if ( isset( $params['duration'] ) ) {
            update_post_meta( $meeting_id, '_duration', (int) $params['duration'] );
        }
        if ( isset( $params['attendees'] ) ) {
            update_post_meta( $meeting_id, '_attendees', wp_json_encode( $params['attendees'] ) );
        }

        // Handle attachments — diff existing vs incoming
        if ( isset( $params['attachments'] ) && is_array( $params['attachments'] ) ) {
            $existing_attachments = get_attached_media( '', $meeting_id );
            $existing_ids = wp_list_pluck( $existing_attachments, 'ID' );
            $incoming_ids = array_map( 'intval', wp_list_pluck( $params['attachments'], 'id' ) );

            // Detach removed attachments
            foreach ( array_diff( $existing_ids, $incoming_ids ) as $detach_id ) {
                wp_update_post( array( 'ID' => $detach_id, 'post_parent' => 0 ) );
            }
            // Attach new attachments
            foreach ( array_diff( $incoming_ids, $existing_ids ) as $attach_id ) {
                wp_update_post( array( 'ID' => $attach_id, 'post_parent' => $meeting_id ) );
            }
        }

        $post = get_post( $meeting_id );
        $response_data = mentorship_platform_prepare_meeting_for_api( $post );
        return new WP_REST_Response( $response_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_delete_meeting' ) ) {
    function mentorship_platform_delete_meeting( $request ) {
        $meeting_id = (int) $request['id'];

        $attachments = get_attached_media( '', $meeting_id );
        foreach ( $attachments as $attachment ) {
            wp_delete_attachment( $attachment->ID, true );
        }

        $result = wp_delete_post( $meeting_id, true );

        if ( ! $result ) {
            return new WP_Error( 'delete_failed', 'Failed to delete the meeting.', array( 'status' => 500 ) );
        }

        return new WP_REST_Response( array( 'success' => true, 'id' => $meeting_id ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_create_update' ) ) { // phpcs:ignore Squiz.Functions.FunctionDeclaration.Found
    function mentorship_platform_create_update( $request ) {
        $params = $request->get_json_params();
        $goal_id = (int) $params['goalId'];

        // Permission check: Can user edit the parent goal?
        $perm_request = new WP_REST_Request();
        $perm_request->set_url_params( array( 'id' => $goal_id ) );
        if ( ! mentorship_platform_goal_permission_check( $perm_request ) ) {
            return new WP_Error( 'forbidden', 'You do not have permission to add an update to this goal.', array( 'status' => 403 ) );
        }

        $post_id = wp_insert_post( array(
            'post_type'    => 'mp_update',
            'post_title'   => 'Update for Goal ' . $goal_id,
            'post_content' => wp_kses_post( $params['text'] ),
            'post_status'  => 'publish',
            'post_author'  => get_current_user_id(),
        ) );

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, '_goal_id', $goal_id );
        update_post_meta( $post_id, '_initiative_id', (int) $params['initiativeId'] );

        // Handle attachments
        if ( isset( $params['attachments'] ) && is_array( $params['attachments'] ) ) {
            foreach ( $params['attachments'] as $attachment ) {
                wp_update_post( array( 'ID' => (int) $attachment['id'], 'post_parent' => $post_id ) );
            }
        }

        // Add notification to the batched queue for the other participant
        $goal = get_post( $goal_id );
        if ( $goal ) {
            $mentorship_id = get_post_meta( $goal_id, '_mentorship_id', true );
            if ( $mentorship_id ) {
                $mentorship = get_post( $mentorship_id );
                $current_user_id = get_current_user_id();
                $receiver_id = get_post_meta( $mentorship_id, '_receiver_id', true );
                $sender_id = $mentorship->post_author;
                
                // Determine who to notify (the other person in the mentorship)
                $notify_user_id = ( $current_user_id === (int) $receiver_id ) ? $sender_id : $receiver_id;
                
                if ( $notify_user_id ) {
                    $author = wp_get_current_user();
                    
                    // Get plain text version of the update
                    $update_text = wp_strip_all_tags( $params['text'] );
                    $update_preview = strlen( $update_text ) > 100 ? substr( $update_text, 0, 100 ) . '...' : $update_text;
                    
                    $message = sprintf(
                        'New update on "%s" by %s %s: "%s"',
                        $goal->post_title,
                        $author->first_name,
                        $author->last_name,
                        $update_preview
                    );
                    
                    // Add to batched notification queue
                    add_mentorship_notification( $notify_user_id, $message, home_url() );
                }
            }
        }

        $post = get_post( $post_id );
        $response_data = mentorship_platform_prepare_update_for_api( $post );
        return new WP_REST_Response( $response_data, 201 );
    }
}

if ( ! function_exists( 'mentorship_platform_update_update' ) ) {
    function mentorship_platform_update_update( $request ) {
        $update_id = (int) $request['id'];
        $params = $request->get_json_params();

        wp_update_post( array(
            'ID'           => $update_id,
            'post_content' => wp_kses_post( $params['text'] ),
        ) );

        update_post_meta( $update_id, '_initiative_id', (int) $params['initiativeId'] );

        // Handle attachments
        $existing_attachments = get_attached_media( '', $update_id );
        $existing_attachment_ids = wp_list_pluck( $existing_attachments, 'ID' );
        $incoming_attachment_ids = array_map('intval', wp_list_pluck( $params['attachments'], 'id' ) );

        // Detach attachments that were removed
        $attachments_to_detach = array_diff( $existing_attachment_ids, $incoming_attachment_ids );
        foreach ( $attachments_to_detach as $attach_id ) {
            wp_update_post( array( 'ID' => $attach_id, 'post_parent' => 0 ) );
        }

        // Attach new attachments
        $attachments_to_add = array_diff( $incoming_attachment_ids, $existing_attachment_ids );
        foreach ( $attachments_to_add as $attach_id ) {
            wp_update_post( array( 'ID' => $attach_id, 'post_parent' => $update_id ) );
        }

        $post = get_post( $update_id );
        $response_data = mentorship_platform_prepare_update_for_api( $post );
        return new WP_REST_Response( $response_data, 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_delete_update' ) ) {
    function mentorship_platform_delete_update( $request ) {
        $update_id = (int) $request['id'];

        $post = get_post( $update_id );
        if ( ! $post ) {
            return new WP_Error( 'not_found', 'Update not found.', array( 'status' => 404 ) );
        }

        // Also delete any attachments associated with this update
        $attachments = get_attached_media( '', $update_id );
        foreach ( $attachments as $attachment ) {
            wp_delete_attachment( $attachment->ID, true );
        }

        // Manually delete comments to avoid potential issues with wp_delete_post
        $comments = get_comments( array( 'post_id' => $update_id ) );
        foreach ( $comments as $comment ) {
            wp_delete_comment( $comment->comment_ID, true );
        }

        $result = wp_delete_post( $update_id, true );

        if ( ! $result ) {
            return new WP_Error( 'delete_failed', 'Failed to delete the update.', array( 'status' => 500 ) );
        }

        return new WP_REST_Response( array( 'success' => true, 'id' => $update_id ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_public_portfolio' ) ) {
    /**
     * API Callback: Get public portfolio for a user.
     */
    function mentorship_platform_get_public_portfolio( $request ) {
        $user_id = (int) $request['user_id'];
        $user = get_user_by( 'id', $user_id );

        if ( ! $user ) {
            return new WP_Error( 'user_not_found', 'User not found.', array( 'status' => 404 ) );
        }
        $user_data = mentorship_platform_prepare_user_for_api( $user );

        // Find all 'mp_request' posts where the user is sender or receiver (with reasonable limits)
        $sent_requests = get_posts( array( 'post_type' => 'mp_request', 'posts_per_page' => 100, 'author' => $user_id, 'meta_key' => '_status', 'meta_value' => 'Accepted' ) );
        $received_requests = get_posts( array( 'post_type' => 'mp_request', 'posts_per_page' => 100, 'meta_key' => '_receiver_id', 'meta_value' => $user_id, 'meta_query' => array( array( 'key' => '_status', 'value' => 'Accepted' ) ) ) );
        
        $all_request_ids = wp_list_pluck( array_merge( $sent_requests, $received_requests ), 'ID' );
        $all_request_ids = array_unique( $all_request_ids );

        if ( empty( $all_request_ids ) ) {
            return new WP_REST_Response( array(
                'user'  => $user_data,
                'goals' => array(),
            ), 200 );
        }

        // Find all 'mp_goal' posts linked to these mentorships AND are public (with reasonable limit)
        $goals_query = get_posts( array(
            'post_type'      => 'mp_goal',
            'posts_per_page' => 100,
            'meta_query'     => array(
                'relation' => 'AND',
                array(
                    'key'     => '_mentorship_id',
                    'value'   => $all_request_ids,
                    'compare' => 'IN',
                ),
                array(
                    'key'     => '_is_portfolio',
                    'value'   => true,
                ),
            ),
        ) );

        $formatted_goals = array_map( 'mentorship_platform_prepare_goal_for_api', $goals_query );
        return new WP_REST_Response( array(
            'user'  => $user_data,
            'goals' => $formatted_goals,
        ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_get_portfolio_directory' ) ) {
    /**
     * API Callback: Get all users who are involved in mentorships with public goals.
     * Only shows mentors and mentees who have active, published public goals.
     * Excludes archived users.
     */
    function mentorship_platform_get_portfolio_directory( $request ) {
        global $wpdb;
        $metadata_table = $wpdb->prefix . 'pg_user_metadata';
        $all_user_ids = array();

        error_log( '=== PORTFOLIO DIRECTORY DEBUG START ===' );

        // Find all 'mp_goal' posts that are public and published
        $public_goals = get_posts( array(
            'post_type'      => 'mp_goal',
            'post_status'    => 'publish', // Only published posts
            'posts_per_page' => 500, // Reasonable limit - will paginate if needed
            'fields'         => 'ids',
            'meta_query'     => array(
                array(
                    'key'     => '_is_portfolio',
                    'value'   => true,
                ),
            ),
        ) );

        error_log( 'Found ' . count( $public_goals ) . ' public published goals: ' . print_r( $public_goals, true ) );

        if ( empty( $public_goals ) ) {
            error_log( 'No public goals found, returning empty array' );
            return new WP_REST_Response( array(), 200 );
        }

        // Get the user IDs associated with these public goals
        // Include ONLY the mentee and mentor from the mentorship relationship (not the goal author)
        $goal_user_ids = array();
        
        foreach ( $public_goals as $goal_id ) {
            $goal_post = get_post( $goal_id );
            if ( ! $goal_post ) {
                error_log( 'Goal ID ' . $goal_id . ' not found' );
                continue;
            }
            
            error_log( 'Processing goal ID ' . $goal_id . ', author: ' . $goal_post->post_author );
            
            // Get the mentorship ID to find the actual mentee and mentor
            $mentorship_id = get_post_meta( $goal_id, '_mentorship_id', true );
            error_log( 'Goal ' . $goal_id . ' has mentorship_id: ' . $mentorship_id );
            
            if ( $mentorship_id ) {
                $mentorship = get_post( $mentorship_id );
                if ( $mentorship && $mentorship->post_type === 'mp_request' ) {
                    // The mentorship author is the mentee
                    $mentee_id = $mentorship->post_author;
                    // The receiver is the mentor
                    $mentor_id = get_post_meta( $mentorship_id, '_receiver_id', true );
                    
                    error_log( 'Mentorship ' . $mentorship_id . ' - Mentee: ' . $mentee_id . ', Mentor: ' . $mentor_id );
                    
                    // Add ONLY the mentee and mentor (ignore goal author)
                    if ( $mentee_id ) {
                        $goal_user_ids[] = $mentee_id;
                    }
                    if ( $mentor_id ) {
                        $goal_user_ids[] = $mentor_id;
                    }
                } else {
                    error_log( 'Mentorship ' . $mentorship_id . ' not found or wrong type' );
                }
            }
        }

        // Get unique user IDs
        $all_user_ids = array_unique( $goal_user_ids );
        error_log( 'Unique user IDs from goals: ' . print_r( $all_user_ids, true ) );

        if ( empty( $all_user_ids ) ) {
            error_log( 'No user IDs found from goals, returning empty array' );
            return new WP_REST_Response( array(), 200 );
        }

        // Filter out archived users
        // OPTIMIZED: Single query to fetch all archived statuses instead of N queries
        $active_user_ids = array();
        
        if ( ! empty( $all_user_ids ) ) {
            // Batch fetch archived status for all users in one query
            $placeholders = implode( ',', array_fill( 0, count( $all_user_ids ), '%d' ) );
            $archived_results = $wpdb->get_results( $wpdb->prepare(
                "SELECT user_id, archived FROM {$metadata_table} WHERE user_id IN ({$placeholders})",
                ...$all_user_ids
            ), OBJECT_K );
            
            // Also batch-check which users exist
            $existing_users = get_users( array( 'include' => $all_user_ids, 'fields' => array( 'ID', 'user_login' ) ) );
            $user_lookup = array();
            foreach ( $existing_users as $u ) {
                $user_lookup[ $u->ID ] = $u->user_login;
            }
            
            foreach ( $all_user_ids as $user_id ) {
                if ( ! isset( $user_lookup[ $user_id ] ) ) {
                    error_log( 'User ID ' . $user_id . ' not found, skipping' );
                    continue;
                }
                
                $archived = isset( $archived_results[ $user_id ] ) ? $archived_results[ $user_id ]->archived : null;
                
                error_log( 'User ID ' . $user_id . ' (' . $user_lookup[ $user_id ] . ') - Archived status: ' . ( $archived === null ? 'NULL' : $archived ) );
                
                // Skip if user is archived
                if ( $archived == 1 ) {
                    error_log( 'User ID ' . $user_id . ' is archived, skipping' );
                    continue;
                }
                
                // Include all non-archived users who are mentors or mentees in relationships
                $active_user_ids[] = $user_id;
                error_log( 'User ID ' . $user_id . ' (' . $user_lookup[ $user_id ] . ') added to active list' );
            }
        }

        error_log( 'Final active user IDs: ' . print_r( $active_user_ids, true ) );
        error_log( '=== PORTFOLIO DIRECTORY DEBUG END ===' );

        if ( empty( $active_user_ids ) ) {
            return new WP_REST_Response( array(
                'users' => array(),
                'pagination' => array(
                    'page' => 1,
                    'per_page' => 50,
                    'total' => 0,
                    'total_pages' => 0,
                ),
            ), 200 );
        }

        // Get pagination parameters
        $page = max(1, intval($request->get_param('page') ?: 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50)));
        $offset = ($page - 1) * $per_page;
        $total = count($active_user_ids);
        $total_pages = ceil($total / $per_page);

        // Paginate the user IDs
        $paginated_user_ids = array_slice($active_user_ids, $offset, $per_page);

        // Get user data for paginated IDs
        $users = get_users( array( 'include' => $paginated_user_ids ) );
        $portfolio_users = array_map( 'mentorship_platform_prepare_user_for_api', $users );

        return new WP_REST_Response( array(
            'users' => $portfolio_users,
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => $total_pages,
            ),
        ), 200 );
    }
}

if ( ! function_exists( 'mentorship_platform_upload_file' ) ) {
    /**
     * API Callback: Handle file uploads.
     * 
     * Note: For large video uploads (common from mobile devices), the server must have
     * appropriate PHP settings. Recommended values for .htaccess or php.ini:
     *   upload_max_filesize = 64M
     *   post_max_size = 64M
     *   max_execution_time = 300
     *   max_input_time = 300
     */
    function mentorship_platform_upload_file( $request ) {
        if ( ! function_exists( 'wp_handle_upload' ) ) {
            require_once( ABSPATH . 'wp-admin/includes/file.php' );
        }

        // Get file from the request
        $files = $request->get_file_params();

        if ( empty( $files ) || ! isset( $files['file'] ) ) {
            // Check if this might be a size limit issue
            $content_length = isset( $_SERVER['CONTENT_LENGTH'] ) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
            $max_upload = wp_max_upload_size();
            
            if ( $content_length > 0 && $content_length > $max_upload ) {
                return new WP_Error( 
                    'file_too_large', 
                    sprintf( 
                        'File exceeds the maximum upload size of %s. Please use a smaller file or contact your administrator.',
                        size_format( $max_upload )
                    ), 
                    array( 'status' => 413 ) 
                );
            }
            
            return new WP_Error( 'no_file', 'No file was uploaded. The file may have exceeded server limits.', array( 'status' => 400 ) );
        }

        $file = $files['file'];
        
        // Check for upload errors
        if ( isset( $file['error'] ) && $file['error'] !== UPLOAD_ERR_OK ) {
            $error_messages = array(
                UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit. Try a smaller file or lower video quality.',
                UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit.',
                UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded. Please try again.',
                UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
                UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error (missing temp folder).',
                UPLOAD_ERR_CANT_WRITE => 'Server configuration error (failed to write file).',
                UPLOAD_ERR_EXTENSION  => 'Upload blocked by server extension.',
            );
            $error_msg = isset( $error_messages[ $file['error'] ] ) 
                ? $error_messages[ $file['error'] ] 
                : 'Unknown upload error (code: ' . $file['error'] . ')';
            
            return new WP_Error( 'upload_error', $error_msg, array( 'status' => 400 ) );
        }
        
        // Check file size against WordPress limit
        $max_upload = wp_max_upload_size();
        if ( $file['size'] > $max_upload ) {
            return new WP_Error( 
                'file_too_large', 
                sprintf( 
                    'File size (%s) exceeds the maximum upload size of %s. Please use a smaller file.',
                    size_format( $file['size'] ),
                    size_format( $max_upload )
                ), 
                array( 'status' => 413 ) 
            );
        }
        
        // Allow common image, video, and document formats
        $upload_overrides = array( 
            'test_form' => false,
            'mimes' => array(
                // Images
                'jpg|jpeg|jpe' => 'image/jpeg',
                'gif' => 'image/gif',
                'png' => 'image/png',
                'webp' => 'image/webp',
                'svg' => 'image/svg+xml',
                'heic' => 'image/heic',
                // Videos
                'mp4' => 'video/mp4',
                'mov' => 'video/quicktime',
                'avi' => 'video/x-msvideo',
                'wmv' => 'video/x-ms-wmv',
                'webm' => 'video/webm',
                'mkv' => 'video/x-matroska',
                '3gp' => 'video/3gpp',  // Common Android format
                '3g2' => 'video/3gpp2', // Common Android format
                // Documents
                'pdf' => 'application/pdf',
                'doc' => 'application/msword',
                'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls' => 'application/vnd.ms-excel',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'ppt' => 'application/vnd.ms-powerpoint',
                'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'txt' => 'text/plain',
                'csv' => 'text/csv',
                'zip' => 'application/zip',
            )
        );
        
        $movefile = wp_handle_upload( $file, $upload_overrides );

        if ( $movefile && ! isset( $movefile['error'] ) ) {
            $attachment = array(
                'guid'           => $movefile['url'],
                'post_mime_type' => $movefile['type'],
                'post_title'     => preg_replace( '/\.[^.]+$/', '', basename( $file['name'] ) ),
                'post_content'   => '',
                'post_status'    => 'inherit',
            );

            $attach_id = wp_insert_attachment( $attachment, $movefile['file'] );
            require_once( ABSPATH . 'wp-admin/includes/image.php' );
            $attach_data = wp_generate_attachment_metadata( $attach_id, $movefile['file'] );
            wp_update_attachment_metadata( $attach_id, $attach_data );

            // Prepare response to match Attachment type
            $response_data = array(
                'id'       => (string) $attach_id, // Cast ID to string
                'fileName' => basename( $file['name'] ),
                'fileType' => $movefile['type'],
                'url'      => $movefile['url'],
            );
            
            return new WP_REST_Response( $response_data, 201 );
        } else {
            return new WP_Error( 'upload_error', $movefile['error'], array( 'status' => 500 ) );
        }
    }
}

function update_mentorship_status($request) {
    $request_id = intval($request['id']);
    $new_status = sanitize_text_field($request['status']);
    $user_id = get_current_user_id();

    $request_post = get_post($request_id);

    if (!$request_post || $request_post->post_type !== 'mp_request') {
        return new WP_Error('not_found', 'Mentorship request not found.', array('status' => 404));
    }

    // Check if the current user is the recipient (mentor) of this request
    $receiver_id = get_post_meta($request_id, '_receiver_id', true);
    if ($user_id != $receiver_id) {
        return new WP_Error('forbidden', 'You do not have permission to modify this request.', array('status' => 403));
    }

    // Update the post meta status
    update_post_meta($request_id, '_status', $new_status);

    // Return the updated mentorship request object
    $mentorship_request = mentorship_platform_prepare_request_for_api(get_post($request_id));
    return new WP_REST_Response($mentorship_request, 200);
}

/**
 * Admin-only function to get all mentorship requests.
 */
function get_all_mentorships_admin($request) {
    // Pagination parameters
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50))); // Default 50, max 100
    
    // First get total count
    $count_query = new WP_Query(array(
        'post_type' => 'mp_request',
        'posts_per_page' => 1,
        'post_status' => array('publish'),
        'fields' => 'ids',
    ));
    $total = $count_query->found_posts;
    $total_pages = ceil($total / $per_page);
    
    // Now get paginated results
    $all_requests_query = new WP_Query(array(
        'post_type' => 'mp_request',
        'posts_per_page' => $per_page,
        'paged' => $page,
        'post_status' => array('publish'),
    ));

    $mentorships = array();
    foreach ($all_requests_query->posts as $post) {
        $formatted = mentorship_platform_prepare_request_for_api($post);
        // Skip entries with missing sender/receiver (null returns from prepare function)
        if ( $formatted !== null ) {
            $mentorships[] = $formatted;
        }
    }

    return new WP_REST_Response(array(
        'mentorships' => $mentorships,
        'pagination' => array(
            'page' => $page,
            'per_page' => $per_page,
            'total' => $total,
            'total_pages' => $total_pages,
        ),
    ), 200);
}

/**
 * Admin-only function to get details for ANY mentorship request.
 * This bypasses the check that the user must be a participant.
 */
function get_mentorship_details_admin($request) {
    $mentorship_id = intval($request['id']);

    $post = get_post($mentorship_id);
    if (!$post || $post->post_type !== 'mp_request') {
        return new WP_Error('not_found', 'Mentorship request not found.', array('status' => 404));
    }

    // We are admin, so we just get the object directly
    $mentorship_details = mentorship_platform_prepare_request_for_api($post);

    if ( ! $mentorship_details ) {
        return new WP_Error( 'not_found', 'Mentorship request details could not be prepared.', array( 'status' => 404 ) );
    }

    return new WP_REST_Response($mentorship_details, 200);
}

/**
 * Admin-only function to get all users.
 */
function get_all_users_admin($request) {
    try {
        // Check if current user is an administrator
        $current_user_is_admin = current_user_can('manage_options');
        
        // Get all users - fetch full user objects for reliability
        $users = get_users(array(
            'fields' => 'all',
        ));

        $formatted_users = array();
        foreach ($users as $user_data) {
            // Skip if user data not found or invalid
            if (!$user_data || !isset($user_data->ID)) {
                continue;
            }
            
            $user_id = $user_data->ID;
            
            // Skip administrators unless current user is also an admin
            if (!$current_user_is_admin && in_array('administrator', $user_data->roles)) {
                continue;
            }
            
            $first_name = get_user_meta($user_id, 'first_name', true);
            $last_name = get_user_meta($user_id, 'last_name', true);
            
            // Fallback to display_name if first/last name not set
            if (empty($first_name) && empty($last_name)) {
                $display_name = $user_data->display_name;
            } else {
                $display_name = trim($last_name . ', ' . $first_name);
            }
            
            $formatted_users[] = array(
                'id' => $user_id,
                'name' => $display_name,
                'last_name' => $last_name,
                'first_name' => $first_name,
            );
        }
        
        // Sort by last name, then first name
        usort($formatted_users, function($a, $b) {
            $last_cmp = strcasecmp($a['last_name'], $b['last_name']);
            if ($last_cmp !== 0) {
                return $last_cmp;
            }
            return strcasecmp($a['first_name'], $b['first_name']);
        });

        return new WP_REST_Response($formatted_users, 200);
    } catch (Exception $e) {
        error_log('Error in get_all_users_admin: ' . $e->getMessage());
        return new WP_Error('server_error', 'Failed to fetch users: ' . $e->getMessage(), array('status' => 500));
    }
}

/**
 * Admin-only function to create a new, approved mentorship.
 */
function create_mentorship_admin($request) {
	$mentor_id = intval( $request['mentor_id'] );
	$mentee_id = intval( $request['mentee_id'] );

	if ( $mentor_id === $mentee_id ) {
		return new WP_Error( 'bad_request', 'Mentor and mentee cannot be the same person.', array( 'status' => 400 ) );
	}

	// Create the mentorship request post
	$post_id = wp_insert_post( array(
		'post_type'   => 'mp_request',
		'post_title'  => 'Admin Created Relationship',
		'post_status' => 'publish', // CPTs use 'publish'
		'post_author' => $mentee_id, // Assign the mentee as the author
	) );

	if ( is_wp_error( $post_id ) ) {
		return $post_id;
	}

	// Set receiver and status using the correct meta keys
	update_post_meta( $post_id, '_receiver_id', $mentor_id );
	update_post_meta( $post_id, '_status', 'Accepted' ); // Auto-approve status

	// Return the new mentorship object
	$response_data = mentorship_platform_prepare_request_for_api( get_post( $post_id ) );
	return new WP_REST_Response( $response_data, 201 );
}

/**
 * Get all users who are mentors and have at least one public portfolio goal.
 */
function get_portfolio_directory($request) {
    // Pagination parameters
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50))); // Default 50, max 100
    
    // 1. Get all 'mp_goal' posts that are public (just IDs for efficiency)
    $public_goals_query = new WP_Query(array(
        'post_type' => 'mp_goal',
        'posts_per_page' => -1, // Need all to get unique authors
        'meta_query' => array(
            array(
                'key' => '_is_portfolio',
                'value' => '1',
            )
        ),
        'fields' => 'ids',
    ));

    if (empty($public_goals_query->posts)) {
        return new WP_REST_Response(array(
            'users' => array(),
            'pagination' => array(
                'page' => $page,
                'per_page' => $per_page,
                'total' => 0,
                'total_pages' => 0,
            ),
        ), 200);
    }

    // 2. Get unique author IDs from these goals
    $author_ids = array();
    foreach ($public_goals_query->posts as $post_id) {
        $author_ids[] = get_post_field('post_author', $post_id);
    }
    $author_ids = array_unique($author_ids);
    
    // Calculate pagination
    $total = count($author_ids);
    $total_pages = ceil($total / $per_page);
    $offset = ($page - 1) * $per_page;
    
    // Slice for current page
    $paged_author_ids = array_slice($author_ids, $offset, $per_page);

    $users_with_public_goals = array();

    // 3. Get user data for these authors (paged)
    foreach ($paged_author_ids as $user_id) {
        $user = get_user_by('id', $user_id);
        if ($user) {
            $user_data = mentorship_platform_prepare_user_for_api($user);
            $users_with_public_goals[] = $user_data;
        }
    }

    return new WP_REST_Response(array(
        'users' => $users_with_public_goals,
        'pagination' => array(
            'page' => $page,
            'per_page' => $per_page,
            'total' => $total,
            'total_pages' => $total_pages,
        ),
    ), 200);
}

/**
 * Get basic user list for forms (public endpoint for logged-in users)
 * Returns: user_id, display_name, first_name, last_name, archived, is_member
 * Email only returned for Tier 4+ users (management)
 * Used for: In-service attendance, scan audit user selection, live drill staff selection
 * 
 * SERVER-SIDE CACHING: Results are cached for 15 minutes using WordPress transients
 * Cache is automatically invalidated when users are created/updated/deleted
 * 
 * Filters:
 * - archived: 'true', 'false', or 'all' (default: 'false')
 * - member: 'true', 'false', or 'all' (default: 'true' - only members)
 */
function mentorship_platform_get_user_list($request) {
    global $wpdb;
    
    // Get archived filter (default: only active users)
    $archived_param = $request->get_param('archived');
    $archived_key = $archived_param === 'true' ? 'archived' : ($archived_param === 'all' ? 'all' : 'active');
    
    // Get member filter (default: only members)
    $member_param = $request->get_param('member');
    $member_key = $member_param === 'false' ? 'nonmember' : ($member_param === 'all' ? 'all' : 'member');
    
    // Determine if user can see email addresses
    $can_see_email = current_user_can('manage_options');
    if (!$can_see_email && function_exists('mp_get_user_highest_tier')) {
        $user_tier = mp_get_user_highest_tier(get_current_user_id());
        $can_see_email = $user_tier >= 4; // Tier 4+ (management) can see emails
    }
    
    // Cache key includes archived filter, member filter, and email visibility
    $cache_key = 'mp_user_list_' . $archived_key . '_' . $member_key . '_' . ($can_see_email ? 'email' : 'noemail');
    
    // Check for force refresh parameter
    $force_refresh = $request->get_param('refresh') === 'true';
    
    // Try to get from cache (15 minute expiry)
    if (!$force_refresh) {
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            $response = rest_ensure_response($cached);
            $response->header('X-Cache-Status', 'HIT');
            // Add HTTP cache headers (15 min browser cache, user-specific)
            if (function_exists('mp_add_cache_headers')) {
                $response = mp_add_cache_headers($response, 900, 120, true);
            }
            return $response;
        }
    }
    
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Rate limiting for bulk queries
    if (function_exists('mp_check_rate_limit')) {
        $rate_check = mp_check_rate_limit('/users/list', 30, 60);
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }
    }
    
    $archived = $archived_param === 'true' ? 1 : 0;
    $where_archived = $archived_param === 'all' ? '' : "AND COALESCE(m.archived, 0) = $archived";
    
    // Build member filter
    // Members are determined by: explicit is_member=1, OR has active job role assignments
    // Non-members: explicit is_member=0, OR (is_member IS NULL AND no job role assignments)
    $where_member = '';
    if ($member_param === 'true' || $member_param === null || $member_param === '') {
        // Only members: is_member=1 OR has job roles
        $where_member = "AND (
            m.is_member = 1 
            OR (m.is_member IS NULL AND EXISTS (
                SELECT 1 FROM {$assignments_table} ja 
                WHERE ja.user_id = u.ID 
                AND (ja.end_date IS NULL OR ja.end_date >= CURDATE())
            ))
        )";
    } elseif ($member_param === 'false') {
        // Only non-members: is_member=0 OR (is_member IS NULL AND no job roles)
        $where_member = "AND (
            m.is_member = 0 
            OR (m.is_member IS NULL AND NOT EXISTS (
                SELECT 1 FROM {$assignments_table} ja 
                WHERE ja.user_id = u.ID 
                AND (ja.end_date IS NULL OR ja.end_date >= CURDATE())
            ))
        )";
    }
    // 'all' = no member filter
    
    // Increase GROUP_CONCAT limit to prevent truncation
    $wpdb->query("SET SESSION group_concat_max_len = 10000");
    
    // Only include email in query if user can see it
    $email_select = $can_see_email ? "u.user_email," : "";
    
    $query = "
        SELECT 
            u.ID as user_id,
            u.display_name,
            {$email_select}
            COALESCE(m.archived, 0) as archived,
            m.is_member,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            GROUP_CONCAT(DISTINCT a.job_role_id ORDER BY r.tier DESC SEPARATOR ',') as job_role_ids,
            GROUP_CONCAT(DISTINCT r.title ORDER BY r.tier DESC SEPARATOR ', ') as job_role_titles,
            MAX(r.tier) as tier
        FROM {$wpdb->users} u
        LEFT JOIN {$metadata_table} m ON u.ID = m.user_id
        LEFT JOIN {$assignments_table} a ON u.ID = a.user_id AND (a.end_date IS NULL OR a.end_date >= CURDATE())
        LEFT JOIN {$roles_table} r ON a.job_role_id = r.id
        WHERE 1=1
        {$where_archived}
        {$where_member}
        GROUP BY u.ID
        ORDER BY u.display_name ASC
    ";
    
    $users = $wpdb->get_results($query, ARRAY_A);
    
    if ($wpdb->last_error) {
        return new WP_Error('database_error', $wpdb->last_error, array('status' => 500));
    }
    
    // Log PII access if fetching multiple users
    if (function_exists('mp_log_pii_access') && count($users) > 1) {
        mp_log_pii_access('user_list', array_column($users, 'user_id'), '/users/list');
    }
    
    // Process users: cast numeric fields and archived to boolean for proper JSON typing
    foreach ($users as &$user) {
        $user['user_id'] = (int) $user['user_id'];  // Ensure integer for JS comparison
        $user['archived'] = (bool) $user['archived'];
        $user['tier'] = $user['tier'] ? (int) $user['tier'] : null;
        
        // Build clean display_name from first_name and last_name to avoid WordPress username conflicts (e.g., "John Doe0")
        // Always use first_name and last_name if available, even if one is empty
        $first_name = trim($user['first_name'] ?? '');
        $last_name = trim($user['last_name'] ?? '');
        if ($first_name || $last_name) {
            // Build name and strip any trailing digits that WordPress may have added
            $display_name = trim($first_name . ' ' . $last_name);
            $display_name = preg_replace('/\d+$/', '', $display_name);
            $display_name = trim($display_name);
            $user['display_name'] = $display_name ?: ($user['display_name'] ?? '');
        }
        
        // Set single job_role_id and job_role_title from the comma-separated lists (highest tier first)
        if (!empty($user['job_role_ids'])) {
            $role_ids = explode(',', $user['job_role_ids']);
            $role_titles = explode(', ', $user['job_role_titles']);
            $user['job_role_id'] = (int) $role_ids[0];
            $user['job_role_title'] = $role_titles[0];
        }
    }
    
    // Cache the results for 15 minutes
    set_transient($cache_key, $users, 15 * MINUTE_IN_SECONDS);
    
    $response = rest_ensure_response($users);
    $response->header('X-Cache-Status', 'MISS');
    // Add HTTP cache headers (15 min browser cache, user-specific)
    if (function_exists('mp_add_cache_headers')) {
        $response = mp_add_cache_headers($response, 900, 120, true);
    }
    return $response;
}

/**
 * Invalidate user list cache when users are modified
 * Called by hooks when users are created, updated, deleted, or archived
 * 
 * @deprecated Use mp_invalidate_user_caches() from security-helpers.php instead
 * This function now delegates to the centralized cache invalidation system
 */
function mentorship_platform_invalidate_user_cache($user_id = null) {
    // Delegate to centralized function
    if (function_exists('mp_invalidate_user_caches')) {
        mp_invalidate_user_caches($user_id);
    }
}

// Note: WordPress user hooks are now handled centrally in security-helpers.php
// These are kept for backwards compatibility only
add_action('wp_insert_user_data', 'mentorship_platform_invalidate_user_cache');
// Also invalidate when job role assignments change
add_action('updated_user_meta', function($meta_id, $user_id, $meta_key) {
    if (in_array($meta_key, ['first_name', 'last_name'])) {
        mentorship_platform_invalidate_user_cache($user_id);
    }
}, 10, 3);

/**
 * Get users with metadata (archived filter support)
 * 
 * Filters:
 * - archived: 'true', 'false', or 'all' (default: 'false')
 * - member: 'true', 'false', or 'all' (default: 'all' for admin view)
 */
function mentorship_platform_get_users_with_metadata($request) {
    global $wpdb;
    
    // --- SELF-HEALING: Check for is_member column ---
    // This handles cases where the migration didn't run effectively
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Check transient first to avoid overhead on every request
    if (false === get_transient('mp_is_member_col_checked_v2')) {
        // Fix 1: pg_user_metadata.is_member
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$metadata_table} LIKE 'is_member'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$metadata_table} ADD COLUMN is_member TINYINT(1) DEFAULT NULL");
            $wpdb->query("ALTER TABLE {$metadata_table} ADD INDEX idx_is_member (is_member)");
            error_log("[API HEALING] Added missing is_member column to {$metadata_table}");
        }
        
        // Fix 2: pg_user_job_assignments.end_date
        $col_assign = $wpdb->get_results("SHOW COLUMNS FROM {$assignments_table} LIKE 'end_date'");
        if (empty($col_assign)) {
             $wpdb->query("ALTER TABLE {$assignments_table} ADD COLUMN end_date DATE DEFAULT NULL");
             $wpdb->query("ALTER TABLE {$assignments_table} ADD INDEX idx_end_date (end_date)");
             error_log("[API HEALING] Added missing end_date column to {$assignments_table}");
        }
        
        set_transient('mp_is_member_col_checked_v2', true, DAY_IN_SECONDS);
    }
    // ------------------------------------------------

    error_log('=== USERS LIST API CALLED ===');
    
    // Check if current user is an administrator
    $current_user_is_admin = current_user_can('manage_options');
    
    $archived = $request->get_param('archived');
    $search = $request->get_param('search');
    $member_param = $request->get_param('member');
    
    error_log('Archived param: ' . $archived);
    error_log('Search param: ' . $search);
    error_log('Member param: ' . $member_param);
    
    // Pagination parameters
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(10000, intval($request->get_param('per_page') ?: 50))); // Default 50, max 10000
    $offset = ($page - 1) * $per_page;
    
    // Fields to return (for optimization)
    $fields = $request->get_param('fields'); // Can be 'basic' for minimal fields
    
    // Build WHERE clause for archived filter
    $where_archived = '';
    if ($archived === 'true') {
        $where_archived = "AND (m.archived = 1)";
    } elseif ($archived === 'false' || $archived === null) {
        $where_archived = "AND (m.archived IS NULL OR m.archived = 0)";
    }
    
    // Build WHERE clause for search
    $where_search = '';
    if (!empty($search)) {
        $search_term = '%' . $wpdb->esc_like($search) . '%';
        $where_search = $wpdb->prepare(
            "AND (u.display_name LIKE %s OR u.user_email LIKE %s OR m.employee_id LIKE %s)",
            $search_term, $search_term, $search_term
        );
    }
    
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Build WHERE clause for member filter
    // Default is 'all' for admin view (show everyone)
    $where_member = '';
    if ($member_param === 'true') {
        // Only members: is_member=1 OR has job roles
        $where_member = "AND (
            m.is_member = 1 
            OR (m.is_member IS NULL AND EXISTS (
                SELECT 1 FROM {$assignments_table} ja 
                WHERE ja.user_id = u.ID 
                AND (ja.end_date IS NULL OR ja.end_date >= CURDATE())
            ))
        )";
    } elseif ($member_param === 'false') {
        // Only non-members: is_member=0 OR (is_member IS NULL AND no job roles)
        $where_member = "AND (
            m.is_member = 0 
            OR ((m.is_member IS NULL OR m.is_member = 0) AND NOT EXISTS (
                SELECT 1 FROM {$assignments_table} ja 
                WHERE ja.user_id = u.ID 
                AND (ja.end_date IS NULL OR ja.end_date >= CURDATE())
            ))
        )";
    }
    // 'all' or null = no member filter (show all)
    
    // Select only necessary fields based on request
    if ($fields === 'basic') {
        // Minimal fields for compliance table
        $select_fields = "
            u.ID as user_id,
            u.display_name,
            GROUP_CONCAT(DISTINCT a.job_role_id ORDER BY r.tier DESC SEPARATOR ',') as job_role_ids,
            GROUP_CONCAT(DISTINCT r.title ORDER BY r.tier DESC SEPARATOR ', ') as job_role_titles,
            MAX(r.tier) as tier,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
        ";
    } else {
        // Full fields for other uses
        $select_fields = "
            u.ID as user_id,
            u.display_name,
            u.user_email,
            u.user_registered,
            m.phone_number,
            m.employee_id,
            m.hire_date,
            m.notes,
            COALESCE(m.archived, 0) as archived,
            m.archived_date,
            COALESCE(m.eligible_for_rehire, 1) as eligible_for_rehire,
            m.is_member,
            GROUP_CONCAT(DISTINCT a.job_role_id ORDER BY r.tier DESC SEPARATOR ',') as job_role_ids,
            GROUP_CONCAT(DISTINCT r.title ORDER BY r.tier DESC SEPARATOR ', ') as job_role_titles,
            MAX(r.tier) as tier,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_login' LIMIT 1) as last_login,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name,
            (SELECT COALESCE(meta_value, '0') FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'aquaticpro_is_new_hire' LIMIT 1) as is_new_hire,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'address' LIMIT 1) as address
        ";
    }
    
    // Get total count for pagination
    $count_query = "
        SELECT COUNT(DISTINCT u.ID)
        FROM {$wpdb->users} u
        LEFT JOIN {$metadata_table} m ON u.ID = m.user_id
        WHERE 1=1
        {$where_archived}
        {$where_search}
        {$where_member}
    ";
    $total_users = $wpdb->get_var($count_query);
    
    // Debug: Check if assignments table has data
    $assignment_count = $wpdb->get_var("SELECT COUNT(*) FROM {$assignments_table}");
    error_log("Total job assignments in database: " . $assignment_count);
    
    $sample_assignment = $wpdb->get_row("SELECT * FROM {$assignments_table} LIMIT 1", ARRAY_A);
    error_log("Sample assignment: " . print_r($sample_assignment, true));
    
    // Disable ONLY_FULL_GROUP_BY for this query and increase GROUP_CONCAT limit
    $wpdb->query("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");
    $wpdb->query("SET SESSION group_concat_max_len = 10000");
    
    $query = "
        SELECT {$select_fields}
        FROM {$wpdb->users} u
        LEFT JOIN {$metadata_table} m ON u.ID = m.user_id
        LEFT JOIN {$assignments_table} a ON u.ID = a.user_id
        LEFT JOIN {$roles_table} r ON a.job_role_id = r.id
        WHERE 1=1
        {$where_archived}
        {$where_search}
        {$where_member}
        GROUP BY u.ID
        ORDER BY last_name ASC, first_name ASC
        LIMIT %d OFFSET %d
    ";
    
    $query = $wpdb->prepare($query, $per_page, $offset);
    
    // Log the actual query being executed
    error_log('=== USERS LIST QUERY ===');
    error_log($query);
    
    $users = $wpdb->get_results($query, ARRAY_A);
    
    // Check for database errors
    if ($wpdb->last_error) {
        error_log('DATABASE ERROR: ' . $wpdb->last_error);
        return new WP_Error('database_error', $wpdb->last_error, array('status' => 500));
    }
    
    // Debug: Log first user to see what fields are returned
    if (!empty($users)) {
        error_log('=== FIRST USER RAW DATA FROM DB ===');
        error_log(print_r($users[0], true));
        error_log('Total users returned: ' . count($users));
        
        // Check if any users have role data
        $users_with_roles = array_filter($users, function($u) {
            return !empty($u['job_role_ids']);
        });
        error_log('Users with role assignments: ' . count($users_with_roles));
        
        // Check what keys exist in first user
        error_log('Keys in first user: ' . implode(', ', array_keys($users[0])));
    } else {
        error_log('ERROR: No users returned from query');
    }
    
    // Process the results to handle multiple roles and cast archived
    $filtered_users = array();
    foreach ($users as $user) {
        // Get user data to check roles
        $user_data = get_userdata($user['user_id']);
        
        // Skip administrators unless current user is also an admin
        if (!$current_user_is_admin && $user_data && in_array('administrator', $user_data->roles)) {
            continue;
        }
        
        // Build clean display_name from first_name and last_name to avoid WordPress username conflicts (e.g., "John Doe0")
        // Always use first_name and last_name if available, even if one is empty
        $first_name = trim($user['first_name'] ?? '');
        $last_name = trim($user['last_name'] ?? '');
        if ($first_name || $last_name) {
            $user['display_name'] = trim($first_name . ' ' . $last_name);
        }
        
        // Only set archived field if it exists in the result
        if (isset($user['archived'])) {
            $user['archived'] = (int) $user['archived'];
        }
        
        // For backward compatibility, set job_role_id to the first (highest tier) role
        if (!empty($user['job_role_ids'])) {
            $role_ids = explode(',', $user['job_role_ids']);
            $user['job_role_id'] = (int) $role_ids[0];
        } else {
            $user['job_role_id'] = null;
        }
        
        // Set job_role_title to show all roles or the primary one
        if (!empty($user['job_role_titles'])) {
            $user['job_role_title'] = $user['job_role_titles'];
        } else {
            $user['job_role_title'] = null;
        }
        
        $filtered_users[] = $user;
    }
    
    // Prepare pagination response
    $total_pages = ceil($total_users / $per_page);
    
    $response = new WP_REST_Response($filtered_users, 200);
    
    // Add pagination headers
    $response->header('X-WP-Total', $total_users);
    $response->header('X-WP-TotalPages', $total_pages);
    $response->header('X-WP-Page', $page);
    $response->header('X-WP-PerPage', $per_page);
    
    return $response;
}

/**
 * Create a new user with metadata
 */
function mentorship_platform_create_user($request) {
    global $wpdb;
    
    $first_name = sanitize_text_field($request->get_param('first_name'));
    $last_name = sanitize_text_field($request->get_param('last_name'));
    $email = sanitize_email($request->get_param('email'));
    $phone_number = sanitize_text_field($request->get_param('phone_number'));
    $employee_id = sanitize_text_field($request->get_param('employee_id'));
    $hire_date = sanitize_text_field($request->get_param('hire_date'));
    $notes = sanitize_textarea_field($request->get_param('notes'));
    $job_role_id = intval($request->get_param('job_role_id'));
    $send_email = filter_var($request->get_param('send_email'), FILTER_VALIDATE_BOOLEAN);
    $address = sanitize_textarea_field($request->get_param('address'));
    $is_new_hire = $request->get_param('is_new_hire');
    $wp_role = sanitize_text_field($request->get_param('wp_role'));
    if (empty($wp_role)) {
        $wp_role = 'subscriber';
    }
    
    // Validate required fields
    if (empty($first_name) || empty($last_name) || empty($email)) {
        return new WP_Error('missing_fields', 'First name, last name, and email are required', array('status' => 400));
    }
    
    // Check if email already exists
    if (email_exists($email)) {
        return new WP_Error('email_exists', 'A user with this email already exists', array('status' => 400));
    }
    
    // Generate username from first and last name
    $username = strtolower($first_name . '.' . $last_name);
    $username = sanitize_user($username);
    
    // Make username unique if it already exists
    $base_username = $username;
    $counter = 1;
    while (username_exists($username)) {
        $username = $base_username . $counter;
        $counter++;
    }
    
    // Generate random password
    $password = wp_generate_password(12, true, true);
    
    // Create the user
    $user_id = wp_create_user($username, $password, $email);
    
    if (is_wp_error($user_id)) {
        return $user_id;
    }
    
    // Update user meta
    $display_name = trim($first_name . ' ' . $last_name);
    if (empty($display_name)) {
        $display_name = $email; // Fallback to email if no name
    }
    
    wp_update_user(array(
        'ID' => $user_id,
        'first_name' => $first_name,
        'last_name' => $last_name,
        'display_name' => $display_name,
        'role' => $wp_role
    ));
    
    // Insert metadata
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    $metadata = array(
        'user_id' => $user_id,
        'phone_number' => $phone_number,
        'employee_id' => $employee_id,
        'notes' => $notes,
        'archived' => 0,
    );
    
    $format = array('%d', '%s', '%s', '%s', '%d');
    
    if (!empty($hire_date)) {
        $metadata['hire_date'] = $hire_date;
        // Insert hire_date before notes in the format array
        array_splice($format, 3, 0, '%s');
    }
    
    $wpdb->insert($metadata_table, $metadata, $format);
    
    // Save address and is_new_hire as user meta
    if ( ! empty( $address ) ) {
        update_user_meta( $user_id, 'address', $address );
    }
    if ( $is_new_hire !== null ) {
        update_user_meta( $user_id, 'aquaticpro_is_new_hire', $is_new_hire ? 1 : 0 );
    }

    // If marked as new hire, also insert into new hires table
    if ( $is_new_hire ) {
        $new_hires_table = $wpdb->prefix . 'aquaticpro_new_hires';
        $existing_nh = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$new_hires_table} WHERE email = %s AND status IN ('pending','approved') LIMIT 1",
            $email
        ) );
        if ( ! $existing_nh ) {
            $wpdb->insert(
                $new_hires_table,
                array(
                    'first_name'   => $first_name,
                    'last_name'    => $last_name,
                    'email'        => $email,
                    'phone'        => $phone_number,
                    'address'      => $address,
                    'position'     => '',
                    'is_accepting' => 1,
                    'status'       => 'pending',
                    'wp_user_id'   => $user_id,
                ),
                array( '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%d' )
            );
        }
    }
    
    // Assign job role if provided
    if ($job_role_id > 0) {
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $wpdb->insert(
            $assignments_table,
            array(
                'user_id' => $user_id,
                'job_role_id' => $job_role_id,
                'assigned_by' => get_current_user_id(),
                'sync_wp_role' => 1,
            ),
            array('%d', '%d', '%d', '%d')
        );
    }
    
    // Send welcome email if requested
    if ($send_email) {
        wp_new_user_notification($user_id, null, 'both');
        
        // Also send custom email with credentials
        $subject = 'Welcome to ' . get_bloginfo('name');
        $message = "Hello {$first_name},\n\n";
        $message .= "Your account has been created!\n\n";
        $message .= "Username: {$username}\n";
        $message .= "Password: {$password}\n\n";
        $message .= "Login URL: " . wp_login_url() . "\n\n";
        $message .= "Please change your password after your first login.\n\n";
        $message .= "Best regards,\n";
        $message .= get_bloginfo('name');
        
        wp_mail($email, $subject, $message);
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'user_id' => $user_id,
        'username' => $username,
        'password' => $password,
        'message' => 'User created successfully'
    ), 201);
}

/**
 * Update user and metadata (Admin User Management)
 */
function mentorship_platform_admin_update_user($request) {
    global $wpdb;
    
    $user_id = intval($request->get_param('id'));
    $first_name = sanitize_text_field($request->get_param('first_name'));
    $last_name = sanitize_text_field($request->get_param('last_name'));
    $email = sanitize_email($request->get_param('email'));
    $phone_number = sanitize_text_field($request->get_param('phone_number'));
    $employee_id = sanitize_text_field($request->get_param('employee_id'));
    $hire_date = sanitize_text_field($request->get_param('hire_date'));
    $notes = sanitize_textarea_field($request->get_param('notes'));
    $eligible_for_rehire = rest_sanitize_boolean($request->get_param('eligible_for_rehire'));
    $wp_role = sanitize_text_field($request->get_param('wp_role'));
    $job_role_id = intval($request->get_param('job_role_id'));
    $address = sanitize_textarea_field($request->get_param('address'));
    $is_new_hire = $request->get_param('is_new_hire');
    
    // Validate user exists
    $user = get_user_by('id', $user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found', array('status' => 404));
    }
    
    // Update WordPress user
    $user_data = array('ID' => $user_id);
    
    if (!empty($first_name)) {
        $user_data['first_name'] = $first_name;
    }
    if (!empty($last_name)) {
        $user_data['last_name'] = $last_name;
    }
    if (!empty($first_name) || !empty($last_name)) {
        $display_name = trim($first_name . ' ' . $last_name);
        if (!empty($display_name)) {
            $user_data['display_name'] = $display_name;
        }
    }
    if (!empty($email) && $email !== $user->user_email) {
        if (email_exists($email)) {
            return new WP_Error('email_exists', 'Email already in use', array('status' => 400));
        }
        $user_data['user_email'] = $email;
    }
    if (!empty($wp_role)) {
        $user_data['role'] = $wp_role;
    }
    
    wp_update_user($user_data);
    
    // Update metadata
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    // Check if metadata row exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$metadata_table} WHERE user_id = %d",
        $user_id
    ));
    
    if ($exists) {
        $wpdb->update(
            $metadata_table,
            array(
                'phone_number' => $phone_number,
                'employee_id' => $employee_id,
                'hire_date' => $hire_date ? $hire_date : null,
                'notes' => $notes,
                'eligible_for_rehire' => $eligible_for_rehire ? 1 : 0,
            ),
            array('user_id' => $user_id),
            array('%s', '%s', '%s', '%s', '%d'),
            array('%d')
        );
    } else {
        $wpdb->insert(
            $metadata_table,
            array(
                'user_id' => $user_id,
                'phone_number' => $phone_number,
                'employee_id' => $employee_id,
                'hire_date' => $hire_date ? $hire_date : null,
                'notes' => $notes,
                'eligible_for_rehire' => $eligible_for_rehire ? 1 : 0,
                'archived' => 0,
            ),
            array('%d', '%s', '%s', '%s', '%s', '%d', '%d')
        );
    }
    
    // Update address and is_new_hire user meta
    if ( $address !== null ) {
        update_user_meta( $user_id, 'address', $address );
    }
    if ( $is_new_hire !== null ) {
        update_user_meta( $user_id, 'aquaticpro_is_new_hire', $is_new_hire ? 1 : 0 );
    }

    // If marking as new hire, also insert into new hires table if not already there
    if ( $is_new_hire ) {
        $new_hires_table = $wpdb->prefix . 'aquaticpro_new_hires';
        $user_email = $user->user_email;
        $existing_nh = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$new_hires_table} WHERE (email = %s OR wp_user_id = %d) AND status IN ('pending','approved') LIMIT 1",
            $user_email, $user_id
        ) );
        if ( ! $existing_nh ) {
            $wpdb->insert(
                $new_hires_table,
                array(
                    'first_name'   => $first_name ?: $user->first_name,
                    'last_name'    => $last_name ?: $user->last_name,
                    'email'        => $user_email,
                    'phone'        => $phone_number,
                    'address'      => $address ?: get_user_meta( $user_id, 'address', true ),
                    'position'     => '',
                    'is_accepting' => 1,
                    'status'       => 'pending',
                    'wp_user_id'   => $user_id,
                ),
                array( '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%d' )
            );
        }
    }
    
    // Update job role assignment if provided
    if ($job_role_id > 0) {
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        
        // Check if assignment exists
        $assignment_exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$assignments_table} WHERE user_id = %d",
            $user_id
        ));
        
        if ($assignment_exists) {
            $wpdb->update(
                $assignments_table,
                array(
                    'job_role_id' => $job_role_id,
                    'assigned_by' => get_current_user_id(),
                ),
                array('user_id' => $user_id),
                array('%d', '%d'),
                array('%d')
            );
        } else {
            $wpdb->insert(
                $assignments_table,
                array(
                    'user_id' => $user_id,
                    'job_role_id' => $job_role_id,
                    'assigned_by' => get_current_user_id(),
                    'assigned_date' => current_time('mysql'),
                    'sync_wp_role' => 0,
                ),
                array('%d', '%d', '%d', '%s', '%d')
            );
        }
        
        // CRITICAL FIX: Clear permission cache for this user when their job role changes
        $cache_key = 'mp_user_perms_' . $user_id;
        delete_transient( $cache_key );
        error_log( "[User Update] Cleared permission cache for user $user_id (job role changed to $job_role_id)" );
        
        // Clear user list cache since job roles are displayed in user data
        if ( function_exists( 'mp_invalidate_user_caches' ) ) {
            mp_invalidate_user_caches( $user_id );
        }
        
        // Invalidate pay cache for this user since job role affects pay calculations
        if ( class_exists( 'Seasonal_Returns' ) ) {
            Seasonal_Returns::invalidate_pay_cache( $user_id );
            error_log( "[User Update] Invalidated pay cache for user $user_id" );
        }
    }
    
    // Also clear caches when hire_date changes (affects longevity/work years)
    if ( $hire_date !== null ) {
        // Clear permission cache (longevity may affect permissions)
        $cache_key = 'mp_user_perms_' . $user_id;
        delete_transient( $cache_key );
        
        // Clear user list cache
        if ( function_exists( 'mp_invalidate_user_caches' ) ) {
            mp_invalidate_user_caches( $user_id );
        }
        
        // Invalidate pay cache since hire date affects longevity calculations
        if ( class_exists( 'Seasonal_Returns' ) ) {
            Seasonal_Returns::invalidate_pay_cache( $user_id );
            error_log( "[User Update] Invalidated pay cache for user $user_id (hire_date changed)" );
        }
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'User updated successfully'
    ), 200);
}

/**
 * Delete user
 */
function mentorship_platform_delete_user($request) {
    $user_id = intval($request->get_param('id'));
    
    // Validate user exists
    $user = get_user_by('id', $user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found', array('status' => 404));
    }
    
    // Don't allow deleting current user or admin users
    if ($user_id === get_current_user_id()) {
        return new WP_Error('cannot_delete_self', 'Cannot delete your own account', array('status' => 400));
    }
    
    if (user_can($user_id, 'manage_options')) {
        return new WP_Error('cannot_delete_admin', 'Cannot delete administrator accounts', array('status' => 400));
    }
    
    // Delete user (WordPress handles cleanup of related data)
    require_once(ABSPATH . 'wp-admin/includes/user.php');
    $result = wp_delete_user($user_id);
    
    if (!$result) {
        return new WP_Error('delete_failed', 'Failed to delete user', array('status' => 500));
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'User deleted successfully'
    ), 200);
}

/**
 * Archive user
 */
function mentorship_platform_archive_user($request) {
    global $wpdb;
    
    $user_id = intval($request->get_param('id'));
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    // Validate user exists
    $user = get_user_by('id', $user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found', array('status' => 404));
    }
    
    // Check if metadata row exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$metadata_table} WHERE user_id = %d",
        $user_id
    ));
    
    if ($exists) {
        $wpdb->update(
            $metadata_table,
            array(
                'archived' => 1,
                'archived_date' => current_time('mysql'),
                'archived_by' => get_current_user_id(),
            ),
            array('user_id' => $user_id),
            array('%d', '%s', '%d'),
            array('%d')
        );
    } else {
        $result = $wpdb->insert(
            $metadata_table,
            array(
                'user_id' => $user_id,
                'archived' => 1,
                'archived_date' => current_time('mysql'),
                'archived_by' => get_current_user_id(),
            ),
            array('%d', '%d', '%s', '%d')
        );
        
        if ($result === false) {
            error_log('Failed to insert archive data for user ' . $user_id . ': ' . $wpdb->last_error);
            return new WP_Error('database_error', 'Failed to archive user: ' . $wpdb->last_error, array('status' => 500));
        }
    }
    
    if ($wpdb->last_error) {
        error_log('Archive user error for user ' . $user_id . ': ' . $wpdb->last_error);
        return new WP_Error('database_error', 'Failed to archive user: ' . $wpdb->last_error, array('status' => 500));
    }

    mp_invalidate_user_caches( $user_id );

    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'User archived successfully'
    ), 200);
}

/**
 * Unarchive user
 */
function mentorship_platform_unarchive_user($request) {
    global $wpdb;
    
    $user_id = intval($request->get_param('id'));
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    // Validate user exists
    $user = get_user_by('id', $user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found', array('status' => 404));
    }
    
    // Check if metadata row exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT user_id FROM $metadata_table WHERE user_id = %d",
        $user_id
    ));
    
    if ($existing) {
        // Update existing row
        $wpdb->update(
            $metadata_table,
            array(
                'archived' => 0,
                'archived_date' => null,
                'archived_by' => null,
            ),
            array('user_id' => $user_id),
            array('%d', '%s', '%d'),
            array('%d')
        );
    } else {
        // Insert new row if it doesn't exist
        $wpdb->insert(
            $metadata_table,
            array(
                'user_id' => $user_id,
                'archived' => 0,
            ),
            array('%d', '%d')
        );
    }
    
    mp_invalidate_user_caches( $user_id );

    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'User unarchived successfully'
    ), 200);
}

/**
 * Permission callback for member management (Tier 6+)
 */
function mentorship_platform_check_member_management_permission() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // Use the helper function if available
    if ( function_exists( 'aquaticpro_can_manage_members' ) ) {
        return aquaticpro_can_manage_members();
    }
    
    // Fallback: WordPress admins only
    return current_user_can( 'manage_options' );
}

/**
 * Set user member status
 * Allows Tier 6+ users to designate who is an employee (member) vs site user (visitor)
 */
function mentorship_platform_set_member_status($request) {
    global $wpdb;
    
    $user_id = intval($request->get_param('id'));
    $is_member = $request->get_param('is_member');
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    // Validate user exists
    $user = get_user_by('id', $user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found', array('status' => 404));
    }
    
    // Cannot change member status for WordPress admins (they are always members)
    if (user_can($user_id, 'manage_options')) {
        return new WP_Error('cannot_modify_admin', 'Cannot change member status for WordPress administrators', array('status' => 403));
    }
    
    // Normalize is_member value (can be boolean, string, or int)
    $is_member_val = null;
    if ($is_member === 'null' || $is_member === null) {
        $is_member_val = null; // Reset to auto-detect (based on job roles)
    } else {
        $is_member_val = filter_var($is_member, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }
    
    // Check if metadata row exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$metadata_table} WHERE user_id = %d",
        $user_id
    ));
    
    if ($exists) {
        $wpdb->update(
            $metadata_table,
            array('is_member' => $is_member_val),
            array('user_id' => $user_id),
            array($is_member_val === null ? '%s' : '%d'),
            array('%d')
        );
    } else {
        $wpdb->insert(
            $metadata_table,
            array(
                'user_id' => $user_id,
                'is_member' => $is_member_val,
            ),
            array('%d', $is_member_val === null ? '%s' : '%d')
        );
    }
    
    if ($wpdb->last_error) {
        error_log('Set member status error for user ' . $user_id . ': ' . $wpdb->last_error);
        return new WP_Error('database_error', 'Failed to update member status: ' . $wpdb->last_error, array('status' => 500));
    }

    mp_invalidate_user_caches( $user_id );

    // Determine the effective status after the update
    $effective_is_member = function_exists('aquaticpro_is_user_member') ? aquaticpro_is_user_member($user_id) : (bool) $is_member_val;
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => $is_member_val === null 
            ? 'Member status reset to auto-detect (based on job roles)' 
            : ($is_member_val ? 'User set as member (employee)' : 'User set as site user (visitor)'),
        'is_member' => $effective_is_member,
        'is_member_explicit' => $is_member_val
    ), 200);
}

/**
 * Bulk import users from CSV
 */
function mentorship_platform_bulk_import_users($request) {
    global $wpdb;
    
    $csv_data = $request->get_param('csv_data');
    $send_emails = $request->get_param('send_emails') === true;
    
    if (empty($csv_data)) {
        return new WP_Error('no_data', 'No CSV data provided', array('status' => 400));
    }
    
    $lines = explode("\n", $csv_data);
    $results = array(
        'success' => array(),
        'errors' => array(),
    );
    
    // Skip header row
    array_shift($lines);
    
    foreach ($lines as $line_num => $line) {
        $line = trim($line);
        if (empty($line)) {
            continue;
        }
        
        $data = str_getcsv($line);
        
        // Expected format: first_name, last_name, email, phone_number, employee_id, hire_date, job_role_id, wp_role
        // Only first 3 columns (name, name, email) are required
        if (count($data) < 3) {
            $results['errors'][] = "Line " . ($line_num + 2) . ": Need at least first_name, last_name, and email";
            continue;
        }
        
        $first_name = sanitize_text_field(trim($data[0] ?? ''));
        $last_name = sanitize_text_field(trim($data[1] ?? ''));
        $email = sanitize_email(trim($data[2] ?? ''));
        $phone_number = isset($data[3]) ? sanitize_text_field(trim($data[3])) : '';
        $employee_id = isset($data[4]) ? sanitize_text_field(trim($data[4])) : '';
        $hire_date = isset($data[5]) ? sanitize_text_field(trim($data[5])) : '';
        $job_role_id = isset($data[6]) ? intval(trim($data[6])) : 0;
        $wp_role = isset($data[7]) ? sanitize_text_field(trim($data[7])) : 'subscriber';
        
        // Validate
        if (empty($first_name) || empty($last_name) || empty($email)) {
            $results['errors'][] = "Line " . ($line_num + 2) . ": Missing required fields";
            continue;
        }
        
        if (email_exists($email)) {
            $results['errors'][] = "Line " . ($line_num + 2) . ": Email already exists ({$email})";
            continue;
        }
        
        // Generate username
        $username = strtolower($first_name . '.' . $last_name);
        $username = sanitize_user($username);
        $base_username = $username;
        $counter = 1;
        while (username_exists($username)) {
            $username = $base_username . $counter;
            $counter++;
        }
        
        // Generate password
        $password = wp_generate_password(12, true, true);
        
        // Create user
        $user_id = wp_create_user($username, $password, $email);
        
        if (is_wp_error($user_id)) {
            $results['errors'][] = "Line " . ($line_num + 2) . ": " . $user_id->get_error_message();
            continue;
        }
        
        // Update user
        wp_update_user(array(
            'ID' => $user_id,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'display_name' => $first_name . ' ' . $last_name,
            'role' => $wp_role
        ));
        
        // Insert metadata
        $metadata_table = $wpdb->prefix . 'pg_user_metadata';
        $wpdb->insert(
            $metadata_table,
            array(
                'user_id' => $user_id,
                'phone_number' => $phone_number,
                'employee_id' => $employee_id,
                'hire_date' => !empty($hire_date) ? $hire_date : null,
                'archived' => 0,
            ),
            array('%d', '%s', '%s', '%s', '%d')
        );
        
        // Assign job role
        if ($job_role_id > 0) {
            $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
            $wpdb->insert(
                $assignments_table,
                array(
                    'user_id' => $user_id,
                    'job_role_id' => $job_role_id,
                    'assigned_by' => get_current_user_id(),
                    'sync_wp_role' => 1,
                ),
                array('%d', '%d', '%d', '%d')
            );
        }
        
        // Send welcome email
        if ($send_emails) {
            $subject = 'Welcome to ' . get_bloginfo('name');
            $message = "Hello {$first_name},\n\n";
            $message .= "Your account has been created!\n\n";
            $message .= "Username: {$username}\n";
            $message .= "Password: {$password}\n\n";
            $message .= "Login URL: " . wp_login_url() . "\n\n";
            $message .= "Please change your password after your first login.\n\n";
            $message .= "Best regards,\n";
            $message .= get_bloginfo('name');
            
            wp_mail($email, $subject, $message);
        }
        
        $results['success'][] = array(
            'name' => $first_name . ' ' . $last_name,
            'email' => $email,
            'username' => $username,
            'password' => $password,
        );
    }
    
    return new WP_REST_Response(array(
        'total_processed' => count($results['success']) + count($results['errors']),
        'successful' => count($results['success']),
        'failed' => count($results['errors']),
        'results' => $results
    ), 200);
}

/**
 * Bulk assign job role to multiple users
 */
function mentorship_platform_bulk_assign_job_role($request) {
    global $wpdb;
    
    $user_ids = $request->get_param('user_ids');
    $job_role_id = intval($request->get_param('job_role_id'));
    $sync_wp_role = filter_var($request->get_param('sync_wp_role'), FILTER_VALIDATE_BOOLEAN);
    
    if (empty($user_ids) || !is_array($user_ids)) {
        return new WP_Error('invalid_params', 'user_ids must be a non-empty array', array('status' => 400));
    }
    
    if (empty($job_role_id)) {
        return new WP_Error('invalid_params', 'job_role_id is required', array('status' => 400));
    }
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Verify job role exists
    $job_role = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$roles_table} WHERE id = %d",
        $job_role_id
    ));
    
    if (!$job_role) {
        return new WP_Error('invalid_role', 'Job role not found', array('status' => 404));
    }
    
    $successful = 0;
    $failed = 0;
    $errors = array();
    
    foreach ($user_ids as $user_id) {
        $user_id = intval($user_id);
        
        // Verify user exists
        $user = get_user_by('ID', $user_id);
        if (!$user) {
            $errors[] = "User ID {$user_id} not found";
            $failed++;
            continue;
        }
        
        // Check if user already has a job assignment
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$assignments_table} WHERE user_id = %d",
            $user_id
        ));
        
        $current_user_id = get_current_user_id();
        
        if ($existing) {
            // Update existing assignment
            $result = $wpdb->update(
                $assignments_table,
                array(
                    'job_role_id' => $job_role_id,
                    'sync_wp_role' => $sync_wp_role ? 1 : 0,
                    'assigned_by' => $current_user_id
                ),
                array('user_id' => $user_id),
                array('%d', '%d', '%d'),
                array('%d')
            );
        } else {
            // Insert new assignment
            $result = $wpdb->insert(
                $assignments_table,
                array(
                    'user_id' => $user_id,
                    'job_role_id' => $job_role_id,
                    'sync_wp_role' => $sync_wp_role ? 1 : 0,
                    'assigned_by' => $current_user_id
                ),
                array('%d', '%d', '%d', '%d')
            );
        }
        
        if ($result === false) {
            $errors[] = "Failed to assign job role to user ID {$user_id}: " . $wpdb->last_error;
            $failed++;
            continue;
        }
        
        // Optionally sync WP role
        if ($sync_wp_role && !empty($job_role->wp_role)) {
            $user->set_role($job_role->wp_role);
        }
        
        $successful++;
    }
    
    // Invalidate user list cache since job roles changed
    if ($successful > 0) {
        if ( function_exists( 'mp_invalidate_user_caches' ) ) {
            mp_invalidate_user_caches();
        }
        
        // CRITICAL FIX: Clear permission cache for all affected users
        // When a user's job role changes, they need their cached permissions refreshed
        foreach ($user_ids as $user_id) {
            $user_id = intval($user_id);
            $cache_key = 'mp_user_perms_' . $user_id;
            delete_transient( $cache_key );
        }
        error_log( "[Bulk Job Role Assign] Cleared permission cache for " . count($user_ids) . " users" );
        
        // Trigger auto-assignment of courses for the newly assigned role
        if ( function_exists( 'aquaticpro_auto_assign_courses_for_user' ) ) {
            $auto_assigned_total = 0;
            foreach ( $user_ids as $uid ) {
                $uid = intval( $uid );
                $result = aquaticpro_auto_assign_courses_for_user( $uid, $job_role_id, $current_user_id );
                $auto_assigned_total += $result['assigned'];
            }
            if ( $auto_assigned_total > 0 ) {
                error_log( "[Bulk Job Role Assign] Auto-assigned courses: {$auto_assigned_total} total course assignments created" );
            }
        }
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => "Assigned job role to {$successful} user(s)",
        'total_processed' => count($user_ids),
        'successful' => $successful,
        'failed' => $failed,
        'errors' => $errors
    ), 200);
}

/**
 * Delete a mentorship and all associated data
 * DELETE /requests/{id}
 */
function mentorship_platform_delete_mentorship( $request ) {
    $start_time = microtime(true);
    $mentorship_id = intval( $request['id'] );
    error_log(sprintf('=== MENTORSHIP API: DELETE /mentorship/%d START ===', $mentorship_id));
    
    // Verify the mentorship exists
    $mentorship = get_post( $mentorship_id );
    if ( ! $mentorship || $mentorship->post_type !== 'mp_request' ) {
        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: DELETE /mentorship/%d END (NOT FOUND) - Total: %.2fms ===', $mentorship_id, $total_time));
        return new WP_Error( 'not_found', 'Mentorship not found', array( 'status' => 404 ) );
    }
    
    $deleted_counts = array(
        'goals' => 0,
        'initiatives' => 0,
        'tasks' => 0,
        'meetings' => 0,
        'updates' => 0,
    );
    
    // Get all goals for this mentorship
    $goals = get_posts( array(
        'post_type'      => 'mp_goal',
        'posts_per_page' => 100, // Reasonable limit for cascade delete
        'post_parent'    => $mentorship_id,
        'post_status'    => 'any',
    ) );
    
    // Delete each goal and its children
    foreach ( $goals as $goal ) {
        // Get all initiatives for this goal
        $initiatives = get_posts( array(
            'post_type'      => 'mp_initiative',
            'posts_per_page' => 100,
            'post_parent'    => $goal->ID,
            'post_status'    => 'any',
        ) );
        
        // Delete each initiative and its tasks
        foreach ( $initiatives as $initiative ) {
            // Get tasks for this initiative
            $tasks = get_posts( array(
                'post_type'      => 'mp_task',
                'posts_per_page' => 500,
                'post_parent'    => $initiative->ID,
                'post_status'    => 'any',
            ) );
            
            // Delete tasks
            foreach ( $tasks as $task ) {
                wp_delete_post( $task->ID, true );
                $deleted_counts['tasks']++;
            }
            
            // Delete the initiative
            wp_delete_post( $initiative->ID, true );
            $deleted_counts['initiatives']++;
        }
        
        // Delete the goal
        wp_delete_post( $goal->ID, true );
        $deleted_counts['goals']++;
    }
    
    // Get and delete all meetings for this mentorship
    $meetings = get_posts( array(
        'post_type'      => 'mp_meeting',
        'posts_per_page' => 200,
        'post_parent'    => $mentorship_id,
        'post_status'    => 'any',
    ) );
    
    foreach ( $meetings as $meeting ) {
        wp_delete_post( $meeting->ID, true );
        $deleted_counts['meetings']++;
    }
    
    // Get and delete all updates for this mentorship
    $updates = get_posts( array(
        'post_type'      => 'mp_update',
        'posts_per_page' => 200,
        'post_parent'    => $mentorship_id,
        'post_status'    => 'any',
    ) );
    
    foreach ( $updates as $update ) {
        // Delete comments on this update
        $comments = get_comments( array( 'post_id' => $update->ID ) );
        foreach ( $comments as $comment ) {
            wp_delete_comment( $comment->comment_ID, true );
        }
        
        wp_delete_post( $update->ID, true );
        $deleted_counts['updates']++;
    }
    
    // Finally, delete the mentorship itself
    $result = wp_delete_post( $mentorship_id, true );
    
    if ( ! $result ) {
        $total_time = (microtime(true) - $start_time) * 1000;
        error_log(sprintf('=== MENTORSHIP API: DELETE /mentorship/%d END (FAILED) - Total: %.2fms ===', $mentorship_id, $total_time));
        return new WP_Error( 'delete_failed', 'Failed to delete mentorship', array( 'status' => 500 ) );
    }
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== MENTORSHIP API: DELETE /mentorship/%d END - Total: %.2fms, deleted=%s ===', 
        $mentorship_id, $total_time, json_encode($deleted_counts)));
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Mentorship and all associated data deleted successfully',
        'deleted' => $deleted_counts,
    ) );
}

/**
 * Permission callback - only admins can delete mentorships
 */
function mentorship_platform_admin_permission_check() {
    return current_user_can( 'manage_options' );
}

/**
 * Admin endpoint to clear plugin caches
 * Allows clearing all caches or specific cache types
 * 
 * @param WP_REST_Request $request REST request object
 * @return WP_REST_Response
 */
function mentorship_platform_admin_clear_cache($request) {
    $type = $request->get_param('type') ?: 'all';
    $cleared = array();
    
    error_log("=== ADMIN CACHE CLEAR: Type=$type, User=" . get_current_user_id() . " ===");
    
    switch ($type) {
        case 'users':
            if (function_exists('mp_invalidate_user_caches')) {
                mp_invalidate_user_caches();
                $cleared[] = 'users';
            }
            break;
            
        case 'roles':
            if (function_exists('mp_invalidate_role_caches')) {
                mp_invalidate_role_caches();
                $cleared[] = 'roles';
            }
            break;
            
        case 'lesson-management':
            if (function_exists('mp_invalidate_lesson_management_caches')) {
                mp_invalidate_lesson_management_caches('all');
                $cleared[] = 'lesson-management';
            }
            break;
            
        case 'taskdeck':
            if (function_exists('mp_invalidate_taskdeck_caches')) {
                mp_invalidate_taskdeck_caches('all');
                $cleared[] = 'taskdeck';
            }
            break;
            
        case 'all':
        default:
            if (function_exists('mp_invalidate_all_caches')) {
                mp_invalidate_all_caches();
                $cleared = array('users', 'roles', 'lesson-management', 'taskdeck', 'all-other-transients');
            }
            break;
    }
    
    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Caches cleared successfully',
        'type_requested' => $type,
        'caches_cleared' => $cleared,
        'cleared_by' => get_current_user_id(),
        'timestamp' => current_time('mysql')
    ));
}

/**
 * Fix display names for all users - removes trailing zeros and extra spaces
 * This is a one-time migration utility
 */
function mentorship_platform_fix_user_display_names($request) {
    global $wpdb;
    
    error_log('=== FIXING USER DISPLAY NAMES - START ===');
    
    // Get all users
    $users = get_users(array('fields' => 'all'));
    $fixed_count = 0;
    $error_count = 0;
    
    foreach ($users as $user_obj) {
        $user_id = $user_obj->ID;
        $old_display_name = $user_obj->display_name;
        
        // Get first and last names from usermeta
        $first_name = get_user_meta($user_id, 'first_name', true);
        $last_name = get_user_meta($user_id, 'last_name', true);
        
        // Ensure we have strings, not false/0/null
        $first_name = is_string($first_name) ? trim($first_name) : '';
        $last_name = is_string($last_name) ? trim($last_name) : '';
        
        // Create clean display name - only add space if both exist
        if (!empty($first_name) && !empty($last_name)) {
            $new_display_name = $first_name . ' ' . $last_name;
        } elseif (!empty($first_name)) {
            $new_display_name = $first_name;
        } elseif (!empty($last_name)) {
            $new_display_name = $last_name;
        } else {
            $new_display_name = $user_obj->user_login;
        }
        
        // Remove ANY trailing digits (not just zeros) and trim
        $new_display_name = preg_replace('/\d+$/', '', $new_display_name);
        $new_display_name = trim($new_display_name);
        
        // If empty after cleanup, use login name
        if (empty($new_display_name)) {
            $new_display_name = $user_obj->user_login;
        }
        
        // Always update if display name has trailing digits
        if (preg_match('/\d+$/', $old_display_name) || $old_display_name !== $new_display_name) {
            // Direct database update to ensure it takes effect
            global $wpdb;
            $result = $wpdb->update(
                $wpdb->users,
                array('display_name' => $new_display_name),
                array('ID' => $user_id),
                array('%s'),
                array('%d')
            );
            
            if ($result === false) {
                error_log("Failed to update user $user_id: " . $wpdb->last_error);
                $error_count++;
            } else {
                error_log("Fixed user $user_id: '$old_display_name' -> '$new_display_name'");
                $fixed_count++;
                
                // Also update the wp_update_user cache
                clean_user_cache($user_id);
            }
        }
    }
    
    error_log("=== FIXING USER DISPLAY NAMES - END: Fixed $fixed_count, Errors: $error_count, Total: " . count($users) . " ===");
    
    // Get sample of ALL users to see what's actually in the database
    $sample_users = array();
    $count = 0;
    foreach ($users as $user) {
        if ($count < 10) {
            $display_name = $user->display_name;
            $sample_users[] = array(
                'id' => $user->ID,
                'display_name' => $display_name,
                'display_name_length' => strlen($display_name),
                'last_char' => substr($display_name, -1),
                'last_char_ord' => ord(substr($display_name, -1)),
                'matches_digit_pattern' => preg_match('/\d+$/', $display_name) ? 'YES' : 'NO',
                'first_name' => get_user_meta($user->ID, 'first_name', true),
                'last_name' => get_user_meta($user->ID, 'last_name', true)
            );
            $count++;
        }
    }
    
    return rest_ensure_response(array(
        'success' => true,
        'message' => "Fixed $fixed_count user display names out of " . count($users) . " total users",
        'fixed' => $fixed_count,
        'errors' => $error_count,
        'total' => count($users),
        'sample_database_values' => $sample_users,
        'debug' => array(
            'checked_all_users' => true,
            'pattern_used' => '/\d+$/',
            'note' => 'Check sample_database_values to see actual display_name and last_char_ord'
        )
    ));
}
