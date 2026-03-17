# AquaticPro Design System - Style Guide

> A comprehensive guide to the visual design language, component patterns, and styling approach used in the AquaticPro platform. Use this guide to create visually consistent plugins and applications.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Shadows & Elevation](#shadows--elevation)
6. [Button Component](#button-component)
7. [Form Elements](#form-elements)
8. [Cards & Containers](#cards--containers)
9. [Navigation Patterns](#navigation-patterns)
10. [Icons](#icons)
11. [Responsive Design](#responsive-design)
12. [WordPress Integration](#wordpress-integration)
13. [Inline Styles Pattern](#inline-styles-pattern)

---

## Design Philosophy

### Neobrutalist Foundation
The AquaticPro design system uses a **neobrutalist** aesthetic characterized by:
- **Bold black borders** (`2px solid #000000`)
- **Hard drop shadows** (`2px 2px 0 0 rgba(0,0,0,1)`)
- **Playful hover effects** (translate up/left on hover, shadow disappears on click)
- **Clear visual hierarchy** with distinct states
- **No rounded corners on primary actions** (use `0.5rem` for subtle rounding)

### Key Principles
1. **Inline Styles Override All** - Use inline styles for critical visual properties to guarantee they work in WordPress environments
2. **Prefix Everything** - All Tailwind classes use `ap-` prefix to avoid conflicts
3. **State Visibility** - Hover, active, and focus states must be clearly visible
4. **Accessibility First** - Maintain WCAG AA color contrast ratios
5. **Mobile Responsive** - Design for mobile first, then enhance for larger screens

---

## Color Palette

### Brand Colors (AquaticPro Gradient)
```css
--aqua-blue: #0004ff;
--aqua-sky: #12a4ff;
--aqua-purple: #9f0fff;
--aqua-pink: #f538f2;

/* Gradient */
background: linear-gradient(90deg, #0004ff, #12a4ff, #9f0fff, #f538f2);
```

### Primary UI Colors
| Name | Hex | Usage |
|------|-----|-------|
| Blue-600 | `#2563eb` | Primary buttons, links, active states |
| Blue-700 | `#1d4ed8` | Primary hover |
| Blue-800 | `#1e40af` | Primary active/pressed |

### Lavender/Purple (Sidebar & Navigation)
| Name | Hex | Usage |
|------|-----|-------|
| Purple-50 | `#f5f3ff` | Sub-nav background, light cards |
| Purple-100 | `#ede9fe` | Main nav background |
| Purple-200 | `#ddd6fe` | Hover states |
| Purple-300 | `#c4b5fd` | Borders, subtle accents |
| Purple-400 | `#a78bfa` | Active borders |
| Purple-500 | `#8b5cf6` | Active backgrounds |
| Purple-600 | `#7c3aed` | Primary accent |
| Purple-700 | `#6d28d9` | Gradient endpoints |
| Purple-800 | `#5b21b6` | Dark text on purple |

### Semantic Colors
| Type | Light (50) | Main (600) | Text/Border |
|------|-----------|------------|-------------|
| Success | `#ecfdf3` | `#16a34a` | `#15803d` |
| Danger | `#fef2f2` | `#dc2626` | `#b91c1c` |
| Warning | `#fff7ed` | `#ea580c` | `#c2410c` |
| Info | `#eff6ff` | `#2563eb` | `#1d4ed8` |

### Neutrals (Gray Scale)
| Name | Hex | Usage |
|------|-----|-------|
| Gray-50 | `#f9fafb` | Page backgrounds |
| Gray-100 | `#f3f4f6` | Card backgrounds, inactive buttons |
| Gray-200 | `#e5e7eb` | Borders, dividers |
| Gray-300 | `#d1d5db` | Disabled states |
| Gray-400 | `#9ca3af` | Placeholder text |
| Gray-500 | `#6b7280` | Secondary text, icons |
| Gray-600 | `#4b5563` | Body text |
| Gray-700 | `#374151` | Primary text |
| Gray-900 | `#111827` | Headings |

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
             'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 
             sans-serif;
```

### Type Scale
| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| xs | `0.75rem` (12px) | 400 | 1.5 | Captions, badges |
| sm | `0.875rem` (14px) | 400-500 | 1.5 | Secondary text, labels |
| base | `1rem` (16px) | 400 | 1.5 | Body text |
| lg | `1.125rem` (18px) | 500-600 | 1.5 | Subheadings |
| xl | `1.25rem` (20px) | 600 | 1.4 | Section headings |
| 2xl | `1.5rem` (24px) | 700 | 1.3 | Page headings |
| 3xl | `1.875rem` (30px) | 700 | 1.2 | Major headings |

### Font Weights
- **400** - Regular body text
- **500** - Medium emphasis, nav items
- **600** - Semibold, buttons, active states
- **700** - Bold, headings

---

## Spacing System

### Base Unit
The spacing system uses a **4px base unit** with Tailwind's scale:

| Class | Size | Pixels | Usage |
|-------|------|--------|-------|
| `ap-p-1` | 0.25rem | 4px | Tight padding |
| `ap-p-2` | 0.5rem | 8px | Icon buttons, badges |
| `ap-p-3` | 0.75rem | 12px | Small cards |
| `ap-p-4` | 1rem | 16px | Default card padding |
| `ap-p-5` | 1.25rem | 20px | Section padding |
| `ap-p-6` | 1.5rem | 24px | Large containers |
| `ap-p-8` | 2rem | 32px | Major sections |

### Common Patterns
```jsx
// Card padding
className="ap-p-4"  // 16px all sides

// List item spacing
className="ap-py-2 ap-px-4"  // 8px vertical, 16px horizontal

// Button padding (inline styles preferred)
padding: '0.625rem 0.875rem'  // ~10px 14px

// Gap in flex containers
className="ap-gap-2"  // 8px gap
className="ap-gap-4"  // 16px gap
```

---

## Shadows & Elevation

### Neobrutalist Shadow (Primary)
```css
/* Default state */
box-shadow: 2px 2px 0 0 rgba(0,0,0,1);
border: 2px solid #000000;

/* Hover state */
transform: translate(-2px, -2px);
box-shadow: 4px 4px 0 0 rgba(0,0,0,1);

/* Active/Pressed state */
transform: none;
box-shadow: none;
```

### TailAdmin Soft Shadows
For non-button elements (cards, modals, dropdowns):
```css
--shadow-xs: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
--shadow-sm: 0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06);
--shadow-md: 0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06);
--shadow-lg: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);
--shadow-xl: 0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03);
```

### Focus Ring
```css
box-shadow: 0px 0px 0px 4px rgba(70, 95, 255, 0.12);
/* Or for purple theme */
box-shadow: 0px 0px 0px 4px rgba(124, 58, 237, 0.2);
```

---

## Button Component

### Variant Styling Pattern
Buttons use **inline styles** to guarantee they override WordPress themes:

```tsx
const buttonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: '2px solid #000000',
  boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
  borderRadius: '0.5rem',
  padding: '0.625rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 150ms ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
};
```

### Standard Variants

#### Primary (Blue)
```css
background: #2563eb;
color: #ffffff;
border: 2px solid #000;
box-shadow: 2px 2px 0 0 rgba(0,0,0,1);
```

#### Secondary (Gray)
```css
background: #f3f4f6;
color: #374151;
border: 2px solid #000;
box-shadow: 2px 2px 0 0 rgba(0,0,0,1);
```

#### Danger (Red, Light Background)
```css
background: #fef2f2;
color: #dc2626;
border: 2px solid #000;
```

#### Success (Green)
```css
background: #16a34a;
color: #ffffff;
border: 2px solid #000;
```

#### Ghost (Transparent)
```css
background: transparent;
color: #4b5563;
border: 2px solid transparent;
box-shadow: none;
```

### Button Sizes
| Size | Padding | Font Size | Min Height |
|------|---------|-----------|------------|
| xs | `0.25rem 0.5rem` | 0.75rem | 28px |
| sm | `0.375rem 0.75rem` | 0.875rem | 32px |
| md | `0.625rem 1rem` | 0.875rem | 40px |
| lg | `0.75rem 1.25rem` | 1rem | 48px |
| xl | `1rem 1.5rem` | 1.125rem | 56px |

### State Transitions
```tsx
// On hover
onMouseEnter={() => setIsHovered(true)}

// Apply hover styles
style={{
  ...baseStyle,
  ...(isHovered && {
    backgroundColor: '#1d4ed8',
    transform: 'translate(-2px, -2px)',
    boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
  }),
}}
```

---

## Form Elements

### Text Inputs
```jsx
<input
  className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 
             focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
  style={{
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: '0.875rem',
  }}
/>
```

### Select Dropdowns
```jsx
<select
  className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200"
  style={{
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
  }}
>
```

### Checkboxes & Radio (Custom)
Use inline styles for toggle states:
```tsx
const isSelected = selectedItems.includes(item.id);

<button
  onClick={() => toggleItem(item.id)}
  style={{
    padding: '6px 12px',
    borderRadius: '9999px', // pill shape
    border: isSelected ? '1px solid #2563eb' : '1px solid #e5e7eb',
    backgroundColor: isSelected ? '#2563eb' : '#f3f4f6',
    color: isSelected ? '#ffffff' : '#374151',
    cursor: 'pointer',
    transition: 'all 150ms',
  }}
>
  {item.label}
</button>
```

---

## Cards & Containers

### Standard Card
```jsx
<div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
  {/* Card content */}
</div>
```

### Neobrutalist Card
```jsx
<div
  style={{
    backgroundColor: '#ffffff',
    border: '2px solid #000000',
    boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
    borderRadius: '0.5rem',
    padding: '1rem',
  }}
>
  {/* Card content */}
</div>
```

### Section Container
```jsx
<section className="ap-bg-gray-50 ap-rounded-xl ap-p-6 ap-border ap-border-gray-200">
  <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">
    Section Title
  </h2>
  {/* Section content */}
</section>
```

---

## Navigation Patterns

### Sidebar Navigation

#### Main Nav Item (Inactive)
```css
background: #ede9fe; /* purple-100 */
color: #374151;
border: 1px solid #a78bfa; /* purple-400 */
border-radius: 0.5rem;
padding: 0.625rem 0.875rem;
font-weight: 500;
```

#### Main Nav Item (Active)
```css
background: linear-gradient(to right, #7c3aed, #6d28d9); /* purple gradient */
color: #ffffff;
border: none;
box-shadow: 0 2px 8px rgba(124, 58, 237, 0.35);
font-weight: 600;
```

#### Sub-Nav Item (Inactive)
```css
background: #f5f3ff; /* purple-50 */
color: #4b5563;
border: 1px solid #c4b5fd; /* purple-300 */
border-radius: 0.375rem;
font-size: 0.8125rem;
```

#### Sub-Nav Item (Active)
```css
background: linear-gradient(to right, #8b5cf6, #7c3aed);
color: #ffffff;
font-weight: 600;
```

### Tab Navigation

#### Tab Button (Inactive)
```css
background: #eff6ff; /* blue-50 */
color: #1d4ed8;
border: 1px solid #bfdbfe; /* blue-200 */
border-radius: 0.5rem;
padding: 0.5rem 1rem;
font-weight: 500;
```

#### Tab Button (Active)
```css
background: linear-gradient(to right, #2563eb, #1d4ed8);
color: #ffffff;
border: none;
box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
font-weight: 600;
```

---

## Icons

### Icon Library
Use **Heroicons v2 Outline** for consistency:
```tsx
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineCog,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlinePlusCircle,
  HiOutlineChevronDown,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
```

### Icon Sizes
| Context | Size Class | Pixels |
|---------|------------|--------|
| Inline with text | `ap-h-4 ap-w-4` | 16px |
| Button icon | `ap-h-5 ap-w-5` | 20px |
| Nav icon | `ap-h-5 ap-w-5` | 20px |
| Large/Hero | `ap-h-6 ap-w-6` | 24px |
| Extra Large | `ap-h-8 ap-w-8` | 32px |

### Icon Button Pattern
```tsx
<Button
  variant="icon"
  onClick={handleEdit}
  style={{
    backgroundColor: 'transparent',
    color: '#6b7280',
    padding: '0.5rem',
  }}
>
  <HiOutlinePencil className="ap-h-4 ap-w-4" />
</Button>
```

---

## Responsive Design

### Breakpoints
```css
/* Mobile first approach */
sm: 640px   /* Phones landscape */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Common Responsive Patterns
```jsx
// Stack on mobile, row on larger screens
className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-4"

// Hide on mobile, show on larger
className="ap-hidden md:ap-block"

// Full width on mobile, auto on larger
className="ap-w-full md:ap-w-auto"

// Responsive grid
className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4"
```

### Sidebar Behavior
- **Mobile (< 768px)**: Overlay drawer, toggle button visible
- **Tablet (768px - 1024px)**: Collapsible sidebar, icons only when collapsed
- **Desktop (> 1024px)**: Fixed sidebar, always expanded

---

## WordPress Integration

### CSS Isolation

#### Tailwind Prefix
All Tailwind classes use `ap-` prefix:
```jsx
// Correct
className="ap-flex ap-items-center ap-gap-4"

// Wrong - will conflict with WordPress
className="flex items-center gap-4"
```

#### CSS Layers
```css
@layer tailwind, app, excalidraw;

/* Tailwind (lowest priority) */
@layer tailwind {
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
}

/* App styles */
@layer app {
  /* Custom component styles */
}

/* Third-party overrides (highest priority) */
@layer excalidraw {
  /* Excalidraw isolation */
}
```

#### Root Selector
```js
// tailwind.config.js
module.exports = {
  prefix: 'ap-',
  important: '#root',
  // ...
}
```

### Container Isolation
```css
.mentorship-platform-container {
  isolation: isolate;
  position: relative;
  z-index: 1;
}

#root {
  height: calc(100vh - 32px); /* Account for WP admin bar */
  font-family: -apple-system, ..., sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #374151;
}
```

---

## Inline Styles Pattern

### Why Inline Styles?
WordPress themes apply aggressive CSS that overrides Tailwind classes. **Inline styles have higher specificity** and guarantee visual consistency.

### When to Use Inline Styles
1. **Buttons** - All button variants use inline styles
2. **Selected/Active states** - Toggle buttons, tabs, checkboxes
3. **Critical visual properties** - Colors, backgrounds, borders that must not be overridden

### Pattern Example
```tsx
const MyToggleButton: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const baseStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 150ms',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  };
  
  const activeStyle: React.CSSProperties = isActive ? {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: '2px solid #2563eb',
  } : {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '2px solid #e5e7eb',
  };
  
  const hoverStyle: React.CSSProperties = isHovered ? {
    backgroundColor: isActive ? '#1d4ed8' : '#e5e7eb',
  } : {};
  
  return (
    <button
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ ...baseStyle, ...activeStyle, ...hoverStyle }}
    >
      Toggle Me
    </button>
  );
};
```

### Tailwind for Layout, Inline for Visuals
```jsx
// Layout uses Tailwind (ap- prefix)
<div className="ap-flex ap-items-center ap-gap-4 ap-p-4">
  
  {/* Buttons use inline styles for visual properties */}
  <Button
    style={{
      backgroundColor: '#2563eb',
      color: '#ffffff',
      border: '2px solid #000',
    }}
  >
    Primary Action
  </Button>
  
</div>
```

---

## Quick Reference

### Essential Hex Codes
```
Primary Blue:    #2563eb (blue-600)
Primary Purple:  #7c3aed (purple-600)
Success Green:   #16a34a (green-600)
Danger Red:      #dc2626 (red-600)
Warning Orange:  #ea580c (orange-600)

Text Primary:    #374151 (gray-700)
Text Secondary:  #6b7280 (gray-500)
Text Muted:      #9ca3af (gray-400)

Background:      #f9fafb (gray-50)
Card Background: #ffffff (white)
Border Light:    #e5e7eb (gray-200)
Border Dark:     #000000 (black)
```

### Neobrutalist Button Recipe
```css
/* Base */
background: [color];
color: [text-color];
border: 2px solid #000;
box-shadow: 2px 2px 0 0 rgba(0,0,0,1);
border-radius: 0.5rem;
padding: 0.625rem 1rem;
font-weight: 600;
cursor: pointer;
transition: all 150ms;

/* Hover */
transform: translate(-2px, -2px);
box-shadow: 4px 4px 0 0 rgba(0,0,0,1);

/* Active/Pressed */
transform: none;
box-shadow: none;
```

---

*Last updated: February 2026*
*Version: 13.1.1*
