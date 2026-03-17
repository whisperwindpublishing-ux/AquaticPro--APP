import React, { useState, useEffect } from 'react';
import { TimeSlotDefinition } from '@/types';
import { getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } from '@/services/api';
import LoadingSpinner from './LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineChevronUp, HiOutlineChevronDown } from 'react-icons/hi2';

/**
 * TimeSlotManagement component - Admin interface for managing time slot definitions
 * 
 * Features:
 * - View all time slots (active and inactive)
 * - Create new time slots
 * - Edit existing time slots (label, description, color)
 * - Soft delete time slots (deactivate)
 * - Drag-and-drop reordering (future enhancement)
 * 
 * Permissions: Tier 5/6 only
 */
export const TimeSlotManagement: React.FC = () => {
    const [timeSlots, setTimeSlots] = useState<TimeSlotDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingSlot, setEditingSlot] = useState<TimeSlotDefinition | null>(null);
    
    // Form state
    const [slug, setSlug] = useState('');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3B82F6');
    
    useEffect(() => {
        loadTimeSlots();
    }, []);
    
    const loadTimeSlots = async () => {
        setIsLoading(true);
        try {
            const slots = await getTimeSlots(false); // Get all including inactive
            setTimeSlots(slots);
        } catch (error) {
            console.error('Failed to load time slots:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAdd = () => {
        setIsEditing(true);
        setEditingSlot(null);
        setSlug('');
        setLabel('');
        setDescription('');
        setColor('#3B82F6');
    };
    
    const handleEdit = (slot: TimeSlotDefinition) => {
        setIsEditing(true);
        setEditingSlot(slot);
        setSlug(slot.slug);
        setLabel(slot.label);
        setDescription(slot.description || '');
        setColor(slot.color || '#3B82F6');
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setEditingSlot(null);
        setSlug('');
        setLabel('');
        setDescription('');
        setColor('#3B82F6');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!label.trim()) {
            alert('Please enter a label');
            return;
        }
        
        setIsSaving(true);
        try {
            if (editingSlot) {
                // Update existing
                const updated = await updateTimeSlot(editingSlot.id, {
                    label: label.trim(),
                    description: description.trim() || undefined,
                    color
                });
                setTimeSlots(prev => prev.map(s => s.id === updated.id ? updated : s));
            } else {
                // Create new
                const slugValue = slug.trim() || label.toLowerCase().replace(/\s+/g, '-');
                const created = await createTimeSlot({
                    slug: slugValue,
                    label: label.trim(),
                    description: description.trim() || undefined,
                    color
                });
                setTimeSlots(prev => [...prev, created]);
            }
            handleCancel();
        } catch (error) {
            console.error('Failed to save time slot:', error);
            alert('Failed to save time slot. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (slot: TimeSlotDefinition) => {
        if (!confirm(`Are you sure you want to deactivate "${slot.label}"?`)) {
            return;
        }
        
        try {
            await deleteTimeSlot(slot.id);
            setTimeSlots(prev => prev.map(s => 
                s.id === slot.id ? { ...s, isActive: false } : s
            ));
        } catch (error) {
            console.error('Failed to delete time slot:', error);
            alert('Failed to delete time slot. Please try again.');
        }
    };
    
    const handleMoveUp = async (slot: TimeSlotDefinition, index: number) => {
        if (index === 0) return; // Already at top
        
        const prevSlot = timeSlots[index - 1];
        const currentOrder = slot.sortOrder;
        const prevOrder = prevSlot.sortOrder;
        
        try {
            // Swap sort orders
            await updateTimeSlot(slot.id, { sortOrder: prevOrder });
            await updateTimeSlot(prevSlot.id, { sortOrder: currentOrder });
            
            // Reload list
            await loadTimeSlots();
        } catch (error) {
            console.error('Failed to reorder time slots:', error);
            alert('Failed to reorder time slots. Please try again.');
        }
    };
    
    const handleMoveDown = async (slot: TimeSlotDefinition, index: number) => {
        if (index === timeSlots.length - 1) return; // Already at bottom
        
        const nextSlot = timeSlots[index + 1];
        const currentOrder = slot.sortOrder;
        const nextOrder = nextSlot.sortOrder;
        
        try {
            // Swap sort orders
            await updateTimeSlot(slot.id, { sortOrder: nextOrder });
            await updateTimeSlot(nextSlot.id, { sortOrder: currentOrder });
            
            // Reload list
            await loadTimeSlots();
        } catch (error) {
            console.error('Failed to reorder time slots:', error);
            alert('Failed to reorder time slots. Please try again.');
        }
    };
    
    if (isLoading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }
    
    return (
        <div className="ap-space-y-6">
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">Time Slot Management</h2>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                        Customize time slots for daily logs (e.g., Morning, Afternoon, Evening)
                    </p>
                </div>
                {!isEditing && (
                    <Button
                        onClick={handleAdd}
                        variant="primary"
                        className="!ap-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlinePlus className="ap-h-5 ap-w-5" />
                        Add Time Slot
                    </Button>
                )}
            </div>
            
            {isEditing ? (
                <form onSubmit={handleSubmit} className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-6 ap-space-y-4">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                        {editingSlot ? 'Edit Time Slot' : 'New Time Slot'}
                    </h3>
                    
                    {!editingSlot && (
                        <div>
                            <label htmlFor="slug" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Slug (unique identifier)
                            </label>
                            <input
                                type="text"
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="ap-w-full ap-min-w-0 ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                placeholder="e.g., morning (leave blank to auto-generate)"
                            />
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="label" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Label *
                        </label>
                        <input
                            type="text"
                            id="label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="ap-w-full ap-min-w-0 ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="e.g., Morning Shift"
                            required
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="description" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="ap-w-full ap-min-w-0 ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            placeholder="e.g., 6:00 AM - 2:00 PM"
                            rows={2}
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="color" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Color
                        </label>
                        <div className="ap-flex ap-items-center ap-gap-3">
                            <input
                                type="color"
                                id="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="ap-h-10 ap-w-20 ap-border ap-border-gray-300 ap-rounded ap-cursor-pointer"
                            />
                            <span className="ap-text-sm ap-text-gray-600">{color}</span>
                        </div>
                    </div>
                    
                    <div className="ap-flex ap-items-center ap-gap-3 ap-pt-4">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : editingSlot ? 'Update' : 'Create'}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCancel}
                            variant="secondary"
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden">
                    <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Label
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Description
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Color
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Status
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Order
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {timeSlots.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="ap-px-6 ap-py-12 ap-text-center ap-text-sm ap-text-gray-500">
                                        No time slots yet. Click "Add Time Slot" to create one.
                                    </td>
                                </tr>
                            ) : (
                                timeSlots.map((slot, index) => (
                                    <tr key={slot.id} className={!slot.isActive ? 'opacity-50' : ''}>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-flex ap-items-center">
                                                <div
                                                    className="ap-w-3 ap-h-3 ap-rounded-full ap-mr-3"
                                                    style={{ backgroundColor: slot.color || '#3B82F6' }}
                                                />
                                                <span className="ap-text-sm ap-font-medium ap-text-gray-900">{slot.label}</span>
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4">
                                            <span className="ap-text-sm ap-text-gray-500">{slot.description || '-'}</span>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <span className="ap-text-xs ap-font-mono ap-text-gray-500">{slot.color || '#3B82F6'}</span>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <span className={`ap-px-2 ap-py-1 ap-inline-flex ap-text-xs ap-leading-5 ap-font-semibold ap-rounded-full ${
                                                slot.isActive
                                                    ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-gray-100 ap-text-gray-800'
                                            }`}>
                                                {slot.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-center">
                                            <div className="ap-flex ap-items-center ap-justify-center ap-gap-1">
                                                <Button
                                                    onClick={() => handleMoveUp(slot, index)}
                                                    disabled={index === 0}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 !ap-text-gray-600 hover:!ap-text-gray-900"
                                                    title="Move up"
                                                >
                                                    <HiOutlineChevronUp className="ap-h-5 ap-w-5" />
                                                </Button>
                                                <Button
                                                    onClick={() => handleMoveDown(slot, index)}
                                                    disabled={index === timeSlots.length - 1}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 !ap-text-gray-600 hover:!ap-text-gray-900"
                                                    title="Move down"
                                                >
                                                    <HiOutlineChevronDown className="ap-h-5 ap-w-5" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium">
                                            <Button
                                                variant="icon"
                                                onClick={() => handleEdit(slot)}
                                                className="ap-text-gray-400 hover:ap-text-blue-600 ap-mr-2"
                                                title="Edit"
                                            >
                                                <HiOutlinePencil className="ap-h-4 ap-w-4" />
                                            </Button>
                                            {slot.isActive && (
                                                <Button
                                                    variant="icon"
                                                    onClick={() => handleDelete(slot)}
                                                    className="ap-text-gray-400 hover:ap-text-red-500"
                                                    title="Deactivate"
                                                >
                                                    <HiOutlineTrash className="ap-h-4 ap-w-4" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeSlotManagement;
