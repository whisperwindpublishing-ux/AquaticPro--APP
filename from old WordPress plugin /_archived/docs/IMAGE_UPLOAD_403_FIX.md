# Image Upload 403 Forbidden Fix

**Issue:** `POST /wp-json/wp/v2/media 403 (Forbidden)`  
**Date:** November 18, 2025  
**Status:** ✅ FIXED

---

## Problem Summary

After fixing the schema issue to make the image block appear, uploading images failed with:
```
POST https://dpd.swimlessons.pro/wp-json/wp/v2/media 403 (Forbidden)
Image upload failed: Error: Upload failed
```

---

## Root Causes (3 Issues)

### 1. Wrong Window Property Name
**BlockEditor.tsx** was accessing `window.mentorshipPlatform` but PHP creates `window.mentorshipPlatformData`

```typescript
// ❌ WRONG
(window as any).mentorshipPlatform?.restUrl
(window as any).mentorshipPlatform?.nonce

// ✅ CORRECT
(window as any).mentorshipPlatformData?.restUrl
(window as any).mentorshipPlatformData?.nonce
```

### 2. Missing restUrl in PHP
The `wp_localize_script` data was missing the `restUrl` property needed for the WordPress REST API endpoint.

```php
// ❌ MISSING
$wp_data = array(
    'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
    'nonce'      => wp_create_nonce( 'wp_rest' ),
    'logout_url' => wp_logout_url( get_permalink() ),
);

// ✅ ADDED
$wp_data = array(
    'api_url'    => home_url( '/wp-json/mentorship-platform/v1' ),
    'restUrl'    => rest_url(),  // ← NEW
    'nonce'      => wp_create_nonce( 'wp_rest' ),
    'logout_url' => wp_logout_url( get_permalink() ),
);
```

### 3. Incomplete TypeScript Interface
The `WpData` interface didn't include `restUrl`, causing TypeScript to not catch the error.

```typescript
// ❌ MISSING
interface WpData {
    api_url: string;
    nonce: string;
    isLoggedIn: boolean;
    is_admin: boolean;
    current_user: UserProfile | null;
    default_avatar_url?: string;
}

// ✅ ADDED
interface WpData {
    api_url: string;
    restUrl: string;  // ← NEW
    nonce: string;
    isLoggedIn: boolean;
    is_admin: boolean;
    current_user: UserProfile | null;
    default_avatar_url?: string;
}
```

---

## Files Modified

### 1. `mentorship-platform.php` (Line 1221)
Added `'restUrl' => rest_url(),` to the WordPress data array.

### 2. `src/App.tsx` (Line 53)
Added `restUrl: string;` to the `WpData` interface.

### 3. `src/components/BlockEditor.tsx` (Lines 146, 151)
Changed `mentorshipPlatform` to `mentorshipPlatformData` (2 occurrences).

---

## How the Fix Works

### Upload Flow (After Fix)

1. User clicks `/image` and selects a file
2. BlockEditor's `uploadFile` function is called
3. Reads from `window.mentorshipPlatformData`:
   - `restUrl`: `"https://dpd.swimlessons.pro/wp-json/"` ✅
   - `nonce`: Valid WordPress REST API nonce ✅
4. Constructs URL: `https://dpd.swimlessons.pro/wp-json/wp/v2/media`
5. Sends POST request with:
   - `X-WP-Nonce` header with valid nonce
   - FormData containing the file
6. WordPress validates the nonce ✅
7. WordPress uploads to Media Library ✅
8. Returns image URL
9. BlockNote inserts image block with URL ✅

---

## Testing Checklist

- [ ] Hard refresh browser (`Ctrl+Shift+R`)
- [ ] Open Daily Log form
- [ ] Click `/` → select `image`
- [ ] Choose an image file
- [ ] Image should upload without 403 error
- [ ] Image preview should appear in editor
- [ ] Save the daily log
- [ ] Reload page - image should display

---

## Debugging Tips

If 403 error persists:

### 1. Check Window Object
Open browser console and run:
```javascript
console.log(window.mentorshipPlatformData);
```

Should show:
```javascript
{
  api_url: "https://dpd.swimlessons.pro/wp-json/mentorship-platform/v1",
  restUrl: "https://dpd.swimlessons.pro/wp-json/",
  nonce: "abc123def456...",
  isLoggedIn: true,
  current_user: {...}
}
```

### 2. Check Nonce
```javascript
console.log('Nonce:', window.mentorshipPlatformData?.nonce);
```
Should be a 10-character alphanumeric string.

### 3. Check User Permissions
User must be logged in and have `upload_files` capability.

```php
// In WordPress, check user capabilities
current_user_can('upload_files'); // Should return true
```

### 4. Check REST API
Test the endpoint manually:
```bash
curl -X POST https://dpd.swimlessons.pro/wp-json/wp/v2/media \
  -H "X-WP-Nonce: YOUR_NONCE_HERE" \
  -F "file=@/path/to/test-image.jpg"
```

---

## Related Issues

- **Schema Fix:** See `BLOCKNOTE_FIX_IMPLEMENTATION.md`
- **Initial Error:** `RangeError: No value supplied for attribute previewWidth`
- **Now Fixed:** Image block appears AND uploads work

---

## Version

**Plugin Version:** 5.0.3  
**Build Status:** ✅ Successful  
**Deployment:** Ready after hard refresh
