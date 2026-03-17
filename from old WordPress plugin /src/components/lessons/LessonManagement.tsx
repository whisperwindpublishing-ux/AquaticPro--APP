import React, { useState, Suspense, lazy, useCallback, useEffect } from 'react';
import { 
    HiOutlineUserGroup,
    HiOutlineAcademicCap,
    HiOutlineDocumentText,
    HiOutlineCog,
    HiOutlineEllipsisVertical,
    HiOutlineRectangleStack
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { preloadSwimmerCache } from '@/services/swimmerCache';
import { preloadUserCache } from '@/services/userCache';
import { Button, ButtonVariant } from '../ui/Button';

// Lazy load manager components for better code splitting
const GroupManager = lazy(() => import('./GroupManager'));
const SwimmerManager = lazy(() => import('./SwimmerManager'));
const EvaluationManager = lazy(() => import('./EvaluationManager'));
const LessonSettings = lazy(() => import('./LessonSettings'));
const CampOrganizer = lazy(() => import('./CampOrganizer'));

interface LessonManagementProps {
    apiUrl: string;
    nonce: string;
}

type Tab = 'groups' | 'swimmers' | 'evaluations' | 'organizer' | 'settings';

interface TabConfig {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: ButtonVariant;
    activeVariant: ButtonVariant;
}

// Cross-component navigation state
interface NavigationState {
    editSwimmerId?: number;
    newEvaluationSwimmerId?: number;
}

const LessonManagement: React.FC<LessonManagementProps> = ({ apiUrl, nonce }) => {
    const [activeTab, setActiveTab] = useState<Tab>('groups');
    const [isSettingsMenuOpen, setSettingsMenuOpen] = useState(false);
    const [navigationState, setNavigationState] = useState<NavigationState>({});

    // Pre-warm caches when entering Lesson Management
    useEffect(() => {
        preloadSwimmerCache();
        preloadUserCache();
    }, []);

    const tabs: TabConfig[] = [
        { id: 'groups', label: 'Groups', icon: HiOutlineUserGroup, variant: 'lesson-tab-groups', activeVariant: 'lesson-tab-groups-active' },
        { id: 'swimmers', label: 'Swimmers', icon: HiOutlineAcademicCap, variant: 'lesson-tab-swimmers', activeVariant: 'lesson-tab-swimmers-active' },
        { id: 'evaluations', label: 'Evaluations', icon: HiOutlineDocumentText, variant: 'lesson-tab-evaluations', activeVariant: 'lesson-tab-evaluations-active' },
        { id: 'organizer', label: 'Camp Organizer', icon: HiOutlineRectangleStack, variant: 'lesson-tab-camp', activeVariant: 'lesson-tab-camp-active' },
    ];

    const handleTabClick = (tabId: Tab) => {
        setActiveTab(tabId);
        setSettingsMenuOpen(false);
        // Clear navigation state when manually switching tabs
        setNavigationState({});
    };

    // Navigate to swimmers tab with swimmer edit modal open
    const handleNavigateToSwimmer = useCallback((swimmerId: number) => {
        setNavigationState({ editSwimmerId: swimmerId });
        setActiveTab('swimmers');
    }, []);

    // Navigate to evaluations tab with new evaluation form open (swimmer pre-selected)
    const handleNavigateToNewEvaluation = useCallback((swimmerId: number) => {
        setNavigationState({ newEvaluationSwimmerId: swimmerId });
        setActiveTab('evaluations');
    }, []);

    // Clear navigation state after it's been consumed
    const handleNavigationConsumed = useCallback(() => {
        setNavigationState({});
    }, []);

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h1 className="ap-text-2xl sm:ap-text-3xl ap-font-bold ap-text-gray-900">Lesson Management</h1>
                    <p className="ap-text-gray-500 ap-mt-1">Manage groups, swimmers, and evaluations</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-2">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-2">
                    <nav className="ap-flex ap-flex-wrap ap-gap-2" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <Button
                                    key={tab.id}
                                    variant={isActive ? tab.activeVariant : tab.variant}
                                    onClick={() => handleTabClick(tab.id)}
                                >
                                    <Icon className="ap-w-5 ap-h-5" />
                                    <span>{tab.label}</span>
                                </Button>
                            );
                        })}
                    </nav>

                    {/* Settings Menu */}
                    <div className="ap-relative">
                        <Button
                            variant="icon"
                            size="sm"
                            onClick={() => setSettingsMenuOpen(!isSettingsMenuOpen)}
                            aria-label="Settings menu"
                        >
                            <HiOutlineEllipsisVertical className="ap-w-5 ap-h-5" />
                        </Button>
                        
                        {isSettingsMenuOpen && (
                            <>
                                <div 
                                    className="ap-fixed ap-inset-0 ap-z-10" 
                                    onClick={() => setSettingsMenuOpen(false)}
                                />
                                <div className="ap-absolute ap-right-0 ap-mt-2 ap-w-48 ap-rounded-lg ap-shadow-lg ap-bg-white ap-ring-1 ap-ring-black ap-ring-opacity-5 ap-z-20">
                                    <div className="ap-py-1" role="menu">
                                        <Button 
                                            variant="nav-profile"
                                            onClick={() => { setActiveTab('settings'); setSettingsMenuOpen(false); }}
                                        >
                                            <HiOutlineCog className="ap-w-4 ap-h-4" />
                                            <span>Settings</span>
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-min-h-[400px]">
                <Suspense fallback={
                    <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                        <LoadingSpinner />
                    </div>
                }>
                    {activeTab === 'groups' && (
                        <GroupManager 
                            apiUrl={apiUrl} 
                            nonce={nonce} 
                            onNavigateToSwimmer={handleNavigateToSwimmer}
                            onNavigateToNewEvaluation={handleNavigateToNewEvaluation}
                        />
                    )}
                    {activeTab === 'swimmers' && (
                        <SwimmerManager 
                            apiUrl={apiUrl} 
                            nonce={nonce}
                            editSwimmerId={navigationState.editSwimmerId}
                            onNavigationConsumed={handleNavigationConsumed}
                            onRequestNewEvaluation={handleNavigateToNewEvaluation}
                        />
                    )}
                    {activeTab === 'evaluations' && (
                        <EvaluationManager 
                            apiUrl={apiUrl} 
                            nonce={nonce}
                            newEvaluationDefaults={navigationState.newEvaluationSwimmerId ? { swimmer: navigationState.newEvaluationSwimmerId } : null}
                            onDefaultsConsumed={handleNavigationConsumed}
                        />
                    )}
                    {activeTab === 'organizer' && (
                        <CampOrganizer apiUrl={apiUrl} nonce={nonce} />
                    )}
                    {activeTab === 'settings' && (
                        <LessonSettings apiUrl={apiUrl} nonce={nonce} />
                    )}
                </Suspense>
            </div>
        </div>
    );
};

export default LessonManagement;
