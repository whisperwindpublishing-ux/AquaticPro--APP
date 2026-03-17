<?php
/**
 * AquaticPro — Custom Email Composer API Routes
 *
 * Allows Tier 6 / WP Admin users to compose and send custom HTML emails
 * to individual users or users by job role. Includes email template
 * management for saving reusable email templates.
 *
 * Uses wp_mail() which routes through MailPoet SMTP when configured.
 *
 * Tables created:
 *   - aquaticpro_email_templates (saved email templates)
 *   - Uses existing aquaticpro_email_queue for batch sending
 *
 * @package AquaticPro
 * @subpackage EmailComposer
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// ============================================
// TABLE CREATION
// ============================================

function aquaticpro_email_composer_create_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    $templates_table = $wpdb->prefix . 'aquaticpro_email_composer_templates';
    $sql = "CREATE TABLE $templates_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL DEFAULT '',
        body_json LONGTEXT,
        body_html LONGTEXT,
        created_by BIGINT(20) UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_created_by (created_by)
    ) $charset_collate;";
    dbDelta( $sql );

    // Sent emails log
    $log_table = $wpdb->prefix . 'aquaticpro_email_composer_log';
    $sql_log = "CREATE TABLE $log_table (
        id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(255) NOT NULL,
        body_html LONGTEXT,
        recipient_count INT UNSIGNED DEFAULT 0,
        sent_by BIGINT(20) UNSIGNED NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        recipient_summary TEXT,
        KEY idx_sent_by (sent_by),
        KEY idx_sent_at (sent_at)
    ) $charset_collate;";
    dbDelta( $sql_log );

    update_option( 'aquaticpro_email_composer_tables_version', '1.0.0' );
    error_log( '[AquaticPro Email Composer] Tables created/updated to version 1.0.0' );
}

add_action( 'init', function () {
    $current = get_option( 'aquaticpro_email_composer_tables_version', '0' );
    if ( version_compare( $current, '1.0.0', '<' ) ) {
        aquaticpro_email_composer_create_tables();
    }
} );

// ============================================
// PERMISSION CHECK
// ============================================

/**
 * Only Tier 6+ or WP Admins can use the email composer
 */
function aquaticpro_email_composer_check_admin() {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    if ( function_exists( 'mp_is_plugin_admin' ) && mp_is_plugin_admin() ) {
        return true;
    }
    return false;
}

// ============================================
// REST API ROUTE REGISTRATION
// ============================================

function aquaticpro_register_email_composer_routes() {
    $ns = 'mentorship-platform/v1';

    // --- Send email ---
    register_rest_route( $ns, '/email-composer/send', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_email_composer_send',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
        'args' => array(
            'subject'   => array( 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ),
            'bodyHtml'  => array( 'required' => true, 'type' => 'string' ),
            'bodyJson'  => array( 'type' => 'string' ), // BlockNote JSON for future editing
            'userIds'   => array( 'type' => 'array', 'default' => array() ),
            'roleIds'   => array( 'type' => 'array', 'default' => array() ),
        ),
    ) );

    // --- Preview recipient count ---
    register_rest_route( $ns, '/email-composer/preview-recipients', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_email_composer_preview_recipients',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
    ) );

    // --- Get users (with archived filter) ---
    register_rest_route( $ns, '/email-composer/users', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_email_composer_get_users',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
        'args' => array(
            'include_archived' => array( 'type' => 'string', 'default' => 'false' ),
            'search'           => array( 'type' => 'string', 'default' => '' ),
        ),
    ) );

    // --- Get job roles ---
    register_rest_route( $ns, '/email-composer/roles', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_email_composer_get_roles',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
    ) );

    // --- Template CRUD ---
    register_rest_route( $ns, '/email-composer/templates', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_email_composer_get_templates',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
    ) );

    register_rest_route( $ns, '/email-composer/templates', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'aquaticpro_email_composer_create_template',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
        'args' => array(
            'name'    => array( 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ),
            'subject' => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
            'bodyJson' => array( 'type' => 'string' ),
            'bodyHtml' => array( 'type' => 'string' ),
        ),
    ) );

    register_rest_route( $ns, '/email-composer/templates/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'aquaticpro_email_composer_update_template',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
        'args' => array(
            'id' => array( 'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; }, 'sanitize_callback' => 'absint' ),
        ),
    ) );

    register_rest_route( $ns, '/email-composer/templates/(?P<id>\d+)', array(
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'aquaticpro_email_composer_delete_template',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
        'args' => array(
            'id' => array( 'validate_callback' => function ( $p ) { return is_numeric( $p ) && $p > 0; }, 'sanitize_callback' => 'absint' ),
        ),
    ) );

    // --- Sent email history ---
    register_rest_route( $ns, '/email-composer/history', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_email_composer_get_history',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
    ) );

    // --- Seasons list (for seasonal-return filtering) ---
    register_rest_route( $ns, '/email-composer/seasons', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'aquaticpro_email_composer_get_seasons',
        'permission_callback' => 'aquaticpro_email_composer_check_admin',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_email_composer_routes' );

// ============================================
// CALLBACKS — SEND
// ============================================

/**
 * POST /email-composer/send
 *
 * Resolves recipients (by role + direct user IDs), and sends via wp_mail().
 * Archived users in role-based sends are skipped. Directly-added user IDs always receive email.
 */
function aquaticpro_email_composer_send( WP_REST_Request $request ) {
    global $wpdb;

    $subject   = $request->get_param( 'subject' );
    $body_html = $request->get_param( 'bodyHtml' );
    $body_json = $request->get_param( 'bodyJson' );
    $user_ids  = array_map( 'absint', $request->get_param( 'userIds' ) ?: array() );
    $role_ids  = array_map( 'absint', $request->get_param( 'roleIds' ) ?: array() );
    $season_id     = $request->get_param( 'seasonId' ) ? absint( $request->get_param( 'seasonId' ) ) : null;
    $return_status = $request->get_param( 'returnStatus' ) ? sanitize_text_field( $request->get_param( 'returnStatus' ) ) : null;

    if ( empty( $subject ) || empty( $body_html ) ) {
        return new WP_Error( 'missing_fields', 'Subject and body are required.', array( 'status' => 400 ) );
    }

    if ( empty( $user_ids ) && empty( $role_ids ) ) {
        return new WP_Error( 'no_recipients', 'At least one user or role must be selected.', array( 'status' => 400 ) );
    }

    // Resolve role-based users (non-archived only), optionally filtered by seasonal return status
    $role_user_ids = array();
    if ( ! empty( $role_ids ) ) {
        $role_user_ids = aquaticpro_email_composer_resolve_role_users( $role_ids, $season_id, $return_status );
    }

    // Merge: role users (non-archived) + directly selected users (may include archived)
    $all_user_ids = array_values( array_unique( array_merge( $role_user_ids, $user_ids ) ) );

    if ( empty( $all_user_ids ) ) {
        return new WP_Error( 'no_recipients', 'No valid recipients found.', array( 'status' => 400 ) );
    }

    // Batch-fetch all recipient user data in a single query
    $batch_users = get_users([
        'include' => $all_user_ids,
        'fields'  => ['ID', 'user_email', 'display_name'],
    ]);
    $user_map = [];
    foreach ($batch_users as $u) {
        $user_map[(int) $u->ID] = $u;
    }

    // Wrap body in a clean HTML email template
    $wrapped_body = aquaticpro_email_composer_wrap_html( $body_html );

    // Send via wp_mail (which routes through MailPoet SMTP when configured)
    $headers = array( 'Content-Type: text/html; charset=UTF-8' );
    $sent_count = 0;
    $failed_count = 0;
    $recipient_names = array();

    foreach ( $all_user_ids as $uid ) {
        $wp_user = $user_map[(int) $uid] ?? null;
        if ( ! $wp_user || ! $wp_user->user_email ) {
            $failed_count++;
            continue;
        }

        $sent = wp_mail( $wp_user->user_email, $subject, $wrapped_body, $headers );
        if ( $sent ) {
            $sent_count++;
            $recipient_names[] = $wp_user->display_name;
        } else {
            $failed_count++;
        }
    }

    // Log the send
    $log_table = $wpdb->prefix . 'aquaticpro_email_composer_log';
    $wpdb->insert( $log_table, array(
        'subject'           => $subject,
        'body_html'         => $body_html,
        'recipient_count'   => $sent_count,
        'sent_by'           => get_current_user_id(),
        'sent_at'           => current_time( 'mysql' ),
        'recipient_summary' => wp_json_encode( array_slice( $recipient_names, 0, 50 ) ), // Store first 50 names
    ), array( '%s', '%s', '%d', '%d', '%s', '%s' ) );

    return rest_ensure_response( array(
        'success'     => true,
        'sentCount'   => $sent_count,
        'failedCount' => $failed_count,
        'totalRecipients' => count( $all_user_ids ),
    ) );
}

/**
 * POST /email-composer/preview-recipients
 *
 * Preview how many recipients will be emailed based on selected roles + users
 */
function aquaticpro_email_composer_preview_recipients( WP_REST_Request $request ) {
    $user_ids = array_map( 'absint', $request->get_param( 'userIds' ) ?: array() );
    $role_ids = array_map( 'absint', $request->get_param( 'roleIds' ) ?: array() );
    $season_id     = $request->get_param( 'seasonId' ) ? absint( $request->get_param( 'seasonId' ) ) : null;
    $return_status = $request->get_param( 'returnStatus' ) ? sanitize_text_field( $request->get_param( 'returnStatus' ) ) : null;

    $role_user_ids = array();
    if ( ! empty( $role_ids ) ) {
        $role_user_ids = aquaticpro_email_composer_resolve_role_users( $role_ids, $season_id, $return_status );
    }

    $all_user_ids = array_values( array_unique( array_merge( $role_user_ids, $user_ids ) ) );

    // Batch-fetch all preview recipient user data in a single query
    $batch_users = get_users([
        'include' => $all_user_ids,
        'fields'  => ['ID', 'user_email', 'display_name'],
    ]);
    $user_map = [];
    foreach ($batch_users as $u) {
        $user_map[(int) $u->ID] = $u;
    }

    // Return names for preview
    $recipients = array();
    foreach ( $all_user_ids as $uid ) {
        $wp_user = $user_map[(int) $uid] ?? null;
        if ( $wp_user ) {
            $is_archived = function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $uid );
            $recipients[] = array(
                'id'       => (int) $uid,
                'name'     => $wp_user->display_name,
                'email'    => $wp_user->user_email,
                'archived' => $is_archived,
            );
        }
    }

    return rest_ensure_response( array(
        'totalCount' => count( $recipients ),
        'recipients' => $recipients,
    ) );
}

// ============================================
// CALLBACKS — USERS & ROLES
// ============================================

/**
 * GET /email-composer/users — non-archived users by default
 */
function aquaticpro_email_composer_get_users( WP_REST_Request $request ) {
    $include_archived = $request->get_param( 'include_archived' ) === 'true';
    $search = $request->get_param( 'search' );

    $args = array(
        'number'  => 500,
        'orderby' => 'display_name',
        'order'   => 'ASC',
        'fields'  => array( 'ID', 'display_name', 'user_email' ),
    );

    if ( $search ) {
        $args['search']         = '*' . $search . '*';
        $args['search_columns'] = array( 'display_name', 'user_email', 'user_login' );
    }

    $user_query = new WP_User_Query( $args );
    $users = array();

    foreach ( $user_query->get_results() as $user ) {
        $is_archived = function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $user->ID );
        
        // Filter role info
        $job_roles = aquaticpro_email_composer_get_user_roles( (int) $user->ID );
        
        if ( ! $include_archived && $is_archived ) {
            continue;
        }

        $users[] = array(
            'id'       => (int) $user->ID,
            'name'     => $user->display_name,
            'email'    => $user->user_email,
            'archived' => $is_archived,
            'jobRoles' => $job_roles,
        );
    }

    return rest_ensure_response( $users );
}

/**
 * GET /email-composer/roles — all job roles
 */
function aquaticpro_email_composer_get_roles( WP_REST_Request $request ) {
    global $wpdb;

    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if the table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$roles_table'" );
    if ( ! $table_exists ) {
        return rest_ensure_response( array() );
    }

    $roles = $wpdb->get_results(
        "SELECT id, title, tier FROM $roles_table ORDER BY tier ASC, title ASC"
    );

    $result = array();
    foreach ( $roles as $role ) {
        // Count active (non-archived) users in this role
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(DISTINCT user_id) FROM $assignments_table WHERE job_role_id = %d",
            $role->id
        ) );

        $result[] = array(
            'id'        => (int) $role->id,
            'title'     => $role->title,
            'tier'      => (int) $role->tier,
            'userCount' => $count,
        );
    }

    return rest_ensure_response( $result );
}

// ============================================
// CALLBACKS — TEMPLATES
// ============================================

function aquaticpro_email_composer_get_templates( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_composer_templates';
    
    $rows = $wpdb->get_results( "SELECT * FROM $table ORDER BY updated_at DESC" );
    
    $templates = array();
    foreach ( $rows as $row ) {
        $creator = get_userdata( (int) $row->created_by );
        $templates[] = array(
            'id'        => (int) $row->id,
            'name'      => $row->name,
            'subject'   => $row->subject,
            'bodyJson'  => $row->body_json,
            'bodyHtml'  => $row->body_html,
            'createdBy' => $creator ? $creator->display_name : 'Unknown',
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        );
    }

    return rest_ensure_response( $templates );
}

function aquaticpro_email_composer_create_template( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_composer_templates';

    $wpdb->insert( $table, array(
        'name'       => $request->get_param( 'name' ),
        'subject'    => $request->get_param( 'subject' ) ?: '',
        'body_json'  => $request->get_param( 'bodyJson' ),
        'body_html'  => $request->get_param( 'bodyHtml' ),
        'created_by' => get_current_user_id(),
        'created_at' => current_time( 'mysql' ),
        'updated_at' => current_time( 'mysql' ),
    ), array( '%s', '%s', '%s', '%s', '%d', '%s', '%s' ) );

    $id = (int) $wpdb->insert_id;
    if ( ! $id ) {
        return new WP_Error( 'insert_failed', 'Failed to save template.', array( 'status' => 500 ) );
    }

    return rest_ensure_response( array( 'id' => $id, 'success' => true ) );
}

function aquaticpro_email_composer_update_template( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_composer_templates';
    $id    = $request->get_param( 'id' );

    $existing = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $table WHERE id = %d", $id ) );
    if ( ! $existing ) {
        return new WP_Error( 'not_found', 'Template not found.', array( 'status' => 404 ) );
    }

    $updates = array();
    $formats = array();

    foreach ( array( 'name' => '%s', 'subject' => '%s', 'bodyJson' => '%s', 'bodyHtml' => '%s' ) as $param => $fmt ) {
        $value = $request->get_param( $param );
        if ( $value !== null ) {
            $col = $param;
            // Map camelCase to snake_case column names
            if ( $param === 'bodyJson' ) $col = 'body_json';
            if ( $param === 'bodyHtml' ) $col = 'body_html';
            $updates[ $col ] = $param === 'name' || $param === 'subject' ? sanitize_text_field( $value ) : $value;
            $formats[] = $fmt;
        }
    }

    if ( ! empty( $updates ) ) {
        $updates['updated_at'] = current_time( 'mysql' );
        $formats[] = '%s';
        $wpdb->update( $table, $updates, array( 'id' => $id ), $formats, array( '%d' ) );
    }

    return rest_ensure_response( array( 'success' => true, 'id' => (int) $id ) );
}

function aquaticpro_email_composer_delete_template( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_composer_templates';
    $id    = $request->get_param( 'id' );

    $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );

    return rest_ensure_response( array( 'deleted' => true, 'id' => (int) $id ) );
}

// ============================================
// CALLBACKS — HISTORY
// ============================================

function aquaticpro_email_composer_get_history( WP_REST_Request $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_email_composer_log';

    $rows = $wpdb->get_results( "SELECT * FROM $table ORDER BY sent_at DESC LIMIT 100" );

    $history = array();
    foreach ( $rows as $row ) {
        $sender = get_userdata( (int) $row->sent_by );
        $history[] = array(
            'id'               => (int) $row->id,
            'subject'          => $row->subject,
            'recipientCount'   => (int) $row->recipient_count,
            'sentBy'           => $sender ? $sender->display_name : 'Unknown',
            'sentAt'           => $row->sent_at,
            'recipientSummary' => json_decode( $row->recipient_summary, true ) ?: array(),
        );
    }

    return rest_ensure_response( $history );
}

// ============================================
// HELPERS
// ============================================

/**
 * Resolve job role IDs → active (non-archived) WP user IDs
 *
 * @param array      $role_ids      Job role IDs to resolve.
 * @param int|null   $season_id     Optional: only include users with a record in this season.
 * @param string|null $return_status Optional: 'returning', 'not_returning', or 'pending'.
 */
function aquaticpro_email_composer_resolve_role_users( array $role_ids, $season_id = null, $return_status = null ) {
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

    // Filter out archived users (role-based sends skip archived)
    $active = array();
    foreach ( $user_ids as $uid ) {
        if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $uid ) ) {
            continue;
        }
        $active[] = (int) $uid;
    }

    // Apply seasonal return filter when both season and status are provided
    if ( $season_id && $return_status && ! empty( $active ) ) {
        $active = aquaticpro_email_composer_filter_by_seasonal_return( $active, $season_id, $return_status );
    }

    return $active;
}

/**
 * Filter a set of user IDs by their seasonal return status.
 *
 * Queries the srm_employee_seasons table for the given season and status,
 * then intersects with the provided user IDs.
 *
 * @param array  $user_ids      User IDs to filter.
 * @param int    $season_id     The season to check against.
 * @param string $return_status One of 'returning', 'not_returning', 'pending'.
 * @return array Filtered user IDs.
 */
function aquaticpro_email_composer_filter_by_seasonal_return( array $user_ids, $season_id, $return_status ) {
    global $wpdb;

    $table = $wpdb->prefix . 'srm_employee_seasons';

    // Verify the table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
    if ( ! $table_exists ) {
        return $user_ids; // Seasonal Returns module not installed — skip filtering
    }

    $allowed_statuses = array( 'returning', 'not_returning', 'pending' );
    if ( ! in_array( $return_status, $allowed_statuses, true ) ) {
        return $user_ids;
    }

    $matching_user_ids = $wpdb->get_col( $wpdb->prepare(
        "SELECT user_id FROM $table WHERE season_id = %d AND status = %s",
        $season_id,
        $return_status
    ) );

    $matching_user_ids = array_map( 'intval', $matching_user_ids );

    return array_values( array_intersect( $user_ids, $matching_user_ids ) );
}

/**
 * Get job role info for a user
 */
function aquaticpro_email_composer_get_user_roles( int $user_id ) {
    global $wpdb;
    $assignments_tbl = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_tbl       = $wpdb->prefix . 'pg_job_roles';

    $roles = $wpdb->get_results( $wpdb->prepare(
        "SELECT r.id, r.title, r.tier 
         FROM $assignments_tbl a 
         JOIN $roles_tbl r ON r.id = a.job_role_id 
         WHERE a.user_id = %d",
        $user_id
    ) );

    $result = array();
    foreach ( $roles as $r ) {
        $result[] = array(
            'id'    => (int) $r->id,
            'title' => $r->title,
            'tier'  => (int) $r->tier,
        );
    }
    return $result;
}

/**
 * Wrap email body in a clean HTML email template
 */
function aquaticpro_email_composer_wrap_html( $body_html ) {
    $site_name = get_bloginfo( 'name' );
    
    return '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; background-color: #f5f5f5; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .email-header { padding: 24px 32px; border-bottom: 2px solid #6366f1; }
        .email-header h1 { margin: 0; font-size: 20px; color: #6366f1; }
        .email-body { padding: 32px; line-height: 1.6; font-size: 15px; }
        .email-body img { max-width: 100%; height: auto; border-radius: 8px; }
        .email-body h1, .email-body h2, .email-body h3 { color: #1f2937; }
        .email-body a { color: #6366f1; }
        .email-body blockquote { border-left: 3px solid #6366f1; margin: 16px 0; padding: 8px 16px; background: #f0f0ff; }
        .email-body ul, .email-body ol { padding-left: 24px; }
        .email-body pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .email-body code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
        .email-footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">
            <h1>' . esc_html( $site_name ) . '</h1>
        </div>
        <div class="email-body">
            ' . $body_html . '
        </div>
        <div class="email-footer">
            <p>Sent via ' . esc_html( $site_name ) . '</p>
        </div>
    </div>
</body>
</html>';
}

// ============================================
// CALLBACKS — SEASONS (for seasonal-return filtering)
// ============================================

/**
 * GET /email-composer/seasons
 *
 * Returns available seasons from the Seasonal Returns module
 * for use in the email composer's recipient filter.
 */
function aquaticpro_email_composer_get_seasons( WP_REST_Request $request ) {
    global $wpdb;

    $table = $wpdb->prefix . 'srm_seasons';

    // Make sure the table exists (SRM module may not be installed)
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
    if ( ! $table_exists ) {
        return rest_ensure_response( array( 'seasons' => array(), 'available' => false ) );
    }

    $seasons = $wpdb->get_results( "SELECT * FROM $table ORDER BY start_date DESC", ARRAY_A );

    $result = array();
    foreach ( $seasons as $season ) {
        $result[] = array(
            'id'        => (int) $season['id'],
            'name'      => $season['name'],
            'year'      => (int) $season['year'],
            'isActive'  => (bool) $season['is_active'],
            'isCurrent' => (bool) $season['is_current'],
        );
    }

    return rest_ensure_response( array( 'seasons' => $result, 'available' => true ) );
}
