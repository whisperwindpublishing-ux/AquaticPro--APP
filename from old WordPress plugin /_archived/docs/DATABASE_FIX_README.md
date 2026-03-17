# Database Table Fix Instructions

## Problem
After updating the Mentorship Platform plugin, you may see errors like:
```
Table 'wp_pg_user_job_assignments' doesn't exist
```

This happens because WordPress **does not run activation hooks** when updating plugins, only when first activating them. If you updated from an older version, some new database tables may be missing.

## Solution

We've included two fix scripts in this plugin package that will create any missing tables.

### Option 1: Comprehensive Fix (Recommended)

**Use this to check and create ALL Professional Growth tables at once.**

1. After uploading and activating the plugin, access this URL in your browser:
   ```
   https://your-site.com/wp-content/plugins/mentorship-platform/fix-all-pg-tables.php
   ```

2. The script will:
   - Check all 10 Professional Growth tables
   - Show you which tables exist and which are missing
   - Automatically create any missing tables
   - Display a summary of actions taken

3. **IMPORTANT:** After running the script successfully, **delete it** from your server for security:
   ```
   /wp-content/plugins/mentorship-platform/fix-all-pg-tables.php
   ```

### Option 2: Quick Fix for User Job Assignments Only

**Use this if you specifically see the `wp_pg_user_job_assignments` error.**

1. Access this URL in your browser:
   ```
   https://your-site.com/wp-content/plugins/mentorship-platform/fix-missing-user-job-assignments-table.php
   ```

2. The script will create the `wp_pg_user_job_assignments` table

3. **IMPORTANT:** Delete the script after running it:
   ```
   /wp-content/plugins/mentorship-platform/fix-missing-user-job-assignments-table.php
   ```

## Tables That Will Be Created

The fix scripts will create these tables if they don't exist:

1. `wp_pg_job_roles` - Job titles and hierarchy
2. `wp_pg_promotion_criteria` - Prerequisites for each role
3. `wp_pg_user_progress` - Employee completion tracking
4. `wp_pg_user_job_assignments` - User role assignments ⚠️ **Most common missing table**
5. `wp_pg_user_metadata` - Additional user information
6. `wp_pg_inservice_logs` - Training session logs
7. `wp_pg_inservice_attendees` - Training attendance tracking
8. `wp_pg_inservice_job_roles` - Training applicability
9. `wp_pg_scan_audit_logs` - Performance audit logs
10. `wp_pg_live_recognition_drill_logs` - Recognition drill tracking

## Verification

After running a fix script:

1. Refresh your Admin Panel
2. Navigate to Professional Growth → Team View
3. If you see no errors, the tables were created successfully
4. You can now assign users to job roles using the "Manage Team Members" button

## Troubleshooting

**"You must be an administrator to run this script"**
- Make sure you're logged in to WordPress as an administrator

**"Failed to create table"**
- Check that your MySQL user has CREATE TABLE permissions
- Contact your hosting provider if needed

**Still seeing errors after running the script?**
- Run `fix-all-pg-tables.php` (comprehensive check)
- Contact support with the error message from the script

## Security Note

⚠️ **Always delete these fix scripts after use!** They allow database table creation and should not be left accessible on a live site.
