<?php
/**
 * Seasonal Returns & Pay Management Module - Core Class
 *
 * Handles pay rate calculations, token generation/validation, and helper functions
 * for the Seasonal Returns management system.
 *
 * @package AquaticPro
 * @subpackage SeasonalReturns
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Class Seasonal_Returns
 * 
 * Core class for the Seasonal Returns module providing:
 * - Pay rate calculations (base + role bonus + longevity + time bonuses)
 * - Token generation and validation for public return forms
 * - Permission checking per job role
 * - Retention statistics calculations
 */
class Seasonal_Returns {

    /**
     * Check if the Seasonal Returns module is enabled
     *
     * @return bool
     */
    public static function is_enabled() {
        // Enabled by default unless explicitly disabled
        return (bool) get_option( 'aquaticpro_enable_seasonal_returns', true );
    }

    // ========================================
    // PERMISSION SYSTEM
    // ========================================

    /**
     * Get user's job role IDs from the assignments table
     * Falls back to user meta if no assignments found (backwards compatibility)
     *
     * @param int $user_id User ID
     * @return array Array of job role IDs
     */
    public static function get_user_job_role_ids( $user_id ) {
        global $wpdb;
        
        // Primary source: assignments table
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $role_ids = $wpdb->get_col( $wpdb->prepare(
            "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
            $user_id
        ) );
        
        if ( ! empty( $role_ids ) ) {
            return array_map( 'intval', $role_ids );
        }
        
        // Fallback: user meta (legacy)
        $user_meta_roles = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $user_meta_roles ) && is_array( $user_meta_roles ) ) {
            return array_map( 'intval', $user_meta_roles );
        }
        
        return [];
    }

    /**
     * Get user's job roles with full details (id and title)
     *
     * @param int $user_id User ID
     * @return array Array of job roles [{id, title}]
     */
    public static function get_user_job_roles( $user_id ) {
        global $wpdb;
        
        $role_ids = self::get_user_job_role_ids( $user_id );
        
        if ( empty( $role_ids ) ) {
            return [];
        }
        
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        $query = call_user_func_array(
            [ $wpdb, 'prepare' ],
            array_merge(
                [ "SELECT id, title FROM $roles_table WHERE id IN ($placeholders) ORDER BY tier DESC" ],
                $role_ids
            )
        );
        
        return $wpdb->get_results( $query, ARRAY_A );
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
            'srm_view_own_pay'      => true,  // Everyone can see their own pay
            'srm_view_all_pay'      => false,
            'srm_manage_pay_config' => false,
            'srm_send_invites'      => false,
            'srm_view_responses'    => false,
            'srm_manage_status'     => false,
            'srm_manage_templates'  => false,
            'srm_view_retention'    => false,
            'srm_bulk_actions'      => false,
        ];

        // WordPress admins get full access
        if ( user_can( $user_id, 'manage_options' ) ) {
            return array_map( '__return_true', $permissions );
        }

        // Management tier users (Tier 5-6) also get full access
        if ( function_exists( 'mentorship_platform_pg_user_is_management' ) ) {
            if ( mentorship_platform_pg_user_is_management( $user_id ) ) {
                return array_map( '__return_true', $permissions );
            }
        }

        // Module must be enabled
        if ( ! self::is_enabled() ) {
            return $permissions;
        }

        global $wpdb;

        // Get user's job role IDs using unified helper
        $role_ids = self::get_user_job_role_ids( $user_id );
        
        if ( empty( $role_ids ) ) {
            return $permissions;
        }

        // Get permissions for all user's job roles (take highest permission level)
        $table = $wpdb->prefix . 'srm_permissions';
        
        // Check if table exists before querying
        $table_exists = $wpdb->get_var( $wpdb->prepare( 
            "SHOW TABLES LIKE %s", 
            $table 
        ) );
        
        if ( ! $table_exists ) {
            return $permissions;
        }
        
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        $query_sql = "SELECT 
                MAX(srm_view_own_pay) as srm_view_own_pay,
                MAX(srm_view_all_pay) as srm_view_all_pay,
                MAX(srm_manage_pay_config) as srm_manage_pay_config,
                MAX(srm_send_invites) as srm_send_invites,
                MAX(srm_view_responses) as srm_view_responses,
                MAX(srm_manage_status) as srm_manage_status,
                MAX(srm_manage_templates) as srm_manage_templates,
                MAX(srm_view_retention) as srm_view_retention,
                MAX(srm_bulk_actions) as srm_bulk_actions
            FROM $table
            WHERE job_role_id IN ($placeholders)";
        
        $query = call_user_func_array( 
            array( $wpdb, 'prepare' ), 
            array_merge( array( $query_sql ), $role_ids ) 
        );

        $result = $wpdb->get_row( $query, ARRAY_A );

        if ( $result ) {
            foreach ( $permissions as $key => $value ) {
                $permissions[ $key ] = isset( $result[ $key ] ) ? (bool) $result[ $key ] : $value;
            }
        }

        return $permissions;
    }

    /**
     * Check if current user has a specific permission
     *
     * @param string $permission Permission key
     * @param int|null $user_id User ID (defaults to current user)
     * @return bool
     */
    public static function user_can( $permission, $user_id = null ) {
        $permissions = self::get_user_permissions( $user_id );
        return isset( $permissions[ $permission ] ) && $permissions[ $permission ];
    }

    /**
     * Get all permissions for all job roles (for admin management UI)
     * Uses transient caching since role permissions rarely change
     *
     * @return array Array of permissions by job role
     */
    public static function get_all_role_permissions() {
        global $wpdb;
        
        // Check cache first
        $cache_key = 'srm_all_role_permissions';
        $cached = get_transient( $cache_key );
        
        if ( $cached !== false ) {
            return $cached;
        }

        $permissions_table = $wpdb->prefix . 'srm_permissions';
        $roles_table = $wpdb->prefix . 'pg_job_roles';

        $results = $wpdb->get_results(
            "SELECT 
                jr.id as job_role_id,
                jr.title as job_role_name,
                jr.tier as job_role_tier,
                COALESCE(p.srm_view_own_pay, 1) as srm_view_own_pay,
                COALESCE(p.srm_view_all_pay, 0) as srm_view_all_pay,
                COALESCE(p.srm_manage_pay_config, 0) as srm_manage_pay_config,
                COALESCE(p.srm_send_invites, 0) as srm_send_invites,
                COALESCE(p.srm_view_responses, 0) as srm_view_responses,
                COALESCE(p.srm_manage_status, 0) as srm_manage_status,
                COALESCE(p.srm_manage_templates, 0) as srm_manage_templates,
                COALESCE(p.srm_view_retention, 0) as srm_view_retention,
                COALESCE(p.srm_bulk_actions, 0) as srm_bulk_actions
            FROM $roles_table jr
            LEFT JOIN $permissions_table p ON jr.id = p.job_role_id
            ORDER BY jr.tier DESC, jr.title ASC",
            ARRAY_A
        );

        foreach ( $results as &$row ) {
            $row['job_role_id'] = (int) $row['job_role_id'];
            $row['job_role_tier'] = (int) $row['job_role_tier'];
            foreach ( $row as $key => $value ) {
                if ( strpos( $key, 'srm_' ) === 0 ) {
                    $row[ $key ] = (bool) $value;
                }
            }
        }
        
        // Cache for 1 hour
        set_transient( $cache_key, $results, HOUR_IN_SECONDS );

        return $results;
    }
    
    /**
     * Clear the SRM role permissions cache
     */
    public static function clear_role_permissions_cache() {
        delete_transient( 'srm_all_role_permissions' );
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

        $table = $wpdb->prefix . 'srm_permissions';
        $job_role_id = (int) $job_role_id;

        $data = [
            'srm_view_own_pay'      => isset( $permissions['srm_view_own_pay'] ) ? (int) (bool) $permissions['srm_view_own_pay'] : 1,
            'srm_view_all_pay'      => isset( $permissions['srm_view_all_pay'] ) ? (int) (bool) $permissions['srm_view_all_pay'] : 0,
            'srm_manage_pay_config' => isset( $permissions['srm_manage_pay_config'] ) ? (int) (bool) $permissions['srm_manage_pay_config'] : 0,
            'srm_send_invites'      => isset( $permissions['srm_send_invites'] ) ? (int) (bool) $permissions['srm_send_invites'] : 0,
            'srm_view_responses'    => isset( $permissions['srm_view_responses'] ) ? (int) (bool) $permissions['srm_view_responses'] : 0,
            'srm_manage_status'     => isset( $permissions['srm_manage_status'] ) ? (int) (bool) $permissions['srm_manage_status'] : 0,
            'srm_manage_templates'  => isset( $permissions['srm_manage_templates'] ) ? (int) (bool) $permissions['srm_manage_templates'] : 0,
            'srm_view_retention'    => isset( $permissions['srm_view_retention'] ) ? (int) (bool) $permissions['srm_view_retention'] : 0,
            'srm_bulk_actions'      => isset( $permissions['srm_bulk_actions'] ) ? (int) (bool) $permissions['srm_bulk_actions'] : 0,
        ];

        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE job_role_id = %d",
            $job_role_id
        ) );

        if ( $exists ) {
            $result = $wpdb->update(
                $table,
                $data,
                [ 'job_role_id' => $job_role_id ],
                array_fill( 0, count( $data ), '%d' ),
                [ '%d' ]
            ) !== false;
        } else {
            $data['job_role_id'] = $job_role_id;
            $result = $wpdb->insert(
                $table,
                $data,
                array_fill( 0, count( $data ), '%d' )
            ) !== false;
        }
        
        // Clear the role permissions cache when permissions change
        self::clear_role_permissions_cache();
        
        return $result;
    }

    // ========================================
    // PAY RATE CALCULATIONS
    // ========================================

    /**
     * Get the current active base rate
     * Uses transient caching since pay config rarely changes
     *
     * @param string|null $as_of_date Date to check (defaults to today)
     * @return float Base rate amount
     */
    public static function get_base_rate( $as_of_date = null ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_pay_config';
        $date = $as_of_date ? $as_of_date : current_time( 'Y-m-d' );
        
        // Use cache for today's date only
        if ( $as_of_date === null ) {
            $cache_key = 'srm_base_rate_' . $date;
            $cached = get_transient( $cache_key );
            if ( $cached !== false ) {
                return (float) $cached;
            }
        }
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        if ( ! $table_exists ) {
            return 0.00;
        }
        
        $rate = $wpdb->get_var( $wpdb->prepare(
            "SELECT amount FROM $table 
            WHERE config_type = 'base_rate' 
            AND is_active = 1 
            AND effective_date <= %s
            ORDER BY effective_date DESC 
            LIMIT 1",
            $date
        ) );
        
        $result = $rate ? (float) $rate : 0.00;
        
        // Cache today's rate for 24 hours
        if ( $as_of_date === null ) {
            set_transient( $cache_key, $result, DAY_IN_SECONDS );
        }
        
        return $result;
    }

    /**
     * Get the pay cap (maximum hourly rate)
     * Uses transient caching since pay config rarely changes
     *
     * @param string|null $as_of_date Date to check for (defaults to today)
     * @return float Pay cap amount (0 = no cap)
     */
    public static function get_pay_cap( $as_of_date = null ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_pay_config';
        $date = $as_of_date ? $as_of_date : current_time( 'Y-m-d' );
        
        // Use cache for today's date only
        if ( $as_of_date === null ) {
            $cache_key = 'srm_pay_cap_' . $date;
            $cached = get_transient( $cache_key );
            if ( $cached !== false ) {
                return (float) $cached;
            }
        }
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        if ( ! $table_exists ) {
            return 0.00;
        }
        
        $cap = $wpdb->get_var( $wpdb->prepare(
            "SELECT amount FROM $table 
            WHERE config_type = 'pay_cap' 
            AND is_active = 1 
            AND effective_date <= %s
            ORDER BY effective_date DESC 
            LIMIT 1",
            $date
        ) );
        
        $result = $cap ? (float) $cap : 0.00;
        
        // Cache today's cap for 24 hours
        if ( $as_of_date === null ) {
            set_transient( $cache_key, $result, DAY_IN_SECONDS );
        }
        
        return $result;
    }

    /**
     * Get the role bonus for a specific job role
     * Uses transient caching since pay config rarely changes
     *
     * @param int $job_role_id Job role ID
     * @return float Bonus amount
     */
    public static function get_role_bonus( $job_role_id ) {
        global $wpdb;
        
        // Check cache first
        $cache_key = 'srm_role_bonus_' . $job_role_id;
        $cached = get_transient( $cache_key );
        if ( $cached !== false ) {
            return (float) $cached;
        }
        
        $table = $wpdb->prefix . 'srm_pay_config';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        if ( ! $table_exists ) {
            return 0.00;
        }
        
        $bonus = $wpdb->get_var( $wpdb->prepare(
            "SELECT amount FROM $table 
            WHERE config_type = 'role_bonus' 
            AND job_role_id = %d 
            AND is_active = 1
            ORDER BY effective_date DESC 
            LIMIT 1",
            $job_role_id
        ) );
        
        $result = $bonus ? (float) $bonus : 0.00;
        
        // Cache for 24 hours
        set_transient( $cache_key, $result, DAY_IN_SECONDS );
        
        return $result;
    }
    
    /**
     * Clear all pay configuration caches
     */
    public static function clear_pay_config_cache() {
        global $wpdb;
        
        // Clear today's base rate and pay cap
        $today = current_time( 'Y-m-d' );
        delete_transient( 'srm_base_rate_' . $today );
        delete_transient( 'srm_pay_cap_' . $today );
        
        // Clear all role bonus caches
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        $role_ids = $wpdb->get_col( "SELECT id FROM $roles_table" );
        foreach ( $role_ids as $role_id ) {
            delete_transient( 'srm_role_bonus_' . $role_id );
        }
    }

    /**
     * Get the highest role bonus for an employee (non-cumulative)
     *
     * @param int $user_id User ID
     * @return array ['amount' => float, 'role_name' => string, 'role_id' => int]
     */
    public static function get_highest_role_bonus( $user_id ) {
        global $wpdb;
        
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        $table = $wpdb->prefix . 'srm_pay_config';
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        
        // Check if tables exist
        $pay_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        $assignments_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" );
        
        if ( ! $pay_table_exists || ! $assignments_table_exists ) {
            return [ 'amount' => 0.00, 'role_name' => '', 'role_id' => 0 ];
        }
        
        // Get user's job role IDs from the assignments table
        $user_job_roles = $wpdb->get_col( $wpdb->prepare(
            "SELECT job_role_id FROM $assignments_table WHERE user_id = %d",
            $user_id
        ) );
        
        if ( empty( $user_job_roles ) ) {
            return [ 'amount' => 0.00, 'role_name' => '', 'role_id' => 0 ];
        }
        
        $role_ids = array_map( 'intval', $user_job_roles );
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        $query_sql = "SELECT pc.amount, jr.title as role_name, jr.id as role_id
            FROM $table pc
            JOIN $roles_table jr ON pc.job_role_id = jr.id
            WHERE pc.config_type = 'role_bonus' 
            AND pc.job_role_id IN ($placeholders)
            AND pc.is_active = 1
            ORDER BY pc.amount DESC
            LIMIT 1";
        
        $query = call_user_func_array( 
            array( $wpdb, 'prepare' ), 
            array_merge( array( $query_sql ), $role_ids ) 
        );
        
        $result = $wpdb->get_row( $query, ARRAY_A );
        
        if ( $result ) {
            return [
                'amount' => (float) $result['amount'],
                'role_name' => $result['role_name'],
                'role_id' => (int) $result['role_id']
            ];
        }
        
        return [ 'amount' => 0.00, 'role_name' => '', 'role_id' => 0 ];
    }

    /**
     * Get longevity bonus based on years of service
     * 
     * NEW SYSTEM (if srm_employee_work_years populated):
     * - Sums the rate for each year the employee worked (except first year)
     * - Supports variable rates per year and gaps in employment
     * 
     * LEGACY SYSTEM (fallback):
     * - Formula: ((years_of_service - 1) * longevity_bonus_amount)
     * 
     * Year 1 (in their 1st year): No bonus (0x amount)
     * Year 2 (in their 2nd year): 1x amount
     * Year 3 (in their 3rd year): 2x amount
     * Year 4 (in their 4th year): 3x amount, etc.
     *
     * @param int $years Years of service (1-based) - used for legacy fallback
     * @param int|null $user_id User ID for new year-based calculation
     * @return float Bonus amount
     */
    public static function get_longevity_bonus( $years, $user_id = null, $projection_year = null ) {
        global $wpdb;
        
        // No bonus for year 1 or less
        if ( $years < 1 ) {
            return 0.00;
        }
        
        // Try new year-based system if user_id provided
        if ( $user_id ) {
            $years_table = $wpdb->prefix . 'srm_employee_work_years';
            $rates_table = $wpdb->prefix . 'srm_longevity_rates';
            
            // Check if tables exist first
            $years_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$years_table'" );
            $rates_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$rates_table'" );
            
            if ( $years_table_exists && $rates_table_exists ) {
                // NEW YEAR-BASED SYSTEM: Use the tables regardless of whether user has years tracked
                // Get user's work years
                $work_years = $wpdb->get_col( $wpdb->prepare(
                    "SELECT work_year FROM $years_table WHERE user_id = %d ORDER BY work_year ASC",
                    $user_id
                ) );
                
                // For projections, add the upcoming year to simulate them returning
                if ( $projection_year && ! in_array( $projection_year, $work_years ) ) {
                    $work_years[] = (int) $projection_year;
                    sort( $work_years );
                }
                
                // Debug logging
                error_log( sprintf(
                    '[Longevity] User %d: work_years=%s, projection_year=%s',
                    $user_id,
                    json_encode( $work_years ),
                    $projection_year ? $projection_year : 'null'
                ) );
                
                // If no work years tracked, return $0 (they're new or haven't been migrated)
                if ( empty( $work_years ) ) {
                    return 0.00;
                }
                
                // Calculate bonus based on year-specific rates
                $rates = $wpdb->get_results(
                    "SELECT work_year, rate FROM $rates_table",
                    OBJECT_K
                );
                
                error_log( sprintf(
                    '[Longevity] Available rates: %s',
                    json_encode( array_map( function($r) { return ['year' => $r->work_year, 'rate' => $r->rate]; }, $rates ) )
                ) );
                
                $total_bonus = 0;
                foreach ( $work_years as $index => $year ) {
                    // Skip first year - no bonus
                    if ( $index === 0 ) {
                        error_log( "[Longevity] Skipping index $index (year $year) - first year" );
                        continue;
                    }
                    
                    // Add rate for this year (or 0 if not set)
                    $rate = isset( $rates[$year] ) ? floatval( $rates[$year]->rate ) : 0;
                    error_log( sprintf(
                        '[Longevity] Index %d, Year %d: rate=%s (found=%s)',
                        $index, $year, $rate, isset( $rates[$year] ) ? 'yes' : 'no'
                    ) );
                    $total_bonus += $rate;
                }
                
                error_log( "[Longevity] Total bonus: $total_bonus" );
                
                return round( $total_bonus, 2 );
            }
        }
        
        // Fall back to legacy system ONLY if tables don't exist
        static $bonus_amount = null;
        
        if ( $bonus_amount === null ) {
            $table = $wpdb->prefix . 'srm_pay_config';
            
            // Get the base longevity bonus amount (should only be one active config)
            $bonus_amount = $wpdb->get_var(
                "SELECT amount FROM $table 
                WHERE config_type = 'longevity_tier' 
                AND is_active = 1
                LIMIT 1"
            );
            
            if ( ! $bonus_amount ) {
                $bonus_amount = 0;
            }
        }
        
        if ( ! $bonus_amount ) {
            return 0.00;
        }
        
        // Calculate: (years - 1) * bonus_amount
        // Year 1 = 0x amount ($0)
        // Year 2 = 1x amount
        // Year 3 = 2x amount
        // Year 4 = 3x amount, etc.
        return ( $years - 1 ) * (float) $bonus_amount;
    }

    /**
     * Get longevity breakdown with year-by-year bonus amounts
     * Shows each work year and the bonus earned for that year
     *
     * @param int $user_id User ID
     * @param int|null $projected_year Optional year to project (for "if returning" scenarios)
     * @return array Array of year breakdown with rates
     */
    public static function get_longevity_breakdown( $user_id, $projected_year = null ) {
        global $wpdb;
        
        $years_table = $wpdb->prefix . 'srm_employee_work_years';
        $rates_table = $wpdb->prefix . 'srm_longevity_rates';
        
        // Check if tables exist
        $years_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$years_table'" );
        $rates_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$rates_table'" );
        
        if ( ! $years_table_exists || ! $rates_table_exists ) {
            return [];
        }
        
        // Get user's work years
        $work_years = $wpdb->get_col( $wpdb->prepare(
            "SELECT work_year FROM $years_table WHERE user_id = %d ORDER BY work_year ASC",
            $user_id
        ) );
        
        // For projections, add the upcoming year
        if ( $projected_year && ! in_array( $projected_year, $work_years ) ) {
            $work_years[] = (int) $projected_year;
            sort( $work_years );
        }
        
        if ( empty( $work_years ) ) {
            return [];
        }
        
        // Get all rates
        $rates = $wpdb->get_results(
            "SELECT work_year, rate FROM $rates_table",
            OBJECT_K
        );
        
        // Build breakdown array
        $breakdown = [];
        
        foreach ( $work_years as $index => $year ) {
            if ( $index === 0 ) {
                // First year - no bonus
                $breakdown[] = [
                    'year' => (int) $year,
                    'rate' => 0.00,
                    'note' => 'Began working - no return bonus',
                    'is_first_year' => true
                ];
            } else {
                // Subsequent years - get rate
                $rate = isset( $rates[$year] ) ? (float) $rates[$year]->rate : 0.00;
                $breakdown[] = [
                    'year' => (int) $year,
                    'rate' => $rate,
                    'note' => $rate > 0 ? null : 'No rate configured',
                    'is_first_year' => false
                ];
            }
        }
        
        return $breakdown;
    }

    /**
     * Get all active time-based bonuses for a given date
     *
     * @param string|null $as_of_date Date to check (defaults to today)
     * @return array Array of active time bonuses
     */
    public static function get_active_time_bonuses( $as_of_date = null ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_pay_config';
        $date = $as_of_date ? $as_of_date : current_time( 'Y-m-d' );
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        if ( ! $table_exists ) {
            return [];
        }
        
        // For recurring bonuses, we need to check month-day ranges
        // For non-recurring, we check the exact date range
        $results = $wpdb->get_results(
            "SELECT id, name, amount, start_date, end_date, is_recurring
            FROM $table 
            WHERE config_type = 'time_bonus' 
            AND is_active = 1",
            ARRAY_A
        );
        
        $active_bonuses = [];
        $check_date = new DateTime( $date );
        
        foreach ( $results as $bonus ) {
            $is_active = false;
            
            if ( $bonus['is_recurring'] ) {
                // For recurring bonuses, check month-day only
                $check_md = $check_date->format( 'm-d' );
                $start_md = ( new DateTime( $bonus['start_date'] ) )->format( 'm-d' );
                $end_md = ( new DateTime( $bonus['end_date'] ) )->format( 'm-d' );
                
                // Handle wrap-around (e.g., Sept to May spans year boundary)
                if ( $start_md <= $end_md ) {
                    $is_active = ( $check_md >= $start_md && $check_md <= $end_md );
                } else {
                    $is_active = ( $check_md >= $start_md || $check_md <= $end_md );
                }
            } else {
                // Non-recurring: exact date range
                $start = new DateTime( $bonus['start_date'] );
                $end = new DateTime( $bonus['end_date'] );
                $is_active = ( $check_date >= $start && $check_date <= $end );
            }
            
            if ( $is_active ) {
                $active_bonuses[] = [
                    'id' => (int) $bonus['id'],
                    'name' => $bonus['name'],
                    'amount' => (float) $bonus['amount']
                ];
            }
        }
        
        return $active_bonuses;
    }

    /**
     * Calculate complete pay breakdown for an employee
     *
     * @param int $user_id User ID
     * @param string|null $as_of_date Date to calculate for (defaults to today)
     * @param bool $include_time_bonuses Whether to include time-based bonuses
     * @return array Complete pay breakdown
     */
    public static function calculate_pay_rate( $user_id, $as_of_date = null, $include_time_bonuses = true ) {
        $date = $as_of_date ? $as_of_date : current_time( 'Y-m-d' );
        
        // Get longevity years for this user
        $longevity_years = self::get_employee_longevity_years( $user_id );
        
        // Get base rate
        $base_rate = self::get_base_rate( $date );
        
        // Get highest role bonus (non-cumulative)
        $role_bonus_data = self::get_highest_role_bonus( $user_id );
        
        // Get longevity bonus (pass user_id for new year-based calculation)
        $longevity_bonus = self::get_longevity_bonus( $longevity_years, $user_id );
        
        // Get time bonuses
        $time_bonuses = [];
        $time_bonus_total = 0.00;
        
        if ( $include_time_bonuses ) {
            $time_bonuses = self::get_active_time_bonuses( $date );
            foreach ( $time_bonuses as $bonus ) {
                $time_bonus_total += $bonus['amount'];
            }
        }
        
        // Calculate total
        $total = $base_rate + $role_bonus_data['amount'] + $longevity_bonus + $time_bonus_total;
        
        // Apply pay cap if configured
        $pay_cap = self::get_pay_cap( $date );
        $is_capped = false;
        if ( $pay_cap > 0 && $total > $pay_cap ) {
            $total = $pay_cap;
            $is_capped = true;
        }
        
        // Get actual work years logged for clarity
        $work_years_logged = self::get_work_years_logged( $user_id );
        
        // Get year-by-year longevity breakdown
        $longevity_breakdown = self::get_longevity_breakdown( $user_id );
        
        return [
            'user_id' => $user_id,
            'as_of_date' => $date,
            'base_rate' => $base_rate,
            'role_bonus' => [
                'amount' => $role_bonus_data['amount'],
                'role_name' => $role_bonus_data['role_name'],
                'role_id' => $role_bonus_data['role_id']
            ],
            'longevity' => [
                'years' => $longevity_years,                    // "In their Nth year" (display number)
                'work_years_logged' => $work_years_logged['count'],  // Actual years in database
                'work_years_list' => $work_years_logged['years'],    // Array of calendar years
                'bonus' => $longevity_bonus,
                'breakdown' => $longevity_breakdown              // Year-by-year breakdown
            ],
            'time_bonuses' => $time_bonuses,
            'time_bonus_total' => $time_bonus_total,
            'pay_cap' => $pay_cap,
            'is_capped' => $is_capped,
            'total' => round( $total, 2 )
        ];
    }

    /**
     * Calculate projected pay rate for next season
     *
     * @param int $user_id User ID
     * @param int|null $season_id Season ID to project for (uses next active season if null)
     * @param array|null $role_override Override job roles for "what if" scenarios
     * @return array Projected pay breakdown
     */
    public static function calculate_projected_pay_rate( $user_id, $season_id = null, $role_override = null ) {
        global $wpdb;
        
        $seasons_table = $wpdb->prefix . 'srm_seasons';
        
        // Check if seasons table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$seasons_table'" );
        
        // Get next season's start date
        if ( $season_id && $table_exists ) {
            $season = $wpdb->get_row( $wpdb->prepare(
                "SELECT * FROM $seasons_table WHERE id = %d",
                $season_id
            ) );
        } elseif ( $table_exists ) {
            // Get next recruiting season
            $season = $wpdb->get_row(
                "SELECT * FROM $seasons_table 
                WHERE is_active = 1 AND start_date > CURDATE()
                ORDER BY start_date ASC LIMIT 1"
            );
        } else {
            $season = null;
        }
        
        $projection_date = $season ? $season->start_date : date( 'Y-m-d', strtotime( '+1 year' ) );
        
        // Determine the projection year for longevity calculation
        $anniversary_mode = get_option( 'srm_anniversary_year_mode', 'season' );
        
        if ( $anniversary_mode === 'season' && $season && isset( $season->year ) ) {
            // Use the season's business year (e.g., "Summer 2026" -> 2026)
            $projection_year = (int) $season->year;
        } elseif ( $anniversary_mode === 'fixed_date' ) {
            // Use a fixed date each year to determine when longevity advances
            // If projection_date is after the fixed date this year, use this year; otherwise last year
            $fixed_date = get_option( 'srm_anniversary_date', '05-01' ); // Default May 1
            $fixed_date_this_year = date( 'Y' ) . '-' . $fixed_date;
            
            if ( strtotime( $projection_date ) >= strtotime( $fixed_date_this_year ) ) {
                $projection_year = (int) date( 'Y', strtotime( $projection_date ) );
            } else {
                $projection_year = (int) date( 'Y', strtotime( $projection_date ) ) - 1;
            }
        } else {
            // Calendar mode or anniversary mode: use the calendar year from the season start date
            $projection_year = (int) date( 'Y', strtotime( $projection_date ) );
        }
        
        // Get current longevity and add 1 year (assuming they return)
        $current_longevity = self::get_employee_longevity_years( $user_id );
        $projected_longevity = $current_longevity + 1;
        
        // Get base rate (may have scheduled increases)
        $base_rate = self::get_base_rate( $projection_date );
        
        // Get role bonus (use override if provided for "what if" scenarios)
        if ( $role_override ) {
            // Calculate highest bonus from override roles
            $highest_bonus = 0.00;
            $highest_role_name = '';
            $highest_role_id = 0;
            
            foreach ( $role_override as $role_id ) {
                $bonus = self::get_role_bonus( $role_id );
                if ( $bonus > $highest_bonus ) {
                    $highest_bonus = $bonus;
                    $highest_role_id = $role_id;
                    // Get role name
                    $highest_role_name = $wpdb->get_var( $wpdb->prepare(
                        "SELECT title FROM {$wpdb->prefix}pg_job_roles WHERE id = %d",
                        $role_id
                    ) );
                }
            }
            
            $role_bonus_data = [
                'amount' => $highest_bonus,
                'role_name' => $highest_role_name,
                'role_id' => $highest_role_id
            ];
        } else {
            $role_bonus_data = self::get_highest_role_bonus( $user_id );
        }
        
        // Get longevity bonus for projected years (pass projection_year for year-based calculation)
        $longevity_bonus = self::get_longevity_bonus( $projected_longevity, $user_id, $projection_year );
        
        // For projected pay, don't include time bonuses by default
        // Time bonuses are temporary and shouldn't be considered part of the projected "base" pay
        // They would only apply during specific periods within the season
        $time_bonuses = [];
        $time_bonus_total = 0.00;
        
        $total = $base_rate + $role_bonus_data['amount'] + $longevity_bonus + $time_bonus_total;
        
        // Apply pay cap if configured
        $pay_cap = self::get_pay_cap( $projection_date );
        $is_capped = false;
        if ( $pay_cap > 0 && $total > $pay_cap ) {
            $total = $pay_cap;
            $is_capped = true;
        }
        
        // Get projected longevity breakdown (includes the projection year)
        $longevity_breakdown = self::get_longevity_breakdown( $user_id, $projection_year );
        
        return [
            'user_id' => $user_id,
            'projection_date' => $projection_date,
            'season_id' => $season ? $season->id : null,
            'season_name' => $season ? $season->name : 'Next Season',
            'base_rate' => $base_rate,
            'role_bonus' => $role_bonus_data,
            'longevity' => [
                'current_years' => $current_longevity,
                'projected_years' => $projected_longevity,
                'bonus' => $longevity_bonus,
                'breakdown' => $longevity_breakdown              // Year-by-year breakdown with projection
            ],
            'time_bonuses' => $time_bonuses,
            'time_bonus_total' => $time_bonus_total,
            'pay_cap' => $pay_cap,
            'is_capped' => $is_capped,
            'total' => round( $total, 2 )
        ];
    }

    /**
     * Get employee's longevity years (seasons worked)
     * 
     * Priority order:
     * 1. Manual override (srm_longevity_years user meta)
     * 2. Work years table count (srm_employee_work_years) - PRIMARY SOURCE
     * 3. Completed seasons count (legacy fallback)
     *
     * @param int $user_id User ID
     * @return int Years of service
     */
    public static function get_employee_longevity_years( $user_id ) {
        global $wpdb;
        
        // First check if there's a manual override in user meta
        $manual_longevity = get_user_meta( $user_id, 'srm_longevity_years', true );
        if ( $manual_longevity !== '' && is_numeric( $manual_longevity ) ) {
            return (int) $manual_longevity;
        }
        
        // SECOND: Check work years table - this is the primary source of truth
        $work_years_table = $wpdb->prefix . 'srm_employee_work_years';
        $work_years_exists = $wpdb->get_var( "SHOW TABLES LIKE '$work_years_table'" );
        
        if ( $work_years_exists ) {
            $work_years_count = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM $work_years_table WHERE user_id = %d",
                $user_id
            ) );
            
            // If user has work years recorded, use that count
            if ( $work_years_count > 0 ) {
                return (int) $work_years_count;
            }
        }
        
        // LEGACY FALLBACK: Count completed seasons and add 1 (everyone starts in year 1, not year 0)
        $table = $wpdb->prefix . 'srm_employee_seasons';
        $seasons_table = $wpdb->prefix . 'srm_seasons';
        
        // Check if tables exist before querying
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        $seasons_table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$seasons_table'" );
        
        if ( ! $table_exists || ! $seasons_table_exists ) {
            // Tables don't exist yet, return default value
            return 1;
        }
        
        $count = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(DISTINCT es.season_id) 
            FROM $table es
            JOIN $seasons_table s ON es.season_id = s.id
            WHERE es.user_id = %d 
            AND es.status = 'returning'
            AND s.end_date < CURDATE()",
            $user_id
        ) );
        
        // Return count + 1 (year 1 = 0 completed seasons, year 2 = 1 completed, etc.)
        return $count ? (int) $count + 1 : 1;
    }

    /**
     * Get actual work years logged for an employee from the work years table
     * 
     * This returns the ACTUAL calendar years stored in srm_employee_work_years,
     * which is the source of truth for longevity calculations.
     *
     * @param int $user_id User ID
     * @return array ['count' => int, 'years' => array of calendar years]
     */
    public static function get_work_years_logged( $user_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_employee_work_years';
        
        // Check if table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" ) === $table;
        if ( ! $table_exists ) {
            return [ 'count' => 0, 'years' => [] ];
        }
        
        $years = $wpdb->get_col( $wpdb->prepare(
            "SELECT work_year FROM $table WHERE user_id = %d ORDER BY work_year ASC",
            $user_id
        ) );
        
        return [
            'count' => count( $years ),
            'years' => array_map( 'intval', $years )
        ];
    }

    // ========================================
    // TOKEN MANAGEMENT
    // ========================================

    /**
     * Generate a secure return intent token for an employee
     *
     * @param int $user_id User ID
     * @param int $season_id Season ID
     * @param int $expiry_days Days until token expires (default 30)
     * @return string Generated token
     */
    public static function generate_return_token( $user_id, $season_id, $expiry_days = null ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_employee_seasons';
        
        // Verify table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table'" );
        if ( ! $table_exists ) {
            error_log("SRM ERROR: Table $table does not exist! Run plugin activation to create tables.");
            return false;
        }
        
        // Generate cryptographically secure token
        $token = bin2hex( random_bytes( 32 ) );
        
        // Token expires_at is NULL by default (indefinite until cancelled)
        // If expiry_days is explicitly set, calculate expiration date
        $expires_at_sql = 'NULL';
        $expires_at_display = 'NULL (indefinite)';
        if ( $expiry_days !== null && $expiry_days > 0 ) {
            $expires_at_val = $wpdb->get_var( $wpdb->prepare(
                "SELECT DATE_ADD(NOW(), INTERVAL %d DAY)",
                $expiry_days
            ) );
            $expires_at_sql = $wpdb->prepare( '%s', $expires_at_val );
            $expires_at_display = $expires_at_val;
        }
        
        // Check if record exists
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE user_id = %d AND season_id = %d",
            $user_id,
            $season_id
        ) );
        
        if ( $existing ) {
            // Use raw query to properly handle NULL values for token_expires_at,
            // response_date, signature_text, and comments. $wpdb->update() with %s
            // format can convert PHP null to empty string '' instead of SQL NULL,
            // which breaks the expiry validation check.
            $result = $wpdb->query( $wpdb->prepare(
                "UPDATE $table 
                SET return_token = %s, 
                    token_expires_at = $expires_at_sql, 
                    status = 'pending', 
                    response_date = NULL, 
                    signature_text = NULL, 
                    comments = NULL 
                WHERE user_id = %d AND season_id = %d",
                $token,
                $user_id,
                $season_id
            ) );
            if ( $result === false ) {
                error_log("SRM ERROR: Failed to update token for user $user_id, season $season_id. DB error: " . $wpdb->last_error);
                return false;
            }
        } else {
            $result = $wpdb->query( $wpdb->prepare(
                "INSERT INTO $table (user_id, season_id, return_token, token_expires_at, status, eligible_for_rehire)
                VALUES (%d, %d, %s, $expires_at_sql, 'pending', 1)",
                $user_id,
                $season_id,
                $token
            ) );
            if ( $result === false ) {
                error_log("SRM ERROR: Failed to insert token for user $user_id, season $season_id. DB error: " . $wpdb->last_error);
                return false;
            }
        }
        
        // VERIFY the token was actually saved
        $verify = $wpdb->get_var( $wpdb->prepare(
            "SELECT return_token FROM $table WHERE user_id = %d AND season_id = %d",
            $user_id,
            $season_id
        ) );
        if ( $verify !== $token ) {
            error_log("SRM ERROR: Token verification failed! Expected: " . substr($token, 0, 16) . "..., Got: " . ($verify ? substr($verify, 0, 16) . '...' : 'NULL'));
            return false;
        }
        
        return $token;
    }

    /**
     * Validate a return token and get associated data.
     *
     * IMPORTANT: Do NOT use SQL table aliases in queries within this function.
     * Example: Use "SELECT * FROM $table WHERE ..." NOT "SELECT es.* FROM $table es WHERE ..."
     * 
     * Reason: The hosting environment's MySQL configuration has compatibility issues
     * with table aliases that cause queries to silently return NULL. This was discovered
     * in Feb 2026 after extensive debugging. See diagnostic endpoints:
     * - /wp-json/mentorship-platform/v1/srm/diagnostic
     * - /wp-json/mentorship-platform/v1/srm/return-form-check/{token}
     *
     * @param string $token Token to validate
     * @return array|WP_Error Employee/season data or WP_Error if invalid
     */
    public static function validate_return_token( $token ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_employee_seasons';
        $seasons_table = $wpdb->prefix . 'srm_seasons';
        
        // Look up token - NO TABLE ALIASES (see docblock for why)
        $token_row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, return_token, token_expires_at FROM $table WHERE return_token = %s",
            $token
        ), ARRAY_A );
        
        if (!$token_row) {
            error_log("SRM: Token not found in database: " . substr($token, 0, 20) . "...");
            return new WP_Error(
                'token_not_found',
                'This link is not recognized. It may have been replaced when a new email was sent. Please use the link from the most recent email.',
                array( 'status' => 404 )
            );
        }
        
        // Calculate is_valid manually instead of in SQL
        $expires_at = $token_row['token_expires_at'];
        $is_valid = true;
        if ( $expires_at && $expires_at !== '' && $expires_at !== '0000-00-00 00:00:00' ) {
            $is_valid = strtotime( $expires_at ) > time();
        }
        
        $token_check = array(
            'id' => $token_row['id'],
            'return_token' => $token_row['return_token'],
            'token_expires_at' => $expires_at,
            'is_valid' => $is_valid ? '1' : '0',
        );
        
        if (!$token_check['is_valid']) {
            return new WP_Error(
                'token_expired',
                'This link has expired. Please contact your supervisor to request a new one.',
                array( 'status' => 410, 'expired_at' => $token_check['token_expires_at'] )
            );
        }
        
        // Clean up corrupted empty-string expires_at values while we're here
        if ( $token_check['token_expires_at'] === '' ) {
            $wpdb->query( $wpdb->prepare(
                "UPDATE $table SET token_expires_at = NULL WHERE id = %d",
                $token_check['id']
            ) );
        }
        
        // Token is valid, get full data using the record ID (more reliable than re-querying by token)
        $record_id = $token_check['id'];
        $result = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d",
            $record_id
        ), ARRAY_A );
        
        // Get season data separately to avoid alias issues
        if ( $result && $result['season_id'] ) {
            $season_data = $wpdb->get_row( $wpdb->prepare(
                "SELECT name AS season_name, start_date AS season_start, end_date AS season_end FROM $seasons_table WHERE id = %d",
                $result['season_id']
            ), ARRAY_A );
            if ( $season_data ) {
                $result = array_merge( $result, $season_data );
            }
        }
        
        if ( ! $result ) {
            return new WP_Error(
                'data_load_error',
                'Unable to load form data. Please try again or contact your supervisor.',
                array( 'status' => 500 )
            );
        }
        
        // Get user info
        $user = get_userdata( $result['user_id'] );
        if ( ! $user ) {
            return new WP_Error(
                'user_not_found',
                'Your user account could not be found. Please contact your supervisor.',
                array( 'status' => 404 )
            );
        }
        
        $result['user'] = [
            'id' => $user->ID,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->user_email,
            'display_name' => $user->display_name
        ];
        
        // Get job roles using unified helper (checks assignments table first, then user meta fallback)
        $result['job_roles'] = self::get_user_job_roles( $user->ID );
        
        // Get pay breakdown
        $result['pay_breakdown'] = self::calculate_pay_rate( $result['user_id'] );
        $result['projected_pay'] = self::calculate_projected_pay_rate( $result['user_id'], $result['season_id'] );
        
        return $result;
    }

    /**
     * Process a return intent submission
     *
     * @param string $token Return token
     * @param bool $is_returning Whether they're returning
     * @param string $signature Digital signature text
     * @param string|null $comments Optional comments
     * @return array|WP_Error Result or error
     */
    public static function submit_return_intent( $token, $is_returning, $signature, $comments = null ) {
        global $wpdb;
        
        // Validate token (returns WP_Error on failure)
        $data = self::validate_return_token( $token );
        if ( is_wp_error( $data ) ) {
            return $data;
        }
        
        // Allow updates - track if this is an update vs initial submission
        $is_update = ! empty( $data['response_date'] );
        
        $table = $wpdb->prefix . 'srm_employee_seasons';
        
        $update_result = $wpdb->update(
            $table,
            [
                'status' => $is_returning ? 'returning' : 'not_returning',
                'response_date' => current_time( 'mysql' ),
                'signature_text' => sanitize_text_field( $signature ),
                'comments' => $comments ? sanitize_textarea_field( $comments ) : null
            ],
            [ 'return_token' => $token ],
            [ '%s', '%s', '%s', '%s' ],
            [ '%s' ]
        );
        
        if ( $update_result === false ) {
            return new WP_Error( 'update_failed', 'Failed to save your response. Please try again.' );
        }
        
        // Send confirmation email
        self::send_return_confirmation_email( $data['user_id'], $data['season_id'], $is_returning );
        
        return [
            'success' => true,
            'status' => $is_returning ? 'returning' : 'not_returning',
            'message' => $is_returning 
                ? 'Thank you! We\'re excited to have you back!' 
                : 'Thank you for letting us know. Best wishes for your future endeavors!'
        ];
    }

    // ========================================
    // EMAIL HANDLING
    // ========================================

    /**
     * Send return confirmation email
     *
     * @param int $user_id User ID
     * @param int $season_id Season ID
     * @param bool $is_returning Whether they're returning
     */
    public static function send_return_confirmation_email( $user_id, $season_id, $is_returning ) {
        global $wpdb;
        
        $user = get_userdata( $user_id );
        if ( ! $user ) return;
        
        $season = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}srm_seasons WHERE id = %d",
            $season_id
        ) );
        
        $season_name = $season ? $season->name : 'the upcoming season';
        
        if ( $is_returning ) {
            $subject = "Confirmation: You're returning for {$season_name}!";
            $message = "Hi {$user->first_name},\n\n";
            $message .= "This email confirms that you've indicated you will be returning for {$season_name}.\n\n";
            $message .= "We're excited to have you back on the team!\n\n";
            $message .= "If you have any questions, please reach out to your supervisor.\n\n";
            $message .= "Best regards,\nThe Team";
        } else {
            $subject = "Confirmation: {$season_name} Return Intent";
            $message = "Hi {$user->first_name},\n\n";
            $message .= "This email confirms that you've indicated you will not be returning for {$season_name}.\n\n";
            $message .= "We appreciate your time with us and wish you all the best in your future endeavors.\n\n";
            $message .= "If your circumstances change, please reach out.\n\n";
            $message .= "Best regards,\nThe Team";
        }
        
        wp_mail( $user->user_email, $subject, $message );
    }

    /**
     * Get email template with placeholders replaced
     *
     * @param int $template_id Template ID
     * @param int $user_id User ID
     * @param int $season_id Season ID
     * @param bool $preview If true, uses existing token or placeholder instead of generating a new token.
     *                      This prevents previews from overwriting real tokens in the database.
     * @return array ['subject' => string, 'body' => string, 'token' => string, 'form_link' => string]
     */
    public static function render_email_template( $template_id, $user_id, $season_id, $preview = false ) {
        global $wpdb;
        
        $template = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}srm_email_templates WHERE id = %d",
            $template_id
        ), ARRAY_A );
        
        if ( ! $template ) {
            return null;
        }
        
        $user = get_userdata( $user_id );
        $season = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}srm_seasons WHERE id = %d",
            $season_id
        ) );
        
        $pay = self::calculate_pay_rate( $user_id );
        $projected = self::calculate_projected_pay_rate( $user_id, $season_id );
        
        // Get job roles using the unified helper method
        $job_roles = self::get_user_job_roles( $user_id );
        $roles_list = implode( ', ', array_column( $job_roles, 'title' ) );
        $highest_role = ! empty( $job_roles ) ? $job_roles[0]['title'] : '';
        
        // Generate or retrieve token and form link
        if ( $preview ) {
            // Preview mode: use existing token from DB if available, otherwise use a placeholder.
            // This prevents previews from overwriting real tokens that were already sent to employees.
            $table = $wpdb->prefix . 'srm_employee_seasons';
            $existing_token = $wpdb->get_var( $wpdb->prepare(
                "SELECT return_token FROM $table WHERE user_id = %d AND season_id = %d AND return_token IS NOT NULL",
                $user_id,
                $season_id
            ) );
            $token = $existing_token ?: 'preview-token-placeholder';
            // Use path-based URL format to avoid = encoding issues in emails
            $form_link = home_url( "/return-form/{$token}" );
        } else {
            // Real send: generate a new cryptographic token
            $token = self::generate_return_token( $user_id, $season_id );
            if ( ! $token ) {
                error_log("SRM ERROR: Failed to generate token for email to user $user_id, season $season_id");
                return false; // Return false so the caller knows the email shouldn't be sent
            }
            // Use path-based URL format to avoid = encoding issues in emails
            $form_link = home_url( "/return-form/{$token}" );
        }
        
        // Placeholder replacements
        $placeholders = [
            '{{first_name}}' => $user->first_name,
            '{{last_name}}' => $user->last_name,
            '{{full_name}}' => $user->first_name . ' ' . $user->last_name,
            '{{job_roles}}' => $roles_list,
            '{{highest_role}}' => $highest_role,
            '{{current_pay_rate}}' => '$' . number_format( $pay['total'], 2 ),
            '{{projected_pay_rate}}' => '$' . number_format( $projected['total'], 2 ),
            '{{base_rate}}' => '$' . number_format( $pay['base_rate'], 2 ),
            '{{role_bonus}}' => '$' . number_format( $pay['role_bonus']['amount'], 2 ),
            '{{longevity_bonus}}' => '$' . number_format( $pay['longevity']['bonus'], 2 ),
            '{{longevity_years}}' => $pay['longevity']['years'],
            '{{season_name}}' => $season ? $season->name : 'the upcoming season',
            '{{return_form_link}}' => $form_link,
            '{{response_deadline}}' => $season ? date( 'F j, Y', strtotime( $season->start_date . ' -30 days' ) ) : 'soon'
        ];
        
        $subject = str_replace( array_keys( $placeholders ), array_values( $placeholders ), $template['subject'] );
        $body = str_replace( array_keys( $placeholders ), array_values( $placeholders ), $template['body_html'] );
        
        return [
            'subject' => $subject,
            'body' => $body,
            'token' => $token,
            'form_link' => $form_link
        ];
    }

    // ========================================
    // RETENTION STATISTICS
    // ========================================

    /**
     * Calculate retention statistics for a season
     *
     * @param int $season_id Season ID
     * @return array Retention statistics
     */
    public static function calculate_retention_stats( $season_id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'srm_employee_seasons';
        
        $stats = $wpdb->get_row( $wpdb->prepare(
            "SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN eligible_for_rehire = 1 THEN 1 ELSE 0 END) as total_eligible,
                SUM(CASE WHEN return_token IS NOT NULL THEN 1 ELSE 0 END) as total_invited,
                SUM(CASE WHEN status = 'returning' THEN 1 ELSE 0 END) as total_returning,
                SUM(CASE WHEN status = 'not_returning' THEN 1 ELSE 0 END) as total_not_returning,
                SUM(CASE WHEN status = 'pending' AND return_token IS NOT NULL THEN 1 ELSE 0 END) as total_pending,
                SUM(CASE WHEN status = 'ineligible' OR eligible_for_rehire = 0 THEN 1 ELSE 0 END) as total_ineligible,
                SUM(CASE WHEN is_new_hire = 1 THEN 1 ELSE 0 END) as total_new_hires
            FROM $table
            WHERE season_id = %d",
            $season_id
        ), ARRAY_A );
        
        $responded = (int) $stats['total_returning'] + (int) $stats['total_not_returning'];
        $retention_rate = $responded > 0 
            ? round( ( (int) $stats['total_returning'] / $responded ) * 100, 1 )
            : 0;
        
        return [
            'season_id' => $season_id,
            'total_eligible' => (int) $stats['total_eligible'],
            'total_invited' => (int) $stats['total_invited'],
            'total_returning' => (int) $stats['total_returning'],
            'total_not_returning' => (int) $stats['total_not_returning'],
            'total_pending' => (int) $stats['total_pending'],
            'total_ineligible' => (int) $stats['total_ineligible'],
            'total_new_hires' => (int) $stats['total_new_hires'],
            'retention_rate' => $retention_rate,
            'calculated_at' => current_time( 'mysql' )
        ];
    }

    /**
     * Save retention snapshot to history
     *
     * @param int $season_id Season ID
     * @return bool Success
     */
    public static function save_retention_snapshot( $season_id ) {
        global $wpdb;
        
        $stats = self::calculate_retention_stats( $season_id );
        
        return $wpdb->insert(
            $wpdb->prefix . 'srm_retention_stats',
            $stats,
            [ '%d', '%d', '%d', '%d', '%d', '%d', '%d', '%d', '%f', '%s' ]
        ) !== false;
    }

    /**
     * Get historical retention stats for comparison
     *
     * @param int $limit Number of seasons to retrieve
     * @return array Historical stats by season
     */
    public static function get_retention_history( $limit = 5 ) {
        global $wpdb;
        
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT rs.*, s.name as season_name, s.year
            FROM {$wpdb->prefix}srm_retention_stats rs
            JOIN {$wpdb->prefix}srm_seasons s ON rs.season_id = s.id
            ORDER BY s.start_date DESC
            LIMIT %d",
            $limit
        ), ARRAY_A );
    }

    // ========================================
    // PAY RATE CACHING SYSTEM
    // ========================================

    /**
     * Get cached pay data for a user, or calculate and cache if stale/missing
     *
     * @param int $user_id User ID
     * @param bool $include_projected Whether to include projected pay
     * @return array|null Pay data array or null on error
     */
    public static function get_cached_pay( $user_id, $include_projected = true ) {
        global $wpdb;
        
        $cache_table = $wpdb->prefix . 'srm_pay_cache';
        
        // Check if cache table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
        if ( ! $table_exists ) {
            // Fall back to live calculation if cache table doesn't exist
            return self::calculate_pay_and_cache( $user_id, $include_projected );
        }
        
        // Get cached data
        $cached = $wpdb->get_row( $wpdb->prepare(
            "SELECT pay_data, projected_data, calculated_at FROM $cache_table WHERE user_id = %d",
            $user_id
        ) );
        
        if ( $cached ) {
            $pay_data = json_decode( $cached->pay_data, true );
            $result = [
                'pay' => $pay_data,
                'cached_at' => $cached->calculated_at
            ];
            
            if ( $include_projected && $cached->projected_data ) {
                $result['projected'] = json_decode( $cached->projected_data, true );
            }
            
            return $result;
        }
        
        // No cache exists - calculate and store
        return self::calculate_pay_and_cache( $user_id, $include_projected );
    }

    /**
     * Calculate pay for a user and store in cache
     *
     * @param int $user_id User ID
     * @param bool $include_projected Whether to include projected pay
     * @return array Pay data array
     */
    public static function calculate_pay_and_cache( $user_id, $include_projected = true ) {
        global $wpdb;
        
        $cache_table = $wpdb->prefix . 'srm_pay_cache';
        
        try {
            $pay = self::calculate_pay_rate( $user_id );
            $projected = $include_projected ? self::calculate_projected_pay_rate( $user_id ) : null;
            
            // Store in cache (use REPLACE to update if exists)
            $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
            if ( $table_exists ) {
                $wpdb->replace(
                    $cache_table,
                    [
                        'user_id' => $user_id,
                        'pay_data' => json_encode( $pay ),
                        'projected_data' => $projected ? json_encode( $projected ) : null,
                        'calculated_at' => current_time( 'mysql' )
                    ],
                    [ '%d', '%s', '%s', '%s' ]
                );
            }
            
            $result = [
                'pay' => $pay,
                'cached_at' => current_time( 'mysql' )
            ];
            
            if ( $projected ) {
                $result['projected'] = $projected;
            }
            
            return $result;
            
        } catch ( Throwable $e ) {
            error_log( "Pay cache calc error for user {$user_id}: " . $e->getMessage() );
            
            // Return default empty structure
            return [
                'pay' => [
                    'user_id' => $user_id,
                    'as_of_date' => current_time( 'Y-m-d' ),
                    'base_rate' => 0,
                    'role_bonus' => [ 'amount' => 0, 'role_name' => '', 'role_id' => 0 ],
                    'longevity' => [ 'years' => 0, 'bonus' => 0 ],
                    'time_bonuses' => [],
                    'time_bonus_total' => 0,
                    'total' => 0,
                    'is_capped' => false,
                    'pay_cap' => 0
                ],
                'cached_at' => current_time( 'mysql' ),
                'error' => true
            ];
        }
    }

    /**
     * Invalidate (delete) cached pay for a specific user
     * Call this when user's pay-related data changes
     *
     * @param int $user_id User ID
     * @return bool Success
     */
    public static function invalidate_pay_cache( $user_id ) {
        global $wpdb;
        
        $cache_table = $wpdb->prefix . 'srm_pay_cache';
        
        // Check if cache table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
        if ( ! $table_exists ) {
            return false;
        }
        
        $result = $wpdb->delete( $cache_table, [ 'user_id' => $user_id ], [ '%d' ] );
        
        // Immediately recalculate to populate fresh data
        self::calculate_pay_and_cache( $user_id );
        
        return $result !== false;
    }

    /**
     * Invalidate all cached pay data
     * Call this when global pay config changes (base rate, time bonuses, etc.)
     *
     * @return int Number of records deleted
     */
    public static function invalidate_all_pay_cache() {
        global $wpdb;
        
        // Clear transient caches for pay config
        self::clear_pay_config_cache();
        
        $cache_table = $wpdb->prefix . 'srm_pay_cache';
        
        // Check if cache table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
        if ( ! $table_exists ) {
            return 0;
        }
        
        $count = $wpdb->get_var( "SELECT COUNT(*) FROM $cache_table" );
        $wpdb->query( "TRUNCATE TABLE $cache_table" );
        
        // Schedule immediate refresh
        if ( ! wp_next_scheduled( 'aquaticpro_refresh_pay_cache_immediate' ) ) {
            wp_schedule_single_event( time() + 5, 'aquaticpro_refresh_pay_cache' );
        }
        
        return (int) $count;
    }

    /**
     * Refresh pay cache for all employees
     * Called by cron job or after global pay config changes
     *
     * @return array Stats about the refresh operation
     */
    public static function refresh_all_pay_cache() {
        global $wpdb;
        
        $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
        
        // Check if assignments table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" );
        if ( ! $table_exists ) {
            return [ 'updated' => 0, 'failed' => 0, 'message' => 'Assignments table not found' ];
        }
        
        // Get all users with job assignments (employees)
        $user_ids = $wpdb->get_col( "SELECT DISTINCT user_id FROM $assignments_table" );
        
        if ( empty( $user_ids ) ) {
            return [ 'updated' => 0, 'failed' => 0, 'message' => 'No employees found' ];
        }
        
        $updated = 0;
        $failed = 0;
        
        // Process in batches of 20 to manage memory
        $batches = array_chunk( $user_ids, 20 );
        
        foreach ( $batches as $batch ) {
            foreach ( $batch as $user_id ) {
                try {
                    self::calculate_pay_and_cache( $user_id );
                    $updated++;
                } catch ( Throwable $e ) {
                    error_log( "Pay cache refresh failed for user {$user_id}: " . $e->getMessage() );
                    $failed++;
                }
            }
            
            // Clear memory between batches
            if ( function_exists( 'wp_cache_flush' ) ) {
                wp_cache_flush();
            }
        }
        
        return [
            'updated' => $updated,
            'failed' => $failed,
            'total' => count( $user_ids )
        ];
    }

    /**
     * Get all cached pay data for the Users List
     * Efficient bulk retrieval for the table view
     *
     * @return array Keyed by user_id
     */
    public static function get_all_cached_pay() {
        global $wpdb;
        
        $cache_table = $wpdb->prefix . 'srm_pay_cache';
        
        // Check if cache table exists
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$cache_table'" );
        if ( ! $table_exists ) {
            return [];
        }
        
        $rows = $wpdb->get_results( "SELECT user_id, pay_data, projected_data, calculated_at FROM $cache_table" );
        
        $result = [];
        foreach ( $rows as $row ) {
            $result[ $row->user_id ] = [
                'pay' => json_decode( $row->pay_data, true ),
                'projected' => $row->projected_data ? json_decode( $row->projected_data, true ) : null,
                'cached_at' => $row->calculated_at
            ];
        }
        
        return $result;
    }

} // End class Seasonal_Returns