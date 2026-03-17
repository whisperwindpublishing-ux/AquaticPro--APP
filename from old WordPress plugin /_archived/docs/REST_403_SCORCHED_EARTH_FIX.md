# REST 403 "Scorched Earth" Fix - v11.4.12

## Rationale
The persistent 403 `rest_cannot_update` error suggests that the WordPress REST API controller is performing a standard permission check that fails *before* our custom filters can intervene, or that our filters are being overridden by another plugin or core behavior.

To resolve this, v11.4.12 implements a "Scorched Earth" strategy:
1. **Late Registration:** We now register our REST fields at priority 999, ensuring they run after almost everything else.
2. **Explicit Overrides:** We use `register_rest_field` which creates a separate API pipeline for these fields, often bypassing standard `register_post_meta` checks.
3. **Direct Permission Check:** The update callback now DIRECTLY calls `lm_get_user_lesson_permissions` instead of relying on the complex `user_can() -> map_meta_cap -> filter` chain for these specific fields.

## Installation
1. Upload `aquaticpro.zip` via **Plugins > Add New > Upload Plugin**.
2. If prompted, overwrite the existing version.

## Verification Steps
1. **Clear Log:** Delete or clear your `debug.log`.
2. **Reproduce:** Go to the "Manage Swimmers" page and try to edit a swimmer field (e.g. Parent Name).
3. **Check Log:** Open `debug.log` and look for:
   ```
   [LM Cap Filter] VERSION 11.4.12 loaded - REST Overrides Active
   ```
   If you see `11.4.8` or any other version, the new code is NOT active.

## Technical Details (Modified Files)
- `includes/lesson-management/cpt-registration.php`: 
    - Updated `lm_grant_capabilities_from_job_role` logging.
    - Updated `lm_register_rest_overrides` to register `rest_field` callbacks for `lm-swimmer` and `lm-group` fields with explicit logic.

## Expected Outcome
The 403 error should disappear immediately because the REST API will no longer ask "Can this user edit this meta key?" in the generic way, but instead ask our specific closure "Is this user a lesson manager?".
