import React, { useState, useEffect, useCallback } from 'react';
import { formatLocalDate } from '@/utils/dateUtils';
import { Button } from './ui/Button';
import { 
  HiOutlineTrophy, 
  HiOutlineUser, 
  HiOutlineHandThumbUp,
  HiHandThumbUp,
  HiOutlineXCircle,
  HiOutlineEyeSlash,
  HiOutlineClock,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineStar,
  HiOutlineFunnel
} from 'react-icons/hi2';
import LoadingSpinner from './LoadingSpinner';
import { 
  Nomination,
  NominationStatus,
  AwardPermissions
} from '@/types/awesome-awards';

/**
 * NominationsList Component
 * 
 * Displays nominations with voting, filtering, and admin approval actions.
 */

interface NominationsListProps {
  periodId?: number;
  categoryId?: number;
  showApprovalActions?: boolean;
  showVoting?: boolean;
  votingWindowOpen?: boolean; // Whether the voting window is currently open
  statusFilter?: NominationStatus | 'all';
  onNominationClick?: (nomination: Nomination) => void;
}

// API helpers
const API_BASE = (window as any).mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
const NONCE = (window as any).mentorshipPlatformData?.nonce || '';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

async function getNominations(params: {
  period_id?: number;
  category_id?: number;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params.period_id) query.append('period_id', String(params.period_id));
  if (params.category_id) query.append('category_id', String(params.category_id));
  if (params.status) query.append('status', params.status);
  const queryStr = query.toString() ? `?${query}` : '';
  return apiFetch<Nomination[]>(`/awesome-awards/nominations${queryStr}`);
}

async function getMyPermissions() {
  return apiFetch<AwardPermissions>('/awesome-awards/my-permissions');
}

async function castVote(nominationId: number) {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/vote`, {
    method: 'POST',
  });
}

async function removeVote(nominationId: number) {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/vote`, {
    method: 'DELETE',
  });
}

async function approveNomination(nominationId: number, action: 'approve' | 'reject') {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
}

async function selectWinner(nominationId: number) {
  return apiFetch<Nomination>(`/awesome-awards/nominations/${nominationId}/winner`, {
    method: 'POST',
  });
}

function getStatusBadge(status: NominationStatus) {
  const badges: Record<NominationStatus, { label: string; className: string }> = {
    pending: { label: 'Pending Review', className: 'ap-bg-yellow-100 ap-text-yellow-700' },
    approved: { label: 'Approved', className: 'ap-bg-green-100 ap-text-green-700' },
    rejected: { label: 'Rejected', className: 'ap-bg-red-100 ap-text-red-700' },
    winner: { label: '🏆 Winner', className: 'ap-bg-gradient-to-r ap-from-yellow-100 ap-to-orange-100 ap-text-orange-700 ap-font-semibold' },
  };
  return badges[status] || { label: status, className: 'ap-bg-gray-100 ap-text-gray-700' };
}

const NominationsList: React.FC<NominationsListProps> = ({
  periodId,
  categoryId,
  showApprovalActions = false,
  showVoting = true,
  votingWindowOpen = true,
  statusFilter = 'all',
}) => {
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [permissions, setPermissions] = useState<AwardPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<NominationStatus | 'all'>(statusFilter);

  // Fetch data
  const fetchNominations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nominationsData, permissionsData] = await Promise.all([
        getNominations({
          period_id: periodId,
          category_id: categoryId,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
        }),
        getMyPermissions(),
      ]);
      setNominations(nominationsData);
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Failed to load nominations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load nominations');
    } finally {
      setIsLoading(false);
    }
  }, [periodId, categoryId, selectedStatus]);

  useEffect(() => {
    fetchNominations();
  }, [fetchNominations]);

  // Handle voting
  const handleVote = async (nomination: Nomination) => {
    setLoadingAction(nomination.id);
    try {
      let updatedNomination: Nomination;
      if (nomination.user_voted) {
        updatedNomination = await removeVote(nomination.id);
      } else {
        updatedNomination = await castVote(nomination.id);
      }
      // Update the nomination in the list without refetching
      setNominations(prevNominations =>
        prevNominations.map(nom =>
          nom.id === updatedNomination.id ? updatedNomination : nom
        )
      );
    } catch (err) {
      console.error('Vote error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process vote');
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle approval
  const handleApproval = async (nomination: Nomination, action: 'approve' | 'reject') => {
    setLoadingAction(nomination.id);
    try {
      await approveNomination(nomination.id, action);
      await fetchNominations();
    } catch (err) {
      console.error('Approval error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process approval');
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle winner selection
  const handleSelectWinner = async (nomination: Nomination) => {
    // Use category_name which now falls back to period name when no category
    const awardName = nomination.category_name || 'this award';
    if (!confirm(`Select ${nomination.nominee?.display_name} as the winner for ${awardName}?`)) {
      return;
    }
    
    setLoadingAction(nomination.id);
    try {
      await selectWinner(nomination.id);
      alert(`🏆 ${nomination.nominee?.display_name} has been selected as the winner! They will be notified via email.`);
      await fetchNominations();
      // Refresh the page to update active periods and show winner
      window.location.reload();
    } catch (err) {
      console.error('Winner selection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to select winner');
    } finally {
      setLoadingAction(null);
    }
  };

  if (isLoading && nominations.length === 0) {
    return (
      <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="ap-space-y-4">
      {/* Filters */}
      <div className="ap-flex ap-items-center ap-gap-4 ap-flex-wrap">
        <div className="ap-flex ap-items-center ap-gap-2">
          <HiOutlineFunnel className="ap-h-5 ap-w-5 ap-text-gray-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as NominationStatus | 'all')}
            className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-1.5 ap-text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="winner">Winners</option>
          </select>
        </div>
        
        <div className="ap-text-sm ap-text-gray-500">
          {nominations.length} nomination{nominations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
          <HiOutlineXCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
          <span>{error}</span>
          <Button onClick={() => setError(null)} variant="ghost" size="xs" className="!ap-ml-auto !ap-text-red-500 hover:!ap-text-red-700 !ap-p-0 !ap-min-h-0">×</Button>
        </div>
      )}

      {/* Nominations List */}
      {nominations.length === 0 ? (
        <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg">
          <HiOutlineTrophy className="ap-h-12 ap-w-12 ap-mx-auto ap-text-gray-400 ap-mb-3" />
          <p className="ap-text-gray-500">No nominations found.</p>
        </div>
      ) : (
        <div className="ap-space-y-4">
          {nominations.map(nomination => {
            const badge = getStatusBadge(nomination.status);
            const isActionLoading = loadingAction === nomination.id;
            
            // Debug: Log nomination data to help troubleshoot winner selection button
            if (showApprovalActions && nomination.status === 'approved') {
              console.log('[NominationsList] Winner selection check:', {
                nominationId: nomination.id,
                showApprovalActions,
                canApprove: permissions?.can_approve,
                status: nomination.status,
                period_status: nomination.period_status,
                shouldShow: showApprovalActions && permissions?.can_approve && nomination.status === 'approved' && nomination.period_status === 'pending_approval'
              });
            }

            return (
              <div
                key={nomination.id}
                className={`ap-bg-white ap-rounded-lg ap-shadow ap-border ap-overflow-hidden ${
                  nomination.status === 'winner' ? 'ap-ring-2 ap-ring-yellow-400' : ''
                }`}
              >
                {/* Header */}
                <div className="ap-px-4 ap-py-3 ap-border-b ap-bg-gray-50 ap-flex ap-items-center ap-justify-between">
                  <div className="ap-flex ap-items-center ap-gap-3">
                    <span className="ap-text-sm ap-font-medium ap-text-gray-600">
                      {nomination.category_name}
                    </span>
                    <span className={`ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-500">
                    <HiOutlineClock className="ap-h-4 ap-w-4" />
                    {formatLocalDate(nomination.created_at)}
                  </div>
                </div>

                {/* Body */}
                <div className="ap-p-4">
                  {/* Nominee */}
                  <div className="ap-flex ap-items-start ap-gap-4 ap-mb-4">
                    <div className="ap-flex-shrink-0">
                      {nomination.nominee?.avatar_url ? (
                        <img
                          src={nomination.nominee.avatar_url}
                          alt=""
                          className="ap-h-12 ap-w-12 ap-rounded-full"
                        />
                      ) : (
                        <div className="ap-h-12 ap-w-12 ap-rounded-full ap-bg-blue-100 ap-flex ap-items-center ap-justify-center">
                          <HiOutlineUser className="ap-h-6 ap-w-6 ap-text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="ap-flex-1 ap-min-w-0">
                      <h4 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                        {nomination.nominee?.display_name || 'Unknown User'}
                      </h4>
                      <p className="ap-text-sm ap-text-gray-500">
                        Nominated by{' '}
                        {nomination.is_anonymous ? (
                          <span className="ap-inline-flex ap-items-center ap-gap-1">
                            <HiOutlineEyeSlash className="ap-h-3.5 ap-w-3.5" />
                            Anonymous
                          </span>
                        ) : (
                          nomination.nominator?.display_name || 'Unknown'
                        )}
                      </p>
                    </div>

                    {/* Vote count & button */}
                    {showVoting && nomination.status === 'approved' && permissions?.can_vote && (
                      <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                          onClick={() => handleVote(nomination)}
                          disabled={isActionLoading || !votingWindowOpen}
                          title={!votingWindowOpen ? 'Voting window is not currently open' : nomination.user_voted ? 'Remove your vote' : 'Vote for this nomination'}
                          variant="ghost"
                          className={`!ap-flex !ap-items-center !ap-gap-1.5 !ap-px-3 !ap-py-1.5 !ap-rounded-lg !ap-transition-colors ${
                            !votingWindowOpen
                              ? '!ap-bg-gray-100 !ap-text-gray-400 !ap-cursor-not-allowed'
                              : nomination.user_voted
                                ? '!ap-bg-blue-600 !ap-text-white hover:!ap-bg-blue-700 !ap-shadow-sm' : '!ap-bg-gray-100 !ap-text-gray-600 hover:!ap-bg-blue-100 hover:!ap-text-blue-600'
                          }`}
                        >
                          {isActionLoading ? (
                            <LoadingSpinner />
                          ) : nomination.user_voted ? (
                            <HiHandThumbUp className="ap-h-5 ap-w-5" />
                          ) : (
                            <HiOutlineHandThumbUp className="ap-h-5 ap-w-5" />
                          )}
                          <span className="ap-font-medium">{nomination.vote_count}</span>
                          <span className="ap-text-xs ap-ml-1">{nomination.user_voted ? 'Voted' : 'Vote'}</span>
                        </Button>
                      </div>
                    )}

                    {/* Vote count display (non-voting) */}
                    {(!showVoting || nomination.status !== 'approved') && (
                      <div className="ap-flex ap-items-center ap-gap-1.5 ap-text-gray-500">
                        <HiOutlineHandThumbUp className="ap-h-5 ap-w-5" />
                        <span>{nomination.vote_count}</span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="ap-bg-gray-50 ap-rounded-lg ap-p-3 ap-text-sm ap-text-gray-700">
                    <p className="ap-whitespace-pre-wrap">{nomination.reason_text}</p>
                  </div>
                </div>

                {/* Actions */}
                {(showApprovalActions && permissions?.can_approve && nomination.status === 'pending') && (
                  <div className="ap-px-4 ap-py-3 ap-border-t ap-bg-gray-50 ap-flex ap-items-center ap-justify-end ap-gap-2">
                    <Button
                      onClick={() => handleApproval(nomination, 'reject')}
                      disabled={isActionLoading}
                      variant="ghost"
                      className="!ap-flex !ap-items-center !ap-gap-1.5 !ap-px-3 !ap-py-1.5 !ap-text-red-600 hover:!ap-bg-red-50 !ap-rounded-lg"
                    >
                      {isActionLoading ? <LoadingSpinner /> : <HiOutlineXMark className="ap-h-5 ap-w-5" />}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApproval(nomination, 'approve')}
                      disabled={isActionLoading}
                      variant="primary"
                      className="!ap-flex !ap-items-center !ap-gap-1.5 !ap-px-3 !ap-py-1.5 !ap-bg-green-600 hover:!ap-bg-green-700 !ap-rounded-lg"
                    >
                      {isActionLoading ? <LoadingSpinner /> : <HiOutlineCheck className="ap-h-5 ap-w-5" />}
                      Approve
                    </Button>
                  </div>
                )}

                {/* Winner selection (for pending_approval periods) */}
                {(showApprovalActions && permissions?.can_approve && nomination.status === 'approved' && nomination.period_status === 'pending_approval') && (
                  <div className="ap-px-4 ap-py-3 ap-border-t ap-bg-yellow-50 ap-flex ap-items-center ap-justify-end">
                    <Button
                      onClick={() => handleSelectWinner(nomination)}
                      disabled={isActionLoading}
                      variant="primary"
                      className="!ap-flex !ap-items-center !ap-gap-1.5 !ap-px-4 !ap-py-2 !ap-bg-gradient-to-r !ap-from-yellow-500 !ap-to-orange-500 hover:!ap-from-yellow-600 hover:!ap-to-orange-600 !ap-rounded-lg"
                    >
                      {isActionLoading ? <LoadingSpinner /> : <HiOutlineStar className="ap-h-5 ap-w-5" />}
                      Select as Winner
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NominationsList;
