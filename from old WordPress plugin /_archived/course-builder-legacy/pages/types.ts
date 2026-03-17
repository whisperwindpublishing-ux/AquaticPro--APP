/**
 * Course Builder - Page-Based Types (Notion-like)
 * 
 * New structure: Course → Pages (flat/nested)
 * Each page can be: content (rich text), whiteboard, or a combination
 */

export type PageType = 'content' | 'whiteboard' | 'mixed';
export type PageIcon = string; // Emoji or icon identifier

export interface CoursePage {
    id: number;
    course_id: number;
    parent_id: number | null; // null = top-level page, number = subpage
    title: string;
    icon: PageIcon | null;
    cover_image_url: string | null;
    page_type: PageType;
    display_order: number;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    // Runtime data (not stored)
    children?: CoursePage[];
    depth?: number;
}

export interface PageContent {
    id: number;
    page_id: number;
    // BlockNote JSON content for rich text
    content_json: string | null;
    // Excalidraw whiteboard data
    whiteboard_data: WhiteboardData | null;
    created_at: string;
    updated_at: string;
}

export interface WhiteboardData {
    elements: ExcalidrawElement[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
}

// Excalidraw element types
export interface ExcalidrawElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    [key: string]: unknown;
}

// Page link - for connecting pages together (like Notion backlinks)
export interface PageLink {
    id: number;
    source_page_id: number;
    target_page_id: number;
    link_text: string;
    created_at: string;
}

// Video embed that can be placed in whiteboard and plays inline
export interface VideoEmbed {
    id: string;
    url: string;
    type: 'youtube' | 'vimeo' | 'wordpress' | 'direct';
    title?: string;
    thumbnail_url?: string;
    // Position in whiteboard
    x: number;
    y: number;
    width: number;
    height: number;
}

// API Response wrapper
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Course with pages (new structure)
export interface CourseWithPages {
    id: number;
    title: string;
    description: string;
    image_url: string;
    status: 'draft' | 'published' | 'archived';
    created_by: number;
    created_at: string;
    updated_at: string;
    pages: CoursePage[];
}

// Page tree node for sidebar navigation
export interface PageTreeNode {
    page: CoursePage;
    children: PageTreeNode[];
    isExpanded: boolean;
}

// Editor state
export interface PageEditorState {
    currentPageId: number | null;
    isEditing: boolean;
    hasUnsavedChanges: boolean;
    lastSavedAt: string | null;
}
