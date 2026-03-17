/**
 * Hierarchy Card Component
 * 
 * Renders a card for courses, sections, or lessons in the hierarchy navigator
 * Supports drag & drop reordering, image upload, and section color theming
 */
import React, { useState, useRef, useEffect } from 'react';
import { 
    HiOutlineEllipsisVertical,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlinePhoto,
    HiOutlineChevronRight,
    HiOutlineUsers,
    HiOutlineGlobeAlt,
    HiOutlineEyeSlash,
    HiOutlineBars3,
    HiOutlineDocumentText
} from 'react-icons/hi2';
import { Course, Section, Lesson, SectionColor, SECTION_COLOR_CONFIG } from './types';
import ImageUploadModal from './ImageUploadModal';
import SectionColorPicker from './SectionColorPicker';

interface HierarchyCardProps {
    item: Course | Section | Lesson;
    type: 'course' | 'section' | 'lesson';
    isEditMode: boolean;
    childLabel: string;
    onClick: () => void;
    onUpdate: (data: Record<string, unknown>) => void;
    onDelete: () => void;
    /** Open in Notion-style editor (courses only) */
    onOpenNotion?: () => void;
    /** Section theme color for lessons */
    sectionColor?: SectionColor | null;
    /** Drag handle props from dnd-kit */
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
    /** Is currently being dragged */
    isDragging?: boolean;
}

const HierarchyCard: React.FC<HierarchyCardProps> = ({
    item,
    type,
    isEditMode,
    childLabel,
    onClick,
    onUpdate,
    onDelete,
    onOpenNotion,
    sectionColor,
    dragHandleProps,
    isDragging = false
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);
    const [editDescription, setEditDescription] = useState('description' in item ? (item.description || '') : '');
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get theme color - sections use their own, lessons inherit from parent
    const themeColor = type === 'section' 
        ? ('theme_color' in item ? (item as Section).theme_color : null)
        : sectionColor;
    const colorConfig = themeColor ? SECTION_COLOR_CONFIG[themeColor] : null;

    // Get image URL based on item type
    const getImageUrl = (): string => {
        if (type === 'lesson') {
            return (item as Lesson).header_image_url || (item as Lesson).image_url || '';
        }
        return (item as Course | Section).image_url || '';
    };

    // Get child count based on item type
    const getChildCount = (): number => {
        if (type === 'course') {
            return (item as Course).section_count || 0;
        }
        if (type === 'section') {
            return (item as Section).lesson_count || 0;
        }
        return 0;
    };

    // Get status for courses
    const getStatus = () => {
        if ('status' in item) return item.status;
        return null;
    };

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when editing
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSaveEdit = () => {
        onUpdate({ title: editTitle, description: editDescription });
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditTitle(item.title);
        setEditDescription('description' in item ? (item.description || '') : '');
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const imageUrl = getImageUrl();
    const childCount = getChildCount();
    const status = getStatus();

    // Status badge colors
    const statusColors = {
        draft: 'bg-gray-100 text-gray-600',
        published: 'bg-green-100 text-green-700',
        archived: 'bg-amber-100 text-amber-700'
    };

    // Dynamic border/accent color based on theme
    const borderClass = colorConfig 
        ? `border-2 ${colorConfig.border}` 
        : 'border border-gray-200';
    const accentGradient = colorConfig?.gradient || '';

    return (
        <>
        <div
            className={`
                relative bg-white rounded-xl shadow-sm ${borderClass}
                transition-all duration-200 
                ${!isEditing ? 'hover:shadow-md cursor-pointer' : ''}
                ${isDragging ? 'opacity-50 scale-105 shadow-lg' : ''}
                group
            `}
            onClick={!isEditing ? onClick : undefined}
        >
            {/* Theme color gradient overlay */}
            {colorConfig && (
                <div className={`absolute inset-0 bg-gradient-to-br ${accentGradient} pointer-events-none z-0`} />
            )}

            {/* Drag Handle */}
            {isEditMode && dragHandleProps && (
                <div 
                    {...dragHandleProps}
                    className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing"
                    onClick={(e) => e.stopPropagation()}
                >
                    <HiOutlineBars3 className="w-4 h-4 text-gray-500" />
                </div>
            )}

            {/* Image/Thumbnail */}
            {imageUrl ? (
                <div className="relative h-36 bg-gray-100 overflow-hidden rounded-t-xl">
                    <img 
                        src={imageUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
            ) : (
                <div className="relative h-36 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                    <HiOutlinePhoto className="w-12 h-12 text-indigo-200" />
                </div>
            )}

            {/* Content */}
            <div className="p-4">
                {isEditing ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Title"
                        />
                        <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                            placeholder="Description (optional)"
                            rows={2}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                            >
                                Save
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Title & Status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                                {item.title}
                            </h3>
                            {status && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[status]}`}>
                                    {status === 'draft' && <HiOutlineEyeSlash className="inline w-3 h-3 mr-1" />}
                                    {status === 'published' && <HiOutlineGlobeAlt className="inline w-3 h-3 mr-1" />}
                                    {status}
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {'description' in item && item.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                {item.description}
                            </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">
                                {String(childCount ?? 0)} {childLabel}
                            </span>
                            <HiOutlineChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </>
                )}
            </div>

            {/* Edit Mode Actions */}
            {isEditMode && !isEditing && (
                <div 
                    ref={menuRef}
                    className="absolute top-2 right-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white shadow-sm border border-gray-200"
                    >
                        <HiOutlineEllipsisVertical className="w-5 h-5 text-gray-600" />
                    </button>
                    
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto">
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <HiOutlinePencil className="w-4 h-4" />
                                Edit
                            </button>
                            {/* Image Upload */}
                            <button
                                onClick={() => {
                                    setIsImageModalOpen(true);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <HiOutlinePhoto className="w-4 h-4" />
                                {imageUrl ? 'Change Image' : 'Add Image'}
                            </button>
                            {/* Section Color Picker */}
                            {type === 'section' && (
                                <SectionColorPicker
                                    currentColor={('theme_color' in item) ? (item as Section).theme_color : null}
                                    onColorSelect={(color) => {
                                        onUpdate({ theme_color: color });
                                        setIsMenuOpen(false);
                                    }}
                                />
                            )}
                            {type === 'course' && status && (
                                <>
                                    {status !== 'published' && (
                                        <button
                                            onClick={() => {
                                                onUpdate({ status: 'published' });
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                                        >
                                            <HiOutlineGlobeAlt className="w-4 h-4" />
                                            Publish
                                        </button>
                                    )}
                                    {status === 'published' && (
                                        <button
                                            onClick={() => {
                                                onUpdate({ status: 'draft' });
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <HiOutlineEyeSlash className="w-4 h-4" />
                                            Unpublish
                                        </button>
                                    )}
                                </>
                            )}
                            {type === 'course' && (
                                <button
                                    onClick={() => {
                                        // TODO: Open role assignment modal
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <HiOutlineUsers className="w-4 h-4" />
                                    Assign Roles
                                </button>
                            )}
                            {type === 'course' && onOpenNotion && (
                                <button
                                    onClick={() => {
                                        onOpenNotion();
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
                                >
                                    <HiOutlineDocumentText className="w-4 h-4" />
                                    Open in Notion Mode
                                </button>
                            )}
                            <hr className="my-1" />
                            <button
                                onClick={() => {
                                    onDelete();
                                    setIsMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                                <HiOutlineTrash className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Image Upload Modal */}
        <ImageUploadModal
            isOpen={isImageModalOpen}
            onClose={() => setIsImageModalOpen(false)}
            currentImage={imageUrl}
            onImageSelect={(url: string) => {
                onUpdate({ image_url: url });
            }}
            title={`${type.charAt(0).toUpperCase() + type.slice(1)} Image`}
            recommendedWidth={type === 'course' ? 1200 : 800}
            recommendedHeight={type === 'course' ? 675 : 450}
            aspectRatio="16:9"
        />
        </>
    );
};

export default HierarchyCard;
