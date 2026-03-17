/**
 * WordPress dependencies
 */
import { createContext, useState, useEffect, useCallback } from "react";
const { apiFetch } = wp;

/**
 * Internal dependencies
 */
import { apiClient } from '../api';

/**
 * Create a context for our shared data.
 * This will hold non-paginated data like levels, skills, users, etc.,
 * which are used in dropdowns and other parts of the UI.
 */
const DataContext = createContext({
    levels: [],
    skills: [],
    users: [],
    camps: [],
    animals: [],
    lessonTypes: [],
    setLevels: () => {},
    setSkills: () => {},
    setUsers: () => {},
    setCamps: () => {},
    setAnimals: () => {},
    setLessonTypes: () => {},
    isLoading: true,
    personCache: new Map(),
    updatePersonCache: () => {},
    populateState: () => {},
});

/**
 * The DataProvider component is responsible for fetching the essential data
 * and making it available to all child components through the DataContext.
 */
export const DataProvider = ({ children }) => {
    const [levels, setLevels] = useState([]);
    const [skills, setSkills] = useState([]);
    const [users, setUsers] = useState([]);
    const [camps, setCamps] = useState([]);
    const [animals, setAnimals] = useState([]);
    const [lessonTypes, setLessonTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [personCache, setPersonCache] = useState(new Map());

    const populateState = useCallback((data) => {
        setLevels((data.levels || []).sort((a, b) => a.meta.sort_order - b.meta.sort_order));
        setSkills(data.skills || []);
        setUsers(data.users || []);
        setCamps(data.camps || []);
        setAnimals(data.animals || []);
        setLessonTypes(data.lessonTypes || []);
        setIsLoading(false);
    }, []);

    const handleUpdatePersonCache = useCallback((people) => {
        if (!people || people.length === 0) return;
        setPersonCache(prevCache => {
            const newCache = new Map(prevCache);
            people.forEach(person => {
                if (person && person.id) { // Ensure person and person.id are valid
                    newCache.set(person.id, person);
                }
            });
            return newCache;
        });
    }, []);

    // Fetch the data when the provider is first mounted.
    useEffect(() => {
        // Check for preloaded data first to avoid an unnecessary API call.
        if (window.LM_PRELOADED_DATA) {
            populateState(window.LM_PRELOADED_DATA);
        } else {
            // Fallback to API fetch if preloaded data is not available.
            apiFetch({ path: '/lm/v1/essential-data' })
                .then(populateState)
                .catch((error) => {
                    console.error('Error fetching essential data:', error);
                    setIsLoading(false);
                });
        }
    }, [populateState]); // Empty dependency array ensures this runs only once.

    const value = { levels, skills, users, camps, animals, lessonTypes, isLoading, setLevels, setSkills, setUsers, setCamps, setAnimals, setLessonTypes, populateState, personCache, updatePersonCache: handleUpdatePersonCache };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export default DataContext;