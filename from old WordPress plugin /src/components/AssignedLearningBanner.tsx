/**
 * AssignedLearningBanner
 *
 * Global banner (rendered in App.tsx below the TaskDeck banner) that notifies
 * the current user about pending assigned lessons.  Fetches from the
 * /my-assignments endpoint and renders a compact, dismissible bar.
 *
 * Dismiss behaviour mirrors AssignedCardsBanner — 24-hour localStorage cooldown.
 */

import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../utils/dateUtils';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import {
    HiOutlineAcademicCap,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineClock,
    HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { getMyAssignments, MyAssignment } from '@/services/api-assigned-learning';

interface AssignedLearningBannerProps {
    /** Called with a lessonId when the user clicks to open a specific lesson */
    onOpenLesson: (lessonId: number) => void;
}

const DISMISS_KEY = 'assignedLearningBannerDismissed';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const AssignedLearningBanner: React.FC<AssignedLearningBannerProps> = ({ onOpenLesson }) => {
    const [assignments, setAssignments] = useState<MyAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Check 24-hour dismissal
            const ts = localStorage.getItem(DISMISS_KEY);
            if (ts) {
                const elapsed = Date.now() - parseInt(ts, 10);
                if (elapsed < ONE_DAY_MS) {
                    setIsDismissed(true);
                    setIsLoading(false);
                    return;
                }
                localStorage.removeItem(DISMISS_KEY);
            }

            try {
                const data = await getMyAssignments();
                setAssignments(data);
            } catch (err) {
                console.error('Error fetching assigned learning:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
    };

    // Filter to pending only
    const pending = assignments.filter(a => a.progressStatus !== 'completed');

    // Don't render if dismissed, loading, or nothing pending
    if (isDismissed || isLoading || pending.length === 0) {
        return null;
    }

    const overdueCount = pending.filter(a => a.isOverdue).length;
    const dueSoonCount = pending.filter(a => a.isDueSoon).length;

    return (
        <div className="ap-bg-gradient-to-r ap-from-indigo-500 ap-to-purple-600 ap-text-white ap-rounded-lg ap-shadow-lg ap-mb-6 ap-overflow-hidden">
            <div className="ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between">
                <div className="ap-flex ap-items-center ap-gap-3">
                    <div className="ap-bg-white/20 ap-rounded-full ap-p-2">
                        <HiOutlineAcademicCap className="ap-w-6 ap-h-6" />
                    </div>
                    <div>
                        <h3 className="ap-font-semibold ap-text-lg">
                            You have {pending.length} assigned lesson{pending.length !== 1 ? 's' : ''} to complete
                        </h3>
                        <p className="ap-text-white/80 ap-text-sm">
                            {overdueCount > 0 && (
                                <span className="ap-text-red-200 ap-font-medium">
                                    <HiOutlineExclamationTriangle className="ap-w-3.5 ap-h-3.5 ap-inline ap-mr-0.5 ap-align-text-top" />
                                    {overdueCount} overdue
                                    {dueSoonCount > 0 ? ' • ' : ' '}
                                </span>
                            )}
                            {dueSoonCount > 0 && (
                                <span className="ap-text-yellow-200">
                                    <HiOutlineClock className="ap-w-3.5 ap-h-3.5 ap-inline ap-mr-0.5 ap-align-text-top" />
                                    {dueSoonCount} due soon
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-2">
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        size="sm"
                        className="!ap-text-white hover:!ap-bg-white/20"
                        aria-label="Dismiss notification"
                    >
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            </div>

            {/* Lesson items — each clickable to go directly to that lesson */}
            <div className="ap-bg-black/10 ap-px-4 ap-py-2 ap-border-t ap-border-white/10">
                <div className="ap-space-y-1">
                    {pending.slice(0, 4).map(a => (
                        <button
                            key={a.assignmentId}
                            onClick={() => onOpenLesson(a.lessonId)}
                            className="ap-w-full ap-flex ap-items-center ap-justify-between ap-gap-2 ap-px-3 ap-py-2 ap-rounded ap-bg-white/10 hover:ap-bg-white/20 ap-transition-colors ap-text-left ap-cursor-pointer"
                        >
                            <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0">
                                {a.isOverdue && <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4 ap-text-red-200 ap-flex-shrink-0" />}
                                {!a.isOverdue && a.isDueSoon && <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-yellow-200 ap-flex-shrink-0" />}
                                {!a.isOverdue && !a.isDueSoon && <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-text-white/60 ap-flex-shrink-0" />}
                                <span className="ap-text-sm ap-font-medium ap-truncate">{a.title}</span>
                                {a.dueDate && (
                                    <span className={`ap-text-xs ap-flex-shrink-0 ${a.isOverdue ? 'ap-text-red-200' : 'ap-text-white/60'}`}>
                                        Due {formatLocalDate(a.dueDate)}
                                    </span>
                                )}
                                {a.progressStatus === 'in-progress' && (
                                    <Badge variant="yellow" size="sm" className="!ap-text-[10px] !ap-px-1 ap-flex-shrink-0">In Progress</Badge>
                                )}
                            </div>
                            <div className="ap-flex ap-items-center ap-gap-1 ap-text-xs ap-text-white/80 ap-flex-shrink-0">
                                {a.progressStatus === 'in-progress' ? 'Continue' : 'Start'}
                                <HiOutlineArrowTopRightOnSquare className="ap-w-3.5 ap-h-3.5" />
                            </div>
                        </button>
                    ))}
                    {pending.length > 4 && (
                        <p className="ap-text-white/60 ap-text-xs ap-text-center ap-py-1">
                            +{pending.length - 4} more — open Learning to see all
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignedLearningBanner;
