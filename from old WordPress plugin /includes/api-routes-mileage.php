<?php
/**
 * Mileage Reimbursement REST API Routes
 * 
 * Provides mileage tracking, reimbursement calculations, and PDF report generation.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Create mileage reimbursement database tables
 */
function mp_create_mileage_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    // Mileage settings table
    $table_settings = $wpdb->prefix . 'mp_mileage_settings';
    $sql_settings = "CREATE TABLE IF NOT EXISTS $table_settings (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        updated_by BIGINT UNSIGNED,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) $charset_collate;";
    
    // Preset locations table
    $table_locations = $wpdb->prefix . 'mp_mileage_locations';
    $sql_locations = "CREATE TABLE IF NOT EXISTS $table_locations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_by BIGINT UNSIGNED,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) $charset_collate;";
    
    // Budget accounts table
    $table_budgets = $wpdb->prefix . 'mp_mileage_budget_accounts';
    $sql_budgets = "CREATE TABLE IF NOT EXISTS $table_budgets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        account_code VARCHAR(50) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) $charset_collate;";
    
    // Mileage entries table
    $table_entries = $wpdb->prefix . 'mp_mileage_entries';
    $sql_entries = "CREATE TABLE IF NOT EXISTS $table_entries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        trip_date DATE NOT NULL,
        business_purpose VARCHAR(500),
        odometer_start INT UNSIGNED,
        odometer_end INT UNSIGNED,
        calculated_miles INT UNSIGNED NOT NULL DEFAULT 0,
        route_json TEXT,
        tolls DECIMAL(10, 2) DEFAULT 0.00,
        parking DECIMAL(10, 2) DEFAULT 0.00,
        budget_account_id INT UNSIGNED,
        notes TEXT,
        submitted_for_payment TINYINT(1) DEFAULT 0,
        submitted_at DATETIME DEFAULT NULL,
        submitted_by BIGINT UNSIGNED DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_date (user_id, trip_date),
        INDEX idx_trip_date (trip_date),
        INDEX idx_submitted (submitted_for_payment)
    ) $charset_collate;";
    
    // Mileage entry stops (for multi-stop routes)
    $table_stops = $wpdb->prefix . 'mp_mileage_entry_stops';
    $sql_stops = "CREATE TABLE IF NOT EXISTS $table_stops (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_id INT UNSIGNED NOT NULL,
        stop_order INT UNSIGNED NOT NULL,
        location_id INT UNSIGNED,
        custom_address VARCHAR(500),
        distance_to_next INT UNSIGNED DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entry_id (entry_id)
    ) $charset_collate;";
    
    // Permissions table (which roles can access mileage)
    $table_permissions = $wpdb->prefix . 'mp_mileage_permissions';
    $sql_permissions = "CREATE TABLE IF NOT EXISTS $table_permissions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id INT UNSIGNED NOT NULL UNIQUE,
        can_submit TINYINT(1) DEFAULT 1,
        can_view_all TINYINT(1) DEFAULT 0,
        can_manage TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_settings);
    dbDelta($sql_locations);
    dbDelta($sql_budgets);
    dbDelta($sql_entries);
    dbDelta($sql_stops);
    dbDelta($sql_permissions);
    
    // Insert default settings if not exist
    $existing = $wpdb->get_var("SELECT COUNT(*) FROM $table_settings");
    if ($existing == 0) {
        $wpdb->insert($table_settings, array(
            'setting_key' => 'rate_per_mile',
            'setting_value' => '0.70'
        ));
        $wpdb->insert($table_settings, array(
            'setting_key' => 'rate_effective_date',
            'setting_value' => '2025-01-01'
        ));
        $wpdb->insert($table_settings, array(
            'setting_key' => 'organization_name',
            'setting_value' => 'Deerfield Park District'
        ));
        $wpdb->insert($table_settings, array(
            'setting_key' => 'form_notes',
            'setting_value' => 'Mileage forms are to be turned in at least every two months'
        ));
        $wpdb->insert($table_settings, array(
            'setting_key' => 'require_odometer',
            'setting_value' => '1'
        ));
    }
}
register_activation_hook(plugin_dir_path(__DIR__) . 'mentorship-platform.php', 'mp_create_mileage_tables');

// Also run on init if tables don't exist or need column updates
add_action('init', function() {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_settings';
    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
        mp_create_mileage_tables();
    }
    
    // Add submitted_for_payment columns if they don't exist
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $columns = $wpdb->get_col("DESCRIBE $entries_table", 0);
    if (!in_array('submitted_for_payment', $columns)) {
        $wpdb->query("ALTER TABLE $entries_table 
            ADD COLUMN submitted_for_payment TINYINT(1) DEFAULT 0 AFTER notes,
            ADD COLUMN submitted_at DATETIME DEFAULT NULL AFTER submitted_for_payment,
            ADD COLUMN submitted_by BIGINT UNSIGNED DEFAULT NULL AFTER submitted_at,
            ADD INDEX idx_submitted (submitted_for_payment)");
    }
});

/**
 * Register Mileage REST API routes
 */
add_action('rest_api_init', function() {
    $namespace = 'mentorship-platform/v1';
    
    // ============ SETTINGS ============
    register_rest_route($namespace, '/mileage/settings', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_settings',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/settings', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_update_settings',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    // ============ LOCATIONS ============
    register_rest_route($namespace, '/mileage/locations', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_locations',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/locations', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_create_location',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/locations/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_mileage_update_location',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/locations/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_mileage_delete_location',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    // ============ BUDGET ACCOUNTS ============
    register_rest_route($namespace, '/mileage/budget-accounts', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_budget_accounts',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/budget-accounts', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_create_budget_account',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/budget-accounts/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_mileage_update_budget_account',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/budget-accounts/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_mileage_delete_budget_account',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    // ============ PERMISSIONS ============
    register_rest_route($namespace, '/mileage/permissions', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_permissions',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/permissions', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_update_permissions',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    // ============ ENTRIES ============
    register_rest_route($namespace, '/mileage/entries', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_entries',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/entries', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_create_entry',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/entries/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_get_entry',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/entries/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_mileage_update_entry',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    register_rest_route($namespace, '/mileage/entries/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_mileage_delete_entry',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    // ============ BULK OPERATIONS ============
    register_rest_route($namespace, '/mileage/entries/bulk-submit', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_bulk_submit_entries',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/entries/bulk-unsubmit', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_bulk_unsubmit_entries',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    register_rest_route($namespace, '/mileage/entries/bulk-delete', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_bulk_delete_entries',
        'permission_callback' => 'mp_mileage_can_manage'
    ));
    
    // ============ DISTANCE CALCULATION ============
    register_rest_route($namespace, '/mileage/calculate-distance', array(
        'methods' => 'POST',
        'callback' => 'mp_mileage_calculate_distance',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    // ============ REPORTS ============
    register_rest_route($namespace, '/mileage/report', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_generate_report',
        'permission_callback' => 'mp_mileage_can_view_all'
    ));
    
    register_rest_route($namespace, '/mileage/my-report', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_generate_my_report',
        'permission_callback' => 'mp_mileage_can_submit'
    ));
    
    // ============ ACCESS CHECK ============
    register_rest_route($namespace, '/mileage/access', array(
        'methods' => 'GET',
        'callback' => 'mp_mileage_check_access',
        'permission_callback' => '__return_true'
    ));
});

/**
 * Permission check functions
 */
function mp_mileage_get_user_permissions($user_id = null) {
    global $wpdb;
    
    if (!$user_id) {
        $user_id = get_current_user_id();
    }
    
    if (!$user_id) {
        return array('can_submit' => false, 'can_view_all' => false, 'can_manage' => false);
    }
    
    // Plugin Admins (WP admins and Tier 6+) always have full access
    if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin($user_id)) {
        return array('can_submit' => true, 'can_view_all' => true, 'can_manage' => true);
    }
    
    // Get user's job roles
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'mp_mileage_permissions';
    
    // Check if permissions table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$permissions_table'") !== $permissions_table) {
        return array('can_submit' => false, 'can_view_all' => false, 'can_manage' => false);
    }
    
    $user_role_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ));
    
    if (empty($user_role_ids)) {
        return array('can_submit' => false, 'can_view_all' => false, 'can_manage' => false);
    }
    
    // Get permissions for user's roles
    $placeholders = implode(',', array_fill(0, count($user_role_ids), '%d'));
    $perms = $wpdb->get_row($wpdb->prepare(
        "SELECT 
            MAX(can_submit) as can_submit,
            MAX(can_view_all) as can_view_all,
            MAX(can_manage) as can_manage
         FROM $permissions_table
         WHERE job_role_id IN ($placeholders)",
        ...$user_role_ids
    ), ARRAY_A);
    
    return array(
        'can_submit' => (bool) ($perms['can_submit'] ?? false),
        'can_view_all' => (bool) ($perms['can_view_all'] ?? false),
        'can_manage' => (bool) ($perms['can_manage'] ?? false)
    );
}

function mp_mileage_can_submit() {
    $perms = mp_mileage_get_user_permissions();
    return $perms['can_submit'] || $perms['can_manage'];
}

function mp_mileage_can_view_all() {
    $perms = mp_mileage_get_user_permissions();
    return $perms['can_view_all'] || $perms['can_manage'];
}

function mp_mileage_can_manage() {
    $perms = mp_mileage_get_user_permissions();
    return $perms['can_manage'];
}

/**
 * Check user access level
 */
function mp_mileage_check_access(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return rest_ensure_response(array(
            'has_access' => false,
            'can_submit' => false,
            'can_view_all' => false,
            'can_manage' => false
        ));
    }
    
    $perms = mp_mileage_get_user_permissions($user_id);
    return rest_ensure_response(array(
        'has_access' => $perms['can_submit'] || $perms['can_manage'],
        'can_submit' => $perms['can_submit'] || $perms['can_manage'],
        'can_view_all' => $perms['can_view_all'] || $perms['can_manage'],
        'can_manage' => $perms['can_manage']
    ));
}

// ============ SETTINGS HANDLERS ============

function mp_mileage_get_settings(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_settings';
    
    $results = $wpdb->get_results("SELECT setting_key, setting_value FROM $table", ARRAY_A);
    
    $settings = array();
    foreach ($results as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    
    return rest_ensure_response($settings);
}

function mp_mileage_update_settings(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_settings';
    $user_id = get_current_user_id();
    
    $settings = $request->get_json_params();
    
    foreach ($settings as $key => $value) {
        $key = sanitize_key($key);
        $value = sanitize_text_field($value);
        
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE setting_key = %s",
            $key
        ));
        
        if ($exists) {
            $wpdb->update(
                $table,
                array('setting_value' => $value, 'updated_by' => $user_id),
                array('setting_key' => $key)
            );
        } else {
            $wpdb->insert(
                $table,
                array('setting_key' => $key, 'setting_value' => $value, 'updated_by' => $user_id)
            );
        }
    }
    
    return mp_mileage_get_settings($request);
}

// ============ LOCATIONS HANDLERS ============

function mp_mileage_get_locations(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_locations';
    
    $include_inactive = $request->get_param('include_inactive') === 'true';
    
    $where = $include_inactive ? '' : 'WHERE is_active = 1';
    $results = $wpdb->get_results("SELECT * FROM $table $where ORDER BY sort_order ASC, name ASC", ARRAY_A);
    
    return rest_ensure_response($results);
}

function mp_mileage_create_location(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_locations';
    
    $name = sanitize_text_field($request->get_param('name'));
    $address = sanitize_text_field($request->get_param('address'));
    $latitude = floatval($request->get_param('latitude'));
    $longitude = floatval($request->get_param('longitude'));
    $sort_order = intval($request->get_param('sort_order') ?? 0);
    
    if (empty($name) || empty($address)) {
        return new WP_Error('missing_fields', 'Name and address are required', array('status' => 400));
    }
    
    $wpdb->insert($table, array(
        'name' => $name,
        'address' => $address,
        'latitude' => $latitude ?: null,
        'longitude' => $longitude ?: null,
        'sort_order' => $sort_order,
        'created_by' => get_current_user_id()
    ));
    
    $id = $wpdb->insert_id;
    $location = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id), ARRAY_A);
    
    return rest_ensure_response($location);
}

function mp_mileage_update_location(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_locations';
    $id = intval($request->get_param('id'));
    
    $update_data = array();
    
    if ($request->has_param('name')) {
        $update_data['name'] = sanitize_text_field($request->get_param('name'));
    }
    if ($request->has_param('address')) {
        $update_data['address'] = sanitize_text_field($request->get_param('address'));
    }
    if ($request->has_param('latitude')) {
        $update_data['latitude'] = floatval($request->get_param('latitude'));
    }
    if ($request->has_param('longitude')) {
        $update_data['longitude'] = floatval($request->get_param('longitude'));
    }
    if ($request->has_param('is_active')) {
        $update_data['is_active'] = (int) $request->get_param('is_active');
    }
    if ($request->has_param('sort_order')) {
        $update_data['sort_order'] = intval($request->get_param('sort_order'));
    }
    
    if (!empty($update_data)) {
        $wpdb->update($table, $update_data, array('id' => $id));
    }
    
    $location = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id), ARRAY_A);
    return rest_ensure_response($location);
}

function mp_mileage_delete_location(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_locations';
    $id = intval($request->get_param('id'));
    
    // Soft delete by marking inactive
    $wpdb->update($table, array('is_active' => 0), array('id' => $id));
    
    return rest_ensure_response(array('success' => true));
}

// ============ BUDGET ACCOUNTS HANDLERS ============

function mp_mileage_get_budget_accounts(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    
    $include_inactive = $request->get_param('include_inactive') === 'true';
    
    $where = $include_inactive ? '' : 'WHERE is_active = 1';
    $results = $wpdb->get_results("SELECT * FROM $table $where ORDER BY sort_order ASC, account_name ASC", ARRAY_A);
    
    return rest_ensure_response($results);
}

function mp_mileage_create_budget_account(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    
    $account_code = sanitize_text_field($request->get_param('account_code'));
    $account_name = sanitize_text_field($request->get_param('account_name'));
    $sort_order = intval($request->get_param('sort_order') ?? 0);
    
    if (empty($account_code) || empty($account_name)) {
        return new WP_Error('missing_fields', 'Account code and name are required', array('status' => 400));
    }
    
    $wpdb->insert($table, array(
        'account_code' => $account_code,
        'account_name' => $account_name,
        'sort_order' => $sort_order
    ));
    
    $id = $wpdb->insert_id;
    $account = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id), ARRAY_A);
    
    return rest_ensure_response($account);
}

function mp_mileage_update_budget_account(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    $id = intval($request->get_param('id'));
    
    $update_data = array();
    
    if ($request->has_param('account_code')) {
        $update_data['account_code'] = sanitize_text_field($request->get_param('account_code'));
    }
    if ($request->has_param('account_name')) {
        $update_data['account_name'] = sanitize_text_field($request->get_param('account_name'));
    }
    if ($request->has_param('is_active')) {
        $update_data['is_active'] = (int) $request->get_param('is_active');
    }
    if ($request->has_param('sort_order')) {
        $update_data['sort_order'] = intval($request->get_param('sort_order'));
    }
    
    if (!empty($update_data)) {
        $wpdb->update($table, $update_data, array('id' => $id));
    }
    
    $account = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id), ARRAY_A);
    return rest_ensure_response($account);
}

function mp_mileage_delete_budget_account(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    $id = intval($request->get_param('id'));
    
    $wpdb->update($table, array('is_active' => 0), array('id' => $id));
    
    return rest_ensure_response(array('success' => true));
}

// ============ PERMISSIONS HANDLERS ============

function mp_mileage_get_permissions(WP_REST_Request $request) {
    global $wpdb;
    $permissions_table = $wpdb->prefix . 'mp_mileage_permissions';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    error_log("Mileage permissions GET: permissions_table = $permissions_table, roles_table = $roles_table");
    
    // Get all job roles with their mileage permissions
    $sql = "SELECT r.id as role_id, r.title as role_name, 
                COALESCE(p.can_submit, 0) as can_submit,
                COALESCE(p.can_view_all, 0) as can_view_all,
                COALESCE(p.can_manage, 0) as can_manage
         FROM $roles_table r
         LEFT JOIN $permissions_table p ON r.id = p.job_role_id
         ORDER BY r.tier DESC, r.title ASC";
    
    error_log("Mileage permissions GET: SQL = $sql");
    
    $results = $wpdb->get_results($sql, ARRAY_A);
    
    if ($wpdb->last_error) {
        error_log("Mileage permissions GET: SQL Error = " . $wpdb->last_error);
    }
    
    error_log("Mileage permissions GET: Raw results count = " . count($results));
    error_log("Mileage permissions GET: Raw results = " . print_r($results, true));
    
    // Convert string '0'/'1' to proper booleans for JavaScript
    foreach ($results as &$row) {
        $row['role_id'] = (int) $row['role_id'];
        $row['can_submit'] = (bool) $row['can_submit'];
        $row['can_view_all'] = (bool) $row['can_view_all'];
        $row['can_manage'] = (bool) $row['can_manage'];
    }
    
    error_log("Mileage permissions GET: Returning " . count($results) . " permissions");
    
    // Add debug info to response headers for troubleshooting
    $response = rest_ensure_response($results);
    $response->header('X-Debug-SQL', base64_encode($sql));
    $response->header('X-Debug-Result-Count', count($results));
    $response->header('X-Debug-Tables', "$permissions_table, $roles_table");
    if ($wpdb->last_error) {
        $response->header('X-Debug-Error', base64_encode($wpdb->last_error));
    }
    
    return $response;
}

function mp_mileage_update_permissions(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_mileage_permissions';
    
    $data = $request->get_json_params();
    
    error_log("Mileage permissions: Received data: " . print_r($data, true));
    
    // Handle both single permission object and array of permissions
    if (!is_array($data)) {
        return new WP_Error('invalid_data', 'Expected permission data', array('status' => 400));
    }
    
    // Check if this is a single permission object (has role_id key) or array of permissions
    $permissions = isset($data['role_id']) ? array($data) : $data;
    
    $updated_count = 0;
    foreach ($permissions as $perm) {
        if (!isset($perm['role_id'])) {
            continue;
        }
        
        $role_id = intval($perm['role_id']);
        // PHP converts boolean true to int 1, boolean false to int 0
        $can_submit = isset($perm['can_submit']) ? (int) $perm['can_submit'] : 0;
        $can_view_all = isset($perm['can_view_all']) ? (int) $perm['can_view_all'] : 0;
        $can_manage = isset($perm['can_manage']) ? (int) $perm['can_manage'] : 0;
        
        error_log("Mileage permissions: Role {$role_id} - submit:{$can_submit}, view_all:{$can_view_all}, manage:{$can_manage}");
        
        // Use INSERT ... ON DUPLICATE KEY UPDATE for reliable upsert on job_role_id
        // Note: Using explicit values instead of VALUES() which is deprecated in MySQL 8.0+
        $sql = $wpdb->prepare(
            "INSERT INTO $table (job_role_id, can_submit, can_view_all, can_manage) 
             VALUES (%d, %d, %d, %d) 
             ON DUPLICATE KEY UPDATE 
                can_submit = %d,
                can_view_all = %d,
                can_manage = %d",
            $role_id,
            $can_submit,
            $can_view_all,
            $can_manage,
            $can_submit,
            $can_view_all,
            $can_manage
        );
        
        error_log("Mileage permissions: Executing SQL: " . $sql);
        
        $result = $wpdb->query($sql);
        
        if ($result !== false) {
            $updated_count++;
            error_log("Mileage permissions: Successfully updated role_id {$role_id}, affected rows: " . $result);
        } else {
            error_log("Mileage permissions: Failed to update role_id {$role_id}: " . $wpdb->last_error);
        }
    }
    
    error_log("Mileage permissions: Updated {$updated_count} of " . count($permissions) . " permissions");
    
    $get_result = mp_mileage_get_permissions($request);
    error_log("Mileage permissions: GET returned " . count($get_result->get_data()) . " results");
    
    return $get_result;
}

// ============ ENTRIES HANDLERS ============

function mp_mileage_get_entries(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    $locations_table = $wpdb->prefix . 'mp_mileage_locations';
    $budgets_table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    
    $user_id = get_current_user_id();
    $perms = mp_mileage_get_user_permissions($user_id);
    
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    $filter_user_id = $request->get_param('user_id');
    $filter_submitted = $request->get_param('submitted'); // 'all', 'yes', 'no'
    
    $where_clauses = array();
    $params = array();
    
    // If user can view all, allow filtering by user_id; otherwise only show own entries
    if ($perms['can_view_all'] || $perms['can_manage']) {
        if ($filter_user_id) {
            $where_clauses[] = 'e.user_id = %d';
            $params[] = intval($filter_user_id);
        }
    } else {
        $where_clauses[] = 'e.user_id = %d';
        $params[] = $user_id;
    }
    
    if ($date_from) {
        $where_clauses[] = 'e.trip_date >= %s';
        $params[] = $date_from;
    }
    if ($date_to) {
        $where_clauses[] = 'e.trip_date <= %s';
        $params[] = $date_to;
    }
    
    // Filter by submitted status
    if ($filter_submitted === 'yes') {
        $where_clauses[] = 'e.submitted_for_payment = 1';
    } elseif ($filter_submitted === 'no') {
        $where_clauses[] = '(e.submitted_for_payment = 0 OR e.submitted_for_payment IS NULL)';
    }
    
    $where = !empty($where_clauses) ? 'WHERE ' . implode(' AND ', $where_clauses) : '';
    
    $query = "SELECT e.*, 
                     u.display_name as user_name,
                     b.account_code, b.account_name,
                     sub_u.display_name as submitted_by_name
              FROM $entries_table e
              LEFT JOIN {$wpdb->users} u ON e.user_id = u.ID
              LEFT JOIN $budgets_table b ON e.budget_account_id = b.id
              LEFT JOIN {$wpdb->users} sub_u ON e.submitted_by = sub_u.ID
              $where
              ORDER BY e.trip_date DESC, e.created_at DESC
              LIMIT 500";
    
    if (!empty($params)) {
        $query = $wpdb->prepare($query, ...$params);
    }
    
    $entries = $wpdb->get_results($query, ARRAY_A);
    
    // Get stops for each entry
    foreach ($entries as &$entry) {
        $stops = $wpdb->get_results($wpdb->prepare(
            "SELECT s.*, l.name as location_name, l.address as location_address
             FROM $stops_table s
             LEFT JOIN $locations_table l ON s.location_id = l.id
             WHERE s.entry_id = %d
             ORDER BY s.stop_order ASC",
            $entry['id']
        ), ARRAY_A);
        $entry['stops'] = $stops;
    }
    
    return rest_ensure_response($entries);
}

function mp_mileage_get_entry(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    $locations_table = $wpdb->prefix . 'mp_mileage_locations';
    $budgets_table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    
    $id = intval($request->get_param('id'));
    $user_id = get_current_user_id();
    $perms = mp_mileage_get_user_permissions($user_id);
    
    $entry = $wpdb->get_row($wpdb->prepare(
        "SELECT e.*, u.display_name as user_name, b.account_code, b.account_name
         FROM $entries_table e
         LEFT JOIN {$wpdb->users} u ON e.user_id = u.ID
         LEFT JOIN $budgets_table b ON e.budget_account_id = b.id
         WHERE e.id = %d",
        $id
    ), ARRAY_A);
    
    if (!$entry) {
        return new WP_Error('not_found', 'Entry not found', array('status' => 404));
    }
    
    // Check ownership unless user can view all
    if (!$perms['can_view_all'] && !$perms['can_manage'] && (int)$entry['user_id'] !== $user_id) {
        return new WP_Error('forbidden', 'You can only view your own entries', array('status' => 403));
    }
    
    // Get stops
    $stops = $wpdb->get_results($wpdb->prepare(
        "SELECT s.*, l.name as location_name, l.address as location_address
         FROM $stops_table s
         LEFT JOIN $locations_table l ON s.location_id = l.id
         WHERE s.entry_id = %d
         ORDER BY s.stop_order ASC",
        $id
    ), ARRAY_A);
    $entry['stops'] = $stops;
    
    return rest_ensure_response($entry);
}

function mp_mileage_create_entry(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    
    $user_id = get_current_user_id();
    
    $trip_date = sanitize_text_field($request->get_param('trip_date'));
    $business_purpose = sanitize_text_field($request->get_param('business_purpose'));
    $odometer_start = $request->get_param('odometer_start') !== null ? intval($request->get_param('odometer_start')) : null;
    $odometer_end = $request->get_param('odometer_end') !== null ? intval($request->get_param('odometer_end')) : null;
    $calculated_miles = intval($request->get_param('calculated_miles') ?? 0);
    $route_json = $request->get_param('route_json');
    $tolls = floatval($request->get_param('tolls') ?? 0);
    $parking = floatval($request->get_param('parking') ?? 0);
    $budget_account_id = $request->get_param('budget_account_id') ? intval($request->get_param('budget_account_id')) : null;
    $notes = sanitize_textarea_field($request->get_param('notes') ?? '');
    $stops = $request->get_param('stops') ?? array();
    
    if (empty($trip_date)) {
        return new WP_Error('missing_date', 'Trip date is required', array('status' => 400));
    }
    
    // Insert entry
    $wpdb->insert($entries_table, array(
        'user_id' => $user_id,
        'trip_date' => $trip_date,
        'business_purpose' => $business_purpose,
        'odometer_start' => $odometer_start,
        'odometer_end' => $odometer_end,
        'calculated_miles' => $calculated_miles,
        'route_json' => is_array($route_json) ? json_encode($route_json) : $route_json,
        'tolls' => $tolls,
        'parking' => $parking,
        'budget_account_id' => $budget_account_id,
        'notes' => $notes
    ));
    
    $entry_id = $wpdb->insert_id;
    
    if (!$entry_id) {
        return new WP_Error('db_error', 'Failed to create entry: ' . $wpdb->last_error, array('status' => 500));
    }
    
    // Insert stops
    if (!empty($stops) && is_array($stops)) {
        foreach ($stops as $index => $stop) {
            $wpdb->insert($stops_table, array(
                'entry_id' => $entry_id,
                'stop_order' => $index,
                'location_id' => !empty($stop['location_id']) ? intval($stop['location_id']) : null,
                'custom_address' => !empty($stop['custom_address']) ? sanitize_text_field($stop['custom_address']) : null,
                'distance_to_next' => intval($stop['distance_to_next'] ?? 0)
            ));
        }
    }
    
    // Return the created entry
    $request->set_param('id', $entry_id);
    return mp_mileage_get_entry($request);
}

function mp_mileage_update_entry(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    
    $id = intval($request->get_param('id'));
    $user_id = get_current_user_id();
    $perms = mp_mileage_get_user_permissions($user_id);
    
    // Check ownership
    $entry = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM $entries_table WHERE id = %d", $id));
    if (!$entry) {
        return new WP_Error('not_found', 'Entry not found', array('status' => 404));
    }
    
    if (!$perms['can_manage'] && (int)$entry->user_id !== $user_id) {
        return new WP_Error('forbidden', 'You can only edit your own entries', array('status' => 403));
    }
    
    $update_data = array();
    
    if ($request->has_param('trip_date')) {
        $update_data['trip_date'] = sanitize_text_field($request->get_param('trip_date'));
    }
    if ($request->has_param('business_purpose')) {
        $update_data['business_purpose'] = sanitize_text_field($request->get_param('business_purpose'));
    }
    if ($request->has_param('odometer_start')) {
        $update_data['odometer_start'] = $request->get_param('odometer_start') !== null ? intval($request->get_param('odometer_start')) : null;
    }
    if ($request->has_param('odometer_end')) {
        $update_data['odometer_end'] = $request->get_param('odometer_end') !== null ? intval($request->get_param('odometer_end')) : null;
    }
    if ($request->has_param('calculated_miles')) {
        $update_data['calculated_miles'] = intval($request->get_param('calculated_miles'));
    }
    if ($request->has_param('route_json')) {
        $route_json = $request->get_param('route_json');
        $update_data['route_json'] = is_array($route_json) ? json_encode($route_json) : $route_json;
    }
    if ($request->has_param('tolls')) {
        $update_data['tolls'] = floatval($request->get_param('tolls'));
    }
    if ($request->has_param('parking')) {
        $update_data['parking'] = floatval($request->get_param('parking'));
    }
    if ($request->has_param('budget_account_id')) {
        $update_data['budget_account_id'] = $request->get_param('budget_account_id') ? intval($request->get_param('budget_account_id')) : null;
    }
    if ($request->has_param('notes')) {
        $update_data['notes'] = sanitize_textarea_field($request->get_param('notes'));
    }
    
    // Allow managers to reassign the entry to another user
    if ($request->has_param('user_id') && $perms['can_manage']) {
        $new_user_id = intval($request->get_param('user_id'));
        if ($new_user_id > 0 && get_userdata($new_user_id)) {
            $update_data['user_id'] = $new_user_id;
        }
    }

    if (!empty($update_data)) {
        $wpdb->update($entries_table, $update_data, array('id' => $id));
    }
    
    // Update stops if provided
    if ($request->has_param('stops')) {
        $stops = $request->get_param('stops');
        
        // Delete existing stops
        $wpdb->delete($stops_table, array('entry_id' => $id));
        
        // Insert new stops
        if (!empty($stops) && is_array($stops)) {
            foreach ($stops as $index => $stop) {
                $wpdb->insert($stops_table, array(
                    'entry_id' => $id,
                    'stop_order' => $index,
                    'location_id' => !empty($stop['location_id']) ? intval($stop['location_id']) : null,
                    'custom_address' => !empty($stop['custom_address']) ? sanitize_text_field($stop['custom_address']) : null,
                    'distance_to_next' => intval($stop['distance_to_next'] ?? 0)
                ));
            }
        }
    }
    
    return mp_mileage_get_entry($request);
}

function mp_mileage_delete_entry(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    
    $id = intval($request->get_param('id'));
    $user_id = get_current_user_id();
    $perms = mp_mileage_get_user_permissions($user_id);
    
    // Check ownership
    $entry = $wpdb->get_row($wpdb->prepare("SELECT user_id FROM $entries_table WHERE id = %d", $id));
    if (!$entry) {
        return new WP_Error('not_found', 'Entry not found', array('status' => 404));
    }
    
    if (!$perms['can_manage'] && (int)$entry->user_id !== $user_id) {
        return new WP_Error('forbidden', 'You can only delete your own entries', array('status' => 403));
    }
    
    // Delete stops first
    $wpdb->delete($stops_table, array('entry_id' => $id));
    
    // Delete entry
    $wpdb->delete($entries_table, array('id' => $id));
    
    return rest_ensure_response(array('success' => true));
}

// ============ BULK OPERATIONS ============

/**
 * Bulk mark entries as submitted for payment
 */
function mp_mileage_bulk_submit_entries(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    
    $entry_ids = $request->get_param('entry_ids');
    
    if (empty($entry_ids) || !is_array($entry_ids)) {
        return new WP_Error('invalid_ids', 'Entry IDs array is required', array('status' => 400));
    }
    
    $user_id = get_current_user_id();
    $now = current_time('mysql');
    
    $placeholders = implode(',', array_fill(0, count($entry_ids), '%d'));
    $params = array_map('intval', $entry_ids);
    
    $wpdb->query($wpdb->prepare(
        "UPDATE $entries_table 
         SET submitted_for_payment = 1, submitted_at = %s, submitted_by = %d 
         WHERE id IN ($placeholders)",
        $now,
        $user_id,
        ...$params
    ));
    
    return rest_ensure_response(array(
        'success' => true,
        'updated' => $wpdb->rows_affected,
        'submitted_at' => $now
    ));
}

/**
 * Bulk unmark entries (undo submit for payment)
 */
function mp_mileage_bulk_unsubmit_entries(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    
    $entry_ids = $request->get_param('entry_ids');
    
    if (empty($entry_ids) || !is_array($entry_ids)) {
        return new WP_Error('invalid_ids', 'Entry IDs array is required', array('status' => 400));
    }
    
    $placeholders = implode(',', array_fill(0, count($entry_ids), '%d'));
    $params = array_map('intval', $entry_ids);
    
    $wpdb->query($wpdb->prepare(
        "UPDATE $entries_table 
         SET submitted_for_payment = 0, submitted_at = NULL, submitted_by = NULL 
         WHERE id IN ($placeholders)",
        ...$params
    ));
    
    return rest_ensure_response(array(
        'success' => true,
        'updated' => $wpdb->rows_affected
    ));
}

/**
 * Bulk delete entries (admin only)
 */
function mp_mileage_bulk_delete_entries(WP_REST_Request $request) {
    global $wpdb;
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    
    $entry_ids = $request->get_param('entry_ids');
    
    if (empty($entry_ids) || !is_array($entry_ids)) {
        return new WP_Error('invalid_ids', 'Entry IDs array is required', array('status' => 400));
    }
    
    $placeholders = implode(',', array_fill(0, count($entry_ids), '%d'));
    $params = array_map('intval', $entry_ids);
    
    // Delete stops first
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $stops_table WHERE entry_id IN ($placeholders)",
        ...$params
    ));
    
    // Delete entries
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $entries_table WHERE id IN ($placeholders)",
        ...$params
    ));
    
    return rest_ensure_response(array(
        'success' => true,
        'deleted' => $wpdb->rows_affected
    ));
}

// ============ DISTANCE CALCULATION ============

/**
 * Calculate driving distance between addresses using OpenRouteService or fallback
 */
function mp_mileage_calculate_distance(WP_REST_Request $request) {
    $stops = $request->get_param('stops');
    
    if (empty($stops) || !is_array($stops) || count($stops) < 2) {
        return new WP_Error('invalid_stops', 'At least 2 stops are required', array('status' => 400));
    }
    
    global $wpdb;
    $locations_table = $wpdb->prefix . 'mp_mileage_locations';
    
    // Resolve addresses for each stop
    $addresses = array();
    $failed_geocodes = array();
    
    foreach ($stops as $index => $stop) {
        if (!empty($stop['location_id'])) {
            $location = $wpdb->get_row($wpdb->prepare(
                "SELECT address, latitude, longitude FROM $locations_table WHERE id = %d",
                intval($stop['location_id'])
            ));
            if ($location) {
                $addresses[] = array(
                    'address' => $location->address,
                    'lat' => $location->latitude,
                    'lng' => $location->longitude
                );
            } else {
                error_log("Mileage calc: Location ID {$stop['location_id']} not found");
            }
        } elseif (!empty($stop['custom_address'])) {
            $custom_addr = trim($stop['custom_address']);
            
            // Validate address format
            if (strlen($custom_addr) < 5) {
                $failed_geocodes[] = "Stop " . ($index + 1) . ": Address too short";
                continue;
            }
            
            $addresses[] = array(
                'address' => $custom_addr,
                'lat' => null,
                'lng' => null
            );
            
            error_log("Mileage calc: Custom address added: " . $custom_addr);
        }
    }
    
    if (count($addresses) < 2) {
        $error_msg = 'Could not resolve addresses';
        if (!empty($failed_geocodes)) {
            $error_msg .= ': ' . implode(', ', $failed_geocodes);
        }
        error_log("Mileage calc failed: " . $error_msg);
        return new WP_Error('invalid_addresses', $error_msg, array('status' => 400));
    }
    
    // Calculate distances between consecutive stops
    $segments = array();
    $total_distance = 0;
    $geocode_failures = array();
    
    for ($i = 0; $i < count($addresses) - 1; $i++) {
        $from = $addresses[$i];
        $to = $addresses[$i + 1];
        
        // Get driving distance using OpenRouteService or fallback to Haversine
        $distance = mp_calculate_segment_distance($from, $to);
        
        if ($distance === 0) {
            $geocode_failures[] = "Route from '{$from['address']}' to '{$to['address']}'";
        }
        
        $segments[] = array(
            'from' => $from['address'],
            'to' => $to['address'],
            'distance_miles' => $distance
        );
        
        $total_distance += $distance;
    }
    
    // If total is 0, something went wrong
    if ($total_distance === 0 && !empty($geocode_failures)) {
        $error_msg = 'Could not geocode addresses for: ' . implode(', ', $geocode_failures);
        error_log("Mileage calc: " . $error_msg);
        return new WP_Error('geocoding_failed', $error_msg . '. Please use complete addresses like "123 Main St, City, State ZIP"', array('status' => 400));
    }
    
    // Apply rounding rule: round up if decimal is 0.2 or greater
    $decimal = $total_distance - floor($total_distance);
    if ($decimal >= 0.2) {
        $total_distance = ceil($total_distance);
    } else {
        $total_distance = floor($total_distance);
    }
    
    error_log("Mileage calc success: Total miles = " . $total_distance);
    
    return rest_ensure_response(array(
        'segments' => $segments,
        'total_miles' => (int) $total_distance,
        'raw_total' => array_sum(array_column($segments, 'distance_miles'))
    ));
}

/**
 * Geocode an address using OpenRouteService
 */
function mp_geocode_address($address, $api_key) {
    $url = 'https://api.openrouteservice.org/geocode/search?' . http_build_query(array(
        'api_key' => $api_key,
        'text' => $address,
        'size' => 1,
        'boundary.country' => 'US'
    ));
    
    error_log("Geocoding address: {$address}");
    
    $response = wp_remote_get($url, array('timeout' => 10));
    
    if (is_wp_error($response)) {
        error_log("Geocode WP error: " . $response->get_error_message());
        return null;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    error_log("Geocode response code: {$response_code}");
    
    if ($response_code !== 200) {
        error_log("Geocode API error: " . wp_remote_retrieve_body($response));
        return null;
    }
    
    if (!empty($body['features'][0]['geometry']['coordinates'])) {
        $coords = $body['features'][0]['geometry']['coordinates'];
        error_log("Geocode success: lat={$coords[1]}, lng={$coords[0]}");
        return array(
            'lng' => $coords[0],
            'lat' => $coords[1]
        );
    }
    
    error_log("Geocode failed - no features returned for: {$address}");
    return null;
}

/**
 * Get driving distance between two coordinates using OpenRouteService Directions API
 */
function mp_get_ors_driving_distance($from_coords, $to_coords, $api_key) {
    $url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    
    $body = json_encode(array(
        'coordinates' => array(
            array($from_coords['lng'], $from_coords['lat']),
            array($to_coords['lng'], $to_coords['lat'])
        ),
        'units' => 'mi'
    ));
    
    $response = wp_remote_post($url, array(
        'timeout' => 15,
        'headers' => array(
            'Authorization' => $api_key,
            'Content-Type' => 'application/json'
        ),
        'body' => $body
    ));
    
    if (is_wp_error($response)) {
        error_log('OpenRouteService error: ' . $response->get_error_message());
        return null;
    }
    
    $result = json_decode(wp_remote_retrieve_body($response), true);
    
    if (!empty($result['routes'][0]['summary']['distance'])) {
        // Distance is returned in miles when units=mi
        return round($result['routes'][0]['summary']['distance'], 2);
    }
    
    // Check for error message
    if (!empty($result['error'])) {
        error_log('OpenRouteService API error: ' . json_encode($result['error']));
    }
    
    return null;
}

/**
 * Calculate distance between two points
 * Uses OpenRouteService for real driving distance, falls back to Haversine with 1.3x multiplier
 */
function mp_calculate_segment_distance($from, $to) {
    global $wpdb;
    $settings_table = $wpdb->prefix . 'mp_mileage_settings';
    
    // Get API key from settings
    $api_key_row = $wpdb->get_row("SELECT setting_value FROM $settings_table WHERE setting_key = 'ors_api_key'");
    $api_key = $api_key_row ? $api_key_row->setting_value : '';
    
    error_log("ORS API key present: " . (!empty($api_key) ? 'YES (length: ' . strlen($api_key) . ')' : 'NO'));
    
    // Try OpenRouteService if we have an API key
    if (!empty($api_key)) {
        $from_coords = null;
        $to_coords = null;
        
        // Get coordinates - geocode if needed
        if (!empty($from['lat']) && !empty($from['lng'])) {
            $from_coords = array('lat' => $from['lat'], 'lng' => $from['lng']);
            error_log("From coords from input: lat={$from['lat']}, lng={$from['lng']}");
        } elseif (!empty($from['address'])) {
            error_log("Need to geocode FROM address: {$from['address']}");
            $from_coords = mp_geocode_address($from['address'], $api_key);
        }
        
        if (!empty($to['lat']) && !empty($to['lng'])) {
            $to_coords = array('lat' => $to['lat'], 'lng' => $to['lng']);
            error_log("To coords from input: lat={$to['lat']}, lng={$to['lng']}");
        } elseif (!empty($to['address'])) {
            error_log("Need to geocode TO address: {$to['address']}");
            $to_coords = mp_geocode_address($to['address'], $api_key);
        }
        
        // If we have both coordinates, get driving distance
        if ($from_coords && $to_coords) {
            $ors_distance = mp_get_ors_driving_distance($from_coords, $to_coords, $api_key);
            if ($ors_distance !== null) {
                return $ors_distance;
            }
            error_log("ORS driving distance failed, falling back to Haversine");
        } else {
            error_log("Missing coordinates - from: " . ($from_coords ? 'OK' : 'NULL') . ", to: " . ($to_coords ? 'OK' : 'NULL'));
        }
    }
    
    // Fallback: Haversine formula with 1.3x multiplier
    if (!empty($from['lat']) && !empty($from['lng']) && !empty($to['lat']) && !empty($to['lng'])) {
        $lat1 = deg2rad($from['lat']);
        $lat2 = deg2rad($to['lat']);
        $lon1 = deg2rad($from['lng']);
        $lon2 = deg2rad($to['lng']);
        
        $dlat = $lat2 - $lat1;
        $dlon = $lon2 - $lon1;
        
        $a = sin($dlat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dlon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        
        // Earth's radius in miles
        $r = 3959;
        $straight_distance = $r * $c;
        
        // Apply 1.3x multiplier to approximate driving distance
        return round($straight_distance * 1.3, 1);
    }
    
    // No coordinates available
    return 0;
}

// ============ REPORT GENERATION ============

/**
 * Generate PDF report for date range (admin view - all users)
 */
function mp_mileage_generate_report(WP_REST_Request $request) {
    global $wpdb;
    
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    $user_ids = $request->get_param('user_ids'); // Optional array of user IDs
    $include_payout = $request->get_param('include_payout') !== false;
    
    if (empty($date_from) || empty($date_to)) {
        return new WP_Error('missing_dates', 'Date range is required', array('status' => 400));
    }
    
    return mp_generate_mileage_report_data($date_from, $date_to, $user_ids, $include_payout);
}

/**
 * Generate PDF report for current user only
 */
function mp_mileage_generate_my_report(WP_REST_Request $request) {
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    $include_payout = $request->get_param('include_payout') !== false;
    
    if (empty($date_from) || empty($date_to)) {
        return new WP_Error('missing_dates', 'Date range is required', array('status' => 400));
    }
    
    $user_id = get_current_user_id();
    
    return mp_generate_mileage_report_data($date_from, $date_to, array($user_id), $include_payout, true);
}

/**
 * Generate report data for PDF
 */
function mp_generate_mileage_report_data($date_from, $date_to, $user_ids = null, $include_payout = true, $is_self_report = false) {
    global $wpdb;
    
    $entries_table = $wpdb->prefix . 'mp_mileage_entries';
    $stops_table = $wpdb->prefix . 'mp_mileage_entry_stops';
    $locations_table = $wpdb->prefix . 'mp_mileage_locations';
    $budgets_table = $wpdb->prefix . 'mp_mileage_budget_accounts';
    $settings_table = $wpdb->prefix . 'mp_mileage_settings';
    
    // Get settings
    $settings = $wpdb->get_results("SELECT setting_key, setting_value FROM $settings_table", OBJECT_K);
    $rate_per_mile = isset($settings['rate_per_mile']) ? floatval($settings['rate_per_mile']->setting_value) : 0.70;
    $org_name = isset($settings['organization_name']) ? $settings['organization_name']->setting_value : 'Organization';
    $form_notes = isset($settings['form_notes']) ? $settings['form_notes']->setting_value : '';
    $rate_effective = isset($settings['rate_effective_date']) ? $settings['rate_effective_date']->setting_value : '';
    
    // Build query
    $where_clauses = array(
        'e.trip_date >= %s',
        'e.trip_date <= %s'
    );
    $params = array($date_from, $date_to);
    
    if (!empty($user_ids) && is_array($user_ids)) {
        $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));
        $where_clauses[] = "e.user_id IN ($placeholders)";
        $params = array_merge($params, array_map('intval', $user_ids));
    }
    
    $where = 'WHERE ' . implode(' AND ', $where_clauses);
    
    // Get entries grouped by user
    $query = $wpdb->prepare(
        "SELECT e.*, 
                u.display_name as user_name,
                u.user_email,
                b.account_code, b.account_name
         FROM $entries_table e
         LEFT JOIN {$wpdb->users} u ON e.user_id = u.ID
         LEFT JOIN $budgets_table b ON e.budget_account_id = b.id
         $where
         ORDER BY e.user_id, e.trip_date ASC",
        ...$params
    );
    
    $entries = $wpdb->get_results($query, ARRAY_A);
    
    // Get stops for all entries
    $entry_ids = array_column($entries, 'id');
    $stops_by_entry = array();
    
    if (!empty($entry_ids)) {
        $placeholders = implode(',', array_fill(0, count($entry_ids), '%d'));
        $stops = $wpdb->get_results($wpdb->prepare(
            "SELECT s.*, l.name as location_name, l.address as location_address
             FROM $stops_table s
             LEFT JOIN $locations_table l ON s.location_id = l.id
             WHERE s.entry_id IN ($placeholders)
             ORDER BY s.entry_id, s.stop_order ASC",
            ...$entry_ids
        ), ARRAY_A);
        
        foreach ($stops as $stop) {
            $stops_by_entry[$stop['entry_id']][] = $stop;
        }
    }
    
    // Group entries by user
    $users_data = array();
    foreach ($entries as $entry) {
        $uid = $entry['user_id'];
        if (!isset($users_data[$uid])) {
            $users_data[$uid] = array(
                'user_id' => $uid,
                'user_name' => $entry['user_name'],
                'user_email' => $entry['user_email'],
                'entries' => array(),
                'total_miles' => 0,
                'total_tolls' => 0,
                'total_parking' => 0,
                'budget_accounts' => array()
            );
        }
        
        $entry['stops'] = $stops_by_entry[$entry['id']] ?? array();
        $users_data[$uid]['entries'][] = $entry;
        $users_data[$uid]['total_miles'] += (int) $entry['calculated_miles'];
        $users_data[$uid]['total_tolls'] += floatval($entry['tolls']);
        $users_data[$uid]['total_parking'] += floatval($entry['parking']);
        
        // Track budget accounts
        if (!empty($entry['budget_account_id'])) {
            $budget_key = $entry['account_code'] . ' - ' . $entry['account_name'];
            if (!isset($users_data[$uid]['budget_accounts'][$budget_key])) {
                $users_data[$uid]['budget_accounts'][$budget_key] = 0;
            }
            $users_data[$uid]['budget_accounts'][$budget_key] += (int) $entry['calculated_miles'];
        }
    }
    
    // Calculate payouts
    foreach ($users_data as &$user_data) {
        $user_data['mileage_amount'] = $include_payout ? round($user_data['total_miles'] * $rate_per_mile, 2) : null;
        $user_data['total_requested'] = $include_payout 
            ? round($user_data['total_miles'] * $rate_per_mile + $user_data['total_tolls'] + $user_data['total_parking'], 2)
            : null;
    }
    
    // Generate report timestamp
    $report_date = current_time('Y-m-d');
    $report_timestamp = current_time('F j, Y g:i A');
    $generated_by = get_current_user_id();
    $generated_by_name = wp_get_current_user()->display_name;
    
    return rest_ensure_response(array(
        'report_meta' => array(
            'date_from' => $date_from,
            'date_to' => $date_to,
            'generated_at' => $report_timestamp,
            'generated_by' => $generated_by_name,
            'report_date' => $report_date,
            'organization_name' => $org_name,
            'form_notes' => $form_notes,
            'rate_per_mile' => $rate_per_mile,
            'rate_effective_date' => $rate_effective,
            'include_payout' => $include_payout
        ),
        'users' => array_values($users_data)
    ));
}
