# LMS + Excalidraw Implementation Guide

> **Purpose**: Everything needed to rebuild the lesson system with Excalidraw visual slides, hybrid text+visual mode, scroll sync, and mobile support — without repeating the hours of debugging from the original implementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model](#2-data-model)
3. [Excalidraw Integration — The Hard Parts](#3-excalidraw-integration--the-hard-parts)
4. [Lesson Types](#4-lesson-types)
5. [Excalidraw-Only Mode (Slides/Presentation)](#5-excalidraw-only-mode-slidespresentation)
6. [Hybrid Mode (Text + Excalidraw Side-by-Side)](#6-hybrid-mode-text--excalidraw-side-by-side)
7. [Scroll Sync Mechanism](#7-scroll-sync-mechanism)
8. [Mobile Implementation](#8-mobile-implementation)
9. [Slide Ordering System](#9-slide-ordering-system)
10. [Save / Load Pipeline](#10-save--load-pipeline)
11. [Gotchas & Bugs We Fixed](#11-gotchas--bugs-we-fixed)
12. [Component Reference](#12-component-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  LMSModule (router)                                         │
│  ├── CourseList          — browse courses                    │
│  ├── CourseBuilder       — admin: create/edit courses        │
│  ├── CourseViewer        — student: view course + lessons    │
│  │   ├── LessonSidebar   — course outline nav               │
│  │   ├── FocusReader     — fullscreen slide-based reading    │
│  │   ├── ExcalidrawPresentation  — excalidraw-only viewing   │
│  │   └── HybridLessonEditor      — text+visual viewing      │
│  ├── LessonBuilder       — admin: create/edit lessons        │
│  │   ├── BlockEditor     — rich text (BlockNote)             │
│  │   ├── ExcalidrawEditor— standalone excalidraw editor      │
│  │   ├── HybridLessonEditor      — text+visual editing      │
│  │   └── QuizEditor      — quiz builder                     │
│  └── StudentAnalytics    — progress tracking                 │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack:**
- **Rich text**: [BlockNote](https://www.blocknotejs.org/) (Tiptap-based block editor)
- **Visual canvas**: [@excalidraw/excalidraw](https://www.npmjs.com/package/@excalidraw/excalidraw) v0.18.x
- **Animations**: framer-motion (for panel transitions)
- **Icons**: react-icons/hi2

---

## 2. Data Model

### Lesson Table (SQL)

```sql
CREATE TABLE lessons (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id       BIGINT,
    section_id      BIGINT NULL,
    title           VARCHAR(255),
    description     TEXT,
    content         LONGTEXT,              -- BlockNote JSON or raw HTML
    lesson_type     ENUM('content','excalidraw','hybrid','quiz'),
    featured_image  VARCHAR(500),
    excalidraw_json LONGTEXT,              -- Full Excalidraw scene JSON
    scroll_cues     LONGTEXT,              -- JSON array of ScrollCue objects
    slide_order     LONGTEXT,              -- JSON array of frame IDs (strings)
    hybrid_layout   VARCHAR(20) DEFAULT 'text-left',  -- 'text-left' | 'text-right'
    split_ratio     FLOAT DEFAULT 0.4,     -- 0.0–1.0, text panel width ratio
    estimated_time  INT,
    display_order   INT DEFAULT 0,
    created_by      BIGINT,
    created_at      DATETIME,
    updated_at      DATETIME
);
```

### Progress Table

```sql
CREATE TABLE progress (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT,
    lesson_id       BIGINT,
    status          ENUM('not-started','in-progress','completed'),
    score           INT DEFAULT 0,
    time_spent_seconds INT DEFAULT 0,
    last_viewed     DATETIME,
    completed_at    DATETIME,
    UNIQUE KEY (user_id, lesson_id)
);
```

### TypeScript Interfaces

```typescript
type LessonType = 'content' | 'excalidraw' | 'hybrid' | 'quiz';

interface Lesson {
    id: number;
    courseId?: number;
    sectionId?: number;
    title: string;
    description?: string;
    content?: string;              // BlockNote JSON string
    type: LessonType;
    featuredImage?: string;
    excalidrawJson?: string;       // Excalidraw scene JSON string
    scrollCues?: ScrollCue[];      // Parsed on read, stringified on write
    slideOrder?: string[];         // Ordered frame IDs
    hybridLayout?: 'text-left' | 'text-right';
    splitRatio?: number;
    estimatedTime?: number;
    order?: number;
    hasExcalidraw?: boolean;       // Lightweight flag on list endpoints
    progress?: LessonProgress;
}

interface ScrollCue {
    id: string;           // Unique ID (e.g. `cue-${Date.now()}`)
    blockId: string;      // BlockNote block's data-id attribute
    frameIndex: number;   // Index into the ordered frames array
    label?: string;       // Human-readable label
}

interface Frame {
    id: string;           // Excalidraw element ID
    name: string;         // Frame name from Excalidraw, or "Slide N"
    element: any;         // Raw Excalidraw element ref (needed for scrollToContent)
}
```

---

## 3. Excalidraw Integration — The Hard Parts

### 🔴 CRITICAL: React Portal Isolation

**The #1 lesson**: Excalidraw manipulates the DOM directly, which **conflicts with React's reconciliation**. If you render `<Excalidraw>` normally inside a React tree that re-renders, React will try to diff/patch DOM nodes that Excalidraw has modified, causing crashes, blank canvases, or lost state.

**Solution**: Render Excalidraw into a **manually-created DOM node** using `createPortal`:

```tsx
import { createPortal } from 'react-dom';

// On mount — create a raw div OUTSIDE React's control
const portalContainerRef = useRef<HTMLDivElement | null>(null);
const [portalReady, setPortalReady] = useState(false);
const mountIdRef = useRef(`excalidraw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

useEffect(() => {
    const container = document.createElement('div');
    container.id = `excalidraw-portal-${mountIdRef.current}`;
    container.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
    portalContainerRef.current = container;

    const timer = setTimeout(() => setPortalReady(true), 50);

    return () => {
        clearTimeout(timer);
        // IMPORTANT: explicitly remove from DOM on unmount
        if (container.parentElement) {
            container.parentElement.removeChild(container);
        }
        portalContainerRef.current = null;
    };
}, []);

// In JSX — the wrapper manually appends the portal container
<div
    ref={(el) => {
        if (el && portalContainerRef.current && !el.contains(portalContainerRef.current)) {
            el.appendChild(portalContainerRef.current);
        }
    }}
    style={{ position: 'relative', width: '100%', height: '100%' }}
>
    {portalReady && portalContainerRef.current && createPortal(
        <Excalidraw
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            initialData={parsedData}
            onChange={handleChange}
            // ... other props
        />,
        portalContainerRef.current
    )}
</div>
```

**Why `mountIdRef`?** Prevents stale references when React strict mode double-mounts or when the component unmounts/remounts during navigation.

### 🔴 CRITICAL: Files Must Be Explicitly Added

Even when you pass `initialData` with `files` to `<Excalidraw>`, **embedded images may not render**. You must ALSO call `excalidrawAPI.addFiles()`:

```tsx
useEffect(() => {
    if (!excalidrawAPI || !parsedData) return;

    // Load scene if canvas is empty
    const currentElements = excalidrawAPI.getSceneElements();
    if (currentElements.length === 0) {
        excalidrawAPI.updateScene(parsedData);
    }

    // Files MUST be added separately — Excalidraw doesn't always pick them up from initialData
    if (parsedData.files && typeof parsedData.files === 'object') {
        const filesArray = Object.values(parsedData.files);
        if (filesArray.length > 0) {
            excalidrawAPI.addFiles(filesArray);
        }
    }
}, [excalidrawAPI, parsedData]);
```

### 🔴 CRITICAL: Type Switching (Editor Mode Transitions)

When switching between lesson types (e.g., `content` → `hybrid`), you **must unmount the old editor before mounting the new one**. Direct swapping causes Excalidraw DOM conflicts.

**Solution**: Two-phase transition with a unique key:

```tsx
const [editorKey, setEditorKey] = useState(0);
const [isTransitioning, setIsTransitioning] = useState(false);

const handleTypeChange = (newType: LessonType) => {
    setIsTransitioning(true);           // Phase 1: unmount current editor
    setType(newType);
    setTimeout(() => {
        setEditorKey(k => k + 1);       // Force fresh mount
        setIsTransitioning(false);      // Phase 2: mount new editor
    }, 100);
};

// In JSX:
{isTransitioning ? <LoadingSpinner /> : (
    <div key={editorKey}>
        {type === 'hybrid' && <HybridLessonEditor ... />}
        {type === 'excalidraw' && <ExcalidrawEditor ... />}
        {/* etc */}
    </div>
)}
```

### API Ref Capture

Store the Excalidraw API in **state** (not a ref) so dependent `useEffect` hooks re-run when it becomes available:

```tsx
const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null);

<Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} />
```

### Asset Path Configuration

Excalidraw needs fonts and icons. Set the asset path before import:

```tsx
if (typeof window !== 'undefined') {
    // Point to your local copy of excalidraw assets, or CDN fallback
    (window as any).EXCALIDRAW_ASSET_PATH = '/path/to/excalidraw/dist/prod/';
}
```

---

## 4. Lesson Types

| Type | Editor Component | Viewer Component | Content Storage |
|------|-----------------|------------------|-----------------|
| `content` | `BlockEditor` (BlockNote) | `BlockEditor` (read-only) or `FocusReader` | `content` field (JSON) |
| `excalidraw` | `ExcalidrawEditor` | `ExcalidrawPresentation` | `excalidraw_json` field |
| `hybrid` | `HybridLessonEditor` (editing) | `HybridLessonEditor` (viewing) | Both `content` + `excalidraw_json` + `scroll_cues` + `slide_order` |
| `quiz` | `QuizEditor` | `QuizPlayer` | `content` field (JSON) |

**Viewer priority chain** (in CourseViewer):
1. Quiz → `QuizPlayer`
2. Hybrid → `HybridLessonEditor isEditing={false}`
3. Excalidraw (or has excalidraw JSON) → `ExcalidrawPresentation`
4. Fallback → `BlockEditor` read-only + optional `FocusReader`

---

## 5. Excalidraw-Only Mode (Slides/Presentation)

### How Frames Become Slides

Excalidraw has a native **Frame** element (`type === 'frame'`). Users create frames on the canvas using Excalidraw's frame tool — each frame becomes a slide.

```typescript
// Extract frames from scene
const elements = excalidrawAPI.getSceneElements();
const frameElements = elements.filter((el: any) => el.type === 'frame');

// Sort by X position (left-to-right = slide order)
const sorted = frameElements.sort((a, b) => a.x - b.x);

// Map to internal Frame type
const frames: Frame[] = sorted.map((el, i) => ({
    id: el.id,
    name: el.name || `Slide ${i + 1}`,
    element: el,  // Keep ref for scrollToContent
}));
```

### Navigating Between Slides

```typescript
const goToFrame = (index: number) => {
    const frame = frames[index];
    excalidrawAPI.scrollToContent(frame.element, {
        fitToViewport: true,
        animate: true,
        duration: 300,
    });
    setCurrentFrameIndex(index);
};
```

### Presentation Controls

- **Prev/Next buttons** with chevron icons
- **Slide counter**: "Slide Name — 3 of 12"
- **Dot indicators** (clickable, hidden on mobile for space)
- **Keyboard**: ArrowLeft/Up = prev, ArrowRight/Down/Space = next, Escape = exit fullscreen
- **Fit-to-content button**: re-zooms to current frame
- **Fullscreen toggle**

### Pointer Events

In slideshow mode (frames exist), **disable canvas interaction** so users can't accidentally pan:

```css
.excalidraw-canvas-wrapper {
    pointer-events: none;
}
```

When no frames exist (free exploration mode), enable interaction with `cursor: grab`.

### Audio-Synced Auto-Play

Optional: provide `audioUrl` and `audioCues` (array of `{ timestamp, frameIndex }`). A `<audio>` element's `timeupdate` event drives slide changes:

```typescript
audioRef.current.addEventListener('timeupdate', () => {
    const currentTime = audioRef.current.currentTime;
    const matchedCue = audioCues
        .filter(c => c.timestamp <= currentTime)
        .pop(); // Get the latest matching cue
    if (matchedCue && matchedCue.frameIndex !== currentFrameIndex) {
        goToFrame(matchedCue.frameIndex);
    }
});
```

---

## 6. Hybrid Mode (Text + Excalidraw Side-by-Side)

### Layout Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Toolbar (edit mode only)                                 │
├──────────────┬────┬──────────────────────────────────────┤
│              │    │                                      │
│  Text Panel  │ ≡  │  Excalidraw Panel                    │
│  (BlockNote) │    │  (Portal-rendered)                   │
│              │ D  │                                      │
│  scrollable  │ I  │  Zooms to current frame              │
│              │ V  │                                      │
│              │    │                                      │
├──────────────┴────┴──────────────────────────────────────┤
│ Slide navigation (prev / dots / next)                    │
└──────────────────────────────────────────────────────────┘
```

### DOM Order vs Visual Order

**Key insight**: DOM order is always `Text → Divider → Excalidraw`. Visual order is controlled by CSS `order` property:

```tsx
// Text panel
style={{ order: effectiveLayout === 'text-left' ? 0 : 2 }}

// Divider
style={{ order: 1 }}  // Always in middle

// Excalidraw panel
style={{ order: effectiveLayout === 'text-left' ? 2 : 0 }}
```

**Why?** Changing DOM order would cause React to unmount/remount the Excalidraw portal, destroying the canvas state. CSS `order` avoids this entirely.

### Split Ratio & Resize Divider

```typescript
const [splitRatio, setSplitRatio] = useState(0.4); // 40% text, 60% excalidraw

// Text panel width
style={{ width: `calc(${splitRatio * 100}% - 4px)` }}

// Excalidraw panel width
style={{ width: `calc(${(1 - splitRatio) * 100}% - 4px)` }}
```

The 8px divider is draggable (mouse + touch). Clamped to ensure minimum widths:
- `MIN_TEXT_WIDTH = 280px`
- `MIN_EXCALIDRAW_WIDTH = 300px`
- Also clamped to 20%–80% as a sanity check

```typescript
const handleMove = (clientX: number) => {
    const containerRect = containerRef.current.getBoundingClientRect();
    const posX = clientX - containerRect.left;

    let newRatio = layout === 'text-left'
        ? posX / containerRect.width
        : 1 - (posX / containerRect.width);

    const minTextRatio = MIN_TEXT_WIDTH / containerRect.width;
    const maxTextRatio = 1 - (MIN_EXCALIDRAW_WIDTH / containerRect.width) - (8 / containerRect.width);
    newRatio = Math.max(0.2, Math.min(0.8, Math.max(minTextRatio, Math.min(maxTextRatio, newRatio))));

    setSplitRatio(newRatio);
};
```

**Important**: The divider works in BOTH edit and view mode — learners can resize panels for better reading.

### Loading Overlay

Excalidraw takes time to initialize (parse scene, render frames). Show a loading overlay until ready:

```tsx
const [isExcalidrawReady, setIsExcalidrawReady] = useState(false);

// After initial frame zoom completes (3 attempts: 100ms, 300ms, 600ms):
setTimeout(() => {
    zoomToFirst();
    setIsExcalidrawReady(true);
}, 600);

// In JSX:
{!isExcalidrawReady && (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
        <Spinner />
    </div>
)}
```

---

## 7. Scroll Sync Mechanism

This is the core "magic" — as the user scrolls through text content, the Excalidraw panel automatically zooms to the corresponding visual slide.

### How It Works

1. **Author places cues** (edit mode): Click a text block, it creates a `ScrollCue { blockId, frameIndex }` linking that paragraph to a specific Excalidraw frame.

2. **Viewer scrolls** (view mode): A scroll listener on the text container finds which cue's block has scrolled past the trigger line, and calls `goToFrame()`.

### The Scroll Listener (View Mode Only)

```typescript
useEffect(() => {
    if (!textContainerRef.current || scrollCues.length === 0 || isEditing) return;

    const container = textContainerRef.current;

    const handleScroll = () => {
        const containerRect = container.getBoundingClientRect();
        // Trigger line at 40% from top — feels like "when content reaches the middle"
        const triggerLine = containerRect.top + containerRect.height * 0.4;

        // Find block elements for each cue
        const cuesWithPositions = [];
        for (const cue of scrollCues) {
            // BlockNote uses various data attributes — check multiple selectors
            const selectors = [
                `[data-id="${cue.blockId}"]`,
                `[data-block-id="${cue.blockId}"]`,
                `[data-node-view-content][data-id="${cue.blockId}"]`,
                `[data-content-type][data-id="${cue.blockId}"]`,
                `*[id="${cue.blockId}"]`,
            ].join(', ');

            const element = container.querySelector(selectors);
            if (element) {
                cuesWithPositions.push({
                    cue,
                    top: element.getBoundingClientRect().top,
                });
            }
        }

        // Sort by position (top to bottom)
        cuesWithPositions.sort((a, b) => a.top - b.top);

        // Find last cue ABOVE the trigger line
        let activeCue = null;
        for (const item of cuesWithPositions) {
            if (item.top <= triggerLine) {
                activeCue = item.cue;
            } else {
                break;
            }
        }

        // Fire frame change only if different from last triggered cue
        if (activeCue && lastScrollCueRef.current !== activeCue.frameIndex) {
            lastScrollCueRef.current = activeCue.frameIndex;
            goToFrame(activeCue.frameIndex, true);  // true = triggered by scroll
        } else if (!activeCue && lastScrollCueRef.current !== -1) {
            // Scrolled above all cues → reset to slide 0
            lastScrollCueRef.current = -1;
            if (currentFrameIndexRef.current !== 0) {
                goToFrame(0, true);
            }
        }
    };

    // Run once on mount
    setTimeout(handleScroll, 100);

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
}, [scrollCues, goToFrame, isEditing]);
```

### Placing Cues (Edit Mode)

When the author clicks "Place Cue", `isPlacingCue` becomes true. An `onClickCapture` handler on the text panel intercepts the next click:

```typescript
onClickCapture={(e) => {
    if (!isPlacingCue) return;
    e.preventDefault();
    e.stopPropagation();

    // Walk up from clicked element to find a BlockNote block with data-id
    let target = e.target as HTMLElement;
    while (target && target !== textContainerRef.current) {
        const blockId = target.getAttribute('data-id') || target.getAttribute('data-block-id');
        if (blockId) {
            addScrollCue(blockId);
            return;
        }
        target = target.parentElement!;
    }
}}
```

The cue is created with the current frame index: `{ blockId, frameIndex: currentFrameIndex }`.

### Deduplication

`lastScrollCueRef` (a ref, not state) prevents duplicate `goToFrame` calls when scrolling within the same cue region. Using a ref avoids stale closure issues that state would have.

---

## 8. Mobile Implementation

### Detection

```typescript
const MIN_SIDE_BY_SIDE_WIDTH = 588; // 280 text + 300 excalidraw + 8 divider

useEffect(() => {
    const checkMobile = () => {
        const screenTooNarrow = window.innerWidth < 768;
        const containerTooNarrow = containerRef.current
            ? containerRef.current.offsetWidth < MIN_SIDE_BY_SIDE_WIDTH
            : false;
        setIsMobile(screenTooNarrow || containerTooNarrow);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
}, []);
```

### Stacked Layout with Tab Switching

On mobile, side-by-side becomes stacked. Panels toggle via `display: none` (not conditional rendering — **never unmount the Excalidraw portal**):

```tsx
// Text panel
style={{
    display: isMobile && mobileActivePanel !== 'text' ? 'none' : 'block',
    width: isMobile ? '100%' : `calc(${splitRatio * 100}% - 4px)`,
}}

// Excalidraw panel
style={{
    display: isMobile && mobileActivePanel !== 'excalidraw' ? 'none' : 'block',
    width: isMobile ? '100%' : `calc(${(1 - splitRatio) * 100}% - 4px)`,
}}
```

**Tab bar** (view mode, mobile only):

```tsx
{isMobile && !isEditing && (
    <div className="flex border-b">
        <button
            onClick={() => setMobileActivePanel('text')}
            className={mobileActivePanel === 'text' ? 'border-b-2 border-blue-500 font-medium' : ''}
        >
            📝 Text Content
        </button>
        <button
            onClick={() => setMobileActivePanel('excalidraw')}
            className={mobileActivePanel === 'excalidraw' ? 'border-b-2 border-blue-500 font-medium' : ''}
        >
            🎨 Visual
        </button>
    </div>
)}
```

### 🔴 Re-Zoom After Tab Switch

When the Excalidraw panel goes from `display: none` to visible, it has **0×0 dimensions**. You must:

1. Dispatch a resize event so Excalidraw recalculates canvas size
2. Wait 300ms, then re-zoom to the current frame

```typescript
useEffect(() => {
    if (!isMobile || mobileActivePanel !== 'excalidraw' || !excalidrawAPI) return;

    // 1. Tell Excalidraw the window size changed
    window.dispatchEvent(new Event('resize'));

    // 2. After canvas resizes, zoom to current frame
    const timer = setTimeout(() => {
        if (frames.length > 0) {
            const idx = Math.min(currentFrameIndexRef.current, frames.length - 1);
            const frame = frames[idx];
            if (frame) {
                excalidrawAPI.scrollToContent(frame.element, {
                    fitToViewport: true,
                    animate: false,  // No animation — instant snap
                });
            }
        }
    }, 300);

    return () => clearTimeout(timer);
}, [isMobile, mobileActivePanel, excalidrawAPI, frames]);
```

### Mobile Sync Notification

When a scroll cue fires while the user is viewing the text panel (not the Excalidraw tab), show a toast notification:

```typescript
// Inside goToFrame():
if (triggeredByScroll && isMobile && mobileActivePanel === 'text' && isChangingFrame) {
    const slideName = targetFrame.name || `Slide ${targetIndex + 1}`;
    setMobileSyncNotification(`📊 ${slideName}`);
    setTimeout(() => setMobileSyncNotification(null), 2000);
}
```

The toast includes a "Tap to view" action that switches to the Excalidraw tab.

### Focus Mode (Auto-Enabled on Mobile)

CourseViewer auto-enables focus mode on mobile: hide sidebar, show compact header, add prev/next lesson navigation.

---

## 9. Slide Ordering System

### Default Order

Frames are sorted by their **X position** on the Excalidraw canvas (left-to-right). This is the natural order — authors lay out slides left to right.

### Custom Order

A `customSlideOrder` state (array of frame IDs) overrides the default. New frames not in the custom order are appended at the end, still sorted by X:

```typescript
if (customSlideOrder && customSlideOrder.length > 0) {
    const orderedFrames = [];
    const frameMap = new Map(frameObjects.map(f => [f.id, f]));

    // Add frames in custom order
    for (const id of customSlideOrder) {
        const frame = frameMap.get(id);
        if (frame) {
            orderedFrames.push(frame);
            frameMap.delete(id);
        }
    }

    // Append remaining (new) frames sorted by X
    const remaining = Array.from(frameMap.values())
        .sort((a, b) => a.element.x - b.element.x);
    sortedFrames = [...orderedFrames, ...remaining];
} else {
    sortedFrames = frameObjects.sort((a, b) => a.element.x - b.element.x);
}
```

### Drag-to-Reorder UI (Edit Mode)

HTML5 drag events on slide thumbnail cards. On drop, the array is reordered and persisted via `onSlideOrderChange`. A "Reset to Default Order" button clears the custom order.

---

## 10. Save / Load Pipeline

### Save (LessonBuilder → API)

```
1. Validate title
2. Serialize contentJson to string (BlockNote JSON)
3. Build lessonData object:
   { title, description, content, type, hybridLayout, splitRatio, ... }
4. Attach excalidrawJson if present
5. Call createLesson() or updateLesson() → saves main fields
6. Call updateLessonMeta(id, 'excalidraw', excalidrawJsonString)
7. Call updateLessonMeta(id, 'scrollCues', scrollCuesArray)
8. Call updateLessonMeta(id, 'slideOrder', slideOrderArray)
```

### Meta Endpoint

```
POST /lessons/{id}/meta
Body: { type: 'excalidraw' | 'scrollCues' | 'slideOrder' | 'splitRatio', data: ... }
```

The API dispatches on `type`:
| `type` | DB column | Format |
|--------|-----------|--------|
| `excalidraw` | `excalidraw_json` | Raw JSON string |
| `scrollCues` | `scroll_cues` | JSON-encoded array |
| `slideOrder` | `slide_order` | JSON-encoded string array |
| `splitRatio` | `split_ratio` | Float |

### Load

- **List endpoint** (`GET /courses/{id}/lessons`): Returns lightweight data — NO `excalidrawJson`, `scrollCues`, `slideOrder`. Only a boolean `hasExcalidraw` flag.
- **Detail endpoint** (`GET /lessons/{id}`): Returns everything including heavy fields. `scroll_cues` and `slide_order` are `json_decode`'d server-side before returning.
- **Client**: On lesson open, always fetch the full lesson (don't trust the list data).

### Draft Preservation

When switching lesson types in the editor, Excalidraw JSON is preserved in state (not deleted). If user switches from `hybrid` → `content` → back to `hybrid`, their canvas work is still there.

### Auto-Save (ExcalidrawEditor)

A 5-second idle timer fires after any change. Protected by a `saveInProgressRef` mutex to prevent concurrent saves. The first `onChange` after mount is skipped (it's the initial render, not a user change).

---

## 11. Gotchas & Bugs We Fixed

### 1. Blank Canvas After Re-Mount
**Problem**: Navigating away and back showed a blank Excalidraw canvas.
**Cause**: React reconciliation tried to reuse the old DOM nodes that Excalidraw had modified.
**Fix**: Portal isolation pattern (Section 3). Unique `mountIdRef` per mount.

### 2. Images Not Rendering
**Problem**: Lessons with embedded images showed broken image placeholders.
**Cause**: `initialData.files` is not reliably consumed by `<Excalidraw>`.
**Fix**: Always call `excalidrawAPI.addFiles(Object.values(data.files))` after `updateScene()`.

### 3. Mobile Canvas Shows Blank After Tab Switch
**Problem**: Switching from Text tab to Visual tab on mobile showed a white rectangle.
**Cause**: Excalidraw rendered at 0×0 while `display: none`, then didn't re-render.
**Fix**: Dispatch `window.resize` event + `setTimeout(scrollToContent, 300)` on tab switch.

### 4. Scroll Sync Fires Duplicate goToFrame Calls
**Problem**: Performance issues from rapid scroll events triggering frame changes.
**Cause**: Stale closure in scroll handler, comparing against outdated state.
**Fix**: Use `lastScrollCueRef` (ref, not state) and `currentFrameIndexRef` to avoid stale closures. Only fire `goToFrame` when the cue index actually changes.

### 5. Block ID Selectors Don't Match
**Problem**: Scroll cues couldn't find their target blocks in the DOM.
**Cause**: BlockNote/Tiptap uses different data attributes across versions (`data-id`, `data-block-id`, `data-node-view-content`).
**Fix**: Try multiple selectors joined with commas: `[data-id="X"], [data-block-id="X"], [data-node-view-content][data-id="X"], ...`

### 6. Layout Toggle Unmounts Excalidraw
**Problem**: Clicking "swap text/visual sides" destroyed the canvas.
**Cause**: Changing DOM order triggers React reconciliation.
**Fix**: Keep DOM order constant (`Text → Divider → Excalidraw`), use CSS `order` property to swap visual positions.

### 7. Initial Frame Zoom Doesn't Work
**Problem**: On first load, the canvas shows the full scene instead of zooming to frame 1.
**Cause**: Excalidraw needs time to parse the scene and calculate dimensions.
**Fix**: Multiple zoom attempts at 100ms, 300ms, and 600ms. Mark `isExcalidrawReady` after the last attempt. Show a loading overlay until ready.

### 8. First onChange Triggers Unwanted Save
**Problem**: Opening a lesson immediately triggered an auto-save with potentially different data.
**Cause**: Excalidraw fires `onChange` on initial scene load.
**Fix**: Track `lastChangeTimeRef` — skip the first call where it's 0. Also debounce rapid changes (<100ms apart).

### 9. Fullscreen Doesn't Work on iOS Safari
**Problem**: The Fullscreen API isn't supported on iOS Safari.  
**Fix**: CSS-based fullscreen fallback: `position: fixed; inset: 0; z-index: 50; height: 100vh;`

### 10. Excalidraw JSON Includes Massive AppState
**Problem**: Saving the full `getAppState()` bloats the JSON to megabytes.
**Fix**: Only save the fields you actually need:
```typescript
appState: {
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize,
    currentItemFontFamily: appState.currentItemFontFamily,
}
```

---

## 12. Component Reference

### ExcalidrawEditor
**Purpose**: Standalone Excalidraw canvas editor. Used for `excalidraw` lesson type.
**Key props**: `initialData`, `onChange`, `lessonId` (for auto-save)
**Features**: Auto-save (5s idle), image insertion (URL paste or Media Library), export to PNG/SVG, frame detection, `Ctrl+S` keyboard shortcut.

### ExcalidrawPresentation
**Purpose**: Read-only slideshow viewer. Used when viewing `excalidraw` lessons.
**Key props**: `excalidrawData` (JSON string), `slideOrder`, `audioUrl`, `audioCues`, `onComplete`
**Features**: Keyboard navigation, dot indicators, auto-play with audio cues, fullscreen, canvas pointer-events disabled in slide mode.

### HybridLessonEditor
**Purpose**: Side-by-side text + Excalidraw. Used for both editing AND viewing `hybrid` lessons.
**Key props**: `initialContent`, `initialExcalidraw`, `initialCues`, `initialSlideOrder`, `initialSplitRatio`, `layout`, `isEditing`
**Features**: Scroll sync, resizable divider, layout toggle, slide ordering, fullscreen, mobile tab switching.

### BlockEditor
**Purpose**: BlockNote rich text editor wrapper. Used for `content` lesson type and the text panel in hybrid mode.
**Key props**: `initialContent`, `onChange`, `editable`

### FocusReader
**Purpose**: Fullscreen, slide-based reading mode for text content.
**Behavior**: Splits BlockNote blocks at `divider` elements into "slides". Uses CSS scroll-snap. IntersectionObserver tracks current slide. Prev/next buttons + scroll.

### CourseViewer
**Purpose**: Student-facing course view. Orchestrates lesson rendering.
**Key behaviors**: Sequential lesson locking, progress tracking, auto-advance on complete, focus mode (auto on mobile), sidebar toggle.

### LessonSidebar
**Purpose**: Course outline navigation.
**Features**: Grouped by sections, status icons (completed/in-progress/locked), collapsible sections, mobile overlay.

---

## Quick-Start Checklist for New Implementation

- [ ] Install `@excalidraw/excalidraw`, `@blocknote/react`, `framer-motion`
- [ ] Set up Excalidraw asset path (fonts/icons) — host locally or use CDN
- [ ] Create DB tables (lessons with `excalidraw_json`, `scroll_cues`, `slide_order`, `hybrid_layout`, `split_ratio`)
- [ ] Build `ExcalidrawEditor` with Portal isolation pattern
- [ ] Build `ExcalidrawPresentation` with frame detection + keyboard nav
- [ ] Build `HybridLessonEditor` with CSS-order layout swapping
- [ ] Implement scroll sync: block anchors + trigger line + `lastScrollCueRef`
- [ ] Add mobile detection (viewport width + container width)
- [ ] Use `display: none` toggling (never unmount Excalidraw) for mobile tabs
- [ ] Add resize event dispatch + delayed re-zoom on mobile tab switch
- [ ] Prune `appState` before saving Excalidraw JSON
- [ ] Always call `addFiles()` after `updateScene()`
- [ ] Use 2-phase transitions when switching lesson types
- [ ] Add loading overlay until `isExcalidrawReady`
- [ ] Test on iOS Safari (fullscreen CSS fallback needed)
