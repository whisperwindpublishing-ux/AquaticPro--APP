/**
 * Course Builder Types
 * 
 * Hierarchy: Course → Section → Lesson (with Canvas)
 */

export interface Course {
    id: number;
    title: string;
    description: string;
    image_url: string;
    display_order: number;
    status: 'draft' | 'published' | 'archived';
    created_by: number;
    created_at: string;
    updated_at: string;
    section_count?: number;
    sections?: Section[];
}

// Available section colors for theming
export type SectionColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal' | 'pink' | 'indigo';

export const SECTION_COLOR_CONFIG: Record<SectionColor, {
    bg: string;
    bgLight: string;
    border: string;
    text: string;
    button: string;
    buttonHover: string;
    gradient: string;
}> = {
    blue: {
        bg: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-700',
        button: 'bg-blue-600',
        buttonHover: 'hover:bg-blue-700',
        gradient: 'from-blue-500/10 to-blue-500/5',
    },
    purple: {
        bg: 'bg-purple-500',
        bgLight: 'bg-purple-50',
        border: 'border-purple-300',
        text: 'text-purple-700',
        button: 'bg-purple-600',
        buttonHover: 'hover:bg-purple-700',
        gradient: 'from-purple-500/10 to-purple-500/5',
    },
    green: {
        bg: 'bg-emerald-500',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-300',
        text: 'text-emerald-700',
        button: 'bg-emerald-600',
        buttonHover: 'hover:bg-emerald-700',
        gradient: 'from-emerald-500/10 to-emerald-500/5',
    },
    orange: {
        bg: 'bg-orange-500',
        bgLight: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-700',
        button: 'bg-orange-600',
        buttonHover: 'hover:bg-orange-700',
        gradient: 'from-orange-500/10 to-orange-500/5',
    },
    red: {
        bg: 'bg-red-500',
        bgLight: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-700',
        button: 'bg-red-600',
        buttonHover: 'hover:bg-red-700',
        gradient: 'from-red-500/10 to-red-500/5',
    },
    teal: {
        bg: 'bg-teal-500',
        bgLight: 'bg-teal-50',
        border: 'border-teal-300',
        text: 'text-teal-700',
        button: 'bg-teal-600',
        buttonHover: 'hover:bg-teal-700',
        gradient: 'from-teal-500/10 to-teal-500/5',
    },
    pink: {
        bg: 'bg-pink-500',
        bgLight: 'bg-pink-50',
        border: 'border-pink-300',
        text: 'text-pink-700',
        button: 'bg-pink-600',
        buttonHover: 'hover:bg-pink-700',
        gradient: 'from-pink-500/10 to-pink-500/5',
    },
    indigo: {
        bg: 'bg-indigo-500',
        bgLight: 'bg-indigo-50',
        border: 'border-indigo-300',
        text: 'text-indigo-700',
        button: 'bg-indigo-600',
        buttonHover: 'hover:bg-indigo-700',
        gradient: 'from-indigo-500/10 to-indigo-500/5',
    },
};

export interface Section {
    id: number;
    course_id: number;
    title: string;
    description: string;
    image_url: string;
    theme_color: SectionColor | null;
    display_order: number;
    created_at: string;
    updated_at: string;
    lesson_count?: number;
    lessons?: Lesson[];
}

export interface Lesson {
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
    // Inherited from parent section for theming
    section_color?: SectionColor | null;
}

export interface CoursePermission {
    job_role_id: number;
    job_role_name: string;
    tier_id: number;
    can_view: boolean;
    can_edit: boolean;
    can_manage: boolean;
}

export interface CourseAssignment {
    job_role_id: number;
    job_role_name: string;
    tier_id: number;
    is_assigned: boolean;
    assigned_at?: string;
    assigned_by?: number;
}

export interface AccessLevel {
    has_access: boolean;
    can_view: boolean;
    can_edit: boolean;
    can_manage: boolean;
}

export type HierarchyLevel = 'courses' | 'sections' | 'lessons' | 'canvas';

export interface BreadcrumbItem {
    level: HierarchyLevel;
    id?: number;
    title: string;
}
