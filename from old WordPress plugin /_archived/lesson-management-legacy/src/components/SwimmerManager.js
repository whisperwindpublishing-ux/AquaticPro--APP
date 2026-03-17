/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useMemo, useContext } from 'react';

/**
 * Internal dependencies
 */
import { apiClient } from '../api';
import SwimmerForm from './SwimmerForm';
import EvaluationForm from './EvaluationForm';
import Modal from './Modal';
import DataContext from '../context/DataContext';

const SwimmerManager = ({
    swimmers,
    setSwimmers,
    swimmerCptSlug,
    onRequestNewEvaluation,
    loadMoreSwimmers,
    hasMoreSwimmers,
    isSwimmersLoading,
    searchTerm,
    setSearchTerm,
}) => {
    console.log('Swimmers prop received by manager:', swimmers);
    const { levels, skills, allSwimmers } = useContext(DataContext);
    const [selectedSwimmer, setSelectedSwimmer] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [lockedByUser, setLockedByUser] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [evaluations, setEvaluations] = useState([]);
    const [isLoadingEvals, setIsLoadingEvals] = useState(false);
    const [editingEvaluation, setEditingEvaluation] = useState(null);
    const [isSavingEval, setIsSavingEval] = useState(false);

    // Fetch evaluations when a swimmer is selected
    useEffect(() => {
        if (selectedSwimmer && selectedSwimmer.id) {
            setEvaluations([]);
            setIsLoadingEvals(true);
            apiClient.fetchEvaluationsForSwimmer(selectedSwimmer.id, swimmerCptSlug.replace('swimmer', 'evaluation'))
                .then(setEvaluations)
                .catch(error => console.error("Error fetching evaluations for swimmer:", error))
                .finally(() => setIsLoadingEvals(false));
        } else {
            setEvaluations([]); // Clear evaluations if no swimmer is selected
        }
    }, [selectedSwimmer, swimmerCptSlug]);

    // When the selected swimmer changes, update the form data
    useEffect(() => {
        if (selectedSwimmer && selectedSwimmer.id) {
            const swimmerData = swimmers.items.find(s => s.id === selectedSwimmer.id);
            if (swimmerData) {
                // The effect will re-run if swimmers.items changes, so we just need to update the selected swimmer data.
                setSelectedSwimmer({ ...swimmerData, title: swimmerData.title.rendered });
            } else {
                setSelectedSwimmer(null); // Deselect if not in list
            }
        }
    }, [swimmers.items, selectedSwimmer?.id]);

    // Maintain lock with heartbeat (refresh every 120 seconds, WordPress locks expire after 150 seconds)
    useEffect(() => {
        if (!selectedSwimmer || !selectedSwimmer.id || isCreating) return;
        
        const lockInterval = setInterval(async () => {
            try {
                await apiClient.setLock(swimmerCptSlug, selectedSwimmer.id);
            } catch (error) {
                console.error('Error refreshing lock:', error);
            }
        }, 120000); // Refresh every 2 minutes
        
        return () => clearInterval(lockInterval);
    }, [selectedSwimmer, isCreating, swimmerCptSlug]);

    const handleSelectSwimmer = useCallback(async (swimmer) => {
        setIsLoadingDetails(true);
        setIsReadOnly(false);
        setLockedByUser('');
        
        console.log('[SwimmerManager] Attempting to select swimmer:', swimmer.id);
        
        // First check if the swimmer is locked by another user
        try {
            console.log('[SwimmerManager] Checking lock status for swimmer:', swimmer.id);
            const lockStatus = await apiClient.checkLock(swimmerCptSlug, swimmer.id);
            console.log('[SwimmerManager] Lock status response:', lockStatus);
            
            if (lockStatus.locked) {
                console.log('[SwimmerManager] Swimmer is locked by:', lockStatus.locked_by, 'ID:', lockStatus.locked_by_id);
                const takeover = window.confirm(
                    `${lockStatus.locked_by} is currently editing this swimmer.\n\n` +
                    `Click OK to take over editing (they will lose their changes), or Cancel to view as read-only.`
                );
                if (!takeover) {
                    console.log('[SwimmerManager] User chose read-only mode');
                    setIsReadOnly(true);
                    setLockedByUser(lockStatus.locked_by);
                } else {
                    console.log('[SwimmerManager] User chose to take over lock');
                    console.log('[SwimmerManager] Setting lock for swimmer:', swimmer.id);
                    const lockResult = await apiClient.setLock(swimmerCptSlug, swimmer.id);
                    console.log('[SwimmerManager] Lock set result:', lockResult);
                }
            } else {
                console.log('[SwimmerManager] Swimmer is not locked, proceeding');
                console.log('[SwimmerManager] Setting lock for swimmer:', swimmer.id);
                const lockResult = await apiClient.setLock(swimmerCptSlug, swimmer.id);
                console.log('[SwimmerManager] Lock set result:', lockResult);
            }
            
        } catch (error) {
            console.error('[SwimmerManager] Error checking/setting lock:', error);
        }

        const swimmerData = { 
            ...swimmer, 
            title: swimmer.title.rendered, 
            meta: swimmer.meta || {},
            _originalModified: swimmer.modified
        };
        setSelectedSwimmer(swimmerData);
        setIsCreating(false);
        setIsLoadingDetails(false);
    }, [swimmerCptSlug]);

    const handleCloseSwimmer = useCallback(async () => {
        // Release the lock when closing the form (only if not read-only)
        if (selectedSwimmer && selectedSwimmer.id && !isReadOnly) {
            try {
                await apiClient.removeLock(swimmerCptSlug, selectedSwimmer.id);
            } catch (error) {
                console.error('Error removing lock:', error);
            }
        }
        setSelectedSwimmer(null);
        setIsCreating(false);
        setIsReadOnly(false);
        setLockedByUser('');
    }, [selectedSwimmer, swimmerCptSlug, isReadOnly]);

    const handleNewSwimmer = useCallback(() => {
        setIsCreating(true);
        setSelectedSwimmer({
            title: '',
            meta: { parent_name: '', parent_email: '', date_of_birth: '', notes_by_lc: '', current_level: '', skills_mastered: [], levels_mastered: [] },
        });
    }, []);

    const handleSwimmerChange = useCallback((key, value, isMeta = false) => {
        setSelectedSwimmer(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

const handleSaveSwimmer = useCallback(async () => {
    if (!selectedSwimmer) return;
        setIsSaving(true);
        try {
        // Use the ORIGINAL timestamp for conflict detection
        const swimmerToSave = {
            ...selectedSwimmer,
            modified: selectedSwimmer._originalModified || selectedSwimmer.modified
        };
        // The API client returns the saved swimmer object, including any updates from the server.
            const savedSwimmer = await apiClient.saveSwimmer(swimmerToSave, isCreating, swimmerCptSlug, skills);

            setFeedbackMessage(`Swimmer ${isCreating ? 'created' : 'updated'} successfully!`);
            setIsSaving(false);

        // Update the main swimmers list in-place, without a full reload.
        setSwimmers(prev => {
            const newItems = [...prev.items];
            if (isCreating) {
                // If we created a new swimmer, add it to the top of the list.
                newItems.unshift(savedSwimmer);
            } else {
                // If we updated an existing swimmer, find it and replace it with the fresh data.
                const index = newItems.findIndex(s => s.id === savedSwimmer.id);
                if (index !== -1) {
                    newItems[index] = savedSwimmer;
                }
            }
            return { ...prev, items: newItems };
        });

        if (isCreating) {
            // Close the form only when creating a new swimmer.
            setIsCreating(false);
            setSelectedSwimmer(null);
        } else {
            // For updates, refresh the selected swimmer AND update timestamp from server
            // Use functional setState to ensure we're working with the latest state
            setSelectedSwimmer(prev => ({
                ...savedSwimmer,
                title: savedSwimmer.title.rendered,
                _originalModified: savedSwimmer.modified
            }));
        }

            setTimeout(() => setFeedbackMessage(''), 3000);

        } catch (error) {
            // Handle conflict detection
            if (error.code === 'conflict_detected') {
                const reload = window.confirm(
                    'This swimmer was modified by another user while you were editing.\n\n' +
                    'Click OK to reload the latest version (you will lose your changes), or Cancel to continue editing (you may overwrite their changes).'
                );
                if (reload) {
                    // Reload the swimmer from server
                    try {
                        const response = await apiClient.fetchSwimmersPage({ postTypes: LMData.post_types }, 1, '');
                        const freshSwimmer = response.data.find(s => s.id === selectedSwimmer.id);
                        if (freshSwimmer) {
                            setSelectedSwimmer({ ...freshSwimmer, title: freshSwimmer.title.rendered });
                            setFeedbackMessage('Swimmer reloaded. Please make your changes again.');
                        }
                    } catch (reloadError) {
                        setFeedbackMessage('Error reloading swimmer.');
                    }
                } else {
                    // Remove BOTH timestamps to force save on next attempt
                    const swimmerWithoutTimestamp = { ...selectedSwimmer };
                    delete swimmerWithoutTimestamp.modified;
                    delete swimmerWithoutTimestamp._originalModified;
                    setSelectedSwimmer(swimmerWithoutTimestamp);
                    setFeedbackMessage('Warning: Next save will overwrite any other changes. Click Save again to proceed.');
                }
            } else {
                const errorMessage = error.message || 'An unknown error occurred.';
                console.error('Error saving swimmer:', error);
                alert(`Error saving swimmer: ${errorMessage}.`);
            }
            setIsSaving(false);
        }
    }, [selectedSwimmer, isCreating, swimmerCptSlug, skills, setSwimmers]);

    const handleEditEvaluation = useCallback((evaluationObject) => {
        if (evaluationObject) {
            setEditingEvaluation({ ...evaluationObject, title: evaluationObject.title.rendered, content: evaluationObject.content.rendered, meta: evaluationObject.meta || {} });
        }
    }, []);

    const handleEvalFormChange = useCallback((key, value, isMeta = false) => {
        setEditingEvaluation(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveEvaluation = useCallback(async () => {
        if (!editingEvaluation || !selectedSwimmer?.id) return;
        setIsSavingEval(true);
        try {
            // The CPT slug for evaluations is derived from the swimmer slug.
            const evaluationCptSlug = swimmerCptSlug.replace('swimmer', 'evaluation');
            const savedEval = await apiClient.saveEvaluation(editingEvaluation, evaluationCptSlug);
            setIsSavingEval(false);
            setEditingEvaluation(null);
            
            // Update evaluations state locally instead of re-fetching
            setEvaluations(prevEvals => {
                const index = prevEvals.findIndex(e => e.id === savedEval.id);
                if (index !== -1) {
                    const newEvals = [...prevEvals];
                    newEvals[index] = savedEval;
                    return newEvals;
                }
                // If it's a new evaluation, add it to the list
                return [savedEval, ...prevEvals];
            });
        } catch (error) {
            setIsSavingEval(false);
            alert(`Error saving evaluation: ${error.message}`);
        }
    }, [editingEvaluation, selectedSwimmer?.id, swimmerCptSlug]);

    const handleDeleteSwimmer = useCallback(async (swimmerId) => {
        if (window.confirm('Are you sure you want to delete this swimmer? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiClient.deleteSwimmer(swimmerId, swimmerCptSlug);
                setFeedbackMessage('Swimmer deleted successfully!');
                setIsSaving(false);
                setSelectedSwimmer(null);
                setSwimmers({ items: [], page: 0, totalPages: 1 }); // Force refresh
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                const errorMessage = error.message || 'An unknown error occurred.';
                console.error('Error deleting swimmer:', error);
                alert(`Error deleting swimmer: ${errorMessage}. Please check the console for more details.`);
                setIsSaving(false);
            }
        }
    }, [swimmerCptSlug, setSwimmers]);

    const sortedSwimmers = useMemo(() => swimmers.items, [swimmers.items]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${
                (selectedSwimmer || isCreating) ? 'hidden md:block' : 'block'
            } md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg flex flex-col`}>
                <div className="flex justify-between items-center mb-4 border-b pb-2 gap-2">
                    <h2 className="text-xl font-bold text-slate-900">All Swimmers</h2>
                    <button onClick={handleNewSwimmer} className="px-3 py-1 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">+ New</button>
                </div>
                <div className="mb-4">
                    <label htmlFor="swimmer-search" className="sr-only">Search Swimmers</label>
                    <input id="swimmer-search" type="text" placeholder="Search swimmers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="flex-grow h-[600px] overflow-y-auto pr-2">
                    <ul className="space-y-2">
                        {sortedSwimmers.map(swimmer => (
                            <li key={swimmer.id}>
                                <button onClick={() => handleSelectSwimmer(swimmer)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedSwimmer && selectedSwimmer.id === swimmer.id ? 'bg-green-50 border-green-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                    <span className="font-semibold text-slate-800">{swimmer.title.rendered}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {hasMoreSwimmers && (
                        <button onClick={loadMoreSwimmers} disabled={isSwimmersLoading} className="w-full p-2 mt-2 text-center text-green-600 font-semibold rounded-lg hover:bg-green-50 disabled:opacity-50">
                            {isSwimmersLoading ? 'Loading...' : 'Load More'}
                        </button>
                    )}
                </div>
            </div>
            <div className={`${(selectedSwimmer || isCreating) ? 'col-span-1 md:col-span-2' : 'hidden md:block'}`}>
                {isLoadingDetails ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <svg className="animate-spin h-12 w-12 text-green-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-slate-600 font-medium">Loading swimmer details...</p>
                        </div>
                    </div>
                ) : selectedSwimmer || isCreating ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        {isReadOnly && (
                            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="font-semibold text-yellow-800">Read-only: {lockedByUser} is currently editing this swimmer</span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleCloseSwimmer}
                            className="md:hidden mb-4 flex items-center text-sm font-semibold text-green-600 hover:text-green-800"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back to list
                        </button>
                        <div className="mb-6 border-b pb-3">
                            <h2 className="text-2xl font-bold text-slate-900">{isCreating ? 'Create New Swimmer' : `Editing: ${selectedSwimmer.title}`}</h2>
                            {!isCreating && selectedSwimmer.modified && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Last modified: {new Date(selectedSwimmer.modified).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <SwimmerForm
                            swimmer={selectedSwimmer}
                            onSwimmerChange={handleSwimmerChange}
                            levels={levels}
                            skills={skills}
                            evaluations={evaluations}
                            isLoadingEvals={isLoadingEvals}
                            onSave={handleSaveSwimmer}
                            onCancel={handleCloseSwimmer}
                            isSaving={isSaving}
                            isReadOnly={isReadOnly}
                            onRequestNewEvaluation={onRequestNewEvaluation}
                            onEditEvaluation={handleEditEvaluation}
                            onDelete={() => handleDeleteSwimmer(selectedSwimmer.id)}
                        />
                    </div>
                ) : (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg text-center text-slate-500 h-full flex items-center justify-center">
                        <p>Select a swimmer to view details or create a new one.</p>
                    </div>
                )}
                {/* Modal for editing an evaluation */}
                <Modal isOpen={!!editingEvaluation} onClose={() => setEditingEvaluation(null)} title={editingEvaluation ? `Editing Evaluation: ${editingEvaluation.title}` : ''}>
                    {editingEvaluation && <EvaluationForm evaluation={editingEvaluation} onEvalChange={handleEvalFormChange} onSave={handleSaveEvaluation} onCancel={() => setEditingEvaluation(null)} isSaving={isSavingEval} showSwimmerField={false} allSwimmers={swimmers.items} levels={levels} />}
                </Modal>
            </div>
        </div>
    );
};

export default SwimmerManager;