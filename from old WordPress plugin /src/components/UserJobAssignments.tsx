import React, { useState, useEffect } from 'react';
import { Button } from './ui';
import { formatLocalDate } from '../utils/dateUtils';
import { 
    HiOutlineUserPlus as AssignIcon,
    HiOutlinePencil as EditIcon,
    HiOutlineTrash as DeleteIcon,
    HiOutlineExclamationTriangle as WarningIcon
} from 'react-icons/hi2';
import { 
    getUserAssignments,
    assignUserToRole,
    deleteUserAssignment,
    getJobRoles,
    JobRole,
    UserJobAssignment
} from '@/services/api-professional-growth';
import { getCachedSimpleUsers, invalidateUserCache } from '@/services/userCache';
import LoadingSpinner from './LoadingSpinner';

const UserJobAssignments: React.FC = () => {
    const [assignments, setAssignments] = useState<UserJobAssignment[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [users, setUsers] = useState<{id: number; name: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<UserJobAssignment | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        user_id: 0,
        job_role_id: 0,
        sync_wp_role: false,
        notes: '',
    });
    const [showAdminWarning, setShowAdminWarning] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [assignmentsData, rolesData, usersData] = await Promise.all([
                getUserAssignments(),
                getJobRoles(),
                getCachedSimpleUsers()
            ]);
            setAssignments(assignmentsData);
            setJobRoles(rolesData);
            // Users are already sorted by centralized cache
            setUsers(usersData);
            setError(null);
        } catch (err) {
            setError('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (assignment?: UserJobAssignment) => {
        if (assignment) {
            setEditingAssignment(assignment);
            setFormData({
                user_id: assignment.user_id,
                job_role_id: assignment.job_role_id,
                sync_wp_role: assignment.sync_wp_role || false,
                notes: assignment.notes || '',
            });
        } else {
            setEditingAssignment(null);
            setFormData({
                user_id: 0,
                job_role_id: 0,
                sync_wp_role: false,
                notes: '',
            });
        }
        setShowAdminWarning(false);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAssignment(null);
        setShowAdminWarning(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.user_id || !formData.job_role_id) {
            setError('Please select both a user and a job role');
            return;
        }

        try {
            const result = await assignUserToRole({
                user_id: formData.user_id,
                job_role_id: formData.job_role_id,
                sync_wp_role: formData.sync_wp_role,
                notes: formData.notes,
            });

            if (result.admin_protected && formData.sync_wp_role) {
                alert('Note: User is an Administrator. WordPress role was NOT changed to protect admin privileges.');
            } else if (result.wp_role_synced) {
                alert('User assigned to job role and WordPress role updated successfully!');
            } else {
                alert('User assigned to job role successfully!');
            }

            // Invalidate user cache so other components get fresh job role data
            invalidateUserCache();
            await loadData();
            handleCloseModal();
            setError(null);
        } catch (err) {
            setError('Failed to assign user to role');
            console.error(err);
        }
    };

    const handleDelete = async (userId: number) => {
        if (!confirm('Are you sure you want to remove this job assignment? This will not change their WordPress role.')) {
            return;
        }

        try {
            await deleteUserAssignment(userId);
            // Invalidate user cache so other components get fresh job role data
            invalidateUserCache();
            await loadData();
            setError(null);
        } catch (err) {
            setError('Failed to delete assignment');
            console.error(err);
        }
    };

    const getUserName = (userId: number) => {
        const user = users.find(u => u.id === userId);
        return user?.name || 'Unknown User';
    };

    const getTierLabel = (tier: number): string => {
        const labels: { [key: number]: string } = {
            1: 'Tier 1',
            2: 'Tier 2',
            3: 'Tier 3',
            4: 'Tier 4',
            5: 'Tier 5',
            6: 'Tier 6 (Full Access)',
        };
        return labels[tier] || `Tier ${tier}`;
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-items-center ap-justify-between">
                <div>
                    <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">User Job Assignments</h2>
                    <p className="ap-text-gray-600 ap-mt-1">Assign staff to job roles and track their progression</p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => handleOpenModal()}
                    leftIcon={<AssignIcon className="ap-h-5 ap-w-5" />}
                >
                    Assign User
                </Button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            {/* Assignments List */}
            <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
                <div className="ap-overflow-x-auto">
                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                        <thead className="ap-bg-gray-50">
                            <tr>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    User
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Job Role
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Tier
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Assigned Date
                                </th>
                                <th className="ap-px-4 sm:ap-px-6 ap-py-3 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                            {assignments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="ap-px-4 sm:ap-px-6 ap-py-12 ap-text-center ap-text-gray-500">
                                        No job assignments yet. Click "Assign User" to get started.
                                    </td>
                                </tr>
                            ) : (
                                assignments.map((assignment) => (
                                    <tr key={assignment.user_id} className="hover:ap-bg-gray-50">
                                        <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {assignment.display_name || getUserName(assignment.user_id)}
                                            </div>
                                            <div className="ap-text-xs ap-text-gray-500">{assignment.user_email}</div>
                                        </td>
                                        <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <div className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                {assignment.job_role_title}
                                            </div>
                                        </td>
                                        <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap">
                                            <span className="ap-inline-flex ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                                {getTierLabel(assignment.tier || 0)}
                                            </span>
                                        </td>
                                        <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                            {assignment.assigned_date ? formatLocalDate(assignment.assigned_date) : '-'}
                                        </td>
                                        <td className="ap-px-4 sm:ap-px-6 ap-py-4 ap-whitespace-nowrap ap-text-right ap-text-sm ap-font-medium">
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => handleOpenModal(assignment)}
                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-text-blue-900 ap-mr-3 sm:ap-mr-4"
                                                aria-label="Edit assignment"
                                            >
                                                <EditIcon className="ap-h-5 ap-w-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => handleDelete(assignment.user_id)}
                                                className="!ap-p-1.5 !ap-min-h-0 ap-text-red-600 hover:ap-text-red-900"
                                                aria-label="Delete assignment"
                                            >
                                                <DeleteIcon className="ap-h-5 ap-w-5" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-[100] ap-overflow-y-auto">
                    <div className="ap-flex ap-items-start ap-justify-center ap-min-h-screen ap-px-4 ap-pt-16 ap-pb-20 ap-text-center sm:ap-block sm:ap-p-0 sm:ap-pt-16">
                        {/* Background overlay */}
                        <div 
                            className="ap-fixed ap-inset-0 ap-bg-gray-500 ap-bg-opacity-75 ap-transition-opacity ap-z-[100]"
                            onClick={handleCloseModal}
                        ></div>

                        {/* Modal panel - positioned near top of viewport */}
                        <div className="ap-inline-block ap-align-top ap-bg-white ap-rounded-lg ap-text-left ap-overflow-hidden ap-shadow-xl ap-transform ap-transition-all sm:ap-my-8 sm:ap-max-w-lg sm:ap-w-full ap-relative ap-z-[101] ap-max-h-[85vh] ap-overflow-y-auto">
                            <form onSubmit={handleSubmit}>
                                <div className="ap-bg-white ap-px-4 ap-pt-5 ap-pb-4 sm:ap-p-6 sm:ap-pb-4">
                                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4">
                                        {editingAssignment ? 'Update Job Assignment' : 'Assign User ap-to Job Role'}
                                    </h3>

                                    <div className="ap-space-y-4">
                                        {/* User Selection */}
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                User *
                                            </label>
                                            <select
                                                required
                                                value={formData.user_id}
                                                onChange={(e) => setFormData({ ...formData, user_id: parseInt(e.target.value) })}
                                                className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                                disabled={!!editingAssignment}
                                            >
                                                <option value={0}>-- Select User --</option>
                                                {users.map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Job Role Selection */}
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Job Role *
                                            </label>
                                            <select
                                                required
                                                value={formData.job_role_id}
                                                onChange={(e) => setFormData({ ...formData, job_role_id: parseInt(e.target.value) })}
                                                className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                            >
                                                <option value={0}>-- Select Job Role --</option>
                                                {jobRoles.map(role => (
                                                    <option key={role.id} value={role.id}>
                                                        {role.title} (Tier {role.tier})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Sync WordPress Role */}
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4">
                                            <div className="ap-flex ap-items-start">
                                                <input
                                                    type="checkbox"
                                                    id="sync_wp_role"
                                                    checked={formData.sync_wp_role}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, sync_wp_role: e.target.checked });
                                                        setShowAdminWarning(e.target.checked);
                                                    }}
                                                    className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-mt-1"
                                                />
                                                <div className="ap-ml-3">
                                                    <label htmlFor="sync_wp_role" className="ap-text-sm ap-font-medium ap-text-gray-700">
                                                        Update WordPress Role
                                                    </label>
                                                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                                        Change the user's WordPress role to match this job role's default
                                                    </p>
                                                </div>
                                            </div>

                                            {showAdminWarning && (
                                                <div className="ap-mt-3 ap-flex ap-items-start ap-p-3 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded">
                                                    <WarningIcon className="ap-h-5 ap-w-5 ap-text-yellow-600 ap-mr-2 ap-flex-shrink-0 ap-mt-0.5" />
                                                    <div className="ap-text-xs ap-text-yellow-800">
                                                        <strong>Important:</strong> If this user is an Administrator, their WordPress role will NOT be changed to protect admin privileges.
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes */}
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Notes
                                            </label>
                                            <textarea
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                rows={3}
                                                className="ap-w-full ap-min-w-0 ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                                placeholder="Optional notes about this assignment..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="ap-bg-gray-50 ap-px-4 ap-py-3 sm:ap-px-6 sm:ap-flex sm:ap-flex-row-reverse">
                                    <Button
                                        variant="primary"
                                        type="submit"
                                        className="ap-w-full sm:ap-ml-3 sm:ap-w-auto"
                                    >
                                        {editingAssignment ? 'Update Assignment' : 'Assign User'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="ap-mt-3 ap-w-full sm:ap-mt-0 sm:ap-ml-3 sm:ap-w-auto"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserJobAssignments;
