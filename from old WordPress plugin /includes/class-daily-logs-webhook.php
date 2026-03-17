<?php
/**
 * AquaticPro Daily Logs Webhook
 * 
 * Handles scheduled weekly export of daily logs to n8n webhook.
 * Runs every Friday at 4:00 AM local time.
 *
 * @package AquaticPro
 * @since 9.5.0
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

/**
 * Class AquaticPro_Daily_Logs_Webhook
 * 
 * Manages the weekly cron job for sending daily logs to an external webhook.
 */
class AquaticPro_Daily_Logs_Webhook {

    /**
     * The webhook URL to POST data to
     * 
     * @var string
     */
    private $webhook_url = '[YOUR_N8N_WEBHOOK]';

    /**
     * The cron hook name
     * 
     * @var string
     */
    const CRON_HOOK = 'aquaticpro_weekly_logs_webhook';

    /**
     * Constructor - register hooks
     */
    public function __construct() {
        // Register the cron event handler
        add_action(self::CRON_HOOK, [$this, 'send_weekly_logs']);
        
        // Schedule the cron job on WordPress init
        add_action('init', [$this, 'schedule_weekly_cron']);
        
        // Clean up on plugin deactivation
        register_deactivation_hook(plugin_dir_path(__DIR__) . 'mentorship-platform.php', [$this, 'unschedule_cron']);
    }

    /**
     * Schedule the weekly cron job for Friday at 4:00 AM
     * 
     * @return void
     */
    public function schedule_weekly_cron() {
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            // Calculate next Friday at 4:00 AM local time
            $next_friday = $this->get_next_friday_4am();
            
            // Schedule weekly event
            wp_schedule_event($next_friday, 'weekly', self::CRON_HOOK);
            
            error_log('AquaticPro: Weekly logs webhook scheduled for ' . date('Y-m-d H:i:s', $next_friday));
        }
    }

    /**
     * Calculate the timestamp for the next Friday at 4:00 AM local time
     * 
     * @return int Unix timestamp
     */
    private function get_next_friday_4am() {
        $timezone = wp_timezone();
        $now = new DateTime('now', $timezone);
        
        // Create a DateTime for 4:00 AM today
        $target = new DateTime('today 04:00:00', $timezone);
        
        // Get current day of week (0 = Sunday, 5 = Friday)
        $current_day = (int) $now->format('w');
        $friday = 5;
        
        // Calculate days until next Friday
        $days_until_friday = ($friday - $current_day + 7) % 7;
        
        // If today is Friday but 4AM has passed, schedule for next week
        if ($days_until_friday === 0 && $now >= $target) {
            $days_until_friday = 7;
        }
        
        // If it's past Friday this week, calculate to next Friday
        if ($days_until_friday === 0) {
            // It's Friday and before 4AM, use today
        } else {
            $target->modify("+{$days_until_friday} days");
        }
        
        return $target->getTimestamp();
    }

    /**
     * Unschedule the cron job (called on plugin deactivation)
     * 
     * @return void
     */
    public function unschedule_cron() {
        $timestamp = wp_next_scheduled(self::CRON_HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::CRON_HOOK);
            error_log('AquaticPro: Weekly logs webhook unscheduled');
        }
    }

    /**
     * Main cron job handler - query logs and POST to webhook
     * 
     * @return void
     */
    public function send_weekly_logs() {
        error_log('AquaticPro: Starting weekly logs webhook export');
        
        // Get logs from the past 7 days
        $logs = $this->get_weekly_logs();
        
        if (empty($logs)) {
            error_log('AquaticPro: No daily logs found for the past 7 days');
            return;
        }
        
        error_log('AquaticPro: Found ' . count($logs) . ' daily logs to export');
        
        // Format logs for the webhook
        $formatted_logs = $this->format_logs_for_webhook($logs);
        
        // POST to webhook
        $result = $this->post_to_webhook($formatted_logs);
        
        if ($result) {
            error_log('AquaticPro: Successfully sent ' . count($formatted_logs) . ' logs to webhook');
        } else {
            error_log('AquaticPro: Failed to send logs to webhook');
        }
    }

    /**
     * Query daily logs created in the past 7 days
     * 
     * @return array Array of log objects
     */
    private function get_weekly_logs() {
        global $wpdb;
        
        $seven_days_ago = date('Y-m-d', strtotime('-7 days'));
        
        $query = $wpdb->prepare("
            SELECT 
                p.ID as id,
                p.post_title as title,
                p.post_content as content,
                p.post_author as author_id,
                p.post_status as status,
                p.post_date as created_at,
                u.display_name as author_name,
                pm_location.meta_value as location_id,
                pm_date.meta_value as log_date
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->users} u ON p.post_author = u.ID
            LEFT JOIN {$wpdb->postmeta} pm_location ON p.ID = pm_location.post_id AND pm_location.meta_key = '_location_id'
            LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_log_date'
            WHERE p.post_type = 'mp_daily_log'
            AND p.post_status IN ('publish', 'draft')
            AND p.post_date >= %s
            ORDER BY p.post_date DESC
        ", $seven_days_ago . ' 00:00:00');
        
        return $wpdb->get_results($query);
    }

    /**
     * Format logs as JSON array for the webhook
     * 
     * @param array $logs Raw log objects from database
     * @return array Formatted log data
     */
    private function format_logs_for_webhook($logs) {
        global $wpdb;
        
        // Get locations lookup
        $locations_table = $wpdb->prefix . 'pg_locations';
        $locations = $wpdb->get_results("SELECT id, name FROM {$locations_table}", OBJECT_K);
        
        // Get reactions table name
        $reactions_table = $wpdb->prefix . 'mp_daily_log_reactions';
        
        $formatted = [];
        
        foreach ($logs as $log) {
            // Get reaction counts
            $reaction_counts = $this->get_reaction_counts($log->id);
            
            // Get comments with authors and reaction counts
            $comments = $this->get_comments_with_reactions($log->id);
            
            // Get location name
            $location_name = '';
            if ($log->location_id && isset($locations[$log->location_id])) {
                $location_name = $locations[$log->location_id]->name;
            }
            
            $formatted[] = [
                'id' => (int) $log->id,
                'author_name' => $log->author_name ?: 'Unknown',
                'location' => $location_name,
                'content' => wp_strip_all_tags($log->content),
                'log_date' => $log->log_date,
                'status' => $log->status,
                'reaction_counts' => $reaction_counts,
                'comment_count' => count($comments),
                'comments' => $comments,
                'created_at' => $log->created_at,
            ];
        }
        
        return $formatted;
    }

    /**
     * Get comments for a log with author info and reaction counts
     * 
     * @param int $log_id The post ID of the daily log
     * @return array Array of comments with author and reactions
     */
    private function get_comments_with_reactions($log_id) {
        global $wpdb;
        
        // Get all approved comments for this log
        $comments = $wpdb->get_results($wpdb->prepare(
            "SELECT 
                c.comment_ID as id,
                c.comment_content as content,
                c.comment_date as created_at,
                c.user_id,
                u.display_name as author_name
            FROM {$wpdb->comments} c
            LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
            WHERE c.comment_post_ID = %d 
            AND c.comment_approved = '1'
            ORDER BY c.comment_date ASC",
            $log_id
        ));
        
        if (empty($comments)) {
            return [];
        }
        
        $formatted_comments = [];
        
        foreach ($comments as $comment) {
            $comment_reactions = $this->get_comment_reaction_counts($comment->id);
            
            $formatted_comments[] = [
                'id' => (int) $comment->id,
                'author_name' => $comment->author_name ?: 'Anonymous',
                'content' => wp_strip_all_tags($comment->content),
                'reaction_counts' => $comment_reactions,
                'created_at' => $comment->created_at,
            ];
        }
        
        return $formatted_comments;
    }

    /**
     * Get reaction counts for a specific comment
     * 
     * @param int $comment_id The comment ID
     * @return array Reaction counts by type
     */
    private function get_comment_reaction_counts($comment_id) {
        global $wpdb;
        
        $reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
        
        $counts = $wpdb->get_results($wpdb->prepare(
            "SELECT reaction_type, COUNT(*) as count 
            FROM {$reactions_table} 
            WHERE object_id = %d AND object_type = 'comment'
            GROUP BY reaction_type",
            $comment_id
        ), OBJECT_K);
        
        return [
            'thumbs_up' => isset($counts['thumbs_up']) ? (int) $counts['thumbs_up']->count : 0,
            'thumbs_down' => isset($counts['thumbs_down']) ? (int) $counts['thumbs_down']->count : 0,
            'heart' => isset($counts['heart']) ? (int) $counts['heart']->count : 0,
            'total' => array_sum(array_map(function($c) { return (int) $c->count; }, (array) $counts)),
        ];
    }

    /**
     * Get reaction counts for a specific log
     * 
     * @param int $log_id The post ID of the daily log
     * @return array Reaction counts by type
     */
    private function get_reaction_counts($log_id) {
        global $wpdb;
        
        $reactions_table = $wpdb->prefix . 'aqp_unified_reactions';
        
        $counts = $wpdb->get_results($wpdb->prepare(
            "SELECT reaction_type, COUNT(*) as count 
            FROM {$reactions_table} 
            WHERE object_id = %d AND object_type = 'daily_log'
            GROUP BY reaction_type",
            $log_id
        ), OBJECT_K);
        
        return [
            'thumbs_up' => isset($counts['thumbs_up']) ? (int) $counts['thumbs_up']->count : 0,
            'thumbs_down' => isset($counts['thumbs_down']) ? (int) $counts['thumbs_down']->count : 0,
            'heart' => isset($counts['heart']) ? (int) $counts['heart']->count : 0,
            'total' => array_sum(array_map(function($c) { return (int) $c->count; }, (array) $counts)),
        ];
    }

    /**
     * POST the formatted logs to the n8n webhook
     * 
     * @param array $logs Formatted log data
     * @return bool Success status
     */
    private function post_to_webhook($logs) {
        if (empty($this->webhook_url) || $this->webhook_url === '[YOUR_N8N_WEBHOOK]') {
            error_log('AquaticPro: Webhook URL not configured');
            return false;
        }
        
        $payload = [
            'source' => 'aquaticpro',
            'export_type' => 'weekly_daily_logs',
            'export_date' => current_time('mysql'),
            'date_range' => [
                'from' => date('Y-m-d', strtotime('-7 days')),
                'to' => date('Y-m-d'),
            ],
            'total_logs' => count($logs),
            'logs' => $logs,
        ];
        
        $response = wp_remote_post($this->webhook_url, [
            'method' => 'POST',
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode($payload),
        ]);
        
        if (is_wp_error($response)) {
            error_log('AquaticPro: Webhook POST failed - ' . $response->get_error_message());
            return false;
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        
        if ($response_code >= 200 && $response_code < 300) {
            return true;
        }
        
        error_log('AquaticPro: Webhook returned status ' . $response_code);
        return false;
    }

    /**
     * Manually trigger the webhook (for testing/admin use)
     * 
     * @return array Result with success status and message
     */
    public function trigger_manual_export() {
        $this->send_weekly_logs();
        
        return [
            'success' => true,
            'message' => 'Weekly logs export triggered manually',
        ];
    }

    /**
     * Get the next scheduled run time
     * 
     * @return string|null Formatted date string or null if not scheduled
     */
    public function get_next_scheduled() {
        $timestamp = wp_next_scheduled(self::CRON_HOOK);
        if ($timestamp) {
            return date('Y-m-d H:i:s', $timestamp);
        }
        return null;
    }

    /**
     * Update the webhook URL
     * 
     * @param string $url The new webhook URL
     * @return void
     */
    public function set_webhook_url($url) {
        $this->webhook_url = esc_url_raw($url);
    }
}

// Initialize the webhook handler
$aquaticpro_daily_logs_webhook = new AquaticPro_Daily_Logs_Webhook();
