/**
 * Page Editor Component - Notion-like Experience
 * 
 * A unified editor that can handle:
 * - Rich text content (BlockNote)
 * - Excalidraw whiteboard
 * - Mixed content with inline videos
 * - Page linking and subpages
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Whiteboard } from '../whiteboard/Whiteboard';
import type { WhiteboardData as ExcalidrawWhiteboardData } from '../whiteboard/types';
import {
    HiOutlineDocumentText,
    HiOutlinePencilSquare,
    HiOutlineCloudArrowUp,
    HiOutlineCheck,
    HiOutlineExclamationCircle,
    HiOutlineFolderPlus,
    HiOutlineArrowsPointingOut,
    HiOutlineArrowsPointingIn,
} from 'react-icons/hi2';
import type { CoursePage, PageContent, WhiteboardData, PageType } from './types';
import InlineVideoPlayer from './InlineVideoPlayer';

// ============================================================================
// TYPES
// ============================================================================

export interface PageEditorProps {
    page: CoursePage;
    content: PageContent | null;
    isEditing: boolean;
    onSave: (content: Partial<PageContent>) => Promise<void>;
    onTitleChange: (title: string) => void;
    onIconChange: (icon: string | null) => void;
    onPageTypeChange: (type: PageType) => void;
    onAddSubpage: () => void;
    className?: string;
}

type EditorMode = 'content' | 'whiteboard' | 'split';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PageEditor: React.FC<PageEditorProps> = ({
    page,
    content,
    isEditing,
    onSave,
    onTitleChange,
    onIconChange,
    onPageTypeChange,
    onAddSubpage,
    className = '',
}) => {
    // Editor state
    const [editorMode, setEditorMode] = useState<EditorMode>(
        page.page_type === 'whiteboard' ? 'whiteboard' : 
        page.page_type === 'mixed' ? 'split' : 'content'
    );
    const [title, setTitle] = useState(page.title);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [whiteboardData, setWhiteboardData] = useState<WhiteboardData | null>(
        content?.whiteboard_data || null
    );
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // Video modal state
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    
    // Refs
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const whiteboardDataRef = useRef<WhiteboardData | null>(whiteboardData);
    const isEditingRef = useRef(isEditing);
    const onSaveRef = useRef(onSave);
    
    // Keep refs in sync
    whiteboardDataRef.current = whiteboardData;
    isEditingRef.current = isEditing;
    onSaveRef.current = onSave;
    
    // Memoize initial content to prevent re-parsing on every render
    const initialContent = useMemo(() => {
        if (content?.content_json) {
            try {
                return JSON.parse(content.content_json);
            } catch {
                return undefined;
            }
        }
        return undefined;
    }, [content?.content_json]);
    
    // BlockNote editor - only created once per component mount
    const editor = useCreateBlockNote({
        initialContent,
    });
    
    // Use ref to access editor in callbacks without causing re-renders
    const editorRef = useRef(editor);
    editorRef.current = editor;
    
    // Trigger auto-save (stable function, uses refs)
    const triggerAutoSave = useCallback(() => {
        if (!isEditingRef.current) return;
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await onSaveRef.current({
                    content_json: JSON.stringify(editorRef.current.document),
                    whiteboard_data: whiteboardDataRef.current,
                });
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                console.error('Auto-save failed:', error);
                setSaveStatus('error');
            }
        }, 1500);
    }, []); // No dependencies - uses refs
    
    // Handle BlockNote content change
    const handleContentChange = useCallback(() => {
        triggerAutoSave();
    }, [triggerAutoSave]);
    
    // Handle whiteboard change - stable callback that doesn't cause re-renders
    const handleWhiteboardChange = useCallback((data: ExcalidrawWhiteboardData) => {
        if (!isEditingRef.current) return;
        
        setWhiteboardData({ 
            elements: data.elements as WhiteboardData['elements'],
            appState: data.appState,
            files: data.files,
        });
        // Don't call triggerAutoSave here - it will be called via useEffect
    }, []); // No dependencies - uses refs
    
    // Auto-save when whiteboard data changes (debounced via the triggerAutoSave timeout)
    const isFirstRender = useRef(true);
    useEffect(() => {
        // Skip auto-save on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        
        if (whiteboardData && isEditing) {
            triggerAutoSave();
        }
    }, [whiteboardData, isEditing, triggerAutoSave]);
    
    // Handle title change
    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        onTitleChange(newTitle);
    };
    
    // Add video to whiteboard
    const handleAddVideo = useCallback(() => {
        if (!videoUrl) return;
        
        // Create a video element for the whiteboard
        // Since Excalidraw doesn't natively support video, we'll use an iframe element
        const newElement = {
            id: `video-${Date.now()}`,
            type: 'iframe',
            x: 100,
            y: 100,
            width: 560,
            height: 315,
            link: { url: videoUrl },
            customData: { videoUrl, type: 'video' },
            groupIds: [],
            frameId: null,
            roundness: null,
        };
        
        setWhiteboardData(prev => ({
            elements: [...(prev?.elements || []), newElement] as WhiteboardData['elements'],
        }));
        
        setShowVideoModal(false);
        setVideoUrl('');
    }, [videoUrl]);
    
    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        
        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    };
    
    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);
    
    // ========================================================================
    // RENDER
    // ========================================================================
    
    return (
        <div 
            ref={containerRef}
            className={`flex flex-col h-full bg-white ${className}`}
        >
            {/* Page Header */}
            <header className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        {/* Icon picker button */}
                        <button
                            onClick={() => {/* TODO: icon picker */}}
                            className="text-2xl hover:bg-gray-100 p-1 rounded transition-colors"
                        >
                            {page.icon || '📄'}
                        </button>
                        
                        {/* Editable title */}
                        {isEditing ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                className="text-2xl font-bold border-none outline-none bg-transparent flex-1 focus:ring-2 focus:ring-purple-500 rounded px-2"
                                placeholder="Untitled"
                            />
                        ) : (
                            <h1 className="text-2xl font-bold">{title || 'Untitled'}</h1>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Save status indicator */}
                        <AnimatePresence mode="wait">
                            {saveStatus !== 'idle' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex items-center gap-1.5 text-sm"
                                >
                                    {saveStatus === 'saving' && (
                                        <>
                                            <HiOutlineCloudArrowUp className="w-4 h-4 text-gray-400 animate-pulse" />
                                            <span className="text-gray-500">Saving...</span>
                                        </>
                                    )}
                                    {saveStatus === 'saved' && (
                                        <>
                                            <HiOutlineCheck className="w-4 h-4 text-green-500" />
                                            <span className="text-green-600">Saved</span>
                                        </>
                                    )}
                                    {saveStatus === 'error' && (
                                        <>
                                            <HiOutlineExclamationCircle className="w-4 h-4 text-red-500" />
                                            <span className="text-red-600">Save failed</span>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* Mode toggle */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setEditorMode('content')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    editorMode === 'content' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <HiOutlineDocumentText className="w-4 h-4 inline mr-1" />
                                Content
                            </button>
                            <button
                                onClick={() => setEditorMode('whiteboard')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    editorMode === 'whiteboard' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <HiOutlinePencilSquare className="w-4 h-4 inline mr-1" />
                                Whiteboard
                            </button>
                            <button
                                onClick={() => setEditorMode('split')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    editorMode === 'split' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Split
                            </button>
                        </div>
                        
                        {/* Fullscreen toggle */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {isFullscreen ? (
                                <HiOutlineArrowsPointingIn className="w-5 h-5" />
                            ) : (
                                <HiOutlineArrowsPointingOut className="w-5 h-5" />
                            )}
                        </button>
                        
                        {/* Add subpage */}
                        {isEditing && (
                            <button
                                onClick={onAddSubpage}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                            >
                                <HiOutlineFolderPlus className="w-4 h-4" />
                                Add Subpage
                            </button>
                        )}
                    </div>
                </div>
            </header>
            
            {/* Editor content - Single instance approach to avoid tiptap remounting issues */}
            <div className="flex-1 min-h-0 overflow-hidden flex">
                {/* Content panel - shown in content and split mode */}
                <div 
                    className={`
                        h-full overflow-auto p-6 transition-all duration-200
                        ${editorMode === 'whiteboard' ? 'hidden' : ''}
                        ${editorMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'}
                    `}
                >
                    <div className={editorMode === 'split' ? 'max-w-none' : 'max-w-4xl mx-auto'}>
                        <BlockNoteView
                            editor={editor}
                            editable={isEditing}
                            onChange={handleContentChange}
                            theme="light"
                        />
                    </div>
                </div>
                
                {/* Whiteboard panel - shown in whiteboard and split mode */}
                <div 
                    className={`
                        h-full transition-all duration-200
                        ${editorMode === 'content' ? 'hidden' : ''}
                        ${editorMode === 'split' ? 'w-1/2' : 'w-full'}
                    `}
                >
                    <Whiteboard
                        data={whiteboardData ? {
                            elements: whiteboardData.elements || [],
                            appState: whiteboardData.appState || { viewBackgroundColor: '#ffffff' },
                            files: whiteboardData.files || {},
                        } : undefined}
                        onChange={handleWhiteboardChange}
                        readOnly={!isEditing}
                    />
                </div>
            </div>
            
            {/* Video URL Modal */}
            <AnimatePresence>
                {showVideoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                        onClick={() => setShowVideoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-4">Add Video</h3>
                            <input
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="Paste YouTube, Vimeo, or video URL..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                autoFocus
                            />
                            
                            {/* Preview */}
                            {videoUrl && (
                                <div className="mt-4">
                                    <InlineVideoPlayer url={videoUrl} />
                                </div>
                            )}
                            
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => setShowVideoModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddVideo}
                                    disabled={!videoUrl}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add to Whiteboard
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PageEditor;
