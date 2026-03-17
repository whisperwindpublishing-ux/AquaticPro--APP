# 🚨 EMERGENCY ADMIN RESTORATION GUIDE 🚨

## What Happened
A bug in the delete assignment function caused your WordPress administrator role to be changed to subscriber. This has been **FIXED** in the new plugin build.

## THREE WAYS TO RESTORE YOUR ADMIN ROLE

---

### METHOD 1: WordPress Database (FASTEST) ⚡

**Via phpMyAdmin:**

1. Log into phpMyAdmin
2. Select your WordPress database
3. Click "SQL" tab
4. Run this query to find your user ID:
   ```sql
   SELECT ID, user_login, user_email FROM wp_users WHERE user_login = 'YOUR_USERNAME';
   ```
   (Replace 'YOUR_USERNAME' with your actual WordPress username)

5. Note your user ID from the results
6. Run this query to restore admin role:
   ```sql
   UPDATE wp_usermeta 
   SET meta_value = 'a:1:{s:13:"administrator";b:1;}' 
   WHERE user_id = YOUR_USER_ID AND meta_key = 'wp_capabilities';
   ```
   (Replace YOUR_USER_ID with the number from step 5)

7. Clear any WordPress caches and log out/in

**IMPORTANT:** Your table prefix might not be 'wp_' - check your wp-config.php file for the actual prefix!

---

### METHOD 2: WordPress CLI (IF YOU HAVE SSH ACCESS) 🖥️

```bash
# Navigate to your WordPress directory
cd /path/to/wordpress

# Find your user ID
wp user list

# Restore administrator role (replace USER_ID with your actual ID)
wp user add-role USER_ID administrator

# Or set role directly (removes other roles)
wp user set-role USER_ID administrator

# Verify
wp user list --field=ID,user_login,roles
```

---

### METHOD 3: FTP + PHP Script (IF YOU CAN UPLOAD FILES) 📁

1. Create a file called `restore-admin.php` with this content:

```php
<?php
// EMERGENCY ADMIN RESTORATION SCRIPT
// Upload to WordPress root, visit once, then DELETE immediately

require_once('wp-load.php');

// CHANGE THESE VALUES:
$user_id_to_restore = 1; // Your user ID (usually 1 for first admin)
$username_to_restore = 'your_username'; // Your WordPress username

// Find user by username
$user = get_user_by('login', $username_to_restore);
if (!$user) {
    die("User '$username_to_restore' not found!");
}

$user_id = $user->ID;

// Check current role
echo "Current roles for user $user_id ($username_to_restore): " . implode(', ', $user->roles) . "<br>";

// Restore administrator role
$user->set_role('administrator');

echo "<strong>✅ Administrator role restored!</strong><br>";
echo "User ID: $user_id<br>";
echo "Username: $username_to_restore<br>";
echo "<br><strong>⚠️ DELETE THIS FILE IMMEDIATELY!</strong>";
?>
```

2. Upload `restore-admin.php` to your WordPress root directory (same folder as wp-config.php)
3. Visit: `https://yoursite.com/restore-admin.php`
4. **IMMEDIATELY DELETE the file after running it** (for security)

---

## AFTER RESTORING ADMIN ACCESS

1. **Update the plugin** to version with the fix (mentorship-platform.zip in your build folder)
2. **Test the fix:**
   - Go to User Management
   - Try adding a job role to your admin account
   - Try removing a job role from your admin account
   - Verify your WordPress role stays as "Administrator"

3. **Check error logs** for messages like:
   - "PROTECTION: Skipping WP role sync for user X - user is Administrator"
   - This confirms the protection is working

---

## WHAT WAS FIXED

### Bug Location
The `mentorship_platform_pg_delete_user_assignment()` and `mentorship_platform_pg_delete_assignment_by_id()` functions were calling `sync_wp_role_to_highest()` without first checking if the user was an administrator.

### The Fix
1. **Added pre-checks in delete functions** (lines ~2150 and ~2248):
   - Now checks `user_can($user_id, 'manage_options')` BEFORE calling sync
   - Administrators are completely skipped from role syncing

2. **Strengthened sync function** (lines ~2174-2200):
   - **Layer 1:** Get user object first (fixes user_can() reliability issue)
   - **Layer 2:** Check `in_array('administrator', $user->roles)` (primary check)
   - **Layer 3:** Check `user_can($user, 'manage_options')` (secondary check)
   - **Layer 4:** Hardcoded protection for user ID 1 (super admin)

3. **Why the original protection failed:**
   - `user_can($user_id, 'manage_options')` with just a user ID can be unreliable
   - The function now gets the full user object FIRST, then checks roles directly
   - This is the most reliable method in WordPress

---

## PREVENTION

The new code has **4 layers of protection**:
1. ✅ Pre-check in add assignment function
2. ✅ Pre-check in both delete functions
3. ✅ Primary check in sync function (role array)
4. ✅ Secondary check in sync function (capability)
5. ✅ Hardcoded protection for user ID 1

**It is now virtually impossible for an administrator account to be demoted.**

---

## NEED MORE HELP?

If none of these methods work:
1. Contact your hosting provider's support
2. Show them this guide
3. Ask them to run the SQL query from Method 1
4. They have direct database access and can fix it in 30 seconds

---

**Questions? I'm here to help!**
