<?php
/**
 * CPT & Taxonomy Registration
 *
 * This file is responsible for creating all the custom post types,
 * custom taxonomies, and registering their associated meta fields
 * for the Lesson Management plugin.
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

add_action( 'init', 'lm_register_cpts_taxonomies_and_meta' );

/**
 * Sanitizes a value to be an absolute integer, or an empty string if empty.
 *
 * @param mixed $value The value to sanitize.
 * @return int|string The sanitized integer or an empty string.
 */
function lm_sanitize_integer_or_empty( $value ) {
	if ( empty( $value ) ) {
		return '';
	}
	return absint( $value );
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

    $auth_callback = function() {
        return current_user_can( 'edit_posts' );
    };

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
    register_post_meta( 'lm-evaluation', 'archived', [
        'type'              => 'boolean',
        'single'            => true,
        'show_in_rest'      => true,
        'default'           => false,
        'sanitize_callback' => 'rest_sanitize_boolean',
        'auth_callback'     => $auth_callback,
    ] );
}
