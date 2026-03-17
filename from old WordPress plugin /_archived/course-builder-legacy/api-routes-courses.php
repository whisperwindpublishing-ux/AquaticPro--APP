<?php
/**
 * Course Builder API Routes
 * 
 * Provides REST API endpoints for the hierarchical course management system.
 * Hierarchy: Courses → Sections → Lessons (with Canvas/Cards)
 */

if (!defined('ABSPATH')) {
    exit;
}

// Initialize database tables
add_action('init', 'mp_course_builder_init_tables');

function mp_course_builder_init_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    // Courses table
    $table_courses = $wpdb->prefix . 'mp_cb_courses';
    $sql_courses = "CREATE TABLE IF NOT EXISTS $table_courses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        display_order INT DEFAULT 0,
        status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
        created_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_status (status),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_courses);
    
    // Sections table
    $table_sections = $wpdb->prefix . 'mp_cb_sections';
    $sql_sections = "CREATE TABLE IF NOT EXISTS $table_sections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        course_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        theme_color VARCHAR(20) DEFAULT NULL,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_course_id (course_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_sections);
    
    // Lessons table (now includes canvas fields)
    $table_lessons = $wpdb->prefix . 'mp_cb_lessons';
    $sql_lessons = "CREATE TABLE IF NOT EXISTS $table_lessons (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        section_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        header_image_url TEXT,
        display_order INT DEFAULT 0,
        grid_cols INT DEFAULT 12,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_section_id (section_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_lessons);
    
    // Run migrations for new columns on existing tables
    mp_course_builder_migrate_tables();
    
    // Cards table (attached to lessons)
    $table_cards = $wpdb->prefix . 'mp_cb_cards';
    $sql_cards = "CREATE TABLE IF NOT EXISTS $table_cards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        lesson_id BIGINT UNSIGNED NOT NULL,
        card_type ENUM('image', 'video', 'gif', 'text', 'spacer', 'embed') NOT NULL DEFAULT 'text',
        grid_x INT DEFAULT 0,
        grid_y INT DEFAULT 0,
        grid_w INT DEFAULT 4,
        grid_h INT DEFAULT 2,
        content LONGTEXT,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lesson_id (lesson_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_cards);
    
    // Permissions table
    $table_permissions = $wpdb->prefix . 'mp_cb_permissions';
    $sql_permissions = "CREATE TABLE IF NOT EXISTS $table_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        job_role_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_manage TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY idx_job_role (job_role_id)
    ) $charset_collate;";
    dbDelta($sql_permissions);
    
    // Course assignments table (which roles can access which courses)
    $table_assignments = $wpdb->prefix . 'mp_cb_course_assignments';
    $sql_assignments = "CREATE TABLE IF NOT EXISTS $table_assignments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        course_id BIGINT UNSIGNED NOT NULL,
        job_role_id BIGINT UNSIGNED NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY idx_course_role (course_id, job_role_id),
        KEY idx_course_id (course_id),
        KEY idx_job_role_id (job_role_id)
    ) $charset_collate;";
    dbDelta($sql_assignments);
}

// Register REST routes
/**
 * Migrate tables to add new columns
 * This handles upgrades when new columns are added to existing tables
 */
function mp_course_builder_migrate_tables() {
    global $wpdb;
    
    // Check and add missing columns to sections table
    $table_sections = $wpdb->prefix . 'mp_cb_sections';
    $section_columns = $wpdb->get_col("DESCRIBE $table_sections", 0);
    
    if (!in_array('theme_color', $section_columns)) {
        $wpdb->query("ALTER TABLE $table_sections ADD COLUMN theme_color VARCHAR(20) DEFAULT NULL AFTER image_url");
    }
    
    // Check and add missing columns to lessons table
    $table_lessons = $wpdb->prefix . 'mp_cb_lessons';
    $lesson_columns = $wpdb->get_col("DESCRIBE $table_lessons", 0);
    
    if (!in_array('header_image_url', $lesson_columns)) {
        $wpdb->query("ALTER TABLE $table_lessons ADD COLUMN header_image_url TEXT AFTER image_url");
    }
    
    if (!in_array('grid_cols', $lesson_columns)) {
        $wpdb->query("ALTER TABLE $table_lessons ADD COLUMN grid_cols INT DEFAULT 12 AFTER display_order");
    }
    
    // Check and add missing columns to cards table (lesson_id instead of topic_id)
    $table_cards = $wpdb->prefix . 'mp_cb_cards';
    $card_columns = $wpdb->get_col("DESCRIBE $table_cards", 0);
    
    if (!in_array('lesson_id', $card_columns)) {
        // If lesson_id doesn't exist but topic_id does, rename it
        if (in_array('topic_id', $card_columns)) {
            $wpdb->query("ALTER TABLE $table_cards CHANGE COLUMN topic_id lesson_id BIGINT UNSIGNED NOT NULL");
        } else {
            $wpdb->query("ALTER TABLE $table_cards ADD COLUMN lesson_id BIGINT UNSIGNED NOT NULL AFTER id");
        }
    }
}

add_action('rest_api_init', 'mp_course_builder_register_routes');

function mp_course_builder_register_routes() {
    $namespace = 'mentorship-platform/v1';
    
    // ============ ACCESS CHECK ============
    register_rest_route($namespace, '/courses/access', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_check_access',
        'permission_callback' => '__return_true'
    ));
    
    // ============ COURSES ============
    register_rest_route($namespace, '/courses', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_courses',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/courses', array(
        'methods' => 'POST',
        'callback' => 'mp_cb_create_course',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_course',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_course',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/courses/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_cb_delete_course',
        'permission_callback' => 'mp_cb_can_manage'
    ));
    
    register_rest_route($namespace, '/courses/reorder', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_reorder_courses',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    // ============ SECTIONS ============
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/sections', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_sections',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/sections', array(
        'methods' => 'POST',
        'callback' => 'mp_cb_create_section',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/sections/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_section',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/sections/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_section',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/sections/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_cb_delete_section',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/sections/reorder', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_reorder_sections',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    // ============ LESSONS ============
    register_rest_route($namespace, '/sections/(?P<section_id>\d+)/lessons', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_lessons',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/lessons', array(
        'methods' => 'POST',
        'callback' => 'mp_cb_create_lesson',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_lesson',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_lesson',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/lessons/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_cb_delete_lesson',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/lessons/reorder', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_reorder_lessons',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    // ============ CARDS (attached to Lessons) ============
    register_rest_route($namespace, '/lessons/(?P<lesson_id>\d+)/cards', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_cards',
        'permission_callback' => 'mp_cb_can_view'
    ));
    
    register_rest_route($namespace, '/cards', array(
        'methods' => 'POST',
        'callback' => 'mp_cb_create_card',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/cards/(?P<id>\d+)', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_card',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/cards/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'mp_cb_delete_card',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    register_rest_route($namespace, '/cards/layout', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_cards_layout',
        'permission_callback' => 'mp_cb_can_edit'
    ));
    
    // ============ PERMISSIONS ============
    register_rest_route($namespace, '/courses/permissions', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_permissions',
        'permission_callback' => 'mp_cb_can_manage'
    ));
    
    register_rest_route($namespace, '/courses/permissions', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_permissions',
        'permission_callback' => 'mp_cb_can_manage'
    ));
    
    // ============ COURSE ASSIGNMENTS ============
    register_rest_route($namespace, '/courses/(?P<id>\d+)/assignments', array(
        'methods' => 'GET',
        'callback' => 'mp_cb_get_course_assignments',
        'permission_callback' => 'mp_cb_can_manage'
    ));
    
    register_rest_route($namespace, '/courses/(?P<id>\d+)/assignments', array(
        'methods' => 'PUT',
        'callback' => 'mp_cb_update_course_assignments',
        'permission_callback' => 'mp_cb_can_manage'
    ));
}

// ============ PERMISSION HELPERS ============

/**
 * Get user permissions for course builder
 */
function mp_cb_get_user_permissions($user_id = null) {
    global $wpdb;
    
    if (!$user_id) {
        $user_id = get_current_user_id();
    }
    
    if (!$user_id) {
        return array('can_view' => false, 'can_edit' => false, 'can_manage' => false);
    }
    
    // Tier 6+ and WP admins always have full access
    $user_tier = (int) get_user_meta($user_id, 'mentorship_tier', true);
    if ($user_tier >= 6 || current_user_can('manage_options')) {
        return array('can_view' => true, 'can_edit' => true, 'can_manage' => true);
    }
    
    // Get user's job roles
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $permissions_table = $wpdb->prefix . 'mp_cb_permissions';
    
    // Check if tables exist
    if ($wpdb->get_var("SHOW TABLES LIKE '$permissions_table'") !== $permissions_table) {
        return array('can_view' => false, 'can_edit' => false, 'can_manage' => false);
    }
    
    $user_role_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
        $user_id
    ));
    
    if (empty($user_role_ids)) {
        return array('can_view' => false, 'can_edit' => false, 'can_manage' => false);
    }
    
    // Get permissions for user's roles (aggregate with MAX)
    $placeholders = implode(',', array_fill(0, count($user_role_ids), '%d'));
    $perms = $wpdb->get_row($wpdb->prepare(
        "SELECT 
            MAX(can_view) as can_view,
            MAX(can_edit) as can_edit,
            MAX(can_manage) as can_manage
         FROM $permissions_table
         WHERE job_role_id IN ($placeholders)",
        ...$user_role_ids
    ), ARRAY_A);
    
    return array(
        'can_view' => (bool) ($perms['can_view'] ?? false),
        'can_edit' => (bool) ($perms['can_edit'] ?? false),
        'can_manage' => (bool) ($perms['can_manage'] ?? false)
    );
}

function mp_cb_can_view() {
    $perms = mp_cb_get_user_permissions();
    return $perms['can_view'] || $perms['can_edit'] || $perms['can_manage'];
}

function mp_cb_can_edit() {
    $perms = mp_cb_get_user_permissions();
    return $perms['can_edit'] || $perms['can_manage'];
}

function mp_cb_can_manage() {
    $perms = mp_cb_get_user_permissions();
    return $perms['can_manage'];
}

/**
 * Check user access level
 */
function mp_cb_check_access(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return rest_ensure_response(array(
            'has_access' => false,
            'can_view' => false,
            'can_edit' => false,
            'can_manage' => false
        ));
    }
    
    $perms = mp_cb_get_user_permissions($user_id);
    return rest_ensure_response(array(
        'has_access' => $perms['can_view'] || $perms['can_edit'] || $perms['can_manage'],
        'can_view' => $perms['can_view'] || $perms['can_edit'] || $perms['can_manage'],
        'can_edit' => $perms['can_edit'] || $perms['can_manage'],
        'can_manage' => $perms['can_manage']
    ));
}

// ============ COURSES CRUD ============

function mp_cb_get_courses(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_courses';
    $assignments_table = $wpdb->prefix . 'mp_cb_course_assignments';
    $user_assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    
    $user_id = get_current_user_id();
    $perms = mp_cb_get_user_permissions($user_id);
    
    // Managers see all courses
    if ($perms['can_manage']) {
        $courses = $wpdb->get_results(
            "SELECT * FROM $table ORDER BY display_order ASC, title ASC"
        );
    } else {
        // Others see only assigned courses (via their job roles)
        $user_role_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT job_role_id FROM $user_assignments_table WHERE user_id = %d",
            $user_id
        ));
        
        if (empty($user_role_ids)) {
            return rest_ensure_response(array());
        }
        
        $placeholders = implode(',', array_fill(0, count($user_role_ids), '%d'));
        $courses = $wpdb->get_results($wpdb->prepare(
            "SELECT DISTINCT c.* FROM $table c
             INNER JOIN $assignments_table a ON c.id = a.course_id
             WHERE a.job_role_id IN ($placeholders)
               AND c.status = 'published'
             ORDER BY c.display_order ASC, c.title ASC",
            ...$user_role_ids
        ));
    }
    
    // Add section count for each course
    $sections_table = $wpdb->prefix . 'mp_cb_sections';
    foreach ($courses as &$course) {
        $course->section_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $sections_table WHERE course_id = %d",
            $course->id
        ));
    }
    
    return rest_ensure_response($courses);
}

function mp_cb_get_course(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_courses';
    $id = (int) $request['id'];
    
    $course = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE id = %d",
        $id
    ));
    
    if (!$course) {
        return new WP_Error('not_found', 'Course not found', array('status' => 404));
    }
    
    // Get sections
    $sections_table = $wpdb->prefix . 'mp_cb_sections';
    $course->sections = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $sections_table WHERE course_id = %d ORDER BY display_order ASC",
        $id
    ));
    
    return rest_ensure_response($course);
}

function mp_cb_create_course(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_courses';
    
    $data = $request->get_json_params();
    
    $result = $wpdb->insert($table, array(
        'title' => sanitize_text_field($data['title'] ?? 'Untitled Course'),
        'description' => wp_kses_post($data['description'] ?? ''),
        'image_url' => esc_url_raw($data['image_url'] ?? ''),
        'display_order' => (int) ($data['display_order'] ?? 0),
        'status' => in_array($data['status'] ?? '', ['draft', 'published', 'archived']) ? $data['status'] : 'draft',
        'created_by' => get_current_user_id()
    ));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create course', array('status' => 500));
    }
    
    $course_id = $wpdb->insert_id;
    $course = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $course_id));
    
    return rest_ensure_response($course);
}

function mp_cb_update_course(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_courses';
    $id = (int) $request['id'];
    
    $data = $request->get_json_params();
    $update_data = array();
    
    if (isset($data['title'])) {
        $update_data['title'] = sanitize_text_field($data['title']);
    }
    if (isset($data['description'])) {
        $update_data['description'] = wp_kses_post($data['description']);
    }
    if (isset($data['image_url'])) {
        $update_data['image_url'] = esc_url_raw($data['image_url']);
    }
    if (isset($data['display_order'])) {
        $update_data['display_order'] = (int) $data['display_order'];
    }
    if (isset($data['status']) && in_array($data['status'], ['draft', 'published', 'archived'])) {
        $update_data['status'] = $data['status'];
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $result = $wpdb->update($table, $update_data, array('id' => $id));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to update course', array('status' => 500));
    }
    
    $course = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    return rest_ensure_response($course);
}

function mp_cb_delete_course(WP_REST_Request $request) {
    global $wpdb;
    $id = (int) $request['id'];
    
    // Delete in order: cards -> topics -> lessons -> sections -> course
    $sections = $wpdb->get_col($wpdb->prepare(
        "SELECT id FROM {$wpdb->prefix}mp_cb_sections WHERE course_id = %d",
        $id
    ));
    
    foreach ($sections as $section_id) {
        $lessons = $wpdb->get_col($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}mp_cb_lessons WHERE section_id = %d",
            $section_id
        ));
        
        foreach ($lessons as $lesson_id) {
            $topics = $wpdb->get_col($wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}mp_cb_topics WHERE lesson_id = %d",
                $lesson_id
            ));
            
            foreach ($topics as $topic_id) {
                $wpdb->delete($wpdb->prefix . 'mp_cb_cards', array('topic_id' => $topic_id));
            }
            
            $wpdb->delete($wpdb->prefix . 'mp_cb_topics', array('lesson_id' => $lesson_id));
        }
        
        $wpdb->delete($wpdb->prefix . 'mp_cb_lessons', array('section_id' => $section_id));
    }
    
    $wpdb->delete($wpdb->prefix . 'mp_cb_sections', array('course_id' => $id));
    $wpdb->delete($wpdb->prefix . 'mp_cb_course_assignments', array('course_id' => $id));
    $wpdb->delete($wpdb->prefix . 'mp_cb_courses', array('id' => $id));
    
    return rest_ensure_response(array('deleted' => true));
}

function mp_cb_reorder_courses(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_courses';
    $data = $request->get_json_params();
    
    if (empty($data['order']) || !is_array($data['order'])) {
        return new WP_Error('invalid_data', 'Order array required', array('status' => 400));
    }
    
    foreach ($data['order'] as $index => $id) {
        $wpdb->update($table, array('display_order' => $index), array('id' => (int) $id));
    }
    
    return rest_ensure_response(array('reordered' => true));
}

// ============ SECTIONS CRUD ============

function mp_cb_get_sections(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_sections';
    $course_id = (int) $request['course_id'];
    
    $sections = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table WHERE course_id = %d ORDER BY display_order ASC",
        $course_id
    ));
    
    // Add lesson count for each section
    $lessons_table = $wpdb->prefix . 'mp_cb_lessons';
    foreach ($sections as &$section) {
        $section->lesson_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $lessons_table WHERE section_id = %d",
            $section->id
        ));
    }
    
    return rest_ensure_response($sections);
}

function mp_cb_get_section(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_sections';
    $id = (int) $request['id'];
    
    $section = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE id = %d",
        $id
    ));
    
    if (!$section) {
        return new WP_Error('not_found', 'Section not found', array('status' => 404));
    }
    
    // Get lessons
    $lessons_table = $wpdb->prefix . 'mp_cb_lessons';
    $section->lessons = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $lessons_table WHERE section_id = %d ORDER BY display_order ASC",
        $id
    ));
    
    return rest_ensure_response($section);
}

function mp_cb_create_section(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_sections';
    
    $data = $request->get_json_params();
    
    if (empty($data['course_id'])) {
        return new WP_Error('missing_course', 'Course ID required', array('status' => 400));
    }
    
    $valid_colors = array('blue', 'purple', 'green', 'orange', 'red', 'teal', 'pink', 'indigo');
    $theme_color = isset($data['theme_color']) && in_array($data['theme_color'], $valid_colors) ? $data['theme_color'] : null;
    
    $result = $wpdb->insert($table, array(
        'course_id' => (int) $data['course_id'],
        'title' => sanitize_text_field($data['title'] ?? 'Untitled Section'),
        'description' => wp_kses_post($data['description'] ?? ''),
        'image_url' => esc_url_raw($data['image_url'] ?? ''),
        'theme_color' => $theme_color,
        'display_order' => (int) ($data['display_order'] ?? 0)
    ));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create section', array('status' => 500));
    }
    
    $section = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $wpdb->insert_id));
    return rest_ensure_response($section);
}

function mp_cb_update_section(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_sections';
    $id = (int) $request['id'];
    
    $data = $request->get_json_params();
    $update_data = array();
    
    if (isset($data['title'])) {
        $update_data['title'] = sanitize_text_field($data['title']);
    }
    if (isset($data['description'])) {
        $update_data['description'] = wp_kses_post($data['description']);
    }
    if (isset($data['image_url'])) {
        $update_data['image_url'] = esc_url_raw($data['image_url']);
    }
    if (array_key_exists('theme_color', $data)) {
        $valid_colors = array('blue', 'purple', 'green', 'orange', 'red', 'teal', 'pink', 'indigo');
        $update_data['theme_color'] = ($data['theme_color'] !== null && in_array($data['theme_color'], $valid_colors)) 
            ? $data['theme_color'] 
            : null;
    }
    if (isset($data['display_order'])) {
        $update_data['display_order'] = (int) $data['display_order'];
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $wpdb->update($table, $update_data, array('id' => $id));
    
    $section = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    return rest_ensure_response($section);
}

function mp_cb_delete_section(WP_REST_Request $request) {
    global $wpdb;
    $id = (int) $request['id'];
    
    // Get all lessons in this section
    $lessons = $wpdb->get_col($wpdb->prepare(
        "SELECT id FROM {$wpdb->prefix}mp_cb_lessons WHERE section_id = %d",
        $id
    ));
    
    // Delete cards for each lesson
    foreach ($lessons as $lesson_id) {
        $wpdb->delete($wpdb->prefix . 'mp_cb_cards', array('lesson_id' => $lesson_id));
    }
    
    // Delete lessons
    $wpdb->delete($wpdb->prefix . 'mp_cb_lessons', array('section_id' => $id));
    
    // Delete the section
    $wpdb->delete($wpdb->prefix . 'mp_cb_sections', array('id' => $id));
    
    return rest_ensure_response(array('deleted' => true));
}

function mp_cb_reorder_sections(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_sections';
    $data = $request->get_json_params();
    
    if (empty($data['order']) || !is_array($data['order'])) {
        return new WP_Error('invalid_data', 'Order array required', array('status' => 400));
    }
    
    foreach ($data['order'] as $index => $id) {
        $wpdb->update($table, array('display_order' => $index), array('id' => (int) $id));
    }
    
    return rest_ensure_response(array('reordered' => true));
}

// ============ LESSONS CRUD ============

function mp_cb_get_lessons(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_lessons';
    $section_id = (int) $request['section_id'];
    
    $lessons = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table WHERE section_id = %d ORDER BY display_order ASC",
        $section_id
    ));
    
    // Add card count for each lesson
    $cards_table = $wpdb->prefix . 'mp_cb_cards';
    foreach ($lessons as &$lesson) {
        $lesson->card_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $cards_table WHERE lesson_id = %d",
            $lesson->id
        ));
    }
    
    return rest_ensure_response($lessons);
}

function mp_cb_get_lesson(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_lessons';
    $id = (int) $request['id'];
    
    $lesson = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE id = %d",
        $id
    ));
    
    if (!$lesson) {
        return new WP_Error('not_found', 'Lesson not found', array('status' => 404));
    }
    
    // Get cards for this lesson
    $cards_table = $wpdb->prefix . 'mp_cb_cards';
    $cards = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $cards_table WHERE lesson_id = %d ORDER BY grid_y ASC, grid_x ASC",
        $id
    ));
    
    foreach ($cards as &$card) {
        $card->content = json_decode($card->content, true) ?: array();
    }
    $lesson->cards = $cards;
    
    return rest_ensure_response($lesson);
}

function mp_cb_create_lesson(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_lessons';
    
    $data = $request->get_json_params();
    
    if (empty($data['section_id'])) {
        return new WP_Error('missing_section', 'Section ID required', array('status' => 400));
    }
    
    $result = $wpdb->insert($table, array(
        'section_id' => (int) $data['section_id'],
        'title' => sanitize_text_field($data['title'] ?? 'Untitled Lesson'),
        'description' => wp_kses_post($data['description'] ?? ''),
        'image_url' => esc_url_raw($data['image_url'] ?? ''),
        'header_image_url' => esc_url_raw($data['header_image_url'] ?? ''),
        'display_order' => (int) ($data['display_order'] ?? 0),
        'grid_cols' => (int) ($data['grid_cols'] ?? 12)
    ));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create lesson', array('status' => 500));
    }
    
    $lesson = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $wpdb->insert_id));
    return rest_ensure_response($lesson);
}

function mp_cb_update_lesson(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_lessons';
    $id = (int) $request['id'];
    
    $data = $request->get_json_params();
    $update_data = array();
    
    if (isset($data['title'])) {
        $update_data['title'] = sanitize_text_field($data['title']);
    }
    if (isset($data['description'])) {
        $update_data['description'] = wp_kses_post($data['description']);
    }
    if (isset($data['image_url'])) {
        $update_data['image_url'] = esc_url_raw($data['image_url']);
    }
    if (isset($data['header_image_url'])) {
        $update_data['header_image_url'] = esc_url_raw($data['header_image_url']);
    }
    if (isset($data['display_order'])) {
        $update_data['display_order'] = (int) $data['display_order'];
    }
    if (isset($data['grid_cols'])) {
        $update_data['grid_cols'] = (int) $data['grid_cols'];
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $wpdb->update($table, $update_data, array('id' => $id));
    
    $lesson = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    return rest_ensure_response($lesson);
}

function mp_cb_delete_lesson(WP_REST_Request $request) {
    global $wpdb;
    $id = (int) $request['id'];
    
    // Delete cards within this lesson
    $wpdb->delete($wpdb->prefix . 'mp_cb_cards', array('lesson_id' => $id));
    
    // Delete the lesson
    $wpdb->delete($wpdb->prefix . 'mp_cb_lessons', array('id' => $id));
    
    return rest_ensure_response(array('deleted' => true));
}

function mp_cb_reorder_lessons(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_lessons';
    $data = $request->get_json_params();
    
    if (empty($data['order']) || !is_array($data['order'])) {
        return new WP_Error('invalid_data', 'Order array required', array('status' => 400));
    }
    
    foreach ($data['order'] as $index => $id) {
        $wpdb->update($table, array('display_order' => $index), array('id' => (int) $id));
    }
    
    return rest_ensure_response(array('reordered' => true));
}

// ============ CARDS CRUD ============

function mp_cb_get_cards(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_cards';
    $lesson_id = (int) $request['lesson_id'];
    
    $cards = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table WHERE lesson_id = %d ORDER BY grid_y ASC, grid_x ASC",
        $lesson_id
    ));
    
    // Decode content JSON
    foreach ($cards as &$card) {
        $card->content = json_decode($card->content, true) ?: array();
    }
    
    return rest_ensure_response($cards);
}

function mp_cb_create_card(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_cards';
    
    $data = $request->get_json_params();
    
    if (empty($data['lesson_id'])) {
        return new WP_Error('missing_lesson', 'Lesson ID required', array('status' => 400));
    }
    
    $valid_types = array('image', 'video', 'gif', 'text', 'spacer', 'embed');
    $card_type = in_array($data['card_type'] ?? '', $valid_types) ? $data['card_type'] : 'text';
    
    $result = $wpdb->insert($table, array(
        'lesson_id' => (int) $data['lesson_id'],
        'card_type' => $card_type,
        'grid_x' => (int) ($data['grid_x'] ?? 0),
        'grid_y' => (int) ($data['grid_y'] ?? 0),
        'grid_w' => (int) ($data['grid_w'] ?? 4),
        'grid_h' => (int) ($data['grid_h'] ?? 2),
        'content' => wp_json_encode($data['content'] ?? array()),
        'display_order' => (int) ($data['display_order'] ?? 0)
    ));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to create card', array('status' => 500));
    }
    
    $card = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $wpdb->insert_id));
    $card->content = json_decode($card->content, true) ?: array();
    
    return rest_ensure_response($card);
}

function mp_cb_update_card(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_cards';
    $id = (int) $request['id'];
    
    $data = $request->get_json_params();
    $update_data = array();
    
    $valid_types = array('image', 'video', 'gif', 'text', 'spacer', 'embed');
    
    if (isset($data['card_type']) && in_array($data['card_type'], $valid_types)) {
        $update_data['card_type'] = $data['card_type'];
    }
    if (isset($data['grid_x'])) {
        $update_data['grid_x'] = (int) $data['grid_x'];
    }
    if (isset($data['grid_y'])) {
        $update_data['grid_y'] = (int) $data['grid_y'];
    }
    if (isset($data['grid_w'])) {
        $update_data['grid_w'] = (int) $data['grid_w'];
    }
    if (isset($data['grid_h'])) {
        $update_data['grid_h'] = (int) $data['grid_h'];
    }
    if (isset($data['content'])) {
        $update_data['content'] = wp_json_encode($data['content']);
    }
    if (isset($data['display_order'])) {
        $update_data['display_order'] = (int) $data['display_order'];
    }
    
    if (empty($update_data)) {
        return new WP_Error('no_data', 'No data to update', array('status' => 400));
    }
    
    $wpdb->update($table, $update_data, array('id' => $id));
    
    $card = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    $card->content = json_decode($card->content, true) ?: array();
    
    return rest_ensure_response($card);
}

function mp_cb_delete_card(WP_REST_Request $request) {
    global $wpdb;
    $id = (int) $request['id'];
    
    $wpdb->delete($wpdb->prefix . 'mp_cb_cards', array('id' => $id));
    
    return rest_ensure_response(array('deleted' => true));
}

/**
 * Batch update card positions (for drag-and-drop layout saves)
 */
function mp_cb_update_cards_layout(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_cards';
    
    $data = $request->get_json_params();
    
    if (empty($data['cards']) || !is_array($data['cards'])) {
        return new WP_Error('invalid_data', 'Cards array required', array('status' => 400));
    }
    
    $updated = 0;
    foreach ($data['cards'] as $card_data) {
        if (empty($card_data['id'])) continue;
        
        $update = array();
        if (isset($card_data['grid_x'])) $update['grid_x'] = (int) $card_data['grid_x'];
        if (isset($card_data['grid_y'])) $update['grid_y'] = (int) $card_data['grid_y'];
        if (isset($card_data['grid_w'])) $update['grid_w'] = (int) $card_data['grid_w'];
        if (isset($card_data['grid_h'])) $update['grid_h'] = (int) $card_data['grid_h'];
        
        if (!empty($update)) {
            $wpdb->update($table, $update, array('id' => (int) $card_data['id']));
            $updated++;
        }
    }
    
    return rest_ensure_response(array('updated' => $updated));
}

// ============ PERMISSIONS ============

function mp_cb_get_permissions(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_permissions';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Get all job roles with their permissions
    $results = $wpdb->get_results(
        "SELECT r.id as job_role_id, r.name as job_role_name, r.tier_id,
                COALESCE(p.can_view, 0) as can_view,
                COALESCE(p.can_edit, 0) as can_edit,
                COALESCE(p.can_manage, 0) as can_manage
         FROM $roles_table r
         LEFT JOIN $table p ON r.id = p.job_role_id
         ORDER BY r.tier_id ASC, r.name ASC"
    );
    
    return rest_ensure_response($results);
}

function mp_cb_update_permissions(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_permissions';
    
    $data = $request->get_json_params();
    
    if (empty($data['permissions']) || !is_array($data['permissions'])) {
        return new WP_Error('invalid_data', 'Permissions array required', array('status' => 400));
    }
    
    foreach ($data['permissions'] as $perm) {
        if (empty($perm['job_role_id'])) continue;
        
        $job_role_id = (int) $perm['job_role_id'];
        $can_view = (int) ($perm['can_view'] ?? 0);
        $can_edit = (int) ($perm['can_edit'] ?? 0);
        $can_manage = (int) ($perm['can_manage'] ?? 0);
        
        // Upsert
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE job_role_id = %d",
            $job_role_id
        ));
        
        if ($exists) {
            $wpdb->update($table, array(
                'can_view' => $can_view,
                'can_edit' => $can_edit,
                'can_manage' => $can_manage
            ), array('job_role_id' => $job_role_id));
        } else {
            $wpdb->insert($table, array(
                'job_role_id' => $job_role_id,
                'can_view' => $can_view,
                'can_edit' => $can_edit,
                'can_manage' => $can_manage
            ));
        }
    }
    
    return rest_ensure_response(array('updated' => true));
}

// ============ COURSE ASSIGNMENTS ============

function mp_cb_get_course_assignments(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_course_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $course_id = (int) $request['id'];
    
    // Get all roles with assignment status for this course
    $results = $wpdb->get_results($wpdb->prepare(
        "SELECT r.id as job_role_id, r.name as job_role_name, r.tier_id,
                CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
                a.assigned_at, a.assigned_by
         FROM $roles_table r
         LEFT JOIN $table a ON r.id = a.job_role_id AND a.course_id = %d
         ORDER BY r.tier_id ASC, r.name ASC",
        $course_id
    ));
    
    return rest_ensure_response($results);
}

function mp_cb_update_course_assignments(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_cb_course_assignments';
    $course_id = (int) $request['id'];
    
    $data = $request->get_json_params();
    
    if (!isset($data['role_ids']) || !is_array($data['role_ids'])) {
        return new WP_Error('invalid_data', 'role_ids array required', array('status' => 400));
    }
    
    // Remove all existing assignments for this course
    $wpdb->delete($table, array('course_id' => $course_id));
    
    // Add new assignments
    $user_id = get_current_user_id();
    foreach ($data['role_ids'] as $role_id) {
        $wpdb->insert($table, array(
            'course_id' => $course_id,
            'job_role_id' => (int) $role_id,
            'assigned_by' => $user_id
        ));
    }
    
    return rest_ensure_response(array('updated' => true, 'count' => count($data['role_ids'])));
}
