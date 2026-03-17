/**
 * Course Builder API Service
 * 
 * Hierarchy: Course → Section → Lesson (with Whiteboard)
 */
import { 
    Course, Section, Lesson,
    CoursePermission, CourseAssignment, AccessLevel 
} from './types';

const getApiUrl = () => window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
const getNonce = () => window.mentorshipPlatformData?.nonce || '';

const headers = () => ({
    'Content-Type': 'application/json',
    'X-WP-Nonce': getNonce(),
});

// ============ ACCESS ============

export async function checkAccess(): Promise<AccessLevel> {
    const res = await fetch(`${getApiUrl()}/courses/access`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to check access');
    return res.json();
}

// ============ COURSES ============

export async function getCourses(): Promise<Course[]> {
    const res = await fetch(`${getApiUrl()}/courses`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
}

export async function getCourse(id: number): Promise<Course> {
    const res = await fetch(`${getApiUrl()}/courses/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch course');
    return res.json();
}

export async function createCourse(data: Partial<Course>): Promise<Course> {
    const res = await fetch(`${getApiUrl()}/courses`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create course');
    return res.json();
}

export async function updateCourse(id: number, data: Partial<Course>): Promise<Course> {
    const res = await fetch(`${getApiUrl()}/courses/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update course');
    return res.json();
}

export async function deleteCourse(id: number): Promise<void> {
    const res = await fetch(`${getApiUrl()}/courses/${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to delete course');
}

export async function reorderCourses(order: number[]): Promise<void> {
    const res = await fetch(`${getApiUrl()}/courses/reorder`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error('Failed to reorder courses');
}

// ============ SECTIONS ============

export async function getSections(courseId: number): Promise<Section[]> {
    const res = await fetch(`${getApiUrl()}/courses/${courseId}/sections`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch sections');
    return res.json();
}

export async function getSection(id: number): Promise<Section> {
    const res = await fetch(`${getApiUrl()}/sections/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch section');
    return res.json();
}

export async function createSection(data: Partial<Section>): Promise<Section> {
    const res = await fetch(`${getApiUrl()}/sections`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create section');
    return res.json();
}

export async function updateSection(id: number, data: Partial<Section>): Promise<Section> {
    const res = await fetch(`${getApiUrl()}/sections/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update section');
    return res.json();
}

export async function deleteSection(id: number): Promise<void> {
    const res = await fetch(`${getApiUrl()}/sections/${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to delete section');
}

export async function reorderSections(order: number[]): Promise<void> {
    const res = await fetch(`${getApiUrl()}/sections/reorder`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error('Failed to reorder sections');
}

// ============ LESSONS ============

export async function getLessons(sectionId: number): Promise<Lesson[]> {
    const res = await fetch(`${getApiUrl()}/sections/${sectionId}/lessons`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch lessons');
    return res.json();
}

export async function getLesson(id: number): Promise<Lesson> {
    const res = await fetch(`${getApiUrl()}/lessons/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch lesson');
    return res.json();
}

export async function createLesson(data: Partial<Lesson>): Promise<Lesson> {
    const res = await fetch(`${getApiUrl()}/lessons`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create lesson');
    return res.json();
}

export async function updateLesson(id: number, data: Partial<Lesson>): Promise<Lesson> {
    const res = await fetch(`${getApiUrl()}/lessons/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update lesson');
    return res.json();
}

export async function deleteLesson(id: number): Promise<void> {
    const res = await fetch(`${getApiUrl()}/lessons/${id}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to delete lesson');
}

export async function reorderLessons(order: number[]): Promise<void> {
    const res = await fetch(`${getApiUrl()}/lessons/reorder`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error('Failed to reorder lessons');
}

// ============ PERMISSIONS ============

export async function getPermissions(): Promise<CoursePermission[]> {
    const res = await fetch(`${getApiUrl()}/courses/permissions`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch permissions');
    return res.json();
}

export async function updatePermissions(permissions: Array<{ job_role_id: number; can_view: boolean; can_edit: boolean; can_manage: boolean }>): Promise<void> {
    const res = await fetch(`${getApiUrl()}/courses/permissions`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ permissions }),
    });
    if (!res.ok) throw new Error('Failed to update permissions');
}

// ============ COURSE ASSIGNMENTS ============

export async function getCourseAssignments(courseId: number): Promise<CourseAssignment[]> {
    const res = await fetch(`${getApiUrl()}/courses/${courseId}/assignments`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch course assignments');
    return res.json();
}

export async function updateCourseAssignments(courseId: number, roleIds: number[]): Promise<void> {
    const res = await fetch(`${getApiUrl()}/courses/${courseId}/assignments`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ role_ids: roleIds }),
    });
    if (!res.ok) throw new Error('Failed to update course assignments');
}
