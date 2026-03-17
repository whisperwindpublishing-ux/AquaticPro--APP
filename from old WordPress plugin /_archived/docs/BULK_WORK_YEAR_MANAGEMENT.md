# Bulk Work Year Management & Archived Filter

## Summary
Updated the Employee Pay Management (Bulk Manager) to support:
1. **Bulk add work years** to selected employees
2. **Bulk remove work years** from selected employees
3. **Archived employee filter** (hide archived by default)

## Changes Made

### Backend (PHP)

#### 1. New API Endpoint - Bulk Remove Work Year
**File:** `includes/api-routes-seasonal-returns.php`

- **Route:** `POST /wp-json/mentorship-platform/v1/srm/longevity/remove-year`
- **Function:** `aquaticpro_srm_remove_work_year_bulk()`
- **Parameters:**
  - `remove_year` (int, required) - The work year to remove
  - `user_ids` (array of int, optional) - Filter to specific employees
- **Response:**
  ```json
  {
    "success": true,
    "removed_count": 5,
    "message": "Removed 2024 work year from 5 employee(s)"
  }
  ```

#### 2. Updated Advance Longevity Endpoint
**File:** `includes/api-routes-seasonal-returns.php`

- **New Parameter:** `user_ids` (array) - Filter add_year to specific employees
- Allows bulk adding a specific year to selected employees only

### Frontend (TypeScript/React)

#### 1. Updated Types
**File:** `src/types.ts`

```typescript
export interface EmployeePayData {
    // ... existing fields
    is_archived?: boolean;  // NEW: Archived status
}
```

#### 2. New Service Functions
**File:** `src/services/seasonalReturnsService.ts`

```typescript
// Updated advanceLongevity to accept userIds
export async function advanceLongevity(options?: { 
    onlyReturning?: boolean; 
    seasonId?: number;
    addYear?: number;
    userIds?: number[];  // NEW: Filter to specific users
}): Promise<{ updated_count: number; skipped_count: number; message: string }>

// NEW: Bulk remove work year
export async function removeWorkYearBulk(
    removeYear: number, 
    userIds?: number[]
): Promise<{ removed_count: number; message: string }>
```

#### 3. Updated EmployeeBulkManager Component
**File:** `src/components/srm/EmployeeBulkManager.tsx`

**New Features:**

1. **Archived Filter**
   - Checkbox: "Show archived"
   - Default: Hidden (unchecked)
   - Filters employees based on `is_archived` field

2. **Bulk Work Year Actions**
   - Replaced "Set Longevity" button with:
     - **"Add Work Year"** - Purple button
     - **"Remove Year"** - Red button
   - Year selector shows 2015-2034 range (current year ± 10)
   - Actions apply to selected employees only

3. **Updated Bulk Action Types**
   ```typescript
   interface BulkAction {
       type: 'add_year' | 'remove_year' | 'job_role' | 'remove_role';
       value: number | number[];
   }
   ```

## User Interface

### Employee Pay Management Page

#### Filters Row
```
[Search box] [Role Filter ▼] [Longevity Filter ▼] [☐ Show archived]
```

#### Bulk Actions (when employees selected)
```
5 selected  [Add Work Year] [Remove Year] [Assign Role] [Clear]
```

#### Add Work Year Modal
```
Add Work Year
Apply to 5 selected employees

Year to Add: [2024 ▼]  (dropdown 2015-2034)
This will add the selected year to each employee's work history

[Cancel] [Add Year]
```

#### Remove Year Modal
```
Remove Work Year
Remove from 5 selected employees

Year to Remove: [2024 ▼]  (dropdown 2015-2034)
This will remove the selected year from each employee's work history

[Cancel] [Remove Year]
```

## How It Works

### Add Work Year Flow
1. User selects employees via checkboxes
2. Clicks "Add Work Year" button
3. Selects year from dropdown (defaults to current year)
4. Clicks "Add Year"
5. Backend:
   - Checks if year already exists for each user
   - Adds year to `srm_employee_work_years` table
   - Sets `verified = 0` and `notes = 'Added via bulk action'`
   - Skips duplicates
6. Shows result: "Added 2024 work year to 5 employee(s)"

### Remove Year Flow
1. User selects employees via checkboxes
2. Clicks "Remove Year" button
3. Selects year from dropdown
4. Clicks "Remove Year"
5. Backend:
   - Deletes matching records from `srm_employee_work_years`
   - WHERE `work_year = X AND user_id IN (selected_ids)`
6. Shows result: "Removed 2024 work year from 5 employee(s)"

### Archived Filter
- Default: `showArchived = false`
- Filters out employees where `is_archived = true`
- Checking box shows all employees including archived

## Use Cases

### Scenario 1: Adding Current Year to All Returning Staff
1. On Employee Pay Management page
2. Click "Select All" checkbox (or manually select returning employees)
3. Click "Add Work Year"
4. Year defaults to 2025 (current year)
5. Click "Add Year"
6. All selected employees now have 2025 in their work history
7. Longevity calculations automatically include 2025

### Scenario 2: Removing Incorrect Year Entry
1. Filter to employees with specific longevity year
2. Select affected employees
3. Click "Remove Year"
4. Select the incorrect year (e.g., 2023)
5. Click "Remove Year"
6. Year is removed from work history, longevity recalculates

### Scenario 3: Managing Only Active Employees
1. By default, archived employees are hidden
2. Select all visible employees (all active)
3. Perform bulk actions (add year, assign role, etc.)
4. Archived employees unaffected

## Database Impact

### Tables Used
- `{prefix}_srm_employee_work_years` - Work year records
  - Bulk insert for add operations
  - Bulk delete for remove operations
- `{prefix}_pg_user_job_assignments` - Gets list of all employees

### Performance
- Add Year: Single INSERT per employee (checks for duplicates first)
- Remove Year: Single DELETE query with WHERE IN clause
- Scales well for 10-100 employees

## Testing Checklist

- [ ] Add work year to single employee
- [ ] Add work year to multiple employees (5-10)
- [ ] Add duplicate year (should skip)
- [ ] Remove work year from single employee
- [ ] Remove work year from multiple employees
- [ ] Remove year that doesn't exist (should handle gracefully)
- [ ] Archived filter hides archived employees
- [ ] Archived filter shows all when checked
- [ ] Verify longevity calculations update after add/remove
- [ ] Projected pay recalculates correctly
- [ ] Success/error messages display correctly

## Future Enhancements

### Possible Additions
1. **Bulk Verify Years** - Mark multiple work years as verified
2. **Import Work History** - CSV upload with user_id, work_year
3. **Export Work History** - Download all work years as CSV
4. **Bulk Notes Update** - Add notes to multiple work year entries
5. **Audit Trail** - Log who added/removed years and when

## Related Files
- `includes/api-routes-seasonal-returns.php` - Backend endpoints
- `includes/class-seasonal-returns.php` - Longevity calculation logic
- `src/components/srm/EmployeeBulkManager.tsx` - UI component
- `src/services/seasonalReturnsService.ts` - API service layer
- `src/types.ts` - TypeScript interfaces

## Version
Added in v11.1.4 (December 2024)
