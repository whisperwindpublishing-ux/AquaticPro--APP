import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { View } from '@/App';
import { Button } from './ui';
import { getUserReactionStats, UserReactionStats } from '@/services/api';
import {
    HiOutlineSparkles,
    HiOutlineUsers,
    HiOutlineUserGroup,
    HiOutlineDocumentText,
    HiOutlineAcademicCap,
    HiOutlineChartBar,
    HiOutlineCog,
    HiOutlineUser,
    HiOutlineShieldCheck,
    HiOutlineBars3,
    HiOutlineXMark,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineChevronLeft,
    HiOutlineBriefcase,
    HiOutlineDocumentArrowDown,
    HiOutlineHome,
    HiArrowRightOnRectangle,
    HiOutlineHandThumbUp,
    HiOutlineHandThumbDown,
    HiOutlineHeart,
    HiOutlineTrophy,
    HiOutlineCalendar,
    HiOutlineTruck,
    HiOutlineBookOpen,
    HiOutlineEnvelope,
    HiOutlineClipboardDocumentCheck
} from 'react-icons/hi2';
import { FaPersonSwimming } from 'react-icons/fa6';

interface SidebarProps {
    currentUser: UserProfile | null;
    currentView: View;
    onNavigate: (view: View) => void;
    isAdmin: boolean;
    canViewAllRecords?: boolean;
    canSendEmail?: boolean;
    enableMentorship?: boolean;
    enableDailyLogs?: boolean;
    enableProfessionalGrowth?: boolean;
    enableTaskDeck?: boolean;
    enableAwesomeAwards?: boolean;
    enableLessonManagement?: boolean;
    enableLMS?: boolean;
    enableMileage?: boolean;
    enableSeasonalReturns?: boolean;
    enableCertificates?: boolean;
    enableNewHires?: boolean;
    enableReports?: boolean;
    enableFOIA?: boolean;
    isCollapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    isGuestMode?: boolean;
}

interface SubMenuItem {
    view: View;
    label: string;
}

interface NavItem {
    view: View;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresAuth?: boolean;
    adminOnly?: boolean;
    requiresFoiaAccess?: boolean;
    requiresEmailAccess?: boolean;
    highlighted?: boolean;
    subItems?: SubMenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentUser, 
    currentView, 
    onNavigate, 
    isAdmin, 
    canViewAllRecords = false, 
    canSendEmail = false,
    enableMentorship = true,
    enableDailyLogs = true,
    enableProfessionalGrowth = true, 
    enableTaskDeck = false, 
    enableAwesomeAwards = false, 
    enableLessonManagement = false, 
    enableLMS = false,
    enableMileage = false,
    enableSeasonalReturns = true,
    enableCertificates = true,
    enableReports = true,
    enableFOIA = false,
    isCollapsed = false, 
    onCollapsedChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [reactionStats, setReactionStats] = useState<UserReactionStats | null>(null);
    
    // Load reaction stats for current user
    useEffect(() => {
        if (currentUser?.id) {
            getUserReactionStats(currentUser.id)
                .then(setReactionStats)
                .catch(err => console.error('Failed to load reaction stats:', err));
        }
    }, [currentUser?.id]);
    
    // Initialize expanded sections based on current view
    const getInitialExpandedSections = () => {
        const expanded = new Set<View>();
        // Auto-expand if viewing a parent section or its subview
        if (currentView === 'dailyLogs' || currentView.startsWith('dailyLogs:')) {
            expanded.add('dailyLogs');
        }
        if (currentView === 'careerDevelopment' || currentView.startsWith('career:')) {
            expanded.add('careerDevelopment');
        }
        if (currentView === 'userManagement' || currentView.startsWith('usermgmt:')) {
            expanded.add('userManagement');
        }
        if (currentView === 'lessons' || currentView.startsWith('lessons:') || currentView === 'lessonExport') {
            expanded.add('lessons');
        }
        if (currentView === 'awards' || currentView.startsWith('awards:')) {
            expanded.add('awards');
        }
        if (currentView === 'seasonalReturns' || currentView.startsWith('seasonalReturns:')) {
            expanded.add('seasonalReturns');
        }
        if (currentView === 'learning' || currentView.startsWith('learning:')) {
            expanded.add('learning');
        }
        return expanded;
    };
    
    const [expandedSections, setExpandedSections] = useState<Set<View>>(getInitialExpandedSections());

    const navItems: NavItem[] = [
        { view: 'homeDashboard', label: 'Dashboard', icon: HiOutlineHome, requiresAuth: true },
        { view: 'directory', label: 'Mentor Directory', icon: HiOutlineUsers },
        { view: 'myMentees', label: 'My Mentorships', icon: HiOutlineUserGroup, requiresAuth: true },
        { 
            view: 'dailyLogs', 
            label: 'Daily Logs', 
            icon: HiOutlineDocumentText, 
            requiresAuth: true,
            subItems: [
                { view: 'dailyLogs:read-all', label: 'Read All Logs' },
                { view: 'dailyLogs:my-logs', label: 'My Logs' },
                { view: 'dailyLogs:create-edit', label: 'Create New Log' }
            ]
        },
        { 
            view: 'careerDevelopment', 
            label: 'Career Development', 
            icon: HiOutlineAcademicCap, 
            requiresAuth: true,
            subItems: [
                { view: 'career:promotion-progress', label: 'My Promotion Progress' },
                { view: 'career:team-view', label: 'Team Progress' },
                { view: 'career:inservice-log', label: 'In-Service Training' },
                { view: 'career:scan-audits', label: 'Scan Audits' },
                { view: 'career:live-drills', label: 'Live Recognition Drills' },
                { view: 'career:cashier-audits', label: 'Cashier Audits' },
                { view: 'career:instructor-evaluations', label: 'Swim Instructor Evaluations' }
            ]
        },
        { view: 'reports', label: 'Reports', icon: HiOutlineChartBar, requiresAuth: true },
        { 
            view: 'lessons', 
            label: 'Lessons', 
            icon: FaPersonSwimming, 
            requiresAuth: true,
            subItems: [
                { view: 'lessons:management', label: 'Management' },
                { view: 'lessons:email-evaluations', label: 'Email Evaluations' },
                { view: 'lessons:camp-rosters', label: 'Camp Rosters' },
                { view: 'lessonExport', label: 'Export Data (CSV)' }
            ]
        },
        { 
            view: 'learning', 
            label: 'Learning', 
            icon: HiOutlineBookOpen, 
            requiresAuth: true,
            subItems: [
                { view: 'learning:my-progress', label: 'My Progress' },
                { view: 'learning:courses', label: 'Browse Courses' },
                { view: 'learning:course-builder', label: 'Course Builder' }
            ]
        },
        { view: 'taskdeck', label: 'TaskDeck', icon: HiOutlineBriefcase, requiresAuth: true },
        { view: 'certificates', label: 'Certificates', icon: HiOutlineClipboardDocumentCheck, requiresAuth: true },
        { view: 'mileage', label: 'Mileage', icon: HiOutlineTruck, requiresAuth: true },
        { 
            view: 'awards', 
            label: 'Awards', 
            icon: HiOutlineTrophy, 
            requiresAuth: true,
            subItems: [
                { view: 'awards:manage-periods', label: 'Manage Awards' },
                { view: 'awards:nominate', label: 'Nominate & Vote' },
                { view: 'awards:winners', label: 'Winners Gallery' }
            ]
        },
        { 
            view: 'seasonalReturns', 
            label: 'Seasonal Returns', 
            icon: HiOutlineCalendar, 
            requiresAuth: true, 
            adminOnly: true,
            subItems: [
                { view: 'seasonalReturns:dashboard', label: 'Dashboard' },
                { view: 'seasonalReturns:invites', label: 'Return Invites' },
                { view: 'seasonalReturns:responses', label: 'Responses' },
                { view: 'seasonalReturns:templates', label: 'Email Templates' }
            ]
        },
        { 
            view: 'userManagement', 
            label: 'Admin', 
            icon: HiOutlineUsers, 
            requiresAuth: true, 
            adminOnly: true,
            subItems: [
                { view: 'usermgmt:users-list', label: 'Users List' },
                { view: 'usermgmt:new-hires', label: 'New Hires' },
                { view: 'usermgmt:pay-config', label: 'Pay Configuration' },
                { view: 'usermgmt:role-management', label: 'Job Roles' },
                { view: 'usermgmt:criteria-management', label: 'Promotion Criteria' },
                { view: 'usermgmt:location-management', label: 'Locations' },
                { view: 'usermgmt:time-slot-management', label: 'Time Slots' },
                { view: 'usermgmt:action-buttons', label: 'Action Buttons' },
                { view: 'usermgmt:dashboard-settings', label: 'Dashboard Settings' },
                { view: 'usermgmt:daily-log-import', label: 'Import Posts to Daily Logs' },
                { view: 'usermgmt:legacy-import', label: 'Legacy Mentorship Import' },
                ...(enableCertificates ? [{ view: 'usermgmt:certificate-settings' as View, label: 'Certificate Settings' }] : [])
            ]
        },
        { view: 'emailComposer', label: 'Email Composer', icon: HiOutlineEnvelope, requiresAuth: true, requiresEmailAccess: true },
        { view: 'foiaExport', label: 'FOIA Records Export', icon: HiOutlineDocumentArrowDown, requiresAuth: true, requiresFoiaAccess: true },
        { view: 'admin', label: 'Aquatic Pro', icon: HiOutlineShieldCheck, requiresAuth: true, adminOnly: true, highlighted: true },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (item.requiresAuth && !currentUser) return false;
        if (item.adminOnly && !isAdmin) return false;
        
        // Email Composer access requires admin OR canSendEmail permission
        if (item.requiresEmailAccess) {
            if (!isAdmin && !canSendEmail) return false;
        }
        
        // FOIA access requires admin OR canViewAllRecords permission, and module must be enabled
        if (item.requiresFoiaAccess) {
            if (!enableFOIA) return false;
            if (!isAdmin && !canViewAllRecords) return false;
        }
        
        // Hide Mentor Directory and My Mentorships when mentorship is disabled
        if (!enableMentorship) {
            if (item.view === 'directory' || item.view === 'myMentees' || item.view === 'admin') {
                return false;
            }
        }
        
        // Hide Daily Logs when the module is disabled
        if (!enableDailyLogs && item.view === 'dailyLogs') {
            return false;
        }
        
        // Hide Career Development when the module is disabled
        if (!enableProfessionalGrowth && item.view === 'careerDevelopment') {
            return false;
        }
        
        // Hide Reports when the module is disabled
        if (!enableReports && item.view === 'reports') {
            return false;
        }
        
        // Hide TaskDeck when the module is disabled
        if (!enableTaskDeck && item.view === 'taskdeck') {
            return false;
        }
        
        // Hide Awesome Awards when the module is disabled
        if (!enableAwesomeAwards && item.view === 'awards') {
            return false;
        }
        
        // Hide Lessons when the module is disabled
        if (!enableLessonManagement && item.view === 'lessons') {
            return false;
        }
        
        // Hide Learning (LMS) when the module is disabled
        if (!enableLMS && item.view === 'learning') {
            return false;
        }
        
        // Hide Certificates when the module is disabled
        if (!enableCertificates && item.view === 'certificates') {
            return false;
        }
        
        // Hide Mileage when the module is disabled
        if (!enableMileage && item.view === 'mileage') {
            return false;
        }
        
        // Hide Seasonal Returns when the module is disabled
        if (!enableSeasonalReturns && item.view === 'seasonalReturns') {
            return false;
        }
        
        return true;
    });

    // Auto-expand parent section when viewing a parent or subview
    useEffect(() => {
        if (currentView === 'dailyLogs' || currentView.startsWith('dailyLogs:')) {
            setExpandedSections(prev => new Set(prev).add('dailyLogs'));
        }
        if (currentView === 'careerDevelopment' || currentView.startsWith('career:')) {
            setExpandedSections(prev => new Set(prev).add('careerDevelopment'));
        }
        if (currentView === 'userManagement' || currentView.startsWith('usermgmt:')) {
            setExpandedSections(prev => new Set(prev).add('userManagement'));
        }
        if (currentView === 'lessons' || currentView.startsWith('lessons:')) {
            setExpandedSections(prev => new Set(prev).add('lessons'));
        }
        if (currentView === 'awards' || currentView.startsWith('awards:')) {
            setExpandedSections(prev => new Set(prev).add('awards'));
        }
        if (currentView === 'seasonalReturns' || currentView.startsWith('seasonalReturns:')) {
            setExpandedSections(prev => new Set(prev).add('seasonalReturns'));
        }
        if (currentView === 'learning' || currentView.startsWith('learning:')) {
            setExpandedSections(prev => new Set(prev).add('learning'));
        }
    }, [currentView]);

    const handleNavClick = (view: View) => {
        onNavigate(view);
        setIsOpen(false); // Close mobile menu after navigation
    };

    const toggleSection = (view: View) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(view)) {
                next.delete(view);
            } else {
                next.add(view);
            }
            return next;
        });
    };

    return (
        <>
            {/* Mobile Hamburger Button - Sticky with inline styles for WordPress compatibility */}
            <Button
                variant="unstyled"
                size="xs"
                onClick={() => setIsOpen(!isOpen)}
                className="md:ap-hidden ap-flex ap-items-center ap-justify-center !ap-p-2.5 !ap-min-h-0"
                style={{
                    position: 'fixed',
                    top: '16px',
                    left: '16px',
                    zIndex: 999998,
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
                aria-label="Toggle menu"
            >
                {isOpen ? (
                    <HiOutlineXMark className="ap-h-6 ap-w-6 ap-text-gray-700" />
                ) : (
                    <HiOutlineBars3 className="ap-h-6 ap-w-6 ap-text-gray-700" />
                )}
            </Button>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-z-30 md:ap-hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`ap-fixed ap-top-0 ap-left-0 ap-h-full ap-z-40 ap-bg-white ap-shadow-xl ap-transition-all ap-duration-300 ap-ease-in-out ${isOpen ? 'ap-translate-x-0' : '-ap-translate-x-full'} md:ap-translate-x-0 ${isCollapsed ? 'md:ap-w-16' : 'md:ap-w-64'} ap-w-64`}
            >
                {/* Desktop Collapse Toggle Button */}
                <Button
                    variant="unstyled"
                    size="xs"
                    onClick={() => onCollapsedChange?.(!isCollapsed)}
                    className="ap-hidden md:ap-flex ap-absolute -ap-right-3 ap-top-20 ap-z-50 !ap-w-6 !ap-h-6 !ap-min-h-0 !ap-p-0 ap-items-center ap-justify-center ap-bg-white ap-border ap-border-gray-200 !ap-rounded-full ap-shadow-md hover:ap-bg-gray-50"
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? (
                        <HiOutlineChevronRight className="ap-w-4 ap-h-4 ap-text-gray-600" />
                    ) : (
                        <HiOutlineChevronLeft className="ap-w-4 ap-h-4 ap-text-gray-600" />
                    )}
                </Button>

                {/* Logo/Brand - Clickable to go to Dashboard */}
                <Button 
                    variant="unstyled"
                    onClick={() => {
                        handleNavClick('homeDashboard');
                        setIsOpen(false);
                    }}
                    className={`!ap-w-full ap-flex ap-items-center ap-gap-3 !ap-rounded-none ${isCollapsed ? 'md:ap-p-4 md:ap-justify-center !ap-p-6' : '!ap-p-6'}`}
                    style={{
                        background: 'linear-gradient(to right, rgba(37, 99, 235, 0.05), rgba(219, 39, 119, 0.05))',
                        borderBottom: '1px solid #e5e7eb',
                    }}
                >
                    <HiOutlineSparkles className="ap-h-8 ap-w-8 ap-flex-shrink-0" style={{ color: '#2563eb' }} />
                    <span 
                        className={`ap-text-xl ap-font-bold ${isCollapsed ? 'md:ap-hidden' : ''}`}
                        style={{
                            background: 'linear-gradient(to right, #2563eb, #db2777)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        AquaticPro
                    </span>
                </Button>

                {/* User Profile Section with Dropdown */}
                {currentUser && (
                    <div className={`ap-relative ap-border-b ap-border-gray-200 ${isCollapsed ? 'md:ap-p-2' : 'ap-p-4'}`}>
                        <Button
                            variant="nav"
                            size="sm"
                            onClick={() => !isCollapsed && setShowProfileMenu(!showProfileMenu)}
                            className={`${isCollapsed ? 'md:!ap-p-1 md:ap-justify-center' : ''}`}
                            title={isCollapsed ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}
                        >
                            <div className="ap-relative ap-flex-shrink-0">
                                <img
                                    src={currentUser.avatarUrl}
                                    alt={currentUser.firstName}
                                    className={`ap-rounded-full ap-object-cover ${isCollapsed ? 'md:ap-h-8 md:ap-w-8 ap-h-10 ap-w-10' : 'ap-h-10 ap-w-10'}`}
                                />
                            </div>
                            <div className={`ap-flex-1 ap-min-w-0 ap-text-left ${isCollapsed ? 'md:ap-hidden' : ''}`}>
                                <p className="ap-text-sm ap-font-medium ap-text-gray-800 ap-truncate">
                                    {currentUser.firstName} {currentUser.lastName}
                                </p>
                                <p className="ap-text-xs ap-text-gray-500 ap-truncate">
                                    {currentUser.tagline || 'User'}
                                </p>
                            </div>
                            <HiOutlineChevronDown className={`ap-h-4 ap-w-4 ap-text-gray-500 ap-transition-transform ${isCollapsed ? 'md:ap-hidden' : ''} ${showProfileMenu ? 'ap-rotate-180' : ''}`} />
                        </Button>
                        
                        {/* Reaction Stats - Show below profile */}
                        {reactionStats && reactionStats.total > 0 && !isCollapsed && (
                            <div className="ap-mt-2 ap-flex ap-items-center ap-justify-center ap-gap-3 ap-text-xs">
                                <span className="ap-flex ap-items-center ap-gap-1 ap-text-blue-600" title="Thumbs up received">
                                    <HiOutlineHandThumbUp className="ap-h-3.5 ap-w-3.5" />
                                    <span className="ap-font-medium">{reactionStats.thumbs_up}</span>
                                </span>
                                <span className="ap-flex ap-items-center ap-gap-1 ap-text-red-500" title="Thumbs down received">
                                    <HiOutlineHandThumbDown className="ap-h-3.5 ap-w-3.5" />
                                    <span className="ap-font-medium">{reactionStats.thumbs_down}</span>
                                </span>
                                <span className="ap-flex ap-items-center ap-gap-1 ap-text-pink-500" title="Hearts received">
                                    <HiOutlineHeart className="ap-h-3.5 ap-w-3.5" />
                                    <span className="ap-font-medium">{reactionStats.heart}</span>
                                </span>
                            </div>
                        )}

                        {/* Profile Dropdown Menu */}
                        {showProfileMenu && !isCollapsed && (
                            <div className="ap-absolute ap-left-4 ap-right-4 ap-top-full ap-mt-2 ap-bg-white ap-rounded-lg ap-shadow-lg ap-border ap-border-gray-200 ap-py-1 ap-z-50">
                                <Button
                                    variant={currentView === 'myProfile' ? 'nav-profile-active' : 'nav-profile'}
                                    onClick={() => {
                                        handleNavClick('myProfile');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <HiOutlineUser className="ap-h-4 ap-w-4" />
                                    <span>My Profile</span>
                                </Button>
                                <Button
                                    variant={currentView === 'settings' ? 'nav-profile-active' : 'nav-profile'}
                                    onClick={() => {
                                        handleNavClick('settings');
                                        setShowProfileMenu(false);
                                    }}
                                >
                                    <HiOutlineCog className="ap-h-4 ap-w-4" />
                                    <span>Settings</span>
                                </Button>
                                <div className="ap-border-t ap-border-gray-200 ap-my-1"></div>
                                <Button
                                    variant="nav-profile-danger"
                                    onClick={() => {
                                        setShowProfileMenu(false);
                                        // Use WordPress logout URL which redirects to the plugin's page
                                        const logoutUrl = window.mentorshipPlatformData?.logout_url;
                                        if (logoutUrl) {
                                            window.location.href = logoutUrl;
                                        } else {
                                            // Fallback: build logout URL with redirect to current page
                                            const currentUrl = window.mentorshipPlatformData?.currentUrl || window.location.href;
                                            window.location.href = `/wp-login.php?action=logout&redirect_to=${encodeURIComponent(currentUrl)}`;
                                        }
                                    }}
                                >
                                    <HiArrowRightOnRectangle className="ap-h-4 ap-w-4" />
                                    <span>Logout</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation Links */}
                <nav className={`ap-pb-32 ap-space-y-1 ap-overflow-y-auto ${isCollapsed ? 'md:ap-p-2 ap-p-4' : 'ap-p-4'}`} style={{ maxHeight: 'calc(100vh - 200px)' }}>
                    {filteredNavItems.map((item) => {
                        const Icon = item.icon;
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isParentActive = currentView === item.view || (hasSubItems && item.subItems!.some(sub => currentView === sub.view));
                        const isExpanded = expandedSections.has(item.view);
                        
                        return (
                            <div key={item.view}>
                                {/* Main nav item */}
                                <Button
                                    variant={isParentActive && !hasSubItems ? 'nav-active' : item.highlighted ? 'nav-highlighted' : 'nav'}
                                    onClick={() => {
                                        // On mobile (when sidebar is open), always allow toggling submenus
                                        // On desktop, only toggle when not collapsed
                                        const isMobileView = window.innerWidth < 768;
                                        if (hasSubItems && (!isCollapsed || isMobileView)) {
                                            toggleSection(item.view);
                                        } else if (hasSubItems && isCollapsed) {
                                            // On collapsed desktop, clicking parent with subitems goes to first subitem
                                            handleNavClick(item.subItems![0].view);
                                        } else {
                                            handleNavClick(item.view);
                                        }
                                    }}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`!ap-w-full ap-flex ap-items-center ${isCollapsed ? 'md:ap-p-2 md:ap-justify-center ap-gap-2' : 'ap-gap-2'}`}
                                >
                                    <Icon className="ap-h-4 ap-w-4 ap-flex-shrink-0" />
                                    <span className={`ap-text-sm ap-flex-1 ap-text-left ${isCollapsed ? 'md:ap-hidden' : ''}`}>{item.label}</span>
                                    {hasSubItems && (
                                        <span className={isCollapsed ? 'md:hidden' : ''}>
                                            {isExpanded ? (
                                                <HiOutlineChevronDown className="ap-h-4 ap-w-4 ap-flex-shrink-0" />
                                            ) : (
                                                <HiOutlineChevronRight className="ap-h-4 ap-w-4 ap-flex-shrink-0" />
                                            )}
                                        </span>
                                    )}
                                </Button>

                                {/* Sub-menu items - hidden when collapsed on desktop only */}
                                {hasSubItems && isExpanded && (
                                    <div className={`ap-ml-8 ap-mt-1 ap-space-y-1 ${isCollapsed ? 'md:ap-hidden' : ''}`}>
                                        {item.subItems!.map((subItem, index) => {
                                            const isSubActive = currentView === subItem.view;
                                            return (
                                                <Button
                                                    variant={isSubActive ? 'nav-sub-active' : 'nav-sub'}
                                                    key={`${item.view}-${index}`}
                                                    onClick={() => handleNavClick(subItem.view)}
                                                    className="!ap-w-full ap-text-left !ap-justify-start"
                                                >
                                                    {subItem.label}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;