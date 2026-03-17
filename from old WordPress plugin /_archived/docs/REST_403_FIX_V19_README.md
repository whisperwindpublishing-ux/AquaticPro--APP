# REST 403 FIX v11.4.19 - INSTRUCTOR FIELD OVERRIDE

## The Problem
Despite fixing permissions for most meta fields in v11.4.18, the `instructor` field continued to fail with "Sorry, you are not allowed to edit the instructor custom field".
This indicates that:
1. WordPress core or another plugin is overriding the permission check for this specific field.
2. Or the `type => array` + `single => true` registration creates a schema validation edge case that fails before our authentication callback runs.
3. The auth callback was simply not being called for this field.

## The Fix (v11.4.19)
We implemented a **Targeted REST API Override** for the `instructor` field only.
Instead of relying on `register_post_meta`, we explicitly registered `register_rest_field('lm-group', 'instructor', ...)` in the `rest_api_init` hook.

This does three things:
1. **Bypasses register_post_meta logic:** The REST API now uses our custom `update_callback` instead of the standard meta update controller.
2. **Explicit Permission Check:** Inside the update callback, we manually invoke our "Source of Truth" function (`lm_meta_auth_callback`) to verify permissions.
3. **Direct Database Update:** If permissions pass, we call `update_post_meta` directly, ignoring any WordPress meta capability filters that might be blocking the request.

## How to Verify
1. Install v11.4.19.
2. Attempt to assign an instructor.
3. Check `debug.log`. You should see `[LM REST Override] Updating instructor for post ...`.
4. If it works, you will see a green success message (or at least no red toast).
