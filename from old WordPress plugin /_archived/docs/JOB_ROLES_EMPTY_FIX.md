# Job Roles API Empty Result Fix

## Problem
The `pg/job-roles` endpoint was returning an empty array `Array(0)`, breaking user role checks throughout the app.

## Root Cause Analysis
The job roles endpoint uses a complex multi-table JOIN query across 9 permission tables:
1. `wp_pg_job_roles` (main table)
2. `wp_mp_daily_log_permissions`
3. `wp_pg_scan_audit_permissions`
4. `wp_pg_live_drill_permissions`
5. `wp_pg_inservice_permissions`
6. `wp_pg_cashier_audit_permissions`
7. `wp_pg_taskdeck_permissions`
8. `wp_pg_reports_permissions`
9. `wp_pg_lesson_management_permissions`
10. `wp_awesome_awards_permissions`

**Problem 1: Stale Cache**
The query results were cached for 15 minutes. If the complex JOIN query ever failed (returning empty results), that empty array was cached and served to all subsequent requests.

**Problem 2: Silent Query Failure**
The original code didn't check if `$results` was empty before caching. A database error (like a missing table) would silently return an empty array that got cached.

## Solution Applied

### 1. Cache Validation (api-routes-professional-growth.php)
Added checks to prevent caching and serving empty results:

```php
// Only use cache if it's not empty 
if ($cached !== false && !empty($cached)) {
    return rest_ensure_response($cached);
}

// If cache is empty array, delete it so we re-query
if ($cached !== false && empty($cached)) {
    delete_transient($cache_key);
}
```

### 2. Fallback Query (api-routes-professional-growth.php)
Added a fallback that runs a simple query if the complex JOIN fails:

```php
if (empty($results)) {
    error_log('Job roles JOIN query returned empty. Attempting fallback query.');
    
    $fallback_query = "SELECT * FROM $table_name ORDER BY tier ASC, title ASC";
    $fallback_results = $wpdb->get_results($fallback_query, ARRAY_A);
    
    if (!empty($fallback_results)) {
        // Return job roles with default permissions
        // (code creates default permission objects)
    }
}
```

### 3. Plugin Boot Cache Cleanup (mentorship-platform.php)
Added cleanup on plugin load to clear any stale empty cache:

```php
$job_roles_cache = get_transient('mp_job_roles_with_permissions');
if ($job_roles_cache !== false && empty($job_roles_cache)) {
    delete_transient('mp_job_roles_with_permissions');
    error_log('[AquaticPro] Cleared stale empty job roles cache');
}
```

## Files Modified
1. `includes/api-routes-professional-growth.php` - Added cache validation and fallback query
2. `mentorship-platform.php` - Added cache cleanup on plugin load

## How to Test
1. Upload the updated plugin zip
2. Check browser console - `pg/job-roles` should now return job role data
3. Check `wp-content/debug.log` for any error messages if issues persist

## Debugging
If job roles are still empty after this fix:
1. Check WordPress error log for "Job roles" messages
2. The fallback query should at least return basic job role data
3. If even fallback fails, the main `wp_pg_job_roles` table might not exist

## Immediate Workaround (if needed)
If you need to manually clear the cache before deploying:
```sql
DELETE FROM wp_options WHERE option_name LIKE '%mp_job_roles_with_permissions%';
```

Or via WP-CLI:
```bash
wp transient delete mp_job_roles_with_permissions
```
