/**
 * Card Component - AquaticPro Design System
 * 
 * A flexible card container with consistent styling for content grouping.
 * 
 * @example
 * // Basic card
 * <Card>
 *   <Card.Header>
 *     <Card.Title>Settings</Card.Title>
 *   </Card.Header>
 *   <Card.Body>Content here</Card.Body>
 * </Card>
 * 
 * // Card with footer
 * <Card>
 *   <Card.Body>Form content</Card.Body>
 *   <Card.Footer>
 *     <Button variant="secondary">Cancel</Button>
 *     <Button>Save</Button>
 *   </Card.Footer>
 * </Card>
 * 
 * // Flat variant (no shadow)
 * <Card variant="flat">...</Card>
 */

import React from 'react';
import { cardStyles, cn, typography } from '../../styles/theme';

export type CardVariant = 'default' | 'flat' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

// =============================================================================
// CARD ROOT
// =============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual style variant */
  variant?: CardVariant;
  /** Internal padding (applied to body by default) */
  padding?: CardPadding;
  /** Additional CSS classes */
  className?: string;
  /** Card content */
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardStyles.variants[variant], className)}
        {...props}
      >
        {React.Children.map(children, (child) => {
          // Pass padding prop to Card.Body if not explicitly set
          if (React.isValidElement(child) && child.type === CardBody) {
            return React.cloneElement(child as React.ReactElement<CardBodyProps>, {
              padding: (child.props as CardBodyProps).padding ?? padding,
            });
          }
          return child;
        })}
      </div>
    );
  }
);

Card.displayName = 'Card';

// =============================================================================
// CARD HEADER
// =============================================================================

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Header content */
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-flex ap-items-center ap-justify-between',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// =============================================================================
// CARD TITLE
// =============================================================================

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** HTML heading level */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Additional CSS classes */
  className?: string;
  /** Title content */
  children: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(typography.headings.h3, className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

// =============================================================================
// CARD DESCRIPTION
// =============================================================================

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS classes */
  className?: string;
  /** Description content */
  children: React.ReactNode;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('ap-text-sm ap-text-gray-500 ap-mt-1', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

// =============================================================================
// CARD BODY
// =============================================================================

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Internal padding */
  padding?: CardPadding;
  /** Additional CSS classes */
  className?: string;
  /** Body content */
  children: React.ReactNode;
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ padding = 'md', className, children, ...props }, ref) => {
    const paddingClasses = {
      none: '',
      sm: 'ap-p-2 md:ap-p-4',
      md: 'ap-p-3 md:ap-p-6',
      lg: 'ap-p-4 md:ap-p-8',
    };
    
    return (
      <div
        ref={ref}
        className={cn(paddingClasses[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// =============================================================================
// CARD FOOTER
// =============================================================================

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Footer content */
  children: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-flex ap-items-center ap-justify-end ap-gap-3 ap-bg-gray-50',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

// Create a compound component with all sub-components attached
type CardComponent = typeof Card & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

const CardCompound = Card as CardComponent;
CardCompound.Header = CardHeader;
CardCompound.Title = CardTitle;
CardCompound.Description = CardDescription;
CardCompound.Body = CardBody;
CardCompound.Footer = CardFooter;

export default CardCompound;
