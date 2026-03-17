# BlockNote Fix - Visual Diagram

## The Structural Issue

### OLD CODE (BROKEN) - Line 22 was the Problem

```
BlockEditor.tsx (OLD - Lines 14-38)
│
├─ const schema = BlockNoteSchema.create({
│  │
│  └─ blockSpecs: {
│     │
│     └─ image: {
│        │
│        ├─ ...defaultBlockSpecs.image        ← Spreads entire image spec
│        │  │
│        │  ├─ config: { ... }
│        │  ├─ key: "image"
│        │  └─ ... other properties
│        │
│        └─ propSchema: {                      ← ⚠️ WRONG LEVEL (Line 22)
│           │                                     This property doesn't
│           │                                     exist here!
│           ├─ ...defaultBlockSpecs.image.propSchema  ← Returns UNDEFINED
│           │
│           └─ previewWidth: { default: 512 }   ← Never applied
│              (This code never runs)
```

### NEW CODE (FIXED) - Lines 20-30

```
BlockEditor.tsx (NEW - Lines 14-61)
│
├─ const schema = BlockNoteSchema.create({
│  │
│  └─ blockSpecs: {
│     │
│     └─ image: {
│        │
│        ├─ ...defaultBlockSpecs.image        ← Spreads entire image spec
│        │
│        └─ config: {                         ← ✅ ACCESS CONFIG FIRST
│           │
│           ├─ ...defaultBlockSpecs.image.config    ← Spreads config
│           │
│           └─ propSchema: {                  ← ✅ NOW at correct level
│              │
│              ├─ ...defaultBlockSpecs.image.config.propSchema
│              │  │
│              │  ├─ textAlignment: { ... }
│              │  ├─ url: { ... }
│              │  ├─ caption: { ... }
│              │  ├─ showPreview: { ... }
│              │  └─ previewWidth: { default: undefined }  ← Existing
│              │
│              └─ previewWidth: {             ← ✅ OVERRIDE APPLIED
│                 default: 512,               ✅ Works!
│                 type: "number"
│              }
```

---

## Comparison Table

| Aspect | OLD (BROKEN) | NEW (FIXED) |
|--------|-------------|-----------|
| Access path | `.propSchema` | `.config.propSchema` |
| Line number | 22 | 22-30 |
| Spread target | `defaultBlockSpecs.image.propSchema` | `defaultBlockSpecs.image.config.propSchema` |
| Result | `undefined` | Correct object |
| Override applied | ❌ NO | ✅ YES |
| User impact | ❌ Images broken | ✅ Images work |
| Type annotation | None | `type: "number"` |
| Blocks fixed | 1 (image) | 3 (image, video, list) |
| Content sanitization | ❌ No | ✅ Yes |

---

## Data Flow Comparison

### OLD FLOW (BROKEN)

```
User clicks /image
    ↓
BlockNote attempts to create image block
    ↓
Schema creation runs:
    ├─ Tries: ...defaultBlockSpecs.image.propSchema
    ├─ Gets: undefined
    └─ previewWidth override: NOT APPLIED ❌
    ↓
BlockNote uses defaultBlockSpecs.image with broken upstream values
    ├─ previewWidth: { default: undefined }
    └─ (Tiptap rejects undefined)
    ↓
❌ RangeError: No value supplied for attribute previewWidth
```

### NEW FLOW (FIXED)

```
User clicks /image
    ↓
BlockNote attempts to create image block
    ↓
Schema creation runs:
    ├─ Accesses: defaultBlockSpecs.image.config.propSchema
    ├─ Gets: Correct propSchema object
    └─ previewWidth override: APPLIED ✅
       └─ previewWidth: { default: 512, type: "number" }
    ↓
BlockNote uses overridden schema
    ├─ previewWidth: { default: 512 }  ✅
    └─ Tiptap validates: OK ✅
    ↓
✅ Image block created successfully
```

---

## The Three Fixes in One

### 1. Image Block Fix
```
Image {
    config {
        propSchema {
            previewWidth: default 512  ← Was: undefined
        }
    }
}
```

### 2. Video Block Fix
```
Video {
    config {
        propSchema {
            previewWidth: default 512  ← Was: undefined
        }
    }
}
```

### 3. Numbered List Fix
```
NumberedListItem {
    config {
        propSchema {
            start: default 1  ← Was: undefined
        }
    }
}
```

---

## Sanitization Layer (NEW)

### Legacy Saved Content Problem
```
Saved JSON (from old API)
{
  type: "image",
  props: {
    url: "https://...",
    previewWidth: undefined  ← Missing required value
  }
}
```

### After Sanitization
```
const sanitizeContent = (raw) => {
  return raw.map(block => {
    if (block.type === 'image') {
      if (block.props.previewWidth === undefined) {
        block.props.previewWidth = 512  ✅ Fixed
      }
    }
    return block
  })
}

Result:
{
  type: "image",
  props: {
    url: "https://...",
    previewWidth: 512  ✅ Fixed
  }
}
```

---

## File Structure Before & After

### BEFORE
```
src/components/BlockEditor.tsx
├── Imports (3)
├── Interface BlockEditorProps
├── export const BlockEditor
│  ├── const editor = useCreateBlockNote({
│  │  └── schema (BROKEN)
│  │     └── blockSpecs
│  │        └── image: propSchema at wrong level
│  ├── handleChange()
│  └── return JSX
└── export default BlockEditor
```

### AFTER
```
src/components/BlockEditor.tsx
├── Imports (4) - Now includes BlockNoteSchema, defaultBlockSpecs
├── Interface BlockEditorProps
├── const schema = BlockNoteSchema.create({  ← MOVED OUTSIDE (optimization)
│  └── blockSpecs (FIXED)
│     ├── image: config.propSchema ✅
│     ├── video: config.propSchema ✅
│     └── numberedListItem: config.propSchema ✅
├── export const BlockEditor
│  ├── const sanitizeContent = () { ... }  ← NEW
│  ├── const editor = useCreateBlockNote({
│  │  └── schema (FIXED)
│  │  └── initialContent: sanitizeContent(...)  ← NEW
│  ├── handleChange()
│  └── return JSX
└── export default BlockEditor
```

---

## Line-by-Line Comparison

| Line Range | OLD | NEW | Change |
|-----------|-----|-----|--------|
| 1-7 | Import statements | Import statements + BlockNoteSchema | Added imports |
| 8-12 | Interface definition | Interface definition | Same |
| 14-38 | Schema at component level | Schema outside component | Moved to top-level |
| 14-61 | — | Schema with fixed structure | Added .config level |
| 22 | `propSchema: {` | `config: { propSchema: {` | **KEY FIX** |
| 25 | `...defaultBlockSpecs.image.propSchema,` | `...defaultBlockSpecs.image.config.propSchema,` | **KEY FIX** |
| 39 | (not there) | (not there) | Video same pattern |
| 53 | (not there) | (not there) | List fix |
| 64+ | Component definition | Component definition + sanitization | Added sanitizeContent |
| 133 | `initialContent: initialContent \|\| undefined` | `initialContent: sanitizeContent(initialContent)` | Use sanitization |

---

## Why This Fix Is Complete

```
PROBLEM: RangeError: No value supplied for attribute previewWidth
    │
    ├─ ROOT CAUSE 1: Tiptap v3.11.x rejects undefined defaults
    │  └─ ADDRESSED: By providing explicit defaults (512, 1)
    │
    ├─ ROOT CAUSE 2: Wrong nesting level in schema
    │  └─ ADDRESSED: Changed to correct .config.propSchema path
    │
    └─ ROOT CAUSE 3: Legacy data might have missing props
       └─ ADDRESSED: Added sanitizeContent() function

RESULT: ✅ All three issues fixed in one update
```

---

## Deployment Verification Checklist

- [ ] Line 20: Contains `config: {`
- [ ] Line 23: Contains `...defaultBlockSpecs.image.config,`
- [ ] Line 25: Contains `...defaultBlockSpecs.image.config.propSchema,`
- [ ] Line 27-29: Contains `previewWidth: { default: 512, type: "number" }`
- [ ] Lines 32-42: Video block has same structure
- [ ] Lines 44-54: NumberedListItem has same structure
- [ ] Lines 90-130: sanitizeContent function exists
- [ ] Line 133: `initialContent: sanitizeContent(initialContent)`
- [ ] Build shows: "✓ built in X.XXs"
- [ ] No TypeScript errors in build output

✅ All checks pass = Fix is correctly deployed
