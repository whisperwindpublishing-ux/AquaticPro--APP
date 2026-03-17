/**
 * Course Builder Module
 * 
 * Exports all course builder components
 * Hierarchy: Course → Section → Lesson (with Excalidraw Whiteboard)
 */

export { default as CourseBuilder } from './CourseBuilder';
export { default as CoursePermissions } from './CoursePermissions';
export { default as HierarchyCard } from './HierarchyCard';
export { default as SectionColorPicker } from './SectionColorPicker';
export { default as DraggableHierarchyList } from './DraggableHierarchyList';
export { default as ImageUploadModal } from './ImageUploadModal';

// Whiteboard (Excalidraw)
export * from './whiteboard';

// Types
export * from './types';

// API
export * as courseApi from './api';
