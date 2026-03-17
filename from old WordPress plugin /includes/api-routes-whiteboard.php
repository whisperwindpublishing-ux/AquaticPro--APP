<?php
/**
 * Whiteboard Lesson API Routes
 * 
 * REST API endpoints for the Excalidraw-based whiteboard lesson system.
 * Includes: Lesson sections, whiteboards, quizzes, questions, and progress tracking.
 */

if (!defined('ABSPATH')) {
    exit;
}

// Initialize database tables (version-guarded to avoid running dbDelta on every page load)
add_action('init', 'mp_whiteboard_init_tables');

function mp_whiteboard_init_tables() {
    $current_version = get_option('mp_whiteboard_tables_version', '0');
    if (version_compare($current_version, '1.0.0', '>=')) {
        return; // Tables already at current schema version
    }

    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    
    // ========================================================================
    // LESSON SECTIONS TABLE
    // ========================================================================
    $table_sections = $wpdb->prefix . 'mp_wb_lesson_sections';
    $sql_sections = "CREATE TABLE IF NOT EXISTS $table_sections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        lesson_id BIGINT UNSIGNED NOT NULL,
        section_type ENUM('whiteboard', 'quiz', 'video', 'text') NOT NULL DEFAULT 'whiteboard',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        display_order INT DEFAULT 0,
        is_required TINYINT(1) DEFAULT 1,
        requires_section_id BIGINT UNSIGNED DEFAULT NULL,
        unlock_after_minutes INT DEFAULT NULL,
        video_url TEXT DEFAULT NULL,
        text_content LONGTEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lesson_id (lesson_id),
        KEY idx_display_order (display_order),
        KEY idx_section_type (section_type)
    ) $charset_collate;";
    dbDelta($sql_sections);
    
    // ========================================================================
    // WHITEBOARD PAGES TABLE
    // ========================================================================
    $table_whiteboards = $wpdb->prefix . 'mp_wb_whiteboards';
    $sql_whiteboards = "CREATE TABLE IF NOT EXISTS $table_whiteboards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        lesson_section_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) DEFAULT 'Untitled',
        data LONGTEXT NOT NULL,
        thumbnail_url TEXT DEFAULT NULL,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lesson_section_id (lesson_section_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_whiteboards);
    
    // ========================================================================
    // QUIZZES TABLE
    // ========================================================================
    $table_quizzes = $wpdb->prefix . 'mp_wb_quizzes';
    $sql_quizzes = "CREATE TABLE IF NOT EXISTS $table_quizzes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        lesson_section_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        time_limit_minutes INT DEFAULT NULL,
        passing_score INT DEFAULT 70,
        max_attempts INT DEFAULT NULL,
        shuffle_questions TINYINT(1) DEFAULT 0,
        shuffle_options TINYINT(1) DEFAULT 0,
        show_correct_answers ENUM('never', 'after_attempt', 'after_pass') DEFAULT 'after_attempt',
        allow_review TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_lesson_section_id (lesson_section_id)
    ) $charset_collate;";
    dbDelta($sql_quizzes);
    
    // ========================================================================
    // QUIZ QUESTIONS TABLE
    // ========================================================================
    $table_questions = $wpdb->prefix . 'mp_wb_quiz_questions';
    $sql_questions = "CREATE TABLE IF NOT EXISTS $table_questions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        quiz_id BIGINT UNSIGNED NOT NULL,
        question_type ENUM('multiple-choice', 'multiple-select', 'true-false', 'short-answer', 'hotspot', 'ordering', 'matching') NOT NULL DEFAULT 'multiple-choice',
        question_text TEXT NOT NULL,
        question_image_url TEXT DEFAULT NULL,
        question_data LONGTEXT NOT NULL,
        explanation TEXT DEFAULT NULL,
        points INT DEFAULT 1,
        display_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_quiz_id (quiz_id),
        KEY idx_display_order (display_order)
    ) $charset_collate;";
    dbDelta($sql_questions);
    
    // ========================================================================
    // LESSON PROGRESS TABLE
    // ========================================================================
    $table_lesson_progress = $wpdb->prefix . 'mp_wb_lesson_progress';
    $sql_lesson_progress = "CREATE TABLE IF NOT EXISTS $table_lesson_progress (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        lesson_id BIGINT UNSIGNED NOT NULL,
        status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
        current_section_id BIGINT UNSIGNED DEFAULT NULL,
        time_spent_seconds INT DEFAULT 0,
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_user_lesson (user_id, lesson_id),
        KEY idx_user_id (user_id),
        KEY idx_lesson_id (lesson_id),
        KEY idx_status (status)
    ) $charset_collate;";
    dbDelta($sql_lesson_progress);
    
    // ========================================================================
    // SECTION PROGRESS TABLE
    // ========================================================================
    $table_section_progress = $wpdb->prefix . 'mp_wb_section_progress';
    $sql_section_progress = "CREATE TABLE IF NOT EXISTS $table_section_progress (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        lesson_section_id BIGINT UNSIGNED NOT NULL,
        status ENUM('not_started', 'in_progress', 'completed', 'locked') DEFAULT 'not_started',
        time_spent_seconds INT DEFAULT 0,
        completed_at DATETIME DEFAULT NULL,
        quiz_score DECIMAL(5,2) DEFAULT NULL,
        quiz_passed TINYINT(1) DEFAULT NULL,
        quiz_attempts INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_user_section (user_id, lesson_section_id),
        KEY idx_user_id (user_id),
        KEY idx_lesson_section_id (lesson_section_id)
    ) $charset_collate;";
    dbDelta($sql_section_progress);
    
    // ========================================================================
    // QUIZ ATTEMPTS TABLE
    // ========================================================================
    $table_quiz_attempts = $wpdb->prefix . 'mp_wb_quiz_attempts';
    $sql_quiz_attempts = "CREATE TABLE IF NOT EXISTS $table_quiz_attempts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        quiz_id BIGINT UNSIGNED NOT NULL,
        lesson_section_id BIGINT UNSIGNED NOT NULL,
        score DECIMAL(5,2) NOT NULL,
        total_points INT NOT NULL,
        percentage DECIMAL(5,2) NOT NULL,
        passed TINYINT(1) NOT NULL,
        answers LONGTEXT NOT NULL,
        time_taken_seconds INT DEFAULT 0,
        started_at DATETIME NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_id (user_id),
        KEY idx_quiz_id (quiz_id),
        KEY idx_lesson_section_id (lesson_section_id),
        KEY idx_submitted_at (submitted_at)
    ) $charset_collate;";
    dbDelta($sql_quiz_attempts);

    // Mark tables as created at this schema version
    update_option('mp_whiteboard_tables_version', '1.0.0');
}

// ============================================================================
// REGISTER REST ROUTES
// ============================================================================
add_action('rest_api_init', function() {
    $namespace = 'mentorship/v1';
    
    // ========================================================================
    // LESSON SECTIONS ROUTES
    // ========================================================================
    
    // Get all sections for a lesson
    register_rest_route($namespace, '/lessons/(?P<lesson_id>\d+)/sections', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_lesson_sections',
        'permission_callback' => 'mp_wb_check_view_permission',
        'args' => [
            'lesson_id' => ['required' => true, 'type' => 'integer']
        ]
    ]);
    
    // Create a new section
    register_rest_route($namespace, '/lesson-sections', [
        'methods' => 'POST',
        'callback' => 'mp_wb_create_section',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // Get/Update/Delete a section
    register_rest_route($namespace, '/lesson-sections/(?P<id>\d+)', [
        [
            'methods' => 'GET',
            'callback' => 'mp_wb_get_section',
            'permission_callback' => 'mp_wb_check_view_permission',
        ],
        [
            'methods' => 'PUT',
            'callback' => 'mp_wb_update_section',
            'permission_callback' => 'mp_wb_check_edit_permission',
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'mp_wb_delete_section',
            'permission_callback' => 'mp_wb_check_edit_permission',
        ],
    ]);
    
    // Reorder sections
    register_rest_route($namespace, '/lesson-sections/reorder', [
        'methods' => 'PUT',
        'callback' => 'mp_wb_reorder_sections',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // ========================================================================
    // WHITEBOARD ROUTES
    // ========================================================================
    
    // Get whiteboard for a section
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/whiteboard', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_whiteboard',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Save/Update whiteboard
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/whiteboard', [
        'methods' => 'PUT',
        'callback' => 'mp_wb_save_whiteboard',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // Get whiteboard slides for a section (multi-page presentation)
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/whiteboard/slides', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_whiteboard_slides',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Save whiteboard slides (multi-page presentation)
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/whiteboard/slides', [
        'methods' => 'PUT',
        'callback' => 'mp_wb_save_whiteboard_slides',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // ========================================================================
    // QUIZ ROUTES
    // ========================================================================
    
    // Get quiz for a section
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/quiz', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_quiz',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Create/Update quiz for a section
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/quiz', [
        'methods' => ['POST', 'PUT'],
        'callback' => 'mp_wb_save_quiz',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // Submit quiz attempt
    register_rest_route($namespace, '/quizzes/(?P<quiz_id>\d+)/submit', [
        'methods' => 'POST',
        'callback' => 'mp_wb_submit_quiz',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Get quiz attempts for user
    register_rest_route($namespace, '/quizzes/(?P<quiz_id>\d+)/attempts', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_quiz_attempts',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // ========================================================================
    // QUIZ QUESTIONS ROUTES
    // ========================================================================
    
    // Get questions for a quiz
    register_rest_route($namespace, '/quizzes/(?P<quiz_id>\d+)/questions', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_questions',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Create question
    register_rest_route($namespace, '/quiz-questions', [
        'methods' => 'POST',
        'callback' => 'mp_wb_create_question',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // Update/Delete question
    register_rest_route($namespace, '/quiz-questions/(?P<id>\d+)', [
        [
            'methods' => 'PUT',
            'callback' => 'mp_wb_update_question',
            'permission_callback' => 'mp_wb_check_edit_permission',
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'mp_wb_delete_question',
            'permission_callback' => 'mp_wb_check_edit_permission',
        ],
    ]);
    
    // Reorder questions
    register_rest_route($namespace, '/quiz-questions/reorder', [
        'methods' => 'PUT',
        'callback' => 'mp_wb_reorder_questions',
        'permission_callback' => 'mp_wb_check_edit_permission',
    ]);
    
    // ========================================================================
    // PROGRESS TRACKING ROUTES
    // ========================================================================
    
    // Get lesson progress for current user
    register_rest_route($namespace, '/lessons/(?P<lesson_id>\d+)/progress', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_lesson_progress',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Update lesson progress (time spent, current section)
    register_rest_route($namespace, '/lessons/(?P<lesson_id>\d+)/progress', [
        'methods' => 'PUT',
        'callback' => 'mp_wb_update_lesson_progress',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Mark section as complete
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/complete', [
        'methods' => 'POST',
        'callback' => 'mp_wb_complete_section',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Get section progress
    register_rest_route($namespace, '/lesson-sections/(?P<section_id>\d+)/progress', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_section_progress',
        'permission_callback' => 'mp_wb_check_view_permission',
    ]);
    
    // Admin: Get all progress for a lesson (all users)
    register_rest_route($namespace, '/lessons/(?P<lesson_id>\d+)/all-progress', [
        'methods' => 'GET',
        'callback' => 'mp_wb_get_all_lesson_progress',
        'permission_callback' => 'mp_wb_check_manage_permission',
    ]);
});

// ============================================================================
// PERMISSION CALLBACKS
// ============================================================================

function mp_wb_check_view_permission() {
    return is_user_logged_in();
}

function mp_wb_check_edit_permission() {
    if (!is_user_logged_in()) return false;
    
    // Check if user has edit permission via course builder permissions
    global $wpdb;
    $user_id = get_current_user_id();
    
    // WordPress admins can always edit
    if (current_user_can('manage_options')) return true;
    
    // Check course builder permissions
    $table_permissions = $wpdb->prefix . 'mp_cb_permissions';
    $user_table = $wpdb->prefix . 'mentorship_users';
    
    $has_edit = $wpdb->get_var($wpdb->prepare("
        SELECT p.can_edit
        FROM $table_permissions p
        INNER JOIN $user_table u ON JSON_CONTAINS(u.job_role_ids, CAST(p.job_role_id AS JSON))
        WHERE u.wp_user_id = %d AND p.can_edit = 1
        LIMIT 1
    ", $user_id));
    
    return (bool) $has_edit;
}

function mp_wb_check_manage_permission() {
    if (!is_user_logged_in()) return false;
    
    // WordPress admins can always manage
    if (current_user_can('manage_options')) return true;
    
    global $wpdb;
    $user_id = get_current_user_id();
    
    $table_permissions = $wpdb->prefix . 'mp_cb_permissions';
    $user_table = $wpdb->prefix . 'mentorship_users';
    
    $has_manage = $wpdb->get_var($wpdb->prepare("
        SELECT p.can_manage
        FROM $table_permissions p
        INNER JOIN $user_table u ON JSON_CONTAINS(u.job_role_ids, CAST(p.job_role_id AS JSON))
        WHERE u.wp_user_id = %d AND p.can_manage = 1
        LIMIT 1
    ", $user_id));
    
    return (bool) $has_manage;
}

// ============================================================================
// LESSON SECTIONS HANDLERS
// ============================================================================

/**
 * Get all sections for a lesson with their content and progress
 */
function mp_wb_get_lesson_sections($request) {
    global $wpdb;
    $lesson_id = $request['lesson_id'];
    $user_id = get_current_user_id();
    
    $table_sections = $wpdb->prefix . 'mp_wb_lesson_sections';
    $table_section_progress = $wpdb->prefix . 'mp_wb_section_progress';
    
    $sections = $wpdb->get_results($wpdb->prepare("
        SELECT s.*, 
               sp.status as progress_status,
               sp.time_spent_seconds,
               sp.completed_at as progress_completed_at,
               sp.quiz_score,
               sp.quiz_passed,
               sp.quiz_attempts
        FROM $table_sections s
        LEFT JOIN $table_section_progress sp ON s.id = sp.lesson_section_id AND sp.user_id = %d
        WHERE s.lesson_id = %d
        ORDER BY s.display_order ASC
    ", $user_id, $lesson_id));
    
    // Load content for each section
    foreach ($sections as &$section) {
        $section->user_progress = null;
        
        if ($section->progress_status) {
            $section->user_progress = [
                'status' => $section->progress_status,
                'time_spent_seconds' => (int) $section->time_spent_seconds,
                'completed_at' => $section->progress_completed_at,
                'quiz_score' => $section->quiz_score ? (float) $section->quiz_score : null,
                'quiz_passed' => $section->quiz_passed !== null ? (bool) $section->quiz_passed : null,
                'quiz_attempts' => (int) $section->quiz_attempts,
            ];
        }
        
        // Remove temporary progress columns
        unset($section->progress_status, $section->progress_completed_at);
        
        // Load section-specific content
        if ($section->section_type === 'whiteboard') {
            $section->whiteboard = mp_wb_get_whiteboard_data($section->id);
        } elseif ($section->section_type === 'quiz') {
            $section->quiz = mp_wb_get_quiz_data($section->id, false); // Don't include answers
        }
    }
    
    return rest_ensure_response(['success' => true, 'data' => $sections]);
}

/**
 * Create a new lesson section
 */
function mp_wb_create_section($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_wb_lesson_sections';
    
    $data = $request->get_json_params();
    
    // Get next display order
    $max_order = $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(display_order) FROM $table WHERE lesson_id = %d",
        $data['lesson_id']
    ));
    
    $wpdb->insert($table, [
        'lesson_id' => $data['lesson_id'],
        'section_type' => $data['section_type'] ?? 'whiteboard',
        'title' => $data['title'],
        'description' => $data['description'] ?? null,
        'display_order' => ($max_order ?? -1) + 1,
        'is_required' => $data['is_required'] ?? 1,
        'requires_section_id' => $data['requires_section_id'] ?? null,
        'video_url' => $data['video_url'] ?? null,
        'text_content' => $data['text_content'] ?? null,
    ]);
    
    $section_id = $wpdb->insert_id;
    
    // Create initial whiteboard or quiz if needed
    if (($data['section_type'] ?? 'whiteboard') === 'whiteboard') {
        $table_wb = $wpdb->prefix . 'mp_wb_whiteboards';
        $wpdb->insert($table_wb, [
            'lesson_section_id' => $section_id,
            'title' => $data['title'],
            'data' => json_encode(['elements' => [], 'appState' => [], 'files' => []]),
        ]);
    } elseif (($data['section_type'] ?? '') === 'quiz') {
        $table_quiz = $wpdb->prefix . 'mp_wb_quizzes';
        $wpdb->insert($table_quiz, [
            'lesson_section_id' => $section_id,
            'title' => $data['title'],
            'passing_score' => 70,
        ]);
    }
    
    $section = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $section_id));
    
    return rest_ensure_response(['success' => true, 'data' => $section]);
}

/**
 * Get a single section
 */
function mp_wb_get_section($request) {
    global $wpdb;
    $id = $request['id'];
    
    $table = $wpdb->prefix . 'mp_wb_lesson_sections';
    $section = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    
    if (!$section) {
        return new WP_Error('not_found', 'Section not found', ['status' => 404]);
    }
    
    // Load content
    if ($section->section_type === 'whiteboard') {
        $section->whiteboard = mp_wb_get_whiteboard_data($section->id);
    } elseif ($section->section_type === 'quiz') {
        $section->quiz = mp_wb_get_quiz_data($section->id, mp_wb_check_edit_permission());
    }
    
    return rest_ensure_response(['success' => true, 'data' => $section]);
}

/**
 * Update a section
 */
function mp_wb_update_section($request) {
    global $wpdb;
    $id = $request['id'];
    $data = $request->get_json_params();
    
    $table = $wpdb->prefix . 'mp_wb_lesson_sections';
    
    $update_data = [];
    $allowed = ['title', 'description', 'is_required', 'requires_section_id', 'unlock_after_minutes', 'video_url', 'text_content'];
    
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            $update_data[$field] = $data[$field];
        }
    }
    
    if (!empty($update_data)) {
        $wpdb->update($table, $update_data, ['id' => $id]);
    }
    
    $section = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    
    return rest_ensure_response(['success' => true, 'data' => $section]);
}

/**
 * Delete a section
 */
function mp_wb_delete_section($request) {
    global $wpdb;
    $id = $request['id'];
    
    // Delete associated content
    $wpdb->delete($wpdb->prefix . 'mp_wb_whiteboards', ['lesson_section_id' => $id]);
    $wpdb->delete($wpdb->prefix . 'mp_wb_quizzes', ['lesson_section_id' => $id]);
    $wpdb->delete($wpdb->prefix . 'mp_wb_section_progress', ['lesson_section_id' => $id]);
    
    // Delete section
    $wpdb->delete($wpdb->prefix . 'mp_wb_lesson_sections', ['id' => $id]);
    
    return rest_ensure_response(['success' => true]);
}

/**
 * Reorder sections
 */
function mp_wb_reorder_sections($request) {
    global $wpdb;
    $data = $request->get_json_params();
    $table = $wpdb->prefix . 'mp_wb_lesson_sections';
    
    foreach ($data['order'] as $index => $section_id) {
        $wpdb->update($table, ['display_order' => $index], ['id' => $section_id]);
    }
    
    return rest_ensure_response(['success' => true]);
}

// ============================================================================
// WHITEBOARD HANDLERS
// ============================================================================

/**
 * Helper: Get whiteboard data for a section
 */
function mp_wb_get_whiteboard_data($section_id) {
    global $wpdb;
    $table = $wpdb->prefix . 'mp_wb_whiteboards';
    
    $whiteboard = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE lesson_section_id = %d ORDER BY display_order ASC LIMIT 1",
        $section_id
    ));
    
    if ($whiteboard && $whiteboard->data) {
        $whiteboard->data = json_decode($whiteboard->data);
    }
    
    return $whiteboard;
}

/**
 * Get whiteboard for a section
 */
function mp_wb_get_whiteboard($request) {
    $section_id = $request['section_id'];
    $whiteboard = mp_wb_get_whiteboard_data($section_id);
    
    return rest_ensure_response(['success' => true, 'data' => $whiteboard]);
}

/**
 * Save/Update whiteboard
 */
function mp_wb_save_whiteboard($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $data = $request->get_json_params();
    
    $table = $wpdb->prefix . 'mp_wb_whiteboards';
    
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE lesson_section_id = %d",
        $section_id
    ));
    
    $whiteboard_data = [
        'data' => json_encode($data['data'] ?? []),
        'title' => $data['title'] ?? 'Untitled',
        'thumbnail_url' => $data['thumbnail_url'] ?? null,
    ];
    
    if ($existing) {
        $wpdb->update($table, $whiteboard_data, ['id' => $existing]);
    } else {
        $whiteboard_data['lesson_section_id'] = $section_id;
        $wpdb->insert($table, $whiteboard_data);
    }
    
    return rest_ensure_response(['success' => true]);
}

/**
 * Get whiteboard slides (multi-page presentation)
 */
function mp_wb_get_whiteboard_slides($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $table = $wpdb->prefix . 'mp_wb_whiteboards';
    
    $slides = $wpdb->get_results($wpdb->prepare(
        "SELECT id, title, data, thumbnail_url FROM $table 
         WHERE lesson_section_id = %d 
         ORDER BY display_order ASC",
        $section_id
    ));
    
    $formatted_slides = [];
    foreach ($slides as $slide) {
        $formatted_slides[] = [
            'id' => 'slide-' . $slide->id,
            'title' => $slide->title,
            'data' => json_decode($slide->data),
            'thumbnailUrl' => $slide->thumbnail_url,
        ];
    }
    
    // Return empty slide array if none exist
    if (empty($formatted_slides)) {
        $formatted_slides[] = [
            'id' => 'slide-new-1',
            'title' => 'Slide 1',
            'data' => ['elements' => []],
            'thumbnailUrl' => null,
        ];
    }
    
    return rest_ensure_response(['success' => true, 'data' => $formatted_slides]);
}

/**
 * Save whiteboard slides (multi-page presentation)
 */
function mp_wb_save_whiteboard_slides($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $data = $request->get_json_params();
    $slides = $data['slides'] ?? [];
    
    $table = $wpdb->prefix . 'mp_wb_whiteboards';
    
    // Delete all existing slides for this section
    $wpdb->delete($table, ['lesson_section_id' => $section_id]);
    
    // Insert new slides
    foreach ($slides as $index => $slide) {
        $wpdb->insert($table, [
            'lesson_section_id' => $section_id,
            'title' => $slide['title'] ?? 'Slide ' . ($index + 1),
            'data' => json_encode($slide['data'] ?? ['elements' => []]),
            'thumbnail_url' => $slide['thumbnailUrl'] ?? null,
            'display_order' => $index,
        ]);
    }
    
    return rest_ensure_response(['success' => true]);
}

// ============================================================================
// QUIZ HANDLERS
// ============================================================================

/**
 * Helper: Get quiz data for a section
 */
function mp_wb_get_quiz_data($section_id, $include_answers = false) {
    global $wpdb;
    $table_quiz = $wpdb->prefix . 'mp_wb_quizzes';
    $table_questions = $wpdb->prefix . 'mp_wb_quiz_questions';
    
    $quiz = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_quiz WHERE lesson_section_id = %d",
        $section_id
    ));
    
    if (!$quiz) return null;
    
    // Get questions
    $questions = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_questions WHERE quiz_id = %d ORDER BY display_order ASC",
        $quiz->id
    ));
    
    $total_points = 0;
    foreach ($questions as &$q) {
        $q->question_data = json_decode($q->question_data);
        $total_points += (int) $q->points;
        
        // Remove answers if not including them (for learners)
        if (!$include_answers) {
            unset($q->question_data->correct_answer);
            unset($q->question_data->correct_option_id);
            unset($q->question_data->correct_option_ids);
            unset($q->question_data->accepted_answers);
            unset($q->question_data->correct_order);
            unset($q->question_data->correct_pairs);
            
            // For hotspots, remove is_correct from regions
            if (isset($q->question_data->hotspot_regions)) {
                foreach ($q->question_data->hotspot_regions as &$region) {
                    unset($region->is_correct);
                }
            }
        }
    }
    
    $quiz->questions = $questions;
    $quiz->question_count = count($questions);
    $quiz->total_points = $total_points;
    
    return $quiz;
}

/**
 * Get quiz for a section
 */
function mp_wb_get_quiz($request) {
    $section_id = $request['section_id'];
    $include_answers = mp_wb_check_edit_permission();
    
    $quiz = mp_wb_get_quiz_data($section_id, $include_answers);
    
    return rest_ensure_response(['success' => true, 'data' => $quiz]);
}

/**
 * Save/Update quiz
 */
function mp_wb_save_quiz($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $data = $request->get_json_params();
    
    $table = $wpdb->prefix . 'mp_wb_quizzes';
    
    $quiz_data = [
        'title' => $data['title'],
        'description' => $data['description'] ?? null,
        'time_limit_minutes' => $data['time_limit_minutes'] ?? null,
        'passing_score' => $data['passing_score'] ?? 70,
        'max_attempts' => $data['max_attempts'] ?? null,
        'shuffle_questions' => $data['shuffle_questions'] ?? 0,
        'shuffle_options' => $data['shuffle_options'] ?? 0,
        'show_correct_answers' => $data['show_correct_answers'] ?? 'after_attempt',
        'allow_review' => $data['allow_review'] ?? 1,
    ];
    
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table WHERE lesson_section_id = %d",
        $section_id
    ));
    
    if ($existing) {
        $wpdb->update($table, $quiz_data, ['id' => $existing]);
        $quiz_id = $existing;
    } else {
        $quiz_data['lesson_section_id'] = $section_id;
        $wpdb->insert($table, $quiz_data);
        $quiz_id = $wpdb->insert_id;
    }
    
    return rest_ensure_response(['success' => true, 'data' => ['id' => $quiz_id]]);
}

/**
 * Submit a quiz attempt
 */
function mp_wb_submit_quiz($request) {
    global $wpdb;
    $quiz_id = $request['quiz_id'];
    $data = $request->get_json_params();
    $user_id = get_current_user_id();
    
    $table_quiz = $wpdb->prefix . 'mp_wb_quizzes';
    $table_questions = $wpdb->prefix . 'mp_wb_quiz_questions';
    $table_attempts = $wpdb->prefix . 'mp_wb_quiz_attempts';
    $table_section_progress = $wpdb->prefix . 'mp_wb_section_progress';
    
    // Get quiz with answers
    $quiz = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table_quiz WHERE id = %d", $quiz_id));
    if (!$quiz) {
        return new WP_Error('not_found', 'Quiz not found', ['status' => 404]);
    }
    
    // Check max attempts
    if ($quiz->max_attempts) {
        $attempt_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_attempts WHERE quiz_id = %d AND user_id = %d",
            $quiz_id, $user_id
        ));
        
        if ($attempt_count >= $quiz->max_attempts) {
            return new WP_Error('max_attempts', 'Maximum attempts reached', ['status' => 403]);
        }
    }
    
    // Get questions with answers
    $questions = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_questions WHERE quiz_id = %d",
        $quiz_id
    ));
    
    // Grade the quiz
    $total_points = 0;
    $earned_points = 0;
    $answer_records = [];
    
    foreach ($questions as $q) {
        $q_data = json_decode($q->question_data, true);
        $user_answer = $data['answers'][$q->id] ?? null;
        $is_correct = false;
        $points_earned = 0;
        
        // Check answer based on question type
        switch ($q->question_type) {
            case 'multiple-choice':
                $is_correct = $user_answer == $q_data['correct_option_id'];
                break;
                
            case 'multiple-select':
                $correct_ids = $q_data['correct_option_ids'] ?? [];
                $user_ids = is_array($user_answer) ? $user_answer : [];
                sort($correct_ids);
                sort($user_ids);
                $is_correct = $correct_ids == $user_ids;
                break;
                
            case 'true-false':
                $is_correct = (bool)$user_answer === (bool)$q_data['correct_answer'];
                break;
                
            case 'short-answer':
                $accepted = array_map('strtolower', $q_data['accepted_answers'] ?? []);
                $user_lower = strtolower(trim($user_answer ?? ''));
                $is_correct = in_array($user_lower, $accepted);
                break;
                
            case 'ordering':
                $correct_order = $q_data['correct_order'] ?? [];
                $is_correct = $user_answer === $correct_order;
                break;
                
            case 'matching':
                $correct_pairs = $q_data['correct_pairs'] ?? [];
                $is_correct = $user_answer === $correct_pairs;
                break;
                
            case 'hotspot':
                // Check if user clicked correct region
                $regions = $q_data['hotspot_regions'] ?? [];
                foreach ($regions as $region) {
                    if ($region['is_correct'] && $region['id'] == $user_answer) {
                        $is_correct = true;
                        break;
                    }
                }
                break;
        }
        
        if ($is_correct) {
            $points_earned = (int) $q->points;
        }
        
        $total_points += (int) $q->points;
        $earned_points += $points_earned;
        
        $answer_records[] = [
            'question_id' => (int) $q->id,
            'question_type' => $q->question_type,
            'user_answer' => $user_answer,
            'correct_answer' => $q_data,
            'is_correct' => $is_correct,
            'points_earned' => $points_earned,
            'points_possible' => (int) $q->points,
        ];
    }
    
    $percentage = $total_points > 0 ? round(($earned_points / $total_points) * 100, 2) : 0;
    $passed = $percentage >= $quiz->passing_score;
    
    // Save attempt
    $wpdb->insert($table_attempts, [
        'user_id' => $user_id,
        'quiz_id' => $quiz_id,
        'lesson_section_id' => $quiz->lesson_section_id,
        'score' => $earned_points,
        'total_points' => $total_points,
        'percentage' => $percentage,
        'passed' => $passed ? 1 : 0,
        'answers' => json_encode($answer_records),
        'time_taken_seconds' => $data['time_taken_seconds'] ?? 0,
        'started_at' => $data['started_at'] ?? current_time('mysql'),
    ]);
    
    $attempt_id = $wpdb->insert_id;
    
    // Update section progress
    $existing_progress = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_section_progress WHERE user_id = %d AND lesson_section_id = %d",
        $user_id, $quiz->lesson_section_id
    ));
    
    $progress_data = [
        'quiz_attempts' => ($existing_progress->quiz_attempts ?? 0) + 1,
    ];
    
    // Update best score if this is better
    if (!$existing_progress || $percentage > ($existing_progress->quiz_score ?? 0)) {
        $progress_data['quiz_score'] = $percentage;
        $progress_data['quiz_passed'] = $passed ? 1 : 0;
    }
    
    // Mark complete if passed
    if ($passed) {
        $progress_data['status'] = 'completed';
        $progress_data['completed_at'] = current_time('mysql');
    }
    
    if ($existing_progress) {
        $wpdb->update($table_section_progress, $progress_data, ['id' => $existing_progress->id]);
    } else {
        $progress_data['user_id'] = $user_id;
        $progress_data['lesson_section_id'] = $quiz->lesson_section_id;
        $progress_data['status'] = $passed ? 'completed' : 'in_progress';
        $wpdb->insert($table_section_progress, $progress_data);
    }
    
    // Determine what to show
    $show_answers = false;
    if ($quiz->show_correct_answers === 'after_attempt') {
        $show_answers = true;
    } elseif ($quiz->show_correct_answers === 'after_pass' && $passed) {
        $show_answers = true;
    }
    
    // Calculate attempts remaining
    $attempts_remaining = null;
    if ($quiz->max_attempts) {
        $current_attempts = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_attempts WHERE quiz_id = %d AND user_id = %d",
            $quiz_id, $user_id
        ));
        $attempts_remaining = max(0, $quiz->max_attempts - $current_attempts);
    }
    
    $result = [
        'attempt_id' => $attempt_id,
        'score' => $earned_points,
        'total_points' => $total_points,
        'percentage' => $percentage,
        'passed' => $passed,
        'show_answers' => $show_answers,
        'answers' => $show_answers ? $answer_records : null,
        'message' => $passed ? 'Congratulations! You passed!' : 'Keep trying! You can do better.',
        'can_retry' => !$quiz->max_attempts || $attempts_remaining > 0,
        'attempts_remaining' => $attempts_remaining,
    ];
    
    return rest_ensure_response(['success' => true, 'data' => $result]);
}

/**
 * Get quiz attempts for current user
 */
function mp_wb_get_quiz_attempts($request) {
    global $wpdb;
    $quiz_id = $request['quiz_id'];
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'mp_wb_quiz_attempts';
    
    $attempts = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table WHERE quiz_id = %d AND user_id = %d ORDER BY submitted_at DESC",
        $quiz_id, $user_id
    ));
    
    foreach ($attempts as &$attempt) {
        $attempt->answers = json_decode($attempt->answers);
    }
    
    return rest_ensure_response(['success' => true, 'data' => $attempts]);
}

// ============================================================================
// QUIZ QUESTIONS HANDLERS
// ============================================================================

/**
 * Get questions for a quiz
 */
function mp_wb_get_questions($request) {
    global $wpdb;
    $quiz_id = $request['quiz_id'];
    
    $table = $wpdb->prefix . 'mp_wb_quiz_questions';
    $include_answers = mp_wb_check_edit_permission();
    
    $questions = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table WHERE quiz_id = %d ORDER BY display_order ASC",
        $quiz_id
    ));
    
    foreach ($questions as &$q) {
        $q->question_data = json_decode($q->question_data);
        
        if (!$include_answers) {
            unset($q->question_data->correct_answer);
            unset($q->question_data->correct_option_id);
            unset($q->question_data->correct_option_ids);
            unset($q->question_data->accepted_answers);
            unset($q->question_data->correct_order);
            unset($q->question_data->correct_pairs);
        }
    }
    
    return rest_ensure_response(['success' => true, 'data' => $questions]);
}

/**
 * Create a question
 */
function mp_wb_create_question($request) {
    global $wpdb;
    $data = $request->get_json_params();
    
    $table = $wpdb->prefix . 'mp_wb_quiz_questions';
    
    // Get next display order
    $max_order = $wpdb->get_var($wpdb->prepare(
        "SELECT MAX(display_order) FROM $table WHERE quiz_id = %d",
        $data['quiz_id']
    ));
    
    $wpdb->insert($table, [
        'quiz_id' => $data['quiz_id'],
        'question_type' => $data['question_type'],
        'question_text' => $data['question_text'],
        'question_image_url' => $data['question_image_url'] ?? null,
        'question_data' => json_encode($data['question_data'] ?? []),
        'explanation' => $data['explanation'] ?? null,
        'points' => $data['points'] ?? 1,
        'display_order' => ($max_order ?? -1) + 1,
    ]);
    
    $question_id = $wpdb->insert_id;
    $question = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $question_id));
    $question->question_data = json_decode($question->question_data);
    
    return rest_ensure_response(['success' => true, 'data' => $question]);
}

/**
 * Update a question
 */
function mp_wb_update_question($request) {
    global $wpdb;
    $id = $request['id'];
    $data = $request->get_json_params();
    
    $table = $wpdb->prefix . 'mp_wb_quiz_questions';
    
    $update_data = [];
    $allowed = ['question_type', 'question_text', 'question_image_url', 'explanation', 'points'];
    
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            $update_data[$field] = $data[$field];
        }
    }
    
    if (isset($data['question_data'])) {
        $update_data['question_data'] = json_encode($data['question_data']);
    }
    
    if (!empty($update_data)) {
        $wpdb->update($table, $update_data, ['id' => $id]);
    }
    
    $question = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    $question->question_data = json_decode($question->question_data);
    
    return rest_ensure_response(['success' => true, 'data' => $question]);
}

/**
 * Delete a question
 */
function mp_wb_delete_question($request) {
    global $wpdb;
    $id = $request['id'];
    
    $wpdb->delete($wpdb->prefix . 'mp_wb_quiz_questions', ['id' => $id]);
    
    return rest_ensure_response(['success' => true]);
}

/**
 * Reorder questions
 */
function mp_wb_reorder_questions($request) {
    global $wpdb;
    $data = $request->get_json_params();
    $table = $wpdb->prefix . 'mp_wb_quiz_questions';
    
    foreach ($data['order'] as $index => $question_id) {
        $wpdb->update($table, ['display_order' => $index], ['id' => $question_id]);
    }
    
    return rest_ensure_response(['success' => true]);
}

// ============================================================================
// PROGRESS TRACKING HANDLERS
// ============================================================================

/**
 * Get lesson progress for current user
 */
function mp_wb_get_lesson_progress($request) {
    global $wpdb;
    $lesson_id = $request['lesson_id'];
    $user_id = get_current_user_id();
    
    $table_progress = $wpdb->prefix . 'mp_wb_lesson_progress';
    $table_sections = $wpdb->prefix . 'mp_wb_lesson_sections';
    $table_section_progress = $wpdb->prefix . 'mp_wb_section_progress';
    
    // Get or create lesson progress
    $progress = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_progress WHERE user_id = %d AND lesson_id = %d",
        $user_id, $lesson_id
    ));
    
    if (!$progress) {
        $wpdb->insert($table_progress, [
            'user_id' => $user_id,
            'lesson_id' => $lesson_id,
            'status' => 'not_started',
        ]);
        $progress = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_progress WHERE id = %d",
            $wpdb->insert_id
        ));
    }
    
    // Get section counts
    $total_sections = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table_sections WHERE lesson_id = %d",
        $lesson_id
    ));
    
    $completed_sections = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table_section_progress sp
         INNER JOIN $table_sections s ON sp.lesson_section_id = s.id
         WHERE s.lesson_id = %d AND sp.user_id = %d AND sp.status = 'completed'",
        $lesson_id, $user_id
    ));
    
    $progress->sections_completed = (int) $completed_sections;
    $progress->total_sections = (int) $total_sections;
    $progress->completion_percentage = $total_sections > 0 
        ? round(($completed_sections / $total_sections) * 100, 1) 
        : 0;
    
    return rest_ensure_response(['success' => true, 'data' => $progress]);
}

/**
 * Update lesson progress
 */
function mp_wb_update_lesson_progress($request) {
    global $wpdb;
    $lesson_id = $request['lesson_id'];
    $data = $request->get_json_params();
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'mp_wb_lesson_progress';
    
    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE user_id = %d AND lesson_id = %d",
        $user_id, $lesson_id
    ));
    
    $update_data = [
        'last_accessed_at' => current_time('mysql'),
    ];
    
    if (isset($data['current_section_id'])) {
        $update_data['current_section_id'] = $data['current_section_id'];
    }
    
    if (isset($data['time_spent_seconds'])) {
        $update_data['time_spent_seconds'] = ($existing->time_spent_seconds ?? 0) + $data['time_spent_seconds'];
    }
    
    if ($existing) {
        // Start lesson if not started
        if ($existing->status === 'not_started') {
            $update_data['status'] = 'in_progress';
            $update_data['started_at'] = current_time('mysql');
        }
        
        $wpdb->update($table, $update_data, ['id' => $existing->id]);
    } else {
        $update_data['user_id'] = $user_id;
        $update_data['lesson_id'] = $lesson_id;
        $update_data['status'] = 'in_progress';
        $update_data['started_at'] = current_time('mysql');
        $wpdb->insert($table, $update_data);
    }
    
    return rest_ensure_response(['success' => true]);
}

/**
 * Mark a section as complete
 */
function mp_wb_complete_section($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $user_id = get_current_user_id();
    
    $table_section_progress = $wpdb->prefix . 'mp_wb_section_progress';
    $table_sections = $wpdb->prefix . 'mp_wb_lesson_sections';
    $table_lesson_progress = $wpdb->prefix . 'mp_wb_lesson_progress';
    
    // Get section info
    $section = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_sections WHERE id = %d",
        $section_id
    ));
    
    if (!$section) {
        return new WP_Error('not_found', 'Section not found', ['status' => 404]);
    }
    
    // Update or create section progress
    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table_section_progress WHERE user_id = %d AND lesson_section_id = %d",
        $user_id, $section_id
    ));
    
    if ($existing) {
        $wpdb->update($table_section_progress, [
            'status' => 'completed',
            'completed_at' => current_time('mysql'),
        ], ['id' => $existing->id]);
    } else {
        $wpdb->insert($table_section_progress, [
            'user_id' => $user_id,
            'lesson_section_id' => $section_id,
            'status' => 'completed',
            'completed_at' => current_time('mysql'),
        ]);
    }
    
    // Check if all sections are complete
    $total_sections = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table_sections WHERE lesson_id = %d AND is_required = 1",
        $section->lesson_id
    ));
    
    $completed_sections = $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM $table_section_progress sp
         INNER JOIN $table_sections s ON sp.lesson_section_id = s.id
         WHERE s.lesson_id = %d AND s.is_required = 1 AND sp.user_id = %d AND sp.status = 'completed'",
        $section->lesson_id, $user_id
    ));
    
    // If all required sections complete, mark lesson complete
    if ($completed_sections >= $total_sections) {
        $wpdb->update($table_lesson_progress, [
            'status' => 'completed',
            'completed_at' => current_time('mysql'),
        ], [
            'user_id' => $user_id,
            'lesson_id' => $section->lesson_id,
        ]);
    }
    
    return rest_ensure_response([
        'success' => true,
        'data' => [
            'sections_completed' => (int) $completed_sections,
            'total_sections' => (int) $total_sections,
            'lesson_completed' => $completed_sections >= $total_sections,
        ],
    ]);
}

/**
 * Get section progress
 */
function mp_wb_get_section_progress($request) {
    global $wpdb;
    $section_id = $request['section_id'];
    $user_id = get_current_user_id();
    
    $table = $wpdb->prefix . 'mp_wb_section_progress';
    
    $progress = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE user_id = %d AND lesson_section_id = %d",
        $user_id, $section_id
    ));
    
    if (!$progress) {
        $progress = (object) [
            'status' => 'not_started',
            'time_spent_seconds' => 0,
            'quiz_score' => null,
            'quiz_passed' => null,
            'quiz_attempts' => 0,
        ];
    }
    
    return rest_ensure_response(['success' => true, 'data' => $progress]);
}

/**
 * Get all lesson progress (admin view)
 */
function mp_wb_get_all_lesson_progress($request) {
    global $wpdb;
    $lesson_id = $request['lesson_id'];
    
    $table_progress = $wpdb->prefix . 'mp_wb_lesson_progress';
    $users_table = $wpdb->prefix . 'mentorship_users';
    
    $progress_list = $wpdb->get_results($wpdb->prepare("
        SELECT 
            lp.*,
            u.first_name,
            u.last_name,
            u.email
        FROM $table_progress lp
        INNER JOIN $users_table u ON lp.user_id = u.wp_user_id
        WHERE lp.lesson_id = %d
        ORDER BY lp.last_accessed_at DESC
    ", $lesson_id));
    
    return rest_ensure_response(['success' => true, 'data' => $progress_list]);
}
