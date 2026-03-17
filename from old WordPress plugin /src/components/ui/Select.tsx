/**
 * Select Component - AquaticPro Design System
 * 
 * A styled select dropdown with consistent appearance.
 * 
 * @example
 * <Select value={role} onChange={(e) => setRole(e.target.value)}>
 *   <option value="">Select a role...</option>
 *   <option value="admin">Admin</option>
 *   <option value="user">User</option>
 * </Select>
 */

import React from 'react';
import { cn } from '../../styles/theme';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Show error styling */
  error?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Select options */
  children: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          // Base TailAdmin select styling
          'ap-block ap-w-full ap-rounded-lg ap-border ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 ap-transition-all ap-duration-200',
          // Border and focus states
          error 
            ? 'ap-border-error-500 focus:ap-border-error-500 focus:ap-ring-4 focus:ap-ring-error-500/10' : 'ap-border-gray-200 focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10',
          // Disabled state
          'disabled:ap-bg-gray-50 disabled:ap-text-gray-500 disabled:ap-cursor-not-allowed',
          // Focus outline
          'focus:ap-outline-none',
          // Chevron styling
          'ap-appearance-none ap-bg-[url(\'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"%3E%3Cpath stroke="%236b7280" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m6 8 4 4 4-4"/%3E%3C/svg%3E\')] ap-bg-[position:right_0.5rem_center] ap-bg-[size:1.5em_1.5em] ap-bg-no-repeat ap-pr-10',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

export default Select;
