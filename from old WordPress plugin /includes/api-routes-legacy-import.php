<?php
/**
 * Legacy Import API Routes
 * 
 * Provides REST API endpoints for importing legacy Pods-based mentorship data.
 * 
 * @package AquaticPro
 * @since 11.3.0
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// Include the import class
require_once plugin_dir_path( __FILE__ ) . 'class-legacy-import.php';

/**
 * Register legacy import API routes
 */
function aquaticpro_register_legacy_import_routes() {
    $namespace = 'mentorship-platform/v1';
    
    // Get summary of legacy data
    register_rest_route( $namespace, '/legacy-import/summary', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_legacy_import_summary',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ) );
    
    // Get sample data for debugging
    register_rest_route( $namespace, '/legacy-import/sample-data', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_legacy_import_sample_data',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
        'args'                => array(
            'limit' => array(
                'type'    => 'integer',
                'default' => 5,
            ),
        ),
    ) );
    
    // Get meta keys used by legacy posts
    register_rest_route( $namespace, '/legacy-import/meta-keys', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_legacy_import_meta_keys',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ) );
    
    // Run import (with dry-run option)
    register_rest_route( $namespace, '/legacy-import/run', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_legacy_import_run',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
        'args'                => array(
            'dry_run' => array(
                'type'    => 'boolean',
                'default' => true,
            ),
        ),
    ) );
    
    // Rollback import (for testing)
    register_rest_route( $namespace, '/legacy-import/rollback', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_legacy_import_rollback',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ) );
}

add_action( 'rest_api_init', 'aquaticpro_register_legacy_import_routes' );

/**
 * Get summary of legacy data to import
 */
function aquaticpro_legacy_import_summary() {
    $summary = AquaticPro_Legacy_Import::get_legacy_summary();
    
    return rest_ensure_response( array(
        'success' => true,
        'data'    => $summary,
    ) );
}

/**
 * Get sample data from legacy posts for debugging
 */
function aquaticpro_legacy_import_sample_data( $request ) {
    $limit = $request->get_param( 'limit' );
    $samples = AquaticPro_Legacy_Import::get_sample_data( $limit );
    
    return rest_ensure_response( array(
        'success' => true,
        'data'    => $samples,
    ) );
}

/**
 * Get meta keys used by legacy posts
 */
function aquaticpro_legacy_import_meta_keys() {
    $meta_keys = AquaticPro_Legacy_Import::get_meta_keys();
    
    return rest_ensure_response( array(
        'success' => true,
        'data'    => $meta_keys,
    ) );
}

/**
 * Run the import
 */
function aquaticpro_legacy_import_run( $request ) {
    $dry_run = $request->get_param( 'dry_run' );
    
    // Increase time limit for large imports
    set_time_limit( 300 );
    
    $results = AquaticPro_Legacy_Import::run_import( $dry_run );
    
    return rest_ensure_response( array(
        'success' => true,
        'dry_run' => $dry_run,
        'results' => $results,
    ) );
}

/**
 * Rollback imported data
 */
function aquaticpro_legacy_import_rollback() {
    $deleted = AquaticPro_Legacy_Import::rollback_import();
    
    return rest_ensure_response( array(
        'success' => true,
        'deleted' => $deleted,
    ) );
}
