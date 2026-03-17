# Safari Data Saving Issues - Diagnostic Guide

## Problem Statement
- Data isn't saving on Safari (Mac) and iPhone Safari
- Lock/conflict warnings display correctly
- Data saves properly on Windows/Brave with cleared cache
- No JavaScript errors visible in browser console

## Recent Changes Made (v3.25.25 -> v3.25.26)
Added comprehensive logging to identify where saves are failing:

### Backend Logging (includes/rest-api.php)
- `[LM Save]` - Group update start, timestamps, user info
- `[LM Save Meta]` - Meta field updates
- `[LM Save Tax]` - Taxonomy updates
- Conflict detection logic improved with better logging

### Frontend Logging (src/api.js & src/components/GroupManager.js)
- `[API] saveGroup/saveSwimmer/saveEvaluation` - Request and response details
- `[GroupManager Save]` - Detailed save attempt with timestamps
- `[GroupManager Save] ERROR Details` - Full error object on failure
- Error details include: errorCode, status, userAgent, timestamp

## Diagnostic Steps

### Step 1: Enable Debug Logging
1. Open WordPress wp-config.php and ensure:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

2. Tail the debug log while testing:
```bash
tail -f /var/www/html/wp-content/debug.log | grep "LM Save"
```

### Step 2: Check Browser Console (Safari DevTools)
1. Enable Safari Develop menu: Safari → Preferences → Advanced → Show Develop menu
2. Develop → Show Web Inspector (or press ⌘⌥I)
3. Go to Console tab
4. Try to save and look for:
   - `[API] saveGroup SUCCESS` - Request completed
   - `[API] saveGroup failed` - Request failed
   - `[GroupManager Save]` - Save attempt details
   - Any JavaScript errors

### Step 3: Check Network Tab
1. Open Web Inspector → Network tab
2. Filter for XHR requests
3. Try to save and look for:
   - Request to `/lm/v1/groups/{id}` (POST)
   - Check Status: Should be 200 (success) or error code
   - Check Response: Should be JSON with updated group data
   - Check Headers: Look for nonce, content-type, authorization

### Step 4: Private Browsing Mode Test
Safari Private Mode can prevent database writes. Test:
1. Disable Private Mode temporarily
2. Try to save
3. Check if data persists

### Step 5: Check WordPress User Permissions
Verify the logged-in user has proper capabilities:
1. In browser console:
```javascript
// Check if user can edit posts
wp.data.select('core').canUser('create', 'posts')
```

2. In WordPress admin:
   - Go to Users
   - Check the user's role (should have edit_posts capability)
   - Verify role is not restricted

## Possible Root Causes

### Scenario 1: POST Request Fails Silently
**Symptoms:** No `[API] saveGroup SUCCESS` in console
**Solutions:**
- Check CORS headers on server
- Check nonce validation (Safari might handle nonces differently)
- Verify network connectivity
- Check for Content-Type header issues

### Scenario 2: POST Succeeds but Backend Update Fails
**Symptoms:** 
- `[API] saveGroup SUCCESS` in console
- `[LM Save]` NOT in debug.log or shows errors
- Data not persisting in database
**Solutions:**
- Check WordPress database permissions
- Check file system permissions on wp-content
- Look for wp_update_post errors in debug.log
- Verify no database connection issues

### Scenario 3: Response Parsing Error
**Symptoms:**
- POST request succeeds (Status 200)
- Response received but JavaScript throws error parsing JSON
**Solutions:**
- Check response Content-Type header is application/json
- Verify response isn't HTML (error page)
- Check for BOM characters in response

### Scenario 4: Browser Cache Issues (Already Tested)
**Symptoms:** Cleared cache but still doesn't work
**This is less likely given cleared cache, but verify:**
- No cache headers preventing updates
- ServiceWorker not caching responses
- No Local Storage preventing fresh fetches

## Required Information for Support

When reporting this issue, please collect:

1. **Browser Console Logs** (copy full output):
   ```javascript
   // In Safari console, after attempting save:
   console.log('User Agent:', navigator.userAgent)
   console.log('Private Mode:', !navigator.onLine === false ? 'unknown' : 'likely off')
   ```

2. **WordPress Debug Log** (tail output during save):
   ```bash
   grep -A5 "\[LM Save\]" /var/www/html/wp-content/debug.log | tail -20
   ```

3. **Network Request Details**:
   - Full request URL
   - Request method (POST)
   - Request body (payload)
   - Response status code
   - Response headers (Content-Type, etc.)
   - Response body (first 500 characters)

4. **System Information**:
   - Safari version
   - macOS version
   - iPhone iOS version (if iPhone Safari)
   - Any WordPress plugins that might affect REST API

## Testing Checklist

- [ ] Cleared Safari cache and cookies
- [ ] Disabled Safari extensions (try in private mode)
- [ ] Verified WordPress user has edit_posts capability
- [ ] Checked WordPress debug.log for errors
- [ ] Confirmed Windows/Brave version works
- [ ] Tested on both Mac Safari and iPhone Safari
- [ ] Checked browser console for JavaScript errors
- [ ] Verified database connection is working
- [ ] Confirmed no database locks or permissions issues

## Temporary Workarounds

If save functionality is completely broken on Safari:

1. **Use a different browser** (Chrome, Firefox)
2. **Disable Private Browsing Mode** in Safari Settings
3. **Clear Safari cache more thoroughly**:
   - Safari → Settings → Privacy → Manage Website Data → Remove All
4. **Disable browser extensions** that might interfere

## Next Steps

1. Follow diagnostic steps above
2. Collect required information
3. Provide full debug log output and console logs
4. Report exact Safari version and macOS version
5. Specify whether issue occurs in both regular and private browsing

Once we have the debug logs, we can identify exactly where the save flow breaks:
- Network layer (request not sent)
- Backend processing (database update fails)
- Response parsing (error handling)
- State update (UI not updating)
