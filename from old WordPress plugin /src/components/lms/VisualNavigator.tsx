/**
 * VisualNavigator.tsx
 * 
 * SVG-based "learning path" component showing lesson nodes.
 * Provides a visual map of course progress with animated transitions.
 */

import React, { useState, useMemo } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { motion } from 'framer-motion';
import {
    HiOutlinePlay,
    HiOutlineCheckCircle,
    HiOutlineLockClosed,
    HiOutlineSquares2X2,
} from 'react-icons/hi2';

export interface LessonNode {
    id: number;
    title: string;
    order: number;
    is_bite_sized: boolean;
    progress: {
        status: 'not-started' | 'in-progress' | 'completed';
        score: number;
        last_viewed: string | null;
        completed_at: string | null;
    };
}

interface VisualNavigatorProps {
    /** Course title */
    courseTitle: string;
    /** Array of lessons with progress */
    lessons: LessonNode[];
    /** Currently selected lesson ID */
    currentLessonId?: number;
    /** Callback when lesson node is clicked */
    onLessonSelect: (lesson: LessonNode) => void;
    /** Whether to show locked lessons (requires sequential completion) */
    requireSequential?: boolean;
    /** Custom class */
    className?: string;
}

const VisualNavigator: React.FC<VisualNavigatorProps> = ({
    courseTitle,
    lessons,
    currentLessonId,
    onLessonSelect,
    requireSequential = false,
    className = '',
}) => {
    const [hoveredNode, setHoveredNode] = useState<number | null>(null);

    // Calculate which lessons are unlocked
    const lessonStates = useMemo(() => {
        return lessons.map((lesson, index) => {
            // First lesson is always unlocked
            if (index === 0) return { ...lesson, isLocked: false };
            
            if (!requireSequential) return { ...lesson, isLocked: false };

            // Check if previous lesson is completed
            const prevLesson = lessons[index - 1];
            const isLocked = prevLesson?.progress.status !== 'completed';
            
            return { ...lesson, isLocked };
        });
    }, [lessons, requireSequential]);

    // Calculate completion stats
    const stats = useMemo(() => {
        const completed = lessons.filter(l => l.progress.status === 'completed').length;
        const inProgress = lessons.filter(l => l.progress.status === 'in-progress').length;
        const total = lessons.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, inProgress, total, percentage };
    }, [lessons]);

    // Get node color based on status
    const getNodeColor = (lesson: LessonNode & { isLocked: boolean }) => {
        if (lesson.isLocked) return { bg: 'bg-gray-300', ring: 'ring-gray-400', text: 'text-gray-400' };
        
        switch (lesson.progress.status) {
            case 'completed':
                return { bg: 'bg-green-500', ring: 'ring-green-400', text: 'text-green-600' };
            case 'in-progress':
                return { bg: 'bg-blue-500', ring: 'ring-blue-400', text: 'text-blue-600' };
            default:
                return { bg: 'bg-gray-400', ring: 'ring-gray-300', text: 'text-gray-500' };
        }
    };

    // Get node icon
    const getNodeIcon = (lesson: LessonNode & { isLocked: boolean }) => {
        if (lesson.isLocked) return <HiOutlineLockClosed className="ap-w-5 ap-h-5" />;
        
        switch (lesson.progress.status) {
            case 'completed':
                return <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />;
            case 'in-progress':
                return <HiOutlinePlay className="ap-w-5 ap-h-5" />;
            default:
                return <span className="ap-font-bold">{lesson.order}</span>;
        }
    };

    return (
        <div className={`ap-bg-white ap-rounded-xl ap-shadow-lg ap-p-6 ${className}`}>
            {/* Header */}
            <div className="ap-mb-6">
                <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">{courseTitle}</h2>
                <div className="ap-flex ap-items-center ap-gap-4 ap-mt-2">
                    <div className="ap-flex-1 ap-bg-gray-200 ap-rounded-full ap-h-2 ap-overflow-hidden">
                        <motion.div
                            className="ap-h-full ap-bg-gradient-to-r ap-from-blue-500 ap-to-green-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.percentage}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="ap-text-sm ap-font-medium ap-text-gray-600">
                        {stats.percentage}% Complete
                    </span>
                </div>
                <div className="ap-flex ap-items-center ap-gap-4 ap-mt-2 ap-text-xs ap-text-gray-500">
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-rounded-full ap-bg-green-500" />
                        {stats.completed} Completed
                    </span>
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-rounded-full ap-bg-blue-500" />
                        {stats.inProgress} In Progress
                    </span>
                    <span className="ap-flex ap-items-center ap-gap-1">
                        <span className="ap-w-2 ap-h-2 ap-rounded-full ap-bg-gray-400" />
                        {stats.total - stats.completed - stats.inProgress} Not Started
                    </span>
                </div>
            </div>

            {/* Visual Path */}
            <div className="ap-relative">
                {/* Connection line */}
                <div className="ap-absolute ap-left-6 ap-top-6 ap-bottom-6 ap-w-0.5 ap-bg-gray-200" />

                {/* Lesson nodes */}
                <div className="ap-space-y-4">
                    {lessonStates.map((lesson, index) => {
                        const colors = getNodeColor(lesson);
                        const isActive = currentLessonId === lesson.id;
                        const isHovered = hoveredNode === lesson.id;

                        return (
                            <motion.div
                                key={lesson.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="ap-relative ap-flex ap-items-start ap-gap-4"
                            >
                                {/* Node circle */}
                                <motion.button
                                    className={`ap-relative ap-z-10 ap-w-12 ap-h-12 ap-rounded-full ${colors.bg} ap-text-white ap-flex ap-items-center ap-justify-center ap-shadow-md ${!lesson.isLocked ? 'ap-cursor-pointer' : 'ap-cursor-not-allowed'} ${isActive ? 'ap-ring-4 ' + colors.ring : ''} `}
                                    whileHover={!lesson.isLocked ? { scale: 1.1 } : {}}
                                    whileTap={!lesson.isLocked ? { scale: 0.95 } : {}}
                                    onClick={() => !lesson.isLocked && onLessonSelect(lesson)}
                                    onMouseEnter={() => setHoveredNode(lesson.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    disabled={lesson.isLocked}
                                    aria-label={`${lesson.title} - ${lesson.progress.status}`}
                                >
                                    {getNodeIcon(lesson)}
                                    
                                    {/* Bite-sized indicator */}
                                    {lesson.is_bite_sized && !lesson.isLocked && (
                                        <div className="ap-absolute -ap-top-1 -ap-right-1 ap-w-5 ap-h-5 ap-bg-purple-500 ap-rounded-full ap-flex ap-items-center ap-justify-center">
                                            <HiOutlineSquares2X2 className="ap-w-3 ap-h-3 ap-text-white" />
                                        </div>
                                    )}
                                </motion.button>

                                {/* Lesson info card */}
                                <motion.div
                                    className={`ap-flex-1 ap-p-4 ap-rounded-lg ap-border ap-transition-colors ${
                                        isActive
                                            ? 'ap-bg-blue-50 ap-border-blue-200'
                                            : isHovered && !lesson.isLocked
                                            ? 'ap-bg-gray-50 ap-border-gray-300' : 'ap-bg-white ap-border-gray-200'
                                    } ${!lesson.isLocked ? 'ap-cursor-pointer' : 'ap-opacity-60'}`}
                                    onClick={() => !lesson.isLocked && onLessonSelect(lesson)}
                                >
                                    <div className="ap-flex ap-items-start ap-justify-between">
                                        <div>
                                            <h3 className={`ap-font-medium ${colors.text}`}>
                                                {lesson.title}
                                            </h3>
                                            <div className="ap-flex ap-items-center ap-gap-2 ap-mt-1">
                                                <span className={`ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${
                                                    lesson.progress.status === 'completed'
                                                        ? 'ap-bg-green-100 ap-text-green-700'
                                                        : lesson.progress.status === 'in-progress'
                                                        ? 'ap-bg-blue-100 ap-text-blue-700' : 'ap-bg-gray-100 ap-text-gray-600'
                                                }`}>
                                                    {lesson.isLocked
                                                        ? 'Locked'
                                                        : lesson.progress.status === 'completed'
                                                        ? 'Completed'
                                                        : lesson.progress.status === 'in-progress'
                                                        ? 'In Progress' : 'Not Started'
                                                    }
                                                </span>
                                                {lesson.is_bite_sized && (
                                                    <span className="ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ap-bg-purple-100 ap-text-purple-700">
                                                        Visual Lesson
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score badge */}
                                        {lesson.progress.status === 'completed' && lesson.progress.score > 0 && (
                                            <div className="ap-text-right">
                                                <div className="ap-text-lg ap-font-bold ap-text-green-600">
                                                    {lesson.progress.score}%
                                                </div>
                                                <div className="ap-text-xs ap-text-gray-500">Score</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Last viewed info */}
                                    {lesson.progress.last_viewed && (
                                        <p className="ap-text-xs ap-text-gray-400 ap-mt-2">
                                            Last viewed: {formatLocalDate(lesson.progress.last_viewed)}
                                        </p>
                                    )}
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Empty state */}
            {lessons.length === 0 && (
                <div className="ap-text-center ap-py-12 ap-text-gray-500">
                    <HiOutlineSquares2X2 className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-4 ap-opacity-50" />
                    <p className="ap-text-lg ap-font-medium">No lessons available</p>
                    <p className="ap-text-sm">Check back later for course content.</p>
                </div>
            )}
        </div>
    );
};

export default VisualNavigator;
