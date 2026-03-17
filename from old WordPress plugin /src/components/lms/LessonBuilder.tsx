import React, { useState, useCallback } from 'react';
import { 
    HiOutlineCloudArrowUp, HiOutlineEye,
    HiOutlineXMark
} from 'react-icons/hi2';
import { Button } from '../ui';
import { Lesson, lmsApi } from '../../services/api-lms';
import ExcalidrawEditor from './ExcalidrawEditor';
import ExcalidrawPresentation from './ExcalidrawPresentation';
import BlockEditor from '../BlockEditor';
import HybridLessonEditor from './HybridLessonEditor';
import QuizEditor from './QuizEditor';
import QuizPlayer from './QuizPlayer';
import ErrorBoundary, { logCrash } from '../ErrorBoundary';

// Scroll cue interface for hybrid editor
interface ScrollCue {
    id: string;
    blockId: string;
    frameIndex: number;
    label?: string;
}

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

interface LessonBuilderProps {
    courseId: number;
    lesson: Lesson | null;
    permissions: LMSPermissions;
    onSave: () => void;
    onCancel: () => void;
}

type LessonType = 'content' | 'excalidraw' | 'hybrid' | 'quiz';

const LessonBuilder: React.FC<LessonBuilderProps> = ({
    courseId,
    lesson,
    permissions,
    onSave,
    onCancel,
}) => {
    // Determine initial type from lesson data
    const getInitialType = (): LessonType => {
        if (lesson?.type === 'quiz') return 'quiz';
        if (lesson?.type === 'hybrid') return 'hybrid';
        if (lesson?.type === 'excalidraw') return 'excalidraw';
        if (lesson?.excalidrawJson && lesson?.content) return 'hybrid';
        if (lesson?.excalidrawJson) return 'excalidraw';
        return 'content';
    };

    const [title, setTitle] = useState(lesson?.title || '');
    const [description, setDescription] = useState(lesson?.description || '');
    const [lessonType, setLessonType] = useState<LessonType>(getInitialType());
    const [contentJson, setContentJson] = useState<any>(
        lesson?.content ? tryParseJson(lesson.content) : undefined
    );
    const [featuredImage, setFeaturedImage] = useState(lesson?.featuredImage || '');
    const [excalidrawJson, setExcalidrawJson] = useState<string>(lesson?.excalidrawJson || '');
    const [quizData, setQuizData] = useState<string>(
        lesson?.type === 'quiz' && lesson?.content ? lesson.content : '[]'
    );
    const [scrollCues, setScrollCues] = useState<ScrollCue[]>([]);
    const [slideOrder, setSlideOrder] = useState<string[]>([]);
    const [hybridLayout, setHybridLayout] = useState<'text-left' | 'text-right'>(lesson?.hybridLayout || 'text-left');
    const [hybridSplitRatio, setHybridSplitRatio] = useState<number>(lesson?.splitRatio || (lesson as any)?.hybridSplitRatio || 0.4);
    const [estimatedTime, setEstimatedTime] = useState(lesson?.estimatedTime || '');
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    // TRANSITION STATE: When switching types, we briefly show nothing to let React reconcile
    // This prevents the "removeChild" error when Excalidraw manipulates DOM during React's reconciliation
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    // Unique key for each editor mount - changes on type switch to force fresh mount
    const [editorKey, setEditorKey] = useState(() => `editor-${getInitialType()}-${Date.now()}`);
    
    // Fetch full lesson details on mount to ensure we have content/excalidraw data
    // (The lesson object passed from list view might be a "lite" version)
    React.useEffect(() => {
        let isMounted = true;
        if (lesson?.id) {
            lmsApi.getLesson(lesson.id).then(fullLesson => {
                if (!isMounted) return;
                
                if (fullLesson.excalidrawJson) {
                    setExcalidrawJson(fullLesson.excalidrawJson);
                }
                
                if (fullLesson.scrollCues) {
                    setScrollCues(fullLesson.scrollCues);
                }
                
                if (fullLesson.slideOrder) {
                    setSlideOrder(fullLesson.slideOrder);
                }
                
                if (fullLesson.hybridLayout) {
                    setHybridLayout(fullLesson.hybridLayout);
                }
                
                if (fullLesson.splitRatio) {
                    setHybridSplitRatio(fullLesson.splitRatio);
                } else if ((fullLesson as any).hybridSplitRatio) {
                    // Backwards compatibility if needed
                     setHybridSplitRatio((fullLesson as any).hybridSplitRatio);
                }
                
                // Also ensures content is fully loaded if it was truncated
                if (fullLesson.content) {
                    if (fullLesson.type === 'quiz') {
                        setQuizData(fullLesson.content);
                    } else {
                        setContentJson(tryParseJson(fullLesson.content));
                    }
                }
            }).catch(console.error);
        }
        return () => { isMounted = false; };
    }, [lesson?.id]);

    const canManageExcalidraw = permissions.canManageExcalidraw || permissions.canModerateAll;

    // Helper to try parsing JSON
    function tryParseJson(str: string): any {
        try {
            return JSON.parse(str);
        } catch {
            return undefined;
        }
    }

    // Handle BlockNote content changes
    const handleContentChange = useCallback((content: any) => {
        setContentJson(content);
    }, []);

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Please enter a lesson title');
            return;
        }
        
        try {
            setSaving(true);
            
            // ALWAYS save content if it exists, regardless of mode (draft preservation)
            let contentToSave = '';
            // If we have valid content JSON structure or string, preserve it
            if (lessonType === 'quiz') {
                contentToSave = quizData;
            } else if (contentJson) {
                contentToSave = JSON.stringify(contentJson);
            } else if (lesson?.content && !contentJson) {
                // If we haven't touched content but it existed, keep original
                contentToSave = lesson.content;
            }

            const lessonData: Partial<Lesson> = {
                title,
                description,
                content: contentToSave,
                featuredImage: lessonType === 'content' ? featuredImage : '',
                estimatedTime,
                type: lessonType,
                hybridLayout: lessonType === 'hybrid' ? hybridLayout : undefined,
                splitRatio: lessonType === 'hybrid' ? hybridSplitRatio : undefined,
            };

            // ALWAYS save excalidraw if it exists (draft preservation)
            // If we have local state, use it. If not, don't overwrite with empty if we didn't edit it? 
            // Actually explicit state is better.
            if (excalidrawJson) {
                lessonData.excalidrawJson = excalidrawJson;
            }

            let savedLesson: Lesson;

            if (lesson?.id) {
                // Update existing lesson
                savedLesson = await lmsApi.updateLesson(lesson.id, lessonData);
                
                // Update excalidraw data separately if needed
                // We send it even if type != excalidraw to preserve it
                if (canManageExcalidraw && excalidrawJson) {
                    await lmsApi.updateLessonMeta(lesson.id, 'excalidraw', excalidrawJson);
                }
                
                // Save scroll cues for hybrid (always save to allow clearing)
                if (lessonType === 'hybrid') {
                    await lmsApi.updateLessonMeta(lesson.id, 'scrollCues', scrollCues);
                }
                
                // Save slide order for hybrid (always save to allow clearing/resetting)
                if (lessonType === 'hybrid') {
                    await lmsApi.updateLessonMeta(lesson.id, 'slideOrder', slideOrder);
                }
            } else {
                // Create new lesson
                savedLesson = await lmsApi.createLesson(courseId, lessonData);
                
                // Save excalidraw for new lesson
                if (canManageExcalidraw && excalidrawJson) {
                    await lmsApi.updateLessonMeta(savedLesson.id, 'excalidraw', excalidrawJson);
                }
                
                // Save scroll cues for hybrid
                if (lessonType === 'hybrid' && scrollCues.length > 0) {
                    await lmsApi.updateLessonMeta(savedLesson.id, 'scrollCues', scrollCues);
                }
                
                // Save slide order for hybrid
                if (lessonType === 'hybrid' && slideOrder.length > 0) {
                    await lmsApi.updateLessonMeta(savedLesson.id, 'slideOrder', slideOrder);
                }
            }
            
            onSave();
        } catch (error) {
            console.error('Failed to save lesson:', error);
            alert('Failed to save lesson. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleExcalidrawSave = (data: string) => {
        // data is already a string from the editor
        if (typeof data === 'string') {
            setExcalidrawJson(data);
        } else {
            setExcalidrawJson(JSON.stringify(data));
        }
    };

    // Preview Modal
    const renderPreview = () => {
        if (!showPreview) return null;

        return (
            <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-bg-black/50">
                <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-max-w-5xl ap-w-full ap-mx-4 ap-max-h-[90vh] ap-overflow-hidden ap-flex ap-flex-col">
                    <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-border-gray-200">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Preview: {title || 'Untitled Lesson'}</h3>
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setShowPreview(false)}
                            className="!ap-p-2 !ap-min-h-0"
                        >
                            <HiOutlineXMark className="ap-w-5 ap-h-5 ap-text-gray-500" />
                        </Button>
                    </div>
                    <div className="ap-flex-1 ap-overflow-auto ap-p-6" key={`preview-container-${lessonType}`}>
                        {lessonType === 'hybrid' ? (
                            <HybridLessonEditor
                                key={`preview-hybrid-${lessonType}`}
                                initialContent={contentJson}
                                initialExcalidraw={excalidrawJson}
                                initialCues={scrollCues}
                                initialSplitRatio={hybridSplitRatio}
                                layout={hybridLayout}
                                isEditing={false}
                                height="calc(100vh - 250px)"
                            />
                        ) : lessonType === 'content' && contentJson ? (
                            <div className="ap-prose ap-max-w-none">
                                <BlockEditor
                                    key={`preview-content-${lessonType}`}
                                    initialContent={contentJson}
                                    editable={false}
                                />
                            </div>
                        ) : lessonType === 'excalidraw' && excalidrawJson ? (
                            <div style={{ height: '500px' }}>
                                <ExcalidrawPresentation
                                    key={`preview-excalidraw-${lessonType}`}
                                    initialData={excalidrawJson}
                                    height="100%"
                                />
                            </div>
                        ) : lessonType === 'quiz' ? (
                            <QuizPlayer
                                key={`preview-quiz-${lessonType}`}
                                data={quizData}
                                onComplete={() => {}}
                            />
                        ) : (
                            <p className="ap-text-gray-500 ap-text-center ap-py-8">
                                No preview available for this lesson type
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTypeSelector = () => {
        // Type change with transition - unmount old editor, wait, mount new editor
        // This gives React time to reconcile before Excalidraw manipulates DOM
        const handleTypeChange = (newType: LessonType) => {
            if (newType === lessonType || isTransitioning) return;
            
            const newKey = `editor-${newType}-${Date.now()}`;
            console.log('[LessonBuilder] Type change:', lessonType, '->', newType, 'newKey:', newKey);
            
            // Step 1: Start transition (unmount current editor)
            setIsTransitioning(true);
            
            // Step 2: After a tick, update type and key (mount new editor)
            setTimeout(() => {
                setLessonType(newType);
                setEditorKey(newKey);
                
                // Step 3: End transition after another tick
                setTimeout(() => {
                    setIsTransitioning(false);
                }, 50);
            }, 50);
        };

        return (
            <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-3">
                <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => handleTypeChange('content')}
                    className="!ap-p-4 !ap-h-auto !ap-flex-col !ap-items-start ap-transition-all"
                    style={{
                        borderRadius: '0.75rem',
                        border: lessonType === 'content' ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                        background: lessonType === 'content' 
                            ? 'linear-gradient(to bottom right, #f5f3ff, #eff6ff)' 
                            : '#ffffff',
                        boxShadow: lessonType === 'content' 
                            ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <div className="ap-text-2xl ap-mb-2">📝</div>
                    <div className="ap-font-medium ap-text-gray-900">Text Content</div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Rich text with images</p>
                </Button>
                
                <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => canManageExcalidraw && handleTypeChange('excalidraw')}
                    disabled={!canManageExcalidraw}
                    className={`!ap-p-4 !ap-h-auto !ap-flex-col !ap-items-start ap-transition-all ${!canManageExcalidraw ? 'ap-opacity-50 ap-cursor-not-allowed' : ''}`}
                    style={{
                        borderRadius: '0.75rem',
                        border: lessonType === 'excalidraw' ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                        background: lessonType === 'excalidraw' 
                            ? 'linear-gradient(to bottom right, #f5f3ff, #eff6ff)' 
                            : '#ffffff',
                        boxShadow: lessonType === 'excalidraw' 
                            ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <div className="ap-text-2xl ap-mb-2">🎨</div>
                    <div className="ap-font-medium ap-text-gray-900">Excalidraw Only</div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Visual presentations</p>
                </Button>
                
                <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => canManageExcalidraw && handleTypeChange('hybrid')}
                    disabled={!canManageExcalidraw}
                    className={`!ap-p-4 !ap-h-auto !ap-flex-col !ap-items-start ap-transition-all ${!canManageExcalidraw ? 'ap-opacity-50 ap-cursor-not-allowed' : ''}`}
                    style={{
                        borderRadius: '0.75rem',
                        border: lessonType === 'hybrid' ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                        background: lessonType === 'hybrid' 
                            ? 'linear-gradient(to bottom right, #f5f3ff, #eff6ff)' 
                            : '#ffffff',
                        boxShadow: lessonType === 'hybrid' 
                            ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <div className="ap-text-2xl ap-mb-2">📝🎨</div>
                    <div className="ap-font-medium ap-text-gray-900">Hybrid</div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Text + Visual side-by-side</p>
                </Button>

                <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => handleTypeChange('quiz')}
                    className="!ap-p-4 !ap-h-auto !ap-flex-col !ap-items-start ap-transition-all"
                    style={{
                        borderRadius: '0.75rem',
                        border: lessonType === 'quiz' ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                        background: lessonType === 'quiz' 
                            ? 'linear-gradient(to bottom right, #f5f3ff, #eff6ff)' 
                            : '#ffffff',
                        boxShadow: lessonType === 'quiz' 
                            ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <div className="ap-text-2xl ap-mb-2">✅</div>
                    <div className="ap-font-medium ap-text-gray-900">Quiz / Test</div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Assignments & Assessments</p>
                </Button>
            </div>
        );
    };

    const renderContentEditor = () => {
        console.log('[LessonBuilder] Rendering editor for type:', lessonType, 'key:', editorKey, 'transitioning:', isTransitioning);
        
        // During transition, render nothing - gives React time to reconcile
        if (isTransitioning) {
            return (
                <div className="ap-flex ap-items-center ap-justify-center ap-h-64 ap-bg-gray-50 ap-rounded-lg">
                    <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
                </div>
            );
        }
        
        // Render only the active editor type with a unique key
        return (
            <>
                {/* Content/BlockNote Editor */}
                {lessonType === 'content' && (
                    <div key={editorKey}>
                        <div className="ap-space-y-4">
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Lesson Content
                                </label>
                                <p className="ap-text-xs ap-text-gray-500 ap-mb-3">
                                    Use "/" to insert blocks, drag to reorder, and format with the toolbar.
                                </p>
                                <ErrorBoundary 
                                    componentName="BlockEditor" 
                                    onError={(err) => logCrash('BlockEditor', err, { lessonId: lesson?.id, hasContent: !!contentJson })}
                                >
                                    <BlockEditor
                                        initialContent={contentJson}
                                        onChange={handleContentChange}
                                        editable={true}
                                    />
                                </ErrorBoundary>
                            </div>
                            
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Featured Image URL (optional)
                                </label>
                                <input
                                    type="url"
                                    value={featuredImage}
                                    onChange={(e) => setFeaturedImage(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Excalidraw Editor */}
                {lessonType === 'excalidraw' && (
                    <div key={editorKey}>
                        <div className="ap-space-y-4">
                            <p className="ap-text-sm ap-text-gray-600">
                                Create visual slides using Excalidraw. Use the Frame tool (F) to create slides for presentations.
                            </p>
                            <div style={{ height: '600px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                <ErrorBoundary 
                                    componentName="ExcalidrawEditor" 
                                    onError={(err) => logCrash('ExcalidrawEditor', err, { lessonId: lesson?.id, hasInitialData: !!excalidrawJson })}
                                >
                                    <ExcalidrawEditor
                                        lessonId={lesson?.id || 0}
                                        initialData={excalidrawJson || undefined}
                                        onSave={handleExcalidrawSave}
                                        onChange={handleExcalidrawSave}
                                        onStartPresentation={() => setShowPreview(true)}
                                    />
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>
                )}
            
                {/* Hybrid Editor */}
                {lessonType === 'hybrid' && (
                    <div key={editorKey}>
                        <div className="ap-space-y-4">
                            <p className="ap-text-sm ap-text-gray-600">
                                Create rich text content alongside visual slides. Use scroll cues to sync text with slides.
                            </p>
                            <ErrorBoundary 
                                componentName="HybridLessonEditor" 
                                onError={(err) => logCrash('HybridLessonEditor', err, { lessonId: lesson?.id, hasContent: !!contentJson, hasExcalidraw: !!excalidrawJson })}
                            >
                                <HybridLessonEditor
                                    initialContent={contentJson}
                                    initialExcalidraw={excalidrawJson || undefined}
                                    initialCues={scrollCues}
                                    initialSlideOrder={slideOrder}
                                    initialSplitRatio={hybridSplitRatio}
                                    layout={hybridLayout}
                                    onContentChange={(content) => setContentJson(content)}
                                    onExcalidrawChange={(data) => setExcalidrawJson(data)}
                                    onCuesChange={(cues) => setScrollCues(cues)}
                                    onSlideOrderChange={(order) => setSlideOrder(order)}
                                    onSplitRatioChange={(ratio) => setHybridSplitRatio(ratio)}
                                    onLayoutChange={(newLayout) => setHybridLayout(newLayout)}
                                    isEditing={true}
                                    height="calc(100vh - 300px)"
                                />
                            </ErrorBoundary>
                        </div>
                    </div>
                )}

                {/* Quiz Editor */}
                {lessonType === 'quiz' && (
                    <div key={editorKey}>
                        <div className="ap-space-y-4">
                            <p className="ap-text-sm ap-text-gray-600">
                                Build your quiz by adding questions and answers. You can set correct answers and add images for context.
                            </p>
                            <ErrorBoundary 
                                componentName="QuizEditor" 
                                onError={(err) => logCrash('QuizEditor', err, { lessonId: lesson?.id, quizDataLength: quizData?.length })}
                            >
                                <QuizEditor
                                    value={quizData}
                                    onChange={(data) => setQuizData(data)}
                                />
                            </ErrorBoundary>
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="ap-space-y-6">
            {renderPreview()}
            
            {/* Single-page layout - no tabs */}
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-100 ap-flex ap-items-center ap-justify-between">
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                        {lesson ? 'Edit Lesson' : 'New Lesson'}
                    </h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                        className="!ap-border-purple-200 hover:!ap-border-purple-400 hover:!ap-bg-purple-50 !ap-text-purple-700"
                    >
                        <HiOutlineEye className="ap-w-4 ap-h-4 ap-mr-1" />
                        Preview
                    </Button>
                </div>

                <div className="ap-p-6 ap-space-y-6">
                    {/* Basic Info Section */}
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                        {/* Title */}
                        <div className="md:ap-col-span-2">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Lesson Title *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter lesson title..."
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
                                placeholder="Brief description..."
                                rows={2}
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>

                        {/* Estimated Time */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Estimated Time
                            </label>
                            <input
                                type="text"
                                value={estimatedTime}
                                onChange={(e) => setEstimatedTime(e.target.value)}
                                placeholder="e.g., 10 min"
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>
                    </div>

                    {/* Lesson Type Selector */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Lesson Type
                        </label>
                        {renderTypeSelector()}
                    </div>

                    {/* Divider */}
                    <hr className="ap-border-gray-200" />

                    {/* Content Editor Based on Type */}
                    <div>
                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">
                            {lessonType === 'content' && '📝 Content Editor'}
                            {lessonType === 'excalidraw' && '🎨 Excalidraw Editor'}
                            {lessonType === 'hybrid' && '📝🎨 Hybrid Editor'}
                        </h3>
                        {renderContentEditor()}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="!ap-text-gray-600 hover:!ap-text-purple-700 hover:!ap-bg-purple-50"
                >
                    ← Back
                </Button>
                <div className="ap-flex ap-items-center ap-gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowPreview(true)}
                        className="!ap-border-purple-200 hover:!ap-border-purple-400 hover:!ap-bg-purple-50 !ap-text-purple-700"
                    >
                        <HiOutlineEye className="ap-w-4 ap-h-4 ap-mr-1" />
                        Preview
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving || !title.trim()}
                    >
                        <HiOutlineCloudArrowUp className="ap-w-4 ap-h-4 ap-mr-1" />
                        {saving ? 'Saving...' : (lesson ? 'Save Changes' : 'Create Lesson')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default LessonBuilder;
