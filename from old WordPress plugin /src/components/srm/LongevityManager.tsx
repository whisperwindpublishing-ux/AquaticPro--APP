import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import {
    getLongevityRates,
    upsertLongevityRate,
    deleteLongevityRate,
    getEmployeeWorkYears,
    addEmployeeWorkYear,
    deleteEmployeeWorkYear,
    verifyWorkYear,
    migrateWorkYears,
    getLongevitySettings,
    updateLongevitySettings,
    calculateLongevityBonus,
    LongevityRate,
    EmployeeWorkYear,
    LongevitySettings,
    MigrationResponse,
    CalculatedLongevity
} from '@/services/seasonalReturnsService';
import { getAllEmployeePay } from '@/services/seasonalReturnsService';
import {
    HiOutlineCurrencyDollar,
    HiOutlinePlus,
    HiOutlineXMark,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineArrowPath,
    HiOutlineUserGroup,
    HiOutlineCog6Tooth,
    HiOutlineCalculator,
    HiOutlineArrowUpOnSquare
} from 'react-icons/hi2';

type TabType = 'rates' | 'work-years' | 'migration' | 'settings';

interface Employee {
    user_id: number;
    display_name: string;
    longevity_years?: number;
}

const LongevityManager: React.FC = () => {
    // Active tab
    const [activeTab, setActiveTab] = useState<TabType>('rates');
    
    // Rates state
    const [rates, setRates] = useState<LongevityRate[]>([]);
    const [loadingRates, setLoadingRates] = useState(true);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const [editingRate, setEditingRate] = useState<LongevityRate | null>(null);
    const [newRate, setNewRate] = useState({ year: '', rate: '', notes: '' });
    const [savingRate, setSavingRate] = useState(false);
    
    // Work years state
    const [workYears, setWorkYears] = useState<EmployeeWorkYear[]>([]);
    const [loadingWorkYears, setLoadingWorkYears] = useState(false);
    const [workYearsError, setWorkYearsError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [addingYear, setAddingYear] = useState(false);
    const [newWorkYear, setNewWorkYear] = useState({ years: '', notes: '' });
    
    // Migration state
    const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [migrationYear, setMigrationYear] = useState(new Date().getFullYear().toString());
    
    // Settings state
    const [settings, setSettings] = useState<LongevitySettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    
    // Calculator state
    const [calcUserId, setCalcUserId] = useState<string>('');
    const [calcResult, setCalcResult] = useState<CalculatedLongevity | null>(null);
    const [calculating, setCalculating] = useState(false);

    useEffect(() => {
        loadRates();
        loadEmployees();
    }, []);

    useEffect(() => {
        if (activeTab === 'work-years') {
            loadWorkYears();
        } else if (activeTab === 'settings') {
            loadSettings();
        }
    }, [activeTab, selectedUserId]);

    const loadRates = async () => {
        try {
            setLoadingRates(true);
            setRatesError(null);
            const data = await getLongevityRates();
            setRates(data);
        } catch (err: any) {
            setRatesError(err.message || 'Failed to load longevity rates');
        } finally {
            setLoadingRates(false);
        }
    };

    const loadEmployees = async () => {
        try {
            setLoadingEmployees(true);
            const data = await getAllEmployeePay();
            setEmployees(data.map(e => ({
                user_id: e.user_id,
                display_name: e.display_name,
                longevity_years: e.pay_breakdown?.longevity?.years
            })));
        } catch (err) {
            console.error('Failed to load employees:', err);
            setEmployees([]);
        } finally {
            setLoadingEmployees(false);
        }
    };

    const loadWorkYears = async () => {
        try {
            setLoadingWorkYears(true);
            setWorkYearsError(null);
            const data = await getEmployeeWorkYears(selectedUserId || undefined);
            setWorkYears(data);
        } catch (err: any) {
            setWorkYearsError(err.message || 'Failed to load work years');
        } finally {
            setLoadingWorkYears(false);
        }
    };

    const loadSettings = async () => {
        try {
            setLoadingSettings(true);
            const data = await getLongevitySettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveRate = async () => {
        const year = parseInt(editingRate ? editingRate.work_year.toString() : newRate.year);
        const rate = parseFloat(editingRate ? editingRate.rate.toString() : newRate.rate);
        
        if (!year || isNaN(rate)) {
            return;
        }
        
        try {
            setSavingRate(true);
            await upsertLongevityRate(year, rate, editingRate?.notes || newRate.notes);
            setEditingRate(null);
            setNewRate({ year: '', rate: '', notes: '' });
            await loadRates();
        } catch (err: any) {
            alert(err.message || 'Failed to save rate');
        } finally {
            setSavingRate(false);
        }
    };

    const handleDeleteRate = async (id: number) => {
        if (!confirm('Delete this longevity rate?')) return;
        
        try {
            await deleteLongevityRate(id);
            await loadRates();
        } catch (err: any) {
            alert(err.message || 'Failed to delete rate');
        }
    };

    const handleAddWorkYear = async () => {
        if (!selectedUserId || !newWorkYear.years) return;
        
        try {
            setAddingYear(true);
            
            // Parse years - can be comma-separated, range (e.g., 2020-2024), or single year
            const yearsInput = newWorkYear.years.trim();
            let yearsToAdd: number[] = [];
            
            if (yearsInput.includes('-')) {
                // Range format: 2020-2024
                const [start, end] = yearsInput.split('-').map(y => parseInt(y.trim()));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let year = Math.min(start, end); year <= Math.max(start, end); year++) {
                        yearsToAdd.push(year);
                    }
                }
            } else if (yearsInput.includes(',')) {
                // Comma-separated: 2020,2022,2024
                yearsToAdd = yearsInput.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
            } else {
                // Single year
                const year = parseInt(yearsInput);
                if (!isNaN(year)) {
                    yearsToAdd.push(year);
                }
            }
            
            if (yearsToAdd.length === 0) {
                alert('Please enter valid year(s)');
                return;
            }
            
            // Add each year
            let added = 0;
            let skipped = 0;
            for (const year of yearsToAdd) {
                try {
                    await addEmployeeWorkYear(selectedUserId, year, newWorkYear.notes);
                    added++;
                } catch (err: any) {
                    if (err.message?.includes('already exists')) {
                        skipped++;
                    } else {
                        throw err;
                    }
                }
            }
            
            setNewWorkYear({ years: '', notes: '' });
            await loadWorkYears();
            
            if (added > 0 && skipped > 0) {
                alert(`Added ${added} year(s), skipped ${skipped} duplicate(s)`);
            } else if (added > 0) {
                alert(`Added ${added} year(s) successfully`);
            } else if (skipped > 0) {
                alert(`All ${skipped} year(s) already exist`);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to add work year');
        } finally {
            setAddingYear(false);
        }
    };

    const handleDeleteWorkYear = async (id: number) => {
        if (!confirm('Delete this work year?')) return;
        
        try {
            await deleteEmployeeWorkYear(id);
            await loadWorkYears();
        } catch (err: any) {
            alert(err.message || 'Failed to delete work year');
        }
    };

    const handleVerifyWorkYear = async (id: number) => {
        try {
            await verifyWorkYear(id);
            await loadWorkYears();
        } catch (err: any) {
            alert(err.message || 'Failed to verify work year');
        }
    };

    const handleMigration = async (dryRun: boolean) => {
        try {
            setMigrating(true);
            const result = await migrateWorkYears(dryRun, parseInt(migrationYear));
            setMigrationResult(result);
            if (!dryRun) {
                await loadWorkYears();
            }
        } catch (err: any) {
            alert(err.message || 'Migration failed');
        } finally {
            setMigrating(false);
        }
    };

    const handleSaveSettings = async (newSettings: Partial<LongevitySettings>) => {
        try {
            setSavingSettings(true);
            const updated = await updateLongevitySettings(newSettings);
            setSettings(updated);
        } catch (err: any) {
            alert(err.message || 'Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleCalculate = async (userId?: string) => {
        const targetUserId = userId || calcUserId;
        if (!targetUserId) return;
        
        try {
            setCalculating(true);
            const result = await calculateLongevityBonus(parseInt(targetUserId));
            setCalcResult(result);
        } catch (err: any) {
            alert(err.message || 'Calculation failed');
        } finally {
            setCalculating(false);
        }
    };
    
    const handleUserSelect = (userId: string) => {
        setCalcUserId(userId);
        setCalcResult(null);
        if (userId) {
            // Auto-calculate when user is selected
            handleCalculate(userId);
        }
    };

    // Group work years by user
    const workYearsByUser = workYears.reduce((acc, wy) => {
        const key = wy.user_id;
        if (!acc[key]) {
            acc[key] = { display_name: wy.display_name || `User #${wy.user_id}`, years: [] };
        }
        acc[key].years.push(wy);
        return acc;
    }, {} as Record<number, { display_name: string; years: EmployeeWorkYear[] }>);

    const tabs = [
        { id: 'rates' as TabType, label: 'Rates by Year', icon: HiOutlineCurrencyDollar },
        { id: 'work-years' as TabType, label: 'Employee Work Years', icon: HiOutlineUserGroup },
        { id: 'migration' as TabType, label: 'Migration Tool', icon: HiOutlineArrowUpOnSquare },
        { id: 'settings' as TabType, label: 'Settings', icon: HiOutlineCog6Tooth }
    ];

    return (
        <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200">
            {/* Header */}
            <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-200">
                <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
                    <HiOutlineCurrencyDollar className="ap-w-5 ap-h-5 ap-text-green-600" />
                    Longevity Bonus Management
                </h2>
                <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                    Manage year-based longevity rates and track employee work years
                </p>
            </div>

            {/* Tabs */}
            <div className="ap-border-b ap-border-gray-200">
                <nav className="ap-flex -ap-mb-px ap-px-6">
                    {tabs.map(tab => (
                        <Button
                            key={tab.id}
                            variant="ghost"
                            onClick={() => setActiveTab(tab.id)}
                            className={`!ap-rounded-none ap-py-3 ap-px-4 ap-flex ap-items-center ap-gap-2 ap-border-b-2 ap-font-medium ap-text-sm ap-transition-colors ${
                                activeTab === tab.id
                                    ? 'ap-border-aquaticpro-600 ap-text-aquaticpro-600' : 'ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700 hover:ap-border-gray-300'
                            }`}
                        >
                            <tab.icon className="ap-w-4 ap-h-4" />
                            {tab.label}
                        </Button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="ap-p-6">
                {activeTab === 'rates' && (
                    <div className="ap-space-y-6">
                        {/* Add New Rate Form */}
                        <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4">
                            <h3 className="ap-font-medium ap-text-green-800 ap-mb-3 ap-flex ap-items-center ap-gap-2">
                                <HiOutlinePlus className="ap-w-5 ap-h-5" />
                                Add New Longevity Rate
                            </h3>
                            <div className="ap-flex ap-flex-wrap ap-items-end ap-gap-4">
                                <div>
                                    <label className="ap-block ap-text-sm ap-text-gray-700 ap-mb-1 ap-font-medium">Year *</label>
                                    <input
                                        type="number"
                                        value={newRate.year}
                                        onChange={e => setNewRate(p => ({ ...p, year: e.target.value }))}
                                        placeholder="2026"
                                        className="ap-w-28 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-green-500 focus:ap-border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="ap-block ap-text-sm ap-text-gray-700 ap-mb-1 ap-font-medium">Rate ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newRate.rate}
                                        onChange={e => setNewRate(p => ({ ...p, rate: e.target.value }))}
                                        placeholder="0.50"
                                        className="ap-w-28 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-green-500 focus:ap-border-green-500"
                                    />
                                </div>
                                <div className="ap-flex-1 ap-min-w-[200px]">
                                    <label className="ap-block ap-text-sm ap-text-gray-700 ap-mb-1">Notes (optional)</label>
                                    <input
                                        type="text"
                                        value={newRate.notes}
                                        onChange={e => setNewRate(p => ({ ...p, notes: e.target.value }))}
                                        placeholder="e.g., New rate structure"
                                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-green-500 focus:ap-border-green-500"
                                    />
                                </div>
                                <Button
                                    variant="primary"
                                    onClick={handleSaveRate}
                                    disabled={savingRate || !newRate.year || !newRate.rate}
                                    className="!ap-bg-green-600 hover:!ap-bg-green-700"
                                >
                                    <HiOutlinePlus className="ap-w-5 ap-h-5" />
                                    {savingRate ? 'Saving...' : 'Create Rate'}
                                </Button>
                            </div>
                        </div>

                        {/* Rates Table */}
                        {loadingRates ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">Loading rates...</div>
                        ) : ratesError ? (
                            <div className="ap-text-center ap-py-8 ap-text-red-600">{ratesError}</div>
                        ) : rates.length === 0 ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">No rates configured yet. Add your first rate above.</div>
                        ) : (
                            <div className="ap-overflow-x-auto">
                                <table className="ap-w-full">
                                    <thead>
                                        <tr className="ap-border-b ap-border-gray-200">
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Year</th>
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Rate</th>
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Notes</th>
                                            <th className="ap-text-right ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rates.map(rate => (
                                            <tr key={rate.id} className={`ap-border-b ap-border-gray-100 ${editingRate?.id === rate.id ? 'ap-bg-blue-50' : 'hover:ap-bg-gray-50'}`}>
                                                <td className="ap-py-3 ap-px-4 ap-font-medium">{rate.work_year}</td>
                                                <td className="ap-py-3 ap-px-4">
                                                    {editingRate?.id === rate.id ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={editingRate.rate}
                                                            onChange={e => setEditingRate({ ...editingRate, rate: parseFloat(e.target.value) })}
                                                            className="ap-w-24 ap-px-2 ap-py-1 ap-border ap-border-blue-300 ap-rounded focus:ap-ring-2 focus:ap-ring-blue-500"
                                                        />
                                                    ) : (
                                                        <span className="ap-text-green-600 ap-font-medium">${parseFloat(rate.rate.toString()).toFixed(2)}</span>
                                                    )}
                                                </td>
                                                <td className="ap-py-3 ap-px-4">
                                                    {editingRate?.id === rate.id ? (
                                                        <input
                                                            type="text"
                                                            value={editingRate.notes || ''}
                                                            onChange={e => setEditingRate({ ...editingRate, notes: e.target.value })}
                                                            placeholder="Add notes..."
                                                            className="ap-w-full ap-px-2 ap-py-1 ap-border ap-border-blue-300 ap-rounded focus:ap-ring-2 focus:ap-ring-blue-500"
                                                        />
                                                    ) : (
                                                        <span className="ap-text-gray-500">{rate.notes || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="ap-py-3 ap-px-4 ap-text-right">
                                                    {editingRate?.id === rate.id ? (
                                                        <div className="ap-flex ap-justify-end ap-gap-2">
                                                            <Button
                                                                variant="primary"
                                                                size="sm"
                                                                onClick={handleSaveRate}
                                                                disabled={savingRate}
                                                                className="!ap-bg-green-600 hover:!ap-bg-green-700"
                                                            >
                                                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                                                Save
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setEditingRate(null)}
                                                            >
                                                                <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="ap-flex ap-justify-end ap-gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="xs"
                                                                onClick={() => setEditingRate(rate)}
                                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-bg-blue-50"
                                                                title="Edit rate"
                                                            >
                                                                <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="xs"
                                                                onClick={() => handleDeleteRate(rate.id)}
                                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-red-600 hover:ap-bg-red-50"
                                                                title="Delete rate"
                                                            >
                                                                <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'work-years' && (
                    <div className="ap-space-y-6">
                        {/* Employee Filter & Calculator */}
                        <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
                            <div className="ap-flex ap-flex-wrap ap-items-end ap-gap-4 ap-mb-4">
                                <div className="ap-flex-1 ap-min-w-[200px]">
                                    <label className="ap-block ap-text-sm ap-text-gray-600 ap-mb-1">Filter by Employee</label>
                                    <select
                                        value={selectedUserId || ''}
                                        onChange={e => {
                                            setSelectedUserId(e.target.value ? parseInt(e.target.value) : null);
                                            setCalcResult(null);
                                        }}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                                    >
                                        <option value="">All Employees</option>
                                        {employees.map(emp => (
                                            <option key={emp.user_id} value={emp.user_id}>
                                                {emp.display_name} ({emp.longevity_years || 0} years)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={loadWorkYears}
                                    disabled={loadingWorkYears}
                                >
                                    <HiOutlineArrowPath className={`ap-w-4 ap-h-4 ${loadingWorkYears ? 'ap-animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </div>
                            
                            {/* Calculator */}
                            <div className="ap-pt-4 ap-border-t ap-border-gray-200">
                                <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalculator className="ap-w-4 ap-h-4" />
                                    Bonus Calculator
                                </h4>
                                <div className="ap-flex ap-gap-4 ap-items-end">
                                    <div className="ap-flex-1 ap-max-w-xs">
                                        <select
                                            value={calcUserId}
                                            onChange={e => handleUserSelect(e.target.value)}
                                            disabled={calculating || loadingEmployees}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg disabled:ap-opacity-50 disabled:ap-cursor-not-allowed"
                                        >
                                            <option value="">
                                                {loadingEmployees ? 'Loading employees...' : employees.length === 0 ? 'No employees found' : 'Select employee...'}
                                            </option>
                                            {employees.map(emp => (
                                                <option key={emp.user_id} value={emp.user_id}>
                                                    {emp.display_name}
                                                </option>
                                            ))}
                                        </select>
                                        {loadingEmployees && (
                                            <div className="ap-mt-1 ap-flex ap-items-center ap-gap-2 ap-text-xs ap-text-gray-500">
                                                <div className="ap-animate-spin ap-rounded-full ap-h-3 ap-w-3 ap-border-b-2 ap-border-aquaticpro-600"></div>
                                                <span>Loading employees...</span>
                                            </div>
                                        )}
                                        {calculating && (
                                            <div className="ap-mt-1 ap-flex ap-items-center ap-gap-2 ap-text-xs ap-text-gray-500">
                                                <div className="ap-animate-spin ap-rounded-full ap-h-3 ap-w-3 ap-border-b-2 ap-border-aquaticpro-600"></div>
                                                <span>Calculating...</span>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleCalculate()}
                                        disabled={calculating || !calcUserId}
                                    >
                                        {calculating ? 'Calculating...' : 'Recalculate'}
                                    </Button>
                                </div>
                                {calculating && (
                                    <div className="ap-mt-3 ap-p-4 ap-bg-white ap-rounded-lg ap-border ap-flex ap-items-center ap-justify-center ap-gap-2 ap-text-gray-500">
                                        <div className="ap-animate-spin ap-rounded-full ap-h-5 ap-w-5 ap-border-b-2 ap-border-aquaticpro-600"></div>
                                        <span>Calculating...</span>
                                    </div>
                                )}
                                {!calculating && calcResult && (
                                    <div className="ap-mt-3 ap-p-4 ap-bg-white ap-rounded-lg ap-border ap-space-y-3">
                                        <div className="ap-flex ap-items-center ap-justify-between ap-pb-3 ap-border-b">
                                            <span className="ap-text-gray-600 ap-font-medium">Total Longevity Bonus:</span>
                                            <span className="ap-text-2xl ap-font-bold ap-text-green-600">
                                                ${calcResult.total_bonus.toFixed(2)}/hr
                                            </span>
                                        </div>
                                        
                                        {calcResult.work_years.length > 0 ? (
                                            <div>
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Proof of Work & Rates:</div>
                                                <div className="ap-space-y-1.5">
                                                    {calcResult.breakdown?.map((detail, idx) => (
                                                        <div key={idx} className="ap-flex ap-items-center ap-justify-between ap-text-sm">
                                                            <span className="ap-text-gray-600">
                                                                {idx === 0 ? (
                                                                    <span className="ap-text-gray-400">Year {detail.year} (first year, no bonus)</span>
                                                                ) : (
                                                                    <span>Year {detail.year}</span>
                                                                )}
                                                            </span>
                                                            <span className={detail.rate > 0 ? 'ap-font-medium ap-text-gray-900' : 'ap-text-gray-400'}>
                                                                ${parseFloat(String(detail.rate)).toFixed(2)}/hr
                                                                {detail.reason && <span className="ap-ml-1 ap-text-xs ap-text-gray-400">({detail.reason})</span>}
                                                            </span>
                                                        </div>
                                                    )) || calcResult.work_years.map((year, idx) => (
                                                        <div key={year} className="ap-flex ap-items-center ap-justify-between ap-text-sm ap-text-gray-500">
                                                            <span>Year {year}{idx === 0 ? ' (first year, no bonus)' : ''}</span>
                                                            <span>{idx === 0 ? '-' : '(rate not available)'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="ap-mt-2 ap-pt-2 ap-border-t ap-text-xs ap-text-gray-500">
                                                    {calcResult.work_years.length} work year(s): {calcResult.work_years.join(', ')}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="ap-text-sm ap-text-gray-500">
                                                No work years recorded. Add work years to calculate bonus.
                                            </div>
                                        )}
                                        
                                        {calcResult.needs_migration && (
                                            <div className="ap-p-2 ap-bg-yellow-50 ap-text-yellow-800 ap-rounded ap-text-sm ap-flex ap-items-start ap-gap-2">
                                                <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4 ap-flex-shrink-0 ap-mt-0.5" />
                                                <span>{calcResult.message}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add Work Year (when employee selected) */}
                        {selectedUserId && (
                            <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4">
                                <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2">Add Work Year(s)</h4>
                                <p className="ap-text-xs ap-text-gray-600 ap-mb-3">
                                    Enter: single year (2024), range (2020-2024), or comma-separated (2020,2022,2024)
                                </p>
                                <div className="ap-flex ap-items-end ap-gap-4">
                                    <div>
                                        <label className="ap-block ap-text-sm ap-text-gray-600 ap-mb-1">Year(s)</label>
                                        <input
                                            type="text"
                                            value={newWorkYear.years}
                                            onChange={e => setNewWorkYear(p => ({ ...p, years: e.target.value }))}
                                            placeholder="2024 or 2020-2024"
                                            className="ap-w-40 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                                        />
                                    </div>
                                    <div className="ap-flex-1">
                                        <label className="ap-block ap-text-sm ap-text-gray-600 ap-mb-1">Notes</label>
                                        <input
                                            type="text"
                                            value={newWorkYear.notes}
                                            onChange={e => setNewWorkYear(p => ({ ...p, notes: e.target.value }))}
                                            placeholder="Optional notes (applied to all years)"
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={handleAddWorkYear}
                                        disabled={addingYear || !newWorkYear.years}
                                        className="!ap-bg-blue-600 hover:!ap-bg-blue-700 ap-whitespace-nowrap"
                                    >
                                        {addingYear ? 'Adding...' : 'Add Year(s)'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Work Years List */}
                        {loadingWorkYears ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">Loading work years...</div>
                        ) : workYearsError ? (
                            <div className="ap-text-center ap-py-8 ap-text-red-600">{workYearsError}</div>
                        ) : workYears.length === 0 ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">
                                No work years recorded yet. Use the Migration Tool to populate from existing longevity data.
                            </div>
                        ) : selectedUserId ? (
                            // Single user view
                            <div className="ap-overflow-x-auto">
                                <table className="ap-w-full">
                                    <thead>
                                        <tr className="ap-border-b ap-border-gray-200">
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Year</th>
                                            <th className="ap-text-right ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Rate</th>
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Verified</th>
                                            <th className="ap-text-left ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Notes</th>
                                            <th className="ap-text-right ap-py-3 ap-px-4 ap-font-medium ap-text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workYears.map((wy, index) => {
                                            const yearRate = rates.find(r => r.work_year === wy.work_year);
                                            const isFirstYear = index === 0 || (workYears.length > 0 && wy.work_year === Math.min(...workYears.map(y => y.work_year)));
                                            return (
                                                <tr key={wy.id} className="ap-border-b ap-border-gray-100 hover:ap-bg-gray-50">
                                                    <td className="ap-py-3 ap-px-4 ap-font-medium">{wy.work_year}</td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-right">
                                                        {isFirstYear ? (
                                                            <span className="ap-text-gray-400 ap-text-sm">-</span>
                                                        ) : yearRate ? (
                                                            <span className="ap-font-medium ap-text-green-600">${parseFloat(String(yearRate.rate)).toFixed(2)}/hr</span>
                                                        ) : (
                                                            <span className="ap-text-gray-400 ap-text-sm">No rate set</span>
                                                        )}
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4">
                                                        {wy.verified ? (
                                                            <span className="ap-inline-flex ap-items-center ap-gap-1 ap-text-green-600">
                                                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" /> Verified
                                                            </span>
                                                        ) : (
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                onClick={() => handleVerifyWorkYear(wy.id)}
                                                            >
                                                                Click to verify
                                                            </Button>
                                                        )}
                                                    </td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-gray-500">{wy.notes || '-'}</td>
                                                    <td className="ap-py-3 ap-px-4 ap-text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => handleDeleteWorkYear(wy.id)}
                                                            className="!ap-p-1.5 !ap-min-h-0 ap-text-red-600 hover:ap-bg-red-50"
                                                        >
                                                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            // Grouped view by user
                            <div className="ap-space-y-4">
                                {Object.entries(workYearsByUser).map(([userId, data]) => (
                                    <div key={userId} className="ap-border ap-rounded-lg ap-p-4">
                                        <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2">{data.display_name}</h4>
                                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                                            {data.years.sort((a, b) => a.work_year - b.work_year).map(wy => (
                                                <span
                                                    key={wy.id}
                                                    className={`ap-px-3 ap-py-1 ap-rounded-full ap-text-sm ${
                                                        wy.verified
                                                            ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-gray-100 ap-text-gray-800'
                                                    }`}
                                                >
                                                    {wy.work_year}
                                                    {wy.verified && <HiOutlineCheckCircle className="ap-w-3 ap-h-3 ap-inline ap-ml-1" />}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'migration' && (
                    <div className="ap-space-y-6">
                        <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-4">
                            <h3 className="ap-font-medium ap-text-yellow-800 ap-flex ap-items-center ap-gap-2">
                                <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5" />
                                Migration Tool
                            </h3>
                            <p className="ap-text-sm ap-text-yellow-700 ap-mt-1">
                                This tool migrates existing longevity_years data into work year records.
                                For each employee with longevity years set, it creates consecutive year entries
                                going backwards from the specified start year.
                            </p>
                        </div>

                        <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
                            <div className="ap-flex ap-items-end ap-gap-4 ap-mb-4">
                                <div>
                                    <label className="ap-block ap-text-sm ap-text-gray-600 ap-mb-1">Start Year</label>
                                    <input
                                        type="number"
                                        value={migrationYear}
                                        onChange={e => setMigrationYear(e.target.value)}
                                        className="ap-w-32 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => handleMigration(true)}
                                    disabled={migrating}
                                >
                                    Preview (Dry Run)
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => handleMigration(false)}
                                    disabled={migrating}
                                    className="!ap-bg-yellow-600 hover:!ap-bg-yellow-700"
                                >
                                    {migrating ? 'Running...' : 'Run Migration'}
                                </Button>
                            </div>
                        </div>

                        {migrationResult && (
                            <div className="ap-border ap-rounded-lg ap-overflow-hidden">
                                <div className={`ap-px-4 ap-py-3 ${migrationResult.dry_run ? 'ap-bg-blue-50' : 'ap-bg-green-50'}`}>
                                    <h4 className="ap-font-medium">
                                        {migrationResult.dry_run ? 'Preview Results' : 'Migration Complete'}
                                    </h4>
                                    <p className="ap-text-sm ap-text-gray-600">{migrationResult.message}</p>
                                </div>
                                {migrationResult.results.length > 0 && (
                                    <div className="ap-max-h-96 ap-overflow-y-auto">
                                        <table className="ap-w-full">
                                            <thead className="ap-bg-gray-50">
                                                <tr>
                                                    <th className="ap-text-left ap-py-2 ap-px-4 ap-text-sm ap-font-medium ap-text-gray-600">Employee</th>
                                                    <th className="ap-text-left ap-py-2 ap-px-4 ap-text-sm ap-font-medium ap-text-gray-600">Legacy Years</th>
                                                    <th className="ap-text-left ap-py-2 ap-px-4 ap-text-sm ap-font-medium ap-text-gray-600">Existing</th>
                                                    <th className="ap-text-left ap-py-2 ap-px-4 ap-text-sm ap-font-medium ap-text-gray-600">To Create</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {migrationResult.results.map(r => (
                                                    <tr key={r.user_id} className="ap-border-t ap-border-gray-100">
                                                        <td className="ap-py-2 ap-px-4">{r.display_name}</td>
                                                        <td className="ap-py-2 ap-px-4">{r.longevity_years}</td>
                                                        <td className="ap-py-2 ap-px-4">{r.existing_years}</td>
                                                        <td className="ap-py-2 ap-px-4">
                                                            {r.years_to_create.length > 0
                                                                ? r.years_to_create.join(', ')
                                                                : <span className="ap-text-gray-400">None needed</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="ap-space-y-6">
                        {loadingSettings ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">Loading settings...</div>
                        ) : !settings ? (
                            <div className="ap-text-center ap-py-8 ap-text-red-500">Failed to load settings. Please refresh the page.</div>
                        ) : (
                            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
                                <h3 className="ap-font-medium ap-text-gray-900 ap-mb-4">Anniversary Year Mode</h3>
                                <p className="ap-text-sm ap-text-gray-600 ap-mb-4">
                                    Determines which year is used when calculating longevity bonuses:
                                </p>
                                <div className="ap-space-y-3">
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-rounded-lg ap-border-2 ap-cursor-pointer ap-transition-colors ${
                                            settings.anniversary_year_mode === 'season' 
                                                ? 'ap-bg-green-50 ap-border-green-500' : 'ap-bg-white ap-border-gray-200 hover:ap-border-green-300'
                                        } ${savingSettings ? 'ap-opacity-50 ap-cursor-wait' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="anniversary_mode"
                                            value="season"
                                            checked={settings.anniversary_year_mode === 'season'}
                                            onChange={() => handleSaveSettings({ anniversary_year_mode: 'season' })}
                                            disabled={savingSettings}
                                            className="ap-mt-1 ap-text-green-600 focus:ap-ring-green-500"
                                        />
                                        <div>
                                            <div className={`ap-font-medium ${settings.anniversary_year_mode === 'season' ? 'ap-text-green-800' : 'ap-text-gray-900'}`}>Season Year</div>
                                            <div className="ap-text-sm ap-text-gray-500">
                                                Use the year of the season they're returning to (e.g., Summer 2026 = 2026 rate)
                                            </div>
                                        </div>
                                    </label>
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-rounded-lg ap-border-2 ap-cursor-pointer ap-transition-colors ${
                                            settings.anniversary_year_mode === 'fixed_date' 
                                                ? 'ap-bg-green-50 ap-border-green-500' : 'ap-bg-white ap-border-gray-200 hover:ap-border-green-300'
                                        } ${savingSettings ? 'ap-opacity-50 ap-cursor-wait' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="anniversary_mode"
                                            value="fixed_date"
                                            checked={settings.anniversary_year_mode === 'fixed_date'}
                                            onChange={() => handleSaveSettings({ anniversary_year_mode: 'fixed_date' })}
                                            disabled={savingSettings}
                                            className="ap-mt-1 ap-text-green-600 focus:ap-ring-green-500"
                                        />
                                        <div className="ap-flex-1">
                                            <div className={`ap-font-medium ${settings.anniversary_year_mode === 'fixed_date' ? 'ap-text-green-800' : 'ap-text-gray-900'}`}>Fixed Anniversary Date</div>
                                            <div className="ap-text-sm ap-text-gray-500 ap-mb-2">
                                                Longevity advances on a specific date each year (e.g., May 1st for all employees)
                                            </div>
                                            {settings.anniversary_year_mode === 'fixed_date' && (
                                                <div className="ap-flex ap-items-center ap-gap-2 ap-mt-2">
                                                    <select
                                                        value={(settings.anniversary_date || '05-01').split('-')[0]}
                                                        onChange={(e) => {
                                                            const month = e.target.value;
                                                            const day = (settings.anniversary_date || '05-01').split('-')[1] || '01';
                                                            handleSaveSettings({ anniversary_date: `${month}-${day}` });
                                                        }}
                                                        disabled={savingSettings}
                                                        className="ap-border ap-border-gray-300 ap-rounded ap-px-2 ap-py-1 ap-text-sm"
                                                    >
                                                        <option value="01">January</option>
                                                        <option value="02">February</option>
                                                        <option value="03">March</option>
                                                        <option value="04">April</option>
                                                        <option value="05">May</option>
                                                        <option value="06">June</option>
                                                        <option value="07">July</option>
                                                        <option value="08">August</option>
                                                        <option value="09">September</option>
                                                        <option value="10">October</option>
                                                        <option value="11">November</option>
                                                        <option value="12">December</option>
                                                    </select>
                                                    <select
                                                        value={(settings.anniversary_date || '05-01').split('-')[1]}
                                                        onChange={(e) => {
                                                            const month = (settings.anniversary_date || '05-01').split('-')[0] || '05';
                                                            const day = e.target.value;
                                                            handleSaveSettings({ anniversary_date: `${month}-${day}` });
                                                        }}
                                                        disabled={savingSettings}
                                                        className="ap-border ap-border-gray-300 ap-rounded ap-px-2 ap-py-1 ap-text-sm"
                                                    >
                                                        {Array.from({ length: 31 }, (_, i) => (
                                                            <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-rounded-lg ap-border-2 ap-cursor-pointer ap-transition-colors ${
                                            settings.anniversary_year_mode === 'anniversary' 
                                                ? 'ap-bg-green-50 ap-border-green-500' : 'ap-bg-white ap-border-gray-200 hover:ap-border-green-300'
                                        } ${savingSettings ? 'ap-opacity-50 ap-cursor-wait' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="anniversary_mode"
                                            value="anniversary"
                                            checked={settings.anniversary_year_mode === 'anniversary'}
                                            onChange={() => handleSaveSettings({ anniversary_year_mode: 'anniversary' })}
                                            disabled={savingSettings}
                                            className="ap-mt-1 ap-text-green-600 focus:ap-ring-green-500"
                                        />
                                        <div>
                                            <div className={`ap-font-medium ${settings.anniversary_year_mode === 'anniversary' ? 'ap-text-green-800' : 'ap-text-gray-900'}`}>Employee Hire Date Anniversary</div>
                                            <div className="ap-text-sm ap-text-gray-500">
                                                Each employee's longevity advances on their individual hire date anniversary
                                            </div>
                                        </div>
                                    </label>
                                </div>
                                {savingSettings && (
                                    <p className="ap-mt-3 ap-text-sm ap-text-aquaticpro-600">Saving...</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LongevityManager;
