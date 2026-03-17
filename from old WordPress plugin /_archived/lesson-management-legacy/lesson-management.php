<?php
/**
 * Plugin Name: Lesson Management
 * Plugin URI: https://swimmingideas.com/
 * Description: A custom plugin for managing swimming lesson schedules, instructors, and student enrollment.
 * Version: 4.0.9
 * Author: Swimming Ideas, LLC
 * Author URI: https://swimmingideas.com/
 * Text Domain: lesson-management
 * Domain Path: /languages
 * License: GPL2
 */

defined( 'ABSPATH' ) || die;

// Define plugin constants
define( 'LM_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LM_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LM_VERSION', '4.0.9' );

add_action( 'plugins_loaded', 'lm_load_plugin' );
/**
 * Main plugin loading function.
 *
 * This function includes all the necessary files and ensures that hooks
 * are registered at the correct point in the WordPress lifecycle.
 */
function lm_load_plugin() {
    // Custom Post Types and Taxonomies
    require_once LM_PLUGIN_DIR . 'includes/cpt-registration.php';

    // REST API Routes and Endpoints
    require_once LM_PLUGIN_DIR . 'includes/rest-api.php';
    
    // Frontend Assets for the React App
    require_once LM_PLUGIN_DIR . 'includes/frontend-assets.php';
    
    // Shortcodes for public-facing pages
    require_once LM_PLUGIN_DIR . 'includes/shortcodes.php';

    // --- Admin Pages & Handlers ---

    // Load the main dashboard page FIRST to establish the parent menu.
    require_once LM_PLUGIN_DIR . 'admin/admin-page.php';
    
    // Now, load the files that add the submenu pages AND the email handler logic.
    require_once LM_PLUGIN_DIR . 'admin/email-settings-page.php';
    require_once LM_PLUGIN_DIR . 'includes/email-handler.php';
}


/**
 * Utility Functions (if needed)
 */
// require_once LM_PLUGIN_DIR . 'includes/utilities.php';

// Add activation hook to handle database setup or rewriting rules
function lm_plugin_activate() {
    // Set a transient flag to indicate that rewrite rules need to be flushed.
    // This is more performant than flushing on every activation.
    set_transient( 'lm_flush_rewrite_rules', true, 30 );

    // Grant the 'view_bulk_email_page' capability to administrators on activation.
    $admin_role = get_role( 'administrator' );
    if ( $admin_role ) {
        $admin_role->add_cap( 'view_bulk_email_page' );
    }
}
register_activation_hook( __FILE__, 'lm_plugin_activate' );

/**
 * Flushes rewrite rules on activation if our transient is set.
 */
function lm_maybe_flush_rewrite_rules() {
    if ( get_transient( 'lm_flush_rewrite_rules' ) ) {
        flush_rewrite_rules();
        delete_transient( 'lm_flush_rewrite_rules' );
    }
}
add_action( 'init', 'lm_maybe_flush_rewrite_rules', 20 ); // Run after CPTs are registered at priority 10.

// Add deactivation hook to clean up
function lm_plugin_deactivate() {
    // Optionally clean up rewrite rules
    flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'lm_plugin_deactivate' );