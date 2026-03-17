import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { HiOutlineChevronLeft, HiOutlineBookOpen, HiOutlinePlus, HiOutlineAcademicCap, HiOutlineCog6Tooth, HiOutlineChartBar, HiOutlineClipboardDocumentList, HiOutlineUserGroup } from 'react-icons/hi2';
import CourseList from './CourseList';
import CourseViewer from './CourseViewer';
import CourseBuilder from './CourseBuilder';
import LessonBuilder from './LessonBuilder';
import StudentAnalytics from './StudentAnalytics';
import AssignedLearningManager from './AssignedLearningManager';
import CourseAssignmentsView from './CourseAssignmentsView';
import MyAssignments from './MyAssignments';
import CategoryManager from './CategoryManager';
import { lmsApi, Course, Lesson, CourseCategory } from '../../services/api-lms';
import { invalidateCourseCache, getCachedCourses } from '../../services/courseCache';
import { UserProfile } from '../../types';

export type LMSView = 'home' | 'course-list' | 'course-viewer' | 'course-builder' | 'lesson-builder' | 'analytics' | 'assignments' | 'course-assignments';

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
    canViewAnalytics: boolean;
}

interface LMSModuleProps {
    currentUser: UserProfile;
    initialView?: LMSView;
    onBack?: () => void;
    isFocusMode?: boolean;
    onFocusModeChange?: (focusMode: boolean) => void;
    /** When set, the module will immediately deep-link to this lesson */
    assignedLessonId?: number;
    /** Called once the assignedLessonId has been consumed so App can clear it */
    onAssignedLessonConsumed?: () => void;
}

// Default permissions - all users can view, admins can edit
const getDefaultPermissions = (isAdmin: boolean): LMSPermissions => ({
    canViewCourses: true,
    canViewLessons: true,
    canCreateCourses: isAdmin,
    canEditCourses: isAdmin,
    canDeleteCourses: isAdmin,
    canCreateLessons: isAdmin,
    canEditLessons: isAdmin,
    canDeleteLessons: isAdmin,
    canManageExcalidraw: isAdmin,
    canModerateAll: isAdmin,
    canViewAnalytics: isAdmin, // Should be refined by real permissions
});

const LMSModule: React.FC<LMSModuleProps> = ({ currentUser: _currentUser, initialView = 'home', onBack, isFocusMode = false, onFocusModeChange, assignedLessonId, onAssignedLessonConsumed }) => {
    const isAdmin = window.mentorshipPlatformData?.is_admin || false;
    const serverPermissions = (window as any).mentorshipPlatformData?.lms_permissions || {};
    
    // Merge default admin-based permissions with server-side granular permissions
    const permissions: LMSPermissions = {
        ...getDefaultPermissions(isAdmin),
        canViewAnalytics: serverPermissions.canViewAnalytics !== undefined ? serverPermissions.canViewAnalytics : isAdmin,
        canModerateAll: serverPermissions.canModerateAll !== undefined ? serverPermissions.canModerateAll : isAdmin,
        // If server says canEditCourses, apply that to course management
        canEditCourses: serverPermissions.canEditCourses !== undefined ? serverPermissions.canEditCourses : isAdmin,
        canCreateCourses: serverPermissions.canEditCourses !== undefined ? serverPermissions.canEditCourses : isAdmin,
        canDeleteCourses: serverPermissions.canEditCourses !== undefined ? serverPermissions.canEditCourses : isAdmin,
    };
    
    const [view, setView] = useState<LMSView>(initialView);
    const [previousView, setPreviousView] = useState<LMSView>('course-list');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [initialLessonId, setInitialLessonId] = useState<number | undefined>(undefined);
    const [courses, setCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    useEffect(() => {
        loadCourses();
        loadCategories();
    }, []);

    useEffect(() => {
        setView(initialView);
        if (initialView === 'course-builder') {
            setSelectedCourse(null);
        }
    }, [initialView]);

    // Deep-link to an assigned lesson when the prop is set (e.g. from global banner)
    useEffect(() => {
        if (assignedLessonId && !loading) {
            handleOpenAssignedLesson(assignedLessonId);
            onAssignedLessonConsumed?.();
        }
    }, [assignedLessonId, loading]);

    const loadCourses = async (forceRefresh = false) => {
        try {
            setLoading(true);
            if (forceRefresh) invalidateCourseCache();
            const data = await getCachedCourses();
            setCourses(data);
        } catch (error) {
            console.error('Failed to load courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await lmsApi.getCategories();
            setCategories(data);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const canEdit = permissions.canCreateCourses || permissions.canEditCourses || permissions.canModerateAll;

    const handleCourseSelect = (course: Course) => {
        setSelectedCourse(course);
        setView('course-viewer');
    };

    const handleEditCourse = (course: Course) => {
        setPreviousView(view);
        setSelectedCourse(course);
        setView('course-builder');
    };

    const handleNewCourse = () => {
        setPreviousView(view);
        setSelectedCourse(null);
        setView('course-builder');
    };

    const handleExportCourse = async (course: Course) => {
        try {
            const result = await lmsApi.exportCourse(course.id);
            if (result.url) {
                // Trigger download
                const link = document.createElement('a');
                link.href = result.url;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Failed to export course:', error);
            alert('Failed to export course');
        }
    };

    const handleImportCourse = async (file: File) => {
        try {
            setLoading(true);
            const result = await lmsApi.importCourse(file);
            if (result.success) {
                alert('Course imported successfully!');
                loadCourses(true); // Reload list, busting cache
            } else {
                alert('Import failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to import course:', error);
            alert('Failed to import course');
        } finally {
            setLoading(false);
        }
    };

    const handleImportLearnDash = async () => {
        const input = prompt('Enter the LearnDash Course ID to import:');
        if (!input) return;

        const courseId = parseInt(input, 10);
        if (isNaN(courseId) || courseId <= 0) {
            alert('Invalid Course ID');
            return;
        }

        try {
            setLoading(true);
            const result = await lmsApi.importLearnDashCourse(courseId);
            if (result.success) {
                alert('LearnDash course imported successfully!');
                loadCourses(true);
            } else {
                alert('Import failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to import LearnDash course:', error);
            alert('Failed to import LearnDash course');
        } finally {
            setLoading(false);
        }
    };

    const handleEditLesson = (lesson: Lesson) => {
        setSelectedLesson(lesson);
        setView('lesson-builder');
    };

    const handleNewLesson = (course: Course) => {
        setSelectedCourse(course);
        setSelectedLesson(null);
        setView('lesson-builder');
    };

    const handleDeleteCourse = async (course: Course) => {
        if (!confirm(`Are you sure you want to delete "${course.title}"? This will also delete all lessons in this course.`)) {
            return;
        }
        try {
            await lmsApi.deleteCourse(course.id);
            await loadCourses(true);
        } catch (error) {
            console.error('Failed to delete course:', error);
            alert('Failed to delete course. Please try again.');
        }
    };

    const handleBack = () => {
        if (view === 'lesson-builder') {
            setView('course-builder');
            setSelectedLesson(null);
        } else if (view === 'course-builder') {
            // Return to wherever the user came from (course-list or home)
            setView(previousView);
            setSelectedCourse(null);
            setInitialLessonId(undefined);
        } else if (view === 'course-viewer') {
            setView('course-list');
            setSelectedCourse(null);
            setInitialLessonId(undefined);
        } else if (view === 'course-list' || view === 'analytics' || view === 'assignments' || view === 'course-assignments') {
            setView('home');
        } else if (onBack) {
            onBack();
        }
    };

    const renderHeader = () => {
        const titles: Record<LMSView, string> = {
            'home': 'Learning Module',
            'course-list': 'All Courses',
            'course-viewer': selectedCourse?.title || 'Course',
            'course-builder': selectedCourse ? `Edit: ${selectedCourse.title}` : 'New Course',
            'lesson-builder': selectedLesson ? `Edit Lesson` : 'New Lesson',
            'analytics': 'Student Analytics',
            'assignments': 'Assigned Learning',
            'course-assignments': 'Course Assignments',
        };

        return (
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-6 ap-pb-4 ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-items-center ap-gap-3">
                    {view !== 'home' && (
                        <Button
                            onClick={handleBack}
                            variant="ghost"
                            size="sm"
                            className="!ap-p-2"
                        >
                            <HiOutlineChevronLeft className="ap-w-5 ap-h-5 ap-text-gray-600" />
                        </Button>
                    )}
                    <div className="ap-flex ap-items-center ap-gap-2">
                        {view === 'analytics' ? <HiOutlineChartBar className="ap-w-6 ap-h-6 ap-text-blue-600" /> : view === 'assignments' ? <HiOutlineClipboardDocumentList className="ap-w-6 ap-h-6 ap-text-blue-600" /> : view === 'course-assignments' ? <HiOutlineUserGroup className="ap-w-6 ap-h-6 ap-text-blue-600" /> : <HiOutlineAcademicCap className="ap-w-6 ap-h-6 ap-text-blue-600" />}
                        <h1 className="ap-text-xl ap-font-bold ap-text-gray-900">{titles[view]}</h1>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                    {['home', 'course-list', 'course-builder'].includes(view) && canEdit && (
                        <Button
                            onClick={() => setView('assignments')}
                            variant="secondary"
                            className="!ap-flex !ap-items-center !ap-gap-2"
                        >
                            <HiOutlineClipboardDocumentList className="ap-w-4 ap-h-4" />
                            Assigned Learning
                        </Button>
                    )}
                    {['home', 'course-list', 'course-builder'].includes(view) && (permissions.canViewAnalytics || isAdmin) && (
                        <Button
                            onClick={() => setView('analytics')}
                            variant="secondary"
                            className="!ap-flex !ap-items-center !ap-gap-2"
                        >
                            <HiOutlineChartBar className="ap-w-4 ap-h-4" />
                            Analytics
                        </Button>
                    )}
                    {['home', 'course-list', 'course-builder'].includes(view) && canEdit && (
                        <Button
                            onClick={handleNewCourse}
                            variant="primary"
                            className="!ap-flex !ap-items-center !ap-gap-2"
                        >
                            <HiOutlinePlus className="ap-w-4 ap-h-4" />
                            New Course
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    const handleOpenAssignedLesson = async (lessonId: number) => {
        try {
            // Fetch the lesson to learn which course it belongs to
            const lesson = await lmsApi.getLesson(lessonId);
            if (!lesson.courseId) {
                console.error('Lesson has no courseId', lesson);
                return;
            }

            // Try to find the course in the already-loaded list, else fetch it
            let course = courses.find(c => c.id === lesson.courseId) || null;
            if (!course) {
                course = await lmsApi.getCourse(lesson.courseId);
            }

            setSelectedCourse(course);
            setInitialLessonId(lessonId);
            setView('course-viewer');
        } catch (error) {
            console.error('Failed to open assigned lesson:', error);
        }
    };

    const renderHome = () => (
        <div className="ap-space-y-6">
            {/* Assigned Learning banner for all users */}
            <MyAssignments onOpenLesson={handleOpenAssignedLesson} />

            {/* Quick Stats */}
            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-4">
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-blue-100 ap-rounded-lg">
                            <HiOutlineBookOpen className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Total Courses</p>
                            <p className="ap-text-xl ap-font-bold ap-text-gray-900">{courses.length}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-green-100 ap-rounded-lg">
                            <HiOutlineAcademicCap className="ap-w-5 ap-h-5 ap-text-green-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">In Progress</p>
                            <p className="ap-text-xl ap-font-bold ap-text-gray-900">
                                {courses.filter(c => c.progress && c.progress > 0 && c.progress < 100).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-purple-100 ap-rounded-lg">
                            <HiOutlineCog6Tooth className="ap-w-5 ap-h-5 ap-text-purple-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Completed</p>
                            <p className="ap-text-xl ap-font-bold ap-text-gray-900">
                                {courses.filter(c => c.progress === 100).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Course List Preview */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
                <div className="ap-p-4 ap-border-b ap-border-gray-200 ap-flex ap-items-center ap-justify-between">
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Your Courses</h2>
                    <Button
                        onClick={() => setView('course-list')}
                        variant="ghost"
                        size="sm"
                        className="!ap-text-blue-600 hover:!ap-text-blue-700"
                    >
                        View All →
                    </Button>
                </div>
                {loading ? (
                    <div className="ap-p-8 ap-text-center">
                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto"></div>
                        <p className="ap-mt-2 ap-text-gray-500">Loading courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="ap-p-8 ap-text-center">
                        <HiOutlineBookOpen className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                        <p className="ap-text-gray-500">No courses available yet</p>
                        {canEdit && (
                            <Button
                                onClick={handleNewCourse}
                                variant="ghost"
                                className="!ap-mt-4 !ap-text-blue-600 hover:!ap-text-blue-700"
                            >
                                Create your first course →
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="ap-divide-y ap-divide-gray-100">
                        {courses.slice(0, 5).map((course) => (
                            <div
                                key={course.id}
                                className="ap-p-4 hover:ap-bg-gray-50 ap-cursor-pointer ap-transition-colors ap-flex ap-items-center ap-justify-between"
                                onClick={() => handleCourseSelect(course)}
                            >
                                <div className="ap-flex ap-items-center ap-gap-3">
                                    <div className="ap-w-12 ap-h-12 ap-bg-blue-100 ap-rounded-lg ap-flex ap-items-center ap-justify-center">
                                        <HiOutlineBookOpen className="ap-w-6 ap-h-6 ap-text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="ap-font-medium ap-text-gray-900">{course.title}</h3>
                                        <p className="ap-text-sm ap-text-gray-500">
                                            {course.lessonCount || 0} lessons
                                        </p>
                                    </div>
                                </div>
                                {course.progress !== undefined && (
                                    <div className="ap-flex ap-items-center ap-gap-2">
                                        <div className="ap-w-24 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                            <div
                                                className="ap-h-full ap-bg-green-500 ap-rounded-full ap-transition-all"
                                                style={{ width: `${course.progress}%` }}
                                            />
                                        </div>
                                        <span className="ap-text-sm ap-text-gray-500">{course.progress}%</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        switch (view) {
            case 'home':
                return renderHome();
            case 'course-list':
                return (
                    <CourseList
                        courses={courses}
                        loading={loading}
                        permissions={permissions}
                        categories={categories}
                        onSelect={handleCourseSelect}
                        onEdit={handleEditCourse}
                        onDelete={handleDeleteCourse}
                        onNew={handleNewCourse}
                        onRefresh={() => loadCourses(true)}
                        onManageCategories={canEdit ? () => setShowCategoryManager(true) : undefined}
                        onSetCategory={canEdit ? async (courseId, category) => {
                            await lmsApi.updateCourse(courseId, { category });
                            loadCourses(true);
                        } : undefined}
                        onExport={permissions.canCreateCourses ? handleExportCourse : undefined}
                        onImport={permissions.canCreateCourses ? handleImportCourse : undefined}
                        onImportLearnDash={permissions.canCreateCourses ? handleImportLearnDash : undefined}
                    />
                );
            case 'course-viewer':
                return selectedCourse ? (
                    <CourseViewer
                        course={selectedCourse}
                        permissions={permissions}
                        onEditLesson={handleEditLesson}
                        onEditCourse={() => setView('course-builder')}
                        onBack={handleBack}
                        isFocusMode={isFocusMode}
                        onFocusModeChange={onFocusModeChange}
                        initialLessonId={initialLessonId}
                    />
                ) : null;
            case 'course-builder':
                return (
                    <CourseBuilder
                        course={selectedCourse}
                        permissions={permissions}
                        categories={categories}
                        onSave={async () => {
                            await loadCourses(true);
                            setView('home');
                        }}
                        onCancel={handleBack}
                        onEditLesson={handleEditLesson}
                        onNewLesson={() => selectedCourse && handleNewLesson(selectedCourse)}
                        onViewCourse={() => setView('course-viewer')}
                    />
                );
            case 'lesson-builder':
                return selectedCourse ? (
                    <LessonBuilder
                        key={`lesson-builder-${selectedLesson?.id || 'new'}-${Date.now()}`}
                        courseId={selectedCourse.id}
                        lesson={selectedLesson}
                        permissions={permissions}
                        onSave={async () => {
                            await loadCourses(true);
                            setView('course-builder');
                            setSelectedLesson(null);
                        }}
                        onCancel={handleBack}
                    />
                ) : null;
            case 'analytics':
                return <StudentAnalytics />;
            case 'course-assignments':
                return <CourseAssignmentsView />;
            case 'assignments':
                return <AssignedLearningManager />;
            default:
                return null;
        }
    };

    return (
        <div className="ap-min-h-screen ap-bg-gray-50">
            <div className={`ap-mx-auto ap-px-4 ap-py-6 ${view === 'course-viewer' ? 'ap-w-full ap-max-w-[95vw]' : 'ap-max-w-7xl'}`}>
                {renderHeader()}
                {renderContent()}
            </div>
            {showCategoryManager && (
                <CategoryManager
                    onClose={() => setShowCategoryManager(false)}
                    onChanged={() => {
                        loadCategories();
                        loadCourses(true);
                    }}
                />
            )}
        </div>
    );
};

export default LMSModule;
