/**
 * Whiteboard Presentation Component
 * 
 * Multi-slide whiteboard with presentation-style navigation.
 * Each slide is an independent Excalidraw canvas.
 * Integrates with WordPress media library for image insertion.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineCloudArrowUp,
    HiOutlineCheck,
    HiOutlineExclamationCircle,
    HiOutlineBars3,
    HiOutlinePlayCircle,
    HiOutlineXCircle,
    HiOutlinePencil,
    HiOutlineEye,
    HiOutlineViewColumns,
    HiOutlinePhoto,
    HiOutlineFilm,
    HiOutlineLink,
    HiOutlineXMark,
} from 'react-icons/hi2';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WhiteboardData } from './types';

// Use any for Excalidraw internal types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

// ============================================================================
// TYPES
// ============================================================================

export interface WhiteboardSlide {
    id: string;
    title: string;
    data: WhiteboardData;
    thumbnailUrl?: string;
}

export interface WhiteboardPresentationProps {
    slides: WhiteboardSlide[];
    readOnly?: boolean;
    onSlidesChange?: (slides: WhiteboardSlide[]) => void;
    onSave?: (slides: WhiteboardSlide[]) => Promise<void>;
    className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ============================================================================
// SORTABLE SLIDE THUMBNAIL
// ============================================================================

interface SlideThumbnailProps {
    slide: WhiteboardSlide;
    index: number;
    isActive: boolean;
    onClick: () => void;
    onDelete?: () => void;
    readOnly: boolean;
}

const SlideThumbnail: React.FC<SlideThumbnailProps> = ({
    slide,
    index,
    isActive,
    onClick,
    onDelete,
    readOnly,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: slide.id, disabled: readOnly });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative flex-shrink-0 w-32 cursor-pointer group
                ${isDragging ? 'z-10' : ''}
            `}
        >
            {/* Drag handle */}
            {!readOnly && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute -top-1 left-1/2 -translate-x-1/2 p-1 bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab z-10"
                >
                    <HiOutlineBars3 className="w-3 h-3 text-gray-600" />
                </div>
            )}
            
            {/* Thumbnail */}
            <div
                onClick={onClick}
                className={`
                    aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all
                    ${isActive 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }
                `}
            >
                {slide.thumbnailUrl ? (
                    <img 
                        src={slide.thumbnailUrl} 
                        alt={slide.title}
                        className="w-full h-full object-cover bg-white"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-300">{index + 1}</span>
                    </div>
                )}
            </div>
            
            {/* Slide number */}
            <div className="mt-1 flex items-center justify-between">
                <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                    {index + 1}
                </span>
                {!readOnly && onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// PRESENTATION MODE (FULLSCREEN)
// ============================================================================

interface PresentationModeProps {
    slides: WhiteboardSlide[];
    startIndex: number;
    onClose: () => void;
}

const PresentationMode: React.FC<PresentationModeProps> = ({
    slides,
    startIndex,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    
    const currentSlide = slides[currentIndex];
    
    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowRight':
                case 'Space':
                case 'Enter':
                    if (currentIndex < slides.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                    }
                    break;
                case 'ArrowLeft':
                case 'Backspace':
                    if (currentIndex > 0) {
                        setCurrentIndex(prev => prev - 1);
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
                case 'Home':
                    setCurrentIndex(0);
                    break;
                case 'End':
                    setCurrentIndex(slides.length - 1);
                    break;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, slides.length, onClose]);
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
        >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="text-white/80 text-sm">
                    {currentSlide.title || `Slide ${currentIndex + 1}`}
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-white/80 text-sm">
                        {currentIndex + 1} / {slides.length}
                    </span>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <HiOutlineXCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>
            
            {/* Slide content */}
            <div className="flex-1 relative excalidraw-wrapper">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0"
                    >
                        <Excalidraw
                            initialData={{
                                elements: currentSlide.data.elements || [],
                                appState: {
                                    ...currentSlide.data.appState,
                                    viewBackgroundColor: currentSlide.data.appState?.viewBackgroundColor || '#ffffff',
                                },
                                files: currentSlide.data.files || {},
                            }}
                            viewModeEnabled={true}
                            zenModeEnabled={true}
                            gridModeEnabled={false}
                            theme="light"
                            UIOptions={{
                                canvasActions: {
                                    changeViewBackgroundColor: false,
                                    clearCanvas: false,
                                    export: false,
                                    loadScene: false,
                                    saveToActiveFile: false,
                                    toggleTheme: false,
                                },
                            }}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {/* Navigation arrows */}
            {currentIndex > 0 && (
                <button
                    onClick={() => setCurrentIndex(prev => prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <HiOutlineChevronLeft className="w-8 h-8" />
                </button>
            )}
            {currentIndex < slides.length - 1 && (
                <button
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <HiOutlineChevronRight className="w-8 h-8" />
                </button>
            )}
            
            {/* Progress dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentIndex 
                                ? 'w-8 bg-white' 
                                : 'bg-white/40 hover:bg-white/60'
                        }`}
                    />
                ))}
            </div>
        </motion.div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const WhiteboardPresentation: React.FC<WhiteboardPresentationProps> = ({
    slides: initialSlides,
    readOnly = false,
    onSlidesChange,
    onSave,
    className = '',
}) => {
    const [slides, setSlides] = useState<WhiteboardSlide[]>(
        initialSlides.length > 0 ? initialSlides : [{
            id: `slide-${Date.now()}`,
            title: 'Slide 1',
            data: { elements: [] },
        }]
    );
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [showSidebar, setShowSidebar] = useState(true);
    const [presentationMode, setPresentationMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    
    const saveTimeoutRef = useRef<NodeJS.Timeout>();
    const currentSlide = slides[currentSlideIndex];
    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    // Generate thumbnail for a slide
    const generateThumbnail = useCallback(async (): Promise<string | null> => {
        if (!excalidrawAPI) return null;
        
        try {
            const blob = await exportToBlob({
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles(),
                mimeType: 'image/png',
                exportPadding: 10,
                getDimensions: () => ({ width: 320, height: 240, scale: 1 }),
            });
            
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Failed to generate thumbnail:', error);
            return null;
        }
    }, [excalidrawAPI]);
    
    // Save current slide data before switching
    const saveCurrentSlideData = useCallback(async () => {
        if (!excalidrawAPI || readOnly) return;
        
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const thumbnail = await generateThumbnail();
        
        const updatedSlide: WhiteboardSlide = {
            ...currentSlide,
            data: {
                elements: elements as ExcalidrawElement[],
                appState: {
                    viewBackgroundColor: appState.viewBackgroundColor,
                    zoom: appState.zoom,
                    scrollX: appState.scrollX,
                    scrollY: appState.scrollY,
                },
                files,
            },
            thumbnailUrl: thumbnail || currentSlide.thumbnailUrl,
        };
        
        const newSlides = slides.map((s, i) => 
            i === currentSlideIndex ? updatedSlide : s
        );
        
        setSlides(newSlides);
        onSlidesChange?.(newSlides);
        
        return newSlides;
    }, [excalidrawAPI, readOnly, currentSlide, slides, currentSlideIndex, generateThumbnail, onSlidesChange]);
    
    // Handle Excalidraw changes
    const handleChange = useCallback(() => {
        if (readOnly) return;
        setHasUnsavedChanges(true);
    }, [readOnly]);
    
    // Open WordPress media library and insert selected image
    const openMediaLibrary = useCallback(() => {
        if (!window.wp?.media || !excalidrawAPI) {
            console.warn('WordPress media library not available');
            return;
        }
        
        const mediaFrame = window.wp.media({
            title: 'Select Image for Whiteboard',
            library: { type: 'image' },
            multiple: false,
            button: { text: 'Insert Image' },
        });
        
        mediaFrame.on('select', async () => {
            const attachment = mediaFrame.state().get('selection').first().toJSON();
            if (!attachment?.url) return;
            
            try {
                // Fetch the image and convert to data URL for Excalidraw
                const response = await fetch(attachment.url);
                const blob = await response.blob();
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                
                // Generate unique file ID
                const fileId = `wp-media-${attachment.id}-${Date.now()}`;
                
                // Add file to Excalidraw
                const files = excalidrawAPI.getFiles();
                files[fileId] = {
                    id: fileId,
                    mimeType: attachment.subtype ? `image/${attachment.subtype}` : 'image/png',
                    dataURL: dataUrl,
                    created: Date.now(),
                };
                
                // Create image element
                const appState = excalidrawAPI.getAppState();
                const centerX = (appState.scrollX * -1) + (appState.width / 2) / appState.zoom.value;
                const centerY = (appState.scrollY * -1) + (appState.height / 2) / appState.zoom.value;
                
                // Scale image to reasonable size (max 400px)
                const maxSize = 400;
                let width = attachment.width || 300;
                let height = attachment.height || 300;
                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width *= scale;
                    height *= scale;
                }
                
                // Create image element - Excalidraw v0.18+ format
                const imageElement = {
                    id: `img-${Date.now()}`,
                    type: 'image' as const,
                    x: centerX - width / 2,
                    y: centerY - height / 2,
                    width,
                    height,
                    angle: 0,
                    strokeColor: 'transparent',
                    backgroundColor: 'transparent',
                    fillStyle: 'solid' as const,
                    strokeWidth: 0,
                    strokeStyle: 'solid' as const,
                    roughness: 0,
                    opacity: 100,
                    seed: Math.floor(Math.random() * 100000),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 100000),
                    isDeleted: false,
                    boundElements: null,
                    updated: Date.now(),
                    link: null,
                    locked: false,
                    fileId,
                    status: 'saved' as const,
                    scale: [1, 1] as [number, number],
                    groupIds: [] as string[],
                    frameId: null,
                    roundness: null,
                };
                
                // Update scene with new element and files
                const elements = excalidrawAPI.getSceneElements();
                excalidrawAPI.updateScene({
                    elements: [...elements, imageElement],
                    files,
                });
                
                // Trigger change detection
                setHasUnsavedChanges(true);
                
            } catch (error) {
                console.error('Failed to insert image:', error);
            }
        });
        
        mediaFrame.open();
    }, [excalidrawAPI]);
    
    // Open WordPress media library for videos
    const openVideoMediaLibrary = useCallback(() => {
        if (!window.wp?.media || !excalidrawAPI) {
            console.warn('WordPress media library not available');
            return;
        }
        
        const mediaFrame = window.wp.media({
            title: 'Select Video for Whiteboard',
            library: { type: 'video' },
            multiple: false,
            button: { text: 'Insert Video' },
        });
        
        mediaFrame.on('select', () => {
            const attachment = mediaFrame.state().get('selection').first().toJSON();
            if (!attachment?.url) return;
            
            insertVideoEmbed(attachment.url);
        });
        
        mediaFrame.open();
    }, [excalidrawAPI]);
    
    // Convert YouTube URL to embed URL
    const getYouTubeEmbedUrl = (url: string): string | null => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return `https://www.youtube.com/embed/${match[1]}`;
            }
        }
        return null;
    };
    
    // Convert Vimeo URL to embed URL
    const getVimeoEmbedUrl = (url: string): string | null => {
        const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (match) {
            return `https://player.vimeo.com/video/${match[1]}`;
        }
        return null;
    };
    
    // Insert video embed into canvas
    const insertVideoEmbed = useCallback((url: string) => {
        if (!excalidrawAPI) return;
        
        // Convert to embed URL if YouTube or Vimeo
        let embedUrl = url;
        const youtubeEmbed = getYouTubeEmbedUrl(url);
        const vimeoEmbed = getVimeoEmbedUrl(url);
        
        if (youtubeEmbed) {
            embedUrl = youtubeEmbed;
        } else if (vimeoEmbed) {
            embedUrl = vimeoEmbed;
        }
        
        // Get canvas center position
        const appState = excalidrawAPI.getAppState();
        const centerX = (appState.scrollX * -1) + (appState.width / 2) / appState.zoom.value;
        const centerY = (appState.scrollY * -1) + (appState.height / 2) / appState.zoom.value;
        
        // Default video size (16:9 aspect ratio)
        const width = 560;
        const height = 315;
        
        // Create embeddable element for video
        const embeddableElement = {
            id: `embed-${Date.now()}`,
            type: 'embeddable' as const,
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            angle: 0,
            strokeColor: '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'solid' as const,
            strokeWidth: 2,
            strokeStyle: 'solid' as const,
            roughness: 0,
            opacity: 100,
            seed: Math.floor(Math.random() * 100000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: embedUrl,
            locked: false,
            groupIds: [] as string[],
            frameId: null,
            roundness: null,
        };
        
        // Update scene with new element
        const elements = excalidrawAPI.getSceneElements();
        excalidrawAPI.updateScene({
            elements: [...elements, embeddableElement],
        });
        
        // Trigger change detection
        setHasUnsavedChanges(true);
        setShowVideoModal(false);
        setVideoUrl('');
    }, [excalidrawAPI]);
    
    // Handle video URL submission
    const handleVideoUrlSubmit = useCallback(() => {
        if (!videoUrl.trim()) return;
        insertVideoEmbed(videoUrl.trim());
    }, [videoUrl, insertVideoEmbed]);
    
    // Auto-save with debounce
    useEffect(() => {
        if (!hasUnsavedChanges || readOnly) return;
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(async () => {
            const updatedSlides = await saveCurrentSlideData();
            if (updatedSlides && onSave) {
                try {
                    setSaveStatus('saving');
                    await onSave(updatedSlides);
                    setSaveStatus('saved');
                    setHasUnsavedChanges(false);
                    setTimeout(() => setSaveStatus('idle'), 2000);
                } catch (error) {
                    console.error('Failed to save:', error);
                    setSaveStatus('error');
                    setTimeout(() => setSaveStatus('idle'), 3000);
                }
            }
        }, 2000);
        
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [hasUnsavedChanges, readOnly, saveCurrentSlideData, onSave]);
    
    // Switch to a different slide
    const switchToSlide = useCallback(async (index: number) => {
        if (index === currentSlideIndex) return;
        
        // Save current slide first
        await saveCurrentSlideData();
        setCurrentSlideIndex(index);
    }, [currentSlideIndex, saveCurrentSlideData]);
    
    // Add new slide
    const addSlide = useCallback(async () => {
        await saveCurrentSlideData();
        
        const newSlide: WhiteboardSlide = {
            id: `slide-${Date.now()}`,
            title: `Slide ${slides.length + 1}`,
            data: { elements: [] },
        };
        
        const newSlides = [...slides, newSlide];
        setSlides(newSlides);
        setCurrentSlideIndex(newSlides.length - 1);
        onSlidesChange?.(newSlides);
    }, [slides, saveCurrentSlideData, onSlidesChange]);
    
    // Delete slide
    const deleteSlide = useCallback(async (index: number) => {
        if (slides.length <= 1) return;
        
        const newSlides = slides.filter((_, i) => i !== index);
        setSlides(newSlides);
        
        // Adjust current index if needed
        if (currentSlideIndex >= newSlides.length) {
            setCurrentSlideIndex(newSlides.length - 1);
        } else if (index < currentSlideIndex) {
            setCurrentSlideIndex(prev => prev - 1);
        }
        
        onSlidesChange?.(newSlides);
    }, [slides, currentSlideIndex, onSlidesChange]);
    
    // Handle drag end for reordering
    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            await saveCurrentSlideData();
            
            const oldIndex = slides.findIndex(s => s.id === String(active.id));
            const newIndex = slides.findIndex(s => s.id === String(over.id));
            
            const newSlides = arrayMove(slides, oldIndex, newIndex);
            setSlides(newSlides);
            
            // Update current index to follow the moved slide
            if (oldIndex === currentSlideIndex) {
                setCurrentSlideIndex(newIndex);
            } else if (oldIndex < currentSlideIndex && newIndex >= currentSlideIndex) {
                setCurrentSlideIndex(prev => prev - 1);
            } else if (oldIndex > currentSlideIndex && newIndex <= currentSlideIndex) {
                setCurrentSlideIndex(prev => prev + 1);
            }
            
            onSlidesChange?.(newSlides);
        }
    }, [slides, currentSlideIndex, saveCurrentSlideData, onSlidesChange]);
    
    // Navigate slides
    const goToPrevious = useCallback(() => {
        if (currentSlideIndex > 0) {
            switchToSlide(currentSlideIndex - 1);
        }
    }, [currentSlideIndex, switchToSlide]);
    
    const goToNext = useCallback(() => {
        if (currentSlideIndex < slides.length - 1) {
            switchToSlide(currentSlideIndex + 1);
        }
    }, [currentSlideIndex, slides.length, switchToSlide]);
    
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            if (e.key === 'PageDown' || (e.ctrlKey && e.key === 'ArrowRight')) {
                e.preventDefault();
                goToNext();
            } else if (e.key === 'PageUp' || (e.ctrlKey && e.key === 'ArrowLeft')) {
                e.preventDefault();
                goToPrevious();
            } else if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
                e.preventDefault();
                setPresentationMode(true);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrevious]);
    
    return (
        <>
            <div className={`flex flex-col h-full min-h-0 bg-gray-100 ${className}`}>
                {/* Toolbar */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className={`p-2 rounded-lg transition-colors ${
                                showSidebar ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                            title="Toggle slide panel"
                        >
                            <HiOutlineViewColumns className="w-5 h-5" />
                        </button>
                        
                        <div className="w-px h-6 bg-gray-200 mx-2" />
                        
                        {/* Slide navigation */}
                        <button
                            onClick={goToPrevious}
                            disabled={currentSlideIndex === 0}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <HiOutlineChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-gray-600 min-w-[60px] text-center">
                            {currentSlideIndex + 1} / {slides.length}
                        </span>
                        <button
                            onClick={goToNext}
                            disabled={currentSlideIndex === slides.length - 1}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <HiOutlineChevronRight className="w-5 h-5" />
                        </button>
                        
                        {!readOnly && (
                            <>
                                <div className="w-px h-6 bg-gray-200 mx-2" />
                                <button
                                    onClick={addSlide}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    <HiOutlinePlus className="w-4 h-4" />
                                    Add Slide
                                </button>
                                
                                <button
                                    onClick={openMediaLibrary}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                    title="Insert image from WordPress Media Library"
                                >
                                    <HiOutlinePhoto className="w-4 h-4" />
                                    Media Library
                                </button>
                                
                                <button
                                    onClick={() => setShowVideoModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                    title="Embed video from YouTube or Media Library"
                                >
                                    <HiOutlineFilm className="w-4 h-4" />
                                    Video
                                </button>
                            </>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Save status */}
                        {!readOnly && (
                            <div className="flex items-center gap-2 text-sm">
                                {saveStatus === 'saving' && (
                                    <span className="flex items-center gap-1.5 text-blue-600">
                                        <HiOutlineCloudArrowUp className="w-4 h-4 animate-pulse" />
                                        Saving...
                                    </span>
                                )}
                                {saveStatus === 'saved' && (
                                    <span className="flex items-center gap-1.5 text-green-600">
                                        <HiOutlineCheck className="w-4 h-4" />
                                        Saved
                                    </span>
                                )}
                                {saveStatus === 'error' && (
                                    <span className="flex items-center gap-1.5 text-red-600">
                                        <HiOutlineExclamationCircle className="w-4 h-4" />
                                        Save failed
                                    </span>
                                )}
                            </div>
                        )}
                        
                        <div className="w-px h-6 bg-gray-200 mx-2" />
                        
                        {/* Mode indicator */}
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100">
                            {readOnly ? (
                                <>
                                    <HiOutlineEye className="w-4 h-4 text-gray-500" />
                                    <span className="text-xs text-gray-500">View</span>
                                </>
                            ) : (
                                <>
                                    <HiOutlinePencil className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs text-blue-600">Edit</span>
                                </>
                            )}
                        </div>
                        
                        {/* Present button */}
                        <button
                            onClick={async () => {
                                await saveCurrentSlideData();
                                setPresentationMode(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <HiOutlinePlayCircle className="w-4 h-4" />
                            Present
                        </button>
                    </div>
                </div>
                
                {/* Main content */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Slide sidebar */}
                    <AnimatePresence>
                        {showSidebar && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 180, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="bg-gray-50 border-r overflow-hidden flex-shrink-0"
                            >
                                <div className="p-3 h-full overflow-y-auto">
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={slides.map(s => s.id)}
                                            strategy={horizontalListSortingStrategy}
                                        >
                                            <div className="flex flex-col gap-3">
                                                {slides.map((slide, index) => (
                                                    <SlideThumbnail
                                                        key={slide.id}
                                                        slide={slide}
                                                        index={index}
                                                        isActive={index === currentSlideIndex}
                                                        onClick={() => switchToSlide(index)}
                                                        onDelete={slides.length > 1 ? () => deleteSlide(index) : undefined}
                                                        readOnly={readOnly}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                    
                                    {!readOnly && (
                                        <button
                                            onClick={addSlide}
                                            className="w-full mt-3 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <HiOutlinePlus className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {/* Canvas */}
                    <div className="flex-1 relative min-h-0 min-w-0 excalidraw-wrapper">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentSlide.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0"
                            >
                                <Excalidraw
                                    excalidrawAPI={(api) => setExcalidrawAPI(api)}
                                    initialData={{
                                        elements: currentSlide.data.elements || [],
                                        appState: {
                                            ...currentSlide.data.appState,
                                            viewBackgroundColor: currentSlide.data.appState?.viewBackgroundColor || '#ffffff',
                                        },
                                        files: currentSlide.data.files || {},
                                    }}
                                    onChange={handleChange}
                                    viewModeEnabled={readOnly}
                                    zenModeEnabled={false}
                                    gridModeEnabled={false}
                                    theme="light"
                                    UIOptions={{
                                        canvasActions: {
                                            changeViewBackgroundColor: !readOnly,
                                            clearCanvas: !readOnly,
                                            export: { saveFileToDisk: true },
                                            loadScene: false,
                                            saveToActiveFile: false,
                                            toggleTheme: false,
                                        },
                                    }}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            
            {/* Presentation mode */}
            <AnimatePresence>
                {presentationMode && (
                    <PresentationMode
                        slides={slides}
                        startIndex={currentSlideIndex}
                        onClose={() => setPresentationMode(false)}
                    />
                )}
            </AnimatePresence>
            
            {/* Video Embed Modal */}
            <AnimatePresence>
                {showVideoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setShowVideoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Embed Video</h3>
                                <button
                                    onClick={() => setShowVideoModal(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                >
                                    <HiOutlineXMark className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {/* YouTube/URL Option */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <HiOutlineLink className="w-4 h-4 inline mr-1" />
                                        Paste Video URL
                                    </label>
                                    <input
                                        type="text"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        placeholder="YouTube, Vimeo, or direct video URL"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Supports YouTube, Vimeo, and direct video links
                                    </p>
                                </div>
                                
                                <button
                                    onClick={handleVideoUrlSubmit}
                                    disabled={!videoUrl.trim()}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                                >
                                    Embed Video
                                </button>
                                
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">or</span>
                                    </div>
                                </div>
                                
                                {/* WordPress Media Library Option */}
                                <button
                                    onClick={() => {
                                        setShowVideoModal(false);
                                        openVideoMediaLibrary();
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center justify-center gap-2"
                                >
                                    <HiOutlineFilm className="w-4 h-4" />
                                    Choose from Media Library
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default WhiteboardPresentation;
