import React, { useState, useEffect, useRef } from 'react';
import { parseLocalDate } from '../../utils/dateUtils';
import { 
    HiOutlineChevronRight, HiOutlineChevronLeft, HiOutlineChevronDown, HiOutlinePlay, HiOutlineCheckCircle, HiOutlineLockClosed, HiOutlineClock, HiOutlinePencilSquare, HiOutlineBars3BottomLeft, HiOutlineAcademicCap, HiOutlineArrowsPointingOut, HiOutlineArrowsPointingIn, HiOutlineListBullet
} from 'react-icons/hi2';
import { Button } from '../ui';
import { Course, Lesson, lmsApi, ProgressRecord, LessonSection } from '../../services/api-lms';
import { generateCertificate } from '../../utils/certificateGenerator';
import ExcalidrawPresentation from './ExcalidrawPresentation';
import BlockEditor from '../BlockEditor';
import HybridLessonEditor from './HybridLessonEditor';
import LessonSidebar from './LessonSidebar';
import FocusReader from './FocusReader';
import QuizPlayer from './QuizPlayer';
import ErrorBoundary, { logCrash } from '../ErrorBoundary';

interface LMSPermissions {
    canViewCourses: boolean;
    canViewLessons: boolean;
    canCreateCourses: boolean;
    canEditCourses: boolean;
    canDeleteCourses: boolean;
    canCreateLessons: boolean;
    canEditLessons: boolean;
    canDeleteLessons: boolean;
    canManageExcalidraw: boolean;
    canModerateAll: boolean;
}

interface CourseViewerProps {
    course: Course;
    permissions: LMSPermissions;
    onEditLesson?: (lesson: Lesson) => void;
    onEditCourse?: () => void;
    onBack: () => void;
    isFocusMode?: boolean;
    onFocusModeChange?: (focusMode: boolean) => void;
    /** When provided, auto-open this lesson after loading */
    initialLessonId?: number;
}

type ViewMode = 'list' | 'lesson';

const CourseViewer: React.FC<CourseViewerProps> = ({
    course,
    permissions,
    onEditLesson,
    onEditCourse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onBack: _onBack,
    isFocusMode = false,
    onFocusModeChange,
    initialLessonId,
}) => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [sections, setSections] = useState<LessonSection[]>([]);
    const [progress, setProgress] = useState<Map<number, ProgressRecord>>(new Map());
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [loading, setLoading] = useState(true);
    
    // Automatically exit focus mode when going back to list view
    useEffect(() => {
        if (viewMode === 'list' && isFocusMode) {
            onFocusModeChange?.(false);
        }
    }, [viewMode, isFocusMode, onFocusModeChange]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isTextFocusMode, setIsTextFocusMode] = useState(false);
    const [isLessonReady, setIsLessonReady] = useState(false);
    const [focusNavOpen, setFocusNavOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const focusNavRef = useRef<HTMLDivElement>(null);

    const canEdit = permissions.canEditLessons || permissions.canModerateAll;
    const lessonContentRef = useRef<HTMLDivElement>(null);

    // After lesson content renders, upgrade any PDF links to inline iframe embeds.
    // Covers both BlockNote file blocks and plain <a href="*.pdf"> links in raw HTML.
    useEffect(() => {
        if (!selectedLesson) return;
        const timer = setTimeout(() => {
            const container = lessonContentRef.current;
            if (!container) return;

            const upgradeLinkToPdfEmbed = (href: string, label: string, replaceTarget: Element) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'mp-pdf-embed-wrapper';
                wrapper.style.cssText = 'margin: 1.5rem 0;';

                const iframe = document.createElement('iframe');
                iframe.src = href;
                iframe.title = label || 'PDF Document';
                iframe.style.cssText = [
                    'width: 100%;',
                    'height: 700px;',
                    'border: 1px solid #e5e7eb;',
                    'border-radius: 8px;',
                    'display: block;',
                    'background: #f9fafb;',
                ].join(' ');
                iframe.setAttribute('loading', 'lazy');

                const fallback = document.createElement('a');
                fallback.href = href;
                fallback.target = '_blank';
                fallback.rel = 'noopener noreferrer';
                fallback.style.cssText = 'display: block; margin-top: 0.375rem; font-size: 0.75rem; color: #6b7280; text-align: center;';
                fallback.textContent = '\u2197 Open PDF in new tab';

                wrapper.appendChild(iframe);
                wrapper.appendChild(fallback);
                replaceTarget.parentNode?.replaceChild(wrapper, replaceTarget);
            };

            // 1. BlockNote file blocks — rendered as a styled container with an inner link
            container.querySelectorAll<Element>('[data-content-type="file"], .bn-file-block, [class*="fileBlock"]').forEach(block => {
                if (block.closest('.mp-pdf-embed-wrapper')) return;
                const inner = block.querySelector<HTMLAnchorElement>('a[href]');
                if (!inner || !inner.href.match(/\.pdf(\?.*)?$/i)) return;
                upgradeLinkToPdfEmbed(inner.href, inner.textContent?.trim() || '', block);
            });

            // 2. Plain anchor tags pointing to .pdf files (raw HTML path)
            container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
                if (link.closest('.mp-pdf-embed-wrapper')) return;
                if (!link.href.match(/\.pdf(\?.*)?$/i)) return;
                upgradeLinkToPdfEmbed(link.href, link.textContent?.trim() || '', link);
            });
        }, 400); // wait for BlockNote to finish rendering its blocks
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLesson?.id]);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (focusNavRef.current && !focusNavRef.current.contains(event.target as Node)) {
                setFocusNavOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDownloadCertificate = () => {
        if (!window.mentorshipPlatformData?.current_user) return;
        
        const currentUser = window.mentorshipPlatformData.current_user;
        const userName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'User';
        const siteName = window.mentorshipPlatformData.site_name || 'AquaticPro';
        // Get the latest completion date
        let latestDate = new Date().toLocaleDateString();
        
        // Try to find the actual latest completion date from lessons
        const completedDates = Array.from(progress.values())
            .filter(p => p.status === 'completed' && p.completedAt)
            .map(p => parseLocalDate(p.completedAt!));
            
        if (completedDates.length > 0) {
            // Sort descending to get latest
            completedDates.sort((a, b) => b.getTime() - a.getTime());
            latestDate = completedDates[0].toLocaleDateString();
        }

        generateCertificate(userName, course.title, latestDate, siteName);
    };

    useEffect(() => {
        loadCourseData();
    }, [course.id]);

    const loadCourseData = async () => {
        try {
            setLoading(true);
            const [lessonsData, progressData, sectionsData] = await Promise.all([
                lmsApi.getCourseLessons(course.id),
                lmsApi.getProgress(),
                lmsApi.getCourseSections(course.id)
            ]);
            setLessons(lessonsData);
            setSections(sectionsData);
            
            // Build progress map
            const progressMap = new Map<number, ProgressRecord>();
            progressData.forEach((p: ProgressRecord) => {
                if (lessonsData.some((l: Lesson) => l.id === p.lessonId)) {
                    progressMap.set(p.lessonId, p);
                }
            });
            setProgress(progressMap);

            // If an initial lesson was requested, auto-open it
            if (initialLessonId) {
                const target = lessonsData.find((l: Lesson) => l.id === initialLessonId);
                if (target) {
                    setSelectedLesson(target);
                    setViewMode('lesson');

                    // Fetch full lesson details (Excalidraw JSON etc.)
                    try {
                        const fullLesson = await lmsApi.getLesson(target.id);
                        setSelectedLesson(fullLesson);
                    } catch {
                        // partial data is fine
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load course data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLessonStatus = (lesson: Lesson): 'completed' | 'in-progress' | 'locked' | 'available' => {
        const prog = progress.get(lesson.id);
        if (prog?.status === 'completed') return 'completed';
        if (prog?.status === 'in-progress') return 'in-progress';
        
        // Check if previous lesson is completed (for sequential courses)
        const lessonIndex = lessons.findIndex(l => l.id === lesson.id);
        if (lessonIndex > 0 && course.sequential) {
            const prevLesson = lessons[lessonIndex - 1];
            const prevProg = progress.get(prevLesson.id);
            if (prevProg?.status !== 'completed') return 'locked';
        }
        
        return 'available';
    };

    const getStatusIcon = (status: 'completed' | 'in-progress' | 'locked' | 'available') => {
        switch (status) {
            case 'completed':
                return <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-500" />;
            case 'in-progress':
                return <HiOutlinePlay className="ap-w-5 ap-h-5 ap-text-blue-500" />;
            case 'locked':
                return <HiOutlineLockClosed className="ap-w-5 ap-h-5 ap-text-gray-400" />;
            default:
                return <div className="ap-w-5 ap-h-5 ap-rounded-full ap-border-2 ap-border-gray-300" />;
        }
    };

    const handleLessonClick = async (lesson: Lesson) => {
        const status = getLessonStatus(lesson);
        if (status === 'locked') return;
        
        setIsLessonReady(false);
        
        // Temporarily select the "lite" lesson so UI responds immediately
        setSelectedLesson(lesson);
        setViewMode('lesson');
        
        // Auto-enable focus mode on mobile for better experience
        if (isMobile && onFocusModeChange && !isFocusMode) {
            onFocusModeChange(true);
        }
        
        // Fetch FULL lesson details (including large Excalidraw JSON which list view omits)
        try {
            const fullLesson = await lmsApi.getLesson(lesson.id);
            setSelectedLesson(fullLesson);
        } catch (e) {
            console.error('Failed to fetch full lesson details:', e);
            // We already have partial data, so we can stay on the page, 
            // but might lack content/excalidraw data.
        }
        
        // Start tracking progress
        if (!progress.has(lesson.id)) {
            await lmsApi.updateProgress(lesson.id, 'in-progress');
            const newProgress = new Map(progress);
            newProgress.set(lesson.id, {
                id: 0,
                lessonId: lesson.id,
                status: 'in-progress',
                score: 0,
                timeSpent: 0,
            });
            setProgress(newProgress);
        }
    };

    // Focus mode navigation helpers
    const currentLessonIndex = selectedLesson ? lessons.findIndex(l => l.id === selectedLesson.id) : -1;
    const canGoPrev = currentLessonIndex > 0;
    const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < lessons.length - 1 
        ? lessons[currentLessonIndex + 1] 
        : null;
    const canGoNext = nextLesson && getLessonStatus(nextLesson) !== 'locked';
    
    const goToPrevLesson = () => {
        if (canGoPrev) {
            handleLessonClick(lessons[currentLessonIndex - 1]);
            setFocusNavOpen(false);
        }
    };
    
    const goToNextLesson = () => {
        if (canGoNext && nextLesson) {
            handleLessonClick(nextLesson);
            setFocusNavOpen(false);
        }
    };

    const handleLessonComplete = async () => {
        if (!selectedLesson) return;
        
        await lmsApi.updateProgress(selectedLesson.id, 'completed', 100);
        const newProgress = new Map(progress);
        newProgress.set(selectedLesson.id, {
            ...progress.get(selectedLesson.id)!,
            status: 'completed',
            score: 100
        });
        setProgress(newProgress);
        
        // Move to next lesson or back to list
        const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
        if (currentIndex < lessons.length - 1) {
            const nextLesson = lessons[currentIndex + 1];
            if (getLessonStatus(nextLesson) !== 'locked') {
                setSelectedLesson(nextLesson);
            } else {
                setViewMode('list');
                setSelectedLesson(null);
            }
        } else {
            setViewMode('list');
            setSelectedLesson(null);
        }
    };

    const handleQuizComplete = async (score: number, passed: boolean) => {
        if (!selectedLesson) return;

        const status = passed ? 'completed' : 'in-progress';
        
        await lmsApi.updateProgress(selectedLesson.id, status, score);
        const newProgress = new Map(progress);
        newProgress.set(selectedLesson.id, {
            ...progress.get(selectedLesson.id)!,
            status: status,
            score: score
        });
        setProgress(newProgress);

        if (passed) {
             // Move to next lesson (reuse logic, effectively)
            const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
            if (currentIndex < lessons.length - 1) {
                const nextLesson = lessons[currentIndex + 1];
                if (getLessonStatus(nextLesson) !== 'locked') {
                    setSelectedLesson(nextLesson);
                } else {
                    setViewMode('list');
                    setSelectedLesson(null);
                }
            } else {
                setViewMode('list');
                setSelectedLesson(null);
            }
        }
    };

    // Calculate overall progress
    const completedCount = [...progress.values()].filter(p => p.status === 'completed').length;
    const overallProgress = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <div className="ap-text-center">
                    <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600 ap-mx-auto"></div>
                    <p className="ap-mt-4 ap-text-gray-500">Loading course...</p>
                </div>
            </div>
        );
    }

    // Lesson View Mode
    if (viewMode === 'lesson' && selectedLesson) {
        return (
            <div className={`ap-flex ${isFocusMode ? 'ap-h-screen' : 'ap-h-[calc(100vh-4rem)]'}`}>
                {/* Course Outline Sidebar - hidden in focus mode */}
                {!isFocusMode && (
                    <div className={`ap-hidden lg:ap-block ${sidebarOpen ? '' : 'lg:hidden'}`}>
                        <LessonSidebar
                            courseTitle={course.title}
                            lessons={lessons}
                            sections={sections}
                            progress={progress}
                            currentLessonId={selectedLesson.id}
                            sequential={course.sequential ?? false}
                            onSelectLesson={handleLessonClick}
                            isOpen={sidebarOpen}
                        />
                    </div>
                )}

                {/* Mobile Sidebar Overlay - hidden in focus mode */}
                {!isFocusMode && sidebarOpen && (
                    <div 
                        className="ap-fixed ap-inset-0 ap-z-30 lg:ap-hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <div className="ap-absolute ap-inset-0 ap-bg-black/20" />
                        <div 
                            className="ap-absolute ap-left-0 ap-top-0 ap-h-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <LessonSidebar
                                courseTitle={course.title}
                                lessons={lessons}
                                sections={sections}
                                progress={progress}
                                currentLessonId={selectedLesson.id}
                                sequential={course.sequential ?? false}
                                onSelectLesson={(lesson) => {
                                    handleLessonClick(lesson);
                                    setSidebarOpen(false);
                                }}
                                onClose={() => setSidebarOpen(false)}
                                isOpen={true}
                            />
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="ap-flex-1 ap-flex ap-flex-col ap-overflow-hidden">
                    {/* Lesson Header */}
                    <div className={`ap-bg-white ap-border-b ap-border-gray-200 ap-flex-shrink-0 ${isFocusMode ? 'ap-p-2 sm:ap-p-3' : 'ap-p-2 md:ap-p-4'}`}>
                        <div className="ap-flex ap-items-center ap-justify-between">
                            <div className="ap-flex ap-items-center ap-gap-2 sm:ap-gap-3">
                                {/* Return to Courses button - always visible in focus mode */}
                                {isFocusMode && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            onFocusModeChange?.(false);
                                            setViewMode('list');
                                            setSelectedLesson(null);
                                        }}
                                        className="!ap-gap-1.5"
                                        title="Exit Focus Mode"
                                    >
                                        <HiOutlineArrowsPointingIn className="ap-w-4 ap-h-4" />
                                        <span className="ap-hidden sm:ap-inline">Exit Focus</span>
                                    </Button>
                                )}
                                
                                {/* Focus Mode Course Navigation */}
                                {isFocusMode && (
                                    <div className="ap-flex ap-items-center ap-gap-1 sm:ap-gap-2">
                                        {/* Previous Lesson */}
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={goToPrevLesson}
                                            disabled={!canGoPrev}
                                            className="!ap-p-1.5 sm:!ap-p-2 !ap-min-h-0"
                                            title="Previous Lesson"
                                        >
                                            <HiOutlineChevronLeft className="ap-w-5 ap-h-5 ap-text-gray-600" />
                                        </Button>
                                        
                                        {/* Course Outline Dropdown */}
                                        <div ref={focusNavRef} className="ap-relative">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFocusNavOpen(!focusNavOpen)}
                                                className="!ap-bg-gray-100 hover:!ap-bg-gray-200 !ap-gap-1.5 !ap-px-2 sm:!ap-px-3"
                                                title="Course Outline"
                                            >
                                                <HiOutlineListBullet className="ap-w-4 ap-h-4 ap-text-gray-600" />
                                                <span className="ap-hidden sm:ap-inline ap-text-gray-700">
                                                    {currentLessonIndex + 1}/{lessons.length}
                                                </span>
                                                <span className="sm:ap-hidden ap-text-gray-700 ap-text-xs">
                                                    {currentLessonIndex + 1}/{lessons.length}
                                                </span>
                                                <HiOutlineChevronDown className={`ap-w-3 ap-h-3 ap-text-gray-500 ap-transition-transform ${focusNavOpen ? 'ap-rotate-180' : ''}`} />
                                            </Button>
                                            
                                            {/* Dropdown Menu */}
                                            {focusNavOpen && (
                                                <div className="ap-absolute ap-top-full ap-left-0 ap-mt-1 ap-w-72 sm:ap-w-80 ap-max-h-[60vh] ap-overflow-y-auto ap-bg-white ap-rounded-lg ap-shadow-lg ap-border ap-border-gray-200 ap-z-50">
                                                    <div className="ap-p-2 ap-border-b ap-border-gray-100 ap-sticky ap-top-0 ap-bg-white">
                                                        <p className="ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wide">{course.title}</p>
                                                    </div>
                                                    <div className="ap-p-1">
                                                        {lessons.map((lesson, idx) => {
                                                            const status = getLessonStatus(lesson);
                                                            const isLocked = status === 'locked';
                                                            const isCurrent = lesson.id === selectedLesson.id;
                                                            return (
                                                                <Button
                                                                    key={lesson.id}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        if (!isLocked) {
                                                                            handleLessonClick(lesson);
                                                                            setFocusNavOpen(false);
                                                                        }
                                                                    }}
                                                                    disabled={isLocked}
                                                                    className={`!ap-w-full !ap-justify-start !ap-gap-3 !ap-px-3 !ap-py-2 !ap-text-left ${
                                                                        isCurrent
                                                                            ? '!ap-bg-blue-50 !ap-text-blue-700'
                                                                            : isLocked
                                                                                ? '!ap-opacity-50 !ap-cursor-not-allowed' : 'hover:!ap-bg-gray-50'
                                                                    }`}
                                                                >
                                                                    <div className="ap-flex-shrink-0">
                                                                        {status === 'completed' ? (
                                                                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-500" />
                                                                        ) : status === 'in-progress' ? (
                                                                            <HiOutlinePlay className="ap-w-5 ap-h-5 ap-text-blue-500" />
                                                                        ) : status === 'locked' ? (
                                                                            <HiOutlineLockClosed className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                                                        ) : (
                                                                            <div className="ap-w-5 ap-h-5 ap-rounded-full ap-border-2 ap-border-gray-300" />
                                                                        )}
                                                                    </div>
                                                                    <div className="ap-flex-1 ap-min-w-0">
                                                                        <p className={`ap-text-sm ap-font-medium ap-truncate ${isCurrent ? 'ap-text-blue-700' : 'ap-text-gray-900'}`}>
                                                                            {idx + 1}. {lesson.title}
                                                                        </p>
                                                                    </div>
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Next Lesson */}
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={goToNextLesson}
                                            disabled={!canGoNext}
                                            className="!ap-p-1.5 sm:!ap-p-2 !ap-min-h-0"
                                            title="Next Lesson"
                                        >
                                            <HiOutlineChevronRight className="ap-w-5 ap-h-5 ap-text-gray-600" />
                                        </Button>
                                    </div>
                                )}
                                
                                {/* Course outline toggle - hidden in focus mode */}
                                {!isFocusMode && (
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="!ap-p-2 !ap-min-h-0"
                                        title={sidebarOpen ? 'Hide course ap-outline' : 'Show course ap-outline'}
                                    >
                                        <HiOutlineBars3BottomLeft className="ap-w-5 ap-h-5 ap-text-gray-600" />
                                    </Button>
                                )}
                                
                                {!isFocusMode && (
                                    <>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            onClick={() => {
                                                setViewMode('list');
                                                setSelectedLesson(null);
                                            }}
                                            className="!ap-p-0 !ap-min-h-0"
                                        >
                                            ← Back to course
                                        </Button>
                                        <span className="ap-text-gray-300 ap-hidden sm:ap-inline">|</span>
                                    </>
                                )}
                                
                                {/* Lesson title - shown after nav in focus mode, inline otherwise */}
                                {!isFocusMode && (
                                    <h2 className="ap-font-semibold ap-text-gray-900">
                                        {selectedLesson.title}
                                    </h2>
                                )}
                            </div>
                            
                            <div className="ap-flex ap-items-center ap-gap-2">
                                {/* Focus Mode Toggle */}
                                {onFocusModeChange && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onFocusModeChange(!isFocusMode)}
                                        className={`!ap-gap-1.5 !ap-px-2 sm:!ap-px-3 ${
                                            isFocusMode 
                                                ? '!ap-text-amber-700 !ap-bg-amber-100 hover:!ap-bg-amber-200' : '!ap-text-gray-600 !ap-bg-gray-100 hover:!ap-bg-gray-200'
                                        }`}
                                        title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
                                    >
                                        {isFocusMode ? (
                                            <>
                                                <HiOutlineArrowsPointingIn className="ap-w-4 ap-h-4" />
                                                <span className="ap-hidden sm:ap-inline">Exit Focus</span>
                                            </>
                                        ) : (
                                            <>
                                                <HiOutlineArrowsPointingOut className="ap-w-4 ap-h-4" />
                                                <span className="ap-hidden sm:ap-inline">Focus Mode</span>
                                            </>
                                        )}
                                    </Button>
                                )}
                                
                                {canEdit && onEditLesson && !isFocusMode && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEditLesson(selectedLesson)}
                                    >
                                        <HiOutlinePencilSquare className="ap-w-4 ap-h-4" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Lesson Content */}
                    <div className="ap-flex-1 ap-overflow-auto">
                        <div className={`ap-bg-white ap-overflow-hidden ${
                            selectedLesson.type === 'hybrid' || selectedLesson.excalidrawJson
                                ? 'ap-h-full' // Full height/width for hybrid and Excalidraw
                                : isFocusMode
                                    ? '' // No margins/padding in focus mode
                                    : 'md:ap-m-4 md:ap-rounded-lg md:ap-border md:ap-border-gray-200 ap-m-0'
                        }`}>
                            <ErrorBoundary 
                                componentName={`LessonViewer (${selectedLesson.type || 'content'})`}
                                onError={(err) => logCrash('CourseViewer.LessonContent', err, { 
                                    lessonId: selectedLesson.id, 
                                    lessonType: selectedLesson.type,
                                    hasContent: !!selectedLesson.content,
                                    hasExcalidraw: !!selectedLesson.excalidrawJson,
                                    contentLength: selectedLesson.content?.length
                                })}
                            >
                            {/* Quiz lesson type - show quiz player */}
                            {selectedLesson.type === 'quiz' ? (
                                <div className="ap-h-full ap-overflow-auto ap-bg-gray-50" key={`viewer-quiz-${selectedLesson.id}`}>
                                    {progress.get(selectedLesson.id)?.status === 'completed' ? (
                                        <div className="ap-max-w-2xl ap-mx-auto ap-p-8 ap-text-center ap-bg-white ap-rounded-lg ap-shadow-sm ap-mt-8">
                                            <div className="ap-w-20 ap-h-20 ap-mx-auto ap-rounded-full ap-bg-green-100 ap-text-green-600 ap-flex ap-items-center ap-justify-center ap-mb-4">
                                                <HiOutlineCheckCircle className="ap-w-10 ap-h-10" />
                                            </div>
                                            
                                            <h2 className="ap-text-3xl ap-font-bold ap-mb-2">Quiz Completed!</h2>
                                            
                                            <div className="ap-text-5xl ap-font-black ap-text-gray-800 ap-mb-6 ap-font-mono">
                                                {Math.round(progress.get(selectedLesson.id)?.score || 0)}%
                                            </div>

                                            <p className="ap-text-gray-600 ap-mb-8">
                                                You have already successfully completed this quiz.<br/>
                                                Retakes are disabled for completed assessments.
                                            </p>

                                            <Button
                                                variant="primary"
                                                size="lg"
                                                onClick={() => {
                                                    const currentIndex = lessons.findIndex(l => l.id === selectedLesson.id);
                                                    if (currentIndex < lessons.length - 1) {
                                                        const nextLesson = lessons[currentIndex + 1];
                                                        setSelectedLesson(nextLesson);
                                                    } else {
                                                        setViewMode('list');
                                                        setSelectedLesson(null);
                                                    }
                                                }}
                                            >
                                                Continue Course <HiOutlineChevronRight className="ap-w-5 ap-h-5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <QuizPlayer
                                            data={selectedLesson.content || '[]'}
                                            onComplete={handleQuizComplete}
                                        />
                                    )}
                                </div>
                            ) : selectedLesson.type === 'hybrid' ? (
                                <div className="ap-h-full ap-flex ap-flex-col" key={`viewer-hybrid-${selectedLesson.id}-${selectedLesson.hybridLayout}`}>
                                    <div className="ap-flex-1 ap-min-h-0">
                                        <HybridLessonEditor
                                            key={`hybrid-editor-${selectedLesson.id}-${selectedLesson.hybridLayout}`}
                                            initialContent={(() => {
                                                try {
                                                    const parsed = JSON.parse(selectedLesson.content || '[]');
                                                    // Must be BlockNote content, not quiz data
                                                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && !parsed[0].question) {
                                                        return parsed;
                                                    }
                                                    return undefined;
                                                } catch {
                                                    return undefined;
                                                }
                                            })()}
                                            initialExcalidraw={selectedLesson.excalidrawJson}
                                            initialCues={selectedLesson.scrollCues || []}
                                            initialSlideOrder={selectedLesson.slideOrder || []}
                                            initialSplitRatio={selectedLesson.splitRatio ?? (selectedLesson as any).hybridSplitRatio ?? 0.4}
                                            layout={selectedLesson.hybridLayout || 'text-left'}
                                            isEditing={false}
                                            height="100%"
                                        />
                                    </div>
                                    <div className="ap-flex-shrink-0 ap-p-4 ap-bg-white ap-border-t ap-border-gray-200 ap-flex ap-justify-end">
                                        <Button
                                            variant="primary"
                                            onClick={handleLessonComplete}
                                            className="!ap-bg-green-600 hover:!ap-bg-green-700"
                                        >
                                            Mark as Complete
                                        </Button>
                                    </div>
                                </div>
                            ) : selectedLesson.type === 'excalidraw' || selectedLesson.excalidrawJson ? (
                                <div className="ap-h-full ap-flex ap-flex-col" key={`viewer-excalidraw-${selectedLesson.id}`}>
                                    <div className="ap-flex-1 ap-relative">
                                        <ExcalidrawPresentation
                                            initialData={selectedLesson.excalidrawJson || null}
                                            onComplete={handleLessonComplete}
                                            onReady={() => setIsLessonReady(true)}
                                            height="100%"
                                            className="!rounded-none !shadow-none ap-h-full"
                                        />
                                    </div>
                                    {isLessonReady && (
                                        <div className="ap-flex-shrink-0 ap-p-4 ap-bg-white ap-border-t ap-border-gray-200 ap-flex ap-justify-end">
                                            <Button
                                                variant="primary"
                                                onClick={handleLessonComplete}
                                                className="!ap-bg-green-600 hover:!ap-bg-green-700"
                                            >
                                                Mark as Complete
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div ref={lessonContentRef} className="ap-p-0 md:ap-p-8" key={`viewer-content-${selectedLesson.id}`}>
                                    {selectedLesson.content && (
                                        <div className="ap-prose ap-max-w-none">
                                            {(() => {
                                                // Try to parse as JSON (BlockNote format)
                                                try {
                                                    const parsed = JSON.parse(selectedLesson.content);
                                                    // Must be an array AND look like BlockNote blocks (not quiz data)
                                                    // BlockNote blocks have 'type' property, quiz questions have 'question'/'answers'
                                                    const isBlockNoteContent = Array.isArray(parsed) && 
                                                        parsed.length > 0 && 
                                                        parsed[0].type && 
                                                        typeof parsed[0].type === 'string' &&
                                                        !parsed[0].question && 
                                                        !parsed[0].answers;
                                                    if (isBlockNoteContent) {
                                                        return (
                                                            <>
                                                                <div className="ap-flex ap-justify-end ap-mb-4 print:ap-hidden">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setIsTextFocusMode(true)}
                                                                        className="!ap-text-blue-600 !ap-bg-blue-50 hover:!ap-bg-blue-100"
                                                                    >
                                                                        <HiOutlineBars3BottomLeft className="ap-w-4 ap-h-4" />
                                                                        Enter Focus Mode
                                                                    </Button>
                                                                </div>
                                                                
                                                                {isTextFocusMode && (
                                                                    <FocusReader 
                                                                        content={parsed}
                                                                        title={selectedLesson.title}
                                                                        onClose={() => setIsTextFocusMode(false)}
                                                                    />
                                                                )}

                                                                <BlockEditor
                                                                    initialContent={parsed}
                                                                    editable={false}
                                                                />
                                                            </>
                                                        );
                                                    }
                                                } catch {
                                                    // Not JSON, render as HTML
                                                }
                                                return (
                                                    <div dangerouslySetInnerHTML={{ __html: selectedLesson.content }} />
                                                );
                                            })()}
                                        </div>
                                    )}
                                    <div className="ap-mt-6 ap-flex ap-justify-end">
                                        <Button
                                            variant="primary"
                                            onClick={handleLessonComplete}
                                            className="!ap-bg-green-600 hover:!ap-bg-green-700"
                                        >
                                            Mark as Complete
                                        </Button>
                                    </div>
                                </div>
                            )}
                            </ErrorBoundary>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // List View Mode (default)
    return (
        <div className="ap-space-y-6">
            {/* Course Progress Header */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-6">
                <div className="ap-flex ap-flex-col md:ap-flex-row md:ap-items-center md:ap-justify-between ap-gap-4">
                    <div>
                        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">{course.title}</h2>
                        {course.description && (
                            <p className="ap-text-gray-500 ap-mt-1">{course.description}</p>
                        )}
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-6">
                        {/* Edit Course Toggle */}
                        {canEdit && onEditCourse && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onEditCourse}
                            >
                                <HiOutlinePencilSquare className="ap-w-4 ap-h-4" />
                                Edit Course
                            </Button>
                        )}
                        <div className="ap-text-center">
                            <div className="ap-text-2xl ap-font-bold ap-text-gray-900">{completedCount}/{lessons.length}</div>
                            <div className="ap-text-sm ap-text-gray-500">Lessons Complete</div>
                        </div>
                        <div className="ap-w-32">
                            <div className="ap-flex ap-justify-between ap-text-sm ap-text-gray-500 ap-mb-1">
                                <span>Progress</span>
                                <span>{overallProgress}%</span>
                            </div>
                            <div className="ap-h-3 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden ap-mb-2">
                                <div
                                    className="ap-h-full ap-bg-green-500 ap-rounded-full ap-transition-all ap-duration-500"
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>
                            {overallProgress === 100 && (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={handleDownloadCertificate}
                                    className="!ap-w-full !ap-justify-center !ap-gap-1.5 !ap-px-2 !ap-py-1 !ap-bg-yellow-50 !ap-text-yellow-700 !ap-border !ap-border-yellow-200 hover:!ap-bg-yellow-100 !ap-text-xs !ap-min-h-0"
                                    title="Download Certificate of Completion"
                                >
                                    <HiOutlineAcademicCap className="ap-w-3 ap-h-3" />
                                    Certificate
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lesson List */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-divide-y ap-divide-gray-100">
                    {(() => {
                        // Helper to render a lesson row
                        const renderLessonRow = (lesson: Lesson, index: number) => {
                            const status = getLessonStatus(lesson);
                            const isLocked = status === 'locked';
                            
                            return (
                                <div
                                    key={lesson.id}
                                    onClick={() => !isLocked && handleLessonClick(lesson)}
                                    className={`ap-p-4 ${
                                        isLocked 
                                            ? 'ap-bg-gray-50 ap-cursor-not-allowed' : 'hover:ap-bg-gray-50 ap-cursor-pointer'
                                    } ap-transition-colors`}
                                >
                                    <div className="ap-flex ap-flex-wrap sm:ap-flex-nowrap ap-items-start sm:ap-items-center ap-gap-3 sm:ap-gap-4">
                                        {/* Lesson Number */}
                                        <div className="ap-flex-shrink-0 ap-w-8 ap-h-8 sm:ap-w-10 sm:ap-h-10 ap-rounded-full ap-bg-gray-100 ap-flex ap-items-center ap-justify-center ap-font-medium ap-text-gray-600 ap-text-sm sm:ap-text-base">
                                            {index + 1}
                                        </div>
                                        
                                        {/* Status Icon */}
                                        <div className="ap-flex-shrink-0">
                                            {getStatusIcon(status)}
                                        </div>
                                        
                                        {/* Lesson Info - takes full width on mobile */}
                                        <div className="ap-flex-1 ap-min-w-0 ap-w-full sm:ap-w-auto ap-order-last sm:ap-order-none ap-mt-2 sm:ap-mt-0">
                                            <h3 className={`ap-font-medium ${isLocked ? 'ap-text-gray-400' : 'ap-text-gray-900'}`}>
                                                {lesson.title}
                                            </h3>
                                            {lesson.description && (
                                                <p className="ap-text-sm ap-text-gray-500 line-clamp-2 sm:ap-line-clamp-1">{lesson.description}</p>
                                            )}
                                            <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-2 sm:ap-gap-4 ap-mt-1 ap-text-xs ap-text-gray-400">
                                                {lesson.estimatedTime && (
                                                    <span className="ap-flex ap-items-center ap-gap-1">
                                                        <HiOutlineClock className="ap-w-3 ap-h-3" />
                                                        {lesson.estimatedTime}
                                                    </span>
                                                )}
                                                {lesson.type && (
                                                    <span className="ap-capitalize">{lesson.type.replace('_', ' ')}</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Action - stays with number/status on mobile */}
                                        <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-2 ap-ml-auto sm:ap-ml-0">
                                            {canEdit && onEditLesson && !isLocked && (
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditLesson(lesson);
                                                    }}
                                                    className="!ap-p-2 !ap-min-h-0"
                                                >
                                                    <HiOutlinePencilSquare className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                                </Button>
                                            )}
                                            {!isLocked && (
                                                <HiOutlineChevronRight className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        if (sections.length === 0) {
                            return lessons.map((lesson, index) => renderLessonRow(lesson, index));
                        }

                        // Group lessons by section
                        const sectionsMap = new Map<number, Lesson[]>();
                        const uncategorizedLessons: Lesson[] = [];

                        lessons.forEach(lesson => {
                            if (lesson.sectionId) {
                                if (!sectionsMap.has(lesson.sectionId)) {
                                    sectionsMap.set(lesson.sectionId, []);
                                }
                                sectionsMap.get(lesson.sectionId)!.push(lesson);
                            } else {
                                uncategorizedLessons.push(lesson);
                            }
                        });
                        
                        // Sort sections by order
                        const sortedSections = [...sections].sort((a, b) => a.order - b.order);

                        return (
                            <>
                                {uncategorizedLessons.length > 0 && (
                                    <>
                                        <div className="ap-bg-gray-50 ap-px-4 ap-py-2 ap-border-b ap-border-gray-100">
                                            <h3 className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wider">General</h3>
                                        </div>
                                        {uncategorizedLessons.map(lesson => renderLessonRow(lesson, lessons.findIndex(l => l.id === lesson.id)))}
                                    </>
                                )}
                                
                                {sortedSections.map(section => {
                                    const sectionLessons = sectionsMap.get(section.id) || [];
                                    if (sectionLessons.length === 0) return null;
                                    
                                    return (
                                        <React.Fragment key={section.id}>
                                            <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-y ap-border-gray-100 ap-mt-0">
                                                <h3 className="ap-font-semibold ap-text-gray-900">{section.title}</h3>
                                                {section.description && (
                                                    <p className="ap-text-sm ap-text-gray-500 ap-mt-0.5">{section.description}</p>
                                                )}
                                            </div>
                                            {sectionLessons.map(lesson => renderLessonRow(lesson, lessons.findIndex(l => l.id === lesson.id)))}
                                        </React.Fragment>
                                    );
                                })}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default CourseViewer;
