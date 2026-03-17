import React, { useRef, useEffect } from 'react';
import { CardState, ExpandableCardConfig } from '@/hooks/useExpandableCards';
import { HiOutlineChevronDown as ChevronDownIcon, HiOutlineChevronUp as ChevronUpIcon } from 'react-icons/hi2';

interface ExpandableCardProps {
    /** Card configuration from useExpandableCards */
    config: ExpandableCardConfig;
    /** Click handler for the card header (toggle expand/collapse) */
    onToggle: () => void;
    /** Card title displayed in header */
    title: string;
    /** Icon displayed next to title */
    icon: React.ReactNode;
    /** Optional count badge (e.g., task count, meeting count) */
    count?: number;
    /** Optional "+New" button in the header */
    onAdd?: () => void;
    /** CSS color variable for card accent */
    accentColor?: string;
    /** Card body content */
    children: React.ReactNode;
    /** Optional className for the outer wrapper */
    className?: string;
}

/**
 * Generic expandable card shell used in the workspace center column.
 * Supports three visual states: collapsed (header-only), default, and expanded.
 * Uses CSS transitions for smooth push-and-compress behavior.
 */
const ExpandableCard: React.FC<ExpandableCardProps> = ({
    config,
    onToggle,
    title,
    icon,
    count,
    onAdd,
    accentColor = 'var(--brand-primary, #6366f1)',
    children,
    className = '',
}) => {
    const bodyRef = useRef<HTMLDivElement>(null);

    // When card expands, scroll the body to top
    useEffect(() => {
        if (config.state === 'expanded' && bodyRef.current) {
            bodyRef.current.scrollTop = 0;
        }
    }, [config.state]);

    const stateClasses: Record<CardState, string> = {
        collapsed: 'ap-cursor-pointer',
        default: '',
        expanded: '',
    };

    return (
        <div
            className={`ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden ap-transition-all ap-duration-300 ap-ease-in-out ap-flex ap-flex-col ${stateClasses[config.state]} ${className}`}
            style={{
                flexGrow: config.flexGrow,
                flexBasis: config.state === 'collapsed' ? '60px' : '0%',
                minHeight: config.state === 'collapsed' ? '60px' : '200px',
            }}
        >
            {/* Card Header — always visible, clickable to toggle */}
            <div
                className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-3 ap-border-b ap-border-gray-100 ap-cursor-pointer hover:ap-bg-gray-50 ap-transition-colors ap-select-none ap-flex-shrink-0"
                onClick={onToggle}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
                style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
                role="button"
                tabIndex={0}
                aria-expanded={config.state !== 'collapsed'}
                aria-label={`${title} section${count !== undefined ? ` (${count} items)` : ''} — ${config.state === 'collapsed' ? 'expand' : config.state === 'expanded' ? 'collapse' : 'click to expand'}`}
            >
                <div className="ap-flex ap-items-center ap-gap-2">
                    <span className="ap-text-gray-600">{icon}</span>
                    <h3 className="ap-font-semibold ap-text-gray-900 ap-text-sm">{title}</h3>
                    {count !== undefined && (
                        <span
                            className="ap-text-xs ap-font-medium ap-px-2 ap-py-0.5 ap-rounded-full"
                            style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}
                        >
                            {count}
                        </span>
                    )}
                </div>
                <div className="ap-flex ap-items-center ap-gap-2">
                    {/* "+New" button — visible in default and expanded states, not when collapsed */}
                    {onAdd && config.showBody && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdd();
                            }}
                            className="ap-text-xs ap-font-medium ap-px-2 ap-py-1 ap-rounded ap-bg-gray-100 hover:ap-bg-gray-200 ap-text-gray-600 hover:ap-text-gray-800 ap-transition-colors"
                        >
                            + New
                        </button>
                    )}
                    {/* Expand/collapse chevron */}
                    <span className="ap-text-gray-400 ap-transition-transform ap-duration-300">
                        {config.state === 'expanded' ? (
                            <ChevronUpIcon className="ap-h-4 ap-w-4" />
                        ) : (
                            <ChevronDownIcon className="ap-h-4 ap-w-4" />
                        )}
                    </span>
                </div>
            </div>

            {/* Card Body — hidden when collapsed, scrollable when visible */}
            {config.showBody && (
                <div
                    ref={bodyRef}
                    className="ap-flex-1 ap-overflow-y-auto ap-p-4 ap-transition-opacity ap-duration-300"
                    style={{
                        opacity: config.state === 'collapsed' ? 0 : 1,
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

export default ExpandableCard;
