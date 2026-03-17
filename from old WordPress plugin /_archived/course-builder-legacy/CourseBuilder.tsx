/**
 * Course Builder - Main Component
 * 
 * Hierarchical course management with edit/view toggle and Excalidraw whiteboard
 * Hierarchy: Course → Section → Lesson (with Whiteboard)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { View } from '@/App';
import { 
    HiOutlineBookOpen, 
    HiOutlinePencilSquare, 
    HiOutlineEye,
    HiOutlineExclamationTriangle,
    HiOutlinePlus,
    HiOutlineChevronRight,
    HiOutlineArrowLeft,
    HiOutlineFolderOpen,
    HiOutlineDocumentText,
} from 'react-icons/hi2';
import { 
    Course, Section, Lesson, 
    HierarchyLevel, BreadcrumbItem, AccessLevel, SectionColor 
} from './types';
import * as api from './api';
import CoursePermissions from './CoursePermissions';
import { WhiteboardPresentation } from './whiteboard';
import { whiteboardApi } from './whiteboard';
import type { WhiteboardSlide } from './whiteboard';
import DraggableHierarchyList from './DraggableHierarchyList';

// ============================================================================
// WHITEBOARD LESSON VIEW COMPONENT
// ============================================================================

interface WhiteboardLessonViewProps {
    lesson: Lesson;
    sectionColor?: SectionColor | null;
    isEditMode: boolean;
    canEdit: boolean;
    breadcrumbs: BreadcrumbItem[];
    onBack: () => void;
    onBreadcrumbClick: (crumb: BreadcrumbItem, index: number) => void;
    onToggleEditMode: () => void;
}

const WhiteboardLessonView: React.FC<WhiteboardLessonViewProps> = ({
    lesson,
    sectionColor,
    isEditMode,
    canEdit,
    breadcrumbs,
    onBack,
    onBreadcrumbClick,
    onToggleEditMode,
}) => {
    const [slides, setSlides] = useState<WhiteboardSlide[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Load whiteboard slides for this lesson
    useEffect(() => {
        const loadSlides = async () => {
            try {
                setLoading(true);
                // Use lesson.id as the section_id for now (will be updated when full section system is integrated)
                const response = await whiteboardApi.getWhiteboardSlides(lesson.id);
                if (response.success && response.data) {
                    setSlides(response.data);
                } else {
                    // Default to empty slide
                    setSlides([{
                        id: `slide-${Date.now()}`,
                        title: 'Slide 1',
                        data: { elements: [] },
                    }]);
                }
            } catch (err) {
                console.error('Failed to load whiteboard:', err);
                setSlides([{
                    id: `slide-${Date.now()}`,
                    title: 'Slide 1',
                    data: { elements: [] },
                }]);
            } finally {
                setLoading(false);
            }
        };
        loadSlides();
    }, [lesson.id]);

    // Save slides
    const handleSaveSlides = async (updatedSlides: WhiteboardSlide[]) => {
        try {
            setSaveError(null);
            await whiteboardApi.saveWhiteboardSlides(lesson.id, updatedSlides);
            setSlides(updatedSlides);
        } catch (err) {
            console.error('Failed to save whiteboard:', err);
            setSaveError('Failed to save changes');
        }
    };

    // Get accent color from section
    const getAccentColor = () => {
        const colorMap: Record<SectionColor, string> = {
            blue: 'border-blue-500',
            green: 'border-green-500',
            purple: 'border-purple-500',
            orange: 'border-orange-500',
            pink: 'border-pink-500',
            teal: 'border-teal-500',
            indigo: 'border-indigo-500',
            red: 'border-red-500',
        };
        return sectionColor ? colorMap[sectionColor] : 'border-indigo-500';
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className={`bg-white border-b-2 ${getAccentColor()} px-6 py-3`}>
                <div className="flex items-center justify-between">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={onBack}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <HiOutlineArrowLeft className="w-5 h-5" />
                        </button>
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <HiOutlineChevronRight className="w-4 h-4 text-gray-400" />}
                                <button
                                    onClick={() => onBreadcrumbClick(crumb, index)}
                                    className={`hover:text-indigo-600 transition-colors ${
                                        index === breadcrumbs.length - 1 ? 'font-medium text-gray-900' : 'text-gray-500'
                                    }`}
                                >
                                    {crumb.title}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                        {saveError && (
                            <span className="text-sm text-red-600">{saveError}</span>
                        )}
                        
                        {canEdit && (
                            <button
                                onClick={onToggleEditMode}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    isEditMode
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {isEditMode ? (
                                    <>
                                        <HiOutlinePencilSquare className="w-4 h-4" />
                                        <span className="text-sm font-medium">Editing</span>
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineEye className="w-4 h-4" />
                                        <span className="text-sm font-medium">Viewing</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Whiteboard Canvas */}
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                ) : (
                    <WhiteboardPresentation
                        slides={slides}
                        readOnly={!isEditMode || !canEdit}
                        onSlidesChange={setSlides}
                        onSave={handleSaveSlides}
                        className="h-full"
                    />
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COURSE BUILDER COMPONENT
// ============================================================================

interface CourseBuilderProps {
    currentUser: UserProfile | null;
    currentView: View;
    onNavigate: (view: View) => void;
}

const CourseBuilder: React.FC<CourseBuilderProps> = ({ currentView, onNavigate }) => {
    // Access control
    const [access, setAccess] = useState<AccessLevel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Edit mode toggle
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Hierarchy navigation state
    const [level, setLevel] = useState<HierarchyLevel>('courses');
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ level: 'courses', title: 'All Courses' }]);
    
    // Data
    const [courses, setCourses] = useState<Course[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    
    // Selected IDs for navigation
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

    // Check access on mount
    useEffect(() => {
        const checkUserAccess = async () => {
            try {
                const accessData = await api.checkAccess();
                setAccess(accessData);
                
                // If user has edit access, default to edit mode for manage view
                if (accessData.can_edit && currentView === 'courseBuilder:manage') {
                    setIsEditMode(true);
                }
            } catch (err) {
                console.error('Access check failed:', err);
                setAccess({ has_access: false, can_view: false, can_edit: false, can_manage: false });
            } finally {
                setLoading(false);
            }
        };
        checkUserAccess();
    }, [currentView]);

    // Load courses when at course level
    useEffect(() => {
        if (level === 'courses' && access?.can_view) {
            loadCourses();
        }
    }, [level, access]);

    const loadCourses = async () => {
        try {
            setLoading(true);
            const data = await api.getCourses();
            setCourses(data);
        } catch (err) {
            setError('Failed to load courses');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadSections = async (courseId: number) => {
        try {
            setLoading(true);
            const data = await api.getSections(courseId);
            setSections(data);
        } catch (err) {
            setError('Failed to load sections');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadLessons = async (sectionId: number) => {
        try {
            setLoading(true);
            const data = await api.getLessons(sectionId);
            setLessons(data);
        } catch (err) {
            setError('Failed to load lessons');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Navigation handlers
    const handleCourseClick = useCallback(async (course: Course) => {
        setSelectedCourse(course);
        await loadSections(course.id);
        setLevel('sections');
        setBreadcrumbs(prev => [...prev.slice(0, 1), { level: 'sections', id: course.id, title: course.title }]);
    }, []);

    const handleSectionClick = useCallback(async (section: Section) => {
        setSelectedSection(section);
        await loadLessons(section.id);
        setLevel('lessons');
        setBreadcrumbs(prev => [...prev.slice(0, 2), { level: 'lessons', id: section.id, title: section.title }]);
    }, []);

    const handleLessonClick = useCallback((lesson: Lesson) => {
        setSelectedLesson(lesson);
        setLevel('canvas');
        setBreadcrumbs(prev => [...prev.slice(0, 3), { level: 'canvas', id: lesson.id, title: lesson.title }]);
    }, []);

    const handleBackClick = useCallback(() => {
        if (level === 'canvas') {
            setLevel('lessons');
            setSelectedLesson(null);
            setBreadcrumbs(prev => prev.slice(0, -1));
        } else if (level === 'lessons') {
            setLevel('sections');
            setSelectedSection(null);
            setBreadcrumbs(prev => prev.slice(0, -1));
        } else if (level === 'sections') {
            setLevel('courses');
            setSelectedCourse(null);
            setBreadcrumbs([{ level: 'courses', title: 'All Courses' }]);
        }
    }, [level]);

    const handleBreadcrumbClick = useCallback((crumb: BreadcrumbItem, index: number) => {
        if (crumb.level === 'courses') {
            setLevel('courses');
            setSelectedCourse(null);
            setSelectedSection(null);
            setSelectedLesson(null);
            setBreadcrumbs([{ level: 'courses', title: 'All Courses' }]);
        } else {
            setLevel(crumb.level);
            setBreadcrumbs(prev => prev.slice(0, index + 1));
            
            // Clear downstream selections
            if (crumb.level === 'sections') {
                setSelectedSection(null);
                setSelectedLesson(null);
            } else if (crumb.level === 'lessons') {
                setSelectedLesson(null);
            }
        }
    }, []);

    // CRUD handlers
    const handleCreateCourse = async () => {
        try {
            const newCourse = await api.createCourse({ title: 'New Course', status: 'draft' });
            setCourses(prev => [...prev, newCourse]);
        } catch (err) {
            setError('Failed to create course');
        }
    };

    const handleCreateSection = async () => {
        if (!selectedCourse) return;
        try {
            const newSection = await api.createSection({ 
                course_id: selectedCourse.id, 
                title: 'New Section' 
            });
            setSections(prev => [...prev, newSection]);
        } catch (err) {
            setError('Failed to create section');
        }
    };

    const handleCreateLesson = async () => {
        if (!selectedSection) return;
        try {
            const newLesson = await api.createLesson({ 
                section_id: selectedSection.id, 
                title: 'New Lesson' 
            });
            setLessons(prev => [...prev, newLesson]);
        } catch (err) {
            setError('Failed to create lesson');
        }
    };

    const handleUpdateItem = async (type: 'course' | 'section' | 'lesson', id: number, data: Record<string, unknown>) => {
        try {
            switch (type) {
                case 'course':
                    const updatedCourse = await api.updateCourse(id, data as Partial<Course>);
                    setCourses(prev => prev.map(c => c.id === id ? updatedCourse : c));
                    break;
                case 'section':
                    const updatedSection = await api.updateSection(id, data as Partial<Section>);
                    setSections(prev => prev.map(s => s.id === id ? updatedSection : s));
                    break;
                case 'lesson':
                    const updatedLesson = await api.updateLesson(id, data as Partial<Lesson>);
                    setLessons(prev => prev.map(l => l.id === id ? updatedLesson : l));
                    break;
            }
        } catch (err) {
            setError(`Failed to update ${type}`);
        }
    };

    const handleDeleteItem = async (type: 'course' | 'section' | 'lesson', id: number) => {
        if (!confirm(`Are you sure you want to delete this ${type}? This cannot be undone.`)) return;
        
        try {
            switch (type) {
                case 'course':
                    await api.deleteCourse(id);
                    setCourses(prev => prev.filter(c => c.id !== id));
                    break;
                case 'section':
                    await api.deleteSection(id);
                    setSections(prev => prev.filter(s => s.id !== id));
                    break;
                case 'lesson':
                    await api.deleteLesson(id);
                    setLessons(prev => prev.filter(l => l.id !== id));
                    break;
            }
        } catch (err) {
            setError(`Failed to delete ${type}`);
        }
    };

    // Loading state
    if (loading && !access) {
        return (
            <div className="p-8">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No access
    if (!access?.has_access) {
        return (
            <div className="p-8">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <HiOutlineExclamationTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-amber-800 mb-2">Access Restricted</h3>
                    <p className="text-amber-600">
                        You don't have permission to access the Course Builder.
                        Please contact an administrator if you need access.
                    </p>
                </div>
            </div>
        );
    }

    // Permissions view
    if (currentView === 'courseBuilder:permissions') {
        if (!access.can_manage) {
            return (
                <div className="p-8">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                        <HiOutlineExclamationTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-amber-800 mb-2">Admin Access Required</h3>
                        <p className="text-amber-600">
                            Only administrators can manage Course Builder permissions.
                        </p>
                    </div>
                </div>
            );
        }
        return <CoursePermissions />;
    }

    // Lesson canvas view - Excalidraw Whiteboard Presentation
    if (level === 'canvas' && selectedLesson) {
        return (
            <WhiteboardLessonView
                lesson={selectedLesson}
                sectionColor={selectedSection?.theme_color}
                isEditMode={isEditMode}
                canEdit={access.can_edit}
                breadcrumbs={breadcrumbs}
                onBack={handleBackClick}
                onBreadcrumbClick={handleBreadcrumbClick}
                onToggleEditMode={() => setIsEditMode(!isEditMode)}
            />
        );
    }

    // Get current items and level info
    const getLevelInfo = () => {
        switch (level) {
            case 'courses':
                return { 
                    items: courses, 
                    title: 'All Courses', 
                    icon: HiOutlineBookOpen,
                    itemType: 'course' as const,
                    onCreate: handleCreateCourse,
                    onItemClick: handleCourseClick,
                    childLabel: 'sections'
                };
            case 'sections':
                return { 
                    items: sections, 
                    title: selectedCourse?.title || 'Sections', 
                    icon: HiOutlineFolderOpen,
                    itemType: 'section' as const,
                    onCreate: handleCreateSection,
                    onItemClick: handleSectionClick,
                    childLabel: 'lessons'
                };
            case 'lessons':
                return { 
                    items: lessons, 
                    title: selectedSection?.title || 'Lessons', 
                    icon: HiOutlineDocumentText,
                    itemType: 'lesson' as const,
                    onCreate: handleCreateLesson,
                    onItemClick: handleLessonClick,
                    childLabel: 'cards'
                };
            default:
                return { 
                    items: [], 
                    title: '', 
                    icon: HiOutlineBookOpen,
                    itemType: 'course' as const,
                    onCreate: () => {},
                    onItemClick: () => {},
                    childLabel: ''
                };
        }
    };

    const levelInfo = getLevelInfo();
    const LevelIcon = levelInfo.icon;

    return (
        <div className="p-4 sm:p-6 min-h-screen bg-gray-50">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        {level !== 'courses' && (
                            <button
                                onClick={handleBackClick}
                                className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <HiOutlineArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                        )}
                        <LevelIcon className="w-7 h-7 text-indigo-600 flex-shrink-0" />
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                            {levelInfo.title}
                        </h2>
                    </div>
                    
                    {/* Edit/View Toggle */}
                    {access.can_edit && (
                        <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                isEditMode 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {isEditMode ? (
                                <>
                                    <HiOutlinePencilSquare className="w-5 h-5" />
                                    <span>Editing</span>
                                </>
                            ) : (
                                <>
                                    <HiOutlineEye className="w-5 h-5" />
                                    <span>Viewing</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Breadcrumbs */}
                <nav className="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto pb-2">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <HiOutlineChevronRight className="w-4 h-4 flex-shrink-0" />}
                            <button
                                onClick={() => handleBreadcrumbClick(crumb, index)}
                                className={`px-2 py-1 rounded hover:bg-gray-200 transition-colors whitespace-nowrap ${
                                    index === breadcrumbs.length - 1 ? 'font-medium text-gray-900' : ''
                                }`}
                            >
                                {crumb.title}
                            </button>
                        </React.Fragment>
                    ))}
                </nav>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                    <HiOutlineExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                        ✕
                    </button>
                </div>
            )}

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Add New Card (Edit Mode Only) */}
                {isEditMode && access.can_edit && (
                    <button
                        onClick={levelInfo.onCreate}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all group min-h-[200px]"
                    >
                        <HiOutlinePlus className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mb-2" />
                        <span className="text-gray-500 group-hover:text-indigo-600 font-medium">
                            Add {levelInfo.itemType.charAt(0).toUpperCase() + levelInfo.itemType.slice(1)}
                        </span>
                    </button>
                )}
            </div>

            {/* Draggable Items List */}
            {levelInfo.items.length > 0 && (
                <div className="mt-4">
                    <DraggableHierarchyList
                        items={levelInfo.items as (Course | Section | Lesson)[]}
                        type={levelInfo.itemType}
                        isEditMode={isEditMode}
                        childLabel={levelInfo.childLabel}
                        onItemClick={(item) => levelInfo.onItemClick(item as never)}
                        onItemUpdate={(id, data) => handleUpdateItem(levelInfo.itemType, id, data)}
                        onItemDelete={(id) => handleDeleteItem(levelInfo.itemType, id)}
                        onOpenNotion={levelInfo.itemType === 'course' ? (item) => {
                            // Navigate to Notion-style editor for this course
                            onNavigate(`courseBuilder:notion:${item.id}` as View);
                        } : undefined}
                        onReorder={async (newOrder) => {
                            try {
                                switch (levelInfo.itemType) {
                                    case 'course':
                                        await api.reorderCourses(newOrder);
                                        setCourses(prev => {
                                            const ordered: Course[] = [];
                                            newOrder.forEach(id => {
                                                const item = prev.find(c => c.id === id);
                                                if (item) ordered.push(item);
                                            });
                                            return ordered;
                                        });
                                        break;
                                    case 'section':
                                        await api.reorderSections(newOrder);
                                        setSections(prev => {
                                            const ordered: Section[] = [];
                                            newOrder.forEach(id => {
                                                const item = prev.find(s => s.id === id);
                                                if (item) ordered.push(item);
                                            });
                                            return ordered;
                                        });
                                        break;
                                    case 'lesson':
                                        await api.reorderLessons(newOrder);
                                        setLessons(prev => {
                                            const ordered: Lesson[] = [];
                                            newOrder.forEach(id => {
                                                const item = prev.find(l => l.id === id);
                                                if (item) ordered.push(item);
                                            });
                                            return ordered;
                                        });
                                        break;
                                }
                            } catch (err) {
                                setError('Failed to reorder items');
                                console.error(err);
                            }
                        }}
                        sectionColor={level === 'lessons' ? selectedSection?.theme_color : undefined}
                        layout="grid"
                    />
                </div>
            )}

            {/* Empty State */}
            {levelInfo.items.length === 0 && !loading && (
                <div className="text-center py-12">
                    <LevelIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">
                        No {level} yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                        {isEditMode 
                            ? `Click "Add ${levelInfo.itemType.charAt(0).toUpperCase() + levelInfo.itemType.slice(1)}" to create your first one.`
                            : 'No content has been added yet.'
                        }
                    </p>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                </div>
            )}
        </div>
    );
};

export default CourseBuilder;
