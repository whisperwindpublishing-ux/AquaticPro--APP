# Fix for 404 Error on Returning Invite Links

## Problem
Recent returning invite links are showing 404 pages when users click on them in emails. The links look like:
```
https://yoursite.com/return-form/?token=abc123...
```

## Root Cause
The `/return-form/` URL is a custom rewrite rule that was added to the plugin, but WordPress hasn't refreshed its URL routing table (permalinks) yet.

## Solution

### Option 1: Via WordPress Admin (Easiest) ⭐
1. Log into WordPress admin
2. Go to **Settings → Permalinks**
3. **Don't change anything** - just click **Save Changes** at the bottom
4. Test one of the invite links - it should now work!

### Option 2: Via WP-CLI (If you have command-line access)
```bash
cd /var/www/html
wp rewrite flush
```

### Option 3: Run the flush script (Automated)
```bash
cd /home/jeffreynapolski/Apps-Development/mentorship-platform
wp eval-file flush-rewrites.php
```

## Verification
After flushing permalinks, test a return invite link:
1. Go to **Seasonal Returns → Return Invitations**
2. Find an employee who was recently sent an invite
3. Copy their invite link (you can resend to get a fresh one)
4. Paste it in a private/incognito browser window
5. You should see the return intent form instead of a 404 page

## Prevention
This only needs to be done once when the rewrite rule is first added. If you upload a new version of the plugin in the future:
- The plugin's activation hook will automatically flush rewrites
- Or you can manually flush via Settings → Permalinks anytime

## Technical Details
The rewrite rule is registered in `mentorship-platform.php`:
- Line 2866: `mp_add_return_form_rewrite_rule()` defines the rule
- Line 3278: Hooked to `init` action
- Line 2880: `mp_handle_return_form_page()` handles the display

The rule transforms:
```
/return-form/?token=abc123
```
Into:
```
index.php?mp_return_form=1&token=abc123
```

Which is then intercepted by `mp_handle_return_form_page()` to display the React form.

## Alternative: If Flushing Permalinks Doesn't Work

If the above steps don't work, there might be an issue with your WordPress permalink structure:

1. Check your `.htaccess` file (in `/var/www/html/`) - it should contain WordPress rewrite rules
2. Ensure your server has `mod_rewrite` enabled (Apache) or proper rewrites configured (Nginx)
3. Check file permissions on `.htaccess` - WordPress needs to be able to write to it
4. Try switching permalink structure to **Post name** in Settings → Permalinks
