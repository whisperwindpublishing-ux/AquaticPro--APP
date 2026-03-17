import React, { useState, useEffect, useCallback } from 'react';
import {
  HiOutlineTrophy,
  HiOutlineSparkles,
  HiOutlineClipboardDocumentList,
  HiOutlineCheckBadge,
  HiOutlineStar,
  HiOutlinePlus,
  HiOutlineHandThumbUp,
} from 'react-icons/hi2';
import NominationForm from './NominationForm';
import NominationsList from './NominationsList';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui/Button';
import { formatLocalDate } from '@/utils/dateUtils';
import {
  AwardPeriod,
  AwardPermissions,
} from '@/types/awesome-awards';

/**
 * AwardsHub Component
 * 
 * Main container for the Awesome Awards module.
 * Provides tabs for browsing nominations, creating nominations, voting, and approving.
 */

interface AwardsHubProps {
  initialTab?: 'browse' | 'nominate' | 'vote' | 'approvals' | 'winners';
}

// Helper to generate period display name
function getPeriodDisplayName(period: AwardPeriod): string {
  // If custom name exists, use it
  if (period.name) return period.name;
  
  // Generate a friendly name based on dates
  const startDate = new Date(period.start_date);
  
  if (period.period_type === 'week') {
    // Get week number
    const startOfYear = new Date(startDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((startDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `Week ${weekNumber} Award (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  } else {
    // Monthly - use month name
    return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Award`;
  }
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

async function getActivePeriods() {
  return apiFetch<AwardPeriod[]>('/awesome-awards/active-periods');
}

async function getMyPermissions() {
  return apiFetch<AwardPermissions>('/awesome-awards/my-permissions');
}

async function getPendingCount() {
  return apiFetch<{ count: number }>('/awesome-awards/nominations/pending-count');
}

async function getWinners() {
  return apiFetch<any[]>('/awesome-awards/winners');
}

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}> = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    className={`ap-flex ap-items-center ap-gap-2 ap-px-4 ap-py-2.5 ap-rounded-lg ap-transition-colors ${
      active
        ? 'ap-bg-blue-600 ap-text-white ap-shadow-md' : 'ap-bg-white ap-text-gray-700 hover:ap-bg-gray-50 ap-border ap-border-gray-200'
    }`}
  >
    {icon}
    <span className="ap-font-medium">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={`ap-ml-1 ap-px-2 ap-py-0.5 ap-text-xs ap-rounded-full ${
        active ? 'ap-bg-white/20 ap-text-white' : 'ap-bg-red-100 ap-text-red-600'
      }`}>
        {badge}
      </span>
    )}
  </button>
);

const AwardsHub: React.FC<AwardsHubProps> = ({ initialTab = 'browse' }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'nominate' | 'vote' | 'approvals' | 'winners'>(initialTab);
  const [permissions, setPermissions] = useState<AwardPermissions | null>(null);
  const [activePeriods, setActivePeriods] = useState<AwardPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<AwardPeriod | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if voting window is currently open for any active period
  const isVotingWindowOpen = useCallback((period?: AwardPeriod | null) => {
    if (!period) {
      // Check any active period
      return activePeriods.some(p => p.status === 'voting_open');
    }
    return period.status === 'voting_open';
  }, [activePeriods]);

  // Get periods that are in voting status
  const votingPeriods = activePeriods.filter(p => p.status === 'voting_open');

  // Fetch initial data
  const fetchData = useCallback(async () => {
    // Visitor Mode Bypass
    if (window.mentorshipPlatformData?.visitor_mode) {
        setPermissions({
            can_nominate: true,
            can_vote: true,
            can_approve: false,
            can_manage_periods: false,
            can_view_winners: true,
            can_view_nominations: true,
            can_direct_assign: false,
            can_view_archives: false,
            can_archive: false
        });
        setActivePeriods([]);
        setPendingCount(0);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [periodsData, permissionsData] = await Promise.all([
        getActivePeriods(),
        getMyPermissions(),
      ]);
      setActivePeriods(periodsData);
      setPermissions(permissionsData);

      // Auto-select first period if only one
      if (periodsData.length === 1 && !selectedPeriod) {
        setSelectedPeriod(periodsData[0]);
      }

      // Fetch pending count if user can approve
      if (permissionsData.can_approve) {
        try {
          const pending = await getPendingCount();
          setPendingCount(pending.count);
        } catch (e) {
          // Silent fail for pending count
        }
      }
    } catch (err) {
      console.error('Failed to load awards data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle successful nomination
  const handleNominationSuccess = () => {
    setActiveTab('browse');
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-6 ap-text-center">
        <p className="ap-text-red-700 ap-mb-4">{error}</p>
        <Button
          onClick={fetchData}
          variant="danger"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="ap-space-y-6">
      {/* Header */}
      <div className="ap-flex ap-items-center ap-justify-between">
        <div className="ap-flex ap-items-center ap-gap-3">
          <div className="ap-p-2 ap-bg-gradient-to-br ap-from-yellow-400 ap-to-orange-500 ap-rounded-xl">
            <HiOutlineTrophy className="ap-h-6 ap-w-6 ap-text-white" />
          </div>
          <div>
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Awesome Awards</h1>
            <p className="ap-text-gray-500 ap-text-sm">Recognize and celebrate your teammates</p>
          </div>
        </div>

        {/* Period selector */}
        {activePeriods.length > 1 && (
          <select
            value={selectedPeriod?.id || ''}
            onChange={(e) => {
              const period = activePeriods.find(p => p.id === Number(e.target.value));
              setSelectedPeriod(period || null);
            }}
            className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2"
          >
            <option value="">All Active Periods</option>
            {activePeriods.map(period => (
              <option key={period.id} value={period.id}>
                {getPeriodDisplayName(period)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No active periods message */}
      {activePeriods.length === 0 && (
        <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-6 ap-text-center">
          <HiOutlineSparkles className="ap-h-12 ap-w-12 ap-mx-auto ap-text-yellow-500 ap-mb-3" />
          <h3 className="ap-text-lg ap-font-medium ap-text-yellow-800 ap-mb-2">
            No Active Award Periods
          </h3>
          <p className="ap-text-yellow-700">
            There are no award periods currently accepting nominations or votes.
            Check back soon!
          </p>
        </div>
      )}

      {/* Tabs */}
      {activePeriods.length > 0 && (
        <>
          <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
            <TabButton
              active={activeTab === 'browse'}
              onClick={() => setActiveTab('browse')}
              icon={<HiOutlineClipboardDocumentList className="ap-h-5 ap-w-5" />}
              label="Browse"
            />

            {permissions?.can_nominate && (
              <TabButton
                active={activeTab === 'nominate'}
                onClick={() => setActiveTab('nominate')}
                icon={<HiOutlinePlus className="ap-h-5 ap-w-5" />}
                label="Nominate"
              />
            )}

            {permissions?.can_vote && (
              <TabButton
                active={activeTab === 'vote'}
                onClick={() => setActiveTab('vote')}
                icon={<HiOutlineHandThumbUp className="ap-h-5 ap-w-5" />}
                label="Vote"
                badge={votingPeriods.length > 0 ? votingPeriods.length : undefined}
              />
            )}

            {permissions?.can_approve && (
              <TabButton
                active={activeTab === 'approvals'}
                onClick={() => setActiveTab('approvals')}
                icon={<HiOutlineCheckBadge className="ap-h-5 ap-w-5" />}
                label="Approvals"
                badge={pendingCount}
              />
            )}

            {permissions?.can_view_winners && (
              <TabButton
                active={activeTab === 'winners'}
                onClick={() => setActiveTab('winners')}
                icon={<HiOutlineStar className="ap-h-5 ap-w-5" />}
                label="Winners"
              />
            )}
          </div>

          {/* Tab Content */}
          <div className="ap-min-h-[400px]">
            {/* Browse Tab */}
            {activeTab === 'browse' && (
              <NominationsList
                key={`browse-${selectedPeriod?.id || 'all'}`}
                periodId={selectedPeriod?.id}
                statusFilter="all"
                showVoting={permissions?.can_vote}
                votingWindowOpen={isVotingWindowOpen(selectedPeriod)}
              />
            )}

            {/* Nominate Tab */}
            {activeTab === 'nominate' && permissions?.can_nominate && (
              <div className="ap-max-w-2xl">
                <NominationForm
                  onSuccess={handleNominationSuccess}
                  onCancel={() => setActiveTab('browse')}
                />
              </div>
            )}

            {/* Vote Tab - Show approved nominations in voting window */}
            {activeTab === 'vote' && permissions?.can_vote && (
              <div>
                {votingPeriods.length === 0 ? (
                  <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineHandThumbUp className="ap-h-12 ap-w-12 ap-mx-auto ap-text-yellow-500 ap-mb-3" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-yellow-800 ap-mb-2">
                      No Active Voting Periods
                    </h3>
                    <p className="ap-text-yellow-700">
                      There are no award periods currently open for voting.
                      Check back during the voting window!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="ap-mb-4 ap-p-4 ap-bg-green-50 ap-rounded-lg">
                      <h3 className="ap-font-medium ap-text-green-900 ap-flex ap-items-center ap-gap-2">
                        <HiOutlineHandThumbUp className="ap-h-5 ap-w-5" />
                        Vote for Your Favorites
                      </h3>
                      <p className="ap-text-sm ap-text-green-700">
                        Cast your votes for approved nominations. Your votes help decide the winners!
                      </p>
                    </div>
                    <NominationsList
                      key={`vote-${selectedPeriod?.id || 'all'}`}
                      periodId={selectedPeriod?.id}
                      statusFilter="approved"
                      showVoting={true}
                      votingWindowOpen={true}
                    />
                  </>
                )}
              </div>
            )}

            {/* Approvals Tab */}
            {activeTab === 'approvals' && permissions?.can_approve && (
              <div>
                {/* Show different message based on period status */}
                {selectedPeriod?.status === 'pending_approval' ? (
                  <div className="ap-mb-4 ap-p-4 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg">
                    <h3 className="ap-font-medium ap-text-yellow-900 ap-flex ap-items-center ap-gap-2">
                      <HiOutlineTrophy className="ap-h-5 ap-w-5" />
                      Select Winner
                    </h3>
                    <p className="ap-text-sm ap-text-yellow-700">
                      Voting has closed for {getPeriodDisplayName(selectedPeriod)}. Review approved nominations and select the winner.
                    </p>
                  </div>
                ) : (
                  <div className="ap-mb-4 ap-p-4 ap-bg-blue-50 ap-rounded-lg">
                    <h3 className="ap-font-medium ap-text-blue-900">Approval Queue</h3>
                    <p className="ap-text-sm ap-text-blue-700">
                      Review and approve/reject pending nominations. Only approved nominations
                      can receive votes.
                    </p>
                  </div>
                )}
                <NominationsList
                  key={`approvals-${selectedPeriod?.id || 'all'}-${selectedPeriod?.status}`}
                  periodId={selectedPeriod?.id}
                  statusFilter={selectedPeriod?.status === 'pending_approval' ? 'approved' : 'pending'}
                  showApprovalActions={true}
                  showVoting={false}
                />
              </div>
            )}

            {/* Winners Tab */}
            {activeTab === 'winners' && permissions?.can_view_winners && (
              <WinnersGallery />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Winners Gallery Component
const WinnersGallery: React.FC = () => {
  const [winners, setWinners] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchWinners = async () => {
      try {
        setIsLoading(true);
        const data = await getWinners();
        setWinners(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load winners');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWinners();
  }, []);

  if (isLoading) {
    return (
      <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-6 ap-text-center">
        <p className="ap-text-red-700">{error}</p>
      </div>
    );
  }

  if (winners.length === 0) {
    return (
      <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-8 ap-text-center">
        <HiOutlineTrophy className="ap-h-16 ap-w-16 ap-mx-auto ap-text-yellow-500 ap-mb-4" />
        <h3 className="ap-text-lg ap-font-medium ap-text-yellow-900 ap-mb-2">
          No Winners Yet
        </h3>
        <p className="ap-text-yellow-700">
          Winners will appear here once award periods are completed.
        </p>
      </div>
    );
  }

  return (
    <div className="ap-space-y-4">
      <div className="ap-mb-6">
        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
          <HiOutlineTrophy className="ap-h-6 ap-w-6 ap-text-yellow-500" />
          Winner's Gallery
        </h2>
        <p className="ap-text-gray-600 ap-text-sm ap-mt-1">
          Celebrating our award winners and their achievements
        </p>
      </div>

      <div className="ap-grid ap-gap-4 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
        {winners.map((winner) => (
          <div
            key={winner.id}
            className="ap-bg-gradient-to-br ap-from-yellow-50 ap-to-orange-50 ap-border-2 ap-border-yellow-200 ap-rounded-lg ap-p-6 hover:ap-shadow-lg ap-transition-shadow"
          >
            {/* Winner Badge */}
            <div className="ap-flex ap-items-center ap-justify-center ap-mb-4">
              <div className="ap-relative">
                <div className="ap-w-20 ap-h-20 ap-rounded-full ap-bg-gradient-to-br ap-from-yellow-400 ap-to-orange-500 ap-flex ap-items-center ap-justify-center">
                  <HiOutlineTrophy className="ap-h-10 ap-w-10 ap-text-white" />
                </div>
                <div className="ap-absolute -ap-top-1 -ap-right-1 ap-w-6 ap-h-6 ap-bg-yellow-500 ap-rounded-full ap-flex ap-items-center ap-justify-center">
                  <HiOutlineStar className="ap-h-4 ap-w-4 ap-text-white" />
                </div>
              </div>
            </div>

            {/* Winner Info */}
            <div className="ap-text-center">
              <h3 className="ap-font-bold ap-text-lg ap-text-gray-900 ap-mb-1">
                {winner.nominee?.display_name || 'Unknown'}
              </h3>
              <p className="ap-text-sm ap-text-orange-700 ap-font-medium ap-mb-3">
                {winner.category_name || winner.period_name}
              </p>
              
              {/* Nomination Reason */}
              {winner.reason && (
                <p className="ap-text-sm ap-text-gray-700 ap-italic line-clamp-3 ap-mb-3">
                  "{winner.reason}"
                </p>
              )}
              
              {/* Period Date */}
              <p className="ap-text-xs ap-text-gray-500">
                {formatLocalDate(winner.created_at, {
                  month: 'long',
                  year: 'numeric'
                })}
              </p>

              {/* Vote Count */}
              {winner.vote_count > 0 && (
                <div className="ap-mt-3 ap-inline-flex ap-items-center ap-gap-1 ap-px-3 ap-py-1 ap-bg-white/60 ap-rounded-full">
                  <HiOutlineHandThumbUp className="ap-h-4 ap-w-4 ap-text-orange-600" />
                  <span className="ap-text-sm ap-font-medium ap-text-orange-700">
                    {winner.vote_count} {winner.vote_count === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AwardsHub;
