import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui';
import { 
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getMyPermissions
} from '@/services/seasonalReturnsService';
import { EmailTemplate } from '@/types';
import { 
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineEnvelope,
    HiOutlineDocumentDuplicate,
    HiOutlineXMark,
    HiOutlineCheck,
    HiOutlineExclamationTriangle,
    HiOutlineInformationCircle
} from 'react-icons/hi2';

interface TemplateFormData {
    name: string;
    subject: string;
    body_html: string;
    template_type: 'initial_invite' | 'follow_up' | 'confirmation' | 'reminder';
    is_default: boolean;
}

const TEMPLATE_TYPES = [
    { value: 'initial_invite', label: 'Initial Invite', description: 'First invitation sent to employees' },
    { value: 'follow_up', label: 'Follow-Up', description: 'Reminder emails for non-responders' },
    { value: 'confirmation', label: 'Confirmation', description: 'Sent after employee submits response' },
    { value: 'reminder', label: 'Reminder', description: 'General reminder emails' }
];

const PLACEHOLDERS = [
    { key: '{{first_name}}', description: 'Employee first name' },
    { key: '{{last_name}}', description: 'Employee last name' },
    { key: '{{full_name}}', description: 'Employee full name' },
    { key: '{{job_roles}}', description: 'All job roles (comma-separated)' },
    { key: '{{highest_role}}', description: 'Highest tier job role' },
    { key: '{{current_pay_rate}}', description: 'Current hourly pay rate' },
    { key: '{{projected_pay_rate}}', description: 'Projected pay for next season' },
    { key: '{{base_rate}}', description: 'Base hourly rate' },
    { key: '{{role_bonus}}', description: 'Role bonus amount' },
    { key: '{{longevity_bonus}}', description: 'Longevity bonus amount' },
    { key: '{{longevity_years}}', description: 'Years of service' },
    { key: '{{season_name}}', description: 'Season name (e.g., Summer 2025)' },
    { key: '{{return_form_link}}', description: 'Link to the return intent form' },
    { key: '{{response_deadline}}', description: 'Response deadline date' }
];

const DEFAULT_TEMPLATES: Record<string, TemplateFormData> = {
    initial_invite: {
        name: 'Default Initial Invite',
        subject: 'Return Intent for {{season_name}}',
        body_html: `<p>Hi {{first_name}},</p>
<p>We hope this message finds you well! As we prepare for <strong>{{season_name}}</strong>, we wanted to reach out about your return.</p>
<p><strong>Your Position(s):</strong> {{job_roles}}<br/>
<strong>Your Current Pay Rate:</strong> {{current_pay_rate}}/hr<br/>
<strong>Your Projected Pay Rate:</strong> {{projected_pay_rate}}/hr</p>
<p style="font-size: 0.9em; color: #666;"><em>Note: Pay rates include your role bonus and longevity bonus. Year 1 represents employees in their first season (no longevity bonus). Year 2 earns 1x the longevity rate.</em></p>
<p>Please let us know your intentions for the upcoming season by clicking the link below:</p>
<p><a href="{{return_form_link}}" style="background-color: #00A3E0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Submit My Return Intent</a></p>
<p>Please respond by <strong>{{response_deadline}}</strong>.</p>
<p>Thank you for being part of our team!</p>`,
        template_type: 'initial_invite',
        is_default: true
    },
    follow_up: {
        name: 'Default Follow-Up',
        subject: 'Reminder: Return Intent for {{season_name}}',
        body_html: `<p>Hi {{first_name}},</p>
<p>This is a friendly reminder that we haven't received your return intent for <strong>{{season_name}}</strong>.</p>
<p><strong>Your Position(s):</strong> {{job_roles}}<br/>
<strong>Your Projected Pay Rate:</strong> {{projected_pay_rate}}/hr</p>
<p>Please take a moment to let us know your plans:</p>
<p><a href="{{return_form_link}}" style="background-color: #00A3E0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Submit My Return Intent</a></p>
<p>The deadline is <strong>{{response_deadline}}</strong>.</p>
<p>Thank you!</p>`,
        template_type: 'follow_up',
        is_default: true
    },
    confirmation: {
        name: 'Default Confirmation',
        subject: 'Thank You - Return Intent Received',
        body_html: `<p>Hi {{first_name}},</p>
<p>Thank you for submitting your return intent for <strong>{{season_name}}</strong>!</p>
<p>We have received your response and will be in touch with next steps.</p>
<p>If you have any questions, please don't hesitate to reach out.</p>
<p>Best regards,<br/>The Team</p>`,
        template_type: 'confirmation',
        is_default: true
    }
};

/**
 * EmailTemplateManager - Create and manage email templates for seasonal returns
 */
const EmailTemplateManager: React.FC = () => {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Modal state
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [formData, setFormData] = useState<TemplateFormData>({
        name: '',
        subject: '',
        body_html: '',
        template_type: 'initial_invite',
        is_default: false
    });
    const [saving, setSaving] = useState(false);
    
    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<EmailTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);
    
    // Filter
    const [filterType, setFilterType] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [, templatesData] = await Promise.all([
                getMyPermissions(),
                getTemplates()
            ]);
            
            setTemplates(templatesData || []);
        } catch (err: any) {
            console.error('Failed to load templates:', err);
            setError(err.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const filteredTemplates = useMemo(() => {
        if (!filterType) return templates;
        return templates.filter(t => t.template_type === filterType);
    }, [templates, filterType]);

    const openEditor = (template?: EmailTemplate) => {
        if (template) {
            setEditingTemplate(template);
            setFormData({
                name: template.name,
                subject: template.subject,
                body_html: template.body_html,
                template_type: template.template_type as any,
                is_default: template.is_default
            });
        } else {
            setEditingTemplate(null);
            setFormData({
                name: '',
                subject: '',
                body_html: '',
                template_type: 'initial_invite',
                is_default: false
            });
        }
        setShowEditor(true);
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingTemplate(null);
        setFormData({
            name: '',
            subject: '',
            body_html: '',
            template_type: 'initial_invite',
            is_default: false
        });
    };

    const handleSave = async () => {
        if (!formData.name || !formData.subject || !formData.body_html) {
            setError('Please fill in all required fields');
            return;
        }
        
        try {
            setSaving(true);
            setError(null);
            
            if (editingTemplate) {
                await updateTemplate(editingTemplate.id, formData);
            } else {
                await createTemplate(formData);
            }
            
            await loadData();
            closeEditor();
        } catch (err: any) {
            console.error('Failed to save template:', err);
            setError(err.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        
        try {
            setDeleting(true);
            await deleteTemplate(deleteConfirm.id);
            await loadData();
            setDeleteConfirm(null);
        } catch (err: any) {
            console.error('Failed to delete template:', err);
            setError(err.message || 'Failed to delete template');
        } finally {
            setDeleting(false);
        }
    };

    const duplicateTemplate = (template: EmailTemplate) => {
        setEditingTemplate(null);
        setFormData({
            name: `${template.name} (Copy)`,
            subject: template.subject,
            body_html: template.body_html,
            template_type: template.template_type as any,
            is_default: false
        });
        setShowEditor(true);
    };

    const loadDefaultTemplate = (type: string) => {
        const defaultData = DEFAULT_TEMPLATES[type];
        if (defaultData) {
            setFormData(prev => ({
                ...prev,
                name: defaultData.name,
                subject: defaultData.subject,
                body_html: defaultData.body_html,
                template_type: type as any
            }));
        }
    };

    const insertPlaceholder = (placeholder: string) => {
        // Insert at cursor position in body_html textarea
        const textarea = document.getElementById('body_html') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newValue = formData.body_html.substring(0, start) + placeholder + formData.body_html.substring(end);
            setFormData(prev => ({ ...prev, body_html: newValue }));
            // Restore cursor position after state update
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
            }, 0);
        } else {
            setFormData(prev => ({ ...prev, body_html: prev.body_html + placeholder }));
        }
    };

    const getTypeLabel = (type: string) => {
        const typeInfo = TEMPLATE_TYPES.find(t => t.value === type);
        return typeInfo?.label || type;
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'initial_invite': return 'ap-bg-blue-100 ap-text-blue-800';
            case 'follow_up': return 'ap-bg-orange-100 ap-text-orange-800';
            case 'confirmation': return 'ap-bg-green-100 ap-text-green-800';
            case 'reminder': return 'ap-bg-purple-100 ap-text-purple-800';
            default: return 'ap-bg-gray-100 ap-text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-6xl ap-mx-auto">
            <div className="ap-bg-white ap-shadow-sm ap-rounded-lg">
                {/* Header */}
                <div className="ap-p-6 ap-border-b ap-border-gray-200">
                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                        <div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Email Templates</h2>
                            <p className="ap-text-gray-600 ap-mt-1">
                                Create and manage email templates for return invitations
                            </p>
                        </div>
                        <Button
                            onClick={() => openEditor()}
                            variant="primary"
                        >
                            <HiOutlinePlus className="ap-w-5 ap-h-5" />
                            Create Template
                        </Button>
                    </div>

                    {/* Filter */}
                    <div className="ap-mt-4 ap-flex ap-items-center ap-gap-3">
                        <span className="ap-text-sm ap-text-gray-500">Filter by type:</span>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="ap-px-3 ap-py-1.5 ap-border ap-border-gray-300 ap-rounded-lg ap-text-sm focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        >
                            <option value="">All Types</option>
                            {TEMPLATE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="ap-mx-6 ap-mt-4 ap-p-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-flex ap-items-start ap-gap-3">
                        <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-500 ap-flex-shrink-0 ap-mt-0.5" />
                        <div>
                            <p className="ap-text-red-800">{error}</p>
                            <Button 
                                onClick={() => setError(null)}
                                variant="link"
                                className="!ap-text-red-600 !ap-p-0 !ap-h-auto ap-mt-1"
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                )}

                {/* Templates List */}
                <div className="ap-p-6">
                    {filteredTemplates.length === 0 ? (
                        <div className="ap-text-center ap-py-12">
                            <HiOutlineEnvelope className="ap-w-12 ap-h-12 ap-mx-auto ap-text-gray-300 ap-mb-4" />
                            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-2">No Templates Yet</h3>
                            <p className="ap-text-gray-500 ap-mb-4">
                                Create your first email template to start sending invitations.
                            </p>
                            <Button
                                onClick={() => openEditor()}
                                variant="primary"
                            >
                                <HiOutlinePlus className="ap-w-5 ap-h-5" />
                                Create Template
                            </Button>
                        </div>
                    ) : (
                        <div className="ap-grid ap-gap-4">
                            {filteredTemplates.map(template => (
                                <div 
                                    key={template.id}
                                    className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 hover:ap-border-gray-300 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-start ap-justify-between ap-gap-4">
                                        <div className="ap-flex-1 ap-min-w-0">
                                            <div className="ap-flex ap-items-center ap-gap-3 ap-mb-2">
                                                <h3 className="ap-font-semibold ap-text-gray-900 ap-truncate">
                                                    {template.name}
                                                </h3>
                                                <span className={`ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-rounded-full ${getTypeColor(template.template_type)}`}>
                                                    {getTypeLabel(template.template_type)}
                                                </span>
                                                {template.is_default && (
                                                    <span className="ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-rounded-full ap-bg-yellow-100 ap-text-yellow-800">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="ap-text-sm ap-text-gray-600 ap-mb-2">
                                                <span className="ap-font-medium">Subject:</span> {template.subject}
                                            </p>
                                            <div 
                                                className="ap-text-sm ap-text-gray-500 line-clamp-2"
                                                dangerouslySetInnerHTML={{ __html: template.body_html.replace(/<[^>]*>/g, ' ').substring(0, 150) + '...' }}
                                            />
                                        </div>
                                        <div className="ap-flex ap-items-center ap-gap-2">
                                            <Button
                                                onClick={() => duplicateTemplate(template)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-2 !ap-min-h-0 ap-text-gray-400 hover:ap-text-gray-600"
                                                title="Duplicate"
                                            >
                                                <HiOutlineDocumentDuplicate className="ap-w-5 ap-h-5" />
                                            </Button>
                                            <Button
                                                onClick={() => openEditor(template)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-2 !ap-min-h-0 ap-text-gray-400 hover:ap-text-blue-600 hover:ap-bg-blue-50"
                                                title="Edit"
                                            >
                                                <HiOutlinePencil className="ap-w-5 ap-h-5" />
                                            </Button>
                                            <Button
                                                onClick={() => setDeleteConfirm(template)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-2 !ap-min-h-0 ap-text-gray-400 hover:ap-text-red-600 hover:ap-bg-red-50"
                                                title="Delete"
                                            >
                                                <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Modal */}
            {showEditor && (
                <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-flex ap-items-center ap-justify-end ap-z-50">
                    <div 
                        className="ap-bg-white ap-shadow-xl ap-w-full ap-max-w-2xl ap-h-full ap-overflow-y-auto ap-animate-slide-in-right"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Editor Header */}
                        <div className="ap-flex ap-items-center ap-justify-between ap-p-6 ap-border-b ap-bg-gray-50 ap-sticky ap-top-0 ap-z-10">
                            <h3 className="ap-text-xl ap-font-semibold ap-text-gray-900">
                                {editingTemplate ? 'Edit Template' : 'Create Template'}
                            </h3>
                            <Button
                                onClick={closeEditor}
                                variant="ghost"
                                size="xs"
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-gray-600"
                            >
                                <HiOutlineXMark className="ap-w-6 ap-h-6" />
                            </Button>
                        </div>

                        {/* Editor Form */}
                        <div className="ap-p-6 ap-space-y-6">
                            {/* Template Type */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Template Type *
                                </label>
                                <select
                                    value={formData.template_type}
                                    onChange={(e) => setFormData(prev => ({ ...prev, template_type: e.target.value as any }))}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                >
                                    {TEMPLATE_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                                <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                    {TEMPLATE_TYPES.find(t => t.value === formData.template_type)?.description}
                                </p>
                                {!editingTemplate && (
                                    <Button
                                        type="button"
                                        onClick={() => loadDefaultTemplate(formData.template_type)}
                                        variant="link"
                                        className="!ap-p-0 !ap-h-auto ap-mt-2"
                                    >
                                        Load default template for this type
                                    </Button>
                                )}
                            </div>

                            {/* Name */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Template Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    placeholder="e.g., Summer 2025 Initial Invite"
                                />
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Email Subject *
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    placeholder="e.g., Return Intent for {{season_name}}"
                                />
                            </div>

                            {/* Placeholders Help */}
                            <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                                <div className="ap-flex ap-items-start ap-gap-2 ap-mb-3">
                                    <HiOutlineInformationCircle className="ap-w-5 ap-h-5 ap-text-blue-600 ap-flex-shrink-0 ap-mt-0.5" />
                                    <span className="ap-text-sm ap-font-medium ap-text-blue-800">Available Placeholders</span>
                                </div>
                                <div className="ap-flex ap-flex-wrap ap-gap-2">
                                    {PLACEHOLDERS.map(p => (
                                        <Button
                                            key={p.key}
                                            type="button"
                                            onClick={() => insertPlaceholder(p.key)}
                                            variant="outline"
                                            size="xs"
                                            className="!ap-px-2 !ap-py-1 !ap-min-h-0 !ap-text-xs ap-text-blue-700 ap-border-blue-200 hover:ap-bg-blue-100"
                                            title={p.description}
                                        >
                                            {p.key}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Body HTML */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Email Body (HTML) *
                                </label>
                                <textarea
                                    id="body_html"
                                    value={formData.body_html}
                                    onChange={(e) => setFormData(prev => ({ ...prev, body_html: e.target.value }))}
                                    rows={12}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-font-mono ap-text-sm"
                                    placeholder="<p>Hi {{first_name}},</p>..."
                                />
                            </div>

                            {/* Preview */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Preview
                                </label>
                                <div 
                                    className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-gray-50 ap-prose ap-prose-sm ap-max-w-none"
                                    dangerouslySetInnerHTML={{ 
                                        __html: formData.body_html
                                            .replace(/\{\{first_name\}\}/g, 'John')
                                            .replace(/\{\{last_name\}\}/g, 'Doe')
                                            .replace(/\{\{display_name\}\}/g, 'John Doe')
                                            .replace(/\{\{email\}\}/g, 'john.doe@example.com')
                                            .replace(/\{\{current_pay\}\}/g, '$12.50')
                                            .replace(/\{\{projected_pay\}\}/g, '$13.00')
                                            .replace(/\{\{season_name\}\}/g, 'Summer 2025')
                                            .replace(/\{\{form_link\}\}/g, '#')
                                            .replace(/\{\{deadline\}\}/g, 'January 15, 2025')
                                    }}
                                />
                            </div>

                            {/* Default Checkbox */}
                            <label className="ap-flex ap-items-center ap-gap-3 ap-cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                                    className="ap-w-4 ap-h-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                                />
                                <span className="ap-text-sm ap-text-gray-700">
                                    Set as default template for this type
                                </span>
                            </label>
                        </div>

                        {/* Editor Footer */}
                        <div className="ap-px-6 ap-py-4 ap-bg-gray-50 ap-border-t ap-flex ap-justify-end ap-gap-3 ap-sticky ap-bottom-0">
                            <Button
                                onClick={closeEditor}
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving || !formData.name || !formData.subject || !formData.body_html}
                                variant="primary"
                            >
                                {saving ? (
                                    <>
                                        <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-white"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineCheck className="ap-w-5 ap-h-5" />
                                        {editingTemplate ? 'Update Template' : 'Create Template'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-flex ap-items-center ap-justify-center ap-z-50 ap-p-4">
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-max-w-md ap-w-full ap-p-6">
                        <div className="ap-flex ap-items-center ap-gap-3 ap-mb-4">
                            <div className="ap-p-2 ap-bg-red-100 ap-rounded-full">
                                <HiOutlineTrash className="ap-w-6 ap-h-6 ap-text-red-600" />
                            </div>
                            <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Delete Template</h3>
                        </div>
                        <p className="ap-text-gray-600 ap-mb-6">
                            Are you sure you want to delete "<strong>{deleteConfirm.name}</strong>"? 
                            This action cannot be undone.
                        </p>
                        <div className="ap-flex ap-justify-end ap-gap-3">
                            <Button
                                onClick={() => setDeleteConfirm(null)}
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={deleting}
                                variant="primary"
                                className="!ap-bg-red-600 hover:!ap-bg-red-700"
                            >
                                {deleting ? 'Deleting...' : 'Delete Template'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailTemplateManager;
