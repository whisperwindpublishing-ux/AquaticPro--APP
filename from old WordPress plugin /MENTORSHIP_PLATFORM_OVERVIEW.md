# AquaticPro — Mentorship Module Overview

> **Plugin Name:** AquaticPro  
> **Version:** 13.1.1  
> **Author:** Swimming Ideas, LLC  
> **Stack:** WordPress Plugin (PHP back-end) + React SPA (TypeScript/Vite front-end)

---

## 1. Background & Purpose

The **Mentorship Module** is the foundational feature of the AquaticPro platform. It was the original reason the plugin was built — to power a **mentor–mentee relationship system** for aquatic organizations (pools, waterparks, recreation departments) where experienced staff guide newer or developing employees through structured goals, regular meetings, and tracked progress.

The module enables:

- **Pairing** — Any user can browse a mentor directory, find a suitable mentor, and send a mentorship request.
- **Goal-Driven Development** — Once paired, the mentor and mentee create goals, break them into initiatives and tasks, hold recorded meetings, and post progress updates.
- **Accountability** — Meetings have structured agendas, decisions, action items, and follow-ups. Tasks can be assigned with due dates and priorities.
- **Portfolio Showcase** — Completed goals can be flagged for a public portfolio, allowing staff to showcase professional growth.
- **Comments & Reactions** — All goal objects support threaded comments and emoji reactions for ongoing dialogue.

The mentorship module is **always active** (not feature-flagged) and does not require any other AquaticPro module to function. It uses **WordPress Custom Post Types** exclusively for data storage — no custom database tables.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                           │
│  MentorDirectory → MentorshipDashboard → GoalWorkspace       │
│  Service Layer: src/services/api.ts                          │
└──────────────────────┬───────────────────────────────────────┘
                       │  REST API (JSON)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│         WordPress REST API — includes/api-routes.php         │
│         Namespace: mentorship-platform/v1                    │
│         ~32 endpoints for mentorship CRUD                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              WordPress Core Database                          │
│  wp_posts (6 CPTs) + wp_postmeta (relationships & data)      │
│  wp_usermeta (profiles) + wp_comments (threaded comments)     │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Concern | Approach |
|---|---|
| **Authentication** | WordPress cookie/nonce auth (`wp_rest` nonce injected into SPA) |
| **Authorization** | Relationship-based: only the mentor and mentee in a pairing can access its data. Admins (WP `manage_options` or Tier 5–6) bypass all checks. |
| **Data Storage** | 100% WordPress CPTs + `wp_postmeta`. No custom database tables. |
| **Relationships** | Parent–child links via post meta keys (`_mentorship_id`, `_goal_id`, `_initiative_id`) |
| **Rich Text** | BlockNote editor (block-based JSON) for meeting notes; HTML stored in `post_content` |
| **Attachments** | WordPress media library attachments linked via `post_parent` |
| **Comments** | Native WordPress comment system on each CPT |
| **Real-time** | Polling endpoint (`/goal-changes`) for live workspace updates |

---

## 3. Mentorship Lifecycle

### 3.1 Request Flow

```
Mentee browses Mentor Directory
       │
       ▼
Mentee sends request ──► POST /requests
       │                 Creates mp_request (status: Pending)
       │                 Email notification → mentor
       ▼
Mentor accepts/rejects ──► PUT /requests/{id}/status
       │                    Updates _status meta
       │                    Email notification → mentee
       ▼
If Accepted → Mentorship is active
       │
       ▼
Both users can create goals, meetings, tasks, updates
```

**Duplicate prevention:** The system blocks a mentee from sending a second pending request to the same mentor.

**Admin shortcut:** `POST /admin/create-mentorship` creates an auto-accepted pairing directly.

### 3.2 Active Mentorship

Once accepted, the mentorship becomes a container for goals. Each goal is a self-contained workspace with its own:

- **Initiatives** — Sub-goals for organizing larger objectives
- **Tasks / Action Items** — To-do items with assignees, due dates, priorities
- **Meetings** — Scheduled or completed meetings with structured notes
- **Updates** — Progress posts with file attachments

### 3.3 Deletion

Admin-only. `DELETE /requests/{id}` performs a **cascading delete** of the entire relationship: all goals, initiatives, tasks, meetings, updates, their comments, and their media attachments.

---

## 4. Data Model

### 4.1 Custom Post Types

The mentorship module registers **6 CPTs** (plus `mp_daily_log` which belongs to the Daily Logs module):

| CPT Slug | WordPress Supports | Purpose |
|---|---|---|
| `mp_request` | title, editor, author | Mentorship pairing. Title auto-generated. Editor = request message. Author = mentee. |
| `mp_goal` | title, editor, author, revisions, comments | A mentorship goal. Editor = description. |
| `mp_initiative` | title, editor, author, comments | A sub-goal within a goal. Editor = description. |
| `mp_task` | title, author | A task/action item. Title = task text. Uses `menu_order` for drag-drop sorting. |
| `mp_meeting` | title, editor, author, comments | A meeting. Title = topic. Editor = notes. |
| `mp_update` | title, editor, author, comments, thumbnail | A progress update. Editor = text. Supports thumbnails/attachments. |

All CPTs are `public: false`, `show_in_rest: true`, and nested under the `mp_request` admin menu.

### 4.2 Entity Hierarchy

```
mp_request (mentorship relationship)
  ├── post_author ──────── mentee user ID
  ├── _receiver_id meta ── mentor user ID
  ├── _status meta ─────── Pending | Accepted | Rejected
  │
  └── mp_goal (via _mentorship_id → mp_request.ID)
        ├── _status ──────── Not Started | In Progress | Completed
        ├── _is_portfolio ── true/false (public portfolio flag)
        ├── _mentor_id ───── Optional per-goal mentor override
        ├── _mentee_id ───── Optional per-goal mentee override
        │
        ├── mp_initiative (via _goal_id → mp_goal.ID)
        │     └── _status
        │
        ├── mp_task (via _goal_id → mp_goal.ID)
        │     ├── _is_completed, _completed_date, _completed_by
        │     ├── _assigned_to, _due_date, _priority
        │     ├── _initiative_id ──── optional scoping to initiative
        │     └── _created_from_meeting_id ── link to source meeting
        │
        ├── mp_meeting (via _goal_id → mp_goal.ID)
        │     ├── _meeting_date, _meeting_link, _duration
        │     ├── _notes_json ─────── BlockNote JSON for rich notes
        │     ├── _agenda ─────────── JSON array of talking points
        │     ├── _decisions ──────── JSON array of decisions
        │     ├── _action_items ───── JSON array of action items
        │     ├── _follow_up ──────── JSON array of follow-up items
        │     ├── _recurring_pattern, _recurring_parent_id
        │     ├── _attendees ──────── JSON array of user IDs
        │     ├── _initiative_id ──── optional scoping to initiative
        │     └── media attachments via post_parent
        │
        └── mp_update (via _goal_id → mp_goal.ID)
              ├── _initiative_id ──── optional scoping to initiative
              └── media attachments via post_parent
```

### 4.3 Post Meta Reference

#### `mp_request`

| Meta Key | Type | Description |
|---|---|---|
| `_receiver_id` | int | Mentor's WordPress user ID (mentee is `post_author`) |
| `_status` | string | `"Pending"`, `"Accepted"`, or `"Rejected"` |

#### `mp_goal`

| Meta Key | Type | Description |
|---|---|---|
| `_mentorship_id` | int | FK → parent `mp_request` post ID |
| `_status` | string | `"Not Started"`, `"In Progress"`, `"Completed"` |
| `_is_portfolio` | boolean | If true, goal appears in public portfolio |
| `_mentor_id` | int | Optional per-goal mentor override (for participant reassignment) |
| `_mentee_id` | int | Optional per-goal mentee override |

#### `mp_initiative`

| Meta Key | Type | Description |
|---|---|---|
| `_goal_id` | int | FK → parent `mp_goal` post ID |
| `_status` | string | `"Not Started"`, `"In Progress"`, `"Completed"` |

#### `mp_task`

| Meta Key | Type | Description |
|---|---|---|
| `_goal_id` | int | FK → parent `mp_goal` post ID |
| `_is_completed` | boolean | Completion flag |
| `_completed_date` | datetime | Timestamp when marked complete |
| `_completed_by` | int | User ID who completed it |
| `_initiative_id` | int or null | Optional FK → `mp_initiative` |
| `_assigned_to` | int | User ID the task is assigned to |
| `_due_date` | string | Due date |
| `_priority` | string | `"low"`, `"medium"`, or `"high"` |
| `_created_from_meeting_id` | int | FK → `mp_meeting` that spawned this action item |
| *(built-in)* `menu_order` | int | Drag-drop sort order |

#### `mp_meeting`

| Meta Key | Type | Description |
|---|---|---|
| `_goal_id` | int | FK → parent `mp_goal` post ID |
| `_initiative_id` | int or null | Optional FK → `mp_initiative` |
| `_meeting_date` | string | Date of the meeting |
| `_meeting_link` | string | Virtual meeting URL |
| `_notes_json` | JSON | Structured rich-text notes (BlockNote editor JSON) |
| `_agenda` | JSON array | Talking points / agenda items |
| `_decisions` | JSON array | Decisions recorded during meeting |
| `_action_items` | JSON array | Action items created from meeting |
| `_follow_up` | JSON array | Follow-up items for next meeting |
| `_recurring_pattern` | string | `"none"`, `"weekly"`, `"biweekly"`, `"monthly"` |
| `_recurring_parent_id` | int or null | FK → parent `mp_meeting` for recurring series |
| `_duration` | int | Meeting duration in minutes |
| `_attendees` | JSON array | Array of attendee user IDs |

#### `mp_update`

| Meta Key | Type | Description |
|---|---|---|
| `_goal_id` | int | FK → parent `mp_goal` post ID |
| `_initiative_id` | int or null | Optional FK → `mp_initiative` |

---

## 5. User Profile System

Mentor profiles are powered by WordPress user meta. These fields are editable by each user and displayed in the Mentor Directory and profile views.

| Meta Key | Type | Description |
|---|---|---|
| `_tagline` | string | Short professional tagline |
| `_mentor_opt_in` | boolean | Whether user appears in the mentor directory |
| `_skills` | JSON string | Array of skill tags (e.g., `["Leadership", "Lifeguarding"]`) |
| `_bio_details` | HTML | Full biography (sanitized via `wp_kses_post`) |
| `_experience` | HTML | Professional experience |
| `_linkedin_url` | URL | LinkedIn profile link |
| `_booking_link` | URL | Calendar/booking link |
| `_custom_links` | JSON string | Array of `{ label, url }` objects |
| `_mentorship_notify_email` | boolean | Email notification preference |
| `mentorship_avatar_url` | URL | Custom avatar (falls back to Gravatar) |
| `_contact_email` | email | Preferred contact email (distinct from WP account email) |
| `_groupme_username` | string | GroupMe handle |
| `_signal_username` | string | Signal handle |
| `_telegram_username` | string | Telegram handle |

---

## 6. REST API Endpoints

All routes use namespace `mentorship-platform/v1`. Authentication via WordPress nonce unless noted.

### 6.1 User & Directory Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/mentors` | Public | List all opted-in mentors |
| GET | `/directory` | Public | Mentor directory with skills and pagination |
| GET | `/users/me` | Logged in | Get current user's full profile |
| GET | `/users/{id}` | Logged in | Get a specific user's profile |
| PUT | `/users/{id}` | Owner or admin | Update user profile fields |
| GET | `/users/list` | Logged in | Lightweight user list for dropdowns/selectors |

### 6.2 Mentorship Request Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/requests` | Logged in | Get all requests for current user (sent + received) |
| POST | `/requests` | Logged in | Create a new mentorship request |
| GET | `/requests/{id}` | Participant | Get full request details with all goals |
| PUT | `/requests/{id}/status` | Receiver only | Accept or reject a request |
| DELETE | `/requests/{id}` | Admin only | Delete mentorship and cascade-delete all children |

### 6.3 Goal Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/goals` | Participant | Create a new goal within a mentorship |
| PUT | `/goals/{id}` | Participant | Full-replacement update (initiatives, tasks, meetings synced) |
| PUT | `/goals/{id}/participants` | Admin / Tier 6+ | Reassign mentor and/or mentee on a specific goal |

### 6.4 Meeting Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/meetings` | Participant | Create a meeting within a goal |
| PUT | `/meetings/{id}` | Author or participant | Update meeting (topic, notes, agenda, decisions, etc.) |
| DELETE | `/meetings/{id}` | Author or participant | Delete a meeting |

### 6.5 Update Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/updates` | Participant | Post a progress update with optional attachments |
| PUT | `/updates/{id}` | Author or participant | Edit an update |
| DELETE | `/updates/{id}` | Author or participant | Delete an update |

### 6.6 Portfolio Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/portfolio/{user_id}` | Public | Get a user's public portfolio (goals with `_is_portfolio = true`) |
| GET | `/portfolio-directory` | Public | List all users who have public portfolio goals |

### 6.7 File Upload

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload` | Logged in | Upload a file to WordPress media library |

### 6.8 Admin Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/all-mentorships` | Admin | List all mentorship pairings |
| GET | `/admin/all-users` | Admin | List all users for admin dropdowns |
| GET | `/admin/users` | Admin | Get users with metadata and filters |
| POST | `/admin/users` | Admin | Create a new WordPress user |
| PUT | `/admin/users/{id}` | Admin | Update user details |
| DELETE | `/admin/users/{id}` | Admin | Delete a user |
| POST | `/admin/users/{id}/archive` | Admin | Archive a user |
| POST | `/admin/users/{id}/unarchive` | Admin | Unarchive a user |
| POST | `/admin/users/{id}/member-status` | Tier 6+ | Set member status |
| POST | `/admin/users/bulk-import` | Admin | Bulk import users from CSV |
| POST | `/admin/users/bulk-assign-job-role` | Admin | Bulk assign a job role to users |
| POST | `/admin/users/fix-display-names` | Admin | Utility: fix display name formatting |
| POST | `/admin/cache/clear` | Admin | Clear plugin caches |
| POST | `/admin/create-mentorship` | Admin | Create an auto-accepted mentorship pairing |
| GET | `/admin/mentorship-details/{id}` | Admin / Tier 5+ | Get full details for any mentorship |

### 6.9 Real-Time Polling

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/goal-changes` | Logged in | Poll for recent changes to goals (used by workspace for live updates) |

---

## 7. Permission Model

The mentorship module uses **relationship-based** permissions rather than the table-driven RBAC used by other AquaticPro modules.

### Access Rules

| Action | Who Can Do It |
|---|---|
| **Browse mentor directory** | Anyone (public) |
| **Send mentorship request** | Any logged-in user with platform access |
| **Accept/reject request** | Only the receiver (mentor) of that specific request |
| **View mentorship details** | Only the sender (mentee) or receiver (mentor) of the request |
| **Create/edit goals, tasks, meetings, updates** | Either participant in the mentorship |
| **Edit/delete a meeting or update** | The post author, or either mentorship participant |
| **Reassign goal participants** | WordPress admin or Tier 6+ |
| **Delete entire mentorship** | WordPress admin only |
| **Admin view any mentorship** | WordPress admin or Tier 5–6 |
| **View public portfolio** | Anyone (public) |

**Bypass:** Users with `manage_options` capability (WordPress administrators) bypass all permission checks.

**LearnDash integration:** If the `aquaticpro_learndash_groups` option is configured, platform access is restricted to users belonging to specified LearnDash groups.

---

## 8. Goal Update Sync Strategy

The `PUT /goals/{id}` endpoint uses a **full-replacement sync** pattern:

1. The React client sends the **entire goal payload** (all initiatives, tasks, and meetings).
2. The server diffs the incoming data against existing child posts:
   - **New items** (no ID or ID not found) → created as new CPT posts
   - **Existing items** (matching ID) → updated in place
   - **Missing items** (existing in DB but absent from payload) → deleted
3. Tasks preserve their `menu_order` for drag-drop ordering.
4. Initiative status changes trigger `mentorship_platform_pg_update_linked_module_progress()` if the Professional Growth module is enabled.

**Exception:** Updates (`mp_update`) are **not** part of the bulk sync. They have dedicated `POST/PUT/DELETE /updates` endpoints and are managed independently.

**Notifications:** Creating an update sends a batched email notification to the other participant via `add_mentorship_notification()`.

---

## 9. API Response Shapes

### UserProfile

```typescript
{
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  tagline: string;
  mentorOptIn: boolean;
  skills: string[];
  bioDetails: string;
  experience: string;
  linkedinUrl: string;
  bookingLink: string;
  customLinks: { label: string; url: string }[];
  notifyByEmail: boolean;
  tier: number | null;
  capabilities: { manage_options?: boolean };
  jobRoles: { id: number; title: string; tier: number }[];
  email: string;
  contactEmail: string;
  groupmeUsername: string;
  signalUsername: string;
  telegramUsername: string;
}
```

### MentorshipRequest

```typescript
{
  id: number;
  sender: UserProfile;       // The mentee (post_author)
  receiver: UserProfile;     // The mentor (_receiver_id)
  message: string;           // Request message (post_content)
  status: "Pending" | "Accepted" | "Rejected";
  requestDate: string;       // ISO 8601
  goals: Goal[];             // All goals under this mentorship
}
```

### Goal

```typescript
{
  id: number;
  title: string;
  description: string;
  status: "Not Started" | "In Progress" | "Completed";
  isPortfolio: boolean;
  mentor: UserProfile | null;   // From goal override or fallback to request
  mentee: UserProfile | null;
  commentCount: number;         // Comments on just the goal
  totalCommentCount: number;    // Comments across goal + meetings + updates
  initiatives: Initiative[];
  tasks: Task[];                // Ordered by menu_order ASC
  meetings: Meeting[];
  updates: Update[];            // Ordered by date DESC
  comments: [];                 // Always empty in list — fetched on demand
}
```

### Initiative

```typescript
{
  id: number;
  title: string;
  description: string;
  status: "Not Started" | "In Progress" | "Completed";
  comments: [];
}
```

### Task

```typescript
{
  id: number;
  text: string;
  isCompleted: boolean;
  initiativeId: number | null;
  completedDate?: string;              // ISO 8601
  completedBy?: { id: number; name: string };
  assignedTo?: number;
  assignedToName?: string;
  dueDate?: string;
  createdFromMeetingId?: number;
  priority?: "low" | "medium" | "high";
}
```

### Meeting

```typescript
{
  id: number;
  topic: string;
  date: string;                        // ISO 8601
  notes: string;                       // HTML from post_content
  notesJson: object | null;            // BlockNote JSON for rich editor
  initiativeId: number | null;
  meetingLink: string;
  author: UserProfile;
  commentCount: number;
  comments: [];
  agenda: TalkingPoint[];              // Structured agenda items
  decisions: Decision[];               // Recorded decisions
  actionItems: number[];               // Task IDs created as action items
  followUp: FollowUp[];               // Items for next meeting
  recurringPattern: "none" | "weekly" | "biweekly" | "monthly";
  recurringParentId: number | null;
  duration: number | null;             // Minutes
  attendees: number[];                 // User IDs
  attachments: Attachment[];           // Media files
}
```

### Update

```typescript
{
  id: number;
  author: UserProfile;
  text: string;                        // HTML content
  date: string;                        // ISO 8601
  initiativeId: number | null;
  attachments: Attachment[];
  commentCount: number;
}
```

---

## 10. React Component Structure

### 10.1 Component Hierarchy

```
App.tsx
 ├── MentorDirectory          ── Browse & search opted-in mentors
 │     └── MentorCard         ── Individual mentor card with skills
 │
 ├── MentorProfile            ── Full mentor profile page
 │
 ├── MentorshipDashboard      ── Relationship-level view (goal sidebar + workspace)
 │     ├── Goal sidebar       ── Select/add goals within the mentorship
 │     └── GoalWorkspace      ── The primary goal workspace
 │           ├── GoalHeaderCard      ── Title, description, status, portfolio toggle
 │           ├── InitiativesStrip    ── Horizontal strip of initiatives with filter
 │           ├── WorkspaceColumns    ── Columnar layout for tasks / meetings / updates
 │           │     ├── TaskCard      ── Individual task with checkbox, assignee, due date
 │           │     ├── MeetingCard   ── Meeting with topic, date, structured notes
 │           │     └── UpdatesFeed   ── Chronological update feed
 │           ├── MentorshipTimeline  ── Visual timeline rail of all activity
 │           ├── MobileDrawer        ── Slide-out panel for mobile
 │           ├── UpdateToast         ── Real-time change notification
 │           ├── GoalPrintView       ── Print-optimized layout
 │           └── CommentSection      ── Threaded comments (shared component)
 │
 ├── MyMentees                ── List of current user's mentees
 ├── MentorshipHistory        ── Past mentorship relationships
 ├── PortfolioPage            ── Public portfolio for a user
 ├── PortfolioDirectory       ── Browse users with public portfolios
 └── PendingRequestBanner     ── Notification banner for pending requests
```

### 10.2 Key Components

| Component | Lines | Description |
|---|---|---|
| **GoalWorkspace** | ~589 | Primary workspace for a single goal. State: `selectedInitiativeId` (filters content), `focusedItem` (timeline highlight), `mobileDrawer` panel. Features auto-save with debounce and real-time polling via `useGoalPolling` hook. |
| **MentorshipDashboard** | ~618 | Relationship-level dashboard. Manages goal selection, "Add Goal" modal, and delegates to `GoalWorkspace`. Includes aggregated save status indicator (`useSaveStatus`), debounced meeting/update saves with dirty tracking, and `beforeunload` warning for unsaved changes. |
| **MentorDirectory** | ~105 | Paginated, searchable directory of opted-in mentors. Filters by name and skill. Calls `getMentorDirectory` API. |
| **WorkspaceColumns** | — | Renders the columnar layout with tasks, meetings, and updates. Supports initiative-based filtering. |
| **MentorshipTimeline** | — | Visual timeline rail showing all goal activity in chronological order. |

### 10.3 Service Layer

The mentorship API client lives in `src/services/api.ts` and includes:

| Function | Endpoint | Purpose |
|---|---|---|
| `getMentorDirectory()` | GET `/directory` | Fetch mentor list with skills and pagination |
| `getMentors()` | GET `/mentors` | Fetch all opted-in mentors |
| `getCurrentUser()` | GET `/users/me` | Fetch current user's profile |
| `updateUserProfile()` | PUT `/users/{id}` | Update profile fields |
| `getMentorshipRequests()` | GET `/requests` | Fetch current user's requests |
| `createMentorshipRequest()` | POST `/requests` | Send a new request |
| `getMentorshipDetails()` | GET `/requests/{id}` | Fetch full mentorship with goals |
| `updateRequestStatus()` | PUT `/requests/{id}/status` | Accept or reject |
| `createGoal()` | POST `/goals` | Create a goal |
| `updateGoal()` | PUT `/goals/{id}` | Full-replacement goal sync |
| `createMeeting()` | POST `/meetings` | Create a meeting |
| `updateMeeting()` | PUT `/meetings/{id}` | Update meeting |
| `deleteMeeting()` | DELETE `/meetings/{id}` | Delete meeting |
| `createUpdate()` | POST `/updates` | Post a progress update |
| `updateUpdate()` | PUT `/updates/{id}` | Edit an update |
| `deleteUpdate()` | DELETE `/updates/{id}` | Delete an update |
| `uploadFile()` | POST `/upload` | Upload attachment to media library |
| `getPublicPortfolio()` | GET `/portfolio/{user_id}` | Fetch user's public portfolio |
| `getPortfolioDirectory()` | GET `/portfolio-directory` | List users with public portfolios |

---

## 11. Key Hooks & Integrations

### WordPress Hooks

| Hook | Purpose |
|---|---|
| `init` → `mentorship_platform_register_cpts()` | Register all 6 mentorship CPTs |
| `init` → `mentorship_platform_register_meta()` | Register user meta fields for REST API exposure |
| `rest_api_init` → `mentorship_platform_register_api_routes()` | Register all REST API endpoints |

### Cross-Module Integration

| Integration Point | Description |
|---|---|
| **Professional Growth** | Initiative status changes trigger `mentorship_platform_pg_update_linked_module_progress()` to update promotion criteria progress. |
| **Email Notifications** | Creating updates sends batched email to the other participant via `add_mentorship_notification()`. |
| **Goal Changes Polling** | `GET /goal-changes` endpoint allows the workspace to poll for real-time changes made by the other participant. |
| **Admin Panel** | Admin routes allow Tier 5–6 users to view, create, and manage any mentorship in the system. |

---

## 12. Portfolio System

Goals can be flagged as **portfolio items** (`_is_portfolio = true`), making them publicly visible.

- `GET /portfolio/{user_id}` — Returns all portfolio-flagged goals for a user (publicly accessible).
- `GET /portfolio-directory` — Lists users who have at least one portfolio goal. Excludes archived users.
- **PortfolioPage** component renders the public view of a user's completed goals.
- **PortfolioDirectory** component provides a browsable directory of showcased portfolios.

---

## 13. Source File Map

| File | Purpose |
|---|---|
| `mentorship-platform.php` (lines 1934–2080) | CPT registration for all 6 mentorship post types |
| `mentorship-platform.php` (lines 2360–2465) | User meta registration |
| `includes/api-routes.php` | All 32 REST API endpoints + callback functions (~4,383 lines) |
| `src/services/api.ts` | React API client for mentorship operations |
| `src/types.ts` | TypeScript interfaces (Goal, Meeting, Task, Update, etc.) |
| `src/components/MentorDirectory.tsx` | Mentor browsing & search |
| `src/components/MentorCard.tsx` | Individual mentor card |
| `src/components/MentorProfile.tsx` | Full mentor profile view |
| `src/components/MentorshipDashboard.tsx` | Relationship-level dashboard |
| `src/components/GoalWorkspace.tsx` | Goal workspace (primary UI) |
| `src/components/GoalHeaderCard.tsx` | Goal header with status/portfolio toggle |
| `src/components/GoalDisplay.tsx` | Goal display/read view |
| `src/components/GoalPrintView.tsx` | Print-optimized goal view |
| `src/components/WorkspaceColumns.tsx` | Task/meeting/update column layout |
| `src/components/MeetingCard.tsx` | Meeting card component |
| `src/components/InitiativesStrip.tsx` | Initiative filtering strip |
| `src/components/UpdatesFeed.tsx` | Chronological updates feed |
| `src/components/MentorshipTimeline.tsx` | Visual activity timeline |
| `src/components/MentorshipHistory.tsx` | Past mentorship view |
| `src/components/MyMentees.tsx` | Current mentees list |
| `src/components/PortfolioPage.tsx` | Public portfolio page |
| `src/components/PortfolioDirectory.tsx` | Portfolio directory browser |
| `src/components/PendingRequestBanner.tsx` | Pending request notification |
| `src/components/CommentSection.tsx` | Shared threaded comments |
| `src/components/BlockEditor.tsx` | BlockNote rich text editor |
| `src/components/RichTextEditor.tsx` | Rich text editor wrapper |
