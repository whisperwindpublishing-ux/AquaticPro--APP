/**
 * Label Component - AquaticPro Design System
 * 
 * A styled form label with optional required indicator.
 * 
 * @example
 * <Label htmlFor="email">Email Address</Label>
 * 
 * // With required indicator
 * <Label htmlFor="name" required>Full Name</Label>
 */

import React from 'react';
import { formStyles, cn } from '../../styles/theme';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Show required asterisk */
  required?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label content */
  children: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          formStyles.label.base,
          required && formStyles.label.required,
          className
        )}
        {...props}
      >
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';

export default Label;
