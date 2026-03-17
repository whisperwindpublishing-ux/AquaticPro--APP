import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui';
import { 
    HiOutlinePlus,
    HiOutlineMagnifyingGlass,
    HiOutlineDocumentText,
    HiOutlineEnvelope,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineUser,
    HiOutlineAcademicCap,
    HiOutlineCheck,
    HiOutlineArchiveBox,
    HiOutlineArchiveBoxXMark,
    HiOutlineArrowLeft
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Evaluation, Swimmer, Level, Skill } from '@/types/lessons';
import { searchSwimmers, fetchSwimmersByIds } from '@/services/swimmerCache';

// Helper to decode HTML entities
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

// Helper to strip HTML tags and decode entities (for editing content)
const stripHtmlAndDecode = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    // First strip HTML tags
    const div = document.createElement('div');
    div.innerHTML = str;
    const stripped = div.textContent || div.innerText || '';
    // Then decode any remaining entities
    return decodeHTMLEntities(stripped);
};

interface EvaluationManagerProps {
    apiUrl: string;
    nonce: string;
    newEvaluationDefaults?: { swimmer: number } | null;
    onDefaultsConsumed?: () => void;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

interface PaginatedData<T> {
    items: T[];
    page: number;
    totalPages: number;
}

interface EvaluationFormData {
    swimmer: number | '';
    level_evaluated: number | '';
    skills_completed: number[];
    content: string;
    emailed: boolean;
}

const emptyFormData: EvaluationFormData = {
    swimmer: '',
    level_evaluated: '',
    skills_completed: [],
    content: '',
    emailed: false,
};

const EvaluationManager: React.FC<EvaluationManagerProps> = ({ 
    apiUrl, 
    nonce, 
    newEvaluationDefaults,
    onDefaultsConsumed,
    canCreate = true,
    canEdit = true,
    canDelete = true
}) => {
    const [evaluations, setEvaluations] = useState<PaginatedData<Evaluation>>({ items: [], page: 0, totalPages: 1 });
    const [swimmerCache, setSwimmerCache] = useState<Map<number, Swimmer>>(new Map());
    // AJAX search state for swimmer selection (instead of loading all swimmers)
    const [swimmerSearchResults, setSwimmerSearchResults] = useState<Swimmer[]>([]);
    const [swimmerSearchTerm, setSwimmerSearchTerm] = useState('');
    const [isSearchingSwimmers, setIsSearchingSwimmers] = useState(false);
    const [selectedSwimmer, setSelectedSwimmer] = useState<Swimmer | null>(null); // For form display
    const [levels, setLevels] = useState<Level[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    // Filter state
    const [showArchived, setShowArchived] = useState(false);
    
    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkArchiving, setIsBulkArchiving] = useState(false);
    
    // Infinite scroll ref
    const loadMoreRef = useRef<HTMLDivElement>(null);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
    const [formData, setFormData] = useState<EvaluationFormData>(emptyFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    
    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<Evaluation | null>(null);
    
    // Swimmer search debounce ref
    const swimmerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // LocalStorage cache keys for levels/skills
    const LEVELS_CACHE_KEY = 'mp_eval_levels_cache';
    const SKILLS_CACHE_KEY = 'mp_eval_skills_cache';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    // Load reference data (levels, skills only - NO swimmers)
    useEffect(() => {
        const loadReferenceData = async () => {
            const startTime = performance.now();
            
            // Try localStorage cache first for levels
            let cachedLevels: Level[] | null = null;
            let cachedSkills: Skill[] | null = null;
            try {
                const levelsStored = localStorage.getItem(LEVELS_CACHE_KEY);
                const skillsStored = localStorage.getItem(SKILLS_CACHE_KEY);
                if (levelsStored) {
                    const { data, timestamp } = JSON.parse(levelsStored);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        cachedLevels = data;
                        console.log(`[EvaluationManager] Levels restored from cache`);
                    }
                }
                if (skillsStored) {
                    const { data, timestamp } = JSON.parse(skillsStored);
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        cachedSkills = data;
                        console.log(`[EvaluationManager] Skills restored from cache`);
                    }
                }
            } catch (e) {
                // Cache read failed
            }
            
            if (cachedLevels && cachedSkills) {
                setLevels(cachedLevels);
                setSkills(cachedSkills);
                console.log(`[EvaluationManager] Reference data loaded from cache in ${(performance.now() - startTime).toFixed(0)}ms`);
                return;
            }
            
            try {
                console.log('[EvaluationManager] Loading reference data from API...');
                const headers = { 'X-WP-Nonce': nonce };
                
                const [levelsRes, skillsRes] = await Promise.all([
                    cachedLevels ? Promise.resolve(null) : fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, { headers }),
                    cachedSkills ? Promise.resolve(null) : fetch(`${apiUrl}wp/v2/lm-skill?per_page=100`, { headers }),
                ]);

                if (levelsRes?.ok) {
                    const levelsData = await levelsRes.json();
                    const sortedLevels = [...levelsData].sort((a: Level, b: Level) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setLevels(sortedLevels);
                    try {
                        localStorage.setItem(LEVELS_CACHE_KEY, JSON.stringify({ data: sortedLevels, timestamp: Date.now() }));
                    } catch (e) {}
                } else if (cachedLevels) {
                    setLevels(cachedLevels);
                }
                
                if (skillsRes?.ok) {
                    const skillsData = await skillsRes.json();
                    const sortedSkills = [...skillsData].sort((a: Skill, b: Skill) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setSkills(sortedSkills);
                    try {
                        localStorage.setItem(SKILLS_CACHE_KEY, JSON.stringify({ data: sortedSkills, timestamp: Date.now() }));
                    } catch (e) {}
                } else if (cachedSkills) {
                    setSkills(cachedSkills);
                }
                
                console.log(`[EvaluationManager] Reference data loaded in ${(performance.now() - startTime).toFixed(0)}ms`);
            } catch (err) {
                console.error('Error loading reference data:', err);
            }
        };
        loadReferenceData();
    }, [apiUrl, nonce]);
    
    // AJAX swimmer search with debounce
    const handleSwimmerSearch = useCallback((search: string) => {
        setSwimmerSearchTerm(search);
        
        // Clear previous timeout
        if (swimmerSearchTimeoutRef.current) {
            clearTimeout(swimmerSearchTimeoutRef.current);
        }
        
        if (!search || search.length < 2) {
            setSwimmerSearchResults([]);
            return;
        }
        
        // Debounce search
        swimmerSearchTimeoutRef.current = setTimeout(async () => {
            setIsSearchingSwimmers(true);
            try {
                const result = await searchSwimmers(search, 1); // First page only
                setSwimmerSearchResults(result.swimmers as Swimmer[]);
            } catch (err) {
                console.error('Error searching swimmers:', err);
                setSwimmerSearchResults([]);
            } finally {
                setIsSearchingSwimmers(false);
            }
        }, 300);
    }, []);

    // Handle new evaluation defaults from swimmer manager (fetch swimmer by ID)
    useEffect(() => {
        if (newEvaluationDefaults) {
            const loadSwimmerAndOpenForm = async () => {
                try {
                    const swimmers = await fetchSwimmersByIds([newEvaluationDefaults.swimmer]);
                    const swimmer = swimmers[0];
                    if (swimmer) {
                        setSelectedSwimmer(swimmer as Swimmer);
                        setEditingEvaluation(null);
                        setFormData({
                            ...emptyFormData,
                            swimmer: swimmer.id,
                            level_evaluated: swimmer.meta?.current_level || '',
                        });
                        setFormError(null);
                        setSwimmerSearchTerm('');
                        setSwimmerSearchResults([]);
                        setIsModalOpen(true);
                    }
                } catch (err) {
                    console.error('Error loading swimmer for new evaluation:', err);
                }
                onDefaultsConsumed?.();
            };
            loadSwimmerAndOpenForm();
        }
    }, [newEvaluationDefaults, onDefaultsConsumed]);

    // Load evaluations
    const loadEvaluations = useCallback(async (reset = false) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setEvaluations({ items: [], page: 0, totalPages: 1 });
            return;
        }

        if (isLoading) return;
        
        const isNewSearch = reset || (evaluations.page === 0 && evaluations.items.length === 0);
        const nextPage = isNewSearch ? 1 : evaluations.page + 1;

        if (!isNewSearch && evaluations.page >= evaluations.totalPages) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let path = `${apiUrl}wp/v2/lm-evaluation?context=edit&per_page=20&page=${nextPage}&orderby=date&order=desc`;
            if (searchTerm) {
                path += `&search=${encodeURIComponent(searchTerm)}`;
            }
            // Filter by archived status using meta_query
            if (!showArchived) {
                // Show only non-archived (archived = false or not set)
                path += `&meta_query[0][relation]=OR&meta_query[0][0][key]=archived&meta_query[0][0][compare]=NOT EXISTS&meta_query[0][1][key]=archived&meta_query[0][1][value]=0`;
            } else {
                // Show only archived
                path += `&meta_query[0][key]=archived&meta_query[0][value]=1`;
            }

            const response = await fetch(path, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load evaluations');
            }

            const data: Evaluation[] = await response.json();
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

            // Fetch swimmer details for evaluations not already in cache (batch fetch)
            const swimmerIds = data
                .map(e => e.meta?.swimmer)
                .filter((id): id is number => id !== undefined && id !== null && !swimmerCache.has(id));

            if (swimmerIds.length > 0) {
                const uniqueIds = [...new Set(swimmerIds)];
                try {
                    // Use batch endpoint for efficiency
                    const swimmers = await fetchSwimmersByIds(uniqueIds);
                    const newCache = new Map(swimmerCache);
                    swimmers.forEach(swimmer => {
                        if (swimmer) newCache.set(swimmer.id, swimmer as Swimmer);
                    });
                    setSwimmerCache(newCache);
                } catch (err) {
                    console.error('Failed to batch fetch swimmers:', err);
                }
            }

            setEvaluations(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages,
            }));
            
            // Clear selection on new search/filter
            if (isNewSearch) {
                setSelectedIds(new Set());
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, nonce, evaluations, searchTerm, showArchived, isLoading, swimmerCache]);

    // Load initial data
    useEffect(() => {
        if (evaluations.items.length === 0 && !isLoading) {
            loadEvaluations(true);
        }
    }, []);

    // Handle search
    useEffect(() => {
        const handler = setTimeout(() => {
            setEvaluations({ items: [], page: 0, totalPages: 1 });
            setSelectedIds(new Set());
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Handle archive filter change
    useEffect(() => {
        setEvaluations({ items: [], page: 0, totalPages: 1 });
        setSelectedIds(new Set());
    }, [showArchived]);

    // Reload when evaluations reset
    useEffect(() => {
        if (evaluations.items.length === 0 && !isLoading && evaluations.page === 0) {
            loadEvaluations(true);
        }
    }, [evaluations.items.length]);
    
    // Infinite scroll with Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoading && evaluations.page < evaluations.totalPages) {
                    loadEvaluations();
                }
            },
            { threshold: 0.1 }
        );
        
        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }
        
        return () => observer.disconnect();
    }, [isLoading, evaluations.page, evaluations.totalPages, loadEvaluations]);

    const getLevelName = (levelId: number | ''): string => {
        if (!levelId) return 'Unknown Level';
        const level = levels.find(l => l.id === levelId);
        return decodeHTMLEntities(level?.title?.rendered) || 'Unknown Level';
    };

    const getSwimmerName = (swimmerId: number): string => {
        const swimmer = swimmerCache.get(swimmerId);
        return decodeHTMLEntities(swimmer?.title?.rendered) || 'Unknown Swimmer';
    };

    const formatDate = (dateStr: string): string => {
        if (!dateStr) return 'No date';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Toggle selection for bulk operations
    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select/deselect all visible evaluations
    const toggleSelectAll = () => {
        if (selectedIds.size === evaluations.items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(evaluations.items.map(e => e.id)));
        }
    };

    // Bulk archive selected evaluations
    const handleBulkArchive = async () => {
        if (selectedIds.size === 0) return;
        
        setIsBulkArchiving(true);
        setError(null);
        
        try {
            const archivePromises = Array.from(selectedIds).map(id =>
                fetch(`${apiUrl}wp/v2/lm-evaluation/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': nonce,
                    },
                    body: JSON.stringify({
                        meta: { archived: !showArchived } // Toggle based on current view
                    }),
                })
            );
            
            await Promise.all(archivePromises);
            
            // Reload to reflect changes
            setSelectedIds(new Set());
            setEvaluations({ items: [], page: 0, totalPages: 1 });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive evaluations');
        } finally {
            setIsBulkArchiving(false);
        }
    };

    // Archive/unarchive single evaluation
    const handleToggleArchive = async (evaluation: Evaluation) => {
        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-evaluation/${evaluation.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    meta: { archived: !evaluation.meta?.archived }
                }),
            });
            
            if (!response.ok) throw new Error('Failed to update evaluation');
            
            // Remove from current view (it will appear in the other view)
            setEvaluations(prev => ({
                ...prev,
                items: prev.items.filter(e => e.id !== evaluation.id),
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive evaluation');
        }
    };

    // Open modal for creating new evaluation
    const handleAddNew = () => {
        setEditingEvaluation(null);
        setFormData(emptyFormData);
        setFormError(null);
        setSelectedSwimmer(null);
        setSwimmerSearchTerm('');
        setSwimmerSearchResults([]);
        setIsModalOpen(true);
    };

    // Open modal for editing existing evaluation
    const handleEdit = async (evaluation: Evaluation) => {
        setEditingEvaluation(evaluation);
        setFormData({
            swimmer: evaluation.meta?.swimmer || '',
            level_evaluated: evaluation.meta?.level_evaluated || '',
            skills_completed: [], // Skills completed stored on swimmer, not evaluation
            content: stripHtmlAndDecode(evaluation.content?.rendered || evaluation.meta?.content || ''),
            emailed: evaluation.meta?.emailed || false,
        });
        setFormError(null);
        setSwimmerSearchTerm('');
        setSwimmerSearchResults([]);
        setIsModalOpen(true);
        
        // Load swimmer details for display
        const swimmerId = evaluation.meta?.swimmer;
        if (swimmerId) {
            // Check cache first
            const cached = swimmerCache.get(swimmerId);
            if (cached) {
                setSelectedSwimmer(cached);
            } else {
                try {
                    const swimmers = await fetchSwimmersByIds([swimmerId]);
                    if (swimmers[0]) {
                        setSelectedSwimmer(swimmers[0] as Swimmer);
                        // Also add to cache for next time
                        setSwimmerCache(prev => {
                            const newCache = new Map(prev);
                            newCache.set(swimmerId, swimmers[0] as Swimmer);
                            return newCache;
                        });
                    }
                } catch (err) {
                    console.error('Error loading swimmer for edit:', err);
                }
            }
        }
    };

    // Close modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEvaluation(null);
        setFormData(emptyFormData);
        setFormError(null);
        setSelectedSwimmer(null);
        setSwimmerSearchTerm('');
        setSwimmerSearchResults([]);
    };

    // Handle form field change
    const handleFieldChange = (field: keyof EvaluationFormData, value: unknown) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save evaluation (create or update)
    const handleSave = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Validate required fields
        if (!formData.swimmer) {
            setFormError('Please select a swimmer');
            return;
        }
        if (!formData.level_evaluated) {
            setFormError('Please select a level');
            return;
        }

        setIsSaving(true);
        setFormError(null);

        try {
            const isEditing = !!editingEvaluation;
            const url = isEditing 
                ? `${apiUrl}wp/v2/lm-evaluation/${editingEvaluation.id}`
                : `${apiUrl}wp/v2/lm-evaluation`;
            
            // Generate title from swimmer name and level
            const swimmerName = getSwimmerName(formData.swimmer as number);
            const levelName = getLevelName(formData.level_evaluated);
            const title = `${swimmerName} - ${levelName} Evaluation`;
            
            const body: Record<string, unknown> = {
                title,
                content: formData.content,
                status: 'publish',
                meta: {
                    swimmer: formData.swimmer,
                    level_evaluated: formData.level_evaluated,
                    emailed: formData.emailed,
                },
            };

            // Include original_modified for conflict detection on updates
            if (isEditing && editingEvaluation.modified_gmt) {
                body.original_modified = editingEvaluation.modified_gmt;
            }

            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'create'} evaluation`);
            }

            const savedEvaluation = await response.json();

            // Update local state
            if (isEditing) {
                setEvaluations(prev => ({
                    ...prev,
                    items: prev.items.map(e => e.id === savedEvaluation.id ? savedEvaluation : e),
                }));
            } else {
                // Reload to get the new evaluation in proper position
                setEvaluations({ items: [], page: 0, totalPages: 1 });
            }

            handleCloseModal();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete evaluation
    const handleDelete = async () => {
        if (!deleteConfirm) return;

        setIsDeleting(true);

        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-evaluation/${deleteConfirm.id}?force=true`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete evaluation');
            }

            // Remove from local state
            setEvaluations(prev => ({
                ...prev,
                items: prev.items.filter(e => e.id !== deleteConfirm.id),
            }));

            setDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete evaluation');
            setDeleteConfirm(null);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="ap-p-6">
            {/* Header with search, filters, and add button */}
            <div className="ap-flex ap-flex-col ap-gap-4 ap-mb-6">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                    <div className="ap-relative ap-flex-1 ap-max-w-md">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search evaluations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                        />
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-3">
                        {/* Archive filter toggle */}
                        <Button
                            variant="ghost"
                            onClick={() => setShowArchived(!showArchived)}
                            className={`ap-flex ap-items-center ap-gap-2 !ap-px-4 !ap-py-2.5 !ap-rounded-lg ap-font-medium ap-transition-all ${
                                showArchived
                                    ? '!ap-bg-amber-100 !ap-text-amber-700 !ap-border !ap-border-amber-300' : '!ap-bg-gray-100 !ap-text-gray-600 !ap-border !ap-border-gray-200 hover:!ap-bg-gray-200'
                            }`}
                        >
                            <HiOutlineArchiveBox className="ap-w-5 ap-h-5" />
                            <span>{showArchived ? 'Showing Archived' : 'Show Archived'}</span>
                        </Button>
                        {canCreate && (
                            <Button
                                variant="lesson-evaluations"
                                onClick={handleAddNew}
                                className="ap-flex ap-items-center ap-gap-2 !ap-px-4 !ap-py-2.5 !ap-bg-gradient-to-r !ap-from-violet-500 !ap-to-purple-500 !ap-text-white !ap-rounded-lg ap-font-medium hover:!ap-shadow-lg ap-transition-all"
                            >
                                <HiOutlinePlus className="ap-w-5 ap-h-5" />
                                <span>New Evaluation</span>
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Bulk actions bar */}
                {evaluations.items.length > 0 && (
                    <div className="ap-flex ap-items-center ap-gap-4 ap-px-4 ap-py-2 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200">
                        <label className="ap-flex ap-items-center ap-gap-2 ap-cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedIds.size === evaluations.items.length && evaluations.items.length > 0}
                                onChange={toggleSelectAll}
                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-violet-500 focus:ap-ring-violet-500"
                            />
                            <span className="ap-text-sm ap-text-gray-600">
                                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                            </span>
                        </label>
                        {selectedIds.size > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBulkArchive}
                                disabled={isBulkArchiving}
                                className={`ap-flex ap-items-center ap-gap-2 !ap-px-3 !ap-py-1.5 ap-text-sm ap-font-medium !ap-rounded-lg ap-transition-colors ${
                                    showArchived
                                        ? '!ap-text-green-700 !ap-bg-green-100 hover:!ap-bg-green-200' : '!ap-text-amber-700 !ap-bg-amber-100 hover:!ap-bg-amber-200'
                                } disabled:ap-opacity-50`}
                            >
                                {isBulkArchiving ? (
                                    <LoadingSpinner />
                                ) : showArchived ? (
                                    <HiOutlineArchiveBoxXMark className="ap-w-4 ap-h-4" />
                                ) : (
                                    <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />
                                )}
                                <span>{showArchived ? 'Unarchive Selected' : 'Archive Selected'}</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-mb-6 ap-flex ap-items-center ap-justify-between">
                    <span>{error}</span>
                    <Button variant="ghost" size="xs" onClick={() => setError(null)} className="!ap-p-1.5 !ap-min-h-0 ap-text-red-400 hover:ap-text-red-600">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}

            {/* Evaluations list */}
            <div className="ap-space-y-3">
                {evaluations.items.map((evaluation) => (
                    <div
                        key={evaluation.id}
                        className={`ap-bg-gray-50 ap-rounded-xl ap-p-4 ap-border ap-transition-all ${
                            selectedIds.has(evaluation.id)
                                ? 'ap-border-violet-500 ap-bg-violet-50/30' : 'ap-border-gray-200 hover:ap-border-violet-500/50 hover:ap-shadow-md'
                        }`}
                    >
                        <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-3">
                            <div className="ap-flex ap-items-start ap-gap-3 ap-flex-1 ap-min-w-0">
                                {/* Selection checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(evaluation.id)}
                                    onChange={() => toggleSelection(evaluation.id)}
                                    className="ap-mt-1 ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-violet-500 focus:ap-ring-violet-500"
                                />
                                <div className="ap-flex-1 ap-min-w-0">
                                    <div className="ap-flex ap-items-center ap-gap-2 ap-mb-1">
                                        <HiOutlineUser className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-900">
                                            {evaluation.meta?.swimmer 
                                                ? getSwimmerName(evaluation.meta.swimmer)
                                                : evaluation.swimmer_name || 'Unknown Swimmer'}
                                        </h3>
                                    </div>
                                    <div className="ap-flex ap-flex-wrap ap-gap-x-4 ap-gap-y-1 ap-text-sm ap-text-gray-600">
                                        {evaluation.meta?.level_evaluated && (
                                            <div className="ap-flex ap-items-center ap-gap-1.5">
                                                <HiOutlineAcademicCap className="ap-w-4 ap-h-4 ap-text-violet-500" />
                                                <span>{getLevelName(evaluation.meta.level_evaluated)}</span>
                                            </div>
                                        )}
                                        {evaluation.date && (
                                            <div className="ap-flex ap-items-center ap-gap-1.5">
                                                <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                                <span>{formatDate(evaluation.date)}</span>
                                            </div>
                                        )}
                                        {evaluation.author_name && (
                                            <div className="ap-flex ap-items-center ap-gap-1.5">
                                                <HiOutlineUser className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                                <span>by {evaluation.author_name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="ap-flex ap-items-center ap-gap-2 ap-flex-shrink-0">
                                {evaluation.meta?.emailed ? (
                                    <span className="ap-flex ap-items-center ap-gap-1 ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-700 ap-rounded-full">
                                        <HiOutlineCheckCircle className="ap-w-3.5 ap-h-3.5" />
                                        Sent
                                    </span>
                                ) : (
                                    <span className="ap-flex ap-items-center ap-gap-1 ap-px-3 ap-py-1 ap-text-xs ap-font-medium ap-bg-amber-100 ap-text-amber-700 ap-rounded-full">
                                        <HiOutlineEnvelope className="ap-w-3.5 ap-h-3.5" />
                                        Not Sent
                                    </span>
                                )}
                                {/* Archive/Unarchive button */}
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => handleToggleArchive(evaluation)}
                                    className={`!ap-p-2 !ap-min-h-0 !ap-rounded-lg ap-transition-colors ${
                                        showArchived
                                            ? '!ap-text-green-600 hover:!ap-bg-green-50' : '!ap-text-amber-600 hover:!ap-bg-amber-50'
                                    }`}
                                    title={showArchived ? 'Unarchive evaluation' : 'Archive evaluation'}
                                >
                                    {showArchived ? (
                                        <HiOutlineArchiveBoxXMark className="ap-w-5 ap-h-5" />
                                    ) : (
                                        <HiOutlineArchiveBox className="ap-w-5 ap-h-5" />
                                    )}
                                </Button>
                                {canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleEdit(evaluation)}
                                        className="!ap-p-2 !ap-min-h-0 ap-text-blue-600 hover:ap-bg-blue-50 !ap-rounded-lg ap-transition-colors"
                                        title="Edit evaluation"
                                    >
                                        <HiOutlinePencil className="ap-w-5 ap-h-5" />
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setDeleteConfirm(evaluation)}
                                        className="!ap-p-2 !ap-min-h-0 ap-text-red-600 hover:ap-bg-red-50 !ap-rounded-lg ap-transition-colors"
                                        title="Delete evaluation"
                                    >
                                        <HiOutlineTrash className="ap-w-5 ap-h-5" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Content preview */}
                        {(evaluation.content?.rendered || evaluation.meta?.content) && (
                            <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-200">
                                <p className="ap-text-sm ap-text-gray-600 line-clamp-2">
                                    {evaluation.content?.rendered?.replace(/<[^>]+>/g, '') || evaluation.meta?.content}
                                </p>
                            </div>
                        )}
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
            {!isLoading && evaluations.items.length === 0 && !error && (
                <div className="ap-text-center ap-py-12">
                    <HiOutlineDocumentText className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No evaluations found</h3>
                    <p className="ap-text-gray-500 ap-mb-4">
                        {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first evaluation'}
                    </p>
                    {canCreate && !searchTerm && (
                        <Button
                            variant="lesson-evaluations"
                            onClick={handleAddNew}
                            className="ap-inline-flex ap-items-center ap-gap-2 !ap-px-4 !ap-py-2 !ap-bg-violet-500 !ap-text-white !ap-rounded-lg ap-font-medium hover:!ap-bg-violet-600 ap-transition-colors"
                        >
                            <HiOutlinePlus className="ap-w-5 ap-h-5" />
                            Create First Evaluation
                        </Button>
                    )}
                </div>
            )}

            {/* Load more button */}
            {!isLoading && evaluations.page < evaluations.totalPages && evaluations.items.length > 0 && (
                <div className="ap-flex ap-justify-center ap-mt-6">
                    <Button
                        variant="ghost"
                        onClick={() => loadEvaluations()}
                        className="!ap-px-6 !ap-py-2.5 ap-text-violet-600 ap-font-medium hover:ap-bg-violet-50 !ap-rounded-lg ap-transition-colors"
                    >
                        Load More
                    </Button>
                </div>
            )}

            {/* Create/Edit Slide-over Panel */}
            {isModalOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-hidden">
                    {/* Backdrop - hidden on mobile */}
                    <div 
                        className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                        onClick={handleCloseModal}
                    />
                    
                    {/* Panel - full screen on mobile, slide-over on desktop */}
                    <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                        <div className="ap-w-full md:ap-w-screen md:ap-max-w-xl ap-transform ap-transition-transform ap-duration-300 ap-flex ap-flex-col ap-h-full md:ap-h-auto md:ap-max-h-screen">
                            <div className="ap-flex ap-flex-col ap-bg-white ap-shadow-xl ap-h-full md:ap-h-auto md:ap-max-h-screen md:ap-my-4 md:ap-mr-4 md:ap-rounded-xl ap-overflow-hidden">
                                {/* Header */}
                                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-violet-500 ap-to-purple-500">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseModal}
                                        className="md:ap-hidden !ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10 !ap-rounded-lg ap-transition-colors"
                                    >
                                        <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <div className="ap-flex-1">
                                        <h2 className="ap-text-lg md:ap-text-xl ap-font-semibold ap-text-white">
                                            {editingEvaluation ? 'Edit Evaluation' : 'New Evaluation'}
                                        </h2>
                                        {editingEvaluation?.author_name && (
                                            <p className="ap-text-sm ap-text-white/80 ap-mt-0.5">
                                                Created by {editingEvaluation.author_name}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseModal}
                                        className="ap-hidden md:ap-block !ap-p-2 !ap-min-h-0 ap-text-white/80 hover:ap-text-white !ap-rounded-lg ap-transition-colors"
                                    >
                                        <HiOutlineXMark className="ap-w-6 ap-h-6" />
                                    </Button>
                                </div>

                                {/* Form - scrollable */}
                                <div className="ap-flex-1 ap-overflow-y-auto ap-p-4 md:ap-p-6 ap-space-y-5">
                                    {formError && (
                                        <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                            <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                            {formError}
                                        </div>
                                    )}

                                    {/* Swimmer Selection - AJAX Search */}
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Swimmer <span className="ap-text-red-500">*</span>
                                        </label>
                                        
                                        {/* Show selected swimmer or search input */}
                                        {formData.swimmer && selectedSwimmer ? (
                                            <div className="ap-flex ap-items-center ap-gap-2 ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 ap-bg-gray-50">
                                                <HiOutlineUser className="ap-w-5 ap-h-5 ap-text-violet-500" />
                                                <span className="ap-flex-1 ap-font-medium">
                                                    {decodeHTMLEntities(selectedSwimmer.title?.rendered)}
                                                </span>
                                                {!editingEvaluation && (
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSwimmer(null);
                                                            setFormData(prev => ({ ...prev, swimmer: '', level_evaluated: '' }));
                                                            setSwimmerSearchTerm('');
                                                            setSwimmerSearchResults([]);
                                                        }}
                                                        className="!ap-p-1 !ap-min-h-0 ap-text-gray-400 hover:ap-text-red-500 !ap-rounded"
                                                    >
                                                        <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ) : editingEvaluation ? (
                                            <div className="ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 ap-bg-gray-100 ap-text-gray-500">
                                                Loading swimmer...
                                            </div>
                                        ) : (
                                            <div className="ap-relative">
                                                <div className="ap-relative">
                                                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={swimmerSearchTerm}
                                                        onChange={(e) => handleSwimmerSearch(e.target.value)}
                                                        placeholder="Search swimmers by name..."
                                                        className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-violet-500 focus:ap-ring-2 focus:ap-ring-violet-500/20 ap-transition-colors"
                                                    />
                                                    {isSearchingSwimmers && (
                                                        <div className="ap-absolute ap-right-3 ap-top-1/2 -ap-translate-y-1/2">
                                                            <svg className="ap-animate-spin ap-w-5 ap-h-5 ap-text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Search Results Dropdown */}
                                                {swimmerSearchResults.length > 0 && (
                                                    <div className="ap-absolute ap-z-10 ap-w-full ap-mt-1 ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-shadow-lg ap-max-h-60 ap-overflow-y-auto">
                                                        {swimmerSearchResults.map(swimmer => (
                                                            <Button
                                                                key={swimmer.id}
                                                                variant="ghost"
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedSwimmer(swimmer);
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        swimmer: swimmer.id,
                                                                        level_evaluated: swimmer.meta?.current_level || prev.level_evaluated,
                                                                    }));
                                                                    setSwimmerSearchTerm('');
                                                                    setSwimmerSearchResults([]);
                                                                }}
                                                                className="!ap-w-full !ap-px-4 !ap-py-2.5 !ap-text-left !ap-justify-start hover:!ap-bg-violet-50 ap-flex ap-items-center ap-gap-3 !ap-border-b !ap-border-gray-100 last:!ap-border-b-0 !ap-rounded-none"
                                                            >
                                                                <HiOutlineUser className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                                                <div className="ap-flex-1 ap-min-w-0">
                                                                    <div className="ap-font-medium ap-text-gray-900 ap-truncate">
                                                                        {decodeHTMLEntities(swimmer.title?.rendered)}
                                                                    </div>
                                                                    {swimmer.meta?.current_level && (
                                                                        <div className="ap-text-xs ap-text-gray-500">
                                                                            Level: {getLevelName(swimmer.meta.current_level)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {swimmerSearchTerm.length >= 2 && !isSearchingSwimmers && swimmerSearchResults.length === 0 && (
                                                    <div className="ap-absolute ap-z-10 ap-w-full ap-mt-1 ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-shadow-lg ap-px-4 ap-py-3 ap-text-sm ap-text-gray-500">
                                                        No swimmers found matching "{swimmerSearchTerm}"
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                            Level Evaluated <span className="ap-text-red-500">*</span>
                                        </label>
                                        <div className="ap-flex ap-flex-wrap ap-gap-2">
                                            {levels.map(level => {
                                                const isSelected = formData.level_evaluated === level.id;
                                                return (
                                                    <Button
                                                        key={level.id}
                                                        variant="ghost"
                                                        size="sm"
                                                        type="button"
                                                        onClick={() => handleFieldChange('level_evaluated', isSelected ? '' : level.id)}
                                                        className={`!ap-px-4 !ap-py-2 !ap-rounded-lg ap-text-sm ap-font-medium ap-transition-all ${
                                                            isSelected
                                                                ? '!ap-bg-violet-500 !ap-text-white ap-shadow-md ap-ring-2 ap-ring-violet-500 ap-ring-offset-2' : '!ap-bg-gray-100 !ap-text-gray-700 hover:!ap-bg-gray-200'
                                                        }`}
                                                    >
                                                        {decodeHTMLEntities(level.title?.rendered)}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Skills for selected level (only for new evaluations) */}
                                    {formData.swimmer && selectedSwimmer && (
                                        <div>
                                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                                Swimmer's Current Progress
                                            </label>
                                            {(() => {
                                                if (!selectedSwimmer) return null;
                                                
                                                const swimmerLevel = levels.find(l => l.id === selectedSwimmer.meta?.current_level);
                                                const masteredSkills = selectedSwimmer.meta?.skills_mastered || [];
                                                const masteredSkillIds = masteredSkills.map(s => s.skill_id);
                                                
                                                // Group skills by level for display
                                                const masteredByLevel: Record<number, Skill[]> = {};
                                                masteredSkillIds.forEach(skillId => {
                                                    const skill = skills.find(s => s.id === skillId);
                                                    if (skill) {
                                                        const levelId = skill.meta?.level_associated;
                                                        if (levelId) {
                                                            if (!masteredByLevel[levelId]) {
                                                                masteredByLevel[levelId] = [];
                                                            }
                                                            masteredByLevel[levelId].push(skill);
                                                        }
                                                    }
                                                });
                                                
                                                return (
                                                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden ap-bg-gray-50">
                                                        <div className="ap-px-4 ap-py-3 ap-border-b ap-border-gray-200 ap-bg-white">
                                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                                <HiOutlineAcademicCap className="ap-w-5 ap-h-5 ap-text-violet-500" />
                                                                <span className="ap-font-medium ap-text-gray-900">
                                                                    Current Level: {decodeHTMLEntities(swimmerLevel?.title?.rendered) || 'Not set'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="ap-p-3 ap-space-y-2 ap-max-h-48 ap-overflow-y-auto">
                                                            {Object.keys(masteredByLevel).length === 0 ? (
                                                                <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-2">
                                                                    No skills mastered yet
                                                                </p>
                                                            ) : (
                                                                Object.entries(masteredByLevel).map(([levelId, levelSkills]) => {
                                                                    const level = levels.find(l => l.id === Number(levelId));
                                                                    return (
                                                                        <div key={levelId}>
                                                                            <p className="ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-1">
                                                                                {decodeHTMLEntities(level?.title?.rendered) || 'Unknown Level'}
                                                                            </p>
                                                                            <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                                {levelSkills.map(skill => (
                                                                                    <span
                                                                                        key={skill.id}
                                                                                        className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-green-100 ap-text-green-700 ap-rounded ap-text-xs"
                                                                                    >
                                                                                        <HiOutlineCheck className="ap-w-3 ap-h-3" />
                                                                                        {decodeHTMLEntities(skill.title?.rendered)}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Evaluation Notes
                                        </label>
                                        <textarea
                                            value={formData.content}
                                            onChange={(e) => handleFieldChange('content', e.target.value)}
                                            rows={5}
                                            className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-violet-500 focus:ap-ring-2 focus:ap-ring-violet-500/20 ap-transition-colors ap-resize-none"
                                            placeholder="Add notes about this evaluation, progress, areas to work on..."
                                        />
                                    </div>

                                    {editingEvaluation && (
                                        <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600 ap-cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.emailed}
                                                onChange={(e) => handleFieldChange('emailed', e.target.checked)}
                                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-violet-500 focus:ap-ring-violet-500"
                                            />
                                            Mark as emailed to parent
                                        </label>
                                    )}
                                </div>

                                {/* Footer - Sticky */}
                                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-justify-end ap-gap-3 ap-px-4 md:ap-px-6 ap-py-3 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                    <Button
                                        variant="secondary"
                                        onClick={handleCloseModal}
                                        disabled={isSaving}
                                        className="!ap-px-4 !ap-py-2 ap-text-sm ap-text-gray-700 ap-font-medium hover:ap-bg-gray-200 !ap-rounded-lg ap-transition-colors disabled:ap-opacity-50"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="lesson-evaluations"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="!ap-px-4 !ap-py-2 ap-text-sm !ap-bg-gradient-to-r !ap-from-violet-500 !ap-to-purple-500 !ap-text-white ap-font-medium !ap-rounded-lg hover:!ap-shadow-lg ap-transition-all disabled:ap-opacity-50 ap-flex ap-items-center ap-gap-2"
                                    >
                                        {isSaving ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>{editingEvaluation ? 'Save Changes' : 'Create Evaluation'}</span>
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
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Delete Evaluation</h3>
                                        <p className="ap-text-sm ap-text-gray-500 ap-mt-1">
                                            Are you sure you want to delete this evaluation? 
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
                                    className="!ap-px-4 !ap-py-2.5 ap-text-gray-700 ap-font-medium hover:ap-bg-gray-200 !ap-rounded-lg ap-transition-colors disabled:ap-opacity-50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="lesson-evaluations"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="!ap-px-6 !ap-py-2.5 !ap-bg-red-600 !ap-text-white ap-font-medium !ap-rounded-lg hover:!ap-bg-red-700 ap-transition-colors disabled:ap-opacity-50 ap-flex ap-items-center ap-gap-2"
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
        </div>
    );
};

export default EvaluationManager;
