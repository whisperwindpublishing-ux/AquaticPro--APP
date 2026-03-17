# Shared Hosting Performance Fixes (DreamHost Shared)
Last updated: March 15, 2026

## 🔴 Critical — Fix ASAP (OOM / Timeout Risk)

### 1. FOIA Export N+1 + Memory Streaming
**File:** `includes/api-routes-foia-export.php`

**Problems:**
- 4 separate `get_post_meta()` calls per daily log row inside a `foreach` loop — N+1 pattern
- Full `$export_data` array accumulated in PHP memory before any output is sent
- N+1 attendee query per inservice log row
- No `set_time_limit()` call

**Fix:**
- Batch all `get_post_meta()` calls before the loop using a single SQL query:
  `SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id IN (...) AND meta_key IN ('field1','field2','field3','field4')`
- Stream CSV output row-by-row using `fopen('php://output', 'w')` + `fputcsv()` — never accumulate full array
- Pre-batch inservice attendees with an `IN (...)` query on all log IDs before the loop
- Add `set_time_limit(120)` at the top of the download handler

---

## 🟠 High Priority

### 2. Weather API — Cache Geocode Result Separately
**File:** `includes/api-routes-dashboard.php`

**Problem:**
Two sequential external HTTP calls (Nominatim geocode + Open-Meteo weather), each with 10s timeout (20s max combined). The geocode result (zip → lat/lon) is NOT separately cached — it gets re-fetched every 30 minutes along with the weather data.

**Fix:**
```php
$coord_key = 'mp_geo_' . md5($zip);
$coords = get_transient($coord_key);
if (!$coords) {
    // fetch Nominatim
    set_transient($coord_key, compact('lat', 'lon', 'city'), 7 * DAY_IN_SECONDS);
}
// then fetch weather with $coords['lat'], $coords['lon']
```

---

### 3. Email Composer — Batch User Fetch
**File:** `includes/api-routes-email-composer.php`

**Problem:**
`get_userdata($uid)` called inside `foreach ($all_user_ids as $uid)` — fires N DB queries for N recipients.

**Fix:**
```php
$users = get_users([
    'include' => $all_user_ids,
    'fields'  => ['ID', 'user_email', 'display_name'],
]);
$user_map = array_column($users, null, 'ID');
```

---

### 4. `SHOW TABLES LIKE` — Add Static Cache
**Files:** Multiple (called per request with no caching)

**Problem:**
`SHOW TABLES LIKE 'mp_...'` runs on every request to check if tables exist.

**Fix:** Add a helper in `includes/security-helpers.php`:
```php
function mp_table_exists(string $table): bool {
    static $cache = [];
    if (!isset($cache[$table])) {
        global $wpdb;
        $cache[$table] = (bool) $wpdb->get_var($wpdb->prepare(
            "SHOW TABLES LIKE %s", $table
        ));
    }
    return $cache[$table];
}
```

---

## 🟡 Medium Priority

### 5. Service Worker Cache Version — Auto-bump on Deploy
**File:** `build/aquaticpro-sw.js` (generated)

**Problem:**
`CACHE_VERSION = 'aquaticpro-v3'` and `API_CACHE = 'aquaticpro-api-v3'` are hardcoded strings. After plugin updates, users may be served stale cached assets.

**Fix:**
Pass the plugin version when registering the SW:
```js
navigator.serviceWorker.register('/wp-content/plugins/aquaticpro/build/aquaticpro-sw.js?v=' + pluginVersion)
```
And inside the SW use `self.registration.scope` or a version injected at build time.

---

### 6. Rate-limit Transient Bloat
**File:** `includes/security-helpers.php`

**Problem:**
Rate-limit transients (`_transient_mp_rate_%`) accumulate in `wp_options`. WordPress autoloads all options on every page load — over time this grows and slows every request.

**Fix:**
Add a scheduled cleanup cron:
```php
add_action('mp_cleanup_rate_limits', function() {
    global $wpdb;
    $wpdb->query("DELETE FROM {$wpdb->options}
        WHERE option_name LIKE '_transient_mp_rate_%'
        OR option_name LIKE '_transient_timeout_mp_rate_%'
        AND option_value < UNIX_TIMESTAMP()");
});
if (!wp_next_scheduled('mp_cleanup_rate_limits')) {
    wp_schedule_event(time(), 'daily', 'mp_cleanup_rate_limits');
}
```

---

### 7. WP-Cron Reliability on Shared Hosting
**Problem:**
WP-Cron only fires when someone visits the site. On DreamHost shared, cron jobs for cert reminders, award processing, and assignment auto-assignments may be delayed or missed during low-traffic periods.

**Fix:**
Disable WP-Cron in `wp-config.php` and set up a real server cron:
```
# wp-config.php
define('DISABLE_WP_CRON', true);

# DreamHost cron (every 15 min):
*/15 * * * * wget -q -O - https://yoursite.com/wp-cron.php?doing_wp_cron > /dev/null 2>&1
```

---

### 8. Plugin Activation — 99 Tables in One Shot
**File:** `mentorship-platform.php` (activation hook)

**Problem:**
99 `CREATE TABLE IF NOT EXISTS` statements run synchronously during plugin activation. On shared hosting with slow DB this can hit the PHP execution time limit mid-activation, leaving the database in a partially-created state (white screen / activation failure).

**Fix:**
Split activation into batches using a transient flag to resume across multiple requests, or use an async admin-ajax handler to run table creation in groups of 10–15.

---

## ✅ Already Fixed

- **User list cache never invalidated** — `mp_invalidate_user_caches()` now uses wildcard SQL `DELETE WHERE option_name LIKE '_transient_mp_user_list_%'`
- **Orphaned `delete_transient('mp_user_list_cache')` calls** — Replaced with `mp_invalidate_user_caches()` in `api-routes.php` (×2) and `api-routes-professional-growth.php` (×4)
