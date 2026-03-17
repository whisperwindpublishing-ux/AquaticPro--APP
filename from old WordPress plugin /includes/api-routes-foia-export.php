<?php
/**
 * FOIA Export REST API Routes
 * 
 * Provides FOIA-compliant data export functionality for administrators.
 * Allows exporting all user records while maintaining privacy.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register FOIA Export REST API routes
 */
add_action('rest_api_init', function() {
    $namespace = 'mentorship-platform/v1';
    
    // Get list of users for selection
    register_rest_route($namespace, '/foia-export/users', array(
        'methods' => 'GET',
        'callback' => 'mp_foia_get_users',
        'permission_callback' => 'mp_foia_admin_permission_check'
    ));
    
    // Get available record types and counts
    register_rest_route($namespace, '/foia-export/record-types', array(
        'methods' => 'GET',
        'callback' => 'mp_foia_get_record_types',
        'permission_callback' => 'mp_foia_admin_permission_check'
    ));
    
    // Preview export (get counts for selected users)
    register_rest_route($namespace, '/foia-export/preview', array(
        'methods' => 'POST',
        'callback' => 'mp_foia_preview_export',
        'permission_callback' => 'mp_foia_admin_permission_check'
    ));
    
    // Download export data
    register_rest_route($namespace, '/foia-export/download', array(
        'methods' => 'POST',
        'callback' => 'mp_foia_download_export',
        'permission_callback' => 'mp_foia_admin_permission_check'
    ));
});

/**
 * Check if user has admin permissions
 */
function mp_foia_admin_permission_check() {
    return current_user_can('manage_options') || current_user_can('administrator');
}

/**
 * Get list of users for selection
 */
function mp_foia_get_users(WP_REST_Request $request) {
    $users = get_users(array(
        'orderby' => 'display_name',
        'order' => 'ASC',
        'fields' => array('ID', 'display_name', 'user_email')
    ));
    
    $result = array();
    foreach ($users as $user) {
        $result[] = array(
            'id' => $user->ID,
            'displayName' => $user->display_name,
            'email' => $user->user_email
        );
    }
    
    return rest_ensure_response($result);
}

/**
 * Get available record types
 */
function mp_foia_get_record_types(WP_REST_Request $request) {
    return rest_ensure_response(array(
        array(
            'id' => 'daily_logs',
            'name' => 'Daily Logs',
            'description' => 'Daily log entries and comments'
        ),
        array(
            'id' => 'inservice_logs',
            'name' => 'In-Service Training Logs',
            'description' => 'Training sessions (created by or attended)'
        ),
        array(
            'id' => 'scan_audits',
            'name' => 'Scan Audit Logs',
            'description' => 'Pool scan audit records (as auditor or audited)'
        ),
        array(
            'id' => 'live_drills',
            'name' => 'Live Drills',
            'description' => 'Emergency drill records (as conductor or participant)'
        ),
        array(
            'id' => 'mentorship_goals',
            'name' => 'Mentorship Goals',
            'description' => 'Goal setting and tracking records'
        ),
        array(
            'id' => 'taskdeck_cards',
            'name' => 'TaskDeck Cards',
            'description' => 'Task cards (created by, assigned to, or commented on)'
        ),
        array(
            'id' => 'awesome_awards',
            'name' => 'Awesome Awards',
            'description' => 'Award nominations and votes (as nominee, nominator, or voter)'
        ),
        array(
            'id' => 'seasonal_returns',
            'name' => 'Seasonal Returns',
            'description' => 'Seasonal employment records and return status'
        ),
        array(
            'id' => 'mentorships',
            'name' => 'Mentorships',
            'description' => 'Mentorship relationships (as mentor or mentee)'
        ),
        array(
            'id' => 'user_profile',
            'name' => 'User Profile Data',
            'description' => 'User account information, roles, and metadata'
        )
    ));
}

/**
 * Generate IN clause with sanitized integer IDs
 */
function mp_foia_generate_in_clause($user_ids) {
    // Sanitize all IDs to integers
    $sanitized_ids = array_map('absint', $user_ids);
    // Filter out any zeros
    $sanitized_ids = array_filter($sanitized_ids, function($id) { return $id > 0; });
    // Return comma-separated list
    return implode(',', $sanitized_ids);
}

/**
 * Preview export - get record counts for selected users
 */
function mp_foia_preview_export(WP_REST_Request $request) {
    global $wpdb;
    
    $user_ids = $request->get_param('user_ids');
    $record_types = $request->get_param('record_types');
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    
    if (empty($user_ids)) {
        return new WP_Error('no_users', 'No users selected', array('status' => 400));
    }
    
    // Generate safe IN clause
    $in_clause = mp_foia_generate_in_clause($user_ids);
    
    if (empty($in_clause)) {
        return new WP_Error('invalid_users', 'Invalid user IDs', array('status' => 400));
    }
    
    $counts = array();
    
    // Daily Logs count (WordPress custom post type mp_daily_log)
    if (empty($record_types) || in_array('daily_logs', $record_types)) {
        $date_meta_clause = "";
        if ($date_from) {
            $date_meta_clause .= $wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key = '_log_date' AND pm.meta_value >= %s)", $date_from);
        }
        if ($date_to) {
            $date_meta_clause .= $wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key = '_log_date' AND pm.meta_value <= %s)", $date_to);
        }
        
        // Count logs authored by selected users
        $query = "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_daily_log' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_meta_clause}";
        $author_count = (int) $wpdb->get_var($query);
        
        // Count logs where selected users commented
        $comment_query = "SELECT COUNT(DISTINCT c.comment_post_ID) FROM {$wpdb->comments} c
            INNER JOIN {$wpdb->posts} p ON c.comment_post_ID = p.ID
            WHERE p.post_type = 'mp_daily_log'
            AND p.post_status IN ('publish', 'draft')
            AND c.user_id IN ({$in_clause})
            AND p.post_author NOT IN ({$in_clause})
            {$date_meta_clause}";
        $comment_count = (int) $wpdb->get_var($comment_query);
        
        $counts['daily_logs'] = $author_count + $comment_count;
    }
    
    // In-Service Logs count (as creator or attendee)
    if (empty($record_types) || in_array('inservice_logs', $record_types)) {
        $table = $wpdb->prefix . 'pg_inservice_logs';
        $attendee_table = $wpdb->prefix . 'pg_inservice_attendees';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND training_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND training_date <= %s", $date_to);
            }
            
            // Count as creator
            $query = "SELECT COUNT(*) FROM {$table} WHERE created_by IN ({$in_clause}) {$date_clause}";
            $created_count = (int) $wpdb->get_var($query);
            
            // Count as attendee (excluding already counted as creator)
            $attendee_query = "SELECT COUNT(DISTINCT l.id) FROM {$table} l
                INNER JOIN {$attendee_table} a ON l.id = a.inservice_id
                WHERE a.user_id IN ({$in_clause})
                AND l.created_by NOT IN ({$in_clause})
                {$date_clause}";
            $attendee_count = (int) $wpdb->get_var($attendee_query);
            
            $counts['inservice_logs'] = $created_count + $attendee_count;
        } else {
            $counts['inservice_logs'] = 0;
        }
    }
    
    // Scan Audit Logs count (as auditor OR audited user)
    if (empty($record_types) || in_array('scan_audits', $record_types)) {
        $table = $wpdb->prefix . 'pg_scan_audit_logs';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND audit_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND audit_date <= %s", $date_to);
            }
            
            // Count where user is auditor OR audited
            $query = "SELECT COUNT(*) FROM {$table} 
                WHERE (auditor_id IN ({$in_clause}) OR audited_user_id IN ({$in_clause}))
                {$date_clause}";
            $counts['scan_audits'] = (int) $wpdb->get_var($query);
        } else {
            $counts['scan_audits'] = 0;
        }
    }
    
    // Live Drills count (as conductor OR drilled user)
    if (empty($record_types) || in_array('live_drills', $record_types)) {
        $table = $wpdb->prefix . 'pg_live_recognition_drill_logs';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND drill_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND drill_date <= %s", $date_to);
            }
            
            // Count where user is conductor OR drilled
            $query = "SELECT COUNT(*) FROM {$table} 
                WHERE (drill_conductor_id IN ({$in_clause}) OR drilled_user_id IN ({$in_clause}))
                {$date_clause}";
            $counts['live_drills'] = (int) $wpdb->get_var($query);
        } else {
            $counts['live_drills'] = 0;
        }
    }
    
    // Mentorship Goals count (WordPress custom post type mp_goal)
    if (empty($record_types) || in_array('mentorship_goals', $record_types)) {
        // Goals are linked to mentorships, which have mentor (post_author) and mentee (via meta)
        // For FOIA, we want goals where the user is involved in the mentorship
        $date_clause = "";
        if ($date_from) {
            $date_clause .= $wpdb->prepare(" AND p.post_date >= %s", $date_from);
        }
        if ($date_to) {
            $date_clause .= $wpdb->prepare(" AND p.post_date <= %s", $date_to);
        }
        
        // Count goals where user authored them
        $query = "SELECT COUNT(*) FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_goal' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_clause}";
        $counts['mentorship_goals'] = (int) $wpdb->get_var($query);
    }
    
    // TaskDeck Cards count (created by, assigned to, or commented on)
    if (empty($record_types) || in_array('taskdeck_cards', $record_types)) {
        $table = $wpdb->prefix . 'taskdeck_cards';
        $comments_table = $wpdb->prefix . 'taskdeck_card_comments';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) <= %s", $date_to);
            }
            
            // Count cards created by or assigned to users
            $query = "SELECT COUNT(*) FROM {$table} 
                WHERE (created_by IN ({$in_clause}) OR assigned_to IN ({$in_clause}))
                {$date_clause}";
            $card_count = (int) $wpdb->get_var($query);
            
            // Count cards where users commented (but aren't creator/assignee)
            $comment_count = 0;
            if ($wpdb->get_var("SHOW TABLES LIKE '{$comments_table}'") === $comments_table) {
                $comment_query = "SELECT COUNT(DISTINCT c.card_id) FROM {$comments_table} c
                    INNER JOIN {$table} t ON c.card_id = t.id
                    WHERE c.user_id IN ({$in_clause})
                    AND t.created_by NOT IN ({$in_clause})
                    AND (t.assigned_to IS NULL OR t.assigned_to NOT IN ({$in_clause}))
                    {$date_clause}";
                $comment_count = (int) $wpdb->get_var($comment_query);
            }
            
            $counts['taskdeck_cards'] = $card_count + $comment_count;
        } else {
            $counts['taskdeck_cards'] = 0;
        }
    }
    
    // Awesome Awards count (nominations as nominee or nominator, votes)
    if (empty($record_types) || in_array('awesome_awards', $record_types)) {
        $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
        $votes_table = $wpdb->prefix . 'awesome_awards_votes';
        
        $nominations_count = 0;
        $votes_count = 0;
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$nominations_table}'") === $nominations_table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) <= %s", $date_to);
            }
            
            // Count nominations where user is nominee or nominator
            $query = "SELECT COUNT(*) FROM {$nominations_table} 
                WHERE (nominee_id IN ({$in_clause}) OR nominator_id IN ({$in_clause}))
                {$date_clause}";
            $nominations_count = (int) $wpdb->get_var($query);
        }
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$votes_table}'") === $votes_table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) <= %s", $date_to);
            }
            
            // Count votes by users
            $query = "SELECT COUNT(*) FROM {$votes_table} 
                WHERE voter_id IN ({$in_clause})
                {$date_clause}";
            $votes_count = (int) $wpdb->get_var($query);
        }
        
        $counts['awesome_awards'] = $nominations_count + $votes_count;
    }
    
    // Seasonal Returns count (employee seasons)
    if (empty($record_types) || in_array('seasonal_returns', $record_types)) {
        $table = $wpdb->prefix . 'srm_employee_seasons';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            // Count employee season records
            $query = "SELECT COUNT(*) FROM {$table} WHERE user_id IN ({$in_clause})";
            $counts['seasonal_returns'] = (int) $wpdb->get_var($query);
        } else {
            $counts['seasonal_returns'] = 0;
        }
    }
    
    // Mentorships count (as mentor or mentee)
    if (empty($record_types) || in_array('mentorships', $record_types)) {
        $date_clause = "";
        if ($date_from) {
            $date_clause .= $wpdb->prepare(" AND p.post_date >= %s", $date_from);
        }
        if ($date_to) {
            $date_clause .= $wpdb->prepare(" AND p.post_date <= %s", $date_to);
        }
        
        // Count mentorships where user is mentor (post_author)
        $mentor_query = "SELECT COUNT(*) FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_mentorship' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_clause}";
        $mentor_count = (int) $wpdb->get_var($mentor_query);
        
        // Count mentorships where user is mentee (via postmeta _mentee_id)
        $mentee_query = "SELECT COUNT(*) FROM {$wpdb->posts} p 
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_mentee_id'
            WHERE p.post_type = 'mp_mentorship' 
            AND p.post_status IN ('publish', 'draft')
            AND pm.meta_value IN ({$in_clause})
            AND p.post_author NOT IN ({$in_clause})
            {$date_clause}";
        $mentee_count = (int) $wpdb->get_var($mentee_query);
        
        $counts['mentorships'] = $mentor_count + $mentee_count;
    }
    
    // User Profile Data count
    if (empty($record_types) || in_array('user_profile', $record_types)) {
        // Each selected user has 1 profile record
        $counts['user_profile'] = count($user_ids);
    }
    
    $total = array_sum($counts);
    
    // Build user info array
    $users_info = array();
    foreach ($user_ids as $uid) {
        $user = get_userdata(absint($uid));
        if ($user) {
            $users_info[] = array(
                'id' => $user->ID,
                'name' => $user->display_name,
                'email' => $user->user_email
            );
        }
    }
    
    return rest_ensure_response(array(
        'users' => $users_info,
        'counts' => $counts,
        'total_records' => $total
    ));
}

/**
 * Download export data as CSV
 */
function mp_foia_download_export(WP_REST_Request $request) {
    global $wpdb;
    set_time_limit(120);
    
    $user_ids = $request->get_param('user_ids');
    $record_types = $request->get_param('record_types');
    $date_from = $request->get_param('date_from');
    $date_to = $request->get_param('date_to');
    
    if (empty($user_ids)) {
        return new WP_Error('no_users', 'No users selected', array('status' => 400));
    }
    
    // Generate safe IN clause
    $in_clause = mp_foia_generate_in_clause($user_ids);
    
    if (empty($in_clause)) {
        return new WP_Error('invalid_users', 'Invalid user IDs', array('status' => 400));
    }
    
    // Build comprehensive user display name lookup (all users for cross-references)
    $user_lookup = array();
    $all_users = get_users(array('fields' => array('ID', 'display_name')));
    foreach ($all_users as $user) {
        $user_lookup[$user->ID] = $user->display_name;
    }
    
    $export_data = array();
    
    // ========== DAILY LOGS (WordPress custom post type mp_daily_log) ==========
    if (empty($record_types) || in_array('daily_logs', $record_types)) {
        $date_meta_clause = "";
        if ($date_from) {
            $date_meta_clause .= $wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key = '_log_date' AND pm.meta_value >= %s)", $date_from);
        }
        if ($date_to) {
            $date_meta_clause .= $wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} pm WHERE pm.post_id = p.ID AND pm.meta_key = '_log_date' AND pm.meta_value <= %s)", $date_to);
        }
        
        // Get logs authored by selected users
        $query = "SELECT p.ID, p.post_author, p.post_title, p.post_content, p.post_date, p.post_status
            FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_daily_log' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_meta_clause}
            ORDER BY p.post_date DESC";
        $author_logs = $wpdb->get_results($query, ARRAY_A);
        
        // Get logs where selected users commented (but aren't the author)
        $comment_query = "SELECT DISTINCT p.ID, p.post_author, p.post_title, p.post_content, p.post_date, p.post_status
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->comments} c ON c.comment_post_ID = p.ID
            WHERE p.post_type = 'mp_daily_log'
            AND p.post_status IN ('publish', 'draft')
            AND c.user_id IN ({$in_clause})
            AND p.post_author NOT IN ({$in_clause})
            {$date_meta_clause}
            ORDER BY p.post_date DESC";
        $comment_logs = $wpdb->get_results($comment_query, ARRAY_A);
        
        $all_logs = array_merge($author_logs, $comment_logs);
        
        if (!empty($all_logs)) {
            $export_data[] = array('section' => 'DAILY LOGS');
            $export_data[] = array('Record ID', 'Author', 'Log Date', 'Location', 'Time Slots', 'Job Role', 'Title', 'Content', 'Status', 'Comments', 'Created At');
            
            // OPTIMIZED: Batch fetch all lookup data upfront instead of per-row queries
            $locations_table = $wpdb->prefix . 'pg_locations';
            $time_slots_table = $wpdb->prefix . 'mp_time_slots';
            $roles_table = $wpdb->prefix . 'pg_job_roles';
            
            // Pre-fetch all locations, time slots, and job roles in single queries
            $all_locations = $wpdb->get_results("SELECT id, name FROM {$locations_table}", OBJECT_K);
            $all_time_slots = $wpdb->get_results("SELECT id, label FROM {$time_slots_table}", OBJECT_K);
            $all_job_roles = $wpdb->get_results("SELECT id, title FROM {$roles_table}", OBJECT_K);

            // Batch-fetch all postmeta for all log post IDs in one query
            $all_log_post_ids = array_column($all_logs, 'ID');
            $meta_map = array();
            if (!empty($all_log_post_ids)) {
                $ids_in = implode(',', array_map('intval', $all_log_post_ids));
                $meta_rows = $wpdb->get_results(
                    "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta}
                     WHERE post_id IN ({$ids_in})
                     AND meta_key IN ('_log_date','_location_id','_time_slot_ids','_job_role_id')"
                );
                foreach ($meta_rows as $m) {
                    $meta_map[$m->post_id][$m->meta_key] = maybe_unserialize($m->meta_value);
                }
            }

            // Batch-fetch all comments for these posts in one query
            $comments_map = array();
            if (!empty($all_log_post_ids)) {
                $all_comments = get_comments(array('post__in' => $all_log_post_ids, 'status' => 'approve', 'number' => 0));
                foreach ($all_comments as $comment) {
                    $comments_map[$comment->comment_post_ID][] = $comment;
                }
            }

            foreach ($all_logs as $row) {
                $post_id = $row['ID'];

                // Get meta data from pre-fetched map
                $log_date      = $meta_map[$post_id]['_log_date'] ?? '';
                $location_id   = $meta_map[$post_id]['_location_id'] ?? '';
                $time_slot_ids = $meta_map[$post_id]['_time_slot_ids'] ?? array();
                $job_role_id   = $meta_map[$post_id]['_job_role_id'] ?? '';
                
                // Get location name from pre-fetched lookup
                $location_name = '';
                if ($location_id && isset($all_locations[$location_id])) {
                    $location_name = $all_locations[$location_id]->name;
                }
                
                // Get time slot labels from pre-fetched lookup
                $time_slots = '';
                if (!empty($time_slot_ids) && is_array($time_slot_ids)) {
                    $slot_labels = array();
                    foreach ($time_slot_ids as $slot_id) {
                        if (isset($all_time_slots[$slot_id])) {
                            $slot_labels[] = $all_time_slots[$slot_id]->label;
                        }
                    }
                    $time_slots = implode(', ', $slot_labels);
                }
                
                // Get job role name from pre-fetched lookup
                $job_role_name = '';
                if ($job_role_id && isset($all_job_roles[$job_role_id])) {
                    $job_role_name = $all_job_roles[$job_role_id]->title;
                }
                
                // Get comments for this log from pre-fetched map
                $comments = $comments_map[$post_id] ?? array();
                $comment_summaries = array();
                foreach ($comments as $comment) {
                    $commenter = isset($user_lookup[$comment->user_id]) ? $user_lookup[$comment->user_id] : $comment->comment_author;
                    $comment_summaries[] = "{$commenter}: " . strip_tags($comment->comment_content);
                }
                
                $export_data[] = array(
                    $post_id,
                    isset($user_lookup[$row['post_author']]) ? $user_lookup[$row['post_author']] : 'User #' . $row['post_author'],
                    $log_date ?: $row['post_date'],
                    $location_name,
                    $time_slots,
                    $job_role_name,
                    $row['post_title'],
                    strip_tags($row['post_content']), // Full content, not excerpt
                    $row['post_status'],
                    implode(' | ', $comment_summaries),
                    $row['post_date']
                );
            }
            $export_data[] = array(''); // Empty row separator
        }
    }
    
    // ========== IN-SERVICE TRAINING LOGS ==========
    if (empty($record_types) || in_array('inservice_logs', $record_types)) {
        $table = $wpdb->prefix . 'pg_inservice_logs';
        $attendee_table = $wpdb->prefix . 'pg_inservice_attendees';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND training_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND training_date <= %s", $date_to);
            }
            
            // Get logs created by selected users
            $query = "SELECT * FROM {$table} WHERE created_by IN ({$in_clause}) {$date_clause} ORDER BY training_date DESC";
            $created_logs = $wpdb->get_results($query, ARRAY_A);
            
            // Get logs where selected users are attendees (but not creator)
            $attendee_query = "SELECT DISTINCT l.* FROM {$table} l
                INNER JOIN {$attendee_table} a ON l.id = a.inservice_id
                WHERE a.user_id IN ({$in_clause})
                AND l.created_by NOT IN ({$in_clause})
                {$date_clause}
                ORDER BY l.training_date DESC";
            $attended_logs = $wpdb->get_results($attendee_query, ARRAY_A);
            
            $all_logs = array_merge($created_logs, $attended_logs);
            
            if (!empty($all_logs)) {
                $export_data[] = array('section' => 'IN-SERVICE TRAINING LOGS');
                $export_data[] = array('Record ID', 'Created By', 'Training Date', 'Duration (mins)', 'Topic', 'Description', 'Location', 'Attendees', 'Created At');

                // Batch-fetch all attendees for all inservice logs in one query
                $all_inservice_ids = array_column($all_logs, 'id');
                $inservice_attendees_map = array();
                if (!empty($all_inservice_ids)) {
                    $ids_in = implode(',', array_map('intval', $all_inservice_ids));
                    $att_rows = $wpdb->get_results("SELECT inservice_id, user_id FROM {$attendee_table} WHERE inservice_id IN ({$ids_in})");
                    foreach ($att_rows as $att) {
                        $inservice_attendees_map[$att->inservice_id][] = $att->user_id;
                    }
                }

                foreach ($all_logs as $row) {
                    // Get attendees from pre-fetched map
                    $attendee_ids = $inservice_attendees_map[$row['id']] ?? array();
                    $attendee_names = array();
                    foreach ($attendee_ids as $aid) {
                        $attendee_names[] = isset($user_lookup[$aid]) ? $user_lookup[$aid] : 'User #' . $aid;
                    }
                    
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['created_by']]) ? $user_lookup[$row['created_by']] : 'User #' . $row['created_by'],
                        isset($row['training_date']) ? $row['training_date'] : '',
                        isset($row['duration_minutes']) ? $row['duration_minutes'] : '',
                        isset($row['topic']) ? $row['topic'] : '',
                        isset($row['description']) ? strip_tags($row['description']) : '',
                        isset($row['location']) ? $row['location'] : '',
                        implode('; ', $attendee_names),
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
    }
    
    // ========== SCAN AUDIT LOGS (auditor_id and audited_user_id) ==========
    if (empty($record_types) || in_array('scan_audits', $record_types)) {
        $table = $wpdb->prefix . 'pg_scan_audit_logs';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND audit_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND audit_date <= %s", $date_to);
            }
            
            // Get records where user is auditor OR audited
            $query = "SELECT * FROM {$table} 
                WHERE (auditor_id IN ({$in_clause}) OR audited_user_id IN ({$in_clause}))
                {$date_clause}
                ORDER BY audit_date DESC";
            $results = $wpdb->get_results($query, ARRAY_A);
            
            if (!empty($results)) {
                $export_data[] = array('section' => 'SCAN AUDIT LOGS');
                $export_data[] = array('Record ID', 'Auditor', 'Audited User', 'Audit Date', 'Location', 'Result', 'Wearing Correct Uniform', 'Attentive to Zone', 'Posture Adjustment', 'Notes', 'Archived', 'Created At');
                
                foreach ($results as $row) {
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['auditor_id']]) ? $user_lookup[$row['auditor_id']] : 'User #' . $row['auditor_id'],
                        isset($user_lookup[$row['audited_user_id']]) ? $user_lookup[$row['audited_user_id']] : 'User #' . $row['audited_user_id'],
                        isset($row['audit_date']) ? $row['audit_date'] : '',
                        isset($row['location']) ? $row['location'] : '',
                        isset($row['result']) ? $row['result'] : '',
                        isset($row['wearing_correct_uniform']) ? ($row['wearing_correct_uniform'] ? 'Yes' : 'No') : '',
                        isset($row['attentive_to_zone']) ? ($row['attentive_to_zone'] ? 'Yes' : 'No') : '',
                        isset($row['posture_adjustment_5min']) ? ($row['posture_adjustment_5min'] ? 'Yes' : 'No') : '',
                        isset($row['notes']) ? strip_tags($row['notes']) : '',
                        isset($row['archived']) ? ($row['archived'] ? 'Yes' : 'No') : 'No',
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
    }
    
    // ========== LIVE DRILLS (drill_conductor_id and drilled_user_id) ==========
    if (empty($record_types) || in_array('live_drills', $record_types)) {
        $table = $wpdb->prefix . 'pg_live_recognition_drill_logs';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND drill_date >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND drill_date <= %s", $date_to);
            }
            
            // Get records where user is conductor OR drilled
            $query = "SELECT * FROM {$table} 
                WHERE (drill_conductor_id IN ({$in_clause}) OR drilled_user_id IN ({$in_clause}))
                {$date_clause}
                ORDER BY drill_date DESC";
            $results = $wpdb->get_results($query, ARRAY_A);
            
            if (!empty($results)) {
                $export_data[] = array('section' => 'LIVE RECOGNITION DRILLS');
                $export_data[] = array('Record ID', 'Drill Conductor', 'Drilled User', 'Drill Date', 'Location', 'Result', 'Notes', 'Archived', 'Created At');
                
                foreach ($results as $row) {
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['drill_conductor_id']]) ? $user_lookup[$row['drill_conductor_id']] : 'User #' . $row['drill_conductor_id'],
                        isset($user_lookup[$row['drilled_user_id']]) ? $user_lookup[$row['drilled_user_id']] : 'User #' . $row['drilled_user_id'],
                        isset($row['drill_date']) ? $row['drill_date'] : '',
                        isset($row['location']) ? $row['location'] : '',
                        isset($row['result']) ? $row['result'] : '',
                        isset($row['notes']) ? strip_tags($row['notes']) : '',
                        isset($row['archived']) ? ($row['archived'] ? 'Yes' : 'No') : 'No',
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
    }
    
    // ========== MENTORSHIP GOALS (WordPress custom post type mp_goal) ==========
    if (empty($record_types) || in_array('mentorship_goals', $record_types)) {
        $date_clause = "";
        if ($date_from) {
            $date_clause .= $wpdb->prepare(" AND p.post_date >= %s", $date_from);
        }
        if ($date_to) {
            $date_clause .= $wpdb->prepare(" AND p.post_date <= %s", $date_to);
        }
        
        // Get goals authored by selected users
        $query = "SELECT p.ID, p.post_author, p.post_title, p.post_content, p.post_date, p.post_status
            FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_goal' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_clause}
            ORDER BY p.post_date DESC";
        $results = $wpdb->get_results($query, ARRAY_A);
        
        if (!empty($results)) {
            $export_data[] = array('section' => 'MENTORSHIP GOALS');
            $export_data[] = array('Record ID', 'Author', 'Title', 'Content (excerpt)', 'Status', 'Mentorship ID', 'Goal Status', 'Created At');
            
            foreach ($results as $row) {
                $post_id = $row['ID'];
                $mentorship_id = get_post_meta($post_id, '_mentorship_id', true);
                $goal_status = get_post_meta($post_id, '_status', true);
                
                $export_data[] = array(
                    $post_id,
                    isset($user_lookup[$row['post_author']]) ? $user_lookup[$row['post_author']] : 'User #' . $row['post_author'],
                    $row['post_title'],
                    wp_trim_words(strip_tags($row['post_content']), 50),
                    $row['post_status'],
                    $mentorship_id ?: '',
                    $goal_status ?: '',
                    $row['post_date']
                );
            }
            $export_data[] = array(''); // Empty row separator
        }
    }
    
    // ========== TASKDECK CARDS ==========
    if (empty($record_types) || in_array('taskdeck_cards', $record_types)) {
        $table = $wpdb->prefix . 'taskdeck_cards';
        $comments_table = $wpdb->prefix . 'taskdeck_card_comments';
        $lists_table = $wpdb->prefix . 'taskdeck_lists';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(c.created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(c.created_at) <= %s", $date_to);
            }
            
            // Get cards created by or assigned to selected users
            $query = "SELECT c.*, l.list_name FROM {$table} c
                LEFT JOIN {$lists_table} l ON c.list_id = l.id
                WHERE (c.created_by IN ({$in_clause}) OR c.assigned_to IN ({$in_clause}))
                {$date_clause}
                ORDER BY c.created_at DESC";
            $direct_cards = $wpdb->get_results($query, ARRAY_A);
            
            // Get cards where users commented (but aren't creator/assignee)
            $commented_cards = array();
            if ($wpdb->get_var("SHOW TABLES LIKE '{$comments_table}'") === $comments_table) {
                $comment_date_clause = str_replace('c.created_at', 't.created_at', $date_clause);
                $comment_query = "SELECT DISTINCT t.*, l.list_name FROM {$comments_table} cm
                    INNER JOIN {$table} t ON cm.card_id = t.id
                    LEFT JOIN {$lists_table} l ON t.list_id = l.id
                    WHERE cm.user_id IN ({$in_clause})
                    AND t.created_by NOT IN ({$in_clause})
                    AND (t.assigned_to IS NULL OR t.assigned_to NOT IN ({$in_clause}))
                    {$comment_date_clause}
                    ORDER BY t.created_at DESC";
                $commented_cards = $wpdb->get_results($comment_query, ARRAY_A);
            }
            
            $all_cards = array_merge($direct_cards, $commented_cards);
            
            if (!empty($all_cards)) {
                $export_data[] = array('section' => 'TASKDECK CARDS');
                $export_data[] = array('Record ID', 'Created By', 'Assigned To', 'List', 'Title', 'Description', 'Due Date', 'Completed', 'Priority', 'Category', 'Created At');
                
                foreach ($all_cards as $row) {
                    $assigned_to = '';
                    if (!empty($row['assigned_to'])) {
                        $assigned_to = isset($user_lookup[$row['assigned_to']]) ? $user_lookup[$row['assigned_to']] : 'User #' . $row['assigned_to'];
                    }
                    
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['created_by']]) ? $user_lookup[$row['created_by']] : 'User #' . $row['created_by'],
                        $assigned_to,
                        isset($row['list_name']) ? $row['list_name'] : '',
                        isset($row['title']) ? $row['title'] : '',
                        isset($row['description']) ? wp_trim_words(strip_tags($row['description']), 30) : '',
                        isset($row['due_date']) ? $row['due_date'] : '',
                        isset($row['is_complete']) ? ($row['is_complete'] ? 'Yes' : 'No') : 'No',
                        isset($row['priority']) ? $row['priority'] : '',
                        isset($row['category_tag']) ? $row['category_tag'] : '',
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
            }
        }
    }
    
    // ========== AWESOME AWARDS (nominations and votes) ==========
    if (empty($record_types) || in_array('awesome_awards', $record_types)) {
        $nominations_table = $wpdb->prefix . 'awesome_awards_nominations';
        $votes_table = $wpdb->prefix . 'awesome_awards_votes';
        $categories_table = $wpdb->prefix . 'awesome_awards_categories';
        $periods_table = $wpdb->prefix . 'awesome_awards_periods';
        
        // Build category and period lookups
        $category_lookup = array();
        $period_lookup = array();
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$categories_table}'") === $categories_table) {
            $categories = $wpdb->get_results("SELECT id, name FROM {$categories_table}");
            foreach ($categories as $cat) {
                $category_lookup[$cat->id] = $cat->name;
            }
        }
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$periods_table}'") === $periods_table) {
            $periods = $wpdb->get_results("SELECT id, name, start_date, end_date FROM {$periods_table}");
            foreach ($periods as $period) {
                $period_lookup[$period->id] = $period->name . ' (' . $period->start_date . ' to ' . $period->end_date . ')';
            }
        }
        
        // Nominations
        if ($wpdb->get_var("SHOW TABLES LIKE '{$nominations_table}'") === $nominations_table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) <= %s", $date_to);
            }
            
            $query = "SELECT * FROM {$nominations_table} 
                WHERE (nominee_id IN ({$in_clause}) OR nominator_id IN ({$in_clause}))
                {$date_clause}
                ORDER BY created_at DESC";
            $results = $wpdb->get_results($query, ARRAY_A);
            
            if (!empty($results)) {
                $export_data[] = array('section' => 'AWESOME AWARDS - NOMINATIONS');
                $export_data[] = array('Record ID', 'Nominee', 'Nominator', 'Category', 'Period', 'Reason', 'Status', 'Created At');
                
                foreach ($results as $row) {
                    $category_name = isset($row['category_id']) && isset($category_lookup[$row['category_id']]) 
                        ? $category_lookup[$row['category_id']] : '';
                    $period_name = isset($row['period_id']) && isset($period_lookup[$row['period_id']]) 
                        ? $period_lookup[$row['period_id']] : '';
                    
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['nominee_id']]) ? $user_lookup[$row['nominee_id']] : 'User #' . $row['nominee_id'],
                        isset($user_lookup[$row['nominator_id']]) ? $user_lookup[$row['nominator_id']] : 'User #' . $row['nominator_id'],
                        $category_name,
                        $period_name,
                        isset($row['reason']) ? strip_tags($row['reason']) : '',
                        isset($row['status']) ? $row['status'] : '',
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
        
        // Votes
        if ($wpdb->get_var("SHOW TABLES LIKE '{$votes_table}'") === $votes_table) {
            $date_clause = "";
            if ($date_from) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) >= %s", $date_from);
            }
            if ($date_to) {
                $date_clause .= $wpdb->prepare(" AND DATE(created_at) <= %s", $date_to);
            }
            
            $query = "SELECT v.*, n.nominee_id, n.category_id, n.period_id FROM {$votes_table} v
                LEFT JOIN {$nominations_table} n ON v.nomination_id = n.id
                WHERE v.voter_id IN ({$in_clause})
                {$date_clause}
                ORDER BY v.created_at DESC";
            $results = $wpdb->get_results($query, ARRAY_A);
            
            if (!empty($results)) {
                $export_data[] = array('section' => 'AWESOME AWARDS - VOTES');
                $export_data[] = array('Record ID', 'Voter', 'Voted For (Nominee)', 'Category', 'Period', 'Created At');
                
                foreach ($results as $row) {
                    $nominee_name = isset($row['nominee_id']) && isset($user_lookup[$row['nominee_id']]) 
                        ? $user_lookup[$row['nominee_id']] : 'Unknown';
                    $category_name = isset($row['category_id']) && isset($category_lookup[$row['category_id']]) 
                        ? $category_lookup[$row['category_id']] : '';
                    $period_name = isset($row['period_id']) && isset($period_lookup[$row['period_id']]) 
                        ? $period_lookup[$row['period_id']] : '';
                    
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['voter_id']]) ? $user_lookup[$row['voter_id']] : 'User #' . $row['voter_id'],
                        $nominee_name,
                        $category_name,
                        $period_name,
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
    }
    
    // ========== SEASONAL RETURNS (employee seasons) ==========
    if (empty($record_types) || in_array('seasonal_returns', $record_types)) {
        $employee_seasons_table = $wpdb->prefix . 'srm_employee_seasons';
        $seasons_table = $wpdb->prefix . 'srm_seasons';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '{$employee_seasons_table}'") === $employee_seasons_table) {
            // Build seasons lookup
            $seasons_lookup = array();
            if ($wpdb->get_var("SHOW TABLES LIKE '{$seasons_table}'") === $seasons_table) {
                $seasons = $wpdb->get_results("SELECT id, name, start_date, end_date FROM {$seasons_table}");
                foreach ($seasons as $season) {
                    $seasons_lookup[$season->id] = array(
                        'name' => $season->name,
                        'dates' => $season->start_date . ' to ' . $season->end_date
                    );
                }
            }
            
            $query = "SELECT * FROM {$employee_seasons_table} 
                WHERE user_id IN ({$in_clause})
                ORDER BY created_at DESC";
            $results = $wpdb->get_results($query, ARRAY_A);
            
            if (!empty($results)) {
                $export_data[] = array('section' => 'SEASONAL RETURNS');
                $export_data[] = array('Record ID', 'Employee', 'Season', 'Season Dates', 'Invited', 'Return Intent', 'Intent Date', 'Start Date', 'Notes', 'Created At');
                
                foreach ($results as $row) {
                    $season_info = isset($row['season_id']) && isset($seasons_lookup[$row['season_id']]) 
                        ? $seasons_lookup[$row['season_id']] : array('name' => '', 'dates' => '');
                    
                    $export_data[] = array(
                        $row['id'],
                        isset($user_lookup[$row['user_id']]) ? $user_lookup[$row['user_id']] : 'User #' . $row['user_id'],
                        $season_info['name'],
                        $season_info['dates'],
                        isset($row['invited_at']) ? $row['invited_at'] : '',
                        isset($row['return_intent']) ? $row['return_intent'] : '',
                        isset($row['intent_date']) ? $row['intent_date'] : '',
                        isset($row['start_date']) ? $row['start_date'] : '',
                        isset($row['notes']) ? strip_tags($row['notes']) : '',
                        isset($row['created_at']) ? $row['created_at'] : ''
                    );
                }
                $export_data[] = array(''); // Empty row separator
            }
        }
    }
    
    // ========== MENTORSHIPS (as mentor or mentee) ==========
    if (empty($record_types) || in_array('mentorships', $record_types)) {
        $date_clause = "";
        if ($date_from) {
            $date_clause .= $wpdb->prepare(" AND p.post_date >= %s", $date_from);
        }
        if ($date_to) {
            $date_clause .= $wpdb->prepare(" AND p.post_date <= %s", $date_to);
        }
        
        // Get mentorships where user is mentor (post_author)
        $mentor_query = "SELECT p.ID, p.post_author, p.post_title, p.post_content, p.post_date, p.post_status
            FROM {$wpdb->posts} p 
            WHERE p.post_type = 'mp_mentorship' 
            AND p.post_status IN ('publish', 'draft')
            AND p.post_author IN ({$in_clause})
            {$date_clause}
            ORDER BY p.post_date DESC";
        $mentor_results = $wpdb->get_results($mentor_query, ARRAY_A);
        
        // Get mentorships where user is mentee
        $mentee_query = "SELECT p.ID, p.post_author, p.post_title, p.post_content, p.post_date, p.post_status
            FROM {$wpdb->posts} p 
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_mentee_id'
            WHERE p.post_type = 'mp_mentorship' 
            AND p.post_status IN ('publish', 'draft')
            AND pm.meta_value IN ({$in_clause})
            AND p.post_author NOT IN ({$in_clause})
            {$date_clause}
            ORDER BY p.post_date DESC";
        $mentee_results = $wpdb->get_results($mentee_query, ARRAY_A);
        
        $all_mentorships = array_merge($mentor_results, $mentee_results);
        
        if (!empty($all_mentorships)) {
            $export_data[] = array('section' => 'MENTORSHIPS');
            $export_data[] = array('Record ID', 'Mentor', 'Mentee', 'Title', 'Status', 'Start Date', 'End Date', 'Notes', 'Created At');
            
            foreach ($all_mentorships as $row) {
                $post_id = $row['ID'];
                $mentee_id = get_post_meta($post_id, '_mentee_id', true);
                $start_date = get_post_meta($post_id, '_start_date', true);
                $end_date = get_post_meta($post_id, '_end_date', true);
                $mentorship_status = get_post_meta($post_id, '_status', true);
                
                $export_data[] = array(
                    $post_id,
                    isset($user_lookup[$row['post_author']]) ? $user_lookup[$row['post_author']] : 'User #' . $row['post_author'],
                    isset($user_lookup[$mentee_id]) ? $user_lookup[$mentee_id] : 'User #' . $mentee_id,
                    $row['post_title'],
                    $mentorship_status ?: $row['post_status'],
                    $start_date ?: '',
                    $end_date ?: '',
                    wp_trim_words(strip_tags($row['post_content']), 50),
                    $row['post_date']
                );
            }
            $export_data[] = array(''); // Empty row separator
        }
    }
    
    // ========== USER PROFILE DATA ==========
    if (empty($record_types) || in_array('user_profile', $record_types)) {
        $export_data[] = array('section' => 'USER PROFILE DATA');
        $export_data[] = array('User ID', 'Display Name', 'Email', 'Username', 'Roles', 'Registered', 'Job Title', 'Phone', 'Bio');
        
        foreach ($user_ids as $uid) {
            $uid = absint($uid);
            $user = get_userdata($uid);
            if (!$user) continue;
            
            $job_title = get_user_meta($uid, 'job_title', true);
            $phone = get_user_meta($uid, 'phone', true);
            $description = get_user_meta($uid, 'description', true);
            
            $roles = implode(', ', $user->roles);
            
            $export_data[] = array(
                $uid,
                $user->display_name,
                $user->user_email,
                $user->user_login,
                $roles,
                $user->user_registered,
                $job_title ?: '',
                $phone ?: '',
                $description ? wp_trim_words($description, 30) : ''
            );
        }
        $export_data[] = array(''); // Empty row separator
    }
    
    // Build selected users list
    $selected_user_names = array();
    foreach ($user_ids as $uid) {
        $uid = absint($uid);
        if (isset($user_lookup[$uid])) {
            $selected_user_names[] = $user_lookup[$uid];
        }
    }
    
    // Generate Excel-compatible HTML format with proper styling
    $html = '<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Excel.Sheet">
<meta name="Generator" content="AquaticPro FOIA Export">
<!--[if gte mso 9]>
<xml>
<x:ExcelWorkbook>
<x:ExcelWorksheets>
<x:ExcelWorksheet>
<x:Name>FOIA Export</x:Name>
<x:WorksheetOptions>
<x:DisplayGridlines/>
</x:WorksheetOptions>
</x:ExcelWorksheet>
</x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { 
        border: 1px solid #ccc; 
        padding: 8px 12px; 
        text-align: left; 
        vertical-align: top;
        word-wrap: break-word;
        max-width: 300px;
        white-space: pre-wrap;
    }
    th { 
        background-color: #4472C4; 
        color: white; 
        font-weight: bold;
        position: sticky;
        top: 0;
    }
    tr:nth-child(even) { background-color: #f8f9fa; }
    tr:hover { background-color: #e8f4fd; }
    .section-header { 
        background-color: #2E5090; 
        color: white; 
        font-size: 14pt; 
        font-weight: bold; 
        padding: 12px;
        text-align: left;
    }
    .meta-info { 
        background-color: #f0f0f0; 
        padding: 10px; 
        margin-bottom: 20px;
        border: 1px solid #ddd;
    }
    .meta-info p { margin: 5px 0; }
    .long-text { max-width: 400px; }
    .short-text { max-width: 100px; }
    .date-col { width: 100px; white-space: nowrap; }
    .id-col { width: 60px; text-align: center; }
    .name-col { width: 150px; }
</style>
</head>
<body>
<div class="meta-info">
    <h2 style="margin: 0 0 10px 0; color: #2E5090;">FOIA Compliant Export Report</h2>
    <p><strong>Generated:</strong> ' . current_time('F j, Y g:i A') . '</p>
    <p><strong>Exported By:</strong> ' . esc_html(wp_get_current_user()->display_name) . '</p>
    <p><strong>Selected Users (' . count($selected_user_names) . '):</strong> ' . esc_html(implode(', ', $selected_user_names)) . '</p>';
    
    if ($date_from || $date_to) {
        $html .= '<p><strong>Date Range:</strong> ' . esc_html($date_from ?: 'Beginning') . ' to ' . esc_html($date_to ?: 'Present') . '</p>';
    }
    
    $html .= '</div>';
    
    // Process export data into HTML tables
    $current_section = '';
    $in_table = false;
    $header_row = null;
    
    foreach ($export_data as $row) {
        if (isset($row['section'])) {
            // Close previous table if open
            if ($in_table) {
                $html .= '</tbody></table><br/>';
                $in_table = false;
            }
            $current_section = $row['section'];
            $header_row = null;
            $html .= '<h3 class="section-header">' . esc_html($current_section) . '</h3>';
        } else {
            // First row after section is header
            if (!$header_row) {
                $header_row = $row;
                $html .= '<table><thead><tr>';
                foreach ($row as $cell) {
                    $class = '';
                    $cell_lower = strtolower($cell);
                    if (strpos($cell_lower, 'id') !== false && strlen($cell) < 12) $class = 'id-col';
                    elseif (strpos($cell_lower, 'date') !== false) $class = 'date-col';
                    elseif (strpos($cell_lower, 'content') !== false || strpos($cell_lower, 'description') !== false || strpos($cell_lower, 'notes') !== false || strpos($cell_lower, 'comments') !== false) $class = 'long-text';
                    elseif (strpos($cell_lower, 'name') !== false || strpos($cell_lower, 'by') !== false || strpos($cell_lower, 'user') !== false) $class = 'name-col';
                    
                    $html .= '<th' . ($class ? ' class="' . $class . '"' : '') . '>' . esc_html($cell) . '</th>';
                }
                $html .= '</tr></thead><tbody>';
                $in_table = true;
            } else {
                // Data row
                $html .= '<tr>';
                $col_index = 0;
                foreach ($row as $cell) {
                    $class = '';
                    if ($header_row && isset($header_row[$col_index])) {
                        $header_lower = strtolower($header_row[$col_index]);
                        if (strpos($header_lower, 'id') !== false && strlen($header_row[$col_index]) < 12) $class = 'id-col';
                        elseif (strpos($header_lower, 'date') !== false) $class = 'date-col';
                        elseif (strpos($header_lower, 'content') !== false || strpos($header_lower, 'description') !== false || strpos($header_lower, 'notes') !== false || strpos($header_lower, 'comments') !== false) $class = 'long-text';
                        elseif (strpos($header_lower, 'name') !== false || strpos($header_lower, 'by') !== false || strpos($header_lower, 'user') !== false) $class = 'name-col';
                    }
                    
                    // Clean and escape the cell content
                    $cell = $cell ?? '';
                    $cell = html_entity_decode((string)$cell, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $cell = strip_tags($cell);
                    // Convert newlines to <br> for display
                    $cell = nl2br(esc_html($cell));
                    
                    $html .= '<td' . ($class ? ' class="' . $class . '"' : '') . '>' . $cell . '</td>';
                    $col_index++;
                }
                $html .= '</tr>';
            }
        }
    }
    
    // Close final table if open
    if ($in_table) {
        $html .= '</tbody></table>';
    }
    
    $html .= '</body></html>';
    
    return rest_ensure_response(array(
        'csv' => $html,
        'filename' => 'foia-export-' . date('Y-m-d-His') . '.xls',
        'record_count' => count($export_data),
        'content_type' => 'application/vnd.ms-excel'
    ));
}
