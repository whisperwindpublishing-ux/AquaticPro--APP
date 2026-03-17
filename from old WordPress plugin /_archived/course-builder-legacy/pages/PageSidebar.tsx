/**
 * Page Sidebar - Notion-like Navigation
 * 
 * Displays a tree of pages with:
 * - Nested subpages (expandable/collapsible)
 * - Drag and drop reordering
 * - Quick actions (add, delete, duplicate)
 * - Page icons and titles
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlineDocument,
    HiOutlineDocumentPlus,
    HiOutlineChevronRight,
    HiOutlineChevronDown,
    HiOutlineEllipsisHorizontal,
    HiOutlineTrash,
    HiOutlineDocumentDuplicate,
    HiOutlinePencil,
    HiOutlinePlus,
    HiOutlineFolder,
    HiOutlineFolderOpen,
} from 'react-icons/hi2';
import type { CoursePage, PageTreeNode } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface PageSidebarProps {
    pages: CoursePage[];
    selectedPageId: number | null;
    onSelectPage: (pageId: number) => void;
    onAddPage: (parentId?: number | null) => void;
    onDeletePage: (pageId: number) => void;
    onDuplicatePage: (pageId: number) => void;
    onReorderPages: (pages: CoursePage[]) => void;
    className?: string;
}

interface PageItemProps {
    page: CoursePage;
    depth: number;
    isSelected: boolean;
    isExpanded: boolean;
    hasChildren: boolean;
    onSelect: () => void;
    onToggleExpand: () => void;
    onAddSubpage: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

// ============================================================================
// PAGE ITEM COMPONENT
// ============================================================================

const PageItem: React.FC<PageItemProps> = ({
    page,
    depth,
    isSelected,
    isExpanded,
    hasChildren,
    onSelect,
    onToggleExpand,
    onAddSubpage,
    onDelete,
    onDuplicate,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    const paddingLeft = 12 + depth * 16;
    
    return (
        <div
            className={`group relative ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setShowMenu(false);
            }}
        >
            <div
                className={`flex items-center gap-1 py-1.5 pr-2 cursor-pointer transition-colors ${
                    isSelected ? 'text-purple-900' : 'text-gray-700'
                }`}
                style={{ paddingLeft }}
                onClick={onSelect}
            >
                {/* Expand/collapse toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand();
                    }}
                    className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                        !hasChildren && 'invisible'
                    }`}
                >
                    {isExpanded ? (
                        <HiOutlineChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <HiOutlineChevronRight className="w-3.5 h-3.5" />
                    )}
                </button>
                
                {/* Page icon */}
                <span className="text-base flex-shrink-0">
                    {page.icon || (hasChildren ? (isExpanded ? '📂' : '📁') : '📄')}
                </span>
                
                {/* Page title */}
                <span className={`flex-1 truncate text-sm ${isSelected ? 'font-medium' : ''}`}>
                    {page.title || 'Untitled'}
                </span>
                
                {/* Action buttons (visible on hover) */}
                {isHovered && (
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddSubpage();
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                            title="Add subpage"
                        >
                            <HiOutlinePlus className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(!showMenu);
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                            <HiOutlineEllipsisHorizontal className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                    </div>
                )}
            </div>
            
            {/* Context menu */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute right-2 top-full z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddSubpage();
                                setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <HiOutlineDocumentPlus className="w-4 h-4" />
                            Add subpage
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicate();
                                setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <HiOutlineDocumentDuplicate className="w-4 h-4" />
                            Duplicate
                        </button>
                        <hr className="my-1 border-gray-200" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                                setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                            Delete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

export const PageSidebar: React.FC<PageSidebarProps> = ({
    pages,
    selectedPageId,
    onSelectPage,
    onAddPage,
    onDeletePage,
    onDuplicatePage,
    onReorderPages,
    className = '',
}) => {
    // Track expanded state for each page
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    
    // Build tree structure from flat pages list
    const buildTree = useCallback((pages: CoursePage[]): Map<number | null, CoursePage[]> => {
        const tree = new Map<number | null, CoursePage[]>();
        
        // Initialize with empty arrays
        tree.set(null, []);
        pages.forEach(page => {
            if (!tree.has(page.id)) {
                tree.set(page.id, []);
            }
        });
        
        // Sort pages by display_order and group by parent
        const sorted = [...pages].sort((a, b) => a.display_order - b.display_order);
        sorted.forEach(page => {
            const siblings = tree.get(page.parent_id) || [];
            siblings.push(page);
            tree.set(page.parent_id, siblings);
        });
        
        return tree;
    }, []);
    
    const pageTree = buildTree(pages);
    
    // Toggle expanded state
    const toggleExpanded = (pageId: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(pageId)) {
                next.delete(pageId);
            } else {
                next.add(pageId);
            }
            return next;
        });
    };
    
    // Render page tree recursively
    const renderPages = (parentId: number | null, depth: number = 0): React.ReactNode => {
        const children = pageTree.get(parentId) || [];
        
        return children.map(page => {
            const pageChildren = pageTree.get(page.id) || [];
            const hasChildren = pageChildren.length > 0;
            const isExpanded = expandedIds.has(page.id);
            
            return (
                <div key={page.id}>
                    <PageItem
                        page={page}
                        depth={depth}
                        isSelected={selectedPageId === page.id}
                        isExpanded={isExpanded}
                        hasChildren={hasChildren}
                        onSelect={() => onSelectPage(page.id)}
                        onToggleExpand={() => toggleExpanded(page.id)}
                        onAddSubpage={() => onAddPage(page.id)}
                        onDelete={() => onDeletePage(page.id)}
                        onDuplicate={() => onDuplicatePage(page.id)}
                    />
                    
                    {/* Render children if expanded */}
                    {hasChildren && isExpanded && (
                        <div>
                            {renderPages(page.id, depth + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };
    
    return (
        <div className={`flex flex-col h-full bg-gray-50 border-r border-gray-200 ${className}`}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Pages
                    </span>
                    <button
                        onClick={() => onAddPage(null)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Add page"
                    >
                        <HiOutlinePlus className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>
            
            {/* Page tree */}
            <div className="flex-1 overflow-y-auto py-2">
                {pages.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <HiOutlineDocument className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No pages yet</p>
                        <button
                            onClick={() => onAddPage(null)}
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                        >
                            Create your first page
                        </button>
                    </div>
                ) : (
                    renderPages(null)
                )}
            </div>
            
            {/* Add page button at bottom */}
            <div className="flex-shrink-0 p-3 border-t border-gray-200">
                <button
                    onClick={() => onAddPage(null)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <HiOutlineDocumentPlus className="w-4 h-4" />
                    New Page
                </button>
            </div>
        </div>
    );
};

export default PageSidebar;
