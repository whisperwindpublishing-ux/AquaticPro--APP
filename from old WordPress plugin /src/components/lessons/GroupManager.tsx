import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    HiOutlinePlus,
    HiOutlineMagnifyingGlass,
    HiOutlineUserGroup,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineAcademicCap,
    HiOutlineUsers,
    HiOutlineArchiveBox,
    HiOutlineArchiveBoxArrowDown,
    HiOutlineDocumentPlus,
    HiOutlineDocumentText,
    HiOutlineUserCircle,
    HiOutlineCalendar,
    HiOutlineCheck,
    HiOutlineArrowLeft,
    HiOutlineFunnel,
    HiOutlineXCircle
} from 'react-icons/hi2';
import { Button } from '../ui';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LoadingSpinner from '../LoadingSpinner';
import NestedSwimmerEditor from './NestedSwimmerEditor';
import { Group, Level, Swimmer, Camp, Animal, LessonType } from '@/types/lessons';
import { getCachedSimpleUsers, fetchInstructorsByIds } from '@/services/userCache';
import { fetchSwimmersByIds, searchSwimmers } from '@/services/swimmerCache';

// Helper to decode HTML entities in strings (e.g., &amp; -> &)
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

// Sort swimmers alphabetically by name
const sortSwimmersAlphabetically = (swimmers: Swimmer[]): Swimmer[] => {
    return [...swimmers].sort((a, b) => {
        const nameA = decodeHTMLEntities(a.title?.rendered || '');
        const nameB = decodeHTMLEntities(b.title?.rendered || '');
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
};

interface GroupManagerProps {
    apiUrl: string;
    nonce: string;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    onNavigateToSwimmer?: (swimmerId: number) => void;
    onNavigateToNewEvaluation?: (swimmerId: number) => void;
}

interface PaginatedData<T> {
    items: T[];
    page: number;
    totalPages: number;
}

interface GroupFormData {
    title: string;
    level: number | '';
    days: string[];
    group_time: string;
    notes: string;
    swimmers: number[];
    instructor: number[];
    swimmer_grouping: Record<string, number[]>;
    dates_offered: string[];
    media: number | '';
    year: number | '';
    lm_camp: number[];
    lm_animal: number[];
    lm_lesson_type: number[];
    archived: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyFormData: GroupFormData = {
    title: '',
    level: '',
    days: [],
    group_time: '',
    notes: '',
    swimmers: [],
    instructor: [],
    swimmer_grouping: {},
    dates_offered: [],
    media: '',
    year: new Date().getFullYear(),
    lm_camp: [],
    lm_animal: [],
    lm_lesson_type: [],
    archived: false,
};

// Sortable Swimmer Row Component
interface SortableSwimmerRowProps {
    swimmer: Swimmer;
    swimmerLevel?: Level;
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    onRemove: (id: number) => void;
    isEven: boolean;
}

// Calculate age from date of birth
const calculateAge = (dateOfBirth?: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const SortableSwimmerRow: React.FC<SortableSwimmerRowProps> = ({
    swimmer,
    swimmerLevel,
    onEditSwimmer,
    onCreateEvaluation,
    onRemove,
    isEven
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `swimmer-${swimmer.id}` });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease',
        opacity: isDragging ? 0 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 50 : 'auto',
    };

    const age = calculateAge(swimmer.meta?.date_of_birth);
    const hasNotes = swimmer.meta?.notes && swimmer.meta.notes.trim().length > 0;

    return (
        <>
            <tr 
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`${isEven ? 'ap-bg-white' : 'ap-bg-gray-50'} hover:ap-bg-blue-50 group ap-cursor-grab active:ap-cursor-grabbing ap-touch-manipulation ap-transition-colors`}
            >
                {/* Drag handle indicator */}
                <td className="ap-px-2 ap-py-2 ap-w-8">
                    <div className="ap-flex ap-flex-col ap-items-center ap-gap-0.5 ap-text-gray-300">
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                        <span className="ap-block ap-w-4 ap-h-0.5 ap-bg-current ap-rounded"></span>
                    </div>
                </td>
                <td className="ap-px-3 ap-py-2">
                    <span className="ap-text-sm ap-text-gray-900 ap-whitespace-nowrap">
                        {decodeHTMLEntities(swimmer.title?.rendered)}
                    </span>
                </td>
                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-500 ap-whitespace-nowrap">
                    {age !== null ? age : '-'}
                </td>
                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-500">
                    {decodeHTMLEntities(swimmerLevel?.title?.rendered) || '-'}
                </td>
                <td className="ap-px-3 ap-py-2 ap-text-right" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="ap-flex ap-items-center ap-justify-end ap-gap-1">
                        {onEditSwimmer && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditSwimmer(swimmer.id);
                                }}
                                className="!ap-p-1.5 ap-text-blue-600 hover:ap-bg-blue-100 ap-touch-auto"
                                title="Edit swimmer"
                            >
                                <HiOutlinePencil className="ap-w-4 ap-h-4" />
                            </Button>
                        )}
                        {onCreateEvaluation && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateEvaluation(swimmer.id);
                                }}
                                className="!ap-p-1.5 ap-text-green-600 hover:ap-bg-green-100 ap-touch-auto"
                                title="Create evaluation"
                            >
                                <HiOutlineDocumentPlus className="ap-w-4 ap-h-4" />
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(swimmer.id);
                            }}
                            className="!ap-p-1.5 ap-text-red-600 hover:ap-bg-red-100 ap-touch-auto"
                            title="Remove from group"
                        >
                            <HiOutlineXMark className="ap-w-4 ap-h-4" />
                        </Button>
                    </div>
                </td>
            </tr>
            {hasNotes && (
                <tr className={`${isEven ? 'ap-bg-white' : 'ap-bg-gray-50'} ap-border-t-0`}>
                    <td className="ap-px-2 ap-py-1"></td>
                    <td colSpan={4} className="ap-px-3 ap-py-1 ap-pb-2">
                        <span className="ap-text-xs ap-text-amber-700 ap-bg-amber-50 ap-px-2 ap-py-0.5 ap-rounded">
                            Notes: {swimmer.meta.notes}
                        </span>
                    </td>
                </tr>
            )}
        </>
    );
};

// Droppable Instructor Container
interface DroppableInstructorProps {
    instructorId: string;
    instructorName: string;
    swimmers: Swimmer[];
    levels: Level[];
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    onRemoveSwimmer: (id: number) => void;
    isOver?: boolean;
}

const DroppableInstructor: React.FC<DroppableInstructorProps> = ({
    instructorId,
    instructorName,
    swimmers,
    levels,
    onEditSwimmer,
    onCreateEvaluation,
    onRemoveSwimmer,
    isOver
}) => {
    const { setNodeRef } = useDroppable({ id: instructorId });

    return (
        <div 
            ref={setNodeRef}
            className={`ap-border-b ap-border-gray-200 last:ap-border-b-0 ap-transition-colors ${isOver ? 'ap-bg-blue-50' : ''}`}
        >
            <div className={`ap-px-3 ap-py-2 ap-text-sm ap-font-medium ap-flex ap-items-center ap-gap-2 ${
                instructorName === 'Unassigned' ? 'ap-bg-amber-50 ap-text-gray-700' : 'ap-bg-indigo-600 ap-text-white'
            }`}>
                <HiOutlineUserCircle className={`ap-w-4 ap-h-4 ${instructorName === 'Unassigned' ? 'ap-text-amber-500' : 'ap-text-indigo-200'}`} />
                {instructorName}
                <span className={`ap-font-normal ${instructorName === 'Unassigned' ? 'ap-text-gray-400' : 'ap-text-indigo-200'}`}>({swimmers.length})</span>
            </div>
            <SortableContext
                items={swimmers.map(s => `swimmer-${s.id}`)}
                strategy={verticalListSortingStrategy}
            >
                <table className="ap-w-full">
                    <thead className="ap-sr-only">
                        <tr>
                            <th></th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Level</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {swimmers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="ap-px-3 ap-py-4 ap-text-center ap-text-sm ap-text-gray-400 ap-italic">
                                    Drop swimmers here
                                </td>
                            </tr>
                        ) : (
                            swimmers.map((swimmer, index) => {
                                const swimmerLevel = levels.find(l => l.id === swimmer.meta?.current_level);
                                return (
                                    <SortableSwimmerRow
                                        key={swimmer.id}
                                        swimmer={swimmer}
                                        swimmerLevel={swimmerLevel}
                                        onEditSwimmer={onEditSwimmer}
                                        onCreateEvaluation={onCreateEvaluation}
                                        onRemove={onRemoveSwimmer}
                                        isEven={index % 2 === 0}
                                    />
                                );
                            })
                        )}
                    </tbody>
                </table>
            </SortableContext>
        </div>
    );
};

const GroupManager: React.FC<GroupManagerProps> = ({ 
    apiUrl, 
    nonce,
    canCreate = true,
    canEdit = true,
    canDelete = true
}) => {
    const [groups, setGroups] = useState<PaginatedData<Group>>({ items: [], page: 0, totalPages: 1 });
    const [levels, setLevels] = useState<Level[]>([]);
    // Swimmer/instructor data for card display (batch fetched by ID)
    const [swimmerMap, setSwimmerMap] = useState<Map<number, Swimmer>>(new Map());
    const [instructorMap, setInstructorMap] = useState<Map<number, { id: number; name: string }>>(new Map());
    // For form modal: AJAX search results + selected swimmers
    const [formSwimmers, setFormSwimmers] = useState<Swimmer[]>([]);
    const [searchResults, setSearchResults] = useState<Swimmer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchPage, setSearchPage] = useState(1);
    const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);
    // Instructors list for form (loaded once, typically smaller count)
    const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);
    const [camps, setCamps] = useState<Camp[]>([]);
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    
    // Slide-over state
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [formData, setFormData] = useState<GroupFormData>(emptyFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    
    // Search filters for multi-select
    const [instructorSearch, setInstructorSearch] = useState('');
    const [swimmerSearch, setSwimmerSearch] = useState('');
    
    // Filter state for group list
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [filterYear, setFilterYear] = useState<number | ''>('');
    const [filterLevel, setFilterLevel] = useState<number | ''>('');
    const [filterCamp, setFilterCamp] = useState<number | ''>('');
    const [filterAnimal, setFilterAnimal] = useState<number | ''>('');
    const [filterLessonType, setFilterLessonType] = useState<number | ''>('');
    const [filterInstructors, setFilterInstructors] = useState<number[]>([]);
    const [filterDays, setFilterDays] = useState<string[]>([]);
    const [filterInstructorSearch, setFilterInstructorSearch] = useState('');
    
    // Bulk selection state
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
    const [isBulkArchiving, setIsBulkArchiving] = useState(false);
    
    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Drag and drop state
    const [activeSwimmerId, setActiveSwimmerId] = useState<number | null>(null);
    const [overInstructorId, setOverInstructorId] = useState<string | null>(null);
    
    // Nested slide-over state for swimmer edit & evaluation within group context
    const [editingSwimmerId, setEditingSwimmerId] = useState<number | null>(null);
    const [showEvaluationForm, setShowEvaluationForm] = useState(false);
    const [evaluationSwimmerId, setEvaluationSwimmerId] = useState<number | null>(null);
    
    // DnD sensors - optimized for mobile with TouchSensor
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const swimmerId = parseInt(String(active.id).replace('swimmer-', ''));
        setActiveSwimmerId(swimmerId);
    };
    
    // Handle drag over - track which instructor container we're over
    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (over) {
            // Check if we're over an instructor container
            const overId = String(over.id);
            if (overId.startsWith('instructor-') || overId === 'Unassigned') {
                setOverInstructorId(overId);
            }
        } else {
            setOverInstructorId(null);
        }
    };
    
    // Handle drag end - move swimmer to new instructor or reorder within same group
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveSwimmerId(null);
        setOverInstructorId(null);
        
        if (!over) return;
        
        const swimmerId = parseInt(String(active.id).replace('swimmer-', ''));
        const targetId = String(over.id);
        
        // Determine target instructor ID (as string for consistent object keys)
        let targetInstructorId: string | null = null;
        let targetSwimmerId: number | null = null;
        
        if (targetId.startsWith('instructor-')) {
            targetInstructorId = targetId.replace('instructor-', '');
        } else if (targetId === 'Unassigned') {
            targetInstructorId = 'Unassigned';
        } else if (targetId.startsWith('swimmer-')) {
            // Dropped on another swimmer - find which instructor that swimmer belongs to
            targetSwimmerId = parseInt(targetId.replace('swimmer-', ''));
            const grouping = formData.swimmer_grouping || {};
            
            // Check each instructor's swimmer list
            for (const [instId, swimmerIds] of Object.entries(grouping)) {
                if ((swimmerIds as number[]).includes(targetSwimmerId)) {
                    targetInstructorId = String(instId);
                    break;
                }
            }
            
            // If not found in any instructor's grouping, it's in Unassigned
            if (!targetInstructorId) {
                targetInstructorId = 'Unassigned';
            }
        }
        
        if (!targetInstructorId) return;
        
        // Update swimmer_grouping
        setFormData(prev => {
            const newGrouping: Record<string, number[]> = {};
            
            // Copy existing grouping with string keys
            Object.entries(prev.swimmer_grouping || {}).forEach(([key, value]) => {
                newGrouping[String(key)] = [...(value as number[])];
            });
            
            // Find where the swimmer currently is
            let sourceInstructorId: string | null = null;
            for (const [instId, swimmerIds] of Object.entries(newGrouping)) {
                if (swimmerIds.includes(swimmerId)) {
                    sourceInstructorId = instId;
                    break;
                }
            }
            
            // Remove swimmer from source instructor group
            if (sourceInstructorId && newGrouping[sourceInstructorId]) {
                newGrouping[sourceInstructorId] = newGrouping[sourceInstructorId].filter(id => id !== swimmerId);
                if (newGrouping[sourceInstructorId].length === 0) {
                    delete newGrouping[sourceInstructorId];
                }
            }
            
            // Add swimmer to target instructor (unless Unassigned)
            if (targetInstructorId !== 'Unassigned') {
                if (!newGrouping[targetInstructorId]) {
                    newGrouping[targetInstructorId] = [];
                }
                
                // If dropping on a specific swimmer, insert at that position
                if (targetSwimmerId !== null && newGrouping[targetInstructorId].includes(targetSwimmerId)) {
                    const targetIndex = newGrouping[targetInstructorId].indexOf(targetSwimmerId);
                    newGrouping[targetInstructorId].splice(targetIndex, 0, swimmerId);
                } else {
                    // Otherwise add to end
                    newGrouping[targetInstructorId] = [...newGrouping[targetInstructorId], swimmerId];
                }
            }
            
            return {
                ...prev,
                swimmer_grouping: newGrouping
            };
        });
    };

    // Load groups with embedded swimmer/instructor data fetch
    const loadGroups = useCallback(async (reset = false) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setGroups({ items: [], page: 0, totalPages: 1 });
            return;
        }

        if (isLoading) return;
        
        const isNewSearch = reset || (groups.page === 0 && groups.items.length === 0);
        const nextPage = isNewSearch ? 1 : groups.page + 1;

        if (!isNewSearch && groups.page >= groups.totalPages) {
            return;
        }

        setIsLoading(true);
        setError(null);
        
        const startTime = performance.now();
        console.log('[GroupManager] Loading groups page', nextPage);

        try {
            // context=view is faster than context=edit (no extra capability checks per item).
            // _fields limits the response to only what the group list needs, cutting payload size.
            // Cache-bust to ensure fresh data after saves (prevents browser/CDN from serving stale responses)
            let path = `${apiUrl}wp/v2/lm-group?context=view&per_page=20&page=${nextPage}&_fields=id,title,meta,lm_camp,lm_animal,lm_lesson_type,status,date_modified&_t=${Date.now()}`;
            if (searchTerm) {
                path += `&search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(path, {
                headers: { 'X-WP-Nonce': nonce },
            });

            if (!response.ok) {
                throw new Error('Failed to load groups');
            }

            const data = await response.json();
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
            
            console.log(`[GroupManager] Groups fetched in ${(performance.now() - startTime).toFixed(0)}ms, got ${data.length} groups`);

            // Filter archived groups based on showArchived
            const filteredData = showArchived 
                ? data 
                : data.filter((g: Group) => !g.meta?.archived);

            // Immediately fetch swimmers/instructors for these groups
            const swimmerIds = new Set<number>();
            const instructorIds = new Set<number>();
            
            filteredData.forEach((group: Group) => {
                (group.meta?.swimmers || []).forEach((id: number | string) => swimmerIds.add(Number(id)));
                (group.meta?.instructor || []).forEach((id: number | string) => instructorIds.add(Number(id)));
            });
            
            // Fetch swimmer/instructor data in parallel
            const swimmerFetchStart = performance.now();
            const [fetchedSwimmers, fetchedInstructors] = await Promise.all([
                swimmerIds.size > 0 ? fetchSwimmersByIds(Array.from(swimmerIds)) : Promise.resolve([]),
                instructorIds.size > 0 ? fetchInstructorsByIds(Array.from(instructorIds)) : Promise.resolve([]),
            ]);
            console.log(`[GroupManager] Swimmers/instructors fetched in ${(performance.now() - swimmerFetchStart).toFixed(0)}ms (${fetchedSwimmers.length} swimmers, ${fetchedInstructors.length} instructors)`);
            
            // Update swimmer map
            if (fetchedSwimmers.length > 0) {
                setSwimmerMap(prev => {
                    const newMap = new Map(prev);
                    fetchedSwimmers.forEach(swimmer => {
                        newMap.set(swimmer.id, swimmer as Swimmer);
                    });
                    return newMap;
                });
            }
            
            // Update instructor map
            if (fetchedInstructors.length > 0) {
                setInstructorMap(prev => {
                    const newMap = new Map(prev);
                    fetchedInstructors.forEach(inst => {
                        newMap.set(inst.id, inst);
                    });
                    return newMap;
                });
            }

            setGroups(prev => ({
                items: isNewSearch ? filteredData : [...prev.items, ...filteredData],
                page: nextPage,
                totalPages,
            }));
            
            console.log(`[GroupManager] Total load time: ${(performance.now() - startTime).toFixed(0)}ms`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, nonce, groups, searchTerm, isLoading, showArchived]);

    // Reference data loading state (for lazy loading)
    const [isFormDataLoading, setIsFormDataLoading] = useState(false);
    const formDataLoadedRef = React.useRef(false);
    
    // LocalStorage cache for levels (30 minute expiry)
    const LEVELS_CACHE_KEY = 'mp_levels_cache';
    const LEVELS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    // Load ONLY levels on initial page load (needed for card display)
    // Uses localStorage cache to avoid slow API calls
    useEffect(() => {
        const loadLevels = async () => {
            const startTime = performance.now();
            
            // Try localStorage cache first
            try {
                const cached = localStorage.getItem(LEVELS_CACHE_KEY);
                if (cached) {
                    const { levels: cachedLevels, timestamp } = JSON.parse(cached);
                    const age = Date.now() - timestamp;
                    if (age < LEVELS_CACHE_DURATION && cachedLevels?.length > 0) {
                        setLevels(cachedLevels);
                        console.log(`[GroupManager] Levels restored from cache (${cachedLevels.length} levels, age: ${Math.round(age/1000)}s)`);
                        return; // Use cache, skip API call
                    }
                }
            } catch (e) {
                // Cache read failed, continue to API
            }
            
            console.log('[GroupManager] Loading levels from API...');
            
            try {
                const headers = { 'X-WP-Nonce': nonce };
                const levelsRes = await fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, { headers });
                
                if (levelsRes.ok) {
                    const levelsData = await levelsRes.json();
                    const sortedLevels = [...levelsData].sort((a: Level, b: Level) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setLevels(sortedLevels);
                    
                    // Save to localStorage cache
                    try {
                        localStorage.setItem(LEVELS_CACHE_KEY, JSON.stringify({
                            levels: sortedLevels,
                            timestamp: Date.now()
                        }));
                    } catch (e) {
                        // Ignore storage errors
                    }
                    
                    console.log(`[GroupManager] Levels loaded from API in ${(performance.now() - startTime).toFixed(0)}ms`);
                }
            } catch (err) {
                console.error('Error loading levels:', err);
            }
        };
        
        loadLevels();
        loadGroups(true);
    }, [apiUrl, nonce]);
    
    // LocalStorage cache for taxonomy data (30 minute expiry)
    const TAXONOMY_CACHE_KEY = 'mp_lm_taxonomy_cache';
    const TAXONOMY_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    
    // Lazy load form reference data (camps, animals, lesson types, instructors)
    // Uses localStorage cache to avoid slow API calls
    const loadFormReferenceData = useCallback(async () => {
        // Skip if already loaded this session
        if (formDataLoadedRef.current) {
            console.log('[GroupManager] Form reference data already loaded');
            return;
        }
        
        setIsFormDataLoading(true);
        const startTime = performance.now();
        
        // Try localStorage cache first for taxonomies
        let cachedTaxonomies: { camps?: Camp[]; animals?: Animal[]; lessonTypes?: LessonType[] } | null = null;
        try {
            const cached = localStorage.getItem(TAXONOMY_CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                if (age < TAXONOMY_CACHE_DURATION && data) {
                    cachedTaxonomies = data;
                    console.log(`[GroupManager] Taxonomies restored from cache (age: ${Math.round(age/1000)}s)`);
                }
            }
        } catch (e) {
            // Cache read failed, continue to API
        }
        
        try {
            const headers = { 'X-WP-Nonce': nonce };
            
            if (cachedTaxonomies) {
                // Use cached taxonomies, only fetch users
                console.log('[GroupManager] Using cached taxonomies, fetching users only...');
                const allUsersData = await getCachedSimpleUsers();
                
                if (cachedTaxonomies.camps) setCamps(cachedTaxonomies.camps);
                if (cachedTaxonomies.animals) setAnimals(cachedTaxonomies.animals);
                if (cachedTaxonomies.lessonTypes) setLessonTypes(cachedTaxonomies.lessonTypes);
                setInstructors(allUsersData);
                
                console.log(`[GroupManager] Form reference data loaded in ${(performance.now() - startTime).toFixed(0)}ms (taxonomies from cache)`);
            } else {
                // Fetch everything from API in parallel
                console.log('[GroupManager] Loading form reference data from API...');
                const [campsRes, animalsRes, lessonTypesRes, allUsersData] = await Promise.all([
                    fetch(`${apiUrl}wp/v2/lm_camp?per_page=100`, { headers }),
                    fetch(`${apiUrl}wp/v2/lm_animal?per_page=100`, { headers }),
                    fetch(`${apiUrl}wp/v2/lm_lesson_type?per_page=100`, { headers }),
                    getCachedSimpleUsers(), // Users for instructor dropdown
                ]);
                
                const campsData = campsRes.ok ? await campsRes.json() : [];
                const animalsData = animalsRes.ok ? await animalsRes.json() : [];
                const lessonTypesData = lessonTypesRes.ok ? await lessonTypesRes.json() : [];
                
                setCamps(campsData);
                setAnimals(animalsData);
                setLessonTypes(lessonTypesData);
                setInstructors(allUsersData);
                
                // Save taxonomies to localStorage cache
                try {
                    localStorage.setItem(TAXONOMY_CACHE_KEY, JSON.stringify({
                        data: { camps: campsData, animals: animalsData, lessonTypes: lessonTypesData },
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    // Ignore storage errors
                }
                
                console.log(`[GroupManager] Form reference data loaded from API in ${(performance.now() - startTime).toFixed(0)}ms`);
            }
            
            formDataLoadedRef.current = true;
        } catch (err) {
            console.error('Error loading form reference data:', err);
        } finally {
            setIsFormDataLoading(false);
        }
    }, [apiUrl, nonce]);

    // Handle search - reset groups when search changes
    useEffect(() => {
        const handler = setTimeout(() => {
            setGroups({ items: [], page: 0, totalPages: 1 });
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, showArchived]);

    // Reload when groups reset DUE TO SEARCH (not initial load)
    // Use a ref to track if initial load has happened
    const initialLoadDone = React.useRef(false);
    useEffect(() => {
        // Skip on initial mount - the apiUrl/nonce effect handles that
        if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            return;
        }
        // Only reload if groups were reset (page 0, no items) and we're not already loading
        if (groups.items.length === 0 && !isLoading && groups.page === 0) {
            loadGroups(true);
        }
    }, [groups.items.length, groups.page, isLoading]);

    const getLevelName = (levelId: number | '' | string): string => {
        if (levelId === '' || levelId === null || levelId === undefined) return 'Not assigned';
        // Convert to number for comparison (API might return string)
        const numericId = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;
        // Handle special level values
        if (numericId === -1) return 'Mixed Levels';
        if (numericId === -2) return 'Testing';
        const level = levels.find(l => l.id === numericId);
        return decodeHTMLEntities(level?.title?.rendered) || 'Unknown Level';
    };

    const formatDays = (days: string[]): string => {
        if (!days || days.length === 0) return 'No days set';
        return days.join(', ');
    };

    const getCampName = (campIds: number[]): string => {
        if (!campIds || campIds.length === 0) return '';
        const campNames = campIds
            .map(id => camps.find(c => c.id === id)?.name)
            .filter(Boolean);
        return campNames.join(', ');
    };

    const getAnimalName = (animalIds: number[]): string => {
        if (!animalIds || animalIds.length === 0) return '';
        const animalNames = animalIds
            .map(id => animals.find(a => a.id === id)?.name)
            .filter(Boolean);
        return animalNames.join(', ');
    };

    // Get swimmers grouped by instructor for a group (for card display)
    // Uses swimmerMap and instructorMap (batch-fetched data) instead of loading all swimmers
    // Note: This function defensively handles potentially stale swimmer_grouping data
    const getGroupSwimmersByInstructor = (group: Group): { instructorName: string; swimmers: Swimmer[] }[] => {
        const swimmerGrouping = group.meta?.swimmer_grouping || {};
        const groupInstructorIds = group.meta?.instructor || [];
        const groupSwimmerIds = (group.meta?.swimmers || []).map(id => Number(id));
        const groupSwimmerIdSet = new Set(groupSwimmerIds);
        
        const result: { instructorName: string; swimmers: Swimmer[] }[] = [];
        const assignedSwimmerIds = new Set<number>();
        
        // Group swimmers by instructor - only consider current instructors
        groupInstructorIds.forEach(instId => {
            const instIdStr = String(instId);
            // Get swimmer IDs for this instructor, but only include those in the group
            const swimmerIds = (swimmerGrouping[instIdStr] || [])
                .map((sid: number | string) => Number(sid))
                .filter((sid: number) => groupSwimmerIdSet.has(sid)); // Filter to only swimmers in the group
            
            swimmerIds.forEach(sid => assignedSwimmerIds.add(sid));
            
            const instructor = instructorMap.get(Number(instId));
            const instructorSwimmers = swimmerIds
                .map(sid => swimmerMap.get(sid))
                .filter((s): s is Swimmer => !!s);
            
            if (instructorSwimmers.length > 0) {
                result.push({
                    instructorName: instructor?.name || 'Unknown',
                    swimmers: sortSwimmersAlphabetically(instructorSwimmers)
                });
            }
        });
        
        // Find unassigned swimmers - those in the group but not assigned to any current instructor
        const unassignedSwimmers = groupSwimmerIds
            .filter(sid => !assignedSwimmerIds.has(sid))
            .map(sid => swimmerMap.get(sid))
            .filter((s): s is Swimmer => !!s);
        
        if (unassignedSwimmers.length > 0) {
            result.push({
                instructorName: 'Unassigned',
                swimmers: sortSwimmersAlphabetically(unassignedSwimmers)
            });
        }
        
        return result;
    };

    // Filtered instructors for multi-select - selected items always shown first, sorted alphabetically
    const filteredInstructors = useMemo(() => {
        const search = instructorSearch.toLowerCase();
        const filtered = instructorSearch 
            ? instructors.filter(i => i.name.toLowerCase().includes(search))
            : instructors;
        
        // Always include selected instructors at the top, even if not in filtered list
        const selectedIds = new Set(formData.instructor);
        const selectedInstructors = instructors
            .filter(i => selectedIds.has(i.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        const unselectedFiltered = filtered.filter(i => !selectedIds.has(i.id));
        
        return [...selectedInstructors, ...unselectedFiltered];
    }, [instructors, instructorSearch, formData.instructor]);

    // AJAX-based swimmer search with debounce
    const searchSwimmersDebounced = useCallback(async (searchValue: string, page: number = 1) => {
        setIsSearching(true);
        try {
            const result = await searchSwimmers(searchValue, page);
            if (page === 1) {
                setSearchResults(result.swimmers as Swimmer[]);
            } else {
                setSearchResults(prev => [...prev, ...(result.swimmers as Swimmer[])]);
            }
            setSearchPage(page);
            setHasMoreSearchResults(result.hasMore);
        } catch (err) {
            console.error('Swimmer search failed:', err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounce swimmer search
    useEffect(() => {
        const handler = setTimeout(() => {
            searchSwimmersDebounced(swimmerSearch, 1);
        }, 300);
        return () => clearTimeout(handler);
    }, [swimmerSearch, searchSwimmersDebounced]);

    // Filtered swimmers: selected swimmers first (sorted alphabetically), then search results
    const filteredSwimmers = useMemo(() => {
        const selectedIds = new Set(formData.swimmers);
        
        // Get selected swimmers from formSwimmers (pre-loaded when editing), sorted alphabetically
        const selectedSwimmers = sortSwimmersAlphabetically(
            formSwimmers.filter(s => selectedIds.has(s.id))
        );
        
        // Filter search results to exclude already selected
        const unselectedResults = searchResults.filter(s => !selectedIds.has(s.id));
        
        return [...selectedSwimmers, ...unselectedResults];
    }, [formSwimmers, searchResults, formData.swimmers]);

    // Load more search results
    const loadMoreSwimmers = () => {
        if (!isSearching && hasMoreSearchResults) {
            searchSwimmersDebounced(swimmerSearch, searchPage + 1);
        }
    };

    // Toggle instructor selection - also clean up swimmer_grouping when removing instructor
    const toggleInstructor = (instructorId: number) => {
        setFormData(prev => {
            const isRemoving = prev.instructor.includes(instructorId);
            const newInstructors = isRemoving
                ? prev.instructor.filter(id => id !== instructorId)
                : [...prev.instructor, instructorId];
            
            // When removing an instructor, remove their key from swimmer_grouping
            let newSwimmerGrouping = prev.swimmer_grouping;
            if (isRemoving) {
                const instIdStr = String(instructorId);
                if (instIdStr in prev.swimmer_grouping) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { [instIdStr]: _, ...rest } = prev.swimmer_grouping;
                    newSwimmerGrouping = rest;
                }
            }
            
            return {
                ...prev,
                instructor: newInstructors,
                swimmer_grouping: newSwimmerGrouping
            };
        });
    };

    // Toggle swimmer selection - also update formSwimmers and swimmer_grouping
    const toggleSwimmer = (swimmerId: number) => {
        const swimmer = searchResults.find(s => s.id === swimmerId) || formSwimmers.find(s => s.id === swimmerId);
        
        setFormData(prev => {
            const isRemoving = prev.swimmers.includes(swimmerId);
            const newSwimmers = isRemoving
                ? prev.swimmers.filter(id => id !== swimmerId)
                : [...prev.swimmers, swimmerId];
            
            // When removing a swimmer, remove them from swimmer_grouping
            let newSwimmerGrouping = prev.swimmer_grouping;
            if (isRemoving) {
                newSwimmerGrouping = { ...prev.swimmer_grouping };
                for (const instId of Object.keys(newSwimmerGrouping)) {
                    const swimmerIds = newSwimmerGrouping[instId] as number[];
                    if (swimmerIds.includes(swimmerId)) {
                        newSwimmerGrouping[instId] = swimmerIds.filter(id => id !== swimmerId);
                        // Remove the key entirely if empty
                        if ((newSwimmerGrouping[instId] as number[]).length === 0) {
                            delete newSwimmerGrouping[instId];
                        }
                    }
                }
            }
            
            return {
                ...prev,
                swimmers: newSwimmers,
                swimmer_grouping: newSwimmerGrouping
            };
        });
        
        // If selecting a new swimmer, add to formSwimmers for display
        if (swimmer && !formSwimmers.find(s => s.id === swimmerId)) {
            setFormSwimmers(prev => [...prev, swimmer]);
        }
    };

    // Add date to dates_offered
    const addDateOffered = (date: string) => {
        if (date && !formData.dates_offered.includes(date)) {
            setFormData(prev => ({
                ...prev,
                dates_offered: [...prev.dates_offered, date].sort()
            }));
        }
    };

    // Remove date from dates_offered
    const removeDateOffered = (date: string) => {
        setFormData(prev => ({
            ...prev,
            dates_offered: prev.dates_offered.filter(d => d !== date)
        }));
    };

    // Open slide-over for creating new group
    const handleAddNew = () => {
        setEditingGroup(null);
        setFormData(emptyFormData);
        setFormError(null);
        setInstructorSearch('');
        setSwimmerSearch('');
        setFormSwimmers([]); // Clear form swimmers for new group
        setSearchResults([]); // Clear search results
        setIsSlideOverOpen(true);
        // Lazy load form reference data if not already loaded
        loadFormReferenceData();
    };

    // Open slide-over for editing existing group
    const handleEdit = async (group: Group) => {
        setEditingGroup(group);
        setFormData({
            title: group.title?.rendered || '',
            level: group.meta?.level || '',
            days: group.meta?.days || [],
            group_time: group.meta?.group_time || '',
            notes: group.meta?.notes || '',
            swimmers: group.meta?.swimmers || [],
            instructor: group.meta?.instructor || [],
            swimmer_grouping: group.meta?.swimmer_grouping || {},
            dates_offered: group.meta?.dates_offered || [],
            media: group.meta?.media || '',
            year: group.meta?.year || new Date().getFullYear(),
            lm_camp: group.lm_camp || [],
            lm_animal: group.lm_animal || [],
            lm_lesson_type: group.lm_lesson_type || [],
            archived: group.meta?.archived || false,
        });
        setFormError(null);
        setInstructorSearch('');
        setSwimmerSearch('');
        setSearchResults([]); // Clear search results
        setIsSlideOverOpen(true);
        
        // Lazy load form reference data AND group swimmers in parallel
        const swimmerIds = group.meta?.swimmers || [];
        const loadPromises: Promise<void>[] = [
            loadFormReferenceData(), // Lazy load camps/animals/lessonTypes/instructors
        ];
        
        if (swimmerIds.length > 0) {
            loadPromises.push(
                fetchSwimmersByIds(swimmerIds.map(Number))
                    .then(swimmers => setFormSwimmers(swimmers as Swimmer[]))
                    .catch(err => {
                        console.error('Failed to load group swimmers:', err);
                        setFormSwimmers([]); // Fallback to empty
                    })
            );
        } else {
            setFormSwimmers([]);
        }
        
        // Execute both in parallel
        await Promise.all(loadPromises);
    };

    // Close slide-over
    const handleCloseSlideOver = () => {
        setIsSlideOverOpen(false);
        setEditingGroup(null);
        setFormData(emptyFormData);
        setFormError(null);
        setInstructorSearch('');
        setSwimmerSearch('');
        setFormSwimmers([]); // Clear form swimmers
        setSearchResults([]); // Clear search results
    };

    // Handle form field change
    const handleFieldChange = (field: keyof GroupFormData, value: unknown) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Toggle day selection
    const toggleDay = (day: string) => {
        setFormData(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    };

    // Save group (create or update)
    const handleSave = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Validate required fields
        if (!formData.title.trim()) {
            setFormError('Group name is required');
            return;
        }

        setIsSaving(true);
        setFormError(null);

        try {
            const isEditing = !!editingGroup;
            // Use the custom lm/v1 endpoints which directly call update_post_meta
            // for each meta key. The standard wp/v2 endpoint has issues persisting
            // object-type meta (swimmer_grouping) with numeric string keys.
            const url = isEditing 
                ? `${apiUrl}lm/v1/groups/${editingGroup.id}`
                : `${apiUrl}lm/v1/groups`;
            
            // Sanitize swimmer_grouping before saving:
            // 1. Remove keys for instructors not in the current instructor list
            // 2. Remove swimmer IDs not in the current swimmers list
            const instructorIdStrSet = new Set(formData.instructor.map(id => String(id)));
            const swimmerIdSet = new Set(formData.swimmers);
            const sanitizedSwimmerGrouping: Record<string, number[]> = {};
            
            for (const [instIdStr, swimmerIds] of Object.entries(formData.swimmer_grouping)) {
                // Only keep if instructor is in current list
                if (instructorIdStrSet.has(instIdStr)) {
                    // Filter to only swimmers in current list
                    const validSwimmerIds = (swimmerIds as number[]).filter(sid => swimmerIdSet.has(sid));
                    if (validSwimmerIds.length > 0) {
                        sanitizedSwimmerGrouping[instIdStr] = validSwimmerIds;
                    }
                }
            }
            
            const body: Record<string, unknown> = {
                title: formData.title.trim(),
                status: 'publish',
                meta: {
                    level: formData.level || '',
                    days: formData.days,
                    group_time: formData.group_time.trim(),
                    notes: formData.notes.trim(),
                    swimmers: formData.swimmers,
                    instructor: formData.instructor,
                    swimmer_grouping: sanitizedSwimmerGrouping,
                    dates_offered: formData.dates_offered,
                    media: formData.media || 0,
                    year: formData.year || new Date().getFullYear(),
                    archived: formData.archived,
                },
                lm_camp: formData.lm_camp,
                lm_animal: formData.lm_animal,
                lm_lesson_type: formData.lm_lesson_type,
            };

            // Include original_modified for conflict detection on updates
            if (isEditing && editingGroup.modified_gmt) {
                body.original_modified = editingGroup.modified_gmt;
            }

            const response = await fetch(url, {
                method: 'POST', // Custom lm/v1 endpoints use POST for both create and update
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'create'} group`);
            }

            await response.json();

            // Always reload groups to get fully populated data from API
            // This ensures taxonomy terms, swimmer names, etc. are properly resolved
            setGroups({ items: [], page: 0, totalPages: 1 });

            handleCloseSlideOver();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete group
    const handleDelete = async () => {
        if (!deleteConfirm) return;

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setIsDeleting(true);

        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-group/${deleteConfirm.id}?force=true`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete group');
            }

            // Remove from local state
            setGroups(prev => ({
                ...prev,
                items: prev.items.filter(g => g.id !== deleteConfirm.id),
            }));

            setDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete group');
            setDeleteConfirm(null);
        } finally {
            setIsDeleting(false);
        }
    };

    // Archive/unarchive group
    const handleToggleArchive = async (group: Group) => {
        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-group/${group.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    meta: {
                        ...group.meta,
                        archived: !group.meta?.archived,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update group');
            }

            const updatedGroup = await response.json();
            
            // Update local state
            if (!showArchived && updatedGroup.meta?.archived) {
                // Remove from list if archiving and not showing archived
                setGroups(prev => ({
                    ...prev,
                    items: prev.items.filter(g => g.id !== group.id),
                }));
            } else {
                setGroups(prev => ({
                    ...prev,
                    items: prev.items.map(g => g.id === group.id ? updatedGroup : g),
                }));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive group');
        }
    };

    // Bulk archive selected groups
    const handleBulkArchive = async (archive: boolean) => {
        if (selectedGroupIds.size === 0) return;
        
        setIsBulkArchiving(true);
        try {
            const promises = Array.from(selectedGroupIds).map(async (groupId) => {
                const group = groups.items.find(g => g.id === groupId);
                if (!group) return null;
                
                const response = await fetch(`${apiUrl}wp/v2/lm-group/${groupId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': nonce,
                    },
                    body: JSON.stringify({
                        meta: {
                            ...group.meta,
                            archived: archive,
                        }
                    }),
                });
                
                if (!response.ok) return null;
                return response.json();
            });
            
            const results = await Promise.all(promises);
            const updatedGroups = results.filter(Boolean);
            
            // Update local state
            setGroups(prev => {
                let newItems = prev.items;
                
                updatedGroups.forEach(updatedGroup => {
                    if (!showArchived && updatedGroup.meta?.archived) {
                        // Remove from list if archiving and not showing archived
                        newItems = newItems.filter(g => g.id !== updatedGroup.id);
                    } else {
                        newItems = newItems.map(g => g.id === updatedGroup.id ? updatedGroup : g);
                    }
                });
                
                return { ...prev, items: newItems };
            });
            
            // Clear selection
            setSelectedGroupIds(new Set());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive groups');
        } finally {
            setIsBulkArchiving(false);
        }
    };

    // Toggle single group selection
    const toggleGroupSelection = (groupId: number) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    // Select/deselect all visible groups
    const toggleSelectAll = () => {
        if (selectedGroupIds.size === filteredGroups.length) {
            setSelectedGroupIds(new Set());
        } else {
            setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)));
        }
    };

    // Get swimmers grouped by instructor for display in form
    // Returns array with instructor ID, name, and swimmers for consistent mapping
    // Uses formSwimmers (pre-loaded for editing or added via search) instead of allSwimmers
    const instructorGroups = useMemo(() => {
        const selectedSwimmers = formSwimmers.filter(s => formData.swimmers.includes(s.id));
        const grouping = formData.swimmer_grouping || {};
        
        const groups: Array<{ id: string; name: string; swimmers: Swimmer[] }> = [];
        const assignedSwimmerIds = new Set<number>();
        
        // Add ALL selected instructors (even if they have no swimmers yet)
        formData.instructor.forEach(instructorId => {
            const instructor = instructors.find(i => i.id === instructorId);
            const name = instructor?.name || `Instructor ${instructorId}`;
            // Use string key for consistent lookup (JSON keys are always strings)
            const swimmerIds = (grouping[String(instructorId)] as number[]) || [];
            const instructorSwimmers = swimmerIds
                .filter(id => formData.swimmers.includes(id))
                .map(id => selectedSwimmers.find(s => s.id === id))
                .filter(Boolean) as Swimmer[];
            swimmerIds.forEach(id => assignedSwimmerIds.add(id));
            
            groups.push({
                id: `instructor-${instructorId}`,
                name,
                swimmers: sortSwimmersAlphabetically(instructorSwimmers)
            });
        });
        
        // Add unassigned swimmers (swimmers not assigned to any instructor)
        const unassigned = selectedSwimmers.filter(s => !assignedSwimmerIds.has(s.id));
        // Always show Unassigned section so swimmers can be dragged there
        groups.push({
            id: 'Unassigned',
            name: 'Unassigned',
            swimmers: sortSwimmersAlphabetically(unassigned)
        });
        
        return groups;
    }, [formData.swimmers, formData.instructor, formData.swimmer_grouping, formSwimmers, instructors]);

    // Count active filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterYear) count++;
        if (filterLevel) count++;
        if (filterCamp) count++;
        if (filterAnimal) count++;
        if (filterLessonType) count++;
        if (filterInstructors.length > 0) count++;
        if (filterDays.length > 0) count++;
        if (showArchived) count++;
        return count;
    }, [filterYear, filterLevel, filterCamp, filterAnimal, filterLessonType, filterInstructors, filterDays, showArchived]);

    // Clear all filters
    const clearFilters = () => {
        setFilterYear('');
        setFilterLevel('');
        setFilterCamp('');
        setFilterAnimal('');
        setFilterLessonType('');
        setFilterInstructors([]);
        setFilterDays([]);
        setShowArchived(false);
        setFilterInstructorSearch('');
    };

    // Filter groups based on all criteria
    const filteredGroups = useMemo(() => {
        return groups.items.filter(group => {
            // Year filter
            if (filterYear && group.meta?.year !== filterYear) return false;
            
            // Level filter
            if (filterLevel && group.meta?.level !== filterLevel) return false;
            
            // Camp filter
            if (filterCamp && !group.lm_camp?.includes(filterCamp)) return false;
            
            // Animal filter
            if (filterAnimal && !group.lm_animal?.includes(filterAnimal)) return false;
            
            // Lesson Type filter
            if (filterLessonType && !group.lm_lesson_type?.includes(filterLessonType)) return false;
            
            // Instructor filter (any match)
            if (filterInstructors.length > 0) {
                const groupInstructors = group.meta?.instructor || [];
                if (!filterInstructors.some(id => groupInstructors.includes(id))) return false;
            }
            
            // Days filter (any match)
            if (filterDays.length > 0) {
                const groupDays = group.meta?.days || [];
                if (!filterDays.some(day => groupDays.includes(day))) return false;
            }
            
            return true;
        });
    }, [groups.items, filterYear, filterLevel, filterCamp, filterAnimal, filterLessonType, filterInstructors, filterDays]);

    // Get unique years from groups for year filter
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        groups.items.forEach(g => {
            if (g.meta?.year) years.add(g.meta.year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [groups.items]);

    return (
        <div className="ap-p-6">
            {/* Header with search, filters, and add button */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4 ap-mb-6">
                <div className="ap-flex ap-flex-1 ap-gap-3 ap-items-center ap-flex-wrap">
                    <div className="ap-relative ap-flex-1 ap-max-w-md ap-min-w-[200px]">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                        />
                    </div>
                    
                    {/* Filter Button */}
                    <div className="ap-relative">
                        <Button
                            variant="ghost"
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`!ap-flex ap-items-center ap-gap-2 !ap-px-3 !ap-py-2.5 ap-rounded-lg ap-border ap-transition-colors ${
                                activeFilterCount > 0 
                                    ? 'ap-bg-blue-50 ap-border-blue-500 ap-text-blue-600' : 'ap-border-gray-200 ap-text-gray-600 hover:ap-bg-gray-50'
                            }`}
                        >
                            <HiOutlineFunnel className="ap-w-5 ap-h-5" />
                            <span className="ap-text-sm ap-font-medium">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="ap-flex ap-items-center ap-justify-center ap-w-5 ap-h-5 ap-text-xs ap-font-bold ap-bg-blue-600 ap-text-white ap-rounded-full">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        
                        {/* Filter Dropdown Menu */}
                        {showFilterMenu && (
                            <div className="ap-absolute ap-left-0 ap-top-full ap-mt-2 ap-w-80 ap-bg-white ap-rounded-xl ap-shadow-lg ap-border ap-border-gray-200 ap-z-20 ap-p-4 ap-space-y-4">
                                <div className="ap-flex ap-items-center ap-justify-between">
                                    <h4 className="ap-font-medium ap-text-gray-900">Filter Groups</h4>
                                    {activeFilterCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={clearFilters}
                                            className="!ap-p-0 ap-text-xs ap-text-blue-600 hover:ap-underline"
                                        >
                                            Clear all
                                        </Button>
                                    )}
                                </div>
                                
                                {/* Year */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Year</label>
                                    <select
                                        value={filterYear}
                                        onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                    >
                                        <option value="">All years</option>
                                        {availableYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Level */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Level</label>
                                    <select
                                        value={filterLevel}
                                        onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                    >
                                        <option value="">All levels</option>
                                        {levels.map(level => (
                                            <option key={level.id} value={level.id}>{decodeHTMLEntities(level.title?.rendered)}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Camp */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Camp</label>
                                    <select
                                        value={filterCamp}
                                        onChange={(e) => setFilterCamp(e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                    >
                                        <option value="">All camps</option>
                                        {camps.map(camp => (
                                            <option key={camp.id} value={camp.id}>{camp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Animal */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Animal Group</label>
                                    <select
                                        value={filterAnimal}
                                        onChange={(e) => setFilterAnimal(e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                    >
                                        <option value="">All animals</option>
                                        {animals.map(animal => (
                                            <option key={animal.id} value={animal.id}>{animal.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Lesson Type */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Lesson Type</label>
                                    <select
                                        value={filterLessonType}
                                        onChange={(e) => setFilterLessonType(e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-3 ap-py-2 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                    >
                                        <option value="">All types</option>
                                        {lessonTypes.map(lt => (
                                            <option key={lt.id} value={lt.id}>{lt.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Instructors - searchable multi-select */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">
                                        Instructors {filterInstructors.length > 0 && `(${filterInstructors.length} selected)`}
                                    </label>
                                    {/* Selected instructors chips */}
                                    {filterInstructors.length > 0 && (
                                        <div className="ap-flex ap-flex-wrap ap-gap-1 ap-mb-2">
                                            {filterInstructors.map(id => {
                                                const instructor = instructors.find(i => i.id === id);
                                                return instructor ? (
                                                    <span 
                                                        key={id} 
                                                        className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-text-xs ap-bg-purple-100 ap-text-purple-700 ap-rounded-full"
                                                    >
                                                        {instructor.name}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => setFilterInstructors(prev => prev.filter(i => i !== id))}
                                                            className="!ap-p-0 hover:ap-text-purple-900"
                                                        >
                                                            <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                        </Button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                    {/* Search input */}
                                    <div className="ap-relative">
                                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-2 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                        <input
                                            type="text"
                                            value={filterInstructorSearch}
                                            onChange={(e) => setFilterInstructorSearch(e.target.value)}
                                            placeholder="Search instructors..."
                                            className="ap-w-full ap-pl-8 ap-pr-3 ap-py-1.5 ap-text-sm ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                        />
                                        {filterInstructorSearch && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setFilterInstructorSearch('')}
                                                className="!ap-p-0 ap-absolute ap-right-2 ap-top-1/2 -ap-translate-y-1/2 ap-text-gray-400 hover:ap-text-gray-600"
                                            >
                                                <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {/* Dropdown list - only show when searching */}
                                    {filterInstructorSearch && (
                                        <div className="ap-mt-1 ap-max-h-32 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-lg ap-bg-white ap-shadow-sm">
                                            {instructors
                                                .filter(i => i.name.toLowerCase().includes(filterInstructorSearch.toLowerCase()))
                                                .filter(i => !filterInstructors.includes(i.id))
                                                .slice(0, 10)
                                                .map(instructor => (
                                                    <Button
                                                        key={instructor.id}
                                                        type="button"
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => {
                                                            setFilterInstructors(prev => [...prev, instructor.id]);
                                                            setFilterInstructorSearch('');
                                                        }}
                                                        className="!ap-w-full !ap-text-left !ap-px-3 !ap-py-1.5 ap-text-sm hover:ap-bg-gray-50 ap-border-b ap-border-gray-100 last:ap-border-b-0 !ap-rounded-none !ap-justify-start"
                                                    >
                                                        {instructor.name}
                                                    </Button>
                                                ))
                                            }
                                            {instructors
                                                .filter(i => i.name.toLowerCase().includes(filterInstructorSearch.toLowerCase()))
                                                .filter(i => !filterInstructors.includes(i.id))
                                                .length === 0 && (
                                                <div className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-500 ap-text-center">
                                                    No instructors found
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Days */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Days</label>
                                    <div className="ap-flex ap-flex-wrap ap-gap-1">
                                        {DAYS_OF_WEEK.map(day => {
                                            const isSelected = filterDays.includes(day);
                                            return (
                                                <Button
                                                    key={day}
                                                    type="button"
                                                    variant="unstyled"
                                                    size="xs"
                                                    onClick={() => {
                                                        setFilterDays(prev => 
                                                            prev.includes(day) 
                                                                ? prev.filter(d => d !== day)
                                                                : [...prev, day]
                                                        );
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '9999px',
                                                        transition: 'all 150ms',
                                                        cursor: 'pointer',
                                                        border: isSelected ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                                        backgroundColor: isSelected ? '#2563eb' : '#f3f4f6',
                                                        color: isSelected ? '#ffffff' : '#4b5563',
                                                    }}
                                                >
                                                    {day.slice(0, 3)}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* Archived Filter */}
                                <div>
                                    <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1">Archived</label>
                                    <div className="ap-flex ap-gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => setShowArchived(false)}
                                            className={`!ap-px-3 !ap-py-1.5 ap-text-xs ap-rounded-lg ap-transition-colors ${
                                                !showArchived
                                                    ? 'ap-bg-blue-600 ap-text-white' : 'ap-bg-gray-100 ap-text-gray-600 hover:ap-bg-gray-200'
                                            }`}
                                        >
                                            Hide
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => setShowArchived(true)}
                                            className={`!ap-px-3 !ap-py-1.5 ap-text-xs ap-rounded-lg ap-transition-colors ${
                                                showArchived
                                                    ? 'ap-bg-blue-600 ap-text-white' : 'ap-bg-gray-100 ap-text-gray-600 hover:ap-bg-gray-200'
                                            }`}
                                        >
                                            Show
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Close button */}
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowFilterMenu(false)}
                                    className="!ap-w-full !ap-py-2 ap-text-sm ap-font-medium"
                                >
                                    Done
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                {canCreate && (
                    <Button
                        variant="lesson-groups"
                        onClick={handleAddNew}
                        className="!ap-flex ap-items-center ap-gap-2 ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 hover:ap-shadow-lg"
                    >
                        <HiOutlinePlus className="ap-w-5 ap-h-5" />
                        <span>Add Group</span>
                    </Button>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-mb-6 ap-flex ap-items-center ap-justify-between">
                    <span>{error}</span>
                    <Button variant="ghost" size="xs" onClick={() => setError(null)} className="!ap-p-0 ap-text-red-400 hover:ap-text-red-600">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}

            {/* Bulk Selection Bar */}
            {filteredGroups.length > 0 && (
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-4 ap-p-3 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <label className="ap-flex ap-items-center ap-gap-2 ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedGroupIds.size > 0 && selectedGroupIds.size === filteredGroups.length}
                                onChange={toggleSelectAll}
                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                            />
                            <span className="ap-text-sm ap-text-gray-600">
                                {selectedGroupIds.size === 0 
                                    ? 'Select all' 
                                    : `${selectedGroupIds.size} selected`}
                            </span>
                        </label>
                        {selectedGroupIds.size > 0 && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => setSelectedGroupIds(new Set())}
                                className="!ap-p-0 ap-text-xs ap-text-gray-500 hover:ap-text-gray-700"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    {selectedGroupIds.size > 0 && (
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBulkArchive(true)}
                                disabled={isBulkArchiving}
                                className="!ap-flex ap-items-center ap-gap-1.5"
                            >
                                <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />
                                Archive
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBulkArchive(false)}
                                disabled={isBulkArchiving}
                                className="!ap-flex ap-items-center ap-gap-1.5"
                            >
                                <HiOutlineArchiveBoxArrowDown className="ap-w-4 ap-h-4" />
                                Unarchive
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Groups grid */}
            <div className="ap-grid ap-gap-4 sm:ap-grid-cols-2 lg:ap-grid-cols-3">
                {filteredGroups.map((group) => (
                    <div
                        key={group.id}
                        className={`ap-bg-gray-50 ap-rounded-xl ap-p-4 ap-border ap-transition-all ${
                            selectedGroupIds.has(group.id)
                                ? 'ap-border-blue-500 ap-ring-2 ap-ring-blue-500/20' : 'ap-border-gray-200 hover:ap-border-blue-500/50 hover:ap-shadow-md'
                        } ${group.meta?.archived ? 'ap-opacity-60' : ''}`}
                    >
                        <div className="ap-flex ap-items-start ap-gap-3 ap-mb-3">
                            <input
                                type="checkbox"
                                checked={selectedGroupIds.has(group.id)}
                                onChange={() => toggleGroupSelection(group.id)}
                                className="ap-mt-1 ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500 ap-cursor-pointer"
                            />
                            <div className="ap-flex-1 ap-min-w-0">
                                <div className="ap-flex ap-items-start ap-justify-between">
                                    <h3 className="ap-text-sm ap-font-medium ap-text-gray-900 line-clamp-1">
                                        {group.title?.rendered || 'Untitled Group'}
                                    </h3>
                                    <div className="ap-flex ap-items-center ap-gap-1 ap-flex-shrink-0 ap-ml-2">
                                        {group.meta?.archived && (
                                            <span className="ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-bg-gray-200 ap-text-gray-600 ap-rounded">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="ap-space-y-2 ap-text-sm ap-text-gray-600">
                            {group.meta?.level && (
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-text-indigo-500" />
                                    <span>{getLevelName(group.meta.level)}</span>
                                </div>
                            )}
                            {group.meta?.days && group.meta.days.length > 0 && (
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalendarDays className="ap-w-4 ap-h-4 ap-text-green-500" />
                                    <span className="ap-truncate">{formatDays(group.meta.days)}</span>
                                </div>
                            )}
                            {group.meta?.group_time && (
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-orange-500" />
                                    <span>{group.meta.group_time}</span>
                                </div>
                            )}
                            {group.meta?.year && (
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalendar className="ap-w-4 ap-h-4 ap-text-teal-500" />
                                    <span>{group.meta.year}</span>
                                </div>
                            )}
                            {group.lm_camp?.length > 0 && (
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-text-blue-500" />
                                    <span className="ap-truncate">{getCampName(group.lm_camp)}</span>
                                </div>
                            )}
                            {group.lm_animal?.length > 0 && (
                                <div className="ap-text-xs ap-text-gray-500">
                                    🐾 {getAnimalName(group.lm_animal)}
                                </div>
                            )}
                        </div>

                        {group.meta?.swimmers && group.meta.swimmers.length > 0 && (
                            <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-200">
                                <div className="ap-flex ap-items-center ap-gap-2 ap-mb-2">
                                    <HiOutlineUsers className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                    <span className="ap-text-xs ap-font-medium ap-text-gray-500">
                                        {group.meta.swimmers.length} swimmer{group.meta.swimmers.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                {/* Swimmers grouped by instructor */}
                                <div className="ap-space-y-2">
                                    {getGroupSwimmersByInstructor(group).map(({ instructorName, swimmers: instSwimmers }) => (
                                        <div key={instructorName}>
                                            <div className="ap-text-xs ap-font-medium ap-text-purple-600 ap-mb-1 ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineUserCircle className="ap-w-3 ap-h-3" />
                                                {instructorName}
                                            </div>
                                            <div className="ap-flex ap-flex-wrap ap-gap-1 ap-pl-4">
                                                {instSwimmers.map((swimmer) => {
                                                    const age = calculateAge(swimmer.meta?.date_of_birth);
                                                    const levelObj = swimmer.meta?.current_level ? levels.find(l => l.id === Number(swimmer.meta.current_level)) : null;
                                                    const levelName = levelObj?.title?.rendered || levelObj?.name || '';
                                                    const extras = [age !== null ? String(age) : '', levelName].filter(Boolean);
                                                    return (
                                                        <span
                                                            key={swimmer.id}
                                                            className="ap-inline-block ap-px-2 ap-py-0.5 ap-text-xs ap-bg-blue-50 ap-text-blue-600 ap-rounded-full"
                                                        >
                                                            {swimmer.title?.rendered || 'Unknown'}
                                                            {extras.length > 0 && (
                                                                <span className="ap-text-blue-400"> · {extras.join(' · ')}</span>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Group Notes */}
                        {group.meta?.notes && (
                            <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-200">
                                <div className="ap-text-xs ap-font-medium ap-text-gray-500 ap-mb-1 ap-flex ap-items-center ap-gap-1">
                                    <HiOutlineDocumentText className="ap-w-3 ap-h-3" />
                                    Notes
                                </div>
                                <div className="ap-text-sm ap-text-gray-700 ap-whitespace-pre-wrap ap-bg-yellow-50 ap-p-2 ap-rounded ap-border ap-border-yellow-100 ap-italic">
                                    {group.meta.notes}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-200 ap-flex ap-items-center ap-justify-end ap-gap-1">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleToggleArchive(group)}
                                className="!ap-p-2 ap-text-gray-500 hover:ap-bg-gray-200"
                                title={group.meta?.archived ? 'Unarchive' : 'Archive'}
                            >
                                <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />
                            </Button>
                            {canEdit && (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleEdit(group)}
                                    className="!ap-p-2 ap-text-blue-600 hover:ap-bg-blue-50"
                                    title="Edit group"
                                >
                                    <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                </Button>
                            )}
                            {canDelete && (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setDeleteConfirm(group)}
                                    className="!ap-p-2 ap-text-red-600 hover:ap-bg-red-50"
                                    title="Delete group"
                                >
                                    <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="ap-flex ap-justify-center ap-py-8">
                    <LoadingSpinner />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredGroups.length === 0 && !error && (
                <div className="ap-text-center ap-py-12">
                    <HiOutlineUserGroup className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No groups found</h3>
                    <p className="ap-text-gray-500 ap-mb-4">
                        {searchTerm || activeFilterCount > 0 
                            ? 'Try adjusting your search or filters' : 'Get started by creating a new group'}
                    </p>
                    {activeFilterCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="!ap-inline-flex ap-items-center ap-gap-2 ap-text-blue-600 ap-border-blue-500 hover:ap-bg-blue-50 ap-mb-3"
                        >
                            <HiOutlineXCircle className="ap-w-5 ap-h-5" />
                            Clear Filters
                        </Button>
                    )}
                    {canCreate && !searchTerm && activeFilterCount === 0 && (
                        <Button
                            variant="lesson-groups"
                            onClick={handleAddNew}
                            className="!ap-inline-flex ap-items-center ap-gap-2"
                        >
                            <HiOutlinePlus className="ap-w-5 ap-h-5" />
                            Create Your First Group
                        </Button>
                    )}
                </div>
            )}

            {/* Load more button */}
            {!isLoading && groups.page < groups.totalPages && groups.items.length > 0 && (
                <div className="ap-flex ap-justify-center ap-mt-6">
                    <Button
                        variant="ghost"
                        onClick={() => loadGroups()}
                        className="ap-text-blue-600 ap-font-medium hover:ap-bg-blue-50"
                    >
                        Load More
                    </Button>
                </div>
            )}

            {/* Slide-over Panel */}
            {isSlideOverOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-hidden">
                    {/* Backdrop - hidden on mobile */}
                    <div 
                        className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                        onClick={handleCloseSlideOver}
                    />
                    
                    {/* Panel - full screen on mobile, slide-over on desktop */}
                    <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                        <div className="ap-w-full md:ap-w-screen md:ap-max-w-[60vw] ap-transform ap-transition-transform ap-duration-300 ap-flex ap-flex-col ap-h-full md:ap-h-auto md:ap-max-h-screen">
                            <div className="ap-flex ap-flex-col ap-bg-white ap-shadow-xl ap-h-full md:ap-h-auto md:ap-max-h-screen md:ap-my-4 md:ap-mr-4 md:ap-rounded-xl ap-overflow-hidden">
                                {/* Header */}
                                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseSlideOver}
                                        className="md:ap-hidden !ap-p-1.5 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                                    >
                                        <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <h2 className="ap-text-lg md:ap-text-xl ap-font-semibold ap-text-white ap-flex-1">
                                        {editingGroup ? 'Edit Group' : 'Add New Group'}
                                    </h2>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseSlideOver}
                                        className="ap-hidden md:ap-block !ap-p-2 ap-text-white/80 hover:ap-text-white"
                                    >
                                        <HiOutlineXMark className="ap-w-6 ap-h-6" />
                                    </Button>
                                </div>

                                {/* Form - scrollable */}
                                <div className="ap-flex-1 ap-overflow-y-auto ap-p-4 md:ap-p-6 ap-space-y-5 md:ap-space-y-6">
                                    {isFormDataLoading && (
                                        <div className="ap-bg-blue-50 ap-text-blue-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                            <svg className="ap-animate-spin ap-w-4 ap-h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading form options...
                                        </div>
                                    )}
                                    {formError && (
                                        <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                            <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                            {formError}
                                        </div>
                                    )}

                                    {/* Group Name */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Group Name <span className="ap-text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => handleFieldChange('title', e.target.value)}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                            placeholder="Enter group name"
                                        />
                                    </div>

                                    {/* Time and Year */}
                                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Time
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.group_time}
                                                onChange={(e) => handleFieldChange('group_time', e.target.value)}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                                placeholder="e.g., 9:00 AM - 10:00 AM"
                                            />
                                        </div>

                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Year
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.year}
                                                onChange={(e) => handleFieldChange('year', e.target.value ? parseInt(e.target.value) : '')}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                                placeholder={String(new Date().getFullYear())}
                                                min={2000}
                                                max={2100}
                                            />
                                        </div>
                                    </div>

                                    {/* Camp, Animal, Lesson Type (Taxonomies) */}
                                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-4">
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Camp
                                            </label>
                                            <select
                                                value={formData.lm_camp[0] || ''}
                                                onChange={(e) => handleFieldChange('lm_camp', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                                disabled={isFormDataLoading}
                                            >
                                                <option value="">{isFormDataLoading ? 'Loading...' : 'Select camp...'}</option>
                                                {camps.map(camp => (
                                                    <option key={camp.id} value={camp.id}>
                                                        {camp.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Animal Group
                                            </label>
                                            <select
                                                value={formData.lm_animal[0] || ''}
                                                onChange={(e) => handleFieldChange('lm_animal', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                                disabled={isFormDataLoading}
                                            >
                                                <option value="">{isFormDataLoading ? 'Loading...' : 'Select animal...'}</option>
                                                {animals.map(animal => (
                                                    <option key={animal.id} value={animal.id}>
                                                        {animal.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Lesson Type
                                            </label>
                                            <select
                                                value={formData.lm_lesson_type[0] || ''}
                                                onChange={(e) => handleFieldChange('lm_lesson_type', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                                disabled={isFormDataLoading}
                                            >
                                                <option value="">{isFormDataLoading ? 'Loading...' : 'Select type...'}</option>
                                                {lessonTypes.map(lt => (
                                                    <option key={lt.id} value={lt.id}>
                                                        {lt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Level */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Level
                                        </label>
                                        <select
                                            value={formData.level}
                                            onChange={(e) => handleFieldChange('level', e.target.value ? parseInt(e.target.value) : '')}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        >
                                            <option value="">Select a level...</option>
                                            {levels.map(level => (
                                                <option key={level.id} value={level.id}>
                                                    {decodeHTMLEntities(level.title?.rendered)}
                                                </option>
                                            ))}
                                            <option disabled>────────────────</option>
                                            <option value={-1}>Mixed Levels</option>
                                            <option value={-2}>Testing</option>
                                        </select>
                                    </div>

                                    {/* Days */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Days
                                        </label>
                                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                                            {DAYS_OF_WEEK.map(day => {
                                                const isSelected = formData.days.includes(day);
                                                return (
                                                    <Button
                                                        key={day}
                                                        type="button"
                                                        variant="unstyled"
                                                        size="xs"
                                                        onClick={() => toggleDay(day)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            fontSize: '0.875rem',
                                                            borderRadius: '9999px',
                                                            transition: 'all 150ms',
                                                            cursor: 'pointer',
                                                            border: isSelected ? '1px solid #2563eb' : '1px solid #e5e7eb',
                                                            backgroundColor: isSelected ? '#2563eb' : '#f3f4f6',
                                                            color: isSelected ? '#ffffff' : '#374151',
                                                        }}
                                                    >
                                                        {day.slice(0, 3)}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Instructors - Multi-select with search */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Instructors ({formData.instructor.length} selected)
                                        </label>
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                            {/* Search input */}
                                            <div className="ap-p-2 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <div className="ap-relative">
                                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={instructorSearch}
                                                        onChange={(e) => setInstructorSearch(e.target.value)}
                                                        placeholder={isFormDataLoading ? "Loading instructors..." : "Search instructors..."}
                                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm ap-rounded ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                                        disabled={isFormDataLoading}
                                                    />
                                                </div>
                                            </div>
                                            {/* Instructor list */}
                                            <div className="ap-max-h-64 ap-overflow-y-auto">
                                                {isFormDataLoading ? (
                                                    <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center ap-flex ap-items-center ap-justify-center ap-gap-2">
                                                        <svg className="ap-animate-spin ap-w-4 ap-h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Loading instructors...
                                                    </div>
                                                ) : filteredInstructors.length === 0 ? (
                                                    <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                                                        No instructors found
                                                    </div>
                                                ) : (
                                                    filteredInstructors.map(instructor => (
                                                        <label
                                                            key={instructor.id}
                                                            className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2.5 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                                                formData.instructor.includes(instructor.id) ? 'ap-bg-blue-50' : ''
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.instructor.includes(instructor.id)}
                                                                onChange={() => toggleInstructor(instructor.id)}
                                                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                                                            />
                                                            <span className="ap-text-sm ap-text-gray-700 ap-flex-1">
                                                                {instructor.name}
                                                            </span>
                                                            {formData.instructor.includes(instructor.id) && (
                                                                <HiOutlineCheck className="ap-w-4 ap-h-4 ap-text-blue-600" />
                                                            )}
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Swimmers - Multi-select with search */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Swimmers ({formData.swimmers.length} selected)
                                        </label>
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                            {/* Search input */}
                                            <div className="ap-p-2 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <div className="ap-relative">
                                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={swimmerSearch}
                                                        onChange={(e) => setSwimmerSearch(e.target.value)}
                                                        placeholder="Search swimmers..."
                                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm ap-rounded ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                                    />
                                                    {isSearching && (
                                                        <div className="ap-absolute ap-right-3 ap-top-1/2 -ap-translate-y-1/2">
                                                            <div className="ap-w-4 ap-h-4 ap-border-2 ap-border-blue-500 ap-border-t-transparent ap-rounded-full ap-animate-spin" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Swimmer list */}
                                            <div className="ap-max-h-[48rem] ap-overflow-y-auto">
                                                {filteredSwimmers.length === 0 && !isSearching ? (
                                                    <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                                                        {swimmerSearch ? 'No swimmers found' : 'Type ap-to search swimmers...'}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {filteredSwimmers.map(swimmer => {
                                                            const swimmerLevel = levels.find(l => l.id === swimmer.meta?.current_level);
                                                            return (
                                                                <label
                                                                    key={swimmer.id}
                                                                    className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2.5 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                                                        formData.swimmers.includes(swimmer.id) ? 'ap-bg-green-50' : ''
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={formData.swimmers.includes(swimmer.id)}
                                                                        onChange={() => toggleSwimmer(swimmer.id)}
                                                                        className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-green-600 focus:ap-ring-green-500"
                                                                    />
                                                                    <div className="ap-flex-1 ap-min-w-0">
                                                                        <span className="ap-text-sm ap-text-gray-700 ap-block ap-truncate">
                                                                            {decodeHTMLEntities(swimmer.title?.rendered)}
                                                                        </span>
                                                                        {swimmerLevel && (
                                                                            <span className="ap-text-xs ap-text-gray-500">
                                                                                {decodeHTMLEntities(swimmerLevel.title?.rendered)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {formData.swimmers.includes(swimmer.id) && (
                                                                        <HiOutlineCheck className="ap-w-4 ap-h-4 ap-text-green-600 ap-flex-shrink-0" />
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                        {/* Load more button */}
                                                        {hasMoreSearchResults && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={loadMoreSwimmers}
                                                                disabled={isSearching}
                                                                className="!ap-w-full ap-text-sm ap-text-blue-600 hover:ap-bg-blue-50 ap-font-medium"
                                                            >
                                                                {isSearching ? 'Loading...' : 'Load more swimmers'}
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selected Swimmers Table with Drag & Drop */}
                                    {formData.swimmers.length > 0 && (
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                                Selected Swimmers by Instructor
                                                <span className="ap-ml-2 ap-text-xs ap-text-gray-400 ap-font-normal">
                                                    (drag swimmers between instructors)
                                                </span>
                                            </label>
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragStart={handleDragStart}
                                                onDragOver={handleDragOver}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                                    {instructorGroups.map((group) => (
                                                        <DroppableInstructor
                                                            key={group.id}
                                                            instructorId={group.id}
                                                            instructorName={group.name}
                                                            swimmers={group.swimmers}
                                                            levels={levels}
                                                            onEditSwimmer={(id) => setEditingSwimmerId(id)}
                                                            onCreateEvaluation={(id) => {
                                                                // Open swimmer edit first, then evaluation form
                                                                setEditingSwimmerId(id);
                                                                setEvaluationSwimmerId(id);
                                                                setShowEvaluationForm(true);
                                                            }}
                                                            onRemoveSwimmer={toggleSwimmer}
                                                            isOver={overInstructorId === group.id}
                                                        />
                                                    ))}
                                                </div>
                                                {createPortal(
                                                    <DragOverlay
                                                        dropAnimation={{
                                                            duration: 250,
                                                            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                                                        }}
                                                    >
                                                        {activeSwimmerId && (() => {
                                                            const activeSwimmer = formSwimmers.find(s => s.id === activeSwimmerId);
                                                            const swimmerLevel = levels.find(l => l.id === activeSwimmer?.meta?.current_level);
                                                            const age = calculateAge(activeSwimmer?.meta?.date_of_birth);
                                                            // Use inline styles since Tailwind doesn't work in portal
                                                            return (
                                                                <div style={{
                                                                    backgroundColor: 'white',
                                                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                                                    borderRadius: '12px',
                                                                    border: '2px solid #0891b2',
                                                                    outline: '4px solid rgba(8, 145, 178, 0.3)',
                                                                    transform: 'rotate(2deg) scale(1.05)',
                                                                    pointerEvents: 'none',
                                                                    minWidth: '300px',
                                                                    fontFamily: 'system-ui, -apple-system, sans-serif',
                                                                }}>
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: '12px 16px',
                                                                        backgroundColor: 'rgba(8, 145, 178, 0.1)',
                                                                        gap: '12px',
                                                                    }}>
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: '2px',
                                                                            color: '#0891b2',
                                                                        }}>
                                                                            <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                            <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                            <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                        </div>
                                                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                                                                            {decodeHTMLEntities(activeSwimmer?.title?.rendered) || 'Swimmer'}
                                                                        </span>
                                                                        <span style={{ fontSize: '14px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                                                                            {age !== null ? `Age ${age}` : ''}
                                                                        </span>
                                                                        <span style={{ fontSize: '14px', color: '#4b5563' }}>
                                                                            {decodeHTMLEntities(swimmerLevel?.title?.rendered) || ''}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </DragOverlay>,
                                                    document.body
                                                )}
                                            </DndContext>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Notes
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                                            rows={3}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors ap-resize-none"
                                            placeholder="Any additional notes about this group..."
                                        />
                                    </div>

                                    {/* Specific Dates Offered */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Specific Dates ({formData.dates_offered.length} dates)
                                        </label>
                                        <div className="ap-flex ap-gap-2 ap-mb-2">
                                            <input
                                                type="date"
                                                id="new-date-input"
                                                className="ap-flex-1 ap-px-4 ap-py-2 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors ap-text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.getElementById('new-date-input') as HTMLInputElement;
                                                    if (input?.value) {
                                                        addDateOffered(input.value);
                                                        input.value = '';
                                                    }
                                                }}
                                            >
                                                Add Date
                                            </Button>
                                        </div>
                                        {formData.dates_offered.length > 0 && (
                                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                                {formData.dates_offered.map(date => (
                                                    <span
                                                        key={date}
                                                        className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-blue-50 ap-text-blue-700 ap-rounded-full ap-text-xs"
                                                    >
                                                        {new Date(date).toLocaleDateString()}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={() => removeDateOffered(date)}
                                                            className="!ap-p-0 hover:ap-text-blue-900"
                                                        >
                                                            <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                        </Button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Archive toggle */}
                                    {editingGroup && (
                                        <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600 ap-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.archived}
                                                onChange={(e) => handleFieldChange('archived', e.target.checked)}
                                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-gray-500 focus:ap-ring-gray-500"
                                            />
                                            Archive this group
                                        </label>
                                    )}
                                </div>

                                {/* Footer - Sticky */}
                                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-justify-end ap-gap-3 ap-px-4 md:ap-px-6 ap-py-3 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                    <Button
                                        variant="secondary"
                                        onClick={handleCloseSlideOver}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="lesson-groups"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 hover:ap-shadow-lg !ap-flex ap-items-center ap-gap-2"
                                    >
                                        {isSaving ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>{editingGroup ? 'Save Changes' : 'Create Group'}</span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-y-auto">
                    <div className="ap-flex ap-min-h-full ap-items-center ap-justify-center ap-p-4">
                        {/* Backdrop */}
                        <div 
                            className="ap-fixed ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                            onClick={() => setDeleteConfirm(null)}
                        />
                        
                        {/* Modal */}
                        <div className="ap-relative ap-bg-white ap-rounded-2xl ap-shadow-xl ap-w-full ap-max-w-md">
                            <div className="ap-p-6">
                                <div className="ap-flex ap-items-center ap-gap-4">
                                    <div className="ap-flex-shrink-0 ap-w-12 ap-h-12 ap-rounded-full ap-bg-red-100 ap-flex ap-items-center ap-justify-center">
                                        <HiOutlineExclamationTriangle className="ap-w-6 ap-h-6 ap-text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Delete Group</h3>
                                        <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                                            Are you sure you want to delete <strong>{deleteConfirm.title?.rendered}</strong>? 
                                            This action cannot be undone.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-p-6 ap-border-t ap-border-gray-200 ap-bg-gray-50 ap-rounded-b-2xl">
                                <Button
                                    variant="secondary"
                                    onClick={() => setDeleteConfirm(null)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="lesson-groups"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="!ap-bg-red-600 hover:!ap-bg-red-700 !ap-flex ap-items-center ap-gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <LoadingSpinner />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <span>Delete</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Nested Swimmer Editor Slide-Over */}
            {editingSwimmerId && (
                <NestedSwimmerEditor
                    apiUrl={apiUrl}
                    nonce={nonce}
                    swimmerId={editingSwimmerId}
                    onClose={() => {
                        setEditingSwimmerId(null);
                        setShowEvaluationForm(false);
                        setEvaluationSwimmerId(null);
                    }}
                    showEvaluationForm={showEvaluationForm && evaluationSwimmerId === editingSwimmerId}
                    onSwimmerUpdated={(updatedSwimmer) => {
                        // Update swimmer in formSwimmers list (for form display)
                        setFormSwimmers(prev => 
                            prev.map(s => s.id === updatedSwimmer.id ? updatedSwimmer : s)
                        );
                        // Also update swimmerMap for card display
                        setSwimmerMap(prev => {
                            const newMap = new Map(prev);
                            newMap.set(updatedSwimmer.id, updatedSwimmer);
                            return newMap;
                        });
                    }}
                    onEvaluationCreated={() => {
                        setShowEvaluationForm(false);
                        setEvaluationSwimmerId(null);
                    }}
                />
            )}
        </div>
    );
};

export default GroupManager;
