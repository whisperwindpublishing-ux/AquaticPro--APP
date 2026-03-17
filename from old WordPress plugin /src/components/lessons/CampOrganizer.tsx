import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove as _arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    horizontalListSortingStrategy as _horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    HiOutlineUserGroup,
    HiOutlineLockClosed,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineBars3,
    HiOutlineExclamationTriangle,
    HiOutlinePencil,
    HiOutlineDocumentPlus,
    HiOutlineXMark,
    HiOutlineUserCircle,
    HiOutlineArrowLeft,
    HiOutlineMagnifyingGlass,
    HiOutlineAcademicCap,
    HiOutlineCalendarDays as _HiOutlineCalendarDays,
    HiOutlineClock as _HiOutlineClock,
    HiOutlineCheck,
    HiOutlineArrowsUpDown,
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import NestedSwimmerEditor from './NestedSwimmerEditor';
import { Button } from '../ui';
import { Camp, Animal, Level, Swimmer, Group, LessonType } from '../../types/lessons';
import { getCachedSimpleUsers } from '@/services/userCache';
import { getCachedSwimmers } from '@/services/swimmerCache';

interface CampOrganizerProps {
    apiUrl: string;
    nonce: string;
}

interface GroupData {
    id: number;
    name: string;
    level: string;
    instructors: number[];
    swimmers: number[];
    swimmer_grouping?: Record<string, number[]>;
}

interface AnimalGroupData {
    name: string;
    groups: GroupData[];
}

interface CampData {
    [animalId: string]: AnimalGroupData;
}

interface PersonInfo {
    id: number;
    name: string;
    title?: { rendered: string };
    display_name?: string;
    meta?: {
        date_of_birth?: string;
        notes?: string;
        current_level?: number;
    };
}

interface SaveUpdate {
    group_id: number;
    instructors: number[];
    swimmers: number[];
    swimmer_grouping?: Record<string, number[]>;
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

// Helper to calculate age
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

// Helper to decode HTML entities
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

// Sort swimmers/persons alphabetically by name
const sortPersonsAlphabetically = <T extends { title?: { rendered: string }; name?: string }>(persons: T[]): T[] => {
    return [...persons].sort((a, b) => {
        const nameA = decodeHTMLEntities(a.title?.rendered || a.name || '');
        const nameB = decodeHTMLEntities(b.title?.rendered || b.name || '');
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
};

// Helper to get luminance of a color for contrast calculation
const getLuminance = (hex: string): number => {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    
    // Calculate relative luminance
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

// Sortable Swimmer Row (matches GroupManager's implementation)
const SortableSwimmerRow: React.FC<{
    swimmer: PersonInfo;
    swimmerLevel?: Level;
    groupId: number;
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    isEven: boolean;
}> = ({ swimmer, swimmerLevel, groupId, onEditSwimmer, onCreateEvaluation, isEven }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `swimmer-${groupId}-${swimmer.id}` });

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
                        {decodeHTMLEntities(swimmer.title?.rendered || swimmer.name)}
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
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-bg-blue-100 ap-touch-auto"
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
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-green-600 hover:ap-bg-green-100 ap-touch-auto"
                                title="Create evaluation"
                            >
                                <HiOutlineDocumentPlus className="ap-w-4 ap-h-4" />
                            </Button>
                        )}
                    </div>
                </td>
            </tr>
            {hasNotes && (
                <tr className={`${isEven ? 'ap-bg-white' : 'ap-bg-gray-50'} ap-border-t-0`}>
                    <td className="ap-px-2 ap-py-1"></td>
                    <td colSpan={4} className="ap-px-3 ap-py-1 ap-pb-2">
                        <span className="ap-text-xs ap-text-amber-700 ap-bg-amber-50 ap-px-2 ap-py-0.5 ap-rounded">
                            Notes: {swimmer.meta?.notes}
                        </span>
                    </td>
                </tr>
            )}
        </>
    );
};

// Droppable Instructor Container (matches GroupManager pattern)
interface DroppableInstructorProps {
    instructorId: string;
    instructorName: string;
    swimmers: PersonInfo[];
    levels: Level[];
    groupId: number;
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    isOver?: boolean;
    isLocked?: boolean;
    hasEditPermission?: boolean;
}

const DroppableInstructor: React.FC<DroppableInstructorProps> = ({
    instructorId,
    instructorName,
    swimmers,
    levels,
    groupId,
    onEditSwimmer,
    onCreateEvaluation,
    isOver,
    isLocked,
    hasEditPermission
}) => {
    const { setNodeRef } = useDroppable({ id: instructorId });
    
    // Check if this is the unassigned section
    const isUnassigned = instructorName === 'Unassigned';
    
    // Make instructor header draggable (only for real instructors, not "Unassigned")
    const {
        attributes,
        listeners,
        setNodeRef: setDragNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: instructorId,
        disabled: isUnassigned || isLocked || !hasEditPermission
    });
    
    const dragStyle: React.CSSProperties = !isUnassigned ? {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms ease',
        opacity: isDragging ? 0.5 : 1,
    } : {};

    return (
        <div 
            ref={setNodeRef}
            className={`ap-border-b ap-border-gray-200 last:ap-border-b-0 ap-transition-colors ${isOver ? 'ap-bg-blue-50' : ''}`}
        >
            <div 
                ref={!isUnassigned ? setDragNodeRef : undefined}
                style={dragStyle}
                {...(!isUnassigned ? attributes : {})}
                {...(!isUnassigned ? listeners : {})}
                className={`ap-px-3 ap-py-2 ap-text-sm ap-font-medium ap-flex ap-items-center ap-gap-2 ${
                    instructorName === 'Unassigned' ? 'ap-bg-amber-50 ap-text-gray-700' : 'ap-bg-indigo-600 ap-text-white'
                } ${!isUnassigned && !isLocked && hasEditPermission ? 'ap-cursor-grab active:ap-cursor-grabbing ap-touch-manipulation' : ''}`}
            >
                {!isUnassigned && !isLocked && hasEditPermission && (
                    <HiOutlineBars3 className="ap-w-4 ap-h-4 ap-text-indigo-200 ap-flex-shrink-0" />
                )}
                <HiOutlineUserCircle className={`ap-w-4 ap-h-4 ap-flex-shrink-0 ${instructorName === 'Unassigned' ? 'ap-text-amber-500' : 'ap-text-indigo-200'}`} />
                {instructorName}
                <span className={`ap-font-normal ${instructorName === 'Unassigned' ? 'ap-text-gray-400' : 'ap-text-indigo-200'}`}>({swimmers.length})</span>
            </div>
            <SortableContext
                items={swimmers.map(s => `swimmer-${groupId}-${s.id}`)}
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
                                        key={`${groupId}-${swimmer.id}`}
                                        swimmer={swimmer}
                                        swimmerLevel={swimmerLevel}
                                        groupId={groupId}
                                        onEditSwimmer={onEditSwimmer}
                                        onCreateEvaluation={onCreateEvaluation}
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

// Form Sortable Swimmer Row (for group edit form, includes remove button)
interface FormSortableSwimmerRowProps {
    swimmer: Swimmer;
    swimmerLevel?: Level;
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    onRemoveSwimmer: (id: number) => void;
    isEven: boolean;
}

const FormSortableSwimmerRow: React.FC<FormSortableSwimmerRowProps> = ({
    swimmer,
    swimmerLevel,
    onEditSwimmer,
    onCreateEvaluation,
    onRemoveSwimmer,
    isEven
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `form-swimmer-${swimmer.id}`,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'manipulation',
        cursor: 'grab',
    };

    const age = calculateAge(swimmer.meta?.date_of_birth);
    const hasNotes = swimmer.meta?.notes && swimmer.meta.notes.trim() !== '';
    const swimmerName = decodeHTMLEntities(swimmer.title?.rendered) || `Swimmer #${swimmer.id}`;

    return (
        <>
            <tr
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`${isEven ? 'ap-bg-white' : 'ap-bg-gray-50'} hover:ap-bg-blue-50 ap-transition-colors ${isDragging ? 'ap-shadow-lg ap-z-10' : ''} ap-cursor-grab active:ap-cursor-grabbing`}
            >
                <td className="ap-pl-2 ap-pr-1 ap-py-2 ap-w-8">
                    <HiOutlineArrowsUpDown className="ap-w-4 ap-h-4 ap-text-gray-400" />
                </td>
                <td className="ap-px-2 ap-py-2 ap-text-sm ap-font-medium ap-text-gray-900">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <span>{swimmerName}</span>
                    </div>
                </td>
                <td className="ap-px-2 ap-py-2 ap-text-sm ap-text-gray-600">{age || '-'}</td>
                <td className="ap-px-2 ap-py-2">
                    {swimmerLevel && (
                        <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-font-medium"
                            style={{
                                backgroundColor: swimmerLevel.color || '#e5e7eb',
                                color: getLuminance(swimmerLevel.color || '#e5e7eb') > 0.5 ? '#1f2937' : '#ffffff'
                            }}>
                            {swimmerLevel.name}
                        </span>
                    )}
                </td>
                <td className="ap-px-2 ap-py-2 ap-text-right">
                    <div className="ap-flex ap-items-center ap-justify-end ap-gap-1 ap-touch-auto">
                        {onEditSwimmer && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditSwimmer(swimmer.id);
                                }}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-blue-600 hover:ap-bg-blue-100 ap-touch-auto"
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
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-green-600 hover:ap-bg-green-100 ap-touch-auto"
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
                                onRemoveSwimmer(swimmer.id);
                            }}
                            className="!ap-p-1.5 !ap-min-h-0 ap-text-red-600 hover:ap-bg-red-100 ap-touch-auto"
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
                            Notes: {swimmer.meta?.notes}
                        </span>
                    </td>
                </tr>
            )}
        </>
    );
};

// Form Droppable Instructor Container (for group edit form)
interface FormDroppableInstructorProps {
    instructorId: string;
    instructorName: string;
    swimmers: Swimmer[];
    levels: Level[];
    onEditSwimmer?: (id: number) => void;
    onCreateEvaluation?: (id: number) => void;
    onRemoveSwimmer: (id: number) => void;
    isOver?: boolean;
}

const FormDroppableInstructor: React.FC<FormDroppableInstructorProps> = ({
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
                items={swimmers.map(s => `form-swimmer-${s.id}`)}
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
                                    <FormSortableSwimmerRow
                                        key={swimmer.id}
                                        swimmer={swimmer}
                                        swimmerLevel={swimmerLevel}
                                        onEditSwimmer={onEditSwimmer}
                                        onCreateEvaluation={onCreateEvaluation}
                                        onRemoveSwimmer={onRemoveSwimmer}
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

const CampOrganizer: React.FC<CampOrganizerProps> = ({ apiUrl, nonce }) => {
    const [camps, setCamps] = useState<Camp[]>([]);
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [levels, setLevels] = useState<Level[]>([]);
    const [selectedCamp, setSelectedCamp] = useState<string>('');
    const [campData, setCampData] = useState<CampData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [collapsedAnimals, setCollapsedAnimals] = useState<Record<string, boolean>>({});
    const [personCache, setPersonCache] = useState<Map<number, PersonInfo>>(new Map());

    // Lock state
    const [isLocked, setIsLocked] = useState(false);
    const [lockedBy, setLockedBy] = useState('');
    const [hasEditPermission, setHasEditPermission] = useState(false);
    const [isCheckingPermission, setIsCheckingPermission] = useState(true);

    // Original data snapshot for change detection
    const [originalData, setOriginalData] = useState<CampData | null>(null);

    // Swimmer modal state
    const [editingSwimmerId, setEditingSwimmerId] = useState<number | null>(null);
    const [showEvaluationForm, setShowEvaluationForm] = useState(false);
    const [evaluationSwimmerId, setEvaluationSwimmerId] = useState<number | null>(null);
    
    // Group edit slide-over state
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [editingGroupData, setEditingGroupData] = useState<Group | null>(null);
    const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
    const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);
    const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
    
    // Group form state
    const [groupFormData, setGroupFormData] = useState<GroupFormData>(emptyFormData);
    const [isGroupFormSaving, setIsGroupFormSaving] = useState(false);
    const [groupFormError, setGroupFormError] = useState<string | null>(null);
    const [instructorSearch, setInstructorSearch] = useState('');
    const [swimmerSearch, setSwimmerSearch] = useState('');
    
    // Track which instructor we're hovering over in the DnD context
    const [overInstructorId, _setOverInstructorId] = useState<string | null>(null);
    
    // DnD state for group form
    const [formActiveSwimmerId, setFormActiveSwimmerId] = useState<number | null>(null);
    const [formOverInstructorId, setFormOverInstructorId] = useState<string | null>(null);

    // DnD Kit sensors - optimized for mobile with TouchSensor
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
    
    // Drag state for tracking
    const [activeSwimmerId, setActiveSwimmerId] = useState<number | null>(null);
    const [activeInstructorId, setActiveInstructorId] = useState<number | null>(null);
    const [_activeDragGroupId, setActiveDragGroupId] = useState<number | null>(null);
    const [_overGroupId, setOverGroupId] = useState<number | null>(null);

    const decodeEntities = (str: string) => {
        if (typeof str !== 'string') return str;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    };

    const getAnimalName = (animalId: string): string => {
        if (animalId === 'uncategorized') {
            return 'Uncategorized Groups';
        }
        const animal = animals.find(a => a.id === parseInt(animalId, 10));
        return decodeEntities(animal?.name || `Animal ${animalId}`);
    };

    const sortedAnimalIds = useMemo(() => {
        if (!campData) return [];
        return Object.keys(campData).sort((a, b) => {
            const nameA = getAnimalName(a);
            const nameB = getAnimalName(b);
            return nameA.localeCompare(nameB);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campData, animals]);

    // Load initial data (camps, animals, levels, swimmers, instructors, lesson types)
    useEffect(() => {
        const loadInitialData = async () => {
            // Visitor Mode Check
            if (window.mentorshipPlatformData?.visitor_mode) {
                setCamps([]);
                setAnimals([]);
                setLevels([]);
                setAllSwimmers([]);
                setInstructors([]);
                setLessonTypes([]);
                return;
            }

            try {
                const headers = { 'X-WP-Nonce': nonce };
                
                const [campsRes, animalsRes, levelsRes, lessonTypesRes] = await Promise.all([
                    fetch(`${apiUrl}wp/v2/lm_camp`, { headers }),
                    fetch(`${apiUrl}wp/v2/lm_animal`, { headers }),
                    fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, { headers }),
                    fetch(`${apiUrl}wp/v2/lm_lesson_type?per_page=100`, { headers }),
                ]);
                
                // Fetch all swimmers and users from centralized caches (10-15 min TTL)
                const [allSwimmersData, allUsersData] = await Promise.all([
                    getCachedSwimmers(), // Use centralized swimmer cache
                    getCachedSimpleUsers(), // Use centralized user cache
                ]);
                
                if (campsRes.ok) setCamps(await campsRes.json());
                if (animalsRes.ok) setAnimals(await animalsRes.json());
                if (levelsRes.ok) {
                    const levelsData = await levelsRes.json();
                    const sortedLevels = [...levelsData].sort((a: Level, b: Level) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setLevels(sortedLevels);
                }
                
                // Set swimmers (already fetched all pages)
                setAllSwimmers(allSwimmersData);
                
                // Set instructors from cached users (already in { id, name } format)
                setInstructors(allUsersData);
                
                if (lessonTypesRes.ok) setLessonTypes(await lessonTypesRes.json());
            } catch (error) {
                console.error('Error loading initial data:', error);
            }
        };
        loadInitialData();
        checkPermission();
    }, [apiUrl, nonce]);

    const checkPermission = async () => {
        setIsCheckingPermission(true);
        try {
            const response = await fetch(`${apiUrl}lm/v1/camp-organizer/check-permission`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            const data = await response.json();
            setHasEditPermission(data.has_permission ?? false);
        } catch (error) {
            console.error('Error checking permission:', error);
            setHasEditPermission(false);
        } finally {
            setIsCheckingPermission(false);
        }
    };

    const loadCampData = useCallback(async () => {
        if (!selectedCamp) return;
        
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setCampData({});
            setOriginalData({});
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(
                `${apiUrl}lm/v1/camp-organizer/load?camp_id=${selectedCamp}&include_archived=${includeArchived ? '1' : '0'}`,
                { headers: { 'X-WP-Nonce': nonce } }
            );
            
            const result = await response.json();
            
            setCampData(result.data);
            setOriginalData(JSON.parse(JSON.stringify(result.data)));
            setIsLocked(result.locked || false);
            setLockedBy(result.locked_by || '');

            // If not locked and has permission, try to acquire lock
            if (!result.locked && hasEditPermission) {
                await acquireLock();
            }

            // Load person details into cache
            const allInstructorIds = new Set<number>();
            const allSwimmerIds = new Set<number>();

            Object.values(result.data || {}).forEach((animalGroup: any) => {
                animalGroup.groups?.forEach((group: GroupData) => {
                    (group.instructors || []).forEach(id => allInstructorIds.add(id));
                    (group.swimmers || []).forEach(id => allSwimmerIds.add(id));
                });
            });

            // Fetch instructor and swimmer details in parallel
            // Use a ref-like approach to collect all person data, then do a single state update
            const personUpdates = new Map<number, PersonInfo>();

            // Fetch instructor details (WordPress users)
            if (allInstructorIds.size > 0) {
                const usersRes = await fetch(
                    `${apiUrl}wp/v2/users?include=${Array.from(allInstructorIds).join(',')}&per_page=100`,
                    { headers: { 'X-WP-Nonce': nonce } }
                );
                if (usersRes.ok) {
                    const users = await usersRes.json();
                    users.forEach((user: any) => {
                        personUpdates.set(user.id, {
                            id: user.id,
                            name: user.name || user.display_name,
                            display_name: user.name || user.display_name,
                        });
                    });
                }
            }

            // Fetch swimmer details
            if (allSwimmerIds.size > 0) {
                const swimmersRes = await fetch(
                    `${apiUrl}wp/v2/lm-swimmer?include=${Array.from(allSwimmerIds).join(',')}&per_page=100`,
                    { headers: { 'X-WP-Nonce': nonce } }
                );
                if (swimmersRes.ok) {
                    const swimmers = await swimmersRes.json();
                    swimmers.forEach((swimmer: any) => {
                        personUpdates.set(swimmer.id, {
                            id: swimmer.id,
                            name: swimmer.title?.rendered || `Swimmer #${swimmer.id}`,
                            title: swimmer.title,
                            meta: swimmer.meta,
                        });
                    });
                }
            }

            // Single state update with all person data
            if (personUpdates.size > 0) {
                setPersonCache(prev => {
                    const newCache = new Map(prev);
                    personUpdates.forEach((value, key) => newCache.set(key, value));
                    return newCache;
                });
            }

        } catch (error) {
            console.error('Error loading camp data:', error);
            alert('Failed to load camp data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCamp, includeArchived, hasEditPermission, apiUrl, nonce]);

    const acquireLock = async () => {
        try {
            await fetch(`${apiUrl}lm/v1/camp-organizer/acquire-lock`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ camp_id: selectedCamp }),
            });
            setIsLocked(false);
            setLockedBy('');
        } catch (error) {
            console.error('Error acquiring lock:', error);
        }
    };

    const releaseLock = useCallback(async () => {
        if (selectedCamp && !isLocked) {
            try {
                await fetch(`${apiUrl}lm/v1/camp-organizer/release-lock`, {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': nonce,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ camp_id: selectedCamp }),
                });
            } catch (error) {
                console.error('Error releasing lock:', error);
            }
        }
    }, [selectedCamp, isLocked, apiUrl, nonce]);

    const checkLockStatus = useCallback(async () => {
        if (!selectedCamp) return;

        try {
            const response = await fetch(
                `${apiUrl}lm/v1/camp-organizer/check-lock?camp_id=${selectedCamp}`,
                { headers: { 'X-WP-Nonce': nonce } }
            );
            const data = await response.json();

            if (data.locked && !isLocked) {
                setIsLocked(true);
                setLockedBy(data.locked_by || 'another user');
                alert(`${data.locked_by || 'Another user'} has taken control of this camp. Your changes cannot be saved.`);
            }
        } catch (error) {
            console.error('Error checking lock status:', error);
        }
    }, [selectedCamp, isLocked, apiUrl, nonce]);

    // Load camp data when selection changes
    useEffect(() => {
        if (selectedCamp) {
            loadCampData();
        } else {
            setCampData(null);
            releaseLock();
        }
    }, [selectedCamp, includeArchived]);

    // Set up lock monitoring
    useEffect(() => {
        if (campData && selectedCamp) {
            const interval = setInterval(checkLockStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [campData, selectedCamp, checkLockStatus]);

    // Release lock on unmount
    useEffect(() => {
        return () => {
            releaseLock();
        };
    }, [releaseLock]);

    const handleToggleAnimal = useCallback((animalId: string) => {
        setCollapsedAnimals(prev => ({
            ...prev,
            [animalId]: !prev[animalId],
        }));
    }, []);

    const handleCollapseAll = useCallback(() => {
        if (!campData) return;
        const nextState: Record<string, boolean> = {};
        Object.keys(campData).forEach(animalId => {
            nextState[animalId] = true;
        });
        setCollapsedAnimals(nextState);
    }, [campData]);

    const handleExpandAll = useCallback(() => {
        setCollapsedAnimals({});
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const activeId = String(active.id);
        
        // Parse instructor drag
        if (activeId.startsWith('instructor-')) {
            const parts = activeId.split('-');
            const groupId = parseInt(parts[1]);
            const instructorId = parseInt(parts[2]);
            setActiveInstructorId(instructorId);
            setActiveDragGroupId(groupId);
        }
        // Parse swimmer drag
        else if (activeId.startsWith('swimmer-')) {
            const parts = activeId.split('-');
            const groupId = parseInt(parts[1]);
            const swimmerId = parseInt(parts[2]);
            setActiveSwimmerId(swimmerId);
            setActiveDragGroupId(groupId);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (over) {
            const overId = String(over.id);
            // Track which group we're over
            if (overId.startsWith('group-')) {
                const parts = overId.split('-');
                const groupId = parseInt(parts[2]);
                setOverGroupId(groupId);
            }
        } else {
            setOverGroupId(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        // Reset drag state
        setActiveSwimmerId(null);
        setActiveInstructorId(null);
        setActiveDragGroupId(null);
        setOverGroupId(null);

        if (isLocked || !hasEditPermission || !over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        // Determine if we're dragging instructor or swimmer
        const isDraggingInstructor = activeId.startsWith('instructor-');
        const isDraggingSwimmer = activeId.startsWith('swimmer-');

        if (!isDraggingInstructor && !isDraggingSwimmer) return;

        // Parse active ID
        const activeParts = activeId.split('-');
        const sourceGroupId = parseInt(activeParts[1]);
        const personId = parseInt(activeParts[2]);

        // Determine destination group and target instructor
        let destGroupId: number | null = null;
        let targetInstructorId: number | null = null;
        let droppingToUnassigned = false;
        
        if (overId.startsWith('instructor-')) {
            // Dropping on an instructor section: instructor-{groupId}-{instructorId}
            const overParts = overId.split('-');
            destGroupId = parseInt(overParts[1]);
            targetInstructorId = parseInt(overParts[2]);
        } else if (overId.startsWith('swimmers-')) {
            // Dropping on unassigned section: swimmers-{groupId}
            const overParts = overId.split('-');
            destGroupId = parseInt(overParts[1]);
            droppingToUnassigned = true;
        } else if (overId.startsWith('swimmer-')) {
            // Dropping on another swimmer: swimmer-{groupId}-{swimmerId}
            const overParts = overId.split('-');
            destGroupId = parseInt(overParts[1]);
        } else if (overId.startsWith('group-instructors-') || overId.startsWith('group-swimmers-')) {
            const overParts = overId.split('-');
            destGroupId = parseInt(overParts[2]);
        }

        if (destGroupId === null) return;

        // Find source and destination groups in campData
        const newCampData = JSON.parse(JSON.stringify(campData)) as CampData;
        let sourceGroup: GroupData | null = null;
        let destGroup: GroupData | null = null;

        // Find groups
        for (const animalId of Object.keys(newCampData)) {
            for (const group of newCampData[animalId].groups) {
                if (group.id === sourceGroupId) {
                    sourceGroup = group;
                }
                if (group.id === destGroupId) {
                    destGroup = group;
                }
            }
        }

        if (!sourceGroup || !destGroup) return;

        // Initialize swimmer_grouping if needed
        if (!sourceGroup.swimmer_grouping) sourceGroup.swimmer_grouping = {};
        if (!destGroup.swimmer_grouping) destGroup.swimmer_grouping = {};

        if (isDraggingInstructor) {
            // Handle instructor drag
            const sourceIndex = sourceGroup.instructors.indexOf(personId);
            if (sourceIndex === -1) return;

            // Get swimmers assigned to this instructor before removing
            const assignedSwimmers = sourceGroup.swimmer_grouping[String(personId)] || [];

            // Remove instructor from source group
            sourceGroup.instructors.splice(sourceIndex, 1);
            
            // Remove swimmer assignments for this instructor in source group
            delete sourceGroup.swimmer_grouping[String(personId)];

            if (sourceGroupId === destGroupId) {
                // Reordering within same group - just reorder instructor, keep swimmer assignments
                if (overId.startsWith('instructor-')) {
                    const overPersonId = parseInt(activeParts[2]);
                    const overIndex = destGroup.instructors.indexOf(overPersonId);
                    destGroup.instructors.splice(overIndex >= 0 ? overIndex : destGroup.instructors.length, 0, personId);
                } else {
                    destGroup.instructors.push(personId);
                }
                // Restore swimmer assignments since we're in the same group
                if (assignedSwimmers.length > 0) {
                    destGroup.swimmer_grouping[String(personId)] = assignedSwimmers;
                }
            } else {
                // Moving to different group
                // Add instructor to destination group (avoid duplicates)
                destGroup.instructors = destGroup.instructors.filter(id => id !== personId);
                destGroup.instructors.push(personId);
                
                // Move assigned swimmers to destination group as well
                assignedSwimmers.forEach(swimmerId => {
                    // Remove swimmer from source group's swimmers array
                    const swimmerIndex = sourceGroup.swimmers.indexOf(swimmerId);
                    if (swimmerIndex !== -1) {
                        sourceGroup.swimmers.splice(swimmerIndex, 1);
                    }
                    
                    // Add swimmer to destination group if not already there
                    if (!destGroup.swimmers.includes(swimmerId)) {
                        destGroup.swimmers.push(swimmerId);
                    }
                    
                    // Swimmers go to unassigned in destination group (not assigned to instructor)
                    // They were removed from swimmer_grouping when we deleted the instructor's entry
                });
            }
        } else if (isDraggingSwimmer) {
            // Handle swimmer drag
            const sourceIndex = sourceGroup.swimmers.indexOf(personId);
            if (sourceIndex === -1) return;

            // Check if swimmer already exists in destination group (only when moving between groups)
            if (sourceGroupId !== destGroupId && destGroup.swimmers.includes(personId)) {
                alert('This swimmer is already in the destination group.');
                return;
            }

            // Remove swimmer from any instructor assignment in source group
            Object.keys(sourceGroup.swimmer_grouping).forEach(instId => {
                sourceGroup.swimmer_grouping![instId] = sourceGroup.swimmer_grouping![instId].filter(id => id !== personId);
                if (sourceGroup.swimmer_grouping![instId].length === 0) {
                    delete sourceGroup.swimmer_grouping![instId];
                }
            });

            if (sourceGroupId !== destGroupId) {
                // Moving to different group - update swimmers array
                sourceGroup.swimmers.splice(sourceIndex, 1);
                destGroup.swimmers.push(personId);
            }

            // Assign swimmer to target instructor in destination group (if not unassigned)
            if (targetInstructorId !== null && !droppingToUnassigned) {
                if (!destGroup.swimmer_grouping[String(targetInstructorId)]) {
                    destGroup.swimmer_grouping[String(targetInstructorId)] = [];
                }
                if (!destGroup.swimmer_grouping[String(targetInstructorId)].includes(personId)) {
                    destGroup.swimmer_grouping[String(targetInstructorId)].push(personId);
                }
            }
            // If droppingToUnassigned, swimmer is already removed from all instructor assignments
        }

        setCampData(newCampData);
        setHasChanges(true);
    };

    const handleSaveChanges = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

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
            const updates: SaveUpdate[] = [];

            Object.keys(campData || {}).forEach(animalId => {
                campData![animalId].groups.forEach(group => {
                    updates.push({
                        group_id: group.id,
                        instructors: group.instructors,
                        swimmers: group.swimmers,
                        swimmer_grouping: group.swimmer_grouping || {},
                    });
                });
            });

            await fetch(`${apiUrl}lm/v1/camp-organizer/save`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    camp_id: selectedCamp,
                    updates: updates,
                }),
            });

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

        setCampData(JSON.parse(JSON.stringify(originalData)));
        setHasChanges(false);
    };

    const handleOpenSwimmerModal = useCallback((swimmerId: number) => {
        setEditingSwimmerId(swimmerId);
    }, []);
    
    const handleCreateEvaluation = useCallback((swimmerId: number) => {
        setEditingSwimmerId(swimmerId);
        setEvaluationSwimmerId(swimmerId);
        setShowEvaluationForm(true);
    }, []);
    
    const handleCloseSwimmerEditor = useCallback(() => {
        setEditingSwimmerId(null);
        setShowEvaluationForm(false);
        setEvaluationSwimmerId(null);
    }, []);
    
    // Get swimmers grouped by instructor for a specific group
    const getSwimmersGroupedByInstructor = useCallback((group: GroupData): Array<{
        id: string;
        name: string;
        swimmers: PersonInfo[];
    }> => {
        const groupInstructorIds = group.instructors || [];
        const groupSwimmerIds = group.swimmers || [];
        const swimmerGrouping = group.swimmer_grouping || {};
        
        const groups: Array<{ id: string; name: string; swimmers: PersonInfo[] }> = [];
        const assignedSwimmerIds = new Set<number>();
        
        // Add each instructor with their assigned swimmers
        groupInstructorIds.forEach(instructorId => {
            const instructor = personCache.get(instructorId);
            const name = instructor?.display_name || instructor?.name || `Instructor ${instructorId}`;
            const instructorSwimmerIds = (swimmerGrouping[String(instructorId)] as number[]) || [];
            
            // Get swimmers assigned to this instructor
            const instructorSwimmers = instructorSwimmerIds
                .filter(sid => groupSwimmerIds.includes(sid))
                .map(sid => personCache.get(sid))
                .filter((s): s is PersonInfo => !!s);
            
            instructorSwimmerIds.forEach(id => assignedSwimmerIds.add(id));
            
            groups.push({
                id: `instructor-${group.id}-${instructorId}`,
                name,
                swimmers: sortPersonsAlphabetically(instructorSwimmers)
            });
        });
        
        // Add unassigned swimmers
        const unassignedSwimmers = groupSwimmerIds
            .filter(sid => !assignedSwimmerIds.has(sid))
            .map(sid => personCache.get(sid))
            .filter((s): s is PersonInfo => !!s);
        
        groups.push({
            id: `swimmers-${group.id}`,
            name: 'Unassigned',
            swimmers: sortPersonsAlphabetically(unassignedSwimmers)
        });
        
        return groups;
    }, [personCache]);

    // Filtered instructors for multi-select in group form - selected items always shown first
    const filteredInstructors = useMemo(() => {
        const search = instructorSearch.toLowerCase();
        const filtered = instructorSearch
            ? instructors.filter(i => i.name.toLowerCase().includes(search))
            : instructors;
        
        // Always include selected instructors at the top
        const selectedIds = new Set(groupFormData.instructor);
        const selectedInstructors = instructors.filter(i => selectedIds.has(i.id));
        const unselectedFiltered = filtered.filter(i => !selectedIds.has(i.id));
        
        return [...selectedInstructors, ...unselectedFiltered];
    }, [instructors, instructorSearch, groupFormData.instructor]);

    // Filtered swimmers for multi-select in group form - selected items always shown first
    const filteredSwimmers = useMemo(() => {
        const search = swimmerSearch.toLowerCase();
        const filtered = swimmerSearch
            ? allSwimmers.filter(swimmer => {
                const name = swimmer.title?.rendered?.toLowerCase() || '';
                return name.includes(search);
            })
            : allSwimmers;
        
        // Always include selected swimmers at the top
        const selectedIds = new Set(groupFormData.swimmers);
        const selectedSwimmers = allSwimmers.filter(s => selectedIds.has(s.id));
        const unselectedFiltered = filtered.filter(s => !selectedIds.has(s.id));
        
        return [...selectedSwimmers, ...unselectedFiltered];
    }, [allSwimmers, swimmerSearch, groupFormData.swimmers]);

    // Toggle instructor selection in group form - also clean up swimmer_grouping when removing
    const toggleFormInstructor = useCallback((instructorId: number) => {
        setGroupFormData(prev => {
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
    }, []);

    // Toggle swimmer selection in group form - also clean up swimmer_grouping when removing
    const toggleFormSwimmer = useCallback((swimmerId: number) => {
        setGroupFormData(prev => {
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
    }, []);

    // Add date to dates_offered
    const addDateOffered = useCallback((date: string) => {
        if (date && !groupFormData.dates_offered.includes(date)) {
            setGroupFormData(prev => ({
                ...prev,
                dates_offered: [...prev.dates_offered, date].sort()
            }));
        }
    }, [groupFormData.dates_offered]);

    // Remove date from dates_offered
    const removeDateOffered = useCallback((date: string) => {
        setGroupFormData(prev => ({
            ...prev,
            dates_offered: prev.dates_offered.filter(d => d !== date)
        }));
    }, []);

    // Toggle day selection
    const toggleDay = useCallback((day: string) => {
        setGroupFormData(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    }, []);

    // Handle form field change
    const handleGroupFieldChange = useCallback((field: keyof GroupFormData, value: unknown) => {
        setGroupFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    // Open group edit form
    const handleOpenGroupEdit = useCallback(async (groupId: number) => {
        setEditingGroupId(groupId);
        setGroupFormError(null);
        setInstructorSearch('');
        setSwimmerSearch('');
        
        // Fetch full group data from API
        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-group/${groupId}?context=edit`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            if (response.ok) {
                const group: Group = await response.json();
                setEditingGroupData(group);
                setGroupFormData({
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
            }
        } catch (error) {
            console.error('Error loading group data:', error);
            setGroupFormError('Failed to load group data');
        }
    }, [apiUrl, nonce]);

    // Close group edit form
    const handleCloseGroupEdit = useCallback(() => {
        setEditingGroupId(null);
        setEditingGroupData(null);
        setGroupFormData(emptyFormData);
        setGroupFormError(null);
        setInstructorSearch('');
        setSwimmerSearch('');
    }, []);

    // Save group edit form
    const handleSaveGroupEdit = useCallback(async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!groupFormData.title.trim()) {
            setGroupFormError('Group name is required');
            return;
        }

        setIsGroupFormSaving(true);
        setGroupFormError(null);

        try {
            const url = `${apiUrl}wp/v2/lm-group/${editingGroupId}`;
            
            // Sanitize swimmer_grouping before saving:
            // 1. Remove keys for instructors not in the current instructor list
            // 2. Remove swimmer IDs not in the current swimmers list
            const instructorIdStrSet = new Set(groupFormData.instructor.map(id => String(id)));
            const swimmerIdSet = new Set(groupFormData.swimmers);
            const sanitizedSwimmerGrouping: Record<string, number[]> = {};
            
            for (const [instIdStr, swimmerIds] of Object.entries(groupFormData.swimmer_grouping)) {
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
                title: groupFormData.title.trim(),
                status: 'publish',
                meta: {
                    level: groupFormData.level || '',
                    days: groupFormData.days,
                    group_time: groupFormData.group_time.trim(),
                    notes: groupFormData.notes.trim(),
                    swimmers: groupFormData.swimmers,
                    instructor: groupFormData.instructor,
                    swimmer_grouping: sanitizedSwimmerGrouping,
                    dates_offered: groupFormData.dates_offered,
                    media: groupFormData.media || 0,
                    year: groupFormData.year || new Date().getFullYear(),
                    archived: groupFormData.archived,
                },
                lm_camp: groupFormData.lm_camp,
                lm_animal: groupFormData.lm_animal,
                lm_lesson_type: groupFormData.lm_lesson_type,
            };

            if (editingGroupData?.modified_gmt) {
                body.original_modified = editingGroupData.modified_gmt;
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update group');
            }

            // Reload camp data to reflect changes
            await loadCampData();
            handleCloseGroupEdit();
        } catch (err) {
            setGroupFormError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsGroupFormSaving(false);
        }
    }, [apiUrl, nonce, editingGroupId, editingGroupData, groupFormData, loadCampData, handleCloseGroupEdit]);

    // Get swimmers grouped by instructor for group form display
    const formInstructorGroups = useMemo(() => {
        const selectedSwimmers = allSwimmers.filter(s => groupFormData.swimmers.includes(s.id));
        const grouping = groupFormData.swimmer_grouping || {};
        
        const groups: Array<{ id: string; name: string; swimmers: Swimmer[] }> = [];
        const assignedSwimmerIds = new Set<number>();
        
        // Add ALL selected instructors (even if they have no swimmers yet)
        groupFormData.instructor.forEach(instructorId => {
            const instructor = instructors.find(i => i.id === instructorId);
            const name = instructor?.name || `Instructor ${instructorId}`;
            const swimmerIds = (grouping[String(instructorId)] as number[]) || [];
            const instructorSwimmers = swimmerIds
                .filter(id => groupFormData.swimmers.includes(id))
                .map(id => selectedSwimmers.find(s => s.id === id))
                .filter(Boolean) as Swimmer[];
            swimmerIds.forEach(id => assignedSwimmerIds.add(id));
            
            groups.push({
                id: `instructor-${instructorId}`,
                name,
                swimmers: sortPersonsAlphabetically(instructorSwimmers)
            });
        });
        
        // Add unassigned swimmers
        const unassigned = selectedSwimmers.filter(s => !assignedSwimmerIds.has(s.id));
        groups.push({
            id: 'Unassigned',
            name: 'Unassigned',
            swimmers: sortPersonsAlphabetically(unassigned)
        });
        
        return groups;
    }, [groupFormData.swimmers, groupFormData.instructor, groupFormData.swimmer_grouping, allSwimmers, instructors]);

    // DnD handlers for group form
    const handleFormDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const swimmerId = parseInt(String(active.id).replace('form-swimmer-', ''));
        setFormActiveSwimmerId(swimmerId);
    }, []);

    const handleFormDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        if (over) {
            const overId = String(over.id);
            if (overId.startsWith('instructor-') || overId === 'Unassigned') {
                setFormOverInstructorId(overId);
            }
        } else {
            setFormOverInstructorId(null);
        }
    }, []);

    const handleFormDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setFormActiveSwimmerId(null);
        setFormOverInstructorId(null);
        
        if (!over) return;
        
        const swimmerId = parseInt(String(active.id).replace('form-swimmer-', ''));
        const targetId = String(over.id);
        
        let targetInstructorId: string | null = null;
        
        if (targetId.startsWith('instructor-')) {
            targetInstructorId = targetId.replace('instructor-', '');
        } else if (targetId === 'Unassigned') {
            targetInstructorId = 'Unassigned';
        } else if (targetId.startsWith('form-swimmer-')) {
            // Find which instructor this swimmer belongs to
            const targetSwimmerId = parseInt(targetId.replace('form-swimmer-', ''));
            const grouping = groupFormData.swimmer_grouping || {};
            
            for (const [instId, swimmerIds] of Object.entries(grouping)) {
                if ((swimmerIds as number[]).includes(targetSwimmerId)) {
                    targetInstructorId = String(instId);
                    break;
                }
            }
            if (!targetInstructorId) {
                targetInstructorId = 'Unassigned';
            }
        }
        
        if (!targetInstructorId) return;
        
        setGroupFormData(prev => {
            const newGrouping: Record<string, number[]> = {};
            
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
            
            // Remove from source
            if (sourceInstructorId && newGrouping[sourceInstructorId]) {
                newGrouping[sourceInstructorId] = newGrouping[sourceInstructorId].filter(id => id !== swimmerId);
                if (newGrouping[sourceInstructorId].length === 0) {
                    delete newGrouping[sourceInstructorId];
                }
            }
            
            // Add to target (unless Unassigned)
            if (targetInstructorId !== 'Unassigned') {
                if (!newGrouping[targetInstructorId]) {
                    newGrouping[targetInstructorId] = [];
                }
                newGrouping[targetInstructorId] = [...newGrouping[targetInstructorId], swimmerId];
            }
            
            return {
                ...prev,
                swimmer_grouping: newGrouping
            };
        });
    }, [groupFormData.swimmer_grouping]);

    // Show loading while checking permissions
    if (isCheckingPermission) {
        return (
            <div className="ap-p-6">
                <h1 className="ap-text-2xl ap-font-bold ap-mb-6">Camp Organizer</h1>
                <div className="ap-flex ap-justify-center ap-py-12">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    // Permission denied state - only show after permission check completes
    if (!hasEditPermission && !isLoading) {
        return (
            <div className="ap-p-6">
                <h1 className="ap-text-2xl ap-font-bold ap-mb-6">Camp Organizer</h1>
                <div className="ap-bg-red-50 ap-border ap-border-red-300 ap-rounded-lg ap-p-6">
                    <div className="ap-flex ap-items-center">
                        <HiOutlineExclamationTriangle className="ap-w-6 ap-h-6 ap-text-red-600 ap-mr-3" />
                        <div>
                            <h2 className="ap-text-lg ap-font-semibold ap-text-red-900">Access Denied</h2>
                            <p className="ap-text-red-800">You do not have permission to access the Camp Organizer. Please contact an administrator.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-p-6 ap-max-w-7xl ap-mx-auto">
            {/* Header */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-slate-200 ap-p-6 ap-mb-6">
                <div className="ap-flex ap-justify-between ap-items-center ap-mb-4">
                    <h1 className="ap-text-3xl ap-font-bold ap-text-slate-900">Camp Organizer</h1>

                    {saveMessage && (
                        <div className={`ap-px-4 ap-py-2 ap-rounded-lg ap-font-semibold ${
                            saveMessage.includes('✓') ? 'ap-bg-green-50 ap-text-green-800 ap-border ap-border-green-300' :
                            saveMessage.includes('❌') ? 'ap-bg-red-50 ap-text-red-800 ap-border ap-border-red-300' : 'ap-bg-blue-50 ap-text-blue-800 ap-border ap-border-blue-300'
                        }`}>
                            {saveMessage}
                        </div>
                    )}
                </div>

                {/* Lock Warning */}
                {isLocked && lockedBy && (
                    <div className="ap-mb-4 ap-p-4 ap-bg-yellow-50 ap-border ap-border-yellow-300 ap-rounded-lg">
                        <div className="ap-flex ap-items-center">
                            <HiOutlineLockClosed className="ap-w-5 ap-h-5 ap-text-yellow-600 ap-mr-2" />
                            <span className="ap-font-semibold ap-text-yellow-800">
                                This camp is currently being edited by {lockedBy}. You can view but cannot make changes.
                            </span>
                        </div>
                    </div>
                )}

                {/* Camp Selection */}
                <div className="ap-flex ap-gap-4 ap-items-end ap-flex-wrap">
                    <div className="ap-flex-1 ap-min-w-[200px]">
                        <label htmlFor="camp-select" className="ap-block ap-text-sm ap-font-semibold ap-text-slate-700 ap-mb-2">
                            Select Camp
                        </label>
                        <select
                            id="camp-select"
                            value={selectedCamp}
                            onChange={(e) => setSelectedCamp(e.target.value)}
                            disabled={isLoading || isSaving || hasChanges}
                            className="ap-w-full ap-px-4 ap-py-2 ap-border ap-border-slate-300 ap-rounded-lg ap-shadow-sm focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-indigo-500 disabled:ap-opacity-50 disabled:ap-cursor-not-allowed"
                        >
                            <option value="">-- Select a Camp --</option>
                            {camps.map(camp => (
                                <option key={camp.id} value={camp.id}>
                                    {camp.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="ap-flex ap-items-center ap-gap-2 ap-mb-2">
                        <input
                            type="checkbox"
                            id="include-archived-toggle"
                            className="ap-h-4 ap-w-4 ap-text-orange-600 ap-border-slate-300 ap-rounded"
                            checked={includeArchived}
                            onChange={(e) => setIncludeArchived(e.target.checked)}
                            disabled={isLoading || isSaving || hasChanges}
                        />
                        <label htmlFor="include-archived-toggle" className="ap-text-sm ap-font-medium ap-text-slate-700">
                            Show archived groups
                        </label>
                    </div>

                    {campData && (
                        <div className="ap-flex ap-gap-2">
                            <Button
                                variant="lesson-camp"
                                onClick={handleSaveChanges}
                                disabled={!hasChanges || isLocked || isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save All Changes'}
                            </Button>

                            <Button
                                variant="secondary"
                                onClick={handleCancelChanges}
                                disabled={!hasChanges || isLocked || isSaving}
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>

                {campData && (
                    <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mt-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCollapseAll}
                            disabled={isLoading}
                        >
                            Collapse all animals
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleExpandAll}
                            disabled={isLoading}
                        >
                            Expand all animals
                        </Button>
                    </div>
                )}

                {hasChanges && (
                    <div className="ap-mt-4 ap-p-3 ap-bg-blue-50 ap-border ap-border-blue-300 ap-rounded-lg">
                        <p className="ap-text-blue-800 ap-font-medium">⚠️ You have unsaved changes. Click "Save All Changes" to apply them.</p>
                    </div>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-slate-200 ap-p-12">
                    <div className="ap-flex ap-flex-col ap-items-center ap-justify-center">
                        <LoadingSpinner />
                        <p className="ap-text-slate-600 ap-font-medium ap-mt-4">Loading camp data...</p>
                    </div>
                </div>
            )}

            {/* Camp Organization View */}
            {campData && !isLoading && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="ap-space-y-6">
                        {sortedAnimalIds.map(animalId => {
                            const animalData = campData[animalId];
                            const animalName = getAnimalName(animalId);
                            const isCollapsed = !!collapsedAnimals[animalId];

                            return (
                                <div key={animalId} className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-border ap-border-slate-200 ap-overflow-hidden">
                                    {/* Animal Header */}
                                    <div className="ap-bg-gradient-to-r ap-from-indigo-600 ap-to-indigo-700 ap-px-6 ap-py-4 ap-flex ap-items-center ap-justify-between ap-gap-4">
                                        <h2 className="ap-text-2xl ap-font-bold ap-text-white ap-flex ap-items-center ap-gap-2">
                                            <HiOutlineUserGroup className="ap-w-6 ap-h-6" />
                                            {animalName}
                                        </h2>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleAnimal(animalId)}
                                            className="ap-text-white ap-border ap-border-white/30 hover:ap-bg-white/10"
                                        >
                                            {isCollapsed ? (
                                                <>
                                                    <HiOutlineChevronDown className="ap-w-4 ap-h-4" />
                                                    Expand
                                                </>
                                            ) : (
                                                <>
                                                    <HiOutlineChevronUp className="ap-w-4 ap-h-4" />
                                                    Collapse
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    <div className="ap-p-6">
                                        {/* Groups */}
                                        <div>
                                            <h3 className="ap-text-lg ap-font-semibold ap-text-slate-700 ap-mb-3">Groups</h3>
                                            {isCollapsed ? (
                                                <div className="ap-text-slate-500 ap-text-sm ap-italic ap-bg-slate-50 ap-rounded-lg ap-p-4">
                                                    Section collapsed. Expand to manage these groups.
                                                </div>
                                            ) : animalData.groups.length === 0 ? (
                                                <div className="ap-text-center ap-py-8 ap-text-slate-400 ap-italic ap-bg-slate-50 ap-rounded-lg">
                                                    No groups in this animal
                                                </div>
                                            ) : (
                                                <div className="ap-space-y-4">
                                                    {animalData.groups.map(group => {
                                                        const swimmerGroups = getSwimmersGroupedByInstructor(group);
                                                        return (
                                                        <div key={group.id} className="ap-border ap-border-slate-200 ap-rounded-lg ap-overflow-hidden ap-bg-white">
                                                            {/* Group Header */}
                                                            <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-b ap-border-gray-200">
                                                                <div className="ap-flex ap-justify-between ap-items-start">
                                                                    <div className="ap-flex-1">
                                                                        <h2 className="ap-text-lg ap-font-bold ap-text-slate-900">
                                                                            <span className="ap-text-orange-600">{animalName}</span>
                                                                            <span className="ap-text-slate-500">, </span>
                                                                            <span>{group.name}</span>
                                                                        </h2>
                                                                        <div className="ap-flex ap-flex-wrap ap-gap-3 ap-mt-1 ap-text-sm ap-text-gray-600">
                                                                            {group.level && (
                                                                                <span className="ap-flex ap-items-center ap-gap-1">
                                                                                    <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-text-indigo-500" />
                                                                                    {group.level}
                                                                                </span>
                                                                            )}
                                                                            <span className="ap-flex ap-items-center ap-gap-1">
                                                                                <HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-text-green-500" />
                                                                                {group.swimmers.length} swimmer{group.swimmers.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                            {group.instructors.length > 0 && (
                                                                                <span className="ap-flex ap-items-center ap-gap-1 ap-text-purple-600">
                                                                                    <HiOutlineUserCircle className="ap-w-4 ap-h-4" />
                                                                                    {group.instructors.map(id => {
                                                                                        const instructor = personCache.get(id);
                                                                                        return instructor?.display_name || instructor?.name || `ID: ${id}`;
                                                                                    }).join(', ')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {hasEditPermission && !isLocked && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="xs"
                                                                            onClick={() => handleOpenGroupEdit(group.id)}
                                                                            className="!ap-p-2 !ap-min-h-0 ap-text-blue-600 hover:ap-bg-blue-50"
                                                                            title="Edit group"
                                                                        >
                                                                            <HiOutlinePencil className="ap-w-5 ap-h-5" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Swimmers Table */}
                                                            <div>
                                                                {swimmerGroups.map((swimmerGroup) => (
                                                                    <DroppableInstructor
                                                                        key={swimmerGroup.id}
                                                                        instructorId={swimmerGroup.id}
                                                                        instructorName={swimmerGroup.name}
                                                                        swimmers={swimmerGroup.swimmers}
                                                                        levels={levels}
                                                                        groupId={group.id}
                                                                        onEditSwimmer={handleOpenSwimmerModal}
                                                                        onCreateEvaluation={handleCreateEvaluation}
                                                                        isOver={overInstructorId === swimmerGroup.id}
                                                                        isLocked={isLocked}
                                                                        hasEditPermission={hasEditPermission}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Drag Overlay */}
                    {createPortal(
                        <DragOverlay
                            dropAnimation={{
                                duration: 250,
                                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                            }}
                        >
                            {activeInstructorId && (
                                <div style={{
                                    padding: '6px 12px',
                                    backgroundColor: 'white',
                                    borderRadius: '9999px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    border: '2px solid #818cf8',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    pointerEvents: 'none',
                                }}>
                                    <HiOutlineBars3 className="ap-w-4 ap-h-4 ap-text-slate-400" />
                                    {(() => {
                                        const person = personCache.get(activeInstructorId);
                                        return person?.display_name || person?.name || `ID: ${activeInstructorId}`;
                                    })()}
                                </div>
                            )}
                            {activeSwimmerId && (() => {
                                const swimmer = personCache.get(activeSwimmerId);
                                const swimmerLevel = levels.find(l => l.id === swimmer?.meta?.current_level);
                                const age = calculateAge(swimmer?.meta?.date_of_birth);
                                return (
                                    <table style={{
                                        backgroundColor: 'white',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                        borderRadius: '8px',
                                        border: '2px solid #0891b2',
                                        outline: '4px solid rgba(8, 145, 178, 0.3)',
                                        pointerEvents: 'none',
                                        minWidth: '350px',
                                        fontFamily: 'system-ui, -apple-system, sans-serif',
                                        borderCollapse: 'collapse',
                                    }}>
                                        <tbody>
                                            <tr style={{ backgroundColor: 'rgba(8, 145, 178, 0.05)' }}>
                                                <td style={{ padding: '10px 8px', width: '32px', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#0891b2' }}>
                                                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                                                    {decodeHTMLEntities(swimmer?.title?.rendered || swimmer?.name || `Swimmer #${activeSwimmerId}`)}
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: '14px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                    {age !== null ? age : '-'}
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: '14px', color: '#6b7280' }}>
                                                    {swimmerLevel ? (
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            backgroundColor: swimmerLevel.color || '#e5e7eb',
                                                            color: getLuminance(swimmerLevel.color || '#e5e7eb') > 0.5 ? '#1f2937' : '#ffffff'
                                                        }}>
                                                            {decodeHTMLEntities(swimmerLevel?.title?.rendered) || ''}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>
            )}

            {/* Empty State */}
            {!selectedCamp && !isLoading && (
                <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-slate-200 ap-p-12">
                    <div className="ap-text-center">
                        <HiOutlineUserGroup className="ap-w-16 ap-h-16 ap-text-slate-300 ap-mx-auto ap-mb-4" />
                        <h3 className="ap-text-xl ap-font-semibold ap-text-slate-700 ap-mb-2">Select a Camp to Begin</h3>
                        <p className="ap-text-slate-500">Choose a camp from the dropdown above to view and organize its groups.</p>
                    </div>
                </div>
            )}

            {/* Group Edit Slide-Over - Full Form matching GroupManager */}
            {editingGroupId && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-hidden">
                    {/* Backdrop - hidden on mobile */}
                    <div 
                        className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                        onClick={handleCloseGroupEdit}
                    />
                    
                    {/* Panel - full screen on mobile, slide-over on desktop */}
                    <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                        <div className="ap-w-full md:ap-w-screen md:ap-max-w-[60vw] ap-h-screen ap-max-h-screen ap-transform ap-transition-transform ap-duration-300">
                            <div className="ap-flex ap-h-full ap-max-h-screen ap-flex-col ap-bg-white ap-shadow-xl">
                                {/* Header */}
                                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-indigo-600 ap-to-indigo-700">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseGroupEdit}
                                        className="md:ap-hidden !ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                                    >
                                        <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <h2 className="ap-text-lg md:ap-text-xl ap-font-semibold ap-text-white ap-flex-1">
                                        Edit Group
                                    </h2>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseGroupEdit}
                                        className="ap-hidden md:ap-block !ap-p-2 !ap-min-h-0 ap-text-white/80 hover:ap-text-white"
                                    >
                                        <HiOutlineXMark className="ap-w-6 ap-h-6" />
                                    </Button>
                                </div>

                                {/* Form - scrollable */}
                                <div className="ap-flex-1 ap-overflow-y-auto ap-p-4 md:ap-p-6 ap-space-y-5 md:ap-space-y-6">
                                    {groupFormError && (
                                        <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                            <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                            {groupFormError}
                                        </div>
                                    )}

                                    {/* Group Name */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Group Name <span className="ap-text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={groupFormData.title}
                                            onChange={(e) => handleGroupFieldChange('title', e.target.value)}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
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
                                                value={groupFormData.group_time}
                                                onChange={(e) => handleGroupFieldChange('group_time', e.target.value)}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
                                                placeholder="e.g., 9:00 AM - 10:00 AM"
                                            />
                                        </div>
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                                Year
                                            </label>
                                            <input
                                                type="number"
                                                value={groupFormData.year}
                                                onChange={(e) => handleGroupFieldChange('year', e.target.value ? parseInt(e.target.value) : '')}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
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
                                                value={groupFormData.lm_camp[0] || ''}
                                                onChange={(e) => handleGroupFieldChange('lm_camp', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
                                            >
                                                <option value="">Select camp...</option>
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
                                                value={groupFormData.lm_animal[0] || ''}
                                                onChange={(e) => handleGroupFieldChange('lm_animal', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
                                            >
                                                <option value="">Select animal...</option>
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
                                                value={groupFormData.lm_lesson_type[0] || ''}
                                                onChange={(e) => handleGroupFieldChange('lm_lesson_type', e.target.value ? [parseInt(e.target.value)] : [])}
                                                className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
                                            >
                                                <option value="">Select type...</option>
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
                                            value={groupFormData.level}
                                            onChange={(e) => handleGroupFieldChange('level', e.target.value ? parseInt(e.target.value) : '')}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors"
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
                                            {DAYS_OF_WEEK.map(day => (
                                                <Button
                                                    key={day}
                                                    type="button"
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => toggleDay(day)}
                                                    className={`!ap-px-3 !ap-py-1.5 !ap-min-h-0 ap-rounded-full ${
                                                        groupFormData.days.includes(day)
                                                            ? 'ap-bg-indigo-600 ap-text-white hover:ap-bg-indigo-700' : 'ap-bg-gray-100 ap-text-gray-700 hover:ap-bg-gray-200'
                                                    }`}
                                                >
                                                    {day.slice(0, 3)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Instructors - Multi-select with search */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Instructors ({groupFormData.instructor.length} selected)
                                        </label>
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                            <div className="ap-p-2 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <div className="ap-relative">
                                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={instructorSearch}
                                                        onChange={(e) => setInstructorSearch(e.target.value)}
                                                        placeholder="Search instructors..."
                                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm ap-rounded ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-1 focus:ap-ring-indigo-500/20"
                                                    />
                                                </div>
                                            </div>
                                            <div className="ap-max-h-48 ap-overflow-y-auto">
                                                {filteredInstructors.length === 0 ? (
                                                    <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                                                        No instructors found
                                                    </div>
                                                ) : (
                                                    filteredInstructors.map(instructor => (
                                                        <label
                                                            key={instructor.id}
                                                            className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2.5 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                                                groupFormData.instructor.includes(instructor.id) ? 'ap-bg-indigo-50' : ''
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={groupFormData.instructor.includes(instructor.id)}
                                                                onChange={() => toggleFormInstructor(instructor.id)}
                                                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-indigo-600 focus:ap-ring-indigo-500"
                                                            />
                                                            <span className="ap-text-sm ap-text-gray-700 ap-flex-1">
                                                                {instructor.name}
                                                            </span>
                                                            {groupFormData.instructor.includes(instructor.id) && (
                                                                <HiOutlineCheck className="ap-w-4 ap-h-4 ap-text-indigo-600" />
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
                                            Swimmers ({groupFormData.swimmers.length} selected)
                                        </label>
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                            <div className="ap-p-2 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                                <div className="ap-relative">
                                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={swimmerSearch}
                                                        onChange={(e) => setSwimmerSearch(e.target.value)}
                                                        placeholder="Search swimmers..."
                                                        className="ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm ap-rounded ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-1 focus:ap-ring-indigo-500/20"
                                                    />
                                                </div>
                                            </div>
                                            <div className="ap-max-h-48 ap-overflow-y-auto">
                                                {filteredSwimmers.length === 0 ? (
                                                    <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                                                        No swimmers found
                                                    </div>
                                                ) : (
                                                    filteredSwimmers.map(swimmer => {
                                                        const swimmerLevel = levels.find(l => l.id === swimmer.meta?.current_level);
                                                        return (
                                                            <label
                                                                key={swimmer.id}
                                                                className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2.5 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                                                    groupFormData.swimmers.includes(swimmer.id) ? 'ap-bg-green-50' : ''
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={groupFormData.swimmers.includes(swimmer.id)}
                                                                    onChange={() => toggleFormSwimmer(swimmer.id)}
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
                                                                {groupFormData.swimmers.includes(swimmer.id) && (
                                                                    <HiOutlineCheck className="ap-w-4 ap-h-4 ap-text-green-600 ap-flex-shrink-0" />
                                                                )}
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selected Swimmers Table with Drag & Drop */}
                                    {groupFormData.swimmers.length > 0 && (
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
                                                onDragStart={handleFormDragStart}
                                                onDragOver={handleFormDragOver}
                                                onDragEnd={handleFormDragEnd}
                                            >
                                                <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                                    {formInstructorGroups.map((group) => (
                                                        <FormDroppableInstructor
                                                            key={group.id}
                                                            instructorId={group.id}
                                                            instructorName={group.name}
                                                            swimmers={group.swimmers}
                                                            levels={levels}
                                                            onEditSwimmer={(id) => {
                                                                handleCloseGroupEdit();
                                                                handleOpenSwimmerModal(id);
                                                            }}
                                                            onCreateEvaluation={(id) => {
                                                                handleCloseGroupEdit();
                                                                handleCreateEvaluation(id);
                                                            }}
                                                            onRemoveSwimmer={toggleFormSwimmer}
                                                            isOver={formOverInstructorId === group.id}
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
                                                        {formActiveSwimmerId && (() => {
                                                            const activeSwimmer = allSwimmers.find(s => s.id === formActiveSwimmerId);
                                                            const swimmerLevel = levels.find(l => l.id === activeSwimmer?.meta?.current_level);
                                                            const age = calculateAge(activeSwimmer?.meta?.date_of_birth);
                                                            return (
                                                                <table style={{
                                                                    backgroundColor: 'white',
                                                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                                                    borderRadius: '8px',
                                                                    border: '2px solid #0891b2',
                                                                    outline: '4px solid rgba(8, 145, 178, 0.3)',
                                                                    pointerEvents: 'none',
                                                                    minWidth: '350px',
                                                                    fontFamily: 'system-ui, -apple-system, sans-serif',
                                                                    borderCollapse: 'collapse',
                                                                }}>
                                                                    <tbody>
                                                                        <tr style={{ backgroundColor: 'rgba(8, 145, 178, 0.05)' }}>
                                                                            <td style={{ padding: '10px 8px', width: '32px', verticalAlign: 'middle' }}>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#0891b2' }}>
                                                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                                    <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }}></span>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                                                                                {activeSwimmer?.name || decodeHTMLEntities(activeSwimmer?.title?.rendered) || 'Swimmer'}
                                                                            </td>
                                                                            <td style={{ padding: '10px 12px', fontSize: '14px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                                                {age !== null ? age : '-'}
                                                                            </td>
                                                                            <td style={{ padding: '10px 12px', fontSize: '14px', color: '#6b7280' }}>
                                                                                {swimmerLevel ? (
                                                                                    <span style={{
                                                                                        display: 'inline-block',
                                                                                        padding: '2px 8px',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '12px',
                                                                                        fontWeight: 500,
                                                                                        backgroundColor: swimmerLevel.color || '#e5e7eb',
                                                                                        color: getLuminance(swimmerLevel.color || '#e5e7eb') > 0.5 ? '#1f2937' : '#ffffff'
                                                                                    }}>
                                                                                        {decodeHTMLEntities(swimmerLevel?.title?.rendered) || ''}
                                                                                    </span>
                                                                                ) : '-'}
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
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
                                            value={groupFormData.notes}
                                            onChange={(e) => handleGroupFieldChange('notes', e.target.value)}
                                            rows={3}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors ap-resize-none"
                                            placeholder="Any additional notes about this group..."
                                        />
                                    </div>

                                    {/* Specific Dates Offered */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Specific Dates ({groupFormData.dates_offered.length} dates)
                                        </label>
                                        <div className="ap-flex ap-gap-2 ap-mb-2">
                                            <input
                                                type="date"
                                                id="group-new-date-input"
                                                className="ap-flex-1 ap-px-4 ap-py-2 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-indigo-500 focus:ap-ring-2 focus:ap-ring-indigo-500/20 ap-transition-colors ap-text-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.getElementById('group-new-date-input') as HTMLInputElement;
                                                    if (input?.value) {
                                                        addDateOffered(input.value);
                                                        input.value = '';
                                                    }
                                                }}
                                            >
                                                Add Date
                                            </Button>
                                        </div>
                                        {groupFormData.dates_offered.length > 0 && (
                                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                                {groupFormData.dates_offered.map(date => (
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
                                                            className="!ap-p-0 !ap-min-h-0 hover:ap-text-blue-900"
                                                        >
                                                            <HiOutlineXMark className="ap-w-3 ap-h-3" />
                                                        </Button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Archive toggle */}
                                    <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600 ap-cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={groupFormData.archived}
                                            onChange={(e) => handleGroupFieldChange('archived', e.target.checked)}
                                            className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-gray-500 focus:ap-ring-gray-500"
                                        />
                                        Archive this group
                                    </label>
                                </div>

                                {/* Footer */}
                                <div className="ap-flex-shrink-0 ap-flex ap-flex-col-reverse sm:ap-flex-row ap-items-stretch sm:ap-items-center ap-justify-end ap-gap-2 sm:ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                    <Button
                                        variant="secondary"
                                        onClick={handleCloseGroupEdit}
                                        disabled={isGroupFormSaving}
                                        className="ap-w-full sm:ap-w-auto"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="lesson-camp"
                                        onClick={handleSaveGroupEdit}
                                        disabled={isGroupFormSaving}
                                        className="ap-w-full sm:ap-w-auto"
                                    >
                                        {isGroupFormSaving ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Changes</span>
                                        )}
                                    </Button>
                                </div>
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
                    onClose={handleCloseSwimmerEditor}
                    showEvaluationForm={showEvaluationForm && evaluationSwimmerId === editingSwimmerId}
                    onSwimmerUpdated={(updatedSwimmer) => {
                        // Update swimmer in personCache
                        setPersonCache(prev => {
                            const newCache = new Map(prev);
                            newCache.set(updatedSwimmer.id, {
                                id: updatedSwimmer.id,
                                name: updatedSwimmer.title?.rendered || `Swimmer #${updatedSwimmer.id}`,
                                title: updatedSwimmer.title,
                                meta: updatedSwimmer.meta,
                            });
                            return newCache;
                        });
                        // Also update allSwimmers list
                        setAllSwimmers(prev => 
                            prev.map(s => s.id === updatedSwimmer.id ? updatedSwimmer : s)
                        );
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

export default CampOrganizer;
