import React, { useState, useEffect, useCallback } from 'react';
import { 
    HiOutlineCheck as CheckIcon,
    HiOutlineArchiveBox as ArchiveIcon,
    HiOutlineArrowUturnLeft as UnarchiveIcon,
    HiOutlineTrash as DeleteIcon
} from 'react-icons/hi2';
import { 
    createInstructorEvaluation, 
    updateInstructorEvaluation,
    archiveInstructorEvaluation,
    restoreInstructorEvaluation,
    deleteInstructorEvaluation,
    type InstructorEvaluationLog 
} from '@/services/api-professional-growth';
import { getCachedUsersWithDetails } from '@/services/userCache';
import UserSelector, { type UserOption } from './UserSelector';
import RichTextEditor from './RichTextEditor';
import { Button } from './ui';

interface InstructorEvaluationFormProps {
    editingEvaluation?: InstructorEvaluationLog | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface YesNoFieldProps {
    label: string;
    description?: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

const YesNoField: React.FC<YesNoFieldProps> = ({ label, description, value, onChange }) => (
    <div>
        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
            {label}
        </label>
        {description && (
            <p className="ap-text-xs ap-text-gray-500 ap-mb-2">{description}</p>
        )}
        <div className="ap-flex ap-gap-3">
            <button
                type="button"
                onClick={() => onChange(true)}
                className={`ap-flex-1 ap-px-4 ap-py-2.5 ap-border ap-rounded-lg ap-font-medium ap-transition-colors ${
                    value === true
                        ? 'ap-bg-green-600 ap-text-white ap-border-green-600' : 'ap-bg-white ap-text-gray-700 ap-border-gray-300 hover:ap-bg-green-50 hover:ap-border-green-300'
                }`}
            >
                Yes
            </button>
            <button
                type="button"
                onClick={() => onChange(false)}
                className={`ap-flex-1 ap-px-4 ap-py-2.5 ap-border ap-rounded-lg ap-font-medium ap-transition-colors ${
                    value === false
                        ? 'ap-bg-red-600 ap-text-white ap-border-red-600' : 'ap-bg-white ap-text-gray-700 ap-border-gray-300 hover:ap-bg-red-50 hover:ap-border-red-300'
                }`}
            >
                No
            </button>
        </div>
    </div>
);

const InstructorEvaluationForm: React.FC<InstructorEvaluationFormProps> = ({ 
    editingEvaluation, 
    onSuccess, 
    onCancel 
}) => {
    const [formData, setFormData] = useState({
        evaluated_user_id: editingEvaluation?.evaluated_user_id ? Number(editingEvaluation.evaluated_user_id) : 0,
        evaluation_date: editingEvaluation?.evaluation_date ? editingEvaluation.evaluation_date.split(' ')[0] : '',
        command_language: editingEvaluation?.command_language !== undefined 
            ? Boolean(editingEvaluation.command_language) 
            : true,
        minimizing_downtime: editingEvaluation?.minimizing_downtime !== undefined 
            ? Boolean(editingEvaluation.minimizing_downtime) 
            : true,
        periodic_challenges: editingEvaluation?.periodic_challenges !== undefined 
            ? Boolean(editingEvaluation.periodic_challenges) 
            : true,
        provides_feedback: editingEvaluation?.provides_feedback !== undefined 
            ? Boolean(editingEvaluation.provides_feedback) 
            : true,
        rules_expectations: editingEvaluation?.rules_expectations !== undefined 
            ? Boolean(editingEvaluation.rules_expectations) 
            : true,
        learning_environment: editingEvaluation?.learning_environment !== undefined 
            ? Boolean(editingEvaluation.learning_environment) 
            : true,
        comments: editingEvaluation?.comments || '',
    });
    
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateFormField = useCallback(<K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    useEffect(() => {
        getCachedUsersWithDetails()
            .then(usersData => {
                const userOptions: UserOption[] = usersData.map(user => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    job_role: user.jobRole,
                    tier: user.tier,
                }));
                setUsers(userOptions);
            })
            .catch((err) => {
                console.error('Failed to load users:', err);
                setError('Failed to load staff members');
            })
            .finally(() => setLoadingUsers(false));
    }, []);

    const handleUserSelect = useCallback((userId: number) => {
        updateFormField('evaluated_user_id', userId);
    }, [updateFormField]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.evaluated_user_id === 0) {
            setError('Please select a swim instructor');
            return;
        }

        if (!formData.evaluation_date) {
            setError('Please provide an evaluation date');
            return;
        }

        if (!formData.comments || formData.comments.trim() === '' || formData.comments === '<p></p>') {
            setError('Please provide comments - this field is required');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const data = {
                evaluated_user_id: formData.evaluated_user_id,
                evaluation_date: formData.evaluation_date,
                command_language: formData.command_language ? 1 : 0,
                minimizing_downtime: formData.minimizing_downtime ? 1 : 0,
                periodic_challenges: formData.periodic_challenges ? 1 : 0,
                provides_feedback: formData.provides_feedback ? 1 : 0,
                rules_expectations: formData.rules_expectations ? 1 : 0,
                learning_environment: formData.learning_environment ? 1 : 0,
                comments: formData.comments,
            };

            if (editingEvaluation) {
                await updateInstructorEvaluation(editingEvaluation.id, data);
            } else {
                await createInstructorEvaluation(data);
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save instructor evaluation');
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!editingEvaluation) return;
        
        if (!confirm('Are you sure you want to archive this instructor evaluation?')) {
            return;
        }

        try {
            await archiveInstructorEvaluation(editingEvaluation.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to archive instructor evaluation');
        }
    };

    const handleRestore = async () => {
        if (!editingEvaluation) return;

        try {
            await restoreInstructorEvaluation(editingEvaluation.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to restore instructor evaluation');
        }
    };

    const handleDelete = async () => {
        if (!editingEvaluation) return;

        if (!confirm('Are you sure you want to delete this instructor evaluation? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteInstructorEvaluation(editingEvaluation.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete instructor evaluation');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="ap-space-y-6">
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            {/* Swim Instructor Selection */}
            <div>
                <UserSelector
                    users={users}
                    selectedUserId={formData.evaluated_user_id}
                    onChange={handleUserSelect}
                    label="Swim Instructor Being Evaluated *"
                    placeholder="Search for swim instructor..."
                    isLoading={loadingUsers}
                />
            </div>

            {/* Evaluation Date */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Evaluation Date *
                </label>
                <input
                    type="date"
                    value={formData.evaluation_date}
                    onChange={(e) => updateFormField('evaluation_date', e.target.value)}
                    className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                    required
                />
            </div>

            {/* Evaluation Criteria Section */}
            <div className="ap-space-y-4 ap-pt-2">
                <h3 className="ap-text-sm ap-font-semibold ap-text-gray-800 ap-border-b ap-pb-2">
                    Evaluation Criteria
                </h3>

                <YesNoField
                    label="Command Language"
                    description="Uses clear, authoritative voice commands during lessons"
                    value={formData.command_language}
                    onChange={(value) => updateFormField('command_language', value)}
                />

                <YesNoField
                    label="Minimizing Downtime"
                    description="Keeps students engaged with minimal waiting time between activities"
                    value={formData.minimizing_downtime}
                    onChange={(value) => updateFormField('minimizing_downtime', value)}
                />

                <YesNoField
                    label="Periodic Challenges"
                    description="Provides appropriate challenges to advance student skills"
                    value={formData.periodic_challenges}
                    onChange={(value) => updateFormField('periodic_challenges', value)}
                />

                <YesNoField
                    label="Provides Feedback"
                    description="Gives constructive feedback to students and parents"
                    value={formData.provides_feedback}
                    onChange={(value) => updateFormField('provides_feedback', value)}
                />

                <YesNoField
                    label="Rules & Expectations"
                    description="Clearly communicates and enforces pool rules and lesson expectations"
                    value={formData.rules_expectations}
                    onChange={(value) => updateFormField('rules_expectations', value)}
                />

                <YesNoField
                    label="Learning Environment"
                    description="Creates a positive, encouraging learning environment"
                    value={formData.learning_environment}
                    onChange={(value) => updateFormField('learning_environment', value)}
                />
            </div>

            {/* Comments (Required) */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Comments *
                </label>
                <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                    Provide detailed feedback and observations from this evaluation
                </p>
                <RichTextEditor
                    value={formData.comments}
                    onChange={(value) => updateFormField('comments', value)}
                    placeholder="Add detailed comments about the instructor's performance, areas of strength, and areas for improvement..."
                />
            </div>

            {/* Form Actions */}
            <div className="ap-flex ap-flex-wrap ap-items-center ap-justify-between ap-gap-2 ap-pt-4 ap-border-t">
                {/* Archive/Delete buttons on the left (only for existing evaluations) */}
                <div className="ap-flex ap-flex-wrap ap-gap-2">
                    {editingEvaluation && (
                        <>
                            {editingEvaluation.archived ? (
                                <Button
                                    type="button"
                                    onClick={handleRestore}
                                    variant="success-outline"
                                    size="sm"
                                    leftIcon={<UnarchiveIcon className="ap-w-4 ap-h-4" />}
                                >
                                    Restore
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleArchive}
                                    variant="warning-outline"
                                    size="sm"
                                    leftIcon={<ArchiveIcon className="ap-w-4 ap-h-4" />}
                                >
                                    Archive
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={handleDelete}
                                variant="danger-outline"
                                size="sm"
                                leftIcon={<DeleteIcon className="ap-w-4 ap-h-4" />}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                </div>

                {/* Cancel/Save buttons on the right */}
                <div className="ap-flex ap-flex-wrap ap-gap-2">
                    {onCancel && (
                        <Button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            variant="outline"
                            size="sm"
                        >
                            Cancel
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={submitting}
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        leftIcon={!submitting ? <CheckIcon className="ap-h-5 ap-w-5" /> : undefined}
                    >
                        {editingEvaluation ? 'Update' : 'Save'} Evaluation
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default InstructorEvaluationForm;
