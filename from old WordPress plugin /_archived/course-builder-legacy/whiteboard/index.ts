/**
 * Whiteboard Lesson Module
 * 
 * Exports all components, hooks, types, and API functions for the
 * Excalidraw-based whiteboard lesson system with quizzes and progress tracking.
 */

// Components
export { default as Whiteboard } from './Whiteboard';
export { default as WhiteboardPresentation } from './WhiteboardPresentation';
export { default as QuizSection, QuestionCard, QuizResults } from './QuizSection';
export { default as LessonViewer } from './LessonViewer';
export { default as QuizEditor } from './QuizEditor';
export { default as SectionEditor } from './SectionEditor';

// Hooks
export { useLessonProgress, useSectionTimeTracking, useQuizTimer } from './hooks/useLessonProgress';

// API
export * as whiteboardApi from './api';

// Types
export * from './types';
