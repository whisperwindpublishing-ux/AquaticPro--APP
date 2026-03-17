import React, { useState, useEffect, Suspense, lazy } from 'react';
import MentorDirectory from '@/components/MentorDirectory';
import MentorProfile from '@/components/MentorProfile';
import UserSettings from '@/components/UserSettings';
import MentorshipDashboard from '@/components/MentorshipDashboard';
import MyMentees from '@/components/MyMentees';
import Sidebar from '@/components/Sidebar';
import PortfolioPage from '@/components/PortfolioPage';
import PortfolioDirectory from '@/components/PortfolioDirectory';
import PublicLandingPage from '@/components/PublicLandingPage';
import UnifiedAlertStrip from '@/components/UnifiedAlertStrip';
import Dashboard from '@/components/Dashboard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { UserProfile, MentorshipRequest } from '@/types';
import { getMyMentorships, getCurrentUser, updateUserProfile } from '@/services/api';
import { configureApiService } from './services/api-service';

// ─── Lazy-loaded components (split into separate chunks) ────────
// These heavy modules are only fetched when the user navigates to them,
// keeping the initial bundle small.
const AdminPanel = lazy(() => import('@/components/AdminPanel'));
const CareerDevelopment = lazy(() => import('@/components/CareerDevelopment'));
const UserManagementDashboard = lazy(() => import('@/components/UserManagementDashboard'));
const ComplianceReports = lazy(() => import('@/components/ComplianceReports'));
const DailyLogDashboard = lazy(() => import('@/components/DailyLogDashboard'));
const TaskDeck = lazy(() => import('@/components/TaskDeck'));
const FOIAExport = lazy(() => import('@/components/FOIAExport'));
const LessonManagementExport = lazy(() => import('@/components/LessonManagementExport'));
const ActionButtonsManagement = lazy(() => import('@/components/ActionButtonsManagement'));
const DashboardSettings = lazy(() => import('@/components/DashboardSettings'));
const AwardPeriodManagement = lazy(() => import('@/components/AwardPeriodManagement'));
const AwardsHub = lazy(() => import('@/components/AwardsHub'));
const WinnersGallery = lazy(() => import('@/components/WinnersGallery'));
const AwesomeAwardsPermissions = lazy(() => import('@/components/AwesomeAwardsPermissions'));
const LessonManagement = lazy(() => import('@/components/lessons').then(m => ({ default: m.LessonManagement })));
const EmailEvaluations = lazy(() => import('@/components/lessons').then(m => ({ default: m.EmailEvaluations })));
const CampRosters = lazy(() => import('@/components/lessons').then(m => ({ default: m.CampRosters })));
const PublicSwimmerProgress = lazy(() => import('@/components/lessons/PublicSwimmerProgress'));
const PublicReturnForm = lazy(() => import('@/components/srm/PublicReturnForm'));
const SeasonManagement = lazy(() => import('@/components/SeasonManagement'));
const PayConfigList = lazy(() => import('@/components/srm/PayConfigList'));
const ReturnInviteManager = lazy(() => import('@/components/srm/ReturnInviteManager'));
const ResponseTracker = lazy(() => import('@/components/srm/ResponseTracker'));
const EmailTemplateManager = lazy(() => import('@/components/srm/EmailTemplateManager'));
const NewHireManager = lazy(() => import('@/components/NewHireManager'));
const NewHireApplicationForm = lazy(() => import('@/components/NewHireApplicationForm'));
const LegacyImport = lazy(() => import('@/components/LegacyImport'));
const MileageModule = lazy(() => import('@/components/mileage').then(m => ({ default: m.MileageModule })));
const LMSModule = lazy(() => import('@/components/lms').then(m => ({ default: m.LMSModule })));
const EmailComposer = lazy(() => import('@/components/EmailComposer'));
const CertificatesPage = lazy(() => import('@/components/certificates/CertificatesPage'));
// CertificateBanner is now part of UnifiedAlertStrip

export type View = 
    | 'homeDashboard'
    | 'directory' 
    | 'mentorProfile' 
    | 'myProfile' 
    | 'settings' 
    | 'dashboard' 
    | 'myMentees' 
    | 'portfolio' 
    | 'portfolioDirectory' 
    | 'admin' 
    | 'careerDevelopment' 
    | 'userManagement' 
    | 'reports' 
    | 'dailyLogs' 
    // Daily Logs subviews
    | 'dailyLogs:read-all' 
    | 'dailyLogs:my-logs' 
    | 'dailyLogs:create-edit'
    // Career Development subviews
    | 'career:promotion-progress'
    | 'career:team-view'
    | 'career:inservice-log'
    | 'career:scan-audits'
    | 'career:live-drills'
    | 'career:cashier-audits'
    | 'career:instructor-evaluations'
    // User Management subviews
    | 'usermgmt:users-list'
    | 'usermgmt:role-management'
    | 'usermgmt:criteria-management'
    | 'usermgmt:location-management'
    | 'usermgmt:time-slot-management'
    | 'usermgmt:action-buttons'
    | 'usermgmt:dashboard-settings'
    | 'usermgmt:daily-log-import'
    | 'usermgmt:pay-config'
    | 'usermgmt:certificate-settings'
    // New Hires / Onboarding (under Admin)
    | 'usermgmt:new-hires'
    // TaskDeck
    | 'taskdeck'
    // FOIA Export (Admin only)
    | 'foiaExport'
    // Lesson Management Export
    | 'lessonExport'
    // Awesome Awards
    | 'awards'
    | 'awards:manage-periods'
    | 'awards:nominate'
    | 'awards:approvals'
    | 'awards:winners'
    | 'awards:permissions'
    // Lesson Management
    | 'lessons'
    | 'lessons:management'
    | 'lessons:email-evaluations'
    | 'lessons:camp-rosters'
    | 'lessons:settings'
    // Seasonal Returns
    | 'seasonalReturns'
    | 'seasonalReturns:dashboard'
    | 'seasonalReturns:invites'
    | 'seasonalReturns:responses'
    | 'seasonalReturns:templates'
    // New Hires / Onboarding (under Admin)
    | 'usermgmt:new-hires'
    // Legacy Import (Admin only)
    | 'usermgmt:legacy-import'
    // Mileage Reimbursement
    | 'mileage'
    // Email Composer
    | 'emailComposer'
    // Certificates
    | 'certificates'
    // Learning/LMS
    | 'learning'
    | 'learning:courses'
    | 'learning:my-progress'
    | 'learning:course-builder';

const App: React.FC = () => {
    const [selectedMentor, setSelectedMentor] = useState<UserProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isGuestMode, setIsGuestMode] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null); 
    const [currentView, setCurrentView] = useState<View>('directory');
    const [previousView, setPreviousView] = useState<View>('directory');
    const [selectedMentorshipId, setSelectedMentorshipId] = useState<number | null>(null);
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [selectedUserForPortfolio, setSelectedUserForPortfolio] = useState<UserProfile | null>(null);
    const [initialGoalId, setInitialGoalId] = useState<number | null>(null);
    const [defaultAvatar, setDefaultAvatar] = useState<string>('');
    const [allMentorships, setAllMentorships] = useState<MentorshipRequest[]>([]);
    const [canViewAllRecords, setCanViewAllRecords] = useState(false);
    const [canSendEmail, setCanSendEmail] = useState(false);
    const [swimmerProgressToken, setSwimmerProgressToken] = useState<string | null>(null);
    const [isPublicCampRosters, setIsPublicCampRosters] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        // Persist collapsed state in localStorage
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });
    
    // Focus mode - LearnDash-style distraction-free learning
    const [isFocusMode, setIsFocusMode] = useState(false);

    // Pending assigned lesson — set by AssignedLearningBanner to deep-link into LMS
    const [pendingAssignedLessonId, setPendingAssignedLessonId] = useState<number | undefined>(undefined);
    
    // State for cross-page navigation (e.g., New Hires -> Users List -> Back)
    const [userSearchTerm, setUserSearchTerm] = useState<string>('');
    const [returnToPage, setReturnToPage] = useState<string | null>(null);
    
    // Save collapsed state to localStorage
    const handleSidebarCollapse = (collapsed: boolean) => {
        setIsSidebarCollapsed(collapsed);
        localStorage.setItem('sidebar-collapsed', String(collapsed));
    };
    
    // Focus mode effect - hide WordPress chrome (admin bar, theme header/footer)
    useEffect(() => {
        if (isFocusMode) {
            document.body.classList.add('aquaticpro-focus-mode');
            // Hide WP admin bar and common theme elements
            const style = document.createElement('style');
            style.id = 'aquaticpro-focus-mode-styles';
            style.textContent = `
                body.aquaticpro-focus-mode #wpadminbar,
                body.aquaticpro-focus-mode .site-header,
                body.aquaticpro-focus-mode header.site-header,
                body.aquaticpro-focus-mode .site-footer,
                body.aquaticpro-focus-mode footer.site-footer,
                body.aquaticpro-focus-mode .wp-site-header,
                body.aquaticpro-focus-mode .wp-site-footer,
                body.aquaticpro-focus-mode .header,
                body.aquaticpro-focus-mode .footer,
                body.aquaticpro-focus-mode #masthead,
                body.aquaticpro-focus-mode #colophon,
                body.aquaticpro-focus-mode .genesis-nav-menu,
                body.aquaticpro-focus-mode .nav-primary,
                body.aquaticpro-focus-mode #site-navigation {
                    display: none !important;
                }
                body.aquaticpro-focus-mode .mentorship-platform-container {
                    margin-top: 0 !important;
                    padding: 0 !important;
                }
                body.aquaticpro-focus-mode {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                }
                html.aquaticpro-focus-mode {
                    margin-top: 0 !important;
                }
            `;
            document.head.appendChild(style);
            document.documentElement.classList.add('aquaticpro-focus-mode');
        } else {
            document.body.classList.remove('aquaticpro-focus-mode');
            document.documentElement.classList.remove('aquaticpro-focus-mode');
            const style = document.getElementById('aquaticpro-focus-mode-styles');
            if (style) style.remove();
        }
        
        return () => {
            document.body.classList.remove('aquaticpro-focus-mode');
            document.documentElement.classList.remove('aquaticpro-focus-mode');
            const style = document.getElementById('aquaticpro-focus-mode-styles');
            if (style) style.remove();
        };
    }, [isFocusMode]);

    useEffect(() => {
    const initializeApp = async () => {
        setIsAppLoading(true);
        
        // Check for public pages FIRST (before any API calls)
        const params = new URLSearchParams(window.location.search);
        const swimmerProgressParam = params.get('swimmer_progress');
        const tokenFromUrl = params.get('token');
        const campRostersParam = params.has('camp_rosters');
        const rootElement = document.getElementById('root');
        const dataView = rootElement?.getAttribute('data-view');
        const isSwimmerProgressPage = dataView === 'swimmer-progress';
        const isCampRostersPage = dataView === 'camp-rosters';
        const isReturnFormPage = dataView === 'return-form';
        const isNewHireFormPage = dataView === 'new-hire-form';
        const shortcodeToken = rootElement?.getAttribute('data-swimmer-progress-token');
        
        // Extract token from path-based URL: /return-form/TOKEN
        let pathToken = '';
        const pathMatch = window.location.pathname.match(/\/return-form\/([a-f0-9]+)\/?$/i);
        if (pathMatch) {
            pathToken = pathMatch[1];
        }
        const returnFormToken = rootElement?.getAttribute('data-token') || pathToken || tokenFromUrl;
        
        // Extract token from path-based URL: /swimmer-progress/TOKEN
        let swimmerProgressPathToken = '';
        const swimmerProgressPathMatch = window.location.pathname.match(/\/swimmer-progress\/([a-f0-9]+)\/?$/i);
        if (swimmerProgressPathMatch) {
            swimmerProgressPathToken = swimmerProgressPathMatch[1];
        }
        
        // Handle new hire application form public page
        if (isNewHireFormPage) {
            setIsAppLoading(false);
            return; // Don't continue with normal initialization - this is a public page
        }
        
        // Handle seasonal return form public page
        if (isReturnFormPage) {
            setSwimmerProgressToken(returnFormToken || ''); // Reuse swimmer progress token state for return form token
            setIsAppLoading(false);
            return; // Don't continue with normal initialization - this is a public page
        }
        
        // Handle swimmer progress from shortcode, URL param, path-based URL, or token - this is a public page
        if (isSwimmerProgressPage || swimmerProgressParam || swimmerProgressPathToken || tokenFromUrl) {
            const token = swimmerProgressParam || swimmerProgressPathToken || tokenFromUrl || shortcodeToken || '';
            setSwimmerProgressToken(token);
            setIsAppLoading(false);
            return; // Don't continue with normal initialization - this is a public page
        }
        
        // Handle camp rosters public page
        if (isCampRostersPage || campRostersParam) {
            setIsPublicCampRosters(true);
            setIsAppLoading(false);
            return; // Don't continue with normal initialization - this is a public page
        }
        
        // Directly use the data passed from PHP
        const wpData = window.mentorshipPlatformData;
        if (wpData && wpData.api_url) {
            configureApiService(wpData.api_url, wpData.nonce);
            // NOTE: User cache preload removed from here - let components load on-demand
            // This prevents 100+ user fetches on every page load for sites with many users
        } else {
            console.error("AquaticPro data not found, API calls will fail.");
            // Optionally, set an error state to show a message in the UI
            setIsAppLoading(false);
            return;
        }

        if (window.mentorshipPlatformData) {
            if (window.mentorshipPlatformData.isLoggedIn && window.mentorshipPlatformData.current_user) {
                setCurrentUser(window.mentorshipPlatformData.current_user);
                setIsLoggedIn(true);

                // Fetch mentorships + permissions IN PARALLEL (saves ~5s vs sequential)
                const mentorshipsPromise = getMyMentorships()
                    .then(response => setAllMentorships(response.requests))
                    .catch(error => console.error('Failed to fetch initial mentorships', error));

                let permissionsPromise: Promise<void> = Promise.resolve();
                if (window.mentorshipPlatformData.is_admin) {
                    setCanViewAllRecords(true);
                    setCanSendEmail(true);
                } else {
                    permissionsPromise = fetch(`${window.mentorshipPlatformData.api_url}/professional-growth/my-permissions`, {
                        headers: { 'X-WP-Nonce': window.mentorshipPlatformData.nonce },
                    })
                        .then(async (permResponse) => {
                            if (permResponse.ok) {
                                const perms = await permResponse.json();
                                setCanViewAllRecords(perms.reportsPermissions?.canViewAllRecords ?? false);
                                setCanSendEmail(perms.emailPermissions?.canSendEmail ?? false);
                            }
                        })
                        .catch(err => console.error('Failed to fetch reports permissions:', err));
                }

                // Wait for both to complete before continuing
                await Promise.all([mentorshipsPromise, permissionsPromise]);
            } else {
                setCurrentUser(null);
                setIsLoggedIn(false);
            }
            if (window.mentorshipPlatformData.default_avatar_url) {
                setDefaultAvatar(window.mentorshipPlatformData.default_avatar_url);
            }

            // Handle URL-based views (for public portfolio/profile)
            const viewParam = params.get('view');
            const userIdParam = params.get('user_id');
            
            // Handle tab-based navigation (e.g., from New Hires -> Users List)
            const tabParam = params.get('tab');
            const searchParam = params.get('search');
            const returnToParam = params.get('return_to');

            if (tabParam === 'users' && window.mentorshipPlatformData.is_admin) {
                // Navigate to Users List with optional search term
                if (searchParam) {
                    setUserSearchTerm(decodeURIComponent(searchParam));
                }
                if (returnToParam) {
                    setReturnToPage(returnToParam);
                }
                setCurrentView('usermgmt:users-list');
                setPreviousView('homeDashboard');
                // Clear URL params to avoid re-triggering on refresh
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (viewParam === 'portfolio' && userIdParam) {
                try {
                    const user = await getCurrentUser(Number(userIdParam));
                    setSelectedUserForPortfolio(user);
                    // Check for goal_id parameter to deep link to a specific goal
                    const goalIdParam = params.get('goal_id');
                    if (goalIdParam) {
                        setInitialGoalId(Number(goalIdParam));
                    }
                    navigate('portfolio');
                } catch (error) {
                    console.error("Failed to fetch user for portfolio", error);
                    // Optionally navigate back or show an error
                    navigate('directory');
                }
            } else if (viewParam === 'mentorProfile' && userIdParam) {
                 try {
                    const user = await getCurrentUser(Number(userIdParam));
                    setSelectedMentor(user);
                    navigate('mentorProfile');
                } catch (error) {
                    console.error("Failed to fetch user for profile", error);
                     navigate('directory');
                }
            }
             // Set initial view based on login status if no URL params detected
            else if (!viewParam && !userIdParam) {
                // Check if shortcode specified a default view
                const rootElement = document.getElementById('root');
                const defaultViewAttr = rootElement?.getAttribute('data-default-view');
                
                let initialView: View;
                
                if (defaultViewAttr) {
                    // Use the shortcode-specified default view
                    initialView = defaultViewAttr as View;
                } else if (window.mentorshipPlatformData.default_home_view) {
                    // Use the admin-configured default home view
                    initialView = window.mentorshipPlatformData.default_home_view as View;
                } else {
                    // Fallback: logged-in users go to dashboard, others see public landing (handled elsewhere)
                    initialView = window.mentorshipPlatformData.isLoggedIn ? 'homeDashboard' : 'portfolioDirectory';
                }
                
                setCurrentView(initialView);
                setPreviousView(initialView);
            }

        } else {
            console.error("AquaticPro data not found. Plugin might not be configured correctly.");
            setIsLoggedIn(false);
        }

        setIsAppLoading(false);
    };
    initializeApp();
    }, []);

    // Listen for custom navigation events (e.g., from UserManagement return button)
    useEffect(() => {
        const handleNavigateEvent = (e: Event) => {
            const customEvent = e as CustomEvent<View>;
            if (customEvent.detail) {
                navigate(customEvent.detail);
            }
        };
        
        // Listen for navigation to Users List with search (from NewHireManager)
        const handleNavigateToUsersList = (e: Event) => {
            const customEvent = e as CustomEvent<{ search: string; returnTo: string }>;
            if (customEvent.detail) {
                setUserSearchTerm(customEvent.detail.search);
                setReturnToPage(customEvent.detail.returnTo);
                navigate('usermgmt:users-list');
            }
        };
        
        window.addEventListener('navigate-view', handleNavigateEvent);
        window.addEventListener('navigate-to-users-list', handleNavigateToUsersList);
        return () => {
            window.removeEventListener('navigate-view', handleNavigateEvent);
            window.removeEventListener('navigate-to-users-list', handleNavigateToUsersList);
        };
    }, []);

    const navigate = (view: View) => {
        if (view !== currentView) {
            setPreviousView(currentView);
        }
        if (['directory', 'myMentees', 'myProfile', 'portfolioDirectory', 'admin', 'careerDevelopment', 'userManagement', 'dailyLogs', 'reports'].includes(view)) {
            // Reset all selections when going to a top-level view
            setSelectedMentor(null);
            setSelectedMentorshipId(null);
            setSelectedUserForPortfolio(null);
        }
        setCurrentView(view);
    };
    
    const handleBack = () => {
        const leavingView = currentView;
        setCurrentView(previousView);

        if (leavingView === 'dashboard') setSelectedMentorshipId(null);
        if (leavingView === 'portfolio') setSelectedUserForPortfolio(null);
        if (leavingView === 'mentorProfile') setSelectedMentor(null);
    };

    const handleSelectMentor = (mentor: UserProfile) => {
        setSelectedMentor(mentor);
        navigate('mentorProfile');
    };

    const handleSelectPortfolioUser = (user: UserProfile) => {
        setSelectedUserForPortfolio(user);
        navigate('portfolio');
    };

    const handleSaveSettings = async (updatedUser: UserProfile) => {
        try {
            const savedUser = await updateUserProfile(updatedUser.id, updatedUser);
            // Ensure required arrays exist
            const normalizedUser = {
                ...savedUser,
                skills: savedUser.skills || [],
                customLinks: savedUser.customLinks || [],
            };
            setCurrentUser(normalizedUser);
            navigate('myProfile'); // Go to profile to see changes
        } catch (error) {
            console.error("Failed to save settings", error);
            alert('Failed to save profile. Please try again.');
        }
    };
    
    const handleViewDashboard = (mentorshipId: number) => {
        setSelectedMentorshipId(mentorshipId);
        navigate('dashboard');
    };
    
    const handleViewPortfolio = (user: UserProfile) => {
        setSelectedUserForPortfolio(user);
        navigate('portfolio');
    };

    const renderContent = () => {
        // Get WordPress data - this is always available when the app is rendered
        const wpData = window.mentorshipPlatformData!;
        
        // Publicly accessible views that do NOT require a currentUser
        // Views that require a currentUser
        if (!currentUser) {
            if (currentView === 'portfolio' && selectedUserForPortfolio) {
                return <PortfolioPage user={selectedUserForPortfolio} onBack={handleBack} currentUser={null} initialGoalId={initialGoalId} />;
            }
            if (currentView === 'mentorProfile' && selectedMentor) {
                return <MentorProfile mentor={selectedMentor} onBack={handleBack} isPublicView={true} currentUser={null} onViewPortfolio={handleViewPortfolio} />;
            }
            if (currentView === 'portfolioDirectory') {
                return <PortfolioDirectory onSelectUser={handleSelectPortfolioUser} />;
            }
            return null;
        }
        
        switch (currentView) {
            case 'homeDashboard':
                return <Dashboard currentUser={currentUser} onNavigate={navigate} />;
            case 'mentorProfile':
                // The 'myProfile' case handles the current user view
                return selectedMentor && <MentorProfile mentor={selectedMentor} onBack={handleBack} onViewPortfolio={handleViewPortfolio} currentUser={currentUser} isCurrentUser={false} />;
            case 'myProfile':
                return <MentorProfile mentor={currentUser} onBack={handleBack} isCurrentUser onEditProfile={() => navigate('settings')} onViewPortfolio={handleViewPortfolio} currentUser={currentUser} />;
            case 'settings':
                return <UserSettings user={currentUser} onBack={handleBack} onSave={handleSaveSettings} onViewDashboard={handleViewDashboard} defaultAvatar={defaultAvatar} />;
            case 'dashboard':
                if (!selectedMentorshipId) {
                    handleBack();
                    return null;
                }
                return (wpData.enable_mentorship ?? true)
                    ? <MentorshipDashboard mentorshipId={selectedMentorshipId} currentUser={currentUser} onBack={handleBack} isAdmin={wpData.is_admin} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'myMentees':
                return (wpData.enable_mentorship ?? true)
                    ? <MyMentees currentUser={currentUser} onSelectMentorship={handleViewDashboard} isAdmin={wpData.is_admin} initialMentorships={allMentorships} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            // Daily Logs views
            case 'dailyLogs':
            case 'dailyLogs:read-all':
                return (wpData.enable_daily_logs ?? true)
                    ? <DailyLogDashboard 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        subView="read-all"
                        onSubViewChange={(subView) => navigate(`dailyLogs:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'dailyLogs:my-logs':
                return (wpData.enable_daily_logs ?? true)
                    ? <DailyLogDashboard 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        subView="my-logs"
                        onSubViewChange={(subView) => navigate(`dailyLogs:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'dailyLogs:create-edit':
                return (wpData.enable_daily_logs ?? true)
                    ? <DailyLogDashboard 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        subView="create-edit"
                        onSubViewChange={(subView) => navigate(`dailyLogs:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            // Career Development views
            case 'careerDevelopment':
            case 'career:promotion-progress':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="promotion-progress"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:team-view':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="team-view"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:inservice-log':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="inservice-log"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:scan-audits':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="scan-audits"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:live-drills':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="live-drills"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:cashier-audits':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="cashier-audits"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'career:instructor-evaluations':
                return (wpData.enable_professional_growth ?? false)
                    ? <CareerDevelopment 
                        currentUser={currentUser} 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="instructor-evaluations"
                        onSubViewChange={(subView) => navigate(`career:${subView}` as View)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            // User Management views
            case 'userManagement':
            case 'usermgmt:users-list':
                return wpData.is_admin ? 
                    <UserManagementDashboard 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="users-list"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                        initialSearch={userSearchTerm}
                        returnToPage={returnToPage}
                        onClearReturn={() => {
                            setUserSearchTerm('');
                            setReturnToPage(null);
                        }}
                    /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:role-management':
                return wpData.is_admin ? 
                    <UserManagementDashboard 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="role-management"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                    /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:criteria-management':
                return wpData.is_admin ? 
                    <UserManagementDashboard 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="criteria-management"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                    /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:location-management':
                return wpData.is_admin ? 
                    <UserManagementDashboard 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="location-management"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                    /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:time-slot-management':
                return wpData.is_admin ? 
                    <UserManagementDashboard 
                        onBack={handleBack} 
                        isAdmin={wpData.is_admin}
                        subView="time-slot-management"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                    /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:action-buttons':
                return wpData.is_admin ? 
                    <ActionButtonsManagement /> 
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:dashboard-settings':
                return wpData.is_admin ? 
                    <DashboardSettings /> 
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:daily-log-import':
                return (wpData.is_admin && !wpData.visitor_mode) ? (
                    <UserManagementDashboard 
                        onBack={handleBack}
                        isAdmin={wpData.is_admin}
                        subView="daily-log-import"
                        onSubViewChange={(subView) => navigate(`usermgmt:${subView}` as View)}
                    />
                ) : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:pay-config':
                return wpData.is_admin ? 
                    <PayConfigList /> 
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            case 'reports':
                return (wpData.enable_reports ?? true) 
                    ? <ComplianceReports currentUser={currentUser} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'admin':
                return wpData.is_admin ? <AdminPanel onSelectMentorship={handleViewDashboard} /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'taskdeck':
                return (wpData.enable_taskdeck ?? false) 
                    ? <TaskDeck currentUser={currentUser} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'foiaExport':
                return wpData.is_admin && (wpData.enable_foia_export ?? false)
                    ? <FOIAExport currentUser={currentUser} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'lessonExport':
                return wpData.enable_lesson_management 
                    ? <LessonManagementExport currentUser={currentUser} />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            // Awesome Awards views
            case 'awards':
                return wpData.enable_awesome_awards 
                    ? <AwardsHub initialTab="browse" />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'awards:manage-periods':
                return wpData.enable_awesome_awards 
                    ? <AwardPeriodManagement 
                        onNavigateToApprovals={(_periodId) => {
                            // Navigate to approvals view with the period ID
                            // For now, just go to the approvals view
                            navigate('awards:approvals');
                        }}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'awards:nominate':
                return wpData.enable_awesome_awards 
                    ? <AwardsHub initialTab="nominate" />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'awards:approvals':
                return wpData.enable_awesome_awards 
                    ? <AwardsHub initialTab="approvals" />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'awards:winners':
                return wpData.enable_awesome_awards 
                    ? <WinnersGallery />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'awards:permissions':
                // Permissions management for Awesome Awards
                return wpData.enable_awesome_awards 
                    ? <AwesomeAwardsPermissions />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            // Lesson Management views
            case 'lessons':
            case 'lessons:management':
                return wpData.enable_lesson_management 
                    ? <LessonManagement 
                        apiUrl={wpData.restUrl}
                        nonce={wpData.nonce}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'lessons:email-evaluations':
                return wpData.enable_lesson_management 
                    ? <EmailEvaluations 
                        apiUrl={wpData.restUrl}
                        nonce={wpData.nonce}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'lessons:camp-rosters':
                return wpData.enable_lesson_management 
                    ? <CampRosters 
                        apiUrl={wpData.restUrl}
                        nonce={wpData.nonce}
                        isPublic={false}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'lessons:settings':
                return wpData.enable_lesson_management 
                    ? <LessonManagement 
                        apiUrl={wpData.restUrl}
                        nonce={wpData.nonce}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // Seasonal Returns views
            case 'seasonalReturns':
            case 'seasonalReturns:dashboard':
                return (wpData.enable_seasonal_returns ?? true) ? <SeasonManagement /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'seasonalReturns:invites':
                return (wpData.enable_seasonal_returns ?? true) ? <ReturnInviteManager /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'seasonalReturns:responses':
                return (wpData.enable_seasonal_returns ?? true) ? <ResponseTracker /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'seasonalReturns:templates':
                return (wpData.enable_seasonal_returns ?? true) ? <EmailTemplateManager /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // New Hires / Onboarding (under Admin menu)
            case 'usermgmt:new-hires':
                return (wpData.enable_new_hires ?? false) ? <NewHireManager /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            
            // Legacy Import (Admin only - for migrating Pods mentorship data)
            case 'usermgmt:legacy-import':
                return (wpData.is_admin && !wpData.visitor_mode) ? <LegacyImport /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // Mileage Reimbursement
            case 'mileage':
                return (wpData.enable_mileage ?? false) ? <MileageModule currentUser={currentUser!} /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // Email Composer (Admin or users with canSendEmail permission)
            case 'emailComposer':
                return (wpData.is_admin || canSendEmail) ? <EmailComposer /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // Certificate Tracking
            case 'certificates':
                return (wpData.enable_certificates ?? true) ? <CertificatesPage currentUser={currentUser} /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'usermgmt:certificate-settings':
                return (wpData.enable_certificates ?? true) ? <CertificatesPage currentUser={currentUser} adminMode /> : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            // Learning/LMS views
            case 'learning':
            case 'learning:courses':
                return (wpData.enable_lms ?? false) 
                    ? <LMSModule 
                        currentUser={currentUser}
                        initialView="course-list"
                        onBack={handleBack}
                        isFocusMode={isFocusMode}
                        onFocusModeChange={setIsFocusMode}
                        assignedLessonId={pendingAssignedLessonId}
                        onAssignedLessonConsumed={() => setPendingAssignedLessonId(undefined)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'learning:my-progress':
                return (wpData.enable_lms ?? false)
                    ? <LMSModule 
                        currentUser={currentUser}
                        initialView="home"
                        onBack={handleBack}
                        isFocusMode={isFocusMode}
                        onFocusModeChange={setIsFocusMode}
                        assignedLessonId={pendingAssignedLessonId}
                        onAssignedLessonConsumed={() => setPendingAssignedLessonId(undefined)}
                    />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;
            case 'learning:course-builder':
                return wpData.is_admin && (wpData.enable_lms ?? false)
                    ? <LMSModule 
                        currentUser={currentUser}
                        initialView="course-builder"
                        onBack={handleBack}
                        isFocusMode={isFocusMode}
                        onFocusModeChange={setIsFocusMode}
                      />
                    : <MentorDirectory onSelectMentor={handleSelectMentor} />;

            case 'directory':
            default:
                if (currentView === 'portfolio' && selectedUserForPortfolio) {
                    return <PortfolioPage user={selectedUserForPortfolio} onBack={handleBack} currentUser={currentUser} initialGoalId={initialGoalId} />;
                }
                // If in guest mode, show public portfolio directory instead of internal mentor directory
                if (isGuestMode || wpData.visitor_mode) {
                     return <PortfolioDirectory onSelectUser={(user) => {
                         setSelectedUserForPortfolio(user);
                         navigate('portfolio');
                     }} />;
                }
                return <MentorDirectory onSelectMentor={handleSelectMentor} />;
        }
    };

    // Render public swimmer progress view if token is present (check FIRST - works for logged-in or not)
    const rootElement = document.getElementById('root');
    const dataView = rootElement?.getAttribute('data-view');
    const isReturnFormPage = dataView === 'return-form';
    const isNewHireFormPage = dataView === 'new-hire-form';
    
    // Render public new hire application form
    if (isNewHireFormPage) {
        return (
            <div className="ap-min-h-screen ap-bg-gray-50 ap-py-12 ap-px-4">
                <NewHireApplicationForm />
            </div>
        );
    }
    
    if (isReturnFormPage && swimmerProgressToken !== null) {
        return (
            <PublicReturnForm
                token={swimmerProgressToken}
            />
        );
    }
    
    if (swimmerProgressToken !== null) {
        return (
            <PublicSwimmerProgress
                apiUrl={window.mentorshipPlatformData?.api_url || ''}
                token={swimmerProgressToken}
            />
        );
    }

    // Render public camp rosters view (check SECOND - works for logged-in or not)
    if (isPublicCampRosters) {
        return (
            <CampRosters
                apiUrl={window.mentorshipPlatformData?.restUrl || ''}
                nonce=""
                isPublic={true}
            />
        );
    }

    if (!isLoggedIn && !isGuestMode) {
        // Show the public landing page for non-logged-in users
        // This is a fully self-contained SPA experience
        return <PublicLandingPage onEnterGuestMode={() => {
            setIsGuestMode(true);
            // Simulate visitor mode environment
            if (window.mentorshipPlatformData) {
                window.mentorshipPlatformData.visitor_mode = true;
                window.mentorshipPlatformData.read_only_mode = true;
            }
            
            // Set a fake current user so components can render
            setCurrentUser({
                id: 0,
                firstName: 'Visitor',
                lastName: '',
                avatarUrl: '',
                tagline: 'Guest User',
                mentorOptIn: false,
                skills: [],
                bioDetails: 'Visitor Mode',
                experience: '',
                customLinks: [],
                tier: 0
            });
            
            setCurrentView('directory'); // Default to directory for guests
        }} />;
    }

    if (isAppLoading) {
        return (
            <div className="ap-min-h-screen ap-flex ap-items-center ap-justify-center ap-bg-gray-100 dark:ap-bg-gray-900">
                <LoadingSpinner />
            </div>
        );
    }

    // Get WordPress data for the main render - asserted non-null at this point
    const wpData = window.mentorshipPlatformData!;

    return (
        <div className={`ap-min-h-screen ap-bg-gray-100 ap-text-gray-800 ap-font-sans ${isFocusMode ? 'focus-mode-active' : ''}`}>
            {/* Sidebar - hidden in focus mode */}
            {!isFocusMode && (
                <Sidebar
                    currentUser={currentUser}
                    currentView={currentView}
                    onNavigate={navigate}
                    isAdmin={wpData.is_admin}
                    canViewAllRecords={canViewAllRecords}
                    canSendEmail={canSendEmail}
                    enableMentorship={wpData.enable_mentorship ?? true}
                    enableDailyLogs={wpData.enable_daily_logs ?? true}
                    enableProfessionalGrowth={wpData.enable_professional_growth ?? false}
                    enableTaskDeck={wpData.enable_taskdeck ?? false}
                    enableAwesomeAwards={wpData.enable_awesome_awards ?? false}
                    enableLessonManagement={wpData.enable_lesson_management ?? false}
                    enableLMS={wpData.enable_lms ?? false}
                    enableMileage={wpData.enable_mileage ?? false}
                    enableSeasonalReturns={wpData.enable_seasonal_returns ?? true}
                    enableCertificates={wpData.enable_certificates ?? true}
                    enableNewHires={wpData.enable_new_hires ?? false}
                    enableReports={wpData.enable_reports ?? true}
                    enableFOIA={wpData.enable_foia_export ?? false}
                    isCollapsed={isSidebarCollapsed}
                    onCollapsedChange={handleSidebarCollapse}
                    isGuestMode={isGuestMode}
                />
            )}

            <main className={`transition-all duration-300 ${
                isFocusMode 
                    ? 'ml-0 p-0' 
                    : `${isSidebarCollapsed ? 'md:ap-ml-16' : 'md:ap-ml-64'} ${
                        currentView.startsWith('courseBuilder') 
                            ? 'ap-p-0' : 'ap-p-0 md:ap-px-6 md:ap-py-8'
                    }`
            }`}>
                {/* Visitor / Archived Mode Banner - Hidden in focus mode */}
                {!isFocusMode && wpData.visitor_mode && (
                    <div className="ap-bg-amber-50 ap-border-l-4 ap-border-amber-400 ap-p-4 ap-mb-6 ap-shadow-sm ap-mx-4 ap-mt-4 lg:ap-mx-0 lg:ap-mt-0">
                        <div className="ap-flex">
                            <div className="ap-flex-shrink-0">
                                <svg className="ap-h-5 ap-w-5 ap-text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ap-ml-3">
                                <h3 className="ap-text-sm ap-font-medium ap-text-amber-800">
                                    {wpData.account_status === 'archived' ? 'Account Archived' : 'Visitor Access'}
                                </h3>
                                <div className="ap-mt-1 ap-text-sm ap-text-amber-700">
                                    <p>
                                        {wpData.account_status === 'archived' 
                                            ? "You are viewing the platform in a restricted Visitor Mode. Operational data is ap-hidden and features are disabled." : "You are viewing the framework in Visitor Mode. Edit capabilities and live data are restricted."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unified persistent alert strip — certificates, lessons, courses, taskdeck */}
                {!isFocusMode && !isGuestMode && !wpData.visitor_mode && (
                    <UnifiedAlertStrip
                        onNavigate={navigate}
                        onOpenLesson={(lessonId) => {
                            setPendingAssignedLessonId(lessonId);
                            navigate('learning');
                        }}
                        enableTaskDeck={!!(wpData.enable_taskdeck)}
                        enableLms={!!(wpData.enable_lms)}
                        enableCertificates={!!(wpData.enable_certificates ?? true)}
                        currentView={currentView}
                    />
                )}
                <Suspense fallback={
                    <div className="ap-flex ap-justify-center ap-items-center ap-p-12">
                        <LoadingSpinner />
                    </div>
                }>
                    {renderContent()}
                </Suspense>
            </main>

            {!isFocusMode && !currentView.startsWith('courseBuilder') && (
                <footer className={`ap-bg-white ap-mt-12 ap-py-6 ap-text-center ap-text-sm ap-text-gray-500 ap-transition-all ap-duration-300 ${isSidebarCollapsed ? 'md:ap-ml-16' : 'md:ap-ml-64'}`}>
                    <p>&copy; {new Date().getFullYear()} Swimming Ideas, LLC. All rights reserved.</p>
                </footer>
            )}
        </div>
    );
};

export default App;