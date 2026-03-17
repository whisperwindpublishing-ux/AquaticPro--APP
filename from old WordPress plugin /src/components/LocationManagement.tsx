import React, { useState, useEffect } from 'react';
import { Location } from '@/types';
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/services/api';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineMapPin, HiOutlineChevronUp, HiOutlineChevronDown } from 'react-icons/hi2';

/**
 * LocationManagement component - Admin interface for managing location definitions
 * 
 * Features:
 * - View all locations (active and inactive)
 * - Create new locations
 * - Edit existing locations (name, description)
 * - Soft delete locations (deactivate)
 * 
 * Permissions: Tier 5/6 only
 */
export const LocationManagement: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    
    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    useEffect(() => {
        loadLocations();
    }, []);
    
    const loadLocations = async () => {
        setIsLoading(true);
        try {
            const locs = await getLocations();
            setLocations(locs);
        } catch (error) {
            console.error('Failed to load locations:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAdd = () => {
        setIsEditing(true);
        setEditingLocation(null);
        setName('');
        setDescription('');
    };
    
    const handleEdit = (location: Location) => {
        setIsEditing(true);
        setEditingLocation(location);
        setName(location.name);
        setDescription(location.description || '');
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setEditingLocation(null);
        setName('');
        setDescription('');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            alert('Please enter a location name');
            return;
        }
        
        setIsSaving(true);
        try {
            if (editingLocation) {
                // Update existing
                const updated = await updateLocation(editingLocation.id, {
                    name: name.trim(),
                    description: description.trim() || undefined
                });
                setLocations(prev => prev.map(loc => loc.id === updated.id ? updated : loc));
            } else {
                // Create new
                const created = await createLocation({
                    name: name.trim(),
                    description: description.trim() || undefined
                });
                setLocations(prev => [...prev, created]);
            }
            handleCancel();
        } catch (error) {
            console.error('Failed to save location:', error);
            alert('Failed to save location. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (location: Location) => {
        if (!confirm(`Are you sure you want to deactivate "${location.name}"?`)) {
            return;
        }
        
        try {
            await deleteLocation(location.id);
            setLocations(prev => prev.map(loc => 
                loc.id === location.id ? { ...loc, is_active: false } : loc
            ));
        } catch (error) {
            console.error('Failed to delete location:', error);
            alert('Failed to delete location. Please try again.');
        }
    };
    
    const handleMoveUp = async (location: Location) => {
        const currentIndex = locations.findIndex(l => l.id === location.id);
        if (currentIndex === 0) return; // Already at top
        
        const previousLocation = locations[currentIndex - 1];
        
        try {
            // Swap sort orders
            await updateLocation(location.id, { 
                name: location.name,
                description: location.description || '',
                sort_order: previousLocation.sort_order 
            });
            await updateLocation(previousLocation.id, { 
                name: previousLocation.name,
                description: previousLocation.description || '',
                sort_order: location.sort_order 
            });
            
            await loadLocations();
        } catch (error) {
            console.error('Failed to reorder locations:', error);
            alert('Failed to reorder locations. Please try again.');
        }
    };
    
    const handleMoveDown = async (location: Location) => {
        const currentIndex = locations.findIndex(l => l.id === location.id);
        if (currentIndex === locations.length - 1) return; // Already at bottom
        
        const nextLocation = locations[currentIndex + 1];
        
        try {
            // Swap sort orders
            await updateLocation(location.id, { 
                name: location.name,
                description: location.description || '',
                sort_order: nextLocation.sort_order 
            });
            await updateLocation(nextLocation.id, { 
                name: nextLocation.name,
                description: nextLocation.description || '',
                sort_order: location.sort_order 
            });
            
            await loadLocations();
        } catch (error) {
            console.error('Failed to reorder locations:', error);
            alert('Failed to reorder locations. Please try again.');
        }
    };
    
    if (isLoading) {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }
    
    // Sort locations by sort_order
    const sortedLocations = [...locations].sort((a, b) => a.sort_order - b.sort_order);
    
    return (
        <div className="ap-space-y-6">
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Location Management</h2>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                        Manage locations for daily logs (e.g., Station 1, Training Center, HQ)
                    </p>
                </div>
                {!isEditing && (
                    <Button
                        onClick={handleAdd}
                        variant="primary"
                    >
                        <HiOutlinePlus className="ap-h-5 ap-w-5" />
                        Add Location
                    </Button>
                )}
            </div>

            {/* Add/Edit Form */}
            {isEditing && (
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-p-6 ap-border-2 ap-border-blue-200">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">
                        {editingLocation ? 'Edit Location' : 'Add New Location'}
                    </h3>
                    <form onSubmit={handleSubmit} className="ap-space-y-4">
                        {/* Location form fields */}
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Location Name <span className="ap-text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Station 1, Headquarters"
                                className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Additional details about this location..."
                                className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                                rows={3}
                            />
                        </div>

                        <div className="ap-flex ap-gap-2">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                variant="primary"
                            >
                                {isSaving ? 'Saving...' : (editingLocation ? 'Update Location' : 'Add Location')}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleCancel}
                                variant="outline"
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Locations List */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-overflow-hidden">
                {locations.length === 0 ? (
                    <div className="ap-text-center ap-py-12 ap-text-gray-500">
                        No locations found. Click "Add Location" to create one.
                    </div>
                ) : (
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Order
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Location
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Description
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Status
                                </th>
                                <th className="ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {sortedLocations.map((location, index) => (
                                <tr key={location.id} className={!location.is_active ? 'opacity-50' : ''}>
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                        <div className="ap-flex ap-items-center ap-gap-1">
                                            <Button
                                                onClick={() => handleMoveUp(location)}
                                                disabled={index === 0}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600 hover:ap-text-gray-900"
                                                title="Move up"
                                            >
                                                <HiOutlineChevronUp className="ap-h-5 ap-w-5" />
                                            </Button>
                                            <Button
                                                onClick={() => handleMoveDown(location)}
                                                disabled={index === locations.length - 1}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-600 hover:ap-text-gray-900"
                                                title="Move down"
                                            >
                                                <HiOutlineChevronDown className="ap-h-5 ap-w-5" />
                                            </Button>
                                        </div>
                                    </td>
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                        <div className="ap-flex ap-items-center">
                                            <HiOutlineMapPin className="ap-h-5 ap-w-5 ap-text-blue-500 ap-mr-2" />
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {location.name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="ap-px-6 ap-py-4">
                                        <div className="ap-text-sm ap-text-gray-500">
                                            {location.description || '—'}
                                        </div>
                                    </td>
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                        <span className={`ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ${
                                            location.is_active 
                                                ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-red-100 ap-text-red-800'
                                        }`}>
                                            {location.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium">
                                        <div className="ap-flex ap-items-center ap-justify-end ap-gap-2">
                                            <Button
                                                onClick={() => handleEdit(location)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-text-blue-900"
                                                title="Edit location"
                                            >
                                                <HiOutlinePencil className="ap-h-5 ap-w-5" />
                                            </Button>
                                            {location.is_active && (
                                                <Button
                                                    onClick={() => handleDelete(location)}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1.5 !ap-min-h-0 ap-text-red-600 hover:ap-text-red-900"
                                                    title="Deactivate location"
                                                >
                                                    <HiOutlineTrash className="ap-h-5 ap-w-5" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default LocationManagement;
