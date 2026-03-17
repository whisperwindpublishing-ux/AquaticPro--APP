<?php
/**
 * Security Helpers for AquaticPro
 * 
 * Provides centralized security functions for:
 * - Rate limiting
 * - PII filtering
 * - Audit logging
 * - Permission checks
 * 
 * IMPORTANT: Tier 6 users have FULL ACCESS to all plugin features.
 * They are treated as "Plugin Admins" with the same access as WordPress admins
 * but without WordPress admin capabilities. This includes:
 * - All module permissions enabled by default
 * - Override of all job role permission restrictions
 * - Access to all settings and configuration
 * - All future modules should respect this pattern using mp_is_plugin_admin()
 * 
 * @package AquaticPro
 * @since 9.6.56
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * ============================================================================
 * PLUGIN ADMIN CHECK
 * ============================================================================
 */

/**
 * Check if user is a Plugin Admin (WordPress admin OR Tier 6+)
 * 
 * Plugin Admins have FULL ACCESS to all plugin features, regardless of
 * individual job role permissions. This allows senior staff to manage
 * all aspects of the platform without needing WordPress admin rights.
 * 
 * IMPORTANT FOR FUTURE DEVELOPMENT:
 * Always use this function to check for full plugin access. Any new
 * modules, permissions, or features should respect this check.
 * 
 * @param int|null $user_id User ID (defaults to current user)
 * @return bool True if user is a Plugin Admin
 */
function mp_is_plugin_admin($user_id = null) {
    if ($user_id === null) {
        $user_id = get_current_user_id();
    }
    
    if (!$user_id) {
        return false;
    }
    
    // WordPress admins are always Plugin Admins
    if (user_can($user_id, 'manage_options')) {
        return true;
    }
    
    // Tier 6+ users are Plugin Admins
    $tier = mp_get_user_highest_tier($user_id);
    return $tier >= 6;
}

/**
 * ============================================================================
 * DYNAMIC CAPABILITY: upload_files
 * ============================================================================
 * Grant the WordPress 'upload_files' capability dynamically to users who need
 * media access for content creation. This enables:
 *   - WordPress Media Library picker (wp.media)
 *   - File uploads via the wp/v2/media REST endpoint
 *   - Certificate file uploads via the custom /upload endpoint
 *
 * Granted to:
 *   - Plugin Admins (Tier 6+) — need media for Email Composer, etc.
 *   - Users with Daily Log create permission — need media for log posts
 *   - Any user with AquaticPro access — need media for certificate uploads
 *
 * Uses per-request static cache to avoid repeated DB queries.
 */
add_filter('user_has_cap', function ($allcaps, $caps, $args, $user) {
    // Only intercept when upload_files is being checked
    if (!in_array('upload_files', $caps, true)) {
        return $allcaps;
    }

    // Already has the capability natively
    if (!empty($allcaps['upload_files'])) {
        return $allcaps;
    }

    $uid = $user->ID ?? 0;
    if (!$uid) {
        return $allcaps;
    }

    // Per-request cache to avoid repeated DB queries
    static $cache = [];
    if (!isset($cache[$uid])) {
        $cache[$uid] = false;

        // Plugin admins (Tier 6+) always get upload access
        if (function_exists('mp_get_user_highest_tier')) {
            $tier = mp_get_user_highest_tier($uid);
            if ($tier >= 6) {
                $cache[$uid] = true;
            }
        }

        // Users with daily log create permission get upload access
        if (!$cache[$uid]) {
            global $wpdb;
            $permissions_table = $wpdb->prefix . 'mp_daily_log_permissions';
            $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';

            // Only query if the permissions table exists
            if ($wpdb->get_var("SHOW TABLES LIKE '$permissions_table'") === $permissions_table) {
                $has_create = $wpdb->get_var($wpdb->prepare("
                    SELECT MAX(p.can_create)
                    FROM $permissions_table p
                    JOIN $assignments_table a ON p.job_role_id = a.job_role_id
                    WHERE a.user_id = %d
                ", $uid));

                if ($has_create) {
                    $cache[$uid] = true;
                }
            }
        }

        // Any user with AquaticPro access gets upload capability
        // (needed for certificate file uploads and other plugin features)
        if (!$cache[$uid] && function_exists('aquaticpro_user_has_access')) {
            if (aquaticpro_user_has_access($uid)) {
                $cache[$uid] = true;
            }
        }
    }

    if ($cache[$uid]) {
        $allcaps['upload_files'] = true;
    }

    return $allcaps;
}, 10, 4);

/**
 * ============================================================================
 * RATE LIMITING
 * ============================================================================
 */

/**
 * Check if a request should be rate limited
 * 
 * @param string $endpoint The endpoint being accessed
 * @param int $max_requests Maximum requests allowed in the window
 * @param int $window_seconds Time window in seconds
 * @return true|WP_Error True if allowed, WP_Error if rate limited
 */
function mp_check_rate_limit($endpoint, $max_requests = 100, $window_seconds = 60) {
    $user_id = get_current_user_id();
    $ip = mp_get_client_ip();
    
    // Use user ID if logged in, otherwise IP
    $identifier = $user_id ? "user_{$user_id}" : "ip_{$ip}";
    $key = 'mp_rate_' . md5($endpoint . '_' . $identifier);
    
    $data = get_transient($key);
    
    if ($data === false) {
        // First request in this window
        set_transient($key, ['count' => 1, 'first_request' => time()], $window_seconds);
        return true;
    }
    
    if ($data['count'] >= $max_requests) {
        // Rate limited
        mp_log_security_event('rate_limit_exceeded', [
            'endpoint' => $endpoint,
            'user_id' => $user_id,
            'ip' => $ip,
            'count' => $data['count'],
            'limit' => $max_requests
        ]);
        
        return new WP_Error(
            'rate_limited',
            'Too many requests. Please wait before trying again.',
            ['status' => 429]
        );
    }
    
    // Increment counter
    $data['count']++;
    set_transient($key, $data, $window_seconds);
    
    return true;
}

/**
 * Rate limit configuration per endpoint type
 */
/**
 * Daily cron: delete expired rate-limit transients so wp_options doesn't bloat.
 * wp_options autoloads all transients on every request — old rate-limit rows slow everything down.
 */
add_action('mp_cleanup_rate_limits', function() {
    global $wpdb;
    $wpdb->query(
        "DELETE FROM {$wpdb->options}
         WHERE (option_name LIKE '\_transient\_mp\_rate\_%'
                OR option_name LIKE '\_transient\_timeout\_mp\_rate\_%')
         AND option_name LIKE '\_transient\_timeout\_%'
         AND CAST(option_value AS UNSIGNED) < UNIX_TIMESTAMP()"
    );
    // Also nuke orphaned value rows (timeout already gone)
    $wpdb->query(
        "DELETE v FROM {$wpdb->options} v
         LEFT JOIN {$wpdb->options} t
           ON t.option_name = CONCAT('_transient_timeout_', SUBSTRING(v.option_name, 13))
         WHERE v.option_name LIKE '\_transient\_mp\_rate\_%'
         AND t.option_name IS NULL"
    );
});
if (!wp_next_scheduled('mp_cleanup_rate_limits')) {
    wp_schedule_event(time(), 'daily', 'mp_cleanup_rate_limits');
}

function mp_get_rate_limit_config($endpoint_type) {
    $configs = [
        'data_export' => ['max' => 10, 'window' => 60],      // 10 per minute for exports
        'bulk_query' => ['max' => 30, 'window' => 60],       // 30 per minute for list queries
        'single_query' => ['max' => 120, 'window' => 60],    // 120 per minute for single item
        'write' => ['max' => 60, 'window' => 60],            // 60 per minute for writes
        'sensitive' => ['max' => 20, 'window' => 60],        // 20 per minute for PII access
        'auth' => ['max' => 10, 'window' => 300],            // 10 per 5 minutes for auth attempts
    ];
    
    return $configs[$endpoint_type] ?? ['max' => 100, 'window' => 60];
}

/**
 * ============================================================================
 * PII FILTERING
 * ============================================================================
 */

/**
 * Define PII fields and their access tiers
 */
function mp_get_pii_fields() {
    return [
        // High sensitivity - Admin only (Tier 5+)
        'high' => [
            'user_email',
            'email',
            'phone_number',
            'phone',
            'address',
            'street_address',
            'emergency_contact',
            'emergency_phone',
            'employee_id',
            'social_security',
            'ssn',
            'date_of_birth',
            'dob',
        ],
        // Medium sensitivity - Management (Tier 4+)
        'medium' => [
            'hire_date',
            'notes',
            'medical_notes',
            'private_notes',
        ],
        // Low sensitivity - Supervisors (Tier 3+)
        'low' => [
            'home_phone',
            'mobile_phone',
        ]
    ];
}

/**
 * Get user's PII access level based on their tier
 * 
 * @param int|null $user_id User ID (defaults to current user)
 * @return string 'high', 'medium', 'low', or 'none'
 */
function mp_get_user_pii_access_level($user_id = null) {
    if ($user_id === null) {
        $user_id = get_current_user_id();
    }
    
    // Plugin Admins (WP admins and Tier 6+) get full access
    if (mp_is_plugin_admin($user_id)) {
        return 'high';
    }
    
    // Get user's tier
    $tier = mp_get_user_highest_tier($user_id);
    
    if ($tier >= 5) return 'high';    // Admin tier
    if ($tier >= 4) return 'medium';  // Management tier
    if ($tier >= 3) return 'low';     // Supervisor tier
    
    return 'none';
}

/**
 * Get user's highest job role tier
 * 
 * @param int $user_id
 * @return int Tier level (0-5)
 */
function mp_get_user_highest_tier($user_id) {
    global $wpdb;
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if tables exist
    if ($wpdb->get_var("SHOW TABLES LIKE '$assignments_table'") !== $assignments_table) {
        return 0;
    }
    
    $tier = $wpdb->get_var($wpdb->prepare("
        SELECT MAX(r.tier)
        FROM $assignments_table a
        INNER JOIN $roles_table r ON a.job_role_id = r.id
        WHERE a.user_id = %d AND a.is_active = 1
    ", $user_id));
    
    return (int) ($tier ?? 0);
}

/**
 * Filter PII from data based on user's access level
 * 
 * @param array $data Data to filter (can be nested)
 * @param string|null $access_level Override access level (otherwise auto-detected)
 * @return array Filtered data
 */
function mp_filter_pii($data, $access_level = null) {
    if ($access_level === null) {
        $access_level = mp_get_user_pii_access_level();
    }
    
    // High access sees everything
    if ($access_level === 'high') {
        return $data;
    }
    
    $pii_fields = mp_get_pii_fields();
    $fields_to_remove = [];
    
    // Determine which fields to remove based on access level
    switch ($access_level) {
        case 'none':
            $fields_to_remove = array_merge(
                $pii_fields['high'],
                $pii_fields['medium'],
                $pii_fields['low']
            );
            break;
        case 'low':
            $fields_to_remove = array_merge(
                $pii_fields['high'],
                $pii_fields['medium']
            );
            break;
        case 'medium':
            $fields_to_remove = $pii_fields['high'];
            break;
    }
    
    return mp_recursively_filter_fields($data, $fields_to_remove);
}

/**
 * Recursively remove fields from nested data
 * 
 * @param mixed $data
 * @param array $fields_to_remove
 * @return mixed
 */
function mp_recursively_filter_fields($data, $fields_to_remove) {
    if (!is_array($data)) {
        return $data;
    }
    
    foreach ($data as $key => $value) {
        // Check if this key should be removed
        if (in_array(strtolower($key), array_map('strtolower', $fields_to_remove), true)) {
            unset($data[$key]);
            continue;
        }
        
        // Recursively filter nested arrays
        if (is_array($value)) {
            $data[$key] = mp_recursively_filter_fields($value, $fields_to_remove);
        }
    }
    
    return $data;
}

/**
 * Filter user data specifically, with common patterns
 * 
 * @param array $user_data
 * @param bool $include_email Whether to include email (for specific use cases)
 * @return array
 */
function mp_filter_user_data($user_data, $include_email = false) {
    $access_level = mp_get_user_pii_access_level();
    
    // Start with PII filtering
    $filtered = mp_filter_pii($user_data, $access_level);
    
    // Special handling for email - only include if specifically requested AND user has access
    if (!$include_email && $access_level !== 'high') {
        unset($filtered['user_email']);
        unset($filtered['email']);
    }
    
    return $filtered;
}

/**
 * ============================================================================
 * AUDIT LOGGING
 * ============================================================================
 */

/**
 * Create audit log table if it doesn't exist
 */
function mp_create_audit_log_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'mp_audit_log';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned DEFAULT NULL,
        action varchar(100) NOT NULL,
        resource_type varchar(50) DEFAULT NULL,
        resource_id bigint(20) unsigned DEFAULT NULL,
        details longtext DEFAULT NULL,
        ip_address varchar(45) DEFAULT NULL,
        user_agent text DEFAULT NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_id (user_id),
        KEY idx_action (action),
        KEY idx_resource (resource_type, resource_id),
        KEY idx_created_at (created_at),
        KEY idx_ip_address (ip_address)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

/**
 * Log a security-related event
 * 
 * @param string $action The action being logged
 * @param array $details Additional details
 * @param string|null $resource_type Type of resource (user, swimmer, daily_log, etc.)
 * @param int|null $resource_id ID of the resource
 */
function mp_log_security_event($action, $details = [], $resource_type = null, $resource_id = null) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'mp_audit_log';
    
    // Check if table exists, create if not
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
        mp_create_audit_log_table();
    }
    
    $wpdb->insert($table_name, [
        'user_id' => get_current_user_id() ?: null,
        'action' => $action,
        'resource_type' => $resource_type,
        'resource_id' => $resource_id,
        'details' => json_encode($details),
        'ip_address' => mp_get_client_ip(),
        'user_agent' => isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 500) : null,
        'created_at' => current_time('mysql')
    ]);
}

/**
 * Log PII access
 * 
 * @param string $data_type Type of data accessed (user, swimmer, etc.)
 * @param int|array $record_ids ID(s) of records accessed
 * @param string $endpoint The endpoint used
 */
function mp_log_pii_access($data_type, $record_ids, $endpoint = '') {
    if (!is_array($record_ids)) {
        $record_ids = [$record_ids];
    }
    
    // Only log if accessing more than own data or bulk access
    $user_id = get_current_user_id();
    $accessing_own_data = count($record_ids) === 1 && $record_ids[0] == $user_id && $data_type === 'user';
    
    if ($accessing_own_data) {
        return; // Don't log users viewing their own data
    }
    
    mp_log_security_event('pii_access', [
        'endpoint' => $endpoint,
        'record_count' => count($record_ids),
        'record_ids' => array_slice($record_ids, 0, 100), // Limit to first 100 IDs
    ], $data_type, count($record_ids) === 1 ? $record_ids[0] : null);
}

/**
 * Log bulk data export
 * 
 * @param string $export_type Type of export
 * @param int $record_count Number of records exported
 * @param array $filters Filters applied
 */
function mp_log_data_export($export_type, $record_count, $filters = []) {
    mp_log_security_event('data_export', [
        'export_type' => $export_type,
        'record_count' => $record_count,
        'filters' => $filters,
    ], $export_type, null);
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get client IP address
 * 
 * @return string
 */
function mp_get_client_ip() {
    $ip_keys = [
        'HTTP_CF_CONNECTING_IP',     // Cloudflare
        'HTTP_X_FORWARDED_FOR',      // Proxy
        'HTTP_X_REAL_IP',            // Nginx
        'REMOTE_ADDR'                // Direct
    ];
    
    foreach ($ip_keys as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = $_SERVER[$key];
            // Handle comma-separated IPs (X-Forwarded-For)
            if (strpos($ip, ',') !== false) {
                $ip = trim(explode(',', $ip)[0]);
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    
    return '0.0.0.0';
}

/**
 * Check if user can access specific user's data
 * 
 * @param int $target_user_id The user whose data is being accessed
 * @param int|null $requesting_user_id The user requesting access (defaults to current user)
 * @return bool
 */
function mp_can_access_user_data($target_user_id, $requesting_user_id = null) {
    if ($requesting_user_id === null) {
        $requesting_user_id = get_current_user_id();
    }
    
    // Users can always access their own data
    if ($target_user_id == $requesting_user_id) {
        return true;
    }
    
    // Plugin Admins (WP admins and Tier 6+) can access anyone's data
    if (mp_is_plugin_admin($requesting_user_id)) {
        return true;
    }
    
    // Check if requesting user is a supervisor of target user
    $requesting_tier = mp_get_user_highest_tier($requesting_user_id);
    $target_tier = mp_get_user_highest_tier($target_user_id);
    
    // Users can only view data of users at lower tiers
    // Tier 3+ can view lower tier users
    if ($requesting_tier >= 3 && $requesting_tier > $target_tier) {
        return true;
    }
    
    return false;
}

/**
 * Wrap an endpoint callback with rate limiting and PII filtering
 * 
 * @param callable $callback The original callback
 * @param string $rate_limit_type Rate limit configuration type
 * @param bool $filter_pii Whether to filter PII from response
 * @return callable
 */
function mp_secure_endpoint($callback, $rate_limit_type = 'single_query', $filter_pii = true) {
    return function($request) use ($callback, $rate_limit_type, $filter_pii) {
        // Rate limiting
        $config = mp_get_rate_limit_config($rate_limit_type);
        $rate_check = mp_check_rate_limit($request->get_route(), $config['max'], $config['window']);
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }
        
        // Execute original callback
        $response = call_user_func($callback, $request);
        
        // PII filtering
        if ($filter_pii && !is_wp_error($response)) {
            if ($response instanceof WP_REST_Response) {
                $data = $response->get_data();
                $filtered = mp_filter_pii($data);
                $response->set_data($filtered);
            } elseif (is_array($response)) {
                $response = mp_filter_pii($response);
            }
        }
        
        return $response;
    };
}

/**
 * ============================================================================
 * CLEANUP
 * ============================================================================
 */

/**
 * Clean old audit logs (retain for 90 days by default)
 * 
 * @param int $days Number of days to retain
 */
function mp_cleanup_audit_logs($days = 90) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'mp_audit_log';
    
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") !== $table_name) {
        return;
    }
    
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $table_name WHERE created_at < DATE_SUB(NOW(), INTERVAL %d DAY)",
        $days
    ));
}

// Schedule daily cleanup
if (!wp_next_scheduled('mp_cleanup_audit_logs_event')) {
    wp_schedule_event(time(), 'daily', 'mp_cleanup_audit_logs_event');
}
add_action('mp_cleanup_audit_logs_event', 'mp_cleanup_audit_logs');

/**
 * ============================================================================
 * HTTP CACHE HELPERS
 * ============================================================================
 */

/**
 * Add HTTP cache headers to a REST response
 * 
 * This enables browser-level caching to reduce server requests.
 * Use for read-only endpoints that return data that changes infrequently.
 * 
 * @param WP_REST_Response $response The response object
 * @param int $max_age Cache duration in seconds (default 300 = 5 minutes)
 * @param int $stale_while_revalidate Time to serve stale content while revalidating (default 60)
 * @param bool $private Whether cache is private (user-specific) or public
 * @return WP_REST_Response Modified response with cache headers
 */
function mp_add_cache_headers($response, $max_age = 300, $stale_while_revalidate = 60, $private = true) {
    if (!($response instanceof WP_REST_Response)) {
        return $response;
    }
    
    $cache_control = $private ? 'private' : 'public';
    $cache_control .= ", max-age={$max_age}";
    
    if ($stale_while_revalidate > 0) {
        $cache_control .= ", stale-while-revalidate={$stale_while_revalidate}";
    }
    
    $response->header('Cache-Control', $cache_control);
    
    // Add Vary header for proper cache key differentiation
    $response->header('Vary', 'Authorization, X-WP-Nonce');
    
    return $response;
}

/**
 * Cache duration presets for different types of data
 * 
 * @param string $type Type of data: 'static', 'semi-static', 'dynamic', 'user-specific'
 * @return array ['max_age' => seconds, 'stale' => seconds, 'private' => bool]
 */
function mp_get_cache_preset($type) {
    $presets = [
        // Rarely changes: job roles, levels, skills, taxonomies
        'static' => ['max_age' => 3600, 'stale' => 300, 'private' => false],  // 1 hour
        
        // Changes occasionally: user lists, groups
        'semi-static' => ['max_age' => 300, 'stale' => 60, 'private' => true],  // 5 minutes
        
        // Changes frequently: recent activity, dashboards
        'dynamic' => ['max_age' => 60, 'stale' => 30, 'private' => true],  // 1 minute
        
        // User-specific data that shouldn't be shared
        'user-specific' => ['max_age' => 180, 'stale' => 30, 'private' => true],  // 3 minutes
        
        // No caching - for write endpoints or highly dynamic data
        'none' => ['max_age' => 0, 'stale' => 0, 'private' => true],
    ];
    
    return $presets[$type] ?? $presets['dynamic'];
}

/**
 * ============================================================================
 * CENTRALIZED CACHE INVALIDATION
 * ============================================================================
 * 
 * These functions ensure all related caches are cleared together,
 * preventing stale data across different parts of the application.
 */

/**
 * Invalidate all user-related caches
 * Call when: users are created, updated, deleted, archived, or role assignments change
 * 
 * @param int|null $user_id Specific user ID (optional, for targeted invalidation)
 */
function mp_invalidate_user_caches($user_id = null) {
    global $wpdb;
    
    // Main user list caches (all variants).
    // The actual cache key format is: mp_user_list_{archived}_{member}_{email}
    // e.g. mp_user_list_active_member_email — 3 × 3 × 2 = 18 possible keys.
    // A wildcard SQL delete is the only reliable way to catch them all.
    $wpdb->query(
        "DELETE FROM {$wpdb->options}
         WHERE option_name LIKE '_transient_mp_user_list_%'
         OR option_name LIKE '_transient_timeout_mp_user_list_%'"
    );
    
    // Awesome Awards simple users (per-user caches)
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
         WHERE option_name LIKE '_transient_aa_simple_users_%' 
         OR option_name LIKE '_transient_timeout_aa_simple_users_%'"
    );
    
    // Lesson Management essential data (contains users list)
    delete_transient('lm_essential_data');
    
    // TaskDeck user-related caches
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
         WHERE option_name LIKE '_transient_td_decks_%' 
         OR option_name LIKE '_transient_timeout_td_decks_%'"
    );
    
    // If specific user, also clear their individual caches
    if ($user_id) {
        delete_transient('mp_user_permissions_' . $user_id);
        delete_transient('mp_user_tier_' . $user_id);
    }
    
    // Allow other plugins/modules to hook into user cache invalidation
    do_action('mp_user_caches_invalidated', $user_id);
}

/**
 * Invalidate all job role and permission caches
 * Call when: job roles are created, updated, deleted, or permissions change
 * 
 * @param int|null $role_id Specific role ID (optional)
 */
function mp_invalidate_role_caches($role_id = null) {
    global $wpdb;
    
    // Get plugin version for versioned cache key
    $plugin_data = get_file_data(WP_PLUGIN_DIR . '/aquaticpro/mentorship-platform.php', array('Version' => 'Version'));
    $version = isset($plugin_data['Version']) ? $plugin_data['Version'] : '1.0.0';
    
    // Job roles with permissions (main cache)
    delete_transient('mp_job_roles_with_permissions');
    delete_transient('mp_job_roles_with_permissions_v' . str_replace('.', '_', $version));
    
    // Seasonal Returns role permissions
    delete_transient('srm_all_role_permissions');
    
    // Clear all user tier caches (depends on roles)
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
         WHERE option_name LIKE '_transient_mp_user_tier_%' 
         OR option_name LIKE '_transient_timeout_mp_user_tier_%'"
    );
    
    // Clear user permission caches
    $wpdb->query(
        "DELETE FROM {$wpdb->options} 
         WHERE option_name LIKE '_transient_mp_user_permissions_%' 
         OR option_name LIKE '_transient_timeout_mp_user_permissions_%'"
    );
    
    // Also invalidate user caches since role display may change
    mp_invalidate_user_caches();
    
    // Allow other plugins/modules to hook into role cache invalidation
    do_action('mp_role_caches_invalidated', $role_id);
}

/**
 * Invalidate all Lesson Management caches
 * Call when: groups, swimmers, levels, skills, or camps change
 * 
 * @param string $type Type of change: 'group', 'swimmer', 'level', 'skill', 'camp', 'all'
 * @param int|null $item_id Specific item ID (optional)
 */
function mp_invalidate_lesson_management_caches($type = 'all', $item_id = null) {
    global $wpdb;
    
    // Essential data (levels, skills, users, camps, animals)
    if (in_array($type, ['all', 'level', 'skill', 'camp', 'animal'])) {
        delete_transient('lm_essential_data');
    }
    
    // Groups list (used by GroupManager)
    if (in_array($type, ['all', 'group'])) {
        delete_transient('lm_groups_list');
    }
    
    // Groups cached endpoint (used by frontend groupCache.ts)
    if (in_array($type, ['all', 'group'])) {
        delete_transient('lm_groups_cache');
    }
    
    // Camp roster caches (groups + swimmers per camp)
    if (in_array($type, ['all', 'group', 'swimmer', 'camp'])) {
        $wpdb->query(
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE '_transient_aquaticpro_camp_roster_%' 
             OR option_name LIKE '_transient_timeout_aquaticpro_camp_roster_%'"
        );
    }
    
    // Swimmer caches (includes lm_swimmers_cache for swimmerCache.ts)
    if (in_array($type, ['all', 'swimmer'])) {
        delete_transient('lm_swimmers_cache');
        $wpdb->query(
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE '_transient_lm_swimmers_%' 
             OR option_name LIKE '_transient_timeout_lm_swimmers_%'"
        );
    }
    
    // Level caches
    if (in_array($type, ['all', 'level'])) {
        delete_transient('lm_levels_cache');
    }
    
    // Skill caches
    if (in_array($type, ['all', 'skill'])) {
        delete_transient('lm_skills_cache');
    }
    
    // Allow other plugins/modules to hook into LM cache invalidation
    do_action('mp_lesson_management_caches_invalidated', $type, $item_id);
}

/**
 * Invalidate all TaskDeck caches
 * Call when: decks, lists, or cards change
 * 
 * @param string $type Type of change: 'deck', 'list', 'card', 'all'
 * @param int|null $item_id Specific item ID (optional)
 */
function mp_invalidate_taskdeck_caches($type = 'all', $item_id = null) {
    global $wpdb;
    
    // Deck list caches (per-user)
    if (in_array($type, ['all', 'deck'])) {
        $wpdb->query(
            "DELETE FROM {$wpdb->options} 
             WHERE option_name LIKE '_transient_td_decks_%' 
             OR option_name LIKE '_transient_timeout_td_decks_%'"
        );
    }
    
    // Individual deck caches
    if ($item_id && in_array($type, ['deck', 'list', 'card'])) {
        delete_transient('td_deck_' . $item_id);
    }
    
    // Allow other plugins/modules to hook into TaskDeck cache invalidation
    do_action('mp_taskdeck_caches_invalidated', $type, $item_id);
}

/**
 * Invalidate ALL plugin caches (nuclear option)
 * Use sparingly - only for major updates or troubleshooting
 */
function mp_invalidate_all_caches() {
    global $wpdb;
    
    // Delete all AquaticPro/Mentorship Platform transients
    $prefixes = [
        'mp_', 'aa_', 'td_', 'lm_', 'srm_', 'aquaticpro_'
    ];
    
    foreach ($prefixes as $prefix) {
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} 
                 WHERE option_name LIKE %s 
                 OR option_name LIKE %s",
                '_transient_' . $prefix . '%',
                '_transient_timeout_' . $prefix . '%'
            )
        );
    }
    
    // Log the nuclear cache clear
    if (function_exists('mp_log_audit_event')) {
        mp_log_audit_event('cache_clear_all', [
            'user_id' => get_current_user_id(),
            'reason' => 'Manual full cache invalidation'
        ]);
    }
    
    do_action('mp_all_caches_invalidated');
}

/**
 * ============================================================================
 * CACHE INVALIDATION HOOKS
 * ============================================================================
 * Automatically trigger cache invalidation on relevant WordPress events
 */

// User events - clear user caches
add_action('user_register', function($user_id) {
    mp_invalidate_user_caches($user_id);
});

add_action('profile_update', function($user_id) {
    mp_invalidate_user_caches($user_id);
});

add_action('delete_user', function($user_id) {
    mp_invalidate_user_caches($user_id);
});

// Custom post type events - Lesson Management groups
add_action('save_post_lm-group', function($post_id) {
    mp_invalidate_lesson_management_caches('group', $post_id);
});

add_action('delete_post', function($post_id) {
    $post_type = get_post_type($post_id);
    if ($post_type === 'lm-group') {
        mp_invalidate_lesson_management_caches('group', $post_id);
    } elseif ($post_type === 'lm-swimmer') {
        mp_invalidate_lesson_management_caches('swimmer', $post_id);
    } elseif ($post_type === 'lm-camp') {
        mp_invalidate_lesson_management_caches('camp', $post_id);
    }
});

// Swimmer events
add_action('save_post_lm-swimmer', function($post_id) {
    mp_invalidate_lesson_management_caches('swimmer', $post_id);
});

// Camp events
add_action('save_post_lm-camp', function($post_id) {
    mp_invalidate_lesson_management_caches('camp', $post_id);
});

/**
 * Invalidate compliance report transient caches.
 *
 * @param string $type 'scan_audits' | 'live_drills' | 'inservice' | '' (all)
 */
function mp_invalidate_compliance_report_cache( string $type = '' ) {
    global $wpdb;
    if ( $type ) {
        $wpdb->query( $wpdb->prepare(
            "DELETE FROM {$wpdb->options}
             WHERE option_name LIKE %s
                OR option_name LIKE %s",
            '_transient_mp_compliance_' . $wpdb->esc_like( $type ) . '_%',
            '_transient_timeout_mp_compliance_' . $wpdb->esc_like( $type ) . '_%'
        ) );
    } else {
        $wpdb->query(
            "DELETE FROM {$wpdb->options}
             WHERE option_name LIKE '_transient_mp_compliance_%'
                OR option_name LIKE '_transient_timeout_mp_compliance_%'"
        );
    }
}

/**
 * ============================================================================
 * INITIALIZATION
 * ============================================================================
 */

// Create audit log table on plugin activation
register_activation_hook(plugin_dir_path(__DIR__) . 'mentorship-platform.php', 'mp_create_audit_log_table');
