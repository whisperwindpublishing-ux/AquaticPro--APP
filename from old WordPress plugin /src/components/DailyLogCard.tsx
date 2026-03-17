import React, { useState } from 'react';
import { DailyLog, ReactionType, UserProfile } from '@/types';
import { addDailyLogReaction, removeDailyLogReaction, getDailyLogReactionDetails, UserReactionStats } from '@/services/api';
import CommentSection from './CommentSection';
import { Button } from './ui';
import {
    HiOutlineHandThumbUp,
    HiOutlineHandThumbDown,
    HiOutlineHeart,
    HiOutlineChatBubbleLeftRight,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiHandThumbUp,
    HiHandThumbDown,
    HiHeart
} from 'react-icons/hi2';

interface DailyLogCardProps {
    log: DailyLog;
    currentUser: UserProfile;
    onUpdate: (updatedLog: DailyLog) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    canEdit?: boolean; // User has canEdit permission
    canDelete?: boolean; // User has canDelete permission
    canModerateAll?: boolean; // User can edit/delete any log
    expandCommentsByDefault?: boolean; // If true, comments shown by default
    expandContentByDefault?: boolean; // If true, content fully expanded by default
    authorReactionStats?: UserReactionStats; // Lifetime reaction stats for the author
}

/**
 * DailyLogCard component - Displays a single daily log entry
 * 
 * Features:
 * - Role badge with color coding
 * - Time slot badges (supports multiple slots with custom labels)
 * - Expandable content
 * - Reactions (thumbs up/down, heart)
 * - Comment count
 * - Inline comment section
 */
export const DailyLogCard: React.FC<DailyLogCardProps> = ({
    log,
    currentUser,
    onUpdate,
    onEdit,
    onDelete,
    canEdit = false,
    canDelete = false,
    canModerateAll = false,
    expandCommentsByDefault = false,
    expandContentByDefault = false,
    authorReactionStats
}) => {
    const [isExpanded, setIsExpanded] = useState(expandContentByDefault);
    const [showComments, setShowComments] = useState(expandCommentsByDefault);
    const [isReacting, setIsReacting] = useState(false);
    const [reactionDetails, setReactionDetails] = useState<{
        thumbs_up: Array<{ user: UserProfile; createdAt: string }>;
        thumbs_down: Array<{ user: UserProfile; createdAt: string }>;
        heart: Array<{ user: UserProfile; createdAt: string }>;
    } | null>(null);
    // For mobile: track which reaction's details modal is open
    const [showReactionModal, setShowReactionModal] = useState<ReactionType | null>(null);
    const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);

    const loadReactionDetails = async () => {
        if (!reactionDetails) {
            try {
                const details = await getDailyLogReactionDetails(log.id);
                setReactionDetails(details);
            } catch (error) {
                console.error('Failed to load reaction details:', error);
            }
        }
    };

    const handleReaction = async (reactionType: ReactionType) => {
        if (isReacting) return;

        setIsReacting(true);
        try {
            let updatedLog;
            if (log.userReaction === reactionType) {
                // Remove reaction if clicking the same one
                updatedLog = await removeDailyLogReaction(log.id);
            } else {
                // Add or change reaction
                updatedLog = await addDailyLogReaction(log.id, reactionType);
            }
            onUpdate(updatedLog);
        } catch (error) {
            console.error('Failed to update reaction:', error);
        } finally {
            setIsReacting(false);
        }
    };

    // Check if current user owns this log using authorId (reliable even if author object is null)
    const isOwner = log.authorId === currentUser.id;

    // Determine if user can edit/delete this log
    // User can edit if: they own it AND have canEdit permission, OR they have canModerateAll
    const canEditThisLog = (isOwner && canEdit) || canModerateAll;
    const canDeleteThisLog = (isOwner && canDelete) || canModerateAll;

    // Truncate content for preview (show first 200 characters)
    const contentPreview = log.content.length > 200 && !isExpanded
        ? log.content.substring(0, 200) + '...'
        : log.content;

    return (
        <div className={`ap-bg-white md:ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-3 md:ap-p-6 hover:ap-shadow-md ap-transition-all ap-duration-200 ap-border-l-4 ${
            log.status === 'draft' 
                ? 'ap-border-l-error-500 ap-ring-4 ap-ring-error-500/10' : 'ap-border-l-brand-500/30 hover:ap-border-l-brand-500'
        }`}>
            {/* Draft Warning Banner */}
            {log.status === 'draft' && (
                <div className="ap-mb-4 ap-p-3 ap-bg-error-50 ap-border-2 ap-border-error-500 ap-rounded-lg">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <svg className="ap-h-5 ap-w-5 ap-text-error-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="ap-text-sm ap-font-bold ap-text-error-900">DRAFT - NOT PUBLISHED</p>
                            <p className="ap-text-xs ap-text-error-700">
                                {isOwner 
                                    ? 'This log is only visible to you. Others cannot see it until you publish it.'
                                    : 'This draft belongs to another user and is not yet published.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Header - Responsive: stack on mobile */}
            <div className="ap-flex ap-flex-col ap-gap-3 ap-mb-4 ap-pb-3 ap-border-b-2 ap-border-gradient-to-r ap-from-blue-600/20 ap-via-blue-500/20 ap-to-transparent">
                {/* Title row with avatar */}
                <div className="ap-flex ap-items-start ap-gap-3">
                    {log.author && (
                        <div className="ap-flex-shrink-0">
                            <img
                                src={log.author.avatarUrl}
                                alt={`${log.author.firstName} ${log.author.lastName}`}
                                className="ap-w-10 ap-h-10 ap-rounded-full"
                            />
                            {/* Author lifetime reaction stats */}
                            {authorReactionStats && authorReactionStats.total > 0 && (
                                <div className="ap-flex ap-items-center ap-justify-center ap-gap-1 ap-mt-1" title="Lifetime reactions received">
                                    {authorReactionStats.thumbs_up > 0 && (
                                        <span className="ap-flex ap-items-center ap-text-blue-600" title={`${authorReactionStats.thumbs_up} thumbs up`}>
                                            <HiOutlineHandThumbUp className="ap-h-3 ap-w-3" />
                                            <span className="ap-text-[10px] ap-font-medium ap-ml-0.5">{authorReactionStats.thumbs_up}</span>
                                        </span>
                                    )}
                                    {authorReactionStats.thumbs_down > 0 && (
                                        <span className="ap-flex ap-items-center ap-text-red-500" title={`${authorReactionStats.thumbs_down} thumbs down`}>
                                            <HiOutlineHandThumbDown className="ap-h-3 ap-w-3" />
                                            <span className="ap-text-[10px] ap-font-medium ap-ml-0.5">{authorReactionStats.thumbs_down}</span>
                                        </span>
                                    )}
                                    {authorReactionStats.heart > 0 && (
                                        <span className="ap-flex ap-items-center ap-text-pink-500" title={`${authorReactionStats.heart} hearts`}>
                                            <HiOutlineHeart className="ap-h-3 ap-w-3" />
                                            <span className="ap-text-[10px] ap-font-medium ap-ml-0.5">{authorReactionStats.heart}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="ap-flex-1 ap-min-w-0">
                        <h3 className="ap-font-semibold ap-text-gray-900 ap-break-words">
                            {log.title}
                        </h3>
                        <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap ap-mt-1">
                            {log.author && (
                                <span className="ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-bg-brand-50 ap-text-brand-700 ap-border ap-border-brand-200 ap-rounded">
                                    {log.author.firstName} {log.author.lastName}
                                </span>
                            )}
                            <span className="ap-text-sm ap-text-gray-600">
                                {new Date(log.logDate + 'T00:00:00').toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action buttons - own row on mobile */}
                {(canEditThisLog || canDeleteThisLog) && (onEdit || onDelete) && (
                    <div className="ap-flex ap-gap-2 ap-flex-wrap">
                        {onEdit && canEditThisLog && (
                            <Button
                                onClick={onEdit}
                                variant="primary"
                            >
                                Edit
                            </Button>
                        )}
                        {onDelete && canDeleteThisLog && (
                            <Button
                                onClick={onDelete}
                                variant="danger"
                            >
                                Delete
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Badges */}
            <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-4">
                {/* Time Slot Badges */}
                {log.timeSlots && log.timeSlots.length > 0 && log.timeSlots.map(slot => (
                    <span
                        key={slot.id}
                        className="ap-inline-flex ap-items-center ap-px-3 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium"
                        style={{
                            backgroundColor: slot.color ? `${slot.color}15` : '#DBEAFE',
                            color: slot.color || '#1E40AF'
                        }}
                    >
                        {slot.label}
                    </span>
                ))}

                {/* Job Role Badge */}
                {log.jobRole && (
                    <span
                        className="ap-inline-flex ap-items-center ap-px-3 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium"
                        style={{
                            backgroundColor: log.jobRole.color ? `${log.jobRole.color}20` : '#F3F4F6',
                            color: log.jobRole.color || '#374151'
                        }}
                    >
                        {log.jobRole.name}
                    </span>
                )}

                {/* Tags */}
                {log.tags && log.tags.map(tag => (
                    <span
                        key={tag}
                        className="ap-inline-flex ap-items-center ap-px-3 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-700"
                    >
                        #{tag}
                    </span>
                ))}
            </div>

            {/* Content */}
            <div
                className="ap-prose ap-prose-sm ap-max-w-none ap-mb-4 ap-text-gray-700"
                dangerouslySetInnerHTML={{ __html: contentPreview }}
            />

            {/* Expand/Collapse button */}
            {log.content.length > 200 && (
                <Button
                    onClick={() => setIsExpanded(!isExpanded)}
                    variant="link"
                    className="!ap-p-0 !ap-mb-4"
                >
                    {isExpanded ? (
                        <>
                            <HiOutlineChevronUp className="ap-h-4 ap-w-4 ap-mr-1" />
                            Show less
                        </>
                    ) : (
                        <>
                            <HiOutlineChevronDown className="ap-h-4 ap-w-4 ap-mr-1" />
                            Read more
                        </>
                    )}
                </Button>
            )}

            {/* Reactions and Comments Bar */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row ap-items-stretch sm:ap-items-center ap-justify-between ap-gap-3 ap-pt-4 ap-border-t ap-border-gray-200">
                {/* Reactions */}
                <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                    {/* Thumbs Up */}
                    <div className="ap-relative group">
                        <Button
                            onClick={() => handleReaction('thumbs_up')}
                            onMouseEnter={() => {
                                setHoveredReaction('thumbs_up');
                                loadReactionDetails();
                            }}
                            onMouseLeave={() => setHoveredReaction(null)}
                            disabled={isReacting}
                            variant={log.userReaction === 'thumbs_up' ? 'reaction-like-bordered' : 'reaction-bordered'}
                            className="!ap-gap-1.5"
                        >
                            {log.userReaction === 'thumbs_up' ? (
                                <HiHandThumbUp className="ap-h-5 ap-w-5" />
                            ) : (
                                <HiOutlineHandThumbUp className="ap-h-5 ap-w-5" />
                            )}
                            <span className="ap-text-sm ap-font-medium">{log.reactionCounts?.thumbs_up || 0}</span>
                        </Button>
                        {/* Info button for mobile - tap to see who reacted */}
                        {(log.reactionCounts?.thumbs_up || 0) > 0 && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    loadReactionDetails();
                                    setShowReactionModal(showReactionModal === 'thumbs_up' ? null : 'thumbs_up');
                                }}
                                variant="ghost"
                                size="xs"
                                className="!ap-absolute !-ap-top-1 !-ap-right-1 !ap-w-5 !ap-h-5 !ap-min-h-0 !ap-p-0 !ap-bg-gray-600 !ap-text-white !ap-rounded-full !ap-text-xs sm:!ap-hidden"
                            >
                                i
                            </Button>
                        )}
                        {/* Desktop hover tooltip */}
                        {hoveredReaction === 'thumbs_up' && reactionDetails && reactionDetails.thumbs_up.length > 0 && (
                            <div className="ap-hidden sm:ap-block ap-absolute ap-bottom-full ap-left-0 ap-mb-2 ap-z-50 ap-bg-gray-900 ap-text-white ap-text-sm ap-rounded-lg ap-py-2 ap-px-3 ap-shadow-lg ap-min-w-[150px] ap-max-w-[250px]">
                                <div className="ap-font-semibold ap-mb-1">Thumbs Up</div>
                                {reactionDetails.thumbs_up.map((r, idx) => (
                                    <div key={idx} className="ap-text-xs ap-py-0.5">
                                        {r.user.firstName} {r.user.lastName}
                                    </div>
                                ))}
                                <div className="ap-absolute ap-top-full ap-left-4 ap-w-0 ap-h-0 ap-border-l-4 ap-border-r-4 ap-border-t-4 ap-border-transparent ap-border-t-gray-900"></div>
                            </div>
                        )}
                    </div>

                    {/* Thumbs Down */}
                    <div className="ap-relative group">
                        <Button
                            onClick={() => handleReaction('thumbs_down')}
                            onMouseEnter={() => {
                                setHoveredReaction('thumbs_down');
                                loadReactionDetails();
                            }}
                            onMouseLeave={() => setHoveredReaction(null)}
                            disabled={isReacting}
                            variant={log.userReaction === 'thumbs_down' ? 'reaction-dislike-bordered' : 'reaction-bordered'}
                            className="!ap-gap-1.5"
                        >
                            {log.userReaction === 'thumbs_down' ? (
                                <HiHandThumbDown className="ap-h-5 ap-w-5" />
                            ) : (
                                <HiOutlineHandThumbDown className="ap-h-5 ap-w-5" />
                            )}
                            <span className="ap-text-sm ap-font-medium">{log.reactionCounts?.thumbs_down || 0}</span>
                        </Button>
                        {/* Info button for mobile */}
                        {(log.reactionCounts?.thumbs_down || 0) > 0 && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    loadReactionDetails();
                                    setShowReactionModal(showReactionModal === 'thumbs_down' ? null : 'thumbs_down');
                                }}
                                variant="ghost"
                                size="xs"
                                className="!ap-absolute !-ap-top-1 !-ap-right-1 !ap-w-5 !ap-h-5 !ap-min-h-0 !ap-p-0 !ap-bg-gray-600 !ap-text-white !ap-rounded-full !ap-text-xs sm:!ap-hidden"
                            >
                                i
                            </Button>
                        )}
                        {/* Desktop hover tooltip */}
                        {hoveredReaction === 'thumbs_down' && reactionDetails && reactionDetails.thumbs_down.length > 0 && (
                            <div className="ap-hidden sm:ap-block ap-absolute ap-bottom-full ap-left-0 ap-mb-2 ap-z-50 ap-bg-gray-900 ap-text-white ap-text-sm ap-rounded-lg ap-py-2 ap-px-3 ap-shadow-lg ap-min-w-[150px] ap-max-w-[250px]">
                                <div className="ap-font-semibold ap-mb-1">Thumbs Down</div>
                                {reactionDetails.thumbs_down.map((r, idx) => (
                                    <div key={idx} className="ap-text-xs ap-py-0.5">
                                        {r.user.firstName} {r.user.lastName}
                                    </div>
                                ))}
                                <div className="ap-absolute ap-top-full ap-left-4 ap-w-0 ap-h-0 ap-border-l-4 ap-border-r-4 ap-border-t-4 ap-border-transparent ap-border-t-gray-900"></div>
                            </div>
                        )}
                    </div>

                    {/* Heart */}
                    <div className="ap-relative group">
                        <Button
                            onClick={() => handleReaction('heart')}
                            onMouseEnter={() => {
                                setHoveredReaction('heart');
                                loadReactionDetails();
                            }}
                            onMouseLeave={() => setHoveredReaction(null)}
                            disabled={isReacting}
                            variant={log.userReaction === 'heart' ? 'reaction-heart-bordered' : 'reaction-bordered'}
                            className="!ap-gap-1.5"
                        >
                            {log.userReaction === 'heart' ? (
                                <HiHeart className="ap-h-5 ap-w-5" />
                            ) : (
                                <HiOutlineHeart className="ap-h-5 ap-w-5" />
                            )}
                            <span className="ap-text-sm ap-font-medium">{log.reactionCounts?.heart || 0}</span>
                        </Button>
                        {/* Info button for mobile */}
                        {(log.reactionCounts?.heart || 0) > 0 && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    loadReactionDetails();
                                    setShowReactionModal(showReactionModal === 'heart' ? null : 'heart');
                                }}
                                variant="ghost"
                                size="xs"
                                className="!ap-absolute !-ap-top-1 !-ap-right-1 !ap-w-5 !ap-h-5 !ap-min-h-0 !ap-p-0 !ap-bg-gray-600 !ap-text-white !ap-rounded-full !ap-text-xs sm:!ap-hidden"
                            >
                                i
                            </Button>
                        )}
                        {/* Desktop hover tooltip */}
                        {hoveredReaction === 'heart' && reactionDetails && reactionDetails.heart.length > 0 && (
                            <div className="ap-hidden sm:ap-block ap-absolute ap-bottom-full ap-left-0 ap-mb-2 ap-z-50 ap-bg-gray-900 ap-text-white ap-text-sm ap-rounded-lg ap-py-2 ap-px-3 ap-shadow-lg ap-min-w-[150px] ap-max-w-[250px]">
                                <div className="ap-font-semibold ap-mb-1">Heart</div>
                                {reactionDetails.heart.map((r, idx) => (
                                    <div key={idx} className="ap-text-xs ap-py-0.5">
                                        {r.user.firstName} {r.user.lastName}
                                    </div>
                                ))}
                                <div className="ap-absolute ap-top-full ap-left-4 ap-w-0 ap-h-0 ap-border-l-4 ap-border-r-4 ap-border-t-4 ap-border-transparent ap-border-t-gray-900"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Comments Button */}
                <Button
                    onClick={() => setShowComments(!showComments)}
                    variant="outline"
                >
                    <HiOutlineChatBubbleLeftRight className="ap-h-5 ap-w-5" />
                    <span className="ap-text-sm ap-font-medium">
                        {log.commentCount || 0} {log.commentCount === 1 ? 'Comment' : 'Comments'}
                    </span>
                </Button>
            </div>

            {/* Mobile Reaction Details Modal */}
            {showReactionModal && reactionDetails && (
                <div className="sm:ap-hidden ap-mt-3 ap-p-3 ap-bg-gray-100 ap-rounded-lg">
                    <div className="ap-flex ap-items-center ap-justify-between ap-mb-2">
                        <span className="ap-font-semibold ap-text-gray-800">
                            {showReactionModal === 'thumbs_up' && '👍 Thumbs Up'}
                            {showReactionModal === 'thumbs_down' && '👎 Thumbs Down'}
                            {showReactionModal === 'heart' && '❤️ Heart'}
                        </span>
                        <Button 
                            onClick={() => setShowReactionModal(null)}
                            variant="ghost"
                            size="xs"
                            className="!ap-p-1 !ap-min-h-0"
                        >
                            ✕
                        </Button>
                    </div>
                    <div className="ap-space-y-1">
                        {reactionDetails[showReactionModal].map((r, idx) => (
                            <div key={idx} className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-700">
                                <img 
                                    src={r.user.avatarUrl} 
                                    alt={r.user.firstName}
                                    className="ap-w-6 ap-h-6 ap-rounded-full"
                                />
                                <span>{r.user.firstName} {r.user.lastName}</span>
                            </div>
                        ))}
                        {reactionDetails[showReactionModal].length === 0 && (
                            <p className="ap-text-sm ap-text-gray-500">No reactions yet</p>
                        )}
                    </div>
                </div>
            )}

            {/* Comments Section */}
            {showComments && (
                <div className="ap-mt-4 ap-pt-4 ap-border-t ap-border-gray-200">
                    <CommentSection
                        postId={log.id}
                        currentUser={currentUser}
                        isReadOnly={false}
                        initialCount={log.commentCount || 0}
                        isOpen={true}
                        onCountChange={(newCount) => {
                            onUpdate({ ...log, commentCount: newCount });
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default DailyLogCard;
