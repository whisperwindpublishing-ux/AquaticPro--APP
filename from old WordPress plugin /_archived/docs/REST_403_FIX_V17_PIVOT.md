# Mentorship Platform (v11.4.17)

## 403 Authorization Fix Pivot

We have pivoted from "Override the Native System" (v15) to "Fix the Native System" (v17).

### The Evidence
- **v15 (Overrides)** failed because the Gutenberg editor submits data nested in a `meta` object, which bypasses `register_rest_field` overrides.
- **v16 (Debug)** showed that `auth_callback` loops were logging "SUCCESS" but WP was returning 403 Forbidden. This indicates a conflict between the callback return value and WP's internal state.
- **User Insight:** "If I assign the wordpress role... the problems go away." This confirms that standard WordPress capability checks (like `current_user_can('edit_post')`) ARE working correctly for users who have the role.

### The Problem
Our plugin manually registers `auth_callback` for every meta field. While this callback mimics the permission check, it seems to be failing silently or being overridden by a deeper WP core check when used in this specific context.

However, we **already have** a robust capability filtering system (`[LM Cap Filter]`) hooked into `user_has_cap`. This system dynamically grants `edit_post`, `edit_others_posts`, etc., based on the custom Job Role.

### The Solution (v11.4.17)
We have **removed** the explicit `auth_callback` from the registered meta fields.

By setting `'auth_callback' => null` (or removing it), we force WordPress to fall back to its standard capability set:
1. WP sees no callback.
2. WP checks `current_user_can( 'edit_post_meta', ... )`.
3. WP maps `edit_post_meta` -> `edit_post`.
4. WP triggers `user_has_cap`.
5. Our **`[LM Cap Filter]`** intercepts this calls and says "YES, this user has `edit_post`!" (because of the job role).
6. WP accepts the access.

This makes the "No Role" user behave exactly like the "Old Role" user, aligning with the user's observation that the standard role works.

### Instructions
1. Install `aquaticpro.zip` (v11.4.17).
2. Attempt to update the Lesson Group again.
3. This is the "Cleanest" fix yet, relying on the core WordPress capability system rather than parallel logic.
