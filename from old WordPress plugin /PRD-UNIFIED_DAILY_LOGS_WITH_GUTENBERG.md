# PRD: Unified Daily Logs with Gutenberg-Style Editor

**Version**: 2.0  
**Date**: November 13, 2025  
**Status**: ⚠️ OUTDATED - Implementation complete. See PRD-AQUATICPRO-REBRANDING-AND-UX-OVERHAUL.md (Nov 17, 2025)  

---

## Executive Summary

**Goal**: Create a unified Daily Log system within the mentorship platform that:
1. Uses a **full Gutenberg-style block editor** (in React, not WordPress backend)
2. **Auto-groups entries** by Location → Day → Time Slot → Role
3. Supports **multi-slot entries** (morning+midday+evening combined)
4. Leverages **existing job roles** from your Professional Growth module
5. Displays as a **blog-style list** with comments and reactions (thumbs up/down)
6. **Keeps users out of WordPress admin** entirely
7. **Architecture allows future migration** to standalone app

**Tech Stack**:
- Frontend: React + **TipTap (Gutenberg-equivalent)** or **BlockNote**
- Backend: WordPress REST API (for now, easily portable)
- Comments: WordPress native or BuddyBoss (portable to standalone)
- Job Roles: Use existing `wp_pg_job_roles` table

**Timeline**: 3–4 weeks  
**Complexity**: Medium (block editor integration, grouping logic)

---

## Requirements

### Functional Requirements

#### 1. Block Editor (Gutenberg-style)
- [ ] Rich text editor with blocks (paragraph, heading, list, image, video, embed, etc.)
- [ ] Drag-and-drop reordering
- [ ] Slash commands (e.g., `/image`, `/heading`)
- [ ] Markdown shortcuts (e.g., `##` for heading, `*` for bullet)
- [ ] Image upload with drag-and-drop
- [ ] Embed support (YouTube, Twitter, etc.)
- [ ] Code blocks with syntax highlighting
- [ ] Quote blocks
- [ ] Dividers, spacers
- [ ] Save as draft or publish

**Recommendation**: Use **BlockNote** (MIT license, React-first, Gutenberg-like)  
Alternative: TipTap with custom block extensions (more work but more control)

#### 2. Daily Log Creation Flow

**User Journey**:
1. User clicks "New Daily Log" in React app
2. Form appears with:
   - **Location**: Dropdown (from Locations taxonomy)
   - **Date**: Date picker (defaults to today, can backdate)
   - **Time Slots**: Multi-select checkboxes (Morning, Midday, Evening, or "All Day")
   - **Role**: Dropdown (from existing job roles table: Head Guard, Pool Manager, etc.)
   - **Title**: Optional short title (e.g., "Busy shift at Mitchell")
   - **Content**: Block editor (Gutenberg-style)
3. User writes entry using blocks (text, images, lists, etc.)
4. User clicks "Publish" → Log saved with metadata
5. Log appears in blog-style list, grouped by Location → Day → Time Slot → Role

#### 3. Automatic Grouping & Display

**Grouping Hierarchy**:
```
Mitchell Pool
├── January 15, 2025
│   ├── Morning (7am–12pm)
│   │   ├── [Head Guard] John Doe — "Morning shift notes"
│   │   └── [Concessions Manager] Jane Smith — "Busy morning"
│   ├── Midday (12pm–5pm)
│   │   └── [Pool Manager] Mike Johnson — "Afternoon operations"
│   └── Evening (5pm–10pm)
│       └── [Head Guard] John Doe — "Evening close"
└── January 16, 2025
    └── All Day
        └── [Pool Manager] Sarah Lee — "Full day event coverage"
```

**Display Features**:
- Accordion/collapsible sections for each day
- Color-coded by role (Head Guard = blue, Pool Manager = green, etc.)
- Avatar + name + role badge for each entry
- Timestamp (when published)
- Preview (first 100 words + "Read more" link)
- Comment count + reaction counts visible on card

#### 4. Blog-Style Features

- [ ] **Comments**: Nested threaded comments (like blog posts)
- [ ] **Reactions**: Thumbs up / thumbs down (or emoji reactions)
- [ ] **Sharing**: Share link to specific log entry
- [ ] **Tagging**: Optional tags (e.g., #incident, #maintenance, #training)
- [ ] **Search**: Full-text search across all logs
- [ ] **Filters**: Filter by location, date range, role, author, tags
- [ ] **Notifications**: Notify team when new log posted at their location

#### 5. Role Integration

- Use existing `wp_pg_job_roles` table (id, name, description, tier)
- When user creates log, dropdown shows their assigned roles
- Support multiple roles per user (e.g., Head Guard + Instructor)
- Role badge displayed next to author name in log list

#### 6. Multi-Slot Entries

- User can select multiple time slots (e.g., Morning + Midday)
- Log appears under both slots in the grouped view
- Display badge: "Morning + Midday Shift"

---

## Architecture

### Data Model (Enhanced from previous PRD)

```sql
-- Use existing wp_posts for Daily Logs
wp_posts
├── ID → primary key
├── post_title → "Busy shift at Mitchell" (optional)
├── post_content → JSON string of block editor content (or HTML)
├── post_author → User ID
├── post_date → NOW() (publish time)
├── post_status → 'publish', 'draft'
└── post_type → 'mp_daily_log' (NEW CPT)

-- Post metadata
wp_postmeta
├── _location_id → Term ID from mp_location taxonomy
├── _log_date → YYYY-MM-DD (actual date of log, can be backdated)
├── _time_slots → JSON array: ["morning", "midday", "evening"] or ["all_day"]
├── _job_role_id → FK to wp_pg_job_roles.id
├── _tags → JSON array of tag strings
├── _blocks_json → Serialized block editor state (for editing)

-- Use existing wp_pg_job_roles (no changes needed)
wp_pg_job_roles
├── id
├── name → "Head Guard", "Pool Manager", etc.
├── description
└── tier

-- Comments (use WordPress native or BuddyBoss)
wp_comments
├── comment_ID
├── comment_post_ID → FK to wp_posts.ID
├── comment_author → Name
├── user_id → User ID (if logged in)
├── comment_content → Comment text
└── comment_date

-- Reactions (new custom table)
wp_mp_daily_log_reactions
├── id
├── log_id → FK to wp_posts.ID
├── user_id → FK to wp_users.ID
├── reaction_type → 'thumbs_up', 'thumbs_down', 'heart', 'celebrate', etc.
├── created_at
└── UNIQUE(log_id, user_id, reaction_type) -- One reaction per type per user
```

### Block Editor Choice: BlockNote vs. TipTap

| Feature | BlockNote | TipTap + Extensions |
|---------|-----------|---------------------|
| Out-of-box blocks | ✅ Paragraph, heading, list, image, video, code, quote | ⚠️ Need to build each block type |
| Slash commands | ✅ Built-in | ⚠️ Need extension |
| Drag-and-drop | ✅ Built-in | ⚠️ Need @dnd-kit integration |
| Markdown shortcuts | ✅ Built-in | ⚠️ Need extension |
| Learning curve | ✅ Low (Notion-like API) | ⚠️ Medium-High |
| Customization | ⚠️ Limited to provided blocks | ✅ Full control |
| Bundle size | ~150KB gzip | ~80KB gzip (base) |
| License | MIT | MIT |
| Production ready | ✅ Yes (v0.15+) | ✅ Yes |

**Recommendation: BlockNote** (faster to ship, Gutenberg-like UX, less code to maintain)

If you need custom blocks later (e.g., "Incident Report" block), you can extend BlockNote or migrate to TipTap.

---

## Implementation Plan

### Phase 1: Block Editor Integration (Week 1)

#### Task 1.1: Install BlockNote

```bash
cd /home/deck/Documents/Apps/mentorship-platform
npm install @blocknote/core @blocknote/react
```

#### Task 1.2: Create BlockEditor Component

**File**: `src/components/BlockEditor.tsx`

```tsx
import React, { useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/react/style.css';

interface BlockEditorProps {
  initialContent?: any; // Block editor JSON
  onChange: (content: any) => void;
  editable?: boolean;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  initialContent,
  onChange,
  editable = true,
}) => {
  const editor = useCreateBlockNote({
    initialContent: initialContent,
  });

  const handleChange = () => {
    const blocks = editor.document;
    onChange(blocks);
  };

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      editable={editable}
      theme="light" // or "dark"
    />
  );
};

export default BlockEditor;
```

**Usage**:
```tsx
const [content, setContent] = useState(null);

<BlockEditor 
  initialContent={content} 
  onChange={setContent} 
/>
```

**Deliverable**: BlockEditor component working; can type, format, add blocks

---

#### Task 1.3: Add Image Upload Support

BlockNote supports image upload via custom callback:

```tsx
const editor = useCreateBlockNote({
  uploadFile: async (file: File) => {
    // Upload to WordPress Media Library
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await uploadFile(formData); // Your existing API function
    return response.url; // Return URL of uploaded file
  },
});
```

**Deliverable**: Users can drag-and-drop images into editor; images upload to WP Media Library

---

### Phase 2: Daily Log Data Model (Week 1)

#### Task 2.1: Register New CPT: mp_daily_log

**In `mentorship-platform.php`**:

```php
// Register Daily Log CPT
add_action('init', function() {
  register_post_type('mp_daily_log', array(
    'label'         => 'Daily Logs',
    'public'        => false,
    'show_ui'       => false, // Hide from WP admin
    'show_in_rest'  => true,  // Enable REST API
    'supports'      => array('title', 'editor', 'author', 'comments'),
    'capability_type' => 'post',
  ));
  
  // Register metadata
  register_post_meta('mp_daily_log', '_location_id', array(
    'type'         => 'integer',
    'single'       => true,
    'show_in_rest' => true,
  ));
  
  register_post_meta('mp_daily_log', '_log_date', array(
    'type'         => 'string',
    'single'       => true,
    'show_in_rest' => true,
  ));
  
  register_post_meta('mp_daily_log', '_time_slots', array(
    'type'         => 'string', // JSON array
    'single'       => true,
    'show_in_rest' => true,
  ));
  
  register_post_meta('mp_daily_log', '_job_role_id', array(
    'type'         => 'integer',
    'single'       => true,
    'show_in_rest' => true,
  ));
  
  register_post_meta('mp_daily_log', '_tags', array(
    'type'         => 'string', // JSON array
    'single'       => true,
    'show_in_rest' => true,
  ));
  
  register_post_meta('mp_daily_log', '_blocks_json', array(
    'type'         => 'string', // Serialized BlockNote JSON
    'single'       => true,
    'show_in_rest' => true,
  ));
});
```

**Deliverable**: CPT registered; metadata fields available in REST API

---

#### Task 2.2: Create Reactions Table

**Migration script**: `scripts/create-reactions-table.php`

```php
<?php
global $wpdb;

$table_name = $wpdb->prefix . 'mp_daily_log_reactions';
$charset_collate = $wpdb->get_charset_collate();

$sql = "CREATE TABLE IF NOT EXISTS $table_name (
  id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  log_id bigint(20) UNSIGNED NOT NULL,
  user_id bigint(20) UNSIGNED NOT NULL,
  reaction_type varchar(50) NOT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY log_user_reaction (log_id, user_id, reaction_type),
  KEY log_id (log_id),
  KEY user_id (user_id)
) $charset_collate;";

require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
dbDelta($sql);

echo "Reactions table created successfully!";
```

Run once:
```bash
wp eval-file scripts/create-reactions-table.php
```

**Deliverable**: Reactions table created

---

### Phase 3: REST API Endpoints (Week 1–2)

#### Task 3.1: Create Daily Log Endpoint

**In `includes/api-routes.php`**:

```php
// POST /mentorship-platform/v1/daily-logs - Create new daily log
register_rest_route('mentorship-platform/v1', '/daily-logs', array(
  'methods'  => WP_REST_Server::CREATABLE,
  'callback' => 'mp_create_daily_log',
  'permission_callback' => 'mentorship_platform_check_access_permission',
  'args' => array(
    'title'        => array('type' => 'string', 'required' => false),
    'blocks_json'  => array('type' => 'string', 'required' => true), // BlockNote JSON
    'location_id'  => array('type' => 'integer', 'required' => true),
    'log_date'     => array('type' => 'string', 'required' => true, 'format' => 'date'),
    'time_slots'   => array('type' => 'array', 'required' => true), // ["morning", "midday"]
    'job_role_id'  => array('type' => 'integer', 'required' => true),
    'tags'         => array('type' => 'array', 'required' => false),
    'status'       => array('type' => 'string', 'default' => 'publish', 'enum' => ['publish', 'draft']),
  ),
));

function mp_create_daily_log($request) {
  $current_user_id = get_current_user_id();
  if (!$current_user_id) {
    return new WP_REST_Response(array('error' => 'Unauthorized'), 401);
  }
  
  // Sanitize
  $title = sanitize_text_field($request->get_param('title') ?: 'Daily Log');
  $blocks_json = $request->get_param('blocks_json'); // Already JSON string
  $location_id = intval($request->get_param('location_id'));
  $log_date = sanitize_text_field($request->get_param('log_date'));
  $time_slots = $request->get_param('time_slots'); // array
  $job_role_id = intval($request->get_param('job_role_id'));
  $tags = $request->get_param('tags') ?: array();
  $status = $request->get_param('status');
  
  // Convert BlockNote JSON to HTML for post_content (for search/display)
  $html_content = mp_blocks_to_html(json_decode($blocks_json, true));
  
  // Create post
  $post_id = wp_insert_post(array(
    'post_type'    => 'mp_daily_log',
    'post_title'   => $title,
    'post_content' => $html_content, // HTML version for compatibility
    'post_author'  => $current_user_id,
    'post_status'  => $status,
    'post_date'    => current_time('mysql'),
  ));
  
  if (is_wp_error($post_id)) {
    return new WP_REST_Response(array('error' => $post_id->get_error_message()), 500);
  }
  
  // Save metadata
  update_post_meta($post_id, '_location_id', $location_id);
  update_post_meta($post_id, '_log_date', $log_date);
  update_post_meta($post_id, '_time_slots', json_encode($time_slots));
  update_post_meta($post_id, '_job_role_id', $job_role_id);
  update_post_meta($post_id, '_tags', json_encode($tags));
  update_post_meta($post_id, '_blocks_json', $blocks_json); // Save original blocks for editing
  
  // Trigger action (for BuddyBoss activity, notifications, etc.)
  do_action('mp_daily_log_created', $post_id, $location_id, $log_date, $time_slots);
  
  return new WP_REST_Response(array(
    'id'       => $post_id,
    'title'    => $title,
    'location_id' => $location_id,
    'log_date' => $log_date,
    'time_slots' => $time_slots,
    'job_role_id' => $job_role_id,
    'tags'     => $tags,
    'blocks_json' => $blocks_json,
    'created_at' => current_time('mysql'),
  ), 201);
}

// Helper: Convert BlockNote JSON to HTML (basic implementation)
function mp_blocks_to_html($blocks) {
  if (!is_array($blocks)) return '';
  
  $html = '';
  foreach ($blocks as $block) {
    $type = $block['type'] ?? 'paragraph';
    $content = $block['content'] ?? '';
    
    switch ($type) {
      case 'paragraph':
        $html .= '<p>' . wp_kses_post($content) . '</p>';
        break;
      case 'heading':
        $level = $block['props']['level'] ?? 1;
        $html .= "<h{$level}>" . wp_kses_post($content) . "</h{$level}>";
        break;
      case 'bulletListItem':
        $html .= '<li>' . wp_kses_post($content) . '</li>';
        break;
      case 'numberedListItem':
        $html .= '<li>' . wp_kses_post($content) . '</li>';
        break;
      case 'image':
        $url = $block['props']['url'] ?? '';
        $html .= '<img src="' . esc_url($url) . '" alt="" />';
        break;
      // Add more block types as needed
      default:
        $html .= '<p>' . wp_kses_post($content) . '</p>';
    }
  }
  return $html;
}
```

**Deliverable**: POST endpoint creates daily logs with block content

---

#### Task 3.2: Get Daily Logs Endpoint (with Grouping)

```php
// GET /mentorship-platform/v1/daily-logs - List logs with filters
register_rest_route('mentorship-platform/v1', '/daily-logs', array(
  'methods'  => WP_REST_Server::READABLE,
  'callback' => 'mp_get_daily_logs',
  'permission_callback' => 'mentorship_platform_check_access_permission',
  'args' => array(
    'location_id'   => array('type' => 'integer'),
    'log_date'      => array('type' => 'string', 'format' => 'date'),
    'log_date_from' => array('type' => 'string', 'format' => 'date'),
    'log_date_to'   => array('type' => 'string', 'format' => 'date'),
    'time_slot'     => array('type' => 'string', 'enum' => ['morning', 'midday', 'evening', 'all_day']),
    'job_role_id'   => array('type' => 'integer'),
    'user_id'       => array('type' => 'integer'),
    'tags'          => array('type' => 'string'), // Comma-separated
    'grouped'       => array('type' => 'boolean', 'default' => true), // Return grouped or flat
    'page'          => array('type' => 'integer', 'default' => 1),
    'per_page'      => array('type' => 'integer', 'default' => 50),
  ),
));

function mp_get_daily_logs($request) {
  global $wpdb;
  
  // Build query
  $args = array(
    'post_type'      => 'mp_daily_log',
    'post_status'    => 'publish',
    'posts_per_page' => $request->get_param('per_page'),
    'paged'          => $request->get_param('page'),
    'orderby'        => 'meta_value',
    'meta_key'       => '_log_date',
    'order'          => 'DESC',
  );
  
  $meta_query = array('relation' => 'AND');
  
  if ($location_id = $request->get_param('location_id')) {
    $meta_query[] = array('key' => '_location_id', 'value' => $location_id);
  }
  
  if ($log_date = $request->get_param('log_date')) {
    $meta_query[] = array('key' => '_log_date', 'value' => $log_date);
  }
  
  if ($log_date_from = $request->get_param('log_date_from')) {
    $meta_query[] = array('key' => '_log_date', 'value' => $log_date_from, 'compare' => '>=', 'type' => 'DATE');
  }
  
  if ($log_date_to = $request->get_param('log_date_to')) {
    $meta_query[] = array('key' => '_log_date', 'value' => $log_date_to, 'compare' => '<=', 'type' => 'DATE');
  }
  
  if ($job_role_id = $request->get_param('job_role_id')) {
    $meta_query[] = array('key' => '_job_role_id', 'value' => $job_role_id);
  }
  
  if ($user_id = $request->get_param('user_id')) {
    $args['author'] = $user_id;
  }
  
  if (count($meta_query) > 1) {
    $args['meta_query'] = $meta_query;
  }
  
  $query = new WP_Query($args);
  
  // Prepare logs
  $logs = array();
  foreach ($query->posts as $post) {
    $location_id = get_post_meta($post->ID, '_location_id', true);
    $time_slots_json = get_post_meta($post->ID, '_time_slots', true);
    $time_slots = json_decode($time_slots_json, true) ?: array();
    $job_role_id = get_post_meta($post->ID, '_job_role_id', true);
    
    // Filter by time_slot if specified
    if ($time_slot_filter = $request->get_param('time_slot')) {
      if (!in_array($time_slot_filter, $time_slots)) {
        continue;
      }
    }
    
    // Get job role name
    $job_role = $wpdb->get_row($wpdb->prepare(
      "SELECT name, tier FROM {$wpdb->prefix}pg_job_roles WHERE id = %d",
      $job_role_id
    ));
    
    // Get location name
    $location = get_term($location_id);
    
    // Get reaction counts
    $reactions = $wpdb->get_results($wpdb->prepare(
      "SELECT reaction_type, COUNT(*) as count 
       FROM {$wpdb->prefix}mp_daily_log_reactions 
       WHERE log_id = %d 
       GROUP BY reaction_type",
      $post->ID
    ));
    $reaction_counts = array();
    foreach ($reactions as $r) {
      $reaction_counts[$r->reaction_type] = (int) $r->count;
    }
    
    // Get comment count
    $comment_count = wp_count_comments($post->ID)->approved;
    
    $logs[] = array(
      'id'          => $post->ID,
      'title'       => $post->post_title,
      'content'     => $post->post_content, // HTML version
      'blocks_json' => get_post_meta($post->ID, '_blocks_json', true), // Original blocks
      'author'      => array(
        'id'         => $post->post_author,
        'name'       => get_the_author_meta('display_name', $post->post_author),
        'avatar_url' => get_avatar_url($post->post_author),
      ),
      'location'    => array(
        'id'   => $location_id,
        'name' => $location->name ?? 'Unknown',
      ),
      'log_date'    => get_post_meta($post->ID, '_log_date', true),
      'time_slots'  => $time_slots,
      'job_role'    => array(
        'id'   => $job_role_id,
        'name' => $job_role->name ?? 'Unknown',
        'tier' => $job_role->tier ?? null,
      ),
      'tags'        => json_decode(get_post_meta($post->ID, '_tags', true), true) ?: array(),
      'reactions'   => $reaction_counts,
      'comment_count' => $comment_count,
      'created_at'  => $post->post_date,
      'updated_at'  => $post->post_modified,
    );
  }
  
  // Group logs if requested
  if ($request->get_param('grouped')) {
    $logs = mp_group_logs_by_hierarchy($logs);
  }
  
  return new WP_REST_Response(array(
    'logs'  => $logs,
    'total' => $query->found_posts,
    'page'  => $request->get_param('page'),
    'per_page' => $request->get_param('per_page'),
  ));
}

// Helper: Group logs by Location → Date → Time Slot → Role
function mp_group_logs_by_hierarchy($logs) {
  $grouped = array();
  
  foreach ($logs as $log) {
    $location_id = $log['location']['id'];
    $location_name = $log['location']['name'];
    $log_date = $log['log_date'];
    $time_slots = $log['time_slots'];
    
    // Initialize location
    if (!isset($grouped[$location_id])) {
      $grouped[$location_id] = array(
        'location_id' => $location_id,
        'location_name' => $location_name,
        'dates' => array(),
      );
    }
    
    // Initialize date
    if (!isset($grouped[$location_id]['dates'][$log_date])) {
      $grouped[$location_id]['dates'][$log_date] = array(
        'date' => $log_date,
        'time_slots' => array(),
      );
    }
    
    // Add log to each time slot it covers
    foreach ($time_slots as $slot) {
      if (!isset($grouped[$location_id]['dates'][$log_date]['time_slots'][$slot])) {
        $grouped[$location_id]['dates'][$log_date]['time_slots'][$slot] = array(
          'time_slot' => $slot,
          'logs' => array(),
        );
      }
      
      $grouped[$location_id]['dates'][$log_date]['time_slots'][$slot]['logs'][] = $log;
    }
  }
  
  // Convert to indexed arrays for easier frontend consumption
  $result = array();
  foreach ($grouped as $location) {
    $location['dates'] = array_values($location['dates']);
    foreach ($location['dates'] as &$date) {
      $date['time_slots'] = array_values($date['time_slots']);
    }
    $result[] = $location;
  }
  
  return $result;
}
```

**Deliverable**: GET endpoint returns logs with automatic grouping

---

#### Task 3.3: Reactions Endpoints

```php
// POST /mentorship-platform/v1/daily-logs/:id/reactions
register_rest_route('mentorship-platform/v1', '/daily-logs/(?P<id>\d+)/reactions', array(
  'methods'  => WP_REST_Server::CREATABLE,
  'callback' => 'mp_add_reaction',
  'permission_callback' => 'mentorship_platform_check_access_permission',
  'args' => array(
    'id' => array('validate_callback' => function($param) { return is_numeric($param); }),
    'reaction_type' => array('type' => 'string', 'enum' => ['thumbs_up', 'thumbs_down', 'heart', 'celebrate']),
  ),
));

function mp_add_reaction($request) {
  global $wpdb;
  $log_id = intval($request->get_param('id'));
  $user_id = get_current_user_id();
  $reaction_type = sanitize_text_field($request->get_param('reaction_type'));
  
  $table = $wpdb->prefix . 'mp_daily_log_reactions';
  
  // Check if already reacted
  $existing = $wpdb->get_var($wpdb->prepare(
    "SELECT id FROM $table WHERE log_id = %d AND user_id = %d AND reaction_type = %s",
    $log_id, $user_id, $reaction_type
  ));
  
  if ($existing) {
    return new WP_REST_Response(array('message' => 'Already reacted'), 200);
  }
  
  // Insert reaction
  $wpdb->insert($table, array(
    'log_id' => $log_id,
    'user_id' => $user_id,
    'reaction_type' => $reaction_type,
    'created_at' => current_time('mysql'),
  ));
  
  return new WP_REST_Response(array('message' => 'Reaction added', 'id' => $wpdb->insert_id), 201);
}

// DELETE /mentorship-platform/v1/daily-logs/:id/reactions/:reaction_type
register_rest_route('mentorship-platform/v1', '/daily-logs/(?P<id>\d+)/reactions/(?P<reaction_type>[a-z_]+)', array(
  'methods'  => WP_REST_Server::DELETABLE,
  'callback' => 'mp_remove_reaction',
  'permission_callback' => 'mentorship_platform_check_access_permission',
));

function mp_remove_reaction($request) {
  global $wpdb;
  $log_id = intval($request->get_param('id'));
  $user_id = get_current_user_id();
  $reaction_type = sanitize_text_field($request->get_param('reaction_type'));
  
  $table = $wpdb->prefix . 'mp_daily_log_reactions';
  
  $wpdb->delete($table, array(
    'log_id' => $log_id,
    'user_id' => $user_id,
    'reaction_type' => $reaction_type,
  ));
  
  return new WP_REST_Response(array('message' => 'Reaction removed'), 200);
}
```

**Deliverable**: Reactions endpoints work; users can add/remove reactions

---

### Phase 4: React Components (Week 2–3)

#### Task 4.1: DailyLogForm with Block Editor

**File**: `src/components/DailyLogForm.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { createDailyLog, getLocations, getJobRoles } from '@/services/api';
import BlockEditor from '@/components/BlockEditor';

interface Location {
  id: number;
  name: string;
}

interface JobRole {
  id: number;
  name: string;
  tier: number;
}

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (7am–12pm)' },
  { value: 'midday', label: 'Midday (12pm–5pm)' },
  { value: 'evening', label: 'Evening (5pm–10pm)' },
  { value: 'all_day', label: 'All Day' },
];

const DailyLogForm: React.FC<{ onSave?: () => void }> = ({ onSave }) => {
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlots, setTimeSlots] = useState<string[]>(['morning']);
  const [jobRoleId, setJobRoleId] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'publish' | 'draft'>('publish');
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getLocations(), getJobRoles()])
      .then(([locs, roles]) => {
        setLocations(locs);
        setJobRoles(roles);
        
        // Auto-select user's primary role if available
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser.primaryJobRoleId) {
          setJobRoleId(currentUser.primaryJobRoleId);
        }
      })
      .catch((err) => setError('Failed to load form data'));
  }, []);

  const handleTimeSlotToggle = (slot: string) => {
    if (slot === 'all_day') {
      setTimeSlots(['all_day']);
    } else {
      const newSlots = timeSlots.includes(slot)
        ? timeSlots.filter((s) => s !== slot)
        : [...timeSlots.filter((s) => s !== 'all_day'), slot];
      setTimeSlots(newSlots.length > 0 ? newSlots : ['morning']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!locationId || !jobRoleId || !blocks) {
      setError('Please fill in all required fields and add content');
      return;
    }

    setLoading(true);
    try {
      await createDailyLog({
        title: title || 'Daily Log',
        blocks_json: JSON.stringify(blocks),
        location_id: locationId,
        log_date: logDate,
        time_slots: timeSlots,
        job_role_id: jobRoleId,
        tags,
        status,
      });
      
      // Reset form
      setTitle('');
      setBlocks(null);
      setTimeSlots(['morning']);
      setTags([]);
      setError(null);
      
      if (onSave) onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save daily log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-3xl font-bold mb-6">Create Daily Log</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Location */}
        <div>
          <label className="block font-semibold mb-2">Location *</label>
          <select
            value={locationId || ''}
            onChange={(e) => setLocationId(parseInt(e.target.value))}
            className="w-full p-2 border rounded focus:ring-blue-500"
            required
          >
            <option value="">Select location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block font-semibold mb-2">Date *</label>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="w-full p-2 border rounded focus:ring-blue-500"
            required
          />
        </div>

        {/* Job Role */}
        <div>
          <label className="block font-semibold mb-2">Your Role *</label>
          <select
            value={jobRoleId || ''}
            onChange={(e) => setJobRoleId(parseInt(e.target.value))}
            className="w-full p-2 border rounded focus:ring-blue-500"
            required
          >
            <option value="">Select role...</option>
            {jobRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} (Tier {role.tier})
              </option>
            ))}
          </select>
        </div>

        {/* Title (optional) */}
        <div>
          <label className="block font-semibold mb-2">Title (optional)</label>
          <input
            type="text"
            placeholder="e.g., Busy morning shift"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Time Slots */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Time Slots *</label>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot.value}
              type="button"
              onClick={() => handleTimeSlotToggle(slot.value)}
              className={`px-4 py-2 rounded-full border-2 transition ${
                timeSlots.includes(slot.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 border-gray-300 hover:border-blue-500'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Block Editor */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Log Entry *</label>
        <div className="border rounded-lg overflow-hidden">
          <BlockEditor initialContent={blocks} onChange={setBlocks} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Use slash commands (/) for blocks: /heading, /image, /bullet-list, etc.
        </p>
      </div>

      {/* Tags (optional) */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Tags (optional)</label>
        <input
          type="text"
          placeholder="incident, maintenance, training (comma-separated)"
          value={tags.join(', ')}
          onChange={(e) => setTags(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          className="w-full p-2 border rounded focus:ring-blue-500"
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          onClick={() => setStatus('publish')}
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Publishing...' : 'Publish Log'}
        </button>
        <button
          type="submit"
          onClick={() => setStatus('draft')}
          disabled={loading}
          className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-400"
        >
          Save as Draft
        </button>
      </div>
    </form>
  );
};

export default DailyLogForm;
```

**Deliverable**: Form with block editor works; users can create rich daily logs

---

#### Task 4.2: DailyLogList with Grouping

**File**: `src/components/DailyLogList.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { getDailyLogs } from '@/services/api';
import DailyLogCard from './DailyLogCard';

const DailyLogList: React.FC = () => {
  const [groupedLogs, setGroupedLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await getDailyLogs({ grouped: true, per_page: 100 });
      setGroupedLogs(response.logs);
      setError(null);
      
      // Auto-expand today's logs
      const today = new Date().toISOString().split('T')[0];
      setExpandedDates(new Set([today]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="text-center py-12">Loading daily logs...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-12">{error}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Daily Logs</h1>

      {groupedLogs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No daily logs yet. Be the first to create one!
        </div>
      )}

      {/* Group by Location */}
      {groupedLogs.map((location) => (
        <div key={location.location_id} className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-blue-600 dark:text-blue-400">
            📍 {location.location_name}
          </h2>

          {/* Group by Date */}
          {location.dates.map((dateGroup: any) => {
            const isExpanded = expandedDates.has(dateGroup.date);
            const isToday = dateGroup.date === new Date().toISOString().split('T')[0];

            return (
              <div key={dateGroup.date} className="mb-6">
                <button
                  onClick={() => toggleDate(dateGroup.date)}
                  className="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  <h3 className="text-xl font-bold">
                    📅{' '}
                    {new Date(dateGroup.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {isToday && (
                      <span className="ml-2 text-sm bg-green-500 text-white px-2 py-1 rounded">
                        Today
                      </span>
                    )}
                  </h3>
                  <span className="text-2xl">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-6">
                    {/* Group by Time Slot */}
                    {dateGroup.time_slots.map((slotGroup: any) => (
                      <div key={slotGroup.time_slot}>
                        <h4 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300 capitalize">
                          ⏰ {slotGroup.time_slot.replace('_', ' ')}
                        </h4>
                        <div className="space-y-3 pl-4">
                          {slotGroup.logs.map((log: any) => (
                            <DailyLogCard key={log.id} log={log} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default DailyLogList;
```

**Deliverable**: Grouped list view with collapsible sections

---

#### Task 4.3: DailyLogCard Component

**File**: `src/components/DailyLogCard.tsx`

```tsx
import React, { useState } from 'react';
import { addReaction, removeReaction } from '@/services/api';

interface DailyLogCardProps {
  log: any;
  onReactionChange?: () => void;
}

const DailyLogCard: React.FC<DailyLogCardProps> = ({ log, onReactionChange }) => {
  const [reactions, setReactions] = useState(log.reactions || {});
  const [expanded, setExpanded] = useState(false);

  const handleReaction = async (type: string) => {
    try {
      if (reactions[type] > 0) {
        await removeReaction(log.id, type);
        setReactions({ ...reactions, [type]: reactions[type] - 1 });
      } else {
        await addReaction(log.id, type);
        setReactions({ ...reactions, [type]: (reactions[type] || 0) + 1 });
      }
      if (onReactionChange) onReactionChange();
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  const preview = log.content.replace(/<[^>]*>/g, '').substring(0, 200);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition">
      <div className="flex items-start gap-4 mb-4">
        <img
          src={log.author.avatar_url}
          alt={log.author.name}
          className="w-12 h-12 rounded-full"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-bold text-lg">{log.author.name}</h5>
            <span
              className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
            >
              {log.job_role.name}
            </span>
            {log.time_slots.length > 1 && (
              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                {log.time_slots.join(' + ')}
              </span>
            )}
          </div>
          {log.title && (
            <h4 className="font-semibold text-xl mb-2">{log.title}</h4>
          )}
          <p className="text-sm text-gray-500">
            {new Date(log.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Content Preview/Full */}
      <div className={`prose dark:prose-invert max-w-none mb-4 ${expanded ? '' : 'line-clamp-3'}`}>
        {expanded ? (
          <div dangerouslySetInnerHTML={{ __html: log.content }} />
        ) : (
          <p>{preview}...</p>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>

      {/* Tags */}
      {log.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {log.tags.map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Reactions & Comments */}
      <div className="flex items-center gap-6 border-t pt-4">
        <button
          onClick={() => handleReaction('thumbs_up')}
          className="flex items-center gap-2 hover:text-green-600 transition"
        >
          👍 <span>{reactions.thumbs_up || 0}</span>
        </button>
        <button
          onClick={() => handleReaction('thumbs_down')}
          className="flex items-center gap-2 hover:text-red-600 transition"
        >
          👎 <span>{reactions.thumbs_down || 0}</span>
        </button>
        <button
          onClick={() => handleReaction('heart')}
          className="flex items-center gap-2 hover:text-pink-600 transition"
        >
          ❤️ <span>{reactions.heart || 0}</span>
        </button>
        <button className="flex items-center gap-2 hover:text-blue-600 transition">
          💬 <span>{log.comment_count || 0} Comments</span>
        </button>
      </div>
    </div>
  );
};

export default DailyLogCard;
```

**Deliverable**: Card displays log with reactions and comments

---

#### Task 4.4: Update API Service

**File**: `src/services/api.ts` (add these)

```typescript
// DAILY LOGS
export const getDailyLogs = (params?: any): Promise<{ logs: any[]; total: number }> => {
  const query = new URLSearchParams(params || {});
  return pluginGet(`daily-logs?${query.toString()}`);
};

export const createDailyLog = (data: any): Promise<any> => {
  return pluginPost('daily-logs', data);
};

export const getDailyLog = (id: number): Promise<any> => {
  return pluginGet(`daily-logs/${id}`);
};

// REACTIONS
export const addReaction = (logId: number, reactionType: string): Promise<void> => {
  return pluginPost(`daily-logs/${logId}/reactions`, { reaction_type: reactionType });
};

export const removeReaction = (logId: number, reactionType: string): Promise<void> => {
  return pluginPost(`daily-logs/${logId}/reactions/${reactionType}`, {}, 'DELETE');
};

// JOB ROLES (if not already exposed)
export const getJobRoles = (): Promise<any[]> => {
  return pluginGet('job-roles'); // You may need to add this endpoint
};
```

---

### Phase 5: Integration & Polish (Week 3–4)

#### Task 5.1: Add Daily Logs to Main App

**File**: `src/App.tsx`

```tsx
import DailyLogForm from '@/components/DailyLogForm';
import DailyLogList from '@/components/DailyLogList';

// In routes:
<Route path="/daily-logs" element={<DailyLogList />} />
<Route path="/daily-logs/new" element={<DailyLogForm onSave={() => navigate('/daily-logs')} />} />
```

**Update navigation** in `Header.tsx`:

```tsx
<Link to="/daily-logs" className="nav-link">
  📝 Daily Logs
</Link>
```

---

#### Task 5.2: BuddyBoss Activity Integration (Optional)

If you want logs to appear in BuddyBoss feed:

```php
// In includes/buddyboss-integration.php or api-routes.php
add_action('mp_daily_log_created', function($post_id, $location_id, $log_date, $time_slots) {
  if (!function_exists('bp_activity_add')) return;
  
  $post = get_post($post_id);
  $location = get_term($location_id);
  $slots = implode(' + ', array_map('ucfirst', $time_slots));
  
  bp_activity_add(array(
    'component'      => 'mentorship-platform',
    'type'           => 'daily_log_posted',
    'action'         => sprintf(
      '%s posted a daily log at %s (%s)',
      bp_core_get_user_displayname($post->post_author),
      $location->name,
      $slots
    ),
    'content'        => wp_trim_words(wp_strip_all_tags($post->post_content), 50),
    'primary_link'   => get_permalink($post_id),
    'item_id'        => $post_id,
    'secondary_item_id' => $location_id,
    'user_id'        => $post->post_author,
  ));
}, 10, 4);
```

---

#### Task 5.3: Testing

- [ ] Create log with block editor → verify blocks render correctly
- [ ] Add image → verify uploads to Media Library
- [ ] Select multiple time slots → log appears under each slot
- [ ] Filter by location/date range → returns correct logs
- [ ] Add reactions → counts update in real-time
- [ ] Add comment → appears under log
- [ ] Group display → Location → Date → Time Slot → Role hierarchy works

---

## Summary: What You Get

✅ **Full Gutenberg-style editor** in React (BlockNote) — no WordPress admin needed  
✅ **Auto-grouped blog view**: Location → Day → Time Slot → Role  
✅ **Multi-slot support**: Users can cover morning+midday shifts in one log  
✅ **Job role integration**: Uses existing `wp_pg_job_roles` table  
✅ **Blog features**: Comments, reactions (thumbs up/down/heart), tags, search  
✅ **WordPress backend**: Easy to maintain for now, portable to standalone later  
✅ **Unified plugin**: All in one codebase (`mentorship-platform`)  

---

## Migration Path to Standalone (Future)

When you're ready to migrate:

1. **Block content is portable**: BlockNote JSON can be used in any frontend
2. **API is RESTful**: Easy to rewrite endpoints in Node.js/Python
3. **Data export**: Export posts, metadata, comments, reactions from WordPress tables
4. **Auth migration**: Move from WordPress users to JWT/OAuth

**Estimated migration effort**: 6–8 weeks (per previous PRD)

---

## Next Steps

1. **Review this PRD** — does it meet your vision?
2. **Start Phase 1**: Install BlockNote, create BlockEditor component
3. **Create tickets** for each phase
4. **Begin backend work**: Register CPT, add REST endpoints

Would you like me to:
- **Create the BlockEditor component** right now with image upload support?
- **Set up the REST endpoints** in `includes/api-routes.php`?
- **Build the DailyLogForm and DailyLogList components**?

Let me know where you'd like to start!
