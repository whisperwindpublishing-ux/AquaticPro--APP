/**
 * AwardsIntegration.tsx
 *
 * Integration provider that manages Awesome Awards state across the app.
 * Handles fetching announcements, showing celebrations, and coordinating components.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  getAnnouncements,
  WinnerAnnouncement,
} from '@/services/awesome-awards.service';
import { WinnerCelebration } from './WinnerCelebration';
import { WinnerAnnouncementBanner } from './WinnerAnnouncementBanner';
import { Button } from './ui/Button';

interface AwardsContextType {
  /** Unseen announcements */
  announcements: WinnerAnnouncement[];
  /** Whether announcements are loading */
  loading: boolean;
  /** Trigger a celebration for a specific announcement */
  showCelebration: (announcement: WinnerAnnouncement) => void;
  /** Refresh announcements from server */
  refreshAnnouncements: () => Promise<WinnerAnnouncement[]>;
  /** Number of unseen announcements */
  unseenCount: number;
}

const AwardsContext = createContext<AwardsContextType | null>(null);

interface AwardsProviderProps {
  children: ReactNode;
  /** Show the banner automatically */
  showBanner?: boolean;
  /** Show celebration modals automatically for unseen announcements */
  autoShowCelebrations?: boolean;
  /** Only auto-show celebrations for the current user's wins */
  autoShowOnlyOwnWins?: boolean;
  /** Fetch interval in milliseconds (default: 5 minutes) */
  fetchInterval?: number;
}

export function AwardsProvider({
  children,
  showBanner = true,
  autoShowCelebrations = true,
  autoShowOnlyOwnWins = false,
  fetchInterval = 5 * 60 * 1000, // 5 minutes
}: AwardsProviderProps) {
  const [announcements, setAnnouncements] = useState<WinnerAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCelebration, setCurrentCelebration] = useState<WinnerAnnouncement | null>(null);
  const [_celebrationQueue, setCelebrationQueue] = useState<WinnerAnnouncement[]>([]);
  const [hasShownAutomatic, setHasShownAutomatic] = useState(false);

  // Fetch announcements
  const refreshAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAnnouncements();
      setAnnouncements(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    refreshAnnouncements().then((data) => {
      // Auto-show celebrations for new announcements
      if (autoShowCelebrations && !hasShownAutomatic && data.length > 0) {
        const toShow = autoShowOnlyOwnWins
          ? data.filter((a) => a.is_current_user)
          : data;

        if (toShow.length > 0) {
          setCelebrationQueue(toShow);
          setCurrentCelebration(toShow[0]);
          setHasShownAutomatic(true);
        }
      }
    });

    // Set up periodic refresh
    const interval = setInterval(refreshAnnouncements, fetchInterval);
    return () => clearInterval(interval);
  }, [refreshAnnouncements, fetchInterval, autoShowCelebrations, autoShowOnlyOwnWins, hasShownAutomatic]);

  // Handle celebration close - show next in queue or clear
  const handleCelebrationClose = useCallback(() => {
    setCelebrationQueue((prev) => {
      const remaining = prev.slice(1);
      if (remaining.length > 0) {
        setCurrentCelebration(remaining[0]);
      } else {
        setCurrentCelebration(null);
      }
      return remaining;
    });

    // Remove from announcements list
    if (currentCelebration) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== currentCelebration.id));
    }
  }, [currentCelebration]);

  // Manual trigger for celebration
  const showCelebration = useCallback((announcement: WinnerAnnouncement) => {
    setCurrentCelebration(announcement);
  }, []);

  // Handle banner view celebration
  const handleBannerViewCelebration = useCallback((announcement: WinnerAnnouncement) => {
    showCelebration(announcement);
  }, [showCelebration]);

  const contextValue: AwardsContextType = {
    announcements,
    loading,
    showCelebration,
    refreshAnnouncements,
    unseenCount: announcements.length,
  };

  return (
    <AwardsContext.Provider value={contextValue}>
      {/* Banner (optional) */}
      {showBanner && announcements.length > 0 && !currentCelebration && (
        <WinnerAnnouncementBanner onViewCelebration={handleBannerViewCelebration} />
      )}

      {/* Celebration Modal */}
      {currentCelebration && (
        <WinnerCelebration
          announcement={currentCelebration}
          onClose={handleCelebrationClose}
          isCurrentUserWin={currentCelebration.is_current_user}
        />
      )}

      {children}
    </AwardsContext.Provider>
  );
}

/**
 * Hook to access awards context
 */
export function useAwards(): AwardsContextType {
  const context = useContext(AwardsContext);
  if (!context) {
    throw new Error('useAwards must be used within an AwardsProvider');
  }
  return context;
}

/**
 * Notification badge component for nav/header
 */
export function AwardsNotificationBadge({
  className = '',
}: {
  className?: string;
}) {
  const { unseenCount, loading } = useAwards();

  if (loading || unseenCount === 0) {
    return null;
  }

  return (
    <span
      className={`ap-inline-flex ap-items-center ap-justify-center ap-px-2 ap-py-0.5 ap-text-xs ap-font-bold ap-text-white ap-bg-amber-500 ap-rounded-full ap-animate-pulse ${className}`}
    >
      {unseenCount > 9 ? '9+' : unseenCount}
    </span>
  );
}

/**
 * Awards icon button for navigation
 */
export function AwardsNavButton({
  onClick,
  className = '',
}: {
  onClick?: () => void;
  className?: string;
}) {
  const { unseenCount } = useAwards();

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`!ap-relative !ap-p-2 ${className}`}
      aria-label={`Awards${unseenCount > 0 ? ` (${unseenCount} new)` : ''}`}
    >
      <span className="ap-text-xl">🏆</span>
      {unseenCount > 0 && (
        <span className="ap-absolute -ap-top-1 -ap-right-1 ap-inline-flex ap-items-center ap-justify-center ap-w-5 ap-h-5 ap-text-xs ap-font-bold ap-text-white ap-bg-amber-500 ap-rounded-full">
          {unseenCount > 9 ? '9+' : unseenCount}
        </span>
      )}
    </Button>
  );
}

/**
 * Standalone hook for when you don't want to use the full provider
 */
export function useAwardsAnnouncements() {
  const [announcements, setAnnouncements] = useState<WinnerAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { announcements, loading, error, refresh };
}

export default AwardsProvider;
