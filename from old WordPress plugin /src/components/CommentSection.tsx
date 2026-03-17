import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Comment, UserProfile, ReactionType } from '@/types';
import { getComments, addComment, updateComment, deleteComment, addCommentReaction, removeCommentReaction } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { HiOutlineChatBubbleOvalLeftEllipsis as ChatBubbleOvalLeftEllipsisIcon } from 'react-icons/hi2';
import { AiOutlineLoading3Quarters as SpinnerIcon } from 'react-icons/ai';
import {
    HiOutlinePencil as PencilIcon,
    HiOutlineTrash as TrashIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlineArrowUturnLeft as ReplyIcon,
    HiOutlineHandThumbUp,
    HiOutlineHandThumbDown,
    HiOutlineHeart,
    HiHandThumbUp,
    HiHandThumbDown,
    HiHeart
} from 'react-icons/hi2';

// Component to render HTML content with proper link truncation
const ProseContent: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Find all links in the rendered content
            const links = contentRef.current.querySelectorAll('a');
            links.forEach(link => {
                // Apply truncation styles directly to each link
                link.style.display = 'inline-block';
                link.style.maxWidth = '100%';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.whiteSpace = 'nowrap';
                link.style.verticalAlign = 'bottom';
            });
        }
    }, [html]);

    return (
        <div 
            ref={contentRef}
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

interface CommentSectionProps {
    postId: number;
    currentUser: UserProfile | null;
    isReadOnly: boolean;
    initialCount: number;
    onCountChange?: (count: number) => void;
    isOpen?: boolean; // Allow parent to control visibility
}

interface CommentItemProps {
    comment: Comment;
    currentUser: UserProfile | null;
    isReadOnly: boolean;
    onUpdate: (commentId: number, content: string) => Promise<void>;
    onDelete: (commentId: number) => Promise<void>;
    onReply: (parentId: number) => void;
    onReactionUpdate: (commentId: number, reactionCounts: any, userReaction: ReactionType | null) => void;
    isReplying: boolean;
    depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = memo(({ 
    comment, 
    currentUser, 
    isReadOnly, 
    onUpdate, 
    onDelete, 
    onReply,
    onReactionUpdate,
    isReplying,
    depth = 0 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isReacting, setIsReacting] = useState(false);

    const isOwner = currentUser && currentUser.id === comment.author.id;
    const maxDepth = 3;

    const handleReaction = useCallback(async (reactionType: ReactionType) => {
        if (isReacting || !currentUser) return;

        setIsReacting(true);
        try {
            let result;
            if (comment.userReaction === reactionType) {
                // Remove reaction if clicking the same one
                result = await removeCommentReaction(comment.id);
            } else {
                // Add or change reaction
                result = await addCommentReaction(comment.id, reactionType);
            }
            onReactionUpdate(comment.id, result.reactionCounts, result.userReaction);
        } catch (error) {
            console.error('Failed to update reaction:', error);
        } finally {
            setIsReacting(false);
        }
    }, [comment.id, comment.userReaction, currentUser, isReacting, onReactionUpdate]);

    const handleEdit = useCallback(() => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = comment.content;
        setEditedContent(tempDiv.textContent || tempDiv.innerText || '');
        setIsEditing(true);
    }, [comment.content]);

    const handleSave = useCallback(async () => {
        if (!editedContent.trim()) return;
        setIsSaving(true);
        try {
            await onUpdate(comment.id, editedContent);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update comment', err);
            alert('Failed to update comment');
        } finally {
            setIsSaving(false);
        }
    }, [editedContent, comment.id, onUpdate]);

    const handleDelete = useCallback(async () => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        setIsDeleting(true);
        try {
            await onDelete(comment.id);
        } catch (err) {
            console.error('Failed to delete comment', err);
            alert('Failed to delete comment');
            setIsDeleting(false);
        }
    }, [comment.id, onDelete]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditedContent('');
    }, []);

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedContent(e.target.value);
    }, []);

    return (
        <div className={`ap-flex ap-items-start ap-gap-3 ${depth > 0 ? 'ap-ml-8 ap-mt-3' : ''}`}>
            <img src={comment.author.avatarUrl} alt={comment.author.firstName} className="ap-h-8 ap-w-8 ap-rounded-full ap-flex-shrink-0" />
            <div className="ap-flex-grow ap-min-w-0">
                {isEditing ? (
                    <div className="ap-bg-gray-100 ap-rounded-lg ap-px-3 ap-py-2">
                        <p className="ap-mb-2">
                            <span className="ap-font-semibold ap-text-sm ap-text-gray-900">{comment.author.firstName} {comment.author.lastName}</span>
                        </p>
                        <textarea
                            value={editedContent}
                            onChange={handleTextChange}
                            className="ap-w-full ap-p-2 ap-text-sm ap-bg-white ap-border ap-border-gray-300 ap-rounded-md"
                            rows={3}
                            disabled={isSaving}
                        />
                        <div className="ap-flex ap-gap-2 ap-mt-2">
                            <Button 
                                onClick={handleSave}
                                disabled={isSaving || !editedContent.trim()}
                                variant="icon" className="ap-text-green-600 hover:ap-text-green-700"
                            >
                                {isSaving ? <SpinnerIcon className="ap-h-4 ap-w-4 ap-animate-spin" /> : <CheckIcon className="ap-h-4 ap-w-4" />}
                            </Button>
                            <Button 
                                onClick={handleCancel}
                                disabled={isSaving}
                                variant="icon" className="ap-text-gray-600 hover:ap-text-gray-700"
                            >
                                <XMarkIcon className="ap-h-4 ap-w-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="ap-bg-gray-100 ap-rounded-lg ap-px-3 ap-py-2">
                        <div className="ap-flex ap-justify-between ap-items-start ap-gap-2">
                            <p className="ap-flex-grow">
                                <span className="ap-font-semibold ap-text-sm ap-text-gray-900">{comment.author.firstName} {comment.author.lastName}</span>
                                <span className="ap-text-xs ap-text-gray-500 ap-ml-2">{new Date(comment.date).toLocaleString()}</span>
                            </p>
                            {!isReadOnly && isOwner && !isDeleting && (
                                <div className="ap-flex ap-gap-1 ap-flex-shrink-0">
                                    <Button onClick={handleEdit} variant="icon" className="ap-text-gray-500 hover:ap-text-blue-600">
                                        <PencilIcon className="ap-h-3.5 ap-w-3.5" />
                                    </Button>
                                    <Button onClick={handleDelete} variant="icon" className="ap-text-gray-500 hover:ap-text-red-600">
                                        <TrashIcon className="ap-h-3.5 ap-w-3.5" />
                                    </Button>
                                </div>
                            )}
                            {isDeleting && <SpinnerIcon className="ap-h-4 ap-w-4 ap-animate-spin ap-text-gray-500" />}
                        </div>
                        <ProseContent 
                            html={comment.content}
                            className="ap-text-sm ap-text-gray-800 ap-break-words ap-mt-1"
                        />
                        
                        {/* Reactions and Reply */}
                        <div className="ap-flex ap-items-center ap-gap-2 ap-mt-2">
                            {/* Reactions */}
                            {!isReadOnly && currentUser && (
                                <div className="ap-flex ap-items-center ap-gap-1">
                                    <Button
                                        onClick={() => handleReaction('thumbs_up')}
                                        disabled={isReacting}
                                        variant={comment.userReaction === 'thumbs_up' ? 'reaction-like' : 'reaction'}
                                        size="xs"
                                        className="!ap-min-h-0 !ap-gap-1"
                                    >
                                        {comment.userReaction === 'thumbs_up' ? (
                                            <HiHandThumbUp className="ap-h-3.5 ap-w-3.5" />
                                        ) : (
                                            <HiOutlineHandThumbUp className="ap-h-3.5 ap-w-3.5" />
                                        )}
                                        {comment.reactionCounts?.thumbs_up ? <span>{comment.reactionCounts.thumbs_up}</span> : null}
                                    </Button>
                                    <Button
                                        onClick={() => handleReaction('thumbs_down')}
                                        disabled={isReacting}
                                        variant={comment.userReaction === 'thumbs_down' ? 'reaction-dislike' : 'reaction'}
                                        size="xs"
                                        className="!ap-min-h-0 !ap-gap-1"
                                    >
                                        {comment.userReaction === 'thumbs_down' ? (
                                            <HiHandThumbDown className="ap-h-3.5 ap-w-3.5" />
                                        ) : (
                                            <HiOutlineHandThumbDown className="ap-h-3.5 ap-w-3.5" />
                                        )}
                                        {comment.reactionCounts?.thumbs_down ? <span>{comment.reactionCounts.thumbs_down}</span> : null}
                                    </Button>
                                    <Button
                                        onClick={() => handleReaction('heart')}
                                        disabled={isReacting}
                                        variant={comment.userReaction === 'heart' ? 'reaction-heart' : 'reaction'}
                                        size="xs"
                                        className="!ap-min-h-0 !ap-gap-1"
                                    >
                                        {comment.userReaction === 'heart' ? (
                                            <HiHeart className="ap-h-3.5 ap-w-3.5" />
                                        ) : (
                                            <HiOutlineHeart className="ap-h-3.5 ap-w-3.5" />
                                        )}
                                        {comment.reactionCounts?.heart ? <span>{comment.reactionCounts.heart}</span> : null}
                                    </Button>
                                </div>
                            )}
                            
                            {/* Reply Button */}
                            {!isReadOnly && currentUser && depth < maxDepth && !isReplying && (
                                <Button 
                                    onClick={() => onReply(comment.id)}
                                    variant="ghost"
                                    size="xs"
                                    className="!ap-text-xs !ap-text-gray-500 hover:!ap-text-blue-600 !ap-p-0 !ap-min-h-0"
                                >
                                    <ReplyIcon className="ap-h-3.5 ap-w-3.5 ap-mr-1" />
                                    Reply
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const CommentSection: React.FC<CommentSectionProps> = ({ postId, currentUser, isReadOnly, initialCount, onCountChange, isOpen: isOpenProp }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = isOpenProp !== undefined ? isOpenProp : internalIsOpen;
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentCount, setCommentCount] = useState<number>(initialCount);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyContent, setReplyContent] = useState('');

    const loadComments = async () => {
        if (!isOpen) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchedComments = await getComments(postId);
            setComments(fetchedComments);
            const newCount = fetchedComments.length;
            setCommentCount(newCount);
            if (onCountChange) {
                onCountChange(newCount);
            }
        } catch (err) {
            console.error("Failed to load comments", err);
            setError("Could not load comments.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setCommentCount(initialCount);
    }, [initialCount]);

    useEffect(() => {
        if (isOpen) {
            loadComments();
        }
    }, [isOpen, postId]);

    const handlePostComment = useCallback(async () => {
        if (!newComment.trim() || !currentUser) return;
        setIsPosting(true);
        try {
            const postedComment = await addComment(postId, newComment, currentUser);
            setComments(prev => [...prev, postedComment]);
            const newCount = commentCount + 1;
            setCommentCount(newCount);
            if (onCountChange) {
                onCountChange(newCount);
            }
            setNewComment('');
        } catch (err) {
            console.error("Failed to post comment", err);
            alert("Failed to post comment.");
        } finally {
            setIsPosting(false);
        }
    }, [newComment, currentUser, postId, commentCount, onCountChange]);

    const handlePostReply = useCallback(async (parentId: number) => {
        if (!replyContent.trim() || !currentUser) return;
        setIsPosting(true);
        try {
            const postedReply = await addComment(postId, replyContent, currentUser, parentId);
            setComments(prev => [...prev, postedReply]);
            const newCount = commentCount + 1;
            setCommentCount(newCount);
            if (onCountChange) {
                onCountChange(newCount);
            }
            setReplyContent('');
            setReplyingTo(null);
        } catch (err) {
            console.error("Failed to post reply", err);
            alert("Failed to post reply.");
        } finally {
            setIsPosting(false);
        }
    }, [replyContent, currentUser, postId, commentCount, onCountChange]);

    const handleUpdateComment = useCallback(async (commentId: number, content: string) => {
        const updatedComment = await updateComment(commentId, content);
        setComments(prev => prev.map(c => c.id === commentId ? updatedComment : c));
    }, []);

    const handleDeleteComment = useCallback(async (commentId: number) => {
        await deleteComment(commentId);
        setComments(prev => prev.filter(c => c.id !== commentId));
        const newCount = commentCount - 1;
        setCommentCount(newCount);
        if (onCountChange) {
            onCountChange(newCount);
        }
    }, [commentCount, onCountChange]);

    const handleReactionUpdate = useCallback((commentId: number, reactionCounts: any, userReaction: ReactionType | null) => {
        setComments(prev => prev.map(c => 
            c.id === commentId 
                ? { ...c, reactionCounts, userReaction }
                : c
        ));
    }, []);

    const organizeComments = (comments: Comment[]) => {
        const commentMap: { [key: number]: Comment & { replies?: Comment[] } } = {};
        const topLevel: (Comment & { replies?: Comment[] })[] = [];

        comments.forEach(comment => {
            commentMap[comment.id] = { ...comment, replies: [] };
        });

        comments.forEach(comment => {
            if (comment.parentId && commentMap[comment.parentId]) {
                commentMap[comment.parentId].replies!.push(commentMap[comment.id]);
            } else {
                topLevel.push(commentMap[comment.id]);
            }
        });

        return topLevel;
    };

    const organizedComments = organizeComments(comments);

    const renderComment = (comment: Comment & { replies?: Comment[] }, depth = 0): JSX.Element => {
        const isReplying = replyingTo === comment.id;
        
        return (
            <div key={comment.id}>
                <CommentItem
                    comment={comment}
                    currentUser={currentUser}
                    isReadOnly={isReadOnly}
                    onUpdate={handleUpdateComment}
                    onDelete={handleDeleteComment}
                    onReply={setReplyingTo}
                    onReactionUpdate={handleReactionUpdate}
                    isReplying={isReplying}
                    depth={depth}
                />
                {isReplying && (
                    <div className="ap-ml-11 ap-mt-2">
                        <div className="ap-flex ap-items-start ap-gap-2">
                            <img src={currentUser!.avatarUrl} alt={currentUser!.firstName} className="ap-h-6 ap-w-6 ap-rounded-full" />
                            <div className="ap-flex-grow">
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="ap-w-full ap-p-2 ap-text-sm ap-bg-white ap-border ap-border-gray-300 ap-rounded-md"
                                    rows={2}
                                    autoFocus
                                />
                                <div className="ap-flex ap-gap-2 ap-mt-2">
                                    <Button 
                                        variant="primary"
                                        size="xs"
                                        onClick={() => handlePostReply(comment.id)}
                                        disabled={isPosting || !replyContent.trim()}
                                    >
                                        {isPosting ? 'Posting...' : 'Reply'}
                                    </Button>
                                    <Button 
                                        variant="secondary"
                                        size="xs"
                                        onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {comment.replies && comment.replies.length > 0 && (
                    <div>
                        {comment.replies.map(reply => renderComment(reply, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="ap-mt-4">
            {/* Only show toggle button if parent isn't controlling visibility */}
            {isOpenProp === undefined && (
                <Button onClick={() => setInternalIsOpen(!internalIsOpen)} variant="ghost" className="!ap-p-0 !ap-min-h-0 !ap-text-sm !ap-text-gray-600 hover:!ap-text-gray-900">
                    <ChatBubbleOvalLeftEllipsisIcon className="ap-h-5 ap-w-5 ap-mr-2" />
                    <span>{commentCount > 0 ? `${commentCount} Comments` : 'Comment'}</span>
                </Button>
            )}

            {isOpen && (
                <div className="ap-mt-4 ap-space-y-4 ap-pl-5 ap-border-l-2 ap-border-gray-200">
                    {isLoading && <SpinnerIcon className="ap-animate-spin ap-h-5 ap-w-5 ap-text-gray-500" />}
                    {error && <p className="ap-text-sm ap-text-red-500">{error}</p>}
                    
                    {organizedComments.map(comment => renderComment(comment))}

                    {!isReadOnly && currentUser && (
                        <div className="ap-flex ap-items-start ap-gap-3 ap-pt-4 ap-border-t ap-border-gray-200">
                            <img src={currentUser.avatarUrl} alt={currentUser.firstName} className="ap-h-8 ap-w-8 ap-rounded-full" />
                            <div className="ap-flex-grow">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Write a comment..."
                                    className="ap-w-full ap-p-2 ap-text-sm ap-bg-white ap-border ap-border-gray-300 ap-rounded-md"
                                    rows={2}
                                />
                                <div className="ap-flex ap-justify-end ap-mt-2">
                                    <Button 
                                        variant="primary"
                                        size="xs"
                                        onClick={handlePostComment} 
                                        disabled={isPosting || !newComment.trim()}
                                    >
                                        {isPosting ? 'Posting...' : 'Post Comment'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommentSection;
