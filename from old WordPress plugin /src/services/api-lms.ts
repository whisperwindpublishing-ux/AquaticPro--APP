/**
 * LMS API Service
 * Handles all API calls for the Learning Module
 * 
 * Backend uses dedicated database tables:
 * - wp_aquaticpro_courses
 * - wp_aquaticpro_lessons
 * - wp_aquaticpro_lesson_hotspots
 * - wp_aquaticpro_progress
 */

const API_BASE = '/wp-json/aquaticpro/v1';

// Get nonce from global settings
const getNonce = (): string => {
    return window.mentorshipPlatformData?.nonce || '';
};

// Common fetch options
const fetchOptions = (method: string = 'GET', body?: object): RequestInit => ({
    method,
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': getNonce(),
    },
    ...(body && { body: JSON.stringify(body) }),
});

// Handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP error ${response.status}`);
    }
    return response.json();
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Course {
    id: number;
    title: string;
    description?: string;
    featuredImage?: string;
    category?: string;
    sequential?: boolean;
    status?: 'draft' | 'published' | 'archived';
    lessonCount?: number;
    progress?: number;
    displayOrder?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface CourseCategory {
    id: number;
    name: string;
    displayOrder: number;
}

export interface LessonProgress {
    status: 'not-started' | 'in-progress' | 'completed';
    score: number;
    completedAt?: string | null;
    lastViewed?: string | null;
}

export interface LessonSection {
    id: number;
    courseId: number;
    title: string;
    description?: string;
    order: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface Lesson {
    id: number;
    courseId?: number;
    sectionId?: number | null;
    title: string;
    description?: string;
    content?: string;
    type?: 'content' | 'excalidraw' | 'hotspot' | 'hybrid' | 'quiz';
    featuredImage?: string;
    excalidrawJson?: string;
    scrollCues?: any[];
    slideOrder?: string[];
    hybridLayout?: 'text-left' | 'text-right';
    splitRatio?: number;
    estimatedTime?: string;
    order?: number;
    hasExcalidraw?: boolean;
    progress?: LessonProgress;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProgressRecord {
    id?: number;
    lessonId: number;
    lessonTitle?: string;
    courseId?: number;
    status: 'not-started' | 'in-progress' | 'completed';
    score: number;
    lastViewed?: string | null;
    completedAt?: string | null;
    timeSpent?: number;
}

export interface StudentProgress {
    userId: number;
    userName: string;
    userEmail: string;
    firstName: string;
    lastName: string;
    isArchived: boolean;
    courses: Record<number, {
        courseId: number;
        courseTitle: string;
        lessons: {
            lessonId: number;
            lessonTitle: string;
            type: string;
            status: ProgressRecord['status'];
            score: number;
            completedAt: string | null;
            timeSpent: number;
        }[];
    }>;
}

// ============================================
// COURSE API
// ============================================

/**
 * Get all courses
 */
export async function getCourses(): Promise<Course[]> {
    const response = await fetch(`${API_BASE}/courses`, fetchOptions());
    return handleResponse<Course[]>(response);
}

/**
 * Get a single course by ID
 */
export async function getCourse(courseId: number): Promise<Course> {
    const response = await fetch(`${API_BASE}/courses/${courseId}`, fetchOptions());
    return handleResponse<Course>(response);
}

/**
 * Create a new course
 */
export async function createCourse(data: Partial<Course>): Promise<Course> {
    const response = await fetch(`${API_BASE}/courses`, fetchOptions('POST', data));
    return handleResponse<Course>(response);
}

/**
 * Update an existing course
 */
export async function updateCourse(courseId: number, data: Partial<Course>): Promise<Course> {
    const response = await fetch(`${API_BASE}/courses/${courseId}`, fetchOptions('PUT', data));
    return handleResponse<Course>(response);
}

/**
 * Delete a course
 */
export async function deleteCourse(courseId: number): Promise<{ deleted: boolean; id: number }> {
    const response = await fetch(`${API_BASE}/courses/${courseId}`, fetchOptions('DELETE'));
    return handleResponse<{ deleted: boolean; id: number }>(response);
}

/**
 * Get all lessons in a course
 */
export async function getCourseLessons(courseId: number): Promise<Lesson[]> {
    const response = await fetch(`${API_BASE}/courses/${courseId}/lessons`, fetchOptions());
    return handleResponse<Lesson[]>(response);
}

// ============================================
// LESSON API
// ============================================

/**
 * Get a single lesson by ID
 */
export async function getLesson(lessonId: number): Promise<Lesson> {
    const response = await fetch(`${API_BASE}/lessons/${lessonId}`, fetchOptions());
    return handleResponse<Lesson>(response);
}

/**
 * Create a new lesson in a course
 */
export async function createLesson(courseId: number, data: Partial<Lesson>): Promise<Lesson> {
    const response = await fetch(
        `${API_BASE}/courses/${courseId}/lessons`,
        fetchOptions('POST', data)
    );
    return handleResponse<Lesson>(response);
}

/**
 * Update an existing lesson
 */
export async function updateLesson(lessonId: number, data: Partial<Lesson>): Promise<Lesson> {
    const response = await fetch(
        `${API_BASE}/lessons/${lessonId}`,
        fetchOptions('PUT', data)
    );
    return handleResponse<Lesson>(response);
}

/**
 * Delete a lesson
 */
export async function deleteLesson(lessonId: number): Promise<{ deleted: boolean; id: number }> {
    const response = await fetch(`${API_BASE}/lessons/${lessonId}`, fetchOptions('DELETE'));
    return handleResponse<{ deleted: boolean; id: number }>(response);
}

/**
 * Reorder lessons within a course
 */
export async function reorderLessons(lessonIds: number[]): Promise<{ success: boolean; reordered: number }> {
    const response = await fetch(
        `${API_BASE}/lessons/reorder`,
        fetchOptions('PUT', { order: lessonIds })
    );
    return handleResponse<{ success: boolean; reordered: number }>(response);
}

/**
 * Update lesson meta (hotspots or excalidraw data)
 */
export async function updateLessonMeta(
    lessonId: number,
    type: 'excalidraw' | 'scrollCues' | 'slideOrder',
    data: string | object | string[]
): Promise<{ success: boolean; lesson_id: number; updated: Record<string, unknown> }> {
    const response = await fetch(
        `${API_BASE}/lessons/${lessonId}/meta`,
        fetchOptions('POST', { type, data })
    );
    return handleResponse<{ success: boolean; lesson_id: number; updated: Record<string, unknown> }>(response);
}

// ============================================
// SECTION API
// ============================================

/**
 * Get sections for a course
 */
export async function getCourseSections(courseId: number): Promise<LessonSection[]> {
    const response = await fetch(`${API_BASE}/courses/${courseId}/sections`, fetchOptions());
    return handleResponse<LessonSection[]>(response);
}

/**
 * Create a new section in a course
 */
export async function createSection(courseId: number, data: { title: string; description?: string; displayOrder?: number }): Promise<LessonSection> {
    const response = await fetch(
        `${API_BASE}/courses/${courseId}/sections`,
        fetchOptions('POST', data)
    );
    return handleResponse<LessonSection>(response);
}

/**
 * Update a section
 */
export async function updateSection(sectionId: number, data: Partial<LessonSection>): Promise<LessonSection> {
    const response = await fetch(
        `${API_BASE}/sections/${sectionId}`,
        fetchOptions('PUT', data)
    );
    return handleResponse<LessonSection>(response);
}

/**
 * Delete a section
 */
export async function deleteSection(sectionId: number): Promise<{ deleted: boolean; id: number }> {
    const response = await fetch(`${API_BASE}/sections/${sectionId}`, fetchOptions('DELETE'));
    return handleResponse<{ deleted: boolean; id: number }>(response);
}

/**
 * Reorder sections within a course
 */
export async function reorderSections(sectionIds: number[]): Promise<{ success: boolean; reordered: number }> {
    const response = await fetch(
        `${API_BASE}/sections/reorder`,
        fetchOptions('PUT', { order: sectionIds })
    );
    return handleResponse<{ success: boolean; reordered: number }>(response);
}

// ============================================
// PROGRESS API
// ============================================

/**
 * Get all progress entries for the current user
 */
export async function getProgress(): Promise<ProgressRecord[]> {
    const response = await fetch(`${API_BASE}/progress`, fetchOptions());
    return handleResponse<ProgressRecord[]>(response);
}

/**
 * Update progress for a lesson (upsert)
 */
export async function updateProgress(
    lessonId: number,
    status: 'not-started' | 'in-progress' | 'completed',
    score?: number,
    timeSpentSeconds?: number
): Promise<ProgressRecord> {
    const response = await fetch(
        `${API_BASE}/progress`,
        fetchOptions('POST', {
            lesson_id: lessonId,
            status,
            score: score ?? 0,
            time_spent_seconds: timeSpentSeconds ?? 0,
        })
    );
    return handleResponse<ProgressRecord>(response);
}

/**
 * Mark a lesson as completed
 */
export async function completeLesson(lessonId: number, score: number = 100): Promise<ProgressRecord> {
    return updateProgress(lessonId, 'completed', score);
}

/**
 * Mark a lesson as in progress
 */
export async function startLesson(lessonId: number): Promise<ProgressRecord> {
    return updateProgress(lessonId, 'in-progress');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate overall course completion percentage
 */
export function calculateCourseCompletion(lessons: Lesson[]): number {
    if (lessons.length === 0) return 0;
    const completed = lessons.filter(l => l.progress?.status === 'completed').length;
    return Math.round((completed / lessons.length) * 100);
}

/**
 * Track time spent on a lesson (call periodically while user is viewing)
 */
export class LessonTimeTracker {
    private lessonId: number;
    private startTime: number;
    private accumulatedSeconds: number = 0;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private saveInterval: number = 30000; // Save every 30 seconds

    constructor(lessonId: number, saveIntervalMs: number = 30000) {
        this.lessonId = lessonId;
        this.startTime = Date.now();
        this.saveInterval = saveIntervalMs;
    }

    start(): void {
        this.startTime = Date.now();
        
        // Periodically save progress
        this.intervalId = setInterval(() => {
            this.saveProgress();
        }, this.saveInterval);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.saveProgress();
    }

    private async saveProgress(): Promise<void> {
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        this.accumulatedSeconds += elapsed;
        this.startTime = Date.now();

        try {
            await updateProgress(
                this.lessonId,
                'in-progress',
                undefined,
                elapsed
            );
        } catch (error) {
            console.error('[LessonTimeTracker] Failed to save progress:', error);
        }
    }

    getTotalSeconds(): number {
        const current = Math.round((Date.now() - this.startTime) / 1000);
        return this.accumulatedSeconds + current;
    }
}

// ============================================
// MIGRATION API
// ============================================

/**
 * Export a course to ZIP
 * Returns the URL to download the file
 */
export async function exportCourse(courseId: number): Promise<{ url: string; filename: string }> {
    const response = await fetch(`${API_BASE}/courses/${courseId}/export`, fetchOptions('GET'));
    return handleResponse(response);
}

/**
 * Import a course from ZIP
 */
export async function importCourse(file: File): Promise<{ success: boolean; course_id: number; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/courses/import`, {
        method: 'POST',
        headers: {
            'X-WP-Nonce': getNonce(),
            // Content-Type is set automatically by browser with boundary for FormData
        },
        body: formData,
    });
    
    return handleResponse(response);
}

/**
 * Import a course from LearnDash
 */
export async function importLearnDashCourse(learnDashCourseId: number): Promise<{ success: boolean; course_id: number; message: string }> {
    const response = await fetch(`${API_BASE}/courses/import-learndash`, fetchOptions('POST', { learndash_course_id: learnDashCourseId }));
    return handleResponse(response);
}

// ============================================
// LMS API OBJECT (for convenient import)
// ============================================

export const lmsApi = {
    // Courses
    getCourses,
    getCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    getCourseLessons,
    exportCourse,
    importCourse,
    importLearnDashCourse,
    
    // Sections
    getCourseSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    
    // Lessons
    getLesson,
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons,
    updateLessonMeta,
    
    // Progress
    getProgress,
    updateProgress,
    completeLesson,
    startLesson,
    
    getAllStudentProgress: async (params?: { courseId?: number; excludeArchived?: '0' | '1' }): Promise<StudentProgress[]> => {
        const qs = new URLSearchParams();
        if (params?.courseId) qs.set('courseId', String(params.courseId));
        if (params?.excludeArchived !== undefined) qs.set('excludeArchived', params.excludeArchived);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        const response = await fetch(`${API_BASE}/analytics/progress${suffix}`, fetchOptions());
        return handleResponse<StudentProgress[]>(response);
    },

    // Utilities
    calculateCourseCompletion,
    LessonTimeTracker,

    // Course Categories
    getCategories: async (): Promise<CourseCategory[]> => {
        const response = await fetch(`${API_BASE}/course-categories`, fetchOptions());
        return handleResponse<CourseCategory[]>(response);
    },
    createCategory: async (name: string): Promise<CourseCategory> => {
        const response = await fetch(`${API_BASE}/course-categories`, fetchOptions('POST', { name }));
        return handleResponse<CourseCategory>(response);
    },
    updateCategory: async (id: number, name: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE}/course-categories/${id}`, fetchOptions('PUT', { name }));
        return handleResponse<{ success: boolean }>(response);
    },
    deleteCategory: async (id: number): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE}/course-categories/${id}`, fetchOptions('DELETE'));
        return handleResponse<{ success: boolean }>(response);
    },
    reorderCategories: async (orders: { id: number; displayOrder: number }[]): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE}/course-categories/reorder`, fetchOptions('PUT', { orders }));
        return handleResponse<{ success: boolean }>(response);
    },
};

export default lmsApi;

