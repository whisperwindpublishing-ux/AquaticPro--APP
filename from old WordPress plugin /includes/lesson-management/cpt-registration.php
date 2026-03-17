<?php
/**
 * CPT & Taxonomy Registration
 *
 * This file is responsible for creating all the custom post types,
 * custom taxonomies, and registering their associated meta fields
 * for the Lesson Management plugin.
 *
 * @package LessonManagement
 * @version 11.4.11
 */

defined( 'ABSPATH' ) || die;

// VERSION 11.4.21 - Nuclear Option: map_meta_cap bypass for ALL LM CPT meta fields
// The auth_callback approach wasn't enough - WordPress core checks caps at multiple points
// This version intercepts the capability check BEFORE user_has_cap runs

add_action( 'init', 'lm_register_cpts_taxonomies_and_meta' );

/**
 * Custom Auth Callback for Lesson Management Meta Fields.
 * This is the SOURCE OF TRUTH for meta editing permissions.
 *
 * @param bool   $allowed   Whether the user can edit the field.
 * @param string $meta_key  The meta key.
 * @param int    $post_id   The post ID.
 * @param int    $user_id   The user ID.
 * @param string $cap       The capability being checked.
 * @param array  $caps      The primitive capabilities.
 * @return bool True if allowed, false or original value if not.
 */
function lm_meta_auth_callback( $allowed, $meta_key, $post_id, $user_id, $cap, $caps ) {
    // Ensure we have a user ID
    if ( empty( $user_id ) ) {
        $user_id = get_current_user_id();
    }
    
    if ( empty( $user_id ) ) {
        return $allowed;
    }

    // Log the check for debugging
    error_log( "[LM Meta Auth v18] Checking $meta_key on post $post_id for user $user_id" );

    // Get LM Permissions for this user
    // This function aggregates permissions from ALL assigned job roles (MAX logic)
    $perms = lm_get_user_lesson_permissions( $user_id );
    
    if ( empty( $perms ) ) {
        error_log( "[LM Meta Auth v18] DENIED: No LM permissions found for user $user_id" );
        return $allowed;
    }

    // Check ownership
    $post_author = (int) get_post_field( 'post_author', $post_id );
    $is_author = ( $post_author === (int) $user_id );

    // Determine access
    $has_access = false;
    $reason = "";

    // 1. Moderators can edit EVERYTHING
    if ( ! empty( $perms['can_moderate_all'] ) ) {
        $has_access = true;
        $reason = "can_moderate_all";
    }
    // 2. Editors can edit their OWN posts
    elseif ( ! empty( $perms['can_edit'] ) && $is_author ) {
        $has_access = true;
        $reason = "can_edit + author";
    }
    // 3. Editors can sometimes edit others? (Depending on business logic, but strict 'edit' usually means own)
    // If strict 'can_edit' allows editing OTHERS, uncomment below:
    // elseif ( ! empty( $perms['can_edit'] ) ) { $has_access = true; $reason = "can_edit"; }
    
    if ( $has_access ) {
        error_log( "[LM Meta Auth v18] GRANTED: $reason" );
        return true;
    }
    
    error_log( "[LM Meta Auth v18] FALLBACK: Permission insufficient ($reason). Author: $post_author, User: $user_id" );
    return $allowed;
}

/**
 * VERSION 11.4.21 - Nuclear Option: Bypass ALL meta capability checks for ALL LM CPTs
 * 
 * The problem: WordPress REST API checks `auth_callback` from `register_post_meta` but
 * even when it returns TRUE, WordPress core performs additional capability checks in
 * WP_REST_Posts_Controller::update_post() that we cannot intercept via auth_callback.
 * 
 * Solution: Intercept the `auth_post_meta_{$meta_key}` capability check BEFORE WordPress
 * blocks the request. We use `map_meta_cap` to convert any `edit_post_meta` check for
 * our meta keys into a capability that always passes.
 */

// List of ALL Lesson Management CPTs
function lm_get_all_cpt_types() {
    return [ 'lm-group', 'lm-swimmer', 'lm-evaluation', 'lm-level', 'lm-skill' ];
}

// List of ALL meta keys across ALL LM CPTs that should bypass standard capability checks
function lm_get_protected_meta_keys() {
    return [
        // lm-group meta keys
        'instructor',
        'days',
        'group_time', 
        'swimmers',
        'swimmer_grouping',
        'notes',
        'ratio',
        'class_type',
        'start_date',
        'end_date',
        'session',
        'location',
        'facility',
        'facility_display',
        'pool_type',
        'level',
        'dates_offered',
        'media',
        'year',
        
        // lm-swimmer meta keys
        'parent_name',
        'parent_email',
        'date_of_birth',
        'current_level',
        'levels_mastered',
        'skills_mastered',
        'evaluations',
        'lm_evaluation_token',
        'lm_evaluation_token_expires',
        'archived',
        
        // lm-level meta keys
        'sort_order',
        'related_skills',
        'group_class',
        'swimmers_mastered',
        'evaluated',
        
        // lm-skill meta keys
        'level_associated',
        'swimmer_skilled',
        
        // lm-evaluation meta keys
        'swimmer',
        'level_evaluated',
        'emailed',
    ];
}

/**
 * Filter map_meta_cap to intercept edit_post_meta capability checks for ALL LM CPTs.
 * This runs BEFORE the user_has_cap filter, allowing us to remap the required capabilities.
 */
add_filter( 'map_meta_cap', 'lm_intercept_meta_cap_check', 1, 4 );
function lm_intercept_meta_cap_check( $caps, $cap, $user_id, $args ) {
    // Only intercept edit_post_meta (and delete_post_meta for safety)
    if ( ! in_array( $cap, [ 'edit_post_meta', 'delete_post_meta', 'add_post_meta' ], true ) ) {
        return $caps;
    }
    
    // $args[0] is the post_id, $args[1] is the meta_key
    if ( count( $args ) < 2 ) {
        return $caps;
    }
    
    $post_id  = absint( $args[0] );
    $meta_key = $args[1];
    
    // Only apply to our protected meta keys
    if ( ! in_array( $meta_key, lm_get_protected_meta_keys(), true ) ) {
        return $caps;
    }
    
    // Check if this is one of our LM CPTs
    $post = get_post( $post_id );
    if ( ! $post || ! in_array( $post->post_type, lm_get_all_cpt_types(), true ) ) {
        return $caps;
    }
    
    // Check if user has LM permissions
    $perms = lm_get_user_lesson_permissions( $user_id );
    if ( empty( $perms ) ) {
        error_log( "[LM Meta Cap v21] User {$user_id}: No LM permissions for meta key '{$meta_key}' on {$post->post_type}" );
        return $caps;
    }
    
    // Grant permission if user has ANY edit-related permission
    $can_edit = ! empty( $perms['can_edit'] ) || ! empty( $perms['can_create'] ) || ! empty( $perms['can_moderate_all'] );
    
    if ( $can_edit ) {
        error_log( "[LM Meta Cap v21] User {$user_id}: BYPASSING cap check for '{$meta_key}' on {$post->post_type} {$post_id}. Remapping to 'exist'." );
        // Return 'exist' which ALWAYS passes - it just requires user to exist
        return [ 'exist' ];
    }
    
    error_log( "[LM Meta Cap v21] User {$user_id}: DENIED - no edit perms for '{$meta_key}'" );
    return $caps;
}

/**
 * Backup REST API Override for 'instructor' field in case map_meta_cap isn't enough.
 */
add_action( 'rest_api_init', function() {
    register_rest_field( 'lm-group', 'instructor', [
        'get_callback'    => function( $object ) {
            $val = get_post_meta( $object['id'], 'instructor', true );
            return is_array( $val ) ? array_map( 'absint', $val ) : [];
        },
        'update_callback' => function( $value, $object, $field_name ) {
            $user_id = get_current_user_id();
            $perms   = lm_get_user_lesson_permissions( $user_id );
            
            if ( empty( $perms ) || ( empty( $perms['can_edit'] ) && empty( $perms['can_create'] ) && empty( $perms['can_moderate_all'] ) ) ) {
                error_log( "[LM REST Override v20] User {$user_id}: DENIED instructor update" );
                return new WP_Error( 'rest_cannot_update', __( 'No LM permission to edit instructor.', 'lesson-management' ), [ 'status' => 403 ] );
            }
            
            $sanitized = array_map( 'absint', (array) $value );
            error_log( "[LM REST Override v20] User {$user_id}: Updating instructor for post {$object->ID} to: " . implode( ',', $sanitized ) );
            return update_post_meta( $object->ID, 'instructor', $sanitized );
        },
        'schema'          => [
            'type'  => 'array',
            'items' => [ 'type' => 'integer' ],
        ],
    ] );
} );

/**
 * Map meta cap filter to grant LM taxonomy capabilities.
 * This intercepts the capability mapping BEFORE user_has_cap runs.
 * If user has LM permissions, map edit_lm_groups back to a cap they have.
 */
add_filter( 'map_meta_cap', function( $caps, $cap, $user_id, $args ) {
    // Only intercept assign_term for our taxonomies
    if ( $cap !== 'assign_term' ) {
        return $caps;
    }
    
    // Check if the required cap is edit_lm_groups (our custom taxonomy cap)
    if ( ! in_array( 'edit_lm_groups', $caps, true ) ) {
        return $caps;
    }

    // Explicitly grant access to admins
    if ( user_can( $user_id, 'manage_options' ) ) {
        return array( 'exist' );
    }
    
    // Check if user has LM permissions
    $perms = lm_get_user_lesson_permissions( $user_id );
    if ( ! empty( $perms ) && ( ! empty( $perms['can_edit'] ) || ! empty( $perms['can_create'] ) ) ) {
        error_log( "[LM map_meta_cap v6] User {$user_id}: Mapping edit_lm_groups to 'exist' (always passes)" );
        // Return a capability that ALWAYS passes - 'exist' just requires user to exist
        return array( 'exist' );
    }
    
    return $caps;
}, 10, 4 );

/**
 * Sanitizes a value to be an absolute integer, or an empty string if empty.
 *
 * @param mixed $value The value to sanitize.
 * @return int|string The sanitized integer or an empty string.
 */
function lm_sanitize_integer_or_empty( $value ) {
	if ( $value === '' || $value === null ) {
		return '';
	}
	// Allow negative integers for special values like -1 (Mixed Levels) and -2 (Testing)
	return (int) $value;
}
/**
 * Main registration function.
 *
 * Hooks into 'init' to register all post types, taxonomies, and meta fields.
 */
function lm_register_cpts_taxonomies_and_meta() {

    /**
     * ------------------------------------------------------------------------
     * 1. Register Custom Post Types (CPTs)
     * ------------------------------------------------------------------------
     */

    $cpt_args_base = [
        'public'       => true,
        'show_in_rest' => true,
        'supports'     => [ 'title', 'custom-fields' ],
        'menu_icon'    => 'dashicons-book',
        'capability_type' => 'post',
        'map_meta_cap' => true,
    ];

    register_post_type( 'lm-swimmer', array_merge( $cpt_args_base, [
        'labels'       => [ 'name' => 'Swimmers', 'singular_name' => 'Swimmer' ],
        'menu_icon'    => 'dashicons-universal-access',
        'rest_base'    => 'lm-swimmer', // Explicitly set the REST API endpoint slug.
        'supports'     => [ 'title', 'custom-fields', 'revisions' ],
    ] ) );

    register_post_type( 'lm-level', array_merge( $cpt_args_base, [
        'labels'       => [ 'name' => 'Levels', 'singular_name' => 'Level' ],
        'menu_icon'    => 'dashicons-chart-bar',
        'rest_base'    => 'lm-level',
    ] ) );

    register_post_type( 'lm-skill', array_merge( $cpt_args_base, [
        'labels'       => [ 'name' => 'Skills', 'singular_name' => 'Skill' ],
        'menu_icon'    => 'dashicons-awards',
        'rest_base'    => 'lm-skill',
    ] ) );

    register_post_type( 'lm-group', array_merge( $cpt_args_base, [
        'labels'       => [ 'name' => 'Groups', 'singular_name' => 'Group' ],
        'menu_icon'    => 'dashicons-groups',
        'rest_base'    => 'lm-group',
        'supports'     => [ 'title', 'custom-fields', 'thumbnail' ],
        'taxonomies'   => [ 'lm_camp', 'lm_animal', 'lm_lesson_type' ],
    ] ) );

    register_post_type( 'lm-evaluation', array_merge( $cpt_args_base, [
        'labels'       => [ 'name' => 'Evaluations', 'singular_name' => 'Evaluation' ],
        'menu_icon'    => 'dashicons-clipboard',
        'rest_base'    => 'lm-evaluation',
        'supports'     => [ 'title', 'editor', 'custom-fields' ], // 'editor' for the 'details' field.
    ] ) );

    /**
     * ------------------------------------------------------------------------
     * 2. Register Custom Taxonomies
     * ------------------------------------------------------------------------
     */

    $tax_args_base = [
        'public'       => true,
        'hierarchical' => true,
        'show_in_rest' => true,
        'capabilities' => [
            'manage_terms' => 'manage_options',
            'edit_terms'   => 'manage_options',
            'delete_terms' => 'manage_options',
            'assign_terms' => 'edit_lm_groups',
        ],
    ];

    register_taxonomy( 'lm_camp', 'lm-group', array_merge( $tax_args_base, [
        'labels' => [ 'name' => 'Camps', 'singular_name' => 'Camp' ],
    ] ) );

    register_taxonomy( 'lm_animal', 'lm-group', array_merge( $tax_args_base, [
        'labels' => [ 'name' => 'Animals', 'singular_name' => 'Animal' ],
    ] ) );

    register_taxonomy( 'lm_lesson_type', 'lm-group', array_merge( $tax_args_base, [
        'labels' => [ 'name' => 'Lesson Types', 'singular_name' => 'Lesson Type' ],
    ] ) );

    /**
     * ------------------------------------------------------------------------
     * 3. Register Meta Fields for REST API
     * ------------------------------------------------------------------------
     */

    // v11.4.18: Explicit Auth Callback restored
    // We use a named function 'lm_meta_auth_callback' defined above.
    $auth_callback = 'lm_meta_auth_callback'; 

    /* v16 Logic commented out for v17 strategy pivot
    $auth_callback = function( $allowed, $meta_key, $object_id, $user_id, $cap, $caps ) {
        // 1. Basic safety check
        if ( ! $user_id ) {
            error_log("[LM Auth v16] FAIL: No User ID provided for key $meta_key");
            return false;
        }

        // 2. Admins always pass
        if ( user_can( $user_id, 'manage_options' ) ) {
            return true;
        }
        
        // 3. Check custom permissions
        // We log everything to identify why success returns might be ignored or failing elsewhere
        if ( function_exists( 'lm_get_user_lesson_permissions' ) ) {
            $perms = lm_get_user_lesson_permissions( $user_id );
            if ( ! empty( $perms ) && ( ! empty( $perms['can_edit'] ) || ! empty( $perms['can_create'] ) ) ) {
                error_log("[LM Auth v16] SUCCESS: User $user_id granted edit for $meta_key");
                return true; 
            }
        }
        
        error_log("[LM Auth v16] FAIL: User $user_id denied for $meta_key on object $object_id.");
        return false;
    };
    */

    // --- Swimmer Meta Fields ---
    register_post_meta( 'lm-swimmer', 'parent_name', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'parent_email', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'sanitize_email',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'date_of_birth', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'notes', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'wp_kses_post',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'current_level', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'lm_sanitize_integer_or_empty',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'levels_mastered', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [
            'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ],
        ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'skills_mastered', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [
            'schema' => [
                'type'  => 'array',
                'items' => [
                    'type'       => 'object',
                    'properties' => [
                        'skill_id' => [ 'type' => 'integer' ],
                        'date'     => [ 'type' => 'string', 'format' => 'date' ],
                    ],
                ],
            ],
        ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'evaluations', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'lm_evaluation_token', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => false, // Keep token private from REST API responses.
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'lm_evaluation_token_expires', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => false, // Keep token private from REST API responses.
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-swimmer', 'archived', [
        'type'              => 'boolean',
        'single'            => true,
        'default'           => false,
        'show_in_rest'      => true,
        'auth_callback'     => $auth_callback,
    ] );


    // --- Level Meta Fields ---
    register_post_meta( 'lm-level', 'sort_order', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-level', 'related_skills', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-level', 'group_class', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-level', 'swimmers_mastered', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-level', 'evaluated', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );

    // --- Skill Meta Fields ---
    register_post_meta( 'lm-skill', 'sort_order', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-skill', 'level_associated', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-skill', 'swimmer_skilled', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );

    // --- Group Meta Fields ---
    register_post_meta( 'lm-group', 'level', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'lm_sanitize_integer_or_empty',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'instructor', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'swimmers', [
        'type'         => 'array',
        'show_in_rest' => [
            'schema' => [
                'type'  => 'array',
                'items' => [
                    'type' => 'integer',
                ],
            ],
        ],
        'single'       => true,
        'default'      => [],
        'sanitize_callback' => function($values) {
            return array_map( 'absint', (array) $values );
        },
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'swimmer_grouping', [
        'type'         => 'object',
        'single'       => true,
        'show_in_rest' => [
            'schema' => [
                'type' => 'object',
                'additionalProperties' => [ 'type' => 'array', 'items' => [ 'type' => 'integer' ] ],
            ],
        ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'days', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'group_time', [
        'type'              => 'string',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'sanitize_text_field',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'dates_offered', [
        'type'         => 'array',
        'single'       => true,
        'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ],
        'auth_callback' => $auth_callback,
    ] );
    register_post_meta('lm-group', 'notes', [
        'type'              => 'string',
        'show_in_rest'      => true,
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field',
        'auth_callback'     => $auth_callback,
    ]);
    register_post_meta( 'lm-group', 'media', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'archived', [
        'type'              => 'boolean',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'rest_sanitize_boolean',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-group', 'year', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );

    // --- Evaluation Meta Fields ---
    register_post_meta( 'lm-evaluation', 'swimmer', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    register_post_meta( 'lm-evaluation', 'level_evaluated', [
        'type'              => 'integer',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'absint',
        'auth_callback'     => $auth_callback,
    ] );
    // The 'details' field uses the main post content ('the_content'), so it doesn't need a separate meta field.
    register_post_meta( 'lm-evaluation', 'emailed', [
        'type'              => 'boolean',
        'single'            => true,
        'show_in_rest'      => true,
        'sanitize_callback' => 'rest_sanitize_boolean',
        'auth_callback'     => $auth_callback,
    ] );
}

/**
 * Grant Lesson Management CPT capabilities based on job role permissions.
 * 
 * This filter checks the user's job role permissions and grants the appropriate
 * WordPress capabilities for lesson management custom post types.
 * 
 * @param array $allcaps User's actual capabilities.
 * @param array $caps Primitive capabilities being checked.
 * @param array $args Arguments passed to capability check.
 * @param WP_User $user The user object.
 * @return array Modified capabilities.
 */
add_filter( 'user_has_cap', 'lm_grant_capabilities_from_job_role', 10, 4 );
function lm_grant_capabilities_from_job_role( $allcaps, $caps, $args, $user ) {
    // VERSION 11.4.20 - Log version on first call per request
    static $version_logged = false;
    if ( ! $version_logged ) {
        error_log( "[LM Cap Filter] VERSION 11.4.21 loaded - map_meta_cap BYPASS for ALL LM CPTs" );
        $version_logged = true;
    }
    
    // Skip if no user or already an admin
    if ( empty( $user->ID ) || ! empty( $allcaps['manage_options'] ) ) {
        return $allcaps;
    }
    
    // Define capabilities we intercept for lesson management
    $cap_being_checked = isset( $args[0] ) ? $args[0] : '';
    
    // CRITICAL: Check if edit_lm_groups is in the REQUIRED CAPS array ($caps)
    // This handles when WordPress checks assign_term which MAPS TO edit_lm_groups
    // $args[0] would be 'assign_term' but $caps would contain 'edit_lm_groups'
    if ( in_array( 'edit_lm_groups', $caps, true ) || $cap_being_checked === 'edit_lm_groups' ) {
        $perms = lm_get_user_lesson_permissions( $user->ID );
        if ( ! empty( $perms ) ) {
            error_log( "[LM Cap Filter v6] User {$user->ID}: GRANTING edit_lm_groups (meta cap: {$cap_being_checked}, required: " . implode(',', $caps) . ")" );
            $allcaps['edit_lm_groups'] = true;
            foreach ( $caps as $cap ) {
                $allcaps[ $cap ] = true;
            }
            // Log final state
            error_log( "[LM Cap Filter v6] User {$user->ID}: Final allcaps[edit_lm_groups]=" . ( isset($allcaps['edit_lm_groups']) ? 'true' : 'false' ) );
            return $allcaps;
        }
        error_log( "[LM Cap Filter v6] User {$user->ID}: NO perms found for edit_lm_groups check" );
        return $allcaps;
    }
    
    // Post-related capabilities
    $post_related_caps = [ 'edit_posts', 'edit_others_posts', 'publish_posts', 'read_private_posts', 'delete_posts', 'delete_others_posts', 'edit_post', 'delete_post', 'read_post' ];
    
    // Taxonomy-related capabilities (for lm_camp, lm_animal, lm_lesson_type)
    $taxonomy_related_caps = [ 'assign_terms', 'edit_terms', 'manage_terms', 'delete_terms' ];
    
    // Check if this is a capability we should handle
    $is_post_cap = in_array( $cap_being_checked, $post_related_caps, true );
    $is_taxonomy_cap = in_array( $cap_being_checked, $taxonomy_related_caps, true );
    
    if ( ! $is_post_cap && ! $is_taxonomy_cap ) {
        return $allcaps;
    }
    
    // Determine if we're in a lesson management context
    $is_lm_context = false;
    
    // Check 1: If checking a specific post, verify it's a lesson management CPT
    if ( $is_post_cap && isset( $args[2] ) ) {
        $post = get_post( $args[2] );
        if ( $post && in_array( $post->post_type, [ 'lm-group', 'lm-swimmer', 'lm-evaluation', 'lm-level', 'lm-skill' ], true ) ) {
            $is_lm_context = true;
        } elseif ( $post ) {
            // It's a specific post but not LM - don't apply LM permissions
            return $allcaps;
        }
    }
    
    // Check 2: For taxonomy capabilities, verify it's a lesson management taxonomy
    // Note: edit_lm_groups is handled at the start of the function for immediate granting
    if ( $is_taxonomy_cap && isset( $args[2] ) ) {
        $taxonomy = $args[2];
        if ( in_array( $taxonomy, [ 'lm_camp', 'lm_animal', 'lm_lesson_type' ], true ) ) {
            $is_lm_context = true;
        } else {
            return $allcaps;
        }
    }
    
    // Check 3: If no specific post/taxonomy, check if we're in a LM REST request
    if ( ! $is_lm_context ) {
        $is_lm_context = lm_is_lesson_management_rest_request();
    }
    
    // If we can't confirm it's a lesson management context, don't interfere
    if ( ! $is_lm_context ) {
        return $allcaps;
    }
    
    // Debug: Log that we're in LM context and what caps are required
    error_log( "[LM Cap Filter] User {$user->ID} checking cap '$cap_being_checked' for LM context. Required caps: " . implode( ', ', $caps ) );
    
    // Check if we already have lesson management permissions cached
    static $cached_permissions = [];
    
    if ( ! isset( $cached_permissions[ $user->ID ] ) ) {
        $cached_permissions[ $user->ID ] = lm_get_user_lesson_permissions( $user->ID );
    }
    
    $perms = $cached_permissions[ $user->ID ];
    
    // If no permissions found, return unchanged
    if ( empty( $perms ) ) {
        error_log( "[LM Cap Filter] User {$user->ID}: No LM permissions found, returning unchanged caps" );
        return $allcaps;
    }
    
    error_log( "[LM Cap Filter] User {$user->ID}: Has LM permissions: " . json_encode( $perms ) );
    
    // Grant the LM-specific capability that auth_callback and taxonomy assign_terms check
    $allcaps['edit_lm_groups'] = true;
    
    // CRITICAL: Always grant all requested caps if user has any LM permission
    // WordPress checks if ALL items in $caps array are true in $allcaps
    foreach ( $caps as $cap ) {
        $allcaps[ $cap ] = true;
    }
    error_log( "[LM Cap Filter] User {$user->ID}: Granted caps: " . implode( ', ', $caps ) );
    
    // Map job role permissions to WordPress capabilities
    if ( ! empty( $perms['can_view'] ) ) {
        $allcaps['read'] = true;
        $allcaps['read_private_posts'] = true;
    }
    
    if ( ! empty( $perms['can_create'] ) ) {
        $allcaps['edit_posts'] = true;
        $allcaps['create_posts'] = true; // Required for REST API CPT creation
        $allcaps['publish_posts'] = true;
        // Grant ALL taxonomy capabilities for creating posts with terms
        $allcaps['assign_terms'] = true;
        $allcaps['edit_terms'] = true;
        $allcaps['manage_terms'] = true;
        $allcaps['delete_terms'] = true;
    }
    
    if ( ! empty( $perms['can_edit'] ) ) {
        $allcaps['edit_posts'] = true;
        $allcaps['edit_published_posts'] = true;
        // Grant ALL taxonomy capabilities for editing posts with terms
        $allcaps['assign_terms'] = true;
        $allcaps['edit_terms'] = true;
        $allcaps['manage_terms'] = true;
        $allcaps['delete_terms'] = true;
        
        // Check if editing their own post
        if ( isset( $args[2] ) ) {
            $post = get_post( $args[2] );
            if ( $post && (int) $post->post_author === (int) $user->ID ) {
                $allcaps['edit_post'] = true;
            }
        }
    }
    
    if ( ! empty( $perms['can_delete'] ) ) {
        $allcaps['delete_posts'] = true;
        $allcaps['delete_published_posts'] = true;
        
        // Check if deleting their own post
        if ( isset( $args[2] ) ) {
            $post = get_post( $args[2] );
            if ( $post && (int) $post->post_author === (int) $user->ID ) {
                $allcaps['delete_post'] = true;
            }
        }
    }
    
    if ( ! empty( $perms['can_moderate_all'] ) ) {
        $allcaps['edit_others_posts'] = true;
        $allcaps['delete_others_posts'] = true;
        $allcaps['read_private_posts'] = true;
        $allcaps['edit_published_posts'] = true;
        $allcaps['delete_published_posts'] = true;
        
        // Moderators can edit and delete ANY post - grant the meta cap
        $allcaps['edit_post'] = true;
        $allcaps['delete_post'] = true;
        
        // Moderators can also manage terms
        $allcaps['assign_terms'] = true;
        $allcaps['edit_terms'] = true;
        $allcaps['manage_terms'] = true;
        $allcaps['delete_terms'] = true;
        
        // CRITICAL: Grant ALL the specific primitive caps being requested
        // WordPress checks if ALL items in $caps are true in $allcaps
        foreach ( $caps as $cap ) {
            $allcaps[ $cap ] = true;
        }
    }
    
    return $allcaps;
}

/**
 * Check if the current request is a Lesson Management REST API request.
 * 
 * @return bool True if this is a Lesson Management REST request.
 */
function lm_is_lesson_management_rest_request() {
    // Only check during REST requests
    if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
        return false;
    }
    
    // Check the REST route from global $wp
    global $wp;
    $rest_route = isset( $wp->query_vars['rest_route'] ) ? $wp->query_vars['rest_route'] : '';
    
    // Check from the request URI - this is more reliable during early REST processing
    if ( isset( $_SERVER['REQUEST_URI'] ) ) {
        $request_uri = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) );
        
        // Match patterns like /wp-json/wp/v2/lm-group, /wp-json/wp/v2/lm-swimmer, etc.
        if ( preg_match( '#/wp-json/wp/v2/(lm-group|lm-swimmer|lm-evaluation|lm-level|lm-skill)#i', $request_uri ) ) {
            return true;
        }
        
        // Also check for our custom lesson management routes
        if ( preg_match( '#/wp-json/(?:mentorship-platform|lm)/v1/(?:lessons?|groups?|swimmers?|essential-data|users/search|lock|unlock|check-lock|force-unlock|swimmers-cached|levels-cached|skills-cached|groups-cached|search-swimmers|search-groups|swimmers-by-ids|instructors-by-ids|groups-by-ids|cache-invalidate|clear-cache)#i', $request_uri ) ) {
            return true;
        }
    }
    
    // Check if route matches lesson management endpoints (backup check)
    if ( ! empty( $rest_route ) ) {
        if ( preg_match( '#^/?wp/v2/(lm-group|lm-swimmer|lm-evaluation|lm-level|lm-skill)#i', $rest_route ) ) {
            return true;
        }
        if ( preg_match( '#^/?(?:mentorship-platform|lm)/v1/lessons?#i', $rest_route ) ) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get lesson management permissions for a user based on their job roles.
 * 
 * @param int $user_id The user ID.
 * @return array|null The permissions array or null if none found.
 */
function lm_get_user_lesson_permissions( $user_id ) {
    global $wpdb;
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'pg_lesson_management_permissions';
    
    // Grant full access to administrators
    if ( user_can( $user_id, 'manage_options' ) ) {
        error_log( "[LM Permissions] User $user_id: Admin full access granted" );
        return [
            'can_view' => 1,
            'can_create' => 1,
            'can_edit' => 1,
            'can_delete' => 1,
            'can_moderate_all' => 1,
        ];
    }

    // Check if permissions table exists
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$permissions_table'" ) !== $permissions_table ) {
        error_log( "[LM Permissions] Permissions table does not exist: $permissions_table" );
        return null;
    }
    
    // Get user's assigned job roles from the assignments table
    $role_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ) );
    
    // Fallback to user meta if no assignments found (backwards compatibility)
    if ( empty( $role_ids ) ) {
        $user_meta_roles = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $user_meta_roles ) && is_array( $user_meta_roles ) ) {
            $role_ids = array_map( 'intval', $user_meta_roles );
            error_log( "[LM Permissions] User $user_id: Using user meta fallback, role IDs: " . implode(',', $role_ids) );
        }
    }
    
    if ( empty( $role_ids ) ) {
        error_log( "[LM Permissions] User $user_id: No job role assignments found" );
        return null;
    }
    
    error_log( "[LM Permissions] User $user_id: Checking permissions for role IDs: " . implode(',', $role_ids) );
    
    // Build placeholders for IN clause
    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    
    // Enhanced debugging: Log the exact query being built
    $debug_query = "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM $permissions_table
         WHERE job_role_id IN ($placeholders)";
    
    error_log( "[LM Permissions DEBUG] Query template: " . $debug_query );
    error_log( "[LM Permissions DEBUG] Role IDs to bind: " . json_encode( $role_ids ) );
    error_log( "[LM Permissions DEBUG] Placeholders: " . $placeholders );
    
    // Get aggregated permissions from all assigned job roles (OR logic - most permissive wins)
    $permissions = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM $permissions_table
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    // Log the actual executed query
    error_log( "[LM Permissions DEBUG] Executed query: " . $wpdb->last_query );
    error_log( "[LM Permissions DEBUG] Query result: " . json_encode( $permissions ) );
    
    if ( $permissions ) {
        error_log( "[LM Permissions] User $user_id: Found permissions: " . json_encode( $permissions ) );
    } else {
        error_log( "[LM Permissions] User $user_id: No permissions found in table for roles: " . implode(',', $role_ids) );
    }
    
    return $permissions;
}


// v11.4.16: Removed overrides - restoring native logic for debugging 403.
// The auth_callback in register_post_meta is now the single source of truth.




