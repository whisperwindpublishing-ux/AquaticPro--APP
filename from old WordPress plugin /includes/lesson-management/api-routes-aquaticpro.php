<?php
/**
 * Lesson Management REST API Routes for AquaticPro
 * 
 * This file contains AquaticPro-specific REST routes for the Lesson Management module,
 * including the Camp Roster password verification endpoints.
 *
 * @package AquaticPro
 */

defined( 'ABSPATH' ) || die;

add_action( 'rest_api_init', 'aquaticpro_lm_register_rest_routes' );

/**
 * Register Lesson Management REST routes under the AquaticPro namespace.
 */
function aquaticpro_lm_register_rest_routes() {
    // Only register routes if Lesson Management is enabled
    $enable_professional_growth = get_option( 'aquaticpro_enable_professional_growth', false );
    $enable_lesson_management = get_option( 'aquaticpro_enable_lesson_management', false );
    
    if ( ! $enable_professional_growth || ! $enable_lesson_management ) {
        return;
    }

    // Verify Camp Roster Password (public endpoint)
    register_rest_route( 'mentorship-platform/v1', '/lessons/verify-roster-password', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_verify_roster_password',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => [
            'password' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Validate existing roster token (public endpoint)
    register_rest_route( 'mentorship-platform/v1', '/lessons/validate-roster-token', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_validate_roster_token',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => [
            'token' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Get public roster data (requires valid token or authenticated user)
    register_rest_route( 'mentorship-platform/v1', '/lessons/public-rosters', [
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_lm_get_public_rosters',
        'permission_callback' => 'aquaticpro_lm_roster_permission_check',
        'args'                => [
            'token'   => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'camp_id' => [
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
        ],
    ] );

    // Get camp roster password status (admin only)
    register_rest_route( 'mentorship-platform/v1', '/lessons/camp-roster/password-status', [
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_lm_get_password_status',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ] );

    // Set camp roster password (admin only)
    register_rest_route( 'mentorship-platform/v1', '/lessons/camp-roster/set-password', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_set_password',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
        'args'                => [
            'password' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Verify password for public access (used by CampRosters component)
    register_rest_route( 'mentorship-platform/v1', '/lessons/camp-roster/verify-password', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_verify_camp_password',
        'permission_callback' => '__return_true',
        'args'                => [
            'password' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Verify token for public access
    register_rest_route( 'mentorship-platform/v1', '/lessons/camp-roster/verify-token', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_verify_camp_token',
        'permission_callback' => '__return_true',
        'args'                => [
            'token' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Get cached camp roster data (optimized endpoint with server-side caching)
    register_rest_route( 'mentorship-platform/v1', '/lessons/camp-roster/data', [
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_lm_get_cached_camp_roster_data',
        'permission_callback' => 'aquaticpro_lm_camp_roster_token_check',
        'args'                => [
            'camp_id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
        ],
    ] );

    // Get email settings (admin only)
    register_rest_route( 'mentorship-platform/v1', '/lessons/email-settings', [
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_lm_get_email_settings',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ] );

    // Save email settings (admin only)
    register_rest_route( 'mentorship-platform/v1', '/lessons/email-settings', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_save_email_settings',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
        'args'                => [
            'evaluation_page_url' => [
                'type'              => 'string',
                'sanitize_callback' => 'esc_url_raw',
            ],
            'email_subject' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'email_body' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_textarea_field',
            ],
            'reply_to_email' => [
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_email',
            ],
        ],
    ] );
}

/**
 * Verify the Camp Roster password and return an access token.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response with token or error.
 */
function aquaticpro_lm_verify_roster_password( $request ) {
    $password = $request->get_param( 'password' );
    $stored_password = get_option( 'aquaticpro_camp_roster_password', '' );

    // If no password is set, public access is disabled
    if ( empty( $stored_password ) ) {
        return new WP_Error(
            'public_access_disabled',
            __( 'Public roster access is disabled. Please log in to view camp rosters.', 'aquaticpro' ),
            [ 'status' => 403 ]
        );
    }

    // Verify password
    if ( $password !== $stored_password ) {
        return new WP_Error(
            'invalid_password',
            __( 'Incorrect password. Please try again.', 'aquaticpro' ),
            [ 'status' => 401 ]
        );
    }

    // Generate a temporary access token (valid for 1 hour)
    $token = wp_generate_password( 32, false );
    set_transient( 'aquaticpro_lm_roster_token_' . $token, true, HOUR_IN_SECONDS );

    return new WP_REST_Response( [
        'success' => true,
        'token'   => $token,
        'expires' => time() + HOUR_IN_SECONDS,
    ], 200 );
}

/**
 * Validate an existing roster access token.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response indicating if token is valid.
 */
function aquaticpro_lm_validate_roster_token( $request ) {
    $token = $request->get_param( 'token' );

    if ( empty( $token ) ) {
        return new WP_REST_Response( [ 'valid' => false ], 200 );
    }

    $is_valid = (bool) get_transient( 'aquaticpro_lm_roster_token_' . $token );

    return new WP_REST_Response( [ 'valid' => $is_valid ], 200 );
}

/**
 * Permission check for public roster access.
 * Allows access if user is logged in with proper tier, or has a valid token.
 *
 * @param WP_REST_Request $request The request object.
 * @return bool|WP_Error True if access granted, WP_Error otherwise.
 */
function aquaticpro_lm_roster_permission_check( $request ) {
    // If user is logged in and has Tier 3+ access, allow
    if ( is_user_logged_in() ) {
        $user_id = get_current_user_id();
        
        // Admins always have access
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }
        
        // Check tier level (Tier 3+ can view rosters)
        if ( function_exists( 'mentorship_platform_pg_get_user_tier' ) ) {
            $tier = mentorship_platform_pg_get_user_tier( $user_id );
            if ( $tier >= 3 ) {
                return true;
            }
        }
    }

    // Check for valid public access token
    $token = $request->get_param( 'token' );
    if ( ! empty( $token ) && get_transient( 'aquaticpro_lm_roster_token_' . $token ) ) {
        return true;
    }

    return new WP_Error(
        'unauthorized',
        __( 'You must be logged in or provide a valid roster access token.', 'aquaticpro' ),
        [ 'status' => 401 ]
    );
}

/**
 * Get public roster data (groups organized by camp).
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response with roster data.
 */
function aquaticpro_lm_get_public_rosters( $request ) {
    $camp_id = $request->get_param( 'camp_id' );

    // Build query args for groups
    $args = [
        'post_type'      => 'lm-group',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'meta_query'     => [
            [
                'key'     => 'archived',
                'value'   => '1',
                'compare' => '!=',
            ],
        ],
    ];

    // Filter by camp if specified
    if ( ! empty( $camp_id ) ) {
        $args['tax_query'] = [
            [
                'taxonomy' => 'lm_camp',
                'field'    => 'term_id',
                'terms'    => $camp_id,
            ],
        ];
    }

    $groups = get_posts( $args );
    $roster_data = [];

    foreach ( $groups as $group ) {
        // Get group meta
        $level_id = get_post_meta( $group->ID, 'level', true );
        $instructor_ids = get_post_meta( $group->ID, 'instructor', true ) ?: [];
        $swimmer_ids = get_post_meta( $group->ID, 'swimmers', true ) ?: [];
        $group_time = get_post_meta( $group->ID, 'group_time', true );
        $days = get_post_meta( $group->ID, 'days', true ) ?: [];

        // Get camp terms
        $camps = wp_get_post_terms( $group->ID, 'lm_camp', [ 'fields' => 'all' ] );
        $animals = wp_get_post_terms( $group->ID, 'lm_animal', [ 'fields' => 'all' ] );

        // Get level name
        $level_name = '';
        if ( $level_id ) {
            $level_post = get_post( $level_id );
            if ( $level_post ) {
                $level_name = $level_post->post_title;
            }
        }

        // Get instructor names
        $instructors = [];
        if ( is_array( $instructor_ids ) ) {
            foreach ( $instructor_ids as $instructor_id ) {
                $user = get_userdata( $instructor_id );
                if ( $user ) {
                    $instructors[] = [
                        'id'   => $instructor_id,
                        'name' => $user->display_name,
                    ];
                }
            }
        }

        // Get swimmer names (limited info for public view)
        $swimmers = [];
        if ( is_array( $swimmer_ids ) ) {
            foreach ( $swimmer_ids as $swimmer_id ) {
                $swimmer_post = get_post( $swimmer_id );
                if ( $swimmer_post ) {
                    $swimmers[] = [
                        'id'   => $swimmer_id,
                        'name' => $swimmer_post->post_title,
                    ];
                }
            }
        }

        $roster_data[] = [
            'id'          => $group->ID,
            'title'       => $group->post_title,
            'level'       => $level_name,
            'level_id'    => $level_id,
            'instructors' => $instructors,
            'swimmers'    => $swimmers,
            'swimmer_count' => count( $swimmers ),
            'time'        => $group_time,
            'days'        => $days,
            'camps'       => array_map( function( $camp ) {
                return [
                    'id'   => $camp->term_id,
                    'name' => $camp->name,
                    'slug' => $camp->slug,
                ];
            }, $camps ),
            'animals'     => array_map( function( $animal ) {
                return [
                    'id'   => $animal->term_id,
                    'name' => $animal->name,
                    'slug' => $animal->slug,
                ];
            }, $animals ),
        ];
    }

    // Get all camps for filter dropdown
    $all_camps = get_terms( [
        'taxonomy'   => 'lm_camp',
        'hide_empty' => true,
    ] );

    $camps_list = [];
    if ( ! is_wp_error( $all_camps ) ) {
        foreach ( $all_camps as $camp ) {
            $camps_list[] = [
                'id'    => $camp->term_id,
                'name'  => $camp->name,
                'slug'  => $camp->slug,
                'count' => $camp->count,
            ];
        }
    }

    return new WP_REST_Response( [
        'groups' => $roster_data,
        'camps'  => $camps_list,
    ], 200 );
}

/**
 * Get the camp roster password status.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response with password status.
 */
function aquaticpro_lm_get_password_status( $request ) {
    $stored_password = get_option( 'aquaticpro_camp_roster_password', '' );
    
    return new WP_REST_Response( [
        'has_password' => ! empty( $stored_password ),
    ], 200 );
}

/**
 * Set the camp roster password.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response indicating success.
 */
function aquaticpro_lm_set_password( $request ) {
    $password = $request->get_param( 'password' );
    
    if ( empty( $password ) ) {
        return new WP_Error(
            'empty_password',
            __( 'Password cannot be empty.', 'aquaticpro' ),
            [ 'status' => 400 ]
        );
    }
    
    // Store the password
    update_option( 'aquaticpro_camp_roster_password', $password );
    
    return new WP_REST_Response( [
        'success' => true,
        'message' => __( 'Password saved successfully.', 'aquaticpro' ),
    ], 200 );
}

/**
 * Verify camp roster password and return a session token.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response with token or error.
 */
function aquaticpro_lm_verify_camp_password( $request ) {
    // Rate limiting for password attempts (10 attempts per 5 minutes to prevent brute force)
    if (function_exists('mp_check_rate_limit')) {
        $rate_check = mp_check_rate_limit('/lessons/camp-roster/verify-password', 10, 300);
        if (is_wp_error($rate_check)) {
            // Log potential brute force attempt
            if (function_exists('mp_log_security_event')) {
                mp_log_security_event('password_rate_limited', [
                    'endpoint' => '/lessons/camp-roster/verify-password',
                    'ip' => function_exists('mp_get_client_ip') ? mp_get_client_ip() : $_SERVER['REMOTE_ADDR']
                ]);
            }
            return $rate_check;
        }
    }
    
    $password = $request->get_param( 'password' );
    $stored_password = get_option( 'aquaticpro_camp_roster_password', '' );

    // If no password is set, public access is disabled
    if ( empty( $stored_password ) ) {
        return new WP_Error(
            'public_access_disabled',
            __( 'Public roster access is not configured.', 'aquaticpro' ),
            [ 'status' => 403 ]
        );
    }

    // Verify password
    if ( $password !== $stored_password ) {
        // Log failed attempt
        if (function_exists('mp_log_security_event')) {
            mp_log_security_event('password_failed', [
                'endpoint' => '/lessons/camp-roster/verify-password',
                'ip' => function_exists('mp_get_client_ip') ? mp_get_client_ip() : $_SERVER['REMOTE_ADDR']
            ]);
        }
        return new WP_Error(
            'invalid_password',
            __( 'Incorrect password. Please try again.', 'aquaticpro' ),
            [ 'status' => 401 ]
        );
    }

    // Generate a temporary access token (valid for 1 hour)
    $token = wp_generate_password( 32, false );
    set_transient( 'aquaticpro_lm_roster_token_' . $token, true, HOUR_IN_SECONDS );

    return new WP_REST_Response( [
        'success' => true,
        'token'   => $token,
        'expires' => time() + HOUR_IN_SECONDS,
    ], 200 );
}

/**
 * Verify an existing camp roster token.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response indicating if token is valid.
 */
function aquaticpro_lm_verify_camp_token( $request ) {
    $token = $request->get_param( 'token' );

    if ( empty( $token ) ) {
        return new WP_REST_Response( [ 'valid' => false ], 200 );
    }

    $is_valid = (bool) get_transient( 'aquaticpro_lm_roster_token_' . $token );

    return new WP_REST_Response( [ 'valid' => $is_valid ], 200 );
}

/**
 * Permission callback for camp roster data endpoint.
 * Allows access if user is logged in OR has valid roster token.
 *
 * @param WP_REST_Request $request The request object.
 * @return bool Whether the request has permission.
 */
function aquaticpro_lm_camp_roster_token_check( $request ) {
    // Allow if user is logged in
    if ( is_user_logged_in() ) {
        return true;
    }
    
    // Check for valid token in header
    $token = $request->get_header( 'X-Camp-Roster-Token' );
    if ( ! empty( $token ) && get_transient( 'aquaticpro_lm_roster_token_' . $token ) ) {
        return true;
    }
    
    return false;
}

/**
 * Get cached camp roster data with all groups and swimmers.
 * Uses WordPress transients for server-side caching (5 minute cache).
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response with camp roster data.
 */
function aquaticpro_lm_get_cached_camp_roster_data( $request ) {
    $camp_id = $request->get_param( 'camp_id' );
    
    if ( ! $camp_id ) {
        return new WP_Error(
            'missing_camp_id',
            __( 'Camp ID is required.', 'aquaticpro' ),
            [ 'status' => 400 ]
        );
    }
    
    // Check cache first (5 minute TTL)
    $cache_key = 'aquaticpro_camp_roster_' . $camp_id;
    $cached_data = get_transient( $cache_key );
    
    if ( $cached_data !== false ) {
        return new WP_REST_Response( [
            'success' => true,
            'data' => $cached_data,
            'cached' => true,
        ], 200 );
    }
    
    // Fetch groups for this camp (exclude archived)
    $groups = get_posts( [
        'post_type'      => 'lm-group',
        'posts_per_page' => 200,
        'post_status'    => 'publish',
        'tax_query'      => [
            [
                'taxonomy' => 'lm_camp',
                'field'    => 'term_id',
                'terms'    => $camp_id,
            ],
        ],
        'meta_query'     => [
            'relation' => 'OR',
            [
                'key'     => 'archived',
                'compare' => 'NOT EXISTS',
            ],
            [
                'key'     => 'archived',
                'value'   => '0',
            ],
            [
                'key'     => 'archived',
                'value'   => '',
            ],
        ],
    ] );
    
    // Collect all swimmer IDs
    $swimmer_ids = [];
    $groups_data = [];
    
    foreach ( $groups as $group ) {
        $meta = get_post_meta( $group->ID );
        $group_swimmers = maybe_unserialize( $meta['swimmers'][0] ?? '[]' );
        if ( is_array( $group_swimmers ) ) {
            $swimmer_ids = array_merge( $swimmer_ids, $group_swimmers );
        }
        
        // Get animal terms for this group
        $animal_terms = wp_get_post_terms( $group->ID, 'lm_animal', [ 'fields' => 'ids' ] );
        
        $groups_data[] = [
            'id'           => $group->ID,
            'title'        => [ 'rendered' => $group->post_title ],
            'lm_animal'    => is_array( $animal_terms ) ? $animal_terms : [],
            'meta'         => [
                'level'        => intval( $meta['level'][0] ?? 0 ),
                'instructor'   => maybe_unserialize( $meta['instructor'][0] ?? '[]' ),
                'swimmers'     => $group_swimmers,
                'days'         => maybe_unserialize( $meta['days'][0] ?? '[]' ),
                'group_time'   => $meta['group_time'][0] ?? '',
                'archived'     => boolval( $meta['archived'][0] ?? false ),
            ],
        ];
    }
    
    // Fetch all swimmers in one query
    $swimmer_ids = array_unique( array_filter( $swimmer_ids ) );
    $swimmers_data = [];
    
    if ( ! empty( $swimmer_ids ) ) {
        $swimmers = get_posts( [
            'post_type'      => 'lm-swimmer',
            'posts_per_page' => count( $swimmer_ids ),
            'post__in'       => $swimmer_ids,
            'post_status'    => 'publish',
        ] );
        
        foreach ( $swimmers as $swimmer ) {
            $swimmers_data[ $swimmer->ID ] = [
                'id'    => $swimmer->ID,
                'title' => [ 'rendered' => $swimmer->post_title ],
            ];
        }
    }
    
    $result = [
        'groups'   => $groups_data,
        'swimmers' => $swimmers_data,
    ];
    
    // Cache for 5 minutes
    set_transient( $cache_key, $result, 5 * MINUTE_IN_SECONDS );
    
    return new WP_REST_Response( [
        'success' => true,
        'data'    => $result,
        'cached'  => false,
    ], 200 );
}

/**
 * Get email settings.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response Response with email settings.
 */
function aquaticpro_lm_get_email_settings( $request ) {
    $settings = [
        'evaluation_page_url' => get_option( 'lm_evaluation_page_url', '' ),
        'email_subject'       => get_option( 'lm_evaluation_email_subject', 'Evaluation Results for [swimmer_name]' ),
        'email_body'          => get_option( 'lm_evaluation_email_body', "Hello [parent_name],\n\nWe've just completed a new evaluation for [swimmer_name].\n\nYou can view their progress tracking, skills mastered, and all evaluation history here:\n[evaluation_link]" ),
        'reply_to_email'      => get_option( 'lm_evaluation_reply_to_email', '' ),
    ];

    return new WP_REST_Response( $settings, 200 );
}

/**
 * Save email settings.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response with success or error.
 */
function aquaticpro_lm_save_email_settings( $request ) {
    $params = $request->get_params();

    // Update each setting if provided
    if ( isset( $params['evaluation_page_url'] ) ) {
        update_option( 'lm_evaluation_page_url', $params['evaluation_page_url'] );
    }
    if ( isset( $params['email_subject'] ) ) {
        update_option( 'lm_evaluation_email_subject', $params['email_subject'] );
    }
    if ( isset( $params['email_body'] ) ) {
        update_option( 'lm_evaluation_email_body', $params['email_body'] );
    }
    if ( isset( $params['reply_to_email'] ) ) {
        update_option( 'lm_evaluation_reply_to_email', $params['reply_to_email'] );
    }

    return new WP_REST_Response( [
        'success' => true,
        'message' => __( 'Email settings saved successfully.', 'aquaticpro' ),
    ], 200 );
}

// ============================================================================
// SWIMMER SHARE PROGRESS ENDPOINTS
// ============================================================================

/**
 * Register swimmer share progress REST routes.
 * Called from aquaticpro_lm_register_rest_routes().
 */
add_action( 'rest_api_init', 'aquaticpro_lm_register_swimmer_share_routes' );

function aquaticpro_lm_register_swimmer_share_routes() {
    // Only register routes if Lesson Management is enabled
    $enable_professional_growth = get_option( 'aquaticpro_enable_professional_growth', false );
    $enable_lesson_management = get_option( 'aquaticpro_enable_lesson_management', false );
    
    if ( ! $enable_professional_growth || ! $enable_lesson_management ) {
        return;
    }

    // Generate share link for a swimmer (authenticated)
    register_rest_route( 'mentorship-platform/v1', '/lessons/swimmer/(?P<id>\d+)/share-link', [
        'methods'             => 'POST',
        'callback'            => 'aquaticpro_lm_generate_swimmer_share_link',
        'permission_callback' => function() {
            return function_exists( 'lm_user_can' ) ? lm_user_can( 'edit' ) : current_user_can( 'manage_options' );
        },
        'args'                => [
            'id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'expires_days' => [
                'required'          => false,
                'type'              => 'integer',
                'default'           => 30,
                'sanitize_callback' => 'absint',
            ],
        ],
    ] );

    // Get public swimmer progress (public endpoint with token)
    register_rest_route( 'mentorship-platform/v1', '/lessons/swimmer-progress/(?P<token>[a-zA-Z0-9]+)', [
        'methods'             => 'GET',
        'callback'            => 'aquaticpro_lm_get_public_swimmer_progress',
        'permission_callback' => '__return_true', // Public with token validation
        'args'                => [
            'token' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );

    // Revoke a swimmer share link (authenticated)
    register_rest_route( 'mentorship-platform/v1', '/lessons/swimmer/(?P<id>\d+)/revoke-share', [
        'methods'             => 'DELETE',
        'callback'            => 'aquaticpro_lm_revoke_swimmer_share_link',
        'permission_callback' => function() {
            return function_exists( 'lm_user_can' ) ? lm_user_can( 'edit' ) : current_user_can( 'manage_options' );
        },
        'args'                => [
            'id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
        ],
    ] );
}

/**
 * Generate a share link token for a swimmer.
 * Tokens are permanent and unique per swimmer - if one already exists, return it.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response with share URL or error.
 */
function aquaticpro_lm_generate_swimmer_share_link( $request ) {
    $swimmer_id = $request->get_param( 'id' );
    
    // Verify swimmer exists
    $swimmer = get_post( $swimmer_id );
    if ( ! $swimmer || $swimmer->post_type !== 'lm-swimmer' ) {
        return new WP_Error(
            'invalid_swimmer',
            __( 'Swimmer not found.', 'aquaticpro' ),
            [ 'status' => 404 ]
        );
    }
    
    // Check if swimmer already has a permanent token (use same token as email system)
    $existing_token = get_post_meta( $swimmer_id, 'lm_evaluation_token', true );
    
    if ( $existing_token ) {
        // Return existing permanent token
        $share_url = add_query_arg( [
            'swimmer_progress' => $existing_token,
        ], home_url( '/' ) );
        
        $created = get_post_meta( $swimmer_id, 'lm_evaluation_token_created', true );
        
        return new WP_REST_Response( [
            'success'     => true,
            'token'       => $existing_token,
            'share_url'   => $share_url,
            'is_permanent' => true,
            'created'     => $created ? (int) $created : null,
            'created_formatted' => $created ? date_i18n( get_option( 'date_format' ), $created ) : null,
        ], 200 );
    }
    
    // Generate a new unique permanent token (same format as email system)
    $token = bin2hex( random_bytes( 32 ) );
    
    // Store token in swimmer meta (no expiration) - same meta key as email system
    update_post_meta( $swimmer_id, 'lm_evaluation_token', $token );
    update_post_meta( $swimmer_id, 'lm_evaluation_token_created', time() );
    update_post_meta( $swimmer_id, 'lm_evaluation_token_created_by', get_current_user_id() );
    
    // Remove any old expiration meta if it exists
    delete_post_meta( $swimmer_id, 'lm_evaluation_token_expires' );
    
    // Generate the share URL
    $share_url = add_query_arg( [
        'swimmer_progress' => $token,
    ], home_url( '/' ) );
    
    return new WP_REST_Response( [
        'success'     => true,
        'token'       => $token,
        'share_url'   => $share_url,
        'is_permanent' => true,
        'created'     => time(),
        'created_formatted' => date_i18n( get_option( 'date_format' ), time() ),
    ], 200 );
}

/**
 * Get public swimmer progress data using a share token.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response with swimmer data or error.
 */
function aquaticpro_lm_get_public_swimmer_progress( $request ) {
    $token = $request->get_param( 'token' );
    
    if ( empty( $token ) ) {
        return new WP_Error(
            'invalid_token',
            __( 'Invalid share link.', 'aquaticpro' ),
            [ 'status' => 400 ]
        );
    }
    
    // Find swimmer by token (unified token system)
    $swimmers = get_posts( [
        'post_type'      => 'lm-swimmer',
        'posts_per_page' => 1,
        'post_status'    => 'publish',
        'meta_query'     => [
            'relation' => 'OR',
            [
                'key'     => 'lm_evaluation_token',
                'value'   => $token,
                'compare' => '=',
            ],
            [
                // Legacy support for old share tokens
                'key'     => '_share_token',
                'value'   => $token,
                'compare' => '=',
            ],
        ],
    ] );
    
    if ( empty( $swimmers ) ) {
        return new WP_Error(
            'invalid_token',
            __( 'This share link is invalid or has been revoked.', 'aquaticpro' ),
            [ 'status' => 404 ]
        );
    }
    
    $swimmer = $swimmers[0];
    $swimmer_id = $swimmer->ID;
    
    // Tokens are now permanent - no expiration check needed
    // Legacy tokens with expiration dates will continue to work indefinitely
    
    // Get swimmer data
    $swimmer_meta = get_post_meta( $swimmer_id );
    
    // Get current level
    $current_level_id = isset( $swimmer_meta['current_level'][0] ) ? (int) $swimmer_meta['current_level'][0] : null;
    $current_level = null;
    if ( $current_level_id ) {
        $level_post = get_post( $current_level_id );
        if ( $level_post ) {
            $current_level = [
                'id'    => $level_post->ID,
                'name'  => $level_post->post_title,
            ];
        }
    }
    
    // Get skills mastered
    $skills_mastered = [];
    if ( isset( $swimmer_meta['skills_mastered'][0] ) ) {
        $skills_data = maybe_unserialize( $swimmer_meta['skills_mastered'][0] );
        if ( is_array( $skills_data ) ) {
            $skills_mastered = $skills_data;
        }
    }
    
    // Get levels mastered
    $levels_mastered = [];
    if ( isset( $swimmer_meta['levels_mastered'][0] ) ) {
        $levels_data = maybe_unserialize( $swimmer_meta['levels_mastered'][0] );
        if ( is_array( $levels_data ) ) {
            $levels_mastered = $levels_data;
        }
    }
    
    // Get all levels with their skills for progress display
    $all_levels = get_posts( [
        'post_type'      => 'lm-level',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
    ] );
    
    // Sort levels by sort_order meta (ascending) - do this in PHP to ensure consistent ordering
    usort( $all_levels, function( $a, $b ) {
        $order_a = (int) get_post_meta( $a->ID, 'sort_order', true );
        $order_b = (int) get_post_meta( $b->ID, 'sort_order', true );
        return $order_a - $order_b;
    } );
    
    // Get ALL skills once, then filter by level_associated
    $all_skills = get_posts( [
        'post_type'      => 'lm-skill',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
    ] );
    
    // Sort skills by sort_order meta (ascending)
    usort( $all_skills, function( $a, $b ) {
        $order_a = (int) get_post_meta( $a->ID, 'sort_order', true );
        $order_b = (int) get_post_meta( $b->ID, 'sort_order', true );
        return $order_a - $order_b;
    } );
    
    $levels_with_skills = [];
    foreach ( $all_levels as $level ) {
        $level_id = $level->ID;
        
        // Get skills associated with this level via level_associated meta
        $skills = [];
        foreach ( $all_skills as $skill_post ) {
            $skill_level = get_post_meta( $skill_post->ID, 'level_associated', true );
            if ( (int) $skill_level === $level_id ) {
                $mastery = null;
                foreach ( $skills_mastered as $sm ) {
                    if ( isset( $sm['skill_id'] ) && (int) $sm['skill_id'] === (int) $skill_post->ID ) {
                        $mastery = $sm;
                        break;
                    }
                }
                
                $skills[] = [
                    'id'        => $skill_post->ID,
                    'name'      => $skill_post->post_title,
                    'mastered'  => $mastery !== null,
                    'date'      => $mastery ? ( $mastery['date'] ?? null ) : null,
                ];
            }
        }
        
        // Check if level is mastered
        // levels_mastered is an array of level IDs (integers), not objects
        $level_mastery = in_array( $level_id, $levels_mastered, false );
        
        $levels_with_skills[] = [
            'id'       => $level_id,
            'name'     => $level->post_title,
            'mastered' => $level_mastery,
            'date'     => null, // levels_mastered doesn't store dates
            'skills'   => $skills,
        ];
    }
    
    // Get evaluations for this swimmer
    $evaluations = get_posts( [
        'post_type'      => 'lm-evaluation',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'meta_query'     => [
            [
                'key'     => 'swimmer',
                'value'   => $swimmer_id,
                'compare' => '=',
            ],
        ],
        'orderby'        => 'date',
        'order'          => 'DESC',
    ] );
    
    $evaluation_data = [];
    foreach ( $evaluations as $eval ) {
        $eval_meta = get_post_meta( $eval->ID );
        
        // Get level name - check both 'level_evaluated' (new format) and 'level' (legacy)
        $eval_level_id = isset( $eval_meta['level_evaluated'][0] ) 
            ? (int) $eval_meta['level_evaluated'][0] 
            : ( isset( $eval_meta['level'][0] ) ? (int) $eval_meta['level'][0] : null );
        $eval_level_name = '';
        if ( $eval_level_id ) {
            $eval_level = get_post( $eval_level_id );
            if ( $eval_level ) {
                $eval_level_name = $eval_level->post_title;
            }
        }
        
        // Get notes - check multiple sources:
        // 1. post_content (standard WordPress content)
        // 2. 'content' meta (stored by EvaluationManager)
        // 3. 'notes' meta (legacy format)
        $notes = '';
        if ( ! empty( $eval->post_content ) ) {
            $notes = wp_strip_all_tags( $eval->post_content );
        } elseif ( isset( $eval_meta['content'][0] ) && ! empty( $eval_meta['content'][0] ) ) {
            $notes = wp_strip_all_tags( $eval_meta['content'][0] );
        } elseif ( isset( $eval_meta['notes'][0] ) && ! empty( $eval_meta['notes'][0] ) ) {
            $notes = $eval_meta['notes'][0];
        }
        
        // Check if emailed (our "passed" equivalent - if emailed, evaluation is complete)
        $is_emailed = isset( $eval_meta['emailed'][0] ) ? (bool) $eval_meta['emailed'][0] : false;
        
        // Get the author (instructor who conducted the evaluation)
        $author_id = $eval->post_author;
        $author_name = '';
        if ( $author_id ) {
            $author = get_userdata( $author_id );
            if ( $author ) {
                $author_name = $author->display_name;
            }
        }
        
        $evaluation_data[] = [
            'id'            => $eval->ID,
            'date'          => $eval->post_date,
            'level'         => $eval_level_name,
            'level_id'      => $eval_level_id,
            'notes'         => $notes,
            'skills_worked' => isset( $eval_meta['skills_worked'][0] ) ? maybe_unserialize( $eval_meta['skills_worked'][0] ) : [],
            'passed'        => $is_emailed, // If emailed, consider it "passed/complete"
            'author'        => $author_name,
            'author_id'     => (int) $author_id,
        ];
    }
    
    // Calculate progress statistics based on actual displayed data
    // This ensures consistency between the numbers shown and the visual display
    $total_skills = 0;
    $mastered_skills_count = 0;
    $total_levels = count( $levels_with_skills );
    $mastered_levels_count = 0;
    
    foreach ( $levels_with_skills as $level ) {
        $level_skill_count = count( $level['skills'] );
        $total_skills += $level_skill_count;
        
        // Count mastered skills from the actual displayed skills
        foreach ( $level['skills'] as $skill ) {
            if ( $skill['mastered'] ) {
                $mastered_skills_count++;
            }
        }
        
        // Count mastered levels from the actual displayed levels
        if ( $level['mastered'] ) {
            $mastered_levels_count++;
        }
    }
    
    return new WP_REST_Response( [
        'swimmer' => [
            'id'   => $swimmer_id,
            'name' => $swimmer->post_title,
        ],
        'current_level'  => $current_level,
        'progress'       => [
            'levels'         => $levels_with_skills,
            'skills_mastered' => $mastered_skills_count,
            'skills_total'    => $total_skills,
            'levels_mastered' => $mastered_levels_count,
            'levels_total'    => $total_levels,
            'percentage'      => $total_levels > 0 ? round( ( $mastered_levels_count / $total_levels ) * 100 ) : 0,
        ],
        'evaluations'    => $evaluation_data,
    ], 200 );
}

/**
 * Revoke a swimmer's share link.
 *
 * @param WP_REST_Request $request The request object.
 * @return WP_REST_Response|WP_Error Response indicating success or error.
 */
function aquaticpro_lm_revoke_swimmer_share_link( $request ) {
    $swimmer_id = $request->get_param( 'id' );
    
    // Verify swimmer exists
    $swimmer = get_post( $swimmer_id );
    if ( ! $swimmer || $swimmer->post_type !== 'lm-swimmer' ) {
        return new WP_Error(
            'invalid_swimmer',
            __( 'Swimmer not found.', 'aquaticpro' ),
            [ 'status' => 404 ]
        );
    }
    
    // Remove token meta (unified token system)
    delete_post_meta( $swimmer_id, 'lm_evaluation_token' );
    delete_post_meta( $swimmer_id, 'lm_evaluation_token_expires' );
    delete_post_meta( $swimmer_id, 'lm_evaluation_token_created' );
    delete_post_meta( $swimmer_id, 'lm_evaluation_token_created_by' );
    
    // Also remove legacy share token meta if it exists
    delete_post_meta( $swimmer_id, '_share_token' );
    delete_post_meta( $swimmer_id, '_share_token_expires' );
    delete_post_meta( $swimmer_id, '_share_token_created' );
    delete_post_meta( $swimmer_id, '_share_token_created_by' );
    
    return new WP_REST_Response( [
        'success' => true,
        'message' => __( 'Share link has been revoked.', 'aquaticpro' ),
    ], 200 );
}
