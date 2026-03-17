import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/Button';
import {
    HiOutlineLockClosed,
    HiOutlineUserGroup,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineAcademicCap,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineUser,
    HiOutlineExclamationTriangle,
    HiOutlineQueueList,
    HiOutlineRectangleGroup,
    HiOutlineArrowLeftOnRectangle
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Group, Swimmer, Level, Camp, Animal } from '@/types/lessons';

interface CampRostersProps {
    apiUrl: string;
    nonce: string;
    isPublic?: boolean; // Whether this is a public view requiring password
}

interface CampData {
    [animalId: string]: {
        groups: Group[];
        swimmers: Map<number, Swimmer>;
    };
}

const CampRosters: React.FC<CampRostersProps> = ({ apiUrl, nonce, isPublic = false }) => {
    // Authentication state (for public access)
    const [isAuthenticated, setIsAuthenticated] = useState(!isPublic);
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    // Data state
    const [camps, setCamps] = useState<Camp[]>([]);
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [levels, setLevels] = useState<Level[]>([]);
    const [selectedCamp, setSelectedCamp] = useState<number | null>(null);
    const [campData, setCampData] = useState<CampData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [collapsedAnimals, setCollapsedAnimals] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'animal' | 'swimmer'>('animal');

    // Simple alphabetical sort for swimmer names (just use the title field directly)
    const sortSwimmersByName = (swimmers: Swimmer[]): Swimmer[] => {
        return [...swimmers].sort((a, b) => {
            const nameA = a.title?.rendered || '';
            const nameB = b.title?.rendered || '';
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });
    };

    // Sort swimmers alphabetically by name
    const sortSwimmerIds = (swimmerIds: number[], swimmerMap: Map<number, Swimmer>): number[] => {
        return [...swimmerIds].sort((a, b) => {
            const swimmerA = swimmerMap.get(a);
            const swimmerB = swimmerMap.get(b);
            const nameA = swimmerA?.title?.rendered || '';
            const nameB = swimmerB?.title?.rendered || '';
            // Simple alphabetical sort - works correctly for "Last, First" format
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });
    };

    // Sort groups by title alphabetically
    const sortGroups = (groups: Group[]): Group[] => {
        return [...groups].sort((a, b) => {
            const nameA = a.title?.rendered || '';
            const nameB = b.title?.rendered || '';
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });
    };

    // Check for existing session on mount
    useEffect(() => {
        const storedToken = sessionStorage.getItem('camp_roster_token');
        if (storedToken && isPublic) {
            // Verify the token is still valid
            verifyToken(storedToken);
        }
    }, [isPublic]);

    const verifyToken = async (token: string) => {
        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/camp-roster/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            });

            if (response.ok) {
                setSessionToken(token);
                setIsAuthenticated(true);
            } else {
                sessionStorage.removeItem('camp_roster_token');
            }
        } catch (err) {
            sessionStorage.removeItem('camp_roster_token');
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthenticating(true);
        setAuthError(null);

        try {
            const response = await fetch(`${apiUrl}mentorship-platform/v1/lessons/camp-roster/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSessionToken(data.token);
                sessionStorage.setItem('camp_roster_token', data.token);
                setIsAuthenticated(true);
                setPassword('');
            } else {
                setAuthError(data.message || 'Invalid password');
            }
        } catch (err) {
            setAuthError('Failed to verify password. Please try again.');
        } finally {
            setIsAuthenticating(false);
        }
    };

    // Load initial data once authenticated
    useEffect(() => {
        if (isAuthenticated) {
            loadInitialData();
        }
    }, [isAuthenticated]);

    const loadInitialData = async () => {
        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setCamps([]);
            setAnimals([]);
            setLevels([]);
            return;
        }

        setIsLoading(true);
        try {
            const headers: Record<string, string> = {};
            // Only include nonce if it's not empty (authenticated request)
            if (nonce) {
                headers['X-WP-Nonce'] = nonce;
            }
            if (sessionToken) {
                headers['X-Camp-Roster-Token'] = sessionToken;
            }

            console.log('[CampRosters] Loading initial data with apiUrl:', apiUrl);
            console.log('[CampRosters] Headers:', headers);

            // Load camps, animals, and levels in parallel
            const [campsRes, animalsRes, levelsRes] = await Promise.all([
                fetch(`${apiUrl}wp/v2/lm_camp?per_page=100`, { headers }),
                fetch(`${apiUrl}wp/v2/lm_animal?per_page=100`, { headers }),
                fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, { headers }),
            ]);

            console.log('[CampRosters] Camps response status:', campsRes.status);
            console.log('[CampRosters] Animals response status:', animalsRes.status);
            console.log('[CampRosters] Levels response status:', levelsRes.status);

            if (campsRes.ok) {
                const campsData = await campsRes.json();
                console.log('[CampRosters] Camps loaded:', campsData);
                setCamps(campsData);
            } else {
                console.error('[CampRosters] Failed to load camps:', await campsRes.text());
                // Don't show error banner for permission failures - just log it
            }
            if (animalsRes.ok) {
                const animalsData = await animalsRes.json();
                console.log('[CampRosters] Animals loaded:', animalsData);
                setAnimals(animalsData);
            } else {
                console.error('[CampRosters] Failed to load animals:', await animalsRes.text());
                // Don't show error banner for permission failures - just log it
            }
            if (levelsRes.ok) {
                const levelsData = await levelsRes.json();
                console.log('[CampRosters] Levels loaded:', levelsData);
                setLevels(levelsData);
            } else {
                console.error('[CampRosters] Failed to load levels:', await levelsRes.text());
                // Don't show error banner for permission failures - just log it
            }
        } catch (err) {
            console.error('[CampRosters] Error loading data:', err);
            // Don't show error banner during initial load - permissions are handled by role settings
        } finally {
            setIsLoading(false);
        }
    };

    // Load camp data when a camp is selected
    useEffect(() => {
        if (selectedCamp) {
            loadCampData();
        } else {
            setCampData(null);
        }
    }, [selectedCamp]);

    const loadCampData = async () => {
        if (!selectedCamp) return;

        // Visitor Mode Check
        if (window.mentorshipPlatformData?.visitor_mode) {
            setCampData(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const headers: Record<string, string> = {};
            // Only include nonce if it's not empty (authenticated request)
            if (nonce) {
                headers['X-WP-Nonce'] = nonce;
            }
            if (sessionToken) {
                headers['X-Camp-Roster-Token'] = sessionToken;
            }

            // Try the optimized cached endpoint first
            let groups: Group[] = [];
            let swimmersMap = new Map<number, Swimmer>();
            
            try {
                const cachedRes = await fetch(
                    `${apiUrl}mentorship-platform/v1/lessons/camp-roster/data?camp_id=${selectedCamp}`,
                    { headers }
                );
                
                if (cachedRes.ok) {
                    const cachedData = await cachedRes.json();
                    if (cachedData.success && cachedData.data) {
                        console.log('[CampRosters] Using cached endpoint, cached:', cachedData.cached);
                        groups = cachedData.data.groups || [];
                        // Convert swimmers object to Map
                        const swimmersObj = cachedData.data.swimmers || {};
                        Object.values(swimmersObj).forEach((swimmer: any) => {
                            swimmersMap.set(swimmer.id, swimmer as Swimmer);
                        });
                    }
                }
            } catch (cacheErr) {
                console.log('[CampRosters] Cached endpoint not available, falling back to standard API');
            }
            
            // Fall back to standard API if cached endpoint didn't work
            if (groups.length === 0) {
                const groupsRes = await fetch(
                    `${apiUrl}wp/v2/lm-group?lm_camp=${selectedCamp}&per_page=100`,
                    { headers }
                );

                if (!groupsRes.ok) {
                    throw new Error('Failed to load groups');
                }

                const allGroups: Group[] = await groupsRes.json();
                
                // Filter out archived groups
                groups = allGroups.filter(group => !group.meta?.archived);
                
                // Collect swimmer IDs for batch fetch
                const swimmerIds = new Set<number>();
                groups.forEach(group => {
                    (group.meta?.swimmers || []).forEach(id => swimmerIds.add(id));
                });
                
                // Fetch swimmer details
                if (swimmerIds.size > 0) {
                    const swimmerRes = await fetch(
                        `${apiUrl}wp/v2/lm-swimmer?include=${[...swimmerIds].join(',')}&per_page=100&_fields=id,title,meta`,
                        { headers }
                    );

                    if (swimmerRes.ok) {
                        const swimmersData: Swimmer[] = await swimmerRes.json();
                        swimmersData.forEach(swimmer => {
                            swimmersMap.set(swimmer.id, swimmer);
                        });
                    }
                }
            }

            // Organize groups by animal
            const dataByAnimal: CampData = {};

            groups.forEach(group => {
                const animalTerms = group.lm_animal || [];
                const animalId = animalTerms[0]?.toString() || 'unassigned';

                if (!dataByAnimal[animalId]) {
                    dataByAnimal[animalId] = {
                        groups: [],
                        swimmers: new Map(),
                    };
                }

                dataByAnimal[animalId].groups.push(group);

                // Add swimmers to their respective animal groups
                (group.meta?.swimmers || []).forEach(swimmerId => {
                    const swimmer = swimmersMap.get(swimmerId);
                    if (swimmer) {
                        dataByAnimal[animalId].swimmers.set(swimmerId, swimmer);
                    }
                });
            });

            setCampData(dataByAnimal);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle logout - clear session and return to password screen
    const handleLogout = () => {
        sessionStorage.removeItem('camp_roster_token');
        setSessionToken(null);
        setIsAuthenticated(false);
        setSelectedCamp(null);
        setCampData(null);
    };

    const getAnimalName = (animalId: string): string => {
        if (animalId === 'unassigned') return 'Unassigned';
        const animal = animals.find(a => a.id.toString() === animalId);
        return animal?.name || 'Unknown Animal';
    };

    const getLevelName = (levelId: number): string => {
        const level = levels.find(l => l.id === levelId);
        return level?.title?.rendered || 'Unknown Level';
    };

    const toggleAnimal = (animalId: string) => {
        setCollapsedAnimals(prev => {
            const next = new Set(prev);
            if (next.has(animalId)) {
                next.delete(animalId);
            } else {
                next.add(animalId);
            }
            return next;
        });
    };

    const sortedAnimalIds = useMemo(() => {
        if (!campData) return [];
        return Object.keys(campData).sort((a, b) => {
            const nameA = getAnimalName(a);
            const nameB = getAnimalName(b);
            return nameA.localeCompare(nameB);
        });
    }, [campData, animals]);

    // Get all swimmers sorted alphabetically for the swimmer view
    const allSwimmersSorted = useMemo(() => {
        if (!campData) return [];
        const swimmerMap = new Map<number, { swimmer: Swimmer; groups: Group[]; animalId: string }>();
        
        Object.entries(campData).forEach(([animalId, animalData]) => {
            animalData.groups.forEach(group => {
                (group.meta?.swimmers || []).forEach(swimmerId => {
                    const swimmer = animalData.swimmers.get(swimmerId);
                    if (swimmer) {
                        if (!swimmerMap.has(swimmerId)) {
                            swimmerMap.set(swimmerId, { swimmer, groups: [group], animalId });
                        } else {
                            swimmerMap.get(swimmerId)!.groups.push(group);
                        }
                    }
                });
            });
        });
        
        return sortSwimmersByName([...swimmerMap.values()].map(v => v.swimmer)).map(swimmer => ({
            swimmer,
            ...swimmerMap.get(swimmer.id)!
        }));
    }, [campData]);

    // Password gate for public access
    if (!isAuthenticated) {
        return (
            <div className="ap-min-h-[400px] ap-flex ap-items-center ap-justify-center">
                <div className="ap-w-full ap-max-w-md">
                    <div className="ap-bg-white ap-rounded-2xl ap-shadow-xl ap-border ap-border-gray-200 ap-p-8">
                        <div className="ap-text-center ap-mb-6">
                            <div className="ap-w-16 ap-h-16 ap-bg-gradient-to-r ap-from-blue-600 ap-to-purple-600 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                                <HiOutlineLockClosed className="ap-w-8 ap-h-8 ap-text-white" />
                            </div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Camp Rosters</h2>
                            <p className="ap-text-gray-500 ap-mt-2">Enter the password to view camp rosters</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="ap-space-y-4">
                            <div>
                                <label htmlFor="password" className="ap-sr-only">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="ap-w-full ap-px-4 ap-py-3 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors ap-text-center ap-text-lg"
                                    autoFocus
                                />
                            </div>

                            {authError && (
                                <div className="ap-flex ap-items-center ap-gap-2 ap-text-red-600 ap-text-sm ap-bg-red-50 ap-p-3 ap-rounded-lg">
                                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                                    <span>{authError}</span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isAuthenticating || !password}
                                variant="primary"
                                className="!ap-w-full !ap-py-3 !ap-bg-gradient-to-r !ap-from-blue-600 !ap-to-purple-600 hover:!ap-shadow-lg !ap-flex !ap-items-center !ap-justify-center !ap-gap-2"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <LoadingSpinner />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <span>View Rosters</span>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h1 className="ap-text-2xl sm:ap-text-3xl ap-font-bold ap-text-gray-900">Camp Rosters</h1>
                    <p className="ap-text-gray-500 ap-mt-1">View groups and swimmers organized by camp</p>
                </div>
                {isPublic && (
                    <Button
                        onClick={handleLogout}
                        variant="secondary"
                        className="!ap-flex !ap-items-center !ap-gap-2 !ap-text-gray-600 hover:!ap-text-gray-900"
                    >
                        <HiOutlineArrowLeftOnRectangle className="ap-w-5 ap-h-5" />
                        <span>Back to Login</span>
                    </Button>
                )}
            </div>

            {/* Camp selector and view toggle */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-4">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center ap-gap-4">
                        <label className="ap-text-sm ap-font-medium ap-text-gray-700">Select Camp:</label>
                        <select
                            value={selectedCamp || ''}
                            onChange={(e) => setSelectedCamp(e.target.value ? parseInt(e.target.value, 10) : null)}
                            className="ap-flex-1 ap-max-w-md ap-px-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                        >
                            <option value="">Choose a camp...</option>
                            {camps.map(camp => (
                                <option key={camp.id} value={camp.id}>
                                    {camp.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* View mode toggle */}
                    {selectedCamp && campData && (
                        <div className="ap-flex ap-items-center ap-gap-1 ap-bg-gray-100 ap-rounded-lg ap-p-1">
                            <Button
                                onClick={() => setViewMode('animal')}
                                variant="ghost"
                                size="sm"
                                className={`!ap-flex !ap-items-center !ap-gap-2 !ap-px-3 !ap-py-1.5 !ap-rounded-md !ap-transition-colors ${
                                    viewMode === 'animal'
                                        ? '!ap-bg-white !ap-text-gray-900 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                                }`}
                            >
                                <HiOutlineRectangleGroup className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">By Animal</span>
                            </Button>
                            <Button
                                onClick={() => setViewMode('swimmer')}
                                variant="ghost"
                                size="sm"
                                className={`!ap-flex !ap-items-center !ap-gap-2 !ap-px-3 !ap-py-1.5 !ap-rounded-md !ap-transition-colors ${
                                    viewMode === 'swimmer'
                                        ? '!ap-bg-white !ap-text-gray-900 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                                }`}
                            >
                                <HiOutlineQueueList className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">By Swimmer</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="ap-flex ap-justify-center ap-py-12">
                    <LoadingSpinner />
                </div>
            )}

            {/* Camp data */}
            {!isLoading && campData && (
                <div className="ap-space-y-4">
                    {sortedAnimalIds.length === 0 ? (
                        <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-8 ap-text-center">
                            <HiOutlineUserGroup className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">No groups found</h3>
                            <p className="ap-text-gray-500">This camp doesn't have any groups yet</p>
                        </div>
                    ) : viewMode === 'swimmer' ? (
                        /* Swimmer alphabetical view */
                        <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                            <div className="ap-p-4 ap-bg-gray-50 ap-border-b ap-border-gray-200">
                                <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                                    All Swimmers ({allSwimmersSorted.length})
                                </h2>
                                <p className="ap-text-sm ap-text-gray-500 ap-mt-1">Sorted alphabetically by name</p>
                            </div>
                            <div className="ap-divide-y ap-divide-gray-100">
                                {allSwimmersSorted.map(({ swimmer, groups, animalId }) => (
                                    <div key={swimmer.id} className="ap-p-4 hover:ap-bg-gray-50 ap-transition-colors">
                                        <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-2">
                                            <div className="ap-flex ap-items-center ap-gap-3">
                                                <HiOutlineUser className="ap-w-5 ap-h-5 ap-text-gray-400 ap-flex-shrink-0" />
                                                <span className="ap-font-medium ap-text-gray-900">
                                                    {swimmer.title?.rendered || `Swimmer #${swimmer.id}`}
                                                </span>
                                            </div>
                                            <div className="ap-flex ap-flex-wrap ap-gap-2 ap-text-xs">
                                                <span className="ap-px-2 ap-py-1 ap-bg-amber-50 ap-text-amber-700 ap-rounded">
                                                    {getAnimalName(animalId)}
                                                </span>
                                                {groups.map(group => (
                                                    <span key={group.id} className="ap-px-2 ap-py-1 ap-bg-blue-50 ap-text-blue-700 ap-rounded">
                                                        {group.title?.rendered || 'Untitled Group'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Animal grouped view */
                        sortedAnimalIds.map(animalId => {
                            const animalData = campData[animalId];
                            const isCollapsed = collapsedAnimals.has(animalId);
                            const totalSwimmers = animalData.groups.reduce(
                                (sum, g) => sum + (g.meta?.swimmers?.length || 0), 
                                0
                            );

                            return (
                                <div key={animalId} className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                                    {/* Animal header */}
                                    <Button
                                        onClick={() => toggleAnimal(animalId)}
                                        variant="ghost"
                                        className="!ap-w-full !ap-flex !ap-items-center !ap-justify-between !ap-p-4 !ap-bg-gray-50 hover:!ap-bg-gray-100 !ap-rounded-none"
                                    >
                                        <div className="ap-flex ap-items-center ap-gap-3">
                                            {isCollapsed ? (
                                                <HiOutlineChevronRight className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                            ) : (
                                                <HiOutlineChevronDown className="ap-w-5 ap-h-5 ap-text-gray-400" />
                                            )}
                                            <h2 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                                                {getAnimalName(animalId)}
                                            </h2>
                                        </div>
                                        <div className="ap-flex ap-items-center ap-gap-4 ap-text-sm ap-text-gray-500">
                                            <span>{animalData.groups.length} group{animalData.groups.length !== 1 ? 's' : ''}</span>
                                            <span>{totalSwimmers} swimmer{totalSwimmers !== 1 ? 's' : ''}</span>
                                        </div>
                                    </Button>

                                    {/* Groups */}
                                    {!isCollapsed && (
                                        <div className="ap-p-4 ap-space-y-4">
                                            {sortGroups(animalData.groups).map(group => (
                                                <div key={group.id} className="ap-border ap-border-gray-200 ap-rounded-lg ap-p-4">
                                                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-2 ap-mb-3">
                                                        <h3 className="ap-font-medium ap-text-gray-900">
                                                            {group.title?.rendered || 'Untitled Group'}
                                                        </h3>
                                                        <div className="ap-flex ap-flex-wrap ap-gap-2 ap-text-xs ap-text-gray-500">
                                                            {group.meta?.level && (
                                                                <span className="ap-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-indigo-50 ap-text-indigo-600 ap-rounded">
                                                                    <HiOutlineAcademicCap className="ap-w-3 ap-h-3" />
                                                                    {getLevelName(group.meta.level)}
                                                                </span>
                                                            )}
                                                            {group.meta?.days && group.meta.days.length > 0 && (
                                                                <span className="ap-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-green-50 ap-text-green-600 ap-rounded">
                                                                    <HiOutlineCalendarDays className="ap-w-3 ap-h-3" />
                                                                    {group.meta.days.join(', ')}
                                                                </span>
                                                            )}
                                                            {group.meta?.group_time && (
                                                                <span className="ap-flex ap-items-center ap-gap-1 ap-px-2 ap-py-1 ap-bg-orange-50 ap-text-orange-600 ap-rounded">
                                                                    <HiOutlineClock className="ap-w-3 ap-h-3" />
                                                                    {group.meta.group_time}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Swimmers list - single column for better readability */}
                                                    {group.meta?.swimmers && group.meta.swimmers.length > 0 ? (
                                                        <div className="ap-space-y-1">
                                                            {sortSwimmerIds(group.meta.swimmers, animalData.swimmers).map(swimmerId => {
                                                                const swimmer = animalData.swimmers.get(swimmerId);
                                                                return (
                                                                    <div
                                                                        key={swimmerId}
                                                                        className="ap-flex ap-items-center ap-gap-2 ap-py-1.5 ap-px-3 ap-bg-gray-50 ap-rounded ap-text-sm hover:ap-bg-gray-100 ap-transition-colors"
                                                                    >
                                                                        <HiOutlineUser className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                                                                        <span>
                                                                            {swimmer?.title?.rendered || `Swimmer #${swimmerId}`}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="ap-text-sm ap-text-gray-400 ap-italic">No swimmers assigned</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* No camp selected state */}
            {!isLoading && !selectedCamp && (
                <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-12 ap-text-center">
                    <HiOutlineCalendarDays className="ap-w-16 ap-h-16 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">Select a Camp</h3>
                    <p className="ap-text-gray-500">Choose a camp from the dropdown above to view its roster</p>
                </div>
            )}
        </div>
    );
};

export default CampRosters;
