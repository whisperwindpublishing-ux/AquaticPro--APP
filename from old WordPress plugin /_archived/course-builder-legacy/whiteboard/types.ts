/**
 * Whiteboard Lesson Types
 * 
 * Types for the Excalidraw-based whiteboard lesson system with quizzes and progress tracking.
 * Replaces the card-based canvas with a more flexible whiteboard approach.
 */

// Use 'any' for Excalidraw types to avoid import issues with internal paths
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawElement = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppState = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BinaryFiles = Record<string, any>;

// ============================================================================
// WHITEBOARD TYPES
// ============================================================================

/**
 * Whiteboard data structure - stores Excalidraw state
 */
export interface WhiteboardData {
    elements: ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
    version?: number;
}

/**
 * A single whiteboard slide within a presentation
 */
export interface WhiteboardSlide {
    id: string;
    title: string;
    data: WhiteboardData;
    thumbnailUrl?: string;
}

/**
 * A whiteboard presentation with multiple slides
 */
export interface WhiteboardPresentation {
    id: number;
    lesson_section_id: number;
    title: string;
    slides: WhiteboardSlide[];
    current_slide_index?: number;
    created_at: string;
    updated_at: string;
}

/**
 * Legacy: A single whiteboard "page" or canvas (deprecated - use WhiteboardPresentation)
 */
export interface WhiteboardPage {
    id: number;
    lesson_section_id: number;
    title: string;
    data: WhiteboardData;
    thumbnail_url?: string;
    display_order: number;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// QUIZ TYPES
// ============================================================================

/**
 * Question types supported in quizzes
 */
export type QuestionType = 
    | 'multiple-choice'      // Single correct answer from options
    | 'multiple-select'      // Multiple correct answers from options
    | 'true-false'           // Boolean true/false
    | 'short-answer'         // Free text with keyword matching
    | 'hotspot'              // Click on correct region of image
    | 'ordering'             // Arrange items in correct order
    | 'matching';            // Match items from two columns

/**
 * Base question interface
 */
export interface QuestionBase {
    id: number;
    quiz_id: number;
    question_type: QuestionType;
    question_text: string;
    question_image_url?: string;
    explanation?: string;     // Shown after answering
    points: number;
    display_order: number;
    created_at: string;
    updated_at: string;
}

/**
 * Multiple choice question (single answer)
 */
export interface MultipleChoiceQuestion extends QuestionBase {
    question_type: 'multiple-choice';
    options: QuestionOption[];
    correct_option_id: number;
}

/**
 * Multiple select question (multiple answers)
 */
export interface MultipleSelectQuestion extends QuestionBase {
    question_type: 'multiple-select';
    options: QuestionOption[];
    correct_option_ids: number[];
    partial_credit?: boolean; // Allow partial credit for some correct answers
}

/**
 * True/False question
 */
export interface TrueFalseQuestion extends QuestionBase {
    question_type: 'true-false';
    correct_answer: boolean;
}

/**
 * Short answer question with keyword matching
 */
export interface ShortAnswerQuestion extends QuestionBase {
    question_type: 'short-answer';
    accepted_answers: string[];      // List of acceptable answers
    case_sensitive?: boolean;
    require_exact_match?: boolean;   // vs contains keyword
}

/**
 * Hotspot question - click correct area on image
 */
export interface HotspotQuestion extends QuestionBase {
    question_type: 'hotspot';
    image_url: string;
    hotspot_regions: HotspotRegion[];
}

/**
 * Ordering question - arrange in correct sequence
 */
export interface OrderingQuestion extends QuestionBase {
    question_type: 'ordering';
    items: OrderingItem[];
    correct_order: number[];  // Array of item IDs in correct order
}

/**
 * Matching question - match items between columns
 */
export interface MatchingQuestion extends QuestionBase {
    question_type: 'matching';
    left_items: MatchingItem[];
    right_items: MatchingItem[];
    correct_pairs: MatchingPair[];
}

// Supporting types for questions

export interface QuestionOption {
    id: number;
    text: string;
    image_url?: string;
}

export interface HotspotRegion {
    id: number;
    shape: 'rectangle' | 'circle' | 'polygon';
    coordinates: number[];  // [x, y, width, height] or [cx, cy, r] or [x1, y1, x2, y2, ...]
    is_correct: boolean;
    feedback?: string;
}

export interface OrderingItem {
    id: number;
    text: string;
    image_url?: string;
}

export interface MatchingItem {
    id: number;
    text: string;
    image_url?: string;
}

export interface MatchingPair {
    left_id: number;
    right_id: number;
}

/**
 * Union type for all question types
 */
export type Question = 
    | MultipleChoiceQuestion
    | MultipleSelectQuestion
    | TrueFalseQuestion
    | ShortAnswerQuestion
    | HotspotQuestion
    | OrderingQuestion
    | MatchingQuestion;

/**
 * Quiz configuration and metadata
 */
export interface Quiz {
    id: number;
    lesson_section_id: number;
    title: string;
    description?: string;
    time_limit_minutes?: number;     // Optional time limit
    passing_score: number;           // Percentage (0-100)
    max_attempts?: number;           // null = unlimited
    shuffle_questions?: boolean;
    shuffle_options?: boolean;
    show_correct_answers: 'never' | 'after_attempt' | 'after_pass';
    allow_review?: boolean;          // Can review answers after submission
    questions?: Question[];
    question_count?: number;
    total_points?: number;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// LESSON SECTION TYPES
// ============================================================================

/**
 * Section types within a lesson
 */
export type LessonSectionType = 'whiteboard' | 'quiz' | 'video' | 'text';

/**
 * A section within a lesson (either whiteboard or quiz)
 */
export interface LessonSection {
    id: number;
    lesson_id: number;
    section_type: LessonSectionType;
    title: string;
    description?: string;
    display_order: number;
    
    // Gate/unlock settings
    is_required?: boolean;           // Must complete to progress
    requires_section_id?: number;    // Must complete this section first
    unlock_after_minutes?: number;   // Time-based unlock
    
    // Content (populated based on section_type)
    whiteboard?: WhiteboardPage & { slides?: WhiteboardSlide[] };  // Supports both legacy and multi-slide
    quiz?: Quiz;
    video_url?: string;
    text_content?: string;
    
    // Progress info (populated for current user)
    user_progress?: SectionProgress;
    
    created_at: string;
    updated_at: string;
}

// ============================================================================
// PROGRESS TRACKING TYPES
// ============================================================================

/**
 * Overall lesson progress for a user
 */
export interface LessonProgress {
    id: number;
    user_id: number;
    lesson_id: number;
    status: 'not_started' | 'in_progress' | 'completed';
    current_section_id?: number;
    sections_completed: number;
    total_sections: number;
    completion_percentage: number;
    time_spent_seconds: number;
    started_at?: string;
    completed_at?: string;
    last_accessed_at?: string;
}

/**
 * Progress for a single section
 */
export interface SectionProgress {
    id: number;
    user_id: number;
    lesson_section_id: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'locked';
    time_spent_seconds: number;
    completed_at?: string;
    
    // For quiz sections
    quiz_score?: number;
    quiz_passed?: boolean;
    quiz_attempts?: number;
}

/**
 * A single quiz attempt record
 */
export interface QuizAttempt {
    id: number;
    user_id: number;
    quiz_id: number;
    lesson_section_id: number;
    score: number;
    total_points: number;
    percentage: number;
    passed: boolean;
    answers: QuizAnswerRecord[];
    time_taken_seconds: number;
    started_at: string;
    submitted_at: string;
}

/**
 * Record of a single answer in a quiz attempt
 */
export interface QuizAnswerRecord {
    question_id: number;
    question_type: QuestionType;
    user_answer: unknown;         // Type varies by question type
    correct_answer: unknown;      // Type varies by question type
    is_correct: boolean;
    points_earned: number;
    points_possible: number;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * User's in-progress answers during a quiz (before submission)
 */
export interface QuizAnswers {
    [questionId: number]: unknown;
}

/**
 * Quiz submission payload
 */
export interface QuizSubmission {
    quiz_id: number;
    lesson_section_id: number;
    answers: QuizAnswers;
    time_taken_seconds: number;
}

/**
 * Quiz results after submission
 */
export interface QuizResult {
    attempt_id?: number;
    quiz_id: number;
    score: number;
    total_points: number;
    percentage: number;
    passed: boolean;
    passing_score: number;
    correct_answers: number;
    total_questions: number;
    time_taken_seconds?: number;
    show_answers?: boolean;
    answers?: QuizAnswerRecord[] | QuizAnswers;
    message?: string;
    can_retry?: boolean;
    attempts_remaining?: number;
}

/**
 * Lesson viewer mode
 */
export type LessonViewerMode = 'view' | 'edit';

/**
 * State for the lesson viewer component
 */
export interface LessonViewerState {
    lesson: LessonWithSections | null;
    currentSectionIndex: number;
    progress: LessonProgress | null;
    mode: LessonViewerMode;
    isLoading: boolean;
    error: string | null;
}

/**
 * Extended lesson type with sections included
 */
export interface LessonWithSections {
    id: number;
    section_id: number;
    title: string;
    description: string;
    image_url: string;
    header_image_url: string;
    display_order: number;
    grid_cols: number;
    created_at: string;
    updated_at: string;
    sections: LessonSection[];
    section_color?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface WhiteboardProps {
    data?: WhiteboardData;
    readOnly?: boolean;
    onChange?: (data: WhiteboardData) => void;
    onSave?: (data: WhiteboardData) => Promise<void>;
    className?: string;
}

export interface QuizSectionProps {
    quiz: Quiz;
    onComplete: (result: QuizResult) => void;
    onCancel?: () => void;
    readOnly?: boolean;
    showResults?: boolean;
    previousAttempt?: QuizAttempt;
}

export interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    answer: unknown;
    onChange: (answer: unknown) => void;
    showResult?: boolean;
    correctAnswer?: unknown;
    isCorrect?: boolean;
    disabled?: boolean;
}

export interface ProgressBarProps {
    current: number;
    total: number;
    showPercentage?: boolean;
    showLabels?: boolean;
    className?: string;
}

export interface SectionNavigationProps {
    sections: LessonSection[];
    currentIndex: number;
    progress?: Record<number, SectionProgress>;
    onNavigate: (index: number) => void;
    canNavigate: (index: number) => boolean;
}
