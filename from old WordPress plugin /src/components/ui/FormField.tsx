/**
 * FormField Component - AquaticPro Design System
 * 
 * A container for form fields with consistent spacing.
 * Includes helper components for form structure.
 * 
 * @example
 * <FormField>
 *   <Label htmlFor="email" required>Email</Label>
 *   <Input id="email" type="email" error={!!errors.email} />
 *   <FormHelper>We'll never share your email.</FormHelper>
 * </FormField>
 * 
 * // With error
 * <FormField>
 *   <Label htmlFor="password" required>Password</Label>
 *   <Input id="password" type="password" error={!!errors.password} />
 *   {errors.password && <FormError>{errors.password}</FormError>}
 * </FormField>
 */

import React from 'react';
import { formStyles, cn } from '../../styles/theme';

// =============================================================================
// FORM FIELD CONTAINER
// =============================================================================

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Field content */
  children: React.ReactNode;
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('ap-space-y-1', className)} {...props}>
        {children}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

// =============================================================================
// FORM HELPER TEXT
// =============================================================================

export interface FormHelperProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS classes */
  className?: string;
  /** Helper text content */
  children: React.ReactNode;
}

export const FormHelper = React.forwardRef<HTMLParagraphElement, FormHelperProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn(formStyles.helper.base, className)} {...props}>
        {children}
      </p>
    );
  }
);

FormHelper.displayName = 'FormHelper';

// =============================================================================
// FORM ERROR TEXT
// =============================================================================

export interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS classes */
  className?: string;
  /** Error message */
  children: React.ReactNode;
}

export const FormError = React.forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p ref={ref} className={cn(formStyles.helper.error, className)} {...props}>
        {children}
      </p>
    );
  }
);

FormError.displayName = 'FormError';

// =============================================================================
// FORM GROUP (horizontal layout)
// =============================================================================

export interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Group content */
  children: React.ReactNode;
}

export const FormGroup = React.forwardRef<HTMLDivElement, FormGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('ap-grid ap-gap-4 sm:ap-grid-cols-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

FormGroup.displayName = 'FormGroup';

export default FormField;
