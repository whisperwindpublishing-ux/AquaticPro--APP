# Multi-Role Permissions Fix

## Problem

Users with multiple job roles were not getting permissions from their second (or subsequent) roles applied correctly. Specifically, users could not edit lesson management content despite having a role assigned that should allow it.

## Root Cause

The issue was **NOT** with how permissions are queried or aggregated. The SQL queries using `MAX()` to aggregate permissions across multiple roles were working correctly:

```sql
SELECT 
    MAX(can_view) as can_view,
    MAX(can_create) as can_create,
    MAX(can_edit) as can_edit,
    MAX(can_delete) as can_delete,
    MAX(can_moderate_all) as can_moderate_all
FROM wp_pg_lesson_management_permissions 
WHERE job_role_id IN (1, 2, 3)
```

The REAL issue was **permission caching**. The system caches user permissions in transients with keys like `mp_user_perms_{user_id}` for 5 minutes to improve performance. However, when:

1. A job role's permissions were updated, OR
2. A user's job role assignment was changed

The cached permissions for affected users were **NOT being cleared**, causing users to see stale/outdated permissions until the cache expired naturally (5 minutes).

## Solution

Added cache invalidation in three critical locations:

### 1. When a Role's Permissions Are Updated

**File:** `includes/api-routes-professional-growth.php`  
**Function:** `mentorship_platform_pg_update_job_role()`  
**Lines:** ~3267-3280

```php
// Invalidate job roles cache since permissions changed
delete_transient('mp_job_roles_with_permissions');
delete_transient('mp_job_roles_with_permissions_v' . str_replace('.', '_', $version));

// CRITICAL FIX: Clear permission cache for all users assigned to this role
$assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
$affected_users = $wpdb->get_col( $wpdb->prepare(
    "SELECT DISTINCT user_id FROM $assignments_table WHERE job_role_id = %d",
    $id
) );

if ( ! empty( $affected_users ) ) {
    foreach ( $affected_users as $user_id ) {
        $cache_key = 'mp_user_perms_' . $user_id;
        delete_transient( $cache_key );
    }
}
```

### 2. When Users Are Bulk-Assigned to a Role

**File:** `includes/api-routes.php`  
**Function:** `mentorship_platform_bulk_assign_job_role()`  
**Lines:** ~3893-3905

```php
// Invalidate user list cache since job roles changed
if ($successful > 0) {
    delete_transient('mp_user_list_cache');
    
    // CRITICAL FIX: Clear permission cache for all affected users
    foreach ($user_ids as $user_id) {
        $user_id = intval($user_id);
        $cache_key = 'mp_user_perms_' . $user_id;
        delete_transient( $cache_key );
    }
}
```

### 3. When an Individual User's Job Role Is Updated

**File:** `includes/api-routes.php`  
**Function:** `mentorship_platform_admin_update_user()`  
**Lines:** ~3382-3415

```php
// Update job role assignment if provided
if ($job_role_id > 0) {
    // ... update logic ...
    
    // CRITICAL FIX: Clear permission cache for this user
    $cache_key = 'mp_user_perms_' . $user_id;
    delete_transient( $cache_key );
}
```

## Enhanced Debugging

Added comprehensive debug logging to track permission queries:

### Lesson Management Permissions (cpt-registration.php)

```php
error_log( "[LM Permissions DEBUG] Query template: " . $debug_query );
error_log( "[LM Permissions DEBUG] Role IDs to bind: " . json_encode( $role_ids ) );
error_log( "[LM Permissions DEBUG] Executed query: " . $wpdb->last_query );
error_log( "[LM Permissions DEBUG] Query result: " . json_encode( $permissions ) );
```

### Professional Growth Permissions (api-routes-professional-growth.php)

```php
error_log( 'PG Permissions DEBUG: Role IDs as JSON: ' . json_encode( $role_ids ) );
error_log( 'PG Permissions DEBUG: Role IDs count: ' . count( $role_ids ) );
error_log( 'PG Permissions DEBUG: Lesson Management Query: ' . $wpdb->last_query );
error_log( 'PG Permissions DEBUG: Lesson Management Raw Result: ' . json_encode( $lesson_mgmt_perms ) );
```

## Testing Instructions

1. **Create Two Roles:**
   - Role A: "Instructor" with `canView` and `canCreate` for Lesson Management
   - Role B: "Lead Instructor" with `canView`, `canCreate`, `canEdit`, `canDelete` for Lesson Management

2. **Create a Test User:**
   - Assign only Role A to the user
   - Login as that user - verify they can only view/create (no edit/delete)

3. **Add Second Role:**
   - In Admin → Users, assign Role B to the same user (so they now have both roles)
   - **Without logging out**, refresh the page
   - Verify they can now edit/delete lesson management content (permissions from Role B are now applied)

4. **Update Role Permissions:**
   - Remove `canEdit` from Role B
   - **Without the user logging out**, have them refresh
   - Verify the edit capability is immediately removed

5. **Check Debug Logs:**
   - Look in WordPress debug.log for entries like:
     ```
     [Role Update] Cleared permission cache for 3 users affected by role 2 update
     [User Update] Cleared permission cache for user 15 (job role changed to 2)
     [Bulk Job Role Assign] Cleared permission cache for 5 users
     ```

## Files Modified

1. `includes/api-routes-professional-growth.php`
   - Enhanced permission cache invalidation in role update function
   - Added debug logging for permission queries

2. `includes/api-routes.php`
   - Added permission cache invalidation for bulk job role assignment
   - Added permission cache invalidation for individual user updates

3. `includes/lesson-management/cpt-registration.php`
   - Added comprehensive debug logging for permission queries

## Related Permissions

This fix applies to ALL module permissions, not just Lesson Management:

- Lesson Management Permissions
- Daily Log Permissions
- Scan Audit Permissions
- Live Drill Permissions
- In-Service Permissions
- TaskDeck Permissions
- Reports Permissions
- Instructor Evaluation Permissions
- Awesome Awards Permissions
- LMS Permissions
- Seasonal Returns Permissions

All of these use the same caching mechanism and benefit from this fix.

## Performance Impact

Minimal. Cache clearing only happens when:
- Role permissions are modified (rare, admin-only operation)
- User role assignments change (occasional, admin-only operation)

The actual permission queries still use caching for normal read operations, maintaining good performance.

---

**Date:** January 28, 2026  
**Version:** Post v11.4.21
