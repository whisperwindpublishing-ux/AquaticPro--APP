import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import { 
    HiOutlineMapPin, 
    HiOutlinePlusCircle, 
    HiOutlineTrash,
    HiOutlineArrowRight,
    HiOutlineCalculator,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle
} from 'react-icons/hi2';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { getCachedUsers } from '@/services/userCache';

interface Location {
    id: number;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
}

interface BudgetAccount {
    id: number;
    account_code: string;
    account_name: string;
}

interface Stop {
    location_id?: number;
    custom_address?: string;
    distance_to_next?: number;
    location_name?: string;
    location_address?: string;
}

interface UserOption {
    id: number;
    display_name: string;
}

interface EntryData {
    id?: number;
    user_id?: number;
    trip_date: string;
    business_purpose: string;
    odometer_start: number | null;
    odometer_end: number | null;
    calculated_miles: number;
    tolls: number;
    parking: number;
    budget_account_id: number | null;
    notes: string;
    stops: Stop[];
}

interface MileageEntryFormProps {
    entryId?: number | null;
    canManage?: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

const MileageEntryForm: React.FC<MileageEntryFormProps> = ({ entryId, canManage = false, onSuccess, onCancel }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [allUsers, setAllUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Get local date in YYYY-MM-DD format (user's timezone, not server)
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [formData, setFormData] = useState<EntryData>({
        trip_date: getLocalDateString(),
        business_purpose: '',
        odometer_start: null,
        odometer_end: null,
        calculated_miles: 0,
        tolls: 0,
        parking: 0,
        budget_account_id: null,
        notes: '',
        stops: [
            { location_id: undefined, custom_address: '' },
            { location_id: undefined, custom_address: '' }
        ]
    });

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        loadData();
        if (canManage) {
            loadAllUsers();
        }
    }, []);

    const loadAllUsers = async () => {
        try {
            const cachedUsers = await getCachedUsers();
            setAllUsers(cachedUsers.map(u => ({ id: u.user_id, display_name: u.display_name })));
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    useEffect(() => {
        if (entryId) {
            loadEntry(entryId);
        }
    }, [entryId]);

    const loadData = async () => {
        try {
            const [locRes, budgetRes, settingsRes] = await Promise.all([
                fetch(`${apiUrl}/mileage/locations`, { headers: { 'X-WP-Nonce': nonce } }),
                fetch(`${apiUrl}/mileage/budget-accounts`, { headers: { 'X-WP-Nonce': nonce } }),
                fetch(`${apiUrl}/mileage/settings`, { headers: { 'X-WP-Nonce': nonce } })
            ]);

            if (locRes.ok) setLocations(await locRes.json());
            if (budgetRes.ok) setBudgetAccounts(await budgetRes.json());
            if (settingsRes.ok) setSettings(await settingsRes.json());
        } catch (err) {
            console.error('Failed to load form data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadEntry = async (id: number) => {
        try {
            const response = await fetch(`${apiUrl}/mileage/entries/${id}`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            if (response.ok) {
                const entry = await response.json();
                setFormData({
                    user_id: entry.user_id ? parseInt(entry.user_id) : undefined,
                    trip_date: entry.trip_date,
                    business_purpose: entry.business_purpose || '',
                    odometer_start: entry.odometer_start,
                    odometer_end: entry.odometer_end,
                    calculated_miles: parseInt(entry.calculated_miles) || 0,
                    tolls: parseFloat(entry.tolls) || 0,
                    parking: parseFloat(entry.parking) || 0,
                    budget_account_id: entry.budget_account_id,
                    notes: entry.notes || '',
                    stops: entry.stops?.length > 0 ? entry.stops.map((s: Stop) => ({
                        location_id: s.location_id,
                        custom_address: s.custom_address || '',
                        distance_to_next: s.distance_to_next || 0,
                        location_name: s.location_name,
                        location_address: s.location_address
                    })) : [
                        { location_id: undefined, custom_address: '' },
                        { location_id: undefined, custom_address: '' }
                    ]
                });
            }
        } catch (err) {
            console.error('Failed to load entry:', err);
            setError('Failed to load entry');
        }
    };

    const addStop = () => {
        setFormData(prev => ({
            ...prev,
            stops: [...prev.stops, { location_id: undefined, custom_address: '' }]
        }));
    };

    const removeStop = (index: number) => {
        if (formData.stops.length <= 2) return;
        setFormData(prev => ({
            ...prev,
            stops: prev.stops.filter((_, i) => i !== index)
        }));
    };

    const updateStop = (index: number, field: 'location_id' | 'custom_address', value: number | string | undefined) => {
        setFormData(prev => ({
            ...prev,
            stops: prev.stops.map((stop, i) => {
                if (i !== index) return stop;
                if (field === 'location_id') {
                    return { ...stop, location_id: value as number | undefined, custom_address: '' };
                }
                return { ...stop, [field]: value, location_id: undefined };
            })
        }));
    };

    const calculateDistance = async () => {
        // Validate stops have addresses
        const validStops = formData.stops.filter(s => s.location_id || s.custom_address?.trim());
        if (validStops.length < 2) {
            setError('Please add at least 2 stops with addresses');
            return;
        }

        setCalculating(true);
        setError(null);

        try {
            // Geocode custom addresses before sending to API
            const stopsWithCoords = await Promise.all(validStops.map(async (stop) => {
                // If it's a preset location, backend will handle coordinates
                if (stop.location_id) {
                    return stop;
                }
                
                // If it's a custom address, try to validate/geocode it first
                if (stop.custom_address) {
                    const trimmed = stop.custom_address.trim();
                    // Basic address validation - must have at least a number and street/city
                    if (trimmed.length < 5) {
                        throw new Error(`Address "${trimmed}" is too short. Please provide a complete address.`);
                    }
                    
                    // Return the stop with trimmed address
                    return {
                        ...stop,
                        custom_address: trimmed
                    };
                }
                
                return stop;
            }));

            const response = await fetch(`${apiUrl}/mileage/calculate-distance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce
                },
                body: JSON.stringify({ stops: stopsWithCoords })
            });

            if (response.ok) {
                const result = await response.json();
                
                // Check if we got a valid distance
                if (result.total_miles === 0) {
                    setError('Could not calculate distance. Please verify addresses are complete and valid (e.g., "123 Main St, City, State ZIP")');
                } else {
                    setFormData(prev => ({
                        ...prev,
                        calculated_miles: result.total_miles
                    }));
                }
            } else {
                const err = await response.json();
                setError(err.message || 'Failed to calculate distance. Please verify all addresses are complete.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to calculate distance. Please verify all addresses are complete.');
        } finally {
            setCalculating(false);
        }
    };

    // Auto-calculate odometer start when odometer end is entered and we have calculated miles
    useEffect(() => {
        if (formData.odometer_end !== null && formData.calculated_miles > 0 && formData.odometer_start === null) {
            const calculatedStart = formData.odometer_end - formData.calculated_miles;
            if (calculatedStart >= 0) {
                setFormData(prev => ({ ...prev, odometer_start: calculatedStart }));
            }
        }
    }, [formData.odometer_end, formData.calculated_miles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const url = entryId 
                ? `${apiUrl}/mileage/entries/${entryId}`
                : `${apiUrl}/mileage/entries`;
            
            const method = entryId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce
                },
                body: JSON.stringify({
                    ...formData,
                    ...(canManage && formData.user_id ? { user_id: formData.user_id } : {}),
                    stops: formData.stops.filter(s => s.location_id || s.custom_address)
                })
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            } else {
                const err = await response.json();
                setError(err.message || 'Failed to save entry');
            }
        } catch (err) {
            setError('Failed to save entry');
        } finally {
            setSaving(false);
        }
    };

    const getStopAddress = (stop: Stop): string => {
        if (stop.location_id && stop.location_id > 0) {
            const loc = locations.find(l => l.id === stop.location_id);
            return loc ? loc.name : '';
        }
        return stop.custom_address?.trim() || '';
    };

    // Check if a stop has valid address data
    const hasValidAddress = (stop: Stop): boolean => {
        if (stop.location_id && stop.location_id > 0) {
            return locations.some(l => l.id === stop.location_id);
        }
        return !!(stop.custom_address?.trim());
    };

    // Get stops that have actual addresses
    const validStops = formData.stops.filter(hasValidAddress);

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-8 ap-text-center">
                <HiOutlineCheckCircle className="ap-w-16 ap-h-16 ap-text-green-500 ap-mx-auto ap-mb-4" />
                <h3 className="ap-text-lg ap-font-semibold ap-text-green-800">
                    {entryId ? 'Entry Updated!' : 'Trip Logged!'}
                </h3>
                <p className="ap-text-green-600 ap-mt-2">Your mileage entry has been saved successfully.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="ap-max-w-4xl">
            <Card>
                <Card.Body>
                    <h2 className="ap-text-xl ap-font-semibold ap-text-gray-900 ap-mb-6">
                        {entryId ? 'Edit Mileage Entry' : 'Log New Trip'}
                    </h2>

                {error && (
                    <div className="ap-mb-6 ap-p-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-flex ap-items-center ap-gap-3 ap-text-red-700">
                        <HiOutlineExclamationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Reassign Author (admin/tier6 only) */}
                {canManage && entryId && (
                    <div className="ap-mb-6 ap-p-4 ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-amber-800 ap-mb-1">
                            Assigned Employee
                        </label>
                        <select
                            value={formData.user_id || ''}
                            onChange={e => setFormData(prev => ({ ...prev, user_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-amber-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-amber-500 focus:ap-border-amber-500 ap-bg-white"
                        >
                            <option value="">— Select employee —</option>
                            {allUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.display_name}</option>
                            ))}
                        </select>
                        <p className="ap-text-xs ap-text-amber-600 ap-mt-1">Change which employee this mileage record belongs to.</p>
                    </div>
                )}

                {/* Basic Info */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-6 ap-mb-6">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Trip Date <span className="ap-text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.trip_date}
                            onChange={e => setFormData(prev => ({ ...prev, trip_date: e.target.value }))}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Budget Account
                        </label>
                        <select
                            value={formData.budget_account_id || ''}
                            onChange={e => setFormData(prev => ({ ...prev, budget_account_id: e.target.value ? parseInt(e.target.value) : null }))}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        >
                            <option value="">Select budget account...</option>
                            {budgetAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.account_code} - {acc.account_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="ap-mb-6">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Business Purpose / Destination
                    </label>
                    {settings.preset_purposes ? (
                        <div className="ap-space-y-2">
                            <select
                                value={settings.preset_purposes.split('\n').includes(formData.business_purpose) ? formData.business_purpose : ''}
                                onChange={e => {
                                    if (e.target.value) {
                                        setFormData(prev => ({ ...prev, business_purpose: e.target.value }));
                                    }
                                }}
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            >
                                <option value="">-- Select a purpose or enter custom --</option>
                                {settings.preset_purposes.split('\n').filter(p => p.trim()).map(purpose => (
                                    <option key={purpose} value={purpose.trim()}>
                                        {purpose.trim()}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={formData.business_purpose}
                                onChange={e => setFormData(prev => ({ ...prev, business_purpose: e.target.value }))}
                                placeholder="Or type custom purpose..."
                                className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={formData.business_purpose}
                            onChange={e => setFormData(prev => ({ ...prev, business_purpose: e.target.value }))}
                            placeholder="e.g., Meeting at City Hall, Training at Recreation Center"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    )}
                </div>

                {/* Route Builder */}
                <div className="ap-mb-6">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">
                            Route Stops
                        </label>
                        <Button
                            type="button"
                            onClick={addStop}
                            variant="ghost"
                            size="sm"
                            className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-flex !ap-items-center !ap-gap-1"
                        >
                            <HiOutlinePlusCircle className="ap-w-4 ap-h-4" />
                            Add Stop
                        </Button>
                    </div>
                    
                    <div className="ap-space-y-3">
                        {formData.stops.map((stop, index) => (
                            <div key={index} className="ap-flex ap-items-center ap-gap-3">
                                <div className="ap-flex-shrink-0 ap-w-8 ap-h-8 ap-rounded-full ap-bg-blue-100 ap-text-blue-600 ap-flex ap-items-center ap-justify-center ap-text-sm ap-font-medium">
                                    {index + 1}
                                </div>
                                
                                <div className="ap-flex-1 ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-2">
                                    <select
                                        value={stop.location_id || ''}
                                        onChange={e => updateStop(index, 'location_id', e.target.value ? parseInt(e.target.value) : undefined)}
                                        className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    >
                                        <option value="">Select preset location...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                    
                                    <AddressAutocomplete
                                        value={stop.custom_address || ''}
                                        onChange={(value) => updateStop(index, 'custom_address', value)}
                                        placeholder="Or search for address..."
                                        disabled={!!stop.location_id}
                                    />
                                </div>
                                
                                {index < formData.stops.length - 1 && (
                                    <HiOutlineArrowRight className="ap-w-5 ap-h-5 ap-text-gray-400 ap-flex-shrink-0" />
                                )}
                                
                                {formData.stops.length > 2 && (
                                    <Button
                                        type="button"
                                        onClick={() => removeStop(index)}
                                        variant="ghost"
                                        size="xs"
                                        className="!ap-p-2 !ap-text-gray-400 hover:!ap-text-red-500 !ap-min-h-0"
                                    >
                                        <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Route Preview */}
                    {validStops.length > 0 && (
                        <div className="ap-mt-3 ap-p-3 ap-bg-gray-50 ap-rounded-lg">
                            <div className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600 ap-flex-wrap">
                                <HiOutlineMapPin className="ap-w-4 ap-h-4" />
                                {validStops.map((s, i, arr) => (
                                    <React.Fragment key={i}>
                                        <span className="ap-font-medium">{getStopAddress(s)}</span>
                                        {i < arr.length - 1 && <span className="ap-text-gray-400">→</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button
                        type="button"
                        onClick={calculateDistance}
                        disabled={calculating}
                        variant="secondary"
                        className="!ap-mt-3 !ap-px-4 !ap-py-2 !ap-bg-blue-100 !ap-text-blue-700 hover:!ap-bg-blue-200 !ap-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlineCalculator className="ap-w-5 ap-h-5" />
                        {calculating ? 'Calculating...' : 'Calculate Distance'}
                    </Button>
                </div>

                {/* Odometer & Mileage */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-6 ap-mb-6">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Trip Mileage
                        </label>
                        <input
                            type="number"
                            value={formData.calculated_miles}
                            readOnly
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg ap-bg-blue-50 ap-font-semibold ap-text-lg ap-text-blue-700 ap-cursor-not-allowed"
                            min="0"
                        />
                        <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Calculated from route stops</p>
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Odometer End
                        </label>
                        <input
                            type="number"
                            value={formData.odometer_end ?? ''}
                            onChange={e => setFormData(prev => ({ 
                                ...prev, 
                                odometer_end: e.target.value ? parseInt(e.target.value) : null,
                                odometer_start: null // Reset start so it auto-calculates
                            }))}
                            placeholder="Ending reading (optional)"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Odometer Start
                        </label>
                        <input
                            type="number"
                            value={formData.odometer_start ?? ''}
                            readOnly={formData.odometer_end !== null && formData.calculated_miles > 0}
                            onChange={e => setFormData(prev => ({ ...prev, odometer_start: e.target.value ? parseInt(e.target.value) : null }))}
                            placeholder={formData.odometer_end !== null && formData.calculated_miles > 0 ? "Auto-calculated" : "Starting reading (optional)"}
                            className={`ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ${
                                formData.odometer_end !== null && formData.calculated_miles > 0 ? 'ap-bg-gray-100 ap-cursor-not-allowed' : ''
                            }`}
                        />
                        {formData.odometer_end !== null && formData.calculated_miles > 0 && (
                            <p className="ap-text-xs ap-text-gray-500 ap-mt-1">Auto-calculated from end - mileage</p>
                        )}
                    </div>
                </div>

                {/* Tolls & Parking */}
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-6 ap-mb-6">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Tolls ($)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.tolls || ''}
                            onChange={e => setFormData(prev => ({ ...prev, tolls: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Parking ($)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.parking || ''}
                            onChange={e => setFormData(prev => ({ ...prev, parking: parseFloat(e.target.value) || 0 }))}
                            placeholder="0.00"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="ap-mb-6">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Notes
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        placeholder="Any additional notes..."
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                    />
                </div>

                {/* Actions */}
                <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-pt-4 ap-border-t">
                    {entryId && (
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="ghost"
                            className="!ap-px-4 !ap-py-2 !ap-text-gray-700 hover:!ap-text-gray-900"
                        >
                            Cancel
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={saving}
                        variant="primary"
                        className="!ap-px-6 !ap-py-2 !ap-flex !ap-items-center !ap-gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-2 ap-border-white ap-border-t-transparent"></div>
                                Saving...
                            </>
                        ) : (
                            entryId ? 'Update Entry' : 'Save Trip'
                        )}
                    </Button>
                </div>
                </Card.Body>
            </Card>
        </form>
    );
};

export default MileageEntryForm;
