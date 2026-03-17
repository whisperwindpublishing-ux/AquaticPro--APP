/**
 * WordPress dependencies
 */
import { render } from 'react-dom';
import React, { useState, useEffect, useCallback, useRef, useContext, Fragment, Suspense, lazy } from 'react';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

/**
 * Component Imports - Lazy load heavy manager components
 */
import ErrorBoundary from './components/ErrorBoundary';
import { apiClient } from './api';
import DataContext, { DataProvider } from './context/DataContext';

// Lazy load manager components for better code splitting
const GroupManager = lazy(() => import('./components/GroupManager'));
const SwimmerManager = lazy(() => import('./components/SwimmerManager'));
const EvaluationManager = lazy(() => import('./components/EvaluationManager'));
const CampOrganizer = lazy(() => import('./components/CampOrganizer'));
const LevelManager = lazy(() => import('./components/LevelManager'));
const SkillManager = lazy(() => import('./components/SkillManager'));
const CampManager = lazy(() => import('./components/CampManager'));
const AnimalManager = lazy(() => import('./components/AnimalManager'));
const LessonTypeManager = lazy(() => import('./components/LessonTypeManager'));

/**
 * Decodes HTML entities from a string.
 * @param {string} str The string to decode.
 * @returns {string} The decoded string.
 */
const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

/**
 * Main App Component
 * This is the root of our React application.
 */
const App = () => {
    // State to manage the active tab and data
    const [activeTab, setActiveTab] = useState('groups');
    const [newEvaluationDefaults, setNewEvaluationDefaults] = useState(null);
    const { isLoading } = useContext(DataContext);
    const [isSettingsMenuOpen, setSettingsMenuOpen] = useState(false);
    const [groupSearchTerm, setGroupSearchTerm] = useState('');
    const [swimmerSearchTerm, setSwimmerSearchTerm] = useState('');
    const [evaluationSearchTerm, setEvaluationSearchTerm] = useState('');

    // State for paginated data
    const [swimmers, setSwimmers] = useState({ items: [], page: 0, totalPages: 1 });
    const [groups, setGroups] = useState({ items: [], page: 0, totalPages: 1 });
    const [evaluations, setEvaluations] = useState({ items: [], page: 0, totalPages: 1 });
    const [isSwimmersLoading, setIsSwimmersLoading] = useState(false);
    const [isGroupsLoading, setIsGroupsLoading] = useState(false);
    const [isEvaluationsLoading, setIsEvaluationsLoading] = useState(false);

    // Effect to handle searching swimmers
    useEffect(() => {
        const handler = setTimeout(() => {
            setSwimmers({ items: [], page: 0, totalPages: 1 });
        }, 500); // Debounce search input
        return () => clearTimeout(handler);
    }, [swimmerSearchTerm]);

    // Effect to handle searching groups
    useEffect(() => {
        const handler = setTimeout(() => {
            setGroups({ items: [], page: 0, totalPages: 1 });
        }, 500); // Debounce search input
        return () => clearTimeout(handler);
    }, [groupSearchTerm]);

    // Effect to handle searching evaluations
    useEffect(() => {
        const handler = setTimeout(() => {
            setEvaluations({ items: [], page: 0, totalPages: 1 });
        }, 500); // Debounce search input
        return () => clearTimeout(handler);
    }, [evaluationSearchTerm]);

    // Effect to trigger a fetch when a new search begins
    useEffect(() => {
        if (swimmers.items.length === 0 && !isSwimmersLoading && activeTab === 'swimmers') {
            loadMoreSwimmers();
        }
    }, [swimmers.items, activeTab]);

    useEffect(() => {
        if (groups.items.length === 0 && !isGroupsLoading && activeTab === 'groups') {
            loadMoreGroups();
        }
    }, [groups.items, activeTab]);

    useEffect(() => {
        if (evaluations.items.length === 0 && !isEvaluationsLoading && activeTab === 'evaluations') {
            loadMoreEvaluations();
        }
    }, [evaluations.items, activeTab]);


    // Function to load the next page of swimmers
    const loadMoreSwimmers = useCallback(async () => {
        const isNewSearch = swimmers.page === 0 && swimmers.items.length === 0;
        const nextPage = isNewSearch ? 1 : swimmers.page + 1;

        if (isSwimmersLoading || (!isNewSearch && swimmers.page >= swimmers.totalPages)) {
            return;
        }

        setIsSwimmersLoading(true);
        try {
            const { data, totalPages } = await apiClient.fetchSwimmersPage({ postTypes: LMData.post_types }, nextPage, swimmerSearchTerm);
            setSwimmers(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages: totalPages,
            }));
        } catch (error) {
            console.error("Failed to load swimmers:", error);
        } finally {
            setIsSwimmersLoading(false);
        }
    }, [isSwimmersLoading, swimmers, swimmerSearchTerm]);

    // Function to load the next page of groups
    const loadMoreGroups = useCallback(async () => {
        const isNewSearch = groups.page === 0 && groups.items.length === 0;
        const nextPage = isNewSearch ? 1 : groups.page + 1;

        if (isGroupsLoading || (!isNewSearch && groups.page >= groups.totalPages)) {
            return;
        }

        setIsGroupsLoading(true);
        try {
            const { data, totalPages } = await apiClient.fetchGroupsPage({ postTypes: LMData.post_types }, nextPage, groupSearchTerm);
            setGroups(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages: totalPages,
            }));
        } catch (error) {
            console.error("Failed to load groups:", error);
        } finally {
            setIsGroupsLoading(false);
        }
    }, [isGroupsLoading, groups, groupSearchTerm]);

    const loadMoreEvaluations = useCallback(async () => {
        const isNewSearch = evaluations.page === 0 && evaluations.items.length === 0;
        const nextPage = isNewSearch ? 1 : evaluations.page + 1;

        if (isEvaluationsLoading || (!isNewSearch && evaluations.page >= evaluations.totalPages)) {
            return;
        }

        setIsEvaluationsLoading(true);
        try {
            const { data, totalPages } = await apiClient.fetchEvaluationsPage({ postTypes: LMData.post_types }, nextPage, evaluationSearchTerm);
            setEvaluations(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages: totalPages,
            }));
        } catch (error) {
            console.error("Failed to load evaluations:", error);
        } finally {
            setIsEvaluationsLoading(false);
        }
    }, [isEvaluationsLoading, evaluations, evaluationSearchTerm]);


    const handleRequestNewEvaluation = useCallback((swimmerId) => {
        setNewEvaluationDefaults({ swimmer: swimmerId });
        setActiveTab('evaluations');
    }, []);

    const tabs = [
        { id: 'groups', label: 'Groups' },
        { id: 'swimmers', label: 'Swimmers' },
        { id: 'evaluations', label: 'Evaluations' },
        { id: 'camp-organizer', label: 'Camp Organizer' },
    ];

    const tabColorClasses = {
        groups: 'bg-indigo-600/10 text-indigo-700 border-indigo-600',
        swimmers: 'bg-green-600/10 text-green-700 border-green-600',
        evaluations: 'bg-violet-600/10 text-violet-700 border-violet-600',
        'camp-organizer': 'bg-orange-500/10 text-orange-700 border-orange-500',
        default: 'bg-slate-600/10 text-slate-700 border-slate-600',
    };

    return (
        <div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-6">Lesson Management</h1>

            <div className="flex justify-between items-center border-b-2 border-slate-200 mb-8 bg-white/70 backdrop-blur-sm sticky top-8 z-10 rounded-t-lg shadow-sm p-2">
                <nav className="flex space-x-2 lg:space-x-4" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <a
                            key={tab.id}
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab(tab.id);
                            }}
                            className={`
                                ${activeTab === tab.id
                                    ? `${tabColorClasses[tab.id] || tabColorClasses.default} shadow-sm`
                                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                }
                                whitespace-nowrap px-4 py-2 font-semibold text-sm rounded-lg transition-all duration-200 border-b-2
                            `}
                        >
                            {tab.label}
                        </a>
                    ))}
                </nav>

                <div className="relative">
                    <button
                        onClick={() => setSettingsMenuOpen(!isSettingsMenuOpen)}
                        className="p-2 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>
                    {isSettingsMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('levels'); setSettingsMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Levels</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('skills'); setSettingsMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Skills</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('camps_admin'); setSettingsMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Camps</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('animals_admin'); setSettingsMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Animals</a>
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('lesson_types_admin'); setSettingsMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Lesson Types</a>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <ErrorBoundary>
                    {isLoading ? <p className="text-slate-500 p-4">Loading essential data...</p> : (
                        <Suspense fallback={<div className="text-slate-500 p-4">Loading component...</div>}>
                            {activeTab === 'groups' &&
                                <GroupManager
                                    groups={groups}
                                    setGroups={setGroups}
                                    setSwimmers={setSwimmers}
                                    fetchGroups={loadMoreGroups}
                                    groupCptSlug={LMData.post_types.group}
                                    decodeEntities={decodeEntities}
                                    loadMoreGroups={loadMoreGroups}
                                    hasMoreGroups={groups.page < groups.totalPages} isGroupsLoading={isGroupsLoading}
                                    groupSearchTerm={groupSearchTerm} setGroupSearchTerm={setGroupSearchTerm}
                                    onRequestNewEvaluation={handleRequestNewEvaluation}
                                />
                                
                            }
                            {activeTab === 'swimmers' &&
                                <SwimmerManager
                                    swimmers={swimmers}
                                    setSwimmers={setSwimmers}
                                    swimmerCptSlug={LMData.post_types.swimmer}
                                    onRequestNewEvaluation={handleRequestNewEvaluation}
                                    loadMoreSwimmers={loadMoreSwimmers}
                                    hasMoreSwimmers={swimmers.page < swimmers.totalPages}
                                    isSwimmersLoading={isSwimmersLoading}
                                    searchTerm={swimmerSearchTerm}
                                    setSearchTerm={setSwimmerSearchTerm}
                                />
                            }
                            {activeTab === 'evaluations' &&
                                <EvaluationManager
                                    evaluations={evaluations}
                                    setEvaluations={setEvaluations}
                                    evaluationCptSlug={LMData.post_types.evaluation}
                                    newEvaluationDefaults={newEvaluationDefaults}
                                    onDefaultsConsumed={() => setNewEvaluationDefaults(null)}
                                    loadMoreEvaluations={loadMoreEvaluations}
                                    hasMoreEvaluations={evaluations.page < evaluations.totalPages}
                                    isEvaluationsLoading={isEvaluationsLoading}
                                    searchTerm={evaluationSearchTerm}
                                    setSearchTerm={setEvaluationSearchTerm}
                                />
                            }
                            {activeTab === 'camp-organizer' && <CampOrganizer />}
                            {activeTab === 'levels' && <LevelManager levelCptSlug={LMData.post_types.level} />}
                            {activeTab === 'skills' && <SkillManager />}
                            {activeTab === 'camps_admin' && <CampManager campTaxSlug={LMData.taxonomies.camp} />}
                            {activeTab === 'animals_admin' && <AnimalManager animalTaxSlug={LMData.taxonomies.animal} />}
                            {activeTab === 'lesson_types_admin' && <LessonTypeManager lessonTypeTaxSlug={LMData.taxonomies.lesson_type} />}
                        </Suspense>
                    )}
                </ErrorBoundary>
            </div>
        </div>
    );
};

/**
 * Render the App to the DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.getElementById('lm-admin-app');
    if (appRoot) {
        render(
            <DataProvider>
                <App />
            </DataProvider>,
            appRoot
        );
    }
});