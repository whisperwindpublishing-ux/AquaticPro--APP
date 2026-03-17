/**
 * Section Editor Component
 * 
 * Admin interface for creating, editing, and organizing lesson sections.
 * Supports whiteboard, quiz, video, and text section types.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineBars3,
    HiOutlinePresentationChartBar,
    HiOutlineClipboardDocumentCheck,
    HiOutlinePlayCircle,
    HiOutlineDocumentText,
    HiOutlineCog6Tooth,
    HiOutlineArrowLeft,
    HiOutlineXCircle,
} from 'react-icons/hi2';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LessonSection, LessonSectionType } from './types';
import * as api from './api';

// ============================================================================
// SECTION TYPE CONFIG
// ============================================================================

const sectionTypeConfig: Record<LessonSectionType, { 
    icon: React.ComponentType<{ className?: string }>; 
    label: string; 
    description: string;
    color: string;
}> = {
    whiteboard: { 
        icon: HiOutlinePresentationChartBar, 
        label: 'Whiteboard', 
        description: 'Interactive drawing canvas',
        color: 'bg-blue-500',
    },
    quiz: { 
        icon: HiOutlineClipboardDocumentCheck, 
        label: 'Quiz', 
        description: 'Assessment with scoring',
        color: 'bg-purple-500',
    },
    video: { 
        icon: HiOutlinePlayCircle, 
        label: 'Video', 
        description: 'YouTube or Vimeo embed',
        color: 'bg-red-500',
    },
    text: { 
        icon: HiOutlineDocumentText, 
        label: 'Text', 
        description: 'Rich text content',
        color: 'bg-green-500',
    },
};

// ============================================================================
// SORTABLE SECTION ITEM
// ============================================================================

interface SortableSectionProps {
    section: LessonSection;
    onEdit: () => void;
    onDelete: () => void;
    onOpenContent: () => void;
}

const SortableSection: React.FC<SortableSectionProps> = ({
    section,
    onEdit,
    onDelete,
    onOpenContent,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    
    const config = sectionTypeConfig[section.section_type];
    const Icon = config.icon;
    
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white rounded-lg border ${isDragging ? 'border-blue-300 shadow-lg' : 'border-gray-200'} overflow-hidden`}
        >
            <div className="flex items-center gap-4 p-4">
                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                >
                    <HiOutlineBars3 className="w-5 h-5" />
                </button>
                
                {/* Section type icon */}
                <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                
                {/* Section info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                            {section.title}
                        </h3>
                        {section.is_required && (
                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                                Required
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">
                        {config.label}
                        {section.description && ` • ${section.description}`}
                    </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenContent}
                        className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                        {section.section_type === 'whiteboard' ? 'Edit Canvas' : 
                         section.section_type === 'quiz' ? 'Edit Quiz' : 'Edit Content'}
                    </button>
                    <button
                        onClick={onEdit}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Settings"
                    >
                        <HiOutlineCog6Tooth className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Section"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// ADD SECTION MODAL
// ============================================================================

interface AddSectionModalProps {
    lessonId: number;
    onAdd: (section: LessonSection) => void;
    onClose: () => void;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
    lessonId,
    onAdd,
    onClose,
}) => {
    const [selectedType, setSelectedType] = useState<LessonSectionType | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isRequired, setIsRequired] = useState(true);
    const [videoUrl, setVideoUrl] = useState('');
    const [textContent, setTextContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const handleCreate = async () => {
        if (!selectedType || !title.trim()) return;
        
        setIsCreating(true);
        try {
            const response = await api.createSection({
                lesson_id: lessonId,
                section_type: selectedType,
                title: title.trim(),
                description: description.trim() || undefined,
                is_required: isRequired,
                video_url: selectedType === 'video' ? videoUrl : undefined,
                text_content: selectedType === 'text' ? textContent : undefined,
            });
            
            if (response.success && response.data) {
                onAdd(response.data);
            }
        } catch (error) {
            console.error('Failed to create section:', error);
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
                <div className="border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Add Section</h2>
                    <button onClick={onClose}>
                        <HiOutlineXCircle className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Section type selection */}
                    {!selectedType ? (
                        <div className="grid grid-cols-2 gap-4">
                            {(Object.entries(sectionTypeConfig) as [LessonSectionType, typeof sectionTypeConfig[LessonSectionType]][]).map(([type, config]) => {
                                const Icon = config.icon;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setSelectedType(type);
                                            setTitle(config.label);
                                        }}
                                        className="p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                                    >
                                        <div className={`w-12 h-12 rounded-lg ${config.color} flex items-center justify-center mb-3`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="font-medium text-gray-900">{config.label}</h3>
                                        <p className="text-sm text-gray-500">{config.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                            {/* Back button */}
                            <button
                                onClick={() => setSelectedType(null)}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                            >
                                <HiOutlineArrowLeft className="w-4 h-4" />
                                Choose different type
                            </button>
                            
                            {/* Section details form */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Section Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter section title..."
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Brief description..."
                                />
                            </div>
                            
                            {/* Video URL for video sections */}
                            {selectedType === 'video' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Video URL
                                    </label>
                                    <input
                                        type="url"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="YouTube or Vimeo URL..."
                                    />
                                </div>
                            )}
                            
                            {/* Text content for text sections */}
                            {selectedType === 'text' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Content
                                    </label>
                                    <textarea
                                        value={textContent}
                                        onChange={(e) => setTextContent(e.target.value)}
                                        rows={6}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter text content..."
                                    />
                                </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_required"
                                    checked={isRequired}
                                    onChange={(e) => setIsRequired(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <label htmlFor="is_required" className="text-sm text-gray-700">
                                    Required to complete lesson
                                </label>
                            </div>
                        </>
                    )}
                </div>
                
                {selectedType && (
                    <div className="border-t px-6 py-4 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={isCreating || !title.trim()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                        >
                            {isCreating ? 'Creating...' : 'Create Section'}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// ============================================================================
// EDIT SECTION MODAL
// ============================================================================

interface EditSectionModalProps {
    section: LessonSection;
    onSave: (section: LessonSection) => void;
    onClose: () => void;
}

const EditSectionModal: React.FC<EditSectionModalProps> = ({
    section,
    onSave,
    onClose,
}) => {
    const [title, setTitle] = useState(section.title);
    const [description, setDescription] = useState(section.description || '');
    const [isRequired, setIsRequired] = useState(section.is_required ?? true);
    const [videoUrl, setVideoUrl] = useState(section.video_url || '');
    const [textContent, setTextContent] = useState(section.text_content || '');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updateData: Partial<LessonSection> = {
                title: title.trim(),
                description: description.trim() || undefined,
                is_required: isRequired,
            };
            
            if (section.section_type === 'video') {
                updateData.video_url = videoUrl;
            }
            if (section.section_type === 'text') {
                updateData.text_content = textContent;
            }
            
            const response = await api.updateSection(section.id, updateData);
            if (response.success && response.data) {
                onSave(response.data);
            }
        } catch (error) {
            console.error('Failed to update section:', error);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl max-w-lg w-full"
            >
                <div className="border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Edit Section</h2>
                    <button onClick={onClose}>
                        <HiOutlineXCircle className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Section Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    {section.section_type === 'video' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Video URL
                            </label>
                            <input
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                    
                    {section.section_type === 'text' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Content
                            </label>
                            <textarea
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                rows={6}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="edit_is_required"
                            checked={isRequired}
                            onChange={(e) => setIsRequired(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <label htmlFor="edit_is_required" className="text-sm text-gray-700">
                            Required to complete lesson
                        </label>
                    </div>
                </div>
                
                <div className="border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !title.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ============================================================================
// MAIN SECTION EDITOR COMPONENT
// ============================================================================

interface SectionEditorProps {
    lessonId: number;
    lessonTitle: string;
    sections: LessonSection[];
    onClose: () => void;
    onSectionsChange: (sections: LessonSection[]) => void;
    onOpenWhiteboard: (section: LessonSection) => void;
    onOpenQuiz: (section: LessonSection) => void;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
    lessonId,
    lessonTitle,
    sections,
    onClose,
    onSectionsChange,
    onOpenWhiteboard,
    onOpenQuiz,
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSection, setEditingSection] = useState<LessonSection | null>(null);
    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    // Handle drag end
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            const oldIndex = sections.findIndex(s => s.id === Number(active.id));
            const newIndex = sections.findIndex(s => s.id === Number(over.id));
            
            const newSections = arrayMove(sections, oldIndex, newIndex);
            onSectionsChange(newSections);
            
            // Save new order
            await api.reorderSections(lessonId, newSections.map(s => s.id));
        }
    };
    
    // Handle section add
    const handleAddSection = (section: LessonSection) => {
        onSectionsChange([...sections, section]);
        setShowAddModal(false);
    };
    
    // Handle section update
    const handleUpdateSection = (updated: LessonSection) => {
        onSectionsChange(sections.map(s => s.id === updated.id ? updated : s));
        setEditingSection(null);
    };
    
    // Handle section delete
    const handleDeleteSection = async (sectionId: number) => {
        if (!confirm('Are you sure you want to delete this section?')) return;
        
        await api.deleteSection(sectionId);
        onSectionsChange(sections.filter(s => s.id !== sectionId));
    };
    
    // Handle opening section content
    const handleOpenContent = (section: LessonSection) => {
        switch (section.section_type) {
            case 'whiteboard':
                onOpenWhiteboard(section);
                break;
            case 'quiz':
                onOpenQuiz(section);
                break;
            default:
                setEditingSection(section);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-100 z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <HiOutlineArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold">Edit Sections: {lessonTitle}</h1>
                        <p className="text-sm text-gray-500">
                            {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                        </p>
                    </div>
                </div>
                
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    Add Section
                </button>
            </header>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {sections.length > 0 ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={sections.map(s => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {sections.map((section) => (
                                        <SortableSection
                                            key={section.id}
                                            section={section}
                                            onEdit={() => setEditingSection(section)}
                                            onDelete={() => handleDeleteSection(section.id)}
                                            onOpenContent={() => handleOpenContent(section)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                <HiOutlineDocumentText className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No sections yet</h3>
                            <p className="text-gray-500 mb-6">Add whiteboard, quiz, video, or text sections to build your lesson.</p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Add First Section
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Modals */}
            {showAddModal && (
                <AddSectionModal
                    lessonId={lessonId}
                    onAdd={handleAddSection}
                    onClose={() => setShowAddModal(false)}
                />
            )}
            
            {editingSection && (
                <EditSectionModal
                    section={editingSection}
                    onSave={handleUpdateSection}
                    onClose={() => setEditingSection(null)}
                />
            )}
        </div>
    );
};

export default SectionEditor;
