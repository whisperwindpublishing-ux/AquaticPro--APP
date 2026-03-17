# PRD: Course Builder Module

## Overview
A hierarchical course management system with a dynamic canvas-based content editor for creating and viewing online courses within the mentorship platform.

## Key Features

### 1. Hierarchy Structure
- **Courses** → **Sections** → **Lessons** → **Topics**
- Each level can have a title, description, image/thumbnail, and display order
- Clicking an item drills down to show its children (single-page, no reload)
- Breadcrumb navigation with animated transitions

### 2. Canvas Grid Editor (Topics)
- 12-column responsive grid layout
- Drag-and-drop card placement
- Cards can span multiple rows/columns
- Card types:
  - **Image** - Static images with fit options (cover/contain)
  - **Video** - Embedded video with autoplay/loop options
  - **GIF** - Animated images
  - **Text** - Rich text with formatting (headings, bullets, bold, italic, horizontal rules)
  - **Spacer** - Empty space for layout purposes
  - **Embed** - External content embeds

### 3. Edit/View Toggle
- Single toggle button switches between edit and view modes
- View mode: Clean display for learners
- Edit mode: Grid overlay, drag handles, resize controls

### 4. Mobile Layout
- Header image/video pinned at top
- Cards stacked full-width below
- Order determined by grid position (top-to-bottom, left-to-right)

### 5. Permissions System
- Default access: Tier 6+ and WordPress admins
- Granular permissions by job role:
  - `can_view` - View courses assigned to their roles
  - `can_edit` - Create/edit courses, sections, lessons, topics
  - `can_manage` - Full admin (assign courses to roles, manage permissions)

### 6. Role-based Course Assignment
- Assign courses to specific job roles
- Users see only courses assigned to their role(s)
- Admins can see all courses

---

## Database Schema

### Table: `mp_cb_courses`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| title | VARCHAR(255) | Course title |
| description | TEXT | Course description |
| image_url | TEXT | Cover image URL |
| display_order | INT | Sort order |
| status | ENUM('draft', 'published', 'archived') | Publication status |
| created_by | BIGINT UNSIGNED | User who created |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Table: `mp_cb_sections`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| course_id | BIGINT UNSIGNED | FK to courses |
| title | VARCHAR(255) | Section title |
| description | TEXT | Section description |
| image_url | TEXT | Cover image URL |
| display_order | INT | Sort order within course |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Table: `mp_cb_lessons`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| section_id | BIGINT UNSIGNED | FK to sections |
| title | VARCHAR(255) | Lesson title |
| description | TEXT | Lesson description |
| image_url | TEXT | Cover image URL |
| display_order | INT | Sort order within section |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Table: `mp_cb_topics`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| lesson_id | BIGINT UNSIGNED | FK to lessons |
| title | VARCHAR(255) | Topic title |
| header_image_url | TEXT | Header/featured image |
| display_order | INT | Sort order within lesson |
| grid_cols | INT | Grid columns (default 12) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Table: `mp_cb_cards`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| topic_id | BIGINT UNSIGNED | FK to topics |
| card_type | ENUM('image', 'video', 'gif', 'text', 'spacer', 'embed') | Type of card |
| grid_x | INT | X position in grid (0-11) |
| grid_y | INT | Y position in grid |
| grid_w | INT | Width in grid columns |
| grid_h | INT | Height in grid rows |
| content | LONGTEXT | JSON content data |
| display_order | INT | Fallback order for mobile |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Table: `mp_cb_permissions`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| job_role_id | BIGINT UNSIGNED | FK to job roles |
| can_view | TINYINT(1) | Can view courses |
| can_edit | TINYINT(1) | Can edit courses |
| can_manage | TINYINT(1) | Full admin access |

### Table: `mp_cb_course_assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT UNSIGNED | Primary key |
| course_id | BIGINT UNSIGNED | FK to courses |
| job_role_id | BIGINT UNSIGNED | FK to job roles |
| assigned_at | DATETIME | Assignment timestamp |
| assigned_by | BIGINT UNSIGNED | User who assigned |

---

## API Endpoints

### Courses
- `GET /courses` - List all courses (filtered by permissions)
- `GET /courses/{id}` - Get single course with sections
- `POST /courses` - Create course
- `PUT /courses/{id}` - Update course
- `DELETE /courses/{id}` - Delete course

### Sections
- `GET /courses/{id}/sections` - List sections in course
- `POST /sections` - Create section
- `PUT /sections/{id}` - Update section
- `DELETE /sections/{id}` - Delete section
- `PUT /sections/reorder` - Reorder sections

### Lessons
- `GET /sections/{id}/lessons` - List lessons in section
- `POST /lessons` - Create lesson
- `PUT /lessons/{id}` - Update lesson
- `DELETE /lessons/{id}` - Delete lesson
- `PUT /lessons/reorder` - Reorder lessons

### Topics
- `GET /lessons/{id}/topics` - List topics in lesson
- `POST /topics` - Create topic
- `PUT /topics/{id}` - Update topic
- `DELETE /topics/{id}` - Delete topic
- `PUT /topics/reorder` - Reorder topics

### Cards
- `GET /topics/{id}/cards` - List cards in topic
- `POST /cards` - Create card
- `PUT /cards/{id}` - Update card (content and position)
- `DELETE /cards/{id}` - Delete card
- `PUT /cards/layout` - Batch update card positions

### Permissions
- `GET /courses/permissions` - Get all permissions
- `PUT /courses/permissions` - Update permissions
- `GET /courses/access` - Check current user's access level

### Assignments
- `GET /courses/{id}/assignments` - Get course role assignments
- `PUT /courses/{id}/assignments` - Update course role assignments

---

## React Components

### Main Components
- `CourseBuilder.tsx` - Main container with edit/view toggle
- `CourseHierarchy.tsx` - Hierarchy navigator (courses → sections → lessons → topics)
- `TopicCanvas.tsx` - Grid canvas editor for topic content
- `CoursePermissions.tsx` - Permissions management UI

### Card Components (in `src/components/course-builder/cards/`)
- `ImageCard.tsx` - Image display with upload
- `VideoCard.tsx` - Video embed with controls
- `GifCard.tsx` - GIF display
- `TextCard.tsx` - Rich text with TipTap editor
- `SpacerCard.tsx` - Empty spacer
- `EmbedCard.tsx` - External embeds
- `CardWrapper.tsx` - Common wrapper with drag/resize handles

### Utility Components
- `CardToolbar.tsx` - Card type selector and actions
- `GridOverlay.tsx` - Visual grid for editing mode
- `BreadcrumbNav.tsx` - Hierarchy breadcrumbs
- `RoleAssignments.tsx` - Course-to-role assignment UI

---

## UI/UX Design

### Animation Strategy (Framer Motion)
1. **Hierarchy transitions**: Slide/fade when drilling down/up
2. **Card interactions**: Scale on hover, spring physics on drag
3. **Expand/collapse**: Smooth height animations
4. **Mode toggle**: Crossfade between edit/view states

### Styling
- Consistent with existing platform (Tailwind CSS)
- Glassmorphism cards with subtle shadows
- Color-coded hierarchy levels
- Edit mode: Grid overlay, drag handles visible
- View mode: Clean, distraction-free

---

## Implementation Phases

### Phase 1: Foundation
- Database tables and API routes
- Basic CRUD for courses, sections, lessons, topics
- Permissions system
- Sidebar navigation

### Phase 2: Hierarchy Navigator
- Course/section/lesson/topic list views
- Drill-down navigation with animations
- Edit/view mode toggle
- Breadcrumb navigation

### Phase 3: Canvas Editor
- Grid layout system
- Basic card types (image, text, spacer)
- Drag and drop positioning
- Resize functionality

### Phase 4: Advanced Cards
- Video cards with player controls
- GIF support
- Rich text editor integration
- Embed cards

### Phase 5: Polish
- Mobile responsive view
- Role assignments UI
- Performance optimization
- Full animation suite

---

## Dependencies

### New NPM Packages
- `react-grid-layout` - Grid positioning and resizing
- `framer-motion` - Animations
- `@dnd-kit/core` - Drag and drop (hierarchy reordering)
- `@tiptap/react` - Rich text editor (if not using existing BlockNote)

---

## Technical Notes

### Card Content JSON Schemas

**Image Card:**
```json
{
  "url": "string",
  "alt": "string",
  "fit": "cover|contain",
  "link": "string (optional)"
}
```

**Video Card:**
```json
{
  "url": "string",
  "autoplay": "boolean",
  "loop": "boolean",
  "muted": "boolean",
  "poster": "string (optional)"
}
```

**Text Card:**
```json
{
  "content": "TipTap/BlockNote JSON"
}
```

**Embed Card:**
```json
{
  "html": "string",
  "url": "string"
}
```

---

## Success Criteria

1. ✅ Users can navigate course hierarchy without page reloads
2. ✅ Editors can drag-and-drop cards on a visual grid
3. ✅ Cards resize to span multiple columns/rows
4. ✅ Edit/view toggle works seamlessly
5. ✅ Permissions restrict access by role
6. ✅ Courses can be assigned to specific roles
7. ✅ Mobile view stacks content appropriately
8. ✅ Animations feel fluid and natural
