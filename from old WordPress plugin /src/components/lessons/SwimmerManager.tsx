import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    HiOutlinePlus,
    HiOutlineMagnifyingGlass,
    HiOutlineUser,
    HiOutlineEnvelope,
    HiOutlineCalendar,
    HiOutlineDocumentPlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineShare,
    HiOutlineDocumentText,
    HiOutlineAcademicCap,
    HiOutlineClock,
    HiOutlineArchiveBox,
    HiOutlineCheckCircle,
    HiOutlineArrowLeft
} from 'react-icons/hi2';
import { Button } from '../ui';
import LoadingSpinner from '../LoadingSpinner';
import { Swimmer, Level, Skill, SkillMastery, Evaluation } from '@/types/lessons';
import { invalidateSwimmerCache } from '@/services/swimmerCache';

// Helper to decode HTML entities in strings (e.g., &amp; -> &)
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

interface SwimmerManagerProps {
    apiUrl: string;
    nonce: string;
    editSwimmerId?: number;
    onNavigationConsumed?: () => void;
    onRequestNewEvaluation?: (swimmerId: number) => void;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

interface PaginatedData<T> {
    items: T[];
    page: number;
    totalPages: number;
}

interface SwimmerFormData {
    title: string;
    parent_name: string;
    parent_email: string;
    date_of_birth: string;
    notes: string;
    current_level: number | '';
    skills_mastered: SkillMastery[];
    levels_mastered: number[];
}

interface LevelWithSkills {
    level: Level;
    skills: Skill[];
    isMastered: boolean;
}

const emptyFormData: SwimmerFormData = {
    title: '',
    parent_name: '',
    parent_email: '',
    date_of_birth: '',
    notes: '',
    current_level: '',
    skills_mastered: [],
    levels_mastered: [],
};

const SwimmerManager: React.FC<SwimmerManagerProps> = ({ 
    apiUrl, 
    nonce, 
    editSwimmerId,
    onNavigationConsumed,
    onRequestNewEvaluation,
    canCreate = true,
    canEdit = true,
    canDelete = true
}) => {
    const [swimmers, setSwimmers] = useState<PaginatedData<Swimmer>>({ items: [], page: 0, totalPages: 1 });
    const [levels, setLevels] = useState<Level[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    // Archive filter state
    const [showArchived, setShowArchived] = useState<'active' | 'archived' | 'all'>('active');

    // Level filter state — 'all' shows everyone; 'no_level' shows unassigned; number filters by level ID
    const [levelFilter, setLevelFilter] = useState<'all' | 'no_level' | number>('all');
    
    // Multi-select state
    const [selectedSwimmers, setSelectedSwimmers] = useState<Set<number>>(new Set());
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [isBulkArchiving, setIsBulkArchiving] = useState(false);
    
    // Slide-over state
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
    const [editingSwimmer, setEditingSwimmer] = useState<Swimmer | null>(null);
    const [formData, setFormData] = useState<SwimmerFormData>(emptyFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    
    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<Swimmer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Share progress modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareExpires, setShareExpires] = useState<string | null>(null);
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    
    // Swimmer evaluations state
    const [swimmerEvaluations, setSwimmerEvaluations] = useState<Evaluation[]>([]);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [viewingEvaluation, setViewingEvaluation] = useState<Evaluation | null>(null);

    // Load levels and skills for display
    useEffect(() => {
        const loadReferenceData = async () => {
            try {
                const [levelsRes, skillsRes] = await Promise.all([
                    fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, {
                        headers: { 'X-WP-Nonce': nonce },
                    }),
                    fetch(`${apiUrl}wp/v2/lm-skill?per_page=100`, {
                        headers: { 'X-WP-Nonce': nonce },
                    })
                ]);
                
                if (levelsRes.ok) {
                    const data = await levelsRes.json();
                    const sortedData = [...data].sort((a: Level, b: Level) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setLevels(sortedData);
                }
                
                if (skillsRes.ok) {
                    const data = await skillsRes.json();
                    const sortedData = [...data].sort((a: Skill, b: Skill) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setSkills(sortedData);
                }
            } catch (err) {
                console.error('Error loading reference data:', err);
            }
        };
        loadReferenceData();
    }, [apiUrl, nonce]);

    // Force search function - bypasses loading guard for manual search triggers
    const forceSearch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSwimmers({ items: [], page: 0, totalPages: 1 });

        try {
            let path = `${apiUrl}wp/v2/lm-swimmer?context=edit&per_page=50&page=1&orderby=title&order=asc`;
            if (searchTerm) {
                path += `&search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(path, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load swimmers');
            }

            const data = await response.json();
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

            setSwimmers({
                items: data,
                page: 1,
                totalPages,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, nonce, searchTerm]);

    // Load swimmers
    const loadSwimmers = useCallback(async (reset = false) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setSwimmers({ items: [], page: 0, totalPages: 1 });
            return;
        }

        if (isLoading) return;
        
        const isNewSearch = reset || (swimmers.page === 0 && swimmers.items.length === 0);
        const nextPage = isNewSearch ? 1 : swimmers.page + 1;

        if (!isNewSearch && swimmers.page >= swimmers.totalPages) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let path = `${apiUrl}wp/v2/lm-swimmer?context=edit&per_page=50&page=${nextPage}&orderby=title&order=asc`;
            if (searchTerm) {
                path += `&search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(path, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load swimmers');
            }

            const data = await response.json();
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

            setSwimmers(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages,
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, nonce, swimmers, searchTerm, isLoading]);

    // Filter swimmers by archive status and level (client-side)
    const filteredSwimmers = useMemo(() => {
        return swimmers.items.filter(swimmer => {
            const isArchived = swimmer.meta?.archived === true;
            if (showArchived === 'active' && isArchived) return false;
            if (showArchived === 'archived' && !isArchived) return false;

            // Level filter
            if (levelFilter === 'no_level') {
                return !swimmer.meta?.current_level;
            }
            if (typeof levelFilter === 'number') {
                return swimmer.meta?.current_level === levelFilter;
            }
            return true; // 'all'
        });
    }, [swimmers.items, showArchived, levelFilter]);

    // Load initial data
    useEffect(() => {
        if (swimmers.items.length === 0 && !isLoading) {
            loadSwimmers(true);
        }
    }, []);

    // Handle search
    useEffect(() => {
        const handler = setTimeout(() => {
            setSwimmers({ items: [], page: 0, totalPages: 1 });
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Reload when swimmers reset
    useEffect(() => {
        if (swimmers.items.length === 0 && !isLoading && swimmers.page === 0) {
            loadSwimmers(true);
        }
    }, [swimmers.items.length]);

    // Handle navigation from parent (edit swimmer by ID)
    useEffect(() => {
        if (editSwimmerId && swimmers.items.length > 0) {
            const swimmer = swimmers.items.find(s => s.id === editSwimmerId);
            if (swimmer) {
                handleEdit(swimmer);
                onNavigationConsumed?.();
            } else {
                // Swimmer not in current list, fetch it directly
                const fetchSwimmer = async () => {
                    try {
                        const response = await fetch(`${apiUrl}wp/v2/lm-swimmer/${editSwimmerId}?context=edit`, {
                            headers: { 'X-WP-Nonce': nonce },
                        });
                        if (response.ok) {
                            const swimmerData = await response.json();
                            handleEdit(swimmerData);
                        }
                    } catch (err) {
                        console.error('Error fetching swimmer:', err);
                    } finally {
                        onNavigationConsumed?.();
                    }
                };
                fetchSwimmer();
            }
        }
    }, [editSwimmerId, swimmers.items]);

    // Group skills by level for the mastery section
    const levelsWithSkills = useMemo((): LevelWithSkills[] => {
        return levels.map(level => {
            const levelSkills = skills.filter(s => s.meta?.level_associated === level.id);
            const isMastered = formData.levels_mastered.includes(level.id);
            
            return {
                level,
                skills: levelSkills,
                isMastered,
            };
        });
    }, [levels, skills, formData.levels_mastered]);

    // Calculate progress for progress bar
    const progressStats = useMemo(() => {
        const totalLevels = levels.length;
        const masteredLevels = formData.levels_mastered.length;
        const totalSkills = skills.length;
        const masteredSkills = formData.skills_mastered.length;

        return {
            totalLevels,
            masteredLevels,
            totalSkills,
            masteredSkills,
            levelPercent: totalLevels > 0 ? Math.round((masteredLevels / totalLevels) * 100) : 0,
            skillPercent: totalSkills > 0 ? Math.round((masteredSkills / totalSkills) * 100) : 0
        };
    }, [levels, skills, formData.levels_mastered, formData.skills_mastered]);

    // Check if a skill is mastered
    const isSkillMastered = (skillId: number): boolean => {
        return formData.skills_mastered.some(sm => sm.skill_id === skillId);
    };

    // Get skill mastery date
    const getSkillMasteryDate = (skillId: number): string | undefined => {
        const mastery = formData.skills_mastered.find(sm => sm.skill_id === skillId);
        return mastery?.date;
    };

    // Toggle skill mastery
    const toggleSkillMastery = (skillId: number, levelId: number) => {
        const today = new Date().toISOString().split('T')[0];
        
        setFormData(prev => {
            const isCurrentlyMastered = prev.skills_mastered.some(sm => sm.skill_id === skillId);
            let newSkillsMastered: SkillMastery[];
            let newLevelsMastered = [...prev.levels_mastered];

            if (isCurrentlyMastered) {
                // Remove skill mastery
                newSkillsMastered = prev.skills_mastered.filter(sm => sm.skill_id !== skillId);
                // Also remove level mastery if it was mastered
                newLevelsMastered = newLevelsMastered.filter(id => id !== levelId);
            } else {
                // Add skill mastery with today's date
                newSkillsMastered = [...prev.skills_mastered, { skill_id: skillId, date: today }];
                
                // Check if all skills in this level are now mastered
                const levelSkillIds = skills
                    .filter(s => s.meta?.level_associated === levelId)
                    .map(s => s.id);
                const allSkillsMastered = levelSkillIds.every(id =>
                    newSkillsMastered.some(sm => sm.skill_id === id)
                );
                
                if (allSkillsMastered && !newLevelsMastered.includes(levelId)) {
                    newLevelsMastered.push(levelId);
                }
            }

            return {
                ...prev,
                skills_mastered: newSkillsMastered,
                levels_mastered: newLevelsMastered
            };
        });
    };

    // Toggle level mastery (masters/unmasters all skills in level)
    const toggleLevelMastery = (levelId: number) => {
        const today = new Date().toISOString().split('T')[0];
        const levelSkillIds = skills
            .filter(s => s.meta?.level_associated === levelId)
            .map(s => s.id);
        
        setFormData(prev => {
            const isCurrentlyMastered = prev.levels_mastered.includes(levelId);
            
            if (isCurrentlyMastered) {
                // Remove level and all its skills
                return {
                    ...prev,
                    levels_mastered: prev.levels_mastered.filter(id => id !== levelId),
                    skills_mastered: prev.skills_mastered.filter(sm => !levelSkillIds.includes(sm.skill_id))
                };
            } else {
                // Add level and all its skills
                const newSkillsMastered = [...prev.skills_mastered];
                levelSkillIds.forEach(skillId => {
                    if (!newSkillsMastered.some(sm => sm.skill_id === skillId)) {
                        newSkillsMastered.push({ skill_id: skillId, date: today });
                    }
                });
                
                return {
                    ...prev,
                    levels_mastered: [...prev.levels_mastered, levelId],
                    skills_mastered: newSkillsMastered
                };
            }
        });
    };

    const getLevelName = (levelId: number | ''): string => {
        if (!levelId) return 'Not assigned';
        const level = levels.find(l => l.id === levelId);
        return decodeHTMLEntities(level?.title?.rendered) || 'Unknown Level';
    };

    const getAge = (dob: string): string => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? `${age} years` : 'N/A';
    };

    // Open slide-over for creating new swimmer
    const handleAddNew = () => {
        setEditingSwimmer(null);
        setFormData(emptyFormData);
        setFormError(null);
        setIsSlideOverOpen(true);
    };

    // Open slide-over for editing existing swimmer
    const handleEdit = async (swimmer: Swimmer) => {
        setEditingSwimmer(swimmer);
        setFormData({
            title: swimmer.title?.rendered || '',
            parent_name: swimmer.meta?.parent_name || '',
            parent_email: swimmer.meta?.parent_email || '',
            date_of_birth: swimmer.meta?.date_of_birth || swimmer.meta?.dob || '',
            notes: swimmer.meta?.notes || '',
            current_level: swimmer.meta?.current_level || '',
            skills_mastered: swimmer.meta?.skills_mastered || [],
            levels_mastered: swimmer.meta?.levels_mastered || [],
        });
        setFormError(null);
        setSwimmerEvaluations([]);
        setIsSlideOverOpen(true);
        
        // Load evaluations for this swimmer
        setIsLoadingEvaluations(true);
        try {
            const response = await fetch(
                `${apiUrl}wp/v2/lm-evaluation?per_page=100&swimmer=${swimmer.id}`,
                { headers: { 'X-WP-Nonce': nonce } }
            );
            if (response.ok) {
                const evaluations = await response.json();
                // Sort by date descending
                evaluations.sort((a: Evaluation, b: Evaluation) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                setSwimmerEvaluations(evaluations);
            }
        } catch (err) {
            console.error('Error loading evaluations:', err);
        } finally {
            setIsLoadingEvaluations(false);
        }
    };

    // Close slide-over
    const handleCloseSlideOver = () => {
        setIsSlideOverOpen(false);
        setEditingSwimmer(null);
        setFormData(emptyFormData);
        setFormError(null);
        setSwimmerEvaluations([]);
        setViewingEvaluation(null);
    };

    // Handle form field change
    const handleFieldChange = (field: keyof SwimmerFormData, value: string | number | SkillMastery[] | number[]) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save swimmer (create or update)
    const handleSave = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        // Validate required fields
        if (!formData.title.trim()) {
            setFormError('Swimmer name is required');
            return;
        }

        setIsSaving(true);
        setFormError(null);

        try {
            const isEditing = !!editingSwimmer;
            const url = isEditing 
                ? `${apiUrl}wp/v2/lm-swimmer/${editingSwimmer.id}`
                : `${apiUrl}wp/v2/lm-swimmer`;
            
            const body: Record<string, unknown> = {
                title: formData.title.trim(),
                status: 'publish',
                meta: {
                    parent_name: formData.parent_name.trim(),
                    parent_email: formData.parent_email.trim(),
                    date_of_birth: formData.date_of_birth,
                    notes: formData.notes.trim(),
                    current_level: formData.current_level || '',
                    skills_mastered: formData.skills_mastered,
                    levels_mastered: formData.levels_mastered,
                },
            };

            // Include original_modified for conflict detection on updates
            if (isEditing && editingSwimmer.modified_gmt) {
                body.original_modified = editingSwimmer.modified_gmt;
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
                throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'create'} swimmer`);
            }

            // Invalidate swimmer cache so other components get fresh data
            invalidateSwimmerCache();
            
            // Reload swimmers list to get updated data
            setSwimmers({ items: [], page: 0, totalPages: 1 });
            handleCloseSlideOver();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete swimmer
    const handleDelete = async () => {
        if (!deleteConfirm) return;

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setIsDeleting(true);

        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-swimmer/${deleteConfirm.id}?force=true`, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete swimmer');
            }

            // Invalidate swimmer cache so other components get fresh data
            invalidateSwimmerCache();
            
            // Remove from local state
            setSwimmers(prev => ({
                ...prev,
                items: prev.items.filter(s => s.id !== deleteConfirm.id),
            }));

            setDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete swimmer');
            setDeleteConfirm(null);
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle swimmer selection
    const toggleSwimmerSelection = useCallback((swimmerId: number) => {
        setSelectedSwimmers(prev => {
            const next = new Set(prev);
            if (next.has(swimmerId)) {
                next.delete(swimmerId);
            } else {
                next.add(swimmerId);
            }
            return next;
        });
    }, []);

    // Select all visible swimmers
    const selectAllSwimmers = useCallback(() => {
        const allIds = filteredSwimmers.map(s => s.id);
        setSelectedSwimmers(new Set(allIds));
    }, [filteredSwimmers]);

    // Deselect all swimmers
    const deselectAllSwimmers = useCallback(() => {
        setSelectedSwimmers(new Set());
    }, []);

    // Cancel multi-select mode
    const cancelMultiSelect = useCallback(() => {
        setIsMultiSelectMode(false);
        setSelectedSwimmers(new Set());
    }, []);

    // Bulk archive/unarchive swimmers
    const handleBulkArchive = async (archive: boolean) => {
        if (selectedSwimmers.size === 0) return;

        setIsBulkArchiving(true);
        setError(null);

        try {
            const promises = Array.from(selectedSwimmers).map(async (swimmerId) => {
                const swimmer = swimmers.items.find(s => s.id === swimmerId);
                if (!swimmer) return;

                const response = await fetch(`${apiUrl}wp/v2/lm-swimmer/${swimmerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': nonce,
                    },
                    body: JSON.stringify({
                        meta: {
                            ...swimmer.meta,
                            archived: archive,
                        }
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to ${archive ? 'archive' : 'unarchive'} swimmer ${swimmer.title?.rendered}`);
                }

                return response.json();
            });

            const results = await Promise.all(promises);

            // Update local state with archived status
            setSwimmers(prev => ({
                ...prev,
                items: prev.items.map(s => {
                    const updated = results.find((r: Swimmer) => r?.id === s.id);
                    return updated || s;
                }),
            }));

            // Clear selection and exit multi-select mode
            setSelectedSwimmers(new Set());
            setIsMultiSelectMode(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive swimmers');
        } finally {
            setIsBulkArchiving(false);
        }
    };

    // Archive/unarchive single swimmer
    const handleToggleArchive = async (swimmer: Swimmer) => {
        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-swimmer/${swimmer.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({
                    meta: {
                        ...swimmer.meta,
                        archived: !swimmer.meta?.archived,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update swimmer');
            }

            const updatedSwimmer = await response.json();

            // Update local state
            setSwimmers(prev => ({
                ...prev,
                items: prev.items.map(s => s.id === swimmer.id ? updatedSwimmer : s),
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive swimmer');
        }
    };

    // Generate share progress link
    const handleShareProgress = async () => {
        if (!editingSwimmer) return;
        
        setIsGeneratingShare(true);
        setShareUrl(null);
        setShareExpires(null);
        setShareCopied(false);
        
        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/swimmer/${editingSwimmer.id}/share-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify({ expires_days: 30 }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to generate share link');
            }
            
            const data = await response.json();
            setShareUrl(data.share_url);
            setShareExpires(data.expires_formatted);
            setShowShareModal(true);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to generate share link');
        } finally {
            setIsGeneratingShare(false);
        }
    };

    // Copy share URL to clipboard
    const handleCopyShareUrl = async () => {
        if (!shareUrl) return;
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        }
    };

    return (
        <div className="ap-p-6">
            {/* Header with search, filters, and actions */}
            <div className="ap-flex ap-flex-col ap-gap-4 ap-mb-6">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                    <div className="ap-flex ap-flex-1 ap-gap-3 ap-items-center ap-flex-wrap">
                        <div className="ap-relative ap-flex-1 ap-max-w-md ap-min-w-[200px] ap-flex ap-gap-2">
                            <div className="ap-relative ap-flex-1">
                                <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search swimmers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            forceSearch();
                                        }
                                    }}
                                    className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="lesson-swimmers"
                                onClick={() => forceSearch()}
                                disabled={isLoading}
                            >
                                <HiOutlineMagnifyingGlass className="ap-w-5 ap-h-5" />
                                <span className="ap-hidden sm:ap-inline">Search</span>
                            </Button>
                        </div>
                        
                        {/* Archive Filter */}
                        <div className="ap-flex ap-items-center ap-bg-gray-100 ap-rounded-lg ap-p-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowArchived('active')}
                                className={showArchived === 'active'
                                    ? '!ap-bg-white !ap-text-green-700 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'}
                            >
                                Active
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowArchived('archived')}
                                className={showArchived === 'archived'
                                    ? '!ap-bg-white !ap-text-amber-700 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'}
                            >
                                Archived
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowArchived('all')}
                                className={showArchived === 'all'
                                    ? '!ap-bg-white !ap-text-gray-900 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'}
                            >
                                All
                            </Button>
                        </div>

                        {/* Level Filter */}
                        <select
                            value={levelFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'all') setLevelFilter('all');
                                else if (val === 'no_level') setLevelFilter('no_level');
                                else setLevelFilter(parseInt(val));
                            }}
                            className="ap-px-3 ap-py-2 ap-rounded-lg ap-border ap-border-gray-200 ap-text-sm ap-text-gray-700 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors ap-bg-white"
                            title="Filter by level"
                        >
                            <option value="all">All Levels</option>
                            <option value="no_level">⚠ No Level Assigned</option>
                            {levels.map(level => (
                                <option key={level.id} value={level.id}>
                                    {level.title?.rendered || level.title as unknown as string}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="ap-flex ap-items-center ap-gap-2">
                        {/* Multi-select toggle */}
                        <Button
                            variant="outline"
                            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                            className={isMultiSelectMode
                                ? '!ap-bg-green-50 !ap-border-green-300 !ap-text-green-700' : ''}
                        >
                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                            <span className="ap-text-sm">Select</span>
                        </Button>
                        
                        {canCreate && (
                            <Button
                                variant="lesson-swimmers"
                                onClick={handleAddNew}
                            >
                                <HiOutlinePlus className="ap-w-5 ap-h-5" />
                                <span>Add Swimmer</span>
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Multi-select action bar */}
                {isMultiSelectMode && (
                    <div className="ap-flex ap-items-center ap-justify-between ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-3">
                        <div className="ap-flex ap-items-center ap-gap-3">
                            <span className="ap-text-sm ap-font-medium ap-text-green-800">
                                {selectedSwimmers.size} selected
                            </span>
                            <Button
                                variant="link"
                                size="sm"
                                onClick={selectAllSwimmers}
                                className="!ap-text-green-700 hover:!ap-text-green-800"
                            >
                                Select all ({filteredSwimmers.length})
                            </Button>
                            {selectedSwimmers.size > 0 && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={deselectAllSwimmers}
                                    className="!ap-text-green-700 hover:!ap-text-green-800"
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                        <div className="ap-flex ap-items-center ap-gap-2">
                            {selectedSwimmers.size > 0 && (
                                <>
                                    {showArchived !== 'archived' && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleBulkArchive(true)}
                                            disabled={isBulkArchiving}
                                            className="!ap-bg-amber-100 !ap-text-amber-700 hover:!ap-bg-amber-200"
                                        >
                                            {isBulkArchiving ? <LoadingSpinner /> : <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />}
                                            Archive
                                        </Button>
                                    )}
                                    {showArchived !== 'active' && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleBulkArchive(false)}
                                            disabled={isBulkArchiving}
                                            className="!ap-bg-green-100 !ap-text-green-700 hover:!ap-bg-green-200"
                                        >
                                            {isBulkArchiving ? <LoadingSpinner /> : <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />}
                                            Unarchive
                                        </Button>
                                    )}
                                </>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelMultiSelect}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-mb-6 ap-flex ap-items-center ap-justify-between">
                    <span>{error}</span>
                    <Button variant="ghost" size="xs" onClick={() => setError(null)} className="!ap-text-red-400 hover:!ap-text-red-600 !ap-p-1.5 !ap-min-h-0">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            )}

            {/* Results count */}
            {!isLoading && filteredSwimmers.length > 0 && (
                <div className="ap-text-sm ap-text-gray-500 ap-mb-4">
                    Showing {filteredSwimmers.length}{' '}
                    {showArchived === 'archived' ? 'archived ' : showArchived === 'active' ? 'active ' : ''}
                    swimmer{filteredSwimmers.length !== 1 ? 's' : ''}
                    {levelFilter === 'no_level' && <span className="ap-ml-1 ap-text-amber-600 ap-font-medium">with no level assigned</span>}
                    {typeof levelFilter === 'number' && <span className="ap-ml-1 ap-text-green-700 ap-font-medium">in {getLevelName(levelFilter)}</span>}
                </div>
            )}

            {/* Swimmers list - optimized with memo */}
            <div className="ap-space-y-1.5">
                {filteredSwimmers.map((swimmer) => (
                    <div
                        key={swimmer.id}
                        className={`ap-bg-gray-50 ap-rounded-lg ap-px-3 ap-py-2 ap-border ap-border-gray-200 hover:ap-border-green-500/50 hover:ap-shadow-sm ap-transition-all ${
                            swimmer.meta?.archived ? 'ap-opacity-60' : ''
                        } ${selectedSwimmers.has(swimmer.id) ? 'ap-ring-2 ap-ring-green-500 ap-border-green-500' : ''}`}
                    >
                        <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-2">
                            <div className="ap-flex ap-items-center ap-gap-2 ap-flex-1 ap-min-w-0">
                                {/* Multi-select checkbox */}
                                {isMultiSelectMode && (
                                    <input
                                        type="checkbox"
                                        checked={selectedSwimmers.has(swimmer.id)}
                                        onChange={() => toggleSwimmerSelection(swimmer.id)}
                                        className="ap-w-4 ap-h-4 ap-text-green-600 ap-rounded ap-border-gray-300 focus:ap-ring-green-500 ap-flex-shrink-0"
                                    />
                                )}
                                <div className="ap-flex-1 ap-min-w-0">
                                    <div className="ap-flex ap-items-center ap-gap-2">
                                        <h3 className="ap-font-medium ap-text-sm ap-text-gray-900">
                                            {swimmer.title?.rendered || 'Unnamed Swimmer'}
                                        </h3>
                                        {swimmer.meta?.archived && (
                                            <span className="ap-px-1.5 ap-py-0.5 ap-text-[10px] ap-font-medium ap-bg-gray-200 ap-text-gray-600 ap-rounded">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                    <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-x-3 ap-gap-y-0.5 ap-mt-0.5 ap-text-xs ap-text-gray-600">
                                        {swimmer.meta?.parent_name && (
                                            <div className="ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineUser className="ap-w-3 ap-h-3 ap-text-gray-400 ap-flex-shrink-0" />
                                                <span className="ap-truncate">{swimmer.meta.parent_name}</span>
                                            </div>
                                        )}
                                        {swimmer.meta?.parent_email && (
                                            <div className="ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineEnvelope className="ap-w-3 ap-h-3 ap-text-gray-400 ap-flex-shrink-0" />
                                                <span className="ap-truncate ap-max-w-[180px]">{swimmer.meta.parent_email}</span>
                                            </div>
                                        )}
                                        {(swimmer.meta?.date_of_birth || swimmer.meta?.dob) && (
                                            <div className="ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineCalendar className="ap-w-3 ap-h-3 ap-text-gray-400 ap-flex-shrink-0" />
                                                <span>{getAge(swimmer.meta.date_of_birth || swimmer.meta.dob || '')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="ap-flex ap-items-center ap-gap-1 ap-flex-shrink-0">
                                {swimmer.meta?.current_level ? (
                                    <span className="ap-px-2 ap-py-0.5 ap-text-[10px] ap-font-medium ap-bg-green-100 ap-text-green-700 ap-rounded-full">
                                        {getLevelName(swimmer.meta.current_level)}
                                    </span>
                                ) : (
                                    <span className="ap-px-2 ap-py-0.5 ap-text-[10px] ap-font-medium ap-bg-amber-100 ap-text-amber-700 ap-rounded-full" title="No level assigned — swimmer needs assessment">
                                        No Level
                                    </span>
                                )}
                                {!isMultiSelectMode && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            onClick={() => handleToggleArchive(swimmer)}
                                            className="!ap-p-1.5 !ap-min-h-0"
                                            title={swimmer.meta?.archived ? 'Unarchive' : 'Archive'}
                                        >
                                            <HiOutlineArchiveBox className="ap-w-4 ap-h-4" />
                                        </Button>
                                        {onRequestNewEvaluation && (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => onRequestNewEvaluation(swimmer.id)}
                                                className="!ap-p-1.5 !ap-min-h-0 !ap-text-violet-600 hover:!ap-bg-violet-50"
                                                title="Create evaluation"
                                            >
                                                <HiOutlineDocumentPlus className="ap-w-4 ap-h-4" />
                                            </Button>
                                        )}
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => handleEdit(swimmer)}
                                                className="!ap-p-1.5 !ap-min-h-0 !ap-text-blue-600 hover:!ap-bg-blue-50"
                                                title="Edit swimmer"
                                            >
                                                <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => setDeleteConfirm(swimmer)}
                                                className="!ap-p-1.5 !ap-min-h-0 !ap-text-red-600 hover:!ap-bg-red-50"
                                                title="Delete swimmer"
                                            >
                                                <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Skills and levels mastered summary */}
                        {(swimmer.meta?.levels_mastered?.length > 0 || swimmer.meta?.skills_mastered?.length > 0) && (
                            <div className="ap-mt-1.5 ap-pt-1.5 ap-border-t ap-border-gray-200 ap-flex ap-flex-wrap ap-gap-2">
                                {swimmer.meta?.levels_mastered?.length > 0 && (
                                    <span className="ap-text-[10px] ap-text-gray-500">
                                        {swimmer.meta.levels_mastered.length} level{swimmer.meta.levels_mastered.length !== 1 ? 's' : ''} mastered
                                    </span>
                                )}
                                {swimmer.meta?.skills_mastered?.length > 0 && (
                                    <span className="ap-text-[10px] ap-text-gray-500">
                                        • {swimmer.meta.skills_mastered.length} skill{swimmer.meta.skills_mastered.length !== 1 ? 's' : ''} mastered
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Notes preview */}
                        {swimmer.meta?.notes && (
                            <div className="ap-mt-1.5 ap-pt-1.5 ap-border-t ap-border-gray-200">
                                <p className="ap-text-[10px] ap-text-gray-500 line-clamp-1">{swimmer.meta.notes}</p>
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
            {!isLoading && swimmers.items.length === 0 && !error && (
                <div className="ap-text-center ap-py-12">
                    <HiOutlineUser className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No swimmers found</h3>
                    <p className="ap-text-gray-500 ap-mb-4">
                        {searchTerm ? 'Try adjusting your search' : 'Get started by adding a new swimmer'}
                    </p>
                    {canCreate && !searchTerm && (
                        <Button
                            variant="lesson-swimmers"
                            onClick={handleAddNew}
                        >
                            <HiOutlinePlus className="ap-w-5 ap-h-5" />
                            Add Your First Swimmer
                        </Button>
                    )}
                </div>
            )}

            {/* Load more button */}
            {!isLoading && swimmers.page < swimmers.totalPages && swimmers.items.length > 0 && (
                <div className="ap-flex ap-justify-center ap-mt-6">
                    <Button
                        variant="ghost"
                        onClick={() => loadSwimmers()}
                        className="!ap-text-green-600 hover:!ap-bg-green-50"
                    >
                        Load More
                    </Button>
                </div>
            )}

            {/* Create/Edit Slide-Over */}
            {isSlideOverOpen && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-hidden">
                    {/* Backdrop - hidden on mobile */}
                    <div 
                        className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                        onClick={handleCloseSlideOver}
                    />
                    
                    {/* Slide-over panel - full screen on mobile */}
                    <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                        <div className="ap-w-full md:ap-w-screen md:ap-max-w-[60vw] ap-transform ap-transition-transform ap-duration-300 ap-flex ap-flex-col ap-h-full md:ap-h-auto md:ap-max-h-screen">
                            <div className="ap-flex ap-flex-col ap-bg-white ap-shadow-xl ap-h-full md:ap-h-auto md:ap-max-h-screen md:ap-my-4 md:ap-mr-4 md:ap-rounded-xl ap-overflow-hidden">
                            {/* Header */}
                            <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-justify-between ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-green-500 ap-to-emerald-500">
                                <div className="ap-flex ap-items-center ap-gap-3">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCloseSlideOver}
                                        className="md:ap-hidden !ap-p-1.5 !ap-min-h-0 !ap-text-white/80 hover:!ap-text-white hover:!ap-bg-white/10"
                                    >
                                        <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                                    </Button>
                                    <h2 className="ap-text-lg md:ap-text-xl ap-font-semibold ap-text-white">
                                        {editingSwimmer ? 'Edit Swimmer' : 'Add New Swimmer'}
                                    </h2>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={handleCloseSlideOver}
                                    className="ap-hidden md:!ap-block !ap-p-2 !ap-min-h-0 !ap-text-white/80 hover:!ap-text-white"
                                >
                                    <HiOutlineXMark className="ap-w-6 ap-h-6" />
                                </Button>
                            </div>

                            {/* Form - scrollable */}
                            <div className="ap-flex-1 ap-overflow-y-auto ap-p-4 md:ap-p-6 ap-space-y-5 md:ap-space-y-6">
                                {formError && (
                                    <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                        <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                        {formError}
                                    </div>
                                )}

                                {/* Swimmer Name */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Swimmer Name <span className="ap-text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => handleFieldChange('title', e.target.value)}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                        placeholder="Last Name, First Name"
                                    />
                                    <p className="ap-mt-1 ap-text-xs ap-text-gray-500">Format: Last Name, First Name</p>
                                </div>

                                {/* Parent/Guardian Name */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Parent/Guardian Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.parent_name}
                                        onChange={(e) => handleFieldChange('parent_name', e.target.value)}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                        placeholder="Enter parent's name"
                                    />
                                </div>

                                {/* Parent Email */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Parent/Guardian Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.parent_email}
                                        onChange={(e) => handleFieldChange('parent_email', e.target.value)}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                        placeholder="parent@example.com"
                                    />
                                </div>

                                {/* Date of Birth */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                    />
                                </div>

                                {/* Current Level */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Current Level
                                    </label>
                                    <select
                                        value={formData.current_level}
                                        onChange={(e) => handleFieldChange('current_level', e.target.value ? parseInt(e.target.value) : '')}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors"
                                    >
                                        <option value="">Select a level...</option>
                                        {levels.map(level => (
                                            <option key={level.id} value={level.id}>
                                                {decodeHTMLEntities(level.title?.rendered)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                                        rows={3}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-green-500 focus:ap-ring-2 focus:ap-ring-green-500/20 ap-transition-colors ap-resize-none"
                                        placeholder="Any additional notes..."
                                    />
                                </div>

                                {/* Progress Bar */}
                                {levels.length > 0 && (
                                    <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
                                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Mastery Progress</h3>
                                        
                                        {/* Visual Progress Bar */}
                                        <div className="ap-flex ap-items-center ap-gap-1 ap-mb-3">
                                            {levelsWithSkills.map((lws, index) => (
                                                <div
                                                    key={lws.level.id}
                                                    className={`ap-flex-1 ap-h-8 ap-rounded ap-flex ap-items-center ap-justify-center ap-text-xs ap-font-medium ap-transition-colors ${
                                                        lws.isMastered
                                                            ? 'ap-bg-green-500 ap-text-white'
                                                            : lws.skills.some(s => isSkillMastered(s.id))
                                                                ? 'ap-bg-yellow-400 ap-text-yellow-900' : 'ap-bg-gray-200 ap-text-gray-500'
                                                    }`}
                                                    title={decodeHTMLEntities(lws.level.title?.rendered)}
                                                >
                                                    {lws.isMastered ? '✓' : index + 1}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="ap-flex ap-justify-between ap-text-xs ap-text-gray-500">
                                            <span>{progressStats.masteredLevels} / {progressStats.totalLevels} levels</span>
                                            <span>{progressStats.masteredSkills} / {progressStats.totalSkills} skills</span>
                                        </div>
                                    </div>
                                )}

                                {/* Level & Skill Mastery Section */}
                                {levels.length > 0 && (
                                    <div>
                                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">Level & Skill Mastery</h3>
                                        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden ap-divide-y ap-divide-gray-200">
                                            {levelsWithSkills.map((lws) => (
                                                <div key={lws.level.id}>
                                                    {/* Level Header */}
                                                    <div
                                                        className={`ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-3 ap-transition-colors ${
                                                            lws.isMastered ? 'ap-bg-green-50' : 'ap-bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className="ap-flex-1 ap-text-sm ap-font-medium ap-text-gray-700">
                                                            {decodeHTMLEntities(lws.level.title?.rendered)}
                                                        </span>
                                                        <label
                                                            className="ap-flex ap-items-center ap-gap-2 ap-text-xs ap-text-gray-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={lws.isMastered}
                                                                onChange={() => toggleLevelMastery(lws.level.id)}
                                                                className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-green-600 focus:ap-ring-green-500"
                                                            />
                                                            Master Level
                                                        </label>
                                                    </div>

                                                    {/* Skills List - Always visible */}
                                                    {lws.skills.length > 0 && (
                                                        <div className="ap-bg-white ap-divide-y ap-divide-gray-100">
                                                            {lws.skills.map((skill) => {
                                                                const mastered = isSkillMastered(skill.id);
                                                                const masteryDate = getSkillMasteryDate(skill.id);
                                                                
                                                                return (
                                                                    <div
                                                                        key={skill.id}
                                                                        className="ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-2.5 ap-pl-12"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={mastered}
                                                                            onChange={() => toggleSkillMastery(skill.id, lws.level.id)}
                                                                            className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-green-600 focus:ap-ring-green-500"
                                                                        />
                                                                        <span className={`ap-flex-1 ap-text-sm ${mastered ? 'ap-text-green-700' : 'ap-text-gray-600'}`}>
                                                                            {decodeHTMLEntities(skill.title?.rendered)}
                                                                        </span>
                                                                        {masteryDate && (
                                                                            <span className="ap-text-xs ap-text-gray-400">
                                                                                {new Date(masteryDate).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {lws.skills.length === 0 && (
                                                        <div className="ap-px-4 ap-py-3 ap-pl-12 ap-text-sm ap-text-gray-400 ap-italic">
                                                            No skills defined for this level
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Evaluations Section */}
                                {editingSwimmer && (
                                    <div>
                                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-3">
                                            <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-flex ap-items-center ap-gap-2">
                                                <HiOutlineDocumentText className="ap-w-4 ap-h-4 ap-text-purple-500" />
                                                Evaluation History
                                                {swimmerEvaluations.length > 0 && (
                                                    <span className="ap-text-xs ap-bg-purple-100 ap-text-purple-600 ap-px-2 ap-py-0.5 ap-rounded-full">
                                                        {swimmerEvaluations.length}
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                        
                                        {isLoadingEvaluations ? (
                                            <div className="ap-flex ap-justify-center ap-py-4">
                                                <LoadingSpinner />
                                            </div>
                                        ) : swimmerEvaluations.length === 0 ? (
                                            <div className="ap-text-center ap-py-6 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200">
                                                <HiOutlineDocumentText className="ap-w-8 ap-h-8 ap-text-gray-300 ap-mx-auto ap-mb-2" />
                                                <p className="ap-text-sm ap-text-gray-500">No evaluations yet</p>
                                                {onRequestNewEvaluation && (
                                                    <Button
                                                        type="button"
                                                        variant="link"
                                                        size="sm"
                                                        onClick={() => onRequestNewEvaluation(editingSwimmer.id)}
                                                        className="!ap-mt-2 !ap-text-purple-600 hover:!ap-text-purple-700"
                                                    >
                                                        Create first evaluation →
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-divide-y ap-divide-gray-100 ap-overflow-hidden">
                                                {swimmerEvaluations.map(evaluation => (
                                                    <Button
                                                        key={evaluation.id}
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => setViewingEvaluation(evaluation)}
                                                        className="!ap-w-full !ap-px-4 !ap-py-3 !ap-flex !ap-items-center !ap-justify-between hover:!ap-bg-gray-50 !ap-text-left !ap-h-auto !ap-rounded-none"
                                                    >
                                                        <div className="ap-flex-1 ap-min-w-0">
                                                            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-1">
                                                                <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                                                                <span className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                                    {new Date(evaluation.date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="ap-flex ap-items-center ap-gap-3 ap-ml-6 ap-flex-wrap">
                                                                {evaluation.meta?.level_evaluated && (
                                                                    <div className="ap-flex ap-items-center ap-gap-1">
                                                                        <HiOutlineAcademicCap className="ap-w-3 ap-h-3 ap-text-purple-500" />
                                                                        <span className="ap-text-xs ap-text-purple-600">
                                                                            {getLevelName(evaluation.meta.level_evaluated)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {evaluation.author_name && (
                                                                    <span className="ap-text-xs ap-text-gray-500">
                                                                        by {evaluation.author_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <HiOutlinePencil className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer - Sticky */}
                            <div className="ap-flex-shrink-0 ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-2 ap-px-4 md:ap-px-6 ap-py-3 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                <div className="ap-flex ap-items-center ap-gap-2 ap-order-2 sm:ap-order-1">
                                    {editingSwimmer && onRequestNewEvaluation && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => {
                                                onRequestNewEvaluation(editingSwimmer.id);
                                            }}
                                            className="!ap-text-green-700 !ap-border-green-300 hover:!ap-bg-green-50"
                                        >
                                            <HiOutlineDocumentPlus className="ap-w-3.5 ap-h-3.5" />
                                            <span className="ap-hidden sm:ap-inline">Evaluation</span>
                                        </Button>
                                    )}
                                    {editingSwimmer && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={handleShareProgress}
                                            disabled={isGeneratingShare}
                                            className="!ap-text-blue-700 !ap-border-blue-300 hover:!ap-bg-blue-50"
                                            title="Share Progress"
                                        >
                                            {isGeneratingShare ? (
                                                <LoadingSpinner />
                                            ) : (
                                                <HiOutlineShare className="ap-w-3.5 ap-h-3.5" />
                                            )}
                                            <span className="ap-hidden sm:ap-inline">Share</span>
                                        </Button>
                                    )}
                                </div>
                                <div className="ap-flex ap-items-center ap-justify-end ap-gap-2 ap-order-1 sm:ap-order-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleCloseSlideOver}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="lesson-swimmers"
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>{editingSwimmer ? 'Save' : 'Add Swimmer'}</span>
                                        )}
                                    </Button>
                                </div>
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
                                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Delete Swimmer</h3>
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
                                    variant="lesson-swimmers"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="!ap-bg-red-600 hover:!ap-bg-red-700"
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

            {/* Share Progress Modal */}
            {showShareModal && shareUrl && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-y-auto">
                    <div className="ap-flex ap-min-h-full ap-items-center ap-justify-center ap-p-4">
                        {/* Backdrop */}
                        <div 
                            className="ap-fixed ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                            onClick={() => setShowShareModal(false)}
                        />
                        
                        {/* Modal */}
                        <div className="ap-relative ap-bg-white ap-rounded-2xl ap-shadow-xl ap-w-full ap-max-w-md ap-p-6">
                            <div className="ap-flex ap-items-center ap-gap-3 ap-mb-4">
                                <div className="ap-flex-shrink-0 ap-w-12 ap-h-12 ap-bg-blue-100 ap-rounded-full ap-flex ap-items-center ap-justify-center">
                                    <HiOutlineShare className="ap-w-6 ap-h-6 ap-text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Share Progress Link</h3>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        {editingSwimmer?.title?.rendered}
                                    </p>
                                </div>
                            </div>
                            
                            <p className="ap-text-sm ap-text-gray-600 ap-mb-4">
                                Share this link with parents to let them view their swimmer's progress without logging in.
                            </p>
                            
                            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-3 ap-mb-4">
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="ap-flex-1 ap-bg-transparent ap-text-sm ap-text-gray-700 ap-border-none focus:ap-ring-0 ap-p-0"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleCopyShareUrl}
                                        className={shareCopied 
                                            ? '!ap-bg-green-100 !ap-text-green-700' : '!ap-bg-blue-100 !ap-text-blue-700 hover:!ap-bg-blue-200'}
                                    >
                                        {shareCopied ? 'Copied!' : 'Copy'}
                                    </Button>
                                </div>
                            </div>
                            
                            {shareExpires && (
                                <p className="ap-text-xs ap-text-gray-500 ap-mb-4">
                                    This link expires on {shareExpires}
                                </p>
                            )}
                            
                            <div className="ap-flex ap-justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowShareModal(false)}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Evaluation View Slide-over */}
            {viewingEvaluation && (
                <div className="ap-fixed ap-inset-0 ap-z-[60] ap-overflow-hidden">
                    {/* Backdrop */}
                    <div 
                        className="ap-absolute ap-inset-0 ap-bg-black/50 ap-transition-opacity"
                        onClick={() => setViewingEvaluation(null)}
                    />
                    
                    {/* Slide-over panel */}
                    <div className="ap-absolute ap-inset-y-0 ap-right-0 ap-flex ap-max-w-full ap-pl-10 sm:ap-pl-16">
                        <div className="ap-w-screen ap-max-w-md ap-transform ap-transition-transform ap-duration-300">
                            <div className="ap-flex ap-h-full ap-flex-col ap-bg-white ap-shadow-xl">
                                {/* Header */}
                                <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-purple-500 ap-to-violet-500">
                                    <h2 className="ap-text-lg ap-font-semibold ap-text-white">Evaluation Details</h2>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setViewingEvaluation(null)}
                                        className="!ap-p-2 !ap-min-h-0 !ap-text-white/80 hover:!ap-text-white"
                                    >
                                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="ap-flex-1 ap-overflow-y-auto ap-p-6 ap-space-y-5">
                                    {/* Date */}
                                    <div>
                                        <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-mb-1">
                                            Date
                                        </label>
                                        <p className="ap-text-gray-900 ap-font-medium">
                                            {new Date(viewingEvaluation.date).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>

                                    {/* Level Evaluated */}
                                    {viewingEvaluation.meta?.level_evaluated && (
                                        <div>
                                            <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-mb-1">
                                                Level Evaluated
                                            </label>
                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                <HiOutlineAcademicCap className="ap-w-5 ap-h-5 ap-text-purple-500" />
                                                <span className="ap-text-gray-900 ap-font-medium">
                                                    {getLevelName(viewingEvaluation.meta.level_evaluated)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Conducted By */}
                                    {viewingEvaluation.author_name && (
                                        <div>
                                            <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-mb-1">
                                                Conducted By
                                            </label>
                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                <HiOutlineUser className="ap-w-5 ap-h-5 ap-text-gray-500" />
                                                <span className="ap-text-gray-900 ap-font-medium">
                                                    {viewingEvaluation.author_name}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div>
                                        <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-mb-1">
                                            Evaluation Notes
                                        </label>
                                        {viewingEvaluation.content?.rendered ? (
                                            <div 
                                                className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: viewingEvaluation.content.rendered }}
                                            />
                                        ) : (
                                            <p className="ap-text-gray-400 ap-italic">No notes recorded</p>
                                        )}
                                    </div>

                                    {/* Email Status */}
                                    <div>
                                        <label className="ap-block ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider ap-mb-1">
                                            Email Status
                                        </label>
                                        {viewingEvaluation.meta?.emailed ? (
                                            <span className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-green-100 ap-text-green-700 ap-text-sm ap-rounded-full">
                                                <HiOutlineEnvelope className="ap-w-4 ap-h-4" />
                                                Sent to parent
                                            </span>
                                        ) : (
                                            <span className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-gray-100 ap-text-gray-600 ap-text-sm ap-rounded-full">
                                                <HiOutlineEnvelope className="ap-w-4 ap-h-4" />
                                                Not yet sent
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setViewingEvaluation(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SwimmerManager;
