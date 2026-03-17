/**
 * MyAssignments
 *
 * Staff-facing component: shows the current user's pending assigned lessons.
 * Rendered as a panel or banner within the LMS home view.
 */

import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
    HiOutlineClipboardDocumentList,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineCheckCircle,
    HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { getMyAssignments, MyAssignment } from '../../services/api-assigned-learning';

interface Props {
    /** Called when the user wants to open a specific lesson */
    onOpenLesson?: (lessonId: number) => void;
}

const MyAssignments: React.FC<Props> = ({ onOpenLesson }) => {
    const [assignments, setAssignments] = useState<MyAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMyAssignments()
            .then(setAssignments)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return null; // Silently load — don't flash a spinner on the LMS home
    }

    // Only show incomplete
    const pending = assignments.filter(a => a.progressStatus !== 'completed');
    const completed = assignments.filter(a => a.progressStatus === 'completed');

    if (pending.length === 0 && completed.length === 0) {
        return null; // Nothing assigned — hide entirely
    }

    const statusIcon = (a: MyAssignment) => {
        if (a.progressStatus === 'completed')
            return <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-500" />;
        if (a.isOverdue)
            return <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-500" />;
        if (a.isDueSoon)
            return <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-yellow-500" />;
        return <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5 ap-text-blue-500" />;
    };

    const urgencyBorder = (a: MyAssignment) => {
        if (a.isOverdue) return 'ap-border-red-300 ap-bg-red-50';
        if (a.isDueSoon) return 'ap-border-yellow-300 ap-bg-yellow-50';
        return 'ap-border-gray-200 ap-bg-white';
    };

    return (
        <div className="ap-mb-6">
            <h2 className="ap-text-base ap-font-semibold ap-text-gray-900 ap-mb-3 ap-flex ap-items-center ap-gap-2">
                <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5 ap-text-blue-600" />
                Your Assigned Learning
                {pending.length > 0 && (
                    <Badge variant="blue" size="sm">{pending.length} pending</Badge>
                )}
            </h2>

            <div className="ap-space-y-2">
                {pending.map(a => (
                    <div
                        key={a.assignmentId}
                        className={`ap-flex ap-items-center ap-justify-between ap-p-3 ap-rounded-lg ap-border ap-transition-colors ${urgencyBorder(a)}`}
                    >
                        <div className="ap-flex ap-items-center ap-gap-3">
                            {statusIcon(a)}
                            <div>
                                <p className="ap-text-sm ap-font-medium ap-text-gray-900">{a.title}</p>
                                <div className="ap-flex ap-items-center ap-gap-2 ap-mt-0.5">
                                    <Badge variant="gray" size="sm">{a.lessonType || 'content'}</Badge>
                                    {a.dueDate && (
                                        <span className={`ap-text-xs ${a.isOverdue ? 'ap-text-red-600 ap-font-semibold' : 'ap-text-gray-500'}`}>
                                            {a.isOverdue ? 'Overdue — ' : ''}
                                            Due {formatLocalDate(a.dueDate)}
                                        </span>
                                    )}
                                    {a.progressStatus === 'in-progress' && (
                                        <Badge variant="yellow" size="sm">In Progress</Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenLesson?.(a.lessonId)}
                            className="!ap-flex !ap-items-center !ap-gap-1 ap-whitespace-nowrap"
                        >
                            {a.progressStatus === 'in-progress' ? 'Continue' : 'Start'}
                            <HiOutlineArrowTopRightOnSquare className="ap-w-3.5 ap-h-3.5" />
                        </Button>
                    </div>
                ))}

                {/* Show completed section collapsed */}
                {completed.length > 0 && (
                    <details className="ap-mt-2">
                        <summary className="ap-text-xs ap-text-gray-500 ap-cursor-pointer hover:ap-text-gray-700">
                            {completed.length} completed assignment(s)
                        </summary>
                        <div className="ap-space-y-1 ap-mt-1">
                            {completed.map(a => (
                                <div
                                    key={a.assignmentId}
                                    className="ap-flex ap-items-center ap-gap-2 ap-p-2 ap-rounded ap-bg-green-50/50"
                                >
                                    <HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-text-green-500" />
                                    <span className="ap-text-sm ap-text-gray-600">{a.title}</span>
                                    {a.quizScore !== null && (
                                        <Badge variant="green" size="sm">{a.quizScore}%</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};

export default MyAssignments;
