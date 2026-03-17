import React, { useState, useEffect, useCallback } from 'react';
import { 
    HiOutlineCheck as CheckIcon, 
    HiOutlineXMark as CloseIcon,
    HiOutlineArchiveBox as ArchiveIcon,
    HiOutlineArrowUturnLeft as UnarchiveIcon,
    HiOutlineTrash as DeleteIcon
} from 'react-icons/hi2';
import { Button } from './ui';
import { 
    createScanAudit, 
    updateScanAudit,
    archiveScanAudit,
    restoreScanAudit,
    deleteScanAudit,
    type AuditLog 
} from '@/services/api-professional-growth';
import { uploadFile } from '@/services/api';
import { getCachedUsersWithDetails } from '@/services/userCache';
import UserSelector, { type UserOption } from './UserSelector';
import RichTextEditor from './RichTextEditor';
import LoadingSpinner from './LoadingSpinner';

interface ScanAuditFormProps {
    editingAudit?: AuditLog | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const ScanAuditForm: React.FC<ScanAuditFormProps> = ({ editingAudit, onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        // Ensure audited_user_id is always a number for proper comparison with user IDs
        audited_user_id: editingAudit?.audited_user_id ? Number(editingAudit.audited_user_id) : 0,
        audit_date: editingAudit?.audit_date ? editingAudit.audit_date.split(' ')[0] : '',
        audit_time: editingAudit?.audit_date ? editingAudit.audit_date.split(' ')[1]?.substring(0, 5) : '',
        location: editingAudit?.location || '',
        wearing_correct_uniform: editingAudit?.wearing_correct_uniform !== undefined 
            ? Boolean(editingAudit.wearing_correct_uniform) 
            : true,
        attentive_to_zone: editingAudit?.attentive_to_zone !== undefined 
            ? Boolean(editingAudit.attentive_to_zone) 
            : true,
        posture_adjustment_5min: editingAudit?.posture_adjustment_5min !== undefined 
            ? Boolean(editingAudit.posture_adjustment_5min) 
            : true,
        notes: editingAudit?.notes || '',
        result: (editingAudit?.result as 'pass' | 'fail') || 'pass',
    });
    
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [attachments, setAttachments] = useState<Array<{ url: string; type: string; name: string }>>(
        editingAudit?.attachments ? JSON.parse(editingAudit.attachments as any) : []
    );
    const [uploading, setUploading] = useState(false);
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

    // Max file size: 50MB (matches typical WordPress/server limits)
    // Videos from phones can be 100MB+, so we warn users to trim or compress
    const MAX_FILE_SIZE_MB = 50;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            // Check file sizes first
            const oversizedFiles = Array.from(files).filter(f => f.size > MAX_FILE_SIZE_BYTES);
            if (oversizedFiles.length > 0) {
                const fileList = oversizedFiles.map(f => `${f.name} (${formatFileSize(f.size)})`).join(', ');
                throw new Error(
                    `File(s) too large: ${fileList}. Maximum size is ${MAX_FILE_SIZE_MB}MB per file. ` +
                    `Try trimming videos or using a lower resolution.`
                );
            }

            const uploadPromises = Array.from(files).map(async (file) => {
                console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', formatFileSize(file.size));
                try {
                    const attachment = await uploadFile(file);
                    console.log('Upload successful:', attachment);
                    return {
                        url: attachment.url,
                        type: file.type,
                        name: file.name,
                    };
                } catch (fileError: any) {
                    console.error('Failed to upload file:', file.name, fileError);
                    // Provide more helpful error messages for common issues
                    let errorMsg = fileError.message || 'Unknown error';
                    if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
                        errorMsg = `Server error uploading ${file.name} (${formatFileSize(file.size)}). ` +
                            `The file may be too large. Try trimming the video or using a lower quality setting.`;
                    }
                    throw new Error(errorMsg);
                }
            });

            const uploaded = await Promise.all(uploadPromises);
            setAttachments([...attachments, ...uploaded]);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload files');
        } finally {
            setUploading(false);
            // Reset the input so the same file can be uploaded again if needed
            e.target.value = '';
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }
        
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
                location: formData.location,
                wearing_correct_uniform: formData.wearing_correct_uniform === null ? undefined : (formData.wearing_correct_uniform ? 1 : 0),
                attentive_to_zone: formData.attentive_to_zone === null ? undefined : (formData.attentive_to_zone ? 1 : 0),
                posture_adjustment_5min: formData.posture_adjustment_5min === null ? undefined : (formData.posture_adjustment_5min ? 1 : 0),
                notes: formData.notes,
                result: formData.result,
                attachments: attachments.length > 0 ? attachments : undefined,
            };

            if (editingAudit) {
                await updateScanAudit(editingAudit.id, data);
            } else {
                await createScanAudit(data);
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save scan audit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!editingAudit) return;
        
        if (!confirm('Are you sure you want to archive this scan audit?')) {
            return;
        }

        try {
            await archiveScanAudit(editingAudit.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to archive scan audit');
        }
    };

    const handleRestore = async () => {
        if (!editingAudit) return;

        try {
            await restoreScanAudit(editingAudit.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to restore scan audit');
        }
    };

    const handleDelete = async () => {
        if (!editingAudit) return;

        if (!confirm('Are you sure you want to delete this scan audit? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteScanAudit(editingAudit.id);
            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete scan audit');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="ap-space-y-6">
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            {/* Staff Member Selection */}
            <div>
                <UserSelector
                    users={users}
                    selectedUserId={formData.audited_user_id}
                    onChange={handleUserSelect}
                    label="Staff Member Being Audited *"
                    placeholder="Search for staff member..."
                    isLoading={loadingUsers}
                />
            </div>

            {/* Date and Time */}
            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        Observation Date *
                    </label>
                    <input
                        type="date"
                        value={formData.audit_date}
                        onChange={(e) => updateFormField('audit_date', e.target.value)}
                        className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        required
                    />
                </div>
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        Observation Time *
                    </label>
                    <input
                        type="time"
                        value={formData.audit_time}
                        onChange={(e) => updateFormField('audit_time', e.target.value)}
                        className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        required
                    />
                </div>
            </div>

            {/* Location */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Location
                </label>
                <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => updateFormField('location', e.target.value)}
                    placeholder="e.g., Main Pool, Zone 3"
                    className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                />
            </div>

            {/* Wearing Correct Uniform */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Wearing Correct Uniform
                </label>
                <div className="ap-flex ap-gap-3">
                    <Button
                        type="button"
                        onClick={() => updateFormField('wearing_correct_uniform', true)}
                        variant={formData.wearing_correct_uniform === true ? 'success' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.wearing_correct_uniform !== true
                                ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                        }`}
                    >
                        Yes
                    </Button>
                    <Button
                        type="button"
                        onClick={() => updateFormField('wearing_correct_uniform', false)}
                        variant={formData.wearing_correct_uniform === false ? 'danger' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.wearing_correct_uniform !== false
                                ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                        }`}
                    >
                        No
                    </Button>
                </div>
            </div>

            {/* Attentive to Entire Zone */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Attentive to Entire Zone
                </label>
                <div className="ap-flex ap-gap-3">
                    <Button
                        type="button"
                        onClick={() => updateFormField('attentive_to_zone', true)}
                        variant={formData.attentive_to_zone === true ? 'success' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.attentive_to_zone !== true
                                ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                        }`}
                    >
                        Yes
                    </Button>
                    <Button
                        type="button"
                        onClick={() => updateFormField('attentive_to_zone', false)}
                        variant={formData.attentive_to_zone === false ? 'danger' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.attentive_to_zone !== false
                                ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                        }`}
                    >
                        No
                    </Button>
                </div>
            </div>

            {/* Posture Adjustment at 5 Minute Mark */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Posture Adjustment at 5 Minute Mark
                </label>
                <div className="ap-flex ap-gap-3">
                    <Button
                        type="button"
                        onClick={() => updateFormField('posture_adjustment_5min', true)}
                        variant={formData.posture_adjustment_5min === true ? 'success' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.posture_adjustment_5min !== true
                                ? 'hover:!ap-bg-green-50 hover:!ap-border-green-300' : ''
                        }`}
                    >
                        Yes
                    </Button>
                    <Button
                        type="button"
                        onClick={() => updateFormField('posture_adjustment_5min', false)}
                        variant={formData.posture_adjustment_5min === false ? 'danger' : 'outline'}
                        className={`ap-flex-1 ${
                            formData.posture_adjustment_5min !== false
                                ? 'hover:!ap-bg-red-50 hover:!ap-border-red-300' : ''
                        }`}
                    >
                        No
                    </Button>
                </div>
            </div>

            {/* Overall Result */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Overall Result *
                </label>
                <div className="ap-flex ap-gap-3">
                    <Button
                        type="button"
                        onClick={() => setFormData({ ...formData, result: 'pass' })}
                        variant="ghost"
                        className={`!ap-flex-1 !ap-px-4 !ap-py-2.5 !ap-border !ap-rounded-lg !ap-font-medium ap-transition-colors ${
                            formData.result === 'pass'
                                ? '!ap-bg-green-600 !ap-text-white !ap-border-green-600' : '!ap-bg-white !ap-text-gray-700 !ap-border-gray-300 hover:!ap-bg-green-50 hover:!ap-border-green-300'
                        }`}
                    >
                        Pass
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setFormData({ ...formData, result: 'fail' })}
                        variant="ghost"
                        className={`!ap-flex-1 !ap-px-4 !ap-py-2.5 !ap-border !ap-rounded-lg !ap-font-medium ap-transition-colors ${
                            formData.result === 'fail'
                                ? '!ap-bg-red-600 !ap-text-white !ap-border-red-600' : '!ap-bg-white !ap-text-gray-700 !ap-border-gray-300 hover:!ap-bg-red-50 hover:!ap-border-red-300'
                        }`}
                    >
                        Fail
                    </Button>
                </div>
            </div>

            {/* Details (Rich Text) */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Details / Notes
                </label>
                <RichTextEditor
                    value={formData.notes}
                    onChange={(value) => updateFormField('notes', value)}
                    placeholder="Add any observations, notes, or details about the scan audit..."
                />
            </div>

            {/* Attachments */}
            <div>
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    Attachments (Photos/Videos)
                </label>
                <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                    Max {MAX_FILE_SIZE_MB}MB per file. For large videos, try trimming or using lower quality.
                </p>
                <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="ap-block ap-w-full ap-text-sm ap-text-gray-500 file:ap-mr-4 file:ap-py-2 file:ap-px-4 file:ap-rounded-lg file:ap-border-0 file:ap-text-sm file:ap-font-semibold file:ap-bg-blue-50 file:ap-text-blue-700 hover:file:ap-bg-blue-100 ap-cursor-pointer"
                />
                {uploading && (
                    <div className="ap-mt-2 ap-flex ap-items-center ap-text-sm ap-text-gray-600">
                        <LoadingSpinner />
                        <span className="ap-ml-2">Uploading...</span>
                    </div>
                )}
                
                {/* Show uploaded attachments */}
                {attachments.length > 0 && (
                    <div className="ap-mt-3 ap-space-y-2">
                        {attachments.map((attachment, index) => (
                            <div key={index} className="ap-flex ap-items-center ap-justify-between ap-p-2 ap-bg-gray-50 ap-rounded-lg">
                                <div className="ap-flex ap-items-center ap-flex-1 ap-min-w-0">
                                    {attachment.type.startsWith('image/') ? (
                                        <img src={attachment.url} alt={attachment.name} className="ap-h-12 ap-w-12 ap-object-cover ap-rounded ap-mr-3" />
                                    ) : (
                                        <div className="ap-h-12 ap-w-12 ap-bg-gray-200 ap-rounded ap-mr-3 ap-flex ap-items-center ap-justify-center ap-text-xs ap-text-gray-600">
                                            Video
                                        </div>
                                    )}
                                    <span className="ap-text-sm ap-text-gray-700 ap-truncate">{attachment.name}</span>
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(index)}
                                    variant="ghost"
                                    size="xs"
                                    className="!ap-p-1.5 !ap-min-h-0 !ap-ml-2 !ap-text-red-600 hover:!ap-text-red-800 hover:!ap-bg-red-50"
                                >
                                    <CloseIcon className="ap-h-5 ap-w-5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form Actions */}
            <div className="ap-flex ap-flex-wrap ap-items-center ap-justify-between ap-gap-2 ap-pt-4 ap-border-t">
                {/* Archive/Delete buttons on the left (only for existing audits) */}
                <div className="ap-flex ap-flex-wrap ap-gap-2">
                    {editingAudit && (
                        <>
                            {editingAudit.archived ? (
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
                        disabled={submitting || uploading}
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        leftIcon={!submitting ? <CheckIcon className="ap-h-5 ap-w-5" /> : undefined}
                    >
                        {submitting ? 'Saving...' : (editingAudit ? 'Update' : 'Save') + ' Scan Audit'}
                    </Button>
                </div>
            </div>
        </form>
    );
};

// Note: User cache is now managed by centralized userCache service
// Use invalidateUserCache() from '@/services/userCache' to clear cache

export default ScanAuditForm;
