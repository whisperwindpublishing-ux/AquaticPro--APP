/**
 * Modal Component - AquaticPro Design System
 * 
 * A flexible modal/dialog component with overlay, animations, and keyboard handling.
 * 
 * @example
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="md">
 *   <Modal.Header>
 *     <Modal.Title>Edit Profile</Modal.Title>
 *   </Modal.Header>
 *   <Modal.Body>
 *     Form content here...
 *   </Modal.Body>
 *   <Modal.Footer>
 *     <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
 *     <Button onClick={handleSave}>Save Changes</Button>
 *   </Modal.Footer>
 * </Modal>
 */

import React, { useEffect, useCallback } from 'react';
import { modalStyles, cn, typography } from '../../styles/theme';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

// =============================================================================
// MODAL ROOT
// =============================================================================

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Size variant */
  size?: ModalSize;
  /** Prevent closing on overlay click */
  closeOnOverlayClick?: boolean;
  /** Prevent closing on Escape key */
  closeOnEscape?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Modal content */
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Title: typeof ModalTitle;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  children,
}) => {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [onClose, closeOnEscape]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'ap-hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div
      className="ap-fixed ap-inset-0 ap-bg-gray-900/50 ap-backdrop-blur-sm ap-flex ap-items-start ap-justify-center ap-z-50 ap-pt-16 ap-overflow-y-auto ap-animate-fadeIn"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn(
        'ap-bg-white ap-rounded-xl ap-shadow-xl ap-max-h-[85vh] ap-overflow-hidden ap-flex ap-flex-col ap-my-8 ap-animate-slideUp',
        // TailAdmin size variants
        size === 'sm' && 'ap-max-w-md ap-w-full',
        size === 'md' && 'ap-max-w-lg ap-w-full',
        size === 'lg' && 'ap-max-w-2xl ap-w-full',
        size === 'xl' && 'ap-max-w-4xl ap-w-full',
        size === 'full' && 'ap-max-w-[95vw] ap-w-full',
        className
      )}>
        {children}
      </div>
    </div>
  );
};

// =============================================================================
// MODAL HEADER
// =============================================================================

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show close button */
  showCloseButton?: boolean;
  /** Close callback (required if showCloseButton is true) */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Header content */
  children: React.ReactNode;
}

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ showCloseButton = false, onClose, className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(modalStyles.header, className)} {...props}>
        <div className="ap-flex-1">{children}</div>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ap-text-gray-400 hover:ap-text-gray-600 ap-transition-colors ap-p-1 ap-rounded hover:ap-bg-gray-100"
            aria-label="Close"
          >
            <svg className="ap-h-5 ap-w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

// =============================================================================
// MODAL TITLE
// =============================================================================

export interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Additional CSS classes */
  className?: string;
  /** Title content */
  children: React.ReactNode;
}

const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h2 ref={ref} className={cn(typography.headings.h2, className)} {...props}>
        {children}
      </h2>
    );
  }
);

ModalTitle.displayName = 'ModalTitle';

// =============================================================================
// MODAL BODY
// =============================================================================

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Body content */
  children: React.ReactNode;
}

const ModalBody = React.forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(modalStyles.body, className)} {...props}>
        {children}
      </div>
    );
  }
);

ModalBody.displayName = 'ModalBody';

// =============================================================================
// MODAL FOOTER
// =============================================================================

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Footer content */
  children: React.ReactNode;
}

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(modalStyles.footer, className)} {...props}>
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export { ModalHeader, ModalTitle, ModalBody, ModalFooter };
export default Modal;
