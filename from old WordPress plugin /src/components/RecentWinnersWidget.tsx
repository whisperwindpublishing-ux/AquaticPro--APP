/**
 * RecentWinnersWidget.tsx
 *
 * Dashboard widget displaying recent Awesome Awards winners.
 * Shows winner avatar, name, category, and period info with celebratory styling.
 */

import { useEffect, useState } from 'react';
import { getRecentWinners, RecentWinner } from '@/services/awesome-awards.service';
import { Button } from './ui/Button';

interface RecentWinnersWidgetProps {
  /** Maximum number of winners to display */
  limit?: number;
  /** Optional class name for styling */
  className?: string;
  /** Callback when a winner is clicked */
  onWinnerClick?: (winner: RecentWinner) => void;
}

/**
 * Format a date string relative to now (e.g., "2 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export function RecentWinnersWidget({
  limit = 5,
  className = '',
  onWinnerClick,
}: RecentWinnersWidgetProps) {
  const [winners, setWinners] = useState<RecentWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWinners() {
      try {
        setLoading(true);
        setError(null);
        const data = await getRecentWinners(limit);
        setWinners(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load winners');
      } finally {
        setLoading(false);
      }
    }

    fetchWinners();
  }, [limit]);

  if (loading) {
    return (
      <div className={`ap-bg-white dark:ap-bg-gray-800 ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 dark:ap-border-gray-700 ap-p-4 ${className}`}>
        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
          <span className="ap-text-xl">🏆</span>
          <h3 className="ap-font-semibold ap-text-gray-900 dark:ap-text-white">Recent Winners</h3>
        </div>
        <div className="ap-space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="ap-animate-pulse ap-flex ap-items-center ap-gap-3">
              <div className="ap-w-10 ap-h-10 ap-bg-gray-200 dark:ap-bg-gray-700 ap-rounded-full" />
              <div className="ap-flex-1 ap-space-y-2">
                <div className="ap-h-4 ap-bg-gray-200 dark:ap-bg-gray-700 ap-rounded ap-w-3/4" />
                <div className="ap-h-3 ap-bg-gray-200 dark:ap-bg-gray-700 ap-rounded ap-w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ap-bg-white dark:ap-bg-gray-800 ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 dark:ap-border-gray-700 ap-p-4 ${className}`}>
        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
          <span className="ap-text-xl">🏆</span>
          <h3 className="ap-font-semibold ap-text-gray-900 dark:ap-text-white">Recent Winners</h3>
        </div>
        <p className="ap-text-sm ap-text-red-500 dark:ap-text-red-400">{error}</p>
      </div>
    );
  }

  if (winners.length === 0) {
    return (
      <div className={`ap-bg-white dark:ap-bg-gray-800 ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 dark:ap-border-gray-700 ap-p-4 ${className}`}>
        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
          <span className="ap-text-xl">🏆</span>
          <h3 className="ap-font-semibold ap-text-gray-900 dark:ap-text-white">Recent Winners</h3>
        </div>
        <p className="ap-text-sm ap-text-gray-500 dark:ap-text-gray-400 ap-text-center ap-py-4">
          No winners yet! Be the first to nominate someone.
        </p>
      </div>
    );
  }

  return (
    <div className={`ap-bg-white dark:ap-bg-gray-800 ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 dark:ap-border-gray-700 ap-p-4 ${className}`}>
      <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
        <span className="ap-text-xl">🏆</span>
        <h3 className="ap-font-semibold ap-text-gray-900 dark:ap-text-white">Recent Winners</h3>
      </div>

      <div className="ap-space-y-3">
        {winners.map((winner) => (
          <div
            key={winner.id}
            className={`ap-flex ap-items-start ap-gap-3 ap-p-2 ap-rounded-lg ap-transition-colors ${
              onWinnerClick
                ? 'ap-cursor-pointer hover:ap-bg-gray-50 dark:hover:ap-bg-gray-700/50'
                : ''
            }`}
            onClick={() => onWinnerClick?.(winner)}
          >
            {/* Avatar with gold ring */}
            <div className="ap-relative ap-flex-shrink-0">
              <img
                src={winner.nominee_avatar}
                alt={winner.nominee_name}
                className="ap-w-10 ap-h-10 ap-rounded-full ap-ring-2 ap-ring-amber-400 ap-ring-offset-2 dark:ap-ring-offset-gray-800"
              />
              {/* Trophy overlay */}
              <span className="ap-absolute -ap-bottom-1 -ap-right-1 ap-text-sm">
                {winner.emoji || '🏆'}
              </span>
            </div>

            {/* Winner info */}
            <div className="ap-flex-1 ap-min-w-0">
              <p className="ap-font-medium ap-text-gray-900 dark:ap-text-white ap-truncate">
                {winner.nominee_name}
              </p>
              <p className="ap-text-sm ap-text-gray-600 dark:ap-text-gray-400 ap-truncate">
                {winner.period_name}
              </p>
              <div className="ap-flex ap-items-center ap-gap-2 ap-mt-1">
                <span className="ap-text-xs ap-text-gray-500 dark:ap-text-gray-500">
                  {formatRelativeTime(winner.selected_winner_at)}
                </span>
              </div>
            </div>

            {/* Vote count */}
            <div className="ap-flex-shrink-0 ap-text-right">
              <div className="ap-flex ap-items-center ap-gap-1 ap-text-amber-600 dark:ap-text-amber-400">
                <svg
                  className="ap-w-4 ap-h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="ap-text-sm ap-font-medium">{winner.vote_count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View all link */}
      <div className="ap-mt-4 ap-pt-3 ap-border-t ap-border-gray-200 dark:ap-border-gray-700">
        <Button
          variant="ghost"
          className="!ap-w-full !ap-text-center !ap-text-sm !ap-text-blue-600 dark:!ap-text-blue-400 hover:!ap-text-blue-700 dark:hover:!ap-text-blue-300 !ap-font-medium"
          onClick={() => {
            // Navigate to Awards Hub - this could be customized via props
            window.location.hash = '#awards';
          }}
        >
          View All Awards →
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact version of the widget for smaller spaces
 */
export function RecentWinnersCompact({
  limit = 3,
  className = '',
}: {
  limit?: number;
  className?: string;
}) {
  const [winners, setWinners] = useState<RecentWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentWinners(limit)
      .then(setWinners)
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading || winners.length === 0) return null;

  return (
    <div className={`ap-flex ap-items-center ap-gap-2 ${className}`}>
      <span className="ap-text-sm ap-text-gray-500 dark:ap-text-gray-400">Recent Winners:</span>
      <div className="ap-flex -ap-space-x-2">
        {winners.map((winner) => (
          <img
            key={winner.id}
            src={winner.nominee_avatar}
            alt={winner.nominee_name}
            title={`${winner.nominee_name} - ${winner.period_name}`}
            className="ap-w-8 ap-h-8 ap-rounded-full ap-ring-2 ap-ring-white dark:ap-ring-gray-800 hover:ap-z-10 hover:ap-ring-amber-400 ap-transition-all"
          />
        ))}
      </div>
    </div>
  );
}

export default RecentWinnersWidget;
