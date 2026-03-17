import React, { useState, useEffect } from 'react';
import { PayConfig, PayConfigType } from '@/types';
import { getPayConfig, createPayConfig, updatePayConfig, deletePayConfig } from '@/services/seasonalReturnsService';
import { Button } from '../ui';
import { getJobRoles, JobRole } from '@/services/api-professional-growth';
import { 
    HiOutlineCurrencyDollar, 
    HiOutlinePlus, 
    HiOutlineXMark,
    HiOutlinePencil,
    HiOutlineTrash
} from 'react-icons/hi2';

/**
 * PayConfigList - Manage pay rate configurations
 * 
 * Step 1.1: Read-only display ✅
 * Step 1.2: Create new configurations ✅
 * Step 1.3: Edit/Delete (next)
 */

interface CreateFormData {
    config_type: PayConfigType;
    name: string;
    amount: string;
    job_role_id: string;
    longevity_years: string;
    start_date: string;
    end_date: string;
    expiration_date: string; // Optional - when this config expires
    is_recurring: boolean;
    effective_date: string;
}

const initialFormData: CreateFormData = {
    config_type: 'base_rate',
    name: '',
    amount: '',
    job_role_id: '',
    longevity_years: '',
    start_date: '',
    end_date: '',
    expiration_date: '',
    is_recurring: false,
    effective_date: new Date().toISOString().split('T')[0]
};

const PayConfigList: React.FC = () => {
    const [configs, setConfigs] = useState<PayConfig[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingConfig, setEditingConfig] = useState<PayConfig | null>(null);
    const [formData, setFormData] = useState<CreateFormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<PayConfig | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [configData, rolesData] = await Promise.all([
                getPayConfig(),
                getJobRoles()
            ]);
            setConfigs(configData || []);
            setJobRoles(rolesData || []);
        } catch (err: any) {
            console.error('Failed to load data:', err);
            setError(err.message || 'Failed to load pay configurations');
        } finally {
            setLoading(false);
        }
    };

    // Group configs by type
    const groupedConfigs = configs.reduce((acc, config) => {
        if (!acc[config.config_type]) {
            acc[config.config_type] = [];
        }
        acc[config.config_type].push(config);
        return acc;
    }, {} as Record<string, PayConfig[]>);

    const configTypes: { value: PayConfigType; label: string; description: string }[] = [
        { value: 'base_rate', label: 'Base Hourly Rate', description: 'Standard hourly wage for all employees' },
        { value: 'role_bonus', label: 'Job Role Bonus', description: 'Additional pay for specific job roles' },
        // Longevity is now managed in Longevity Rates (year-based system)
        { value: 'time_bonus', label: 'Time-Based Bonus', description: 'Seasonal or date-range bonuses' },
        { value: 'pay_cap', label: 'Pay Rate Cap', description: 'Maximum hourly rate - employees cannot exceed this amount' }
    ];

    const getConfigTypeLabel = (type: string): string => {
        const found = configTypes.find(t => t.value === type);
        return found ? found.label + 's' : type;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
        setFormError(null);
    };

    const validateForm = (): boolean => {
        if (!formData.name.trim()) {
            setFormError('Name is required');
            return false;
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            setFormError('Amount must be greater than 0');
            return false;
        }
        if (formData.config_type === 'role_bonus' && !formData.job_role_id) {
            setFormError('Please select a job role');
            return false;
        }
        if (formData.config_type === 'longevity_tier' && (!formData.longevity_years || parseInt(formData.longevity_years) < 1)) {
            setFormError('Years required must be at least 1');
            return false;
        }
        if (formData.config_type === 'time_bonus' && (!formData.start_date || !formData.end_date)) {
            setFormError('Start and end dates are required for time-based bonuses');
            return false;
        }
        if (!formData.effective_date) {
            setFormError('Effective date is required');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        try {
            setSaving(true);
            setFormError(null);

            const payload: Partial<PayConfig> = {
                config_type: formData.config_type,
                name: formData.name.trim(),
                amount: parseFloat(formData.amount),
                effective_date: formData.effective_date,
                is_active: true
            };

            // Add type-specific fields
            if (formData.config_type === 'role_bonus' && formData.job_role_id) {
                payload.job_role_id = parseInt(formData.job_role_id);
            }
            if (formData.config_type === 'longevity_tier' && formData.longevity_years) {
                payload.longevity_years = parseInt(formData.longevity_years);
            }
            if (formData.config_type === 'time_bonus') {
                payload.start_date = formData.start_date;
                payload.end_date = formData.end_date;
                payload.is_recurring = formData.is_recurring;
            }
            
            // Add expiration date if provided
            if (formData.expiration_date) {
                payload.expiration_date = formData.expiration_date;
            }

            if (editingConfig) {
                await updatePayConfig(editingConfig.id, payload);
            } else {
                await createPayConfig(payload);
            }
            
            // Reset form and reload
            setFormData(initialFormData);
            setShowAddForm(false);
            setEditingConfig(null);
            await loadData();
        } catch (err: any) {
            console.error('Failed to save config:', err);
            setFormError(err.message || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const openAddForm = () => {
        setFormData(initialFormData);
        setFormError(null);
        setEditingConfig(null);
        setShowAddForm(true);
    };

    const openEditForm = (config: PayConfig) => {
        setFormData({
            config_type: config.config_type,
            name: config.name,
            amount: config.amount.toString(),
            job_role_id: config.job_role_id?.toString() || '',
            longevity_years: config.longevity_years?.toString() || '',
            start_date: config.start_date || '',
            end_date: config.end_date || '',
            expiration_date: config.expiration_date || '',
            is_recurring: config.is_recurring,
            effective_date: config.effective_date
        });
        setFormError(null);
        setEditingConfig(config);
        setShowAddForm(false); // Close add form if open
    };

    const closeForm = () => {
        setShowAddForm(false);
        setEditingConfig(null);
        setFormData(initialFormData);
        setFormError(null);
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        
        try {
            setDeleting(true);
            await deletePayConfig(deleteConfirm.id);
            setDeleteConfirm(null);
            await loadData();
        } catch (err: any) {
            console.error('Failed to delete config:', err);
            alert(err.message || 'Failed to delete configuration');
        } finally {
            setDeleting(false);
        }
    };

    // Render the form (used for both add and edit)
    const renderForm = () => (
        <form onSubmit={handleSubmit} className="ap-space-y-4">
            {formError && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded ap-p-3">
                    <p className="ap-text-red-800 ap-text-sm">{formError}</p>
                </div>
            )}

            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4">
                {/* Config Type */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Configuration Type *
                    </label>
                    <select
                        name="config_type"
                        value={formData.config_type}
                        onChange={handleInputChange}
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    >
                        {configTypes.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                        {configTypes.find(t => t.value === formData.config_type)?.description}
                    </p>
                </div>

                {/* Name */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Name *
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder={
                            formData.config_type === 'base_rate' ? 'e.g., Standard Base Rate' :
                            formData.config_type === 'role_bonus' ? 'e.g., Head Guard Bonus' :
                            formData.config_type === 'longevity_tier' ? 'e.g., 2-Year Veteran Bonus' : 'e.g., End of Season Bonus'
                        }
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                </div>

                {/* Amount */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Amount ($) *
                    </label>
                    <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                        {formData.config_type === 'base_rate' ? 'Hourly rate in dollars' : 'Bonus amount in dollars per hour'}
                    </p>
                </div>

                {/* Job Role (for role_bonus) */}
                {formData.config_type === 'role_bonus' && (
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Job Role *
                        </label>
                        <select
                            name="job_role_id"
                            value={formData.job_role_id}
                            onChange={handleInputChange}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        >
                            <option value="">Select a job role...</option>
                            {jobRoles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.title}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Longevity Years (for longevity_tier) */}
                {formData.config_type === 'longevity_tier' && (
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Years of Service Required *
                        </label>
                        <input
                            type="number"
                            name="longevity_years"
                            value={formData.longevity_years}
                            onChange={handleInputChange}
                            min="1"
                            placeholder="e.g., 2"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                            Minimum years an employee must have worked to receive this bonus
                        </p>
                    </div>
                )}

                {/* Date Range (for time_bonus) */}
                {formData.config_type === 'time_bonus' && (
                    <>
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Start Date *
                            </label>
                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleInputChange}
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                End Date *
                            </label>
                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleInputChange}
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-self-end ap-pb-2">
                            <input
                                type="checkbox"
                                name="is_recurring"
                                id="is_recurring"
                                checked={formData.is_recurring}
                                onChange={handleInputChange}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <label htmlFor="is_recurring" className="ap-text-sm ap-text-gray-700">
                                Recurring annually
                            </label>
                        </div>
                    </>
                )}

                {/* Effective Date */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Effective Date *
                    </label>
                    <input
                        type="date"
                        name="effective_date"
                        value={formData.effective_date}
                        onChange={handleInputChange}
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                </div>

                {/* Expiration Date (Optional) */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Expiration Date (Optional)
                    </label>
                    <input
                        type="date"
                        name="expiration_date"
                        value={formData.expiration_date}
                        onChange={handleInputChange}
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                </div>
            </div>

            {/* Buttons */}
            <div className="ap-flex ap-justify-end ap-gap-3 ap-pt-4 ap-border-t">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={closeForm}
                    disabled={saving}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={saving}
                >
                    {saving ? (editingConfig ? 'Updating...' : 'Creating...') : (editingConfig ? 'Update Configuration' : 'Create Configuration')}
                </Button>
            </div>
        </form>
    );

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-6">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-red-900 ap-mb-2">Error Loading Pay Configuration</h3>
                    <p className="ap-text-red-800">{error}</p>
                    <Button
                        onClick={loadData}
                        variant="primary"
                        className="!ap-mt-4 !ap-bg-red-600 hover:!ap-bg-red-700"
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-p-8">
            {/* Header */}
            <div className="ap-mb-6 ap-flex ap-items-center ap-justify-between">
                <div>
                    <div className="ap-flex ap-items-center ap-gap-3 ap-mb-2">
                        <HiOutlineCurrencyDollar className="ap-w-8 ap-h-8 ap-text-blue-600" />
                        <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Pay Rate Configuration</h1>
                    </div>
                    <p className="ap-text-gray-600">
                        Manage base rates, role bonuses, longevity tiers, and time-based bonuses
                    </p>
                </div>
                {!showAddForm && !editingConfig && (
                    <Button
                        onClick={openAddForm}
                        variant="primary"
                    >
                        <HiOutlinePlus className="ap-w-5 ap-h-5" />
                        Add Configuration
                    </Button>
                )}
            </div>

            {/* Inline Add Form (shows at top when adding) */}
            {showAddForm && !editingConfig && (
                <div className="ap-bg-white ap-rounded-lg ap-shadow-md ap-border ap-border-blue-200 ap-p-6 ap-mb-6">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                        <h2 className="ap-text-xl ap-font-semibold ap-text-gray-900">Add Pay Configuration</h2>
                        <Button
                            onClick={closeForm}
                            variant="ghost"
                            size="xs"
                            className="!ap-p-1.5 !ap-min-h-0"
                        >
                            <HiOutlineXMark className="ap-w-6 ap-h-6" />
                        </Button>
                    </div>
                    {renderForm()}
                </div>
            )}

            {/* Empty State */}
            {configs.length === 0 && !showAddForm ? (
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineCurrencyDollar className="ap-w-12 ap-h-12 ap-text-yellow-500 ap-mx-auto ap-mb-3" />
                    <h3 className="ap-text-lg ap-font-semibold ap-text-yellow-900 ap-mb-2">No Pay Configurations</h3>
                    <p className="ap-text-yellow-800 ap-mb-4">
                        Get started by creating your first pay rate configuration.
                    </p>
                    <Button
                        onClick={openAddForm}
                        variant="primary"
                        className="!ap-bg-yellow-600 hover:!ap-bg-yellow-700"
                    >
                        Create First Configuration
                    </Button>
                </div>
            ) : configs.length > 0 && (
                /* Grouped Tables */
                <div className="ap-space-y-8">
                    {Object.entries(groupedConfigs).map(([type, typeConfigs]) => (
                        <div key={type} className="ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6">
                            <h2 className="ap-text-xl ap-font-semibold ap-text-gray-900 ap-mb-4">
                                {getConfigTypeLabel(type)}
                            </h2>
                            
                            <div className="ap-overflow-x-auto">
                                <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                    <thead className="ap-bg-gray-50">
                                        <tr>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Name
                                            </th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Amount
                                            </th>
                                            {type === 'role_bonus' && (
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                    Job Role
                                                </th>
                                            )}
                                            {type === 'longevity_tier' && (
                                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                    Years Required
                                                </th>
                                            )}
                                            {type === 'time_bonus' && (
                                                <>
                                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                        Date Range
                                                    </th>
                                                    <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                        Recurring
                                                    </th>
                                                </>
                                            )}
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Effective
                                            </th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Status
                                            </th>
                                            <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Expires
                                            </th>
                                            <th className="ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                        {typeConfigs.map((config) => (
                                            <React.Fragment key={config.id}>
                                                <tr className={`hover:ap-bg-gray-50 ${editingConfig?.id === config.id ? 'ap-bg-blue-50' : ''}`}>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-font-medium ap-text-gray-900">
                                                        {config.name}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-900 ap-font-mono">
                                                        ${config.amount.toFixed(2)}
                                                        {type === 'base_rate' && <span className="ap-text-gray-500">/hr</span>}
                                                    </td>
                                                    {type === 'role_bonus' && (
                                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                                            {config.job_role_name || 'N/A'}
                                                        </td>
                                                    )}
                                                    {type === 'longevity_tier' && (
                                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                                            {config.longevity_years}+ years
                                                        </td>
                                                    )}
                                                    {type === 'time_bonus' && (
                                                        <>
                                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-600">
                                                                {config.start_date} → {config.end_date}
                                                            </td>
                                                            <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm">
                                                                {config.is_recurring ? (
                                                                    <span className="ap-text-green-600">Yes</span>
                                                                ) : (
                                                                    <span className="ap-text-gray-400">No</span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                        {config.effective_date}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                        {config.is_active ? (
                                                            <span className="ap-px-2 ap-py-1 ap-text-xs ap-font-semibold ap-rounded ap-bg-green-100 ap-text-green-800">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="ap-px-2 ap-py-1 ap-text-xs ap-font-semibold ap-rounded ap-bg-gray-100 ap-text-gray-800">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                        {config.expiration_date || (
                                                            <span className="ap-text-gray-400 ap-italic">Never</span>
                                                        )}
                                                    </td>
                                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium">
                                                        <Button
                                                            onClick={() => openEditForm(config)}
                                                            variant="ghost"
                                                            size="xs"
                                                            className={`!ap-p-1.5 !ap-min-h-0 !ap-mr-3 ${editingConfig?.id === config.id ? '!ap-text-blue-700' : '!ap-text-blue-600 hover:!ap-text-blue-900'}`}
                                                            title="Edit"
                                                        >
                                                            <HiOutlinePencil className="ap-w-5 ap-h-5" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => setDeleteConfirm(config)}
                                                            variant="ghost"
                                                            size="xs"
                                                            className="!ap-p-1.5 !ap-min-h-0 !ap-text-red-600 hover:!ap-text-red-900"
                                                            title="Delete"
                                                        >
                                                            <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                                {/* Inline edit form below the row */}
                                                {editingConfig?.id === config.id && (
                                                    <tr>
                                                        <td colSpan={type === 'time_bonus' ? 10 : type === 'role_bonus' || type === 'longevity_tier' ? 9 : 8} className="ap-p-0">
                                                            <div className="ap-bg-blue-50 ap-border-t ap-border-blue-200 ap-p-6">
                                                                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                                                                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                                                                        Edit: {config.name}
                                                                    </h3>
                                                                    <Button
                                                                        onClick={closeForm}
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        className="!ap-p-1.5 !ap-min-h-0"
                                                                    >
                                                                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                                                                    </Button>
                                                                </div>
                                                                {renderForm()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal - positioned at top of viewport */}
            {deleteConfirm && (
                <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-flex ap-items-start ap-justify-center ap-z-50 ap-pt-16 ap-overflow-y-auto">
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-max-w-md ap-w-full ap-mx-4 ap-my-8">
                        <div className="ap-p-6">
                            <div className="ap-flex ap-items-center ap-gap-4 ap-mb-4">
                                <div className="ap-flex-shrink-0 ap-w-12 ap-h-12 ap-rounded-full ap-bg-red-100 ap-flex ap-items-center ap-justify-center">
                                    <HiOutlineTrash className="ap-w-6 ap-h-6 ap-text-red-600" />
                                </div>
                                <div>
                                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Delete Pay Configuration</h3>
                                    <p className="ap-text-sm ap-text-gray-600 ap-mt-1">
                                        Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
                                    </p>
                                </div>
                            </div>
                            <p className="ap-text-sm ap-text-gray-500 ap-mb-6">
                                This action cannot be undone. This may affect employee pay calculations.
                            </p>
                            <div className="ap-flex ap-justify-end ap-gap-3">
                                <Button
                                    onClick={() => setDeleteConfirm(null)}
                                    variant="secondary"
                                    disabled={deleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleDelete}
                                    variant="primary"
                                    disabled={deleting}
                                    className="!ap-bg-red-600 hover:!ap-bg-red-700"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Configuration'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayConfigList;
