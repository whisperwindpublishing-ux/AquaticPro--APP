import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { Button } from '../ui';
import {
    HiOutlinePlusCircle,
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlineMapPin,
    HiOutlineBuildingOffice2,
    HiOutlineCurrencyDollar,
    HiOutlineUserGroup,
    HiOutlineCheckCircle
} from 'react-icons/hi2';
import { getJobRoles } from '@/services/api-professional-growth';

interface PresetLocation {
    id: number;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    is_active: boolean;
}

interface BudgetAccount {
    id: number;
    account_code: string;
    account_name: string;
    is_active: boolean;
}

interface MileageSettings {
    rate_per_mile: string;
    ors_api_key: string;
    preset_purposes: string;
}

interface Permission {
    role_id: number;
    role_name: string;
    can_submit: boolean;
    can_view_all: boolean;
    can_manage: boolean;
}

// Using JobRole from api-professional-growth.ts - has id and title
interface LocalJobRole {
    id: number;
    title: string;
}

const MileageSettings: React.FC = () => {
    const [settings, setSettings] = useState<MileageSettings>({
        rate_per_mile: '0.70',
        ors_api_key: '',
        preset_purposes: ''
    });
    const [locations, setLocations] = useState<PresetLocation[]>([]);
    const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
    const [_permissions, setPermissions] = useState<Permission[]>([]);
    const [jobRoles, setJobRoles] = useState<LocalJobRole[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // Separate state for tracking unsaved permission changes
    const [localPermissions, setLocalPermissions] = useState<Permission[]>([]);
    const [permissionsChanged, setPermissionsChanged] = useState(false);
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [permissionsSaveSuccess, setPermissionsSaveSuccess] = useState(false);

    // Edit states
    const [editingLocation, setEditingLocation] = useState<Partial<PresetLocation> | null>(null);
    const [editingAccount, setEditingAccount] = useState<Partial<BudgetAccount> | null>(null);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [settingsRes, locationsRes, accountsRes, permissionsRes, rolesData] = await Promise.all([
                fetch(`${apiUrl}/mileage/settings`, { headers: { 'X-WP-Nonce': nonce } }),
                fetch(`${apiUrl}/mileage/locations`, { headers: { 'X-WP-Nonce': nonce } }),
                fetch(`${apiUrl}/mileage/budget-accounts`, { headers: { 'X-WP-Nonce': nonce } }),
                fetch(`${apiUrl}/mileage/permissions`, { headers: { 'X-WP-Nonce': nonce } }),
                getJobRoles()
            ]);

            if (settingsRes.ok) setSettings(await settingsRes.json());
            if (locationsRes.ok) setLocations(await locationsRes.json());
            if (accountsRes.ok) setBudgetAccounts(await accountsRes.json());
            if (permissionsRes.ok) {
                const permsData = await permissionsRes.json();
                // Ensure boolean values (API may return '0'/'1' strings or numbers from MySQL)
                const normalizedPerms = permsData.map((perm: any) => ({
                    ...perm,
                    can_submit: perm.can_submit === true || perm.can_submit === 1 || perm.can_submit === '1',
                    can_view_all: perm.can_view_all === true || perm.can_view_all === 1 || perm.can_view_all === '1',
                    can_manage: perm.can_manage === true || perm.can_manage === 1 || perm.can_manage === '1',
                }));
                setPermissions(normalizedPerms);
                setLocalPermissions(normalizedPerms);
            }
            setJobRoles(rolesData);
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const response = await fetch(`${apiUrl}/mileage/settings`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    // Location Management
    const saveLocation = async () => {
        if (!editingLocation?.name || !editingLocation?.address) return;

        try {
            const method = editingLocation.id ? 'PUT' : 'POST';
            const url = editingLocation.id
                ? `${apiUrl}/mileage/locations/${editingLocation.id}`
                : `${apiUrl}/mileage/locations`;

            const response = await fetch(url, {
                method,
                headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify(editingLocation)
            });

            if (response.ok) {
                const savedLocation = await response.json();
                if (editingLocation.id) {
                    setLocations(prev => prev.map(l => l.id === savedLocation.id ? savedLocation : l));
                } else {
                    setLocations(prev => [...prev, savedLocation]);
                }
                setEditingLocation(null);
            }
        } catch (err) {
            console.error('Failed to save location:', err);
        }
    };

    const deleteLocation = async (id: number) => {
        if (!confirm('Delete this location?')) return;

        try {
            const response = await fetch(`${apiUrl}/mileage/locations/${id}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce }
            });

            if (response.ok) {
                setLocations(prev => prev.filter(l => l.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete location:', err);
        }
    };

    // Budget Account Management
    const saveBudgetAccount = async () => {
        if (!editingAccount?.account_code || !editingAccount?.account_name) return;

        try {
            const method = editingAccount.id ? 'PUT' : 'POST';
            const url = editingAccount.id
                ? `${apiUrl}/mileage/budget-accounts/${editingAccount.id}`
                : `${apiUrl}/mileage/budget-accounts`;

            const response = await fetch(url, {
                method,
                headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify(editingAccount)
            });

            if (response.ok) {
                const savedAccount = await response.json();
                if (editingAccount.id) {
                    setBudgetAccounts(prev => prev.map(a => a.id === savedAccount.id ? savedAccount : a));
                } else {
                    setBudgetAccounts(prev => [...prev, savedAccount]);
                }
                setEditingAccount(null);
            }
        } catch (err) {
            console.error('Failed to save budget account:', err);
        }
    };

    const deleteBudgetAccount = async (id: number) => {
        if (!confirm('Delete this budget account?')) return;

        try {
            const response = await fetch(`${apiUrl}/mileage/budget-accounts/${id}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce }
            });

            if (response.ok) {
                setBudgetAccounts(prev => prev.filter(a => a.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete budget account:', err);
        }
    };

    // Permission Management - Local state updates (no auto-save)
    const updateLocalPermission = (roleId: number, field: 'can_submit' | 'can_view_all' | 'can_manage', value: boolean) => {
        setLocalPermissions(prev => {
            const existing = prev.find(p => p.role_id === roleId);
            if (existing) {
                return prev.map(p =>
                    p.role_id === roleId ? { ...p, [field]: value } : p
                );
            } else {
                const roleName = jobRoles.find(r => r.id === roleId)?.title || '';
                return [...prev, {
                    role_id: roleId,
                    role_name: roleName,
                    can_submit: field === 'can_submit' ? value : false,
                    can_view_all: field === 'can_view_all' ? value : false,
                    can_manage: field === 'can_manage' ? value : false
                }];
            }
        });
        setPermissionsChanged(true);
        setPermissionsSaveSuccess(false);
    };

    const savePermissions = async () => {
        setSavingPermissions(true);
        setPermissionsSaveSuccess(false);
        try {
            // Build array of all permissions for all roles
            const allPermissions = jobRoles.map(role => {
                const perm = localPermissions.find(p => p.role_id === role.id);
                return {
                    role_id: role.id,
                    can_submit: perm?.can_submit ?? false,
                    can_view_all: perm?.can_view_all ?? false,
                    can_manage: perm?.can_manage ?? false
                };
            });

            console.log('[MileageSettings] Saving permissions:', allPermissions);

            const response = await fetch(`${apiUrl}/mileage/permissions`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify(allPermissions)
            });

            if (response.ok) {
                const updatedPerms = await response.json();
                
                // Log debug headers
                console.log('[MileageSettings] Response headers:', {
                    sql: response.headers.get('X-Debug-SQL') ? atob(response.headers.get('X-Debug-SQL')!) : 'N/A',
                    resultCount: response.headers.get('X-Debug-Result-Count'),
                    tables: response.headers.get('X-Debug-Tables'),
                    error: response.headers.get('X-Debug-Error') ? atob(response.headers.get('X-Debug-Error')!) : 'None'
                });
                
                console.log('[MileageSettings] Response from API:', updatedPerms);
                
                // Normalize the response data to ensure booleans
                const normalizedPerms = updatedPerms.map((perm: any) => ({
                    ...perm,
                    can_submit: perm.can_submit === true || perm.can_submit === 1 || perm.can_submit === '1',
                    can_view_all: perm.can_view_all === true || perm.can_view_all === 1 || perm.can_view_all === '1',
                    can_manage: perm.can_manage === true || perm.can_manage === 1 || perm.can_manage === '1',
                }));
                
                console.log('[MileageSettings] Normalized permissions:', normalizedPerms);
                
                setPermissions(normalizedPerms);
                setLocalPermissions(normalizedPerms);
                setPermissionsChanged(false);
                setPermissionsSaveSuccess(true);
                setTimeout(() => setPermissionsSaveSuccess(false), 3000);
            } else {
                const errorData = await response.json();
                console.error('Failed to save permissions:', errorData);
                alert('Failed to save permissions. Please try again.');
            }
        } catch (err) {
            console.error('Failed to save permissions:', err);
            alert('Failed to save permissions. Please try again.');
        } finally {
            setSavingPermissions(false);
        }
    };

    const getRolePermission = (roleId: number) => {
        const found = localPermissions.find(p => p.role_id === roleId);
        if (found) {
            // Ensure boolean values (API returns '0'/'1' strings from MySQL)
            const f = found as any;
            return {
                ...found,
                can_submit: f.can_submit === true || f.can_submit === 1 || f.can_submit === '1',
                can_view_all: f.can_view_all === true || f.can_view_all === 1 || f.can_view_all === '1',
                can_manage: f.can_manage === true || f.can_manage === 1 || f.can_manage === '1',
            };
        }
        return {
            role_id: roleId,
            role_name: '',
            can_submit: false,
            can_view_all: false,
            can_manage: false
        };
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-8">
            {/* Rate Settings */}
            <Card>
                <Card.Body>
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-mb-4 ap-flex ap-items-center ap-gap-2">
                        <HiOutlineCurrencyDollar className="ap-w-5 ap-h-5 ap-text-green-600" />
                        Reimbursement Rate
                    </h2>
                <div className="ap-max-w-sm">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Rate Per Mile ($)
                    </label>
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={settings.rate_per_mile}
                            onChange={e => setSettings(prev => ({ ...prev, rate_per_mile: e.target.value }))}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 ap-w-32"
                        />
                    </div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-2">
                        Current IRS standard rate for 2024: $0.67/mile
                    </p>
                </div>

                <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        OpenRouteService API Key
                    </label>
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <input
                            type="password"
                            placeholder="Enter your ORS API key for driving distances"
                            value={settings.ors_api_key || ''}
                            onChange={e => setSettings(prev => ({ ...prev, ors_api_key: e.target.value }))}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 ap-flex-1 ap-max-w-md"
                        />
                    </div>
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-2">
                        Get a free API key at <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noopener noreferrer" className="ap-text-blue-600 hover:ap-underline">openrouteservice.org</a>. 
                        Without a key, distances use straight-line estimation.
                    </p>
                </div>

                <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Preset Trip Purposes
                    </label>
                    <textarea
                        placeholder="Enter one purpose per line, e.g.:\nTraining\nMeeting\nSite Visit\nDelivery"
                        value={settings.preset_purposes || ''}
                        onChange={e => setSettings(prev => ({ ...prev, preset_purposes: e.target.value }))}
                        rows={4}
                        className="ap-w-full ap-max-w-md ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                    />
                    <p className="ap-text-xs ap-text-gray-500 ap-mt-2">
                        Enter one trip purpose per line. These will appear as quick-select options when logging trips.
                    </p>
                </div>

                <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                    <Button
                        variant="primary"
                        onClick={saveSettings}
                        disabled={saving}
                    >
                        {saveSuccess ? (
                            <>
                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                Saved!
                            </>
                        ) : saving ? (
                            <>
                                <div className="ap-w-4 ap-h-4 ap-animate-spin ap-rounded-full ap-border-2 ap-border-white ap-border-t-transparent"></div>
                                Saving...
                            </>
                        ) : (
                            'Save All Settings'
                        )}
                    </Button>
                </div>
                </Card.Body>
            </Card>

            {/* Preset Locations */}
            <Card>
                <Card.Body>
                    <div className="ap-flex ap-justify-between ap-items-center ap-mb-4">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineMapPin className="ap-w-5 ap-h-5 ap-text-blue-600" />
                            Preset Locations
                        </h2>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setEditingLocation({ name: '', address: '', is_active: true })}
                    >
                        <HiOutlinePlusCircle className="ap-w-4 ap-h-4" />
                        Add Location
                    </Button>
                </div>

                {editingLocation && (
                    <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-mb-4">
                        <h3 className="ap-font-medium ap-mb-3">{editingLocation.id ? 'Edit Location' : 'New Location'}</h3>
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4 ap-mb-3">
                            <input
                                type="text"
                                placeholder="Location Name (e.g., 'Main Office')"
                                value={editingLocation.name || ''}
                                onChange={e => setEditingLocation(prev => ({ ...prev, name: e.target.value }))}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                            />
                            <input
                                type="text"
                                placeholder="Full Address"
                                value={editingLocation.address || ''}
                                onChange={e => setEditingLocation(prev => ({ ...prev, address: e.target.value }))}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                            />
                        </div>
                        <div className="ap-flex ap-gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={saveLocation}
                            >
                                Save
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingLocation(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="ap-space-y-2">
                    {locations.length === 0 ? (
                        <p className="ap-text-gray-500 ap-text-center ap-py-4">No preset locations configured</p>
                    ) : (
                        locations.map(loc => (
                            <div
                                key={loc.id}
                                className="ap-flex ap-items-center ap-justify-between ap-p-3 ap-bg-gray-50 ap-rounded-lg"
                            >
                                <div>
                                    <div className="ap-font-medium ap-text-gray-800">{loc.name}</div>
                                    <div className="ap-text-sm ap-text-gray-500">{loc.address}</div>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setEditingLocation(loc)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:ap-text-blue-600"
                                    >
                                        <HiOutlinePencilSquare className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => deleteLocation(loc.id)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:ap-text-red-600"
                                    >
                                        <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                </Card.Body>
            </Card>

            {/* Budget Accounts */}
            <Card>
                <Card.Body>
                    <div className="ap-flex ap-justify-between ap-items-center ap-mb-4">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineBuildingOffice2 className="ap-w-5 ap-h-5 ap-text-purple-600" />
                            Budget Accounts
                        </h2>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setEditingAccount({ account_code: '', account_name: '', is_active: true })}
                        className="!ap-bg-purple-600 hover:!ap-bg-purple-700"
                    >
                        <HiOutlinePlusCircle className="ap-w-4 ap-h-4" />
                        Add Account
                    </Button>
                </div>

                {editingAccount && (
                    <div className="ap-bg-purple-50 ap-border ap-border-purple-200 ap-rounded-lg ap-p-4 ap-mb-4">
                        <h3 className="ap-font-medium ap-mb-3">{editingAccount.id ? 'Edit Account' : 'New Budget Account'}</h3>
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4 ap-mb-3">
                            <input
                                type="text"
                                placeholder="Account Code (e.g., '10-5410')"
                                value={editingAccount.account_code || ''}
                                onChange={e => setEditingAccount(prev => ({ ...prev, account_code: e.target.value }))}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                            />
                            <input
                                type="text"
                                placeholder="Account Name"
                                value={editingAccount.account_name || ''}
                                onChange={e => setEditingAccount(prev => ({ ...prev, account_name: e.target.value }))}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                            />
                        </div>
                        <div className="ap-flex ap-gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={saveBudgetAccount}
                                className="!ap-bg-purple-600 hover:!ap-bg-purple-700"
                            >
                                Save
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingAccount(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="ap-space-y-2">
                    {budgetAccounts.length === 0 ? (
                        <p className="ap-text-gray-500 ap-text-center ap-py-4">No budget accounts configured</p>
                    ) : (
                        budgetAccounts.map(acc => (
                            <div
                                key={acc.id}
                                className="ap-flex ap-items-center ap-justify-between ap-p-3 ap-bg-gray-50 ap-rounded-lg"
                            >
                                <div>
                                    <span className="ap-font-mono ap-text-sm ap-bg-gray-200 ap-px-2 ap-py-0.5 ap-rounded ap-mr-2">
                                        {acc.account_code}
                                    </span>
                                    <span className="ap-font-medium ap-text-gray-800">{acc.account_name}</span>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setEditingAccount(acc)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:ap-text-purple-600"
                                    >
                                        <HiOutlinePencilSquare className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => deleteBudgetAccount(acc.id)}
                                        className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-500 hover:ap-text-red-600"
                                    >
                                        <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                </Card.Body>
            </Card>

            {/* Role Permissions */}
            <Card>
                <Card.Body>
                    <div className="ap-flex ap-justify-between ap-items-center ap-mb-4">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineUserGroup className="ap-w-5 ap-h-5 ap-text-orange-600" />
                            Role Permissions
                        </h2>
                    <div className="ap-flex ap-items-center ap-gap-3">
                        {permissionsSaveSuccess && (
                            <span className="ap-text-sm ap-text-green-600 ap-flex ap-items-center ap-gap-1">
                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                Saved!
                            </span>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={savePermissions}
                            disabled={!permissionsChanged || savingPermissions}
                            className={permissionsChanged ? '!ap-bg-orange-600 hover:!ap-bg-orange-700' : ''}
                        >
                            {savingPermissions ? (
                                <>
                                    <div className="ap-animate-spin ap-rounded-full ap-h-4 ap-w-4 ap-border-b-2 ap-border-white"></div>
                                    Saving...
                                </>
                            ) : (
                                'Save Permissions'
                            )}
                        </Button>
                    </div>
                </div>
                <p className="ap-text-sm ap-text-gray-500 ap-mb-4">
                    Configure which job roles can access mileage reimbursement features. Changes are not saved until you click "Save Permissions".
                </p>

                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Job Role</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Can Submit</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Can View All</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Can Manage</th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-200">
                            {jobRoles.map(role => {
                                const perm = getRolePermission(role.id);
                                return (
                                    <tr key={role.id} className="hover:ap-bg-gray-50">
                                        <td className="ap-px-4 ap-py-3 ap-text-sm ap-font-medium ap-text-gray-900">
                                            {role.title}
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center">
                                            <input
                                                type="checkbox"
                                                checked={perm.can_submit}
                                                onChange={e => updateLocalPermission(role.id, 'can_submit', e.target.checked)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                            />
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center">
                                            <input
                                                type="checkbox"
                                                checked={perm.can_view_all}
                                                onChange={e => updateLocalPermission(role.id, 'can_view_all', e.target.checked)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                            />
                                        </td>
                                        <td className="ap-px-4 ap-py-3 ap-text-center">
                                            <input
                                                type="checkbox"
                                                checked={perm.can_manage}
                                                onChange={e => updateLocalPermission(role.id, 'can_manage', e.target.checked)}
                                                className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="ap-mt-4 ap-p-4 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg">
                    <h4 className="ap-text-sm ap-font-medium ap-text-yellow-800 ap-mb-2">Permission Levels:</h4>
                    <ul className="ap-text-xs ap-text-yellow-700 ap-space-y-1">
                        <li><strong>Can Submit:</strong> User can log their own mileage trips</li>
                        <li><strong>Can View All:</strong> User can see all employees' trips and generate reports</li>
                        <li><strong>Can Manage:</strong> User can edit settings, locations, budget accounts, and permissions</li>
                    </ul>
                </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default MileageSettings;
