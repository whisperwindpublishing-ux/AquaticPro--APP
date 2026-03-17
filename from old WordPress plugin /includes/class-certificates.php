<?php
/**
 * AquaticPro — Certificate Tracking Module (Core Class)
 *
 * Manages certificate types, user certificate records, role requirements,
 * and role-based permissions for the Certificate Tracking feature.
 *
 * Tables created:
 *   - aquaticpro_certificate_types       — Definitions of trackable certificates
 *   - aquaticpro_user_certificates       — Per-user certificate records
 *   - aquaticpro_cert_role_requirements  — Which roles require which certs
 *   - aquaticpro_cert_permissions        — Role-based permission flags
 *
 * @package AquaticPro
 * @subpackage Certificates
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AquaticPro_Certificates {

    const TABLE_VERSION = '1.0.0';
    const OPTION_KEY    = 'aquaticpro_cert_tables_version';
    const SEED_OPTION   = 'aquaticpro_cert_defaults_seeded';

    // ========================================
    // TABLE CREATION
    // ========================================

    /**
     * Create / update all certificate tables.
     */
    public static function create_tables() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // 1. Certificate type definitions
        $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';
        dbDelta( "CREATE TABLE $types_table (
            id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            default_expiry_months INT UNSIGNED DEFAULT NULL COMMENT 'NULL = never expires',
            training_link VARCHAR(2083) DEFAULT '',
            email_alerts_enabled TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_by BIGINT(20) UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_active (is_active),
            KEY idx_sort (sort_order)
        ) $charset;" );

        // 2. Per-user certificate records
        $user_certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
        dbDelta( "CREATE TABLE $user_certs_table (
            id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            certificate_type_id BIGINT(20) UNSIGNED NOT NULL,
            training_date DATE DEFAULT NULL,
            expiration_date DATE DEFAULT NULL COMMENT 'NULL = never expires',
            file_attachment_id BIGINT(20) UNSIGNED DEFAULT NULL COMMENT 'WP media library ID',
            file_url VARCHAR(2083) DEFAULT '',
            status VARCHAR(30) DEFAULT 'missing' COMMENT 'valid, expired, pending_review, missing',
            notes TEXT,
            uploaded_by BIGINT(20) UNSIGNED DEFAULT NULL,
            approved_by BIGINT(20) UNSIGNED DEFAULT NULL,
            approved_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_user (user_id),
            KEY idx_cert_type (certificate_type_id),
            KEY idx_status (status),
            KEY idx_expiry (expiration_date),
            UNIQUE KEY idx_user_cert (user_id, certificate_type_id)
        ) $charset;" );

        // 3. Role ↔ certificate-type requirements
        $role_reqs_table = $wpdb->prefix . 'aquaticpro_cert_role_requirements';
        dbDelta( "CREATE TABLE $role_reqs_table (
            id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            certificate_type_id BIGINT(20) UNSIGNED NOT NULL,
            job_role_id BIGINT(20) UNSIGNED NOT NULL,
            created_by BIGINT(20) UNSIGNED NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_cert_role (certificate_type_id, job_role_id)
        ) $charset;" );

        // 4. Role-based permissions for the certificate module
        $perms_table = $wpdb->prefix . 'aquaticpro_cert_permissions';
        dbDelta( "CREATE TABLE $perms_table (
            id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            job_role_id BIGINT(20) UNSIGNED NOT NULL,
            can_view_all TINYINT(1) DEFAULT 0,
            can_edit_records TINYINT(1) DEFAULT 0,
            can_manage_types TINYINT(1) DEFAULT 0,
            can_approve_uploads TINYINT(1) DEFAULT 0,
            can_bulk_edit TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY idx_role (job_role_id)
        ) $charset;" );

        update_option( self::OPTION_KEY, self::TABLE_VERSION );
        error_log( '[AquaticPro Certificates] Tables created/updated to v' . self::TABLE_VERSION );
    }

    /**
     * Seed the 8 default certificate types (runs once).
     */
    public static function seed_defaults() {
        if ( get_option( self::SEED_OPTION ) ) {
            return;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'aquaticpro_certificate_types';

        $defaults = array(
            array( 'name' => 'Sexual Harassment Prevention',    'default_expiry_months' => null, 'sort_order' => 1 ),
            array( 'name' => 'Bloodborne Pathogen',             'default_expiry_months' => 12,   'sort_order' => 2 ),
            array( 'name' => 'Lifeguard Certificate',           'default_expiry_months' => 24,   'sort_order' => 3 ),
            array( 'name' => 'CPR',                             'default_expiry_months' => 24,   'sort_order' => 4 ),
            array( 'name' => 'AED',                             'default_expiry_months' => 24,   'sort_order' => 5 ),
            array( 'name' => 'Supplemental Emergency Oxygen',   'default_expiry_months' => 24,   'sort_order' => 6 ),
            array( 'name' => 'Mandated Reporter',               'default_expiry_months' => null, 'sort_order' => 7 ),
            array( 'name' => 'Statement of Admission',          'default_expiry_months' => null, 'sort_order' => 8 ),
        );

        foreach ( $defaults as $cert ) {
            $wpdb->insert( $table, array(
                'name'                  => $cert['name'],
                'default_expiry_months' => $cert['default_expiry_months'],
                'sort_order'            => $cert['sort_order'],
                'email_alerts_enabled'  => $cert['default_expiry_months'] ? 1 : 0,
                'is_active'             => 1,
                'created_by'            => get_current_user_id() ?: 1,
            ) );
        }

        update_option( self::SEED_OPTION, true );
        error_log( '[AquaticPro Certificates] Default certificate types seeded.' );
    }

    /**
     * Seed default role requirements: assign all active certificate types to all existing job roles.
     * Runs once after certificate types are seeded. Also triggers user_certificate sync.
     */
    public static function seed_role_requirements() {
        if ( get_option( 'aquaticpro_cert_role_reqs_seeded' ) ) {
            return;
        }

        global $wpdb;

        $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        $reqs_table  = $wpdb->prefix . 'aquaticpro_cert_role_requirements';

        // Check that both tables exist and have data
        $cert_types = $wpdb->get_results( "SELECT id FROM $types_table WHERE is_active = 1", ARRAY_A );
        $job_roles  = $wpdb->get_results( "SELECT id FROM $roles_table", ARRAY_A );

        if ( empty( $cert_types ) || empty( $job_roles ) ) {
            return; // Wait until both have data
        }

        $count = 0;
        foreach ( $cert_types as $type ) {
            foreach ( $job_roles as $role ) {
                $exists = $wpdb->get_var( $wpdb->prepare(
                    "SELECT id FROM $reqs_table WHERE certificate_type_id = %d AND job_role_id = %d",
                    $type['id'], $role['id']
                ) );
                if ( ! $exists ) {
                    $wpdb->insert( $reqs_table, array(
                        'certificate_type_id' => (int) $type['id'],
                        'job_role_id'         => (int) $role['id'],
                        'created_by'          => get_current_user_id() ?: 1,
                    ) );
                    $count++;
                }
            }
        }

        // Sync user_certificate records for all users with roles
        self::sync_role_certificates();

        update_option( 'aquaticpro_cert_role_reqs_seeded', true );
        error_log( "[AquaticPro Certificates] Seeded $count role requirements (all certs → all roles). User records synced." );
    }

    // ========================================
    // PERMISSIONS
    // ========================================

    /**
     * Check if the current user has a specific certificate permission.
     *
     * @param string   $permission e.g. 'can_view_all', 'can_edit_records'
     * @param int|null $user_id    Defaults to current user.
     * @return bool
     */
    public static function user_can( $permission, $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }

        // WordPress admins always have full access
        if ( user_can( $user_id, 'manage_options' ) ) {
            return true;
        }

        // Tier 5–6 management users — full access
        if ( function_exists( 'mentorship_platform_pg_user_is_management' ) ) {
            if ( mentorship_platform_pg_user_is_management( $user_id ) ) {
                return true;
            }
        }

        global $wpdb;

        // Get user's job role IDs
        $role_ids = self::get_user_job_role_ids( $user_id );
        if ( empty( $role_ids ) ) {
            return false;
        }

        $perms_table = $wpdb->prefix . 'aquaticpro_cert_permissions';
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );

        $has = $wpdb->get_var( call_user_func_array(
            array( $wpdb, 'prepare' ),
            array_merge(
                array( "SELECT MAX($permission) FROM $perms_table WHERE job_role_id IN ($placeholders)" ),
                $role_ids
            )
        ) );

        return (bool) $has;
    }

    /**
     * Check if user is a plugin admin (WP admin or Tier 6+).
     */
    public static function is_plugin_admin( $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }
        if ( user_can( $user_id, 'manage_options' ) ) {
            return true;
        }
        if ( function_exists( 'mp_is_plugin_admin' ) && mp_is_plugin_admin( $user_id ) ) {
            return true;
        }
        return false;
    }

    /**
     * Get all permissions for the current user (takes highest across all their roles).
     */
    public static function get_user_permissions( $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }

        $defaults = array(
            'can_view_all'        => false,
            'can_edit_records'    => false,
            'can_manage_types'    => false,
            'can_approve_uploads' => false,
            'can_bulk_edit'       => false,
        );

        if ( self::is_plugin_admin( $user_id ) ) {
            return array_map( '__return_true', $defaults );
        }

        global $wpdb;
        $role_ids = self::get_user_job_role_ids( $user_id );
        if ( empty( $role_ids ) ) {
            return $defaults;
        }

        $perms_table  = $wpdb->prefix . 'aquaticpro_cert_permissions';
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );

        $row = call_user_func_array(
            array( $wpdb, 'get_row' ),
            array(
                call_user_func_array(
                    array( $wpdb, 'prepare' ),
                    array_merge(
                        array(
                            "SELECT
                                MAX(can_view_all) as can_view_all,
                                MAX(can_edit_records) as can_edit_records,
                                MAX(can_manage_types) as can_manage_types,
                                MAX(can_approve_uploads) as can_approve_uploads,
                                MAX(can_bulk_edit) as can_bulk_edit
                             FROM $perms_table
                             WHERE job_role_id IN ($placeholders)"
                        ),
                        $role_ids
                    )
                ),
                ARRAY_A,
            )
        );

        if ( ! $row ) {
            return $defaults;
        }

        return array(
            'can_view_all'        => (bool) $row['can_view_all'],
            'can_edit_records'    => (bool) $row['can_edit_records'],
            'can_manage_types'    => (bool) $row['can_manage_types'],
            'can_approve_uploads' => (bool) $row['can_approve_uploads'],
            'can_bulk_edit'       => (bool) $row['can_bulk_edit'],
        );
    }

    /**
     * Get all role permissions for the admin settings page.
     */
    public static function get_all_role_permissions() {
        global $wpdb;

        $perms_table = $wpdb->prefix . 'aquaticpro_cert_permissions';
        $roles_table = $wpdb->prefix . 'pg_job_roles';

        $roles = $wpdb->get_results(
            "SELECT r.id, r.title, r.tier,
                    COALESCE(p.can_view_all, 0) as can_view_all,
                    COALESCE(p.can_edit_records, 0) as can_edit_records,
                    COALESCE(p.can_manage_types, 0) as can_manage_types,
                    COALESCE(p.can_approve_uploads, 0) as can_approve_uploads,
                    COALESCE(p.can_bulk_edit, 0) as can_bulk_edit
             FROM $roles_table r
             LEFT JOIN $perms_table p ON p.job_role_id = r.id
             ORDER BY r.tier DESC, r.title ASC",
            ARRAY_A
        );

        return $roles ?: array();
    }

    /**
     * Update permissions for a specific job role.
     */
    public static function update_role_permissions( $role_id, $permissions ) {
        global $wpdb;

        $perms_table = $wpdb->prefix . 'aquaticpro_cert_permissions';

        $data = array(
            'job_role_id'         => (int) $role_id,
            'can_view_all'        => ! empty( $permissions['can_view_all'] ) ? 1 : 0,
            'can_edit_records'    => ! empty( $permissions['can_edit_records'] ) ? 1 : 0,
            'can_manage_types'    => ! empty( $permissions['can_manage_types'] ) ? 1 : 0,
            'can_approve_uploads' => ! empty( $permissions['can_approve_uploads'] ) ? 1 : 0,
            'can_bulk_edit'       => ! empty( $permissions['can_bulk_edit'] ) ? 1 : 0,
        );

        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $perms_table WHERE job_role_id = %d", $role_id
        ) );

        if ( $existing ) {
            return $wpdb->update( $perms_table, $data, array( 'id' => $existing ) );
        }
        return $wpdb->insert( $perms_table, $data );
    }

    // ========================================
    // HELPERS
    // ========================================

    /**
     * Helper: get user's job role IDs.
     */
    public static function get_user_job_role_ids( $user_id ) {
        global $wpdb;
        $table = $wpdb->prefix . 'pg_user_job_assignments';
        $ids = $wpdb->get_col( $wpdb->prepare(
            "SELECT job_role_id FROM $table WHERE user_id = %d",
            $user_id
        ) );
        return array_map( 'intval', $ids ?: array() );
    }

    /**
     * Compute certificate status based on dates and approval.
     *
     * @param array $record User certificate record (or partial data with training_date, expiration_date, approved_by, uploaded_by).
     * @return string Status string: 'valid', 'expired', 'expiring_soon', 'pending_review', 'missing'.
     */
    public static function compute_status( $record ) {
        // No training date — missing
        if ( empty( $record['training_date'] ) ) {
            return 'missing';
        }

        // If user-uploaded but not yet approved
        if ( ! empty( $record['uploaded_by'] ) && empty( $record['approved_by'] ) ) {
            // If the uploader is not an admin, it's pending review
            if ( ! self::is_plugin_admin( (int) $record['uploaded_by'] ) ) {
                return 'pending_review';
            }
        }

        // If there's an expiration date, check against today
        if ( ! empty( $record['expiration_date'] ) ) {
            $exp = strtotime( $record['expiration_date'] );
            $now = time();
            if ( $exp < $now ) {
                return 'expired';
            }
            $two_months = strtotime( '+2 months' );
            if ( $exp < $two_months ) {
                return 'expiring_soon';
            }
        }

        return 'valid';
    }

    /**
     * Synchronise role-linked certificates:
     * ensures every user with a given job role has a user_certificate record
     * for each certificate type required by that role.
     * Only creates missing records (mode = 'missing').
     *
     * @param int|null $certificate_type_id  Sync for a specific cert type (or null = all).
     * @param int|null $job_role_id          Sync for a specific role (or null = all).
     */
    public static function sync_role_certificates( $certificate_type_id = null, $job_role_id = null ) {
        global $wpdb;

        $reqs_table  = $wpdb->prefix . 'aquaticpro_cert_role_requirements';
        $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
        $assignments = $wpdb->prefix . 'pg_user_job_assignments';

        // Build WHERE for role requirements query
        $where = '1=1';
        $params = array();
        if ( $certificate_type_id ) {
            $where .= ' AND rr.certificate_type_id = %d';
            $params[] = $certificate_type_id;
        }
        if ( $job_role_id ) {
            $where .= ' AND rr.job_role_id = %d';
            $params[] = $job_role_id;
        }

        $query = "
            SELECT DISTINCT a.user_id, rr.certificate_type_id
            FROM $reqs_table rr
            JOIN $assignments a ON a.job_role_id = rr.job_role_id
            LEFT JOIN $certs_table uc ON uc.user_id = a.user_id AND uc.certificate_type_id = rr.certificate_type_id
            WHERE $where AND uc.id IS NULL
        ";

        if ( ! empty( $params ) ) {
            $query = call_user_func_array( array( $wpdb, 'prepare' ), array_merge( array( $query ), $params ) );
        }

        $missing = $wpdb->get_results( $query, ARRAY_A );

        foreach ( $missing as $row ) {
            // Skip archived users
            if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( (int) $row['user_id'] ) ) {
                continue;
            }

            $wpdb->insert( $certs_table, array(
                'user_id'             => (int) $row['user_id'],
                'certificate_type_id' => (int) $row['certificate_type_id'],
                'status'              => 'missing',
            ) );
        }
    }

    /**
     * Get a user's certificate summary for banner display.
     * Results are cached per-user for 1 hour to avoid hitting the DB on every page load.
     *
     * @param int $user_id
     * @return array { expired: [...], expiringSoon: [...], pendingReview: [...] }
     */
    public static function get_user_certificate_alerts( $user_id ) {
        // Check transient cache first (1 hour TTL)
        $cache_key = 'mp_cert_alerts_' . (int) $user_id;
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            return $cached;
        }

        global $wpdb;

        $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
        $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';

        $records = $wpdb->get_results( $wpdb->prepare(
            "SELECT uc.*, ct.name as certificate_name, ct.training_link
             FROM $certs_table uc
             JOIN $types_table ct ON ct.id = uc.certificate_type_id
             WHERE uc.user_id = %d AND ct.is_active = 1
             ORDER BY ct.sort_order ASC",
            $user_id
        ), ARRAY_A );

        $alerts = array(
            'expired'       => array(),
            'expiringSoon'  => array(),
            'missing'       => array(),
            'pendingReview' => array(),
        );

        foreach ( $records as $record ) {
            $status = self::compute_status( $record );

            if ( $status === 'expired' ) {
                $alerts['expired'][] = array(
                    'id'               => (int) $record['id'],
                    'certificateName'  => $record['certificate_name'],
                    'expirationDate'   => $record['expiration_date'],
                    'trainingLink'     => $record['training_link'],
                );
            } elseif ( $status === 'expiring_soon' ) {
                $alerts['expiringSoon'][] = array(
                    'id'               => (int) $record['id'],
                    'certificateName'  => $record['certificate_name'],
                    'expirationDate'   => $record['expiration_date'],
                    'trainingLink'     => $record['training_link'],
                );
            } elseif ( $status === 'missing' ) {
                $alerts['missing'][] = array(
                    'id'              => (int) $record['id'],
                    'certificateName' => $record['certificate_name'],
                    'trainingLink'    => $record['training_link'],
                );
            } elseif ( $status === 'pending_review' ) {
                $alerts['pendingReview'][] = array(
                    'id'              => (int) $record['id'],
                    'certificateName' => $record['certificate_name'],
                );
            }
        }

        // Cache for 1 hour — cleared when certificate records are updated
        set_transient( $cache_key, $alerts, HOUR_IN_SECONDS );

        return $alerts;
    }

    /**
     * Clear the certificate-alerts transient for one or all users.
     *
     * @param int|null $user_id  Pass a user ID to clear just that user, or null to clear all.
     */
    public static function clear_alerts_cache( $user_id = null ) {
        if ( $user_id ) {
            delete_transient( 'mp_cert_alerts_' . (int) $user_id );
        } else {
            // Bulk clear — wipe every mp_cert_alerts_* transient
            global $wpdb;
            $wpdb->query(
                "DELETE FROM $wpdb->options
                 WHERE option_name LIKE '_transient_mp_cert_alerts_%'
                    OR option_name LIKE '_transient_timeout_mp_cert_alerts_%'"
            );
        }
    }

    // ========================================
    // EMAIL NOTIFICATIONS — CRON
    // ========================================

    /**
     * Queue certificate expiration/expired email notifications.
     *
     * Runs on the existing `mentorship_process_notification_queue` cron (every 15 min),
     * but checks a daily gate option so notifications send at most once per day.
     *
     * Logic:
     *   1. For every cert type that has email_alerts_enabled = 1, gather
     *      all user_certificate records that are expired or expiring within
     *      60 days.
     *   2. Group by user, compose a single digest email per user,
     *      and send via wp_mail().
     *   3. Store today's date in an option to prevent re-sending.
     */
    public static function process_certificate_email_alerts() {
        // Only run if the module is enabled
        if ( ! (bool) get_option( 'aquaticpro_enable_certificates', true ) ) {
            return;
        }

        // Daily gate — only fire once per calendar day
        $today = current_time( 'Y-m-d' );
        if ( get_option( 'aquaticpro_cert_last_email_run' ) === $today ) {
            return;
        }
        update_option( 'aquaticpro_cert_last_email_run', $today, false );

        global $wpdb;

        $certs_table = $wpdb->prefix . 'aquaticpro_user_certificates';
        $types_table = $wpdb->prefix . 'aquaticpro_certificate_types';

        // Get all records where the cert type has email alerts ON and the
        // record is either expired or expiring within 60 days.
        $records = $wpdb->get_results(
            "SELECT uc.*, ct.name as certificate_name, ct.training_link
             FROM $certs_table uc
             JOIN $types_table ct ON ct.id = uc.certificate_type_id
             WHERE ct.is_active = 1
               AND ct.email_alerts_enabled = 1
               AND uc.training_date IS NOT NULL
               AND uc.expiration_date IS NOT NULL
               AND uc.expiration_date <= DATE_ADD( CURDATE(), INTERVAL 60 DAY )
             ORDER BY uc.user_id, uc.expiration_date ASC",
            ARRAY_A
        );

        if ( empty( $records ) ) {
            return;
        }

        // Group by user
        $by_user = array();
        foreach ( $records as $rec ) {
            $uid = (int) $rec['user_id'];

            // Skip archived users
            if ( function_exists( 'aquaticpro_is_user_archived' ) && aquaticpro_is_user_archived( $uid ) ) {
                continue;
            }

            $status = self::compute_status( $rec );
            if ( $status !== 'expired' && $status !== 'expiring_soon' ) {
                continue; // valid or pending_review — don't email
            }

            $by_user[ $uid ][] = array(
                'name'       => $rec['certificate_name'],
                'expiry'     => $rec['expiration_date'],
                'status'     => $status,
                'link'       => $rec['training_link'],
            );
        }

        if ( empty( $by_user ) ) {
            return;
        }

        $sent  = 0;
        $site  = get_bloginfo( 'name' );

        foreach ( $by_user as $uid => $certs ) {
            $user = get_userdata( $uid );
            if ( ! $user || ! $user->user_email ) {
                continue;
            }

            $expired_list  = array_filter( $certs, fn( $c ) => $c['status'] === 'expired' );
            $expiring_list = array_filter( $certs, fn( $c ) => $c['status'] === 'expiring_soon' );

            $subject = '[' . $site . '] Certificate';
            if ( ! empty( $expired_list ) ) {
                $subject .= ' Expiration Notice';
            } else {
                $subject .= ' Renewal Reminder';
            }

            $body = "Hi " . $user->first_name . ",\n\n";

            if ( ! empty( $expired_list ) ) {
                $body .= "The following certificate(s) have EXPIRED:\n\n";
                foreach ( $expired_list as $c ) {
                    $body .= "  • " . $c['name'] . " — expired " . $c['expiry'] . "\n";
                    if ( ! empty( $c['link'] ) ) {
                        $body .= "    Training link: " . $c['link'] . "\n";
                    }
                }
                $body .= "\n";
            }

            if ( ! empty( $expiring_list ) ) {
                $body .= "The following certificate(s) are expiring soon:\n\n";
                foreach ( $expiring_list as $c ) {
                    $body .= "  • " . $c['name'] . " — expires " . $c['expiry'] . "\n";
                    if ( ! empty( $c['link'] ) ) {
                        $body .= "    Training link: " . $c['link'] . "\n";
                    }
                }
                $body .= "\n";
            }

            $body .= "Please renew your certificates as soon as possible.\n\n";
            $body .= "View your certificates: " . home_url() . "\n\n";
            $body .= "— " . $site;

            wp_mail( $user->user_email, $subject, $body );
            $sent++;
        }

        error_log( "[AquaticPro Certificates] Daily email alerts sent to $sent user(s)." );
    }
}

// ========================================
// AUTO-INIT: create tables & seed on plugin load
// ========================================

add_action( 'init', function () {
    $current_version = get_option( AquaticPro_Certificates::OPTION_KEY, '0' );
    if ( version_compare( $current_version, AquaticPro_Certificates::TABLE_VERSION, '<' ) ) {
        AquaticPro_Certificates::create_tables();
        AquaticPro_Certificates::seed_defaults();
    }
    // Seed role requirements (all certs → all roles) once types + roles exist
    AquaticPro_Certificates::seed_role_requirements();
}, 20 ); // priority 20 = after CPTs and PG tables

// ========================================
// CRON HOOK: certificate email alerts (daily, on existing 15-min cron)
// ========================================
add_action( 'mentorship_process_notification_queue', array( 'AquaticPro_Certificates', 'process_certificate_email_alerts' ) );
