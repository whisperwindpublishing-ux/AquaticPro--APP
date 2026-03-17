/**
 * Lesson Progress Hook
 * 
 * Custom hook for managing lesson progress state and API interactions.
 * Handles loading progress, marking sections complete, and syncing time spent.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api';
import type {
    LessonProgress,
    SectionProgress,
    WhiteboardData,
    WhiteboardSlide,
    QuizResult,
    QuizSubmission,
} from '../types';

interface UseLessonProgressReturn {
    progress: LessonProgress | null;
    sectionProgress: Record<number, SectionProgress>;
    isLoading: boolean;
    error: string | null;
    markSectionComplete: (sectionId: number) => Promise<void>;
    updateProgress: (data: Partial<{ current_section_id: number; time_spent_seconds: number }>) => Promise<void>;
    saveWhiteboard: (sectionId: number, data: WhiteboardData) => Promise<void>;
    saveWhiteboardSlides: (sectionId: number, slides: WhiteboardSlide[]) => Promise<void>;
    submitQuiz: (quizId: number, submission: QuizSubmission) => Promise<QuizResult>;
    refreshProgress: () => Promise<void>;
}

export function useLessonProgress(lessonId: number): UseLessonProgressReturn {
    const [progress, setProgress] = useState<LessonProgress | null>(null);
    const [sectionProgress, setSectionProgress] = useState<Record<number, SectionProgress>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Track time spent
    const lastSyncRef = useRef<number>(Date.now());
    const syncIntervalRef = useRef<NodeJS.Timeout>();
    
    // Load initial progress
    const loadProgress = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await api.getLessonProgress(lessonId);
            if (response.success && response.data) {
                setProgress(response.data);
            }
        } catch (err) {
            console.error('Failed to load lesson progress:', err);
            setError('Failed to load progress');
        } finally {
            setIsLoading(false);
        }
    }, [lessonId]);
    
    // Initial load
    useEffect(() => {
        loadProgress();
    }, [loadProgress]);
    
    // Sync time spent periodically
    useEffect(() => {
        const syncTimeSpent = async () => {
            const now = Date.now();
            const timeSinceLast = Math.floor((now - lastSyncRef.current) / 1000);
            
            if (timeSinceLast >= 30) { // Only sync if at least 30 seconds
                try {
                    await api.updateLessonProgress(lessonId, {
                        time_spent_seconds: timeSinceLast,
                    });
                    lastSyncRef.current = now;
                } catch (err) {
                    console.error('Failed to sync time spent:', err);
                }
            }
        };
        
        // Sync every minute
        syncIntervalRef.current = setInterval(syncTimeSpent, 60000);
        
        // Sync on unmount
        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
            syncTimeSpent();
        };
    }, [lessonId]);
    
    // Mark section as complete
    const markSectionComplete = useCallback(async (sectionId: number) => {
        try {
            const response = await api.completeSection(sectionId);
            
            if (response.success && response.data) {
                const data = response.data;
                // Update local section progress
                setSectionProgress(prev => ({
                    ...prev,
                    [sectionId]: {
                        ...prev[sectionId],
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                    } as SectionProgress,
                }));
                
                // Update lesson progress
                setProgress(prev => prev ? {
                    ...prev,
                    sections_completed: data.sections_completed,
                    completion_percentage: (data.sections_completed / data.total_sections) * 100,
                    status: data.lesson_completed ? 'completed' : prev.status,
                    completed_at: data.lesson_completed ? new Date().toISOString() : prev.completed_at,
                } : null);
            }
        } catch (err) {
            console.error('Failed to mark section complete:', err);
            throw err;
        }
    }, []);
    
    // Update lesson progress (current section, time spent)
    const updateProgress = useCallback(async (
        data: Partial<{ current_section_id: number; time_spent_seconds: number }>
    ) => {
        try {
            await api.updateLessonProgress(lessonId, data);
            
            // Update local state
            if (data.current_section_id) {
                setProgress(prev => prev ? {
                    ...prev,
                    current_section_id: data.current_section_id,
                    status: prev.status === 'not_started' ? 'in_progress' : prev.status,
                } : null);
            }
        } catch (err) {
            console.error('Failed to update progress:', err);
        }
    }, [lessonId]);
    
    // Save whiteboard data (legacy single-page)
    const saveWhiteboard = useCallback(async (sectionId: number, data: WhiteboardData) => {
        try {
            await api.saveWhiteboard(sectionId, data);
        } catch (err) {
            console.error('Failed to save whiteboard:', err);
            throw err;
        }
    }, []);
    
    // Save whiteboard slides (multi-page presentation)
    const saveWhiteboardSlides = useCallback(async (sectionId: number, slides: WhiteboardSlide[]) => {
        try {
            await api.saveWhiteboardSlides(sectionId, slides);
        } catch (err) {
            console.error('Failed to save whiteboard slides:', err);
            throw err;
        }
    }, []);
    
    // Submit quiz
    const submitQuiz = useCallback(async (quizId: number, submission: QuizSubmission): Promise<QuizResult> => {
        try {
            const response = await api.submitQuiz(quizId, submission);
            
            if (response.success && response.data) {
                const data = response.data;
                // Update section progress if passed
                if (data.passed) {
                    setSectionProgress(prev => ({
                        ...prev,
                        [submission.lesson_section_id]: {
                            ...prev[submission.lesson_section_id],
                            status: 'completed',
                            quiz_score: data.percentage,
                            quiz_passed: true,
                            completed_at: new Date().toISOString(),
                        } as SectionProgress,
                    }));
                }
                
                return data;
            }
            
            throw new Error('Failed to submit quiz');
        } catch (err) {
            console.error('Failed to submit quiz:', err);
            throw err;
        }
    }, []);
    
    // Refresh progress
    const refreshProgress = useCallback(async () => {
        await loadProgress();
    }, [loadProgress]);
    
    return {
        progress,
        sectionProgress,
        isLoading,
        error,
        markSectionComplete,
        updateProgress,
        saveWhiteboard,
        saveWhiteboardSlides,
        submitQuiz,
        refreshProgress,
    };
}

/**
 * Hook for tracking time spent on a section
 */
export function useSectionTimeTracking(sectionId: number) {
    const startTimeRef = useRef<number>(Date.now());
    const [timeSpent, setTimeSpent] = useState(0);
    
    useEffect(() => {
        startTimeRef.current = Date.now();
        
        const interval = setInterval(() => {
            setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        
        return () => clearInterval(interval);
    }, [sectionId]);
    
    const getTimeSpent = useCallback(() => {
        return Math.floor((Date.now() - startTimeRef.current) / 1000);
    }, []);
    
    return { timeSpent, getTimeSpent };
}

/**
 * Hook for quiz timer
 */
export function useQuizTimer(timeLimitMinutes: number | null) {
    const [timeRemaining, setTimeRemaining] = useState<number | null>(
        timeLimitMinutes ? timeLimitMinutes * 60 : null
    );
    const [isExpired, setIsExpired] = useState(false);
    
    useEffect(() => {
        if (timeRemaining === null || timeRemaining <= 0) return;
        
        const interval = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev === null || prev <= 0) {
                    setIsExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => clearInterval(interval);
    }, []);
    
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);
    
    return {
        timeRemaining,
        isExpired,
        formattedTime: timeRemaining !== null ? formatTime(timeRemaining) : null,
    };
}
