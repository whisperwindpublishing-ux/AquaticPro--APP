/**
 * UnifiedAlertStrip
 *
 * A single persistent notification strip that consolidates all four alert types:
 *   1. Certificate alerts (expired / expiring soon / missing)
 *   2. Assigned lesson alerts (pending / overdue / due soon)
 *   3. Assigned course alerts (pending / overdue)
 *   4. TaskDeck card alerts (assigned cards)
 *
 * Behaviour:
 *   - Each section (certs, lessons, courses, tasks) can be INDEPENDENTLY
 *     collapsed to a thin strip or expanded to show full details.
 *   - NO dismiss / NO X button anywhere — sections stay visible until the
 *     underlying issue is resolved.
 *   - Per-section collapse state persists in localStorage with no expiry.
 *   - Disappears entirely only when there are zero issues across all types.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View } from '@/App';
import { formatLocalDate } from '@/utils/dateUtils';
import {
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineExclamationTriangle,
    HiOutlineXCircle,
    HiOutlineAcademicCap,
    HiOutlineBookOpen,
    HiOutlineClipboardDocumentList,
    HiOutlineClock,
    HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { getMyAlerts } from '@/services/certificateService';
import { getMyAssignments, MyAssignment } from '@/services/api-assigned-learning';
import { getMyCourseAssignments, CourseAssignment } from '@/services/autoAssignService';
import type { CertAlerts } from '@/services/certificateService';
import { pluginGet } from '@/services/api-service';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AssignedCard {
    card_id: number;
    title: string;
    deck_name: string;
    list_name: string;
    due_date: string | null;
}

interface UnifiedAlertStripProps {
    onNavigate: (view: View) => void;
    onOpenLesson: (lessonId: number) => void;
    /** Whether TaskDeck module is enabled */
    enableTaskDeck: boolean;
    /** Whether LMS module is enabled */
    enableLms: boolean;
    /** Whether Certificates module is enabled */
    enableCertificates: boolean;
    /** Current view — used to hide sections when user is already on that page */
    currentView: string;
}

// Per-section localStorage keys — no global key, each section collapses independently
const LS = {
    certs:   'alertStrip_certs_collapsed',
    lessons: 'alertStrip_lessons_collapsed',
    courses: 'alertStrip_courses_collapsed',
    tasks:   'alertStrip_tasks_collapsed',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isOverdueDate(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

function isDueSoonDate(dateStr: string | null | undefined, daysAhead = 7): boolean {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    const soon = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return due >= new Date() && due <= soon;
}

// ─────────────────────────────────────────────────────────────────────────────
// CollapsibleSection — shared wrapper used by every alert type
// ─────────────────────────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
    /** localStorage key to persist this section's collapsed state */
    storageKey: string;
    /** Tailwind gradient classes e.g. "ap-from-red-500 ap-to-rose-600" */
    gradient: string;
    /** Left icon element in the header */
    icon: React.ReactNode;
    /** Bold title text */
    title: string;
    /** Subdued subtitle / counts */
    subtitle: React.ReactNode;
    /** Action button(s) shown on the right of the header when expanded */
    action?: React.ReactNode;
    /** Detail content shown when expanded */
    children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    storageKey,
    gradient,
    icon,
    title,
    subtitle,
    action,
    children,
}) => {
    const [collapsed, setCollapsed] = useState<boolean>(
        () => localStorage.getItem(storageKey) === 'true'
    );

    const toggle = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem(storageKey, String(next));
            return next;
        });
    }, [storageKey]);

    // ── COLLAPSED — thin single-line strip ──────────────────────────────────
    if (collapsed) {
        return (
            <div
                className={`ap-bg-gradient-to-r ${gradient} ap-text-white ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-1.5 ap-rounded-lg ap-shadow ap-text-sm`}
                role="alert"
            >
                <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0">
                    <span className="ap-opacity-80 ap-flex-shrink-0">{icon}</span>
                    <span className="ap-font-medium ap-truncate">{title}</span>
                    <span className="ap-text-white/70 ap-hidden sm:ap-inline ap-truncate">— {subtitle}</span>
                </div>
                <button
                    onClick={toggle}
                    className="ap-flex ap-items-center ap-gap-1 ap-ml-3 ap-flex-shrink-0 ap-bg-white/20 hover:ap-bg-white/30 ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-semibold ap-transition-colors"
                    aria-label="Expand section"
                >
                    Show
                    <HiOutlineChevronDown className="ap-w-3.5 ap-h-3.5" />
                </button>
            </div>
        );
    }

    // ── EXPANDED — full card ─────────────────────────────────────────────────
    return (
        <div
            className={`ap-bg-gradient-to-r ${gradient} ap-text-white ap-rounded-lg ap-shadow ap-overflow-hidden`}
            role="alert"
        >
            {/* Header row */}
            <div className="ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between">
                <div className="ap-flex ap-items-center ap-gap-3">
                    <div className="ap-bg-white/20 ap-rounded-full ap-p-2 ap-flex-shrink-0">
                        {icon}
                    </div>
                    <div className="ap-min-w-0">
                        <p className="ap-font-semibold ap-leading-tight">{title}</p>
                        <p className="ap-text-white/80 ap-text-xs ap-mt-0.5">{subtitle}</p>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-2 ap-flex-shrink-0 ap-ml-3">
                    {action}
                    {/* Collapse toggle — no dismiss */}
                    <button
                        onClick={toggle}
                        className="ap-flex ap-items-center ap-gap-1 ap-bg-white/20 hover:ap-bg-white/30 ap-px-2 ap-py-1 ap-rounded ap-text-xs ap-font-semibold ap-transition-colors"
                        aria-label="Collapse section"
                        title="Collapse (still active until resolved)"
                    >
                        <HiOutlineChevronUp className="ap-w-3.5 ap-h-3.5" />
                    </button>
                </div>
            </div>
            {/* Detail body */}
            <div className="ap-bg-black/10 ap-border-t ap-border-white/10">
                {children}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const UnifiedAlertStrip: React.FC<UnifiedAlertStripProps> = ({
    onNavigate,
    onOpenLesson,
    enableTaskDeck,
    enableLms,
    enableCertificates,
    currentView,
}) => {
    const [certs, setCerts] = useState<CertAlerts | null>(null);
    const [lessons, setLessons] = useState<MyAssignment[]>([]);
    const [courses, setCourses] = useState<CourseAssignment[]>([]);
    const [tasks, setTasks] = useState<AssignedCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Fetch all alert data in parallel ──────────────────────────────────
    useEffect(() => {
        const fetches: Promise<void>[] = [];

        if (enableCertificates) {
            fetches.push(
                getMyAlerts()
                    .then(setCerts)
                    .catch(err => console.error('[UnifiedAlertStrip] certs:', err))
            );
        }

        if (enableLms) {
            fetches.push(
                getMyAssignments()
                    .then(data => setLessons(data.filter(a => a.progressStatus !== 'completed')))
                    .catch(err => console.error('[UnifiedAlertStrip] lessons:', err))
            );
            fetches.push(
                getMyCourseAssignments()
                    .then(data => setCourses(data.filter(a => a.status !== 'completed')))
                    .catch(err => console.error('[UnifiedAlertStrip] courses:', err))
            );
        }

        if (enableTaskDeck) {
            fetches.push(
                pluginGet('taskcards/my-assigned')
                    .then((data: any) => setTasks(data?.cards ?? []))
                    .catch(err => console.error('[UnifiedAlertStrip] tasks:', err))
            );
        }

        Promise.allSettled(fetches).finally(() => setIsLoading(false));
    }, [enableCertificates, enableLms, enableTaskDeck]);

    // ── Computed totals ─────────────────────────────────────────────────────
    const certIssueCount =
        (certs?.expired?.length ?? 0) +
        (certs?.missing?.length ?? 0) +
        (certs?.expiringSoon?.length ?? 0);

    const showCerts =
        enableCertificates &&
        certIssueCount > 0 &&
        currentView !== 'certificates' &&
        currentView !== 'usermgmt:certificate-settings';

    const showLessons = enableLms && lessons.length > 0 && !currentView.startsWith('learning');
    const showCourses = enableLms && courses.length > 0 && !currentView.startsWith('learning');
    const showTasks   = enableTaskDeck && tasks.length > 0 && currentView !== 'taskdeck';

    // ── Nothing to show ─────────────────────────────────────────────────────
    if (isLoading || (!showCerts && !showLessons && !showCourses && !showTasks)) return null;

    return (
        <div className="ap-mb-6 ap-space-y-2">
            {showCerts   && certs   && <CertSection   certs={certs}    onNavigate={onNavigate} />}
            {showLessons            && <LessonSection lessons={lessons} onOpenLesson={onOpenLesson} />}
            {showCourses            && <CourseSection courses={courses} onNavigate={onNavigate} />}
            {showTasks              && <TaskSection   tasks={tasks}    onNavigate={onNavigate} />}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-section: Certificates
// ─────────────────────────────────────────────────────────────────────────────

const CertSection: React.FC<{ certs: CertAlerts; onNavigate: (v: View) => void }> = ({ certs, onNavigate }) => {
    const hasExpired = certs.expired.length > 0;
    const hasMissing = certs.missing.length > 0;
    const isRed     = hasExpired || hasMissing;
    const total     = certs.expired.length + certs.missing.length + certs.expiringSoon.length;
    const gradient  = isRed ? 'ap-from-red-500 ap-to-rose-600' : 'ap-from-amber-500 ap-to-yellow-600';

    const subtitle = (
        <>
            {hasMissing && <span className="ap-text-red-200 ap-font-medium">{certs.missing.length} missing</span>}
            {hasMissing && hasExpired && ' • '}
            {hasExpired && <span className="ap-text-red-200 ap-font-medium">{certs.expired.length} expired</span>}
            {(hasMissing || hasExpired) && certs.expiringSoon.length > 0 && ' • '}
            {certs.expiringSoon.length > 0 && `${certs.expiringSoon.length} expiring soon`}
        </>
    );

    return (
        <CollapsibleSection
            storageKey={LS.certs}
            gradient={gradient}
            icon={isRed ? <HiOutlineXCircle className="ap-w-5 ap-h-5" /> : <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5" />}
            title={`${total} certificate${total !== 1 ? 's' : ''} need attention`}
            subtitle={subtitle}
            action={
                <button
                    onClick={() => onNavigate('certificates')}
                    className="ap-flex ap-items-center ap-gap-1 ap-bg-white/20 hover:ap-bg-white/30 ap-px-3 ap-py-1.5 ap-rounded ap-text-sm ap-font-medium ap-transition-colors"
                >
                    View Certificates
                    <HiOutlineArrowTopRightOnSquare className="ap-w-3.5 ap-h-3.5" />
                </button>
            }
        >
            {total <= 8 && (
                <div className="ap-px-4 ap-py-2 ap-flex ap-flex-wrap ap-gap-2">
                    {certs.missing.map(c => (
                        <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                            <span className="ap-text-red-200 ap-font-semibold">MISSING</span> {c.certificateName}
                        </span>
                    ))}
                    {certs.expired.map(c => (
                        <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                            <span className="ap-text-red-200 ap-font-semibold">EXPIRED</span> {c.certificateName}
                        </span>
                    ))}
                    {certs.expiringSoon.map(c => (
                        <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-xs">
                            <span className="ap-text-yellow-200">Expiring</span> {c.certificateName}
                        </span>
                    ))}
                </div>
            )}
        </CollapsibleSection>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-section: Assigned Lessons
// ─────────────────────────────────────────────────────────────────────────────

const LessonSection: React.FC<{ lessons: MyAssignment[]; onOpenLesson: (id: number) => void }> = ({ lessons, onOpenLesson }) => {
    const overdueCount = lessons.filter(l => l.isOverdue).length;
    const dueSoonCount = lessons.filter(l => l.isDueSoon && !l.isOverdue).length;

    const subtitle = (
        <>
            {overdueCount > 0 && <span className="ap-text-red-200 ap-font-medium">{overdueCount} overdue{dueSoonCount > 0 ? ' • ' : ''}</span>}
            {dueSoonCount > 0 && <span className="ap-text-yellow-200">{dueSoonCount} due soon</span>}
            {overdueCount === 0 && dueSoonCount === 0 && 'Click a lesson to start'}
        </>
    );

    return (
        <CollapsibleSection
            storageKey={LS.lessons}
            gradient="ap-from-indigo-500 ap-to-purple-600"
            icon={<HiOutlineAcademicCap className="ap-w-5 ap-h-5" />}
            title={`${lessons.length} assigned lesson${lessons.length !== 1 ? 's' : ''} to complete`}
            subtitle={subtitle}
        >
            <div className="ap-px-4 ap-py-2 ap-space-y-1.5">
                {lessons.slice(0, 4).map(a => (
                    <button
                        key={a.assignmentId}
                        onClick={() => onOpenLesson(a.lessonId)}
                        className="ap-w-full ap-flex ap-items-center ap-justify-between ap-gap-2 ap-px-3 ap-py-1.5 ap-rounded ap-bg-white/10 hover:ap-bg-white/20 ap-transition-colors ap-text-left"
                    >
                        <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0">
                            {a.isOverdue
                                ? <HiOutlineExclamationTriangle className="ap-w-3.5 ap-h-3.5 ap-text-red-200 ap-flex-shrink-0" />
                                : a.isDueSoon
                                    ? <HiOutlineClock className="ap-w-3.5 ap-h-3.5 ap-text-yellow-200 ap-flex-shrink-0" />
                                    : <HiOutlineAcademicCap className="ap-w-3.5 ap-h-3.5 ap-text-white/60 ap-flex-shrink-0" />
                            }
                            <span className="ap-text-sm ap-truncate">{a.title}</span>
                            {a.dueDate && (
                                <span className={`ap-text-xs ap-flex-shrink-0 ${a.isOverdue ? 'ap-text-red-200' : 'ap-text-white/60'}`}>
                                    Due {formatLocalDate(a.dueDate)}
                                </span>
                            )}
                        </div>
                        <span className="ap-text-xs ap-text-white/70 ap-flex-shrink-0 ap-flex ap-items-center ap-gap-1">
                            {a.progressStatus === 'in-progress' ? 'Continue' : 'Start'}
                            <HiOutlineArrowTopRightOnSquare className="ap-w-3 ap-h-3" />
                        </span>
                    </button>
                ))}
                {lessons.length > 4 && (
                    <p className="ap-text-center ap-text-xs ap-text-white/60 ap-py-1">
                        +{lessons.length - 4} more — open Learning to see all
                    </p>
                )}
            </div>
        </CollapsibleSection>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-section: Assigned Courses
// ─────────────────────────────────────────────────────────────────────────────

const CourseSection: React.FC<{ courses: CourseAssignment[]; onNavigate: (v: View) => void }> = ({ courses, onNavigate }) => {
    const overdueCount = courses.filter(c => isOverdueDate(c.dueDate)).length;
    const dueSoonCount = courses.filter(c => isDueSoonDate(c.dueDate) && !isOverdueDate(c.dueDate)).length;

    const subtitle = (
        <>
            {overdueCount > 0 && <span className="ap-text-red-200 ap-font-medium">{overdueCount} overdue{dueSoonCount > 0 ? ' • ' : ''}</span>}
            {dueSoonCount > 0 && <span className="ap-text-yellow-200">{dueSoonCount} due soon</span>}
            {overdueCount === 0 && dueSoonCount === 0 && 'Click a course to start'}
        </>
    );

    return (
        <CollapsibleSection
            storageKey={LS.courses}
            gradient="ap-from-teal-500 ap-to-cyan-600"
            icon={<HiOutlineBookOpen className="ap-w-5 ap-h-5" />}
            title={`${courses.length} assigned course${courses.length !== 1 ? 's' : ''} to complete`}
            subtitle={subtitle}
            action={
                <button
                    onClick={() => onNavigate('learning')}
                    className="ap-flex ap-items-center ap-gap-1 ap-bg-white/20 hover:ap-bg-white/30 ap-px-3 ap-py-1.5 ap-rounded ap-text-sm ap-font-medium ap-transition-colors"
                >
                    View Courses
                    <HiOutlineArrowTopRightOnSquare className="ap-w-3.5 ap-h-3.5" />
                </button>
            }
        >
            <div className="ap-px-4 ap-py-2 ap-space-y-1.5">
                {courses.slice(0, 4).map(c => {
                    const isOD = isOverdueDate(c.dueDate);
                    const isDS = isDueSoonDate(c.dueDate);
                    return (
                        <button
                            key={c.id}
                            onClick={() => onNavigate('learning')}
                            className="ap-w-full ap-flex ap-items-center ap-justify-between ap-gap-2 ap-px-3 ap-py-1.5 ap-rounded ap-bg-white/10 hover:ap-bg-white/20 ap-transition-colors ap-text-left"
                        >
                            <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0">
                                {isOD
                                    ? <HiOutlineExclamationTriangle className="ap-w-3.5 ap-h-3.5 ap-text-red-200 ap-flex-shrink-0" />
                                    : isDS
                                        ? <HiOutlineClock className="ap-w-3.5 ap-h-3.5 ap-text-yellow-200 ap-flex-shrink-0" />
                                        : <HiOutlineBookOpen className="ap-w-3.5 ap-h-3.5 ap-text-white/60 ap-flex-shrink-0" />
                                }
                                <span className="ap-text-sm ap-truncate">{c.courseTitle}</span>
                                {c.dueDate && (
                                    <span className={`ap-text-xs ap-flex-shrink-0 ${isOD ? 'ap-text-red-200' : 'ap-text-white/60'}`}>
                                        Due {formatLocalDate(c.dueDate)}
                                    </span>
                                )}
                                {c.progress > 0 && (
                                    <span className="ap-text-xs ap-text-white/60 ap-flex-shrink-0">{c.progress}%</span>
                                )}
                            </div>
                            <span className="ap-text-xs ap-text-white/70 ap-flex-shrink-0 ap-flex ap-items-center ap-gap-1">
                                {c.status === 'in-progress' ? 'Continue' : 'Start'}
                                <HiOutlineArrowTopRightOnSquare className="ap-w-3 ap-h-3" />
                            </span>
                        </button>
                    );
                })}
                {courses.length > 4 && (
                    <p className="ap-text-center ap-text-xs ap-text-white/60 ap-py-1">
                        +{courses.length - 4} more — open Learning to see all
                    </p>
                )}
            </div>
        </CollapsibleSection>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-section: TaskDeck Cards
// ─────────────────────────────────────────────────────────────────────────────

const TaskSection: React.FC<{ tasks: AssignedCard[]; onNavigate: (v: View) => void }> = ({ tasks, onNavigate }) => {
    const overdueCount = tasks.filter(t => isOverdueDate(t.due_date)).length;
    const dueSoonCount = tasks.filter(t => isDueSoonDate(t.due_date)).length;

    const subtitle = (
        <>
            {overdueCount > 0 && <span className="ap-text-red-200 ap-font-medium">{overdueCount} overdue{dueSoonCount > 0 ? ' • ' : ''}</span>}
            {dueSoonCount > 0 && <span className="ap-text-yellow-200">{dueSoonCount} due soon</span>}
            {overdueCount === 0 && dueSoonCount === 0 && 'Open TaskDeck to review'}
        </>
    );

    return (
        <CollapsibleSection
            storageKey={LS.tasks}
            gradient="ap-from-cyan-500 ap-to-blue-600"
            icon={<HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5" />}
            title={`${tasks.length} task${tasks.length !== 1 ? 's' : ''} assigned to you`}
            subtitle={subtitle}
            action={
                <button
                    onClick={() => onNavigate('taskdeck')}
                    className="ap-flex ap-items-center ap-gap-1 ap-bg-white/20 hover:ap-bg-white/30 ap-px-3 ap-py-1.5 ap-rounded ap-text-sm ap-font-medium ap-transition-colors"
                >
                    View Tasks
                    <HiOutlineArrowTopRightOnSquare className="ap-w-3.5 ap-h-3.5" />
                </button>
            }
        >
            {tasks.length <= 5 ? (
                <div className="ap-px-4 ap-py-2 ap-flex ap-flex-wrap ap-gap-2">
                    {tasks.slice(0, 3).map(t => (
                        <span
                            key={t.card_id}
                            className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-xs ap-truncate ap-max-w-[180px]"
                            title={`${t.title} — ${t.deck_name}`}
                        >
                            {isOverdueDate(t.due_date) && <span className="ap-text-red-200 ap-mr-1">!</span>}
                            {t.title}
                        </span>
                    ))}
                    {tasks.length > 3 && (
                        <span className="ap-text-white/60 ap-text-xs ap-self-center">+{tasks.length - 3} more</span>
                    )}
                </div>
            ) : (
                <div className="ap-px-4 ap-py-2">
                    <p className="ap-text-sm ap-text-white/80">{tasks.length} tasks assigned — open TaskDeck to see them all.</p>
                </div>
            )}
        </CollapsibleSection>
    );
};

export default UnifiedAlertStrip;
