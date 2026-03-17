import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import Card from '../ui/Card';
import { 
    HiOutlinePencilSquare, 
    HiOutlineTrash, 
    HiOutlinePlusCircle,
    HiOutlineCalendar,
    HiOutlineFunnel,
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineBanknotes,
    HiOutlineXCircle
} from 'react-icons/hi2';
import { getCachedUsers } from '@/services/userCache';

interface Stop {
    location_name?: string;
    location_address?: string;
    custom_address?: string;
    distance_to_next?: number;
}

interface MileageEntry {
    id: number;
    user_id: number;
    user_name: string;
    trip_date: string;
    business_purpose: string;
    odometer_start: number | null;
    odometer_end: number | null;
    calculated_miles: number;
    tolls: number;
    parking: number;
    budget_account_id: number | null;
    account_code?: string;
    account_name?: string;
    notes: string;
    stops: Stop[];
    submitted_for_payment: boolean;
    submitted_at: string | null;
    submitted_by_name: string | null;
    created_at: string;
}

interface UserOption {
    id: number;
    display_name: string;
}

interface MileageEntryListProps {
    canViewAll: boolean;
    canManage: boolean;
    onEdit: (entryId: number) => void;
    onNewEntry: () => void;
}

const MileageEntryList: React.FC<MileageEntryListProps> = ({ 
    canViewAll, 
    canManage, 
    onEdit,
    onNewEntry 
}) => {
    const [entries, setEntries] = useState<MileageEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterUserId, setFilterUserId] = useState<string>('');
    const [filterSubmitted, setFilterSubmitted] = useState<string>('no');

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        loadEntries();
        if (canViewAll) {
            loadUsers();
        }
    }, []);

    const loadUsers = async () => {
        try {
            const cachedUsers = await getCachedUsers();
            setUsers(cachedUsers.map(u => ({ id: u.user_id, display_name: u.display_name })));
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    const loadEntries = async () => {
        setLoading(true);
        setSelectedIds(new Set()); // Clear selection on reload
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            if (filterUserId && canViewAll) params.append('user_id', filterUserId);
            if (filterSubmitted !== 'all') params.append('submitted', filterSubmitted);

            const response = await fetch(`${apiUrl}/mileage/entries?${params}`, {
                headers: { 'X-WP-Nonce': nonce }
            });

            if (response.ok) {
                setEntries(await response.json());
            }
        } catch (err) {
            console.error('Failed to load entries:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        
        setDeleting(id);
        try {
            const response = await fetch(`${apiUrl}/mileage/entries/${id}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce }
            });

            if (response.ok) {
                setEntries(prev => prev.filter(e => e.id !== id));
                setSelectedIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(id);
                    return newSet;
                });
            }
        } catch (err) {
            console.error('Failed to delete entry:', err);
        } finally {
            setDeleting(null);
        }
    };

    const handleBulkSubmit = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Mark ${selectedIds.size} trip(s) as submitted for payment?`)) return;
        
        setBulkProcessing(true);
        try {
            const response = await fetch(`${apiUrl}/mileage/entries/bulk-submit`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce 
                },
                body: JSON.stringify({ entry_ids: Array.from(selectedIds) })
            });

            if (response.ok) {
                await loadEntries();
            } else {
                alert('Failed to submit entries');
            }
        } catch (err) {
            console.error('Failed to bulk submit:', err);
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleBulkUnsubmit = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Undo submission for ${selectedIds.size} trip(s)?`)) return;
        
        setBulkProcessing(true);
        try {
            const response = await fetch(`${apiUrl}/mileage/entries/bulk-unsubmit`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce 
                },
                body: JSON.stringify({ entry_ids: Array.from(selectedIds) })
            });

            if (response.ok) {
                await loadEntries();
            } else {
                alert('Failed to unsubmit entries');
            }
        } catch (err) {
            console.error('Failed to bulk unsubmit:', err);
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Permanently delete ${selectedIds.size} trip(s)? This cannot be undone.`)) return;
        
        setBulkProcessing(true);
        try {
            const response = await fetch(`${apiUrl}/mileage/entries/bulk-delete`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce 
                },
                body: JSON.stringify({ entry_ids: Array.from(selectedIds) })
            });

            if (response.ok) {
                await loadEntries();
            } else {
                alert('Failed to delete entries');
            }
        } catch (err) {
            console.error('Failed to bulk delete:', err);
        } finally {
            setBulkProcessing(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === entries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(entries.map(e => e.id)));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const formatDate = (dateStr: string) => {
        // Parse as local date to avoid timezone issues
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Calculate totals
    const totals = entries.reduce((acc, entry) => ({
        miles: acc.miles + (parseInt(String(entry.calculated_miles)) || 0),
        tolls: acc.tolls + (parseFloat(String(entry.tolls)) || 0),
        parking: acc.parking + (parseFloat(String(entry.parking)) || 0)
    }), { miles: 0, tolls: 0, parking: 0 });

    // Check if user can edit/delete an entry
    const canEditEntry = (entry: MileageEntry) => {
        // Admins can edit all
        if (canManage) return true;
        // Others can edit their own non-submitted entries
        return !entry.submitted_for_payment;
    };

    const canDeleteEntry = (entry: MileageEntry) => {
        // Admins can delete all
        if (canManage) return true;
        // Others can delete their own non-submitted entries
        return !entry.submitted_for_payment;
    };

    return (
        <div>
            {/* Filters */}
            <Card className="ap-mb-6">
                <Card.Body padding="sm">
                    <div className="ap-flex ap-flex-wrap ap-items-end ap-gap-4">
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                        />
                    </div>
                    {canViewAll && (
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Employee</label>
                            <select
                                value={filterUserId}
                                onChange={e => setFilterUserId(e.target.value)}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 ap-min-w-[200px]"
                            >
                                <option value="">All Employees</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Status</label>
                        <select
                            value={filterSubmitted}
                            onChange={e => setFilterSubmitted(e.target.value)}
                            className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="no">Logged</option>
                            <option value="yes">Submitted</option>
                        </select>
                    </div>
                    <Button
                        onClick={loadEntries}
                        variant="secondary"
                        className="!ap-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlineFunnel className="ap-w-4 ap-h-4" />
                        Filter
                    </Button>
                    <Button
                        onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                            setFilterUserId('');
                            setFilterSubmitted('no');
                            setTimeout(loadEntries, 0);
                        }}
                        variant="ghost"
                        className="!ap-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlineArrowPath className="ap-w-4 ap-h-4" />
                        Reset
                    </Button>
                    <div className="ap-flex-1"></div>
                    <Button
                        onClick={onNewEntry}
                        variant="primary"
                        className="!ap-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlinePlusCircle className="ap-w-5 ap-h-5" />
                        Log New Trip
                    </Button>
                    </div>
                </Card.Body>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3 ap-mb-4 ap-flex ap-items-center ap-gap-4">
                    <span className="ap-text-sm ap-font-medium ap-text-blue-700">
                        {selectedIds.size} trip(s) selected
                    </span>
                    <div className="ap-flex-1"></div>
                    <Button
                        onClick={handleBulkSubmit}
                        disabled={bulkProcessing}
                        variant="primary"
                        size="sm"
                        className="!ap-bg-green-600 hover:!ap-bg-green-700 !ap-flex !ap-items-center !ap-gap-1.5"
                    >
                        <HiOutlineBanknotes className="ap-w-4 ap-h-4" />
                        Submit for Payment
                    </Button>
                    {canManage && (
                        <Button
                            onClick={handleBulkUnsubmit}
                            disabled={bulkProcessing}
                            variant="primary"
                            size="sm"
                            className="!ap-bg-yellow-600 hover:!ap-bg-yellow-700 !ap-flex !ap-items-center !ap-gap-1.5"
                        >
                            <HiOutlineXCircle className="ap-w-4 ap-h-4" />
                            Undo Submit
                        </Button>
                    )}
                    {canManage && (
                        <Button
                            onClick={handleBulkDelete}
                            disabled={bulkProcessing}
                            variant="primary"
                            size="sm"
                            className="!ap-bg-red-600 hover:!ap-bg-red-700 !ap-flex !ap-items-center !ap-gap-1.5"
                        >
                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                            Delete Selected
                        </Button>
                    )}
                </div>
            )}

            {/* Totals Summary */}
            {entries.length > 0 && (
                <div className="ap-grid ap-grid-cols-3 ap-gap-4 ap-mb-6">
                    <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-text-center">
                        <div className="ap-text-2xl ap-font-bold ap-text-blue-700">{totals.miles}</div>
                        <div className="ap-text-sm ap-text-blue-600">Total Miles</div>
                    </div>
                    <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-text-center">
                        <div className="ap-text-2xl ap-font-bold ap-text-green-700">{formatCurrency(totals.tolls)}</div>
                        <div className="ap-text-sm ap-text-green-600">Total Tolls</div>
                    </div>
                    <div className="ap-bg-purple-50 ap-border ap-border-purple-200 ap-rounded-lg ap-p-4 ap-text-center">
                        <div className="ap-text-2xl ap-font-bold ap-text-purple-700">{formatCurrency(totals.parking)}</div>
                        <div className="ap-text-sm ap-text-purple-600">Total Parking</div>
                    </div>
                </div>
            )}

            {/* Entries List */}
            {loading ? (
                <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                    <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600"></div>
                </div>
            ) : entries.length === 0 ? (
                <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-12 ap-text-center">
                    <HiOutlineCalendar className="ap-w-16 ap-h-16 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-600 ap-mb-2">No Trips Logged</h3>
                    <p className="ap-text-gray-500 ap-mb-4">
                        {dateFrom || dateTo ? 'No trips found for the selected date range.' : 'Start ap-tracking your business travel by logging your first trip.'}
                    </p>
                    <Button
                        onClick={onNewEntry}
                        variant="primary"
                        className="!ap-inline-flex !ap-items-center !ap-gap-2"
                    >
                        <HiOutlinePlusCircle className="ap-w-5 ap-h-5" />
                        Log Your First Trip
                    </Button>
                </div>
            ) : (
                <Card padding="none" className="ap-overflow-hidden">
                    <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 ap-py-3 ap-text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === entries.length && entries.length > 0}
                                        onChange={toggleSelectAll}
                                        className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                    />
                                </th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Date</th>
                                {canViewAll && (
                                    <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Employee</th>
                                )}
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Purpose</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Miles</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">End Odo</th>
                                <th className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Budget Code</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Tolls</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Parking</th>
                                <th className="ap-px-4 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Status</th>
                                <th className="ap-px-4 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="ap-divide-y ap-divide-gray-200">
                            {entries.map(entry => (
                                <tr 
                                    key={entry.id} 
                                    className={`hover:ap-bg-gray-50 ${entry.submitted_for_payment ? 'ap-bg-green-50/50' : ''}`}
                                >
                                    <td className="ap-px-4 ap-py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(entry.id)}
                                            onChange={() => toggleSelect(entry.id)}
                                            className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                        />
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm">
                                        {formatDate(entry.trip_date)}
                                    </td>
                                    {canViewAll && (
                                        <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-font-medium">
                                            {entry.user_name}
                                        </td>
                                    )}
                                    <td className="ap-px-4 ap-py-3 ap-text-sm">
                                        <div className="ap-font-medium ap-text-gray-900">
                                            {entry.business_purpose || '—'}
                                        </div>
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-right ap-font-semibold">
                                        {entry.calculated_miles}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                        {entry.odometer_end != null ? entry.odometer_end.toLocaleString() : '—'}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm">
                                        {entry.account_name ? (
                                            <span title={entry.account_code || ''}>{entry.account_name}</span>
                                        ) : '—'}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                        {entry.tolls > 0 ? formatCurrency(entry.tolls) : '—'}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                        {entry.parking > 0 ? formatCurrency(entry.parking) : '—'}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-center">
                                        {entry.submitted_for_payment ? (
                                            <span className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-green-100 ap-text-green-700 ap-text-xs ap-rounded-full" title={`Submitted by ${entry.submitted_by_name || 'Unknown'}`}>
                                                <HiOutlineCheckCircle className="ap-w-3.5 ap-h-3.5" />
                                                Submitted
                                            </span>
                                        ) : (
                                            <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-1 ap-bg-yellow-100 ap-text-yellow-700 ap-text-xs ap-rounded-full">
                                                Logged
                                            </span>
                                        )}
                                    </td>
                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                        {canEditEntry(entry) && (
                                            <Button
                                                onClick={() => onEdit(entry.id)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-1.5 !ap-min-h-0 !ap-text-gray-500 hover:!ap-text-blue-600 !ap-mr-2"
                                                title="Edit"
                                            >
                                                <HiOutlinePencilSquare className="ap-w-5 ap-h-5" />
                                            </Button>
                                        )}
                                        {canDeleteEntry(entry) && (
                                            <Button
                                                onClick={() => handleDelete(entry.id)}
                                                disabled={deleting === entry.id}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-p-1.5 !ap-min-h-0 !ap-text-gray-500 hover:!ap-text-red-600"
                                                title="Delete"
                                            >
                                                {deleting === entry.id ? (
                                                    <div className="ap-w-5 ap-h-5 ap-animate-spin ap-rounded-full ap-border-2 ap-border-red-500 ap-border-t-transparent"></div>
                                                ) : (
                                                    <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                                )}
                                            </Button>
                                        )}
                                        {!canEditEntry(entry) && !canDeleteEntry(entry) && (
                                            <span className="ap-text-xs ap-text-gray-400">Locked</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default MileageEntryList;
