<?php
/**
 * Dashboard API Routes for AquaticPro
 * 
 * Handles dashboard settings, action buttons, and weather API
 *
 * @package AquaticPro
 * @since 9.5.0
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Register Dashboard REST API routes
 */
function aquaticpro_register_dashboard_routes() {
    $namespace = 'mentorship-platform/v1';

    // Dashboard Settings
    register_rest_route($namespace, '/dashboard/settings', [
        [
            'methods' => 'GET',
            'callback' => 'aquaticpro_get_dashboard_settings',
            'permission_callback' => function() {
                return is_user_logged_in();
            },
        ],
        [
            'methods' => 'PUT',
            'callback' => 'aquaticpro_update_dashboard_settings',
            'permission_callback' => function() {
                return current_user_can('manage_options');
            },
        ],
    ]);

    // Weather endpoint
    register_rest_route($namespace, '/dashboard/weather', [
        'methods' => 'GET',
        'callback' => 'aquaticpro_get_weather',
        'permission_callback' => function() {
            return is_user_logged_in();
        },
        'args' => [
            'zip' => [
                'required' => true,
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);

    // Action Buttons CRUD
    register_rest_route($namespace, '/dashboard/action-buttons', [
        [
            'methods' => 'GET',
            'callback' => 'aquaticpro_get_action_buttons',
            'permission_callback' => function() {
                return is_user_logged_in();
            },
        ],
        [
            'methods' => 'POST',
            'callback' => 'aquaticpro_create_action_button',
            'permission_callback' => 'aquaticpro_can_manage_action_buttons',
        ],
    ]);

    register_rest_route($namespace, '/dashboard/action-buttons/(?P<id>\d+)', [
        [
            'methods' => 'PUT',
            'callback' => 'aquaticpro_update_action_button',
            'permission_callback' => 'aquaticpro_can_manage_action_buttons',
        ],
        [
            'methods' => 'DELETE',
            'callback' => 'aquaticpro_delete_action_button',
            'permission_callback' => 'aquaticpro_can_manage_action_buttons',
        ],
    ]);

    register_rest_route($namespace, '/dashboard/action-buttons/reorder', [
        'methods' => 'POST',
        'callback' => 'aquaticpro_reorder_action_buttons',
        'permission_callback' => 'aquaticpro_can_manage_action_buttons',
    ]);
}
add_action('rest_api_init', 'aquaticpro_register_dashboard_routes');

/**
 * Check if user can manage action buttons
 * Allows admin or users with specific permission
 */
function aquaticpro_can_manage_action_buttons() {
    if (current_user_can('manage_options')) {
        return true;
    }
    
    // Check role-based permission
    $user_id = get_current_user_id();
    if (!$user_id) return false;
    
    global $wpdb;
    $permissions_table = $wpdb->prefix . 'pg_dashboard_permissions';
    
    // Get user's job role
    $job_assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $user_role_id = $wpdb->get_var($wpdb->prepare(
        "SELECT role_id FROM {$job_assignments_table} WHERE user_id = %d AND is_primary = 1 LIMIT 1",
        $user_id
    ));
    
    if (!$user_role_id) return false;
    
    // Check permission
    $can_manage = $wpdb->get_var($wpdb->prepare(
        "SELECT can_manage_action_buttons FROM {$permissions_table} WHERE role_id = %d",
        $user_role_id
    ));
    
    return (bool) $can_manage;
}

/**
 * GET /dashboard/settings
 */
function aquaticpro_get_dashboard_settings() {
    $settings = [
        'goal_statement' => get_option('aquaticpro_dashboard_goal', ''),
        'mission_statement' => get_option('aquaticpro_dashboard_mission', ''),
        'weather_zip_code' => get_option('aquaticpro_dashboard_zipcode', ''),
        'action_buttons' => aquaticpro_get_action_buttons_data(),
    ];
    
    return rest_ensure_response($settings);
}

/**
 * PUT /dashboard/settings
 */
function aquaticpro_update_dashboard_settings($request) {
    $params = $request->get_json_params();
    
    if (isset($params['goal_statement'])) {
        update_option('aquaticpro_dashboard_goal', sanitize_textarea_field($params['goal_statement']));
    }
    
    if (isset($params['mission_statement'])) {
        update_option('aquaticpro_dashboard_mission', sanitize_textarea_field($params['mission_statement']));
    }
    
    if (isset($params['weather_zip_code'])) {
        update_option('aquaticpro_dashboard_zipcode', sanitize_text_field($params['weather_zip_code']));
    }
    
    return rest_ensure_response(['success' => true, 'message' => 'Settings updated']);
}

/**
 * GET /dashboard/weather
 * Uses Open-Meteo API (free, no API key required)
 */
function aquaticpro_get_weather($request) {
    try {
        $zip_code = $request->get_param('zip');
        
        if (empty($zip_code)) {
            return new WP_Error('no_zip', 'Zip code is required', ['status' => 400]);
        }
        
        // Cache weather data for 30 minutes
        $cache_key = 'aquaticpro_weather_' . md5($zip_code);
        $cached = get_transient($cache_key);
        
        if ($cached !== false) {
            return rest_ensure_response($cached);
        }
        
        // Step 1: Get coordinates from zip code — cached for 7 days (zip codes don't change)
        $geo_cache_key = 'aquaticpro_geo_' . md5($zip_code);
        $cached_coords = get_transient($geo_cache_key);

        if ($cached_coords !== false) {
            $lat  = $cached_coords['lat'];
            $lon  = $cached_coords['lon'];
            $city = $cached_coords['city'];
        } else {
            $geocode_url = sprintf(
                'https://nominatim.openstreetmap.org/search?postalcode=%s&country=US&format=json&limit=1',
                urlencode($zip_code)
            );

            $geocode_response = wp_remote_get($geocode_url, [
                'timeout' => 10,
                'headers' => [
                    'User-Agent' => 'AquaticPro/1.0 WordPress Plugin'
                ]
            ]);

            if (is_wp_error($geocode_response)) {
                error_log('[Weather API] Geocode error: ' . $geocode_response->get_error_message());
                return new WP_Error('geocode_error', 'Failed to geocode zip code: ' . $geocode_response->get_error_message(), ['status' => 500]);
            }

            $geocode_body = wp_remote_retrieve_body($geocode_response);
            $geocode_data = json_decode($geocode_body, true);

            if (empty($geocode_data) || !isset($geocode_data[0]['lat'])) {
                return new WP_Error('geocode_error', 'Could not find location for zip code', ['status' => 404]);
            }

            $lat  = $geocode_data[0]['lat'];
            $lon  = $geocode_data[0]['lon'];
            $city = $geocode_data[0]['display_name'] ?? 'Unknown';
            $city_parts = explode(',', $city);
            $city = trim($city_parts[0]);

            // Cache geocode for 7 days — zip-to-coords never changes
            set_transient($geo_cache_key, compact('lat', 'lon', 'city'), 7 * DAY_IN_SECONDS);
        }

        // Step 2: Get weather from Open-Meteo
    $weather_url = sprintf(
        'https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%%2FNew_York',
        urlencode($lat),
        urlencode($lon)
    );
    
    $weather_response = wp_remote_get($weather_url, ['timeout' => 10]);
    
    if (is_wp_error($weather_response)) {
        return new WP_Error('weather_error', 'Failed to fetch weather data', ['status' => 500]);
    }
    
    $weather_body = wp_remote_retrieve_body($weather_response);
    $weather_data = json_decode($weather_body, true);
    
    if (!isset($weather_data['current'])) {
        return new WP_Error('weather_error', 'Invalid weather response', ['status' => 500]);
    }
    
    // Map WMO weather codes to descriptions and icons
    $weather_code = $weather_data['current']['weather_code'] ?? 0;
    $weather_info = aquaticpro_get_weather_description($weather_code);
    
    $result = [
        'temp' => round($weather_data['current']['temperature_2m']),
        'description' => $weather_info['description'],
        'icon' => $weather_info['icon'],
        'city' => $city,
        'humidity' => $weather_data['current']['relative_humidity_2m'] ?? 0,
        'wind_speed' => round($weather_data['current']['wind_speed_10m'] ?? 0),
    ];
    
    // Cache for 30 minutes
    set_transient($cache_key, $result, 30 * MINUTE_IN_SECONDS);
    
    $response = rest_ensure_response($result);
    // Add HTTP cache headers - weather data, 30 min browser cache, public
    if (function_exists('mp_add_cache_headers')) {
        $response = mp_add_cache_headers($response, 1800, 300, false);
    }
    return $response;
    
    } catch (Exception $e) {
        error_log('[Weather API] Exception: ' . $e->getMessage());
        return new WP_Error('weather_error', 'Weather service error: ' . $e->getMessage(), ['status' => 500]);
    } catch (Error $e) {
        error_log('[Weather API] Error: ' . $e->getMessage());
        return new WP_Error('weather_error', 'Weather service error: ' . $e->getMessage(), ['status' => 500]);
    }
}

/**
 * Map WMO weather codes to descriptions and icon names
 */
function aquaticpro_get_weather_description($code) {
    $codes = [
        0 => ['description' => 'Clear sky', 'icon' => 'clear'],
        1 => ['description' => 'Mainly clear', 'icon' => 'clear'],
        2 => ['description' => 'Partly cloudy', 'icon' => 'cloud'],
        3 => ['description' => 'Overcast', 'icon' => 'cloud'],
        45 => ['description' => 'Foggy', 'icon' => 'cloud'],
        48 => ['description' => 'Depositing rime fog', 'icon' => 'cloud'],
        51 => ['description' => 'Light drizzle', 'icon' => 'rain'],
        53 => ['description' => 'Moderate drizzle', 'icon' => 'rain'],
        55 => ['description' => 'Dense drizzle', 'icon' => 'rain'],
        56 => ['description' => 'Light freezing drizzle', 'icon' => 'rain'],
        57 => ['description' => 'Dense freezing drizzle', 'icon' => 'rain'],
        61 => ['description' => 'Slight rain', 'icon' => 'rain'],
        63 => ['description' => 'Moderate rain', 'icon' => 'rain'],
        65 => ['description' => 'Heavy rain', 'icon' => 'rain'],
        66 => ['description' => 'Light freezing rain', 'icon' => 'rain'],
        67 => ['description' => 'Heavy freezing rain', 'icon' => 'rain'],
        71 => ['description' => 'Slight snow', 'icon' => 'cloud'],
        73 => ['description' => 'Moderate snow', 'icon' => 'cloud'],
        75 => ['description' => 'Heavy snow', 'icon' => 'cloud'],
        77 => ['description' => 'Snow grains', 'icon' => 'cloud'],
        80 => ['description' => 'Slight rain showers', 'icon' => 'rain'],
        81 => ['description' => 'Moderate rain showers', 'icon' => 'rain'],
        82 => ['description' => 'Violent rain showers', 'icon' => 'rain'],
        85 => ['description' => 'Slight snow showers', 'icon' => 'cloud'],
        86 => ['description' => 'Heavy snow showers', 'icon' => 'cloud'],
        95 => ['description' => 'Thunderstorm', 'icon' => 'storm'],
        96 => ['description' => 'Thunderstorm with slight hail', 'icon' => 'storm'],
        99 => ['description' => 'Thunderstorm with heavy hail', 'icon' => 'storm'],
    ];
    
    return $codes[$code] ?? ['description' => 'Unknown', 'icon' => 'clear'];
}

/**
 * Helper: Get action buttons data
 */
function aquaticpro_get_action_buttons_data() {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    
    // Check if table exists
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table}'");
    if (!$table_exists) {
        return [];
    }
    
    // Check if visible_to_roles column exists
    $col = $wpdb->get_results("SHOW COLUMNS FROM {$table} LIKE 'visible_to_roles'");
    $has_visible_to_roles_column = !empty($col);
    
    // Select only columns that exist
    if ($has_visible_to_roles_column) {
        $buttons = $wpdb->get_results(
            "SELECT * FROM {$table} ORDER BY sort_order ASC",
            ARRAY_A
        );
    } else {
        $buttons = $wpdb->get_results(
            "SELECT id, title, url, color, thumbnail_url, sort_order FROM {$table} ORDER BY sort_order ASC",
            ARRAY_A
        );
    }
    
    return array_map(function($btn) use ($has_visible_to_roles_column) {
        $visible_roles = null;
        if ($has_visible_to_roles_column && !empty($btn['visible_to_roles'])) {
            $visible_roles = json_decode($btn['visible_to_roles'], true);
        }
        return [
            'id' => (int) $btn['id'],
            'title' => $btn['title'],
            'url' => $btn['url'],
            'color' => $btn['color'],
            'thumbnail_url' => $btn['thumbnail_url'] ?? '',
            'visible_to_roles' => $visible_roles,
            'sort_order' => (int) $btn['sort_order'],
        ];
    }, $buttons ?: []);
}

/**
 * GET /dashboard/action-buttons
 */
function aquaticpro_get_action_buttons() {
    return rest_ensure_response(aquaticpro_get_action_buttons_data());
}

/**
 * POST /dashboard/action-buttons
 */
function aquaticpro_create_action_button($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    
    $params = $request->get_json_params();
    
    // Handle visible_to_roles - convert array to JSON, null means visible to all
    $visible_to_roles = null;
    if (isset($params['visible_to_roles']) && is_array($params['visible_to_roles']) && !empty($params['visible_to_roles'])) {
        $visible_to_roles = wp_json_encode(array_map('absint', $params['visible_to_roles']));
    }
    
    $data = [
        'title' => sanitize_text_field($params['title'] ?? ''),
        'url' => esc_url_raw($params['url'] ?? ''),
        'color' => sanitize_text_field($params['color'] ?? 'blue'),
        'thumbnail_url' => esc_url_raw($params['thumbnail_url'] ?? ''),
        'visible_to_roles' => $visible_to_roles,
        'sort_order' => absint($params['sort_order'] ?? 0),
        'created_at' => current_time('mysql'),
    ];
    
    if (empty($data['title']) || empty($data['url'])) {
        return new WP_Error('invalid_data', 'Title and URL are required', ['status' => 400]);
    }
    
    $inserted = $wpdb->insert($table, $data, ['%s', '%s', '%s', '%s', '%s', '%d', '%s']);
    
    if (!$inserted) {
        return new WP_Error('insert_failed', 'Failed to create button', ['status' => 500]);
    }
    
    $data['id'] = $wpdb->insert_id;
    $data['visible_to_roles'] = $visible_to_roles ? json_decode($visible_to_roles, true) : null;
    
    return rest_ensure_response($data);
}

/**
 * PUT /dashboard/action-buttons/{id}
 */
function aquaticpro_update_action_button($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    
    $id = (int) $request['id'];
    $params = $request->get_json_params();
    
    // Check if button exists
    $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table} WHERE id = %d", $id));
    if (!$exists) {
        return new WP_Error('not_found', 'Button not found', ['status' => 404]);
    }
    
    // Check if visible_to_roles column exists, add it if not
    $col = $wpdb->get_results("SHOW COLUMNS FROM {$table} LIKE 'visible_to_roles'");
    $has_visible_to_roles_column = !empty($col);
    
    // Auto-add the column if it doesn't exist
    if (!$has_visible_to_roles_column) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN visible_to_roles TEXT AFTER thumbnail_url");
        error_log("[Action Buttons] Auto-added visible_to_roles column to {$table}");
        $has_visible_to_roles_column = true;
    }
    
    $data = [];
    $format = [];
    
    if (isset($params['title'])) {
        $data['title'] = sanitize_text_field($params['title']);
        $format[] = '%s';
    }
    if (isset($params['url'])) {
        $data['url'] = esc_url_raw($params['url']);
        $format[] = '%s';
    }
    if (isset($params['color'])) {
        $data['color'] = sanitize_text_field($params['color']);
        $format[] = '%s';
    }
    if (isset($params['thumbnail_url'])) {
        $data['thumbnail_url'] = esc_url_raw($params['thumbnail_url']);
        $format[] = '%s';
    }
    if (array_key_exists('visible_to_roles', $params) && $has_visible_to_roles_column) {
        // Handle visible_to_roles - can be null (all roles) or array of role IDs
        if (is_array($params['visible_to_roles']) && !empty($params['visible_to_roles'])) {
            $data['visible_to_roles'] = wp_json_encode(array_map('absint', $params['visible_to_roles']));
            $format[] = '%s';
        } else {
            // For null values, we need to use a raw query instead
            $wpdb->query($wpdb->prepare(
                "UPDATE {$table} SET visible_to_roles = NULL WHERE id = %d",
                $id
            ));
        }
    }
    if (isset($params['sort_order'])) {
        $data['sort_order'] = absint($params['sort_order']);
        $format[] = '%d';
    }
    
    // Only call update if we have non-null data to update
    if (!empty($data)) {
        $updated = $wpdb->update($table, $data, ['id' => $id], $format, ['%d']);
        
        if ($updated === false) {
            error_log('[Action Buttons] Update failed: ' . $wpdb->last_error);
            return new WP_Error('update_failed', 'Failed to update button: ' . $wpdb->last_error, ['status' => 500]);
        }
    }
    
    return rest_ensure_response(['success' => true, 'message' => 'Button updated']);
}

/**
 * DELETE /dashboard/action-buttons/{id}
 */
function aquaticpro_delete_action_button($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    
    $id = (int) $request['id'];
    
    $deleted = $wpdb->delete($table, ['id' => $id], ['%d']);
    
    if (!$deleted) {
        return new WP_Error('delete_failed', 'Failed to delete button', ['status' => 500]);
    }
    
    return rest_ensure_response(['success' => true, 'message' => 'Button deleted']);
}

/**
 * POST /dashboard/action-buttons/reorder
 */
function aquaticpro_reorder_action_buttons($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'aqp_dashboard_action_buttons';
    
    $params = $request->get_json_params();
    $buttons = $params['buttons'] ?? [];
    
    foreach ($buttons as $button) {
        $wpdb->update(
            $table,
            ['sort_order' => absint($button['sort_order'])],
            ['id' => absint($button['id'])],
            ['%d'],
            ['%d']
        );
    }
    
    return rest_ensure_response(['success' => true, 'message' => 'Order updated']);
}
