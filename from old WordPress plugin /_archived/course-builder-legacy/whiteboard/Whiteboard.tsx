/**
 * Whiteboard Component
 * 
 * A responsive Excalidraw-based whiteboard that fits any container size.
 * Supports view/edit modes, auto-save, and data persistence.
 * Integrates with WordPress media library for image insertion.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { motion } from 'framer-motion';
import { HiOutlineCloudArrowUp, HiOutlineCheck, HiOutlineExclamationCircle, HiOutlinePhoto } from 'react-icons/hi2';
import type { WhiteboardData, WhiteboardProps, ExcalidrawElement, AppState, BinaryFiles } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

// Debounce helper
function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<NodeJS.Timeout>();
    
    return useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]) as T;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const Whiteboard: React.FC<WhiteboardProps> = ({
    data,
    readOnly = false,
    onChange,
    onSave,
    className = '',
}) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const lastSavedDataRef = useRef<string>('');
    const isInitializedRef = useRef(false);
    
    // Initialize with provided data
    const initialData = data ? {
        elements: data.elements || [],
        appState: {
            ...data.appState,
            viewBackgroundColor: data.appState?.viewBackgroundColor || '#ffffff',
        },
        files: data.files || {},
    } : undefined;
    
    // Initialize lastSavedDataRef with initial data to prevent onChange on first render
    if (!isInitializedRef.current && data) {
        lastSavedDataRef.current = JSON.stringify({ elements: data.elements || [], files: data.files || {} });
        isInitializedRef.current = true;
    }
    
    // Handle changes from Excalidraw
    const handleChange = useCallback((
        elements: readonly ExcalidrawElement[],
        appState: AppState,
        files: BinaryFiles
    ) => {
        if (readOnly) return;
        
        const newData: WhiteboardData = {
            elements: elements as ExcalidrawElement[],
            appState: {
                viewBackgroundColor: appState?.viewBackgroundColor,
                zoom: appState?.zoom,
                scrollX: appState?.scrollX,
                scrollY: appState?.scrollY,
            },
            files,
        };
        
        // Check if data actually changed (skip initial render)
        const newDataString = JSON.stringify({ elements: newData.elements, files: newData.files });
        if (newDataString !== lastSavedDataRef.current) {
            lastSavedDataRef.current = newDataString;
            setHasUnsavedChanges(true);
            onChange?.(newData);
        }
    }, [readOnly, onChange]);
    
    // Auto-save with debounce
    const debouncedSave = useDebouncedCallback(async () => {
        if (!excalidrawAPI || readOnly || !onSave) return;
        
        try {
            const elements = excalidrawAPI.getSceneElements();
            const appState = excalidrawAPI.getAppState();
            const files = excalidrawAPI.getFiles();
            
            const dataToSave: WhiteboardData = {
                elements: elements as ExcalidrawElement[],
                appState: {
                    viewBackgroundColor: appState?.viewBackgroundColor,
                    zoom: appState?.zoom,
                    scrollX: appState?.scrollX,
                    scrollY: appState?.scrollY,
                },
                files,
            };
            
            setSaveStatus('saving');
            await onSave(dataToSave);
            lastSavedDataRef.current = JSON.stringify({ elements: dataToSave.elements, files: dataToSave.files });
            setHasUnsavedChanges(false);
            setSaveStatus('saved');
            
            // Reset to idle after showing saved status
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save whiteboard:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }, 2000);
    
    // Trigger auto-save when changes are detected
    useEffect(() => {
        if (hasUnsavedChanges && onSave) {
            debouncedSave();
        }
    }, [hasUnsavedChanges, debouncedSave, onSave]);
    
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
                
            } catch (error) {
                console.error('Failed to insert image:', error);
            }
        });
        
        mediaFrame.open();
    }, [excalidrawAPI]);
    
    // Save status indicator
    const renderSaveStatus = () => {
        if (readOnly) return null;
        
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-3 right-3 z-10"
            >
                {saveStatus === 'saving' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
                        <HiOutlineCloudArrowUp className="w-4 h-4 animate-pulse" />
                        Saving...
                    </div>
                )}
                {saveStatus === 'saved' && (
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-sm font-medium"
                    >
                        <HiOutlineCheck className="w-4 h-4" />
                        Saved
                    </motion.div>
                )}
                {saveStatus === 'error' && (
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium"
                    >
                        <HiOutlineExclamationCircle className="w-4 h-4" />
                        Save failed
                    </motion.div>
                )}
            </motion.div>
        );
    };
    
    return (
        <div className={`relative w-full h-full min-h-[400px] ${className}`}>
            {renderSaveStatus()}
            
            {/* WordPress Media Library Button */}
            {!readOnly && (
                <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={openMediaLibrary}
                    className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    title="Insert image from WordPress Media Library"
                >
                    <HiOutlinePhoto className="w-4 h-4" />
                    Media Library
                </motion.button>
            )}
            
            <div className="w-full h-full excalidraw-wrapper">
                <Excalidraw
                    excalidrawAPI={(api) => setExcalidrawAPI(api)}
                    initialData={initialData}
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
                            loadScene: !readOnly,
                            saveToActiveFile: false,
                            toggleTheme: true,
                        },
                        tools: {
                            image: !readOnly,
                        },
                    }}
                />
            </div>
        </div>
    );
};

export default Whiteboard;
export { Whiteboard };
