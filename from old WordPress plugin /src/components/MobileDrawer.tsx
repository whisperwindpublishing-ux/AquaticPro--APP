import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HiXMark as XMarkIcon } from 'react-icons/hi2';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MobileDrawerProps {
    /** Whether the drawer is open */
    isOpen: boolean;
    /** Close handler */
    onClose: () => void;
    /** Drawer title text */
    title: string;
    /** Icon rendered before the title */
    icon?: React.ReactNode;
    /** Badge count displayed next to the title */
    count?: number;
    /** Accent color for the header border */
    accentColor?: string;
    /** Drawer content */
    children: React.ReactNode;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum horizontal swipe distance (px) to trigger dismiss */
const SWIPE_THRESHOLD = 80;
/** Minimum velocity (px/ms) to trigger dismiss even below threshold */
const VELOCITY_THRESHOLD = 0.5;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Slide-in drawer panel for mobile viewports.
 *
 * - Slides in from the right edge (80% viewport width)
 * - Backdrop dims the content behind
 * - Swipe-right to dismiss (touch devices)
 * - Tap backdrop or X button to close
 * - Traps focus inside the drawer when open
 * - Prevents body scroll when open
 */
const MobileDrawer: React.FC<MobileDrawerProps> = ({
    isOpen,
    onClose,
    title,
    icon,
    count,
    accentColor = '#3b82f6',
    children,
}) => {
    const drawerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const currentTranslateRef = useRef(0);

    // ── Body scroll lock ────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';

            return () => {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);

    // ── Escape key handler ──────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // ── Focus trap: focus drawer on open ────────────────────────────────────
    useEffect(() => {
        if (isOpen && drawerRef.current) {
            drawerRef.current.focus();
        }
    }, [isOpen]);

    // ── Swipe-to-dismiss (touch events) ─────────────────────────────────────
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        currentTranslateRef.current = 0;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || !drawerRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // Only track horizontal swipes (ignore vertical scrolling)
        if (deltaY > Math.abs(deltaX)) return;

        // Only allow swiping to the right (closing direction)
        if (deltaX > 0) {
            currentTranslateRef.current = deltaX;
            drawerRef.current.style.transform = `translateX(${deltaX}px)`;
            drawerRef.current.style.transition = 'none';
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartRef.current || !drawerRef.current) return;

        const elapsed = Date.now() - touchStartRef.current.time;
        const velocity = currentTranslateRef.current / elapsed;
        const shouldDismiss =
            currentTranslateRef.current > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

        if (shouldDismiss) {
            // Animate out before closing
            drawerRef.current.style.transition = 'transform 200ms ease-out';
            drawerRef.current.style.transform = 'translateX(100%)';
            setTimeout(onClose, 200);
        } else {
            // Snap back
            drawerRef.current.style.transition = 'transform 200ms ease-out';
            drawerRef.current.style.transform = 'translateX(0)';
        }

        touchStartRef.current = null;
        currentTranslateRef.current = 0;
    }, [onClose]);

    // ── Don't render when closed ────────────────────────────────────────────
    if (!isOpen) return null;

    // Portal into #root so Tailwind scoped styles (important: '#root') apply.
    const portalTarget = document.getElementById('root') || document.body;

    return createPortal(
        <div className="ap-fixed ap-inset-0" style={{ zIndex: 999999 }}>
            {/* Backdrop */}
            <div
                className="ap-absolute ap-inset-0 ap-bg-black/40 ap-backdrop-blur-sm drawer-backdrop-enter"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer panel */}
            <div
                ref={drawerRef}
                className="ap-absolute ap-top-0 ap-right-0 ap-bottom-0 ap-w-[85vw] ap-max-w-md ap-bg-white ap-shadow-2xl ap-flex ap-flex-col ap-outline-none drawer-panel-enter"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Header */}
                <div
                    className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-3 ap-border-b-2 ap-flex-shrink-0"
                    style={{ borderBottomColor: accentColor }}
                >
                    <div className="ap-flex ap-items-center ap-gap-2">
                        {icon && (
                            <span style={{ color: accentColor }}>{icon}</span>
                        )}
                        <h2 className="ap-font-semibold ap-text-gray-900 ap-text-lg">{title}</h2>
                        {count !== undefined && (
                            <span
                                className="ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full"
                                style={{
                                    backgroundColor: `${accentColor}15`,
                                    color: accentColor,
                                }}
                            >
                                {count}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="ap-p-1.5 ap-rounded-lg ap-text-gray-400 hover:ap-text-gray-600 hover:ap-bg-gray-100 ap-transition-colors"
                        aria-label="Close drawer"
                    >
                        <XMarkIcon className="ap-h-5 ap-w-5" />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="ap-flex-1 ap-overflow-y-auto ap-overflow-x-hidden ap-p-4">
                    {children}
                </div>
            </div>
        </div>,
        portalTarget
    );
};

export default MobileDrawer;
