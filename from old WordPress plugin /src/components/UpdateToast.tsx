import React, { useEffect, useState } from 'react';
import type { ChangeNotification } from '@/hooks/useGoalPolling';
import {
    HiOutlineChatBubbleOvalLeftEllipsis as UpdateIcon,
    HiOutlineCalendarDays as MeetingIcon,
    HiOutlineChatBubbleBottomCenterText as CommentIcon,
    HiXMark as XMarkIcon,
} from 'react-icons/hi2';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpdateToastProps {
    /** Array of pending notifications */
    notifications: ChangeNotification[];
    /** Dismiss handler */
    onDismiss: (id: string) => void;
    /** Click handler — scrolls to the relevant item */
    onClick?: (notification: ChangeNotification) => void;
}

// ─── Single Toast ────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 5000;

const ToastItem: React.FC<{
    notification: ChangeNotification;
    onDismiss: (id: string) => void;
    onClick?: (notification: ChangeNotification) => void;
}> = ({ notification, onDismiss, onClick }) => {
    const [isExiting, setIsExiting] = useState(false);

    // Auto-dismiss after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(notification.id), 300);
        }, AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [notification.id, onDismiss]);

    const handleClick = () => {
        if (onClick) onClick(notification);
        setIsExiting(true);
        setTimeout(() => onDismiss(notification.id), 200);
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExiting(true);
        setTimeout(() => onDismiss(notification.id), 200);
    };

    // Icon + color by notification type
    const config = {
        update: {
            icon: <UpdateIcon className="ap-h-5 ap-w-5" />,
            bg: 'ap-bg-purple-50',
            border: 'ap-border-purple-200',
            iconColor: 'ap-text-purple-500',
        },
        meeting: {
            icon: <MeetingIcon className="ap-h-5 ap-w-5" />,
            bg: 'ap-bg-blue-50',
            border: 'ap-border-blue-200',
            iconColor: 'ap-text-blue-500',
        },
        comment: {
            icon: <CommentIcon className="ap-h-5 ap-w-5" />,
            bg: 'ap-bg-green-50',
            border: 'ap-border-green-200',
            iconColor: 'ap-text-green-500',
        },
    }[notification.type];

    return (
        <div
            className={`
                ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-3
                ap-rounded-lg ap-shadow-lg ap-border
                ${config.bg} ${config.border}
                ap-cursor-pointer ap-transition-all ap-duration-300
                ${isExiting ? 'ap-opacity-0 ap-translate-x-4' : 'toast-slide-in ap-opacity-100'}
            `}
            onClick={handleClick}
            role="alert"
        >
            <div className={`ap-flex-shrink-0 ${config.iconColor}`}>
                {config.icon}
            </div>
            <p className="ap-flex-1 ap-text-sm ap-text-gray-700 ap-font-medium">
                {notification.message}
            </p>
            <button
                onClick={handleDismiss}
                className="ap-flex-shrink-0 ap-p-1 ap-rounded ap-text-gray-400 hover:ap-text-gray-600 ap-transition-colors"
                aria-label="Dismiss"
            >
                <XMarkIcon className="ap-h-4 ap-w-4" />
            </button>
        </div>
    );
};

// ─── Toast Container ─────────────────────────────────────────────────────────

/**
 * Non-blocking toast notification stack for real-time goal changes.
 *
 * Features:
 * - Stacks up to 3 visible toasts (oldest dismissed automatically)
 * - Auto-dismiss after 5 seconds
 * - Click to scroll to the relevant item
 * - Slide-in/out animations
 * - Fixed position bottom-right corner
 */
const UpdateToast: React.FC<UpdateToastProps> = ({
    notifications,
    onDismiss,
    onClick,
}) => {
    // Only show the 3 most recent
    const visible = notifications.slice(0, 3);

    if (visible.length === 0) return null;

    return (
        <div className="ap-fixed ap-bottom-4 ap-right-4 ap-z-50 ap-flex ap-flex-col ap-gap-2 ap-max-w-sm ap-w-full">
            {visible.map(notification => (
                <ToastItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={onDismiss}
                    onClick={onClick}
                />
            ))}
        </div>
    );
};

export default UpdateToast;
