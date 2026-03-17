import React, { useRef, useCallback } from 'react';
import { Attachment, Update } from '@/types';
import { Button } from '@/components/ui/Button';
import { uploadFile } from '@/services/api';
import { ACCEPTED_FILE_TYPES } from '@/utils/fileUpload';
import RichTextEditor from '@/components/RichTextEditor';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import {
    HiOutlinePaperClip as PaperClipIcon,
    HiOutlineDocument as DocumentIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlineSparkles as SparklesIcon,
} from 'react-icons/hi2';

// ─── Props ───────────────────────────────────────────────────────────────────

interface UpdateComposerProps {
    goalId: number;
    /** Post a new update (explicit submit, not auto-saved) */
    onPost: (newUpdate: Omit<Update, 'id' | 'author' | 'date'>) => Promise<void>;
    /** Whether an update is currently being posted */
    isPosting: boolean;
    /** Set posting state externally */
    onPostingChange: (posting: boolean) => void;
    /** Variant: 'panel' for right sidebar, 'mobile' for stacked mobile view */
    variant?: 'panel' | 'mobile';
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Sticky update composer with:
 * - RichTextEditor for content
 * - File attachment support
 * - Draft persistence via localStorage (survives page refresh / goal switch)
 * - Explicit "Post" button (not auto-saved per design decision)
 * - Restored draft indicator when a previous draft is loaded
 */
const UpdateComposer: React.FC<UpdateComposerProps> = ({
    goalId,
    onPost,
    isPosting,
    onPostingChange,
    variant = 'panel',
}) => {
    const { draft, setDraft, clearDraft, hadSavedDraft } = useDraftPersistence({
        storageKey: `goal_${goalId}_update_draft`,
        enabled: true,
    });

    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            try {
                const uploaded = await uploadFile(files[0]);
                setAttachments(prev => [...prev, uploaded]);
            } catch (error) {
                console.error('File upload failed', error);
                alert('File upload failed. Please try again.');
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        []
    );

    const handlePost = useCallback(async () => {
        if (!draft.trim()) return;
        onPostingChange(true);

        const newUpdate: Omit<Update, 'id' | 'author' | 'date'> = {
            text: draft,
            initiativeId: null,
            attachments: attachments,
        };

        await onPost(newUpdate);

        // Reset form
        clearDraft();
        setAttachments([]);
        onPostingChange(false);
    }, [draft, attachments, onPost, clearDraft, onPostingChange]);

    const isPanel = variant === 'panel';

    return (
        <div
            className={`${
                isPanel
                    ? 'ap-p-3 ap-border-b ap-border-gray-100 ap-flex-shrink-0'
                    : 'ap-p-3 ap-bg-gray-50 ap-rounded-lg ap-mb-4'
            }`}
        >
            {/* Restored draft indicator */}
            {hadSavedDraft && draft.trim() && (
                <div className="ap-flex ap-items-center ap-gap-1.5 ap-mb-2 ap-text-xs ap-text-amber-600 ap-bg-amber-50 ap-rounded ap-px-2 ap-py-1">
                    <SparklesIcon className="ap-h-3.5 ap-w-3.5" />
                    <span>Draft restored from your previous session</span>
                    <button
                        onClick={clearDraft}
                        className="ap-ml-auto ap-text-amber-500 hover:ap-text-amber-700 ap-transition-colors"
                        title="Discard draft"
                    >
                        <XMarkIcon className="ap-h-3.5 ap-w-3.5" />
                    </button>
                </div>
            )}

            <RichTextEditor
                value={draft}
                onChange={setDraft}
                placeholder="Post an update, ask a question, or share a win..."
            />

            {/* Attachments */}
            {attachments.length > 0 && (
                <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mt-2">
                    {attachments.map(att => (
                        <div
                            key={att.id}
                            className="ap-bg-gray-100 ap-rounded-full ap-px-2 ap-py-0.5 ap-text-xs ap-flex ap-items-center ap-gap-1"
                        >
                            <DocumentIcon className="ap-h-3 ap-w-3" />
                            <span className="ap-truncate ap-max-w-[120px]">{att.fileName}</span>
                            <button
                                onClick={() => setAttachments(p => p.filter(a => a.id !== att.id))}
                                className="ap-text-gray-400 hover:ap-text-red-500 ap-transition-colors"
                            >
                                <XMarkIcon className="ap-h-3 ap-w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions row */}
            <div className="ap-flex ap-justify-between ap-items-center ap-mt-2 ap-pt-2 ap-border-t ap-border-gray-100">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="ap-text-gray-400 hover:ap-text-gray-600 ap-transition-colors"
                    title="Attach file"
                >
                    <PaperClipIcon className="ap-h-4 ap-w-4" />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept={ACCEPTED_FILE_TYPES}
                    className="ap-hidden"
                />
                <Button
                    onClick={handlePost}
                    disabled={!draft.trim() || isPosting}
                    variant="primary"
                    size="xs"
                    loading={isPosting}
                >
                    {isPosting ? 'Posting...' : 'Post'}
                </Button>
            </div>
        </div>
    );
};

export default UpdateComposer;
