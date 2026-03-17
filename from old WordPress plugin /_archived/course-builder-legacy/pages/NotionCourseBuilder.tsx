/**
 * Notion-like Course Builder
 * 
 * A new course editing experience inspired by Notion:
 * - Flat/nested page structure (no rigid Section hierarchy)
 * - Each page can be content, whiteboard, or mixed
 * - Inline video playback
 * - Page linking and backlinks
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineArrowLeft,
    HiOutlineCog6Tooth,
    HiOutlineEye,
    HiOutlinePencilSquare,
    HiOutlineShare,
    HiOutlineUsers,
} from 'react-icons/hi2';
import type { Course } from '../types';
import type { CoursePage, PageContent, ApiResponse } from './types';
import PageSidebar from './PageSidebar';
import PageEditor from './PageEditor';

// ============================================================================
// TYPES
// ============================================================================

export interface NotionCourseBuilderProps {
    courseId: number;
    onBack: () => void;
    canEdit: boolean;
}

// ============================================================================
// API FUNCTIONS (will be moved to api.ts)
// ============================================================================

declare const wpApiSettings: { root: string; nonce: string };

const getApiBase = () => {
    if (typeof wpApiSettings !== 'undefined') {
        return wpApiSettings.root + 'mentorship/v1';
    }
    return '/wp-json/mentorship/v1';
};

const getHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) {
        headers['X-WP-Nonce'] = wpApiSettings.nonce;
    }
    return headers;
};

// Fetch course with pages
async function getCourseWithPages(courseId: number): Promise<ApiResponse<{ course: Course; pages: CoursePage[] }>> {
    const response = await fetch(`${getApiBase()}/courses/${courseId}/pages`, {
        headers: getHeaders(),
    });
    return response.json();
}

// Create a new page
async function createPage(data: Partial<CoursePage>): Promise<ApiResponse<CoursePage>> {
    const response = await fetch(`${getApiBase()}/course-pages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

// Update a page
async function updatePage(pageId: number, data: Partial<CoursePage>): Promise<ApiResponse<CoursePage>> {
    const response = await fetch(`${getApiBase()}/course-pages/${pageId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

// Delete a page
async function deletePage(pageId: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/course-pages/${pageId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return response.json();
}

// Get page content
async function getPageContent(pageId: number): Promise<ApiResponse<PageContent>> {
    const response = await fetch(`${getApiBase()}/course-pages/${pageId}/content`, {
        headers: getHeaders(),
    });
    return response.json();
}

// Save page content
async function savePageContent(pageId: number, content: Partial<PageContent>): Promise<ApiResponse<PageContent>> {
    const response = await fetch(`${getApiBase()}/course-pages/${pageId}/content`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(content),
    });
    return response.json();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const NotionCourseBuilder: React.FC<NotionCourseBuilderProps> = ({
    courseId,
    onBack,
    canEdit,
}) => {
    // State
    const [course, setCourse] = useState<Course | null>(null);
    const [pages, setPages] = useState<CoursePage[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
    const [selectedPageContent, setSelectedPageContent] = useState<PageContent | null>(null);
    const [isEditing, setIsEditing] = useState(canEdit);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(280);
    
    // Load course and pages
    useEffect(() => {
        const loadCourse = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await getCourseWithPages(courseId);
                if (response.success && response.data) {
                    setCourse(response.data.course);
                    setPages(response.data.pages);
                    
                    // Select first page if available
                    if (response.data.pages.length > 0) {
                        setSelectedPageId(response.data.pages[0].id);
                    }
                } else {
                    setError(response.error || 'Failed to load course');
                }
            } catch (err) {
                console.error('Failed to load course:', err);
                setError('Failed to load course');
            } finally {
                setLoading(false);
            }
        };
        
        loadCourse();
    }, [courseId]);
    
    // Load selected page content
    useEffect(() => {
        if (!selectedPageId) {
            setSelectedPageContent(null);
            return;
        }
        
        const loadContent = async () => {
            try {
                const response = await getPageContent(selectedPageId);
                if (response.success && response.data) {
                    setSelectedPageContent(response.data);
                } else {
                    // New page with no content yet
                    setSelectedPageContent(null);
                }
            } catch (err) {
                console.error('Failed to load page content:', err);
                setSelectedPageContent(null);
            }
        };
        
        loadContent();
    }, [selectedPageId]);
    
    // Get currently selected page
    const selectedPage = pages.find(p => p.id === selectedPageId);
    
    // Handler: Add new page
    const handleAddPage = useCallback(async (parentId: number | null = null) => {
        try {
            // Calculate display order
            const siblings = pages.filter(p => p.parent_id === parentId);
            const displayOrder = siblings.length;
            
            const response = await createPage({
                course_id: courseId,
                parent_id: parentId,
                title: 'Untitled',
                page_type: 'content',
                display_order: displayOrder,
                is_published: false,
            });
            
            if (response.success && response.data) {
                setPages(prev => [...prev, response.data!]);
                setSelectedPageId(response.data.id);
            }
        } catch (err) {
            console.error('Failed to create page:', err);
        }
    }, [courseId, pages]);
    
    // Handler: Delete page
    const handleDeletePage = useCallback(async (pageId: number) => {
        if (!confirm('Delete this page and all its subpages?')) return;
        
        try {
            const response = await deletePage(pageId);
            if (response.success) {
                // Remove page and all children
                const idsToRemove = new Set<number>();
                const collectIds = (id: number) => {
                    idsToRemove.add(id);
                    pages.filter(p => p.parent_id === id).forEach(p => collectIds(p.id));
                };
                collectIds(pageId);
                
                setPages(prev => prev.filter(p => !idsToRemove.has(p.id)));
                
                // Select another page if current was deleted
                if (selectedPageId && idsToRemove.has(selectedPageId)) {
                    const remaining = pages.filter(p => !idsToRemove.has(p.id));
                    setSelectedPageId(remaining.length > 0 ? remaining[0].id : null);
                }
            }
        } catch (err) {
            console.error('Failed to delete page:', err);
        }
    }, [pages, selectedPageId]);
    
    // Handler: Duplicate page
    const handleDuplicatePage = useCallback(async (pageId: number) => {
        const page = pages.find(p => p.id === pageId);
        if (!page) return;
        
        try {
            const response = await createPage({
                course_id: courseId,
                parent_id: page.parent_id,
                title: `${page.title} (copy)`,
                icon: page.icon,
                page_type: page.page_type,
                display_order: page.display_order + 1,
                is_published: false,
            });
            
            if (response.success && response.data) {
                setPages(prev => [...prev, response.data!]);
                setSelectedPageId(response.data.id);
                
                // TODO: Also copy content
            }
        } catch (err) {
            console.error('Failed to duplicate page:', err);
        }
    }, [courseId, pages]);
    
    // Handler: Save page content
    const handleSaveContent = useCallback(async (content: Partial<PageContent>) => {
        if (!selectedPageId) return;
        
        await savePageContent(selectedPageId, content);
    }, [selectedPageId]);
    
    // Handler: Update page title
    const handleTitleChange = useCallback(async (title: string) => {
        if (!selectedPageId) return;
        
        try {
            await updatePage(selectedPageId, { title });
            setPages(prev => prev.map(p => 
                p.id === selectedPageId ? { ...p, title } : p
            ));
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    }, [selectedPageId]);
    
    // Handler: Update page icon
    const handleIconChange = useCallback(async (icon: string | null) => {
        if (!selectedPageId) return;
        
        try {
            await updatePage(selectedPageId, { icon });
            setPages(prev => prev.map(p => 
                p.id === selectedPageId ? { ...p, icon } : p
            ));
        } catch (err) {
            console.error('Failed to update icon:', err);
        }
    }, [selectedPageId]);
    
    // Handler: Update page type
    const handlePageTypeChange = useCallback(async (page_type: CoursePage['page_type']) => {
        if (!selectedPageId) return;
        
        try {
            await updatePage(selectedPageId, { page_type });
            setPages(prev => prev.map(p => 
                p.id === selectedPageId ? { ...p, page_type } : p
            ));
        } catch (err) {
            console.error('Failed to update page type:', err);
        }
    }, [selectedPageId]);
    
    // Handler: Reorder pages
    const handleReorderPages = useCallback(async (reorderedPages: CoursePage[]) => {
        setPages(reorderedPages);
        // TODO: Save to backend
    }, []);
    
    // ========================================================================
    // RENDER
    // ========================================================================
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Go Back
                </button>
            </div>
        );
    }
    
    return (
        <div className="flex h-full bg-white">
            {/* Sidebar */}
            <div style={{ width: sidebarWidth }} className="flex-shrink-0">
                {/* Course header in sidebar */}
                <div className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 bg-white">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <HiOutlineArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-gray-900 truncate flex-1">
                        {course?.title || 'Course'}
                    </span>
                </div>
                
                <PageSidebar
                    pages={pages}
                    selectedPageId={selectedPageId}
                    onSelectPage={setSelectedPageId}
                    onAddPage={handleAddPage}
                    onDeletePage={handleDeletePage}
                    onDuplicatePage={handleDuplicatePage}
                    onReorderPages={handleReorderPages}
                    className="h-[calc(100%-3.5rem)]"
                />
            </div>
            
            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2">
                        {selectedPage && (
                            <span className="text-sm text-gray-500">
                                {selectedPage.is_published ? 'Published' : 'Draft'}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Edit/View toggle */}
                        {canEdit && (
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    isEditing 
                                        ? 'bg-purple-100 text-purple-700' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {isEditing ? (
                                    <>
                                        <HiOutlinePencilSquare className="w-4 h-4" />
                                        Editing
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineEye className="w-4 h-4" />
                                        Viewing
                                    </>
                                )}
                            </button>
                        )}
                        
                        {/* Share button */}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <HiOutlineShare className="w-5 h-5 text-gray-500" />
                        </button>
                        
                        {/* Settings */}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <HiOutlineCog6Tooth className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </header>
                
                {/* Page editor */}
                <div className="flex-1 min-h-0">
                    {selectedPage ? (
                        <PageEditor
                            key={selectedPage.id}
                            page={selectedPage}
                            content={selectedPageContent}
                            isEditing={isEditing}
                            onSave={handleSaveContent}
                            onTitleChange={handleTitleChange}
                            onIconChange={handleIconChange}
                            onPageTypeChange={handlePageTypeChange}
                            onAddSubpage={() => handleAddPage(selectedPageId)}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <p className="mb-4">No page selected</p>
                            <button
                                onClick={() => handleAddPage(null)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                            >
                                Create your first page
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotionCourseBuilder;
