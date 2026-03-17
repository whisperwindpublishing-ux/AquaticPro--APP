/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useContext } from "react";const { apiFetch } = wp;

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

const LevelManager = ({ levelCptSlug }) => {
    const { levels, populateState } = useContext(DataContext);

    const [selectedLevel, setSelectedLevel] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    // When the selected level changes, update the form data
    useEffect(() => {
        if (selectedLevel && selectedLevel.id) {
            const levelData = levels.find(l => l.id === selectedLevel.id);
            setSelectedLevel(levelData ? { ...levelData, title: levelData.title.rendered } : null);
        }
    }, [levels, selectedLevel?.id]);

    const handleSelectLevel = useCallback((level) => {
        setSelectedLevel({ ...level, title: level.title.rendered });
        setIsCreating(false);
    }, []);

    const handleNewLevel = useCallback(() => {
        setIsCreating(true);
        setSelectedLevel({ title: '', meta: { sort_order: '' } });
    }, []);

    const handleLevelChange = useCallback((key, value, isMeta = false) => {
        setSelectedLevel(prev => {
            if (isMeta) {
                return { ...prev, meta: { ...prev.meta, [key]: value } };
            }
            return { ...prev, [key]: value };
        });
    }, []);

    const handleSaveLevel = useCallback(async () => {
        if (!selectedLevel) return;
        setIsSaving(true);

        const method = 'POST';
        const path = isCreating ? `/wp/v2/${levelCptSlug}` : `/wp/v2/${levelCptSlug}/${selectedLevel.id}`;
        const payload = {
            title: selectedLevel.title,
            status: 'publish',
            meta: {
                sort_order: selectedLevel.meta.sort_order ? parseInt(selectedLevel.meta.sort_order, 10) : 0,
            },
        };

        try {
            await apiFetch({ path, method, data: payload });
            setFeedbackMessage(`Level ${isCreating ? 'created' : 'updated'} successfully!`);
            await apiClient.refreshEssentialData(populateState);
            setIsSaving(false);
            setIsCreating(false);
            setSelectedLevel(null);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            alert('Error saving level.');
            setIsSaving(false);
        }
    }, [selectedLevel, isCreating, levelCptSlug, populateState]);

    const handleDeleteLevel = useCallback(async (levelId) => {
        if (window.confirm('Are you sure you want to delete this level? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiFetch({ path: `/wp/v2/${levelCptSlug}/${levelId}`, method: 'DELETE' });
                setFeedbackMessage('Level deleted successfully!');
                await apiClient.refreshEssentialData(populateState);
                setIsSaving(false);
                setSelectedLevel(null);
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                alert('Error deleting level.');
                setIsSaving(false);
            }
        }
    }, [levelCptSlug, populateState]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Levels</h2>
                    <button onClick={handleNewLevel} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">+ New</button>
                </div>
                <ul className="space-y-2">
                    {levels.slice().sort((a, b) => a.meta.sort_order - b.meta.sort_order).map(level => (
                        <li key={level.id}>
                            <button onClick={() => handleSelectLevel(level)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedLevel && selectedLevel.id === level.id ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                <span className="font-semibold text-slate-800">{decodeEntities(level.title.rendered)}</span>
                                <span className="text-sm text-slate-500 ml-2">(Order: {level.meta.sort_order})</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="md:col-span-2">
                {(selectedLevel || isCreating) && (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-3">{isCreating ? 'Create New Level' : `Editing: ${decodeEntities(selectedLevel.title)}`}</h2>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="level-title" className="block text-sm font-medium text-slate-700">Level Name</label>
                                <input type="text" id="level-title" value={decodeEntities(selectedLevel.title)} onChange={(e) => handleLevelChange('title', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label htmlFor="level-sort-order" className="block text-sm font-medium text-slate-700">Sort Order</label>
                                <input type="number" id="level-sort-order" value={selectedLevel.meta.sort_order} onChange={(e) => handleLevelChange('sort_order', e.target.value, true)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={handleSaveLevel} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isSaving ? 'Saving...' : (isCreating ? 'Create Level' : 'Save Changes')}</button>
                                {feedbackMessage && <p className="text-green-600 font-semibold transition-opacity duration-300">{feedbackMessage}</p>}
                            </div>
                            {!isCreating && selectedLevel && (
                                <button onClick={() => handleDeleteLevel(selectedLevel.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Level</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LevelManager;