# PRD: Daily Logs Architecture — WordPress Backend + React Frontend

**Version**: 1.0  
**Date**: November 13, 2025  
**Status**: ⚠️ OUTDATED - Superseded by PRD-AQUATICPRO-REBRANDING-AND-UX-OVERHAUL.md (Nov 17, 2025)  

---

## Executive Summary

You want to improve the Daily Logs experience by:
1. Integrating with React frontend (not forcing users into WordPress admin)
2. Leveraging BuddyBoss Pro's news feed and social features
3. Formalizing the location/date relationship (vs. separate "Day of Log" CPT)
4. Allowing multiple logs per location per day (Concessions Manager + Pool Manager)
5. Supporting backdating (logs written later but for a past location/date)

**Recommendation**: Keep WordPress backend + Pods, enhance Pods UI, integrate with BuddyBoss Activity Stream (not News Feed), use React frontend to render/manage logs.

**Why not migrate to standalone?** You already have a solid WordPress + React setup; moving to standalone is expensive and delays features. Better to optimize what works.

**Why BuddyBoss?** Activity Stream provides social engagement (likes, comments, @mentions); integrates with your user/member ecosystem.

---

## Problem Statement

### Current Pain Points

| Pain Point | Impact | Root Cause |
|-----------|--------|-----------|
| Users must go to WordPress admin to create daily logs | UX friction | No React form in plugin UI |
| "Day of Log" is a separate CPT that's confusing | Data complexity | Workaround for post_date limitation |
| Location + Date relationship isn't formalized | Data integrity issues | Stored in post_title concatenation |
| No social engagement on logs (likes, comments) | Low adoption | Not integrated with BuddyBoss |
| Backdating logs is unintuitive | Users avoid it | Post date conflicts with actual date |
| Logs don't appear in BuddyBoss activity feed | Visibility issue | Logs live in isolated CPT, not Activity Stream |
| Search/filter by location/date is manual | Discoverability poor | No indexed metadata |

### Use Cases to Support

1. **Daily logger creates log for today**
   - User visits React app → "New Daily Log"
   - Selects location (dropdown) + date (defaults to today)
   - Writes entry (rich text)
   - Publishes → appears in feed + BuddyBoss activity

2. **Manager creates log for yesterday (backdating)**
   - Same flow, but changes date to yesterday
   - No post_date conflicts
   - Timestamp is metadata, not post_date

3. **Team lead views logs by location/date**
   - Sidebar filter: Location dropdown + date range picker
   - Shows all logs for Mitchell on 1/1/2025
   - Can see Concessions Manager + Pool Manager entries

4. **Social engagement**
   - User clicks like on a log → appears in BuddyBoss activity
   - User comments on a log → nested comments visible
   - Log appears in team member's profile

---

## Analysis: Current CPT Structure vs. Alternatives

### Option 1: Keep Current Structure + Enhance (RECOMMENDED)

**What you have**:
```
"Daily Log" (mp_update?) CPT
├── post_title: Description/entry title
├── post_content: Journal entry (rich text)
├── post_author: User who wrote it
├── post_date: Publish date (conflicted usage)
└── post_meta:
    ├── location (?)
    ├── log_date (?)
    └── related_day_of_log (references "Day of Log" CPT)

"Day of Log" (mp_initiative?) CPT
└── post_title: "Mitchell 1/1/2025"
    └── Used as grouping mechanism
```

**Pros**:
- Already in use; existing data
- Pods integration familiar to you
- Can layer React UI on top without DB changes
- BuddyBoss integration straightforward

**Cons**:
- Dual CPT structure is confusing for developers
- "Day of Log" title concatenation is brittle
- post_date misuse (logs written later) is a hack

**Enhancement Plan**:
1. Formalize metadata schema:
   ```
   Daily Log (mp_update)
   ├── _location_id (meta) → Term ID in custom taxonomy "Locations"
   ├── _log_date (meta) → Date picker value (YYYY-MM-DD)
   ├── _is_published (meta) → Boolean (separate from post_status)
   ├── post_content → Rich text entry
   └── post_date → Set to NOW() on creation (for sorting in feed)
   ```

2. Deprecate "Day of Log" CPT (keep for backward compat, stop creating new ones)

3. Add custom taxonomy "Locations" (replaces location metadata):
   ```
   Locations (Custom Taxonomy)
   ├── Mitchell (term)
   ├── Downtown Pool (term)
   ├── Aquatic Center (term)
   └── ...
   ```

4. Rebuild REST API endpoint to use new schema

5. Update Pods configuration to hide location/date picker (use React form instead)

**Effort**: Low (metadata additions, no data migration) | **Timeline**: 1–2 weeks

---

### Option 2: Use BuddyBoss Activity Stream Natively

**What BuddyBoss offers**:
- `bp_activity` table with activity type, component, action, etc.
- Posts can be added to Activity Stream (News Feed)
- Comments, likes, @mentions built-in
- User profile integration

**How it would work**:
```
Create activity when user posts a Daily Log:
add_action('save_post_mp_update', function($post_id) {
  bp_activity_add(array(
    'action'         => 'New daily log at Mitchell',
    'content'        => get_post_field('post_content', $post_id),
    'component'      => 'mentorship-platform',
    'type'           => 'daily_log',
    'primary_link'   => get_permalink($post_id),
    'user_id'        => get_post_field('post_author', $post_id),
    'item_id'        => $post_id,
    'secondary_item_id' => get_post_meta($post_id, '_location_id', true),
  ));
});
```

**Pros**:
- Deep BuddyBoss integration (likes, comments, feeds, profiles)
- Users see logs in their activity stream
- Minimal extra work (just register component)

**Cons**:
- Adds dependency on BuddyBoss structure
- Activity stream is time-series; location/date filtering harder
- Might not fit the "Daily Log Dashboard" concept you want

**Effort**: Medium (hook into BuddyBoss lifecycle) | **Timeline**: 1 week

---

### Option 3: Use BuddyBoss "News Feed" with Custom Post Type Integration

**What BuddyBoss News Feed is**:
- Curated feed in profile
- Integrates CPT posts into member profiles
- Shows "Member posted X" activity

**How it would work**:
```php
// Register mp_update CPT to show in BuddyBoss
add_filter('bp_activity_post_type_feed', function($post_types) {
  $post_types[] = 'mp_update';
  return $post_types;
});
```

**Pros**:
- Simple integration
- Logs appear on member profiles automatically

**Cons**:
- Less customizable than Activity Stream
- Doesn't help with location/date grouping
- Harder to add custom actions (like, comment, @mention)

**Effort**: Low | **Timeline**: 2–3 days

---

### Option 4: Hybrid — Pods + BuddyBoss Activity Stream

**What you'd do**:
- Keep Pods CPT structure (familiar, already working)
- Enhance metadata schema (location ID, log_date)
- Create custom taxonomy for locations
- Register Daily Logs in BuddyBoss Activity Stream (so they appear in feeds)
- Build React form for creation/editing (tied to REST endpoint)
- Let React handle location/date filtering/display

**Pros**:
- Leverages existing Pods setup
- Gets BuddyBoss social features
- React frontend handles complex UX (date range filters, location dropdowns)
- Best of both worlds

**Cons**:
- Two systems to maintain (Pods + BuddyBoss)
- Slight overhead in syncing

**Effort**: Medium | **Timeline**: 2–3 weeks

**Recommendation: Go with Option 4 (Hybrid)** — it solves your immediate needs without a major refactor.

---

## Proposed Architecture

### Data Model (Enhanced)

```sql
-- Existing table: wp_posts (mp_update CPT)
wp_posts
├── ID → primary key
├── post_title → "Morning shift entry" or whatever user enters
├── post_content → Rich text journal entry
├── post_author → User ID
├── post_date → NOW() (creation time)
├── post_status → 'publish', 'draft', 'pending'
└── post_type → 'mp_update'

-- Existing table: wp_postmeta (add these meta keys)
wp_postmeta
├── post_id → FK to wp_posts.ID
├── meta_key = '_location_id' → Term ID from wp_terms
├── meta_value → Location term ID (e.g., 5 for "Mitchell")
├── (another row)
├── meta_key = '_log_date' → YYYY-MM-DD string
├── meta_value → "2025-01-01"
├── (another row)
├── meta_key = '_shift_type' → (optional) "morning", "evening", etc.
└── meta_value → "morning"

-- New table: wp_term_taxonomy for Locations
wp_terms
├── term_id → Location ID
├── name → "Mitchell Pool"
├── slug → "mitchell-pool"

-- BuddyBoss integration: wp_bp_activity
wp_bp_activity
├── id → Activity stream entry
├── component → 'mentorship-platform'
├── type → 'daily_log'
├── action → "John posted a daily log at Mitchell"
├── content → Rich text excerpt
├── primary_link → Permalink to daily log
├── item_id → Post ID of daily log
├── secondary_item_id → Location term ID
├── user_id → Author user ID
├── date_recorded → Timestamp
```

### REST API Design (Enhanced)

```
Current endpoints (WordPress REST API):
GET  /wp-json/mentorship-platform/v1/updates
POST /wp-json/mentorship-platform/v1/updates

New endpoints (add to existing):
GET  /wp-json/mentorship-platform/v1/daily-logs
  ?location_id=5
  ?log_date=2025-01-01
  ?log_date_from=2025-01-01&log_date_to=2025-01-07 (date range)
  ?user_id=123
  ?per_page=20&page=1 (pagination)

POST /wp-json/mentorship-platform/v1/daily-logs
  {
    "title": "Morning shift notes",
    "content": "<p>Today was busy...</p>",
    "location_id": 5,
    "log_date": "2025-01-01",
    "shift_type": "morning"
  }

GET  /wp-json/mentorship-platform/v1/daily-logs/:id
PUT  /wp-json/mentorship-platform/v1/daily-logs/:id
DELETE /wp-json/mentorship-platform/v1/daily-logs/:id

GET  /wp-json/mentorship-platform/v1/locations (list all)
  → Returns: [{ id: 1, name: "Mitchell", slug: "mitchell" }, ...]
```

### React Frontend Components

New components in `src/components/`:

```
DailyLogForm.tsx
├── LocationSelect (dropdown of locations)
├── DatePicker (select log_date, not post_date)
├── RichTextEditor (Tiptap for content)
├── ShiftTypeSelect (optional: morning/evening)
└── PublishButton / SaveDraftButton

DailyLogList.tsx
├── LocationFilter (dropdown)
├── DateRangeFilter (from/to date pickers)
├── UserFilter (optional: see others' logs)
├── LogCard (shows entry + author + date + location)
└── Pagination

DailyLogDetail.tsx
├── Full entry
├── Author + avatar
├── Log date + location
├── Edit/Delete buttons (if owner)
├── Comments section (if BuddyBoss enabled)
└── Like button (if BuddyBoss enabled)

LocationBrowser.tsx
├── Sidebar: Location tree or tabs
├── Main: Calendar/timeline of logs for selected location
└── Each day shows all logs for that location
```

### BuddyBoss Integration

When a Daily Log is published:

```php
// Hook: Fires when Daily Log CPT is published
add_action('publish_mp_update', function($post_id) {
  $location_id = get_post_meta($post_id, '_location_id', true);
  $location_term = get_term($location_id);
  
  // Add to BuddyBoss activity stream
  bp_activity_add(array(
    'component'      => 'mentorship-platform',
    'type'           => 'daily_log_posted',
    'action'         => sprintf(
      '%s posted a daily log at %s',
      get_the_author_meta('display_name', get_post_field('post_author', $post_id)),
      $location_term->name
    ),
    'content'        => apply_filters('the_content', get_post_field('post_content', $post_id)),
    'primary_link'   => get_permalink($post_id),
    'item_id'        => $post_id,
    'secondary_item_id' => $location_id,
    'user_id'        => get_post_field('post_author', $post_id),
  ));
  
  // Trigger any custom hooks
  do_action('mp_daily_log_published', $post_id, $location_id);
});

// BuddyBoss should now show logs in activity feeds, user profiles, etc.
```

---

## Detailed Action Plan

### Phase 1: Schema & Metadata Setup (1 week)

#### Task 1.1: Add Location Taxonomy to Pods

**In WordPress Admin (or via code)**:
1. Create custom taxonomy: "Locations" (name: `mp_location`)
   ```php
   // In mentorship-platform.php or similar
   add_action('init', function() {
     register_taxonomy('mp_location', 'mp_update', [
       'label'         => 'Daily Log Locations',
       'singular_name' => 'Location',
       'hierarchical'  => false,
       'public'        => true,
       'show_in_rest'  => true,
     ]);
   });
   ```

2. Via Pods UI:
   - Go to Pods → Edit Pod → Select `mp_update` CPT
   - Add relationship field: Type = Taxonomy, Taxonomy = mp_location, Single = yes
   - Or just use Pods tax field if available

3. Populate existing locations from "Day of Log" CPT titles:
   - Run script to extract "Mitchell", "Downtown", etc. from concatenated titles
   - Create terms
   - Save as post meta `_location_id`

**Deliverable**: Locations taxonomy created and attached to mp_update; 3–5 locations added as terms

---

#### Task 1.2: Formalize Metadata Schema

**Add Pods fields to `mp_update` CPT**:

Via Pods UI → Add custom fields:

| Field Name | Type | Description | REST API |
|-----------|------|-------------|----------|
| `location` | Relationship | Link to Location taxonomy term | Yes |
| `log_date` | Date | Date of the log entry (can be past) | Yes |
| `shift_type` | Select (morning/evening/full) | When the shift occurred | Yes |

**Resulting Pods export** (JSON):
```json
{
  "type": "post_type",
  "name": "mp_update",
  "fields": {
    "post_title": { "name": "Title" },
    "post_content": { "name": "Description" },
    "location": {
      "name": "Location",
      "type": "relationship",
      "storage": "postmeta",
      "meta_key": "_location_id"
    },
    "log_date": {
      "name": "Log Date",
      "type": "date",
      "storage": "postmeta",
      "meta_key": "_log_date"
    },
    "shift_type": {
      "name": "Shift Type",
      "type": "select",
      "options": ["morning", "evening", "full"],
      "storage": "postmeta",
      "meta_key": "_shift_type"
    }
  }
}
```

**In Pods UI admin**:
1. Hide the location/log_date/shift_type fields (so users don't edit in WP admin)
2. Set these fields to REST API accessible
3. Hide from quick edit

**Deliverable**: Pods CPT configured with location, log_date, shift_type fields; visible in REST but hidden from admin

---

#### Task 1.3: Data Migration (One-time)

For each existing Daily Log post:

```php
// Script: scripts/migrate-daily-logs.php
foreach (get_posts(['post_type' => 'mp_update', 'numberposts' => -1]) as $post) {
  // Extract location from concatenated "Day of Log" title or guess from metadata
  $day_of_log_id = get_post_meta($post->ID, '_day_of_log_id', true);
  if ($day_of_log_id) {
    $day_title = get_the_title($day_of_log_id); // e.g., "Mitchell 1/1/2025"
    preg_match('/^(.*?)\s(\d+\/\d+\/\d+)$/', $day_title, $matches);
    $location_name = $matches[1] ?? 'Unknown';
    $log_date = $matches[2] ?? '2025-01-01';
    
    // Convert "1/1/2025" to "2025-01-01"
    $log_date = date('Y-m-d', strtotime($log_date));
    
    // Find or create location term
    $term = term_exists($location_name, 'mp_location');
    if (!$term) {
      $term = wp_insert_term($location_name, 'mp_location');
    }
    $location_id = is_array($term) ? $term['term_id'] : $term;
    
    // Save to post meta
    update_post_meta($post->ID, '_location_id', $location_id);
    update_post_meta($post->ID, '_log_date', $log_date);
  }
}
echo "Migration complete!";
```

**Run locally first** to verify; then run on production.

**Deliverable**: All existing Daily Logs have `_location_id` and `_log_date` metadata populated

---

### Phase 2: REST API Enhancements (1 week)

#### Task 2.1: Update REST Endpoint to Support New Filters

**In `includes/api-routes.php`**:

```php
// GET /mentorship-platform/v1/daily-logs
register_rest_route('mentorship-platform/v1', '/daily-logs', array(
  'methods'  => WP_REST_Server::READABLE,
  'callback' => 'mp_get_daily_logs',
  'permission_callback' => 'mentorship_platform_check_access_permission',
  'args' => array(
    'page'             => array('type' => 'integer', 'default' => 1),
    'per_page'         => array('type' => 'integer', 'default' => 20, 'maximum' => 100),
    'location_id'      => array('type' => 'integer'),
    'log_date'         => array('type' => 'string', 'format' => 'date'), // YYYY-MM-DD
    'log_date_from'    => array('type' => 'string', 'format' => 'date'),
    'log_date_to'      => array('type' => 'string', 'format' => 'date'),
    'user_id'          => array('type' => 'integer'),
    'shift_type'       => array('type' => 'string', 'enum' => ['morning', 'evening', 'full']),
    'orderby'          => array('type' => 'string', 'default' => 'log_date', 'enum' => ['log_date', 'post_date', 'title']),
    'order'            => array('type' => 'string', 'default' => 'DESC', 'enum' => ['ASC', 'DESC']),
  ),
));

function mp_get_daily_logs($request) {
  global $wpdb;
  
  // Build query
  $args = array(
    'post_type'      => 'mp_update',
    'post_status'    => 'publish',
    'posts_per_page' => $request->get_param('per_page'),
    'paged'          => $request->get_param('page'),
    'orderby'        => 'meta_value', // sort by _log_date
    'meta_key'       => '_log_date',
    'order'          => $request->get_param('order'),
  );
  
  // Add meta query for filters
  $meta_query = array('relation' => 'AND');
  
  if ($location_id = $request->get_param('location_id')) {
    $meta_query[] = array(
      'key'     => '_location_id',
      'value'   => $location_id,
      'compare' => '=',
    );
  }
  
  if ($log_date = $request->get_param('log_date')) {
    $meta_query[] = array(
      'key'     => '_log_date',
      'value'   => $log_date,
      'compare' => '=',
    );
  }
  
  if ($log_date_from = $request->get_param('log_date_from')) {
    $meta_query[] = array(
      'key'     => '_log_date',
      'value'   => $log_date_from,
      'compare' => '>=',
      'type'    => 'DATE',
    );
  }
  
  if ($log_date_to = $request->get_param('log_date_to')) {
    $meta_query[] = array(
      'key'     => '_log_date',
      'value'   => $log_date_to,
      'compare' => '<=',
      'type'    => 'DATE',
    );
  }
  
  if ($user_id = $request->get_param('user_id')) {
    $args['author'] = $user_id;
  }
  
  if ($shift_type = $request->get_param('shift_type')) {
    $meta_query[] = array(
      'key'     => '_shift_type',
      'value'   => $shift_type,
      'compare' => '=',
    );
  }
  
  if (count($meta_query) > 1) {
    $args['meta_query'] = $meta_query;
  }
  
  // Execute query
  $query = new WP_Query($args);
  
  // Prepare response
  $logs = array_map(function($post) {
    return array(
      'id'          => $post->ID,
      'title'       => $post->post_title,
      'content'     => apply_filters('the_content', $post->post_content),
      'author'      => array(
        'id'   => $post->post_author,
        'name' => get_the_author_meta('display_name', $post->post_author),
      ),
      'location_id' => get_post_meta($post->ID, '_location_id', true),
      'location'    => get_term(get_post_meta($post->ID, '_location_id', true))->name,
      'log_date'    => get_post_meta($post->ID, '_log_date', true),
      'shift_type'  => get_post_meta($post->ID, '_shift_type', true),
      'created_at'  => $post->post_date,
      'updated_at'  => $post->post_modified,
    );
  }, $query->posts);
  
  return new WP_REST_Response(array(
    'logs'  => $logs,
    'total' => $query->found_posts,
    'page'  => $request->get_param('page'),
    'per_page' => $request->get_param('per_page'),
  ));
}
```

**Test locally**:
```bash
# Should return logs for Mitchell on 2025-01-01
curl "http://localhost/wp-json/mentorship-platform/v1/daily-logs?location_id=5&log_date=2025-01-01"

# Should return logs by user 123 for week of Jan 1–7
curl "http://localhost/wp-json/mentorship-platform/v1/daily-logs?user_id=123&log_date_from=2025-01-01&log_date_to=2025-01-07"
```

**Deliverable**: GET `/daily-logs` endpoint works with all filters; tested

---

#### Task 2.2: Add POST Endpoint to Create Daily Logs

```php
// POST /mentorship-platform/v1/daily-logs
register_rest_route('mentorship-platform/v1', '/daily-logs', array(
  'methods'  => WP_REST_Server::CREATABLE,
  'callback' => 'mp_create_daily_log',
  'permission_callback' => 'mentorship_platform_check_access_permission',
  'args' => array(
    'title'      => array('required' => true, 'type' => 'string'),
    'content'    => array('required' => true, 'type' => 'string'),
    'location_id' => array('required' => true, 'type' => 'integer'),
    'log_date'   => array('required' => true, 'type' => 'string', 'format' => 'date'),
    'shift_type' => array('type' => 'string', 'enum' => ['morning', 'evening', 'full']),
  ),
));

function mp_create_daily_log($request) {
  $current_user_id = get_current_user_id();
  if (!$current_user_id) {
    return new WP_REST_Response(array('error' => 'Not authenticated'), 401);
  }
  
  // Sanitize input
  $title    = sanitize_text_field($request->get_param('title'));
  $content  = wp_kses_post($request->get_param('content'));
  $location_id = intval($request->get_param('location_id'));
  $log_date = sanitize_text_field($request->get_param('log_date'));
  $shift_type = sanitize_text_field($request->get_param('shift_type'));
  
  // Validate location exists
  if (!term_exists($location_id, 'mp_location')) {
    return new WP_REST_Response(array('error' => 'Invalid location'), 400);
  }
  
  // Validate log_date format
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $log_date)) {
    return new WP_REST_Response(array('error' => 'Invalid date format'), 400);
  }
  
  // Create post
  $post_id = wp_insert_post(array(
    'post_type'   => 'mp_update',
    'post_title'  => $title,
    'post_content' => $content,
    'post_author' => $current_user_id,
    'post_status' => 'publish',
    'post_date'   => current_time('mysql'), // Now
  ));
  
  if (is_wp_error($post_id)) {
    return new WP_REST_Response(array('error' => $post_id->get_error_message()), 500);
  }
  
  // Save meta
  update_post_meta($post_id, '_location_id', $location_id);
  update_post_meta($post_id, '_log_date', $log_date);
  if (!empty($shift_type)) {
    update_post_meta($post_id, '_shift_type', $shift_type);
  }
  
  // Trigger action for BuddyBoss integration
  do_action('mp_daily_log_created', $post_id, $location_id);
  
  return new WP_REST_Response(array(
    'id'          => $post_id,
    'title'       => $title,
    'content'     => $content,
    'location_id' => $location_id,
    'log_date'    => $log_date,
    'shift_type'  => $shift_type,
    'created_at'  => current_time('mysql'),
  ), 201);
}
```

**Deliverable**: POST endpoint works; creates Daily Log with all metadata

---

### Phase 3: BuddyBoss Integration (1 week)

#### Task 3.1: Register Daily Logs as BuddyBoss Activity Component

**In `includes/api-routes.php` or new file `includes/buddyboss-integration.php`**:

```php
<?php
// BuddyBoss integration for Daily Logs

// Register component
add_action('bp_init', function() {
  bp_activity_set_action(
    'mentorship-platform',
    'daily_log_posted',
    __('Daily log posted at {location}', 'mentorship-platform'),
    'mp_format_daily_log_activity',
    array(
      'bp_activity_admin_filter' => __('Daily Logs', 'mentorship-platform'),
    )
  );
});

// Format activity stream message
function mp_format_daily_log_activity($action, $activity) {
  $post_id = $activity->item_id;
  $location_id = $activity->secondary_item_id;
  $location = get_term($location_id)->name;
  $link = get_permalink($post_id);
  
  $action = sprintf(
    '<a href="%s">%s</a> posted a daily log at %s',
    bp_core_get_user_link($activity->user_id),
    bp_core_get_user_displayname($activity->user_id),
    $location
  );
  
  return apply_filters('mp_format_daily_log_activity', $action, $activity);
}

// Create activity when Daily Log is published
add_action('mp_daily_log_created', function($post_id, $location_id) {
  $post = get_post($post_id);
  $user_id = $post->post_author;
  $location_name = get_term($location_id)->name;
  
  // If activity already exists (from autosave), skip
  if (bp_activity_get(array(
    'component' => 'mentorship-platform',
    'type'      => 'daily_log_posted',
    'item_id'   => $post_id,
  ))) {
    return;
  }
  
  bp_activity_add(array(
    'component'      => 'mentorship-platform',
    'type'           => 'daily_log_posted',
    'action'         => sprintf(
      '%s posted a daily log at %s',
      bp_core_get_user_displayname($user_id),
      $location_name
    ),
    'content'        => wp_kses_post(wp_trim_words(get_post_field('post_content', $post_id), 50)),
    'primary_link'   => get_permalink($post_id),
    'item_id'        => $post_id,
    'secondary_item_id' => $location_id,
    'user_id'        => $user_id,
  ));
  
  do_action('mp_daily_log_activity_added', $post_id, $location_id);
}, 10, 2);

// Allow BuddyBoss to show Daily Logs in member profiles
add_filter('bp_activity_admin_get_activity_object_name', function($name, $action) {
  if ($action === 'daily_log_posted') {
    return 'Daily Log';
  }
  return $name;
}, 10, 2);
```

**In main plugin file** (`mentorship-platform.php`):
```php
require_once plugin_dir_path(__FILE__) . 'includes/buddyboss-integration.php';
```

**Deliverable**: BuddyBoss recognizes Daily Logs; they appear in activity feeds

---

#### Task 3.2: Allow Comments & Reactions on Daily Logs

BuddyBoss Activity comments will work automatically once activity is registered. To test:

1. Go to BuddyBoss member profile
2. Find a Daily Log activity
3. Click "Comment" and type
4. Should see comment nested under log

**To show in React** (update `src/services/api.ts`):

```typescript
// Get BuddyBoss comments for a daily log
export const getDailyLogComments = (activityId: number) => {
  return pluginGet(`buddyboss/comments?activity_id=${activityId}`);
};

// Add comment via BuddyBoss
export const addDailyLogComment = (activityId: number, content: string) => {
  return pluginPost('buddyboss/comments', { activity_id: activityId, content });
};
```

**Deliverable**: Users can comment on daily logs in feed; comments visible in React

---

### Phase 4: React Frontend Components (2 weeks)

#### Task 4.1: Create DailyLogForm Component

**File**: `src/components/DailyLogForm.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { createDailyLog, getLocations } from '@/services/api';
import RichTextEditor from '@/components/RichTextEditor';

interface Location {
  id: number;
  name: string;
  slug: string;
}

interface DailyLogFormProps {
  onSave?: () => void;
  initialDate?: string;
  initialLocationId?: number;
}

const DailyLogForm: React.FC<DailyLogFormProps> = ({
  onSave,
  initialDate = new Date().toISOString().split('T')[0],
  initialLocationId,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [locationId, setLocationId] = useState(initialLocationId || null);
  const [logDate, setLogDate] = useState(initialDate);
  const [shiftType, setShiftType] = useState('morning');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available locations
    getLocations()
      .then(setLocations)
      .catch((err) => setError('Failed to load locations'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !content || !locationId || !logDate) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await createDailyLog({
        title,
        content,
        location_id: locationId,
        log_date: logDate,
        shift_type: shiftType,
      });
      setTitle('');
      setContent('');
      setLocationId(null);
      setLogDate(new Date().toISOString().split('T')[0]);
      setError(null);
      if (onSave) onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Create Daily Log</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block font-semibold mb-2">Location *</label>
        <select
          value={locationId || ''}
          onChange={(e) => setLocationId(parseInt(e.target.value))}
          className="w-full p-2 border rounded focus:ring-blue-500"
        >
          <option value="">Select a location...</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block font-semibold mb-2">Date *</label>
        <input
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          className="w-full p-2 border rounded focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block font-semibold mb-2">Shift Type</label>
        <select
          value={shiftType}
          onChange={(e) => setShiftType(e.target.value)}
          className="w-full p-2 border rounded focus:ring-blue-500"
        >
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
          <option value="full">Full Day</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block font-semibold mb-2">Title *</label>
        <input
          type="text"
          placeholder="e.g., Morning shift notes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block font-semibold mb-2">Entry *</label>
        <RichTextEditor value={content} onChange={setContent} />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Saving...' : 'Save Daily Log'}
      </button>
    </form>
  );
};

export default DailyLogForm;
```

**Deliverable**: Form component works; users can create logs from React app

---

#### Task 4.2: Create DailyLogList Component

**File**: `src/components/DailyLogList.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { getDailyLogs, getLocations } from '@/services/api';

interface DailyLog {
  id: number;
  title: string;
  content: string;
  author: { id: number; name: string };
  location: string;
  location_id: number;
  log_date: string;
  shift_type: string;
  created_at: string;
}

interface Location {
  id: number;
  name: string;
}

const DailyLogList: React.FC = () => {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [logDateFrom, setLogDateFrom] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [logDateTo, setLogDateTo] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((err) => setError('Failed to load locations'));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedLocationId, logDateFrom, logDateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        log_date_from: logDateFrom,
        log_date_to: logDateTo,
        per_page: 50,
      };
      if (selectedLocationId) {
        params.location_id = selectedLocationId;
      }
      const response = await getDailyLogs(params);
      setLogs(response.logs);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Daily Logs</h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block font-semibold mb-2">Location</label>
          <select
            value={selectedLocationId || ''}
            onChange={(e) =>
              setSelectedLocationId(
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="w-full p-2 border rounded"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-2">From Date</label>
          <input
            type="date"
            value={logDateFrom}
            onChange={(e) => setLogDateFrom(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block font-semibold mb-2">To Date</label>
          <input
            type="date"
            value={logDateTo}
            onChange={(e) => setLogDateTo(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading && <div className="text-center py-8">Loading...</div>}

      {/* Logs grouped by date */}
      {!loading && logs.length > 0 && (
        <div className="space-y-6">
          {Object.entries(
            logs.reduce((acc, log) => {
              if (!acc[log.log_date]) acc[log.log_date] = [];
              acc[log.log_date].push(log);
              return acc;
            }, {} as Record<string, DailyLog[]>)
          )
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .map(([date, dayLogs]) => (
              <div key={date}>
                <h2 className="text-xl font-bold mb-3 text-gray-800 dark:text-white">
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
                <div className="space-y-3">
                  {dayLogs.map((log) => (
                    <LogCard key={log.id} log={log} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No logs found for the selected filters.
        </div>
      )}
    </div>
  );
};

const LogCard: React.FC<{ log: DailyLog }> = ({ log }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition">
    <div className="flex items-start justify-between mb-2">
      <div>
        <h3 className="font-bold text-lg">{log.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {log.author.name} • {log.location} • {log.shift_type}
        </p>
      </div>
    </div>
    <div
      className="prose dark:prose-invert max-w-none text-sm line-clamp-3"
      dangerouslySetInnerHTML={{
        __html: log.content.substring(0, 200) + '...',
      }}
    />
  </div>
);

export default DailyLogList;
```

**Deliverable**: List component displays logs grouped by date; filters work

---

#### Task 4.3: Create LocationBrowser Component (Advanced)

**File**: `src/components/LocationBrowser.tsx` (bonus, calendar timeline view)

```tsx
import React, { useState, useEffect } from 'react';
import { getDailyLogs, getLocations } from '@/services/api';
import DailyLogDetail from './DailyLogDetail';

const LocationBrowser: React.FC = () => {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [locations, setLocations] = useState<any[]>([]);
  const [logsForMonth, setLogsForMonth] = useState<Record<string, any[]>>({});
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  useEffect(() => {
    getLocations().then(setLocations);
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      // Fetch logs for entire month
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      getDailyLogs({
        location_id: selectedLocationId,
        log_date_from: monthStart,
        log_date_to: monthEnd,
      }).then((response) => {
        const grouped = response.logs.reduce((acc: any, log: any) => {
          if (!acc[log.log_date]) acc[log.log_date] = [];
          acc[log.log_date].push(log);
          return acc;
        }, {});
        setLogsForMonth(grouped);
      });
    }
  }, [selectedLocationId]);

  return (
    <div className="flex h-screen">
      {/* Left sidebar: Location list */}
      <div className="w-64 bg-gray-100 dark:bg-gray-900 p-4 border-r overflow-y-auto">
        <h2 className="font-bold text-lg mb-4">Locations</h2>
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocationId(loc.id)}
            className={`w-full text-left p-2 rounded mb-2 ${
              selectedLocationId === loc.id
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {/* Center: Calendar/timeline */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedLocationId && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              {locations.find((l) => l.id === selectedLocationId)?.name} —
              Monthly View
            </h2>

            {Object.entries(logsForMonth)
              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
              .map(([date, logs]) => (
                <div key={date} className="mb-6">
                  <h3 className="font-bold text-lg mb-2 text-gray-700 dark:text-gray-300">
                    {new Date(date).toLocaleDateString()}
                  </h3>
                  <div className="space-y-2">
                    {(logs as any[]).map((log) => (
                      <button
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded border-l-4 border-blue-500 hover:shadow"
                      >
                        <p className="font-semibold">{log.title}</p>
                        <p className="text-sm text-gray-500">
                          {log.author.name} • {log.shift_type}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Right: Detail view (if selected) */}
      {selectedLogId && (
        <div className="w-96 bg-white dark:bg-gray-800 shadow-lg p-6 overflow-y-auto border-l">
          <DailyLogDetail logId={selectedLogId} />
        </div>
      )}
    </div>
  );
};

export default LocationBrowser;
```

**Deliverable**: Advanced calendar/timeline view (bonus feature)

---

#### Task 4.4: Update API Service

**File**: `src/services/api.ts` (add these functions)

```typescript
import { pluginGet, pluginPost, pluginUpload } from './api-service';

// --- DAILY LOGS ---
export const getDailyLogs = (params?: {
  location_id?: number;
  log_date?: string;
  log_date_from?: string;
  log_date_to?: string;
  user_id?: number;
  shift_type?: string;
  page?: number;
  per_page?: number;
}): Promise<{ logs: any[]; total: number }> => {
  const query = new URLSearchParams();
  if (params) {
    if (params.location_id) query.append('location_id', params.location_id.toString());
    if (params.log_date) query.append('log_date', params.log_date);
    if (params.log_date_from) query.append('log_date_from', params.log_date_from);
    if (params.log_date_to) query.append('log_date_to', params.log_date_to);
    if (params.user_id) query.append('user_id', params.user_id.toString());
    if (params.shift_type) query.append('shift_type', params.shift_type);
    query.append('page', (params.page || 1).toString());
    query.append('per_page', (params.per_page || 20).toString());
  }
  return pluginGet(`daily-logs?${query.toString()}`);
};

export const createDailyLog = (data: {
  title: string;
  content: string;
  location_id: number;
  log_date: string;
  shift_type?: string;
}): Promise<any> => {
  return pluginPost('daily-logs', data);
};

export const getDailyLog = (id: number): Promise<any> => {
  return pluginGet(`daily-logs/${id}`);
};

export const updateDailyLog = (id: number, data: any): Promise<any> => {
  return pluginPost(`daily-logs/${id}`, data, 'PUT');
};

export const deleteDailyLog = (id: number): Promise<void> => {
  return pluginPost(`daily-logs/${id}`, {}, 'DELETE');
};

// --- LOCATIONS ---
export const getLocations = (): Promise<{ id: number; name: string; slug: string }[]> => {
  return pluginGet('locations');
};
```

**Deliverable**: API functions ready to use in components

---

#### Task 4.5: Integrate into Main App

**File**: `src/App.tsx` (update routes)

```tsx
import DailyLogForm from '@/components/DailyLogForm';
import DailyLogList from '@/components/DailyLogList';
import LocationBrowser from '@/components/LocationBrowser';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Existing routes */}
        <Route path="/mentors" element={<MentorDirectory />} />
        <Route path="/goals" element={<GoalDisplay />} />
        
        {/* NEW: Daily Logs routes */}
        <Route path="/daily-logs" element={<DailyLogList />} />
        <Route path="/daily-logs/new" element={<DailyLogForm onSave={() => navigate('/daily-logs')} />} />
        <Route path="/daily-logs/browse" element={<LocationBrowser />} />
        
        {/* Existing settings */}
        <Route path="/settings" element={<UserSettings />} />
      </Routes>
    </Router>
  );
};
```

**Update navigation** in `Header.tsx`:

```tsx
<nav className="flex gap-4">
  <Link to="/mentors">Mentors</Link>
  <Link to="/goals">Goals</Link>
  <Link to="/daily-logs">Daily Logs</Link>  {/* NEW */}
  <Link to="/daily-logs/browse">Browse by Location</Link>  {/* NEW */}
  <Link to="/settings">Settings</Link>
</nav>
```

**Deliverable**: Daily logs integrated into main app navigation

---

### Phase 5: Testing & Deployment (1 week)

#### Task 5.1: Functional Testing

**Create test scenarios**:

- [ ] User creates Daily Log with Mitchell location, today's date → appears in list
- [ ] User creates backdated log (yesterday) → appears under correct date
- [ ] Two users create logs for Mitchell on same date → both visible
- [ ] Filter by location Mitchell for Jan 1–7 → returns only logs for that location/date range
- [ ] Log appears in BuddyBoss activity feed immediately after publishing
- [ ] User clicks like on Daily Log in activity → reaction appears
- [ ] User comments on activity → comment visible nested under log
- [ ] "Day of Log" CPT still exists but new logs bypass it

**Run tests**:
```bash
# Test API directly
curl -X POST http://localhost/wp-json/mentorship-platform/v1/daily-logs \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning shift",
    "content": "<p>Busy day!</p>",
    "location_id": 5,
    "log_date": "2025-01-01",
    "shift_type": "morning"
  }'

# Test list with filters
curl "http://localhost/wp-json/mentorship-platform/v1/daily-logs?location_id=5&log_date_from=2025-01-01&log_date_to=2025-01-07"

# Test React app
npm run dev
# Navigate to /daily-logs, create log, verify appears in list
# Filter by location/date
# Check BuddyBoss activity feed
```

**Deliverable**: All tests pass; no regressions in existing functionality

---

#### Task 5.2: Data Cleanup

- [ ] Optional: Archive old "Day of Log" posts (set status to 'private')
- [ ] Verify all existing daily logs have `_location_id` and `_log_date` metadata
- [ ] Run migration script in production (backup first)

---

#### Task 5.3: Documentation

**Create `docs/DAILY_LOGS.md`**:
- User guide: How to create, edit, filter daily logs
- API documentation: All endpoints, examples
- BuddyBoss integration notes
- Troubleshooting

**Deliverable**: User + developer docs complete

---

## Implementation Timeline

| Phase | Task | Week | Effort |
|-------|------|------|--------|
| 1 | Add Location taxonomy + metadata | 1 | M |
| 1 | Data migration (one-time) | 1 | S |
| 2 | Enhance REST endpoint (GET with filters) | 1 | M |
| 2 | Add POST endpoint for creation | 1 | M |
| 3 | BuddyBoss component registration | 1 | S |
| 3 | Activity stream integration | 1 | S |
| 4 | DailyLogForm component | 2 | M |
| 4 | DailyLogList component | 2 | M |
| 4 | LocationBrowser component (optional) | 2 | M |
| 4 | API service functions | 1 | S |
| 4 | App integration & navigation | 1 | S |
| 5 | Testing & QA | 1 | M |
| **Total** | | **~3.5 weeks** | |

---

## Why This Approach (vs. alternatives)

| Consideration | This Approach | Migrate to Standalone | Use Only BuddyBoss |
|---|---|---|---|
| **Development speed** | 3–4 weeks | 6–10 weeks | 2 weeks (limited UX) |
| **Risk of data loss** | Low (WordPress still works) | High (cutover day risk) | Low |
| **UX for users** | Excellent (React form) | Excellent | Good (but limited filtering) |
| **Maintenance burden** | Low (keep WordPress) | High (two stacks) | Low (one plugin) |
| **Social features** | Medium (BuddyBoss optional) | Easy (can build) | Full BuddyBoss |
| **Location/date grouping** | Excellent (metadata) | Excellent (custom schema) | Medium (activity stream limited) |
| **Cost** | Minimal | Server costs | Minimal |

**Verdict**: This approach gives you 80% of the benefit (great UX, location grouping, BuddyBoss integration) at 30% of the migration cost. You can always migrate to standalone later if needed.

---

## Recommended Next Steps

1. **Review this PRD** with your team
2. **Approve tech direction**: Enhance current Pods + add React components vs. other options?
3. **Create Jira/Linear tickets** for each task (Phase 1–5)
4. **Assign ownership**:
   - Backend dev: Phase 1–2 (Pods, REST API)
   - Backend dev: Phase 3 (BuddyBoss integration)
   - Frontend dev: Phase 4 (React components)
   - QA: Phase 5 (testing)
5. **Start Phase 1**: Location taxonomy + metadata this week

---

## Open Questions for You

1. Should Daily Logs be visible only to team at the location, or to all logged-in users?
2. Do you want Concessions Manager logs separated visually from Pool Manager logs (by role/badge)?
3. Should Daily Logs be searchable by content (full-text search)?
4. Do you want Daily Logs exportable (PDF, CSV)?
5. Should there be a "shift end" time to auto-group logs by shift (morning = 7am–12pm, evening = 12pm–6pm)?
6. Any audit/compliance requirements (who edited what and when)?

---

**End of PRD**

*Version: 1.0*  
*Last Updated: November 13, 2025*
