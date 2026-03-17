/**
 * WinnerAnnouncementBanner.tsx
 *
 * A dismissible banner shown at the top of the page announcing recent winners.
 * Shows winner avatar, name, category, and allows users to dismiss individual announcements.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getAnnouncements,
  markAnnouncementSeen,
  WinnerAnnouncement,
} from '@/services/awesome-awards.service';
import { Button } from './ui';

interface WinnerAnnouncementBannerProps {
  /** Callback when user clicks to view winner celebration */
  onViewCelebration?: (announcement: WinnerAnnouncement) => void;
  /** Maximum number of announcements to show at once */
  maxVisible?: number;
  /** Optional class name */
  className?: string;
}

/**
 * Single announcement banner item
 */
function AnnouncementItem({
  announcement,
  onDismiss,
  onViewDetails,
}: {
  announcement: WinnerAnnouncement;
  onDismiss: () => void;
  onViewDetails?: () => void;
}) {
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await markAnnouncementSeen(announcement.id);
    } catch (error) {
      console.error('Failed to dismiss announcement:', error);
    }
    // Small delay for animation
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`ap-flex ap-items-center ap-gap-3 ap-transition-all ap-duration-300 ${
        isDismissing ? 'ap-opacity-0 -ap-translate-y-2' : 'ap-opacity-100 ap-translate-y-0'
      }`}
    >
      {/* Winner avatar */}
      <img
        src={announcement.nominee_avatar}
        alt={announcement.nominee_name}
        className="ap-w-8 ap-h-8 ap-rounded-full ap-ring-2 ap-ring-white/50 ap-flex-shrink-0"
      />

      {/* Announcement text */}
      <div className="ap-flex-1 ap-min-w-0">
        <p className="ap-text-sm ap-font-medium ap-truncate">
          <span className="ap-text-white">🏆</span>{' '}
          <span className={announcement.is_current_user ? 'ap-text-yellow-200 ap-font-bold' : 'ap-text-white'}>
            {announcement.is_current_user ? 'You won' : announcement.nominee_name}
          </span>{' '}
          <span className="ap-text-amber-100">
            {announcement.is_current_user ? '' : 'won '}
            {announcement.period_name}!
          </span>
        </p>
        <p className="ap-text-xs ap-text-amber-200/70 ap-truncate">
          {announcement.emoji}
        </p>
      </div>

      {/* View details button */}
      {onViewDetails && (
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={onViewDetails}
          className="!ap-flex-shrink-0 !ap-px-3 !ap-py-1.5 !ap-text-amber-900 !ap-bg-white/90 hover:!ap-bg-white !ap-shadow-sm"
        >
          View
        </Button>
      )}

      {/* Dismiss button */}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={handleDismiss}
        className="!ap-flex-shrink-0 !ap-p-1.5 !ap-min-h-0 !ap-text-amber-200/70 hover:!ap-text-white hover:!ap-bg-white/10"
        aria-label="Dismiss announcement"
      >
        <svg className="ap-w-4 ap-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}

export function WinnerAnnouncementBanner({
  onViewCelebration,
  maxVisible = 3,
  className = '',
}: WinnerAnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<WinnerAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnnouncements();
        setAnnouncements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load announcements');
      } finally {
        setLoading(false);
      }
    }

    fetchAnnouncements();
  }, []);

  const handleDismiss = useCallback((id: number) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDismissAll = async () => {
    try {
      await Promise.all(
        announcements.map((a) => markAnnouncementSeen(a.id))
      );
      setAnnouncements([]);
    } catch (error) {
      console.error('Failed to dismiss all announcements:', error);
    }
  };

  // Don't render if loading, error, or no announcements
  if (loading || error || announcements.length === 0) {
    return null;
  }

  const visibleAnnouncements = isExpanded
    ? announcements
    : announcements.slice(0, maxVisible);
  const hiddenCount = announcements.length - maxVisible;

  return (
    <div
      className={`ap-bg-gradient-to-r ap-from-amber-500 ap-via-yellow-500 ap-to-amber-500 ap-shadow-lg ${className}`}
      role="region"
      aria-label="Winner announcements"
    >
      <div className="ap-max-w-7xl ap-mx-auto ap-px-4 ap-py-3">
        {/* Single announcement - compact view */}
        {announcements.length === 1 ? (
          <AnnouncementItem
            announcement={announcements[0]}
            onDismiss={() => handleDismiss(announcements[0].id)}
            onViewDetails={
              onViewCelebration
                ? () => onViewCelebration(announcements[0])
                : undefined
            }
          />
        ) : (
          /* Multiple announcements */
          <div className="ap-space-y-2">
            {/* Header with count */}
            <div className="ap-flex ap-items-center ap-justify-between">
              <div className="ap-flex ap-items-center ap-gap-2">
                <span className="ap-text-lg">🏆</span>
                <span className="ap-text-sm ap-font-medium ap-text-white">
                  {announcements.length} New Winner{announcements.length !== 1 ? 's' : ''}!
                </span>
              </div>
              <div className="ap-flex ap-items-center ap-gap-2">
                {hiddenCount > 0 && !isExpanded && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => setIsExpanded(true)}
                    className="!ap-text-amber-100 hover:!ap-text-white !ap-p-0 !ap-h-auto"
                  >
                    Show all ({announcements.length})
                  </Button>
                )}
                {isExpanded && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => setIsExpanded(false)}
                    className="!ap-text-amber-100 hover:!ap-text-white !ap-p-0 !ap-h-auto"
                  >
                    Show less
                  </Button>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={handleDismissAll}
                  className="!ap-text-amber-100 hover:!ap-text-white !ap-p-0 !ap-h-auto !ap-underline"
                >
                  Dismiss all
                </Button>
              </div>
            </div>

            {/* Announcement list */}
            <div className="ap-space-y-2">
              {visibleAnnouncements.map((announcement) => (
                <AnnouncementItem
                  key={announcement.id}
                  announcement={announcement}
                  onDismiss={() => handleDismiss(announcement.id)}
                  onViewDetails={
                    onViewCelebration
                      ? () => onViewCelebration(announcement)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Floating notification style banner (alternative design)
 */
export function WinnerNotificationToast({
  announcement,
  onDismiss,
  onViewCelebration,
}: {
  announcement: WinnerAnnouncement;
  onDismiss: () => void;
  onViewCelebration?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setIsVisible(true);

    // Auto-dismiss after 10 seconds unless it's the current user's win
    if (!announcement.is_current_user) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [announcement.is_current_user]);

  const handleDismiss = async () => {
    setIsVisible(false);
    try {
      await markAnnouncementSeen(announcement.id);
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`ap-fixed ap-bottom-4 ap-right-4 ap-z-40 ap-max-w-sm ap-bg-white dark:ap-bg-gray-800 ap-rounded-xl ap-shadow-2xl ap-border ap-border-amber-200 dark:ap-border-amber-700 ap-overflow-hidden ap-transform ap-transition-all ap-duration-300 ${
        isVisible ? 'ap-translate-y-0 ap-opacity-100' : 'ap-translate-y-4 ap-opacity-0'
      }`}
    >
      {/* Gold top accent */}
      <div className="ap-h-1 ap-bg-gradient-to-r ap-from-amber-400 ap-via-yellow-300 ap-to-amber-400" />

      <div className="ap-p-4">
        <div className="ap-flex ap-items-start ap-gap-3">
          {/* Avatar */}
          <div className="ap-relative ap-flex-shrink-0">
            <img
              src={announcement.nominee_avatar}
              alt={announcement.nominee_name}
              className="ap-w-12 ap-h-12 ap-rounded-full ap-ring-2 ap-ring-amber-400"
            />
            <span className="ap-absolute -ap-bottom-1 -ap-right-1 ap-text-lg">
              {announcement.emoji || '🏆'}
            </span>
          </div>

          {/* Content */}
          <div className="ap-flex-1 ap-min-w-0">
            <p className="ap-font-semibold ap-text-gray-900 dark:ap-text-white">
              {announcement.is_current_user ? '🎉 You Won!' : '🏆 Winner Announced'}
            </p>
            <p className="ap-text-sm ap-text-gray-600 dark:ap-text-gray-300 ap-truncate">
              {announcement.is_current_user
                ? announcement.period_name
                : `${announcement.nominee_name} - ${announcement.period_name}`}
            </p>
            <p className="ap-text-xs ap-text-gray-500 dark:ap-text-gray-400">
              {announcement.emoji}
            </p>
          </div>

          {/* Close button */}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDismiss}
            className="!ap-flex-shrink-0 !ap-p-1 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-gray-600 dark:!ap-text-gray-500 dark:hover:!ap-text-gray-300"
            aria-label="Dismiss"
          >
            <svg className="ap-w-5 ap-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Action button */}
        {onViewCelebration && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onViewCelebration();
              handleDismiss();
            }}
            className="!ap-mt-3 !ap-w-full !ap-bg-gradient-to-r !ap-from-amber-500 !ap-to-yellow-500 hover:!ap-from-amber-600 hover:!ap-to-yellow-600"
          >
            {announcement.is_current_user ? 'View Your Award! 🎊' : 'Celebrate! 🎉'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default WinnerAnnouncementBanner;
