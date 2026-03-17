# Daily Log Permissions - Empty Table Fix

## Problem
The Daily Log Permissions management page shows an empty table with no job roles listed.

## Root Cause
The `wp_mp_daily_log_permissions` table exists but is empty. This can happen if:
1. The plugin was activated before job roles were created
2. The activation hook didn't run properly
3. New job roles were added after plugin activation

## Solution

### Quick Fix (Recommended)
Run the initialization script to populate the permissions table:

```bash
php init-daily-log-permissions.php
```

This script will:
- Check if the table exists
- Find all job roles without permissions
- Add default permissions based on tier:
  - **Tier 5-6**: Full access + moderation rights
  - **Tier 3-4**: Can create/edit/delete own logs
  - **Tier 1-2**: View only

### Alternative Fix
If you have access to WordPress admin:

1. **Deactivate and Reactivate the Plugin**
   - Go to: **Plugins → Installed Plugins**
   - Find "Mentorship Platform"
   - Click "Deactivate"
   - Click "Activate"
   - The activation hook will create default permissions

2. **Manual Database Fix**
   If you prefer SQL, run this query for each job role:

   ```sql
   INSERT INTO wp_mp_daily_log_permissions 
   (job_role_id, can_view, can_create, can_edit, can_delete, can_moderate_all)
   VALUES 
   (1, 1, 0, 0, 0, 0),  -- Tier 1-2: View only
   (2, 1, 1, 1, 1, 0),  -- Tier 3-4: Create/edit own
   (3, 1, 1, 1, 1, 1);  -- Tier 5-6: Full + moderation
   ```

## Verification

After running the fix, check that permissions were created:

```bash
# Run the script again to see current state
php init-daily-log-permissions.php
```

Expected output:
```
✓ All job roles already have permissions configured.

Current permissions:
  Battalion Chief (Tier 6): View=1 Create=1 Edit=1 Delete=1 ModerateAll=1
  Captain (Tier 5): View=1 Create=1 Edit=1 Delete=1 ModerateAll=1
  Firefighter (Tier 1): View=1 Create=0 Edit=0 Delete=0 ModerateAll=0
```

## Testing

1. Navigate to: **User Management → Daily Log Permissions**
2. You should now see a table with all job roles
3. Toggle permissions and click "Save Changes"
4. Refresh the page to verify changes persist

## Prevention

To prevent this issue in future installations:

1. **Always create job roles BEFORE activating the plugin**
2. If adding new roles later, run `init-daily-log-permissions.php`
3. Check the Daily Log Permissions page after adding new roles

## Troubleshooting

### Still Empty After Running Script?

**Check browser console:**
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for error messages when loading the page

**Common issues:**

1. **403 Forbidden**
   - You don't have Tier 5/6 admin access
   - Only admins can view this page

2. **404 Not Found**
   - REST API route not registered
   - Try reactivating the plugin

3. **Database Error**
   - Check WordPress debug.log
   - Verify table exists: `SHOW TABLES LIKE 'wp_mp_daily_log_permissions'`

### Job Roles Not Showing?

Check if the `pg_job_roles` table has data:

```sql
SELECT id, name, tier FROM wp_pg_job_roles;
```

If empty, you need to create job roles first in User Management.

## Technical Details

### Database Schema

```sql
CREATE TABLE wp_mp_daily_log_permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role_id BIGINT UNSIGNED NOT NULL,
    can_view TINYINT(1) NOT NULL DEFAULT 1,
    can_create TINYINT(1) NOT NULL DEFAULT 0,
    can_edit TINYINT(1) NOT NULL DEFAULT 0,
    can_delete TINYINT(1) NOT NULL DEFAULT 0,
    can_moderate_all TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role (job_role_id),
    FOREIGN KEY (job_role_id) REFERENCES wp_pg_job_roles(id) ON DELETE CASCADE
);
```

### API Endpoint

The page calls: `GET /wp-json/mentorship-platform/v1/daily-log-permissions`

This endpoint JOINs the permissions table with job roles:

```php
SELECT 
    p.job_role_id AS jobRoleId,
    r.name AS jobRoleName,
    r.tier AS jobRoleTier,
    p.can_view AS canView,
    p.can_create AS canCreate,
    p.can_edit AS canEdit,
    p.can_delete AS canDelete,
    p.can_moderate_all AS canModerateAll
FROM wp_mp_daily_log_permissions p
JOIN wp_pg_job_roles r ON p.job_role_id = r.id
ORDER BY r.tier DESC, r.name ASC
```

## Files Involved

- `init-daily-log-permissions.php` - Initialization script (NEW)
- `mentorship-platform.php` - Plugin activation hook (creates table)
- `includes/api-callbacks-daily-logs.php` - GET endpoint implementation
- `src/components/DailyLogPermissionsManagement.tsx` - Frontend UI

## Support

If issues persist after trying these solutions:
1. Check the browser console for errors
2. Check WordPress debug.log for PHP errors
3. Verify you have Tier 5/6 admin access
4. Ensure both `wp_mp_daily_log_permissions` and `wp_pg_job_roles` tables exist
