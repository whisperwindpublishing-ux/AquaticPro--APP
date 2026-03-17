<?php
/**
 * AquaticPro Learning Module (LMS) API Routes
 * Complete learning management with courses, lessons, progress tracking
 * 
 * Uses dedicated database tables (not WordPress posts) for:
 * - Courses
 * - Lessons  
 * - Progress tracking
 * 
 * @package AquaticPro
 * @subpackage LMS
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

require_once(plugin_dir_path(__FILE__) . 'class-lms-migration.php');

/**
 * Create all LMS database tables
 */
function aquaticpro_lms_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    // ============================================
    // COURSES TABLE
    // ============================================
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $sql_courses = "CREATE TABLE $courses_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        featured_image TEXT,
        category VARCHAR(100) DEFAULT NULL,
        is_sequential TINYINT(1) DEFAULT 0,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        display_order INT DEFAULT 0,
        created_by BIGINT(20) UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_status (status),
        KEY idx_display_order (display_order),
        KEY idx_category (category)
    ) $charset_collate;";
    dbDelta($sql_courses);

    // Add category column to existing installs (dbDelta won't add new columns reliably)
    $col_exists = $wpdb->get_results( "SHOW COLUMNS FROM $courses_table LIKE 'category'" );
    if ( empty( $col_exists ) ) {
        $wpdb->query( "ALTER TABLE $courses_table ADD COLUMN category VARCHAR(100) DEFAULT NULL AFTER featured_image, ADD KEY idx_category (category)" );
    }
    
    // ============================================
    // LESSONS TABLE
    // ============================================
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $sql_lessons = "CREATE TABLE $lessons_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT(20) UNSIGNED NOT NULL,
        section_id BIGINT(20) UNSIGNED DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content LONGTEXT,
        lesson_type ENUM('content', 'excalidraw', 'hybrid', 'quiz') DEFAULT 'content',
        featured_image TEXT,
        excalidraw_json LONGTEXT,
        scroll_cues LONGTEXT,
        slide_order LONGTEXT,
        hybrid_layout VARCHAR(20) DEFAULT 'text-left',
        split_ratio FLOAT DEFAULT 0.4,
        estimated_time VARCHAR(50),
        display_order INT DEFAULT 0,
        created_by BIGINT(20) UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_course_id (course_id),
        KEY idx_section_id (section_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_lessons);
    
    // ============================================
    // LESSON SECTIONS TABLE (for grouping lessons)
    // ============================================
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    $sql_sections = "CREATE TABLE $sections_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT(20) UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_course_id (course_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_sections);
    
    // ============================================
    // PROGRESS TABLE
    // ============================================
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    $sql_progress = "CREATE TABLE $progress_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT(20) UNSIGNED NOT NULL,
        lesson_id BIGINT(20) UNSIGNED NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'not-started',
        score FLOAT DEFAULT 0,
        last_viewed DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        time_spent_seconds INT UNSIGNED DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_lesson (user_id, lesson_id),
        KEY idx_user_id (user_id),
        KEY idx_lesson_id (lesson_id),
        KEY idx_status (status)
    ) $charset_collate;";
    dbDelta($sql_progress);
    
    // ============================================
    // COURSE CATEGORIES TABLE
    // ============================================
    $categories_table = $wpdb->prefix . 'aquaticpro_course_categories';
    $sql_categories = "CREATE TABLE $categories_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_name (name),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_categories);
    
    // Mark tables as created with version
    update_option('aquaticpro_lms_tables_version', '2.5.0');
    
    error_log('[AquaticPro LMS] Database tables created/updated to version 2.5.0');
}

// Run table creation on init (only if needed)
add_action('init', function() {
    $current_version = get_option('aquaticpro_lms_tables_version', '0');
    if (version_compare($current_version, '2.5.0', '<')) {
        aquaticpro_lms_create_tables();
    }
});

/**
 * Register LMS REST API routes
 */
function aquaticpro_register_lms_api_routes() {
    $namespace = 'aquaticpro/v1';

    // ============================================
    // COURSE ENDPOINTS
    // ============================================
    
    // GET /courses - List all courses
    register_rest_route($namespace, '/courses', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_courses',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
    ));
    
    // GET /courses/{id} - Get single course
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_course',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // POST /courses - Create course
    register_rest_route($namespace, '/courses', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_create_course',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'title' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'description' => array(
                'required'          => false,
                'type'              => 'string',
                'sanitize_callback' => 'wp_kses_post',
            ),
            'sequential' => array(
                'required'          => false,
                'type'              => 'boolean',
                'default'           => false,
            ),
            'status' => array(
                'required'          => false,
                'type'              => 'string',
                'default'           => 'published',
            ),
        ),
    ));
    
    // PUT /courses/{id} - Update course
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_update_course',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // DELETE /courses/{id} - Delete course
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_lms_delete_course',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));

    // ============================================
    // LESSON ENDPOINTS
    // ============================================
    
    // GET /courses/{id}/lessons - Get lessons for a course
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/lessons', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_course_lessons',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
        'args' => array(
            'course_id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // POST /courses/{id}/lessons - Create lesson in course
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/lessons', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_create_lesson',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'course_id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
            'title' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ));
    
    // GET /lessons/{id} - Get single lesson
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_lesson',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // PUT /lessons/{id} - Update lesson
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_update_lesson',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // DELETE /lessons/{id} - Delete lesson
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_lms_delete_lesson',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // POST /lessons/{id}/meta - Save lesson excalidraw data
    register_rest_route($namespace, '/lessons/(?P<id>\d+)/meta', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_save_lesson_meta',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));

    // ============================================
    // PROGRESS ENDPOINTS
    // ============================================
    
    // GET /progress - Get all user progress
    register_rest_route($namespace, '/progress', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_progress',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
    ));
    
    // GET /analytics/progress - Get all student progress (Admin/Manager only)
    register_rest_route($namespace, '/analytics/progress', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_all_student_progress',
        'permission_callback' => 'aquaticpro_lms_check_can_view_analytics',
    ));

    // POST /progress - Update progress (upsert)
    register_rest_route($namespace, '/progress', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_update_progress',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
        'args' => array(
            'lesson_id' => array(
                'required'          => true,
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
            'status' => array(
                'required'          => false,
                'default'           => 'in-progress',
                'validate_callback' => function($param) {
                    return in_array($param, array('not-started', 'in-progress', 'completed'), true);
                },
            ),
        ),
    ));
    
    // PUT /lessons/reorder - Reorder lessons
    register_rest_route($namespace, '/lessons/reorder', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_reorder_lessons',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));
    
    // ============================================
    // SECTION ENDPOINTS
    // ============================================
    
    // GET /courses/{id}/sections - Get sections for a course
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/sections', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_sections',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
        'args' => array(
            'course_id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // POST /courses/{id}/sections - Create section
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/sections', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_create_section',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'course_id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
            'title' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ));
    
    // PUT /sections/{id} - Update section
    register_rest_route($namespace, '/sections/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_update_section',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // DELETE /sections/{id} - Delete section
    register_rest_route($namespace, '/sections/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_lms_delete_section',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));
    
    // PUT /sections/reorder - Reorder sections
    register_rest_route($namespace, '/sections/reorder', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_reorder_sections',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));

    // ============================================
    // MIGRATION ROUTES
    // ============================================

    // GET /courses/{id}/export - Export course to ZIP
    register_rest_route($namespace, '/courses/(?P<id>\d+)/export', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_export_course',
        'permission_callback' => 'aquaticpro_lms_check_can_moderate',
        'args' => array(
            'id' => array(
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));

    // POST /courses/import - Import course from ZIP
    register_rest_route($namespace, '/courses/import', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_import_course',
        'permission_callback' => 'aquaticpro_lms_check_can_moderate',
    ));
    
    // POST /courses/import-learndash - Import from LearnDash
    register_rest_route($namespace, '/courses/import-learndash', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_import_learndash',
        'permission_callback' => 'aquaticpro_lms_check_can_moderate',
        'args' => array(
            'learndash_course_id' => array(
                'required' => true,
                'validate_callback' => function($param) { return is_numeric($param) && $param > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ));

    // ============================================
    // COURSE CATEGORY ENDPOINTS
    // ============================================

    // GET /course-categories - List all categories
    register_rest_route($namespace, '/course-categories', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_categories',
        'permission_callback' => 'aquaticpro_lms_check_logged_in',
    ));

    // POST /course-categories - Create category
    register_rest_route($namespace, '/course-categories', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_create_category',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));

    // PUT /course-categories/{id} - Update category
    register_rest_route($namespace, '/course-categories/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_update_category',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));

    // DELETE /course-categories/{id} - Delete category (nulls courses)
    register_rest_route($namespace, '/course-categories/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_lms_delete_category',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));

    // PUT /course-categories/reorder - Reorder categories
    register_rest_route($namespace, '/course-categories/reorder', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_reorder_categories',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ));
}

add_action('rest_api_init', 'aquaticpro_register_lms_api_routes');

// ============================================
// PERMISSION CALLBACKS
// ============================================

function aquaticpro_lms_check_logged_in() {
    return is_user_logged_in();
}

function aquaticpro_lms_check_can_edit() {
    if (!is_user_logged_in()) {
        return false;
    }
    
    // Plugin Admins (WP admins and Tier 6+) can always edit
    if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin()) {
        return true;
    }
    
    // Check if user has LMS edit permission via job role
    $user_id = get_current_user_id();
    global $wpdb;
    
    // Get role IDs from the correct assignments table
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_roles = $wpdb->get_col($wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ));
    
    if (!empty($user_roles)) {
        // Check LMS permissions from the dedicated permissions table
        $lms_perms_table = $wpdb->prefix . 'pg_lms_permissions';
        $placeholders = implode(',', array_fill(0, count($user_roles), '%d'));
        $result = $wpdb->get_row($wpdb->prepare(
            "SELECT MAX(can_create_courses) as can_create_courses, MAX(can_edit_courses) as can_edit_courses
             FROM $lms_perms_table WHERE job_role_id IN ($placeholders)",
            ...$user_roles
        ), ARRAY_A);
        
        if ($result && (!empty($result['can_create_courses']) || !empty($result['can_edit_courses']))) {
            return true;
        }
    }
    
    return false;
}

function aquaticpro_lms_check_can_moderate() {
    if (!is_user_logged_in()) {
        return false;
    }

    // Plugin Admins (WP admins and Tier 6+) can always moderate
    if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin()) {
        return true;
    }

    $user_id = get_current_user_id();
    global $wpdb;

    // Get role IDs from the correct assignments table
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_roles = $wpdb->get_col($wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ));

    if (!empty($user_roles)) {
        // Check LMS permissions from the dedicated permissions table
        $lms_perms_table = $wpdb->prefix . 'pg_lms_permissions';
        $placeholders = implode(',', array_fill(0, count($user_roles), '%d'));
        $result = $wpdb->get_row($wpdb->prepare(
            "SELECT MAX(can_moderate_all) as can_moderate_all
             FROM $lms_perms_table WHERE job_role_id IN ($placeholders)",
            ...$user_roles
        ), ARRAY_A);

        if ($result && !empty($result['can_moderate_all'])) {
            return true;
        }
    }
    return false;
}

function aquaticpro_lms_check_can_view_analytics() {
    if (!is_user_logged_in()) {
        return false;
    }

    // Plugin Admins (WP admins and Tier 6+) can always view analytics
    if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin()) {
        return true;
    }

    $user_id = get_current_user_id();
    global $wpdb;

    // Get role IDs from the correct assignments table
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_roles = $wpdb->get_col($wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ));

    if (!empty($user_roles)) {
        // Check LMS permissions from the dedicated permissions table
        // Allow if has moderate or edit perms (instructors/managers can view analytics)
        $lms_perms_table = $wpdb->prefix . 'pg_lms_permissions';
        $placeholders = implode(',', array_fill(0, count($user_roles), '%d'));
        $result = $wpdb->get_row($wpdb->prepare(
            "SELECT MAX(can_moderate_all) as can_moderate_all, MAX(can_edit_courses) as can_edit_courses
             FROM $lms_perms_table WHERE job_role_id IN ($placeholders)",
            ...$user_roles
        ), ARRAY_A);

        if ($result && (!empty($result['can_moderate_all']) || !empty($result['can_edit_courses']))) {
            return true;
        }
    }
    
    return false;
}

// ============================================
// COURSE CALLBACKS
// ============================================

/**
 * GET /courses - List all courses with progress
 */
function aquaticpro_lms_get_courses(WP_REST_Request $request) {
    global $wpdb;
    $user_id = get_current_user_id();
    
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    // Get all published courses (or all for editors)
    $can_edit = aquaticpro_lms_check_can_edit();
    $status_filter = $can_edit ? "" : "WHERE c.status = 'published'";
    
    $courses = $wpdb->get_results(
        "SELECT c.*, 
            (SELECT COUNT(*) FROM $lessons_table WHERE course_id = c.id) as lesson_count
         FROM $courses_table c
         $status_filter
         ORDER BY c.display_order ASC, c.created_at DESC"
    );
    
    if ($courses === null) {
        return new WP_Error('db_error', 'Failed to fetch courses', array('status' => 500));
    }
    
    // Calculate progress for each course
    $result = array();
    foreach ($courses as $course) {
        $lesson_count = (int) $course->lesson_count;
        $progress = 0;
        
        if ($lesson_count > 0) {
            $completed = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT p.lesson_id) 
                 FROM $progress_table p
                 INNER JOIN $lessons_table l ON p.lesson_id = l.id
                 WHERE p.user_id = %d 
                 AND p.status = 'completed'
                 AND l.course_id = %d",
                $user_id,
                $course->id
            ));
            $progress = round(($completed / $lesson_count) * 100);
        }
        
        $result[] = array(
            'id'           => (int) $course->id,
            'title'        => $course->title,
            'description'  => $course->description,
            'featuredImage'=> $course->featured_image,
            'category'     => $course->category ?: '',
            'sequential'   => (bool) $course->is_sequential,
            'status'       => $course->status,
            'lessonCount'  => $lesson_count,
            'progress'     => $progress,
            'displayOrder' => (int) $course->display_order,
            'createdAt'    => $course->created_at,
            'updatedAt'    => $course->updated_at,
        );
    }
    
    return rest_ensure_response($result);
}

/**
 * GET /courses/{id} - Get single course with lessons
 */
function aquaticpro_lms_get_course(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('id');
    
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $course = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $courses_table WHERE id = %d",
        $course_id
    ));
    
    if (!$course) {
        return new WP_Error('not_found', 'Course not found', array('status' => 404));
    }
    
    return rest_ensure_response(array(
        'id'           => (int) $course->id,
        'title'        => $course->title,
        'description'  => $course->description,
        'featuredImage'=> $course->featured_image,
        'category'     => $course->category ?: '',
        'sequential'   => (bool) $course->is_sequential,
        'status'       => $course->status,
        'displayOrder' => (int) $course->display_order,
        'createdAt'    => $course->created_at,
        'updatedAt'    => $course->updated_at,
    ));
}

/**
 * POST /courses - Create new course
 */
function aquaticpro_lms_create_course(WP_REST_Request $request) {
    global $wpdb;
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    
    $title = $request->get_param('title');
    $description = $request->get_param('description') ?: '';
    $sequential = $request->get_param('sequential') ? 1 : 0;
    $status = $request->get_param('status') ?: 'published';
    $category = sanitize_text_field( $request->get_param('category') ?: '' );
    
    // Validate status
    if (!in_array($status, array('draft', 'published', 'archived'))) {
        $status = 'published';
    }
    
    // Get next display order
    $max_order = (int) $wpdb->get_var("SELECT MAX(display_order) FROM $courses_table");
    
    $result = $wpdb->insert(
        $courses_table,
        array(
            'title'         => $title,
            'description'   => $description,
            'category'      => $category ?: null,
            'is_sequential' => $sequential,
            'status'        => $status,
            'display_order' => $max_order + 1,
            'created_by'    => get_current_user_id(),
        ),
        array('%s', '%s', '%s', '%d', '%s', '%d', '%d')
    );
    
    if ($result === false) {
        error_log('[AquaticPro LMS] Failed to create course: ' . $wpdb->last_error);
        return new WP_Error('db_error', 'Failed to create course: ' . $wpdb->last_error, array('status' => 500));
    }
    
    $course_id = $wpdb->insert_id;
    
    error_log('[AquaticPro LMS] Created course ID: ' . $course_id);
    
    return rest_ensure_response(array(
        'id'           => $course_id,
        'title'        => $title,
        'description'  => $description,
        'category'     => $category,
        'sequential'   => (bool) $sequential,
        'status'       => $status,
        'lessonCount'  => 0,
        'progress'     => 0,
        'createdAt'    => current_time('mysql'),
        'updatedAt'    => current_time('mysql'),
    ));
}

/**
 * PUT /courses/{id} - Update course
 */
function aquaticpro_lms_update_course(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('id');
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    
    // Verify course exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $courses_table WHERE id = %d",
        $course_id
    ));
    
    if (!$exists) {
        return new WP_Error('not_found', 'Course not found', array('status' => 404));
    }
    
    $update_data = array();
    $update_format = array();
    
    if ($request->has_param('title')) {
        $update_data['title'] = sanitize_text_field($request->get_param('title'));
        $update_format[] = '%s';
    }
    
    if ($request->has_param('description')) {
        $update_data['description'] = wp_kses_post($request->get_param('description'));
        $update_format[] = '%s';
    }
    
    if ($request->has_param('sequential')) {
        $update_data['is_sequential'] = $request->get_param('sequential') ? 1 : 0;
        $update_format[] = '%d';
    }
    
    if ($request->has_param('status')) {
        $status = $request->get_param('status');
        if (in_array($status, array('draft', 'published', 'archived'))) {
            $update_data['status'] = $status;
            $update_format[] = '%s';
        }
    }
    
    if ($request->has_param('featuredImage')) {
        $update_data['featured_image'] = esc_url_raw($request->get_param('featuredImage'));
        $update_format[] = '%s';
    }

    if ($request->has_param('category')) {
        $cat = sanitize_text_field( $request->get_param('category') );
        $update_data['category'] = $cat ?: null;
        $update_format[] = '%s';
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $result = $wpdb->update(
        $courses_table,
        $update_data,
        array('id' => $course_id),
        $update_format,
        array('%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to update course', array('status' => 500));
    }
    
    // Return updated course
    return aquaticpro_lms_get_course($request);
}

/**
 * DELETE /courses/{id} - Delete course and all lessons
 */
function aquaticpro_lms_delete_course(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('id');
    
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    // Get all lesson IDs for this course
    $lesson_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT id FROM $lessons_table WHERE course_id = %d",
        $course_id
    ));
    
    // Delete progress for all lessons
    if (!empty($lesson_ids)) {
        $placeholders = implode(',', array_fill(0, count($lesson_ids), '%d'));
        // Delete progress for all lessons
        $wpdb->query($wpdb->prepare(
            "DELETE FROM $progress_table WHERE lesson_id IN ($placeholders)",
            $lesson_ids
        ));
    }
    
    // Delete all lessons
    $wpdb->delete($lessons_table, array('course_id' => $course_id), array('%d'));
    
    // Delete course
    $result = $wpdb->delete($courses_table, array('id' => $course_id), array('%d'));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to delete course', array('status' => 500));
    }
    
    return rest_ensure_response(array(
        'deleted' => true,
        'id'      => $course_id,
    ));
}

// ============================================
// LESSON CALLBACKS
// ============================================

/**
 * GET /courses/{id}/lessons - Get all lessons for a course
 */
function aquaticpro_lms_get_course_lessons(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('course_id');
    $user_id = get_current_user_id();
    
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    $lessons = $wpdb->get_results($wpdb->prepare(
        "SELECT l.*, 
            p.status as progress_status, p.score, p.completed_at, p.last_viewed
         FROM $lessons_table l
         LEFT JOIN $progress_table p ON l.id = p.lesson_id AND p.user_id = %d
         WHERE l.course_id = %d
         ORDER BY l.display_order ASC, l.created_at ASC",
        $user_id,
        $course_id
    ));
    
    $result = array();
    foreach ($lessons as $lesson) {
        $result[] = array(
            'id'            => (int) $lesson->id,
            'courseId'      => (int) $lesson->course_id,
            'sectionId'     => $lesson->section_id ? (int) $lesson->section_id : null,
            'title'         => $lesson->title,
            'description'   => $lesson->description,
            'content'       => $lesson->content,
            'type'          => $lesson->lesson_type,
            'featuredImage' => $lesson->featured_image,
            'estimatedTime' => $lesson->estimated_time,
            'order'         => (int) $lesson->display_order,
            'hasExcalidraw' => !empty($lesson->excalidraw_json),
            'progress'      => array(
                'status'      => $lesson->progress_status ?: 'not-started',
                'score'       => $lesson->score ? (float) $lesson->score : 0,
                'completedAt' => $lesson->completed_at,
                'lastViewed'  => $lesson->last_viewed,
            ),
            'createdAt'     => $lesson->created_at,
            'updatedAt'     => $lesson->updated_at,
        );
    }
    
    return rest_ensure_response($result);
}

/**
 * GET /lessons/{id} - Get single lesson with all data
 */
function aquaticpro_lms_get_lesson(WP_REST_Request $request) {
    global $wpdb;
    $lesson_id = $request->get_param('id');
    $user_id = get_current_user_id();
    
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    $lesson = $wpdb->get_row($wpdb->prepare(
        "SELECT l.*, p.status as progress_status, p.score, p.completed_at
         FROM $lessons_table l
         LEFT JOIN $progress_table p ON l.id = p.lesson_id AND p.user_id = %d
         WHERE l.id = %d",
        $user_id,
        $lesson_id
    ));
    
    if (!$lesson) {
        return new WP_Error('not_found', 'Lesson not found', array('status' => 404));
    }
    
    return rest_ensure_response(array(
        'id'            => (int) $lesson->id,
        'courseId'      => (int) $lesson->course_id,
        'sectionId'     => $lesson->section_id ? (int) $lesson->section_id : null,
        'title'         => $lesson->title,
        'description'   => $lesson->description,
        'content'       => $lesson->content,
        'type'          => $lesson->lesson_type,
        'featuredImage' => $lesson->featured_image,
        'excalidrawJson'=> $lesson->excalidraw_json,
        'scrollCues'    => $lesson->scroll_cues ? json_decode($lesson->scroll_cues) : [],
        'slideOrder'    => $lesson->slide_order ? json_decode($lesson->slide_order) : [],
        'hybridLayout'  => $lesson->hybrid_layout ?: 'text-left',
        'splitRatio'    => $lesson->split_ratio ? (float) $lesson->split_ratio : 0.4,
        'estimatedTime' => $lesson->estimated_time,
        'order'         => (int) $lesson->display_order,
        'progress'      => array(
            'status'      => $lesson->progress_status ?: 'not-started',
            'score'       => $lesson->score ? (float) $lesson->score : 0,
            'completedAt' => $lesson->completed_at,
        ),
        'createdAt'     => $lesson->created_at,
        'updatedAt'     => $lesson->updated_at,
    ));
}

/**
 * POST /courses/{id}/lessons - Create lesson
 */
function aquaticpro_lms_create_lesson(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('course_id');
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    
    // Verify course exists
    $course_exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $courses_table WHERE id = %d",
        $course_id
    ));
    
    if (!$course_exists) {
        return new WP_Error('not_found', 'Course not found', array('status' => 404));
    }
    
    $title = sanitize_text_field($request->get_param('title'));
    $description = wp_kses_post($request->get_param('description') ?: '');
    $raw_content = $request->get_param('content') ?: '';
    $lesson_type = sanitize_text_field($request->get_param('type') ?: 'content');
    $estimated_time = sanitize_text_field($request->get_param('estimatedTime') ?: '');
    $featured_image = esc_url_raw($request->get_param('featuredImage') ?: '');
    $hybrid_layout = sanitize_text_field($request->get_param('hybridLayout') ?: 'text-left');
    $excalidraw_json = $request->get_param('excalidrawJson') ?: '';
    
    // Handle content - might be JSON (BlockNote) or HTML
    $content = $raw_content;
    $decoded = json_decode($raw_content);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        // Not JSON, sanitize as HTML
        $content = wp_kses_post($raw_content);
    }
    
    // Get next display order
    $max_order = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(display_order) FROM $lessons_table WHERE course_id = %d",
        $course_id
    ));
    
    $result = $wpdb->insert(
        $lessons_table,
        array(
            'course_id'      => $course_id,
            'title'          => $title,
            'description'    => $description,
            'content'        => $content,
            'lesson_type'    => $lesson_type,
            'estimated_time' => $estimated_time,
            'featured_image' => $featured_image,
            'hybrid_layout'  => $hybrid_layout,
            'excalidraw_json'=> $excalidraw_json,
            'display_order'  => $max_order + 1,
            'created_by'     => get_current_user_id(),
        ),
        array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create lesson', array('status' => 500));
    }
    
    $lesson_id = $wpdb->insert_id;
    
    return rest_ensure_response(array(
        'id'            => $lesson_id,
        'courseId'      => $course_id,
        'title'         => $title,
        'description'   => $description,
        'content'       => $content,
        'type'          => $lesson_type,
        'estimatedTime' => $estimated_time,
        'order'         => $max_order + 1,
        'progress'      => array('status' => 'not-started', 'score' => 0),
        'createdAt'     => current_time('mysql'),
        'updatedAt'     => current_time('mysql'),
    ));
}

/**
 * PUT /lessons/{id} - Update lesson
 */
function aquaticpro_lms_update_lesson(WP_REST_Request $request) {
    global $wpdb;
    $lesson_id = $request->get_param('id');
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    
    // Verify lesson exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $lessons_table WHERE id = %d",
        $lesson_id
    ));
    
    if (!$exists) {
        return new WP_Error('not_found', 'Lesson not found', array('status' => 404));
    }
    
    $update_data = array();
    $update_format = array();
    
    $fields = array(
        'title' => array('sanitize_text_field', '%s'),
        'description' => array('wp_kses_post', '%s'),
        'type' => array('sanitize_text_field', '%s'),
        'estimatedTime' => array('sanitize_text_field', '%s'),
        'featuredImage' => array('esc_url_raw', '%s'),
        'hybridLayout' => array('sanitize_text_field', '%s'),
        'order' => array('absint', '%d'),
        'sectionId' => array('absint', '%d'),
    );
    
    // Handle content separately - it might be JSON for BlockNote
    if ($request->has_param('content')) {
        $content = $request->get_param('content');
        // Try to detect if it's JSON (BlockNote format)
        $decoded = json_decode($content);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            // It's valid JSON, store as-is
            $update_data['content'] = $content;
        } else {
            // It's HTML, sanitize it
            $update_data['content'] = wp_kses_post($content);
        }
        $update_format[] = '%s';
    }
    
    foreach ($fields as $param => $config) {
        if ($request->has_param($param)) {
            $db_field = $param === 'type' ? 'lesson_type' : 
                       ($param === 'estimatedTime' ? 'estimated_time' :
                       ($param === 'featuredImage' ? 'featured_image' :
                       ($param === 'hybridLayout' ? 'hybrid_layout' :
                       ($param === 'sectionId' ? 'section_id' :
                       ($param === 'order' ? 'display_order' : $param)))));
            
            // Handle sectionId specially - allow null/0 to clear
            if ($param === 'sectionId') {
                $value = $request->get_param($param);
                $update_data[$db_field] = ($value === null || $value === '' || $value === 0) ? null : absint($value);
                $update_format[] = $value === null || $value === '' || $value === 0 ? null : '%d';
            } else {
                $update_data[$db_field] = call_user_func($config[0], $request->get_param($param));
                $update_format[] = $config[1];
            }
        }
    }
    
    // Handle excalidraw JSON
    if ($request->has_param('excalidrawJson')) {
        $update_data['excalidraw_json'] = $request->get_param('excalidrawJson');
        $update_format[] = '%s';
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $result = $wpdb->update(
        $lessons_table,
        $update_data,
        array('id' => $lesson_id),
        $update_format,
        array('%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to update lesson', array('status' => 500));
    }
    
    // Return updated lesson
    $request->set_param('id', $lesson_id);
    return aquaticpro_lms_get_lesson($request);
}

/**
 * DELETE /lessons/{id} - Delete lesson
 */
function aquaticpro_lms_delete_lesson(WP_REST_Request $request) {
    global $wpdb;
    $lesson_id = $request->get_param('id');
    
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    // Delete progress
    $wpdb->delete($progress_table, array('lesson_id' => $lesson_id), array('%d'));
    
    // Delete lesson
    $result = $wpdb->delete($lessons_table, array('id' => $lesson_id), array('%d'));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to delete lesson', array('status' => 500));
    }
    
    return rest_ensure_response(array(
        'deleted' => true,
        'id'      => $lesson_id,
    ));
}

/**
 * POST /lessons/{id}/meta - Save lesson excalidraw data
 */
function aquaticpro_lms_save_lesson_meta(WP_REST_Request $request) {
    global $wpdb;
    $lesson_id = $request->get_param('id');
    
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    
    // Verify lesson exists
    $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $lessons_table WHERE id = %d",
        $lesson_id
    ));
    
    if (!$exists) {
        return new WP_Error('not_found', 'Lesson not found', array('status' => 404));
    }
    
    $type = $request->get_param('type');
    $data = $request->get_param('data');
    
    $updated = array();
    
    // Handle excalidraw
    if ($type === 'excalidraw') {
        $excalidraw_json = is_string($data) ? $data : wp_json_encode($data);
        $wpdb->update(
            $lessons_table,
            array('excalidraw_json' => $excalidraw_json),
            array('id' => $lesson_id),
            array('%s'),
            array('%d')
        );
        $updated['excalidraw'] = true;
    }

    // Handle scrollCues
    if ($type === 'scrollCues') {
        $scroll_cues = is_string($data) ? $data : wp_json_encode($data);
        $wpdb->update(
            $lessons_table,
            array('scroll_cues' => $scroll_cues),
            array('id' => $lesson_id),
            array('%s'),
            array('%d')
        );
        $updated['scrollCues'] = true;
    }
    
    // Handle slideOrder
    if ($type === 'slideOrder') {
        $slide_order = is_string($data) ? $data : wp_json_encode($data);
        $wpdb->update(
            $lessons_table,
            array('slide_order' => $slide_order),
            array('id' => $lesson_id),
            array('%s'),
            array('%d')
        );
        $updated['slideOrder'] = true;
    }

    // Handle splitRatio
    if ($type === 'splitRatio') {
        $split_ratio = (float) $data;
        $wpdb->update(
            $lessons_table,
            array('split_ratio' => $split_ratio),
            array('id' => $lesson_id),
            array('%f'),
            array('%d')
        );
        $updated['splitRatio'] = true;
    }
    
    return rest_ensure_response(array(
        'success'   => true,
        'lesson_id' => $lesson_id,
        'updated'   => $updated,
    ));
}

/**
 * PUT /lessons/reorder - Reorder lessons within a course
 */
function aquaticpro_lms_reorder_lessons(WP_REST_Request $request) {
    global $wpdb;
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    
    $order = $request->get_param('order');
    
    if (!is_array($order)) {
        return new WP_Error('invalid_data', 'Order must be an array of lesson IDs', array('status' => 400));
    }
    
    foreach ($order as $index => $lesson_id) {
        $wpdb->update(
            $lessons_table,
            array('display_order' => $index),
            array('id' => (int) $lesson_id),
            array('%d'),
            array('%d')
        );
    }
    
    return rest_ensure_response(array(
        'success' => true,
        'reordered' => count($order),
    ));
}

// ============================================
// PROGRESS CALLBACKS
// ============================================

/**
 * GET /progress - Get all progress for current user
 */
function aquaticpro_lms_get_progress(WP_REST_Request $request) {
    global $wpdb;
    $user_id = get_current_user_id();
    
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    
    $results = $wpdb->get_results($wpdb->prepare(
        "SELECT p.*, l.title as lesson_title, l.course_id
         FROM $progress_table p
         LEFT JOIN $lessons_table l ON p.lesson_id = l.id
         WHERE p.user_id = %d
         ORDER BY p.last_viewed DESC",
        $user_id
    ));
    
    $progress = array();
    foreach ($results as $row) {
        $progress[] = array(
            'lessonId'    => (int) $row->lesson_id,
            'lessonTitle' => $row->lesson_title,
            'courseId'    => (int) $row->course_id,
            'status'      => $row->status,
            'score'       => (float) $row->score,
            'lastViewed'  => $row->last_viewed,
            'completedAt' => $row->completed_at,
            'timeSpent'   => (int) $row->time_spent_seconds,
        );
    }
    
    return rest_ensure_response($progress);
}

/**
 * GET /analytics/progress - Get all student progress
 *
 * Optional query params:
 *   courseId          - filter to a single course
 *   excludeArchived  - "1" (default) to hide archived users, "0" to include them
 */
function aquaticpro_lms_get_all_student_progress(WP_REST_Request $request) {
    global $wpdb;
    
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    $lessons_table  = $wpdb->prefix . 'aquaticpro_lessons';
    $courses_table  = $wpdb->prefix . 'aquaticpro_courses';
    $users_table    = $wpdb->prefix . 'users';
    $usermeta_table = $wpdb->prefix . 'usermeta';
    
    // Optional filters
    $course_id        = $request->get_param('courseId');
    $exclude_archived = $request->get_param('excludeArchived');
    if ($exclude_archived === null) {
        $exclude_archived = '1'; // default: hide archived
    }
    
    $where_clauses = array();
    $prepare_args  = array();
    
    if ($course_id) {
        $where_clauses[] = 'l.course_id = %d';
        $prepare_args[]  = (int) $course_id;
    }
    
    if ($exclude_archived === '1') {
        $where_clauses[] = "(archived_meta.meta_value IS NULL OR archived_meta.meta_value != '1')";
    }
    
    $where_sql = '';
    if (!empty($where_clauses)) {
        $where_sql = 'WHERE ' . implode(' AND ', $where_clauses);
    }
    
    $query = "
        SELECT 
            p.*, 
            l.title as lesson_title, 
            l.lesson_type,
            l.course_id,
            c.title as course_title,
            u.display_name as user_name,
            u.user_email,
            fn_meta.meta_value as first_name,
            ln_meta.meta_value as last_name,
            CASE WHEN archived_meta.meta_value = '1' THEN 1 ELSE 0 END as is_archived
        FROM $progress_table p
        JOIN $lessons_table l ON p.lesson_id = l.id
        JOIN $courses_table c ON l.course_id = c.id
        JOIN $users_table u ON p.user_id = u.ID
        LEFT JOIN $usermeta_table fn_meta ON u.ID = fn_meta.user_id AND fn_meta.meta_key = 'first_name'
        LEFT JOIN $usermeta_table ln_meta ON u.ID = ln_meta.user_id AND ln_meta.meta_key = 'last_name'
        LEFT JOIN $usermeta_table archived_meta ON u.ID = archived_meta.user_id AND archived_meta.meta_key = 'aquaticpro_is_archived'
        $where_sql
        ORDER BY ln_meta.meta_value ASC, fn_meta.meta_value ASC, c.title ASC, l.display_order ASC
    ";
    
    if (!empty($prepare_args)) {
        $query = $wpdb->prepare($query, $prepare_args);
    }
    
    $results = $wpdb->get_results($query);
    
    // Group by user
    $data = array();
    
    foreach ($results as $row) {
        $user_id = (int) $row->user_id;
        
        if (!isset($data[$user_id])) {
            $data[$user_id] = array(
                'userId'    => $user_id,
                'userName'  => $row->user_name,
                'userEmail' => $row->user_email,
                'firstName' => $row->first_name ?: '',
                'lastName'  => $row->last_name ?: '',
                'isArchived' => (bool) $row->is_archived,
                'courses'   => array(),
            );
        }
        
        $course_id = (int) $row->course_id;
        if (!isset($data[$user_id]['courses'][$course_id])) {
            $data[$user_id]['courses'][$course_id] = array(
                'courseId' => $course_id,
                'courseTitle' => $row->course_title,
                'lessons' => array()
            );
        }
        
        $data[$user_id]['courses'][$course_id]['lessons'][] = array(
            'lessonId' => (int) $row->lesson_id,
            'lessonTitle' => $row->lesson_title,
            'type' => $row->lesson_type,
            'status' => $row->status,
            'score' => (float) $row->score,
            'completedAt' => $row->completed_at,
            'timeSpent' => (int) $row->time_spent_seconds
        );
    }
    
    return rest_ensure_response(array_values($data));
}

/**
 * POST /progress - Update progress (upsert)
 */
function aquaticpro_lms_update_progress(WP_REST_Request $request) {
    global $wpdb;
    $user_id = get_current_user_id();
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    
    $lesson_id = $request->get_param('lesson_id');
    $status = $request->get_param('status') ?: 'in-progress';
    $score = $request->get_param('score') ?: 0;
    $time_spent = $request->get_param('time_spent_seconds') ?: 0;
    
    $now = current_time('mysql');
    $completed_at = ($status === 'completed') ? $now : null;
    
    // Check if record exists
    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT id, time_spent_seconds, completed_at FROM $progress_table WHERE user_id = %d AND lesson_id = %d",
        $user_id,
        $lesson_id
    ));
    
    if ($existing) {
        // Update existing - accumulate time
        $total_time = (int) $existing->time_spent_seconds + (int) $time_spent;
        
        // Preserve existing completed_at if already completed
        if ($status === 'completed' && $existing->completed_at) {
            $completed_at = $existing->completed_at;
        }
        
        $wpdb->update(
            $progress_table,
            array(
                'status'             => $status,
                'score'              => $score,
                'last_viewed'        => $now,
                'completed_at'       => $completed_at,
                'time_spent_seconds' => $total_time,
            ),
            array('id' => $existing->id),
            array('%s', '%f', '%s', '%s', '%d'),
            array('%d')
        );
        
        $record_id = $existing->id;
    } else {
        // Insert new
        $wpdb->insert(
            $progress_table,
            array(
                'user_id'            => $user_id,
                'lesson_id'          => $lesson_id,
                'status'             => $status,
                'score'              => $score,
                'last_viewed'        => $now,
                'completed_at'       => $completed_at,
                'time_spent_seconds' => $time_spent,
            ),
            array('%d', '%d', '%s', '%f', '%s', '%s', '%d')
        );
        
        $record_id = $wpdb->insert_id;
    }
    
    return rest_ensure_response(array(
        'id'          => $record_id,
        'lessonId'    => $lesson_id,
        'status'      => $status,
        'score'       => (float) $score,
        'lastViewed'  => $now,
        'completedAt' => $completed_at,
    ));
}

// ============================================
// SECTION CALLBACKS
// ============================================

/**
 * GET /courses/{id}/sections - Get sections for a course
 */
function aquaticpro_lms_get_sections(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('course_id');
    
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    
    $sections = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $sections_table WHERE course_id = %d ORDER BY display_order ASC",
        $course_id
    ));
    
    $result = array();
    foreach ($sections as $section) {
        $result[] = array(
            'id'          => (int) $section->id,
            'courseId'    => (int) $section->course_id,
            'title'       => $section->title,
            'description' => $section->description,
            'order'       => (int) $section->display_order,
            'createdAt'   => $section->created_at,
            'updatedAt'   => $section->updated_at,
        );
    }
    
    return rest_ensure_response($result);
}

/**
 * POST /courses/{id}/sections - Create section
 */
function aquaticpro_lms_create_section(WP_REST_Request $request) {
    global $wpdb;
    $course_id = $request->get_param('course_id');
    $title = sanitize_text_field($request->get_param('title'));
    $description = wp_kses_post($request->get_param('description') ?: '');
    
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    
    // Get next display order
    $max_order = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(display_order) FROM $sections_table WHERE course_id = %d",
        $course_id
    ));
    
    $result = $wpdb->insert(
        $sections_table,
        array(
            'course_id'     => $course_id,
            'title'         => $title,
            'description'   => $description,
            'display_order' => $max_order + 1,
        ),
        array('%d', '%s', '%s', '%d')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create section', array('status' => 500));
    }
    
    return rest_ensure_response(array(
        'id'          => $wpdb->insert_id,
        'courseId'    => $course_id,
        'title'       => $title,
        'description' => $description,
        'order'       => $max_order + 1,
    ));
}

/**
 * PUT /sections/{id} - Update section
 */
function aquaticpro_lms_update_section(WP_REST_Request $request) {
    global $wpdb;
    $section_id = $request->get_param('id');
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    
    $update_data = array();
    $update_format = array();
    
    if ($request->has_param('title')) {
        $update_data['title'] = sanitize_text_field($request->get_param('title'));
        $update_format[] = '%s';
    }
    
    if ($request->has_param('description')) {
        $update_data['description'] = wp_kses_post($request->get_param('description'));
        $update_format[] = '%s';
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $wpdb->update(
        $sections_table,
        $update_data,
        array('id' => $section_id),
        $update_format,
        array('%d')
    );
    
    $section = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $sections_table WHERE id = %d",
        $section_id
    ));
    
    return rest_ensure_response(array(
        'id'          => (int) $section->id,
        'courseId'    => (int) $section->course_id,
        'title'       => $section->title,
        'description' => $section->description,
        'order'       => (int) $section->display_order,
    ));
}

/**
 * DELETE /sections/{id} - Delete section
 */
function aquaticpro_lms_delete_section(WP_REST_Request $request) {
    global $wpdb;
    $section_id = $request->get_param('id');
    
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    
    // Remove section_id from lessons (don't delete lessons)
    $wpdb->update(
        $lessons_table,
        array('section_id' => null),
        array('section_id' => $section_id),
        array('%d'),
        array('%d')
    );
    
    // Delete section
    $wpdb->delete($sections_table, array('id' => $section_id), array('%d'));
    
    return rest_ensure_response(array(
        'deleted' => true,
        'id'      => $section_id,
    ));
}

/**
 * PUT /sections/reorder - Reorder sections
 */
function aquaticpro_lms_reorder_sections(WP_REST_Request $request) {
    global $wpdb;
    $sections_table = $wpdb->prefix . 'aquaticpro_lesson_sections';
    
    $order = $request->get_param('order');
    
    if (!is_array($order)) {
        return new WP_Error('invalid_data', 'Order must be an array of section IDs', array('status' => 400));
    }
    
    foreach ($order as $index => $section_id) {
        $wpdb->update(
            $sections_table,
            array('display_order' => $index),
            array('id' => (int) $section_id),
            array('%d'),
            array('%d')
        );
    }
    
    return rest_ensure_response(array(
        'success' => true,
        'reordered' => count($order),
    ));
}

// ============================================
// MIGRATION CALLBACKS
// ============================================

/**
 * Export course to ZIP
 */
function aquaticpro_lms_export_course(WP_REST_Request $request) {
    if (!class_exists('AquaticPro_LMS_Migration')) {
        return new WP_Error('missing_class', 'Migration class not found', array('status' => 500));
    }

    $course_id = $request->get_param('id');
    $migration = new AquaticPro_LMS_Migration();
    $zip_file = $migration->export_course($course_id);

    if (is_wp_error($zip_file)) {
        return $zip_file;
    }

    // Return the download URL or stream the file
    // For REST API, it's better to return a temporary URL or stream it.
    // Standard approach: Move file to uploads/exports and return URL.
    
    $upload_dir = wp_upload_dir();
    $export_dir = $upload_dir['basedir'] . '/lms-exports';
    $export_url = $upload_dir['baseurl'] . '/lms-exports';
    
    if (!file_exists($export_dir)) {
        mkdir($export_dir, 0755, true);
    }
    
    $filename = basename($zip_file);
    $new_path = $export_dir . '/' . $filename;
    
    if (rename($zip_file, $new_path)) {
        // Schedule cleanup (optional)
        return rest_ensure_response(array(
            'url' => $export_url . '/' . $filename,
            'filename' => $filename
        ));
    }
    
    return new WP_Error('file_error', 'Could not move export file', array('status' => 500));
}

/**
 * Import course from ZIP
 */
function aquaticpro_lms_import_course(WP_REST_Request $request) {
    if (!class_exists('AquaticPro_LMS_Migration')) {
        return new WP_Error('missing_class', 'Migration class not found', array('status' => 500));
    }

    $files = $request->get_file_params();
    if (empty($files['file'])) {
        return new WP_Error('missing_file', 'No file uploaded', array('status' => 400));
    }

    $file = $files['file'];
    
    // Safety check on file extension
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    if (strtolower($ext) !== 'zip') {
            return new WP_Error('invalid_file', 'File must be a ZIP archive', array('status' => 400));
    }

    $migration = new AquaticPro_LMS_Migration();
    $course_id = $migration->import_course($file['tmp_name']);

    if (is_wp_error($course_id)) {
        return $course_id;
    }

    return rest_ensure_response(array(
        'success' => true,
        'course_id' => $course_id,
        'message' => 'Course imported successfully'
    ));
}

/**
 * Import course from LearnDash
 */
function aquaticpro_lms_import_learndash(WP_REST_Request $request) {
    if (!class_exists('AquaticPro_LMS_Migration')) {
        return new WP_Error('missing_class', 'Migration class not found', array('status' => 500));
    }

    $learndash_course_id = $request->get_param('learndash_course_id');

    $migration = new AquaticPro_LMS_Migration();
    $course_id = $migration->import_learndash_course($learndash_course_id);

    if (is_wp_error($course_id)) {
        return $course_id;
    }

    return rest_ensure_response(array(
        'success' => true,
        'course_id' => $course_id,
        'message' => 'LearnDash course imported successfully'
    ));
}

// ============================================
// COURSE CATEGORY HANDLERS
// ============================================

/**
 * GET /course-categories — list all categories ordered by display_order
 */
function aquaticpro_lms_get_categories() {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_course_categories';
    $rows = $wpdb->get_results(
        "SELECT id, name, display_order FROM {$table} ORDER BY display_order ASC, name ASC",
        ARRAY_A
    );
    $result = array_map(function($row) {
        return array(
            'id'           => (int) $row['id'],
            'name'         => $row['name'],
            'displayOrder' => (int) $row['display_order'],
        );
    }, $rows ?: array());
    return rest_ensure_response($result);
}

/**
 * POST /course-categories — create a new category
 */
function aquaticpro_lms_create_category(WP_REST_Request $request) {
    global $wpdb;
    $name = sanitize_text_field(trim($request->get_param('name') ?? ''));
    if (empty($name)) {
        return new WP_Error('missing_name', 'Category name is required', array('status' => 400));
    }
    $table = $wpdb->prefix . 'aquaticpro_course_categories';
    // Next display_order
    $max_order = (int) $wpdb->get_var("SELECT MAX(display_order) FROM {$table}");
    $inserted = $wpdb->insert($table, array(
        'name'          => $name,
        'display_order' => $max_order + 1,
    ), array('%s', '%d'));
    if (!$inserted) {
        return new WP_Error('db_error', 'Could not create category (name may already exist)', array('status' => 500));
    }
    return rest_ensure_response(array(
        'id'           => (int) $wpdb->insert_id,
        'name'         => $name,
        'displayOrder' => $max_order + 1,
    ));
}

/**
 * PUT /course-categories/{id} — rename a category (also updates courses with old name)
 */
function aquaticpro_lms_update_category(WP_REST_Request $request) {
    global $wpdb;
    $id   = absint($request->get_param('id'));
    $name = sanitize_text_field(trim($request->get_param('name') ?? ''));
    if (empty($name)) {
        return new WP_Error('missing_name', 'Category name is required', array('status' => 400));
    }
    $table = $wpdb->prefix . 'aquaticpro_course_categories';
    $old = $wpdb->get_row($wpdb->prepare("SELECT name FROM {$table} WHERE id = %d", $id), ARRAY_A);
    if (!$old) {
        return new WP_Error('not_found', 'Category not found', array('status' => 404));
    }
    // Update the categories table
    $wpdb->update($table, array('name' => $name), array('id' => $id), array('%s'), array('%d'));
    // Propagate rename to all courses that used the old name
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $wpdb->update($courses_table, array('category' => $name), array('category' => $old['name']), array('%s'), array('%s'));
    return rest_ensure_response(array('success' => true, 'id' => $id, 'name' => $name));
}

/**
 * DELETE /course-categories/{id} — remove category and set courses to uncategorized
 */
function aquaticpro_lms_delete_category(WP_REST_Request $request) {
    global $wpdb;
    $id    = absint($request->get_param('id'));
    $table = $wpdb->prefix . 'aquaticpro_course_categories';
    $row   = $wpdb->get_row($wpdb->prepare("SELECT name FROM {$table} WHERE id = %d", $id), ARRAY_A);
    if (!$row) {
        return new WP_Error('not_found', 'Category not found', array('status' => 404));
    }
    // Null out courses that belong to this category
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $wpdb->update($courses_table, array('category' => null), array('category' => $row['name']), array('%s'), array('%s'));
    // Delete the category
    $wpdb->delete($table, array('id' => $id), array('%d'));
    return rest_ensure_response(array('success' => true));
}

/**
 * PUT /course-categories/reorder — save new display_order for all categories
 * Body: { orders: [{ id: 1, displayOrder: 0 }, ...] }
 */
function aquaticpro_lms_reorder_categories(WP_REST_Request $request) {
    global $wpdb;
    $orders = $request->get_param('orders');
    if (!is_array($orders)) {
        return new WP_Error('invalid_data', 'orders array required', array('status' => 400));
    }
    $table = $wpdb->prefix . 'aquaticpro_course_categories';
    foreach ($orders as $item) {
        $id    = absint($item['id'] ?? 0);
        $order = (int) ($item['displayOrder'] ?? 0);
        if ($id > 0) {
            $wpdb->update($table, array('display_order' => $order), array('id' => $id), array('%d'), array('%d'));
        }
    }
    return rest_ensure_response(array('success' => true));
}
