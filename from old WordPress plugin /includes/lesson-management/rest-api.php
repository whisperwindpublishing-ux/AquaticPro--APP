<?php
/**
 * REST API Customizations
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

/**
 * Check if current user has lesson management permissions.
 * 
 * @param string $permission The permission to check: 'view', 'create', 'edit', 'delete', 'moderate_all'
 * @return bool True if user has permission, false otherwise.
 */
function lm_user_can( $permission = 'view' ) {
    $user_id = get_current_user_id();
    
    // Not logged in
    if ( ! $user_id ) {
        return false;
    }
    
    // Admins always have full access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    // Get user's lesson management permissions from their job roles
    // Use the same function from cpt-registration.php
    if ( ! function_exists( 'lm_get_user_lesson_permissions' ) ) {
        // Function not loaded yet - deny access
        return false;
    }
    
    $perms = lm_get_user_lesson_permissions( $user_id );
    
    if ( empty( $perms ) ) {
        return false;
    }
    
    // Map permission strings to database fields
    $permission_map = [
        'view' => 'can_view',
        'create' => 'can_create',
        'edit' => 'can_edit',
        'delete' => 'can_delete',
        'moderate_all' => 'can_moderate_all',
    ];
    
    $field = $permission_map[ $permission ] ?? 'can_view';
    
    return ! empty( $perms[ $field ] );
}

add_filter( 'rest_pre_insert_lm-group', 'lm_check_group_conflict', 10, 2 );
add_filter( 'rest_pre_insert_lm-swimmer', 'lm_check_swimmer_conflict', 10, 2 );
add_filter( 'rest_pre_insert_lm-evaluation', 'lm_check_evaluation_conflict', 10, 2 );
add_action( 'rest_api_init', 'lm_register_post_lock_routes' );
add_action( 'save_post', 'lm_track_post_editor', 10, 1 );

/**
 * Track who edited a post.
 */
function lm_track_post_editor( $post_id ) {
    // Only track our custom post types
    $post_type = get_post_type( $post_id );
    if ( ! in_array( $post_type, [ 'lm-group', 'lm-swimmer', 'lm-evaluation' ], true ) ) {
        return;
    }
    
    $current_user_id = get_current_user_id();
    if ( $current_user_id ) {
        update_post_meta( $post_id, '_edit_last', $current_user_id );
    }
}

/**
 * Check for conflicts when updating a group.
 *
 * @param stdClass        $prepared_post The prepared post object.
 * @param WP_REST_Request $request       The request object.
 * @return stdClass|WP_Error The prepared post or error if conflict detected.
 */
function lm_check_group_conflict( $prepared_post, $request ) {
    // Only check on updates (not new posts)
    if ( empty( $prepared_post->ID ) ) {
        return $prepared_post;
    }

    $original_modified = $request->get_param( 'original_modified' );
    if ( empty( $original_modified ) ) {
        return $prepared_post;
    }

    $current_post = get_post( $prepared_post->ID );
    if ( ! $current_post ) {
        return $prepared_post;
    }

    $current_user_id = get_current_user_id();
    
    // Get the user who last modified the post
    $last_modifier = get_post_meta( $prepared_post->ID, '_edit_last', true );
    
    // Compare timestamps with tolerance
    $current_time = strtotime( $current_post->post_modified_gmt );
    $original_time = strtotime( $original_modified );
    $time_difference = abs( $current_time - $original_time );
    
    // Only flag conflict if the post was modified AFTER the user opened it
    // This prevents false positives from old edits by other users
    if ( $time_difference > 2 ) {
        // Check if someone else has an active lock on this post
        $lock = get_post_meta( $prepared_post->ID, '_edit_lock', true );
        $is_locked = false;
        $lock_user_id = null;
        
        if ( $lock ) {
            $lock_parts = explode( ':', $lock );
            if ( count( $lock_parts ) === 2 ) {
                $lock_time = $lock_parts[0];
                $lock_user_id = $lock_parts[1];
                // WordPress locks expire after 150 seconds
                $is_locked = ( time() - $lock_time ) < 150 && $lock_user_id != $current_user_id;
            }
        }
        
        // Only flag as conflict if someone else has an active lock OR
        // the modification happened very recently (within 10 minutes) by someone else
        $is_recent_edit = ( $current_time > $original_time ) && ( $time_difference < 600 );
        
        if ( ( $is_locked || $is_recent_edit ) && $last_modifier && $last_modifier != $current_user_id ) {
            $modifier_name = 'another user';
            $modifier = get_userdata( $last_modifier );
            if ( $modifier ) {
                $modifier_name = $modifier->display_name;
            }
            
            return new WP_Error(
                'conflict_detected',
                sprintf( 'This group was modified by %s. Please refresh and try again.', $modifier_name ),
                [ 'status' => 409, 'current_modified' => $current_post->post_modified_gmt, 'modified_by' => $modifier_name ]
            );
        }
    }

    return $prepared_post;
}

/**
 * Check for conflicts when updating a swimmer.
 *
 * @param stdClass        $prepared_post The prepared post object.
 * @param WP_REST_Request $request       The request object.
 * @return stdClass|WP_Error The prepared post or error if conflict detected.
 */
function lm_check_swimmer_conflict( $prepared_post, $request ) {
    // Only check on updates (not new posts)
    if ( empty( $prepared_post->ID ) ) {
        return $prepared_post;
    }

    $original_modified = $request->get_param( 'original_modified' );
    if ( empty( $original_modified ) ) {
        return $prepared_post;
    }

    $current_post = get_post( $prepared_post->ID );
    if ( ! $current_post ) {
        return $prepared_post;
    }

    $current_user_id = get_current_user_id();
    
    // Get the user who last modified the post
    $last_modifier = get_post_meta( $prepared_post->ID, '_edit_last', true );
    
    // Compare timestamps with tolerance
    $current_time = strtotime( $current_post->post_modified_gmt );
    $original_time = strtotime( $original_modified );
    $time_difference = abs( $current_time - $original_time );
    
    // Only flag conflict if the post was modified AFTER the user opened it
    // This prevents false positives from old edits by other users
    if ( $time_difference > 2 ) {
        // Check if someone else has an active lock on this post
        $lock = get_post_meta( $prepared_post->ID, '_edit_lock', true );
        $is_locked = false;
        $lock_user_id = null;
        
        if ( $lock ) {
            $lock_parts = explode( ':', $lock );
            if ( count( $lock_parts ) === 2 ) {
                $lock_time = $lock_parts[0];
                $lock_user_id = $lock_parts[1];
                // WordPress locks expire after 150 seconds
                $is_locked = ( time() - $lock_time ) < 150 && $lock_user_id != $current_user_id;
            }
        }
        
        // Only flag as conflict if someone else has an active lock OR
        // the modification happened very recently (within 10 minutes) by someone else
        $is_recent_edit = ( $current_time > $original_time ) && ( $time_difference < 600 );
        
        if ( ( $is_locked || $is_recent_edit ) && $last_modifier && $last_modifier != $current_user_id ) {
            $modifier_name = 'another user';
            $modifier = get_userdata( $last_modifier );
            if ( $modifier ) {
                $modifier_name = $modifier->display_name;
            }
            
            return new WP_Error(
                'conflict_detected',
                sprintf( 'This swimmer was modified by %s. Please refresh and try again.', $modifier_name ),
                [ 'status' => 409, 'current_modified' => $current_post->post_modified_gmt, 'modified_by' => $modifier_name ]
            );
        }
    }

    return $prepared_post;
}

/**
 * Check for conflicts when updating an evaluation.
 *
 * @param stdClass        $prepared_post The prepared post object.
 * @param WP_REST_Request $request       The request object.
 * @return stdClass|WP_Error The prepared post or error if conflict detected.
 */
function lm_check_evaluation_conflict( $prepared_post, $request ) {
    // Only check on updates (not new posts)
    if ( empty( $prepared_post->ID ) ) {
        return $prepared_post;
    }

    $original_modified = $request->get_param( 'original_modified' );
    if ( empty( $original_modified ) ) {
        return $prepared_post;
    }

    $current_post = get_post( $prepared_post->ID );
    if ( ! $current_post ) {
        return $prepared_post;
    }

    $current_user_id = get_current_user_id();
    
    // Get the user who last modified the post
    $last_modifier = get_post_meta( $prepared_post->ID, '_edit_last', true );
    
    // Compare timestamps with tolerance
    $current_time = strtotime( $current_post->post_modified_gmt );
    $original_time = strtotime( $original_modified );
    $time_difference = abs( $current_time - $original_time );
    
    // Only flag conflict if the post was modified AFTER the user opened it
    // This prevents false positives from old edits by other users
    if ( $time_difference > 2 ) {
        // Check if someone else has an active lock on this post
        $lock = get_post_meta( $prepared_post->ID, '_edit_lock', true );
        $is_locked = false;
        $lock_user_id = null;
        
        if ( $lock ) {
            $lock_parts = explode( ':', $lock );
            if ( count( $lock_parts ) === 2 ) {
                $lock_time = $lock_parts[0];
                $lock_user_id = $lock_parts[1];
                // WordPress locks expire after 150 seconds
                $is_locked = ( time() - $lock_time ) < 150 && $lock_user_id != $current_user_id;
            }
        }
        
        // Only flag as conflict if someone else has an active lock OR
        // the modification happened very recently (within 10 minutes) by someone else
        $is_recent_edit = ( $current_time > $original_time ) && ( $time_difference < 600 );
        
        if ( ( $is_locked || $is_recent_edit ) && $last_modifier && $last_modifier != $current_user_id ) {
            $modifier_name = 'another user';
            $modifier = get_userdata( $last_modifier );
            if ( $modifier ) {
                $modifier_name = $modifier->display_name;
            }
            
            return new WP_Error(
                'conflict_detected',
                sprintf( 'This evaluation was modified by %s. Please refresh and try again.', $modifier_name ),
                [ 'status' => 409, 'current_modified' => $current_post->post_modified_gmt, 'modified_by' => $modifier_name ]
            );
        }
    }

    return $prepared_post;
}

add_filter( 'rest_lm-evaluation_query', 'lm_filter_evaluations_by_swimmer_search', 10, 2 );

/**
 * Register REST API routes for post locking.
 */
function lm_register_post_lock_routes() {
    register_rest_route( 'lm/v1', '/lock/(?P<post_type>[\w-]+)/(?P<post_id>\d+)', [
        'methods'             => 'POST',
        'callback'            => 'lm_set_post_lock',
        'permission_callback' => function () {
            return lm_user_can( 'edit' );
        },
        'args'                => [
            'post_type' => [
                'required' => true,
                'type'     => 'string',
            ],
            'post_id'   => [
                'required' => true,
                'type'     => 'integer',
            ],
        ],
    ] );

    register_rest_route( 'lm/v1', '/unlock/(?P<post_type>[\w-]+)/(?P<post_id>\d+)', [
        'methods'             => 'POST',
        'callback'            => 'lm_remove_post_lock',
        'permission_callback' => function () {
            return lm_user_can( 'edit' );
        },
        'args'                => [
            'post_type' => [
                'required' => true,
                'type'     => 'string',
            ],
            'post_id'   => [
                'required' => true,
                'type'     => 'integer',
            ],
        ],
    ] );

    register_rest_route( 'lm/v1', '/check-lock/(?P<post_type>[\w-]+)/(?P<post_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'lm_check_post_lock',
        'permission_callback' => function () {
            return lm_user_can( 'view' );
        },
        'args'                => [
            'post_type' => [
                'required' => true,
                'type'     => 'string',
            ],
            'post_id'   => [
                'required' => true,
                'type'     => 'integer',
            ],
        ],
    ] );

    register_rest_route( 'lm/v1', '/force-unlock/(?P<post_type>[\w-]+)/(?P<post_id>\d+)', [
        'methods'             => 'POST',
        'callback'            => 'lm_force_unlock_post',
        'permission_callback' => function () {
            return lm_user_can( 'moderate_all' );
        },
        'args'                => [
            'post_type' => [
                'required' => true,
                'type'     => 'string',
            ],
            'post_id'   => [
                'required' => true,
                'type'     => 'integer',
            ],
        ],
    ] );
}

/**
 * Force unlock a post (remove any existing lock).
 */
function lm_force_unlock_post( $request ) {
    $post_id = (int) $request['post_id'];
    $user_id = get_current_user_id();

    error_log( sprintf( '[LM Lock] Force unlocking - Post ID: %d, User ID: %d', $post_id, $user_id ) );

    if ( ! $user_id ) {
        error_log( '[LM Lock] Error: No user logged in' );
        return new WP_Error( 'unauthorized', 'You must be logged in.', [ 'status' => 401 ] );
    }

    if ( ! lm_user_can( 'edit' ) ) {
        error_log( sprintf( '[LM Lock] Error: User %d cannot edit lesson management posts', $user_id ) );
        return new WP_Error( 'forbidden', 'You do not have permission to edit this post.', [ 'status' => 403 ] );
    }

    // Force remove the lock (remove any existing lock, regardless of owner)
    delete_post_meta( $post_id, '_edit_lock' );
    error_log( sprintf( '[LM Lock] Force lock removed for post %d by user %d', $post_id, $user_id ) );

    return new WP_REST_Response( [ 'success' => true ], 200 );
}

/**
 * Set a post lock for the current user.
 */
function lm_set_post_lock( $request ) {
    // Load required WordPress functions
    if ( ! function_exists( 'wp_set_post_lock' ) ) {
        require_once ABSPATH . 'wp-admin/includes/post.php';
    }

    $post_id = (int) $request['post_id'];
    $user_id = get_current_user_id();

    error_log( sprintf( '[LM Lock] Setting lock - Post ID: %d, User ID: %d', $post_id, $user_id ) );

    if ( ! $user_id ) {
        error_log( '[LM Lock] Error: No user logged in' );
        return new WP_Error( 'unauthorized', 'You must be logged in.', [ 'status' => 401 ] );
    }

    // Check if post exists
    $post = get_post( $post_id );
    if ( ! $post ) {
        error_log( sprintf( '[LM Lock] Error: Post %d does not exist', $post_id ) );
        return new WP_Error( 'post_not_found', 'Post not found.', [ 'status' => 404 ] );
    }

    // Check if user can edit lesson management posts
    if ( ! lm_user_can( 'edit' ) ) {
        error_log( sprintf( '[LM Lock] Error: User %d cannot edit lesson management posts', $user_id ) );
        return new WP_Error( 'forbidden', 'You do not have permission to edit this post.', [ 'status' => 403 ] );
    }

    // Use WordPress's built-in post locking
    $lock_result = wp_set_post_lock( $post_id );
    error_log( sprintf( '[LM Lock] wp_set_post_lock result: %s', print_r( $lock_result, true ) ) );

    return new WP_REST_Response( [ 'success' => true, 'user_id' => $user_id, 'lock' => $lock_result ], 200 );
}

/**
 * Remove a post lock.
 */
function lm_remove_post_lock( $request ) {
    $post_id = (int) $request['post_id'];
    $user_id = get_current_user_id();

    error_log( sprintf( '[LM Lock] Removing lock - Post ID: %d, User ID: %d', $post_id, $user_id ) );

    if ( ! $user_id ) {
        error_log( '[LM Lock] Error: No user logged in' );
        return new WP_Error( 'unauthorized', 'You must be logged in.', [ 'status' => 401 ] );
    }

    delete_post_meta( $post_id, '_edit_lock' );
    error_log( sprintf( '[LM Lock] Lock removed for post %d', $post_id ) );

    return new WP_REST_Response( [ 'success' => true ], 200 );
}

/**
 * Check if a post is locked by another user.
 */
function lm_check_post_lock( $request ) {
    // Load required WordPress functions
    if ( ! function_exists( 'wp_check_post_lock' ) ) {
        require_once ABSPATH . 'wp-admin/includes/post.php';
    }

    $post_id = (int) $request['post_id'];
    $user_id = get_current_user_id();

    error_log( sprintf( '[LM Lock] Checking lock - Post ID: %d, Current User ID: %d', $post_id, $user_id ) );

    $lock = wp_check_post_lock( $post_id );
    error_log( sprintf( '[LM Lock] wp_check_post_lock result: %s', $lock ? $lock : 'null (not locked)' ) );

    if ( $lock && $lock != $user_id ) {
        $user = get_userdata( $lock );
        error_log( sprintf( '[LM Lock] Post is locked by user %d (%s)', $lock, $user ? $user->display_name : 'Unknown' ) );
        return new WP_REST_Response( [
            'locked'      => true,
            'locked_by'   => $user ? $user->display_name : 'Another user',
            'locked_by_id' => $lock,
        ], 200 );
    }

    error_log( '[LM Lock] Post is not locked or locked by current user' );
    return new WP_REST_Response( [ 'locked' => false ], 200 );
}

add_filter( 'rest_lm-evaluation_query', 'lm_filter_evaluations_by_swimmer_search', 10, 2 );

/**
 * Filters the REST API query for evaluations to allow searching by swimmer name.
 *
 * @param array           $args    The query arguments.
 * @param WP_REST_Request $request The request object.
 * @return array The modified query arguments.
 */
function lm_filter_evaluations_by_swimmer_search( $args, $request ) {
    // Priority 1: Check for a specific swimmer ID.
    $swimmer_id = $request->get_param('swimmer');
    if ( ! empty( $swimmer_id ) && is_numeric( $swimmer_id ) ) {
        $args['meta_key']   = 'swimmer';
        $args['meta_value'] = (int) $swimmer_id;
        return $args;
    }

    // Priority 2: Check for a swimmer name search term.
    $search_term = $request->get_param( 'swimmer_search' );
    if ( ! empty( $search_term ) ) {
        $swimmer_query_args = [
            'post_type'      => 'lm-swimmer',
            'posts_per_page' => -1,
            's'              => sanitize_text_field( $search_term ),
            'fields'         => 'ids',
        ];

        $swimmer_ids = get_posts( $swimmer_query_args );

        if ( empty( $swimmer_ids ) ) {
            $args['post__in'] = [0]; // Return no evaluations if no swimmers found.
        } else {
            $args['meta_key']     = 'swimmer';
            $args['meta_value']   = $swimmer_ids;
            $args['meta_compare'] = 'IN';
        }
    }

    return $args;
}

add_action( 'rest_api_init', 'lm_register_evaluation_rest_fields' );

/**
 * Register custom REST API fields for the 'lm-evaluation' post type.
 */
function lm_register_evaluation_rest_fields() {
	register_rest_field(
		'lm-evaluation', // Post type slug.
		'swimmer_name',  // New field name.
		[
			'get_callback'    => 'lm_get_swimmer_name_for_rest_api',
			'update_callback' => null, // We don't need to update this field directly.
			'schema'          => [
				'description' => __( 'The name of the associated swimmer.', 'lesson-management' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
		]
	);
	
	// Register author_name field
	register_rest_field(
		'lm-evaluation',
		'author_name',
		[
			'get_callback'    => 'lm_get_author_name_for_rest_api',
			'update_callback' => null,
			'schema'          => [
				'description' => __( 'The name of the evaluation author (instructor).', 'lesson-management' ),
				'type'        => 'string',
				'context'     => [ 'view', 'edit' ],
			],
		]
	);
}

/**
 * Get the swimmer's name for the 'swimmer_name' REST API field.
 *
 * @param array $object The response object.
 * @return string|null The swimmer's name, or null if not found.
 */
function lm_get_swimmer_name_for_rest_api( $object ) {
	$swimmer_id = get_post_meta( $object['id'], 'swimmer', true );

	return $swimmer_id ? get_the_title( $swimmer_id ) : null;
}

/**
 * Get the author's name for the 'author_name' REST API field.
 *
 * @param array $object The response object.
 * @return string|null The author's name, or null if not found.
 */
function lm_get_author_name_for_rest_api( $object ) {
	$post = get_post( $object['id'] );
	if ( ! $post || ! $post->post_author ) {
		return null;
	}
	
	$author = get_userdata( $post->post_author );
	return $author ? $author->display_name : null;
}

add_action( 'rest_api_init', 'lm_register_essential_data_route' );

/**
 * Registers the custom REST API route for essential data.
 */
function lm_register_essential_data_route() {
    register_rest_route( 'lm/v1', '/essential-data', [
        'methods'             => 'GET',
        'callback'            => 'lm_rest_essential_data',
        'permission_callback' => function () {
            return lm_user_can( 'view' );
        },
    ] );

    register_rest_route( 'lm/v1', '/clear-cache', [
        'methods'             => 'POST',
        'callback'            => 'lm_rest_clear_cache',
        'permission_callback' => function () {
            return lm_user_can( 'edit' );
        },
        // No args needed, we're just triggering an action.
    ] );
}

add_action( 'rest_api_init', function () {
    register_rest_route( 'lm/v1', '/users/search', [
        'methods'             => 'GET',
        'callback'            => 'lm_search_users',
        'permission_callback' => function () {
            return lm_user_can( 'view' );
        },
        'args'                => [
            'search' => [
                'required'    => true,
                'description' => __( 'Search term for users.', 'lesson-management' ),
                'type'        => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ] );
} );

/**
 * REST API callback to get essential data (levels, skills, users, taxonomies).
 *
 * @return WP_REST_Response
 */
function lm_rest_essential_data() {
    $data = lm_get_essential_data();
    $response = new WP_REST_Response( $data, 200 );
    // Add HTTP cache headers - static data, 1 hour browser cache
    if ( function_exists( 'mp_add_cache_headers' ) ) {
        $response = mp_add_cache_headers( $response, 3600, 300, false );
    }
    return $response;
}

/**
 * REST API callback to clear the essential data transient.
 *
 * @return WP_REST_Response
 */
function lm_rest_clear_cache() {
    delete_transient( 'lm_essential_data' );
    return new WP_REST_Response( [ 'success' => true, 'message' => 'Cache cleared.' ], 200 );
}

/**
 * Fetches and caches essential plugin data (levels, skills, users, taxonomies).
 *
 * @return array An associative array of essential data.
 */
function lm_get_essential_data() {
    $transient_key = 'lm_essential_data';
    $data = get_transient( $transient_key );

    if ( false === $data ) {
        // Helper to process post meta into a flattened object, converting numeric strings to integers
        $process_post_meta = function($post_id) {
            $meta_raw = get_post_meta($post_id);
            $meta_processed = [];
            foreach ($meta_raw as $key => $value) {
                // Flatten single-value arrays (common for meta fields), keep multi-value arrays as is
                $meta_processed[$key] = (is_array($value) && count($value) === 1) ? $value[0] : $value;
                // Attempt to convert numeric strings to actual numbers if applicable
                if (is_numeric($meta_processed[$key])) {
                    $meta_processed[$key] = (int)$meta_processed[$key];
                } elseif (is_array($meta_processed[$key])) {
                    // If it's an array, try to convert its elements to integers
                    $meta_processed[$key] = array_map(function($item) {
                        return is_numeric($item) ? (int)$item : $item;
                    }, $meta_processed[$key]);
                }
            }
            return (object)$meta_processed; // Cast to object for consistency with REST API structure
        };

        // Fetch levels
        $levels_posts = get_posts( [
            'post_type'      => 'lm-level',
            'posts_per_page' => -1,
            'orderby'        => 'meta_value_num', // Order by the numeric value of 'sort_order' meta key
            'meta_key'       => 'sort_order',
            'order'          => 'ASC',
            'post_status'    => 'publish',
        ] );
        $formatted_levels = array_map(function($post) use ($process_post_meta) {
            return (object)[
                'id' => $post->ID,
                'title' => (object)['rendered' => $post->post_title],
                'meta' => $process_post_meta($post->ID),
            ];
        }, $levels_posts);

        // Fetch skills
        $skills_posts = get_posts( [
            'post_type'      => 'lm-skill',
            'posts_per_page' => -1,
            'post_status'    => 'publish',
        ] );
        $formatted_skills = array_map(function($post) use ($process_post_meta) {
            return (object)[
                'id' => $post->ID,
                'title' => (object)['rendered' => $post->post_title],
                'meta' => $process_post_meta($post->ID),
            ];
        }, $skills_posts);

        // Fetch users (instructors) - fetch only the first 100 for performance.
        // Additional users can be loaded via the search endpoint when needed.
        $users_data = get_users( [
            'number'   => 100,
            'fields'   => [ 'ID', 'display_name' ],
            'orderby'  => 'display_name',
            'order'    => 'ASC',
        ] );
        $formatted_users = array_map(function($user) {
            return (object)[
                'id' => $user->ID,
                'display_name' => $user->display_name,
            ];
        }, $users_data);

        // Fetch taxonomies (camps, animals, lesson types)
        // get_terms returns objects with 'term_id', 'name', etc.
        // We map 'term_id' to 'id' for consistency with REST API.
        $camps_terms = get_terms( [
            'taxonomy'   => 'lm_camp',
            'hide_empty' => false,
        ] );
        $formatted_camps = array_map(function($term) {
            return (object)[
                'id' => $term->term_id,
                'name' => $term->name,
            ];
        }, $camps_terms);

        $animals_terms = get_terms( [
            'taxonomy'   => 'lm_animal',
            'hide_empty' => false,
        ] );
        $formatted_animals = array_map(function($term) {
            return (object)[
                'id' => $term->term_id,
                'name' => $term->name,
            ];
        }, $animals_terms);

        $lesson_types_terms = get_terms( [
            'taxonomy'   => 'lm_lesson_type',
            'hide_empty' => false,
        ] );
        $formatted_lesson_types = array_map(function($term) {
            return (object)[
                'id' => $term->term_id,
                'name' => $term->name,
            ];
        }, $lesson_types_terms);

        $data = [
            'levels'      => $formatted_levels,
            'skills'      => $formatted_skills,
            'users'       => $formatted_users,
            'camps'       => $formatted_camps,
            'animals'     => $formatted_animals,
            'lessonTypes' => $formatted_lesson_types,
        ];

        // Cache the data for 12 hours (increased from 1 hour for better performance)
        set_transient( $transient_key, $data, 12 * HOUR_IN_SECONDS );
    }

    return $data;
}

/**
 * Searches for users by display name.
 *
 * @param WP_REST_Request $request The REST API request object.
 * @return WP_REST_Response The REST API response.
 */
function lm_search_users( $request ) {
    $search_term = sanitize_text_field( $request->get_param( 'search' ) );

    $users = get_users( [
        'search'         => '*' . esc_attr( $search_term ) . '*',
        'search_columns' => [ 'display_name' ],
        'number'         => 50, // Limit results for performance
        'fields'         => [ 'ID', 'display_name' ],
        'orderby'        => 'display_name',
        'order'          => 'ASC',
    ] );

    $formatted_users = array_map(function( $user ) {
        return [
            'id'   => $user->ID,
            'name' => $user->display_name,
        ];
    }, $users);

    return new WP_REST_Response( $formatted_users, 200 );
}

add_action( 'rest_api_init', 'lm_register_group_routes' );

/**
 * Registers the custom REST API routes for groups.
 */
function lm_register_group_routes() {
    // Route for creating a new group.
    register_rest_route( 'lm/v1', '/groups', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_create_group_item',
            'permission_callback' => function () {
                return lm_user_can( 'create' );
            },
        ],
        [
            'methods'             => 'GET',
            'callback'            => 'lm_get_groups',
            'permission_callback' => function () {
                return lm_user_can( 'view' );
            },
        ],
    ] );

    // Route for updating an existing group by ID.
    register_rest_route( 'lm/v1', '/groups/(?P<id>\d+)', [
        [
            'methods'             => 'POST', // Often 'PUT' or 'PATCH' are used, but 'POST' works.
            'callback'            => 'lm_update_group_item',
            'permission_callback' => function () {
                return lm_user_can( 'edit' );
            },
            'args'                => [
                'id' => [
                    'validate_callback' => function ( $param, $request, $key ) {
                        return is_numeric( $param );
                    },
                ],
            ],
        ],
    ] );
}

/**
 * Invalidate lesson management groups cache
 * Called when groups are created, updated, or deleted
 * 
 * @deprecated Use mp_invalidate_lesson_management_caches() from security-helpers.php instead
 */
function lm_invalidate_groups_cache() {
    // Delegate to centralized function
    if (function_exists('mp_invalidate_lesson_management_caches')) {
        mp_invalidate_lesson_management_caches('group');
    }
}

/**
 * Handles creating a new group item.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response|WP_Error The response object or a WP_Error on failure.
 */
function lm_create_group_item( $request ) {
    $params = $request->get_params();

    $post_arr = [
        'post_title'  => sanitize_text_field( $params['title'] ),
        'post_status' => 'publish',
        'post_type'   => 'lm-group',
    ];

    $group_id = wp_insert_post( $post_arr, true );

    if ( is_wp_error( $group_id ) ) {
        return $group_id;
    }

    // Handle meta and taxonomy data.
    lm_save_group_meta_and_tax( $group_id, $params );
    
    // Invalidate groups cache
    lm_invalidate_groups_cache();

    // Re-fetch the post object to get the latest data.
    $post = get_post( $group_id );
    $controller = new WP_REST_Posts_Controller( 'lm-group' );
    return $controller->prepare_item_for_response( $post, $request );
}

/**
 * Retrieves a list of groups.
 * Cached for 5 minutes for performance.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response object.
 */
function lm_get_groups( $request ) {
    // Check cache first (5 minute TTL)
    $cache_key = 'lm_groups_list';
    $force_refresh = $request->get_param('refresh') === 'true';
    
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            $response = rest_ensure_response( $cached );
            $response->header( 'X-Cache-Status', 'HIT' );
            // Add HTTP cache headers (5 min browser cache)
            if ( function_exists( 'mp_add_cache_headers' ) ) {
                $response = mp_add_cache_headers( $response, 300, 60, true );
            }
            return $response;
        }
    }
    
    $args = [
        'post_type'      => 'lm-group',
        'posts_per_page' => -1, // Adjust if pagination is needed
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
    ];

    $query      = new WP_Query( $args );
    $controller = new WP_REST_Posts_Controller( 'lm-group' );
    $result = $controller->prepare_items_for_response( $query->posts, $request );
    
    // Extract data from response for caching
    $data = $result->get_data();
    
    // Cache for 5 minutes
    set_transient( $cache_key, $data, 5 * MINUTE_IN_SECONDS );
    
    $response = rest_ensure_response( $data );
    $response->header( 'X-Cache-Status', 'MISS' );
    // Add HTTP cache headers (5 min browser cache)
    if ( function_exists( 'mp_add_cache_headers' ) ) {
        $response = mp_add_cache_headers( $response, 300, 60, true );
    }
    return $response;
}

/**
 * Handles updating an existing group item.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response|WP_Error The response object or a WP_Error on failure.
 */
function lm_update_group_item( $request ) {
    $group_id = $request['id'];
    $params   = $request->get_params();
    $current_user_id = get_current_user_id();

    // Conflict detection: Check if the post was modified by someone else
    if ( ! empty( $params['original_modified'] ) ) {
        $post = get_post( $group_id );
        if ( $post ) {
            // Get the user who last modified the post
            $last_modifier = get_post_meta( $group_id, '_edit_last', true );
            
            error_log( sprintf(
                '[LM Save] Group %d - Current User: %d, Last Modifier: %s, Current Modified: %s, Original Modified: %s',
                $group_id,
                $current_user_id,
                $last_modifier ?: 'none',
                $post->post_modified_gmt,
                $params['original_modified']
            ) );
            
            // If the last modifier was NOT the current user, check for conflicts
            if ( $last_modifier && (int) $last_modifier !== (int) $current_user_id ) {
                // Convert timestamps to Unix timestamps for reliable comparison
                $current_timestamp = strtotime( $post->post_modified_gmt );
                $original_timestamp = strtotime( $params['original_modified'] );
                
                if ( $current_timestamp === false ) {
                    $current_timestamp = time(); // Fallback if parsing fails
                }
                if ( $original_timestamp === false ) {
                    $original_timestamp = time(); // Fallback if parsing fails
                }
                
                $time_difference = abs( $current_timestamp - $original_timestamp );
                
                error_log( sprintf(
                    '[LM Save] Conflict check - Time diff: %d seconds (tolerance: 2 seconds)',
                    $time_difference
                ) );
                
                // Only flag conflict if there's more than 2 seconds difference
                if ( $time_difference > 2 ) {
                    $modifier_name = 'another user';
                    $modifier = get_userdata( $last_modifier );
                    if ( $modifier ) {
                        $modifier_name = $modifier->display_name;
                    }
                    
                    error_log( sprintf(
                        '[LM Save] CONFLICT DETECTED on group %d - Modified by %s',
                        $group_id,
                        $modifier_name
                    ) );
                    
                    return new WP_Error(
                        'conflict_detected',
                        sprintf( 'This group was modified by %s. Please refresh and try again.', $modifier_name ),
                        [ 'status' => 409, 'current_modified' => $post->post_modified_gmt, 'modified_by' => $modifier_name ]
                    );
                }
            }
        }
    }

    $post_arr = [
        'ID'          => $group_id,
        'post_title'  => sanitize_text_field( $params['title'] ),
        'post_status' => 'publish',
    ];

    $result = wp_update_post( $post_arr, true );

    if ( is_wp_error( $result ) ) {
        error_log( sprintf( '[LM Save] wp_update_post failed for group %d: %s', $group_id, $result->get_error_message() ) );
        return $result;
    }

    error_log( sprintf( '[LM Save] wp_update_post succeeded for group %d', $group_id ) );

    // Handle meta and taxonomy data.
    lm_save_group_meta_and_tax( $group_id, $params );
    
    // Invalidate groups cache
    lm_invalidate_groups_cache();

    // Re-fetch the post object to get the latest data.
    $post = get_post( $group_id );
    $controller = new WP_REST_Posts_Controller( 'lm-group' );
    $response = $controller->prepare_item_for_response( $post, $request );
    
    error_log( sprintf( '[LM Save] Group %d saved successfully, returning response', $group_id ) );
    
    return $response;
}

/**
 * Helper function to update meta and taxonomies for a group.
 *
 * @param int   $group_id The ID of the group post.
 * @param array $params   The request parameters.
 */
function lm_save_group_meta_and_tax( $group_id, $params ) {
    if ( isset( $params['meta'] ) && is_array( $params['meta'] ) ) {
        foreach ( $params['meta'] as $key => $value ) {
            // The 'swimmers' meta field has a sanitize_callback defined in cpt-registration.php
            // which will handle the array of integers. For others, we rely on default sanitization.
            $result = update_post_meta( $group_id, $key, $value );
            error_log( sprintf( '[LM Save Meta] Group %d, Key: %s, Result: %s', $group_id, $key, $result ? 'true' : 'false' ) );
        }
    }

    // Handle taxonomies.
    $taxonomies = [ 'lm_camp', 'lm_animal', 'lm_lesson_type' ];
    foreach ( $taxonomies as $tax_slug ) {
        if ( isset( $params[ $tax_slug ] ) ) {
            $result = wp_set_post_terms( $group_id, $params[ $tax_slug ], $tax_slug, false );
            error_log( sprintf( '[LM Save Tax] Group %d, Tax: %s, Result: %s', $group_id, $tax_slug, is_wp_error( $result ) ? 'ERROR: ' . $result->get_error_message() : 'ok' ) );
        }
    }
}

add_action( 'rest_api_init', 'lm_register_share_link_route' );

/**
 * Registers the REST API route for generating a swimmer share link.
 */
function lm_register_share_link_route() {
    register_rest_route('lm/v1', '/swimmers/(?P<id>\d+)/share-link', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_generate_swimmer_share_link',
            'permission_callback' => function () {
                return lm_user_can('edit');
            },
        ],
    ]);
}

/**
 * Generates and returns a shareable evaluation link for a swimmer.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function lm_generate_swimmer_share_link($request) {
    $swimmer_id = $request['id'];

    // Check if the swimmer exists
    if (get_post_type($swimmer_id) !== 'lm-swimmer') {
        return new WP_REST_Response(['message' => 'Invalid swimmer ID.'], 404);
    }

    // Generate a new, unique token and set its expiration
    $token = bin2hex(random_bytes(32));
    update_post_meta($swimmer_id, 'lm_evaluation_token', $token);
    update_post_meta($swimmer_id, 'lm_evaluation_token_expires', time() + (MONTH_IN_SECONDS));
    
    // Construct the full, shareable link using path-based URL
    $evaluation_link = home_url( '/swimmer-progress/' . $token );

    return new WP_REST_Response(['share_link' => $evaluation_link], 200);
}

add_action( 'rest_api_init', 'lm_register_swimmer_search_route' );

/**
 * Registers the custom REST API route for searching swimmers.
 */
function lm_register_swimmer_search_route() {
    register_rest_route('lm/v1', '/search-swimmers', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_search_swimmers',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
        ],
    ]);
}

/**
 * Searches for swimmers and returns them with their notes.
 * Supports pagination for lazy loading.
 * If no search term is provided, returns swimmers alphabetically.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response object.
 */
function lm_search_swimmers($request) {
    // Rate limiting for swimmer search
    if (function_exists('mp_check_rate_limit')) {
        $rate_check = mp_check_rate_limit('/lm/v1/search-swimmers', 60, 60);
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }
    }
    
    $search_term = $request->get_param('search');
    $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
    $per_page = 50;
    
    $query_args = [
        'post_type'      => 'lm-swimmer',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
    ];
    
    // If search term provided, use it
    if (!empty($search_term)) {
        $query_args['s'] = $search_term;
    }

    $query = new WP_Query($query_args);
    $swimmers = $query->posts;
    $total_pages = $query->max_num_pages;

    $formatted_swimmers = array_map(function ($swimmer) {
        $level_id = get_post_meta($swimmer->ID, 'current_level', true);
        $level_name = $level_id ? get_the_title($level_id) : 'N/A';
        $notes = get_post_meta($swimmer->ID, 'notes', true);
        $dob = get_post_meta($swimmer->ID, 'date_of_birth', true);

        return (object)[
            'id'    => $swimmer->ID,
            'title' => (object)['rendered' => get_the_title($swimmer->ID)],
            'meta'  => (object)[
                'current_level' => $level_id ? (int) $level_id : null,
                'notes' => $notes ?: '',
                'date_of_birth' => $dob ?: '',
            ],
            'level_name' => $level_name,
        ];
    }, $swimmers);

    return new WP_REST_Response([
        'swimmers' => $formatted_swimmers,
        'page' => $page,
        'total_pages' => $total_pages,
        'has_more' => $page < $total_pages,
    ], 200);
}

add_action('rest_api_init', 'lm_register_batch_fetch_routes');
add_action('rest_api_init', 'lm_register_cached_data_routes');

/**
 * ========================================================================
 * SERVER-SIDE CACHED ENDPOINTS
 * These endpoints use WordPress transients to cache data server-side,
 * dramatically reducing database queries for frequently-accessed reference data.
 * ========================================================================
 */

/**
 * Registers REST API routes for server-cached reference data.
 * Clients can call these instead of the standard WP REST endpoints for faster responses.
 */
function lm_register_cached_data_routes() {
    // Cached swimmers list - server-side transient cache
    register_rest_route('lm/v1', '/swimmers-cached', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_get_cached_swimmers',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
        ],
    ]);
    
    // Cached levels list
    register_rest_route('lm/v1', '/levels-cached', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_get_cached_levels',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
        ],
    ]);
    
    // Cached skills list
    register_rest_route('lm/v1', '/skills-cached', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_get_cached_skills',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
        ],
    ]);
    
    // Cached groups list - server-side transient cache
    register_rest_route('lm/v1', '/groups-cached', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_get_cached_groups',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
        ],
    ]);
    
    // Invalidate cache (called when swimmers/levels/skills/groups are updated)
    register_rest_route('lm/v1', '/cache-invalidate', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_invalidate_cache',
            'permission_callback' => function () {
                return lm_user_can('edit');
            },
            'args' => [
                'type' => [
                    'required' => true,
                    'type' => 'string',
                    'enum' => ['swimmers', 'levels', 'skills', 'groups', 'all'],
                ],
            ],
        ],
    ]);
}

/**
 * Get all swimmers with server-side caching (30 minute TTL).
 * This is MUCH faster than hitting the database on every request.
 */
function lm_get_cached_swimmers($request) {
    $cache_key = 'lm_swimmers_cache';
    $cache_duration = 30 * MINUTE_IN_SECONDS; // 30 minutes
    
    // Try to get from cache first
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return new WP_REST_Response([
            'swimmers' => $cached,
            'cached' => true,
            'count' => count($cached),
        ], 200);
    }
    
    // Cache miss - fetch from database
    $query = new WP_Query([
        'post_type'      => 'lm-swimmer',
        'posts_per_page' => -1, // Get all
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
        'no_found_rows'  => true, // Faster when we don't need pagination
        'update_post_meta_cache' => true,
        'update_post_term_cache' => false,
    ]);
    
    $swimmers = [];
    foreach ($query->posts as $post) {
        $swimmers[] = [
            'id'    => $post->ID,
            'title' => ['rendered' => get_the_title($post->ID)],
            'meta'  => [
                'current_level'   => (int) get_post_meta($post->ID, 'current_level', true) ?: null,
                'notes'           => get_post_meta($post->ID, 'notes', true) ?: '',
                'date_of_birth'   => get_post_meta($post->ID, 'date_of_birth', true) ?: '',
                'parent_name'     => get_post_meta($post->ID, 'parent_name', true) ?: '',
                'parent_email'    => get_post_meta($post->ID, 'parent_email', true) ?: '',
                'archived'        => (bool) get_post_meta($post->ID, 'archived', true),
            ],
        ];
    }
    
    // Store in cache
    set_transient($cache_key, $swimmers, $cache_duration);
    
    return new WP_REST_Response([
        'swimmers' => $swimmers,
        'cached' => false,
        'count' => count($swimmers),
    ], 200);
}

/**
 * Get all levels with server-side caching (1 hour TTL - levels rarely change).
 */
function lm_get_cached_levels($request) {
    $cache_key = 'lm_levels_cache';
    $cache_duration = HOUR_IN_SECONDS; // 1 hour
    
    // Try cache first
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return new WP_REST_Response([
            'levels' => $cached,
            'cached' => true,
        ], 200);
    }
    
    // Cache miss - fetch from database
    $terms = get_terms([
        'taxonomy'   => 'lm-level',
        'hide_empty' => false,
    ]);
    
    // If lm-level is a taxonomy
    if (!is_wp_error($terms) && !empty($terms)) {
        $levels = array_map(function($term) {
            return [
                'id'    => $term->term_id,
                'title' => ['rendered' => $term->name],
                'meta'  => [
                    'sort_order' => (int) get_term_meta($term->term_id, 'sort_order', true) ?: 0,
                ],
            ];
        }, $terms);
    } else {
        // lm-level might be a CPT
        $query = new WP_Query([
            'post_type'      => 'lm-level',
            'posts_per_page' => -1,
            'post_status'    => 'publish',
            'no_found_rows'  => true,
        ]);
        
        $levels = [];
        foreach ($query->posts as $post) {
            $levels[] = [
                'id'    => $post->ID,
                'title' => ['rendered' => get_the_title($post->ID)],
                'meta'  => [
                    'sort_order' => (int) get_post_meta($post->ID, 'sort_order', true) ?: 0,
                ],
            ];
        }
    }
    
    // Sort by sort_order
    usort($levels, function($a, $b) {
        return ($a['meta']['sort_order'] ?? 0) - ($b['meta']['sort_order'] ?? 0);
    });
    
    set_transient($cache_key, $levels, $cache_duration);
    
    return new WP_REST_Response([
        'levels' => $levels,
        'cached' => false,
    ], 200);
}

/**
 * Get all skills with server-side caching (1 hour TTL).
 */
function lm_get_cached_skills($request) {
    $cache_key = 'lm_skills_cache';
    $cache_duration = HOUR_IN_SECONDS;
    
    // Try cache first
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return new WP_REST_Response([
            'skills' => $cached,
            'cached' => true,
        ], 200);
    }
    
    // Cache miss - fetch from database
    $query = new WP_Query([
        'post_type'      => 'lm-skill',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'no_found_rows'  => true,
    ]);
    
    $skills = [];
    foreach ($query->posts as $post) {
        $skills[] = [
            'id'    => $post->ID,
            'title' => ['rendered' => get_the_title($post->ID)],
            'meta'  => [
                'sort_order'       => (int) get_post_meta($post->ID, 'sort_order', true) ?: 0,
                'level_associated' => (int) get_post_meta($post->ID, 'level_associated', true) ?: null,
            ],
        ];
    }
    
    // Sort by sort_order
    usort($skills, function($a, $b) {
        return ($a['meta']['sort_order'] ?? 0) - ($b['meta']['sort_order'] ?? 0);
    });
    
    set_transient($cache_key, $skills, $cache_duration);
    
    return new WP_REST_Response([
        'skills' => $skills,
        'cached' => false,
    ], 200);
}

/**
 * Get all groups with server-side caching (10 minute TTL - groups change more frequently).
 */
function lm_get_cached_groups($request) {
    $cache_key = 'lm_groups_cache';
    $cache_duration = 10 * MINUTE_IN_SECONDS; // 10 minutes
    
    // Try to get from cache first
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return new WP_REST_Response([
            'groups' => $cached,
            'cached' => true,
            'count' => count($cached),
        ], 200);
    }
    
    // Cache miss - fetch from database
    $query = new WP_Query([
        'post_type'      => 'lm-group',
        'posts_per_page' => -1, // Get all
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
        'no_found_rows'  => true, // Faster when we don't need pagination
        'update_post_meta_cache' => true,
        'update_post_term_cache' => true,
    ]);
    
    $groups = [];
    foreach ($query->posts as $post) {
        // Get taxonomy terms
        $camps = wp_get_post_terms($post->ID, 'lm_camp', ['fields' => 'ids']);
        $animals = wp_get_post_terms($post->ID, 'lm_animal', ['fields' => 'ids']);
        $lesson_types = wp_get_post_terms($post->ID, 'lm_lesson_type', ['fields' => 'ids']);
        
        $groups[] = [
            'id'             => $post->ID,
            'title'          => ['rendered' => get_the_title($post->ID)],
            'status'         => $post->post_status,
            'lm_camp'        => is_array($camps) ? array_map('intval', $camps) : [],
            'lm_animal'      => is_array($animals) ? array_map('intval', $animals) : [],
            'lm_lesson_type' => is_array($lesson_types) ? array_map('intval', $lesson_types) : [],
            'meta'  => [
                'instructor'       => (array) get_post_meta($post->ID, 'instructor', true) ?: [],
                'swimmers'         => (array) get_post_meta($post->ID, 'swimmers', true) ?: [],
                'swimmer_grouping' => (array) get_post_meta($post->ID, 'swimmer_grouping', true) ?: [],
                'level'            => (int) get_post_meta($post->ID, 'level', true) ?: null,
                'days'             => (array) get_post_meta($post->ID, 'days', true) ?: [],
                'group_time'       => get_post_meta($post->ID, 'group_time', true) ?: '',
                'notes'            => get_post_meta($post->ID, 'notes', true) ?: '',
                'dates_offered'    => (array) get_post_meta($post->ID, 'dates_offered', true) ?: [],
                'media'            => (int) get_post_meta($post->ID, 'media', true) ?: null,
                'year'             => (int) get_post_meta($post->ID, 'year', true) ?: null,
                'archived'         => (bool) get_post_meta($post->ID, 'archived', true),
            ],
        ];
    }
    
    // Store in cache
    set_transient($cache_key, $groups, $cache_duration);
    
    return new WP_REST_Response([
        'groups' => $groups,
        'cached' => false,
        'count' => count($groups),
    ], 200);
}

/**
 * Invalidate server-side cache when data changes.
 */
function lm_invalidate_cache($request) {
    $type = $request->get_param('type');
    
    $invalidated = [];
    
    if ($type === 'swimmers' || $type === 'all') {
        delete_transient('lm_swimmers_cache');
        $invalidated[] = 'swimmers';
    }
    if ($type === 'groups' || $type === 'all') {
        delete_transient('lm_groups_cache');
        $invalidated[] = 'groups';
    }
    if ($type === 'levels' || $type === 'all') {
        delete_transient('lm_levels_cache');
        $invalidated[] = 'levels';
    }
    if ($type === 'skills' || $type === 'all') {
        delete_transient('lm_skills_cache');
        $invalidated[] = 'skills';
    }
    
    return new WP_REST_Response([
        'success' => true,
        'invalidated' => $invalidated,
    ], 200);
}

/**
 * Auto-invalidate cache when swimmers are created/updated/deleted.
 */
add_action('save_post_lm-swimmer', 'lm_invalidate_swimmer_cache_on_save', 10, 1);
add_action('delete_post', 'lm_invalidate_swimmer_cache_on_delete', 10, 1);
add_action('trashed_post', 'lm_invalidate_swimmer_cache_on_delete', 10, 1);

function lm_invalidate_swimmer_cache_on_save($post_id) {
    delete_transient('lm_swimmers_cache');
}

function lm_invalidate_swimmer_cache_on_delete($post_id) {
    if (get_post_type($post_id) === 'lm-swimmer') {
        delete_transient('lm_swimmers_cache');
    }
}

/**
 * Auto-invalidate cache when levels/skills are updated.
 */
add_action('save_post_lm-level', function($post_id) {
    delete_transient('lm_levels_cache');
}, 10, 1);

add_action('save_post_lm-skill', function($post_id) {
    delete_transient('lm_skills_cache');
}, 10, 1);

/**
 * Auto-invalidate group cache when groups are created/updated/deleted.
 */
add_action('save_post_lm-group', function($post_id) {
    delete_transient('lm_groups_cache');
}, 10, 1);

add_action('delete_post', function($post_id) {
    if (get_post_type($post_id) === 'lm-group') {
        delete_transient('lm_groups_cache');
    }
}, 10, 1);

add_action('trashed_post', function($post_id) {
    if (get_post_type($post_id) === 'lm-group') {
        delete_transient('lm_groups_cache');
    }
}, 10, 1);

/**
 * Registers REST API routes for fetching swimmers/users/groups by IDs.
 * This enables displaying group card previews without loading ALL swimmers.
 */
function lm_register_batch_fetch_routes() {
    // Fetch swimmers by specific IDs (for group card display)
    register_rest_route('lm/v1', '/swimmers-by-ids', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_get_swimmers_by_ids',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
            'args' => [
                'ids' => [
                    'required' => true,
                    'type' => 'array',
                    'items' => ['type' => 'integer'],
                ],
            ],
        ],
    ]);

    // Fetch instructors (users) by specific IDs (for group card display)
    register_rest_route('lm/v1', '/instructors-by-ids', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_get_instructors_by_ids',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
            'args' => [
                'ids' => [
                    'required' => true,
                    'type' => 'array',
                    'items' => ['type' => 'integer'],
                ],
            ],
        ],
    ]);
    
    // Fetch groups by specific IDs
    register_rest_route('lm/v1', '/groups-by-ids', [
        [
            'methods'             => 'POST',
            'callback'            => 'lm_get_groups_by_ids',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
            'args' => [
                'ids' => [
                    'required' => true,
                    'type' => 'array',
                    'items' => ['type' => 'integer'],
                ],
            ],
        ],
    ]);
    
    // Search groups with pagination
    register_rest_route('lm/v1', '/search-groups', [
        [
            'methods'             => 'GET',
            'callback'            => 'lm_search_groups',
            'permission_callback' => function () {
                return lm_user_can('view');
            },
            'args' => [
                'search' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'page' => [
                    'type' => 'integer',
                    'default' => 1,
                ],
                'camp_id' => [
                    'type' => 'integer',
                    'default' => 0,
                ],
            ],
        ],
    ]);
}

/**
 * Get swimmers by an array of IDs.
 * Returns swimmer data including skills_mastered for display purposes.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response with swimmers data.
 */
function lm_get_swimmers_by_ids($request) {
    $ids = $request->get_param('ids');
    
    if (empty($ids)) {
        return new WP_REST_Response(['swimmers' => []], 200);
    }
    
    // Sanitize and limit IDs to prevent abuse
    $ids = array_map('intval', $ids);
    $ids = array_slice($ids, 0, 500); // Max 500 swimmers per request
    
    $query_args = [
        'post_type'      => 'lm-swimmer',
        'posts_per_page' => count($ids),
        'post__in'       => $ids,
        'post_status'    => 'publish',
        'orderby'        => 'post__in', // Preserve order of input IDs
    ];

    $query = new WP_Query($query_args);
    $swimmers = $query->posts;

    $formatted_swimmers = array_map(function ($swimmer) {
        $notes = get_post_meta($swimmer->ID, 'notes', true);
        $level_id = get_post_meta($swimmer->ID, 'current_level', true);
        $dob = get_post_meta($swimmer->ID, 'date_of_birth', true);
        $skills_mastered = get_post_meta($swimmer->ID, 'skills_mastered', true);
        $levels_mastered = get_post_meta($swimmer->ID, 'levels_mastered', true);
        $parent_name = get_post_meta($swimmer->ID, 'parent_name', true);
        $parent_email = get_post_meta($swimmer->ID, 'parent_email', true);

        return [
            'id'    => $swimmer->ID,
            'title' => ['rendered' => get_the_title($swimmer->ID)],
            'meta'  => [
                'current_level' => $level_id ? (int) $level_id : null,
                'notes' => $notes ?: '',
                'date_of_birth' => $dob ?: '',
                'skills_mastered' => is_array($skills_mastered) ? $skills_mastered : [],
                'levels_mastered' => is_array($levels_mastered) ? $levels_mastered : [],
                'parent_name' => $parent_name ?: '',
                'parent_email' => $parent_email ?: '',
            ],
        ];
    }, $swimmers);

    return new WP_REST_Response(['swimmers' => $formatted_swimmers], 200);
}

/**
 * Get instructors (WordPress users) by an array of IDs.
 * Returns lightweight user data for display purposes.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response with instructors data.
 */
function lm_get_instructors_by_ids($request) {
    $ids = $request->get_param('ids');
    
    if (empty($ids)) {
        return new WP_REST_Response(['instructors' => []], 200);
    }
    
    // Sanitize and limit IDs
    $ids = array_map('intval', $ids);
    $ids = array_slice($ids, 0, 100); // Max 100 instructors per request
    
    $users = get_users([
        'include' => $ids,
        'fields'  => ['ID', 'display_name'],
    ]);
    
    $formatted_instructors = array_map(function ($user) {
        return [
            'id'   => (int) $user->ID,
            'name' => $user->display_name,
        ];
    }, $users);

    return new WP_REST_Response(['instructors' => $formatted_instructors], 200);
}

/**
 * Get groups by an array of IDs.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response with groups data.
 */
function lm_get_groups_by_ids($request) {
    $ids = $request->get_param('ids');
    
    if (empty($ids)) {
        return new WP_REST_Response(['groups' => []], 200);
    }
    
    // Sanitize and limit IDs to prevent abuse
    $ids = array_map('intval', $ids);
    $ids = array_slice($ids, 0, 200); // Max 200 groups per request
    
    $query = new WP_Query([
        'post_type'      => 'lm-group',
        'posts_per_page' => count($ids),
        'post__in'       => $ids,
        'post_status'    => 'publish',
        'orderby'        => 'post__in',
    ]);
    
    $groups = [];
    foreach ($query->posts as $post) {
        $camps = wp_get_post_terms($post->ID, 'lm_camp', ['fields' => 'ids']);
        $animals = wp_get_post_terms($post->ID, 'lm_animal', ['fields' => 'ids']);
        $lesson_types = wp_get_post_terms($post->ID, 'lm_lesson_type', ['fields' => 'ids']);
        
        $groups[] = [
            'id'             => $post->ID,
            'title'          => ['rendered' => get_the_title($post->ID)],
            'status'         => $post->post_status,
            'lm_camp'        => is_array($camps) ? array_map('intval', $camps) : [],
            'lm_animal'      => is_array($animals) ? array_map('intval', $animals) : [],
            'lm_lesson_type' => is_array($lesson_types) ? array_map('intval', $lesson_types) : [],
            'meta'  => [
                'instructor'       => (array) get_post_meta($post->ID, 'instructor', true) ?: [],
                'swimmers'         => (array) get_post_meta($post->ID, 'swimmers', true) ?: [],
                'swimmer_grouping' => (array) get_post_meta($post->ID, 'swimmer_grouping', true) ?: [],
                'level'            => (int) get_post_meta($post->ID, 'level', true) ?: null,
                'days'             => (array) get_post_meta($post->ID, 'days', true) ?: [],
                'group_time'       => get_post_meta($post->ID, 'group_time', true) ?: '',
                'notes'            => get_post_meta($post->ID, 'notes', true) ?: '',
                'archived'         => (bool) get_post_meta($post->ID, 'archived', true),
            ],
        ];
    }
    
    return new WP_REST_Response(['groups' => $groups], 200);
}

/**
 * Search groups with pagination.
 *
 * @param WP_REST_Request $request The REST API request.
 * @return WP_REST_Response The response with search results.
 */
function lm_search_groups($request) {
    $search = sanitize_text_field($request->get_param('search'));
    $page = (int) $request->get_param('page');
    $camp_id = (int) $request->get_param('camp_id');
    $per_page = 20;
    
    $query_args = [
        'post_type'      => 'lm-group',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
    ];
    
    if (!empty($search)) {
        $query_args['s'] = $search;
    }
    
    if ($camp_id > 0) {
        $query_args['tax_query'] = [
            [
                'taxonomy' => 'lm_camp',
                'field'    => 'term_id',
                'terms'    => $camp_id,
            ],
        ];
    }
    
    $query = new WP_Query($query_args);
    
    $groups = [];
    foreach ($query->posts as $post) {
        $camps = wp_get_post_terms($post->ID, 'lm_camp', ['fields' => 'ids']);
        $animals = wp_get_post_terms($post->ID, 'lm_animal', ['fields' => 'ids']);
        
        $groups[] = [
            'id'        => $post->ID,
            'title'     => ['rendered' => get_the_title($post->ID)],
            'status'    => $post->post_status,
            'lm_camp'   => is_array($camps) ? array_map('intval', $camps) : [],
            'lm_animal' => is_array($animals) ? array_map('intval', $animals) : [],
            'meta'      => [
                'level'    => (int) get_post_meta($post->ID, 'level', true) ?: null,
                'archived' => (bool) get_post_meta($post->ID, 'archived', true),
            ],
        ];
    }
    
    $total_pages = $query->max_num_pages;
    
    return new WP_REST_Response([
        'groups'      => $groups,
        'page'        => $page,
        'total_pages' => $total_pages,
        'has_more'    => $page < $total_pages,
    ], 200);
}

/**
 * ========================================================================
 * Camp Organizer Endpoints
 * ========================================================================
 */

add_action('rest_api_init', 'lm_register_camp_organizer_routes');

function lm_register_camp_organizer_routes() {
    // Check permission
    register_rest_route('lm/v1', '/camp-organizer/check-permission', [
        'methods' => 'GET',
        'callback' => 'lm_camp_organizer_check_permission',
        'permission_callback' => '__return_true', // We check inside
    ]);

    // Load camp data
    register_rest_route('lm/v1', '/camp-organizer/load', [
        'methods' => 'GET',
        'callback' => 'lm_camp_organizer_load',
        'permission_callback' => 'lm_camp_organizer_permission_check',
    ]);

    // Save camp changes
    register_rest_route('lm/v1', '/camp-organizer/save', [
        'methods' => 'POST',
        'callback' => 'lm_camp_organizer_save',
        'permission_callback' => 'lm_camp_organizer_permission_check',
    ]);

    // Lock management
    register_rest_route('lm/v1', '/camp-organizer/acquire-lock', [
        'methods' => 'POST',
        'callback' => 'lm_camp_organizer_acquire_lock',
        'permission_callback' => 'lm_camp_organizer_permission_check',
    ]);

    register_rest_route('lm/v1', '/camp-organizer/release-lock', [
        'methods' => 'POST',
        'callback' => 'lm_camp_organizer_release_lock',
        'permission_callback' => 'lm_camp_organizer_permission_check',
    ]);

    register_rest_route('lm/v1', '/camp-organizer/check-lock', [
        'methods' => 'GET',
        'callback' => 'lm_camp_organizer_check_lock',
        'permission_callback' => 'lm_camp_organizer_permission_check',
    ]);
}

/**
 * Permission check for camp organizer - administrators or users with lesson management permissions
 */
function lm_camp_organizer_permission_check() {
    // Always allow administrators
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    // Check lesson management permissions from job roles
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return false;
    }
    
    // Use the shared permission function if available
    if ( function_exists( 'lm_get_user_lesson_permissions' ) ) {
        $permissions = lm_get_user_lesson_permissions( $user_id );
        if ( $permissions ) {
            // Allow if user can edit or has moderate_all permission
            if ( ! empty( $permissions['can_edit'] ) || ! empty( $permissions['can_moderate_all'] ) ) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Ensure instructor/swimmer arrays only contain unique positive integers in their original order.
 */
function lm_camp_organizer_sanitize_id_array( $ids ) {
    if ( ! is_array( $ids ) ) {
        $ids = (array) $ids;
    }

    $ids = array_map( 'intval', $ids );
    $ids = array_filter( $ids, function( $id ) {
        return $id > 0;
    } );

    $ids = array_unique( $ids );

    return array_values( $ids );
}

/**
 * Check if current user has permission to access camp organizer
 */
function lm_camp_organizer_check_permission() {
    // Always allow administrators
    if ( current_user_can( 'manage_options' ) ) {
        return new WP_REST_Response( [ 'has_permission' => true ], 200 );
    }
    
    // Check lesson management permissions from job roles
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_REST_Response( [ 'has_permission' => false ], 200 );
    }
    
    // Use the shared permission function if available
    if ( function_exists( 'lm_get_user_lesson_permissions' ) ) {
        $permissions = lm_get_user_lesson_permissions( $user_id );
        if ( $permissions ) {
            // Allow if user can view, edit, or has moderate_all permission
            $has_permission = ! empty( $permissions['can_view'] ) || 
                              ! empty( $permissions['can_edit'] ) || 
                              ! empty( $permissions['can_moderate_all'] );
            return new WP_REST_Response( [ 'has_permission' => $has_permission ], 200 );
        }
    }
    
    return new WP_REST_Response( [ 'has_permission' => false ], 200 );
}

/**
 * Load all groups for a camp, organized by animal
 */
function lm_camp_organizer_load($request) {
    $camp_id = $request->get_param('camp_id');
    $include_archived = filter_var( $request->get_param( 'include_archived' ), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
    $include_archived = (bool) $include_archived;
    
    if (empty($camp_id)) {
        return new WP_Error('missing_param', 'Camp ID is required', ['status' => 400]);
    }

    // Fetch all groups in this camp
    $groups = get_posts([
        'post_type' => 'lm-group',
        'posts_per_page' => -1,
        'tax_query' => [
            [
                'taxonomy' => 'lm_camp',
                'field' => 'term_id',
                'terms' => intval($camp_id),
            ],
        ],
        'post_status' => 'publish',
    ]);

    // Organize groups by animal
    $data = [];
    
    foreach ($groups as $group) {
        $animals = wp_get_post_terms($group->ID, 'lm_animal', ['fields' => 'ids']);
        $animal_id = !empty($animals) ? $animals[0] : 'uncategorized'; // Use first animal or 'uncategorized' as string key
        $is_archived = get_post_meta( $group->ID, 'archived', true );
        $group_is_archived = ! empty( $is_archived ) && $is_archived !== '0';

        if ( ! $include_archived && $group_is_archived ) {
            continue;
        }
        
        if (!isset($data[$animal_id])) {
            $data[$animal_id] = [
                'instructors' => [],
                'groups' => [],
            ];
        }
        
        $instructors = lm_camp_organizer_sanitize_id_array( get_post_meta( $group->ID, 'instructor', true ) ?: [] );
        $swimmers    = lm_camp_organizer_sanitize_id_array( get_post_meta( $group->ID, 'swimmers', true ) ?: [] );
        $level_id = get_post_meta($group->ID, 'level', true);
        $level_name = '';
        
        if ($level_id) {
            $level_post = get_post($level_id);
            if ($level_post) {
                $level_name = $level_post->post_title;
            }
        }
        
        // Add instructors to animal level (deduplicate)
        foreach ($instructors as $instructor_id) {
            if (!in_array($instructor_id, $data[$animal_id]['instructors'])) {
                $data[$animal_id]['instructors'][] = $instructor_id;
            }
        }
        
        // Get swimmer grouping
        $swimmer_grouping = get_post_meta($group->ID, 'swimmer_grouping', true);
        if (!is_array($swimmer_grouping)) {
            $swimmer_grouping = [];
        }
        // Convert keys to strings for JSON consistency
        $swimmer_grouping_normalized = [];
        foreach ($swimmer_grouping as $instructor_id => $swimmer_ids) {
            $swimmer_grouping_normalized[(string)$instructor_id] = array_map('intval', (array)$swimmer_ids);
        }

        // Add group
        $data[$animal_id]['groups'][] = [
            'id' => $group->ID,
            'name' => $group->post_title,
            'level' => $level_name,
            'instructors' => $instructors,
            'swimmers' => $swimmers,
            'swimmer_grouping' => $swimmer_grouping_normalized,
        ];
    }

    // Check lock status
    $lock_key = 'lm_camp_organizer_lock_' . $camp_id;
    $lock_data = get_transient($lock_key);
    $is_locked = false;
    $locked_by = '';
    
    if ($lock_data) {
        $current_user_id = get_current_user_id();
        if ($lock_data['user_id'] != $current_user_id) {
            $is_locked = true;
            $locked_by = $lock_data['user_name'];
        }
    }

    return new WP_REST_Response([
        'data' => $data,
        'locked' => $is_locked,
        'locked_by' => $locked_by,
    ], 200);
}

/**
 * Save camp organizer changes
 */
function lm_camp_organizer_save($request) {
    $camp_id = $request->get_param('camp_id');
    $updates = $request->get_param('updates');
    
    if (empty($camp_id) || empty($updates)) {
        return new WP_Error('missing_params', 'Camp ID and updates are required', ['status' => 400]);
    }

    // Verify lock
    $lock_key = 'lm_camp_organizer_lock_' . $camp_id;
    $lock_data = get_transient($lock_key);
    $current_user_id = get_current_user_id();
    
    if (!$lock_data || $lock_data['user_id'] != $current_user_id) {
        return new WP_Error('not_locked', 'You do not have the lock for this camp', ['status' => 403]);
    }

    // Apply updates
    foreach ($updates as $update) {
        $group_id = $update['group_id'];
        $instructors = lm_camp_organizer_sanitize_id_array( $update['instructors'] ?? [] );
        $swimmers = lm_camp_organizer_sanitize_id_array( $update['swimmers'] ?? [] );
        $frontend_swimmer_grouping = isset($update['swimmer_grouping']) ? $update['swimmer_grouping'] : null;
        
        // Verify group exists and is in this camp
        $group_camps = wp_get_post_terms($group_id, 'lm_camp', ['fields' => 'ids']);
        if (!in_array(intval($camp_id), $group_camps)) {
            continue; // Skip if group not in this camp
        }
        
        // Update meta
        update_post_meta($group_id, 'instructor', $instructors);
        update_post_meta($group_id, 'swimmers', $swimmers);

        // Use frontend swimmer_grouping if provided, otherwise build from existing
        if (is_array($frontend_swimmer_grouping) && !empty($frontend_swimmer_grouping)) {
            // Normalize frontend grouping - ensure keys are strings and values are int arrays
            $new_grouping = [];
            foreach ($frontend_swimmer_grouping as $instructor_id => $swimmer_ids) {
                $instructor_id_int = intval($instructor_id);
                // Only keep if instructor is still assigned to this group
                if (in_array($instructor_id_int, $instructors)) {
                    $swimmer_ids_int = array_map('intval', (array)$swimmer_ids);
                    // Only keep swimmers that are still in the group
                    $new_grouping[$instructor_id_int] = array_values(array_intersect($swimmer_ids_int, $swimmers));
                }
            }
            update_post_meta($group_id, 'swimmer_grouping', $new_grouping);
        } else {
            // Fallback: Preserve existing swimmer groupings while removing stale data
            $existing_grouping = get_post_meta($group_id, 'swimmer_grouping', true);
            if (!is_array($existing_grouping)) {
                $existing_grouping = [];
            }

            // Only keep lanes for instructors that are still assigned to the group
            $existing_grouping = array_intersect_key($existing_grouping, array_flip($instructors));

            // Ensure swimmer IDs are still valid and maintain order
            foreach ($existing_grouping as $coach_id => $lane_swimmers) {
                $existing_grouping[$coach_id] = array_values(array_intersect(array_map('intval', (array) $lane_swimmers), $swimmers));
            }

            $assigned_swimmers = [];
            foreach ($existing_grouping as $lane_swimmers) {
                $assigned_swimmers = array_merge($assigned_swimmers, $lane_swimmers);
            }
            $assigned_swimmers = array_unique($assigned_swimmers);

            $unassigned_swimmers = array_values(array_diff($swimmers, $assigned_swimmers));

            if (!empty($unassigned_swimmers) && !empty($instructors)) {
                $fallback_instructor = $instructors[0];
                if (!isset($existing_grouping[$fallback_instructor])) {
                    $existing_grouping[$fallback_instructor] = [];
                }
                $existing_grouping[$fallback_instructor] = array_values(array_merge(
                    $existing_grouping[$fallback_instructor],
                    $unassigned_swimmers
                ));
            }

            update_post_meta($group_id, 'swimmer_grouping', $existing_grouping);
        }
    }

    return new WP_REST_Response([
        'success' => true,
        'message' => 'Changes saved successfully',
    ], 200);
}

/**
 * Acquire lock for camp organizer
 */
function lm_camp_organizer_acquire_lock($request) {
    $camp_id = $request->get_param('camp_id');
    
    if (empty($camp_id)) {
        return new WP_Error('missing_param', 'Camp ID is required', ['status' => 400]);
    }

    $lock_key = 'lm_camp_organizer_lock_' . $camp_id;
    $current_user = wp_get_current_user();
    $current_user_id = $current_user->ID;
    
    // Check if already locked
    $existing_lock = get_transient($lock_key);
    if ($existing_lock && $existing_lock['user_id'] != $current_user_id) {
        return new WP_Error('already_locked', 'Camp is locked by another user', ['status' => 409]);
    }

    // Set lock (30 minute expiration)
    set_transient($lock_key, [
        'user_id' => $current_user_id,
        'user_name' => $current_user->display_name,
        'timestamp' => time(),
    ], 30 * MINUTE_IN_SECONDS);

    return new WP_REST_Response([
        'success' => true,
        'message' => 'Lock acquired',
    ], 200);
}

/**
 * Release lock for camp organizer
 */
function lm_camp_organizer_release_lock($request) {
    $camp_id = $request->get_param('camp_id');
    
    if (empty($camp_id)) {
        return new WP_Error('missing_param', 'Camp ID is required', ['status' => 400]);
    }

    $lock_key = 'lm_camp_organizer_lock_' . $camp_id;
    $current_user_id = get_current_user_id();
    
    // Verify this user owns the lock before releasing
    $lock_data = get_transient($lock_key);
    if ($lock_data && $lock_data['user_id'] == $current_user_id) {
        delete_transient($lock_key);
    }

    return new WP_REST_Response([
        'success' => true,
        'message' => 'Lock released',
    ], 200);
}

/**
 * Check lock status for camp organizer
 */
function lm_camp_organizer_check_lock($request) {
    $camp_id = $request->get_param('camp_id');
    
    if (empty($camp_id)) {
        return new WP_Error('missing_param', 'Camp ID is required', ['status' => 400]);
    }

    $lock_key = 'lm_camp_organizer_lock_' . $camp_id;
    $lock_data = get_transient($lock_key);
    $current_user_id = get_current_user_id();
    
    $is_locked = false;
    $locked_by = '';
    
    if ($lock_data && $lock_data['user_id'] != $current_user_id) {
        $is_locked = true;
        $locked_by = $lock_data['user_name'];
    }

    return new WP_REST_Response([
        'locked' => $is_locked,
        'locked_by' => $locked_by,
    ], 200);
}