<?php
/**
 * Plugin Name:       AquaticPro
 * Description:       Professional aquatic staff development platform for mentorship, daily logs, and career progression.
 * Version:           13.2.7
 * Author:            Swimming Ideas, LLC
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       aquaticpro
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

// ============================================
// PERFORMANCE DIAGNOSTIC MODE
// Set to true to log timing info to debug.log
// ============================================
define('AQUATICPRO_DEBUG_TIMING', false);

function aquaticpro_log_timing($label, $start_time = null) {
    if (!AQUATICPRO_DEBUG_TIMING) return;
    if ($start_time) {
        $elapsed = round((microtime(true) - $start_time) * 1000, 2);
        error_log("[AquaticPro Timing] {$label}: {$elapsed}ms");
    } else {
        error_log("[AquaticPro Timing] {$label}");
    }
}

$_aquaticpro_boot_start = microtime(true);

// Include admin settings file FIRST so permission functions are available
require_once plugin_dir_path( __FILE__ ) . 'includes/admin-settings.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/admin-lesson-setup.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/admin-promotion-setup.php';

// Include security helpers early (rate limiting, PII filtering, audit logging)
require_once plugin_dir_path( __FILE__ ) . 'includes/security-helpers.php';

/**
 * Backward compatibility wrappers for renamed functions.
 * These MUST be defined before API routes are loaded.
 */
if ( ! function_exists( 'mentorship_platform_check_access_permission' ) ) {
    function mentorship_platform_check_access_permission() {
        return aquaticpro_check_access_permission();
    }
}

if ( ! function_exists( 'mentorship_platform_user_has_access' ) ) {
    function mentorship_platform_user_has_access( $user_id = null ) {
        return aquaticpro_user_has_access( $user_id );
    }
}

// Include API routes file early so its functions are available globally
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes.php';

// Include Professional Growth Module API routes
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-professional-growth.php';

// Include Daily Logs API routes and callbacks
require_once plugin_dir_path( __FILE__ ) . 'includes/api-callbacks-daily-logs.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-daily-logs.php';

// Include TaskDeck Module
require_once plugin_dir_path( __FILE__ ) . 'includes/class-taskdeck.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-taskdeck.php';

// Include Lesson Management Module (conditionally loaded)
// Requires Professional Growth module to be enabled for permission system
$aquaticpro_enable_professional_growth = get_option( 'aquaticpro_enable_professional_growth', false );
$aquaticpro_enable_lesson_management = get_option( 'aquaticpro_enable_lesson_management', false );

if ( $aquaticpro_enable_professional_growth && $aquaticpro_enable_lesson_management ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/lesson-management/cpt-registration.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/lesson-management/rest-api.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/lesson-management/email-handler.php';
    require_once plugin_dir_path( __FILE__ ) . 'includes/lesson-management/api-routes-aquaticpro.php';
}

// Include Lesson Management Export Routes (Admin only)
if ( $aquaticpro_enable_lesson_management ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-lesson-exports.php';
}

// Include FOIA Export Module (Admin only)
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-foia-export.php';

// Include Daily Logs Webhook (n8n integration)
require_once plugin_dir_path( __FILE__ ) . 'includes/class-daily-logs-webhook.php';

// Include Dashboard API routes
require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-dashboard.php';

// Include Awesome Awards Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/class-awesome-awards.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/class-awesome-awards.php';
}
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-awesome-awards.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-awesome-awards.php';
}

// Include Seasonal Returns & Pay Management Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/class-seasonal-returns.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/class-seasonal-returns.php';
}
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-seasonal-returns.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-seasonal-returns.php';
}

// Include New Hires & Onboarding Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/class-new-hires.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/class-new-hires.php';
}
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-new-hires.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-new-hires.php';
}

// Include Legacy Import Module (for migrating from Pods-based mentorship)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-legacy-import.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-legacy-import.php';
}

// Include Mileage Reimbursement Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-mileage.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-mileage.php';
}

// Include Bento Media Grid Module (standalone shortcode)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/class-bento-media-grid.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/class-bento-media-grid.php';
}

// Include Whiteboard Lesson Module (Excalidraw-based lessons)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-whiteboard.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-whiteboard.php';
}

// Include LMS Progress & Learning Module (LearnDash integration)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms.php';
}

// Include LMS Assigned Learning Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms-assignments.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms-assignments.php';
}

// Include Email Composer Module (custom email sending for admins)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-email-composer.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-email-composer.php';
}

// Include LMS Course Auto-Assignment by Role
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms-auto-assign.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-lms-auto-assign.php';
}

// Include Goal Changes polling endpoint (real-time workspace updates)
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-goal-changes.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-goal-changes.php';
}

// Include Certificate Tracking Module
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/class-certificates.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/class-certificates.php';
}
if ( file_exists( plugin_dir_path( __FILE__ ) . 'includes/api-routes-certificates.php' ) ) {
    require_once plugin_dir_path( __FILE__ ) . 'includes/api-routes-certificates.php';
}

/**
 * One-time migration: Drop deprecated Course Builder tables
 * This runs once and then sets an option to prevent re-running
 */
function mp_drop_course_builder_tables() {
    // Check if this migration has already run
    if ( get_option( 'mp_course_builder_tables_dropped', false ) ) {
        return;
    }
    
    global $wpdb;
    
    // List of Course Builder tables to drop (in correct order for foreign keys)
    $tables_to_drop = [
        $wpdb->prefix . 'mp_cb_page_links',
        $wpdb->prefix . 'mp_cb_page_content',
        $wpdb->prefix . 'mp_cb_course_pages',
        $wpdb->prefix . 'mp_cb_permissions',
        $wpdb->prefix . 'mp_cb_cards',
        $wpdb->prefix . 'mp_cb_lessons',
        $wpdb->prefix . 'mp_cb_sections',
        $wpdb->prefix . 'mp_cb_courses',
    ];
    
    foreach ( $tables_to_drop as $table ) {
        $wpdb->query( "DROP TABLE IF EXISTS $table" );
    }
    
    // Mark migration as complete so it doesn't run again
    update_option( 'mp_course_builder_tables_dropped', true );
    
    error_log( 'Mentorship Platform: Dropped deprecated Course Builder tables' );
}
add_action( 'init', 'mp_drop_course_builder_tables' );

/**
 * Run database migrations on plugin activation
 */
function mp_run_database_migrations() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    $job_roles_table = $wpdb->prefix . 'pg_job_roles';
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    // 1. CREATE TIME SLOTS TABLE
    $time_slots_table = $wpdb->prefix . 'mp_time_slots';
    $sql_time_slots = "CREATE TABLE $time_slots_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        color VARCHAR(7),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_active (is_active),
        KEY idx_sort (sort_order)
    ) $charset_collate;";
    
    dbDelta($sql_time_slots);
    
    // Insert default time slots if table is empty
    $existing_slots = $wpdb->get_var("SELECT COUNT(*) FROM $time_slots_table");
    if ($existing_slots == 0) {
        $default_slots = [
            ['slug' => 'morning', 'label' => 'Morning Shift', 'sort_order' => 1, 'color' => '#3B82F6'],
            ['slug' => 'midday', 'label' => 'Midday Shift', 'sort_order' => 2, 'color' => '#F59E0B'],
            ['slug' => 'evening', 'label' => 'Evening Shift', 'sort_order' => 3, 'color' => '#8B5CF6'],
            ['slug' => 'all_day', 'label' => 'All Day', 'sort_order' => 4, 'color' => '#10B981']
        ];
        
        foreach ($default_slots as $slot) {
            $wpdb->insert($time_slots_table, $slot, ['%s', '%s', '%d', '%s']);
        }
    }
    
    // 2. CREATE DAILY LOG PERMISSIONS TABLE
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $sql_permissions = "CREATE TABLE $permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_permissions);
    
    // Log table creation
    error_log('Attempted to create permissions table: ' . $permissions_table);
    
    // Verify table exists
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$permissions_table'");
    if ($table_exists) {
        error_log('Permissions table created successfully: ' . $permissions_table);
    } else {
        error_log('FAILED to create permissions table: ' . $permissions_table);
        error_log('Last DB error: ' . $wpdb->last_error);
    }
    
    // 2a. CREATE SCAN AUDIT PERMISSIONS TABLE
    $scan_audit_permissions_table = $wpdb->prefix . 'pg_scan_audit_permissions';
    $sql_scan_permissions = "CREATE TABLE $scan_audit_permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_scan_permissions);
    error_log('Attempted to create scan audit permissions table: ' . $scan_audit_permissions_table);
    
    // 2b. CREATE LIVE DRILL PERMISSIONS TABLE
    $live_drill_permissions_table = $wpdb->prefix . 'pg_live_drill_permissions';
    $sql_live_drill_permissions = "CREATE TABLE $live_drill_permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_live_drill_permissions);
    error_log('Attempted to create live drill permissions table: ' . $live_drill_permissions_table);
    
    // 2c. CREATE IN-SERVICE PERMISSIONS TABLE
    $inservice_permissions_table = $wpdb->prefix . 'pg_inservice_permissions';
    $sql_inservice_permissions = "CREATE TABLE $inservice_permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_inservice_permissions);
    error_log('Attempted to create in-service permissions table: ' . $inservice_permissions_table);
    
    // 2d. CREATE CASHIER AUDIT PERMISSIONS TABLE
    $cashier_audit_permissions_table = $wpdb->prefix . 'pg_cashier_audit_permissions';
    $sql_cashier_audit_permissions = "CREATE TABLE $cashier_audit_permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_cashier_audit_permissions);
    error_log('Attempted to create cashier audit permissions table: ' . $cashier_audit_permissions_table);
    
    // 2e. CREATE TASKDECK PERMISSIONS TABLE
    $taskdeck_permissions_table = $wpdb->prefix . 'pg_taskdeck_permissions';
    $sql_taskdeck_permissions = "CREATE TABLE $taskdeck_permissions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) NOT NULL DEFAULT 1,
        can_view_only_assigned TINYINT(1) NOT NULL DEFAULT 0,
        can_create TINYINT(1) NOT NULL DEFAULT 0,
        can_edit TINYINT(1) NOT NULL DEFAULT 0,
        can_delete TINYINT(1) NOT NULL DEFAULT 0,
        can_moderate_all TINYINT(1) NOT NULL DEFAULT 0,
        can_manage_primary_deck TINYINT(1) NOT NULL DEFAULT 0,
        can_manage_all_primary_cards TINYINT(1) NOT NULL DEFAULT 0,
        can_create_public_decks TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id)
    ) $charset_collate;";
    
    dbDelta($sql_taskdeck_permissions);
    error_log('Attempted to create TaskDeck permissions table: ' . $taskdeck_permissions_table);
    
    // 2e. CREATE REPORTS PERMISSIONS TABLE
    $reports_permissions_table = $wpdb->prefix . 'pg_reports_permissions';
    $sql_reports_permissions = "CREATE TABLE $reports_permissions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view_all_records TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id)
    ) $charset_collate;";
    
    dbDelta($sql_reports_permissions);
    error_log('Attempted to create Reports permissions table: ' . $reports_permissions_table);
    
    // 2f. CREATE INSTRUCTOR EVALUATION PERMISSIONS TABLE
    $instructor_eval_permissions_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
    $sql_instructor_eval_permissions = "CREATE TABLE $instructor_eval_permissions_table (
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
    ) $charset_collate;";
    
    dbDelta($sql_instructor_eval_permissions);
    error_log('Attempted to create Instructor Evaluation permissions table: ' . $instructor_eval_permissions_table);
    
    // 3. CREATE DAILY LOG REACTIONS TABLE
    $reactions_table = $wpdb->prefix . 'mp_daily_log_reactions';
    $sql_reactions = "CREATE TABLE $reactions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        log_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_log (user_id, log_id),
        KEY idx_log (log_id),
        KEY idx_user (user_id)
    ) $charset_collate;";
    
    dbDelta($sql_reactions);
    
    error_log('Attempted to create reactions table: ' . $reactions_table);
    
    // 4. CREATE COMMENT REACTIONS TABLE
    $comment_reactions_table = $wpdb->prefix . 'mp_comment_reactions';
    $sql_comment_reactions = "CREATE TABLE $comment_reactions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        comment_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_comment (user_id, comment_id),
        KEY idx_comment (comment_id),
        KEY idx_user (user_id)
    ) $charset_collate;";
    
    dbDelta($sql_comment_reactions);
    
    error_log('Attempted to create comment reactions table: ' . $comment_reactions_table);

    // 5. UNIFIED REACTIONS SYSTEM
    // Merges all reaction types into a single table for easier global stats and simpler queries
    $unified_reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
    $sql_unified_reactions = "CREATE TABLE $unified_reactions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        object_id BIGINT UNSIGNED NOT NULL,
        object_type VARCHAR(50) NOT NULL, -- 'daily_log', 'card_comment', etc.
        user_id BIGINT UNSIGNED NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,
        item_author_id BIGINT UNSIGNED NOT NULL DEFAULT 0, -- For efficient user stats
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_reaction (user_id, object_id, object_type),
        KEY idx_object (object_id, object_type),
        KEY idx_user (user_id),
        KEY idx_item_author (item_author_id)
    ) $charset_collate;";

    dbDelta($sql_unified_reactions);
    
    // Auto-migrate old reactions if table is empty
    $unified_count = $wpdb->get_var("SELECT COUNT(*) FROM $unified_reactions_table");
    if ($unified_count == 0) {
        $legacy_log_table = $wpdb->prefix . 'mp_daily_log_reactions';
        $legacy_comment_table = $wpdb->prefix . 'aqp_card_comment_reactions';
        
        // 1. Migrate Daily Log Reactions
        // Join with posts/logs to get the author ID
        if ($wpdb->get_var("SHOW TABLES LIKE '$legacy_log_table'")) {
            // Note: Currently daily logs are Posts, so we join wp_posts to get author
            // OR if using custom table, adjust join. Assuming wp_posts for now based on codebase.
            $posts_table = $wpdb->posts;
            $wpdb->query("INSERT IGNORE INTO $unified_reactions_table 
                (object_id, object_type, user_id, reaction_type, item_author_id, created_at)
                SELECT r.log_id, 'daily_log', r.user_id, r.reaction_type, p.post_author, r.created_at
                FROM $legacy_log_table r
                JOIN $posts_table p ON r.log_id = p.ID");
            error_log('Migrated Daily Log reactions to unified table');
        }

        // 2. Migrate Task Card Comment Reactions
        if ($wpdb->get_var("SHOW TABLES LIKE '$legacy_comment_table'")) {
            $comments_source_table = $wpdb->prefix . 'aqp_card_comments';
            $wpdb->query("INSERT IGNORE INTO $unified_reactions_table 
                (object_id, object_type, user_id, reaction_type, item_author_id, created_at)
                SELECT r.comment_id, 'card_comment', r.user_id, r.reaction_type, c.user_id, NOW()
                FROM $legacy_comment_table r
                JOIN $comments_source_table c ON r.comment_id = c.comment_id");
            error_log('Migrated Card Comment reactions to unified table');
        }
    }
    
    // ============================================
    // AWESOME AWARDS MODULE TABLES
    // ============================================
    
    // 4a. CREATE AWESOME AWARDS PERIODS TABLE
    $aa_periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $sql_aa_periods = "CREATE TABLE $aa_periods_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        period_type ENUM('week', 'month') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        voting_start DATE,
        voting_end DATE,
        nomination_deadline DATETIME,
        status VARCHAR(50) DEFAULT 'draft',
        archived TINYINT(1) DEFAULT 0,
        max_winners INT DEFAULT 1,
        allow_pre_voting TINYINT(1) DEFAULT 0,
        created_by BIGINT UNSIGNED,
        tasklist_id BIGINT UNSIGNED,
        taskdeck_enabled TINYINT(1) DEFAULT 0,
        nomination_reminder_roles TEXT,
        voting_reminder_roles TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_dates (start_date, end_date),
        INDEX idx_archived (archived)
    ) $charset_collate;";
    
    dbDelta($sql_aa_periods);
    error_log('Attempted to create Awesome Awards periods table: ' . $aa_periods_table);
    
    // 4b. CREATE AWESOME AWARDS CATEGORIES TABLE
    $aa_categories_table = $wpdb->prefix . 'awesome_awards_categories';
    $sql_aa_categories = "CREATE TABLE $aa_categories_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        period_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        prize_description LONGTEXT,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_period (period_id)
    ) $charset_collate;";
    
    dbDelta($sql_aa_categories);
    error_log('Attempted to create Awesome Awards categories table: ' . $aa_categories_table);
    
    // 4c. CREATE AWESOME AWARDS NOMINATIONS TABLE
    $aa_nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
    $sql_aa_nominations = "CREATE TABLE $aa_nominations_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        period_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED DEFAULT 0,
        category VARCHAR(255) DEFAULT '',
        nominee_id BIGINT UNSIGNED NOT NULL,
        nominator_id BIGINT UNSIGNED NOT NULL,
        reason TEXT,
        reason_json LONGTEXT,
        reason_text TEXT,
        is_anonymous TINYINT(1) DEFAULT 0,
        is_direct_assignment TINYINT(1) DEFAULT 0,
        is_winner TINYINT(1) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        rejection_reason TEXT,
        vote_count INT DEFAULT 0,
        edited_at DATETIME DEFAULT NULL,
        archived TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_period (period_id),
        INDEX idx_category (category_id),
        INDEX idx_nominee (nominee_id),
        INDEX idx_nominator (nominator_id),
        INDEX idx_status (status),
        INDEX idx_winner (is_winner),
        INDEX idx_archived (archived)
    ) $charset_collate;";
    
    dbDelta($sql_aa_nominations);
    error_log('Attempted to create Awesome Awards nominations table: ' . $aa_nominations_table);
    
    // 4d. CREATE AWESOME AWARDS VOTES TABLE
    $aa_votes_table = $wpdb->prefix . 'awesome_awards_votes';
    $sql_aa_votes = "CREATE TABLE $aa_votes_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nomination_id BIGINT UNSIGNED NOT NULL,
        voter_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_vote (nomination_id, voter_id),
        INDEX idx_nomination (nomination_id),
        INDEX idx_voter (voter_id)
    ) $charset_collate;";
    
    dbDelta($sql_aa_votes);
    error_log('Attempted to create Awesome Awards votes table: ' . $aa_votes_table);
    
    // 4e. CREATE AWESOME AWARDS ANNOUNCEMENTS SEEN TABLE
    $aa_announcements_table = $wpdb->prefix . 'awesome_awards_announcements_seen';
    $sql_aa_announcements = "CREATE TABLE $aa_announcements_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        nomination_id BIGINT UNSIGNED NOT NULL,
        announcement_type ENUM('winner', 'rejection') NOT NULL,
        seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_seen (user_id, nomination_id, announcement_type),
        INDEX idx_user (user_id),
        INDEX idx_nomination (nomination_id)
    ) $charset_collate;";
    
    dbDelta($sql_aa_announcements);
    error_log('Attempted to create Awesome Awards announcements seen table: ' . $aa_announcements_table);
    
    // 4f. CREATE AWESOME AWARDS PERMISSIONS TABLE
    $aa_permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
    $sql_aa_permissions = "CREATE TABLE $aa_permissions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_nominate TINYINT(1) DEFAULT 1,
        can_vote TINYINT(1) DEFAULT 0,
        can_approve TINYINT(1) DEFAULT 0,
        can_direct_assign TINYINT(1) DEFAULT 0,
        can_manage_periods TINYINT(1) DEFAULT 0,
        can_view_nominations TINYINT(1) DEFAULT 1,
        can_view_winners TINYINT(1) DEFAULT 1,
        can_view_archives TINYINT(1) DEFAULT 1,
        can_archive TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id)
    ) $charset_collate;";
    
    dbDelta($sql_aa_permissions);
    error_log('Attempted to create Awesome Awards permissions table: ' . $aa_permissions_table);
    
    // 4g. CREATE AWESOME AWARDS TASKDECK CARDS TRACKING TABLE
    $aa_taskdeck_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    $sql_aa_taskdeck = "CREATE TABLE $aa_taskdeck_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        period_id BIGINT UNSIGNED NOT NULL,
        card_type ENUM('nomination', 'voting') NOT NULL DEFAULT 'nomination',
        card_id BIGINT UNSIGNED NOT NULL,
        assigned_roles TEXT,
        is_completed TINYINT(1) DEFAULT 0,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_period_type (period_id, card_type),
        INDEX idx_card (card_id),
        INDEX idx_completed (is_completed)
    ) $charset_collate;";
    
    dbDelta($sql_aa_taskdeck);
    error_log('Attempted to create Awesome Awards TaskDeck cards table: ' . $aa_taskdeck_table);
    
    // ============================================
    // END AWESOME AWARDS TABLES
    // ============================================

    // ============================================
    // SEASONAL RETURNS & PAY MANAGEMENT TABLES
    // ============================================
    
    // SRM 1. CREATE PAY CONFIGURATION TABLE
    $srm_pay_config_table = $wpdb->prefix . 'srm_pay_config';
    $sql_srm_pay_config = "CREATE TABLE $srm_pay_config_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        config_type ENUM('base_rate', 'role_bonus', 'longevity_tier', 'time_bonus', 'pay_cap') NOT NULL,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        job_role_id BIGINT UNSIGNED NULL,
        longevity_years INT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        expiration_date DATE NULL,
        is_recurring TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        effective_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (config_type),
        INDEX idx_active (is_active),
        INDEX idx_job_role (job_role_id),
        INDEX idx_effective (effective_date),
        INDEX idx_expiration (expiration_date)
    ) $charset_collate;";
    
    dbDelta($sql_srm_pay_config);
    error_log('Attempted to create SRM pay config table: ' . $srm_pay_config_table);
    
    // SRM 2. CREATE SEASONS TABLE
    $srm_seasons_table = $wpdb->prefix . 'srm_seasons';
    $sql_srm_seasons = "CREATE TABLE $srm_seasons_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        year INT NOT NULL,
        season_type VARCHAR(50) DEFAULT 'summer',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active TINYINT(1) DEFAULT 0,
        is_current TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active),
        INDEX idx_current (is_current),
        INDEX idx_year (year),
        INDEX idx_dates (start_date, end_date)
    ) $charset_collate;";
    
    dbDelta($sql_srm_seasons);
    error_log('Attempted to create SRM seasons table: ' . $srm_seasons_table);
    
    // SRM 3. CREATE EMPLOYEE SEASONS TABLE
    $srm_employee_seasons_table = $wpdb->prefix . 'srm_employee_seasons';
    $sql_srm_employee_seasons = "CREATE TABLE $srm_employee_seasons_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        season_id BIGINT UNSIGNED NOT NULL,
        status ENUM('pending', 'returning', 'not_returning', 'ineligible') DEFAULT 'pending',
        eligible_for_rehire TINYINT(1) DEFAULT 1,
        is_archived TINYINT(1) DEFAULT 0,
        is_new_hire TINYINT(1) DEFAULT 0,
        return_token VARCHAR(64) NULL,
        token_expires_at DATETIME NULL,
        response_date DATETIME NULL,
        signature_text VARCHAR(255) NULL,
        comments TEXT NULL,
        longevity_years INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_season (user_id, season_id),
        INDEX idx_user (user_id),
        INDEX idx_season (season_id),
        INDEX idx_status (status),
        INDEX idx_token (return_token),
        INDEX idx_eligible (eligible_for_rehire),
        INDEX idx_archived (is_archived),
        INDEX idx_updated_at (updated_at)
    ) $charset_collate;";
    
    dbDelta($sql_srm_employee_seasons);
    error_log('Attempted to create SRM employee seasons table: ' . $srm_employee_seasons_table);
    
    // SRM 4. CREATE EMAIL TEMPLATES TABLE
    $srm_email_templates_table = $wpdb->prefix . 'srm_email_templates';
    $sql_srm_email_templates = "CREATE TABLE $srm_email_templates_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html LONGTEXT NOT NULL,
        body_json LONGTEXT NULL,
        template_type ENUM('initial_invite', 'follow_up', 'confirmation', 'custom') DEFAULT 'custom',
        is_default TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (template_type),
        INDEX idx_default (is_default)
    ) $charset_collate;";
    
    dbDelta($sql_srm_email_templates);
    error_log('Attempted to create SRM email templates table: ' . $srm_email_templates_table);
    
    // SRM 5. CREATE EMAIL LOG TABLE
    $srm_email_log_table = $wpdb->prefix . 'srm_email_log';
    $sql_srm_email_log = "CREATE TABLE $srm_email_log_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        season_id BIGINT UNSIGNED NOT NULL,
        template_id BIGINT UNSIGNED NULL,
        email_type ENUM('initial', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'custom') DEFAULT 'initial',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        opened_at DATETIME NULL,
        clicked_at DATETIME NULL,
        sent_by BIGINT UNSIGNED NOT NULL,
        INDEX idx_user (user_id),
        INDEX idx_season (season_id),
        INDEX idx_sent_at (sent_at)
    ) $charset_collate;";
    
    dbDelta($sql_srm_email_log);
    error_log('Attempted to create SRM email log table: ' . $srm_email_log_table);
    
    // SRM 6. CREATE RETENTION STATS TABLE
    $srm_retention_stats_table = $wpdb->prefix . 'srm_retention_stats';
    $sql_srm_retention_stats = "CREATE TABLE $srm_retention_stats_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        season_id BIGINT UNSIGNED NOT NULL,
        total_eligible INT DEFAULT 0,
        total_invited INT DEFAULT 0,
        total_returning INT DEFAULT 0,
        total_not_returning INT DEFAULT 0,
        total_pending INT DEFAULT 0,
        total_ineligible INT DEFAULT 0,
        total_new_hires INT DEFAULT 0,
        retention_rate DECIMAL(5,2) DEFAULT 0.00,
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_season (season_id),
        INDEX idx_calculated (calculated_at)
    ) $charset_collate;";
    
    dbDelta($sql_srm_retention_stats);
    error_log('Attempted to create SRM retention stats table: ' . $srm_retention_stats_table);
    
    // SRM 7. CREATE PERMISSIONS TABLE
    $srm_permissions_table = $wpdb->prefix . 'srm_permissions';
    $sql_srm_permissions = "CREATE TABLE $srm_permissions_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        job_role_id BIGINT UNSIGNED NOT NULL,
        srm_view_own_pay TINYINT(1) DEFAULT 1,
        srm_view_all_pay TINYINT(1) DEFAULT 0,
        srm_manage_pay_config TINYINT(1) DEFAULT 0,
        srm_send_invites TINYINT(1) DEFAULT 0,
        srm_view_responses TINYINT(1) DEFAULT 0,
        srm_manage_status TINYINT(1) DEFAULT 0,
        srm_manage_templates TINYINT(1) DEFAULT 0,
        srm_view_retention TINYINT(1) DEFAULT 0,
        srm_bulk_actions TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_role (job_role_id)
    ) $charset_collate;";
    
    dbDelta($sql_srm_permissions);
    error_log('Attempted to create SRM permissions table: ' . $srm_permissions_table);
    
    // Insert default SRM permissions based on job role tier
    $existing_srm_perms = $wpdb->get_var("SELECT COUNT(*) FROM $srm_permissions_table");
    
    if ($existing_srm_perms == 0) {
        $job_roles = $wpdb->get_results("SELECT id, tier FROM $job_roles_table");
        
        foreach ($job_roles as $role) {
            $tier = (int) $role->tier;
            
            // Tier 5-6: Full admin access
            if ($tier >= 5) {
                $srm_perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 1,
                    'srm_manage_pay_config' => 1,
                    'srm_send_invites' => 1,
                    'srm_view_responses' => 1,
                    'srm_manage_status' => 1,
                    'srm_manage_templates' => 1,
                    'srm_view_retention' => 1,
                    'srm_bulk_actions' => 1
                ];
            }
            // Tier 3-4: Can view and send invites
            elseif ($tier >= 3) {
                $srm_perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 1,
                    'srm_manage_pay_config' => 0,
                    'srm_send_invites' => 1,
                    'srm_view_responses' => 1,
                    'srm_manage_status' => 0,
                    'srm_manage_templates' => 0,
                    'srm_view_retention' => 1,
                    'srm_bulk_actions' => 0
                ];
            }
            // Tier 1-2: Can only view own pay
            else {
                $srm_perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 0,
                    'srm_manage_pay_config' => 0,
                    'srm_send_invites' => 0,
                    'srm_view_responses' => 0,
                    'srm_manage_status' => 0,
                    'srm_manage_templates' => 0,
                    'srm_view_retention' => 0,
                    'srm_bulk_actions' => 0
                ];
            }
            
            $wpdb->insert($srm_permissions_table, $srm_perms);
        }
        
        error_log('Populated SRM permissions for all job roles');
    }
    
    // Insert default email templates if empty
    $existing_templates = $wpdb->get_var("SELECT COUNT(*) FROM $srm_email_templates_table");
    
    if ($existing_templates == 0) {
        // Default initial invite template
        $wpdb->insert($srm_email_templates_table, [
            'name' => 'Default Return Invite',
            'subject' => 'Are You Returning for {{season_name}}?',
            'body_html' => '<p>Hi {{first_name}},</p>
<p>We hope you\'re doing well! As we prepare for {{season_name}}, we\'d love to know if you\'re planning to return.</p>
<p><strong>Your Current Information:</strong></p>
<ul>
<li>Position(s): {{job_roles}}</li>
<li>Pay Rate: {{current_pay_rate}}/hr</li>
<li>Years with Us: {{longevity_years}}</li>
</ul>
<p>If you return for {{season_name}}, your projected pay rate will be: <strong>{{projected_pay_rate}}/hr</strong></p>
<p>Please let us know your intentions by clicking the link below:</p>
<p><a href="{{return_form_link}}">Click here to respond</a></p>
<p>We\'d appreciate your response by {{response_deadline}}.</p>
<p>Thank you for being part of our team!</p>',
            'template_type' => 'initial_invite',
            'is_default' => 1
        ]);
        
        // Default follow-up template
        $wpdb->insert($srm_email_templates_table, [
            'name' => 'Default Follow-Up',
            'subject' => 'Reminder: {{season_name}} Return Intent Needed',
            'body_html' => '<p>Hi {{first_name}},</p>
<p>We haven\'t heard back from you yet about returning for {{season_name}}.</p>
<p>As a reminder, your projected pay rate would be: <strong>{{projected_pay_rate}}/hr</strong></p>
<p>Please take a moment to let us know your plans:</p>
<p><a href="{{return_form_link}}">Click here to respond</a></p>
<p>If you have any questions, please don\'t hesitate to reach out.</p>
<p>Thank you!</p>',
            'template_type' => 'follow_up',
            'is_default' => 1
        ]);
        
        error_log('Inserted default SRM email templates');
    }
    
    // Enable Seasonal Returns module by default for new installations
    if ( get_option( 'aquaticpro_enable_seasonal_returns' ) === false ) {
        add_option( 'aquaticpro_enable_seasonal_returns', true );
        error_log('Enabled Seasonal Returns module by default');
    }
    
    // SRM 8. CREATE LONGEVITY RATES BY YEAR TABLE
    // Stores the longevity bonus rate for each calendar year
    $srm_longevity_rates_table = $wpdb->prefix . 'srm_longevity_rates';
    $sql_srm_longevity_rates = "CREATE TABLE $srm_longevity_rates_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        work_year INT NOT NULL COMMENT 'Calendar year (e.g., 2025)',
        rate DECIMAL(10,2) NOT NULL COMMENT 'Longevity bonus rate for this year',
        notes TEXT NULL COMMENT 'Optional admin notes',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_year (work_year),
        INDEX idx_year (work_year)
    ) $charset_collate;";
    
    dbDelta($sql_srm_longevity_rates);
    error_log('Attempted to create SRM longevity rates table: ' . $srm_longevity_rates_table);
    
    // Populate default longevity rates (2015-2025 at $0.75) if empty
    $existing_rates = $wpdb->get_var("SELECT COUNT(*) FROM $srm_longevity_rates_table");
    if ($existing_rates == 0) {
        for ($year = 2015; $year <= 2025; $year++) {
            $wpdb->insert($srm_longevity_rates_table, [
                'work_year' => $year,
                'rate' => 0.75,
                'notes' => 'Historical rate'
            ]);
        }
        error_log('Populated default longevity rates for 2015-2025');
    }
    
    // SRM 9. CREATE EMPLOYEE WORK YEARS TABLE
    // Tracks which calendar years each employee actually worked
    $srm_employee_work_years_table = $wpdb->prefix . 'srm_employee_work_years';
    $sql_srm_employee_work_years = "CREATE TABLE $srm_employee_work_years_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        work_year INT NOT NULL COMMENT 'Calendar year the employee worked',
        verified TINYINT(1) DEFAULT 0 COMMENT 'Admin-verified year',
        verified_by BIGINT UNSIGNED NULL COMMENT 'User who verified',
        verified_at DATETIME NULL,
        notes TEXT NULL COMMENT 'Optional notes about this work year',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_year (user_id, work_year),
        INDEX idx_user (user_id),
        INDEX idx_year (work_year),
        INDEX idx_verified (verified)
    ) $charset_collate;";
    
    dbDelta($sql_srm_employee_work_years);
    error_log('Attempted to create SRM employee work years table: ' . $srm_employee_work_years_table);
    
    // SRM 10. ADD SETTING FOR ANNIVERSARY YEAR MODE
    // Options: 'season' (the season they're returning to) or 'anniversary' (calendar year of work anniversary)
    if ( get_option( 'srm_anniversary_year_mode' ) === false ) {
        add_option( 'srm_anniversary_year_mode', 'season' );
        error_log('Set default SRM anniversary year mode to: season');
    }
    
    // SRM 11. CREATE PAY RATE CACHE TABLE
    // Stores pre-calculated pay rates to avoid memory-intensive calculations on every request
    $srm_pay_cache_table = $wpdb->prefix . 'srm_pay_cache';
    $sql_srm_pay_cache = "CREATE TABLE $srm_pay_cache_table (
        user_id BIGINT UNSIGNED PRIMARY KEY,
        pay_data LONGTEXT NOT NULL COMMENT 'JSON-encoded current pay breakdown',
        projected_data LONGTEXT NULL COMMENT 'JSON-encoded projected pay for next season',
        calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_calculated (calculated_at)
    ) $charset_collate;";
    
    dbDelta($sql_srm_pay_cache);
    error_log('Attempted to create SRM pay cache table: ' . $srm_pay_cache_table);
    
    // SRM 12. CREATE IN-SERVICE HOURS CACHE TABLE
    // Stores pre-calculated monthly in-service hours to avoid expensive joins on every compliance view
    $pg_inservice_cache_table = $wpdb->prefix . 'pg_inservice_cache';
    $sql_pg_inservice_cache = "CREATE TABLE $pg_inservice_cache_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
        total_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        required_hours DECIMAL(5,2) NOT NULL DEFAULT 4,
        meets_requirement TINYINT(1) NOT NULL DEFAULT 0,
        training_count INT NOT NULL DEFAULT 0 COMMENT 'Number of trainings attended',
        calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_month (user_id, month),
        INDEX idx_month (month),
        INDEX idx_calculated (calculated_at)
    ) $charset_collate;";
    
    dbDelta($sql_pg_inservice_cache);
    error_log('Attempted to create PG in-service cache table: ' . $pg_inservice_cache_table);
    
    // ============================================
    // END SEASONAL RETURNS TABLES
    // ============================================

    // 5. CREATE DASHBOARD ACTION BUTTONS TABLE
    $action_buttons_table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    $sql_action_buttons = "CREATE TABLE $action_buttons_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        color VARCHAR(50) DEFAULT 'blue',
        thumbnail_url VARCHAR(500),
        visible_to_roles TEXT,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sort (sort_order)
    ) $charset_collate;";
    
    dbDelta($sql_action_buttons);
    
    error_log('Attempted to create action buttons table: ' . $action_buttons_table);
    
    // Insert default permissions based on job role tier for ALL permission tables
    // Check EACH table individually and populate if empty
    $permission_tables = [
        $permissions_table,
        $scan_audit_permissions_table,
        $live_drill_permissions_table,
        $inservice_permissions_table,
        $cashier_audit_permissions_table,
        $taskdeck_permissions_table
    ];
    
    foreach ($permission_tables as $perm_table) {
        $existing_perms = $wpdb->get_var("SELECT COUNT(*) FROM $perm_table");
        
        if ($existing_perms == 0) {
            $job_roles = $wpdb->get_results("SELECT id, tier FROM $job_roles_table");
            
            foreach ($job_roles as $role) {
                $tier = (int) $role->tier;
                
                // Tier 5-6: Full access including moderation
                if ($tier >= 5) {
                    $permissions = [
                        'job_role_id' => $role->id,
                        'can_view' => 1,
                        'can_create' => 1,
                        'can_edit' => 1,
                        'can_delete' => 1,
                        'can_moderate_all' => 1
                    ];
                }
                // Tier 3-4: Can create and edit own
                elseif ($tier >= 3) {
                    $permissions = [
                        'job_role_id' => $role->id,
                        'can_view' => 1,
                        'can_create' => 1,
                        'can_edit' => 1,
                        'can_delete' => 1,
                        'can_moderate_all' => 0
                    ];
                }
                // Tier 1-2: View only
                else {
                    $permissions = [
                        'job_role_id' => $role->id,
                        'can_view' => 1,
                        'can_create' => 0,
                        'can_edit' => 0,
                        'can_delete' => 0,
                        'can_moderate_all' => 0
                    ];
                }
                
                // Insert into this specific permission table
                $wpdb->insert($perm_table, $permissions, ['%d', '%d', '%d', '%d', '%d', '%d']);
            }
            
            error_log('Populated permissions for table: ' . $perm_table);
        }
    }
    
    // ============================================
    // POPULATE AWESOME AWARDS PERMISSIONS (Special defaults)
    // All users can nominate and view by default
    // ============================================
    $existing_aa_perms = $wpdb->get_var("SELECT COUNT(*) FROM $aa_permissions_table");
    
    if ($existing_aa_perms == 0) {
        $job_roles = $wpdb->get_results("SELECT id, tier FROM $job_roles_table");
        
        foreach ($job_roles as $role) {
            $tier = (int) $role->tier;
            
            // Tier 5-6: Full admin access
            if ($tier >= 5) {
                $aa_permissions = [
                    'job_role_id' => $role->id,
                    'can_nominate' => 1,
                    'can_vote' => 1,
                    'can_approve' => 1,
                    'can_direct_assign' => 1,
                    'can_manage_periods' => 1,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 1
                ];
            }
            // Tier 3-4: Can vote in addition to nominate
            elseif ($tier >= 3) {
                $aa_permissions = [
                    'job_role_id' => $role->id,
                    'can_nominate' => 1,
                    'can_vote' => 1,
                    'can_approve' => 0,
                    'can_direct_assign' => 0,
                    'can_manage_periods' => 0,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 0
                ];
            }
            // Tier 1-2: Can nominate and view (default for all)
            else {
                $aa_permissions = [
                    'job_role_id' => $role->id,
                    'can_nominate' => 1,
                    'can_vote' => 0,
                    'can_approve' => 0,
                    'can_direct_assign' => 0,
                    'can_manage_periods' => 0,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 0
                ];
            }
            
            $wpdb->insert($aa_permissions_table, $aa_permissions, 
                ['%d', '%d', '%d', '%d', '%d', '%d', '%d', '%d', '%d', '%d']);
        }
        
        error_log('Populated Awesome Awards permissions table');
    }
    
    // Update plugin version to track migrations
    update_option('mp_db_version', '4.2.1');
}

// Register activation hook
register_activation_hook(__FILE__, 'mp_run_database_migrations');

// Also run on plugin update (check version)
function mp_check_database_updates() {
    global $_aquaticpro_boot_start;
    $start = microtime(true);
    
    $current_version = get_option('mp_db_version', '0');
    if (version_compare($current_version, '4.2.1', '<')) {
        aquaticpro_log_timing('Running full DB migrations...');
        mp_run_database_migrations();
        aquaticpro_log_timing('DB migrations completed', $start);
    }
    
    // Run schema fixes only on version update, not every page load
    // This prevents expensive SHOW COLUMNS queries on every request
    $schema_version = get_option('mp_schema_version', '0');
    if (version_compare($schema_version, '4.3.2', '<')) {
        aquaticpro_log_timing('Running schema fixes (first time only)...');
        $schema_start = microtime(true);
        mp_fix_database_schema();
        update_option('mp_schema_version', '4.3.2');
        aquaticpro_log_timing('Schema fixes completed', $schema_start);
    }
    
    // Add pay_cap to srm_pay_config ENUM (v4.4.0)
    $srm_version = get_option('mp_srm_schema_version', '0');
    if (version_compare($srm_version, '4.4.0', '<')) {
        mp_add_pay_cap_enum();
        update_option('mp_srm_schema_version', '4.4.0');
    }
    
    // Add longevity rates tables (v4.5.0)
    $longevity_version = get_option('mp_longevity_version', '0');
    if (version_compare($longevity_version, '4.5.0', '<')) {
        mp_create_longevity_tables();
        update_option('mp_longevity_version', '4.5.0');
    }
    
    // Add performance indexes (runs once per version)
    $index_version = get_option('mp_index_version', '0');
    if (version_compare($index_version, '1.0.0', '<')) {
        mp_add_performance_indexes();
        update_option('mp_index_version', '1.0.0');
    }
    
    // Create instructor evaluation logs table (v4.6.0)
    $instructor_eval_version = get_option('mp_instructor_eval_version', '0');
    if (version_compare($instructor_eval_version, '4.6.0', '<')) {
        mp_create_instructor_evaluation_table();
        update_option('mp_instructor_eval_version', '4.6.0');
    }
    
    // FIX: Clear potentially stale job roles cache if it's empty
    // This prevents a cached empty array from breaking user role checks
    $job_roles_cache = get_transient('mp_job_roles_with_permissions');
    if ($job_roles_cache !== false && empty($job_roles_cache)) {
        delete_transient('mp_job_roles_with_permissions');
        error_log('[AquaticPro] Cleared stale empty job roles cache');
    }
    
    aquaticpro_log_timing('mp_check_database_updates total', $start);
    aquaticpro_log_timing('Plugin boot total', $_aquaticpro_boot_start);
}
add_action('plugins_loaded', 'mp_check_database_updates');

/**
 * Fix missing database columns and tables
 * This runs on every page load but uses quick column checks to avoid performance impact
 */
function mp_fix_database_schema() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    // ============================================
    // 0. CREATE pg_instructor_evaluation_permissions IF MISSING
    // ============================================
    $instructor_eval_perms_table = $wpdb->prefix . 'pg_instructor_evaluation_permissions';
    if (!$wpdb->get_var("SHOW TABLES LIKE '{$instructor_eval_perms_table}'")) {
        // Create table if missing
        $sql = "CREATE TABLE $instructor_eval_perms_table (
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
        ) $charset_collate;";
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        error_log("[DB FIX] Created missing table: {$instructor_eval_perms_table}");
    }
    
    // ============================================
    // 1. FIX pg_taskdeck_permissions - add missing columns
    // ============================================
    $taskdeck_perms_table = $wpdb->prefix . 'pg_taskdeck_permissions';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$taskdeck_perms_table}'");
    
    if ($table_exists) {
        // Check for can_manage_primary_deck column
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskdeck_perms_table} LIKE 'can_manage_primary_deck'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskdeck_perms_table} ADD COLUMN can_manage_primary_deck TINYINT(1) NOT NULL DEFAULT 0 AFTER can_moderate_all");
            error_log("[DB FIX] Added can_manage_primary_deck column to {$taskdeck_perms_table}");
        }
        
        // Check for can_manage_all_primary_cards column (new - view/edit all cards on primary deck only)
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskdeck_perms_table} LIKE 'can_manage_all_primary_cards'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskdeck_perms_table} ADD COLUMN can_manage_all_primary_cards TINYINT(1) NOT NULL DEFAULT 0 AFTER can_manage_primary_deck");
            error_log("[DB FIX] Added can_manage_all_primary_cards column to {$taskdeck_perms_table}");
        }
        
        // Check for can_create_public_decks column
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskdeck_perms_table} LIKE 'can_create_public_decks'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskdeck_perms_table} ADD COLUMN can_create_public_decks TINYINT(1) NOT NULL DEFAULT 0 AFTER can_manage_all_primary_cards");
            error_log("[DB FIX] Added can_create_public_decks column to {$taskdeck_perms_table}");
        }
        
        // Check for can_view_only_assigned column (new - for viewing only assigned cards on public decks)
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskdeck_perms_table} LIKE 'can_view_only_assigned'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskdeck_perms_table} ADD COLUMN can_view_only_assigned TINYINT(1) NOT NULL DEFAULT 0 AFTER can_view");
            error_log("[DB FIX] Added can_view_only_assigned column to {$taskdeck_perms_table}");
        }
    }
    
    // ============================================
    // 2. FIX pg_reports_permissions - create table if missing
    // ============================================
    $reports_perms_table = $wpdb->prefix . 'pg_reports_permissions';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$reports_perms_table}'");
    
    if (!$table_exists) {
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        $sql = "CREATE TABLE {$reports_perms_table} (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            job_role_id BIGINT UNSIGNED NOT NULL,
            can_view_all_records TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_role (job_role_id)
        ) {$charset_collate};";
        dbDelta($sql);
        error_log("[DB FIX] Created {$reports_perms_table} table");
    }
    
    // ============================================
    // 3. FIX aqp_taskdecks - add is_primary column
    // ============================================
    $taskdecks_table = $wpdb->prefix . 'aqp_taskdecks';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$taskdecks_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskdecks_table} LIKE 'is_primary'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskdecks_table} ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0 AFTER is_public");
            error_log("[DB FIX] Added is_primary column to {$taskdecks_table}");
        }
    }
    
    // ============================================
    // 4. FIX pg_inservice_attendees - check column name
    // NOTE: This table uses 'inservice_id' column, not 'log_id' - this is correct
    // The check below only runs if we detect the old 'inservice_log_id' naming
    // ============================================
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$attendees_table}'");
    
    if ($table_exists) {
        // Only check if we need to migrate from old column name
        $inservice_log_id_col = $wpdb->get_results("SHOW COLUMNS FROM {$attendees_table} LIKE 'inservice_log_id'");
        
    // ============================================
    // 5. FIX pg_user_metadata - add eligible_for_rehire column
    // ============================================
    $metadata_table = $wpdb->prefix . 'pg_user_metadata';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$metadata_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$metadata_table} LIKE 'eligible_for_rehire'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$metadata_table} ADD COLUMN eligible_for_rehire TINYINT(1) DEFAULT 1 AFTER notes");
            error_log("[DB FIX] Added eligible_for_rehire column to {$metadata_table}");
        }

        // Add is_member column
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$metadata_table} LIKE 'is_member'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$metadata_table} ADD COLUMN is_member TINYINT(1) DEFAULT NULL AFTER eligible_for_rehire");
            // Set index for performance
            $wpdb->query("ALTER TABLE {$metadata_table} ADD INDEX idx_is_member (is_member)");
            error_log("[DB FIX] Added is_member column to {$metadata_table}");
        }
    }
        
        if (!empty($inservice_log_id_col)) {
            // Rename column from inservice_log_id to inservice_id for consistency
            $wpdb->query("ALTER TABLE {$attendees_table} CHANGE COLUMN inservice_log_id inservice_id BIGINT UNSIGNED NOT NULL");
            error_log("[DB FIX] Renamed inservice_log_id to inservice_id in {$attendees_table}");
        }
        // If neither inservice_log_id exists, table is already using correct schema (inservice_id)
    }
    
    // ============================================
    // 5. CREATE aqp_card_assignees - Multi-user assignment for cards
    // ============================================
    $card_assignees_table = $wpdb->prefix . 'aqp_card_assignees';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$card_assignees_table}'");
    
    if (!$table_exists) {
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        $sql = "CREATE TABLE {$card_assignees_table} (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            card_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            assigned_by BIGINT UNSIGNED,
            UNIQUE KEY unique_card_user (card_id, user_id),
            KEY idx_card (card_id),
            KEY idx_user (user_id)
        ) {$charset_collate};";
        dbDelta($sql);
        error_log("[DB FIX] Created {$card_assignees_table} table for multi-user card assignment");
        
        // Migrate existing single assignments to new table
        $cards_table = $wpdb->prefix . 'aqp_taskcards';
        $wpdb->query("INSERT IGNORE INTO {$card_assignees_table} (card_id, user_id, assigned_at)
            SELECT card_id, assigned_to, updated_at FROM {$cards_table} WHERE assigned_to IS NOT NULL AND assigned_to > 0");
        error_log("[DB FIX] Migrated existing user assignments to {$card_assignees_table}");
    }
    
    // ============================================
    // 6. CREATE aqp_card_assigned_roles - Multi-role assignment for cards
    // ============================================
    $card_roles_table = $wpdb->prefix . 'aqp_card_assigned_roles';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$card_roles_table}'");
    
    if (!$table_exists) {
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        $sql = "CREATE TABLE {$card_roles_table} (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            card_id BIGINT UNSIGNED NOT NULL,
            role_id BIGINT UNSIGNED NOT NULL,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            assigned_by BIGINT UNSIGNED,
            UNIQUE KEY unique_card_role (card_id, role_id),
            KEY idx_card (card_id),
            KEY idx_role (role_id)
        ) {$charset_collate};";
        dbDelta($sql);
        error_log("[DB FIX] Created {$card_roles_table} table for multi-role card assignment");
        
        // Migrate existing single role assignments to new table
        $cards_table = $wpdb->prefix . 'aqp_taskcards';
        $wpdb->query("INSERT IGNORE INTO {$card_roles_table} (card_id, role_id, assigned_at)
            SELECT card_id, assigned_to_role_id, updated_at FROM {$cards_table} WHERE assigned_to_role_id IS NOT NULL AND assigned_to_role_id > 0");
        error_log("[DB FIX] Migrated existing role assignments to {$card_roles_table}");
    }
    
    // ============================================
    // 7. FIX aqp_dashboard_action_buttons - add visible_to_roles column
    // ============================================
    $action_buttons_table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$action_buttons_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$action_buttons_table} LIKE 'visible_to_roles'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$action_buttons_table} ADD COLUMN visible_to_roles TEXT AFTER thumbnail_url");
            error_log("[DB FIX] Added visible_to_roles column to {$action_buttons_table}");
        }
    }

    // ============================================
    // 8. FIX awesome_awards_periods - add TaskDeck reminder columns
    // ============================================
    $aa_periods_table = $wpdb->prefix . 'awesome_awards_periods';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$aa_periods_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$aa_periods_table} LIKE 'taskdeck_enabled'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$aa_periods_table} ADD COLUMN taskdeck_enabled TINYINT(1) DEFAULT 0 AFTER created_by");
            $wpdb->query("ALTER TABLE {$aa_periods_table} ADD COLUMN nomination_reminder_roles TEXT AFTER taskdeck_enabled");
            $wpdb->query("ALTER TABLE {$aa_periods_table} ADD COLUMN voting_reminder_roles TEXT AFTER nomination_reminder_roles");
            error_log("[DB FIX] Added TaskDeck reminder columns to {$aa_periods_table}");
        }
        
        // Add max_winners and allow_pre_voting columns if they don't exist
        $max_winners_col = $wpdb->get_results("SHOW COLUMNS FROM {$aa_periods_table} LIKE 'max_winners'");
        if (empty($max_winners_col)) {
            $wpdb->query("ALTER TABLE {$aa_periods_table} ADD COLUMN max_winners INT DEFAULT 1 AFTER archived");
            $wpdb->query("ALTER TABLE {$aa_periods_table} ADD COLUMN allow_pre_voting TINYINT(1) DEFAULT 0 AFTER max_winners");
            error_log("[DB FIX] Added max_winners and allow_pre_voting columns to {$aa_periods_table}");
        }
    }

    // ============================================
    // 9. FIX awesome_awards_taskdeck_cards - add card_type and completion tracking
    // ============================================
    $aa_taskdeck_table = $wpdb->prefix . 'awesome_awards_taskdeck_cards';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$aa_taskdeck_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$aa_taskdeck_table} LIKE 'card_type'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} ADD COLUMN card_type ENUM('nomination', 'voting') NOT NULL DEFAULT 'nomination' AFTER period_id");
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} ADD COLUMN assigned_roles TEXT AFTER card_id");
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} ADD COLUMN is_completed TINYINT(1) DEFAULT 0 AFTER assigned_roles");
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} ADD COLUMN completed_at DATETIME AFTER is_completed");
            // Update unique key to include card_type
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} DROP INDEX unique_period");
            $wpdb->query("ALTER TABLE {$aa_taskdeck_table} ADD UNIQUE KEY unique_period_type (period_id, card_type)");
            error_log("[DB FIX] Added card_type and completion tracking to {$aa_taskdeck_table}");
        }
    }
    
    // ============================================
    // 10. ADD action_url to aqp_taskcards for clickable cards
    // ============================================
    $taskcards_table = $wpdb->prefix . 'aqp_taskcards';
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$taskcards_table}'");
    
    if ($table_exists) {
        $col = $wpdb->get_results("SHOW COLUMNS FROM {$taskcards_table} LIKE 'action_url'");
        if (empty($col)) {
            $wpdb->query("ALTER TABLE {$taskcards_table} ADD COLUMN action_url VARCHAR(500) DEFAULT NULL AFTER description");
            error_log("[DB FIX] Added action_url column to {$taskcards_table}");
        }
    }
}

/**
 * Add pay_cap to srm_pay_config ENUM
 * Alters the config_type column to include the new pay_cap option
 */
function mp_add_pay_cap_enum() {
    global $wpdb;
    
    $table = $wpdb->prefix . 'srm_pay_config';
    
    // Check if table exists
    if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
        return; // Table doesn't exist yet, will be created with correct ENUM
    }
    
    // Alter the ENUM to include pay_cap
    $result = $wpdb->query(
        "ALTER TABLE $table MODIFY COLUMN config_type ENUM('base_rate', 'role_bonus', 'longevity_tier', 'time_bonus', 'pay_cap') NOT NULL"
    );
    
    if ($result !== false) {
        error_log('[AquaticPro] Successfully added pay_cap to srm_pay_config ENUM');
    } else {
        error_log('[AquaticPro] Failed to add pay_cap to srm_pay_config ENUM: ' . $wpdb->last_error);
    }
}

/**
 * Create longevity rates tables for year-based longevity tracking
 */
function mp_create_longevity_tables() {
    global $wpdb;
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    $charset_collate = $wpdb->get_charset_collate();
    
    // Create srm_longevity_rates table
    $rates_table = $wpdb->prefix . 'srm_longevity_rates';
    if ($wpdb->get_var("SHOW TABLES LIKE '$rates_table'") !== $rates_table) {
        $sql = "CREATE TABLE $rates_table (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            work_year INT NOT NULL COMMENT 'Calendar year (e.g., 2025)',
            rate DECIMAL(10,2) NOT NULL COMMENT 'Longevity bonus rate for this year',
            notes TEXT NULL COMMENT 'Optional admin notes',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_year (work_year),
            INDEX idx_year (work_year)
        ) $charset_collate;";
        
        dbDelta($sql);
        error_log('[AquaticPro] Created srm_longevity_rates table');
        
        // Populate default rates (2015-2025 at $0.75) if empty
        $existing_rates = $wpdb->get_var("SELECT COUNT(*) FROM $rates_table");
        if ($existing_rates == 0) {
            for ($year = 2015; $year <= 2025; $year++) {
                $wpdb->insert($rates_table, [
                    'work_year' => $year,
                    'rate' => 0.75,
                    'notes' => 'Historical rate'
                ]);
            }
            error_log('[AquaticPro] Populated default longevity rates for 2015-2025');
        }
    }
    
    // Create srm_employee_work_years table
    $years_table = $wpdb->prefix . 'srm_employee_work_years';
    if ($wpdb->get_var("SHOW TABLES LIKE '$years_table'") !== $years_table) {
        $sql = "CREATE TABLE $years_table (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            work_year INT NOT NULL COMMENT 'Calendar year the employee worked',
            verified TINYINT(1) DEFAULT 0 COMMENT 'Admin-verified year',
            verified_by BIGINT UNSIGNED NULL COMMENT 'User who verified',
            verified_at DATETIME NULL,
            notes TEXT NULL COMMENT 'Optional notes about this work year',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_year (user_id, work_year),
            INDEX idx_user (user_id),
            INDEX idx_year (work_year),
            INDEX idx_verified (verified)
        ) $charset_collate;";
        
        dbDelta($sql);
        error_log('[AquaticPro] Created srm_employee_work_years table');
    }
    
    // Add anniversary year mode setting if not exists
    if (get_option('srm_anniversary_year_mode') === false) {
        add_option('srm_anniversary_year_mode', 'season');
        error_log('[AquaticPro] Set default SRM anniversary year mode to: season');
    }
}

/**
 * Create instructor evaluation logs table
 * For tracking swim instructor evaluations by supervisors
 */
function mp_create_instructor_evaluation_table() {
    global $wpdb;
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    $charset_collate = $wpdb->get_charset_collate();
    $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
    
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            evaluated_user_id bigint(20) NOT NULL,
            evaluator_id bigint(20) NOT NULL,
            evaluation_date datetime NOT NULL,
            command_language tinyint(1) DEFAULT NULL,
            minimizing_downtime tinyint(1) DEFAULT NULL,
            periodic_challenges tinyint(1) DEFAULT NULL,
            provides_feedback tinyint(1) DEFAULT NULL,
            rules_expectations tinyint(1) DEFAULT NULL,
            learning_environment tinyint(1) DEFAULT NULL,
            comments text NOT NULL,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY evaluated_user_id (evaluated_user_id),
            KEY evaluator_id (evaluator_id),
            KEY evaluation_date (evaluation_date),
            KEY archived (archived)
        ) $charset_collate;";
        
        dbDelta($sql);
        error_log('[AquaticPro] Created pg_instructor_evaluation_logs table');
    }
}

/**
 * Add performance indexes to tables for optimizing queries
 * This function safely adds indexes only if they don't already exist
 */
function mp_add_performance_indexes() {
    global $wpdb;
    
    // Helper function to check if an index exists
    $index_exists = function($table, $index_name) use ($wpdb) {
        $result = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND INDEX_NAME = %s",
            DB_NAME, $table, $index_name
        ));
        return $result > 0;
    };
    
    // Helper function to safely add an index
    $add_index = function($table, $index_name, $columns) use ($wpdb, $index_exists) {
        if (!$index_exists($table, $index_name)) {
            $wpdb->query("ALTER TABLE {$table} ADD INDEX {$index_name} ({$columns})");
            error_log("[DB INDEX] Added index {$index_name} on {$table}({$columns})");
            return true;
        }
        return false;
    };
    
    // ============================================
    // Daily Logs Performance Indexes
    // ============================================
    $daily_logs_table = $wpdb->prefix . 'mp_daily_logs';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$daily_logs_table}'")) {
        $add_index($daily_logs_table, 'idx_author_date', 'author_id, log_date');
        $add_index($daily_logs_table, 'idx_location', 'location_id');
        $add_index($daily_logs_table, 'idx_status', 'status');
    }
    
    // ============================================
    // Daily Log Comments Performance Indexes
    // ============================================
    $comments_table = $wpdb->prefix . 'mp_daily_log_comments';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$comments_table}'")) {
        $add_index($comments_table, 'idx_log_id', 'log_id');
        $add_index($comments_table, 'idx_user_id', 'user_id');
    }
    
    // ============================================
    // Daily Log Reactions Performance Indexes
    // ============================================
    $reactions_table = $wpdb->prefix . 'mp_daily_log_reactions';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$reactions_table}'")) {
        // Note: idx_log and idx_user already exist from table creation
        // But add composite index for common queries
        $add_index($reactions_table, 'idx_log_user', 'log_id, user_id');
    }
    
    // ============================================
    // Professional Growth: User Job Assignments
    // ============================================
    $job_assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$job_assignments_table}'")) {
        $add_index($job_assignments_table, 'idx_user_primary', 'user_id, is_primary');
        $add_index($job_assignments_table, 'idx_role_primary', 'job_role_id, is_primary');
    }
    
    // ============================================
    // Professional Growth: In-Service Logs
    // ============================================
    $inservice_logs_table = $wpdb->prefix . 'pg_inservice_logs';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$inservice_logs_table}'")) {
        $add_index($inservice_logs_table, 'idx_user_date', 'created_by, training_date');
        $add_index($inservice_logs_table, 'idx_archived_date', 'archived, training_date');
    }
    
    // ============================================
    // TaskDeck: Task Cards Performance Indexes
    // ============================================
    $taskcards_table = $wpdb->prefix . 'aqp_taskcards';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$taskcards_table}'")) {
        // Add composite indexes for common query patterns
        $add_index($taskcards_table, 'idx_list_complete', 'list_id, is_complete');
        $add_index($taskcards_table, 'idx_list_sort', 'list_id, sort_order');
        $add_index($taskcards_table, 'idx_complete_updated', 'is_complete, updated_at');
    }
    
    // ============================================
    // TaskDeck: Task Lists Performance Indexes
    // ============================================
    $tasklists_table = $wpdb->prefix . 'aqp_tasklists';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$tasklists_table}'")) {
        $add_index($tasklists_table, 'idx_deck_sort', 'deck_id, sort_order');
    }
    
    // ============================================
    // Card Assignees Performance Indexes
    // ============================================
    $card_assignees_table = $wpdb->prefix . 'aqp_card_assignees';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$card_assignees_table}'")) {
        // idx_card and idx_user already exist from table creation
        // Add for reverse lookups
        $add_index($card_assignees_table, 'idx_user_card', 'user_id, card_id');
    }
    
    // ============================================
    // Card Assigned Roles Performance Indexes
    // ============================================
    $card_roles_table = $wpdb->prefix . 'aqp_card_assigned_roles';
    if ($wpdb->get_var("SHOW TABLES LIKE '{$card_roles_table}'")) {
        // idx_card and idx_role already exist from table creation
        $add_index($card_roles_table, 'idx_role_card', 'role_id, card_id');
    }
}

/**
 * Sync Daily Log Permissions for all job roles
 * Can be called manually to ensure all roles have permissions
 */
function mp_sync_daily_log_permissions() {
    global $wpdb;
    
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $job_roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Get all job roles
    $job_roles = $wpdb->get_results("SELECT id, tier FROM $job_roles_table");
    
    if (empty($job_roles)) {
        return ['success' => false, 'message' => 'No job roles found. Please create job roles first.'];
    }
    
    $added = 0;
    $skipped = 0;
    
    foreach ($job_roles as $role) {
        // Check if permission already exists
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $permissions_table WHERE job_role_id = %d",
            $role->id
        ));
        
        if ($exists > 0) {
            $skipped++;
            continue;
        }
        
        $tier = (int) $role->tier;
        
        // Determine default permissions based on tier
        if ($tier >= 5) {
            $permissions = [
                'job_role_id' => $role->id,
                'can_view' => 1,
                'can_create' => 1,
                'can_edit' => 1,
                'can_delete' => 1,
                'can_moderate_all' => 1
            ];
        } elseif ($tier >= 3) {
            $permissions = [
                'job_role_id' => $role->id,
                'can_view' => 1,
                'can_create' => 1,
                'can_edit' => 1,
                'can_delete' => 1,
                'can_moderate_all' => 0
            ];
        } else {
            $permissions = [
                'job_role_id' => $role->id,
                'can_view' => 1,
                'can_create' => 0,
                'can_edit' => 0,
                'can_delete' => 0,
                'can_moderate_all' => 0
            ];
        }
        
        $result = $wpdb->insert($permissions_table, $permissions, ['%d', '%d', '%d', '%d', '%d', '%d']);
        
        if ($result) {
            $added++;
        }
    }
    
    return [
        'success' => true,
        'added' => $added,
        'skipped' => $skipped,
        'total' => count($job_roles)
    ];
}

/**
 * Admin action to sync permissions
 */
function mp_handle_sync_permissions() {
    if (!isset($_GET['mp_sync_permissions']) || !isset($_GET['_wpnonce'])) {
        return;
    }
    
    if (!current_user_can('manage_options')) {
        wp_die('Unauthorized');
    }
    
    if (!wp_verify_nonce($_GET['_wpnonce'], 'mp_sync_permissions')) {
        wp_die('Invalid nonce');
    }
    
    $result = mp_sync_daily_log_permissions();
    
    if ($result['success']) {
        $message = sprintf(
            'Daily Log Permissions synced: %d added, %d already existed (%d total roles)',
            $result['added'],
            $result['skipped'],
            $result['total']
        );
        add_settings_error('mp_messages', 'mp_sync_success', $message, 'success');
    } else {
        add_settings_error('mp_messages', 'mp_sync_error', $result['message'], 'error');
    }
    
    set_transient('mp_admin_notice', get_settings_errors('mp_messages'), 30);
    
    wp_redirect(admin_url('plugins.php'));
    exit;
}
add_action('admin_init', 'mp_handle_sync_permissions');

/**
 * Show admin notices
 */
function mp_show_admin_notices() {
    $notices = get_transient('mp_admin_notice');
    if ($notices) {
        delete_transient('mp_admin_notice');
        foreach ($notices as $notice) {
            printf(
                '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
                esc_attr($notice['type']),
                esc_html($notice['message'])
            );
        }
    }
}
add_action('admin_notices', 'mp_show_admin_notices');

if ( ! function_exists( 'mentorship_platform_register_cpts' ) ) {
    /**
     * Register Custom Post Types for the AquaticPro.
     */
    function mentorship_platform_register_cpts() {

        // CPT: Mentorship Request
        $request_labels = array(
            'name'                  => _x( 'Mentorship Requests', 'Post Type General Name', 'aquaticpro' ),
            'singular_name'         => _x( 'Mentorship Request', 'Post Type Singular Name', 'aquaticpro' ),
            'menu_name'             => __( 'AquaticPro', 'aquaticpro' ),
            'name_admin_bar'        => __( 'Mentorship Request', 'aquaticpro' ),
            'all_items'             => __( 'All Requests', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Request', 'mentorship-platform' ),
            'add_new'               => __( 'Add New', 'mentorship-platform' ),
            'new_item'              => __( 'New Request', 'mentorship-platform' ),
            'edit_item'             => __( 'Edit Request', 'mentorship-platform' ),
            'view_item'             => __( 'View Request', 'mentorship-platform' ),
        );
        $request_args = array(
            'label'                 => __( 'Mentorship Request', 'mentorship-platform' ),
            'description'           => __( 'A request from a user to be mentored by another.', 'mentorship-platform' ),
            'labels'                => $request_labels,
            'supports'              => array( 'title', 'editor', 'author' ), // title = 'Mentorship for [Sender] w/ [Receiver]', editor = message
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => true,
            'menu_position'         => 5,
            'menu_icon'             => 'dashicons-groups',
            'show_in_admin_bar'     => true,
            'show_in_nav_menus'     => false,
            'can_export'            => true,
            'has_archive'           => false,
            'exclude_from_search'   => true,
            'publicly_queryable'    => false,
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        ); 
        register_post_type( 'mp_request', $request_args ); // CHANGED: Standardized CPT name

        // CPT: Goal
        $goal_labels = array(
            'name'                  => _x( 'Goals', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Goal', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Goals', 'mentorship-platform' ),
            'all_items'             => __( 'All Goals', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Goal', 'mentorship-platform' ),
        );
        $goal_args = array(
            'label'                 => __( 'Goal', 'mentorship-platform' ),
            'description'           => __( 'A mentorship goal.', 'mentorship-platform' ),
            'labels'                => $goal_labels,
            'supports'              => array( 'title', 'editor', 'author', 'revisions', 'comments' ), // editor = description
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request', // CHANGED: Nest under mp_request
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        );
        register_post_type( 'mp_goal', $goal_args ); // CHANGED: Standardized CPT name

        // CPT: Initiative
        $initiative_labels = array(
            'name'                  => _x( 'Initiatives', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Initiative', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Initiatives', 'mentorship-platform' ),
            'all_items'             => __( 'All Initiatives', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Initiative', 'mentorship-platform' ),
        );
        $initiative_args = array(
            'label'                 => __( 'Initiative', 'mentorship-platform' ),
            'description'           => __( 'An initiative within a goal.', 'mentorship-platform' ),
            'labels'                => $initiative_labels,
            'supports'              => array( 'title', 'editor', 'author', 'comments' ), // editor = description
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request', // CHANGED: Nest under mp_request
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        );
        register_post_type( 'mp_initiative', $initiative_args ); // CHANGED: Standardized CPT name

        // CPT: Task
        $task_labels = array(
            'name'                  => _x( 'Tasks', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Task', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Tasks', 'mentorship-platform' ),
            'all_items'             => __( 'All Tasks', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Task', 'mentorship-platform' ),
        );
        $task_args = array(
            'label'                 => __( 'Task', 'mentorship-platform' ),
            'description'           => __( 'A task for a goal or initiative.', 'mentorship-platform' ),
            'labels'                => $task_labels,
            'supports'              => array( 'title', 'author' ), // title = text
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request', // CHANGED: Nest under mp_request
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        );
        register_post_type( 'mp_task', $task_args ); // CHANGED: Standardized CPT name

        // CPT: Meeting
        $meeting_labels = array(
            'name'                  => _x( 'Meetings', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Meeting', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Meetings', 'mentorship-platform' ),
            'all_items'             => __( 'All Meetings', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Meeting', 'mentorship-platform' ),
        );
        $meeting_args = array(
            'label'                 => __( 'Meeting', 'mentorship-platform' ),
            'description'           => __( 'A meeting for a goal or initiative.', 'mentorship-platform' ),
            'labels'                => $meeting_labels,
            'supports'              => array( 'title', 'editor', 'author', 'comments' ), // title = topic, editor = notes
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request', // CHANGED: Nest under mp_request
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        );
        register_post_type( 'mp_meeting', $meeting_args ); // CHANGED: Standardized CPT name

        // CPT: Update
        $update_labels = array(
            'name'                  => _x( 'Updates', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Update', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Updates', 'mentorship-platform' ),
            'all_items'             => __( 'All Updates', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Update', 'mentorship-platform' ),
        );
        $update_args = array(
            'label'                 => __( 'Update', 'mentorship-platform' ),
            'description'           => __( 'An update post for a goal or initiative.', 'mentorship-platform' ),
            'labels'                => $update_labels,
            'supports'              => array( 'title', 'editor', 'author', 'comments', 'thumbnail' ), // editor = text, thumbnail/attachments
            'hierarchical'          => false,
            'public'                => false,
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request', // CHANGED: Nest under mp_request
            'capability_type'       => 'post',
            'show_in_rest'          => true,
        );
        register_post_type( 'mp_update', $update_args ); // CHANGED: Standardized CPT name

        // --- Register Daily Log CPT ---
        $daily_log_labels = array(
            'name'                  => _x( 'Daily Logs', 'Post Type General Name', 'mentorship-platform' ),
            'singular_name'         => _x( 'Daily Log', 'Post Type Singular Name', 'mentorship-platform' ),
            'menu_name'             => __( 'Daily Logs', 'mentorship-platform' ),
            'name_admin_bar'        => __( 'Daily Log', 'mentorship-platform' ),
            'archives'              => __( 'Daily Log Archives', 'mentorship-platform' ),
            'attributes'            => __( 'Daily Log Attributes', 'mentorship-platform' ),
            'all_items'             => __( 'All Daily Logs', 'mentorship-platform' ),
            'add_new_item'          => __( 'Add New Daily Log', 'mentorship-platform' ),
            'add_new'               => __( 'Add New', 'mentorship-platform' ),
            'new_item'              => __( 'New Daily Log', 'mentorship-platform' ),
            'edit_item'             => __( 'Edit Daily Log', 'mentorship-platform' ),
            'update_item'           => __( 'Update Daily Log', 'mentorship-platform' ),
            'view_item'             => __( 'View Daily Log', 'mentorship-platform' ),
            'view_items'            => __( 'View Daily Logs', 'mentorship-platform' ),
            'search_items'          => __( 'Search Daily Logs', 'mentorship-platform' ),
        );
        $daily_log_args = array(
            'label'                 => __( 'Daily Log', 'mentorship-platform' ),
            'description'           => __( 'Daily logs for tracking activities and shifts.', 'mentorship-platform' ),
            'labels'                => $daily_log_labels,
            'supports'              => array( 'title', 'editor', 'author', 'comments' ),
            'hierarchical'          => false,
            'public'                => true,
            'publicly_queryable'    => false, // Keep posts from appearing in public queries
            'show_ui'               => true,
            'show_in_menu'          => 'edit.php?post_type=mp_request',
            'capability_type'       => 'post',
            'map_meta_cap'          => true, // Enable WordPress to map meta capabilities
            'show_in_rest'          => true,
            'rest_base'             => 'mp_daily_logs', // Custom REST base
            'rest_controller_class' => 'WP_REST_Posts_Controller',
        );
        register_post_type( 'mp_daily_log', $daily_log_args );

    }
}

/**
 * Get user's Daily Log permissions from their job role(s).
 * 
 * @param int $user_id User ID to check permissions for.
 * @return array|null Array of permissions or null if none found.
 */
function mp_get_user_daily_log_permissions( $user_id ) {
    global $wpdb;
    
    if ( ! $user_id ) {
        return null;
    }
    
    $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    // Get all active job role assignments for this user
    $query = $wpdb->prepare(
        "SELECT DISTINCT
            p.can_view,
            p.can_create,
            p.can_edit,
            p.can_delete,
            p.can_moderate_all
        FROM {$assignments_table} a
        INNER JOIN {$permissions_table} p ON a.job_role_id = p.job_role_id
        WHERE a.user_id = %d
            AND (a.end_date IS NULL OR a.end_date >= CURDATE())
        ORDER BY p.can_moderate_all DESC, p.can_delete DESC, p.can_edit DESC, p.can_create DESC
        LIMIT 1",
        $user_id
    );
    
    $perms = $wpdb->get_row( $query, ARRAY_A );
    
    // Fallback: Check user meta for legacy pg_job_roles
    if ( ! $perms ) {
        $job_roles_meta = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $job_roles_meta ) && is_array( $job_roles_meta ) ) {
            $role_ids = array_map( 'intval', $job_roles_meta );
            $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
            
            $query = "SELECT 
                can_view,
                can_create,
                can_edit,
                can_delete,
                can_moderate_all
            FROM {$permissions_table}
            WHERE job_role_id IN ({$placeholders})
            ORDER BY can_moderate_all DESC, can_delete DESC, can_edit DESC, can_create DESC
            LIMIT 1";
            
            $perms = $wpdb->get_row( $wpdb->prepare( $query, ...$role_ids ), ARRAY_A );
        }
    }
    
    return $perms;
}

/**
 * Detect if we're in a Daily Logs context (REST API request).
 * 
 * @return bool True if this is a Daily Logs request.
 */
function mp_is_daily_log_rest_request() {
    // Check if we're in a REST request
    if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
        return false;
    }
    
    // Get the current REST route
    $route = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';
    
    // Check for Daily Logs REST endpoints
    // Match: /wp/v2/mp_daily_logs, /wp-json/mentorship-platform/v1/daily-logs, etc.
    if ( preg_match( '#/wp/v2/mp_daily_logs|/wp-json/mentorship-platform/v1/daily-logs|/mp_daily_logs#i', $route ) ) {
        return true;
    }
    
    return false;
}

/**
 * Grant Daily Log CPT capabilities based on job role permissions.
 * 
 * This filter checks the user's job role permissions and grants the appropriate
 * WordPress capabilities for daily log custom post types.
 * 
 * @param array $allcaps User's actual capabilities.
 * @param array $caps Primitive capabilities being checked.
 * @param array $args Arguments passed to capability check.
 * @param WP_User $user The user object.
 * @return array Modified capabilities.
 */
add_filter( 'user_has_cap', 'mp_grant_daily_log_capabilities_from_job_role', 10, 4 );
function mp_grant_daily_log_capabilities_from_job_role( $allcaps, $caps, $args, $user ) {
    // Skip if no user or already an admin
    if ( empty( $user->ID ) || ! empty( $allcaps['manage_options'] ) ) {
        return $allcaps;
    }
    
    // Define capabilities we intercept for daily logs
    $cap_being_checked = isset( $args[0] ) ? $args[0] : '';
    
    // Post-related capabilities
    $post_related_caps = [ 
        'edit_posts', 'edit_others_posts', 'publish_posts', 'read_private_posts', 
        'delete_posts', 'delete_others_posts', 'delete_published_posts',
        'edit_post', 'delete_post', 'read_post', 'edit_published_posts'
    ];
    
    // Check if this is a capability we should handle
    if ( ! in_array( $cap_being_checked, $post_related_caps, true ) ) {
        return $allcaps;
    }
    
    // Determine if we're in a daily log context
    $is_dl_context = false;
    
    // Check 1: If checking a specific post, verify it's a daily log
    if ( isset( $args[2] ) ) {
        $post = get_post( $args[2] );
        if ( $post && $post->post_type === 'mp_daily_log' ) {
            $is_dl_context = true;
        } elseif ( $post ) {
            // It's a specific post but not a daily log - don't apply DL permissions
            return $allcaps;
        }
    }
    
    // Check 2: If no specific post, check if we're in a DL REST request
    if ( ! $is_dl_context ) {
        $is_dl_context = mp_is_daily_log_rest_request();
    }
    
    // If we can't confirm it's a daily log context, don't interfere
    if ( ! $is_dl_context ) {
        return $allcaps;
    }
    
    // Check if we already have daily log permissions cached
    static $cached_permissions = [];
    
    if ( ! isset( $cached_permissions[ $user->ID ] ) ) {
        $cached_permissions[ $user->ID ] = mp_get_user_daily_log_permissions( $user->ID );
    }
    
    $perms = $cached_permissions[ $user->ID ];
    
    // If no permissions found, return unchanged
    if ( empty( $perms ) ) {
        return $allcaps;
    }
    
    // Map job role permissions to WordPress capabilities
    if ( ! empty( $perms['can_view'] ) ) {
        $allcaps['read'] = true;
        $allcaps['read_private_posts'] = true;
    }
    
    if ( ! empty( $perms['can_create'] ) ) {
        $allcaps['edit_posts'] = true;
        $allcaps['publish_posts'] = true;
        $allcaps['edit_published_posts'] = true;
        
        // Users who can create should be able to edit/publish their own posts
        if ( isset( $args[2] ) ) {
            $post = get_post( $args[2] );
            if ( $post && (int) $post->post_author === (int) $user->ID ) {
                $allcaps['edit_post'] = true;
                $allcaps['delete_post'] = true; // Can delete own drafts/posts they created
            }
        }
    }
    
    if ( ! empty( $perms['can_edit'] ) ) {
        $allcaps['edit_posts'] = true;
        $allcaps['edit_published_posts'] = true;
        
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
        $allcaps['edit_published_posts'] = true;
        $allcaps['delete_published_posts'] = true;
        
        // Moderators can edit and delete ANY post
        if ( isset( $args[2] ) ) {
            $allcaps['edit_post'] = true;
            $allcaps['delete_post'] = true;
        }
    }
    
    return $allcaps;
}

// Allow comments on daily logs via REST API
add_filter('rest_allow_anonymous_comments', function($allowed, $request) {
    if ($request->get_route() === '/wp/v2/comments' && is_user_logged_in()) {
        $post_id = $request->get_param('post');
        if ($post_id) {
            $post = get_post($post_id);
            if ($post && $post->post_type === 'mp_daily_log') {
                return true;
            }
        }
    }
    return $allowed;
}, 10, 2);

// Disable wptexturize for daily logs to preserve straight quotes and apostrophes
add_filter('run_wptexturize', function($run_texturize) {
    global $post;
    if ($post && $post->post_type === 'mp_daily_log') {
        return false;
    }
    return $run_texturize;
}, 10, 1);

// Prevent WordPress from converting quotes when saving daily logs
add_filter('wp_insert_post_data', function($data, $postarr) {
    if (isset($data['post_type']) && $data['post_type'] === 'mp_daily_log') {
        // Prevent WordPress from sanitizing quotes
        remove_filter('content_save_pre', 'balanceTags', 50);
        remove_filter('content_filtered_save_pre', 'balanceTags', 50);
    }
    return $data;
}, 10, 2);

if ( ! function_exists( 'mentorship_platform_register_meta' ) ) {
    /**
     * Register Custom Meta Fields for CPTs and Users.
     */
    function mentorship_platform_register_meta() {

        // --- User Meta Fields ---
        // (No change here, user meta is not a CPT)
        register_meta( 'user', '_tagline', array(
            'type' => 'string',
            'description' => 'User\'s professional tagline.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        // ... (all other user meta fields are correct) ...
        register_meta( 'user', '_mentor_opt_in', array(
            'type' => 'boolean',
            'description' => 'Whether the user is available as a mentor.',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
        ) );
        register_meta( 'user', '_skills', array(
            'type' => 'string',
            'description' => 'A JSON-encoded array of user skills.',
            'single' => true,
            'show_in_rest' => array(
                'schema' => array(
                    'type' => 'array',
                    'items' => array(
                        'type' => 'string',
                    ),
                ),
            ),
        ) );
        register_meta( 'user', '_bio_details', array(
            'type' => 'string',
            'description' => 'User\'s full bio with HTML.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_meta( 'user', '_experience', array(
            'type' => 'string',
            'description' => 'User\'s professional experience with HTML.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_meta( 'user', '_linkedin_url', array(
            'type' => 'string',
            'description' => 'URL to the user\'s LinkedIn profile.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_meta( 'user', '_custom_links', array(
            'type' => 'string',
            'description' => 'A JSON-encoded array of custom links (label and URL).',
            'single' => true,
            'show_in_rest' => array(
                'schema' => array(
                    'type' => 'array',
                    'items' => array(
                        'type' => 'object',
                        'properties' => array(
                            'label' => array( 'type' => 'string' ),
                            'url' => array( 'type' => 'string' ),
                        ),
                    ),
                ),
            ),
        ) );

        // --- CPT Meta Fields ---

        // Mentorship Request Meta
        register_post_meta( 'mp_request', '_receiver_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The user ID of the person receiving the request.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_request', '_status', array( // CHANGED
            'type' => 'string',
            'description' => 'Status of the request (Pending, Accepted, Rejected).',
            'single' => true,
            'default' => 'Pending',
            'show_in_rest' => true,
        ) );

        // Goal Meta
        register_post_meta( 'mp_goal', '_mentorship_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the mentorship request this goal belongs to.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_goal', '_status', array( // CHANGED
            'type' => 'string',
            'description' => 'The status of the goal (e.g., In Progress, Completed, Not Started).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_goal', '_is_portfolio', array( // CHANGED
            'type' => 'boolean',
            'description' => 'Whether this goal should be public on the portfolio.',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
        ) );

        // Initiative Meta
        register_post_meta( 'mp_initiative', '_goal_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the goal this initiative belongs to.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_initiative', '_status', array( // CHANGED
            'type' => 'string',
            'description' => 'The status of the initiative (e.g., In Progress, Completed, Not Started).',
            'single' => true,
            'show_in_rest' => true,
        ) );

        // Task Meta
        register_post_meta( 'mp_task', '_goal_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the goal this task belongs to.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_task', '_initiative_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the initiative this task belongs to (if any).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_task', '_is_completed', array( // CHANGED
            'type' => 'boolean',
            'description' => 'Whether the task is completed.',
            'single' => true,
            'default' => false,
            'show_in_rest' => true,
        ) );

        // Meeting Meta
        register_post_meta( 'mp_meeting', '_goal_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the goal this meeting belongs to.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_meeting', '_initiative_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the initiative this meeting belongs to (if any).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_meeting', '_meeting_date', array( // CHANGED
            'type' => 'string',
            'description' => 'The date and time of the meeting (ISO 8601 string).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_meeting', '_meeting_link', array( // CHANGED
            'type' => 'string',
            'description' => 'The URL for the online meeting.',
            'single' => true,
            'show_in_rest' => true,
        ) );

        // Update Meta
        register_post_meta( 'mp_update', '_goal_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the goal this update belongs to.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_update', '_initiative_id', array( // CHANGED
            'type' => 'number',
            'description' => 'The ID of the initiative this update belongs to (if any).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        // Note: Attachments for 'update' will be handled as child media attachments.

        // Daily Log Meta
        register_post_meta( 'mp_daily_log', '_location_id', array(
            'type' => 'number',
            'description' => 'The location ID where this log was created.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_daily_log', '_log_date', array(
            'type' => 'string',
            'description' => 'The date of this log (YYYY-MM-DD).',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_daily_log', '_time_slot_ids', array(
            'type' => 'string',
            'description' => 'Comma-separated time slot IDs.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_daily_log', '_job_role_id', array(
            'type' => 'number',
            'description' => 'The job role ID of the author.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_daily_log', '_tags', array(
            'type' => 'string',
            'description' => 'Comma-separated tags.',
            'single' => true,
            'show_in_rest' => true,
        ) );
        register_post_meta( 'mp_daily_log', '_blocks_json', array(
            'type' => 'string',
            'description' => 'BlockNote JSON content.',
            'single' => true,
            'show_in_rest' => true,
        ) );
    }
}

if ( ! function_exists( 'mentorship_platform_activate' ) ) {
    /**
     * Handle activation and deactivation hooks.
     */
    function mentorship_platform_activate() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

        // Existing notifications table
        $table_name = $wpdb->prefix . 'mentorship_notifications';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            message text NOT NULL,
            context_url varchar(255) DEFAULT '' NOT NULL,
            time datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Professional Growth Module Tables
        
        // Job Roles table - defines job titles and their hierarchy (DECOUPLED from WordPress roles)
        $table_name = $wpdb->prefix . 'pg_job_roles';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            title varchar(100) NOT NULL,
            tier tinyint(2) NOT NULL,
            description text,
            inservice_hours decimal(4,2) DEFAULT 4.00 NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY tier (tier)
        ) $charset_collate;";
        dbDelta($sql);
        
        // Manually add inservice_hours column if it doesn't exist (dbDelta doesn't always add columns reliably)
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $table_name LIKE 'inservice_hours'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $table_name ADD COLUMN inservice_hours decimal(4,2) DEFAULT 4.00 NOT NULL AFTER description");
        }
        
        // Migration: Remove wp_role_slug column if it exists (decoupling job roles from WP roles)
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $table_name LIKE 'wp_role_slug'");
        if (!empty($column_exists)) {
            // Drop index first
            $wpdb->query("ALTER TABLE $table_name DROP INDEX wp_role_slug");
            // Then drop column
            $wpdb->query("ALTER TABLE $table_name DROP COLUMN wp_role_slug");
        }
        
        // Locations table - defines physical locations/stations for daily logs
        $table_name = $wpdb->prefix . 'pg_locations';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            description text,
            sort_order int(11) DEFAULT 0 NOT NULL,
            is_active tinyint(1) DEFAULT 1 NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY name (name),
            KEY is_active (is_active),
            KEY sort_order (sort_order)
        ) $charset_collate;";
        dbDelta($sql);
        
        // Add sort_order column to existing locations table if it doesn't exist
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $table_name LIKE 'sort_order'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $table_name ADD COLUMN sort_order int(11) DEFAULT 0 NOT NULL AFTER description, ADD INDEX sort_order (sort_order)");
        }
        
        // Manually add archived column to in-service logs if it doesn't exist
        $inservice_table = $wpdb->prefix . 'pg_inservice_logs';
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $inservice_table LIKE 'archived'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $inservice_table ADD COLUMN archived tinyint(1) NOT NULL DEFAULT 0 AFTER details, ADD INDEX archived (archived)");
        }
        
        // Manually add archived column to scan audit logs if it doesn't exist
        $scan_audit_table = $wpdb->prefix . 'pg_scan_audit_logs';
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $scan_audit_table LIKE 'archived'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $scan_audit_table ADD COLUMN archived tinyint(1) NOT NULL DEFAULT 0 AFTER notes, ADD INDEX archived (archived)");
        }
        
        // Manually add archived column to live drill logs if it doesn't exist
        $drill_table = $wpdb->prefix . 'pg_live_recognition_drill_logs';
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $drill_table LIKE 'archived'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE $drill_table ADD COLUMN archived tinyint(1) NOT NULL DEFAULT 0 AFTER notes, ADD INDEX archived (archived)");
        }
        
        // One-time fix: Reset archived status to 0 for all records (version 4.0.5+)
        // This fixes an issue where records may have been incorrectly set to archived=1
        $fix_version = get_option('mentorship_platform_archived_fix_version', '0');
        if (version_compare($fix_version, '4.0.5', '<')) {
            $wpdb->query("UPDATE $inservice_table SET archived = 0 WHERE archived IS NOT NULL");
            $wpdb->query("UPDATE $scan_audit_table SET archived = 0 WHERE archived IS NOT NULL");
            $wpdb->query("UPDATE $drill_table SET archived = 0 WHERE archived IS NOT NULL");
            update_option('mentorship_platform_archived_fix_version', '4.0.5');
        }
        
        // Add new scan audit fields (version 4.0.7+)
        $scan_audit_update_version = get_option('mentorship_platform_scan_audit_fields_version', '0');
        if (version_compare($scan_audit_update_version, '4.0.7', '<')) {
            // Check and add wearing_correct_uniform column
            $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $scan_audit_table LIKE 'wearing_correct_uniform'");
            if (empty($column_exists)) {
                $wpdb->query("ALTER TABLE $scan_audit_table ADD COLUMN wearing_correct_uniform tinyint(1) DEFAULT NULL AFTER notes");
            }
            
            // Check and add attentive_to_zone column
            $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $scan_audit_table LIKE 'attentive_to_zone'");
            if (empty($column_exists)) {
                $wpdb->query("ALTER TABLE $scan_audit_table ADD COLUMN attentive_to_zone tinyint(1) DEFAULT NULL AFTER wearing_correct_uniform");
            }
            
            // Check and add posture_adjustment_5min column
            $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $scan_audit_table LIKE 'posture_adjustment_5min'");
            if (empty($column_exists)) {
                $wpdb->query("ALTER TABLE $scan_audit_table ADD COLUMN posture_adjustment_5min tinyint(1) DEFAULT NULL AFTER attentive_to_zone");
            }
            
            // Check and add attachments column
            $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $scan_audit_table LIKE 'attachments'");
            if (empty($column_exists)) {
                $wpdb->query("ALTER TABLE $scan_audit_table ADD COLUMN attachments longtext AFTER posture_adjustment_5min");
            }
            
            update_option('mentorship_platform_scan_audit_fields_version', '4.0.7');
        }
        
        // Migrate user_job_assignments table to support multiple roles per user
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$assignments_table'");
        if ($table_exists) {
            // Check if table has old structure (PRIMARY KEY on user_id only)
            $keys = $wpdb->get_results("SHOW KEYS FROM $assignments_table WHERE Key_name = 'PRIMARY'");
            $has_old_structure = false;
            foreach ($keys as $key) {
                if ($key->Column_name === 'user_id' && $key->Seq_in_index == 1) {
                    $has_old_structure = true;
                    break;
                }
            }
            
            if ($has_old_structure) {
                // Add id column, drop old primary key, set new primary key
                $wpdb->query("ALTER TABLE $assignments_table 
                    ADD COLUMN id mediumint(9) NOT NULL AUTO_INCREMENT FIRST,
                    DROP PRIMARY KEY,
                    ADD PRIMARY KEY (id),
                    ADD UNIQUE KEY user_job (user_id, job_role_id),
                    ADD KEY user_id (user_id)");
            }
        }
        
        // Expand live drill result column to support "Passed with Remediation" (version 5.5.0+)
        $drill_result_fix_version = get_option('mentorship_platform_drill_result_fix_version', '0');
        if (version_compare($drill_result_fix_version, '5.5.0', '<')) {
            $drill_table = $wpdb->prefix . 'pg_live_recognition_drill_logs';
            $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$drill_table'");
            if ($table_exists) {
                // Expand result column from varchar(20) to varchar(50) to accommodate "Passed with Remediation"
                $wpdb->query("ALTER TABLE $drill_table MODIFY COLUMN result varchar(50) NOT NULL");
            }
            update_option('mentorship_platform_drill_result_fix_version', '5.5.0');
        }

        // Promotion Criteria table - defines prerequisites for each job role
        $table_name = $wpdb->prefix . 'pg_promotion_criteria';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            job_role_id mediumint(9) NOT NULL,
            title varchar(255) NOT NULL,
            description text,
            criterion_type varchar(50) NOT NULL,
            target_value int(11) DEFAULT 1,
            linked_module varchar(50),
            sort_order int(11) DEFAULT 0,
            is_required tinyint(1) DEFAULT 1,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY job_role_id (job_role_id)
        ) $charset_collate;";
        dbDelta($sql);

        // User Progress table - tracks employee completion of criteria
        $table_name = $wpdb->prefix . 'pg_user_progress';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            criterion_id mediumint(9) NOT NULL,
            current_value int(11) DEFAULT 0,
            is_completed tinyint(1) DEFAULT 0,
            completion_date datetime,
            approved_by bigint(20),
            notes text,
            file_url varchar(255),
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY criterion_id (criterion_id),
            UNIQUE KEY user_criterion (user_id, criterion_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Criterion Activities table - activity log for all criterion progress changes
        $table_name = $wpdb->prefix . 'pg_criterion_activities';
        $sql = "CREATE TABLE $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            criterion_id mediumint(9) NOT NULL,
            user_id bigint(20) NOT NULL,
            affected_user_id bigint(20) NOT NULL,
            user_job_role_id mediumint(9),
            activity_type varchar(50) NOT NULL,
            content text,
            old_value varchar(255),
            new_value varchar(255),
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            edited_at datetime,
            edited_by bigint(20),
            PRIMARY KEY  (id),
            KEY criterion_id (criterion_id),
            KEY user_id (user_id),
            KEY affected_user_id (affected_user_id),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // User Job Assignments table - tracks which job role each user is assigned to (supports multiple roles)
        $table_name = $wpdb->prefix . 'pg_user_job_assignments';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            job_role_id mediumint(9) NOT NULL,
            assigned_by bigint(20),
            assigned_date datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            sync_wp_role tinyint(1) DEFAULT 1,
            notes text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY job_role_id (job_role_id),
            KEY assigned_by (assigned_by),
            UNIQUE KEY user_job (user_id, job_role_id)
        ) $charset_collate;";
        dbDelta($sql);

        // User Metadata table - stores additional user information
        $table_name = $wpdb->prefix . 'pg_user_metadata';
        $sql = "CREATE TABLE $table_name (
            user_id bigint(20) NOT NULL,
            phone_number varchar(20),
            employee_id varchar(50),
            hire_date date,
            notes longtext,
            eligible_for_rehire tinyint(1) DEFAULT 1,
            is_member tinyint(1) DEFAULT NULL,
            archived tinyint(1) DEFAULT 0 NOT NULL,
            archived_date datetime,
            archived_by bigint(20),
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (user_id),
            KEY archived (archived),
            KEY is_member (is_member),
            KEY hire_date (hire_date),
            KEY employee_id (employee_id)
        ) $charset_collate;";
        dbDelta($sql);
        
        // Add is_member column if it doesn't exist (migration for existing installs)
        $is_member_exists = $wpdb->get_results("SHOW COLUMNS FROM {$table_name} LIKE 'is_member'");
        if (empty($is_member_exists)) {
            $wpdb->query("ALTER TABLE {$table_name} ADD COLUMN is_member tinyint(1) DEFAULT NULL AFTER eligible_for_rehire");
            $wpdb->query("ALTER TABLE {$table_name} ADD INDEX is_member (is_member)");
        }
        
        // Add eligible_for_rehire column if it doesn't exist (migration for existing installs)
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM {$table_name} LIKE 'eligible_for_rehire'");
        if (empty($column_exists)) {
            $wpdb->query("ALTER TABLE {$table_name} ADD COLUMN eligible_for_rehire tinyint(1) DEFAULT 1 AFTER notes");
        }

        // In-Service Training Logs table
        $table_name = $wpdb->prefix . 'pg_inservice_logs';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            training_date date NOT NULL,
            training_time time,
            location varchar(255),
            duration_hours decimal(4,2) NOT NULL,
            topic varchar(255) NOT NULL,
            details longtext,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_by bigint(20) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY training_date (training_date),
            KEY created_by (created_by),
            KEY archived (archived)
        ) $charset_collate;";
        dbDelta($sql);

        // In-Service Attendees table - tracks who attended, led, or missed trainings
        $table_name = $wpdb->prefix . 'pg_inservice_attendees';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            inservice_id mediumint(9) NOT NULL,
            user_id bigint(20) NOT NULL,
            attendance_status varchar(20) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY inservice_id (inservice_id),
            KEY user_id (user_id),
            UNIQUE KEY inservice_user (inservice_id, user_id)
        ) $charset_collate;";
        dbDelta($sql);

        // In-Service Job Roles junction table - tracks which job roles an in-service training applies to
        $table_name = $wpdb->prefix . 'pg_inservice_job_roles';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            inservice_id mediumint(9) NOT NULL,
            job_role_id mediumint(9) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY inservice_id (inservice_id),
            KEY job_role_id (job_role_id),
            UNIQUE KEY inservice_job (inservice_id, job_role_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Scan Audit Logs table
        $table_name = $wpdb->prefix . 'pg_scan_audit_logs';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            audited_user_id bigint(20) NOT NULL,
            auditor_id bigint(20) NOT NULL,
            audit_date datetime NOT NULL,
            location varchar(255),
            result varchar(20) NOT NULL,
            notes text,
            wearing_correct_uniform tinyint(1) DEFAULT NULL,
            attentive_to_zone tinyint(1) DEFAULT NULL,
            posture_adjustment_5min tinyint(1) DEFAULT NULL,
            attachments longtext,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY audited_user_id (audited_user_id),
            KEY auditor_id (auditor_id),
            KEY audit_date (audit_date),
            KEY archived (archived)
        ) $charset_collate;";
        dbDelta($sql);

        // Cashier Observational Audit Logs table
        $table_name = $wpdb->prefix . 'pg_cashier_audit_logs';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            audited_user_id bigint(20) NOT NULL,
            auditor_id bigint(20) NOT NULL,
            audit_date datetime NOT NULL,
            checked_cash_drawer varchar(20) DEFAULT NULL,
            attentive_patrons_entered varchar(20) DEFAULT NULL,
            greeted_with_demeanor varchar(20) DEFAULT NULL,
            one_click_per_person varchar(20) DEFAULT NULL,
            pool_pass_process varchar(20) DEFAULT NULL,
            resolved_patron_concerns text,
            notes text,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY audited_user_id (audited_user_id),
            KEY auditor_id (auditor_id),
            KEY audit_date (audit_date),
            KEY archived (archived)
        ) $charset_collate;";
        dbDelta($sql);

        // Live Recognition Drill Logs table
        $table_name = $wpdb->prefix . 'pg_live_recognition_drill_logs';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            drilled_user_id bigint(20) NOT NULL,
            drill_conductor_id bigint(20) NOT NULL,
            drill_date datetime NOT NULL,
            location varchar(255),
            result varchar(50) NOT NULL,
            notes text,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY drilled_user_id (drilled_user_id),
            KEY drill_conductor_id (drill_conductor_id),
            KEY drill_date (drill_date),
            KEY archived (archived)
        ) $charset_collate;";
        dbDelta($sql);

        // Instructor Evaluation Logs table - for swim instructor evaluations
        $table_name = $wpdb->prefix . 'pg_instructor_evaluation_logs';
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            evaluated_user_id bigint(20) NOT NULL,
            evaluator_id bigint(20) NOT NULL,
            evaluation_date datetime NOT NULL,
            command_language tinyint(1) DEFAULT NULL,
            minimizing_downtime tinyint(1) DEFAULT NULL,
            periodic_challenges tinyint(1) DEFAULT NULL,
            provides_feedback tinyint(1) DEFAULT NULL,
            rules_expectations tinyint(1) DEFAULT NULL,
            learning_environment tinyint(1) DEFAULT NULL,
            comments text NOT NULL,
            archived tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY evaluated_user_id (evaluated_user_id),
            KEY evaluator_id (evaluator_id),
            KEY evaluation_date (evaluation_date),
            KEY archived (archived)
        ) $charset_collate;";
        dbDelta($sql);

        // Flush rewrite rules to ensure custom URLs work immediately.
        flush_rewrite_rules();
        
        // Create TaskDeck tables
        AquaticPro_TaskDeck::create_tables();
    }
}
register_activation_hook( __FILE__, 'mentorship_platform_activate' );

/**
 * ===================================================================
 * WORDPRESS MULTISITE — NEW SITE INITIALIZATION
 * ===================================================================
 * register_activation_hook() does NOT fire when a new sub-site is
 * created in a Multisite network. We use wp_initialize_site (WP 5.1+)
 * to run both migration functions for every new site.
 */
function mp_initialize_new_multisite( WP_Site $new_site ) {
    if ( ! is_multisite() ) {
        return;
    }

    switch_to_blog( $new_site->blog_id );

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    // Create all custom tables for the new site
    mp_run_database_migrations();
    mentorship_platform_activate();

    // Flush rewrite rules for the new site so custom URLs work immediately
    flush_rewrite_rules();

    restore_current_blog();
}
add_action( 'wp_initialize_site', 'mp_initialize_new_multisite', 10, 1 );

/**
 * Helper function to add a notification to the queue
 * We will use this in our API routes
 */
function add_mentorship_notification($user_id, $message, $context_url = '') {
    global $wpdb;
    $table_name = $wpdb->prefix . 'mentorship_notifications';
    
    // Check if user has opted-in
    $opt_in = get_user_meta($user_id, '_mentorship_notify_email', true);
    if (empty($opt_in)) {
        return; // User has not opted in
    }

    $wpdb->insert(
        $table_name,
        array(
            'user_id' => $user_id,
            'message' => $message,
            'context_url' => $context_url,
            'time' => current_time('mysql'),
        )
    );
}

if ( ! function_exists( 'mentorship_platform_deactivate' ) ) {
    function mentorship_platform_deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
}
register_deactivation_hook( __FILE__, 'mentorship_platform_deactivate' );

/**
 * ===================================================================
 * SHORTCODE AND SCRIPT ENQUEUEING
 * ===================================================================
 */

if ( ! function_exists( 'mentorship_platform_shortcode' ) ) {
    /**
     * Register the shortcode to display the React app.
     * Supports both [aquaticpro_app] and [mentorship_platform_app] (legacy) shortcodes.
     */
    function mentorship_platform_shortcode( $atts ) {
        // Parse shortcode attributes - support both shortcode names
        $atts = shortcode_atts( array(
            'default_view' => '', // Options: 'careerDevelopment', 'myMentees', 'directory', 'portfolioDirectory', 'userManagement', 'admin', 'dailyLogs', 'reports'
        ), $atts, 'aquaticpro_app' );
        
        // Store the default view in a data attribute so React can access it
        $data_attr = '';
        if ( ! empty( $atts['default_view'] ) ) {
            $data_attr = ' data-default-view="' . esc_attr( $atts['default_view'] ) . '"';
        }
        
        // Wrap in a container that isolates styles without breaking theme responsiveness
        return '<div class="mentorship-platform-container" style="clear: both; display: block; width: 100%;"><div id="root"' . $data_attr . '></div></div>'; 
    }
}

if ( ! function_exists( 'mentorship_platform_swimmer_progress_shortcode' ) ) {
    /**
     * Shortcode for public swimmer progress page.
     * Usage: [swimmer_progress]
     * 
     * When visited with ?token=xxx parameter, displays the swimmer's progress.
     * When visited without a token, displays a friendly info message.
     */
    function mentorship_platform_swimmer_progress_shortcode( $atts ) {
        // Check for token in URL
        $token = isset( $_GET['token'] ) ? sanitize_text_field( $_GET['token'] ) : '';
        
        // Pass the token to React via data attribute
        $data_attr = ' data-swimmer-progress-token="' . esc_attr( $token ) . '"';
        
        // Always render the React container - React will handle the display logic
        return '<div class="mentorship-platform-container" style="clear: both; display: block; width: 100%;"><div id="root" data-view="swimmer-progress"' . $data_attr . '></div></div>';
    }
}

if ( ! function_exists( 'aquaticpro_is_user_archived' ) ) {
    /**
     * Check if a user is archived.
     * Checks the pg_user_metadata table first, then falls back to user meta.
     * 
     * @param int $user_id User ID
     * @return bool True if archived
     */
    function aquaticpro_is_user_archived( $user_id ) {
        global $wpdb;
        if ( ! $user_id ) return false;
        
        // Check pg_user_metadata table first (primary source)
        $metadata_table = $wpdb->prefix . 'pg_user_metadata';
        $archived = $wpdb->get_var( $wpdb->prepare(
            "SELECT archived FROM {$metadata_table} WHERE user_id = %d",
            $user_id
        ) );
        
        if ( $archived !== null ) {
            return (bool) $archived;
        }
        
        // Fallback: Check user meta
        $status = get_user_meta( $user_id, 'aquaticpro_account_status', true );
        if ( $status === 'archived' ) return true;
        
        // Legacy check or boolean flag
        $is_archived = get_user_meta( $user_id, 'aquaticpro_is_archived', true );
        return (bool) $is_archived;
    }
}

if ( ! function_exists( 'aquaticpro_is_user_member' ) ) {
    /**
     * Check if a user is a member (employee) vs a site user (visitor).
     * Members have full access to the platform.
     * Non-members (site users) can only view the framework.
     * 
     * @param int $user_id User ID
     * @return bool True if user is a member
     */
    function aquaticpro_is_user_member( $user_id ) {
        global $wpdb;
        if ( ! $user_id ) return false;
        
        // WordPress admins are always members
        if ( user_can( $user_id, 'manage_options' ) ) {
            return true;
        }
        
        // App Admins (Tier-based) are always members
        if ( function_exists( 'aquaticpro_is_app_admin' ) && aquaticpro_is_app_admin( $user_id ) ) {
            return true;
        }
        
        // Check pg_user_metadata table for explicit is_member flag
        $metadata_table = $wpdb->prefix . 'pg_user_metadata';
        $is_member = $wpdb->get_var( $wpdb->prepare(
            "SELECT is_member FROM {$metadata_table} WHERE user_id = %d",
            $user_id
        ) );
        
        // If is_member field is set, use that value
        if ( $is_member !== null ) {
            return (bool) $is_member;
        }
        
        // Fallback: Check if user has any job role assignments (employees have roles)
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $has_role = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$assignments_table} WHERE user_id = %d AND (end_date IS NULL OR end_date >= CURDATE())",
            $user_id
        ) );
        
        return (int) $has_role > 0;
    }
}

if ( ! function_exists( 'aquaticpro_can_manage_members' ) ) {
    /**
     * Check if a user can manage member status (designate employees).
     * Requires Tier 6+ or WordPress admin.
     * 
     * @param int|null $user_id User ID (defaults to current user)
     * @return bool True if user can manage member status
     */
    function aquaticpro_can_manage_members( $user_id = null ) {
        if ( $user_id === null ) {
            $user_id = get_current_user_id();
        }
        
        if ( ! $user_id ) return false;
        
        // WordPress admins can always manage members
        if ( user_can( $user_id, 'manage_options' ) ) {
            return true;
        }
        
        // Check if user is Tier 6 or higher
        if ( function_exists( 'aquaticpro_get_user_highest_tier' ) ) {
            $tier = aquaticpro_get_user_highest_tier( $user_id );
            return $tier >= 6;
        }
        
        return false;
    }
}

if ( ! function_exists( 'mentorship_platform_enqueue_scripts' ) ) {
    /**
     * Enqueue scripts and styles for the React app.
     *
     * This function will check if the shortcode is present on the page
     * before loading the app's assets.
     */
    function mentorship_platform_enqueue_scripts() {
        global $post;

        // Pass data from PHP to our React app
        // Note: api_url should NOT have trailing slash (frontend paths start with /)
        // restUrl SHOULD have trailing slash (frontend appends wp/v2/... directly)
        $wp_data = array(
            'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
            'site_name'  => get_bloginfo( 'name' ),
            'restUrl'    => trailingslashit( rest_url() ),
            'nonce'      => wp_create_nonce( 'wp_rest' ),
            'logout_url' => wp_logout_url( get_permalink() ),
            'currentUrl' => get_permalink(),
        );

        // Check if user is logged in and add user data and login status
        if ( is_user_logged_in() ) {
            $user = wp_get_current_user();
            $wp_data['current_user'] = mentorship_platform_prepare_user_for_api( $user );
            $wp_data['isLoggedIn'] = true;
            
            // Check if user is admin - allow WordPress admins OR App Admins (Tier-based)
            $is_wp_admin = current_user_can('manage_options');
            $is_app_admin = function_exists('aquaticpro_is_app_admin') && aquaticpro_is_app_admin();
            
            // Legacy management check for backwards compatibility
            $is_management = function_exists('mentorship_platform_pg_user_is_management') 
                ? mentorship_platform_pg_user_is_management() 
                : false;
                
            $wp_data['is_admin'] = $is_wp_admin || $is_app_admin || $is_management;
            $wp_data['is_wp_admin'] = $is_wp_admin; // True WordPress admin
            $wp_data['is_app_admin'] = $is_app_admin; // App admin via tier setting

            // LMS Permissions - Calculate server-side to respect custom roles
            $lms_perms = array(
                'canViewAnalytics' => function_exists('aquaticpro_lms_check_can_view_analytics') ? aquaticpro_lms_check_can_view_analytics() : ($is_wp_admin || $is_app_admin),
                'canModerateAll' => function_exists('aquaticpro_lms_check_can_moderate') ? aquaticpro_lms_check_can_moderate() : ($is_wp_admin || $is_app_admin),
                'canEditCourses' => function_exists('aquaticpro_lms_check_can_edit') ? aquaticpro_lms_check_can_edit() : ($is_wp_admin || $is_app_admin),
            );

            // Check if user is archived
            $is_archived = function_exists('aquaticpro_is_user_archived') && aquaticpro_is_user_archived( $user->ID );
            $wp_data['account_status'] = $is_archived ? 'archived' : 'active';

            // Check if user is a member (employee) vs site user (visitor)
            $is_member = function_exists('aquaticpro_is_user_member') && aquaticpro_is_user_member( $user->ID );
            $wp_data['is_member'] = $is_member;

            // Determine Member vs Visitor status
            // Members: Active employees with is_member flag or job roles
            // Visitors: Archived users OR Non-Members (site users)
            // Note: Archived members become visitors until unarchived

            if ( $is_archived || ! $is_member ) {
                // Visitor / Archived Mode
                // They can see the framework (App loads) but in Read-Only mode with restricted permissions
                $wp_data['visitor_mode'] = true;
                $wp_data['read_only_mode'] = true;

                // Strip LMS/high-level permissions for visitors
                $wp_data['lms_permissions'] = array(
                    'canViewAnalytics' => false,
                    'canModerateAll' => false,
                    'canEditCourses' => false,
                );
            } else {
                // Active Member Mode
                $wp_data['visitor_mode'] = false;
                $wp_data['read_only_mode'] = false;
                $wp_data['lms_permissions'] = $lms_perms;
            }
            
            // Add flag for users who can manage member status (Tier 6+)
            $wp_data['can_manage_members'] = function_exists('aquaticpro_can_manage_members') && aquaticpro_can_manage_members( $user->ID );
            
            // Add flag for Plugin Admins (WP admin or Tier 6+) - they have FULL access to all plugin features
            $wp_data['is_plugin_admin'] = function_exists('mp_is_plugin_admin') && mp_is_plugin_admin( $user->ID );
        } else {
            $wp_data['current_user'] = null;
            $wp_data['isLoggedIn'] = false;
        }

        // Add module enablement status
        $wp_data['enable_mentorship'] = (bool) get_option( 'aquaticpro_enable_mentorship', true );
        $wp_data['enable_daily_logs'] = (bool) get_option( 'aquaticpro_enable_daily_logs', true );
        $wp_data['enable_professional_growth'] = (bool) get_option( 'aquaticpro_enable_professional_growth', false );
        $wp_data['enable_taskdeck'] = (bool) get_option( 'aquaticpro_enable_taskdeck', false );
        $wp_data['enable_awesome_awards'] = (bool) get_option( 'aquaticpro_enable_awesome_awards', false );
        $wp_data['enable_seasonal_returns'] = (bool) get_option( 'aquaticpro_enable_seasonal_returns', true );
        $wp_data['enable_lesson_management'] = (bool) get_option( 'aquaticpro_enable_lesson_management', false );
        $wp_data['enable_lms'] = (bool) get_option( 'aquaticpro_enable_lms', false );
        $wp_data['enable_mileage'] = (bool) get_option( 'aquaticpro_enable_mileage', false );
        $wp_data['enable_new_hires'] = (bool) get_option( 'aquaticpro_enable_new_hires', false );
        $wp_data['enable_reports'] = (bool) get_option( 'aquaticpro_enable_reports', true );
        $wp_data['enable_foia_export'] = (bool) get_option( 'aquaticpro_enable_foia_export', false );
        $wp_data['enable_certificates'] = (bool) get_option( 'aquaticpro_enable_certificates', true );
        
        $wp_data['camp_roster_password_set'] = ! empty( get_option( 'aquaticpro_camp_roster_password', '' ) );
        
        $wp_data['default_home_view'] = get_option( 'aquaticpro_default_home_view', 'myMentees' );
        
        // Add Excalidraw asset path for LMS module
        $wp_data['excalidrawAssetPath'] = plugin_dir_url( __FILE__ ) . 'assets/excalidraw/';
        $wp_data['pluginUrl'] = plugin_dir_url( __FILE__ );

        // Only load scripts if we are on a singular page and the shortcode is present.
        $has_shortcode = is_a( $post, 'WP_Post' ) && ( 
            has_shortcode( $post->post_content, 'aquaticpro_app' ) || 
            has_shortcode( $post->post_content, 'mentorship_platform_app' ) ||
            has_shortcode( $post->post_content, 'swimmer_progress' )
        );
        
        if ( $has_shortcode ) {
            // --- IMPORTANT ---
            // We will need to replace these placeholder paths with the
            // actual paths to your compiled React app's asset files.
            $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';

            // Get plugin version from header
            $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
            $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';

            // Enqueue WordPress Media Library for users with upload access
            // The 'upload_files' capability is granted dynamically in security-helpers.php
            // to Plugin Admins (Tier 6+) and users with daily log create permission.
            if ( is_user_logged_in() && current_user_can('upload_files') ) {
                // Register a polyfill script for _.isArray - fixes WP 6.8+ backbone compatibility
                // This runs after underscore loads but before wp-backbone
                wp_register_script( 'underscore-isarray-polyfill', '', array( 'underscore' ), '1.0', false );
                wp_add_inline_script( 'underscore-isarray-polyfill', 
                    'if (typeof window._ !== "undefined" && typeof window._.isArray === "undefined") { window._.isArray = Array.isArray; }'
                );
                wp_enqueue_script( 'underscore-isarray-polyfill' );
                
                wp_enqueue_media();
            }

            // Enqueue the app's CSS (extracted by Vite build)
            mentorship_platform_enqueue_css( $plugin_version );

            // Enqueue the app's main JS file (now an ES module with code-splitting)
            wp_enqueue_script(
                'mentorship-app',
                $react_app_js_path,
                array( 'react', 'react-dom' ), // Only true dependencies — React/ReactDOM globals
                $plugin_version, // Dynamic version from plugin header - auto busts cache on update
                true // Load in footer
            );

            wp_localize_script(
                'mentorship-app',
                'mentorshipPlatformData', // This object will be available as window.mentorshipPlatformData in JS
                $wp_data
            );
            
            // Also expose Excalidraw asset path separately for backward compatibility
            wp_localize_script(
                'mentorship-app',
                'aquaticProSettings',
                array(
                    'excalidrawAssetPath' => plugin_dir_url( __FILE__ ) . 'assets/excalidraw/'
                )
            );
        }
    }
}

if ( ! function_exists( 'mentorship_platform_custom_upload_mimes' ) ) {
    /**
     * Allow additional file types for upload.
     */
    function mentorship_platform_custom_upload_mimes( $mimes ) {
        $mimes['pdf']  = 'application/pdf';
        $mimes['doc']  = 'application/msword';
        $mimes['docx'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        $mimes['xls']  = 'application/vnd.ms-excel';
        $mimes['xlsx'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        $mimes['ppt']  = 'application/vnd.ms-powerpoint';
        $mimes['pptx'] = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        $mimes['zip']  = 'application/zip';
        $mimes['csv']  = 'text/csv';
        $mimes['json'] = 'application/json';
        $mimes['txt']  = 'text/plain';
        $mimes['webp'] = 'image/webp';
        return $mimes;
    }
}

/**
 * Hide the page title on pages that use our shortcode.
 */
function mentorship_platform_hide_title( $title, $id = null ) {
    if ( is_singular() && in_the_loop() && ! is_admin() ) {
        $post = get_post( $id );
        if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'mentorship_platform_app' ) ) {
            return '';
        }
    }
    return $title;
}

/**
 * Track user's last login timestamp
 */
function mentorship_platform_track_last_login( $user_login, $user ) {
    update_user_meta( $user->ID, 'last_login', current_time( 'mysql' ) );
}

/**
 * Shared helper: enqueue CSS for the React app.
 * Called from every page handler that loads the mentorship-app JS.
 */
function mentorship_platform_enqueue_css( $plugin_version = '1.0.0' ) {
    $css_url = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.css';
    wp_enqueue_style( 'mentorship-app-styles', $css_url, array(), $plugin_version );
}

/**
 * Handle swimmer_progress URL parameter
 * When visiting /?swimmer_progress=xxx, display the React app to show swimmer progress
 * This runs very early to intercept before the theme loads
 */
function mentorship_platform_handle_swimmer_progress() {
    if ( ! isset( $_GET['swimmer_progress'] ) ) {
        return;
    }
    
    $token = sanitize_text_field( $_GET['swimmer_progress'] );
    
    // Get plugin version
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    
    // Enqueue WordPress's React (wp-element includes React and ReactDOM)
    wp_enqueue_script( 'wp-element' );
    
    // Enqueue the app CSS + scripts
    mentorship_platform_enqueue_css( $plugin_version );
    $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';
    wp_enqueue_script(
        'mentorship-app',
        $react_app_js_path,
        array( 'wp-element' ),
        $plugin_version,
        true
    );
    
    // Pass minimal data needed for public swimmer progress view
    $wp_data = array(
        'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
        'restUrl'    => trailingslashit( rest_url() ),
        'nonce'      => '',
        'isLoggedIn' => false,
        'current_user' => null,
        'enable_lesson_management' => true, // Enable LM view
    );
    
    wp_localize_script( 'mentorship-app', 'mentorshipPlatformData', $wp_data );
    
    // Output the page
    ?>
    <!DOCTYPE html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Swimmer Progress</title>
        <?php wp_head(); ?>
        <style>
            body { margin: 0; padding: 0; }
            .mentorship-platform-container { min-height: 100vh; }
        </style>
    </head>
    <body <?php body_class(); ?>>
        <div class="mentorship-platform-container">
            <div id="root" data-view="swimmer-progress" data-swimmer-progress-token="<?php echo esc_attr( $token ); ?>"></div>
        </div>
        <?php wp_footer(); ?>
    </body>
    </html>
    <?php
    exit;
}
// Use priority 1 to run before most other template_redirect handlers
add_action( 'template_redirect', 'mentorship_platform_handle_swimmer_progress', 1 );

/**
 * Handle camp_rosters URL parameter
 * When visiting /?camp_rosters, display the React app to show public camp rosters
 * This runs very early to intercept before the theme loads
 */
function mentorship_platform_handle_camp_rosters() {
    if ( ! isset( $_GET['camp_rosters'] ) ) {
        return;
    }
    
    // Get plugin version
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    
    // Enqueue WordPress's React (wp-element includes React and ReactDOM)
    wp_enqueue_script( 'wp-element' );
    
    // Enqueue the app CSS + scripts
    mentorship_platform_enqueue_css( $plugin_version );
    $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';
    wp_enqueue_script(
        'mentorship-app',
        $react_app_js_path,
        array( 'wp-element' ),
        $plugin_version,
        true
    );
    
    // Pass minimal data needed for public camp rosters view
    $wp_data = array(
        'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
        'restUrl'    => trailingslashit( rest_url() ),
        'nonce'      => '',
        'isLoggedIn' => false,
        'current_user' => null,
        'enable_lesson_management' => true, // Enable LM view
    );
    
    wp_localize_script( 'mentorship-app', 'mentorshipPlatformData', $wp_data );
    
    // Output the page
    ?>
    <!DOCTYPE html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Camp Rosters</title>
        <?php wp_head(); ?>
        <style>
            body { margin: 0; padding: 0; }
            .mentorship-platform-container { min-height: 100vh; }
        </style>
    </head>
    <body <?php body_class(); ?>>
        <div class="mentorship-platform-container">
            <div id="root" data-view="camp-rosters"></div>
        </div>
        <?php wp_footer(); ?>
    </body>
    </html>
    <?php
    exit;
}
add_action( 'template_redirect', 'mentorship_platform_handle_camp_rosters', 1 );

/**
 * Add rewrite rule for /return-form/ page
 * Supports both:
 *   /return-form/TOKEN  (path-based, preferred - avoids email = encoding issues)
 *   /return-form/?token=TOKEN  (query string, legacy)
 */
function mp_add_return_form_rewrite_rule() {
    // Path-based: /return-form/abc123... -> captures token in path
    add_rewrite_rule( '^return-form/([a-f0-9]+)/?$', 'index.php?mp_return_form=1&mp_return_token=$matches[1]', 'top' );
    // Query string: /return-form/?token=abc123... (legacy support)
    add_rewrite_rule( '^return-form/?$', 'index.php?mp_return_form=1', 'top' );
}

/**
 * Register custom query vars for the return form
 */
function mp_register_return_form_query_vars( $vars ) {
    $vars[] = 'mp_return_form';
    $vars[] = 'mp_return_token'; // Path-based token
    $vars[] = 'token'; // Register 'token' so WordPress preserves it through URL rewriting (legacy)
    return $vars;
}
add_filter( 'query_vars', 'mp_register_return_form_query_vars' );

/**
 * Handle /return-form/ URL for seasonal returns public form
 * Displays React app for employees to submit return intent via token
 */
function mp_handle_return_form_page() {
    if ( ! get_query_var( 'mp_return_form' ) ) {
        return;
    }
    
    // Get plugin version
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    
    // Get token from URL - try multiple methods for robustness.
    // Priority:
    //   1. Path-based: /return-form/TOKEN (preferred, avoids email encoding issues)
    //   2. $_GET['token'] (query string)
    //   3. get_query_var('token') (WordPress rewrite)
    //   4. QUERY_STRING parsing (fallback)
    $token = '';
    
    // Check path-based token first (from rewrite rule)
    if ( get_query_var( 'mp_return_token' ) ) {
        $token = sanitize_text_field( get_query_var( 'mp_return_token' ) );
    } elseif ( ! empty( $_GET['token'] ) ) {
        $token = sanitize_text_field( $_GET['token'] );
    } elseif ( get_query_var( 'token' ) ) {
        $token = sanitize_text_field( get_query_var( 'token' ) );
    } elseif ( ! empty( $_SERVER['QUERY_STRING'] ) ) {
        parse_str( $_SERVER['QUERY_STRING'], $qs );
        if ( ! empty( $qs['token'] ) ) {
            $token = sanitize_text_field( $qs['token'] );
        }
    }
    
    if ( empty( $token ) ) {
        error_log( 'SRM: Return form loaded but no token found in URL. REQUEST_URI: ' . ( $_SERVER['REQUEST_URI'] ?? 'N/A' ) );
    }
    
    // Enqueue WordPress's React
    wp_enqueue_script( 'wp-element' );
    
    // Enqueue the app CSS + scripts
    mentorship_platform_enqueue_css( $plugin_version );
    $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';
    wp_enqueue_script(
        'mentorship-app',
        $react_app_js_path,
        array( 'wp-element' ),
        $plugin_version,
        true
    );
    
    // Pass data for public form view
    $wp_data = array(
        'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
        'restUrl'    => trailingslashit( rest_url() ),
        'nonce'      => '', // No nonce needed for public view
        'isLoggedIn' => false,
        'current_user' => null,
        'return_form_token' => $token,
    );
    
    wp_localize_script( 'mentorship-app', 'mentorshipPlatformData', $wp_data );
    
    // Output the page
    ?>
    <!DOCTYPE html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Seasonal Return Intent Form</title>
        <?php wp_head(); ?>
        <style>
            body { margin: 0; padding: 0; }
            .mentorship-platform-container { min-height: 100vh; }
        </style>
    </head>
    <body <?php body_class(); ?>>
        <div class="mentorship-platform-container">
            <div id="root" data-view="return-form" data-token="<?php echo esc_attr( $token ); ?>"></div>
        </div>
        <?php wp_footer(); ?>
    </body>
    </html>
    <?php
    exit;
}

// Handle /return-form/ public page for seasonal returns
add_action( 'template_redirect', 'mp_handle_return_form_page', 1 );

/**
 * Add rewrite rule for /swimmer-progress/ page
 * Supports: /swimmer-progress/TOKEN  (path-based, avoids email encoding issues)
 */
function mp_add_swimmer_progress_rewrite_rule() {
    add_rewrite_rule( '^swimmer-progress/([a-f0-9]+)/?$', 'index.php?mp_swimmer_progress=1&mp_swimmer_token=$matches[1]', 'top' );
}

/**
 * Register custom query vars for the swimmer progress page
 */
function mp_register_swimmer_progress_query_vars( $vars ) {
    $vars[] = 'mp_swimmer_progress';
    $vars[] = 'mp_swimmer_token';
    return $vars;
}
add_filter( 'query_vars', 'mp_register_swimmer_progress_query_vars' );

/**
 * Handle /swimmer-progress/TOKEN URL for public swimmer evaluation progress
 * Displays React app with PublicSwimmerProgress component, bypassing the WP theme
 */
function mp_handle_swimmer_progress_page() {
    if ( ! get_query_var( 'mp_swimmer_progress' ) ) {
        return;
    }

    // Get plugin version
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';

    // Get token from URL - try multiple methods for robustness
    $token = '';
    if ( get_query_var( 'mp_swimmer_token' ) ) {
        $token = sanitize_text_field( get_query_var( 'mp_swimmer_token' ) );
    } elseif ( ! empty( $_GET['token'] ) ) {
        $token = sanitize_text_field( $_GET['token'] );
    }

    if ( empty( $token ) ) {
        error_log( 'LM: Swimmer progress page loaded but no token found. REQUEST_URI: ' . ( $_SERVER['REQUEST_URI'] ?? 'N/A' ) );
    }

    // Enqueue WordPress's React
    wp_enqueue_script( 'wp-element' );

    // Enqueue the app CSS + scripts
    mentorship_platform_enqueue_css( $plugin_version );
    $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';
    wp_enqueue_script(
        'mentorship-app',
        $react_app_js_path,
        array( 'wp-element' ),
        $plugin_version,
        true
    );

    // Pass minimal data needed for public swimmer progress view
    $wp_data = array(
        'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
        'restUrl'    => trailingslashit( rest_url() ),
        'nonce'      => '',
        'isLoggedIn' => false,
        'current_user' => null,
        'enable_lesson_management' => true,
    );

    wp_localize_script( 'mentorship-app', 'mentorshipPlatformData', $wp_data );

    ?>
    <!DOCTYPE html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Swimmer Progress</title>
        <?php wp_head(); ?>
        <style>
            body { margin: 0; padding: 0; }
            .mentorship-platform-container { min-height: 100vh; }
        </style>
    </head>
    <body <?php body_class(); ?>>
        <div class="mentorship-platform-container">
            <div id="root" data-view="swimmer-progress" data-swimmer-progress-token="<?php echo esc_attr( $token ); ?>"></div>
        </div>
        <?php wp_footer(); ?>
    </body>
    </html>
    <?php
    exit;
}
add_action( 'template_redirect', 'mp_handle_swimmer_progress_page', 1 );

/**
 * Add rewrite rule for /new-hire-form/ page
 */
function mp_add_new_hire_form_rewrite_rule() {
    add_rewrite_rule( '^new-hire-form/?$', 'index.php?mp_new_hire_form=1', 'top' );
}
add_action( 'init', 'mp_add_new_hire_form_rewrite_rule' );

/**
 * Flush rewrite rules if they need to be updated
 * This ensures custom URL routes work after plugin update
 */
function mp_check_rewrite_rules_version() {
    $current_version = get_option( 'mp_rewrite_rules_version', '0' );
    $target_version = '13.1.2'; // Bumped for /swimmer-progress/TOKEN rewrite rule
    
    if ( version_compare( $current_version, $target_version, '<' ) ) {
        flush_rewrite_rules();
        update_option( 'mp_rewrite_rules_version', $target_version );
        error_log( 'MP: Flushed rewrite rules - updated to version ' . $target_version );
    }
}
add_action( 'init', 'mp_check_rewrite_rules_version', 999 );

/**
 * Register custom query vars for the new hire form
 */
function mp_register_new_hire_form_query_vars( $vars ) {
    $vars[] = 'mp_new_hire_form';
    return $vars;
}
add_filter( 'query_vars', 'mp_register_new_hire_form_query_vars' );

/**
 * Handle /new-hire-form/ URL for new hire onboarding
 * Displays React app for new hires to accept job positions
 */
function mp_handle_new_hire_form_page() {
    if ( ! get_query_var( 'mp_new_hire_form' ) ) {
        return;
    }
    
    // Get plugin version
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $plugin_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    
    // Enqueue WordPress's React
    wp_enqueue_script( 'wp-element' );
    
    // Enqueue the app CSS + scripts
    mentorship_platform_enqueue_css( $plugin_version );
    $react_app_js_path = plugin_dir_url( __FILE__ ) . 'build/assets/mentorship-app.js';
    wp_enqueue_script(
        'mentorship-app',
        $react_app_js_path,
        array( 'wp-element' ),
        $plugin_version,
        true
    );
    
    // Pass data for public form view
    $wp_data = array(
        'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
        'restUrl'    => trailingslashit( rest_url() ),
        'nonce'      => '', // No nonce needed for public view
        'isLoggedIn' => false,
        'current_user' => null,
    );
    
    wp_localize_script( 'mentorship-app', 'mentorshipPlatformData', $wp_data );
    
    // Get site name for title
    $site_name = get_bloginfo( 'name' );
    
    // Output the page
    ?>
    <!DOCTYPE html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>New Hire Application - <?php echo esc_html( $site_name ); ?></title>
        <?php wp_head(); ?>
        <style>
            body { margin: 0; padding: 0; background-color: #f9fafb; }
            .mentorship-platform-container { min-height: 100vh; }
        </style>
    </head>
    <body <?php body_class(); ?>>
        <div class="mentorship-platform-container">
            <div id="root" data-view="new-hire-form"></div>
        </div>
        <?php wp_footer(); ?>
    </body>
    </html>
    <?php
    exit;
}
add_action( 'template_redirect', 'mp_handle_new_hire_form_page', 1 );

/**
 * Handle LOI download requests
 * Serves the Letter of Intent HTML page with table-based header/footer for print
 */
function mp_handle_loi_download() {
    // Check if this is an LOI download request
    if ( ! isset( $_GET['loi_download'] ) || ! isset( $_GET['app_id'] ) ) {
        return;
    }
    
    $token = sanitize_text_field( $_GET['loi_download'] );
    $app_id = intval( $_GET['app_id'] );
    
    // Load the new hires class if not already loaded
    if ( ! class_exists( 'AquaticPro_New_Hires' ) ) {
        require_once plugin_dir_path( __FILE__ ) . 'includes/class-new-hires.php';
    }
    
    // Validate and get the LOI
    $result = AquaticPro_New_Hires::serve_loi_download( $token, $app_id );
    
    if ( is_wp_error( $result ) ) {
        wp_die( 
            '<h1>Letter of Intent</h1><p>' . esc_html( $result->get_error_message() ) . '</p><p>If you believe this is an error, please contact us.</p>',
            'Invalid Download Link',
            array( 'response' => 403 )
        );
    }
    
    // Get site info for the page
    $site_name = get_bloginfo( 'name' );
    $applicant_name = $result['application']['first_name'] . ' ' . $result['application']['last_name'];
    
    // Extract header and footer image URLs
    $html = $result['html'];
    $header_img_url = '';
    $footer_img_url = '';
    if ( preg_match( '/<div class="header"><img src="([^"]+)"/', $html, $matches ) ) {
        $header_img_url = $matches[1];
    }
    if ( preg_match( '/<div class="footer"><img src="([^"]+)"/', $html, $matches ) ) {
        $footer_img_url = $matches[1];
    }
    
    // Extract just the content (remove header/footer/wrapper from original)
    $content_html = $html;
    $content_html = preg_replace( '/<html>.*?<body>/s', '', $content_html );
    $content_html = preg_replace( '/<\/body>.*?<\/html>/s', '', $content_html );
    $content_html = preg_replace( '/<div class="header">.*?<\/div>/s', '', $content_html );
    $content_html = preg_replace( '/<div class="footer">.*?<\/div>/s', '', $content_html );
    // Remove the content wrapper div if present
    $content_html = preg_replace( '/<div class="content">(.*)<\/div>/s', '$1', $content_html );
    
    // Output the LOI as HTML with table-based layout for repeating header/footer
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Letter of Intent - <?php echo esc_html( $applicant_name ); ?> | <?php echo esc_html( $site_name ); ?></title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            background: #f5f5f5;
        }
        /* Screen toolbar */
        .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #333;
            color: white;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
        }
        .toolbar h1 {
            font-size: 16px;
            font-family: Arial, sans-serif;
        }
        .toolbar button {
            background: #0073aa;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial, sans-serif;
        }
        .toolbar button:hover {
            background: #005a87;
        }
        .print-notice {
            max-width: 8.5in;
            margin: 70px auto 10px;
            padding: 12px 20px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        }
        
        /* Page container for screen */
        .page-wrapper {
            max-width: 8.5in;
            margin: 20px auto 40px;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            min-height: 11in;
        }
        
        /* Table layout for repeating header/footer */
        .loi-table {
            width: 100%;
            border-collapse: collapse;
        }
        .loi-table thead td,
        .loi-table tfoot td {
            text-align: center;
            padding: 0.25in;
        }
        .loi-table thead img,
        .loi-table tfoot img {
            max-width: 100%;
            max-height: 1in;
            height: auto;
        }
        .loi-table tbody td {
            padding: 0.25in 0.75in;
            vertical-align: top;
        }
        .loi-table tbody p {
            margin: 0 0 0.8em 0;
        }
        .loi-table .signature img {
            max-height: 80px;
            max-width: 300px;
        }
        
        /* Print styles */
        @media print {
            body {
                background: white;
            }
            .toolbar, .print-notice {
                display: none !important;
            }
            .page-wrapper {
                margin: 0;
                box-shadow: none;
                max-width: none;
                min-height: auto;
            }
            /* Ensure header/footer repeat on each page */
            .loi-table {
                page-break-inside: auto;
            }
            .loi-table thead {
                display: table-header-group;
            }
            .loi-table tfoot {
                display: table-footer-group;
            }
            .loi-table tbody {
                display: table-row-group;
            }
            .loi-table tr {
                page-break-inside: avoid;
            }
        }
        
        @page {
            size: letter;
            margin: 0.5in;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <h1>📄 Letter of Intent - <?php echo esc_html( $applicant_name ); ?></h1>
        <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
    <div class="print-notice">
        <strong>💡 Tip:</strong> When printing, go to <strong>More settings</strong> and uncheck <strong>"Headers and footers"</strong> to remove the URL and date from the PDF.
    </div>
    <div class="page-wrapper">
        <table class="loi-table">
            <?php if ( $header_img_url ) : ?>
            <thead>
                <tr>
                    <td><img src="<?php echo esc_url( $header_img_url ); ?>" alt="Letterhead Header"></td>
                </tr>
            </thead>
            <?php endif; ?>
            <?php if ( $footer_img_url ) : ?>
            <tfoot>
                <tr>
                    <td><img src="<?php echo esc_url( $footer_img_url ); ?>" alt="Letterhead Footer"></td>
                </tr>
            </tfoot>
            <?php endif; ?>
            <tbody>
                <tr>
                    <td><?php echo $content_html; ?></td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>
    <?php
    exit;
}
add_action( 'template_redirect', 'mp_handle_loi_download', 1 );

/**
 * Flush rewrite rules when plugin version changes (handles updates)
 */
function mp_maybe_flush_rewrite_rules_on_update() {
    $plugin_data = get_file_data( __FILE__, array( 'Version' => 'Version' ) );
    $current_version = isset( $plugin_data['Version'] ) ? $plugin_data['Version'] : '1.0.0';
    $stored_version = get_option( 'aquaticpro_version', '0' );
    
    if ( version_compare( $stored_version, $current_version, '<' ) ) {
        // Version changed, flush rewrite rules
        flush_rewrite_rules();
        update_option( 'aquaticpro_version', $current_version );
    }
}

// --- Main Plugin Hooks ---
add_action( 'init', 'mentorship_platform_register_cpts', 0 );
add_action( 'init', 'mentorship_platform_register_meta' );
add_action( 'init', 'mp_add_return_form_rewrite_rule' );
add_action( 'init', 'mp_add_swimmer_progress_rewrite_rule' );
add_action( 'init', 'mp_maybe_flush_rewrite_rules_on_update', 99 ); // Run late after rewrite rules added
add_action( 'rest_api_init', 'mentorship_platform_register_api_routes' );
add_action( 'wp_login', 'mentorship_platform_track_last_login', 10, 2 );
add_filter( 'rest_prepare_comment', 'mentorship_platform_add_custom_avatar_to_comments', 10, 3 );
add_filter( 'pre_get_avatar_data', 'mentorship_platform_custom_avatar', 10, 2 );
// Register new shortcode name
add_shortcode( 'aquaticpro_app', 'mentorship_platform_shortcode' );
// Keep legacy shortcode for backward compatibility
add_shortcode( 'mentorship_platform_app', 'mentorship_platform_shortcode' );
// Register swimmer progress shortcode for public sharing
add_shortcode( 'swimmer_progress', 'mentorship_platform_swimmer_progress_shortcode' );

/**
 * Fix WordPress 6.8+ Underscore.js compatibility issue with media library.
 * Backbone calls _.isArray which was removed in newer Underscore versions.
 * This injects a polyfill immediately after underscore.js loads.
 */
add_filter( 'script_loader_tag', function( $tag, $handle, $src ) {
    if ( $handle === 'underscore' ) {
        // Inject polyfill script immediately after underscore loads
        $polyfill = '<script>if(typeof _!=="undefined"&&typeof _.isArray==="undefined"){_.isArray=Array.isArray;}</script>';
        return $tag . $polyfill . "\n";
    }
    return $tag;
}, 10, 3 );

// Load plugin styles AFTER theme styles (priority 100) so plugin styles take precedence
add_action( 'wp_enqueue_scripts', 'mentorship_platform_enqueue_scripts', 100 );
add_filter( 'the_title', 'mentorship_platform_hide_title', 10, 2 );
add_filter( 'upload_mimes', 'mentorship_platform_custom_upload_mimes' );

/**
 * Convert the main app script tag to type="module" so ES module code-splitting works.
 * Dynamic import() in lazy-loaded chunks requires the entry script to be a module.
 */
add_filter( 'script_loader_tag', function( $tag, $handle ) {
    if ( 'mentorship-app' === $handle ) {
        $tag = str_replace( '<script ', '<script type="module" ', $tag );
    }
    return $tag;
}, 10, 2 );

/**
 * Strip the ?ver= query string from the ES module entry script.
 *
 * Why: The browser treats 'mentorship-app.js?ver=13.2.7' and 'mentorship-app.js'
 * as two DIFFERENT ES modules (the URL is the module identity). Lazy-loaded chunks
 * generated by Vite use `import('./mentorship-app.js')` (no query string), which
 * creates a second, unconfigured module instance — causing "API service not configured"
 * errors in every code-split chunk. Removing the ver= param ensures a single module.
 */
add_filter( 'script_loader_src', function( $src, $handle ) {
    if ( 'mentorship-app' === $handle ) {
        $src = remove_query_arg( 'ver', $src );
    }
    return $src;
}, 10, 2 );

// ============================================
// PWA SUPPORT — Manifest, Service Worker, Meta
// ============================================

/**
 * Inject PWA manifest link, theme-color meta, and service worker registration
 * on pages that use the AquaticPro shortcode — only when the admin has enabled PWA.
 */
function aquaticpro_pwa_head_tags() {
    if ( ! (bool) get_option( 'aquaticpro_enable_pwa', false ) ) {
        return;
    }

    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;
    if ( ! has_shortcode( $post->post_content, 'aquaticpro_app' ) &&
         ! has_shortcode( $post->post_content, 'mentorship_platform_app' ) ) {
        return;
    }

    $manifest_url = plugin_dir_url( __FILE__ ) . 'build/manifest.json';
    ?>
    <link rel="manifest" href="<?php echo esc_url( $manifest_url ); ?>">
    <meta name="theme-color" content="#0ea5e9">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="AquaticPro">
    <?php
}
add_action( 'wp_head', 'aquaticpro_pwa_head_tags', 1 );

/**
 * Register the service worker via an inline script after the main app JS loads.
 * Only fires on AquaticPro shortcode pages when PWA is enabled.
 *
 * The SW file lives in the plugin's build/ directory, but we need scope: '/'
 * to control the whole site. We register a WordPress rewrite endpoint that
 * serves the file from the root path with the required Service-Worker-Allowed header.
 */
function aquaticpro_pwa_register_sw() {
    if ( ! (bool) get_option( 'aquaticpro_enable_pwa', false ) ) {
        return;
    }

    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;
    if ( ! has_shortcode( $post->post_content, 'aquaticpro_app' ) &&
         ! has_shortcode( $post->post_content, 'mentorship_platform_app' ) ) {
        return;
    }

    // Use the virtual root-level URL so the SW scope can be '/'
    $sw_url = home_url( '/aquaticpro-sw.js' );
    ?>
    <script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('<?php echo esc_js( $sw_url ); ?>', { scope: '/' })
                .then(function(reg) { console.log('[AquaticPro] SW registered, scope:', reg.scope); })
                .catch(function(err) { console.warn('[AquaticPro] SW registration failed:', err); });
        });
    }
    </script>
    <?php
}
add_action( 'wp_footer', 'aquaticpro_pwa_register_sw', 99 );

/**
 * Virtual endpoint to serve the service worker from the site root.
 * This avoids the scope restriction that prevents a SW in /wp-content/...
 * from controlling '/'. The response includes Service-Worker-Allowed: /
 */
function aquaticpro_pwa_sw_rewrite() {
    add_rewrite_rule( '^aquaticpro-sw\.js$', 'index.php?aquaticpro_sw=1', 'top' );
}
add_action( 'init', 'aquaticpro_pwa_sw_rewrite' );

function aquaticpro_pwa_sw_query_var( $vars ) {
    $vars[] = 'aquaticpro_sw';
    return $vars;
}
add_filter( 'query_vars', 'aquaticpro_pwa_sw_query_var' );

function aquaticpro_pwa_sw_template_redirect() {
    if ( ! get_query_var( 'aquaticpro_sw' ) ) {
        return;
    }

    $sw_file = plugin_dir_path( __FILE__ ) . 'build/aquaticpro-sw.js';
    if ( ! file_exists( $sw_file ) ) {
        status_header( 404 );
        exit;
    }

    header( 'Content-Type: application/javascript' );
    header( 'Service-Worker-Allowed: /' );
    header( 'Cache-Control: no-cache, must-revalidate' );
    readfile( $sw_file );
    exit;
}
add_action( 'template_redirect', 'aquaticpro_pwa_sw_template_redirect', 0 );

if ( ! function_exists( 'mentorship_platform_dequeue_scripts' ) ) {
    /**
     * Dequeue conflicting scripts.
     */
    function mentorship_platform_dequeue_scripts() {
        wp_dequeue_script( 'buddypress-nouveau' );
    }
}
add_action( 'wp_enqueue_scripts', 'mentorship_platform_dequeue_scripts', 99 );

add_action('wp_insert_comment', 'add_mentorship_notification_on_comment', 10, 2);
add_action('wp_insert_comment', 'send_daily_log_comment_notification', 10, 2);

function send_daily_log_comment_notification($comment_id, $comment_object) {
    // Only proceed if the comment is approved
    if ($comment_object->comment_approved != '1') {
        return;
    }

    $post = get_post($comment_object->comment_post_ID);
    $post_type = get_post_type($post);

    // Only handle daily logs
    if ($post_type !== 'mp_daily_log') {
        return;
    }

    $post_author_id = (int)$post->post_author;
    $comment_author_id = (int)$comment_object->user_id;

    // Don't notify if author is commenting on their own log
    if ($post_author_id === $comment_author_id) {
        return;
    }

    // Check if the author wants email notifications
    $author_email_pref = get_user_meta($post_author_id, 'email_updates', true);
    if ($author_email_pref === 'no' || $author_email_pref === false) {
        return; // User has disabled email notifications
    }

    $author = get_userdata($post_author_id);
    if (!$author || !$author->user_email) {
        return;
    }

    $commenter = get_userdata($comment_author_id);
    $commenter_name = $commenter ? $commenter->display_name : $comment_object->comment_author;

    $log_title = get_the_title($post->ID);
    $log_date = get_post_meta($post->ID, '_log_date', true);
    
    // Build the link to the daily log
    // Assuming you have a page with the shortcode, construct a URL
    $daily_logs_page_url = home_url('/daily-logs/'); // Adjust based on your site structure
    $log_link = $daily_logs_page_url . '?log_id=' . $post->ID;

    // Email subject
    $subject = sprintf('[AquaticPro] New comment on your daily log "%s"', $log_title);

    // Email body
    $message = sprintf(
        "Hi %s,\n\n" .
        "%s commented on your daily log \"%s\" (%s):\n\n" .
        "\"%s\"\n\n" .
        "View and respond to the comment here:\n%s\n\n" .
        "---\n" .
        "To manage your email preferences, visit your profile settings in AquaticPro.",
        $author->first_name ?: $author->display_name,
        $commenter_name,
        $log_title,
        $log_date,
        wp_trim_words(wp_strip_all_tags($comment_object->comment_content), 30),
        $log_link
    );

    // Send the email
    wp_mail($author->user_email, $subject, $message);
}

function add_mentorship_notification_on_comment($comment_id, $comment_object) {
    // Only proceed if the comment is approved
    if ($comment_object->comment_approved != '1') {
        return;
    }

    $post = get_post($comment_object->comment_post_ID);
    $post_type = get_post_type($post);
    $supported_types = array('mp_goal', 'mp_update', 'mp_meeting');

    if (!in_array($post_type, $supported_types)) {
        return; // Not a post type we care about
    }

    $post_author_id = (int)$post->post_author;
    $comment_author_id = (int)$comment_object->user_id;
    $goal_id = 0;
    $mentorship_id = 0;

    // --- THIS IS THE CORRECTED LOGIC ---
    if ($post_type == 'mp_goal') {
        $goal_id = $post->ID;
    } elseif ($post_type == 'mp_update') {
        $goal_id = get_post_meta($post->ID, '_goal_id', true);
    } elseif ($post_type == 'mp_meeting') {
        $goal_id = get_post_meta($post->ID, '_goal_id', true);
    }
    // --- END CORRECTION ---

    if (empty($goal_id)) {
        return; // Can't find the goal, so we can't find the mentorship
    }

    $mentorship_id = get_post_meta($goal_id, '_mentorship_id', true);
    if (empty($mentorship_id)) {
        return; // Can't find the mentorship
    }

    $mentorship = get_post($mentorship_id);
    if (!$mentorship) {
        return; // Invalid mentorship ID
    }

    $sender_id = (int)$mentorship->post_author;
    $receiver_id = (int)get_post_meta($mentorship->ID, '_receiver_id', true);

    // Determine who the "other user" is to notify
    $other_user_id = 0;
    if ($comment_author_id === $sender_id) {
        $other_user_id = $receiver_id;
    } elseif ($comment_author_id === $receiver_id) {
        $other_user_id = $sender_id;
    } else {
        // This is a comment by an admin who is not part of the mentorship
        // We should notify both participants
        add_mentorship_notification_for_comment($sender_id, $comment_object, $post);
        add_mentorship_notification_for_comment($receiver_id, $comment_object, $post);
        return;
    }
    
    // Notify the single "other user"
    add_mentorship_notification_for_comment($other_user_id, $comment_object, $post);
}

/**
 * Helper function to build and send the comment notification
 */
function add_mentorship_notification_for_comment($user_id_to_notify, $comment_object, $post) {
    if (empty($user_id_to_notify)) {
        return;
    }

    $post_title = get_the_title($post->ID);
    $author_name = $comment_object->comment_author;
    $comment_link = get_comment_link($comment_object);

    // Sanitize content for a single-line message
    $comment_text = wp_strip_all_tags($comment_object->comment_content);
    if (strlen($comment_text) > 100) {
        $comment_text = substr($comment_text, 0, 100) . '...';
    }

    $message = "New comment on \"{$post_title}\" by {$author_name}: \"{$comment_text}\"";
    
    add_mentorship_notification($user_id_to_notify, $message, $comment_link);
}

// --- Batch Notification Cron Job ---

// 1. Add a custom 15-minute cron schedule
add_filter('cron_schedules', 'mentorship_add_cron_interval');
function mentorship_add_cron_interval($schedules) {
    $schedules['fifteen_minutes'] = array(
        'interval' => 900, // 15 minutes in seconds
        'display'  => esc_html__('Every 15 Minutes'),
    );
    $schedules['six_hours'] = array(
        'interval' => 21600, // 6 hours in seconds
        'display'  => esc_html__('Every 6 Hours'),
    );
    return $schedules;
}

// 2. Schedule the event
add_action('wp', 'mentorship_schedule_cron_job');
function mentorship_schedule_cron_job() {
    if (!wp_next_scheduled('mentorship_process_notification_queue')) {
        wp_schedule_event(time(), 'fifteen_minutes', 'mentorship_process_notification_queue');
    }
    // Schedule pay cache refresh every 6 hours
    if (!wp_next_scheduled('aquaticpro_refresh_pay_cache')) {
        wp_schedule_event(time(), 'six_hours', 'aquaticpro_refresh_pay_cache');
    }
    // Schedule in-service hours cache refresh every 6 hours
    if (!wp_next_scheduled('aquaticpro_refresh_inservice_cache')) {
        wp_schedule_event(time(), 'six_hours', 'aquaticpro_refresh_inservice_cache');
    }
}

// 3. Hook the function to the event
add_action('mentorship_process_notification_queue', 'mentorship_run_notification_processor');

// Hook for pay cache refresh
add_action('aquaticpro_refresh_pay_cache', 'aquaticpro_run_pay_cache_refresh');

// Hook for in-service cache refresh
add_action('aquaticpro_refresh_inservice_cache', 'aquaticpro_run_inservice_cache_refresh');

/**
 * Background job to refresh all employee pay caches
 * Runs every 6 hours to keep pay rates current
 */
function aquaticpro_run_pay_cache_refresh() {
    if ( ! class_exists( 'Seasonal_Returns' ) ) {
        return;
    }
    
    error_log('[AquaticPro] Starting scheduled pay cache refresh');
    $start_time = microtime(true);
    
    try {
        $result = Seasonal_Returns::refresh_all_pay_cache();
        $elapsed = round((microtime(true) - $start_time) * 1000, 2);
        error_log("[AquaticPro] Pay cache refresh completed in {$elapsed}ms - {$result['updated']} updated, {$result['failed']} failed");
    } catch ( Throwable $e ) {
        error_log('[AquaticPro] Pay cache refresh failed: ' . $e->getMessage());
    }
}

/**
 * Background job to refresh all in-service hours caches
 * Runs every 6 hours to keep compliance data current
 */
function aquaticpro_run_inservice_cache_refresh() {
    error_log('[AquaticPro] Starting scheduled in-service cache refresh');
    $start_time = microtime(true);
    
    try {
        $result = aquaticpro_refresh_all_inservice_cache();
        $elapsed = round((microtime(true) - $start_time) * 1000, 2);
        error_log("[AquaticPro] In-service cache refresh completed in {$elapsed}ms - {$result['updated']} updated, {$result['failed']} failed");
    } catch ( Throwable $e ) {
        error_log('[AquaticPro] In-service cache refresh failed: ' . $e->getMessage());
    }
}

/**
 * Refresh in-service cache for all users with job role assignments
 * Calculates hours for current month and previous month
 *
 * @return array Stats about the refresh operation
 */
function aquaticpro_refresh_all_inservice_cache() {
    global $wpdb;
    
    $cache_table = $wpdb->prefix . 'pg_inservice_cache';
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if cache table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
    if ( ! $table_exists ) {
        return [ 'updated' => 0, 'failed' => 0, 'error' => 'Cache table does not exist' ];
    }
    
    // Get current and previous month
    $current_month = current_time( 'Y-m' );
    $prev_month = date( 'Y-m', strtotime( $current_month . '-01 -1 month' ) );
    $months = [ $current_month, $prev_month ];
    
    // Get all users with job role assignments
    $user_ids = $wpdb->get_col( "SELECT DISTINCT user_id FROM $assignments_table" );
    
    if ( empty( $user_ids ) ) {
        return [ 'updated' => 0, 'failed' => 0 ];
    }
    
    // Get all role requirements
    $roles = $wpdb->get_results( "SELECT id, inservice_hours FROM $roles_table", OBJECT_K );
    
    // Get primary role for each user (first assignment)
    $user_roles = $wpdb->get_results(
        "SELECT user_id, job_role_id FROM $assignments_table 
         WHERE id IN (SELECT MIN(id) FROM $assignments_table GROUP BY user_id)",
        OBJECT_K
    );
    
    $updated = 0;
    $failed = 0;
    
    foreach ( $user_ids as $user_id ) {
        foreach ( $months as $month ) {
            try {
                $start_date = $month . '-01';
                $end_date = date( 'Y-m-t', strtotime( $start_date ) );
                
                // Calculate hours for this user/month
                $hours_query = $wpdb->prepare(
                    "SELECT SUM(l.duration_hours) as total_hours, COUNT(DISTINCT l.id) as training_count
                    FROM $logs_table l
                    INNER JOIN $attendees_table a ON l.id = a.inservice_id
                    WHERE a.user_id = %d
                    AND a.attendance_status IN ('leader', 'attended')
                    AND l.archived = 0
                    AND l.training_date >= %s
                    AND l.training_date <= %s",
                    $user_id, $start_date, $end_date
                );
                $result = $wpdb->get_row( $hours_query );
                $total_hours = floatval( $result->total_hours ?: 0 );
                $training_count = intval( $result->training_count ?: 0 );
                
                // Get required hours from user's primary role
                $required_hours = 4.0; // default
                if ( isset( $user_roles[ $user_id ] ) ) {
                    $role_id = $user_roles[ $user_id ]->job_role_id;
                    if ( isset( $roles[ $role_id ] ) ) {
                        $required_hours = floatval( $roles[ $role_id ]->inservice_hours ?: 4.0 );
                    }
                }
                
                // Upsert cache record
                $wpdb->replace(
                    $cache_table,
                    [
                        'user_id' => $user_id,
                        'month' => $month,
                        'total_hours' => $total_hours,
                        'required_hours' => $required_hours,
                        'meets_requirement' => $total_hours >= $required_hours ? 1 : 0,
                        'training_count' => $training_count,
                        'calculated_at' => current_time( 'mysql' )
                    ],
                    [ '%d', '%s', '%f', '%f', '%d', '%d', '%s' ]
                );
                
                $updated++;
            } catch ( Throwable $e ) {
                error_log( "In-service cache error for user {$user_id}, month {$month}: " . $e->getMessage() );
                $failed++;
            }
        }
    }
    
    return [ 'updated' => $updated, 'failed' => $failed, 'total_users' => count( $user_ids ) ];
}

/**
 * Invalidate in-service cache for a specific user
 * Call when attendance records change for a user
 *
 * @param int $user_id User ID
 * @param string|null $month Optional specific month to invalidate (YYYY-MM), null for current+previous
 */
function aquaticpro_invalidate_inservice_cache( $user_id, $month = null ) {
    global $wpdb;
    
    $cache_table = $wpdb->prefix . 'pg_inservice_cache';
    
    // Check if cache table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
    if ( ! $table_exists ) {
        return;
    }
    
    if ( $month ) {
        // Delete specific month
        $wpdb->delete( $cache_table, [ 'user_id' => $user_id, 'month' => $month ], [ '%d', '%s' ] );
    } else {
        // Delete all for this user
        $wpdb->delete( $cache_table, [ 'user_id' => $user_id ], [ '%d' ] );
    }
    
    // Immediately recalculate (for this user only)
    aquaticpro_recalculate_inservice_cache_for_user( $user_id );
}

/**
 * Recalculate in-service cache for a single user
 *
 * @param int $user_id User ID
 */
function aquaticpro_recalculate_inservice_cache_for_user( $user_id ) {
    global $wpdb;
    
    $cache_table = $wpdb->prefix . 'pg_inservice_cache';
    $logs_table = $wpdb->prefix . 'pg_inservice_logs';
    $attendees_table = $wpdb->prefix . 'pg_inservice_attendees';
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if cache table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
    if ( ! $table_exists ) {
        return;
    }
    
    // Get current and previous month
    $current_month = current_time( 'Y-m' );
    $prev_month = date( 'Y-m', strtotime( $current_month . '-01 -1 month' ) );
    $months = [ $current_month, $prev_month ];
    
    // Get user's primary role
    $role_id = $wpdb->get_var( $wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d ORDER BY id ASC LIMIT 1",
        $user_id
    ) );
    
    $required_hours = 4.0;
    if ( $role_id ) {
        $role_hours = $wpdb->get_var( $wpdb->prepare(
            "SELECT inservice_hours FROM $roles_table WHERE id = %d",
            $role_id
        ) );
        if ( $role_hours ) {
            $required_hours = floatval( $role_hours );
        }
    }
    
    foreach ( $months as $month ) {
        $start_date = $month . '-01';
        $end_date = date( 'Y-m-t', strtotime( $start_date ) );
        
        // Calculate hours
        $result = $wpdb->get_row( $wpdb->prepare(
            "SELECT SUM(l.duration_hours) as total_hours, COUNT(DISTINCT l.id) as training_count
            FROM $logs_table l
            INNER JOIN $attendees_table a ON l.id = a.inservice_id
            WHERE a.user_id = %d
            AND a.attendance_status IN ('leader', 'attended')
            AND l.archived = 0
            AND l.training_date >= %s
            AND l.training_date <= %s",
            $user_id, $start_date, $end_date
        ) );
        
        $total_hours = floatval( $result->total_hours ?: 0 );
        $training_count = intval( $result->training_count ?: 0 );
        
        // Upsert
        $wpdb->replace(
            $cache_table,
            [
                'user_id' => $user_id,
                'month' => $month,
                'total_hours' => $total_hours,
                'required_hours' => $required_hours,
                'meets_requirement' => $total_hours >= $required_hours ? 1 : 0,
                'training_count' => $training_count,
                'calculated_at' => current_time( 'mysql' )
            ],
            [ '%d', '%s', '%f', '%f', '%d', '%d', '%s' ]
        );
    }
}

// 4. The function that does the work
function mentorship_run_notification_processor() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'mentorship_notifications';

    // Get all pending notifications
    $notifications = $wpdb->get_results("SELECT * FROM $table_name ORDER BY user_id, time ASC");
    if (empty($notifications)) {
        return; // Nothing to do
    }

    $notifications_by_user = array();
    $processed_ids = array();

    // Group notifications by user
    foreach ($notifications as $notification) {
        $notifications_by_user[$notification->user_id][] = $notification;
        $processed_ids[] = $notification->id;
    }

    // Process and send email for each user
    foreach ($notifications_by_user as $user_id => $user_notifications) {
        $user_info = get_userdata($user_id);
        if (!$user_info) {
            continue;
        }

        $subject = 'New AquaticPro Activity';
        $message_body = "Hi " . $user_info->first_name . ",\n\n";
        $message_body .= "You have new activity on the mentorship platform:\n\n";

        foreach ($user_notifications as $notification) {
            $message_body .= "• " . $notification->message . "\n";
            if (!empty($notification->context_url)) {
                 $message_body .= "  " . $notification->context_url . "\n\n";
            }
        }

        $message_body .= "\nRegards,\nThe Mentorship Team";
        
        // Send the email
        wp_mail($user_info->user_email, $subject, $message_body);
    }

    // Clear the queue
    if (!empty($processed_ids)) {
        $ids_placeholder = implode(', ', array_fill(0, count($processed_ids), '%d'));
        $wpdb->query($wpdb->prepare("DELETE FROM $table_name WHERE id IN ($ids_placeholder)", $processed_ids));
    }
}

/**
 * Filter comment REST API response to include custom avatar URLs
 * 
 * @param WP_REST_Response $response The response object.
 * @param WP_Comment $comment Comment object.
 * @param WP_REST_Request $request Request object.
 * @return WP_REST_Response
 */
function mentorship_platform_add_custom_avatar_to_comments($response, $comment, $request) {
    $data = $response->get_data();
    
    // Get custom avatar URL if set
    $custom_avatar = get_user_meta($comment->user_id, 'mentorship_avatar_url', true);
    
    if ($custom_avatar) {
        // Override all avatar URL sizes with custom avatar
        if (isset($data['author_avatar_urls']) && is_array($data['author_avatar_urls'])) {
            foreach ($data['author_avatar_urls'] as $size => $url) {
                $data['author_avatar_urls'][$size] = $custom_avatar;
            }
        }
    }
    
    $response->set_data($data);
    return $response;
}

/**
 * Override WordPress avatar with custom profile picture
 * 
 * This makes custom profile pictures appear everywhere in WordPress,
 * not just in the AquaticPro plugin.
 * 
 * @param array $args Arguments passed to get_avatar_data.
 * @param mixed $id_or_email User ID, email, or object.
 * @return array Modified avatar data.
 */
function mentorship_platform_custom_avatar($args, $id_or_email) {
    // Get user ID from various input types
    $user_id = null;
    
    if (is_numeric($id_or_email)) {
        $user_id = (int) $id_or_email;
    } elseif (is_string($id_or_email)) {
        $user = get_user_by('email', $id_or_email);
        if ($user) {
            $user_id = $user->ID;
        }
    } elseif ($id_or_email instanceof WP_User) {
        $user_id = $id_or_email->ID;
    } elseif ($id_or_email instanceof WP_Post) {
        $user_id = $id_or_email->post_author;
    } elseif ($id_or_email instanceof WP_Comment) {
        $user_id = $id_or_email->user_id;
    }
    
    // If we have a user ID, check for custom avatar
    if ($user_id) {
        $custom_avatar = get_user_meta($user_id, 'mentorship_avatar_url', true);
        
        if ($custom_avatar) {
            $args['url'] = $custom_avatar;
            $args['found_avatar'] = true;
        }
    }
    
    return $args;
}