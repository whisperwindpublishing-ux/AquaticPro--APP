/**
 * WordPress dependencies
 */
import { useEffect, useRef, memo } from 'react';

const TinyMCEEditor = ({ value, onChange }) => {
    const textareaRef = useRef(null);
    const editorRef = useRef(null);
    const id = `tinymce-editor-${Math.random().toString(36).substring(2, 9)}`;

    useEffect(() => {
        if (!textareaRef.current) return;

        wp.editor.initialize(id, {
            tinymce: {
                height: 250,
                menubar: false,
                plugins: 'lists,paste,wordpress,wplink',
                toolbar1: 'bold,italic,bullist,numlist,link,unlink,undo,redo',
                setup: (editor) => {
                    editorRef.current = editor;
                    editor.on('change keyup', () => {
                        const content = editor.getContent();
                        onChange(content);
                    });
                },
            },
        });

        return () => {
            if (editorRef.current) {
                wp.editor.remove(id);
                editorRef.current = null;
            }
        };
    }, []);

    // Effect to update editor content when the value prop changes from outside
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.getContent()) {
            editorRef.current.setContent(value);
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%' }}
        />
    );
};

export default memo(TinyMCEEditor);