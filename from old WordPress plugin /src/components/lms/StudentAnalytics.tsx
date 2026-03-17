/**
 * StudentAnalytics
 *
 * Admin view: sortable, filterable student progress table.
 * - Sortable by student name, email, active courses, completed lessons
 * - Course filter dropdown
 * - User search
 * - Archive toggle (defaults to non-archived only)
 * - Default sort: last name → first name ascending
 * - Expandable rows show per-course → per-lesson detail
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineCheckCircle,
    HiOutlineClock, HiOutlineAcademicCap, HiOutlineMagnifyingGlass,
    HiOutlineFunnel, HiOutlineArrowsUpDown, HiOutlineArchiveBox,
} from 'react-icons/hi2';
import { lmsApi, StudentProgress } from '../../services/api-lms';
import { getCachedCourses } from '../../services/courseCache';
import { Course } from '../../services/api-lms';

// ─── Sort types ─────────────────────────────────────────────────

type SortField = 'name' | 'email' | 'coursesActive' | 'completedLessons';
type SortDir = 'asc' | 'desc';

const StudentAnalytics: React.FC = () => {
    const [students, setStudents] = useState<StudentProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Expand state
    const [expandedUsers, setExpandedUsers] = useState<number[]>([]);
    const [expandedCourses, setExpandedCourses] = useState<string[]>([]);

    // Sorting
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Filters
    const [search, setSearch] = useState('');
    const [courseFilter, setCourseFilter] = useState<number | ''>('');
    const [showArchived, setShowArchived] = useState(false);
    const [courseList, setCourseList] = useState<Course[]>([]);

    // ─── Data loading ───────────────────────────────

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [progressData, courses] = await Promise.all([
                lmsApi.getAllStudentProgress({
                    excludeArchived: showArchived ? '0' : '1',
                    courseId: courseFilter || undefined,
                }),
                getCachedCourses(),
            ]);
            setStudents(progressData);
            setCourseList(courses);
        } catch (err) {
            console.error('Failed to load analytics:', err);
            setError('Failed to load student data. Please check your permissions.');
        } finally {
            setLoading(false);
        }
    }, [showArchived, courseFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Computed values ────────────────────────────

    const getCoursesActive = (s: StudentProgress) => Object.keys(s.courses).length;
    const getCompletedLessons = (s: StudentProgress) =>
        Object.values(s.courses).reduce((acc, c) => acc + c.lessons.filter(l => l.status === 'completed').length, 0);
    const getTotalLessons = (s: StudentProgress) =>
        Object.values(s.courses).reduce((acc, c) => acc + c.lessons.length, 0);

    // Sort key for names: last_name, first_name (fallback to display_name)
    const nameSortKey = (s: StudentProgress) =>
        `${(s.lastName || '').toLowerCase()}\t${(s.firstName || '').toLowerCase()}\t${s.userName.toLowerCase()}`;

    // ─── Filtered + sorted list ─────────────────────

    const filteredStudents = useMemo(() => {
        let list = [...students];

        // Text search (name or email)
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(s =>
                s.userName.toLowerCase().includes(q) ||
                s.userEmail.toLowerCase().includes(q) ||
                (s.firstName && s.firstName.toLowerCase().includes(q)) ||
                (s.lastName && s.lastName.toLowerCase().includes(q))
            );
        }

        // Sort
        list.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'name':
                    cmp = nameSortKey(a).localeCompare(nameSortKey(b));
                    break;
                case 'email':
                    cmp = a.userEmail.localeCompare(b.userEmail);
                    break;
                case 'coursesActive':
                    cmp = getCoursesActive(a) - getCoursesActive(b);
                    break;
                case 'completedLessons':
                    cmp = getCompletedLessons(a) - getCompletedLessons(b);
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [students, search, sortField, sortDir]);

    // ─── Interaction ────────────────────────────────

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const toggleUser = (userId: number) =>
        setExpandedUsers(p => p.includes(userId) ? p.filter(id => id !== userId) : [...p, userId]);

    const toggleCourse = (userId: number, courseId: number) => {
        const key = `${userId}-${courseId}`;
        setExpandedCourses(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'ap-text-green-600 ap-bg-green-50 ap-border-green-200';
            case 'in-progress': return 'ap-text-blue-600 ap-bg-blue-50 ap-border-blue-200';
            default: return 'ap-text-gray-500 ap-bg-gray-50 ap-border-gray-200';
        }
    };

    // ─── Column header helper ───────────────────────

    const SortHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className }) => (
        <button
            className={`ap-flex ap-items-center ap-gap-1 ap-font-medium ap-text-gray-600 hover:ap-text-gray-900 ap-transition-colors ap-select-none ${className || ''}`}
            onClick={() => handleSort(field)}
        >
            {label}
            {sortField === field ? (
                sortDir === 'asc' ? <HiOutlineChevronUp className="ap-w-3.5 ap-h-3.5" /> : <HiOutlineChevronDown className="ap-w-3.5 ap-h-3.5" />
            ) : (
                <HiOutlineArrowsUpDown className="ap-w-3.5 ap-h-3.5 ap-text-gray-300" />
            )}
        </button>
    );

    // ─── Render ─────────────────────────────────────

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-p-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600" />
            </div>
        );
    }

    if (error) {
        return <div className="ap-p-8 ap-text-center ap-text-red-600"><p>{error}</p></div>;
    }

    return (
        <div className="ap-max-w-6xl ap-mx-auto ap-p-6">
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-6 ap-flex ap-items-center ap-gap-3">
                <HiOutlineAcademicCap className="ap-w-8 ap-h-8 ap-text-blue-600" />
                Student Progress Analytics
            </h1>

            {/* Filter toolbar */}
            <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-3 ap-mb-4">
                {/* Search */}
                <div className="ap-relative ap-flex-1 ap-min-w-[200px] ap-max-w-sm">
                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                    <input
                        type="text"
                        className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Course filter */}
                <div className="ap-flex ap-items-center ap-gap-1.5">
                    <HiOutlineFunnel className="ap-w-4 ap-h-4 ap-text-gray-400" />
                    <select
                        className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-text-sm ap-bg-white"
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">All Courses</option>
                        {courseList.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>

                {/* Show archived toggle */}
                <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600 ap-cursor-pointer ap-select-none">
                    <input
                        type="checkbox"
                        className="ap-rounded"
                        checked={showArchived}
                        onChange={() => setShowArchived(!showArchived)}
                    />
                    <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />
                    Include archived
                </label>

                {/* Result count */}
                <span className="ap-text-sm ap-text-gray-400 ap-ml-auto">
                    {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                <div className="ap-grid ap-grid-cols-12 ap-gap-4 ap-p-4 ap-bg-gray-50 ap-border-b ap-border-gray-200 ap-text-sm">
                    <div className="ap-col-span-4"><SortHeader field="name" label="Student" /></div>
                    <div className="ap-col-span-4"><SortHeader field="email" label="Email" /></div>
                    <div className="ap-col-span-2 ap-flex ap-justify-center"><SortHeader field="coursesActive" label="Courses" /></div>
                    <div className="ap-col-span-2 ap-flex ap-justify-center"><SortHeader field="completedLessons" label="Completed" /></div>
                </div>

                {filteredStudents.length === 0 ? (
                    <div className="ap-p-8 ap-text-center ap-text-gray-500">
                        No progress data found{search || courseFilter ? ' matching your filters' : ''}.
                    </div>
                ) : (
                    <div className="ap-divide-y ap-divide-gray-100">
                        {filteredStudents.map(student => {
                            const isExpanded = expandedUsers.includes(student.userId);
                            return (
                                <div key={student.userId} className="group">
                                    {/* Student Row */}
                                    <div
                                        className="ap-grid ap-grid-cols-12 ap-gap-4 ap-p-4 ap-items-center hover:ap-bg-gray-50 ap-cursor-pointer ap-transition-colors"
                                        onClick={() => toggleUser(student.userId)}
                                    >
                                        <div className="ap-col-span-4 ap-flex ap-items-center ap-gap-2 ap-font-medium ap-text-gray-900">
                                            <span className="ap-text-gray-400 ap-flex-shrink-0">
                                                {isExpanded ? <HiOutlineChevronUp className="ap-w-4 ap-h-4" /> : <HiOutlineChevronDown className="ap-w-4 ap-h-4" />}
                                            </span>
                                            <span className="ap-truncate">
                                                {student.lastName && student.firstName
                                                    ? `${student.lastName}, ${student.firstName}`
                                                    : student.userName}
                                            </span>
                                            {student.isArchived && (
                                                <span className="ap-text-[10px] ap-bg-gray-200 ap-text-gray-500 ap-rounded ap-px-1.5 ap-py-0.5 ap-flex-shrink-0">Archived</span>
                                            )}
                                        </div>
                                        <div className="ap-col-span-4 ap-text-sm ap-text-gray-600 ap-truncate">
                                            {student.userEmail}
                                        </div>
                                        <div className="ap-col-span-2 ap-text-center ap-text-sm ap-font-medium">
                                            {getCoursesActive(student)}
                                        </div>
                                        <div className="ap-col-span-2 ap-text-center ap-text-sm ap-font-medium ap-text-green-600">
                                            {getCompletedLessons(student)} / {getTotalLessons(student)}
                                        </div>
                                    </div>

                                    {/* Expanded courses */}
                                    {isExpanded && (
                                        <div className="ap-bg-gray-50 ap-px-4 ap-pb-4 ap-pt-1 ap-border-t ap-border-gray-100">
                                            {Object.values(student.courses).map(course => {
                                                const courseKey = `${student.userId}-${course.courseId}`;
                                                const courseExpanded = expandedCourses.includes(courseKey);
                                                const completed = course.lessons.filter(l => l.status === 'completed').length;
                                                return (
                                                    <div key={course.courseId} className="ap-mt-3 ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                                                        <div
                                                            className="ap-p-3 ap-flex ap-items-center ap-justify-between ap-cursor-pointer hover:ap-bg-gray-50"
                                                            onClick={() => toggleCourse(student.userId, course.courseId)}
                                                        >
                                                            <div className="ap-flex ap-items-center ap-gap-2 ap-font-medium ap-text-blue-900">
                                                                {courseExpanded
                                                                    ? <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-blue-500" />
                                                                    : <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-blue-500" />}
                                                                {course.courseTitle}
                                                            </div>
                                                            <div className="ap-flex ap-items-center ap-gap-3 ap-text-xs ap-text-gray-500">
                                                                <span>{completed} / {course.lessons.length} Completed</span>
                                                                <div className="ap-w-20 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                                    <div
                                                                        className={`ap-h-full ap-rounded-full ${completed === course.lessons.length ? 'ap-bg-green-500' : completed > 0 ? 'ap-bg-blue-500' : 'ap-bg-gray-300'}`}
                                                                        style={{ width: `${course.lessons.length ? Math.round((completed / course.lessons.length) * 100) : 0}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {courseExpanded && (
                                                            <div className="ap-border-t ap-border-gray-100">
                                                                <div className="ap-grid ap-grid-cols-12 ap-gap-2 ap-p-2 ap-bg-gray-50 ap-text-xs ap-font-semibold ap-text-gray-500 ap-border-b ap-border-gray-100">
                                                                    <div className="ap-col-span-6">Lesson / Quiz</div>
                                                                    <div className="ap-col-span-2 ap-text-center">Type</div>
                                                                    <div className="ap-col-span-2 ap-text-center">Score</div>
                                                                    <div className="ap-col-span-2 ap-text-center">Status</div>
                                                                </div>
                                                                {course.lessons.map(lesson => (
                                                                    <div key={lesson.lessonId} className="ap-grid ap-grid-cols-12 ap-gap-2 ap-p-3 ap-text-sm ap-border-b ap-border-gray-50 last:ap-border-0 hover:ap-bg-gray-50">
                                                                        <div className="ap-col-span-6 ap-flex ap-items-center ap-gap-2">
                                                                            {lesson.status === 'completed'
                                                                                ? <HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-text-green-500" />
                                                                                : lesson.status === 'in-progress'
                                                                                    ? <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-blue-500" />
                                                                                    : <div className="ap-w-4 ap-h-4 ap-rounded-full ap-border ap-border-gray-300" />}
                                                                            <span className={lesson.status === 'completed' ? 'ap-text-gray-900' : 'ap-text-gray-600'}>
                                                                                {lesson.lessonTitle}
                                                                            </span>
                                                                        </div>
                                                                        <div className="ap-col-span-2 ap-text-center ap-capitalize ap-text-xs ap-text-gray-500 ap-py-0.5">
                                                                            <span className="ap-bg-gray-100 ap-px-2 ap-py-0.5 ap-rounded">{lesson.type}</span>
                                                                        </div>
                                                                        <div className="ap-col-span-2 ap-text-center ap-font-mono">
                                                                            {lesson.type === 'quiz'
                                                                                ? <span className={lesson.score >= 80 ? 'ap-text-green-600 ap-font-bold' : 'ap-text-red-500'}>{Math.round(lesson.score)}%</span>
                                                                                : '-'}
                                                                        </div>
                                                                        <div className="ap-col-span-2 ap-text-center">
                                                                            <span className={`ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-capitalize ap-border ${getStatusColor(lesson.status)}`}>
                                                                                {lesson.status}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAnalytics;
