# PRD: Seasonal Return & Pay Rate Management Module

## Document Status: DRAFT - Ready for Review
**Version:** 1.0  
**Date:** December 22, 2025  
**Author:** GitHub Copilot

---

## 1. Executive Summary

### 1.1 Overview
This module provides a comprehensive system for managing seasonal employee returns, pay rate calculations, and return intent communications. It replaces the existing SharePoint-based tracking with an automated, integrated solution within the AquaticPro platform that handles pay rate calculations (base + job role bonuses + longevity + time-based bonuses), return intent collection via tokenized forms, retention tracking, and batch email communications.

### 1.2 Goals
1. **Centralize** employee pay rate management with multi-factor calculation (base, role bonuses, longevity, seasonal bonuses)
2. **Automate** return intent collection through personalized, tokenized email forms (no login required)
3. **Track** year-over-year retention metrics with clear status visibility
4. **Streamline** batch communications with customizable templates and placeholders
5. **Project** future pay rates for workforce planning and budgeting

### 1.3 Key Requirements
- **Dependency:** Requires Professional Growth (Career Development) module for user/job role management
- **Navigation:** "Seasonal Returns" section in sidebar with sub-items
- **Permissions:** WordPress admin always has access; additional access configurable by job role
- **Public Access:** Return intent forms accessible via secure token (no login required)

### 1.4 Success Criteria
- [ ] Pay rate calculator displays correct rates based on all factors
- [ ] Projected "next year" pay rates calculate correctly
- [ ] Return intent emails can be batch-sent to eligible employees
- [ ] Tokenized forms collect return intent without login
- [ ] Return status tracking shows Returning, Not Returning, Pending
- [ ] Retention percentage tracks year-over-year
- [ ] Follow-up emails send to non-responders
- [ ] New hire flag distinguishes first-season employees
- [ ] All data exports correctly for payroll processing

---

## 2. Technical Analysis

### 2.1 Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AquaticPro Platform                      │
├─────────────────────────────────────────────────────────────┤
│  Seasonal Return & Pay Management Module                    │
│  ├── Pay Rate Configuration                                 │
│  │   ├── Base Rate Settings                                 │
│  │   ├── Job Role Bonus Configuration                       │
│  │   ├── Longevity Bonus Tiers                              │
│  │   └── Time-Based Bonus Rules                             │
│  ├── Employee Pay Dashboard                                 │
│  │   ├── Current Pay Calculator                             │
│  │   ├── Projected Pay Calculator                           │
│  │   └── Pay History View                                   │
│  ├── Return Intent Management                               │
│  │   ├── Email Template Builder                             │
│  │   ├── Batch Email Sender                                 │
│  │   ├── Response Tracking                                  │
│  │   └── Follow-up Automation                               │
│  ├── Employee Status Tracking                               │
│  │   ├── Status Dashboard (Returning/Not/Pending)           │
│  │   ├── Retention Metrics                                  │
│  │   ├── New Hire Flagging                                  │
│  │   └── Archive Management                                 │
│  └── Public Return Intent Form                              │
│       └── Token-Based Access (No Login)                     │
├─────────────────────────────────────────────────────────────┤
│  Dependencies:                                              │
│  ├── Professional Growth Module (User Management)           │
│  ├── Job Roles System                                       │
│  └── Existing User Profiles                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

#### 2.2.1 New Tables

**`{prefix}_srm_pay_config`** - Pay Rate Configuration
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `config_type` | ENUM | 'base_rate', 'role_bonus', 'longevity_tier', 'time_bonus' |
| `name` | VARCHAR(255) | Display name |
| `amount` | DECIMAL(10,2) | Dollar amount |
| `job_role_id` | BIGINT NULL | FK to job_roles (for role bonuses) |
| `longevity_years` | INT NULL | Years required (for longevity tiers) |
| `start_date` | DATE NULL | Start date (for time-based bonuses) |
| `end_date` | DATE NULL | End date (for time-based bonuses) |
| `is_active` | BOOLEAN | Whether currently active |
| `effective_date` | DATE | When this rate takes effect |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

**`{prefix}_srm_employee_seasons`** - Employee Season Tracking
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `user_id` | BIGINT | FK to wp_users |
| `season_id` | BIGINT | FK to srm_seasons |
| `status` | ENUM | 'pending', 'returning', 'not_returning', 'ineligible' |
| `eligible_for_rehire` | BOOLEAN | Can be invited back |
| `is_archived` | BOOLEAN | No longer active |
| `is_new_hire` | BOOLEAN | First season with organization |
| `return_token` | VARCHAR(64) | Unique token for return form |
| `token_expires_at` | DATETIME | Token expiration |
| `response_date` | DATETIME NULL | When they responded |
| `signature_text` | VARCHAR(255) NULL | Digital signature |
| `longevity_years` | INT | Calculated years of service |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

**`{prefix}_srm_seasons`** - Season Definitions
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `name` | VARCHAR(255) | e.g., "Summer 2026" |
| `year` | INT | Calendar year |
| `season_type` | VARCHAR(50) | 'summer', 'winter', 'school_year' |
| `start_date` | DATE | Season start |
| `end_date` | DATE | Season end |
| `is_active` | BOOLEAN | Currently recruiting for this season |
| `is_current` | BOOLEAN | Currently operating season |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

**`{prefix}_srm_email_templates`** - Email Templates
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `name` | VARCHAR(255) | Template name |
| `subject` | VARCHAR(255) | Email subject with placeholders |
| `body_html` | LONGTEXT | HTML body with placeholders |
| `body_json` | LONGTEXT | BlockNote JSON for editing |
| `template_type` | ENUM | 'initial_invite', 'follow_up', 'confirmation', 'custom' |
| `is_default` | BOOLEAN | Default template for type |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

**`{prefix}_srm_email_log`** - Email Send History
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `user_id` | BIGINT | FK to wp_users |
| `season_id` | BIGINT | FK to srm_seasons |
| `template_id` | BIGINT | FK to srm_email_templates |
| `email_type` | ENUM | 'initial', 'follow_up_1', 'follow_up_2', etc. |
| `sent_at` | DATETIME | When sent |
| `opened_at` | DATETIME NULL | When opened (if tracked) |
| `clicked_at` | DATETIME NULL | When link clicked |
| `sent_by` | BIGINT | Admin who sent |

**`{prefix}_srm_retention_stats`** - Year-over-Year Retention
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `season_id` | BIGINT | FK to srm_seasons |
| `total_eligible` | INT | Total eligible employees |
| `total_invited` | INT | Total invites sent |
| `total_returning` | INT | Confirmed returning |
| `total_not_returning` | INT | Confirmed not returning |
| `total_no_response` | INT | No response received |
| `total_new_hires` | INT | New hires for season |
| `retention_rate` | DECIMAL(5,2) | Percentage returning |
| `calculated_at` | DATETIME | When stats calculated |

### 2.3 API Endpoints

#### Pay Rate Configuration
- `GET /wp-json/mentorship-platform/v1/srm/pay-config` - Get all pay configurations
- `POST /wp-json/mentorship-platform/v1/srm/pay-config` - Create pay config
- `PUT /wp-json/mentorship-platform/v1/srm/pay-config/{id}` - Update pay config
- `DELETE /wp-json/mentorship-platform/v1/srm/pay-config/{id}` - Delete pay config

#### Employee Pay Calculations
- `GET /wp-json/mentorship-platform/v1/srm/employees/pay` - Get all employees with pay rates
- `GET /wp-json/mentorship-platform/v1/srm/employees/{id}/pay` - Get single employee pay breakdown
- `GET /wp-json/mentorship-platform/v1/srm/employees/{id}/pay/projected` - Get projected next-year pay

#### Season Management
- `GET /wp-json/mentorship-platform/v1/srm/seasons` - Get all seasons
- `POST /wp-json/mentorship-platform/v1/srm/seasons` - Create season
- `PUT /wp-json/mentorship-platform/v1/srm/seasons/{id}` - Update season
- `GET /wp-json/mentorship-platform/v1/srm/seasons/{id}/stats` - Get retention stats

#### Return Intent
- `POST /wp-json/mentorship-platform/v1/srm/invite/batch` - Send batch invites
- `GET /wp-json/mentorship-platform/v1/srm/return-form/{token}` - Get form data (public)
- `POST /wp-json/mentorship-platform/v1/srm/return-form/{token}` - Submit return intent (public)
- `GET /wp-json/mentorship-platform/v1/srm/responses` - Get all responses
- `POST /wp-json/mentorship-platform/v1/srm/follow-up/batch` - Send follow-up emails

#### Email Templates
- `GET /wp-json/mentorship-platform/v1/srm/templates` - Get all templates
- `POST /wp-json/mentorship-platform/v1/srm/templates` - Create template
- `PUT /wp-json/mentorship-platform/v1/srm/templates/{id}` - Update template
- `POST /wp-json/mentorship-platform/v1/srm/templates/preview` - Preview with placeholders

---

## 3. Feature Requirements

### 3.1 Pay Rate System

#### 3.1.1 Base Rate
- **Single base rate** that applies to all employees
- Configurable effective date for rate changes
- Historical tracking of rate changes
- Display: "Base Rate: $XX.XX/hr"

#### 3.1.2 Job Role Bonuses
- **Non-cumulative** - Only the highest applicable bonus applies
- Each job role can have an associated bonus amount
- Example configuration:
  - Lifeguard: +$0.00 (base only)
  - Swim Instructor: +$2.00
  - Lesson Coordinator: +$3.00
  - Head Guard: +$4.00
  - Manager: +$6.00
- When employee has multiple roles, system automatically uses highest bonus
- Display: "Role Bonus (Manager): +$6.00/hr"

#### 3.1.3 Longevity Bonuses
- **Cumulative annual bonus** based on years of service
- 1st year employees (year 0): No longevity bonus
- Configurable bonus per year tier:
  - Year 1 (returning once): +$0.50
  - Year 2: +$1.00
  - Year 3: +$1.50
  - Year 4+: +$2.00 (cap configurable)
- System calculates "years" based on seasons worked
- Display: "Longevity (3 years): +$1.50/hr"

#### 3.1.4 Time-Based Bonuses
- **Date-range bonuses** that apply during specific periods
- Multiple time bonuses can stack
- Example: "School Year Bonus" - $3.00 between Labor Day and Memorial Day
- Configuration:
  - Name (e.g., "School Year Bonus")
  - Amount (e.g., $3.00)
  - Start Date (e.g., first Tuesday after Labor Day)
  - End Date (e.g., Memorial Day)
  - Recurring annually (checkbox)
- System auto-calculates if current date falls within range
- Display: "School Year Bonus (Active): +$3.00/hr"

#### 3.1.5 Pay Rate Formula Display
```
Total Pay Rate = Base Rate + Job Role Bonus (highest) + Longevity Bonus + Active Time Bonuses

Example:
Base Rate:           $15.00
Role Bonus (HG):     +$4.00  (has LG +$0, INS +$2, HG +$4 → uses highest)
Longevity (Year 3):  +$1.50
School Year Bonus:   +$3.00  (currently active)
─────────────────────────────
TOTAL:               $23.50/hr
```

### 3.2 Projected Pay Rate Calculator

#### 3.2.1 Next-Year Projection
- Shows what employee's rate **will be** for next season
- Accounts for:
  - Any scheduled base rate changes
  - Longevity increment (+1 year if returning)
  - Potential role changes (selectable)
  - Time bonus status for projection date
- Side-by-side comparison: Current vs. Projected

#### 3.2.2 Projection Scenarios
- Admin can select "What if" scenarios:
  - "If promoted to Head Guard"
  - "With summer rates" vs. "With school year rates"
- Useful for discussing career paths with employees

### 3.3 Employee Status Management

#### 3.3.1 Status Flags
| Flag | Description |
|------|-------------|
| `is_archived` | No longer employed (past employee) |
| `eligible_for_rehire` | Can be invited back |
| `is_new_hire` | First season with organization |
| `return_status` | 'pending', 'returning', 'not_returning', 'ineligible' |

#### 3.3.2 Status Combinations & Meanings

| Archived | Eligible | Return Status | Meaning |
|----------|----------|---------------|---------|
| No | - | - | Currently active/working |
| Yes | Yes | Pending | Past employee, invited, awaiting response |
| Yes | Yes | Returning | Confirmed returning for next season |
| Yes | Yes | Not Returning | Declined to return |
| Yes | No | Ineligible | Not invited back (policy/performance) |

#### 3.3.3 New Hire Identification
- Flag set when user has no previous season records
- Useful for:
  - Different onboarding workflows
  - Separate training requirements
  - Filtering in tables

### 3.4 Return Intent Collection

#### 3.4.1 Email Invitation System
- **Batch send capability** - Select multiple employees and send at once
- **Filtering options:**
  - By "Eligible for Rehire" status
  - By job roles
  - By previous season
  - By response status (not yet invited, pending, etc.)
- **Preview before send** with actual recipient data

#### 3.4.2 Email Templates
- **BlockNote rich text editor** for template creation
- **Available placeholders:**
  - `{{first_name}}` - Employee's first name
  - `{{last_name}}` - Employee's last name
  - `{{full_name}}` - Full name
  - `{{job_roles}}` - Comma-separated list of roles
  - `{{highest_role}}` - Their highest-tier role
  - `{{current_pay_rate}}` - Current total hourly rate
  - `{{projected_pay_rate}}` - Next season rate
  - `{{base_rate}}` - Base rate only
  - `{{role_bonus}}` - Role bonus amount
  - `{{longevity_bonus}}` - Longevity amount
  - `{{longevity_years}}` - Years of service
  - `{{season_name}}` - e.g., "Summer 2026"
  - `{{return_form_link}}` - Tokenized form URL
  - `{{response_deadline}}` - Date to respond by

#### 3.4.3 Default Email Template
```
Subject: Are You Returning for {{season_name}}?

Hi {{first_name}},

We hope you're doing well! As we prepare for {{season_name}}, we'd love to know if you're planning to return.

Your Current Information:
- Position(s): {{job_roles}}
- Pay Rate: {{current_pay_rate}}/hr
- Years with Us: {{longevity_years}}

If you return for {{season_name}}, your projected pay rate will be: {{projected_pay_rate}}/hr

Please let us know your intentions by clicking the link below:
{{return_form_link}}

We'd appreciate your response by {{response_deadline}}.

Thank you for being part of our team!
```

#### 3.4.4 Tokenized Return Form (Public - No Login)
- **Accessed via unique token** in URL (like lesson progress reports)
- **Displays:**
  - Employee name
  - Job roles
  - Pay rate breakdown (current)
  - Projected pay rate for next season
  - Optional: Include time-based bonus info (admin checkbox)
- **Form fields:**
  - Return intent: Radio buttons "Yes, I'm returning for {{season_name}}" / "No, I'm not planning to return"
  - Digital signature: Text field "Type your full name to sign"
  - Optional comment/notes field
- **On submission:**
  - Updates employee_seasons record
  - Sends confirmation email
  - Logs response timestamp

#### 3.4.5 Form Customization
- Admin can customize:
  - Header text/branding
  - Welcome message
  - Terms/conditions text
  - What pay information to display
  - Additional custom fields

### 3.5 Follow-Up System

#### 3.5.1 Automated Follow-Ups
- Configure automatic follow-up schedule:
  - Follow-up 1: X days after initial invite
  - Follow-up 2: X days after follow-up 1
  - Maximum follow-ups before manual review
- Different template for each follow-up
- Stops automatically when employee responds

#### 3.5.2 Manual Follow-Up
- Table view of non-responders
- Select individuals for manual follow-up
- Custom message option
- Phone/text reminder tracking (manual log)

### 3.6 Retention Dashboard

#### 3.6.1 Current Season Overview
```
┌─────────────────────────────────────────────────────────────┐
│  Summer 2026 Return Status                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████████████████████░░░░░░░░░░  65% Retention Rate        │
│                                                             │
│  📊 Statistics:                                             │
│  ├── Total Eligible: 120                                    │
│  ├── Invites Sent: 115                                      │
│  ├── ✅ Returning: 75 (65%)                                 │
│  ├── ❌ Not Returning: 25 (22%)                             │
│  ├── ⏳ Pending Response: 15 (13%)                          │
│  └── 🚫 Not Invited: 5                                      │
│                                                             │
│  New Hires Needed: ~45 (to maintain staffing)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.6.2 Year-over-Year Comparison
- Historical retention rates by season
- Trend visualization
- Comparison: "Up 5% from last year"

#### 3.6.3 Quick Actions
- "Send Invites to Remaining Eligible"
- "Send Follow-Up to Pending"
- "Mark All Returning as Active"
- "Export Returning List"

### 3.7 Bulk Actions

#### 3.7.1 Activate Returning Employees
- One-click to:
  - Un-archive all "Returning" employees
  - Set as active for new season
  - Increment longevity years
  - Clear return tokens

#### 3.7.2 Archive Season
- End-of-season archive:
  - Archive all current employees
  - Snapshot retention stats
  - Prepare for next cycle

### 3.8 Permission System

Using existing job role-based permission structure:

| Permission | Description | Default |
|------------|-------------|---------|
| `srm_view_own_pay` | Can view own pay information | All roles (ON) |
| `srm_view_all_pay` | Can view all employees' pay | WP Admin only |
| `srm_manage_pay_config` | Can configure pay rates | WP Admin only |
| `srm_send_invites` | Can send return invite emails | None (OFF) |
| `srm_view_responses` | Can view return responses | None (OFF) |
| `srm_manage_status` | Can update employee statuses | None (OFF) |
| `srm_manage_templates` | Can create/edit email templates | None (OFF) |
| `srm_view_retention` | Can view retention dashboard | None (OFF) |
| `srm_bulk_actions` | Can perform bulk status changes | WP Admin only |

---

## 4. User Interface

### 4.1 Navigation Structure

```
Sidebar Menu:
├── [Existing menus...]
└── 📋 Seasonal Returns
    ├── 📊 Dashboard (retention overview)
    ├── 💰 Pay Rates (employee pay list + projected)
    ├── ⚙️ Pay Configuration (base, bonuses, longevity)
    ├── 📧 Return Invites (send & track)
    ├── 📝 Email Templates
    └── 👥 Employee Status (manage flags)
```

### 4.2 Key Views

#### 4.2.1 Pay Rates Table
| Employee | Job Roles | Base | Role Bonus | Longevity | Time Bonus | Total | Projected |
|----------|-----------|------|------------|-----------|------------|-------|-----------|
| John Doe | HG, INS | $15.00 | +$4.00 (HG) | +$1.50 (Y3) | +$3.00 | $23.50 | $24.00 |
| Jane Smith | LG | $15.00 | +$0.00 | +$0.50 (Y1) | +$3.00 | $18.50 | $19.00 |

- Sortable by any column
- Filterable by role, status, pay range
- Export to CSV/Excel
- Click row for detailed breakdown

#### 4.2.2 Return Invites View
- Filter: Season, Status, Eligible, Job Roles
- Columns: Name, Roles, Email, Status, Last Sent, Response
- Checkboxes for batch selection
- Actions: Send Invite, Send Follow-Up, View Response

#### 4.2.3 Public Return Form
```
┌─────────────────────────────────────────────────────────────┐
│  🏊 AquaticPro - Return Intent Form                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hello, John Doe!                                           │
│                                                             │
│  We'd love to have you back for Summer 2026!                │
│                                                             │
│  Your Information:                                          │
│  ├── Position(s): Head Guard, Swim Instructor               │
│  ├── Years with Us: 3                                       │
│  └── Pay Rate Breakdown:                                    │
│       Base Rate:          $15.00/hr                         │
│       Role Bonus (HG):    +$4.00/hr                         │
│       Longevity (3 yrs):  +$1.50/hr                         │
│       School Year Bonus:  +$3.00/hr (seasonal)              │
│       ─────────────────────────────                         │
│       Total:              $23.50/hr                         │
│                                                             │
│  If you return, your projected rate: $24.00/hr              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Will you be returning for Summer 2026?                     │
│                                                             │
│  ○ Yes, I'm planning to return                              │
│  ○ No, I'm not planning to return                           │
│                                                             │
│  Comments (optional):                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Digital Signature:                                         │
│  Type your full name: [_________________________]           │
│                                                             │
│  [ Submit Response ]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1: Pay Rate Foundation (Week 1-2)
- [ ] Create database tables for pay configuration
- [ ] Build pay configuration management UI
- [ ] Implement base rate, role bonus, longevity tier settings
- [ ] Implement time-based bonus configuration
- [ ] Build pay rate calculation service

### Phase 2: Employee Pay Dashboard (Week 2-3)
- [ ] Create employee pay rates table view
- [ ] Implement pay breakdown detail view
- [ ] Build projected pay calculator
- [ ] Add filtering, sorting, export functionality
- [ ] Implement permission checks

### Phase 3: Season & Status Management (Week 3-4)
- [ ] Create seasons table and management UI
- [ ] Build employee status tracking (archive, eligible, new hire)
- [ ] Implement employee_seasons linking table
- [ ] Create status dashboard view
- [ ] Build retention statistics calculator

### Phase 4: Email Template System (Week 4-5)
- [ ] Create email templates table
- [ ] Build BlockNote-based template editor
- [ ] Implement placeholder system
- [ ] Add template preview functionality
- [ ] Create default templates

### Phase 5: Return Intent Forms (Week 5-6)
- [ ] Implement token generation and validation
- [ ] Create public return form component
- [ ] Build form submission handling
- [ ] Implement confirmation emails
- [ ] Add form customization settings

### Phase 6: Batch Email & Follow-Ups (Week 6-7)
- [ ] Build batch email sender
- [ ] Implement employee selection/filtering UI
- [ ] Create follow-up scheduling system
- [ ] Build email send logging
- [ ] Implement manual follow-up selection

### Phase 7: Retention Dashboard & Bulk Actions (Week 7-8)
- [ ] Create retention dashboard with visualizations
- [ ] Implement year-over-year comparison
- [ ] Build bulk action handlers
- [ ] Add "Activate All Returning" functionality
- [ ] Create end-of-season archive workflow

### Phase 8: Testing & Refinement (Week 8-9)
- [ ] End-to-end testing of full workflow
- [ ] Email deliverability testing
- [ ] Permission testing across roles
- [ ] Performance optimization
- [ ] Documentation and training materials

---

## 6. Implementation Checklist

### 6.1 Backend (PHP/WordPress)

#### Database & Models
- [ ] Create migration for `srm_pay_config` table
- [ ] Create migration for `srm_seasons` table
- [ ] Create migration for `srm_employee_seasons` table
- [ ] Create migration for `srm_email_templates` table
- [ ] Create migration for `srm_email_log` table
- [ ] Create migration for `srm_retention_stats` table
- [ ] Add database activation hook in main plugin file

#### API Routes (includes/api-routes-seasonal-returns.php)
- [ ] `register_rest_routes()` function
- [ ] Pay config CRUD endpoints
- [ ] Employee pay calculation endpoints
- [ ] Season management endpoints
- [ ] Return intent endpoints (including public)
- [ ] Email template endpoints
- [ ] Batch email endpoints
- [ ] Retention stats endpoints

#### Core Classes
- [ ] `class-seasonal-returns.php` - Main module class
- [ ] `class-pay-calculator.php` - Pay rate calculation logic
- [ ] `class-return-token.php` - Token generation/validation
- [ ] `class-srm-email-handler.php` - Email sending logic

#### Permissions
- [ ] Add SRM permissions to job role configuration
- [ ] Implement permission checks in API callbacks
- [ ] Add admin settings for default permissions

### 6.2 Frontend (React/TypeScript)

#### Types (src/types/seasonal-returns.ts)
- [ ] `PayConfig` interface
- [ ] `Season` interface
- [ ] `EmployeeSeason` interface
- [ ] `EmailTemplate` interface
- [ ] `RetentionStats` interface
- [ ] `EmployeePayBreakdown` interface

#### Services (src/services/seasonalReturnsService.ts)
- [ ] `getPayConfig()` / `updatePayConfig()`
- [ ] `getEmployeePay()` / `getEmployeePayProjected()`
- [ ] `getSeasons()` / `createSeason()` / `updateSeason()`
- [ ] `sendBatchInvites()` / `sendFollowUps()`
- [ ] `getTemplates()` / `saveTemplate()`
- [ ] `getRetentionStats()`
- [ ] `getReturnForm()` / `submitReturnForm()` (public)

#### Components
- [ ] `SeasonalReturnsDashboard.tsx` - Main dashboard/overview
- [ ] `PayRatesTable.tsx` - Employee pay list view
- [ ] `PayBreakdownModal.tsx` - Detailed pay view
- [ ] `PayConfigManagement.tsx` - Configure rates/bonuses
- [ ] `SeasonManagement.tsx` - Create/manage seasons
- [ ] `ReturnInviteManager.tsx` - Send invites view
- [ ] `EmailTemplateEditor.tsx` - Template builder
- [ ] `EmployeeStatusManager.tsx` - Manage flags/archive
- [ ] `RetentionDashboard.tsx` - Stats and charts
- [ ] `PublicReturnForm.tsx` - Tokenized public form
- [ ] `SRMPermissionsManagement.tsx` - Permission settings

#### Hooks
- [ ] `usePayConfig()` - Pay configuration state
- [ ] `useEmployeePay()` - Employee pay data
- [ ] `useSeasons()` - Season management
- [ ] `useReturnInvites()` - Invite sending state
- [ ] `useRetentionStats()` - Retention data

### 6.3 Integration

#### Navigation
- [ ] Add "Seasonal Returns" section to Sidebar.tsx
- [ ] Add routes in App.tsx
- [ ] Conditionally show based on permissions

#### Settings
- [ ] Add module toggle in admin settings
- [ ] Add SRM-specific settings section

#### Email Integration
- [ ] Use existing WordPress email functions
- [ ] Implement email queue for large batches
- [ ] Add email tracking (opens, clicks)

### 6.4 Testing

- [ ] Unit tests for pay calculation logic
- [ ] Unit tests for token generation/validation
- [ ] API endpoint tests
- [ ] Permission boundary tests
- [ ] Email template placeholder tests
- [ ] Public form access tests
- [ ] Retention calculation tests
- [ ] Batch operation tests

### 6.5 Documentation

- [ ] Admin user guide
- [ ] Pay configuration guide
- [ ] Email template placeholder reference
- [ ] API documentation
- [ ] Permission matrix documentation

---

## 7. Data Migration

### 7.1 SharePoint Import
Since you're migrating from SharePoint, consider:
- [ ] Create import script for existing employee data
- [ ] Map SharePoint columns to new database fields
- [ ] Import historical season records
- [ ] Calculate longevity years from history
- [ ] Verify data integrity after import

### 7.2 SharePoint Field Mapping
| SharePoint Column | New Field |
|-------------------|-----------|
| Employee Name | user (matched by name/email) |
| RET_Manager | job_roles (Manager) |
| RET_HG | job_roles (Head Guard) |
| RET_LC | job_roles (Lesson Coordinator) |
| RET_LG | job_roles (Lifeguard) |
| RET_INS | job_roles (Swim Instructor) |
| Years/Level | longevity_years |
| Eligible | eligible_for_rehire |
| Returning | return_status |

---

## 8. Future Considerations

### 8.1 Potential Enhancements
- **SMS notifications** for return intent reminders
- **Calendar integration** for response deadlines
- **Automated job role upgrades** based on certifications
- **Budget forecasting** based on projected pay rates
- **Integration with payroll systems** for rate export
- **Mobile app** for employees to check status

### 8.2 Scalability
- Consider caching for pay calculations
- Batch email queue for large organizations
- Archive old seasons to separate table

---

## 9. Appendix

### 9.1 Pay Calculation Pseudocode
```javascript
function calculatePayRate(employee, asOfDate, includeTimeBonuses = true) {
  // Get current base rate
  const baseRate = getActiveBaseRate(asOfDate);
  
  // Get highest role bonus (non-cumulative)
  const roleBonus = Math.max(
    ...employee.jobRoles.map(role => getRoleBonusAmount(role.id))
  );
  
  // Get longevity bonus
  const longevityBonus = getLongevityBonusForYears(employee.longevityYears);
  
  // Get active time-based bonuses
  let timeBonuses = 0;
  if (includeTimeBonuses) {
    timeBonuses = getActiveTimeBonuses(asOfDate)
      .reduce((sum, bonus) => sum + bonus.amount, 0);
  }
  
  return {
    baseRate,
    roleBonus,
    longevityBonus,
    timeBonuses,
    total: baseRate + roleBonus + longevityBonus + timeBonuses
  };
}

function calculateProjectedPayRate(employee, nextSeason) {
  // Project with +1 longevity year if returning
  const projectedLongevity = employee.longevityYears + 1;
  
  // Use next season's start date for time bonus calculation
  return calculatePayRate(
    { ...employee, longevityYears: projectedLongevity },
    nextSeason.startDate,
    true
  );
}
```

### 9.2 Email Placeholder Examples
```
Subject: Your {{season_name}} Invitation - {{current_pay_rate}}/hr

Dear {{first_name}},

As a valued {{highest_role}}, we're excited to invite you back!

Current Rate: {{current_pay_rate}}/hr
- Base: {{base_rate}}
- Role: {{role_bonus}} ({{highest_role}})
- Experience: {{longevity_bonus}} ({{longevity_years}} years)

Next Season Rate: {{projected_pay_rate}}/hr

Click here to respond: {{return_form_link}}

Please respond by {{response_deadline}}.
```

---

**Document Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 22, 2025 | GitHub Copilot | Initial draft |
