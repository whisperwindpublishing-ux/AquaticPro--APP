# Job Role Permissions Fix for Lesson Management & Daily Logs

## Problem
Users with job roles that have all permissions enabled (Can View, Can Create, Can Edit Own, Can Delete Own) still could not:
- **Lesson Management**: Create or edit groups, swimmers, or evaluations
- **Daily Logs**: Edit their own posts, publish drafts, or delete their own posts/drafts

## Root Cause

### Lesson Management
The module had a `user_has_cap` filter that granted capabilities based on job role permissions, but it was **missing ownership checks** for the `edit_post` and `delete_post` capabilities. This meant users with `can_edit` or `can_delete` permissions couldn't actually edit/delete their own posts.

### Daily Logs
The module had **NO capability filter at all**. It relied solely on WordPress's default role system (`capability_type' => 'post'`), which meant job role permissions were completely ignored.

## Solution Implemented

### 1. Added Daily Logs Capability Filter
Created a complete capability management system for Daily Logs (similar to Lesson Management):

**New Functions:**
- `mp_get_user_daily_log_permissions($user_id)` - Retrieves permissions from the `wp_mp_daily_log_permissions` table
- `mp_is_daily_log_rest_request()` - Detects Daily Log REST API contexts
- `mp_grant_daily_log_capabilities_from_job_role()` - WordPress filter that grants capabilities based on job role permissions

**Location:** `mentorship-platform.php` (added after Daily Log CPT registration)

### 2. Fixed Lesson Management Ownership Checks
Enhanced the existing capability filter to properly check post ownership:

**Changes in `includes/lesson-management/cpt-registration.php`:**
- Added ownership check for `can_edit` permission → grants `edit_post` if user is the author
- Added ownership check for `can_delete` permission → grants `delete_post` if user is the author
- Added explicit `edit_post` and `delete_post` grants for moderators (regardless of ownership)

### 3. Capability Mapping

Both modules now map job role permissions to WordPress capabilities:

| Job Role Permission | WordPress Capabilities Granted |
|---------------------|-------------------------------|
| **Can View** | `read`, `read_private_posts` |
| **Can Create** | `edit_posts`, `publish_posts`, (LM: `assign_terms`) |
| **Can Edit** | `edit_posts`, `edit_published_posts`, `edit_post` (if author), (LM: `assign_terms`) |
| **Can Delete** | `delete_posts`, `delete_published_posts`, `delete_post` (if author) |
| **Can Moderate All** | All edit/delete capabilities including `edit_others_posts`, `delete_others_posts`, `edit_post`, `delete_post` (any post) |

### 4. Context Detection

Both filters use context detection to avoid interfering with other post types:

**Lesson Management:**
- Checks if post is `lm-group`, `lm-swimmer`, `lm-evaluation`, `lm-level`, or `lm-skill`
- Checks if taxonomy is `lm_camp`, `lm_animal`, or `lm_lesson_type`
- Checks if REST request is to a Lesson Management endpoint

**Daily Logs:**
- Checks if post is `mp_daily_log`
- Checks if REST request is to `/wp/v2/mp_daily_logs` or `/mentorship-platform/v1/daily-logs`

## Testing Checklist

### Lesson Management
- [ ] User with "Can View" can view groups/swimmers/evaluations
- [ ] User with "Can Create" can create new groups/swimmers/evaluations
- [ ] User with "Can Edit Own" can edit groups/swimmers/evaluations they created
- [ ] User with "Can Edit Own" CANNOT edit groups/swimmers/evaluations created by others
- [ ] User with "Can Delete Own" can delete groups/swimmers/evaluations they created
- [ ] User with "Can Delete Own" CANNOT delete groups/swimmers/evaluations created by others
- [ ] User with "Can Moderate All" can edit/delete ANY group/swimmer/evaluation

### Daily Logs
- [ ] User with "Can View" can view all daily logs
- [ ] User with "Can Create" can create new daily logs
- [ ] User with "Can Edit Own" can edit daily logs they created
- [ ] User with "Can Edit Own" can publish their own draft daily logs
- [ ] User with "Can Edit Own" CANNOT edit daily logs created by others
- [ ] User with "Can Delete Own" can delete daily logs they created
- [ ] User with "Can Delete Own" can delete their own draft daily logs
- [ ] User with "Can Delete Own" CANNOT delete daily logs created by others
- [ ] User with "Can Moderate All" can edit/delete ANY daily log

## Deployment

1. Upload the new `aquaticpro.zip` to WordPress
2. Test with a user who has a job role with permissions enabled (not a WordPress admin)
3. Verify they can perform the actions allowed by their permissions
4. Check browser console and WordPress debug.log for any errors

## Technical Notes

### Permission Priority
Users can have multiple job roles. The system selects the HIGHEST permission level from all their active roles:
```sql
ORDER BY can_moderate_all DESC, can_delete DESC, can_edit DESC, can_create DESC
LIMIT 1
```

### Caching
Both filters cache permissions per-user during a single request to avoid repeated database queries.

### Fallback Support
Both `mp_get_user_daily_log_permissions()` and `lm_get_user_lesson_permissions()` support both:
- Modern system: `wp_pg_user_job_assignments` table
- Legacy system: `pg_job_roles` user meta

## Files Modified

1. `mentorship-platform.php`
   - Added `mp_get_user_daily_log_permissions()` function
   - Added `mp_is_daily_log_rest_request()` function
   - Added `mp_grant_daily_log_capabilities_from_job_role()` filter

2. `includes/lesson-management/cpt-registration.php`
   - Enhanced `lm_grant_capabilities_from_job_role()` with ownership checks
   - Added `edit_post` and `delete_post` grants for owned posts
   - Added explicit grants for moderators
