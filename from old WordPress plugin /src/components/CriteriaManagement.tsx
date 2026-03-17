import React, { useState, useEffect, useCallback } from 'react';
import { 
    getJobRoles, 
    getPromotionCriteria, 
    createPromotionCriterion, 
    updatePromotionCriterion, 
    deletePromotionCriterion,
    JobRole,
    PromotionCriterion 
} from '../services/api-professional-growth';
import { HiPlus as PlusIcon, HiPencil as PencilIcon } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';

const CriteriaManagement: React.FC = () => {
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [criteria, setCriteria] = useState<PromotionCriterion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCriterion, setEditingCriterion] = useState<PromotionCriterion | null>(null);
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        criterion_type: 'checkbox' as 'checkbox' | 'notes' | 'file_upload' | 'counter' | 'linked_module',
        description: '',
        target_value: '',
        linked_module: '',
        sort_order: 0,
        is_required: true
    });

    useEffect(() => {
        loadJobRoles();
    }, []);

    useEffect(() => {
        if (selectedRoleId) {
            loadCriteria(selectedRoleId);
        }
    }, [selectedRoleId]);

    const loadJobRoles = async () => {
        try {
            const roles = await getJobRoles();
            setJobRoles(roles);
            if (roles.length > 0 && !selectedRoleId) {
                setSelectedRoleId(roles[0].id);
            }
        } catch (error) {
            console.error('Error loading job roles:', error);
        }
    };

    const loadCriteria = async (roleId: number) => {
        try {
            setIsLoading(true);
            const data = await getPromotionCriteria(roleId);
            setCriteria(data);
        } catch (error) {
            console.error('Error loading criteria:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const openAddForm = () => {
        setEditingCriterion(null);
        setFormData({
            title: '',
            criterion_type: 'checkbox',
            description: '',
            target_value: '',
            linked_module: '',
            sort_order: criteria.length,
            is_required: true
        });
        setShowAddForm(true);
    };

    const openEditForm = (criterion: PromotionCriterion) => {
        setShowAddForm(false);
        setEditingCriterion(criterion);
        setFormData({
            title: criterion.title,
            criterion_type: criterion.criterion_type as 'notes' | 'checkbox' | 'file_upload' | 'counter' | 'linked_module',
            description: criterion.description || '',
            target_value: criterion.target_value?.toString() || '',
            linked_module: criterion.linked_module || '',
            sort_order: criterion.sort_order,
            is_required: criterion.is_required
        });
    };

    const closeForm = () => {
        setShowAddForm(false);
        setEditingCriterion(null);
    };

    // Memoized form field handler to prevent creating new functions on every render
    const handleFieldChange = useCallback((field: keyof typeof formData) => {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            let value: any = e.target.value;
            if (e.target.type === 'checkbox') {
                value = (e.target as HTMLInputElement).checked;
            } else if (e.target.type === 'number' && field === 'sort_order') {
                value = parseInt(e.target.value) || 0;
            }
            setFormData(prev => ({ ...prev, [field]: value }));
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoleId) return;

        try {
            const criterionData = {
                job_role_id: selectedRoleId,
                title: formData.title,
                criterion_type: formData.criterion_type,
                description: formData.description || undefined,
                target_value: formData.target_value ? parseInt(formData.target_value) : 1,
                linked_module: formData.linked_module || undefined,
                sort_order: formData.sort_order,
                is_required: formData.is_required
            };

            if (editingCriterion) {
                await updatePromotionCriterion(editingCriterion.id, criterionData);
            } else {
                await createPromotionCriterion(criterionData);
            }

            closeForm();
            loadCriteria(selectedRoleId);
        } catch (error) {
            console.error('Error saving criterion:', error);
            alert('Failed to save criterion');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this criterion?')) return;

        try {
            await deletePromotionCriterion(id);
            if (selectedRoleId) {
                loadCriteria(selectedRoleId);
            }
        } catch (error) {
            console.error('Error deleting criterion:', error);
            alert('Failed to delete criterion');
        }
    };

    const getCriterionTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'checkbox': 'Checkbox',
            'notes': 'Notes',
            'file_upload': 'File Upload',
            'counter': 'Counter',
            'linked_module': 'Linked Module'
        };
        return labels[type] || type;
    };

    // Inline form for add/edit
    const renderForm = () => (
        <form onSubmit={handleSubmit} className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-6 ap-mb-6">
            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4">
                {editingCriterion ? 'Edit Criterion' : 'Add New Criterion'}
            </h3>

            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                {/* Criterion Title */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Criterion Title *
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={handleFieldChange('title')}
                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        required
                    />
                </div>

                {/* Criterion Type */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Type *
                    </label>
                    <select
                        value={formData.criterion_type}
                        onChange={handleFieldChange('criterion_type')}
                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        required
                    >
                        <option value="checkbox">Checkbox</option>
                        <option value="notes">Notes</option>
                        <option value="file_upload">File Upload</option>
                        <option value="counter">Counter</option>
                        <option value="linked_module">Linked Module</option>
                    </select>
                </div>

                {/* Target Value (for counter type) */}
                {formData.criterion_type === 'counter' && (
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Target Value
                        </label>
                        <input
                            type="number"
                            value={formData.target_value}
                            onChange={handleFieldChange('target_value')}
                            className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            min="1"
                        />
                    </div>
                )}

                {/* Linked Module Type (for linked_module type) */}
                {formData.criterion_type === 'linked_module' && (
                    <>
                        <div className="md:ap-col-span-2">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Module Type *
                            </label>
                            <select
                                value={formData.linked_module}
                                onChange={handleFieldChange('linked_module')}
                                className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                required
                            >
                                <option value="">-- Select Module --</option>
                                <option value="initiative">Initiatives Completed</option>
                                <option value="mentorship_goal">Mentor Initiatives</option>
                                <option value="inservice_attendee">In-Service Training (Attended)</option>
                                <option value="inservice_leader">In-Service Training (Led)</option>
                                <option value="scan_audit">Scan Audit (Participated)</option>
                                <option value="scan_audit_conducted">Scan Audit (Conducted as Auditor)</option>
                                <option value="live_recognition_drill">Live Recognition Drill (Participated)</option>
                                <option value="live_recognition_drill_conducted">Live Recognition Drill (Conducted)</option>
                            </select>
                            
                            {/* Context/Help Text based on selected module */}
                            {formData.linked_module && (
                                <div className="ap-mt-2 ap-p-3 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-md">
                                    <p className="ap-text-sm ap-text-blue-800">
                                        {formData.linked_module === 'initiative' && (
                                            <>
                                                <strong>Initiatives Completed:</strong> Counts the number of initiatives within all goals that have been marked as "Completed". 
                                                This tracks individual initiatives (tasks/objectives within goals), not the goals themselves. 
                                                Set a target below (e.g., complete 4 initiatives for promotion).
                                            </>
                                        )}
                                        {formData.linked_module === 'mentorship_goal' && (
                                            <>
                                                <strong>Mentor Initiatives:</strong> Counts completed initiatives where the user is serving as the MENTOR. 
                                                Use this to require mentors to complete a certain number of initiatives with their mentees.
                                            </>
                                        )}
                                        {formData.linked_module === 'inservice_attendee' && (
                                            <>
                                                <strong>In-Service Training (Attended):</strong> Counts in-service training sessions where the user was marked as "attended". 
                                                This tracks attendance at training sessions regardless of role or topic. 
                                                Use this to require staff to attend a minimum number of training sessions.
                                            </>
                                        )}
                                        {formData.linked_module === 'inservice_leader' && (
                                            <>
                                                <strong>In-Service Training (Led):</strong> Counts in-service training sessions where the user was marked as "leader". 
                                                This tracks sessions where the user facilitated or led the training. 
                                                Use this for leadership development requirements (e.g., must lead 4 trainings).
                                            </>
                                        )}
                                        {formData.linked_module === 'scan_audit' && (
                                            <>
                                                <strong>Scan Audit (Participated):</strong> Counts successful scan audits where the user was audited (result: "pass" or "passed"). 
                                                Automatically increments when the user participates in audits with passing results.
                                            </>
                                        )}
                                        {formData.linked_module === 'scan_audit_conducted' && (
                                            <>
                                                <strong>Scan Audit (Conducted):</strong> Counts audits where the user was the auditor conducting the scan audit. 
                                                Automatically increments when the user conducts audits (regardless of pass/fail result).
                                            </>
                                        )}
                                        {formData.linked_module === 'live_recognition_drill' && (
                                            <>
                                                <strong>Live Recognition Drill (Participated):</strong> Counts successful drills where the user was drilled (result: "Pass" or "Passed with Remediation"). 
                                                Automatically increments when the user participates in drills with passing results (including remediation).
                                            </>
                                        )}
                                        {formData.linked_module === 'live_recognition_drill_conducted' && (
                                            <>
                                                <strong>Live Recognition Drill (Conducted):</strong> Counts drills where the user was the drill conductor. 
                                                Automatically increments when the user conducts drills (regardless of pass/fail result).
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Target Value for linked modules */}
                        {formData.linked_module && (
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Target Count *
                                    <span className="ap-text-gray-500 ap-font-normal ap-ml-1">
                                        (How many {formData.linked_module === 'initiative' ? 'initiatives completed' : 
                                                  formData.linked_module === 'mentorship_goal' ? 'mentor initiatives completed' :
                                                  formData.linked_module === 'inservice_attendee' ? 'trainings attended' :
                                                  formData.linked_module === 'inservice_leader' ? 'trainings led' :
                                                  formData.linked_module === 'scan_audit' ? 'successful audits participated in' :
                                                  formData.linked_module === 'scan_audit_conducted' ? 'audits conducted' :
                                                  formData.linked_module === 'live_recognition_drill' ? 'successful drills participated in' :
                                                  formData.linked_module === 'live_recognition_drill_conducted' ? 'drills conducted' : 'ap-items'} required?)
                                    </span>
                                </label>
                                <input
                                    type="number"
                                    value={formData.target_value}
                                    onChange={handleFieldChange('target_value')}
                                    className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    min="1"
                                    required
                                    placeholder="e.g., 4"
                                />
                            </div>
                        )}
                    </>
                )}

                {/* Display Order */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Display Order
                    </label>
                    <input
                        type="number"
                        value={formData.sort_order}
                        onChange={handleFieldChange('sort_order')}
                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        min="0"
                    />
                </div>

                {/* Description - full width */}
                <div className="md:ap-col-span-2">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={handleFieldChange('description')}
                        rows={2}
                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                </div>

                {/* Is Required */}
                <div className="ap-flex ap-items-center">
                    <input
                        type="checkbox"
                        id="is_required"
                        checked={formData.is_required}
                        onChange={handleFieldChange('is_required')}
                        className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                    />
                    <label htmlFor="is_required" className="ap-ml-2 ap-block ap-text-sm ap-text-gray-700">
                        Required for promotion
                    </label>
                </div>
            </div>

            {/* Form Actions */}
            <div className="ap-flex ap-justify-between ap-items-center ap-mt-6 ap-pt-4 ap-border-t ap-border-gray-200">
                {editingCriterion ? (
                    <Button
                        type="button"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this criterion?')) {
                                handleDelete(editingCriterion.id);
                                closeForm();
                            }
                        }}
                        variant="danger-outline"
                    >
                        Delete
                    </Button>
                ) : (
                    <div></div>
                )}
                <div className="ap-flex ap-gap-2">
                    <Button
                        type="button"
                        onClick={closeForm}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                    >
                        {editingCriterion ? 'Update' : 'Create'}
                    </Button>
                </div>
            </div>
        </form>
    );

    return (
        <div className="ap-max-w-6xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg ap-p-6">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4 ap-mb-6">
                    <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">Promotion Criteria Management</h2>
                    {!showAddForm && !editingCriterion && (
                        <Button
                            onClick={openAddForm}
                            disabled={!selectedRoleId}
                            variant="primary"
                            className="!ap-inline-flex !ap-items-center"
                        >
                            <PlusIcon className="ap-w-5 ap-h-5 ap-mr-2" />
                            Add Criterion
                        </Button>
                    )}
                </div>

                {/* Role Selector */}
                <div className="ap-mb-6">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        Select Job Role
                    </label>
                    <select
                        value={selectedRoleId || ''}
                        onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                        className="ap-block ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    >
                        <option value="">-- Select a Role --</option>
                        {jobRoles.map(role => (
                            <option key={role.id} value={role.id}>
                                {role.title} (Tier {role.tier})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Inline Add Form */}
                {showAddForm && !editingCriterion && renderForm()}

                {/* Criteria List */}
                {selectedRoleId && (
                    <div>
                        {isLoading ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">Loading criteria...</div>
                        ) : criteria.length === 0 ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">
                                No criteria defined for this role. Click "Add Criterion" to create one.
                            </div>
                        ) : (
                            <div className="ap-overflow-x-auto">
                                <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                    <thead className="ap-bg-gray-50">
                                        <tr>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">Order</th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">Criterion Name</th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">Type</th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">Target</th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">Description</th>
                                            <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">Edit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                        {criteria.map((criterion) => (
                                            <React.Fragment key={criterion.id}>
                                                <tr className={editingCriterion?.id === criterion.id ? 'bg-blue-50' : ''}>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900">
                                                        {criterion.sort_order}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                                        {criterion.title}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                        {getCriterionTypeLabel(criterion.criterion_type)}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                        {criterion.criterion_type === 'counter' && criterion.target_value ? 
                                                            criterion.target_value : 
                                                            criterion.criterion_type === 'linked_module' && criterion.linked_module ? 
                                                            `${criterion.linked_module}${criterion.target_value ? ` (${criterion.target_value})` : ''}` : 
                                                            '-'}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-text-sm ap-text-gray-500 ap-max-w-xs ap-truncate">
                                                        {criterion.description || '-'}
                                                    </td>
                                                    <td className="ap-sticky ap-right-0 ap-bg-white ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                                        <Button
                                                            variant="icon"
                                                            onClick={() => openEditForm(criterion)}
                                                            className="ap-text-gray-400 hover:ap-text-blue-600"
                                                            title="Edit criterion"
                                                            disabled={!!editingCriterion}
                                                        >
                                                            <PencilIcon className="ap-w-4 ap-h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                                {/* Inline Edit Form */}
                                                {editingCriterion?.id === criterion.id && (
                                                    <tr>
                                                        <td colSpan={6} className="ap-p-0 ap-bg-gray-50">
                                                            {renderForm()}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CriteriaManagement;
