/**
 * WordPress dependencies
 */
import { useState, useCallback, useContext } from "react";const { apiFetch } = wp;

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

const CampManager = ({ campTaxSlug }) => {
    const { camps, populateState } = useContext(DataContext);
    const [selectedCamp, setSelectedCamp] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const handleSelectCamp = useCallback((camp) => {
        setSelectedCamp(camp);
        setIsCreating(false);
    }, []);

    const handleNewCamp = useCallback(() => {
        setIsCreating(true);
        setSelectedCamp({ name: '' });
    }, []);

    const handleCampNameChange = useCallback((name) => {
        setSelectedCamp(prev => ({ ...prev, name }));
    }, []);

    const handleSaveCamp = useCallback(async () => {
        if (!selectedCamp || !selectedCamp.name.trim()) {
            alert('Camp name cannot be empty.');
            return;
        }
        setIsSaving(true);

        const method = 'POST';
        const path = isCreating ? `/wp/v2/${campTaxSlug}` : `/wp/v2/${campTaxSlug}/${selectedCamp.id}`;
        const payload = { name: selectedCamp.name };

        try {
            await apiFetch({ path, method, data: payload });
            setFeedbackMessage(`Camp ${isCreating ? 'created' : 'updated'} successfully!`);
            await apiClient.refreshEssentialData(populateState);
            setIsSaving(false);
            setIsCreating(false);
            setSelectedCamp(null);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            console.error('Error saving camp:', error);
            alert('Error saving camp. Check console for details.');
            setIsSaving(false);
        }
    }, [selectedCamp, isCreating, campTaxSlug, populateState]);

    const handleDeleteCamp = useCallback(async (campId) => {
        if (window.confirm('Are you sure you want to delete this camp? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiFetch({ path: `/wp/v2/${campTaxSlug}/${campId}`, method: 'DELETE', data: { force: true } });
                setFeedbackMessage('Camp deleted successfully!');
                await apiClient.refreshEssentialData(populateState);
                setIsSaving(false);
                setSelectedCamp(null);
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                console.error('Error deleting camp:', error);
                alert('Error deleting camp. Check console for details.');
                setIsSaving(false);
            }
        }
    }, [campTaxSlug, populateState]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Camps</h2>
                    <button onClick={handleNewCamp} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">+ New</button>
                </div>
                <ul className="space-y-2">
                    {camps.map(camp => (
                        <li key={camp.id}>
                            <button onClick={() => handleSelectCamp(camp)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedCamp && selectedCamp.id === camp.id ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                <span className="font-semibold text-slate-800">{decodeEntities(camp.name)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="md:col-span-2">
                {(selectedCamp || isCreating) && (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-3">{isCreating ? 'Create New Camp' : `Editing: ${decodeEntities(selectedCamp.name)}`}</h2>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="camp-name" className="block text-sm font-medium text-slate-700">Camp Name</label>
                                <input type="text" id="camp-name" value={decodeEntities(selectedCamp.name)} onChange={(e) => handleCampNameChange(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={handleSaveCamp} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isSaving ? 'Saving...' : (isCreating ? 'Create Camp' : 'Save Changes')}</button>
                                {feedbackMessage && <p className="text-green-600 font-semibold">{feedbackMessage}</p>}
                            </div>
                            {!isCreating && selectedCamp && (
                                <button onClick={() => handleDeleteCamp(selectedCamp.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Camp</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampManager;