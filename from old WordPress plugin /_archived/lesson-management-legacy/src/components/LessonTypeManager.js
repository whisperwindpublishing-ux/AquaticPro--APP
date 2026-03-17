/**
 * WordPress dependencies
 */
import { useState, useCallback, useContext } from "react";
const { apiFetch } = wp;

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

const LessonTypeManager = ({ lessonTypeTaxSlug }) => {
    const { lessonTypes, populateState } = useContext(DataContext);
    const [selectedLessonType, setSelectedLessonType] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const handleSelectLessonType = useCallback((lessonType) => {
        setSelectedLessonType(lessonType);
        setIsCreating(false);
    }, []);

    const handleNewLessonType = useCallback(() => {
        setIsCreating(true);
        setSelectedLessonType({ name: '' });
    }, []);

    const handleLessonTypeNameChange = useCallback((name) => {
        setSelectedLessonType(prev => ({ ...prev, name }));
    }, []);

    const handleSaveLessonType = useCallback(async () => {
        if (!selectedLessonType || !selectedLessonType.name.trim()) {
            alert('Lesson Type name cannot be empty.');
            return;
        }
        setIsSaving(true);

        const method = 'POST';
        const path = isCreating ? `/wp/v2/${lessonTypeTaxSlug}` : `/wp/v2/${lessonTypeTaxSlug}/${selectedLessonType.id}`;
        const payload = { name: selectedLessonType.name };

        try {
            await apiFetch({ path, method, data: payload });
            setFeedbackMessage(`Lesson Type ${isCreating ? 'created' : 'updated'} successfully!`);
            await apiClient.refreshEssentialData(populateState);
            setIsSaving(false);
            setIsCreating(false);
            setSelectedLessonType(null);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            console.error('Error saving lesson type:', error);
            alert('Error saving lesson type. Check console for details.');
            setIsSaving(false);
        }
    }, [selectedLessonType, isCreating, lessonTypeTaxSlug, populateState]);

    const handleDeleteLessonType = useCallback(async (lessonTypeId) => {
        if (window.confirm('Are you sure you want to delete this lesson type? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiFetch({ path: `/wp/v2/${lessonTypeTaxSlug}/${lessonTypeId}`, method: 'DELETE', data: { force: true } });
                setFeedbackMessage('Lesson Type deleted successfully!');
                await apiClient.refreshEssentialData(populateState);
                setIsSaving(false);
                setSelectedLessonType(null);
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                console.error('Error deleting lesson type:', error);
                alert('Error deleting lesson type. Check console for details.');
                setIsSaving(false);
            }
        }
    }, [lessonTypeTaxSlug, populateState]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Lesson Types</h2>
                    <button onClick={handleNewLessonType} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">+ New</button>
                </div>
                <ul className="space-y-2">
                    {lessonTypes.map(lessonType => (
                        <li key={lessonType.id}>
                            <button onClick={() => handleSelectLessonType(lessonType)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedLessonType && selectedLessonType.id === lessonType.id ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                <span className="font-semibold text-slate-800">{decodeEntities(lessonType.name)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="md:col-span-2">
                {(selectedLessonType || isCreating) && (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-3">{isCreating ? 'Create New Lesson Type' : `Editing: ${decodeEntities(selectedLessonType.name)}`}</h2>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="lesson-type-name" className="block text-sm font-medium text-slate-700">Lesson Type Name</label>
                                <input type="text" id="lesson-type-name" value={decodeEntities(selectedLessonType.name)} onChange={(e) => handleLessonTypeNameChange(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={handleSaveLessonType} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isSaving ? 'Saving...' : (isCreating ? 'Create' : 'Save Changes')}</button>
                                {feedbackMessage && <p className="text-green-600 font-semibold">{feedbackMessage}</p>}
                            </div>
                            {!isCreating && selectedLessonType && (
                                <button onClick={() => handleDeleteLessonType(selectedLessonType.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonTypeManager;