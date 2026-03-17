<?php
/**
 * AquaticPro LMS — Assigned Learning API Routes
 *
 * Enables learning editors to assign lessons to users/roles, send
 * notification emails in batches, track completion & quiz scores,
 * and optionally create TaskDeck cards for deadline tracking.
 *
 * Tables created:
 *   - aquaticpro_learning_assignments
 *   - aquaticpro_learning_assignment_users
 *   - aquaticpro_email_queue
 *
 * @package AquaticPro
 * @subpackage LMS
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

// ============================================
// TABLE CREATION
// ============================================

function aquaticpro_lms_assignments_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    // --- Assignments (the "campaign") ---
    $assignments_table = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $sql_assignments = "CREATE TABLE $assignments_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        lesson_id BIGINT(20) UNSIGNED NOT NULL,
        assigned_by BIGINT(20) UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATETIME DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        taskdeck_card_id BIGINT(20) UNSIGNED DEFAULT NULL,
        reminder_sent_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_lesson_id (lesson_id),
        KEY idx_assigned_by (assigned_by),
        KEY idx_status (status),
        KEY idx_due_date (due_date)
    ) $charset_collate;";
    dbDelta( $sql_assignments );

    // --- Per-user assignment rows ---
    $users_table = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $sql_users = "CREATE TABLE $users_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        assignment_id BIGINT(20) UNSIGNED NOT NULL,
        user_id BIGINT(20) UNSIGNED NOT NULL,
        source VARCHAR(20) DEFAULT 'direct',
        source_role_id BIGINT(20) UNSIGNED DEFAULT NULL,
        email_sent_at DATETIME DEFAULT NULL,
        email_status VARCHAR(20) DEFAULT 'pending',
        reminder_sent_at DATETIME DEFAULT NULL,
        progress_status VARCHAR(20) DEFAULT 'not-started',
        quiz_score FLOAT DEFAULT NULL,
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assignment_user (assignment_id, user_id),
        KEY idx_assignment_id (assignment_id),
        KEY idx_user_id (user_id),
        KEY idx_progress_status (progress_status),
        KEY idx_email_status (email_status)
    ) $charset_collate;";
    dbDelta( $sql_users );

    // --- Email queue (generic, batch-processed) ---
    $email_table = $wpdb->prefix . 'aquaticpro_email_queue';
    $sql_email = "CREATE TABLE $email_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT(20) UNSIGNED NOT NULL,
        email_type VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body LONGTEXT NOT NULL,
        context_id BIGINT(20) UNSIGNED DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        attempts TINYINT DEFAULT 0,
        sent_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_status (status),
        KEY idx_email_type (email_type)
    ) $charset_collate;";
    dbDelta( $sql_email );

    update_option( 'aquaticpro_lms_assignments_tables_version', '1.0.0' );
    error_log( '[AquaticPro LMS Assignments] Tables created/updated to version 1.0.0' );
}

// Run table creation on init (version-gated)
add_action( 'init', function () {
    $current = get_option( 'aquaticpro_lms_assignments_tables_version', '0' );
    if ( version_compare( $current, '1.0.0', '<' ) ) {
        aquaticpro_lms_assignments_create_tables();
    }
} );

// ============================================
// REST API ROUTE REGISTRATION
// ============================================

function aquaticpro_register_lms_assignment_routes() {
    $ns = 'aquaticpro/v1';

    // --- CRUD ---
    register_rest_route( $ns, '/learning-assignments', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_assignments',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
    ) );

    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    register_rest_route( $ns, '/learning-assignments', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_create_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'lessonId' => array(
                'required' => true,
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
            'title' => array(
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ) );

    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_lms_update_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_lms_delete_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // --- Actions ---
    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)/send', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_send_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)/remind', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_lms_remind_assignment',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // --- Progress detail ---
    register_rest_route( $ns, '/learning-assignments/(?P<id>\d+)/progress', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_assignment_progress',
        'permission_callback' => 'aquaticpro_lms_check_can_edit',
        'args' => array(
            'id' => array(
                'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    // --- Staff: my pending assignments ---
    register_rest_route( $ns, '/my-assignments', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_lms_get_my_assignments',
        'permission_callback' => function () { return is_user_logged_in(); },
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_lms_assignment_routes' );

// ============================================
// HELPERS
// ============================================

/**
 * Resolve job role IDs → array of active (non-archived) WP user IDs
 */
function aquaticpro_lms_resolve_role_users( array $role_ids ) {
    global $wpdb;
    if ( empty( $role_ids ) ) {
        return array();
    }

    $assignments_tbl = $wpdb->prefix . 'pg_user_job_assignments';
    $placeholders    = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
    $user_ids        = $wpdb->get_col( $wpdb->prepare(
        "SELECT DISTINCT user_id FROM $assignments_tbl WHERE job_role_id IN ($placeholders)",
        $role_ids
    ) );

    // Filter out archived users
    $active = array();
    foreach ( $user_ids as $uid ) {
        if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $uid ) ) {
            continue;
        }
        $active[] = (int) $uid;
    }
    return $active;
}

/**
 * Queue a single email into the email queue table
 */
function aquaticpro_lms_queue_email( int $user_id, string $type, string $subject, string $body, int $context_id = 0 ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_queue';
    $wpdb->insert(
        $table,
        array(
            'user_id'    => $user_id,
            'email_type' => $type,
            'subject'    => $subject,
            'body'       => $body,
            'context_id' => $context_id,
            'status'     => 'pending',
            'created_at' => current_time( 'mysql' ),
        ),
        array( '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
    );
}

/**
 * Build the HTML email body for an assignment notification.
 */
function aquaticpro_lms_build_assignment_email( $assignment, $user, $type = 'assignment' ) {
    $site_url   = site_url();
    $lesson_url = $site_url . '/?page_id=' . get_option( 'aquaticpro_app_page_id', '' )
                . '#learning/lesson/' . $assignment->lesson_id
                . '?assignment=' . $assignment->id;

    $first_name = $user->first_name ?: $user->display_name;
    $due_str    = $assignment->due_date
                ? wp_date( 'F j, Y', strtotime( $assignment->due_date ) )
                : 'No due date';

    if ( $type === 'reminder' ) {
        $subject = '⏰ Reminder: ' . $assignment->title . ' — due ' . $due_str;
        $body    = "Hi {$first_name},\n\n"
                 . "This is a reminder that you have an outstanding training assignment:\n\n"
                 . "📚 {$assignment->title}\n"
                 . ( $assignment->description ? $assignment->description . "\n\n" : "\n" )
                 . "📅 Due: {$due_str}\n\n"
                 . "Complete it here:\n{$lesson_url}\n\n"
                 . "Regards,\nThe AquaticPro Team";
    } else {
        $subject = '📚 New Training Assigned: ' . $assignment->title;
        $body    = "Hi {$first_name},\n\n"
                 . "You have been assigned a new training lesson:\n\n"
                 . "📚 {$assignment->title}\n"
                 . ( $assignment->description ? $assignment->description . "\n\n" : "\n" )
                 . "📅 Due: {$due_str}\n\n"
                 . "Start the lesson here:\n{$lesson_url}\n\n"
                 . "Regards,\nThe AquaticPro Team";
    }

    return array( 'subject' => $subject, 'body' => $body );
}

/**
 * Sync progress from aquaticpro_progress → assignment_users rows for one assignment
 */
function aquaticpro_lms_sync_assignment_progress( int $assignment_id ) {
    global $wpdb;
    $au_table       = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $progress_table = $wpdb->prefix . 'aquaticpro_progress';
    $assign_table   = $wpdb->prefix . 'aquaticpro_learning_assignments';

    $assignment = $wpdb->get_row( $wpdb->prepare(
        "SELECT lesson_id FROM $assign_table WHERE id = %d", $assignment_id
    ) );
    if ( ! $assignment ) {
        return;
    }

    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT au.id AS au_id, au.user_id, au.progress_status,
                p.status AS p_status, p.score AS p_score, p.completed_at AS p_completed, p.last_viewed AS p_last_viewed
         FROM $au_table au
         LEFT JOIN $progress_table p ON p.user_id = au.user_id AND p.lesson_id = %d
         WHERE au.assignment_id = %d",
        $assignment->lesson_id,
        $assignment_id
    ) );

    $now = current_time( 'mysql' );
    foreach ( $rows as $row ) {
        $updates = array();
        $formats = array();

        if ( $row->p_status === 'completed' && $row->progress_status !== 'completed' ) {
            $updates['progress_status'] = 'completed';
            $updates['completed_at']    = $row->p_completed ?: $now;
            $updates['quiz_score']      = (float) $row->p_score;
            $formats = array( '%s', '%s', '%f' );
        } elseif ( $row->p_status === 'in-progress' && $row->progress_status === 'not-started' ) {
            $updates['progress_status'] = 'in-progress';
            $updates['started_at']      = $row->p_last_viewed ?: $now;
            $formats = array( '%s', '%s' );
        }

        if ( ! empty( $updates ) ) {
            $updates['updated_at'] = $now;
            $formats[] = '%s';
            $wpdb->update( $au_table, $updates, array( 'id' => $row->au_id ), $formats, array( '%d' ) );
        }
    }
}

// ============================================
// CALLBACKS — Assignment CRUD
// ============================================

/**
 * GET /learning-assignments — list all (filterable by status)
 */
function aquaticpro_lms_get_assignments( WP_REST_Request $request ) {
    global $wpdb;
    $table   = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $au      = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $lessons = $wpdb->prefix . 'aquaticpro_lessons';

    $status_filter = '';
    $status = $request->get_param( 'status' );
    if ( $status && in_array( $status, array( 'draft', 'active', 'closed' ), true ) ) {
        $status_filter = $wpdb->prepare( ' WHERE a.status = %s', $status );
    }

    $rows = $wpdb->get_results(
        "SELECT a.*,
                l.title AS lesson_title,
                l.lesson_type,
                (SELECT COUNT(*) FROM $au WHERE assignment_id = a.id) AS total_users,
                (SELECT COUNT(*) FROM $au WHERE assignment_id = a.id AND progress_status = 'completed') AS completed_users,
                (SELECT COUNT(*) FROM $au WHERE assignment_id = a.id AND email_status = 'sent') AS emails_sent
         FROM $table a
         LEFT JOIN $lessons l ON l.id = a.lesson_id
         $status_filter
         ORDER BY a.created_at DESC"
    );

    $result = array();
    foreach ( $rows as $row ) {
        $creator = get_userdata( (int) $row->assigned_by );
        $result[] = array(
            'id'             => (int) $row->id,
            'lessonId'       => (int) $row->lesson_id,
            'lessonTitle'    => $row->lesson_title ?: '',
            'lessonType'     => $row->lesson_type ?: '',
            'assignedBy'     => (int) $row->assigned_by,
            'assignedByName' => $creator ? $creator->display_name : '',
            'title'          => $row->title,
            'description'    => $row->description,
            'dueDate'        => $row->due_date,
            'status'         => $row->status,
            'taskDeckCardId' => $row->taskdeck_card_id ? (int) $row->taskdeck_card_id : null,
            'reminderSentAt' => $row->reminder_sent_at,
            'totalUsers'     => (int) $row->total_users,
            'completedUsers' => (int) $row->completed_users,
            'emailsSent'     => (int) $row->emails_sent,
            'createdAt'      => $row->created_at,
            'updatedAt'      => $row->updated_at,
        );
    }

    return rest_ensure_response( $result );
}

/**
 * GET /learning-assignments/{id} — single assignment with user rows
 */
function aquaticpro_lms_get_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $id    = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_learning_assignments';

    $assignment = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'Assignment not found', array( 'status' => 404 ) );
    }

    // Sync progress
    aquaticpro_lms_sync_assignment_progress( $id );

    $au      = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $lessons = $wpdb->prefix . 'aquaticpro_lessons';

    $lesson = $wpdb->get_row( $wpdb->prepare( "SELECT title, lesson_type FROM $lessons WHERE id = %d", $assignment->lesson_id ) );
    $users  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $au WHERE assignment_id = %d ORDER BY created_at ASC", $id ) );

    $user_data = array();
    foreach ( $users as $u ) {
        $wp_user = get_userdata( (int) $u->user_id );
        $user_data[] = array(
            'id'             => (int) $u->id,
            'userId'         => (int) $u->user_id,
            'userName'       => $wp_user ? $wp_user->display_name : 'Unknown',
            'userEmail'      => $wp_user ? $wp_user->user_email : '',
            'source'         => $u->source,
            'sourceRoleId'   => $u->source_role_id ? (int) $u->source_role_id : null,
            'emailStatus'    => $u->email_status,
            'emailSentAt'    => $u->email_sent_at,
            'reminderSentAt' => $u->reminder_sent_at,
            'progressStatus' => $u->progress_status,
            'quizScore'      => $u->quiz_score !== null ? (float) $u->quiz_score : null,
            'startedAt'      => $u->started_at,
            'completedAt'    => $u->completed_at,
        );
    }

    $creator = get_userdata( (int) $assignment->assigned_by );
    $data    = array(
        'id'             => (int) $assignment->id,
        'lessonId'       => (int) $assignment->lesson_id,
        'lessonTitle'    => $lesson ? $lesson->title : '',
        'lessonType'     => $lesson ? $lesson->lesson_type : '',
        'assignedBy'     => (int) $assignment->assigned_by,
        'assignedByName' => $creator ? $creator->display_name : '',
        'title'          => $assignment->title,
        'description'    => $assignment->description,
        'dueDate'        => $assignment->due_date,
        'status'         => $assignment->status,
        'taskDeckCardId' => $assignment->taskdeck_card_id ? (int) $assignment->taskdeck_card_id : null,
        'reminderSentAt' => $assignment->reminder_sent_at,
        'users'          => $user_data,
        'createdAt'      => $assignment->created_at,
        'updatedAt'      => $assignment->updated_at,
    );

    return rest_ensure_response( $data );
}

/**
 * POST /learning-assignments — create a draft assignment
 */
function aquaticpro_lms_create_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $table   = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $user_id = get_current_user_id();

    $lesson_id   = $request->get_param( 'lessonId' );
    $title       = $request->get_param( 'title' );
    $description = $request->get_param( 'description' ) ?: '';
    $due_date    = $request->get_param( 'dueDate' );

    // Validate lesson exists
    $lessons_table = $wpdb->prefix . 'aquaticpro_lessons';
    $lesson = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $lessons_table WHERE id = %d", $lesson_id ) );
    if ( ! $lesson ) {
        return new WP_Error( 'invalid_lesson', 'Lesson not found', array( 'status' => 400 ) );
    }

    $now = current_time( 'mysql' );
    $wpdb->insert(
        $table,
        array(
            'lesson_id'   => $lesson_id,
            'assigned_by' => $user_id,
            'title'       => $title,
            'description' => $description,
            'due_date'    => $due_date ?: null,
            'status'      => 'draft',
            'created_at'  => $now,
            'updated_at'  => $now,
        ),
        array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
    );

    if ( ! $wpdb->insert_id ) {
        return new WP_Error( 'db_error', 'Failed to create assignment', array( 'status' => 500 ) );
    }

    return rest_ensure_response( array(
        'id'        => $wpdb->insert_id,
        'lessonId'  => $lesson_id,
        'title'     => $title,
        'status'    => 'draft',
        'createdAt' => $now,
    ) );
}

/**
 * PUT /learning-assignments/{id} — update title / description / due date / status
 */
function aquaticpro_lms_update_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $id    = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_learning_assignments';

    $existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
    if ( ! $existing ) {
        return new WP_Error( 'not_found', 'Assignment not found', array( 'status' => 404 ) );
    }

    $updates = array();
    $formats = array();

    $fields = array(
        'title'       => '%s',
        'description' => '%s',
        'dueDate'     => '%s',
        'status'      => '%s',
        'lessonId'    => '%d',
    );

    $db_map = array(
        'title'       => 'title',
        'description' => 'description',
        'dueDate'     => 'due_date',
        'status'      => 'status',
        'lessonId'    => 'lesson_id',
    );

    foreach ( $fields as $param => $fmt ) {
        $val = $request->get_param( $param );
        if ( $val !== null ) {
            $updates[ $db_map[ $param ] ] = $param === 'title' ? sanitize_text_field( $val ) : $val;
            $formats[] = $fmt;
        }
    }

    if ( empty( $updates ) ) {
        return new WP_Error( 'no_changes', 'No fields to update', array( 'status' => 400 ) );
    }

    $updates['updated_at'] = current_time( 'mysql' );
    $formats[] = '%s';

    $wpdb->update( $table, $updates, array( 'id' => $id ), $formats, array( '%d' ) );

    return rest_ensure_response( array( 'success' => true, 'id' => (int) $id ) );
}

/**
 * DELETE /learning-assignments/{id}
 */
function aquaticpro_lms_delete_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $id       = $request->get_param( 'id' );
    $table    = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $au_table = $wpdb->prefix . 'aquaticpro_learning_assignment_users';

    $existing = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $table WHERE id = %d", $id ) );
    if ( ! $existing ) {
        return new WP_Error( 'not_found', 'Assignment not found', array( 'status' => 404 ) );
    }

    // Delete user rows first
    $wpdb->delete( $au_table, array( 'assignment_id' => $id ), array( '%d' ) );
    $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );

    return rest_ensure_response( array( 'deleted' => true, 'id' => (int) $id ) );
}

// ============================================
// CALLBACKS — Send / Remind
// ============================================

/**
 * POST /learning-assignments/{id}/send
 *
 * Resolves recipients, creates user rows, queues emails, optionally creates a TaskDeck card.
 */
function aquaticpro_lms_send_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $id    = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_learning_assignments';

    $assignment = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'Assignment not found', array( 'status' => 404 ) );
    }

    $job_role_ids          = $request->get_param( 'jobRoleIds' ) ?: array();
    $user_ids              = $request->get_param( 'userIds' ) ?: array();

    // Resolve role-based users
    $role_users = array();
    if ( ! empty( $job_role_ids ) ) {
        $role_users = aquaticpro_lms_resolve_role_users( array_map( 'absint', $job_role_ids ) );
    }

    // Merge + deduplicate
    $all_user_ids = array_unique( array_merge(
        $role_users,
        array_map( 'absint', $user_ids )
    ) );

    // Filter out archived
    $all_user_ids = array_filter( $all_user_ids, function ( $uid ) {
        if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( $uid ) ) {
            return false;
        }
        return true;
    } );

    if ( empty( $all_user_ids ) ) {
        return new WP_Error( 'no_recipients', 'No active recipients found', array( 'status' => 400 ) );
    }

    $au_table    = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $role_lookup = array_flip( $role_users ); // uid → exists in role set
    $inserted    = 0;

    foreach ( $all_user_ids as $uid ) {
        $source    = isset( $role_lookup[ $uid ] ) ? 'role' : 'direct';
        $source_role = null;
        if ( $source === 'role' && ! empty( $job_role_ids ) ) {
            // Find which role this user belongs to (first match)
            $assignments_tbl = $wpdb->prefix . 'pg_user_job_assignments';
            $placeholders    = implode( ',', array_fill( 0, count( $job_role_ids ), '%d' ) );
            $source_role     = $wpdb->get_var( $wpdb->prepare(
                "SELECT job_role_id FROM $assignments_tbl WHERE user_id = %d AND job_role_id IN ($placeholders) LIMIT 1",
                array_merge( array( $uid ), array_map( 'absint', $job_role_ids ) )
            ) );
        }

        // Upsert (skip if row already exists)
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $au_table WHERE assignment_id = %d AND user_id = %d",
            $id, $uid
        ) );
        if ( $exists ) {
            continue;
        }

        $wpdb->insert( $au_table, array(
            'assignment_id'   => $id,
            'user_id'         => $uid,
            'source'          => $source,
            'source_role_id'  => $source_role,
            'email_status'    => 'pending',
            'progress_status' => 'not-started',
            'created_at'      => current_time( 'mysql' ),
            'updated_at'      => current_time( 'mysql' ),
        ), array( '%d', '%d', '%s', '%d', '%s', '%s', '%s', '%s' ) );
        $inserted++;
    }

    // Queue emails for all pending users
    $pending = $wpdb->get_results( $wpdb->prepare(
        "SELECT au.user_id FROM $au_table au WHERE au.assignment_id = %d AND au.email_status = 'pending'",
        $id
    ) );

    foreach ( $pending as $row ) {
        $wp_user = get_userdata( (int) $row->user_id );
        if ( ! $wp_user ) {
            continue;
        }
        $email = aquaticpro_lms_build_assignment_email( $assignment, $wp_user, 'assignment' );
        aquaticpro_lms_queue_email( (int) $row->user_id, 'learning_assignment', $email['subject'], $email['body'], $id );
    }

    // Mark assignment as active
    $wpdb->update( $table, array(
        'status'     => 'active',
        'updated_at' => current_time( 'mysql' ),
    ), array( 'id' => $id ), array( '%s', '%s' ), array( '%d' ) );

    return rest_ensure_response( array(
        'success'        => true,
        'assignmentId'   => (int) $id,
        'recipientCount' => count( $all_user_ids ),
        'newRecipients'  => $inserted,
        'emailsQueued'   => count( $pending ),
    ) );
}

/**
 * POST /learning-assignments/{id}/remind
 *
 * Send reminder to all incomplete users
 */
function aquaticpro_lms_remind_assignment( WP_REST_Request $request ) {
    global $wpdb;
    $id    = $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_learning_assignments';

    $assignment = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
    if ( ! $assignment ) {
        return new WP_Error( 'not_found', 'Assignment not found', array( 'status' => 404 ) );
    }

    // Sync progress first
    aquaticpro_lms_sync_assignment_progress( $id );

    $au_table = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $incomplete = $wpdb->get_results( $wpdb->prepare(
        "SELECT user_id FROM $au_table WHERE assignment_id = %d AND progress_status != 'completed'",
        $id
    ) );

    $queued = 0;
    foreach ( $incomplete as $row ) {
        $wp_user = get_userdata( (int) $row->user_id );
        if ( ! $wp_user ) {
            continue;
        }
        $email = aquaticpro_lms_build_assignment_email( $assignment, $wp_user, 'reminder' );
        aquaticpro_lms_queue_email( (int) $row->user_id, 'learning_reminder', $email['subject'], $email['body'], $id );

        $wpdb->update( $au_table, array(
            'reminder_sent_at' => current_time( 'mysql' ),
        ), array(
            'assignment_id' => $id,
            'user_id'       => (int) $row->user_id,
        ), array( '%s' ), array( '%d', '%d' ) );

        $queued++;
    }

    $wpdb->update( $table, array(
        'reminder_sent_at' => current_time( 'mysql' ),
        'updated_at'       => current_time( 'mysql' ),
    ), array( 'id' => $id ), array( '%s', '%s' ), array( '%d' ) );

    return rest_ensure_response( array(
        'success'       => true,
        'assignmentId'  => (int) $id,
        'remindersQueued' => $queued,
    ) );
}

// ============================================
// CALLBACKS — Progress / My Assignments
// ============================================

/**
 * GET /learning-assignments/{id}/progress
 */
function aquaticpro_lms_get_assignment_progress( WP_REST_Request $request ) {
    global $wpdb;
    $id = $request->get_param( 'id' );

    // Sync progress from the LMS progress table
    aquaticpro_lms_sync_assignment_progress( $id );

    $au_table = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $users    = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM $au_table WHERE assignment_id = %d ORDER BY created_at ASC",
        $id
    ) );

    $data = array();
    foreach ( $users as $u ) {
        $wp_user = get_userdata( (int) $u->user_id );
        $data[]  = array(
            'userId'         => (int) $u->user_id,
            'userName'       => $wp_user ? $wp_user->display_name : 'Unknown',
            'userEmail'      => $wp_user ? $wp_user->user_email : '',
            'source'         => $u->source,
            'sourceRoleId'   => $u->source_role_id ? (int) $u->source_role_id : null,
            'emailStatus'    => $u->email_status,
            'emailSentAt'    => $u->email_sent_at,
            'reminderSentAt' => $u->reminder_sent_at,
            'progressStatus' => $u->progress_status,
            'quizScore'      => $u->quiz_score !== null ? (float) $u->quiz_score : null,
            'startedAt'      => $u->started_at,
            'completedAt'    => $u->completed_at,
        );
    }

    // Summary
    $total     = count( $data );
    $completed = count( array_filter( $data, fn( $d ) => $d['progressStatus'] === 'completed' ) );
    $started   = count( array_filter( $data, fn( $d ) => $d['progressStatus'] === 'in-progress' ) );

    return rest_ensure_response( array(
        'assignmentId' => (int) $id,
        'summary'      => array(
            'total'     => $total,
            'completed' => $completed,
            'started'   => $started,
            'notStarted' => $total - $completed - $started,
            'completionRate' => $total > 0 ? round( ( $completed / $total ) * 100, 1 ) : 0,
        ),
        'users' => $data,
    ) );
}

/**
 * GET /my-assignments — current user's pending assigned lessons
 */
function aquaticpro_lms_get_my_assignments( WP_REST_Request $request ) {
    global $wpdb;
    $user_id  = get_current_user_id();
    $au_table = $wpdb->prefix . 'aquaticpro_learning_assignment_users';
    $a_table  = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $l_table  = $wpdb->prefix . 'aquaticpro_lessons';

    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.id, a.title, a.description, a.due_date, a.lesson_id, a.status AS assignment_status,
                au.progress_status, au.quiz_score, au.started_at, au.completed_at,
                l.title AS lesson_title, l.lesson_type
         FROM $au_table au
         INNER JOIN $a_table a ON a.id = au.assignment_id
         LEFT JOIN $l_table l ON l.id = a.lesson_id
         WHERE au.user_id = %d AND a.status = 'active'
         ORDER BY a.due_date ASC, a.created_at DESC",
        $user_id
    ) );

    $result = array();
    foreach ( $rows as $row ) {
        $is_overdue = $row->due_date && strtotime( $row->due_date ) < time() && $row->progress_status !== 'completed';
        $is_due_soon = $row->due_date && ! $is_overdue && ( strtotime( $row->due_date ) - time() ) < ( 3 * DAY_IN_SECONDS );

        $result[] = array(
            'assignmentId'   => (int) $row->id,
            'title'          => $row->title,
            'description'    => $row->description,
            'dueDate'        => $row->due_date,
            'lessonId'       => (int) $row->lesson_id,
            'lessonTitle'    => $row->lesson_title ?: '',
            'lessonType'     => $row->lesson_type ?: '',
            'progressStatus' => $row->progress_status,
            'quizScore'      => $row->quiz_score !== null ? (float) $row->quiz_score : null,
            'startedAt'      => $row->started_at,
            'completedAt'    => $row->completed_at,
            'isOverdue'      => $is_overdue,
            'isDueSoon'      => $is_due_soon,
        );
    }

    return rest_ensure_response( $result );
}

// ============================================
// ============================================
// EMAIL QUEUE CRON PROCESSOR
// ============================================

/**
 * Process pending emails from the queue (10 per tick).
 * Hooked into the existing 15-minute cron via a new action.
 */
function aquaticpro_lms_process_email_queue() {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_queue';
    $au    = $wpdb->prefix . 'aquaticpro_learning_assignment_users';

    $pending = $wpdb->get_results( $wpdb->prepare(
        "SELECT * FROM $table WHERE status = 'pending' AND attempts < 3 ORDER BY created_at ASC LIMIT %d",
        10
    ) );

    if ( empty( $pending ) ) {
        return;
    }

    foreach ( $pending as $email ) {
        $wp_user = get_userdata( (int) $email->user_id );
        if ( ! $wp_user || ! $wp_user->user_email ) {
            $wpdb->update( $table, array(
                'status'   => 'failed',
                'attempts' => $email->attempts + 1,
            ), array( 'id' => $email->id ), array( '%s', '%d' ), array( '%d' ) );
            continue;
        }

        $sent = wp_mail( $wp_user->user_email, $email->subject, $email->body );

        if ( $sent ) {
            $now = current_time( 'mysql' );
            $wpdb->update( $table, array(
                'status'   => 'sent',
                'sent_at'  => $now,
                'attempts' => $email->attempts + 1,
            ), array( 'id' => $email->id ), array( '%s', '%s', '%d' ), array( '%d' ) );

            // Update assignment_users email_status
            if ( $email->context_id && in_array( $email->email_type, array( 'learning_assignment', 'learning_reminder' ), true ) ) {
                $wpdb->update( $au, array(
                    'email_sent_at' => $now,
                    'email_status'  => 'sent',
                    'updated_at'    => $now,
                ), array(
                    'assignment_id' => (int) $email->context_id,
                    'user_id'       => (int) $email->user_id,
                ), array( '%s', '%s', '%s' ), array( '%d', '%d' ) );
            }
        } else {
            $wpdb->update( $table, array(
                'attempts' => $email->attempts + 1,
                'status'   => ( $email->attempts + 1 >= 3 ) ? 'failed' : 'pending',
            ), array( 'id' => $email->id ), array( '%d', '%s' ), array( '%d' ) );
        }
    }

    error_log( '[AquaticPro LMS Assignments] Processed ' . count( $pending ) . ' emails from queue' );
}

// Hook into the existing 15-minute cron
add_action( 'mentorship_process_notification_queue', 'aquaticpro_lms_process_email_queue' );

// ============================================
// PROGRESS SYNC CRON (every 6 hours)
// ============================================

/**
 * Sweep all active assignments and sync progress
 */
function aquaticpro_lms_sync_all_assignment_progress() {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_learning_assignments';
    $ids   = $wpdb->get_col( "SELECT id FROM $table WHERE status = 'active'" );

    foreach ( $ids as $id ) {
        aquaticpro_lms_sync_assignment_progress( (int) $id );
    }

    error_log( '[AquaticPro LMS Assignments] Synced progress for ' . count( $ids ) . ' active assignments' );
}

add_action( 'aquaticpro_refresh_inservice_cache', 'aquaticpro_lms_sync_all_assignment_progress' );
