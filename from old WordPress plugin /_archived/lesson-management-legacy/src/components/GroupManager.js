/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";const { apiFetch } = wp;

/**
 * Internal dependencies
 */
import { apiClient, saveGroup } from '../api';
import MultiSelectSearch from './MultiSelectSearch';
import Modal from './Modal';
import LockConfirmModal from './LockConfirmModal';
import SwimmerForm from './SwimmerForm';
import EvaluationForm from './EvaluationForm';
import DataContext from '../context/DataContext';

const GroupManager = ({
    groups,
    fetchGroups,
    setGroups,
    setSwimmers,
    groupCptSlug,
    decodeEntities,
    loadMoreGroups,
    hasMoreGroups,
    isGroupsLoading,
    groupSearchTerm,
    setGroupSearchTerm,
    onRequestNewEvaluation,
}) => {
    console.log('Groups prop received:', groups.items);
    const { levels, users, camps, animals, lessonTypes, skills, personCache, updatePersonCache } = useContext(DataContext);
    const weekDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const [selectedGroup, setSelectedGroup] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [lockedByUser, setLockedByUser] = useState('');
    const [lockConfirmModalOpen, setLockConfirmModalOpen] = useState(false);
    const [pendingGroupSelection, setPendingGroupSelection] = useState(null);
    const [justTookOver, setJustTookOver] = useState(false); // Flag to skip conflict check after takeover
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [filters, setFilters] = useState({ year: '', level: '', lesson_type: '', days: [], instructor: [], camp: '', animal: '', archived: 'hide' });
    const [isFilterModalOpen, setFilterModalOpen] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [swimmerGroupings, setSwimmerGroupings] = useState({});
    const [selectedSwimmerDetails, setSelectedSwimmerDetails] = useState([]);
    const [editingSwimmer, setEditingSwimmer] = useState(null);
    const [editingSwimmerEvaluations, setEditingSwimmerEvaluations] = useState([]);
    const [isLoadingEditingSwimmerEvals, setIsLoadingEditingSwimmerEvals] = useState(false);
    const [selectedInstructorDetails, setSelectedInstructorDetails] = useState([]);
    
    // State for inline evaluation creation (slide-over within swimmer modal)
    const [inlineEvaluation, setInlineEvaluation] = useState(null);
    const [isEvaluationSaving, setIsEvaluationSaving] = useState(false);

    // State for async swimmer search
    const [searchedSwimmers, setSearchedSwimmers] = useState([]);
    const [isSwimmerSearchLoading, setIsSwimmerSearchLoading] = useState(false);
    const [swimmerSearchPage, setSwimmerSearchPage] = useState(1);
    const [swimmerHasMore, setSwimmerHasMore] = useState(false);
    const [currentSwimmerSearchTerm, setCurrentSwimmerSearchTerm] = useState('');
    // State for async instructor search
    const [searchedInstructors, setSearchedInstructors] = useState([]);
    const [isInstructorSearchLoading, setIsInstructorSearchLoading] = useState(false);

    useEffect(() => {
        if (selectedGroup) {
            const instructorIds = selectedGroup.meta.instructor || [];
            const swimmerIds = selectedGroup.meta.swimmers || [];

            const missingInstructorIds = instructorIds.filter(id => !personCache.has(id));
            const missingSwimmerIds = swimmerIds.filter(id => !personCache.has(id));

            const promises = [];
            if (missingInstructorIds.length > 0) {
                promises.push(apiClient.fetchUsersByIds(missingInstructorIds));
            } else {
                promises.push(Promise.resolve([])); // Keep promise order consistent
            }

            if (missingSwimmerIds.length > 0) {
                promises.push(apiClient.fetchSwimmersByIds({ postTypes: LMData.post_types }, missingSwimmerIds));
            } else {
                promises.push(Promise.resolve([]));
            }

            Promise.all(promises).then(([newInstructors, newSwimmers]) => {
                if (newInstructors.length > 0) {
                    updatePersonCache(newInstructors);
                }
                if (newSwimmers.length > 0) {
                    updatePersonCache(newSwimmers);
                }
            });
        }
    }, [selectedGroup]);

    useEffect(() => {
        if (selectedGroup) {
            const instructorIds = selectedGroup.meta.instructor || [];
            const swimmerIds = selectedGroup.meta.swimmers || [];

            setSelectedInstructorDetails(instructorIds.map(id => personCache.get(id)).filter(Boolean));
            setSelectedSwimmerDetails(swimmerIds.map(id => personCache.get(id)).filter(Boolean));
        } else {
            setSelectedInstructorDetails([]);
            setSelectedSwimmerDetails([]);
        }
    }, [selectedGroup, personCache]);

    // Fetch evaluations when editing swimmer modal opens
    useEffect(() => {
        if (editingSwimmer && editingSwimmer.id) {
            setIsLoadingEditingSwimmerEvals(true);
            const evaluationSlug = LMData.post_types.evaluation;
            apiClient.fetchEvaluationsForSwimmer(editingSwimmer.id, evaluationSlug)
                .then(evals => {
                    setEditingSwimmerEvaluations(evals);
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

    // Maintain lock with heartbeat (refresh every 120 seconds, WordPress locks expire after 150 seconds)
    // Also detect if lock has been stolen by another user
    useEffect(() => {
        if (!selectedGroup || !selectedGroup.id || isCreating || isReadOnly) return;
        
        const lockInterval = setInterval(async () => {
            try {
                // Refresh our lock
                await apiClient.setLock(groupCptSlug, selectedGroup.id);
                console.log('[GroupManager] Lock heartbeat - lock refreshed for group:', selectedGroup.id);
            } catch (error) {
                console.error('[GroupManager] Error refreshing lock:', error);
                // If lock refresh fails, check if another user has taken over
                try {
                    const lockStatus = await apiClient.checkLock(groupCptSlug, selectedGroup.id);
                    if (lockStatus.locked) {
                        console.warn('[GroupManager] Lock was stolen by:', lockStatus.locked_by);
                        setLockedByUser(lockStatus.locked_by);
                        setIsReadOnly(true);
                        setSaveMessage(`⚠️ Warning: ${lockStatus.locked_by} has taken over this group. Your changes are now read-only.`);
                    }
                } catch (checkError) {
                    console.error('[GroupManager] Error checking lock status:', checkError);
                }
            }
        }, 120000); // Refresh every 2 minutes
        
        return () => clearInterval(lockInterval);
    }, [selectedGroup, isCreating, isReadOnly, groupCptSlug]);

    const handleSelectGroup = useCallback(async (group) => {
        setIsLoadingDetails(true);
        setIsReadOnly(false);
        setLockedByUser('');
        
        console.log('[GroupManager] Attempting to select group:', group.id);
        
        // Fetch fresh data from server to ensure we have latest changes
        let freshGroup = group;
        try {
            console.log('[GroupManager] Fetching fresh group data from server');
            const allGroups = await apiClient.fetchGroups({ postTypes: LMData.post_types });
            const latest = allGroups.find(g => g.id === group.id);
            if (latest) {
                freshGroup = latest;
                console.log('[GroupManager] Fresh group data loaded');
            }
        } catch (error) {
            console.warn('[GroupManager] Failed to fetch fresh group data, using provided group');
        }
        
        // First check if the group is locked by another user
        try {
            console.log('[GroupManager] Checking lock status for group:', freshGroup.id);
            const lockStatus = await apiClient.checkLock(groupCptSlug, freshGroup.id);
            console.log('[GroupManager] Lock status response:', lockStatus);
            
            if (lockStatus.locked) {
                console.log('[GroupManager] Group is locked by:', lockStatus.locked_by, 'ID:', lockStatus.locked_by_id);
                // Show custom modal instead of window.confirm
                setPendingGroupSelection(freshGroup);
                setLockedByUser(lockStatus.locked_by);
                setLockConfirmModalOpen(true);
                setIsLoadingDetails(false);
                return; // Wait for user response from modal
            } else {
                console.log('[GroupManager] Group is not locked, proceeding');
                // Acquire the lock for this group
                console.log('[GroupManager] Setting lock for group:', freshGroup.id);
                const lockResult = await apiClient.setLock(groupCptSlug, freshGroup.id);
                console.log('[GroupManager] Lock set result:', lockResult);
            }
            
        } catch (error) {
            console.error('[GroupManager] Error checking/setting lock:', error);
            // Continue anyway if lock check fails
        }

        const groupData = { 
            ...freshGroup, 
            title: freshGroup.title.rendered, 
            meta: freshGroup.meta || {},
            // Store ORIGINAL timestamp - don't update it after saves
            _originalModified: freshGroup.modified
        };

        // When selecting a group, ensure swimmer_grouping is initialized correctly.
        const instructors = groupData.meta.instructor || [];
        const swimmers = groupData.meta.swimmers || [];
        const savedGroupings = groupData.meta.swimmer_grouping || {};
        const newGroupings = {};
        const allAssignedSwimmers = new Set();

        instructors.forEach(instId => {
            const currentLane = savedGroupings[instId] || [];
            newGroupings[instId] = currentLane.filter(swimmerId => swimmers.includes(swimmerId));
            newGroupings[instId].forEach(swimmerId => allAssignedSwimmers.add(swimmerId));
        });

        const unassignedSwimmers = swimmers.filter(swimmerId => !allAssignedSwimmers.has(swimmerId));
        if (unassignedSwimmers.length > 0 && instructors.length > 0) {
            const firstInstructorId = instructors[0];
            if (!newGroupings[firstInstructorId]) newGroupings[firstInstructorId] = [];
            newGroupings[firstInstructorId].push(...unassignedSwimmers);
        }

        groupData.meta.swimmer_grouping = newGroupings;

        setSelectedGroup(groupData);
        setSwimmerGroupings(newGroupings);
        setIsCreating(false);
        setIsLoadingDetails(false);
    }, [groupCptSlug]);

    const handleCloseGroup = useCallback(async () => {
        // Release the lock when closing the form (only if not read-only)
        if (selectedGroup && selectedGroup.id && !isReadOnly) {
            try {
                await apiClient.removeLock(groupCptSlug, selectedGroup.id);
            } catch (error) {
                console.error('Error removing lock:', error);
            }
        }
        setSelectedGroup(null);
        setIsCreating(false);
        setIsReadOnly(false);
        setLockedByUser('');
    }, [selectedGroup, groupCptSlug, isReadOnly]);

    // Lock modal handlers
    const handleLockTakeover = useCallback(async () => {
        console.log('[GroupManager] User chose to take over lock');
        setLockConfirmModalOpen(false);
        setIsLoadingDetails(true);
        
        if (pendingGroupSelection) {
            let freshGroup = null;
            try {
                // Force unlock the other user's lock
                console.log('[GroupManager] Force unlocking group:', pendingGroupSelection.id);
                await apiClient.forceUnlock(groupCptSlug, pendingGroupSelection.id);
                
                // Now set our lock
                console.log('[GroupManager] Setting lock for group:', pendingGroupSelection.id);
                await apiClient.setLock(groupCptSlug, pendingGroupSelection.id);
                
                // IMPORTANT: Fetch fresh data from server after takeover
                // This ensures we get any changes the other user saved
                console.log('[GroupManager] Fetching fresh data after takeover');
                freshGroup = await apiClient.fetchGroups({ postTypes: LMData.post_types }).then(groups => 
                    groups.find(g => g.id === pendingGroupSelection.id)
                );
                
                if (freshGroup) {
                    console.log('[GroupManager] Fresh group data fetched:', freshGroup.id);
                } else {
                    console.warn('[GroupManager] Could not fetch fresh group data, using pending selection');
                }
            } catch (error) {
                console.error('[GroupManager] Error taking over lock:', error);
            }
            
            // Use fresh group data if available, otherwise fall back to pending selection
            const sourceGroup = freshGroup || pendingGroupSelection;
            const groupData = { 
                ...sourceGroup, 
                title: sourceGroup.title.rendered, 
                meta: sourceGroup.meta || {},
                _originalModified: sourceGroup.modified
            };
            
            // Initialize swimmer_grouping
            const instructors = groupData.meta.instructor || [];
            const swimmers = groupData.meta.swimmers || [];
            const savedGroupings = groupData.meta.swimmer_grouping || {};
            const newGroupings = {};
            const allAssignedSwimmers = new Set();

            instructors.forEach(instId => {
                const currentLane = savedGroupings[instId] || [];
                newGroupings[instId] = currentLane.filter(swimmerId => swimmers.includes(swimmerId));
                newGroupings[instId].forEach(swimmerId => allAssignedSwimmers.add(swimmerId));
            });

            const unassignedSwimmers = swimmers.filter(swimmerId => !allAssignedSwimmers.has(swimmerId));
            if (unassignedSwimmers.length > 0 && instructors.length > 0) {
                const firstInstructor = instructors[0];
                if (!newGroupings[firstInstructor]) newGroupings[firstInstructor] = [];
                newGroupings[firstInstructor].push(...unassignedSwimmers);
            }

            groupData.meta.swimmer_grouping = newGroupings;
            setSwimmerGroupings(newGroupings);
            setSelectedGroup(groupData);
            setIsCreating(false);
            setIsReadOnly(false);
            setIsLoadingDetails(false);
            setJustTookOver(true); // Flag to skip conflict check on next save
            setPendingGroupSelection(null);
        }
    }, [pendingGroupSelection, groupCptSlug]);

    const handleLockReadOnly = useCallback(() => {
        console.log('[GroupManager] User chose read-only mode');
        setLockConfirmModalOpen(false);
        
        if (pendingGroupSelection) {
            const groupData = { 
                ...pendingGroupSelection, 
                title: pendingGroupSelection.title.rendered, 
                meta: pendingGroupSelection.meta || {},
                _originalModified: pendingGroupSelection.modified
            };
            
            // Initialize swimmer_grouping
            const instructors = groupData.meta.instructor || [];
            const swimmers = groupData.meta.swimmers || [];
            const savedGroupings = groupData.meta.swimmer_grouping || {};
            const newGroupings = {};
            const allAssignedSwimmers = new Set();

            instructors.forEach(instId => {
                const currentLane = savedGroupings[instId] || [];
                newGroupings[instId] = currentLane.filter(swimmerId => swimmers.includes(swimmerId));
                newGroupings[instId].forEach(swimmerId => allAssignedSwimmers.add(swimmerId));
            });

            const unassignedSwimmers = swimmers.filter(swimmerId => !allAssignedSwimmers.has(swimmerId));
            if (unassignedSwimmers.length > 0 && instructors.length > 0) {
                const firstInstructor = instructors[0];
                if (!newGroupings[firstInstructor]) newGroupings[firstInstructor] = [];
                newGroupings[firstInstructor].push(...unassignedSwimmers);
            }

            groupData.meta.swimmer_grouping = newGroupings;
            setSwimmerGroupings(newGroupings);
            setSelectedGroup(groupData);
            setIsCreating(false);
            setIsReadOnly(true);
            setIsLoadingDetails(false);
            setPendingGroupSelection(null);
        }
    }, [pendingGroupSelection]);

    const handleLockCancel = useCallback(() => {
        console.log('[GroupManager] User cancelled lock dialog');
        setLockConfirmModalOpen(false);
        setPendingGroupSelection(null);
        setLockedByUser('');
    }, []);

    const handleNewGroup = useCallback(() => {
        setIsCreating(true);
        setSelectedGroup({
            title: '',
            meta: { level: null, days: [], group_time: '', instructor: [], swimmers: [], dates_offered: [], archived: false, year: new Date().getFullYear() },
            lm_camp: [],
            lm_animal: [],
            lm_lesson_type: [],
        });
    }, []);

    const handleGroupChange = useCallback((key, value, isMeta = false) => {
        setSelectedGroup(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveGroup = async () => {
        setIsSaving(true);
        setSaveMessage('Saving...');
        try {
            // IMPORTANT: Check if we still have the lock before attempting to save
            if (selectedGroup && selectedGroup.id && !isReadOnly) {
                try {
                    const lockStatus = await apiClient.checkLock(groupCptSlug, selectedGroup.id);
                    if (lockStatus.locked && lockedByUser) {
                        // We've lost the lock!
                        console.warn('[GroupManager] Lost lock to:', lockedByUser);
                        setIsReadOnly(true);
                        setSaveMessage(`❌ Cannot save: ${lockedByUser} has taken over this group. Your changes are read-only.`);
                        setIsSaving(false);
                        setTimeout(() => setSaveMessage(''), 5000);
                        return;
                    }
                } catch (lockCheckError) {
                    console.warn('[GroupManager] Could not verify lock status before save, proceeding anyway');
                }
            }
            
            // Use the ORIGINAL timestamp for conflict detection
            // UNLESS we just took over - then skip the conflict check
            const groupToSave = {
                ...selectedGroup,
                modified: selectedGroup._originalModified || selectedGroup.modified
            };
            
            console.log('[GroupManager Save] Attempting to save:', {
                groupId: selectedGroup.id,
                title: selectedGroup.title,
                justTookOver: justTookOver,
                originalModified: groupToSave.modified,
                timestamp: new Date().toISOString()
            });
            
            const savedGroup = await saveGroup(groupToSave, justTookOver); // Pass skipConflictCheck flag
            
            console.log('[GroupManager Save] SUCCESS:', {
                groupId: savedGroup.id,
                savedModified: savedGroup.modified,
                timestamp: new Date().toISOString()
            });
            
            // Clear the takeover flag after first save
            if (justTookOver) {
                setJustTookOver(false);
                console.log('[GroupManager] Cleared takeover flag after successful save');
            }
            
            // Update the state locally instead of re-fetching
            setGroups(prev => {
                const newItems = [...prev.items];
                const index = newItems.findIndex(g => g.id === savedGroup.id);
                if (index !== -1) {
                    newItems[index] = savedGroup; // Update existing group
                } else {
                    newItems.unshift(savedGroup); // Add new group to the top
                }
                return { ...prev, items: newItems };
            });
            
            // Update the selected group AND update the original timestamp to the server's new value
            // This prevents false positives on conflict detection for subsequent saves
            // Use functional setState to ensure we're working with the latest state
            setSelectedGroup(prev => ({
                ...savedGroup,
                title: savedGroup.title.rendered,
                _originalModified: savedGroup.modified,
                // Preserve any runtime-only fields that aren't in savedGroup
                meta: {
                    ...savedGroup.meta,
                    swimmer_grouping: prev?.meta?.swimmer_grouping || savedGroup.meta.swimmer_grouping
                }
            }));
            
            // Fetch fresh data for instructors and swimmers to update the display
            const instructorIds = savedGroup.meta.instructor || [];
            const swimmerIds = savedGroup.meta.swimmers || [];
            
            const promises = [];
            if (instructorIds.length > 0) {
                promises.push(apiClient.fetchUsersByIds(instructorIds));
            }
            if (swimmerIds.length > 0) {
                promises.push(apiClient.fetchSwimmersByIds({ postTypes: LMData.post_types }, swimmerIds));
            }
            
            if (promises.length > 0) {
                Promise.all(promises).then(([newInstructors, newSwimmers]) => {
                    if (newInstructors && newInstructors.length > 0) {
                        updatePersonCache(newInstructors);
                    }
                    if (newSwimmers && newSwimmers.length > 0) {
                        updatePersonCache(newSwimmers);
                    }
                });
            }
            
            setSaveMessage('✓ Saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Failed to save group:', error);
            console.error('[GroupManager Save] ERROR Details:', {
                errorCode: error?.code,
                errorMessage: error?.message,
                errorStatus: error?.status,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            });
            
            // Handle conflict detection
            if (error.code === 'conflict_detected') {
                const reload = window.confirm(
                    'This group was modified by another user while you were editing.\n\n' +
                    'Click OK to reload the latest version (you will lose your changes), or Cancel to continue editing (you may overwrite their changes).'
                );
                if (reload) {
                    // Reload the group from server
                    try {
                        const freshGroup = await apiClient.fetchGroups({ postTypes: LMData.post_types }).then(groups => 
                            groups.find(g => g.id === selectedGroup.id)
                        );
                        if (freshGroup) {
                            setSelectedGroup({ ...freshGroup, title: freshGroup.title.rendered });
                            setSaveMessage('Group reloaded. Please make your changes again.');
                        }
                    } catch (reloadError) {
                        setSaveMessage('Error reloading group.');
                    }
                } else {
                    // Remove BOTH timestamps to force save on next attempt
                    const groupWithoutTimestamp = { ...selectedGroup };
                    delete groupWithoutTimestamp.modified;
                    delete groupWithoutTimestamp._originalModified;
                    setSelectedGroup(groupWithoutTimestamp);
                    setSaveMessage('Warning: Next save will overwrite any other changes. Click Save again to proceed.');
                }
            } else {
                setSaveMessage('Error: Could not save group.');
            }
            setTimeout(() => setSaveMessage(''), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGroup = useCallback(async (groupId) => {
        if (window.confirm('Are you sure you want to delete this group? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiClient.deleteGroup(groupId, groupCptSlug);
                setFeedbackMessage('Group deleted successfully!');
                setIsSaving(false);
                setSelectedGroup(null);
                // Force a refresh of the groups list by resetting its state
                setGroups({ items: [], page: 0, totalPages: 1 });
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                const errorMessage = error.message || 'An unknown error occurred.';
                console.error('Error deleting group:', error);
                alert(`Error deleting group: ${errorMessage}. Check the console for more details.`);
                setIsSaving(false);
            }
        }
    }, [groupCptSlug, setGroups]);

    const handleSwimmerFormChange = useCallback((key, value, isMeta = false) => {
        setEditingSwimmer(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

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

    const handleOpenSwimmerModal = (swimmerId) => {
        // Find the full swimmer object from the detailed list of swimmers in the current group.
        const swimmerData = selectedSwimmerDetails.find(s => s.id === swimmerId);
        if (swimmerData) {
            setEditingSwimmer({ ...swimmerData, title: swimmerData.title.rendered, meta: swimmerData.meta || {} });
        } else {
            // This case should be rare, but it's good to have a fallback warning.
            console.warn(`Swimmer ${swimmerId} not found in the selected group's details. Modal may have incomplete data.`);
        }
    };

    const handleSaveSwimmer = useCallback(async () => {
        setIsSaving(true);
        try {
            const savedSwimmer = await apiClient.saveSwimmer(editingSwimmer, false, LMData.post_types.swimmer, skills);
            setEditingSwimmer(null);

            // Refresh the detailed swimmer list for the current group
            setSelectedSwimmerDetails(prevDetails => {
                const index = prevDetails.findIndex(s => s.id === savedSwimmer.id);
                if (index !== -1) {
                    const newDetails = [...prevDetails];
                    newDetails[index] = savedSwimmer;
                    return newDetails;
                }
                return prevDetails; // Should not happen if editing an existing swimmer
            });

            setFeedbackMessage('Swimmer updated successfully!');
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            alert(`Error saving swimmer: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    }, [editingSwimmer, skills]);

    // Inline evaluation handlers (for creating evaluations within the swimmer modal)
    const handleStartInlineEvaluation = useCallback((swimmerId) => {
        // Create a new evaluation with the swimmer pre-filled
        setInlineEvaluation({
            title: '',
            content: '',
            meta: {
                swimmer: swimmerId,
                level_evaluated: null,
                emailed: false,
            },
        });
    }, []);

    const handleInlineEvalChange = useCallback((key, value, isMeta = false) => {
        setInlineEvaluation(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveInlineEvaluation = useCallback(async () => {
        if (!inlineEvaluation || !inlineEvaluation.title.trim()) {
            alert('Evaluation title cannot be empty.');
            return;
        }
        setIsEvaluationSaving(true);
        try {
            const evaluationSlug = LMData.post_types.evaluation;
            const savedEval = await apiClient.saveEvaluation(inlineEvaluation, evaluationSlug);
            
            // Add the new evaluation to the swimmer's evaluations list
            setEditingSwimmerEvaluations(prev => [savedEval, ...prev]);
            
            // Close the evaluation form and go back to swimmer form
            setInlineEvaluation(null);
            setFeedbackMessage('Evaluation created successfully!');
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            alert(`Error saving evaluation: ${error.message}`);
        } finally {
            setIsEvaluationSaving(false);
        }
    }, [inlineEvaluation]);

    const handleCancelInlineEvaluation = useCallback(() => {
        setInlineEvaluation(null);
    }, []);

    const onDragEnd = useCallback((result) => {
        const { source, destination } = result;
        if (!destination) return;

        const sourceDroppableId = source.droppableId;
        const destDroppableId = destination.droppableId;

        const currentGroupings = selectedGroup.meta.swimmer_grouping || {};
        const newGroupings = { ...currentGroupings };

        const sourceList = Array.from(newGroupings[sourceDroppableId] || []);
        const [movedItem] = sourceList.splice(source.index, 1);

        if (sourceDroppableId === destDroppableId) {
            sourceList.splice(destination.index, 0, movedItem);
            newGroupings[sourceDroppableId] = sourceList;
        } else {
            const destList = Array.from(newGroupings[destDroppableId] || []); // Ensure it's an array
            destList.splice(destination.index, 0, movedItem);
            newGroupings[sourceDroppableId] = sourceList;
            newGroupings[destDroppableId] = destList;
        }
        // Directly update the main group object, which will trigger the UI update
        handleGroupChange('swimmer_grouping', newGroupings, true);
    }, [selectedGroup, handleGroupChange]);

    const applyFilters = () => {
        setAppliedFilters(filters);
        setFilterModalOpen(false);
    };

    const clearFilters = () => {
        const cleared = { year: '', level: '', lesson_type: '', days: [], instructor: [], camp: '', animal: '', archived: 'show' };
        setFilters(cleared);
        setAppliedFilters(cleared);
        setFilterModalOpen(false);
    };

    const availableYears = useMemo(() => [...new Set(groups.items.map(g => g.meta.year).filter(Boolean))].sort((a, b) => b - a), [groups.items]);

    const filteredGroups = useMemo(() => {
        return groups.items.filter(group => {
            let isVisible = true;
            if (appliedFilters.archived === 'hide') {
                isVisible = !group.meta.archived;
            } else if (appliedFilters.archived === 'only') {
                isVisible = !!group.meta.archived;
            }

            const yearMatch = !appliedFilters.year || (group.meta.year && group.meta.year.toString() === appliedFilters.year);
            const levelMatch = !appliedFilters.level || (group.meta.level && group.meta.level.toString() === appliedFilters.level);
            const lessonTypeMatch = !appliedFilters.lesson_type || (group.lm_lesson_type && group.lm_lesson_type.includes(parseInt(appliedFilters.lesson_type, 10)));
            const campMatch = !appliedFilters.camp || (group.lm_camp && group.lm_camp.includes(parseInt(appliedFilters.camp, 10)));
            const animalMatch = !appliedFilters.animal || (group.lm_animal && group.lm_animal.includes(parseInt(appliedFilters.animal, 10)));
            const instructorMatch = appliedFilters.instructor.length === 0 || (group.meta.instructor && appliedFilters.instructor.some(instId => group.meta.instructor.includes(parseInt(instId, 10))));
            const daysMatch = appliedFilters.days.length === 0 || (group.meta.days && appliedFilters.days.every(day => group.meta.days.includes(day)));

            return isVisible && yearMatch && levelMatch && lessonTypeMatch && campMatch && animalMatch && instructorMatch && daysMatch;
        });
    }, [groups.items, appliedFilters]);

    console.log('Groups after filtering:', filteredGroups);

    // Async search handler for the swimmers multiselect
    const handleSwimmerSearch = useCallback(async (searchTerm) => {
        // Reset pagination when search term changes
        setCurrentSwimmerSearchTerm(searchTerm);
        setSwimmerSearchPage(1);
        setIsSwimmerSearchLoading(true);
        
        const response = await apiFetch({ path: `/lm/v1/search-swimmers?search=${encodeURIComponent(searchTerm || '')}&page=1` });
        setSearchedSwimmers(response.swimmers || []);
        setSwimmerHasMore(response.has_more || false);
        setIsSwimmerSearchLoading(false);
    }, []);

    // Load more swimmers for pagination
    const handleLoadMoreSwimmers = useCallback(async () => {
        if (isSwimmerSearchLoading || !swimmerHasMore) return;
        
        const nextPage = swimmerSearchPage + 1;
        setIsSwimmerSearchLoading(true);
        
        const response = await apiFetch({ 
            path: `/lm/v1/search-swimmers?search=${encodeURIComponent(currentSwimmerSearchTerm || '')}&page=${nextPage}` 
        });
        
        setSearchedSwimmers(prev => [...prev, ...(response.swimmers || [])]);
        setSwimmerHasMore(response.has_more || false);
        setSwimmerSearchPage(nextPage);
        setIsSwimmerSearchLoading(false);
    }, [isSwimmerSearchLoading, swimmerHasMore, swimmerSearchPage, currentSwimmerSearchTerm]);

    // Async search handler for the instructors multiselect
    const handleInstructorSearch = useCallback(async (searchTerm) => {
        if (!searchTerm || searchTerm.trim() === '') {
            // Show the initial list of users from context when no search term
            setSearchedInstructors(users.map(u => ({ id: u.id, name: u.display_name })));
            return;
        }
        setIsInstructorSearchLoading(true);
        const data = await apiClient.searchUsers(searchTerm);
        setSearchedInstructors(data || []);
        setIsInstructorSearchLoading(false);
    }, [users]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Group List */}
            <div className={`${
                (selectedGroup || isCreating || isLoadingDetails) ? 'hidden md:block' : 'block'
            } lg:col-span-1 xl:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min`}>
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Groups</h2>
                    <button onClick={handleNewGroup} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">+ New</button>
                </div>

                <div className="flex gap-2 mb-4">
                    <label htmlFor="group-search" className="sr-only">Search Groups</label>
                    <input id="group-search" type="text" placeholder="Search groups..." value={groupSearchTerm} onChange={e => setGroupSearchTerm(e.target.value)} className="flex-grow w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <button onClick={() => { setFilters(appliedFilters); setFilterModalOpen(true); }} className="p-2 border border-slate-300 rounded-md shadow-sm hover:bg-slate-100">
                        <svg className="w-5 h-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
                    </button>
                </div>

                <ul className="space-y-3 overflow-y-auto h-[600px]">
                    {filteredGroups.map(group => (
                        <li key={group.id}>
                            <button
                                onClick={() => handleSelectGroup(group)}
                                className={`w-full text-left p-3 rounded-xl transition-all duration-150 ${selectedGroup && selectedGroup.id === group.id ? 'bg-indigo-50 border-indigo-400 border shadow-md' : 'bg-white hover:bg-slate-100/[.70] border border-slate-200 shadow-sm'}`}
                            >
                                <h3 className="font-bold text-slate-800">{decodeEntities(group.title.rendered)}</h3>
                                {group.meta.level && (
                                    <p className="text-sm text-slate-600">Level: {decodeEntities(levels.find(l => l.id === group.meta.level)?.title?.rendered || 'N/A')}</p>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
                {hasMoreGroups && (
                    <button
                        onClick={loadMoreGroups}
                        disabled={isGroupsLoading}
                        className="w-full p-2 mt-2 text-center text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                    >
                        {isGroupsLoading ? 'Loading...' : 'Load More'}
                    </button>
                )}
            </div>

            {/* Right Column: Group Details */}
            <div className={`${(selectedGroup || isCreating || isLoadingDetails) ? 'col-span-1 md:col-span-2' : 'hidden md:block'}`}>
                {isLoadingDetails ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg min-h-[400px]">
                        <button
                            onClick={() => {
                                setIsLoadingDetails(false);
                                setPendingGroupSelection(null);
                            }}
                            className="md:hidden mb-4 flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back to list
                        </button>
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="text-slate-600 font-medium">Loading group details...</p>
                            </div>
                        </div>
                    </div>
                ) : (selectedGroup || isCreating) ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg" key={selectedGroup ? selectedGroup.id : 'new'}>
                        {isReadOnly && (
                            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span className="font-semibold text-yellow-800">Read-only: {lockedByUser} is currently editing this group</span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleCloseGroup}
                            className="md:hidden mb-4 flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back to list
                        </button>
                        <div className="flex flex-wrap justify-between items-start mb-6 border-b pb-3 gap-4">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-slate-900">{isCreating ? 'Create New Group' : `Details for: ${decodeEntities(selectedGroup.title || '')}`}</h2>
                                {!isCreating && selectedGroup.modified && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Last modified: {new Date(selectedGroup.modified).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            {!isReadOnly && (
                                <button onClick={handleSaveGroup} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                    {isSaving ? 'Saving...' : isCreating ? 'Create Group' : 'Save Changes'}
                                </button>
                            )}
                        </div>

                        {/* Form Fields */}
                        <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label htmlFor="group-title" className="block text-sm font-medium text-slate-700">Group Name</label>
                                <input id="group-title" type="text" placeholder="Group Name" value={decodeEntities(selectedGroup.title || '')} onChange={e => handleGroupChange('title', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed" />
                            </div>
                            <div>
                                <label htmlFor="group-time" className="block text-sm font-medium text-slate-700">Time</label>
                                <input id="group-time" type="text" placeholder="e.g., 9:00am" value={selectedGroup.meta.group_time || ''} onChange={e => handleGroupChange('group_time', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed" />
                            </div>
                            <div>
                                <label htmlFor="group-year" className="block text-sm font-medium text-slate-700">Year</label>
                                <input id="group-year" type="number" placeholder={new Date().getFullYear()} value={selectedGroup.meta.year || ''} onChange={e => handleGroupChange('year', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label htmlFor="group-lesson-type" className="block text-sm font-medium text-slate-700">Lesson Type</label>
                                <select id="group-lesson-type" value={(selectedGroup.lm_lesson_type && selectedGroup.lm_lesson_type[0]) || ''} onChange={e => handleGroupChange('lm_lesson_type', e.target.value ? [parseInt(e.target.value, 10)] : [])} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="">-- Select Type --</option>
                                    {lessonTypes.map(type => <option key={type.id} value={type.id}>{decodeEntities(type.name)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="group-camp" className="block text-sm font-medium text-slate-700">Camp</label>
                                <select id="group-camp" value={(selectedGroup.lm_camp && selectedGroup.lm_camp[0]) || ''} onChange={e => handleGroupChange('lm_camp', e.target.value ? [parseInt(e.target.value, 10)] : [])} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="">-- Select Camp --</option>
                                    {camps.map(camp => <option key={camp.id} value={camp.id}>{decodeEntities(camp.name)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="group-level" className="block text-sm font-medium text-slate-700">Level</label>
                                <select id="group-level" value={selectedGroup.meta.level || ''} onChange={e => handleGroupChange('level', e.target.value ? parseInt(e.target.value, 10) : null, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="">-- Select Level --</option>
                                    {levels.map(level => <option key={level.id} value={level.id}>{decodeEntities(level.title.rendered)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="group-animal" className="block text-sm font-medium text-slate-700">Animal</label>
                                <select id="group-animal" value={(selectedGroup.lm_animal && selectedGroup.lm_animal[0]) || ''} onChange={e => handleGroupChange('lm_animal', e.target.value ? [parseInt(e.target.value, 10)] : [])} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="">-- Select Animal --</option>
                                    {animals.map(animal => <option key={animal.id} value={animal.id}>{decodeEntities(animal.name)}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700">Days of the Week</label>
                                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                                    {weekDays.map(day => (
                                        <label key={day} htmlFor={`day-${day}`} className="flex items-center gap-2">
                                            <input type="checkbox" id={`day-${day}`} value={day} checked={(selectedGroup.meta.days || []).includes(day)} onChange={e => {
                                                const currentDays = selectedGroup.meta.days || [];
                                                const newDays = e.target.checked ? [...currentDays, day] : currentDays.filter(d => d !== day);
                                                handleGroupChange('days', newDays, true);
                                            }} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            {day}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="group-dates" className="block text-sm font-medium text-slate-700">Dates Offered</label>
                                <textarea id="group-dates" placeholder="One date per line, e.g., 2024-07-04" value={(selectedGroup.meta.dates_offered || []).join('\n')} onChange={e => handleGroupChange('dates_offered', e.target.value.split('\n'), true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="4"></textarea>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="group-notes" className="block text-sm font-medium text-slate-700">Notes</label>
                                <textarea
                                    id="group-notes"
                                    value={selectedGroup.meta.notes || ''}
                                    onChange={e => handleGroupChange('notes', e.target.value, true)}
                                    placeholder="Add any internal notes for this group..."
                                    rows={4}
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div className="md:col-span-2">
                                <MultiSelectSearch 
                                    label="Instructors"
                                    options={searchedInstructors}
                                    selectedValues={(selectedGroup.meta.instructor || []).map(String)} 
                                    onChange={ids => handleGroupChange('instructor', ids.map(id => parseInt(id, 10)), true)} 
                                    placeholder="Select instructors..." 
                                    itemLabelKey="name"
                                    onSearchChange={handleInstructorSearch}
                                    isLoading={isInstructorSearchLoading}
                                    itemValueKey="id" 
                                    selectedItems={selectedInstructorDetails}
                                    disabled={isReadOnly} />
                            </div>
                            <div className="md:col-span-2">
                                <MultiSelectSearch 
                                    label="Swimmers" 
                                    options={searchedSwimmers} 
                                    selectedValues={(selectedGroup.meta.swimmers || []).map(String)} 
                                    onChange={ids => handleGroupChange('swimmers', ids.map(id => parseInt(id, 10)), true)} 
                                    placeholder="Search for swimmers to add..." itemLabelKey="title.rendered" itemValueKey="id"
                                    onSearchChange={handleSwimmerSearch} 
                                    isLoading={isSwimmerSearchLoading}
                                    onLoadMore={handleLoadMoreSwimmers}
                                    hasMore={swimmerHasMore}
                                    selectedItems={selectedSwimmerDetails}
                                    disabled={isReadOnly}
                                    renderOptionLabel={(swimmer) => {
                                        const level = levels.find(l => l.id === swimmer.meta.current_level);
                                        return (<div className="flex justify-between items-center">
                                            <span className="font-medium">{decodeEntities(swimmer.title.rendered)}</span>
                                            {level && <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{decodeEntities(level.title.rendered)}</span>}
                                        </div>);
                                    }}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="group-archived" className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="group-archived"
                                        checked={!!selectedGroup.meta.archived}
                                        onChange={e => handleGroupChange('archived', e.target.checked, true)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Archived</span>
                                </label>
                            </div>
                        </fieldset>

                        {/* Drag and Drop Section */}
                        {selectedGroup && selectedGroup.meta.swimmers && selectedGroup.meta.swimmers.length > 0 && (
                            <DragDropContext onDragEnd={isReadOnly ? () => {} : onDragEnd}>
                                <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Group Information:</h3>
                                    {(selectedGroup.meta.instructor || []).map(instructorId => {
                                        const instructor = selectedInstructorDetails.find(u => u.id === instructorId);
                                        const swimmersInLane = (selectedGroup.meta.swimmer_grouping && selectedGroup.meta.swimmer_grouping[instructorId]) || [];
                                        return (
                                            <div key={instructorId} className="mb-4">
                                                <h4 className="font-semibold bg-slate-100 p-2 rounded-t-lg border-b">{instructor ? instructor.name : 'Unassigned'}</h4>
                                                <Droppable droppableId={String(instructorId)} isDropDisabled={isReadOnly}>
                                                    {(provided) => (
                                                        <div {...provided.droppableProps} ref={provided.innerRef} className="bg-white rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[50px]">
                                                            {swimmersInLane.map((swimmerId, index) => { 
                                                                const swimmer = selectedSwimmerDetails.find(s => s.id === swimmerId) || { id: swimmerId, title: { rendered: `Swimmer #${swimmerId}` }, meta: {} };
                                                                if (!swimmer) return <div key={swimmerId} className="p-2 text-sm text-red-500">Swimmer #{swimmerId} not found.</div>;
                                                                const level = levels.find(l => l.id === swimmer.meta.current_level);
                                                                return (
                                                                    <Draggable key={swimmer.id} draggableId={String(swimmer.id)} index={index} isDragDisabled={isReadOnly}>
                                                                        {(provided) => (
                                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="p-2 bg-slate-50 rounded-md shadow-sm">
                                                                                <div className="grid grid-cols-3 gap-4 items-center">
                                                                                    <div className="col-span-1">
                                                                                        <button type="button" onClick={() => handleOpenSwimmerModal(swimmer.id)} className="text-indigo-600 hover:text-indigo-900 font-medium text-sm text-left block">
                                                                                            {decodeEntities(swimmer.title.rendered)}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="col-span-1 text-sm text-slate-500">{getAge(swimmer.meta.date_of_birth)}</div>
                                                                                    <div className="col-span-1 text-sm text-slate-500">{level ? decodeEntities(level.title.rendered) : 'N/A'}</div>
                                                                                </div>
                                                                                {swimmer.meta.notes && (
                                                                                    <div className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-200">
                                                                                        <strong className="font-semibold">Notes:</strong> {swimmer.meta.notes}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                );
                                                            })}
                                                            {provided.placeholder}
                                                            {swimmersInLane.length === 0 && <p className="text-sm text-slate-400 p-2 text-center">Drag swimmers here</p>}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            </DragDropContext>
                        )}

                        <div className="mt-8 flex justify-between items-center gap-4">
                            {!isCreating && selectedGroup && !isReadOnly && (
                                <button onClick={() => handleDeleteGroup(selectedGroup.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Group</button>
                            )}
                            <div className="flex items-center gap-4 ml-auto">
                                <button type="button" onClick={handleCloseGroup} className="text-sm font-semibold text-slate-600 hover:text-slate-800">Close</button>
                                {!isReadOnly && (
                                    <button onClick={handleSaveGroup} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                        {isSaving ? 'Saving...' : isCreating ? 'Create Group' : 'Save Changes'}
                                    </button>
                                )}
                                {saveMessage ? <span className="text-green-600 font-semibold">{saveMessage}</span> : null}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg text-center text-slate-500">
                        <p>Select a group to view details or create a new one.</p>
                    </div>
                )}

                {/* Swimmer Edit Modal with Evaluation Slide-over */}
                <Modal 
                    isOpen={!!editingSwimmer} 
                    onClose={() => {
                        if (inlineEvaluation) {
                            // If evaluation form is open, close it first
                            setInlineEvaluation(null);
                        } else {
                            setEditingSwimmer(null);
                        }
                    }} 
                    title={inlineEvaluation 
                        ? 'New Evaluation' 
                        : (editingSwimmer ? `Editing: ${decodeEntities(editingSwimmer.title)}` : '')
                    }
                >
                    {editingSwimmer && (
                        <div className="relative overflow-hidden">
                            {/* Swimmer Form - slides out when evaluation form opens */}
                            <div 
                                className={`transition-all duration-300 ease-in-out ${
                                    inlineEvaluation 
                                        ? 'opacity-0 -translate-x-full absolute inset-0' 
                                        : 'opacity-100 translate-x-0'
                                }`}
                            >
                                <div className="overflow-y-auto max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-140px)]">
                                    <SwimmerForm
                                        swimmer={editingSwimmer}
                                        onSwimmerChange={handleSwimmerFormChange}
                                        evaluations={editingSwimmerEvaluations}
                                        isLoadingEvals={isLoadingEditingSwimmerEvals}
                                        levels={levels}
                                        skills={skills}
                                        onSave={handleSaveSwimmer}
                                        onCancel={() => setEditingSwimmer(null)}
                                        isSaving={isSaving}
                                        onRequestNewEvaluation={handleStartInlineEvaluation}
                                    />
                                </div>
                            </div>
                            
                            {/* Evaluation Form - slides in when creating new evaluation */}
                            <div 
                                className={`transition-all duration-300 ease-in-out ${
                                    inlineEvaluation 
                                        ? 'opacity-100 translate-x-0' 
                                        : 'opacity-0 translate-x-full absolute inset-0 pointer-events-none'
                                }`}
                            >
                                {inlineEvaluation && (
                                    <div className="overflow-y-auto max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-140px)]">
                                        {/* Back button */}
                                        <button
                                            type="button"
                                            onClick={handleCancelInlineEvaluation}
                                            className="mb-4 flex items-center text-sm font-semibold text-violet-600 hover:text-violet-800"
                                        >
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            Back to {decodeEntities(editingSwimmer.title)}
                                        </button>
                                        
                                        <p className="text-sm text-slate-600 mb-4">
                                            Creating evaluation for: <span className="font-semibold">{decodeEntities(editingSwimmer.title)}</span>
                                        </p>
                                        
                                        <EvaluationForm
                                            evaluation={inlineEvaluation}
                                            onEvalChange={handleInlineEvalChange}
                                            onSave={handleSaveInlineEvaluation}
                                            onCancel={handleCancelInlineEvaluation}
                                            isSaving={isEvaluationSaving}
                                            levels={levels}
                                            showSwimmerField={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Filter Modal */}
                <Modal isOpen={isFilterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Groups">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="filter-year" className="block text-sm font-medium text-slate-700">Year</label>
                            <select id="filter-year" value={filters.year} onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="">All Years</option>
                                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-level" className="block text-sm font-medium text-slate-700">Level</label>
                            <select id="filter-level" value={filters.level} onChange={e => setFilters(prev => ({ ...prev, level: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="">All Levels</option>
                                {levels.map(level => <option key={level.id} value={level.id}>{decodeEntities(level.title.rendered)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-lesson-type" className="block text-sm font-medium text-slate-700">Lesson Type</label>
                            <select id="filter-lesson-type" value={filters.lesson_type} onChange={e => setFilters(prev => ({ ...prev, lesson_type: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="">All Types</option>
                                {lessonTypes.map(type => <option key={type.id} value={type.id}>{decodeEntities(type.name)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-camp" className="block text-sm font-medium text-slate-700">Camp</label>
                            <select id="filter-camp" value={filters.camp} onChange={e => setFilters(prev => ({ ...prev, camp: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="">All Camps</option>
                                {camps.map(camp => <option key={camp.id} value={camp.id}>{decodeEntities(camp.name)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-animal" className="block text-sm font-medium text-slate-700">Animal</label>
                            <select id="filter-animal" value={filters.animal} onChange={e => setFilters(prev => ({ ...prev, animal: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="">All Animals</option>
                                {animals.map(animal => <option key={animal.id} value={animal.id}>{decodeEntities(animal.name)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-archived" className="block text-sm font-medium text-slate-700">Archived</label>
                            <select id="filter-archived" value={filters.archived} onChange={e => setFilters(prev => ({ ...prev, archived: e.target.value }))} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="show">Show All</option>
                                <option value="hide">Hide Archived</option>
                                <option value="only">Only Archived</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Days of the Week</label>
                            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                                {weekDays.map(day => (
                                    <label key={day} htmlFor={`filter-day-${day}`} className="flex items-center gap-2">
                                        <input type="checkbox" id={`filter-day-${day}`} value={day} checked={filters.days.includes(day)} onChange={e => { const newDays = e.target.checked ? [...filters.days, day] : filters.days.filter(d => d !== day); setFilters(prev => ({ ...prev, days: newDays })); }} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        {day}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <MultiSelectSearch label="Instructors" options={users} selectedValues={filters.instructor} onChange={ids => setFilters(prev => ({ ...prev, instructor: ids }))} placeholder="Filter by instructors..." itemLabelKey="name" itemValueKey="id" />
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-4">
                        <button onClick={clearFilters} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Clear Filters</button>
                        <button onClick={applyFilters} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Apply Filters</button>
                    </div>
                </Modal>
            </div>

            <LockConfirmModal isOpen={lockConfirmModalOpen} lockedByUser={lockedByUser} onTakeover={handleLockTakeover} onReadOnly={handleLockReadOnly} onCancel={handleLockCancel} />
        </div>
    );
};

export default GroupManager;