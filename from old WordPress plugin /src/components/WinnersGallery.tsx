import React, { useState, useEffect, useCallback } from 'react';
import {
  HiOutlineTrophy,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineCalendar,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
} from 'react-icons/hi2';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui/Button';
import { AwardPeriod, Nomination } from '@/types/awesome-awards';

/**
 * WinnersGallery Component
 * 
 * Displays all closed/archived award periods with their winners.
 * Each award shows the winning nomination(s) with nominee details.
 */

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

// Get all periods including closed/archived ones
async function getAllPeriods() {
  return apiFetch<AwardPeriod[]>('/awesome-awards/periods');
}

// Get nominations for a period
async function getPeriodNominations(periodId: number) {
  return apiFetch<Nomination[]>(`/awesome-awards/periods/${periodId}/nominations`);
}

// Helper to generate period display name
function getPeriodDisplayName(period: AwardPeriod): string {
  if (period.name) return period.name;
  
  const startDate = new Date(period.start_date);
  
  if (period.period_type === 'week') {
    const startOfYear = new Date(startDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((startDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `Week ${weekNumber} Award (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  } else {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Award`;
  }
}

// Format date range
function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

interface WinnerCardProps {
  nomination: Nomination;
  rank?: number;
}

const WinnerCard: React.FC<WinnerCardProps> = ({ nomination, rank }) => {
  return (
    <div className="ap-bg-gradient-to-br ap-from-amber-50 ap-to-yellow-50 ap-border ap-border-amber-200 ap-rounded-xl ap-p-5 ap-shadow-sm">
      <div className="ap-flex ap-items-start ap-gap-4">
        {/* Trophy/Rank indicator */}
        <div className={`ap-flex-shrink-0 ap-w-12 ap-h-12 ap-rounded-full ap-flex ap-items-center ap-justify-center ${
          rank === 1 ? 'ap-bg-gradient-to-br ap-from-yellow-400 ap-to-amber-500' :
          rank === 2 ? 'ap-bg-gradient-to-br ap-from-gray-300 ap-to-gray-400' :
          rank === 3 ? 'ap-bg-gradient-to-br ap-from-amber-600 ap-to-amber-700' : 'ap-bg-gradient-to-br ap-from-yellow-400 ap-to-amber-500'
        }`}>
          {rank && rank <= 3 ? (
            <span className="ap-text-white ap-font-bold ap-text-lg">{rank}</span>
          ) : (
            <HiOutlineTrophy className="ap-h-6 ap-w-6 ap-text-white" />
          )}
        </div>

        {/* Winner details */}
        <div className="ap-flex-1 ap-min-w-0">
          <div className="ap-flex ap-items-center ap-gap-2 ap-mb-1">
            <h4 className="ap-text-lg ap-font-semibold ap-text-gray-900">
              {nomination.nominee_name || 'Unknown Nominee'}
            </h4>
            <HiOutlineStar className="ap-h-5 ap-w-5 ap-text-amber-500" />
          </div>
          
          {nomination.reason_text && (
            <p className="ap-text-gray-700 ap-bg-white/60 ap-rounded-lg ap-p-3 ap-mt-2 ap-italic">
              "{nomination.reason_text}"
            </p>
          )}
          
          <div className="ap-flex ap-items-center ap-gap-4 ap-mt-3 ap-text-xs ap-text-gray-500">
            <span>Nominated by {nomination.nominator_name || 'Anonymous'}</span>
            {nomination.vote_count !== undefined && nomination.vote_count > 0 && (
              <span className="ap-flex ap-items-center ap-gap-1">
                <HiOutlineStar className="ap-h-3 ap-w-3" />
                {nomination.vote_count} vote{nomination.vote_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AwardSectionProps {
  period: AwardPeriod;
  defaultExpanded?: boolean;
}

const AwardSection: React.FC<AwardSectionProps> = ({ period, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [winners, setWinners] = useState<Nomination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load winners when expanded
  useEffect(() => {
    if (isExpanded && !hasLoaded) {
      setIsLoading(true);
      getPeriodNominations(period.id)
        .then(nominations => {
          // Filter to only show winner nominations
          const winnerNoms = nominations.filter(n => n.is_winner);
          // Sort by vote count descending
          winnerNoms.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
          setWinners(winnerNoms);
          setHasLoaded(true);
        })
        .catch(err => {
          console.error('Failed to load winners:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isExpanded, hasLoaded, period.id]);

  const statusBadge = period.status === 'closed' 
    ? { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-700' }
    : period.archived
    ? { label: 'Archived', bg: 'bg-purple-100', text: 'text-purple-700' }
    : { label: period.status, bg: 'bg-blue-100', text: 'text-blue-700' };

  return (
    <div className="ap-bg-white ap-rounded-xl ap-border ap-border-gray-200 ap-shadow-sm ap-overflow-hidden">
      {/* Header - clickable */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        className="!ap-w-full !ap-px-6 !ap-py-4 !ap-flex !ap-items-center !ap-gap-4 hover:!ap-bg-gray-50 !ap-transition-colors !ap-text-left !ap-justify-start !ap-rounded-none"
      >
        {/* Expand/collapse icon */}
        <div className="ap-flex-shrink-0 ap-text-gray-400">
          {isExpanded ? (
            <HiOutlineChevronDown className="ap-h-5 ap-w-5" />
          ) : (
            <HiOutlineChevronRight className="ap-h-5 ap-w-5" />
          )}
        </div>

        {/* Trophy icon */}
        <div className="ap-flex-shrink-0 ap-p-2 ap-bg-gradient-to-br ap-from-yellow-400 ap-to-orange-500 ap-rounded-lg">
          <HiOutlineTrophy className="ap-h-5 ap-w-5 ap-text-white" />
        </div>

        {/* Award info */}
        <div className="ap-flex-1 ap-min-w-0">
          <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
            {getPeriodDisplayName(period)}
          </h3>
          <p className="ap-text-sm ap-text-gray-500 ap-flex ap-items-center ap-gap-2 ap-mt-0.5">
            <HiOutlineCalendar className="ap-h-4 ap-w-4" />
            {formatDateRange(period.start_date, period.end_date)}
          </p>
        </div>

        {/* Status badge */}
        <span className={`ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
          {statusBadge.label}
        </span>

        {/* Winner count */}
        {period.winner_count !== undefined && period.winner_count > 0 && (
          <span className="ap-flex ap-items-center ap-gap-1 ap-text-amber-600 ap-text-sm ap-font-medium">
            <HiOutlineStar className="ap-h-4 ap-w-4" />
            {period.winner_count} winner{period.winner_count !== 1 ? 's' : ''}
          </span>
        )}
      </Button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="ap-border-t ap-border-gray-100 ap-p-6 ap-bg-gray-50">
          {isLoading ? (
            <div className="ap-flex ap-justify-center ap-py-8">
              <LoadingSpinner />
            </div>
          ) : winners.length === 0 ? (
            <div className="ap-text-center ap-py-8 ap-text-gray-500">
              <HiOutlineSparkles className="ap-h-10 ap-w-10 ap-mx-auto ap-text-gray-300 ap-mb-2" />
              <p>No winners announced yet for this award period.</p>
            </div>
          ) : (
            <div className="ap-space-y-4">
              {winners.map((winner, index) => (
                <WinnerCard
                  key={winner.id}
                  nomination={winner}
                  rank={winners.length > 1 ? index + 1 : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const WinnersGallery: React.FC = () => {
  const [periods, setPeriods] = useState<AwardPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriods = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allPeriods = await getAllPeriods();
      // Filter to only closed or archived periods, sorted by end date descending
      const closedPeriods = allPeriods
        .filter(p => p.status === 'closed' || p.archived)
        .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
      setPeriods(closedPeriods);
    } catch (err) {
      console.error('Failed to load periods:', err);
      setError(err instanceof Error ? err.message : 'Failed to load winners gallery');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

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
          onClick={fetchPeriods}
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
      <div className="ap-flex ap-items-center ap-gap-3">
        <div className="ap-p-2 ap-bg-gradient-to-br ap-from-yellow-400 ap-to-orange-500 ap-rounded-xl">
          <HiOutlineTrophy className="ap-h-6 ap-w-6 ap-text-white" />
        </div>
        <div>
          <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Winners Gallery</h1>
          <p className="ap-text-gray-500 ap-text-sm">Celebrating our award-winning teammates</p>
        </div>
      </div>

      {/* No periods message */}
      {periods.length === 0 ? (
        <div className="ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-xl ap-p-8 ap-text-center">
          <HiOutlineTrophy className="ap-h-16 ap-w-16 ap-mx-auto ap-text-amber-400 ap-mb-4" />
          <h3 className="ap-text-xl ap-font-medium ap-text-amber-800 ap-mb-2">
            No Past Awards Yet
          </h3>
          <p className="ap-text-amber-700 ap-max-w-md ap-mx-auto">
            Once award periods are completed and winners are announced, they'll appear here 
            in the Winners Gallery for everyone to celebrate!
          </p>
        </div>
      ) : (
        <div className="ap-space-y-4">
          {periods.map((period, index) => (
            <AwardSection
              key={period.id}
              period={period}
              defaultExpanded={index === 0} // First one expanded by default
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WinnersGallery;
