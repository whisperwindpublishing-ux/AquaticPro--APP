/**
 * Course Cache Service
 *
 * Lightweight in-memory + localStorage cache for the course list
 * and course→lessons mapping. Avoids re-fetching on every wizard open.
 *
 * Cache is auto-invalidated after 10 minutes or when `invalidate()` is called.
 * Components that create/edit/delete courses or lessons should call `invalidate()`.
 */

import { lmsApi, Course, Lesson } from './api-lms';

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY_COURSES = 'mp_course_cache';

// ─── In-memory state ─────────────────────────────────────────────

interface CacheState {
    courses: Course[] | null;
    coursesFetched: number;
    coursesPromise: Promise<Course[]> | null;
    lessons: Map<number, { data: Lesson[]; fetched: number }>;
    lessonsPromises: Map<number, Promise<Lesson[]>>;
}

const state: CacheState = {
    courses: null,
    coursesFetched: 0,
    coursesPromise: null,
    lessons: new Map(),
    lessonsPromises: new Map(),
};

// ─── localStorage helpers ────────────────────────────────────────

function restoreCourses(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_COURSES);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.courses && Date.now() - parsed.fetched < CACHE_DURATION) {
            state.courses = parsed.courses;
            state.coursesFetched = parsed.fetched;
        }
    } catch { /* ignore */ }
}

function persistCourses(): void {
    try {
        if (state.courses) {
            localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify({
                courses: state.courses,
                fetched: state.coursesFetched,
            }));
        }
    } catch { /* quota exceeded, etc. */ }
}

restoreCourses();

// ─── Public API ──────────────────────────────────────────────────

const isValid = (ts: number) => ts > 0 && Date.now() - ts < CACHE_DURATION;

/**
 * Get all courses. Returns from cache if fresh, otherwise fetches.
 */
export async function getCachedCourses(): Promise<Course[]> {
    if (isValid(state.coursesFetched) && state.courses) return state.courses;
    if (state.coursesPromise) return state.coursesPromise;

    state.coursesPromise = lmsApi.getCourses()
        .then((courses) => {
            state.courses = courses;
            state.coursesFetched = Date.now();
            state.coursesPromise = null;
            persistCourses();
            return courses;
        })
        .catch((err) => {
            state.coursesPromise = null;
            throw err;
        });

    return state.coursesPromise;
}

/**
 * Get lessons for a specific course. Cached per courseId.
 */
export async function getCachedCourseLessons(courseId: number): Promise<Lesson[]> {
    const cached = state.lessons.get(courseId);
    if (cached && isValid(cached.fetched)) return cached.data;

    const existing = state.lessonsPromises.get(courseId);
    if (existing) return existing;

    const promise = lmsApi.getCourseLessons(courseId)
        .then((lessons) => {
            state.lessons.set(courseId, { data: lessons, fetched: Date.now() });
            state.lessonsPromises.delete(courseId);
            return lessons;
        })
        .catch((err) => {
            state.lessonsPromises.delete(courseId);
            throw err;
        });

    state.lessonsPromises.set(courseId, promise);
    return promise;
}

/**
 * Invalidate all cached data. Call this after creating, editing, or
 * deleting a course or lesson.
 */
export function invalidateCourseCache(): void {
    state.courses = null;
    state.coursesFetched = 0;
    state.coursesPromise = null;
    state.lessons.clear();
    state.lessonsPromises.clear();
    try { localStorage.removeItem(STORAGE_KEY_COURSES); } catch { /* ignore */ }
}

/**
 * Invalidate only the lessons cache for a specific course.
 */
export function invalidateCourseLessons(courseId: number): void {
    state.lessons.delete(courseId);
    state.lessonsPromises.delete(courseId);
}
