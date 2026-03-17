/**
 * WordPress dependencies
 */
import { useMemo, useState } from 'react';

/**
 * Internal dependencies
 */
import { generateShareLink } from '../api';
import ShareLinkModal from './ShareLinkModal';

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const SwimmerForm = ({
    swimmer,
    onSwimmerChange,
    evaluations = [],
    isLoadingEvals,
    levels = [],
    skills = [],
    onSave,
    onCancel,
    isSaving,
    isReadOnly = false,
    onRequestNewEvaluation,
    onEditEvaluation,
    onDelete, // This prop is already here, which is great!
}) => {
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    const [shareableLink, setShareableLink] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateLink = async (swimmerId) => {
        setIsGenerating(true);
        try {
            const response = await generateShareLink(swimmerId);
            setShareableLink(response.share_link);
            setShareModalOpen(true);
        } catch (error) {
            console.error("Failed to generate share link:", error);
            alert("Could not generate the share link. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };



    const handleSkillMasteryChange = (skillId, isMastered) => {
        const newDate = new Date().toISOString().split('T')[0];
        let newSkillsMastered;
        if (isMastered) {
            newSkillsMastered = [...(swimmer.meta.skills_mastered || []), { skill_id: skillId, date: newDate }];
        } else {
            newSkillsMastered = (swimmer.meta.skills_mastered || []).filter(s => s.skill_id !== skillId);
        }
        onSwimmerChange('skills_mastered', newSkillsMastered, true);
    };

    const handleSkillDateChange = (skillId, newDate) => {
        const newSkillsMastered = (swimmer.meta.skills_mastered || []).map(s => s.skill_id === skillId ? { ...s, date: newDate } : s);
        onSwimmerChange('skills_mastered', newSkillsMastered, true);
    };

    const skillsByLevel = useMemo(() => {
        return skills.reduce((acc, skill) => {
            const levelId = skill.meta.level_associated || 'uncategorized';
            if (!acc[levelId]) acc[levelId] = [];
            acc[levelId].push(skill);
            return acc;
        }, {});
    }, [skills]);

    const sortedLevels = useMemo(() => levels.slice().sort((a, b) => a.meta.sort_order - b.meta.sort_order), [levels]);

    return (
        <>
            {isShareModalOpen && (
                <ShareLinkModal
                    link={shareableLink}
                    onClose={() => setShareModalOpen(false)}
                />
            )}
            <fieldset disabled={isReadOnly} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label htmlFor="swimmer-name" className="block text-sm font-medium text-slate-700">Swimmer Name</label>
                    <input type="text" id="swimmer-name" value={decodeEntities(swimmer.title)} onChange={(e) => onSwimmerChange('title', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                    <label htmlFor="parent-name" className="block text-sm font-medium text-slate-700">Parent Name</label>
                    <input type="text" id="parent-name" value={swimmer.meta.parent_name || ''} onChange={(e) => onSwimmerChange('parent_name', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                    <label htmlFor="parent-email" className="block text-sm font-medium text-slate-700">Parent Email</label>
                    <input type="email" id="parent-email" value={swimmer.meta.parent_email || ''} onChange={(e) => onSwimmerChange('parent_email', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                    <label htmlFor="dob" className="block text-sm font-medium text-slate-700">Date of Birth</label>
                    <input type="date" id="dob" value={swimmer.meta.date_of_birth || ''} onChange={(e) => onSwimmerChange('date_of_birth', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                    <label htmlFor="current-level" className="block text-sm font-medium text-slate-700">Current Level</label>
                    <select id="current-level" value={swimmer.meta.current_level || ''} onChange={(e) => onSwimmerChange('current_level', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">-- Select Level --</option>
                        {levels.map(level => <option key={level.id} value={level.id}>{decodeEntities(level.title.rendered)}</option>)}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-slate-700">Notes</label>
                    <textarea id="notes" value={swimmer.meta.notes || ''} onChange={(e) => onSwimmerChange('notes', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" rows="4"></textarea>
                </div>

                <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Progress Tracking</h3>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Levels Mastered</label>
                        <div className="flex flex-wrap gap-2">
                            {(swimmer.meta.levels_mastered || []).length > 0 ? (
                                levels
                                    .filter(level => (swimmer.meta.levels_mastered || []).includes(level.id))
                                    .sort((a, b) => a.meta.sort_order - b.meta.sort_order)
                                    .map(level => <span key={level.id} className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{decodeEntities(level.title.rendered)}</span>)
                            ) : <p className="text-sm text-slate-500">No levels mastered yet.</p>}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {sortedLevels.map(level => (
                            skillsByLevel[level.id] && skillsByLevel[level.id].length > 0 && (
                                <div key={level.id}>
                                    <h4 className="font-semibold text-slate-700 mb-2">{decodeEntities(level.title.rendered)}</h4>
                                    <ul className="space-y-2 pl-2">
                                        {skillsByLevel[level.id].sort((a, b) => a.meta.sort_order - b.meta.sort_order).map(skill => {
                                            const masteredSkill = (swimmer.meta.skills_mastered || []).find(s => s.skill_id === skill.id);
                                            return (
                                                <li key={skill.id} className="flex items-center gap-3">
                                                    <input type="checkbox" id={`skill-${skill.id}`} checked={!!masteredSkill} onChange={(e) => handleSkillMasteryChange(skill.id, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                                    <label htmlFor={`skill-${skill.id}`} className="flex-grow text-sm text-slate-800">{decodeEntities(skill.title.rendered)}</label>
                                                    {masteredSkill && <input id={`skill-date-${skill.id}`} type="date" value={masteredSkill.date} onChange={(e) => handleSkillDateChange(skill.id, e.target.value)} className="text-sm p-1 border border-slate-300 rounded-md" />}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-slate-800">Past Evaluations</h3>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleGenerateLink(swimmer.id)} disabled={isGenerating} className="inline-flex justify-center py-1.5 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Share Link'}
                            </button>
                            <button type="button" onClick={() => onRequestNewEvaluation(swimmer.id)} className="inline-flex justify-center py-1.5 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700">New Evaluation</button>
                        </div>
                    </div>
                    {isLoadingEvals ? (
                        <p className="text-slate-500">Loading evaluations...</p>
                    ) : evaluations.length > 0 ? (
                        <ul className="space-y-2">
                            {evaluations.map(evaluation => (
                                <li key={evaluation.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="text-sm font-medium text-slate-700">{decodeEntities(evaluation.title.rendered)} - <span className="text-slate-500 font-normal">{new Date(evaluation.date).toLocaleDateString()}</span></span>
                                    {typeof onEditEvaluation === 'function' && (
                                        <button type="button" onClick={() => onEditEvaluation(evaluation)} className="text-sm font-semibold text-green-600 hover:text-green-800">Edit</button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500">No past evaluations for this swimmer.</p>
                    )}
                </div>

            </fieldset>
            <div className="mt-8 flex justify-between items-center gap-4">
                {onDelete && !isReadOnly && (
                    <button type="button" onClick={onDelete} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Swimmer</button>
                )}
                <div className="flex items-center gap-4 ml-auto">
                    <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-600 hover:text-slate-800">Close</button>
                    {!isReadOnly && (
                        <button type="button" onClick={onSave} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                    )}
                </div>
            </div>
        </>
    );
};
export default SwimmerForm;
