<?php
/**
 * Seasonal Returns & Pay Management REST API Routes
 *
 * @package AquaticPro
 * @subpackage SeasonalReturns
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Register all Seasonal Returns REST API routes
 */
function aquaticpro_register_seasonal_returns_routes() {
    $namespace = 'mentorship-platform/v1';

    // ============================================
    // PUBLIC RETURN FORM (NO AUTH) — Always registered
    // These MUST be outside the is_enabled() gate so that employees
    // can still access their return-form links even if an admin
    // temporarily toggles the module off.  The callbacks themselves
    // will return a friendly error if the module is disabled.
    // ============================================

    // Get return form data by token (PUBLIC)
    register_rest_route( $namespace, '/srm/return-form/(?P<token>[a-f0-9]+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_return_form',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => array(
            'token' => array( 'validate_callback' => function($v) { return preg_match('/^[a-f0-9]+$/', $v); } ),
        ),
    ) );

    // Submit return intent (PUBLIC)
    register_rest_route( $namespace, '/srm/return-form/(?P<token>[a-f0-9]+)', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_submit_return_intent',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => array(
            'token' => array( 'validate_callback' => function($v) { return preg_match('/^[a-f0-9]+$/', $v); } ),
        ),
    ) );

    // Diagnostic endpoint: verify token exists without loading full form data (PUBLIC)
    register_rest_route( $namespace, '/srm/return-form-check/(?P<token>[a-f0-9]+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_check_return_token',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => array(
            'token' => array( 'validate_callback' => function($v) { return preg_match('/^[a-f0-9]+$/', $v); } ),
        ),
    ) );

    // Diagnostic endpoint: check table status (PUBLIC, no sensitive data)
    register_rest_route( $namespace, '/srm/diagnostic', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_public_diagnostic',
        'permission_callback' => '__return_true', // Public endpoint
    ) );

    // Only register admin/authenticated routes if class exists and module is enabled
    if ( ! class_exists( 'Seasonal_Returns' ) || ! Seasonal_Returns::is_enabled() ) {
        return;
    }

    // ============================================
    // PERMISSIONS
    // ============================================

    // Get current user's SRM permissions
    register_rest_route( $namespace, '/srm/my-permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_my_permissions',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Get all role permissions (admin only)
    register_rest_route( $namespace, '/srm/permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_all_permissions',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Update role permissions (admin only)
    register_rest_route( $namespace, '/srm/permissions/(?P<role_id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_role_permissions',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'role_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // ============================================
    // PAY CONFIGURATION
    // ============================================

    // Get all pay configurations
    register_rest_route( $namespace, '/srm/pay-config', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_pay_config',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Create new pay config
    register_rest_route( $namespace, '/srm/pay-config', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_create_pay_config',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Update pay config
    register_rest_route( $namespace, '/srm/pay-config/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_pay_config',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Delete pay config
    register_rest_route( $namespace, '/srm/pay-config/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_srm_delete_pay_config',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // ============================================
    // EMPLOYEE PAY CALCULATIONS
    // ============================================

    // Get all employees with pay rates
    register_rest_route( $namespace, '/srm/employees/pay', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_all_employee_pay',
        'permission_callback' => 'aquaticpro_srm_can_view_all_pay',
    ) );

    // Get single employee pay breakdown
    register_rest_route( $namespace, '/srm/employees/(?P<user_id>\d+)/pay', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_employee_pay',
        'permission_callback' => 'aquaticpro_srm_can_view_employee_pay',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Get projected pay for next season
    register_rest_route( $namespace, '/srm/employees/(?P<user_id>\d+)/pay/projected', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_projected_pay',
        'permission_callback' => 'aquaticpro_srm_can_view_employee_pay',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // ============================================
    // SEASON MANAGEMENT
    // ============================================

    // Get all seasons
    register_rest_route( $namespace, '/srm/seasons', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_seasons',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Create season
    register_rest_route( $namespace, '/srm/seasons', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_create_season',
        'permission_callback' => 'aquaticpro_srm_can_manage_status',
    ) );

    // Update season
    register_rest_route( $namespace, '/srm/seasons/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_season',
        'permission_callback' => 'aquaticpro_srm_can_manage_status',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Delete season
    register_rest_route( $namespace, '/srm/seasons/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_srm_delete_season',
        'permission_callback' => 'aquaticpro_srm_can_manage_status',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Get season statistics
    register_rest_route( $namespace, '/srm/seasons/(?P<id>\d+)/stats', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_season_stats',
        'permission_callback' => 'aquaticpro_srm_can_view_retention',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // ============================================
    // RETURN INTENT MANAGEMENT
    // ============================================

    // Send batch return invites
    register_rest_route( $namespace, '/srm/invite/batch', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_send_batch_invites',
        'permission_callback' => 'aquaticpro_srm_can_send_invites',
    ) );

    // Send follow-up emails
    register_rest_route( $namespace, '/srm/follow-up/batch', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_send_follow_ups',
        'permission_callback' => 'aquaticpro_srm_can_send_invites',
    ) );

    // Get all responses for a season
    register_rest_route( $namespace, '/srm/responses', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_responses',
        'permission_callback' => 'aquaticpro_srm_can_view_responses',
    ) );

    // Export responses as CSV (with projected pay)
    register_rest_route( $namespace, '/srm/responses/export', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_export_responses_csv',
        'permission_callback' => 'aquaticpro_srm_can_view_responses',
    ) );

    // Get employee season history
    register_rest_route( $namespace, '/srm/employees/(?P<user_id>\d+)/seasons', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_employee_seasons',
        'permission_callback' => 'aquaticpro_srm_can_view_responses',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Update employee status
    register_rest_route( $namespace, '/srm/employees/(?P<user_id>\d+)/status', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_employee_status',
        'permission_callback' => 'aquaticpro_srm_can_manage_status',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Bulk activate returning employees
    register_rest_route( $namespace, '/srm/bulk/activate-returning', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_bulk_activate_returning',
        'permission_callback' => 'aquaticpro_srm_can_bulk_actions',
    ) );

    // Bulk update employee settings (longevity, job roles)
    register_rest_route( $namespace, '/srm/employees/bulk-update', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_bulk_update_employees',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Advance longevity for all employees (increment by 1)
    register_rest_route( $namespace, '/srm/longevity/advance', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_advance_longevity',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Bulk remove work year from employees
    register_rest_route( $namespace, '/srm/longevity/remove-year', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_remove_work_year_bulk',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // ============================================
    // LONGEVITY RATES BY YEAR
    // ============================================

    // Get all longevity rates
    register_rest_route( $namespace, '/srm/longevity-rates', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_longevity_rates',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Create/Update longevity rate for a year
    register_rest_route( $namespace, '/srm/longevity-rates', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_upsert_longevity_rate',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Delete longevity rate
    register_rest_route( $namespace, '/srm/longevity-rates/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_srm_delete_longevity_rate',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Bulk upsert longevity rates
    register_rest_route( $namespace, '/srm/longevity-rates/bulk', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_bulk_upsert_longevity_rates',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // ============================================
    // EMPLOYEE WORK YEARS
    // ============================================

    // Get employee work years (optionally filtered by user_id)
    register_rest_route( $namespace, '/srm/employee-work-years', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_employee_work_years',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Add work year for an employee
    register_rest_route( $namespace, '/srm/employee-work-years', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_add_employee_work_year',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Delete work year
    register_rest_route( $namespace, '/srm/employee-work-years/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_srm_delete_employee_work_year',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Verify a work year
    register_rest_route( $namespace, '/srm/employee-work-years/(?P<id>\d+)/verify', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_verify_work_year',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Calculate longevity bonus for an employee (uses new system)
    register_rest_route( $namespace, '/srm/longevity/calculate/(?P<user_id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_calculate_longevity_bonus',
        'permission_callback' => 'aquaticpro_check_access_permission',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Migrate work years from legacy longevity_years count
    register_rest_route( $namespace, '/srm/longevity/migrate', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_migrate_work_years',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // Get longevity settings
    register_rest_route( $namespace, '/srm/longevity/settings', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_longevity_settings',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );

    // Update longevity settings
    register_rest_route( $namespace, '/srm/longevity/settings', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_longevity_settings',
        'permission_callback' => 'aquaticpro_srm_can_manage_config',
    ) );

    // ============================================
    // ADMIN TOKEN DIAGNOSTICS
    // ============================================

    // Admin lookup: find tokens by user email or ID (for debugging)
    register_rest_route( $namespace, '/srm/admin/token-lookup', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_admin_token_lookup',
        'permission_callback' => 'aquaticpro_srm_can_send_invites',
        'args'                => array(
            'email' => array( 'sanitize_callback' => 'sanitize_email' ),
            'user_id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // ============================================
    // BULK VOID INVITES
    // ============================================

    // Bulk void/delete pending invites
    register_rest_route( $namespace, '/srm/invites/bulk-void', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_bulk_void_invites',
        'permission_callback' => 'aquaticpro_srm_can_send_invites',
    ) );

    // ============================================
    // EMAIL TEMPLATES
    // ============================================

    // Get all templates
    register_rest_route( $namespace, '/srm/templates', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_templates',
        'permission_callback' => 'aquaticpro_srm_can_view_templates',
    ) );

    // Create template
    register_rest_route( $namespace, '/srm/templates', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_create_template',
        'permission_callback' => 'aquaticpro_srm_can_manage_templates',
    ) );

    // Update template
    register_rest_route( $namespace, '/srm/templates/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_srm_update_template',
        'permission_callback' => 'aquaticpro_srm_can_manage_templates',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Delete template
    register_rest_route( $namespace, '/srm/templates/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_srm_delete_template',
        'permission_callback' => 'aquaticpro_srm_can_manage_templates',
        'args'                => array(
            'id' => array( 'validate_callback' => function($v) { return is_numeric($v); } ),
        ),
    ) );

    // Preview template with placeholders
    register_rest_route( $namespace, '/srm/templates/preview', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_preview_template',
        'permission_callback' => 'aquaticpro_srm_can_view_templates',
    ) );

    // ============================================
    // RETENTION DASHBOARD
    // ============================================

    // Get retention history
    register_rest_route( $namespace, '/srm/retention/history', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_retention_history',
        'permission_callback' => 'aquaticpro_srm_can_view_retention',
    ) );

    // Save retention snapshot
    register_rest_route( $namespace, '/srm/retention/snapshot', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_srm_save_retention_snapshot',
        'permission_callback' => 'aquaticpro_srm_can_view_retention',
    ) );

    // ============================================
    // MY RETURNS (EMPLOYEE SELF-SERVICE)
    // ============================================

    // Get current user's own seasonal return data (any logged-in user)
    register_rest_route( $namespace, '/srm/my-returns', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_srm_get_my_returns',
        'permission_callback' => 'aquaticpro_check_access_permission',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_seasonal_returns_routes' );

// ============================================
// PERMISSION CALLBACKS
// ============================================

function aquaticpro_srm_can_manage_config() {
    // WordPress admins get full access
    if ( current_user_can('manage_options') ) {
        return true;
    }
    
    // Management tier users also get full access
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) {
        return true;
    }
    
    // Otherwise check SRM permissions
    return Seasonal_Returns::user_can('srm_manage_pay_config');
}

function aquaticpro_srm_can_view_all_pay() {
    // WordPress admins get full access
    if ( current_user_can('manage_options') ) {
        return true;
    }
    
    // Management tier users also get full access
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) {
        return true;
    }
    
    // Otherwise check SRM permissions
    return Seasonal_Returns::user_can('srm_view_all_pay');
}

function aquaticpro_srm_can_view_employee_pay( $request ) {
    $user_id = $request->get_param('user_id');
    $current_user_id = get_current_user_id();
    
    // Can view own pay
    if ( $user_id == $current_user_id ) {
        return Seasonal_Returns::user_can('srm_view_own_pay');
    }
    
    // Can view all pay
    return current_user_can('manage_options') || Seasonal_Returns::user_can('srm_view_all_pay');
}

function aquaticpro_srm_can_send_invites() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_send_invites');
}

function aquaticpro_srm_can_view_responses() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_view_responses');
}

function aquaticpro_srm_can_manage_status() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_manage_status');
}

function aquaticpro_srm_can_manage_templates() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_manage_templates');
}

function aquaticpro_srm_can_view_templates() {
    return aquaticpro_check_access_permission(); // Anyone with platform access can view templates
}

function aquaticpro_srm_can_view_retention() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_view_retention');
}

function aquaticpro_srm_can_bulk_actions() {
    if ( current_user_can('manage_options') ) return true;
    if ( function_exists('mentorship_platform_pg_user_is_management') && mentorship_platform_pg_user_is_management() ) return true;
    return Seasonal_Returns::user_can('srm_bulk_actions');
}

// ============================================
// API CALLBACKS - PERMISSIONS
// ============================================

function aquaticpro_srm_get_my_permissions( $request ) {
    $user_id = get_current_user_id();
    $is_admin = user_can( $user_id, 'manage_options' );
    $is_enabled = Seasonal_Returns::is_enabled();
    
    error_log("SRM Permissions Request - User ID: $user_id, Is Admin: " . ($is_admin ? 'YES' : 'NO') . ", Module Enabled: " . ($is_enabled ? 'YES' : 'NO'));
    
    $permissions = Seasonal_Returns::get_user_permissions( $user_id );
    
    error_log("SRM Permissions Result: " . json_encode($permissions));
    
    return rest_ensure_response( array(
        'success' => true,
        'permissions' => $permissions,
        'debug' => array(
            'user_id' => $user_id,
            'is_wp_admin' => $is_admin,
            'module_enabled' => $is_enabled
        )
    ) );
}

function aquaticpro_srm_get_all_permissions( $request ) {
    $permissions = Seasonal_Returns::get_all_role_permissions();
    
    return rest_ensure_response( array(
        'success' => true,
        'permissions' => $permissions
    ) );
}

function aquaticpro_srm_update_role_permissions( $request ) {
    $role_id = $request->get_param('role_id');
    $permissions = $request->get_json_params();
    
    $success = Seasonal_Returns::update_role_permissions( $role_id, $permissions );
    
    if ( $success ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Permissions updated successfully'
        ) );
    }
    
    return new WP_Error( 'update_failed', 'Failed to update permissions', array( 'status' => 500 ) );
}

// ============================================
// API CALLBACKS - PAY CONFIGURATION
// ============================================

function aquaticpro_srm_get_pay_config( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_pay_config';
    $config_type = $request->get_param('type');
    
    $where = '';
    if ( $config_type ) {
        $where = $wpdb->prepare( "WHERE config_type = %s", $config_type );
    }
    
    $results = $wpdb->get_results( "SELECT * FROM $table $where ORDER BY config_type, effective_date DESC, longevity_years ASC", ARRAY_A );
    
    // Get job role names
    foreach ( $results as &$item ) {
        if ( $item['job_role_id'] ) {
            $role = $wpdb->get_row( $wpdb->prepare(
                "SELECT title FROM {$wpdb->prefix}pg_job_roles WHERE id = %d",
                $item['job_role_id']
            ) );
            $item['job_role_name'] = $role ? $role->title : '';
        }
        $item['amount'] = (float) $item['amount'];
        $item['is_active'] = (bool) $item['is_active'];
        $item['is_recurring'] = (bool) $item['is_recurring'];
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'config' => $results
    ) );
}

function aquaticpro_srm_create_pay_config( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_pay_config';
    
    $data = array(
        'config_type' => sanitize_text_field( $params['config_type'] ),
        'name' => sanitize_text_field( $params['name'] ),
        'amount' => floatval( $params['amount'] ),
        'job_role_id' => isset( $params['job_role_id'] ) ? intval( $params['job_role_id'] ) : null,
        'longevity_years' => isset( $params['longevity_years'] ) ? intval( $params['longevity_years'] ) : null,
        'start_date' => isset( $params['start_date'] ) ? sanitize_text_field( $params['start_date'] ) : null,
        'end_date' => isset( $params['end_date'] ) ? sanitize_text_field( $params['end_date'] ) : null,
        'expiration_date' => isset( $params['expiration_date'] ) && !empty( $params['expiration_date'] ) ? sanitize_text_field( $params['expiration_date'] ) : null,
        'is_recurring' => isset( $params['is_recurring'] ) ? (int) (bool) $params['is_recurring'] : 0,
        'is_active' => isset( $params['is_active'] ) ? (int) (bool) $params['is_active'] : 1,
        'effective_date' => sanitize_text_field( $params['effective_date'] )
    );
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result ) {
        // Invalidate all pay cache since global config changed
        Seasonal_Returns::invalidate_all_pay_cache();
        
        return rest_ensure_response( array(
            'success' => true,
            'id' => $wpdb->insert_id,
            'message' => 'Pay configuration created successfully'
        ) );
    }
    
    return new WP_Error( 'create_failed', 'Failed to create pay configuration', array( 'status' => 500 ) );
}

function aquaticpro_srm_update_pay_config( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_pay_config';
    
    $data = array(
        'name' => sanitize_text_field( $params['name'] ),
        'amount' => floatval( $params['amount'] ),
        'is_active' => isset( $params['is_active'] ) ? (int) (bool) $params['is_active'] : 1
    );
    
    if ( isset( $params['job_role_id'] ) ) {
        $data['job_role_id'] = intval( $params['job_role_id'] );
    }
    if ( isset( $params['longevity_years'] ) ) {
        $data['longevity_years'] = intval( $params['longevity_years'] );
    }
    if ( isset( $params['start_date'] ) ) {
        $data['start_date'] = sanitize_text_field( $params['start_date'] );
    }
    if ( isset( $params['end_date'] ) ) {
        $data['end_date'] = sanitize_text_field( $params['end_date'] );
    }
    if ( isset( $params['expiration_date'] ) ) {
        $data['expiration_date'] = !empty( $params['expiration_date'] ) ? sanitize_text_field( $params['expiration_date'] ) : null;
    }
    if ( isset( $params['is_recurring'] ) ) {
        $data['is_recurring'] = (int) (bool) $params['is_recurring'];
    }
    if ( isset( $params['effective_date'] ) ) {
        $data['effective_date'] = sanitize_text_field( $params['effective_date'] );
    }
    
    $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
    
    if ( $result !== false ) {
        // Invalidate all pay cache since config changed
        Seasonal_Returns::invalidate_all_pay_cache();
        
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Pay configuration updated successfully'
        ) );
    }
    
    return new WP_Error( 'update_failed', 'Failed to update pay configuration', array( 'status' => 500 ) );
}

function aquaticpro_srm_delete_pay_config( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $table = $wpdb->prefix . 'srm_pay_config';
    
    $result = $wpdb->delete( $table, array( 'id' => $id ) );
    
    if ( $result ) {
        // Invalidate all pay cache since config changed
        Seasonal_Returns::invalidate_all_pay_cache();
        
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Pay configuration deleted successfully'
        ) );
    }
    
    return new WP_Error( 'delete_failed', 'Failed to delete pay configuration', array( 'status' => 500 ) );
}

// ============================================
// API CALLBACKS - EMPLOYEE PAY
// ============================================

function aquaticpro_srm_get_all_employee_pay( $request ) {
    global $wpdb;
    
    // Check if required tables exist first
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $cache_table = $wpdb->prefix . 'srm_pay_cache';
    
    // Verify assignments table exists
    $assignments_exists = $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" );
    if ( ! $assignments_exists ) {
        return rest_ensure_response( array(
            'success' => true,
            'employees' => array(),
            'message' => 'Job assignments table not found'
        ) );
    }
    
    try {
        // Get users who have job role assignments (actual employees)
        $user_ids = $wpdb->get_col( "SELECT DISTINCT user_id FROM $assignments_table" );
        
        if ( empty( $user_ids ) ) {
            return rest_ensure_response( array(
                'success' => true,
                'employees' => array()
            ) );
        }
        
        // Get user data in batch
        $users = get_users( array( 
            'include' => $user_ids,
            'fields' => array( 'ID', 'display_name', 'user_email' )
        ) );
        
        // Sort by last name, then first name
        usort( $users, function( $a, $b ) {
            $a_last = get_user_meta( $a->ID, 'last_name', true ) ?: '';
            $b_last = get_user_meta( $b->ID, 'last_name', true ) ?: '';
            $a_first = get_user_meta( $a->ID, 'first_name', true ) ?: '';
            $b_first = get_user_meta( $b->ID, 'first_name', true ) ?: '';
            
            $last_cmp = strcasecmp( $a_last, $b_last );
            if ( $last_cmp !== 0 ) {
                return $last_cmp;
            }
            return strcasecmp( $a_first, $b_first );
        } );
        
        // Check if roles table exists
        $roles_exists = $wpdb->get_var( "SHOW TABLES LIKE '$roles_table'" );
        $all_roles = $roles_exists ? $wpdb->get_results( "SELECT id, title, tier FROM $roles_table", OBJECT_K ) : array();
        
        // Pre-load all user job assignments
        $user_id_list = implode(',', array_map('intval', $user_ids));
        $all_assignments = $wpdb->get_results(
            "SELECT user_id, job_role_id FROM $assignments_table WHERE user_id IN ($user_id_list)",
            ARRAY_A
        );
        
        // Group assignments by user_id
        $assignments_by_user = array();
        foreach ( $all_assignments as $assignment ) {
            $uid = (int) $assignment['user_id'];
            if ( !isset( $assignments_by_user[ $uid ] ) ) {
                $assignments_by_user[ $uid ] = array();
            }
            $assignments_by_user[ $uid ][] = (int) $assignment['job_role_id'];
        }
        
        $employees = array();
        $include_projected = $request->get_param('include_projected') !== 'false';
        
        // Get all cached pay data in one query (efficient bulk retrieval)
        $all_cached_pay = Seasonal_Returns::get_all_cached_pay();
        $cache_hits = 0;
        $cache_misses = 0;
        
        foreach ( $users as $user ) {
            // Use cached pay data if available, otherwise calculate and cache
            $pay = null;
            $projected = null;
            
            if ( isset( $all_cached_pay[ $user->ID ] ) ) {
                // Cache hit - use cached data
                $cached = $all_cached_pay[ $user->ID ];
                $pay = $cached['pay'];
                $projected = $include_projected ? $cached['projected'] : null;
                $cache_hits++;
            } else {
                // Cache miss - calculate and cache (for users not yet in cache)
                $cache_misses++;
                try {
                    $cached_result = Seasonal_Returns::get_cached_pay( $user->ID, $include_projected );
                    $pay = $cached_result['pay'];
                    $projected = $include_projected ? ( $cached_result['projected'] ?? null ) : null;
                } catch ( Throwable $e ) {
                    error_log( "Pay cache miss error for user {$user->ID}: " . $e->getMessage() );
                    $pay = array(
                        'user_id' => $user->ID,
                        'as_of_date' => current_time( 'Y-m-d' ),
                        'base_rate' => 0,
                        'role_bonus' => array( 'amount' => 0, 'role_name' => '', 'role_id' => 0 ),
                        'longevity' => array( 'years' => 0, 'bonus' => 0 ),
                        'time_bonuses' => array(),
                        'time_bonus_total' => 0,
                        'total' => 0,
                        'is_capped' => false,
                        'pay_cap' => 0
                    );
                }
            }
            
            // Get job roles from pre-loaded assignments
            $user_role_ids = isset( $assignments_by_user[ $user->ID ] ) ? $assignments_by_user[ $user->ID ] : array();
            $roles = array();
            
            foreach ( $user_role_ids as $role_id ) {
                if ( isset( $all_roles[ $role_id ] ) ) {
                    $roles[] = array(
                        'id' => (int) $all_roles[ $role_id ]->id,
                        'title' => $all_roles[ $role_id ]->title
                    );
                }
            }
            
            $employee_data = array(
                'user_id' => $user->ID,
                'display_name' => $user->display_name,
                'first_name' => get_user_meta( $user->ID, 'first_name', true ) ?: '',
                'last_name' => get_user_meta( $user->ID, 'last_name', true ) ?: '',
                'email' => $user->user_email,
                'job_roles' => $roles,
                'pay_breakdown' => $pay
            );
            
            if ( $include_projected && $projected ) {
                $employee_data['projected_pay'] = $projected;
            }
            
            $employees[] = $employee_data;
        }
        
        // Log cache stats for debugging
        if ( $cache_misses > 0 ) {
            error_log( "[SRM Pay Cache] Hits: $cache_hits, Misses: $cache_misses" );
        }
        
        return rest_ensure_response( array(
            'success' => true,
            'employees' => $employees,
            'cache_stats' => array(
                'hits' => $cache_hits,
                'misses' => $cache_misses
            )
        ) );
        
    } catch ( Throwable $e ) {
        error_log( 'Fatal error in aquaticpro_srm_get_all_employee_pay: ' . $e->getMessage() );
        error_log( 'File: ' . $e->getFile() . ' Line: ' . $e->getLine() );
        error_log( 'Stack trace: ' . $e->getTraceAsString() );
        return new WP_Error( 
            'pay_calculation_error', 
            'Failed to calculate employee pay: ' . $e->getMessage(), 
            array( 'status' => 500 ) 
        );
    }
}

function aquaticpro_srm_get_employee_pay( $request ) {
    $user_id = $request->get_param('user_id');
    
    $user = get_userdata( $user_id );
    if ( ! $user ) {
        return new WP_Error( 'user_not_found', 'Employee not found', array( 'status' => 404 ) );
    }
    
    try {
        $pay = Seasonal_Returns::calculate_pay_rate( $user_id );
    } catch ( Throwable $e ) {
        error_log( "Pay calc error for user {$user_id}: " . $e->getMessage() );
        $pay = array(
            'user_id' => $user_id,
            'as_of_date' => current_time( 'Y-m-d' ),
            'base_rate' => 0,
            'role_bonus' => array( 'amount' => 0, 'role_name' => '', 'role_id' => 0 ),
            'longevity' => array( 'years' => 0, 'bonus' => 0 ),
            'time_bonuses' => array(),
            'time_bonus_total' => 0,
            'total' => 0,
            'is_capped' => false,
            'pay_cap' => 0
        );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'user_id' => $user_id,
        'display_name' => $user->display_name,
        'pay_breakdown' => $pay
    ) );
}

function aquaticpro_srm_get_projected_pay( $request ) {
    $user_id = $request->get_param('user_id');
    $season_id = $request->get_param('season_id');
    $role_override = $request->get_param('role_override'); // For "what if" scenarios
    
    $user = get_userdata( $user_id );
    if ( ! $user ) {
        return new WP_Error( 'user_not_found', 'Employee not found', array( 'status' => 404 ) );
    }
    
    $projected = Seasonal_Returns::calculate_projected_pay_rate( $user_id, $season_id, $role_override );
    
    return rest_ensure_response( array(
        'success' => true,
        'user_id' => $user_id,
        'projected_pay' => $projected
    ) );
}

// ============================================
// API CALLBACKS - SEASONS
// ============================================

function aquaticpro_srm_get_seasons( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_seasons';
    $seasons = $wpdb->get_results( "SELECT * FROM $table ORDER BY start_date DESC", ARRAY_A );
    
    foreach ( $seasons as &$season ) {
        $season['id']         = (int) $season['id'];
        $season['year']       = (int) $season['year'];
        $season['is_active']  = (bool) $season['is_active'];
        $season['is_current'] = (bool) $season['is_current'];
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'seasons' => $seasons
    ) );
}

function aquaticpro_srm_create_season( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_seasons';
    
    $data = array(
        'name' => sanitize_text_field( $params['name'] ),
        'year' => intval( $params['year'] ),
        'season_type' => sanitize_text_field( $params['season_type'] ),
        'start_date' => sanitize_text_field( $params['start_date'] ),
        'end_date' => sanitize_text_field( $params['end_date'] ),
        'is_active' => isset( $params['is_active'] ) ? (int) (bool) $params['is_active'] : 0,
        'is_current' => isset( $params['is_current'] ) ? (int) (bool) $params['is_current'] : 0
    );
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result ) {
        return rest_ensure_response( array(
            'success' => true,
            'id' => $wpdb->insert_id,
            'message' => 'Season created successfully'
        ) );
    }
    
    return new WP_Error( 'create_failed', 'Failed to create season', array( 'status' => 500 ) );
}

function aquaticpro_srm_update_season( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_seasons';
    
    $data = array();
    
    if ( isset( $params['name'] ) ) $data['name'] = sanitize_text_field( $params['name'] );
    if ( isset( $params['year'] ) ) $data['year'] = intval( $params['year'] );
    if ( isset( $params['season_type'] ) ) $data['season_type'] = sanitize_text_field( $params['season_type'] );
    if ( isset( $params['start_date'] ) ) $data['start_date'] = sanitize_text_field( $params['start_date'] );
    if ( isset( $params['end_date'] ) ) $data['end_date'] = sanitize_text_field( $params['end_date'] );
    if ( isset( $params['is_active'] ) ) $data['is_active'] = (int) (bool) $params['is_active'];
    if ( isset( $params['is_current'] ) ) $data['is_current'] = (int) (bool) $params['is_current'];
    
    $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
    
    if ( $result !== false ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Season updated successfully'
        ) );
    }
    
    return new WP_Error( 'update_failed', 'Failed to update season', array( 'status' => 500 ) );
}

function aquaticpro_srm_delete_season( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $table = $wpdb->prefix . 'srm_seasons';
    
    $result = $wpdb->delete( $table, array( 'id' => $id ) );
    
    if ( $result ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Season deleted successfully'
        ) );
    }
    
    return new WP_Error( 'delete_failed', 'Failed to delete season', array( 'status' => 500 ) );
}

function aquaticpro_srm_get_season_stats( $request ) {
    $season_id = $request->get_param('id');
    
    $stats = Seasonal_Returns::calculate_retention_stats( $season_id );
    
    return rest_ensure_response( array(
        'success' => true,
        'stats' => $stats
    ) );
}

// ============================================
// API CALLBACKS - RETURN INTENT
// ============================================

function aquaticpro_srm_send_batch_invites( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $user_ids = $params['user_ids'];
    $season_id = $params['season_id'];
    $template_id = $params['template_id'];
    
    $sent_count = 0;
    $errors = array();
    
    foreach ( $user_ids as $user_id ) {
        $rendered = Seasonal_Returns::render_email_template( $template_id, $user_id, $season_id );
        
        if ( ! $rendered ) {
            $errors[] = "Failed to render template for user $user_id";
            continue;
        }
        
        $user = get_userdata( $user_id );
        if ( ! $user ) {
            $errors[] = "User $user_id not found";
            continue;
        }
        
        $sent = wp_mail( $user->user_email, $rendered['subject'], $rendered['body'], array( 'Content-Type: text/html; charset=UTF-8' ) );
        
        if ( $sent ) {
            // Log email
            $wpdb->insert(
                $wpdb->prefix . 'srm_email_log',
                array(
                    'user_id' => $user_id,
                    'season_id' => $season_id,
                    'template_id' => $template_id,
                    'email_type' => 'initial',
                    'sent_by' => get_current_user_id()
                )
            );
            $sent_count++;
        } else {
            $errors[] = "Failed to send to user $user_id";
        }
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'sent_count' => $sent_count,
        'total' => count( $user_ids ),
        'errors' => $errors
    ) );
}

function aquaticpro_srm_send_follow_ups( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $user_ids = $params['user_ids'];
    $season_id = $params['season_id'];
    $template_id = $params['template_id'];
    $follow_up_number = isset( $params['follow_up_number'] ) ? intval( $params['follow_up_number'] ) : 1;
    
    $sent_count = 0;
    $errors = array();
    
    foreach ( $user_ids as $user_id ) {
        $rendered = Seasonal_Returns::render_email_template( $template_id, $user_id, $season_id );
        
        if ( ! $rendered ) {
            $errors[] = "Failed to render template for user $user_id";
            continue;
        }
        
        $user = get_userdata( $user_id );
        if ( ! $user ) {
            $errors[] = "User $user_id not found";
            continue;
        }
        
        $sent = wp_mail( $user->user_email, $rendered['subject'], $rendered['body'], array( 'Content-Type: text/html; charset=UTF-8' ) );
        
        if ( $sent ) {
            $wpdb->insert(
                $wpdb->prefix . 'srm_email_log',
                array(
                    'user_id' => $user_id,
                    'season_id' => $season_id,
                    'template_id' => $template_id,
                    'email_type' => 'follow_up_' . $follow_up_number,
                    'sent_by' => get_current_user_id()
                )
            );
            $sent_count++;
        } else {
            $errors[] = "Failed to send to user $user_id";
        }
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'sent_count' => $sent_count,
        'total' => count( $user_ids ),
        'errors' => $errors
    ) );
}

function aquaticpro_srm_get_responses( $request ) {
    global $wpdb;
    
    $season_id = $request->get_param('season_id');
    $status = $request->get_param('status');
    
    error_log("SRM: get_responses called for season $season_id status $status");

    $table = $wpdb->prefix . 'srm_employee_seasons';
    
    $where = '';
    $params = array();
    
    if ( $season_id ) {
        $where .= " WHERE season_id = %d";
        $params[] = $season_id;
    }
    
    if ( $status ) {
        $where .= $where ? " AND" : " WHERE";
        $where .= " status = %s";
        $params[] = $status;
    }
    
    $query = "SELECT * FROM $table $where ORDER BY updated_at DESC";
    
    if ( ! empty( $params ) ) {
        $query = call_user_func_array( [ $wpdb, 'prepare' ], array_merge( [ $query ], $params ) );
    }
    
    $responses = $wpdb->get_results( $query, ARRAY_A );
    
    error_log("SRM: Found " . count($responses) . " responses for query: " . $query);
    
    // Enrich with user data and job roles
    // Build a job role summary: { role_title => { returning: N, not_returning: N, pending: N, total: N } }
    $job_role_summary = array();
    
    foreach ( $responses as &$response ) {
        // Ensure user_id is an integer for proper JavaScript comparison
        $response['user_id'] = (int) $response['user_id'];
        $response['season_id'] = (int) $response['season_id'];
        
        $user = get_userdata( $response['user_id'] );
        if ( $user ) {
            $response['user'] = array(
                'id' => $user->ID,
                'display_name' => $user->display_name,
                'email' => $user->user_email,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name
            );
        }
        
        // Get job roles for this employee
        $user_roles = Seasonal_Returns::get_user_job_roles( $response['user_id'] );
        $response['job_roles'] = $user_roles;
        
        // Accumulate job role summary counts by status
        $emp_status = $response['status'];
        if ( ! empty( $user_roles ) ) {
            foreach ( $user_roles as $role ) {
                $role_title = $role['title'];
                $role_id    = (int) $role['id'];
                
                if ( ! isset( $job_role_summary[ $role_id ] ) ) {
                    $job_role_summary[ $role_id ] = array(
                        'role_id'        => $role_id,
                        'role_title'     => $role_title,
                        'returning'      => 0,
                        'not_returning'  => 0,
                        'pending'        => 0,
                        'ineligible'     => 0,
                        'total'          => 0,
                    );
                }
                
                $job_role_summary[ $role_id ]['total']++;
                if ( isset( $job_role_summary[ $role_id ][ $emp_status ] ) ) {
                    $job_role_summary[ $role_id ][ $emp_status ]++;
                }
            }
        } else {
            // Track employees with no role assigned
            if ( ! isset( $job_role_summary['unassigned'] ) ) {
                $job_role_summary['unassigned'] = array(
                    'role_id'        => 0,
                    'role_title'     => 'No Role Assigned',
                    'returning'      => 0,
                    'not_returning'  => 0,
                    'pending'        => 0,
                    'ineligible'     => 0,
                    'total'          => 0,
                );
            }
            $job_role_summary['unassigned']['total']++;
            if ( isset( $job_role_summary['unassigned'][ $emp_status ] ) ) {
                $job_role_summary['unassigned'][ $emp_status ]++;
            }
        }
        
        $response['eligible_for_rehire'] = (bool) $response['eligible_for_rehire'];
        $response['is_archived'] = (bool) $response['is_archived'];
        $response['is_new_hire'] = (bool) $response['is_new_hire'];
        
        // Get actual longevity from user meta (the authoritative source)
        // Fall back to table value, then to 0
        $user_longevity = Seasonal_Returns::get_employee_longevity_years( $response['user_id'] );
        $response['longevity_years'] = (int) $user_longevity;
    }
    
    // Sort job role summary by total count descending
    usort( $job_role_summary, function( $a, $b ) {
        return $b['total'] - $a['total'];
    } );
    
    return rest_ensure_response( array(
        'success'          => true,
        'responses'        => $responses,
        'job_role_summary' => array_values( $job_role_summary ),
    ) );
}

function aquaticpro_srm_get_employee_seasons( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param('user_id');
    
    $table = $wpdb->prefix . 'srm_employee_seasons';
    $seasons_table = $wpdb->prefix . 'srm_seasons';
    
    $seasons = $wpdb->get_results( $wpdb->prepare(
        "SELECT es.*, s.name as season_name, s.start_date, s.end_date
        FROM $table es
        JOIN $seasons_table s ON es.season_id = s.id
        WHERE es.user_id = %d
        ORDER BY s.start_date DESC",
        $user_id
    ), ARRAY_A );
    
    return rest_ensure_response( array(
        'success' => true,
        'seasons' => $seasons
    ) );
}

function aquaticpro_srm_update_employee_status( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param('user_id');
    $params = $request->get_json_params();
    $season_id = $params['season_id'];
    
    $table = $wpdb->prefix . 'srm_employee_seasons';
    
    $data = array();
    
    if ( isset( $params['status'] ) ) $data['status'] = sanitize_text_field( $params['status'] );
    if ( isset( $params['eligible_for_rehire'] ) ) $data['eligible_for_rehire'] = (int) (bool) $params['eligible_for_rehire'];
    if ( isset( $params['is_archived'] ) ) $data['is_archived'] = (int) (bool) $params['is_archived'];
    if ( isset( $params['is_new_hire'] ) ) $data['is_new_hire'] = (int) (bool) $params['is_new_hire'];
    if ( isset( $params['longevity_years'] ) ) $data['longevity_years'] = intval( $params['longevity_years'] );
    
    // Check if record exists
    $exists = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table WHERE user_id = %d AND season_id = %d",
        $user_id,
        $season_id
    ) );
    
    if ( $exists ) {
        $result = $wpdb->update(
            $table,
            $data,
            array( 'user_id' => $user_id, 'season_id' => $season_id )
        );
    } else {
        $data['user_id'] = $user_id;
        $data['season_id'] = $season_id;
        $result = $wpdb->insert( $table, $data );
    }
    
    if ( $result !== false ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Employee status updated successfully'
        ) );
    }
    
    return new WP_Error( 'update_failed', 'Failed to update employee status', array( 'status' => 500 ) );
}

/**
 * Bulk update employee settings (longevity years, job roles)
 * 
 * @param WP_REST_Request $request Request object
 * @return WP_REST_Response|WP_Error Response
 */
function aquaticpro_srm_bulk_update_employees( $request ) {
    $params = $request->get_json_params();
    
    $user_ids = isset( $params['user_ids'] ) ? array_map( 'intval', $params['user_ids'] ) : [];
    $action = sanitize_text_field( $params['action'] ?? '' );
    $value = $params['value'] ?? null;
    
    if ( empty( $user_ids ) ) {
        return new WP_Error( 'missing_users', 'No users specified', array( 'status' => 400 ) );
    }
    
    if ( empty( $action ) ) {
        return new WP_Error( 'missing_action', 'No action specified', array( 'status' => 400 ) );
    }
    
    $success_count = 0;
    $failed_count = 0;
    $errors = [];
    
    foreach ( $user_ids as $user_id ) {
        // Verify user exists
        $user = get_user_by( 'id', $user_id );
        if ( ! $user ) {
            $failed_count++;
            $errors[] = "User $user_id not found";
            continue;
        }
        
        try {
            switch ( $action ) {
                case 'longevity':
                    // Set longevity years via work_years table (preferred) instead of manual override
                    // This syncs the work_years table to have the specified number of years
                    $target_years = intval( $value );
                    if ( $target_years < 0 ) $target_years = 0;
                    if ( $target_years > 50 ) $target_years = 50;
                    
                    $work_years_table = $wpdb->prefix . 'srm_employee_work_years';
                    
                    // Clear existing work years for this user
                    $wpdb->delete( $work_years_table, array( 'user_id' => $user_id ), array( '%d' ) );
                    
                    // Clear any manual override
                    delete_user_meta( $user_id, 'srm_longevity_years' );
                    
                    // Add work years starting from current year going backwards
                    $current_year = (int) date( 'Y' );
                    for ( $i = 0; $i < $target_years; $i++ ) {
                        $year = $current_year - $i;
                        $wpdb->insert(
                            $work_years_table,
                            array( 'user_id' => $user_id, 'work_year' => $year, 'notes' => 'Set via bulk update' ),
                            array( '%d', '%d', '%s' )
                        );
                    }
                    
                    // Invalidate pay cache
                    Seasonal_Returns::invalidate_pay_cache( $user_id );
                    $success_count++;
                    break;
                    
                case 'job_role':
                    // Add job role(s) to user
                    $role_ids = is_array( $value ) ? array_map( 'intval', $value ) : [ intval( $value ) ];
                    $current_roles = get_user_meta( $user_id, 'pg_job_roles', true );
                    
                    if ( ! is_array( $current_roles ) ) {
                        $current_roles = [];
                    }
                    
                    // Merge new roles with existing (avoid duplicates)
                    $updated_roles = array_unique( array_merge( $current_roles, $role_ids ) );
                    update_user_meta( $user_id, 'pg_job_roles', $updated_roles );
                    
                    // Trigger auto-assignment of courses for newly added roles
                    if ( function_exists( 'aquaticpro_auto_assign_courses_for_user' ) ) {
                        $new_role_ids = array_diff( $role_ids, $current_roles );
                        foreach ( $new_role_ids as $new_role_id ) {
                            aquaticpro_auto_assign_courses_for_user( $user_id, (int) $new_role_id, get_current_user_id() );
                        }
                    }
                    
                    $success_count++;
                    break;
                    
                case 'remove_role':
                    // Remove job role(s) from user
                    $role_ids = is_array( $value ) ? array_map( 'intval', $value ) : [ intval( $value ) ];
                    $current_roles = get_user_meta( $user_id, 'pg_job_roles', true );
                    
                    if ( is_array( $current_roles ) ) {
                        $updated_roles = array_diff( $current_roles, $role_ids );
                        update_user_meta( $user_id, 'pg_job_roles', array_values( $updated_roles ) );
                    }
                    $success_count++;
                    break;
                    
                default:
                    $failed_count++;
                    $errors[] = "Unknown action: $action";
            }
        } catch ( Exception $e ) {
            $failed_count++;
            $errors[] = "User $user_id: " . $e->getMessage();
        }
    }
    
    return rest_ensure_response( array(
        'success' => $failed_count === 0,
        'success_count' => $success_count,
        'failed_count' => $failed_count,
        'errors' => $errors,
        'message' => $success_count > 0 
            ? "$success_count employee(s) updated successfully" 
            : "No employees were updated"
    ) );
}

/**
 * Advance longevity for all employees OR add a specific work year
 * This is typically run at the start of a new season
 */
function aquaticpro_srm_advance_longevity( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $only_returning = isset( $params['only_returning'] ) ? (bool) $params['only_returning'] : false;
    $season_id = isset( $params['season_id'] ) ? intval( $params['season_id'] ) : null;
    $add_year = isset( $params['add_year'] ) ? intval( $params['add_year'] ) : null; // New: add specific year
    $user_ids = isset( $params['user_ids'] ) ? array_map( 'intval', $params['user_ids'] ) : null; // Filter to specific users
    
    // NEW: If add_year is specified, add that year to employee work years table
    if ( $add_year ) {
        $work_years_table = $wpdb->prefix . 'srm_employee_work_years';
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        
        // Get all employees (users with job role assignments) or use provided user_ids
        if ( $user_ids && ! empty( $user_ids ) ) {
            $employee_ids = $user_ids;
        } else {
            $employee_ids = $wpdb->get_col( "SELECT DISTINCT user_id FROM $assignments_table" );
        }
        
        // If only_returning and season_id specified, filter to returning employees only
        if ( $only_returning && $season_id ) {
            $seasons_table = $wpdb->prefix . 'srm_employee_seasons';
            $returning = $wpdb->get_col( $wpdb->prepare(
                "SELECT user_id FROM $seasons_table WHERE season_id = %d AND status = 'returning'",
                $season_id
            ) );
            $employee_ids = array_intersect( $employee_ids, $returning );
        }
        
        $success_count = 0;
        $skipped_count = 0;
        
        foreach ( $employee_ids as $user_id ) {
            // Check if year already exists for this user
            $exists = $wpdb->get_var( $wpdb->prepare(
                "SELECT id FROM $work_years_table WHERE user_id = %d AND work_year = %d",
                $user_id, $add_year
            ) );
            
            if ( $exists ) {
                $skipped_count++;
                continue;
            }
            
            // Add the work year
            $result = $wpdb->insert( $work_years_table, array(
                'user_id' => $user_id,
                'work_year' => $add_year,
                'verified' => 0,
                'notes' => 'Added via bulk action'
            ) );
            
            if ( $result ) {
                $success_count++;
                // Invalidate pay cache for this user
                Seasonal_Returns::invalidate_pay_cache( $user_id );
            }
        }
        
        return rest_ensure_response( array(
            'success' => true,
            'updated_count' => $success_count,
            'skipped_count' => $skipped_count,
            'message' => $success_count > 0 
                ? "Added $add_year work year to $success_count employee(s)" . ( $skipped_count > 0 ? " ($skipped_count already had it)" : "" )
                : "All employees already have $add_year recorded"
        ) );
    }
    
    // LEGACY: Original increment by +1 logic for manual overrides
    // Get all users who have a manual longevity override set
    $users_with_longevity = $wpdb->get_results(
        "SELECT user_id, meta_value as longevity_years 
        FROM {$wpdb->usermeta} 
        WHERE meta_key = 'srm_longevity_years' 
        AND meta_value != ''",
        ARRAY_A
    );
    
    // If only_returning and season_id specified, filter to returning employees only
    $returning_user_ids = [];
    if ( $only_returning && $season_id ) {
        $table = $wpdb->prefix . 'srm_employee_seasons';
        $returning = $wpdb->get_col( $wpdb->prepare(
            "SELECT user_id FROM $table WHERE season_id = %d AND status = 'returning'",
            $season_id
        ) );
        $returning_user_ids = array_map( 'intval', $returning );
    }
    
    $success_count = 0;
    $skipped_count = 0;
    
    foreach ( $users_with_longevity as $row ) {
        $user_id = intval( $row['user_id'] );
        $current_years = intval( $row['longevity_years'] );
        
        // Skip if filtering by returning and user isn't returning
        if ( $only_returning && $season_id && ! in_array( $user_id, $returning_user_ids ) ) {
            $skipped_count++;
            continue;
        }
        
        // Increment by 1
        $new_years = $current_years + 1;
        update_user_meta( $user_id, 'srm_longevity_years', $new_years );
        $success_count++;
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'updated_count' => $success_count,
        'skipped_count' => $skipped_count,
        'message' => $success_count > 0 
            ? "Longevity advanced for $success_count employee(s)" . ( $skipped_count > 0 ? " ($skipped_count skipped)" : "" )
            : "No employees had manual longevity set to advance"
    ) );
}

/**
 * Bulk remove a specific work year from selected employees or all employees
 */
function aquaticpro_srm_remove_work_year_bulk( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $remove_year = isset( $params['remove_year'] ) ? intval( $params['remove_year'] ) : null;
    $user_ids = isset( $params['user_ids'] ) ? array_map( 'intval', $params['user_ids'] ) : null;
    
    if ( ! $remove_year ) {
        return new WP_Error( 'missing_year', 'Year to remove is required', array( 'status' => 400 ) );
    }
    
    $work_years_table = $wpdb->prefix . 'srm_employee_work_years';
    
    // Build WHERE clause
    $where_conditions = array( "work_year = " . intval( $remove_year ) );
    
    // If user_ids specified, only remove from those employees
    if ( $user_ids && ! empty( $user_ids ) ) {
        $ids_list = implode( ',', $user_ids );
        $where_conditions[] = "user_id IN ($ids_list)";
    }
    
    $where_sql = implode( ' AND ', $where_conditions );
    
    // Count how many will be affected
    $count = $wpdb->get_var( "SELECT COUNT(*) FROM $work_years_table WHERE $where_sql" );
    
    if ( $count == 0 ) {
        return rest_ensure_response( array(
            'success' => true,
            'removed_count' => 0,
            'message' => "No work year entries found for $remove_year"
        ) );
    }
    
    // Get affected user IDs before deletion for cache invalidation
    $affected_users = $wpdb->get_col( "SELECT DISTINCT user_id FROM $work_years_table WHERE $where_sql" );
    
    // Delete the records
    $deleted = $wpdb->query( "DELETE FROM $work_years_table WHERE $where_sql" );
    
    // Invalidate pay cache for all affected users
    foreach ( $affected_users as $affected_user_id ) {
        Seasonal_Returns::invalidate_pay_cache( intval( $affected_user_id ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'removed_count' => $deleted,
        'message' => "Removed $remove_year work year from $deleted employee(s)"
    ) );
}

function aquaticpro_srm_bulk_activate_returning( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $season_id = $params['season_id'];
    
    $table = $wpdb->prefix . 'srm_employee_seasons';
    
    // Get all returning employees for this season
    $returning = $wpdb->get_results( $wpdb->prepare(
        "SELECT user_id FROM $table WHERE season_id = %d AND status = 'returning'",
        $season_id
    ), ARRAY_A );
    
    $activated = 0;
    
    foreach ( $returning as $row ) {
        // Un-archive and increment longevity
        $wpdb->update(
            $table,
            array(
                'is_archived' => 0,
                'longevity_years' => $wpdb->get_var( $wpdb->prepare(
                    "SELECT longevity_years + 1 FROM $table WHERE user_id = %d AND season_id = %d",
                    $row['user_id'],
                    $season_id
                ) )
            ),
            array( 'user_id' => $row['user_id'], 'season_id' => $season_id )
        );
        
        // Also update user meta for quick access
        update_user_meta( $row['user_id'], 'srm_is_active', 1 );
        
        $activated++;
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'activated_count' => $activated,
        'message' => "$activated employees activated successfully"
    ) );
}

// ============================================
// API CALLBACKS - PUBLIC RETURN FORM
// ============================================

function aquaticpro_srm_get_return_form( $request ) {
    $token = $request->get_param('token');
    
    error_log("SRM: get_return_form called for token " . substr($token, 0, 16) . "... from IP " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

    $data = Seasonal_Returns::validate_return_token( $token );
    
    // validate_return_token now returns WP_Error with specific codes on failure
    if ( is_wp_error( $data ) ) {
        error_log("SRM: get_return_form - validation failed: " . $data->get_error_code() . " - " . $data->get_error_message());
        return $data;
    }
    
    // Check if already submitted
    $already_submitted = ! empty( $data['response_date'] );
    
    $response = rest_ensure_response( array(
        'success' => true,
        'data' => $data,
        'already_submitted' => $already_submitted
    ) );
    
    // Prevent caching of token validation responses — each request must hit the DB
    $response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
    $response->header( 'Pragma', 'no-cache' );
    $response->header( 'Expires', '0' );
    
    return $response;
}

function aquaticpro_srm_submit_return_intent( $request ) {
    $token = $request->get_param('token');
    $params = $request->get_json_params();
    
    $is_returning = (bool) $params['is_returning'];
    $signature = sanitize_text_field( $params['signature'] );
    $comments = isset( $params['comments'] ) ? sanitize_textarea_field( $params['comments'] ) : null;
    
    $result = Seasonal_Returns::submit_return_intent( $token, $is_returning, $signature, $comments );
    
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    
    $response = rest_ensure_response( $result );
    $response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
    return $response;
}

/**
 * Diagnostic endpoint: lightweight token check for debugging
 * Returns token status without loading full employee/pay data.
 * Usage: GET /wp-json/mentorship-platform/v1/srm/return-form-check/{token}
 */
function aquaticpro_srm_check_return_token( $request ) {
    global $wpdb;
    
    $token = $request->get_param('token');
    $table = $wpdb->prefix . 'srm_employee_seasons';
    $mysql_now = $wpdb->get_var("SELECT NOW()");
    
    // Check if token exists in DB
    $row = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, user_id, season_id, return_token, token_expires_at, status, response_date
         FROM $table WHERE return_token = %s",
        $token
    ), ARRAY_A );
    
    if ( ! $row ) {
        $response = rest_ensure_response( array(
            'token_found' => false,
            'reason' => 'Token does not exist in the database. It may have been regenerated when the email was re-sent.',
            'server_time' => $mysql_now,
            'db_table' => $table,
            'token_prefix' => substr( $token, 0, 16 ) . '...',
        ) );
        $response->header( 'Cache-Control', 'no-store' );
        return $response;
    }
    
    // Check if user exists
    $user = get_userdata( $row['user_id'] );
    
    // Check expiry
    $expires = $row['token_expires_at'];
    $is_expired = false;
    if ( $expires && $expires !== '' && $expires !== '0000-00-00 00:00:00' ) {
        $is_expired = strtotime( $expires ) < strtotime( $mysql_now );
    }
    
    $response = rest_ensure_response( array(
        'token_found' => true,
        'token_prefix' => substr( $token, 0, 16 ) . '...',
        'token_input_length' => strlen( $token ),
        'token_stored_length' => strlen( $row['return_token'] ),
        'tokens_match' => $token === $row['return_token'],
        'record_id' => (int) $row['id'],
        'user_id' => (int) $row['user_id'],
        'user_exists' => ! empty( $user ),
        'user_name' => $user ? $user->display_name : 'USER NOT FOUND',
        'season_id' => (int) $row['season_id'],
        'status' => $row['status'],
        'response_date' => $row['response_date'],
        'token_expires_at' => $expires ?: 'NULL (indefinite)',
        'is_expired' => $is_expired,
        'server_time' => $mysql_now,
        'diagnosis' => $is_expired
            ? 'Token expired. Generate a new link by re-sending the email.'
            : ( ! $user ? 'WordPress user not found for user_id ' . $row['user_id']
            : 'Token is valid. If form still fails, check browser console for network errors.' ),
    ) );
    
    // Also test validate_return_token to compare results
    if ( class_exists( 'Seasonal_Returns' ) ) {
        // First, run the same simple query that validate_return_token now uses
        $vt_table = $wpdb->prefix . 'srm_employee_seasons';
        $vt_query = $wpdb->prepare(
            "SELECT id, return_token, token_expires_at FROM $vt_table WHERE return_token = %s",
            $token
        );
        $vt_result = $wpdb->get_row( $vt_query, ARRAY_A );
        
        // Now call the actual function
        $validate_result = Seasonal_Returns::validate_return_token( $token );
        
        $response_data = $response->get_data();
        $response_data['validate_return_token_test'] = array(
            'called' => true,
            'direct_query_in_callback' => array(
                'table' => $vt_table,
                'query_preview' => substr( $vt_query, 0, 200 ) . '...',
                'result' => $vt_result ? 'found id=' . $vt_result['id'] : 'NULL',
                'wpdb_last_error' => $wpdb->last_error ?: '(none)',
            ),
            'result_type' => is_wp_error( $validate_result ) ? 'WP_Error' : ( is_array( $validate_result ) ? 'array (success!)' : gettype( $validate_result ) ),
            'error_code' => is_wp_error( $validate_result ) ? $validate_result->get_error_code() : null,
            'error_message' => is_wp_error( $validate_result ) ? $validate_result->get_error_message() : null,
            'user_name' => is_array( $validate_result ) && isset( $validate_result['user'] ) ? $validate_result['user']['display_name'] : null,
        );
        $response->set_data( $response_data );
    }
    
    $response->header( 'Cache-Control', 'no-store' );
    return $response;
}

/**
 * Public diagnostic endpoint: Check SRM table status (no sensitive data)
 * Usage: GET /wp-json/mentorship-platform/v1/srm/diagnostic
 */
function aquaticpro_srm_public_diagnostic( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_employee_seasons';
    $seasons_table = $wpdb->prefix . 'srm_seasons';
    $mysql_now = $wpdb->get_var("SELECT NOW()");
    
    // Check if tables exist
    $employee_seasons_exists = (bool) $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
    $seasons_exists = (bool) $wpdb->get_var( "SHOW TABLES LIKE '$seasons_table'" );
    
    // Count records (no personal data)
    $token_count = 0;
    $season_count = 0;
    if ( $employee_seasons_exists ) {
        $token_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE return_token IS NOT NULL" );
    }
    if ( $seasons_exists ) {
        $season_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $seasons_table" );
    }
    
    // Check class status
    $class_exists = class_exists( 'Seasonal_Returns' );
    $module_enabled = $class_exists && Seasonal_Returns::is_enabled();
    
    // Check return_token column type
    $token_column_type = null;
    $token_column_length = null;
    $sample_token_length = null;
    if ( $employee_seasons_exists ) {
        $col_info = $wpdb->get_row( "SHOW COLUMNS FROM $table LIKE 'return_token'", ARRAY_A );
        if ( $col_info ) {
            $token_column_type = $col_info['Type'];
            if ( preg_match('/varchar\((\d+)\)/i', $token_column_type, $m) ) {
                $token_column_length = (int) $m[1];
            }
        }
        // Get length of a sample token
        $sample = $wpdb->get_var( "SELECT LENGTH(return_token) FROM $table WHERE return_token IS NOT NULL LIMIT 1" );
        if ( $sample ) {
            $sample_token_length = (int) $sample;
        }
    }
    
    $issues = [];
    if ( ! $employee_seasons_exists ) {
        $issues[] = "Table $table does not exist. Try deactivating and reactivating the plugin.";
    }
    if ( ! $seasons_exists ) {
        $issues[] = "Table $seasons_table does not exist. Try deactivating and reactivating the plugin.";
    }
    if ( ! $class_exists ) {
        $issues[] = "Seasonal_Returns class not loaded.";
    }
    if ( $class_exists && ! $module_enabled ) {
        $issues[] = "SRM module is disabled in settings.";
    }
    if ( $employee_seasons_exists && $token_count === 0 ) {
        $issues[] = "No tokens found in database. Have any invites been sent?";
    }
    if ( $token_column_length !== null && $token_column_length < 64 ) {
        $issues[] = "CRITICAL: return_token column is VARCHAR($token_column_length) but tokens are 64 chars. Column needs to be expanded. Deactivate and reactivate plugin.";
    }
    if ( $sample_token_length !== null && $sample_token_length < 64 ) {
        $issues[] = "WARNING: Sample token in DB is only $sample_token_length chars (should be 64). Tokens may be truncated.";
    }
    
    return rest_ensure_response( array(
        'status' => empty( $issues ) ? 'ok' : 'issues_found',
        'server_time' => $mysql_now,
        'table_prefix' => $wpdb->prefix,
        'tables' => array(
            'srm_employee_seasons' => $employee_seasons_exists,
            'srm_seasons' => $seasons_exists,
        ),
        'counts' => array(
            'tokens' => $token_count,
            'seasons' => $season_count,
        ),
        'token_column' => array(
            'type' => $token_column_type,
            'length' => $token_column_length,
            'sample_stored_length' => $sample_token_length,
            'expected_length' => 64,
        ),
        'module' => array(
            'class_exists' => $class_exists,
            'is_enabled' => $module_enabled,
        ),
        'issues' => $issues,
    ) );
}

/**
 * Admin endpoint: Look up return form tokens by user email or ID
 * Use this to debug "my link doesn't work" issues.
 * Usage: GET /wp-json/mentorship-platform/v1/srm/admin/token-lookup?email=user@example.com
 *    or: GET /wp-json/mentorship-platform/v1/srm/admin/token-lookup?user_id=123
 */
function aquaticpro_srm_admin_token_lookup( $request ) {
    global $wpdb;
    
    $email = $request->get_param('email');
    $user_id = $request->get_param('user_id');
    
    if ( ! $email && ! $user_id ) {
        return new WP_Error( 'missing_param', 'Provide email or user_id parameter', array( 'status' => 400 ) );
    }
    
    // Find user
    $user = null;
    if ( $email ) {
        $user = get_user_by( 'email', $email );
    } elseif ( $user_id ) {
        $user = get_userdata( (int) $user_id );
    }
    
    if ( ! $user ) {
        return rest_ensure_response( array(
            'found' => false,
            'message' => $email ? "No WordPress user found with email: $email" : "No WordPress user found with ID: $user_id",
        ) );
    }
    
    $table = $wpdb->prefix . 'srm_employee_seasons';
    $seasons_table = $wpdb->prefix . 'srm_seasons';
    $mysql_now = $wpdb->get_var("SELECT NOW()");
    
    // Get all token records for this user
    $records = $wpdb->get_results( $wpdb->prepare(
        "SELECT es.id, es.season_id, es.return_token, es.token_expires_at, es.status, 
                es.response_date, es.invite_sent_at, es.invite_sent_by,
                s.name as season_name, s.year as season_year
         FROM $table es
         LEFT JOIN $seasons_table s ON es.season_id = s.id
         WHERE es.user_id = %d
         ORDER BY es.id DESC",
        $user->ID
    ), ARRAY_A );
    
    $tokens = array();
    foreach ( $records as $row ) {
        $expires = $row['token_expires_at'];
        $is_expired = false;
        if ( $expires && $expires !== '' && $expires !== '0000-00-00 00:00:00' ) {
            $is_expired = strtotime( $expires ) < strtotime( $mysql_now );
        }
        
        $tokens[] = array(
            'record_id' => (int) $row['id'],
            'season_id' => (int) $row['season_id'],
            'season_name' => $row['season_name'] ?: 'Unknown Season',
            'season_year' => $row['season_year'],
            'status' => $row['status'],
            'has_token' => ! empty( $row['return_token'] ),
            'token_prefix' => $row['return_token'] ? substr( $row['return_token'], 0, 16 ) . '...' : null,
            'token_expires_at' => $expires ?: 'NULL (indefinite)',
            'is_expired' => $is_expired,
            'response_date' => $row['response_date'],
            'invite_sent_at' => $row['invite_sent_at'],
            'form_link' => $row['return_token'] ? home_url( '/return-form/' . $row['return_token'] ) : null,
        );
    }
    
    return rest_ensure_response( array(
        'found' => true,
        'user' => array(
            'id' => $user->ID,
            'email' => $user->user_email,
            'display_name' => $user->display_name,
        ),
        'server_time' => $mysql_now,
        'token_count' => count( $tokens ),
        'tokens' => $tokens,
    ) );
}

// ============================================
// API CALLBACKS - EMAIL TEMPLATES
// ============================================

function aquaticpro_srm_get_templates( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_email_templates';
    $templates = $wpdb->get_results( "SELECT * FROM $table ORDER BY is_default DESC, template_type, name", ARRAY_A );
    
    foreach ( $templates as &$template ) {
        $template['is_default'] = (bool) $template['is_default'];
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'templates' => $templates
    ) );
}

function aquaticpro_srm_create_template( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_email_templates';
    
    $data = array(
        'name' => sanitize_text_field( $params['name'] ),
        'subject' => sanitize_text_field( $params['subject'] ),
        'body_html' => wp_kses_post( $params['body_html'] ),
        'body_json' => isset( $params['body_json'] ) ? json_encode( $params['body_json'] ) : null,
        'template_type' => sanitize_text_field( $params['template_type'] ),
        'is_default' => isset( $params['is_default'] ) ? (int) (bool) $params['is_default'] : 0
    );
    
    $result = $wpdb->insert( $table, $data );
    
    if ( $result ) {
        return rest_ensure_response( array(
            'success' => true,
            'id' => $wpdb->insert_id,
            'message' => 'Template created successfully'
        ) );
    }
    
    return new WP_Error( 'create_failed', 'Failed to create template', array( 'status' => 500 ) );
}

function aquaticpro_srm_update_template( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $params = $request->get_json_params();
    $table = $wpdb->prefix . 'srm_email_templates';
    
    $data = array(
        'name' => sanitize_text_field( $params['name'] ),
        'subject' => sanitize_text_field( $params['subject'] ),
        'body_html' => wp_kses_post( $params['body_html'] ),
        'body_json' => isset( $params['body_json'] ) ? json_encode( $params['body_json'] ) : null,
        'template_type' => sanitize_text_field( $params['template_type'] ),
        'is_default' => isset( $params['is_default'] ) ? (int) (bool) $params['is_default'] : 0
    );
    
    $result = $wpdb->update( $table, $data, array( 'id' => $id ) );
    
    if ( $result !== false ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Template updated successfully'
        ) );
    }
    
    return new WP_Error( 'update_failed', 'Failed to update template', array( 'status' => 500 ) );
}

function aquaticpro_srm_delete_template( $request ) {
    global $wpdb;
    
    $id = $request->get_param('id');
    $table = $wpdb->prefix . 'srm_email_templates';
    
    $result = $wpdb->delete( $table, array( 'id' => $id ) );
    
    if ( $result ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Template deleted successfully'
        ) );
    }
    
    return new WP_Error( 'delete_failed', 'Failed to delete template', array( 'status' => 500 ) );
}

function aquaticpro_srm_preview_template( $request ) {
    $params = $request->get_json_params();
    $template_id = $params['template_id'];
    $user_id = $params['user_id'];
    $season_id = $params['season_id'];
    
    // Preview mode: $preview = true prevents generating a new token,
    // so previewing won't overwrite a real token that was already sent
    $rendered = Seasonal_Returns::render_email_template( $template_id, $user_id, $season_id, true );
    
    if ( ! $rendered ) {
        return new WP_Error( 'render_failed', 'Failed to render template', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'preview' => $rendered
    ) );
}

// ============================================
// API CALLBACKS - RETENTION DASHBOARD
// ============================================

function aquaticpro_srm_get_retention_history( $request ) {
    $limit = $request->get_param('limit') ? intval( $request->get_param('limit') ) : 5;
    
    $history = Seasonal_Returns::get_retention_history( $limit );
    
    return rest_ensure_response( array(
        'success' => true,
        'history' => $history
    ) );
}

function aquaticpro_srm_save_retention_snapshot( $request ) {
    $params = $request->get_json_params();
    $season_id = $params['season_id'];
    
    $success = Seasonal_Returns::save_retention_snapshot( $season_id );
    
    if ( $success ) {
        return rest_ensure_response( array(
            'success' => true,
            'message' => 'Retention snapshot saved successfully'
        ) );
    }
    
    return new WP_Error( 'save_failed', 'Failed to save retention snapshot', array( 'status' => 500 ) );
}

// ============================================
// API CALLBACKS - LONGEVITY RATES
// ============================================

/**
 * Get all longevity rates by year
 */
function aquaticpro_srm_get_longevity_rates( $request ) {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_longevity_rates';
    $results = $wpdb->get_results(
        "SELECT id, work_year, rate, notes, created_at, updated_at FROM $table ORDER BY work_year DESC",
        ARRAY_A
    );
    
    return rest_ensure_response( array(
        'success' => true,
        'rates' => $results
    ) );
}

/**
 * Create or update a longevity rate for a specific year
 */
function aquaticpro_srm_upsert_longevity_rate( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $work_year = isset( $params['work_year'] ) ? intval( $params['work_year'] ) : null;
    $rate = isset( $params['rate'] ) ? floatval( $params['rate'] ) : null;
    $notes = isset( $params['notes'] ) ? sanitize_textarea_field( $params['notes'] ) : '';
    
    if ( ! $work_year || $rate === null ) {
        return new WP_Error( 'missing_params', 'work_year and rate are required', array( 'status' => 400 ) );
    }
    
    $table = $wpdb->prefix . 'srm_longevity_rates';
    
    // Check if year already exists
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table WHERE work_year = %d",
        $work_year
    ) );
    
    if ( $existing ) {
        // Update
        $wpdb->update(
            $table,
            array( 'rate' => $rate, 'notes' => $notes ),
            array( 'id' => $existing ),
            array( '%f', '%s' ),
            array( '%d' )
        );
        $id = $existing;
    } else {
        // Insert
        $wpdb->insert(
            $table,
            array( 'work_year' => $work_year, 'rate' => $rate, 'notes' => $notes ),
            array( '%d', '%f', '%s' )
        );
        $id = $wpdb->insert_id;
    }
    
    // Invalidate all pay caches - longevity rates affect all employees
    Seasonal_Returns::invalidate_all_pay_cache();
    
    return rest_ensure_response( array(
        'success' => true,
        'id' => $id,
        'updated' => (bool) $existing
    ) );
}

/**
 * Delete a longevity rate
 */
function aquaticpro_srm_delete_longevity_rate( $request ) {
    global $wpdb;
    
    $id = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'srm_longevity_rates';
    
    $deleted = $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
    
    if ( $deleted ) {
        // Invalidate all pay caches - longevity rates affect all employees
        Seasonal_Returns::invalidate_all_pay_cache();
        
        return rest_ensure_response( array( 'success' => true ) );
    }
    
    return new WP_Error( 'delete_failed', 'Failed to delete longevity rate', array( 'status' => 500 ) );
}

/**
 * Bulk upsert longevity rates
 */
function aquaticpro_srm_bulk_upsert_longevity_rates( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $rates = isset( $params['rates'] ) ? $params['rates'] : [];
    
    if ( empty( $rates ) ) {
        return new WP_Error( 'missing_params', 'rates array is required', array( 'status' => 400 ) );
    }
    
    $table = $wpdb->prefix . 'srm_longevity_rates';
    $success_count = 0;
    
    foreach ( $rates as $rate_data ) {
        $work_year = intval( $rate_data['work_year'] );
        $rate = floatval( $rate_data['rate'] );
        $notes = isset( $rate_data['notes'] ) ? sanitize_textarea_field( $rate_data['notes'] ) : '';
        
        if ( ! $work_year ) continue;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE work_year = %d",
            $work_year
        ) );
        
        if ( $existing ) {
            $wpdb->update(
                $table,
                array( 'rate' => $rate, 'notes' => $notes ),
                array( 'id' => $existing ),
                array( '%f', '%s' ),
                array( '%d' )
            );
        } else {
            $wpdb->insert(
                $table,
                array( 'work_year' => $work_year, 'rate' => $rate, 'notes' => $notes ),
                array( '%d', '%f', '%s' )
            );
        }
        $success_count++;
    }
    
    // Invalidate all pay caches - longevity rates affect all employees
    if ( $success_count > 0 ) {
        Seasonal_Returns::invalidate_all_pay_cache();
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'updated_count' => $success_count
    ) );
}

// ============================================
// API CALLBACKS - EMPLOYEE WORK YEARS
// ============================================

/**
 * Get employee work years
 */
function aquaticpro_srm_get_employee_work_years( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param( 'user_id' );
    $table = $wpdb->prefix . 'srm_employee_work_years';
    
    if ( $user_id ) {
        $results = $wpdb->get_results( $wpdb->prepare(
            "SELECT wy.*, u.display_name 
            FROM $table wy
            LEFT JOIN {$wpdb->users} u ON wy.user_id = u.ID
            WHERE wy.user_id = %d 
            ORDER BY wy.work_year DESC",
            $user_id
        ), ARRAY_A );
    } else {
        // Get all, grouped by user
        $results = $wpdb->get_results(
            "SELECT wy.*, u.display_name 
            FROM $table wy
            LEFT JOIN {$wpdb->users} u ON wy.user_id = u.ID
            ORDER BY u.display_name ASC, wy.work_year DESC",
            ARRAY_A
        );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'work_years' => $results
    ) );
}

/**
 * Add a work year for an employee
 */
function aquaticpro_srm_add_employee_work_year( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $user_id = isset( $params['user_id'] ) ? intval( $params['user_id'] ) : null;
    $work_year = isset( $params['work_year'] ) ? intval( $params['work_year'] ) : null;
    $notes = isset( $params['notes'] ) ? sanitize_textarea_field( $params['notes'] ) : '';
    
    if ( ! $user_id || ! $work_year ) {
        return new WP_Error( 'missing_params', 'user_id and work_year are required', array( 'status' => 400 ) );
    }
    
    $table = $wpdb->prefix . 'srm_employee_work_years';
    
    // Check if already exists
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table WHERE user_id = %d AND work_year = %d",
        $user_id, $work_year
    ) );
    
    if ( $existing ) {
        return new WP_Error( 'duplicate', 'Work year already exists for this employee', array( 'status' => 409 ) );
    }
    
    $inserted = $wpdb->insert(
        $table,
        array( 'user_id' => $user_id, 'work_year' => $work_year, 'notes' => $notes ),
        array( '%d', '%d', '%s' )
    );
    
    if ( $inserted ) {
        // Clear any manual longevity override since work_years table is now the authoritative source
        delete_user_meta( $user_id, 'srm_longevity_years' );
        
        // Invalidate pay cache - work years affect longevity bonus
        Seasonal_Returns::invalidate_pay_cache( $user_id );
        
        return rest_ensure_response( array(
            'success' => true,
            'id' => $wpdb->insert_id
        ) );
    }
    
    return new WP_Error( 'insert_failed', 'Failed to add work year', array( 'status' => 500 ) );
}

/**
 * Delete an employee work year
 */
function aquaticpro_srm_delete_employee_work_year( $request ) {
    global $wpdb;
    
    $id = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'srm_employee_work_years';
    
    // Get user_id before deleting for cache invalidation
    $user_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT user_id FROM $table WHERE id = %d",
        $id
    ) );
    
    $deleted = $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
    
    if ( $deleted ) {
        // Invalidate pay cache - work years affect longevity bonus
        if ( $user_id ) {
            // Clear any manual longevity override since work_years table is the authoritative source
            delete_user_meta( $user_id, 'srm_longevity_years' );
            Seasonal_Returns::invalidate_pay_cache( intval( $user_id ) );
        }
        
        return rest_ensure_response( array( 'success' => true ) );
    }
    
    return new WP_Error( 'delete_failed', 'Failed to delete work year', array( 'status' => 500 ) );
}

/**
 * Verify an employee work year
 */
function aquaticpro_srm_verify_work_year( $request ) {
    global $wpdb;
    
    $id = $request->get_param( 'id' );
    $current_user_id = get_current_user_id();
    $table = $wpdb->prefix . 'srm_employee_work_years';
    
    $updated = $wpdb->update(
        $table,
        array( 
            'verified' => 1, 
            'verified_by' => $current_user_id,
            'verified_at' => current_time( 'mysql' )
        ),
        array( 'id' => $id ),
        array( '%d', '%d', '%s' ),
        array( '%d' )
    );
    
    if ( $updated !== false ) {
        return rest_ensure_response( array( 'success' => true ) );
    }
    
    return new WP_Error( 'verify_failed', 'Failed to verify work year', array( 'status' => 500 ) );
}

/**
 * Calculate longevity bonus for an employee using the new year-based system
 */
function aquaticpro_srm_calculate_longevity_bonus( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param( 'user_id' );
    $rates_table = $wpdb->prefix . 'srm_longevity_rates';
    $years_table = $wpdb->prefix . 'srm_employee_work_years';
    
    // Get all work years for this employee
    $work_years = $wpdb->get_col( $wpdb->prepare(
        "SELECT work_year FROM $years_table WHERE user_id = %d ORDER BY work_year ASC",
        $user_id
    ) );
    
    if ( empty( $work_years ) ) {
        // Fall back to legacy longevity_years if no work years tracked
        $legacy_years = Seasonal_Returns::get_employee_longevity_years( $user_id );
        if ( $legacy_years > 0 ) {
            return rest_ensure_response( array(
                'success' => true,
                'user_id' => $user_id,
                'total_bonus' => 0,
                'work_years' => [],
                'breakdown' => [],
                'message' => "Employee has $legacy_years legacy longevity years but no work years tracked. Run migration to populate.",
                'needs_migration' => true
            ) );
        }
        
        return rest_ensure_response( array(
            'success' => true,
            'user_id' => $user_id,
            'total_bonus' => 0,
            'work_years' => [],
            'breakdown' => []
        ) );
    }
    
    // Get all rates
    $rates = $wpdb->get_results(
        "SELECT work_year, rate FROM $rates_table",
        OBJECT_K
    );
    
    // Calculate total bonus - skip first year (like current system)
    $breakdown = [];
    $total_bonus = 0;
    $years_counted = 0;
    
    foreach ( $work_years as $index => $year ) {
        // Skip first year - no bonus for year 1
        if ( $index === 0 ) {
            $breakdown[] = array(
                'year' => $year,
                'rate' => 0,
                'reason' => 'First year - no bonus'
            );
            continue;
        }
        
        // Get rate for this year (or 0 if not set)
        $rate = isset( $rates[$year] ) ? floatval( $rates[$year]->rate ) : 0;
        $total_bonus += $rate;
        $years_counted++;
        
        $breakdown[] = array(
            'year' => $year,
            'rate' => $rate,
            'reason' => isset( $rates[$year] ) ? null : 'No rate set for this year'
        );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'user_id' => $user_id,
        'total_bonus' => round( $total_bonus, 2 ),
        'years_counted' => $years_counted,
        'work_years' => $work_years,
        'breakdown' => $breakdown
    ) );
}

/**
 * Migrate work years from legacy longevity_years count
 * For each user with srm_longevity_years, creates work year entries going backwards from current year
 */
function aquaticpro_srm_migrate_work_years( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $dry_run = isset( $params['dry_run'] ) ? (bool) $params['dry_run'] : true;
    $start_year = isset( $params['start_year'] ) ? intval( $params['start_year'] ) : date('Y');
    
    $years_table = $wpdb->prefix . 'srm_employee_work_years';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$years_table'" );
    if ( ! $table_exists ) {
        return new WP_Error( 'table_missing', "Table $years_table does not exist. Please deactivate and reactivate the plugin to create it.", array( 'status' => 500 ) );
    }
    
    // Get all users with longevity years set
    $users = $wpdb->get_results(
        "SELECT user_id, meta_value as longevity_years 
        FROM {$wpdb->usermeta} 
        WHERE meta_key = 'srm_longevity_years' 
        AND meta_value > 0",
        ARRAY_A
    );
    
    $migration_results = [];
    $total_created = 0;
    $total_skipped = 0;
    $errors = [];
    
    foreach ( $users as $user_data ) {
        $user_id = intval( $user_data['user_id'] );
        $longevity_years = intval( $user_data['longevity_years'] );
        
        // Get existing work years for this user
        $existing_years = $wpdb->get_col( $wpdb->prepare(
            "SELECT work_year FROM $years_table WHERE user_id = %d",
            $user_id
        ) );
        // Convert to integers for proper comparison
        $existing_years = array_map( 'intval', $existing_years );
        
        $years_to_create = [];
        
        // Create years going backwards from start_year
        for ( $i = 0; $i < $longevity_years; $i++ ) {
            $year = $start_year - $i;
            if ( ! in_array( $year, $existing_years, true ) ) {
                $years_to_create[] = $year;
            }
        }
        
        $user = get_user_by( 'id', $user_id );
        $display_name = $user ? $user->display_name : "User #$user_id";
        
        $migration_results[] = array(
            'user_id' => $user_id,
            'display_name' => $display_name,
            'longevity_years' => $longevity_years,
            'existing_years' => count( $existing_years ),
            'years_to_create' => $years_to_create
        );
        
        if ( ! $dry_run && ! empty( $years_to_create ) ) {
            foreach ( $years_to_create as $year ) {
                $inserted = $wpdb->insert(
                    $years_table,
                    array( 
                        'user_id' => $user_id, 
                        'work_year' => $year, 
                        'notes' => 'Migrated from legacy longevity_years'
                    ),
                    array( '%d', '%d', '%s' )
                );
                if ( $inserted ) {
                    $total_created++;
                } else {
                    $total_skipped++;
                    $errors[] = "Failed to insert year $year for user $user_id: " . $wpdb->last_error;
                }
            }
        } elseif ( $dry_run ) {
            $total_skipped += count( $years_to_create );
        }
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'dry_run' => $dry_run,
        'users_processed' => count( $users ),
        'years_created' => $total_created,
        'years_would_create' => $dry_run ? $total_skipped : 0,
        'results' => $migration_results,
        'errors' => $errors,
        'message' => $dry_run 
            ? "Dry run complete. Would create $total_skipped work year records for " . count($users) . " users."
            : "Migration complete. Created $total_created work year records." . ( count($errors) > 0 ? " Errors: " . count($errors) : "" )
    ) );
}

/**
 * Get longevity settings
 */
function aquaticpro_srm_get_longevity_settings( $request ) {
    return rest_ensure_response( array(
        'success' => true,
        'settings' => array(
            'anniversary_year_mode' => get_option( 'srm_anniversary_year_mode', 'season' ),
            'anniversary_date' => get_option( 'srm_anniversary_date', '' ) // MM-DD format or empty
        )
    ) );
}

/**
 * Update longevity settings
 */
function aquaticpro_srm_update_longevity_settings( $request ) {
    $params = $request->get_json_params();
    
    if ( isset( $params['anniversary_year_mode'] ) ) {
        $mode = sanitize_text_field( $params['anniversary_year_mode'] );
        if ( in_array( $mode, ['season', 'anniversary', 'fixed_date'] ) ) {
            update_option( 'srm_anniversary_year_mode', $mode );
        }
    }
    
    if ( isset( $params['anniversary_date'] ) ) {
        // Validate MM-DD format
        $date = sanitize_text_field( $params['anniversary_date'] );
        if ( empty( $date ) || preg_match( '/^\d{2}-\d{2}$/', $date ) ) {
            update_option( 'srm_anniversary_date', $date );
        }
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'settings' => array(
            'anniversary_year_mode' => get_option( 'srm_anniversary_year_mode', 'season' ),
            'anniversary_date' => get_option( 'srm_anniversary_date', '' )
        )
    ) );
}

// ============================================
// API CALLBACKS - BULK VOID INVITES
// ============================================

/**
 * Bulk void/delete pending invites
 */
function aquaticpro_srm_bulk_void_invites( $request ) {
    global $wpdb;
    
    $params = $request->get_json_params();
    $invite_ids = isset( $params['invite_ids'] ) ? array_map( 'intval', $params['invite_ids'] ) : [];
    $user_ids = isset( $params['user_ids'] ) ? array_map( 'intval', $params['user_ids'] ) : [];
    $season_id = isset( $params['season_id'] ) ? intval( $params['season_id'] ) : null;
    
    if ( empty( $invite_ids ) && empty( $user_ids ) ) {
        return new WP_Error( 'missing_params', 'Either invite_ids or user_ids is required', array( 'status' => 400 ) );
    }
    
    $seasons_table = $wpdb->prefix . 'srm_employee_seasons';
    $voided_count = 0;
    
    if ( ! empty( $invite_ids ) ) {
        // Void by record ID
        $placeholders = implode( ',', array_fill( 0, count( $invite_ids ), '%d' ) );
        $voided_count = $wpdb->query( $wpdb->prepare(
            "DELETE FROM $seasons_table WHERE id IN ($placeholders) AND status = 'pending'",
            ...$invite_ids
        ) );
    } elseif ( ! empty( $user_ids ) && $season_id ) {
        // Void by user_id + season_id
        $placeholders = implode( ',', array_fill( 0, count( $user_ids ), '%d' ) );
        $voided_count = $wpdb->query( $wpdb->prepare(
            "DELETE FROM $seasons_table WHERE user_id IN ($placeholders) AND season_id = %d AND status = 'pending'",
            ...array_merge( $user_ids, [$season_id] )
        ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'voided_count' => $voided_count,
        'message' => "Voided $voided_count pending invite(s)"
    ) );
}

// ============================================
// MY RETURNS — Employee self-service endpoint
// ============================================

/**
 * Get the current logged-in user's own seasonal return data.
 * Returns all seasons they've been invited to with status, pay info, and job roles.
 * Any logged-in user can call this — it only returns their own data.
 */
function aquaticpro_srm_get_my_returns( $request ) {
    global $wpdb;

    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
    }

    $table   = $wpdb->prefix . 'srm_employee_seasons';
    $seasons = $wpdb->prefix . 'srm_seasons';

    // Get all seasons this user has been invited to
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT es.id, es.user_id, es.season_id, es.status, es.eligible_for_rehire,
                es.response_date, es.longevity_years, es.comments, es.signature_text,
                es.created_at, es.updated_at,
                s.name AS season_name, s.year, s.season_type,
                s.start_date, s.end_date, s.is_current, s.is_active
         FROM $table es
         JOIN $seasons s ON es.season_id = s.id
         WHERE es.user_id = %d
         ORDER BY s.start_date DESC",
        $user_id
    ), ARRAY_A );

    if ( ! $rows ) {
        $rows = [];
    }

    // Get job roles
    $job_roles = [];
    if ( class_exists( 'Seasonal_Returns' ) ) {
        $job_roles = Seasonal_Returns::get_user_job_roles( $user_id );
    }

    // Get current pay breakdown
    $pay_breakdown = null;
    if ( class_exists( 'Seasonal_Returns' ) ) {
        try {
            $pay_breakdown = Seasonal_Returns::calculate_pay_rate( $user_id );
        } catch ( Throwable $e ) {
            error_log( "SRM my-returns: pay calc error for user {$user_id}: " . $e->getMessage() );
        }
    }

    // Cast booleans and enrich each row
    foreach ( $rows as &$row ) {
        $row['eligible_for_rehire'] = (bool) $row['eligible_for_rehire'];
        $row['is_current']         = (bool) $row['is_current'];
        $row['is_active']          = (bool) $row['is_active'];
        $row['longevity_years']    = (int) $row['longevity_years'];
        $row['year']               = (int) $row['year'];
    }

    return rest_ensure_response( array(
        'success'       => true,
        'seasons'       => $rows,
        'job_roles'     => $job_roles,
        'pay_breakdown' => $pay_breakdown,
    ) );
}

/**
 * Export seasonal return responses as CSV with projected pay rate.
 *
 * Columns: Name, Email, Job Role(s), Return Status, Projected Season Pay Rate ($/hr)
 */
function aquaticpro_srm_export_responses_csv( $request ) {
    global $wpdb;

    $season_id = $request->get_param( 'season_id' );
    if ( ! $season_id ) {
        return new WP_Error( 'missing_param', 'season_id is required', array( 'status' => 400 ) );
    }

    // Get season name for the filename
    $seasons_table = $wpdb->prefix . 'srm_seasons';
    $season = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $seasons_table WHERE id = %d", $season_id
    ) );
    $season_name = $season ? sanitize_file_name( $season->name ) : 'season';

    // Fetch all employee_seasons rows for this season
    $table = $wpdb->prefix . 'srm_employee_seasons';
    $rows  = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM $table WHERE season_id = %d ORDER BY updated_at DESC",
        $season_id
    ), ARRAY_A );

    $csv_rows = array();

    foreach ( $rows as $row ) {
        $user_id = (int) $row['user_id'];
        $user    = get_userdata( $user_id );

        $display_name = $user ? $user->display_name : "User #{$user_id}";
        $email        = $user ? $user->user_email   : '';

        // Job roles
        $user_roles  = Seasonal_Returns::get_user_job_roles( $user_id );
        $role_titles = ! empty( $user_roles )
            ? implode( ', ', array_map( function( $r ) { return $r['title']; }, $user_roles ) )
            : '';

        // Status label
        $status_map = array(
            'returning'     => 'Returning',
            'not_returning' => 'Not Returning',
            'pending'       => 'Pending',
        );
        $status_label = isset( $status_map[ $row['status'] ] ) ? $status_map[ $row['status'] ] : ucfirst( $row['status'] );

        // Projected pay rate for the season
        $projected = Seasonal_Returns::calculate_projected_pay_rate( $user_id, $season_id );
        $pay_rate  = isset( $projected['total'] ) ? number_format( (float) $projected['total'], 2 ) : '';

        $csv_rows[] = array(
            'Name'                           => $display_name,
            'Email'                          => $email,
            'Job Role'                       => $role_titles,
            'Return Status'                  => $status_label,
            'Projected Season Pay Rate ($/hr)' => $pay_rate,
        );
    }

    // Build CSV string
    if ( empty( $csv_rows ) ) {
        $headers = array( 'Name', 'Email', 'Job Role', 'Return Status', 'Projected Season Pay Rate ($/hr)' );
        $csv_string = implode( ',', $headers ) . "\n";
    } else {
        $headers    = array_keys( $csv_rows[0] );
        $csv_string = implode( ',', $headers ) . "\n";

        foreach ( $csv_rows as $r ) {
            $fields = array();
            foreach ( $headers as $h ) {
                $val = $r[ $h ];
                // Escape for CSV: wrap in quotes if it contains comma, quote or newline
                if ( strpos( $val, ',' ) !== false || strpos( $val, '"' ) !== false || strpos( $val, "\n" ) !== false ) {
                    $val = '"' . str_replace( '"', '""', $val ) . '"';
                }
                $fields[] = $val;
            }
            $csv_string .= implode( ',', $fields ) . "\n";
        }
    }

    return rest_ensure_response( array(
        'success'  => true,
        'csv'      => $csv_string,
        'filename' => "seasonal-returns-{$season_name}",
    ) );
}
