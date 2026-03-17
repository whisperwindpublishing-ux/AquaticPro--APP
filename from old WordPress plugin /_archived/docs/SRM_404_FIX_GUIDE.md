# Seasonal Returns Module - 404 Error Fix

## Problem Summary
The Seasonal Returns Management (SRM) feature was showing 404 errors:
- `wp-json/mentorship-platform/v1/srm/seasons` - 404
- `wp-json/mentorship-platform/v1/srm/my-permissions` - 404
- Frontend error: `Cannot read properties of undefined (reading 'srm_manage_pay_config')`

## Root Cause
The SRM module's API routes are conditionally registered only when the module is enabled in WordPress. The module was not enabled by default.

## Solution - FIXED IN v10.1.2

**The module is now enabled by default.** Simply upload the updated plugin zip and the errors will be resolved.

### What Changed

1. **Module enabled by default** - Changed from opt-in to opt-out:
   ```php
   // OLD: return (bool) get_option( 'aquaticpro_enable_seasonal_returns', false );
   // NEW: return (bool) get_option( 'aquaticpro_enable_seasonal_returns', true );
   ```

2. **Frontend error handling** - SeasonManagement.tsx now gracefully handles undefined permissions
3. **Clearer error messages** - Shows helpful message if module is intentionally disabled

### Deployment Steps

1. Upload the updated plugin zip to your WordPress site
2. Clear your browser cache (Ctrl+Shift+R / Cmd+Shift+R)
3. Refresh the page - errors should be gone

### To Manually Disable the Module (Optional)

If you want to disable the SRM module:

**Via phpMyAdmin:**
```sql
UPDATE wp_options 
SET option_value = '0' 
WHERE option_name = 'aquaticpro_enable_seasonal_returns';
```

**Via WordPress admin:**
Add this to Settings if needed (requires custom admin UI)

The following tables should exist in your WordPress database:

- `wp_srm_seasons` - Season definitions
- `wp_srm_pay_config` - Pay rate configurations
- `wp_srm_employee_pay` - Individual employee pay data
- `wp_srm_return_intents` - Employee return intentions
- `wp_srm_email_templates` - Email templates
- `wp_srm_email_log` - Sent email log
- `wp_srm_retention_snapshots` - Historical retention data
- `wp_pg_srm_permissions` - Role-based permissions

If any are missing, the `enable-srm-module.php` script will create them.

### Step 3: Clear Browser Cache

After enabling the module:

1. **Hard refresh** your browser:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. Or clear browser cache completely

3. Check DevTools console - errors should be gone

### Step 4: Test API Endpoints

Visit these URLs to verify they're working (replace with your domain):

1. Permissions endpoint (should return JSON):
   ```
   http://yoursite.com/wp-json/mentorship-platform/v1/srm/my-permissions
   ```

2. Seasons endpoint (should return JSON):
   ```
   http://yoursite.com/wp-json/mentorship-platform/v1/srm/seasons
   ```

Both should return JSON data, not 404.

## What Changed in the Code

### Frontend Improvements (SeasonManagement.tsx)

1. **Better error handling** - Now safely checks if permissions exist before accessing properties:
   ```typescript
   if (!permissions?.srm_manage_pay_config && !loading) {
   ```

2. **Defensive permission loading** - Uses nullish coalescing to ensure all permission keys exist:
   ```typescript
   setPermissions({
       srm_view_own_pay: perms?.srm_view_own_pay ?? false,
       srm_manage_pay_config: perms?.srm_manage_pay_config ?? false,
       // ... etc
   });
   ```

3. **Clearer error messages** - Shows specific message when module is disabled:
   ```
   "Seasonal Returns module is disabled or API endpoints not registered. 
    Please enable the module in WordPress admin."
   ```

### Backend Check

The routes only register when both conditions are true:
```php
if ( ! class_exists( 'Seasonal_Returns' ) || ! Seasonal_Returns::is_enabled() ) {
    return; // Skip route registration
}
```

This is by design for modularity, but requires the option to be set.

## Troubleshooting

### If endpoints still return 404:

1. **Check if class is loaded:**
   ```php
   // Add to WordPress admin or use WP-CLI
   var_dump(class_exists('Seasonal_Returns'));
   ```

2. **Check if module thinks it's enabled:**
   ```php
   var_dump(get_option('aquaticpro_enable_seasonal_returns'));
   var_dump(Seasonal_Returns::is_enabled());
   ```

3. **Check error log** for PHP errors:
   ```bash
   tail -f /var/www/html/wp-content/debug.log
   ```

4. **Flush permalinks again:**
   - Go to Settings → Permalinks
   - Click "Save Changes"

### If permissions object is undefined:

The frontend now handles this gracefully with:
- Default false values for all permissions
- Error message displayed to user
- No crash/blank screen

### If database tables are missing:

Run the enable script or manually trigger:
```php
mp_run_database_migrations();
```

## Testing Checklist

- [ ] Module option enabled: `aquaticpro_enable_seasonal_returns` = true
- [ ] All 8 SRM database tables exist
- [ ] `/srm/my-permissions` endpoint returns 200 OK
- [ ] `/srm/seasons` endpoint returns 200 OK  
- [ ] Browser console shows no 404 errors
- [ ] Browser console shows no TypeError about undefined permissions
- [ ] Season Management page loads without errors
- [ ] Appropriate permission message shown if user lacks access

## Future Prevention

The plugin automatically enables the module for new installations (see `mentorship-platform.php` line 751):

```php
if ( get_option( 'aquaticpro_enable_seasonal_returns' ) === false ) {
    add_option( 'aquaticpro_enable_seasonal_returns', true );
}
```

However, if the database was created before this code was added, or if the option was manually disabled, you'll need to re-enable it using the steps above.

## Support

If you continue experiencing issues:

1. Run the diagnostic script: `enable-srm-module.php`
2. Check the output for which specific step is failing
3. Review the WordPress error log for PHP errors
4. Verify your WordPress user has the necessary permissions (admin or specific SRM permissions)
