/**
 * Awesome Awards Components Index
 *
 * Central export file for all Awesome Awards related components.
 * Makes importing easier throughout the application.
 */

// Main Awards Hub (already exists)
export { default as AwardsHub } from '../AwardsHub';

// Phase 4 Components
export { default as AwardBadge, AwardBadgeInline } from '../AwardBadge';
export type { UserAwardStats } from '../AwardBadge';

export {
  RecentWinnersWidget,
  RecentWinnersCompact,
} from '../RecentWinnersWidget';

export {
  WinnerCelebration,
  useWinnerCelebrations,
} from '../WinnerCelebration';

export {
  WinnerAnnouncementBanner,
  WinnerNotificationToast,
} from '../WinnerAnnouncementBanner';

export {
  AwardsProvider,
  useAwards,
  AwardsNotificationBadge,
  AwardsNavButton,
  useAwardsAnnouncements,
} from '../AwardsIntegration';

// Re-export service types for convenience
export type {
  UserAwardStats as ServiceUserAwardStats,
  RecentWinner,
  WinnerAnnouncement,
} from '@/services/awesome-awards.service';
