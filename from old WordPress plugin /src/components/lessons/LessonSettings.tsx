import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import { 
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineAcademicCap,
    HiOutlineSparkles,
    HiOutlineTag,
    HiOutlineBuildingOffice2,
    HiOutlineCog,
    HiOutlineLockClosed,
    HiOutlineEye,
    HiOutlineEyeSlash,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineXMark,
    HiOutlineEnvelope
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Level, Skill, Camp, Animal, LessonType } from '@/types/lessons';

// Helper to decode HTML entities in strings (e.g., &amp; -> &)
const decodeHTMLEntities = (str: string | undefined): string => {
    if (!str || typeof str !== 'string') return str || '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

interface LessonSettingsProps {
    apiUrl: string;
    nonce: string;
}

type SettingsTab = 'general' | 'levels' | 'skills' | 'camps' | 'animals' | 'lesson-types';

// Modal types
type ModalType = 'level' | 'skill' | 'taxonomy' | null;
type TaxonomyKind = 'camp' | 'animal' | 'lesson-type';

interface LevelFormData {
    title: string;
    sort_order: number;
}

interface SkillFormData {
    title: string;
    sort_order: number;
    level_associated: number | '';
}

interface TaxonomyFormData {
    name: string;
    description: string;
}

const LessonSettings: React.FC<LessonSettingsProps> = ({ apiUrl, nonce }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [levels, setLevels] = useState<Level[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [camps, setCamps] = useState<Camp[]>([]);
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // General settings state
    const [campRosterPassword, setCampRosterPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordSaveSuccess, setPasswordSaveSuccess] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [hasExistingPassword, setHasExistingPassword] = useState(false);

    // Email settings state
    const [emailSettings, setEmailSettings] = useState({
        evaluation_page_url: '',
        email_subject: 'Evaluation Results for [swimmer_name]',
        email_body: "Hello [parent_name],\n\nWe've just completed a new evaluation for [swimmer_name].\n\nYou can view their progress tracking, skills mastered, and all evaluation history here:\n[evaluation_link]",
        reply_to_email: '',
    });
    const [isLoadingEmailSettings, setIsLoadingEmailSettings] = useState(false);
    const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
    const [emailSettingsSaveSuccess, setEmailSettingsSaveSuccess] = useState(false);
    const [emailSettingsError, setEmailSettingsError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<ModalType>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Delete confirmation state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: ModalType | TaxonomyKind; id: number; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form data states
    const [levelForm, setLevelForm] = useState<LevelFormData>({ title: '', sort_order: 0 });
    const [skillForm, setSkillForm] = useState<SkillFormData>({ title: '', sort_order: 0, level_associated: '' });
    const [taxonomyForm, setTaxonomyForm] = useState<TaxonomyFormData>({ name: '', description: '' });
    const [taxonomyKind, setTaxonomyKind] = useState<TaxonomyKind>('camp');

    const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: 'general', label: 'General', icon: HiOutlineCog },
        { id: 'levels', label: 'Levels', icon: HiOutlineAcademicCap },
        { id: 'skills', label: 'Skills', icon: HiOutlineSparkles },
        { id: 'camps', label: 'Camps', icon: HiOutlineBuildingOffice2 },
        { id: 'animals', label: 'Animals', icon: HiOutlineTag },
        { id: 'lesson-types', label: 'Lesson Types', icon: HiOutlineTag },
    ];

    // Load camp roster password status and email settings on mount
    useEffect(() => {
        loadPasswordStatus();
        loadEmailSettings();
        // Also pre-load levels for the skill dropdown
        loadLevels();
    }, []);

    // Load data based on active tab
    useEffect(() => {
        if (activeTab !== 'general') {
            loadData();
        }
    }, [activeTab]);

    const loadLevels = async () => {
        try {
            const response = await fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Sort by sort_order client-side
                const sortedData = [...data].sort((a: Level) => 
                    (a.meta?.sort_order || 0)
                );
                setLevels(sortedData);
            }
        } catch (err) {
            console.error('Failed to load levels:', err);
        }
    };

    const loadPasswordStatus = async () => {
        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/camp-roster/password-status`, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setHasExistingPassword(data.has_password || false);
            }
        } catch (err) {
            console.error('Failed to load password status:', err);
        }
    };

    const handleSavePassword = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        if (!campRosterPassword.trim()) {
            setPasswordError('Password cannot be empty');
            return;
        }

        setIsSavingPassword(true);
        setPasswordError(null);
        setPasswordSaveSuccess(false);

        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/camp-roster/set-password`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: campRosterPassword }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to save password');
            }

            setPasswordSaveSuccess(true);
            setHasExistingPassword(true);
            setCampRosterPassword('');
            setTimeout(() => setPasswordSaveSuccess(false), 3000);
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Failed to save password');
        } finally {
            setIsSavingPassword(false);
        }
    };

    const loadEmailSettings = async () => {
        setIsLoadingEmailSettings(true);
        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/email-settings`, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setEmailSettings({
                    evaluation_page_url: data.evaluation_page_url || '',
                    email_subject: data.email_subject || 'Evaluation Results for [swimmer_name]',
                    email_body: data.email_body || "Hello [parent_name],\n\nWe've just completed a new evaluation for [swimmer_name].\n\nYou can view their progress tracking, skills mastered, and all evaluation history here:\n[evaluation_link]",
                    reply_to_email: data.reply_to_email || '',
                });
            }
        } catch (err) {
            console.error('Failed to load email settings:', err);
        } finally {
            setIsLoadingEmailSettings(false);
        }
    };

    const handleSaveEmailSettings = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setIsSavingEmailSettings(true);
        setEmailSettingsError(null);
        setEmailSettingsSaveSuccess(false);

        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/email-settings`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailSettings),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to save email settings');
            }

            setEmailSettingsSaveSuccess(true);
            setTimeout(() => setEmailSettingsSaveSuccess(false), 3000);
        } catch (err) {
            setEmailSettingsError(err instanceof Error ? err.message : 'Failed to save email settings');
        } finally {
            setIsSavingEmailSettings(false);
        }
    };

    // Reset modal state
    const resetModal = () => {
        setShowModal(false);
        setModalType(null);
        setIsEditing(false);
        setEditingId(null);
        setModalError(null);
        setLevelForm({ title: '', sort_order: 0 });
        setSkillForm({ title: '', sort_order: 0, level_associated: '' });
        setTaxonomyForm({ name: '', description: '' });
    };

    // Open modal for adding new item
    const handleAdd = () => {
        resetModal();
        setShowModal(true);
        
        switch (activeTab) {
            case 'levels':
                setModalType('level');
                setLevelForm({ title: '', sort_order: levels.length + 1 });
                break;
            case 'skills':
                setModalType('skill');
                setSkillForm({ title: '', sort_order: skills.length + 1, level_associated: '' });
                break;
            case 'camps':
                setModalType('taxonomy');
                setTaxonomyKind('camp');
                break;
            case 'animals':
                setModalType('taxonomy');
                setTaxonomyKind('animal');
                break;
            case 'lesson-types':
                setModalType('taxonomy');
                setTaxonomyKind('lesson-type');
                break;
        }
    };

    // Open modal for editing existing level
    const handleEditLevel = (level: Level) => {
        resetModal();
        setShowModal(true);
        setModalType('level');
        setIsEditing(true);
        setEditingId(level.id);
        setLevelForm({
            title: level.title?.rendered || '',
            sort_order: level.meta?.sort_order || 0
        });
    };

    // Open modal for editing existing skill
    const handleEditSkill = (skill: Skill) => {
        resetModal();
        setShowModal(true);
        setModalType('skill');
        setIsEditing(true);
        setEditingId(skill.id);
        setSkillForm({
            title: skill.title?.rendered || '',
            sort_order: skill.meta?.sort_order || 0,
            level_associated: skill.meta?.level_associated || ''
        });
    };

    // Open modal for editing taxonomy (camp/animal/lesson-type)
    const handleEditTaxonomy = (item: Camp | Animal | LessonType, kind: TaxonomyKind) => {
        resetModal();
        setShowModal(true);
        setModalType('taxonomy');
        setTaxonomyKind(kind);
        setIsEditing(true);
        setEditingId(item.id);
        setTaxonomyForm({
            name: item.name,
            description: item.description || ''
        });
    };

    // Confirm delete dialog
    const handleDeleteClick = (type: ModalType | TaxonomyKind, id: number, name: string) => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setDeleteTarget({ type, id, name });
        setShowDeleteConfirm(true);
    };

    // Save level (create or update)
    const handleSaveLevel = async () => {
        console.log('handleSaveLevel called');
        console.log('levelForm:', levelForm);
        
        if (!levelForm.title.trim()) {
            setModalError('Title is required');
            return;
        }

        setIsSaving(true);
        setModalError(null);

        try {
            const endpoint = isEditing
                ? `${apiUrl}wp/v2/lm-level/${editingId}`
                : `${apiUrl}wp/v2/lm-level`;

            const payload = {
                title: levelForm.title,
                status: 'publish',
                meta: {
                    sort_order: levelForm.sort_order
                }
            };

            console.log('Saving level to:', endpoint);
            console.log('Payload:', JSON.stringify(payload));
            console.log('Is editing:', isEditing, 'editingId:', editingId);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to save level');
            }

            console.log('Level saved successfully, refreshing data...');
            resetModal();
            await loadData();
            console.log('Data refreshed');
        } catch (err) {
            console.error('Level save error:', err);
            setModalError(err instanceof Error ? err.message : 'Failed to save level');
        } finally {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

            setIsSaving(false);
        }
    };

    // Save skill (create or update)
    const handleSaveSkill = async () => {
        if (!skillForm.title.trim()) {
            setModalError('Title is required');
            return;
        }

        setIsSaving(true);
        setModalError(null);

        try {
            const endpoint = isEditing
                ? `${apiUrl}wp/v2/lm-skill/${editingId}`
                : `${apiUrl}wp/v2/lm-skill`;

            console.log('Saving skill to:', endpoint);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: skillForm.title,
                    status: 'publish',
                    meta: {
                        sort_order: skillForm.sort_order,
                        level_associated: skillForm.level_associated || 0
                    }
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                console.error('Failed to save skill:', data);
                throw new Error(data.message || 'Failed to save skill');
            }

            resetModal();
            loadData();
        } catch (err) {
            console.error('Skill save error:', err);
            setModalError(err instanceof Error ? err.message : 'Failed to save skill');
        } finally {
            setIsSaving(false);
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        }
    };

    // Save taxonomy (create or update)
    // Note: WordPress REST API uses POST for both creating and updating taxonomy terms
    const handleSaveTaxonomy = async () => {
        if (!taxonomyForm.name.trim()) {
            setModalError('Name is required');
            return;
        }

        setIsSaving(true);
        setModalError(null);

        try {
            // Get taxonomy endpoint based on kind
            const taxonomyEndpoint = getTaxonomyEndpoint(taxonomyKind);
            const endpoint = isEditing
                ? `${apiUrl}wp/v2/${taxonomyEndpoint}/${editingId}`
                : `${apiUrl}wp/v2/${taxonomyEndpoint}`;

            const payload = {
                name: taxonomyForm.name,
                description: taxonomyForm.description
            };

            console.log('Saving taxonomy to:', endpoint);
            console.log('Taxonomy kind:', taxonomyKind, 'Endpoint:', taxonomyEndpoint);
            console.log('Payload:', JSON.stringify(payload));
            console.log('Is editing:', isEditing, 'editingId:', editingId);

            // WordPress REST API uses POST for both create and update of taxonomy terms
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to save');
            }

            console.log('Taxonomy saved successfully, refreshing data...');
            resetModal();
            await loadData();
            console.log('Data refreshed');
        } catch (err) {
            console.error('Taxonomy save error:', err);
            setModalError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!deleteTarget) return;

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setIsDeleting(true);

        try {
            let endpoint = '';
            
            if (deleteTarget.type === 'level') {
                endpoint = `${apiUrl}wp/v2/lm-level/${deleteTarget.id}?force=true`;
            } else if (deleteTarget.type === 'skill') {
                endpoint = `${apiUrl}wp/v2/lm-skill/${deleteTarget.id}?force=true`;
            } else {
                // It's a taxonomy
                const taxonomyEndpoint = getTaxonomyEndpoint(deleteTarget.type as TaxonomyKind);
                endpoint = `${apiUrl}wp/v2/${taxonomyEndpoint}/${deleteTarget.id}?force=true`;
            }

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to delete');
            }

            setShowDeleteConfirm(false);
            setDeleteTarget(null);
            loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    // Helper to get taxonomy endpoint
    const getTaxonomyEndpoint = (kind: TaxonomyKind): string => {
        switch (kind) {
            case 'camp': return 'lm_camp';
            case 'animal': return 'lm_animal';
            case 'lesson-type': return 'lm_lesson_type';
        }
    };

    // Get modal title
    const getModalTitle = (): string => {
        const action = isEditing ? 'Edit' : 'Add';
        switch (modalType) {
            case 'level': return `${action} Level`;
            case 'skill': return `${action} Skill`;
            case 'taxonomy':
                switch (taxonomyKind) {
                    case 'camp': return `${action} Camp`;
                    case 'animal': return `${action} Animal`;
                    case 'lesson-type': return `${action} Lesson Type`;
                }
        }
        return '';
    };

    const loadData = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setLevels([]);
            setSkills([]);
            setCamps([]);
            setAnimals([]);
            setLessonTypes([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let endpoint = '';
            switch (activeTab) {
                case 'levels':
                    endpoint = `${apiUrl}wp/v2/lm-level?per_page=100`;
                    break;
                case 'skills':
                    endpoint = `${apiUrl}wp/v2/lm-skill?per_page=100`;
                    break;
                case 'camps':
                    endpoint = `${apiUrl}wp/v2/lm_camp?per_page=100`;
                    break;
                case 'animals':
                    endpoint = `${apiUrl}wp/v2/lm_animal?per_page=100`;
                    break;
                case 'lesson-types':
                    endpoint = `${apiUrl}wp/v2/lm_lesson_type?per_page=100`;
                    break;
                default:
                    return;
            }

            const response = await fetch(endpoint, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load data');
            }

            const data = await response.json();

            // Sort levels and skills by sort_order client-side
            switch (activeTab) {
                case 'levels':
                    const sortedLevels = [...data].sort((a, b) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setLevels(sortedLevels);
                    break;
                case 'skills':
                    const sortedSkills = [...data].sort((a, b) => 
                        (a.meta?.sort_order || 0) - (b.meta?.sort_order || 0)
                    );
                    setSkills(sortedSkills);
                    break;
                case 'camps':
                    setCamps(data);
                    break;
                case 'animals':
                    setAnimals(data);
                    break;
                case 'lesson-types':
                    setLessonTypes(data);
                    break;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const renderLevels = () => (
        <div className="ap-space-y-3">
            {levels.map((level, index) => (
                <div
                    key={level.id}
                    className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200 hover:ap-border-indigo-300 ap-transition-colors"
                >
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <span className="ap-w-8 ap-h-8 ap-flex ap-items-center ap-justify-center ap-bg-indigo-100 ap-text-indigo-600 ap-rounded-full ap-text-sm ap-font-medium">
                            {index + 1}
                        </span>
                        <div>
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-900">{decodeHTMLEntities(level.title?.rendered) || 'Untitled Level'}</h4>
                            {level.meta?.related_skills?.length > 0 && (
                                <p className="ap-text-sm ap-text-gray-500">
                                    {level.meta.related_skills.length} skill{level.meta.related_skills.length !== 1 ? 's' : ''} associated
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button 
                            variant="ghost"
                            size="xs"
                            onClick={() => handleEditLevel(level)}
                            className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-blue-600 hover:ap-bg-blue-50"
                        >
                            <HiOutlinePencil className="ap-w-4 ap-h-4" />
                        </Button>
                        <Button 
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDeleteClick('level', level.id, decodeHTMLEntities(level.title?.rendered) || 'Untitled Level')}
                            className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-red-600 hover:ap-bg-red-50"
                        >
                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSkills = () => (
        <div className="ap-space-y-3">
            {skills.map((skill) => {
                const associatedLevel = levels.find(l => l.id === skill.meta?.level_associated);
                return (
                    <div
                        key={skill.id}
                        className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200 hover:ap-border-green-300 ap-transition-colors"
                    >
                        <div>
                            <h4 className="ap-text-sm ap-font-medium ap-text-gray-900">{decodeHTMLEntities(skill.title?.rendered) || 'Untitled Skill'}</h4>
                            {associatedLevel && (
                                <p className="ap-text-sm ap-text-gray-500">
                                    Level: {decodeHTMLEntities(associatedLevel.title?.rendered)}
                                </p>
                            )}
                        </div>
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <Button 
                                variant="ghost"
                                size="xs"
                                onClick={() => handleEditSkill(skill)}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-blue-600 hover:ap-bg-blue-50"
                            >
                                <HiOutlinePencil className="ap-w-4 ap-h-4" />
                            </Button>
                            <Button 
                                variant="ghost"
                                size="xs"
                                onClick={() => handleDeleteClick('skill', skill.id, decodeHTMLEntities(skill.title?.rendered) || 'Untitled Skill')}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-red-600 hover:ap-bg-red-50"
                            >
                                <HiOutlineTrash className="ap-w-4 ap-h-4" />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderTaxonomyItems = (items: (Camp | Animal | LessonType)[], kind: TaxonomyKind, colorClass: string) => (
        <div className="ap-space-y-3">
            {items.map((item) => (
                <div
                    key={item.id}
                    className={`ap-flex ap-items-center ap-justify-between ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200 hover:ap-border-${colorClass}-300 ap-transition-colors`}
                >
                    <div>
                        <h4 className="ap-text-sm ap-font-medium ap-text-gray-900">{item.name}</h4>
                        {item.description && (
                            <p className="ap-text-sm ap-text-gray-500 line-clamp-1">{item.description}</p>
                        )}
                        <p className="ap-text-xs ap-text-gray-400 ap-mt-1">{item.count || 0} items</p>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button 
                            variant="ghost"
                            size="xs"
                            onClick={() => handleEditTaxonomy(item, kind)}
                            className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-blue-600 hover:ap-bg-blue-50"
                        >
                            <HiOutlinePencil className="ap-w-4 ap-h-4" />
                        </Button>
                        <Button 
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDeleteClick(kind, item.id, item.name)}
                            className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-red-600 hover:ap-bg-red-50"
                        >
                            <HiOutlineTrash className="ap-w-4 ap-h-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );

    const getAddButtonText = () => {
        switch (activeTab) {
            case 'general': return null;
            case 'levels': return 'Add Level';
            case 'skills': return 'Add Skill';
            case 'camps': return 'Add Camp';
            case 'animals': return 'Add Animal';
            case 'lesson-types': return 'Add Lesson Type';
        }
    };

    const getCurrentData = () => {
        switch (activeTab) {
            case 'general': return [];
            case 'levels': return levels;
            case 'skills': return skills;
            case 'camps': return camps;
            case 'animals': return animals;
            case 'lesson-types': return lessonTypes;
        }
    };

    const renderGeneralSettings = () => (
        <div className="ap-space-y-8">
            {/* Camp Roster Password Section */}
            <div className="ap-bg-gray-50 ap-rounded-xl ap-p-6 ap-border ap-border-gray-200">
                <div className="ap-flex ap-items-start ap-gap-4">
                    <div className="ap-p-3 ap-bg-blue-50 ap-rounded-lg">
                        <HiOutlineLockClosed className="ap-w-6 ap-h-6 ap-text-blue-600" />
                    </div>
                    <div className="ap-flex-1">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-1">Camp Roster Password</h3>
                        <p className="ap-text-sm ap-text-gray-500 ap-mb-4">
                            Set a password for public access to camp rosters. Users visiting the Camp Rosters page
                            will need to enter this password to view the content.
                        </p>

                        {/* Password status */}
                        <div className="ap-mb-4">
                            {hasExistingPassword ? (
                                <div className="ap-flex ap-items-center ap-gap-2 ap-text-green-600 ap-text-sm">
                                    <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                    <span>Password is set. Enter a new password below to change it.</span>
                                </div>
                            ) : (
                                <div className="ap-flex ap-items-center ap-gap-2 ap-text-yellow-600 ap-text-sm">
                                    <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" />
                                    <span>No password set. Camp rosters are currently inaccessible to the public.</span>
                                </div>
                            )}
                        </div>

                        {/* Password input */}
                        <div className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-3">
                            <div className="ap-relative ap-flex-1 ap-max-w-md">
                                <input
                                    type={showPassword ? 'ap-text' : 'password'}
                                    value={campRosterPassword}
                                    onChange={(e) => setCampRosterPassword(e.target.value)}
                                    placeholder={hasExistingPassword ? 'Enter new password' : 'Set password'}
                                    className="ap-w-full ap-px-4 ap-py-2.5 ap-pr-10 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="!ap-p-1 !ap-min-h-0 ap-absolute ap-right-3 ap-top-1/2 -ap-translate-y-1/2 ap-text-gray-400 hover:ap-text-gray-600"
                                >
                                    {showPassword ? (
                                        <HiOutlineEyeSlash className="ap-w-5 ap-h-5" />
                                    ) : (
                                        <HiOutlineEye className="ap-w-5 ap-h-5" />
                                    )}
                                </Button>
                            </div>
                            <Button
                                variant="primary"
                                onClick={handleSavePassword}
                                disabled={isSavingPassword || !campRosterPassword.trim()}
                                className="ap-px-6 ap-py-2.5 ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 hover:ap-shadow-lg"
                            >
                                {isSavingPassword ? (
                                    <>
                                        <LoadingSpinner />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>{hasExistingPassword ? 'Update Password' : 'Set Password'}</span>
                                )}
                            </Button>
                        </div>

                        {/* Success/Error messages */}
                        {passwordSaveSuccess && (
                            <div className="ap-mt-3 ap-flex ap-items-center ap-gap-2 ap-text-green-600 ap-text-sm">
                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                <span>Password saved successfully!</span>
                            </div>
                        )}
                        {passwordError && (
                            <div className="ap-mt-3 ap-flex ap-items-center ap-gap-2 ap-text-red-600 ap-text-sm">
                                <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" />
                                <span>{passwordError}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Permissions Info Section */}
            <div className="ap-bg-blue-50 ap-rounded-xl ap-p-6 ap-border ap-border-blue-200">
                <div className="ap-flex ap-items-start ap-gap-4">
                    <div className="ap-p-3 ap-bg-blue-100 ap-rounded-lg">
                        <HiOutlineCog className="ap-w-6 ap-h-6 ap-text-blue-600" />
                    </div>
                    <div className="ap-flex-1">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-1">Permissions</h3>
                        <p className="ap-text-sm ap-text-gray-600 ap-mb-2">
                            Lesson Management permissions are configured through the <strong>Admin → Job Roles</strong> editor.
                            Each job role can be assigned specific permissions for viewing, creating, editing, and deleting
                            lesson data (groups, swimmers, evaluations).
                        </p>
                        <p className="ap-text-sm ap-text-gray-500">
                            Navigate to <strong>Admin → Job Roles</strong> to configure permissions for each role.
                        </p>
                    </div>
                </div>
            </div>

            {/* Email Settings Section */}
            <div className="ap-bg-gray-50 ap-rounded-xl ap-p-6 ap-border ap-border-gray-200">
                <div className="ap-flex ap-items-start ap-gap-4">
                    <div className="ap-p-3 ap-bg-blue-50 ap-rounded-lg">
                        <HiOutlineEnvelope className="ap-w-6 ap-h-6 ap-text-blue-600" />
                    </div>
                    <div className="ap-flex-1">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-1">Email Settings</h3>
                        <p className="ap-text-sm ap-text-gray-500 ap-mb-4">
                            Configure the email template used when sending evaluation results to parents.
                        </p>

                        {isLoadingEmailSettings ? (
                            <div className="ap-flex ap-items-center ap-gap-2 ap-text-gray-500">
                                <LoadingSpinner />
                                <span>Loading email settings...</span>
                            </div>
                        ) : (
                            <div className="ap-space-y-4">
                                {/* Available placeholders */}
                                <div className="ap-p-3 ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
                                    <p className="ap-text-xs ap-font-medium ap-text-gray-600 ap-mb-2">Available Placeholders:</p>
                                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                                        <code className="ap-px-2 ap-py-1 ap-bg-gray-100 ap-rounded ap-text-xs">[swimmer_name]</code>
                                        <code className="ap-px-2 ap-py-1 ap-bg-gray-100 ap-rounded ap-text-xs">[parent_name]</code>
                                        <code className="ap-px-2 ap-py-1 ap-bg-gray-100 ap-rounded ap-text-xs">[evaluation_link]</code>
                                    </div>
                                </div>

                                {/* Evaluation Page URL */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Swimmer Evaluation Page URL
                                    </label>
                                    <input
                                        type="url"
                                        value={emailSettings.evaluation_page_url}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, evaluation_page_url: e.target.value })}
                                        placeholder="https://yoursite.com/swimmer-evaluations/"
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                    />
                                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                        Create a page with the shortcode [swimmer_evaluation_view] and paste the URL here.
                                    </p>
                                </div>

                                {/* Email Subject */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Email Subject
                                    </label>
                                    <input
                                        type="text"
                                        value={emailSettings.email_subject}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, email_subject: e.target.value })}
                                        placeholder="Evaluation Results for [swimmer_name]"
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                    />
                                </div>

                                {/* Email Body */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Email Body
                                    </label>
                                    <textarea
                                        value={emailSettings.email_body}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, email_body: e.target.value })}
                                        rows={6}
                                        className="ap-w-full ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors ap-font-mono ap-text-sm"
                                    />
                                </div>

                                {/* Reply-To Email */}
                                <div>
                                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                        Reply-To Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={emailSettings.reply_to_email}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, reply_to_email: e.target.value })}
                                        placeholder="questions@yoursite.com"
                                        className="ap-w-full ap-max-w-md ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                    />
                                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                        This email will be shown on the evaluation page as a contact link. Leave blank to hide.
                                    </p>
                                </div>

                                {/* Save Button */}
                                <div className="ap-flex ap-items-center ap-gap-4 ap-pt-2">
                                    <Button
                                        variant="primary"
                                        onClick={handleSaveEmailSettings}
                                        disabled={isSavingEmailSettings}
                                        className="ap-px-6 ap-py-2.5 ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 hover:ap-shadow-lg"
                                    >
                                        {isSavingEmailSettings ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Email Settings</span>
                                        )}
                                    </Button>

                                    {emailSettingsSaveSuccess && (
                                        <div className="ap-flex ap-items-center ap-gap-2 ap-text-green-600 ap-text-sm">
                                            <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />
                                            <span>Email settings saved successfully!</span>
                                        </div>
                                    )}
                                    {emailSettingsError && (
                                        <div className="ap-flex ap-items-center ap-gap-2 ap-text-red-600 ap-text-sm">
                                            <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" />
                                            <span>{emailSettingsError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="ap-p-6">
            {/* Tab navigation */}
            <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mb-6 ap-pb-4 ap-border-b ap-border-gray-200">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <Button
                            key={tab.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveTab(tab.id)}
                            className={`ap-flex ap-items-center ap-gap-2 ${isActive
                                    ? '!ap-bg-gray-900 !ap-text-white' : 'ap-text-gray-600 hover:ap-bg-gray-100 hover:ap-text-gray-900'
                                }`}
                        >
                            <Icon className="ap-w-4 ap-h-4" />
                            <span>{tab.label}</span>
                        </Button>
                    );
                })}
            </div>

            {/* Header - only show for non-general tabs */}
            {activeTab !== 'general' && (
                <div className="ap-flex ap-items-center ap-justify-between ap-mb-6">
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-capitalize">
                        {activeTab.replace('-', ' ')} Management
                    </h2>
                    {getAddButtonText() && (
                        <Button
                            variant="primary"
                            onClick={handleAdd}
                            className="ap-flex ap-items-center ap-gap-2 !ap-bg-gray-900 hover:!ap-bg-gray-800"
                        >
                            <HiOutlinePlus className="ap-w-4 ap-h-4" />
                            <span>{getAddButtonText()}</span>
                        </Button>
                    )}
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-mb-6">
                    {error}
                </div>
            )}

            {/* Loading state */}
            {isLoading && activeTab !== 'general' && (
                <div className="ap-flex ap-justify-center ap-py-12">
                    <LoadingSpinner />
                </div>
            )}

            {/* Content */}
            {!isLoading && !error && (
                <>
                    {activeTab === 'general' && renderGeneralSettings()}
                    {activeTab === 'levels' && renderLevels()}
                    {activeTab === 'skills' && renderSkills()}
                    {activeTab === 'camps' && renderTaxonomyItems(camps, 'camp', 'orange')}
                    {activeTab === 'animals' && renderTaxonomyItems(animals, 'animal', 'purple')}
                    {activeTab === 'lesson-types' && renderTaxonomyItems(lessonTypes, 'lesson-type', 'blue')}
                </>
            )}

            {/* Empty state - only for non-general tabs */}
            {!isLoading && !error && activeTab !== 'general' && getCurrentData().length === 0 && (
                <div className="ap-text-center ap-py-12">
                    <div className="ap-w-12 ap-h-12 ap-bg-gray-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                        {tabs.find(t => t.id === activeTab)?.icon && 
                            React.createElement(tabs.find(t => t.id === activeTab)!.icon, { className: 'ap-w-6 ap-h-6 ap-text-gray-400' })
                        }
                    </div>
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No {activeTab.replace('-', ' ')} found</h3>
                    <p className="ap-text-gray-500">Get started by adding your first {activeTab.replace('-', ' ').slice(0, -1)}</p>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center">
                    <div className="ap-absolute ap-inset-0 ap-bg-black/50" onClick={resetModal} />
                    <div className="ap-relative ap-bg-white ap-rounded-xl ap-shadow-2xl ap-w-full ap-max-w-md ap-mx-4 ap-max-h-[90vh] ap-overflow-y-auto">
                        {/* Modal Header */}
                        <div className="ap-flex ap-items-center ap-justify-between ap-p-4 ap-border-b ap-border-gray-200">
                            <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">{getModalTitle()}</h3>
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={resetModal}
                                className="!ap-p-1.5 !ap-min-h-0 ap-text-gray-400 hover:ap-text-gray-600"
                            >
                                <HiOutlineXMark className="ap-w-5 ap-h-5" />
                            </Button>
                        </div>

                        {/* Modal Body */}
                        <div className="ap-p-4 ap-space-y-4">
                            {modalError && (
                                <div className="ap-bg-red-50 ap-text-red-600 ap-p-3 ap-rounded-lg ap-text-sm ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" />
                                    {modalError}
                                </div>
                            )}

                            {/* Level Form */}
                            {modalType === 'level' && (
                                <>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Level Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={levelForm.title}
                                            onChange={(e) => setLevelForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="Enter level name"
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Sort Order
                                        </label>
                                        <input
                                            type="number"
                                            value={levelForm.sort_order}
                                            onChange={(e) => setLevelForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                            min={0}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        />
                                        <p className="ap-mt-1 ap-text-xs ap-text-gray-500">Lower numbers appear first</p>
                                    </div>
                                </>
                            )}

                            {/* Skill Form */}
                            {modalType === 'skill' && (
                                <>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Skill Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={skillForm.title}
                                            onChange={(e) => setSkillForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="Enter skill name"
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Associated Level
                                        </label>
                                        <select
                                            value={skillForm.level_associated}
                                            onChange={(e) => setSkillForm(prev => ({ ...prev, level_associated: e.target.value ? parseInt(e.target.value) : '' }))}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        >
                                            <option value="">-- Select Level --</option>
                                            {levels.map(level => (
                                                <option key={level.id} value={level.id}>
                                                    {decodeHTMLEntities(level.title?.rendered) || 'Untitled Level'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Sort Order
                                        </label>
                                        <input
                                            type="number"
                                            value={skillForm.sort_order}
                                            onChange={(e) => setSkillForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                            min={0}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        />
                                        <p className="ap-mt-1 ap-text-xs ap-text-gray-500">Lower numbers appear first</p>
                                    </div>
                                </>
                            )}

                            {/* Taxonomy Form (Camp/Animal/Lesson Type) */}
                            {modalType === 'taxonomy' && (
                                <>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={taxonomyForm.name}
                                            onChange={(e) => setTaxonomyForm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder={`Enter ${taxonomyKind.replace('-', ' ')} name`}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                            Description
                                        </label>
                                        <textarea
                                            value={taxonomyForm.description}
                                            onChange={(e) => setTaxonomyForm(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Enter description (optional)"
                                            rows={3}
                                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors ap-resize-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="ap-flex ap-items-center ap-justify-end ap-gap-3 ap-p-4 ap-border-t ap-border-gray-200">
                            <Button
                                variant="secondary"
                                onClick={resetModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    if (modalType === 'level') handleSaveLevel();
                                    else if (modalType === 'skill') handleSaveSkill();
                                    else if (modalType === 'taxonomy') handleSaveTaxonomy();
                                }}
                                disabled={isSaving}
                                className="ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 hover:ap-shadow-lg"
                            >
                                {isSaving ? (
                                    <>
                                        <LoadingSpinner />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>{isEditing ? 'Save Changes' : 'Create'}</span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deleteTarget && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center">
                    <div className="ap-absolute ap-inset-0 ap-bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="ap-relative ap-bg-white ap-rounded-xl ap-shadow-2xl ap-w-full ap-max-w-md ap-mx-4 ap-p-6">
                        <div className="ap-flex ap-items-center ap-gap-4 ap-mb-4">
                            <div className="ap-w-12 ap-h-12 ap-bg-red-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-flex-shrink-0">
                                <HiOutlineTrash className="ap-w-6 ap-h-6 ap-text-red-600" />
                            </div>
                            <div>
                                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Confirm Delete</h3>
                                <p className="ap-text-sm ap-text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="ap-text-gray-600 ap-mb-6">
                            Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                        </p>
                        <div className="ap-flex ap-items-center ap-justify-end ap-gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
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
            )}
        </div>
    );
};

export default LessonSettings;
