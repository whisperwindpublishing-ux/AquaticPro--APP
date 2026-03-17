import React, { useState, useEffect } from 'react';
import { createPortal as _createPortal } from 'react-dom';
import { parseLocalDate, formatLocalDate } from '../utils/dateUtils';
import {
    HiOutlineUserPlus as AddUserIcon,
    HiOutlinePencil as EditIcon,
    HiOutlineTrash as DeleteIcon,
    HiOutlineArchiveBox as ArchiveIcon,
    HiOutlineArchiveBoxXMark as UnarchiveIcon,
    HiOutlineArrowUpTray as UploadIcon,
    HiOutlineArrowDownTray as DownloadIcon,
    HiOutlineMagnifyingGlass as SearchIcon,
    HiOutlineCheckCircle,
    HiOutlineXMark,
    HiOutlineArrowLeftCircle
} from 'react-icons/hi2';
import {
    getUsersWithMetadata,
    createUser,
    updateUser,
    deleteUser,
    archiveUser,
    unarchiveUser,
    setMemberStatus,
    bulkImportUsers,
    bulkAssignJobRole,
    downloadCSVTemplate,
    UserMetadata,
    CreateUserData
} from '@/services/api-user-management';
import { invalidateUserCache } from '@/services/userCache';
import { getJobRoles, JobRole, getUserAssignments, assignUserToRole, removeAssignment, UserJobAssignment } from '@/services/api-professional-growth';
import { getWpRoles } from '@/services/api-professional-growth';
import { getEmployeeWorkYears, addEmployeeWorkYear, deleteEmployeeWorkYear, EmployeeWorkYear, getAllEmployeePay } from '@/services/seasonalReturnsService';
import type { EmployeePayData } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';
import { UserCertificateSection } from './certificates';

type SortField = 'name' | 'email' | 'job_role' | 'tier' | 'hire_date' | 'last_login';
type SortDirection = 'asc' | 'desc';

interface UserManagementProps {
    initialSearch?: string;
    returnToPage?: string | null;
    onClearReturn?: () => void;
    enableSeasonalReturns?: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({
    initialSearch = '',
    returnToPage = null,
    onClearReturn,
    enableSeasonalReturns: _enableSeasonalReturns = true
}) => {
    // Data state
    const [allUsers, setAllUsers] = useState<UserMetadata[]>([]); // Current page of users
    const [filteredUsers, setFilteredUsers] = useState<UserMetadata[]>([]);
    const [employeePayData, setEmployeePayData] = useState<Map<number, EmployeePayData>>(new Map());
    const [loadingPayData, setLoadingPayData] = useState(false);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [_wpRoles, setWpRoles] = useState<Array<{ slug: string; name: string }>>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [loading, setLoading] = useState(true);
    
    // Pagination removed - load all users at once
    const [totalUsers, setTotalUsers] = useState(0);
    
    // Filter and search state - use initialSearch if provided
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearch);
    const [showArchived, setShowArchived] = useState(false);
    const [memberFilter, setMemberFilter] = useState<'all' | 'members' | 'non-members'>('members'); // Default to Members Only
    const [filterJobRole, setFilterJobRole] = useState<number | null>(null);
    const [filterTier, setFilterTier] = useState<number | null>(null);
    const [filterNewHire, setFilterNewHire] = useState<'all' | 'new_hires' | 'not_new_hires'>('all');
    const [filterNoRole, setFilterNoRole] = useState(false);
    
    // Sorting state
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // User assignments state (for editing users)
    const [userAssignments, setUserAssignments] = useState<UserJobAssignment[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newRoleId, setNewRoleId] = useState<number>(0);
    const [addingRole, setAddingRole] = useState(false);
    
    // Work years state
    const [workYears, setWorkYears] = useState<EmployeeWorkYear[]>([]);
    const [loadingWorkYears, setLoadingWorkYears] = useState(false);
    const [newWorkYears, setNewWorkYears] = useState('');
    const [addingWorkYear, setAddingWorkYear] = useState(false);
    
    // Bulk selection state
    const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
    const [bulkJobRoleId, setBulkJobRoleId] = useState<number>(0);
    const [bulkEditTab, setBulkEditTab] = useState<'job_roles' | 'work_years' | 'metadata' | 'archive' | 'member_status'>('metadata');
    const [bulkHireDate, setBulkHireDate] = useState('');
    const [bulkEligibleForRehire, setBulkEligibleForRehire] = useState<boolean | null>(null);
    const [bulkIsNewHire, setBulkIsNewHire] = useState<boolean | null>(null);
    const [bulkWorkYearsToAdd, setBulkWorkYearsToAdd] = useState('');
    const [bulkWorkYearsToRemove, setBulkWorkYearsToRemove] = useState('');
    const [bulkArchiveAction, setBulkArchiveAction] = useState<'archive' | 'unarchive' | null>(null);
    const [bulkMemberStatus, setBulkMemberStatus] = useState<boolean | null>(null);
    const [applyingBulkEdit, setApplyingBulkEdit] = useState(false);

    // Form state
    const [formData, setFormData] = useState<CreateUserData>({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        employee_id: '',
        hire_date: '',
        notes: '',
        eligible_for_rehire: true,
        job_role_id: 0,
        send_email: false,
        address: '',
        is_new_hire: false
    });

    // Bulk import state
    const [csvData, setCsvData] = useState('');
    const [sendEmailsBulk, setSendEmailsBulk] = useState(false);
    const [importResults, setImportResults] = useState<any>(null);
    const [importing, setImporting] = useState(false);

    // Debounce search term to avoid excessive API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500); // Wait 500ms after user stops typing
        
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Load data when filters change
    useEffect(() => {
        loadData();
    }, [debouncedSearchTerm, showArchived, memberFilter, filterJobRole, filterTier]);

    // Load job roles and WP roles on mount
    useEffect(() => {
        loadRoles();
        loadPayData();
    }, []);
    
    const loadPayData = async () => {
        try {
            setLoadingPayData(true);
            const data = await getAllEmployeePay();
            const payMap = new Map<number, EmployeePayData>();
            data.forEach(emp => {
                payMap.set(emp.user_id, emp);
            });
            setEmployeePayData(payMap);
        } catch (err) {
            console.error('Failed to load pay data:', err);
        } finally {
            setLoadingPayData(false);
        }
    };
    
    const reloadUserPayData = async (userId: number) => {
        try {
            const data = await getAllEmployeePay();
            const payMap = new Map(employeePayData);
            const userPay = data.find(emp => emp.user_id === userId);
            if (userPay) {
                payMap.set(userId, userPay);
                setEmployeePayData(payMap);
            }
        } catch (err) {
            console.error('Failed to reload pay data:', err);
        }
    };

    const loadRoles = async () => {
        try {
            setLoadingRoles(true);
            const [rolesData, wpRolesData] = await Promise.all([
                getJobRoles(),
                getWpRoles()
            ]);
            
            console.log('Job roles loaded:', rolesData);
            setJobRoles(rolesData);
            
            console.log('WP roles loaded:', wpRolesData);
            setWpRoles(wpRolesData);
        } catch (err: any) {
            console.error('Failed to load roles:', err);
        } finally {
            setLoadingRoles(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            console.log('Loading all users with filters:', {
                search: debouncedSearchTerm,
                archived: showArchived,
                memberFilter: memberFilter,
                jobRole: filterJobRole,
                tier: filterTier
            });
            
            // Load all users without pagination (set perPage to high number)
            const archivedStatus = showArchived ? 'true' : 'false';
            // Convert member filter to API param
            const memberParam = memberFilter === 'members' ? 'true' : memberFilter === 'non-members' ? 'false' : 'all';
            
            const response = await getUsersWithMetadata(
                archivedStatus,
                debouncedSearchTerm || '',
                1,
                9999, // Load all users
                undefined, // fields
                memberParam
            );
            
            console.log('Users loaded:', response.length);
            setAllUsers(response);
            setTotalUsers(response.length);
            
            setError(null);
        } catch (err: any) {
            const errorMsg = err?.message || err?.toString() || 'Failed to load data';
            setError(errorMsg);
            console.error('Load data error:', err);
        } finally {
            setLoading(false);
        }
    };

    const applyClientSideFiltersAndSort = () => {
        // Apply client-side filters (job role and tier) since backend doesn't support them yet
        let filtered = [...allUsers];

        // Filter by job role
        if (filterJobRole !== null && filterJobRole > 0) {
            filtered = filtered.filter(u => {
                // Check if user has this role in their job_role_ids (comma-separated string)
                if (u.job_role_ids) {
                    const roleIds = u.job_role_ids.split(',').map(id => Number(id.trim()));
                    return roleIds.includes(filterJobRole);
                }
                // Fallback to single job_role_id
                return u.job_role_id === filterJobRole;
            });
        }

        // Filter by tier
        if (filterTier !== null && filterTier > 0) {
            filtered = filtered.filter(u => u.tier === filterTier);
        }

        // Filter by new hire status
        if (filterNewHire === 'new_hires') {
            filtered = filtered.filter(u => u.is_new_hire === true || u.is_new_hire === 1);
        } else if (filterNewHire === 'not_new_hires') {
            filtered = filtered.filter(u => !u.is_new_hire || u.is_new_hire === 0);
        }

        // Filter by no job role assigned
        if (filterNoRole) {
            filtered = filtered.filter(u => {
                // User has no role if job_role_ids is empty/null AND job_role_id is null/0
                const hasNoRoleIds = !u.job_role_ids || u.job_role_ids.trim() === '';
                const hasNoRoleId = !u.job_role_id || u.job_role_id === 0;
                return hasNoRoleIds && hasNoRoleId;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal: any;
            let bVal: any;

            switch (sortField) {
                case 'name': {
                    // Sort by last name, then first name
                    const aNames = a.display_name.split(' ');
                    const bNames = b.display_name.split(' ');
                    const aLast = (aNames.length > 1 ? aNames[aNames.length - 1] : a.display_name).toLowerCase();
                    const bLast = (bNames.length > 1 ? bNames[bNames.length - 1] : b.display_name).toLowerCase();
                    const aFirst = (aNames.length > 1 ? aNames.slice(0, -1).join(' ') : '').toLowerCase();
                    const bFirst = (bNames.length > 1 ? bNames.slice(0, -1).join(' ') : '').toLowerCase();
                    
                    const lastNameCompare = aLast.localeCompare(bLast);
                    if (lastNameCompare !== 0) {
                        return sortDirection === 'asc' ? lastNameCompare : -lastNameCompare;
                    }
                    const firstNameCompare = aFirst.localeCompare(bFirst);
                    return sortDirection === 'asc' ? firstNameCompare : -firstNameCompare;
                }
                case 'email':
                    aVal = (a.user_email || '').toLowerCase();
                    bVal = (b.user_email || '').toLowerCase();
                    break;
                case 'job_role':
                    aVal = (a.job_role_title || '').toLowerCase();
                    bVal = (b.job_role_title || '').toLowerCase();
                    break;
                case 'tier':
                    aVal = a.tier || 0;
                    bVal = b.tier || 0;
                    break;
                case 'hire_date':
                    aVal = a.hire_date ? parseLocalDate(a.hire_date).getTime() : 0;
                    bVal = b.hire_date ? parseLocalDate(b.hire_date).getTime() : 0;
                    break;
                case 'last_login':
                    aVal = a.last_login ? parseLocalDate(a.last_login).getTime() : 0;
                    bVal = b.last_login ? parseLocalDate(b.last_login).getTime() : 0;
                    break;
                default: {
                    // Default also sorts by last name
                    const aNames = a.display_name.split(' ');
                    const bNames = b.display_name.split(' ');
                    const aLast = (aNames.length > 1 ? aNames[aNames.length - 1] : a.display_name).toLowerCase();
                    const bLast = (bNames.length > 1 ? bNames[bNames.length - 1] : b.display_name).toLowerCase();
                    const aFirst = (aNames.length > 1 ? aNames.slice(0, -1).join(' ') : '').toLowerCase();
                    const bFirst = (bNames.length > 1 ? bNames.slice(0, -1).join(' ') : '').toLowerCase();
                    
                    const lastNameCompare = aLast.localeCompare(bLast);
                    if (lastNameCompare !== 0) {
                        return sortDirection === 'asc' ? lastNameCompare : -lastNameCompare;
                    }
                    const firstNameCompare = aFirst.localeCompare(bFirst);
                    return sortDirection === 'asc' ? firstNameCompare : -firstNameCompare;
                }
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredUsers(filtered);
    };

    // Apply client-side filters whenever allUsers or filters change
    useEffect(() => {
        applyClientSideFiltersAndSort();
    }, [allUsers, filterJobRole, filterTier, filterNewHire, filterNoRole, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // Toggle direction
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New field, default to ascending
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (sortField !== field) {
            return <span className="ap-text-gray-400 ap-ml-1">↕</span>;
        }
        return <span className="ap-ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    const handleOpenModal = (user?: UserMetadata) => {
        // Open modal IMMEDIATELY - don't wait for API calls
        setIsModalOpen(true);
        
        if (user) {
            setEditingUser(user);
            // Use first_name and last_name from API response, with fallback to parsing display_name
            let firstName = user.first_name || '';
            let lastName = user.last_name || '';
            
            // Only fall back to parsing display_name if both are empty
            if (!firstName && !lastName && user.display_name) {
                const cleanDisplayName = user.display_name.replace(/\d+$/, '').trim();
                const nameParts = cleanDisplayName.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }
            
            setFormData({
                first_name: firstName,
                last_name: lastName,
                email: user.user_email || '',
                phone_number: user.phone_number || '',
                employee_id: user.employee_id || '',
                hire_date: user.hire_date || '',
                notes: user.notes || '',
                eligible_for_rehire: user.eligible_for_rehire !== false,
                job_role_id: user.job_role_id || 0,
                send_email: false,
                address: user.address || '',
                is_new_hire: user.is_new_hire === true || user.is_new_hire === 1 || user.is_new_hire === '1'
            });
            
            // Load user's job assignments in background
            setLoadingAssignments(true);
            getUserAssignments(user.user_id)
                .then(assignments => setUserAssignments(assignments))
                .catch(err => {
                    console.error('Failed to load user assignments:', err);
                    setUserAssignments([]);
                })
                .finally(() => setLoadingAssignments(false));
            
            // Load user's work years in background
            setLoadingWorkYears(true);
            getEmployeeWorkYears(user.user_id)
                .then(years => setWorkYears(years))
                .catch(err => {
                    console.error('Failed to load work years:', err);
                    setWorkYears([]);
                })
                .finally(() => setLoadingWorkYears(false));
            
            // Reload pay data for this user to get latest calculation
            reloadUserPayData(user.user_id);
        } else {
            setEditingUser(null);
            setUserAssignments([]);
            setWorkYears([]);
            setLoadingAssignments(false);
            setLoadingWorkYears(false);
            setFormData({
                first_name: '',
                last_name: '',
                email: '',
                phone_number: '',
                employee_id: '',
                hire_date: '',
                notes: '',
                eligible_for_rehire: true,
                job_role_id: 0,
                send_email: false
            });
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setUserAssignments([]);
        setWorkYears([]);
        setNewWorkYears('');
        setNewRoleId(0);
        setSuccessMessage(null);
    };
    
    const handleAddRole = async () => {
        if (!editingUser || !newRoleId) {
            return;
        }
        
        try {
            setAddingRole(true);
            
            // NEVER sync WP role for administrators - always set to false for safety
            // Backend has additional protection layers
            await assignUserToRole({
                user_id: editingUser.user_id,
                job_role_id: newRoleId,
                sync_wp_role: false  // Never auto-sync - let users keep their WP roles
            });
            
            // Reload assignments
            const assignments = await getUserAssignments(editingUser.user_id);
            setUserAssignments(assignments);
            setNewRoleId(0);
            setSuccessMessage('Role assigned successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to assign role');
        } finally {
            setAddingRole(false);
        }
    };
    
    const handleRemoveRole = async (assignmentId: number) => {
        if (!editingUser) {
            return;
        }
        
        if (!confirm('Remove this job role assignment?')) {
            return;
        }
        
        try {
            await removeAssignment(assignmentId);
            
            // Reload assignments
            const assignments = await getUserAssignments(editingUser.user_id);
            setUserAssignments(assignments);
            setSuccessMessage('Role removed successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to remove role');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            if (editingUser) {
                // Update existing user
                await updateUser(editingUser.user_id, {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    phone_number: formData.phone_number,
                    employee_id: formData.employee_id,
                    hire_date: formData.hire_date,
                    notes: formData.notes,
                    wp_role: (formData as any).wp_role,
                    job_role_id: formData.job_role_id || 0,
                    eligible_for_rehire: formData.eligible_for_rehire,
                    address: formData.address,
                    is_new_hire: formData.is_new_hire
                });
                setSuccessMessage('User updated successfully!');
                invalidateUserCache(); // Clear cache so other components get fresh data
            } else {
                // Create new user
                const result = await createUser(formData);
                setSuccessMessage(`User created! Username: ${result.username}, Password: ${result.password}`);
                invalidateUserCache(); // Clear cache so other components get fresh data
            }
            
            await loadData();
            setSubmitting(false);
            setTimeout(() => {
                handleCloseModal();
            }, 3000);
        } catch (err: any) {
            setSubmitting(false);
            setError(err.message || 'Failed to save user');
        }
    };

    const handleDelete = async (userId: number, displayName: string) => {
        if (!confirm(`Are you sure you want to permanently delete ${displayName}? This cannot be undone.`)) {
            return;
        }

        try {
            await deleteUser(userId);
            invalidateUserCache(); // Clear cache so other components get fresh data
            await loadData();
            setSuccessMessage('User deleted successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to delete user');
        }
    };

    const handleArchive = async (userId: number, displayName: string) => {
        if (!confirm(`Archive ${displayName}? They will be hidden from active lists.`)) {
            return;
        }

        try {
            await archiveUser(userId);
            invalidateUserCache(); // Clear cache so other components get fresh data
            await loadData();
            setSuccessMessage('User archived successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to archive user');
        }
    };

    const handleUnarchive = async (userId: number, displayName: string) => {
        if (!confirm(`Restore ${displayName} to active status?`)) {
            return;
        }

        try {
            await unarchiveUser(userId);
            invalidateUserCache(); // Clear cache so other components get fresh data
            await loadData();
            setSuccessMessage('User restored successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to restore user');
        }
    };

    const handleSetMemberStatus = async (userId: number, isMember: boolean | null, displayName: string) => {
        const confirmMsg = isMember === null 
            ? `Reset ${displayName}'s member status to auto-detect (based on job roles)?`
            : `Set ${displayName} as ${isMember ? 'an employee (member)' : 'a site user (visitor)'}?`;
        
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            const result = await setMemberStatus(userId, isMember);
            invalidateUserCache();
            await loadData();
            setSuccessMessage(result.message);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to update member status');
            setTimeout(() => setError(null), 3000);
        }
    };
    
    // Parse multi-year format (single, range, or comma-separated)
    const parseYearInput = (input: string): number[] => {
        const years: number[] = [];
        const parts = input.split(',').map(p => p.trim());
        
        for (const part of parts) {
            if (part.includes('-')) {
                // Range format: "2020-2024"
                const [start, end] = part.split('-').map(y => parseInt(y.trim()));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let year = start; year <= end; year++) {
                        if (!years.includes(year)) years.push(year);
                    }
                }
            } else {
                // Single year
                const year = parseInt(part);
                if (!isNaN(year) && !years.includes(year)) {
                    years.push(year);
                }
            }
        }
        
        return years.sort((a, b) => a - b);
    };

    const handleAddWorkYears = async () => {
        if (!editingUser || !newWorkYears.trim()) return;
        
        const years = parseYearInput(newWorkYears);
        if (years.length === 0) {
            setError('Please enter valid year(s)');
            setTimeout(() => setError(null), 3000);
            return;
        }
        
        setAddingWorkYear(true);
        try {
            // Add each year
            for (const year of years) {
                await addEmployeeWorkYear(editingUser.user_id, year, '');
            }
            
            // Reload work years
            const updatedYears = await getEmployeeWorkYears(editingUser.user_id);
            setWorkYears(updatedYears);
            setNewWorkYears('');
            
            // Reload pay data since work years affect pay calculation
            await reloadUserPayData(editingUser.user_id);
            
            setSuccessMessage(`Added ${years.length} work year(s)`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to add work year(s)');
            setTimeout(() => setError(null), 3000);
        } finally {
            setAddingWorkYear(false);
        }
    };

    const handleDeleteWorkYear = async (workYearId: number) => {
        if (!editingUser) return;
        
        try {
            await deleteEmployeeWorkYear(workYearId);
            const updatedYears = await getEmployeeWorkYears(editingUser.user_id);
            setWorkYears(updatedYears);
            
            // Reload pay data since work years affect pay calculation
            await reloadUserPayData(editingUser.user_id);
            
            setSuccessMessage('Work year removed');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to remove work year');
            setTimeout(() => setError(null), 3000);
        }
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!csvData.trim()) {
            setError('Please paste CSV data or upload a CSV file');
            return;
        }

        setImporting(true);
        try {
            const result = await bulkImportUsers(csvData, sendEmailsBulk);
            setImportResults(result);
            setCsvData('');
            invalidateUserCache(); // Clear cache so other components get fresh data
            await loadData();
        } catch (err: any) {
            setError(err.message || 'Failed to import users');
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            setError('Please upload a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setCsvData(text);
        };
        reader.onerror = () => {
            setError('Failed to read file');
        };
        reader.readAsText(file);
    };

    const getTierLabel = (tier: number | undefined): string => {
        if (!tier) return '-';
        return `Tier ${tier}`;
    };

    // Bulk selection handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = filteredUsers.filter(u => !u.archived).map(u => u.user_id);
            setSelectedUsers(new Set(allIds));
        } else {
            setSelectedUsers(new Set());
        }
    };

    const handleSelectUser = (userId: number) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleBulkEdit = async () => {
        if (selectedUsers.size === 0) {
            setError('Please select at least one user');
            return;
        }

        try {
            setApplyingBulkEdit(true);
            const userIds = Array.from(selectedUsers);
            let successCount = 0;
            let errors: string[] = [];

            // Job Role Assignment
            if (bulkEditTab === 'job_roles' && bulkJobRoleId > 0) {
                try {
                    const result = await bulkAssignJobRole(userIds, bulkJobRoleId, false);
                    successCount = userIds.length;
                    setSuccessMessage(result.message);
                } catch (err: any) {
                    errors.push(`Job role assignment failed: ${err.message}`);
                }
            }

            // Work Years
            if (bulkEditTab === 'work_years') {
                for (const userId of userIds) {
                    try {
                        // Add work years
                        if (bulkWorkYearsToAdd) {
                            await addEmployeeWorkYear(userId, parseInt(bulkWorkYearsToAdd), '');
                        }
                        
                        // Remove work years
                        if (bulkWorkYearsToRemove) {
                            const yearsToRemove = bulkWorkYearsToRemove.split(/[,\s]+/).map(y => parseInt(y.trim())).filter(y => !isNaN(y));
                            const userWorkYears = await getEmployeeWorkYears(userId);
                            
                            for (const year of yearsToRemove) {
                                const workYear = userWorkYears.find(wy => wy.work_year === year);
                                if (workYear) {
                                    await deleteEmployeeWorkYear(workYear.id);
                                }
                            }
                        }
                        successCount++;
                    } catch (err: any) {
                        errors.push(`User ${userId}: ${err.message}`);
                    }
                }
                if (successCount > 0) {
                    setSuccessMessage(`Updated work years for ${successCount} user${successCount !== 1 ? 's' : ''}`);
                }
            }

            // Metadata (hire date, eligible for rehire, is_new_hire)
            if (bulkEditTab === 'metadata') {
                for (const userId of userIds) {
                    try {
                        const user = allUsers.find(u => u.user_id === userId);
                        if (!user) continue;

                        const updates: any = {};
                        if (bulkHireDate) updates.hire_date = bulkHireDate;
                        if (bulkEligibleForRehire !== null) updates.eligible_for_rehire = bulkEligibleForRehire;
                        if (bulkIsNewHire !== null) updates.is_new_hire = bulkIsNewHire;

                        if (Object.keys(updates).length > 0) {
                            await updateUser(userId, {
                                first_name: user.first_name,
                                last_name: user.last_name,
                                email: user.user_email,
                                phone_number: user.phone_number || '',
                                employee_id: user.employee_id || '',
                                hire_date: updates.hire_date || user.hire_date || '',
                                notes: user.notes || '',
                                eligible_for_rehire: updates.eligible_for_rehire ?? user.eligible_for_rehire ?? true,
                                is_new_hire: updates.is_new_hire
                            });
                            successCount++;
                        }
                    } catch (err: any) {
                        errors.push(`User ${userId}: ${err.message}`);
                    }
                }
                if (successCount > 0) {
                    setSuccessMessage(`Updated metadata for ${successCount} user${successCount !== 1 ? 's' : ''}`);
                }
            }

            // Archive/Unarchive
            if (bulkEditTab === 'archive' && bulkArchiveAction) {
                for (const userId of userIds) {
                    try {
                        if (bulkArchiveAction === 'archive') {
                            await archiveUser(userId);
                        } else {
                            await unarchiveUser(userId);
                        }
                        successCount++;
                    } catch (err: any) {
                        errors.push(`User ${userId}: ${err.message}`);
                    }
                }
                if (successCount > 0) {
                    const action = bulkArchiveAction === 'archive' ? 'Archived' : 'Unarchived';
                    setSuccessMessage(`${action} ${successCount} user${successCount !== 1 ? 's' : ''}`);
                }
            }

            // Member Status
            if (bulkEditTab === 'member_status' && bulkMemberStatus !== null) {
                for (const userId of userIds) {
                    try {
                        await setMemberStatus(userId, bulkMemberStatus);
                        successCount++;
                    } catch (err: any) {
                        errors.push(`User ${userId}: ${err.message}`);
                    }
                }
                if (successCount > 0) {
                    const status = bulkMemberStatus ? 'members' : 'non-members';
                    setSuccessMessage(`Set ${successCount} user${successCount !== 1 ? 's' : ''} as ${status}`);
                }
            }

            if (errors.length > 0) {
                setError(`Completed with errors: ${errors.join('; ')}`);
            }

            // Close modal and refresh
            setIsBulkActionOpen(false);
            setSelectedUsers(new Set());
            setBulkJobRoleId(0);
            setBulkHireDate('');
            setBulkEligibleForRehire(null);
            setBulkIsNewHire(null);
            setBulkWorkYearsToAdd('');
            setBulkWorkYearsToRemove('');
            setBulkArchiveAction(null);
            setBulkMemberStatus(null);
            await loadData();
            await loadPayData();
        } catch (err: any) {
            setError(err.message || 'Failed to apply bulk edit');
        } finally {
            setApplyingBulkEdit(false);
        }
    };



    const nonArchivedUsers = filteredUsers.filter(u => !u.archived);
    const allSelected = nonArchivedUsers.length > 0 && selectedUsers.size === nonArchivedUsers.length;

    const userForm = (
        <form onSubmit={handleSubmit} className="ap-flex ap-flex-col ap-h-full ap-max-h-[90vh] ap-bg-white">
            {/* Header */}
            <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                    {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <Button
                    type="button"
                    onClick={handleCloseModal}
                    variant="ghost"
                    size="xs"
                    className="!ap-p-2 !ap-rounded-full !ap-text-gray-400 hover:!ap-bg-gray-200 hover:!ap-text-gray-500"
                >
                    <svg className="ap-w-6 ap-h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="ap-flex-1 ap-overflow-y-auto ap-p-6 ap-min-h-0">
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                    {/* First Name */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            First Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Last Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Email *
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={formData.phone_number}
                            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>

                    {/* Employee ID */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Employee ID
                        </label>
                        <input
                            type="text"
                            value={formData.employee_id}
                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>

                    {/* Hire Date */}
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Hire Date
                        </label>
                        <input
                            type="date"
                            value={formData.hire_date}
                            onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>
                    
                    {/* Address */}
                    <div className="md:ap-col-span-2">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Address
                        </label>
                        <input
                            type="text"
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="123 Main St, City, State 12345"
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                    </div>
                    
                    {/* Checkboxes Row */}
                    <div className="ap-flex ap-items-center ap-gap-6">
                        {/* Eligible for Rehire */}
                        <label className="ap-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.eligible_for_rehire !== false}
                                onChange={(e) => setFormData({ ...formData, eligible_for_rehire: e.target.checked })}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-font-medium ap-text-gray-700">
                                Eligible for Rehire
                            </span>
                        </label>
                        
                        {/* Is New Hire */}
                        <label className="ap-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_new_hire === true}
                                onChange={(e) => setFormData({ ...formData, is_new_hire: e.target.checked })}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-font-medium ap-text-gray-700">
                                New Hire
                            </span>
                        </label>
                    </div>

                    {/* Job Roles Section (only for editing existing users) */}
                    {editingUser ? (
                        <div className="md:ap-col-span-2">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Job Role Assignments
                            </label>
                            
                            {/* Loading state */}
                            {loadingAssignments ? (
                                <div className="ap-flex ap-items-center ap-justify-center ap-py-4">
                                    <LoadingSpinner size="sm" />
                                    <span className="ap-ml-2 ap-text-sm ap-text-gray-500">Loading assignments...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Current Assignments */}
                                    <div className="ap-space-y-2 ap-mb-3">
                                        {userAssignments.length === 0 ? (
                                            <div className="ap-text-sm ap-text-gray-500 ap-italic">
                                                No job roles assigned yet
                                            </div>
                                        ) : (
                                            userAssignments.map((assignment) => (
                                                <div 
                                                    key={assignment.id} 
                                                    className="ap-flex ap-items-center ap-justify-between ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-px-3 ap-py-2"
                                                >
                                                    <div className="ap-flex-1">
                                                        <span className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                            {assignment.job_role_title}
                                                        </span>
                                                        <span className="ap-ml-2 ap-inline-flex ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                                            Tier {assignment.tier}
                                                        </span>
                                                        {assignment.assigned_date && (
                                                            <span className="ap-ml-2 ap-text-xs ap-text-gray-500">
                                                                Assigned {formatLocalDate(assignment.assigned_date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleRemoveRole(assignment.id!)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="ap-ml-2 !ap-text-red-600 hover:!ap-text-red-800 !ap-p-0.5 !ap-min-h-0"
                                                        title="Remove this assignment"
                                                    >
                                                        <DeleteIcon className="ap-h-5 ap-w-5" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    
                                    {/* Add New Assignment */}
                                    <div className="ap-flex ap-gap-2">
                                        {loadingRoles ? (
                                            <div className="ap-flex ap-items-center ap-flex-1 ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg ap-bg-gray-50">
                                                <LoadingSpinner size="sm" />
                                                <span className="ap-ml-2 ap-text-sm ap-text-gray-500">Loading job roles...</span>
                                            </div>
                                        ) : (
                                            <select
                                                value={newRoleId}
                                                onChange={(e) => setNewRoleId(parseInt(e.target.value))}
                                                className="ap-flex-1 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                                disabled={addingRole}
                                            >
                                                <option value={0}>-- Select Role to Add --</option>
                                                {jobRoles
                                                    .filter(role => !userAssignments.some(a => a.job_role_id === role.id))
                                                    .map(role => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.title} (Tier {role.tier})
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        )}
                                        <Button
                                            type="button"
                                            onClick={handleAddRole}
                                            disabled={!newRoleId || addingRole || loadingRoles}
                                            variant="primary"
                                        >
                                            {addingRole ? 'Adding...' : 'Add Role'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* For new users, show simple dropdown */
                        <div>
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Job Role
                            </label>
                            {loadingRoles ? (
                                <div className="ap-flex ap-items-center ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg ap-bg-gray-50">
                                    <LoadingSpinner size="sm" />
                                    <span className="ap-ml-2 ap-text-sm ap-text-gray-500">Loading job roles...</span>
                                </div>
                            ) : (
                                <select
                                    value={formData.job_role_id}
                                    onChange={(e) => setFormData({ ...formData, job_role_id: parseInt(e.target.value) })}
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                >
                                    <option value={0}>-- Select Job Role --</option>
                                    {jobRoles.map(role => (
                                        <option key={role.id} value={role.id}>
                                            {role.title} (Tier {role.tier})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>
                {/* End of grid */}
                
                {/* Work Years - only for editing existing users */}
                {editingUser && (
                    <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                        <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Work Years</h4>
                        {loadingWorkYears ? (
                            <div className="ap-flex ap-justify-center ap-py-4">
                                <div className="ap-animate-spin ap-rounded-full ap-h-6 ap-w-6 ap-border-b-2 ap-border-blue-500"></div>
                            </div>
                        ) : (
                            <>
                                <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-3">
                                    {workYears.length === 0 ? (
                                        <span className="ap-text-sm ap-text-gray-500 ap-italic">No work years recorded</span>
                                    ) : (
                                        workYears.sort((a, b) => a.work_year - b.work_year).map((wy) => (
                                            <span
                                                key={wy.id}
                                                className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-rounded-full ap-text-sm ${
                                                    wy.verified ? 'ap-bg-green-100 ap-text-green-800' : 'ap-bg-gray-100 ap-text-gray-800'
                                                }`}
                                            >
                                                {wy.work_year}
                                                {wy.verified && <HiOutlineCheckCircle className="ap-w-3 ap-h-3" />}
                                                <Button
                                                    onClick={() => handleDeleteWorkYear(wy.id)}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="ap-ml-1 !ap-text-red-600 hover:!ap-text-red-800 !ap-p-0 !ap-min-h-0"
                                                    title="Remove year"
                                                >
                                                    <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                </Button>
                                            </span>
                                        ))
                                    )}
                                </div>
                                <div className="ap-flex ap-gap-2">
                                    <input
                                        type="text"
                                        value={newWorkYears}
                                        onChange={(e) => setNewWorkYears(e.target.value)}
                                        placeholder="e.g., 2024 or 2020-2024"
                                        className="ap-flex-1 ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleAddWorkYears}
                                        disabled={addingWorkYear || !newWorkYears}
                                        variant="primary"
                                    >
                                        {addingWorkYear ? 'Adding...' : 'Add Year(s)'}
                                    </Button>
                                </div>
                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                    Enter: single year (2024), range (2020-2024), or comma-separated (2020,2022,2024)
                                </p>
                            </>
                        )}
                    </div>
                )}
                
                {/* Pay Breakdown - only for editing existing users */}
                {editingUser && (() => {
                    const payData = employeePayData.get(editingUser.user_id);
                    if (!payData?.pay_breakdown) return null;
                    const breakdown = payData.pay_breakdown;
                    
                    return (
                        <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Pay Breakdown</h4>
                            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4 ap-space-y-3">
                                <div className="ap-flex ap-items-center ap-justify-between">
                                    <span className="ap-text-sm ap-text-gray-600">Total Hourly Rate:</span>
                                    <span className="ap-text-lg ap-font-bold ap-text-green-600">
                                        ${(breakdown.total || 0).toFixed(2)}/hr
                                    </span>
                                </div>
                                <div className="ap-grid ap-grid-cols-2 ap-gap-3 ap-text-sm">
                                    <div>
                                        <span className="ap-text-gray-600">Base Rate:</span>
                                        <span className="ap-ml-2 ap-font-medium">${(breakdown.base_rate || 0).toFixed(2)}/hr</span>
                                    </div>
                                    <div>
                                        <span className="ap-text-gray-600">Role Bonus:</span>
                                        <span className="ap-ml-2 ap-font-medium">${(breakdown.role_bonus?.amount || 0).toFixed(2)}/hr</span>
                                    </div>
                                    <div>
                                        <span className="ap-text-gray-600">Longevity:</span>
                                        <span className="ap-ml-2 ap-font-medium">${(breakdown.longevity?.bonus || 0).toFixed(2)}/hr</span>
                                    </div>
                                    {(breakdown.time_bonus_total || 0) > 0 && (
                                        <div>
                                            <span className="ap-text-gray-600">Time Bonuses:</span>
                                            <span className="ap-ml-2 ap-font-medium">${breakdown.time_bonus_total.toFixed(2)}/hr</span>
                                        </div>
                                    )}
                                </div>
                                <div className="ap-pt-2 ap-border-t ap-text-xs ap-text-gray-500">
                                    {workYears.length} work year(s) • {breakdown.longevity?.years || 0} longevity year(s)
                                    {breakdown.role_bonus?.role_name && (
                                        <span className="ap-ml-2">• {breakdown.role_bonus.role_name}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Notes - full width */}
                <div className="ap-mt-4">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                        Notes
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        placeholder="Additional notes about this user..."
                    />
                </div>

                {/* Member Status - only for editing existing users, only for users with permission */}
                {editingUser && window.mentorshipPlatformData?.can_manage_members && (
                    <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                        <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Member Status</h4>
                        <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4">
                            <p className="ap-text-sm ap-text-blue-800 ap-mb-3">
                                <strong>Members</strong> (employees) have full access to platform features and data.
                                <br />
                                <strong>Site Users</strong> (visitors) can only view the framework without operational data.
                            </p>
                            <div className="ap-flex ap-items-center ap-gap-3">
                                <span className="ap-text-sm ap-font-medium ap-text-gray-700">Current Status:</span>
                                <span className={`ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ${
                                    editingUser.is_member === true 
                                        ? 'ap-bg-green-100 ap-text-green-800' 
                                        : editingUser.is_member === false 
                                            ? 'ap-bg-gray-100 ap-text-gray-800' : 'ap-bg-blue-100 ap-text-blue-800'
                                }`}>
                                    {editingUser.is_member === true 
                                        ? '✓ Member (Employee)' 
                                        : editingUser.is_member === false 
                                            ? '○ Site User (Visitor)' : '○ Auto-detect'}
                                </span>
                            </div>
                            <div className="ap-mt-3 ap-flex ap-flex-wrap ap-gap-2">
                                <Button
                                    type="button"
                                    onClick={() => handleSetMemberStatus(editingUser.user_id, true, editingUser.display_name)}
                                    variant={editingUser.is_member === true ? 'success' : 'success-outline'}
                                    size="xs"
                                >
                                    Set as Employee
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleSetMemberStatus(editingUser.user_id, false, editingUser.display_name)}
                                    variant={editingUser.is_member === false ? 'secondary' : 'outline'}
                                    size="xs"
                                >
                                    Set as Site User
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleSetMemberStatus(editingUser.user_id, null, editingUser.display_name)}
                                    variant={editingUser.is_member === null || editingUser.is_member === undefined ? 'primary' : 'outline'}
                                    size="xs"
                                >
                                    Auto-detect
                                </Button>
                            </div>
                            <p className="ap-mt-2 ap-text-xs ap-text-gray-500">
                                Auto-detect: Users with active job roles are treated as members.
                            </p>
                        </div>
                    </div>
                )}

                {/* Send Email Checkbox (only for new users) */}
                {!editingUser && (
                    <div className="ap-mt-4">
                        <label className="ap-flex ap-items-center">
                            <input
                                type="checkbox"
                                checked={formData.send_email}
                                onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">
                                Send welcome email with login credentials
                            </span>
                        </label>
                    </div>
                )}

                {successMessage && (
                    <div className="ap-mt-4 ap-bg-green-50 ap-border ap-border-green-200 ap-text-green-700 ap-px-4 ap-py-3 ap-rounded-lg ap-text-sm">
                        {successMessage}
                    </div>
                )}

                {/* Certificates Section (only when editing an existing user) */}
                {editingUser && (window as any).mentorshipPlatformData?.enable_certificates !== false && (
                    <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                        <UserCertificateSection
                            userId={editingUser.user_id}
                            canEdit={true}
                            canApprove={true}
                        />
                    </div>
                )}
            </div>
            {/* END Scrollable Content */}

            {/* Footer */}
            <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                {editingUser ? (
                    <div className="ap-flex ap-gap-2">
                        {!!editingUser.archived ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    if (window.confirm(`Are you sure you want to restore ${editingUser.display_name}?`)) {
                                        handleUnarchive(editingUser.user_id, editingUser.display_name);
                                        handleCloseModal();
                                    }
                                }}
                                leftIcon={<UnarchiveIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-green-600 hover:!ap-text-green-800 hover:!ap-bg-green-50"
                            >
                                Restore
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    if (window.confirm(`Are you sure you want to archive ${editingUser.display_name}?`)) {
                                        handleArchive(editingUser.user_id, editingUser.display_name);
                                        handleCloseModal();
                                    }
                                }}
                                leftIcon={<ArchiveIcon className="ap-h-4 ap-w-4" />}
                                className="!ap-text-yellow-600 hover:!ap-text-yellow-800 hover:!ap-bg-yellow-50"
                            >
                                Archive
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to permanently delete ${editingUser.display_name}? This action cannot be undone.`)) {
                                    handleDelete(editingUser.user_id, editingUser.display_name);
                                    handleCloseModal();
                                }
                            }}
                            leftIcon={<DeleteIcon className="ap-h-4 ap-w-4" />}
                        >
                            Delete
                        </Button>
                    </div>
                ) : (
                    <div></div>
                )}
                <div className="ap-flex ap-items-center ap-gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCloseModal}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting}
                        loading={submitting}
                    >
                        {editingUser ? 'Update User' : 'Create User'}
                    </Button>
                </div>
            </div>
        </form>
    );

    if (loading && filteredUsers.length === 0 && allUsers.length === 0) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Return to previous page banner */}
            {returnToPage && (
                <div className="ap-bg-brand-50 ap-border ap-border-brand-200 ap-rounded-lg ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineArrowLeftCircle className="ap-w-5 ap-h-5 ap-text-brand-500" />
                        <span className="ap-text-brand-900">
                            Viewing Users List to assign job roles
                        </span>
                    </div>
                    <Button
                        onClick={() => {
                            if (onClearReturn) onClearReturn();
                            // Navigate back based on returnToPage value
                            if (returnToPage === 'new-hires') {
                                // Find the sidebar navigation - trigger seasonal:new-hires view
                                const event = new CustomEvent('navigate-view', { detail: 'seasonal:new-hires' });
                                window.dispatchEvent(event);
                            }
                        }}
                        variant="primary"
                        leftIcon={<HiOutlineArrowLeftCircle className="ap-w-4 ap-h-4" />}
                    >
                        Return to New Hires
                    </Button>
                </div>
            )}

            {/* Header */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">User Management</h2>
                    <p className="ap-text-gray-600 ap-mt-1">Manage system users and their information</p>
                </div>
                <div className="ap-flex ap-gap-2 ap-flex-wrap">
                    <Button
                        onClick={() => downloadCSVTemplate()}
                        variant="outline"
                        leftIcon={<DownloadIcon className="ap-h-5 ap-w-5" />}
                    >
                        CSV Template
                    </Button>
                    <Button
                        onClick={() => setIsBulkImportOpen(true)}
                        variant="success"
                        leftIcon={<UploadIcon className="ap-h-5 ap-w-5" />}
                    >
                        Bulk Import
                    </Button>
                    <Button
                        onClick={() => handleOpenModal()}
                        variant="primary"
                        leftIcon={<AddUserIcon className="ap-h-5 ap-w-5" />}
                    >
                        Add User
                    </Button>
                </div>
            </div>

            {/* Inline Add User Form */}
            {isModalOpen && !editingUser && (
                <div className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-overflow-hidden ap-border ap-border-gray-200 ap-mb-6 ap-animate-fade-in-down">
                    {userForm}
                </div>
            )}

            {/* Success Message */}
            {successMessage && (
                <div className="ap-bg-success-50 ap-border ap-border-success-200 ap-text-success-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {successMessage}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                    <Button onClick={() => setError(null)} variant="link" size="xs" className="ap-ml-2">Dismiss</Button>
                </div>
            )}

            {/* Filters */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-4">
                <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 lg:ap-grid-cols-4 ap-gap-4">
                    {/* Search */}
                    <div className="lg:ap-col-span-2">
                        <div className="ap-relative">
                            <SearchIcon className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-h-5 ap-w-5 ap-text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, email, employee ID, or job role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            />
                        </div>
                    </div>
                    
                    {/* Job Role Filter */}
                    <div>
                        <select
                            value={filterJobRole || ''}
                            onChange={(e) => setFilterJobRole(e.target.value ? Number(e.target.value) : null)}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">All Job Roles</option>
                            {jobRoles.map(role => (
                                <option key={role.id} value={role.id}>{role.title}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Tier Filter */}
                    <div>
                        <select
                            value={filterTier || ''}
                            onChange={(e) => setFilterTier(e.target.value ? Number(e.target.value) : null)}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="">All Tiers</option>
                            <option value="1">Tier 1</option>
                            <option value="2">Tier 2</option>
                            <option value="3">Tier 3</option>
                            <option value="4">Tier 4</option>
                            <option value="5">Tier 5</option>
                        </select>
                    </div>
                </div>
                
                {/* Third Row - Additional Filters */}
                <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4 ap-mt-4">
                    {/* New Hire Filter */}
                    <div>
                        <select
                            value={filterNewHire}
                            onChange={(e) => setFilterNewHire(e.target.value as 'all' | 'new_hires' | 'not_new_hires')}
                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            <option value="all">All Users</option>
                            <option value="new_hires">New Hires Only</option>
                            <option value="not_new_hires">Not New Hires</option>
                        </select>
                    </div>
                    
                    {/* No Job Role Filter */}
                    <div>
                        <label className="ap-flex ap-items-center ap-h-full ap-cursor-pointer ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg hover:ap-bg-gray-50 ap-transition-colors">
                            <input
                                type="checkbox"
                                checked={filterNoRole}
                                onChange={(e) => setFilterNoRole(e.target.checked)}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">No Job Role Assigned</span>
                        </label>
                    </div>
                </div>
                
                {/* Secondary Row - Filters & Results Count */}
                <div className="ap-flex ap-items-center ap-justify-between ap-mt-4 ap-pt-4 ap-border-t ap-border-gray-200 ap-flex-wrap ap-gap-4">
                    <div className="ap-flex ap-items-center ap-gap-6">
                        {/* Member Filter */}
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <span className="ap-text-sm ap-text-gray-700">Show:</span>
                            <select
                                value={memberFilter}
                                onChange={(e) => setMemberFilter(e.target.value as 'all' | 'members' | 'non-members')}
                                className="ap-px-2 ap-py-1 ap-text-sm ap-border ap-border-gray-300 ap-rounded focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                            >
                                <option value="members">Members Only</option>
                                <option value="non-members">Non-Members</option>
                                <option value="all">All Users</option>
                            </select>
                        </div>
                        
                        {/* Archived Toggle */}
                        <label className="ap-flex ap-items-center ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            />
                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">Show Archived</span>
                        </label>
                    </div>
                    <div className="ap-text-sm ap-text-gray-600">
                        Showing <strong>{filteredUsers.length}</strong> users on this page
                        {totalUsers > 0 && totalUsers !== filteredUsers.length && (
                            <span> (filtered from {totalUsers} total)</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedUsers.size > 0 && (
                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                        <div className="ap-text-sm ap-text-blue-700">
                            <strong>{selectedUsers.size}</strong> user{selectedUsers.size !== 1 ? 's' : ''} selected
                        </div>
                        <div className="ap-flex ap-gap-2 ap-flex-wrap">
                            <Button
                                onClick={() => setIsBulkActionOpen(true)}
                                variant="primary"
                            >
                                Bulk Edit
                            </Button>
                            {showArchived ? (
                                <Button
                                    onClick={async () => {
                                        if (window.confirm(`Are you sure you want to unarchive ${selectedUsers.size} user${selectedUsers.size !== 1 ? 's' : ''}?`)) {
                                            try {
                                                const userIds = Array.from(selectedUsers);
                                                let successCount = 0;
                                                let errorCount = 0;
                                                const successfulUserIds = new Set<number>();
                                                
                                                for (const userId of userIds) {
                                                    try {
                                                        await unarchiveUser(userId);
                                                        successCount++;
                                                        successfulUserIds.add(userId);
                                                    } catch (err) {
                                                        errorCount++;
                                                        console.error(`Failed to unarchive user ${userId}:`, err);
                                                    }
                                                }
                                                
                                                // Remove unarchived users from the current view immediately
                                                setAllUsers(prevUsers => prevUsers.filter(u => !successfulUserIds.has(u.user_id)));
                                                
                                                setSuccessMessage(`Successfully unarchived ${successCount} user${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : ''}`);
                                                setSelectedUsers(new Set());
                                                
                                                setTimeout(() => setSuccessMessage(null), 5000);
                                            } catch (err) {
                                                setError('Failed to unarchive users. Please try again.');
                                                setTimeout(() => setError(null), 5000);
                                            }
                                        }
                                    }}
                                    variant="success-outline"
                                    leftIcon={<UnarchiveIcon className="ap-h-5 ap-w-5" />}
                                >
                                    Unarchive Selected
                                </Button>
                            ) : (
                                <Button
                                    onClick={async () => {
                                        if (window.confirm(`Are you sure you want to archive ${selectedUsers.size} user${selectedUsers.size !== 1 ? 's' : ''}?`)) {
                                            try {
                                                const userIds = Array.from(selectedUsers);
                                                let successCount = 0;
                                                let errorCount = 0;
                                                const successfulUserIds = new Set<number>();
                                                
                                                for (const userId of userIds) {
                                                    try {
                                                        await archiveUser(userId);
                                                        successCount++;
                                                        successfulUserIds.add(userId);
                                                    } catch (err) {
                                                        errorCount++;
                                                        console.error(`Failed to archive user ${userId}:`, err);
                                                    }
                                                }
                                                
                                                // Remove archived users from the current view immediately
                                                setAllUsers(prevUsers => prevUsers.filter(u => !successfulUserIds.has(u.user_id)));
                                                
                                                setSuccessMessage(`Successfully archived ${successCount} user${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : ''}`);
                                                setSelectedUsers(new Set());
                                                
                                                setTimeout(() => setSuccessMessage(null), 5000);
                                            } catch (err) {
                                                setError('Failed to archive users. Please try again.');
                                                setTimeout(() => setError(null), 5000);
                                            }
                                        }
                                    }}
                                    variant="warning-outline"
                                    leftIcon={<ArchiveIcon className="ap-h-5 ap-w-5" />}
                                >
                                    Archive Selected
                                </Button>
                            )}
                            <Button
                                onClick={() => setSelectedUsers(new Set())}
                                variant="secondary"
                            >
                                Clear Selection
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 ap-py-4 ap-text-left">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={handleSelectAll}
                                        className="ap-h-4 ap-w-4 ap-text-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/20 ap-border-gray-300 ap-rounded ap-transition-all"
                                    />
                                </th>
                                <th 
                                    onClick={() => handleSort('name')}
                                    className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Name <SortIcon field="name" />
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('job_role')}
                                    className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Job Role <SortIcon field="job_role" />
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('tier')}
                                    className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Tier <SortIcon field="tier" />
                                    </div>
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider">
                                    Pay Rate
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider">
                                    Work Years
                                </th>
                                <th 
                                    onClick={() => handleSort('hire_date')}
                                    className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Hire Date <SortIcon field="hire_date" />
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleSort('last_login')}
                                    className="ap-px-4 sm:ap-px-6 ap-py-4 ap-text-left ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors"
                                >
                                    <div className="ap-flex ap-items-center">
                                        Last Login <SortIcon field="last_login" />
                                    </div>
                                </th>
                                <th className="ap-sticky ap-right-0 ap-bg-gray-50 ap-px-4 sm:ap-px-6 ap-py-4 ap-text-right ap-text-xs ap-font-semibold ap-text-gray-700 ap-uppercase ap-tracking-wider ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                    Edit
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="ap-px-4 sm:ap-px-6 ap-py-12 ap-text-center ap-text-gray-500">
                                        {searchTerm || filterJobRole || filterTier || filterNewHire !== 'all' || filterNoRole ? 'No users found matching your filters.' : 'No users yet. Click "Add User" to get started.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <React.Fragment key={user.user_id}>
                                        <tr className={`hover:ap-bg-gray-50 ${user.archived ? 'ap-bg-gray-100' : ''}`}>
                                            <td className="ap-px-4 ap-py-4">
                                                {!user.archived && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUsers.has(user.user_id)}
                                                        onChange={() => handleSelectUser(user.user_id)}
                                                        className="ap-h-4 ap-w-4 ap-text-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/20 ap-border-gray-300 ap-rounded ap-transition-all"
                                                    />
                                                )}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {user.display_name}
                                                    {!!user.archived && (
                                                        <span className="ap-ml-2 ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-gray-200 ap-text-gray-700">
                                                            Archived
                                                        </span>
                                                    )}
                                                    {/* Member status indicator - only show if explicitly set to false (site user) */}
                                                    {user.is_member === false && !user.archived && (
                                                        <span className="ap-ml-2 ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-amber-100 ap-text-amber-700" title="Site User - Framework access only">
                                                            Visitor
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="ap-text-xs ap-text-gray-500">{user.user_email}</div>
                                                {user.employee_id && (
                                                    <div className="ap-text-xs ap-text-gray-500">ID: {user.employee_id}</div>
                                                )}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4">
                                                {user.job_role_title ? (
                                                    user.job_role_title.includes(',') ? (
                                                        /* Multiple roles - show as stacked badges */
                                                        <div className="ap-flex ap-flex-col ap-gap-1">
                                                            {user.job_role_title.split(', ').map((title, idx) => (
                                                                <span key={idx} className="ap-text-xs ap-text-gray-900 ap-whitespace-nowrap">
                                                                    {title}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        /* Single role */
                                                        <div className="ap-text-sm ap-text-gray-900">
                                                            {user.job_role_title}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="ap-text-sm ap-text-gray-500">-</div>
                                                )}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                                {user.tier ? (
                                                    <span className="ap-inline-flex ap-px-2.5 ap-py-0.5 ap-text-xs ap-font-medium ap-rounded-full ap-bg-brand-50 ap-text-brand-700 ap-border ap-border-brand-200">
                                                        {getTierLabel(user.tier)}
                                                    </span>
                                                ) : (
                                                    <span className="ap-text-sm ap-text-gray-500">-</span>
                                                )}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm">
                                                {(() => {
                                                    const payData = employeePayData.get(user.user_id);
                                                    if (loadingPayData) {
                                                        return <span className="ap-text-gray-400">Loading...</span>;
                                                    }
                                                    if (payData?.pay_breakdown?.total) {
                                                        return (
                                                            <span className="ap-font-medium ap-text-green-600">
                                                                ${payData.pay_breakdown.total.toFixed(2)}/hr
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="ap-text-gray-500">-</span>;
                                                })()}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-700">
                                                {(() => {
                                                    const payData = employeePayData.get(user.user_id);
                                                    if (loadingPayData) {
                                                        return <span className="ap-text-gray-400">...</span>;
                                                    }
                                                    const workYearsCount = payData?.pay_breakdown?.longevity?.work_years_logged || 0;
                                                    if (workYearsCount > 0) {
                                                        return <span>{workYearsCount} year{workYearsCount !== 1 ? 's' : ''}</span>;
                                                    }
                                                    return <span className="ap-text-gray-500">0 years</span>;
                                                })()}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                {user.hire_date ? formatLocalDate(user.hire_date) : '-'}
                                            </td>
                                            <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                {user.last_login ? formatLocalDate(user.last_login) : 'Never'}
                                            </td>
                                            <td className="ap-sticky ap-right-0 ap-bg-white ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium ap-shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                                                <Button
                                                    onClick={() => handleOpenModal(user)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="!ap-text-brand-500 hover:!ap-text-brand-600 !ap-p-1 !ap-min-h-0"
                                                    title="Edit user"
                                                >
                                                    <EditIcon className="ap-h-5 ap-w-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                        {isModalOpen && editingUser?.user_id === user.user_id && (
                                            <tr>
                                                <td colSpan={9} className="ap-p-0 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                    <div className="ap-p-4 ap-border-l-4 ap-border-brand-500 ap-shadow-inner ap-bg-gray-50">
                                                        <div className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-overflow-hidden ap-max-w-4xl ap-mx-auto ap-border ap-border-gray-200">
                                                            {userForm}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* User count display */}
                {totalUsers > 0 && (
                    <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-t ap-border-gray-200 sm:ap-px-6">
                        <p className="ap-text-sm ap-text-gray-700">
                            Showing <span className="ap-font-medium">{filteredUsers.length}</span> of{' '}
                            <span className="ap-font-medium">{totalUsers}</span> total users
                        </p>
                    </div>
                )}
            </div>

            {/* Bulk Import Modal - positioned at top of viewport */}
            {isBulkImportOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-[100] ap-overflow-y-auto">
                    <div className="ap-flex ap-items-start ap-justify-center ap-min-h-screen ap-px-4 ap-pt-16 ap-pb-20 ap-text-center sm:ap-block sm:ap-p-0 sm:ap-pt-16">
                        <div 
                            className="ap-fixed ap-inset-0 ap-bg-gray-500 ap-bg-opacity-75 ap-transition-opacity ap-z-[100]"
                            onClick={() => !importing && setIsBulkImportOpen(false)}
                        ></div>

                        <div className="ap-inline-block ap-align-top ap-bg-white ap-rounded-lg ap-text-left ap-overflow-hidden ap-shadow-xl ap-transform ap-transition-all sm:ap-my-8 sm:ap-max-w-3xl sm:ap-w-full ap-relative ap-z-[101] ap-max-h-[85vh] ap-overflow-y-auto">
                            <form onSubmit={handleBulkImport}>
                                <div className="ap-bg-white ap-px-4 ap-pt-5 ap-pb-4 sm:ap-p-6 sm:ap-pb-4">
                                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4">
                                        Bulk Import Users from CSV
                                    </h3>

                                    <div className="ap-mb-4 ap-p-4 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg">
                                        <p className="ap-text-sm ap-text-blue-800">
                                            <strong>Format:</strong> first_name, last_name, email, phone_number, employee_id, hire_date, job_role_id, wp_role
                                        </p>
                                        <p className="ap-text-sm ap-text-blue-800 ap-mt-1">
                                            Only first_name, last_name, and email are required. Other columns can be empty.
                                        </p>
                                        <p className="ap-text-sm ap-text-blue-800 ap-mt-1">
                                            Download the CSV template for the correct format.
                                        </p>
                                    </div>

                                    <div className="ap-mb-4">
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Upload CSV File
                                        </label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileUpload}
                                            disabled={importing}
                                            className="ap-block ap-w-full ap-text-sm ap-text-gray-500 file:ap-mr-4 file:ap-py-2 file:ap-px-4 file:ap-rounded-lg file:ap-border-0 file:ap-text-sm file:ap-font-semibold file:ap-bg-blue-600 file:ap-text-white hover:file:ap-bg-ocean-blue file:ap-cursor-pointer ap-cursor-pointer disabled:ap-opacity-50 disabled:ap-cursor-not-allowed file:disabled:ap-cursor-not-allowed"
                                        />
                                        <p className="ap-mt-1 ap-text-xs ap-text-gray-500">Or paste CSV data below</p>
                                    </div>

                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Paste CSV Data
                                        </label>
                                        <textarea
                                            value={csvData}
                                            onChange={(e) => setCsvData(e.target.value)}
                                            rows={10}
                                            disabled={importing}
                                            className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-font-mono ap-text-sm disabled:ap-opacity-50 disabled:ap-cursor-not-allowed disabled:ap-bg-gray-100"
                                            placeholder="Paste your CSV data here..."
                                        />
                                    </div>

                                    <div className="ap-mt-4">
                                        <label className="ap-flex ap-items-center">
                                            <input
                                                type="checkbox"
                                                checked={sendEmailsBulk}
                                                onChange={(e) => setSendEmailsBulk(e.target.checked)}
                                                disabled={importing}
                                                className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded disabled:ap-opacity-50 disabled:ap-cursor-not-allowed"
                                            />
                                            <span className="ap-ml-2 ap-text-sm ap-text-gray-700">
                                                Send welcome emails to all imported users
                                            </span>
                                        </label>
                                    </div>

                                    {importResults && (
                                        <div className="ap-mt-4 ap-p-4 ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg">
                                            <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2">Import Results:</h4>
                                            <p className="ap-text-sm ap-text-gray-700">
                                                <span className="ap-font-medium ap-text-green-600">{importResults.successful}</span> successful, {' '}
                                                <span className="ap-font-medium ap-text-red-600">{importResults.failed}</span> failed
                                            </p>
                                            
                                            {importResults.results.errors.length > 0 && (
                                                <div className="ap-mt-2">
                                                    <p className="ap-text-sm ap-font-medium ap-text-red-700">Errors:</p>
                                                    <ul className="ap-text-xs ap-text-red-600 ap-list-disc ap-list-inside ap-max-h-32 ap-overflow-y-auto">
                                                        {importResults.results.errors.map((err: string, idx: number) => (
                                                            <li key={idx}>{err}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {importResults.results.success.length > 0 && (
                                                <div className="ap-mt-2">
                                                    <p className="ap-text-sm ap-font-medium ap-text-green-700">Successfully Created:</p>
                                                    <div className="ap-text-xs ap-text-gray-600 ap-max-h-48 ap-overflow-y-auto">
                                                        {importResults.results.success.map((user: any, idx: number) => (
                                                            <div key={idx} className="ap-py-1 ap-border-b ap-border-gray-200">
                                                                <strong>{user.name}</strong> - Username: {user.username}, Password: {user.password}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="ap-bg-gray-50 ap-px-4 ap-py-3 sm:ap-px-6 sm:ap-flex sm:ap-flex-row-reverse">
                                    <Button
                                        type="submit"
                                        disabled={importing}
                                        variant="success"
                                        loading={importing}
                                        className="ap-w-full sm:ap-w-auto sm:ap-ml-3"
                                    >
                                        {importing ? 'Importing...' : 'Import Users'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsBulkImportOpen(false);
                                            setImportResults(null);
                                            setCsvData('');
                                        }}
                                        disabled={importing}
                                        className="ap-mt-3 ap-w-full sm:ap-mt-0 sm:ap-ml-3 sm:ap-w-auto"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Edit Modal - positioned at top of viewport */}
            {isBulkActionOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-[100] ap-overflow-y-auto">
                    <div className="ap-flex ap-items-start ap-justify-center ap-min-h-screen ap-px-4 ap-pt-16 ap-pb-20 ap-text-center sm:ap-block sm:ap-p-0 sm:ap-pt-16">
                        <div 
                            className="ap-fixed ap-inset-0 ap-bg-gray-500 ap-bg-opacity-75 ap-transition-opacity ap-z-[100]" 
                            onClick={() => !applyingBulkEdit && setIsBulkActionOpen(false)}
                        ></div>
                        <div className="ap-inline-block ap-align-top ap-bg-white ap-rounded-lg ap-text-left ap-overflow-hidden ap-shadow-xl ap-transform ap-transition-all sm:ap-my-8 sm:ap-max-w-2xl sm:ap-w-full ap-relative ap-z-[101] ap-max-h-[85vh] ap-overflow-y-auto">
                            <div className="ap-bg-white ap-px-4 ap-pt-5 ap-pb-4 sm:ap-p-6 sm:ap-pb-4">
                                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                                    <h3 className="ap-text-lg ap-leading-6 ap-font-medium ap-text-gray-900">
                                        Bulk Edit {selectedUsers.size} User{selectedUsers.size !== 1 ? 's' : ''}
                                    </h3>
                                    <Button
                                        type="button"
                                        onClick={() => !applyingBulkEdit && setIsBulkActionOpen(false)}
                                        disabled={applyingBulkEdit}
                                        variant="ghost"
                                        size="sm"
                                        className="!ap-p-2 !ap-min-h-0 !ap-rounded-full !ap-text-gray-400 hover:!ap-bg-gray-200 hover:!ap-text-gray-500"
                                    >
                                        <HiOutlineXMark className="ap-h-6 ap-w-6" />
                                    </Button>
                                </div>

                                {/* Tabs */}
                                <div className="ap-border-b ap-border-gray-200 ap-mb-4">
                                    <nav className="-ap-mb-px ap-flex ap-space-x-4" aria-label="Tabs">
                                        <Button
                                            onClick={() => setBulkEditTab('metadata')}
                                            variant="ghost"
                                            size="sm"
                                            className={`!ap-whitespace-nowrap !ap-py-2 !ap-px-1 !ap-rounded-none !ap-border-b-2 !ap-font-medium !ap-text-sm !ap-min-h-0 ${
                                                bulkEditTab === 'metadata'
                                                    ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                            }`}
                                        >
                                            Hire Date & Rehire
                                        </Button>
                                        <Button
                                            onClick={() => setBulkEditTab('job_roles')}
                                            variant="ghost"
                                            size="sm"
                                            className={`!ap-whitespace-nowrap !ap-py-2 !ap-px-1 !ap-rounded-none !ap-border-b-2 !ap-font-medium !ap-text-sm !ap-min-h-0 ${
                                                bulkEditTab === 'job_roles'
                                                    ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                            }`}
                                        >
                                            Job Roles
                                        </Button>
                                        <Button
                                            onClick={() => setBulkEditTab('work_years')}
                                            variant="ghost"
                                            size="sm"
                                            className={`!ap-whitespace-nowrap !ap-py-2 !ap-px-1 !ap-rounded-none !ap-border-b-2 !ap-font-medium !ap-text-sm !ap-min-h-0 ${
                                                bulkEditTab === 'work_years'
                                                    ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                            }`}
                                        >
                                            Work Years
                                        </Button>
                                        <Button
                                            onClick={() => setBulkEditTab('archive')}
                                            variant="ghost"
                                            size="sm"
                                            className={`!ap-whitespace-nowrap !ap-py-2 !ap-px-1 !ap-rounded-none !ap-border-b-2 !ap-font-medium !ap-text-sm !ap-min-h-0 ${
                                                bulkEditTab === 'archive'
                                                    ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                            }`}
                                        >
                                            Archive Status
                                        </Button>
                                        {(window as any).mentorshipPlatformData?.can_manage_members && (
                                            <Button
                                                onClick={() => setBulkEditTab('member_status')}
                                                variant="ghost"
                                                size="sm"
                                                className={`!ap-whitespace-nowrap !ap-py-2 !ap-px-1 !ap-rounded-none !ap-border-b-2 !ap-font-medium !ap-text-sm !ap-min-h-0 ${
                                                    bulkEditTab === 'member_status'
                                                        ? '!ap-border-blue-500 !ap-text-blue-600' : '!ap-border-transparent !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-border-gray-300'
                                                }`}
                                            >
                                                Member Status
                                            </Button>
                                        )}
                                    </nav>
                                </div>

                                {/* Tab Content */}
                                <div className="ap-space-y-4 ap-min-h-[200px]">
                                    {/* Metadata Tab */}
                                    {bulkEditTab === 'metadata' && (
                                        <div className="ap-space-y-4">
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Hire Date (Optional)
                                                </label>
                                                <input
                                                    type="date"
                                                    value={bulkHireDate}
                                                    onChange={(e) => setBulkHireDate(e.target.value)}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                />
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Leave blank to skip updating hire date
                                                </p>
                                            </div>

                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Eligible for Rehire (Optional)
                                                </label>
                                                <select
                                                    value={bulkEligibleForRehire === null ? '' : bulkEligibleForRehire.toString()}
                                                    onChange={(e) => setBulkEligibleForRehire(e.target.value === '' ? null : e.target.value === 'true')}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                >
                                                    <option value="">Don't change</option>
                                                    <option value="true">Yes - Eligible</option>
                                                    <option value="false">No - Not Eligible</option>
                                                </select>
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Leave as "Don't change" to skip updating eligibility
                                                </p>
                                            </div>
                                            
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    New Hire Status (Optional)
                                                </label>
                                                <select
                                                    value={bulkIsNewHire === null ? '' : bulkIsNewHire.toString()}
                                                    onChange={(e) => setBulkIsNewHire(e.target.value === '' ? null : e.target.value === 'true')}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                >
                                                    <option value="">Don't change</option>
                                                    <option value="true">Yes - Mark as New Hire</option>
                                                    <option value="false">No - Not a New Hire</option>
                                                </select>
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Leave as "Don't change" to skip updating new hire status
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Job Roles Tab */}
                                    {bulkEditTab === 'job_roles' && (
                                        <div className="ap-space-y-4">
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Assign Job Role
                                                </label>
                                                <select
                                                    value={bulkJobRoleId}
                                                    onChange={(e) => setBulkJobRoleId(Number(e.target.value))}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-blue-500 focus:ap-border-blue-500 disabled:ap-opacity-50"
                                                >
                                                    <option value={0}>Select a job role...</option>
                                                    {jobRoles.map((role) => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.title} (Tier {role.tier})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    This will add the selected role to all selected users (won't remove existing roles)
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Work Years Tab */}
                                    {bulkEditTab === 'work_years' && (
                                        <div className="ap-space-y-4">
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Add Work Years (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bulkWorkYearsToAdd}
                                                    onChange={(e) => setBulkWorkYearsToAdd(e.target.value)}
                                                    disabled={applyingBulkEdit}
                                                    placeholder="e.g., 2024 or 2020-2024 or 2020,2022,2024"
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                />
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Single year (2024), range (2020-2024), or comma-separated (2020,2022,2024)
                                                </p>
                                            </div>

                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Remove Work Years (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bulkWorkYearsToRemove}
                                                    onChange={(e) => setBulkWorkYearsToRemove(e.target.value)}
                                                    disabled={applyingBulkEdit}
                                                    placeholder="e.g., 2020,2021,2022"
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                />
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Comma-separated years to remove from all selected users
                                                </p>
                                            </div>

                                            <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-3">
                                                <p className="ap-text-sm ap-text-yellow-800">
                                                    <strong>Note:</strong> If both add and remove are specified, years will be removed first, then added.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Archive Tab */}
                                    {bulkEditTab === 'archive' && (
                                        <div className="ap-space-y-4">
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Archive Action
                                                </label>
                                                <select
                                                    value={bulkArchiveAction || ''}
                                                    onChange={(e) => setBulkArchiveAction(e.target.value as 'archive' | 'unarchive' | null || null)}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                >
                                                    <option value="">Select action...</option>
                                                    <option value="archive">Archive users</option>
                                                    <option value="unarchive">Unarchive users</option>
                                                </select>
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Archived users are hidden from the main list and cannot log in
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Member Status Tab */}
                                    {bulkEditTab === 'member_status' && (
                                        <div className="ap-space-y-4">
                                            <div>
                                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                    Member Status
                                                </label>
                                                <select
                                                    value={bulkMemberStatus === null ? '' : bulkMemberStatus.toString()}
                                                    onChange={(e) => setBulkMemberStatus(e.target.value === '' ? null : e.target.value === 'true')}
                                                    disabled={applyingBulkEdit}
                                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent disabled:ap-opacity-50"
                                                >
                                                    <option value="">Select status...</option>
                                                    <option value="true">Add as Member</option>
                                                    <option value="false">Remove Member Status</option>
                                                </select>
                                                <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                                                    Members have full access to the platform. Non-members can only see the framework.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="ap-bg-gray-50 ap-px-4 ap-py-3 sm:ap-px-6 sm:ap-flex sm:ap-flex-row-reverse">
                                <Button
                                    type="button"
                                    onClick={handleBulkEdit}
                                    disabled={applyingBulkEdit || (
                                        (bulkEditTab === 'metadata' && !bulkHireDate && bulkEligibleForRehire === null && bulkIsNewHire === null) ||
                                        (bulkEditTab === 'job_roles' && !bulkJobRoleId) ||
                                        (bulkEditTab === 'work_years' && !bulkWorkYearsToAdd && !bulkWorkYearsToRemove) ||
                                        (bulkEditTab === 'archive' && !bulkArchiveAction) ||
                                        (bulkEditTab === 'member_status' && bulkMemberStatus === null)
                                    )}
                                    variant="primary"
                                    loading={applyingBulkEdit}
                                    className="ap-w-full sm:ap-ml-3 sm:ap-w-auto"
                                >
                                    Apply Changes
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (!applyingBulkEdit) {
                                            setIsBulkActionOpen(false);
                                            setBulkJobRoleId(0);
                                            setBulkHireDate('');
                                            setBulkEligibleForRehire(null);
                                            setBulkIsNewHire(null);
                                            setBulkWorkYearsToAdd('');
                                            setBulkWorkYearsToRemove('');
                                            setBulkArchiveAction(null);
                                        }
                                    }}
                                    disabled={applyingBulkEdit}
                                    className="ap-mt-3 ap-w-full sm:ap-mt-0 sm:ap-ml-3 sm:ap-w-auto"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
