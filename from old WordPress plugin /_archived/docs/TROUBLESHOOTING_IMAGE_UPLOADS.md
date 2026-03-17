# BlockNote Image Upload - Troubleshooting Guide

**Last Updated:** November 18, 2025

---

## ✅ Fix Applied

The critical bug in `BlockEditor.tsx` has been fixed:

| Item | Status |
|------|--------|
| Schema `.config.propSchema` structure | ✅ Fixed (line 20-61) |
| Image block previewWidth default | ✅ Set to 512 |
| Video block previewWidth default | ✅ Set to 512 |
| Numbered list start attribute | ✅ Set to 1 |
| Content sanitization | ✅ Added |
| Build status | ✅ Completed (v5.0.3) |

---

## Quick Test

### Test Image Upload (1 minute)
1. Open a Daily Log form
2. Click `/` to open slash commands
3. Type `image` and select `/image`
4. **Expected:** Image upload dialog appears
5. **If broken:** Check browser console for RangeError

### Test Video Upload
1. Click `/` for slash commands
2. Type `video` and select `/video`
3. **Expected:** Video upload dialog appears

### Test Numbered Lists
1. Click `/` for slash commands
2. Type `list` and select `/numbered list`
3. **Expected:** Numbered list starts at 1

---

## Troubleshooting Steps

### Issue: Still Getting RangeError

**Step 1: Clear Cache**
- Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or: Open DevTools → Settings → Network → check "Disable cache"

**Step 2: Verify Build**
```bash
# Run this in terminal
npm run build

# Should show: "✓ built in X.XXs"
# Should NOT show errors
```

**Step 3: Check File Was Updated**
```bash
# Verify the build contains the fix
grep -n "config: {" /path/to/build/assets/mentorship-app.js | head -5

# Should show references to config objects
```

**Step 4: Verify Plugin Version**
- In WordPress, check that the plugin version is 5.0.3
- In page source (Ctrl+U), verify the script tag shows `?ver=5.0.3`

**Step 5: Check Console for Errors**
- Open Browser DevTools (F12)
- Go to Console tab
- Look for ANY errors related to BlockNote, Tiptap, or ProseMirror
- Copy the EXACT error message

### Issue: Image Uploads But Doesn't Show

**Check:**
1. Is the WordPress Media Library working? (try uploading media in WordPress admin)
2. Do you have an API nonce? (check `mentorshipPlatformData` in page source)
3. Is the upload function being called? (add `console.log()` to verify)

### Issue: All Blocks Working But Specific Type Broken

**Check which block:**
- Image broken? (previewWidth issue)
- Video broken? (previewWidth issue)
- Numbered list broken? (start attribute issue)
- Something else? (might be separate issue)

---

## Code Changes Summary

### What Changed

**File:** `src/components/BlockEditor.tsx`

**Key Changes:**
1. **Lines 20-30:** Image block now uses `.config.propSchema`
2. **Lines 32-42:** Video block now uses `.config.propSchema`
3. **Lines 44-54:** Numbered list now has `start: { default: 1 }`
4. **Lines 90-130:** New `sanitizeContent()` function to handle legacy data

### What's the Same
- WordPress media upload still works the same
- Component props unchanged
- BlockNote version still 0.42.1
- No new dependencies

---

## Version Information

```
BlockNote:         v0.42.1
@blocknote/core:   ^0.42.1
@blocknote/react:  ^0.42.1
@blocknote/mantine: ^0.42.1
Tiptap:            v3.11.x (via BlockNote dependencies)
React:             ^18.2.0
Plugin Version:    5.0.3
```

---

## Still Not Working?

### Collect Debug Information

1. **Error Message** (from console)
   - What's the exact error?
   - Which line number in mentorship-app.js?

2. **Reproduction Steps**
   - What exactly do you click?
   - What data do you enter?

3. **File Verification**
   ```bash
   # Check if BlockEditor.tsx has the fix
   grep -A 5 "config: {" /path/to/src/components/BlockEditor.tsx | head -10
   ```

4. **Network Check**
   - Open DevTools → Network tab
   - Click `/image`
   - Are there any failed network requests?
   - What's the response status?

5. **WordPress Setup**
   - Can you upload media normally in WordPress admin?
   - Is the REST API endpoint accessible?
   - Do you have upload permissions?

### Report Issue

Include:
- [ ] Exact error message from console
- [ ] Browser and version
- [ ] WordPress version
- [ ] Output of: `npm run build`
- [ ] Output of: `grep "config: {" src/components/BlockEditor.tsx`

---

## References

- **Related Issue:** GitHub TypeCellOS/BlockNote#2170
- **Root Cause:** Tiptap v3.11.x regression
- **Documentation:** See `BLOCKNOTE_FIX_IMPLEMENTATION.md`
- **Detailed Explanation:** See `BLOCKNOTE_SCHEMA_FIX_DETAILED.md`

---

## When This Will Be Fixed Upstream

- **BlockNote v0.43.0+** will include the Tiptap fix
- Timeline: Waiting for Tiptap PR approval
- Our workaround works with all versions

Until then, our `.config.propSchema` override handles it perfectly!
