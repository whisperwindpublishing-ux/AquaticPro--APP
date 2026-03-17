# Team Progress Page Fix - November 11, 2025

## Problem Statement

The Team Progress page was showing users who **already hold** a selected job role, rather than showing **promotion candidates** (users working toward that role).

This was a fundamental misunderstanding of the business logic:
- **Promotion criteria** = prerequisites TO EARN a job role (not requirements while in the role)
- **Job role assignment** = current employment position (already earned)

## Business Logic Clarification

### Job Roles
- Job roles represent CURRENT employment positions
- When a user is assigned a job role, they have ALREADY EARNED that position
- Example: If John is assigned "Head Guard", he is currently working as a Head Guard

### Promotion Criteria
- Promotion criteria are PREREQUISITES to earn a job role
- Criteria attached to a role define what must be completed BEFORE promotion TO that role
- Example: Promotion criteria on "Head Guard" = steps to BECOME a Head Guard

### Team Progress Page Purpose
**Purpose:** Supervisor tool to identify promotion candidates

**When clicking a job role (e.g., "Head Guard"):**
- ✅ SHOW: Users who DO NOT have that job role (working toward it)
- ❌ DON'T SHOW: Users who already have that job role

## Changes Made

### 1. Documentation Created
- `BUSINESS_LOGIC_CLARIFICATION.md` - Comprehensive explanation with examples
- Updated `PRD-Professional-Growth-Module.md` - Added business logic section with diagrams
- Version updated to 1.3

### 2. Backend API Fixed (`api-routes-professional-growth.php`)

#### Team Members Endpoint (`/pg/team`)
**Lines 2750-2950:** Completely rewrote query logic

**Old Logic (WRONG):**
```sql
-- When role_id filter applied, showed users WITH that role
INNER JOIN user_job_assignments a ON u.ID = a.user_id
WHERE a.job_role_id = %d
```

**New Logic (CORRECT):**
```sql
-- When role_id filter applied, show users WITHOUT that role (promotion candidates)
LEFT JOIN user_job_assignments a_exclude 
  ON u.ID = a_exclude.user_id 
  AND a_exclude.job_role_id = %d
WHERE a_exclude.id IS NULL  -- No assignment = candidate
```

#### Progress Calculation Logic
**Lines 2920-3050:** Rewrote to calculate progress toward SELECTED role

**Key Changes:**
- When `role_id` parameter is provided:
  - Calculate progress toward THAT specific role (not user's current role)
  - Show user's current role for context (but progress is toward selected role)
  - Add `tracking_role` field to response
- When NO `role_id` parameter:
  - Show users with job assignments
  - Calculate progress toward their current highest role

### 3. Frontend (No Changes Needed!)
The `TeamView.tsx` component already had correct logic:
```tsx
const rolesToShow = selectedRoleId 
  ? allRoles.filter(r => r.job_role_id === selectedRoleId) 
  : allRoles;
```

When a role tab is clicked, it filters expanded rows to show only that role's criteria.

## Expected Behavior After Fix

### Scenario Setup
- Job Role: "Head Guard" (Tier 2)
- Promotion Criteria:
  1. Complete 20 hours in-service
  2. Pass 3 scan audits
  3. Lead 5 trainings

- Current Staff:
  - John J: Junior Guard (Tier 1) - 90% toward Head Guard
  - Sarah M: Junior Guard (Tier 1) - 45% toward Head Guard
  - Mike T: Head Guard (Tier 2) - Already promoted

### When Supervisor Clicks "Head Guard" Tab

**Team Member List Shows:**
```
Junior Guards Working Toward Head Guard:

John J (Current: Junior Guard)
├─ Progress: 90% (18/20 criteria)
└─ [Click to expand and see details]

Sarah M (Current: Junior Guard)
├─ Progress: 45% (9/20 criteria)
└─ [Click to expand and see details]
```

**Does NOT Show:**
```
Mike T (Already Head Guard) ← Not displayed
```

### When Clicking John J Row (Expanded View)

```
Head Guard (Tier 2)
Progress: 18 of 20 completed (90%)

Criteria:
✓ In-service training hours: 18/20 hours
✓ Scan audits passed: 3/3 
✓ Leadership sessions led: 5/5
⚠ Manager approval: Pending
```

## Testing Checklist

### Test Case 1: No Role Filter
- [ ] Page loads with all users who have job assignments
- [ ] Progress shows toward their CURRENT highest role
- [ ] Can see all users' current role assignments

### Test Case 2: Role Filter Applied
- [ ] Click a job role tab (e.g., "Head Guard")
- [ ] Page shows ONLY users who DON'T have that role
- [ ] Progress column shows "Progress to [Role Name]"
- [ ] Users who already have that role do NOT appear

### Test Case 3: Expanded Row
- [ ] Click a user row to expand
- [ ] Expanded section shows ONLY the selected role's criteria
- [ ] Each criterion shows current_value / target_value
- [ ] Completion percentage is correct
- [ ] Can mark criteria as complete (if supervisor)

### Test Case 4: User With No Job Role
- [ ] Users with no job assignments show in unfiltered view
- [ ] When role filter applied, unassigned users appear (candidates for promotion)
- [ ] Their current role shows as "Unassigned"

### Test Case 5: Multiple Role Assignments
- [ ] User with multiple roles (e.g., both "Cashier" and "Head Guard")
- [ ] When "Manager" tab clicked, user appears (doesn't have Manager role)
- [ ] When "Head Guard" tab clicked, user does NOT appear (already has it)

## Database Queries

### Get Promotion Candidates (Users WITHOUT Selected Role)
```sql
SELECT DISTINCT u.ID, u.display_name
FROM wp_users u
LEFT JOIN wp_pg_user_job_assignments a 
  ON u.ID = a.user_id 
  AND a.job_role_id = [SELECTED_ROLE_ID]
WHERE a.id IS NULL  -- No assignment = candidate
```

### Get Progress Toward Specific Role
```sql
SELECT 
  COUNT(*) as completed
FROM wp_pg_user_progress p
INNER JOIN wp_pg_promotion_criteria c ON p.criterion_id = c.id
WHERE p.user_id = [USER_ID]
AND c.job_role_id = [SELECTED_ROLE_ID]
AND p.is_completed = 1
```

## Files Modified

1. `/includes/api-routes-professional-growth.php`
   - Lines 2750-2780: Rewrote count queries for role filtering
   - Lines 2800-2910: Rewrote team members queries to exclude current role holders
   - Lines 2920-3050: Rewrote progress calculation to track toward selected role

2. `PRD-Professional-Growth-Module.md`
   - Added comprehensive business logic section
   - Version bumped to 1.3
   - Added diagrams and use cases

3. `BUSINESS_LOGIC_CLARIFICATION.md` (NEW)
   - Detailed explanation of job roles vs promotion criteria
   - Real-world scenarios
   - Implementation requirements

## Deployment

1. Upload `mentorship-platform.zip` to WordPress plugins
2. Activate/update the plugin
3. Test with actual job roles and users
4. Verify promotion candidates appear correctly when role tabs are clicked

## Performance Impact

✅ **No negative impact** - queries are optimized with:
- LEFT JOIN for exclusion (fast)
- Proper indexing on user_id and job_role_id
- Batch queries for progress calculation
- Same pagination as before

## Known Limitations

1. Users with NO job role assignment show in ALL role filter views (they're candidates for everything)
2. If a role has no promotion criteria defined, shows "No criteria defined" message
3. Progress percentage is 0% for roles with no criteria

## Future Enhancements

1. Add "Next Role Suggestion" feature (automatically suggest next tier up)
2. Bulk promote users who are 100% complete
3. Email notifications when user reaches 90%+ progress
4. Historical promotion tracking (when users were promoted, from what role)
5. Promotion criteria templates for common role progressions
