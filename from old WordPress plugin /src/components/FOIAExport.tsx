import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '@/types';
import { getCachedUsers } from '@/services/userCache';
import { Button } from './ui/Button';
import { 
    HiOutlineDocumentArrowDown, 
    HiOutlineUserGroup,
    HiOutlineCalendar,
    HiOutlineClipboardDocumentList,
    HiOutlineShieldCheck,
    HiOutlineExclamationTriangle,
    HiOutlineCheckCircle,
    HiOutlineMagnifyingGlass,
    HiOutlineXMark
} from 'react-icons/hi2';

interface RecordType {
    id: string;
    name: string;
    description: string;
}

interface UserOption {
    id: number;
    display_name: string;
    first_name?: string;
    last_name?: string;
}

interface PreviewData {
    users: Array<{ id: number; name: string; email: string }>;
    counts: Record<string, number>;
    total_records: number;
}

interface FOIAExportProps {
    currentUser: UserProfile;
}

const FOIAExport: React.FC<FOIAExportProps> = () => {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    
    // Selection state
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [userSearch, setUserSearch] = useState('');
    
    // Preview state
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    // Export state
    const [exporting, setExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    // Check access on mount - admin OR canViewAllRecords permission
    useEffect(() => {
        const checkAccess = async () => {
            // Admin always has access
            if (window.mentorshipPlatformData?.is_admin) {
                setHasAccess(true);
                return;
            }
            
            // Check role-based permission
            try {
                const response = await fetch(`${apiUrl}/professional-growth/my-permissions`, {
                    headers: { 'X-WP-Nonce': nonce },
                });
                if (response.ok) {
                    const perms = await response.json();
                    setHasAccess(perms.reportsPermissions?.canViewAllRecords ?? false);
                } else {
                    setHasAccess(false);
                }
            } catch (err) {
                console.error('Failed to check FOIA access:', err);
                setHasAccess(false);
            }
        };
        checkAccess();
    }, []);

    // Fetch users and record types on mount
    useEffect(() => {
        fetchUsers();
        fetchRecordTypes();
    }, []);

    const fetchUsers = async () => {
        try {
            const usersData = await getCachedUsers();
            const formatted: UserOption[] = usersData.map(u => ({
                id: u.user_id,
                display_name: u.display_name,
                first_name: u.first_name,
                last_name: u.last_name,
            }));
            setUsers(formatted);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError('Failed to load users');
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchRecordTypes = async () => {
        try {
            const response = await fetch(`${apiUrl}/foia-export/record-types`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setRecordTypes(data);
            }
        } catch (err) {
            console.error('Failed to fetch record types:', err);
        } finally {
            setLoadingTypes(false);
        }
    };

    // Filter users by search
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const search = userSearch.toLowerCase();
        return users.filter(u => 
            u.display_name.toLowerCase().includes(search) ||
            u.first_name?.toLowerCase().includes(search) ||
            u.last_name?.toLowerCase().includes(search)
        );
    }, [users, userSearch]);

    // Preview handler
    const handlePreview = async () => {
        if (selectedUsers.length === 0) {
            setError('Please select at least one user');
            return;
        }
        if (selectedTypes.length === 0) {
            setError('Please select at least one record type');
            return;
        }

        setLoadingPreview(true);
        setError(null);
        
        try {
            const response = await fetch(`${apiUrl}/foia-export/preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    user_ids: selectedUsers,
                    record_types: selectedTypes,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Preview failed');
            }

            const data = await response.json();
            setPreviewData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate preview');
        } finally {
            setLoadingPreview(false);
        }
    };

    // Export handler
    const handleExport = async () => {
        if (selectedUsers.length === 0 || selectedTypes.length === 0) {
            setError('Please select users and record types');
            return;
        }

        setExporting(true);
        setError(null);
        setExportSuccess(false);
        
        try {
            // Call download endpoint directly (it generates and returns the CSV)
            const response = await fetch(`${apiUrl}/foia-export/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    user_ids: selectedUsers,
                    record_types: selectedTypes,
                    date_from: dateFrom || null,
                    date_to: dateTo || null,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Export failed');
            }

            const data = await response.json();
            
            // Determine content type - default to Excel HTML format
            const contentType = data.content_type || 'application/vnd.ms-excel';
            
            // Create blob and trigger download
            const blob = new Blob([data.csv], { type: contentType + ';charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    // Toggle user selection
    const toggleUser = (userId: number) => {
        setSelectedUsers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
        setPreviewData(null); // Reset preview when selection changes
    };

    // Toggle record type selection
    const toggleRecordType = (typeId: string) => {
        setSelectedTypes(prev => 
            prev.includes(typeId) 
                ? prev.filter(id => id !== typeId)
                : [...prev, typeId]
        );
        setPreviewData(null);
    };

    // Select/deselect all users
    const toggleAllUsers = () => {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(filteredUsers.map(u => u.id));
        }
        setPreviewData(null);
    };

    // Select/deselect all record types
    const toggleAllTypes = () => {
        if (selectedTypes.length === recordTypes.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(recordTypes.map(t => t.id));
        }
        setPreviewData(null);
    };

    // Check if access is still loading
    if (hasAccess === null) {
        return (
            <div className="ap-max-w-4xl ap-mx-auto ap-p-6">
                <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                    <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-t-2 ap-border-b-2 ap-border-blue-600"></div>
                    <span className="ap-ml-3 ap-text-gray-600">Checking access permissions...</span>
                </div>
            </div>
        );
    }

    // Check if user has access (admin OR canViewAllRecords permission)
    if (!hasAccess) {
        return (
            <div className="ap-max-w-4xl ap-mx-auto ap-p-6">
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineShieldCheck className="ap-w-12 ap-h-12 ap-text-red-500 ap-mx-auto ap-mb-4" />
                    <h2 className="ap-text-xl ap-font-semibold ap-text-red-800 ap-mb-2">Access Denied</h2>
                    <p className="ap-text-red-600">Only administrators or users with "Can View All Records" permission can access the FOIA Records Export tool.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-6xl ap-mx-auto">
            {/* Header */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-p-6 ap-mb-6">
                <div className="ap-flex ap-items-center ap-gap-4 ap-mb-4">
                    <div className="ap-p-3 ap-bg-blue-50 ap-rounded-lg">
                        <HiOutlineDocumentArrowDown className="ap-w-8 ap-h-8 ap-text-blue-600" />
                    </div>
                    <div>
                        <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">FOIA Compliant Export</h1>
                        <p className="ap-text-gray-600">Export all records associated with selected users for compliance requests</p>
                    </div>
                </div>
                
                {/* Info Banner */}
                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineShieldCheck className="ap-w-5 ap-h-5 ap-text-blue-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div className="ap-text-sm ap-text-blue-800">
                        <p className="ap-font-medium ap-mb-1">Privacy Compliant Export</p>
                        <p>This export includes all records where the selected users are referenced (as creators, participants, assignees, etc.). 
                           Sensitive data such as passwords, login credentials, and authentication tokens are automatically excluded.</p>
                    </div>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-mb-6 ap-flex ap-items-center ap-gap-3">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-600 ap-flex-shrink-0" />
                    <p className="ap-text-red-800">{error}</p>
                    <Button 
                        onClick={() => setError(null)}
                        variant="ghost"
                        size="xs"
                        className="!ap-ml-auto !ap-text-red-600 hover:!ap-text-red-800 !ap-p-1 !ap-min-h-0"
                    >
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}

            {/* Success Alert */}
            {exportSuccess && (
                <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-mb-6 ap-flex ap-items-center ap-gap-3">
                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600 ap-flex-shrink-0" />
                    <p className="ap-text-green-800">Export completed successfully! Your download should start automatically.</p>
                </div>
            )}

            <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-2 ap-gap-6">
                {/* User Selection */}
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-p-6">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineUserGroup className="ap-w-5 ap-h-5 ap-text-blue-600" />
                            Select Users
                        </h2>
                        <Button
                            onClick={toggleAllUsers}
                            variant="ghost"
                            size="sm"
                            className="!ap-text-blue-600 hover:!ap-text-blue-700"
                        >
                            {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>

                    {/* User Search */}
                    <div className="ap-relative ap-mb-4">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                        <input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Search users..."
                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                        />
                    </div>

                    {/* User List */}
                    <div className="ap-max-h-80 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-lg">
                        {loadingUsers ? (
                            <div className="ap-p-4 ap-text-center ap-text-gray-500">Loading users...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="ap-p-4 ap-text-center ap-text-gray-500">No users found</div>
                        ) : (
                            filteredUsers.map(user => (
                                <label
                                    key={user.id}
                                    className={`ap-flex ap-items-center ap-gap-3 ap-p-3 ap-border-b ap-border-gray-100 last:ap-border-b-0 ap-cursor-pointer hover:ap-bg-gray-50 ${
                                        selectedUsers.includes(user.id) ? 'ap-bg-blue-50' : ''
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.includes(user.id)}
                                        onChange={() => toggleUser(user.id)}
                                        className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                    />
                                    <div>
                                        <div className="ap-font-medium ap-text-gray-900">{user.display_name}</div>
                                        <div className="ap-text-xs ap-text-gray-500">
                                            {user.last_name}, {user.first_name}
                                        </div>
                                    </div>
                                </label>
                            ))
                        )}
                    </div>

                    <div className="ap-mt-3 ap-text-sm ap-text-gray-600">
                        {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                    </div>
                </div>

                {/* Record Type Selection */}
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-p-6">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                        <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5 ap-text-blue-600" />
                            Select Record Types
                        </h2>
                        <Button
                            onClick={toggleAllTypes}
                            variant="ghost"
                            size="sm"
                            className="!ap-text-blue-600 hover:!ap-text-blue-700"
                        >
                            {selectedTypes.length === recordTypes.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>

                    {/* Record Type List */}
                    <div className="ap-space-y-2 ap-mb-6">
                        {loadingTypes ? (
                            <div className="ap-p-4 ap-text-center ap-text-gray-500">Loading record types...</div>
                        ) : (
                            recordTypes.map(type => (
                                <label
                                    key={type.id}
                                    className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-border ap-rounded-lg ap-cursor-pointer ap-transition-colors ${
                                        selectedTypes.includes(type.id) 
                                            ? 'ap-border-blue-500 ap-bg-blue-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTypes.includes(type.id)}
                                        onChange={() => toggleRecordType(type.id)}
                                        className="ap-w-4 ap-h-4 ap-mt-0.5 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                    />
                                    <div>
                                        <div className="ap-font-medium ap-text-gray-900">{type.name}</div>
                                        <div className="ap-text-sm ap-text-gray-500">{type.description}</div>
                                    </div>
                                </label>
                            ))
                        )}
                    </div>

                    {/* Date Range (Optional) */}
                    <div className="ap-border-t ap-border-gray-200 ap-pt-4">
                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-900 ap-mb-3 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineCalendar className="ap-w-4 ap-h-4" />
                            Date Range (Optional)
                        </h3>
                        <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                            <div>
                                <label className="ap-block ap-text-xs ap-text-gray-600 ap-mb-1">From</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => { setDateFrom(e.target.value); setPreviewData(null); }}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-text-sm"
                                />
                            </div>
                            <div>
                                <label className="ap-block ap-text-xs ap-text-gray-600 ap-mb-1">To</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => { setDateTo(e.target.value); setPreviewData(null); }}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-p-6 ap-mt-6">
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">Export Preview</h2>
                    <Button
                        onClick={handlePreview}
                        disabled={loadingPreview || selectedUsers.length === 0 || selectedTypes.length === 0}
                        variant="secondary"
                    >
                        {loadingPreview ? 'Loading...' : 'Generate Preview'}
                    </Button>
                </div>

                {previewData ? (
                    <div>
                        {/* Selected Users */}
                        <div className="ap-mb-4">
                            <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Selected Users:</h3>
                            {previewData.users.length > 20 ? (
                                <div className="ap-text-sm ap-text-gray-600">
                                    <span className="ap-font-medium ap-text-blue-600">{previewData.users.length}</span> users selected
                                    {previewData.users.length > 0 && (
                                        <span className="ap-text-gray-500 ap-ml-2">
                                            (including {previewData.users.slice(0, 3).map(u => u.name).join(', ')}, ...)
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="ap-flex ap-flex-wrap ap-gap-2">
                                    {previewData.users.map(user => (
                                        <span key={user.id} className="ap-px-3 ap-py-1 ap-bg-blue-50 ap-text-blue-600 ap-rounded-full ap-text-sm">
                                            {user.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Record Counts */}
                        <div className="ap-mb-4">
                            <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Record Counts:</h3>
                            <div className="ap-grid ap-grid-cols-2 sm:ap-grid-cols-3 md:ap-grid-cols-6 ap-gap-3">
                                {Object.entries(previewData.counts).map(([type, count]) => {
                                    const typeInfo = recordTypes.find(t => t.id === type);
                                    return (
                                        <div key={type} className="ap-bg-gray-50 ap-rounded-lg ap-p-3 ap-text-center">
                                            <div className="ap-text-2xl ap-font-bold ap-text-gray-900">{count}</div>
                                            <div className="ap-text-xs ap-text-gray-600">{typeInfo?.name || type}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4 ap-flex ap-items-center ap-justify-between">
                            <span className="ap-font-medium ap-text-gray-900">Total Records to Export:</span>
                            <span className="ap-text-2xl ap-font-bold ap-text-blue-600">{previewData.total_records}</span>
                        </div>
                    </div>
                ) : (
                    <div className="ap-text-center ap-py-8 ap-text-gray-500">
                        <p>Select users and record types, then click "Generate Preview" to see record counts.</p>
                    </div>
                )}
            </div>

            {/* Export Button */}
            <div className="ap-mt-6 ap-flex ap-justify-end">
                <Button
                    onClick={handleExport}
                    disabled={exporting || selectedUsers.length === 0 || selectedTypes.length === 0}
                    variant="primary"
                    className="!ap-flex !ap-items-center !ap-gap-2"
                >
                    {exporting ? (
                        <>
                            <svg className="ap-animate-spin ap-w-5 ap-h-5" fill="none" viewBox="0 0 24 24">
                                <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Exporting...
                        </>
                    ) : (
                        <>
                            <HiOutlineDocumentArrowDown className="ap-w-5 ap-h-5" />
                            Export to Excel
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default FOIAExport;
