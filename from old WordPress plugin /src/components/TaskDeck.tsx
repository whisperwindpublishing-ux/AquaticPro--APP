import React, { useState, useEffect } from 'react';
import { TaskDeck as TaskDeckType, TaskList, TaskCard, UserProfile, TaskRole, TaskLocation } from '@/types';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineViewColumns, HiOutlineTableCells } from 'react-icons/hi2';
import TaskCardModal from './TaskCardModal';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';
import { getCachedUsers } from '@/services/userCache';
import { getLocations } from '@/services/api';

// View mode type
type ViewMode = 'board' | 'grid';

// Simple user type for assignment dropdown
interface SimpleUser {
    id: number;
    firstName: string | undefined;
    lastName: string | undefined;
    email: string | undefined;
    displayName: string;
}

interface TaskDeckProps {
    currentUser: UserProfile;
}

interface DragItem {
    cardId: number;
    listId: number;
    sortOrder: number;
}

// Background sync status for non-blocking feedback
type SyncStatus = 'idle' | 'syncing' | 'error';

// Card label colors (Trello-style)
const LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'red': { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' },
    'orange': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
    'yellow': { bg: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-500' },
    'green': { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
    'blue': { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
    'purple': { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
    'pink': { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
};

// Map category to color
const getCategoryColor = (category: string): { bg: string; text: string; border: string } => {
    const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = Object.values(LABEL_COLORS);
    return colors[hash % colors.length];
};

const TaskDeck: React.FC<TaskDeckProps> = ({ currentUser }) => {
    const [decks, setDecks] = useState<TaskDeckType[]>([]);
    const [selectedDeck, setSelectedDeck] = useState<TaskDeckType | null>(null);
    const [lists, setLists] = useState<TaskList[]>([]);
    const [cardsByList, setCardsByList] = useState<Record<number, TaskCard[]>>({});
    const [loading, setLoading] = useState(true);
    const [deckLoading, setDeckLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [collapsedCompletedLists, setCollapsedCompletedLists] = useState<Set<number>>(new Set());
    // Board view - track how many completed cards to show per list (lazy loading)
    const [boardCompletedVisibleCount, setBoardCompletedVisibleCount] = useState<Record<number, number>>({});
    
    // User permissions for TaskDeck
    const [_userPermissions, setUserPermissions] = useState<{
        canView: boolean;
        canViewOnlyAssigned: boolean;
        canManageAllPrimaryCards: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canModerateAll: boolean;
        canManagePrimaryDeck: boolean;
        canCreatePublicDecks: boolean;
    }>({ canView: true, canViewOnlyAssigned: false, canManageAllPrimaryCards: false, canCreate: false, canEdit: false, canDelete: false, canModerateAll: false, canManagePrimaryDeck: false, canCreatePublicDecks: false });
    
    const [selectedCard, setSelectedCard] = useState<TaskCard | null>(null);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    
    const [newDeckName, setNewDeckName] = useState('');
    const [newDeckIsPublic, setNewDeckIsPublic] = useState(false);
    const [showNewDeckForm, setShowNewDeckForm] = useState(false);
    
    // Edit deck modal state
    const [showEditDeckModal, setShowEditDeckModal] = useState(false);
    const [editDeckName, setEditDeckName] = useState('');
    const [editDeckIsPublic, setEditDeckIsPublic] = useState(false);
    const [editDeckIsPrimary, setEditDeckIsPrimary] = useState(false);
    
    const [newListName, setNewListName] = useState('');
    const [showNewListForm, setShowNewListForm] = useState(false);
    const [editingListId, setEditingListId] = useState<number | null>(null);
    const [editingListName, setEditingListName] = useState('');
    
    // Quick add card state
    const [quickAddListId, setQuickAddListId] = useState<number | null>(null);
    const [quickAddTitle, setQuickAddTitle] = useState('');
    
    const [draggedCard, setDraggedCard] = useState<DragItem | null>(null);
    const [dragOverList, setDragOverList] = useState<number | null>(null);
    const [dragOverCardId, setDragOverCardId] = useState<number | null>(null);
    const [draggedList, setDraggedList] = useState<TaskList | null>(null);
    
    // Filters
    const [showMyCardsOnly, setShowMyCardsOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterByUser, setFilterByUser] = useState<number | null>(null);
    const [filterByRole, setFilterByRole] = useState<number | null>(null);
    
    // Grid view sorting/grouping
    const [gridGroupBy, setGridGroupBy] = useState<'list' | 'assignee' | 'role'>('list');
    
    // Grid view completed cards - hidden by default, lazy loaded
    const [showCompletedInGrid, setShowCompletedInGrid] = useState(false);
    const [completedCardsVisibleCount, setCompletedCardsVisibleCount] = useState(25);
    
    // View mode - board (kanban) or grid (list view)
    const [viewMode, setViewMode] = useState<ViewMode>('board');
    
    // Pre-fetched dropdown data for modal
    const [dropdownUsers, setDropdownUsers] = useState<SimpleUser[]>([]);
    const [dropdownRoles, setDropdownRoles] = useState<TaskRole[]>([]);
    const [dropdownLocations, setDropdownLocations] = useState<TaskLocation[]>([]);
    const [dropdownCategories, setDropdownCategories] = useState<string[]>([]);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    const isAdmin = window.mentorshipPlatformData?.is_admin;

    // Check if this is the primary deck
    const isPrimaryDeck = selectedDeck ? (selectedDeck as any).is_primary === 1 : false;

    // Check if user can edit current deck (general deck-level editing like lists, deck settings)
    // On primary deck, only admins can edit the deck structure (lists, deck settings)
    const canEditCurrentDeck = selectedDeck 
        ? (isPrimaryDeck 
            ? isAdmin // Only admins can manage primary deck structure
            : (selectedDeck as any).user_can_edit || selectedDeck.created_by === currentUser.id)
        : false;
    
    // Check if user can create cards on this deck
    // On primary deck, users with canCreate permission can add cards
    const canCreateCards = selectedDeck
        ? (isPrimaryDeck
            ? _userPermissions.canCreate || isAdmin
            : canEditCurrentDeck)
        : false;
    
    // Check if user can delete the deck (never on primary deck, except admins)
    const canDeleteDeck = selectedDeck
        ? (isPrimaryDeck
            ? false // Never allow deleting primary deck from UI
            : selectedDeck.created_by === currentUser.id || (selectedDeck as any).user_can_delete)
        : false;

    // Fetch decks, permissions, and dropdown data on mount
    useEffect(() => {
        fetchUserPermissions();
        fetchDecks();
        fetchAllDropdownData();
    }, []);

    const fetchUserPermissions = async () => {
        // Visitor Mode Bypass
        if (window.mentorshipPlatformData?.visitor_mode) {
            setUserPermissions({
                canView: true,
                canViewOnlyAssigned: false,
                canManageAllPrimaryCards: false,
                canCreate: true, // Allow form view
                canEdit: false,
                canDelete: false,
                canModerateAll: false,
                canManagePrimaryDeck: false,
                canCreatePublicDecks: false
            });
            return;
        }

        try {
            const response = await fetch(`${apiUrl}/taskdecks/my-permissions`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const perms = await response.json();
                setUserPermissions(perms);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        }
    };

    // Fetch lists and cards when deck is selected
    useEffect(() => {
        if (selectedDeck) {
            fetchListsAndCards(selectedDeck.deck_id);
        }
    }, [selectedDeck?.deck_id]);

    const fetchDecks = async () => {
        // Visitor Mode Bypass
        if (window.mentorshipPlatformData?.visitor_mode) {
             setDecks([]);
             setLoading(false);
             return;
        }

        try {
            const response = await fetch(`${apiUrl}/taskdecks`, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });
            
            if (!response.ok) throw new Error('Failed to fetch decks');
            
            const data = await response.json();
            setDecks(data);
            
            // Auto-select first deck if available
            if (data.length > 0 && !selectedDeck) {
                setSelectedDeck(data[0]);
            }
            
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load decks');
            setLoading(false);
        }
    };

    // Pre-fetch all dropdown data for instant modal loading
    const fetchAllDropdownData = async () => {
        try {
            // Fetch all dropdown data in parallel - use centralized cache for users
            const [usersData, rolesResponse, locationsData, categoriesResponse] = await Promise.all([
                getCachedUsers().catch(() => []),
                fetch(`${apiUrl}/taskdecks/roles`, { headers: { 'X-WP-Nonce': nonce } }).catch(() => null),
                getLocations().catch(() => []),
                fetch(`${apiUrl}/taskdecks/categories`, { headers: { 'X-WP-Nonce': nonce } }).catch(() => null),
            ]);

            // Process users - already sorted by centralized cache
            const formattedUsers: SimpleUser[] = usersData.map((user) => ({
                id: Number(user.user_id),  // Ensure number for comparison
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.user_email,
                displayName: user.display_name,
            }));
            setDropdownUsers(formattedUsers);

            // Process roles - ensure role_id is a number for comparison
            if (rolesResponse && rolesResponse.ok) {
                const roles = await rolesResponse.json();
                const normalizedRoles = roles.map((role: any) => ({
                    ...role,
                    role_id: Number(role.role_id),
                    tier: role.tier ? Number(role.tier) : null,
                }));
                setDropdownRoles(normalizedRoles);
            }

            // Process locations
            const activeLocations: TaskLocation[] = (locationsData || [])
                .filter((loc: any) => loc.is_active)
                .map((loc: any) => ({
                    location_id: loc.id,
                    location_name: loc.name,
                }));
            setDropdownLocations(activeLocations);

            // Process categories
            if (categoriesResponse && categoriesResponse.ok) {
                const categories = await categoriesResponse.json();
                setDropdownCategories(categories);
            }
        } catch (err) {
            console.error('Failed to pre-fetch dropdown data:', err);
        }
    };

    const fetchListsAndCards = async (deckId: number) => {
        setDeckLoading(true);
        setError(null);
        
        try {
            // Try batch endpoint first for fast loading
            const batchResponse = await fetch(`${apiUrl}/taskdecks/${deckId}/batch`, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });
            
            if (batchResponse.ok) {
                const batchData = await batchResponse.json();
                
                // Set lists directly from batch response
                const listsFromBatch = batchData.lists || [];
                setLists(listsFromBatch);
                
                // Set cards grouped by list - batch endpoint returns them pre-grouped
                const cardsData: Record<number, TaskCard[]> = batchData.cards_by_list || {};
                
                // Ensure all lists have an entry (even if empty)
                listsFromBatch.forEach((list: TaskList) => {
                    if (!cardsData[list.list_id]) {
                        cardsData[list.list_id] = [];
                    }
                });
                
                setCardsByList(cardsData);
                
                // Initialize all completed sections as collapsed (hidden) by default
                setCollapsedCompletedLists(new Set(listsFromBatch.map((list: TaskList) => list.list_id)));
            } else {
                // Fallback to individual requests if batch fails
                console.warn('Batch endpoint failed, falling back to individual requests');
                await fetchListsAndCardsLegacy(deckId);
            }
            
            setDeckLoading(false);
        } catch (err) {
            // Fallback to legacy method on any error
            console.warn('Batch load error, trying legacy method:', err);
            try {
                await fetchListsAndCardsLegacy(deckId);
                setDeckLoading(false);
            } catch (legacyErr) {
                setDeckLoading(false);
                setError(legacyErr instanceof Error ? legacyErr.message : 'Failed to load lists and cards');
            }
        }
    };

    // Legacy method - loads lists then cards for each list separately
    const fetchListsAndCardsLegacy = async (deckId: number) => {
        // Fetch lists
        const listsResponse = await fetch(`${apiUrl}/taskdecks/${deckId}/lists`, {
            headers: { 'X-WP-Nonce': nonce },
        });
        
        if (!listsResponse.ok) throw new Error('Failed to fetch lists');
        
        const listsData = await listsResponse.json();
        setLists(listsData);
        
        // Fetch cards for each list in parallel
        const cardsData: Record<number, TaskCard[]> = {};
        
        await Promise.all(
            listsData.map(async (list: TaskList) => {
                const cardsResponse = await fetch(`${apiUrl}/tasklists/${list.list_id}/cards`, {
                    headers: { 'X-WP-Nonce': nonce },
                });
                
                if (cardsResponse.ok) {
                    const cards = await cardsResponse.json();
                    cardsData[list.list_id] = cards;
                }
            })
        );
        
        setCardsByList(cardsData);
        
        // Initialize all completed sections as collapsed (hidden) by default
        setCollapsedCompletedLists(new Set(listsData.map((list: TaskList) => list.list_id)));
    };

    const createDeck = async () => {
        if (!newDeckName.trim()) return;

        // Create temp deck with negative ID
        const tempDeckId = -Date.now();
        const newDeck: TaskDeckType = {
            deck_id: tempDeckId,
            deck_name: newDeckName,
            is_public: newDeckIsPublic ? 1 : 0,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_archived: 0,
        };
        
        // Optimistic update
        setDecks(prev => [...prev, newDeck]);
        setSelectedDeck(newDeck);
        setLists([]);
        setCardsByList({});
        setNewDeckName('');
        setNewDeckIsPublic(false);
        setShowNewDeckForm(false);
        
        // Sync to server in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskdecks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    deck_name: newDeck.deck_name,
                    is_public: newDeck.is_public,
                }),
            });

            if (!response.ok) throw new Error('Failed to create deck');
            
            const createdDeck = await response.json();
            
            // Replace temp deck with real one
            setDecks(prev => prev.map(d => 
                d.deck_id === tempDeckId ? { ...createdDeck } : d
            ));
            
            // Update selected deck if it was the temp one
            setSelectedDeck(prev => 
                prev?.deck_id === tempDeckId ? createdDeck : prev
            );
            
            setSyncStatus('idle');
        } catch (err) {
            // Remove temp deck on error
            setDecks(prev => prev.filter(d => d.deck_id !== tempDeckId));
            setSelectedDeck(decks[0] || null);
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to create deck');
        }
    };

    const updateDeck = async () => {
        if (!selectedDeck || !editDeckName.trim()) return;
        
        const oldDeck = { ...selectedDeck };
        const currentIsPrimary = (selectedDeck as any).is_primary === 1;
        const primaryChanged = editDeckIsPrimary !== currentIsPrimary;
        
        // Optimistic update
        const updatedDeck = {
            ...selectedDeck,
            deck_name: editDeckName,
            is_public: editDeckIsPublic || editDeckIsPrimary ? 1 : 0, // Primary decks are always public
        };
        
        setDecks(prev => prev.map(d => 
            d.deck_id === selectedDeck.deck_id ? updatedDeck : d
        ));
        setSelectedDeck(updatedDeck);
        setShowEditDeckModal(false);
        
        // Sync to server
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskdecks/${selectedDeck.deck_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    deck_name: editDeckName,
                    is_public: editDeckIsPublic || editDeckIsPrimary ? 1 : 0,
                }),
            });

            if (!response.ok) throw new Error('Failed to update deck');
            
            // Handle primary deck change separately
            // Check both isAdmin (WP admin) and role-based permission
            if (primaryChanged && (isAdmin || _userPermissions.canManagePrimaryDeck)) {
                await setPrimaryDeck(selectedDeck.deck_id, editDeckIsPrimary);
            } else {
                setSyncStatus('idle');
            }
        } catch (err) {
            // Revert on error
            setDecks(prev => prev.map(d => 
                d.deck_id === selectedDeck.deck_id ? oldDeck : d
            ));
            setSelectedDeck(oldDeck);
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to update deck');
        }
    };

    const setPrimaryDeck = async (deckId: number, isPrimary: boolean) => {
        // Optimistic update
        setDecks(prev => prev.map(d => ({
            ...d,
            is_primary: d.deck_id === deckId && isPrimary ? 1 : (isPrimary ? 0 : (d as any).is_primary)
        } as TaskDeckType)));
        
        if (selectedDeck?.deck_id === deckId) {
            setSelectedDeck(prev => prev ? { ...prev, is_primary: isPrimary ? 1 : 0 } as TaskDeckType : null);
        }
        
        setShowEditDeckModal(false);
        
        // Sync to server
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskdecks/${deckId}/set-primary`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ is_primary: isPrimary ? 1 : 0 }),
            });

            if (!response.ok) throw new Error('Failed to update primary deck status');
            
            // Reload decks to get correct sorting (primary first)
            const decksResponse = await fetch(`${apiUrl}/taskdecks`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (decksResponse.ok) {
                const updatedDecks = await decksResponse.json();
                setDecks(updatedDecks);
                // Update selectedDeck to the matching deck from the updated list
                if (selectedDeck) {
                    const updatedSelectedDeck = updatedDecks.find((d: TaskDeckType) => d.deck_id === selectedDeck.deck_id);
                    if (updatedSelectedDeck) {
                        setSelectedDeck(updatedSelectedDeck);
                    }
                }
            }
            
            setSyncStatus('idle');
        } catch (err) {
            // Reload decks to restore correct state
            const decksResponse = await fetch(`${apiUrl}/taskdecks`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (decksResponse.ok) {
                const updatedDecks = await decksResponse.json();
                setDecks(updatedDecks);
                // Update selectedDeck to the matching deck from the restored list
                if (selectedDeck) {
                    const restoredSelectedDeck = updatedDecks.find((d: TaskDeckType) => d.deck_id === selectedDeck.deck_id);
                    if (restoredSelectedDeck) {
                        setSelectedDeck(restoredSelectedDeck);
                    }
                }
            }
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to update primary deck status');
        }
    };

    const deleteDeck = async () => {
        if (!selectedDeck) return;
        
        if (!confirm(`Delete deck "${selectedDeck.deck_name}"? This will delete all lists and cards in this deck.`)) {
            return;
        }
        
        const deletedDeck = selectedDeck;
        const deletedDeckIndex = decks.findIndex(d => d.deck_id === selectedDeck.deck_id);
        
        // Optimistic update - remove deck and select another
        setDecks(prev => prev.filter(d => d.deck_id !== selectedDeck.deck_id));
        setSelectedDeck(decks[deletedDeckIndex > 0 ? deletedDeckIndex - 1 : 1] || null);
        setShowEditDeckModal(false);
        setLists([]);
        setCardsByList({});
        
        // Sync to server
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskdecks/${deletedDeck.deck_id}`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) throw new Error('Failed to delete deck');
            setSyncStatus('idle');
        } catch (err) {
            // Revert on error
            setDecks(prev => [...prev.slice(0, deletedDeckIndex), deletedDeck, ...prev.slice(deletedDeckIndex)]);
            setSelectedDeck(deletedDeck);
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to delete deck');
        }
    };

    const createList = async () => {
        if (!newListName.trim() || !selectedDeck) return;

        const tempListId = -Date.now(); // Temporary negative ID
        const newList: TaskList = {
            list_id: tempListId,
            deck_id: selectedDeck.deck_id,
            list_name: newListName,
            sort_order: lists.length,
            created_at: new Date().toISOString(),
        };
        
        // Optimistic update - add list immediately
        setLists(prev => [...prev, newList]);
        setCardsByList(prev => ({ ...prev, [tempListId]: [] }));
        setNewListName('');
        setShowNewListForm(false);
        
        // Sync to server in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskdecks/${selectedDeck.deck_id}/lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    list_name: newList.list_name,
                }),
            });

            if (!response.ok) throw new Error('Failed to create list');
            
            const data = await response.json();
            
            // Update with real list_id from server
            setLists(prev => prev.map(l => 
                l.list_id === tempListId ? { ...l, list_id: data.list_id } : l
            ));
            setCardsByList(prev => {
                const { [tempListId]: tempCards, ...rest } = prev;
                return { ...rest, [data.list_id]: tempCards || [] };
            });
            
            setSyncStatus('idle');
        } catch (err) {
            // Revert on error
            setLists(prev => prev.filter(l => l.list_id !== tempListId));
            setCardsByList(prev => {
                const { [tempListId]: _, ...rest } = prev;
                return rest;
            });
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to create list');
        }
    };

    const updateList = async (listId: number) => {
        if (!editingListName.trim()) return;

        const oldName = lists.find(l => l.list_id === listId)?.list_name;
        const newName = editingListName;
        
        // Optimistic update
        setLists(prev => prev.map(l => 
            l.list_id === listId ? { ...l, list_name: newName } : l
        ));
        setEditingListId(null);
        setEditingListName('');
        
        // Sync to server in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/tasklists/${listId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    list_name: newName,
                }),
            });

            if (!response.ok) throw new Error('Failed to update list');
            setSyncStatus('idle');
        } catch (err) {
            // Revert on error
            setLists(prev => prev.map(l => 
                l.list_id === listId ? { ...l, list_name: oldName || '' } : l
            ));
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to update list');
        }
    };

    const deleteList = async (listId: number, listName: string) => {
        if (!confirm(`Delete list "${listName}"? All cards in this list will be deleted.`)) {
            return;
        }

        // Save for potential revert
        const deletedList = lists.find(l => l.list_id === listId);
        const deletedCards = cardsByList[listId] || [];
        
        // Optimistic update
        setLists(prev => prev.filter(l => l.list_id !== listId));
        setCardsByList(prev => {
            const newState = { ...prev };
            delete newState[listId];
            return newState;
        });
        
        // Sync to server in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/tasklists/${listId}`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) throw new Error('Failed to delete list');
            setSyncStatus('idle');
        } catch (err) {
            // Revert on error
            if (deletedList) {
                setLists(prev => [...prev, deletedList].sort((a, b) => a.sort_order - b.sort_order));
                setCardsByList(prev => ({
                    ...prev,
                    [listId]: deletedCards
                }));
            }
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to delete list');
        }
    };

    const createCard = async (listId: number, title: string) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Create temp card with negative ID
        const tempCardId = -Date.now();
        const currentCards = cardsByList[listId] || [];
        const creatorDisplayName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown';
        const tempCard: TaskCard = {
            card_id: tempCardId,
            list_id: listId,
            title: title,
            description: '',
            sort_order: currentCards.length,
            is_complete: 0,
            due_date: null,
            created_by: currentUser.id,
            creator_name: creatorDisplayName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        
        // Optimistic update
        setCardsByList(prev => ({
            ...prev,
            [listId]: [...(prev[listId] || []), tempCard]
        }));
        
        // Sync to server in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/tasklists/${listId}/cards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ title }),
            });

            if (!response.ok) throw new Error('Failed to create card');
            
            const newCard = await response.json();
            
            // Replace temp card with real one
            setCardsByList(prev => ({
                ...prev,
                [listId]: prev[listId].map(c => 
                    c.card_id === tempCardId ? { ...newCard, list_id: listId } : c
                )
            }));
            setSyncStatus('idle');
        } catch (err) {
            // Remove temp card on error
            setCardsByList(prev => ({
                ...prev,
                [listId]: prev[listId].filter(c => c.card_id !== tempCardId)
            }));
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to create card');
        }
    };

    const deleteCard = async (cardId: number, listId: number) => {
        // Save for potential revert
        const deletedCard = cardsByList[listId]?.find(c => c.card_id === cardId);
        if (!deletedCard) return;
        
        // Optimistic update - remove card from list
        setCardsByList(prev => ({
            ...prev,
            [listId]: prev[listId].filter(c => c.card_id !== cardId)
        }));
        
        // Close modal if this card was open
        if (selectedCard?.card_id === cardId) {
            setIsCardModalOpen(false);
            setSelectedCard(null);
        }
        
        // Sync to server
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskcards/${cardId}`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) throw new Error('Failed to delete card');
            setSyncStatus('idle');
        } catch (err) {
            // Revert on error
            if (deletedCard) {
                setCardsByList(prev => ({
                    ...prev,
                    [listId]: [...(prev[listId] || []), deletedCard].sort((a, b) => a.sort_order - b.sort_order)
                }));
            }
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to delete card');
        }
    };

    const handleDragStart = (card: TaskCard, e?: React.DragEvent) => {
        // Prevent dragging completed cards
        if (card.is_complete === 1) {
            if (e) {
                e.preventDefault();
            }
            return;
        }
        
        setDraggedCard({
            cardId: card.card_id,
            listId: card.list_id,
            sortOrder: card.sort_order,
        });
    };

    const handleDragOver = (e: React.DragEvent, listId: number) => {
        e.preventDefault();
        setDragOverList(listId);
    };

    const handleDragLeave = () => {
        setDragOverList(null);
    };

    const handleDrop = async (e: React.DragEvent, targetListId: number, dropPosition?: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        // CRITICAL: Save draggedCard data FIRST before any state changes
        // This prevents race conditions with handleDragEnd
        if (!draggedCard) {
            setDragOverList(null);
            setDragOverCardId(null);
            return;
        }
        
        const cardIdToMove = draggedCard.cardId;
        const sourceListId = draggedCard.listId;
        
        // Clear all drag state immediately BEFORE async work
        setDraggedCard(null);
        setDraggedList(null);
        setDragOverList(null);
        setDragOverCardId(null);
        
        // Use functional update to get latest state
        setCardsByList(prev => {
            const sourceCards = prev[sourceListId] || [];
            const targetCards = prev[targetListId] || [];
            
            // Find the card to move
            const draggedCardData = sourceCards.find(c => c.card_id === cardIdToMove);
            
            if (!draggedCardData) {
                console.error('Card not found in source list:', cardIdToMove, sourceListId);
                return prev;
            }
            
            // Determine new sort order
            let newSortOrder: number;
            if (dropPosition !== undefined) {
                newSortOrder = dropPosition;
            } else {
                newSortOrder = targetCards.length;
            }
            
            // Create updated card with new list_id (CRITICAL for subsequent drags)
            const updatedCard: TaskCard = {
                ...draggedCardData,
                list_id: targetListId,
                sort_order: newSortOrder,
            };
            
            // Remove from source
            const newSourceCards = sourceCards.filter(c => c.card_id !== cardIdToMove);
            
            if (targetListId === sourceListId) {
                // Moving within same list
                const newTargetCards = [...newSourceCards];
                newTargetCards.splice(newSortOrder, 0, updatedCard);
                return {
                    ...prev,
                    [sourceListId]: newTargetCards
                };
            } else {
                // Moving to different list
                const newTargetCards = [...targetCards];
                newTargetCards.splice(newSortOrder, 0, updatedCard);
                return {
                    ...prev,
                    [sourceListId]: newSourceCards,
                    [targetListId]: newTargetCards
                };
            }
        });
        
        // Determine sort order for API call
        const targetCards = cardsByList[targetListId] || [];
        const newSortOrder = dropPosition !== undefined ? dropPosition : targetCards.length;
        
        // Make API call in background
        setSyncStatus('syncing');
        try {
            const response = await fetch(`${apiUrl}/taskcards/${cardIdToMove}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    list_id: targetListId,
                    sort_order: newSortOrder,
                }),
            });

            if (!response.ok) throw new Error('Failed to move card');
            setSyncStatus('idle');
        } catch (err) {
            setSyncStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to move card');
            // Revert on error by re-fetching
            if (selectedDeck) {
                await fetchListsAndCards(selectedDeck.deck_id);
            }
        }
    };

    const handleDropOnCard = (e: React.DragEvent, targetCard: TaskCard, targetListId: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedCard) return;
        
        // Get target index from current card's position in the render
        // We use the card's sort_order or find it in the current list
        const targetCards = cardsByList[targetListId] || [];
        let targetIndex = targetCards.findIndex(c => c.card_id === targetCard.card_id);
        
        // If card not found (edge case), append to end
        if (targetIndex === -1) {
            targetIndex = targetCards.length;
        }
        
        // Call handleDrop with the position
        handleDrop(e, targetListId, targetIndex);
    };

    const handleListDragStart = (list: TaskList) => {
        setDraggedList(list);
    };

    const handleListDragOver = (e: React.DragEvent, targetList: TaskList) => {
        e.preventDefault();
        if (!draggedList || draggedList.list_id === targetList.list_id) return;
    };

    const handleListDrop = async (e: React.DragEvent, targetList: TaskList) => {
        e.preventDefault();
        if (!draggedList || draggedList.list_id === targetList.list_id) {
            setDraggedList(null);
            return;
        }

        const targetIndex = lists.findIndex(l => l.list_id === targetList.list_id);
        
        // Save original order for potential revert
        const originalLists = [...lists];
        
        // Optimistically update UI
        const newLists = lists.filter(l => l.list_id !== draggedList.list_id);
        newLists.splice(targetIndex, 0, draggedList);
        setLists(newLists);
        
        setDraggedList(null);

        // Update sort orders on backend
        setSyncStatus('syncing');
        try {
            await Promise.all(
                newLists.map((list, index) =>
                    fetch(`${apiUrl}/tasklists/${list.list_id}/move`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': nonce,
                        },
                        body: JSON.stringify({ sort_order: index }),
                    })
                )
            );
            setSyncStatus('idle');
        } catch (err) {
            console.error('Failed to update list order:', err);
            // Revert to original order on error
            setLists(originalLists);
            setSyncStatus('error');
            setError('Failed to reorder lists');
        }
    };

    const openCardModal = (card: TaskCard) => {
        setSelectedCard(card);
        setIsCardModalOpen(true);
    };

    const isCardAssignedToUser = (card: TaskCard): boolean => {
        // Check if assigned directly to user (legacy single assignment)
        if (card.assigned_to === currentUser.id) {
            return true;
        }
        // Check multi-assignees
        if (card.assignees && card.assignees.some(a => a.user_id === currentUser.id)) {
            return true;
        }
        // Check if assigned to a role the user has (legacy single role)
        if (card.assigned_to_role_id && currentUser.jobRoles) {
            if (currentUser.jobRoles.some(role => role.id === card.assigned_to_role_id)) {
                return true;
            }
        }
        // Check multi-roles
        if (card.assigned_roles && card.assigned_roles.length > 0 && currentUser.jobRoles) {
            const userRoleIds = currentUser.jobRoles.map(r => r.id);
            if (card.assigned_roles.some(r => userRoleIds.includes(r.role_id))) {
                return true;
            }
        }
        return false;
    };

    // Check if card is assigned directly to this user (not by role)
    const isCardAssignedDirectlyToUser = (card: TaskCard): boolean => {
        // Check legacy single assignment
        if (card.assigned_to === currentUser.id) return true;
        // Check multi-assignees
        if (card.assignees && card.assignees.some(a => a.user_id === currentUser.id)) return true;
        return false;
    };
    
    // Check if card is assigned only via role (not directly to user)
    const isCardAssignedOnlyByRole = (card: TaskCard): boolean => {
        // If directly assigned, not role-only
        if (card.assigned_to === currentUser.id) return false;
        if (card.assignees && card.assignees.some(a => a.user_id === currentUser.id)) return false;
        
        // Check legacy single role
        if (card.assigned_to_role_id && currentUser.jobRoles) {
            if (currentUser.jobRoles.some(role => role.id === card.assigned_to_role_id)) {
                return true;
            }
        }
        // Check multi-roles
        if (card.assigned_roles && card.assigned_roles.length > 0 && currentUser.jobRoles) {
            const userRoleIds = currentUser.jobRoles.map(r => r.id);
            if (card.assigned_roles.some(r => userRoleIds.includes(r.role_id))) {
                return true;
            }
        }
        return false;
    };
    
    // Check if user can edit a specific card
    // On primary deck: 
    //   - Users with canManageAllPrimaryCards -> can edit any card
    //   - Cards assigned directly to user -> editable
    //   - Cards assigned only by role -> NOT editable (view only) unless user has global edit permission
    //   - Cards created by user -> editable
    // On non-primary deck: use existing canEditCurrentDeck logic
    const canEditCard = (card: TaskCard): boolean => {
        if (isAdmin) return true;
        
        if (isPrimaryDeck) {
            // Special permission: canManageAllPrimaryCards allows editing any card on primary deck
            if (_userPermissions.canManageAllPrimaryCards) return true;
            
            // On primary deck, check specific card permissions
            // Card creator can always edit their own cards
            if (card.created_by === currentUser.id) return true;
            // Direct user assignment allows editing
            if (isCardAssignedDirectlyToUser(card)) return true;
            // Role-only assignment - check if user has global edit permission on deck
            if (isCardAssignedOnlyByRole(card)) {
                return _userPermissions.canEdit; // Need global edit permission for role-assigned cards
            }
            // User has global edit permission on primary deck
            return _userPermissions.canEdit;
        }
        
        // Non-primary deck - use deck-level permission
        return canEditCurrentDeck;
    };
    
    // Check if user can delete a specific card
    // On primary deck: only allow deleting cards the user created
    // On non-primary deck: use existing canEditCurrentDeck logic (or card ownership)
    const canDeleteCard = (card: TaskCard): boolean => {
        if (isAdmin) return true;
        
        if (isPrimaryDeck) {
            // On primary deck, users can only delete their own cards
            return card.created_by === currentUser.id;
        }
        
        // Non-primary deck - deck owners and those with edit permission can delete
        return canEditCurrentDeck || card.created_by === currentUser.id;
    };

    // Get due date styling based on status
    const getDueDateStyle = (dueDate: string | null, isComplete: number): { bg: string; text: string; icon: string } => {
        if (!dueDate) return { bg: '', text: '', icon: '' };
        if (isComplete === 1) return { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' };
        
        const due = new Date(dueDate);
        const now = new Date();
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { bg: 'bg-red-500', text: 'text-white', icon: '⚠' }; // Overdue
        if (diffDays === 0) return { bg: 'bg-yellow-500', text: 'text-white', icon: '!' }; // Due today
        if (diffDays <= 2) return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '' }; // Due soon
        return { bg: 'bg-gray-100', text: 'text-gray-600', icon: '' }; // Future
    };

    // Filter cards based on current filters
    const filterCards = (cards: TaskCard[]): TaskCard[] => {
        return cards.filter(card => {
            // PRIMARY DECK VISIBILITY: On primary deck, non-admin users only see cards assigned to them
            // Admins and moderators can see all cards
            if (isPrimaryDeck && !isAdmin && !_userPermissions.canModerateAll) {
                if (!isCardAssignedToUser(card)) return false;
            }
            
            // My cards filter
            if (showMyCardsOnly && !isCardAssignedToUser(card)) return false;
            
            // Filter by specific user
            if (filterByUser !== null && card.assigned_to !== filterByUser) return false;
            
            // Filter by specific role
            if (filterByRole !== null && card.assigned_to_role_id !== filterByRole) return false;
            
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesTitle = card.title.toLowerCase().includes(query);
                const matchesDesc = card.description?.toLowerCase().includes(query);
                const matchesAssignee = card.assignee_name?.toLowerCase().includes(query);
                const matchesCategory = card.category_tag?.toLowerCase().includes(query);
                if (!matchesTitle && !matchesDesc && !matchesAssignee && !matchesCategory) return false;
            }
            
            return true;
        });
    };

    // Get total completed cards count for grid view
    const getCompletedCardsCount = (): number => {
        let count = 0;
        lists.forEach(list => {
            const listCards = cardsByList[list.list_id] || [];
            count += filterCards(listCards).filter(card => card.is_complete === 1).length;
        });
        return count;
    };
    
    // Group cards for grid view based on groupBy setting
    const getGroupedCardsForGrid = (includeCompleted: boolean = true): { key: string; label: string; cards: TaskCard[] }[] => {
        // Collect all filtered cards across all lists
        const allFilteredCards: TaskCard[] = [];
        lists.forEach(list => {
            const listCards = cardsByList[list.list_id] || [];
            let filtered = filterCards(listCards);
            // Filter out completed cards unless explicitly included
            if (!includeCompleted) {
                filtered = filtered.filter(card => card.is_complete !== 1);
            }
            allFilteredCards.push(...filtered);
        });
        
        if (gridGroupBy === 'list') {
            // Group by list (existing behavior)
            return lists.map(list => {
                const listCards = cardsByList[list.list_id] || [];
                let filtered = filterCards(listCards);
                if (!includeCompleted) {
                    filtered = filtered.filter(card => card.is_complete !== 1);
                }
                return {
                    key: `list-${list.list_id}`,
                    label: list.list_name,
                    cards: filtered
                };
            }).filter(group => group.cards.length > 0);
        } else if (gridGroupBy === 'assignee') {
            // Group by assigned user
            const groups: Record<string, { label: string; cards: TaskCard[] }> = {};
            allFilteredCards.forEach(card => {
                const key = card.assigned_to ? `user-${card.assigned_to}` : 'unassigned';
                // Look up user name from dropdownUsers if not on the card
                let label = card.assignee_name;
                if (!label && card.assigned_to) {
                    const user = dropdownUsers.find(u => u.id === card.assigned_to);
                    label = user?.displayName || 'Unknown User';
                }
                label = label || 'Unassigned';
                if (!groups[key]) {
                    groups[key] = { label, cards: [] };
                }
                groups[key].cards.push(card);
            });
            // Sort: Unassigned last, then alphabetically
            return Object.entries(groups)
                .map(([key, { label, cards }]) => ({ key, label, cards }))
                .sort((a, b) => {
                    if (a.key === 'unassigned') return 1;
                    if (b.key === 'unassigned') return -1;
                    return a.label.localeCompare(b.label);
                });
        } else {
            // Group by assigned role
            const groups: Record<string, { label: string; cards: TaskCard[] }> = {};
            allFilteredCards.forEach(card => {
                const key = card.assigned_to_role_id ? `role-${card.assigned_to_role_id}` : 'no-role';
                // Look up role name from dropdownRoles if not on the card
                let label = card.role_name;
                if (!label && card.assigned_to_role_id) {
                    const role = dropdownRoles.find(r => r.role_id === card.assigned_to_role_id);
                    label = role?.role_name || 'Unknown Role';
                }
                label = label || 'No Role Assigned';
                if (!groups[key]) {
                    groups[key] = { label, cards: [] };
                }
                groups[key].cards.push(card);
            });
            // Sort: No role last, then alphabetically
            return Object.entries(groups)
                .map(([key, { label, cards }]) => ({ key, label, cards }))
                .sort((a, b) => {
                    if (a.key === 'no-role') return 1;
                    if (b.key === 'no-role') return -1;
                    return a.label.localeCompare(b.label);
                });
        }
    };

    const handleCardUpdate = (updatedCard: TaskCard) => {
        // Update the specific card in state without refetching
        // Preserve checklist_items from the existing card if not in the update
        const listId = updatedCard.list_id;
        setCardsByList(prev => ({
            ...prev,
            [listId]: (prev[listId] || []).map(c => {
                if (c.card_id === updatedCard.card_id) {
                    // Preserve checklist_items if not provided in update
                    return {
                        ...updatedCard,
                        checklist_items: updatedCard.checklist_items || c.checklist_items,
                    };
                }
                return c;
            })
        }));
        
        // Also update selectedCard if it's the same card (keeps modal in sync)
        if (selectedCard && selectedCard.card_id === updatedCard.card_id) {
            setSelectedCard(prev => prev ? {
                ...updatedCard,
                checklist_items: updatedCard.checklist_items || prev.checklist_items,
            } : updatedCard);
        }
    };

    // Move a card to a different list (called from list picker in modal)
    const handleMoveToList = async (cardId: number, newListId: number) => {
        // Find the card and its current list
        let sourceListId: number | null = null;
        let cardToMove: TaskCard | null = null;
        
        for (const [listId, cards] of Object.entries(cardsByList)) {
            const found = cards.find(c => c.card_id === cardId);
            if (found) {
                sourceListId = Number(listId);
                cardToMove = found;
                break;
            }
        }
        
        if (!cardToMove || sourceListId === null || sourceListId === newListId) return;
        
        // Optimistically update UI
        setCardsByList(prev => {
            const sourceCards = prev[sourceListId] || [];
            const targetCards = prev[newListId] || [];
            
            // Remove from source
            const newSourceCards = sourceCards.filter(c => c.card_id !== cardId);
            
            // Add to target with updated list_id
            const movedCard = { ...cardToMove!, list_id: newListId, sort_order: targetCards.length };
            const newTargetCards = [...targetCards, movedCard];
            
            return {
                ...prev,
                [sourceListId]: newSourceCards,
                [newListId]: newTargetCards,
            };
        });
        
        // Update selectedCard to reflect new list_id
        if (selectedCard?.card_id === cardId) {
            setSelectedCard(prev => prev ? { ...prev, list_id: newListId } : prev);
        }
        
        // Sync to backend
        setSyncStatus('syncing');
        try {
            const targetCards = cardsByList[newListId] || [];
            const newSortOrder = targetCards.length;
            
            await fetch(`${apiUrl}/cards/${cardId}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    list_id: newListId,
                    sort_order: newSortOrder,
                }),
            });
            setSyncStatus('idle');
        } catch (err) {
            console.error('Failed to move card:', err);
            // Revert on error
            setCardsByList(prev => {
                const sourceCards = prev[sourceListId] || [];
                const targetCards = prev[newListId] || [];
                
                // Remove from target
                const movedCard = targetCards.find(c => c.card_id === cardId);
                if (!movedCard) return prev;
                
                const newTargetCards = targetCards.filter(c => c.card_id !== cardId);
                
                // Add back to source
                const revertedCard = { ...movedCard, list_id: sourceListId, sort_order: cardToMove!.sort_order };
                const newSourceCards = [...sourceCards, revertedCard].sort((a, b) => a.sort_order - b.sort_order);
                
                return {
                    ...prev,
                    [sourceListId]: newSourceCards,
                    [newListId]: newTargetCards,
                };
            });
            
            // Revert selectedCard
            if (selectedCard?.card_id === cardId) {
                setSelectedCard(prev => prev ? { ...prev, list_id: sourceListId! } : prev);
            }
            
            setSyncStatus('error');
        }
    };

    const closeCardModal = () => {
        setIsCardModalOpen(false);
        setSelectedCard(null);
        // Don't refetch - card updates already synced via handleCardUpdate
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-text-red-800">
                <p className="ap-font-semibold">Error</p>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="ap-h-full ap-flex ap-flex-col">
            {/* Sync Status Indicator */}
            {syncStatus === 'syncing' && (
                <div className="ap-fixed ap-top-4 ap-right-4 ap-bg-blue-500 ap-text-white ap-px-3 ap-py-1 ap-rounded-full ap-text-sm ap-flex ap-items-center ap-gap-2 ap-shadow-lg ap-z-50">
                    <svg className="ap-animate-spin ap-h-4 ap-w-4" viewBox="0 0 24 24">
                        <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                </div>
            )}
            {syncStatus === 'error' && (
                <div className="ap-fixed ap-top-4 ap-right-4 ap-bg-red-500 ap-text-white ap-px-3 ap-py-2 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2 ap-shadow-lg ap-z-50">
                    <span>Sync error - changes may not be saved</span>
                    <Button 
                        onClick={() => setSyncStatus('idle')} 
                        variant="ghost"
                        size="xs"
                        className="ap-ml-2 !ap-p-1 !ap-text-white hover:!ap-bg-red-600"
                    >
                        ✕
                    </Button>
                </div>
            )}
            
            {/* Header - Compact Trello-style */}
            <div className="ap-flex-shrink-0 ap-bg-white/80 ap-backdrop-blur-sm ap-border-b ap-border-gray-200 ap-px-4 ap-py-3 ap-overflow-hidden">
                <div className="ap-flex ap-flex-col ap-gap-3">
                    {/* Title Row */}
                    <div className="ap-flex ap-items-center ap-justify-between ap-gap-4 ap-min-w-0">
                        <div className="ap-flex ap-items-center ap-gap-2 ap-min-w-0 ap-flex-shrink">
                            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-whitespace-nowrap">TaskDeck</h1>
                            {selectedDeck && (
                                <span className="ap-text-lg ap-text-gray-600 ap-truncate">/ {selectedDeck.deck_name}</span>
                            )}
                        </div>
                        {/* New Deck Button - Always visible on right */}
                        <Button
                            onClick={() => setShowNewDeckForm(true)}
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="ap-w-4 ap-h-4" />}
                            className="ap-flex-shrink-0 ap-whitespace-nowrap"
                        >
                            <span className="ap-hidden sm:ap-inline">New Deck</span>
                        </Button>
                    </div>
                    
                    {/* Controls Row - Wraps on smaller screens */}
                    <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-2">
                        {/* Search */}
                        <div className="ap-relative ap-flex-shrink-0 ap-w-full sm:ap-w-auto">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search cards..."
                                className="ap-w-full sm:ap-w-44 ap-px-3 ap-py-2 ap-pl-8 ap-text-sm ap-border ap-border-gray-200 ap-rounded-lg focus:ap-outline-none focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10 ap-bg-white ap-transition-all"
                            />
                            <svg className="ap-absolute ap-left-2.5 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchQuery && (
                                <Button
                                    onClick={() => setSearchQuery('')}
                                    variant="ghost"
                                    size="xs"
                                    className="ap-absolute ap-right-2 ap-top-1/2 -ap-translate-y-1/2 !ap-p-0.5 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-gray-600"
                                >
                                    ×
                                </Button>
                            )}
                        </div>
                        
                        {/* View Mode Toggle */}
                        <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-bg-gray-50 ap-rounded-lg ap-p-1">
                            <Button
                                onClick={() => {
                                    setViewMode('board');
                                    setShowCompletedInGrid(false);
                                    setCompletedCardsVisibleCount(25);
                                    setBoardCompletedVisibleCount({});
                                }}
                                variant="ghost"
                                size="sm"
                                className={`ap-flex ap-items-center ap-gap-1 !ap-px-2.5 !ap-py-1.5 !ap-min-h-0 ap-rounded-md ap-transition-all ${
                                    viewMode === 'board'
                                        ? '!ap-bg-white !ap-text-brand-500 !ap-shadow-xs !ap-font-medium' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                                }`}
                                title="Kanban Board View"
                            >
                                <HiOutlineViewColumns className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">Board</span>
                            </Button>
                            <Button
                                onClick={() => {
                                    setViewMode('grid');
                                    setShowCompletedInGrid(false);
                                    setCompletedCardsVisibleCount(25);
                                    setBoardCompletedVisibleCount({});
                                }}
                                variant="ghost"
                                size="sm"
                                className={`ap-flex ap-items-center ap-gap-1 !ap-px-2.5 !ap-py-1.5 !ap-min-h-0 ap-rounded-md ap-transition-all ${
                                    viewMode === 'grid'
                                        ? '!ap-bg-white !ap-text-brand-500 !ap-shadow-xs !ap-font-medium' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                                }`}
                                title="Grid View"
                            >
                                <HiOutlineTableCells className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">Grid</span>
                            </Button>
                        </div>
                        
                        {/* My Cards Filter - includes cards assigned directly to user OR to their role */}
                        <Button
                            onClick={() => setShowMyCardsOnly(!showMyCardsOnly)}
                            variant={showMyCardsOnly ? 'primary' : 'secondary'}
                            size="sm"
                            className={`ap-flex-shrink-0 !ap-min-h-0 !ap-py-2 ap-whitespace-nowrap ${
                                !showMyCardsOnly ? '!ap-bg-gray-50 !ap-text-gray-700 hover:!ap-bg-gray-100' : ''
                            }`}
                            title="Show cards assigned to me or to my role"
                        >
                            <span className="ap-hidden sm:ap-inline">Assigned to Me & My Role</span>
                            <span className="sm:ap-hidden">My Cards</span>
                        </Button>
                        
                        {/* User Filter Dropdown */}
                        <select
                            value={filterByUser ?? ''}
                            onChange={(e) => setFilterByUser(e.target.value ? Number(e.target.value) : null)}
                            className="ap-flex-shrink-0 ap-px-2.5 ap-py-2 ap-text-sm ap-border ap-border-gray-200 ap-rounded-lg focus:ap-outline-none focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10 ap-bg-white ap-max-w-[140px] ap-transition-all"
                        >
                            <option value="">All Users</option>
                            {dropdownUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.displayName}
                                </option>
                            ))}
                        </select>
                        
                        {/* Role Filter Dropdown */}
                        <select
                            value={filterByRole ?? ''}
                            onChange={(e) => setFilterByRole(e.target.value ? Number(e.target.value) : null)}
                            className="ap-flex-shrink-0 ap-px-2.5 ap-py-2 ap-text-sm ap-border ap-border-gray-200 ap-rounded-lg focus:ap-outline-none focus:ap-border-brand-500 focus:ap-ring-4 focus:ap-ring-brand-500/10 ap-bg-white ap-max-w-[140px] ap-transition-all"
                        >
                            <option value="">All Roles</option>
                            {dropdownRoles.map((role) => (
                                <option key={role.role_id} value={role.role_id}>
                                    {role.role_name}
                                </option>
                            ))}
                        </select>
                        
                        {/* Clear Filters */}
                        {(filterByUser || filterByRole) && (
                            <Button
                                onClick={() => {
                                    setFilterByUser(null);
                                    setFilterByRole(null);
                                }}
                                variant="link"
                                size="xs"
                                className="ap-flex-shrink-0 ap-hidden lg:ap-block"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Deck Selector Tabs */}
                {decks.length > 0 && (
                    <div className="ap-flex ap-gap-1 ap-mt-3 ap-overflow-x-auto ap-pb-1 -ap-mb-3">
                        {decks.map((deck) => (
                            <div key={deck.deck_id} className="ap-flex ap-items-center group">
                                <Button
                                    onClick={() => {
                                        setSelectedDeck(deck);
                                        // Reset completed cards state when switching decks
                                        setShowCompletedInGrid(false);
                                        setCompletedCardsVisibleCount(25);
                                        setBoardCompletedVisibleCount({});
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className={`ap-flex ap-items-center ap-gap-1.5 !ap-px-3 !ap-py-1.5 !ap-min-h-0 ap-rounded-t-lg ap-whitespace-nowrap ap-transition-all ap-border-b-2 ${
                                        selectedDeck?.deck_id === deck.deck_id
                                            ? '!ap-bg-white !ap-text-blue-600 !ap-border-blue-500 !ap-font-medium' : '!ap-bg-transparent !ap-text-gray-600 !ap-border-transparent hover:!ap-bg-gray-100 hover:!ap-text-gray-900'
                                    }`}
                                >
                                    <span className="ap-text-xs ap-opacity-60" title={deck.is_public === 1 ? 'Public deck' : 'Private deck'}>
                                        {deck.is_public === 1 ? '🌐' : '🔒'}
                                    </span>
                                    {(deck as any).is_primary === 1 && (
                                        <span className="ap-text-xs ap-bg-yellow-100 ap-text-yellow-800 ap-px-1.5 ap-py-0.5 ap-rounded-full ap-mr-1" title="System Primary Deck">
                                            ⭐
                                        </span>
                                    )}
                                    {deck.deck_name}
                                </Button>
                                {/* Settings button - only show for deck owner or users with edit permission */}
                                {(deck.created_by === currentUser.id || (deck as any).user_can_edit) && selectedDeck?.deck_id === deck.deck_id && (
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditDeckName(deck.deck_name);
                                            setEditDeckIsPublic(deck.is_public === 1);
                                            setEditDeckIsPrimary((deck as any).is_primary === 1);
                                            setShowEditDeckModal(true);
                                        }}
                                        variant="ghost"
                                        size="xs"
                                        className="ap-ml-1 !ap-p-1 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-gray-700 hover:!ap-bg-gray-100 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity"
                                        title="Edit deck settings"
                                    >
                                        <HiOutlinePencil className="ap-w-3.5 ap-h-3.5" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* New Deck Form */}
            {showNewDeckForm && (
                <div className="ap-flex-shrink-0 ap-mx-4 ap-mt-4 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-p-4 ap-shadow-sm">
                    <h3 className="ap-font-semibold ap-mb-3">Create New Deck</h3>
                    <div className="ap-space-y-3">
                        <input
                            type="text"
                            value={newDeckName}
                            onChange={(e) => setNewDeckName(e.target.value)}
                            placeholder="Deck name..."
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                            onKeyPress={(e) => e.key === 'Enter' && createDeck()}
                            autoFocus
                        />
                        <div className="ap-space-y-2">
                            <label 
                                className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-cursor-pointer ap-rounded-lg ap-border-2 ap-transition-all ${
                                    !newDeckIsPublic 
                                        ? 'ap-border-blue-500 ap-bg-blue-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="deckVisibility"
                                    checked={!newDeckIsPublic}
                                    onChange={() => setNewDeckIsPublic(false)}
                                    className="ap-mt-0.5 ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500"
                                />
                                <div>
                                    <span className={`ap-font-medium ${!newDeckIsPublic ? 'ap-text-blue-600' : 'ap-text-gray-700'}`}>
                                        🔒 Private
                                    </span>
                                    <p className="ap-text-gray-500 ap-text-xs">Only you can see and edit this deck</p>
                                </div>
                            </label>
                            {/* Public option - only show if user has permission or is admin */}
                            {(_userPermissions.canCreatePublicDecks || window.mentorshipPlatformData?.is_admin) ? (
                            <label 
                                className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-cursor-pointer ap-rounded-lg ap-border-2 ap-transition-all ${
                                    newDeckIsPublic 
                                        ? 'ap-border-blue-500 ap-bg-blue-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="deckVisibility"
                                    checked={newDeckIsPublic}
                                    onChange={() => setNewDeckIsPublic(true)}
                                    className="ap-mt-0.5 ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500"
                                />
                                <div>
                                    <span className={`ap-font-medium ${newDeckIsPublic ? 'ap-text-blue-600' : 'ap-text-gray-700'}`}>
                                        🌐 Public
                                    </span>
                                    <p className="ap-text-gray-500 ap-text-xs">
                                        Visible to users based on their role permissions. 
                                        Editing rights depend on role settings.
                                    </p>
                                </div>
                            </label>
                            ) : (
                            <div className="ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-rounded-lg ap-border-2 ap-border-gray-200 ap-bg-gray-50 ap-opacity-60">
                                <div className="ap-mt-0.5 ap-w-4 ap-h-4 ap-border ap-border-gray-300 ap-rounded-full ap-bg-gray-100"></div>
                                <div>
                                    <span className="ap-font-medium ap-text-gray-500">
                                        🌐 Public
                                    </span>
                                    <p className="ap-text-gray-400 ap-text-xs">
                                        You don't have permission to create public decks. 
                                        Contact an administrator to enable this.
                                    </p>
                                </div>
                            </div>
                            )}
                        </div>
                        <div className="ap-flex ap-gap-3">
                            <Button
                                onClick={createDeck}
                                variant="primary"
                            >
                                Create
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowNewDeckForm(false);
                                    setNewDeckName('');
                                    setNewDeckIsPublic(false);
                                }}
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kanban Board */}
            {selectedDeck ? (
                <div className="ap-flex-1 ap-flex ap-flex-col ap-min-h-0 ap-p-4">
                    {/* New List Button - only show if user can edit this deck */}
                    {canEditCurrentDeck && (
                        <div className="ap-flex-shrink-0 ap-mb-4">
                            {showNewListForm ? (
                                <div className="ap-inline-flex ap-gap-2">
                                    <input
                                        type="text"
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        placeholder="List name..."
                                        className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                                        onKeyPress={(e) => e.key === 'Enter' && createList()}
                                    />
                                    <Button
                                        onClick={createList}
                                        variant="primary"
                                        size="sm"
                                    >
                                        Add
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setShowNewListForm(false);
                                            setNewListName('');
                                        }}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setShowNewListForm(true)}
                                    variant="outline"
                                    leftIcon={<HiOutlinePlus className="ap-w-4 ap-h-4" />}
                                    className="!ap-border-dashed !ap-border-gray-300 !ap-bg-white/80 hover:!ap-bg-white"
                                >
                                    Add List
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Read-only banner for view-only users */}
                    {!canEditCurrentDeck && !isPrimaryDeck && (
                        <div className="ap-flex-shrink-0 ap-mb-4 ap-px-3 ap-py-2 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-text-sm ap-text-yellow-700">
                            <span className="ap-font-medium">View Only:</span> You can view this deck but don't have permission to edit it.
                        </div>
                    )}
                    
                    {/* Primary deck info banner */}
                    {isPrimaryDeck && !isAdmin && (
                        <div className="ap-flex-shrink-0 ap-mb-4 ap-px-3 ap-py-2 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-text-sm ap-text-blue-700">
                            <span className="ap-font-medium">🌟 Primary Deck:</span> You can view and work on cards assigned to you. 
                            {canCreateCards && ' You can also create new cards.'}
                        </div>
                    )}

                    {/* Loading State for Deck Content */}
                    {deckLoading ? (
                        <div className="ap-flex ap-flex-col ap-items-center ap-justify-center ap-py-16">
                            <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-4 ap-border-blue-500 ap-border-t-transparent ap-mb-4"></div>
                            <p className="ap-text-gray-600">Loading lists and cards...</p>
                        </div>
                    ) : viewMode === 'board' ? (
                        <>
                            {/* Lists - Horizontal scroll with independent vertical scroll per list */}
                            <div className="ap-flex-1 ap-flex ap-gap-3 ap-overflow-x-auto ap-overflow-y-hidden ap-pb-2 ap-min-h-0">
                                {lists.map((list) => {
                                    const listCards = cardsByList[list.list_id] || [];
                                    const filteredActiveCards = filterCards(listCards.filter(card => card.is_complete !== 1));
                                    const filteredCompletedCards = filterCards(listCards.filter(card => card.is_complete === 1));
                                    const totalFilteredCards = filteredActiveCards.length + filteredCompletedCards.length;
                                    
                                    return (
                            <div
                                key={list.list_id}
                                draggable
                                onDragStart={() => handleListDragStart(list)}
                                onDragOver={(e) => {
                                    handleDragOver(e, list.list_id);
                                    handleListDragOver(e, list);
                                }}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                    // Only handle card drops if we have a dragged card
                                    if (draggedCard) {
                                        handleDrop(e, list.list_id);
                                    } else if (draggedList) {
                                        handleListDrop(e, list);
                                    }
                                }}
                                className={`group ap-flex-shrink-0 ap-w-72 sm:ap-w-80 ap-bg-gray-100 ap-rounded-xl ap-flex ap-flex-col ap-max-h-full ${
                                    dragOverList === list.list_id ? 'ap-ring-2 ap-ring-blue-500 ap-ring-offset-2' : ''
                                } ${
                                    draggedList?.list_id === list.list_id ? 'ap-opacity-50 ap-rotate-2' : ''
                                }`}
                            >
                                {/* List Header */}
                                <div className="ap-flex-shrink-0 ap-px-3 ap-py-2.5 ap-cursor-move">
                                    {editingListId === list.list_id ? (
                                        <div className="ap-flex ap-gap-2">
                                            <input
                                                type="text"
                                                value={editingListName}
                                                onChange={(e) => setEditingListName(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && updateList(list.list_id)}
                                                className="ap-flex-1 ap-px-2 ap-py-1 ap-border ap-border-gray-300 ap-rounded focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-text-sm"
                                                autoFocus
                                            />
                                            <Button
                                                onClick={() => updateList(list.list_id)}
                                                variant="primary"
                                                size="xs"
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setEditingListId(null);
                                                    setEditingListName('');
                                                }}
                                                variant="secondary"
                                                size="xs"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="ap-flex ap-items-center ap-justify-between">
                                            <h3 className="ap-font-semibold ap-text-gray-800 ap-text-sm">{list.list_name}</h3>
                                            <div className="ap-flex ap-items-center ap-gap-1">
                                                <span className="ap-px-1.5 ap-py-0.5 ap-text-xs ap-font-medium ap-text-gray-500 ap-bg-gray-200 ap-rounded">
                                                    {totalFilteredCards}
                                                </span>
                                                {canEditCurrentDeck && (
                                                <>
                                                <Button
                                                    onClick={() => {
                                                        setEditingListId(list.list_id);
                                                        setEditingListName(list.list_name);
                                                    }}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-gray-700 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity"
                                                    title="Edit list name"
                                                >
                                                    <HiOutlinePencil className="ap-w-3.5 ap-h-3.5" />
                                                </Button>
                                                <Button
                                                    onClick={() => deleteList(list.list_id, list.list_name)}
                                                    variant="ghost"
                                                    size="xs"
                                                    className="!ap-p-1 !ap-min-h-0 !ap-text-gray-400 hover:!ap-text-red-600 hover:!ap-bg-red-50 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity"
                                                    title="Delete list"
                                                >
                                                    <HiOutlineTrash className="ap-w-3.5 ap-h-3.5" />
                                                </Button>
                                                </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Cards - Scrollable container */}
                                <div className="ap-flex-1 ap-overflow-y-auto ap-px-2 ap-pb-2 ap-space-y-2 ap-min-h-0">
                                    {/* Active Cards */}
                                    {filteredActiveCards.map((card) => {
                                        const dueDateStyle = getDueDateStyle(card.due_date ?? null, card.is_complete);
                                        const categoryColor = card.category_tag ? getCategoryColor(card.category_tag) : null;
                                        const isAssignedToMe = isCardAssignedToUser(card);
                                        
                                        return (
                                        <div
                                            key={card.card_id}
                                            draggable={card.is_complete !== 1}
                                            onDragStart={(e) => {
                                                e.stopPropagation(); // Prevent list drag
                                                handleDragStart(card, e);
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDragOverCardId(card.card_id);
                                                setDragOverList(list.list_id);
                                            }}
                                            onDragLeave={(e) => {
                                                e.stopPropagation();
                                                if (e.currentTarget === e.target) {
                                                    setDragOverCardId(null);
                                                }
                                            }}
                                            onDrop={(e) => handleDropOnCard(e, card, list.list_id)}
                                            onDragEnd={() => {
                                                // Clear all drag state
                                                setDraggedCard(null);
                                                setDraggedList(null);
                                                setDragOverList(null);
                                                setDragOverCardId(null);
                                            }}
                                            onClick={() => openCardModal(card)}
                                            className={`group/card ap-rounded-lg ap-shadow-sm hover:ap-shadow-md ap-transition-all ap-duration-200 ap-cursor-pointer ap-border ${
                                                isAssignedToMe
                                                    ? 'ap-bg-cyan-50 ap-border-cyan-300 hover:ap-border-cyan-400' : 'ap-bg-white ap-border-gray-200 hover:ap-border-gray-300'
                                            } ${
                                                dragOverCardId === card.card_id && draggedCard?.cardId !== card.card_id
                                                    ? 'ap-border-t-4 ap-border-t-brand-500'
                                                    : ''
                                            } ${
                                                draggedCard?.cardId === card.card_id ? 'ap-opacity-50 ap-rotate-2 ap-scale-105' : ''
                                            }`}
                                        >
                                            {/* Category Label Bar - uses cyan for assigned cards, custom accent color if set, or category-based color */}
                                            <div 
                                                className={`ap-h-2 ap-rounded-t-lg ${
                                                    isAssignedToMe 
                                                        ? 'ap-bg-cyan-500' 
                                                        : !card.accent_color && categoryColor 
                                                            ? categoryColor.bg 
                                                            : !card.accent_color ? 'ap-bg-gray-200' : ''
                                                }`}
                                                style={!isAssignedToMe && card.accent_color ? { backgroundColor: card.accent_color } : undefined}
                                            />
                                            
                                            <div className="ap-p-2.5">
                                                {/* Title */}
                                                <h4 className={`ap-font-medium ap-text-sm ap-leading-snug ap-mb-1.5 ${isAssignedToMe ? 'ap-text-cyan-900' : 'ap-text-gray-900'}`}>{card.title}</h4>
                                                
                                                {/* Image Thumbnail Preview - show first image attachment */}
                                                {(() => {
                                                    const imageAttachment = card.attachments?.find(att => {
                                                        const fileName = att.file_name.toLowerCase();
                                                        return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                                               fileName.endsWith('.png') || fileName.endsWith('.gif') || 
                                                               fileName.endsWith('.webp') || fileName.endsWith('.svg');
                                                    });
                                                    if (imageAttachment?.file_url) {
                                                        return (
                                                            <div className="ap-mb-2 ap-rounded-md ap-overflow-hidden ap-bg-gray-100">
                                                                <img 
                                                                    src={imageAttachment.file_url} 
                                                                    alt={imageAttachment.file_name}
                                                                    className="ap-w-full ap-h-24 ap-object-contain"
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                                
                                                {/* Description Preview - up to 4 lines */}
                                                {card.description && (
                                                    <p className={`ap-text-xs ap-mb-2 line-clamp-4 ${isAssignedToMe ? 'ap-text-cyan-700' : 'ap-text-gray-500'}`}>
                                                        {card.description}
                                                    </p>
                                                )}
                                                
                                                {/* Checklist Items Preview */}
                                                {card.checklist_items && card.checklist_items.length > 0 && (
                                                    <div className="ap-mb-2 ap-space-y-1">
                                                        {card.checklist_items.slice(0, 5).map((item) => (
                                                            <div key={item.checklist_id} className="ap-flex ap-items-center ap-gap-1.5 ap-text-xs">
                                                                <span className={`ap-flex-shrink-0 ap-w-3.5 ap-h-3.5 ap-rounded ap-border ap-flex ap-items-center ap-justify-center ${
                                                                    item.is_complete === 1 
                                                                        ? 'ap-bg-success-500 ap-border-success-500 ap-text-white' 
                                                                        : isAssignedToMe ? 'ap-border-cyan-400' : 'ap-border-gray-300'
                                                                }`}>
                                                                    {item.is_complete === 1 && (
                                                                        <svg className="ap-w-2.5 ap-h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                </span>
                                                                <span className={`ap-truncate ${
                                                                    item.is_complete === 1 
                                                                        ? 'ap-line-through ap-text-gray-400' 
                                                                        : isAssignedToMe ? 'ap-text-cyan-800' : 'ap-text-gray-600'
                                                                }`}>
                                                                    {item.item_text}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {card.checklist_items.length > 5 && (
                                                            <div className={`ap-text-xs ${isAssignedToMe ? 'ap-text-cyan-600' : 'ap-text-gray-400'}`}>
                                                                +{card.checklist_items.length - 5} more items
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Checklist Progress Bar - only show if there are checklist items */}
                                                {typeof card.checklist_total === 'number' && card.checklist_total > 0 && (
                                                    <div className="ap-mb-2">
                                                        <div className="ap-flex ap-items-center ap-gap-2">
                                                            <div className="ap-flex-1 ap-h-1.5 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden">
                                                                <div 
                                                                    className={`ap-h-full ap-rounded-full ap-transition-all ${
                                                                        card.checklist_completed === card.checklist_total 
                                                                            ? 'ap-bg-success-500' 
                                                                            : isAssignedToMe ? 'ap-bg-cyan-500' : 'ap-bg-brand-500'
                                                                    }`}
                                                                    style={{ width: `${(card.checklist_completed || 0) / card.checklist_total * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className={`ap-text-xs ap-font-medium ${
                                                                card.checklist_completed === card.checklist_total 
                                                                    ? 'ap-text-success-600' 
                                                                    : isAssignedToMe ? 'ap-text-cyan-700' : 'ap-text-gray-600'
                                                            }`}>
                                                                {card.checklist_completed || 0}/{card.checklist_total}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Badges Row */}
                                                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-1.5">
                                                    {/* Due Date Badge */}
                                                    {card.due_date && (
                                                        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-1.5 ap-py-0.5 ap-text-xs ap-rounded ${dueDateStyle.bg} ${dueDateStyle.text}`}>
                                                            {dueDateStyle.icon && <span>{dueDateStyle.icon}</span>}
                                                            <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            <span>{new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                        </span>
                                                    )}
                                                    
                                                    {/* Location Badge */}
                                                    {card.location_name && (
                                                        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-1.5 ap-py-0.5 ap-text-xs ap-rounded ${isAssignedToMe ? 'ap-bg-cyan-100 ap-text-cyan-700' : 'ap-bg-gray-100 ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            <span className="ap-truncate ap-max-w-[80px]">{card.location_name}</span>
                                                        </span>
                                                    )}
                                                    
                                                    {/* Category Tag */}
                                                    {card.category_tag && !isAssignedToMe && (
                                                        <span className={`ap-px-1.5 ap-py-0.5 ap-text-xs ap-rounded ${categoryColor?.bg} ${categoryColor?.text}`}>
                                                            {card.category_tag}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Attachments Count Badge */}
                                                    {card.attachments && card.attachments.length > 0 && (
                                                        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-1.5 ap-py-0.5 ap-text-xs ap-rounded ${isAssignedToMe ? 'ap-bg-cyan-100 ap-text-cyan-700' : 'ap-bg-gray-100 ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                            </svg>
                                                            <span>{card.attachments.length}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Footer with Creator and Assignment Info */}
                                                <div className={`ap-mt-2 ap-pt-2 ap-border-t ap-space-y-1 ${isAssignedToMe ? 'ap-border-cyan-200' : 'ap-border-gray-100'}`}>
                                                    {/* Created By */}
                                                    {card.creator_name && (
                                                        <div className={`ap-text-xs ${isAssignedToMe ? 'ap-text-cyan-600' : 'ap-text-gray-400'}`}>
                                                            <span className="ap-font-medium">Created by:</span> {card.creator_name}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Assigned To Users - Multi-assignment */}
                                                    {(card.assignees && card.assignees.length > 0) ? (
                                                        <div className={`ap-text-xs ap-flex ap-items-start ap-gap-1 ${isAssignedToMe ? 'ap-text-cyan-800 ap-font-medium' : 'ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3 ap-mt-0.5 ap-flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                <span className="ap-font-medium">Assigned to:</span>
                                                                {card.assignees.map((a, idx) => (
                                                                    <span key={a.user_id}>
                                                                        {a.user_name}{idx < (card.assignees?.length || 0) - 1 ? ', ' : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : card.assignee_name && (
                                                        <div className={`ap-text-xs ap-flex ap-items-center ap-gap-1 ${isAssignedToMe ? 'ap-text-cyan-800 ap-font-medium' : 'ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <span className="ap-font-medium">Assigned to:</span> {card.assignee_name}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Assigned To Roles - Multi-assignment */}
                                                    {(card.assigned_roles && card.assigned_roles.length > 0) ? (
                                                        <div className={`ap-text-xs ap-flex ap-items-start ap-gap-1 ${isAssignedToMe ? 'ap-text-cyan-800 ap-font-medium' : 'ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3 ap-mt-0.5 ap-flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                            </svg>
                                                            <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                <span className="ap-font-medium">Roles:</span>
                                                                {card.assigned_roles.map((r, idx) => (
                                                                    <span key={r.role_id}>
                                                                        {r.role_name}{idx < (card.assigned_roles?.length || 0) - 1 ? ', ' : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : card.role_name && (
                                                        <div className={`ap-text-xs ap-flex ap-items-center ap-gap-1 ${isAssignedToMe ? 'ap-text-cyan-800 ap-font-medium' : 'ap-text-gray-600'}`}>
                                                            <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                            </svg>
                                                            <span className="ap-font-medium">Role:</span> {card.role_name}
                                                        </div>
                                                    )}

                                                    {/* Comments Indicator */}
                                                    {(card.comments_count || 0) > 0 && (
                                                        <div className="ap-flex ap-items-center ap-justify-between ap-pt-1.5 ap-mt-1 ap-border-t ap-border-gray-100/50">
                                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                                <div className="ap-flex -ap-space-x-1.5 ap-overflow-hidden">
                                                                    {(card.commenters || []).slice(0, 3).map((user) => (
                                                                        <img
                                                                            key={`card-${card.card_id}-commenter-${user.user_id}`}
                                                                            src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_name)}&background=random`}
                                                                            alt={user.user_name}
                                                                            className="ap-inline-block ap-h-5 ap-w-5 ap-rounded-full ap-ring-2 ap-ring-white ap-object-cover ap-bg-gray-100"
                                                                            title={user.user_name}
                                                                        />
                                                                    ))}
                                                                    {(card.comments_count || 0) > 3 && (
                                                                       <span className="ap-flex ap-items-center ap-justify-center ap-h-5 ap-w-5 ap-rounded-full ap-ring-2 ap-ring-white ap-bg-gray-100 ap-text-[9px] ap-font-medium ap-text-gray-600">
                                                                           +{((card.comments_count || 0) - 3)}
                                                                       </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="ap-flex ap-items-center ap-gap-1 ap-text-[10px] ap-text-gray-400">
                                                                <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                                <span>{card.comments_count}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                    })}

                                    {/* Completed Cards Section - Hidden by default, lazy loaded */}
                                    {filteredCompletedCards.length > 0 && (
                                        <div className="ap-mt-2 ap-pt-2 ap-border-t ap-border-gray-200">
                                            <Button
                                                onClick={() => {
                                                    setCollapsedCompletedLists(prev => {
                                                        const newSet = new Set(prev);
                                                        if (newSet.has(list.list_id)) {
                                                            newSet.delete(list.list_id);
                                                            // Reset visible count when expanding
                                                            setBoardCompletedVisibleCount(prev => ({ ...prev, [list.list_id]: 25 }));
                                                        } else {
                                                            newSet.add(list.list_id);
                                                        }
                                                        return newSet;
                                                    });
                                                }}
                                                variant="ghost"
                                                size="xs"
                                                className="ap-w-full ap-text-left !ap-px-1 !ap-py-1 !ap-min-h-0 !ap-text-xs !ap-text-gray-500 hover:!ap-text-gray-700 !ap-justify-start !ap-gap-1.5"
                                            >
                                                <span className={`ap-transform ap-transition-transform ap-duration-200 ap-text-[10px] ${collapsedCompletedLists.has(list.list_id) ? '' : 'rotate-90'}`}>
                                                    ▶
                                                </span>
                                                <span>Completed</span>
                                                <span className="ap-bg-green-100 ap-text-green-700 ap-text-[10px] ap-px-1.5 ap-py-0.5 ap-rounded-full">
                                                    {filteredCompletedCards.length}
                                                </span>
                                            </Button>
                                            {!collapsedCompletedLists.has(list.list_id) && (() => {
                                                const visibleCount = boardCompletedVisibleCount[list.list_id] || 25;
                                                const visibleCards = filteredCompletedCards.slice(0, visibleCount);
                                                const hasMore = filteredCompletedCards.length > visibleCount;
                                                
                                                return (
                                                    <div className="ap-space-y-1.5 ap-mt-1.5">
                                                        {visibleCards.map((card) => (
                                                            <div
                                                                key={card.card_id}
                                                                onClick={() => openCardModal(card)}
                                                                className="ap-rounded-lg ap-p-2 ap-bg-gray-50 hover:ap-bg-gray-100 ap-transition-colors ap-cursor-pointer ap-border ap-border-gray-200"
                                                            >
                                                                <h4 className="ap-text-sm ap-text-gray-500 ap-line-through">{card.title}</h4>
                                                                <div className="ap-flex ap-items-center ap-gap-1.5 ap-mt-1">
                                                                    {card.assignee_profile_picture ? (
                                                                        <img 
                                                                            src={card.assignee_profile_picture} 
                                                                            alt=""
                                                                            className="ap-w-5 ap-h-5 ap-rounded-full ap-object-cover ap-opacity-50"
                                                                        />
                                                                    ) : card.assignee_name && (
                                                                        <div className="ap-w-5 ap-h-5 ap-rounded-full ap-bg-gray-200 ap-flex ap-items-center ap-justify-center ap-text-[10px] ap-text-gray-500">
                                                                            {card.assignee_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                        </div>
                                                                    )}
                                                                    <span className="ap-inline-flex ap-items-center ap-gap-0.5 ap-px-1.5 ap-py-0.5 ap-bg-green-100 ap-text-green-700 ap-text-[10px] ap-rounded">
                                                                        <svg className="ap-w-3 ap-h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Done
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {/* Load More Button */}
                                                        {hasMore && (
                                                            <Button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBoardCompletedVisibleCount(prev => ({
                                                                        ...prev,
                                                                        [list.list_id]: (prev[list.list_id] || 25) + 25
                                                                    }));
                                                                }}
                                                                variant="link"
                                                                size="xs"
                                                                className="ap-w-full !ap-py-1.5 !ap-text-xs !ap-font-medium ap-flex ap-items-center ap-justify-center ap-gap-1"
                                                            >
                                                                <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                                Load More ({filteredCompletedCards.length - visibleCount} remaining)
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Add Card Button / Quick Add Form - show if user can create cards */}
                                {canCreateCards && (
                                <div className="ap-flex-shrink-0 ap-px-2 ap-pb-2">
                                {quickAddListId === list.list_id ? (
                                    <div className="ap-space-y-2">
                                        <textarea
                                            value={quickAddTitle}
                                            onChange={(e) => setQuickAddTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey && quickAddTitle.trim()) {
                                                    e.preventDefault();
                                                    createCard(list.list_id, quickAddTitle.trim());
                                                    setQuickAddTitle('');
                                                } else if (e.key === 'Escape') {
                                                    setQuickAddListId(null);
                                                    setQuickAddTitle('');
                                                }
                                            }}
                                            placeholder="Enter card title..."
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-text-sm"
                                            autoFocus
                                        />
                                        <div className="ap-flex ap-items-center ap-gap-2">
                                            <Button
                                                onClick={() => {
                                                    if (quickAddTitle.trim()) {
                                                        createCard(list.list_id, quickAddTitle.trim());
                                                        setQuickAddTitle('');
                                                    }
                                                }}
                                                disabled={!quickAddTitle.trim()}
                                                variant="primary"
                                                size="xs"
                                            >
                                                Add
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setQuickAddListId(null);
                                                    setQuickAddTitle('');
                                                }}
                                                variant="secondary"
                                                size="xs"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => setQuickAddListId(list.list_id)}
                                        variant="ghost"
                                        size="sm"
                                        leftIcon={<HiOutlinePlus className="ap-w-4 ap-h-4" />}
                                        className="ap-w-full !ap-justify-start !ap-px-2 !ap-py-1.5 !ap-min-h-0 !ap-text-gray-500 hover:!ap-text-gray-700 hover:!ap-bg-gray-200"
                                    >
                                        Add a card
                                    </Button>
                                )}
                                </div>
                                )}
                            </div>
                        );
                        })}
                        
                        {/* Add List placeholder at end - only show if user can edit */}
                        {canEditCurrentDeck && !showNewListForm && (
                            <div className="ap-flex-shrink-0 ap-w-72 sm:ap-w-80">
                                <Button
                                    onClick={() => setShowNewListForm(true)}
                                    variant="ghost"
                                    className="!ap-w-full !ap-flex !ap-items-center !ap-gap-2 !ap-px-3 !ap-py-2.5 !ap-text-sm !ap-bg-white/60 hover:!ap-bg-white/80 !ap-text-gray-600 hover:!ap-text-gray-800 !ap-rounded-xl !ap-border-2 !ap-border-dashed !ap-border-gray-300 hover:!ap-border-gray-400"
                                >
                                    <HiOutlinePlus className="ap-w-4 ap-h-4" />
                                    Add another list
                                </Button>
                            </div>
                        )}
                    </div>
                        </>
                    ) : (
                        /* Grid View */
                        <div className="ap-flex-1 ap-overflow-auto">
                            {/* Grid view controls */}
                            <div className="ap-mb-3 ap-flex ap-flex-wrap ap-items-center ap-gap-4">
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <label className="ap-text-sm ap-text-gray-600">Group by:</label>
                                    <select
                                        value={gridGroupBy}
                                        onChange={(e) => setGridGroupBy(e.target.value as 'list' | 'assignee' | 'role')}
                                        className="ap-px-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-bg-white"
                                    >
                                        <option value="list">List</option>
                                        <option value="assignee">Assigned User</option>
                                        <option value="role">Assigned Role</option>
                                    </select>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <label className="ap-text-sm ap-text-gray-600">Filter by User:</label>
                                    <select
                                        value={filterByUser ?? ''}
                                        onChange={(e) => setFilterByUser(e.target.value ? Number(e.target.value) : null)}
                                        className="ap-px-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-bg-white"
                                    >
                                        <option value="">All Users</option>
                                        {dropdownUsers.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.displayName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <label className="ap-text-sm ap-text-gray-600">Filter by Role:</label>
                                    <select
                                        value={filterByRole ?? ''}
                                        onChange={(e) => setFilterByRole(e.target.value ? Number(e.target.value) : null)}
                                        className="ap-px-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-bg-white"
                                    >
                                        <option value="">All Roles</option>
                                        {dropdownRoles.map((role) => (
                                            <option key={role.role_id} value={role.role_id}>
                                                {role.role_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {(filterByUser || filterByRole) && (
                                    <Button
                                        onClick={() => {
                                            setFilterByUser(null);
                                            setFilterByRole(null);
                                        }}
                                        variant="ghost"
                                        size="xs"
                                        className="!ap-text-gray-600 hover:!ap-text-gray-800 !ap-underline"
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                            {/* Grid view table */}
                            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-overflow-hidden">
                                <div className="ap-overflow-x-auto">
                                <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                    <thead className="ap-bg-gray-50 ap-sticky ap-top-0">
                                        <tr>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-w-12">
                                                Done
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                                                Task
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden sm:ap-table-cell">
                                                List
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden lg:ap-table-cell">
                                                Description
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden md:ap-table-cell">
                                                Comments
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden md:ap-table-cell">
                                                Assigned To
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden md:ap-table-cell">
                                                Assigned Role
                                            </th>
                                            <th scope="col" className="ap-px-4 ap-py-3 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-hidden lg:ap-table-cell">
                                                Due Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="ap-bg-white ap-divide-y ap-divide-gray-200">
                                        {/* Active (incomplete) cards - always shown */}
                                        {getGroupedCardsForGrid(false).map((group) => {
                                            if (group.cards.length === 0) return null;
                                            
                                            return (
                                                <React.Fragment key={group.key}>
                                                    {/* Group header */}
                                                    <tr className="ap-bg-gray-50">
                                                        <td colSpan={6} className="ap-px-4 ap-py-2">
                                                            <span className="ap-font-medium ap-text-gray-700 ap-text-sm">{group.label}</span>
                                                            <span className="ap-ml-2 ap-text-xs ap-text-gray-500">({group.cards.length})</span>
                                                        </td>
                                                    </tr>
                                                    {group.cards.map((card) => {
                                                        const listInfo = lists.find(l => l.list_id === card.list_id);
                                                        const dueDateStyle = getDueDateStyle(card.due_date ?? null, card.is_complete);
                                                        const isAssignedToMe = isCardAssignedToUser(card);
                                                        
                                                        return (
                                                            <tr 
                                                                key={card.card_id}
                                                                onClick={() => openCardModal(card)}
                                                                className={`ap-cursor-pointer hover:ap-bg-gray-50 ap-transition-colors ${
                                                                    isAssignedToMe ? 'ap-bg-cyan-50/50' : ''
                                                                } ${card.is_complete === 1 ? 'ap-opacity-60' : ''}`}
                                                            >
                                                                {/* Complete checkbox */}
                                                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap">
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCardUpdate({
                                                                                ...card,
                                                                                is_complete: card.is_complete === 1 ? 0 : 1,
                                                                            });
                                                                        }}
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        className={`!ap-w-5 !ap-h-5 !ap-min-h-0 !ap-p-0 !ap-rounded !ap-border-2 !ap-flex !ap-items-center !ap-justify-center ${
                                                                            card.is_complete === 1
                                                                                ? '!ap-bg-green-500 !ap-border-green-500 !ap-text-white' : '!ap-border-gray-300 hover:!ap-border-blue-500 !ap-bg-transparent'
                                                                        }`}
                                                                    >
                                                                        {card.is_complete === 1 && (
                                                                            <svg className="ap-w-3 ap-h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        )}
                                                                    </Button>
                                                                </td>
                                                                {/* Task title */}
                                                                <td className="ap-px-4 ap-py-3">
                                                                    <div className={`ap-text-sm ap-font-medium ${card.is_complete === 1 ? 'ap-text-gray-400 ap-line-through' : 'ap-text-gray-900'}`}>
                                                                        {card.title}
                                                                    </div>
                                                                    {card.description && (
                                                                        <div className="ap-text-xs ap-text-gray-500 ap-truncate ap-max-w-xs ap-mt-0.5 lg:ap-hidden">
                                                                            {card.description}
                                                                        </div>
                                                                    )}
                                                                    {/* Mobile: show list and assignee inline */}
                                                                    <div className="sm:ap-hidden ap-mt-1 ap-flex ap-flex-wrap ap-gap-2 ap-text-xs">
                                                                        {listInfo && (
                                                                            <span className="ap-inline-flex ap-items-center ap-px-1.5 ap-py-0.5 ap-rounded ap-bg-gray-100 ap-text-gray-600">
                                                                                {listInfo.list_name}
                                                                            </span>
                                                                        )}
                                                                        {(card.assignee_name || card.role_name) && (
                                                                            <span className="ap-inline-flex ap-items-center ap-px-1.5 ap-py-0.5 ap-rounded ap-bg-blue-50 ap-text-blue-700">
                                                                                {card.assignee_name || card.role_name}
                                                                            </span>
                                                                        )}
                                                                        {/* Mobile: Checklist progress */}
                                                                        {typeof card.checklist_total === 'number' && card.checklist_total > 0 && (
                                                                            <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-1.5 ap-py-0.5 ap-rounded ${
                                                                                card.checklist_completed === card.checklist_total 
                                                                                    ? 'ap-bg-green-100 ap-text-green-700' : 'ap-bg-gray-100 ap-text-gray-600'
                                                                            }`}>
                                                                                <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                                                </svg>
                                                                                {card.checklist_completed || 0}/{card.checklist_total}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Checklist items preview (like board view) - show on all screen sizes */}
                                                                    {card.checklist_items && card.checklist_items.length > 0 && (
                                                                        <div className="ap-mt-2 ap-space-y-0.5">
                                                                            {card.checklist_items.slice(0, 3).map((item) => (
                                                                                <div key={item.checklist_id} className="ap-flex ap-items-center ap-gap-1.5 ap-text-xs">
                                                                                    <span className={`ap-flex-shrink-0 ap-w-3 ap-h-3 ap-rounded ap-border ap-flex ap-items-center ap-justify-center ${
                                                                                        item.is_complete === 1 
                                                                                            ? 'ap-bg-green-500 ap-border-green-500 ap-text-white' : 'ap-border-gray-300'
                                                                                    }`}>
                                                                                        {item.is_complete === 1 && (
                                                                                            <svg className="ap-w-2 ap-h-2" fill="currentColor" viewBox="0 0 20 20">
                                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                            </svg>
                                                                                        )}
                                                                                    </span>
                                                                                    <span className={`ap-truncate ${item.is_complete === 1 ? 'ap-line-through ap-text-gray-400' : 'ap-text-gray-600'}`}>
                                                                                        {item.item_text}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                            {card.checklist_items.length > 3 && (
                                                                                <div className="ap-text-xs ap-text-gray-400">
                                                                                    +{card.checklist_items.length - 3} more
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                {/* List */}
                                                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-hidden sm:ap-table-cell">
                                                                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-700">
                                                                        {listInfo?.list_name || 'Unknown'}
                                                                    </span>
                                                                </td>
                                                                {/* Description - Custom scrollable wide column */}
                                                                <td className="ap-px-4 ap-py-3 ap-hidden lg:ap-table-cell ap-min-w-[300px] ap-max-w-[500px]">
                                                                    {card.description ? (
                                                                        <div className="ap-text-sm ap-text-gray-600 line-clamp-3 ap-whitespace-normal" title={card.description}>
                                                                            {card.description}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="ap-text-gray-400 ap-text-xs">-</span>
                                                                    )}
                                                                </td>
                                                                {/* Comments */}
                                                                <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                    {(card.comments_count || 0) > 0 ? (
                                                                        <div className="ap-flex ap-items-center ap-gap-2">
                                                                            <div className="ap-flex -ap-space-x-1.5 ap-overflow-hidden">
                                                                                {(card.commenters || []).slice(0, 3).map((user) => (
                                                                                    <img
                                                                                        key={`grid-card-${card.card_id}-commenter-${user.user_id}`}
                                                                                        src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_name)}&background=random`}
                                                                                        alt={user.user_name}
                                                                                        className="ap-inline-block ap-h-6 ap-w-6 ap-rounded-full ap-ring-2 ap-ring-white ap-object-cover ap-bg-gray-100"
                                                                                        title={user.user_name}
                                                                                    />
                                                                                ))}
                                                                                {(card.comments_count || 0) > 3 && (
                                                                                    <span className="ap-flex ap-items-center ap-justify-center ap-h-6 ap-w-6 ap-rounded-full ap-ring-2 ap-ring-white ap-bg-gray-100 ap-text-[10px] ap-font-medium ap-text-gray-600">
                                                                                        +{((card.comments_count || 0) - 3)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="ap-text-xs ap-text-gray-500">({card.comments_count})</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="ap-text-gray-400 ap-text-xs">-</span>
                                                                    )}
                                                                </td>
                                                                {/* Assigned To */}
                                                                <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                    <div className="ap-flex ap-items-center ap-gap-2">
                                                                        {card.assignee_profile_picture ? (
                                                                            <img 
                                                                                src={card.assignee_profile_picture} 
                                                                                alt=""
                                                                                className="ap-w-6 ap-h-6 ap-rounded-full ap-object-cover ap-flex-shrink-0"
                                                                            />
                                                                        ) : (card.assignees && card.assignees.length > 0) || card.assignee_name ? (
                                                                            <div className="ap-w-6 ap-h-6 ap-rounded-full ap-bg-blue-50 ap-flex ap-items-center ap-justify-center ap-text-[10px] ap-text-blue-600 ap-font-medium ap-flex-shrink-0">
                                                                                {((card.assignees?.[0]?.user_name || card.assignee_name || '').split(' ').map(n => n[0]).join('').slice(0, 2))}
                                                                            </div>
                                                                        ) : null}
                                                                        <div className="ap-flex ap-flex-col ap-min-w-0">
                                                                            {/* Multi-user assignment - show ALL users */}
                                                                            {(card.assignees && card.assignees.length > 0) ? (
                                                                                <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                                    {card.assignees.map((a) => (
                                                                                        <span key={a.user_id} className="ap-text-xs ap-text-gray-700 ap-truncate">{a.user_name}</span>
                                                                                    ))}
                                                                                </div>
                                                                            ) : card.assignee_name ? (
                                                                                <span className="ap-text-sm ap-text-gray-700 ap-truncate">{card.assignee_name}</span>
                                                                            ) : (
                                                                                <span className="ap-text-sm ap-text-gray-400">-</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                {/* Assigned Role - separate column for roles */}
                                                                <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                    <div className="ap-flex ap-flex-col ap-min-w-0">
                                                                        {/* Multi-role assignment - show ALL roles */}
                                                                        {(card.assigned_roles && card.assigned_roles.length > 0) ? (
                                                                            <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                                {card.assigned_roles.map((r) => (
                                                                                    <span key={r.role_id} className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-purple-100 ap-text-purple-700">{r.role_name}</span>
                                                                                ))}
                                                                            </div>
                                                                        ) : card.role_name ? (
                                                                            <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-purple-100 ap-text-purple-700">{card.role_name}</span>
                                                                        ) : (
                                                                            <span className="ap-text-sm ap-text-gray-400">-</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {/* Due Date */}
                                                                <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-hidden lg:ap-table-cell">
                                                                    {card.due_date ? (
                                                                        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-text-xs ap-rounded ${dueDateStyle.bg} ${dueDateStyle.text}`}>
                                                                            {dueDateStyle.icon && <span>{dueDateStyle.icon}</span>}
                                                                            {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="ap-text-gray-400 ap-text-sm">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                                
                                {/* Empty state for grid view */}
                                {getGroupedCardsForGrid(false).every(group => group.cards.length === 0) && !showCompletedInGrid && (
                                    <div className="ap-py-12 ap-text-center ap-text-gray-500">
                                        <p>No active cards match your filters.</p>
                                    </div>
                                )}
                                
                                {/* Completed Cards Section */}
                                {(() => {
                                    const completedCount = getCompletedCardsCount();
                                    if (completedCount === 0) return null;
                                    
                                    return (
                                        <div className="ap-border-t ap-border-gray-200">
                                            {/* Show/Hide Completed Cards Button */}
                                            <Button
                                                onClick={() => {
                                                    if (!showCompletedInGrid) {
                                                        setCompletedCardsVisibleCount(25); // Reset to initial count when showing
                                                    }
                                                    setShowCompletedInGrid(!showCompletedInGrid);
                                                }}
                                                variant="ghost"
                                                className="!ap-w-full !ap-px-4 !ap-py-3 !ap-flex !ap-items-center !ap-justify-center !ap-gap-2 !ap-text-sm !ap-text-gray-600 hover:!ap-bg-gray-50 !ap-rounded-none"
                                            >
                                                <svg className={`ap-w-4 ap-h-4 ap-transition-transform ${showCompletedInGrid ? 'ap-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                                <span className="ap-font-medium">
                                                    {showCompletedInGrid ? 'Hide' : 'Show'} Completed Cards
                                                </span>
                                                <span className="ap-bg-green-100 ap-text-green-700 ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full">
                                                    {completedCount}
                                                </span>
                                            </Button>
                                            
                                            {/* Completed Cards Table (lazy loaded) */}
                                            {showCompletedInGrid && (
                                                <div className="ap-bg-gray-50/50">
                                                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                                        <tbody className="ap-divide-y ap-divide-gray-100">
                                                            {(() => {
                                                                // Collect all completed cards across all lists
                                                                const allCompletedCards: TaskCard[] = [];
                                                                lists.forEach(list => {
                                                                    const listCards = cardsByList[list.list_id] || [];
                                                                    allCompletedCards.push(...filterCards(listCards).filter(c => c.is_complete === 1));
                                                                });
                                                                
                                                                // Only show up to completedCardsVisibleCount cards
                                                                const visibleCompleted = allCompletedCards.slice(0, completedCardsVisibleCount);
                                                                const hasMore = allCompletedCards.length > completedCardsVisibleCount;
                                                                
                                                                return (
                                                                    <>
                                                                        {visibleCompleted.map((card) => {
                                                                            const listInfo = lists.find(l => l.list_id === card.list_id);
                                                                            const isAssignedToMe = isCardAssignedToUser(card);
                                                                            
                                                                            return (
                                                                                <tr 
                                                                                    key={card.card_id}
                                                                                    onClick={() => openCardModal(card)}
                                                                                    className={`ap-cursor-pointer hover:ap-bg-gray-100 ap-transition-colors ap-opacity-60 ${
                                                                                        isAssignedToMe ? 'ap-bg-cyan-50/30' : 'ap-bg-gray-50/50'
                                                                                    }`}
                                                                                >
                                                                                    {/* Complete checkbox */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-w-12">
                                                                                        <Button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleCardUpdate({
                                                                                                    ...card,
                                                                                                    is_complete: 0,
                                                                                                });
                                                                                            }}
                                                                                            variant="ghost"
                                                                                            size="xs"
                                                                                            className="!ap-w-5 !ap-h-5 !ap-min-h-0 !ap-p-0 !ap-rounded !ap-border-2 !ap-flex !ap-items-center !ap-justify-center !ap-bg-green-500 !ap-border-green-500 !ap-text-white"
                                                                                        >
                                                                                            <svg className="ap-w-3 ap-h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                            </svg>
                                                                                        </Button>
                                                                                    </td>
                                                                                    {/* Task title */}
                                                                                    <td className="ap-px-4 ap-py-3">
                                                                                        <div className="ap-text-sm ap-font-medium ap-text-gray-400 ap-line-through">
                                                                                            {card.title}
                                                                                        </div>
                                                                                    </td>
                                                                                    {/* List */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-hidden sm:ap-table-cell">
                                                                                        <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-500">
                                                                                            {listInfo?.list_name || 'Unknown'}
                                                                                        </span>
                                                                                    </td>
                                                                                    {/* Description */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-hidden lg:ap-table-cell ap-min-w-[300px] ap-max-w-[500px]">
                                                                                        {card.description ? (
                                                                                            <div className="ap-text-sm ap-text-gray-400 ap-line-through line-clamp-1 ap-whitespace-normal">
                                                                                                {card.description}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="ap-text-gray-400 ap-text-xs">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                    {/* Comments */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                                        {(card.comments_count || 0) > 0 ? (
                                                                                            <span className="ap-text-xs ap-text-gray-400 ap-gap-1 ap-flex ap-items-center">
                                                                                                <svg className="ap-w-3 ap-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                                                </svg>
                                                                                                {card.comments_count}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="ap-text-gray-400 ap-text-xs">-</span>
                                                                                        )}
                                                                                    </td>
                                                                                    {/* Assigned To */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                                        <span className="ap-text-sm ap-text-gray-400">
                                                                                            {card.assignees && card.assignees.length > 0
                                                                                                ? card.assignees.map(a => a.user_name).join(', ')
                                                                                                : card.assignee_name || '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                    {/* Assigned Role */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-hidden md:ap-table-cell">
                                                                                        <span className="ap-text-sm ap-text-gray-400">
                                                                                            {card.assigned_roles && card.assigned_roles.length > 0
                                                                                                ? card.assigned_roles.map(r => r.role_name).join(', ')
                                                                                                : card.role_name || '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                    {/* Due Date */}
                                                                                    <td className="ap-px-4 ap-py-3 ap-whitespace-nowrap ap-hidden lg:ap-table-cell">
                                                                                        <span className="ap-text-sm ap-text-gray-400">
                                                                                            {card.due_date 
                                                                                                ? new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                                                                : '-'}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {/* Load More Button */}
                                                                        {hasMore && (
                                                                            <tr>
                                                                                <td colSpan={6} className="ap-px-4 ap-py-3">
                                                                                    <Button
                                                                                        onClick={() => setCompletedCardsVisibleCount(prev => prev + 25)}
                                                                                        variant="ghost"
                                                                                        className="!ap-w-full !ap-py-2 !ap-text-sm !ap-text-blue-600 hover:!ap-text-blue-700 !ap-font-medium !ap-flex !ap-items-center !ap-justify-center !ap-gap-2"
                                                                                    >
                                                                                        <svg className="ap-w-4 ap-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                                        </svg>
                                                                                        Load More ({allCompletedCards.length - completedCardsVisibleCount} remaining)
                                                                                    </Button>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="ap-flex-1 ap-flex ap-items-center ap-justify-center">
                    <div className="ap-text-center ap-py-12 ap-px-6 ap-bg-white ap-rounded-xl ap-shadow-sm ap-max-w-md">
                        <div className="ap-w-16 ap-h-16 ap-bg-blue-50 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                            <svg className="ap-w-8 ap-h-8 ap-text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                        </div>
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">No Decks Yet</h3>
                        <p className="ap-text-gray-600 ap-mb-4">Create your first deck to start organizing tasks with Kanban boards.</p>
                        <Button
                            onClick={() => setShowNewDeckForm(true)}
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="ap-w-5 ap-h-5" />}
                        >
                            Create Your First Deck
                        </Button>
                    </div>
                </div>
            )}

            {/* Card Detail Modal */}
            {isCardModalOpen && selectedCard && (
                <TaskCardModal
                    key={selectedCard.card_id}
                    card={selectedCard}
                    onClose={closeCardModal}
                    currentUser={currentUser}
                    onUpdate={handleCardUpdate}
                    onMoveToList={handleMoveToList}
                    onDelete={(cardId) => deleteCard(cardId, selectedCard.list_id)}
                    canEdit={canEditCard(selectedCard)}
                    canDelete={canDeleteCard(selectedCard)}
                    isPrimaryDeck={isPrimaryDeck}
                    preloadedUsers={dropdownUsers}
                    preloadedRoles={dropdownRoles}
                    preloadedLocations={dropdownLocations}
                    preloadedCategories={dropdownCategories}
                    availableLists={lists.map(list => ({ list_id: list.list_id, name: list.list_name }))}
                />
            )}

            {/* Edit Deck Modal */}
            {showEditDeckModal && selectedDeck && (
                <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-z-50 ap-flex ap-items-center ap-justify-center ap-p-4">
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-w-full ap-max-w-md">
                        <div className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-border-b ap-border-gray-200">
                            <h3 className="ap-text-lg ap-font-semibold">Edit Deck Settings</h3>
                            <Button
                                onClick={() => setShowEditDeckModal(false)}
                                variant="ghost"
                                size="sm"
                                className="!ap-p-1 !ap-min-h-0"
                            >
                                <svg className="ap-w-5 ap-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>
                        <div className="ap-p-4 ap-space-y-4">
                            {/* Deck Name */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Deck Name
                                </label>
                                <input
                                    type="text"
                                    value={editDeckName}
                                    onChange={(e) => setEditDeckName(e.target.value)}
                                    className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                                />
                            </div>
                            
                            {/* Visibility */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Visibility
                                </label>
                                <div className="ap-space-y-2">
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-cursor-pointer ap-rounded-lg ap-border-2 ap-transition-all ${
                                            !editDeckIsPublic 
                                                ? 'ap-border-blue-500 ap-bg-blue-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="editDeckVisibility"
                                            checked={!editDeckIsPublic}
                                            onChange={() => setEditDeckIsPublic(false)}
                                            className="ap-mt-0.5 ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500"
                                        />
                                        <div>
                                            <span className={`ap-font-medium ${!editDeckIsPublic ? 'ap-text-blue-600' : 'ap-text-gray-700'}`}>
                                                🔒 Private
                                            </span>
                                            <p className="ap-text-gray-500 ap-text-xs">Only you can see and edit this deck</p>
                                        </div>
                                    </label>
                                    {/* Public option - only show if user has permission, is admin, or deck is already public */}
                                    {(_userPermissions.canCreatePublicDecks || window.mentorshipPlatformData?.is_admin || selectedDeck.is_public === 1) ? (
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-cursor-pointer ap-rounded-lg ap-border-2 ap-transition-all ${
                                            editDeckIsPublic 
                                                ? 'ap-border-blue-500 ap-bg-blue-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="editDeckVisibility"
                                            checked={editDeckIsPublic}
                                            onChange={() => setEditDeckIsPublic(true)}
                                            className="ap-mt-0.5 ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500"
                                        />
                                        <div>
                                            <span className={`ap-font-medium ${editDeckIsPublic ? 'ap-text-blue-600' : 'ap-text-gray-700'}`}>
                                                🌐 Public
                                            </span>
                                            <p className="ap-text-gray-500 ap-text-xs">
                                                Visible to users based on their role permissions.
                                            </p>
                                        </div>
                                    </label>
                                    ) : (
                                    <div className="ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-rounded-lg ap-border-2 ap-border-gray-200 ap-bg-gray-50 ap-opacity-60">
                                        <div className="ap-mt-0.5 ap-w-4 ap-h-4 ap-border ap-border-gray-300 ap-rounded-full ap-bg-gray-100"></div>
                                        <div>
                                            <span className="ap-font-medium ap-text-gray-500">
                                                🌐 Public
                                            </span>
                                            <p className="ap-text-gray-400 ap-text-xs">
                                                You don't have permission to make decks public.
                                            </p>
                                        </div>
                                    </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Warning when changing from public to private */}
                            {selectedDeck.is_public === 1 && !editDeckIsPublic && (
                                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-3 ap-text-sm ap-text-yellow-800">
                                    <strong>Note:</strong> Making this deck private will hide it from other users.
                                </div>
                            )}
                            
                            {/* Warning when changing from private to public */}
                            {selectedDeck.is_public === 0 && editDeckIsPublic && (
                                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-3 ap-text-sm ap-text-blue-800">
                                    <strong>Note:</strong> Making this deck public will allow other users (based on their role permissions) to view it.
                                </div>
                            )}

                            {/* Primary Deck Toggle - only show if user has permission */}
                            {(isAdmin || _userPermissions.canManagePrimaryDeck) && (
                                <div className="ap-pt-4 ap-border-t ap-border-gray-200">
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                        System Primary Deck
                                    </label>
                                    <label 
                                        className={`ap-flex ap-items-start ap-gap-3 ap-p-3 ap-text-sm ap-cursor-pointer ap-rounded-lg ap-border-2 ap-transition-all ${
                                            editDeckIsPrimary 
                                                ? 'ap-border-yellow-400 ap-bg-yellow-50' : 'ap-border-gray-200 hover:ap-border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={editDeckIsPrimary}
                                            onChange={(e) => setEditDeckIsPrimary(e.target.checked)}
                                            className="ap-mt-0.5 ap-w-4 ap-h-4 ap-text-yellow-500 focus:ap-ring-yellow-400 ap-rounded"
                                        />
                                        <div>
                                            <span className={`ap-font-medium ${editDeckIsPrimary ? 'ap-text-yellow-700' : 'ap-text-gray-700'}`}>
                                                ⭐ Set as Primary Deck
                                            </span>
                                            <p className="ap-text-gray-500 ap-text-xs">
                                                Primary deck appears first for all users and is always public.
                                                Only one deck can be primary at a time.
                                            </p>
                                        </div>
                                    </label>
                                    {editDeckIsPrimary && !editDeckIsPublic && (
                                        <p className="ap-mt-2 ap-text-xs ap-text-yellow-700">
                                            Note: Setting as primary will also make this deck public.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-border-t ap-border-gray-200 ap-bg-gray-50 ap-rounded-b-lg">
                            {/* Delete button - only for deck owner, never on primary deck */}
                            {canDeleteDeck && (
                                <Button
                                    onClick={deleteDeck}
                                    variant="ghost"
                                    size="sm"
                                    className="!ap-text-red-600 hover:!ap-text-red-800 hover:!ap-bg-red-50"
                                >
                                    Delete Deck
                                </Button>
                            )}
                            {!canDeleteDeck && <div />}
                            <div className="ap-flex ap-gap-2">
                                <Button
                                    onClick={() => setShowEditDeckModal(false)}
                                    variant="secondary"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={updateDeck}
                                    disabled={!editDeckName.trim()}
                                    variant="primary"
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskDeck;
