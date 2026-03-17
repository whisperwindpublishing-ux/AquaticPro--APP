/**
 * ExcalidrawPresentation.tsx
 * 
 * A guided slideshow component using Excalidraw's Frames feature.
 * Frames act as "slides" that can be navigated programmatically.
 * Supports audio narration with auto-advance cues.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import { Button } from '../ui';
import '@excalidraw/excalidraw/index.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineArrowsPointingOut,
    HiOutlineArrowsPointingIn,
    HiOutlinePlay,
    HiOutlinePause,
    HiOutlineSpeakerWave,
    HiOutlineSpeakerXMark,
    HiOutlineViewfinderCircle,
} from 'react-icons/hi2';

// Excalidraw API type
type ExcalidrawAPI = {
    getSceneElements: () => ExcalidrawElementBase[];
    scrollToContent: (element?: ExcalidrawElementBase, options?: { fitToViewport?: boolean; animate?: boolean; duration?: number }) => void;
    getAppState: () => any;
    getFiles: () => any;
    updateScene: (data: any) => void;
    addFiles: (files: any[]) => void;
};

// Excalidraw element type
interface ExcalidrawElementBase {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
}

// Set asset path - use local plugin assets for fonts and icons
if (typeof window !== 'undefined') {
    const excalidrawPath = (window as any).aquaticProSettings?.excalidrawAssetPath;
    if (excalidrawPath) {
        (window as any).EXCALIDRAW_ASSET_PATH = excalidrawPath;
    } else {
        // Fallback to CDN if path not set
        console.warn('[ExcalidrawPresentation] Local asset path not found, using CDN fallback');
        (window as any).EXCALIDRAW_ASSET_PATH = 'https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/';
    }
}

interface Frame {
    id: string;
    name: string;
    element: ExcalidrawElementBase;
}

interface AudioCue {
    timestamp: number; // seconds
    frameId: string;
}

interface ExcalidrawPresentationProps {
    /** Excalidraw scene JSON (from _ap_excalidraw_json meta) */
    initialData: string | object | null;
    /** Optional audio file URL for narrated presentations */
    audioUrl?: string;
    /** Audio cues to auto-advance slides */
    audioCues?: AudioCue[];
    /** Callback when presentation completes */
    onComplete?: () => void;
    /** Callback when presentation is ready/loaded */
    onReady?: () => void;
    /** Custom class for container */
    className?: string;
    /** Height of the presentation area */
    height?: string;
    /** Show frame/slide names */
    showSlideNames?: boolean;
}

const ExcalidrawPresentation: React.FC<ExcalidrawPresentationProps> = ({
    initialData,
    audioUrl,
    audioCues = [],
    onComplete,
    onReady,
    className = '',
    height = '500px',
    showSlideNames = true,
}) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Audio ref for narrated presentations
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Parse initial data
    const parsedInitialData = useMemo(() => {
        if (!initialData) return null;
        
        try {
            if (typeof initialData === 'string') {
                return JSON.parse(initialData);
            }
            return initialData;
        } catch (e) {
            console.error('[ExcalidrawPresentation] Failed to parse initial data:', e);
            setError('Failed to load presentation data');
            return null;
        }
    }, [initialData]);

    // Extract frames from scene elements
    useEffect(() => {
        if (!excalidrawAPI || !parsedInitialData) return;

        // Ensure scene is loaded if it looks empty
        const currentElements = excalidrawAPI.getSceneElements();
        if (currentElements.length === 0) {
            excalidrawAPI.updateScene(parsedInitialData);
        }
        
        // Files must ALWAYS be added via addFiles API - even when initialData is passed,
        // Excalidraw doesn't always register the files properly for rendering
        // The files object format is { [fileId]: { id, dataURL, mimeType, created } }
        if (parsedInitialData.files && typeof parsedInitialData.files === 'object') {
            const filesArray = Object.values(parsedInitialData.files);
            if (filesArray.length > 0) {
                console.log('[ExcalidrawPresentation] Adding', filesArray.length, 'files to scene');
                excalidrawAPI.addFiles(filesArray);
            }
        }

        // Give it a tick to render
        setTimeout(() => {
            const elements = excalidrawAPI.getSceneElements();
            const frameElements = elements.filter(
                (el: ExcalidrawElementBase) => el.type === 'frame'
            );

            // Sort frames by their x position (left to right)
            const sortedFrames: Frame[] = frameElements
                .map((el: ExcalidrawElementBase) => ({
                    id: el.id,
                    name: (el as any).name || `Slide ${frameElements.indexOf(el) + 1}`,
                    element: el,
                }))
                .sort((a: Frame, b: Frame) => a.element.x - b.element.x);

            setFrames(sortedFrames);
            setIsLoading(false);
            if (onReady) onReady();

            // Auto-zoom to first frame if exists, otherwise fit all content
            // Use a longer delay to ensure Excalidraw viewport is fully initialized
            const focusDelay = 350; // Increased for Safari compatibility
            if (sortedFrames.length > 0) {
                // Must wait for viewport to be ready
                setTimeout(() => {
                    // Use sortedFrames DIRECTLY to avoid state closure issues with goToFrame
                    const firstFrame = sortedFrames[0];
                    excalidrawAPI.scrollToContent(firstFrame.element, {
                        fitToViewport: true,
                        animate: false, // Instant visual update
                    });
                    setCurrentFrameIndex(0);
                }, focusDelay);
            } else {
                // No frames - scroll to fit all content
                setTimeout(() => {
                    excalidrawAPI.scrollToContent(undefined, {
                        fitToViewport: true,
                        animate: false,
                    });
                }, focusDelay);
            }
        }, 100);
    }, [excalidrawAPI, parsedInitialData]);

    // Fit all content (for free exploration mode)
    const fitToContent = useCallback(() => {
        if (!excalidrawAPI) return;
        excalidrawAPI.scrollToContent(undefined, {
            fitToViewport: true,
            animate: true,
            duration: 300,
        });
    }, [excalidrawAPI]);

    // Navigate to a specific frame
    const goToFrame = useCallback((index: number) => {
        if (!excalidrawAPI || frames.length === 0) return;
        
        const targetIndex = Math.max(0, Math.min(index, frames.length - 1));
        const targetFrame = frames[targetIndex];
        
        if (targetFrame) {
            excalidrawAPI.scrollToContent(targetFrame.element, {
                fitToViewport: true,
                animate: true,
                duration: 300,
            });
            setCurrentFrameIndex(targetIndex);
        }
    }, [excalidrawAPI, frames]);

    // Navigation handlers
    const goToPrevious = useCallback(() => {
        if (currentFrameIndex > 0) {
            goToFrame(currentFrameIndex - 1);
        }
    }, [currentFrameIndex, goToFrame]);

    const goToNext = useCallback(() => {
        if (currentFrameIndex < frames.length - 1) {
            goToFrame(currentFrameIndex + 1);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentFrameIndex, frames.length, goToFrame, onComplete]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                goToPrevious();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                goToNext();
            } else if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToPrevious, goToNext, isFullscreen]);

    // Audio playback and auto-advance
    useEffect(() => {
        if (!audioRef.current || !audioUrl) return;

        const audio = audioRef.current;

        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime;
            
            // Find the cue that should be active
            const activeCue = [...audioCues]
                .reverse()
                .find((cue) => currentTime >= cue.timestamp);

            if (activeCue) {
                const frameIndex = frames.findIndex((f) => f.id === activeCue.frameId);
                if (frameIndex !== -1 && frameIndex !== currentFrameIndex) {
                    goToFrame(frameIndex);
                }
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            if (onComplete) onComplete();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl, audioCues, frames, currentFrameIndex, goToFrame, onComplete]);

    // Play/pause audio
    const togglePlayback = useCallback(() => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            if (containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (error) {
        return (
            <div className={`ap-flex ap-items-center ap-justify-center ap-bg-gray-100 ap-rounded-lg ${className}`} style={{ height }}>
                <div className="ap-text-center ap-text-gray-500">
                    <p className="ap-text-lg ap-font-medium">Unable to load presentation</p>
                    <p className="ap-text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!parsedInitialData) {
        return (
            <div className={`ap-flex ap-items-center ap-justify-center ap-bg-gray-100 ap-rounded-lg ${className}`} style={{ height }}>
                <div className="ap-text-center ap-text-gray-500">
                    <p className="ap-text-lg ap-font-medium">No presentation data</p>
                    <p className="ap-text-sm">This lesson doesn't have a visual presentation yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={`ap-relative ap-bg-white ap-rounded-lg ap-shadow-lg ap-overflow-hidden ${className} ${isFullscreen ? 'ap-fixed ap-inset-0 ap-z-50' : ''}`}
            style={{ height: isFullscreen ? '100vh' : height }}
        >
            {/* Loading overlay */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="ap-absolute ap-inset-0 ap-z-20 ap-flex ap-items-center ap-justify-center ap-bg-white"
                    >
                        <div className="ap-text-center">
                            <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600 ap-mx-auto ap-mb-4"></div>
                            <p className="ap-text-gray-600">Loading presentation...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Navigation Bar - Always visible for slide navigation */}
            {frames.length > 0 && !isLoading && (
                <div className="ap-absolute ap-top-0 ap-left-0 ap-right-0 ap-z-10 ap-bg-white/95 ap-backdrop-blur-sm ap-border-b ap-border-gray-200 ap-px-4 ap-py-2">
                    <div className="ap-flex ap-items-center ap-justify-between">
                        {/* Slide Info */}
                        <div className="ap-flex ap-items-center ap-gap-3">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={goToPrevious}
                                disabled={currentFrameIndex === 0}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600"
                                title="Previous (←)"
                            >
                                <HiOutlineChevronLeft className="ap-h-5 ap-w-5" />
                            </Button>
                            
                            <div className="ap-text-center ap-min-w-[120px]">
                                {showSlideNames && (
                                    <p className="ap-text-sm ap-font-medium ap-text-gray-900">
                                        {frames[currentFrameIndex]?.name || `Slide ${currentFrameIndex + 1}`}
                                    </p>
                                )}
                                <p className="ap-text-xs ap-text-gray-500">
                                    {currentFrameIndex + 1} of {frames.length}
                                </p>
                            </div>
                            
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={goToNext}
                                disabled={currentFrameIndex === frames.length - 1 && !onComplete}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600"
                                title="Next (→)"
                            >
                                <HiOutlineChevronRight className="ap-h-5 ap-w-5" />
                            </Button>
                        </div>

                        {/* Slide dots for quick navigation */}
                        <div className="ap-hidden sm:ap-flex ap-items-center ap-gap-1.5 ap-px-3">
                            {frames.map((_, index) => (
                                <Button
                                    key={index}
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => goToFrame(index)}
                                    className={`!ap-p-0 !ap-min-h-0 !ap-min-w-0 ap-transition-all ap-rounded-full ${
                                        index === currentFrameIndex
                                            ? 'ap-w-6 ap-h-2 ap-bg-blue-600 hover:!ap-bg-blue-700' : 'ap-w-2 ap-h-2 ap-bg-gray-300 hover:!ap-bg-gray-400'
                                    }`}
                                    title={frames[index]?.name}
                                />
                            ))}
                        </div>

                        {/* Right controls */}
                        <div className="ap-flex ap-items-center ap-gap-1">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={fitToContent}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600"
                                title="Fit to content"
                            >
                                <HiOutlineViewfinderCircle className="ap-h-5 ap-w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={toggleFullscreen}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600"
                                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            >
                                {isFullscreen ? (
                                    <HiOutlineArrowsPointingIn className="ap-h-5 ap-w-5" />
                                ) : (
                                    <HiOutlineArrowsPointingOut className="ap-h-5 ap-w-5" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Excalidraw Canvas */}
            <div className={`ap-w-full ap-h-full excalidraw-wrapper ap-relative ${frames.length > 0 && !isLoading ? 'ap-pt-12' : ''}`}>
                {/* CSS to hide UI components - only disable pointer events when we have slides to navigate */}
                <style>{`
                    .excalidraw-wrapper .App-menu_top,
                    .excalidraw-wrapper .App-bottom-bar,
                    .excalidraw-wrapper .layer-ui__wrapper {
                        display: none !important;
                    }
                    ${frames.length > 0 ? `
                    /* Disable mouse interaction with canvas when in slideshow mode */
                    .excalidraw-wrapper canvas {
                        pointer-events: none !important;
                    }
                    ` : `
                    /* Allow panning when no frames - free exploration mode */
                    .excalidraw-wrapper canvas {
                        pointer-events: auto !important;
                        cursor: grab !important;
                    }
                    .excalidraw-wrapper canvas:active {
                        cursor: grabbing !important;
                    }
                    `}
                `}</style>
                <Excalidraw
                    excalidrawAPI={(api: any) => setExcalidrawAPI(api as ExcalidrawAPI)}
                    initialData={parsedInitialData}
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
                            saveAsImage: false,
                        },
                    }}
                >
                    <MainMenu>
                        <MainMenu.DefaultItems.Help />
                    </MainMenu>
                    <WelcomeScreen>
                        <WelcomeScreen.Center>
                            <WelcomeScreen.Center.Heading>
                                AquaticPro Visual Lesson
                            </WelcomeScreen.Center.Heading>
                        </WelcomeScreen.Center>
                    </WelcomeScreen>
                </Excalidraw>
            </div>

            {/* Bottom Control Bar - Only shown for audio controls or free exploration mode */}
            {(audioUrl || frames.length === 0) && !isLoading && (
                <div className="ap-absolute ap-bottom-0 ap-left-0 ap-right-0 ap-p-4 ap-bg-gradient-to-t ap-from-black/60 ap-to-transparent">
                    <div className="ap-flex ap-items-center ap-justify-between">
                        {/* Info for free exploration mode */}
                        {frames.length === 0 && (
                            <div className="ap-text-white">
                                <p className="ap-text-sm ap-font-medium">Visual Diagram</p>
                                <p className="ap-text-xs ap-opacity-75">Drag to pan • Scroll to zoom</p>
                            </div>
                        )}
                        
                        {/* Spacer when audio only */}
                        {frames.length > 0 && audioUrl && <div />}

                        {/* Controls */}
                        <div className="ap-flex ap-items-center ap-gap-2">
                            {/* Audio controls (if audio present) */}
                            {audioUrl && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={togglePlayback}
                                        className="!ap-p-2 !ap-min-h-0 ap-rounded-full ap-bg-white/20 hover:!ap-bg-white/30 ap-text-white"
                                        title={isPlaying ? 'Pause' : 'Play'}
                                    >
                                        {isPlaying ? (
                                            <HiOutlinePause className="ap-h-5 ap-w-5" />
                                        ) : (
                                            <HiOutlinePlay className="ap-h-5 ap-w-5" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={toggleMute}
                                        className="!ap-p-2 !ap-min-h-0 ap-rounded-full ap-bg-white/20 hover:!ap-bg-white/30 ap-text-white"
                                        title={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted ? (
                                            <HiOutlineSpeakerXMark className="ap-h-5 ap-w-5" />
                                        ) : (
                                            <HiOutlineSpeakerWave className="ap-h-5 ap-w-5" />
                                        )}
                                    </Button>
                                </>
                            )}

                            {/* Free exploration mode controls */}
                            {frames.length === 0 && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={fitToContent}
                                        className="!ap-p-2 !ap-min-h-0 ap-rounded-full ap-bg-white/20 hover:!ap-bg-white/30 ap-text-white"
                                        title="Fit to content"
                                    >
                                        <HiOutlineViewfinderCircle className="ap-h-5 ap-w-5" />
                                    </Button>
                                    <div className="ap-w-px ap-h-6 ap-bg-white/30 ap-mx-1" />
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={toggleFullscreen}
                                        className="!ap-p-2 !ap-min-h-0 ap-rounded-full ap-bg-white/20 hover:!ap-bg-white/30 ap-text-white"
                                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                                    >
                                        {isFullscreen ? (
                                            <HiOutlineArrowsPointingIn className="ap-h-5 ap-w-5" />
                                        ) : (
                                            <HiOutlineArrowsPointingOut className="ap-h-5 ap-w-5" />
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden audio element */}
            {audioUrl && (
                <audio ref={audioRef} src={audioUrl} preload="metadata" />
            )}
        </div>
    );
};

export default ExcalidrawPresentation;
