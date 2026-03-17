# Scan Audit and Live Drill Permissions Implementation

## Summary
Added comprehensive permission management for scan audits and live drills to the job role system, following the same pattern as daily log permissions. Permissions are now managed centrally through the job role form, and users inherit permissions from all their assigned roles (OR logic).

## Frontend Changes

### 1. TypeScript Interface Updates
**File:** `src/services/api-professional-growth.ts`
- Added `scanAuditPermissions` to `JobRole` interface
- Added `liveDrillPermissions` to `JobRole` interface
- Each permission object includes: `canView`, `canCreate`, `canEdit`, `canDelete`

### 2. RoleManagement Form Updates
**File:** `src/components/RoleManagement.tsx`
- Added scan audit and live drill permissions to form state
- Added permission checkboxes in three sections:
  - Daily Log Permissions (existing)
  - Scan Audit Permissions (new)
  - Live Drill Permissions (new)
- Each section has 4 checkboxes: Can View, Can Create, Can Edit Own, Can Delete Own
- Permissions are saved/loaded automatically with role data

### 3. New Permission Hooks
**Files:** 
- `src/hooks/useScanAuditPermissions.ts`
- `src/hooks/useLiveDrillPermissions.ts`

Both hooks follow the same pattern as `useDailyLogPermissions`:
- Fetch current user's assigned job roles
- Aggregate permissions from all assigned roles using OR logic
- Return effective permissions with loading/error states
- Usage: `const { canView, canCreate, canEdit, canDelete, loading, error } = useScanAuditPermissions(userId)`

## Backend Changes

### 1. Database Tables
**File:** `includes/api-routes-professional-growth.php`

Added two new permission tables:
- `wp_pg_scan_audit_permissions`
- `wp_pg_live_drill_permissions`

Table structure for both:
```sql
CREATE TABLE IF NOT EXISTS wp_pg_[type]_permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_role_id BIGINT UNSIGNED NOT NULL,
    can_view TINYINT(1) DEFAULT 1,
    can_create TINYINT(1) DEFAULT 0,
    can_edit TINYINT(1) DEFAULT 0,
    can_delete TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role (job_role_id),
    KEY idx_job_role (job_role_id)
)
```

Tables are automatically created on WordPress `init` action via `mentorship_platform_pg_ensure_permissions_tables()`.

### 2. API Endpoint Updates

**GET /pg/job-roles**
- Now returns `scanAuditPermissions` and `liveDrillPermissions` for each role
- Fetches from new permission tables
- Defaults: canView=true, all others=false

**POST /pg/job-roles** (Create)
- Accepts `scanAuditPermissions` and `liveDrillPermissions` in request body
- Saves to respective permission tables using `$wpdb->replace()`

**PUT /pg/job-roles/:id** (Update)
- Accepts `scanAuditPermissions` and `liveDrillPermissions` in request body
- Updates respective permission tables using `$wpdb->replace()`

## Architecture

### Permission Inheritance
Users can have multiple job roles assigned. Effective permissions use OR logic:
- If ANY assigned role grants `canView`, user can view
- If ANY assigned role grants `canCreate`, user can create
- And so on for edit and delete

### Default Permissions
- New roles default to: `canView=true`, all others=false
- When editing existing roles, defaults come from tier level (tier 3+ gets full permissions)
- Admins (tier 6+) typically bypass permission checks in backend

### Permission Checking Pattern
Components should:
1. Import the appropriate hook: `useScanAuditPermissions` or `useLiveDrillPermissions`
2. Call hook with current user ID
3. Check `canView`, `canCreate`, `canEdit`, `canDelete` booleans
4. Show/hide UI elements accordingly
5. Backend endpoints should also validate permissions server-side

## Next Steps

### Components to Update
1. **ScanAuditForm** - Use `useScanAuditPermissions` to enable/disable form based on `canCreate` or `canEdit`
2. **ScanAuditsView** - Use `useScanAuditPermissions` to:
   - Show/hide "New Audit" button based on `canCreate`
   - Show/hide edit/delete buttons based on `canEdit`/`canDelete`
   - Filter list based on `canView`

3. **LiveDrillForm** - Use `useLiveDrillPermissions` to enable/disable form based on `canCreate` or `canEdit`
4. **LiveDrillsView** - Use `useLiveDrillPermissions` to:
   - Show/hide "New Drill" button based on `canCreate`
   - Show/hide edit/delete buttons based on `canEdit`/`canDelete`
   - Filter list based on `canView`

### Backend API Updates
Update permission callbacks in `includes/api-routes-professional-growth.php`:
- `mentorship_platform_pg_can_edit_scan_audit()` - Check user's scan audit permissions
- `mentorship_platform_pg_can_edit_live_drill()` - Check user's live drill permissions
- Remove hardcoded tier checks, use role-based permission tables instead

### Example Permission Check (Backend)
```php
function mentorship_platform_pg_can_edit_scan_audit($request) {
    $user_id = get_current_user_id();
    
    // Admin tier 6+ always has access
    if (user_has_tier_level($user_id, 6)) {
        return true;
    }
    
    // Get user's job role assignments
    $assignments = get_user_job_assignments($user_id);
    
    // Check if any assigned role has canEdit permission
    foreach ($assignments as $assignment) {
        $perms = get_scan_audit_permissions($assignment->job_role_id);
        if ($perms && $perms->can_edit) {
            return true;
        }
    }
    
    return false;
}
```

## Testing Checklist

- [ ] Create new job role with scan audit permissions enabled
- [ ] Assign role to a user
- [ ] Verify user can see scan audit form
- [ ] Create new job role with live drill permissions enabled
- [ ] Assign role to a user
- [ ] Verify user can see live drill form
- [ ] Test with user having multiple roles
- [ ] Verify OR logic works (any role granting permission allows action)
- [ ] Test with user having no roles (should have no permissions)
- [ ] Test with tier 6+ admin (should have all permissions regardless)

## Files Modified
1. `src/services/api-professional-growth.ts` - Added interfaces
2. `src/components/RoleManagement.tsx` - Added UI and form handling
3. `src/hooks/useScanAuditPermissions.ts` - Created
4. `src/hooks/useLiveDrillPermissions.ts` - Created
5. `includes/api-routes-professional-growth.php` - Database tables, API endpoints

## Database Migration
No manual migration needed. Tables are created automatically via WordPress `dbDelta()` on plugin load. Existing job roles will have no permission records initially, which defaults to the fallback values (canView=true, others=false).
