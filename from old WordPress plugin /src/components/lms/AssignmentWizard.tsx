/**
 * AssignmentWizard
 *
 * Multi-step modal for creating a learning assignment:
 * Step 1 — Pick a lesson, set title / description / due date
 * Step 2 — Select recipients (job roles + individual users)
 * Step 3 — Review & send
 */

import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../../utils/dateUtils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import {
    HiOutlineMagnifyingGlass,
    HiOutlineArrowRight,
    HiOutlineArrowLeft,
    HiOutlinePaperAirplane,
    HiOutlineUserGroup,
    HiOutlineUser,
    HiOutlineCalendarDays,
} from 'react-icons/hi2';
import { lmsApi, Course, Lesson } from '../../services/api-lms';
import { getJobRoles, JobRole } from '../../services/api-professional-growth';
import { getCachedSimpleUsers } from '../../services/userCache';
import {
    createAssignment,
    sendAssignment,
    CreateAssignmentPayload,
    SendAssignmentPayload,
} from '../../services/api-assigned-learning';

interface Props {
    onClose: () => void;
}

type Step = 1 | 2 | 3;

const AssignmentWizard: React.FC<Props> = ({ onClose }) => {
    // Step navigation
    const [step, setStep] = useState<Step>(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Lesson & details
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [lessonSearch, setLessonSearch] = useState('');

    // Step 2: Recipients
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');



    // Load data
    useEffect(() => {
        lmsApi.getCourses().then(setCourses).catch(console.error);
        getJobRoles().then(setJobRoles).catch(console.error);
        getCachedSimpleUsers().then(setAllUsers).catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedCourse) {
            lmsApi.getCourseLessons(selectedCourse).then(setLessons).catch(console.error);
        }
    }, [selectedCourse]);

    // Auto-set title from lesson
    useEffect(() => {
        if (selectedLesson && !title) {
            setTitle(selectedLesson.title);
        }
    }, [selectedLesson]);

    // Filtered lessons
    const filteredLessons = lessons.filter(l =>
        !lessonSearch || l.title.toLowerCase().includes(lessonSearch.toLowerCase())
    );

    // Filtered users
    const filteredUsers = allUsers.filter(u =>
        !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase())
    );

    const canProceedStep1 = !!selectedLesson && title.trim().length > 0;
    const canProceedStep2 = selectedRoles.length > 0 || selectedUsers.length > 0;

    const handleSend = async () => {
        if (!selectedLesson) return;
        setSaving(true);
        setError('');
        try {
            // 1. Create draft assignment
            const payload: CreateAssignmentPayload = {
                lessonId: selectedLesson.id,
                title: title.trim(),
                description: description.trim() || undefined,
                dueDate: dueDate || undefined,
            };
            const created = await createAssignment(payload);

            // 2. Send (resolve users + queue emails)
            const sendPayload: SendAssignmentPayload = {
                jobRoleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
                userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
            };
            const result = await sendAssignment(created.id, sendPayload);

            alert(
                `Assignment sent! ${result.recipientCount} recipient(s), ${result.emailsQueued} email(s) queued.`
            );
            onClose();
        } catch (e: any) {
            setError(e.message || 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Render helpers ───

    const renderStep1 = () => (
        <div className="ap-space-y-4">
            {/* Course picker */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Select Course</label>
                <select
                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                    value={selectedCourse ?? ''}
                    onChange={(e) => {
                        setSelectedCourse(Number(e.target.value) || null);
                        setSelectedLesson(null);
                    }}
                >
                    <option value="">— Choose a course —</option>
                    {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title} ({c.lessonCount ?? 0} lessons)</option>
                    ))}
                </select>
            </div>

            {/* Lesson picker */}
            {selectedCourse && (
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Select Lesson</label>
                    <div className="ap-relative ap-mb-2">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                        <input
                            type="text"
                            className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm"
                            placeholder="Search lessons..."
                            value={lessonSearch}
                            onChange={(e) => setLessonSearch(e.target.value)}
                        />
                    </div>
                    <div className="ap-max-h-40 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-md ap-divide-y ap-divide-gray-100">
                        {filteredLessons.length === 0 ? (
                            <p className="ap-p-3 ap-text-sm ap-text-gray-400 ap-italic">No lessons found.</p>
                        ) : (
                            filteredLessons.map(l => (
                                <button
                                    key={l.id}
                                    className={`ap-w-full ap-text-left ap-px-3 ap-py-2 ap-text-sm ap-transition-colors ${
                                        selectedLesson?.id === l.id
                                            ? 'ap-bg-blue-50 ap-text-blue-700 ap-font-medium'
                                            : 'hover:ap-bg-gray-50 ap-text-gray-800'
                                    }`}
                                    onClick={() => setSelectedLesson(l)}
                                >
                                    <span>{l.title}</span>
                                    <Badge variant="gray" size="sm" className="ap-ml-2">{l.type || 'content'}</Badge>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Title */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Assignment Title</label>
                <input
                    type="text"
                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Summer Safety Refresher"
                />
            </div>

            {/* Description */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Description (optional)</label>
                <textarea
                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm ap-resize-none"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instructions or context for the assignees..."
                />
            </div>

            {/* Due date */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                    <HiOutlineCalendarDays className="ap-inline ap-w-4 ap-h-4 ap-mr-1 ap-text-gray-500" />
                    Due Date (optional)
                </label>
                <input
                    type="date"
                    className="ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2 ap-text-sm"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="ap-space-y-5">
            {/* Job Roles */}
            <div>
                <label className="ap-flex ap-items-center ap-gap-1 ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    <HiOutlineUserGroup className="ap-w-4 ap-h-4" />
                    Assign by Job Role
                </label>
                <div className="ap-grid ap-grid-cols-2 ap-gap-2">
                    {jobRoles.map(r => {
                        const checked = selectedRoles.includes(r.id);
                        return (
                            <label
                                key={r.id}
                                className={`ap-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-rounded-md ap-border ap-cursor-pointer ap-transition-colors ap-text-sm ${
                                    checked ? 'ap-bg-blue-50 ap-border-blue-300' : 'ap-bg-white ap-border-gray-200 hover:ap-bg-gray-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                        setSelectedRoles(prev =>
                                            checked ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                        );
                                    }}
                                    className="ap-rounded"
                                />
                                <span className="ap-font-medium ap-text-gray-800">{r.title}</span>
                                <Badge variant="gray" size="sm">Tier {r.tier}</Badge>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="ap-border-t ap-border-gray-200 ap-pt-4">
                <label className="ap-flex ap-items-center ap-gap-1 ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    <HiOutlineUser className="ap-w-4 ap-h-4" />
                    Or Add Individual Users
                </label>
                <div className="ap-relative ap-mb-2">
                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2.5 ap-top-2.5 ap-w-4 ap-h-4 ap-text-gray-400" />
                    <input
                        type="text"
                        className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-pl-8 ap-pr-3 ap-py-2 ap-text-sm"
                        placeholder="Search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                    />
                </div>
                <div className="ap-max-h-48 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-md ap-divide-y ap-divide-gray-100">
                    {filteredUsers.slice(0, 100).map(u => {
                        const checked = selectedUsers.includes(u.id);
                        return (
                            <label
                                key={u.id}
                                className={`ap-flex ap-items-center ap-gap-2 ap-px-3 ap-py-2 ap-cursor-pointer ap-text-sm ap-transition-colors ${
                                    checked ? 'ap-bg-blue-50' : 'hover:ap-bg-gray-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                        setSelectedUsers(prev =>
                                            checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                        );
                                    }}
                                    className="ap-rounded"
                                />
                                <span className="ap-text-gray-800">{u.name}</span>
                            </label>
                        );
                    })}
                </div>
                {selectedUsers.length > 0 && (
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">{selectedUsers.length} user(s) selected</p>
                )}
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="ap-space-y-4">
            <h3 className="ap-text-sm ap-font-semibold ap-text-gray-900">Review Your Assignment</h3>

            <div className="ap-bg-gray-50 ap-rounded-md ap-p-4 ap-space-y-2 ap-text-sm">
                <div className="ap-flex ap-justify-between">
                    <span className="ap-text-gray-500">Title</span>
                    <span className="ap-font-medium ap-text-gray-900">{title}</span>
                </div>
                <div className="ap-flex ap-justify-between">
                    <span className="ap-text-gray-500">Lesson</span>
                    <span className="ap-text-gray-800">{selectedLesson?.title}</span>
                </div>
                {description && (
                    <div className="ap-flex ap-justify-between">
                        <span className="ap-text-gray-500">Description</span>
                        <span className="ap-text-gray-800 ap-text-right ap-max-w-[60%]">{description}</span>
                    </div>
                )}
                <div className="ap-flex ap-justify-between">
                    <span className="ap-text-gray-500">Due Date</span>
                    <span className="ap-text-gray-800">{dueDate ? formatLocalDate(dueDate) : 'None'}</span>
                </div>
                <div className="ap-flex ap-justify-between">
                    <span className="ap-text-gray-500">Roles</span>
                    <span className="ap-text-gray-800">
                        {selectedRoles.length > 0
                            ? jobRoles.filter(r => selectedRoles.includes(r.id)).map(r => r.title).join(', ')
                            : 'None'}
                    </span>
                </div>
                <div className="ap-flex ap-justify-between">
                    <span className="ap-text-gray-500">Individual Users</span>
                    <span className="ap-text-gray-800">{selectedUsers.length} selected</span>
                </div>
            </div>

            {error && (
                <p className="ap-text-sm ap-text-red-600 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded ap-p-2">{error}</p>
            )}
        </div>
    );

    const stepTitles: Record<Step, string> = {
        1: 'Choose Lesson & Details',
        2: 'Select Recipients',
        3: 'Review & Send',
    };

    return (
        <Modal isOpen onClose={onClose} size="lg">
            <Modal.Header>
                <Modal.Title>
                    New Assignment — Step {step}: {stepTitles[step]}
                </Modal.Title>
            </Modal.Header>

            {/* Step indicator */}
            <div className="ap-px-6 ap-pt-2">
                <div className="ap-flex ap-items-center ap-gap-1">
                    {([1, 2, 3] as Step[]).map(s => (
                        <div
                            key={s}
                            className={`ap-h-1 ap-flex-1 ap-rounded-full ap-transition-colors ${
                                s <= step ? 'ap-bg-blue-500' : 'ap-bg-gray-200'
                            }`}
                        />
                    ))}
                </div>
            </div>

            <Modal.Body>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </Modal.Body>

            <Modal.Footer>
                <div className="ap-flex ap-items-center ap-justify-between ap-w-full">
                    <div>
                        {step > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => setStep((step - 1) as Step)}>
                                <HiOutlineArrowLeft className="ap-w-4 ap-h-4 ap-mr-1" />
                                Back
                            </Button>
                        )}
                    </div>
                    <div className="ap-flex ap-gap-2">
                        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                        {step < 3 ? (
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                                onClick={() => setStep((step + 1) as Step)}
                            >
                                Next
                                <HiOutlineArrowRight className="ap-w-4 ap-h-4 ap-ml-1" />
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSend}
                                loading={saving}
                                disabled={saving}
                            >
                                <HiOutlinePaperAirplane className="ap-w-4 ap-h-4 ap-mr-1" />
                                Send Assignment
                            </Button>
                        )}
                    </div>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default AssignmentWizard;
