# PRD: Assigned Learning System

## Overview
A system for learning editors to assign lessons (with quizzes) to staff members, track completion, and send email notifications — all integrated with the existing LMS, Job Roles, and TaskDeck systems.

---

## User Stories

1. **As a learning editor**, I can create a new lesson (or select an existing one) and assign it to specific users or entire job roles.
2. **As a learning editor**, I can set a due date for the assignment and optionally create a TaskDeck card so the assignment appears in staff task boards.
3. **As a learning editor**, I can view a dashboard showing who has started, completed, or missed their assigned lessons and their quiz scores.
4. **As a learning editor**, I can send reminder emails to users who haven't completed their assignment.
5. **As a staff member**, I receive an email with a direct link to my assigned lesson and its quiz.
6. **As a staff member**, I can see my assigned lessons in the LMS with their due dates.

---

## Architecture

### New Database Table: `wp_aquaticpro_learning_assignments`

```sql
CREATE TABLE {prefix}aquaticpro_learning_assignments (
    id              BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lesson_id       BIGINT(20) UNSIGNED NOT NULL,          -- FK → aquaticpro_lessons.id
    assigned_by     BIGINT(20) UNSIGNED NOT NULL,          -- WP user who created the assignment
    title           VARCHAR(255) NOT NULL,                 -- Assignment title (may differ from lesson)
    description     TEXT,                                  -- Optional instructions/context
    due_date        DATETIME DEFAULT NULL,                 -- Target completion date
    status          ENUM('draft','active','closed') DEFAULT 'draft',
    taskdeck_card_id BIGINT(20) UNSIGNED DEFAULT NULL,     -- FK → aqp_taskcards.card_id (optional)
    reminder_sent_at DATETIME DEFAULT NULL,                -- Last time a bulk reminder was sent
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_lesson_id (lesson_id),
    KEY idx_assigned_by (assigned_by),
    KEY idx_status (status),
    KEY idx_due_date (due_date)
) {charset_collate};
```

### New Database Table: `wp_aquaticpro_learning_assignment_users`

```sql
CREATE TABLE {prefix}aquaticpro_learning_assignment_users (
    id              BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assignment_id   BIGINT(20) UNSIGNED NOT NULL,          -- FK → learning_assignments.id
    user_id         BIGINT(20) UNSIGNED NOT NULL,          -- WP user receiving the assignment
    source          ENUM('direct','role') DEFAULT 'direct',-- How they were added
    source_role_id  BIGINT(20) UNSIGNED DEFAULT NULL,      -- Which job role (if source='role')
    email_sent_at   DATETIME DEFAULT NULL,                 -- When initial email was sent
    email_status    ENUM('pending','sent','failed') DEFAULT 'pending',
    reminder_sent_at DATETIME DEFAULT NULL,                -- When last reminder was sent
    progress_status ENUM('not-started','in-progress','completed') DEFAULT 'not-started',
    quiz_score      FLOAT DEFAULT NULL,                    -- Captured from progress record
    started_at      DATETIME DEFAULT NULL,
    completed_at    DATETIME DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_assignment_user (assignment_id, user_id),
    KEY idx_assignment_id (assignment_id),
    KEY idx_user_id (user_id),
    KEY idx_progress_status (progress_status),
    KEY idx_email_status (email_status)
) {charset_collate};
```

### Why Two Tables?

The **assignment** is the "campaign" — one lesson, one due date, one creator.  
The **assignment_users** are the individual recipients with their own email + progress tracking.

This allows: selecting 3 roles + 5 individual users → N user rows are created (de-duplicated). Progress syncs from the existing `aquaticpro_progress` table via cron or on-read.

---

## REST API Endpoints

All under namespace `aquaticpro/v1`, permission = `check_can_edit` (learning editors).

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/learning-assignments` | List assignments (filterable by status) |
| `GET` | `/learning-assignments/{id}` | Get assignment with all user progress |
| `POST` | `/learning-assignments` | Create new assignment |
| `PUT` | `/learning-assignments/{id}` | Update assignment (title, due date, status) |
| `DELETE` | `/learning-assignments/{id}` | Delete assignment + user rows |
| `POST` | `/learning-assignments/{id}/send` | Activate: resolve users, queue emails, optionally create TaskDeck card |
| `POST` | `/learning-assignments/{id}/remind` | Send reminder to incomplete users |
| `GET` | `/learning-assignments/{id}/progress` | Detailed progress + quiz scores per user |
| `GET` | `/my-assignments` | Current user's pending assigned lessons (any logged-in user) |

### POST `/learning-assignments` — Create

```json
{
    "lessonId": 42,
    "title": "Summer Safety Refresher",
    "description": "Complete before pool opens",
    "dueDate": "2026-06-01T00:00:00",
    "jobRoleIds": [3, 7],          // Assign to all active users in these roles
    "userIds": [15, 23, 44],       // Assign to specific users
    "createTaskDeckCard": true,    // Create a TaskDeck card for tracking
    "taskDeckListId": 5            // Which TaskDeck list to put the card in
}
```

### POST `/learning-assignments/{id}/send` — Activate & Send

1. Resolves `jobRoleIds` → active (non-archived) users with those roles
2. Merges with explicit `userIds`, de-duplicates
3. Creates `learning_assignment_users` rows
4. Sets assignment `status = 'active'`
5. Queues emails in batches (10 per cron tick, every 15 minutes via existing `mentorship_process_notification_queue` pattern)
6. Optionally creates a TaskDeck card with checklist items

### POST `/learning-assignments/{id}/remind` — Send Reminders

1. Finds all `assignment_users` where `progress_status != 'completed'`
2. Queues reminder emails (same batch pattern)
3. Updates `reminder_sent_at` on the assignment

---

## Email Design

### Initial Assignment Email

**Subject:** `📚 New Training Assigned: {title}`  
**Body:**
- Assignment title and description
- Due date (if set)
- Direct link: `{site_url}/learning/?lesson={lessonId}&assignment={assignmentId}`
- "Start Lesson" CTA button

### Reminder Email

**Subject:** `⏰ Reminder: {title} — due {dueDate}`  
**Body:**
- Reminder that the lesson hasn't been completed
- Current progress status
- Due date urgency
- Same direct link + CTA

### Email Batching

Uses the existing 15-minute cron (`mentorship_process_notification_queue`). New entries go into a `wp_aquaticpro_email_queue` table:

```sql
CREATE TABLE {prefix}aquaticpro_email_queue (
    id          BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT(20) UNSIGNED NOT NULL,
    email_type  VARCHAR(50) NOT NULL,           -- 'learning_assignment', 'learning_reminder'
    subject     VARCHAR(255) NOT NULL,
    body        LONGTEXT NOT NULL,
    context_id  BIGINT(20) UNSIGNED DEFAULT NULL, -- assignment_id for reference
    status      ENUM('pending','sent','failed') DEFAULT 'pending',
    attempts    TINYINT DEFAULT 0,
    sent_at     DATETIME DEFAULT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_status (status),
    KEY idx_email_type (email_type)
) {charset_collate};
```

**Cron processor**: Picks up 10 `pending` emails per tick, calls `wp_mail()`, marks `sent`/`failed`, increments `attempts` (max 3 retries).

---

## Progress Sync

When a user views `/my-assignments`, the API cross-references `aquaticpro_progress` for the lesson:
- If `progress.status = 'completed'` → update `assignment_users.progress_status`, `completed_at`, `quiz_score`
- If `progress.status = 'in-progress'` → update `assignment_users.progress_status`, `started_at`

This **sync-on-read** approach avoids needing extra hooks in the progress update flow. A lightweight cron job can also sweep every 6 hours to catch stragglers.

---

## TaskDeck Integration

When `createTaskDeckCard = true`:
1. Creates a card in the specified `taskDeckListId` with:
   - `title`: Assignment title
   - `description`: "Complete the assigned lesson: {lessonTitle}"
   - `due_date`: Assignment due date
   - `assigned_to_role_id`: First selected job role (if roles were selected)
   - `created_by`: The learning editor
2. Creates checklist items on the card — one per assigned user: `"{userName} — Complete Lesson"`
3. Stores the `card_id` on the assignment for cross-reference
4. As users complete, the progress sync can auto-check their checklist items

---

## Frontend Components

### 1. `AssignedLearningManager` (Editor View)

Tab in the LMS module alongside Courses, Lessons, Analytics. Contains:

- **Assignment list table**: Title, lesson, due date, status, progress bar (X/Y completed), actions
- **Create/Edit modal**: Lesson picker, role/user selector, due date, TaskDeck toggle
- **Detail view**: Per-user progress table with: name, status badge, quiz score, started/completed dates, email status

### 2. `AssignmentWizard` (Create Flow)

Step 1: Select or create a lesson (picker from existing + "Create New")  
Step 2: Select recipients — job role multi-select + user search/select  
Step 3: Set due date, description, TaskDeck options  
Step 4: Review & Send

### 3. `MyAssignments` (Staff View)

Banner or section in the LMS showing "Your Assigned Learning":
- Card per assignment with: title, due date countdown, progress, "Continue" button
- Visual urgency (yellow = due soon, red = overdue)

### 4. Lesson Toggle: "Assignable"

In the lesson editor sidebar, a toggle to mark a lesson as available for assignment. When ON, the lesson appears in the assignment lesson picker. All lesson types work (content, hybrid, excalidraw, quiz). Lessons with embedded quizzes get score tracking automatically.

---

## Permission Model

Reuses existing LMS permission checks:
- **Creating/managing assignments**: `canEditCourses` OR `canModerateAll` (same as lesson editing)
- **Viewing own assignments**: Any logged-in user
- **Viewing all assignment analytics**: `canViewAnalytics` OR `canModerateAll`

New permission flag (optional, future): `canAssignLearning` in `pg_lms_permissions` table.

---

## Implementation Phases

### Phase 1: Database + API (Backend)
- Create 3 new tables: `learning_assignments`, `learning_assignment_users`, `email_queue`
- Implement all REST endpoints
- Email queue cron processor
- Progress sync logic

### Phase 2: Editor UI (Frontend)
- `AssignedLearningManager` component in LMS module
- `AssignmentWizard` create flow
- Assignment detail view with progress table

### Phase 3: Staff Experience
- `MyAssignments` component / banner in LMS
- Direct lesson link handling (`?assignment=X`)
- Progress auto-sync on lesson completion

### Phase 4: TaskDeck Integration
- Auto-create TaskDeck card on send
- Checklist item creation per user
- Auto-check on completion

### Phase 5: Reminders & Polish
- Reminder email sending
- Overdue visual indicators
- Assignment close/archive flow
- Email template customization
