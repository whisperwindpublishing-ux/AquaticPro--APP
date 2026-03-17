/**
 * Input Component - AquaticPro Design System
 * 
 * A styled text input with consistent appearance and error states.
 * 
 * @example
 * // Basic input
 * <Input placeholder="Enter name..." />
 * 
 * // With label and error
 * <FormField>
 *   <Label htmlFor="email" required>Email</Label>
 *   <Input id="email" type="email" error={!!errors.email} />
 *   {errors.email && <FormError>{errors.email}</FormError>}
 * </FormField>
 */

import React from 'react';
import { cn } from '../../styles/theme';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Size variant */
  size?: InputSize;
  /** Show error styling */
  error?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', error = false, className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          // Base TailAdmin input styling
          'ap-block ap-w-full ap-rounded-lg ap-border ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 placeholder-gray-400 ap-transition-all ap-duration-200',
          // Border and focus states
          error 
            ? 'ap-border-error-500 focus:ap-border-error-500 focus:ap-ring-4 focus:ap-ring-error-500/10' : 'ap-border-gray-200 focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10',
          // Disabled state
          'disabled:ap-bg-gray-50 disabled:ap-text-gray-500 disabled:ap-cursor-not-allowed',
          // Focus outline
          'focus:ap-outline-none',
          // Size variants
          size === 'sm' && 'ap-px-2.5 ap-py-1.5 ap-text-xs',
          size === 'lg' && 'ap-px-4 ap-py-2.5 ap-text-base',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
