import React, { useState, useEffect } from 'react';
import { 
    HiOutlineCloudArrowUp, HiOutlinePlus, HiOutlineTrash, HiOutlineBars3, 
    HiOutlineBookOpen, HiOutlinePencilSquare, HiOutlineEye, HiOutlineChevronDown,
    HiOutlineChevronUp, HiOutlineFolderPlus, HiOutlineFolder, HiOutlineXMark, HiOutlineCheck
} from 'react-icons/hi2';
import { Button } from '../ui';
import { Course, Lesson, LessonSection, CourseCategory, lmsApi } from '../../services/api-lms';
import CourseAutoAssignPanel from './CourseAutoAssignPanel';

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

interface CourseBuilderProps {
    course: Course | null;
    permissions: LMSPermissions;
    categories?: CourseCategory[];
    onSave: () => void;
    onCancel: () => void;
    onEditLesson: (lesson: Lesson) => void;
    onNewLesson: () => void;
    onPreviewLesson?: (lesson: Lesson) => void;
    onViewCourse?: () => void;
}

const CourseBuilder: React.FC<CourseBuilderProps> = ({
    course,
    permissions,
    categories = [],
    onSave,
    onCancel,
    onEditLesson,
    onNewLesson,
    onPreviewLesson,
    onViewCourse,
}) => {
    const [title, setTitle] = useState(course?.title || '');
    const [description, setDescription] = useState(course?.description || '');
    const [category, setCategory] = useState(course?.category || '');
    const [sequential, setSequential] = useState(course?.sequential ?? true);
    const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(course?.status || 'draft');
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [sections, setSections] = useState<LessonSection[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settingsExpanded, setSettingsExpanded] = useState(!course?.id);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    const [editingSection, setEditingSection] = useState<number | null>(null);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [addingSection, setAddingSection] = useState(false);
    const [sectionTitleInput, setSectionTitleInput] = useState('');

    const canEditLessons = permissions.canEditLessons || permissions.canModerateAll;
    const canDeleteLessons = permissions.canDeleteLessons || permissions.canModerateAll;
    const canCreateLessons = permissions.canCreateLessons || permissions.canModerateAll;

    useEffect(() => {
        if (course?.id) {
            loadLessons();
            loadSections();
        }
    }, [course?.id]);

    const loadLessons = async () => {
        if (!course?.id) return;
        try {
            setLoading(true);
            const data = await lmsApi.getCourseLessons(course.id);
            setLessons(data);
        } catch (error) {
            console.error('Failed to load lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSections = async () => {
        if (!course?.id) return;
        try {
            const data = await lmsApi.getCourseSections(course.id);
            setSections(data);
            // Expand all sections by default
            setExpandedSections(new Set(data.map((s: LessonSection) => s.id)));
        } catch (error) {
            console.error('Failed to load sections:', error);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        
        try {
            setSaving(true);
            if (course?.id) {
                await lmsApi.updateCourse(course.id, { title, description, category, sequential, status });
            } else {
                await lmsApi.createCourse({ title, description, category, sequential, status });
            }
            onSave();
        } catch (error) {
            console.error('Failed to save course:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLesson = async (lessonId: number) => {
        if (!confirm('Are you sure you want to delete this lesson?')) return;
        
        try {
            await lmsApi.deleteLesson(lessonId);
            setLessons(lessons.filter(l => l.id !== lessonId));
        } catch (error) {
            console.error('Failed to delete lesson:', error);
        }
    };

    // Section management functions
    const handleAddSection = async () => {
        if (!course?.id || !sectionTitleInput.trim()) return;
        
        try {
            const newSection = await lmsApi.createSection(course.id, {
                title: sectionTitleInput.trim(),
                displayOrder: sections.length
            });
            setSections([...sections, newSection]);
            setExpandedSections(prev => new Set([...prev, newSection.id]));
            setSectionTitleInput('');
            setAddingSection(false);
        } catch (error) {
            console.error('Failed to create section:', error);
        }
    };

    const handleUpdateSection = async (sectionId: number, title: string) => {
        try {
            await lmsApi.updateSection(sectionId, { title });
            setSections(sections.map(s => s.id === sectionId ? { ...s, title } : s));
            setEditingSection(null);
            setNewSectionTitle('');
        } catch (error) {
            console.error('Failed to update section:', error);
        }
    };

    const handleDeleteSection = async (sectionId: number) => {
        if (!confirm('Are you sure you want to delete this section? Lessons in this section will become ungrouped.')) return;
        
        try {
            await lmsApi.deleteSection(sectionId);
            setSections(sections.filter(s => s.id !== sectionId));
            // Clear sectionId from lessons that were in this section
            setLessons(lessons.map(l => l.sectionId === sectionId ? { ...l, sectionId: undefined } : l));
        } catch (error) {
            console.error('Failed to delete section:', error);
        }
    };

    const handleMoveToSection = async (lessonId: number, sectionId: number | null) => {
        try {
            await lmsApi.updateLesson(lessonId, { sectionId: sectionId === null ? undefined : sectionId });
            setLessons(lessons.map(l => l.id === lessonId ? { ...l, sectionId: sectionId ?? undefined } : l));
        } catch (error) {
            console.error('Failed to move lesson to section:', error);
        }
    };

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

    // Group lessons by section
    const getLessonsForSection = (sectionId: number | null) => {
        return lessons.filter(l => (l.sectionId ?? null) === sectionId);
    };

    // Helper to render a lesson item
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderLessonItem = (lesson: Lesson, index: number, _currentSectionId: number | null) => {
        const typeInfo = getLessonTypeInfo(lesson);
        const globalIndex = lessons.findIndex(l => l.id === lesson.id);
        
        return (
            <div
                key={lesson.id}
                draggable={canEditLessons}
                onDragStart={() => handleDragStart(globalIndex)}
                onDragOver={(e) => handleDragOver(e, globalIndex)}
                onDragEnd={handleDragEnd}
                className={`group ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200 hover:ap-border-gray-300 ap-transition-all ${
                    canEditLessons ? 'ap-cursor-move' : ''
                } ${draggedIndex === globalIndex ? 'ap-opacity-50 ap-border-blue-400' : ''}`}
            >
                <div className="ap-flex ap-flex-wrap sm:ap-flex-nowrap ap-items-start sm:ap-items-center ap-gap-3 sm:ap-gap-4">
                    {/* Drag Handle */}
                    {canEditLessons && (
                        <HiOutlineBars3 className="ap-w-5 ap-h-5 ap-text-gray-400 ap-flex-shrink-0 ap-opacity-50 group-hover:ap-opacity-100" />
                    )}
                    
                    {/* Order Number */}
                    <div className="ap-w-7 ap-h-7 sm:ap-w-8 sm:ap-h-8 ap-rounded-full ap-bg-white ap-border ap-border-gray-200 ap-flex ap-items-center ap-justify-center ap-text-sm ap-font-bold ap-text-gray-600 ap-flex-shrink-0">
                        {index + 1}
                    </div>
                    
                    {/* Lesson Info - full width on mobile */}
                    <div className="ap-flex-1 ap-min-w-0 ap-w-full sm:ap-w-auto ap-order-last sm:ap-order-none ap-mt-2 sm:ap-mt-0">
                        <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-2 ap-mb-1">
                            <h4 className="ap-font-medium ap-text-gray-900">
                                {lesson.title}
                            </h4>
                            <span className={`ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${typeInfo.color}`}>
                                {typeInfo.icon} {typeInfo.label}
                            </span>
                        </div>
                        {lesson.description && (
                            <p className="ap-text-sm ap-text-gray-500 line-clamp-2 sm:ap-line-clamp-1">
                                {lesson.description}
                            </p>
                        )}
                        {lesson.estimatedTime && (
                            <p className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                ⏱️ {lesson.estimatedTime}
                            </p>
                        )}
                    </div>
                    
                    {/* Move to Section - hidden on small mobile */}
                    {sections.length > 0 && canEditLessons && (
                        <select
                            value={lesson.sectionId ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                handleMoveToSection(lesson.id, val === '' ? null : parseInt(val, 10));
                            }}
                            onClick={e => e.stopPropagation()}
                            className="ap-hidden sm:ap-block ap-text-xs ap-px-2 ap-py-1 ap-border ap-border-gray-200 ap-rounded ap-bg-white ap-text-gray-600 ap-cursor-pointer hover:ap-border-gray-300"
                        >
                            <option value="">No section</option>
                            {sections.map(s => (
                                <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                        </select>
                    )}
                    
                    {/* Actions - stays inline with drag handle */}
                    <div className="ap-flex ap-items-center ap-gap-1 ap-flex-shrink-0 ap-ml-auto">
                        {onPreviewLesson && (
                            <Button
                                variant="icon"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreviewLesson(lesson);
                                }}
                                className="!ap-p-2 !ap-min-h-0"
                                title="Preview lesson"
                            >
                                <HiOutlineEye className="ap-w-4 ap-h-4 ap-text-gray-500" />
                            </Button>
                        )}
                        {canEditLessons && (
                            <Button
                                variant="icon"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditLesson(lesson);
                                }}
                                className="!ap-p-2 !ap-min-h-0 hover:!ap-bg-blue-100"
                                title="Edit lesson"
                        >
                            <HiOutlinePencilSquare className="ap-w-4 ap-h-4 ap-text-blue-600" />
                        </Button>
                    )}
                    {canDeleteLessons && (
                        <Button
                            variant="icon"
                            size="xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLesson(lesson.id);
                            }}
                            className="!ap-p-2 !ap-min-h-0 hover:!ap-bg-red-100"
                            title="Delete lesson"
                        >
                            <HiOutlineTrash className="ap-w-4 ap-h-4 ap-text-red-500" />
                        </Button>
                    )}
                    </div>
                </div>
            </div>
        );
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };
    
    const getLessonTypeInfo = (lesson: Lesson) => {
        if (lesson.type === 'hybrid') {
            return { icon: '📝🎨', label: 'Hybrid', color: 'ap-bg-green-100 ap-text-green-700' };
        }
        if (lesson.type === 'excalidraw' || lesson.excalidrawJson) {
            return { icon: '🎨', label: 'Excalidraw', color: 'ap-bg-purple-100 ap-text-purple-700' };
        }
        return { icon: '📝', label: 'Content', color: 'ap-bg-blue-100 ap-text-blue-700' };
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        
        const newLessons = [...lessons];
        const [draggedLesson] = newLessons.splice(draggedIndex, 1);
        newLessons.splice(index, 0, draggedLesson);
        
        setLessons(newLessons);
        setDraggedIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null) return;
        
        // Update order on server using batch reorder
        try {
            const lessonIds = lessons.map(l => l.id);
            await lmsApi.reorderLessons(lessonIds);
        } catch (error) {
            console.error('Failed to update lesson order:', error);
            loadLessons(); // Reload on error
        }
        
        setDraggedIndex(null);
    };

    return (
        <div className="ap-space-y-6">
            {/* View Course Toggle - When editing existing course */}
            {course?.id && onViewCourse && (
                <div className="ap-flex ap-justify-end">
                    <Button
                        variant="outline"
                        onClick={onViewCourse}
                    >
                        <HiOutlineEye className="ap-w-4 ap-h-4" />
                        View as Learner
                    </Button>
                </div>
            )}

            {/* Course Settings - Collapsible Card */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                <Button
                    variant="icon"
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                    className="!ap-w-full !ap-px-6 !ap-py-4 !ap-flex !ap-items-center !ap-justify-between !ap-rounded-none"
                >
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Course Settings</h2>
                        {!settingsExpanded && title && (
                            <span className="ap-text-sm ap-text-gray-500">— {title}</span>
                        )}
                    </div>
                    {settingsExpanded ? (
                        <HiOutlineChevronUp className="ap-w-5 ap-h-5 ap-text-gray-400" />
                    ) : (
                        <HiOutlineChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                    )}
                </Button>
                
                {settingsExpanded && (
                    <div className="ap-px-6 ap-pb-6 ap-border-t ap-border-gray-100">
                        <div className="ap-space-y-4 ap-pt-4">
                            {/* Course Title */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Course Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter course title..."
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Enter course description..."
                                    rows={3}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Category
                                    <span className="ap-ml-1 ap-text-xs ap-font-normal ap-text-gray-400">(used to group courses in the list)</span>
                                </label>
                                {categories.length > 0 ? (
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-bg-white"
                                    >
                                        <option value="">— Uncategorized —</option>
                                        {categories
                                            .slice()
                                            .sort((a, b) => a.displayOrder - b.displayOrder)
                                            .map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))
                                        }
                                        {/* Keep custom value if it doesn't match any managed category */}
                                        {category && !categories.some(c => c.name === category) && (
                                            <option value={category}>{category} (custom)</option>
                                        )}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="e.g. Onboarding, Safety, Compliance…"
                                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                    />
                                )}
                            </div>

                            {/* Sequential Toggle */}
                            <div className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-bg-gray-50 ap-rounded-lg">
                                <div>
                                    <h4 className="ap-font-medium ap-text-gray-900">Sequential Progress</h4>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Require learners to complete lessons in order
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={sequential}
                                    onClick={() => setSequential(!sequential)}
                                    className={`ap-relative ap-inline-flex ap-h-6 ap-w-11 ap-flex-shrink-0 ap-cursor-pointer ap-rounded-full ap-border-2 ap-border-transparent ap-transition-colors ap-duration-200 ap-ease-in-out focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-ring-offset-2 ${
                                        sequential ? 'ap-bg-blue-600' : 'ap-bg-gray-200'
                                    }`}
                                >
                                    <span
                                        className={`ap-pointer-events-none ap-inline-block ap-h-5 ap-w-5 ap-transform ap-rounded-full ap-bg-white ap-shadow ap-ring-0 ap-transition ap-duration-200 ap-ease-in-out ${
                                            sequential ? 'ap-translate-x-5' : 'ap-translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Course Status */}
                            <div className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-bg-gray-50 ap-rounded-lg">
                                <div>
                                    <h4 className="ap-font-medium ap-text-gray-900">Course Status</h4>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Control visibility for learners
                                    </p>
                                </div>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
                                    className="ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg ap-bg-white ap-text-gray-700 focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                >
                                    <option value="draft">📝 Draft</option>
                                    <option value="published">✅ Published</option>
                                    <option value="archived">📦 Archived</option>
                                </select>
                            </div>

                            {/* Save Button in Settings */}
                            <div className="ap-flex ap-justify-end ap-pt-2">
                                <Button
                                    variant="primary"
                                    onClick={handleSave}
                                    disabled={saving || !title.trim()}
                                >
                                    <HiOutlineCloudArrowUp className="ap-w-4 ap-h-4" />
                                    {saving ? 'Saving...' : (course ? 'Save Settings' : 'Create Course')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Role Auto-Assignment Panel - Only for existing courses */}
            {course?.id && (
                <CourseAutoAssignPanel courseId={course.id} />
            )}

            {/* Lessons Section - Always Visible */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-100 ap-flex ap-items-center ap-justify-between">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <HiOutlineBookOpen className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                            Lessons
                            {lessons.length > 0 && (
                                <span className="ap-ml-2 ap-text-sm ap-font-normal ap-text-gray-500">
                                    ({lessons.length})
                                </span>
                            )}
                        </h2>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        {course?.id && canCreateLessons && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setAddingSection(true)}
                                >
                                    <HiOutlineFolderPlus className="ap-w-4 ap-h-4" />
                                    Add Section
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={onNewLesson}
                                >
                                    <HiOutlinePlus className="ap-w-4 ap-h-4" />
                                    Add Lesson
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="ap-p-6">
                    {!course?.id ? (
                        <div className="ap-py-8 ap-text-center ap-border-2 ap-border-dashed ap-border-gray-200 ap-rounded-lg ap-bg-gray-50">
                            <HiOutlineBookOpen className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                            <p className="ap-text-gray-500 ap-mb-2">Save the course first to add lessons</p>
                            <p className="ap-text-sm ap-text-gray-400">
                                Fill in the course settings above and click "Create Course"
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="ap-py-8 ap-text-center">
                            <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto"></div>
                            <p className="ap-mt-2 ap-text-gray-500">Loading lessons...</p>
                        </div>
                    ) : lessons.length === 0 && sections.length === 0 && !addingSection ? (
                        <div className="ap-py-8 ap-text-center ap-border-2 ap-border-dashed ap-border-gray-200 ap-rounded-lg">
                            <HiOutlineBookOpen className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                            <p className="ap-text-gray-500 ap-mb-3">No lessons yet</p>
                            {canCreateLessons && (
                                <div className="ap-flex ap-justify-center ap-gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setAddingSection(true)}
                                    >
                                        <HiOutlineFolderPlus className="ap-w-4 ap-h-4" />
                                        Add a section
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={onNewLesson}
                                    >
                                        <HiOutlinePlus className="ap-w-4 ap-h-4" />
                                        Add your first lesson
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="ap-space-y-4">
                            {/* Add Section Form */}
                            {addingSection && (
                                <div className="ap-flex ap-items-center ap-gap-2 ap-p-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg">
                                    <HiOutlineFolder className="ap-w-5 ap-h-5 ap-text-blue-500 ap-flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={sectionTitleInput}
                                        onChange={(e) => setSectionTitleInput(e.target.value)}
                                        placeholder="Enter section title..."
                                        className="ap-flex-1 ap-px-3 ap-py-1.5 ap-border ap-border-gray-200 ap-rounded-lg ap-text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddSection();
                                            if (e.key === 'Escape') {
                                                setAddingSection(false);
                                                setSectionTitleInput('');
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="primary"
                                        size="xs"
                                        onClick={handleAddSection}
                                        disabled={!sectionTitleInput.trim()}
                                        className="!ap-p-1.5 !ap-min-h-0"
                                    >
                                        <HiOutlineCheck className="ap-w-4 ap-h-4" />
                                    </Button>
                                    <Button
                                        variant="icon"
                                        size="xs"
                                        onClick={() => {
                                            setAddingSection(false);
                                            setSectionTitleInput('');
                                        }}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:ap-text-gray-700"
                                    >
                                        <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Drag help text */}
                            {canEditLessons && lessons.length > 1 && (
                                <p className="ap-text-xs ap-text-gray-400 ap-mb-2">
                                    💡 Drag lessons to reorder
                                </p>
                            )}
                            
                            {/* Sections with their lessons */}
                            {sections.map(section => {
                                const sectionLessons = getLessonsForSection(section.id);
                                const isExpanded = expandedSections.has(section.id);
                                
                                return (
                                    <div key={section.id} className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                        {/* Section Header */}
                                        <div 
                                            className="ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-3 ap-bg-gray-50 ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                            onClick={() => toggleSection(section.id)}
                                        >
                                            <HiOutlineFolder className="ap-w-5 ap-h-5 ap-text-amber-500 ap-flex-shrink-0" />
                                            
                                            {editingSection === section.id ? (
                                                <div className="ap-flex-1 ap-flex ap-items-center ap-gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={newSectionTitle}
                                                        onChange={(e) => setNewSectionTitle(e.target.value)}
                                                        className="ap-flex-1 ap-px-2 ap-py-1 ap-border ap-border-gray-300 ap-rounded ap-text-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateSection(section.id, newSectionTitle);
                                                            if (e.key === 'Escape') {
                                                                setEditingSection(null);
                                                                setNewSectionTitle('');
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        variant="primary"
                                                        size="xs"
                                                        onClick={() => handleUpdateSection(section.id, newSectionTitle)}
                                                        className="!ap-p-1 !ap-min-h-0"
                                                    >
                                                        <HiOutlineCheck className="ap-w-4 ap-h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="icon"
                                                        size="xs"
                                                        onClick={() => {
                                                            setEditingSection(null);
                                                            setNewSectionTitle('');
                                                        }}
                                                        className="!ap-p-1 !ap-min-h-0 ap-text-gray-500 hover:ap-text-gray-700"
                                                    >
                                                        <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="ap-flex-1 ap-font-medium ap-text-gray-800">{section.title}</span>
                                                    <span className="ap-text-sm ap-text-gray-500">
                                                        {sectionLessons.length} lesson{sectionLessons.length !== 1 ? 's' : ''}
                                                    </span>
                                                </>
                                            )}
                                            
                                            {/* Section Actions */}
                                            {editingSection !== section.id && (
                                                <div className="ap-flex ap-items-center ap-gap-1" onClick={e => e.stopPropagation()}>
                                                    <Button
                                                        variant="icon"
                                                        size="xs"
                                                        onClick={() => {
                                                            setEditingSection(section.id);
                                                            setNewSectionTitle(section.title);
                                                        }}
                                                        className="!ap-p-1.5 !ap-min-h-0"
                                                        title="Rename section"
                                                    >
                                                        <HiOutlinePencilSquare className="ap-w-4 ap-h-4 ap-text-gray-500" />
                                                    </Button>
                                                    <Button
                                                        variant="icon"
                                                        size="xs"
                                                        onClick={() => handleDeleteSection(section.id)}
                                                        className="!ap-p-1.5 !ap-min-h-0 hover:!ap-bg-red-100"
                                                        title="Delete section"
                                                    >
                                                        <HiOutlineTrash className="ap-w-4 ap-h-4 ap-text-red-500" />
                                                    </Button>
                                                </div>
                                            )}
                                            
                                            {isExpanded ? (
                                                <HiOutlineChevronUp className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                            ) : (
                                                <HiOutlineChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                            )}
                                        </div>
                                        
                                        {/* Section Lessons */}
                                        {isExpanded && (
                                            <div className="ap-p-3 ap-space-y-2">
                                                {sectionLessons.length === 0 ? (
                                                    <p className="ap-text-sm ap-text-gray-400 ap-text-center ap-py-4">
                                                        No lessons in this section yet
                                                    </p>
                                                ) : (
                                                    sectionLessons.map((lesson, index) => renderLessonItem(lesson, index, section.id))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Ungrouped Lessons */}
                            {getLessonsForSection(null).length > 0 && (
                                <div className="ap-space-y-2">
                                    {sections.length > 0 && (
                                        <h4 className="ap-text-sm ap-font-medium ap-text-gray-500 ap-px-1">Ungrouped Lessons</h4>
                                    )}
                                    {getLessonsForSection(null).map((lesson, index) => renderLessonItem(lesson, index, null))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <Button
                    variant="link"
                    onClick={onCancel}
                    className="ap-text-gray-600 hover:ap-text-gray-900"
                >
                    ← Back to Courses
                </Button>
                
                {course?.id && (
                    <div className="ap-text-sm ap-text-gray-400">
                        Course ID: {course.id} • {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseBuilder;
