#!/usr/bin/env php
<?php
/**
 * Standalone SRM Migration Script
 * Run this to create SRM tables without deactivating/reactivating the plugin
 * 
 * Usage: Navigate to the WordPress root and run:
 *   php wp-content/plugins/mentorship-platform/run-srm-migration.php
 */

// Try to load WordPress
$wp_load_paths = [
    __DIR__ . '/../../../wp-load.php',  // Standard WordPress install
    __DIR__ . '/../../../../wp-load.php', // WordPress in subfolder
];

$wp_loaded = false;
foreach ($wp_load_paths as $path) {
    if (file_exists($path)) {
        require_once($path);
        $wp_loaded = true;
        break;
    }
}

if (!$wp_loaded) {
    die("ERROR: Could not find wp-load.php. Please run this script from the WordPress root:\n  php wp-content/plugins/mentorship-platform/run-srm-migration.php\n");
}

echo "=== Seasonal Returns Module - Database Migration ===\n\n";

global $wpdb;
$charset_collate = $wpdb->get_charset_collate();

require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

// Check current status
echo "1. Checking current status...\n";
$srm_enabled = get_option('aquaticpro_enable_seasonal_returns', true);
echo "   - Module enabled: " . ($srm_enabled ? 'YES' : 'NO (will enable now)') . "\n";

if (!$srm_enabled) {
    update_option('aquaticpro_enable_seasonal_returns', true);
    echo "   - ✓ Module enabled\n";
}

// Create tables
echo "\n2. Creating database tables...\n";

$tables_created = 0;

// SRM Pay Configuration Table
$pay_config_table = $wpdb->prefix . 'srm_pay_config';
$sql = "CREATE TABLE $pay_config_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role_id BIGINT UNSIGNED NOT NULL,
    returning DECIMAL(10,2) NOT NULL,
    new_hire DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role (job_role_id)
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$pay_config_table}\n";

// SRM Seasons Table
$seasons_table = $wpdb->prefix . 'srm_seasons';
$sql = "CREATE TABLE $seasons_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft', 'active', 'archived') DEFAULT 'draft',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$seasons_table}\n";

// SRM Employee Seasons Table
$employee_seasons_table = $wpdb->prefix . 'srm_employee_seasons';
$sql = "CREATE TABLE $employee_seasons_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    season_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    returning_pay DECIMAL(10,2),
    new_hire_pay DECIMAL(10,2),
    inservice_hours_pay DECIMAL(10,2),
    seasonal_cert_bonus DECIMAL(10,2),
    longevity_bonus DECIMAL(10,2),
    is_returning TINYINT(1),
    comments TEXT,
    signature VARCHAR(255),
    response_token VARCHAR(64) UNIQUE,
    response_date DATETIME,
    invite_sent_at DATETIME,
    last_followup_at DATETIME,
    followup_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_season (season_id, user_id),
    KEY idx_response_token (response_token)
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$employee_seasons_table}\n";

// SRM Email Templates Table
$email_templates_table = $wpdb->prefix . 'srm_email_templates';
$sql = "CREATE TABLE $email_templates_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('initial', 'followup', 'reminder') NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_default TINYINT(1) DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$email_templates_table}\n";

// SRM Email Logs Table
$email_logs_table = $wpdb->prefix . 'srm_email_logs';
$sql = "CREATE TABLE $email_logs_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    season_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT UNSIGNED NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('sent', 'failed', 'bounced') DEFAULT 'sent',
    error_message TEXT,
    KEY idx_season_user (season_id, user_id)
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$email_logs_table}\n";

// SRM Retention Stats Table
$retention_stats_table = $wpdb->prefix . 'srm_retention_stats';
$sql = "CREATE TABLE $retention_stats_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    season_id BIGINT UNSIGNED NOT NULL,
    job_role_id BIGINT UNSIGNED,
    total_invited INT DEFAULT 0,
    total_responded INT DEFAULT 0,
    total_returning INT DEFAULT 0,
    total_not_returning INT DEFAULT 0,
    avg_response_time_days DECIMAL(5,2),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_season_role (season_id, job_role_id)
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$retention_stats_table}\n";

// SRM Permissions Table
$permissions_table = $wpdb->prefix . 'srm_permissions';
$sql = "CREATE TABLE $permissions_table (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role_id BIGINT UNSIGNED NOT NULL,
    srm_view_own_pay TINYINT(1) DEFAULT 1,
    srm_view_all_pay TINYINT(1) DEFAULT 0,
    srm_manage_pay_config TINYINT(1) DEFAULT 0,
    srm_send_invites TINYINT(1) DEFAULT 0,
    srm_view_responses TINYINT(1) DEFAULT 0,
    srm_manage_status TINYINT(1) DEFAULT 0,
    srm_manage_templates TINYINT(1) DEFAULT 0,
    srm_view_retention TINYINT(1) DEFAULT 0,
    srm_bulk_actions TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role (job_role_id)
) $charset_collate;";
dbDelta($sql);
$tables_created++;
echo "   - ✓ {$permissions_table}\n";

echo "\n3. Populating default permissions...\n";

// Insert default SRM permissions based on job role tier
$job_roles_table = $wpdb->prefix . 'pg_job_roles';
$existing_perms = $wpdb->get_var("SELECT COUNT(*) FROM $permissions_table");

if ($existing_perms == 0) {
    $job_roles = $wpdb->get_results("SELECT id, tier, name FROM $job_roles_table");
    
    if (empty($job_roles)) {
        echo "   ⚠ No job roles found. Permissions will be created when job roles are added.\n";
    } else {
        $added_count = 0;
        foreach ($job_roles as $role) {
            $tier = (int) $role->tier;
            
            // Tier 5-6: Full admin access
            if ($tier >= 5) {
                $perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 1,
                    'srm_manage_pay_config' => 1,
                    'srm_send_invites' => 1,
                    'srm_view_responses' => 1,
                    'srm_manage_status' => 1,
                    'srm_manage_templates' => 1,
                    'srm_view_retention' => 1,
                    'srm_bulk_actions' => 1
                ];
            }
            // Tier 3-4: Can view and send invites
            elseif ($tier >= 3) {
                $perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 1,
                    'srm_manage_pay_config' => 0,
                    'srm_send_invites' => 1,
                    'srm_view_responses' => 1,
                    'srm_manage_status' => 0,
                    'srm_manage_templates' => 0,
                    'srm_view_retention' => 1,
                    'srm_bulk_actions' => 0
                ];
            }
            // Tier 1-2: Can only view own pay
            else {
                $perms = [
                    'job_role_id' => $role->id,
                    'srm_view_own_pay' => 1,
                    'srm_view_all_pay' => 0,
                    'srm_manage_pay_config' => 0,
                    'srm_send_invites' => 0,
                    'srm_view_responses' => 0,
                    'srm_manage_status' => 0,
                    'srm_manage_templates' => 0,
                    'srm_view_retention' => 0,
                    'srm_bulk_actions' => 0
                ];
            }
            
            $result = $wpdb->insert($permissions_table, $perms);
            if ($result) {
                $added_count++;
                echo "   - ✓ {$role->name} (Tier {$tier})\n";
            }
        }
        echo "   - ✓ Added permissions for {$added_count} job roles\n";
    }
} else {
    echo "   - ℹ Permissions already exist ({$existing_perms} rows)\n";
}

echo "\n4. Creating default email templates...\n";

$existing_templates = $wpdb->get_var("SELECT COUNT(*) FROM $email_templates_table");

if ($existing_templates == 0) {
    $admin_id = get_current_user_id() ?: 1;
    
    $templates = [
        [
            'name' => 'Initial Invitation',
            'type' => 'initial',
            'subject' => 'Will you be returning for {season_name}?',
            'body' => "Hi {employee_name},\n\nWe're planning for {season_name} and would love to know if you'll be returning!\n\nYour pay rate for next season would be: \${total_pay}/hour\n\nPlease click the link below to let us know:\n{response_link}\n\nThank you!",
            'is_default' => 1,
            'created_by' => $admin_id
        ],
        [
            'name' => 'Follow-up Reminder',
            'type' => 'followup',
            'subject' => 'Reminder: Confirm your return status for {season_name}',
            'body' => "Hi {employee_name},\n\nJust a friendly reminder to confirm whether you'll be returning for {season_name}.\n\nClick here to respond: {response_link}\n\nThank you!",
            'is_default' => 1,
            'created_by' => $admin_id
        ]
    ];
    
    $added_count = 0;
    foreach ($templates as $template) {
        $result = $wpdb->insert($email_templates_table, $template);
        if ($result) {
            $added_count++;
            echo "   - ✓ {$template['name']}\n";
        }
    }
    echo "   - ✓ Created {$added_count} default email templates\n";
} else {
    echo "   - ℹ Email templates already exist ({$existing_templates} templates)\n";
}

echo "\n=== Migration Complete! ===\n";
echo "✓ Created {$tables_created} tables\n";
echo "✓ Module is enabled\n";
echo "✓ WordPress admins automatically have full SRM access\n";
echo "\nYou can now access Seasonal Returns in the app!\n";
