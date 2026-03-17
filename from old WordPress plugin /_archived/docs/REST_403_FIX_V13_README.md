# REST 403 "Fix v11.4.13" Strategy

## Diagnosis
The 403 errors persist with this specific signature:
```json
"message": "Sorry, you are not allowed to edit the days custom field.",
"data": { "key": "notes", "status": 403 }
```
This confirms that **WordPress Core's default meta authorization** is blocking the request. The Core check runs on fields registered via `register_post_meta` with `show_in_rest => true`, and it executes the `auth_callback`.

Although we aggressively registered *REST Fields* (v11.4.12), the Core `register_post_meta` handler seems to take precedence or run in parallel because the frontend is likely submitting data in a way that triggers it (e.g. `meta` object).

## The Fix (v11.4.13)
We have relaxed the `auth_callback` in `cpt-registration.php` itself.
Previously, it had strict checks: `post_type` verification (which fails if `$object_id` is 0 or not yet loaded properly).
Now, the check is simply:
1. Is user logged in?
2. Is user Admin OR does `lm_get_user_lesson_permissions` say they can edit?
3. **GRANT ACCESS.**

This bypasses any complexity regarding identifying the post object type during the permission check. If they are a Lesson Manager, they can edit these meta keys.

## Verification
1. Install `aquaticpro.zip`.
2. Check `debug.log`. You should see `[LM Cap Filter] VERSION 11.4.13 loaded`.
3. If an auth failure DOES occur, it will now result in a log entry:
   `[LM Auth Fail] User X failed check for key Y...`
   
This log entry will pinpoint exactly why it's failing if it continues.

## Technical Details
- Modified `includes/lesson-management/cpt-registration.php`:
  - Rewrote `$auth_callback` closure to be extremely permissive for Lesson Managers.
  - Removed dependency on `get_post($object_id)` which can be fragile in REST POST contexts.
