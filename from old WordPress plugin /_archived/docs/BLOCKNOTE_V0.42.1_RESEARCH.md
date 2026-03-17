# BlockNote v0.42.1 Custom Image & Video Blocks - Research & Solutions

**Last Updated:** November 18, 2025  
**Research Date:** v0.42.1 (released today)  
**Repository:** TypeCellOS/BlockNote

## Executive Summary

BlockNote v0.42.1 is experiencing a **critical upstream issue** with the Tiptap v3.11.x library where `previewWidth` is defined with `default: undefined`, but ProseMirror/Tiptap now strictly requires all attributes to have a non-undefined value. This causes a `RangeError: No value supplied for attribute previewWidth` when inserting image/video blocks.

**Status:** The issue is NOT in BlockNote's code—it's a Tiptap regression. A temporary workaround is to override the propSchema in your schema configuration.

---

## 1. The Correct Structure for `previewWidth` in BlockNote v0.42.1

### propSchema Definition (Current)

From the actual v0.42.1 source code in `node_modules/@blocknote/core/src/blocks/Image/block.ts`:

```typescript
propSchema: {
  textAlignment: defaultProps.textAlignment,
  backgroundColor: defaultProps.backgroundColor,
  name: {
    default: "" as const,
  },
  url: {
    default: "" as const,
  },
  caption: {
    default: "" as const,
  },
  showPreview: {
    default: true,
  },
  // File preview width in px.
  previewWidth: {
    default: undefined,          // ⚠️ THIS IS THE PROBLEM
    type: "number" as const,
  },
},
```

### Expected Structure (per documentation)

The official BlockNote documentation states:
- `previewWidth: number = 512` (should default to 512, not undefined)

### propSchema Structure Explained

Each property in `propSchema` follows this pattern:

```typescript
propertyName: {
  default: <value>,              // The default value when block is created
  type?: <"string" | "number" | ...>,  // Optional type annotation
  values?: readonly [...]        // Optional: for enum-like values
}
```

**Key Point:** `previewWidth` is a **prop** (not a rendering option), defined in the `propSchema`, which is part of the block's configuration object.

---

## 2. Is `previewWidth` Part of propSchema?

**YES.** `previewWidth` is absolutely part of the `propSchema`.

### Structure Hierarchy:

```typescript
BlockNoteSchema.create({
  blockSpecs: {
    image: {
      // ✅ propSchema is nested under config, OR directly in createImageBlockConfig return
      config: {
        propSchema: {
          previewWidth: { default: 512 }  // ✅ Here it is
        }
      }
      // OR directly:
      propSchema: {
        previewWidth: { default: 512 }    // ✅ Also here
      }
    }
  }
})
```

### The propSchema for Image/Video Blocks:

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `textAlignment` | `"left" \| "center" \| "right" \| "justify"` | `"left"` | Alignment of content |
| `backgroundColor` | `string` (color name) | `"default"` | Background color |
| `name` | `string` | `""` | File name/alt text |
| `url` | `string` | `""` | File URL |
| `caption` | `string` | `""` | File caption |
| `showPreview` | `boolean` | `true` | Show preview or link-only |
| `previewWidth` | `number \| undefined` | `undefined` ⚠️ | Preview width in pixels |

---

## 3. How to Properly Override `defaultBlockSpecs`

### Current Your Implementation (BlockEditor.tsx)

Your current approach in `BlockEditor.tsx` is **almost correct**, but there's a structural issue:

```typescript
// ❌ This accesses the wrong structure in v0.42.1
const schema = BlockNoteSchema.create({
  blockSpecs: {
    image: {
      ...defaultBlockSpecs.image,
      propSchema: {  // ⚠️ This is trying to merge at the wrong level
        ...defaultBlockSpecs.image.propSchema,  // This might fail
        previewWidth: {
          default: 512,
        }
      }
    }
  }
});
```

### Correct Implementation (v0.42.1)

```typescript
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';

// Option 1: Override propSchema directly (RECOMMENDED)
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    image: {
      ...defaultBlockSpecs.image,
      config: {
        ...defaultBlockSpecs.image.config,
        propSchema: {
          ...defaultBlockSpecs.image.config.propSchema,
          previewWidth: {
            default: 512,
            type: "number" as const,
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
  },
});
```

### Alternative: Using Block Specs

If `defaultBlockSpecs.image` doesn't have a `.config` property and is already the spec:

```typescript
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    image: createImageBlockSpec({
      // Custom config here
    }),
    video: createVideoBlockSpec({
      // Custom config here
    }),
  },
});
```

---

## 4. Known Issues with Image/Video Uploads in BlockNote v0.42.1

### Primary Issue: Tiptap v3.11.x Regression (🔴 CRITICAL)

**Issue:** GitHub Issue #2170  
**Status:** Open (root cause identified)  
**Affected Version:** v0.42.1, v0.41.1, v0.42.0  
**Root Cause:** Tiptap v3.11.x no longer accepts `undefined` as an attribute default value

**Error Message:**
```
RangeError: No value supplied for attribute previewWidth
```

This occurs when:
1. Creating a new image/video block using the `/image` command
2. Loading saved content with incomplete props
3. Any operation that triggers ProseMirror attribute validation

### Related Issues

1. **Numbered List `start` Attribute** - Same issue with `start` attribute on `numberedListItem`
2. **Content Sanitization** - Loaded JSON may have blocks missing required props
3. **Tiptap Upstream** - PR submitted to Tiptap to allow `undefined`: [ueberdosis/tiptap#7236](https://github.com/ueberdosis/tiptap/pull/7236)

---

## 5. Example Code: Proper Implementation

### Complete Fixed BlockEditor Component

```typescript
import React from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

interface BlockEditorProps {
  initialContent?: any;
  onChange?: (content: any) => void;
  editable?: boolean;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  initialContent,
  onChange,
  editable = true
}) => {
  // Create schema with previewWidth default value fix
  // This works around the Tiptap v3.11.x regression
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      // Override image block to provide previewWidth default
      image: {
        ...defaultBlockSpecs.image,
        config: {
          ...defaultBlockSpecs.image.config,
          propSchema: {
            ...defaultBlockSpecs.image.config.propSchema,
            previewWidth: {
              default: 512,
              type: "number" as const,
            },
          },
        },
      },
      // Override video block to provide previewWidth default
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
      // Optional: Fix numbered list start attribute
      numberedListItem: {
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

  // Sanitize content before passing to editor
  // This handles saved content with missing required props
  const sanitizeContent = (raw: string | undefined) => {
    if (!raw) return undefined;

    const fallback = [
      {
        type: 'paragraph',
        props: { 
          textColor: 'default', 
          backgroundColor: 'default', 
          textAlignment: 'left' 
        },
        content: [{ type: 'text', text: '', styles: {} }],
      },
    ];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback;

      return parsed.map((block: any) => {
        const props = block.props ?? {};

        // Fix image/video blocks missing previewWidth
        if (['image', 'video', 'audio', 'file'].includes(block.type)) {
          if (props.previewWidth === undefined) {
            props.previewWidth = 512;
          }
        }

        // Fix numbered list items missing start
        if (block.type === 'numberedListItem') {
          if (props.start === undefined) {
            props.start = 1;
          }
        }

        return { ...block, props };
      });
    } catch (error) {
      console.warn('Failed to sanitize content:', error);
      return fallback;
    }
  };

  const editor = useCreateBlockNote({
    schema,
    initialContent: sanitizeContent(
      typeof initialContent === 'string' 
        ? initialContent 
        : JSON.stringify(initialContent)
    ),
    uploadFile: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(
          `${(window as any).mentorshipPlatform?.restUrl || '/wp-json/'}wp/v2/media`,
          {
            method: 'POST',
            headers: {
              'X-WP-Nonce': (window as any).mentorshipPlatform?.nonce || ''
            },
            body: formData
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const media = await response.json();
        return media.source_url;
      } catch (error) {
        console.error('Image upload failed:', error);
        throw error;
      }
    }
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="block-editor">
      <BlockNoteView 
        editor={editor} 
        onChange={() => {
          const content = editor.topLevelBlocks;
          onChange?.(content);
        }}
        editable={editable}
      />
    </div>
  );
};

export default BlockEditor;
```

### Minimal Fix Example

If you just want the minimal fix without all the sanitization:

```typescript
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    image: {
      ...defaultBlockSpecs.image,
      config: {
        ...defaultBlockSpecs.image.config,
        propSchema: {
          ...defaultBlockSpecs.image.config.propSchema,
          previewWidth: { default: 512 },
        },
      },
    },
    video: {
      ...defaultBlockSpecs.video,
      config: {
        ...defaultBlockSpecs.video.config,
        propSchema: {
          ...defaultBlockSpecs.video.config.propSchema,
          previewWidth: { default: 512 },
        },
      },
    },
  },
});

const editor = useCreateBlockNote({
  schema,
  initialContent: initialContent || undefined,
});
```

---

## 6. Inserting Blocks with Proper Props

When programmatically inserting image/video blocks, always provide `previewWidth`:

```typescript
// ✅ Correct: Always provide previewWidth
editor.insertBlocks([{
  type: "image",
  props: {
    url: "https://example.com/image.jpg",
    previewWidth: 512,
    caption: "My image",
    showPreview: true,
    name: "image.jpg",
    textAlignment: "left",
    backgroundColor: "default"
  },
}]);

// ❌ Wrong: Missing previewWidth causes error
editor.insertBlocks([{
  type: "image",
  props: {
    url: "https://example.com/image.jpg",
    // previewWidth missing - will fail!
  },
}]);
```

---

## 7. Workarounds & Temporary Fixes

### Option 1: Use Schema Override (RECOMMENDED) ✅
Apply the schema override as shown above. This is the most robust solution.

### Option 2: Downgrade Tiptap (Temporary) ⚠️
```json
{
  "overrides": {
    "@tiptap/core": "3.10.2",
    "@tiptap/extensions": "3.10.2"
  }
}
```

This works but is not a permanent solution—Tiptap will eventually fix the issue.

### Option 3: Downgrade BlockNote (Not Recommended) ❌
Downgrading BlockNote to v0.41.0 may work but has its own issues. Better to override the schema in v0.42.1.

---

## 8. What the Documentation Claims vs Reality

| Aspect | Documentation Says | Reality in v0.42.1 |
|--------|-------------------|-------------------|
| `previewWidth` default | `512` (number) | `undefined` (bug) |
| Structure | Part of propSchema | ✅ Correct |
| Type | `number` | ✅ Correct |
| Requirement | Optional | ⚠️ Required by Tiptap |

---

## 9. Testing the Fix

### Test 1: Creating New Image Block
```typescript
// This should work after the fix
editor.insertBlocks([{
  type: "image",
  props: { url: "test.jpg" }
}]);
```

### Test 2: Loading Saved Content
```typescript
// Content loaded from database that previously failed
const editor = useCreateBlockNote({
  schema,
  initialContent: savedContent, // Should handle missing previewWidth
});
```

### Test 3: Slash Menu
```
Type: /image
Select an image from upload
// Should not throw RangeError
```

---

## 10. Migration & Future Fixes

### What's Happening Upstream
- **Tiptap:** PR #7236 submitted to allow `undefined` defaults
- **BlockNote:** Waiting for Tiptap fix, or will implement workaround
- **Expected Timeline:** Resolution expected in a future BlockNote release

### Current Best Practice
Use the schema override approach shown in this document until Tiptap releases their fix.

---

## Summary

| Question | Answer |
|----------|--------|
| **Is previewWidth in propSchema?** | ✅ YES |
| **What's the correct default?** | 512 (or any number, not undefined) |
| **Where is the bug?** | Tiptap v3.11.x upstream |
| **What's the fix?** | Override propSchema with default: 512 |
| **Is this BlockNote's fault?** | ❌ NO - it's a Tiptap regression |
| **When will it be fixed?** | When Tiptap or BlockNote updates |

---

## References

- GitHub Issue: [TypeCellOS/BlockNote#2170](https://github.com/TypeCellOS/BlockNote/issues/2170)
- Attempted PR Fix: [TypeCellOS/BlockNote#2171](https://github.com/TypeCellOS/BlockNote/pull/2171) (closed)
- Upstream Tiptap Issue: [ueberdosis/tiptap#7236](https://github.com/ueberdosis/tiptap/pull/7236)
- BlockNote Repository: [TypeCellOS/BlockNote](https://github.com/TypeCellOS/BlockNote)
- v0.42.1 Release: Released Nov 18, 2025

