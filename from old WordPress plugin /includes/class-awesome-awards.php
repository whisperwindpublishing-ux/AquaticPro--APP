<?php
/**
 * Awesome Awards Module - Core Class
 *
 * Handles permission checking, table initialization, and helper functions
 * for the Awesome Awards nomination and recognition system.
 *
 * @package AquaticPro
 * @subpackage AwesomeAwards
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class Awesome_Awards
 * 
 * Core class for the Awesome Awards module providing:
 * - Permission checking per job role
 * - User permission retrieval
 * - Table initialization for new job roles
 * - Helper functions for nominations, voting, and periods
 */
class Awesome_Awards {

    /**
     * Check if the Awesome Awards module is enabled
     *
     * @return bool
     */
    public static function is_enabled() {
        return (bool) get_option( 'aquaticpro_enable_awesome_awards', false );
    }

    /**
     * Get all permissions for the current user based on their job roles
     *
     * @param int|null $user_id User ID (defaults to current user)
     * @return array Permission flags
     */
    public static function get_user_permissions( $user_id = null ) {
        if ( ! $user_id ) {
            $user_id = get_current_user_id();
        }

        // Default permissions (most restrictive)
        $permissions = [
            'can_nominate'         => false,
            'can_vote'             => false,
            'can_approve'          => false,
            'can_direct_assign'    => false,
            'can_manage_periods'   => false,
            'can_view_nominations' => false,
            'can_view_winners'     => false,
            'can_view_archives'    => false,
            'can_archive'          => false,
        ];

        // WordPress admins get full access
        if ( user_can( $user_id, 'manage_options' ) ) {
            return array_map( '__return_true', $permissions );
        }

        // Module must be enabled
        if ( ! self::is_enabled() ) {
            return $permissions;
        }

        global $wpdb;

        // Get user's job role IDs from assignments table first, then fallback to user meta
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $user_job_roles = $wpdb->get_col( $wpdb->prepare(
            "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
            $user_id
        ) );
        
        // Fallback to user meta if no assignments found
        if ( empty( $user_job_roles ) ) {
            $user_job_roles = get_user_meta( $user_id, 'pg_job_roles', true );
        }
        
        if ( empty( $user_job_roles ) || ! is_array( $user_job_roles ) ) {
            // No job roles assigned - return default (minimal) permissions
            // But still allow viewing if they have platform access
            if ( function_exists( 'mentorship_platform_user_has_access' ) && mentorship_platform_user_has_access( $user_id ) ) {
                $permissions['can_view_nominations'] = true;
                $permissions['can_view_winners'] = true;
                $permissions['can_view_archives'] = true;
                $permissions['can_nominate'] = true; // Default: all can nominate
            }
            return $permissions;
        }

        // Get permissions for all user's job roles (take highest permission level)
        $table = $wpdb->prefix . 'awesome_awards_permissions';
        
        // Check if table exists before querying
        $table_exists = $wpdb->get_var( $wpdb->prepare( 
            "SHOW TABLES LIKE %s", 
            $table 
        ) );
        
        if ( ! $table_exists ) {
            // Table doesn't exist yet - return default permissions
            return $permissions;
        }
        
        $role_ids = array_map( 'intval', $user_job_roles );
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        // Build query with placeholders
        $query_sql = "SELECT 
                MAX(can_nominate) as can_nominate,
                MAX(can_vote) as can_vote,
                MAX(can_approve) as can_approve,
                MAX(can_direct_assign) as can_direct_assign,
                MAX(can_manage_periods) as can_manage_periods,
                MAX(can_view_nominations) as can_view_nominations,
                MAX(can_view_winners) as can_view_winners,
                MAX(can_view_archives) as can_view_archives,
                MAX(can_archive) as can_archive
            FROM $table
            WHERE job_role_id IN ($placeholders)";
        
        // Use call_user_func_array to pass array as individual arguments
        $query = call_user_func_array( 
            array( $wpdb, 'prepare' ), 
            array_merge( array( $query_sql ), $role_ids ) 
        );

        $result = $wpdb->get_row( $query, ARRAY_A );

        if ( $result ) {
            foreach ( $permissions as $key => $value ) {
                $permissions[ $key ] = isset( $result[ $key ] ) ? (bool) $result[ $key ] : false;
            }
        }

        return $permissions;
    }

    /**
     * Check if current user has a specific permission
     *
     * @param string $permission Permission key (e.g., 'can_nominate')
     * @param int|null $user_id User ID (defaults to current user)
     * @return bool
     */
    public static function user_can( $permission, $user_id = null ) {
        $permissions = self::get_user_permissions( $user_id );
        return isset( $permissions[ $permission ] ) && $permissions[ $permission ];
    }

    /**
     * Get all permissions for all job roles (for admin management UI)
     *
     * @return array Array of permissions by job role
     */
    public static function get_all_role_permissions() {
        global $wpdb;

        $permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
        $roles_table = $wpdb->prefix . 'pg_job_roles';

        $results = $wpdb->get_results(
            "SELECT 
                jr.id as job_role_id,
                jr.title as job_role_name,
                jr.tier as job_role_tier,
                COALESCE(p.can_nominate, 1) as can_nominate,
                COALESCE(p.can_vote, 0) as can_vote,
                COALESCE(p.can_approve, 0) as can_approve,
                COALESCE(p.can_direct_assign, 0) as can_direct_assign,
                COALESCE(p.can_manage_periods, 0) as can_manage_periods,
                COALESCE(p.can_view_nominations, 1) as can_view_nominations,
                COALESCE(p.can_view_winners, 1) as can_view_winners,
                COALESCE(p.can_view_archives, 1) as can_view_archives,
                COALESCE(p.can_archive, 0) as can_archive
            FROM $roles_table jr
            LEFT JOIN $permissions_table p ON jr.id = p.job_role_id
            ORDER BY jr.tier DESC, jr.title ASC",
            ARRAY_A
        );

        // Cast booleans
        foreach ( $results as &$row ) {
            $row['job_role_id'] = (int) $row['job_role_id'];
            $row['job_role_tier'] = (int) $row['job_role_tier'];
            $row['can_nominate'] = (bool) $row['can_nominate'];
            $row['can_vote'] = (bool) $row['can_vote'];
            $row['can_approve'] = (bool) $row['can_approve'];
            $row['can_direct_assign'] = (bool) $row['can_direct_assign'];
            $row['can_manage_periods'] = (bool) $row['can_manage_periods'];
            $row['can_view_nominations'] = (bool) $row['can_view_nominations'];
            $row['can_view_winners'] = (bool) $row['can_view_winners'];
            $row['can_view_archives'] = (bool) $row['can_view_archives'];
            $row['can_archive'] = (bool) $row['can_archive'];
        }

        return $results;
    }

    /**
     * Update permissions for a specific job role
     *
     * @param int $job_role_id Job role ID
     * @param array $permissions Array of permission values
     * @return bool Success
     */
    public static function update_role_permissions( $job_role_id, $permissions ) {
        global $wpdb;

        $table = $wpdb->prefix . 'awesome_awards_permissions';
        $job_role_id = (int) $job_role_id;

        // Validate job role exists
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        $role_exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $roles_table WHERE id = %d",
            $job_role_id
        ) );
        
        if ( ! $role_exists ) {
            return false;
        }

        // Sanitize permission values
        $data = [
            'can_nominate'         => isset( $permissions['can_nominate'] ) ? (int) (bool) $permissions['can_nominate'] : 1,
            'can_vote'             => isset( $permissions['can_vote'] ) ? (int) (bool) $permissions['can_vote'] : 0,
            'can_approve'          => isset( $permissions['can_approve'] ) ? (int) (bool) $permissions['can_approve'] : 0,
            'can_direct_assign'    => isset( $permissions['can_direct_assign'] ) ? (int) (bool) $permissions['can_direct_assign'] : 0,
            'can_manage_periods'   => isset( $permissions['can_manage_periods'] ) ? (int) (bool) $permissions['can_manage_periods'] : 0,
            'can_view_nominations' => isset( $permissions['can_view_nominations'] ) ? (int) (bool) $permissions['can_view_nominations'] : 1,
            'can_view_winners'     => isset( $permissions['can_view_winners'] ) ? (int) (bool) $permissions['can_view_winners'] : 1,
            'can_view_archives'    => isset( $permissions['can_view_archives'] ) ? (int) (bool) $permissions['can_view_archives'] : 1,
            'can_archive'          => isset( $permissions['can_archive'] ) ? (int) (bool) $permissions['can_archive'] : 0,
        ];

        // Check if row exists
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE job_role_id = %d",
            $job_role_id
        ) );

        if ( $exists ) {
            return $wpdb->update(
                $table,
                $data,
                [ 'job_role_id' => $job_role_id ],
                array_fill( 0, count( $data ), '%d' ),
                [ '%d' ]
            ) !== false;
        } else {
            $data['job_role_id'] = $job_role_id;
            return $wpdb->insert(
                $table,
                $data,
                array_fill( 0, count( $data ), '%d' )
            ) !== false;
        }
    }

    /**
     * Batch update permissions for multiple job roles
     *
     * @param array $updates Array of [ 'job_role_id' => X, 'permissions' => [...] ]
     * @return int Number of successful updates
     */
    public static function batch_update_permissions( $updates ) {
        $success_count = 0;

        foreach ( $updates as $update ) {
            if ( isset( $update['job_role_id'], $update['permissions'] ) ) {
                if ( self::update_role_permissions( $update['job_role_id'], $update['permissions'] ) ) {
                    $success_count++;
                }
            }
        }

        return $success_count;
    }

    /**
     * Ensure permissions exist for all job roles (sync with job roles table)
     * Called when new job roles are created
     *
     * @return int Number of new permission rows created
     */
    public static function sync_permissions_with_job_roles() {
        global $wpdb;

        $permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
        $roles_table = $wpdb->prefix . 'pg_job_roles';

        // Get job roles without permission entries
        $missing_roles = $wpdb->get_results(
            "SELECT jr.id, jr.tier
            FROM $roles_table jr
            LEFT JOIN $permissions_table p ON jr.id = p.job_role_id
            WHERE p.id IS NULL"
        );

        $created = 0;

        foreach ( $missing_roles as $role ) {
            $tier = (int) $role->tier;

            // Set defaults based on tier
            if ( $tier >= 5 ) {
                // Tier 5-6: Full admin access
                $defaults = [
                    'can_nominate' => 1,
                    'can_vote' => 1,
                    'can_approve' => 1,
                    'can_direct_assign' => 1,
                    'can_manage_periods' => 1,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 1,
                ];
            } elseif ( $tier >= 3 ) {
                // Tier 3-4: Can vote
                $defaults = [
                    'can_nominate' => 1,
                    'can_vote' => 1,
                    'can_approve' => 0,
                    'can_direct_assign' => 0,
                    'can_manage_periods' => 0,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 0,
                ];
            } else {
                // Tier 1-2: Can nominate and view
                $defaults = [
                    'can_nominate' => 1,
                    'can_vote' => 0,
                    'can_approve' => 0,
                    'can_direct_assign' => 0,
                    'can_manage_periods' => 0,
                    'can_view_nominations' => 1,
                    'can_view_winners' => 1,
                    'can_view_archives' => 1,
                    'can_archive' => 0,
                ];
            }

            $defaults['job_role_id'] = (int) $role->id;

            $wpdb->insert(
                $permissions_table,
                $defaults,
                array_fill( 0, count( $defaults ), '%d' )
            );

            $created++;
        }

        return $created;
    }

    /**
     * Get current active award period (nominations open)
     *
     * @param string|null $type 'week' or 'month' or null for any
     * @return object|null Period data or null
     */
    public static function get_active_period( $type = null ) {
        global $wpdb;

        $table = $wpdb->prefix . 'awesome_awards_periods';

        $where_type = $type ? $wpdb->prepare( " AND period_type = %s", $type ) : '';

        return $wpdb->get_row(
            "SELECT * FROM $table 
            WHERE status = 'nominations_open' 
            AND archived = 0
            $where_type
            ORDER BY start_date DESC 
            LIMIT 1"
        );
    }

    /**
     * Get periods pending approval (nominations closed, awaiting winner selection)
     *
     * @return array Array of period objects
     */
    public static function get_pending_approval_periods() {
        global $wpdb;

        $table = $wpdb->prefix . 'awesome_awards_periods';

        return $wpdb->get_results(
            "SELECT * FROM $table 
            WHERE status = 'pending_approval' 
            AND archived = 0
            ORDER BY start_date DESC"
        );
    }

    /**
     * Get a user's win count for badge display
     *
     * @param int $user_id User ID
     * @return array [ 'total' => X, 'weekly' => Y, 'monthly' => Z ]
     */
    public static function get_user_win_count( $user_id ) {
        global $wpdb;

        $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
        $periods_table = $wpdb->prefix . 'awesome_awards_periods';

        $results = $wpdb->get_row( $wpdb->prepare(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN p.period_type = 'week' THEN 1 ELSE 0 END) as weekly,
                SUM(CASE WHEN p.period_type = 'month' THEN 1 ELSE 0 END) as monthly
            FROM $nominations_table n
            JOIN $periods_table p ON n.period_id = p.id
            WHERE n.nominee_id = %d 
            AND n.status = 'winner'",
            $user_id
        ), ARRAY_A );

        return [
            'total'   => isset( $results['total'] ) ? (int) $results['total'] : 0,
            'weekly'  => isset( $results['weekly'] ) ? (int) $results['weekly'] : 0,
            'monthly' => isset( $results['monthly'] ) ? (int) $results['monthly'] : 0,
        ];
    }

    /**
     * Get unseen announcements for a user (winners and rejections)
     *
     * @param int $user_id User ID
     * @return array Array of announcement data
     */
    public static function get_unseen_announcements( $user_id ) {
        global $wpdb;

        $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
        $periods_table = $wpdb->prefix . 'awesome_awards_periods';
        $categories_table = $wpdb->prefix . 'awesome_awards_categories';
        $seen_table = $wpdb->prefix . 'awesome_awards_announcements_seen';

        $announcements = [];

        // Get winner announcements not yet seen
        $winners = $wpdb->get_results( $wpdb->prepare(
            "SELECT 
                n.id as nomination_id,
                n.nominee_id,
                n.reason_text,
                n.reason_json,
                c.name as category_name,
                p.period_type,
                p.start_date,
                p.end_date,
                'winner' as announcement_type
            FROM $nominations_table n
            JOIN $periods_table p ON n.period_id = p.id
            JOIN $categories_table c ON n.category_id = c.id
            LEFT JOIN $seen_table s ON s.nomination_id = n.id 
                AND s.user_id = %d 
                AND s.announcement_type = 'winner'
            WHERE n.status = 'winner'
            AND n.archived = 0
            AND s.id IS NULL
            ORDER BY n.updated_at DESC",
            $user_id
        ), ARRAY_A );

        foreach ( $winners as $winner ) {
            // Get nominee info
            $nominee = get_userdata( $winner['nominee_id'] );
            $winner['nominee_name'] = $nominee ? $nominee->display_name : 'Unknown';
            $winner['nominee_avatar'] = $nominee ? get_avatar_url( $nominee->ID ) : '';
            $announcements[] = $winner;
        }

        // Get rejection announcements for the current user's nominations
        $rejections = $wpdb->get_results( $wpdb->prepare(
            "SELECT 
                n.id as nomination_id,
                n.nominee_id,
                n.rejection_reason,
                c.name as category_name,
                p.period_type,
                p.start_date,
                p.end_date,
                'rejection' as announcement_type
            FROM $nominations_table n
            JOIN $periods_table p ON n.period_id = p.id
            JOIN $categories_table c ON n.category_id = c.id
            LEFT JOIN $seen_table s ON s.nomination_id = n.id 
                AND s.user_id = %d 
                AND s.announcement_type = 'rejection'
            WHERE n.nominator_id = %d
            AND n.status = 'rejected'
            AND n.archived = 0
            AND s.id IS NULL
            ORDER BY n.updated_at DESC",
            $user_id,
            $user_id
        ), ARRAY_A );

        foreach ( $rejections as $rejection ) {
            // Get nominee info
            $nominee = get_userdata( $rejection['nominee_id'] );
            $rejection['nominee_name'] = $nominee ? $nominee->display_name : 'Unknown';
            $announcements[] = $rejection;
        }

        return $announcements;
    }

    /**
     * Mark an announcement as seen
     *
     * @param int $user_id User ID
     * @param int $nomination_id Nomination ID
     * @param string $type 'winner' or 'rejection'
     * @return bool Success
     */
    public static function mark_announcement_seen( $user_id, $nomination_id, $type ) {
        global $wpdb;

        $table = $wpdb->prefix . 'awesome_awards_announcements_seen';

        // Use INSERT IGNORE to handle duplicate key gracefully
        return $wpdb->query( $wpdb->prepare(
            "INSERT IGNORE INTO $table (user_id, nomination_id, announcement_type) VALUES (%d, %d, %s)",
            $user_id,
            $nomination_id,
            $type
        ) ) !== false;
    }

    /**
     * Update vote count on a nomination (called after vote/unvote)
     *
     * @param int $nomination_id Nomination ID
     * @return int New vote count
     */
    public static function update_vote_count( $nomination_id ) {
        global $wpdb;

        $votes_table = $wpdb->prefix . 'awesome_awards_votes';
        $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';

        $count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $votes_table WHERE nomination_id = %d",
            $nomination_id
        ) );

        $wpdb->update(
            $nominations_table,
            [ 'vote_count' => $count ],
            [ 'id' => $nomination_id ],
            [ '%d' ],
            [ '%d' ]
        );

        return $count;
    }

    /**
     * Check if nomination deadline has passed for a period
     *
     * @param int $period_id Period ID
     * @return bool True if deadline passed
     */
    public static function is_nomination_deadline_passed( $period_id ) {
        global $wpdb;

        $table = $wpdb->prefix . 'awesome_awards_periods';

        $deadline = $wpdb->get_var( $wpdb->prepare(
            "SELECT nomination_deadline FROM $table WHERE id = %d",
            $period_id
        ) );

        if ( ! $deadline ) {
            return false; // No deadline set
        }

        return strtotime( $deadline ) < current_time( 'timestamp' );
    }

    /**
     * Auto-transition period status based on deadlines
     * Called via cron, on period access, or manually
     *
     * @param bool $force_check Skip transient cache
     * @return int Number of periods transitioned
     */
    public static function check_period_deadlines( $force_check = false ) {
        global $wpdb;

        // Skip if recently checked (unless forced)
        if ( ! $force_check && get_transient( 'awesome_awards_deadline_check' ) ) {
            return 0;
        }

        $table = $wpdb->prefix . 'awesome_awards_periods';
        $now = current_time( 'mysql' );
        $transitioned = 0;

        // Move 'nominations_open' to 'pending_approval' if deadline passed
        $result = $wpdb->query( $wpdb->prepare(
            "UPDATE $table 
            SET status = 'pending_approval', updated_at = %s
            WHERE status = 'nominations_open' 
            AND nomination_deadline IS NOT NULL 
            AND nomination_deadline < %s",
            $now,
            $now
        ) );

        if ( $result ) {
            $transitioned += $result;
        }

        // Set transient to avoid repeated checks (5 minutes)
        set_transient( 'awesome_awards_deadline_check', true, 5 * MINUTE_IN_SECONDS );

        return $transitioned;
    }
    
    /**
     * Check if required tables exist
     *
     * @return bool True if all tables exist
     */
    public static function tables_exist() {
        global $wpdb;
        
        $permissions_table = $wpdb->prefix . 'awesome_awards_permissions';
        $periods_table = $wpdb->prefix . 'awesome_awards_periods';
        
        $permissions_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $permissions_table ) );
        $periods_exists = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $periods_table ) );
        
        return $permissions_exists && $periods_exists;
    }
}

// Initialize on plugins_loaded to ensure all dependencies are available
add_action( 'plugins_loaded', function() {
    // Sync permissions when a new job role might have been created
    // This runs once per day via transient check
    // Only run if module is enabled AND tables exist
    if ( Awesome_Awards::is_enabled() && Awesome_Awards::tables_exist() && ! get_transient( 'awesome_awards_permissions_synced' ) ) {
        Awesome_Awards::sync_permissions_with_job_roles();
        set_transient( 'awesome_awards_permissions_synced', true, DAY_IN_SECONDS );
    }
}, 20 );

// Hook to check period deadlines on init (uses internal transient caching)
add_action( 'init', function() {
    if ( Awesome_Awards::is_enabled() && Awesome_Awards::tables_exist() ) {
        Awesome_Awards::check_period_deadlines();
    }
} );
