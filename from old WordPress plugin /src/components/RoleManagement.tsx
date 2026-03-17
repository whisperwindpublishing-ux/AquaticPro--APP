import React, { useState, useEffect } from 'react';
import { 
    HiOutlinePlus as PlusIcon,
    HiOutlinePencil as EditIcon,
    HiOutlineXMark as XMarkIcon
} from 'react-icons/hi2';
import { 
    JobRole, 
    getJobRoles, 
    createJobRole, 
    updateJobRole, 
    deleteJobRole 
} from '@/services/api-professional-growth';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';

/**
 * Return tier-appropriate permission defaults for all modules.
 * Mirrors the tier logic in sync_all_permissions() on the PHP side.
 */
function getTierDefaults(tier: number) {
    return {
        dailyLogPermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        scanAuditPermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        liveDrillPermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        inservicePermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        cashierAuditPermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        instructorEvaluationPermissions: {
            canView: true,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        taskDeckPermissions: {
            canView: true,
            canViewOnlyAssigned: false,
            canManageAllPrimaryCards: tier >= 4,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
            canManagePrimaryDeck: tier >= 5,
            canCreatePublicDecks: tier >= 4,
        },
        reportsPermissions: {
            canViewAllRecords: tier >= 5,
        },
        lessonManagementPermissions: {
            canView: tier >= 1,
            canCreate: tier >= 3,
            canEdit: tier >= 3,
            canDelete: tier >= 3,
            canModerateAll: tier >= 5,
        },
        lmsPermissions: {
            canViewCourses: true,
            canViewLessons: true,
            canCreateCourses: tier >= 4,
            canEditCourses: tier >= 4,
            canDeleteCourses: tier >= 5,
            canCreateLessons: tier >= 4,
            canEditLessons: tier >= 4,
            canDeleteLessons: tier >= 5,
            canManageExcalidraw: tier >= 4,
            canModerateAll: tier >= 5,
        },
        awesomeAwardsPermissions: {
            canNominate: true,
            canVote: tier >= 3,
            canApprove: tier >= 4,
            canDirectAssign: tier >= 5,
            canManagePeriods: tier >= 5,
            canViewNominations: true,
            canViewWinners: true,
            canViewArchives: true,
            canArchive: tier >= 5,
        },
        srmPermissions: {
            canViewOwnPay: true,
            canViewAllPay: tier >= 3,
            canManagePayConfig: tier >= 5,
            canSendInvites: tier >= 3,
            canViewResponses: tier >= 3,
            canManageStatus: tier >= 5,
            canManageTemplates: tier >= 5,
            canViewRetention: tier >= 3,
            canBulkActions: tier >= 5,
        },
        emailPermissions: {
            canSendEmail: tier >= 5,
            canManageTemplates: tier >= 5,
            canViewHistory: tier >= 5,
        },
        certificatePermissions: {
            canViewAll: tier >= 3,
            canEditRecords: tier >= 3,
            canManageTypes: tier >= 5,
            canApproveUploads: tier >= 3,
            canBulkEdit: tier >= 5,
        },
    };
}

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<JobRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRole, setEditingRole] = useState<JobRole | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        tier: 1,
        description: '',
        inservice_hours: 4,
        dailyLogPermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        scanAuditPermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        liveDrillPermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        inservicePermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        cashierAuditPermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        instructorEvaluationPermissions: {
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        taskDeckPermissions: {
            canView: true,
            canViewOnlyAssigned: false,
            canManageAllPrimaryCards: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
            canManagePrimaryDeck: false,
            canCreatePublicDecks: false,
        },
        reportsPermissions: {
            canViewAllRecords: false,
        },
        lessonManagementPermissions: {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canModerateAll: false,
        },
        lmsPermissions: {
            canViewCourses: true,
            canViewLessons: true,
            canCreateCourses: false,
            canEditCourses: false,
            canDeleteCourses: false,
            canCreateLessons: false,
            canEditLessons: false,
            canDeleteLessons: false,
            canManageExcalidraw: false,
            canModerateAll: false,
        },
        awesomeAwardsPermissions: {
            canNominate: true,
            canVote: false,
            canApprove: false,
            canDirectAssign: false,
            canManagePeriods: false,
            canViewNominations: true,
            canViewWinners: true,
            canViewArchives: true,
            canArchive: false,
        },
        srmPermissions: {
            canViewOwnPay: true,
            canViewAllPay: false,
            canManagePayConfig: false,
            canSendInvites: false,
            canViewResponses: false,
            canManageStatus: false,
            canManageTemplates: false,
            canViewRetention: false,
            canBulkActions: false,
        },
        emailPermissions: {
            canSendEmail: false,
            canManageTemplates: false,
            canViewHistory: false,
        },
        certificatePermissions: {
            canViewAll: false,
            canEditRecords: false,
            canManageTypes: false,
            canApproveUploads: false,
            canBulkEdit: false,
        },
    });

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const data = await getJobRoles();
            
            // DEBUG: Log returned job roles to diagnose permission issues
            console.log('[RoleManagement] Loaded job roles:', data);
            if (data && data.length > 0) {
                console.log('[RoleManagement] First role permissions check:', {
                    id: data[0].id,
                    title: data[0].title,
                    dailyLogPermissions: data[0].dailyLogPermissions,
                    hasPermissions: !!data[0].dailyLogPermissions,
                    allPermissionKeys: Object.keys(data[0]).filter(k => k.includes('Permissions'))
                });
            }
            
            setRoles(data);
            setError(null);
        } catch (err) {
            setError('Failed to load job roles');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openAddForm = () => {
        const tier = 1;
        setEditingRole(null);
        setFormData({
            title: '',
            tier,
            description: '',
            inservice_hours: 4,
            ...getTierDefaults(tier),
        });
        setShowAddForm(true);
    };

    const openEditForm = (role: JobRole) => {
        // DEBUG: Log what we're receiving vs what we're setting
        console.log('[RoleManagement] Opening edit form for role:', {
            id: role.id,
            title: role.title,
            tier: role.tier,
            dailyLogPermissions: role.dailyLogPermissions,
            usingDefault: !role.dailyLogPermissions
        });
        
        setShowAddForm(false);
        setEditingRole(role);
        setFormData({
            title: role.title,
            tier: role.tier,
            description: role.description || '',
            inservice_hours: role.inservice_hours || 4,
            dailyLogPermissions: role.dailyLogPermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            scanAuditPermissions: role.scanAuditPermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            liveDrillPermissions: role.liveDrillPermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            inservicePermissions: role.inservicePermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            cashierAuditPermissions: role.cashierAuditPermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            instructorEvaluationPermissions: role.instructorEvaluationPermissions || {
                canView: true,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            taskDeckPermissions: {
                canView: true,
                canViewOnlyAssigned: false,
                canManageAllPrimaryCards: role.tier >= 4,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
                canManagePrimaryDeck: role.tier >= 5,
                canCreatePublicDecks: role.tier >= 4,
                ...role.taskDeckPermissions,
            },
            reportsPermissions: role.reportsPermissions || {
                canViewAllRecords: role.tier >= 5,
            },
            lessonManagementPermissions: role.lessonManagementPermissions || {
                canView: role.tier >= 1,
                canCreate: role.tier >= 3,
                canEdit: role.tier >= 3,
                canDelete: role.tier >= 3,
                canModerateAll: role.tier >= 5,
            },
            lmsPermissions: role.lmsPermissions || {
                canViewCourses: true,
                canViewLessons: true,
                canCreateCourses: role.tier >= 4,
                canEditCourses: role.tier >= 4,
                canDeleteCourses: role.tier >= 5,
                canCreateLessons: role.tier >= 4,
                canEditLessons: role.tier >= 4,
                canDeleteLessons: role.tier >= 5,
                canManageExcalidraw: role.tier >= 4,
                canModerateAll: role.tier >= 5,
            },
            awesomeAwardsPermissions: role.awesomeAwardsPermissions || {
                canNominate: true,
                canVote: role.tier >= 3,
                canApprove: role.tier >= 4,
                canDirectAssign: role.tier >= 5,
                canManagePeriods: role.tier >= 5,
                canViewNominations: true,
                canViewWinners: true,
                canViewArchives: true,
                canArchive: role.tier >= 5,
            },
            srmPermissions: role.srmPermissions || {
                canViewOwnPay: true,
                canViewAllPay: role.tier >= 3,
                canManagePayConfig: role.tier >= 5,
                canSendInvites: role.tier >= 3,
                canViewResponses: role.tier >= 3,
                canManageStatus: role.tier >= 5,
                canManageTemplates: role.tier >= 5,
                canViewRetention: role.tier >= 3,
                canBulkActions: role.tier >= 5,
            },
            emailPermissions: role.emailPermissions || {
                canSendEmail: role.tier >= 5,
                canManageTemplates: role.tier >= 5,
                canViewHistory: role.tier >= 5,
            },
            certificatePermissions: role.certificatePermissions || {
                canViewAll: role.tier >= 3,
                canEditRecords: role.tier >= 3,
                canManageTypes: role.tier >= 5,
                canApproveUploads: role.tier >= 3,
                canBulkEdit: role.tier >= 5,
            },
        });
    };

    const closeForm = () => {
        setShowAddForm(false);
        setEditingRole(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log('Submitting form data:', formData);
        
        try {
            if (editingRole) {
                console.log('Updating role:', editingRole.id, 'with data:', formData);
                await updateJobRole(editingRole.id, formData);
            } else {
                console.log('Creating new role with data:', formData);
                await createJobRole(formData);
            }
            
            await loadRoles();
            closeForm();
            setError(null);
        } catch (err) {
            setError('Failed to save job role');
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this job role? This cannot be undone.')) {
            return;
        }

        try {
            await deleteJobRole(id);
            await loadRoles();
            setError(null);
        } catch (err) {
            setError('Failed to delete job role');
            console.error(err);
        }
    };

    const getTierLabel = (tier: number): string => {
        const labels: { [key: number]: string } = {
            1: 'Tier 1 - Entry Level',
            2: 'Tier 2 - Coordinator/Lead',
            3: 'Tier 3 - Manager',
            4: 'Tier 4 - Aquatic Coordinator',
            5: 'Tier 5 - Aquatic Professional',
            6: 'Tier 6 - Plugin Admin (Full Access)',
        };
        return labels[tier] || `Tier ${tier}`;
    };

    // Inline form for add/edit (extracted from modal)
    const renderForm = () => (
        <form onSubmit={handleSubmit} className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-6 ap-mb-6">
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                <h3 className="ap-text-lg ap-font-medium ap-text-gray-900">
                    {editingRole ? 'Edit Job Role' : 'Add New Job Role'}
                </h3>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={closeForm}
                    className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-gray-500"
                >
                    <XMarkIcon className="ap-h-6 ap-w-6" />
                </Button>
            </div>

            <div className="ap-space-y-4">
                {/* Basic Info - 2 column layout */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                    {/* Job Title */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Job Title *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="e.g., Lifeguard, Manager, etc."
                        />
                    </div>

                    {/* Tier */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Hierarchy Tier *
                        </label>
                        <select
                            required
                            value={formData.tier}
                            onChange={(e) => {
                                const newTier = parseInt(e.target.value);
                                // When adding a NEW role, auto-populate tier-appropriate defaults
                                // When editing, only update the tier field (preserve custom permissions)
                                if (!editingRole) {
                                    setFormData({ ...formData, tier: newTier, ...getTierDefaults(newTier) });
                                } else {
                                    setFormData({ ...formData, tier: newTier });
                                }
                            }}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value={1}>Tier 1 - Entry Level</option>
                            <option value={2}>Tier 2 - Coordinator/Lead</option>
                            <option value={3}>Tier 3 - Manager</option>
                            <option value={4}>Tier 4 - Aquatic Coordinator</option>
                            <option value={5}>Tier 5 - Aquatic Professional</option>
                            <option value={6}>Tier 6 - Plugin Admin (Full Access)</option>
                        </select>
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                            Higher tiers can manage lower tiers. Tier 6 has full plugin access.
                        </p>
                    </div>

                    {/* In-Service Training Hours */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Monthly Training Hours *
                        </label>
                        <input
                            type="number"
                            required
                            min="0"
                            max="40"
                            step="0.25"
                            value={formData.inservice_hours}
                            onChange={(e) => setFormData({ ...formData, inservice_hours: parseFloat(e.target.value) || 0 })}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="4.00"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="Optional description..."
                        />
                    </div>
                </div>

                {/* Reset to Tier Defaults button */}
                <div className="ap-flex ap-items-center ap-justify-between ap-mt-4 ap-pt-4 ap-border-t ap-border-gray-200">
                    <p className="ap-text-xs ap-text-gray-500">
                        Permissions below are saved per role. Click &ldquo;Reset&rdquo; to apply the recommended defaults for the selected tier.
                    </p>
                    <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setFormData(prev => ({ ...prev, ...getTierDefaults(prev.tier) }))}
                    >
                        Reset to Tier {formData.tier} Defaults
                    </Button>
                </div>

                {/* Permissions Grid - Collapsible sections */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4 ap-mt-6">
                    {/* Daily Log Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-3">Daily Log Permissions</h4>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View', desc: 'View daily logs' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new daily logs' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit their own daily logs' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete their own daily logs' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY daily log (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.dailyLogPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            dailyLogPermissions: {
                                                ...formData.dailyLogPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Scan Audit Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Scan Audit Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Users can always view audits where they are the subject</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View All', desc: 'View ALL scan audits, not just their own' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new scan audits for others' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit audits they created' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete audits they created' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY scan audit (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.scanAuditPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            scanAuditPermissions: {
                                                ...formData.scanAuditPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Live Drill Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Live Drill Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Users can always view drills where they are the subject</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View All', desc: 'View ALL live drills, not just their own' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new live drill records for others' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit drills they created' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete drills they created' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY live drill (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.liveDrillPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            liveDrillPermissions: {
                                                ...formData.liveDrillPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* In-Service Training Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-3">In-Service Training Permissions</h4>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View', desc: 'View in-service training logs' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new in-service training logs' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit their own training logs' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete their own training logs' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY training log (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.inservicePermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            inservicePermissions: {
                                                ...formData.inservicePermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Cashier Audit Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Cashier Audit Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Users can always view audits where they are the subject</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View All', desc: 'View ALL cashier audits, not just their own' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new cashier audits for others' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit audits they created' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete audits they created' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY cashier audit (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.cashierAuditPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            cashierAuditPermissions: {
                                                ...formData.cashierAuditPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Instructor Evaluation Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Instructor Evaluation Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Users can always view evaluations where they are the subject</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View All', desc: 'View ALL instructor evaluations, not just their own' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new evaluations for others' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit evaluations they created' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete evaluations they created' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY evaluation (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.instructorEvaluationPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            instructorEvaluationPermissions: {
                                                ...formData.instructorEvaluationPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Lesson Management Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">Lesson Management Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to the Lessons module (Groups, Swimmers, Evaluations, Camp Rosters)</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View', desc: 'View groups, swimmers, and evaluations in the Lessons module' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new groups, swimmers, and evaluations' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit groups, swimmers, and evaluations they created' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete groups, swimmers, and evaluations they created' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY group, swimmer, or evaluation (moderator privilege)', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.lessonManagementPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            lessonManagementPermissions: {
                                                ...formData.lessonManagementPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* LMS Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white lg:ap-col-span-2">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">📚 Learning Module (LMS) Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to the Learning Module with courses, visual lessons, and Excalidraw presentations</p>
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-3">
                            {[
                                { key: 'canViewCourses', label: 'Can View Courses', desc: 'Browse and see available courses' },
                                { key: 'canViewLessons', label: 'Can View Lessons', desc: 'Watch lessons and track progress' },
                                { key: 'canCreateCourses', label: 'Can Create Courses', desc: 'Create new courses in the LMS builder' },
                                { key: 'canEditCourses', label: 'Can Edit Courses', desc: 'Edit course titles, descriptions, and ordering' },
                                { key: 'canDeleteCourses', label: 'Can Delete Courses', desc: 'Delete courses from the system' },
                                { key: 'canCreateLessons', label: 'Can Create Lessons', desc: 'Create new lessons within courses' },
                                { key: 'canEditLessons', label: 'Can Edit Lessons', desc: 'Edit lesson content and settings' },
                                { key: 'canDeleteLessons', label: 'Can Delete Lessons', desc: 'Delete lessons from courses' },
                                { key: 'canManageExcalidraw', label: 'Can Manage Excalidraw', desc: 'Create/edit Excalidraw visual presentations' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Full admin access to all LMS content', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.lmsPermissions as any)?.[key] ?? false}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            lmsPermissions: {
                                                ...formData.lmsPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Reports Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-3">Reports Permissions</h4>
                        <div className="ap-space-y-3">
                            <label className="ap-flex ap-items-start ap-gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.reportsPermissions.canViewAllRecords}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        reportsPermissions: {
                                            ...formData.reportsPermissions,
                                            canViewAllRecords: e.target.checked
                                        }
                                    })}
                                    className="ap-h-4 ap-w-4 ap-mt-0.5 ap-text-purple-600 focus:ap-ring-purple-500 ap-border-gray-300 ap-rounded"
                                />
                                <div className="ap-flex ap-flex-col">
                                    <span className="ap-text-xs ap-font-medium ap-text-purple-700">Can View All Records</span>
                                    <span className="ap-text-xs ap-text-gray-500">View all users' compliance records in the Reports tab (without this, users only see their own records)</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* TaskDeck Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-3">TaskDeck Permissions</h4>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canView', label: 'Can View', desc: 'View TaskDecks and all cards on public decks' },
                                { key: 'canViewOnlyAssigned', label: 'View Only Assigned Cards', desc: 'Only see cards assigned to this user or their role (instead of all cards)' },
                                { key: 'canManageAllPrimaryCards', label: 'Full Access to Primary Deck', desc: 'Even with "View Only Assigned", can still view/edit ALL cards on the Primary Deck' },
                                { key: 'canCreate', label: 'Can Create', desc: 'Create new TaskDecks and cards' },
                                { key: 'canEdit', label: 'Can Edit Own', desc: 'Edit their own TaskDecks and cards' },
                                { key: 'canDelete', label: 'Can Delete Own', desc: 'Delete their own TaskDecks and cards' },
                                { key: 'canModerateAll', label: 'Can Moderate All', desc: 'Edit/delete ANY TaskDeck or card (moderator privilege)', moderator: true },
                                { key: 'canManagePrimaryDeck', label: 'Can Manage Primary Deck', desc: 'Designate a system-wide primary deck visible to all users', moderator: true },
                                { key: 'canCreatePublicDecks', label: 'Can Create Public Decks', desc: 'Allow creating public decks visible to others (without this, users can only create private decks)' },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.taskDeckPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            taskDeckPermissions: {
                                                ...formData.taskDeckPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Awesome Awards Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">🏆 Awesome Awards Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to the Awesome Awards module (nominations, voting, winner selection)</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canNominate', label: 'Can Nominate', desc: 'Submit nominations for Awesome Awards' },
                                { key: 'canVote', label: 'Can Vote', desc: 'Vote on nominations during voting periods' },
                                { key: 'canViewNominations', label: 'Can View All Nominations', desc: 'See all nominations (not just their own)' },
                                { key: 'canViewWinners', label: 'Can View Winners', desc: 'See winners and award history' },
                                { key: 'canViewArchives', label: 'Can View Archives', desc: 'Access archived periods and nominations' },
                                { key: 'canApprove', label: 'Can Approve', desc: 'Approve/reject nominations and select winners', moderator: true },
                                { key: 'canDirectAssign', label: 'Can Direct Assign', desc: 'Directly assign awards without voting', moderator: true },
                                { key: 'canManagePeriods', label: 'Can Manage Periods', desc: 'Create, edit, and manage award periods', moderator: true },
                                { key: 'canArchive', label: 'Can Archive', desc: 'Archive/unarchive award periods', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.awesomeAwardsPermissions as any)[key]}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            awesomeAwardsPermissions: {
                                                ...formData.awesomeAwardsPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* SRM Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white lg:ap-col-span-2">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">📅 Seasonal Returns Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to the Seasonal Returns & Pay Management module</p>
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-3">
                            {[
                                { key: 'canViewOwnPay', label: 'View Own Pay', desc: 'See their own pay rates' },
                                { key: 'canViewAllPay', label: 'View All Pay', desc: 'See all employee pay rates' },
                                { key: 'canSendInvites', label: 'Send Invites', desc: 'Send return intent invitations' },
                                { key: 'canViewResponses', label: 'View Responses', desc: 'View employee return responses' },
                                { key: 'canViewRetention', label: 'View Retention Stats', desc: 'Access retention analytics' },
                                { key: 'canManagePayConfig', label: 'Manage Pay Config', desc: 'Edit pay rates and bonuses', moderator: true },
                                { key: 'canManageStatus', label: 'Manage Seasons', desc: 'Create/edit seasons and employee status', moderator: true },
                                { key: 'canManageTemplates', label: 'Manage Templates', desc: 'Edit email templates', moderator: true },
                                { key: 'canBulkActions', label: 'Bulk Actions', desc: 'Perform bulk employee updates', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.srmPermissions as any)?.[key] ?? false}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            srmPermissions: {
                                                ...formData.srmPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Email Composer Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">✉️ Email Composer Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to the Email Composer module for sending custom emails</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canSendEmail', label: 'Can Send Email', desc: 'Compose and send emails to users and roles' },
                                { key: 'canManageTemplates', label: 'Manage Templates', desc: 'Create, edit, and delete email templates', moderator: true },
                                { key: 'canViewHistory', label: 'View Send History', desc: 'View history of all sent emails', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.emailPermissions as any)?.[key] ?? false}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            emailPermissions: {
                                                ...formData.emailPermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Certificate Tracking Permissions */}
                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-bg-white">
                        <h4 className="ap-text-sm ap-font-semibold ap-text-gray-900 ap-mb-2">📋 Certificate Tracking Permissions</h4>
                        <p className="ap-text-xs ap-text-gray-500 ap-mb-3">Controls access to view, edit, and manage employee certifications</p>
                        <div className="ap-space-y-3">
                            {[
                                { key: 'canViewAll', label: 'View All Certificates', desc: 'View certificate records for all employees' },
                                { key: 'canEditRecords', label: 'Edit Records', desc: 'Edit certificate dates and details for employees' },
                                { key: 'canApproveUploads', label: 'Approve Uploads', desc: 'Review and approve uploaded certificate files' },
                                { key: 'canManageTypes', label: 'Manage Types', desc: 'Create, edit, and delete certificate types', moderator: true },
                                { key: 'canBulkEdit', label: 'Bulk Edit', desc: 'Perform bulk certificate updates across employees', moderator: true },
                            ].map(({ key, label, desc, moderator }) => (
                                <label key={key} className="ap-flex ap-items-start ap-gap-2">
                                    <input
                                        type="checkbox"
                                        checked={(formData.certificatePermissions as any)?.[key] ?? false}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            certificatePermissions: {
                                                ...formData.certificatePermissions,
                                                [key]: e.target.checked
                                            }
                                        })}
                                        className={`ap-h-4 ap-w-4 ap-mt-0.5 ${moderator ? 'ap-text-purple-600' : 'ap-text-blue-600'} focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded`}
                                    />
                                    <div className="ap-flex ap-flex-col">
                                        <span className={`ap-text-xs ap-font-medium ${moderator ? 'ap-text-purple-700' : 'ap-text-gray-700'}`}>{label}</span>
                                        <span className="ap-text-xs ap-text-gray-500">{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="ap-flex ap-justify-between ap-items-center ap-mt-6 ap-pt-4 ap-border-t ap-border-gray-200">
                {editingRole ? (
                    <Button
                        type="button"
                        variant="danger-outline"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this job role? This cannot be undone.')) {
                                handleDelete(editingRole.id);
                                closeForm();
                            }
                        }}
                    >
                        Delete
                    </Button>
                ) : (
                    <div></div>
                )}
                <div className="ap-flex ap-gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={closeForm}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                    >
                        {editingRole ? 'Update Role' : 'Create Role'}
                    </Button>
                </div>
            </div>
        </form>
    );

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">Job Roles Management</h2>
                    <p className="ap-text-gray-600 ap-mt-1">Define job titles, hierarchy tiers, and WordPress role mappings</p>
                </div>
                {!showAddForm && !editingRole && (
                    <Button
                        onClick={openAddForm}
                        variant="primary"
                        leftIcon={<PlusIcon className="ap-h-5 ap-w-5" />}
                    >
                        Add Job Role
                    </Button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            {/* Inline Add Form */}
            {showAddForm && !editingRole && renderForm()}

            {/* Roles List */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Title
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Tier
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    In-Service Hours
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Description
                                </th>
                                <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-4 sm:ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                    Edit
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {roles.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="ap-px-4 sm:ap-px-6 ap-py-12 ap-text-center ap-text-gray-500">
                                        No job roles defined yet. Click "Add Job Role" to get started.
                                    </td>
                                </tr>
                            ) : (
                                roles.map((role) => (
                                    <React.Fragment key={role.id}>
                                        <tr className={`hover:ap-bg-gray-50 ${editingRole?.id === role.id ? 'ap-bg-blue-50' : ''}`}>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-900">{role.title}</div>
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <span className="ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                                    {getTierLabel(role.tier)}
                                                </span>
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <span className="ap-text-sm ap-text-gray-600">
                                                    {role.inservice_hours} hrs/month
                                                </span>
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4">
                                                <div className="ap-text-sm ap-text-gray-600 line-clamp-2">
                                                    {role.description || '-'}
                                                </div>
                                            </td>
                                            <td className="ap-sticky ap-right-0 ap-bg-white ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => openEditForm(role)}
                                                    className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-text-blue-900"
                                                    title="Edit role"
                                                    disabled={!!editingRole}
                                                >
                                                    <EditIcon className="ap-h-5 ap-w-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                        {/* Inline Edit Form */}
                                        {editingRole?.id === role.id && (
                                            <tr>
                                                <td colSpan={5} className="ap-p-0 ap-bg-gray-50">
                                                    {renderForm()}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RoleManagement;
