/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const { apiFetch } = wp;

/**
 * Internal dependencies
 */
import { apiClient } from '../api';
import DataContext from '../context/DataContext';
import Modal from './Modal';
import SwimmerForm from './SwimmerForm';
import EvaluationForm from './EvaluationForm';

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const getAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : 'N/A';
};

/**
 * CampOrganizer Component
 * 
 * A specialized page for organizing groups, instructors, and swimmers by camp and animal.
 * Features:
 * - Camp filter to view all groups in a specific camp
 * - Groups organized by Animal (taxonomy)
 * - Drag-and-drop instructors between animals
 * - Drag-and-drop swimmers between groups
 * - Strict single-user locking to prevent concurrent edits
 * - Bulk save all changes to the server
 */
const CampOrganizer = () => {
    const { camps, animals, levels, skills, personCache, updatePersonCache } = useContext(DataContext);
    
    const [selectedCamp, setSelectedCamp] = useState('');
    const [campData, setCampData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [collapsedAnimals, setCollapsedAnimals] = useState({});
    
    // Lock state
    const [isLocked, setIsLocked] = useState(false);
    const [lockedBy, setLockedBy] = useState('');
    const [lockCheckInterval, setLockCheckInterval] = useState(null);
    const [hasEditPermission, setHasEditPermission] = useState(false);
    
    // Original data snapshot for change detection
    const [originalData, setOriginalData] = useState(null);
    const [editingSwimmer, setEditingSwimmer] = useState(null);
    const [editingSwimmerEvaluations, setEditingSwimmerEvaluations] = useState([]);
    const [isLoadingEditingSwimmerEvals, setIsLoadingEditingSwimmerEvals] = useState(false);
    const [isSavingSwimmer, setIsSavingSwimmer] = useState(false);
    const [editingEvaluation, setEditingEvaluation] = useState(null);
    const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);

    const sortedAnimalIds = useMemo(() => {
        if (!campData) return [];
        return Object.keys(campData).sort((a, b) => {
            const nameA = getAnimalName(a);
            const nameB = getAnimalName(b);
            return nameA.localeCompare(nameB);
        });
    }, [campData, animals]);

    // Check if user has permission on mount
    useEffect(() => {
        checkPermission();
    }, []);

    const checkPermission = async () => {
        try {
            const response = await apiFetch({ 
                path: '/lm/v1/camp-organizer/check-permission',
                method: 'GET'
            });
            setHasEditPermission(response.has_permission);
        } catch (error) {
            console.error('Error checking permission:', error);
            setHasEditPermission(false);
        }
    };

    const loadCampData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch all groups for this camp organized by animal
            const response = await apiFetch({ 
                path: `/lm/v1/camp-organizer/load?camp_id=${selectedCamp}&include_archived=${includeArchived ? '1' : '0'}`,
                method: 'GET'
            });
            
            setCampData(response.data);
            setOriginalData(JSON.parse(JSON.stringify(response.data))); // Deep clone
            setIsLocked(response.locked);
            setLockedBy(response.locked_by || '');
            
            // If not locked, try to acquire lock
            if (!response.locked && hasEditPermission) {
                await acquireLock();
            }
            
            // Load person details into cache
            const allInstructorIds = new Set();
            const allSwimmerIds = new Set();
            
            Object.values(response.data).forEach(animalGroup => {
                animalGroup.groups.forEach(group => {
                    (group.instructors || []).forEach(id => allInstructorIds.add(id));
                    (group.swimmers || []).forEach(id => allSwimmerIds.add(id));
                });
            });
            
            // Fetch missing person data
            const missingInstructorIds = Array.from(allInstructorIds).filter(id => !personCache.has(id));
            const missingSwimmerIds = Array.from(allSwimmerIds).filter(id => !personCache.has(id));
            
            if (missingInstructorIds.length > 0) {
                const instructors = await apiClient.fetchUsersByIds(missingInstructorIds);
                updatePersonCache(instructors);
            }
            
            if (missingSwimmerIds.length > 0) {
                const swimmers = await apiClient.fetchSwimmersByIds({ postTypes: LMData.post_types }, missingSwimmerIds);
                updatePersonCache(swimmers);
            }
            
        } catch (error) {
            console.error('Error loading camp data:', error);
            alert('Failed to load camp data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCamp, includeArchived, hasEditPermission, personCache, updatePersonCache]);

    const handleToggleAnimal = useCallback((animalId) => {
        setCollapsedAnimals(prev => ({
            ...prev,
            [animalId]: !prev[animalId],
        }));
    }, []);

    const handleCollapseAll = useCallback(() => {
        if (!campData) return;
        const nextState = {};
        Object.keys(campData).forEach(animalId => {
            nextState[animalId] = true;
        });
        setCollapsedAnimals(nextState);
    }, [campData]);

    const handleExpandAll = useCallback(() => {
        setCollapsedAnimals({});
    }, []);

    // Load camp data when a camp is selected
    useEffect(() => {
        if (selectedCamp) {
            loadCampData();
        } else {
            setCampData(null);
            releaseLock();
        }
    }, [selectedCamp, includeArchived, loadCampData]);

    // Set up lock monitoring when data is loaded
    useEffect(() => {
        if (campData && selectedCamp) {
            // Check lock status every 5 seconds
            const interval = setInterval(() => {
                checkLockStatus();
            }, 5000);
            setLockCheckInterval(interval);
            
            return () => {
                if (interval) {
                    clearInterval(interval);
                }
            };
        }
    }, [campData, selectedCamp]);

    // Clean up lock on unmount
    useEffect(() => {
        return () => {
            releaseLock();
        };
    }, []);

    useEffect(() => {
        if (editingSwimmer && editingSwimmer.id) {
            setIsLoadingEditingSwimmerEvals(true);
            const evaluationSlug = LMData.post_types.evaluation;
            apiClient.fetchEvaluationsForSwimmer(editingSwimmer.id, evaluationSlug)
                .then(evals => {
                    setEditingSwimmerEvaluations(evals || []);
                    setIsLoadingEditingSwimmerEvals(false);
                })
                .catch(error => {
                    console.error('Error fetching evaluations for swimmer:', error);
                    setIsLoadingEditingSwimmerEvals(false);
                });
        } else {
            setEditingSwimmerEvaluations([]);
        }
    }, [editingSwimmer]);


    const acquireLock = async () => {
        try {
            await apiFetch({
                path: '/lm/v1/camp-organizer/acquire-lock',
                method: 'POST',
                data: { camp_id: selectedCamp }
            });
            setIsLocked(false);
            setLockedBy('');
        } catch (error) {
            console.error('Error acquiring lock:', error);
        }
    };

    const releaseLock = async () => {
        if (selectedCamp && !isLocked) {
            try {
                await apiFetch({
                    path: '/lm/v1/camp-organizer/release-lock',
                    method: 'POST',
                    data: { camp_id: selectedCamp }
                });
            } catch (error) {
                console.error('Error releasing lock:', error);
            }
        }
        
        if (lockCheckInterval) {
            clearInterval(lockCheckInterval);
            setLockCheckInterval(null);
        }
    };

    const checkLockStatus = async () => {
        if (!selectedCamp) return;
        
        try {
            const response = await apiFetch({
                path: `/lm/v1/camp-organizer/check-lock?camp_id=${selectedCamp}`,
                method: 'GET'
            });
            
            if (response.locked && !isLocked) {
                // Someone else has taken the lock
                setIsLocked(true);
                setLockedBy(response.locked_by || 'another user');
                alert(`${response.locked_by || 'Another user'} has taken control of this camp. Your changes cannot be saved.`);
            }
        } catch (error) {
            console.error('Error checking lock status:', error);
        }
    };

    const onDragEnd = useCallback((result) => {
        if (isLocked || !hasEditPermission) return;
        
        const { source, destination, type } = result;
        
        if (!destination) return;
        
        // Create a deep copy of campData
        const newCampData = JSON.parse(JSON.stringify(campData));
        
        if (type === 'INSTRUCTOR') {
            const getGroupByDroppableId = (droppableId) => {
                if (!droppableId.startsWith('group-instructors-')) return null;
                const groupId = parseInt(droppableId.replace('group-instructors-', ''), 10);
                if (Number.isNaN(groupId)) return null;
                let foundGroup = null;
                Object.values(newCampData).forEach(animalGroup => {
                    animalGroup.groups.forEach(group => {
                        if (group.id === groupId) {
                            foundGroup = group;
                        }
                    });
                });
                return foundGroup;
            };

            const sourceGroup = getGroupByDroppableId(source.droppableId);
            const destGroup = getGroupByDroppableId(destination.droppableId);

            if (!sourceGroup || !destGroup) return;

            const instructorId = sourceGroup.instructors[source.index];
            if (typeof instructorId === 'undefined') return;

            const updatedSource = Array.from(sourceGroup.instructors);
            updatedSource.splice(source.index, 1);

            if (sourceGroup === destGroup) {
                updatedSource.splice(destination.index, 0, instructorId);
                sourceGroup.instructors = updatedSource;
            } else {
                const updatedDest = Array.from(destGroup.instructors).filter(id => id !== instructorId);
                updatedDest.splice(destination.index, 0, instructorId);
                sourceGroup.instructors = updatedSource;
                destGroup.instructors = updatedDest;
            }
            
        } else if (type === 'SWIMMER') {
            // Moving swimmers between groups
            const sourceGroupId = parseInt(source.droppableId.replace('group-swimmers-', ''));
            const destGroupId = parseInt(destination.droppableId.replace('group-swimmers-', ''));
            
            // Find the groups
            let sourceGroup = null;
            let destGroup = null;
            let sourceAnimalId = null;
            let destAnimalId = null;
            
            Object.keys(newCampData).forEach(animalId => {
                newCampData[animalId].groups.forEach(group => {
                    if (group.id === sourceGroupId) {
                        sourceGroup = group;
                        sourceAnimalId = animalId;
                    }
                    if (group.id === destGroupId) {
                        destGroup = group;
                        destAnimalId = animalId;
                    }
                });
            });
            
            if (!sourceGroup || !destGroup) return;
            
            // Get the swimmer ID being moved
            const swimmerId = sourceGroup.swimmers[source.index];
            
            // Remove from source
            sourceGroup.swimmers.splice(source.index, 1);
            
            // Add to destination
            destGroup.swimmers.splice(destination.index, 0, swimmerId);
        }
        
        setCampData(newCampData);
        setHasChanges(true);
    }, [campData, isLocked, hasEditPermission]);

    const handleSaveChanges = async () => {
        if (isLocked || !hasEditPermission) {
            alert('You do not have permission to save changes.');
            return;
        }
        
        if (!hasChanges) {
            alert('No changes to save.');
            return;
        }
        
        setIsSaving(true);
        setSaveMessage('Saving changes...');
        
        try {
            // Prepare the update payload
            const updates = [];
            
            Object.keys(campData).forEach(animalId => {
                campData[animalId].groups.forEach(group => {
                    updates.push({
                        group_id: group.id,
                        instructors: group.instructors,
                        swimmers: group.swimmers
                    });
                });
            });
            
            await apiFetch({
                path: '/lm/v1/camp-organizer/save',
                method: 'POST',
                data: {
                    camp_id: selectedCamp,
                    updates: updates
                }
            });
            
            // Update original data to match current
            setOriginalData(JSON.parse(JSON.stringify(campData)));
            setHasChanges(false);
            setSaveMessage('✓ All changes saved successfully!');
            
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Error saving changes:', error);
            setSaveMessage('❌ Error saving changes. Please try again.');
            setTimeout(() => setSaveMessage(''), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelChanges = () => {
        if (hasChanges && !window.confirm('Discard all unsaved changes?')) {
            return;
        }
        
        // Restore original data
        setCampData(JSON.parse(JSON.stringify(originalData)));
        setHasChanges(false);
    };

    const handleOpenSwimmerModal = useCallback(async (swimmerId) => {
        if (!swimmerId) return;
        let swimmer = personCache.get(swimmerId);
        if (!swimmer) {
            try {
                const fetched = await apiClient.fetchSwimmersByIds({ postTypes: LMData.post_types }, [swimmerId]);
                if (fetched && fetched.length > 0) {
                    updatePersonCache(fetched);
                    swimmer = fetched[0];
                }
            } catch (error) {
                console.error('Error fetching swimmer details:', error);
            }
        }

        if (swimmer) {
            setEditingSwimmer({ ...swimmer, title: swimmer.title.rendered, meta: swimmer.meta || {} });
        } else {
            alert('Unable to load swimmer details. Please try again.');
        }
    }, [personCache, updatePersonCache]);

    const handleSwimmerFormChange = useCallback((key, value, isMeta = false) => {
        setEditingSwimmer(prev => {
            if (!prev) return prev;
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveSwimmer = useCallback(async () => {
        if (!editingSwimmer) return;
        setIsSavingSwimmer(true);
        try {
            const savedSwimmer = await apiClient.saveSwimmer(editingSwimmer, false, LMData.post_types.swimmer, skills);
            updatePersonCache([savedSwimmer]);
            setEditingSwimmer(null);
        } catch (error) {
            const message = error?.message || 'An unknown error occurred while saving the swimmer.';
            alert(message);
            console.error('Error saving swimmer:', error);
        } finally {
            setIsSavingSwimmer(false);
        }
    }, [editingSwimmer, skills, updatePersonCache]);

    const handleRequestNewEvaluation = useCallback((swimmerId) => {
        if (!swimmerId) return;
        const swimmer = personCache.get(swimmerId);
        setEditingEvaluation({
            id: null,
            title: swimmer ? `Evaluation for ${decodeEntities(swimmer.title?.rendered || swimmer.display_name || 'Swimmer')}` : 'New Evaluation',
            content: '',
            meta: {
                swimmer: swimmerId,
                level_evaluated: null,
            },
        });
    }, [personCache]);

    const handleEditEvaluation = useCallback((evaluation) => {
        if (!evaluation) return;
        setEditingEvaluation({
            ...evaluation,
            title: evaluation.title?.rendered || evaluation.title || '',
            content: (evaluation.content && evaluation.content.rendered) || evaluation.content || '',
            meta: evaluation.meta || {},
        });
    }, []);

    const handleEvalFormChange = useCallback((key, value, isMeta = false) => {
        setEditingEvaluation(prev => {
            if (!prev) return prev;
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveEvaluation = useCallback(async () => {
        if (!editingEvaluation) return;
        setIsSavingEvaluation(true);
        try {
            const savedEvaluation = await apiClient.saveEvaluation(editingEvaluation, LMData.post_types.evaluation);
            setEditingSwimmerEvaluations(prev => {
                const index = prev.findIndex(evalItem => evalItem.id === savedEvaluation.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = savedEvaluation;
                    return updated;
                }
                return [savedEvaluation, ...prev];
            });
            setEditingEvaluation(null);
        } catch (error) {
            const message = error?.message || 'Error saving evaluation.';
            alert(message);
            console.error('Error saving evaluation:', error);
        } finally {
            setIsSavingEvaluation(false);
        }
    }, [editingEvaluation]);

    const getPersonName = (personId) => {
        const person = personCache.get(personId);
            if (!person) return `ID: ${personId}`;
            return decodeEntities(person.display_name || person.title?.rendered || person.name || `ID: ${personId}`);
    };

    const getAnimalName = (animalId) => {
        if (animalId === 'uncategorized') {
            return 'Uncategorized Groups';
        }
        const animal = animals.find(a => a.id === parseInt(animalId, 10));
        return decodeEntities(animal?.name || `Animal ${animalId}`);
    };

    if (!hasEditPermission) {
        return (
            <div className="wrap">
                <h1 className="text-2xl font-bold mb-6">Camp Organizer</h1>
                <div className="bg-red-50 border border-red-300 rounded-lg p-6">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <h2 className="text-lg font-semibold text-red-900">Access Denied</h2>
                            <p className="text-red-800">You do not have permission to access the Camp Organizer. Please contact an administrator.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wrap max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-slate-900">Camp Organizer</h1>
                    
                    {saveMessage && (
                        <div className={`px-4 py-2 rounded-lg font-semibold ${
                            saveMessage.includes('✓') ? 'bg-green-50 text-green-800 border border-green-300' :
                            saveMessage.includes('❌') ? 'bg-red-50 text-red-800 border border-red-300' :
                            'bg-blue-50 text-blue-800 border border-blue-300'
                        }`}>
                            {saveMessage}
                        </div>
                    )}
                </div>
                
                {/* Lock Warning */}
                {isLocked && lockedBy && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span className="font-semibold text-yellow-800">
                                This camp is currently being edited by {lockedBy}. You can view but cannot make changes.
                            </span>
                        </div>
                    </div>
                )}
                
                {/* Camp Selection */}
                <div className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1">
                        <label htmlFor="camp-select" className="block text-sm font-semibold text-slate-700 mb-2">
                            Select Camp
                        </label>
                        <select
                            id="camp-select"
                            value={selectedCamp}
                            onChange={(e) => setSelectedCamp(e.target.value)}
                            disabled={isLoading || isSaving || hasChanges}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">-- Select a Camp --</option>
                            {camps.map(camp => (
                                <option key={camp.id} value={camp.id}>
                                    {camp.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="checkbox"
                            id="include-archived-toggle"
                            className="h-4 w-4 text-orange-600 border-slate-300 rounded"
                            checked={includeArchived}
                            onChange={(e) => setIncludeArchived(e.target.checked)}
                            disabled={isLoading || isSaving || hasChanges}
                        />
                        <label htmlFor="include-archived-toggle" className="text-sm font-medium text-slate-700">
                            Show archived groups
                        </label>
                    </div>
                    
                    {campData && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveChanges}
                                disabled={!hasChanges || isLocked || isSaving}
                                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {isSaving ? 'Saving...' : 'Save All Changes'}
                            </button>
                            
                            <button
                                onClick={handleCancelChanges}
                                disabled={!hasChanges || isLocked || isSaving}
                                className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {campData && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                            type="button"
                            onClick={handleCollapseAll}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Collapse all animals
                        </button>
                        <button
                            type="button"
                            onClick={handleExpandAll}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Expand all animals
                        </button>
                    </div>
                )}
                
                {hasChanges && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
                        <p className="text-blue-800 font-medium">⚠️ You have unsaved changes. Click "Save All Changes" to apply them.</p>
                    </div>
                )}
            </div>
            
            {/* Loading State */}
            {isLoading && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                    <div className="flex flex-col items-center justify-center">
                        <svg className="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-slate-600 font-medium">Loading camp data...</p>
                    </div>
                </div>
            )}
            
            {/* Camp Organization View */}
            {campData && !isLoading && (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="space-y-6">
                        {sortedAnimalIds.map(animalId => {
                            const animalData = campData[animalId];
                            const animalName = getAnimalName(animalId);
                            const isCollapsed = !!collapsedAnimals[animalId];
                            
                            return (
                                <div key={animalId} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                                    {/* Animal Header */}
                                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between gap-4">
                                        <h2 className="text-2xl font-bold text-white">
                                            {animalName}
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleAnimal(animalId)}
                                            className="px-3 py-1.5 text-sm font-semibold text-white border border-white/30 rounded-lg hover:bg-white/10"
                                        >
                                            {isCollapsed ? 'Expand' : 'Collapse'}
                                        </button>
                                    </div>
                                    
                                    <div className="p-6">
                                        {/* Groups Table */}
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Groups</h3>
                                            {isCollapsed ? (
                                                <div className="text-slate-500 text-sm italic bg-slate-50 rounded-lg p-4">
                                                    Section collapsed. Expand to manage these groups.
                                                </div>
                                            ) : animalData.groups.length === 0 ? (
                                                <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg">
                                                    No groups in this animal
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {animalData.groups.map(group => (
                                                        <div key={group.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div>
                                                                    <h2 className="text-lg font-bold text-slate-900">
                                                                        <span className="text-orange-600">{animalName}</span>
                                                                        <span className="text-slate-500">, </span>
                                                                        <span>{group.name}</span>
                                                                    </h2>
                                                                    {group.level && (
                                                                        <p className="text-sm text-slate-600">Level: {group.level}</p>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-slate-500">
                                                                    {group.swimmers.length} swimmer{group.swimmers.length !== 1 ? 's' : ''}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Group Instructors */}
                                                            <div className="mb-4">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm font-semibold text-slate-600">Instructors</span>
                                                                    <span className="text-xs text-slate-400">Drag to reorder or move between groups</span>
                                                                </div>
                                                                <Droppable
                                                                    droppableId={`group-instructors-${group.id}`}
                                                                    type="INSTRUCTOR"
                                                                    direction="horizontal"
                                                                    isDropDisabled={isLocked || !hasEditPermission}
                                                                >
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.droppableProps}
                                                                            className={`flex flex-wrap gap-2 p-3 rounded-lg border-2 border-dashed transition-colors ${
                                                                                snapshot.isDraggingOver
                                                                                    ? 'bg-indigo-50 border-indigo-300'
                                                                                    : 'bg-white border-slate-300'
                                                                            }`}
                                                                        >
                                                                            {group.instructors.length === 0 ? (
                                                                                <span className="text-sm text-slate-400 italic">None assigned</span>
                                                                            ) : (
                                                                                group.instructors.map((instructorId, index) => (
                                                                                    <Draggable
                                                                                        key={`group-${group.id}-instructor-${instructorId}`}
                                                                                        draggableId={`group-${group.id}-instructor-${instructorId}`}
                                                                                        index={index}
                                                                                        isDragDisabled={isLocked || !hasEditPermission}
                                                                                    >
                                                                                        {(provided, snapshot) => (
                                                                                            <div
                                                                                                ref={provided.innerRef}
                                                                                                {...provided.draggableProps}
                                                                                                {...provided.dragHandleProps}
                                                                                                className={`px-3 py-1.5 bg-white rounded-full shadow-sm border border-slate-200 text-sm font-medium text-slate-700 cursor-move flex items-center gap-2 ${
                                                                                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-indigo-400' : ''
                                                                                                }`}
                                                                                            >
                                                                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                                                                </svg>
                                                                                                {getPersonName(instructorId)}
                                                                                            </div>
                                                                                        )}
                                                                                    </Draggable>
                                                                                ))
                                                                            )}
                                                                            {provided.placeholder}
                                                                        </div>
                                                                    )}
                                                                </Droppable>
                                                            </div>
                                                            
                                                            {/* Swimmers Droppable */}
                                                            <Droppable
                                                                droppableId={`group-swimmers-${group.id}`}
                                                                type="SWIMMER"
                                                                isDropDisabled={isLocked || !hasEditPermission}
                                                            >
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.droppableProps}
                                                                        className={`min-h-[80px] p-3 rounded-lg border-2 border-dashed transition-colors ${
                                                                            snapshot.isDraggingOver
                                                                                ? 'bg-green-50 border-green-300'
                                                                                : 'bg-white border-slate-300'
                                                                        }`}
                                                                    >
                                                                        {group.swimmers.length === 0 ? (
                                                                            <div className="text-slate-400 italic text-sm">No swimmers</div>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                {group.swimmers.map((swimmerId, index) => (
                                                                                    <Draggable
                                                                                        key={`swimmer-${swimmerId}`}
                                                                                        draggableId={`swimmer-${swimmerId}`}
                                                                                        index={index}
                                                                                        isDragDisabled={isLocked || !hasEditPermission}
                                                                                    >
                                                                                        {(provided, snapshot) => {
                                                                                            const swimmer = personCache.get(swimmerId) || { id: swimmerId, title: { rendered: `Swimmer #${swimmerId}` }, meta: {} };
                                                                                            const level = swimmer.meta?.current_level ? levels.find(l => l.id === swimmer.meta.current_level) : null;
                                                                                            return (
                                                                                                <div
                                                                                                    ref={provided.innerRef}
                                                                                                    {...provided.draggableProps}
                                                                                                    {...provided.dragHandleProps}
                                                                                                    className={`p-3 bg-white rounded-md shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-shadow ${
                                                                                                        snapshot.isDragging ? 'shadow-lg ring-2 ring-green-400' : ''
                                                                                                    }`}
                                                                                                >
                                                                                                    <div className="grid grid-cols-3 gap-4 items-center text-sm text-slate-600">
                                                                                                        <div className="col-span-1">
                                                                                                            <button type="button" className="text-indigo-600 hover:text-indigo-900 font-semibold text-left" onClick={(e) => { e.stopPropagation(); handleOpenSwimmerModal(swimmerId); }}>
                                                                                                                {decodeEntities(swimmer.title?.rendered || swimmer.title || `Swimmer #${swimmerId}`)}
                                                                                                            </button>
                                                                                                        </div>
                                                                                                        <div className="col-span-1 text-xs sm:text-sm text-slate-500">
                                                                                                            Age: {getAge(swimmer.meta?.date_of_birth)}
                                                                                                        </div>
                                                                                                        <div className="col-span-1 text-xs sm:text-sm text-slate-500">
                                                                                                            Level: {level ? decodeEntities(level.title.rendered) : 'N/A'}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {swimmer.meta?.notes && (
                                                                                                        <div className="text-xs sm:text-sm text-slate-500 mt-2 pt-2 border-t border-slate-200">
                                                                                                            <span className="font-semibold text-slate-600">Notes:</span> {swimmer.meta.notes}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        }}
                                                                                    </Draggable>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {provided.placeholder}
                                                                    </div>
                                                                )}
                                                            </Droppable>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            )}
            
            {/* Empty State */}
            {!selectedCamp && !isLoading && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                    <div className="text-center">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">Select a Camp to Begin</h3>
                        <p className="text-slate-500">Choose a camp from the dropdown above to view and organize its groups.</p>
                    </div>
                </div>
            )}

            <Modal
                isOpen={!!editingSwimmer}
                onClose={() => setEditingSwimmer(null)}
                title={editingSwimmer ? `Editing: ${decodeEntities(editingSwimmer.title)}` : ''}
            >
                {editingSwimmer && (
                    <div className="overflow-y-auto max-h-[80vh]">
                        <SwimmerForm
                            swimmer={editingSwimmer}
                            onSwimmerChange={handleSwimmerFormChange}
                            evaluations={editingSwimmerEvaluations}
                            isLoadingEvals={isLoadingEditingSwimmerEvals}
                            levels={levels}
                            skills={skills}
                            onSave={handleSaveSwimmer}
                            onCancel={() => setEditingSwimmer(null)}
                            isSaving={isSavingSwimmer}
                            onRequestNewEvaluation={handleRequestNewEvaluation}
                            onEditEvaluation={handleEditEvaluation}
                        />
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!editingEvaluation}
                onClose={() => setEditingEvaluation(null)}
                title={editingEvaluation ? `${editingEvaluation.id ? 'Edit Evaluation' : 'New Evaluation'}` : ''}
            >
                {editingEvaluation && (
                    <EvaluationForm
                        evaluation={editingEvaluation}
                        onEvalChange={handleEvalFormChange}
                        onSave={handleSaveEvaluation}
                        onCancel={() => setEditingEvaluation(null)}
                        isSaving={isSavingEvaluation}
                        showSwimmerField={false}
                        levels={levels}
                    />
                )}
            </Modal>
        </div>
    );
};

export default CampOrganizer;
