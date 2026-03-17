import React, { useState, useEffect, useCallback } from 'react';
import { 
    HiOutlineCheck as CheckIcon, 
    HiOutlineXMark as CloseIcon,
    HiOutlineArchiveBox as ArchiveIcon,
    HiOutlineArrowUturnLeft as UnarchiveIcon,
    HiOutlineTrash as DeleteIcon
} from 'react-icons/hi2';
import { 
    createCashierAudit, 
    updateCashierAudit,
    archiveCashierAudit,
    restoreCashierAudit,
    deleteCashierAudit,
    type CashierAuditLog 
} from '@/services/api-professional-growth';
import { getCachedUsersWithDetails } from '@/services/userCache';
import UserSelector, { type UserOption } from './UserSelector';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';

interface CashierAuditFormProps {
    editingAudit?: CashierAuditLog | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

type YesNoNa = 'yes' | 'no' | 'na' | '';

const CashierAuditForm: React.FC<CashierAuditFormProps> = ({ editingAudit, onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        audited_user_id: editingAudit?.audited_user_id ? Number(editingAudit.audited_user_id) : 0,
        audit_date: editingAudit?.audit_date ? editingAudit.audit_date.split(' ')[0] : '',
        audit_time: editingAudit?.audit_date ? editingAudit.audit_date.split(' ')[1]?.substring(0, 5) : '',
        checked_cash_drawer: (editingAudit?.checked_cash_drawer as YesNoNa) || '',
        attentive_patrons_entered: (editingAudit?.attentive_patrons_entered as YesNoNa) || '',
        greeted_with_demeanor: (editingAudit?.greeted_with_demeanor as YesNoNa) || '',
        one_click_per_person: (editingAudit?.one_click_per_person as YesNoNa) || '',
        pool_pass_process: (editingAudit?.pool_pass_process as YesNoNa) || '',
        resolved_patron_concerns: editingAudit?.resolved_patron_concerns || '',
        notes: editingAudit?.notes || '',
    });
    
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoized form field updater
    const updateFormField = useCallback(<K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    useEffect(() => {
        // Use centralized cache - already sorted
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
        updateFormField('audited_user_id', userId);
    }, [updateFormField]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.audited_user_id === 0) {
            setError('Please select a staff member');
            return;
        }

        if (!formData.audit_date || !formData.audit_time) {
            setError('Please provide date and time');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const auditDateTime = `${formData.audit_date} ${formData.audit_time}:00`;
            
            const data = {
                audited_user_id: formData.audited_user_id,
                audit_date: auditDateTime,
                checked_cash_drawer: formData.checked_cash_drawer,
                attentive_patrons_entered: formData.attentive_patrons_entered,
                greeted_with_demeanor: formData.greeted_with_demeanor,
                one_click_per_person: formData.one_click_per_person,
                pool_pass_process: formData.pool_pass_process,
                resolved_patron_concerns: formData.resolved_patron_concerns,
                notes: formData.notes,
            };

            if (editingAudit) {
                await updateCashierAudit(editingAudit.id, data);
            } else {
                await createCashierAudit(data);
            }

            onSuccess?.();
        } catch (err: any) {
            console.error('Failed to save cashier audit:', err);
            setError(err.message || 'Failed to save cashier audit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!editingAudit) return;
        
        try {
            setSubmitting(true);
            await archiveCashierAudit(editingAudit.id);
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Failed to archive');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRestore = async () => {
        if (!editingAudit) return;
        
        try {
            setSubmitting(true);
            await restoreCashierAudit(editingAudit.id);
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Failed to restore');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!editingAudit) return;
        if (!confirm('Are you sure you want to permanently delete this audit? This cannot be undone.')) return;
        
        try {
            setSubmitting(true);
            await deleteCashierAudit(editingAudit.id);
            onSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Failed to delete');
        } finally {
            setSubmitting(false);
        }
    };

    const renderYesNoNaField = (
        label: string, 
        field: keyof typeof formData, 
        helpText?: string
    ) => {
        const currentValue = formData[field] as YesNoNa;
        
        return (
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    {label}
                </label>
                {helpText && (
                    <p className="ap-text-xs ap-text-gray-500 ap-mb-2">{helpText}</p>
                )}
                <div className="ap-flex ap-gap-3">
                    {/* Yes Button */}
                    <button
                        type="button"
                        onClick={() => updateFormField(field, 'yes' as YesNoNa)}
                        className={`ap-flex-1 ap-px-4 ap-py-3 ap-rounded-lg ap-border-2 ap-font-medium ap-transition-all ${currentValue === 'yes' 
                                ? 'ap-bg-green-500 ap-border-green-600 ap-text-white ap-shadow-lg' : 'ap-bg-white ap-border-gray-300 ap-text-gray-700 hover:ap-border-green-400 hover:ap-bg-green-50'
                            }`}
                    >
                        Yes
                    </button>
                    
                    {/* No Button */}
                    <button
                        type="button"
                        onClick={() => updateFormField(field, 'no' as YesNoNa)}
                        className={`ap-flex-1 ap-px-4 ap-py-3 ap-rounded-lg ap-border-2 ap-font-medium ap-transition-all ${currentValue === 'no' 
                                ? 'ap-bg-red-500 ap-border-red-600 ap-text-white ap-shadow-lg' : 'ap-bg-white ap-border-gray-300 ap-text-gray-700 hover:ap-border-red-400 hover:ap-bg-red-50'
                            }`}
                    >
                        No
                    </button>
                    
                    {/* Does Not Apply Button */}
                    <button
                        type="button"
                        onClick={() => updateFormField(field, 'na' as YesNoNa)}
                        className={`ap-flex-1 ap-px-4 ap-py-3 ap-rounded-lg ap-border-2 ap-font-medium ap-transition-all ${currentValue === 'na' 
                                ? 'ap-bg-gray-500 ap-border-gray-600 ap-text-white ap-shadow-lg' : 'ap-bg-white ap-border-gray-300 ap-text-gray-700 hover:ap-border-gray-400 hover:ap-bg-gray-50'
                            }`}
                    >
                        Does Not Apply
                    </button>
                </div>
            </div>
        );
    };

    if (loadingUsers) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-8">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
            <div className="ap-p-6 ap-border-b ap-border-gray-200 ap-flex ap-justify-between ap-items-center">
                <h2 className="ap-text-xl ap-font-semibold ap-text-gray-900">
                    {editingAudit ? 'Edit Cashier Audit' : 'New Cashier Observational Audit'}
                </h2>
                <div className="ap-flex ap-gap-2">
                    {editingAudit && (
                        <>
                            {editingAudit.archived ? (
                                <Button
                                    type="button"
                                    onClick={handleRestore}
                                    disabled={submitting}
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<UnarchiveIcon className="ap-h-4 ap-w-4" />}
                                >
                                    Restore
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleArchive}
                                    disabled={submitting}
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<ArchiveIcon className="ap-h-4 ap-w-4" />}
                                >
                                    Archive
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={handleDelete}
                                disabled={submitting}
                                variant="danger-outline"
                                size="sm"
                                leftIcon={<DeleteIcon className="ap-h-4 ap-w-4" />}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                    <Button
                        type="button"
                        onClick={onCancel}
                        variant="outline"
                        size="sm"
                        leftIcon={<CloseIcon className="ap-h-4 ap-w-4" />}
                    >
                        Cancel
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="ap-p-6 ap-space-y-6">
                {error && (
                    <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-md ap-p-4">
                        <p className="ap-text-red-800 ap-text-sm">{error}</p>
                    </div>
                )}

                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-md ap-p-4">
                    <p className="ap-text-blue-800 ap-text-sm">
                        <strong>Instructions:</strong> When filling out the form, format your responses like "Pass/Fail/N/A: comments". 
                        Example: Pass: John always looked up from his book when patrons entered
                    </p>
                </div>

                {/* Staff Selection */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Staff Member Being Audited *
                    </label>
                    <UserSelector
                        users={users}
                        selectedUserId={formData.audited_user_id}
                        onChange={handleUserSelect}
                        placeholder="Select a staff member..."
                    />
                </div>

                {/* Date and Time */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Date *
                        </label>
                        <input
                            type="date"
                            value={formData.audit_date}
                            onChange={(e) => updateFormField('audit_date', e.target.value)}
                            className="ap-w-full ap-rounded-md ap-border-gray-300 ap-shadow-sm focus:ap-border-blue-500 focus:ap-ring-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Time *
                        </label>
                        <input
                            type="time"
                            value={formData.audit_time}
                            onChange={(e) => updateFormField('audit_time', e.target.value)}
                            className="ap-w-full ap-rounded-md ap-border-gray-300 ap-shadow-sm focus:ap-border-blue-500 focus:ap-ring-blue-500"
                            required
                        />
                    </div>
                </div>

                {/* Audit Questions */}
                <div className="ap-space-y-6 ap-border-t ap-pt-6">
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900">Observation Questions</h3>
                    
                    {renderYesNoNaField(
                        '1. Did the employee check the cash drawer before the shift began?',
                        'checked_cash_drawer' as keyof typeof formData
                    )}

                    {renderYesNoNaField(
                        '2. Was the employee attentive when patrons entered?',
                        'attentive_patrons_entered' as keyof typeof formData
                    )}

                    {renderYesNoNaField(
                        '3. Did the employee greet the patrons with a welcoming demeanor?',
                        'greeted_with_demeanor' as keyof typeof formData
                    )}

                    {renderYesNoNaField(
                        '4. Did the employee use the "one click per person" method?',
                        'one_click_per_person' as keyof typeof formData
                    )}

                    {renderYesNoNaField(
                        '5. Did the employee handle the pool pass process correctly?',
                        'pool_pass_process' as keyof typeof formData
                    )}

                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            6. Did the employee resolve any patron questions/concerns?
                        </label>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                            Describe how the employee handled any patron questions or concerns
                        </p>
                        <textarea
                            value={formData.resolved_patron_concerns}
                            onChange={(e) => updateFormField('resolved_patron_concerns', e.target.value)}
                            rows={3}
                            className="ap-w-full ap-rounded-md ap-border-gray-300 ap-shadow-sm focus:ap-border-blue-500 focus:ap-ring-blue-500"
                            placeholder="Describe the situation and how it was handled..."
                        />
                    </div>
                </div>

                {/* Additional Notes */}
                <div className="ap-border-t ap-pt-6">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Additional Notes
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => updateFormField('notes', e.target.value)}
                        rows={4}
                        className="ap-w-full ap-rounded-md ap-border-gray-300 ap-shadow-sm focus:ap-border-blue-500 focus:ap-ring-blue-500"
                        placeholder="Any additional observations or comments..."
                    />
                </div>

                {/* Submit Button */}
                <div className="ap-flex ap-justify-end ap-gap-3 ap-pt-4 ap-border-t">
                    <Button
                        type="button"
                        onClick={onCancel}
                        variant="outline"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting}
                        variant="primary"
                        loading={submitting}
                        leftIcon={!submitting ? <CheckIcon className="ap-h-4 ap-w-4" /> : undefined}
                    >
                        {editingAudit ? 'Update Audit' : 'Submit Audit'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CashierAuditForm;
