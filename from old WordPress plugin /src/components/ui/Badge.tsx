/**
 * Badge Component - AquaticPro Design System
 * 
 * A small status indicator or tag component.
 * 
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="green">Active</Badge>
 * <Badge variant="red">Overdue</Badge>
 * <Badge variant="blue" size="lg">New Feature</Badge>
 */

import React from 'react';
import { cn } from '../../styles/theme';

export type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Color variant */
  variant?: BadgeVariant;
  /** Size variant */
  size?: BadgeSize;
  /** Additional CSS classes */
  className?: string;
  /** Badge content */
  children: React.ReactNode;
}

const sizesStyles = {
  sm: 'ap-px-1.5 ap-py-0.5 ap-text-[10px]',
  md: 'ap-px-2.5 ap-py-0.5 ap-text-xs',
  lg: 'ap-px-3 ap-py-1 ap-text-sm',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'gray', size = 'md', className, children, ...props }, ref) => {
    // TailAdmin badge variants
    const variantClasses = {
      gray: 'ap-bg-gray-100 ap-text-gray-700 ap-border ap-border-gray-200',
      blue: 'ap-bg-blue-50 ap-text-blue-700 ap-border ap-border-blue-200',
      green: 'ap-bg-green-50 ap-text-green-700 ap-border ap-border-green-200',
      yellow: 'ap-bg-yellow-50 ap-text-yellow-700 ap-border ap-border-yellow-200',
      red: 'ap-bg-red-50 ap-text-red-700 ap-border ap-border-red-200',
      purple: 'ap-bg-purple-50 ap-text-purple-700 ap-border ap-border-purple-200',
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          'ap-inline-flex ap-items-center ap-font-medium ap-rounded-full',
          variantClasses[variant],
          sizesStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Convenience components for common variants
export const StatusBadge: React.FC<{ 
  status: 'active' | 'inactive' | 'pending' | 'error' | 'success';
  className?: string;
}> = ({ status, className }) => {
  const statusConfig = {
    active: { variant: 'green' as const, label: 'Active' },
    inactive: { variant: 'gray' as const, label: 'Inactive' },
    pending: { variant: 'yellow' as const, label: 'Pending' },
    error: { variant: 'red' as const, label: 'Error' },
    success: { variant: 'green' as const, label: 'Success' },
  };

  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
};

StatusBadge.displayName = 'StatusBadge';

export default Badge;
