# Admin → Users List: Master Control Panel

**Updated:** January 5, 2026

## Overview

Admin → Users List is now the **master control panel** for all employee data management. All individual employee data (pay rates, work years, job roles, seasonal eligibility) should be managed from this single interface.

## What's in Admin → Users List

### Employee Data Management
- **Basic Info**: Name, email, phone, employee ID, hire date
- **Work Years**: Add/remove work years (replaces old longevity_years)
- **Job Roles**: Assign/remove job roles with bonuses
- **Pay Breakdown**: Live pay calculation showing base rate, role bonus, longevity bonus, time bonuses, total
- **Seasonal Returns**: `eligible_for_rehire` flag
- **Archiving**: Archive/unarchive users
- **Notes**: Internal notes about employee
- **Date of Birth**: For onboarding/records

### Table Columns
- ✅ **Name** with email and employee ID
- ✅ **Job Role** (supports multiple roles)
- ✅ **Tier** badge
- ✅ **Pay Rate** - live calculation with all bonuses included
- ✅ **Work Years** - count of years in database
- ✅ **Hire Date**
- ✅ **Last Login**

### Features
- ✅ **Auto-refresh pay data** when opening edit modal
- ✅ **Pay recalculation** after adding/removing work years
- ✅ **Search and filter** by name, role, location
- ✅ **Bulk operations** via selection
- ✅ **Export to CSV**
- ✅ **Comprehensive null safety** to prevent crashes

## What Was Removed from Seasonal Returns

The following submenus were **removed** because they duplicated Admin → Users List:

### ❌ Pay Rates (`PayRatesTable.tsx`)
- **Reason**: Just displayed pay data without editing
- **Now**: Pay breakdown is in Users List edit modal with live refresh; pay rate and work years shown in table columns

### ✅ Responses (`ResponseTracker.tsx`) - KEPT
- **Purpose**: Seasonal return workflow management
- **Features**: Track invite status (sent/pending), response status (returning/not_returning/pending), resend invites, monitor completion rates
- **Why Keep**: This manages the invite/response process, not employee data

### ❌ Employees (`EmployeeBulkManager.tsx`)
- **Reason**: Bulk work year and job role operations
- **Now**: Users List has work year editor and job role assignment

### ❌ Longevity Rates (`LongevityManager.tsx`)
- **Reason**: Bonus calculator based on longevity years
- **Now**: Users List shows actual work years; pay calculation auto-includes longevity bonus

## What Remains in Seasonal Returns

These menus provide **unique administrative functionality** not available elsewhere:

### ✅ Dashboard
- **Purpose**: Season creation and management
- **Features**: Create new seasons, set dates, configure season parameters

### ✅ Return Invites
- **Purpose**: Bulk email sending for seasonal returns
- **Features**: Send return invites to eligible employees, track sent status

### ✅ Responses
- **Purpose**: Track and manage the seasonal return workflow
- **Features**: See who was invited, who responded (returning/not returning/pending), resend invites, monitor completion

### ✅ Email Templates
- **Purpose**: Manage email templates for return invites
- **Features**: Edit templates with placeholders like `{{projected_pay_rate}}`, `{{return_form_link}}`

## What Moved to Admin

### ✅ Pay Configuration (moved from Seasonal Returns)
- **Purpose**: Configure pay rate structures
- **Features**: Base rates, pay caps, time-based bonuses, shift differentials
- **Location**: Admin → Pay Configuration

## Data Flow Architecture

```
┌─────────────────────────────────────────┐
│   Admin → Users List                    │
│   (Master Control Panel)                │
│                                         │
│   • Work Years Management               │
│   • Job Role Assignment                 │
│   • Eligible for Rehire Flag            │
│   • Pay Data Display                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Database Tables                       │
│                                         │
│   • srm_employee_work_years             │
│   • pg_user_metadata                    │
│   • pg_job_role_assignments             │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Seasonal_Returns::calculate_pay_rate()│
│   (Centralized Pay Engine)              │
│                                         │
│   • Reads work years from database      │
│   • Calculates longevity bonus          │
│   • Applies role bonuses                │
│   • Returns complete pay breakdown      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   All Employee-Facing Views             │
│                                         │
│   • Email invitations ({{placeholders}})│
│   • Return form pay display             │
│   • API endpoints                       │
│   • Admin pay displays                  │
└─────────────────────────────────────────┘
```

## Centralized Pay Calculation

**All pay displays** (admin, employee-facing, emails) use the same calculation:

```php
Seasonal_Returns::calculate_pay_rate($user_id)
```

This ensures:
- ✅ **No cached pay data** - always fresh from database
- ✅ **Consistent calculations** - same logic everywhere
- ✅ **Automatic updates** - change work years → all displays update
- ✅ **Work years from database** - reads `srm_employee_work_years` table

### What This Means
rate column + breakdown in edit modal) |
| Responses | Seasonal Returns → Responses (kept - manages invite workflow) |
| Employees | Admin → Users List (work years + job roles editor) |
| Longevity Rates | Admin → Users List (work years management) |
| Pay Configuration | Admin → Pay Configuration (moved from Seasonal Returns
3. All other systems automatically see updated data because they query the same tables
4. Next email invite shows updated projected pay
5. Employee return form shows current accurate rates

**No manual sync needed** - the architecture is already centralized.

## Migration Guide

If you were using the old seasonal returns menus:

| Old Menu | New Location |
|----------|--------------|
| Pay Rates | Admin → Users List (pay breakdown in edit modal) |
| Responses | Admin → Users List (eligible_for_rehire + work years) |
| Employees | Admin → Users List (work years + job roles editor) |
| Longevity Rates | Admin → Users List (work years management) |

## Best Practices

1. **Use Admin → Users List** for all individual employee data management
2. **Use Seasonal Returns → Pay Configuration** for system-wide pay settings
3. **Use Seasonal Returns → Return Invites** for bulk email operations
4. **Don't manually calculate longevity** - the system does it automatically from work years
5. **Trust the centralized calculation** - all displays use the same source

## API Endpoints

All endpoints use centralized calculation:

- `GET /employees/{id}/pay` - uses `calculate_pay_rate()`
- `GET /employees/pay` - bulk version, same calculation
- `GET /employees/{id}/projected-pay` - uses `calculate_projected_pay_rate()`

## Database Schema

### Work Years (New System)
```sql
srm_employee_work_years
├── user_id (FK)
├── work_year (calendar year: 2024, 2025, etc.)
├── verified (boolean)
└── notes
```

### Employee Metadata
```sql
pg_user_metadata
├── user_id (FK)
├── phone
├── employee_id
├── hire_date
├── notes
├── eligible_for_rehire (NEW)
└── archived
```

## Notes

- The old `longevity_years` field is **deprecated** - use work years instead
- Pay breakdown automatically refreshes when you add/remove work years
- The `eligible_for_rehire` field controls whether employees can be invited back
- All pay calculations include longevity bonus based on actual work years logged
