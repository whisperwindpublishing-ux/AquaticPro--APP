/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useMemo, useContext } from "react";const { apiFetch } = wp;

/**
 * Internal dependencies
 */
import { apiClient } from '../api';
import DataContext from '../context/DataContext';

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const SkillManager = () => {
    const { skills, levels, populateState } = useContext(DataContext);
    const skillCptSlug = LMData.post_types.skill;
    console.log('Skills received by SkillManager:', skills);
    
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    useEffect(() => {
        if (selectedSkill && selectedSkill.id) {
            const skillData = skills.find(s => s.id === selectedSkill.id);
            setSelectedSkill(skillData ? { ...skillData, title: skillData.title.rendered } : null);
        }
    }, [skills, selectedSkill?.id]);

    const handleSelectSkill = useCallback((skill) => {
        setSelectedSkill({ ...skill, title: skill.title.rendered });
        setIsCreating(false);
    }, []);

    const handleNewSkill = useCallback(() => {
        setIsCreating(true);
        setSelectedSkill({ title: '', meta: { sort_order: '', level_associated: '' } });
    }, []);

    const handleSkillChange = useCallback((key, value, isMeta = false) => {
        setSelectedSkill(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveSkill = useCallback(async () => {
        if (!selectedSkill) return;
        setIsSaving(true);

        const method = 'POST';
        const path = isCreating ? `/wp/v2/${skillCptSlug}` : `/wp/v2/${skillCptSlug}/${selectedSkill.id}`;
        const payload = {
            title: selectedSkill.title,
            status: 'publish',
            meta: {
                sort_order: selectedSkill.meta.sort_order ? parseInt(selectedSkill.meta.sort_order, 10) : 0,
                level_associated: selectedSkill.meta.level_associated ? parseInt(selectedSkill.meta.level_associated, 10) : null,
            },
        };

        try {
            await apiFetch({ path, method, data: payload });
            setFeedbackMessage(`Skill ${isCreating ? 'created' : 'updated'} successfully!`);
            await apiClient.refreshEssentialData(populateState);
            setIsSaving(false);
            setIsCreating(false);
            setSelectedSkill(null);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            alert('Error saving skill.');
            setIsSaving(false);
        }
    }, [selectedSkill, isCreating, skillCptSlug, populateState]);

    const handleDeleteSkill = useCallback(async (skillId) => {
        if (window.confirm('Are you sure you want to delete this skill?')) {
            setIsSaving(true);
            try {
                await apiFetch({ path: `/wp/v2/${skillCptSlug}/${skillId}`, method: 'DELETE' });
                setFeedbackMessage('Skill deleted successfully!');
                await apiClient.refreshEssentialData(populateState);
                setIsSaving(false);
                setSelectedSkill(null);
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                alert('Error deleting skill.');
                setIsSaving(false);
            }
        }
    }, [skillCptSlug, populateState]);

    const skillsByLevel = useMemo(() => {
        return skills.reduce((acc, skill) => {
            const levelId = skill.meta.level_associated;
            // First, check if the level ID exists.
            // Then, check if a level with that ID is actually in our levels list.
            const levelExists = levelId && levels.some(level => level.id === levelId);

            if (levelExists) {
                // If the level exists, group the skill under its ID.
                if (!acc[levelId]) {
                    acc[levelId] = [];
                }
                acc[levelId].push(skill);
            } else {
                // If the level ID is missing OR the level doesn't exist, treat it as uncategorized.
                if (!acc['uncategorized']) {
                    acc['uncategorized'] = [];
                }
                acc['uncategorized'].push(skill);
            }
            return acc;
        }, {});
    }, [skills, levels]);

    const sortedLevels = useMemo(() => levels.slice().sort((a, b) => a.meta.sort_order - b.meta.sort_order), [levels]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Skills</h2>
                    <button onClick={handleNewSkill} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700">+ New</button>
                </div>
                <div className="space-y-4">
                    {/* Render uncategorized skills first */}
                    {skillsByLevel.uncategorized && skillsByLevel.uncategorized.length > 0 && (
                        <div key="uncategorized">
                            <h3 className="text-lg font-semibold text-slate-700 mb-2 italic">Not associated with a level</h3>
                            <ul className="space-y-2 pl-2 border-l-2 border-slate-200">
                                {skillsByLevel.uncategorized.sort((a, b) => a.meta.sort_order - b.meta.sort_order).map(skill => (
                                    <li key={skill.id}>
                                        <button onClick={() => handleSelectSkill(skill)} className={`w-full text-left p-2 rounded-lg transition-all duration-150 ${selectedSkill?.id === skill.id ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'} border`}>
                                            {decodeEntities(skill.title.rendered)}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Then render skills for each sorted level */}
                    {sortedLevels.map(level => {
                        const skillsInLevel = skillsByLevel[level.id];
                        if (!skillsInLevel || skillsInLevel.length === 0) return null;
                        return (
                            <div key={level.id}>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">{decodeEntities(level.title.rendered)}</h3>
                                <ul className="space-y-2 pl-2 border-l-2 border-slate-200">
                                    {skillsInLevel.sort((a, b) => a.meta.sort_order - b.meta.sort_order).map(skill => (
                                        <li key={skill.id}>
                                            <button onClick={() => handleSelectSkill(skill)} className={`w-full text-left p-2 rounded-lg transition-all duration-150 ${selectedSkill?.id === skill.id ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'} border`}>
                                                {decodeEntities(skill.title.rendered)}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="md:col-span-2">
                {(selectedSkill || isCreating) && (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-3">{isCreating ? 'Create New Skill' : `Editing: ${decodeEntities(selectedSkill.title)}`}</h2>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="skill-title" className="block text-sm font-medium text-slate-700">Skill Name</label>
                                <input type="text" id="skill-title" value={decodeEntities(selectedSkill.title || '')} onChange={(e) => handleSkillChange('title', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label htmlFor="skill-level" className="block text-sm font-medium text-slate-700">Associated Level</label>
                                <select id="skill-level" value={selectedSkill.meta.level_associated || ''} onChange={(e) => handleSkillChange('level_associated', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                    <option value="">-- Select Level --</option>
                                    {sortedLevels.map(level => <option key={level.id} value={level.id}>{decodeEntities(level.title.rendered)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="skill-sort-order" className="block text-sm font-medium text-slate-700">Sort Order</label>
                                <input type="number" id="skill-sort-order" value={selectedSkill.meta.sort_order || ''} onChange={(e) => handleSkillChange('sort_order', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={handleSaveSkill} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isSaving ? 'Saving...' : (isCreating ? 'Create Skill' : 'Save Changes')}</button>
                                {feedbackMessage && <p className="text-green-600 font-semibold">{feedbackMessage}</p>}
                            </div>
                            {!isCreating && selectedSkill && (
                                <button onClick={() => handleDeleteSkill(selectedSkill.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Skill</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillManager;