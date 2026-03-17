/**
 * WordPress dependencies
 */
import { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';

/**
 * Internal dependencies
 */
import { apiClient } from '../api';
import MultiSelectSearch from './MultiSelectSearch';

/**
 * WordPress dependencies
 */
const TinyMCEEditor = memo(({ value, onChange, disabled = false }) => {
    const textareaRef = useRef(null);
    const editorRef = useRef(null);
    const isDirtyRef = useRef(false);
    const isUpdatingRef = useRef(false);
    const [id] = useState(() => `tinymce-editor-${Math.random().toString(36).substring(2, 9)}`);

    useEffect(() => {
        if (textareaRef.current && wp.editor && wp.editor.initialize) {
            wp.editor.initialize(id, {
                tinymce: {
                    height: 250,
                    menubar: false,
                    plugins: 'lists,paste,wordpress,wplink',
                    toolbar1: 'bold,italic,bullist,numlist,link,unlink,undo,redo',
                    readonly: disabled,
                    setup: (editor) => {
                        editorRef.current = editor;
                        editor.on('change keyup', () => {
                            if (isUpdatingRef.current) return; // Prevent feedback loop
                            isDirtyRef.current = true;
                            const content = editor.getContent();
                            onChange(content);
                        });
                    },
                },
            });
        }

        return () => {
            if (editorRef.current && wp.editor && wp.editor.remove) {
                wp.editor.remove(id);
                editorRef.current = null;
            }
        };
    }, [id, onChange, disabled]);

    // Effect to update editor content when the value prop changes from outside
    useEffect(() => {
        if (isDirtyRef.current) {
            isDirtyRef.current = false;
            return;
        }
        if (editorRef.current && value !== editorRef.current.getContent()) {
            isUpdatingRef.current = true;
            editorRef.current.setContent(value || '');
            isUpdatingRef.current = false;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            id={id}
            defaultValue={value}
            style={{ width: '100%' }}
        />
    );
});

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const EvaluationForm = ({
    evaluation,
    onEvalChange,
    onSave,
    onCancel,
    isSaving,
    onDelete, // Added onDelete prop
    levels = [],
    showSwimmerField = true,
    isReadOnly = false,
}) => {
    if (!evaluation || !evaluation.meta) {
        return <div>Loading...</div>;
    }

    const [searchedSwimmers, setSearchedSwimmers] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedSwimmerDetails, setSelectedSwimmerDetails] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const handleSwimmerSearch = useCallback(async (searchTerm) => {
        if (!searchTerm) {
            setSearchedSwimmers([]);
            return;
        }
        setIsSearching(true);
        const { data } = await apiClient.fetchSwimmersPage({ postTypes: LMData.post_types }, 1, searchTerm);
        setSearchedSwimmers(data || []);
        setIsSearching(false);
    }, []);

    useEffect(() => {
        const swimmerId = evaluation.meta.swimmer;
        if (!swimmerId) {
            setSelectedSwimmerDetails([]);
            setIsLoading(false);
            return;
        }
        apiClient.fetchSwimmersByIds({ postTypes: LMData.post_types }, [swimmerId])
            .then(swimmers => {
                setSelectedSwimmerDetails(swimmers);
                setIsLoading(false);
            });
    }, [evaluation.meta.swimmer]);

    const selectedSwimmer = selectedSwimmerDetails.length > 0 ? selectedSwimmerDetails[0] : null;
    const masteredLevelsForSwimmer = useMemo(() => {
        if (!selectedSwimmer) return [];
        return levels.filter(level => (selectedSwimmer.meta.levels_mastered || []).includes(level.id));
    }, [selectedSwimmer, levels]);

    const handleEditorChange = useCallback((content) => {
        onEvalChange('content', content);
    }, [onEvalChange]);

    if (isLoading) {
        return <div>Loading evaluation details...</div>;
    }

    return (
        <>
            <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label htmlFor="eval-title" className="block text-sm font-medium text-slate-700">Title</label>
                    <input
                        type="text"
                        id="eval-title"
                        value={decodeEntities(evaluation.title)}
                        onChange={(e) => onEvalChange('title', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>

                {showSwimmerField && (
                    <div className="md:col-span-2">
                        <MultiSelectSearch
                            label="Swimmer"
                            options={searchedSwimmers}
                            selectedItems={selectedSwimmerDetails}
                            selectedValues={evaluation.meta.swimmer ? [String(evaluation.meta.swimmer)] : []}
                            onChange={(ids) => onEvalChange('swimmer', ids.length > 0 ? parseInt(ids[0], 10) : null, true)}
                            placeholder="Select a swimmer..."
                            itemLabelKey="title.rendered" // This was already correct, but good to confirm!
                            itemValueKey="id"
                            multiple={false}
                            onSearchChange={handleSwimmerSearch}
                            isLoading={isSearching}
                            disabled={isReadOnly}
                        />
                    </div>
                )}

                {selectedSwimmer && (
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mastered Levels</label>
                        <div className="flex flex-wrap gap-2">
                            {masteredLevelsForSwimmer.length > 0 ? (
                                masteredLevelsForSwimmer.map(level => (
                                    <span key={level.id} className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                        {decodeEntities(level.title.rendered)}
                                    </span>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500">No levels mastered yet.</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Level Evaluated</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {levels.map(level => (
                            <button key={level.id} type="button" onClick={() => onEvalChange('level_evaluated', level.id, true)} className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors duration-150 ${evaluation.meta.level_evaluated === level.id ? 'bg-green-600 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'}`}>
                                {decodeEntities(level.title.rendered)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <label htmlFor="eval-details" className="block text-sm font-medium text-slate-700">Details</label>
                    <TinyMCEEditor
                        id="eval-details"
                        value={evaluation.content || ''}
                        onChange={handleEditorChange}
                        disabled={isReadOnly}
                    />
                </div>

                <div className="md:col-span-2">
                    <label htmlFor="eval-emailed" className="flex items-center gap-2">
                        <input id="eval-emailed" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" checked={!!evaluation.meta.emailed} onChange={(e) => onEvalChange('emailed', e.target.checked, true)} />
                        Emailed to Parent
                    </label>
                </div>
            </fieldset>
            <div className="mt-8 flex justify-end items-center gap-4">
                {/* Delete button appears on the left for existing evaluations */}
                {onDelete && !isReadOnly && (
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={isSaving}
                        className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                        Delete Evaluation
                    </button>
                )}

                {/* Cancel and Save buttons appear on the right */}
                <div className="flex items-center gap-4 ml-auto">
                    <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-600 hover:text-slate-800">Close</button>
                    {!isReadOnly && (
                        <button onClick={onSave} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                    )}
                </div>
            </div>
        </>
    );
};

export default EvaluationForm;