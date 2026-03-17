import React, { useState, useEffect } from 'react';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineBars3,
    HiOutlinePhoto,
    HiOutlineCheck,
    HiOutlineArrowsUpDown,
    HiOutlineUserGroup,
} from 'react-icons/hi2';
import { Button } from './ui';
import { getJobRoles } from '@/services/api-professional-growth';

interface JobRole {
    id: number;
    title: string;
    tier: number;
}

interface ActionButton {
    id: number;
    title: string;
    url: string;
    color: string;
    thumbnail_url?: string;
    visible_to_roles?: number[] | null;
    sort_order: number;
}

const ActionButtonsManagement: React.FC = () => {
    const [buttons, setButtons] = useState<ActionButton[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingButton, setEditingButton] = useState<ActionButton | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [draggedItem, setDraggedItem] = useState<number | null>(null);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    const colorOptions = [
        { value: 'blue', label: 'Blue', class: 'bg-blue-600' },
        { value: 'green', label: 'Green', class: 'bg-green-600' },
        { value: 'red', label: 'Red', class: 'bg-red-600' },
        { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
        { value: 'purple', label: 'Purple', class: 'bg-purple-600' },
        { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
        { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
        { value: 'teal', label: 'Teal', class: 'bg-teal-600' },
        { value: 'indigo', label: 'Indigo', class: 'bg-indigo-600' },
        { value: 'gray', label: 'Gray', class: 'bg-gray-600' },
        { value: 'cyan', label: 'Cyan', class: 'bg-cyan-600' },
    ];

    useEffect(() => {
        fetchButtons();
        fetchJobRoles();
    }, []);

    const fetchJobRoles = async () => {
        try {
            const roles = await getJobRoles();
            setJobRoles(roles.sort((a, b) => a.tier - b.tier));
        } catch (err) {
            console.error('Failed to fetch job roles:', err);
        }
    };

    const fetchButtons = async () => {
        try {
            const response = await fetch(`${apiUrl}/dashboard/action-buttons`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setButtons(data.sort((a: ActionButton, b: ActionButton) => a.sort_order - b.sort_order));
            }
        } catch (err) {
            console.error('Failed to fetch action buttons:', err);
            setError('Failed to load action buttons');
        } finally {
            setLoading(false);
        }
    };

    const saveButton = async (button: Partial<ActionButton>) => {
        setSaving(true);
        setError(null);
        try {
            const method = button.id ? 'PUT' : 'POST';
            const url = button.id 
                ? `${apiUrl}/dashboard/action-buttons/${button.id}`
                : `${apiUrl}/dashboard/action-buttons`;
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(button),
            });

            if (response.ok) {
                await fetchButtons();
                setEditingButton(null);
                setIsAddingNew(false);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to save button');
            }
        } catch (err) {
            console.error('Failed to save button:', err);
            setError('Failed to save button');
        } finally {
            setSaving(false);
        }
    };

    const deleteButton = async (id: number) => {
        if (!confirm('Are you sure you want to delete this button?')) return;
        
        try {
            const response = await fetch(`${apiUrl}/dashboard/action-buttons/${id}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce },
            });

            if (response.ok) {
                await fetchButtons();
            } else {
                setError('Failed to delete button');
            }
        } catch (err) {
            console.error('Failed to delete button:', err);
            setError('Failed to delete button');
        }
    };

    const updateSortOrder = async (reorderedButtons: ActionButton[]) => {
        try {
            const sortData = reorderedButtons.map((btn, index) => ({
                id: btn.id,
                sort_order: index,
            }));

            await fetch(`${apiUrl}/dashboard/action-buttons/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ buttons: sortData }),
            });
        } catch (err) {
            console.error('Failed to update sort order:', err);
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItem === null || draggedItem === index) return;

        const newButtons = [...buttons];
        const draggedButton = newButtons[draggedItem];
        newButtons.splice(draggedItem, 1);
        newButtons.splice(index, 0, draggedButton);
        
        setButtons(newButtons);
        setDraggedItem(index);
    };

    const handleDragEnd = () => {
        if (draggedItem !== null) {
            updateSortOrder(buttons);
        }
        setDraggedItem(null);
    };

    const ButtonForm: React.FC<{ button?: ActionButton; onCancel: () => void }> = ({ button, onCancel }) => {
        const [formData, setFormData] = useState({
            title: button?.title || '',
            url: button?.url || '',
            color: button?.color || 'blue',
            thumbnail_url: button?.thumbnail_url || '',
            visible_to_roles: button?.visible_to_roles || [] as number[],
        });

        const handleRoleToggle = (roleId: number) => {
            setFormData(prev => {
                const currentRoles = prev.visible_to_roles || [];
                if (currentRoles.includes(roleId)) {
                    return { ...prev, visible_to_roles: currentRoles.filter(id => id !== roleId) };
                } else {
                    return { ...prev, visible_to_roles: [...currentRoles, roleId] };
                }
            });
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            saveButton({
                ...formData,
                visible_to_roles: formData.visible_to_roles.length > 0 ? formData.visible_to_roles : null,
                id: button?.id,
                sort_order: button?.sort_order ?? buttons.length,
            });
        };

        return (
            <form onSubmit={handleSubmit} className="ap-bg-gray-50 ap-rounded-lg ap-p-4 ap-space-y-4">
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Button Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="e.g., Report Issue"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Target URL</label>
                        <input
                            type="url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            required
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="https://example.com"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Button Color</label>
                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                            {colorOptions.map((color) => (
                                <Button
                                    key={color.value}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setFormData({ ...formData, color: color.value })}
                                    className={`!ap-p-0 !ap-min-h-0 ap-w-8 ap-h-8 ap-rounded-full ${color.class} ${
                                        formData.color === color.value 
                                            ? 'ap-ring-2 ap-ring-offset-2 ap-ring-gray-900' 
                                            : ''
                                    }`}
                                    title={color.label}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Thumbnail URL (Optional)</label>
                        <input
                            type="url"
                            value={formData.thumbnail_url}
                            onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="https://example.com/icon.png"
                        />
                    </div>
                </div>
                
                {/* Role Visibility */}
                <div>
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        <HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                        Visible to Roles
                    </label>
                    <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
                        Select which job roles can see this button. Leave empty to show to all users.
                    </p>
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        {jobRoles.map((role) => (
                            <Button
                                key={role.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRoleToggle(role.id)}
                                className={`!ap-rounded-full ${
                                    formData.visible_to_roles?.includes(role.id)
                                        ? '!ap-bg-blue-600 !ap-text-white' : '!ap-bg-gray-100 !ap-text-gray-700 hover:!ap-bg-gray-200'
                                }`}
                            >
                                {role.title}
                            </Button>
                        ))}
                    </div>
                    {formData.visible_to_roles.length === 0 && (
                        <p className="ap-text-xs ap-text-green-600 ap-mt-2">✓ This button will be visible to all users</p>
                    )}
                </div>

                <div className="ap-flex ap-justify-end ap-gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={saving}
                        isLoading={saving}
                        loadingText="Saving..."
                    >
                        <HiOutlineCheck className="ap-w-4 ap-h-4" />
                        Save Button
                    </Button>
                </div>
            </form>
        );
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">Action Buttons</h2>
                    <p className="ap-text-gray-600 ap-mt-1">Configure quick action buttons that appear on the dashboard.</p>
                </div>
                {!isAddingNew && !editingButton && (
                    <Button
                        variant="primary"
                        onClick={() => setIsAddingNew(true)}
                    >
                        <HiOutlinePlus className="ap-w-5 ap-h-5" />
                        Add Button
                    </Button>
                )}
            </div>

            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            {isAddingNew && (
                <ButtonForm onCancel={() => setIsAddingNew(false)} />
            )}

            {editingButton && (
                <ButtonForm button={editingButton} onCancel={() => setEditingButton(null)} />
            )}

            {buttons.length === 0 && !isAddingNew ? (
                <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg">
                    <HiOutlinePhoto className="ap-w-12 ap-h-12 ap-mx-auto ap-text-gray-400 ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-2">No Action Buttons</h3>
                    <p className="ap-text-gray-500 ap-mb-4">Add buttons to give users quick access to important links.</p>
                    <Button
                        variant="primary"
                        onClick={() => setIsAddingNew(true)}
                    >
                        Add Your First Button
                    </Button>
                </div>
            ) : (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
                    <div className="ap-px-4 ap-py-3 ap-border-b ap-border-gray-200 ap-bg-gray-50 ap-rounded-t-lg">
                        <div className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-500">
                            <HiOutlineArrowsUpDown className="ap-w-4 ap-h-4" />
                            Drag and drop to reorder buttons
                        </div>
                    </div>
                    <div className="ap-divide-y ap-divide-gray-200">
                        {buttons.map((button, index) => (
                            <div
                                key={button.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`ap-flex ap-items-center ap-gap-4 ap-px-4 ap-py-3 hover:ap-bg-gray-50 ap-cursor-move ${
                                    draggedItem === index ? 'ap-bg-blue-50' : ''
                                }`}
                            >
                                <HiOutlineBars3 className="ap-w-5 ap-h-5 ap-text-gray-400 ap-flex-shrink-0" />
                                
                                <div className="ap-flex ap-items-center ap-gap-3 ap-flex-1 ap-min-w-0">
                                    {button.thumbnail_url && (
                                        <img 
                                            src={button.thumbnail_url} 
                                            alt="" 
                                            className="ap-w-8 ap-h-8 ap-rounded ap-object-cover"
                                        />
                                    )}
                                    <div className="ap-flex-1 ap-min-w-0">
                                        <div className="ap-font-medium ap-text-gray-900 ap-truncate">{button.title}</div>
                                        <div className="ap-text-sm ap-text-gray-500 ap-truncate">{button.url}</div>
                                        {button.visible_to_roles && button.visible_to_roles.length > 0 ? (
                                            <div className="ap-flex ap-items-center ap-gap-1 ap-mt-1 ap-flex-wrap">
                                                <HiOutlineUserGroup className="ap-w-3 ap-h-3 ap-text-gray-400" />
                                                <span className="ap-text-xs ap-text-gray-500">
                                                    {button.visible_to_roles
                                                        .map(roleId => jobRoles.find(r => r.id === roleId)?.title || `Role ${roleId}`)
                                                        .join(', ')}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="ap-flex ap-items-center ap-gap-1 ap-mt-1">
                                                <HiOutlineUserGroup className="ap-w-3 ap-h-3 ap-text-green-500" />
                                                <span className="ap-text-xs ap-text-green-600">All users</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={`ap-w-6 ap-h-6 ap-rounded-full ${colorOptions.find(c => c.value === button.color)?.class || 'ap-bg-blue-600'}`} />

                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setEditingButton(button)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:!ap-text-blue-600 hover:!ap-bg-blue-50"
                                        title="Edit"
                                    >
                                        <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => deleteButton(button.id)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:!ap-text-red-600 hover:!ap-bg-red-50"
                                        title="Delete"
                                    >
                                        <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview Section */}
            {buttons.length > 0 && (
                <div className="ap-mt-8">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">Preview</h3>
                    <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-6">
                        <h4 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">Quick Actions</h4>
                        <div className="ap-flex ap-flex-wrap ap-gap-3">
                            {buttons.map((button) => {
                                const colorClass = colorOptions.find(c => c.value === button.color)?.class || 'bg-blue-600';
                                return (
                                    <span
                                        key={button.id}
                                        className={`ap-inline-flex ap-items-center ap-gap-2 ap-px-4 ap-py-3 ap-rounded-lg ap-font-medium ap-text-white ${colorClass}`}
                                    >
                                        {button.thumbnail_url && (
                                            <img 
                                                src={button.thumbnail_url} 
                                                alt="" 
                                                className="ap-w-6 ap-h-6 ap-rounded ap-object-cover"
                                            />
                                        )}
                                        <span>{button.title}</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionButtonsManagement;
