/**
 * Button Component - AquaticPro Design System
 * 
 * A flexible, accessible button component with multiple variants and sizes.
 * Uses INLINE STYLES for core visual properties to override WordPress theme CSS.
 * 
 * @example
 * // Primary button (default)
 * <Button onClick={handleClick}>Save Changes</Button>
 * 
 * // Secondary button
 * <Button variant="secondary">Cancel</Button>
 * 
 * // Danger button with icon
 * <Button variant="danger" size="sm">
 *   <TrashIcon className="ap-h-4 ap-w-4" />
 *   Delete
 * </Button>
 * 
 * // Loading state
 * <Button loading>Saving...</Button>
 */

import React, { useState } from 'react';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'danger' 
  | 'success' 
  | 'warning' 
  | 'ghost' 
  | 'link' 
  | 'edit' 
  | 'icon'
  | 'unstyled'          // No inline styles - allows Tailwind classes to fully control styling
  // Sidebar Navigation variants
  | 'nav'               // Sidebar nav item - subtle gray
  | 'nav-active'        // Active sidebar nav item - bold violet gradient
  | 'nav-highlighted'   // Highlighted nav item (amber for attention)
  | 'nav-sub'           // Sidebar sub-nav item - left border accent
  | 'nav-sub-active'    // Active sidebar sub-nav item - purple left accent
  | 'nav-profile'       // Profile dropdown menu item
  | 'nav-profile-active' // Active profile dropdown item
  | 'nav-profile-danger' // Logout/danger item in profile dropdown
  // Outline variants - transparent background with colored border
  | 'outline'           // Gray outline
  | 'danger-outline'    // Red outline
  | 'success-outline'   // Green outline
  | 'warning-outline'   // Yellow/orange outline
  // Neobrutalist variants - bold, chunky style for Daily Logs
  | 'neobrutalist'        // Solid neobrutalist style
  | 'neobrutalist-outline' // Outline neobrutalist style
  // Reaction variants - minimal inline buttons for likes/reactions
  | 'reaction'          // Default gray reaction (no border)
  | 'reaction-like'     // Blue when active (thumbs up, no border)
  | 'reaction-dislike'  // Red when active (thumbs down, no border)
  | 'reaction-heart'    // Pink when active (heart, no border)
  // Reaction variants with border - for larger/more prominent reaction buttons
  | 'reaction-bordered'       // Default gray reaction with border
  | 'reaction-like-bordered'  // Blue when active with border
  | 'reaction-dislike-bordered' // Red when active with border
  | 'reaction-heart-bordered' // Pink when active with border
  // Lesson Management variants - solid (filled background)
  | 'lesson-groups'       // Blue - for groups/classes
  | 'lesson-swimmers'     // Green - for swimmers
  | 'lesson-evaluations'  // Purple - for evaluations
  | 'lesson-camp'         // Orange - for camps
  // Lesson Management variants - soft (light background, colored text)
  | 'lesson-groups-soft'
  | 'lesson-swimmers-soft'
  | 'lesson-evaluations-soft'
  | 'lesson-camp-soft'
  // Lesson Management TAB variants - for tab navigation (inactive/active states)
  | 'lesson-tab-groups'        // Blue tab - inactive
  | 'lesson-tab-groups-active' // Blue tab - active
  | 'lesson-tab-swimmers'      // Green tab - inactive
  | 'lesson-tab-swimmers-active' // Green tab - active
  | 'lesson-tab-evaluations'   // Purple tab - inactive
  | 'lesson-tab-evaluations-active' // Purple tab - active
  | 'lesson-tab-camp'          // Orange tab - inactive
  | 'lesson-tab-camp-active'   // Orange tab - active
  // Generic tab variants - for module navigation
  | 'tab'                      // Generic tab - inactive (blue theme)
  | 'tab-active';              // Generic tab - active (blue gradient)

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Show loading spinner and disable button */
  loading?: boolean;
  /** Alias for loading prop */
  isLoading?: boolean;
  /** Text to show when loading */
  loadingText?: string;
  /** Icon to display before children */
  leftIcon?: React.ReactNode;
  /** Alias for leftIcon */
  icon?: React.ReactNode;
  /** Icon to display after children */
  rightIcon?: React.ReactNode;
  /** Make button full width */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button content - optional for icon-only buttons */
  children?: React.ReactNode;
}

// Inline style definitions for each variant - these override ALL external CSS
const variantStyles: Record<ButtonVariant, {
  default: React.CSSProperties;
  hover: React.CSSProperties;
  active: React.CSSProperties;
}> = {
  primary: {
    default: {
      backgroundColor: '#2563eb', // blue-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#1d4ed8', // blue-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#1e40af', // blue-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  secondary: {
    default: {
      backgroundColor: '#f3f4f6', // gray-100
      color: '#374151', // gray-700
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#e5e7eb', // gray-200
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#d1d5db', // gray-300
      transform: 'none',
      boxShadow: 'none',
    },
  },
  danger: {
    default: {
      backgroundColor: '#fef2f2', // red-50
      color: '#dc2626', // red-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#fee2e2', // red-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#fecaca', // red-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  success: {
    default: {
      backgroundColor: '#16a34a', // green-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#15803d', // green-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#166534', // green-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  warning: {
    default: {
      backgroundColor: '#fff7ed', // orange-50
      color: '#ea580c', // orange-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#ffedd5', // orange-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#fed7aa', // orange-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  edit: {
    default: {
      backgroundColor: '#faf5ff', // purple-50
      color: '#9333ea', // purple-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#f3e8ff', // purple-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#e9d5ff', // purple-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  icon: {
    default: {
      backgroundColor: 'transparent',
      color: '#6b7280', // gray-500
      border: '2px solid transparent',
      boxShadow: 'none',
      borderRadius: '0.5rem',
      padding: '0.5rem',
    },
    hover: {
      backgroundColor: '#f3f4f6', // gray-100
    },
    active: {
      backgroundColor: '#e5e7eb', // gray-200
    },
  },
  ghost: {
    default: {
      backgroundColor: 'transparent',
      color: '#4b5563', // gray-600
      border: '2px solid transparent',
      boxShadow: 'none',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#f3f4f6', // gray-100
    },
    active: {
      backgroundColor: '#e5e7eb', // gray-200
    },
  },
  // Unstyled variant - no inline styles, allows Tailwind classes to control everything
  unstyled: {
    default: {},
    hover: {},
    active: {},
  },
  
  // ============================================================================
  // SIDEBAR NAVIGATION VARIANTS
  // ============================================================================
  
  // Nav item - darker violet base (main menu items)
  nav: {
    default: {
      background: '#ede9fe', // purple-100 - slightly darker
      color: '#374151', // gray-700
      border: '1px solid #a78bfa', // purple-400
      borderRadius: '0.5rem',
      padding: '0.625rem 0.875rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#ddd6fe', // purple-200
      borderColor: '#8b5cf6', // purple-500
      color: '#5b21b6', // purple-800
    },
    active: {
      background: '#c4b5fd', // purple-300
      borderColor: '#7c3aed', // purple-600
    },
  },
  
  // Nav item active state - bold violet with left accent
  'nav-active': {
    default: {
      background: 'linear-gradient(to right, #7c3aed, #6d28d9)', // purple-500 to purple-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 0.875rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #8b5cf6, #7c3aed)', // purple-500 to purple-600
      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
    },
    active: {
      background: 'linear-gradient(to right, #6d28d9, #5b21b6)', // purple-700 to purple-800
    },
  },
  
  // Sub-nav item - light violet (similar to old main nav styling)
  'nav-sub': {
    default: {
      background: '#f5f3ff', // purple-50 - light violet
      color: '#4b5563', // gray-600
      border: '1px solid #c4b5fd', // purple-300
      borderRadius: '0.375rem',
      padding: '0.375rem 0.75rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      fontSize: '0.8125rem',
      fontWeight: 400,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#ede9fe', // purple-100
      color: '#7c3aed', // purple-600
      borderColor: '#a78bfa', // purple-400
    },
    active: {
      background: '#ddd6fe', // purple-200
      borderColor: '#8b5cf6', // purple-500
    },
  },
  
  // Sub-nav item active state - purple gradient
  'nav-sub-active': {
    default: {
      background: 'linear-gradient(to right, #8b5cf6, #7c3aed)', // purple-500 to purple-600
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.375rem',
      padding: '0.375rem 0.75rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      fontSize: '0.8125rem',
      fontWeight: 600,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #a78bfa, #8b5cf6)', // purple-400 to purple-500
    },
    active: {
      background: 'linear-gradient(to right, #7c3aed, #6d28d9)', // purple-600 to purple-700
    },
  },
  
  // Highlighted nav item - attention-grabbing orange/amber
  'nav-highlighted': {
    default: {
      background: 'linear-gradient(135deg, #fef3c7, #fde68a)', // amber-100 to amber-200
      color: '#92400e', // amber-800
      border: '1px solid #f59e0b', // amber-500
      borderRadius: '0.5rem',
      padding: '0.625rem 0.875rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(135deg, #fde68a, #fcd34d)', // amber-200 to amber-300
      boxShadow: '0 4px 10px rgba(245, 158, 11, 0.35)',
    },
    active: {
      background: 'linear-gradient(135deg, #fcd34d, #f59e0b)', // amber-300 to amber-500
    },
  },
  
  // Profile menu item - for dropdown menu buttons
  'nav-profile': {
    default: {
      background: 'transparent',
      color: '#374151', // gray-700
      border: 'none',
      borderRadius: '0',
      padding: '0.625rem 1rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.875rem',
      fontWeight: 400,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#f5f3ff', // purple-50
      color: '#7c3aed', // purple-600
    },
    active: {
      background: '#ede9fe', // purple-100
    },
  },
  
  // Profile menu item active state
  'nav-profile-active': {
    default: {
      background: '#ede9fe', // purple-100
      color: '#7c3aed', // purple-600
      border: 'none',
      borderRadius: '0',
      padding: '0.625rem 1rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#ddd6fe', // purple-200
    },
    active: {
      background: '#c4b5fd', // purple-300
    },
  },
  
  // Profile logout button - red for danger action
  'nav-profile-danger': {
    default: {
      background: 'transparent',
      color: '#dc2626', // red-600
      border: 'none',
      borderRadius: '0',
      padding: '0.625rem 1rem',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      textAlign: 'left' as const,
      justifyContent: 'flex-start',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#fef2f2', // red-50
      color: '#b91c1c', // red-700
    },
    active: {
      background: '#fee2e2', // red-100
    },
  },
  
  link: {
    default: {
      backgroundColor: 'transparent',
      color: '#2563eb', // blue-600
      border: 'none',
      boxShadow: 'none',
      padding: 0,
      borderRadius: 0,
    },
    hover: {
      color: '#1d4ed8', // blue-700
      textDecoration: 'underline',
    },
    active: {
      color: '#1e40af', // blue-800
    },
  },
  
  // ============================================================================
  // OUTLINE VARIANTS - Transparent background with colored border (no 3D effect)
  // ============================================================================
  
  // Plain gray outline
  'outline': {
    default: {
      backgroundColor: 'transparent',
      color: '#374151', // gray-700
      border: '2px solid #d1d5db', // gray-300
      boxShadow: 'none',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#f9fafb', // gray-50
      borderColor: '#9ca3af', // gray-400
    },
    active: {
      backgroundColor: '#f3f4f6', // gray-100
    },
  },
  
  // Danger outline - red border
  'danger-outline': {
    default: {
      backgroundColor: 'transparent',
      color: '#dc2626', // red-600
      border: '2px solid #fca5a5', // red-300
      boxShadow: 'none',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#fef2f2', // red-50
      borderColor: '#f87171', // red-400
    },
    active: {
      backgroundColor: '#fee2e2', // red-100
    },
  },
  
  // Success outline - green border
  'success-outline': {
    default: {
      backgroundColor: 'transparent',
      color: '#16a34a', // green-600
      border: '2px solid #86efac', // green-300
      boxShadow: 'none',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#f0fdf4', // green-50
      borderColor: '#4ade80', // green-400
    },
    active: {
      backgroundColor: '#dcfce7', // green-100
    },
  },
  
  // Warning outline - yellow/orange border
  'warning-outline': {
    default: {
      backgroundColor: 'transparent',
      color: '#d97706', // amber-600
      border: '2px solid #fcd34d', // amber-300
      boxShadow: 'none',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#fffbeb', // amber-50
      borderColor: '#fbbf24', // amber-400
    },
    active: {
      backgroundColor: '#fef3c7', // amber-100
    },
  },
  
  // ============================================================================
  // LESSON MANAGEMENT VARIANTS - Solid (filled background)
  // ============================================================================
  
  // Groups/Classes - Blue theme
  'lesson-groups': {
    default: {
      backgroundColor: '#2563eb', // blue-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#1d4ed8', // blue-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#1e40af', // blue-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Swimmers - Green theme
  'lesson-swimmers': {
    default: {
      backgroundColor: '#16a34a', // green-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#15803d', // green-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#166534', // green-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Evaluations - Purple theme
  'lesson-evaluations': {
    default: {
      backgroundColor: '#9333ea', // purple-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#7e22ce', // purple-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#6b21a8', // purple-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Camps - Orange theme
  'lesson-camp': {
    default: {
      backgroundColor: '#ea580c', // orange-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#c2410c', // orange-700
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#9a3412', // orange-800
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // ============================================================================
  // LESSON MANAGEMENT VARIANTS - Soft (light background, colored text)
  // ============================================================================
  
  // Groups/Classes Soft - Light blue background
  'lesson-groups-soft': {
    default: {
      backgroundColor: '#eff6ff', // blue-50
      color: '#2563eb', // blue-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#dbeafe', // blue-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#bfdbfe', // blue-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Swimmers Soft - Light green background
  'lesson-swimmers-soft': {
    default: {
      backgroundColor: '#f0fdf4', // green-50
      color: '#16a34a', // green-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#dcfce7', // green-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#bbf7d0', // green-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Evaluations Soft - Light purple background
  'lesson-evaluations-soft': {
    default: {
      backgroundColor: '#faf5ff', // purple-50
      color: '#9333ea', // purple-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#f3e8ff', // purple-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#e9d5ff', // purple-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // Camps Soft - Light orange background
  'lesson-camp-soft': {
    default: {
      backgroundColor: '#fff7ed', // orange-50
      color: '#ea580c', // orange-600
      border: '2px solid #000000',
      boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.5rem',
    },
    hover: {
      backgroundColor: '#ffedd5', // orange-100
      transform: 'translate(-2px, -2px)',
    },
    active: {
      backgroundColor: '#fed7aa', // orange-200
      transform: 'none',
      boxShadow: 'none',
    },
  },
  
  // ============================================================================
  // LESSON MANAGEMENT TAB VARIANTS - Modern tab navigation with color themes
  // ============================================================================
  
  // Groups Tab - Blue (inactive)
  'lesson-tab-groups': {
    default: {
      background: '#dbeafe', // blue-100
      color: '#1d4ed8', // blue-700
      border: '1px solid #93c5fd', // blue-300
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#bfdbfe', // blue-200
      borderColor: '#60a5fa', // blue-400
    },
    active: {
      background: '#93c5fd', // blue-300
    },
  },
  
  // Groups Tab - Blue (active)
  'lesson-tab-groups-active': {
    default: {
      background: 'linear-gradient(to right, #2563eb, #1d4ed8)', // blue-600 to blue-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #3b82f6, #2563eb)', // blue-500 to blue-600
    },
    active: {
      background: 'linear-gradient(to right, #1d4ed8, #1e40af)', // blue-700 to blue-800
    },
  },
  
  // Swimmers Tab - Green (inactive)
  'lesson-tab-swimmers': {
    default: {
      background: '#dcfce7', // green-100
      color: '#15803d', // green-700
      border: '1px solid #86efac', // green-300
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#bbf7d0', // green-200
      borderColor: '#4ade80', // green-400
    },
    active: {
      background: '#86efac', // green-300
    },
  },
  
  // Swimmers Tab - Green (active)
  'lesson-tab-swimmers-active': {
    default: {
      background: 'linear-gradient(to right, #16a34a, #15803d)', // green-600 to green-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #22c55e, #16a34a)', // green-500 to green-600
    },
    active: {
      background: 'linear-gradient(to right, #15803d, #166534)', // green-700 to green-800
    },
  },
  
  // Evaluations Tab - Purple (inactive)
  'lesson-tab-evaluations': {
    default: {
      background: '#ede9fe', // purple-100
      color: '#7c3aed', // purple-600
      border: '1px solid #c4b5fd', // purple-300
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#ddd6fe', // purple-200
      borderColor: '#a78bfa', // purple-400
    },
    active: {
      background: '#c4b5fd', // purple-300
    },
  },
  
  // Evaluations Tab - Purple (active)
  'lesson-tab-evaluations-active': {
    default: {
      background: 'linear-gradient(to right, #7c3aed, #6d28d9)', // purple-600 to purple-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #8b5cf6, #7c3aed)', // purple-500 to purple-600
    },
    active: {
      background: 'linear-gradient(to right, #6d28d9, #5b21b6)', // purple-700 to purple-800
    },
  },
  
  // Camp Tab - Orange (inactive)
  'lesson-tab-camp': {
    default: {
      background: '#ffedd5', // orange-100
      color: '#c2410c', // orange-700
      border: '1px solid #fdba74', // orange-300
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#fed7aa', // orange-200
      borderColor: '#fb923c', // orange-400
    },
    active: {
      background: '#fdba74', // orange-300
    },
  },
  
  // Camp Tab - Orange (active)
  'lesson-tab-camp-active': {
    default: {
      background: 'linear-gradient(to right, #ea580c, #c2410c)', // orange-600 to orange-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #f97316, #ea580c)', // orange-500 to orange-600
    },
    active: {
      background: 'linear-gradient(to right, #c2410c, #9a3412)', // orange-700 to orange-800
    },
  },
  
  // ============================================================================
  // GENERIC TAB VARIANTS - For module navigation (blue theme)
  // ============================================================================
  
  // Generic Tab - inactive (light blue)
  'tab': {
    default: {
      background: '#dbeafe', // blue-100
      color: '#1d4ed8', // blue-700
      border: '1px solid #93c5fd', // blue-300
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'all 0.15s ease',
    },
    hover: {
      background: '#bfdbfe', // blue-200
      borderColor: '#60a5fa', // blue-400
    },
    active: {
      background: '#93c5fd', // blue-300
    },
  },
  
  // Generic Tab - active (blue gradient)
  'tab-active': {
    default: {
      background: 'linear-gradient(to right, #2563eb, #1d4ed8)', // blue-600 to blue-700
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
      transition: 'all 0.15s ease',
    },
    hover: {
      background: 'linear-gradient(to right, #3b82f6, #2563eb)', // blue-500 to blue-600
    },
    active: {
      background: 'linear-gradient(to right, #1d4ed8, #1e40af)', // blue-700 to blue-800
    },
  },
  
  // ============================================================================
  // NEOBRUTALIST VARIANTS - Bold, chunky style for Daily Logs
  // ============================================================================
  
  // Solid neobrutalist - purple primary
  'neobrutalist': {
    default: {
      backgroundColor: '#7c3aed', // violet-600
      color: '#ffffff',
      border: '2px solid #000000',
      boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
      borderRadius: '0.25rem',
      fontWeight: '600',
    },
    hover: {
      backgroundColor: '#6d28d9', // violet-700
      transform: 'translate(-2px, -2px)',
      boxShadow: '5px 5px 0 0 rgba(0,0,0,1)',
    },
    active: {
      backgroundColor: '#5b21b6', // violet-800
      transform: 'translate(1px, 1px)',
      boxShadow: '1px 1px 0 0 rgba(0,0,0,1)',
    },
  },
  
  // Outline neobrutalist - transparent with purple border
  'neobrutalist-outline': {
    default: {
      backgroundColor: 'transparent',
      color: '#7c3aed', // violet-600
      border: '2px solid #7c3aed',
      boxShadow: '3px 3px 0 0 rgba(124, 58, 237, 0.3)',
      borderRadius: '0.25rem',
      fontWeight: '600',
    },
    hover: {
      backgroundColor: '#f5f3ff', // violet-50
      transform: 'translate(-2px, -2px)',
      boxShadow: '5px 5px 0 0 rgba(124, 58, 237, 0.4)',
    },
    active: {
      backgroundColor: '#ede9fe', // violet-100
      transform: 'translate(1px, 1px)',
      boxShadow: '1px 1px 0 0 rgba(124, 58, 237, 0.3)',
    },
  },
  
  // ============================================================================
  // REACTION VARIANTS - Minimal inline buttons for likes/reactions
  // These have no border, no shadow - just color changes
  // ============================================================================
  
  // Base reaction - gray, inactive state
  'reaction': {
    default: {
      backgroundColor: 'transparent',
      color: '#6b7280', // gray-500
      border: 'none',
      boxShadow: 'none',
      borderRadius: '0.25rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 400,
    },
    hover: {
      backgroundColor: '#f3f4f6', // gray-100
      color: '#374151', // gray-700
    },
    active: {
      backgroundColor: '#e5e7eb', // gray-200
    },
  },
  
  // Like reaction - blue when active
  'reaction-like': {
    default: {
      backgroundColor: 'transparent',
      color: '#2563eb', // blue-600
      border: 'none',
      boxShadow: 'none',
      borderRadius: '0.25rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 500,
    },
    hover: {
      backgroundColor: '#eff6ff', // blue-50
      color: '#1d4ed8', // blue-700
    },
    active: {
      backgroundColor: '#dbeafe', // blue-100
    },
  },
  
  // Dislike reaction - red when active
  'reaction-dislike': {
    default: {
      backgroundColor: 'transparent',
      color: '#dc2626', // red-600
      border: 'none',
      boxShadow: 'none',
      borderRadius: '0.25rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 500,
    },
    hover: {
      backgroundColor: '#fef2f2', // red-50
      color: '#b91c1c', // red-700
    },
    active: {
      backgroundColor: '#fee2e2', // red-100
    },
  },
  
  // Heart reaction - pink when active
  'reaction-heart': {
    default: {
      backgroundColor: 'transparent',
      color: '#db2777', // pink-600
      border: 'none',
      boxShadow: 'none',
      borderRadius: '0.25rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 500,
    },
    hover: {
      backgroundColor: '#fdf2f8', // pink-50
      color: '#be185d', // pink-700
    },
    active: {
      backgroundColor: '#fce7f3', // pink-100
    },
  },
  
  // ============================================================================
  // BORDERED REACTION VARIANTS - Larger reaction buttons with border
  // Used in DailyLogCard and other prominent reaction areas
  // ============================================================================
  
  // Bordered gray reaction - inactive state
  'reaction-bordered': {
    default: {
      backgroundColor: '#f9fafb', // gray-50
      color: '#4b5563', // gray-600
      border: '1px solid #e5e7eb', // gray-200
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      minHeight: '44px',
    },
    hover: {
      backgroundColor: '#eff6ff', // blue-50
      color: '#2563eb', // blue-600
      borderColor: '#bfdbfe', // blue-200
    },
    active: {
      backgroundColor: '#dbeafe', // blue-100
    },
  },
  
  // Like bordered - blue when active
  'reaction-like-bordered': {
    default: {
      backgroundColor: '#eff6ff', // blue-50
      color: '#2563eb', // blue-600
      border: '1px solid #bfdbfe', // blue-200
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      minHeight: '44px',
    },
    hover: {
      backgroundColor: '#dbeafe', // blue-100
      borderColor: '#93c5fd', // blue-300
    },
    active: {
      backgroundColor: '#bfdbfe', // blue-200
    },
  },
  
  // Dislike bordered - red when active
  'reaction-dislike-bordered': {
    default: {
      backgroundColor: '#fef2f2', // red-50
      color: '#dc2626', // red-600
      border: '1px solid #fecaca', // red-200
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      minHeight: '44px',
    },
    hover: {
      backgroundColor: '#fee2e2', // red-100
      borderColor: '#fca5a5', // red-300
    },
    active: {
      backgroundColor: '#fecaca', // red-200
    },
  },
  
  // Heart bordered - pink when active
  'reaction-heart-bordered': {
    default: {
      backgroundColor: '#fdf2f8', // pink-50
      color: '#db2777', // pink-600
      border: '1px solid #fbcfe8', // pink-200
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      minHeight: '44px',
    },
    hover: {
      backgroundColor: '#fce7f3', // pink-100
      borderColor: '#f9a8d4', // pink-300
    },
    active: {
      backgroundColor: '#fbcfe8', // pink-200
    },
  },
};

// Size styles
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  xs: { padding: '0.375rem 0.625rem', fontSize: '0.75rem', minHeight: '36px', gap: '0.375rem' },
  sm: { padding: '0.5rem 0.75rem', fontSize: '0.875rem', minHeight: '40px', gap: '0.5rem' },
  md: { padding: '0.625rem 1rem', fontSize: '0.875rem', minHeight: '44px', gap: '0.5rem' },
  lg: { padding: '0.75rem 1.25rem', fontSize: '1rem', minHeight: '48px', gap: '0.625rem' },
  xl: { padding: '0.875rem 1.5rem', fontSize: '1rem', minHeight: '52px', gap: '0.75rem' },
};

const LoadingSpinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerSizes = {
    xs: { width: '0.75rem', height: '0.75rem' },
    sm: { width: '0.875rem', height: '0.875rem' },
    md: { width: '1rem', height: '1rem' },
    lg: { width: '1.25rem', height: '1.25rem' },
    xl: { width: '1.25rem', height: '1.25rem' },
  };

  return (
    <svg
      style={{ ...spinnerSizes[size], animation: 'spin 1s linear infinite' }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        style={{ opacity: 0.25 }}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        style={{ opacity: 0.75 }}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      isLoading = false,
      loadingText,
      leftIcon,
      icon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      style: propStyle,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const isLoadingState = loading || isLoading;
    const isDisabled = disabled || isLoadingState;
    const effectiveLeftIcon = leftIcon || icon;

    // Defensive: fallback to primary variant if variant is invalid
    const variantStyle = variantStyles[variant] || variantStyles.primary;
    const sizeStyle = sizeStyles[size] || sizeStyles.md;
    
    // For unstyled variant, skip all inline styles to let Tailwind classes work
    const isUnstyled = variant === 'unstyled';

    // Combine styles: base + size + variant state + disabled + fullWidth + custom
    const computedStyle: React.CSSProperties = isUnstyled 
      ? {
          // Only apply essential base styles for unstyled
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...(isDisabled ? { opacity: 0.5 } : {}),
          ...propStyle,
        }
      : {
          // Base styles
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          textDecoration: 'none',
          backgroundImage: 'none', // Override WordPress gradient backgrounds
          textShadow: 'none', // Override WordPress text shadows
          // Size styles
          ...sizeStyle,
          // Variant default styles
          ...variantStyle.default,
          // Hover styles (when hovered and not disabled)
          ...(isHovered && !isDisabled ? variantStyle.hover : {}),
          // Active styles (when pressed and not disabled)
          ...(isActive && !isDisabled ? variantStyle.active : {}),
          // Disabled styles
          ...(isDisabled ? { opacity: 0.5 } : {}),
          // Full width
          ...(fullWidth ? { width: '100%' } : {}),
          // Icon variant special sizing
          ...(variant === 'icon' ? { padding: '0.5rem' } : {}),
          // Link variant special sizing
          ...(variant === 'link' ? { padding: 0, minHeight: 'auto' } : {}),
          // Custom styles passed via props (highest priority)
          ...propStyle,
        };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(false);
      setIsActive(false);
      onMouseLeave?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsActive(true);
      onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsActive(false);
      onMouseUp?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        style={computedStyle}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        {...props}
      >
        {isLoadingState && <LoadingSpinner size={size} />}
        {isLoadingState && loadingText ? loadingText : null}
        {!isLoadingState && effectiveLeftIcon}
        {!isLoadingState && children}
        {!isLoadingState && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Convenience exports for common button patterns
export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
);

export const EditButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="edit" {...props} />
);

export const IconButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="icon" {...props} />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
);

// ============================================================================
// LESSON MANAGEMENT BUTTON EXPORTS
// ============================================================================

/** Blue button for Groups/Classes actions */
export const LessonGroupsButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-groups" {...props} />
);

/** Green button for Swimmers actions */
export const LessonSwimmersButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-swimmers" {...props} />
);

/** Purple button for Evaluations actions */
export const LessonEvaluationsButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-evaluations" {...props} />
);

/** Orange button for Camps actions */
export const LessonCampButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-camp" {...props} />
);

/** Soft blue button for secondary Groups/Classes actions */
export const LessonGroupsSoftButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-groups-soft" {...props} />
);

/** Soft green button for secondary Swimmers actions */
export const LessonSwimmersSoftButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-swimmers-soft" {...props} />
);

/** Soft purple button for secondary Evaluations actions */
export const LessonEvaluationsSoftButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-evaluations-soft" {...props} />
);

/** Soft orange button for secondary Camps actions */
export const LessonCampSoftButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="lesson-camp-soft" {...props} />
);

export default Button;
