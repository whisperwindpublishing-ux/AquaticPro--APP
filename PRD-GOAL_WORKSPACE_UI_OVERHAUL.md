# PRD: Goal Workspace UI Overhaul

**Status:** Draft  
**Date:** February 17, 2026  
**Priority:** High  
**Scope:** `GoalDisplay.tsx`, `MentorshipDashboard.tsx`, `MentorshipTimeline.tsx`, `CommentSection.tsx`, new workspace-layout components  

---

## 1. Problem Statement

The current mentorship goal page uses a **tabbed interface** (Timeline | Initiatives | Tasks | Meetings | Updates) that presents three critical UX failures:

| Pain Point | Root Cause | Impact |
|---|---|---|
| Users don't know where to document progress | Content is hidden behind tabs; new users don't discover Meetings or Updates tabs | Low adoption of key features |
| Users lose work | Meetings and Updates require explicit "Save" button clicks; no auto-save | Data loss, frustration, distrust in the platform |
| Rapid tab switching | Users click between tabs repeatedly to cross-reference information | Cognitive overhead, lost context, slow workflows |

**Goal:** Replace the tab-based navigation with a **workspace layout** inspired by [ServiceNow Horizon Workspace](https://horizon.servicenow.com/workspace/overview) where all content areas are simultaneously visible as **dynamic, resizable cards** that expand on interaction and auto-save all changes.

---

## 2. Current Architecture (As-Is)

### Component Hierarchy
```
MentorshipDashboard
├── Sidebar (goal list, lg:w-1/4)
└── GoalDisplay (key={goal.id}, lg:w-3/4)
    ├── Mentorship banner (gradient header with avatars)
    ├── ConnectWithSection (contact pills)
    ├── Goal header card (title, description, status, portfolio, share)
    ├── CommentSection (goal-level, standalone section)
    ├── TabBar (5 TabButtons)
    └── TabContent (switch on activeTab)
        ├── Timeline → MentorshipTimeline.tsx
        ├── Initiatives → inline InitiativeItem[]
        ├── Tasks → DnD TaskList grouped by initiative
        ├── Meetings → MeetingItem[] → EnhancedMeetingForm
        └── Updates → UpdateItem[] + new update form
```

### Current Save Behavior
| Content | Save Method | Auto-Save? |
|---|---|---|
| Goal title, description, status, tasks, initiatives | `onUpdate()` → parent `isDirty` → 1s debounce → `updateGoal()` | ✅ Yes |
| Meetings | `createMeeting()` / `updateMeeting()` on explicit Save button | ❌ No |
| Updates | `createUpdate()` / `updateUpdate()` on explicit Save button | ❌ No |
| Comments | Direct WP REST API `POST` on submit | N/A (submit-based) |

### Key Strength to Preserve
- **Timeline click-to-focus:** Clicking a Timeline item sets `focusedItemId` + `focusedItemType`, switches to the relevant tab, and scrolls the item into view with `scrollIntoView()`. This is the best feature and must be preserved — in the new layout it will scroll/expand the relevant card in the workspace rather than switching tabs.

---

## 3. Proposed Architecture (To-Be)

### 3.1 Layout: 3-Column Workspace

Replace the single-column tabbed layout with a **3-column workspace** that makes all content visible simultaneously.

```
┌─────────────────────────────────────────────────────────────────────┐
│  GOAL HEADER CARD                                                   │
│  Title | Description | Status | Portfolio | Share | 💬 Comments     │
├─────────────────────────────────────────────────────────────────────┤
│  INITIATIVES STRIP  (always visible, horizontal scroll)             │
│  [Initiative 1 ●]  [Initiative 2 ○]  [Initiative 3 ●]  [+ New]    │
├──────────────┬─────────────────────────────┬────────────────────────┤
│  TIMELINE    │   WORKSPACE CARDS           │   UPDATES FEED         │
│  (Left Rail) │                             │   (Right Panel)        │
│              │  ┌─────────────────────┐    │                        │
│  ● Meeting   │  │  📋 TASKS CARD      │    │  ┌──────────────────┐  │
│  │           │  │  (expandable)       │    │  │ Update 1         │  │
│  ● Update    │  │                     │    │  │ "Made progress..." │
│  │           │  └─────────────────────┘    │  └──────────────────┘  │
│  ● Task ✓   │  ┌─────────────────────┐    │  ┌──────────────────┐  │
│  │           │  │  📅 MEETINGS CARD   │    │  │ Update 2         │  │
│  ● Meeting   │  │  (expandable)       │    │  │ "Completed..."   │  │
│              │  │                     │    │  └──────────────────┘  │
│              │  └─────────────────────┘    │  ┌──────────────────┐  │
│              │                             │  │ + New Update     │  │
│              │                             │  │ (always visible) │  │
│              │                             │  └──────────────────┘  │
└──────────────┴─────────────────────────────┴────────────────────────┘
```

**Column Widths (desktop ≥ 1024px):**
- Timeline rail: `w-[260px]` fixed
- Workspace cards: `flex-1` (fills remaining space)
- Updates feed: `w-[320px]` default → expands to `w-[480px]` on interaction

**Responsive (mobile < 1024px):**
- Timeline takes full width (default visible — per user preference)
- Tasks and Meetings become slide-out **drawer panels** (swipe or button to open)
- Updates becomes a slide-out **drawer panel** (swipe or button to open)
- Drawer indicators with badge counts always visible at screen edges

### 3.2 Goal Header Card Redesign

The goal header card layout changes to integrate comments inline:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 Goal Title                                            [✏ Edit] │
│  Description text here...                                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ [In Progress ▾]  [🌐 Public Portfolio]  [🔗 Share]  [💬 12] │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ▼ Comments (expanded below when 💬 button clicked)                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CommentSection (threaded, inline within the card)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Changes:**
- Move `CommentSection` from a standalone section **into** the goal header card
- Add a comment count badge button (`💬 12`) inline on the status row, floated right
- Clicking the badge toggles the CommentSection open/closed **underneath** the status row, still inside the card
- Comment count updates live via `onCountChange` callback (already supported)

### 3.3 Initiatives Strip

Move initiatives **out of the tab system** and into an always-visible horizontal strip between the goal header and the 3-column workspace.

```
┌──────────────────────────────────────────────────────────────────┐
│  🚀 Initiatives                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Init 1   │  │ Init 2   │  │ Init 3   │  │ + Add    │        │
│  │ ● Active │  │ ○ Not St │  │ ✓ Done   │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Each initiative renders as a compact **chip/card** showing title + status indicator
- Clicking an initiative chip expands it inline (pushes siblings) to show the full edit view (title edit, description RichTextEditor, status dropdown)
- Initiatives can still be used as filters — clicking an initiative highlights related Tasks and Meetings in the workspace cards below
- Horizontal scroll with fade-out gradient on overflow
- `+ Add Initiative` button always visible at the end
- All changes auto-save (already supported via `onUpdate` flow)

### 3.4 Dynamic Expanding Cards (Workspace Center)

The center column contains **Tasks** and **Meetings** as separate, always-visible cards. No tabs, no hiding.

#### Card States

Each card has 3 states:

| State | Height | Content | Trigger |
|---|---|---|---|
| **Collapsed** | ~60px | Card header + item count badge | Default when another card is expanded |
| **Default** | ~200-300px | Header + scrollable list of items | Page load, click header when expanded |
| **Expanded** | Dynamic (up to 70vh) | Full list + active editing area | Click an item, or click "+ New" |

#### Expansion Behavior (ServiceNow-inspired)

When a card expands:
1. The expanding card **grows** with a smooth CSS transition (`transition: flex 300ms ease, max-height 300ms ease`)
2. Sibling cards **compress** proportionally but **never hide** — they shrink to their collapsed state (header + count visible)
3. Total height stays within viewport, using `overflow-y: auto` on expanded content
4. Clicking back on the expanded card's header returns it to default state
5. CSS implementation: use `flex-grow` values — expanded card gets `flex-grow: 3`, default gets `flex-grow: 1`, collapsed gets `flex-grow: 0` with `flex-basis: 60px`

#### Card: Tasks

```
┌─────────────────────────────────────────────┐
│  📋 Tasks (12)                    [+ New]   │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ ☐ Review chapter 3        Due: 2/20 │    │
│  │   Initiative: Writing Skills        │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │  ← Expanded: shows edit fields
│  │ ☐ Prepare presentation    Due: 2/25 │    │     inline within the card
│  │   [Assignee ▾] [Priority ▾] [Init ▾]│    │
│  │   ─────────────────────────────────  │    │
│  │   Notes: ...                        │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ☑ Complete self-assessment  ✓ 2/15  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

- Preserves existing DnD reordering between initiative groups
- Clicking a task row expands it inline to show edit fields
- All task changes continue to auto-save via existing `onUpdate` → debounce → `updateGoal` flow

#### Card: Meetings

```
┌─────────────────────────────────────────────┐
│  📅 Meetings (5)                  [+ New]   │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ Weekly Check-in        Feb 15, 2026 │    │
│  │ 🔄 Recurring │ Init: Leadership     │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │  ← Expanded: EnhancedMeetingForm
│  │ Quarterly Review       Feb 20, 2026 │    │     rendered inline
│  │ ─────────────────────────────────── │    │
│  │ Agenda | Notes | Decisions | Action │    │
│  │ [meeting editing fields...]         │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Goal Setting Session   Jan 30, 2026 │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

- Preserves existing `EnhancedMeetingForm` component for meeting editing
- Grouped by initiative (existing behavior preserved)
- Per-meeting `CommentSection` remains available inside expanded meeting view

### 3.5 Updates Feed (Right Panel)

The Updates feed becomes an **always-visible, chat-style panel** pinned to the right side of the workspace.

```
┌──────────────────────┐
│  💬 Updates (8)      │
│  ──────────────────  │
│                      │
│  ┌────────────────┐  │
│  │ 👤 Jane · 2/15 │  │
│  │ Made progress  │  │
│  │ on chapter...  │  │
│  │ 📎 2 files     │  │
│  │ 💬 3 comments  │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ 👤 Bob · 2/12  │  │
│  │ Completed the  │  │
│  │ draft review...│  │
│  └────────────────┘  │
│                      │
│  ──────────────────  │
│  ┌────────────────┐  │
│  │ + New Update   │  │
│  │ [RichTextEdit] │  │
│  │ [📎 Attach]    │  │
│  │         [Post] │  │
│  └────────────────┘  │
└──────────────────────┘
```

**Behavior:**
- Default width: `320px`
- **Horizontal expand:** When user clicks into the "New Update" composer or clicks an update to view/edit, the panel smoothly expands to `480px` (CSS transition on width), pushing the center column narrower
- Clicking outside or blurring the editor returns to `320px`
- Scrollable feed, newest at top (matching current sort order)
- "New Update" composer is **always visible** at the bottom (sticky positioned)
- Each update shows: author avatar, date, rich text preview, attachment count, comment count
- Clicking an update expands it to show full content + CommentSection
- Per-update comments remain available in expanded view

### 3.6 Timeline (Left Rail)

The Timeline moves to a **persistent left rail** that serves as navigational anchor.

**Behavior:**
- Vertical timeline with grouped-by-date headers (preserving existing `groupActivitiesByDate()`)
- Colored type indicators (meeting=rose, update=purple, task=blue) — preserved from current CSS variables
- **Click-to-focus (enhanced):** Clicking a Timeline item now:
  1. Identifies the `sourceType` (meeting/update/task)
  2. Sets `focusedItemId` + `focusedItemType` (existing state)
  3. **Expands** the relevant card in the center column (Tasks or Meetings) — instead of switching tabs
  4. **Scrolls** to the specific item within the card using `scrollIntoView({ behavior: 'smooth', block: 'center' })`
  5. If the source is an Update, scrolls the right panel to that update instead
  6. Applies a brief highlight animation (`ring-2 ring-indigo-400 animate-pulse`) to the focused item
- **Active item indicator:** The currently focused timeline item gets a filled dot and highlighted background
- Timeline rail has its own vertical scroll, independent of the center/right columns

---

## 4. Auto-Save System

### 4.1 Universal 3-Second Debounce

Extend the existing auto-save pattern to **all content types** with a 3-second debounce and visual indicator.

| Content | Current Behavior | New Behavior |
|---|---|---|
| Goal fields (title, desc, status) | 1s debounce auto-save ✅ | 3s debounce auto-save ✅ |
| Tasks | Auto-save via goal update ✅ | 3s debounce auto-save ✅ (unchanged) |
| Initiatives | Auto-save via goal update ✅ | 3s debounce auto-save ✅ (unchanged) |
| **Meetings** | **Manual save button** ❌ | **3s debounce auto-save** ✅ |
| **Updates** | **Manual save button** ❌ | **3s debounce auto-save** ✅ |

### 4.2 Save Status Indicator

Add a persistent save status indicator visible at the top of the workspace:

```
States:
  ✓ All changes saved          (green, idle)
  ⏳ Saving...                  (amber, pulse animation)
  ✓ Saved just now             (green, fades to idle after 2s)
  ⚠ Save failed — Retry       (red, with retry button)
```

**Implementation:**
- New `SaveStatusIndicator` component
- New `useSaveStatus` hook that tracks `idle | pending | saving | saved | error` state
- Positioned in the goal header card, top-right corner
- Meeting/Update auto-save: on field change → `isDirty` flag per entity → 3s debounce → API call → status update
- If user navigates away while dirty, show browser `beforeunload` confirmation

### 4.3 Meeting Auto-Save Flow

```
User edits meeting field
  → setMeetingDirty(meetingId, true)
  → 3s debounce timer starts
  → If no new edits in 3s:
      → SaveStatusIndicator shows "Saving..."
      → updateMeeting(meeting) API call
      → On success: SaveStatusIndicator shows "Saved"
      → On failure: SaveStatusIndicator shows "Save failed — Retry"
  → If new edit within 3s: timer resets
```

### 4.4 Update Auto-Save Flow

**For existing updates:** Same debounce pattern as meetings.

**For new updates:** The "Post" action remains explicit (button click) since a new update being composed is a draft that shouldn't be posted prematurely. However:
- Draft text is persisted to `localStorage` keyed by `goal_${goalId}_update_draft`
- On page load, if a draft exists, it's restored into the composer
- After successful post, draft is cleared from `localStorage`

---

## 5. New Component Architecture

### 5.1 Component Tree (To-Be)

```
MentorshipDashboard
├── Sidebar (goal list, lg:w-1/4) — unchanged
└── GoalWorkspace (replaces GoalDisplay)
    ├── GoalHeaderCard
    │   ├── GoalTitle (editable)
    │   ├── GoalDescription (RichTextEditor)
    │   ├── GoalStatusRow
    │   │   ├── GoalStatusDropdown
    │   │   ├── PortfolioToggle
    │   │   ├── ShareButton
    │   │   └── CommentToggleButton (💬 badge)
    │   ├── CommentSection (collapsible, inside card)
    │   └── SaveStatusIndicator
    │
    ├── InitiativesStrip
    │   ├── InitiativeChip[] (expandable inline)
    │   └── AddInitiativeButton
    │
    └── WorkspaceColumns (3-column flex container)
        ├── TimelineRail
        │   └── MentorshipTimeline (enhanced with click-to-expand)
        │
        ├── CardStack (center, flex-col)
        │   ├── ExpandableCard (Tasks)
        │   │   ├── CardHeader (title, count, + New)
        │   │   └── CardBody (scrollable, DnD TaskList)
        │   │
        │   └── ExpandableCard (Meetings)
        │       ├── CardHeader (title, count, + New)
        │       └── CardBody (scrollable, MeetingList)
        │
        └── UpdatesFeed (right panel)
            ├── UpdatesList (scrollable)
            │   └── UpdateItem[] (expandable)
            └── UpdateComposer (sticky bottom)
```

### 5.2 New Files to Create

| File | Purpose |
|---|---|
| `src/components/GoalWorkspace.tsx` | Main workspace layout — replaces `GoalDisplay.tsx` as the primary goal view |
| `src/components/GoalHeaderCard.tsx` | Goal header with inline comments |
| `src/components/InitiativesStrip.tsx` | Horizontal initiative chips strip |
| `src/components/WorkspaceColumns.tsx` | 3-column flex/grid container |
| `src/components/TimelineRail.tsx` | Left rail wrapper for MentorshipTimeline |
| `src/components/ExpandableCard.tsx` | Generic expandable card shell (manages expand/collapse/compress states) |
| `src/components/TaskCard.tsx` | Tasks content for ExpandableCard |
| `src/components/MeetingCard.tsx` | Meetings content for ExpandableCard |
| `src/components/UpdatesFeed.tsx` | Right panel updates feed |
| `src/components/UpdateComposer.tsx` | Sticky new-update composer with draft persistence |
| `src/components/SaveStatusIndicator.tsx` | Save state indicator UI |
| `src/hooks/useSaveStatus.ts` | Save status state machine hook |
| `src/hooks/useAutoSave.ts` | Generic auto-save hook (3s debounce, dirty tracking) |
| `src/hooks/useDraftPersistence.ts` | localStorage draft persistence hook |
| `src/hooks/useExpandableCards.ts` | Manages which card is expanded and flex-grow values |
| `src/components/MobileDrawer.tsx` | Slide-out drawer for mobile responsive layout |

### 5.3 Files to Modify

| File | Changes |
|---|---|
| `src/components/MentorshipDashboard.tsx` | Replace `<GoalDisplay>` with `<GoalWorkspace>`, extend auto-save to meetings/updates |
| `src/components/MentorshipTimeline.tsx` | Add `onFocusItem` callback that targets card expansion instead of tab switching |
| `src/components/EnhancedMeetingForm.tsx` | Remove explicit Save button, wire up `onChange` for auto-save, add dirty tracking |
| `src/components/CommentSection.tsx` | No changes needed — already supports `isOpen` prop control |
| `src/styles/theme.css` | Add card transition variables, workspace layout tokens |
| `src/components/GoalDisplay.tsx` | **Archive** — moved to `_archived/` after `GoalWorkspace` reaches parity. Both active and portfolio views will use `GoalWorkspace` |
| `src/components/PortfolioPage.tsx` | **Modified** — swaps `GoalDisplay` import for `GoalWorkspace` with `isReadOnly=true` |

### 5.4 Files Unchanged

| File | Reason |
|---|---|
| `src/components/RichTextEditor.tsx` | Used as-is in UpdateComposer and GoalDescription |
| `src/components/BlockEditor.tsx` | Used as-is in EnhancedMeetingForm |
| `src/services/api.ts` | API layer stays the same — auto-save just calls the same endpoints |
| `src/types.ts` | No schema changes needed |

---

## 6. Detailed Interaction Specifications

### 6.1 Card Expansion Animation

```css
.workspace-card {
  transition: flex-grow 300ms cubic-bezier(0.4, 0, 0.2, 1),
              max-height 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.workspace-card--collapsed { flex-grow: 0; flex-basis: 60px; }
.workspace-card--default   { flex-grow: 1; }
.workspace-card--expanded  { flex-grow: 3; }
```

### 6.2 Updates Panel Expansion

```css
.updates-feed {
  width: 320px;
  transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.updates-feed--active {
  width: 480px;
}
```

### 6.3 Timeline Click-to-Focus Flow

```
1. User clicks Timeline item (e.g., Meeting #42)
2. TimelineRail calls onFocusItem({ type: 'meeting', id: 42 })
3. GoalWorkspace.handleFocusItem():
   a. If type === 'update':
      - Scroll UpdatesFeed to update #42
      - Expand update item inline
      - Apply highlight pulse
   b. If type === 'meeting' or 'task':
      - Set expandedCard = type === 'meeting' ? 'meetings' : 'tasks'
      - useExpandableCards shifts flex-grow values
      - After transition (300ms), scrollIntoView on the item
      - Apply highlight pulse animation (1.5s fade)
4. Timeline item gets active styling (filled dot, bg highlight)
```

### 6.4 Initiative Filter Interaction

```
1. User clicks Initiative chip "Leadership Development"
2. InitiativesStrip calls onInitiativeFilter(initiativeId)
3. GoalWorkspace passes activeInitiativeFilter to TaskCard and MeetingCard
4. Cards visually dim items NOT belonging to the filtered initiative (opacity: 0.4)
5. Filtered items get a colored left-border matching the initiative
6. Clicking the same chip again clears the filter
7. Clicking a different chip switches the filter
```

### 6.5 Mobile Drawer Behavior

```
Default view (< 1024px):
┌─────────────────────────────┐
│ Goal Header                 │
│ Initiatives Strip           │
├─────────────────────────────┤
│ Timeline (full width)       │  ← Default visible
│                             │
│                             │
├─────────────────────────────┤
│ [📋 Tasks 12] [📅 Mtgs 5] [💬 Updates 8]  │  ← Drawer trigger bar
└─────────────────────────────┘

Drawer open:
┌─────────────────────────────┐
│ ←  📋 Tasks (12)            │  ← Slide-in from right
│                             │     80% viewport width
│  [task list...]             │     Backdrop dims timeline
│                             │
└─────────────────────────────┘
```

- Timeline is the default visible content on mobile (per user request)
- Tasks, Meetings, and Updates are accessed via drawer triggers at the bottom
- Badge counts on drawer triggers show item counts
- Swipe-right to dismiss drawer
- Only one drawer open at a time

---

## 7. Implementation Plan

### Phase 1: Foundation (Infrastructure + Auto-Save)
**Estimated effort: 3-4 sessions**

1. **Create `useAutoSave` hook**
   - Generic debounced auto-save with configurable delay (default 3s)
   - Returns `{ isDirty, saveStatus, triggerSave, resetDirty }`
   - Handles error retry logic

2. **Create `useSaveStatus` hook**
   - State machine: `idle → pending → saving → saved → idle` (or `→ error`)
   - Aggregates status from multiple auto-save instances (goal, meetings, updates)

3. **Create `SaveStatusIndicator` component**
   - Renders status badge with appropriate icon/color/animation

4. **Create `useDraftPersistence` hook**
   - `localStorage` read/write for update drafts
   - Keyed by `goal_${goalId}_update_draft`
   - Auto-cleanup on successful post

5. **Extend `MentorshipDashboard` auto-save**
   - Change debounce from 1s → 3s
   - Add meeting auto-save handlers
   - Add update auto-save handlers
   - Wire `useSaveStatus` to aggregate all save operations

6. **Modify `EnhancedMeetingForm`**
   - Replace Save button with auto-save
   - Add `onChange` prop that fires on every field change
   - Keep explicit Save as fallback (hidden, activated by Ctrl+S)

### Phase 2: Layout Shell (Workspace Structure)
**Estimated effort: 3-4 sessions**

1. **Create `GoalWorkspace.tsx`**
   - Accept same props as `GoalDisplay`
   - Render 3-column layout with proper flex/grid CSS
   - Manage `expandedCard` state and `activeInitiativeFilter`

2. **Create `GoalHeaderCard.tsx`**
   - Extract goal header from `GoalDisplay`
   - Integrate `CommentSection` inline with toggle button
   - Add `SaveStatusIndicator`

3. **Create `WorkspaceColumns.tsx`**
   - 3-column flex container
   - Responsive breakpoint at 1024px

4. **Create `ExpandableCard.tsx`**
   - Generic card shell with collapse/default/expand states
   - CSS transitions for smooth resizing
   - Props: `title`, `icon`, `count`, `expandedState`, `onExpand`, `children`

5. **Create `useExpandableCards` hook**
   - Manages which card is expanded
   - Provides flex-grow values for each card
   - Handles the "push & compress" logic

6. **Wire `MentorshipDashboard` to render `GoalWorkspace` instead of `GoalDisplay`**

### Phase 3: Content Migration (Cards)
**Estimated effort: 4-5 sessions**

1. **Create `TaskCard.tsx`**
   - Extract task list logic from `GoalDisplay`
   - Preserve DnD with `@dnd-kit`
   - Inline task expansion on click
   - Initiative filter support (dim non-matching)

2. **Create `MeetingCard.tsx`**
   - Extract meeting list logic from `GoalDisplay`
   - Preserve `EnhancedMeetingForm` for expanded meetings
   - Initiative filter support
   - Auto-save wiring

3. **Create `UpdatesFeed.tsx`**
   - Extract update list from `GoalDisplay`
   - Right panel with horizontal expand behavior
   - Per-update CommentSection preserved

4. **Create `UpdateComposer.tsx`**
   - Sticky bottom composer with RichTextEditor
   - File attachment support
   - Draft persistence via `useDraftPersistence`
   - Explicit "Post" button (not auto-saved — per design decision)

5. **Create `InitiativesStrip.tsx`**
   - Extract initiative logic from `GoalDisplay`
   - Horizontal chip layout
   - Expandable inline editing
   - Filter click handler

### Phase 4: Timeline Integration
**Estimated effort: 2-3 sessions**

1. **Create `TimelineRail.tsx`**
   - Wrapper that renders `MentorshipTimeline` in the left column
   - Independent scroll
   - Active item highlighting

2. **Enhance `MentorshipTimeline.tsx`**
   - `onFocusItem` callback replaces tab-switching logic
   - Active item state tracking
   - Highlight animation on source item

3. **Wire click-to-focus flow**
   - Timeline item click → expand card → scroll to item → highlight pulse
   - Update clicks → scroll right panel

### Phase 5: Mobile Responsive
**Estimated effort: 2-3 sessions**

1. **Create `MobileDrawer.tsx`**
   - Slide-in panel component (reusable)
   - Backdrop, swipe-to-dismiss, transition animations

2. **Add responsive breakpoints to `WorkspaceColumns`**
   - Hide left/right columns at < 1024px
   - Show drawer trigger bar

3. **Test touch interactions**
   - DnD on touch devices
   - Swipe gestures for drawers

### Phase 6: Real-Time Updates
**Estimated effort: 2-3 sessions**

1. **Create backend endpoint** `includes/api-routes-goal-changes.php`
   - `GET /mentorship/v1/goal/{id}/changes?since={ISO timestamp}`
   - Returns updates, meetings, and comments modified since timestamp
   - Efficient query using `post_modified > $since` in WordPress

2. **Create `useGoalPolling` hook**
   - 15-second polling with `document.visibilityState` gating
   - Pause while user has unsaved changes
   - Merge incoming changes into local state

3. **Create `UpdateToast.tsx`**
   - Non-blocking notification: "Jane posted an update"
   - Auto-dismiss after 5 seconds
   - Click to scroll to the new item

4. **Add conflict banner for concurrent edits**
   - "This meeting was updated by Jane. [Load their changes] [Keep mine]"

### Phase 7: Print & PDF Export
**Estimated effort: 1-2 sessions**

1. **Create `src/styles/print.css`**
   - `@media print` rules to linearize layout
   - Hide interactive elements, expand all cards
   - Page break rules, print-friendly typography

2. **Create `GoalPrintView.tsx`**
   - Structured printable layout: header → initiatives → tasks → meetings (fully expanded) → updates → timeline
   - Hidden on screen (`ap-hidden print:ap-block`)
   - Renders all meeting details (agenda, notes, decisions, action items)

3. **Add "Export PDF" button** to `GoalHeaderCard` status row
   - `onClick={() => window.print()}`
   - Uses browser's native Print → Save as PDF

### Phase 8: Portfolio Migration & Polish
**Estimated effort: 2-3 sessions**

1. **Update `PortfolioPage.tsx`** to import `GoalWorkspace` instead of `GoalDisplay`
2. **Archive `GoalDisplay.tsx`** → move to `_archived/`
3. **Enable real-time polling** for portfolio viewers (read-only feed updates)
4. **Accessibility audit** — keyboard navigation for card expansion, ARIA labels for drawers
5. **Animation performance** — verify GPU-accelerated transitions, reduce reflows
6. **Cross-browser testing**

---

## 8. Risk Mitigation

| Risk | Mitigation |
|---|---|
| `GoalDisplay.tsx` is 2112 lines; extraction may introduce regressions | Incremental migration: keep `GoalDisplay` working alongside `GoalWorkspace` behind a feature flag until parity is confirmed |
| Auto-save for meetings may cause premature saves of incomplete data | 3s debounce + only save fields that changed (diff-based) + "Saving..." indicator gives user awareness |
| DnD kit may conflict with card expansion transitions | Test early in Phase 3; use `useSensors` configuration to set activation distance |
| Mobile drawer + DnD touch events may conflict | Use `@dnd-kit`'s `TouchSensor` with `activationConstraint.delay` to distinguish drag from swipe |
| Real-time polling increases server load | 15s interval is conservative; visibility-gated (no polling in background tabs); endpoint returns only diffs, not full goal |
| Print stylesheet conflicts with Tailwind prefixed classes | Use `ap-hidden print:ap-block` pattern consistent with existing `ap-` prefix convention |
| Portfolio mirroring increases maintenance surface | Both views use the same `GoalWorkspace` component — `isReadOnly` prop controls all behavioral differences, no code duplication |
| 3-column layout may feel cramped on 1024-1280px screens | At `1024-1280px`: collapse Timeline rail to icon-only mode (expandable on hover), giving more center space |

---

## 9. Success Metrics

| Metric | Current | Target |
|---|---|---|
| Users finding Meetings/Updates features | Low (hidden in tabs) | 100% visibility (always on screen) |
| Data loss incidents from unsaved work | Frequent (manual save) | Near-zero (auto-save all content) |
| Tab switches per goal editing session | High (rapid switching) | Zero (tabs eliminated) |
| Time to post an update | ~15s (navigate tab → compose → save) | ~5s (composer always visible) |
| Mobile usability | Tabs work but no optimization | Drawer-based mobile-first experience |
| Content freshness | Manual page refresh needed | Real-time polling (15s) shows partner's changes live |
| Goal export/documentation | Not available | One-click PDF export with full goal history |

---

## 10. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Portfolio/Read-Only view layout | **Mirror the workspace layout exactly.** `PortfolioPage` will render `GoalWorkspace` with `isReadOnly=true` — same 3-column layout, same card structure, all edit controls hidden. |
| 2 | Real-time updates feed | **Yes.** Implement polling-based real-time updates for the Updates feed and Meeting changes. See §11 below. |
| 3 | Card reordering | **No.** Card order is fixed: Tasks above Meetings in the center column. |
| 4 | Print / PDF export | **Yes.** Implement a print stylesheet + PDF export button that linearizes all goal content into a clean printable document. See §12 below. |

---

## 11. Real-Time Updates Feed

### 11.1 Strategy: Polling (not WebSocket)

WordPress does not natively support WebSockets, and adding a WS server is out of scope. Instead, use **polling** — the same pattern already used in `LessonTimeTracker` (`api-lms.ts`) and `AwardsIntegration.tsx`.

### 11.2 Implementation: `useGoalPolling` Hook

```typescript
// src/hooks/useGoalPolling.ts
interface UseGoalPollingOptions {
  goalId: number;
  currentUserId: number;
  enabled: boolean;        // disable for read-only or inactive tabs
  intervalMs?: number;     // default: 15000 (15s)
}

interface PollResult {
  newUpdates: Update[];       // updates posted since last poll
  changedMeetings: Meeting[]; // meetings modified since last poll
  newComments: Comment[];     // new comments on goal/meetings/updates
}
```

**Behavior:**
- Polls `GET /mentorship/v1/goal/{id}/changes?since={timestamp}` every 15 seconds
- Only polls when the browser tab is **visible** (`document.visibilityState === 'visible'`)
- On receiving new data:
  - New updates prepend to the Updates feed with a subtle slide-in animation
  - Changed meetings update in-place in the Meetings card (only if the user is NOT currently editing that meeting — check `isDirty` flag)
  - A toast notification appears: "Jane posted an update" or "Bob updated the weekly check-in meeting"
- Pauses polling while the user has unsaved changes (to avoid overwriting their work)
- Resumes on save completion

### 11.3 Backend Endpoint

New REST API route needed:

```php
// includes/api-routes.php
register_rest_route('mentorship/v1', '/goal/(?P<id>\d+)/changes', [
    'methods'  => 'GET',
    'callback' => 'get_goal_changes_since',
    'args'     => [
        'since' => [
            'required' => true,
            'type'     => 'string', // ISO 8601 timestamp
        ],
    ],
]);
```

Response returns only items with `modified_date > since` parameter, keeping payload small.

### 11.4 Conflict Resolution

When a polled change conflicts with local edits:
1. If the user is **not editing** the entity → apply update silently
2. If the user **is editing** the entity → queue the update and show a non-blocking banner: "This meeting was updated by Jane. [Load their changes] [Keep mine]"
3. Field-level merge is NOT attempted — it's a full-entity replacement to keep complexity low

### 11.5 New Files

| File | Purpose |
|---|---|
| `src/hooks/useGoalPolling.ts` | Polling hook with visibility detection |
| `includes/api-routes-goal-changes.php` | Backend endpoint for incremental changes |
| `src/components/UpdateToast.tsx` | Toast notification for incoming changes |

---

## 12. Print Stylesheet & PDF Export

### 12.1 What Is a Print Stylesheet?

A print stylesheet is a CSS file (or `@media print {}` block) that controls how the page looks when a user prints it or exports to PDF. Browsers apply these styles instead of the screen styles when printing. This lets us:
- Linearize the 3-column layout into a single column
- Remove interactive elements (buttons, inputs, drawers)
- Add page breaks between sections
- Use print-friendly fonts and colors

### 12.2 Print Layout

When the user clicks **"Export PDF"** (or Ctrl+P), the page renders as:

```
┌─────────────────────────────────────────────┐
│  🏷️  MENTORSHIP GOAL REPORT                │
│  Generated: February 17, 2026              │
│                                             │
│  Mentor: Bob Smith                         │
│  Mentee: Jane Doe                          │
│  Status: In Progress                       │
├─────────────────────────────────────────────┤
│                                             │
│  📝 GOAL                                    │
│  Title: Develop Leadership Skills           │
│  Description: [full rich text]              │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  🚀 INITIATIVES                             │
│  1. Public Speaking — In Progress           │
│  2. Team Management — Completed             │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📋 TASKS                                   │
│  ☑ Complete self-assessment (Feb 15)        │
│  ☐ Review chapter 3 (Due: Feb 20)          │
│  ☐ Prepare presentation (Due: Feb 25)      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📅 MEETINGS                                │
│  ┌─────────────────────────────────────┐    │
│  │ Weekly Check-in — Feb 15, 2026      │    │
│  │ Agenda: [items]                     │    │
│  │ Notes: [full text]                  │    │
│  │ Decisions: [list]                   │    │
│  │ Action Items: [list]                │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Goal Setting Session — Jan 30       │    │
│  │ ...                                 │    │
│  └─────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  💬 UPDATES                                 │
│  ┌─────────────────────────────────────┐    │
│  │ Jane · Feb 15: Made progress on...  │    │
│  │ 📎 2 attachments                    │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Bob · Feb 12: Completed the draft...│    │
│  └─────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  📊 TIMELINE                                │
│  • Feb 15 — Meeting: Weekly Check-in       │
│  • Feb 15 — Task completed: Assessment     │
│  • Feb 15 — Update by Jane                 │
│  • Feb 12 — Update by Bob                  │
│  • Jan 30 — Meeting: Goal Setting          │
│                                             │
└─────────────────────────────────────────────┘
```

### 12.3 Implementation

**CSS (`@media print`):**
```css
@media print {
  /* Hide non-printable elements */
  .sidebar, .mobile-drawer, .drawer-triggers,
  button, input, .save-indicator, .comment-form,
  .update-composer, .dnd-draggable { display: none !important; }

  /* Linearize layout */
  .workspace-columns { display: block !important; }
  .timeline-rail, .card-stack, .updates-feed {
    width: 100% !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* Expand all cards */
  .workspace-card { max-height: none !important; overflow: visible !important; }
  .meeting-item, .update-item { break-inside: avoid; }

  /* Page breaks */
  .print-section { break-before: auto; break-inside: avoid; }
  .print-page-break { break-before: page; }

  /* Clean typography */
  body { font-size: 11pt; color: #000; }
  h2 { font-size: 16pt; border-bottom: 1pt solid #333; }
}
```

**"Export PDF" Button:**
- Placed in the `GoalHeaderCard` status row, next to Share
- `onClick={() => window.print()}` — leverages the browser's native Print → Save as PDF
- A dedicated `GoalPrintView` component renders the linearized content (hidden on screen via `ap-hidden print:ap-block`)

### 12.4 New Files

| File | Purpose |
|---|---|
| `src/components/GoalPrintView.tsx` | Print-optimized linearized view of all goal content |
| `src/styles/print.css` | `@media print` stylesheet |

---

## 13. Portfolio View (Read-Only Workspace)

### 13.1 Requirement

The portfolio view (`PortfolioPage.tsx`) must **mirror the workspace layout exactly** — same 3-column structure, same card design, same visual hierarchy. The only differences:

| Feature | Workspace (Active) | Portfolio (Read-Only) |
|---|---|---|
| Edit buttons (pencil icons) | Visible | Hidden |
| Task checkboxes | Interactive | Disabled (visual only) |
| DnD reordering | Enabled | Disabled |
| Update Composer | Visible (sticky bottom) | Hidden |
| Meeting edit form | Opens on click | View-only content |
| Goal status dropdown | Editable | Static badge |
| Auto-save | Active | N/A |
| Real-time polling | Active | Active (viewers see new content too) |
| Comments | Read + write | Read-only |
| Export PDF | Available | Available |
| Initiative editing | Enabled | Disabled |
| Save status indicator | Shown | Hidden |

### 13.2 Implementation

`PortfolioPage.tsx` will import `GoalWorkspace` instead of `GoalDisplay`:

```tsx
// Before:
import GoalDisplay from '@/components/GoalDisplay';
<GoalDisplay goal={selectedGoal} isReadOnly={true} ... />

// After:
import GoalWorkspace from '@/components/GoalWorkspace';
<GoalWorkspace goal={selectedGoal} isReadOnly={true} ... />
```

`GoalWorkspace` already accepts `isReadOnly` prop and passes it to all child components. The `isReadOnly` flag:
- Disables `useAutoSave` hooks
- Hides all edit/add buttons via conditional rendering
- Disables DnD sensors
- Hides `UpdateComposer`
- Hides `SaveStatusIndicator`
- Enables `useGoalPolling` so portfolio viewers see live content
- Shows `GoalPrintView` for PDF export

---

## Appendix A: File Reference Map

```
CURRENT FILE                          → NEW FILE(S)
─────────────────────────────────────────────────────────
GoalDisplay.tsx (2112 lines)          → GoalWorkspace.tsx (orchestrator, ~300 lines)
  ├── Goal header section             → GoalHeaderCard.tsx (~200 lines)
  ├── Initiatives tab content         → InitiativesStrip.tsx (~250 lines)
  ├── Tasks tab content               → TaskCard.tsx (~350 lines)
  ├── Meetings tab content            → MeetingCard.tsx (~300 lines)
  ├── Updates tab content             → UpdatesFeed.tsx (~250 lines)
  │                                   → UpdateComposer.tsx (~150 lines)
  ├── TabButton component             → REMOVED (no more tabs)
  ├── GoalStatusDropdown              → GoalHeaderCard.tsx (inline)
  └── PortfolioToggle                 → GoalHeaderCard.tsx (inline)

MentorshipDashboard.tsx (403 lines)   → Modified (auto-save extension)
MentorshipTimeline.tsx (436 lines)    → Modified (onFocusItem callback)
EnhancedMeetingForm.tsx (716 lines)   → Modified (auto-save, remove Save button)
PortfolioPage.tsx (266 lines)         → Modified (import GoalWorkspace instead of GoalDisplay)

NEW HOOKS:
  useAutoSave.ts
  useSaveStatus.ts
  useDraftPersistence.ts
  useExpandableCards.ts
  useGoalPolling.ts

NEW COMPONENTS:
  ExpandableCard.tsx
  WorkspaceColumns.tsx
  TimelineRail.tsx
  SaveStatusIndicator.tsx
  MobileDrawer.tsx
  UpdateToast.tsx
  GoalPrintView.tsx

NEW STYLES:
  src/styles/print.css

NEW BACKEND:
  includes/api-routes-goal-changes.php
```
