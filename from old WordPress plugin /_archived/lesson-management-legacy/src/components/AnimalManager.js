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

const AnimalManager = ({ animalTaxSlug }) => {
    const { animals, setAnimals } = useContext(DataContext);
    const [selectedAnimal, setSelectedAnimal] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const handleSelectAnimal = useCallback((animal) => {
        setSelectedAnimal(animal);
        setIsCreating(false);
    }, []);

    const handleNewAnimal = useCallback(() => {
        setIsCreating(true);
        setSelectedAnimal({ name: '' });
    }, []);

    const handleAnimalNameChange = useCallback((name) => {
        setSelectedAnimal(prev => ({ ...prev, name }));
    }, []);

    const handleSaveAnimal = useCallback(async () => {
        if (!selectedAnimal || !selectedAnimal.name.trim()) {
            alert('Animal name cannot be empty.');
            return;
        }
        setIsSaving(true);

        const method = 'POST';
        const path = isCreating ? `/wp/v2/${animalTaxSlug}` : `/wp/v2/${animalTaxSlug}/${selectedAnimal.id}`;
        const payload = { name: selectedAnimal.name };

        try {
            const savedAnimal = await apiFetch({ path, method, data: payload });
            setFeedbackMessage(`Animal ${isCreating ? 'created' : 'updated'} successfully!`);
            
            // Update state locally instead of re-fetching all essential data
            setAnimals(prevAnimals => {
                if (isCreating) {
                    return [...prevAnimals, savedAnimal];
                } else {
                    return prevAnimals.map(animal => animal.id === savedAnimal.id ? savedAnimal : animal);
                }
            });

            setIsSaving(false);
            setIsCreating(false);
            setSelectedAnimal(null);
            setTimeout(() => setFeedbackMessage(''), 3000);
        } catch (error) {
            console.error('Error saving animal:', error);
            alert('Error saving animal. Check console for details.');
            setIsSaving(false);
        }
    }, [selectedAnimal, isCreating, animalTaxSlug, setAnimals]);

    const handleDeleteAnimal = useCallback(async (animalId) => {
        if (window.confirm('Are you sure you want to delete this animal? This cannot be undone.')) {
            setIsSaving(true);
            try {
                await apiFetch({ path: `/wp/v2/${animalTaxSlug}/${animalId}`, method: 'DELETE', data: { force: true } });
                setFeedbackMessage('Animal deleted successfully!');

                // Update state locally
                setAnimals(prevAnimals => prevAnimals.filter(animal => animal.id !== animalId));

                setIsSaving(false);
                setSelectedAnimal(null);
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                console.error('Error deleting animal:', error);
                alert('Error deleting animal. Check console for details.');
                setIsSaving(false);
            }
        }
    }, [animalTaxSlug, setAnimals]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-lg h-min">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-slate-900">All Animals</h2>
                    <button onClick={handleNewAnimal} className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">+ New</button>
                </div>
                <ul className="space-y-2">
                    {animals.map(animal => (
                        <li key={animal.id}>
                            <button onClick={() => handleSelectAnimal(animal)} className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${selectedAnimal && selectedAnimal.id === animal.id ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}>
                                <span className="font-semibold text-slate-800">{decodeEntities(animal.name)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="md:col-span-2">
                {(selectedAnimal || isCreating) && (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-3">{isCreating ? 'Create New Animal' : `Editing: ${decodeEntities(selectedAnimal.name)}`}</h2>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="animal-name" className="block text-sm font-medium text-slate-700">Animal Name</label>
                                <input type="text" id="animal-name" value={decodeEntities(selectedAnimal.name)} onChange={(e) => handleAnimalNameChange(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={handleSaveAnimal} disabled={isSaving} className="inline-flex justify-center py-2 px-5 border border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isSaving ? 'Saving...' : (isCreating ? 'Create Animal' : 'Save Changes')}</button>
                                {feedbackMessage && <p className="text-green-600 font-semibold">{feedbackMessage}</p>}
                            </div>
                            {!isCreating && selectedAnimal && (
                                <button onClick={() => handleDeleteAnimal(selectedAnimal.id)} disabled={isSaving} className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">Delete Animal</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnimalManager;