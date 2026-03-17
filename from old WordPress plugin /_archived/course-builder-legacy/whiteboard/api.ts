/**
 * Whiteboard Lesson API Service
 * 
 * TypeScript functions for interacting with the whiteboard lesson REST API.
 */
import type {
    LessonSection,
    LessonProgress,
    SectionProgress,
    WhiteboardData,
    WhiteboardPage,
    Quiz,
    Question,
    QuizAttempt,
    QuizResult,
    QuizSubmission,
    ApiResponse,
} from './types';

// Get WordPress REST API configuration
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

// ============================================================================
// LESSON SECTIONS
// ============================================================================

/**
 * Get all sections for a lesson with content and progress
 */
export async function getLessonSections(lessonId: number): Promise<ApiResponse<LessonSection[]>> {
    const response = await fetch(`${getApiBase()}/lessons/${lessonId}/sections`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Create a new section in a lesson
 */
export async function createSection(data: {
    lesson_id: number;
    section_type: LessonSection['section_type'];
    title: string;
    description?: string;
    is_required?: boolean;
    requires_section_id?: number;
    video_url?: string;
    text_content?: string;
}): Promise<ApiResponse<LessonSection>> {
    const response = await fetch(`${getApiBase()}/lesson-sections`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Get a single section
 */
export async function getSection(sectionId: number): Promise<ApiResponse<LessonSection>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Update a section
 */
export async function updateSection(
    sectionId: number,
    data: Partial<LessonSection>
): Promise<ApiResponse<LessonSection>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Delete a section
 */
export async function deleteSection(sectionId: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Reorder sections
 */
export async function reorderSections(
    lessonId: number,
    sectionIds: number[]
): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/reorder`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ lesson_id: lessonId, order: sectionIds }),
    });
    return response.json();
}

// ============================================================================
// WHITEBOARD
// ============================================================================

/**
 * Get whiteboard for a section
 */
export async function getWhiteboard(sectionId: number): Promise<ApiResponse<WhiteboardPage>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/whiteboard`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Save whiteboard data
 */
export async function saveWhiteboard(
    sectionId: number,
    data: WhiteboardData,
    title?: string,
    thumbnailUrl?: string
): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/whiteboard`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ data, title, thumbnail_url: thumbnailUrl }),
    });
    return response.json();
}

/**
 * Save whiteboard slides (multi-page presentation)
 */
export async function saveWhiteboardSlides(
    sectionId: number,
    slides: Array<{
        id: string;
        title: string;
        data: WhiteboardData;
        thumbnailUrl?: string;
    }>
): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/whiteboard/slides`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ slides }),
    });
    return response.json();
}

/**
 * Get whiteboard slides for a section
 */
export async function getWhiteboardSlides(sectionId: number): Promise<ApiResponse<Array<{
    id: string;
    title: string;
    data: WhiteboardData;
    thumbnailUrl?: string;
}>>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/whiteboard/slides`, {
        headers: getHeaders(),
    });
    return response.json();
}

// ============================================================================
// QUIZZES
// ============================================================================

/**
 * Get quiz for a section
 */
export async function getQuiz(sectionId: number): Promise<ApiResponse<Quiz>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/quiz`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Create or update quiz for a section
 */
export async function saveQuiz(
    sectionId: number,
    data: Partial<Quiz>
): Promise<ApiResponse<{ id: number }>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/quiz`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Submit quiz answers
 */
export async function submitQuiz(
    quizId: number,
    submission: QuizSubmission
): Promise<ApiResponse<QuizResult>> {
    const response = await fetch(`${getApiBase()}/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(submission),
    });
    return response.json();
}

/**
 * Get quiz attempts for current user
 */
export async function getQuizAttempts(quizId: number): Promise<ApiResponse<QuizAttempt[]>> {
    const response = await fetch(`${getApiBase()}/quizzes/${quizId}/attempts`, {
        headers: getHeaders(),
    });
    return response.json();
}

// ============================================================================
// QUIZ QUESTIONS
// ============================================================================

/**
 * Get questions for a quiz
 */
export async function getQuestions(quizId: number): Promise<ApiResponse<Question[]>> {
    const response = await fetch(`${getApiBase()}/quizzes/${quizId}/questions`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Create a question
 */
export async function createQuestion(data: {
    quiz_id: number;
    question_type: Question['question_type'];
    question_text: string;
    question_image_url?: string;
    question_data: unknown;
    explanation?: string;
    points?: number;
}): Promise<ApiResponse<Question>> {
    const response = await fetch(`${getApiBase()}/quiz-questions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Update a question
 */
export async function updateQuestion(
    questionId: number,
    data: Partial<Question> & { question_data?: unknown }
): Promise<ApiResponse<Question>> {
    const response = await fetch(`${getApiBase()}/quiz-questions/${questionId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Delete a question
 */
export async function deleteQuestion(questionId: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/quiz-questions/${questionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Reorder questions
 */
export async function reorderQuestions(
    quizId: number,
    questionIds: number[]
): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/quiz-questions/reorder`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ quiz_id: quizId, order: questionIds }),
    });
    return response.json();
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Get lesson progress for current user
 */
export async function getLessonProgress(lessonId: number): Promise<ApiResponse<LessonProgress>> {
    const response = await fetch(`${getApiBase()}/lessons/${lessonId}/progress`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Update lesson progress (time spent, current section)
 */
export async function updateLessonProgress(
    lessonId: number,
    data: Partial<{ current_section_id: number; time_spent_seconds: number }>
): Promise<ApiResponse<void>> {
    const response = await fetch(`${getApiBase()}/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Mark a section as complete
 */
export async function completeSection(sectionId: number): Promise<ApiResponse<{
    sections_completed: number;
    total_sections: number;
    lesson_completed: boolean;
}>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/complete`, {
        method: 'POST',
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Get section progress
 */
export async function getSectionProgress(sectionId: number): Promise<ApiResponse<SectionProgress>> {
    const response = await fetch(`${getApiBase()}/lesson-sections/${sectionId}/progress`, {
        headers: getHeaders(),
    });
    return response.json();
}

/**
 * Get all progress for a lesson (admin view)
 */
export async function getAllLessonProgress(lessonId: number): Promise<ApiResponse<Array<LessonProgress & {
    first_name: string;
    last_name: string;
    email: string;
}>>> {
    const response = await fetch(`${getApiBase()}/lessons/${lessonId}/all-progress`, {
        headers: getHeaders(),
    });
    return response.json();
}
