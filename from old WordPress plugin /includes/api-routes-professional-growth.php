<?php
/**
 * Professional Growth Module API Routes
 * Handles job roles, promotion criteria, user progress, audits, and training logs
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Ensure indexes exist for in-service compliance optimization
 * Only runs once, then caches result for 24 hours
 */
function mentorship_platform_pg_ensure_inservice_indexes() {
     // Check if we've already created indexes (cached for 24 hours)
     if (get_transient('mentorship_pg_indexes_created')) {
         return;
     }
     
     global $wpdb;
     
     // Helper function to check if index exists
     $index_exists = function($table, $index_name) use ($wpdb) {
         $result = $wpdb->get_var($wpdb->prepare(
             "SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS 
              WHERE table_schema = DATABASE() 
              AND table_name = %s 
              AND index_name = %s",
             $table,
             $index_name
         ));
         return $result > 0;
     };
     
     // Add index to training_date in inservice logs
     $table = $wpdb->prefix . 'pg_inservice_logs';
     if (!$index_exists($table, 'idx_training_date')) {
         $wpdb->query("CREATE INDEX idx_training_date ON {$table} (training_date)");
     }
     
     // Add index to archived in inservice logs
     if (!$index_exists($table, 'idx_archived')) {
         $wpdb->query("CREATE INDEX idx_archived ON {$table} (archived)");
     }
     
     // Add index to user_id in attendees
     $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
     if (!$index_exists($attendees_table, 'idx_user_id')) {
         $wpdb->query("CREATE INDEX idx_user_id ON {$attendees_table} (user_id)");
     }
     
     // Add index to inservice_id in attendees
     if (!$index_exists($attendees_table, 'idx_inservice_id')) {
         $wpdb->query("CREATE INDEX idx_inservice_id ON {$attendees_table} (inservice_id)");
     }
     
     // Add index to attendance_status in attendees
     if (!$index_exists($attendees_table, 'idx_attendance_status')) {
         $wpdb->query("CREATE INDEX idx_attendance_status ON {$attendees_table} (attendance_status)");
     }
     
     // Cache that we've checked/created indexes (24 hours)
     set_transient('mentorship_pg_indexes_created', true, DAY_IN_SECONDS);
}

add_action('init', 'mentorship_platform_pg_ensure_inservice_indexes');

/**
 * Ensure permissions tables exist for job role-based permissions
 * Only runs once per plugin version to avoid repeated dbDelta calls
 */
function mentorship_platform_pg_ensure_permissions_tables() {
    // Only run once per version - dbDelta is expensive
    $tables_version = get_option('mp_pg_tables_version', '0');
    if (version_compare($tables_version, '1.3.0', '>=')) {
        return; // Tables already created
    }
    
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    // Scan Audit Permissions Table
    $scan_audit_table = $wpdb->prefix . 'pg_scan_audit_permissions';
    $sql_scan_audit = "CREATE TABLE IF NOT EXISTS $scan_audit_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 1,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        can_moderate_all TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    
    // Live Drill Permissions Table
    $live_drill_table = $wpdb->prefix . 'pg_live_drill_permissions';
    $sql_live_drill = "CREATE TABLE IF NOT EXISTS $live_drill_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 1,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        can_moderate_all TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    
    // Lesson Management Permissions Table
    $lesson_mgmt_table = $wpdb->prefix . 'pg_lesson_management_permissions';
    $sql_lesson_mgmt = "CREATE TABLE IF NOT EXISTS $lesson_mgmt_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 1,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        can_moderate_all TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    
    // LMS Permissions Table
    $lms_table = $wpdb->prefix . 'pg_lms_permissions';
    $sql_lms = "CREATE TABLE IF NOT EXISTS $lms_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view_courses TINYINT(1) DEFAULT 1,
        can_view_lessons TINYINT(1) DEFAULT 1,
        can_create_courses TINYINT(1) DEFAULT 0,
        can_edit_courses TINYINT(1) DEFAULT 0,
        can_delete_courses TINYINT(1) DEFAULT 0,
        can_create_lessons TINYINT(1) DEFAULT 0,
        can_edit_lessons TINYINT(1) DEFAULT 0,
        can_delete_lessons TINYINT(1) DEFAULT 0,
        can_manage_hotspots TINYINT(1) DEFAULT 0,
        can_manage_excalidraw TINYINT(1) DEFAULT 0,
        can_moderate_all TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    
    // Instructor Evaluation Permissions Table
    $instructor_eval_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
    $sql_instructor_eval = "CREATE TABLE IF NOT EXISTS $instructor_eval_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        can_moderate_all TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_scan_audit);
    dbDelta($sql_live_drill);
    dbDelta($sql_lesson_mgmt);
    dbDelta($sql_lms);
    dbDelta($sql_instructor_eval);
    
    // Email Permissions Table
    $email_table = $wpdb->prefix . 'pg_email_permissions';
    $sql_email = "CREATE TABLE IF NOT EXISTS $email_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_send_email TINYINT(1) DEFAULT 0,
        can_manage_templates TINYINT(1) DEFAULT 0,
        can_view_history TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id),
        KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    dbDelta($sql_email);
    
    // Mark as done
    update_option('mp_pg_tables_version', '1.3.0');
}

add_action('init', 'mentorship_platform_pg_ensure_permissions_tables');

/**
 * Helper function to upsert permission data using INSERT ... ON DUPLICATE KEY UPDATE
 * This is more reliable than $wpdb->replace() for tables with auto-increment primary keys
 * and unique constraints on job_role_id
 * 
 * @param string $table Full table name
 * @param array $data Associative array of column => value pairs (must include job_role_id)
 * @return bool True on success, false on failure
 */
function mentorship_platform_pg_upsert_permission($table, $data) {
    global $wpdb;
    
    if (empty($data['job_role_id'])) {
        return false;
    }
    
    // Build column list and values
    $columns = array_keys($data);
    $values = array_values($data);
    $placeholders = array_fill(0, count($columns), '%d');
    
    // Build UPDATE clause - exclude job_role_id from UPDATE
    $update_pairs = array();
    foreach ($columns as $col) {
        if ($col !== 'job_role_id') {
            $update_pairs[] = "$col = VALUES($col)";
        }
    }
    
    $sql = $wpdb->prepare(
        "INSERT INTO $table (" . implode(', ', $columns) . ") 
         VALUES (" . implode(', ', $placeholders) . ") 
         ON DUPLICATE KEY UPDATE " . implode(', ', $update_pairs),
        $values
    );
    
    $result = $wpdb->query($sql);
    
    if ($result === false) {
        error_log("mentorship_platform_pg_upsert_permission failed for table $table: " . $wpdb->last_error);
    }
    
    return $result !== false;
}

/**
 * Register Professional Growth Module REST API routes
 */
function mentorship_platform_register_pg_api_routes() {
    $namespace = 'mentorship-platform/v1';

    // --- My Permissions Route ---
    // Get current user's professional growth permissions
    register_rest_route( $namespace, '/professional-growth/my-permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_my_permissions',
        'permission_callback' => 'is_user_logged_in',
    ) );
    
    // Shorter alias for the same endpoint
    register_rest_route( $namespace, '/pg/my-permissions', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_my_permissions',
        'permission_callback' => 'is_user_logged_in',
    ) );

    // --- Job Roles Routes ---

    // Get all job roles or create a new one
    register_rest_route( $namespace, '/pg/job-roles', array(
        // GET /pg/job-roles - Allow all logged-in users to view job roles (needed for permission checks)
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_job_roles',
            'permission_callback' => 'is_user_logged_in',
        ),
        // POST /pg/job-roles
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_job_role',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'title'       => array( 'required' => true, 'type' => 'string' ),
                'tier'        => array( 'required' => true, 'type' => 'integer' ),
                'description' => array( 'type' => 'string' ),
                'inservice_hours' => array( 'type' => 'number', 'default' => 4.0 ),
            ),
        ),
    ) );

    // Get, update, or delete a specific job role
    register_rest_route( $namespace, '/pg/job-roles/(?P<id>\d+)', array(
        // GET /pg/job-roles/{id}
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_job_role',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
        // PUT /pg/job-roles/{id}
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_job_role',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id'          => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'title'       => array( 'type' => 'string' ),
                'tier'        => array( 'type' => 'integer' ),
                'description' => array( 'type' => 'string' ),
                'inservice_hours' => array( 'type' => 'number' ),
            ),
        ),
        // DELETE /pg/job-roles/{id}
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_job_role',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // --- Promotion Criteria Routes ---

    // Get all criteria for a job role or create new criteria
    register_rest_route( $namespace, '/pg/criteria', array(
        // GET /pg/criteria?job_role_id={id}
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_criteria',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'job_role_id' => array( 'type' => 'integer' ),
            ),
        ),
        // POST /pg/criteria
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_criterion',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'job_role_id'    => array( 'required' => true, 'type' => 'integer' ),
                'title'          => array( 'required' => true, 'type' => 'string' ),
                'description'    => array( 'type' => 'string' ),
                'criterion_type' => array( 'required' => true, 'type' => 'string' ),
                'target_value'   => array( 'type' => 'integer', 'default' => 1 ),
                'linked_module'  => array( 'type' => 'string' ),
                'sort_order'     => array( 'type' => 'integer', 'default' => 0 ),
                'is_required'    => array( 'type' => 'boolean', 'default' => true ),
            ),
        ),
    ) );

    // Update or delete a specific criterion
    register_rest_route( $namespace, '/pg/criteria/(?P<id>\d+)', array(
        // PUT /pg/criteria/{id}
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_criterion',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id'             => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'title'          => array( 'type' => 'string' ),
                'description'    => array( 'type' => 'string' ),
                'criterion_type' => array( 'type' => 'string' ),
                'target_value'   => array( 'type' => 'integer' ),
                'linked_module'  => array( 'type' => 'string' ),
                'sort_order'     => array( 'type' => 'integer' ),
                'is_required'    => array( 'type' => 'boolean' ),
            ),
        ),
        // DELETE /pg/criteria/{id}
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_criterion',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // --- User Progress Routes ---

    // Get progress for a user
    register_rest_route( $namespace, '/pg/progress/(?P<user_id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_user_progress',
        'permission_callback' => 'mentorship_platform_pg_can_view_progress',
        'args'                => array(
            'user_id'     => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            'job_role_id' => array( 'type' => 'integer' ),
        ),
    ) );

    // Update progress for a criterion
    register_rest_route( $namespace, '/pg/progress', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_update_progress',
        'permission_callback' => 'mentorship_platform_pg_can_approve_progress',
        'args'                => array(
            'user_id'        => array( 'required' => true, 'type' => 'integer' ),
            'criterion_id'   => array( 'required' => true, 'type' => 'integer' ),
            'current_value'  => array( 'type' => 'integer' ),
            'is_completed'   => array( 'type' => 'boolean' ),
            'notes'          => array( 'type' => 'string' ),
            'file_url'       => array( 'type' => 'string' ),
        ),
    ) );

    // --- Criterion Activity Log Routes ---
    
    // BATCH: Get activities for multiple criteria at once (performance optimization)
    register_rest_route( $namespace, '/pg/criterion/activities-batch', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_get_criterion_activities_batch',
        'permission_callback' => 'mentorship_platform_check_access_permission',
        'args'                => array(
            'criterion_ids'     => array( 'required' => true, 'type' => 'array' ),
            'affected_user_id'  => array( 'required' => true, 'type' => 'integer' ),
        ),
    ) );
    
    // Get activities for a criterion
    register_rest_route( $namespace, '/pg/criterion/(?P<criterion_id>\d+)/activities', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_criterion_activities',
        'permission_callback' => 'mentorship_platform_check_access_permission',
        'args'                => array(
            'criterion_id'      => array( 'required' => true, 'type' => 'integer' ),
            'affected_user_id'  => array( 'required' => true, 'type' => 'integer' ),
        ),
    ) );

    // Add activity to a criterion
    register_rest_route( $namespace, '/pg/criterion/activity', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_add_criterion_activity',
        'permission_callback' => 'mentorship_platform_check_access_permission',
        'args'                => array(
            'criterion_id'      => array( 'required' => true, 'type' => 'integer' ),
            'affected_user_id'  => array( 'required' => true, 'type' => 'integer' ),
            'activity_type'     => array( 'required' => true, 'type' => 'string' ),
            'content'           => array( 'type' => 'string' ),
            'old_value'         => array( 'type' => 'string' ),
            'new_value'         => array( 'type' => 'string' ),
        ),
    ) );

    // Update activity (edit note content)
    register_rest_route( $namespace, '/pg/criterion/activity/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_update_criterion_activity',
        'permission_callback' => 'mentorship_platform_check_access_permission',
        'args'                => array(
            'id'      => array( 'required' => true, 'type' => 'integer' ),
            'content' => array( 'required' => true, 'type' => 'string' ),
        ),
    ) );

    // Delete activity
    register_rest_route( $namespace, '/pg/criterion/activity/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'mentorship_platform_pg_delete_criterion_activity',
        'permission_callback' => 'mentorship_platform_check_access_permission',
        'args'                => array(
            'id' => array( 'required' => true, 'type' => 'integer' ),
        ),
    ) );

    // --- In-Service Training Routes ---

    // Get all training logs or create new training
    register_rest_route( $namespace, '/pg/inservice', array(
        // GET /pg/inservice
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_inservice_logs',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'user_id'    => array( 'type' => 'integer' ),
                'start_date' => array( 'type' => 'string' ),
                'end_date'   => array( 'type' => 'string' ),
            ),
        ),
        // POST /pg/inservice
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_inservice',
            'permission_callback' => 'mentorship_platform_pg_can_log_training',
            'args'                => array(
                'training_date'   => array( 'required' => true, 'type' => 'string' ),
                'training_time'   => array( 'type' => 'string' ),
                'location'        => array( 'type' => 'string' ),
                'duration_hours'  => array( 'required' => true, 'type' => 'number' ),
                'topic'           => array( 'required' => true, 'type' => 'string' ),
                'details'         => array( 'type' => 'string' ),
                'leaders'         => array( 'type' => 'array' ),
                'attendees'       => array( 'type' => 'array' ),
                'no_shows'        => array( 'type' => 'array' ),
            ),
        ),
    ) );

    // Update or delete a specific in-service log
    register_rest_route( $namespace, '/pg/inservice/(?P<id>\d+)', array(
        // PUT /pg/inservice/{id}
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_inservice',
            'permission_callback' => 'mentorship_platform_pg_can_edit_inservice',
            'args'                => array(
                'id'              => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'training_date'   => array( 'type' => 'string' ),
                'training_time'   => array( 'type' => 'string' ),
                'location'        => array( 'type' => 'string' ),
                'duration_hours'  => array( 'type' => 'number' ),
                'topic'           => array( 'type' => 'string' ),
                'details'         => array( 'type' => 'string' ),
                'leaders'         => array( 'type' => 'array' ),
                'attendees'       => array( 'type' => 'array' ),
                'no_shows'        => array( 'type' => 'array' ),
            ),
        ),
        // DELETE /pg/inservice/{id}
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_inservice',
            'permission_callback' => 'mentorship_platform_pg_can_edit_inservice',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // Archive an in-service log
    register_rest_route( $namespace, '/pg/inservice/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_archive_inservice',
        'permission_callback' => 'mentorship_platform_pg_can_edit_inservice',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Restore an in-service log
    register_rest_route( $namespace, '/pg/inservice/(?P<id>\d+)/restore', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_restore_inservice',
        'permission_callback' => 'mentorship_platform_pg_can_edit_inservice',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Get user's training summary
    register_rest_route( $namespace, '/pg/inservice/summary/(?P<user_id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_inservice_summary',
        'permission_callback' => 'mentorship_platform_pg_can_view_progress',
        'args'                => array(
            'user_id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            'month'   => array( 'type' => 'string' ), // Format: YYYY-MM
        ),
    ) );

    // Get team training stats
    register_rest_route( $namespace, '/pg/inservice/team-stats', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_inservice_team_stats',
        'permission_callback' => 'mentorship_platform_pg_can_log_training',
        'args'                => array(
            'month' => array( 'required' => true, 'type' => 'string' ), // Format: YYYY-MM
        ),
    ) );

    // Batch endpoint to get summaries for all users at once (performance optimization)
    register_rest_route( $namespace, '/pg/inservice/summary-batch', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'mentorship_platform_pg_get_inservice_summary_batch',
        'permission_callback' => 'mentorship_platform_pg_can_view_progress',
        'args'                => array(
            'months' => array( 
                'required' => true, 
                'type' => 'string',
                'description' => 'Comma-separated list of months in YYYY-MM format'
            ),
        ),
    ) );
    
    // Refresh in-service hours cache for all users (admin only)
    register_rest_route( $namespace, '/pg/inservice/refresh-cache', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_refresh_inservice_cache',
        'permission_callback' => function() {
            return current_user_can( 'manage_options' );
        },
    ) );

    // Bulk archive in-service logs (Tier 3+ only)
    register_rest_route( $namespace, '/pg/inservice-logs/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_archive_inservice',
        'permission_callback' => 'mentorship_platform_pg_user_is_tier_3_plus',
    ) );

    // Bulk restore in-service logs (Tier 3+ only)
    register_rest_route( $namespace, '/pg/inservice-logs/bulk-restore', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_restore_inservice',
        'permission_callback' => 'mentorship_platform_pg_user_is_tier_3_plus',
    ) );

    // --- Scan Audit Routes ---

    // Get all scan audits or create new audit
    register_rest_route( $namespace, '/pg/scan-audits', array(
        // GET /pg/scan-audits
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_scan_audits',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'audited_user_id' => array( 'type' => 'integer' ),
                'start_date'      => array( 'type' => 'string' ),
                'end_date'        => array( 'type' => 'string' ),
            ),
        ),
        // POST /pg/scan-audits
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_scan_audit',
            'permission_callback' => 'mentorship_platform_pg_can_conduct_audit',
            'args'                => array(
                'audited_user_id' => array( 'required' => true, 'type' => 'integer' ),
                'audit_date'      => array( 'required' => true, 'type' => 'string' ),
                'location'        => array( 'type' => 'string' ),
                'result'          => array( 'required' => true, 'type' => 'string' ),
                'notes'           => array( 'type' => 'string' ),
            ),
        ),
    ) );

    // Archive a scan audit
    register_rest_route( $namespace, '/pg/scan-audits/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_archive_scan_audit',
        'permission_callback' => 'mentorship_platform_pg_can_edit_scan_audit',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Restore a scan audit
    register_rest_route( $namespace, '/pg/scan-audits/(?P<id>\d+)/restore', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_restore_scan_audit',
        'permission_callback' => 'mentorship_platform_pg_can_edit_scan_audit',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Update or delete a specific scan audit
    register_rest_route( $namespace, '/pg/scan-audits/(?P<id>\d+)', array(
        // PUT /pg/scan-audits/:id - Update
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_scan_audit',
            'permission_callback' => 'mentorship_platform_pg_can_edit_scan_audit',
            'args'                => array(
                'id'                   => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'audited_user_id'      => array( 'type' => 'integer' ),
                'audit_date'           => array( 'type' => 'string' ),
                'location'             => array( 'type' => 'string' ),
                'result'               => array( 'type' => 'string' ),
                'notes'                => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/scan-audits/:id
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_scan_audit',
            'permission_callback' => 'mentorship_platform_pg_can_edit_scan_audit',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // Bulk archive scan audits (Admin or canModerateAll only)
    register_rest_route( $namespace, '/pg/scan-audits/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_archive_scan_audits',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_scan_audits',
    ) );

    // Bulk restore scan audits (Admin or canModerateAll only)
    register_rest_route( $namespace, '/pg/scan-audits/bulk-restore', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_restore_scan_audits',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_scan_audits',
    ) );

    // --- Cashier Observational Audit Routes ---

    // Get all cashier audits or create new audit
    register_rest_route( $namespace, '/pg/cashier-audits', array(
        // GET /pg/cashier-audits
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_cashier_audits',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'audited_user_id' => array( 'type' => 'integer' ),
                'start_date'      => array( 'type' => 'string' ),
                'end_date'        => array( 'type' => 'string' ),
            ),
        ),
        // POST /pg/cashier-audits
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_cashier_audit',
            'permission_callback' => 'mentorship_platform_pg_can_conduct_cashier_audit',
            'args'                => array(
                'audited_user_id' => array( 'required' => true, 'type' => 'integer' ),
                'audit_date'      => array( 'required' => true, 'type' => 'string' ),
            ),
        ),
    ) );

    // Archive a cashier audit
    register_rest_route( $namespace, '/pg/cashier-audits/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_archive_cashier_audit',
        'permission_callback' => 'mentorship_platform_pg_can_edit_cashier_audit',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Restore a cashier audit
    register_rest_route( $namespace, '/pg/cashier-audits/(?P<id>\d+)/restore', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_restore_cashier_audit',
        'permission_callback' => 'mentorship_platform_pg_can_edit_cashier_audit',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Update or delete a specific cashier audit
    register_rest_route( $namespace, '/pg/cashier-audits/(?P<id>\d+)', array(
        // PUT /pg/cashier-audits/:id - Update
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_cashier_audit',
            'permission_callback' => 'mentorship_platform_pg_can_edit_cashier_audit',
            'args'                => array(
                'id'                   => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'audited_user_id'      => array( 'type' => 'integer' ),
                'audit_date'           => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/cashier-audits/:id
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_cashier_audit',
            'permission_callback' => 'mentorship_platform_pg_can_edit_cashier_audit',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // Bulk archive cashier audits (Admin or canModerateAll only)
    register_rest_route( $namespace, '/pg/cashier-audits/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_archive_cashier_audits',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_cashier_audits',
    ) );

    // Bulk restore cashier audits (Admin or canModerateAll only)
    register_rest_route( $namespace, '/pg/cashier-audits/bulk-restore', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_restore_cashier_audits',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_cashier_audits',
    ) );

    // --- Live Recognition Drill Routes ---

    // Get all drills or create new drill
    register_rest_route( $namespace, '/pg/live-drills', array(
        // GET /pg/live-drills
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_live_drills',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'drilled_user_id' => array( 'type' => 'integer' ),
                'start_date'      => array( 'type' => 'string' ),
                'end_date'        => array( 'type' => 'string' ),
            ),
        ),
        // POST /pg/live-drills
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_live_drill',
            'permission_callback' => 'mentorship_platform_pg_can_conduct_audit',
            'args'                => array(
                'drilled_user_id'    => array( 'required' => true, 'type' => 'integer' ),
                'drill_date'         => array( 'required' => true, 'type' => 'string' ),
                'location'           => array( 'type' => 'string' ),
                'result'             => array( 'required' => true, 'type' => 'string' ),
                'notes'              => array( 'type' => 'string' ),
            ),
        ),
    ) );

    // Archive a live drill
    register_rest_route( $namespace, '/pg/live-drills/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_archive_live_drill',
        'permission_callback' => 'mentorship_platform_pg_can_edit_live_drill',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Restore a live drill
    register_rest_route( $namespace, '/pg/live-drills/(?P<id>\d+)/restore', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_restore_live_drill',
        'permission_callback' => 'mentorship_platform_pg_can_edit_live_drill',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Update or delete a live drill
    register_rest_route( $namespace, '/pg/live-drills/(?P<id>\d+)', array(
        // PUT /pg/live-drills/:id
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_live_drill',
            'permission_callback' => 'mentorship_platform_pg_can_edit_live_drill',
            'args'                => array(
                'id'                 => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'drilled_user_id'    => array( 'type' => 'integer' ),
                'drill_date'         => array( 'type' => 'string' ),
                'location'           => array( 'type' => 'string' ),
                'result'             => array( 'type' => 'string' ),
                'notes'              => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/live-drills/:id
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_live_drill',
            'permission_callback' => 'mentorship_platform_pg_can_edit_live_drill',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // Bulk archive live drills (Tier 3+ only)
    register_rest_route( $namespace, '/pg/live-drills/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_archive_live_drills',
        'permission_callback' => 'mentorship_platform_pg_user_is_tier_3_plus',
    ) );

    // Bulk restore live drills (Tier 3+ only)
    register_rest_route( $namespace, '/pg/live-drills/bulk-restore', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_restore_live_drills',
        'permission_callback' => 'mentorship_platform_pg_user_is_tier_3_plus',
    ) );

    // --- Instructor Evaluation Routes ---

    // Get all instructor evaluations or create new evaluation
    register_rest_route( $namespace, '/pg/instructor-evaluations', array(
        // GET /pg/instructor-evaluations
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_instructor_evaluations',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'evaluated_user_id' => array( 'type' => 'integer' ),
                'start_date'        => array( 'type' => 'string' ),
                'end_date'          => array( 'type' => 'string' ),
                'include_archived'  => array( 'type' => 'boolean' ),
            ),
        ),
        // POST /pg/instructor-evaluations
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_instructor_evaluation',
            'permission_callback' => 'mentorship_platform_pg_can_conduct_instructor_evaluation',
            'args'                => array(
                'evaluated_user_id' => array( 'required' => true, 'type' => 'integer' ),
                'evaluation_date'   => array( 'required' => true, 'type' => 'string' ),
                'comments'          => array( 'required' => true, 'type' => 'string' ),
            ),
        ),
    ) );

    // Archive an instructor evaluation
    register_rest_route( $namespace, '/pg/instructor-evaluations/(?P<id>\d+)/archive', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_archive_instructor_evaluation',
        'permission_callback' => 'mentorship_platform_pg_can_edit_instructor_evaluation',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Restore an instructor evaluation
    register_rest_route( $namespace, '/pg/instructor-evaluations/(?P<id>\d+)/restore', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'mentorship_platform_pg_restore_instructor_evaluation',
        'permission_callback' => 'mentorship_platform_pg_can_edit_instructor_evaluation',
        'args'                => array(
            'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
        ),
    ) );

    // Update or delete an instructor evaluation
    register_rest_route( $namespace, '/pg/instructor-evaluations/(?P<id>\d+)', array(
        // PUT /pg/instructor-evaluations/:id - Update
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_instructor_evaluation',
            'permission_callback' => 'mentorship_platform_pg_can_edit_instructor_evaluation',
            'args'                => array(
                'id'                   => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'evaluated_user_id'    => array( 'type' => 'integer' ),
                'evaluation_date'      => array( 'type' => 'string' ),
                'comments'             => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/instructor-evaluations/:id
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_instructor_evaluation',
            'permission_callback' => 'mentorship_platform_pg_can_edit_instructor_evaluation',
            'args'                => array(
                'id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // Bulk archive instructor evaluations
    register_rest_route( $namespace, '/pg/instructor-evaluations/bulk-archive', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_archive_instructor_evaluations',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_instructor_evaluations',
    ) );

    // Bulk restore instructor evaluations
    register_rest_route( $namespace, '/pg/instructor-evaluations/bulk-restore', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'mentorship_platform_pg_bulk_restore_instructor_evaluations',
        'permission_callback' => 'mentorship_platform_pg_can_moderate_instructor_evaluations',
    ) );

    // --- Team Management Routes ---

    // Get lightweight team members list (names only, no progress - FAST)
    register_rest_route( $namespace, '/pg/team/list', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_team_list',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ),
    ) );

    // Get team members (direct reports) with progress (SLOWER - deprecated, use /team/list + batch progress)
    register_rest_route( $namespace, '/pg/team', array(
        // GET /pg/team
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_team_members',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ),
    ) );
    
    // Get batch progress for multiple users (FAST - single query)
    register_rest_route( $namespace, '/pg/team/batch-progress', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_batch_progress',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ),
    ) );
    
    // Get detailed team member progress across all job roles
    register_rest_route( $namespace, '/pg/team/(?P<user_id>\d+)/detailed-progress', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_team_member_detailed_progress',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'user_id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );
    
    // Get available WordPress roles (slug + name)
    register_rest_route( $namespace, '/pg/wp-roles', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_wp_roles',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ),
    ) );

    // --- User Job Assignment Routes ---

    // Get all user job assignments or assign a user to a job role
    register_rest_route( $namespace, '/pg/user-assignments', array(
        // GET /pg/user-assignments?user_id={id}
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_user_assignments',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'user_id' => array( 'type' => 'integer' ),
            ),
        ),
        // POST /pg/user-assignments
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_assign_user_to_role',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'user_id'       => array( 'required' => true, 'type' => 'integer' ),
                'job_role_id'   => array( 'required' => true, 'type' => 'integer' ),
                'sync_wp_role'  => array( 'type' => 'boolean', 'default' => false ),
                'notes'         => array( 'type' => 'string' ),
            ),
        ),
    ) );

    // Get or update a specific user's job assignment
    register_rest_route( $namespace, '/pg/user-assignments/(?P<user_id>\d+)', array(
        // GET /pg/user-assignments/{user_id}
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_user_assignment',
            'permission_callback' => 'mentorship_platform_check_access_permission',
            'args'                => array(
                'user_id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
        // PUT /pg/user-assignments/{user_id}
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_user_assignment',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'user_id'       => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
                'job_role_id'   => array( 'type' => 'integer' ),
                'sync_wp_role'  => array( 'type' => 'boolean' ),
                'notes'         => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/user-assignments/{user_id} - for backward compatibility, treats as assignment_id
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_user_assignment',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'user_id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );
    
    // Delete specific assignment by assignment ID
    register_rest_route( $namespace, '/pg/assignments/(?P<assignment_id>\d+)', array(
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_assignment_by_id',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'assignment_id' => array( 'validate_callback' => function( $param ) { return is_numeric( $param ); } ),
            ),
        ),
    ) );

    // --- Compliance Report Routes ---
    
    // Scan Audits Compliance Report (Tier 4+ / Management only)
    register_rest_route( $namespace, '/pg/reports/scan-audits', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_scan_audit_report',
            'permission_callback' => 'mentorship_platform_pg_check_reports_permission',
            'args'                => array(
                'start_date'       => array( 'type' => 'string', 'required' => true ),
                'end_date'         => array( 'type' => 'string', 'required' => true ),
                'include_archived' => array( 'type' => 'string', 'default' => '0' ),
            ),
        ),
    ) );

    // Live Drills Compliance Report (Tier 4+ / Management only)
    register_rest_route( $namespace, '/pg/reports/live-drills', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_live_drill_report',
            'permission_callback' => 'mentorship_platform_pg_check_reports_permission',
            'args'                => array(
                'start_date'       => array( 'type' => 'string', 'required' => true ),
                'end_date'         => array( 'type' => 'string', 'required' => true ),
                'include_archived' => array( 'type' => 'string', 'default' => '0' ),
            ),
        ),
    ) );

    // In-Service Training Compliance Report (Tier 4+ / Management only)
    register_rest_route( $namespace, '/pg/reports/inservice', array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_inservice_report',
            'permission_callback' => 'mentorship_platform_pg_check_reports_permission',
            'args'                => array(
                'start_date'       => array( 'type' => 'string', 'required' => true ),
                'end_date'         => array( 'type' => 'string', 'required' => true ),
                'include_archived' => array( 'type' => 'string', 'default' => '0' ),
            ),
        ),
    ) );

    // --- Location Routes ---
    
    // Get all locations or create a new one
    register_rest_route( $namespace, '/pg/locations', array(
        // GET /pg/locations
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_pg_get_locations',
            'permission_callback' => 'mentorship_platform_check_access_permission',
        ),
        // POST /pg/locations
        array(
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'mentorship_platform_pg_create_location',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'name'        => array( 'required' => true, 'type' => 'string' ),
                'description' => array( 'type' => 'string' ),
            ),
        ),
    ) );

    // Get, update, or delete a specific location
    register_rest_route( $namespace, '/pg/locations/(?P<id>\d+)', array(
        // PUT /pg/locations/{id}
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'mentorship_platform_pg_update_location',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id'          => array( 'required' => true, 'type' => 'integer' ),
                'name'        => array( 'required' => true, 'type' => 'string' ),
                'description' => array( 'type' => 'string' ),
            ),
        ),
        // DELETE /pg/locations/{id}
        array(
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'mentorship_platform_pg_delete_location',
            'permission_callback' => 'mentorship_platform_pg_can_manage_roles',
            'args'                => array(
                'id' => array( 'required' => true, 'type' => 'integer' ),
            ),
        ),
    ) );
}
add_action( 'rest_api_init', 'mentorship_platform_register_pg_api_routes' );

/**
 * Automatically invalidate compliance report caches when scan-audit,
 * live-drill, or inservice data is created, updated, or deleted.
 */
add_filter( 'rest_post_dispatch', function( $result, $server, $request ) {
    if ( strpos( $request->get_route(), '/mentorship-platform/v1/pg/' ) === false ) {
        return $result;
    }
    $method = $request->get_method();
    if ( ! in_array( $method, array( 'POST', 'PUT', 'PATCH', 'DELETE' ), true ) ) {
        return $result;
    }
    $route = $request->get_route();
    if ( strpos( $route, '/pg/scan-audits' ) !== false ) {
        mp_invalidate_compliance_report_cache( 'scan_audits' );
    } elseif ( strpos( $route, '/pg/live-drills' ) !== false ) {
        mp_invalidate_compliance_report_cache( 'live_drills' );
    } elseif ( strpos( $route, '/pg/inservice' ) !== false ) {
        mp_invalidate_compliance_report_cache( 'inservice' );
    }
    return $result;
}, 10, 3 );

/**
 * Return list of WordPress roles (slug and human-readable name)
 */
function mentorship_platform_pg_get_wp_roles( $request ) {
    if ( ! function_exists( 'wp_roles' ) ) {
        return rest_ensure_response( array() );
    }

    $wp_roles = wp_roles();
    $roles = array();
    foreach ( $wp_roles->roles as $slug => $data ) {
        $roles[] = array(
            'slug' => $slug,
            'name' => isset( $data['name'] ) ? $data['name'] : $slug,
        );
    }

    return rest_ensure_response( $roles );
}

// --- Permission Callbacks ---

/**
 * Check if user can manage roles and promotion paths
 * Allowed: WordPress administrators OR Tier 5-6 users
 */
function mentorship_platform_pg_can_manage_roles( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }

    // Allow WP administrators
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    // Allow Tier 5-6 users (management level)
    return mentorship_platform_pg_user_is_management();
}

/**
 * Check if user can view progress of another user
 * User can view their own, or someone at least 1 tier below
 */
function mentorship_platform_pg_can_view_progress( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }

    $current_user_id = get_current_user_id();
    $target_user_id = $request->get_param( 'user_id' );
    
    // Admins can view anyone's progress
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }

    // Can always view own progress
    if ( $current_user_id == $target_user_id ) {
        return true;
    }

    // Check tier hierarchy
    return mentorship_platform_pg_is_supervisor_of( $current_user_id, $target_user_id );
}

/**
 * Check if user can approve progress
 * Must be at least 1 tier above the target user
 */
function mentorship_platform_pg_can_approve_progress( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }

    $current_user_id = get_current_user_id();
    $target_user_id = $request->get_param( 'user_id' );

    // Allow self-submission for notes/current_value (not approval)
    if ( $current_user_id == $target_user_id ) {
        return true;
    }

    // Allow supervisors to approve/mark as completed for users in equal or lower tiers
    return mentorship_platform_pg_is_supervisor_of_or_equal( $current_user_id, $target_user_id );
/**
 * Check if user is supervisor of or equal tier to target user
 */
function mentorship_platform_pg_is_supervisor_of_or_equal( $current_user_id, $target_user_id ) {
    $current_tier = mentorship_platform_pg_get_user_tier( $current_user_id );
    $target_tier = mentorship_platform_pg_get_user_tier( $target_user_id );
    // Supervisor: higher tier, or equal tier
    return $current_tier >= $target_tier;
}
}

/**
 * Check if user can log training (CREATE)
 * Uses granular permissions from pg_inservice_permissions table
 */
function mentorship_platform_pg_can_log_training( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins always have access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    global $wpdb;
    $current_user_id = get_current_user_id();
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'pg_inservice_permissions';
    
    // Get user's job role permissions (OR logic - any role with permission grants access)
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM $assignments_table a
         INNER JOIN $permissions_table p ON a.job_role_id = p.job_role_id
         WHERE a.user_id = %d AND p.can_create = 1",
        $current_user_id
    ) );
    
    return $has_permission > 0;
}

/**
 * Check if user can edit/delete in-service training
 * Uses granular permissions from pg_inservice_permissions table
 * Users with can_moderate_all can edit any record
 * Users with can_edit can edit their own records
 */
function mentorship_platform_pg_can_edit_inservice( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // WordPress admins always have access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'pg_inservice_permissions';
    
    // Check if user has can_moderate_all permission (can edit any record)
    $can_moderate_all = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM $assignments_table a
         INNER JOIN $permissions_table p ON a.job_role_id = p.job_role_id
         WHERE a.user_id = %d AND p.can_moderate_all = 1",
        $current_user_id
    ) );
    
    if ( $can_moderate_all > 0 ) {
        return true;
    }
    
    // Check if user has can_edit permission AND is the creator of this record
    $record_id = $request->get_param( 'id' );
    if ( $record_id ) {
        $table_name = $wpdb->prefix . 'pg_inservice_logs';
        $created_by = $wpdb->get_var( $wpdb->prepare(
            "SELECT created_by FROM $table_name WHERE id = %d",
            $record_id
        ) );
        
        if ( $created_by && intval( $created_by ) === $current_user_id ) {
            // User is the creator, check if they have can_edit permission
            $can_edit = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM $assignments_table a
                 INNER JOIN $permissions_table p ON a.job_role_id = p.job_role_id
                 WHERE a.user_id = %d AND p.can_edit = 1",
                $current_user_id
            ) );
            
            return $can_edit > 0;
        }
    }
    
    return false;
}

/**
 * Check if user can conduct audits (CREATE scan audits and live drills)
 * All tiers can create audits
 */
function mentorship_platform_pg_can_conduct_audit( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // Any logged-in user with platform access can create
    return true;
}

/**
 * Check if user can edit/delete scan audits
 * Tier 3+ can edit/delete all records
 * Any user can edit/delete their own records
 */
function mentorship_platform_pg_can_edit_scan_audit( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // Tier 3+ can edit/delete any record
    if ( mentorship_platform_pg_user_is_tier_3_plus() ) {
        return true;
    }
    
    // Check if user is the auditor of this record
    $record_id = $request->get_param( 'id' );
    if ( $record_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
        $auditor_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT auditor_id FROM $table_name WHERE id = %d",
            $record_id
        ) );
        
        if ( $auditor_id && intval( $auditor_id ) === $current_user_id ) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if user can edit/delete live drills
 * Tier 3+ can edit/delete all records
 * Any user can edit/delete their own records
 */
function mentorship_platform_pg_can_edit_live_drill( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // Tier 3+ can edit/delete any record
    if ( mentorship_platform_pg_user_is_tier_3_plus() ) {
        return true;
    }
    
    // Check if user is the drill conductor of this record
    $record_id = $request->get_param( 'id' );
    if ( $record_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
        $conductor_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT drill_conductor_id FROM $table_name WHERE id = %d",
            $record_id
        ) );
        
        if ( $conductor_id && intval( $conductor_id ) === $current_user_id ) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if user can conduct instructor evaluations
 * Permission based on job role permissions (lesson management based)
 */
function mentorship_platform_pg_can_conduct_instructor_evaluation( $request = null ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // Tier 3+ can always conduct evaluations
    if ( mentorship_platform_pg_user_is_tier_3_plus() ) {
        return true;
    }
    
    // Check if user has can_create permission via their job role
    global $wpdb;
    $permissions_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT p.can_create 
         FROM $permissions_table p
         INNER JOIN $assignments_table a ON p.job_role_id = a.job_role_id
         WHERE a.user_id = %d AND p.can_create = 1
         LIMIT 1",
        $current_user_id
    ) );
    
    return (bool) $has_permission;
}

/**
 * Check if user can edit/delete instructor evaluations
 * Tier 3+ can edit/delete all records
 * Users with can_moderate_all can edit/delete any record
 * Any user can edit/delete their own records
 */
function mentorship_platform_pg_can_edit_instructor_evaluation( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // Tier 3+ can edit/delete any record
    if ( mentorship_platform_pg_user_is_tier_3_plus() ) {
        return true;
    }
    
    // Check if user has moderate_all permission
    if ( mentorship_platform_pg_can_moderate_instructor_evaluations() ) {
        return true;
    }
    
    // Check if user is the evaluator of this record
    $record_id = $request->get_param( 'id' );
    if ( $record_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
        $evaluator_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT evaluator_id FROM $table_name WHERE id = %d",
            $record_id
        ) );
        
        if ( $evaluator_id && intval( $evaluator_id ) === $current_user_id ) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if user has moderate_all permission for instructor evaluations
 */
function mentorship_platform_pg_can_moderate_instructor_evaluations() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // Tier 3+ can always moderate
    if ( mentorship_platform_pg_user_is_tier_3_plus() ) {
        return true;
    }
    
    // Check if user has can_moderate_all permission via their job role
    global $wpdb;
    $permissions_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT p.can_moderate_all 
         FROM $permissions_table p
         INNER JOIN $assignments_table a ON p.job_role_id = a.job_role_id
         WHERE a.user_id = %d AND p.can_moderate_all = 1
         LIMIT 1",
        $current_user_id
    ) );
    
    return (bool) $has_permission;
}

// --- Helper Functions ---

/**
 * Get user's tier level from their job assignments (DECOUPLED from WordPress roles)
 * Uses object caching for performance - called frequently on every request
 */
function mentorship_platform_pg_get_user_tier( $user_id ) {
    global $wpdb;
    
    // Check object cache first (persists for the request, or longer with persistent cache)
    $cache_key = 'mp_user_tier_' . $user_id;
    $cached_tier = wp_cache_get( $cache_key, 'mentorship_platform' );
    
    if ( $cached_tier !== false ) {
        return (int) $cached_tier;
    }
    
    // Get highest tier from user's job assignments
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    $tier = $wpdb->get_var( $wpdb->prepare(
        "SELECT r.tier 
         FROM $assignments_table a
         INNER JOIN $roles_table r ON a.job_role_id = r.id
         WHERE a.user_id = %d
         ORDER BY r.tier DESC
         LIMIT 1",
        $user_id
    ) );
    
    $result = $tier ? intval( $tier ) : 0;
    
    // Cache for 5 minutes (tier changes are rare)
    wp_cache_set( $cache_key, $result, 'mentorship_platform', 300 );
    
    return $result;
}

/**
 * Clear user tier cache when their roles change
 */
function mentorship_platform_clear_user_tier_cache( $user_id ) {
    wp_cache_delete( 'mp_user_tier_' . $user_id, 'mentorship_platform' );
}

/**
 * Check if user is Tier 5 or 6 (management level with admin access)
 * WordPress administrators are also considered management level
 */
function mentorship_platform_pg_user_is_management() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins have management access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    $user_tier = mentorship_platform_pg_get_user_tier( get_current_user_id() );
    return $user_tier >= 5;
}

/**
 * Check if user is Tier 3 or higher (Manager level and above)
 * WordPress administrators are also considered Tier 3+
 */
function mentorship_platform_pg_user_is_tier_3_plus() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins have Tier 3+ access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    $user_tier = mentorship_platform_pg_get_user_tier( get_current_user_id() );
    return $user_tier >= 3;
}

/**
 * Check if user can view compliance reports (Tier 4+ / management level)
 * Reports contain aggregate data across all users, so require higher access
 */
function mentorship_platform_pg_check_reports_permission() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins have full access
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    // Tier 4+ (management level) can view reports
    $user_tier = mentorship_platform_pg_get_user_tier( get_current_user_id() );
    if ( $user_tier >= 4 ) {
        // Log report access for audit trail
        if ( function_exists( 'mp_log_security_event' ) ) {
            mp_log_security_event( 'reports_access', [
                'user_tier' => $user_tier,
                'endpoint' => $_SERVER['REQUEST_URI'] ?? 'unknown'
            ]);
        }
        return true;
    }
    
    return false;
}

/**
 * Check if user can moderate scan audits (admin or has canModerateAll permission)
 */
function mentorship_platform_pg_can_moderate_scan_audits() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins can always moderate
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    global $wpdb;
    $user_id = get_current_user_id();
    
    // Get user's job role assignments
    $assignments = $wpdb->get_results( $wpdb->prepare(
        "SELECT job_role_id FROM {$wpdb->prefix}pg_user_job_assignments WHERE user_id = %d",
        $user_id
    ) );
    
    if ( empty( $assignments ) ) {
        return false;
    }
    
    $role_ids = array_map( function( $a ) { return $a->job_role_id; }, $assignments );
    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    
    // Check if any assigned role has canModerateAll permission
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}pg_scan_audit_permissions 
         WHERE job_role_id IN ($placeholders) AND can_moderate_all = 1",
        ...$role_ids
    ) );
    
    return $has_permission > 0;
}

/**
 * Check if user1 is a supervisor of user2 (at least 1 tier higher)
 */
function mentorship_platform_pg_is_supervisor_of( $supervisor_id, $employee_id ) {
    $supervisor_tier = mentorship_platform_pg_get_user_tier( $supervisor_id );
    $employee_tier = mentorship_platform_pg_get_user_tier( $employee_id );
    
    return $supervisor_tier > $employee_tier;
}

// --- API Callback Functions: Job Roles ---

/**
 * Get current user's professional growth permissions
 * Uses transient caching to avoid repeated permission queries
 */
function mentorship_platform_pg_get_my_permissions( $request ) {
    global $wpdb;
    $user_id = get_current_user_id();
    
    // Check cache first
    $cache_key = 'mp_user_perms_' . $user_id;
    $cached_permissions = get_transient( $cache_key );
    
    if ( $cached_permissions !== false ) {
        return rest_ensure_response( $cached_permissions );
    }
    
    // Get user's assigned job roles from the assignments table
    $user_roles_table = $wpdb->prefix . 'pg_user_job_assignments';
    $role_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT job_role_id FROM $user_roles_table WHERE user_id = %d",
        $user_id
    ) );
    
    // Fallback to user meta if no assignments found (backwards compatibility)
    if ( empty( $role_ids ) ) {
        $user_meta_roles = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $user_meta_roles ) && is_array( $user_meta_roles ) ) {
            $role_ids = array_map( 'intval', $user_meta_roles );
        }
    }
    
    error_log( 'PG Permissions: User ' . $user_id . ' has role IDs: ' . print_r( $role_ids, true ) );
    error_log( 'PG Permissions DEBUG: Role IDs as JSON: ' . json_encode( $role_ids ) );
    error_log( 'PG Permissions DEBUG: Role IDs count: ' . count( $role_ids ) );
    
    // Default permissions
    $permissions = array(
        'dailyLogPermissions' => array(
            'canView' => true,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
        ),
        'scanAuditPermissions' => array(
            'canView' => true,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
        ),
        'liveDrillPermissions' => array(
            'canView' => true,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
        ),
        'inservicePermissions' => array(
            'canView' => true,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
        ),
        'taskDeckPermissions' => array(
            'canView' => true,
            'canCreate' => false,
            'canEdit' => false,
            'canDelete' => false,
            'canModerateAll' => false,
            'canManagePrimaryDeck' => false,
            'canCreatePublicDecks' => false,
        ),
        'reportsPermissions' => array(
            'canViewAllRecords' => false,
        ),
        'emailPermissions' => array(
            'canSendEmail' => false,
            'canManageTemplates' => false,
            'canViewHistory' => false,
        ),
        'certificatePermissions' => array(
            'canViewAll' => false,
            'canEditRecords' => false,
            'canManageTypes' => false,
            'canApproveUploads' => false,
            'canBulkEdit' => false,
        ),
        'lmsPermissions' => array(
            'canViewCourses' => true,
            'canViewLessons' => true,
            'canCreateCourses' => false,
            'canEditCourses' => false,
            'canDeleteCourses' => false,
            'canCreateLessons' => false,
            'canEditLessons' => false,
            'canDeleteLessons' => false,
            'canManageExcalidraw' => false,
            'canModerateAll' => false,
        ),
        'srmPermissions' => array(
            'canViewOwnPay' => true,
            'canViewAllPay' => false,
            'canManagePayConfig' => false,
            'canSendInvites' => false,
            'canViewResponses' => false,
            'canManageStatus' => false,
            'canManageTemplates' => false,
            'canViewRetention' => false,
            'canBulkActions' => false,
        ),
    );
    
    if ( empty( $role_ids ) ) {
        // Cache even empty permissions to avoid repeated lookups
        set_transient( $cache_key, $permissions, 5 * MINUTE_IN_SECONDS );
        return rest_ensure_response( $permissions );
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    
    // Get daily log permissions (highest privilege wins)
    $daily_log_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}mp_daily_log_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $daily_log_perms ) {
        $permissions['dailyLogPermissions'] = array(
            'canView' => (bool) $daily_log_perms['can_view'],
            'canCreate' => (bool) $daily_log_perms['can_create'],
            'canEdit' => (bool) $daily_log_perms['can_edit'],
            'canDelete' => (bool) $daily_log_perms['can_delete'],
            'canModerateAll' => (bool) $daily_log_perms['can_moderate_all'],
        );
    }
    
    // Get scan audit permissions
    $scan_audit_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_scan_audit_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $scan_audit_perms ) {
        $permissions['scanAuditPermissions'] = array(
            'canView' => (bool) $scan_audit_perms['can_view'],
            'canCreate' => (bool) $scan_audit_perms['can_create'],
            'canEdit' => (bool) $scan_audit_perms['can_edit'],
            'canDelete' => (bool) $scan_audit_perms['can_delete'],
            'canModerateAll' => (bool) $scan_audit_perms['can_moderate_all'],
        );
    }
    
    // Get live drill permissions
    $live_drill_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_live_drill_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $live_drill_perms ) {
        $permissions['liveDrillPermissions'] = array(
            'canView' => (bool) $live_drill_perms['can_view'],
            'canCreate' => (bool) $live_drill_perms['can_create'],
            'canEdit' => (bool) $live_drill_perms['can_edit'],
            'canDelete' => (bool) $live_drill_perms['can_delete'],
            'canModerateAll' => (bool) $live_drill_perms['can_moderate_all'],
        );
    }
    
    // Get in-service permissions
    $inservice_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_inservice_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $inservice_perms ) {
        $permissions['inservicePermissions'] = array(
            'canView' => (bool) $inservice_perms['can_view'],
            'canCreate' => (bool) $inservice_perms['can_create'],
            'canEdit' => (bool) $inservice_perms['can_edit'],
            'canDelete' => (bool) $inservice_perms['can_delete'],
            'canModerateAll' => (bool) $inservice_perms['can_moderate_all'],
        );
        error_log( 'PG Permissions: Inservice permissions for user ' . $user_id . ': ' . print_r( $permissions['inservicePermissions'], true ) );
    } else {
        error_log( 'PG Permissions: No inservice permissions found for user ' . $user_id . ' with roles: ' . implode(',', $role_ids) );
    }
    
    // Get TaskDeck permissions
    $taskdeck_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all,
            MAX(can_manage_primary_deck) as can_manage_primary_deck,
            MAX(can_create_public_decks) as can_create_public_decks
         FROM {$wpdb->prefix}pg_taskdeck_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $taskdeck_perms ) {
        $permissions['taskDeckPermissions'] = array(
            'canView' => (bool) $taskdeck_perms['can_view'],
            'canCreate' => (bool) $taskdeck_perms['can_create'],
            'canEdit' => (bool) $taskdeck_perms['can_edit'],
            'canDelete' => (bool) $taskdeck_perms['can_delete'],
            'canModerateAll' => (bool) $taskdeck_perms['can_moderate_all'],
            'canManagePrimaryDeck' => (bool) $taskdeck_perms['can_manage_primary_deck'],
            'canCreatePublicDecks' => (bool) $taskdeck_perms['can_create_public_decks'],
        );
    }
    
    // Get Reports permissions
    $reports_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view_all_records) as can_view_all_records
         FROM {$wpdb->prefix}pg_reports_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $reports_perms ) {
        $permissions['reportsPermissions'] = array(
            'canViewAllRecords' => (bool) $reports_perms['can_view_all_records'],
        );
    }
    
    // Get Lesson Management permissions
    $lesson_mgmt_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_lesson_management_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    error_log( 'PG Permissions DEBUG: Lesson Management Query: ' . $wpdb->last_query );
    error_log( 'PG Permissions DEBUG: Lesson Management Raw Result: ' . json_encode( $lesson_mgmt_perms ) );
    
    if ( $lesson_mgmt_perms ) {
        $permissions['lessonManagementPermissions'] = array(
            'canView' => (bool) $lesson_mgmt_perms['can_view'],
            'canCreate' => (bool) $lesson_mgmt_perms['can_create'],
            'canEdit' => (bool) $lesson_mgmt_perms['can_edit'],
            'canDelete' => (bool) $lesson_mgmt_perms['can_delete'],
            'canModerateAll' => (bool) $lesson_mgmt_perms['can_moderate_all'],
        );
        error_log( 'PG Permissions DEBUG: Lesson Management Permissions (after bool cast): ' . json_encode( $permissions['lessonManagementPermissions'] ) );
    } else {
        error_log( 'PG Permissions DEBUG: No Lesson Management permissions found for user ' . $user_id );
    }
    
    // Get Instructor Evaluation permissions
    $instructor_eval_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_create) as can_create,
            MAX(can_edit) as can_edit,
            MAX(can_delete) as can_delete,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_instructor_evaluation_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $instructor_eval_perms ) {
        $permissions['instructorEvaluationPermissions'] = array(
            'canView' => (bool) $instructor_eval_perms['can_view'],
            'canCreate' => (bool) $instructor_eval_perms['can_create'],
            'canEdit' => (bool) $instructor_eval_perms['can_edit'],
            'canDelete' => (bool) $instructor_eval_perms['can_delete'],
            'canModerateAll' => (bool) $instructor_eval_perms['can_moderate_all'],
        );
    }
    
    // Get Email Composer permissions
    $email_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_send_email) as can_send_email,
            MAX(can_manage_templates) as can_manage_templates,
            MAX(can_view_history) as can_view_history
         FROM {$wpdb->prefix}pg_email_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $email_perms ) {
        $permissions['emailPermissions'] = array(
            'canSendEmail' => (bool) $email_perms['can_send_email'],
            'canManageTemplates' => (bool) $email_perms['can_manage_templates'],
            'canViewHistory' => (bool) $email_perms['can_view_history'],
        );
    }
    
    // Get Certificate Tracking permissions
    $cert_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view_all) as can_view_all,
            MAX(can_edit_records) as can_edit_records,
            MAX(can_manage_types) as can_manage_types,
            MAX(can_approve_uploads) as can_approve_uploads,
            MAX(can_bulk_edit) as can_bulk_edit
         FROM {$wpdb->prefix}aquaticpro_cert_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $cert_perms ) {
        $permissions['certificatePermissions'] = array(
            'canViewAll' => (bool) $cert_perms['can_view_all'],
            'canEditRecords' => (bool) $cert_perms['can_edit_records'],
            'canManageTypes' => (bool) $cert_perms['can_manage_types'],
            'canApproveUploads' => (bool) $cert_perms['can_approve_uploads'],
            'canBulkEdit' => (bool) $cert_perms['can_bulk_edit'],
        );
    }
    
    // Get LMS permissions
    $lms_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(can_view_courses) as can_view_courses,
            MAX(can_view_lessons) as can_view_lessons,
            MAX(can_create_courses) as can_create_courses,
            MAX(can_edit_courses) as can_edit_courses,
            MAX(can_delete_courses) as can_delete_courses,
            MAX(can_create_lessons) as can_create_lessons,
            MAX(can_edit_lessons) as can_edit_lessons,
            MAX(can_delete_lessons) as can_delete_lessons,
            MAX(can_manage_excalidraw) as can_manage_excalidraw,
            MAX(can_moderate_all) as can_moderate_all
         FROM {$wpdb->prefix}pg_lms_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $lms_perms ) {
        $permissions['lmsPermissions'] = array(
            'canViewCourses' => (bool) $lms_perms['can_view_courses'],
            'canViewLessons' => (bool) $lms_perms['can_view_lessons'],
            'canCreateCourses' => (bool) $lms_perms['can_create_courses'],
            'canEditCourses' => (bool) $lms_perms['can_edit_courses'],
            'canDeleteCourses' => (bool) $lms_perms['can_delete_courses'],
            'canCreateLessons' => (bool) $lms_perms['can_create_lessons'],
            'canEditLessons' => (bool) $lms_perms['can_edit_lessons'],
            'canDeleteLessons' => (bool) $lms_perms['can_delete_lessons'],
            'canManageExcalidraw' => (bool) $lms_perms['can_manage_excalidraw'],
            'canModerateAll' => (bool) $lms_perms['can_moderate_all'],
        );
    }
    
    // Get SRM (Seasonal Returns) permissions
    $srm_perms = $wpdb->get_row( $wpdb->prepare(
        "SELECT 
            MAX(srm_view_own_pay) as srm_view_own_pay,
            MAX(srm_view_all_pay) as srm_view_all_pay,
            MAX(srm_manage_pay_config) as srm_manage_pay_config,
            MAX(srm_send_invites) as srm_send_invites,
            MAX(srm_view_responses) as srm_view_responses,
            MAX(srm_manage_status) as srm_manage_status,
            MAX(srm_manage_templates) as srm_manage_templates,
            MAX(srm_view_retention) as srm_view_retention,
            MAX(srm_bulk_actions) as srm_bulk_actions
         FROM {$wpdb->prefix}srm_permissions 
         WHERE job_role_id IN ($placeholders)",
        ...$role_ids
    ), ARRAY_A );
    
    if ( $srm_perms ) {
        $permissions['srmPermissions'] = array(
            'canViewOwnPay' => (bool) $srm_perms['srm_view_own_pay'],
            'canViewAllPay' => (bool) $srm_perms['srm_view_all_pay'],
            'canManagePayConfig' => (bool) $srm_perms['srm_manage_pay_config'],
            'canSendInvites' => (bool) $srm_perms['srm_send_invites'],
            'canViewResponses' => (bool) $srm_perms['srm_view_responses'],
            'canManageStatus' => (bool) $srm_perms['srm_manage_status'],
            'canManageTemplates' => (bool) $srm_perms['srm_manage_templates'],
            'canViewRetention' => (bool) $srm_perms['srm_view_retention'],
            'canBulkActions' => (bool) $srm_perms['srm_bulk_actions'],
        );
    }
    
    // Cache permissions for 5 minutes
    set_transient( $cache_key, $permissions, 5 * MINUTE_IN_SECONDS );
    
    return rest_ensure_response( $permissions );
}

/**
 * Clear user permissions cache when their roles change
 */
function mentorship_platform_clear_user_permissions_cache( $user_id ) {
    delete_transient( 'mp_user_perms_' . $user_id );
    mentorship_platform_clear_user_tier_cache( $user_id );
}

/**
 * Sync all permission tables for job roles that are missing permission entries.
 * This runs automatically when the get_job_roles endpoint detects missing permissions.
 *
 * @param bool $force_update When true, also UPDATE existing rows to match tier defaults.
 *                           Use for one-time migration/repair of stale permission rows.
 */
function mentorship_platform_sync_all_permissions( $force_update = false ) {
    global $wpdb;
    
    $job_roles_table = $wpdb->prefix . 'pg_job_roles';
    $job_roles = $wpdb->get_results("SELECT id, tier FROM $job_roles_table");
    
    if (empty($job_roles)) {
        return;
    }
    
    // Permission tables with their default values based on tier
    $permission_tables = [
        'mp_daily_log_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_scan_audit_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_live_drill_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_inservice_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_cashier_audit_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_taskdeck_permissions' => [
            'columns' => ['can_view', 'can_view_only_assigned', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all', 'can_manage_primary_deck', 'can_manage_all_primary_cards', 'can_create_public_decks'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 0, 1, 1, 1, 1, 1, 1, 1];
                if ($tier >= 4) return [1, 0, 1, 1, 1, 0, 0, 1, 1];
                if ($tier >= 3) return [1, 0, 1, 1, 1, 0, 0, 0, 0];
                return [1, 0, 0, 0, 0, 0, 0, 0, 0];
            }
        ],
        'pg_reports_permissions' => [
            'columns' => ['can_view_all_records'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1];
                return [0];
            }
        ],
        'pg_lesson_management_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'pg_instructor_evaluation_permissions' => [
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0];
            }
        ],
        'awesome_awards_permissions' => [
            'columns' => ['can_nominate', 'can_vote', 'can_approve', 'can_direct_assign', 'can_manage_periods', 'can_view_nominations', 'can_view_winners', 'can_view_archives', 'can_archive'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 0, 0, 0, 1, 1, 1, 0];
                return [1, 0, 0, 0, 0, 1, 1, 1, 0];
            }
        ],
        'pg_email_permissions' => [
            'columns' => ['can_send_email', 'can_manage_templates', 'can_view_history'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1];
                return [0, 0, 0];
            }
        ],
        'aquaticpro_cert_permissions' => [
            'columns' => ['can_view_all', 'can_edit_records', 'can_manage_types', 'can_approve_uploads', 'can_bulk_edit'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 0, 1, 0];
                return [0, 0, 0, 0, 0];
            }
        ],
        'pg_lms_permissions' => [
            'columns' => ['can_view_courses', 'can_view_lessons', 'can_create_courses', 'can_edit_courses', 'can_delete_courses', 'can_create_lessons', 'can_edit_lessons', 'can_delete_lessons', 'can_manage_excalidraw', 'can_moderate_all'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
                if ($tier >= 4) return [1, 1, 1, 1, 0, 1, 1, 0, 1, 0];
                return [1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
            }
        ],
        'srm_permissions' => [
            'columns' => ['srm_view_own_pay', 'srm_view_all_pay', 'srm_manage_pay_config', 'srm_send_invites', 'srm_view_responses', 'srm_manage_status', 'srm_manage_templates', 'srm_view_retention', 'srm_bulk_actions'],
            'defaults' => function($tier) {
                if ($tier >= 5) return [1, 1, 1, 1, 1, 1, 1, 1, 1];
                if ($tier >= 3) return [1, 1, 0, 1, 1, 0, 0, 1, 0];
                return [1, 0, 0, 0, 0, 0, 0, 0, 0];
            }
        ],
    ];
    
    $synced_count = 0;
    
    foreach ($job_roles as $role) {
        $tier = (int) $role->tier;
        $role_id = (int) $role->id;
        
        foreach ($permission_tables as $table_suffix => $config) {
            $table_name = $wpdb->prefix . $table_suffix;
            
            // Check if table exists
            $table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name));
            if (!$table_exists) {
                continue;
            }
            
            // Check if permission already exists for this role
            $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $table_name WHERE job_role_id = %d",
                $role_id
            ));
            
            if ($exists > 0) {
                if (!$force_update) {
                    continue;
                }
                
                // Smart repair: only overwrite rows that still have the broken
                // "minimum defaults" pattern (first column=1, rest=0) which was
                // caused by the original bug.  If a user has customised the
                // permissions via the Edit Role form, leave the row untouched.
                $row = $wpdb->get_row($wpdb->prepare(
                    "SELECT * FROM $table_name WHERE job_role_id = %d",
                    $role_id
                ), ARRAY_A);
                
                if ($row) {
                    $defaults = $config['defaults']($tier);
                    
                    // Detect the broken pattern: first permission column = 1,
                    // every other permission column = 0.
                    $is_broken_minimum = true;
                    foreach ($config['columns'] as $i => $column) {
                        $current_val = (int) ($row[$column] ?? 0);
                        if ($i === 0) {
                            // First column was typically set to 1 (canView)
                            // — skip checking it since it's 1 in both broken
                            // and correct states.
                            continue;
                        }
                        if ($current_val !== 0) {
                            $is_broken_minimum = false;
                            break;
                        }
                    }
                    
                    // Also check: if the current values already match the
                    // tier defaults, nothing to do.
                    $already_correct = true;
                    foreach ($config['columns'] as $i => $column) {
                        if ((int) ($row[$column] ?? 0) !== $defaults[$i]) {
                            $already_correct = false;
                            break;
                        }
                    }
                    
                    if ($already_correct) {
                        // Row already has the right values — skip silently
                        continue;
                    }
                    
                    if (!$is_broken_minimum) {
                        // Row has been customised by the admin — leave it alone
                        continue;
                    }
                    
                    // Row has broken minimum defaults — apply tier defaults
                    $update_data = [];
                    $update_format = [];
                    foreach ($config['columns'] as $i => $column) {
                        $update_data[$column] = $defaults[$i];
                        $update_format[] = '%d';
                    }
                    $wpdb->update(
                        $table_name,
                        $update_data,
                        ['job_role_id' => $role_id],
                        $update_format,
                        ['%d']
                    );
                    $synced_count++;
                }
                continue;
            }
            
            // Insert default permissions
            $defaults = $config['defaults']($tier);
            $data = ['job_role_id' => $role_id];
            $format = ['%d'];
            
            foreach ($config['columns'] as $i => $column) {
                $data[$column] = $defaults[$i];
                $format[] = '%d';
            }
            
            $wpdb->insert($table_name, $data, $format);
            $synced_count++;
        }
    }
    
    if ($synced_count > 0) {
        $mode = $force_update ? 'force-updated' : 'inserted';
        error_log("[sync_all_permissions] {$mode} $synced_count permission entries across all tables.");
    }
    
    return $synced_count;
}

/**
 * Get all job roles with permissions (OPTIMIZED)
 * Uses single JOIN query + caching to avoid N+1 queries
 * 
 * FIXED: Added fallback for when permission tables don't exist
 *        and cache validation to prevent stale empty results
 * FIXED: Added inservice_hours to response (was missing, causing stale values)
 * FIXED: Dynamically check which permission tables exist before building JOIN query
 */
function mentorship_platform_pg_get_job_roles( $request ) {
    global $wpdb;
    
    // Include plugin version in cache key to invalidate on updates
    $plugin_data = get_file_data( WP_PLUGIN_DIR . '/aquaticpro/mentorship-platform.php', array( 'Version' => 'Version' ) );
    $version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    $cache_key = 'mp_job_roles_with_permissions_v' . str_replace('.', '_', $version);
    
    // Try to get from cache first
    $cached = get_transient($cache_key);
    
    // One-time migration: repair permission rows that were created with minimum defaults.
    // v6: re-runs the smart repair after the SHOW TABLES bug fix — the broken query
    //     prevented the GET endpoint from reading real DB values, so any Saves from
    //     the admin UI may have overwritten correct values with the displayed defaults.
    // Only repairs rows that match the broken pattern (first col=1, rest=0) — leaves
    // any admin-customised permissions untouched.
    $repair_key = 'mp_permissions_repaired_v6';
    if ( ! get_option( $repair_key ) ) {
        $repaired = mentorship_platform_sync_all_permissions( true );
        update_option( $repair_key, time() );
        // Bust the cache so we re-query with correct data
        delete_transient( $cache_key );
        $cached = false;
        if ( $repaired > 0 ) {
            error_log( "[get_job_roles] One-time permission repair completed. Updated $repaired entries." );
            // Also clear per-user permission caches so they pick up the new values
            $wpdb->query( "DELETE FROM $wpdb->options WHERE option_name LIKE '_transient_mp_user_perms_%' OR option_name LIKE '_transient_timeout_mp_user_perms_%'" );
        }
    }
    
    if ($cached !== false && !empty($cached)) {
        $response = rest_ensure_response($cached);
        // No browser cache — admin config data must always be fresh
        $response->header('Cache-Control', 'no-store');
        return $response;
    }
    
    $table_name = $wpdb->prefix . 'pg_job_roles';
    
    // Define all permission tables with their columns and aliases
    $permission_tables = [
        'daily_log' => [
            'table' => $wpdb->prefix . 'mp_daily_log_permissions',
            'alias' => 'dlp',
            'prefix' => 'dl',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'scan_audit' => [
            'table' => $wpdb->prefix . 'pg_scan_audit_permissions',
            'alias' => 'sap',
            'prefix' => 'sa',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'live_drill' => [
            'table' => $wpdb->prefix . 'pg_live_drill_permissions',
            'alias' => 'ldp',
            'prefix' => 'ld',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'inservice' => [
            'table' => $wpdb->prefix . 'pg_inservice_permissions',
            'alias' => 'isp',
            'prefix' => 'is',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'cashier_audit' => [
            'table' => $wpdb->prefix . 'pg_cashier_audit_permissions',
            'alias' => 'cap',
            'prefix' => 'ca',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'taskdeck' => [
            'table' => $wpdb->prefix . 'pg_taskdeck_permissions',
            'alias' => 'tdp',
            'prefix' => 'td',
            'columns' => ['can_view', 'can_view_only_assigned', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all', 'can_manage_primary_deck', 'can_manage_all_primary_cards', 'can_create_public_decks']
        ],
        'reports' => [
            'table' => $wpdb->prefix . 'pg_reports_permissions',
            'alias' => 'rp',
            'prefix' => 'rp',
            'columns' => ['can_view_all_records']
        ],
        'lesson_mgmt' => [
            'table' => $wpdb->prefix . 'pg_lesson_management_permissions',
            'alias' => 'lmp',
            'prefix' => 'lm',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'instructor_eval' => [
            'table' => $wpdb->prefix . 'pg_instructor_evaluation_permissions',
            'alias' => 'iep',
            'prefix' => 'ie',
            'columns' => ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_moderate_all']
        ],
        'awesome_awards' => [
            'table' => $wpdb->prefix . 'awesome_awards_permissions',
            'alias' => 'aap',
            'prefix' => 'aa',
            'columns' => ['can_nominate', 'can_vote', 'can_approve', 'can_direct_assign', 'can_manage_periods', 'can_view_nominations', 'can_view_winners', 'can_view_archives', 'can_archive']
        ],
        'srm' => [
            'table' => $wpdb->prefix . 'srm_permissions',
            'alias' => 'srmp',
            'prefix' => 'srm',
            'columns' => ['srm_view_own_pay', 'srm_view_all_pay', 'srm_manage_pay_config', 'srm_send_invites', 'srm_view_responses', 'srm_manage_status', 'srm_manage_templates', 'srm_view_retention', 'srm_bulk_actions']
        ],
        'lms' => [
            'table' => $wpdb->prefix . 'pg_lms_permissions',
            'alias' => 'lmsp',
            'prefix' => 'lms',
            'columns' => ['can_view_courses', 'can_view_lessons', 'can_create_courses', 'can_edit_courses', 'can_delete_courses', 'can_create_lessons', 'can_edit_lessons', 'can_delete_lessons', 'can_manage_hotspots', 'can_manage_excalidraw', 'can_moderate_all']
        ],
        'email' => [
            'table' => $wpdb->prefix . 'pg_email_permissions',
            'alias' => 'emp',
            'prefix' => 'em',
            'columns' => ['can_send_email', 'can_manage_templates', 'can_view_history']
        ],
        'certificates' => [
            'table' => $wpdb->prefix . 'aquaticpro_cert_permissions',
            'alias' => 'certp',
            'prefix' => 'cert',
            'columns' => ['can_view_all', 'can_edit_records', 'can_manage_types', 'can_approve_uploads', 'can_bulk_edit']
        ],
    ];
    
    // Check which tables exist using a SINGLE information_schema query
    // NOTE: SHOW TABLES WHERE `Name` LIKE … does NOT work — the column is
    //       actually named `Tables_in_{db}`, not `Name`.  Using information_schema
    //       is portable and correct across MySQL / MariaDB versions.
    $existing_tables = [];
    $all_table_names = array_column($permission_tables, 'table');
    $in_clause = implode(', ', array_map(function($t) use ($wpdb) {
        return $wpdb->prepare('%s', $t);
    }, $all_table_names));
    $found_tables = $wpdb->get_col(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ($in_clause)"
    );
    $found_tables_set = array_flip($found_tables);
    
    foreach ($permission_tables as $key => $config) {
        if (isset($found_tables_set[$config['table']])) {
            $existing_tables[$key] = $config;
        }
    }
    
    // Build dynamic SELECT columns
    $select_columns = ['jr.*'];
    foreach ($existing_tables as $key => $config) {
        foreach ($config['columns'] as $col) {
            $select_columns[] = "{$config['alias']}.{$col} as {$config['prefix']}_{$col}";
        }
    }
    
    // Build dynamic JOINs
    $joins = [];
    foreach ($existing_tables as $key => $config) {
        $joins[] = "LEFT JOIN {$config['table']} {$config['alias']} ON jr.id = {$config['alias']}.job_role_id";
    }
    
    // Build the query
    $query = "SELECT " . implode(', ', $select_columns) . "
        FROM $table_name jr
        " . implode("\n        ", $joins) . "
        ORDER BY jr.tier ASC, jr.title ASC";
    
    $results = $wpdb->get_results($query, ARRAY_A);
    
    // Log errors only
    if ($wpdb->last_error) {
        error_log('[get_job_roles] Database error: ' . $wpdb->last_error);
    }
    
    // Check if permissions are missing (all null) - this can happen on sites where
    // permission tables exist but weren't populated for existing job roles
    if (!empty($results) && !empty($existing_tables)) {
        $first_row = $results[0];
        $has_any_permissions = false;
        
        // Check if any permission column has a non-null value
        foreach ($existing_tables as $config) {
            $check_col = $config['prefix'] . '_' . $config['columns'][0]; // Check first column of each table
            if (isset($first_row[$check_col]) && $first_row[$check_col] !== null) {
                $has_any_permissions = true;
                break;
            }
        }
        
        if (!$has_any_permissions) {
            error_log('[get_job_roles] Permission tables exist but have no data. Auto-syncing permissions...');
            $sync_count = mentorship_platform_sync_all_permissions();
            error_log('[get_job_roles] Sync complete. Created ' . $sync_count . ' permission entries. Re-querying...');
            // Clear cache and re-run query
            delete_transient($cache_key);
            $results = $wpdb->get_results($query, ARRAY_A);
        }
    }
    
    // FALLBACK: If query returns empty, try simple query for job roles only
    if (empty($results)) {
        error_log('[get_job_roles] Main query returned empty. Attempting fallback query.');
        
        $fallback_query = "SELECT * FROM $table_name ORDER BY tier ASC, title ASC";
        $fallback_results = $wpdb->get_results($fallback_query, ARRAY_A);
        
        if (!empty($fallback_results)) {
            error_log('[get_job_roles] Fallback query successful. Found ' . count($fallback_results) . ' job roles.');
            
            // Return job roles with default permissions
            $formatted = array_map(function($row) {
                return [
                    'id' => (int) $row['id'],
                    'title' => $row['title'],
                    'description' => $row['description'],
                    'tier' => (int) $row['tier'],
                    'inservice_hours' => isset($row['inservice_hours']) ? floatval($row['inservice_hours']) : 4.0,
                    'created_at' => $row['created_at'],
                    'updated_at' => $row['updated_at'],
                    'dailyLogPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'scanAuditPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'liveDrillPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'inservicePermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'cashierAuditPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'taskDeckPermissions' => [
                        'canView' => true, 'canViewOnlyAssigned' => false, 'canCreate' => false,
                        'canEdit' => false, 'canDelete' => false, 'canModerateAll' => false,
                        'canManagePrimaryDeck' => false, 'canManageAllPrimaryCards' => false, 'canCreatePublicDecks' => false,
                    ],
                    'reportsPermissions' => [
                        'canViewAllRecords' => false,
                    ],
                    'lessonManagementPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'instructorEvaluationPermissions' => [
                        'canView' => true, 'canCreate' => false, 'canEdit' => false,
                        'canDelete' => false, 'canModerateAll' => false,
                    ],
                    'awesomeAwardsPermissions' => [
                        'canNominate' => true, 'canVote' => false, 'canApprove' => false,
                        'canDirectAssign' => false, 'canManagePeriods' => false,
                        'canViewNominations' => true, 'canViewWinners' => true, 
                        'canViewArchives' => true, 'canArchive' => false,
                    ],
                    'srmPermissions' => [
                        'canViewOwnPay' => false, 'canViewAllPay' => false,
                        'canManagePayConfig' => false, 'canSendInvites' => false,
                        'canViewResponses' => false, 'canManageStatus' => false,
                        'canManageTemplates' => false, 'canViewRetention' => false,
                        'canBulkActions' => false,
                    ],
                    'lmsPermissions' => [
                        'canViewCourses' => true, 'canViewLessons' => true,
                        'canCreateCourses' => false, 'canEditCourses' => false, 'canDeleteCourses' => false,
                        'canCreateLessons' => false, 'canEditLessons' => false, 'canDeleteLessons' => false,
                        'canManageExcalidraw' => false, 'canModerateAll' => false,
                    ],
                    'emailPermissions' => [
                        'canSendEmail' => false, 'canManageTemplates' => false, 'canViewHistory' => false,
                    ],
                    'certificatePermissions' => [
                        'canViewAll' => false, 'canEditRecords' => false, 'canManageTypes' => false,
                        'canApproveUploads' => false, 'canBulkEdit' => false,
                    ],
                ];
            }, $fallback_results);
            
            // Cache with shorter duration since this is fallback data
            set_transient($cache_key, $formatted, 5 * MINUTE_IN_SECONDS);
            
            return rest_ensure_response($formatted);
        } else {
            error_log('[get_job_roles] Both queries failed. Main table might not exist.');
        }
    }
    
    // Format results with permissions objects (using isset for missing table columns)
    $formatted = array_map(function($row) {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'tier' => (int) $row['tier'],
            'inservice_hours' => isset($row['inservice_hours']) ? floatval($row['inservice_hours']) : 4.0,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'dailyLogPermissions' => [
                'canView' => isset($row['dl_can_view']) && $row['dl_can_view'] !== null ? (bool) $row['dl_can_view'] : true,
                'canCreate' => isset($row['dl_can_create']) && $row['dl_can_create'] !== null ? (bool) $row['dl_can_create'] : false,
                'canEdit' => isset($row['dl_can_edit']) && $row['dl_can_edit'] !== null ? (bool) $row['dl_can_edit'] : false,
                'canDelete' => isset($row['dl_can_delete']) && $row['dl_can_delete'] !== null ? (bool) $row['dl_can_delete'] : false,
                'canModerateAll' => isset($row['dl_can_moderate_all']) && $row['dl_can_moderate_all'] !== null ? (bool) $row['dl_can_moderate_all'] : false,
            ],
            'scanAuditPermissions' => [
                'canView' => isset($row['sa_can_view']) && $row['sa_can_view'] !== null ? (bool) $row['sa_can_view'] : true,
                'canCreate' => isset($row['sa_can_create']) && $row['sa_can_create'] !== null ? (bool) $row['sa_can_create'] : false,
                'canEdit' => isset($row['sa_can_edit']) && $row['sa_can_edit'] !== null ? (bool) $row['sa_can_edit'] : false,
                'canDelete' => isset($row['sa_can_delete']) && $row['sa_can_delete'] !== null ? (bool) $row['sa_can_delete'] : false,
                'canModerateAll' => isset($row['sa_can_moderate_all']) && $row['sa_can_moderate_all'] !== null ? (bool) $row['sa_can_moderate_all'] : false,
            ],
            'liveDrillPermissions' => [
                'canView' => isset($row['ld_can_view']) && $row['ld_can_view'] !== null ? (bool) $row['ld_can_view'] : true,
                'canCreate' => isset($row['ld_can_create']) && $row['ld_can_create'] !== null ? (bool) $row['ld_can_create'] : false,
                'canEdit' => isset($row['ld_can_edit']) && $row['ld_can_edit'] !== null ? (bool) $row['ld_can_edit'] : false,
                'canDelete' => isset($row['ld_can_delete']) && $row['ld_can_delete'] !== null ? (bool) $row['ld_can_delete'] : false,
                'canModerateAll' => isset($row['ld_can_moderate_all']) && $row['ld_can_moderate_all'] !== null ? (bool) $row['ld_can_moderate_all'] : false,
            ],
            'inservicePermissions' => [
                'canView' => isset($row['is_can_view']) && $row['is_can_view'] !== null ? (bool) $row['is_can_view'] : true,
                'canCreate' => isset($row['is_can_create']) && $row['is_can_create'] !== null ? (bool) $row['is_can_create'] : false,
                'canEdit' => isset($row['is_can_edit']) && $row['is_can_edit'] !== null ? (bool) $row['is_can_edit'] : false,
                'canDelete' => isset($row['is_can_delete']) && $row['is_can_delete'] !== null ? (bool) $row['is_can_delete'] : false,
                'canModerateAll' => isset($row['is_can_moderate_all']) && $row['is_can_moderate_all'] !== null ? (bool) $row['is_can_moderate_all'] : false,
            ],
            'cashierAuditPermissions' => [
                'canView' => isset($row['ca_can_view']) && $row['ca_can_view'] !== null ? (bool) $row['ca_can_view'] : true,
                'canCreate' => isset($row['ca_can_create']) && $row['ca_can_create'] !== null ? (bool) $row['ca_can_create'] : false,
                'canEdit' => isset($row['ca_can_edit']) && $row['ca_can_edit'] !== null ? (bool) $row['ca_can_edit'] : false,
                'canDelete' => isset($row['ca_can_delete']) && $row['ca_can_delete'] !== null ? (bool) $row['ca_can_delete'] : false,
                'canModerateAll' => isset($row['ca_can_moderate_all']) && $row['ca_can_moderate_all'] !== null ? (bool) $row['ca_can_moderate_all'] : false,
            ],
            'taskDeckPermissions' => [
                'canView' => isset($row['td_can_view']) && $row['td_can_view'] !== null ? (bool) $row['td_can_view'] : true,
                'canViewOnlyAssigned' => isset($row['td_can_view_only_assigned']) ? (bool) $row['td_can_view_only_assigned'] : false,
                'canCreate' => isset($row['td_can_create']) && $row['td_can_create'] !== null ? (bool) $row['td_can_create'] : false,
                'canEdit' => isset($row['td_can_edit']) && $row['td_can_edit'] !== null ? (bool) $row['td_can_edit'] : false,
                'canDelete' => isset($row['td_can_delete']) && $row['td_can_delete'] !== null ? (bool) $row['td_can_delete'] : false,
                'canModerateAll' => isset($row['td_can_moderate_all']) && $row['td_can_moderate_all'] !== null ? (bool) $row['td_can_moderate_all'] : false,
                'canManagePrimaryDeck' => isset($row['td_can_manage_primary_deck']) ? (bool) $row['td_can_manage_primary_deck'] : false,
                'canManageAllPrimaryCards' => isset($row['td_can_manage_all_primary_cards']) ? (bool) $row['td_can_manage_all_primary_cards'] : false,
                'canCreatePublicDecks' => isset($row['td_can_create_public_decks']) ? (bool) $row['td_can_create_public_decks'] : false,
            ],
            'reportsPermissions' => [
                'canViewAllRecords' => isset($row['rp_can_view_all_records']) ? (bool) $row['rp_can_view_all_records'] : false,
            ],
            'lessonManagementPermissions' => [
                'canView' => isset($row['lm_can_view']) && $row['lm_can_view'] !== null ? (bool) $row['lm_can_view'] : true,
                'canCreate' => isset($row['lm_can_create']) && $row['lm_can_create'] !== null ? (bool) $row['lm_can_create'] : false,
                'canEdit' => isset($row['lm_can_edit']) && $row['lm_can_edit'] !== null ? (bool) $row['lm_can_edit'] : false,
                'canDelete' => isset($row['lm_can_delete']) && $row['lm_can_delete'] !== null ? (bool) $row['lm_can_delete'] : false,
                'canModerateAll' => isset($row['lm_can_moderate_all']) && $row['lm_can_moderate_all'] !== null ? (bool) $row['lm_can_moderate_all'] : false,
            ],
            'instructorEvaluationPermissions' => [
                'canView' => isset($row['ie_can_view']) && $row['ie_can_view'] !== null ? (bool) $row['ie_can_view'] : true,
                'canCreate' => isset($row['ie_can_create']) && $row['ie_can_create'] !== null ? (bool) $row['ie_can_create'] : false,
                'canEdit' => isset($row['ie_can_edit']) && $row['ie_can_edit'] !== null ? (bool) $row['ie_can_edit'] : false,
                'canDelete' => isset($row['ie_can_delete']) && $row['ie_can_delete'] !== null ? (bool) $row['ie_can_delete'] : false,
                'canModerateAll' => isset($row['ie_can_moderate_all']) && $row['ie_can_moderate_all'] !== null ? (bool) $row['ie_can_moderate_all'] : false,
            ],
            'awesomeAwardsPermissions' => [
                'canNominate' => isset($row['aa_can_nominate']) && $row['aa_can_nominate'] !== null ? (bool) $row['aa_can_nominate'] : true,
                'canVote' => isset($row['aa_can_vote']) && $row['aa_can_vote'] !== null ? (bool) $row['aa_can_vote'] : false,
                'canApprove' => isset($row['aa_can_approve']) && $row['aa_can_approve'] !== null ? (bool) $row['aa_can_approve'] : false,
                'canDirectAssign' => isset($row['aa_can_direct_assign']) && $row['aa_can_direct_assign'] !== null ? (bool) $row['aa_can_direct_assign'] : false,
                'canManagePeriods' => isset($row['aa_can_manage_periods']) && $row['aa_can_manage_periods'] !== null ? (bool) $row['aa_can_manage_periods'] : false,
                'canViewNominations' => isset($row['aa_can_view_nominations']) && $row['aa_can_view_nominations'] !== null ? (bool) $row['aa_can_view_nominations'] : true,
                'canViewWinners' => isset($row['aa_can_view_winners']) && $row['aa_can_view_winners'] !== null ? (bool) $row['aa_can_view_winners'] : true,
                'canViewArchives' => isset($row['aa_can_view_archives']) && $row['aa_can_view_archives'] !== null ? (bool) $row['aa_can_view_archives'] : true,
                'canArchive' => isset($row['aa_can_archive']) && $row['aa_can_archive'] !== null ? (bool) $row['aa_can_archive'] : false,
            ],
            'srmPermissions' => [
                'canViewOwnPay' => isset($row['srm_srm_view_own_pay']) && $row['srm_srm_view_own_pay'] !== null ? (bool) $row['srm_srm_view_own_pay'] : true,
                'canViewAllPay' => isset($row['srm_srm_view_all_pay']) && $row['srm_srm_view_all_pay'] !== null ? (bool) $row['srm_srm_view_all_pay'] : false,
                'canManagePayConfig' => isset($row['srm_srm_manage_pay_config']) && $row['srm_srm_manage_pay_config'] !== null ? (bool) $row['srm_srm_manage_pay_config'] : false,
                'canSendInvites' => isset($row['srm_srm_send_invites']) && $row['srm_srm_send_invites'] !== null ? (bool) $row['srm_srm_send_invites'] : false,
                'canViewResponses' => isset($row['srm_srm_view_responses']) && $row['srm_srm_view_responses'] !== null ? (bool) $row['srm_srm_view_responses'] : false,
                'canManageStatus' => isset($row['srm_srm_manage_status']) && $row['srm_srm_manage_status'] !== null ? (bool) $row['srm_srm_manage_status'] : false,
                'canManageTemplates' => isset($row['srm_srm_manage_templates']) && $row['srm_srm_manage_templates'] !== null ? (bool) $row['srm_srm_manage_templates'] : false,
                'canViewRetention' => isset($row['srm_srm_view_retention']) && $row['srm_srm_view_retention'] !== null ? (bool) $row['srm_srm_view_retention'] : false,
                'canBulkActions' => isset($row['srm_srm_bulk_actions']) && $row['srm_srm_bulk_actions'] !== null ? (bool) $row['srm_srm_bulk_actions'] : false,
            ],
            'lmsPermissions' => [
                'canViewCourses' => isset($row['lms_can_view_courses']) && $row['lms_can_view_courses'] !== null ? (bool) $row['lms_can_view_courses'] : true,
                'canViewLessons' => isset($row['lms_can_view_lessons']) && $row['lms_can_view_lessons'] !== null ? (bool) $row['lms_can_view_lessons'] : true,
                'canCreateCourses' => isset($row['lms_can_create_courses']) && $row['lms_can_create_courses'] !== null ? (bool) $row['lms_can_create_courses'] : false,
                'canEditCourses' => isset($row['lms_can_edit_courses']) && $row['lms_can_edit_courses'] !== null ? (bool) $row['lms_can_edit_courses'] : false,
                'canDeleteCourses' => isset($row['lms_can_delete_courses']) && $row['lms_can_delete_courses'] !== null ? (bool) $row['lms_can_delete_courses'] : false,
                'canCreateLessons' => isset($row['lms_can_create_lessons']) && $row['lms_can_create_lessons'] !== null ? (bool) $row['lms_can_create_lessons'] : false,
                'canEditLessons' => isset($row['lms_can_edit_lessons']) && $row['lms_can_edit_lessons'] !== null ? (bool) $row['lms_can_edit_lessons'] : false,
                'canDeleteLessons' => isset($row['lms_can_delete_lessons']) && $row['lms_can_delete_lessons'] !== null ? (bool) $row['lms_can_delete_lessons'] : false,
                'canManageExcalidraw' => isset($row['lms_can_manage_excalidraw']) && $row['lms_can_manage_excalidraw'] !== null ? (bool) $row['lms_can_manage_excalidraw'] : false,
                'canModerateAll' => isset($row['lms_can_moderate_all']) && $row['lms_can_moderate_all'] !== null ? (bool) $row['lms_can_moderate_all'] : false,
            ],
            'emailPermissions' => [
                'canSendEmail' => isset($row['em_can_send_email']) && $row['em_can_send_email'] !== null ? (bool) $row['em_can_send_email'] : false,
                'canManageTemplates' => isset($row['em_can_manage_templates']) && $row['em_can_manage_templates'] !== null ? (bool) $row['em_can_manage_templates'] : false,
                'canViewHistory' => isset($row['em_can_view_history']) && $row['em_can_view_history'] !== null ? (bool) $row['em_can_view_history'] : false,
            ],
            'certificatePermissions' => [
                'canViewAll' => isset($row['cert_can_view_all']) && $row['cert_can_view_all'] !== null ? (bool) $row['cert_can_view_all'] : false,
                'canEditRecords' => isset($row['cert_can_edit_records']) && $row['cert_can_edit_records'] !== null ? (bool) $row['cert_can_edit_records'] : false,
                'canManageTypes' => isset($row['cert_can_manage_types']) && $row['cert_can_manage_types'] !== null ? (bool) $row['cert_can_manage_types'] : false,
                'canApproveUploads' => isset($row['cert_can_approve_uploads']) && $row['cert_can_approve_uploads'] !== null ? (bool) $row['cert_can_approve_uploads'] : false,
                'canBulkEdit' => isset($row['cert_can_bulk_edit']) && $row['cert_can_bulk_edit'] !== null ? (bool) $row['cert_can_bulk_edit'] : false,
            ],
        ];
    }, $results);
    
    // Cache for 15 minutes
    set_transient($cache_key, $formatted, 15 * MINUTE_IN_SECONDS);
    
    $response = rest_ensure_response($formatted);
    // No browser cache — admin config data must always be fresh
    $response->header('Cache-Control', 'no-store');
    return $response;
}

/**
 * Get a specific job role
 */
function mentorship_platform_pg_get_job_role( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_job_roles';
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $id = $request->get_param( 'id' );
    
    $query = $wpdb->prepare( "
        SELECT 
            jr.*,
            p.can_view,
            p.can_create,
            p.can_edit,
            p.can_delete,
            p.can_moderate_all
        FROM $table_name jr
        LEFT JOIN $permissions_table p ON jr.id = p.job_role_id
        WHERE jr.id = %d
    ", $id );
    
    $result = $wpdb->get_row( $query, ARRAY_A );
    
    if ( ! $result ) {
        return new WP_Error( 'not_found', 'Job role not found', array( 'status' => 404 ) );
    }
    
    // Cast numeric fields to proper types
    $result['id'] = (int) $result['id'];
    $result['tier'] = (int) $result['tier'];
    $result['inservice_hours'] = (float) $result['inservice_hours'];
    
    // Format permissions into nested object
    $result['dailyLogPermissions'] = array(
        'canView' => ( $result['can_view'] !== null ) ? (bool) $result['can_view'] : true,
        'canCreate' => ( $result['can_create'] !== null ) ? (bool) $result['can_create'] : false,
        'canEdit' => ( $result['can_edit'] !== null ) ? (bool) $result['can_edit'] : false,
        'canDelete' => ( $result['can_delete'] !== null ) ? (bool) $result['can_delete'] : false,
        'canModerateAll' => ( $result['can_moderate_all'] !== null ) ? (bool) $result['can_moderate_all'] : false,
    );
    
    // Remove flat permission fields from response
    unset( $result['can_view'], $result['can_create'], $result['can_edit'], $result['can_delete'], $result['can_moderate_all'] );
    
    return rest_ensure_response( $result );
}

/**
 * Create a new job role (DECOUPLED from WordPress roles - purely for career tracking)
 */
function mentorship_platform_pg_create_job_role( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_job_roles';
    
    $data = array(
        'title'           => sanitize_text_field( $request->get_param( 'title' ) ),
        'tier'            => intval( $request->get_param( 'tier' ) ),
        'description'     => wp_kses_post( $request->get_param( 'description' ) ),
        'inservice_hours' => floatval( $request->get_param( 'inservice_hours' ) ?? 4.0 ),
    );
    
    $format = array( '%s', '%d', '%s', '%f' );

    $inserted = $wpdb->insert( $table_name, $data, $format );
    
    if ( $inserted === false ) {
        // Get the last error for debugging
        $error_message = $wpdb->last_error ? $wpdb->last_error : 'Unknown database error';
        return new WP_Error( 'insert_failed', 'Failed to create job role: ' . $error_message, array( 'status' => 500 ) );
    }
    
    $role_id = $wpdb->insert_id;
    $data['id'] = $role_id;
    
    // Handle daily log permissions if provided
    if ( $request->has_param( 'dailyLogPermissions' ) ) {
        $permissions = $request->get_param( 'dailyLogPermissions' );
        $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save daily log permissions for role ' . $role_id );
        }
    }
    
    // Handle scan audit permissions if provided
    if ( $request->has_param( 'scanAuditPermissions' ) ) {
        $permissions = $request->get_param( 'scanAuditPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_scan_audit_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save scan audit permissions for role ' . $role_id );
        }
    }
    
    // Handle live drill permissions if provided
    if ( $request->has_param( 'liveDrillPermissions' ) ) {
        $permissions = $request->get_param( 'liveDrillPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_live_drill_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save live drill permissions for role ' . $role_id );
        }
    }
    
    // Handle cashier audit permissions if provided
    if ( $request->has_param( 'cashierAuditPermissions' ) ) {
        $permissions = $request->get_param( 'cashierAuditPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_cashier_audit_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save cashier audit permissions for role ' . $role_id );
        }
    }
    
    // Handle lesson management permissions if provided
    if ( $request->has_param( 'lessonManagementPermissions' ) ) {
        $permissions = $request->get_param( 'lessonManagementPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_lesson_management_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save lesson management permissions for role ' . $role_id );
        }
    }
    
    // Handle instructor evaluation permissions if provided
    if ( $request->has_param( 'instructorEvaluationPermissions' ) ) {
        $permissions = $request->get_param( 'instructorEvaluationPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save instructor evaluation permissions for role ' . $role_id );
        }
    }

    // Handle in-service permissions if provided
    if ( $request->has_param( 'inservicePermissions' ) ) {
        $permissions = $request->get_param( 'inservicePermissions' );
        $permissions_table = $wpdb->prefix . 'pg_inservice_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save in-service permissions for role ' . $role_id );
        }
    }
    
    // Handle TaskDeck permissions if provided
    if ( $request->has_param( 'taskDeckPermissions' ) ) {
        $permissions = $request->get_param( 'taskDeckPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_taskdeck_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_view_only_assigned' => isset( $permissions['canViewOnlyAssigned'] ) ? ( $permissions['canViewOnlyAssigned'] ? 1 : 0 ) : 0,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
            'can_manage_primary_deck' => isset( $permissions['canManagePrimaryDeck'] ) ? ( $permissions['canManagePrimaryDeck'] ? 1 : 0 ) : 0,
            'can_manage_all_primary_cards' => isset( $permissions['canManageAllPrimaryCards'] ) ? ( $permissions['canManageAllPrimaryCards'] ? 1 : 0 ) : 0,
            'can_create_public_decks' => isset( $permissions['canCreatePublicDecks'] ) ? ( $permissions['canCreatePublicDecks'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save TaskDeck permissions for role ' . $role_id );
        }
    }
    
    // Handle Reports permissions if provided
    if ( $request->has_param( 'reportsPermissions' ) ) {
        $permissions = $request->get_param( 'reportsPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_reports_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view_all_records' => isset( $permissions['canViewAllRecords'] ) ? ( $permissions['canViewAllRecords'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save Reports permissions for role ' . $role_id );
        }
    }
    
    // Handle LMS permissions if provided
    if ( $request->has_param( 'lmsPermissions' ) ) {
        $permissions = $request->get_param( 'lmsPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_lms_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view_courses' => isset( $permissions['canViewCourses'] ) ? ( $permissions['canViewCourses'] ? 1 : 0 ) : 1,
            'can_view_lessons' => isset( $permissions['canViewLessons'] ) ? ( $permissions['canViewLessons'] ? 1 : 0 ) : 1,
            'can_create_courses' => isset( $permissions['canCreateCourses'] ) ? ( $permissions['canCreateCourses'] ? 1 : 0 ) : 0,
            'can_edit_courses' => isset( $permissions['canEditCourses'] ) ? ( $permissions['canEditCourses'] ? 1 : 0 ) : 0,
            'can_delete_courses' => isset( $permissions['canDeleteCourses'] ) ? ( $permissions['canDeleteCourses'] ? 1 : 0 ) : 0,
            'can_create_lessons' => isset( $permissions['canCreateLessons'] ) ? ( $permissions['canCreateLessons'] ? 1 : 0 ) : 0,
            'can_edit_lessons' => isset( $permissions['canEditLessons'] ) ? ( $permissions['canEditLessons'] ? 1 : 0 ) : 0,
            'can_delete_lessons' => isset( $permissions['canDeleteLessons'] ) ? ( $permissions['canDeleteLessons'] ? 1 : 0 ) : 0,
            'can_manage_excalidraw' => isset( $permissions['canManageExcalidraw'] ) ? ( $permissions['canManageExcalidraw'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save LMS permissions for role ' . $role_id );
        }
    }
    
    // Handle Awesome Awards permissions if provided
    if ( $request->has_param( 'awesomeAwardsPermissions' ) && class_exists( 'Awesome_Awards' ) ) {
        $permissions = $request->get_param( 'awesomeAwardsPermissions' );
        $permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_nominate' => isset( $permissions['canNominate'] ) ? ( $permissions['canNominate'] ? 1 : 0 ) : 1,
            'can_vote' => isset( $permissions['canVote'] ) ? ( $permissions['canVote'] ? 1 : 0 ) : 0,
            'can_approve' => isset( $permissions['canApprove'] ) ? ( $permissions['canApprove'] ? 1 : 0 ) : 0,
            'can_direct_assign' => isset( $permissions['canDirectAssign'] ) ? ( $permissions['canDirectAssign'] ? 1 : 0 ) : 0,
            'can_manage_periods' => isset( $permissions['canManagePeriods'] ) ? ( $permissions['canManagePeriods'] ? 1 : 0 ) : 0,
            'can_view_nominations' => isset( $permissions['canViewNominations'] ) ? ( $permissions['canViewNominations'] ? 1 : 0 ) : 1,
            'can_view_winners' => isset( $permissions['canViewWinners'] ) ? ( $permissions['canViewWinners'] ? 1 : 0 ) : 1,
            'can_view_archives' => isset( $permissions['canViewArchives'] ) ? ( $permissions['canViewArchives'] ? 1 : 0 ) : 1,
            'can_archive' => isset( $permissions['canArchive'] ) ? ( $permissions['canArchive'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save Awesome Awards permissions for role ' . $role_id );
        }
    }
    
    // Handle SRM (Seasonal Returns) permissions if provided
    if ( $request->has_param( 'srmPermissions' ) && class_exists( 'Seasonal_Returns' ) ) {
        $permissions = $request->get_param( 'srmPermissions' );
        $permissions_table = $wpdb->prefix . 'srm_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'srm_view_own_pay' => isset( $permissions['canViewOwnPay'] ) ? ( $permissions['canViewOwnPay'] ? 1 : 0 ) : 1,
            'srm_view_all_pay' => isset( $permissions['canViewAllPay'] ) ? ( $permissions['canViewAllPay'] ? 1 : 0 ) : 0,
            'srm_manage_pay_config' => isset( $permissions['canManagePayConfig'] ) ? ( $permissions['canManagePayConfig'] ? 1 : 0 ) : 0,
            'srm_send_invites' => isset( $permissions['canSendInvites'] ) ? ( $permissions['canSendInvites'] ? 1 : 0 ) : 0,
            'srm_view_responses' => isset( $permissions['canViewResponses'] ) ? ( $permissions['canViewResponses'] ? 1 : 0 ) : 0,
            'srm_manage_status' => isset( $permissions['canManageStatus'] ) ? ( $permissions['canManageStatus'] ? 1 : 0 ) : 0,
            'srm_manage_templates' => isset( $permissions['canManageTemplates'] ) ? ( $permissions['canManageTemplates'] ? 1 : 0 ) : 0,
            'srm_view_retention' => isset( $permissions['canViewRetention'] ) ? ( $permissions['canViewRetention'] ? 1 : 0 ) : 0,
            'srm_bulk_actions' => isset( $permissions['canBulkActions'] ) ? ( $permissions['canBulkActions'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save SRM permissions for role ' . $role_id );
        }
    }
    
    // Handle Email Composer permissions if provided
    if ( $request->has_param( 'emailPermissions' ) ) {
        $permissions = $request->get_param( 'emailPermissions' );
        $permissions_table = $wpdb->prefix . 'pg_email_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_send_email' => isset( $permissions['canSendEmail'] ) ? ( $permissions['canSendEmail'] ? 1 : 0 ) : 0,
            'can_manage_templates' => isset( $permissions['canManageTemplates'] ) ? ( $permissions['canManageTemplates'] ? 1 : 0 ) : 0,
            'can_view_history' => isset( $permissions['canViewHistory'] ) ? ( $permissions['canViewHistory'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save Email permissions for role ' . $role_id );
        }
    }
    
    // Handle Certificate Tracking permissions if provided
    if ( $request->has_param( 'certificatePermissions' ) ) {
        $permissions = $request->get_param( 'certificatePermissions' );
        $permissions_table = $wpdb->prefix . 'aquaticpro_cert_permissions';
        
        $perm_data = array(
            'job_role_id' => $role_id,
            'can_view_all' => isset( $permissions['canViewAll'] ) ? ( $permissions['canViewAll'] ? 1 : 0 ) : 0,
            'can_edit_records' => isset( $permissions['canEditRecords'] ) ? ( $permissions['canEditRecords'] ? 1 : 0 ) : 0,
            'can_manage_types' => isset( $permissions['canManageTypes'] ) ? ( $permissions['canManageTypes'] ? 1 : 0 ) : 0,
            'can_approve_uploads' => isset( $permissions['canApproveUploads'] ) ? ( $permissions['canApproveUploads'] ? 1 : 0 ) : 0,
            'can_bulk_edit' => isset( $permissions['canBulkEdit'] ) ? ( $permissions['canBulkEdit'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save Certificate permissions for role ' . $role_id );
        }
    }
    
    // Invalidate job roles cache since a new role was created
    delete_transient('mp_job_roles_with_permissions');
    // Also clear versioned cache key
    $plugin_data = get_file_data( WP_PLUGIN_DIR . '/aquaticpro/mentorship-platform.php', array( 'Version' => 'Version' ) );
    $version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    delete_transient('mp_job_roles_with_permissions_v' . str_replace('.', '_', $version));
    
    return rest_ensure_response( $data );
}

/**
 * Update a job role
 */
function mentorship_platform_pg_update_job_role( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_job_roles';
    $id = $request->get_param( 'id' );
    
    $json_params = $request->get_json_params();
    
    $data = array();
    $format = array();
    
    if ( $request->has_param( 'title' ) ) {
        $data['title'] = sanitize_text_field( $request->get_param( 'title' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'tier' ) ) {
        $data['tier'] = intval( $request->get_param( 'tier' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'description' ) ) {
        $data['description'] = wp_kses_post( $request->get_param( 'description' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'inservice_hours' ) ) {
        $data['inservice_hours'] = floatval( $request->get_param( 'inservice_hours' ) );
        $format[] = '%f';
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update( 
        $table_name, 
        $data, 
        array( 'id' => $id ),
        $format,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        // Get the last error for debugging
        $error_message = $wpdb->last_error ? $wpdb->last_error : 'Unknown database error';
        return new WP_Error( 'update_failed', 'Failed to update job role: ' . $error_message, array( 'status' => 500 ) );
    }
    
    // Handle daily log permissions if provided
    if ( isset($json_params['dailyLogPermissions']) ) {
        $permissions = $json_params['dailyLogPermissions'];
        $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save daily log permissions for role ' . $id );
        }
    }
    
    // Handle scan audit permissions if provided
    if ( isset($json_params['scanAuditPermissions']) ) {
        $permissions = $json_params['scanAuditPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_scan_audit_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save scan audit permissions for role ' . $id );
        }
    }
    
    // Handle live drill permissions if provided
    if ( isset($json_params['liveDrillPermissions']) ) {
        $permissions = $json_params['liveDrillPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_live_drill_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save live drill permissions for role ' . $id );
        }
    }
    
    // Handle in-service permissions if provided
    if ( isset($json_params['inservicePermissions']) ) {
        $permissions = $json_params['inservicePermissions'];
        $permissions_table = $wpdb->prefix . 'pg_inservice_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save in-service permissions for role ' . $id );
        }
    }
    
    // Handle cashier audit permissions if provided
    if ( isset($json_params['cashierAuditPermissions']) ) {
        $permissions = $json_params['cashierAuditPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_cashier_audit_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save cashier audit permissions for role ' . $id );
        }
    }
    
    // Handle TaskDeck permissions if provided
    if ( isset($json_params['taskDeckPermissions']) ) {
        $permissions = $json_params['taskDeckPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_taskdeck_permissions';
        
        error_log('[update_job_role] taskDeckPermissions received: ' . print_r($permissions, true));
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_view_only_assigned' => isset( $permissions['canViewOnlyAssigned'] ) ? ( $permissions['canViewOnlyAssigned'] ? 1 : 0 ) : 0,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
            'can_manage_primary_deck' => isset( $permissions['canManagePrimaryDeck'] ) ? ( $permissions['canManagePrimaryDeck'] ? 1 : 0 ) : 0,
            'can_manage_all_primary_cards' => isset( $permissions['canManageAllPrimaryCards'] ) ? ( $permissions['canManageAllPrimaryCards'] ? 1 : 0 ) : 0,
            'can_create_public_decks' => isset( $permissions['canCreatePublicDecks'] ) ? ( $permissions['canCreatePublicDecks'] ? 1 : 0 ) : 0,
        );
        
        error_log('[update_job_role] perm_data to save: ' . print_r($perm_data, true));
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        error_log('[update_job_role] TaskDeck upsert result: ' . ($result ? 'SUCCESS' : 'FAILED'));
        
        if ( !$result ) {
            error_log( 'Failed to save TaskDeck permissions for role ' . $id );
        }
    } else {
        error_log('[update_job_role] No taskDeckPermissions in request');
    }
    
    // Handle Reports permissions if provided
    if ( isset($json_params['reportsPermissions']) ) {
        $permissions = $json_params['reportsPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_reports_permissions';
        
        error_log('[update_job_role] reportsPermissions received: ' . print_r($permissions, true));
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view_all_records' => isset( $permissions['canViewAllRecords'] ) ? ( $permissions['canViewAllRecords'] ? 1 : 0 ) : 0,
        );
        
        error_log('[update_job_role] reports perm_data to save: ' . print_r($perm_data, true));
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        error_log('[update_job_role] Reports upsert result: ' . ($result ? 'SUCCESS' : 'FAILED'));
        
        if ( !$result ) {
            error_log( 'Failed to save Reports permissions for role ' . $id );
        }
    } else {
        error_log('[update_job_role] No reportsPermissions in request');
    }
    
    // Handle Lesson Management permissions if provided
    if ( isset($json_params['lessonManagementPermissions']) ) {
        $permissions = $json_params['lessonManagementPermissions'];
        $permissions_table = $wpdb->prefix . 'pg_lesson_management_permissions';
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        
        if ( !$result ) {
            error_log( 'Failed to save Lesson Management permissions for role ' . $id );
        }
    }
    
    // Handle Instructor Evaluation permissions if provided
    if ( isset($json_params['instructorEvaluationPermissions']) ) {
        $permissions = $json_params['instructorEvaluationPermissions'];
        error_log('[update_job_role] instructorEvaluationPermissions received: ' . print_r($permissions, true));
        $permissions_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
        
        // Double check table existence before upsert to be safe
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$permissions_table}'");
        if (!$table_exists) {
            error_log('[update_job_role] CRITICAL: instructor evaluation permissions table missing! Attempting to create...');
            $sql = "CREATE TABLE $permissions_table (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                job_role_id BIGINT UNSIGNED NOT NULL,
                can_view TINYINT(1) NOT NULL DEFAULT 1,
                can_create TINYINT(1) NOT NULL DEFAULT 0,
                can_edit TINYINT(1) NOT NULL DEFAULT 0,
                can_delete TINYINT(1) NOT NULL DEFAULT 0,
                can_moderate_all TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_role (job_role_id)
            ) " . $wpdb->get_charset_collate();
            require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
            dbDelta($sql);
        }
        
        $perm_data = array(
            'job_role_id' => $id,
            'can_view' => isset( $permissions['canView'] ) ? ( $permissions['canView'] ? 1 : 0 ) : 1,
            'can_create' => isset( $permissions['canCreate'] ) ? ( $permissions['canCreate'] ? 1 : 0 ) : 0,
            'can_edit' => isset( $permissions['canEdit'] ) ? ( $permissions['canEdit'] ? 1 : 0 ) : 0,
            'can_delete' => isset( $permissions['canDelete'] ) ? ( $permissions['canDelete'] ? 1 : 0 ) : 0,
            'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
        );
        
        error_log('[update_job_role] Saving instructorEvaluation perm_data: ' . print_r($perm_data, true));
        $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
        error_log('[update_job_role] Instructor Evaluation permissions save result: ' . ($result ? 'SUCCESS' : 'FAILED'));
        
        if ( !$result ) {
            error_log( 'Failed to save Instructor Evaluation permissions for role ' . $id );
        }
    }
    
    // Handle Awesome Awards permissions if provided
    // Always save permissions (even if AA module not enabled yet) so they're ready when enabled
    error_log('[update_job_role] Checking for AA permissions - JSON params keys: ' . implode(', ', array_keys($json_params ?? [])));
    
    if ( isset($json_params['awesomeAwardsPermissions']) ) {
        $permissions = $json_params['awesomeAwardsPermissions'];
        error_log('[update_job_role] AA permissions received: ' . print_r($permissions, true));
        $permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        
        if ( $table_exists ) {
            $perm_data = array(
                'job_role_id' => $id,
                'can_nominate' => isset( $permissions['canNominate'] ) ? ( $permissions['canNominate'] ? 1 : 0 ) : 1,
                'can_vote' => isset( $permissions['canVote'] ) ? ( $permissions['canVote'] ? 1 : 0 ) : 0,
                'can_approve' => isset( $permissions['canApprove'] ) ? ( $permissions['canApprove'] ? 1 : 0 ) : 0,
                'can_direct_assign' => isset( $permissions['canDirectAssign'] ) ? ( $permissions['canDirectAssign'] ? 1 : 0 ) : 0,
                'can_manage_periods' => isset( $permissions['canManagePeriods'] ) ? ( $permissions['canManagePeriods'] ? 1 : 0 ) : 0,
                'can_view_nominations' => isset( $permissions['canViewNominations'] ) ? ( $permissions['canViewNominations'] ? 1 : 0 ) : 1,
                'can_view_winners' => isset( $permissions['canViewWinners'] ) ? ( $permissions['canViewWinners'] ? 1 : 0 ) : 1,
                'can_view_archives' => isset( $permissions['canViewArchives'] ) ? ( $permissions['canViewArchives'] ? 1 : 0 ) : 1,
                'can_archive' => isset( $permissions['canArchive'] ) ? ( $permissions['canArchive'] ? 1 : 0 ) : 0,
            );
            
            error_log('[update_job_role] Saving AA perm_data: ' . print_r($perm_data, true));
            $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
            error_log('[update_job_role] AA permissions save result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            
            if ( !$result ) {
                error_log( 'Failed to save Awesome Awards permissions for role ' . $id );
            }
        } else {
            error_log('[update_job_role] AA permissions table does not exist');
        }
    }
    
    // Handle SRM (Seasonal Returns) permissions if provided
    if ( isset($json_params['srmPermissions']) ) {
        $permissions = $json_params['srmPermissions'];
        error_log('[update_job_role] SRM permissions received: ' . print_r($permissions, true));
        $permissions_table = $wpdb->prefix . 'srm_permissions';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        
        if ( $table_exists ) {
            $perm_data = array(
                'job_role_id' => $id,
                'srm_view_own_pay' => isset( $permissions['canViewOwnPay'] ) ? ( $permissions['canViewOwnPay'] ? 1 : 0 ) : 1,
                'srm_view_all_pay' => isset( $permissions['canViewAllPay'] ) ? ( $permissions['canViewAllPay'] ? 1 : 0 ) : 0,
                'srm_manage_pay_config' => isset( $permissions['canManagePayConfig'] ) ? ( $permissions['canManagePayConfig'] ? 1 : 0 ) : 0,
                'srm_send_invites' => isset( $permissions['canSendInvites'] ) ? ( $permissions['canSendInvites'] ? 1 : 0 ) : 0,
                'srm_view_responses' => isset( $permissions['canViewResponses'] ) ? ( $permissions['canViewResponses'] ? 1 : 0 ) : 0,
                'srm_manage_status' => isset( $permissions['canManageStatus'] ) ? ( $permissions['canManageStatus'] ? 1 : 0 ) : 0,
                'srm_manage_templates' => isset( $permissions['canManageTemplates'] ) ? ( $permissions['canManageTemplates'] ? 1 : 0 ) : 0,
                'srm_view_retention' => isset( $permissions['canViewRetention'] ) ? ( $permissions['canViewRetention'] ? 1 : 0 ) : 0,
                'srm_bulk_actions' => isset( $permissions['canBulkActions'] ) ? ( $permissions['canBulkActions'] ? 1 : 0 ) : 0,
            );
            
            error_log('[update_job_role] Saving SRM perm_data: ' . print_r($perm_data, true));
            $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
            error_log('[update_job_role] SRM permissions save result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            
            if ( !$result ) {
                error_log( 'Failed to save SRM permissions for role ' . $id );
            }
        } else {
            error_log('[update_job_role] SRM permissions table does not exist');
        }
    }
    
    // Handle LMS permissions if provided
    if ( isset($json_params['lmsPermissions']) ) {
        $permissions = $json_params['lmsPermissions'];
        error_log('[update_job_role] LMS permissions received: ' . print_r($permissions, true));
        $permissions_table = $wpdb->prefix . 'pg_lms_permissions';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        
        if ( $table_exists ) {
            $perm_data = array(
                'job_role_id' => $id,
                'can_view_courses' => isset( $permissions['canViewCourses'] ) ? ( $permissions['canViewCourses'] ? 1 : 0 ) : 1,
                'can_view_lessons' => isset( $permissions['canViewLessons'] ) ? ( $permissions['canViewLessons'] ? 1 : 0 ) : 1,
                'can_create_courses' => isset( $permissions['canCreateCourses'] ) ? ( $permissions['canCreateCourses'] ? 1 : 0 ) : 0,
                'can_edit_courses' => isset( $permissions['canEditCourses'] ) ? ( $permissions['canEditCourses'] ? 1 : 0 ) : 0,
                'can_delete_courses' => isset( $permissions['canDeleteCourses'] ) ? ( $permissions['canDeleteCourses'] ? 1 : 0 ) : 0,
                'can_create_lessons' => isset( $permissions['canCreateLessons'] ) ? ( $permissions['canCreateLessons'] ? 1 : 0 ) : 0,
                'can_edit_lessons' => isset( $permissions['canEditLessons'] ) ? ( $permissions['canEditLessons'] ? 1 : 0 ) : 0,
                'can_delete_lessons' => isset( $permissions['canDeleteLessons'] ) ? ( $permissions['canDeleteLessons'] ? 1 : 0 ) : 0,
                'can_manage_excalidraw' => isset( $permissions['canManageExcalidraw'] ) ? ( $permissions['canManageExcalidraw'] ? 1 : 0 ) : 0,
                'can_moderate_all' => isset( $permissions['canModerateAll'] ) ? ( $permissions['canModerateAll'] ? 1 : 0 ) : 0,
            );
            
            error_log('[update_job_role] Saving LMS perm_data: ' . print_r($perm_data, true));
            $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
            error_log('[update_job_role] LMS permissions save result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            
            if ( !$result ) {
                error_log( 'Failed to save LMS permissions for role ' . $id );
            }
        } else {
            error_log('[update_job_role] LMS permissions table does not exist');
        }
    }
    
    // Handle Email Composer permissions if provided
    if ( isset($json_params['emailPermissions']) ) {
        $permissions = $json_params['emailPermissions'];
        error_log('[update_job_role] Email permissions received: ' . print_r($permissions, true));
        $permissions_table = $wpdb->prefix . 'pg_email_permissions';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        
        if ( $table_exists ) {
            $perm_data = array(
                'job_role_id' => $id,
                'can_send_email' => isset( $permissions['canSendEmail'] ) ? ( $permissions['canSendEmail'] ? 1 : 0 ) : 0,
                'can_manage_templates' => isset( $permissions['canManageTemplates'] ) ? ( $permissions['canManageTemplates'] ? 1 : 0 ) : 0,
                'can_view_history' => isset( $permissions['canViewHistory'] ) ? ( $permissions['canViewHistory'] ? 1 : 0 ) : 0,
            );
            
            error_log('[update_job_role] Saving Email perm_data: ' . print_r($perm_data, true));
            $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
            error_log('[update_job_role] Email permissions save result: ' . ($result ? 'SUCCESS' : 'FAILED'));
            
            if ( !$result ) {
                error_log( 'Failed to save Email permissions for role ' . $id );
            }
        } else {
            error_log('[update_job_role] Email permissions table does not exist');
        }
    }
    
    // Handle Certificate Tracking permissions if provided
    if ( isset($json_params['certificatePermissions']) ) {
        $permissions = $json_params['certificatePermissions'];
        $permissions_table = $wpdb->prefix . 'aquaticpro_cert_permissions';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        
        if ( $table_exists ) {
            $perm_data = array(
                'job_role_id' => $id,
                'can_view_all' => isset( $permissions['canViewAll'] ) ? ( $permissions['canViewAll'] ? 1 : 0 ) : 0,
                'can_edit_records' => isset( $permissions['canEditRecords'] ) ? ( $permissions['canEditRecords'] ? 1 : 0 ) : 0,
                'can_manage_types' => isset( $permissions['canManageTypes'] ) ? ( $permissions['canManageTypes'] ? 1 : 0 ) : 0,
                'can_approve_uploads' => isset( $permissions['canApproveUploads'] ) ? ( $permissions['canApproveUploads'] ? 1 : 0 ) : 0,
                'can_bulk_edit' => isset( $permissions['canBulkEdit'] ) ? ( $permissions['canBulkEdit'] ? 1 : 0 ) : 0,
            );
            
            $result = mentorship_platform_pg_upsert_permission($permissions_table, $perm_data);
            
            if ( !$result ) {
                error_log( 'Failed to save Certificate permissions for role ' . $id );
            }
        } else {
            error_log('[update_job_role] Certificate permissions table does not exist');
        }
    }
    
    // Invalidate job roles cache since permissions changed
    delete_transient('mp_job_roles_with_permissions');
    // Also clear versioned cache key
    $plugin_data = get_file_data( WP_PLUGIN_DIR . '/aquaticpro/mentorship-platform.php', array( 'Version' => 'Version' ) );
    $version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    delete_transient('mp_job_roles_with_permissions_v' . str_replace('.', '_', $version));
    
    // CRITICAL FIX: Clear permission cache for all users assigned to this role
    // When a role's permissions change, users with that role need their cached permissions refreshed
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $affected_users = $wpdb->get_col( $wpdb->prepare(
        "SELECT DISTINCT user_id FROM $assignments_table WHERE job_role_id = %d",
        $id
    ) );
    
    if ( ! empty( $affected_users ) ) {
        foreach ( $affected_users as $user_id ) {
            $cache_key = 'mp_user_perms_' . $user_id;
            delete_transient( $cache_key );
            error_log( "[Role Update] Cleared permission cache for user $user_id (affected by role $id update)" );
        }
        error_log( "[Role Update] Cleared permission cache for " . count( $affected_users ) . " users affected by role $id update" );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Delete a job role
 */
function mentorship_platform_pg_delete_job_role( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_job_roles';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete( $table_name, array( 'id' => $id ) );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete job role', array( 'status' => 500 ) );
    }
    
    // Invalidate job roles cache
    delete_transient('mp_job_roles_with_permissions');
    // Also clear versioned cache key
    $plugin_data = get_file_data( WP_PLUGIN_DIR . '/aquaticpro/mentorship-platform.php', array( 'Version' => 'Version' ) );
    $version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    delete_transient('mp_job_roles_with_permissions_v' . str_replace('.', '_', $version));
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

// --- API Callback Functions: Promotion Criteria ---

/**
 * Get promotion criteria
 */
function mentorship_platform_pg_get_criteria( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: GET /criteria START ===');
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_promotion_criteria';
    
    $job_role_id = $request->get_param( 'job_role_id' );
    error_log(sprintf('Params: job_role_id=%s', $job_role_id ?: 'all'));
    
    $query_start = microtime(true);
    if ( $job_role_id ) {
        $results = $wpdb->get_results( 
            $wpdb->prepare( "SELECT * FROM $table_name WHERE job_role_id = %d ORDER BY sort_order ASC, id ASC", $job_role_id ),
            ARRAY_A 
        );
    } else {
        $results = $wpdb->get_results( "SELECT * FROM $table_name ORDER BY job_role_id ASC, sort_order ASC", ARRAY_A );
    }
    $query_time = (microtime(true) - $query_start) * 1000;
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('Query: %.2fms, Total: %.2fms, criteria=%d', $query_time, $total_time, count($results)));
    error_log('=== PROFESSIONAL GROWTH API: GET /criteria END ===');
    
    return rest_ensure_response( $results );
}

/**
 * Create a new criterion
 */
function mentorship_platform_pg_create_criterion( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: POST /criterion START ===');
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_promotion_criteria';
    
    $data = array(
        'job_role_id'    => intval( $request->get_param( 'job_role_id' ) ),
        'title'          => sanitize_text_field( $request->get_param( 'title' ) ),
        'description'    => wp_kses_post( $request->get_param( 'description' ) ),
        'criterion_type' => sanitize_text_field( $request->get_param( 'criterion_type' ) ),
        'target_value'   => intval( $request->get_param( 'target_value' ) ) ?: 1,
        'linked_module'  => sanitize_text_field( $request->get_param( 'linked_module' ) ),
        'sort_order'     => intval( $request->get_param( 'sort_order' ) ) ?: 0,
        'is_required'    => $request->get_param( 'is_required' ) !== false ? 1 : 0,
    );
    
    $insert_start = microtime(true);
    $inserted = $wpdb->insert( $table_name, $data );
    $insert_time = (microtime(true) - $insert_start) * 1000;
    
    if ( $inserted === false ) {
        error_log(sprintf('Insert failed: %.2fms', $insert_time));
        return new WP_Error( 'insert_failed', 'Failed to create criterion', array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== PROFESSIONAL GROWTH API: POST /criterion END - Insert: %.2fms, Total: %.2fms ===',
        $insert_time, $total_time));
    
    return rest_ensure_response( $data );
}

/**
 * Update a criterion
 */
function mentorship_platform_pg_update_criterion( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: PUT /criterion START ===');
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_promotion_criteria';
    $id = $request->get_param( 'id' );
    error_log(sprintf('Params: criterion_id=%d', $id));
    
    $data = array();
    
    if ( $request->has_param( 'title' ) ) {
        $data['title'] = sanitize_text_field( $request->get_param( 'title' ) );
    }
    if ( $request->has_param( 'description' ) ) {
        $data['description'] = wp_kses_post( $request->get_param( 'description' ) );
    }
    if ( $request->has_param( 'criterion_type' ) ) {
        $data['criterion_type'] = sanitize_text_field( $request->get_param( 'criterion_type' ) );
    }
    if ( $request->has_param( 'target_value' ) ) {
        $data['target_value'] = intval( $request->get_param( 'target_value' ) );
    }
    if ( $request->has_param( 'linked_module' ) ) {
        $data['linked_module'] = sanitize_text_field( $request->get_param( 'linked_module' ) );
    }
    if ( $request->has_param( 'sort_order' ) ) {
        $data['sort_order'] = intval( $request->get_param( 'sort_order' ) );
    }
    if ( $request->has_param( 'is_required' ) ) {
        $data['is_required'] = $request->get_param( 'is_required' ) ? 1 : 0;
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $update_start = microtime(true);
    $updated = $wpdb->update( $table_name, $data, array( 'id' => $id ) );
    $update_time = (microtime(true) - $update_start) * 1000;
    
    if ( $updated === false ) {
        error_log(sprintf('Update failed: %.2fms', $update_time));
        return new WP_Error( 'update_failed', 'Failed to update criterion', array( 'status' => 500 ) );
    }
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== PROFESSIONAL GROWTH API: PUT /criterion END - Update: %.2fms, Total: %.2fms ===',
        $update_time, $total_time));
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Delete a criterion
 */
function mentorship_platform_pg_delete_criterion( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_promotion_criteria';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete( $table_name, array( 'id' => $id ) );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete criterion', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

// --- API Callback Functions: User Progress ---

/**
 * Get user's progress on promotion criteria
 */
function mentorship_platform_pg_get_user_progress( $request ) {
    global $wpdb;
    $user_id = $request->get_param( 'user_id' );
    $job_role_id = $request->get_param( 'job_role_id' );
    
    // Recalculate all linked module counts to ensure accuracy
    mentorship_platform_pg_recalculate_inservice_progress( $user_id );
    mentorship_platform_pg_recalculate_initiative_progress( $user_id );
    mentorship_platform_pg_recalculate_mentorship_goal_progress( $user_id );
    
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Build query to get criteria with progress
    if ( $job_role_id ) {
        $query = $wpdb->prepare(
            "SELECT c.id as criterion_id, c.title, c.description, c.criterion_type, c.target_value, c.linked_module, c.sort_order, c.is_required, 
                    p.current_value, p.is_completed, p.completion_date, p.approved_by, p.notes, p.file_url
            FROM $criteria_table c
            LEFT JOIN $progress_table p ON c.id = p.criterion_id AND p.user_id = %d
            WHERE c.job_role_id = %d
            ORDER BY c.sort_order ASC, c.id ASC",
            $user_id,
            $job_role_id
        );
    } else {
        $query = $wpdb->prepare(
            "SELECT c.id as criterion_id, c.title, c.description, c.criterion_type, c.target_value, c.linked_module, c.sort_order, c.is_required,
                    p.current_value, p.is_completed, p.completion_date, p.approved_by, p.notes, p.file_url
            FROM $criteria_table c
            LEFT JOIN $progress_table p ON c.id = p.criterion_id AND p.user_id = %d
            ORDER BY c.job_role_id ASC, c.sort_order ASC, c.id ASC",
            $user_id
        );
    }
    
    $results = $wpdb->get_results( $query, ARRAY_A );
    
    return rest_ensure_response( $results );
}

/**
 * Update user progress on a criterion
 */
function mentorship_platform_pg_update_progress( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_user_progress';
    
    $user_id = intval( $request->get_param( 'user_id' ) );
    $criterion_id = intval( $request->get_param( 'criterion_id' ) );
    
    $data = array(
        'user_id'      => $user_id,
        'criterion_id' => $criterion_id,
    );
    
    if ( $request->has_param( 'current_value' ) ) {
        $data['current_value'] = intval( $request->get_param( 'current_value' ) );
    }
    
    if ( $request->has_param( 'is_completed' ) ) {
        $is_completed = $request->get_param( 'is_completed' );
        $data['is_completed'] = $is_completed ? 1 : 0;

        // Only allow supervisors (not self) to approve/mark as completed
        $current_user_id = get_current_user_id();
        if ( $is_completed && $current_user_id != $user_id ) {
            $data['completion_date'] = current_time( 'mysql' );
            $data['approved_by'] = $current_user_id;
        }
    }
    
    if ( $request->has_param( 'notes' ) ) {
        $data['notes'] = wp_kses_post( $request->get_param( 'notes' ) );
    }
    
    if ( $request->has_param( 'file_url' ) ) {
        $data['file_url'] = esc_url_raw( $request->get_param( 'file_url' ) );
    }
    
    // Check if record exists
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table_name WHERE user_id = %d AND criterion_id = %d",
        $user_id,
        $criterion_id
    ) );
    
    if ( $existing ) {
        // Update existing record
        $result = $wpdb->update( $table_name, $data, array( 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
    } else {
        // Insert new record
        $result = $wpdb->insert( $table_name, $data );
    }
    
    if ( $result === false ) {
        return new WP_Error( 'update_failed', 'Failed to update progress', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
}

// --- API Callback Functions: In-Service Training ---

/**
 * Get in-service training logs
 */
function mentorship_platform_pg_get_inservice_logs( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    
    $user_id = $request->get_param( 'user_id' );
    $start_date = $request->get_param( 'start_date' );
    $end_date = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' );
    
    $where_clauses = array();
    $where_params = array();
    
    // Filter out archived records by default
    if ( ! $include_archived ) {
        $where_clauses[] = "l.archived = 0";
    }
    
    if ( $start_date ) {
        $where_clauses[] = "l.training_date >= %s";
        $where_params[] = $start_date;
    }
    
    if ( $end_date ) {
        $where_clauses[] = "l.training_date <= %s";
        $where_params[] = $end_date;
    }
    
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    
    if ( $user_id ) {
        // Get logs where user was involved (as attendee, leader, or no-show)
        $query = "SELECT DISTINCT l.* FROM $logs_table l
                  INNER JOIN $attendees_table a ON l.id = a.inservice_id
                  $where_sql" . ( ! empty( $where_clauses ) ? ' AND' : 'WHERE' ) . " a.user_id = %d
                  ORDER BY l.training_date DESC, l.training_time DESC";
        $where_params[] = $user_id;
        $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
    } else {
        // Get all logs
        $query = "SELECT * FROM $logs_table l $where_sql ORDER BY l.training_date DESC, l.training_time DESC";
        if ( ! empty( $where_params ) ) {
            $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
        } else {
            $results = $wpdb->get_results( $query, ARRAY_A );
        }
    }
    
    // Get attendees and job roles for each log
    $job_roles_table = $wpdb->prefix . 'pg_inservice_job_roles';
    foreach ( $results as &$log ) {
        // Get attendees
        $attendees_query = $wpdb->prepare(
            "SELECT a.user_id, a.attendance_status, u.display_name
            FROM $attendees_table a
            LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
            WHERE a.inservice_id = %d",
            $log['id']
        );
        $attendees = $wpdb->get_results( $attendees_query, ARRAY_A );
        
        $log['leaders'] = array();
        $log['attendees'] = array();
        $log['no_shows'] = array();
        
        foreach ( $attendees as $attendee ) {
            $user_data = array(
                'id' => (int) $attendee['user_id'],
                'name' => $attendee['display_name'],
            );
            
            if ( $attendee['attendance_status'] === 'leader' ) {
                $log['leaders'][] = $user_data;
            } elseif ( $attendee['attendance_status'] === 'attended' ) {
                $log['attendees'][] = $user_data;
            } elseif ( $attendee['attendance_status'] === 'no_show' ) {
                $log['no_shows'][] = $user_data;
            }
        }
        
        // Get job roles for this training
        $job_roles_query = $wpdb->prepare(
            "SELECT jr.id, jr.title
            FROM $job_roles_table ijr
            INNER JOIN {$wpdb->prefix}pg_job_roles jr ON ijr.job_role_id = jr.id
            WHERE ijr.inservice_id = %d
            ORDER BY jr.title",
            $log['id']
        );
        $job_roles = $wpdb->get_results( $job_roles_query, ARRAY_A );
        // Ensure job role IDs are integers
        $log['job_roles'] = array_map(function($role) {
            return array(
                'id' => (int) $role['id'],
                'title' => $role['title']
            );
        }, $job_roles ?: array());
        
        // Ensure archived is properly set (convert to boolean for JSON)
        $log['archived'] = !empty($log['archived']);
    }
    
    return rest_ensure_response( $results );
}

/**
 * Create a new in-service training log
 */
function mentorship_platform_pg_create_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $job_roles_table = $wpdb->prefix . 'pg_inservice_job_roles';
    
    $data = array(
        'training_date'  => sanitize_text_field( $request->get_param( 'training_date' ) ),
        'training_time'  => sanitize_text_field( $request->get_param( 'training_time' ) ),
        'location'       => sanitize_text_field( $request->get_param( 'location' ) ),
        'duration_hours' => floatval( $request->get_param( 'duration_hours' ) ),
        'topic'          => sanitize_text_field( $request->get_param( 'topic' ) ),
        'details'        => wp_kses_post( $request->get_param( 'details' ) ),
        'created_by'     => get_current_user_id(),
    );
    
    $inserted = $wpdb->insert( $logs_table, $data );
    
    if ( $inserted === false ) {
        return new WP_Error( 'insert_failed', 'Failed to create training log', array( 'status' => 500 ) );
    }
    
    $log_id = $wpdb->insert_id;
    
    // Add job roles for this training
    $job_roles = $request->get_param( 'job_roles' ) ?: array();
    foreach ( $job_roles as $role_id ) {
        $wpdb->insert( $job_roles_table, array(
            'inservice_id' => $log_id,
            'job_role_id'  => intval( $role_id ),
        ) );
    }
    
    // Add leaders
    $leaders = $request->get_param( 'leaders' ) ?: array();
    foreach ( $leaders as $user_id ) {
        $wpdb->insert( $attendees_table, array(
            'inservice_id'      => $log_id,
            'user_id'           => intval( $user_id ),
            'attendance_status' => 'leader',
        ) );
        
        // Update promotion progress for leading a training
        mentorship_platform_pg_update_linked_module_progress( intval( $user_id ), 'inservice_leader', 'completed' );
    }
    
    // Add attendees
    $attendees = $request->get_param( 'attendees' ) ?: array();
    foreach ( $attendees as $user_id ) {
        $wpdb->insert( $attendees_table, array(
            'inservice_id'      => $log_id,
            'user_id'           => intval( $user_id ),
            'attendance_status' => 'attended',
        ) );
        
        // Update promotion progress for attending a training
        mentorship_platform_pg_update_linked_module_progress( intval( $user_id ), 'inservice_attendee', 'completed' );
    }
    
    // Add no-shows
    $no_shows = $request->get_param( 'no_shows' ) ?: array();
    foreach ( $no_shows as $user_id ) {
        $wpdb->insert( $attendees_table, array(
            'inservice_id'      => $log_id,
            'user_id'           => intval( $user_id ),
            'attendance_status' => 'no_show',
        ) );
    }
    
    // Invalidate in-service cache for all affected users
    $all_affected_users = array_unique( array_merge( $leaders, $attendees, $no_shows ) );
    foreach ( $all_affected_users as $user_id ) {
        if ( function_exists( 'aquaticpro_invalidate_inservice_cache' ) ) {
            aquaticpro_invalidate_inservice_cache( intval( $user_id ) );
        }
    }
    
    $data['id'] = $log_id;
    return rest_ensure_response( $data );
}

/**
 * Get in-service summary for a user
 */
function mentorship_platform_pg_get_inservice_summary( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $job_roles_table = $wpdb->prefix . 'pg_inservice_job_roles';
    
    $user_id = $request->get_param( 'user_id' );
    $month = $request->get_param( 'month' );
    $job_role_id = $request->get_param( 'job_role_id' ); // New parameter
    
    error_log("=== IN-SERVICE SUMMARY CALLED ===");
    error_log("User ID: " . $user_id);
    error_log("Month: " . $month);
    error_log("Job Role ID: " . $job_role_id);
    
    // Get required hours from specified job role, or default to first role
    if ( $job_role_id ) {
        $required_hours_query = $wpdb->prepare(
            "SELECT inservice_hours FROM $roles_table WHERE id = %d",
            $job_role_id
        );
    } else {
        $required_hours_query = $wpdb->prepare(
            "SELECT r.inservice_hours
            FROM $assignments_table a
            INNER JOIN $roles_table r ON a.job_role_id = r.id
            WHERE a.user_id = %d
            LIMIT 1",
            $user_id
        );
    }
    $required_hours = floatval( $wpdb->get_var( $required_hours_query ) ?: 4.0 );
    
    // Get current month and previous month
    if ( $month ) {
        $target_month = $month;
    } else {
        $target_month = current_time( 'Y-m' );
    }
    
    $start_date = $target_month . '-01';
    $end_date = date( 'Y-m-t', strtotime( $start_date ) );
    
    // Previous month
    $prev_month_start = date( 'Y-m-01', strtotime( $start_date . ' -1 month' ) );
    $prev_month_end = date( 'Y-m-t', strtotime( $prev_month_start ) );
    
    // Build query for current month - filter by job role if specified
    $current_hours_sql = "SELECT SUM(l.duration_hours) as total_hours
        FROM $logs_table l
        INNER JOIN $attendees_table a ON l.id = a.inservice_id";
    
    if ( $job_role_id ) {
        $current_hours_sql .= " INNER JOIN $job_roles_table jr ON l.id = jr.inservice_id";
    }
    
    $current_hours_sql .= " WHERE a.user_id = %d 
        AND a.attendance_status IN ('leader', 'attended')
        AND l.archived = 0
        AND l.training_date >= %s 
        AND l.training_date <= %s";
    
    if ( $job_role_id ) {
        $current_hours_sql .= " AND jr.job_role_id = %d";
        $current_hours_query = $wpdb->prepare( $current_hours_sql, $user_id, $start_date, $end_date, $job_role_id );
    } else {
        $current_hours_query = $wpdb->prepare( $current_hours_sql, $user_id, $start_date, $end_date );
    }
    
    error_log("Current month query: " . $current_hours_query);
    $current_hours = $wpdb->get_var( $current_hours_query ) ?: 0;
    error_log("Current month hours result: " . $current_hours);
    if ($wpdb->last_error) {
        error_log("Current month query error: " . $wpdb->last_error);
    }
    
    // Debug: Check what attendee records exist for this user
    $debug_attendees_query = $wpdb->prepare(
        "SELECT a.inservice_id, a.user_id, a.attendance_status, l.training_date, l.duration_hours, l.archived, l.topic
        FROM $attendees_table a 
        INNER JOIN $logs_table l ON a.inservice_id = l.id 
        WHERE a.user_id = %d 
        AND l.training_date >= %s 
        AND l.training_date <= %s",
        $user_id, $start_date, $end_date
    );
    $debug_attendees = $wpdb->get_results($debug_attendees_query, ARRAY_A);
    error_log("=== DEBUG ATTENDEES for user $user_id in $target_month ===");
    error_log("Found " . count($debug_attendees) . " attendee records");
    foreach ($debug_attendees as $att) {
        error_log("  - Date: {$att['training_date']}, Status: '{$att['attendance_status']}', Hours: {$att['duration_hours']}, Archived: {$att['archived']}, Topic: {$att['topic']}");
    }
    
    // Check all distinct attendance_status values in the table
    $all_statuses = $wpdb->get_col("SELECT DISTINCT attendance_status FROM $attendees_table");
    error_log("All attendance_status values in database: " . implode(', ', $all_statuses));
    
    // Build query for previous month - filter by job role if specified
    $previous_hours_sql = "SELECT SUM(l.duration_hours) as total_hours
        FROM $logs_table l
        INNER JOIN $attendees_table a ON l.id = a.inservice_id";
    
    if ( $job_role_id ) {
        $previous_hours_sql .= " INNER JOIN $job_roles_table jr ON l.id = jr.inservice_id";
    }
    
    $previous_hours_sql .= " WHERE a.user_id = %d 
        AND a.attendance_status IN ('leader', 'attended')
        AND l.archived = 0
        AND l.training_date >= %s 
        AND l.training_date <= %s";
    
    if ( $job_role_id ) {
        $previous_hours_sql .= " AND jr.job_role_id = %d";
        $previous_hours_query = $wpdb->prepare( $previous_hours_sql, $user_id, $prev_month_start, $prev_month_end, $job_role_id );
    } else {
        $previous_hours_query = $wpdb->prepare( $previous_hours_sql, $user_id, $prev_month_start, $prev_month_end );
    }
    
    error_log("Previous month query: " . $previous_hours_query);
    $previous_hours = $wpdb->get_var( $previous_hours_query ) ?: 0;
    error_log("Previous month hours result: " . $previous_hours);
    if ($wpdb->last_error) {
        error_log("Previous month query error: " . $wpdb->last_error);
    }
    
    return rest_ensure_response( array(
        'user_id'              => $user_id,
        'current_month'        => $target_month,
        'current_month_hours'  => floatval( $current_hours ),
        'previous_month_hours' => floatval( $previous_hours ),
        'required_hours'       => $required_hours,
        'current_meets_requirement'  => floatval( $current_hours ) >= $required_hours,
        'previous_meets_requirement' => floatval( $previous_hours ) >= $required_hours,
        'job_role_id'          => $job_role_id,
    ) );
}

/**
 * Get in-service training summary for ALL users (batch) - Performance optimization
 * GET /pg/inservice/summary-batch?months=2025-01,2025-02
 * 
 * Returns summary data for all users with job role assignments for the specified months
 * Uses cached data when available for fast response
 */
function mentorship_platform_pg_get_inservice_summary_batch( $request ) {
    global $wpdb;
    $cache_table = $wpdb->prefix . 'pg_inservice_cache';
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Parse the months parameter (comma-separated)
    $months_param = $request->get_param( 'months' );
    $months = array_filter( array_map( 'trim', explode( ',', $months_param ) ) );
    
    if ( empty( $months ) ) {
        return new WP_Error( 'missing_months', 'At least one month is required', array( 'status' => 400 ) );
    }
    
    // Validate month format (YYYY-MM)
    foreach ( $months as $month ) {
        if ( ! preg_match( '/^\d{4}-\d{2}$/', $month ) ) {
            return new WP_Error( 'invalid_month', 'Invalid month format: ' . $month . '. Use YYYY-MM', array( 'status' => 400 ) );
        }
    }
    
    // DEBUG: Log what attendance statuses exist in the database
    $all_statuses = $wpdb->get_col( "SELECT DISTINCT attendance_status FROM $attendees_table" );
    error_log( "[InServiceBatch] All attendance_status values in DB: " . implode( ', ', $all_statuses ) );
    
    // DEBUG: Count total records by status
    $status_counts = $wpdb->get_results( "SELECT attendance_status, COUNT(*) as cnt FROM $attendees_table GROUP BY attendance_status", ARRAY_A );
    error_log( "[InServiceBatch] Status counts: " . json_encode( $status_counts ) );
    
    // DEBUG: Check for recent trainings
    $recent_trainings = $wpdb->get_results( 
        "SELECT l.id, l.training_date, l.duration_hours, l.archived, l.topic, COUNT(a.user_id) as attendee_count
         FROM $logs_table l 
         LEFT JOIN $attendees_table a ON l.id = a.inservice_id 
         WHERE l.training_date >= '2025-12-01'
         GROUP BY l.id
         ORDER BY l.training_date DESC
         LIMIT 10",
        ARRAY_A 
    );
    error_log( "[InServiceBatch] Recent trainings: " . json_encode( $recent_trainings ) );
    
    // Get all users with job role assignments
    $users_query = "
        SELECT DISTINCT 
            u.ID as user_id,
            u.display_name,
            GROUP_CONCAT(DISTINCT uja.job_role_id) as job_role_ids,
            GROUP_CONCAT(DISTINCT r.title SEPARATOR ', ') as job_role_titles
        FROM {$wpdb->users} u
        INNER JOIN {$assignments_table} uja ON u.ID = uja.user_id
        INNER JOIN {$roles_table} r ON uja.job_role_id = r.id
        GROUP BY u.ID, u.display_name
    ";
    $users = $wpdb->get_results( $users_query, ARRAY_A );
    
    if ( empty( $users ) ) {
        return rest_ensure_response( array() );
    }
    
    // Get all role requirements
    $roles_query = "SELECT id, title, inservice_hours FROM {$roles_table}";
    $roles = $wpdb->get_results( $roles_query, ARRAY_A );
    $roles_by_id = array();
    foreach ( $roles as $role ) {
        $roles_by_id[ (int)$role['id'] ] = array(
            'id' => (int)$role['id'],
            'title' => $role['title'],
            'inservice_hours' => floatval( $role['inservice_hours'] ?: 4.0 )
        );
    }
    
    // Check if cache table exists
    $cache_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
    $cached_data = array();
    $cache_hits = 0;
    $cache_misses = 0;
    
    if ( $cache_exists ) {
        // Build list of months for IN clause
        $months_placeholders = implode( ',', array_fill( 0, count( $months ), '%s' ) );
        
        // Get all cached data for requested months
        $cache_query = $wpdb->prepare(
            "SELECT user_id, month, total_hours, required_hours, meets_requirement, training_count 
             FROM $cache_table 
             WHERE month IN ($months_placeholders)",
            $months
        );
        $cache_rows = $wpdb->get_results( $cache_query, ARRAY_A );
        
        // Index by user_id and month
        foreach ( $cache_rows as $row ) {
            $uid = (int) $row['user_id'];
            $mon = $row['month'];
            if ( ! isset( $cached_data[ $uid ] ) ) {
                $cached_data[ $uid ] = array();
            }
            $cached_data[ $uid ][ $mon ] = array(
                'hours' => floatval( $row['total_hours'] ),
                'required_hours' => floatval( $row['required_hours'] ),
                'meets_requirement' => (bool) $row['meets_requirement'],
                'training_count' => (int) $row['training_count']
            );
        }
    }
    
    // Build results array
    $results = array();
    
    foreach ( $users as $user ) {
        $user_id = (int) $user['user_id'];
        $user_data = array(
            'user_id' => $user_id,
            'display_name' => $user['display_name'],
            'job_role_ids' => $user['job_role_ids'],
            'job_role_titles' => $user['job_role_titles'],
            'summaries' => array()
        );
        
        // Get primary role's required hours (first role in their assignments)
        $role_ids = array_filter( array_map( 'intval', explode( ',', $user['job_role_ids'] ) ) );
        $default_required_hours = 4.0;
        if ( ! empty( $role_ids ) && isset( $roles_by_id[ $role_ids[0] ] ) ) {
            $default_required_hours = $roles_by_id[ $role_ids[0] ]['inservice_hours'];
        }
        
        // Get summaries for each requested month
        foreach ( $months as $month ) {
            // Check cache first
            if ( isset( $cached_data[ $user_id ][ $month ] ) ) {
                $cache_hits++;
                $cached = $cached_data[ $user_id ][ $month ];
                $user_data['summaries'][ $month ] = array(
                    'month' => $month,
                    'hours' => $cached['hours'],
                    'required_hours' => $cached['required_hours'],
                    'meets_requirement' => $cached['meets_requirement'],
                    'from_cache' => true
                );
            } else {
                // Cache miss - calculate live
                $cache_misses++;
                $start_date = $month . '-01';
                $end_date = date( 'Y-m-t', strtotime( $start_date ) );
                
                $hours_query = $wpdb->prepare(
                    "SELECT SUM(l.duration_hours) as total_hours
                    FROM {$logs_table} l
                    INNER JOIN {$attendees_table} a ON l.id = a.inservice_id
                    WHERE a.user_id = %d
                    AND a.attendance_status IN ('leader', 'attended')
                    AND l.archived = 0
                    AND l.training_date >= %s
                    AND l.training_date <= %s",
                    $user_id, $start_date, $end_date
                );
                
                // DEBUG: Log the query for troubleshooting
                error_log( "[InServiceBatch] User {$user_id}, Month {$month}: Query = {$hours_query}" );
                
                $hours = floatval( $wpdb->get_var( $hours_query ) ?: 0 );
                
                // DEBUG: Log the result
                error_log( "[InServiceBatch] User {$user_id}, Month {$month}: Hours = {$hours}" );
                if ( $wpdb->last_error ) {
                    error_log( "[InServiceBatch] SQL Error: " . $wpdb->last_error );
                }
                
                $user_data['summaries'][ $month ] = array(
                    'month' => $month,
                    'hours' => $hours,
                    'required_hours' => $default_required_hours,
                    'meets_requirement' => $hours >= $default_required_hours,
                    'from_cache' => false
                );
                
                // Also populate the cache for this user/month
                if ( $cache_exists && function_exists( 'aquaticpro_recalculate_inservice_cache_for_user' ) ) {
                    aquaticpro_recalculate_inservice_cache_for_user( $user_id );
                }
            }
        }
        
        $results[] = $user_data;
    }
    
    // Log cache stats
    error_log( "[InServiceCache] Batch query: {$cache_hits} cache hits, {$cache_misses} cache misses" );
    
    return rest_ensure_response( $results );
}

/**
 * Manually refresh in-service hours cache for all users
 * POST /pg/inservice/refresh-cache
 * Admin only endpoint for forcing a cache refresh
 */
function mentorship_platform_pg_refresh_inservice_cache( $request ) {
    $start_time = microtime( true );
    
    if ( function_exists( 'aquaticpro_refresh_all_inservice_cache' ) ) {
        $result = aquaticpro_refresh_all_inservice_cache();
        $elapsed = round( ( microtime( true ) - $start_time ) * 1000, 2 );
        
        return rest_ensure_response( array(
            'success' => true,
            'message' => "In-service cache refreshed in {$elapsed}ms",
            'stats' => $result
        ) );
    }
    
    return new WP_Error( 'function_not_found', 'Cache refresh function not available', array( 'status' => 500 ) );
}

/**
 * Update an in-service training log
 */
function mentorship_platform_pg_update_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $job_roles_table = $wpdb->prefix . 'pg_inservice_job_roles';
    $id = $request->get_param( 'id' );
    
    // Build update data
    $data = array();
    if ( $request->has_param( 'training_date' ) ) {
        $data['training_date'] = sanitize_text_field( $request->get_param( 'training_date' ) );
    }
    if ( $request->has_param( 'training_time' ) ) {
        $data['training_time'] = sanitize_text_field( $request->get_param( 'training_time' ) );
    }
    if ( $request->has_param( 'location' ) ) {
        $data['location'] = sanitize_text_field( $request->get_param( 'location' ) );
    }
    if ( $request->has_param( 'duration_hours' ) ) {
        $data['duration_hours'] = floatval( $request->get_param( 'duration_hours' ) );
    }
    if ( $request->has_param( 'topic' ) ) {
        $data['topic'] = sanitize_text_field( $request->get_param( 'topic' ) );
    }
    if ( $request->has_param( 'details' ) ) {
        $data['details'] = wp_kses_post( $request->get_param( 'details' ) );
    }
    
    if ( !empty( $data ) ) {
        $wpdb->update( $logs_table, $data, array( 'id' => $id ) );
    }
    
    // Update job roles if provided
    if ( $request->has_param( 'job_roles' ) ) {
        // Delete existing job roles
        $wpdb->delete( $job_roles_table, array( 'inservice_id' => $id ) );
        
        // Re-insert updated job roles
        $job_roles = $request->get_param( 'job_roles' ) ?: array();
        foreach ( $job_roles as $role_id ) {
            $wpdb->insert( $job_roles_table, array(
                'inservice_id' => $id,
                'job_role_id'  => intval( $role_id ),
            ) );
        }
    }
    
    // Update attendees if provided
    if ( $request->has_param( 'leaders' ) || $request->has_param( 'attendees' ) || $request->has_param( 'no_shows' ) ) {
        // Delete existing attendees
        $wpdb->delete( $attendees_table, array( 'inservice_id' => $id ) );
        
        // Re-insert updated attendees
        $leaders = $request->get_param( 'leaders' ) ?: array();
        $attendees = $request->get_param( 'attendees' ) ?: array();
        $no_shows = $request->get_param( 'no_shows' ) ?: array();
        
        // Track all affected user IDs for recalculation
        $affected_users = array_unique( array_merge( $leaders, $attendees, $no_shows ) );
        
        foreach ( $leaders as $user_id ) {
            $wpdb->insert( $attendees_table, array(
                'inservice_id' => $id,
                'user_id' => intval( $user_id ),
                'attendance_status' => 'leader'
            ) );
        }
        
        foreach ( $attendees as $user_id ) {
            $wpdb->insert( $attendees_table, array(
                'inservice_id' => $id,
                'user_id' => intval( $user_id ),
                'attendance_status' => 'attended'
            ) );
        }
        
        foreach ( $no_shows as $user_id ) {
            $wpdb->insert( $attendees_table, array(
                'inservice_id' => $id,
                'user_id' => intval( $user_id ),
                'attendance_status' => 'no_show'
            ) );
        }
        
        // Recalculate promotion progress for all affected users
        foreach ( $affected_users as $user_id ) {
            mentorship_platform_pg_recalculate_inservice_progress( intval( $user_id ) );
            
            // Also invalidate in-service hours cache
            if ( function_exists( 'aquaticpro_invalidate_inservice_cache' ) ) {
                aquaticpro_invalidate_inservice_cache( intval( $user_id ) );
            }
        }
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Delete an in-service training log
 */
function mentorship_platform_pg_delete_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $id = $request->get_param( 'id' );
    
    // Get affected users before deleting
    $affected_users = $wpdb->get_col( $wpdb->prepare(
        "SELECT user_id FROM $attendees_table WHERE inservice_id = %d",
        $id
    ) );
    
    // Delete attendees first
    $wpdb->delete( $attendees_table, array( 'inservice_id' => $id ) );
    
    // Delete log
    $deleted = $wpdb->delete( $logs_table, array( 'id' => $id ) );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete training log', array( 'status' => 500 ) );
    }
    
    // Invalidate in-service cache for all affected users
    foreach ( $affected_users as $user_id ) {
        if ( function_exists( 'aquaticpro_invalidate_inservice_cache' ) ) {
            aquaticpro_invalidate_inservice_cache( intval( $user_id ) );
        }
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Archive an in-service training log
 */
function mentorship_platform_pg_archive_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $id = $request->get_param( 'id' );
    
    // Check if the log exists
    $log_exists = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $logs_table WHERE id = %d", $id ) );
    if ( ! $log_exists ) {
        return new WP_Error( 'not_found', 'Training log not found', array( 'status' => 404 ) );
    }
    
    $updated = $wpdb->update(
        $logs_table,
        array( 'archived' => 1 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        error_log( 'Failed to archive inservice log ' . $id . ': ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive training log: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    // Invalidate cache for all attendees of this training
    $affected_users = $wpdb->get_col( $wpdb->prepare(
        "SELECT user_id FROM $attendees_table WHERE inservice_id = %d",
        $id
    ) );
    foreach ( $affected_users as $user_id ) {
        if ( function_exists( 'aquaticpro_invalidate_inservice_cache' ) ) {
            aquaticpro_invalidate_inservice_cache( intval( $user_id ) );
        }
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => true ) );
}

/**
 * Restore an in-service training log
 */
function mentorship_platform_pg_restore_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $id = $request->get_param( 'id' );
    
    // Check if the log exists
    $log_exists = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $logs_table WHERE id = %d", $id ) );
    if ( ! $log_exists ) {
        return new WP_Error( 'not_found', 'Training log not found', array( 'status' => 404 ) );
    }
    
    $updated = $wpdb->update(
        $logs_table,
        array( 'archived' => 0 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        error_log( 'Failed to restore inservice log ' . $id . ': ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore training log: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    // Invalidate cache for all attendees of this training
    $affected_users = $wpdb->get_col( $wpdb->prepare(
        "SELECT user_id FROM $attendees_table WHERE inservice_id = %d",
        $id
    ) );
    foreach ( $affected_users as $user_id ) {
        if ( function_exists( 'aquaticpro_invalidate_inservice_cache' ) ) {
            aquaticpro_invalidate_inservice_cache( intval( $user_id ) );
        }
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => false ) );
}

/**
 * Bulk archive in-service logs
 */
function mentorship_platform_pg_bulk_archive_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $logs_table SET archived = 1 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk archive inservice logs: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive training logs: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Bulk restore in-service logs
 */
function mentorship_platform_pg_bulk_restore_inservice( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $logs_table SET archived = 0 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk restore inservice logs: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore training logs: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Get team training stats for a given month
 */
function mentorship_platform_pg_get_inservice_team_stats( $request ) {
    global $wpdb;
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    
    $month = $request->get_param( 'month' );
    $start_date = $month . '-01';
    $end_date = date( 'Y-m-t', strtotime( $start_date ) );
    
    // Get total hours offered during this month
    $total_hours_query = $wpdb->prepare(
        "SELECT SUM(duration_hours) as total_hours
        FROM $logs_table
        WHERE training_date >= %s AND training_date <= %s",
        $start_date,
        $end_date
    );
    $total_hours_offered = floatval( $wpdb->get_var( $total_hours_query ) ?: 0 );
    
    // Get all non-archived employees with job assignments
    $employees_query = "
        SELECT DISTINCT 
            u.ID as user_id,
            r.inservice_hours as required_hours
        FROM {$wpdb->users} u
        INNER JOIN $assignments_table a ON u.ID = a.user_id
        INNER JOIN $roles_table r ON a.job_role_id = r.id
        LEFT JOIN $metadata_table m ON u.ID = m.user_id
        WHERE (m.archived IS NULL OR m.archived = 0)
    ";
    $employees = $wpdb->get_results( $employees_query, ARRAY_A );
    
    $employees_count = count( $employees );
    $employees_met = 0;
    $employees_did_not_meet = 0;
    
    foreach ( $employees as $employee ) {
        $user_id = $employee['user_id'];
        $required_hours = floatval( $employee['required_hours'] );
        
        // Get hours for this employee
        $hours_query = $wpdb->prepare(
            "SELECT SUM(l.duration_hours) as total_hours
            FROM $logs_table l
            INNER JOIN $attendees_table a ON l.id = a.inservice_id
            WHERE a.user_id = %d 
            AND a.attendance_status IN ('leader', 'attended')
            AND l.training_date >= %s 
            AND l.training_date <= %s",
            $user_id,
            $start_date,
            $end_date
        );
        $hours = floatval( $wpdb->get_var( $hours_query ) ?: 0 );
        
        if ( $hours >= $required_hours ) {
            $employees_met++;
        } else {
            $employees_did_not_meet++;
        }
    }
    
    return rest_ensure_response( array(
        'month' => $month,
        'total_hours_offered' => $total_hours_offered,
        'employees_count' => $employees_count,
        'employees_met_requirement' => $employees_met,
        'employees_did_not_meet' => $employees_did_not_meet,
    ) );
}

// --- API Callback Functions: Scan Audits ---

/**
 * Get scan audit logs
 */
function mentorship_platform_pg_get_scan_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    
    $audited_user_id = $request->get_param( 'audited_user_id' );
    $start_date = $request->get_param( 'start_date' );
    $end_date = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' );
    
    $where_clauses = array();
    $where_params = array();
    
    // Filter out archived records by default
    if ( ! $include_archived ) {
        $where_clauses[] = "archived = 0";
    }
    
    if ( $audited_user_id ) {
        $where_clauses[] = "audited_user_id = %d";
        $where_params[] = $audited_user_id;
    }
    
    if ( $start_date ) {
        $where_clauses[] = "audit_date >= %s";
        $where_params[] = $start_date;
    }
    
    if ( $end_date ) {
        $where_clauses[] = "audit_date <= %s";
        $where_params[] = $end_date;
    }
    
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    
    $query = "SELECT * FROM $table_name $where_sql ORDER BY audit_date DESC";
    
    if ( ! empty( $where_params ) ) {
        $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
    } else {
        $results = $wpdb->get_results( $query, ARRAY_A );
    }
    
    // Add user display names and ensure IDs are integers
    foreach ( $results as &$audit ) {
        // Cast ID fields to integers for proper JavaScript comparisons
        $audit['id'] = (int) $audit['id'];
        $audit['audited_user_id'] = (int) $audit['audited_user_id'];
        $audit['auditor_id'] = (int) $audit['auditor_id'];
        
        $audited_user = get_userdata( $audit['audited_user_id'] );
        $auditor = get_userdata( $audit['auditor_id'] );
        
        $audit['audited_user_name'] = $audited_user ? $audited_user->display_name : '';
        $audit['auditor_name'] = $auditor ? $auditor->display_name : '';
    }
    
    return rest_ensure_response( $results );
}

/**
 * Create a new scan audit
 */
function mentorship_platform_pg_create_scan_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    
    $data = array(
        'audited_user_id'           => intval( $request->get_param( 'audited_user_id' ) ),
        'auditor_id'                => get_current_user_id(),
        'audit_date'                => sanitize_text_field( $request->get_param( 'audit_date' ) ),
        'location'                  => sanitize_text_field( $request->get_param( 'location' ) ),
        'result'                    => sanitize_text_field( $request->get_param( 'result' ) ),
        'notes'                     => wp_kses_post( $request->get_param( 'notes' ) ),
        'archived'                  => 0, // Explicitly set archived to 0
    );
    
    // Add optional fields only if present
    if ( $request->has_param( 'wearing_correct_uniform' ) ) {
        $data['wearing_correct_uniform'] = intval( $request->get_param( 'wearing_correct_uniform' ) );
    }
    if ( $request->has_param( 'attentive_to_zone' ) ) {
        $data['attentive_to_zone'] = intval( $request->get_param( 'attentive_to_zone' ) );
    }
    if ( $request->has_param( 'posture_adjustment_5min' ) ) {
        $data['posture_adjustment_5min'] = intval( $request->get_param( 'posture_adjustment_5min' ) );
    }
    if ( $request->get_param( 'attachments' ) ) {
        $data['attachments'] = wp_json_encode( $request->get_param( 'attachments' ) );
    }
    
    $inserted = $wpdb->insert( $table_name, $data );
    
    if ( $inserted === false ) {
        error_log( 'Scan audit insert failed. Error: ' . $wpdb->last_error );
        return new WP_Error( 'insert_failed', 'Failed to create scan audit: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    
    // Automatically update promotion progress for the audited user (participated)
    mentorship_platform_pg_check_audit_promotion_progress( $data['audited_user_id'], 'scan_audit', $data['result'] );
    
    // Also track progress for the auditor (conducted)
    mentorship_platform_pg_update_linked_module_progress( $data['auditor_id'], 'scan_audit_conducted', 'conducted' );
    
    return rest_ensure_response( $data );
}

/**
 * Archive a scan audit
 */
function mentorship_platform_pg_archive_scan_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 1 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to archive scan audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => true ) );
}

/**
 * Restore a scan audit
 */
function mentorship_platform_pg_restore_scan_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 0 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to restore scan audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => false ) );
}

/**
 * Bulk archive scan audits
 */
function mentorship_platform_pg_bulk_archive_scan_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 1 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk archive scan audits: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive scan audits: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Bulk restore scan audits
 */
function mentorship_platform_pg_bulk_restore_scan_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 0 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk restore scan audits: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore scan audits: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Update a scan audit
 */
function mentorship_platform_pg_update_scan_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $id = $request->get_param( 'id' );
    
    $data = array();
    
    if ( $request->has_param( 'audited_user_id' ) ) {
        $data['audited_user_id'] = intval( $request->get_param( 'audited_user_id' ) );
    }
    if ( $request->has_param( 'audit_date' ) ) {
        $data['audit_date'] = sanitize_text_field( $request->get_param( 'audit_date' ) );
    }
    if ( $request->has_param( 'location' ) ) {
        $data['location'] = sanitize_text_field( $request->get_param( 'location' ) );
    }
    if ( $request->has_param( 'result' ) ) {
        $data['result'] = sanitize_text_field( $request->get_param( 'result' ) );
    }
    if ( $request->has_param( 'notes' ) ) {
        $data['notes'] = wp_kses_post( $request->get_param( 'notes' ) );
    }
    if ( $request->has_param( 'wearing_correct_uniform' ) ) {
        $data['wearing_correct_uniform'] = intval( $request->get_param( 'wearing_correct_uniform' ) );
    }
    if ( $request->has_param( 'attentive_to_zone' ) ) {
        $data['attentive_to_zone'] = intval( $request->get_param( 'attentive_to_zone' ) );
    }
    if ( $request->has_param( 'posture_adjustment_5min' ) ) {
        $data['posture_adjustment_5min'] = intval( $request->get_param( 'posture_adjustment_5min' ) );
    }
    if ( $request->has_param( 'attachments' ) ) {
        $data['attachments'] = wp_json_encode( $request->get_param( 'attachments' ) );
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_name,
        $data,
        array( 'id' => $id ),
        null,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update scan audit: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    // Get updated record
    $audit = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table_name WHERE id = %d", $id ), ARRAY_A );
    
    return rest_ensure_response( $audit );
}

/**
 * Delete a scan audit
 */
function mentorship_platform_pg_delete_scan_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete(
        $table_name,
        array( 'id' => $id ),
        array( '%d' )
    );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete scan audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}

// --- API Callback Functions: Cashier Observational Audits ---

/**
 * Get cashier audit logs
 */
function mentorship_platform_pg_get_cashier_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    
    $audited_user_id = $request->get_param( 'audited_user_id' );
    $start_date = $request->get_param( 'start_date' );
    $end_date = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' );
    
    $where_clauses = array();
    $where_params = array();
    
    // Filter out archived records by default
    if ( ! $include_archived ) {
        $where_clauses[] = "archived = 0";
    }
    
    if ( $audited_user_id ) {
        $where_clauses[] = "audited_user_id = %d";
        $where_params[] = $audited_user_id;
    }
    
    if ( $start_date ) {
        $where_clauses[] = "audit_date >= %s";
        $where_params[] = $start_date;
    }
    
    if ( $end_date ) {
        $where_clauses[] = "audit_date <= %s";
        $where_params[] = $end_date;
    }
    
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    
    $query = "SELECT * FROM $table_name $where_sql ORDER BY audit_date DESC";
    
    if ( ! empty( $where_params ) ) {
        $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
    } else {
        $results = $wpdb->get_results( $query, ARRAY_A );
    }
    
    // Add user display names and ensure IDs are integers
    foreach ( $results as &$audit ) {
        // Cast ID fields to integers for proper JavaScript comparisons
        $audit['id'] = (int) $audit['id'];
        $audit['audited_user_id'] = (int) $audit['audited_user_id'];
        $audit['auditor_id'] = (int) $audit['auditor_id'];
        
        $audited_user = get_userdata( $audit['audited_user_id'] );
        $auditor = get_userdata( $audit['auditor_id'] );
        
        $audit['audited_user_name'] = $audited_user ? $audited_user->display_name : '';
        $audit['auditor_name'] = $auditor ? $auditor->display_name : '';
    }
    
    return rest_ensure_response( $results );
}

/**
 * Create a new cashier audit
 */
function mentorship_platform_pg_create_cashier_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    
    $data = array(
        'audited_user_id'           => intval( $request->get_param( 'audited_user_id' ) ),
        'auditor_id'                => get_current_user_id(),
        'audit_date'                => sanitize_text_field( $request->get_param( 'audit_date' ) ),
        'checked_cash_drawer'       => sanitize_text_field( $request->get_param( 'checked_cash_drawer' ) ),
        'attentive_patrons_entered' => sanitize_text_field( $request->get_param( 'attentive_patrons_entered' ) ),
        'greeted_with_demeanor'     => sanitize_text_field( $request->get_param( 'greeted_with_demeanor' ) ),
        'one_click_per_person'      => sanitize_text_field( $request->get_param( 'one_click_per_person' ) ),
        'pool_pass_process'         => sanitize_text_field( $request->get_param( 'pool_pass_process' ) ),
        'resolved_patron_concerns'  => wp_kses_post( $request->get_param( 'resolved_patron_concerns' ) ),
        'notes'                     => wp_kses_post( $request->get_param( 'notes' ) ),
        'archived'                  => 0,
    );
    
    $inserted = $wpdb->insert( $table_name, $data );
    
    if ( $inserted === false ) {
        error_log( 'Cashier audit insert failed. Error: ' . $wpdb->last_error );
        return new WP_Error( 'insert_failed', 'Failed to create cashier audit: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    
    return rest_ensure_response( $data );
}

/**
 * Archive a cashier audit
 */
function mentorship_platform_pg_archive_cashier_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 1 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to archive cashier audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => true ) );
}

/**
 * Restore a cashier audit
 */
function mentorship_platform_pg_restore_cashier_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 0 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to restore cashier audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => false ) );
}

/**
 * Bulk archive cashier audits
 */
function mentorship_platform_pg_bulk_archive_cashier_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 1 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk archive cashier audits: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive cashier audits: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Bulk restore cashier audits
 */
function mentorship_platform_pg_bulk_restore_cashier_audits( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 0 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk restore cashier audits: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore cashier audits: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Update a cashier audit
 */
function mentorship_platform_pg_update_cashier_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $id = $request->get_param( 'id' );
    
    $data = array();
    
    if ( $request->has_param( 'audited_user_id' ) ) {
        $data['audited_user_id'] = intval( $request->get_param( 'audited_user_id' ) );
    }
    if ( $request->has_param( 'audit_date' ) ) {
        $data['audit_date'] = sanitize_text_field( $request->get_param( 'audit_date' ) );
    }
    if ( $request->has_param( 'checked_cash_drawer' ) ) {
        $data['checked_cash_drawer'] = sanitize_text_field( $request->get_param( 'checked_cash_drawer' ) );
    }
    if ( $request->has_param( 'attentive_patrons_entered' ) ) {
        $data['attentive_patrons_entered'] = sanitize_text_field( $request->get_param( 'attentive_patrons_entered' ) );
    }
    if ( $request->has_param( 'greeted_with_demeanor' ) ) {
        $data['greeted_with_demeanor'] = sanitize_text_field( $request->get_param( 'greeted_with_demeanor' ) );
    }
    if ( $request->has_param( 'one_click_per_person' ) ) {
        $data['one_click_per_person'] = sanitize_text_field( $request->get_param( 'one_click_per_person' ) );
    }
    if ( $request->has_param( 'pool_pass_process' ) ) {
        $data['pool_pass_process'] = sanitize_text_field( $request->get_param( 'pool_pass_process' ) );
    }
    if ( $request->has_param( 'resolved_patron_concerns' ) ) {
        $data['resolved_patron_concerns'] = wp_kses_post( $request->get_param( 'resolved_patron_concerns' ) );
    }
    if ( $request->has_param( 'notes' ) ) {
        $data['notes'] = wp_kses_post( $request->get_param( 'notes' ) );
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data to update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_name,
        $data,
        array( 'id' => $id ),
        null,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update cashier audit: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    // Get updated record
    $audit = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table_name WHERE id = %d", $id ), ARRAY_A );
    
    return rest_ensure_response( $audit );
}

/**
 * Delete a cashier audit
 */
function mentorship_platform_pg_delete_cashier_audit( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete(
        $table_name,
        array( 'id' => $id ),
        array( '%d' )
    );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete cashier audit', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * Check if user can conduct cashier audits (CREATE)
 */
function mentorship_platform_pg_can_conduct_cashier_audit( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // Check if user has canCreate permission via their job roles
    global $wpdb;
    $user_id = get_current_user_id();
    
    // WordPress admins can always conduct
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    // Get user's job role assignments
    $assignments = $wpdb->get_results( $wpdb->prepare(
        "SELECT job_role_id FROM {$wpdb->prefix}pg_user_job_assignments WHERE user_id = %d",
        $user_id
    ) );
    
    if ( empty( $assignments ) ) {
        return false;
    }
    
    $role_ids = array_map( function( $a ) { return $a->job_role_id; }, $assignments );
    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    
    // Check if any assigned role has canCreate permission
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}pg_cashier_audit_permissions 
         WHERE job_role_id IN ($placeholders) AND can_create = 1",
        ...$role_ids
    ) );
    
    return $has_permission > 0;
}

/**
 * Check if user can edit/delete cashier audits
 */
function mentorship_platform_pg_can_edit_cashier_audit( $request ) {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    $current_user_id = get_current_user_id();
    
    // WordPress admins can edit/delete any record
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    global $wpdb;
    
    // Get user's job role assignments
    $assignments = $wpdb->get_results( $wpdb->prepare(
        "SELECT job_role_id FROM {$wpdb->prefix}pg_user_job_assignments WHERE user_id = %d",
        $current_user_id
    ) );
    
    if ( ! empty( $assignments ) ) {
        $role_ids = array_map( function( $a ) { return $a->job_role_id; }, $assignments );
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        // Check if user has canModerateAll permission
        $can_moderate = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}pg_cashier_audit_permissions 
             WHERE job_role_id IN ($placeholders) AND can_moderate_all = 1",
            ...$role_ids
        ) );
        
        if ( $can_moderate > 0 ) {
            return true;
        }
    }
    
    // Check if user is the auditor of this record (can edit/delete own)
    $record_id = $request->get_param( 'id' );
    if ( $record_id ) {
        $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
        $auditor_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT auditor_id FROM $table_name WHERE id = %d",
            $record_id
        ) );
        
        if ( $auditor_id && intval( $auditor_id ) === $current_user_id ) {
            // Check if user has canEdit permission for their own
            if ( ! empty( $assignments ) ) {
                $can_edit_own = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}pg_cashier_audit_permissions 
                     WHERE job_role_id IN ($placeholders) AND can_edit = 1",
                    ...$role_ids
                ) );
                return $can_edit_own > 0;
            }
        }
    }
    
    return false;
}

/**
 * Check if user can moderate cashier audits (admin or has canModerateAll permission)
 */
function mentorship_platform_pg_can_moderate_cashier_audits() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    
    // WordPress admins can always moderate
    if ( current_user_can( 'manage_options' ) ) {
        return true;
    }
    
    global $wpdb;
    $user_id = get_current_user_id();
    
    // Get user's job role assignments
    $assignments = $wpdb->get_results( $wpdb->prepare(
        "SELECT job_role_id FROM {$wpdb->prefix}pg_user_job_assignments WHERE user_id = %d",
        $user_id
    ) );
    
    if ( empty( $assignments ) ) {
        return false;
    }
    
    $role_ids = array_map( function( $a ) { return $a->job_role_id; }, $assignments );
    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    
    // Check if any assigned role has canModerateAll permission
    $has_permission = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}pg_cashier_audit_permissions 
         WHERE job_role_id IN ($placeholders) AND can_moderate_all = 1",
        ...$role_ids
    ) );
    
    return $has_permission > 0;
}

// --- API Callback Functions: Live Recognition Drills ---

/**
 * Get live recognition drill logs
 */
function mentorship_platform_pg_get_live_drills( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    
    $drilled_user_id = $request->get_param( 'drilled_user_id' );
    $start_date = $request->get_param( 'start_date' );
    $end_date = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' );
    
    $where_clauses = array();
    $where_params = array();
    
    // Filter out archived records by default
    if ( ! $include_archived ) {
        $where_clauses[] = "archived = 0";
    }
    
    if ( $drilled_user_id ) {
        $where_clauses[] = "drilled_user_id = %d";
        $where_params[] = $drilled_user_id;
    }
    
    if ( $start_date ) {
        $where_clauses[] = "drill_date >= %s";
        $where_params[] = $start_date;
    }
    
    if ( $end_date ) {
        $where_clauses[] = "drill_date <= %s";
        $where_params[] = $end_date;
    }
    
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    
    $query = "SELECT * FROM $table_name $where_sql ORDER BY drill_date DESC";
    
    if ( ! empty( $where_params ) ) {
        $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
    } else {
        $results = $wpdb->get_results( $query, ARRAY_A );
    }
    
    // Add user display names and ensure IDs are integers
    foreach ( $results as &$drill ) {
        // Cast ID fields to integers for proper JavaScript comparisons
        $drill['id'] = (int) $drill['id'];
        $drill['drilled_user_id'] = (int) $drill['drilled_user_id'];
        $drill['drill_conductor_id'] = (int) $drill['drill_conductor_id'];
        
        $drilled_user = get_userdata( $drill['drilled_user_id'] );
        $conductor = get_userdata( $drill['drill_conductor_id'] );
        
        $drill['drilled_user_name'] = $drilled_user ? $drilled_user->display_name : '';
        $drill['conductor_name'] = $conductor ? $conductor->display_name : '';
    }
    
    return rest_ensure_response( $results );
}

/**
 * Create a new live recognition drill
 */
function mentorship_platform_pg_create_live_drill( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    
    $data = array(
        'drilled_user_id'    => intval( $request->get_param( 'drilled_user_id' ) ),
        'drill_conductor_id' => get_current_user_id(),
        'drill_date'         => sanitize_text_field( $request->get_param( 'drill_date' ) ),
        'location'           => sanitize_text_field( $request->get_param( 'location' ) ),
        'result'             => sanitize_text_field( $request->get_param( 'result' ) ),
        'notes'              => wp_kses_post( $request->get_param( 'notes' ) ),
    );
    
    $inserted = $wpdb->insert( $table_name, $data );
    
    if ( $inserted === false ) {
        return new WP_Error( 'insert_failed', 'Failed to create live drill', array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    
    // Automatically update promotion progress for the drilled user (participated)
    mentorship_platform_pg_check_audit_promotion_progress( $data['drilled_user_id'], 'live_drill', $data['result'] );
    
    // Also track progress for the conductor (conducted)
    mentorship_platform_pg_update_linked_module_progress( $data['drill_conductor_id'], 'live_drill_conducted', 'conducted' );
    
    return rest_ensure_response( $data );
}

/**
 * Archive a live recognition drill
 */
function mentorship_platform_pg_archive_live_drill( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 1 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to archive live drill', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => true ) );
}

/**
 * Restore a live recognition drill
 */
function mentorship_platform_pg_restore_live_drill( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 0 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to restore live drill', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => false ) );
}

/**
 * Bulk archive live drills
 */
function mentorship_platform_pg_bulk_archive_live_drills( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 1 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk archive live drills: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive live drills: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Bulk restore live drills
 */
function mentorship_platform_pg_bulk_restore_live_drills( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 0 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk restore live drills: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore live drills: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

// ========================
// INSTRUCTOR EVALUATION CALLBACKS
// ========================

/**
 * Get instructor evaluations
 * Users can see evaluations they conducted OR evaluations about them
 * Users with can_moderate_all permission can see all evaluations
 */
function mentorship_platform_pg_get_instructor_evaluations( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    
    $current_user_id = get_current_user_id();
    $evaluated_user_id = $request->get_param( 'evaluated_user_id' );
    $start_date = $request->get_param( 'start_date' );
    $end_date = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' );
    
    // Check if user has moderate_all permission
    $can_moderate_all = mentorship_platform_pg_can_moderate_instructor_evaluations();
    
    $where_clauses = array();
    $where_params = array();
    
    // Filter out archived records by default
    if ( ! $include_archived ) {
        $where_clauses[] = "archived = 0";
    }
    
    // If user cannot moderate all, limit to their own evaluations (conducted or received)
    if ( ! $can_moderate_all ) {
        $where_clauses[] = "(evaluator_id = %d OR evaluated_user_id = %d)";
        $where_params[] = $current_user_id;
        $where_params[] = $current_user_id;
    }
    
    if ( $evaluated_user_id ) {
        $where_clauses[] = "evaluated_user_id = %d";
        $where_params[] = $evaluated_user_id;
    }
    
    if ( $start_date ) {
        $where_clauses[] = "evaluation_date >= %s";
        $where_params[] = $start_date;
    }
    
    if ( $end_date ) {
        $where_clauses[] = "evaluation_date <= %s";
        $where_params[] = $end_date;
    }
    
    $where_sql = ! empty( $where_clauses ) ? 'WHERE ' . implode( ' AND ', $where_clauses ) : '';
    
    $query = "SELECT * FROM $table_name $where_sql ORDER BY evaluation_date DESC";
    
    if ( ! empty( $where_params ) ) {
        $results = $wpdb->get_results( $wpdb->prepare( $query, $where_params ), ARRAY_A );
    } else {
        $results = $wpdb->get_results( $query, ARRAY_A );
    }
    
    // Add user display names and ensure IDs are integers
    foreach ( $results as &$evaluation ) {
        // Cast ID fields to integers for proper JavaScript comparisons
        $evaluation['id'] = (int) $evaluation['id'];
        $evaluation['evaluated_user_id'] = (int) $evaluation['evaluated_user_id'];
        $evaluation['evaluator_id'] = (int) $evaluation['evaluator_id'];
        
        // Cast boolean fields to integers
        $evaluation['command_language'] = (int) $evaluation['command_language'];
        $evaluation['minimizing_downtime'] = (int) $evaluation['minimizing_downtime'];
        $evaluation['periodic_challenges'] = (int) $evaluation['periodic_challenges'];
        $evaluation['provides_feedback'] = (int) $evaluation['provides_feedback'];
        $evaluation['rules_expectations'] = (int) $evaluation['rules_expectations'];
        $evaluation['learning_environment'] = (int) $evaluation['learning_environment'];
        $evaluation['archived'] = (int) $evaluation['archived'];
        
        $evaluated_user = get_userdata( $evaluation['evaluated_user_id'] );
        $evaluator = get_userdata( $evaluation['evaluator_id'] );
        
        $evaluation['evaluated_user_name'] = $evaluated_user ? $evaluated_user->display_name : '';
        $evaluation['evaluator_name'] = $evaluator ? $evaluator->display_name : '';
    }
    
    return rest_ensure_response( $results );
}

/**
 * Create a new instructor evaluation
 */
function mentorship_platform_pg_create_instructor_evaluation( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    
    $data = array(
        'evaluated_user_id'     => intval( $request->get_param( 'evaluated_user_id' ) ),
        'evaluator_id'          => get_current_user_id(),
        'evaluation_date'       => sanitize_text_field( $request->get_param( 'evaluation_date' ) ),
        'command_language'      => intval( $request->get_param( 'command_language' ) ),
        'minimizing_downtime'   => intval( $request->get_param( 'minimizing_downtime' ) ),
        'periodic_challenges'   => intval( $request->get_param( 'periodic_challenges' ) ),
        'provides_feedback'     => intval( $request->get_param( 'provides_feedback' ) ),
        'rules_expectations'    => intval( $request->get_param( 'rules_expectations' ) ),
        'learning_environment'  => intval( $request->get_param( 'learning_environment' ) ),
        'comments'              => wp_kses_post( $request->get_param( 'comments' ) ),
        'archived'              => 0,
    );
    
    $inserted = $wpdb->insert( $table_name, $data );
    
    if ( $inserted === false ) {
        error_log( 'Instructor evaluation insert failed. Error: ' . $wpdb->last_error );
        return new WP_Error( 'insert_failed', 'Failed to create instructor evaluation: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    $data['id'] = $wpdb->insert_id;
    
    return rest_ensure_response( $data );
}

/**
 * Archive an instructor evaluation
 */
function mentorship_platform_pg_archive_instructor_evaluation( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 1 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to archive instructor evaluation', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => true ) );
}

/**
 * Restore an instructor evaluation
 */
function mentorship_platform_pg_restore_instructor_evaluation( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $id = $request->get_param( 'id' );
    
    $updated = $wpdb->update(
        $table_name,
        array( 'archived' => 0 ),
        array( 'id' => $id ),
        array( '%d' ),
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to restore instructor evaluation', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id, 'archived' => false ) );
}

/**
 * Bulk archive instructor evaluations
 */
function mentorship_platform_pg_bulk_archive_instructor_evaluations( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 1 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk archive instructor evaluations: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to archive instructor evaluations: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Bulk restore instructor evaluations
 */
function mentorship_platform_pg_bulk_restore_instructor_evaluations( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $body = json_decode( $request->get_body(), true );
    $ids = $body['ids'] ?? array();
    
    if ( empty( $ids ) || ! is_array( $ids ) ) {
        return new WP_Error( 'invalid_ids', 'Invalid IDs provided', array( 'status' => 400 ) );
    }
    
    // Validate all IDs are numeric
    foreach ( $ids as $id ) {
        if ( ! is_numeric( $id ) ) {
            return new WP_Error( 'invalid_id', 'All IDs must be numeric', array( 'status' => 400 ) );
        }
    }
    
    $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
    $query = $wpdb->prepare( 
        "UPDATE $table_name SET archived = 0 WHERE id IN ($placeholders)",
        ...$ids
    );
    
    $updated = $wpdb->query( $query );
    
    if ( $updated === false ) {
        error_log( 'Failed to bulk restore instructor evaluations: ' . $wpdb->last_error );
        return new WP_Error( 'update_failed', 'Failed to restore instructor evaluations: ' . $wpdb->last_error, array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'updated' => $updated ) );
}

/**
 * Update an instructor evaluation
 */
function mentorship_platform_pg_update_instructor_evaluation( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $id = $request->get_param( 'id' );
    
    $data = array();
    $format = array();
    
    if ( $request->has_param( 'evaluated_user_id' ) ) {
        $data['evaluated_user_id'] = intval( $request->get_param( 'evaluated_user_id' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'evaluation_date' ) ) {
        $data['evaluation_date'] = sanitize_text_field( $request->get_param( 'evaluation_date' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'command_language' ) ) {
        $data['command_language'] = intval( $request->get_param( 'command_language' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'minimizing_downtime' ) ) {
        $data['minimizing_downtime'] = intval( $request->get_param( 'minimizing_downtime' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'periodic_challenges' ) ) {
        $data['periodic_challenges'] = intval( $request->get_param( 'periodic_challenges' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'provides_feedback' ) ) {
        $data['provides_feedback'] = intval( $request->get_param( 'provides_feedback' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'rules_expectations' ) ) {
        $data['rules_expectations'] = intval( $request->get_param( 'rules_expectations' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'learning_environment' ) ) {
        $data['learning_environment'] = intval( $request->get_param( 'learning_environment' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'comments' ) ) {
        $data['comments'] = wp_kses_post( $request->get_param( 'comments' ) );
        $format[] = '%s';
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data provided for update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_name,
        $data,
        array( 'id' => $id ),
        $format,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update instructor evaluation', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Delete an instructor evaluation
 */
function mentorship_platform_pg_delete_instructor_evaluation( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete(
        $table_name,
        array( 'id' => $id ),
        array( '%d' )
    );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete instructor evaluation', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Update a live recognition drill
 */
function mentorship_platform_pg_update_live_drill( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $id = $request->get_param( 'id' );
    
    $data = array();
    $format = array();
    
    if ( $request->has_param( 'drilled_user_id' ) ) {
        $data['drilled_user_id'] = intval( $request->get_param( 'drilled_user_id' ) );
        $format[] = '%d';
    }
    if ( $request->has_param( 'drill_date' ) ) {
        $data['drill_date'] = sanitize_text_field( $request->get_param( 'drill_date' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'location' ) ) {
        $data['location'] = sanitize_text_field( $request->get_param( 'location' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'result' ) ) {
        $data['result'] = sanitize_text_field( $request->get_param( 'result' ) );
        $format[] = '%s';
    }
    if ( $request->has_param( 'notes' ) ) {
        $data['notes'] = wp_kses_post( $request->get_param( 'notes' ) );
        $format[] = '%s';
    }
    
    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'No data provided for update', array( 'status' => 400 ) );
    }
    
    $updated = $wpdb->update(
        $table_name,
        $data,
        array( 'id' => $id ),
        $format,
        array( '%d' )
    );
    
    if ( $updated === false ) {
        return new WP_Error( 'update_failed', 'Failed to update live drill', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Delete a live recognition drill
 */
function mentorship_platform_pg_delete_live_drill( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    $id = $request->get_param( 'id' );
    
    $deleted = $wpdb->delete(
        $table_name,
        array( 'id' => $id ),
        array( '%d' )
    );
    
    if ( $deleted === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete live drill', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array( 'success' => true, 'id' => $id ) );
}

/**
 * Helper function to automatically update promotion progress based on linked module completion
 * Supports: scan_audit, live_recognition_drill, initiative, mentorship_goal, scan_audit_conducted, live_drill_conducted, inservice_attendee, inservice_leader
 */
function mentorship_platform_pg_update_linked_module_progress( $user_id, $type, $result ) {
    global $wpdb;
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // For "_conducted" types, always count (don't check pass/fail)
    $is_conducted = strpos( $type, '_conducted' ) !== false;
    
    if ( ! $is_conducted ) {
        // Only count "completed" or "passed" results for participated types
        // "Passed with Remediation" is also considered a passing result
        $result_lower = strtolower( $result );
        $valid_results = array( 'pass', 'passed', 'completed', 'complete' );
        $is_remediation = strpos( $result_lower, 'remediation' ) !== false;
        if ( ! in_array( $result_lower, $valid_results ) && ! $is_remediation ) {
            return;
        }
    }
    
    // Map type to linked_module value
    $linked_module_map = array(
        'scan_audit'                        => 'scan_audit',
        'scan_audit_conducted'              => 'scan_audit_conducted',
        'live_drill'                        => 'live_recognition_drill',
        'live_drill_conducted'              => 'live_recognition_drill_conducted',
        'initiative'                        => 'initiative',
        'mentorship_goal'                   => 'mentorship_goal',
        'inservice_attendee'                => 'inservice_attendee',
        'inservice_leader'                  => 'inservice_leader',
    );
    
    $linked_module = isset( $linked_module_map[ $type ] ) ? $linked_module_map[ $type ] : $type;
    
    // Find criteria linked to this module type
    $criteria = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, target_value FROM $criteria_table WHERE linked_module = %s",
        $linked_module
    ), ARRAY_A );
    
    foreach ( $criteria as $criterion ) {
        $criterion_id = $criterion['id'];
        $target_value = intval( $criterion['target_value'] );
        
        // Get current progress
        $current_progress = $wpdb->get_row( $wpdb->prepare(
            "SELECT current_value, is_completed FROM $progress_table 
            WHERE user_id = %d AND criterion_id = %d",
            $user_id,
            $criterion_id
        ), ARRAY_A );
        
        if ( $current_progress ) {
            $new_value = intval( $current_progress['current_value'] ) + 1;
            $is_completed = $new_value >= $target_value ? 1 : 0;
            
            $update_data = array( 'current_value' => $new_value );
            
            if ( $is_completed && ! $current_progress['is_completed'] ) {
                $update_data['is_completed'] = 1;
                $update_data['completion_date'] = current_time( 'mysql' );
            }
            
            $wpdb->update( 
                $progress_table, 
                $update_data,
                array( 'user_id' => $user_id, 'criterion_id' => $criterion_id )
            );
        } else {
            // Create new progress record
            $is_completed = 1 >= $target_value ? 1 : 0;
            $insert_data = array(
                'user_id'       => $user_id,
                'criterion_id'  => $criterion_id,
                'current_value' => 1,
                'is_completed'  => $is_completed,
            );
            
            if ( $is_completed ) {
                $insert_data['completion_date'] = current_time( 'mysql' );
            }
            
            $wpdb->insert( $progress_table, $insert_data );
        }
    }
}

/**
 * Backwards compatibility wrapper for audit/drill tracking
 */
function mentorship_platform_pg_check_audit_promotion_progress( $user_id, $type, $result ) {
    mentorship_platform_pg_update_linked_module_progress( $user_id, $type, $result );
}

/**
 * Recalculate in-service attendance/leadership counts for a user
 * This should be called when displaying promotion progress to ensure accurate counts
 */
function mentorship_platform_pg_recalculate_inservice_progress( $user_id ) {
    global $wpdb;
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Count attended sessions
    $attended_count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM $attendees_table WHERE user_id = %d AND attendance_status = 'attended'",
        $user_id
    ) );
    
    // Count led sessions
    $leader_count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM $attendees_table WHERE user_id = %d AND attendance_status = 'leader'",
        $user_id
    ) );
    
    // Update criteria for inservice_attendee
    $attendee_criteria = $wpdb->get_results(
        "SELECT id, target_value FROM $criteria_table WHERE linked_module = 'inservice_attendee'",
        ARRAY_A
    );
    
    foreach ( $attendee_criteria as $criterion ) {
        $criterion_id = $criterion['id'];
        $target_value = intval( $criterion['target_value'] );
        $is_completed = $attended_count >= $target_value ? 1 : 0;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $user_id,
            $criterion_id
        ) );
        
        $data = array(
            'current_value' => $attended_count,
            'is_completed' => $is_completed,
        );
        
        if ( $is_completed ) {
            $data['completion_date'] = current_time( 'mysql' );
        } else {
            // Clear completion date if no longer completed
            $data['completion_date'] = null;
        }
        
        if ( $existing ) {
            $wpdb->update( $progress_table, $data, array( 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
        } else {
            $data['user_id'] = $user_id;
            $data['criterion_id'] = $criterion_id;
            $wpdb->insert( $progress_table, $data );
        }
    }
    
    // Update criteria for inservice_leader
    $leader_criteria = $wpdb->get_results(
        "SELECT id, target_value FROM $criteria_table WHERE linked_module = 'inservice_leader'",
        ARRAY_A
    );
    
    foreach ( $leader_criteria as $criterion ) {
        $criterion_id = $criterion['id'];
        $target_value = intval( $criterion['target_value'] );
        $is_completed = $leader_count >= $target_value ? 1 : 0;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $user_id,
            $criterion_id
        ) );
        
        $data = array(
            'current_value' => $leader_count,
            'is_completed' => $is_completed,
        );
        
        if ( $is_completed ) {
            $data['completion_date'] = current_time( 'mysql' );
        } else {
            // Clear completion date if no longer completed
            $data['completion_date'] = null;
        }
        
        if ( $existing ) {
            $wpdb->update( $progress_table, $data, array( 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
        } else {
            $data['user_id'] = $user_id;
            $data['criterion_id'] = $criterion_id;
            $wpdb->insert( $progress_table, $data );
        }
    }
}

/**
 * Recalculate initiative completion counts for a user
 * This should be called when displaying promotion progress to ensure accurate counts
 */
function mentorship_platform_pg_recalculate_initiative_progress( $user_id ) {
    global $wpdb;
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Count completed initiatives where user is the MENTEE
    // Works for both user-created and admin-created mentorships because both use:
    //   - mentorship.post_author = mentee
    //   - mentorship._receiver_id = mentor
    // Join through: initiative -> goal (_goal_id) -> mentorship (_mentorship_id) -> mentorship post (post_author = mentee)
    
    $initiative_count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(DISTINCT i.ID)
        FROM {$wpdb->posts} i
        INNER JOIN {$wpdb->postmeta} i_status ON i.ID = i_status.post_id AND i_status.meta_key = '_status'
        INNER JOIN {$wpdb->postmeta} i_goal ON i.ID = i_goal.post_id AND i_goal.meta_key = '_goal_id'
        INNER JOIN {$wpdb->postmeta} g_mentorship ON i_goal.meta_value = g_mentorship.post_id AND g_mentorship.meta_key = '_mentorship_id'
        INNER JOIN {$wpdb->posts} m ON g_mentorship.meta_value = m.ID AND m.post_type = 'mp_request'
        WHERE i.post_type = 'mp_initiative'
        AND i_status.meta_value = 'Completed'
        AND i.post_status != 'trash'
        AND m.post_author = %d",
        $user_id
    ) );
    
    // Update criteria for initiative completion
    $initiative_criteria = $wpdb->get_results(
        "SELECT id, target_value FROM $criteria_table WHERE linked_module = 'initiative'",
        ARRAY_A
    );
    
    foreach ( $initiative_criteria as $criterion ) {
        $criterion_id = $criterion['id'];
        $target_value = intval( $criterion['target_value'] );
        $is_completed = $initiative_count >= $target_value ? 1 : 0;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $user_id,
            $criterion_id
        ) );
        
        $data = array(
            'current_value' => $initiative_count,
            'is_completed' => $is_completed,
        );
        
        if ( $is_completed ) {
            $data['completion_date'] = current_time( 'mysql' );
        } else {
            $data['completion_date'] = null;
        }
        
        if ( $existing ) {
            $wpdb->update( $progress_table, $data, array( 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
        } else {
            $data['user_id'] = $user_id;
            $data['criterion_id'] = $criterion_id;
            $wpdb->insert( $progress_table, $data );
        }
    }
}

/**
 * Recalculate mentorship goal initiative counts for a user (as mentor)
 * Counts completed initiatives where the user is the mentor
 */
function mentorship_platform_pg_recalculate_mentorship_goal_progress( $user_id ) {
    global $wpdb;
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Count completed initiatives where user is the mentor
    // This requires joining through: initiative -> goal -> mentorship -> check if user is receiver (mentor)
    $mentor_initiative_count = $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(DISTINCT i.ID)
        FROM {$wpdb->posts} i
        INNER JOIN {$wpdb->postmeta} i_status ON i.ID = i_status.post_id AND i_status.meta_key = '_status'
        INNER JOIN {$wpdb->postmeta} i_goal ON i.ID = i_goal.post_id AND i_goal.meta_key = '_goal_id'
        INNER JOIN {$wpdb->postmeta} g_mentorship ON i_goal.meta_value = g_mentorship.post_id AND g_mentorship.meta_key = '_mentorship_id'
        INNER JOIN {$wpdb->postmeta} m_receiver ON g_mentorship.meta_value = m_receiver.post_id AND m_receiver.meta_key = '_receiver_id'
        WHERE i.post_type = 'mp_initiative'
        AND i_status.meta_value = 'Completed'
        AND i.post_status != 'trash'
        AND m_receiver.meta_value = %d",
        $user_id
    ) );
    
    // Update criteria for mentorship_goal (mentor initiatives)
    $mentor_criteria = $wpdb->get_results(
        "SELECT id, target_value FROM $criteria_table WHERE linked_module = 'mentorship_goal'",
        ARRAY_A
    );
    
    foreach ( $mentor_criteria as $criterion ) {
        $criterion_id = $criterion['id'];
        $target_value = intval( $criterion['target_value'] );
        $is_completed = $mentor_initiative_count >= $target_value ? 1 : 0;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $user_id,
            $criterion_id
        ) );
        
        $data = array(
            'current_value' => $mentor_initiative_count,
            'is_completed' => $is_completed,
        );
        
        if ( $is_completed ) {
            $data['completion_date'] = current_time( 'mysql' );
        } else {
            $data['completion_date'] = null;
        }
        
        if ( $existing ) {
            $wpdb->update( $progress_table, $data, array( 'user_id' => $user_id, 'criterion_id' => $criterion_id ) );
        } else {
            $data['user_id'] = $user_id;
            $data['criterion_id'] = $criterion_id;
            $wpdb->insert( $progress_table, $data );
        }
    }
}

/**
 * Get lightweight team members list (FAST - no progress calculation)
 * GET /pg/team/list
 * 
 * Returns just user IDs, names, emails, and current role - NO progress calculation
 * Cached for 5 minutes to improve performance
 * 
 * Query parameters:
 * - role_id: Filter by specific job role (show users WITHOUT this role)
 * - force_refresh: Skip cache and reload (default: false)
 */
function mentorship_platform_pg_get_team_list( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: GET /team-list START ===');
    
    global $wpdb;
    
    $current_user = wp_get_current_user();
    $current_user_id = $current_user->ID;
    $role_id = $request->get_param('role_id');
    $force_refresh = $request->get_param('force_refresh');
    
    error_log(sprintf('Params: user=%d, role_id=%s, force_refresh=%s',
        $current_user_id, $role_id ?: 'all', $force_refresh ? 'yes' : 'no'));
    
    // Cache key based on role filter and user permissions
    $cache_key = 'mentorship_team_list_' . $current_user_id . '_' . ($role_id ?: 'all');
    
    // Try to get from cache (5 minute expiry)
    if (!$force_refresh) {
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return rest_ensure_response($cached);
        }
    }
    
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Get current user's tier
    $current_tier = $wpdb->get_var( $wpdb->prepare(
        "SELECT r.tier 
         FROM $assignments_table a
         LEFT JOIN $roles_table r ON a.job_role_id = r.id
         WHERE a.user_id = %d
         ORDER BY r.tier DESC
         LIMIT 1",
        $current_user_id
    ) );
    
    $is_wp_admin = current_user_can( 'manage_options' );
    
    if ( $current_tier === null && ! $is_wp_admin ) {
        return rest_ensure_response(array());
    }
    
    $current_tier = $current_tier ? (int) $current_tier : 999;
    
    // Build query - LIGHTWEIGHT, no progress calculation
    if ($role_id) {
        // Show ALL users with job assignments (role filter just affects progress calculation)
        if ( $is_wp_admin && $current_tier === 999 ) {
            $users_query = $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    COALESCE(MAX(r.tier), 0) as tier,
                    COALESCE(MAX(r.title), 'Unassigned') as job_role,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE u.ID != %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC",
                $current_user_id
            );
        } else {
            $users_query = $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    COALESCE(MAX(r.tier), 0) as tier,
                    COALESCE(MAX(r.title), 'Unassigned') as job_role,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE u.ID != %d
                 AND r.tier < %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC",
                $current_user_id,
                $current_tier
            );
        }
    } else {
        // No role filter - show all users with job assignments
        if ( $is_wp_admin && $current_tier === 999 ) {
            $users_query = $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    MAX(r.tier) as tier,
                    MAX(r.title) as job_role,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE u.ID != %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC",
                $current_user_id
            );
        } else {
            $users_query = $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    MAX(r.tier) as tier,
                    MAX(r.title) as job_role,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE r.tier < %d
                 AND u.ID != %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC",
                $current_tier,
                $current_user_id
            );
        }
    }
    
    $users = $wpdb->get_results($users_query, ARRAY_A);
    
    // Determine if user can see email addresses (Tier 4+ or WP admin)
    $can_see_email = $is_wp_admin || ($current_tier >= 4);
    
    // Convert to integers and filter PII based on permissions
    $users = array_map(function($user) use ($can_see_email) {
        $user['id'] = (int) $user['id'];
        $user['tier'] = (int) $user['tier'];
        
        // Remove email if user doesn't have permission to see it
        if (!$can_see_email) {
            unset($user['user_email']);
        }
        
        return $user;
    }, $users);
    
    // Log PII access if fetching user data with emails
    if ($can_see_email && count($users) > 0 && function_exists('mp_log_pii_access')) {
        mp_log_pii_access('team_list', array_column($users, 'id'), '/pg/team/list');
    }
    
    // Cache for 5 minutes
    set_transient($cache_key, $users, 5 * MINUTE_IN_SECONDS);
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== PROFESSIONAL GROWTH API: GET /team-list END - Total: %.2fms, users=%d ===',
        $total_time, count($users)));
    
    return rest_ensure_response($users);
}

/**
 * Get batch progress for multiple users (optimized for performance)
 * GET /pg/team/batch-progress?user_ids=1,2,3&role_id=5
 * 
 * Query parameters:
 * - user_ids: Comma-separated list of user IDs (required)
 * - role_id: Calculate progress toward this specific role (optional)
 * 
 * Returns progress summary for each user - MUCH faster than individual calls
 */
function mentorship_platform_pg_get_batch_progress( $request ) {
    global $wpdb;
    
    $user_ids_param = $request->get_param('user_ids');
    $role_id = $request->get_param('role_id');
    
    if (!$user_ids_param) {
        return new WP_Error('missing_param', 'user_ids parameter is required', array('status' => 400));
    }
    
    // Parse user IDs
    $user_ids = array_map('intval', explode(',', $user_ids_param));
    $user_ids = array_filter($user_ids); // Remove zeros
    
    if (empty($user_ids)) {
        return rest_ensure_response(array());
    }
    
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    $user_ids_placeholder = implode(',', $user_ids);
    
    // Determine which role to track progress for
    if ($role_id) {
        // Progress toward specific role
        $target_role_id = (int) $role_id;
        
        // Get total criteria for target role
        $total_criteria = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $criteria_table WHERE job_role_id = %d",
            $target_role_id
        ) );
        
        // Get completed criteria for all users toward target role
        $completed_results = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT p.user_id, COUNT(*) as completed
                 FROM $progress_table p
                 INNER JOIN $criteria_table c ON p.criterion_id = c.id
                 WHERE p.user_id IN ($user_ids_placeholder)
                 AND c.job_role_id = %d
                 AND p.is_completed = 1
                 GROUP BY p.user_id",
                $target_role_id
            ),
            ARRAY_A
        );
        
        $completed_map = array();
        foreach ($completed_results as $row) {
            $completed_map[(int) $row['user_id']] = (int) $row['completed'];
        }
        
        // Build response for each user
        $result = array();
        foreach ($user_ids as $uid) {
            $completed = isset($completed_map[$uid]) ? $completed_map[$uid] : 0;
            $percentage = $total_criteria > 0 ? round(($completed / $total_criteria) * 100) : 0;
            
            $result[] = array(
                'user_id' => $uid,
                'progress' => array(
                    'completed' => $completed,
                    'total' => $total_criteria,
                    'percentage' => $percentage,
                ),
            );
        }
        
        return rest_ensure_response($result);
        
    } else {
        // Progress toward their current highest role
        // Get user roles
        $user_roles = $wpdb->get_results(
            "SELECT a.user_id, a.job_role_id
             FROM $assignments_table a
             INNER JOIN $roles_table r ON a.job_role_id = r.id
             WHERE a.user_id IN ($user_ids_placeholder)
             ORDER BY r.tier DESC",
            ARRAY_A
        );
        
        $user_role_map = array();
        foreach ($user_roles as $role) {
            $uid = (int) $role['user_id'];
            if (!isset($user_role_map[$uid])) {
                $user_role_map[$uid] = (int) $role['job_role_id'];
            }
        }
        
        // Get unique role IDs
        $role_ids = array_unique(array_values($user_role_map));
        
        if (empty($role_ids)) {
            // No roles, return empty progress
            $result = array();
            foreach ($user_ids as $uid) {
                $result[] = array(
                    'user_id' => $uid,
                    'progress' => array('completed' => 0, 'total' => 0, 'percentage' => 0),
                );
            }
            return rest_ensure_response($result);
        }
        
        $role_ids_placeholder = implode(',', $role_ids);
        
        // Get criteria counts per role
        $role_criteria_counts = $wpdb->get_results(
            "SELECT job_role_id, COUNT(*) as total
             FROM $criteria_table
             WHERE job_role_id IN ($role_ids_placeholder)
             GROUP BY job_role_id",
            ARRAY_A
        );
        
        $criteria_count_map = array();
        foreach ($role_criteria_counts as $row) {
            $criteria_count_map[(int) $row['job_role_id']] = (int) $row['total'];
        }
        
        // Get completed criteria per user
        $user_completed = $wpdb->get_results(
            "SELECT p.user_id, c.job_role_id, COUNT(*) as completed
             FROM $progress_table p
             INNER JOIN $criteria_table c ON p.criterion_id = c.id
             WHERE p.user_id IN ($user_ids_placeholder)
             AND p.is_completed = 1
             GROUP BY p.user_id, c.job_role_id",
            ARRAY_A
        );
        
        $completed_map = array();
        foreach ($user_completed as $row) {
            $key = $row['user_id'] . '_' . $row['job_role_id'];
            $completed_map[$key] = (int) $row['completed'];
        }
        
        // Build response
        $result = array();
        foreach ($user_ids as $uid) {
            if (!isset($user_role_map[$uid])) {
                $result[] = array(
                    'user_id' => $uid,
                    'progress' => array('completed' => 0, 'total' => 0, 'percentage' => 0),
                );
                continue;
            }
            
            $job_role_id = $user_role_map[$uid];
            $total = isset($criteria_count_map[$job_role_id]) ? $criteria_count_map[$job_role_id] : 0;
            $completed_key = $uid . '_' . $job_role_id;
            $completed = isset($completed_map[$completed_key]) ? $completed_map[$completed_key] : 0;
            $percentage = $total > 0 ? round(($completed / $total) * 100) : 0;
            
            $result[] = array(
                'user_id' => $uid,
                'progress' => array(
                    'completed' => $completed,
                    'total' => $total,
                    'percentage' => $percentage,
                ),
            );
        }
        
        return rest_ensure_response($result);
    }
}

/**
 * Get team members (direct reports) with their promotion progress
 * GET /pg/team
 * Supports pagination and role filtering via query parameters:
 * - role_id: Filter by specific job role
 * - page: Page number (default: 1)
 * - per_page: Items per page (default: 25, max: 100)
 * 
 * NOTE: This endpoint is SLOW due to progress calculation
 * Consider using /pg/team/list for initial load, then fetch progress separately
 */
function mentorship_platform_pg_get_team_members( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: GET /team-members START ===');
    
    global $wpdb;
    
    $current_user = wp_get_current_user();
    $current_user_id = $current_user->ID;
    
    // Get pagination parameters
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 25)));
    $offset = ($page - 1) * $per_page;
    
    // Get role filter
    $role_id = $request->get_param('role_id');
    
    error_log(sprintf('Params: user=%d, role_id=%s, page=%d, per_page=%d',
        $current_user_id, $role_id ?: 'all', $page, $per_page));
    
    // Get current user's tier from their job assignment (DECOUPLED from WordPress roles)
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    $current_tier = $wpdb->get_var( $wpdb->prepare(
        "SELECT r.tier 
         FROM $assignments_table a
         LEFT JOIN $roles_table r ON a.job_role_id = r.id
         WHERE a.user_id = %d
         ORDER BY r.tier DESC
         LIMIT 1",
        $current_user_id
    ) );
    
    // WordPress administrators without a job role can see all users with job roles
    $is_wp_admin = current_user_can( 'manage_options' );
    
    if ( $current_tier === null && ! $is_wp_admin ) {
        // Regular users without tier can't see team members
        return new WP_REST_Response(array(), 200);
    }
    
    $current_tier = $current_tier ? (int) $current_tier : 999; // WP admins get highest tier
    
    // CRITICAL BUSINESS LOGIC: Team Progress shows PROMOTION CANDIDATES
    // When a role_id filter is applied, we show users who DON'T have that role
    // (i.e., people working TOWARD that role, not people who already have it)
    
    // Get count for pagination
    if ($role_id) {
        // Show users WITHOUT the selected role (promotion candidates)
        if ( $is_wp_admin && $current_tier === 999 ) {
            $count_query = $wpdb->prepare(
                "SELECT COUNT(DISTINCT u.ID)
                 FROM {$wpdb->users} u
                 LEFT JOIN $assignments_table a ON u.ID = a.user_id AND a.job_role_id = %d
                 WHERE u.ID != %d
                 AND a.id IS NULL",
                $role_id,
                $current_user_id
            );
        } else {
            $count_query = $wpdb->prepare(
                "SELECT COUNT(DISTINCT u.ID)
                 FROM {$wpdb->users} u
                 LEFT JOIN $assignments_table a ON u.ID = a.user_id AND a.job_role_id = %d
                 LEFT JOIN $assignments_table a2 ON u.ID = a2.user_id
                 LEFT JOIN $roles_table r ON a2.job_role_id = r.id
                 WHERE u.ID != %d
                 AND a.id IS NULL
                 AND (r.tier < %d OR r.tier IS NULL)",
                $role_id,
                $current_user_id,
                $current_tier
            );
        }
    } else {
        // No role filter - show all users with job assignments below current tier
        if ( $is_wp_admin && $current_tier === 999 ) {
            $count_query = $wpdb->prepare(
                "SELECT COUNT(DISTINCT u.ID)
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE u.ID != %d",
                $current_user_id
            );
        } else {
            $count_query = $wpdb->prepare(
                "SELECT COUNT(DISTINCT u.ID)
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE r.tier < %d
                 AND u.ID != %d",
                $current_tier,
                $current_user_id
            );
        }
    }
    $total_users = $wpdb->get_var($count_query);
    
    // Get users based on role filter
    // CRITICAL: When role_id is set, show users WITHOUT that role (promotion candidates)
    if ($role_id) {
        // Show users who DON'T have the selected role (promotion candidates for that role)
        if ( $is_wp_admin && $current_tier === 999 ) {
            $team_members_query = $wpdb->get_results( $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    COALESCE(MAX(r.tier), 0) as tier,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 LEFT JOIN $assignments_table a_exclude ON u.ID = a_exclude.user_id AND a_exclude.job_role_id = %d
                 LEFT JOIN $assignments_table a_current ON u.ID = a_current.user_id
                 LEFT JOIN $roles_table r ON a_current.job_role_id = r.id
                 WHERE u.ID != %d
                 AND a_exclude.id IS NULL
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC
                 LIMIT %d OFFSET %d",
                $role_id,
                $current_user_id,
                $per_page,
                $offset
            ), ARRAY_A );
        } else {
            // Show users without selected role AND with tier below current user
            $team_members_query = $wpdb->get_results( $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    COALESCE(MAX(r.tier), 0) as tier,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 LEFT JOIN $assignments_table a_exclude ON u.ID = a_exclude.user_id AND a_exclude.job_role_id = %d
                 LEFT JOIN $assignments_table a_current ON u.ID = a_current.user_id
                 LEFT JOIN $roles_table r ON a_current.job_role_id = r.id
                 WHERE u.ID != %d
                 AND a_exclude.id IS NULL
                 AND (r.tier < %d OR r.tier IS NULL)
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC
                 LIMIT %d OFFSET %d",
                $role_id,
                $current_user_id,
                $current_tier,
                $per_page,
                $offset
            ), ARRAY_A );
        }
    } else {
        // No role filter - show all users with job assignments below current tier
        if ( $is_wp_admin && $current_tier === 999 ) {
            // WP admin without job role - see ALL users with job assignments
            $team_members_query = $wpdb->get_results( $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    MAX(r.tier) as tier,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE u.ID != %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC
                 LIMIT %d OFFSET %d",
                $current_user_id,
                $per_page,
                $offset
            ), ARRAY_A );
        } else {
            // Regular users or admins with job roles - see users with lower tiers
            $team_members_query = $wpdb->get_results( $wpdb->prepare(
                "SELECT DISTINCT 
                    u.ID as id,
                    u.display_name,
                    u.user_email,
                    u.user_login,
                    MAX(r.tier) as tier,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
                    (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
                 FROM {$wpdb->users} u
                 INNER JOIN $assignments_table a ON u.ID = a.user_id
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE r.tier < %d
                 AND u.ID != %d
                 GROUP BY u.ID, u.display_name, u.user_email, u.user_login
                 ORDER BY last_name ASC, first_name ASC
                 LIMIT %d OFFSET %d",
                $current_tier,
                $current_user_id,
                $per_page,
                $offset
            ), ARRAY_A );
        }
    }
    
    $team_members = array_map(function($member) {
        $member['tier'] = (int) $member['tier'];
        $member['id'] = (int) $member['id'];
        return $member;
    }, $team_members_query);
    
    // CRITICAL BUSINESS LOGIC: Calculate progress toward SELECTED role (if filtered)
    // or current role (if no filter)
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Get all user IDs for batch queries
    $user_ids = array_column($team_members, 'id');
    
    if (!empty($user_ids)) {
        $user_ids_placeholder = implode(',', array_map('intval', $user_ids));
        
        // Determine which role to track progress for
        if ($role_id) {
            // Role filter is active: Show progress toward THAT specific role
            $target_role_id = (int) $role_id;
            
            // Get the role details
            $target_role = $wpdb->get_row( $wpdb->prepare(
                "SELECT id, title, tier FROM $roles_table WHERE id = %d",
                $target_role_id
            ), ARRAY_A );
            
            if ($target_role) {
                // Get total criteria for target role
                $total_criteria = (int) $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM $criteria_table WHERE job_role_id = %d",
                    $target_role_id
                ) );
                
                // Batch query: Get completed criteria for all users toward target role
                $user_completed = $wpdb->get_results(
                    $wpdb->prepare(
                        "SELECT p.user_id, COUNT(*) as completed
                         FROM $progress_table p
                         INNER JOIN $criteria_table c ON p.criterion_id = c.id
                         WHERE p.user_id IN ($user_ids_placeholder)
                         AND c.job_role_id = %d
                         AND p.is_completed = 1
                         GROUP BY p.user_id",
                        $target_role_id
                    ),
                    ARRAY_A
                );
                
                $completed_map = array();
                foreach ($user_completed as $row) {
                    $completed_map[(int) $row['user_id']] = (int) $row['completed'];
                }
                
                // Get current roles for each user (for display purposes)
                $user_roles = $wpdb->get_results(
                    "SELECT a.user_id, r.title as job_role_title, r.tier
                     FROM $assignments_table a
                     INNER JOIN $roles_table r ON a.job_role_id = r.id
                     WHERE a.user_id IN ($user_ids_placeholder)
                     ORDER BY r.tier DESC",
                    ARRAY_A
                );
                
                $user_role_map = array();
                foreach ($user_roles as $role) {
                    $uid = (int) $role['user_id'];
                    if (!isset($user_role_map[$uid])) {
                        $user_role_map[$uid] = $role['job_role_title'];
                    }
                }
                
                // Populate progress for each member toward target role
                foreach ($team_members as &$member) {
                    $user_id = $member['id'];
                    $completed_criteria = isset($completed_map[$user_id]) ? $completed_map[$user_id] : 0;
                    $percentage = $total_criteria > 0 ? round(($completed_criteria / $total_criteria) * 100) : 0;
                    
                    $member['progress'] = array(
                        'completed' => $completed_criteria,
                        'total' => $total_criteria,
                        'percentage' => $percentage,
                    );
                    $member['job_role'] = isset($user_role_map[$user_id]) ? $user_role_map[$user_id] : 'Unassigned';
                    $member['tracking_role'] = $target_role['title']; // What role they're working toward
                }
            } else {
                // Role not found
                foreach ($team_members as &$member) {
                    $member['progress'] = array('completed' => 0, 'total' => 0, 'percentage' => 0);
                    $member['job_role'] = null;
                    $member['tracking_role'] = null;
                }
            }
        } else {
            // No role filter: Show progress toward their current highest role
            // Batch query: Get highest tier job role for all users
            $user_roles = $wpdb->get_results(
                "SELECT a.user_id, a.job_role_id, r.title as job_role_title, r.tier
                 FROM $assignments_table a
                 INNER JOIN $roles_table r ON a.job_role_id = r.id
                 WHERE a.user_id IN ($user_ids_placeholder)
                 ORDER BY r.tier DESC",
                ARRAY_A
            );
            
            // Group by user_id (take highest tier per user)
            $user_role_map = array();
            foreach ($user_roles as $role) {
                $uid = (int) $role['user_id'];
                if (!isset($user_role_map[$uid])) {
                    $user_role_map[$uid] = $role;
                }
            }
            
            // Get unique role IDs
            $role_ids = array_unique(array_column($user_role_map, 'job_role_id'));
            
            if (!empty($role_ids)) {
                $role_ids_placeholder = implode(',', array_map('intval', $role_ids));
                
                // Batch query: Get total criteria count per role
                $role_criteria_counts = $wpdb->get_results(
                    "SELECT job_role_id, COUNT(*) as total
                     FROM $criteria_table
                     WHERE job_role_id IN ($role_ids_placeholder)
                     GROUP BY job_role_id",
                    ARRAY_A
                );
                
                $criteria_count_map = array();
                foreach ($role_criteria_counts as $row) {
                    $criteria_count_map[(int) $row['job_role_id']] = (int) $row['total'];
                }
                
                // Batch query: Get completed criteria count per user
                $user_completed = $wpdb->get_results(
                    "SELECT p.user_id, c.job_role_id, COUNT(*) as completed
                     FROM $progress_table p
                     INNER JOIN $criteria_table c ON p.criterion_id = c.id
                     WHERE p.user_id IN ($user_ids_placeholder)
                     AND p.is_completed = 1
                     GROUP BY p.user_id, c.job_role_id",
                    ARRAY_A
                );
                
                $completed_map = array();
                foreach ($user_completed as $row) {
                    $key = $row['user_id'] . '_' . $row['job_role_id'];
                    $completed_map[$key] = (int) $row['completed'];
                }
                
                // Now populate progress for each member
                foreach ($team_members as &$member) {
                    $user_id = $member['id'];
                    
                    if (!isset($user_role_map[$user_id])) {
                        $member['progress'] = array('completed' => 0, 'total' => 0, 'percentage' => 0);
                        $member['job_role'] = 'Unassigned';
                        continue;
                    }
                    
                    $job_role_id = (int) $user_role_map[$user_id]['job_role_id'];
                    $member['job_role'] = $user_role_map[$user_id]['job_role_title'];
                    
                    $total_criteria = isset($criteria_count_map[$job_role_id]) ? $criteria_count_map[$job_role_id] : 0;
                    $completed_key = $user_id . '_' . $job_role_id;
                    $completed_criteria = isset($completed_map[$completed_key]) ? $completed_map[$completed_key] : 0;
                    
                    $percentage = $total_criteria > 0 ? round(($completed_criteria / $total_criteria) * 100) : 0;
                    
                    $member['progress'] = array(
                        'completed' => $completed_criteria,
                        'total' => $total_criteria,
                        'percentage' => $percentage,
                    );
                }
            } else {
                // No roles found for any users
                foreach ($team_members as &$member) {
                    $member['progress'] = array('completed' => 0, 'total' => 0, 'percentage' => 0);
                    $member['job_role'] = 'Unassigned';
                }
            }
        }
    }
    
    // Prepare paginated response
    $total_pages = ceil($total_users / $per_page);
    $response = new WP_REST_Response($team_members, 200);
    $response->header('X-WP-Total', $total_users);
    $response->header('X-WP-TotalPages', $total_pages);
    $response->header('X-WP-Page', $page);
    $response->header('X-WP-PerPage', $per_page);
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== PROFESSIONAL GROWTH API: GET /team-members END - Total: %.2fms, members=%d ===',
        $total_time, count($team_members)));
    
    return $response;
}

/**
 * Get detailed progress for a team member across all job roles
 * Shows progress for roles at or above their current tier (aspiring roles)
 * 
 * NOTE: In-service progress is recalculated automatically when in-service logs are created/updated,
 * so we don't need to recalculate on every view (huge performance improvement)
 */
function mentorship_platform_pg_get_team_member_detailed_progress( $request ) {
    $start_time = microtime(true);
    error_log('=== PROFESSIONAL GROWTH API: GET /team-member-detailed-progress START ===');
    
    global $wpdb;
    
    $user_id = intval( $request->get_param( 'user_id' ) );
    error_log(sprintf('Params: target_user=%d', $user_id));
    
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $progress_table = $wpdb->prefix . 'pg_user_progress';
    
    // Get user's assigned job role IDs (they may have multiple assignments)
    $assigned_role_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ) );
    
    // Get user's current highest tier
    $current_tier = $wpdb->get_var( $wpdb->prepare(
        "SELECT MAX(r.tier)
         FROM $assignments_table a
         INNER JOIN $roles_table r ON a.job_role_id = r.id
         WHERE a.user_id = %d",
        $user_id
    ) );
    
    if ( ! $current_tier ) {
        $current_tier = 0; // No current role
    }
    
    // Get all job roles (showing all roles for comprehensive view)
    // Users can see progress for all roles, as they may be working towards higher tiers
    $job_roles = $wpdb->get_results(
        "SELECT id, title, tier, inservice_hours
         FROM $roles_table
         ORDER BY tier ASC",
        ARRAY_A
    );
    
    $progress_by_role = array();
    
    error_log( "mentorship_platform_pg_get_team_member_detailed_progress: Loading progress for user_id=$user_id, found " . count($job_roles) . " job roles" );
    
    foreach ( $job_roles as $role ) {
        $job_role_id = $role['id'];
        
        // Get all criteria for this role with user's progress
        $query_sql = $wpdb->prepare(
            "SELECT c.id, c.title, c.description, c.criterion_type, c.target_value,
                    COALESCE(p.current_value, 0) as current_value, 
                    COALESCE(p.is_completed, 0) as is_completed, 
                    p.completion_date, p.notes, p.file_url
             FROM $criteria_table c
             LEFT JOIN $progress_table p ON c.id = p.criterion_id AND p.user_id = %d
             WHERE c.job_role_id = %d
             ORDER BY c.sort_order ASC, c.id ASC",
            $user_id,
            $job_role_id
        );
        
        error_log( "  SQL Query: " . $query_sql );
        $criteria = $wpdb->get_results( $query_sql, ARRAY_A );
        error_log( "  Role {$role['title']} (ID=$job_role_id): Found " . count($criteria) . " criteria" );
        if ( $wpdb->last_error ) {
            error_log( "  SQL ERROR: " . $wpdb->last_error );
        }
        
        // Debug: check if criteria exist for this role at all
        if ( count($criteria) === 0 ) {
            $criteria_count_check = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM $criteria_table WHERE job_role_id = %d",
                $job_role_id
            ) );
            error_log( "    DEBUG: Direct count query shows $criteria_count_check criteria for job_role_id=$job_role_id" );
            
            // Check if any criteria exist at all
            $total_criteria = $wpdb->get_var( "SELECT COUNT(*) FROM $criteria_table" );
            error_log( "    DEBUG: Total criteria in database: $total_criteria" );
            
            // Check the actual job_role_id values in criteria table
            $role_ids_in_criteria = $wpdb->get_col( "SELECT DISTINCT job_role_id FROM $criteria_table ORDER BY job_role_id" );
            error_log( "    DEBUG: job_role_id values in criteria table: " . implode(', ', $role_ids_in_criteria) );
        }
        
        // Calculate progress summary
        $total = count( $criteria );
        $completed = 0;
        
        foreach ( $criteria as &$criterion ) {
            // Convert numeric fields
            $criterion['id'] = (int) $criterion['id'];
            $criterion['target_value'] = $criterion['target_value'] ? (int) $criterion['target_value'] : null;
            $criterion['current_value'] = $criterion['current_value'] ? (int) $criterion['current_value'] : null;
            $criterion['is_completed'] = (bool) $criterion['is_completed'];
            
            if ( $criterion['is_completed'] ) {
                $completed++;
            }
        }
        
        $percentage = $total > 0 ? round( ( $completed / $total ) * 100 ) : 0;
        
        // Check if this specific job role is assigned to the user (not just same tier)
        $is_assigned = in_array( $job_role_id, $assigned_role_ids, true );
        
        $progress_by_role[] = array(
            'job_role_id' => (int) $job_role_id,
            'job_role_title' => $role['title'],
            'tier' => (int) $role['tier'],
            'inservice_hours' => $role['inservice_hours'] ? (int) $role['inservice_hours'] : null,
            'is_current_role' => $is_assigned,
            'progress' => array(
                'completed' => $completed,
                'total' => $total,
                'percentage' => $percentage,
            ),
            'criteria' => $criteria,
        );
    }
    
    error_log( "mentorship_platform_pg_get_team_member_detailed_progress: Returning " . count($progress_by_role) . " roles in response" );
    
    $total_time = (microtime(true) - $start_time) * 1000;
    error_log(sprintf('=== PROFESSIONAL GROWTH API: GET /team-member-detailed-progress END - Total: %.2fms, roles=%d ===',
        $total_time, count($progress_by_role)));
    
    return rest_ensure_response( array(
        'user_id' => $user_id,
        'current_tier' => (int) $current_tier,
        'roles' => $progress_by_role,
    ) );
}

/**
 * Get all user job assignments or filter by user_id
 * GET /pg/user-assignments
 */
function mentorship_platform_pg_get_user_assignments( $request ) {
    global $wpdb;
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $user_id = $request->get_param( 'user_id' );
    
    if ( $user_id ) {
        // Get all assignments for this user (supports multiple roles)
        $assignments = $wpdb->get_results( $wpdb->prepare(
            "SELECT a.*, r.title as job_role_title, r.tier, r.inservice_hours
             FROM $assignments_table a
             LEFT JOIN $roles_table r ON a.job_role_id = r.id
             WHERE a.user_id = %d
             ORDER BY a.assigned_date DESC",
            $user_id
        ), ARRAY_A );
        
        // Cast numeric fields to int for consistent frontend matching
        $assignments = array_map( function( $a ) {
            $a['id'] = (int) $a['id'];
            $a['user_id'] = (int) $a['user_id'];
            $a['job_role_id'] = (int) $a['job_role_id'];
            $a['tier'] = isset( $a['tier'] ) ? (int) $a['tier'] : null;
            $a['inservice_hours'] = isset( $a['inservice_hours'] ) ? (float) $a['inservice_hours'] : null;
            return $a;
        }, $assignments ?: array() );
        
        return rest_ensure_response( $assignments );
    }
    
    // Get all assignments
    $assignments = $wpdb->get_results(
        "SELECT a.*, r.title as job_role_title, r.tier, u.display_name, u.user_email
         FROM $assignments_table a
         LEFT JOIN $roles_table r ON a.job_role_id = r.id
         LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
         ORDER BY a.assigned_date DESC",
        ARRAY_A
    );
    
    // Cast numeric fields to int for consistent frontend matching
    $assignments = array_map( function( $a ) {
        $a['id'] = (int) $a['id'];
        $a['user_id'] = (int) $a['user_id'];
        $a['job_role_id'] = (int) $a['job_role_id'];
        $a['tier'] = isset( $a['tier'] ) ? (int) $a['tier'] : null;
        return $a;
    }, $assignments ?: array() );
    
    return rest_ensure_response( $assignments );
}

/**
 * Get a specific user's job assignment
 * GET /pg/user-assignments/{user_id}
 */
function mentorship_platform_pg_get_user_assignment( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param( 'user_id' );
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    $assignment = $wpdb->get_row( $wpdb->prepare(
        "SELECT a.*, r.title as job_role_title, r.tier
         FROM $assignments_table a
         LEFT JOIN $roles_table r ON a.job_role_id = r.id
         WHERE a.user_id = %d",
        $user_id
    ), ARRAY_A );
    
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'No job assignment found for this user', array( 'status' => 404 ) );
    }
    
    return rest_ensure_response( $assignment );
}

/**
 * Assign a user to a job role (with optional WP role sync)
 * POST /pg/user-assignments
 */
function mentorship_platform_pg_assign_user_to_role( $request ) {
    global $wpdb;
    
    $user_id = $request->get_param( 'user_id' );
    $job_role_id = $request->get_param( 'job_role_id' );
    $sync_wp_role = $request->get_param( 'sync_wp_role' );
    $notes = $request->get_param( 'notes' );
    $current_user = wp_get_current_user();
    
    // Validate user exists
    $user = get_user_by( 'id', $user_id );
    if ( ! $user ) {
        return new WP_Error( 'invalid_user', 'User does not exist', array( 'status' => 400 ) );
    }
    
    // Validate job role exists
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $job_role = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $roles_table WHERE id = %d",
        $job_role_id
    ), ARRAY_A );
    
    if ( ! $job_role ) {
        return new WP_Error( 'invalid_role', 'Job role does not exist', array( 'status' => 400 ) );
    }
    
    // Check if user is administrator - warn but allow
    $is_admin = in_array( 'administrator', $user->roles );
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Check if this specific user+role combination already exists
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $assignments_table WHERE user_id = %d AND job_role_id = %d",
        $user_id,
        $job_role_id
    ) );
    
    if ( $existing ) {
        return new WP_Error( 'duplicate_assignment', 'User already has this job role assigned', array( 'status' => 400 ) );
    }
    
    // Insert new assignment (always insert, never update - allows multiple)
    $data = array(
        'user_id'       => $user_id,
        'job_role_id'   => $job_role_id,
        'assigned_by'   => $current_user->ID,
        'assigned_date' => current_time( 'mysql' ),
        'notes'         => $notes,
    );
    
    $wpdb->insert( $assignments_table, $data );
    $assignment_id = $wpdb->insert_id;
    
    // Invalidate user tier and permissions cache for this user
    mentorship_platform_clear_user_permissions_cache( $user_id );
    
    // Invalidate user list cache since job roles are included in user data
    if ( function_exists( 'mp_invalidate_user_caches' ) ) {
        mp_invalidate_user_caches( $user_id );
    }
    
    // Invalidate pay cache for this user since role affects pay
    if ( class_exists( 'Seasonal_Returns' ) ) {
        Seasonal_Returns::invalidate_pay_cache( $user_id );
    }
    
    // Job roles are decoupled from WordPress roles - no sync needed
    
    return rest_ensure_response( array(
        'success' => true,
        'assignment_id' => $assignment_id,
        'user_id' => $user_id,
        'job_role_id' => $job_role_id,
        'admin_protected' => $is_admin,
    ) );
}

/**
 * Update a user's job assignment
 * PUT /pg/user-assignments/{user_id}
 */
function mentorship_platform_pg_update_user_assignment( $request ) {
    // For multiple assignments, we don't update - we add new ones
    // This is kept for backward compatibility but not recommended
    return new WP_Error( 'deprecated', 'Use POST to add new assignments and DELETE to remove specific ones', array( 'status' => 400 ) );
}

/**
 * Remove a user's job assignment by assignment ID
 * DELETE /pg/user-assignments/{assignment_id}
 */
function mentorship_platform_pg_delete_user_assignment( $request ) {
    global $wpdb;
    
    $assignment_id = $request->get_param( 'user_id' ); // Route parameter is still user_id for backward compatibility
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Get the assignment first to know the user_id for WP role sync
    $assignment = $wpdb->get_row( $wpdb->prepare(
        "SELECT user_id FROM $assignments_table WHERE id = %d",
        $assignment_id
    ), ARRAY_A );
    
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'No assignment found to delete', array( 'status' => 404 ) );
    }
    
    $user_id = $assignment['user_id'];
    
    $deleted = $wpdb->delete(
        $assignments_table,
        array( 'id' => $assignment_id ),
        array( '%d' )
    );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete assignment', array( 'status' => 500 ) );
    }
    
    // Invalidate user tier and permissions cache for this user
    mentorship_platform_clear_user_permissions_cache( $user_id );
    
    // Invalidate user list cache since job roles are included in user data
    if ( function_exists( 'mp_invalidate_user_caches' ) ) {
        mp_invalidate_user_caches( $user_id );
    }
    
    // Invalidate pay cache for this user since role affects pay
    if ( class_exists( 'Seasonal_Returns' ) ) {
        Seasonal_Returns::invalidate_pay_cache( $user_id );
    }
    
    // Job roles are decoupled from WordPress roles - no sync needed
    
    return rest_ensure_response( array(
        'success' => true,
        'assignment_id' => $assignment_id,
        'user_id' => $user_id,
    ) );
}

// REMOVED: mentorship_platform_pg_sync_wp_role_to_highest() function
// Job roles are now completely decoupled from WordPress roles.
// WordPress roles should be managed independently through WordPress user management.

/**
 * Remove a specific assignment by assignment ID
 * DELETE /pg/assignments/{assignment_id}
 */
function mentorship_platform_pg_delete_assignment_by_id( $request ) {
    global $wpdb;
    
    $assignment_id = $request->get_param( 'assignment_id' );
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Get the assignment first to know the user_id for WP role sync
    $assignment = $wpdb->get_row( $wpdb->prepare(
        "SELECT user_id FROM $assignments_table WHERE id = %d",
        $assignment_id
    ), ARRAY_A );
    
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'No assignment found to delete', array( 'status' => 404 ) );
    }
    
    $user_id = $assignment['user_id'];
    
    $deleted = $wpdb->delete(
        $assignments_table,
        array( 'id' => $assignment_id ),
        array( '%d' )
    );
    
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Failed to delete assignment', array( 'status' => 500 ) );
    }
    
    // Invalidate user tier and permissions cache for this user
    mentorship_platform_clear_user_permissions_cache( $user_id );
    
    // Invalidate user list cache since job roles are included in user data
    if ( function_exists( 'mp_invalidate_user_caches' ) ) {
        mp_invalidate_user_caches( $user_id );
    }
    
    // Job roles are decoupled from WordPress roles - no sync needed
    
    return rest_ensure_response( array(
        'success' => true,
        'assignment_id' => $assignment_id,
        'user_id' => $user_id,
    ) );
}

// ============================================================================
// Compliance Report Functions
// ============================================================================

/**
 * Get Scan Audit Compliance Report
 * GET /pg/reports/scan-audits?start_date={date}&end_date={date}&include_archived={0|1}
 */
function mentorship_platform_pg_get_scan_audit_report( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
    
    $start_date     = $request->get_param( 'start_date' );
    $end_date       = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' ) === '1';
    $force_refresh  = $request->get_param( 'refresh' ) === '1';

    // Serve from 5-minute transient cache unless forced refresh
    $cache_key = 'mp_compliance_scan_audits_' . md5( $start_date . '|' . $end_date . '|' . ( $include_archived ? '1' : '0' ) );
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            return rest_ensure_response( $cached );
        }
    }
    
    // Build conditions for CASE WHEN statements (these filter the actual counts)
    $date_condition = '';
    $archive_condition = '';
    
    if ( $start_date && $end_date ) {
        $start_datetime = esc_sql( $start_date . ' 00:00:00' );
        $end_datetime = esc_sql( $end_date . ' 23:59:59' );
        $date_condition = " AND a.audit_date BETWEEN '{$start_datetime}' AND '{$end_datetime}'";
    }
    if ( ! $include_archived ) {
        $archive_condition = " AND a.archived = 0";
    }
    $case_condition = $date_condition . $archive_condition;
    
    // Query to get only MEMBERS with their scan audit statistics
    // Non-members (visitors) are excluded from reports
    // The date/archive filters are inside the CASE WHEN so they properly filter the counts
    
    // Join with pg_user_metadata to check is_member status
    // Visitors (is_member=0) are excluded
    
    // ARCHIVE HANDLING:
    // If include_archived is FALSE (default), we exclude archived USERS from the list entirely
    // unless they have activity in the date range (handled by join? no, we want strict user filter)
    $where_extra = "";
    if ( ! $include_archived ) {
        // Exclude archived users from the list
        $where_extra = " AND (pum.archived = 0 OR pum.archived IS NULL)";
    }
    
    $query = "
        SELECT 
            u.ID as user_id,
            u.display_name,
            COALESCE(MAX(r.title), 'No Role') as job_role,
            COUNT(DISTINCT CASE WHEN a.audited_user_id = u.ID{$case_condition} THEN a.id END) as participated_count,
            COUNT(DISTINCT CASE WHEN a.audited_user_id = u.ID AND LOWER(a.result) IN ('pass', 'passed'){$case_condition} THEN a.id END) as participated_pass,
            COUNT(DISTINCT CASE WHEN a.audited_user_id = u.ID AND LOWER(a.result) IN ('fail', 'failed'){$case_condition} THEN a.id END) as participated_fail,
            COUNT(DISTINCT CASE WHEN a.auditor_id = u.ID{$case_condition} THEN a.id END) as conducted_count,
            MAX(CASE WHEN a.audited_user_id = u.ID{$case_condition} THEN a.audit_date END) as last_date,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
        FROM {$wpdb->users} u
        LEFT JOIN {$wpdb->prefix}pg_user_metadata pum ON u.ID = pum.user_id
        LEFT JOIN {$wpdb->prefix}pg_user_job_assignments uja ON u.ID = uja.user_id
        LEFT JOIN {$wpdb->prefix}pg_job_roles r ON uja.job_role_id = r.id
        LEFT JOIN {$table_name} a ON (a.audited_user_id = u.ID OR a.auditor_id = u.ID)
        WHERE (pum.is_member = 1 OR (pum.is_member IS NULL AND uja.id IS NOT NULL)){$where_extra}
        GROUP BY u.ID, u.display_name
        ORDER BY last_name ASC, first_name ASC
    ";
    
    $results = $wpdb->get_results( $query, ARRAY_A );
    
    // Log only errors
    if ( $wpdb->last_error ) {
        error_log( 'Scan Audit Report SQL Error: ' . $wpdb->last_error );
    }
    
    // Format results
    $formatted_results = array_map( function( $row ) {
        return array(
            'user_id'            => (int) $row['user_id'],
            'display_name'       => $row['display_name'],
            'job_role'           => $row['job_role'],
            'participated_count' => (int) $row['participated_count'],
            'participated_pass'  => (int) $row['participated_pass'],
            'participated_fail'  => (int) $row['participated_fail'],
            'conducted_count'    => (int) $row['conducted_count'],
            'target_count'       => 2, // Default, will be overridden by frontend
            'last_date'          => $row['last_date'],
        );
    }, $results );

    // Cache for 5 minutes
    set_transient( $cache_key, $formatted_results, 5 * MINUTE_IN_SECONDS );

    return rest_ensure_response( $formatted_results );
}

/**
 * Get Live Drill Compliance Report
 * GET /pg/reports/live-drills?start_date={date}&end_date={date}&include_archived={0|1}
 * 
 * NOTE: The "participated_count" represents staff who were drilled (subjects of the scenario).
 * These are stored in the notes JSON field as "staff_involved".
 * The "conducted_count" represents staff who conducted/logged the drill (drill_conductor_id).
 */
function mentorship_platform_pg_get_live_drill_report( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
    
    $start_date     = $request->get_param( 'start_date' );
    $end_date       = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' ) === '1';
    $force_refresh  = $request->get_param( 'refresh' ) === '1';

    // Serve from 5-minute transient cache unless forced refresh
    $cache_key = 'mp_compliance_live_drills_' . md5( $start_date . '|' . $end_date . '|' . ( $include_archived ? '1' : '0' ) );
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            return rest_ensure_response( $cached );
        }
    }
    
    // Build WHERE conditions
    $where_conditions = array( '1=1' );
    if ( ! $include_archived ) {
        $where_conditions[] = "d.archived = 0";
    }
    if ( $start_date && $end_date ) {
        $start_datetime = esc_sql( $start_date . ' 00:00:00' );
        $end_datetime = esc_sql( $end_date . ' 23:59:59' );
        $where_conditions[] = "d.drill_date BETWEEN '{$start_datetime}' AND '{$end_datetime}'";
    }
    $where_sql = implode( ' AND ', $where_conditions );
    
    // First, get all drills within the date range
    $drills_query = "
        SELECT d.id, d.drill_conductor_id, d.drill_date, d.result, d.notes
        FROM {$table_name} d
        WHERE {$where_sql}
    ";
    $drills = $wpdb->get_results( $drills_query, ARRAY_A );
    
    // Build participation counts from staff_involved in notes JSON
    $user_participation = array(); // user_id => [ 'total' => X, 'pass' => X, 'remediation' => X, 'fail' => X, 'last_date' => date ]
    $user_conducted = array();     // user_id => count
    
    foreach ( $drills as $drill ) {
        // Count conducted drills
        $conductor_id = (int) $drill['drill_conductor_id'];
        if ( ! isset( $user_conducted[ $conductor_id ] ) ) {
            $user_conducted[ $conductor_id ] = 0;
        }
        $user_conducted[ $conductor_id ]++;
        
        // Parse notes JSON for staff_involved
        $notes = json_decode( $drill['notes'], true );
        if ( $notes && isset( $notes['staff_involved'] ) && is_array( $notes['staff_involved'] ) ) {
            $result = strtolower( $drill['result'] ?? '' );
            $is_pass = in_array( $result, array( 'pass', 'passed' ) );
            $is_remediation = strpos( $result, 'remediation' ) !== false;
            $is_fail = in_array( $result, array( 'fail', 'failed' ) ) && ! $is_remediation;
            
            foreach ( $notes['staff_involved'] as $staff ) {
                // staff can be { id: X, name: "..." } or just an ID
                $staff_id = is_array( $staff ) ? ( isset( $staff['id'] ) ? (int) $staff['id'] : 0 ) : (int) $staff;
                if ( $staff_id <= 0 ) continue;
                
                if ( ! isset( $user_participation[ $staff_id ] ) ) {
                    $user_participation[ $staff_id ] = array(
                        'total' => 0,
                        'pass' => 0,
                        'remediation' => 0,
                        'fail' => 0,
                        'last_date' => null,
                    );
                }
                
                $user_participation[ $staff_id ]['total']++;
                if ( $is_pass ) $user_participation[ $staff_id ]['pass']++;
                if ( $is_remediation ) $user_participation[ $staff_id ]['remediation']++;
                if ( $is_fail ) $user_participation[ $staff_id ]['fail']++;
                
                // Track last date
                if ( ! $user_participation[ $staff_id ]['last_date'] || 
                     $drill['drill_date'] > $user_participation[ $staff_id ]['last_date'] ) {
                    $user_participation[ $staff_id ]['last_date'] = $drill['drill_date'];
                }
            }
        }
    }

    // ARCHIVE HANDLING:
    // If include_archived is FALSE (default), we exclude archived USERS from the list entirely
    $where_extra = "";
    if ( ! $include_archived ) {
        // Exclude archived users from the list
        $where_extra = " AND (pum.archived = 0 OR pum.archived IS NULL)";
    }
    
    // Get only MEMBERS (exclude visitors) with their job roles
    $users_query = "
        SELECT 
            u.ID as user_id,
            u.display_name,
            COALESCE(MAX(r.title), 'No Role') as job_role,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
        FROM {$wpdb->users} u
        LEFT JOIN {$wpdb->prefix}pg_user_metadata pum ON u.ID = pum.user_id
        LEFT JOIN {$wpdb->prefix}pg_user_job_assignments uja ON u.ID = uja.user_id
        LEFT JOIN {$wpdb->prefix}pg_job_roles r ON uja.job_role_id = r.id
        WHERE (pum.is_member = 1 OR (pum.is_member IS NULL AND uja.id IS NOT NULL)){$where_extra}
        GROUP BY u.ID, u.display_name
        ORDER BY last_name ASC, first_name ASC
    ";
    $users = $wpdb->get_results( $users_query, ARRAY_A );
    
    // Combine data
    $formatted_results = array_map( function( $user ) use ( $user_participation, $user_conducted ) {
        $user_id = (int) $user['user_id'];
        $participation = isset( $user_participation[ $user_id ] ) ? $user_participation[ $user_id ] : null;
        $conducted = isset( $user_conducted[ $user_id ] ) ? $user_conducted[ $user_id ] : 0;
        
        return array(
            'user_id'                 => $user_id,
            'display_name'            => $user['display_name'],
            'job_role'                => $user['job_role'],
            'participated_count'      => $participation ? $participation['total'] : 0,
            'participated_pass'       => $participation ? $participation['pass'] : 0,
            'participated_remediation' => $participation ? $participation['remediation'] : 0,
            'participated_fail'       => $participation ? $participation['fail'] : 0,
            'conducted_count'         => $conducted,
            'target_count'            => 2, // Default, will be overridden by frontend
            'last_date'               => $participation ? $participation['last_date'] : null,
        );
    }, $users );

    // Cache for 5 minutes
    set_transient( $cache_key, $formatted_results, 5 * MINUTE_IN_SECONDS );

    return rest_ensure_response( $formatted_results );
}

/**
 * Get In-Service Training Compliance Report
 * GET /pg/reports/inservice?start_date={date}&end_date={date}&include_archived={0|1}
 */
function mentorship_platform_pg_get_inservice_report( $request ) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    
    $start_date     = $request->get_param( 'start_date' );
    $end_date       = $request->get_param( 'end_date' );
    $include_archived = $request->get_param( 'include_archived' ) === '1';
    $force_refresh  = $request->get_param( 'refresh' ) === '1';

    // Serve from 5-minute transient cache unless forced refresh
    $cache_key = 'mp_compliance_inservice_' . md5( $start_date . '|' . $end_date . '|' . ( $include_archived ? '1' : '0' ) );
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            return rest_ensure_response( $cached );
        }
    }
    
    // Build conditions for CASE WHEN statements (these filter the actual counts)
    $date_condition = '';
    $archive_condition = '';
    
    if ( $start_date && $end_date ) {
        $start_clean = esc_sql( $start_date );
        $end_clean = esc_sql( $end_date );
        $date_condition = " AND l.training_date BETWEEN '{$start_clean}' AND '{$end_clean}'";
    }
    if ( ! $include_archived ) {
        $archive_condition = " AND l.archived = 0";
    }
    $case_condition = $date_condition . $archive_condition;
    
    // ARCHIVE HANDLING:
    // If include_archived is FALSE (default), we exclude archived USERS from the list entirely
    $where_extra = "";
    if ( ! $include_archived ) {
        // Exclude archived users from the list
        $where_extra = " AND (pum.archived = 0 OR pum.archived IS NULL)";
    }

    // Get only MEMBERS (exclude visitors) with their attendance counts
    // Note: attendance_status column contains 'leader', 'attended', or 'no_show'
    // The date/archive filters are inside the CASE WHEN so they properly filter the counts
    $query = "
        SELECT 
            u.ID as user_id,
            u.display_name,
            COALESCE(MAX(r.title), 'No Role') as job_role,
            COUNT(DISTINCT CASE WHEN att.user_id = u.ID AND att.attendance_status = 'attended'{$case_condition} THEN l.id END) as attended_count,
            SUM(CASE WHEN att.user_id = u.ID AND att.attendance_status = 'attended'{$case_condition} THEN COALESCE(l.duration_hours, 0) ELSE 0 END) as hours_attended,
            COUNT(DISTINCT CASE WHEN att.user_id = u.ID AND att.attendance_status = 'leader'{$case_condition} THEN l.id END) as led_count,
            SUM(CASE WHEN att.user_id = u.ID AND att.attendance_status = 'leader'{$case_condition} THEN COALESCE(l.duration_hours, 0) ELSE 0 END) as hours_led,
            COUNT(DISTINCT CASE WHEN att.user_id = u.ID AND att.attendance_status = 'no_show'{$case_condition} THEN l.id END) as no_show_count,
            MAX(CASE WHEN att.user_id = u.ID AND att.attendance_status = 'attended'{$case_condition} THEN l.training_date END) as last_date,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) as last_name,
            (SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) as first_name
        FROM {$wpdb->users} u
        LEFT JOIN {$wpdb->prefix}pg_user_metadata pum ON u.ID = pum.user_id
        LEFT JOIN {$wpdb->prefix}pg_user_job_assignments uja ON u.ID = uja.user_id
        LEFT JOIN {$wpdb->prefix}pg_job_roles r ON uja.job_role_id = r.id
        LEFT JOIN {$attendees_table} att ON att.user_id = u.ID
        LEFT JOIN {$table_name} l ON att.inservice_id = l.id
        WHERE (pum.is_member = 1 OR (pum.is_member IS NULL AND uja.id IS NOT NULL)){$where_extra}
        GROUP BY u.ID, u.display_name
        ORDER BY last_name ASC, first_name ASC
    ";
    
    $results = $wpdb->get_results( $query, ARRAY_A );
    
    // Log only errors
    if ( $wpdb->last_error ) {
        error_log( 'In-Service Report SQL Error: ' . $wpdb->last_error );
    }
    
    // Format results — hours_attended sums duration_hours for attended sessions
    $formatted_results = array_map( function( $row ) {
        return array(
            'user_id'           => (int) $row['user_id'],
            'display_name'      => $row['display_name'],
            'job_role'          => $row['job_role'],
            'attended_count'    => (int) $row['attended_count'],
            'hours_attended'    => round( (float) $row['hours_attended'], 2 ),
            'led_count'         => (int) $row['led_count'],
            'hours_led'         => round( (float) $row['hours_led'], 2 ),
            'sessions_led'      => (int) $row['led_count'],  // alias used by CSV export
            'no_show_count'     => (int) $row['no_show_count'],
            'participated_count' => (int) $row['attended_count'], // for filter/colour consistency
            'participated_pass'  => (int) $row['attended_count'],
            'participated_fail'  => 0,
            'conducted_count'    => (int) $row['led_count'],
            'target_count'       => 2, // Default, will be overridden by frontend
            'last_date'          => $row['last_date'],
        );
    }, $results );

    // Cache for 5 minutes
    set_transient( $cache_key, $formatted_results, 5 * MINUTE_IN_SECONDS );

    return rest_ensure_response( $formatted_results );
}

/**
 * BATCH: Get activities for multiple criteria at once (performance optimization)
 * POST /pg/criterion/activities-batch
 * Body: { criterion_ids: [1,2,3], affected_user_id: 123 }
 */
function mentorship_platform_pg_get_criterion_activities_batch( $request ) {
    global $wpdb;
    
    $criterion_ids = $request->get_param( 'criterion_ids' );
    $affected_user_id = intval( $request->get_param( 'affected_user_id' ) );
    
    if ( empty( $criterion_ids ) || ! is_array( $criterion_ids ) ) {
        return rest_ensure_response( array() );
    }
    
    // Sanitize IDs
    $criterion_ids = array_map( 'intval', $criterion_ids );
    $placeholders = implode( ',', array_fill( 0, count( $criterion_ids ), '%d' ) );
    
    $activities_table = $wpdb->prefix . 'pg_criterion_activities';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Get all activities for these criteria and user in ONE query
    $query = $wpdb->prepare(
        "SELECT 
            a.id,
            a.criterion_id,
            a.user_id,
            a.affected_user_id,
            a.user_job_role_id,
            a.activity_type,
            a.content,
            a.old_value,
            a.new_value,
            a.created_at,
            a.edited_at,
            a.edited_by,
            u.display_name as user_name,
            COALESCE(r.title, 'Unknown Role') as user_role,
            e.display_name as edited_by_name
         FROM $activities_table a
         LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
         LEFT JOIN $roles_table r ON a.user_job_role_id = r.id
         LEFT JOIN {$wpdb->users} e ON a.edited_by = e.ID
         WHERE a.criterion_id IN ($placeholders)
         AND a.affected_user_id = %d
         ORDER BY a.criterion_id, a.created_at DESC",
        array_merge( $criterion_ids, array( $affected_user_id ) )
    );
    
    $activities = $wpdb->get_results( $query, ARRAY_A );
    
    // Group activities by criterion_id
    $grouped = array();
    foreach ( $activities as $activity ) {
        $criterion_id = (int) $activity['criterion_id'];
        
        // Format the activity
        $activity['id'] = (int) $activity['id'];
        $activity['criterion_id'] = $criterion_id;
        $activity['user_id'] = (int) $activity['user_id'];
        $activity['affected_user_id'] = (int) $activity['affected_user_id'];
        $activity['user_job_role_id'] = $activity['user_job_role_id'] ? (int) $activity['user_job_role_id'] : null;
        $activity['edited_by'] = $activity['edited_by'] ? (int) $activity['edited_by'] : null;
        
        if ( ! isset( $grouped[ $criterion_id ] ) ) {
            $grouped[ $criterion_id ] = array();
        }
        $grouped[ $criterion_id ][] = $activity;
    }
    
    return rest_ensure_response( $grouped );
}

/**
 * Get activity log for a criterion for a specific user
 * GET /pg/criterion/:criterion_id/activities?affected_user_id=X
 */
function mentorship_platform_pg_get_criterion_activities( $request ) {
    global $wpdb;
    
    $criterion_id = intval( $request->get_param( 'criterion_id' ) );
    $affected_user_id = intval( $request->get_param( 'affected_user_id' ) );
    
    $activities_table = $wpdb->prefix . 'pg_criterion_activities';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Get all activities for this criterion and user
    // Debug logging
    error_log("GET activities for criterion_id=$criterion_id, affected_user_id=$affected_user_id");
    
    $activities = $wpdb->get_results( $wpdb->prepare(
        "SELECT 
            a.id,
            a.criterion_id,
            a.user_id,
            a.affected_user_id,
            a.user_job_role_id,
            a.activity_type,
            a.content,
            a.old_value,
            a.new_value,
            a.created_at,
            a.edited_at,
            a.edited_by,
            u.display_name as user_name,
            COALESCE(r.title, 'Unknown Role') as user_role,
            e.display_name as edited_by_name
         FROM $activities_table a
         LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID
         LEFT JOIN $roles_table r ON a.user_job_role_id = r.id
         LEFT JOIN {$wpdb->users} e ON a.edited_by = e.ID
         WHERE a.criterion_id = %d
         AND a.affected_user_id = %d
         ORDER BY a.created_at DESC",
        $criterion_id,
        $affected_user_id
    ), ARRAY_A );
    
    error_log("Found " . count($activities) . " activities. Last error: " . $wpdb->last_error);
    
    // Format the results
    foreach ( $activities as &$activity ) {
        $activity['id'] = (int) $activity['id'];
        $activity['criterion_id'] = (int) $activity['criterion_id'];
        $activity['user_id'] = (int) $activity['user_id'];
        $activity['affected_user_id'] = (int) $activity['affected_user_id'];
        $activity['user_job_role_id'] = $activity['user_job_role_id'] ? (int) $activity['user_job_role_id'] : null;
        $activity['edited_by'] = $activity['edited_by'] ? (int) $activity['edited_by'] : null;
    }
    
    return rest_ensure_response( $activities );
}

/**
 * Add an activity log entry for a criterion
 * POST /pg/criterion/activity
 */
function mentorship_platform_pg_add_criterion_activity( $request ) {
    global $wpdb;
    
    $criterion_id = intval( $request->get_param( 'criterion_id' ) );
    $affected_user_id = intval( $request->get_param( 'affected_user_id' ) );
    $activity_type = sanitize_text_field( $request->get_param( 'activity_type' ) );
    $content = wp_kses_post( $request->get_param( 'content' ) );
    $old_value = sanitize_text_field( $request->get_param( 'old_value' ) );
    $new_value = sanitize_text_field( $request->get_param( 'new_value' ) );
    
    $current_user_id = get_current_user_id();
    
    // Get current user's job role
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_job_role_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d ORDER BY id DESC LIMIT 1",
        $current_user_id
    ) );
    
    $activities_table = $wpdb->prefix . 'pg_criterion_activities';
    
    // Debug logging
    error_log("POST activity: criterion_id=$criterion_id, user_id=$current_user_id, affected_user_id=$affected_user_id, type=$activity_type");
    
    $result = $wpdb->insert(
        $activities_table,
        array(
            'criterion_id'       => $criterion_id,
            'user_id'            => $current_user_id,
            'affected_user_id'   => $affected_user_id,
            'user_job_role_id'   => $user_job_role_id,
            'activity_type'      => $activity_type,
            'content'            => $content,
            'old_value'          => $old_value,
            'new_value'          => $new_value,
            'created_at'         => current_time( 'mysql' ),
        ),
        array( '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
    );
    
    if ( $result === false ) {
        error_log("INSERT FAILED: " . $wpdb->last_error);
        return new WP_Error( 'insert_failed', 'Failed to add activity', array( 'status' => 500 ) );
    }
    
    $activity_id = $wpdb->insert_id;
    error_log("Activity inserted with ID: $activity_id");
    
    // Also update the main progress record if this is a checkbox or counter update
    if ( $activity_type === 'checkbox_checked' || $activity_type === 'checkbox_unchecked' ) {
        $progress_table = $wpdb->prefix . 'pg_user_progress';
        $is_completed = ( $activity_type === 'checkbox_checked' ) ? 1 : 0;
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $affected_user_id,
            $criterion_id
        ) );
        
        if ( $existing ) {
            $wpdb->update(
                $progress_table,
                array(
                    'is_completed'    => $is_completed,
                    'completion_date' => $is_completed ? current_time( 'mysql' ) : null,
                    'approved_by'     => $is_completed ? $current_user_id : null,
                ),
                array( 'user_id' => $affected_user_id, 'criterion_id' => $criterion_id )
            );
        } else {
            $wpdb->insert(
                $progress_table,
                array(
                    'user_id'         => $affected_user_id,
                    'criterion_id'    => $criterion_id,
                    'is_completed'    => $is_completed,
                    'completion_date' => $is_completed ? current_time( 'mysql' ) : null,
                    'approved_by'     => $is_completed ? $current_user_id : null,
                )
            );
        }
    } elseif ( $activity_type === 'counter_update' ) {
        $progress_table = $wpdb->prefix . 'pg_user_progress';
        
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $progress_table WHERE user_id = %d AND criterion_id = %d",
            $affected_user_id,
            $criterion_id
        ) );
        
        if ( $existing ) {
            $wpdb->update(
                $progress_table,
                array( 'current_value' => intval( $new_value ) ),
                array( 'user_id' => $affected_user_id, 'criterion_id' => $criterion_id )
            );
        } else {
            $wpdb->insert(
                $progress_table,
                array(
                    'user_id'       => $affected_user_id,
                    'criterion_id'  => $criterion_id,
                    'current_value' => intval( $new_value ),
                )
            );
        }
    }
    
    return rest_ensure_response( array(
        'success'     => true,
        'activity_id' => $activity_id,
    ) );
}

/**
 * Update a criterion activity (edit note content)
 */
function mentorship_platform_pg_update_criterion_activity( $request ) {
    global $wpdb;
    
    $activity_id = $request->get_param( 'id' );
    $new_content = $request->get_param( 'content' );
    $current_user_id = get_current_user_id();
    
    if ( ! $current_user_id ) {
        return new WP_Error( 'unauthorized', 'User not logged in', array( 'status' => 401 ) );
    }
    
    $table_name = $wpdb->prefix . 'pg_criterion_activities';
    
    // Get the activity to check permissions
    $activity = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $table_name WHERE id = %d",
        $activity_id
    ) );
    
    if ( ! $activity ) {
        return new WP_Error( 'not_found', 'Activity not found', array( 'status' => 404 ) );
    }
    
    // Check permissions: must be the activity creator OR a WordPress admin
    $is_creator = ( intval( $activity->user_id ) === $current_user_id );
    $is_admin = current_user_can( 'manage_options' );
    
    if ( ! $is_creator && ! $is_admin ) {
        return new WP_Error( 'forbidden', 'You do not have permission to edit this activity', array( 'status' => 403 ) );
    }
    
    // Update the activity
    $result = $wpdb->update(
        $table_name,
        array(
            'content'   => $new_content,
            'edited_at' => current_time( 'mysql' ),
            'edited_by' => $current_user_id,
        ),
        array( 'id' => $activity_id )
    );
    
    if ( $result === false ) {
        return new WP_Error( 'update_failed', 'Failed to update activity', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Activity updated successfully',
    ) );
}

/**
 * Delete a criterion activity
 */
function mentorship_platform_pg_delete_criterion_activity( $request ) {
    global $wpdb;
    
    $activity_id = $request->get_param( 'id' );
    $current_user_id = get_current_user_id();
    
    if ( ! $current_user_id ) {
        return new WP_Error( 'unauthorized', 'User not logged in', array( 'status' => 401 ) );
    }
    
    $table_name = $wpdb->prefix . 'pg_criterion_activities';
    
    // Get the activity to check permissions
    $activity = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $table_name WHERE id = %d",
        $activity_id
    ) );
    
    if ( ! $activity ) {
        return new WP_Error( 'not_found', 'Activity not found', array( 'status' => 404 ) );
    }
    
    // Check permissions: must be the activity creator OR a WordPress admin
    $is_creator = ( intval( $activity->user_id ) === $current_user_id );
    $is_admin = current_user_can( 'manage_options' );
    
    if ( ! $is_creator && ! $is_admin ) {
        return new WP_Error( 'forbidden', 'You do not have permission to delete this activity', array( 'status' => 403 ) );
    }
    
    // Delete the activity
    $result = $wpdb->delete(
        $table_name,
        array( 'id' => $activity_id )
    );
    
    if ( $result === false ) {
        return new WP_Error( 'delete_failed', 'Failed to delete activity', array( 'status' => 500 ) );
    }
    
    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Activity deleted successfully',
    ) );
}

/**
 * GET /pg/locations - Get all locations (with caching)
 */
function mentorship_platform_pg_get_locations($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'pg_locations';
    
    // Try to get from cache first (locations rarely change)
    $cache_key = 'mp_locations_list';
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return rest_ensure_response($cached);
    }
    
    $locations = $wpdb->get_results(
        "SELECT id, name, description, sort_order, is_active, created_at, updated_at 
         FROM $table 
         ORDER BY sort_order ASC, name ASC",
        ARRAY_A
    );
    
    if ($locations === null) {
        return new WP_Error('db_error', 'Database error', array('status' => 500));
    }
    
    // Convert to proper types
    foreach ($locations as &$location) {
        $location['id'] = (int) $location['id'];
        $location['is_active'] = (bool) $location['is_active'];
    }
    
    // Cache for 1 hour (locations rarely change)
    set_transient($cache_key, $locations, HOUR_IN_SECONDS);
    
    return rest_ensure_response($locations);
}

/**
 * POST /pg/locations - Create a new location
 */
function mentorship_platform_pg_create_location($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'pg_locations';
    
    $name = sanitize_text_field($request->get_param('name'));
    $description = sanitize_textarea_field($request->get_param('description'));
    
    if (empty($name)) {
        return new WP_Error('invalid_data', 'Name is required', array('status' => 400));
    }
    
    // Check for duplicate name
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE name = %s",
        $name
    ));
    
    if ($existing > 0) {
        return new WP_Error('duplicate', 'A location with this name already exists', array('status' => 400));
    }
    
    // Get the highest sort_order and add 1
    $max_sort_order = $wpdb->get_var("SELECT MAX(sort_order) FROM $table");
    $sort_order = isset($request['sort_order']) ? (int) $request->get_param('sort_order') : ($max_sort_order + 1);
    
    $result = $wpdb->insert(
        $table,
        array(
            'name' => $name,
            'description' => $description,
            'sort_order' => $sort_order,
            'is_active' => 1,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ),
        array('%s', '%s', '%d', '%d', '%s', '%s')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create location', array('status' => 500));
    }
    
    $location_id = $wpdb->insert_id;
    $location = $wpdb->get_row($wpdb->prepare(
        "SELECT id, name, description, sort_order, is_active, created_at, updated_at FROM $table WHERE id = %d",
        $location_id
    ), ARRAY_A);
    
    $location['id'] = (int) $location['id'];
    $location['sort_order'] = (int) $location['sort_order'];
    $location['is_active'] = (bool) $location['is_active'];
    
    // Invalidate locations cache
    delete_transient('mp_locations_list');
    
    return rest_ensure_response($location);
}

/**
 * PUT /pg/locations/{id} - Update a location
 */
function mentorship_platform_pg_update_location($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'pg_locations';
    
    $location_id = (int) $request->get_param('id');
    $name = sanitize_text_field($request->get_param('name'));
    $description = sanitize_textarea_field($request->get_param('description'));
    
    if (empty($name)) {
        return new WP_Error('invalid_data', 'Name is required', array('status' => 400));
    }
    
    // Check if location exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE id = %d",
        $location_id
    ));
    
    if (!$existing) {
        return new WP_Error('not_found', 'Location not found', array('status' => 404));
    }
    
    // Check for duplicate name (excluding current location)
    $duplicate = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE name = %s AND id != %d",
        $name,
        $location_id
    ));
    
    if ($duplicate > 0) {
        return new WP_Error('duplicate', 'A location with this name already exists', array('status' => 400));
    }
    
    $update_data = array(
        'name' => $name,
        'description' => $description,
        'updated_at' => current_time('mysql')
    );
    $update_format = array('%s', '%s', '%s');
    
    // Allow updating sort_order if provided
    if ($request->has_param('sort_order')) {
        $update_data['sort_order'] = (int) $request->get_param('sort_order');
        $update_format[] = '%d';
    }
    
    $result = $wpdb->update(
        $table,
        $update_data,
        array('id' => $location_id),
        $update_format,
        array('%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to update location', array('status' => 500));
    }
    
    $location = $wpdb->get_row($wpdb->prepare(
        "SELECT id, name, description, sort_order, is_active, created_at, updated_at FROM $table WHERE id = %d",
        $location_id
    ), ARRAY_A);
    
    $location['id'] = (int) $location['id'];
    $location['sort_order'] = (int) $location['sort_order'];
    $location['is_active'] = (bool) $location['is_active'];
    
    // Invalidate locations cache
    delete_transient('mp_locations_list');
    
    return rest_ensure_response($location);
}

/**
 * DELETE /pg/locations/{id} - Soft delete (deactivate) a location
 */
function mentorship_platform_pg_delete_location($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'pg_locations';
    
    $location_id = (int) $request->get_param('id');
    
    // Check if location exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE id = %d",
        $location_id
    ));
    
    if (!$existing) {
        return new WP_Error('not_found', 'Location not found', array('status' => 404));
    }
    
    // Soft delete (deactivate)
    $result = $wpdb->update(
        $table,
        array(
            'is_active' => 0,
            'updated_at' => current_time('mysql')
        ),
        array('id' => $location_id),
        array('%d', '%s'),
        array('%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to delete location', array('status' => 500));
    }
    
    // Invalidate locations cache
    delete_transient('mp_locations_list');
    
    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Location deactivated successfully'
    ));
}
