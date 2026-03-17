# PRD: Lesson Management Module Integration into AquaticPro

**Version:** 1.3  
**Date:** December 12, 2025  
**Status:** In Progress - UI/UX Refinement Phase  
**Author:** Development Team

---

## 1. Executive Summary

### 1.1 Overview
This PRD outlines the integration of the standalone "Lesson Management" WordPress plugin into the AquaticPro platform as an optional, toggle-able module. The integration will unify both plugins under a single codebase while adhering to the AquaticPro visual design system.

### 1.2 Goals
1. **Consolidate** the Lesson Management plugin into AquaticPro as an enableable module
2. **Unify** the visual design to match AquaticPro's theme (colors, typography, components)
3. **Preserve** all existing Lesson Management functionality
4. **Integrate** permissions through the existing User Management / Career Development module
5. **Provide** seamless navigation via sidebar menu items (no shortcodes needed)

### 1.3 Key Requirements
- **Dependency:** Lesson Management module requires Professional Growth (Career Development) module to be enabled
- **Navigation:** "Lessons" menu in sidebar with sub-items (Management, Email Evaluations, Camp Rosters)
- **Public Access:** Camp Rosters page is publicly accessible with password protection (set by admin in wp-admin)
- **Permissions:** Uses existing Professional Growth / User Management permission tiers

### 1.4 Success Criteria
- [x] Lesson Management toggle appears in AquaticPro Settings (wp-admin)
- [x] Toggle is disabled/greyed out when Professional Growth module is off
- [x] When enabled, "Lessons" navigation section appears in AquaticPro sidebar
- [x] Sub-menu items: Management, Email Evaluations, Camp Rosters
- [x] Camp Rosters accessible without login but requires admin-set password
- [ ] All Lesson Management features work identically to standalone plugin
- [x] Visual styling matches AquaticPro theme throughout
- [ ] No performance degradation

---

## 2. Technical Analysis

### 2.1 Current Architecture Comparison

| Aspect | AquaticPro | Lesson Management |
|--------|------------|-------------------|
| **Framework** | React 18 (TypeScript) | React 18 (JavaScript) |
| **Build System** | Vite | ESBuild |
| **CSS Framework** | Tailwind CSS | Tailwind CSS |
| **State Management** | Props/Context | Context API |
| **REST API** | Custom namespace `mentorship-platform/v1` | WordPress CPT REST + custom `lm/v1` |
| **Data Storage** | Custom tables + user meta | Custom Post Types (CPT) |
| **Admin UI** | Shortcode-based SPA | Both admin pages + shortcodes |

### 2.2 Module Dependency Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AquaticPro Platform                      │
├─────────────────────────────────────────────────────────────┤
│  Core Modules (Always Available)                            │
│  ├── Mentor Directory                                       │
│  ├── My Mentorships                                         │
│  └── Daily Logs                                             │
├─────────────────────────────────────────────────────────────┤
│  Professional Growth Module (Toggle)                        │
│  ├── Career Development                                     │
│  ├── In-Service Training                                    │
│  ├── Scan Audits                                            │
│  ├── Live Drills                                            │
│  └── User Management (Permissions/Tiers)  ◄─────────┐       │
├─────────────────────────────────────────────────────────────┤
│  Lesson Management Module (Toggle)                    │       │
│  ├── Management (Groups, Swimmers, Evaluations)       │       │
│  ├── Email Evaluations                                │       │
│  └── Camp Rosters (Public + Password)                 │       │
│       │                                               │       │
│       └───────── REQUIRES ────────────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  TaskDeck Module (Toggle - Independent)                     │
│  └── Kanban Boards                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Lesson Management Components Inventory

**Custom Post Types (CPTs):**
- `lm-swimmer` - Student/swimmer records
- `lm-level` - Swimming proficiency levels
- `lm-skill` - Individual skills to master
- `lm-group` - Lesson groups/classes
- `lm-evaluation` - Student evaluations

**Taxonomies:**
- `lm_camp` - Camp/session taxonomy
- `lm_animal` - Animal group names (mascot system)
- `lm_lesson_type` - Type of lesson

**React Components to Convert:**
- `GroupManager.js` - Manage lesson groups
- `SwimmerManager.js` - Manage swimmers/students
- `EvaluationManager.js` - Handle evaluations
- `CampOrganizer.js` - Organize camp schedules (part of Management)
- `LevelManager.js` - Configure proficiency levels
- `SkillManager.js` - Define skills
- `CampManager.js` - Manage camps
- `AnimalManager.js` - Manage group mascots
- `LessonTypeManager.js` - Configure lesson types
- Supporting: `Modal.js`, `ErrorBoundary.js`, `SwimmerForm.js`, `EvaluationForm.js`, `MultiSelectSearch.js`, `ShareLinkModal.js`, `LockConfirmModal.js`

### 2.4 Navigation Structure

**Sidebar Menu when Lesson Management is enabled:**
```
📊 Dashboard
👥 Mentor Directory
🤝 My Mentorships
📝 Daily Logs
   └── [sub-items]
🎓 Career Development
   └── [sub-items]
📚 Lessons                    ← NEW TOP-LEVEL MENU
   ├── 📋 Management          ← Groups, Swimmers, Evaluations, Settings tabs
   ├── ✉️ Email Evaluations   ← Bulk email unsent evaluations
   └── 🏕️ Camp Rosters        ← Public view (password protected)
⚙️ Admin Panel
```

### 2.5 Permission Model

**Tier-Based Access (via User Management):**

| Feature | Required Tier | Notes |
|---------|---------------|-------|
| View Lessons menu | Tier 3+ | Same as Career Development access |
| Management (full CRUD) | Tier 4+ | Create/Edit/Delete swimmers, groups |
| Email Evaluations | Tier 5+ | Bulk email functionality |
| Lesson Settings | Tier 6 (Admin) | Configure levels, skills, camps |
| Camp Rosters (Public) | None | Password-protected public page |

**New WordPress Options:**
```php
'aquaticpro_enable_lesson_management' => bool    // Module toggle
'aquaticpro_camp_roster_password' => string      // Admin-set password for public access
```

---

## 3. Implementation Phases

### Phase 1: Backend Integration (PHP)
**Estimated Time: 4-6 hours**

#### 1.1 Add Module Setting with Dependency
- [ ] Add `aquaticpro_enable_lesson_management` option to admin-settings.php
- [ ] Add checkbox toggle in Settings page UI
- [ ] **Disable checkbox when `aquaticpro_enable_professional_growth` is false**
- [ ] Show helper text: "Requires Professional Growth Module to be enabled"
- [ ] Add `aquaticpro_camp_roster_password` setting for public roster access

#### 1.2 Settings UI Addition
```php
// In admin-settings.php render function
<h2><?php _e( 'Lesson Management Module', 'aquaticpro' ); ?></h2>
<table class="form-table" role="presentation">
    <tr>
        <th scope="row">
            <label for="aquaticpro_enable_lesson_management">
                <?php _e( 'Enable Lesson Management', 'aquaticpro' ); ?>
            </label>
        </th>
        <td>
            <fieldset>
                <label>
                    <input 
                        type="checkbox" 
                        id="aquaticpro_enable_lesson_management"
                        name="aquaticpro_enable_lesson_management" 
                        value="1"
                        <?php checked( $enable_lesson_management, true ); ?>
                        <?php disabled( !$enable_professional_growth, true ); ?>
                    />
                    <?php _e( 'Enable swimming lesson management, evaluations, and camp rosters', 'aquaticpro' ); ?>
                </label>
                <?php if ( !$enable_professional_growth ) : ?>
                    <p class="description" style="color: #d63638;">
                        <?php _e( '⚠️ Requires Professional Growth Module to be enabled first.', 'aquaticpro' ); ?>
                    </p>
                <?php else : ?>
                    <p class="description">
                        <?php _e( 'When enabled, users will see a "Lessons" menu with swimmer management, evaluations, and camp roster features.', 'aquaticpro' ); ?>
                    </p>
                <?php endif; ?>
            </fieldset>
        </td>
    </tr>
</table>

<!-- Camp Roster Password (shown when LM is enabled) -->
<table class="form-table lm-settings" style="<?php echo $enable_lesson_management ? '' : 'display:none;'; ?>">
    <tr>
        <th scope="row">
            <label for="aquaticpro_camp_roster_password">
                <?php _e( 'Camp Roster Password', 'aquaticpro' ); ?>
            </label>
        </th>
        <td>
            <input 
                type="text" 
                id="aquaticpro_camp_roster_password"
                name="aquaticpro_camp_roster_password" 
                value="<?php echo esc_attr( $camp_roster_password ); ?>"
                class="regular-text"
            />
            <p class="description">
                <?php _e( 'Password required for public (non-logged-in) access to Camp Rosters page. Leave blank to disable public access entirely.', 'aquaticpro' ); ?>
            </p>
        </td>
    </tr>
</table>
```

#### 1.3 Move PHP Files
- [ ] Create `includes/lesson-management/` directory
- [ ] Move and refactor these files:
  - `cpt-registration.php` → `includes/lesson-management/cpt-registration.php`
  - `rest-api.php` → `includes/lesson-management/rest-api.php`
  - `email-handler.php` → `includes/lesson-management/email-handler.php`
- [ ] **Do NOT move shortcodes.php** - not needed (using React views instead)
- [ ] Update function prefixes: `lm_` → `aquaticpro_lm_` (avoid conflicts)
- [ ] Wrap all LM code in module-enabled checks

#### 1.4 Conditional Loading
```php
// In mentorship-platform.php
$enable_professional_growth = get_option('aquaticpro_enable_professional_growth', false);
$enable_lesson_management = get_option('aquaticpro_enable_lesson_management', false);

// Only load LM if BOTH professional growth AND lesson management are enabled
if ($enable_professional_growth && $enable_lesson_management) {
    require_once MP_PLUGIN_DIR . 'includes/lesson-management/cpt-registration.php';
    require_once MP_PLUGIN_DIR . 'includes/lesson-management/rest-api.php';
    require_once MP_PLUGIN_DIR . 'includes/lesson-management/email-handler.php';
}
```

#### 1.5 Add REST Endpoint for Camp Roster Password Verification
```php
// New endpoint: POST /wp-json/mentorship-platform/v1/lessons/verify-roster-password
register_rest_route('mentorship-platform/v1', '/lessons/verify-roster-password', [
    'methods' => 'POST',
    'callback' => 'aquaticpro_verify_roster_password',
    'permission_callback' => '__return_true', // Public endpoint
]);

function aquaticpro_verify_roster_password($request) {
    $password = $request->get_param('password');
    $stored_password = get_option('aquaticpro_camp_roster_password', '');
    
    if (empty($stored_password)) {
        return new WP_Error('no_password_set', 'Public roster access is disabled.', ['status' => 403]);
    }
    
    if ($password === $stored_password) {
        // Return a temporary token valid for 1 hour
        $token = wp_generate_password(32, false);
        set_transient('lm_roster_token_' . $token, true, HOUR_IN_SECONDS);
        return ['success' => true, 'token' => $token];
    }
    
    return new WP_Error('invalid_password', 'Incorrect password.', ['status' => 401]);
}

// Endpoint to validate existing token
register_rest_route('mentorship-platform/v1', '/lessons/validate-roster-token', [
    'methods' => 'POST',
    'callback' => 'aquaticpro_validate_roster_token',
    'permission_callback' => '__return_true',
]);

function aquaticpro_validate_roster_token($request) {
    $token = $request->get_param('token');
    if (get_transient('lm_roster_token_' . $token)) {
        return ['valid' => true];
    }
    return ['valid' => false];
}
```

#### 1.6 Pass Module Status to Frontend
```php
// In wp_localize_script data
$wp_data['enable_lesson_management'] = $enable_professional_growth && $enable_lesson_management;
$wp_data['camp_roster_password_set'] = !empty(get_option('aquaticpro_camp_roster_password', ''));
```

---

### Phase 2: Frontend Integration (React/TypeScript)
**Estimated Time: 8-12 hours**

#### 2.1 Update Types
Add to `src/App.tsx` View type and WpData interface:
```typescript
// Add to View type union
| 'lessons:management'
| 'lessons:email-evaluations'  
| 'lessons:camp-rosters'

// Add to WpData interface
enable_lesson_management?: boolean;
camp_roster_password_set?: boolean;
```

#### 2.2 Create TypeScript Types
Create `src/types/lessons.ts`:
```typescript
export interface Swimmer {
  id: number;
  title: { rendered: string };
  meta: {
    parent_name: string;
    parent_email: string;
    date_of_birth: string;
    notes: string;
    current_level: number;
    levels_mastered: number[];
    skills_mastered: { skill_id: number; date: string }[];
    evaluations: number[];
  };
  modified_gmt: string;
}

export interface Level {
  id: number;
  title: { rendered: string };
  meta: {
    sort_order: number;
    skills: number[];
    color?: string;
  };
}

export interface Skill {
  id: number;
  title: { rendered: string };
  meta: {
    sort_order: number;
    level_id: number;
  };
}

export interface Group {
  id: number;
  title: { rendered: string };
  meta: {
    time_slot: string;
    instructor_ids: number[];
    swimmer_ids: number[];
    max_capacity: number;
  };
  lm_camp: number[];
  lm_animal: number[];
  lm_lesson_type: number[];
  modified_gmt: string;
}

export interface Evaluation {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  meta: {
    swimmer_id: number;
    level_id: number;
    skills_completed: number[];
    date: string;
    instructor_id: number;
    emailed: boolean;
  };
}

export interface Camp {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

export interface Animal {
  id: number;
  name: string;
  slug: string;
}

export interface LessonType {
  id: number;
  name: string;
  slug: string;
}

export type LessonTab = 'groups' | 'swimmers' | 'evaluations' | 'settings';
```

#### 2.3 Convert Components to TypeScript
Create new files in `src/components/lessons/`:

**Main Views (Top-Level):**
- [ ] `LessonManagement.tsx` - Main management view with tabs (Groups, Swimmers, Evaluations, Settings)
- [ ] `EmailEvaluations.tsx` - Bulk email interface
- [ ] `CampRosters.tsx` - Public roster view with password gate

**Sub-Components:**
- [ ] `GroupManager.tsx`
- [ ] `SwimmerManager.tsx`
- [ ] `SwimmerForm.tsx`
- [ ] `EvaluationManager.tsx`
- [ ] `EvaluationForm.tsx`
- [ ] `LevelManager.tsx`
- [ ] `SkillManager.tsx`
- [ ] `CampManager.tsx`
- [ ] `CampOrganizer.tsx`
- [ ] `AnimalManager.tsx`
- [ ] `LessonTypeManager.tsx`
- [ ] `LessonSettingsPanel.tsx` - Combined settings for Levels, Skills, Camps, Animals, Lesson Types

**Supporting:**
- [ ] `MultiSelectSearch.tsx`
- [ ] `ShareLinkModal.tsx`
- [ ] `LockConfirmModal.tsx`
- [ ] `RosterPasswordGate.tsx` - Password entry for public roster access

#### 2.4 Create Context Provider
Create `src/context/LessonDataContext.tsx`:
- [ ] Port DataContext from lesson-management
- [ ] Preload essential data (levels, skills, camps, animals, lesson types)
- [ ] Provide API client methods

#### 2.5 Create API Service
Create `src/services/lesson-api.ts`:
- [ ] Port apiClient functions from lesson-management/src/api.js
- [ ] Use AquaticPro's nonce and API patterns
- [ ] Add `verifyRosterPassword()` method
- [ ] Add `validateRosterToken()` method

#### 2.6 Update Sidebar Navigation
Update `src/components/Sidebar.tsx`:

```typescript
// Add prop
enableLessonManagement?: boolean;

// Add to navItems array (conditionally when enableLessonManagement is true)
...(enableLessonManagement ? [{
    view: 'lessons:management' as View,
    label: 'Lessons',
    icon: HiOutlineBookOpen,
    requiresAuth: true,
    subItems: [
        { view: 'lessons:management' as View, label: 'Management' },
        { view: 'lessons:email-evaluations' as View, label: 'Email Evaluations' },
        { view: 'lessons:camp-rosters' as View, label: 'Camp Rosters' },
    ]
}] : [])
```

**Permission-Based Visibility in Sidebar:**
- Management: Tier 3+ (via existing tier system)
- Email Evaluations: Tier 5+ (via existing tier system)
- Camp Rosters: Always visible in menu when logged in (password check happens on page for public users)

#### 2.7 Update App.tsx Routing
```typescript
// Add cases for lesson views in renderMainContent()
case 'lessons:management':
    return <LessonManagement currentUser={currentUser} />;
case 'lessons:email-evaluations':
    return <EmailEvaluations currentUser={currentUser} />;
case 'lessons:camp-rosters':
    return <CampRosters isLoggedIn={isLoggedIn} currentUser={currentUser} />;
```

#### 2.8 Camp Rosters Public Access Flow
```
┌─────────────────────────────────────────────────────────────┐
│                  Camp Rosters Page                          │
├─────────────────────────────────────────────────────────────┤
│  IF user is logged in AND has Tier 3+:                      │
│     → Show rosters directly (no password needed)            │
│                                                             │
│  ELSE IF user is logged out OR low tier:                    │
│     → Check sessionStorage for valid token                  │
│     → If valid token exists, show rosters                   │
│     → If no token, show RosterPasswordGate component        │
│        → On correct password, store token in sessionStorage │
│        → Show rosters                                       │
│                                                             │
│  IF no password is set by admin:                            │
│     → Show "Public access disabled" message                 │
│     → Prompt to log in for access                           │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Styling & Theme Alignment
**Estimated Time: 4-6 hours**

#### 3.1 Color Palette Migration
Replace lesson-management colors with AquaticPro brand colors:

| Old (LM) | New (AquaticPro) |
|----------|------------------|
| `#2271b1` (WP Blue) | `#0004ff` (aqua-blue) |
| `#3858e9` | `#12a4ff` (aqua-sky) |
| Generic buttons | `bg-gradient-aqua` or `GradientButton` |
| Success green | Keep or use `emerald-500` |
| Error red | Keep `red-600` |

#### 3.2 Component Styling Updates
For each converted component:
- [ ] Replace button styles with `GradientButton` component or gradient classes
- [ ] Update focus rings to `focus:ring-aqua-blue`
- [ ] Update selection/active states to use aqua colors
- [ ] Ensure consistent border-radius (`rounded-lg` or `rounded-xl`)
- [ ] Match card styling (shadow, padding, borders)

#### 3.3 Tab Navigation Styling
The Management view uses tabs (Groups, Swimmers, Evaluations, Settings):
```tsx
// Match AquaticPro tab styling
<div className="flex border-b border-gray-200">
    {tabs.map(tab => (
        <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                    ? 'border-aqua-blue text-aqua-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            {tab.label}
        </button>
    ))}
</div>
```

---

### Phase 4: Feature Parity & Testing
**Estimated Time: 4-6 hours**

#### 4.1 Feature Checklist

**Management View - Groups Tab:**
- [ ] Create/Edit/Delete groups
- [ ] Assign swimmers to groups
- [ ] Assign instructors
- [ ] Filter by camp/animal/lesson type
- [ ] Drag-and-drop reordering

**Management View - Swimmers Tab:**
- [ ] Create/Edit/Delete swimmers
- [ ] Track levels and skills mastered
- [ ] View evaluation history
- [ ] Search and filter
- [ ] Lock conflict detection

**Management View - Evaluations Tab:**
- [ ] Create evaluations for swimmers
- [ ] Mark skills complete
- [ ] View/Edit existing evaluations

**Management View - Settings Tab (Admin Only):**
- [ ] Level management (CRUD + reorder)
- [ ] Skill management (CRUD + assign to levels)
- [ ] Camp taxonomy management
- [ ] Animal taxonomy management
- [ ] Lesson type management

**Email Evaluations View:**
- [ ] List all unsent evaluations
- [ ] Send individual evaluation emails
- [ ] Bulk email all unsent
- [ ] Mark as sent

**Camp Rosters View:**
- [ ] Password gate for non-authenticated users
- [ ] View all groups by camp
- [ ] Filter by camp dropdown
- [ ] Print-friendly view

#### 4.2 Permission Testing
- [ ] Tier 3 user sees Lessons menu, can view Management
- [ ] Tier 4 user can create/edit swimmers and groups
- [ ] Tier 5 user sees Email Evaluations
- [ ] Tier 6/Admin sees Settings tab
- [ ] Logged-out user can access Camp Rosters with correct password
- [ ] Logged-out user CANNOT access Management or Email Evaluations

---

### Phase 5: Polish & Documentation
**Estimated Time: 2-3 hours**

#### 5.1 Loading States
- [ ] Add loading spinners matching AquaticPro style
- [ ] Skeleton loaders for lists

#### 5.2 Error Handling
- [ ] Toast notifications for success/error
- [ ] Graceful error boundaries

#### 5.3 Mobile Responsiveness
- [ ] Test lesson views on mobile
- [ ] Ensure tables are scrollable/responsive

#### 5.4 Documentation Updates
- [ ] Update README.md with Lesson Management section
- [ ] Document admin settings and password configuration

---

## 4. Data Model Reference

### 4.1 WordPress Data (Lesson Management CPTs)

```
Custom Post Types:
├── lm-swimmer (Swimmers)
│   └── Meta: parent_name, parent_email, date_of_birth, notes, 
│             current_level, levels_mastered[], skills_mastered[], evaluations[]
├── lm-level (Levels)
│   └── Meta: sort_order, skills[], color
├── lm-skill (Skills)
│   └── Meta: sort_order, level_id
├── lm-group (Groups)
│   └── Meta: time_slot, instructor_ids[], swimmer_ids[], max_capacity
│   └── Taxonomies: lm_camp, lm_animal, lm_lesson_type
└── lm-evaluation (Evaluations)
    └── Meta: swimmer_id, level_id, skills_completed[], date, instructor_id, emailed

Taxonomies:
├── lm_camp (Camps)
├── lm_animal (Animals/Mascots)
└── lm_lesson_type (Lesson Types)
```

### 4.2 Module Settings (WordPress Options)

```php
'aquaticpro_enable_lesson_management' => bool     // Module toggle (requires Professional Growth)
'aquaticpro_camp_roster_password' => string       // Public roster access password
'lm_email_subject' => string                      // Email template subject (existing)
'lm_email_template' => string                     // Email template body (existing)
```

---

## 5. API Endpoints Reference

### 5.1 WordPress REST (CPT) - Existing
```
GET/POST/PUT/DELETE /wp-json/wp/v2/lm-swimmer
GET/POST/PUT/DELETE /wp-json/wp/v2/lm-level
GET/POST/PUT/DELETE /wp-json/wp/v2/lm-skill
GET/POST/PUT/DELETE /wp-json/wp/v2/lm-group
GET/POST/PUT/DELETE /wp-json/wp/v2/lm-evaluation
GET/POST/PUT/DELETE /wp-json/wp/v2/lm_camp
GET/POST/PUT/DELETE /wp-json/wp/v2/lm_animal
GET/POST/PUT/DELETE /wp-json/wp/v2/lm_lesson_type
```

### 5.2 Custom REST (lm/v1) - Existing
```
GET    /wp-json/lm/v1/essential-data
POST   /wp-json/lm/v1/send-evaluation-email/{id}
POST   /wp-json/lm/v1/send-bulk-emails
GET    /wp-json/lm/v1/lock/{post_type}/{id}
POST   /wp-json/lm/v1/lock/{post_type}/{id}
DELETE /wp-json/lm/v1/lock/{post_type}/{id}
```

### 5.3 New Endpoints (mentorship-platform/v1)
```
POST   /wp-json/mentorship-platform/v1/lessons/verify-roster-password
       Body: { password: string }
       Response: { success: true, token: string } | Error

POST   /wp-json/mentorship-platform/v1/lessons/validate-roster-token
       Body: { token: string }
       Response: { valid: boolean }
```

---

## 6. UI/UX Specifications

### 6.1 Sidebar Navigation (When Both Modules Enabled)
```
📊 Dashboard
👥 Mentor Directory
🤝 My Mentorships
📝 Daily Logs
   ├── Read All Logs
   ├── My Logs
   └── Create New Log
🎓 Career Development
   ├── My Promotion Progress
   ├── Team Progress
   ├── In-Service Training
   ├── Scan Audits
   └── Live Recognition Drills
📚 Lessons                    ← NEW (requires Professional Growth enabled)
   ├── 📋 Management          ← Tier 3+ view, Tier 4+ edit
   ├── ✉️ Email Evaluations   ← Tier 5+
   └── 🏕️ Camp Rosters        ← All (public with password)
⚙️ Admin Panel                ← Tier 6 / Admin only
```

### 6.2 Lesson Management View Layout
```
┌─────────────────────────────────────────────────────────────┐
│ 📚 Lesson Management                                        │
├─────────────────────────────────────────────────────────────┤
│ [Groups] [Swimmers] [Evaluations] [Settings*]              │
│                                          *Tier 6 only       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (Tab content renders here based on active tab)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Camp Rosters Password Gate (Public Users)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🏕️ Camp Rosters                          │
│                                                             │
│     ┌─────────────────────────────────────────┐            │
│     │                                         │            │
│     │  Enter the roster password to view      │            │
│     │  camp schedules and groups:             │            │
│     │                                         │            │
│     │  [________________________]             │            │
│     │                                         │            │
│     │  [══════ View Rosters ══════]          │  ← Gradient │
│     │                                         │            │
│     │  Need access? Contact your             │            │
│     │  administrator for the password.        │            │
│     │                                         │            │
│     │  Staff members can log in for          │            │
│     │  full access.                           │            │
│     │                                         │            │
│     └─────────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Module dependency confusion | Medium | Clear UI messaging when disabled |
| Password security for rosters | Medium | Transient tokens, session-based, 1-hour expiry |
| Permission tier mapping | Medium | Document clearly, test all tiers |
| Bundle size increase | Medium | Lazy load lesson components |
| Styling conflicts | Low | Scoped Tailwind, thorough review |

---

## 8. Rollback Plan

If issues arise:
1. Disable `aquaticpro_enable_lesson_management` option in wp-admin
2. All Lessons menu items disappear from UI immediately
3. CPT data remains intact in database
4. Original standalone LM plugin can be re-activated if needed (deactivate AquaticPro LM first)

---

## 9. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend | 4-6 hours | None |
| Phase 2: Frontend | 8-12 hours | Phase 1 |
| Phase 3: Styling | 4-6 hours | Phase 2 |
| Phase 4: Testing | 4-6 hours | Phase 3 |
| Phase 5: Polish | 2-3 hours | Phase 4 |
| **Total** | **22-33 hours** | |

---

## 10. Checklist Summary

### Pre-Development
- [ ] Review and approve this PRD
- [ ] Backup existing databases
- [ ] Create development branch

### Phase 1 Checklist
- [ ] Add module toggle setting (with Professional Growth dependency check)
- [ ] Add camp roster password setting
- [ ] Create `includes/lesson-management/` directory
- [ ] Move and refactor PHP files (skip shortcodes.php)
- [ ] Add conditional loading with dependency check
- [ ] Add password verification REST endpoint
- [ ] Add token validation REST endpoint
- [ ] Pass module status to frontend via wp_localize_script
- [ ] Test CPT registration when module enabled
- [ ] Test REST API endpoints

### Phase 2 Checklist
- [ ] Add new Views to type definitions
- [ ] Create TypeScript types for lessons (`src/types/lessons.ts`)
- [ ] Convert all React components to TypeScript
- [ ] Create `LessonManagement.tsx` (main view with tabs)
- [ ] Create `EmailEvaluations.tsx`
- [ ] Create `CampRosters.tsx` with `RosterPasswordGate`
- [ ] Create `LessonDataContext`
- [ ] Create `lesson-api.ts` service
- [ ] Update Sidebar with Lessons menu and sub-items
- [ ] Update App.tsx routing
- [ ] Add `enableLessonManagement` prop flow

### Phase 3 Checklist
- [ ] Update color palette in all lesson components
- [ ] Replace buttons with GradientButton
- [ ] Match card/form styling to AquaticPro
- [ ] Style tab navigation
- [ ] Verify typography consistency

### Phase 4 Checklist
- [ ] Test all CRUD operations (groups, swimmers, evaluations)
- [ ] Test tier-based permissions (Tier 3, 4, 5, 6)
- [ ] Test public roster password flow
- [ ] Test token expiration and refresh
- [ ] Test mobile responsiveness

### Phase 5 Checklist
- [ ] Add loading states (spinners, skeletons)
- [ ] Add error toasts
- [ ] Update README documentation
- [ ] Final QA pass

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Lead Developer | | | |
| QA Lead | | | |

---

## 12. Detailed Feature Requirements (December 2025 Update)

This section documents specific UI/UX requirements to achieve feature parity with the original lesson-management plugin and includes additional enhancements.

### 12.1 Group Management

#### 12.1.1 Edit Group Form Layout
**Field Order (top to bottom):**
1. Group Name
2. Time
3. Year
4. **Camp** ← moved up from bottom
5. **Animal Group** ← moved up from bottom  
6. **Lesson Type** ← moved up from bottom
7. Level
8. Days of the Week (checkboxes)
9. Instructors (multi-select with search)
10. Swimmers (multi-select with search)
11. Swimmers Table (grouped by instructor, drag-and-drop)
12. Notes
13. **Specific Dates** ← moved to bottom (under Notes)
14. Archived checkbox

#### 12.1.2 Swimmer Table in Group Edit
**Requirements:**
- Swimmers displayed grouped by instructor (instructor name as section header)
- **Whole row is draggable** (no drag handle icon) - EXCEPT the name link
- Improved column responsiveness:
  - Swimmer name: **priority column, should stay on single line**
  - Age column: **NEW - calculate from date_of_birth**
  - Level: can squish/wrap
- Action buttons on each row (keep existing: edit swimmer, create evaluation, remove)
- Mobile-friendly: touch-drag supported, larger touch targets

#### 12.1.3 Nested Slide-Over Pattern
When clicking a swimmer name in the group table:
1. **Swimmer Edit Form** slides over the Edit Group form
2. Back button returns to Edit Group form (preserving state)
3. This is NOT the same as opening the swimmer in the Swimmers tab
4. If "Create Evaluation" is clicked from this swimmer form:
   - **Evaluation Form** slides over on top of the swimmer form
   - Swimmer field is pre-filled and locked
   - Back button returns to Swimmer Edit
   - Saving closes back to Swimmer Edit

```
┌─────────────────────────────────────────┐
│  Edit Group Form                        │
│  ┌───────────────────────────────────┐  │
│  │  Edit Swimmer (slide-over)        │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  New Evaluation (slide-over)│  │  │
│  │  │  (swimmer pre-filled)       │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### 12.1.4 Group Cards in List View
- Display swimmers grouped by instructor name
- Move instructor names INTO the swimmer section (no separate instructor line)
- Show first 3-5 swimmers per instructor, "+X more" if more
- Add **Filter Menu** next to search bar (matching original plugin):
  - Year filter
  - Level filter
  - Lesson Type filter
  - Camp filter
  - Animal filter
  - Instructor filter (multi-select)
  - Days filter (multi-select)
  - Archived: Show/Hide/Only

### 12.2 Swimmer Management

#### 12.2.1 Swimmer Edit Form
**Name Field:**
- Add helper text: "Last Name, First Name"

**Level & Skill Mastery Section (NEW):**
Position: Under Notes field

```
┌─────────────────────────────────────────────────────────────┐
│  MASTERY PROGRESS BAR                                       │
│  [Level 1 ✓] [Level 2 ✓] [Level 3 ◐] [Level 4 ○] [Level 5 ○]│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ▼ Level 1: Beginner                      [✓] Master Level  │
│     ├── [✓] Skill: Blow Bubbles           Completed: 12/1/24│
│     ├── [✓] Skill: Float on Back          Completed: 12/1/24│
│     └── [✓] Skill: Kick with Board        Completed: 12/3/24│
├─────────────────────────────────────────────────────────────┤
│  ▼ Level 2: Novice                        [✓] Master Level  │
│     ├── [✓] Skill: Freestyle Arms         Completed: 12/5/24│
│     └── [✓] Skill: Treading Water         Completed: 12/5/24│
├─────────────────────────────────────────────────────────────┤
│  ▼ Level 3: Intermediate                  [ ] Master Level  │
│     ├── [✓] Skill: Full Freestyle         Completed: 12/8/24│
│     ├── [ ] Skill: Backstroke                               │
│     └── [ ] Skill: Diving                                   │
└─────────────────────────────────────────────────────────────┘
```

**Mastery Logic:**
- Checking a skill checkbox → auto-fills completion date (today)
- Unchecking a skill → removes completion date
- Checking "Master Level" → checks ALL skills in that level with today's date
- If ALL skills in a level are checked → auto-check "Master Level" with date of last skill
- Progress bar updates in real-time based on skill completion status
- Levels sorted by `sort_order` meta field
- Skills sorted by their `sort_order` within each level

**Data Storage:**
```typescript
// Swimmer meta fields
skills_mastered: Array<{
  skill_id: number;
  date: string; // ISO date
}>
levels_mastered: Array<{
  level_id: number;
  date: string; // ISO date
}>
```

#### 12.2.2 Swimmer Share Link
**Both swimmer edit forms (in Group and in Swimmers tab) need:**
- "Share Progress" button
- Generates a token-based URL for non-logged-in users
- Public page displays:
  - Swimmer name
  - Current level
  - Evaluation history (all evaluations, nicely formatted)
  - Progress tracking (levels/skills with completion dates and visual graphics)

**Token Generation:**
- Use existing token pattern from lesson-management plugin
- Tokens should expire after configurable period (default 30 days)
- Store in `lm-swimmer` post meta

### 12.3 Email Evaluations

#### 12.3.1 Fix Email Sending
- Currently broken - needs debugging
- Implement error handling with user feedback

#### 12.3.2 Batch Send Feature
- "Send All" button to email all unsent evaluations
- Progress indicator during batch send
- Summary report after completion:
  ```
  ┌────────────────────────────────────┐
  │  Batch Send Complete               │
  │  ✓ 15 emails sent successfully     │
  │  ✗ 2 emails failed                 │
  │                                    │
  │  Failed:                           │
  │  - John Smith (invalid email)      │
  │  - Jane Doe (server error)         │
  │                                    │
  │  [Close] [Retry Failed]            │
  └────────────────────────────────────┘
  ```

### 12.4 Lesson Settings (General Tab)

#### 12.4.1 Email Settings Section
Add under "Camp Roster Password" section in Settings > General:

**Email Configuration:**
- From Name (default: site name)
- From Email (default: admin email)
- Reply-To Email
- Email Subject Template (with placeholders: {swimmer_name}, {level}, etc.)
- Email Body Template (WYSIWYG or textarea)
- CC Admin on all emails (checkbox)
- BCC Email (optional)

**Match feature parity with lesson-management backend settings.**

### 12.5 Drag and Drop Improvements

#### 12.5.1 Current Issues
- Drag handle icon is clunky
- Poor mobile experience
- Complex DnD kit implementation

#### 12.5.2 Required Changes
- Remove drag handle icon (☰)
- Make entire row draggable by touch/click-hold
- Swimmer name should be a LINK (not draggable) - opens nested slide-over
- Use `react-beautiful-dnd` patterns (similar to original plugin)
- Improve touch targets for mobile (minimum 44x44px)
- Visual feedback during drag:
  - Source row opacity reduced
  - Drop zone highlighted
  - Dragged item has shadow/elevation

### 12.6 Mobile Responsiveness

- All forms should be touch-friendly
- Slide-overs should be full-screen on mobile
- Back buttons easily accessible
- Form fields appropriately sized for touch
- Tables should scroll horizontally if needed (with sticky name column)

---

**Document Status:** Ready for Review  
**Version:** 1.2 - Updated December 2025: Added detailed feature requirements for Group Management, Swimmer Management, Email Evaluations, and UI/UX improvements.

**Next Steps:** Upon approval, begin Phase 1 implementation.
