# BlockNote Schema Structure - Before vs After

## The Critical Issue: Line 22 (Old Code)

### ❌ BEFORE (BROKEN)
```typescript
// Line 14-38: OLD INCORRECT STRUCTURE
const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        image: {
            ...defaultBlockSpecs.image,
            propSchema: {  // ⚠️ LINE 22: WRONG LEVEL!
                ...defaultBlockSpecs.image.propSchema,  // This property doesn't exist here
                previewWidth: {
                    default: 512,  // This override never works
                }
            }
        },
        // ... video block similarly broken
    }
});
```

**Why This Failed:**
- `defaultBlockSpecs.image` is a block **config object**, not the config itself
- It doesn't have a direct `propSchema` property at that level
- The spread operator `...defaultBlockSpecs.image.propSchema` returns `undefined`
- BlockNote never sees your `previewWidth: { default: 512 }` override
- When inserting image, Tiptap uses the broken upstream default: `previewWidth: { default: undefined }`
- ProseMirror validates the attribute and throws: **RangeError: No value supplied for attribute previewWidth**

---

### ✅ AFTER (FIXED)
```typescript
// Line 14-61: NEW CORRECT STRUCTURE
const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        image: {
            ...defaultBlockSpecs.image,
            config: {  // ← ACCESS CONFIG FIRST
                ...defaultBlockSpecs.image.config,
                propSchema: {  // NOW we're at the right level
                    ...defaultBlockSpecs.image.config.propSchema,  // This works!
                    previewWidth: {
                        default: 512,  // ✅ This override now applies
                        type: "number" as const,  // Explicit type for safety
                    },
                },
            },
        },
        video: {
            ...defaultBlockSpecs.video,
            config: {
                ...defaultBlockSpecs.video.config,
                propSchema: {
                    ...defaultBlockSpecs.video.config.propSchema,
                    previewWidth: {
                        default: 512,
                        type: "number" as const,
                    },
                },
            },
        },
        numberedListItem: {  // Same issue with start attribute
            ...defaultBlockSpecs.numberedListItem,
            config: {
                ...defaultBlockSpecs.numberedListItem.config,
                propSchema: {
                    ...defaultBlockSpecs.numberedListItem.config.propSchema,
                    start: {
                        default: 1,
                        type: "number" as const,
                    },
                },
            },
        },
    },
});
```

**Why This Works:**
- Correctly accesses the nested `.config.propSchema` structure
- Spreads the **actual** existing propSchema from the right location
- Your `previewWidth: { default: 512 }` override is now properly merged
- Tiptap sees the correct default value
- ProseMirror validation passes ✅
- Image/video insertion works!

---

## Object Structure Hierarchy

### BlockNote's Internal Structure
```
defaultBlockSpecs.image (entire block spec)
  └── config (block configuration)
      └── propSchema (property definitions)
          ├── textAlignment: { default: "left" }
          ├── backgroundColor: { default: "default" }
          ├── url: { default: "" }
          ├── caption: { default: "" }
          ├── showPreview: { default: true }
          └── previewWidth: { default: undefined }  ← PROBLEM: undefined!
```

### What Your Old Code Tried
```
defaultBlockSpecs.image
  └── propSchema  ← DOESN'T EXIST HERE
      └── ...
```

### What Your New Code Does
```
defaultBlockSpecs.image
  └── config
      └── propSchema  ← EXISTS HERE ✅
          └── previewWidth: { default: 512 }
```

---

## Content Sanitization (New Feature)

### Why It's Important
Some Daily Logs might have been saved with incomplete data (e.g., from API errors). The `sanitizeContent()` function ensures:

```typescript
// LEGACY SAVED CONTENT (broken)
const oldBlocks = [
  {
    type: 'image',
    props: {
      url: 'https://example.com/image.jpg',
      previewWidth: undefined  // ← Missing! Causes error
    }
  }
];

// AFTER SANITIZATION (fixed)
const sanitizedBlocks = [
  {
    type: 'image',
    props: {
      url: 'https://example.com/image.jpg',
      previewWidth: 512  // ← Added automatically
    }
  }
];
```

**Sanitization Rules:**
1. Check if `previewWidth` is `undefined` or `null`
2. If so, set to `512` (default safe value)
3. Does the same for numbered list `start` attribute
4. Applies to: image, video, audio, file blocks

---

## Tiptap v3.11.x Regression Explanation

### Tiptap Changed Attribute Validation
- **Before (v3.10.x):** Allowed `undefined` as attribute defaults
- **After (v3.11.x):** Rejects `undefined` - requires actual values
- **BlockNote v0.42.1** uses Tiptap v3.11.x
- **BlockNote v0.42.0** also affected
- **Fix available in:** v0.43.0+ (waiting on Tiptap PR approval)

### The Validation Flow
```
User clicks /image command
    ↓
BlockNote creates new image block
    ↓
Tiptap validates block attributes
    ↓
ProseMirror checks: previewWidth has value?
    ↓
OLD: finds `undefined` → allows it
NEW: finds `undefined` → RangeError!
    ↓
⚠️ RangeError: No value supplied for attribute previewWidth
```

---

## Key Differences in v0.42.1

| Aspect | v0.41.x | v0.42.1 | Our Fix |
|--------|---------|---------|---------|
| `propSchema` location | Direct or under config | Only under config | Uses `.config.propSchema` |
| `previewWidth` default | `undefined` | `undefined` | `512` |
| `start` default | `undefined` | `undefined` | `1` |
| Tiptap dependency | v3.10.x | v3.11.x | Works with both |
| Image uploads | ✅ Working | ❌ Broken | ✅ Fixed |
| Old content loading | ✅ OK | ❌ Errors | ✅ Sanitized |

---

## Quick Reference

### If image/video uploads fail again:
1. Verify line 14-61 in `src/components/BlockEditor.tsx`
2. Check `.config.` is present before `propSchema`
3. Ensure `type: "number"` annotation exists
4. Run `npm run build`
5. Hard refresh browser: `Ctrl+Shift+R`

### If errors still appear:
1. Check browser console - copy exact error
2. Verify `build/assets/mentorship-app.js` was rebuilt
3. Check if page is caching old JavaScript
4. Try incognito/private window to test
