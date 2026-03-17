# PRD: AquaticPro Button Standardization Initiative

## Document Information
- **Version**: 1.1
- **Date**: February 4, 2026
- **Status**: Phase 2 Complete - Issues Identified
- **Priority**: High

---

## Phase 1 & 2 Implementation Review

### ✅ Phase 1 Completed Successfully

**1.1 Extended Button Component** ✅
- Added 8 new lesson management variants to `src/components/ui/Button.tsx`:
  - Solid: `lesson-groups`, `lesson-swimmers`, `lesson-evaluations`, `lesson-camp`
  - Soft: `lesson-groups-soft`, `lesson-swimmers-soft`, `lesson-evaluations-soft`, `lesson-camp-soft`
- All variants use inline styles with Gumroad-style 3D effect
- Added convenience exports: `LessonGroupsButton`, `LessonSwimmersButton`, etc.

**1.2 SidebarButton Component** ⏳ Deferred
- Not implemented yet - Sidebar uses specialized navigation patterns
- Added to Phase 3 scope

**1.3 TabButton Component** ⏳ Deferred
- GoalDisplay TabButton not refactored yet
- CSS variable approach preserved for now

### ✅ Phase 2 Partially Complete - Issues Found

**Files Successfully Migrated (8 files, ~41 buttons):**

| File | Buttons Migrated | Status |
|------|------------------|--------|
| `UserManagement.tsx` | 11 | ✅ Complete |
| `RoleManagement.tsx` | 4 | ⚠️ Has TypeScript errors |
| `SeasonManagement.tsx` | 2 | ✅ Complete |
| `TaskDeck.tsx` | 7 | ✅ Complete |
| `AwardPeriodManagement.tsx` | 3 | ✅ Complete |
| `NewHireManager.tsx` | 4 | ✅ Complete |
| `LiveDrillForm.tsx` | 5 | ⚠️ Uses missing variants |
| `ScanAuditForm.tsx` | 5 | ⚠️ Uses missing variants |

### 🚨 Critical Issues Identified

#### Issue 1: Missing Outline Variants
**Problem**: During Phase 2 migration, the following variants were used but DON'T EXIST in Button.tsx:
- `danger-outline`
- `success-outline`  
- `warning-outline`
- `outline` (plain outline)

**Files Affected**:
- `LiveDrillForm.tsx` (lines 616, 627, 638, 653)
- `ScanAuditForm.tsx` (lines 509, 519, 529)
- `RoleManagement.tsx` (line 949)

**Resolution Required**: Add outline variants to Button.tsx in Phase 3

#### Issue 2: Build vs TypeScript Check Discrepancy
**Problem**: Vite build passes but `tsc --noEmit` shows type errors. This means runtime button styling may fall back to defaults.

**Impact**: Buttons using non-existent variants will render with no styling or default browser styling.

#### Issue 3: Pre-existing TypeScript Errors in RoleManagement.tsx
**Problem**: Multiple unrelated TypeScript errors exist in RoleManagement.tsx related to permission object shapes - not caused by button migration.

### 📋 Action Items for Phase 3

1. **Add missing outline variants** to Button.tsx:
   ```tsx
   | 'outline'           // Plain gray outline
   | 'danger-outline'    // Red outline
   | 'success-outline'   // Green outline
   | 'warning-outline'   // Yellow/orange outline
   ```

2. **Run full TypeScript check** before each phase completion:
   ```bash
   npx tsc --noEmit
   ```

3. **Fix pre-existing errors** in:
   - RoleManagement.tsx (permission shapes)
   - LiveDrillsView.tsx (missing property)

---

## Executive Summary

This PRD outlines a comprehensive plan to standardize all button styling across the AquaticPro application. The current state has **~650+ raw `<button>` elements** scattered across 97 component files, leading to inconsistent styling, WordPress theme conflicts, and maintenance challenges.

The solution leverages the existing `<Button>` component (`src/components/ui/Button.tsx`) which uses **inline styles** to reliably override WordPress theme CSS. This migration will establish a consistent, professional design language while preserving specific module color identities.

---

## Problem Statement

### Current Issues

1. **WordPress Theme Conflicts**: Raw `<button>` elements are styled by WordPress themes (BuddyBoss, Twenty Twenty-Five), causing inconsistent appearance
2. **Inconsistent Design**: Buttons vary wildly in padding, borders, colors, shadows, and hover states
3. **Maintenance Burden**: 650+ individual button instances make design changes difficult
4. **Failed CSS Solutions**: Multiple attempts to fix via CSS (Tailwind prefix, `!important`, CSS resets) have all failed (see `docs/BUTTON_STYLING_FAILURES.md`)

### Root Cause
The `<Button>` component with **inline styles** is the ONLY reliable solution that works across all WordPress themes. Inline styles have the highest CSS specificity and cannot be overridden by external stylesheets.

---

## Solution Architecture

### Core Button Component

The `src/components/ui/Button.tsx` component will be the **single source of truth** for all button styling. It provides:

- **Variants**: `primary`, `secondary`, `danger`, `success`, `warning`, `ghost`, `link`, `edit`, `icon`
- **Sizes**: `xs`, `sm`, `md`, `lg`, `xl`
- **Features**: Loading state, icons (left/right), full width, disabled state
- **Gumroad-Style Design**: Raised 3D appearance with `2px solid black` border and `box-shadow: 2px 2px 0 0 rgba(0,0,0,1)`

### New Variants to Add

To support all modules while maintaining design consistency, the following variants will be added:

```tsx
// Additional variants for Button.tsx
{
  // Lesson Management Module Colors
  'lesson-groups': { backgroundColor: '#3b82f6', color: '#ffffff' },  // Blue
  'lesson-swimmers': { backgroundColor: '#22c55e', color: '#ffffff' }, // Green  
  'lesson-evaluations': { backgroundColor: '#a855f7', color: '#ffffff' }, // Purple
  'lesson-camp': { backgroundColor: '#f97316', color: '#ffffff' }, // Orange
  
  // Soft/Secondary versions for each
  'lesson-groups-soft': { backgroundColor: '#eff6ff', color: '#1d4ed8' }, // Blue soft
  'lesson-swimmers-soft': { backgroundColor: '#f0fdf4', color: '#16a34a' }, // Green soft
  'lesson-evaluations-soft': { backgroundColor: '#faf5ff', color: '#9333ea' }, // Purple soft
  'lesson-camp-soft': { backgroundColor: '#fff7ed', color: '#ea580c' }, // Orange soft
}
```

---

## Exceptions & Special Components

### Exception 1: Sidebar Menu Buttons

**Location**: `src/components/Sidebar.tsx`

**Preserve Current Style**:
- Light purple/lavender background on hover (`#f3e8ff`)
- Selected state with purple highlight
- **NO raised 3D style** - flat appearance
- Navigation-appropriate subtle transitions

**Implementation**: Create a `SidebarButton` component or use `variant="ghost"` with custom styling passed via `style` prop.

### Exception 2: Mentorship Module Tabs

**Location**: `src/components/GoalDisplay.tsx` (TabButton component)

**Preserve Current Style**:
- Timeline: Indigo (`#6366f1`)
- Initiatives: Custom roadmap color (CSS variable)
- Tasks: Custom tasks color (CSS variable)
- Meetings: Custom meetings color (CSS variable)
- Updates: Custom updates color (CSS variable)

**Implementation**: Keep the existing `TabButton` component as-is but ensure it uses inline styles for WordPress compatibility.

### Exception 3: Lesson Management Color Themes

**Preserve Color Identity**:
| Section | Primary Color | Hex | Usage |
|---------|--------------|-----|-------|
| Groups | Blue | `#3b82f6` | Headers, action buttons |
| Swimmers | Green | `#22c55e` | Headers, action buttons |
| Evaluations | Purple | `#a855f7` | Headers, action buttons |
| Camp | Orange | `#f97316` | Headers, action buttons |

**Implementation**: Use new `lesson-*` variants that maintain the Gumroad-style 3D effect but with module-specific colors.

---

## Migration Inventory

### Total Scope
- **97 files** require updates
- **~650 raw `<button>` elements** to migrate
- **24 files** already partially migrated

### Priority Tiers

#### Tier 1: Critical (>15 raw buttons) - 15 files
These files have the most visual impact and user interaction:

| File | Raw Buttons | Module |
|------|-------------|--------|
| `SwimmerManager.tsx` | 33 | lessons |
| `NestedSwimmerEditor.tsx` | 32 | lessons |
| `TaskDeck.tsx` | 31 | root |
| `CareerDevelopment.tsx` | 26 | root |
| `CourseBuilder.tsx` | 23 | lms |
| `TaskCardModal.tsx` | 23 | root |
| `NewHireManager.tsx` | 20 | root |
| `EvaluationEditor.tsx` | 18 | lessons |
| `SwimmerDetail.tsx` | 18 | lessons |
| `UserManagement.tsx` | 17 | root |
| `CourseList.tsx` | 17 | lms |
| `LessonEditor.tsx` | 17 | lms |
| `CampOrganizer.tsx` | 16 | lessons |
| `GroupManager.tsx` | 16 | lessons |
| `EmployeeBulkManager.tsx` | 15 | root |

#### Tier 2: High (6-14 raw buttons) - 35 files
Medium-complexity components requiring attention.

#### Tier 3: Low (1-5 raw buttons) - 47 files
Simple components with minimal button usage.

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**1.1 Extend Button Component**
- Add new variants for Lesson Management colors
- Add `flat` option to disable 3D shadow effect
- Ensure all variants use inline styles consistently

**1.2 Create SidebarButton Component**
- Fork styling from current Sidebar.tsx
- Maintain lavender/purple color scheme
- Flat design without 3D effect

**1.3 Update TabButton Component**  
- Refactor GoalDisplay.tsx TabButton to use inline styles
- Preserve color theme CSS variables

### Phase 2: Core Application (Week 2-3)

**2.1 Root Components - Forms & Modals**
Migrate in order of user interaction frequency:

```
Day 1-2: Forms
├── DailyLogForm.tsx (already migrated ✅)
├── ScanAuditForm.tsx
├── CashierAuditForm.tsx
├── InstructorEvaluationForm.tsx
├── LiveDrillForm.tsx
└── NominationForm.tsx

Day 3-4: Modals & Dialogs
├── TaskCardModal.tsx (23 buttons)
├── EnhancedMeetingForm.tsx
├── UserSelector.tsx
└── ImageUploadModal.tsx

Day 5: Management Views
├── CareerDevelopment.tsx (26 buttons)
├── UserManagement.tsx (17 buttons)
├── NewHireManager.tsx (20 buttons)
└── EmployeeBulkManager.tsx (15 buttons)
```

**2.2 Root Components - Tables & Lists**
```
├── TaskDeck.tsx (31 buttons)
├── DailyLogList.tsx
├── DailyLogCard.tsx
├── AwardsHub.tsx
├── ComplianceReports.tsx
└── TeamView.tsx
```

**2.3 Root Components - Settings & Admin**
```
├── AdminPanel.tsx
├── RoleManagement.tsx
├── CriteriaManagement.tsx
├── LocationManagement.tsx
├── TimeSlotManagement.tsx
├── ActionButtonsManagement.tsx
└── DashboardSettings.tsx
```

### Phase 3: Module Migration (Week 4-5)

**3.1 Lessons Module** (149 buttons across 10 files)
Apply `lesson-*` variants maintaining color identity:
```
├── SwimmerManager.tsx (33) → lesson-swimmers
├── NestedSwimmerEditor.tsx (32) → lesson-swimmers  
├── EvaluationEditor.tsx (18) → lesson-evaluations
├── SwimmerDetail.tsx (18) → lesson-swimmers
├── CampOrganizer.tsx (16) → lesson-camp
├── GroupManager.tsx (16) → lesson-groups
├── CampRosters.tsx (13) → lesson-camp
├── EmailEvaluations.tsx (5) → lesson-evaluations
├── PublicSwimmerProgress.tsx (3) → lesson-swimmers
└── LessonManagement.tsx (3) → primary
```

**3.2 LMS Module** (115 buttons across 13 files)
```
├── CourseBuilder.tsx (23)
├── CourseList.tsx (17)
├── LessonEditor.tsx (17)
├── CourseDetail.tsx (9)
├── LessonList.tsx (9)
├── PageBuilder.tsx (8)
└── [remaining 7 files]
```

**3.3 SRM Module** (69 buttons across 8 files)
```
├── ResponseTracker.tsx (13)
├── ReturnInviteManager.tsx (13)
├── EmailTemplateManager.tsx (12)
├── PublicReturnForm.tsx (11)
└── [remaining 4 files]
```

**3.4 Mileage Module** (30 buttons across 5 files)
```
├── MileageEntryForm.tsx (12)
├── MileageApprovalDashboard.tsx (9)
└── [remaining 3 files]
```

### Phase 4: Cleanup & Validation (Week 6)

**4.1 Remove Legacy CSS**
- Remove unused `.aq-btn-*` classes from `index.css`
- Remove unused button reset CSS
- Clean up Tailwind button classes no longer used

**4.2 Add Visual Regression Tests**
- Screenshot comparisons for critical components
- Cross-theme testing (BuddyBoss, Twenty Twenty-Five, etc.)

**4.3 Documentation**
- Update component documentation
- Create button usage guidelines
- Add Storybook examples (if applicable)

---

## Button Design Specifications

### Standard Button (Gumroad-Style)

```css
/* Primary Example */
{
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: '2px solid #000000',
  boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
  borderRadius: '0.5rem',
  fontWeight: 600,
  padding: '0.625rem 1rem', /* md size */
  cursor: 'pointer',
  transition: 'all 0.15s ease'
}

/* Hover State */
{
  backgroundColor: '#1d4ed8',
  transform: 'translate(-2px, -2px)'
}

/* Active/Pressed State */
{
  backgroundColor: '#1e40af',
  transform: 'none',
  boxShadow: 'none'
}
```

### Sidebar Button (Flat Style)

```css
/* Default State */
{
  backgroundColor: 'transparent',
  color: '#6b7280', /* gray-500 */
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
  fontWeight: 500,
  border: 'none',
  boxShadow: 'none'
}

/* Hover State */
{
  backgroundColor: '#f3e8ff', /* purple-100 */
  color: '#7c3aed' /* purple-600 */
}

/* Active/Selected State */
{
  backgroundColor: '#ede9fe', /* purple-100 */
  color: '#7c3aed', /* purple-600 */
  fontWeight: 600
}
```

### Tab Button (Colored Tabs)

```css
/* Default State */
{
  backgroundColor: '#f3e8ff', /* purple-50 */
  color: '#6b21a8', /* purple-800 */
  border: '2px solid #d8b4fe',
  borderBottomColor: 'transparent',
  borderRadius: '0.5rem 0.5rem 0 0'
}

/* Active/Hover State */
{
  backgroundColor: 'var(--tab-color)', /* Dynamic per tab */
  color: '#ffffff',
  borderColor: 'var(--tab-color)'
}
```

---

## Variant Reference Table

| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| `primary` | `#2563eb` | white | black | Main actions (Save, Submit) |
| `secondary` | `#f3f4f6` | `#374151` | black | Secondary actions (Cancel) |
| `danger` | `#fef2f2` | `#dc2626` | black | Destructive actions (Delete) |
| `success` | `#16a34a` | white | black | Positive actions (Approve) |
| `warning` | `#fff7ed` | `#ea580c` | black | Cautionary actions |
| `edit` | `#faf5ff` | `#9333ea` | black | Edit mode actions |
| `ghost` | transparent | `#4b5563` | none | Minimal actions |
| `link` | transparent | `#2563eb` | none | Inline links |
| `icon` | transparent | `#6b7280` | none | Icon-only buttons |
| **Outline Variants** | | | | |
| `outline` | transparent | `#374151` | gray | Subtle secondary actions |
| `danger-outline` | transparent | `#dc2626` | red | Subtle destructive actions |
| `success-outline` | transparent | `#16a34a` | green | Subtle positive actions |
| `warning-outline` | transparent | `#d97706` | amber | Subtle cautionary actions |
| **Lesson Variants** | | | | |
| `lesson-groups` | `#2563eb` | white | black | Groups module |
| `lesson-swimmers` | `#16a34a` | white | black | Swimmers module |
| `lesson-evaluations` | `#9333ea` | white | black | Evaluations module |
| `lesson-camp` | `#ea580c` | white | black | Camp module |
| `lesson-*-soft` | light bg | colored | black | Secondary module actions |
| `link` | transparent | `#2563eb` | none | Inline links |
| `icon` | transparent | `#6b7280` | none | Icon-only buttons |
| `lesson-groups` | `#3b82f6` | white | black | Groups module |
| `lesson-swimmers` | `#22c55e` | white | black | Swimmers module |
| `lesson-evaluations` | `#a855f7` | white | black | Evaluations module |
| `lesson-camp` | `#f97316` | white | black | Camp module |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Button component usage | 100% | All buttons use `<Button>` |
| Raw `<button>` elements | 0 | (except Exceptions) |
| Visual consistency | Pass | Manual review |
| Theme compatibility | Pass | Test with 3+ WP themes |
| Build size impact | <5% increase | Compare bundle sizes |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Incremental migration, thorough testing |
| Performance impact | Medium | Inline styles are fast, no concern |
| Developer resistance | Low | Clear documentation, simple API |
| Missing edge cases | Medium | Component supports `style` prop for overrides |

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | 1 week | Extended Button, SidebarButton, TabButton |
| Phase 2: Core App | 2 weeks | All root components migrated |
| Phase 3: Modules | 2 weeks | All module components migrated |
| Phase 4: Cleanup | 1 week | CSS cleanup, testing, documentation |
| **Total** | **6 weeks** | Full standardization |

---

## File Migration Checklist

### Legend
- ⬜ Not started
- 🟡 In progress  
- ✅ Complete
- ⚠️ Complete with issues

### src/components/ (Root)
```
⬜ ActionButtonsManagement.tsx
⬜ AdminPanel.tsx
⬜ AssignedCardsBanner.tsx
✅ AwardPeriodManagement.tsx
⬜ AwardsHub.tsx
⬜ AwesomeAwardsPermissions.tsx
⬜ BlockEditor.tsx
⬜ CareerDevelopment.tsx
⬜ CashierAuditForm.tsx
⬜ CashierAuditsView.tsx
⬜ CommentSection.tsx
⬜ ComplianceReports.tsx
⬜ CriteriaManagement.tsx
⬜ CriterionActivity.tsx
⬜ DailyLogCard.tsx
⬜ DailyLogDashboard.tsx
✅ DailyLogForm.tsx
⬜ DailyLogImport.tsx
⬜ DailyLogList.tsx
⬜ DailyLogPermissionsManagement.tsx
⬜ Dashboard.tsx
⬜ DashboardSettings.tsx
⬜ EmployeeBulkManager.tsx
⬜ EnhancedMeetingForm.tsx
⬜ FOIAExport.tsx
⬜ GoalDisplay.tsx (TabButton exception)
⬜ GradientButton.tsx
⬜ Header.tsx
⬜ InServiceLog.tsx
⬜ InServiceUserTable.tsx
⬜ InstructorEvaluationForm.tsx
⬜ InstructorEvaluationsView.tsx
⬜ LegacyImport.tsx
⬜ LessonManagementExport.tsx
⚠️ LiveDrillForm.tsx (uses missing outline variants)
⬜ LiveDrillsView.tsx
⬜ LocationManagement.tsx
⬜ LoginForm.tsx
⬜ MentorCard.tsx
⬜ MentorDirectory.tsx
⬜ MentorProfile.tsx
⬜ MentorshipDashboard.tsx
⬜ MentorshipTimeline.tsx
⬜ MyMentees.tsx
⬜ NewHireApplicationForm.tsx
✅ NewHireManager.tsx
⬜ NominationForm.tsx
⬜ NominationsList.tsx
⬜ PendingRequestBanner.tsx
⬜ PortfolioDirectory.tsx
⬜ PortfolioPage.tsx
⬜ ProfileDropdown.tsx
⬜ PromotionProgress.tsx
⬜ PublicLandingPage.tsx
⬜ RecentWinnersWidget.tsx
⬜ RichTextEditor.tsx
⚠️ RoleManagement.tsx (uses missing outline variant)
⚠️ ScanAuditForm.tsx (uses missing outline variants)
⬜ ScanAuditsView.tsx
✅ SeasonManagement.tsx
⬜ Sidebar.tsx (Exception 1 - preserve style)
⬜ TaskCardModal.tsx
✅ TaskDeck.tsx
⬜ TeamView.tsx
⬜ TimeSlotManagement.tsx
⬜ UserJobAssignments.tsx
✅ UserManagement.tsx
⬜ UserManagementDashboard.tsx
⬜ UserSelector.tsx
⬜ UserSettings.tsx
⬜ WinnerAnnouncementBanner.tsx
⬜ WinnerCelebration.tsx
⬜ WinnersGallery.tsx
```

### src/components/lessons/
```
⬜ CampOrganizer.tsx
⬜ CampRosters.tsx
⬜ EmailEvaluations.tsx
⬜ EvaluationEditor.tsx
⬜ GroupManager.tsx
⬜ LessonManagement.tsx
⬜ NestedSwimmerEditor.tsx
⬜ PublicSwimmerProgress.tsx
⬜ SwimmerDetail.tsx
⬜ SwimmerManager.tsx
```

### src/components/lms/
```
⬜ CourseBuilder.tsx
⬜ CourseDetail.tsx
⬜ CourseList.tsx
⬜ CourseProgress.tsx
⬜ index.tsx
⬜ LessonEditor.tsx
⬜ LessonList.tsx
⬜ LessonViewer.tsx
⬜ LMSModule.tsx
⬜ PageBuilder.tsx
⬜ PageEditor.tsx
⬜ PageViewer.tsx
⬜ StudentProgress.tsx
```

### src/components/srm/
```
⬜ EmailTemplateManager.tsx
⬜ OfferViewModal.tsx
⬜ PayConfigList.tsx
⬜ PublicReturnForm.tsx
⬜ ResponseTracker.tsx
⬜ ReturnInviteManager.tsx
⬜ SeasonEditor.tsx
⬜ SeasonList.tsx
```

### src/components/mileage/
```
⬜ index.tsx
⬜ MileageApprovalDashboard.tsx
⬜ MileageEntryForm.tsx
⬜ MileageEntryList.tsx
⬜ MileageModule.tsx
```

---

## Appendix A: Button Component Usage Examples

### Basic Usage
```tsx
import { Button } from '@/components/ui/Button';

// Primary action
<Button variant="primary" onClick={handleSave}>
  Save Changes
</Button>

// Secondary action
<Button variant="secondary" onClick={handleCancel}>
  Cancel
</Button>

// With icon
<Button variant="danger" leftIcon={<TrashIcon className="ap-h-4 ap-w-4" />}>
  Delete
</Button>

// Loading state
<Button variant="primary" loading>
  Saving...
</Button>
```

### Lesson Management
```tsx
// Groups section
<Button variant="lesson-groups">Add New Group</Button>

// Swimmers section  
<Button variant="lesson-swimmers">Add Swimmer</Button>

// Soft variants for secondary actions
<Button variant="lesson-swimmers-soft">View Details</Button>
```

### Size Options
```tsx
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
```

---

## Appendix B: CSS Variable Reference for Tabs

```css
:root {
  --tab-timeline-active: #6366f1;    /* Indigo */
  --tab-roadmap-active: #10b981;     /* Emerald */
  --tab-tasks-active: #f59e0b;       /* Amber */
  --tab-meetings-active: #3b82f6;    /* Blue */
  --tab-updates-active: #ec4899;     /* Pink */
  --brand-primary: #7c3aed;          /* Purple */
}
```

---

*Document created: February 4, 2026*
*Last updated: February 4, 2026*
