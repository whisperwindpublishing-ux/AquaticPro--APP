# v11.4.18: Explicit Custom Auth Restoration

## The Strategy
After analyzing the logs, the "native" WordPress capability check (v11.4.17) was still failing despite our filters granting the correct capabilities. This suggests a deeper conflict in how WordPress maps `edit_post_meta` to `edit_post` for these REST requests.

In **v11.4.18**, we have implemented a **"Source of Truth" Authentication Callback**.

Instead of relying on WordPress to guess if you can edit the field, we have attached a specific function (`lm_meta_auth_callback`) to every Custom Field (`instructor`, `swimmers`, etc.). This function:
1.  **Ignores** standard WordPress metadata capability logic.
2.  **Directly checks** your Custom Job Roles (via `lm_get_user_lesson_permissions`).
3.  **Explicitly returns TRUE** if your job role allows editing.

## Debugging
If this still fails, the logs will now show `[LM Meta Auth v18]`.
- Failure Log: `[LM Meta Auth v18] DENIED: ...` or `[LM Meta Auth v18] FALLBACK: ...`
- Success Log: `[LM Meta Auth v18] GRANTED: can_moderate_all`

## Installation
1.  Download `aquaticpro.zip`.
2.  Install/Replace plugin.
3.  Test the update again.
