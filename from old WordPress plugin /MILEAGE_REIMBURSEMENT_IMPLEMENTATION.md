# Mileage Reimbursement Module Implementation

## Overview
A comprehensive mileage reimbursement tracking system with role-based permissions, preset locations, route tracking, and PDF report generation.

   
### 1. Role-Based Permissions
- **Can Submit**: Users with this permission can log their own mileage trips
- **Can View All**: Users can see all employees' trips and generate reports
- **Can Manage**: Users can edit settings, locations, budget accounts, and permissions
- Tier 6+ users automatically have full management access
- Permission assignment via Settings > Role Permissions

### 2. Preset Locations
- Admin-defined common destinations (e.g., "Main Office", "Training Center")
- Each location stores: Name, Full Address
- Supports GPS coordinates for future distance calculation enhancements
- Locations selectable from dropdown when logging trips

### 3. Multi-Stop Route Tracking
- Log trips with multiple stops (minimum 2)
- Track route order: Point A → B → C → A → D → A
- Each stop can be:
  - A preset location (dropdown)
  - A custom address (text input)
- Distance calculated between consecutive stops

### 4. Distance Calculation
- Uses Haversine formula with 1.3x driving multiplier
- Rounding rule: If decimal ≥ 0.2, round up; otherwise floor
- Example: 14.2 → 15 miles, 14.1 → 14 miles
- Manual override available via odometer readings

### 5. Odometer Tracking
- Optional start and end odometer readings
- Auto-calculates distance when both are provided
- Overrides route-based calculation when used

### 6. Tolls & Parking
- Separate fields for toll and parking expenses
- Included in total reimbursement calculation

### 7. Budget Accounts
- Admin-defined account codes (e.g., "10-5410")
- Associate trips with specific budget accounts
- Appears on PDF reports

### 8. PDF Reports
- Date range selection (custom timeframe)
- Per-user pages in single PDF
- Includes:
  - Employee name
  - All trips with date, purpose, route, miles, tolls, parking
  - Totals summary
  - Payout calculation (toggle on/off)
  - Signature and date lines
- Grand totals summary across all employees

### 9. Configurable Reimbursement Rate
- Admin-settable rate per mile (default: $0.70)
- Payout calculation: miles × rate + tolls + parking
- Can be excluded from reports if needed

## Files Created

### Backend (PHP)
- `/includes/api-routes-mileage.php` - Complete REST API (~900 lines)

### Frontend (React/TypeScript)
- `/src/components/mileage/MileageModule.tsx` - Main container with tabs
- `/src/components/mileage/MileageEntryForm.tsx` - Trip entry form
- `/src/components/mileage/MileageEntryList.tsx` - Trip listing with filters
- `/src/components/mileage/MileageSettings.tsx` - Admin settings management
- `/src/components/mileage/MileageReportGenerator.tsx` - PDF report generation
- `/src/components/mileage/index.ts` - Component exports

### Integration Points
- Added route in `App.tsx` (`case 'mileage'`)
- Added sidebar navigation in `Sidebar.tsx`
- Included API file in `mentorship-platform.php`

## Database Tables

### `wp_mp_mileage_settings`
- `id`, `setting_key`, `setting_value`
- Stores rate_per_mile, use_google_api, google_api_key

### `wp_mp_mileage_locations`
- `id`, `name`, `address`, `lat`, `lng`, `is_active`
- Preset locations for dropdown selection

### `wp_mp_mileage_budget_accounts`
- `id`, `account_code`, `account_name`, `is_active`
- Budget tracking codes

### `wp_mp_mileage_entries`
- `id`, `user_id`, `trip_date`, `business_purpose`
- `odometer_start`, `odometer_end`, `calculated_miles`
- `tolls`, `parking`, `budget_account_id`, `notes`
- `created_at`, `updated_at`

### `wp_mp_mileage_entry_stops`
- `id`, `entry_id`, `stop_order`
- `location_id` (nullable - for preset locations)
- `custom_address` (nullable - for manual entry)
- `distance_to_next`

### `wp_mp_mileage_permissions`
- `id`, `role_id`, `can_submit`, `can_view_all`, `can_manage`

## API Endpoints

### Settings
- `GET /mileage/settings` - Get all settings
- `POST /mileage/settings` - Update settings

### Locations
- `GET /mileage/locations` - List all locations
- `POST /mileage/locations` - Create location
- `PUT /mileage/locations/{id}` - Update location
- `DELETE /mileage/locations/{id}` - Delete location

### Budget Accounts
- `GET /mileage/budget-accounts` - List all accounts
- `POST /mileage/budget-accounts` - Create account
- `PUT /mileage/budget-accounts/{id}` - Update account
- `DELETE /mileage/budget-accounts/{id}` - Delete account

### Entries
- `GET /mileage/entries` - List entries (filtered by date, user)
- `GET /mileage/entries/{id}` - Get single entry with stops
- `POST /mileage/entries` - Create entry
- `PUT /mileage/entries/{id}` - Update entry
- `DELETE /mileage/entries/{id}` - Delete entry

### Utilities
- `GET /mileage/check-access` - Check user's permission level
- `POST /mileage/calculate-distance` - Calculate route distance
- `GET /mileage/report` - Generate report data (grouped by user)
- `GET /mileage/permissions` - List all role permissions
- `POST /mileage/permissions` - Update role permission

## Dependencies Added
- `jspdf` - PDF generation library

## Usage

### For Employees
1. Navigate to "Mileage" in sidebar
2. Click "Log New Trip"
3. Enter trip date, purpose, route stops
4. Calculate distance or enter odometer readings
5. Add tolls/parking if applicable
6. Submit

### For Administrators
1. Navigate to Mileage > Settings
2. Configure:
   - Rate per mile
   - Preset locations
   - Budget accounts
   - Role permissions
3. Generate reports via Reports tab
   - Select date range
   - Choose employees (or all)
   - Toggle payout calculation
   - Download PDF

## Notes
- Form uses whole numbers only for miles
- PDF includes signature lines for employee and supervisor
- Reports show route preview (truncated if long)
- Totals summary shows grand totals across all selected employees
