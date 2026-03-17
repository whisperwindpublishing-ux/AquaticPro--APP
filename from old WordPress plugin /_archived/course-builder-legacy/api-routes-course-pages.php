<?php
/**
 * Course Pages API Routes
 * 
 * New Notion-like page structure for courses.
 * Replaces the rigid Course > Section > Lesson hierarchy with
 * a flexible flat/nested page system.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Create the course pages tables
 */
function mp_course_pages_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

    // Course pages table
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    $sql_pages = "CREATE TABLE IF NOT EXISTS $table_pages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        course_id BIGINT UNSIGNED NOT NULL,
        parent_id BIGINT UNSIGNED DEFAULT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
        icon VARCHAR(50) DEFAULT NULL,
        cover_image_url TEXT DEFAULT NULL,
        page_type ENUM('content', 'whiteboard', 'mixed') DEFAULT 'content',
        display_order INT DEFAULT 0,
        is_published BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_course_id (course_id),
        KEY idx_parent_id (parent_id),
        KEY idx_display_order (display_order),
        FOREIGN KEY (course_id) REFERENCES {$wpdb->prefix}mp_cb_courses(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES $table_pages(id) ON DELETE CASCADE
    ) $charset_collate;";
    dbDelta($sql_pages);

    // Page content table (stores both text and whiteboard data)
    $table_content = $wpdb->prefix . 'mp_cb_page_content';
    $sql_content = "CREATE TABLE IF NOT EXISTS $table_content (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        page_id BIGINT UNSIGNED NOT NULL,
        content_json LONGTEXT DEFAULT NULL,
        whiteboard_data LONGTEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_page_id (page_id),
        FOREIGN KEY (page_id) REFERENCES $table_pages(id) ON DELETE CASCADE
    ) $charset_collate;";
    dbDelta($sql_content);

    // Page links table (for connecting pages together)
    $table_links = $wpdb->prefix . 'mp_cb_page_links';
    $sql_links = "CREATE TABLE IF NOT EXISTS $table_links (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        source_page_id BIGINT UNSIGNED NOT NULL,
        target_page_id BIGINT UNSIGNED NOT NULL,
        link_text VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_source (source_page_id),
        KEY idx_target (target_page_id),
        UNIQUE KEY idx_unique_link (source_page_id, target_page_id),
        FOREIGN KEY (source_page_id) REFERENCES $table_pages(id) ON DELETE CASCADE,
        FOREIGN KEY (target_page_id) REFERENCES $table_pages(id) ON DELETE CASCADE
    ) $charset_collate;";
    dbDelta($sql_links);
}

/**
 * Register REST API routes for course pages
 */
function mp_course_pages_register_routes() {
    $namespace = 'mentorship/v1';

    // Get course with all its pages
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/pages', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mp_get_course_pages',
        'permission_callback' => 'mp_check_course_access',
        'args' => [
            'course_id' => [
                'required' => true,
                'type' => 'integer',
            ],
        ],
    ]);

    // CRUD for pages
    register_rest_route($namespace, '/course-pages', [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mp_create_course_page',
        'permission_callback' => 'mp_check_course_edit_access',
    ]);

    register_rest_route($namespace, '/course-pages/(?P<id>\d+)', [
        [
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'mp_get_course_page',
            'permission_callback' => 'mp_check_page_access',
        ],
        [
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'mp_update_course_page',
            'permission_callback' => 'mp_check_page_edit_access',
        ],
        [
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'mp_delete_course_page',
            'permission_callback' => 'mp_check_page_edit_access',
        ],
    ]);

    // Page content endpoints
    register_rest_route($namespace, '/course-pages/(?P<page_id>\d+)/content', [
        [
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'mp_get_page_content',
            'permission_callback' => 'mp_check_page_access',
        ],
        [
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'mp_save_page_content',
            'permission_callback' => 'mp_check_page_edit_access',
        ],
    ]);

    // Reorder pages
    register_rest_route($namespace, '/courses/(?P<course_id>\d+)/pages/reorder', [
        'methods' => WP_REST_Server::EDITABLE,
        'callback' => 'mp_reorder_course_pages',
        'permission_callback' => 'mp_check_course_edit_access',
    ]);
}
add_action('rest_api_init', 'mp_course_pages_register_routes');

/**
 * Permission callbacks
 */
function mp_check_course_access($request) {
    return is_user_logged_in();
}

function mp_check_course_edit_access($request) {
    if (!is_user_logged_in()) {
        return false;
    }
    
    // Check if user can edit courses
    $user_id = get_current_user_id();
    return current_user_can('edit_posts') || mp_user_can_edit_courses($user_id);
}

function mp_check_page_access($request) {
    return is_user_logged_in();
}

function mp_check_page_edit_access($request) {
    return mp_check_course_edit_access($request);
}

/**
 * Helper function to check if user can edit courses
 */
function mp_user_can_edit_courses($user_id) {
    global $wpdb;
    
    // Admins can always edit
    if (current_user_can('administrator')) {
        return true;
    }
    
    // Check course permissions table
    $table_permissions = $wpdb->prefix . 'mp_cb_permissions';
    $table_users = $wpdb->prefix . 'mp_users';
    
    $result = $wpdb->get_var($wpdb->prepare(
        "SELECT p.can_edit 
         FROM $table_permissions p
         JOIN $table_users u ON p.job_role_id = u.job_role_id
         WHERE u.user_id = %d
         LIMIT 1",
        $user_id
    ));
    
    return (bool) $result;
}

/**
 * Get course with all pages
 */
function mp_get_course_pages($request) {
    global $wpdb;
    
    $course_id = $request->get_param('course_id');
    $table_courses = $wpdb->prefix . 'mp_cb_courses';
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    // Get course
    $course = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_courses WHERE id = %d",
        $course_id
    ), ARRAY_A);
    
    if (!$course) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Course not found',
        ], 404);
    }
    
    // Get all pages for this course
    $pages = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_pages 
         WHERE course_id = %d 
         ORDER BY parent_id NULLS FIRST, display_order ASC",
        $course_id
    ), ARRAY_A);
    
    return new WP_REST_Response([
        'success' => true,
        'data' => [
            'course' => $course,
            'pages' => $pages ?: [],
        ],
    ]);
}

/**
 * Create a new page
 */
function mp_create_course_page($request) {
    global $wpdb;
    
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    $data = [
        'course_id' => $request->get_param('course_id'),
        'parent_id' => $request->get_param('parent_id'),
        'title' => $request->get_param('title') ?: 'Untitled',
        'icon' => $request->get_param('icon'),
        'cover_image_url' => $request->get_param('cover_image_url'),
        'page_type' => $request->get_param('page_type') ?: 'content',
        'display_order' => $request->get_param('display_order') ?: 0,
        'is_published' => $request->get_param('is_published') ?: false,
    ];
    
    $result = $wpdb->insert($table_pages, $data);
    
    if ($result === false) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to create page',
        ], 500);
    }
    
    $page_id = $wpdb->insert_id;
    $page = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_pages WHERE id = %d",
        $page_id
    ), ARRAY_A);
    
    return new WP_REST_Response([
        'success' => true,
        'data' => $page,
    ]);
}

/**
 * Get a single page
 */
function mp_get_course_page($request) {
    global $wpdb;
    
    $page_id = $request->get_param('id');
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    $page = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_pages WHERE id = %d",
        $page_id
    ), ARRAY_A);
    
    if (!$page) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Page not found',
        ], 404);
    }
    
    return new WP_REST_Response([
        'success' => true,
        'data' => $page,
    ]);
}

/**
 * Update a page
 */
function mp_update_course_page($request) {
    global $wpdb;
    
    $page_id = $request->get_param('id');
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    // Build update data from request params
    $allowed_fields = ['title', 'icon', 'cover_image_url', 'page_type', 'parent_id', 'display_order', 'is_published'];
    $data = [];
    
    foreach ($allowed_fields as $field) {
        $value = $request->get_param($field);
        if ($value !== null) {
            $data[$field] = $value;
        }
    }
    
    if (empty($data)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'No data to update',
        ], 400);
    }
    
    $result = $wpdb->update($table_pages, $data, ['id' => $page_id]);
    
    if ($result === false) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to update page',
        ], 500);
    }
    
    $page = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_pages WHERE id = %d",
        $page_id
    ), ARRAY_A);
    
    return new WP_REST_Response([
        'success' => true,
        'data' => $page,
    ]);
}

/**
 * Delete a page (and all subpages)
 */
function mp_delete_course_page($request) {
    global $wpdb;
    
    $page_id = $request->get_param('id');
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    // The CASCADE delete will handle subpages and content
    $result = $wpdb->delete($table_pages, ['id' => $page_id]);
    
    if ($result === false) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to delete page',
        ], 500);
    }
    
    return new WP_REST_Response([
        'success' => true,
    ]);
}

/**
 * Get page content
 */
function mp_get_page_content($request) {
    global $wpdb;
    
    $page_id = $request->get_param('page_id');
    $table_content = $wpdb->prefix . 'mp_cb_page_content';
    
    $content = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_content WHERE page_id = %d",
        $page_id
    ), ARRAY_A);
    
    // Decode JSON fields
    if ($content) {
        if ($content['whiteboard_data']) {
            $content['whiteboard_data'] = json_decode($content['whiteboard_data'], true);
        }
    }
    
    return new WP_REST_Response([
        'success' => true,
        'data' => $content,
    ]);
}

/**
 * Save page content
 */
function mp_save_page_content($request) {
    global $wpdb;
    
    $page_id = $request->get_param('page_id');
    $table_content = $wpdb->prefix . 'mp_cb_page_content';
    
    // Check if content exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table_content WHERE page_id = %d",
        $page_id
    ));
    
    $data = [
        'page_id' => $page_id,
    ];
    
    // Handle content_json (already JSON string from frontend)
    $content_json = $request->get_param('content_json');
    if ($content_json !== null) {
        $data['content_json'] = $content_json;
    }
    
    // Handle whiteboard_data (encode if array)
    $whiteboard_data = $request->get_param('whiteboard_data');
    if ($whiteboard_data !== null) {
        $data['whiteboard_data'] = is_array($whiteboard_data) 
            ? json_encode($whiteboard_data) 
            : $whiteboard_data;
    }
    
    if ($existing) {
        unset($data['page_id']);
        $result = $wpdb->update($table_content, $data, ['page_id' => $page_id]);
    } else {
        $result = $wpdb->insert($table_content, $data);
    }
    
    if ($result === false) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to save content',
        ], 500);
    }
    
    // Return updated content
    $content = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_content WHERE page_id = %d",
        $page_id
    ), ARRAY_A);
    
    if ($content && $content['whiteboard_data']) {
        $content['whiteboard_data'] = json_decode($content['whiteboard_data'], true);
    }
    
    return new WP_REST_Response([
        'success' => true,
        'data' => $content,
    ]);
}

/**
 * Reorder pages
 */
function mp_reorder_course_pages($request) {
    global $wpdb;
    
    $course_id = $request->get_param('course_id');
    $pages = $request->get_param('pages');
    $table_pages = $wpdb->prefix . 'mp_cb_course_pages';
    
    if (!is_array($pages)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Invalid pages data',
        ], 400);
    }
    
    // Update each page's order and parent
    foreach ($pages as $page) {
        if (!isset($page['id'])) continue;
        
        $wpdb->update(
            $table_pages,
            [
                'display_order' => $page['display_order'] ?? 0,
                'parent_id' => $page['parent_id'] ?? null,
            ],
            ['id' => $page['id'], 'course_id' => $course_id]
        );
    }
    
    return new WP_REST_Response([
        'success' => true,
    ]);
}

// Create tables on plugin activation/update
add_action('init', function() {
    // Only run migration once per version
    $version = '1.0.0';
    $current_version = get_option('mp_course_pages_version', '0');
    
    if (version_compare($current_version, $version, '<')) {
        mp_course_pages_create_tables();
        update_option('mp_course_pages_version', $version);
    }
});
