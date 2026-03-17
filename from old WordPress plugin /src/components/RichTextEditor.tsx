import React, { useRef, useCallback } from 'react';
import { Button } from './ui/Button';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { 
    HiOutlineBold as BoldIcon,
    HiOutlineItalic as ItalicIcon,
    HiOutlineListBullet as ListBulletIcon
} from 'react-icons/hi2';

interface RichTextEditorProps {
    value?: string | null;
    onChange: (html: string) => void;
    placeholder?: string;
    debounceMs?: number; // Optional debounce for onChange
    readOnly?: boolean;
}

const Toolbar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="ap-flex ap-items-center ap-p-2 ap-border-b ap-border-gray-200 ap-space-x-1 ap-bg-gray-50">
            <Button 
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                variant="ghost"
                size="xs"
                className={`!ap-p-2 !ap-rounded-md !ap-min-h-0 ap-transition-all ${editor.isActive('bold') ? '!ap-bg-purple-100 !ap-text-purple-700 !ap-border !ap-border-purple-300' : 'hover:!ap-bg-purple-50 !ap-text-gray-600 hover:!ap-text-purple-600'}`}
            >
                <BoldIcon className="ap-h-4 ap-w-4" />
            </Button>
            <Button 
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                variant="ghost"
                size="xs"
                className={`!ap-p-2 !ap-rounded-md !ap-min-h-0 ap-transition-all ${editor.isActive('italic') ? '!ap-bg-purple-100 !ap-text-purple-700 !ap-border !ap-border-purple-300' : 'hover:!ap-bg-purple-50 !ap-text-gray-600 hover:!ap-text-purple-600'}`}
            >
                <ItalicIcon className="ap-h-4 ap-w-4" />
            </Button>
            <Button 
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                disabled={!editor.can().chain().focus().toggleBulletList().run()}
                variant="ghost"
                size="xs"
                className={`!ap-p-2 !ap-rounded-md !ap-min-h-0 ap-transition-all ${editor.isActive('bulletList') ? '!ap-bg-purple-100 !ap-text-purple-700 !ap-border !ap-border-purple-300' : 'hover:!ap-bg-purple-50 !ap-text-gray-600 hover:!ap-text-purple-600'}`}
            >
                <ListBulletIcon className="ap-h-4 ap-w-4" />
            </Button>
        </div>
    );
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, debounceMs = 300, readOnly = false }) => {
    const debounceTimerRef = useRef<NodeJS.Timeout>();
    const isMountedRef = useRef(true);
    
    // Cleanup debounce timer on unmount
    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);
    
    // Debounced onChange handler
    const debouncedOnChange = useCallback((html: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        debounceTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
                onChange(html);
            }
        }, debounceMs);
    }, [onChange, debounceMs]);
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Disable heading as it's not in the original editor
                heading: false,
                // Keep other essentials
                bold: {},
                italic: {},
                bulletList: {},
                listItem: {},
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Write something…',
            }),
        ],
        content: value || '',
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            if (!readOnly) {
                debouncedOnChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: `ap-w-full ap-p-3 ap-min-h-[100px] ap-bg-transparent ap-border-none focus:ap-ring-0 focus:ap-outline-none ap-text-gray-800 prose ap-max-w-none prose-p:ap-my-0 ap-break-words ap-whitespace-pre-wrap ap-overflow-x-auto [&_a]:ap-inline-block [&_a]:ap-max-w-full [&_a]:ap-overflow-hidden [&_a]:ap-text-ellipsis [&_a]:ap-whitespace-nowrap ${readOnly ? 'ap-cursor-default ap-bg-gray-50' : ''}`,
            },
        },
    });

    // Update editor content when value prop changes (but not during typing)
    React.useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if the content is actually different and not during user typing
            const isEditorFocused = editor.isFocused;
            
            if (!isEditorFocused) {
                editor.commands.setContent(value || '');
            }
        }
    }, [value, editor]);

    return (
        <div className="ap-bg-white ap-border ap-border-gray-300 ap-rounded-lg ap-shadow-sm ap-w-full">
            {!readOnly && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
};

export default RichTextEditor;