/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useContext, useMemo } from "react";const { apiFetch } = wp;

/**
 * Internal dependencies
 */
import { apiClient } from '../api';
import DataContext from '../context/DataContext';
import EvaluationForm from './EvaluationForm';
import LockConfirmModal from './LockConfirmModal';

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const EvaluationManager = ({
    evaluations,
    setEvaluations,
    evaluationCptSlug,
    newEvaluationDefaults,
    onDefaultsConsumed,
    loadMoreEvaluations,
    hasMoreEvaluations,
    isEvaluationsLoading,
    searchTerm,
    setSearchTerm,
}) => {
    const { levels } = useContext(DataContext);
    const [selectedEval, setSelectedEval] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [lockedByUser, setLockedByUser] = useState('');
    const [lockConfirmModalOpen, setLockConfirmModalOpen] = useState(false);
    const [pendingEvalSelection, setPendingEvalSelection] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    // When an evaluation is selected, populate the form
    useEffect(() => {
        if (selectedEval && selectedEval.id) {
            const evalData = evaluations.items.find(e => e.id === selectedEval.id);
            setSelectedEval(evalData ? { ...evalData, title: evalData.title.rendered, content: evalData.content.rendered } : null);
        }
    }, [evaluations.items, selectedEval?.id]);

    // Handle new evaluation requests from other components
    useEffect(() => {
        if (newEvaluationDefaults) {
            handleNewEvaluation(newEvaluationDefaults);
            onDefaultsConsumed();
        }
    }, [newEvaluationDefaults]);

    // Maintain lock with heartbeat (refresh every 120 seconds, WordPress locks expire after 150 seconds)
    useEffect(() => {
        if (!selectedEval || !selectedEval.id || isCreating) return;
        
        const lockInterval = setInterval(async () => {
            try {
                await apiClient.setLock(evaluationCptSlug, selectedEval.id);
            } catch (error) {
                console.error('Error refreshing lock:', error);
            }
        }, 120000); // Refresh every 2 minutes
        
        return () => clearInterval(lockInterval);
    }, [selectedEval, isCreating, evaluationCptSlug]);

    const handleSelectEvaluation = useCallback(async (evaluation) => {
        setIsLoadingDetails(true);
        
        console.log('[EvaluationManager] Attempting to select evaluation:', evaluation.id);
        
        // First check if the evaluation is locked by another user
        try {
            console.log('[EvaluationManager] Checking lock status for evaluation:', evaluation.id);
            const lockStatus = await apiClient.checkLock(evaluationCptSlug, evaluation.id);
            console.log('[EvaluationManager] Lock status response:', lockStatus);
            
            if (lockStatus.locked) {
                console.log('[EvaluationManager] Evaluation is locked by:', lockStatus.locked_by, 'ID:', lockStatus.locked_by_id);
                const takeover = window.confirm(
                    `${lockStatus.locked_by} is currently editing this evaluation.\n\n` +
                    `Click OK to take over editing (they will lose their changes), or Cancel to view as read-only.`
                );
                if (!confirm(`This evaluation is currently being edited by ${lockStatus.locked_by}. Do you want to take over?`)) {
                    console.log('[EvaluationManager] User declined to take over lock, opening in read-only mode');
                    setIsReadOnly(true);
                    setLockedByUser(lockStatus.locked_by);
                    setSelectedEval({ 
                        ...evaluation, 
                        title: evaluation.title.rendered, 
                        content: evaluation.content.rendered, 
                        meta: evaluation.meta || {},
                        _originalModified: evaluation.modified
                    });
                    setIsCreating(false);
                    setIsLoadingDetails(false);
                    return;
                }
                console.log('[EvaluationManager] User chose to take over lock');
            } else {
                console.log('[EvaluationManager] Evaluation is not locked, proceeding');
            }
            
            // Acquire the lock for this evaluation
            console.log('[EvaluationManager] Setting lock for evaluation:', evaluation.id);
            const lockResult = await apiClient.setLock(evaluationCptSlug, evaluation.id);
            console.log('[EvaluationManager] Lock set result:', lockResult);
            
        } catch (error) {
            console.error('[EvaluationManager] Error checking/setting lock:', error);
        }

        setSelectedEval({ 
            ...evaluation, 
            title: evaluation.title.rendered, 
            content: evaluation.content.rendered, 
            meta: evaluation.meta || {},
            _originalModified: evaluation.modified
        });
        setIsCreating(false);
        setIsLoadingDetails(false);
    }, [evaluationCptSlug]);

    const handleCloseEvaluation = useCallback(async () => {
        // Release the lock when closing the form (skip if read-only)
        if (selectedEval && selectedEval.id && !isReadOnly) {
            try {
                await apiClient.removeLock(evaluationCptSlug, selectedEval.id);
            } catch (error) {
                console.error('Error removing lock:', error);
            }
        }
        setSelectedEval(null);
        setIsReadOnly(false);
        setLockedByUser('');
        setIsCreating(false);
    }, [selectedEval, evaluationCptSlug, isReadOnly]);

    // Lock modal handlers
    const handleLockTakeover = useCallback(async () => {
        console.log('[EvaluationManager] User chose to take over lock');
        setLockConfirmModalOpen(false);
        
        if (pendingEvalSelection) {
            try {
                console.log('[EvaluationManager] Setting lock for evaluation:', pendingEvalSelection.id);
                const lockResult = await apiClient.setLock(evaluationCptSlug, pendingEvalSelection.id);
                console.log('[EvaluationManager] Lock set result:', lockResult);
            } catch (error) {
                console.error('[EvaluationManager] Error setting lock:', error);
            }
            
            setSelectedEval({ 
                ...pendingEvalSelection, 
                title: pendingEvalSelection.title.rendered, 
                content: pendingEvalSelection.content.rendered, 
                meta: pendingEvalSelection.meta || {},
                _originalModified: pendingEvalSelection.modified
            });
            setIsCreating(false);
            setIsLoadingDetails(false);
            setPendingEvalSelection(null);
        }
    }, [pendingEvalSelection, evaluationCptSlug]);

    const handleLockReadOnly = useCallback(() => {
        console.log('[EvaluationManager] User chose read-only mode');
        setLockConfirmModalOpen(false);
        
        if (pendingEvalSelection) {
            setSelectedEval({ 
                ...pendingEvalSelection, 
                title: pendingEvalSelection.title.rendered, 
                content: pendingEvalSelection.content.rendered, 
                meta: pendingEvalSelection.meta || {},
                _originalModified: pendingEvalSelection.modified
            });
            setIsCreating(false);
            setIsReadOnly(true);
            setIsLoadingDetails(false);
            setPendingEvalSelection(null);
        }
    }, [pendingEvalSelection]);

    const handleLockCancel = useCallback(() => {
        console.log('[EvaluationManager] User cancelled lock dialog');
        setLockConfirmModalOpen(false);
        setPendingEvalSelection(null);
        setLockedByUser('');
    }, []);

    const handleNewEvaluation = useCallback((defaults = {}) => {
        setIsCreating(true);
        setSelectedEval({
            title: '',
            content: '',
            meta: {
                swimmer: defaults.swimmer || null,
                level_evaluated: defaults.level_evaluated || null,
                emailed: false,
            },
        });
    }, []);

    const handleEvalChange = useCallback((key, value, isMeta = false) => {
        setSelectedEval(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

const handleSaveEvaluation = useCallback(async () => {
        if (!selectedEval || !selectedEval.title.trim()) {
            alert('Evaluation title cannot be empty.');
            return;
        }
        setIsSaving(true);
        try {
            // Use the ORIGINAL timestamp for conflict detection
            const evalToSave = {
                ...selectedEval,
                modified: selectedEval._originalModified || selectedEval.modified
            };
            const savedEval = await apiClient.saveEvaluation(evalToSave, evaluationCptSlug);

            setFeedbackMessage(`Evaluation ${isCreating ? 'created' : 'updated'} successfully!`);
            setIsSaving(false);

            setEvaluations(prev => {
                const newItems = [...prev.items];
                if (isCreating) {
                    newItems.unshift(savedEval);
                } else {
                    const index = newItems.findIndex(e => e.id === savedEval.id);
                    if (index !== -1) {
                        newItems[index] = savedEval;
                    } else {
                        newItems.unshift(savedEval); // Add if not found, just in case
                    }
                }
                return { ...prev, items: newItems };
            });

            if (isCreating) {
                setIsCreating(false);
                setSelectedEval(null);
            } else {
                // Update with fresh timestamp from server to prevent false conflicts
                setSelectedEval(prev => ({
                    ...savedEval,
                    title: savedEval.title.rendered,
                    content: savedEval.content.rendered,
                    _originalModified: savedEval.modified
                }));
            }

            setTimeout(() => setFeedbackMessage(''), 3000);

        } catch (error) {
            // Handle conflict detection
            if (error.code === 'conflict_detected') {
                const reload = window.confirm(
                    'This evaluation was modified by another user while you were editing.\n\n' +
                    'Click OK to reload the latest version (you will lose your changes), or Cancel to continue editing (you may overwrite their changes).'
                );
                if (reload) {
                    // Reload the evaluation from server
                    try {
                        const response = await apiClient.fetchEvaluationsPage({ postTypes: LMData.post_types }, 1, '');
                        const freshEval = response.data.find(e => e.id === selectedEval.id);
                        if (freshEval) {
                            handleSelectEvaluation(freshEval);
                            setFeedbackMessage('Evaluation reloaded. Please make your changes again.');
                        }
                    } catch (reloadError) {
                        setFeedbackMessage('Error reloading evaluation.');
                    }
                } else {
                    // Remove BOTH timestamps to force save on next attempt
                    const evalWithoutTimestamp = { ...selectedEval };
                    delete evalWithoutTimestamp.modified;
                    delete evalWithoutTimestamp._originalModified;
                    setSelectedEval(evalWithoutTimestamp);
                    setFeedbackMessage('Warning: Next save will overwrite any other changes. Click Save again to proceed.');
                }
            } else {
                const errorMessage = error.message || 'An unknown error occurred.';
                console.error('Error saving evaluation:', error);
                alert(`Error saving evaluation: ${errorMessage}.`);
            }
            setIsSaving(false);
        }
    }, [selectedEval, isCreating, evaluationCptSlug, setEvaluations, handleSelectEvaluation]);


    const handleDeleteEvaluation = useCallback(async (evaluationId) => {
        if (window.confirm('Are you sure you want to delete this evaluation?')) {
            setIsSaving(true);
            try {
                await apiClient.deleteEvaluation(evaluationId, evaluationCptSlug);
                setFeedbackMessage('Evaluation deleted successfully!');
                setIsSaving(false);
                setSelectedEval(null);
                // Remove the evaluation from the list in state
                setEvaluations(prev => ({
                    ...prev,
                    items: prev.items.filter(e => e.id !== evaluationId)
                }));
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                const errorMessage = error.message || 'An unknown error occurred.';
                console.error('Error deleting evaluation:', error);
                alert(`Error deleting evaluation: ${errorMessage}.`);
                setIsSaving(false);
            }
        }
    }, [evaluationCptSlug, setEvaluations]);

    const sortedEvaluations = useMemo(() => [...evaluations.items].sort((a, b) => (a.title.rendered || '').localeCompare(b.title.rendered || '')), [evaluations.items]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${
                (selectedEval || isCreating) ? 'hidden md:block' : 'block'
            } md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg flex flex-col h-min`}>
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Evaluations</h2>
                    <button onClick={() => handleNewEvaluation()} className="px-3 py-1 text-sm font-semibold text-white bg-violet-600 rounded-lg shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500">+ New</button>
                </div>
                <div className="mb-4">
                    <label htmlFor="evaluation-search" className="sr-only">Search Evaluations by Swimmer</label>
                    <input id="evaluation-search" type="text" placeholder="Search by swimmer..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <ul className="space-y-2 overflow-y-auto h-[600px] flex-grow">
                    {sortedEvaluations.map(evaluation => (
                        <li key={evaluation.id}>
                            <button onClick={() => handleSelectEvaluation(evaluation)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedEval && selectedEval.id === evaluation.id ? 'bg-violet-50 border-violet-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                <span className="font-semibold text-slate-800">{decodeEntities(evaluation.title.rendered)}</span>
                                <p className="text-sm text-slate-500 mt-1">Swimmer: {decodeEntities(evaluation.swimmer_name || 'N/A')}</p>
                            </button>
                        </li>
                    ))}
                </ul>
                {hasMoreEvaluations && (
                    <button onClick={loadMoreEvaluations} disabled={isEvaluationsLoading} className="w-full p-2 mt-2 text-center text-violet-600 font-semibold rounded-lg hover:bg-violet-50 disabled:opacity-50">
                        {isEvaluationsLoading ? 'Loading...' : 'Load More'}
                    </button>
                )}
            </div>
            <div className={`${(selectedEval || isCreating) ? 'col-span-1 md:col-span-2' : 'hidden md:block'}`}>
                {isLoadingDetails ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <svg className="animate-spin h-12 w-12 text-violet-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-slate-600 font-medium">Loading evaluation details...</p>
                        </div>
                    </div>
                ) : (selectedEval || isCreating) ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <button
                            onClick={handleCloseEvaluation}
                            className="md:hidden mb-4 flex items-center text-sm font-semibold text-violet-600 hover:text-violet-800"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back to list
                        </button>
                        {isReadOnly && (
                            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-3">
                                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-semibold text-yellow-800">Read-only Mode</p>
                                    <p className="text-sm text-yellow-700 mt-1">{lockedByUser} is currently editing this evaluation.</p>
                                </div>
                            </div>
                        )}
                        <div className="mb-6 border-b pb-3">
                            <h2 className="text-2xl font-bold text-slate-900">{isCreating ? 'Create New Evaluation' : `Editing: ${decodeEntities(selectedEval.title)}`}</h2>
                            {!isCreating && selectedEval.modified && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Last modified: {new Date(selectedEval.modified).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <EvaluationForm
                            key={isCreating ? 'new-evaluation' : selectedEval.id}
                            evaluation={selectedEval}
                            onEvalChange={handleEvalChange}
                            onSave={handleSaveEvaluation}
                            onCancel={handleCloseEvaluation}
                            onDelete={!isCreating ? () => handleDeleteEvaluation(selectedEval.id) : null}
                            isSaving={isSaving}
                            levels={levels}
                            isReadOnly={isReadOnly}
                        />
                    </div>
                ) : (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg text-center text-slate-500">
                        <p>Select an evaluation to edit, or create a new one.</p>
                    </div>
                )}
            </div>

            {/* Lock Confirmation Modal */}
            <LockConfirmModal
                isOpen={lockConfirmModalOpen}
                lockedByUser={lockedByUser}
                onTakeover={handleLockTakeover}
                onReadOnly={handleLockReadOnly}
                onCancel={handleLockCancel}
            />
        </div>
    );
};

export default EvaluationManager;