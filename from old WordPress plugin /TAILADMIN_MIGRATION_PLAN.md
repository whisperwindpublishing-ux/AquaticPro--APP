# TailAdmin Design System Migration Plan

## Overview
Systematically migrate the application to TailAdmin design standards while preserving:
- **Sidebar/submenu button colors** (current design)
- **Lesson Management color scheme**:
  - Groups: Blue
  - Swimmers: Green
  - Evaluations: Purple
  - Camp Organizer: Orange

## TailAdmin Design Patterns

### Color Palette
```
Brand: #465fff (primary blue)
Success: #12b76a (green)
Error: #f04438 (red)
Warning: #f79009 (orange)
Gray: #667085 (neutral)
```

### Component Standards

#### **Inputs**
- Border: `border border-gray-300`
- Focus: `focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10`
- Padding: `px-4 py-2.5` or `px-3 py-2`
- Rounded: `rounded-lg`
- Background: `bg-white`
- Text: `text-sm`

#### **Buttons**
- **Primary**: `bg-brand-500 text-white px-5 py-3.5 rounded-lg hover:bg-brand-600`
- **Outline**: `bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50`
- Shadows: `shadow-theme-xs`

#### **Tables**
- Header: `bg-gray-50 text-gray-700 font-medium`
- Rows: `border-b border-gray-200 hover:bg-gray-50`
- Padding: `px-4 py-4` or `px-6 py-4`

#### **Cards**
- Background: `bg-white`
- Border: `border border-gray-200`
- Rounded: `rounded-lg` or `rounded-xl`
- Shadow: `shadow-theme-sm` or `shadow-theme-md`
- Padding: `p-6` or `p-4`

#### **Modals**
- Backdrop: `fixed inset-0 bg-black/50`
- Container: `bg-white rounded-lg shadow-theme-xl`
- Max width: `max-w-md` to `max-w-4xl`

## Migration Phases

### Phase 1: Core UI Components (Week 1)
**Priority: Create reusable TailAdmin-styled components**

#### 1.1 Create Base Components
- [ ] `src/components/ui/Input.tsx` - TailAdmin input
- [ ] `src/components/ui/Select.tsx` - TailAdmin select
- [ ] `src/components/ui/Textarea.tsx` - TailAdmin textarea
- [ ] `src/components/ui/Checkbox.tsx` - TailAdmin checkbox
- [ ] `src/components/ui/Radio.tsx` - TailAdmin radio
- [ ] `src/components/ui/Button.tsx` - TailAdmin button (extend existing)
- [ ] `src/components/ui/Card.tsx` - TailAdmin card
- [ ] `src/components/ui/Table.tsx` - TailAdmin table
- [ ] `src/components/ui/Modal.tsx` - TailAdmin modal
- [ ] `src/components/ui/Badge.tsx` - TailAdmin badge

#### 1.2 Update Global Styles
- [ ] Extract TailAdmin color variables to `src/index.css`
- [ ] Add TailAdmin shadows
- [ ] Add utility classes (`menu-item`, `menu-item-active`, etc.)

### Phase 2: Dashboard & Home (Week 2)
**Priority: High visibility pages**

#### 2.1 Home Dashboard
- [ ] Update metric cards
- [ ] Update quick action buttons
- [ ] Update recent activity feed
- [ ] Update charts/graphs

### Phase 3: User Management Module (Week 2-3)
**Priority: Admin-heavy usage**

#### 3.1 Users List
- [ ] Convert table to TailAdmin table
- [ ] Update search/filter inputs
- [ ] Update action buttons
- [ ] Update user avatar display

#### 3.2 User Forms
- [ ] New Hires form
- [ ] User edit form
- [ ] Role assignment form

#### 3.3 Configuration Pages
- [ ] Pay Configuration
- [ ] Role Management
- [ ] Criteria Management
- [ ] Location Management
- [ ] Time Slot Management

### Phase 4: Daily Logs Module (Week 3-4)
**Priority: Frequently used**

#### 4.1 Daily Log List
- [ ] Convert table to TailAdmin table
- [ ] Update filters (date, location, role)
- [ ] Update action buttons (edit, delete, archive)

#### 4.2 Daily Log Forms
- [ ] Create/Edit form
- [ ] Rich text editor integration
- [ ] Attachment handling
- [ ] Tag/category selectors

### Phase 5: Professional Growth Module (Week 4-5)
**Priority: Medium**

#### 5.1 Promotion Progress
- [ ] Progress cards
- [ ] Criteria checklist
- [ ] Timeline view

#### 5.2 In-Service Training
- [ ] Training log table
- [ ] Training form
- [ ] Multi-user selection

#### 5.3 Scan Audits, Drills, Cashier Audits
- [ ] Audit tables
- [ ] Audit forms
- [ ] Score/rating components

### Phase 6: Lesson Management Module (Week 5-6)
**Priority: Preserve color scheme**

#### 6.1 Groups (Blue Theme)
- [ ] Groups table - keep blue accents
- [ ] Group form - blue primary buttons
- [ ] Group cards - blue borders/headers

#### 6.2 Swimmers (Green Theme)
- [ ] Swimmers table - keep green accents
- [ ] Swimmer form - green primary buttons
- [ ] Swimmer cards - green borders/headers

#### 6.3 Evaluations (Purple Theme)
- [ ] Evaluations table - keep purple accents
- [ ] Evaluation form - purple primary buttons
- [ ] Evaluation cards - purple borders/headers

#### 6.4 Camp Organizer (Orange Theme)
- [ ] Drag-drop interface - orange accents
- [ ] Organizer cards - orange borders
- [ ] Action buttons - orange

#### 6.5 Common Elements (TailAdmin Standard)
- [ ] Search inputs
- [ ] Filter dropdowns
- [ ] Pagination
- [ ] Date pickers
- [ ] Modals (use TailAdmin modal, color accents per module)

### Phase 7: Learning Module (Week 6)
**Priority: Medium-Low**

#### 7.1 Course List
- [ ] Course cards
- [ ] Progress indicators
- [ ] Filter/search

#### 7.2 Course Viewer
- [ ] Lesson navigation
- [ ] Content display
- [ ] Progress tracking

#### 7.3 Course Builder
- [ ] Course creation form
- [ ] Lesson editor
- [ ] Content management

### Phase 8: TaskDeck Module (Week 7)
**Priority: Medium**

#### 8.1 Task Board
- [ ] Kanban columns
- [ ] Task cards
- [ ] Drag-drop styling

#### 8.2 Task Modal
- [ ] Task details
- [ ] Comments section
- [ ] Attachments
- [ ] Activity log

### Phase 9: Awards Module (Week 7-8)
**Priority: Low**

#### 9.1 Award Cards
- [ ] Leaderboards
- [ ] Individual awards
- [ ] Team awards

#### 9.2 Award Forms
- [ ] Nomination form
- [ ] Award criteria

### Phase 10: Reports & Analytics (Week 8)
**Priority: Medium**

#### 10.1 Report Tables
- [ ] Compliance reports
- [ ] Custom report builder
- [ ] Export functionality

#### 10.2 Charts
- [ ] Replace charts with TailAdmin-styled versions
- [ ] Consistent color palette

### Phase 11: Settings & Profile (Week 8-9)
**Priority: Low**

#### 11.1 User Settings
- [ ] Profile form
- [ ] Password change
- [ ] Preferences

#### 11.2 System Settings
- [ ] Dashboard configuration
- [ ] Module toggles

## Implementation Guidelines

### Color Override for Lesson Management

For lesson management modules, use these color overrides:

```tsx
// Groups (Blue)
const groupsColors = {
  bg: 'bg-blue-50',
  text: 'text-blue-600',
  border: 'border-blue-300',
  hover: 'hover:bg-blue-100',
  button: 'bg-blue-600 hover:bg-blue-700'
};

// Swimmers (Green)
const swimmersColors = {
  bg: 'bg-green-50',
  text: 'text-green-600',
  border: 'border-green-300',
  hover: 'hover:bg-green-100',
  button: 'bg-green-600 hover:bg-green-700'
};

// Evaluations (Purple)
const evaluationsColors = {
  bg: 'bg-purple-50',
  text: 'text-purple-600',
  border: 'border-purple-300',
  hover: 'hover:bg-purple-100',
  button: 'bg-purple-600 hover:bg-purple-700'
};

// Camp Organizer (Orange)
const campColors = {
  bg: 'bg-orange-50',
  text: 'text-orange-600',
  border: 'border-orange-300',
  hover: 'hover:bg-orange-100',
  button: 'bg-orange-600 hover:bg-orange-700'
};
```

### Component Usage Pattern

```tsx
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Standard usage
<Input label="Name" placeholder="Enter name" />
<Button variant="primary">Save</Button>

// Lesson Management with color override
<Button 
  variant="primary" 
  className="bg-blue-600 hover:bg-blue-700" // Groups
>
  Save Group
</Button>
```

## Testing Checklist

After each phase:
- [ ] Desktop responsiveness (1920px, 1440px, 1024px)
- [ ] Tablet responsiveness (768px)
- [ ] Mobile responsiveness (375px, 425px)
- [ ] Dark mode compatibility (if applicable)
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

## Rollout Strategy

1. **Development Branch**: Create `feature/tailadmin-migration`
2. **Module-by-Module**: Merge each completed phase
3. **Staging Testing**: Full QA after each phase
4. **Production**: Deploy in batches (non-critical modules first)

## Success Metrics

- [ ] Consistent visual design across all modules
- [ ] Reduced CSS file size (consolidated classes)
- [ ] Improved mobile responsiveness
- [ ] Faster development of new features (reusable components)
- [ ] Better accessibility scores
- [ ] Positive user feedback on UX

## Notes

- **DO NOT** change Sidebar button colors
- **DO NOT** change Lesson Management color scheme
- **DO** apply TailAdmin patterns to all other UI elements
- **DO** test each module thoroughly before moving to next phase
- **DO** maintain backward compatibility during migration
