/**
 * Checkbox Component - AquaticPro Design System
 * 
 * A styled checkbox with optional label.
 * 
 * @example
 * // Standalone checkbox
 * <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
 * 
 * // With inline label
 * <Checkbox 
 *   label="I agree to the terms"
 *   checked={agreed}
 *   onChange={(e) => setAgreed(e.target.checked)}
 * />
 */

import React from 'react';
import { cn } from '../../styles/theme';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional inline label */
  label?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the checkbox input */
  inputClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, inputClassName, id, ...props }, ref) => {
    // Generate a unique ID if not provided (for label association)
    const inputId = id || `checkbox-${React.useId()}`;

    const checkboxClasses = cn(
      // Base TailAdmin checkbox styling
      'ap-h-4 ap-w-4 ap-rounded ap-border-gray-300 ap-text-brand-500 ap-transition-all ap-duration-200',
      // Focus ring
      'focus:ap-ring-4 focus:ap-ring-brand-500/20 focus:ap-ring-offset-0',
      // Disabled state
      'disabled:ap-bg-gray-50 disabled:ap-cursor-not-allowed',
      inputClassName
    );

    if (label) {
      return (
        <label 
          htmlFor={inputId} 
          className={cn(
            'ap-inline-flex ap-items-center ap-gap-2 ap-text-sm ap-font-medium ap-text-gray-700 ap-cursor-pointer',
            className
          )}
        >
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className={checkboxClasses}
            {...props}
          />
          <span>{label}</span>
        </label>
      );
    }

    return (
      <input
        ref={ref}
        type="checkbox"
        id={inputId}
        className={cn(checkboxClasses, className)}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
