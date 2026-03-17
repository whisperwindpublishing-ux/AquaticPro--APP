import React, { useState, useEffect } from 'react';
import { getAllRolePermissions, updateRolePermissions } from '@/services/awesome-awards.service';
import LoadingSpinner from './LoadingSpinner';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineTrophy, HiOutlineArrowPath } from 'react-icons/hi2';
import { Button } from './ui/Button';

interface RolePermission {
  job_role_id: number;
  job_role_name: string;
  job_role_tier: number;
  can_nominate: boolean;
  can_vote: boolean;
  can_approve: boolean;
  can_direct_assign: boolean;
  can_manage_periods: boolean;
  can_view_nominations: boolean;
  can_view_winners: boolean;
  can_view_archives: boolean;
  can_archive: boolean;
}

/**
 * AwesomeAwardsPermissions Component
 * 
 * Admin interface for managing Awesome Awards permissions per job role.
 * 
 * Features:
 * - View all job roles and their current permissions
 * - Toggle permissions with checkboxes
 * - Save changes per role
 * - Visual tier indicators
 */
const AwesomeAwardsPermissions: React.FC = () => {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modifiedRoles, setModifiedRoles] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllRolePermissions();
      console.log('Fetched AA permissions:', data);
      
      if (!data || data.length === 0) {
        setError('No permissions found. Please deactivate and reactivate the plugin to create the permissions table.');
      }
      
      setPermissions(data);
      setModifiedRoles(new Set());
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError(`Failed to load permissions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (roleId: number, permissionKey: keyof RolePermission) => {
    setPermissions(prev =>
      prev.map(p =>
        p.job_role_id === roleId
          ? { ...p, [permissionKey]: !p[permissionKey] }
          : p
      )
    );
    setModifiedRoles(prev => new Set(prev).add(roleId));
  };

  const handleSaveRole = async (roleId: number) => {
    const role = permissions.find(p => p.job_role_id === roleId);
    if (!role) return;

    setSavingRoleId(roleId);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateRolePermissions(roleId, {
        can_nominate: role.can_nominate,
        can_vote: role.can_vote,
        can_approve: role.can_approve,
        can_direct_assign: role.can_direct_assign,
        can_manage_periods: role.can_manage_periods,
        can_view_nominations: role.can_view_nominations,
        can_view_winners: role.can_view_winners,
        can_view_archives: role.can_view_archives,
        can_archive: role.can_archive,
      });
      
      setSuccessMessage(`Updated permissions for ${role.job_role_name}`);
      setModifiedRoles(prev => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingRoleId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const getTierColor = (tier: number) => {
    if (tier >= 5) return 'ap-bg-purple-100 ap-text-purple-800';
    if (tier >= 3) return 'ap-bg-blue-100 ap-text-blue-800';
    return 'ap-bg-gray-100 ap-text-gray-800';
  };

  // Sort permissions by tier (descending) then by role name
  const sortedPermissions = [...permissions].sort((a, b) => {
    const tierDiff = (b.job_role_tier || 0) - (a.job_role_tier || 0);
    if (tierDiff !== 0) return tierDiff;
    return (a.job_role_name || '').localeCompare(b.job_role_name || '');
  });

  return (
    <div className="ap-space-y-6">
      {/* Header */}
      <div className="ap-flex ap-items-center ap-gap-3">
        <div className="ap-p-2 ap-bg-gradient-to-br ap-from-yellow-400 ap-to-orange-500 ap-rounded-lg">
          <HiOutlineTrophy className="ap-h-6 ap-w-6 ap-text-white" />
        </div>
        <div>
          <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">
            Awesome Awards Permissions
          </h2>
          <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
            Configure which job roles can nominate, vote, and manage awards.
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
          <HiOutlineXCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-text-green-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
          <HiOutlineCheckCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Refresh Button */}
      <div className="ap-flex ap-justify-end">
        <Button
          onClick={fetchPermissions}
          disabled={isLoading}
          variant="ghost"
          leftIcon={<HiOutlineArrowPath className={`ap-h-5 ap-w-5 ${isLoading ? 'ap-animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Permissions Table */}
      <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
        <div className="ap-overflow-x-auto">
          <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
            <thead className="ap-bg-gray-50">
              <tr>
                <th className="ap-px-6 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Job Role
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Nominate
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Vote
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Approve
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Direct Assign
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Manage Periods
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  View Nominations
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  View Winners
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  View Archives
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Archive
                </th>
                <th className="ap-px-6 ap-py-3 ap-text-center ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
              {sortedPermissions.map((role) => (
                <tr 
                  key={role.job_role_id} 
                  className={modifiedRoles.has(role.job_role_id) ? 'ap-bg-yellow-50' : ''}
                >
                  <td className="ap-px-6 ap-py-4 ap-whitespace-nowrap">
                    <div className="ap-flex ap-items-center ap-gap-2">
                      <span className={`ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ${getTierColor(role.job_role_tier)}`}>
                        T{role.job_role_tier}
                      </span>
                      <span className="ap-font-medium ap-text-gray-900">{role.job_role_name}</span>
                    </div>
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_nominate}
                      onChange={() => togglePermission(role.job_role_id, 'can_nominate')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_vote}
                      onChange={() => togglePermission(role.job_role_id, 'can_vote')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_approve}
                      onChange={() => togglePermission(role.job_role_id, 'can_approve')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_direct_assign}
                      onChange={() => togglePermission(role.job_role_id, 'can_direct_assign')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_manage_periods}
                      onChange={() => togglePermission(role.job_role_id, 'can_manage_periods')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_view_nominations}
                      onChange={() => togglePermission(role.job_role_id, 'can_view_nominations')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_view_winners}
                      onChange={() => togglePermission(role.job_role_id, 'can_view_winners')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_view_archives}
                      onChange={() => togglePermission(role.job_role_id, 'can_view_archives')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    <input
                      type="checkbox"
                      checked={role.can_archive}
                      onChange={() => togglePermission(role.job_role_id, 'can_archive')}
                      className="ap-h-4 ap-w-4 ap-text-yellow-500 focus:ap-ring-yellow-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                    />
                  </td>
                  <td className="ap-px-6 ap-py-4 ap-text-center">
                    {modifiedRoles.has(role.job_role_id) && (
                      <Button
                        onClick={() => handleSaveRole(role.job_role_id)}
                        disabled={savingRoleId === role.job_role_id}
                        variant="warning"
                        size="sm"
                        loading={savingRoleId === role.job_role_id}
                      >
                        {savingRoleId === role.job_role_id ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Permission Descriptions</h3>
        <ul className="ap-text-sm ap-text-gray-600 ap-space-y-1">
          <li><strong>Nominate:</strong> Submit nominations for Employee of the Week/Month</li>
          <li><strong>Vote:</strong> Vote on nominations during voting periods</li>
          <li><strong>Approve:</strong> Approve/reject nominations and select winners</li>
          <li><strong>Direct Assign:</strong> Directly assign awards without voting</li>
          <li><strong>Manage Periods:</strong> Create, edit, and manage award periods</li>
          <li><strong>View Nominations:</strong> See all nominations (not just own)</li>
          <li><strong>View Winners:</strong> See winners and award history</li>
          <li><strong>View Archives:</strong> Access archived periods and nominations</li>
          <li><strong>Archive:</strong> Archive/unarchive award periods</li>
        </ul>
      </div>
    </div>
  );
};

export default AwesomeAwardsPermissions;
