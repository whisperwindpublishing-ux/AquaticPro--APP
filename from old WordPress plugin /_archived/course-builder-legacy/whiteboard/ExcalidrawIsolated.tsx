/**
 * ExcalidrawIsolated Component
 * 
 * Renders Excalidraw inside an iframe for complete CSS isolation.
 * Parent styles CANNOT penetrate iframe boundaries.
 * 
 * Uses a Blob URL to create an inline iframe with all necessary code.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { WhiteboardData } from './types';

interface ExcalidrawIsolatedProps {
    data?: WhiteboardData;
    readOnly?: boolean;
    onChange?: (data: WhiteboardData) => void;
    onReady?: (api: ExcalidrawIframeAPI) => void;
}

// API exposed by the iframe for parent communication
export interface ExcalidrawIframeAPI {
    getSceneElements: () => unknown[];
    getAppState: () => unknown;
    getFiles: () => Record<string, unknown>;
    updateScene: (scene: { elements?: unknown[]; files?: Record<string, unknown> }) => void;
}

const ExcalidrawIsolated: React.FC<ExcalidrawIsolatedProps> = ({
    data,
    readOnly = false,
    onChange,
    onReady,
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const onChangeRef = useRef(onChange);
    const onReadyRef = useRef(onReady);
    
    // Keep refs updated
    onChangeRef.current = onChange;
    onReadyRef.current = onReady;

    // Handle messages from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            
            const { type, payload } = event.data || {};
            
            switch (type) {
                case 'excalidraw-ready':
                    setIframeReady(true);
                    // Create API proxy
                    const api: ExcalidrawIframeAPI = {
                        getSceneElements: () => {
                            return new Promise((resolve) => {
                                const id = Date.now();
                                const handler = (e: MessageEvent) => {
                                    if (e.data?.type === 'api-response' && e.data?.id === id) {
                                        window.removeEventListener('message', handler);
                                        resolve(e.data.payload);
                                    }
                                };
                                window.addEventListener('message', handler);
                                iframeRef.current?.contentWindow?.postMessage({ type: 'api-call', method: 'getSceneElements', id }, '*');
                            }) as unknown as unknown[];
                        },
                        getAppState: () => {
                            return new Promise((resolve) => {
                                const id = Date.now();
                                const handler = (e: MessageEvent) => {
                                    if (e.data?.type === 'api-response' && e.data?.id === id) {
                                        window.removeEventListener('message', handler);
                                        resolve(e.data.payload);
                                    }
                                };
                                window.addEventListener('message', handler);
                                iframeRef.current?.contentWindow?.postMessage({ type: 'api-call', method: 'getAppState', id }, '*');
                            }) as unknown;
                        },
                        getFiles: () => {
                            return new Promise((resolve) => {
                                const id = Date.now();
                                const handler = (e: MessageEvent) => {
                                    if (e.data?.type === 'api-response' && e.data?.id === id) {
                                        window.removeEventListener('message', handler);
                                        resolve(e.data.payload);
                                    }
                                };
                                window.addEventListener('message', handler);
                                iframeRef.current?.contentWindow?.postMessage({ type: 'api-call', method: 'getFiles', id }, '*');
                            }) as unknown as Record<string, unknown>;
                        },
                        updateScene: (scene) => {
                            iframeRef.current?.contentWindow?.postMessage({ type: 'updateScene', payload: scene }, '*');
                        },
                    };
                    onReadyRef.current?.(api);
                    break;
                    
                case 'excalidraw-change':
                    onChangeRef.current?.(payload);
                    break;
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Send initial data and updates to iframe
    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;
        
        iframeRef.current.contentWindow.postMessage({
            type: 'init',
            payload: { data, readOnly },
        }, '*');
    }, [iframeReady, data, readOnly]);

    // Generate iframe HTML content
    const getIframeContent = useCallback(() => {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }
        .excalidraw { width: 100%; height: 100%; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18.2.0",
            "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
            "@excalidraw/excalidraw": "https://esm.sh/@excalidraw/excalidraw@0.18.0?external=react,react-dom"
        }
    }
    </script>
    <script type="module">
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { Excalidraw } from '@excalidraw/excalidraw';
        
        let excalidrawAPI = null;
        let currentData = null;
        let currentReadOnly = false;
        
        function App() {
            const [key, setKey] = React.useState(0);
            
            React.useEffect(() => {
                const handleMessage = (event) => {
                    const { type, payload, method, id } = event.data || {};
                    
                    switch (type) {
                        case 'init':
                            currentData = payload.data;
                            currentReadOnly = payload.readOnly;
                            setKey(k => k + 1);
                            break;
                        case 'updateScene':
                            if (excalidrawAPI) {
                                excalidrawAPI.updateScene(payload);
                            }
                            break;
                        case 'api-call':
                            if (excalidrawAPI) {
                                let result = null;
                                switch (method) {
                                    case 'getSceneElements':
                                        result = excalidrawAPI.getSceneElements();
                                        break;
                                    case 'getAppState':
                                        result = excalidrawAPI.getAppState();
                                        break;
                                    case 'getFiles':
                                        result = excalidrawAPI.getFiles();
                                        break;
                                }
                                window.parent.postMessage({ type: 'api-response', id, payload: result }, '*');
                            }
                            break;
                    }
                };
                
                window.addEventListener('message', handleMessage);
                return () => window.removeEventListener('message', handleMessage);
            }, []);
            
            const handleChange = React.useCallback((elements, appState, files) => {
                if (currentReadOnly) return;
                window.parent.postMessage({
                    type: 'excalidraw-change',
                    payload: {
                        elements: Array.from(elements),
                        appState: {
                            viewBackgroundColor: appState?.viewBackgroundColor,
                            zoom: appState?.zoom,
                            scrollX: appState?.scrollX,
                            scrollY: appState?.scrollY,
                        },
                        files,
                    },
                }, '*');
            }, []);
            
            const initialData = currentData ? {
                elements: currentData.elements || [],
                appState: {
                    ...currentData.appState,
                    viewBackgroundColor: currentData.appState?.viewBackgroundColor || '#ffffff',
                },
                files: currentData.files || {},
            } : undefined;
            
            return React.createElement(Excalidraw, {
                key,
                excalidrawAPI: (api) => {
                    excalidrawAPI = api;
                    window.parent.postMessage({ type: 'excalidraw-ready' }, '*');
                },
                initialData,
                onChange: handleChange,
                viewModeEnabled: currentReadOnly,
                zenModeEnabled: false,
                gridModeEnabled: false,
                theme: 'light',
                UIOptions: {
                    canvasActions: {
                        changeViewBackgroundColor: !currentReadOnly,
                        clearCanvas: !currentReadOnly,
                        export: { saveFileToDisk: true },
                        loadScene: !currentReadOnly,
                        saveToActiveFile: false,
                        toggleTheme: true,
                    },
                    tools: {
                        image: !currentReadOnly,
                    },
                },
            });
        }
        
        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
    </script>
</body>
</html>`;
    }, []);

    // Create blob URL for iframe
    const [iframeSrc, setIframeSrc] = useState<string>('');
    
    useEffect(() => {
        const html = getIframeContent();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setIframeSrc(url);
        
        return () => URL.revokeObjectURL(url);
    }, [getIframeContent]);

    return (
        <iframe
            ref={iframeRef}
            src={iframeSrc}
            style={{
                width: '100%',
                height: '100%',
                minHeight: '400px',
                border: 'none',
            }}
            title="Whiteboard Editor"
        />
    );
};

export default ExcalidrawIsolated;
