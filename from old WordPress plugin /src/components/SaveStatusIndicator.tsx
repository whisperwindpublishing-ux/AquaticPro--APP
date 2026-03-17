import React from 'react';
import { AutoSaveStatus } from '@/hooks/useAutoSave';
import {
    HiOutlineCheck as CheckIcon,
    HiOutlineExclamationTriangle as WarningIcon,
    HiOutlineArrowPath as RetryIcon,
} from 'react-icons/hi2';

interface SaveStatusIndicatorProps {
    /** Aggregated save status */
    status: AutoSaveStatus;
    /** Retry callback for error state */
    onRetry?: () => void;
    /** Optional CSS class */
    className?: string;
}

/**
 * Persistent save status indicator that shows the current save state.
 * 
 * States:
 * - idle:    "All changes saved" (green, subtle)
 * - pending: "Unsaved changes" (amber, subtle)
 * - saving:  "Saving..." (amber, pulse animation)
 * - saved:   "Saved" (green, briefly prominent)
 * - error:   "Save failed — Retry" (red, with retry button)
 */
const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status, onRetry, className = '' }) => {
    const config = {
        idle: {
            text: 'All changes saved',
            icon: <CheckIcon className="ap-h-3.5 ap-w-3.5" />,
            className: 'ap-text-gray-400',
            animate: false,
        },
        pending: {
            text: 'Unsaved changes',
            icon: <span className="ap-h-2 ap-w-2 ap-rounded-full ap-bg-amber-400 ap-inline-block" />,
            className: 'ap-text-amber-600',
            animate: false,
        },
        saving: {
            text: 'Saving...',
            icon: <RetryIcon className="ap-h-3.5 ap-w-3.5 ap-animate-spin" />,
            className: 'ap-text-amber-600',
            animate: true,
        },
        saved: {
            text: 'Saved',
            icon: <CheckIcon className="ap-h-3.5 ap-w-3.5" />,
            className: 'ap-text-green-600',
            animate: false,
        },
        error: {
            text: 'Save failed',
            icon: <WarningIcon className="ap-h-3.5 ap-w-3.5" />,
            className: 'ap-text-red-600',
            animate: false,
        },
    };

    const { text, icon, className: statusClass, animate } = config[status];

    return (
        <div
            className={`ap-inline-flex ap-items-center ap-gap-1.5 ap-text-xs ap-font-medium ap-select-none ap-transition-colors ap-duration-300 ${statusClass} ${className}`}
            role="status"
            aria-live="polite"
            aria-label={`Save status: ${text}`}
        >
            <span className={animate ? 'ap-animate-pulse' : ''}>
                {icon}
            </span>
            <span>{text}</span>
            {status === 'error' && onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="ap-ml-1 ap-text-red-700 ap-underline ap-underline-offset-2 hover:ap-text-red-800 ap-cursor-pointer ap-text-xs ap-font-medium"
                    aria-label="Retry saving"
                >
                    Retry
                </button>
            )}
        </div>
    );
};

export default SaveStatusIndicator;
