/**
 * AssignedLearningManager
 *
 * Admin/editor view: unified hub for all assignment types.
 * Two sub-tabs:
 *   — Lesson Assignments: individual lessons sent to users/roles (not required to complete the full course)
 *   — Course Assignments: entire courses required for users/roles with per-lesson progress tracking
 *
 * Features an **inline** new-assignment form above the table (no modal wizard).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import {
    HiOutlineBellAlert,
    HiOutlineTrash,
    HiOutlineEye,
    HiOutlinePlus,
    HiOutlineClipboardDocumentList,
    HiOutlineAcademicCap,
    HiOutlineXMark,
    HiOutlineUserGroup,
    HiOutlineUser,
    HiOutlineCalendarDays,
    HiOutlineMagnifyingGlass,
    HiOutlinePaperAirplane,
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineInformationCircle,
} from 'react-icons/hi2';
import {
    getAssignments,
    getAssignment,
    deleteAssignment,
    remindAssignment,
    createAssignment,
    sendAssignment,
    LearningAssignment,
    AssignmentUser,
    CreateAssignmentPayload,
    SendAssignmentPayload,
} from '../../services/api-assigned-learning';
import {
    CourseSummary,
    AdminCourseAssignment,
    getCourseAssignmentSummary,
    getCourseAssignments,
    resyncCourseAssignments,
    createManualCourseAssignment,
} from '../../services/autoAssignService';
import { getCachedCourses, getCachedCourseLessons } from '../../services/courseCache';
import { getJobRoles, JobRole } from '../../services/api-professional-growth';
import { getCachedSimpleUsers } from '../../services/userCache';
import { Course, Lesson } from '../../services/api-lms';

// ─── Sub-tab types ──────────────────────────────────────────────

type SubTab = 'lessons' | 'courses';
type AssignmentType = 'lesson' | 'course';

// ─── Badge helpers ──────────────────────────────────────────────

const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'gray' | 'blue' | 'green' | 'yellow' | 'red'; label: string }> = {
        draft: { variant: 'gray', label: 'Draft' },
        active: { variant: 'blue', label: 'Active' },
        closed: { variant: 'green', label: 'Closed' },
        assigned: { variant: 'gray', label: 'Not Started' },
        'in-progress': { variant: 'yellow', label: 'In Progress' },
        completed: { variant: 'green', label: 'Completed' },
    };
    const s = map[status] || { variant: 'gray', label: status };
    return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
};

// ─── Main Component ─────────────────────────────────────────────

const AssignedLearningManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SubTab>('lessons');

    // ─── Lesson Assignments state ───────────────────
    const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [detailAssignment, setDetailAssignment] = useState<LearningAssignment | null>(null);
    const [detailUsers, setDetailUsers] = useState<AssignmentUser[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // ─── Course Assignments state ───────────────────
    const [courseSummary, setCourseSummary] = useState<CourseSummary[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
    const [courseUsers, setCourseUsers] = useState<AdminCourseAssignment[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    // ─── Inline form state ──────────────────────────
    const [formOpen, setFormOpen] = useState(false);
    const [formType, setFormType] = useState<AssignmentType>('lesson');
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Form data — shared
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [sendNotification, setSendNotification] = useState(true);

    // Form data — lesson-specific
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [lessonSearch, setLessonSearch] = useState('');

    // ─── Data loaders ───────────────────────────────

    const loadLessonAssignments = useCallback(async () => {
        setLoadingAssignments(true);
        try {
            const data = await getAssignments(filterStatus || undefined);
            setAssignments(data);
        } catch (e) {
            console.error('Failed to load assignments:', e);
        } finally {
            setLoadingAssignments(false);
        }
    }, [filterStatus]);

    const loadCourseSummary = useCallback(async () => {
        setLoadingCourses(true);
        try {
            const data = await getCourseAssignmentSummary();
            setCourseSummary(data);
        } catch (err) {
            console.error('Failed to load course assignment summary:', err);
        } finally {
            setLoadingCourses(false);
        }
    }, []);

    useEffect(() => { loadLessonAssignments(); }, [loadLessonAssignments]);
    useEffect(() => { loadCourseSummary(); }, [loadCourseSummary]);

    // Pre-load form data when form opens (uses courseCache for speed)
    useEffect(() => {
        if (!formOpen) return;
        getCachedCourses().then(setCourses).catch(console.error);
        getJobRoles().then(setJobRoles).catch(console.error);
        getCachedSimpleUsers().then(setAllUsers).catch(console.error);
    }, [formOpen]);

    useEffect(() => {
        if (selectedCourseId && formType === 'lesson') {
            getCachedCourseLessons(selectedCourseId).then(setLessons).catch(console.error);
        }
    }, [selectedCourseId, formType]);

    // Auto-set title from lesson
    useEffect(() => {
        if (selectedLesson && !formTitle) {
            setFormTitle(selectedLesson.title);
        }
    }, [selectedLesson]);

    // ─── Lesson assignment actions ──────────────────

    const handleDelete = async (a: LearningAssignment) => {
        if (!confirm(`Delete assignment "${a.title}"? This cannot be undone.`)) return;
        try { await deleteAssignment(a.id); loadLessonAssignments(); } catch { alert('Failed to delete assignment.'); }
    };
    const handleRemind = async (a: LearningAssignment) => {
        if (!confirm(`Send a reminder email to all users who haven't completed "${a.title}"?`)) return;
        try {
            const res = await remindAssignment(a.id);
            alert(`Queued ${res.remindersQueued} reminder email(s).`);
            loadLessonAssignments();
        } catch { alert('Failed to send reminders.'); }
    };
    const handleViewDetail = async (a: LearningAssignment) => {
        setDetailLoading(true); setDetailAssignment(a);
        try { const full = await getAssignment(a.id); setDetailAssignment(full); setDetailUsers(full.users || []); }
        catch (e) { console.error(e); } finally { setDetailLoading(false); }
    };

    // ─── Course assignment actions ──────────────────

    const handleExpandCourse = async (courseId: number) => {
        if (expandedCourse === courseId) { setExpandedCourse(null); setCourseUsers([]); return; }
        setExpandedCourse(courseId);
        setUsersLoading(true);
        try { const users = await getCourseAssignments(courseId); setCourseUsers(users); }
        catch (err) { console.error('Failed to load course users:', err); }
        finally { setUsersLoading(false); }
    };

    const handleResync = async (courseId: number) => {
        setSyncing(courseId); setSyncResult(null);
        try {
            const result = await resyncCourseAssignments(courseId);
            setSyncResult(result.assigned > 0
                ? `Assigned ${result.assigned} new user(s). ${result.skipped} already assigned.`
                : `All ${result.skipped} existing role members are already assigned.`);
            await loadCourseSummary();
            if (expandedCourse === courseId) {
                const users = await getCourseAssignments(courseId);
                setCourseUsers(users);
            }
        } catch { setSyncResult('Sync failed.'); } finally { setSyncing(null); }
    };

    // ─── Inline form submission ─────────────────────

    const resetForm = () => {
        setSelectedCourseId(null); setSelectedLesson(null); setLessons([]);
        setFormTitle(''); setFormDescription(''); setFormDueDate('');
        setSelectedRoles([]); setSelectedUsers([]); setUserSearch('');
        setLessonSearch(''); setFormError(''); setFormSuccess('');
        setSendNotification(true);
    };

    const handleFormSubmit = async () => {
        setFormSaving(true); setFormError(''); setFormSuccess('');
        try {
            if (formType === 'lesson') {
                if (!selectedLesson || !formTitle.trim()) { setFormError('Select a lesson and enter a title.'); setFormSaving(false); return; }
                if (selectedRoles.length === 0 && selectedUsers.length === 0) { setFormError('Select at least one role or user.'); setFormSaving(false); return; }
                const payload: CreateAssignmentPayload = {
                    lessonId: selectedLesson.id,
                    title: formTitle.trim(),
                    description: formDescription.trim() || undefined,
                    dueDate: formDueDate || undefined,
                };
                const created = await createAssignment(payload);
                const sendPayload: SendAssignmentPayload = {
                    jobRoleIds: selectedRoles.length ? selectedRoles : undefined,
                    userIds: selectedUsers.length ? selectedUsers : undefined,
                };
                const result = await sendAssignment(created.id, sendPayload);
                setFormSuccess(`Sent! ${result.recipientCount} recipient(s), ${result.emailsQueued} email(s) queued.`);
                resetForm();
                loadLessonAssignments();
            } else {
                if (!selectedCourseId) { setFormError('Select a course.'); setFormSaving(false); return; }
                if (selectedRoles.length === 0 && selectedUsers.length === 0) { setFormError('Select at least one role or user.'); setFormSaving(false); return; }
                const result = await createManualCourseAssignment(
                    selectedCourseId, selectedUsers, selectedRoles, sendNotification,
                );
                setFormSuccess(`Assigned course to ${result.assigned} user(s). ${result.skipped} already had it.`);
                resetForm();
                loadCourseSummary();
            }
        } catch (e: any) {
            setFormError(e.message || 'Something went wrong.');
        } finally {
            setFormSaving(false);
        }
    };

    const filteredLessons = lessons.filter(l => !lessonSearch || l.title.toLowerCase().includes(lessonSearch.toLowerCase()));
    const filteredUsers = allUsers.filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()));
    const completionPct = (a: LearningAssignment) => a.totalUsers > 0 ? Math.round((a.completedUsers / a.totalUsers) * 100) : 0;

    // Aggregate course stats
    const courseTotals = courseSummary.reduce(
        (acc, c) => ({
            assigned: acc.assigned + c.totalAssigned,
            completed: acc.completed + c.totalCompleted,
            inProgress: acc.inProgress + c.totalInProgress,
            notStarted: acc.notStarted + c.totalNotStarted,
        }),
        { assigned: 0, completed: 0, inProgress: 0, notStarted: 0 }
    );

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    const renderHelperText = () => (
        <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-mb-5 ap-text-sm ap-text-blue-800 ap-flex ap-gap-3">
            <HiOutlineInformationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0 ap-mt-0.5" />
            <div>
                <p className="ap-font-semibold ap-mb-1">How assignments work</p>
                {activeTab === 'lessons' ? (
                    <p>
                        <strong>Lesson Assignments</strong> send specific individual lessons to selected users or roles.
                        Use these when a user needs to complete a particular lesson — e.g., a safety refresher quiz —
                        without being required to take the full course. Completion is tracked per-lesson with email
                        notifications and reminders.
                    </p>
                ) : (
                    <p>
                        <strong>Course Assignments</strong> require users to complete an entire course (all lessons).
                        They can be created here manually or configured as auto-assign rules in a course's settings.
                        Progress is tracked per-lesson across the whole course, and users see the course in their
                        &ldquo;My Assignments&rdquo; panel on the LMS home page.
                    </p>
                )}
            </div>
        </div>
    );

    // ─── Inline form ────────────────────────────────

    const renderInlineForm = () => {
        if (!formOpen) return null;
        return (
            <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-5 ap-mb-5 ap-shadow-sm">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                    <h3 className="ap-text-base ap-font-semibold ap-text-gray-900">New Assignment</h3>
                    <button onClick={() => { setFormOpen(false); resetForm(); }} className="ap-text-gray-400 hover:ap-text-gray-600">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </button>
                </div>

                {/* Assignment type toggle */}
                <div className="ap-flex ap-gap-2 ap-mb-4">
                    <button
                        className={`ap-px-3 ap-py-1.5 ap-rounded-md ap-text-sm ap-font-medium ap-transition-colors ${formType === 'lesson' ? 'ap-bg-blue-100 ap-text-blue-700' : 'ap-bg-gray-100 ap-text-gray-600 hover:ap-bg-gray-200'}`}
                        onClick={() => { setFormType('lesson'); resetForm(); }}
                    >
                        <HiOutlineClipboardDocumentList className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                        Assign Lesson
                    </button>
                    <button
                        className={`ap-px-3 ap-py-1.5 ap-rounded-md ap-text-sm ap-font-medium ap-transition-colors ${formType === 'course' ? 'ap-bg-blue-100 ap-text-blue-700' : 'ap-bg-gray-100 ap-text-gray-600 hover:ap-bg-gray-200'}`}
                        onClick={() => { setFormType('course'); resetForm(); }}
                    >
                        <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                        Assign Course
                    </button>
                </div>

                <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-2 ap-gap-5">
                    {/* Left column: what to assign */}
                    <div className="ap-space-y-3">
                        <h4 className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wider">
                            {formType === 'lesson' ? 'Lesson Details' : 'Course'}
                        </h4>

                        {/* Course picker */}
                        <select
                            className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                            value={selectedCourseId ?? ''}
                            onChange={(e) => { setSelectedCourseId(Number(e.target.value) || null); setSelectedLesson(null); setLessons([]); }}
                        >
                            <option value="">— Choose a course —</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.lessonCount ?? 0} lessons)</option>)}
                        </select>

                        {/* Lesson picker (only for lesson type) */}
                        {formType === 'lesson' && selectedCourseId && (
                            <>
                                <div className="ap-relative">
                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                                    <input
                                        type="text" className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm"
                                        placeholder="Search lessons..." value={lessonSearch}
                                        onChange={(e) => setLessonSearch(e.target.value)}
                                    />
                                </div>
                                <div className="ap-max-h-32 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-md ap-divide-y ap-divide-gray-100">
                                    {filteredLessons.length === 0 ? (
                                        <p className="ap-p-3 ap-text-sm ap-text-gray-400 ap-italic">No lessons found.</p>
                                    ) : filteredLessons.map(l => (
                                        <button key={l.id}
                                            className={`ap-w-full ap-text-left ap-px-3 ap-py-2 ap-text-sm ap-transition-colors ${selectedLesson?.id === l.id ? 'ap-bg-blue-50 ap-text-blue-700 ap-font-medium' : 'hover:ap-bg-gray-50'}`}
                                            onClick={() => setSelectedLesson(l)}
                                        >
                                            {l.title}
                                            <Badge variant="gray" size="sm" className="ap-ml-2">{l.type || 'content'}</Badge>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Title + description (lesson only) */}
                        {formType === 'lesson' && (
                            <>
                                <input type="text" className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                                    value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Assignment title" />
                                <textarea className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm ap-resize-none" rows={2}
                                    value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description (optional)" />
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalendarDays className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                    <input type="date" className="ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                                        value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right column: recipients */}
                    <div className="ap-space-y-3">
                        <h4 className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wider">Recipients</h4>

                        {/* Roles */}
                        <div>
                            <label className="ap-flex ap-items-center ap-gap-1 ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1.5">
                                <HiOutlineUserGroup className="ap-w-4 ap-h-4" /> By Role
                            </label>
                            <div className="ap-grid ap-grid-cols-2 ap-gap-1.5 ap-max-h-28 ap-overflow-y-auto">
                                {jobRoles.map(r => {
                                    const checked = selectedRoles.includes(r.id);
                                    return (
                                        <label key={r.id} className={`ap-flex ap-items-center ap-gap-2 ap-px-2 ap-py-1.5 ap-rounded ap-border ap-text-xs ap-cursor-pointer ap-transition-colors ${checked ? 'ap-bg-blue-50 ap-border-blue-300' : 'ap-border-gray-200 hover:ap-bg-gray-50'}`}>
                                            <input type="checkbox" checked={checked} className="ap-rounded" onChange={() =>
                                                setSelectedRoles(prev => checked ? prev.filter(id => id !== r.id) : [...prev, r.id])} />
                                            <span className="ap-truncate">{r.title}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Users */}
                        <div>
                            <label className="ap-flex ap-items-center ap-gap-1 ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1.5">
                                <HiOutlineUser className="ap-w-4 ap-h-4" /> Or Individual Users
                            </label>
                            <div className="ap-relative ap-mb-1.5">
                                <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                                <input type="text" className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm"
                                    placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                            </div>
                            <div className="ap-max-h-28 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-md ap-divide-y ap-divide-gray-100">
                                {filteredUsers.slice(0, 80).map(u => {
                                    const checked = selectedUsers.includes(u.id);
                                    return (
                                        <label key={u.id} className={`ap-flex ap-items-center ap-gap-2 ap-px-3 ap-py-1.5 ap-text-sm ap-cursor-pointer ${checked ? 'ap-bg-blue-50' : 'hover:ap-bg-gray-50'}`}>
                                            <input type="checkbox" checked={checked} className="ap-rounded" onChange={() =>
                                                setSelectedUsers(prev => checked ? prev.filter(id => id !== u.id) : [...prev, u.id])} />
                                            <span className="ap-truncate">{u.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedUsers.length > 0 && <p className="ap-text-xs ap-text-gray-500 ap-mt-1">{selectedUsers.length} user(s) selected</p>}
                        </div>

                        {/* Send notification toggle */}
                        <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-700 ap-cursor-pointer">
                            <input type="checkbox" checked={sendNotification} className="ap-rounded"
                                onChange={() => setSendNotification(!sendNotification)} />
                            Send email notification
                        </label>
                    </div>
                </div>

                {/* Status messages + submit */}
                {formError && <p className="ap-mt-3 ap-text-sm ap-text-red-600 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded ap-p-2">{formError}</p>}
                {formSuccess && <p className="ap-mt-3 ap-text-sm ap-text-green-700 ap-bg-green-50 ap-border ap-border-green-200 ap-rounded ap-p-2">{formSuccess}</p>}

                <div className="ap-flex ap-justify-end ap-mt-4 ap-gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleFormSubmit} loading={formSaving} disabled={formSaving}>
                        <HiOutlinePaperAirplane className="ap-w-4 ap-h-4 ap-mr-1" />
                        {formType === 'lesson' ? 'Send Lesson Assignment' : 'Assign Course'}
                    </Button>
                </div>
            </div>
        );
    };

    // ─── Lesson Assignments table ───────────────────

    const renderLessonAssignmentsTab = () => (
        <>
            {loadingAssignments ? (
                <div className="ap-p-8 ap-text-center">
                    <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto" />
                    <p className="ap-mt-2 ap-text-gray-500">Loading assignments...</p>
                </div>
            ) : assignments.length === 0 ? (
                <div className="ap-p-12 ap-text-center ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
                    <HiOutlineClipboardDocumentList className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                    <p className="ap-text-gray-500">No lesson assignments yet.</p>
                    <Button onClick={() => { setFormOpen(true); setFormType('lesson'); }} variant="ghost" className="!ap-mt-4 !ap-text-blue-600">
                        Create your first lesson assignment →
                    </Button>
                </div>
            ) : (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                    <table className="ap-w-full ap-text-sm">
                        <thead>
                            <tr className="ap-bg-gray-50 ap-border-b ap-border-gray-200">
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Title</th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Lesson</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-font-medium ap-text-gray-600">Status</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-font-medium ap-text-gray-600">Due</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-font-medium ap-text-gray-600">Progress</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-font-medium ap-text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-100">
                            {assignments.map((a) => {
                                const pct = completionPct(a);
                                return (
                                    <tr key={a.id} className="hover:ap-bg-gray-50 ap-transition-colors">
                                        <td className="ap-px-4 ap-py-3">
                                            <button className="ap-font-medium ap-text-gray-900 hover:ap-text-blue-600 ap-text-left" onClick={() => handleViewDetail(a)}>
                                                {a.title}
                                            </button>
                                            <p className="ap-text-xs ap-text-gray-500">by {a.assignedByName}</p>
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-gray-700">{a.lessonTitle}</td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center">{statusBadge(a.status)}</td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center ap-text-gray-600 ap-text-xs">{a.dueDate ? formatLocalDate(a.dueDate) : '—'}</td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-2 ap-justify-center">
                                                <div className="ap-w-20 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                    <div className={`ap-h-full ap-rounded-full ${pct === 100 ? 'ap-bg-green-500' : pct > 0 ? 'ap-bg-blue-500' : 'ap-bg-gray-300'}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="ap-text-xs ap-text-gray-500">{a.completedUsers}/{a.totalUsers}</span>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-3">
                                            <div className="ap-flex ap-items-center ap-gap-1 ap-justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => handleViewDetail(a)} title="View" className="!ap-p-1.5"><HiOutlineEye className="ap-w-4 ap-h-4 ap-text-gray-600" /></Button>
                                                {a.status === 'active' && <Button variant="ghost" size="sm" onClick={() => handleRemind(a)} title="Remind" className="!ap-p-1.5"><HiOutlineBellAlert className="ap-w-4 ap-h-4 ap-text-yellow-600" /></Button>}
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(a)} title="Delete" className="!ap-p-1.5"><HiOutlineTrash className="ap-w-4 ap-h-4 ap-text-red-500" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );

    // ─── Course Assignments tab ─────────────────────

    const renderCourseAssignmentsTab = () => (
        <>
            {/* Summary cards */}
            <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-3 ap-mb-5">
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-3">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineUserGroup className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        <div><p className="ap-text-xs ap-text-gray-500">Total Assigned</p><p className="ap-text-lg ap-font-bold">{courseTotals.assigned}</p></div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-3">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-yellow-600" />
                        <div><p className="ap-text-xs ap-text-gray-500">In Progress</p><p className="ap-text-lg ap-font-bold">{courseTotals.inProgress}</p></div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-3">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600" />
                        <div><p className="ap-text-xs ap-text-gray-500">Completed</p><p className="ap-text-lg ap-font-bold">{courseTotals.completed}</p></div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-3">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-gray-500" />
                        <div><p className="ap-text-xs ap-text-gray-500">Not Started</p><p className="ap-text-lg ap-font-bold">{courseTotals.notStarted}</p></div>
                    </div>
                </div>
            </div>

            {syncResult && (
                <div className="ap-mb-4 ap-p-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-text-sm ap-text-blue-800 ap-flex ap-items-center ap-justify-between">
                    <span>{syncResult}</span>
                    <button onClick={() => setSyncResult(null)} className="ap-text-blue-600 hover:ap-text-blue-800 ap-text-xs ap-font-medium">Dismiss</button>
                </div>
            )}

            {loadingCourses ? (
                <div className="ap-p-8 ap-text-center">
                    <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto" />
                </div>
            ) : courseSummary.length === 0 ? (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-12 ap-text-center">
                    <HiOutlineAcademicCap className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                    <p className="ap-text-gray-500 ap-mb-2">No course assignments found.</p>
                    <p className="ap-text-sm ap-text-gray-400">Assign courses using the + New Assignment button above, or configure auto-assign rules in a course's settings.</p>
                </div>
            ) : (
                <div className="ap-space-y-3">
                    {courseSummary.map(course => (
                        <div key={course.courseId} className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                            {/* Course header */}
                            <div className="ap-p-4 ap-flex ap-items-center ap-justify-between ap-cursor-pointer hover:ap-bg-gray-50 ap-transition-colors"
                                onClick={() => handleExpandCourse(course.courseId)}>
                                <div className="ap-flex ap-items-center ap-gap-3 ap-flex-1 ap-min-w-0">
                                    <button className="ap-text-gray-400 ap-flex-shrink-0">
                                        {expandedCourse === course.courseId ? <HiOutlineChevronUp className="ap-w-5 ap-h-5" /> : <HiOutlineChevronDown className="ap-w-5 ap-h-5" />}
                                    </button>
                                    <div className="ap-min-w-0">
                                        <h3 className="ap-font-semibold ap-text-gray-900 ap-truncate">{course.courseTitle}</h3>
                                        <p className="ap-text-sm ap-text-gray-500">{course.lessonCount} lessons · Roles: {course.assignedRoles || 'None'}</p>
                                    </div>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-4 ap-flex-shrink-0">
                                    <div className="ap-hidden md:ap-flex ap-items-center ap-gap-3 ap-text-sm">
                                        <span className="ap-text-gray-500"><HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-inline ap-mr-0.5" />{course.totalAssigned}</span>
                                        <span className="ap-text-green-600"><HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-inline ap-mr-0.5" />{course.totalCompleted}</span>
                                    </div>
                                    <div className="ap-hidden sm:ap-flex ap-items-center ap-gap-2 ap-w-28">
                                        <div className="ap-w-full ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                            <div className="ap-h-full ap-bg-green-500 ap-rounded-full ap-transition-all" style={{ width: `${course.completionRate}%` }} />
                                        </div>
                                        <span className="ap-text-xs ap-text-gray-500 ap-w-10 ap-text-right">{course.completionRate}%</span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleResync(course.courseId); }}
                                        disabled={syncing === course.courseId} title="Re-sync: assign to current role members"
                                        className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-flex !ap-items-center !ap-gap-1">
                                        <HiOutlineArrowPath className={`ap-w-4 ap-h-4 ${syncing === course.courseId ? 'ap-animate-spin' : ''}`} />
                                        <span className="ap-hidden lg:ap-inline">Sync</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded user list */}
                            {expandedCourse === course.courseId && (
                                <div className="ap-border-t ap-border-gray-200">
                                    {usersLoading ? (
                                        <div className="ap-p-6 ap-text-center"><div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-blue-600 ap-mx-auto" /></div>
                                    ) : courseUsers.length === 0 ? (
                                        <div className="ap-p-6 ap-text-center ap-text-gray-500 ap-text-sm">No users assigned. Click &ldquo;Sync&rdquo; or use New Assignment to assign.</div>
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
                                                        <div className="ap-col-span-2 ap-text-gray-600 ap-truncate">{user.roleTitle || '—'}</div>
                                                        <div className="ap-col-span-2 ap-text-center">{statusBadge(user.status)}</div>
                                                        <div className="ap-col-span-3">
                                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                                <div className="ap-flex-1 ap-h-2 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                                    <div className={`ap-h-full ap-rounded-full ap-transition-all ${user.progress >= 100 ? 'ap-bg-green-500' : user.progress > 0 ? 'ap-bg-yellow-500' : 'ap-bg-gray-300'}`}
                                                                        style={{ width: `${Math.min(user.progress, 100)}%` }} />
                                                                </div>
                                                                <span className="ap-text-xs ap-text-gray-500 ap-w-14 ap-text-right">{user.completedLessons}/{user.totalLessons}</span>
                                                            </div>
                                                        </div>
                                                        <div className="ap-col-span-2 ap-text-right ap-text-xs ap-text-gray-500">{user.assignedAt ? new Date(user.assignedAt).toLocaleDateString() : '—'}</div>
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
        </>
    );

    // ─── Detail Modal (lesson assignments only) ─────

    const renderDetailModal = () => (
        <Modal isOpen={!!detailAssignment} onClose={() => { setDetailAssignment(null); setDetailUsers([]); }} size="lg">
            <Modal.Header><Modal.Title>{detailAssignment?.title || 'Assignment Detail'}</Modal.Title></Modal.Header>
            <Modal.Body>
                {detailLoading ? (
                    <div className="ap-p-6 ap-text-center ap-text-gray-500">Loading...</div>
                ) : detailAssignment ? (
                    <div className="ap-space-y-4">
                        <div className="ap-grid ap-grid-cols-3 ap-gap-4">
                            <div><p className="ap-text-xs ap-text-gray-500">Status</p>{statusBadge(detailAssignment.status)}</div>
                            <div><p className="ap-text-xs ap-text-gray-500">Lesson</p><p className="ap-text-sm ap-font-medium">{detailAssignment.lessonTitle}</p></div>
                            <div><p className="ap-text-xs ap-text-gray-500">Due Date</p><p className="ap-text-sm ap-font-medium">{detailAssignment.dueDate ? formatLocalDate(detailAssignment.dueDate) : '—'}</p></div>
                        </div>
                        {detailAssignment.description && <p className="ap-text-sm ap-text-gray-600">{detailAssignment.description}</p>}
                        <div>
                            <h3 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Recipient Progress ({detailUsers.length} users)</h3>
                            {detailUsers.length === 0 ? (
                                <p className="ap-text-sm ap-text-gray-400 ap-italic">No recipients yet — assignment is still a draft.</p>
                            ) : (
                                <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                    <table className="ap-w-full ap-text-xs">
                                        <thead><tr className="ap-bg-gray-50 ap-border-b">
                                            <th className="ap-px-3 ap-py-2 ap-text-left ap-font-medium ap-text-gray-600">User</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-center ap-font-medium ap-text-gray-600">Status</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-center ap-font-medium ap-text-gray-600">Score</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-center ap-font-medium ap-text-gray-600">Email</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-center ap-font-medium ap-text-gray-600">Completed</th>
                                        </tr></thead>
                                        <tbody className="ap-divide-y ap-divide-gray-100">
                                            {detailUsers.map(u => (
                                                <tr key={u.userId} className="hover:ap-bg-gray-50">
                                                    <td className="ap-px-3 ap-py-2"><p className="ap-font-medium">{u.userName}</p><p className="ap-text-gray-400">{u.userEmail}</p></td>
                                                    <td className="ap-px-3 ap-py-2 ap-text-center">{statusBadge(u.progressStatus)}</td>
                                                    <td className="ap-px-3 ap-py-2 ap-text-center">{u.quizScore !== null ? `${u.quizScore}%` : '—'}</td>
                                                    <td className="ap-px-3 ap-py-2 ap-text-center"><Badge variant={u.emailStatus === 'sent' ? 'green' : u.emailStatus === 'failed' ? 'red' : 'gray'} size="sm">{u.emailStatus}</Badge></td>
                                                    <td className="ap-px-3 ap-py-2 ap-text-center ap-text-gray-500">{u.completedAt ? formatLocalDate(u.completedAt) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </Modal.Body>
            <Modal.Footer>
                {detailAssignment?.status === 'active' && (
                    <Button variant="warning" size="sm" onClick={() => handleRemind(detailAssignment!)} className="!ap-flex !ap-items-center !ap-gap-1">
                        <HiOutlineBellAlert className="ap-w-4 ap-h-4" />Send Reminders
                    </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => { setDetailAssignment(null); setDetailUsers([]); }}>Close</Button>
            </Modal.Footer>
        </Modal>
    );

    // ─── Main return ────────────────────────────────

    return (
        <div>
            {/* Toolbar */}
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-4 ap-gap-2 ap-flex-wrap">
                {/* Sub-tabs */}
                <div className="ap-flex ap-items-center ap-gap-1 ap-bg-gray-100 ap-rounded-lg ap-p-1">
                    <button
                        className={`ap-px-3 ap-py-1.5 ap-rounded-md ap-text-sm ap-font-medium ap-transition-colors ${activeTab === 'lessons' ? 'ap-bg-white ap-text-gray-900 ap-shadow-sm' : 'ap-text-gray-600 hover:ap-text-gray-900'}`}
                        onClick={() => setActiveTab('lessons')}
                    >
                        <HiOutlineClipboardDocumentList className="ap-w-4 ap-h-4 ap-inline ap-mr-1 -ap-mt-0.5" />
                        Lesson Assignments
                    </button>
                    <button
                        className={`ap-px-3 ap-py-1.5 ap-rounded-md ap-text-sm ap-font-medium ap-transition-colors ${activeTab === 'courses' ? 'ap-bg-white ap-text-gray-900 ap-shadow-sm' : 'ap-text-gray-600 hover:ap-text-gray-900'}`}
                        onClick={() => setActiveTab('courses')}
                    >
                        <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-inline ap-mr-1 -ap-mt-0.5" />
                        Course Assignments
                    </button>
                </div>

                <div className="ap-flex ap-items-center ap-gap-2">
                    {activeTab === 'lessons' && (
                        <select className="ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-1.5 ap-text-sm ap-bg-white"
                            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                        </select>
                    )}
                    <Button onClick={() => { setFormOpen(!formOpen); setFormType(activeTab === 'courses' ? 'course' : 'lesson'); }}
                        variant="primary" className="!ap-flex !ap-items-center !ap-gap-2">
                        <HiOutlinePlus className="ap-w-4 ap-h-4" />
                        New Assignment
                    </Button>
                </div>
            </div>

            {renderHelperText()}
            {renderInlineForm()}

            {activeTab === 'lessons' ? renderLessonAssignmentsTab() : renderCourseAssignmentsTab()}
            {renderDetailModal()}
        </div>
    );
};

export default AssignedLearningManager;
