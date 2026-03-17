/**
 * Textarea Component - AquaticPro Design System
 * 
 * A styled textarea with consistent appearance.
 * 
 * @example
 * <Textarea 
 *   placeholder="Enter description..." 
 *   rows={4}
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 * />
 */

import React from 'react';
import { cn } from '../../styles/theme';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show error styling */
  error?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          // Base TailAdmin textarea styling
          'ap-block ap-w-full ap-rounded-lg ap-border ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 placeholder-gray-400 ap-transition-all ap-duration-200 ap-resize-y',
          // Border and focus states
          error 
            ? 'ap-border-error-500 focus:ap-border-error-500 focus:ap-ring-4 focus:ap-ring-error-500/10' : 'ap-border-gray-200 focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10',
          // Disabled state
          'disabled:ap-bg-gray-50 disabled:ap-text-gray-500 disabled:ap-cursor-not-allowed',
          // Focus outline
          'focus:ap-outline-none',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
