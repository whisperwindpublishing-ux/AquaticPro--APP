<?php
/**
 * AquaticPro LMS — Course Auto-Assignment by Role
 *
 * Allows admins to configure rules that automatically assign courses
 * to users when they receive a specific job role. When a new member
 * is assigned a role, any matching auto-assign rules trigger and the
 * course is assigned to them.
 *
 * Tables:
 *   - aquaticpro_course_auto_assign_rules  (admin-configured course→role rules)
 *   - aquaticpro_course_assignments        (per-user course assignment records)
 *
 * @package AquaticPro
 * @subpackage LMS
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// ============================================
// TABLE CREATION
// ============================================

function aquaticpro_lms_auto_assign_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    // --- Auto-assign rules: which courses auto-assign to which roles ---
    $rules_table = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $sql_rules = "CREATE TABLE $rules_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT(20) UNSIGNED NOT NULL,
        job_role_id BIGINT(20) UNSIGNED NOT NULL,
        send_notification TINYINT(1) DEFAULT 1,
        created_by BIGINT(20) UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_course_role (course_id, job_role_id),
        KEY idx_course_id (course_id),
        KEY idx_job_role_id (job_role_id)
    ) $charset_collate;";
    dbDelta( $sql_rules );

    // --- Per-user course assignments ---
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $sql_assignments = "CREATE TABLE $assignments_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        course_id BIGINT(20) UNSIGNED NOT NULL,
        user_id BIGINT(20) UNSIGNED NOT NULL,
        rule_id BIGINT(20) UNSIGNED DEFAULT NULL,
        source VARCHAR(20) DEFAULT 'auto',
        source_role_id BIGINT(20) UNSIGNED DEFAULT NULL,
        assigned_by BIGINT(20) UNSIGNED DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'assigned',
        due_date DATETIME DEFAULT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_course_user (course_id, user_id),
        KEY idx_course_id (course_id),
        KEY idx_user_id (user_id),
        KEY idx_rule_id (rule_id),
        KEY idx_status (status)
    ) $charset_collate;";
    dbDelta( $sql_assignments );

    update_option( 'aquaticpro_lms_auto_assign_tables_version', '1.0.0' );
    error_log( '[AquaticPro LMS Auto-Assign] Tables created/updated to version 1.0.0' );
}

add_action( 'init', function () {
    $current = get_option( 'aquaticpro_lms_auto_assign_tables_version', '0' );
    if ( version_compare( $current, '1.0.0', '<' ) ) {
        aquaticpro_lms_auto_assign_create_tables();
    }
} );

// ============================================
// REST API ROUTE REGISTRATION
// ============================================

function aquaticpro_register_lms_auto_assign_routes() {
    $ns = 'aquaticpro/v1';

    // --- Auto-assign rules CRUD ---
    register_rest_route( $ns, '/auto-assign-rules', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_auto_assign_get_rules',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
    ) );

    register_rest_route( $ns, '/auto-assign-rules', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_auto_assign_create_rule',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
        'args' => array(
            'courseId' => array(
                'required'          => true,
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
            'jobRoleId' => array(
                'required'          => true,
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    register_rest_route( $ns, '/auto-assign-rules/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_auto_assign_delete_rule',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // Get rules for a specific course (used by CourseBuilder)
    register_rest_route( $ns, '/auto-assign-rules/course/(?P<courseId>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_auto_assign_get_course_rules',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
        'args' => array(
            'courseId' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // Bulk update rules for a course (set multiple roles at once)
    register_rest_route( $ns, '/auto-assign-rules/course/(?P<courseId>\d+)/bulk', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_auto_assign_bulk_update_course_rules',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
        'args' => array(
            'courseId' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // --- Course assignments for current user ---
    register_rest_route( $ns, '/my-course-assignments', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_auto_assign_my_courses',
        'permission_callback' => function () { return is_user_logged_in(); },
    ) );

    // --- Admin: view all course assignments ---
    register_rest_route( $ns, '/course-assignments', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_auto_assign_get_assignments',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
    ) );

    // --- Admin: manually create course assignments ---
    register_rest_route( $ns, '/course-assignments', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_auto_assign_create_manual_assignment',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
    ) );

    // --- Sync course assignment progress ---
    register_rest_route( $ns, '/course-assignments/sync', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_auto_assign_sync_progress',
        'permission_callback' => function () { return is_user_logged_in(); },
    ) );

    // --- Re-sync: retroactively assign to all current role members for a course ---
    register_rest_route( $ns, '/auto-assign-rules/course/(?P<courseId>\d+)/resync', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_auto_assign_resync_course',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
        'args' => array(
            'courseId' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // --- Admin: course assignment summary (grouped by course) ---
    register_rest_route( $ns, '/course-assignments/summary', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_auto_assign_get_summary',
        'permission_callback' => 'aquaticpro_auto_assign_check_admin',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_lms_auto_assign_routes' );

// ============================================
// PERMISSION CHECK
// ============================================

function aquaticpro_auto_assign_check_admin() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    // Reuse existing LMS edit check (Tier 6+ / WP Admin / LMS editors)
    if ( function_exists( 'aquaticpro_lms_check_can_edit' ) ) {
        return aquaticpro_lms_check_can_edit();
    }
    if ( function_exists( 'mp_is_plugin_admin' ) ) {
        return mp_is_plugin_admin();
    }
    return current_user_can( 'manage_options' );
}

// ============================================
// HELPER: Auto-assign courses to a user for a given role
// Called after a job role is assigned to a user
// ============================================

/**
 * Trigger auto-assignment of courses for a user who just received a job role.
 *
 * @param int $user_id    The WP user ID.
 * @param int $job_role_id The job role ID that was just assigned.
 * @param int $assigned_by The admin user who triggered the assignment (0 for system).
 */
function aquaticpro_auto_assign_courses_for_user( int $user_id, int $job_role_id, int $assigned_by = 0 ) {
    global $wpdb;

    // Skip archived users
    if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( $user_id ) ) {
        return array( 'assigned' => 0, 'skipped' => 0 );
    }

    $rules_table       = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table     = $wpdb->prefix . 'aquaticpro_courses';

    // Find all auto-assign rules for this role
    $rules = $wpdb->get_results( $wpdb->prepare(
        "SELECT r.*, c.title AS course_title, c.status AS course_status
         FROM $rules_table r
         JOIN $courses_table c ON c.id = r.course_id
         WHERE r.job_role_id = %d AND c.status = 'published'",
        $job_role_id
    ) );

    if ( empty( $rules ) ) {
        return array( 'assigned' => 0, 'skipped' => 0 );
    }

    $assigned = 0;
    $skipped  = 0;

    foreach ( $rules as $rule ) {
        // Check if user already has this course assigned
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $assignments_table WHERE course_id = %d AND user_id = %d",
            $rule->course_id, $user_id
        ) );

        if ( $existing ) {
            $skipped++;
            continue;
        }

        // Create the course assignment
        $wpdb->insert( $assignments_table, array(
            'course_id'      => $rule->course_id,
            'user_id'        => $user_id,
            'rule_id'        => $rule->id,
            'source'         => 'auto',
            'source_role_id' => $job_role_id,
            'assigned_by'    => $assigned_by,
            'status'         => 'assigned',
            'assigned_at'    => current_time( 'mysql' ),
            'created_at'     => current_time( 'mysql' ),
            'updated_at'     => current_time( 'mysql' ),
        ), array( '%d', '%d', '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s' ) );

        if ( $wpdb->insert_id ) {
            $assigned++;

            // Optionally send notification email
            if ( $rule->send_notification ) {
                $user = get_userdata( $user_id );
                if ( $user && $user->user_email ) {
                    $first_name = $user->first_name ?: $user->display_name;
                    $site_url   = site_url();
                    $app_page   = get_option( 'aquaticpro_app_page_id', '' );
                    $course_url = $site_url . '/?page_id=' . $app_page . '#learning/course/' . $rule->course_id;

                    $subject = '📚 New Course Assigned: ' . $rule->course_title;
                    $body    = "Hi {$first_name},\n\n"
                             . "You have been automatically assigned a new training course based on your role:\n\n"
                             . "📚 {$rule->course_title}\n\n"
                             . "Start the course here:\n{$course_url}\n\n"
                             . "Regards,\nThe AquaticPro Team";

                    // Queue via existing email queue if available
                    if ( function_exists( 'aquaticpro_lms_queue_email' ) ) {
                        aquaticpro_lms_queue_email( $user_id, 'course_auto_assign', $subject, $body, $rule->course_id );
                    } else {
                        // Fall back to direct wp_mail
                        wp_mail( $user->user_email, $subject, $body, array( 'Content-Type: text/plain; charset=UTF-8' ) );
                    }
                }
            }

            error_log( "[AquaticPro Auto-Assign] Assigned course {$rule->course_id} ({$rule->course_title}) to user {$user_id} via role {$job_role_id}" );
        }
    }

    return array( 'assigned' => $assigned, 'skipped' => $skipped );
}

/**
 * Retroactively assign a course to all current members of a role.
 * Called when a new auto-assign rule is created.
 *
 * @param int $course_id   The course to assign.
 * @param int $job_role_id The role whose members should receive the course.
 * @param int $rule_id     The auto-assign rule ID.
 * @param int $created_by  Admin who created the rule.
 * @param bool $send_notification Whether to send notification emails.
 * @return array { assigned: int, skipped: int }
 */
function aquaticpro_auto_assign_retroactive( int $course_id, int $job_role_id, int $rule_id, int $created_by, bool $send_notification = true ) {
    global $wpdb;

    $pg_assignments = $wpdb->prefix . 'pg_user_job_assignments';
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';

    // Get all users with this role
    $user_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT DISTINCT user_id FROM $pg_assignments WHERE job_role_id = %d",
        $job_role_id
    ) );

    if ( empty( $user_ids ) ) {
        return array( 'assigned' => 0, 'skipped' => 0 );
    }

    $course = $wpdb->get_row( $wpdb->prepare(
        "SELECT title FROM $courses_table WHERE id = %d",
        $course_id
    ) );

    $assigned = 0;
    $skipped  = 0;

    foreach ( $user_ids as $uid ) {
        $uid = (int) $uid;

        // Skip archived users
        if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( $uid ) ) {
            $skipped++;
            continue;
        }

        // Check if already assigned
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $assignments_table WHERE course_id = %d AND user_id = %d",
            $course_id, $uid
        ) );

        if ( $existing ) {
            $skipped++;
            continue;
        }

        $wpdb->insert( $assignments_table, array(
            'course_id'      => $course_id,
            'user_id'        => $uid,
            'rule_id'        => $rule_id,
            'source'         => 'auto',
            'source_role_id' => $job_role_id,
            'assigned_by'    => $created_by,
            'status'         => 'assigned',
            'assigned_at'    => current_time( 'mysql' ),
            'created_at'     => current_time( 'mysql' ),
            'updated_at'     => current_time( 'mysql' ),
        ), array( '%d', '%d', '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s' ) );

        if ( $wpdb->insert_id ) {
            $assigned++;

            if ( $send_notification && $course ) {
                $user = get_userdata( $uid );
                if ( $user && $user->user_email ) {
                    $first_name = $user->first_name ?: $user->display_name;
                    $site_url   = site_url();
                    $app_page   = get_option( 'aquaticpro_app_page_id', '' );
                    $course_url = $site_url . '/?page_id=' . $app_page . '#learning/course/' . $course_id;

                    $subject = '📚 New Course Assigned: ' . $course->title;
                    $body    = "Hi {$first_name},\n\n"
                             . "You have been assigned a new training course:\n\n"
                             . "📚 {$course->title}\n\n"
                             . "Start the course here:\n{$course_url}\n\n"
                             . "Regards,\nThe AquaticPro Team";

                    if ( function_exists( 'aquaticpro_lms_queue_email' ) ) {
                        aquaticpro_lms_queue_email( $uid, 'course_auto_assign', $subject, $body, $course_id );
                    } else {
                        wp_mail( $user->user_email, $subject, $body, array( 'Content-Type: text/plain; charset=UTF-8' ) );
                    }
                }
            }
        }
    }

    error_log( "[AquaticPro Auto-Assign] Retroactive: assigned course {$course_id} to {$assigned} users for role {$job_role_id}, skipped {$skipped}" );
    return array( 'assigned' => $assigned, 'skipped' => $skipped );
}

// ============================================
// CALLBACKS — Auto-Assign Rules
// ============================================

/**
 * GET /auto-assign-rules — list all rules with course+role details
 */
function aquaticpro_auto_assign_get_rules( WP_REST_Request $request ) {
    global $wpdb;

    $rules_table   = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $roles_table   = $wpdb->prefix . 'pg_job_roles';

    $rows = $wpdb->get_results(
        "SELECT r.*, c.title AS course_title, c.status AS course_status,
                jr.title AS role_title
         FROM $rules_table r
         LEFT JOIN $courses_table c ON c.id = r.course_id
         LEFT JOIN $roles_table jr ON jr.id = r.job_role_id
         ORDER BY c.title ASC, jr.title ASC"
    );

    $result = array();
    foreach ( $rows as $row ) {
        $creator = get_userdata( (int) $row->created_by );
        $result[] = array(
            'id'               => (int) $row->id,
            'courseId'         => (int) $row->course_id,
            'courseTitle'      => $row->course_title ?: 'Unknown Course',
            'courseStatus'     => $row->course_status ?: 'unknown',
            'jobRoleId'        => (int) $row->job_role_id,
            'roleTitle'        => $row->role_title ?: 'Unknown Role',
            'sendNotification' => (bool) $row->send_notification,
            'createdBy'        => (int) $row->created_by,
            'createdByName'    => $creator ? $creator->display_name : '',
            'createdAt'        => $row->created_at,
        );
    }

    return rest_ensure_response( $result );
}

/**
 * POST /auto-assign-rules — create a new rule + retroactively assign
 */
function aquaticpro_auto_assign_create_rule( WP_REST_Request $request ) {
    global $wpdb;

    $course_id   = $request->get_param( 'courseId' );
    $job_role_id = $request->get_param( 'jobRoleId' );
    $send_notification = filter_var( $request->get_param( 'sendNotification' ) ?? true, FILTER_VALIDATE_BOOLEAN );
    $retroactive = filter_var( $request->get_param( 'retroactive' ) ?? true, FILTER_VALIDATE_BOOLEAN );

    $rules_table   = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';
    $roles_table   = $wpdb->prefix . 'pg_job_roles';

    // Validate course exists
    $course = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, title FROM $courses_table WHERE id = %d",
        $course_id
    ) );
    if ( ! $course ) {
        return new WP_Error( 'invalid_course', 'Course not found', array( 'status' => 404 ) );
    }

    // Validate role exists
    $role = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, title FROM $roles_table WHERE id = %d",
        $job_role_id
    ) );
    if ( ! $role ) {
        return new WP_Error( 'invalid_role', 'Job role not found', array( 'status' => 404 ) );
    }

    // Check if rule already exists
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $rules_table WHERE course_id = %d AND job_role_id = %d",
        $course_id, $job_role_id
    ) );
    if ( $existing ) {
        return new WP_Error( 'duplicate_rule', 'This course is already auto-assigned to this role', array( 'status' => 409 ) );
    }

    $user_id = get_current_user_id();
    $wpdb->insert( $rules_table, array(
        'course_id'         => $course_id,
        'job_role_id'       => $job_role_id,
        'send_notification' => $send_notification ? 1 : 0,
        'created_by'        => $user_id,
        'created_at'        => current_time( 'mysql' ),
    ), array( '%d', '%d', '%d', '%d', '%s' ) );

    $rule_id = $wpdb->insert_id;
    if ( ! $rule_id ) {
        return new WP_Error( 'db_error', 'Failed to create rule', array( 'status' => 500 ) );
    }

    // Retroactively assign to existing role members
    $retro = array( 'assigned' => 0, 'skipped' => 0 );
    if ( $retroactive ) {
        $retro = aquaticpro_auto_assign_retroactive( $course_id, $job_role_id, $rule_id, $user_id, $send_notification );
    }

    return rest_ensure_response( array(
        'success'     => true,
        'id'          => $rule_id,
        'courseId'    => $course_id,
        'courseTitle' => $course->title,
        'jobRoleId'   => $job_role_id,
        'roleTitle'   => $role->title,
        'retroactive' => $retro,
    ) );
}

/**
 * DELETE /auto-assign-rules/{id}
 */
function aquaticpro_auto_assign_delete_rule( WP_REST_Request $request ) {
    global $wpdb;

    $id          = $request->get_param( 'id' );
    $rules_table = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';

    $existing = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $rules_table WHERE id = %d", $id ) );
    if ( ! $existing ) {
        return new WP_Error( 'not_found', 'Rule not found', array( 'status' => 404 ) );
    }

    $wpdb->delete( $rules_table, array( 'id' => $id ), array( '%d' ) );

    return rest_ensure_response( array( 'deleted' => true, 'id' => (int) $id ) );
}

/**
 * GET /auto-assign-rules/course/{courseId} — rules for a specific course
 */
function aquaticpro_auto_assign_get_course_rules( WP_REST_Request $request ) {
    global $wpdb;

    $course_id   = $request->get_param( 'courseId' );
    $rules_table = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $roles_table = $wpdb->prefix . 'pg_job_roles';

    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT r.*, jr.title AS role_title
         FROM $rules_table r
         LEFT JOIN $roles_table jr ON jr.id = r.job_role_id
         WHERE r.course_id = %d
         ORDER BY jr.title ASC",
        $course_id
    ) );

    $result = array();
    foreach ( $rows as $row ) {
        $result[] = array(
            'id'               => (int) $row->id,
            'courseId'         => (int) $row->course_id,
            'jobRoleId'        => (int) $row->job_role_id,
            'roleTitle'        => $row->role_title ?: 'Unknown Role',
            'sendNotification' => (bool) $row->send_notification,
            'createdAt'        => $row->created_at,
        );
    }

    return rest_ensure_response( $result );
}

/**
 * POST /auto-assign-rules/course/{courseId}/bulk — set roles for a course
 * Body: { roleIds: number[], sendNotification: boolean, retroactive: boolean }
 * Removes rules for roles not in the list, adds rules for new roles.
 */
function aquaticpro_auto_assign_bulk_update_course_rules( WP_REST_Request $request ) {
    global $wpdb;

    $course_id  = $request->get_param( 'courseId' );
    $role_ids   = $request->get_param( 'roleIds' ) ?: array();
    $send_notification = filter_var( $request->get_param( 'sendNotification' ) ?? true, FILTER_VALIDATE_BOOLEAN );
    $retroactive = filter_var( $request->get_param( 'retroactive' ) ?? true, FILTER_VALIDATE_BOOLEAN );

    $rules_table   = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $courses_table = $wpdb->prefix . 'aquaticpro_courses';

    // Validate course exists
    $course = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, title FROM $courses_table WHERE id = %d",
        $course_id
    ) );
    if ( ! $course ) {
        return new WP_Error( 'invalid_course', 'Course not found', array( 'status' => 404 ) );
    }

    $role_ids = array_map( 'absint', $role_ids );
    $user_id  = get_current_user_id();

    // Get current rules for this course
    $current_rules = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, job_role_id FROM $rules_table WHERE course_id = %d",
        $course_id
    ) );
    $current_role_ids = array_map( function ( $r ) { return (int) $r->job_role_id; }, $current_rules );

    // Roles to add (in new list but not in current)
    $to_add = array_diff( $role_ids, $current_role_ids );
    // Roles to remove (in current but not in new list)
    $to_remove = array_diff( $current_role_ids, $role_ids );

    $added   = 0;
    $removed = 0;
    $retro_total = array( 'assigned' => 0, 'skipped' => 0 );

    // Remove rules for roles no longer selected
    foreach ( $current_rules as $rule ) {
        if ( in_array( (int) $rule->job_role_id, $to_remove, true ) ) {
            $wpdb->delete( $rules_table, array( 'id' => $rule->id ), array( '%d' ) );
            $removed++;
        }
    }

    // Add rules for newly selected roles
    foreach ( $to_add as $rid ) {
        $wpdb->insert( $rules_table, array(
            'course_id'         => $course_id,
            'job_role_id'       => $rid,
            'send_notification' => $send_notification ? 1 : 0,
            'created_by'        => $user_id,
            'created_at'        => current_time( 'mysql' ),
        ), array( '%d', '%d', '%d', '%d', '%s' ) );

        $new_rule_id = $wpdb->insert_id;
        if ( $new_rule_id ) {
            $added++;

            // Retroactively assign to existing role members
            if ( $retroactive ) {
                $retro = aquaticpro_auto_assign_retroactive( $course_id, $rid, $new_rule_id, $user_id, $send_notification );
                $retro_total['assigned'] += $retro['assigned'];
                $retro_total['skipped']  += $retro['skipped'];
            }
        }
    }

    return rest_ensure_response( array(
        'success'     => true,
        'added'       => $added,
        'removed'     => $removed,
        'retroactive' => $retro_total,
    ) );
}

// ============================================
// CALLBACKS — Course Assignments
// ============================================

/**
 * GET /my-course-assignments — current user's assigned courses
 */
function aquaticpro_auto_assign_my_courses( WP_REST_Request $request ) {
    global $wpdb;

    $user_id           = get_current_user_id();
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table     = $wpdb->prefix . 'aquaticpro_courses';
    $lessons_table     = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table    = $wpdb->prefix . 'aquaticpro_progress';

    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT ca.*, c.title AS course_title, c.description AS course_description,
                c.featured_image, c.status AS course_status,
                (SELECT COUNT(*) FROM $lessons_table WHERE course_id = c.id) AS total_lessons,
                (SELECT COUNT(*) FROM $progress_table p
                 JOIN $lessons_table l ON l.id = p.lesson_id
                 WHERE l.course_id = c.id AND p.user_id = %d AND p.status = 'completed') AS completed_lessons
         FROM $assignments_table ca
         JOIN $courses_table c ON c.id = ca.course_id
         WHERE ca.user_id = %d AND c.status = 'published'
         ORDER BY ca.assigned_at DESC",
        $user_id, $user_id
    ) );

    $result = array();
    foreach ( $rows as $row ) {
        $total     = (int) $row->total_lessons;
        $completed = (int) $row->completed_lessons;
        $progress  = $total > 0 ? round( ( $completed / $total ) * 100 ) : 0;

        // Auto-update status based on progress
        $computed_status = $row->status;
        if ( $completed > 0 && $completed < $total && $row->status === 'assigned' ) {
            $computed_status = 'in-progress';
            $wpdb->update( $assignments_table,
                array( 'status' => 'in-progress', 'updated_at' => current_time( 'mysql' ) ),
                array( 'id' => $row->id ),
                array( '%s', '%s' ),
                array( '%d' )
            );
        } elseif ( $total > 0 && $completed >= $total && $row->status !== 'completed' ) {
            $computed_status = 'completed';
            $wpdb->update( $assignments_table,
                array( 'status' => 'completed', 'completed_at' => current_time( 'mysql' ), 'updated_at' => current_time( 'mysql' ) ),
                array( 'id' => $row->id ),
                array( '%s', '%s', '%s' ),
                array( '%d' )
            );
        }

        $result[] = array(
            'id'                => (int) $row->id,
            'courseId'          => (int) $row->course_id,
            'courseTitle'       => $row->course_title,
            'courseDescription' => $row->course_description,
            'featuredImage'     => $row->featured_image,
            'source'            => $row->source,
            'status'            => $computed_status,
            'totalLessons'      => $total,
            'completedLessons'  => $completed,
            'progress'          => $progress,
            'dueDate'           => $row->due_date,
            'assignedAt'        => $row->assigned_at,
            'completedAt'       => $row->completed_at,
        );
    }

    return rest_ensure_response( $result );
}

/**
 * GET /course-assignments — admin view of all course assignments (with progress)
 */
function aquaticpro_auto_assign_get_assignments( WP_REST_Request $request ) {
    global $wpdb;

    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table     = $wpdb->prefix . 'aquaticpro_courses';
    $roles_table       = $wpdb->prefix . 'pg_job_roles';
    $lessons_table     = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table    = $wpdb->prefix . 'aquaticpro_progress';

    $course_id = $request->get_param( 'courseId' );
    $role_id   = $request->get_param( 'roleId' );

    $where = array( '1=1' );
    $params = array();

    if ( $course_id ) {
        $where[]  = 'ca.course_id = %d';
        $params[] = absint( $course_id );
    }
    if ( $role_id ) {
        $where[]  = 'ca.source_role_id = %d';
        $params[] = absint( $role_id );
    }

    $where_sql = implode( ' AND ', $where );

    // Include lesson completion counts via correlated subqueries
    $query = "SELECT ca.*, c.title AS course_title,
                     jr.title AS role_title,
                     (SELECT COUNT(*) FROM $lessons_table WHERE course_id = ca.course_id) AS total_lessons,
                     (SELECT COUNT(*) FROM $progress_table p
                      JOIN $lessons_table l ON l.id = p.lesson_id
                      WHERE l.course_id = ca.course_id AND p.user_id = ca.user_id AND p.status = 'completed') AS completed_lessons
              FROM $assignments_table ca
              LEFT JOIN $courses_table c ON c.id = ca.course_id
              LEFT JOIN $roles_table jr ON jr.id = ca.source_role_id
              WHERE $where_sql
              ORDER BY c.title ASC, ca.status ASC, ca.assigned_at DESC
              LIMIT 500";

    $rows = empty( $params )
        ? $wpdb->get_results( $query )
        : $wpdb->get_results( $wpdb->prepare( $query, $params ) );

    $result = array();
    $now    = current_time( 'mysql' );

    foreach ( $rows as $row ) {
        $user  = get_userdata( (int) $row->user_id );
        $total = (int) $row->total_lessons;
        $done  = (int) $row->completed_lessons;
        $pct   = $total > 0 ? round( ( $done / $total ) * 100 ) : 0;

        // Auto-update status in DB if stale
        $computed = $row->status;
        if ( $done > 0 && $done < $total && $row->status === 'assigned' ) {
            $computed = 'in-progress';
            $wpdb->update( $assignments_table,
                array( 'status' => 'in-progress', 'updated_at' => $now ),
                array( 'id' => $row->id ), array( '%s', '%s' ), array( '%d' ) );
        } elseif ( $total > 0 && $done >= $total && $row->status !== 'completed' ) {
            $computed = 'completed';
            $wpdb->update( $assignments_table,
                array( 'status' => 'completed', 'completed_at' => $now, 'updated_at' => $now ),
                array( 'id' => $row->id ), array( '%s', '%s', '%s' ), array( '%d' ) );
        }

        $result[] = array(
            'id'               => (int) $row->id,
            'courseId'         => (int) $row->course_id,
            'courseTitle'      => $row->course_title ?: '',
            'userId'           => (int) $row->user_id,
            'userName'         => $user ? $user->display_name : 'Unknown',
            'userEmail'        => $user ? $user->user_email : '',
            'source'           => $row->source,
            'sourceRoleId'     => $row->source_role_id ? (int) $row->source_role_id : null,
            'roleTitle'        => $row->role_title ?: '',
            'status'           => $computed,
            'totalLessons'     => $total,
            'completedLessons' => $done,
            'progress'         => $pct,
            'dueDate'          => $row->due_date,
            'assignedAt'       => $row->assigned_at,
            'completedAt'      => $row->completed_at,
        );
    }

    return rest_ensure_response( $result );
}

/**
 * POST /course-assignments/sync — sync progress for all of current user's course assignments
 */
function aquaticpro_auto_assign_sync_progress( WP_REST_Request $request ) {
    global $wpdb;

    $user_id           = get_current_user_id();
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $lessons_table     = $wpdb->prefix . 'aquaticpro_lessons';
    $progress_table    = $wpdb->prefix . 'aquaticpro_progress';

    $assignments = $wpdb->get_results( $wpdb->prepare(
        "SELECT ca.id, ca.course_id, ca.status
         FROM $assignments_table ca
         WHERE ca.user_id = %d AND ca.status != 'completed'",
        $user_id
    ) );

    $updated = 0;
    $now     = current_time( 'mysql' );

    foreach ( $assignments as $a ) {
        $total_lessons = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $lessons_table WHERE course_id = %d",
            $a->course_id
        ) );

        $completed_lessons = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $progress_table p
             JOIN $lessons_table l ON l.id = p.lesson_id
             WHERE l.course_id = %d AND p.user_id = %d AND p.status = 'completed'",
            $a->course_id, $user_id
        ) );

        $new_status = $a->status;
        if ( $total_lessons > 0 && $completed_lessons >= $total_lessons ) {
            $new_status = 'completed';
        } elseif ( $completed_lessons > 0 ) {
            $new_status = 'in-progress';
        }

        if ( $new_status !== $a->status ) {
            $update_data = array( 'status' => $new_status, 'updated_at' => $now );
            $update_fmt  = array( '%s', '%s' );
            if ( $new_status === 'completed' ) {
                $update_data['completed_at'] = $now;
                $update_fmt[] = '%s';
            }
            $wpdb->update( $assignments_table, $update_data, array( 'id' => $a->id ), $update_fmt, array( '%d' ) );
            $updated++;
        }
    }

    return rest_ensure_response( array( 'synced' => $updated ) );
}

// ============================================
// RE-SYNC: Retroactively assign to all current role members
// ============================================

/**
 * POST /auto-assign-rules/course/{courseId}/resync
 *
 * Re-runs retroactive assignment for ALL rules of the given course.
 * Safe to call multiple times — skips users who already have a record.
 */
function aquaticpro_auto_assign_resync_course( WP_REST_Request $request ) {
    global $wpdb;

    $course_id   = $request->get_param( 'courseId' );
    $rules_table = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $user_id     = get_current_user_id();

    $rules = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM $rules_table WHERE course_id = %d",
        $course_id
    ) );

    if ( empty( $rules ) ) {
        return new WP_Error( 'no_rules', 'No auto-assign rules found for this course', array( 'status' => 404 ) );
    }

    $total = array( 'assigned' => 0, 'skipped' => 0 );

    foreach ( $rules as $rule ) {
        $result = aquaticpro_auto_assign_retroactive(
            $course_id,
            (int) $rule->job_role_id,
            (int) $rule->id,
            $user_id,
            (bool) $rule->send_notification
        );
        $total['assigned'] += $result['assigned'];
        $total['skipped']  += $result['skipped'];
    }

    error_log( "[AquaticPro Auto-Assign] Resync for course {$course_id}: assigned {$total['assigned']}, skipped {$total['skipped']}" );

    return rest_ensure_response( array(
        'success'  => true,
        'courseId'  => (int) $course_id,
        'assigned' => $total['assigned'],
        'skipped'  => $total['skipped'],
    ) );
}

// ============================================
// SUMMARY: Grouped course assignment stats
// ============================================

/**
 * GET /course-assignments/summary — Per-course summary for the admin dashboard
 */
function aquaticpro_auto_assign_get_summary( WP_REST_Request $request ) {
    global $wpdb;

    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table     = $wpdb->prefix . 'aquaticpro_courses';
    $rules_table       = $wpdb->prefix . 'aquaticpro_course_auto_assign_rules';
    $roles_table       = $wpdb->prefix . 'pg_job_roles';
    $lessons_table     = $wpdb->prefix . 'aquaticpro_lessons';

    // Courses that have at least one auto-assign rule OR at least one assignment
    $rows = $wpdb->get_results(
        "SELECT c.id, c.title, c.status,
                (SELECT COUNT(*) FROM $assignments_table WHERE course_id = c.id) AS total_assigned,
                (SELECT COUNT(*) FROM $assignments_table WHERE course_id = c.id AND status = 'completed') AS total_completed,
                (SELECT COUNT(*) FROM $assignments_table WHERE course_id = c.id AND status = 'in-progress') AS total_in_progress,
                (SELECT COUNT(*) FROM $lessons_table WHERE course_id = c.id) AS lesson_count,
                (SELECT GROUP_CONCAT(DISTINCT jr.title SEPARATOR ', ')
                 FROM $rules_table r JOIN $roles_table jr ON jr.id = r.job_role_id
                 WHERE r.course_id = c.id) AS assigned_roles
         FROM $courses_table c
         WHERE c.id IN (
             SELECT DISTINCT course_id FROM $rules_table
             UNION
             SELECT DISTINCT course_id FROM $assignments_table
         )
         ORDER BY c.title ASC"
    );

    $result = array();
    foreach ( $rows as $row ) {
        $total    = (int) $row->total_assigned;
        $complete = (int) $row->total_completed;
        $result[] = array(
            'courseId'        => (int) $row->id,
            'courseTitle'     => $row->title,
            'courseStatus'    => $row->status,
            'lessonCount'    => (int) $row->lesson_count,
            'totalAssigned'  => $total,
            'totalCompleted' => $complete,
            'totalInProgress' => (int) $row->total_in_progress,
            'totalNotStarted' => $total - $complete - (int) $row->total_in_progress,
            'completionRate'  => $total > 0 ? round( ( $complete / $total ) * 100, 1 ) : 0,
            'assignedRoles'   => $row->assigned_roles ?: '',
        );
    }

    return rest_ensure_response( $result );
}

/**
 * POST /course-assignments — manually assign a course to specific users/roles.
 * Body: { courseId: int, userIds?: int[], jobRoleIds?: int[], sendNotification?: bool }
 */
function aquaticpro_auto_assign_create_manual_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'aquaticpro_course_assignments';
    $courses_table     = $wpdb->prefix . 'aquaticpro_courses';

    $course_id         = (int) $request->get_param( 'courseId' );
    $user_ids          = $request->get_param( 'userIds' ) ?: array();
    $job_role_ids      = $request->get_param( 'jobRoleIds' ) ?: array();
    $send_notification = (bool) ( $request->get_param( 'sendNotification' ) ?? true );
    $assigned_by       = get_current_user_id();
    $now               = current_time( 'mysql' );

    if ( ! $course_id ) {
        return new WP_Error( 'missing_course', 'Course ID is required.', array( 'status' => 400 ) );
    }

    // Verify course exists
    $course = $wpdb->get_row( $wpdb->prepare(
        "SELECT id, title FROM $courses_table WHERE id = %d", $course_id
    ) );
    if ( ! $course ) {
        return new WP_Error( 'invalid_course', 'Course not found.', array( 'status' => 404 ) );
    }

    // Resolve role members into user IDs
    $resolved_user_ids = array_map( 'intval', (array) $user_ids );
    foreach ( (array) $job_role_ids as $role_id ) {
        $role_id = (int) $role_id;
        if ( ! $role_id ) continue;
        $members = $wpdb->get_col( $wpdb->prepare(
            "SELECT user_id FROM {$wpdb->prefix}aquaticpro_user_job_roles WHERE job_role_id = %d",
            $role_id
        ) );
        foreach ( $members as $uid ) {
            $resolved_user_ids[] = (int) $uid;
        }
    }
    $resolved_user_ids = array_unique( array_filter( $resolved_user_ids ) );

    if ( empty( $resolved_user_ids ) ) {
        return new WP_Error( 'no_users', 'No users specified or found in the selected roles.', array( 'status' => 400 ) );
    }

    $assigned = 0;
    $skipped  = 0;

    foreach ( $resolved_user_ids as $uid ) {
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $assignments_table WHERE course_id = %d AND user_id = %d",
            $course_id, $uid
        ) );
        if ( $existing ) {
            $skipped++;
            continue;
        }

        $wpdb->insert( $assignments_table, array(
            'course_id'      => $course_id,
            'user_id'        => $uid,
            'rule_id'        => 0,
            'source'         => 'manual',
            'source_role_id' => 0,
            'assigned_by'    => $assigned_by,
            'status'         => 'assigned',
            'assigned_at'    => $now,
            'created_at'     => $now,
            'updated_at'     => $now,
        ), array( '%d', '%d', '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s' ) );

        if ( $wpdb->insert_id ) {
            $assigned++;

            if ( $send_notification ) {
                $user = get_userdata( $uid );
                if ( $user && $user->user_email ) {
                    $first_name = $user->first_name ?: $user->display_name;
                    $site_url   = site_url();
                    $app_page   = get_option( 'aquaticpro_app_page_id', '' );
                    $course_url = $site_url . '/?page_id=' . $app_page . '#learning/course/' . $course_id;

                    $subject = '📚 New Course Assigned: ' . $course->title;
                    $body    = "Hi {$first_name},\n\n"
                             . "You have been assigned a training course:\n\n"
                             . "📚 {$course->title}\n\n"
                             . "Start the course here:\n{$course_url}\n\n"
                             . "Regards,\nThe AquaticPro Team";

                    if ( function_exists( 'aquaticpro_lms_queue_email' ) ) {
                        aquaticpro_lms_queue_email( $uid, 'course_manual_assign', $subject, $body, $course_id );
                    } else {
                        wp_mail( $user->user_email, $subject, $body, array( 'Content-Type: text/plain; charset=UTF-8' ) );
                    }
                }
            }
        }
    }

    return rest_ensure_response( array(
        'success'  => true,
        'courseId'  => $course_id,
        'assigned' => $assigned,
        'skipped'  => $skipped,
    ) );
}
