<?php
/**
 * Frontend Assets and Scripts
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

add_action( 'admin_enqueue_scripts', 'lm_enqueue_admin_assets' );

/**
 * Disable wp-auth-check on our plugin page to prevent jQuery errors.
 * wp-auth-check looks for elements that may not exist in our React app.
 */
add_action( 'admin_init', function() {
    $screen = get_current_screen();
    if ( $screen && $screen->id === 'toplevel_page_lesson-dashboard' ) {
        remove_action( 'admin_enqueue_scripts', 'wp_auth_check_load' );
    }
});

/**
 * Add cache control headers for plugin static assets.
 */
add_filter( 'script_loader_tag', 'lm_add_cache_headers_hint', 10, 3 );
function lm_add_cache_headers_hint( $tag, $handle, $src ) {
    // Add cache hints for our plugin assets
    if ( $handle === 'lm-react-app' || $handle === 'lm-tailwind-styles' ) {
        // Note: Actual cache headers must be set at server level,
        // but we ensure proper versioning is in place
        return $tag;
    }
    return $tag;
}

/**
 * Enqueues scripts and styles for the frontend app when using shortcode.
 * This is called by the shortcode to load the same assets as the admin page.
 */
function lm_enqueue_frontend_app_assets() {
    lm_enqueue_app_assets();
}

/**
 * Core function to enqueue all app assets (shared by admin and frontend).
 */
function lm_enqueue_app_assets() {

    // Enqueue Tailwind CSS.
    wp_enqueue_style(
        'lm-tailwind-styles',
        LM_PLUGIN_URL . 'assets/css/tailwind.css',
        array(),
        LM_VERSION
    );

    // Enqueue the WordPress editor scripts and styles
    wp_enqueue_editor();

    // Enqueue the React application script with defer strategy for better performance.
    wp_enqueue_script(
        'lm-react-app',
        LM_PLUGIN_URL . 'assets/js/index.js',
		array( 'wp-api-fetch', 'wp-element', 'wp-hooks' ),
        LM_VERSION,
        array(
            'in_footer' => true, // Load in footer
            'strategy'  => 'defer', // Defer parsing for faster page load
        )
    );

    // Preload essential data to avoid an initial API call.
    // The lm_get_essential_data function is defined in rest-api.php
    if ( function_exists( 'lm_get_essential_data' ) ) {
        $preloaded_data = lm_get_essential_data();
        wp_add_inline_script(
            'lm-react-app',
            'const LM_PRELOADED_DATA = ' . wp_json_encode( $preloaded_data ) . ';',
            'before'
        );
    }

    // Pass data to the React app.
    wp_localize_script( 'lm-react-app', 'LMData', array(
        'namespace'  => 'lm/v1',
        'nonce'      => wp_create_nonce( 'wp_rest' ),
        'post_types' => array(
            'group' => 'lm-group',
            'level' => 'lm-level',
            'skill' => 'lm-skill',
            'swimmer' => 'lm-swimmer',
            'evaluation' => 'lm-evaluation',
        ),
        'taxonomies' => array(
            'camp' => 'lm_camp',
            'animal' => 'lm_animal',
            'lesson_type' => 'lm_lesson_type',
        ),
    ) );
}

/**
 * Enqueues scripts and styles for the admin dashboard.
 *
 * This function checks if the current admin page is our React app's page
 * and, if so, loads the necessary CSS and JS files. It also passes
 * data from PHP to JavaScript using wp_localize_script.
 *
 * @param string $hook The current admin page hook.
 */
function lm_enqueue_admin_assets( $hook ) {
    // Define the hooks for the pages where our assets should be loaded.
    $allowed_hooks = [
        'toplevel_page_lesson-dashboard', // Main React app page
    ];

    if ( ! in_array( $hook, $allowed_hooks, true ) ) {
        return;
    }
    
    // Enqueue the main app assets
    lm_enqueue_app_assets();
}