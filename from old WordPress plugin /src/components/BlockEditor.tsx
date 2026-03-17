import React, { useEffect, useRef } from 'react';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems } from '@blocknote/core';
import { HiOutlinePhoto } from 'react-icons/hi2';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

interface BlockEditorProps {
    initialContent?: any; // BlockNote JSON structure
    onChange?: (content: any) => void;
    editable?: boolean;
}

// Create schema with overrides to fix previewWidth error
// We must provide a default value for previewWidth to avoid RangeError in ProseMirror
// This works around a Tiptap v3.11.x regression where undefined defaults are rejected
const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        // Override image block to provide previewWidth default
        image: {
            ...defaultBlockSpecs.image,
            config: {
                ...defaultBlockSpecs.image.config,
                propSchema: {
                    ...defaultBlockSpecs.image.config.propSchema,
                    previewWidth: {
                        default: 512,
                        type: "number" as const,
                    },
                },
            },
        },
        // Override video block to provide previewWidth default and add autoplay/loop
        video: {
            ...defaultBlockSpecs.video,
            config: {
                ...defaultBlockSpecs.video.config,
                propSchema: {
                    ...defaultBlockSpecs.video.config.propSchema,
                    previewWidth: {
                        default: 512,
                        type: "number" as const,
                    },
                },
            },
        },
        // Fix numbered list start attribute (same issue as previewWidth)
        numberedListItem: {
            ...defaultBlockSpecs.numberedListItem,
            config: {
                ...defaultBlockSpecs.numberedListItem.config,
                propSchema: {
                    ...defaultBlockSpecs.numberedListItem.config.propSchema,
                    start: {
                        default: 1,
                        type: "number" as const,
                    },
                },
            },
        },
    },
});

// Helper to open WordPress Media Library
interface WPMediaResult {
    url: string;
    mime: string;   // e.g. "image/png", "application/pdf", "video/mp4"
    title: string;  // attachment title / filename
}

const openWordPressMedia = (): Promise<WPMediaResult> => {
    return new Promise((resolve, reject) => {
        const wp = (window as any).wp;
        
        if (!wp || !wp.media) {
            reject('WordPress Media Library is not available.');
            return;
        }

        // Create the media frame — no type filter so users can pick any file
        const frame = wp.media({
            title: 'Select from Media Library',
            button: {
                text: 'Insert'
            },
            multiple: false,
        });

        frame.on('select', () => {
            const attachment = frame.state().get('selection').first().toJSON();
            resolve({
                url: attachment.url,
                mime: attachment.mime || attachment.type || '',
                title: attachment.title || attachment.filename || '',
            });
        });

        frame.open();
    });
};

/**
 * Map a WordPress attachment to the appropriate BlockNote block type.
 * Images → image block, videos → video, audio → audio, everything else → file.
 */
const wpAttachmentToBlock = (media: WPMediaResult) => {
    const mime = media.mime.toLowerCase();

    if (mime.startsWith('image/')) {
        return { type: 'image' as const, props: { url: media.url, previewWidth: 512 } };
    }
    if (mime.startsWith('video/')) {
        return { type: 'video' as const, props: { url: media.url, previewWidth: 512 } };
    }
    if (mime.startsWith('audio/')) {
        return { type: 'audio' as const, props: { url: media.url } };
    }
    // PDFs, documents, spreadsheets, etc.
    return { type: 'file' as const, props: { url: media.url, name: media.title || 'file' } };
};

/**
 * BlockEditor component - A Gutenberg-style block editor using BlockNote
 * 
 * Features:
 * - Slash commands (/) for inserting blocks
 * - Drag-and-drop reordering
 * - Rich text formatting toolbar (bold, italic, underline, strikethrough, code, colors, highlights)
 * 
 * Block Types Available:
 * - Paragraph, Headings (H1-H3)
 * - Bulleted & Numbered Lists
 * - Checkboxes
 * - Blockquotes & Code Blocks
 * - Tables
 * - Images, Video, Audio, Files (uploads to WordPress Media Library)
 * 
 * Inline Content:
 * - Links
 * - Styled text (colors, highlights, etc.)
 * 
 * @param initialContent - BlockNote JSON structure to populate editor
 * @param onChange - Callback fired when content changes
 * @param editable - Whether editor is editable (default: true)
 */
export const BlockEditor: React.FC<BlockEditorProps> = ({
    initialContent,
    onChange,
    editable = true
}) => {
    /**
     * Sanitize content before passing to editor
     * This handles saved content with missing required props (previewWidth, start, etc)
     * which would otherwise cause RangeError in ProseMirror
     */
    const sanitizeContent = (raw: any): any => {
        if (!raw) return undefined;

        try {
            // Convert string to object if needed
            let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            
            if (!Array.isArray(parsed)) {
                console.warn('Expected array of blocks, got:', typeof parsed);
                return undefined;
            }

            // Flatten any nested arrays (from old list item imports)
            // This handles cases where ul/ol returned arrays that were pushed as nested arrays
            const flattenBlocks = (blocks: any[]): any[] => {
                const result: any[] = [];
                for (const block of blocks) {
                    if (Array.isArray(block)) {
                        // Recursively flatten nested arrays
                        result.push(...flattenBlocks(block));
                    } else if (block && typeof block === 'object') {
                        result.push(block);
                    }
                }
                return result;
            };
            parsed = flattenBlocks(parsed);

            // Empty array is valid (empty document)
            if (parsed.length === 0) {
                return undefined;
            }

            // Validate that this looks like BlockNote content, not quiz data
            // BlockNote blocks have 'type' and usually 'content' properties
            // Quiz data has 'question', 'answers', etc.
            const firstItem = parsed[0];
            // Quiz questions have 'question' and 'answers' properties
            if (firstItem.question !== undefined || firstItem.answers !== undefined) {
                console.warn('Content appears to be quiz data, not BlockNote blocks');
                return undefined;
            }
            // BlockNote blocks must have a 'type' property
            if (!firstItem.type || typeof firstItem.type !== 'string') {
                console.warn('Content does not appear to be valid BlockNote format, first block:', firstItem);
                return undefined;
            }

            // Process each block to add missing required props
            return parsed.map((block: any) => {
                const props = block.props ?? {};

                // Fix image/video/audio/file blocks missing previewWidth
                if (['image', 'video', 'audio', 'file'].includes(block.type)) {
                    if (props.previewWidth === undefined || props.previewWidth === null) {
                        props.previewWidth = 512;
                    }
                }

                // Fix numbered list items missing start
                if (block.type === 'numberedListItem' && (props.start === undefined || props.start === null)) {
                    props.start = 1;
                }

                return { ...block, props };
            });
        } catch (error) {
            console.error('Failed to sanitize content:', error);
            return undefined;
        }
    };

    // Create BlockNote editor instance with file upload support
    const editor = useCreateBlockNote({
        schema,
        initialContent: sanitizeContent(initialContent),
        uploadFile: async (file: File) => {
            // Upload file to WordPress media library via REST API
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await fetch(
                    `${(window as any).mentorshipPlatformData?.restUrl || '/wp-json/'}wp/v2/media`,
                    {
                        method: 'POST',
                        headers: {
                            'X-WP-Nonce': (window as any).mentorshipPlatformData?.nonce || ''
                        },
                        body: formData
                    }
                );
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    const msg = errorData?.message || `Upload failed (${response.status})`;
                    if (response.status === 401 || response.status === 403) {
                        throw new Error('You do not have permission to upload files. Please contact an administrator.');
                    }
                    throw new Error(msg);
                }
                
                const media = await response.json();
                return media.source_url; // Return the uploaded file URL
            } catch (error: any) {
                console.error('File upload failed:', error);
                // Surface a user-friendly message
                alert(error?.message || 'File upload failed. Please try again.');
                throw error;
            }
        }
    });

    // Reference to the editor container for video autoplay
    const containerRef = useRef<HTMLDivElement>(null);

    // Effect to make videos autoplay and loop (and GIFs work naturally)
    useEffect(() => {
        if (!containerRef.current) return;

        // Function to configure video elements for autoplay
        const configureVideos = () => {
            const videos = containerRef.current?.querySelectorAll('video');
            videos?.forEach((video) => {
                // Set autoplay attributes for embedded videos
                video.autoplay = true;
                video.loop = true;
                video.muted = true; // Required for autoplay on most browsers
                video.playsInline = true; // Required for iOS
                
                // Try to play (may fail if not muted on some browsers)
                video.play().catch(() => {
                    // Autoplay was prevented, user will need to click play
                });
            });
        };

        // Initial configuration
        configureVideos();

        // Set up a MutationObserver to handle dynamically added videos
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    configureVideos();
                    break;
                }
            }
        });

        observer.observe(containerRef.current, {
            childList: true,
            subtree: true
        });

        return () => observer.disconnect();
    }, [editor]);

    // Handle content changes - extract only the document blocks, not the editor instance
    const handleChange = () => {
        if (onChange && editor) {
            // Get the document content as plain blocks (no circular refs)
            const blocks = editor.document;
            onChange(blocks);
        }
    };

    // Custom Slash Menu Item — opens WP Media Library for any file type
    const insertWordPressMediaItem = (editor: any) => ({
        title: "WordPress Media",
        onItemClick: async () => {
            try {
                const media = await openWordPressMedia();
                if (media) {
                    const currentBlock = editor.getTextCursorPosition().block;
                    const newBlock = wpAttachmentToBlock(media);
                    editor.replaceBlocks([currentBlock], [newBlock]);
                }
            } catch (error) {
                console.warn(error);
                alert("Could not open Media Library. Use the standard upload instead.");
            }
        },
        aliases: ["media", "wp", "gallery", "library", "pdf", "file", "document"],
        group: "Media",
        icon: <HiOutlinePhoto />,
        subtext: "Images, PDFs, videos & more",
    });

    return (
        <div 
            ref={containerRef}
            className={`ap-block-editor-wrapper ap-bg-white ${
                editable 
                    ? 'ap-border ap-border-gray-300 ap-rounded-lg' 
                    : ''
            }`} 
            style={{ 
                minHeight: editable ? '400px' : 'auto', 
                overflow: 'visible', 
                position: 'relative' 
            }}
        >
            <BlockNoteView 
                editor={editor} 
                editable={editable}
                onChange={handleChange}
                theme="light"
                slashMenu={false}
            >
                <SuggestionMenuController
                    triggerCharacter={"/"}
                    getItems={async (query) =>
                        filterSuggestionItems(
                            [
                                ...getDefaultReactSlashMenuItems(editor),
                                insertWordPressMediaItem(editor),
                            ],
                            query
                        )
                    }
                />
            </BlockNoteView>
        </div>
    );
};

export default BlockEditor;
