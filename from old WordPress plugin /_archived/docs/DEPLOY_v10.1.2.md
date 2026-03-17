# AquaticPro v10.1.2 - Deployment Notes

## What's Fixed

### Seasonal Returns Module - 404 Errors RESOLVED

**Problem:**
- SRM API endpoints returning 404 errors
- Frontend crash: "Cannot read properties of undefined (reading 'srm_manage_pay_config')"

**Solution:**
- ✅ Module now **enabled by default** (changed from opt-in to opt-out)
- ✅ Frontend handles missing permissions gracefully
- ✅ Better error messages when module is disabled

## Deployment

1. **Upload the zip file:**
   - WordPress Admin → Plugins → Add New → Upload Plugin
   - Select: `aquaticpro.zip`
   - Click "Install Now"
   - Click "Activate Plugin" (or "Replace current with uploaded")

2. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

3. **Verify:**
   - No more 404 errors in browser console
   - Season Management page loads without errors
   - API endpoints respond:
     - `/wp-json/mentorship-platform/v1/srm/my-permissions`
     - `/wp-json/mentorship-platform/v1/srm/seasons`

## Changes

### Core Files Modified

1. **includes/class-seasonal-returns.php**
   - Changed default from `false` to `true` in `is_enabled()` method

2. **src/components/SeasonManagement.tsx**
   - Added defensive permission checks with `?.` optional chaining
   - Added nullish coalescing `??` for safe defaults
   - Improved error messages

3. **Version bumped to 10.1.2**
   - mentorship-platform.php
   - package.json

## No Database Changes

This is a **code-only update** - no database migrations required. Safe to deploy.

## Rollback (if needed)

If you need to disable the SRM module:

```sql
UPDATE wp_options 
SET option_value = '0' 
WHERE option_name = 'aquaticpro_enable_seasonal_returns';
```

Then visit Settings → Permalinks and click "Save Changes" to flush rewrites.

## Testing Checklist

After deployment:

- [ ] Upload and activate plugin
- [ ] Hard refresh browser
- [ ] Check browser console - no 404 errors
- [ ] Season Management page loads
- [ ] Can view/create seasons (if you have permissions)
- [ ] No JavaScript errors
