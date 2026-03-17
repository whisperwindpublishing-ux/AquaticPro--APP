/**
 * CourseAssignmentsView
 *
 * Unified admin view showing all course auto-assignments.
 * Grouped by course with per-user progress tracking, resync capability,
 * and summary stats. This replaces the need to bounce between
 * Course Settings, Analytics, and the Assigned Learning tab.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    HiOutlineUserGroup,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineArrowPath,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineAcademicCap,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
    CourseSummary,
    AdminCourseAssignment,
    getCourseAssignmentSummary,
    getCourseAssignments,
    resyncCourseAssignments,
} from '../../services/autoAssignService';

const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'gray' | 'blue' | 'green' | 'yellow' | 'red'; label: string }> = {
        assigned:       { variant: 'gray',   label: 'Not Started' },
        'in-progress':  { variant: 'yellow', label: 'In Progress' },
        completed:      { variant: 'green',  label: 'Completed' },
    };
    const s = map[status] || { variant: 'gray', label: status };
    return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
};

const CourseAssignmentsView: React.FC = () => {
    const [summary, setSummary] = useState<CourseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
    const [courseUsers, setCourseUsers] = useState<AdminCourseAssignment[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    const loadSummary = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCourseAssignmentSummary();
            setSummary(data);
        } catch (err) {
            console.error('Failed to load course assignment summary:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    const handleExpandCourse = async (courseId: number) => {
        if (expandedCourse === courseId) {
            setExpandedCourse(null);
            setCourseUsers([]);
            return;
        }
        setExpandedCourse(courseId);
        setUsersLoading(true);
        try {
            const users = await getCourseAssignments(courseId);
            setCourseUsers(users);
        } catch (err) {
            console.error('Failed to load course users:', err);
        } finally {
            setUsersLoading(false);
        }
    };

    const handleResync = async (courseId: number) => {
        setSyncing(courseId);
        setSyncResult(null);
        try {
            const result = await resyncCourseAssignments(courseId);
            if (result.assigned > 0) {
                setSyncResult(`Assigned ${result.assigned} new user(s). ${result.skipped} already assigned.`);
                // Refresh both summary and expanded user list
                await loadSummary();
                if (expandedCourse === courseId) {
                    const users = await getCourseAssignments(courseId);
                    setCourseUsers(users);
                }
            } else {
                setSyncResult(`All ${result.skipped} existing role members are already assigned.`);
            }
        } catch (err) {
            setSyncResult('Sync failed. Check console for details.');
            console.error('Resync failed:', err);
        } finally {
            setSyncing(null);
        }
    };

    // Aggregate stats across all courses
    const totals = summary.reduce(
        (acc, c) => ({
            assigned: acc.assigned + c.totalAssigned,
            completed: acc.completed + c.totalCompleted,
            inProgress: acc.inProgress + c.totalInProgress,
            notStarted: acc.notStarted + c.totalNotStarted,
        }),
        { assigned: 0, completed: 0, inProgress: 0, notStarted: 0 }
    );

    if (loading) {
        return (
            <div className="ap-flex ap-justify-center ap-p-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-6xl ap-mx-auto">
            {/* Summary Cards */}
            <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-4 ap-mb-6">
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-blue-100 ap-rounded-lg">
                            <HiOutlineUserGroup className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Total Assigned</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{totals.assigned}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-yellow-100 ap-rounded-lg">
                            <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-yellow-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">In Progress</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{totals.inProgress}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-green-100 ap-rounded-lg">
                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Completed</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{totals.completed}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-gray-100 ap-rounded-lg">
                            <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-gray-500" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Not Started</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{totals.notStarted}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sync result banner */}
            {syncResult && (
                <div className="ap-mb-4 ap-p-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-text-sm ap-text-blue-800 ap-flex ap-items-center ap-justify-between">
                    <span>{syncResult}</span>
                    <button onClick={() => setSyncResult(null)} className="ap-text-blue-600 hover:ap-text-blue-800 ap-text-xs ap-font-medium">Dismiss</button>
                </div>
            )}

            {/* Course list */}
            {summary.length === 0 ? (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-12 ap-text-center">
                    <HiOutlineAcademicCap className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                    <p className="ap-text-gray-500 ap-mb-2">No course assignments found</p>
                    <p className="ap-text-sm ap-text-gray-400">
                        Configure auto-assign rules in Course Settings to automatically assign courses to role members.
                    </p>
                </div>
            ) : (
                <div className="ap-space-y-3">
                    {summary.map(course => (
                        <div key={course.courseId} className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                            {/* Course header row */}
                            <div
                                className="ap-p-4 ap-flex ap-items-center ap-justify-between ap-cursor-pointer hover:ap-bg-gray-50 ap-transition-colors"
                                onClick={() => handleExpandCourse(course.courseId)}
                            >
                                <div className="ap-flex ap-items-center ap-gap-4 ap-flex-1 ap-min-w-0">
                                    <button className="ap-text-gray-400 ap-flex-shrink-0">
                                        {expandedCourse === course.courseId
                                            ? <HiOutlineChevronUp className="ap-w-5 ap-h-5" />
                                            : <HiOutlineChevronDown className="ap-w-5 ap-h-5" />
                                        }
                                    </button>
                                    <div className="ap-min-w-0">
                                        <h3 className="ap-font-semibold ap-text-gray-900 ap-truncate">{course.courseTitle}</h3>
                                        <p className="ap-text-sm ap-text-gray-500">
                                            {course.lessonCount} lessons &middot; Roles: {course.assignedRoles || 'None'}
                                        </p>
                                    </div>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-6 ap-flex-shrink-0">
                                    {/* Mini stats */}
                                    <div className="ap-hidden md:ap-flex ap-items-center ap-gap-4 ap-text-sm">
                                        <span className="ap-text-gray-500" title="Total assigned">
                                            <HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                                            {course.totalAssigned}
                                        </span>
                                        <span className="ap-text-green-600" title="Completed">
                                            <HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                                            {course.totalCompleted}
                                        </span>
                                        <span className="ap-text-yellow-600" title="In progress">
                                            <HiOutlineClock className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                                            {course.totalInProgress}
                                        </span>
                                    </div>
                                    {/* Completion bar */}
                                    <div className="ap-hidden sm:ap-flex ap-items-center ap-gap-2 ap-w-32">
                                        <div className="ap-w-full ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                            <div
                                                className="ap-h-full ap-bg-green-500 ap-rounded-full ap-transition-all"
                                                style={{ width: `${course.completionRate}%` }}
                                            />
                                        </div>
                                        <span className="ap-text-xs ap-text-gray-500 ap-w-10 ap-text-right">{course.completionRate}%</span>
                                    </div>
                                    {/* Re-sync button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); handleResync(course.courseId); }}
                                        disabled={syncing === course.courseId}
                                        title="Re-sync: assign course to all current role members who don't have it yet"
                                        className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-flex !ap-items-center !ap-gap-1"
                                    >
                                        <HiOutlineArrowPath className={`ap-w-4 ap-h-4 ${syncing === course.courseId ? 'ap-animate-spin' : ''}`} />
                                        <span className="ap-hidden lg:ap-inline">Sync Members</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded user list */}
                            {expandedCourse === course.courseId && (
                                <div className="ap-border-t ap-border-gray-200">
                                    {usersLoading ? (
                                        <div className="ap-p-6 ap-text-center">
                                            <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-blue-600 ap-mx-auto"></div>
                                        </div>
                                    ) : courseUsers.length === 0 ? (
                                        <div className="ap-p-6 ap-text-center ap-text-gray-500 ap-text-sm">
                                            No users assigned yet. Click "Sync Members" to assign to all current role members.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="ap-grid ap-grid-cols-12 ap-gap-2 ap-px-4 ap-py-2 ap-bg-gray-50 ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                <div className="ap-col-span-3">User</div>
                                                <div className="ap-col-span-2">Role</div>
                                                <div className="ap-col-span-2 ap-text-center">Status</div>
                                                <div className="ap-col-span-3">Progress</div>
                                                <div className="ap-col-span-2 ap-text-right">Assigned</div>
                                            </div>
                                            <div className="ap-divide-y ap-divide-gray-100 ap-max-h-96 ap-overflow-y-auto">
                                                {courseUsers.map(user => (
                                                    <div key={user.id} className="ap-grid ap-grid-cols-12 ap-gap-2 ap-px-4 ap-py-3 ap-items-center ap-text-sm hover:ap-bg-gray-50">
                                                        <div className="ap-col-span-3">
                                                            <p className="ap-font-medium ap-text-gray-900 ap-truncate">{user.userName}</p>
                                                            <p className="ap-text-xs ap-text-gray-400 ap-truncate">{user.userEmail}</p>
                                                        </div>
                                                        <div className="ap-col-span-2 ap-text-gray-600 ap-truncate">
                                                            {user.roleTitle || '—'}
                                                        </div>
                                                        <div className="ap-col-span-2 ap-text-center">
                                                            {statusBadge(user.status)}
                                                        </div>
                                                        <div className="ap-col-span-3">
                                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                                <div className="ap-flex-1 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                                    <div
                                                                        className={`ap-h-full ap-rounded-full ap-transition-all ${
                                                                            user.progress >= 100 ? 'ap-bg-green-500' :
                                                                            user.progress > 0 ? 'ap-bg-yellow-500' :
                                                                            'ap-bg-gray-300'
                                                                        }`}
                                                                        style={{ width: `${Math.min(user.progress, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="ap-text-xs ap-text-gray-500 ap-w-16 ap-text-right">
                                                                    {user.completedLessons}/{user.totalLessons}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="ap-col-span-2 ap-text-right ap-text-xs ap-text-gray-500">
                                                            {user.assignedAt ? new Date(user.assignedAt).toLocaleDateString() : '—'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseAssignmentsView;
