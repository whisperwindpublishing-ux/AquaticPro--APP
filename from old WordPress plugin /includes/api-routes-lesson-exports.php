<?php
/**
 * Lesson Management Export REST API Routes
 * 
 * Provides simple one-click CSV exports for all Lesson Management data.
 * Each export downloads a single table/data type as a CSV file.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register Lesson Management Export REST API routes
 */
add_action('rest_api_init', function() {
    $namespace = 'mentorship-platform/v1';
    
    // Get available export types with counts
    register_rest_route($namespace, '/lesson-exports/types', array(
        'methods' => 'GET',
        'callback' => 'lm_export_get_types',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Groups
    register_rest_route($namespace, '/lesson-exports/groups', array(
        'methods' => 'GET',
        'callback' => 'lm_export_groups',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Swimmers
    register_rest_route($namespace, '/lesson-exports/swimmers', array(
        'methods' => 'GET',
        'callback' => 'lm_export_swimmers',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Evaluations
    register_rest_route($namespace, '/lesson-exports/evaluations', array(
        'methods' => 'GET',
        'callback' => 'lm_export_evaluations',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Levels
    register_rest_route($namespace, '/lesson-exports/levels', array(
        'methods' => 'GET',
        'callback' => 'lm_export_levels',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Skills
    register_rest_route($namespace, '/lesson-exports/skills', array(
        'methods' => 'GET',
        'callback' => 'lm_export_skills',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Camps (taxonomy)
    register_rest_route($namespace, '/lesson-exports/camps', array(
        'methods' => 'GET',
        'callback' => 'lm_export_camps',
        'permission_callback' => 'lm_export_permission_check'
    ));
    
    // Export Lesson Types (taxonomy)
    register_rest_route($namespace, '/lesson-exports/lesson-types', array(
        'methods' => 'GET',
        'callback' => 'lm_export_lesson_types',
        'permission_callback' => 'lm_export_permission_check'
    ));
});

/**
 * Check if user has permission to export lesson management data
 */
function lm_export_permission_check() {
    // Admins always have access
    if (current_user_can('manage_options')) {
        return true;
    }
    
    // Check LM permissions - require view permission at minimum
    if (function_exists('lm_get_user_lesson_permissions')) {
        $perms = lm_get_user_lesson_permissions(get_current_user_id());
        return !empty($perms['can_view']) || !empty($perms['can_moderate_all']);
    }
    
    return false;
}

/**
 * Get available export types with record counts
 */
function lm_export_get_types(WP_REST_Request $request) {
    global $wpdb;
    
    $types = array();
    
    // Count Groups
    $groups_count = wp_count_posts('lm-group');
    $types[] = array(
        'id' => 'groups',
        'name' => 'Groups',
        'description' => 'All lesson groups with instructors, schedules, and swimmers',
        'count' => isset($groups_count->publish) ? (int)$groups_count->publish : 0,
        'endpoint' => '/lesson-exports/groups'
    );
    
    // Count Swimmers
    $swimmers_count = wp_count_posts('lm-swimmer');
    $types[] = array(
        'id' => 'swimmers',
        'name' => 'Swimmers',
        'description' => 'All swimmers with parent info, levels, and skills',
        'count' => isset($swimmers_count->publish) ? (int)$swimmers_count->publish : 0,
        'endpoint' => '/lesson-exports/swimmers'
    );
    
    // Count Evaluations
    $evaluations_count = wp_count_posts('lm-evaluation');
    $types[] = array(
        'id' => 'evaluations',
        'name' => 'Evaluations',
        'description' => 'All swimmer evaluations with dates and content',
        'count' => isset($evaluations_count->publish) ? (int)$evaluations_count->publish : 0,
        'endpoint' => '/lesson-exports/evaluations'
    );
    
    // Count Levels
    $levels_count = wp_count_posts('lm-level');
    $types[] = array(
        'id' => 'levels',
        'name' => 'Levels',
        'description' => 'All swimming levels with related skills',
        'count' => isset($levels_count->publish) ? (int)$levels_count->publish : 0,
        'endpoint' => '/lesson-exports/levels'
    );
    
    // Count Skills
    $skills_count = wp_count_posts('lm-skill');
    $types[] = array(
        'id' => 'skills',
        'name' => 'Skills',
        'description' => 'All swimming skills with level associations',
        'count' => isset($skills_count->publish) ? (int)$skills_count->publish : 0,
        'endpoint' => '/lesson-exports/skills'
    );
    
    // Count Camps (taxonomy)
    $camps_count = wp_count_terms('lm_camp');
    $types[] = array(
        'id' => 'camps',
        'name' => 'Camps',
        'description' => 'All camp/session categories',
        'count' => is_wp_error($camps_count) ? 0 : (int)$camps_count,
        'endpoint' => '/lesson-exports/camps'
    );
    
    // Count Lesson Types (taxonomy)
    $lesson_types_count = wp_count_terms('lm_lesson_type');
    $types[] = array(
        'id' => 'lesson-types',
        'name' => 'Lesson Types',
        'description' => 'All lesson type categories',
        'count' => is_wp_error($lesson_types_count) ? 0 : (int)$lesson_types_count,
        'endpoint' => '/lesson-exports/lesson-types'
    );
    
    return rest_ensure_response($types);
}

/**
 * Helper function to generate CSV from array of rows
 */
function lm_generate_csv($headers, $rows, $filename) {
    $csv_lines = array();
    
    // Header row
    $csv_lines[] = implode(',', array_map('lm_csv_escape', $headers));
    
    // Data rows
    foreach ($rows as $row) {
        $csv_lines[] = implode(',', array_map('lm_csv_escape', $row));
    }
    
    $csv_content = implode("\n", $csv_lines);
    
    return array(
        'csv' => $csv_content,
        'filename' => $filename . '-' . date('Y-m-d') . '.csv',
        'content_type' => 'text/csv',
        'record_count' => count($rows)
    );
}

/**
 * Escape a value for CSV
 */
function lm_csv_escape($value) {
    if ($value === null) {
        return '';
    }
    $value = (string)$value;
    // If contains comma, newline, or quote, wrap in quotes and escape quotes
    if (strpos($value, ',') !== false || strpos($value, "\n") !== false || strpos($value, '"') !== false) {
        return '"' . str_replace('"', '""', $value) . '"';
    }
    return $value;
}

/**
 * Get user display name by ID
 */
function lm_get_user_name($user_id) {
    if (empty($user_id)) return '';
    $user = get_user_by('id', $user_id);
    return $user ? $user->display_name : 'User #' . $user_id;
}

/**
 * Export Groups
 */
function lm_export_groups(WP_REST_Request $request) {
    $groups = get_posts(array(
        'post_type' => 'lm-group',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'title',
        'order' => 'ASC'
    ));
    
    $headers = array(
        'ID', 'Title', 'Instructors', 'Days', 'Time', 'Start Date', 'End Date',
        'Session', 'Location', 'Facility', 'Pool Type', 'Class Type', 'Ratio',
        'Swimmer Count', 'Notes', 'Created', 'Modified'
    );
    
    $rows = array();
    foreach ($groups as $group) {
        // Get instructors
        $instructor_ids = get_post_meta($group->ID, 'instructor', true);
        $instructors = array();
        if (!empty($instructor_ids) && is_array($instructor_ids)) {
            foreach ($instructor_ids as $uid) {
                $instructors[] = lm_get_user_name($uid);
            }
        }
        
        // Get swimmers count
        $swimmers = get_post_meta($group->ID, 'swimmers', true);
        $swimmer_count = is_array($swimmers) ? count($swimmers) : 0;
        
        // Get taxonomies
        $camps = wp_get_post_terms($group->ID, 'lm_camp', array('fields' => 'names'));
        $lesson_types = wp_get_post_terms($group->ID, 'lm_lesson_type', array('fields' => 'names'));
        
        $rows[] = array(
            $group->ID,
            $group->post_title,
            implode('; ', $instructors),
            get_post_meta($group->ID, 'days', true) ?: '',
            get_post_meta($group->ID, 'group_time', true) ?: '',
            get_post_meta($group->ID, 'start_date', true) ?: '',
            get_post_meta($group->ID, 'end_date', true) ?: '',
            get_post_meta($group->ID, 'session', true) ?: (is_array($camps) ? implode(', ', $camps) : ''),
            get_post_meta($group->ID, 'location', true) ?: '',
            get_post_meta($group->ID, 'facility', true) ?: get_post_meta($group->ID, 'facility_display', true) ?: '',
            get_post_meta($group->ID, 'pool_type', true) ?: '',
            get_post_meta($group->ID, 'class_type', true) ?: (is_array($lesson_types) ? implode(', ', $lesson_types) : ''),
            get_post_meta($group->ID, 'ratio', true) ?: '',
            $swimmer_count,
            strip_tags(get_post_meta($group->ID, 'notes', true) ?: ''),
            $group->post_date,
            $group->post_modified
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-groups'));
}

/**
 * Export Swimmers
 */
function lm_export_swimmers(WP_REST_Request $request) {
    $swimmers = get_posts(array(
        'post_type' => 'lm-swimmer',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'title',
        'order' => 'ASC'
    ));
    
    // Build level lookup
    $levels = get_posts(array('post_type' => 'lm-level', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $level_lookup = array();
    foreach ($levels as $level) {
        $level_lookup[$level->ID] = $level->post_title;
    }
    
    // Build skill lookup
    $skills = get_posts(array('post_type' => 'lm-skill', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $skill_lookup = array();
    foreach ($skills as $skill) {
        $skill_lookup[$skill->ID] = $skill->post_title;
    }
    
    $headers = array(
        'ID', 'Name', 'Parent Name', 'Parent Email', 'Date of Birth', 
        'Current Level', 'Levels Mastered', 'Skills Mastered Count',
        'Evaluation Count', 'Archived', 'Notes', 'Created', 'Modified'
    );
    
    $rows = array();
    foreach ($swimmers as $swimmer) {
        // Current level
        $current_level_id = get_post_meta($swimmer->ID, 'current_level', true);
        $current_level = isset($level_lookup[$current_level_id]) ? $level_lookup[$current_level_id] : '';
        
        // Levels mastered
        $levels_mastered = get_post_meta($swimmer->ID, 'levels_mastered', true);
        $levels_mastered_names = array();
        if (is_array($levels_mastered)) {
            foreach ($levels_mastered as $lid) {
                if (isset($level_lookup[$lid])) {
                    $levels_mastered_names[] = $level_lookup[$lid];
                }
            }
        }
        
        // Skills mastered
        $skills_mastered = get_post_meta($swimmer->ID, 'skills_mastered', true);
        $skills_count = is_array($skills_mastered) ? count($skills_mastered) : 0;
        
        // Evaluations
        $evaluations = get_post_meta($swimmer->ID, 'evaluations', true);
        $eval_count = is_array($evaluations) ? count($evaluations) : 0;
        
        // Archived status
        $archived = get_post_meta($swimmer->ID, 'archived', true);
        
        $rows[] = array(
            $swimmer->ID,
            $swimmer->post_title,
            get_post_meta($swimmer->ID, 'parent_name', true) ?: '',
            get_post_meta($swimmer->ID, 'parent_email', true) ?: '',
            get_post_meta($swimmer->ID, 'date_of_birth', true) ?: '',
            $current_level,
            implode('; ', $levels_mastered_names),
            $skills_count,
            $eval_count,
            $archived ? 'Yes' : 'No',
            strip_tags(get_post_meta($swimmer->ID, 'notes', true) ?: ''),
            $swimmer->post_date,
            $swimmer->post_modified
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-swimmers'));
}

/**
 * Export Evaluations
 */
function lm_export_evaluations(WP_REST_Request $request) {
    $evaluations = get_posts(array(
        'post_type' => 'lm-evaluation',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC'
    ));
    
    // Build swimmer lookup
    $swimmers = get_posts(array('post_type' => 'lm-swimmer', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $swimmer_lookup = array();
    foreach ($swimmers as $swimmer) {
        $swimmer_lookup[$swimmer->ID] = $swimmer->post_title;
    }
    
    // Build level lookup
    $levels = get_posts(array('post_type' => 'lm-level', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $level_lookup = array();
    foreach ($levels as $level) {
        $level_lookup[$level->ID] = $level->post_title;
    }
    
    $headers = array(
        'ID', 'Title', 'Swimmer', 'Level Evaluated', 'Content', 
        'Emailed', 'Author', 'Created', 'Modified'
    );
    
    $rows = array();
    foreach ($evaluations as $eval) {
        // Get swimmer
        $swimmer_id = get_post_meta($eval->ID, 'swimmer', true);
        $swimmer_name = isset($swimmer_lookup[$swimmer_id]) ? $swimmer_lookup[$swimmer_id] : '';
        
        // Get level
        $level_id = get_post_meta($eval->ID, 'level_evaluated', true);
        $level_name = isset($level_lookup[$level_id]) ? $level_lookup[$level_id] : '';
        
        // Get emailed status
        $emailed = get_post_meta($eval->ID, 'emailed', true);
        
        $rows[] = array(
            $eval->ID,
            $eval->post_title,
            $swimmer_name,
            $level_name,
            strip_tags($eval->post_content),
            $emailed ? 'Yes' : 'No',
            lm_get_user_name($eval->post_author),
            $eval->post_date,
            $eval->post_modified
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-evaluations'));
}

/**
 * Export Levels
 */
function lm_export_levels(WP_REST_Request $request) {
    $levels = get_posts(array(
        'post_type' => 'lm-level',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'meta_value_num',
        'meta_key' => 'sort_order',
        'order' => 'ASC'
    ));
    
    // Build skill lookup
    $skills = get_posts(array('post_type' => 'lm-skill', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $skill_lookup = array();
    foreach ($skills as $skill) {
        $skill_lookup[$skill->ID] = $skill->post_title;
    }
    
    $headers = array(
        'ID', 'Title', 'Sort Order', 'Related Skills', 'Swimmers Mastered Count', 'Created', 'Modified'
    );
    
    $rows = array();
    foreach ($levels as $level) {
        // Related skills
        $related_skills = get_post_meta($level->ID, 'related_skills', true);
        $skill_names = array();
        if (is_array($related_skills)) {
            foreach ($related_skills as $sid) {
                if (isset($skill_lookup[$sid])) {
                    $skill_names[] = $skill_lookup[$sid];
                }
            }
        }
        
        // Swimmers mastered count
        $swimmers_mastered = get_post_meta($level->ID, 'swimmers_mastered', true);
        $mastered_count = is_array($swimmers_mastered) ? count($swimmers_mastered) : 0;
        
        $rows[] = array(
            $level->ID,
            $level->post_title,
            get_post_meta($level->ID, 'sort_order', true) ?: 0,
            implode('; ', $skill_names),
            $mastered_count,
            $level->post_date,
            $level->post_modified
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-levels'));
}

/**
 * Export Skills
 */
function lm_export_skills(WP_REST_Request $request) {
    $skills = get_posts(array(
        'post_type' => 'lm-skill',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'title',
        'order' => 'ASC'
    ));
    
    // Build level lookup
    $levels = get_posts(array('post_type' => 'lm-level', 'posts_per_page' => -1, 'post_status' => 'publish'));
    $level_lookup = array();
    foreach ($levels as $level) {
        $level_lookup[$level->ID] = $level->post_title;
    }
    
    $headers = array(
        'ID', 'Title', 'Associated Level', 'Swimmers Skilled Count', 'Created', 'Modified'
    );
    
    $rows = array();
    foreach ($skills as $skill) {
        // Level associated
        $level_id = get_post_meta($skill->ID, 'level_associated', true);
        $level_name = isset($level_lookup[$level_id]) ? $level_lookup[$level_id] : '';
        
        // Swimmers skilled count
        $swimmers_skilled = get_post_meta($skill->ID, 'swimmer_skilled', true);
        $skilled_count = is_array($swimmers_skilled) ? count($swimmers_skilled) : 0;
        
        $rows[] = array(
            $skill->ID,
            $skill->post_title,
            $level_name,
            $skilled_count,
            $skill->post_date,
            $skill->post_modified
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-skills'));
}

/**
 * Export Camps (taxonomy)
 */
function lm_export_camps(WP_REST_Request $request) {
    $camps = get_terms(array(
        'taxonomy' => 'lm_camp',
        'hide_empty' => false,
        'orderby' => 'name',
        'order' => 'ASC'
    ));
    
    if (is_wp_error($camps)) {
        return rest_ensure_response(lm_generate_csv(array('ID', 'Name', 'Slug', 'Description', 'Group Count'), array(), 'lm-camps'));
    }
    
    $headers = array('ID', 'Name', 'Slug', 'Description', 'Group Count');
    
    $rows = array();
    foreach ($camps as $camp) {
        $rows[] = array(
            $camp->term_id,
            $camp->name,
            $camp->slug,
            $camp->description,
            $camp->count
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-camps'));
}

/**
 * Export Lesson Types (taxonomy)
 */
function lm_export_lesson_types(WP_REST_Request $request) {
    $types = get_terms(array(
        'taxonomy' => 'lm_lesson_type',
        'hide_empty' => false,
        'orderby' => 'name',
        'order' => 'ASC'
    ));
    
    if (is_wp_error($types)) {
        return rest_ensure_response(lm_generate_csv(array('ID', 'Name', 'Slug', 'Description', 'Group Count'), array(), 'lm-lesson-types'));
    }
    
    $headers = array('ID', 'Name', 'Slug', 'Description', 'Group Count');
    
    $rows = array();
    foreach ($types as $type) {
        $rows[] = array(
            $type->term_id,
            $type->name,
            $type->slug,
            $type->description,
            $type->count
        );
    }
    
    return rest_ensure_response(lm_generate_csv($headers, $rows, 'lm-lesson-types'));
}
