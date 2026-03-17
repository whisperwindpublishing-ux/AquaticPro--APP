import React, { useState, useEffect, useRef } from 'react';
import {
    TaskCard,
    UserProfile,
    CardComment,
    CardAttachment,
    ChecklistItem,
    CardActivity,
    TaskLocation,
    TaskRole,
} from '@/types';
import { getCachedUsers } from '@/services/userCache';
import { getLocations } from '@/services/api';
import { Button } from './ui';
import { formatLocalDate } from '@/utils/dateUtils';

// Simple user type for assignment dropdown
interface SimpleUser {
    id: number;
    displayName: string;
    firstName: string | undefined;
    lastName: string | undefined;
    email: string | undefined;
}

// Module-level cache for dropdown data (persists across modal opens)
const dropdownCache: {
    users: SimpleUser[] | null;
    roles: TaskRole[] | null;
    locations: TaskLocation[] | null;
    categories: string[] | null;
    lastFetched: number;
} = {
    users: null,
    roles: null,
    locations: null,
    categories: null,
    lastFetched: 0,
};

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Helper to format date strings for HTML date inputs (requires yyyy-MM-dd)
const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    // Handle both "2025-12-17 00:00:00" (MySQL) and "2025-12-17T00:00:00" (ISO) formats
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
};

// Predefined accent colors for card styling
const ACCENT_COLORS = [
    { value: '', label: 'Auto (from category)', color: '' },
    { value: '#ef4444', label: 'Red', color: 'bg-red-500' },
    { value: '#f97316', label: 'Orange', color: 'bg-orange-500' },
    { value: '#eab308', label: 'Yellow', color: 'bg-yellow-500' },
    { value: '#22c55e', label: 'Green', color: 'bg-green-500' },
    { value: '#06b6d4', label: 'Cyan', color: 'bg-cyan-500' },
    { value: '#3b82f6', label: 'Blue', color: 'bg-blue-500' },
    { value: '#8b5cf6', label: 'Purple', color: 'bg-purple-500' },
    { value: '#ec4899', label: 'Pink', color: 'bg-pink-500' },
    { value: '#6b7280', label: 'Gray', color: 'bg-gray-500' },
];

import {
    HiXMark,
    HiOutlinePaperClip,
    HiOutlineCheckCircle,
    HiOutlineChatBubbleLeft,
    HiOutlineClipboardDocumentList,
    HiOutlineTrash,
    HiOutlinePlus,
    HiOutlineCalendar,
    HiOutlineUser,
    HiOutlineTag,
    HiOutlineMapPin,
    HiBars3,
    HiOutlineQueueList,
    HiOutlineSwatch,
    HiOutlineMagnifyingGlass,
    HiOutlineHandThumbUp,
    HiOutlineHandThumbDown,
    HiOutlineHeart,
    HiHandThumbUp,
    HiHandThumbDown,
    HiHeart,
} from 'react-icons/hi2';

// List info for the list picker
interface ListInfo {
    list_id: number;
    name: string;
}

interface TaskCardModalProps {
    card: TaskCard;
    onClose: () => void;
    currentUser: UserProfile;
    onUpdate?: (updatedCard: TaskCard) => void;
    onMoveToList?: (cardId: number, newListId: number) => void; // Callback for moving card to different list
    onDelete?: (cardId: number) => void; // Callback for deleting card
    canEdit?: boolean; // Whether user can edit this card
    canDelete?: boolean; // Whether user can delete this card
    isPrimaryDeck?: boolean; // Whether this card is from the primary deck
    // Pre-loaded dropdown data from parent
    preloadedUsers?: SimpleUser[];
    preloadedRoles?: TaskRole[];
    preloadedLocations?: TaskLocation[];
    preloadedCategories?: string[];
    availableLists?: ListInfo[]; // Lists available for moving the card
}

type TabType = 'details' | 'comments' | 'attachments' | 'activity';

const TaskCardModal: React.FC<TaskCardModalProps> = ({ 
    card, 
    onClose, 
    currentUser, 
    onUpdate,
    onMoveToList,
    onDelete,
    canEdit = true, // Default to true for backward compatibility
    canDelete = false, // Default to false - must be explicitly enabled
    isPrimaryDeck = false,
    preloadedUsers,
    preloadedRoles,
    preloadedLocations,
    preloadedCategories,
    availableLists = [],
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('details');
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    // Card details
    const [title, setTitle] = useState(card.title);
    const [description, setDescription] = useState(card.description || '');
    const [assignedTo, setAssignedTo] = useState<number | null>(card.assigned_to || null);
    const [locationId, setLocationId] = useState<number | null>(card.location_id || null);
    const [dueDate, setDueDate] = useState(formatDateForInput(card.due_date));
    const [categoryTag, setCategoryTag] = useState(card.category_tag || '');
    const [accentColor, setAccentColor] = useState(card.accent_color || '');
    const [isComplete, setIsComplete] = useState(card.is_complete === 1);
    
    // Multi-assignment state - ensure IDs are numbers for proper comparison
    const [selectedAssignees, setSelectedAssignees] = useState<number[]>(
        card.assignees?.map(a => Number(a.user_id)) || (card.assigned_to ? [Number(card.assigned_to)] : [])
    );
    const [selectedRoles, setSelectedRoles] = useState<number[]>(
        card.assigned_roles?.map(r => Number(r.role_id)) || (card.assigned_to_role_id ? [Number(card.assigned_to_role_id)] : [])
    );
    
    // Search filters for assignment lists
    const [userSearchFilter, setUserSearchFilter] = useState('');
    const [roleSearchFilter, setRoleSearchFilter] = useState('');
    
    // Comments
    const [comments, setComments] = useState<CardComment[]>([]);
    const [newComment, setNewComment] = useState('');
    
    // Attachments
    const [attachments, setAttachments] = useState<CardAttachment[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    
    // Checklist
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [newChecklistItem, setNewChecklistItem] = useState('');
    
    // Activity
    const [activities, setActivities] = useState<CardActivity[]>([]);
    
    // Users and data for dropdowns - use preloaded data if available
    const [users, setUsers] = useState<SimpleUser[]>(preloadedUsers || []);
    const [roles, setRoles] = useState<TaskRole[]>(preloadedRoles || []);
    const [locations, setLocations] = useState<TaskLocation[]>(preloadedLocations || []);
    const [availableCategories, setAvailableCategories] = useState<string[]>(preloadedCategories || []);
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
    
    const [assignedToRole, setAssignedToRole] = useState<number | null>(card.assigned_to_role_id || null);
    
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    
    // Track if checklist has been initialized locally (to prevent parent card updates from resetting it)
    const checklistInitialized = useRef(false);
    
    // Track if modal has taken ownership of card state (to prevent parent updates from resetting local changes)
    const modalInitialized = useRef(false);
    const lastCardId = useRef(card.card_id);

    // Reset when card_id changes (different card opened)
    useEffect(() => {
        if (lastCardId.current !== card.card_id) {
            modalInitialized.current = false;
            checklistInitialized.current = false;
            lastCardId.current = card.card_id;
        }
    }, [card.card_id]);

    // Update states when card prop changes (fixes checkbox not reflecting current state)
    // Only sync from card on initial mount, not on subsequent updates that we triggered
    useEffect(() => {
        if (!modalInitialized.current) {
            // First mount - sync all values from card
            setTitle(card.title);
            setDescription(card.description || '');
            setAssignedTo(card.assigned_to || null);
            setAssignedToRole(card.assigned_to_role_id || null);
            setLocationId(card.location_id || null);
            setDueDate(formatDateForInput(card.due_date));
            setCategoryTag(card.category_tag || '');
            setAccentColor(card.accent_color || '');
            setIsComplete(card.is_complete === 1);
            
            // Multi-assignment init - ensure IDs are numbers for proper comparison
            const assignees = card.assignees?.map(a => Number(a.user_id)) || (card.assigned_to ? [Number(card.assigned_to)] : []);
            const roles = card.assigned_roles?.map(r => Number(r.role_id)) || (card.assigned_to_role_id ? [Number(card.assigned_to_role_id)] : []);
            setSelectedAssignees(assignees);
            setSelectedRoles(roles);
            
            // Only set checklist items on initial load
            if (card.checklist_items && card.checklist_items.length > 0) {
                setChecklistItems(card.checklist_items);
                checklistInitialized.current = true;
            }
            
            modalInitialized.current = true;
        }
    }, [card, card.card_id]);

    // Sync preloaded data when it becomes available (may arrive after initial mount)
    useEffect(() => {
        if (preloadedUsers?.length && users.length === 0) {
            setUsers(preloadedUsers);
        }
    }, [preloadedUsers, users.length]);

    useEffect(() => {
        if (preloadedRoles?.length && roles.length === 0) {
            setRoles(preloadedRoles);
        }
    }, [preloadedRoles, roles.length]);

    useEffect(() => {
        if (preloadedLocations?.length && locations.length === 0) {
            setLocations(preloadedLocations);
        }
    }, [preloadedLocations, locations.length]);

    useEffect(() => {
        if (preloadedCategories?.length && availableCategories.length === 0) {
            setAvailableCategories(preloadedCategories);
        }
    }, [preloadedCategories, availableCategories.length]);

    useEffect(() => {
        // Only fetch dropdown data if not preloaded
        if (!preloadedUsers?.length || !preloadedRoles?.length || !preloadedLocations?.length) {
            Promise.all([
                !preloadedUsers?.length ? fetchUsers() : Promise.resolve(),
                !preloadedRoles?.length ? fetchRoles() : Promise.resolve(),
                !preloadedLocations?.length ? fetchLocations() : Promise.resolve(),
                !preloadedCategories?.length ? fetchCategories() : Promise.resolve(),
            ]);
        }
        
        // Only fetch card-specific data for existing cards (positive IDs)
        // Skip for new/unsaved cards with temporary negative IDs
        if (card.card_id > 0) {
            // Fetch card-specific data in parallel (comments, attachments, etc.)
            // Only fetch checklist if not pre-loaded from card data
            const fetchPromises = [
                fetchComments(),
                fetchAttachments(),
                fetchActivity(),
            ];
            
            // Only fetch checklist if card doesn't have pre-loaded items
            if (!card.checklist_items || card.checklist_items.length === 0) {
                fetchPromises.push(fetchChecklist());
            }
            
            Promise.all(fetchPromises);
        }
        
        // Cleanup on unmount
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Track if user has made changes (to avoid saving unchanged data)
    const hasChanges = useRef(false);
    const initialValues = useRef({
        title: card.title,
        description: card.description || '',
        assignedTo: card.assigned_to || null,
        assignedToRole: card.assigned_to_role_id || null,
        locationId: card.location_id || null,
        dueDate: formatDateForInput(card.due_date),
        categoryTag: card.category_tag || '',
        accentColor: card.accent_color || '',
        isComplete: card.is_complete === 1,
        selectedAssignees: card.assignees?.map(a => a.user_id) || (card.assigned_to ? [card.assigned_to] : []),
        selectedRoles: card.assigned_roles?.map(r => r.role_id) || (card.assigned_to_role_id ? [card.assigned_to_role_id] : []),
    });

    // Debounced auto-save effect - only save on dropdown/checkbox changes, not text
    useEffect(() => {
        // Only auto-save for non-text field changes
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Check if any dropdown/checkbox values changed
        const hasDropdownChanges = 
            assignedTo !== initialValues.current.assignedTo ||
            assignedToRole !== initialValues.current.assignedToRole ||
            locationId !== initialValues.current.locationId ||
            dueDate !== initialValues.current.dueDate ||
            categoryTag !== initialValues.current.categoryTag ||
            accentColor !== initialValues.current.accentColor ||
            isComplete !== initialValues.current.isComplete ||
            JSON.stringify(selectedAssignees) !== JSON.stringify(initialValues.current.selectedAssignees) ||
            JSON.stringify(selectedRoles) !== JSON.stringify(initialValues.current.selectedRoles);
        
        if (hasDropdownChanges) {
            hasChanges.current = true;
            // Auto-save dropdown/checkbox changes after 500ms
            saveTimeoutRef.current = setTimeout(() => {
                saveCardDetails();
                // Update initial values after save
                initialValues.current = {
                    ...initialValues.current,
                    assignedTo,
                    assignedToRole,
                    locationId,
                    dueDate,
                    categoryTag,
                    accentColor,
                    isComplete,
                    selectedAssignees: [...selectedAssignees],
                    selectedRoles: [...selectedRoles],
                };
            }, 500);
        }
        
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [assignedTo, assignedToRole, locationId, dueDate, categoryTag, accentColor, isComplete, selectedAssignees, selectedRoles]);

    const fetchUsers = async () => {
        // Check local cache first (for roles/locations that are fetched separately)
        const now = Date.now();
        if (dropdownCache.users && (now - dropdownCache.lastFetched) < CACHE_DURATION) {
            setUsers(dropdownCache.users);
            return;
        }
        
        try {
            // Use centralized cache - already sorted
            const usersData = await getCachedUsers();
            const formattedUsers: SimpleUser[] = usersData.map((user) => ({
                id: Number(user.user_id),  // Ensure number for comparison with selectedAssignees
                displayName: user.display_name,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.user_email,
            }));
            dropdownCache.users = formattedUsers;
            dropdownCache.lastFetched = now;
            setUsers(formattedUsers);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const fetchRoles = async () => {
        // Check cache first
        if (dropdownCache.roles && (Date.now() - dropdownCache.lastFetched) < CACHE_DURATION) {
            setRoles(dropdownCache.roles);
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskdecks/roles`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                // Ensure role_id is a number for comparison
                const normalizedRoles = data.map((role: any) => ({
                    ...role,
                    role_id: Number(role.role_id),
                    tier: role.tier ? Number(role.tier) : null,
                }));
                dropdownCache.roles = normalizedRoles;
                setRoles(normalizedRoles);
            } else {
                console.error('Failed to fetch roles, status:', response.status);
            }
        } catch (err) {
            console.error('Failed to fetch roles:', err);
        }
    };

    const fetchLocations = async () => {
        // Check cache first
        if (dropdownCache.locations && (Date.now() - dropdownCache.lastFetched) < CACHE_DURATION) {
            setLocations(dropdownCache.locations);
            return;
        }
        
        try {
            const locationsData = await getLocations();
            // Filter to only active locations and map to TaskLocation format
            const activeLocations: TaskLocation[] = locationsData
                .filter(loc => loc.is_active)
                .map(loc => ({
                    location_id: loc.id,
                    location_name: loc.name,
                }));
            dropdownCache.locations = activeLocations;
            setLocations(activeLocations);
        } catch (err) {
            console.error('Failed to fetch locations:', err);
        }
    };

    const fetchCategories = async () => {
        // Check cache first
        if (dropdownCache.categories && (Date.now() - dropdownCache.lastFetched) < CACHE_DURATION) {
            setAvailableCategories(dropdownCache.categories);
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskdecks/categories`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                dropdownCache.categories = data;
                setAvailableCategories(data);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchComments = async () => {
        // Skip fetch for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/comments`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setComments(data);
            }
        } catch (err) {
            console.error('Failed to fetch comments:', err);
        }
    };

    const fetchAttachments = async () => {
        // Skip fetch for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/attachments`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setAttachments(data);
            }
        } catch (err) {
            console.error('Failed to fetch attachments:', err);
        }
    };

    const fetchChecklist = async () => {
        // Skip fetch for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/checklist`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setChecklistItems(data);
                checklistInitialized.current = true;
            }
        } catch (err) {
            console.error('Failed to fetch checklist:', err);
        }
    };

    const fetchActivity = async () => {
        // Skip fetch for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/activity`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setActivities(data);
            }
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        }
    };

    const saveCardDetailsImmediate = () => {
        // Skip save for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        // Synchronous save for unmount - use sendBeacon or fetch with keepalive
        const updateData: any = {
            title,
            description,
            assigned_to: assignedTo,
            assigned_to_role: assignedToRole,
            location_id: locationId,
            due_date: dueDate || null,
            category_tag: categoryTag,
            accent_color: accentColor || null,
            is_complete: isComplete ? 1 : 0,
            assignees: selectedAssignees,
            assigned_roles: selectedRoles,
        };

        // Use fetch with keepalive for unmount saves
        fetch(`${apiUrl}/taskcards/${card.card_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce,
            },
            body: JSON.stringify(updateData),
            keepalive: true,
        }).catch(err => console.error('Failed to save on close:', err));
    };
    
    // Handle closing modal - update parent first, then close
    const handleClose = () => {
        // Cancel any pending auto-save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Save to server
        saveCardDetailsImmediate();
        
        // Update parent with current card data BEFORE closing
        if (onUpdate) {
            const selectedUser = users.find(u => u.id === assignedTo);
            const selectedRole = roles.find(r => r.role_id === assignedToRole);
            const selectedLocation = locations.find(l => l.location_id === locationId);
            
            // Build assignees array with display names
            const assigneesWithNames = selectedAssignees.map(id => {
                const user = users.find(u => u.id === id);
                return { user_id: id, user_name: user?.displayName || '' };
            });
            
            // Build roles array with names
            const rolesWithNames = selectedRoles.map(id => {
                const role = roles.find(r => r.role_id === id);
                return { role_id: id, role_name: role?.role_name || '' };
            });
            
            const updatedCard: TaskCard = {
                ...card,
                title,
                description,
                assigned_to: assignedTo || undefined,
                assignee_name: selectedUser?.displayName || undefined,
                assigned_to_role_id: assignedToRole || undefined,
                role_name: selectedRole?.role_name || undefined,
                location_id: locationId || undefined,
                location_name: selectedLocation?.location_name || undefined,
                due_date: dueDate || null,
                category_tag: categoryTag || undefined,
                accent_color: accentColor || null,
                is_complete: isComplete ? 1 : 0,
                checklist_items: checklistItems, // Keep parent in sync with current checklist state
                assignees: assigneesWithNames,
                assigned_roles: rolesWithNames,
            };
            onUpdate(updatedCard);
        }
        
        // Now close
        onClose();
    };

    const saveCardDetails = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
             // Just return silently for autosave, or alert if manual? 
             // Autosave calls this. We don't want to alert every 500ms.
             // But valid changes should be blocked.
             if (saving) return; // Prevent loop
             // Silent return is better for autosave hooks
             return;
        }

        // Skip save for new cards with temporary negative IDs
        if (card.card_id < 0) {
            return;
        }
        
        setSaving(true);
        setError(null);

        try {
            const updateData: any = {
                title,
                description,
                assigned_to: assignedTo,
                assigned_to_role: assignedToRole,
                location_id: locationId,
                due_date: dueDate || null,
                category_tag: categoryTag,
                accent_color: accentColor || null,
                is_complete: isComplete ? 1 : 0,
                assignees: selectedAssignees,
                assigned_roles: selectedRoles,
            };

            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) throw new Error('Failed to save card');

            setLastSavedTime(new Date());
            
            // Refresh activity log (async, don't wait)
            fetchActivity();
            
            // Notify parent with updated card data
            if (onUpdate) {
                // Find display names for the selected values
                const selectedUser = users.find(u => u.id === assignedTo);
                const selectedRole = roles.find(r => r.role_id === assignedToRole);
                const selectedLocation = locations.find(l => l.location_id === locationId);
                
                // Build assignees array with user names
                const assigneesWithNames = selectedAssignees.map(id => {
                    const user = users.find(u => u.id === id);
                    return { user_id: id, user_name: user?.displayName || '' };
                });
                
                // Build roles array with names
                const rolesWithNames = selectedRoles.map(id => {
                    const role = roles.find(r => r.role_id === id);
                    return { role_id: id, role_name: role?.role_name || '' };
                });
                
                const updatedCard: TaskCard = {
                    ...card,
                    title,
                    description,
                    assigned_to: assignedTo || undefined,
                    assignee_name: selectedUser?.displayName || undefined,
                    assigned_to_role_id: assignedToRole || undefined,
                    role_name: selectedRole?.role_name || undefined,
                    location_id: locationId || undefined,
                    location_name: selectedLocation?.location_name || undefined,
                    due_date: dueDate || null,
                    category_tag: categoryTag || undefined,
                    accent_color: accentColor || null,
                    is_complete: isComplete ? 1 : 0,
                    checklist_items: checklistItems, // Keep parent in sync with current checklist state
                    assignees: assigneesWithNames,
                    assigned_roles: rolesWithNames,
                };
                onUpdate(updatedCard);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save card');
        } finally {
            setSaving(false);
        }
    };

    const addComment = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!newComment.trim()) return;

        // Can't add comments to unsaved cards
        if (card.card_id < 0) {
            setError('Please save the card before adding comments');
            return;
        }

        // Create temp comment with negative ID
        const tempCommentId = -Date.now();
        const tempComment: CardComment = {
            comment_id: tempCommentId,
            card_id: card.card_id,
            user_id: currentUser.id,
            user_name: currentUser.firstName || currentUser.lastName || 'You',
            user_email: currentUser.email,
            comment_text: newComment,
            created_at: new Date().toISOString(),
        };
        
        // Optimistic update
        setComments(prev => [...prev, tempComment]);
        const savedComment = newComment;
        setNewComment('');
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ comment_text: savedComment }),
            });

            if (!response.ok) throw new Error('Failed to add comment');
            
            const newCommentData = await response.json();
            
            // Replace temp comment with real one
            setComments(prev => prev.map(c => 
                c.comment_id === tempCommentId ? { ...newCommentData } : c
            ));
            
            // Refresh activity in background
            fetchActivity();
        } catch (err) {
            // Remove temp comment on error
            setComments(prev => prev.filter(c => c.comment_id !== tempCommentId));
            setNewComment(savedComment);
            setError(err instanceof Error ? err.message : 'Failed to add comment');
        }
    };

    const deleteComment = async (commentId: number) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!confirm('Delete this comment?')) return;

        // Save for potential revert
        const deletedComment = comments.find(c => c.comment_id === commentId);
        
        // Optimistic update
        setComments(prev => prev.filter(c => c.comment_id !== commentId));
        
        try {
            const response = await fetch(`${apiUrl}/card-comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce },
            });

            if (!response.ok) throw new Error('Failed to delete comment');
        } catch (err) {
            // Revert on error
            if (deletedComment) {
                setComments(prev => [...prev, deletedComment].sort((a,b) => 
                     new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ));
            }
            alert('Failed to delete comment');
        }
    };

    const toggleReaction = async (commentId: number, reactionType: string) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            return; // Silent return for reactions
        }

        // Optimistic update
        setComments(prev => prev.map(comment => {
            if (comment.comment_id !== commentId) return comment;

            const wasReacted = comment.user_reaction === reactionType;
            const newReactions = { ...(comment.reactions || {}) };
            
            if (wasReacted) {
                // Removing reaction
                newReactions[reactionType] = Math.max(0, (newReactions[reactionType] || 1) - 1);
                return { ...comment, user_reaction: null, reactions: newReactions };
            } else {
                // Adding/Changing reaction
                // If switching from another reaction, decrement that one
                if (comment.user_reaction) {
                    newReactions[comment.user_reaction] = Math.max(0, (newReactions[comment.user_reaction] || 1) - 1);
                }
                newReactions[reactionType] = (newReactions[reactionType] || 0) + 1;
                return { ...comment, user_reaction: reactionType, reactions: newReactions };
            }
        }));

        try {
            const response = await fetch(`${apiUrl}/card-comments/${commentId}/reaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ reaction_type: reactionType }),
            });

            if (response.ok) {
                const data = await response.json();
                // Sync with server data to ensure accuracy
                setComments(prev => prev.map(comment => 
                    comment.comment_id === commentId 
                        ? { ...comment, user_reaction: data.user_reaction, reactions: data.reactions }
                        : comment
                ));
            }
        } catch (err) {
            console.error('Error toggling reaction:', err);
            // Revert would be complex here, assuming fetchComments will eventually correct it or next interaction
        }
    };


    const uploadAttachment = async (file: File) => {
        // Can't add attachments to unsaved cards
        if (card.card_id < 0) {
            setError('Please save the card before adding attachments');
            return;
        }
        
        setUploadingFile(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/attachments`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': nonce },
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to upload file');

            await fetchAttachments();
            await fetchActivity();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload file');
        } finally {
            setUploadingFile(false);
        }
    };

    const deleteAttachment = async (attachmentId: number) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!confirm('Delete this attachment?')) return;

        // Save for potential revert
        const deletedAttachment = attachments.find(a => a.attachment_id === attachmentId);
        
        // Optimistic update
        setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
        
        try {
            const response = await fetch(`${apiUrl}/card-attachments/${attachmentId}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce },
            });

            if (!response.ok) throw new Error('Failed to delete attachment');
        } catch (err) {
            // Revert on error
            if (deletedAttachment) {
                setAttachments(prev => [...prev, deletedAttachment]);
            }
            setError(err instanceof Error ? err.message : 'Failed to delete attachment');
        }
    };

    const addChecklistItem = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!newChecklistItem.trim()) return;

        // Can't add checklist items to unsaved cards
        if (card.card_id < 0) {
            setError('Please save the card before adding checklist items');
            return;
        }

        // Create temp checklist item with negative ID
        const tempChecklistId = -Date.now();
        const tempItem: ChecklistItem = {
            checklist_id: tempChecklistId,
            card_id: card.card_id,
            item_text: newChecklistItem,
            is_complete: 0,
            sort_order: checklistItems.length,
            created_at: new Date().toISOString(),
        };
        
        // Optimistic update
        setChecklistItems(prev => [...prev, tempItem]);
        const savedItemText = newChecklistItem;
        setNewChecklistItem('');
        
        try {
            const response = await fetch(`${apiUrl}/taskcards/${card.card_id}/checklist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ item_text: savedItemText }),
            });

            if (!response.ok) throw new Error('Failed to add checklist item');
            
            const newItemData = await response.json();
            
            // Replace temp item with real one, merging with temp data to ensure all fields exist
            setChecklistItems(prev => prev.map(i => 
                i.checklist_id === tempChecklistId 
                    ? { 
                        ...tempItem, 
                        ...newItemData,
                        is_complete: newItemData.is_complete ?? 0,
                    } 
                    : i
            ));
        } catch (err) {
            // Remove temp item on error
            setChecklistItems(prev => prev.filter(i => i.checklist_id !== tempChecklistId));
            setNewChecklistItem(savedItemText);
            setError(err instanceof Error ? err.message : 'Failed to add checklist item');
        }
    };

    const toggleChecklistItem = async (item: ChecklistItem) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            return; // Silent return for checkbox toggle
        }

        const newIsComplete = item.is_complete === 1 ? 0 : 1;
        
        // Optimistic update
        setChecklistItems(prev => prev.map(i => 
            i.checklist_id === item.checklist_id ? { ...i, is_complete: newIsComplete } : i
        ));
        
        try {
            const response = await fetch(`${apiUrl}/checklist-items/${item.checklist_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ is_complete: newIsComplete }),
            });

            if (!response.ok) throw new Error('Failed to update checklist item');
            
            // Refresh activity in background
            fetchActivity();
        } catch (err) {
            // Revert on error
            setChecklistItems(prev => prev.map(i => 
                i.checklist_id === item.checklist_id ? { ...i, is_complete: item.is_complete } : i
            ));
            setError(err instanceof Error ? err.message : 'Failed to update checklist item');
        }
    };

    const deleteChecklistItem = async (checklistId: number) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Save for potential revert
        const deletedItem = checklistItems.find(i => i.checklist_id === checklistId);
        
        // Optimistic update
        setChecklistItems(prev => prev.filter(i => i.checklist_id !== checklistId));
        
        try {
            const response = await fetch(`${apiUrl}/checklist-items/${checklistId}`, {
                method: 'DELETE',
                headers: { 'X-WP-Nonce': nonce },
            });

            if (!response.ok) throw new Error('Failed to delete checklist item');
        } catch (err) {
            // Revert on error
            if (deletedItem) {
                setChecklistItems(prev => [...prev, deletedItem].sort((a, b) => a.sort_order - b.sort_order));
            }
            setError(err instanceof Error ? err.message : 'Failed to delete checklist item');
        }
    };

    const _completedChecklistCount = checklistItems.filter((item) => item.is_complete === 1).length;
    // Progress percentage for potential future use: (completedChecklistCount / checklistItems.length) * 100

    return (
        <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-z-50 ap-flex ap-items-center ap-justify-center ap-p-4">
            <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-w-full ap-max-w-4xl ap-max-h-[90vh] ap-h-[800px] ap-overflow-hidden ap-flex ap-flex-col">
                {/* Header */}
                <div className="ap-flex ap-items-center ap-justify-between ap-p-6 ap-border-b ap-border-gray-200">
                    <div className="ap-flex-1">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => canEdit && setTitle(e.target.value)}
                            onBlur={() => {
                                // Save when user finishes editing title
                                if (canEdit && title !== initialValues.current.title) {
                                    initialValues.current.title = title;
                                    saveCardDetails();
                                }
                            }}
                            readOnly={!canEdit}
                            className={`ap-text-2xl ap-font-bold ap-w-full focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-rounded ap-px-2 ap-py-1 ${!canEdit ? 'ap-bg-gray-50 ap-cursor-default' : ''}`}
                        />
                        <div className="ap-flex ap-items-center ap-gap-3 ap-mt-1">
                            <p className="ap-text-sm ap-text-gray-500">
                                {card.creator_name && card.created_at && !isNaN(new Date(card.created_at).getTime()) 
                                    ? `Created by ${card.creator_name} on ${formatLocalDate(card.created_at)}`
                                    : card.created_at && !isNaN(new Date(card.created_at).getTime())
                                        ? `Created on ${formatLocalDate(card.created_at)}`
                                        : 'New card'}
                            </p>
                            {saving && <span className="ap-text-xs ap-text-gray-500">• Saving...</span>}
                            {!saving && lastSavedTime && (
                                <span className="ap-text-xs ap-text-green-600">
                                    ✓ Saved {new Date().getTime() - lastSavedTime.getTime() < 5000 ? 'just now' : 'at ' + lastSavedTime.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2 ap-ml-4">
                        {/* Save Button - explicit save and close */}
                        {canEdit && (
                            <Button
                                onClick={async () => {
                                    setSaving(true);
                                    await saveCardDetails();
                                    setSaving(false);
                                    handleClose();
                                }}
                                disabled={saving}
                                loading={saving}
                                variant="primary"
                                leftIcon={!saving ? <HiOutlineCheckCircle className="ap-w-4 ap-h-4" /> : undefined}
                                title="Save changes and close"
                            >
                                Save
                            </Button>
                        )}
                        {/* Delete Button - only show if user can delete */}
                        {canDelete && onDelete && (
                            <Button
                                onClick={() => {
                                    if (confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
                                        onDelete(card.card_id);
                                    }
                                }}
                                variant="ghost"
                                size="sm"
                                className="!ap-text-gray-400 hover:!ap-text-red-600 hover:!ap-bg-red-50"
                                title="Delete card"
                            >
                                <HiOutlineTrash className="ap-w-5 ap-h-5" />
                            </Button>
                        )}
                        <Button
                            onClick={handleClose}
                            variant="ghost"
                            size="sm"
                            title="Close"
                        >
                            <HiXMark className="ap-w-6 ap-h-6" />
                        </Button>
                    </div>
                </div>

                {/* Mark Complete Button and Move to List */}
                <div className="ap-px-6 ap-pt-4 ap-flex ap-flex-col sm:ap-flex-row ap-items-stretch sm:ap-items-center ap-justify-between ap-gap-3">
                    <Button
                        variant="primary"
                        onClick={async () => {
                            if (!canEdit) return;
                            const newIsComplete = !isComplete;
                            setIsComplete(newIsComplete);
                            // Save immediately
                            try {
                                setSaving(true);
                                const response = await fetch(`${apiUrl}/taskcards/${card.card_id}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-WP-Nonce': nonce,
                                    },
                                    body: JSON.stringify({
                                        is_complete: newIsComplete ? 1 : 0,
                                    }),
                                });
                                if (response.ok) {
                                    const updatedCard = await response.json();
                                    setLastSavedTime(new Date());
                                    if (onUpdate) {
                                        onUpdate(updatedCard);
                                    }
                                }
                            } catch (err) {
                                console.error('Error updating completion status:', err);
                                // Revert on error
                                setIsComplete(!newIsComplete);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        disabled={!canEdit || saving}
                        className={`!ap-flex !ap-items-center !ap-justify-center !ap-gap-2 ${
                            isComplete
                                ? '!ap-bg-green-500 hover:!ap-bg-green-600' : '!ap-bg-orange-500 hover:!ap-bg-orange-600'
                        } ${!canEdit ? '!ap-opacity-50 !ap-cursor-not-allowed' : ''}`}
                    >
                        <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                        {isComplete ? 'Completed' : 'Mark Complete'}
                    </Button>

                    {/* List Picker - Moved here */}
                    {availableLists.length > 1 && canEdit && (
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <label className="ap-text-sm ap-font-medium ap-text-gray-700 ap-whitespace-nowrap ap-hidden sm:ap-block">
                                <HiOutlineQueueList className="ap-w-5 ap-h-5 ap-inline ap-mr-1" />
                                Move to:
                            </label>
                            <select
                                value={card.list_id}
                                onChange={(e) => {
                                    const newListId = Number(e.target.value);
                                    if (newListId !== card.list_id && onMoveToList) {
                                        onMoveToList(card.card_id, newListId);
                                    }
                                }}
                                className="ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-bg-white ap-text-sm"
                            >
                                {availableLists.map((list) => (
                                    <option key={list.list_id} value={list.list_id}>
                                        {list.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Read-only Banner */}
                {!canEdit && (
                    <div className="ap-mx-6 ap-mt-4 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-3 ap-text-yellow-700 ap-text-sm">
                        <span className="ap-font-medium">View Only:</span> You can view this card but don't have permission to edit it.{isPrimaryDeck ? ' This card is assigned to your role but not directly to you.' : ''} You can still add comments.
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="ap-mx-6 ap-mt-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-3 ap-text-red-800">
                        {error}
                    </div>
                )}

                {/* Tabs - Desktop: horizontal buttons, Mobile: hamburger menu */}
                <div className="ap-px-6 ap-pt-4 ap-border-b ap-border-gray-200">
                    {/* Desktop Tabs */}
                    <div className="ap-hidden sm:ap-flex ap-gap-1">
                        {[
                            { id: 'details' as TabType, label: 'Details', icon: HiOutlineClipboardDocumentList },
                            { id: 'comments' as TabType, label: 'Comments', icon: HiOutlineChatBubbleLeft, count: comments.length },
                            { id: 'attachments' as TabType, label: 'Attachments', icon: HiOutlinePaperClip, count: attachments.length },
                            { id: 'activity' as TabType, label: 'Activity', icon: HiOutlineClipboardDocumentList, count: activities.length },
                        ].map((tab) => (
                            <Button
                                key={tab.id}
                                variant="ghost"
                                onClick={() => setActiveTab(tab.id)}
                                className={`!ap-flex !ap-items-center !ap-gap-2 !ap-px-4 !ap-py-2 !ap-font-medium !ap-rounded-none ${
                                    activeTab === tab.id
                                        ? '!ap-text-blue-600 !ap-border-b-2 !ap-border-blue-500' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                                }`}
                            >
                                <tab.icon className="ap-w-5 ap-h-5" />
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="ap-bg-gray-200 ap-text-gray-700 ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full">
                                        {tab.count}
                                    </span>
                                )}
                            </Button>
                        ))}
                    </div>
                    
                    {/* Mobile Tabs - Hamburger Menu */}
                    <div className="sm:ap-hidden ap-relative">
                        <Button
                            variant="ghost"
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className="!ap-flex !ap-items-center !ap-gap-2 !ap-px-4 !ap-py-2 !ap-text-gray-700 !ap-font-medium !ap-w-full !ap-justify-between"
                        >
                            <span className="ap-flex ap-items-center ap-gap-2">
                                {activeTab === 'details' && <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5" />}
                                {activeTab === 'comments' && <HiOutlineChatBubbleLeft className="ap-w-5 ap-h-5" />}
                                {activeTab === 'attachments' && <HiOutlinePaperClip className="ap-w-5 ap-h-5" />}
                                {activeTab === 'activity' && <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5" />}
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </span>
                            <HiBars3 className="ap-w-5 ap-h-5" />
                        </Button>
                        
                        {showMobileMenu && (
                            <div className="ap-absolute ap-top-full ap-left-0 ap-right-0 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-z-50 ap-mt-1">
                                {[
                                    { id: 'details' as TabType, label: 'Details', icon: HiOutlineClipboardDocumentList },
                                    { id: 'comments' as TabType, label: 'Comments', icon: HiOutlineChatBubbleLeft, count: comments.length },
                                    { id: 'attachments' as TabType, label: 'Attachments', icon: HiOutlinePaperClip, count: attachments.length },
                                    { id: 'activity' as TabType, label: 'Activity', icon: HiOutlineClipboardDocumentList, count: activities.length },
                                ].map((tab) => (
                                    <Button
                                        key={tab.id}
                                        variant="ghost"
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setShowMobileMenu(false);
                                        }}
                                        className={`!ap-flex !ap-items-center !ap-gap-3 !ap-px-4 !ap-py-3 !ap-w-full !ap-text-left !ap-justify-start !ap-rounded-none ${
                                            activeTab === tab.id
                                                ? '!ap-bg-blue-50 !ap-text-blue-600' : '!ap-text-gray-700 hover:!ap-bg-gray-50'
                                        }`}
                                    >
                                        <tab.icon className="ap-w-5 ap-h-5" />
                                        {tab.label}
                                        {tab.count !== undefined && tab.count > 0 && (
                                            <span className="ap-bg-gray-200 ap-text-gray-700 ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ap-ml-auto">
                                                {tab.count}
                                            </span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Content - Fixed minimum height to prevent resizing between tabs */}
                <div className="ap-flex-1 ap-overflow-y-auto ap-p-6 ap-min-h-[500px]">
                    {/* Details Tab */}
                    {activeTab === 'details' && (
                        <div className="ap-space-y-6">
                            
                            {/* Image Thumbnail - Show first image attachment at top of details */}
                            {(() => {
                                const imageAttachment = attachments.find(att => {
                                    const fileName = att.file_name.toLowerCase();
                                    return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                           fileName.endsWith('.png') || fileName.endsWith('.gif') || 
                                           fileName.endsWith('.webp') || fileName.endsWith('.svg');
                                });
                                if (imageAttachment?.file_url) {
                                    return (
                                        <div>
                                            <div className="ap-inline-block ap-rounded-lg ap-overflow-hidden ap-border ap-border-gray-200 ap-bg-gray-50">
                                                <img 
                                                    src={imageAttachment.file_url} 
                                                    alt={imageAttachment.file_name}
                                                    className="ap-max-h-48 ap-max-w-full ap-object-contain"
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            
                            {/* Description */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => canEdit && setDescription(e.target.value)}
                                    onBlur={() => {
                                        // Save when user finishes editing description
                                        if (canEdit && description !== initialValues.current.description) {
                                            initialValues.current.description = description;
                                            saveCardDetails();
                                        }
                                    }}
                                    readOnly={!canEdit}
                                    rows={4}
                                    className={`ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ${!canEdit ? 'ap-bg-gray-50 ap-cursor-default' : ''}`}
                                    placeholder="Add a description..."
                                />
                            </div>

                            {/* Checklist Section - Moved under Description */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                                    Checklist
                                    {checklistItems.length > 0 && (
                                        <span className="ap-text-xs ap-bg-gray-100 ap-px-2 ap-py-0.5 ap-rounded-full">
                                            {checklistItems.filter(item => item.is_complete === 1).length}/{checklistItems.length}
                                        </span>
                                    )}
                                </label>
                                
                                {/* Progress Bar */}
                                {checklistItems.length > 0 && (
                                    <div className="ap-mb-4">
                                        <div className="ap-w-full ap-bg-gray-200 ap-rounded-full ap-h-2">
                                            <div
                                                className={`ap-h-2 ap-rounded-full ap-transition-all ${
                                                    checklistItems.filter(item => item.is_complete === 1).length === checklistItems.length
                                                        ? 'ap-bg-green-500' : 'ap-bg-blue-600'
                                                }`}
                                                style={{ width: `${checklistItems.length > 0 ? (checklistItems.filter(item => item.is_complete === 1).length / checklistItems.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Add New Item - only show if user can edit */}
                                {canEdit && (
                                <div className="ap-flex ap-gap-2 ap-mb-3">
                                    <input
                                        type="text"
                                        value={newChecklistItem}
                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                                        className="ap-flex-1 ap-px-3 ap-py-2 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                                        placeholder="Add checklist item..."
                                    />
                                    <Button
                                        onClick={addChecklistItem}
                                        disabled={!newChecklistItem.trim()}
                                        variant="primary"
                                        size="sm"
                                    >
                                        <HiOutlinePlus className="ap-w-4 ap-h-4" />
                                    </Button>
                                </div>
                                )}
                                
                                {/* Checklist Items */}
                                <div className="ap-space-y-2">
                                    {checklistItems.map((item) => (
                                        <div
                                            key={item.checklist_id}
                                            className="ap-flex ap-items-center ap-gap-3 ap-bg-gray-50 hover:ap-bg-gray-100 ap-rounded-lg ap-px-3 ap-py-2 group"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.is_complete === 1}
                                                onChange={() => canEdit && toggleChecklistItem(item)}
                                                disabled={!canEdit}
                                                className={`ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-rounded ${!canEdit ? 'ap-cursor-not-allowed ap-opacity-60' : ''}`}
                                            />
                                            <span
                                                className={`ap-flex-1 ap-text-sm ${
                                                    item.is_complete === 1
                                                        ? 'ap-line-through ap-text-gray-400' : 'ap-text-gray-800'
                                                }`}
                                            >
                                                {item.item_text}
                                            </span>
                                            {canEdit && (
                                            <Button
                                                onClick={() => deleteChecklistItem(item.checklist_id)}
                                                variant="ghost"
                                                size="xs"
                                                className="!ap-text-red-500 hover:!ap-text-red-700 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity !ap-p-1"
                                            >
                                                <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                            </Button>
                                            )}
                                        </div>
                                    ))}
                                    {checklistItems.length === 0 && (
                                        <p className="ap-text-center ap-text-gray-400 ap-py-4 ap-text-sm">No checklist items yet. Add one above.</p>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineMapPin className="ap-w-5 ap-h-5" />
                                    Location
                                </label>
                                <select
                                    value={locationId || ''}
                                    onChange={(e) => {
                                        setLocationId(e.target.value ? Number(e.target.value) : null);
                                    }}
                                    disabled={!canEdit}
                                    className={`ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ${!canEdit ? 'ap-bg-gray-50 ap-cursor-not-allowed' : ''}`}
                                >
                                    <option value="">No Location</option>
                                    {locations.map((location) => (
                                        <option key={location.location_id} value={location.location_id}>
                                            {location.location_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalendar className="ap-w-5 ap-h-5" />
                                    Due Date
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    disabled={!canEdit}
                                    className={`ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ${!canEdit ? 'ap-bg-gray-50 ap-cursor-not-allowed' : ''}`}
                                />
                            </div>

                            {/* Category Tag */}
                            <div className="ap-relative">
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineTag className="ap-w-5 ap-h-5" />
                                    Category
                                </label>
                                <input
                                    type="text"
                                    value={categoryTag}
                                    onChange={(e) => canEdit && setCategoryTag(e.target.value)}
                                    onFocus={() => canEdit && setShowCategorySuggestions(true)}
                                    onBlur={() => {
                                        setTimeout(() => setShowCategorySuggestions(false), 200);
                                        if (canEdit) saveCardDetails();
                                    }}
                                    readOnly={!canEdit}
                                    className={`ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ${!canEdit ? 'ap-bg-gray-50 ap-cursor-default' : ''}`}
                                    placeholder="e.g., Bug, Feature, Enhancement"
                                />
                                {canEdit && showCategorySuggestions && availableCategories.length > 0 && (
                                    <div className="ap-absolute ap-z-10 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-300 ap-rounded-lg ap-shadow-lg ap-max-h-48 ap-overflow-y-auto">
                                        {availableCategories
                                            .filter(cat => cat.toLowerCase().includes(categoryTag.toLowerCase()))
                                            .map((category, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => {
                                                        setCategoryTag(category);
                                                        setShowCategorySuggestions(false);
                                                        setTimeout(saveCardDetails, 0);
                                                    }}
                                                    className="ap-px-4 ap-py-2 hover:ap-bg-gray-100 ap-cursor-pointer"
                                                >
                                                    {category}
                                                </div>
                                            ))}
                                    </div>
                                )}
                                {/* Quick Category Chips - Always visible */}
                                {canEdit && availableCategories.length > 0 && (
                                    <div className="ap-mt-2">
                                        <p className="ap-text-xs ap-text-gray-500 ap-mb-1.5">Quick select:</p>
                                        <div className="ap-flex ap-flex-wrap ap-gap-1.5">
                                            {availableCategories.slice(0, 10).map((category, index) => (
                                                <Button
                                                    key={index}
                                                    type="button"
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => {
                                                        setCategoryTag(category);
                                                        setTimeout(saveCardDetails, 0);
                                                    }}
                                                    className={`!ap-px-2.5 !ap-py-1 !ap-text-xs !ap-rounded-full !ap-min-h-0 ${
                                                        categoryTag === category
                                                            ? '!ap-bg-blue-600 !ap-text-white' : '!ap-bg-gray-100 !ap-text-gray-700 hover:!ap-bg-gray-200'
                                                    }`}
                                                >
                                                    {category}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Accent Color */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineSwatch className="ap-w-5 ap-h-5" />
                                    Card Color
                                </label>
                                <div className={`ap-flex ap-flex-wrap ap-gap-2 ap-p-3 ap-border ap-border-gray-300 ap-rounded-lg ${!canEdit ? 'ap-bg-gray-50' : ''}`}>
                                    {ACCENT_COLORS.map((colorOption) => (
                                        <Button
                                            key={colorOption.value || 'auto'}
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => {
                                                if (!canEdit) return;
                                                setAccentColor(colorOption.value);
                                                setTimeout(saveCardDetails, 0);
                                            }}
                                            disabled={!canEdit}
                                            className={`!ap-relative !ap-w-8 !ap-h-8 !ap-rounded-full !ap-border-2 !ap-p-0 !ap-min-h-0 ${
                                                accentColor === colorOption.value
                                                    ? '!ap-ring-2 !ap-ring-offset-2 !ap-ring-blue-500 !ap-border-white' : '!ap-border-gray-300 hover:!ap-border-gray-400'
                                            } ${!canEdit ? '!ap-cursor-not-allowed !ap-opacity-60' : '!ap-cursor-pointer'}`}
                                            style={colorOption.value ? { backgroundColor: colorOption.value } : undefined}
                                            title={colorOption.label}
                                        >
                                            {!colorOption.value && (
                                                <span className="ap-absolute ap-inset-0 ap-flex ap-items-center ap-justify-center ap-text-xs ap-font-medium ap-text-gray-500 ap-bg-gradient-to-br ap-from-red-200 ap-via-yellow-200 ap-to-blue-200 ap-rounded-full">
                                                    A
                                                </span>
                                            )}
                                            {accentColor === colorOption.value && colorOption.value && (
                                                <span className="ap-absolute ap-inset-0 ap-flex ap-items-center ap-justify-center ap-text-white">
                                                    <svg className="ap-w-4 ap-h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            )}
                                        </Button>
                                    ))}
                                </div>
                                <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                    {accentColor ? 'Custom color selected' : 'Color is automatically set based on category'}
                                </p>
                            </div>

                            {/* User Assignment - Multi-select with search */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineUser className="ap-w-5 ap-h-5" />
                                    Assign to Users
                                    {selectedAssignees.length > 0 && (
                                        <span className="ap-text-xs ap-bg-blue-100 ap-text-blue-700 ap-px-2 ap-py-0.5 ap-rounded">
                                            {selectedAssignees.length} selected
                                        </span>
                                    )}
                                </label>
                                {/* Selected Users - shown as chips above the list */}
                                {selectedAssignees.length > 0 && (
                                    <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mb-2 ap-p-2 ap-bg-blue-50 ap-rounded-lg ap-border ap-border-blue-200">
                                        {selectedAssignees.map(id => {
                                            const user = users.find(u => u.id === id);
                                            return user ? (
                                                <span key={id} className="ap-inline-flex ap-items-center ap-gap-1 ap-bg-blue-600 ap-text-white ap-text-xs ap-px-2.5 ap-py-0.5 ap-rounded">
                                                    {user.firstName} {user.lastName}
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => setSelectedAssignees(selectedAssignees.filter(i => i !== id))}
                                                            className="!ap-p-0 !ap-min-h-0 !ap-h-auto hover:!ap-text-white/70 !ap-ml-0.5 !ap-text-white"
                                                        >
                                                            <HiXMark className="ap-w-3 ap-h-3" />
                                                        </Button>
                                                    )}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                {/* User Search Filter */}
                                <div className="ap-relative ap-mb-2">
                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                    <input
                                        type="text"
                                        value={userSearchFilter}
                                        onChange={(e) => setUserSearchFilter(e.target.value)}
                                        placeholder="Search users..."
                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500"
                                    />
                                    {userSearchFilter && (
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => setUserSearchFilter('')}
                                            className="!ap-absolute !ap-right-2 !ap-top-1/2 !-ap-translate-y-1/2 !ap-text-gray-400 hover:!ap-text-gray-600 !ap-p-1 !ap-min-h-0"
                                        >
                                            <HiXMark className="ap-w-4 ap-h-4" />
                                        </Button>
                                    )}
                                </div>
                                <div className={`ap-border ap-border-gray-300 ap-rounded-lg ap-max-h-48 ap-overflow-y-auto ${!canEdit ? 'ap-bg-gray-50' : ''}`}>
                                    {users.length > 0 ? (
                                        <div className="ap-divide-y ap-divide-gray-100">
                                            {/* Sort: selected users first, then filtered alphabetically */}
                                            {[...users]
                                                .filter(user => {
                                                    if (!userSearchFilter.trim()) return true;
                                                    const search = userSearchFilter.toLowerCase();
                                                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                                                    const displayName = (user.displayName || '').toLowerCase();
                                                    return fullName.includes(search) || displayName.includes(search);
                                                })
                                                .sort((a, b) => {
                                                    const aSelected = selectedAssignees.includes(a.id);
                                                    const bSelected = selectedAssignees.includes(b.id);
                                                    if (aSelected && !bSelected) return -1;
                                                    if (!aSelected && bSelected) return 1;
                                                    return 0;
                                                })
                                                .map((user) => {
                                                    const isSelected = selectedAssignees.includes(user.id);
                                                    return (
                                                        <label
                                                            key={user.id}
                                                            className={`ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-2 ${isSelected ? 'ap-bg-blue-50' : 'hover:ap-bg-gray-50'} ${!canEdit ? 'ap-cursor-not-allowed' : 'ap-cursor-pointer'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (!canEdit) return;
                                                                    if (e.target.checked) {
                                                                        setSelectedAssignees([...selectedAssignees, user.id]);
                                                                    } else {
                                                                        setSelectedAssignees(selectedAssignees.filter(id => id !== user.id));
                                                                    }
                                                                }}
                                                                disabled={!canEdit}
                                                                className="ap-w-4 ap-h-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-rounded"
                                                            />
                                                            <span className={`ap-text-sm ${isSelected ? 'ap-text-blue-600 ap-font-medium' : 'ap-text-gray-700'}`}>
                                                                {user.firstName} {user.lastName}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            {users.filter(user => {
                                                if (!userSearchFilter.trim()) return true;
                                                const search = userSearchFilter.toLowerCase();
                                                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                                                const displayName = (user.displayName || '').toLowerCase();
                                                return fullName.includes(search) || displayName.includes(search);
                                            }).length === 0 && (
                                                <p className="ap-text-xs ap-text-gray-500 ap-px-4 ap-py-3 ap-text-center">No users match "{userSearchFilter}"</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="ap-text-xs ap-text-gray-500 ap-px-4 ap-py-3">Loading users...</p>
                                    )}
                                </div>
                            </div>

                            {/* Role Assignment - Multi-select with search */}
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineUser className="ap-w-5 ap-h-5" />
                                    Assign to Roles
                                    {selectedRoles.length > 0 && (
                                        <span className="ap-text-xs ap-bg-purple-100 ap-text-purple-700 ap-px-2 ap-py-0.5 ap-rounded">
                                            {selectedRoles.length} selected
                                        </span>
                                    )}
                                </label>
                                {/* Selected Roles - shown as chips above the list */}
                                {selectedRoles.length > 0 && (
                                    <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mb-2 ap-p-2 ap-bg-purple-50 ap-rounded-lg ap-border ap-border-purple-200">
                                        {selectedRoles.map(id => {
                                            const role = roles.find(r => r.role_id === id);
                                            return role ? (
                                                <span key={id} className="ap-inline-flex ap-items-center ap-gap-1 ap-bg-purple-600 ap-text-white ap-text-xs ap-px-2.5 ap-py-0.5 ap-rounded">
                                                    {role.role_name}
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => setSelectedRoles(selectedRoles.filter(i => i !== id))}
                                                            className="!ap-p-0 !ap-min-h-0 !ap-h-auto hover:!ap-text-white/70 !ap-ml-0.5 !ap-text-white"
                                                        >
                                                            <HiXMark className="ap-w-3 ap-h-3" />
                                                        </Button>
                                                    )}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                {/* Role Search Filter */}
                                <div className="ap-relative ap-mb-2">
                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                    <input
                                        type="text"
                                        value={roleSearchFilter}
                                        onChange={(e) => setRoleSearchFilter(e.target.value)}
                                        placeholder="Search roles..."
                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-1.5 ap-text-sm ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-purple-500"
                                    />
                                    {roleSearchFilter && (
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => setRoleSearchFilter('')}
                                            className="!ap-absolute !ap-right-2 !ap-top-1/2 !-ap-translate-y-1/2 !ap-text-gray-400 hover:!ap-text-gray-600 !ap-p-1 !ap-min-h-0"
                                        >
                                            <HiXMark className="ap-w-4 ap-h-4" />
                                        </Button>
                                    )}
                                </div>
                                <div className={`ap-border ap-border-gray-300 ap-rounded-lg ap-max-h-48 ap-overflow-y-auto ${!canEdit ? 'ap-bg-gray-50' : ''}`}>
                                    {roles.length > 0 ? (
                                        <div className="ap-divide-y ap-divide-gray-100">
                                            {/* Sort: selected roles first, then filtered */}
                                            {[...roles]
                                                .filter(role => {
                                                    if (!roleSearchFilter.trim()) return true;
                                                    const search = roleSearchFilter.toLowerCase();
                                                    return role.role_name.toLowerCase().includes(search);
                                                })
                                                .sort((a, b) => {
                                                    const aSelected = selectedRoles.includes(a.role_id);
                                                    const bSelected = selectedRoles.includes(b.role_id);
                                                    if (aSelected && !bSelected) return -1;
                                                    if (!aSelected && bSelected) return 1;
                                                    return 0;
                                                })
                                                .map((role) => {
                                                    const isSelected = selectedRoles.includes(role.role_id);
                                                    return (
                                                        <label
                                                            key={role.role_id}
                                                            className={`ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-2 ${isSelected ? 'ap-bg-purple-50' : 'hover:ap-bg-gray-50'} ${!canEdit ? 'ap-cursor-not-allowed' : 'ap-cursor-pointer'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (!canEdit) return;
                                                                    if (e.target.checked) {
                                                                        setSelectedRoles([...selectedRoles, role.role_id]);
                                                                    } else {
                                                                        setSelectedRoles(selectedRoles.filter(id => id !== role.role_id));
                                                                    }
                                                                }}
                                                                disabled={!canEdit}
                                                                className="ap-w-4 ap-h-4 ap-text-purple-600 focus:ap-ring-purple-500 ap-rounded"
                                                            />
                                                            <span className={`ap-text-sm ${isSelected ? 'ap-text-purple-700 ap-font-medium' : 'ap-text-gray-700'}`}>
                                                                {role.role_name} {role.tier ? `(Tier ${role.tier})` : ''}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            {roles.filter(role => {
                                                if (!roleSearchFilter.trim()) return true;
                                                const search = roleSearchFilter.toLowerCase();
                                                return role.role_name.toLowerCase().includes(search);
                                            }).length === 0 && (
                                                <p className="ap-text-xs ap-text-gray-500 ap-px-4 ap-py-3 ap-text-center">No roles match "{roleSearchFilter}"</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="ap-text-xs ap-text-gray-500 ap-px-4 ap-py-3">Loading roles...</p>
                                    )}
                                </div>
                            </div>
                            {/* Completion Status */}
                            <div>
                                <label className={`ap-flex ap-items-center ap-gap-3 ${canEdit ? 'ap-cursor-pointer' : 'ap-cursor-default'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isComplete}
                                        onChange={(e) => {
                                            if (canEdit) {
                                                setIsComplete(e.target.checked);
                                                setTimeout(saveCardDetails, 0);
                                            }
                                        }}
                                        disabled={!canEdit}
                                        className={`ap-w-5 ap-h-5 ap-text-blue-600 focus:ap-ring-blue-500 ap-rounded ${!canEdit ? 'ap-cursor-not-allowed ap-opacity-60' : ''}`}
                                    />
                                    <span className="ap-text-sm ap-font-medium ap-text-gray-700">
                                        Mark as complete
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Comments Tab */}
                    {activeTab === 'comments' && (
                        <div className="ap-space-y-6">
                            {/* New Comment */}
                            <div className="ap-flex ap-gap-3">
                                <div className="ap-flex-shrink-0 ap-w-8 ap-h-8 ap-bg-blue-100 ap-rounded-full ap-overflow-hidden ap-flex ap-items-center ap-justify-center ap-text-blue-600 ap-font-medium ap-text-sm">
                                    {currentUser.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt="User" className="ap-w-full ap-h-full ap-object-cover" />
                                    ) : (
                                        <span>{currentUser.firstName?.charAt(0) || currentUser.lastName?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                                <div className="ap-flex-1">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        rows={3}
                                        className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-500 ap-mb-2"
                                        placeholder="Write a comment..."
                                    />
                                    <Button
                                        onClick={addComment}
                                        disabled={!newComment.trim()}
                                        variant="primary"
                                        size="sm"
                                    >
                                        Post
                                    </Button>
                                </div>
                            </div>

                            {/* Comments List */}
                            <div className="ap-space-y-4">
                                {comments.map((comment) => (
                                    <div key={comment.comment_id} className="ap-flex ap-gap-3">
                                        {/* Avatar */}
                                        <div className="ap-flex-shrink-0 ap-w-8 ap-h-8 ap-bg-gray-200 ap-rounded-full ap-overflow-hidden ap-flex ap-items-center ap-justify-center ap-text-gray-600 ap-font-medium ap-text-sm">
                                            {comment.avatar_url ? (
                                                <img src={comment.avatar_url} alt={comment.user_name} className="ap-w-full ap-h-full ap-object-cover" />
                                            ) : (
                                                <span>{comment.user_name ? comment.user_name.charAt(0).toUpperCase() : 'U'}</span>
                                            )}
                                        </div>
                                        
                                        <div className="ap-flex-1 ap-min-w-0">
                                            {/* Bubble */}
                                            <div className="ap-bg-gray-100 ap-rounded-2xl ap-rounded-tl-none ap-px-4 ap-py-3 ap-relative group">
                                                <div className="ap-flex ap-items-center ap-justify-between ap-gap-2 ap-mb-1">
                                                    <span className="ap-font-semibold ap-text-sm ap-text-gray-900">{comment.user_name}</span>
                                                    <span className="ap-text-xs ap-text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                                                </div>
                                                <p className="ap-text-gray-800 ap-text-sm ap-whitespace-pre-wrap ap-leading-relaxed">{comment.comment_text}</p>
                                                
                                                {/* Delete button (hover only) */}
                                                {(comment.user_id === currentUser.id || canDelete) && (
                                                    <Button
                                                        onClick={() => deleteComment(comment.comment_id)}
                                                        variant="ghost"
                                                        size="xs"
                                                        className="ap-absolute ap-top-2 ap-right-2 !ap-p-1 !ap-text-gray-400 hover:!ap-text-red-600 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity"
                                                        title="Delete comment"
                                                    >
                                                        <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {/* Reactions Bar */}
                                            <div className="ap-flex ap-items-center ap-gap-4 ap-mt-1 ap-ml-2">
                                                <Button 
                                                    onClick={() => toggleReaction(comment.comment_id, 'thumbs_up')}
                                                    variant={comment.user_reaction === 'thumbs_up' ? 'reaction-like' : 'reaction'}
                                                    size="xs"
                                                    className="!ap-min-h-0 !ap-gap-1"
                                                >
                                                    {comment.user_reaction === 'thumbs_up' ? <HiHandThumbUp className="ap-w-4 ap-h-4" /> : <HiOutlineHandThumbUp className="ap-w-4 ap-h-4" />}
                                                    {(comment.reactions?.thumbs_up || 0) > 0 && <span>{comment.reactions?.thumbs_up}</span>}
                                                </Button>
                                                <Button 
                                                    onClick={() => toggleReaction(comment.comment_id, 'thumbs_down')}
                                                    variant={comment.user_reaction === 'thumbs_down' ? 'reaction-dislike' : 'reaction'}
                                                    size="xs"
                                                    className="!ap-min-h-0 !ap-gap-1"
                                                >
                                                    {comment.user_reaction === 'thumbs_down' ? <HiHandThumbDown className="ap-w-4 ap-h-4" /> : <HiOutlineHandThumbDown className="ap-w-4 ap-h-4" />}
                                                    {(comment.reactions?.thumbs_down || 0) > 0 && <span>{comment.reactions?.thumbs_down}</span>}
                                                </Button>
                                                 <Button 
                                                    onClick={() => toggleReaction(comment.comment_id, 'heart')}
                                                    variant={comment.user_reaction === 'heart' ? 'reaction-heart' : 'reaction'}
                                                    size="xs"
                                                    className="!ap-min-h-0 !ap-gap-1"
                                                >
                                                    {comment.user_reaction === 'heart' ? <HiHeart className="ap-w-4 ap-h-4" /> : <HiOutlineHeart className="ap-w-4 ap-h-4" />}
                                                    {(comment.reactions?.heart || 0) > 0 && <span>{comment.reactions?.heart}</span>}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {comments.length === 0 && (
                                    <p className="ap-text-center ap-text-gray-500 ap-py-8 ap-italic">No comments yet. Be the first to start the conversation!</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Attachments Tab */}
                    {activeTab === 'attachments' && (
                        <div className="ap-space-y-4">
                            {/* Upload - only show if user can edit */}
                            {canEdit && (
                            <div>
                                <label className="ap-block ap-w-full ap-px-4 ap-py-8 ap-border-2 ap-border-dashed ap-border-gray-300 ap-rounded-lg ap-text-center ap-cursor-pointer hover:ap-border-blue-500 ap-transition-colors">
                                    <HiOutlinePaperClip className="ap-w-8 ap-h-8 ap-mx-auto ap-mb-2 ap-text-gray-400" />
                                    <span className="ap-text-gray-600">
                                        {uploadingFile ? 'Uploading...' : 'Click ap-to upload file'}
                                    </span>
                                    <input
                                        type="file"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadAttachment(file);
                                        }}
                                        className="ap-hidden"
                                        disabled={uploadingFile}
                                    />
                                </label>
                            </div>
                            )}

                            {/* Attachments List */}
                            <div className="ap-space-y-2">
                                {attachments.map((attachment) => {
                                    const isImage = (() => {
                                        const fileName = attachment.file_name.toLowerCase();
                                        return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                               fileName.endsWith('.png') || fileName.endsWith('.gif') || 
                                               fileName.endsWith('.webp') || fileName.endsWith('.svg');
                                    })();
                                    return (
                                    <div
                                        key={attachment.attachment_id}
                                        className="ap-flex ap-items-center ap-justify-between ap-bg-gray-50 ap-rounded-lg ap-p-3"
                                    >
                                        <div className="ap-flex ap-items-center ap-gap-3 ap-flex-1 ap-min-w-0">
                                            {isImage ? (
                                                <div className="ap-w-12 ap-h-12 ap-rounded ap-border ap-border-gray-200 ap-bg-white ap-flex-shrink-0 ap-overflow-hidden">
                                                    <img 
                                                        src={attachment.file_url} 
                                                        alt={attachment.file_name}
                                                        className="ap-w-full ap-h-full ap-object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <HiOutlinePaperClip className="ap-w-5 ap-h-5 ap-text-gray-400 ap-flex-shrink-0" />
                                            )}
                                            <div className="ap-min-w-0 ap-flex-1">
                                                <a
                                                    href={attachment.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ap-text-blue-600 hover:ap-underline ap-truncate ap-block"
                                                >
                                                    {attachment.file_name}
                                                </a>
                                                <p className="ap-text-xs ap-text-gray-500">
                                                    Uploaded by {attachment.user_name} on{' '}
                                                    {formatLocalDate(attachment.uploaded_at)}
                                                </p>
                                            </div>
                                        </div>
                                        {canEdit && (
                                        <Button
                                            onClick={() => deleteAttachment(attachment.attachment_id)}
                                            variant="ghost"
                                            size="sm"
                                            className="!ap-text-red-600 hover:!ap-text-red-800 ap-ml-2 ap-flex-shrink-0 !ap-p-1"
                                        >
                                            <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                        </Button>
                                        )}
                                    </div>
                                    );
                                })}
                                {attachments.length === 0 && (
                                    <p className="ap-text-center ap-text-gray-500 ap-py-8">No attachments yet</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Activity Tab */}
                    {activeTab === 'activity' && (
                        <div className="ap-space-y-3">
                            {activities.map((activity) => (
                                <div key={activity.log_id} className="ap-flex ap-gap-3">
                                    <div className="ap-flex-shrink-0 ap-w-8 ap-h-8 ap-bg-gray-200 ap-rounded-full ap-flex ap-items-center ap-justify-center">
                                        <span className="ap-text-xs ap-font-medium ap-text-gray-600">
                                            {activity.user_name?.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="ap-flex-1">
                                        <p className="ap-text-sm ap-text-gray-900">
                                            <span className="ap-font-medium">{activity.user_name}</span>{' '}
                                            {activity.action}
                                        </p>
                                        <p className="ap-text-xs ap-text-gray-500">
                                            {new Date(activity.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {activities.length === 0 && (
                                <p className="ap-text-center ap-text-gray-500 ap-py-8">No activity yet</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="ap-flex ap-items-center ap-justify-between ap-p-6 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                    <p className="ap-text-sm ap-text-gray-600">
                        {saving ? 'Saving...' : 'All changes are saved automatically'}
                    </p>
                    <Button
                        onClick={handleClose}
                        variant="primary"
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TaskCardModal;
