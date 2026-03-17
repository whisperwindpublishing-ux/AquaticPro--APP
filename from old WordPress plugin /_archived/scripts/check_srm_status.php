<?php
// Quick script to check SRM module status
require_once(__DIR__ . '/../../../wp-load.php');

echo "=== Seasonal Returns Module Status ===\n";
echo "Module enabled: " . (get_option('aquaticpro_enable_seasonal_returns', true) ? 'YES' : 'NO') . "\n";
echo "Class exists: " . (class_exists('Seasonal_Returns') ? 'YES' : 'NO') . "\n";

if (class_exists('Seasonal_Returns')) {
    echo "is_enabled(): " . (Seasonal_Returns::is_enabled() ? 'YES' : 'NO') . "\n";
    $perms = Seasonal_Returns::get_user_permissions();
    echo "WordPress admin permissions:\n";
    print_r($perms);
}

global $wpdb;
$table = $wpdb->prefix . 'srm_permissions';
$table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table));
echo "\nPermissions table exists: " . ($table_exists ? 'YES' : 'NO') . "\n";
