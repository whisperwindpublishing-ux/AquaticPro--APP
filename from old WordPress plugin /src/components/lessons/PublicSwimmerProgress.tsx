import React, { useState, useEffect, useCallback } from 'react';
import {
    HiOutlineAcademicCap,
    HiOutlineCheckCircle,
    HiOutlineCalendar,
    HiOutlineChartBar,
    HiOutlineDocumentText,
    HiOutlineExclamationTriangle,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Button } from '../ui/Button';

interface PublicSwimmerProgressProps {
    apiUrl: string;
    token: string;
}

interface SkillProgress {
    id: number;
    name: string;
    mastered: boolean;
    date: string | null;
}

interface LevelProgress {
    id: number;
    name: string;
    mastered: boolean;
    date: string | null;
    skills: SkillProgress[];
}

interface EvaluationData {
    id: number;
    date: string;
    level: string;
    level_id: number | null;
    notes: string;
    passed: boolean;
    author: string;
    author_id: number;
}

interface SwimmerData {
    swimmer: {
        id: number;
        name: string;
    };
    current_level: {
        id: number;
        name: string;
    } | null;
    progress: {
        levels: LevelProgress[];
        skills_mastered: number;
        skills_total: number;
        levels_mastered: number;
        levels_total: number;
        percentage: number;
    };
    evaluations: EvaluationData[];
}

const PublicSwimmerProgress: React.FC<PublicSwimmerProgressProps> = ({ apiUrl, token }) => {
    const [data, setData] = useState<SwimmerData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
    const [showAllEvaluations, setShowAllEvaluations] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadProgress = useCallback(async (isRefresh = false) => {
        if (!token) return;
        
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);
        
        try {
            // Add cache-busting parameter to ensure fresh data
            const cacheBuster = Date.now();
            const response = await fetch(`${apiUrl}/lessons/swimmer-progress/${token}?_=${cacheBuster}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to load progress');
            }
            
            const progressData = await response.json();
            setData(progressData);
            setLastUpdated(new Date());
            
            // Auto-expand levels that are in progress (have some skills mastered but not complete)
            if (!isRefresh) {
                const inProgressLevels = progressData.progress.levels.filter(
                    (level: LevelProgress) => !level.mastered && level.skills.some((s: SkillProgress) => s.mastered)
                );
                setExpandedLevels(new Set(inProgressLevels.map((l: LevelProgress) => l.id)));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load swimmer progress');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [apiUrl, token]);

    useEffect(() => {
        // If no token, show info page instead of loading
        if (!token) {
            setIsLoading(false);
            return;
        }
        
        loadProgress();
    }, [loadProgress, token]);

    const handleRefresh = () => {
        loadProgress(true);
    };

    const toggleLevel = (levelId: number) => {
        setExpandedLevels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(levelId)) {
                newSet.delete(levelId);
            } else {
                newSet.add(levelId);
            }
            return newSet;
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-50 ap-to-cyan-50 ap-flex ap-items-center ap-justify-center">
                <div className="ap-text-center">
                    <LoadingSpinner />
                    <p className="ap-mt-4 ap-text-gray-600">Loading progress...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-50 ap-to-cyan-50 ap-flex ap-items-center ap-justify-center ap-p-4">
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-p-8 ap-max-w-md ap-w-full ap-text-center">
                    <div className="ap-w-16 ap-h-16 ap-bg-red-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                        <HiOutlineExclamationTriangle className="ap-w-8 ap-h-8 ap-text-red-500" />
                    </div>
                    <h1 className="ap-text-xl ap-font-semibold ap-text-gray-900 ap-mb-2">Unable to Load Progress</h1>
                    <p className="ap-text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    // No token - show info page
    if (!token) {
        // Get the base URL for links (remove any query params)
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
        const campRostersUrl = baseUrl + '?camp_rosters';
        
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-50 ap-to-cyan-50 ap-flex ap-items-center ap-justify-center ap-p-4">
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-p-8 ap-max-w-lg ap-w-full ap-text-center">
                    <div className="ap-w-20 ap-h-20 ap-bg-gradient-to-br ap-from-blue-500 ap-to-cyan-500 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-6">
                        <HiOutlineChartBar className="ap-w-10 ap-h-10 ap-text-white" />
                    </div>
                    <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-3">Swimmer Progress</h1>
                    <p className="ap-text-gray-600 ap-mb-6">
                        This page displays a swimmer's progress, skills mastered, and evaluation history.
                    </p>
                    <div className="ap-bg-blue-50 ap-rounded-xl ap-p-4 ap-text-left">
                        <h2 className="ap-text-sm ap-font-semibold ap-text-blue-900 ap-mb-2">How it works:</h2>
                        <ul className="ap-text-sm ap-text-blue-800 ap-space-y-2">
                            <li className="ap-flex ap-items-start ap-gap-2">
                                <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-blue-500 ap-flex-shrink-0 ap-mt-0.5" />
                                <span>Instructors can share a unique link with parents from the swimmer's profile.</span>
                            </li>
                            <li className="ap-flex ap-items-start ap-gap-2">
                                <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-blue-500 ap-flex-shrink-0 ap-mt-0.5" />
                                <span>The link contains a secure token that gives access to that swimmer's progress only.</span>
                            </li>
                            <li className="ap-flex ap-items-start ap-gap-2">
                                <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-blue-500 ap-flex-shrink-0 ap-mt-0.5" />
                                <span>Parents can view current level, skills mastered, and evaluation history.</span>
                            </li>
                        </ul>
                    </div>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-6">
                        If you received a link to view a swimmer's progress, please use that link directly.
                    </p>
                    
                    {/* Link to Camp Rosters */}
                    <div className="ap-mt-6 ap-pt-6 ap-border-t ap-border-gray-200">
                        <p className="ap-text-sm ap-text-gray-600 ap-mb-3">
                            Looking for camp rosters instead?
                        </p>
                        <a 
                            href={campRostersUrl}
                            className="ap-inline-flex ap-items-center ap-gap-2 ap-px-4 ap-py-2 ap-bg-gradient-to-r ap-from-blue-500 ap-to-cyan-500 ap-text-white ap-rounded-lg ap-font-medium hover:ap-shadow-lg ap-transition-all"
                        >
                            <HiOutlineDocumentText className="ap-w-5 ap-h-5" />
                            View Camp Rosters
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const displayedEvaluations = showAllEvaluations ? data.evaluations : data.evaluations.slice(0, 3);

    return (
        <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-50 ap-to-cyan-50 ap-py-8 ap-px-4">
            <div className="ap-max-w-2xl ap-mx-auto">
                {/* Header Card */}
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-overflow-hidden ap-mb-6">
                    <div className="ap-bg-gradient-to-r ap-from-blue-500 ap-to-cyan-500 ap-px-6 ap-py-8 ap-text-white">
                        <div className="ap-flex ap-items-start ap-justify-between">
                            <div>
                                <h1 className="ap-text-2xl ap-font-bold ap-mb-1">{data.swimmer.name}</h1>
                                {data.current_level && (
                                    <div className="ap-flex ap-items-center ap-gap-2 ap-text-blue-100">
                                        <HiOutlineAcademicCap className="ap-w-5 ap-h-5" />
                                        <span>Current Level: {data.current_level.name}</span>
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                variant="ghost"
                                size="sm"
                                className="!ap-bg-white/20 hover:!ap-bg-white/30 !ap-text-white"
                                title="Refresh progress"
                            >
                                <HiOutlineArrowPath className={`ap-w-5 ap-h-5 ${isRefreshing ? 'ap-animate-spin' : ''}`} />
                            </Button>
                        </div>
                        {lastUpdated && (
                            <p className="ap-text-xs ap-text-blue-200 ap-mt-2">
                                Last updated: {lastUpdated.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                    
                    {/* Progress Summary */}
                    <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-100">
                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-2">
                            <span className="ap-text-sm ap-font-medium ap-text-gray-600">Overall Progress</span>
                            <span className="ap-text-sm ap-font-bold ap-text-blue-600">{data.progress.percentage}%</span>
                        </div>
                        <div className="ap-h-3 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden">
                            <div 
                                className="ap-h-full ap-bg-gradient-to-r ap-from-blue-500 ap-to-cyan-500 ap-rounded-full ap-transition-all ap-duration-500"
                                style={{ width: `${data.progress.percentage}%` }}
                            />
                        </div>
                        <div className="ap-flex ap-justify-between ap-mt-2 ap-text-xs ap-text-gray-500">
                            <span>{data.progress.skills_mastered} of {data.progress.skills_total} skills</span>
                            <span>{data.progress.levels_mastered} of {data.progress.levels_total} levels</span>
                        </div>
                    </div>
                    
                    {/* Level Progress Bars */}
                    <div className="ap-px-6 ap-py-4 ap-flex ap-gap-2">
                        {data.progress.levels.map((level) => {
                            const skillsMastered = level.skills.filter(s => s.mastered).length;
                            const totalSkills = level.skills.length;
                            const percent = totalSkills > 0 ? (skillsMastered / totalSkills) * 100 : 0;
                            
                            return (
                                <div 
                                    key={level.id}
                                    className="ap-flex-1 ap-min-w-0"
                                    title={`${level.name}: ${skillsMastered}/${totalSkills} skills`}
                                >
                                    <div className={`ap-h-2 ap-rounded-full ${
                                        level.mastered 
                                            ? 'ap-bg-green-500' 
                                            : percent > 0 
                                                ? 'ap-bg-gradient-to-r ap-from-blue-300 ap-to-blue-500' : 'ap-bg-gray-200'
                                    }`} style={{ width: level.mastered ? '100%' : `${Math.max(percent, 10)}%` }} />
                                    <p className="ap-text-[10px] ap-text-gray-400 ap-mt-1 ap-truncate">{level.name}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Evaluations - shown above Skills Progress */}
                {data.evaluations.length > 0 && (
                    <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-overflow-hidden ap-mb-6">
                        <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-100 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineDocumentText className="ap-w-5 ap-h-5 ap-text-purple-500" />
                            <h2 className="ap-font-semibold ap-text-gray-900">Evaluation History</h2>
                            <span className="ap-text-sm ap-text-gray-400">({data.evaluations.length})</span>
                        </div>
                        <div className="ap-divide-y ap-divide-gray-100">
                            {displayedEvaluations.map(evaluation => (
                                <div key={evaluation.id} className="ap-px-6 ap-py-4">
                                    <div className="ap-flex ap-items-start ap-justify-between ap-mb-2">
                                        <div>
                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                <HiOutlineCalendar className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                                <span className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {formatDate(evaluation.date)}
                                                </span>
                                            </div>
                                            <div className="ap-ml-6 ap-mt-1 ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                                                {evaluation.level && (
                                                    <span className="ap-text-sm ap-text-purple-600 ap-font-medium">
                                                        {evaluation.level}
                                                    </span>
                                                )}
                                                {evaluation.author && (
                                                    <>
                                                        {evaluation.level && <span className="ap-text-gray-300">•</span>}
                                                        <span className="ap-text-sm ap-text-gray-500">
                                                            by {evaluation.author}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {evaluation.notes && (
                                        <p className="ap-text-sm ap-text-gray-600 ap-ml-6 ap-mt-2">{evaluation.notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                        {data.evaluations.length > 3 && (
                            <div className="ap-px-6 ap-py-3 ap-border-t ap-border-gray-100">
                                <Button
                                    onClick={() => setShowAllEvaluations(!showAllEvaluations)}
                                    variant="ghost"
                                    size="sm"
                                >
                                    {showAllEvaluations 
                                        ? 'Show less' 
                                        : `Show all ${data.evaluations.length} evaluations`
                                    }
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Skills by Level */}
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-overflow-hidden ap-mb-6">
                    <div className="ap-px-6 ap-py-4 ap-border-b ap-border-gray-100 ap-flex ap-items-center ap-gap-2">
                        <HiOutlineChartBar className="ap-w-5 ap-h-5 ap-text-blue-500" />
                        <h2 className="ap-font-semibold ap-text-gray-900">Skills Progress</h2>
                    </div>
                    <div className="ap-divide-y ap-divide-gray-100">
                        {data.progress.levels.map(level => {
                            const isExpanded = expandedLevels.has(level.id);
                            const skillsMastered = level.skills.filter(s => s.mastered).length;
                            
                            return (
                                <div key={level.id}>
                                    <button
                                        onClick={() => toggleLevel(level.id)}
                                        className="ap-w-full ap-px-6 ap-py-3 ap-flex ap-items-center ap-justify-between hover:ap-bg-gray-50 ap-transition-colors"
                                    >
                                        <div className="ap-flex ap-items-center ap-gap-3">
                                            {level.mastered ? (
                                                <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-500" />
                                            ) : skillsMastered > 0 ? (
                                                <div className="ap-w-5 ap-h-5 ap-rounded-full ap-border-2 ap-border-blue-500 ap-flex ap-items-center ap-justify-center">
                                                    <span className="ap-text-[10px] ap-font-bold ap-text-blue-500">
                                                        {Math.round((skillsMastered / level.skills.length) * 100)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="ap-w-5 ap-h-5 ap-rounded-full ap-border-2 ap-border-gray-300" />
                                            )}
                                            <span className={`ap-font-medium ${level.mastered ? 'ap-text-green-700' : 'ap-text-gray-900'}`}>
                                                {level.name}
                                            </span>
                                        </div>
                                        <div className="ap-flex ap-items-center ap-gap-2">
                                            <span className="ap-text-sm ap-text-gray-500">
                                                {skillsMastered}/{level.skills.length}
                                            </span>
                                            {isExpanded ? (
                                                <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                            ) : (
                                                <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-gray-400" />
                                            )}
                                        </div>
                                    </button>
                                    
                                    {isExpanded && level.skills.length > 0 && (
                                        <div className="ap-px-6 ap-pb-4">
                                            <div className="ap-bg-gray-50 ap-rounded-lg ap-divide-y ap-divide-gray-100">
                                                {level.skills.map(skill => (
                                                    <div key={skill.id} className="ap-px-4 ap-py-2 ap-flex ap-items-center ap-justify-between">
                                                        <div className="ap-flex ap-items-center ap-gap-2">
                                                            {skill.mastered ? (
                                                                <HiOutlineCheckCircle className="ap-w-4 ap-h-4 ap-text-green-500" />
                                                            ) : (
                                                                <div className="ap-w-4 ap-h-4 ap-rounded-full ap-border ap-border-gray-300" />
                                                            )}
                                                            <span className={`ap-text-sm ${skill.mastered ? 'ap-text-gray-900' : 'ap-text-gray-500'}`}>
                                                                {skill.name}
                                                            </span>
                                                        </div>
                                                        {skill.mastered && skill.date && (
                                                            <span className="ap-text-xs ap-text-gray-400">
                                                                {formatDate(skill.date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="ap-mt-8 ap-text-center ap-text-xs ap-text-gray-400">
                    <p>Powered by AquaticPro</p>
                </div>
            </div>
        </div>
    );
};

export default PublicSwimmerProgress;
