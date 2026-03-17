### **Product Requirements Document: Professional Growth Module**

**Version:** 1.4
**Date:** November 5, 2025
**Last Updated:** January 26, 2026
**Status:** ⚠️ OUTDATED - Feature complete. See PRD-AQUATICPRO-REBRANDING-AND-UX-OVERHAUL.md (Nov 17, 2025)

---

## 🔐 CRITICAL: Tier 6 = Plugin Admin (Full Access)

**Added:** January 26, 2026

### Tier 6 Plugin Admin Policy

**Tier 6 users have FULL ACCESS to all plugin features**, equivalent to WordPress administrators but without WordPress admin capabilities.

#### What This Means
- Tier 6 users **bypass all job role permission restrictions**
- All module permissions are **automatically enabled** for Tier 6 users
- This applies to **all existing and future modules**
- WordPress admins (`manage_options` capability) also have full access

#### Implementation Guidelines for Future Development

When adding new permission checks or modules:

1. **Always use `mp_is_plugin_admin()` function** to check for full access
2. This function returns `true` for:
   - WordPress administrators
   - Users with any job role at Tier 6 or higher
3. **Example pattern:**
   ```php
   // At the start of any permission check
   if (function_exists('mp_is_plugin_admin') && mp_is_plugin_admin()) {
       return true; // Full access granted
   }
   // Continue with regular permission logic...
   ```

4. **Never create permissions that exclude Tier 6 users** unless explicitly required for a business reason

#### Affected Areas
- Daily Log permissions
- LMS course editing and moderation
- Mileage management
- User data access (PII)
- All module-level permissions
- Settings and configuration pages

---

## 🎯 Critical Business Logic: Job Roles vs Promotion Criteria

**Added:** November 11, 2025

### Fundamental Concepts

#### Job Roles = Current Employment Positions
- **Job roles represent what a user IS currently doing**
- When a user is assigned a job role, they have **already earned** that position
- Job role assignment means the user is **actively performing** the duties of that role
- Example: If John is assigned "Head Guard", he is **currently working as a Head Guard**

#### Promotion Criteria = Prerequisites TO Earn a Role
- **Promotion criteria are requirements to BECOME promoted TO a role**
- Criteria attached to a job role define what must be completed **BEFORE** promotion to that role
- Example: Promotion criteria on "Head Guard" = steps needed to **BECOME** a Head Guard (not requirements while being one)

### Team Progress Page: The Promotion Candidate View

**Purpose:** The Team Progress page is a **supervisor tool to identify promotion candidates**.

#### What It SHOULD Show
When a supervisor clicks a job role filter (e.g., "Head Guard"):
- **Display:** Users who **DO NOT** currently have that job role assigned
- **Purpose:** See who is working toward earning that job role
- **Use Case:** Identify employees ready for promotion
- **Example:** Show Junior Guards who are 90% complete with Head Guard promotion criteria

#### What It SHOULD NOT Show
- ❌ Users who **already hold** the selected job role
- ❌ Current job holders' ongoing performance metrics
- ❌ A roster of people in that position

### Real-World Scenario

**Setup:**
- Job Role: "Head Guard" (Tier 2)
- Promotion Criteria for Head Guard:
  1. Complete 20 hours of in-service training
  2. Pass 3 scan audits
  3. Lead 5 training sessions
  4. Manager approval

**Current Staff Assignments:**
- John J: **Currently assigned "Junior Guard" (Tier 1)**
- Sarah M: **Currently assigned "Junior Guard" (Tier 1)**
- Mike T: **Currently assigned "Head Guard" (Tier 2)** ← Already promoted

**Team Progress Page - When "Head Guard" Button is Clicked:**

✅ **SHOULD Display:**
```
Junior Guards Working Toward Head Guard:

John J (Junior Guard)
├─ Progress: 90% complete
├─ In-service: 18/20 hours ⚠️
├─ Scan audits: 3/3 ✓
├─ Leadership: 5/5 ✓
└─ Manager approval: Pending ⚠️

Sarah M (Junior Guard)
├─ Progress: 45% complete
├─ In-service: 10/20 hours ⚠️
├─ Scan audits: 1/3 ⚠️
├─ Leadership: 2/5 ⚠️
└─ Manager approval: Pending ⚠️
```

❌ **SHOULD NOT Display:**
```
Mike T (Head Guard) ← Already has this role, not relevant
```

**Supervisor Action:**
Seeing John J at 90%, the supervisor can:
1. Help John complete the remaining 2 hours of training
2. Grant manager approval
3. Promote John from Junior Guard → Head Guard
4. John's progress toward Head Guard becomes historical
5. John now appears under "Manager" promotion criteria (Tier 3)

### Data Flow Diagram

```
USER CURRENT STATE:
John J → [Junior Guard] (Tier 1)
              ↓
   (Working toward next tier)
              ↓
TRACKING PROGRESS TOWARD:
         [Head Guard] (Tier 2)
              ↓
PROMOTION CRITERIA CHECKLIST:
├─ In-service: 18/20 hours
├─ Scan audits: 3/3 
├─ Leadership: 5/5
└─ Manager approval: Pending
              ↓
   (Supervisor reviews progress)
              ↓
PROMOTION DECISION:
John J → [Head Guard] (Tier 2) ✓ PROMOTED
              ↓
NEXT TRACKING:
Now tracking progress toward [Manager] (Tier 3)
```

### Implementation Requirements

#### Team Progress Page - Role Filter Logic
```
1. User clicks "Head Guard" role button
2. API filters: Get all users WITHOUT Head Guard assignment
3. For each user:
   - Load Head Guard promotion criteria
   - Calculate user's completion % for those criteria
   - Display: Name, Current Role, Progress %, Detailed breakdown
4. Expanded view: Show criterion-by-criterion progress
```

#### Database Query Pattern
```sql
-- Get promotion candidates (users WITHOUT the selected role)
SELECT u.* FROM wp_users u
LEFT JOIN wp_pg_user_job_assignments uja 
  ON u.ID = uja.user_id 
  AND uja.job_role_id = [Selected Role ID]
WHERE uja.id IS NULL  -- No assignment = candidate

-- Get promotion criteria for selected role
SELECT * FROM wp_pg_promotion_criteria
WHERE job_role_id = [Selected Role ID]

-- Get user's progress toward those criteria
SELECT * FROM wp_pg_user_progress
WHERE user_id = [User ID]
AND criterion_id IN (criteria IDs for selected role)
```

### Key Insight

> **Promotion criteria are a "roadmap TO a role", not "requirements WHILE IN a role".**

Once a user is promoted to a role, those promotion criteria become **historical data**. The system now tracks their progress toward the **NEXT** role's promotion criteria.

### Edge Cases

**What if a user has multiple job role assignments?**
- The Team Progress page should show users who **DO NOT have** the selected role
- If John is both "Junior Guard" and "Cashier", clicking "Head Guard" should still show John (because he doesn't have Head Guard)

**What if a user has no job role assignment?**
- Show all unassigned users in the Team Progress view
- They are candidates for ANY role's promotion

**What if there are no promotion criteria for a role?**
- Display message: "No promotion criteria defined for [Role Name]. Add criteria in Role Management."

---

## Implementation Progress

### ✅ Phase 1: Backend Foundation (COMPLETED)

**Database Schema:**
- Created 7 new database tables in `mentorship-platform.php` activation hook:
  - `wp_pg_job_roles` - Job titles with tier and WordPress role mapping
  - `wp_pg_promotion_criteria` - Prerequisites for each job role
  - `wp_pg_user_progress` - Employee completion tracking
  - `wp_pg_inservice_logs` - Training session records
  - `wp_pg_inservice_attendees` - Training participant tracking
  - `wp_pg_scan_audit_logs` - Scan audit records with detailed criteria
  - `wp_pg_live_recognition_drill_logs` - Live drill records

**Admin Settings:**
- Added module enable/disable toggle in `includes/admin-settings.php`
- Added required monthly in-service hours setting (default: 10 hours)

**REST API:**
- Created comprehensive API in `includes/api-routes-professional-growth.php`
- Implemented all CRUD endpoints for job roles, criteria, progress, training, and audits
- Built tier-based permission system with automatic checks
- Added automatic promotion progress updates when audits/drills are passed
- **NEW**: Added update/delete endpoints for scan audits (PUT/DELETE `/pg/scan-audits/:id`)

### ✅ Phase 2: Frontend Navigation (COMPLETED)

**Career Development Navigation:**
- Created `CareerDevelopment.tsx` component with sidebar navigation
- Added "Career Development" menu item to Header (desktop and mobile)
- Integrated routing in `App.tsx` for the new view
- Built `api-professional-growth.ts` service layer with TypeScript types

**Navigation Structure:**
- My Promotion Progress
- Team Progress (for supervisors)
- In-Service Training
- Scan Audits
- Live Recognition Drills
- Role Management (administrators only)

### ✅ Phase 3: Core UI Components (COMPLETED)

**Job Roles Management UI:**
- Created `RoleManagement.tsx` component for administrators
- Full CRUD interface for job titles with modal dialogs
- Tier selection and WordPress role slug mapping
- Table view with edit/delete actions

**Employee Promotion Dashboard:**
- Created `PromotionProgress.tsx` component
- Job role selector to track progress toward any position
- Visual checklist with completion status
- Counter progress bars for trackable items (e.g., "3 / 10 trainings")
- In-service training summary showing current and previous month hours
- Recent audit/drill notifications with pass/fail status
- Color-coded overall progress indicator

### ✅ Phase 4: In-Service Training (COMPLETED)

**In-Service Training Log:**
- Created `InServiceLog.tsx` component with **inline form** (not modal popup)
- Full CRUD functionality with create/edit/delete/archive/restore
- Multi-user selection for Leaders, Attendees, and No-Shows
- Rich text editor for training details
- Job role assignment to track applicable roles
- Searchable, sortable table with pass/fail indicators
- Monthly hour tracking and compliance reporting
- **UI Pattern**: Form displays inline when creating/editing, returns to table view after save

**Button Layout (Standardized):**
- **Left side**: Archive/Restore + Delete buttons (only shown when editing)
- **Right side**: Cancel + Save/Update buttons

### ✅ Phase 5: Scan Audit Module (COMPLETED - November 7, 2025)

**Database Enhancements:**
- Added 4 new columns to `wp_pg_scan_audit_logs`:
  - `wearing_correct_uniform` (tinyint) - Yes/No radio button
  - `attentive_to_zone` (tinyint) - Yes/No radio button
  - `posture_adjustment_5min` (tinyint) - Yes/No radio button
  - `attachments` (longtext) - JSON array of media files
- Added database migration system with version tracking
- Fixed archived status bug (MySQL tinyint returns as string, needed boolean conversion)

**Scan Audit Form (`ScanAuditForm.tsx`):**
- **Inline form style** (matches In-Service Training pattern)
- Staff member selector with cached user list for performance
- Date and time pickers
- Location text field
- Three yes/no criteria radio buttons:
  - Wearing correct uniform?
  - Attentive to zone?
  - Posture adjustment within 5 minutes?
- Pass/Fail result selector
- Rich text editor for observations/notes
- Media upload (photos/videos) with preview
- Archive/Restore and Delete buttons (left side, editing only)
- Cancel and Save/Update buttons (right side)

**Scan Audits View (`ScanAuditsView.tsx`):**
- **Inline form display** - Opens form inline, not in modal
- Sortable table with columns:
  - Date & Time
  - Staff Member (audited)
  - Auditor
  - Result (Pass/Fail badges with icons)
  - Location
  - Details (truncated notes)
- Search functionality across all fields
- "Show Archived" toggle
- Edit button opens inline form with pre-filled data
- Archive status properly displayed (fixed string-to-boolean conversion)

**API Updates:**
- `createScanAudit()` - Saves all new fields including attachments
- `updateScanAudit()` - Updates existing scan audit records
- `deleteScanAudit()` - Permanently deletes scan audit
- `archiveScanAudit()` / `restoreScanAudit()` - Archive/restore functionality
- Fixed: Explicitly set `archived = 0` in INSERT to prevent database default issues

**Performance Optimizations:**
- Module-level caching for user lists
- Promise deduplication prevents multiple simultaneous API calls
- Instant subsequent form opens (cached data)

**Bug Fixes:**
- Fixed archived status display issue (MySQL returns tinyint as string "0"/"1", needed conversion to boolean)
- Removed unnecessary database safety checks that ran on every page load
- Fixed user loading (switched from WordPress API to `getUsersWithMetadata`)

### 🎨 Phase 6: UI/UX Standardization (COMPLETED - November 7, 2025)

**Consistent Form Patterns:**
All forms (In-Service Training, Scan Audits) now follow the same pattern:
- Inline display (not modal popups)
- Same header structure with title and description
- Consistent button layout and styling
- Smooth transitions between list view and form view

**Standardized Button Layout:**
```
[Archive/Restore] [Delete]           [Cancel] [Save/Update]
     (Left side)                          (Right side)
```
- Archive/Restore/Delete only appear when editing existing records
- Archive shows as yellow button, Restore as green, Delete as red
- Cancel and Save/Update always on the right
- Consistent spacing and styling across all forms

**Form Flow:**
1. User clicks "New [Item]" or "Edit" button
2. Form displays inline, replacing the table view
3. User fills out form or makes changes
4. Click Save/Update - returns to table view with updated data
5. Click Cancel - returns to table view without saving
6. Click Archive/Delete (editing only) - performs action and returns to table

### 🚧 Phase 7: Remaining Work (IN PROGRESS)

**User Management Forms (NEXT):**
- Convert Add User form from modal to inline style
- Convert Edit User form from modal to inline style
- Update button layout to match standardized pattern:
  - Left: Archive/Restore + Delete (editing only)
  - Right: Cancel + Save/Update
- Keep Bulk Import and Bulk Actions as modals (appropriate for their use case)

**Promotion Criteria Management:**
- Build UI for defining prerequisites for each job role
- Support multiple criterion types (checkbox, counter, file upload, notes)
- Link criteria to other modules (mentorship goals, training, audits)

**Manager Team View Dashboard:**
- Sortable table of direct reports
- Progress indicators (fraction and color-coded)
- Filter by role, status, completion percentage
- Quick links to employee promotion progress

**Live Recognition Drill Module:**
- Similar to Scan Audits but for live recognition drills
- Same inline form pattern
- Pass/Fail tracking
- Historical log table

**Additional Features:**
- CSV export for all audit/drill/training logs
- Advanced filtering and date range selection
- Notifications for new audits/drills
- Automatic promotion progress updates from linked modules

---

## Implementation Notes (November 7, 2025)

### Bug Fixes & Technical Lessons

**MySQL tinyint to JavaScript Boolean Conversion:**
- **Issue**: All scan audits and live drills showed as "[ARCHIVED]" regardless of actual status
- **Root Cause**: MySQL tinyint(1) returns as PHP string "0" or "1", which are both truthy in JavaScript
- **Solution**: Applied `Boolean(Number(value))` conversion in `getScanAudits()` and `getLiveDrills()`
- **Pattern**: Use this conversion for all MySQL tinyint fields to ensure proper boolean behavior

**Database Default Values:**
- **Issue**: New records were being created with `archived = 1` instead of `archived = 0`
- **Solution**: Explicitly set `archived => 0` in INSERT statements
- **Lesson**: Always explicitly set default values in INSERT, don't rely on database defaults

**User Loading Performance:**
- **Issue**: Multiple components loading users separately, causing duplicate API calls
- **Solution**: Implemented module-level caching with Promise deduplication
- **Pattern**: Cache API results at module level, return same Promise for simultaneous calls
- **Benefit**: Instant subsequent form opens, reduced server load

**WordPress API Permissions:**
- **Issue**: User list API returned 403 error with `context=edit` parameter
- **Solution**: Used `getUsersWithMetadata()` instead of direct WordPress API call
- **Lesson**: WordPress API context requirements vary by role; use existing working patterns

### Code Quality Improvements

**Modal to Inline Conversion:**
- **Before**: ~300 lines of modal wrapper code in InServiceLog
- **After**: Removed all modal code, inline form with conditional rendering
- **Benefits**: 
  - No z-index issues with dropdowns and overlays
  - Cleaner code structure
  - Faster rendering (no modal animation)
  - Better mobile experience

**Consistent UI Patterns:**
- All forms now share same structure: header, form sections, button layout
- Eliminates user confusion when switching between modules
- Easier maintenance - one pattern to update for changes
- New developers can quickly understand form structure

### Database Versioning

**Migration System:**
- Version 4.0.7: Added 4 columns to `wp_pg_scan_audit_logs`
- Version 4.0.8: Consolidated fixes, removed unnecessary checks
- Pattern: Version number in plugin header, migrations run on activation
- Safe updates: Only runs new migrations, preserves existing data

### Future Considerations

**Deferred Work:**
- UserManagement inline conversion attempted but complex due to multiple modal types
- Needs different approach: separate forms for Add User, Edit User, Bulk Import
- Keep Bulk Import as modal (appropriate for file upload workflows)
- Consider wizard pattern for complex multi-step forms

**Performance Optimizations:**
- Consider lazy loading for form components (code splitting)
- Implement virtual scrolling for large tables (100+ rows)
- Add pagination for historical logs (currently loading all records)

**Accessibility:**
- Add ARIA labels to all form inputs
- Ensure keyboard navigation works for all interactions
- Test with screen readers
- Add focus indicators for button groups

---

#### **1. Overview & Vision**

*   **1.1. Goal:** To enhance the existing Mentorship Platform by integrating a comprehensive professional growth and staff management system. The primary driver is to unify the user experience, replacing clunky WordPress backend functions with a single, streamlined, and aesthetically pleasing interface that matches the current React application.
*   **1.2. Scope:** This project will be developed as a new, optional **"Professional Growth Module"** that can be enabled or disabled on a per-site basis from the plugin's settings page.

#### **2. User Roles & Permissions**

*   **2.1. Role Hierarchy:** A unified job and role hierarchy will be established. Assigning a job in the UI will automatically manage the user's underlying WordPress role. The hierarchy is as follows (from lowest to highest):
    1.  `Lifeguard / Swim Instructor / Cashier`
    2.  `Lesson Coordinator / Concessions Manager / Head Guard`
    3.  `Manager`
    4.  `Aquatic Coordinator`
    5.  `Aquatic Professional`
    6.  `Administrator`
*   **2.2. Permissions Matrix:**

| Action | Employee (Tier 1) | Supervisor (Tier 2+) | Manager (Tier 3+) | Aquatic Coordinator (Tier 4+) | Aquatic Pro / Admin (Tier 5+) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Own Progress** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Subordinates' Progress** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Approve Criteria** | ❌ | ✅ (for Tiers <2) | ✅ (for Tiers <3) | ✅ (for Tiers <4) | ✅ (for all) |
| **Assign Roles/Jobs** | ❌ | ✅ (for Tiers <2) | ✅ (for Tiers <3) | ✅ (for Tiers <4) | ✅ (for all) |
| **Edit Promotion Paths** | ❌ | ❌ | ❌ | ❌ | ✅ |

#### **3. Core Features**

*   **3.1. Promotion Path Management:**
    *   A settings page, accessible only to `Aquatic Professional` and `Administrator` roles, will allow for full CRUD (Create, Read, Update, Delete) management of job titles and their prerequisites.
    *   Prerequisites can be one of several types:
        *   **Simple Checkbox:** For binary completion.
        *   **Notes Field:** To allow supervisors to add comments.
        *   **File Upload:** For attaching evidence like evaluation forms.
        *   **Counter:** For tracking recurring items (e.g., "Attend 10 trainings").
        *   **Linked Module:** Automatically updated by other parts of the system (e.g., Mentorship Goals).
*   **3.2. Employee Promotion Tracking:**
    *   The system will automatically update a user's promotion checklist when a linked Mentorship Goal or Initiative is marked as complete.
    *   When a supervisor approves a prerequisite, the entry will be updated with the completion date, evidence, and the approver's name.
*   **3.3. In-Service Training Log Module:**
    *   A module to log all training sessions in a filterable table with columns for `Date`, `Time`, `Location`, `Leaders`, `Attendees`, `No-shows`, and a rich-text field for `Details/Notes`.
    *   The system will track and display monthly required training hours for each employee.
*   **3.4. Audit & Drill Modules:**
    *   **Scan Audit Log:** A form for supervisors to conduct and log scan audits. Data will feed into a historical log for management and employees, and be exportable to CSV.
    *   **Live Recognition Drill Log:** A separate form and log, functionally identical to the Scan Audit system, for tracking live recognition drills.

#### **4. User Interface & User Experience (UI/UX)**

*   **4.1. Navigation:** A new **"Career Development"** top-level menu will be added. This will lead to a dashboard with a left-side menu for navigating between `Promotion Progress`, `In-Service Log`, `Scan Audits`, etc.
*   **4.2. Employee Dashboard:**
    *   Users can "track" a specific job to feature its promotion checklist on their dashboard.
    *   The dashboard will provide an at-a-glance view of checklist progress (e.g., "3 / 10 Attended"), previous/current month in-service hours, and notifications for new audits.
    *   All checklist items will link to a read-only view of the relevant history (e.g., training log).
*   **4.3. Manager Dashboard ("Team View"):**
    *   A sortable table will list a manager's direct reports.
    *   Progress will be displayed as a fraction ("Manager: 3 of 5") and color-coded for status: Red (<30%), Yellow (31-80%), Orange (81-99%), Green (100%).
    *   Approvals and logging will be done contextually within user profiles or module pages, not a separate "action items" page.

#### **5. Technical Requirements**

*   **5.1. Data Model:** The following new database tables will be created:
    *   `job_roles` (Includes a `wp_role_slug` column to map to WordPress roles)
    *   `promotion_criteria`
    *   `user_progress`
    *   `inservice_logs`
    *   `inservice_attendees`
    *   `scan_audit_logs`
    *   `live_recognition_drill_logs`
*   **5.2. Dependencies:** The project will incorporate standard, well-regarded front-end libraries to handle tables, forms, and notifications to ensure a robust and modern UI.
*   **5.3. Data Migration:** No data migration script will be developed. The system will be configured from a clean slate.
