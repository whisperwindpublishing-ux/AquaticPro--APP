# Job Roles `inservice_hours` Field Fix

## Problem
Job roles were not showing saved values and editing them didn't reflect changes. Specifically, the `inservice_hours` field was always showing the default value (4.0) instead of the actual saved value.

## Root Cause
When the `mentorship_platform_pg_get_job_roles()` function was refactored to use a single JOIN query with caching for performance optimization, the `inservice_hours` field was accidentally omitted from the formatted response object.

The SQL query correctly selected `jr.*` (which includes `inservice_hours`), but the array mapping that formats the response for the frontend did not include this field:

```php
// BEFORE (missing inservice_hours)
$formatted = array_map(function($row) {
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'tier' => $row['tier'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        // ... permissions objects
    ];
}, $results);
```

Since `inservice_hours` wasn't in the API response, the frontend's fallback logic kicked in:
```typescript
inservice_hours: role.inservice_hours || 4,  // Always showed 4 since undefined || 4 = 4
```

## Solution (api-routes-professional-growth.php)

Added `inservice_hours` to both the main formatted response and the fallback response:

```php
// AFTER (includes inservice_hours)
$formatted = array_map(function($row) {
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'tier' => $row['tier'],
        'inservice_hours' => isset($row['inservice_hours']) ? floatval($row['inservice_hours']) : 4.0,
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        // ... permissions objects
    ];
}, $results);
```

## Files Modified
- `includes/api-routes-professional-growth.php`:
  - Line ~1790: Added `inservice_hours` to main response formatter
  - Line ~1731: Added `inservice_hours` to fallback response formatter

## Testing
After deploying the fix:
1. Clear the site's transient cache or wait 15 minutes for cache expiry
2. Navigate to Professional Growth > Job Roles
3. Verify that:
   - Job roles display with correct `inservice_hours` values
   - Editing a job role shows the actual saved values (not defaults)
   - Saving changes to `inservice_hours` persists and displays correctly
