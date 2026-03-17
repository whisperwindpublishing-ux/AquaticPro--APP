/**
 * WinnerCelebration.tsx
 *
 * Modal component that displays a celebration when a winner is announced.
 * Features confetti animation, winner details, and celebratory styling.
 */

import { useEffect, useState, useCallback } from 'react';
import { WinnerAnnouncement, markAnnouncementSeen } from '@/services/awesome-awards.service';
import { Button } from './ui/Button';

interface WinnerCelebrationProps {
  /** The winner announcement to celebrate */
  announcement: WinnerAnnouncement;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Whether this is the current user's win (extra special!) */
  isCurrentUserWin?: boolean;
}

const CONFETTI_COLORS = [
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage
  '#FFEAA7', // Light Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
];

/**
 * CSS-based confetti animation (better performance across devices)
 */
function CSSConfetti() {
  return (
    <div className="ap-fixed ap-inset-0 ap-pointer-events-none ap-z-50 ap-overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="ap-absolute ap-animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        >
          <div
            className="ap-w-3 ap-h-3 ap-animate-confetti-spin"
            style={{
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes confetti-spin {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(180deg); }
        }
        .animate-confetti-fall {
          animation: confetti-fall 4s linear forwards;
        }
        .animate-confetti-spin {
          animation: confetti-spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export function WinnerCelebration({
  announcement,
  onClose,
  isCurrentUserWin = false,
}: WinnerCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  // Animate in on mount
  useEffect(() => {
    setIsVisible(true);

    // Stop confetti after a few seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(async () => {
    setIsVisible(false);
    
    // Mark as seen
    try {
      await markAnnouncementSeen(announcement.id);
    } catch (error) {
      console.error('Failed to mark announcement as seen:', error);
    }

    // Wait for animation before calling onClose
    setTimeout(onClose, 300);
  }, [announcement.id, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return (
    <>
      {/* Confetti */}
      {showConfetti && <CSSConfetti />}

      {/* Backdrop */}
      <div
        className={`ap-fixed ap-inset-0 ap-z-40 ap-bg-black/60 ap-backdrop-blur-sm ap-transition-opacity ap-duration-300 ${
          isVisible ? 'ap-opacity-100' : 'ap-opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-p-4 ap-transition-all ap-duration-300 ${
          isVisible ? 'ap-opacity-100 ap-scale-100' : 'ap-opacity-0 ap-scale-95'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
      >
        <div
          className="ap-relative ap-bg-gradient-to-br ap-from-amber-50 ap-to-yellow-50 dark:ap-from-gray-800 dark:ap-to-gray-900 ap-rounded-2xl ap-shadow-2xl ap-max-w-md ap-w-full ap-overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Golden top border */}
          <div className="ap-absolute ap-top-0 ap-left-0 ap-right-0 ap-h-1 ap-bg-gradient-to-r ap-from-amber-400 ap-via-yellow-300 ap-to-amber-400" />

          {/* Close button */}
          <Button
            variant="ghost"
            onClick={handleClose}
            className="!ap-absolute !ap-top-4 !ap-right-4 !ap-text-gray-400 hover:!ap-text-gray-600 dark:!ap-text-gray-500 dark:hover:!ap-text-gray-300 !ap-z-10 !ap-p-1 !ap-min-h-0"
            aria-label="Close celebration"
          >
            <svg className="ap-w-6 ap-h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>

          {/* Content */}
          <div className="ap-p-8 ap-text-center">
            {/* Trophy icon */}
            <div className="ap-mb-4 ap-flex ap-justify-center">
              <div className="ap-relative">
                <span className="ap-text-7xl ap-animate-bounce">🏆</span>
                {announcement.emoji && announcement.emoji !== '🏆' && (
                  <span className="ap-absolute -ap-bottom-2 -ap-right-2 ap-text-3xl">{announcement.emoji}</span>
                )}
              </div>
            </div>

            {/* Title */}
            <h2
              id="celebration-title"
              className="ap-text-2xl ap-font-bold ap-text-gray-900 dark:ap-text-white ap-mb-2"
            >
              {isCurrentUserWin ? '🎉 Congratulations! 🎉' : '🎉 Winner Announced! 🎉'}
            </h2>

            {/* Award Name */}
            <p className="ap-text-amber-600 dark:ap-text-amber-400 ap-font-medium ap-mb-4">
              {announcement.period_name}
            </p>

            {/* Winner avatar and name */}
            <div className="ap-flex ap-flex-col ap-items-center ap-mb-6">
              <div className="ap-relative ap-mb-3">
                <img
                  src={announcement.nominee_avatar}
                  alt={announcement.nominee_name}
                  className="ap-w-24 ap-h-24 ap-rounded-full ap-ring-4 ap-ring-amber-400 ap-ring-offset-4 dark:ap-ring-offset-gray-800 ap-shadow-lg"
                />
                <span className="ap-absolute -ap-bottom-2 -ap-right-2 ap-text-3xl">⭐</span>
              </div>
              <h3 className="ap-text-xl ap-font-bold ap-text-gray-900 dark:ap-text-white">
                {announcement.nominee_name}
              </h3>
              {isCurrentUserWin && (
                <p className="ap-text-amber-600 dark:ap-text-amber-400 ap-font-medium ap-mt-1">
                  That's you! Amazing work!
                </p>
              )}
            </div>

            {/* Reason (if available) */}
            {announcement.reason_text && (
              <div className="ap-bg-white/50 dark:ap-bg-gray-700/50 ap-rounded-xl ap-p-4 ap-mb-6 ap-text-left">
                <p className="ap-text-sm ap-text-gray-600 dark:ap-text-gray-300 ap-italic">
                  "{announcement.reason_text.substring(0, 200)}
                  {announcement.reason_text.length > 200 ? '...' : ''}"
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="ap-flex ap-justify-center ap-gap-6 ap-mb-6">
              <div className="ap-text-center">
                <div className="ap-flex ap-items-center ap-justify-center ap-gap-1 ap-text-amber-500">
                  <svg className="ap-w-5 ap-h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="ap-font-bold ap-text-lg">{announcement.vote_count}</span>
                </div>
                <p className="ap-text-xs ap-text-gray-500 dark:ap-text-gray-400">
                  Vote{announcement.vote_count !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="ap-text-center">
                <div className="ap-flex ap-items-center ap-justify-center ap-gap-1 ap-text-purple-500">
                  <span className="ap-text-lg">📅</span>
                </div>
                <p className="ap-text-xs ap-text-gray-500 dark:ap-text-gray-400 ap-capitalize">
                  {announcement.period_type}
                </p>
              </div>
            </div>

            {/* Action button */}
            <Button
              onClick={handleClose}
              variant="primary"
              size="lg"
              className="!ap-w-full !ap-bg-gradient-to-r !ap-from-amber-500 !ap-to-yellow-500 hover:!ap-from-amber-600 hover:!ap-to-yellow-600 !ap-rounded-xl !ap-shadow-lg hover:!ap-shadow-xl"
            >
              {isCurrentUserWin ? 'Accept Your Award! 🎊' : 'Awesome! 👏'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to manage winner celebrations
 * Fetches unseen announcements and shows them one by one
 */
export function useWinnerCelebrations() {
  const [announcements, setAnnouncements] = useState<WinnerAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentAnnouncement = announcements[currentIndex] || null;

  const handleClose = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const setAnnouncementsList = useCallback((list: WinnerAnnouncement[]) => {
    setAnnouncements(list);
    setCurrentIndex(0);
  }, []);

  return {
    currentAnnouncement,
    hasMore: currentIndex < announcements.length,
    handleClose,
    setAnnouncements: setAnnouncementsList,
    totalCount: announcements.length,
    viewedCount: currentIndex,
  };
}

export default WinnerCelebration;
