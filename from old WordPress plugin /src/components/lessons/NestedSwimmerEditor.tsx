import React, { useState, useEffect, useMemo } from 'react';
import {
    HiOutlineArrowLeft,
    HiOutlineXMark,
    HiOutlineExclamationTriangle,
    HiOutlineDocumentPlus,
    HiOutlineCheck,
    HiOutlineShare,
    HiOutlineAcademicCap,
    HiOutlineDocumentText,
    HiOutlineClock,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineUser
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Button } from '../ui';
import { Swimmer, Level, Skill, SkillMastery, Evaluation } from '@/types/lessons';

interface NestedSwimmerEditorProps {
    apiUrl: string;
    nonce: string;
    swimmerId: number;
    onClose: () => void;
    onSwimmerUpdated?: (swimmer: Swimmer) => void;
    showEvaluationForm?: boolean;
    onEvaluationCreated?: (evaluation: Evaluation) => void;
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
    isExpanded: boolean;
    isMastered: boolean;
    masteredDate?: string;
}

// Helper to decode HTML entities in strings (e.g., &amp; -> &)
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const NestedSwimmerEditor: React.FC<NestedSwimmerEditorProps> = ({
    apiUrl,
    nonce,
    swimmerId,
    onClose,
    onSwimmerUpdated,
    showEvaluationForm: initialShowEval = false,
    onEvaluationCreated
}) => {
    // Swimmer form state
    const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
    const [formData, setFormData] = useState<SwimmerFormData>({
        title: '',
        parent_name: '',
        parent_email: '',
        date_of_birth: '',
        notes: '',
        current_level: '',
        skills_mastered: [],
        levels_mastered: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Levels and skills data
    const [levels, setLevels] = useState<Level[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);

    // Nested evaluation form state
    const [showEvalForm, setShowEvalForm] = useState(initialShowEval);
    const [evalContent, setEvalContent] = useState('');
    const [evalLevel, setEvalLevel] = useState<number | ''>('');
    const [isSavingEval, setIsSavingEval] = useState(false);
    const [evalError, setEvalError] = useState<string | null>(null);
    
    // Evaluation history state
    const [swimmerEvaluations, setSwimmerEvaluations] = useState<Evaluation[]>([]);
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
    const [expandedEvalId, setExpandedEvalId] = useState<number | null>(null);

    // Share progress modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareExpires, setShareExpires] = useState<string | null>(null);
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);

    // Helper to resolve level name from ID
    const getLevelName = (levelId: number): string => {
        const level = levels.find(l => l.id === levelId);
        return level ? decodeHTMLEntities(level.title?.rendered) : 'Unknown Level';
    };

    // Load swimmer data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load swimmer, levels, and skills in parallel
                const [swimmerRes, levelsRes, skillsRes] = await Promise.all([
                    fetch(`${apiUrl}wp/v2/lm-swimmer/${swimmerId}?context=edit`, {
                        headers: { 'X-WP-Nonce': nonce }
                    }),
                    fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, {
                        headers: { 'X-WP-Nonce': nonce }
                    }),
                    fetch(`${apiUrl}wp/v2/lm-skill?per_page=100`, {
                        headers: { 'X-WP-Nonce': nonce }
                    })
                ]);

                if (!swimmerRes.ok) throw new Error('Failed to load swimmer');

                const swimmerData = await swimmerRes.json();
                const levelsData = await levelsRes.json();
                const skillsData = await skillsRes.json();

                // Sort levels and skills by sort_order
                const sortedLevels = [...levelsData].sort((a: Level, b: Level) =>
                    (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                );
                const sortedSkills = [...skillsData].sort((a: Skill, b: Skill) =>
                    (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                );

                setSwimmer(swimmerData);
                setLevels(sortedLevels);
                setSkills(sortedSkills);

                // Populate form data
                setFormData({
                    title: swimmerData.title?.rendered || '',
                    parent_name: swimmerData.meta?.parent_name || '',
                    parent_email: swimmerData.meta?.parent_email || '',
                    date_of_birth: swimmerData.meta?.date_of_birth || swimmerData.meta?.dob || '',
                    notes: swimmerData.meta?.notes || '',
                    current_level: swimmerData.meta?.current_level || '',
                    skills_mastered: swimmerData.meta?.skills_mastered || [],
                    levels_mastered: swimmerData.meta?.levels_mastered || []
                });

                // Set default evaluation level
                if (swimmerData.meta?.current_level) {
                    setEvalLevel(swimmerData.meta.current_level);
                }
            } catch (err) {
                setFormError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [apiUrl, nonce, swimmerId]);

    // Load evaluations for this swimmer
    useEffect(() => {
        const loadEvaluations = async () => {
            setIsLoadingEvaluations(true);
            try {
                const response = await fetch(
                    `${apiUrl}wp/v2/lm-evaluation?per_page=100&swimmer=${swimmerId}&_fields=id,title,date,content,meta,author_name`,
                    { headers: { 'X-WP-Nonce': nonce } }
                );
                if (response.ok) {
                    const evaluations: Evaluation[] = await response.json();
                    evaluations.sort((a, b) =>
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

        loadEvaluations();
    }, [apiUrl, nonce, swimmerId]);

    // Group skills by level
    const levelsWithSkills = useMemo((): LevelWithSkills[] => {
        return levels.map(level => {
            const levelSkills = skills.filter(s => s.meta?.level_associated === level.id);
            const isMastered = formData.levels_mastered.includes(level.id);
            
            return {
                level,
                skills: levelSkills,
                isExpanded: true, // Always expanded
                isMastered,
                masteredDate: undefined // TODO: track level mastery dates
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

    // Handle form field changes
    const handleFieldChange = (field: keyof SwimmerFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Save swimmer
    const handleSave = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!formData.title.trim()) {
            setFormError('Swimmer name is required');
            return;
        }

        setIsSaving(true);
        setFormError(null);

        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-swimmer/${swimmerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce
                },
                body: JSON.stringify({
                    title: formData.title,
                    meta: {
                        parent_name: formData.parent_name,
                        parent_email: formData.parent_email,
                        date_of_birth: formData.date_of_birth,
                        notes: formData.notes,
                        current_level: formData.current_level || 0,
                        skills_mastered: formData.skills_mastered,
                        levels_mastered: formData.levels_mastered
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save swimmer');
            }

            const updatedSwimmer = await response.json();
            setSwimmer(updatedSwimmer);
            onSwimmerUpdated?.(updatedSwimmer);
            
            if (!showEvalForm) {
                onClose();
            }
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    // Save evaluation
    const handleSaveEvaluation = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!evalContent.trim()) {
            setEvalError('Evaluation content is required');
            return;
        }

        setIsSavingEval(true);
        setEvalError(null);

        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-evaluation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce
                },
                body: JSON.stringify({
                    title: `Evaluation for ${formData.title}`,
                    status: 'publish',
                    content: evalContent,
                    meta: {
                        swimmer: swimmerId,
                        level_evaluated: evalLevel || 0,
                        emailed: false,
                        content: evalContent
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create evaluation');
            }

            const newEval = await response.json();
            onEvaluationCreated?.(newEval);
            // Add the new evaluation to the top of the local list so it shows immediately
            setSwimmerEvaluations(prev => [newEval, ...prev]);
            setShowEvalForm(false);
            setEvalContent('');
            setEvalError(null);
        } catch (err) {
            setEvalError(err instanceof Error ? err.message : 'Failed to create evaluation');
        } finally {
            setIsSavingEval(false);
        }
    };

    // Generate share progress link
    const handleShareProgress = async () => {
        if (!swimmer) return;
        
        setIsGeneratingShare(true);
        setShareUrl(null);
        setShareExpires(null);
        setShareCopied(false);
        
        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/swimmer/${swimmer.id}/share-link`, {
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

    if (isLoading) {
        return (
            <div className="ap-fixed ap-inset-0 ap-z-[60] ap-overflow-hidden">
                <div className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/30" />
                <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                    <div className="ap-w-full md:ap-w-screen md:ap-max-w-[50vw] ap-h-screen ap-max-h-screen ap-bg-white ap-shadow-xl ap-flex ap-items-center ap-justify-center">
                        <LoadingSpinner />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Swimmer Edit Slide-Over */}
            <div className="ap-fixed ap-inset-0 ap-z-[60] ap-overflow-hidden">
                <div className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/30" onClick={onClose} />
                <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                    <div className="ap-w-full md:ap-w-screen md:ap-max-w-[50vw] ap-h-screen ap-max-h-screen ap-transform ap-transition-transform ap-duration-300 ap-bg-white ap-shadow-xl ap-flex ap-flex-col">
                        {/* Header */}
                        <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-green-500 ap-to-emerald-500">
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={onClose}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                            >
                                <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                            </Button>
                            <h2 className="ap-text-lg ap-font-semibold ap-text-white ap-flex-1">
                                Edit Swimmer
                            </h2>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={onClose}
                                className="ap-hidden md:ap-block !ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                            >
                                <HiOutlineXMark className="ap-w-5 ap-h-5" />
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

                            {/* Evaluation History Section */}
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
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            onClick={() => setShowEvalForm(true)}
                                            className="!ap-mt-2 !ap-text-purple-600 hover:!ap-text-purple-700"
                                        >
                                            Create first evaluation →
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-divide-y ap-divide-gray-100 ap-overflow-hidden">
                                        {swimmerEvaluations.map(evaluation => {
                                            const isExpanded = expandedEvalId === evaluation.id;
                                            return (
                                                <div key={evaluation.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedEvalId(isExpanded ? null : evaluation.id)}
                                                        className="ap-w-full ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between hover:ap-bg-gray-50 ap-text-left ap-transition-colors"
                                                    >
                                                        <div className="ap-flex-1 ap-min-w-0">
                                                            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-1">
                                                                <HiOutlineClock className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                                                                <span className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                                    {new Date(evaluation.date).toLocaleDateString('en-US', {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    })}
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
                                                                    <span className="ap-text-xs ap-text-gray-500 ap-flex ap-items-center ap-gap-1">
                                                                        <HiOutlineUser className="ap-w-3 ap-h-3" />
                                                                        {evaluation.author_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isExpanded ? (
                                                            <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                                                        ) : (
                                                            <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                                                        )}
                                                    </button>
                                                    {isExpanded && (
                                                        <div className="ap-px-4 ap-pb-4 ap-bg-purple-50/50">
                                                            {evaluation.content?.rendered ? (
                                                                <div
                                                                    className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700 ap-bg-white ap-rounded-lg ap-p-3 ap-border ap-border-gray-100"
                                                                    dangerouslySetInnerHTML={{ __html: evaluation.content.rendered }}
                                                                />
                                                            ) : evaluation.meta?.content ? (
                                                                <div className="ap-text-sm ap-text-gray-700 ap-bg-white ap-rounded-lg ap-p-3 ap-border ap-border-gray-100 ap-whitespace-pre-wrap">
                                                                    {evaluation.meta.content}
                                                                </div>
                                                            ) : (
                                                                <p className="ap-text-sm ap-text-gray-400 ap-italic ap-py-2">No notes recorded</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="ap-flex-shrink-0 ap-flex ap-flex-col md:ap-flex-row ap-items-stretch md:ap-items-center ap-justify-between ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                            <div className="ap-flex ap-items-center ap-gap-2">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => setShowEvalForm(true)}
                                    className="ap-flex-1 md:ap-flex-none !ap-text-green-700 !ap-border-green-300 hover:!ap-bg-green-50"
                                >
                                    <HiOutlineDocumentPlus className="ap-w-4 ap-h-4" />
                                    <span>Create Evaluation</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={handleShareProgress}
                                    disabled={isGeneratingShare}
                                    className="ap-flex-1 md:ap-flex-none !ap-text-blue-700 !ap-border-blue-300 hover:!ap-bg-blue-50"
                                    title="Share Progress"
                                >
                                    {isGeneratingShare ? (
                                        <LoadingSpinner />
                                    ) : (
                                        <HiOutlineShare className="ap-w-4 ap-h-4" />
                                    )}
                                    <span>Share Progress</span>
                                </Button>
                            </div>
                            <div className="ap-flex ap-items-center ap-gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="lesson-swimmers"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="!ap-bg-gradient-to-r !ap-from-green-500 !ap-to-emerald-500"
                                >
                                    {isSaving ? (
                                        <>
                                            <LoadingSpinner />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Save</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nested Evaluation Form Slide-Over */}
            {showEvalForm && (
                <div className="ap-fixed ap-inset-0 ap-z-[70] ap-overflow-hidden">
                    <div className="ap-hidden md:ap-block ap-absolute ap-inset-0 ap-bg-black/30" onClick={() => setShowEvalForm(false)} />
                    <div className="ap-absolute ap-inset-0 md:ap-inset-y-0 md:ap-right-0 md:ap-left-auto ap-flex md:ap-max-w-full md:ap-pl-16">
                        <div className="ap-w-full md:ap-w-screen md:ap-max-w-[45vw] ap-transform ap-transition-transform ap-duration-300 ap-bg-white ap-shadow-xl ap-flex ap-flex-col">
                            {/* Header */}
                            <div className="ap-flex ap-items-center ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gradient-to-r ap-from-violet-500 ap-to-purple-500">
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setShowEvalForm(false)}
                                    className="!ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                                >
                                    <HiOutlineArrowLeft className="ap-w-5 ap-h-5" />
                                </Button>
                                <h2 className="ap-text-lg ap-font-semibold ap-text-white ap-flex-1">
                                    New Evaluation
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setShowEvalForm(false)}
                                    className="ap-hidden md:ap-block !ap-p-1.5 !ap-min-h-0 ap-text-white/80 hover:ap-text-white hover:ap-bg-white/10"
                                >
                                    <HiOutlineXMark className="ap-w-5 ap-h-5" />
                                </Button>
                            </div>

                            {/* Evaluation Form */}
                            <div className="ap-flex-1 ap-overflow-y-auto ap-p-4 md:ap-p-6 ap-space-y-4">
                                {evalError && (
                                    <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                        <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                        {evalError}
                                    </div>
                                )}

                                {/* Swimmer (locked) */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Swimmer
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        disabled
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 ap-bg-gray-100 ap-text-gray-600"
                                    />
                                </div>

                                {/* Level - Button Selection */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                        Level Evaluated
                                    </label>
                                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                                        {levels.map(level => (
                                            <Button
                                                key={level.id}
                                                variant="ghost"
                                                type="button"
                                                onClick={() => setEvalLevel(level.id)}
                                                className={`!ap-border-2 ${
                                                    evalLevel === level.id
                                                        ? '!ap-border-violet-500 !ap-bg-violet-50 !ap-text-violet-700 ap-ring-2 ap-ring-violet-500/20' : '!ap-border-gray-200 !ap-bg-white !ap-text-gray-700 hover:!ap-border-violet-300 hover:!ap-bg-violet-50'
                                                }`}
                                            >
                                                {decodeHTMLEntities(level.title?.rendered)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Swimmer's Current Progress (read-only) */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                        Swimmer's Current Progress
                                    </label>
                                    {(() => {
                                        const swimmerLevel = levels.find(l => l.id === formData.current_level);
                                        const masteredSkills = formData.skills_mastered || [];
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
                                                <div className="ap-p-3 ap-space-y-2 ap-max-h-36 ap-overflow-y-auto">
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
                                                                        {level?.title?.rendered || 'Unknown Level'}
                                                                    </p>
                                                                    <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                                        {levelSkills.map(skill => (
                                                                            <span
                                                                                key={skill.id}
                                                                                className="ap-inline-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-green-100 ap-text-green-700 ap-rounded ap-text-xs"
                                                                            >
                                                                                <HiOutlineCheck className="ap-w-3 ap-h-3" />
                                                                                {skill.title?.rendered}
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

                                {/* Evaluation Content */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Evaluation <span className="ap-text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={evalContent}
                                        onChange={(e) => setEvalContent(e.target.value)}
                                        rows={8}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-violet-500 focus:ap-ring-2 focus:ap-ring-violet-500/20 ap-transition-colors ap-resize-none"
                                        placeholder="Write your evaluation here..."
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-px-4 md:ap-px-6 ap-py-4 ap-border-t ap-border-gray-200 ap-bg-gray-50">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowEvalForm(false)}
                                    disabled={isSavingEval}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="lesson-swimmers"
                                    onClick={handleSaveEvaluation}
                                    disabled={isSavingEval}
                                    className="!ap-bg-gradient-to-r !ap-from-violet-500 !ap-to-purple-500"
                                >
                                    {isSavingEval ? (
                                        <>
                                            <LoadingSpinner />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <span>Create Evaluation</span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Progress Modal */}
            {showShareModal && shareUrl && (
                <div className="ap-fixed ap-inset-0 ap-z-[80] ap-overflow-y-auto">
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
                                        {swimmer?.title?.rendered}
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
                                        variant="ghost"
                                        size="xs"
                                        onClick={handleCopyShareUrl}
                                        className={`!ap-px-3 !ap-py-1.5 ${
                                            shareCopied 
                                                ? '!ap-bg-green-100 !ap-text-green-700' : '!ap-bg-blue-100 !ap-text-blue-700 hover:!ap-bg-blue-200'
                                        }`}
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
        </>
    );
};

export default NestedSwimmerEditor;
