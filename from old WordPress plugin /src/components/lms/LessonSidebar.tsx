import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { 
    HiOutlineChevronRight, HiOutlineCheckCircle, HiOutlineLockClosed,
    HiOutlinePlay, HiOutlineChevronDown, HiOutlineXMark, HiOutlineBars3BottomLeft
} from 'react-icons/hi2';
import { Lesson, LessonSection, ProgressRecord } from '../../services/api-lms';

interface LessonSidebarProps {
    courseTitle: string;
    lessons: Lesson[];
    sections: LessonSection[];
    progress: Map<number, ProgressRecord>;
    currentLessonId: number | null;
    sequential: boolean;
    onSelectLesson: (lesson: Lesson) => void;
    onClose?: () => void;
    isOpen?: boolean;
}

const LessonSidebar: React.FC<LessonSidebarProps> = ({
    courseTitle,
    lessons,
    sections,
    progress,
    currentLessonId,
    sequential,
    onSelectLesson,
    onClose,
    isOpen = true,
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set(sections.map(s => s.id)));

    const toggleSection = (sectionId: number) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const getLessonStatus = (lesson: Lesson): 'completed' | 'in-progress' | 'locked' | 'available' => {
        const prog = progress.get(lesson.id);
        if (prog?.status === 'completed') return 'completed';
        if (prog?.status === 'in-progress') return 'in-progress';
        
        if (sequential) {
            const lessonIndex = lessons.findIndex(l => l.id === lesson.id);
            if (lessonIndex > 0) {
                const prevLesson = lessons[lessonIndex - 1];
                const prevProg = progress.get(prevLesson.id);
                if (prevProg?.status !== 'completed') return 'locked';
            }
        }
        
        return 'available';
    };

    const getStatusIcon = (status: 'completed' | 'in-progress' | 'locked' | 'available', isCurrent: boolean) => {
        if (isCurrent) {
            return <HiOutlinePlay className="ap-w-4 ap-h-4 ap-text-blue-600" />;
        }
        switch (status) {
            case 'completed':
                return <HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-text-green-500" />;
            case 'in-progress':
                return <HiOutlinePlay className="ap-w-4 ap-h-4 ap-text-blue-500" />;
            case 'locked':
                return <HiOutlineLockClosed className="ap-w-4 ap-h-4 ap-text-gray-400" />;
            default:
                return <div className="ap-w-4 ap-h-4 ap-rounded-full ap-border-2 ap-border-gray-300" />;
        }
    };

    // Group lessons by section
    const getLessonsForSection = (sectionId: number | null) => {
        return lessons.filter(l => l.sectionId === sectionId);
    };

    const unsectionedLessons = getLessonsForSection(null);

    // Calculate progress stats
    const completedCount = [...progress.values()].filter(p => p.status === 'completed').length;
    const overallProgress = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    const renderLesson = (lesson: Lesson, index: number) => {
        const status = getLessonStatus(lesson);
        const isLocked = status === 'locked';
        const isCurrent = lesson.id === currentLessonId;

        return (
            <Button
                key={lesson.id}
                onClick={() => !isLocked && onSelectLesson(lesson)}
                disabled={isLocked}
                variant="ghost"
                className={`!ap-w-full !ap-text-left !ap-px-3 !ap-py-2 !ap-rounded-lg !ap-flex !ap-items-center !ap-gap-3 !ap-justify-start ${
                    isCurrent 
                        ? '!ap-bg-blue-50 !ap-border !ap-border-blue-200' 
                        : isLocked 
                            ? '!ap-opacity-50 !ap-cursor-not-allowed' : 'hover:!ap-bg-gray-50'
                }`}
            >
                <span className="ap-flex-shrink-0 ap-w-5 ap-h-5 ap-flex ap-items-center ap-justify-center ap-text-xs ap-font-medium ap-text-gray-500">
                    {index + 1}
                </span>
                {getStatusIcon(status, isCurrent)}
                <span className={`ap-flex-1 ap-text-sm ap-truncate ${isCurrent ? 'ap-font-medium ap-text-blue-700' : 'ap-text-gray-700'}`}>
                    {lesson.title}
                </span>
                {!isLocked && !isCurrent && (
                    <HiOutlineChevronRight className="ap-w-4 ap-h-4 ap-text-gray-400 ap-opacity-0 group-hover:ap-opacity-100" />
                )}
            </Button>
        );
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="ap-h-full ap-flex ap-flex-col ap-bg-white ap-border-r ap-border-gray-200 ap-w-72">
            {/* Header */}
            <div className="ap-p-4 ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                    <h3 className="ap-font-semibold ap-text-gray-900 ap-truncate">{courseTitle}</h3>
                    {onClose && (
                        <Button
                            onClick={onClose}
                            variant="icon"
                            className="lg:ap-hidden"
                        >
                            <HiOutlineXMark className="ap-w-5 ap-h-5 ap-text-gray-500" />
                        </Button>
                    )}
                </div>
                {/* Progress bar */}
                <div className="ap-space-y-1">
                    <div className="ap-flex ap-justify-between ap-text-xs ap-text-gray-500">
                        <span>{completedCount} of {lessons.length} complete</span>
                        <span>{overallProgress}%</span>
                    </div>
                    <div className="ap-h-2 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden">
                        <div
                            className="ap-h-full ap-bg-green-500 ap-rounded-full ap-transition-all ap-duration-500"
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Lesson List */}
            <div className="ap-flex-1 ap-overflow-y-auto ap-p-2">
                {/* Sections */}
                {sections.map(section => {
                    const sectionLessons = getLessonsForSection(section.id);
                    if (sectionLessons.length === 0) return null;
                    
                    const isExpanded = expandedSections.has(section.id);
                    const sectionCompletedCount = sectionLessons.filter(l => 
                        progress.get(l.id)?.status === 'completed'
                    ).length;
                    
                    return (
                        <div key={section.id} className="ap-mb-2">
                            <Button
                                onClick={() => toggleSection(section.id)}
                                variant="ghost"
                                className="!ap-w-full !ap-flex !ap-items-center !ap-gap-2 !ap-px-3 !ap-py-2 !ap-text-sm !ap-font-medium !ap-text-gray-700 hover:!ap-bg-gray-50 !ap-rounded-lg !ap-justify-start"
                            >
                                <HiOutlineChevronDown 
                                    className={`ap-w-4 ap-h-4 ap-text-gray-400 ap-transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
                                />
                                <span className="ap-flex-1 ap-text-left ap-truncate">{section.title}</span>
                                <span className="ap-text-xs ap-text-gray-400">
                                    {sectionCompletedCount}/{sectionLessons.length}
                                </span>
                            </Button>
                            {isExpanded && (
                                <div className="ap-ml-2 ap-mt-1 ap-space-y-1">
                                    {sectionLessons.map((lesson, idx) => renderLesson(lesson, idx))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Unsectioned Lessons */}
                {unsectionedLessons.length > 0 && (
                    <div className="ap-space-y-1">
                        {sections.length > 0 && unsectionedLessons.length > 0 && (
                            <div className="ap-px-3 ap-py-2 ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wide">
                                Lessons
                            </div>
                        )}
                        {unsectionedLessons.map((lesson, idx) => renderLesson(lesson, idx))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Mobile toggle button component
export const LessonSidebarToggle: React.FC<{ onClick: () => void; isOpen: boolean }> = ({ onClick, isOpen }) => (
    <Button
        onClick={onClick}
        variant="primary"
        className="!ap-fixed !ap-bottom-4 !ap-left-4 !ap-z-40 !ap-p-3 !ap-rounded-full !ap-shadow-lg lg:!ap-hidden"
        aria-label={isOpen ? 'Close course ap-outline' : 'Open course ap-outline'}
    >
        {isOpen ? (
            <HiOutlineXMark className="ap-w-6 ap-h-6" />
        ) : (
            <HiOutlineBars3BottomLeft className="ap-w-6 ap-h-6" />
        )}
    </Button>
);

export default LessonSidebar;
