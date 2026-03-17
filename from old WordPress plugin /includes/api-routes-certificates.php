<?php
/**
 * AquaticPro — Certificate Tracking REST API Routes
 *
 * Provides CRUD for certificate types, user certificate records,
 * role requirements, permissions, bulk operations, approval workflow,
 * and self-service endpoints for frontline users.
 *
 * @package AquaticPro
 * @subpackage Certificates
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ============================================
// PERMISSION CALLBACKS
// ============================================

function aquaticpro_cert_can_manage_types() {
    return AquaticPro_Certificates::user_can( 'can_manage_types' );
}

function aquaticpro_cert_can_view_all() {
    return AquaticPro_Certificates::user_can( 'can_view_all' );
}

function aquaticpro_cert_can_edit_records() {
    return AquaticPro_Certificates::user_can( 'can_edit_records' );
}

function aquaticpro_cert_can_approve() {
    return AquaticPro_Certificates::user_can( 'can_approve_uploads' );
}

function aquaticpro_cert_can_bulk_edit() {
    return AquaticPro_Certificates::user_can( 'can_bulk_edit' );
}

function aquaticpro_cert_is_logged_in() {
    return is_user_logged_in();
}

// ============================================
// ROUTE REGISTRATION
// ============================================

function aquaticpro_register_certificate_routes() {
    $ns = 'mentorship-platform/v1';

    // --- My Permissions ---
    register_rest_route( $ns, '/certificates/my-permissions', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_my_permissions',
        'permission_callback' => 'aquaticpro_cert_is_logged_in',
    ) );

    // --- Certificate Types CRUD ---
    register_rest_route( $ns, '/certificates/types', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_types',
        'permission_callback' => 'aquaticpro_cert_is_logged_in',
    ) );

    register_rest_route( $ns, '/certificates/types', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_create_type',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    register_rest_route( $ns, '/certificates/types/(?P<id>\d+)', array(
        'methods'  => WP_REST_Server::EDITABLE,
        'callback' => 'aquaticpro_cert_update_type',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    register_rest_route( $ns, '/certificates/types/(?P<id>\d+)', array(
        'methods'  => WP_REST_Server::DELETABLE,
        'callback' => 'aquaticpro_cert_delete_type',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    // --- Role Requirements ---
    register_rest_route( $ns, '/certificates/role-requirements', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_role_requirements',
        'permission_callback' => 'aquaticpro_cert_can_view_all',
    ) );

    register_rest_route( $ns, '/certificates/role-requirements', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_save_role_requirements',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    // --- User Certificate Records ---
    // Get all — admin table (filterable by cert type or user)
    register_rest_route( $ns, '/certificates/records', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_records',
        'permission_callback' => 'aquaticpro_cert_can_view_all',
    ) );

    // Get single user's certs
    register_rest_route( $ns, '/certificates/users/(?P<user_id>\d+)', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_user_records',
        'permission_callback' => 'aquaticpro_cert_can_view_all',
    ) );

    // Update a specific record
    register_rest_route( $ns, '/certificates/records/(?P<id>\d+)', array(
        'methods'  => WP_REST_Server::EDITABLE,
        'callback' => 'aquaticpro_cert_update_record',
        'permission_callback' => 'aquaticpro_cert_can_edit_records',
    ) );

    // Approve a pending record
    register_rest_route( $ns, '/certificates/records/(?P<id>\d+)/approve', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_approve_record',
        'permission_callback' => 'aquaticpro_cert_can_approve',
    ) );

    // Reject a pending record
    register_rest_route( $ns, '/certificates/records/(?P<id>\d+)/reject', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_reject_record',
        'permission_callback' => 'aquaticpro_cert_can_approve',
    ) );

    // --- Bulk Operations ---
    register_rest_route( $ns, '/certificates/bulk-assign', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_bulk_assign',
        'permission_callback' => 'aquaticpro_cert_can_bulk_edit',
    ) );

    register_rest_route( $ns, '/certificates/bulk-update', array(
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'aquaticpro_cert_bulk_update',
        'permission_callback' => 'aquaticpro_cert_can_bulk_edit',
    ) );

    // --- Self-Service (any logged-in user) ---
    register_rest_route( $ns, '/certificates/my-certificates', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_my_certificates',
        'permission_callback' => 'aquaticpro_cert_is_logged_in',
    ) );

    register_rest_route( $ns, '/certificates/my-certificates/(?P<id>\d+)', array(
        'methods'  => WP_REST_Server::EDITABLE,
        'callback' => 'aquaticpro_cert_update_my_certificate',
        'permission_callback' => 'aquaticpro_cert_is_logged_in',
    ) );

    // My alerts (for banner)
    register_rest_route( $ns, '/certificates/my-alerts', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_my_alerts',
        'permission_callback' => 'aquaticpro_cert_is_logged_in',
    ) );

    // --- Permissions Management (admin only) ---
    register_rest_route( $ns, '/certificates/permissions', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_all_permissions',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    register_rest_route( $ns, '/certificates/permissions/(?P<role_id>\d+)', array(
        'methods'  => WP_REST_Server::EDITABLE,
        'callback' => 'aquaticpro_cert_update_permissions',
        'permission_callback' => 'aquaticpro_cert_can_manage_types',
    ) );

    // --- Pending count (for badge) ---
    register_rest_route( $ns, '/certificates/pending-count', array(
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'aquaticpro_cert_get_pending_count',
        'permission_callback' => 'aquaticpro_cert_can_approve',
    ) );
}
add_action( 'rest_api_init', 'aquaticpro_register_certificate_routes' );


// ============================================
// CALLBACKS — PERMISSIONS
// ============================================

function aquaticpro_cert_get_my_permissions( $request ) {
    $perms = AquaticPro_Certificates::get_user_permissions();
    // Convert snake_case to camelCase for frontend
    return rest_ensure_response( array(
        'canViewAll'       => $perms['can_view_all'],
        'canEditRecords'   => $perms['can_edit_records'],
        'canManageTypes'   => $perms['can_manage_types'],
        'canApproveUploads'=> $perms['can_approve_uploads'],
        'canBulkEdit'      => $perms['can_bulk_edit'],
    ) );
}

function aquaticpro_cert_get_all_permissions( $request ) {
    $raw_roles = AquaticPro_Certificates::get_all_role_permissions();
    // Convert snake_case to camelCase for frontend
    $roles = array_map( function( $r ) {
        return array(
            'roleId'          => (int) $r['id'],
            'roleTitle'       => $r['title'],
            'roleTier'        => (int) $r['tier'],
            'canViewAll'      => (bool) $r['can_view_all'],
            'canEditRecords'  => (bool) $r['can_edit_records'],
            'canManageTypes'  => (bool) $r['can_manage_types'],
            'canApproveUploads' => (bool) $r['can_approve_uploads'],
            'canBulkEdit'     => (bool) $r['can_bulk_edit'],
        );
    }, $raw_roles );
    return rest_ensure_response( array( 'roles' => $roles ) );
}

function aquaticpro_cert_update_permissions( $request ) {
    $role_id = (int) $request->get_param( 'role_id' );
    $perms   = $request->get_json_params();
    // Accept both camelCase (from frontend) and snake_case
    $mapped = array(
        'can_view_all'        => ! empty( $perms['canViewAll'] ?? $perms['can_view_all'] ?? false ),
        'can_edit_records'    => ! empty( $perms['canEditRecords'] ?? $perms['can_edit_records'] ?? false ),
        'can_manage_types'    => ! empty( $perms['canManageTypes'] ?? $perms['can_manage_types'] ?? false ),
        'can_approve_uploads' => ! empty( $perms['canApproveUploads'] ?? $perms['can_approve_uploads'] ?? false ),
        'can_bulk_edit'       => ! empty( $perms['canBulkEdit'] ?? $perms['can_bulk_edit'] ?? false ),
    );
    AquaticPro_Certificates::update_role_permissions( $role_id, $mapped );
    return rest_ensure_response( array( 'success' => true ) );
}

// ============================================
// CALLBACKS — CERTIFICATE TYPES
// ============================================

function aquaticpro_cert_get_types( $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_certificate_types';
    $rows = $wpdb->get_results( "SELECT * FROM $table ORDER BY sort_order ASC, name ASC", ARRAY_A );

    $types = array();
    foreach ( $rows as $row ) {
        $types[] = array(
            'id'                  => (int) $row['id'],
            'name'                => $row['name'],
            'description'         => $row['description'] ?: '',
            'defaultExpiryMonths' => $row['default_expiry_months'] !== null ? (int) $row['default_expiry_months'] : null,
            'trainingLink'        => $row['training_link'] ?: '',
            'emailAlertsEnabled'  => (bool) $row['email_alerts_enabled'],
            'isActive'            => (bool) $row['is_active'],
            'sortOrder'           => (int) $row['sort_order'],
        );
    }

    return rest_ensure_response( $types );
}

function aquaticpro_cert_create_type( $request ) {
    global $wpdb;
    $params = $request->get_json_params();
    $table  = $wpdb->prefix . 'aquaticpro_certificate_types';

    $expiry = isset( $params['defaultExpiryMonths'] ) && $params['defaultExpiryMonths'] !== null && $params['defaultExpiryMonths'] !== ''
        ? (int) $params['defaultExpiryMonths'] : null;

    $result = $wpdb->insert( $table, array(
        'name'                  => sanitize_text_field( $params['name'] ),
        'description'           => sanitize_textarea_field( $params['description'] ?? '' ),
        'default_expiry_months' => $expiry,
        'training_link'         => esc_url_raw( $params['trainingLink'] ?? '' ),
        'email_alerts_enabled'  => ! empty( $params['emailAlertsEnabled'] ) ? 1 : 0,
        'is_active'             => isset( $params['isActive'] ) ? (int) (bool) $params['isActive'] : 1,
        'sort_order'            => isset( $params['sortOrder'] ) ? (int) $params['sortOrder'] : 0,
        'created_by'            => get_current_user_id(),
    ) );

    if ( ! $result ) {
        return new WP_Error( 'create_failed', 'Failed to create certificate type.', array( 'status' => 500 ) );
    }

    return rest_ensure_response( array( 'success' => true, 'id' => (int) $wpdb->insert_id ) );
}

function aquaticpro_cert_update_type( $request ) {
    global $wpdb;
    $id     = (int) $request->get_param( 'id' );
    $params = $request->get_json_params();
    $table  = $wpdb->prefix . 'aquaticpro_certificate_types';

    $data = array();
    if ( isset( $params['name'] ) )                $data['name'] = sanitize_text_field( $params['name'] );
    if ( isset( $params['description'] ) )         $data['description'] = sanitize_textarea_field( $params['description'] );
    if ( array_key_exists( 'defaultExpiryMonths', $params ) ) {
        $data['default_expiry_months'] = $params['defaultExpiryMonths'] !== null && $params['defaultExpiryMonths'] !== ''
            ? (int) $params['defaultExpiryMonths'] : null;
    }
    if ( isset( $params['trainingLink'] ) )        $data['training_link'] = esc_url_raw( $params['trainingLink'] );
    if ( isset( $params['emailAlertsEnabled'] ) )  $data['email_alerts_enabled'] = (int) (bool) $params['emailAlertsEnabled'];
    if ( isset( $params['isActive'] ) )            $data['is_active'] = (int) (bool) $params['isActive'];
    if ( isset( $params['sortOrder'] ) )           $data['sort_order'] = (int) $params['sortOrder'];

    if ( empty( $data ) ) {
        return new WP_Error( 'no_data', 'Nothing to update.', array( 'status' => 400 ) );
    }

    $wpdb->update( $table, $data, array( 'id' => $id ) );
    return rest_ensure_response( array( 'success' => true ) );
}

function aquaticpro_cert_delete_type( $request ) {
    global $wpdb;
    $id = (int) $request->get_param( 'id' );

    // Delete associated user records and role requirements too
    $wpdb->delete( $wpdb->prefix . 'aquaticpro_user_certificates', array( 'certificate_type_id' => $id ) );
    $wpdb->delete( $wpdb->prefix . 'aquaticpro_cert_role_requirements', array( 'certificate_type_id' => $id ) );
    $wpdb->delete( $wpdb->prefix . 'aquaticpro_certificate_types', array( 'id' => $id ) );

    return rest_ensure_response( array( 'success' => true ) );
}

// ============================================
// CALLBACKS — ROLE REQUIREMENTS
// ============================================

function aquaticpro_cert_get_role_requirements( $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_cert_role_requirements';
    $rows  = $wpdb->get_results( "SELECT * FROM $table ORDER BY certificate_type_id, job_role_id", ARRAY_A );

    $result = array();
    foreach ( $rows as $row ) {
        $result[] = array(
            'id'              => (int) $row['id'],
            'certificateTypeId' => (int) $row['certificate_type_id'],
            'jobRoleId'       => (int) $row['job_role_id'],
        );
    }
    return rest_ensure_response( $result );
}

/**
 * POST /certificates/role-requirements
 * Expects { certificateTypeId, roleIds: number[] } — full replacement for that cert type.
 */
function aquaticpro_cert_save_role_requirements( $request ) {
    global $wpdb;
    $params  = $request->get_json_params();
    $cert_id = (int) ( $params['certificateTypeId'] ?? 0 );
    $role_ids = array_map( 'intval', $params['roleIds'] ?? array() );
    $table   = $wpdb->prefix . 'aquaticpro_cert_role_requirements';

    if ( ! $cert_id ) {
        return new WP_Error( 'missing_cert', 'Certificate type ID required.', array( 'status' => 400 ) );
    }

    // Delete existing requirements for this cert type
    $wpdb->delete( $table, array( 'certificate_type_id' => $cert_id ) );

    // Insert new requirements
    foreach ( $role_ids as $role_id ) {
        $wpdb->insert( $table, array(
            'certificate_type_id' => $cert_id,
            'job_role_id'         => $role_id,
            'created_by'          => get_current_user_id(),
        ) );
    }

    // Sync: create missing user_certificate records for users in these roles
    AquaticPro_Certificates::sync_role_certificates( $cert_id );

    return rest_ensure_response( array( 'success' => true, 'synced' => true ) );
}

// ============================================
// CALLBACKS — USER CERTIFICATE RECORDS
// ============================================

/**
 * GET /certificates/records
 * Query params: certificate_type_id, status, user_id
 */
function aquaticpro_cert_get_records( $request ) {
    global $wpdb;

    $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
    $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';

    $where  = array( 'ct.is_active = 1' );
    $params = array();

    if ( $request->get_param( 'certificate_type_id' ) ) {
        $where[]  = 'uc.certificate_type_id = %d';
        $params[] = (int) $request->get_param( 'certificate_type_id' );
    }
    if ( $request->get_param( 'status' ) ) {
        $where[]  = 'uc.status = %s';
        $params[] = sanitize_text_field( $request->get_param( 'status' ) );
    }
    if ( $request->get_param( 'user_id' ) ) {
        $where[]  = 'uc.user_id = %d';
        $params[] = (int) $request->get_param( 'user_id' );
    }

    $where_sql = implode( ' AND ', $where );
    $query = "
        SELECT uc.*, ct.name as certificate_name, ct.default_expiry_months, ct.training_link,
               ct.email_alerts_enabled, ct.sort_order
        FROM $certs_table uc
        JOIN $types_table ct ON ct.id = uc.certificate_type_id
        WHERE $where_sql
        ORDER BY ct.sort_order ASC, uc.user_id ASC
    ";

    if ( ! empty( $params ) ) {
        $query = call_user_func_array( array( $wpdb, 'prepare' ), array_merge( array( $query ), $params ) );
    }

    $records = $wpdb->get_results( $query, ARRAY_A );

    return rest_ensure_response( aquaticpro_cert_format_records( $records ) );
}

/**
 * GET /certificates/users/{user_id}
 * Returns all certificate records for a specific user.
 */
function aquaticpro_cert_get_user_records( $request ) {
    global $wpdb;

    $user_id     = (int) $request->get_param( 'user_id' );
    $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
    $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';

    $records = $wpdb->get_results( $wpdb->prepare(
        "SELECT uc.*, ct.name as certificate_name, ct.default_expiry_months, ct.training_link,
                ct.email_alerts_enabled, ct.sort_order
         FROM $certs_table uc
         JOIN $types_table ct ON ct.id = uc.certificate_type_id
         WHERE uc.user_id = %d AND ct.is_active = 1
         ORDER BY ct.sort_order ASC",
        $user_id
    ), ARRAY_A );

    return rest_ensure_response( aquaticpro_cert_format_records( $records ) );
}

/**
 * PUT /certificates/records/{id}
 * Admin updates a specific user certificate record.
 */
function aquaticpro_cert_update_record( $request ) {
    global $wpdb;

    $id     = (int) $request->get_param( 'id' );
    $params = $request->get_json_params();
    $table  = $wpdb->prefix . 'aquaticpro_user_certificates';

    $data = array();
    if ( array_key_exists( 'trainingDate', $params ) ) {
        $data['training_date'] = $params['trainingDate'] ? sanitize_text_field( $params['trainingDate'] ) : null;
    }
    if ( array_key_exists( 'expirationDate', $params ) ) {
        $data['expiration_date'] = $params['expirationDate'] ? sanitize_text_field( $params['expirationDate'] ) : null;
    }
    if ( isset( $params['fileAttachmentId'] ) ) {
        $data['file_attachment_id'] = $params['fileAttachmentId'] ? (int) $params['fileAttachmentId'] : null;
    }
    if ( isset( $params['fileUrl'] ) ) {
        $data['file_url'] = esc_url_raw( $params['fileUrl'] );
    }
    if ( isset( $params['notes'] ) ) {
        $data['notes'] = sanitize_textarea_field( $params['notes'] );
    }

    // Admin edits are auto-approved
    $data['uploaded_by']  = get_current_user_id();
    $data['approved_by']  = get_current_user_id();
    $data['approved_at']  = current_time( 'mysql' );

    $wpdb->update( $table, $data, array( 'id' => $id ) );

    // Re-compute status
    $record = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    if ( $record ) {
        $new_status = AquaticPro_Certificates::compute_status( $record );
        $wpdb->update( $table, array( 'status' => $new_status ), array( 'id' => $id ) );
        // Clear cached alerts for this user
        AquaticPro_Certificates::clear_alerts_cache( (int) $record['user_id'] );
    }

    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * POST /certificates/records/{id}/approve
 */
function aquaticpro_cert_approve_record( $request ) {
    global $wpdb;
    $id    = (int) $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_user_certificates';

    $wpdb->update( $table, array(
        'approved_by' => get_current_user_id(),
        'approved_at' => current_time( 'mysql' ),
    ), array( 'id' => $id ) );

    // Re-compute status
    $record = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    if ( $record ) {
        $new_status = AquaticPro_Certificates::compute_status( $record );
        $wpdb->update( $table, array( 'status' => $new_status ), array( 'id' => $id ) );
        // Clear cached alerts for this user
        AquaticPro_Certificates::clear_alerts_cache( (int) $record['user_id'] );
    }

    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * POST /certificates/records/{id}/reject
 */
function aquaticpro_cert_reject_record( $request ) {
    global $wpdb;
    $id    = (int) $request->get_param( 'id' );
    $table = $wpdb->prefix . 'aquaticpro_user_certificates';
    $params = $request->get_json_params();

    // Reset the upload — marks it back to missing
    $record = $wpdb->get_row( $wpdb->prepare( "SELECT user_id FROM $table WHERE id = %d", $id ), ARRAY_A );
    $wpdb->update( $table, array(
        'file_attachment_id' => null,
        'file_url'           => '',
        'training_date'      => null,
        'expiration_date'    => null,
        'uploaded_by'        => null,
        'approved_by'        => null,
        'approved_at'        => null,
        'status'             => 'missing',
        'notes'              => isset( $params['reason'] ) ? sanitize_textarea_field( $params['reason'] ) : '',
    ), array( 'id' => $id ) );

    // Clear cached alerts for this user
    if ( $record ) {
        AquaticPro_Certificates::clear_alerts_cache( (int) $record['user_id'] );
    }

    return rest_ensure_response( array( 'success' => true ) );
}

// ============================================
// CALLBACKS — BULK OPERATIONS
// ============================================

/**
 * POST /certificates/bulk-assign
 * { certificateTypeId, userIds: number[], roleIds?: number[] }
 * Ensures each user has a certificate record (creates if missing).
 */
function aquaticpro_cert_bulk_assign( $request ) {
    global $wpdb;
    $params  = $request->get_json_params();
    $cert_id = (int) ( $params['certificateTypeId'] ?? 0 );
    $user_ids = array_map( 'intval', $params['userIds'] ?? array() );
    $role_ids = array_map( 'intval', $params['roleIds'] ?? array() );
    $table   = $wpdb->prefix . 'aquaticpro_user_certificates';

    if ( ! $cert_id ) {
        return new WP_Error( 'missing_cert', 'Certificate type ID required.', array( 'status' => 400 ) );
    }

    // Resolve role IDs to user IDs
    if ( ! empty( $role_ids ) ) {
        $assignments = $wpdb->prefix . 'pg_user_job_assignments';
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        $role_user_ids = $wpdb->get_col( call_user_func_array(
            array( $wpdb, 'prepare' ),
            array_merge(
                array( "SELECT DISTINCT user_id FROM $assignments WHERE job_role_id IN ($placeholders)" ),
                $role_ids
            )
        ) );
        $user_ids = array_values( array_unique( array_merge( $user_ids, array_map( 'intval', $role_user_ids ) ) ) );
    }

    // Filter out archived users
    $user_ids = array_filter( $user_ids, function( $uid ) {
        return ! ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( $uid ) );
    } );

    $created = 0;
    $skipped = 0;

    foreach ( $user_ids as $uid ) {
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE user_id = %d AND certificate_type_id = %d",
            $uid, $cert_id
        ) );

        if ( $exists ) {
            $skipped++;
            continue;
        }

        $wpdb->insert( $table, array(
            'user_id'             => $uid,
            'certificate_type_id' => $cert_id,
            'status'              => 'missing',
        ) );
        $created++;
    }

    // Clear cached alerts for all affected users
    foreach ( $user_ids as $uid ) {
        AquaticPro_Certificates::clear_alerts_cache( $uid );
    }

    return rest_ensure_response( array(
        'success' => true,
        'created' => $created,
        'skipped' => $skipped,
        'message' => "Assigned to $created user(s)" . ( $skipped > 0 ? " ($skipped already had it)" : '' ),
    ) );
}

/**
 * POST /certificates/bulk-update
 * { certificateTypeId, userIds: number[], trainingDate?, expirationDate? }
 * Applies the same training/expiration date to multiple users at once.
 */
function aquaticpro_cert_bulk_update( $request ) {
    global $wpdb;
    $params   = $request->get_json_params();
    $cert_id  = (int) ( $params['certificateTypeId'] ?? 0 );
    $user_ids = array_map( 'intval', $params['userIds'] ?? array() );
    $table    = $wpdb->prefix . 'aquaticpro_user_certificates';

    if ( ! $cert_id || empty( $user_ids ) ) {
        return new WP_Error( 'missing_data', 'Certificate type ID and user IDs required.', array( 'status' => 400 ) );
    }

    $data = array();
    if ( array_key_exists( 'trainingDate', $params ) ) {
        $data['training_date'] = $params['trainingDate'] ? sanitize_text_field( $params['trainingDate'] ) : null;
    }
    if ( array_key_exists( 'expirationDate', $params ) ) {
        $data['expiration_date'] = $params['expirationDate'] ? sanitize_text_field( $params['expirationDate'] ) : null;
    }

    // Admin bulk edits are auto-approved
    $data['uploaded_by'] = get_current_user_id();
    $data['approved_by'] = get_current_user_id();
    $data['approved_at'] = current_time( 'mysql' );

    $updated = 0;
    $created = 0;

    foreach ( $user_ids as $uid ) {
        $existing = $wpdb->get_row( $wpdb->prepare(
            "SELECT id FROM $table WHERE user_id = %d AND certificate_type_id = %d",
            $uid, $cert_id
        ) );

        if ( $existing ) {
            $wpdb->update( $table, $data, array( 'id' => $existing->id ) );
            // Recompute status
            $record = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $existing->id ), ARRAY_A );
            $wpdb->update( $table, array( 'status' => AquaticPro_Certificates::compute_status( $record ) ), array( 'id' => $existing->id ) );
            $updated++;
        } else {
            $insert_data = array_merge( array(
                'user_id'             => $uid,
                'certificate_type_id' => $cert_id,
                'status'              => 'missing',
            ), $data );
            $wpdb->insert( $table, $insert_data );
            $new_id = $wpdb->insert_id;
            // Recompute status
            $record = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $new_id ), ARRAY_A );
            if ( $record ) {
                $wpdb->update( $table, array( 'status' => AquaticPro_Certificates::compute_status( $record ) ), array( 'id' => $new_id ) );
            }
            $created++;
        }
    }

    // Clear cached alerts for all affected users
    foreach ( $user_ids as $uid ) {
        AquaticPro_Certificates::clear_alerts_cache( $uid );
    }

    return rest_ensure_response( array(
        'success' => true,
        'updated' => $updated,
        'created' => $created,
        'message' => "Updated $updated, created $created certificate record(s).",
    ) );
}

// ============================================
// CALLBACKS — SELF-SERVICE
// ============================================

/**
 * GET /certificates/my-certificates
 */
function aquaticpro_cert_get_my_certificates( $request ) {
    global $wpdb;

    $user_id     = get_current_user_id();
    $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
    $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';

    $records = $wpdb->get_results( $wpdb->prepare(
        "SELECT uc.*, ct.name as certificate_name, ct.default_expiry_months, ct.training_link,
                ct.email_alerts_enabled, ct.sort_order
         FROM $certs_table uc
         JOIN $types_table ct ON ct.id = uc.certificate_type_id
         WHERE uc.user_id = %d AND ct.is_active = 1
         ORDER BY ct.sort_order ASC",
        $user_id
    ), ARRAY_A );

    return rest_ensure_response( aquaticpro_cert_format_records( $records ) );
}

/**
 * PUT /certificates/my-certificates/{id}
 * Allows user to upload their own cert file and enter dates.
 * Resulting status = pending_review (unless user is admin).
 */
function aquaticpro_cert_update_my_certificate( $request ) {
    global $wpdb;

    $id      = (int) $request->get_param( 'id' );
    $user_id = get_current_user_id();
    $table   = $wpdb->prefix . 'aquaticpro_user_certificates';
    $params  = $request->get_json_params();

    // Verify ownership
    $record = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $table WHERE id = %d AND user_id = %d", $id, $user_id
    ), ARRAY_A );

    if ( ! $record ) {
        return new WP_Error( 'not_found', 'Certificate record not found.', array( 'status' => 404 ) );
    }

    $data = array( 'uploaded_by' => $user_id );

    if ( array_key_exists( 'trainingDate', $params ) ) {
        $data['training_date'] = $params['trainingDate'] ? sanitize_text_field( $params['trainingDate'] ) : null;
    }
    if ( array_key_exists( 'expirationDate', $params ) ) {
        $data['expiration_date'] = $params['expirationDate'] ? sanitize_text_field( $params['expirationDate'] ) : null;
    }
    if ( isset( $params['fileAttachmentId'] ) ) {
        $data['file_attachment_id'] = $params['fileAttachmentId'] ? (int) $params['fileAttachmentId'] : null;
    }
    if ( isset( $params['fileUrl'] ) ) {
        $data['file_url'] = esc_url_raw( $params['fileUrl'] );
    }
    if ( isset( $params['notes'] ) ) {
        $data['notes'] = sanitize_textarea_field( $params['notes'] );
    }

    // If user is an admin, auto-approve; otherwise leave for review
    if ( AquaticPro_Certificates::is_plugin_admin( $user_id ) ) {
        $data['approved_by'] = $user_id;
        $data['approved_at'] = current_time( 'mysql' );
    } else {
        // Clear any previous approval — it's a new upload that needs review
        $data['approved_by'] = null;
        $data['approved_at'] = null;
    }

    $wpdb->update( $table, $data, array( 'id' => $id ) );

    // Recompute status
    $updated_record = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ), ARRAY_A );
    if ( $updated_record ) {
        $new_status = AquaticPro_Certificates::compute_status( $updated_record );
        $wpdb->update( $table, array( 'status' => $new_status ), array( 'id' => $id ) );
    }

    // Clear cached alerts for this user
    AquaticPro_Certificates::clear_alerts_cache( $user_id );

    return rest_ensure_response( array( 'success' => true ) );
}

/**
 * GET /certificates/my-alerts
 */
function aquaticpro_cert_get_my_alerts( $request ) {
    $alerts = AquaticPro_Certificates::get_user_certificate_alerts( get_current_user_id() );
    return rest_ensure_response( $alerts );
}

/**
 * GET /certificates/pending-count
 */
function aquaticpro_cert_get_pending_count( $request ) {
    global $wpdb;
    $table = $wpdb->prefix . 'aquaticpro_user_certificates';
    $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE status = 'pending_review'" );
    return rest_ensure_response( array( 'count' => $count ) );
}

// ============================================
// HELPERS
// ============================================

/**
 * Format raw DB rows into API response shape with enriched user data.
 */
function aquaticpro_cert_format_records( array $records ) {
    $result = array();

    foreach ( $records as $row ) {
        // Re-compute live status
        $live_status = AquaticPro_Certificates::compute_status( $row );

        $user = get_userdata( (int) $row['user_id'] );

        // Skip orphan records where the WordPress user has been deleted
        if ( ! $user ) {
            continue;
        }

        $is_archived = function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $row['user_id'] );

        $approver_name = '';
        if ( $row['approved_by'] ) {
            $approver = get_userdata( (int) $row['approved_by'] );
            $approver_name = $approver ? $approver->display_name : '';
        }

        $uploader_name = '';
        if ( $row['uploaded_by'] ) {
            $uploader = get_userdata( (int) $row['uploaded_by'] );
            $uploader_name = $uploader ? $uploader->display_name : '';
        }

        $result[] = array(
            'id'                  => (int) $row['id'],
            'userId'              => (int) $row['user_id'],
            'userName'            => $user->display_name,
            'userFirstName'       => $user->first_name,
            'userLastName'        => $user->last_name,
            'userEmail'           => $user->user_email,
            'isArchived'          => $is_archived,
            'certificateTypeId'   => (int) $row['certificate_type_id'],
            'certificateName'     => $row['certificate_name'] ?? '',
            'trainingDate'        => $row['training_date'],
            'expirationDate'      => $row['expiration_date'],
            'fileAttachmentId'    => $row['file_attachment_id'] ? (int) $row['file_attachment_id'] : null,
            'fileUrl'             => $row['file_url'] ?: '',
            'status'              => $live_status,
            'notes'               => $row['notes'] ?: '',
            'uploadedBy'          => $row['uploaded_by'] ? (int) $row['uploaded_by'] : null,
            'uploadedByName'      => $uploader_name,
            'approvedBy'          => $row['approved_by'] ? (int) $row['approved_by'] : null,
            'approvedByName'      => $approver_name,
            'approvedAt'          => $row['approved_at'],
            'trainingLink'        => $row['training_link'] ?? '',
            'defaultExpiryMonths' => isset( $row['default_expiry_months'] ) && $row['default_expiry_months'] !== null
                ? (int) $row['default_expiry_months'] : null,
            'emailAlertsEnabled'  => (bool) ( $row['email_alerts_enabled'] ?? false ),
        );
    }

    return $result;
}
