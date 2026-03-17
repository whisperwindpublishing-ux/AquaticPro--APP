<?php
/**
 * Flush WordPress rewrite rules and CPT cache
 * Run this once via: wp eval-file flush-rewrites.php
 */

// Load WordPress
require_once('/var/www/html/wp-load.php');

echo "Flushing WordPress rewrite rules and CPT cache...\n";

// Delete transients
delete_transient('mp_job_roles_with_permissions');
delete_option('_transient_mp_job_roles_with_permissions');

// Flush rewrite rules
flush_rewrite_rules();

// Clear object cache if available
if (function_exists('wp_cache_flush')) {
    wp_cache_flush();
}

echo "✓ Done! The menu should now show 'AquaticPro'\n";
echo "\nPlease refresh your WordPress admin page.\n";
