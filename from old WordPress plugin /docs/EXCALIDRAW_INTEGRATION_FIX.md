# Excalidraw Integration Fix & CSS Architecture

## Problem Summary
Integrating `@excalidraw/excalidraw` into the AquaticPro React application (embedded in WordPress) caused significant styling conflicts:
1.  **Broken UI**: Excalidraw toolbar icons appeared as black blobs or empty circles.
2.  **Visible Internals**: Hidden radio buttons used by Excalidraw for state management became visible.
3.  **Layout Shifts**: Menus and popovers were clipped or misaligned.
4.  **Specificity War**: Attempts to fix Excalidraw using `all: revert` or disabling Tailwind preflight broke the rest of the application's styling.

## Root Causes
1.  **Tailwind Specificity**: The setting `important: '#root'` in `tailwind.config.js` forced all Tailwind utility classes to have higher specificity than Excalidraw's internal CSS.
2.  **Global Input Styles**: Global CSS rules in `src/index.css` targeting `input[type="checkbox"]` and `input[type="radio"]` (intended for the app's forms) were inadvertently applying to Excalidraw's hidden UI controls, forcing them to have width/height and become visible.
3.  **Aggressive Resets**: Using properties like `all: revert` on the Excalidraw container un-set critical internal styles (like `display: none` on those radio buttons), causing them to appear.

## The Solution: "Respectful Isolation"

Instead of trying to force Excalidraw to ignore outside styles (which failed), we modified the outside styles to **ignore Excalidraw**.

### 1. Tailwind Configuration
**File:** `tailwind.config.js`
*   **Action:** Removed `important: '#root'`.
*   **Effect:** Reduces the specificity of Tailwind classes, allowing Excalidraw's component-level styles to win naturally without needing `!important`.

### 2. Global CSS Exclusions
**File:** `src/index.css`
*   **Action:** Modified global input selectors to explicitly exclude Excalidraw elements.
*   **Pattern:**
    ```css
    /* OLD (Broken) */
    #root input[type="checkbox"] { ... }

    /* NEW (Fixed) */
    #root input[type="checkbox"]:not(.excalidraw *) { ... }
    ```
*   **Effect:** Ensures our custom form styles (custom checkboxes, radio buttons) apply to the application but leave Excalidraw's internal form elements alone.

### 3. CSS Layer Isolation
**File:** `src/index.css`
*   **Action:** Wrapped Excalidraw wrapper in a `contain` block.
    ```css
    @layer excalidraw {
        .excalidraw-wrapper {
            isolation: isolate;
            contain: layout style;
        }
    }
    ```
*   **Effect:** Creates a new stacking context and style containment boundary, preventing layout calculations from leaking out or in.

### 4. Asset Configuration
**File:** `src/components/lms/ExcalidrawEditor.tsx`
*   **Action:** Configured `EXCALIDRAW_ASSET_PATH` to use a CDN.
    ```typescript
    (window as any).EXCALIDRAW_ASSET_PATH = 'https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/';
    ```
*   **Effect:** Fixes 404 errors for fonts and icons that naturally occur when bundlers don't correctly copy node_modules assets to the WordPress plugin build folder.

## Future Maintenance Guide

If you need to add new global styles to `src/index.css` or `App.tsx`:

1.  **Avoid Tag Selectors**: Do not style strict tags like `button`, `input`, or `div` globally without a class constraint.
    *   ❌ `button { background: blue; }`
    *   ✅ `.btn { background: blue; }`
2.  **Use Exclusion**: If you MUST use a tag selector (e.g., for a reset), always exclude Excalidraw.
    *   ✅ `input:not(.excalidraw *) { ... }`
3.  **Check Z-Index**: Excalidraw uses high z-indices (up to 9999). Ensure app modals don't conflict, or use `isolation: isolate` on containers.
4.  **Do Not Revert**: Avoid adding `all: revert` to the Excalidraw container again; it creates more problems than it solves by unhiding hidden inputs.
