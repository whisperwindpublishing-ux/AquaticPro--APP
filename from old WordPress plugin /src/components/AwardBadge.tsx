import React from 'react';
import { HiOutlineTrophy, HiTrophy } from 'react-icons/hi2';

/**
 * AwardBadge Component
 * 
 * Displays a user's award wins as a badge on their profile.
 * Shows total wins with breakdown of weekly/monthly awards on hover.
 */

export interface UserAwardStats {
  total_wins: number;
  weekly_wins: number;
  monthly_wins: number;
  nominations_received: number;
  nominations_given: number;
  votes_cast: number;
}

interface AwardBadgeProps {
  stats: UserAwardStats;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'px-2 py-1',
    icon: 'h-4 w-4',
    text: 'text-xs',
  },
  md: {
    container: 'px-3 py-1.5',
    icon: 'h-5 w-5',
    text: 'text-sm',
  },
  lg: {
    container: 'px-4 py-2',
    icon: 'h-6 w-6',
    text: 'text-base',
  },
};

const AwardBadge: React.FC<AwardBadgeProps> = ({
  stats,
  size = 'md',
  showTooltip = true,
  className = '',
}) => {
  const classes = sizeClasses[size];
  
  // Don't render if no wins
  if (stats.total_wins === 0) {
    return null;
  }

  // Determine badge tier based on total wins
  const getBadgeTier = (wins: number) => {
    if (wins >= 12) return { label: 'Legend', gradient: 'from-purple-500 to-pink-500', glow: 'shadow-purple-300' };
    if (wins >= 6) return { label: 'Champion', gradient: 'from-yellow-400 to-orange-500', glow: 'shadow-yellow-300' };
    if (wins >= 3) return { label: 'Star', gradient: 'from-blue-400 to-cyan-500', glow: 'shadow-blue-300' };
    return { label: 'Winner', gradient: 'from-green-400 to-emerald-500', glow: 'shadow-green-300' };
  };

  const tier = getBadgeTier(stats.total_wins);

  return (
    <div className={`ap-relative group ap-inline-flex ${className}`}>
      {/* Badge */}
      <div
        className={` ap-inline-flex ap-items-center ap-gap-1.5 ap-rounded-full ap-bg-gradient-to-r ${tier.gradient} ap-text-white ap-font-medium ap-shadow-lg ${tier.glow} ${classes.container} ap-transition-all ap-duration-200 hover:ap-scale-105 `}
      >
        <HiTrophy className={classes.icon} />
        <span className={classes.text}>
          {stats.total_wins} {stats.total_wins === 1 ? 'Win' : 'Wins'}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="ap-absolute ap-bottom-full ap-left-1/2 -ap-translate-x-1/2 ap-mb-2 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity ap-duration-200 ap-pointer-events-none ap-z-50">
          <div className="ap-bg-gray-900 ap-text-white ap-text-xs ap-rounded-lg ap-px-3 ap-py-2 ap-whitespace-nowrap ap-shadow-xl">
            <div className="ap-font-semibold ap-text-yellow-400 ap-mb-1">{tier.label}</div>
            <div className="ap-space-y-0.5">
              {stats.weekly_wins > 0 && (
                <div className="ap-flex ap-items-center ap-gap-2">
                  <span className="ap-text-gray-400">Weekly:</span>
                  <span>{stats.weekly_wins}</span>
                </div>
              )}
              {stats.monthly_wins > 0 && (
                <div className="ap-flex ap-items-center ap-gap-2">
                  <span className="ap-text-gray-400">Monthly:</span>
                  <span>{stats.monthly_wins}</span>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div className="ap-absolute ap-top-full ap-left-1/2 -ap-translate-x-1/2 -ap-mt-px">
              <div className="ap-border-4 ap-border-transparent ap-border-t-gray-900" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact inline badge for lists and cards
 */
export const AwardBadgeInline: React.FC<{ wins: number; className?: string }> = ({ 
  wins, 
  className = '' 
}) => {
  if (wins === 0) return null;
  
  return (
    <span 
      className={`ap-inline-flex ap-items-center ap-gap-1 ap-text-xs ap-text-yellow-600 ap-bg-yellow-50 ap-px-1.5 ap-py-0.5 ap-rounded ${className}`}
      title={`${wins} award${wins !== 1 ? 's' : ''} won`}
    >
      <HiOutlineTrophy className="ap-h-3 ap-w-3" />
      {wins}
    </span>
  );
};

export default AwardBadge;
