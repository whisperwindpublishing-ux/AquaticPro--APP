/**
 * HybridLessonEditor.tsx
 * 
 * A split-view editor combining BlockNote (rich text) and Excalidraw (visual).
 * Features:
 * - Side-by-side view (customizable left/right)
 * - Mobile responsive (stacked)
 * - Scroll-synced Excalidraw slides - Excalidraw stays anchored while text scrolls
 * - Cue points to auto-advance Excalidraw slides on scroll
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import BlockEditor from '../BlockEditor';
import { Button } from '../ui';

// Set asset path - use local plugin assets for fonts and icons
if (typeof window !== 'undefined') {
    const excalidrawPath = (window as any).aquaticProSettings?.excalidrawAssetPath;
    if (excalidrawPath) {
        (window as any).EXCALIDRAW_ASSET_PATH = excalidrawPath;
    } else {
        // Fallback to CDN if path not set
        console.warn('[HybridLessonEditor] Local asset path not found, using CDN fallback');
        (window as any).EXCALIDRAW_ASSET_PATH = 'https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/';
    }
}

import {
    HiOutlineArrowsRightLeft,
    HiOutlineDevicePhoneMobile,
    HiOutlineComputerDesktop,
    HiOutlineTrash,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineBookmarkSquare,
    HiOutlineArrowsPointingOut,
    HiOutlineArrowsPointingIn,
    HiOutlineBars3,
    HiOutlineQueueList,
    HiOutlineXMark,
    HiOutlineViewfinderCircle,
    HiOutlineFolderOpen,
} from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';

// Excalidraw API type
type ExcalidrawAPI = {
    getSceneElements: () => any[];
    getAppState: () => any;
    getFiles: () => any;
    scrollToContent: (element?: any, options?: any) => void;
    updateScene: (data: any) => void;
    addFiles: (files: any[]) => void;
};

// Frame/slide type
interface Frame {
    id: string;
    name: string;
    element: any;
}

// Scroll cue - triggers slide change when user scrolls to this point
interface ScrollCue {
    id: string;
    blockId: string; // Block ID in BlockNote to anchor to
    frameIndex: number; // Which Excalidraw frame to show
    label?: string;
}

interface HybridLessonEditorProps {
    /** Initial BlockNote content (JSON) */
    initialContent?: any;
    /** Initial Excalidraw data (JSON string or object) */
    initialExcalidraw?: string | object | null;
    /** Initial scroll cues */
    initialCues?: ScrollCue[];
    /** Initial slide order (array of frame IDs) */
    initialSlideOrder?: string[];
    /** Initial split ratio (0-1, percentage for text panel) */
    initialSplitRatio?: number;
    /** Called when content changes */
    onContentChange?: (content: any) => void;
    /** Called when Excalidraw changes */
    onExcalidrawChange?: (data: string) => void;
    /** Called when cues change */
    onCuesChange?: (cues: ScrollCue[]) => void;
    /** Called when slide order changes */
    onSlideOrderChange?: (order: string[]) => void;
    /** Called when split ratio changes */
    onSplitRatioChange?: (ratio: number) => void;
    /** Called when layout changes */
    onLayoutChange?: (layout: 'text-left' | 'text-right') => void;
    /** Layout: 'text-left' or 'text-right' */
    layout?: 'text-left' | 'text-right';
    /** Height of the editor - defaults to viewport height minus header space */
    height?: string;
    /** Whether user is editing (false = viewing/presentation mode) */
    isEditing?: boolean;
}

const HybridLessonEditor: React.FC<HybridLessonEditorProps> = ({
    initialContent,
    initialExcalidraw,
    initialCues = [],
    initialSlideOrder,
    initialSplitRatio = 0.4,
    onContentChange,
    onExcalidrawChange,
    onCuesChange,
    onSlideOrderChange,
    onSplitRatioChange,
    onLayoutChange,
    layout: propLayout = 'text-left',
    height = 'calc(100vh - 200px)',
    isEditing = true,
}) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [customSlideOrder, setCustomSlideOrder] = useState<string[] | null>(initialSlideOrder || null);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [layout, setLayout] = useState<'text-left' | 'text-right'>(propLayout);
    const [scrollCues, setScrollCues] = useState<ScrollCue[]>(initialCues);
    const [isPlacingCue, setIsPlacingCue] = useState(false);
    const [showCueEditor, setShowCueEditor] = useState(false);
    const [showSlideManager, setShowSlideManager] = useState(false);
    const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
    
    // Mobile-specific: which panel is currently visible (for swipe navigation)
    // Default to 'text' so text content is shown first on mobile
    const [mobileActivePanel, setMobileActivePanel] = useState<'excalidraw' | 'text'>('text');
    
    // Mobile sync notification - shown when slide changes while viewing text panel
    const [mobileSyncNotification, setMobileSyncNotification] = useState<string | null>(null);
    
    // Image insertion modal state
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [isInsertingImage, setIsInsertingImage] = useState(false);
    
    // Track if initial zoom to first frame has been done
    const hasInitialZoomRef = useRef(false);
    
    // Track if Excalidraw is fully loaded and centered
    const [isExcalidrawReady, setIsExcalidrawReady] = useState(false);

    // Unique mount ID to prevent React reconciliation issues with Excalidraw's DOM manipulation
    const mountIdRef = useRef(`hybrid-excalidraw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    // Track mount state (setter used to trigger re-render)
    const [, setIsMounted] = useState(false);
    
    // Portal container - we create a DOM node outside React's control
    const portalContainerRef = useRef<HTMLDivElement | null>(null);
    const [portalReady, setPortalReady] = useState(false);
    
    useEffect(() => {
        console.log('[HybridLessonEditor] Mount started, id:', mountIdRef.current);
        
        // Create a container div outside React's control
        const container = document.createElement('div');
        container.id = `excalidraw-portal-${mountIdRef.current}`;
        container.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
        portalContainerRef.current = container;
        
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            setIsMounted(true);
            setPortalReady(true);
        }, 50);
        
        return () => {
            console.log('[HybridLessonEditor] Unmounting, id:', mountIdRef.current);
            clearTimeout(timer);
            // Clean up the portal container
            if (portalContainerRef.current && portalContainerRef.current.parentNode) {
                portalContainerRef.current.parentNode.removeChild(portalContainerRef.current);
            }
            portalContainerRef.current = null;
        };
    }, []);

    // Sync layout from props
    useEffect(() => {
        setLayout(propLayout);
    }, [propLayout]);
    const [isResizing, setIsResizing] = useState(false);
    
    // Compute the effective layout - in viewer mode always use prop, in edit mode use state
    const effectiveLayout = isEditing ? layout : propLayout;

    // Sync scroll cues when initialCues prop changes (e.g., after async load)
    useEffect(() => {
        if (initialCues && initialCues.length > 0) {
            setScrollCues(initialCues);
        }
    }, [initialCues]);
    
    // Sync slide order when initialSlideOrder prop changes (e.g., after async load)
    useEffect(() => {
        if (initialSlideOrder && initialSlideOrder.length > 0) {
            setCustomSlideOrder(initialSlideOrder);
        }
    }, [initialSlideOrder]);
    
    // Sync split ratio when initialSplitRatio prop changes
    useEffect(() => {
        if (initialSplitRatio) {
            setSplitRatio(initialSplitRatio);
        }
    }, [initialSplitRatio]);
    
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    
    const textContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastScrollCueRef = useRef<number>(-1);
    const currentFrameIndexRef = useRef<number>(0);

    // Parse initial Excalidraw data
    const parsedExcalidrawData = useMemo(() => {
        if (!initialExcalidraw) return undefined;
        try {
            if (typeof initialExcalidraw === 'string') {
                return JSON.parse(initialExcalidraw);
            }
            return initialExcalidraw;
        } catch (e) {
            console.error('[HybridEditor] Failed to parse Excalidraw data:', e);
            return undefined;
        }
    }, [initialExcalidraw]);

    // Handle data loading when initialExcalidraw updates
    useEffect(() => {
        if (!excalidrawAPI || !parsedExcalidrawData) return;
        
        const currentElements = excalidrawAPI.getSceneElements();
        if (currentElements.length === 0) {
            excalidrawAPI.updateScene(parsedExcalidrawData);
        }
        
        // Files must ALWAYS be added via addFiles API - even when initialData is passed,
        // Excalidraw doesn't always register the files properly for rendering
        if (parsedExcalidrawData.files && typeof parsedExcalidrawData.files === 'object') {
            const filesArray = Object.values(parsedExcalidrawData.files);
            if (filesArray.length > 0) {
                console.log('[HybridEditor] Adding', filesArray.length, 'files to scene');
                excalidrawAPI.addFiles(filesArray);
            }
        }
    }, [excalidrawAPI, parsedExcalidrawData]);

    // Detect mobile viewport or narrow container that can't fit side-by-side layout
    // Minimum text panel width is 280px - if we can't fit that plus 300px excalidraw, use mobile layout
    const MIN_TEXT_WIDTH = 280; // Minimum width for readable text (about 25-30 chars)
    const MIN_EXCALIDRAW_WIDTH = 300;
    const MIN_SIDE_BY_SIDE_WIDTH = MIN_TEXT_WIDTH + MIN_EXCALIDRAW_WIDTH + 8; // +8 for divider
    
    useEffect(() => {
        const checkMobile = () => {
            const screenTooNarrow = window.innerWidth < 768;
            const containerTooNarrow = containerRef.current 
                ? containerRef.current.offsetWidth < MIN_SIDE_BY_SIDE_WIDTH 
                : false;
            setIsMobile(screenTooNarrow || containerTooNarrow);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Extract frames from Excalidraw
    useEffect(() => {
        if (!excalidrawAPI) return;

        const updateFrames = () => {
            const elements = excalidrawAPI.getSceneElements();
            const frameElements = elements.filter((el: any) => el.type === 'frame');
            
            // Create frame objects
            const frameObjects: Frame[] = frameElements.map((el: any) => ({
                id: el.id,
                name: el.name || `Slide ${frameElements.indexOf(el) + 1}`,
                element: el,
            }));
            
            // Sort by custom order if available, otherwise by x position
            let sortedFrames: Frame[];
            if (customSlideOrder && customSlideOrder.length > 0) {
                // Use custom order - put frames in order of customSlideOrder, then append any new frames
                const orderedFrames: Frame[] = [];
                const frameMap = new Map(frameObjects.map(f => [f.id, f]));
                
                // Add frames in custom order
                for (const id of customSlideOrder) {
                    const frame = frameMap.get(id);
                    if (frame) {
                        orderedFrames.push(frame);
                        frameMap.delete(id);
                    }
                }
                
                // Append any new frames (not in custom order) sorted by x position
                const remainingFrames = Array.from(frameMap.values())
                    .sort((a, b) => a.element.x - b.element.x);
                sortedFrames = [...orderedFrames, ...remainingFrames];
            } else {
                // Default: sort by x position (left to right)
                sortedFrames = frameObjects.sort((a: Frame, b: Frame) => a.element.x - b.element.x);
            }

            setFrames(sortedFrames);
        };

        updateFrames();
        // Re-check frames periodically (user might add/remove frames)
        const interval = setInterval(updateFrames, 3000);
        return () => clearInterval(interval);
    }, [excalidrawAPI, customSlideOrder]);
    
    // Auto-zoom to first frame on initial load (separate effect to run AFTER frames state updates)
    useEffect(() => {
        if (!excalidrawAPI || frames.length === 0 || hasInitialZoomRef.current) return;
        
        // Mark that we've done initial zoom
        hasInitialZoomRef.current = true;
        
        // Zoom to first frame with multiple attempts for browser compatibility
        const firstFrame = frames[0];
        if (firstFrame) {
            const zoomToFirst = () => {
                excalidrawAPI.scrollToContent(firstFrame.element, {
                    fitToViewport: true,
                    animate: false, // No animation on initial load for faster response
                });
                setCurrentFrameIndex(0);
                currentFrameIndexRef.current = 0;
            };
            
            // Multiple attempts to handle layout settling
            setTimeout(zoomToFirst, 100);
            setTimeout(zoomToFirst, 300);
            setTimeout(() => {
                zoomToFirst();
                // Mark as ready after final zoom attempt
                setIsExcalidrawReady(true);
            }, 600);
        }
    }, [excalidrawAPI, frames]);
    
    // Also mark ready if there are no frames (just raw excalidraw content)
    useEffect(() => {
        if (excalidrawAPI && frames.length === 0 && !isExcalidrawReady) {
            // Wait a moment for the scene to stabilize
            const timer = setTimeout(() => setIsExcalidrawReady(true), 800);
            return () => clearTimeout(timer);
        }
    }, [excalidrawAPI, frames.length, isExcalidrawReady]);

    // Navigate to a specific frame
    const goToFrame = useCallback((index: number, triggeredByScroll: boolean = false) => {
        // Need to access current frames ref if possible, but here we rely on closure or prop
        // We can't easily access latest 'frames' if it's not in dependency, but adding it creates loops
        // Solved by using the frames from closure or ref if we had one.
        // Assuming 'frames' in dependency is fine as long as setFrames doesn't trigger immediately.
        if (!excalidrawAPI) return;
        
        // Use internal frames state for navigation
        // Note: passing frames to this callback via deps
        if (frames.length === 0) return;
        
        const targetIndex = Math.max(0, Math.min(index, frames.length - 1));
        const targetFrame = frames[targetIndex];
        
        if (targetFrame) {
            // Check if we're actually changing frames
            const isChangingFrame = currentFrameIndexRef.current !== targetIndex;
            
            // Update state first to ensure it tracks even if scroll fails (e.g. hidden)
            setCurrentFrameIndex(targetIndex);
            currentFrameIndexRef.current = targetIndex;
            
            try {
                excalidrawAPI.scrollToContent(targetFrame.element, {
                    fitToViewport: true,
                    animate: true,
                    duration: 500, // Slower animation for better visibility
                });
            } catch (err) {
                // Ignore errors when scrolling to hidden content
                console.debug('Failed to scroll to content (likely hidden)', err);
            }
            
            // Show mobile notification if triggered by scroll while viewing text panel
            if (triggeredByScroll && isMobile && mobileActivePanel === 'text' && isChangingFrame) {
                const slideName = targetFrame.name || `Slide ${targetIndex + 1}`;
                setMobileSyncNotification(`📊 ${slideName}`);
                // Auto-dismiss after 2 seconds
                setTimeout(() => setMobileSyncNotification(null), 2000);
            }
        }
    }, [excalidrawAPI, frames, isMobile, mobileActivePanel]);

    // Re-zoom Excalidraw when mobile switches to excalidraw panel
    // The canvas may have had 0x0 dimensions while display:none, so we need to
    // trigger a resize and re-zoom when it becomes visible
    useEffect(() => {
        if (!isMobile || mobileActivePanel !== 'excalidraw' || !excalidrawAPI) return;

        // Dispatch resize so Excalidraw recalculates its canvas dimensions
        window.dispatchEvent(new Event('resize'));

        // After the canvas has had time to resize, zoom to the current frame
        const timer = setTimeout(() => {
            if (frames.length > 0) {
                const targetIndex = Math.min(currentFrameIndexRef.current, frames.length - 1);
                const targetFrame = frames[targetIndex];
                if (targetFrame) {
                    try {
                        excalidrawAPI.scrollToContent(targetFrame.element, {
                            fitToViewport: true,
                            animate: false,
                        });
                    } catch (err) {
                        console.debug('[HybridEditor] Re-zoom after tab switch failed', err);
                    }
                }
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [isMobile, mobileActivePanel, excalidrawAPI, frames]);

    // Handle scroll-based cue triggering (only in view mode, not edit mode)
    useEffect(() => {
        // Only trigger scroll cues in view mode (when NOT editing)
        if (!textContainerRef.current || scrollCues.length === 0 || isEditing) return;

        const container = textContainerRef.current;

        const handleScroll = () => {
            const containerRect = container.getBoundingClientRect();
            // Trigger point at 40% from top of the container (closer to visual center)
            // This provides a more intuitive "when content reaches the middle" feel
            const triggerLine = containerRect.top + containerRect.height * 0.4;
            
            // Build array of cues with their actual document positions
            const cuesWithPositions: { cue: ScrollCue; top: number }[] = [];
            
            for (const cue of scrollCues) {
                // Check multiple possible block ID attributes used by BlockNote/Tiptap
                const selectors = [
                    `[data-id="${cue.blockId}"]`,
                    `[data-block-id="${cue.blockId}"]`,
                    `[data-node-view-content][data-id="${cue.blockId}"]`,
                    `[data-content-type][data-id="${cue.blockId}"]`,
                    `*[id="${cue.blockId}"]` // Generic ID fallback
                ].join(', ');
                
                const cueElement = container.querySelector(selectors);
                
                if (cueElement) {
                    const rect = cueElement.getBoundingClientRect();
                    cuesWithPositions.push({
                        cue,
                        top: rect.top, // Absolute position on screen
                    });
                }
            }
            
            // Sort by document position (top to bottom)
            cuesWithPositions.sort((a, b) => a.top - b.top);
            
            // Find the last cue that has scrolled past the trigger line
            // (i.e., its top is above the trigger point)
            let activeCue: ScrollCue | null = null;
            
            for (const item of cuesWithPositions) {
                if (item.top <= triggerLine) {
                    activeCue = item.cue;
                } else {
                    // Once we find one below the trigger, stop
                    break;
                }
            }
            
            // If we found an active cue, check if we need to switch
            // Use ref for current frame index to avoid stale closure issues
            // Only trigger if:
            // 1. It's different from the last triggered scroll cue (prevents duplicate calls)
            if (activeCue && lastScrollCueRef.current !== activeCue.frameIndex) {
                lastScrollCueRef.current = activeCue.frameIndex;
                goToFrame(activeCue.frameIndex, true); // true = triggered by scroll
            } else if (!activeCue && cuesWithPositions.length > 0 && lastScrollCueRef.current !== -1) {
                // User scrolled above all cues, go to first slide
                // Only trigger if we haven't already set to "above all cues" state
                lastScrollCueRef.current = -1;
                // Only go to 0 if we aren't already there
                if (currentFrameIndexRef.current !== 0) {
                    goToFrame(0, true);
                }
            }
        };

        // Run once on mount to set initial state
        setTimeout(handleScroll, 100);
        
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollCues, goToFrame, isEditing]);

    const lastChangeTimeRef = useRef(0);

    // Handle Excalidraw changes with debounce
    const handleExcalidrawChange = useCallback((elements: readonly any[], appState: any, files: any) => {
        // Skip if this is just initial load (no user interaction)
        const now = Date.now();
        if (lastChangeTimeRef.current === 0) {
            lastChangeTimeRef.current = now;
            return;
        }

        if (onExcalidrawChange) {
            const sceneData = {
                type: 'excalidraw',
                version: 2,
                source: 'aquaticpro-hybrid',
                elements: elements,
                appState: {
                    viewBackgroundColor: appState?.viewBackgroundColor,
                    gridSize: appState?.gridSize,
                },
                files: files,
            };
            onExcalidrawChange(JSON.stringify(sceneData));
        }
    }, [onExcalidrawChange]);

    // Handle BlockNote content changes
    const handleContentChange = useCallback((content: any) => {
        if (onContentChange) {
            onContentChange(content);
        }
    }, [onContentChange]);

    // Add a scroll cue at current position
    const addScrollCue = useCallback((blockId: string) => {
        const newCue: ScrollCue = {
            id: `cue-${Date.now()}`,
            blockId,
            frameIndex: currentFrameIndex,
            label: `Cue for Slide ${currentFrameIndex + 1}`,
        };
        
        // Add the new cue - don't sort here, we'll determine order by document position at runtime
        const newCues = [...scrollCues, newCue];
        
        setScrollCues(newCues);
        onCuesChange?.(newCues);
        setIsPlacingCue(false);
    }, [scrollCues, currentFrameIndex, onCuesChange]);

    // Remove a scroll cue
    const removeCue = useCallback((cueId: string) => {
        const newCues = scrollCues.filter(c => c.id !== cueId);
        setScrollCues(newCues);
        onCuesChange?.(newCues);
    }, [scrollCues, onCuesChange]);

    // Toggle layout
    const toggleLayout = () => {
        setLayout(prev => {
            const newLayout = prev === 'text-left' ? 'text-right' : 'text-left';
            onLayoutChange?.(newLayout);
            
            // Force Excalidraw to re-focus after layout change
            // This helps ensure proper rendering after DOM reorder
            setTimeout(() => {
                if (excalidrawAPI && frames.length > 0) {
                    goToFrame(currentFrameIndex);
                }
            }, 100);
            
            return newLayout;
        });
    };

    // Toggle fullscreen for Excalidraw
    // Uses CSS-based fullscreen as iOS Safari/Firefox don't support Fullscreen API
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        
        // Try native fullscreen first (works on desktop and Android)
        if (!isFullscreen) {
            if (containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(() => {
                    // Fullscreen API not supported or denied - use CSS fallback
                    setIsFullscreen(true);
                });
            } else if ((containerRef.current as any).webkitRequestFullscreen) {
                // Safari desktop
                (containerRef.current as any).webkitRequestFullscreen();
            } else {
                // iOS Safari/Firefox - use CSS-based fullscreen
                setIsFullscreen(true);
            }
        } else {
            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            } else if ((document as any).webkitFullscreenElement) {
                (document as any).webkitExitFullscreen?.();
            } else {
                // CSS-based fullscreen exit
                setIsFullscreen(false);
            }
        }
    }, [isFullscreen]);

    // Listen for fullscreen changes (native API)
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNativeFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
            if (!isNativeFullscreen && isFullscreen) {
                // Exited native fullscreen, also exit CSS fullscreen
                setIsFullscreen(false);
            } else if (isNativeFullscreen) {
                setIsFullscreen(true);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, [isFullscreen]);

    // Render floating slide indicator for view mode (sticky to bottom of text panel)
    // On mobile, clicking this switches to the Excalidraw tab and zooms to the current frame
    const renderFloatingSlideIndicator = () => {
        if (isEditing || scrollCues.length === 0 || frames.length === 0) return null;
        
        const currentFrame = frames[currentFrameIndex];
        const slideName = currentFrame?.name || `Slide ${currentFrameIndex + 1}`;
        
        // Handler to switch to Excalidraw view and zoom to current frame
        const handleIndicatorClick = () => {
            if (isMobile) {
                // Switch to excalidraw panel
                setMobileActivePanel('excalidraw');
                // After panel transition, zoom to the current frame
                setTimeout(() => {
                    goToFrame(currentFrameIndex);
                }, 350);
            } else {
                // On desktop, just zoom to the frame (it's already visible)
                goToFrame(currentFrameIndex);
            }
        };
        
        return (
            <div className="ap-sticky ap-bottom-4 ap-left-0 ap-right-0 ap-z-20 ap-flex ap-justify-center ap-pointer-events-none">
                <Button
                    onClick={handleIndicatorClick}
                    variant="primary"
                    size="sm"
                    className="!ap-rounded-full ap-shadow-lg ap-pointer-events-auto"
                    title={isMobile ? "Tap to view this slide" : "Click to zoom to this slide"}
                >
                    <HiOutlineViewfinderCircle className="ap-h-4 ap-w-4" />
                    <span>{slideName}</span>
                    <span className="ap-text-blue-200 ap-text-xs">({currentFrameIndex + 1}/{frames.length})</span>
                    {isMobile && <span className="ap-text-blue-200 ap-text-xs ap-ml-1">→ View</span>}
                </Button>
            </div>
        );
    };
    
    // Render cue markers in the text panel
    const renderCueMarkers = () => {
        if (!isEditing || !showCueEditor) return null;
        
        return (
            <div className="ap-absolute ap-top-2 ap-right-2 ap-z-10 ap-bg-white ap-rounded-lg ap-shadow-lg ap-p-3 ap-max-w-xs">
                <h4 className="ap-font-medium ap-text-sm ap-mb-2 ap-flex ap-items-center ap-gap-2">
                    <HiOutlineBookmarkSquare className="ap-h-4 ap-w-4 ap-text-blue-600" />
                    Scroll Cues ({scrollCues.length})
                </h4>
                
                {scrollCues.length === 0 ? (
                    <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                        No cues set. Click "Add Cue" then click a paragraph to create a scroll cue.
                    </p>
                ) : (
                    <ul className="ap-space-y-1 ap-mb-2 ap-max-h-32 ap-overflow-y-auto">
                        {scrollCues.map((cue) => (
                            <li key={cue.id} className="ap-flex ap-items-center ap-justify-between ap-text-xs ap-bg-gray-50 ap-px-2 ap-py-1 ap-rounded">
                                <span>Slide {cue.frameIndex + 1}</span>
                                <Button
                                    onClick={() => removeCue(cue.id)}
                                    variant="ghost"
                                    size="xs"
                                    className="!ap-p-0.5 !ap-min-h-0 !ap-text-red-500 hover:!ap-text-red-700 hover:!ap-bg-transparent"
                                >
                                    <HiOutlineTrash className="ap-h-3 ap-w-3" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                
                <div className="ap-flex ap-gap-2">
                    <Button
                        onClick={() => setIsPlacingCue(!isPlacingCue)}
                        variant={isPlacingCue ? 'primary' : 'ghost'}
                        size="xs"
                        className="ap-flex-1"
                    >
                        {isPlacingCue ? 'Click paragraph...' : 'Add Cue'}
                    </Button>
                    <Button
                        onClick={() => setShowCueEditor(false)}
                        variant="ghost"
                        size="xs"
                    >
                        Close
                    </Button>
                </div>
            </div>
        );
    };

    // Handle drag start for slide reordering
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedSlideIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    // Handle drag over for slide reordering
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Handle drop for slide reordering
    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndex = draggedSlideIndex;
        
        if (dragIndex === null || dragIndex === dropIndex) {
            setDraggedSlideIndex(null);
            return;
        }
        
        // Reorder frames
        const newFrames = [...frames];
        const draggedItem = newFrames[dragIndex];
        newFrames.splice(dragIndex, 1);
        newFrames.splice(dropIndex, 0, draggedItem);
        
        // Update custom order and persist
        const newOrder = newFrames.map(f => f.id);
        setCustomSlideOrder(newOrder);
        setFrames(newFrames); // Update frames immediately for UI
        onSlideOrderChange?.(newOrder);
        setDraggedSlideIndex(null);
    };

    // Handle drag end
    const handleDragEnd = () => {
        setDraggedSlideIndex(null);
    };

    // Reset to default order (by x position)
    const resetSlideOrder = () => {
        setCustomSlideOrder(null);
        onSlideOrderChange?.([]);
    };

    // Render slide manager panel
    const renderSlideManager = () => {
        if (!isEditing || !showSlideManager) return null;
        
        return (
            <div className="ap-absolute ap-top-2 ap-left-2 ap-z-20 ap-bg-white ap-rounded-lg ap-shadow-lg ap-p-3 ap-w-64">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                    <h4 className="ap-font-medium ap-text-sm ap-flex ap-items-center ap-gap-2">
                        <HiOutlineQueueList className="ap-h-4 ap-w-4 ap-text-blue-600" />
                        Slide Order
                    </h4>
                    <Button
                        onClick={() => setShowSlideManager(false)}
                        variant="ghost"
                        size="xs"
                        className="!ap-p-1 !ap-min-h-0"
                    >
                        <HiOutlineXMark className="ap-h-4 ap-w-4 ap-text-gray-500" />
                    </Button>
                </div>
                
                {frames.length === 0 ? (
                    <p className="ap-text-xs ap-text-gray-500">
                        No slides yet. Use the Frame tool in Excalidraw to create slides.
                    </p>
                ) : (
                    <>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                            Drag to reorder slides
                        </p>
                        <ul className="ap-space-y-1 ap-max-h-64 ap-overflow-y-auto">
                            {frames.map((frame, index) => (
                                <li
                                    key={frame.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => goToFrame(index)}
                                    className={`ap-flex ap-items-center ap-gap-2 ap-text-sm ap-px-2 ap-py-1.5 ap-rounded ap-cursor-move ap-transition-colors ${
                                        draggedSlideIndex === index
                                            ? 'ap-bg-blue-100 ap-border-2 ap-border-blue-400'
                                            : currentFrameIndex === index
                                            ? 'ap-bg-blue-50 ap-border ap-border-blue-200' : 'ap-bg-gray-50 hover:ap-bg-gray-100 ap-border ap-border-transparent'
                                    }`}
                                >
                                    <HiOutlineBars3 className="ap-h-4 ap-w-4 ap-text-gray-400 ap-flex-shrink-0" />
                                    <span className="ap-flex-1 ap-truncate">{frame.name}</span>
                                    <span className="ap-text-xs ap-text-gray-400 ap-flex-shrink-0">
                                        {index + 1}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {customSlideOrder && customSlideOrder.length > 0 && (
                            <Button
                                onClick={resetSlideOrder}
                                variant="ghost"
                                size="xs"
                                className="ap-mt-2 ap-w-full"
                            >
                                Reset to Default Order
                            </Button>
                        )}
                    </>
                )}
            </div>
        );
    };
    // Handle resize divider drag - works in both edit and view modes
    // Supports both mouse and touch events for iPad/Safari compatibility
    const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);
    
    // Use ref to track latest split ratio for mouseup handler (avoids stale closure)
    const splitRatioRef = useRef(splitRatio);
    useEffect(() => {
        splitRatioRef.current = splitRatio;
    }, [splitRatio]);
    
    useEffect(() => {
        if (!isResizing) return;
        
        const handleMove = (clientX: number) => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const posX = clientX - containerRect.left;
            
            // Calculate ratio based on layout direction
            let newRatio: number;
            if (layout === 'text-left') {
                newRatio = posX / containerWidth;
            } else {
                newRatio = 1 - (posX / containerWidth);
            }
            
            // Calculate minimum ratios based on pixel minimums
            const minTextRatio = MIN_TEXT_WIDTH / containerWidth;
            const minExcalidrawRatio = MIN_EXCALIDRAW_WIDTH / containerWidth;
            const maxTextRatio = 1 - minExcalidrawRatio - (8 / containerWidth); // Leave room for divider
            
            // Clamp to ensure both panels have minimum width
            newRatio = Math.max(minTextRatio, Math.min(maxTextRatio, newRatio));
            
            // Also clamp between 20% and 80% as a sanity check
            newRatio = Math.max(0.2, Math.min(0.8, newRatio));
            
            setSplitRatio(newRatio);
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            handleMove(e.clientX);
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                handleMove(e.touches[0].clientX);
            }
        };
        
        const handleEnd = () => {
            setIsResizing(false);
            // Use ref to get the latest value
            onSplitRatioChange?.(splitRatioRef.current);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        document.addEventListener('touchcancel', handleEnd);
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
            document.removeEventListener('touchcancel', handleEnd);
        };
    }, [isResizing, layout, onSplitRatioChange]);
    
    // Resizable divider component - works in both edit and view modes
    // Allows learners to resize panels even in view mode for better reading/viewing experience
    // Note: Always rendered in DOM but hidden on mobile via conditional in JSX
    const resizeDivider = (
        <div
            className={`group ap-relative ap-bg-gray-200 hover:ap-bg-blue-400 active:ap-bg-blue-500 ap-cursor-col-resize ap-transition-colors ap-flex-shrink-0 ap-z-10 ${
                isResizing ? 'ap-bg-blue-500' : ''
            }`}
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            style={{ 
                touchAction: 'none',
                // Width for touch/mouse target - visible drag handle
                width: '8px',
                minWidth: '8px',
                order: 1, // Always in middle between text and excalidraw panels
            }}
            title="Drag to resize panels"
        >
            {/* Visual grip indicator */}
            <div className="ap-absolute ap-top-1/2 ap-left-1/2 ap-transform -ap-translate-x-1/2 -ap-translate-y-1/2 ap-flex ap-flex-col ap-gap-1 ap-opacity-50 group-hover:ap-opacity-100 ap-transition-opacity">
                <div className="ap-w-1 ap-h-1 ap-rounded-full ap-bg-gray-500 group-hover:ap-bg-white" />
                <div className="ap-w-1 ap-h-1 ap-rounded-full ap-bg-gray-500 group-hover:ap-bg-white" />
                <div className="ap-w-1 ap-h-1 ap-rounded-full ap-bg-gray-500 group-hover:ap-bg-white" />
            </div>
        </div>
    );

    // Text panel (BlockNote)
    const textPanel = (
        <div 
            ref={textContainerRef}
            className={`ap-relative ap-min-w-0 ap-bg-white hybrid-text-panel ${
                isPlacingCue ? 'ap-cursor-crosshair' : ''
            }`}
            style={{ 
                // Mobile: full height, show/hide based on active panel
                // Desktop: use split ratio, accounting for 8px divider
                height: isMobile ? '100%' : '100%',
                minHeight: isMobile ? '100%' : 'auto',
                width: isMobile ? '100%' : `calc(${splitRatio * 100}% - 4px)`,
                minWidth: isMobile ? '100%' : `${MIN_TEXT_WIDTH}px`,
                flexShrink: 0,
                flexGrow: 0,
                // Mobile: show/hide panel, Desktop: always visible
                display: isMobile && mobileActivePanel !== 'text' ? 'none' : 'block',
                // Enable scrolling
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                zIndex: 1,
                position: 'relative',
                // Stable order for CSS layout (prevents React DOM reconciliation issues on mobile)
                order: !isMobile && effectiveLayout === 'text-right' ? 2 : 0,
            }}
            onClickCapture={(e) => {
                if (isPlacingCue) {
                    // Stop event from reaching the editor to prevent cursor placement
                    e.preventDefault();
                    e.stopPropagation();

                    // Find closest block element directly or by searching strictly for data-id
                    const target = e.target as HTMLElement;
                    // BlockNote widely uses data-id for block identification
                    const blockElement = target.closest('[data-id], [data-block-id]');
                    
                    if (blockElement) {
                        const blockId = blockElement.getAttribute('data-id') || blockElement.getAttribute('data-block-id');
                        if (blockId) {
                            addScrollCue(blockId);
                        }
                    }
                }
            }}
        >
            {renderCueMarkers()}
            
            <div className="ap-p-4">
                <BlockEditor
                    initialContent={initialContent}
                    onChange={handleContentChange}
                    editable={isEditing}
                />
            </div>
            
            {/* Floating slide indicator at bottom of text panel (view mode only) */}
            {renderFloatingSlideIndicator()}
            
            {/* Cue indicator dots on the left side */}
            {scrollCues.map((cue) => (
                <div
                    key={cue.id}
                    className="ap-absolute ap-left-0 ap-w-2 ap-h-2 ap-bg-blue-500 ap-rounded-full ap-transform -ap-translate-y-1/2"
                    style={{ top: '50%' }} // This would need proper positioning based on block position
                    title={`Slide ${cue.frameIndex + 1}`}
                />
            ))}
        </div>
    );

    // Excalidraw panel
    const excalidrawPanel = (
        <div 
            className="ap-min-w-0 ap-flex ap-flex-col ap-bg-gray-50"
            style={{ 
                // Mobile: full height, show/hide based on active panel
                // Desktop: calculate width as remaining space, accounting for 8px divider
                height: isMobile ? '100%' : '100%',
                minHeight: isMobile ? '100%' : 'auto',
                width: isMobile ? '100%' : `calc(${(1 - splitRatio) * 100}% - 4px)`,
                overflow: 'visible',
                minWidth: isMobile ? '100%' : '300px',
                flexShrink: 0,
                flexGrow: 0,
                // Mobile: show/hide panel, Desktop: always visible
                display: isMobile && mobileActivePanel !== 'excalidraw' ? 'none' : 'flex',
                zIndex: 5,
                position: 'relative',
                // Stable order for CSS layout (prevents React DOM reconciliation issues on mobile)
                order: !isMobile && effectiveLayout === 'text-right' ? 0 : 2,
            }}
        >
            {/* Slide navigation bar */}
            <div className="ap-flex ap-items-center ap-justify-between ap-px-3 ap-py-2 ap-bg-white ap-border-b ap-border-gray-200">
                <div className="ap-flex ap-items-center ap-gap-2">
                    <Button
                        onClick={() => goToFrame(currentFrameIndex - 1)}
                        disabled={currentFrameIndex === 0}
                        variant="ghost"
                        size="xs"
                        className="!ap-p-1 !ap-min-h-0"
                    >
                        <HiOutlineChevronLeft className="ap-h-4 ap-w-4" />
                    </Button>
                    <span className="ap-text-sm ap-text-gray-600">
                        {frames.length > 0 
                            ? `${frames[currentFrameIndex]?.name || 'Slide'} (${currentFrameIndex + 1}/${frames.length})`
                            : 'No slides'
                        }
                    </span>
                    <Button
                        onClick={() => goToFrame(currentFrameIndex + 1)}
                        disabled={currentFrameIndex >= frames.length - 1}
                        variant="ghost"
                        size="xs"
                        className="!ap-p-1 !ap-min-h-0"
                    >
                        <HiOutlineChevronRight className="ap-h-4 ap-w-4" />
                    </Button>
                </div>
                
                <div className="ap-flex ap-items-center ap-gap-1">
                    {/* Slide manager button (editing only) */}
                    {isEditing && frames.length > 1 && (
                        <>
                            <Button
                                onClick={() => setShowSlideManager(!showSlideManager)}
                                variant="ghost"
                                size="xs"
                                className={`!ap-p-1 !ap-min-h-0 ${
                                    showSlideManager
                                        ? '!ap-bg-blue-100 !ap-text-blue-600' : ''
                                }`}
                                title="Reorder slides"
                            >
                                <HiOutlineQueueList className="ap-h-4 ap-w-4" />
                            </Button>
                            <div className="ap-w-px ap-h-4 ap-bg-gray-200 ap-mx-1" />
                        </>
                    )}
                    
                    {/* Slide dots */}
                    {frames.map((_, index) => (
                        <Button
                            key={index}
                            onClick={() => goToFrame(index)}
                            variant="ghost"
                            size="xs"
                            className={`!ap-p-0 !ap-min-h-0 !ap-min-w-0 !ap-w-2 !ap-h-2 !ap-rounded-full ap-transition-all ${
                                index === currentFrameIndex
                                    ? '!ap-bg-blue-600 !ap-w-4' : '!ap-bg-gray-300 hover:!ap-bg-gray-400'
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                        >
                            <span className="ap-sr-only">Slide {index + 1}</span>
                        </Button>
                    ))}
                    
                    <div className="ap-w-px ap-h-4 ap-bg-gray-200 ap-mx-2" />
                    
                    {/* Fit to content button */}
                    <Button
                        onClick={() => {
                            if (excalidrawAPI) {
                                excalidrawAPI.scrollToContent(undefined, { fitToViewport: true });
                            }
                        }}
                        variant="ghost"
                        size="xs"
                        className="!ap-p-1 !ap-min-h-0"
                        title="Fit to content"
                    >
                        <HiOutlineViewfinderCircle className="ap-h-4 ap-w-4" />
                    </Button>
                    
                    <Button
                        onClick={toggleFullscreen}
                        variant="ghost"
                        size="xs"
                        className="!ap-p-1 !ap-min-h-0"
                        title="Fullscreen"
                    >
                        {isFullscreen 
                            ? <HiOutlineArrowsPointingIn className="ap-h-4 ap-w-4" />
                            : <HiOutlineArrowsPointingOut className="ap-h-4 ap-w-4" />
                        }
                    </Button>
                </div>
            </div>
            
            {/* Excalidraw canvas */}
            <div 
                id={mountIdRef.current}
                className="ap-flex-1 ap-min-h-0 excalidraw-wrapper ap-relative" 
                style={{ overflow: 'visible' }}
                ref={(node) => {
                    // Attach portal container when wrapper div is ready
                    if (node && portalContainerRef.current && !portalContainerRef.current.parentNode) {
                        node.appendChild(portalContainerRef.current);
                    }
                }}
            >
                {/* Loading overlay while Excalidraw initializes */}
                {!isExcalidrawReady && (
                    <div className="ap-absolute ap-inset-0 ap-bg-white/80 ap-backdrop-blur-sm ap-z-50 ap-flex ap-items-center ap-justify-center">
                        <div className="ap-flex ap-flex-col ap-items-center ap-gap-3">
                            <svg className="ap-animate-spin ap-h-8 ap-w-8 ap-text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ap-text-sm ap-text-gray-600">Loading slides...</span>
                        </div>
                    </div>
                )}
                
                {/* Slide manager overlay */}
                {renderSlideManager()}
                
                {/* Lock down UI in view mode but allow panning */}
                {!isEditing && (
                    <style>{`
                        .excalidraw-wrapper .App-menu_top,
                        .excalidraw-wrapper .App-bottom-bar,
                        .excalidraw-wrapper .layer-ui__wrapper {
                            display: none !important;
                        }
                    `}</style>
                )}
                {/* Use Portal to render Excalidraw outside React's normal DOM reconciliation */}
                {portalReady && portalContainerRef.current && createPortal(
                    <Excalidraw
                        excalidrawAPI={(api: any) => setExcalidrawAPI(api as ExcalidrawAPI)}
                        initialData={parsedExcalidrawData}
                        onChange={isEditing ? handleExcalidrawChange : undefined}
                        viewModeEnabled={!isEditing}
                        zenModeEnabled={!isEditing}
                        gridModeEnabled={false}
                        theme="light"
                        langCode="en"
                        UIOptions={{
                            canvasActions: {
                                export: isEditing ? { saveFileToDisk: true } : false,
                                loadScene: isEditing,
                                saveToActiveFile: false,
                                clearCanvas: isEditing,
                                changeViewBackgroundColor: isEditing,
                                toggleTheme: isEditing,
                            },
                            // Only show tools if editing
                            tools: isEditing ? {
                                image: true,
                            } : {
                                image: false,
                            }
                        }}
                    >
                        {isEditing && (
                            <MainMenu>
                                <MainMenu.DefaultItems.LoadScene />
                                <MainMenu.DefaultItems.Export />
                                <MainMenu.DefaultItems.SaveAsImage />
                                <MainMenu.DefaultItems.ClearCanvas />
                                <MainMenu.Separator />
                                <MainMenu.Item onSelect={() => setShowImageModal(true)} icon={<HiOutlineFolderOpen className="ap-h-4 ap-w-4" />}>
                                    Insert Image
                                </MainMenu.Item>
                                <MainMenu.Separator />
                                <MainMenu.DefaultItems.ChangeCanvasBackground />
                                <MainMenu.DefaultItems.ToggleTheme />
                                <MainMenu.Separator />
                                <MainMenu.DefaultItems.Help />
                            </MainMenu>
                        )}
                        
                        <WelcomeScreen>
                            <WelcomeScreen.Center>
                                <WelcomeScreen.Center.Heading>
                                    Visual Slides
                                </WelcomeScreen.Center.Heading>
                                <WelcomeScreen.Center.Menu>
                                    <WelcomeScreen.Center.MenuItemHelp />
                                </WelcomeScreen.Center.Menu>
                            </WelcomeScreen.Center>
                        </WelcomeScreen>
                    </Excalidraw>,
                    portalContainerRef.current
                )}
                {!portalReady && (
                    <div className="ap-flex ap-items-center ap-justify-center ap-h-full ap-bg-gray-50">
                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div 
            ref={containerRef} 
            className={`ap-flex ap-flex-col ap-w-full ap-max-w-full ${
                isFullscreen ? 'ap-fixed ap-inset-0 ap-z-[9999] ap-bg-white' : ''
            }`}
            style={{ 
                height: isFullscreen ? '100vh' : height, 
                overflow: 'visible',
            }}
        >
            {/* Mobile panel switcher - only show on mobile in view mode */}
            {/* Tab order: Text Content (left) | Visual (right) */}
            {isMobile && !isEditing && (
                <div className="ap-flex ap-border-b ap-border-gray-200 ap-bg-white">
                    <Button
                        onClick={() => setMobileActivePanel('text')}
                        variant="ghost"
                        size="sm"
                        className={`ap-flex-1 !ap-rounded-none ${
                            mobileActivePanel === 'text'
                                ? '!ap-text-blue-600 !ap-border-b-2 !ap-border-blue-600 !ap-bg-blue-50' : '!ap-text-gray-600'
                        }`}
                    >
                        Text Content
                    </Button>
                    <Button
                        onClick={() => setMobileActivePanel('excalidraw')}
                        variant="ghost"
                        size="sm"
                        className={`ap-flex-1 !ap-rounded-none ${
                            mobileActivePanel === 'excalidraw'
                                ? '!ap-text-blue-600 !ap-border-b-2 !ap-border-blue-600 !ap-bg-blue-50' : '!ap-text-gray-600'
                        }`}
                    >
                        Visual
                    </Button>
                    {isFullscreen && (
                        <Button
                            onClick={toggleFullscreen}
                            variant="ghost"
                            size="sm"
                            className="!ap-rounded-none"
                            title="Exit fullscreen"
                        >
                            <HiOutlineArrowsPointingIn className="ap-h-5 ap-w-5" />
                        </Button>
                    )}
                </div>
            )}
            
            {/* Mobile sync notification - shows when slide changes while viewing text */}
            <AnimatePresence>
                {mobileSyncNotification && isMobile && mobileActivePanel === 'text' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="ap-absolute ap-top-14 ap-left-1/2 ap-transform -ap-translate-x-1/2 ap-z-50"
                    >
                        <Button
                            onClick={() => {
                                setMobileActivePanel('excalidraw');
                                setMobileSyncNotification(null);
                                // Re-zoom to the current frame after view transition completes
                                setTimeout(() => {
                                    goToFrame(currentFrameIndexRef.current);
                                }, 350);
                            }}
                            variant="primary"
                            size="sm"
                            className="!ap-rounded-full ap-shadow-lg"
                        >
                            {mobileSyncNotification}
                            <span className="ap-text-blue-200">Tap to view</span>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Toolbar - hide on mobile view mode to maximize space */}
            {isEditing && (
                <div className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2 ap-bg-gray-100 ap-border-b ap-border-gray-200">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <span className="ap-text-sm ap-font-medium ap-text-gray-700">
                            Hybrid Editor
                        </span>
                        <div className="ap-h-4 ap-w-px ap-bg-gray-300" />
                        <span className="ap-text-xs ap-text-gray-500">
                            {frames.length} slides • {scrollCues.length} scroll cues
                        </span>
                    </div>
                    
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            onClick={() => setShowCueEditor(!showCueEditor)}
                            variant={showCueEditor ? 'primary' : 'outline'}
                            size="sm"
                        >
                            <HiOutlineBookmarkSquare className="ap-h-4 ap-w-4" />
                            Scroll Cues
                        </Button>
                        
                        <Button
                            onClick={toggleLayout}
                            variant="outline"
                            size="sm"
                            title="Swap layout"
                        >
                            <HiOutlineArrowsRightLeft className="ap-h-4 ap-w-4" />
                            {layout === 'text-left' ? 'Text | Visual' : 'Visual | Text'}
                        </Button>
                        
                        <div className="ap-flex ap-items-center ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                            <Button
                                onClick={() => setIsMobile(false)}
                                variant="ghost"
                                size="xs"
                                className={`!ap-rounded-none !ap-p-1.5 !ap-min-h-0 ${!isMobile ? '!ap-bg-blue-50 !ap-text-blue-600' : ''}`}
                                title="Desktop view"
                            >
                                <HiOutlineComputerDesktop className="ap-h-4 ap-w-4" />
                            </Button>
                            <Button
                                onClick={() => setIsMobile(true)}
                                variant="ghost"
                                size="xs"
                                className={`!ap-rounded-none !ap-p-1.5 !ap-min-h-0 ${isMobile ? '!ap-bg-blue-50 !ap-text-blue-600' : ''}`}
                                title="Mobile view"
                            >
                                <HiOutlineDevicePhoneMobile className="ap-h-4 ap-w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Main content area */}
            <div 
                className={`ap-flex-1 ap-min-h-0 ap-flex ${isMobile ? 'ap-flex-col' : 'ap-flex-row'}`}
                style={{ 
                    overflow: 'visible', // Allow scrolling and menus to work
                    userSelect: isResizing ? 'none' : 'auto',
                    height: '100%',
                }}
            >
                {/* Stable DOM order — always text, divider, excalidraw.
                    Visual order is controlled by CSS 'order' on each panel.
                    This prevents React from swapping DOM nodes on mobile/desktop
                    transitions, which would unmount BlockEditor and corrupt
                    the Excalidraw portal. */}
                {textPanel}
                {!isMobile && resizeDivider}
                {excalidrawPanel}
            </div>
            
            {/* Insert Image Modal */}
            <AnimatePresence>
                {showImageModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="ap-fixed ap-inset-0 ap-bg-black/50 ap-flex ap-items-center ap-justify-center ap-z-[10000]"
                        onClick={() => { setShowImageModal(false); setImageUrl(''); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="ap-bg-white ap-rounded-lg ap-shadow-2xl ap-w-full ap-max-w-md ap-mx-4 ap-overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-flex ap-items-center ap-justify-between">
                                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                                    Insert Image
                                </h3>
                                <Button
                                    onClick={() => { setShowImageModal(false); setImageUrl(''); }}
                                    variant="ghost"
                                    size="xs"
                                    className="!ap-p-1 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-gray-600"
                                >
                                    <svg className="ap-w-5 ap-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </Button>
                            </div>
                            
                            <div className="ap-p-6 ap-space-y-5">
                                {/* URL Input Option */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                        Paste Image URL
                                    </label>
                                    <div className="ap-flex ap-gap-2">
                                        <input
                                            type="url"
                                            value={imageUrl}
                                            onChange={(e) => setImageUrl(e.target.value)}
                                            placeholder="https://example.com/image.png"
                                            className="ap-flex-1 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                                            disabled={isInsertingImage}
                                        />
                                        <Button
                                            onClick={async () => {
                                                if (!imageUrl || !excalidrawAPI) return;
                                                setIsInsertingImage(true);
                                                try {
                                                    // Fetch image to get dimensions and create data URL
                                                    const response = await fetch(imageUrl);
                                                    const blob = await response.blob();
                                                    const reader = new FileReader();
                                                    reader.onload = async () => {
                                                        const dataUrl = reader.result as string;
                                                        const fileId = `file-${Date.now()}`;
                                                        
                                                        // Get image dimensions
                                                        const img = new Image();
                                                        img.onload = () => {
                                                            let width = img.width;
                                                            let height = img.height;
                                                            const maxSize = 400;
                                                            if (width > maxSize || height > maxSize) {
                                                                const scale = maxSize / Math.max(width, height);
                                                                width *= scale;
                                                                height *= scale;
                                                            }
                                                            
                                                            // Get center of viewport
                                                            const appState = excalidrawAPI.getAppState();
                                                            const centerX = (appState.scrollX * -1) + (appState.width / 2) / appState.zoom.value;
                                                            const centerY = (appState.scrollY * -1) + (appState.height / 2) / appState.zoom.value;
                                                            
                                                            // Create file entry
                                                            const files = excalidrawAPI.getFiles() || {};
                                                            files[fileId] = {
                                                                id: fileId,
                                                                mimeType: blob.type || 'image/png',
                                                                dataURL: dataUrl,
                                                                created: Date.now(),
                                                            };
                                                            
                                                            // Create image element
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
                                                            
                                                            // Update scene
                                                            const elements = excalidrawAPI.getSceneElements();
                                                            excalidrawAPI.updateScene({
                                                                elements: [...elements, imageElement],
                                                                files,
                                                            });
                                                            
                                                            setShowImageModal(false);
                                                            setImageUrl('');
                                                            setIsInsertingImage(false);
                                                        };
                                                        img.src = dataUrl;
                                                    };
                                                    reader.readAsDataURL(blob);
                                                } catch (error) {
                                                    console.error('Failed to insert image:', error);
                                                    alert('Failed to load image. Make sure the URL is correct and accessible.');
                                                    setIsInsertingImage(false);
                                                }
                                            }}
                                            disabled={!imageUrl || isInsertingImage}
                                            variant="primary"
                                            size="sm"
                                        >
                                            {isInsertingImage ? 'Inserting...' : 'Insert'}
                                        </Button>
                                    </div>
                                </div>
                                
                                <div className="ap-relative">
                                    <div className="ap-absolute ap-inset-0 ap-flex ap-items-center">
                                        <div className="ap-w-full ap-border-t ap-border-gray-200" />
                                    </div>
                                    <div className="ap-relative ap-flex ap-justify-center ap-text-sm">
                                        <span className="ap-px-2 ap-bg-white ap-text-gray-500">or</span>
                                    </div>
                                </div>
                                
                                {/* WordPress Media Library Option */}
                                <Button
                                    onClick={() => {
                                        const wp = (window as any).wp;
                                        if (!wp || !wp.media) {
                                            alert('WordPress Media Library is not available. Make sure you are logged in as an admin.');
                                            return;
                                        }
                                        
                                        const frame = wp.media({
                                            title: 'Select Image',
                                            button: { text: 'Insert Image' },
                                            multiple: false,
                                            library: { type: 'image' }
                                        });
                                        
                                        frame.on('select', async () => {
                                            if (!excalidrawAPI) return;
                                            setIsInsertingImage(true);
                                            
                                            try {
                                                const attachment = frame.state().get('selection').first().toJSON();
                                                const url = attachment.url;
                                                
                                                // Fetch image to create data URL
                                                const response = await fetch(url);
                                                const blob = await response.blob();
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    const dataUrl = reader.result as string;
                                                    const fileId = `file-${Date.now()}`;
                                                    
                                                    // Use attachment dimensions or defaults
                                                    let width = attachment.width || 300;
                                                    let height = attachment.height || 300;
                                                    const maxSize = 400;
                                                    if (width > maxSize || height > maxSize) {
                                                        const scale = maxSize / Math.max(width, height);
                                                        width *= scale;
                                                        height *= scale;
                                                    }
                                                    
                                                    // Get center of viewport
                                                    const appState = excalidrawAPI.getAppState();
                                                    const centerX = (appState.scrollX * -1) + (appState.width / 2) / appState.zoom.value;
                                                    const centerY = (appState.scrollY * -1) + (appState.height / 2) / appState.zoom.value;
                                                    
                                                    // Create file entry
                                                    const files = excalidrawAPI.getFiles() || {};
                                                    files[fileId] = {
                                                        id: fileId,
                                                        mimeType: attachment.subtype ? `image/${attachment.subtype}` : 'image/png',
                                                        dataURL: dataUrl,
                                                        created: Date.now(),
                                                    };
                                                    
                                                    // Create image element
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
                                                    
                                                    // Update scene
                                                    const elements = excalidrawAPI.getSceneElements();
                                                    excalidrawAPI.updateScene({
                                                        elements: [...elements, imageElement],
                                                        files,
                                                    });
                                                    
                                                    setShowImageModal(false);
                                                    setImageUrl('');
                                                    setIsInsertingImage(false);
                                                };
                                                reader.readAsDataURL(blob);
                                            } catch (error) {
                                                console.error('Failed to insert image:', error);
                                                alert('Failed to load image from media library.');
                                                setIsInsertingImage(false);
                                            }
                                        });
                                        
                                        frame.open();
                                    }}
                                    disabled={isInsertingImage}
                                    variant="secondary"
                                    size="md"
                                    className="ap-w-full"
                                >
                                    <HiOutlineFolderOpen className="ap-h-5 ap-w-5" />
                                    Select from Media Library
                                </Button>
                                
                                <p className="ap-text-xs ap-text-gray-500 ap-text-center">
                                    Images will be inserted at the center of your current view
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HybridLessonEditor;
