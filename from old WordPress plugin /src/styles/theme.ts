/**
 * AquaticPro Design System Theme
 * Version 12.1.05 - January 2026
 * 
 * This file contains all design tokens for consistent styling across the application.
 * Import and use these values instead of hardcoding colors, spacing, etc.
 */

// =============================================================================
// BRAND COLORS
// =============================================================================

export const colors = {
  // AquaticPro Brand Gradient Colors
  brand: {
    blue: '#0004ff',      // Electric Blue
    sky: '#12a4ff',       // Sky Blue  
    purple: '#9f0fff',    // Neon Purple
    pink: '#f538f2',      // Hot Pink
  },

  // Primary Action Colors (use blue-600 as standard)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',  // DEFAULT - Primary buttons, links
    700: '#1d4ed8',  // Hover state
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Success / Positive (green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',  // DEFAULT
    700: '#15803d',  // Hover state
    800: '#166534',
    900: '#14532d',
  },

  // Warning (amber/yellow)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // DEFAULT
    600: '#d97706',  // Hover state
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Danger / Error (red)
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',  // DEFAULT
    700: '#b91c1c',  // Hover state
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Neutral / Gray (for backgrounds, borders, text)
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',  // DEFAULT text color
    800: '#1f2937',
    900: '#111827',
  },

  // Module-specific accent colors (for tabs, badges, etc.)
  modules: {
    roadmap: {
      active: '#059669',    // emerald-600
      bg: '#d1fae5',        // emerald-100
      fieldBg: 'rgba(167, 243, 208, 0.4)',
    },
    tasks: {
      active: '#2563eb',    // blue-600
      bg: '#dbeafe',        // blue-100
      fieldBg: 'rgba(191, 219, 254, 0.4)',
    },
    meetings: {
      active: '#e11d48',    // rose-600
      bg: '#ffe4e6',        // rose-100
      fieldBg: 'rgba(255, 204, 211, 0.4)',
    },
    updates: {
      active: '#9333ea',    // purple-600
      bg: '#ede9fe',        // purple-100
      fieldBg: 'rgba(206, 147, 216, 0.4)',
    },
  },
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  // Font family (system fonts for performance)
  fontFamily: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  },

  // Font sizes (Tailwind classes to use)
  fontSize: {
    xs: 'ap-text-xs',       // 12px
    sm: 'ap-text-sm',       // 14px
    base: 'ap-text-base',   // 16px
    lg: 'ap-text-lg',       // 18px
    xl: 'ap-text-xl',       // 20px
    '2xl': 'ap-text-2xl',   // 24px
    '3xl': 'ap-text-3xl',   // 30px
  },

  // Font weights
  fontWeight: {
    normal: 'ap-font-normal',     // 400
    medium: 'ap-font-medium',     // 500
    semibold: 'ap-font-semibold', // 600
    bold: 'ap-font-bold',         // 700
  },

  // Line heights
  lineHeight: {
    tight: 'ap-leading-tight',    // 1.25
    snug: 'ap-leading-snug',      // 1.375
    normal: 'ap-leading-normal',  // 1.5
    relaxed: 'ap-leading-relaxed', // 1.625
  },

  // Standardized heading styles
  headings: {
    h1: 'ap-text-2xl ap-font-bold ap-text-gray-800',           // Page titles
    h2: 'ap-text-xl ap-font-semibold ap-text-gray-700',        // Section headings
    h3: 'ap-text-lg ap-font-semibold ap-text-gray-700',        // Subsection headings
    h4: 'ap-text-base ap-font-semibold ap-text-gray-700',      // Minor headings
    label: 'ap-text-sm ap-font-medium ap-text-gray-700',       // Form labels
    caption: 'ap-text-xs ap-text-gray-500',                 // Helper text, captions
  },
} as const;

// =============================================================================
// SPACING & LAYOUT
// =============================================================================

export const spacing = {
  // Standard spacing values (use Tailwind classes)
  page: {
    padding: 'ap-p-6',           // Page container padding
    paddingX: 'ap-px-6',
    paddingY: 'ap-py-6',
  },
  
  card: {
    padding: 'ap-p-6',           // Card internal padding
    paddingCompact: 'ap-p-4',    // Compact card padding
    gap: 'ap-gap-4',             // Gap between card elements
  },

  section: {
    marginBottom: 'ap-mb-6',     // Between major sections
    gap: 'ap-gap-6',             // Grid/flex gap between sections
  },

  element: {
    gap: 'ap-gap-4',             // Between sibling elements
    gapSmall: 'ap-gap-2',        // Tight spacing
    gapLarge: 'ap-gap-6',        // Loose spacing
  },

  form: {
    gap: 'ap-gap-4',             // Between form fields
    labelGap: 'ap-mb-1',         // Between label and input
  },

  inline: {
    gap: 'ap-gap-2',             // Between inline elements (icons + text)
    gapLarge: 'ap-gap-3',
  },
} as const;

// =============================================================================
// BORDERS & SHADOWS
// =============================================================================

export const borders = {
  // Border radius
  radius: {
    none: 'ap-rounded-none',
    sm: 'ap-rounded-sm',         // 2px
    default: 'ap-rounded',       // 4px
    md: 'ap-rounded-md',         // 6px
    lg: 'ap-rounded-lg',         // 8px - DEFAULT for cards, buttons
    xl: 'ap-rounded-xl',         // 12px
    full: 'ap-rounded-full',     // For pills, avatars
  },

  // Border colors
  color: {
    default: 'ap-border-gray-200',
    light: 'ap-border-gray-100',
    dark: 'ap-border-gray-300',
    focus: 'ap-border-blue-500',
    error: 'ap-border-red-500',
  },

  // Border widths
  width: {
    default: 'ap-border',
    2: 'ap-border-2',
  },
} as const;

export const shadows = {
  none: 'ap-shadow-none',
  sm: 'ap-shadow-sm',
  default: 'ap-shadow',
  md: 'ap-shadow-md',          // DEFAULT for cards
  lg: 'ap-shadow-lg',          // Elevated elements, modals
  xl: 'ap-shadow-xl',
} as const;

// =============================================================================
// BUTTON STYLES
// =============================================================================

export const buttonStyles = {
  // Base styles applied to all buttons
  base: 'ap-inline-flex ap-items-center ap-justify-center ap-font-medium ap-rounded-lg ap-transition-all ap-duration-200 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-offset-2 disabled:ap-opacity-50 disabled:ap-cursor-not-allowed',

  // Size variants
  sizes: {
    xs: 'ap-px-2 ap-py-1 ap-text-xs ap-gap-1',
    sm: 'ap-px-3 ap-py-1.5 ap-text-sm ap-gap-1.5',
    md: 'ap-px-4 ap-py-2 ap-text-sm ap-gap-2',
    lg: 'ap-px-5 ap-py-2.5 ap-text-base ap-gap-2',
    xl: 'ap-px-6 ap-py-3 ap-text-base ap-gap-2.5',
  },

  // Color variants
  variants: {
    primary: {
      base: 'ap-bg-blue-600 ap-text-white hover:ap-bg-blue-700 focus:ap-ring-blue-500',
      disabled: 'ap-bg-gray-300 ap-text-gray-500',
    },
    secondary: {
      base: 'ap-bg-gray-100 ap-text-gray-700 hover:ap-bg-gray-200 focus:ap-ring-gray-500 ap-border ap-border-gray-300',
      disabled: 'ap-bg-gray-100 ap-text-gray-400',
    },
    danger: {
      base: 'ap-bg-red-600 ap-text-white hover:ap-bg-red-700 focus:ap-ring-red-500',
      disabled: 'ap-bg-gray-300 ap-text-gray-500',
    },
    success: {
      base: 'ap-bg-green-600 ap-text-white hover:ap-bg-green-700 focus:ap-ring-green-500',
      disabled: 'ap-bg-gray-300 ap-text-gray-500',
    },
    warning: {
      base: 'ap-bg-amber-500 ap-text-white hover:ap-bg-amber-600 focus:ap-ring-amber-500',
      disabled: 'ap-bg-gray-300 ap-text-gray-500',
    },
    ghost: {
      base: 'ap-bg-transparent ap-text-gray-700 hover:ap-bg-gray-100 focus:ap-ring-gray-500',
      disabled: 'ap-text-gray-400',
    },
    link: {
      base: 'ap-bg-transparent ap-text-blue-600 hover:ap-text-blue-700 hover:ap-underline focus:ap-ring-blue-500 ap-p-0',
      disabled: 'ap-text-gray-400',
    },
  },
} as const;

// =============================================================================
// FORM STYLES
// =============================================================================

export const formStyles = {
  // Input base styles
  input: {
    base: 'ap-block ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 placeholder-gray-400 ap-transition-colors focus:ap-border-blue-500 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500 disabled:ap-bg-gray-50 disabled:ap-text-gray-500',
    error: 'ap-border-red-500 focus:ap-border-red-500 focus:ap-ring-red-500',
    sizes: {
      sm: 'ap-px-2 ap-py-1.5 ap-text-xs',
      md: 'ap-px-3 ap-py-2 ap-text-sm',
      lg: 'ap-px-4 ap-py-2.5 ap-text-base',
    },
  },

  // Select styles
  select: {
    base: 'ap-block ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 ap-transition-colors focus:ap-border-blue-500 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500 disabled:ap-bg-gray-50 disabled:ap-text-gray-500',
    error: 'ap-border-red-500 focus:ap-border-red-500 focus:ap-ring-red-500',
  },

  // Textarea styles
  textarea: {
    base: 'ap-block ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 placeholder-gray-400 ap-transition-colors focus:ap-border-blue-500 focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500 disabled:ap-bg-gray-50 disabled:ap-text-gray-500 ap-resize-y',
  },

  // Checkbox styles
  checkbox: {
    base: 'ap-h-4 ap-w-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500 focus:ap-ring-offset-0',
  },

  // Label styles
  label: {
    base: 'ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1',
    required: "after:content-['*'] after:ml-0.5 after:text-red-500",
    inline: 'ap-inline-flex ap-items-center ap-gap-2 ap-text-sm ap-font-medium ap-text-gray-700 ap-cursor-pointer',
  },

  // Helper/error text
  helper: {
    base: 'ap-mt-1 ap-text-xs ap-text-gray-500',
    error: 'ap-mt-1 ap-text-xs ap-text-red-600',
  },
} as const;

// =============================================================================
// CARD STYLES
// =============================================================================

export const cardStyles = {
  base: 'ap-bg-white md:ap-rounded-lg md:ap-border md:ap-border-gray-200 md:ap-shadow-md',
  variants: {
    default: 'ap-bg-white md:ap-rounded-lg md:ap-border md:ap-border-gray-200 md:ap-shadow-md',
    flat: 'ap-bg-white md:ap-rounded-lg md:ap-border md:ap-border-gray-200',
    elevated: 'ap-bg-white md:ap-rounded-lg md:ap-shadow-lg',
    outlined: 'ap-bg-white md:ap-rounded-lg md:ap-border-2 md:ap-border-gray-300',
  },
  padding: {
    none: '',
    sm: 'ap-p-4',
    md: 'ap-p-6',
    lg: 'ap-p-8',
  },
} as const;

// =============================================================================
// MODAL STYLES
// =============================================================================

export const modalStyles = {
  overlay: 'ap-fixed ap-inset-0 ap-bg-black/50 ap-flex ap-items-start ap-justify-center ap-z-50 ap-pt-16 ap-overflow-y-auto',
  container: 'ap-bg-white ap-rounded-lg ap-shadow-xl ap-max-h-[85vh] ap-overflow-hidden ap-flex ap-flex-col ap-my-8',
  sizes: {
    sm: 'ap-max-w-md ap-w-full',
    md: 'ap-max-w-lg ap-w-full',
    lg: 'ap-max-w-2xl ap-w-full',
    xl: 'ap-max-w-4xl ap-w-full',
    full: 'ap-max-w-[95vw] ap-w-full',
  },
  header: 'ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-flex ap-items-center ap-justify-between',
  body: 'ap-px-6 ap-py-4 ap-overflow-y-auto ap-flex-1',
  footer: 'ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-flex ap-items-center ap-justify-end ap-gap-3',
} as const;

// =============================================================================
// TABLE STYLES
// =============================================================================

export const tableStyles = {
  container: 'ap-overflow-x-auto ap-rounded-lg ap-border ap-border-gray-200',
  table: 'ap-min-w-full ap-divide-y ap-divide-gray-200',
  thead: 'ap-bg-gray-50',
  th: 'ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-600 ap-uppercase ap-tracking-wider',
  tbody: 'ap-bg-white ap-divide-y ap-divide-gray-200',
  td: 'ap-px-4 ap-py-3 ap-text-sm ap-text-gray-700 ap-whitespace-nowrap',
  tr: {
    default: '',
    hover: 'hover:ap-bg-gray-50',
    striped: 'even:ap-bg-gray-50',
  },
} as const;

// =============================================================================
// BADGE / TAG STYLES
// =============================================================================

export const badgeStyles = {
  base: 'ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium',
  variants: {
    gray: 'ap-bg-gray-100 ap-text-gray-800',
    blue: 'ap-bg-blue-100 ap-text-blue-800',
    green: 'ap-bg-green-100 ap-text-green-800',
    yellow: 'ap-bg-yellow-100 ap-text-yellow-800',
    red: 'ap-bg-red-100 ap-text-red-800',
    purple: 'ap-bg-purple-100 ap-text-purple-800',
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Merge class names together, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get button classes based on variant, size, and disabled state
 */
export function getButtonClasses(
  variant: keyof typeof buttonStyles.variants = 'primary',
  size: keyof typeof buttonStyles.sizes = 'md',
  disabled?: boolean,
  className?: string
): string {
  const variantStyle = buttonStyles.variants[variant];
  return cn(
    buttonStyles.base,
    buttonStyles.sizes[size],
    disabled ? variantStyle.disabled : variantStyle.base,
    className
  );
}

/**
 * Get input classes based on error state and size
 */
export function getInputClasses(
  hasError?: boolean,
  size: keyof typeof formStyles.input.sizes = 'md',
  className?: string
): string {
  return cn(
    formStyles.input.base,
    formStyles.input.sizes[size],
    hasError && formStyles.input.error,
    className
  );
}
