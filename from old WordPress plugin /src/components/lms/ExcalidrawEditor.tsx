/**
 * ExcalidrawEditor.tsx
 * 
 * Full Excalidraw editor for creating/editing visual lessons.
 * Includes all native features: drawing tools, collaboration, export, etc.
 * 
 * NOTE: Excalidraw manipulates the DOM directly, which can conflict with React's
 * virtual DOM reconciliation. We use a React Portal to render Excalidraw into
 * a manually-managed DOM node, completely isolating it from React's reconciliation.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Excalidraw, MainMenu, Footer, WelcomeScreen } from '@excalidraw/excalidraw';
import { Button } from '../ui';
import '@excalidraw/excalidraw/index.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineCloudArrowUp,
    HiOutlineCheck,
    HiOutlineExclamationTriangle,
    HiOutlinePhoto,
    HiOutlineArrowDownTray,
    HiOutlinePresentationChartLine,
    HiOutlineInformationCircle,
    HiOutlineFolderOpen,
} from 'react-icons/hi2';

// Excalidraw API type
type ExcalidrawAPI = {
    getSceneElements: () => any[];
    getAppState: () => any;
    getFiles: () => any;
    exportToBlob: (options: { mimeType: string; quality?: number }) => Promise<Blob>;
    exportToSvg: (options?: any) => Promise<SVGSVGElement>;
    scrollToContent: (element?: any, options?: any) => void;
    refresh: () => void;
    resetScene: () => void;
    updateScene: (data: any) => void;
    addFiles: (files: any[]) => void;
};

// Set asset path - use local plugin assets for fonts and icons
if (typeof window !== 'undefined') {
    const excalidrawPath = (window as any).aquaticProSettings?.excalidrawAssetPath;
    if (excalidrawPath) {
        (window as any).EXCALIDRAW_ASSET_PATH = excalidrawPath;
    } else {
        // Fallback to CDN if path not set
        console.warn('[ExcalidrawEditor] Local asset path not found, using CDN fallback');
        (window as any).EXCALIDRAW_ASSET_PATH = 'https://unpkg.com/@excalidraw/excalidraw@0.18.0/dist/prod/';
    }
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Frame {
    id: string;
    name: string;
    element: any;
}

interface ExcalidrawEditorProps {
    /** Lesson ID to save data to */
    lessonId: number;
    /** Initial Excalidraw JSON data */
    initialData?: string | object | null;
    /** Callback after successful save */
    onSave?: (data: string) => void;
    /** Callback on every change (throttled) */
    onChange?: (data: string) => void;
    /** Callback for presentation mode */
    onStartPresentation?: () => void;
    /** Height of editor */
    height?: string;
}

const ExcalidrawEditor: React.FC<ExcalidrawEditorProps> = ({
    lessonId,
    initialData,
    onSave,
    onChange,
    onStartPresentation,
    height = '100%',
}) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPI | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [hasChanges, setHasChanges] = useState(false);
    const [frameCount, setFrameCount] = useState(0);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const saveInProgressRef = useRef(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Image insertion modal state
    const [showMediaModal, setShowMediaModal] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [isInsertingImage, setIsInsertingImage] = useState(false);
    
    // Unique mount ID to prevent React reconciliation issues with Excalidraw's DOM manipulation
    const mountIdRef = useRef(`excalidraw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Portal container - we create a DOM node outside React's control
    const portalContainerRef = useRef<HTMLDivElement | null>(null);
    const [portalReady, setPortalReady] = useState(false);

    // Create portal container on mount - this isolates Excalidraw from React's DOM reconciliation
    useEffect(() => {
        console.log('[ExcalidrawEditor] Mount started, id:', mountIdRef.current);
        
        // Create a container div outside React's control
        const container = document.createElement('div');
        container.id = `excalidraw-portal-${mountIdRef.current}`;
        container.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
        portalContainerRef.current = container;
        
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            setPortalReady(true);
        }, 50);
        
        return () => {
            console.log('[ExcalidrawEditor] Unmounting, id:', mountIdRef.current);
            clearTimeout(timer);
            // Clean up the portal container
            if (portalContainerRef.current && portalContainerRef.current.parentNode) {
                portalContainerRef.current.parentNode.removeChild(portalContainerRef.current);
            }
            portalContainerRef.current = null;
        };
    }, []);

    // Parse initial data
    const parsedInitialData = useMemo(() => {
        if (!initialData) return undefined;
        
        try {
            if (typeof initialData === 'string') {
                return JSON.parse(initialData);
            }
            return initialData;
        } catch (e) {
            console.error('[ExcalidrawEditor] Failed to parse initial data:', e);
            return undefined;
        }
    }, [initialData]);

    // Handle data loading when initialData updates (e.g. after async fetch)
    useEffect(() => {
        if (!excalidrawAPI || !parsedInitialData) return;

        // Check if scene is empty to safely load data
        // If user already drew something while loading, we might not want to overwrite it?
        // But for "edit" mode, the DB state usually wins on initial load.
        // We check if elements count is low (just default) or if we are sure it's fresh.
        // A simple check is: if scene has 0 elements, definitely load.
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
                console.log('[ExcalidrawEditor] Adding', filesArray.length, 'files to scene');
                excalidrawAPI.addFiles(filesArray);
            }
        }
    }, [excalidrawAPI, parsedInitialData]);

    // Extract frames from Excalidraw and manage navigation
    useEffect(() => {
        if (!excalidrawAPI) return;
        
        const updateFrames = () => {
            const elements = excalidrawAPI.getSceneElements();
            const frameElements = elements.filter((el: any) => el.type === 'frame');
            
            const sortedFrames: Frame[] = frameElements
                .map((el: any) => ({
                    id: el.id,
                    name: el.name || `Slide ${frameElements.indexOf(el) + 1}`,
                    element: el,
                }))
                .sort((a, b) => a.element.x - b.element.x); // Sort by X position

            setFrames(sortedFrames);
            setFrameCount(sortedFrames.length);
        };

        updateFrames();
        // Check periodically for new frames
        const interval = setInterval(updateFrames, 3000);
        return () => clearInterval(interval);
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

    // Save function
    const saveData = useCallback(async () => {
        if (!excalidrawAPI || saveInProgressRef.current) return;

        saveInProgressRef.current = true;
        setSaveStatus('saving');

        try {
            const elements = excalidrawAPI.getSceneElements();
            const appState = excalidrawAPI.getAppState();
            const files = excalidrawAPI.getFiles();

            const sceneData = {
                type: 'excalidraw',
                version: 2,
                source: 'aquaticpro-lms',
                elements: elements,
                appState: {
                    viewBackgroundColor: appState.viewBackgroundColor,
                    gridSize: appState.gridSize,
                    currentItemFontFamily: appState.currentItemFontFamily,
                },
                files: files,
            };

            const jsonString = JSON.stringify(sceneData);

            // Save via API if lessonId exists
            if (lessonId > 0) {
                const response = await fetch(`/wp-json/aquaticpro/v1/lessons/${lessonId}/meta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (window as any).mentorshipPlatformData?.nonce || '',
                    },
                    body: JSON.stringify({
                        type: 'excalidraw',
                        data: jsonString,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Save failed');
                }
            }

            setSaveStatus('saved');
            setHasChanges(false);

            if (onSave) {
                onSave(jsonString);
            }

            // Reset status after delay
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('[ExcalidrawEditor] Save failed:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            saveInProgressRef.current = false;
        }
    }, [excalidrawAPI, lessonId, onSave]);

    // Track if there are pending changes for auto-save
    const pendingChangesRef = useRef(false);
    const lastChangeTimeRef = useRef(0);

    // Auto-save with debounce - use any for Excalidraw's complex types
    const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
        // Skip if this is just initial load (no user interaction)
        const now = Date.now();
        if (lastChangeTimeRef.current === 0) {
            lastChangeTimeRef.current = now;
            return; // Skip the initial render
        }
        
        // Debounce rapid changes (must be at least 100ms apart to count)
        if (now - lastChangeTimeRef.current < 100) {
            return;
        }
        lastChangeTimeRef.current = now;
        
        setHasChanges(true);
        pendingChangesRef.current = true;

        // Propagate changes to parent immediately
        if (onChange) {
            const sceneData = {
                type: 'excalidraw',
                version: 2,
                source: 'aquaticpro-lms',
                elements: elements,
                appState: {
                    viewBackgroundColor: appState.viewBackgroundColor,
                    gridSize: appState.gridSize,
                    currentItemFontFamily: appState.currentItemFontFamily,
                },
                files: files,
            };
            onChange(JSON.stringify(sceneData));
        }
        
        // Clear existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        // Auto-save after 5 seconds of inactivity (only if lessonId exists)
        if (lessonId > 0) {
            autoSaveTimerRef.current = setTimeout(() => {
                if (pendingChangesRef.current) {
                    pendingChangesRef.current = false;
                    saveData();
                }
            }, 5000);
        }
    }, [lessonId, saveData]);

    // Export to PNG
    const exportToPNG = useCallback(async () => {
        if (!excalidrawAPI) return;

        try {
            const blob = await excalidrawAPI.exportToBlob({
                mimeType: 'image/png',
                quality: 1,
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lesson-${lessonId || 'new'}-excalidraw.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[ExcalidrawEditor] Export failed:', error);
        }
    }, [excalidrawAPI, lessonId]);

    // Export to SVG
    const exportToSVG = useCallback(async () => {
        if (!excalidrawAPI) return;

        try {
            const svg = await excalidrawAPI.exportToSvg();
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lesson-${lessonId || 'new'}-excalidraw.svg`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[ExcalidrawEditor] SVG export failed:', error);
        }
    }, [excalidrawAPI, lessonId]);

    // Keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveData();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveData]);

    // Cleanup auto-save timer
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    const getSaveStatusIcon = () => {
        switch (saveStatus) {
            case 'saving':
                return <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-2 ap-border-white ap-border-t-transparent" />;
            case 'saved':
                return <HiOutlineCheck className="ap-h-4 ap-w-4" />;
            case 'error':
                return <HiOutlineExclamationTriangle className="ap-h-4 ap-w-4" />;
            default:
                return <HiOutlineCloudArrowUp className="ap-h-4 ap-w-4" />;
        }
    };

    const getSaveStatusColor = () => {
        switch (saveStatus) {
            case 'saving':
                return 'bg-blue-500';
            case 'saved':
                return 'bg-green-500';
            case 'error':
                return 'bg-red-500';
            default:
                return hasChanges ? 'ap-bg-amber-500' : 'ap-bg-gray-400';
        }
    };

    return (
        <div style={{ width: '100%', height, position: 'relative' }} className="ap-flex ap-flex-col ap-bg-gray-50">
            {/* Slide Navigation Toolbar */}
            {frames.length > 0 && (
                <div className="ap-flex-none ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2 ap-bg-white ap-border-b ap-border-gray-200 ap-shadow-sm ap-z-10">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => goToFrame(currentFrameIndex - 1)}
                            disabled={currentFrameIndex === 0}
                            className="!ap-p-1.5 !ap-min-h-0"
                            title="Previous Slide"
                        >
                            <svg className="ap-w-5 ap-h-5 ap-text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Button>
                        
                        <span className="ap-text-sm ap-font-medium ap-text-gray-700 ap-select-none ap-min-w-[100px] ap-text-center">
                            {frames[currentFrameIndex]?.name || `Slide ${currentFrameIndex + 1}`}
                            <span className="ap-text-gray-400 ap-font-normal ap-ml-1">
                                ({currentFrameIndex + 1}/{frames.length})
                            </span>
                        </span>

                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => goToFrame(currentFrameIndex + 1)}
                            disabled={currentFrameIndex === frames.length - 1}
                            className="!ap-p-1.5 !ap-min-h-0"
                            title="Next Slide"
                        >
                            <svg className="ap-w-5 ap-h-5 ap-text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Button>
                        
                        <div className="group ap-relative ap-ml-1">
                            <HiOutlineInformationCircle className="ap-w-4 ap-h-4 ap-text-gray-400 ap-cursor-help" />
                             <div className="ap-absolute ap-top-full ap-left-1/2 -ap-translate-x-1/2 ap-mt-2 ap-w-48 ap-bg-gray-800 ap-text-white ap-text-xs ap-p-2 ap-rounded ap-hidden group-hover:ap-block ap-transition-opacity ap-z-50 ap-pointer-events-none ap-shadow-lg">
                                Slides are ordered left-to-right on the canvas. Move frames to reorder them.
                                <div className="ap-absolute -ap-top-1 ap-left-1/2 -ap-translate-x-1/2 ap-w-2 ap-h-2 ap-bg-gray-800 ap-rotate-45"></div>
                            </div>
                        </div>
                    </div>

                    <div className="ap-flex ap-items-center ap-gap-4 ap-text-xs ap-text-gray-500">
                        {onStartPresentation && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onStartPresentation}
                                className="!ap-bg-blue-50 hover:!ap-bg-blue-100 !ap-text-blue-700"
                            >
                                <HiOutlinePresentationChartLine className="ap-w-4 ap-h-4" />
                                Present
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div 
                id={mountIdRef.current}
                className="excalidraw-wrapper ap-flex-grow ap-relative" 
                style={{ width: '100%' }}
                ref={(node) => {
                    // Attach portal container when wrapper div is ready
                    if (node && portalContainerRef.current && !portalContainerRef.current.parentNode) {
                        node.appendChild(portalContainerRef.current);
                    }
                }}
            >
                {/* Use Portal to render Excalidraw outside React's normal DOM reconciliation */}
                {portalReady && portalContainerRef.current && createPortal(
                    <Excalidraw
                        excalidrawAPI={(api: any) => setExcalidrawAPI(api as ExcalidrawAPI)}
                        initialData={parsedInitialData}
                        onChange={handleChange}
                        theme="light"
                        langCode="en"
                        UIOptions={{
                            canvasActions: {
                                export: { saveFileToDisk: true },
                                loadScene: true,
                                saveToActiveFile: false,
                            },
                            tools: {
                                image: true,
                            }
                        }}
                    >
                    <MainMenu>
                        <MainMenu.DefaultItems.LoadScene />
                        <MainMenu.DefaultItems.Export />
                        <MainMenu.DefaultItems.SaveAsImage />
                        <MainMenu.DefaultItems.ClearCanvas />
                        <MainMenu.Separator />
                        <MainMenu.Item onSelect={() => setShowMediaModal(true)} icon={<HiOutlineFolderOpen className="ap-h-4 ap-w-4" />}>
                            Insert Image
                        </MainMenu.Item>
                        <MainMenu.Separator />
                        <MainMenu.DefaultItems.ChangeCanvasBackground />
                        <MainMenu.DefaultItems.ToggleTheme />
                        <MainMenu.Separator />
                        <MainMenu.Item onSelect={exportToPNG} icon={<HiOutlinePhoto className="ap-h-4 ap-w-4" />}>
                            Export as PNG
                        </MainMenu.Item>
                        <MainMenu.Item onSelect={exportToSVG} icon={<HiOutlineArrowDownTray className="ap-h-4 ap-w-4" />}>
                            Export as SVG
                        </MainMenu.Item>
                        {onStartPresentation && frameCount > 0 && (
                            <>
                                <MainMenu.Separator />
                                <MainMenu.Item 
                                    onSelect={onStartPresentation} 
                                    icon={<HiOutlinePresentationChartLine className="ap-h-4 ap-w-4" />}
                                >
                                    Start Presentation ({frameCount} slides)
                                </MainMenu.Item>
                            </>
                        )}
                        <MainMenu.Separator />
                        <MainMenu.DefaultItems.Help />
                    </MainMenu>

                    <WelcomeScreen>
                        <WelcomeScreen.Hints.MenuHint />
                        <WelcomeScreen.Hints.ToolbarHint />
                        <WelcomeScreen.Hints.HelpHint />
                        <WelcomeScreen.Center>
                            <WelcomeScreen.Center.Logo>
                                <div className="ap-text-2xl ap-font-bold ap-text-blue-600">AquaticPro</div>
                            </WelcomeScreen.Center.Logo>
                            <WelcomeScreen.Center.Heading>
                                Visual Lesson Editor
                            </WelcomeScreen.Center.Heading>
                            <WelcomeScreen.Center.Menu>
                                <WelcomeScreen.Center.MenuItemLoadScene />
                                <WelcomeScreen.Center.MenuItemHelp />
                            </WelcomeScreen.Center.Menu>
                        </WelcomeScreen.Center>
                    </WelcomeScreen>

                    <Footer>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-px-2 ap-py-1 ap-text-xs ap-text-gray-500">
                            {frameCount > 0 && (
                                <span className="ap-flex ap-items-center ap-gap-1 ap-bg-blue-100 ap-text-blue-700 ap-px-2 ap-py-0.5 ap-rounded">
                                    <HiOutlinePresentationChartLine className="ap-h-3 ap-w-3" />
                                    {frameCount} slides
                                </span>
                            )}
                            <span>Use Frames (F) to create presentation slides</span>
                        </div>
                    </Footer>
                    </Excalidraw>,
                    portalContainerRef.current
                )}
                {!portalReady && (
                    <div className="ap-flex ap-items-center ap-justify-center ap-h-full ap-bg-gray-50">
                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
                    </div>
                )}
            </div>

            {/* Floating Save Status Indicator */}
            <AnimatePresence>
                {(hasChanges || saveStatus !== 'idle') && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`ap-absolute ap-bottom-4 ap-right-4 ap-flex ap-items-center ap-gap-2 ap-px-4 ap-py-2 ap-rounded-lg ap-text-white ap-text-sm ap-font-medium ap-shadow-lg ap-cursor-pointer ${getSaveStatusColor()}`}
                        onClick={saveData}
                        title="Click to save now (Ctrl+S)"
                    >
                        {getSaveStatusIcon()}
                        <span>
                            {saveStatus === 'saving' && 'Saving...'}
                            {saveStatus === 'saved' && 'Saved!'}
                            {saveStatus === 'error' && 'Save failed'}
                            {saveStatus === 'idle' && hasChanges && 'Unsaved changes'}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Presentation Mode Button - Show here only if no frames (toolbar hidden) */}
            {onStartPresentation && frames.length === 0 && (
                <Button
                    variant="outline"
                    size="sm"
                    className="ap-absolute ap-top-4 ap-right-20 ap-z-10 ap-shadow-sm ap-select-none"
                    onClick={onStartPresentation}
                    title="Start Presentation Mode"
                >
                    <HiOutlinePresentationChartLine className="ap-h-4 ap-w-4" />
                    <span>Present</span>
                </Button>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="ap-absolute ap-bottom-4 ap-left-4 ap-text-xs ap-text-gray-400">
                Ctrl+S to save • F for Frame tool
            </div>

            {/* Insert Image Modal */}
            <AnimatePresence>
                {showMediaModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="ap-fixed ap-inset-0 ap-bg-black/50 ap-flex ap-items-center ap-justify-center ap-z-[10000]"
                        onClick={() => { setShowMediaModal(false); setImageUrl(''); }}
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
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => { setShowMediaModal(false); setImageUrl(''); }}
                                    className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-gray-600"
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
                                            variant="primary"
                                            size="sm"
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
                                                            
                                                            setShowMediaModal(false);
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
                                    variant="secondary"
                                    size="md"
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
                                                    
                                                    setShowMediaModal(false);
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
                                    className="ap-w-full ap-justify-center"
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

export default ExcalidrawEditor;
