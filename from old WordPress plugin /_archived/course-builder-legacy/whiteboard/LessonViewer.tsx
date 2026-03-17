/**
 * Lesson Viewer Component
 * 
 * The main container that combines whiteboard sections, quizzes, and progress tracking
 * into a cohesive lesson experience. Handles navigation between sections and tracks user progress.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineArrowLeft,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlinePencilSquare,
    HiOutlineEye,
    HiOutlineCheckCircle,
    HiOutlineLockClosed,
    HiOutlinePlayCircle,
    HiOutlineDocumentText,
    HiOutlineClipboardDocumentCheck,
    HiOutlinePresentationChartBar,
    HiOutlineAcademicCap,
} from 'react-icons/hi2';
import WhiteboardPresentation from './WhiteboardPresentation';
import QuizSection from './QuizSection';
import { useLessonProgress } from './hooks/useLessonProgress';
import type {
    LessonWithSections,
    LessonSection,
    QuizResult,
    WhiteboardSlide,
} from './types';

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
    sections: LessonSection[];
    currentIndex: number;
    onNavigate: (index: number) => void;
    canNavigate: (index: number) => boolean;
}

const SectionProgressBar: React.FC<ProgressBarProps> = ({
    sections,
    currentIndex,
    onNavigate,
    canNavigate,
}) => {
    const getSectionIcon = (section: LessonSection) => {
        switch (section.section_type) {
            case 'whiteboard':
                return HiOutlinePresentationChartBar;
            case 'quiz':
                return HiOutlineClipboardDocumentCheck;
            case 'video':
                return HiOutlinePlayCircle;
            case 'text':
                return HiOutlineDocumentText;
            default:
                return HiOutlineDocumentText;
        }
    };
    
    const getSectionStatus = (section: LessonSection, index: number) => {
        const progress = section.user_progress;
        if (!progress || progress.status === 'not_started') {
            if (!canNavigate(index)) return 'locked';
            return 'not_started';
        }
        return progress.status;
    };
    
    return (
        <div className="flex items-center justify-center gap-1 py-4 px-6 bg-white border-b">
            {sections.map((section, index) => {
                const Icon = getSectionIcon(section);
                const status = getSectionStatus(section, index);
                const isCurrent = index === currentIndex;
                const canClick = canNavigate(index);
                
                return (
                    <React.Fragment key={section.id}>
                        {/* Connector line */}
                        {index > 0 && (
                            <div
                                className={`h-0.5 w-8 transition-colors ${
                                    status === 'completed' || (sections[index - 1]?.user_progress?.status === 'completed')
                                        ? 'bg-green-400'
                                        : 'bg-gray-200'
                                }`}
                            />
                        )}
                        
                        {/* Section indicator */}
                        <button
                            onClick={() => canClick && onNavigate(index)}
                            disabled={!canClick}
                            className={`relative group flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                                status === 'locked'
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : status === 'completed'
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : isCurrent
                                            ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={section.title}
                        >
                            {status === 'locked' ? (
                                <HiOutlineLockClosed className="w-4 h-4" />
                            ) : status === 'completed' ? (
                                <HiOutlineCheckCircle className="w-5 h-5" />
                            ) : (
                                <Icon className="w-5 h-5" />
                            )}
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                {section.title}
                            </div>
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ============================================================================
// SECTION NAVIGATION COMPONENT
// ============================================================================

interface SectionNavigationProps {
    currentIndex: number;
    totalSections: number;
    currentSection: LessonSection;
    onPrevious: () => void;
    onNext: () => void;
    onComplete: () => void;
    canGoNext: boolean;
    canGoPrevious: boolean;
    isCompleted: boolean;
}

const SectionNavigation: React.FC<SectionNavigationProps> = ({
    currentIndex,
    totalSections,
    currentSection,
    onPrevious,
    onNext,
    onComplete,
    canGoNext,
    canGoPrevious,
    isCompleted,
}) => {
    const isLastSection = currentIndex === totalSections - 1;
    const isQuiz = currentSection.section_type === 'quiz';
    
    return (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
            {/* Previous button */}
            <button
                onClick={onPrevious}
                disabled={!canGoPrevious}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    canGoPrevious
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-300 cursor-not-allowed'
                }`}
            >
                <HiOutlineChevronLeft className="w-5 h-5" />
                Previous
            </button>
            
            {/* Section info */}
            <div className="text-center">
                <span className="text-sm text-gray-500">
                    Section {currentIndex + 1} of {totalSections}
                </span>
            </div>
            
            {/* Next/Complete button */}
            {isLastSection ? (
                <button
                    onClick={onComplete}
                    disabled={!isCompleted}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                        isCompleted
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    <HiOutlineAcademicCap className="w-5 h-5" />
                    Complete Lesson
                </button>
            ) : !isQuiz ? (
                <button
                    onClick={onNext}
                    disabled={!canGoNext}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                        canGoNext
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    {currentSection.user_progress?.status === 'completed' ? 'Next' : 'Mark Complete & Continue'}
                    <HiOutlineChevronRight className="w-5 h-5" />
                </button>
            ) : (
                <div className="text-sm text-gray-500 italic">
                    Complete the quiz to continue
                </div>
            )}
        </div>
    );
};

// ============================================================================
// SECTION CONTENT COMPONENTS
// ============================================================================

interface WhiteboardSectionProps {
    section: LessonSection;
    isEditMode: boolean;
    onSave: (slides: WhiteboardSlide[]) => Promise<void>;
}

const WhiteboardSectionContent: React.FC<WhiteboardSectionProps> = ({
    section,
    isEditMode,
    onSave,
}) => {
    // Convert legacy single-page whiteboard to slides format
    const initialSlides: WhiteboardSlide[] = section.whiteboard?.slides || 
        (section.whiteboard?.data ? [{
            id: `slide-${section.id}-1`,
            title: 'Slide 1',
            data: section.whiteboard.data,
            thumbnailUrl: section.whiteboard.thumbnail_url,
        }] : [{
            id: `slide-${section.id}-1`,
            title: 'Slide 1',
            data: { elements: [] },
        }]);
    
    return (
        <div className="h-full">
            <WhiteboardPresentation
                slides={initialSlides}
                readOnly={!isEditMode}
                onSave={onSave}
                className="h-full"
            />
        </div>
    );
};

interface VideoSectionProps {
    section: LessonSection;
}

const VideoSectionContent: React.FC<VideoSectionProps> = ({ section }) => {
    const videoUrl = section.video_url || '';
    
    // Extract YouTube/Vimeo embed URL
    const getEmbedUrl = (url: string) => {
        const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
        if (youtubeMatch) {
            return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        return url;
    };
    
    return (
        <div className="flex items-center justify-center h-full p-8">
            <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-lg">
                <iframe
                    src={getEmbedUrl(videoUrl)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        </div>
    );
};

interface TextSectionProps {
    section: LessonSection;
}

const TextSectionContent: React.FC<TextSectionProps> = ({ section }) => {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: section.text_content || '' }}
            />
        </div>
    );
};

// ============================================================================
// MAIN LESSON VIEWER COMPONENT
// ============================================================================

interface LessonViewerProps {
    lesson: LessonWithSections;
    onBack: () => void;
    canEdit?: boolean;
}

const LessonViewer: React.FC<LessonViewerProps> = ({
    lesson,
    onBack,
    canEdit = false,
}) => {
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    
    const {
        isLoading,
        markSectionComplete,
        updateProgress,
        saveWhiteboardSlides,
    } = useLessonProgress(lesson.id);
    
    const sections = lesson.sections || [];
    const currentSection = sections[currentSectionIndex];
    
    // Determine if user can navigate to a section
    const canNavigateToSection = useCallback((index: number) => {
        if (index === 0) return true;
        if (canEdit) return true; // Editors can navigate anywhere
        
        const section = sections[index];
        if (!section) return false;
        
        // Check if required previous section is completed
        if (section.requires_section_id) {
            const requiredSection = sections.find(s => s.id === section.requires_section_id);
            if (requiredSection?.user_progress?.status !== 'completed') {
                return false;
            }
        }
        
        // By default, require previous section to be completed
        const prevSection = sections[index - 1];
        if (prevSection?.is_required && prevSection?.user_progress?.status !== 'completed') {
            return false;
        }
        
        return true;
    }, [sections, canEdit]);
    
    // Check if current section is completed
    const isCurrentSectionCompleted = currentSection?.user_progress?.status === 'completed';
    
    // Handle section navigation
    const handleNavigate = (index: number) => {
        if (canNavigateToSection(index)) {
            setCurrentSectionIndex(index);
            updateProgress({ current_section_id: sections[index].id });
        }
    };
    
    const handlePrevious = () => {
        if (currentSectionIndex > 0) {
            handleNavigate(currentSectionIndex - 1);
        }
    };
    
    const handleNext = async () => {
        // Mark current section as complete if not already
        if (!isCurrentSectionCompleted && currentSection.section_type !== 'quiz') {
            await markSectionComplete(currentSection.id);
        }
        
        if (currentSectionIndex < sections.length - 1) {
            handleNavigate(currentSectionIndex + 1);
        }
    };
    
    // Handle quiz completion
    const handleQuizComplete = async (result: QuizResult) => {
        if (result.passed) {
            await markSectionComplete(currentSection.id);
            // Auto-advance if not last section
            if (currentSectionIndex < sections.length - 1) {
                setTimeout(() => {
                    handleNavigate(currentSectionIndex + 1);
                }, 2000);
            }
        }
    };
    
    // Handle whiteboard slides save
    const handleWhiteboardSlidesSave = async (slides: WhiteboardSlide[]) => {
        await saveWhiteboardSlides(currentSection.id, slides);
    };
    
    // Handle lesson completion
    const handleLessonComplete = () => {
        // Could show a completion modal or navigate back
        onBack();
    };
    
    // Calculate overall progress
    const completedSections = sections.filter(s => s.user_progress?.status === 'completed').length;
    const progressPercentage = sections.length > 0 ? (completedSections / sections.length) * 100 : 0;
    
    // Render section content based on type
    const renderSectionContent = () => {
        if (!currentSection) return null;
        
        switch (currentSection.section_type) {
            case 'whiteboard':
                return (
                    <WhiteboardSectionContent
                        section={currentSection}
                        isEditMode={isEditMode}
                        onSave={handleWhiteboardSlidesSave}
                    />
                );
            case 'quiz':
                return (
                    <QuizSection
                        quiz={currentSection.quiz!}
                        onComplete={handleQuizComplete}
                        readOnly={false}
                    />
                );
            case 'video':
                return <VideoSectionContent section={currentSection} />;
            case 'text':
                return <TextSectionContent section={currentSection} />;
            default:
                return <div>Unknown section type</div>;
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <HiOutlineArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">{lesson.title}</h1>
                        <p className="text-sm text-gray-500">
                            {completedSections} of {sections.length} sections completed
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Progress indicator */}
                    <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-green-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                            {progressPercentage.toFixed(0)}%
                        </span>
                    </div>
                    
                    {/* Edit mode toggle (only for editors) */}
                    {canEdit && currentSection?.section_type === 'whiteboard' && (
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                isEditMode
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {isEditMode ? (
                                <>
                                    <HiOutlineEye className="w-5 h-5" />
                                    View Mode
                                </>
                            ) : (
                                <>
                                    <HiOutlinePencilSquare className="w-5 h-5" />
                                    Edit Mode
                                </>
                            )}
                        </button>
                    )}
                </div>
            </header>
            
            {/* Section progress bar */}
            <SectionProgressBar
                sections={sections}
                currentIndex={currentSectionIndex}
                onNavigate={handleNavigate}
                canNavigate={canNavigateToSection}
            />
            
            {/* Section title */}
            <div className="px-6 py-3 bg-white border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                    {currentSection?.title}
                </h2>
                {currentSection?.description && (
                    <p className="text-gray-600 mt-1">{currentSection.description}</p>
                )}
            </div>
            
            {/* Content area */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSection?.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-full"
                    >
                        {renderSectionContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {/* Navigation footer */}
            <SectionNavigation
                currentIndex={currentSectionIndex}
                totalSections={sections.length}
                currentSection={currentSection}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onComplete={handleLessonComplete}
                canGoNext={canNavigateToSection(currentSectionIndex + 1) || currentSection?.section_type !== 'quiz'}
                canGoPrevious={currentSectionIndex > 0}
                isCompleted={completedSections === sections.length}
            />
        </div>
    );
};

export default LessonViewer;
