import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { View } from '@/App';
import { Button } from './ui';
import ProfileDropdown from '@/components/ProfileDropdown';
import { HiOutlineSparkles as LogoIcon } from 'react-icons/hi2';
import { HiOutlineBars2 as Bars2Icon, HiOutlineXMark as XMarkIcon, HiOutlineChevronDown, HiOutlineUserCircle, HiOutlineCog6Tooth, HiArrowRightOnRectangle } from 'react-icons/hi2';

interface HeaderProps {
    currentUser: UserProfile | null;
    currentView: View;
    onNavigate: (view: View) => void;
    isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ currentUser, currentView, onNavigate, isAdmin }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileProfileExpanded, setIsMobileProfileExpanded] = useState(false);

    const handleLogout = () => {
        const logoutUrl = window.mentorshipPlatformData?.logout_url;
        if (logoutUrl) {
            window.location.href = logoutUrl;
        } else {
            window.location.href = '/wp-login.php?action=logout';
        }
    };

    return (
        <header className="ap-bg-white ap-shadow-md">
            <div className="ap-container ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8">
                <div className="ap-flex ap-items-center ap-justify-between ap-h-16">
                    <div className="ap-flex ap-items-center ap-cursor-pointer" onClick={() => onNavigate('directory')}>
                        <LogoIcon className="ap-h-8 ap-w-8 ap-text-blue-600" />
                        <span className="ap-ml-2 ap-text-xl ap-font-semibold ap-text-gray-800">Mentorship Platform</span>
                    </div>
                    <nav className="ap-hidden md:ap-flex ap-items-center ap-space-x-8">
                        <a onClick={() => onNavigate('directory')} className={`ap-cursor-pointer nav-link ${currentView === 'directory' ? 'nav-link-active' : ''}`}>
                            Mentor Directory
                        </a>
                        {currentUser && (
                            <>
                                <a onClick={() => onNavigate('myMentees')} className={`ap-cursor-pointer nav-link ${currentView === 'myMentees' ? 'nav-link-active' : ''}`}>
                                    My Mentorships
                                </a>
                                <a onClick={() => onNavigate('dailyLogs')} className={`ap-cursor-pointer nav-link ${currentView === 'dailyLogs' ? 'nav-link-active' : ''}`}>
                                    Daily Logs
                                </a>
                                <a onClick={() => onNavigate('careerDevelopment')} className={`ap-cursor-pointer nav-link ${currentView === 'careerDevelopment' ? 'nav-link-active' : ''}`}>
                                    Career Development
                                </a>
                                <a onClick={() => onNavigate('reports')} className={`ap-cursor-pointer nav-link ${currentView === 'reports' ? 'nav-link-active' : ''}`}>
                                    Reports
                                </a>
                            </>
                        )}
                        {isAdmin &&
                            currentUser && (
                                <>
                                    <a
                                        onClick={() => onNavigate('userManagement')}
                                        className={`ap-cursor-pointer nav-link ${currentView === 'userManagement' ? 'nav-link-active' : ''}`}>
                                        User Management
                                    </a>
                                    <a
                                        onClick={() => onNavigate('admin')}
                                        className={`ap-cursor-pointer nav-link ap-text-yellow-500 ap-font-bold ${currentView === 'admin' ? 'nav-link-active' : ''}`}>
                                        Admin
                                    </a>
                                </>
                        )}
                    </nav>
                    <div className="ap-flex ap-items-center">
                        {currentUser && <ProfileDropdown user={currentUser} onNavigate={onNavigate} />}
                        <div className="md:ap-hidden ap-ml-4">
                            <Button 
                                variant="ghost"
                                size="xs"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="!ap-p-2 !ap-min-h-0 ap-text-gray-700 hover:ap-text-gray-900"
                                aria-expanded={isMobileMenuOpen}
                            >
                                <span className="ap-sr-only">Open main menu</span>
                                {isMobileMenuOpen ? (
                                    <XMarkIcon className="ap-block ap-h-6 ap-w-6" aria-hidden="true" />
                                ) : (
                                    <Bars2Icon className="ap-block ap-h-6 ap-w-6" aria-hidden="true" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:ap-hidden ap-bg-white ap-border-t ap-border-gray-200">
                    <div className="ap-px-2 ap-pt-2 ap-pb-3 ap-space-y-1 sm:ap-px-3">
                        {/* User Profile Section (if logged in) */}
                        {currentUser && (
                            <div className="ap-border-b ap-border-gray-200 ap-mb-2">
                                <Button 
                                    variant="ghost"
                                    onClick={() => setIsMobileProfileExpanded(!isMobileProfileExpanded)}
                                    className="!ap-w-full !ap-px-3 !ap-py-3 !ap-h-auto ap-flex ap-items-center ap-justify-between hover:ap-bg-gray-50"
                                >
                                    <div className="ap-flex ap-items-center">
                                        <img className="ap-h-10 ap-w-10 ap-rounded-full ap-object-cover" src={currentUser.avatarUrl} alt={currentUser.firstName} />
                                        <div className="ap-ml-3 ap-text-left">
                                            <p className="ap-text-base ap-font-medium ap-text-gray-800">{currentUser.firstName} {currentUser.lastName}</p>
                                            <p className="ap-text-sm ap-text-gray-500">{currentUser.tagline}</p>
                                        </div>
                                    </div>
                                    <HiOutlineChevronDown className={`ap-h-5 ap-w-5 ap-text-gray-500 ap-transition-transform ap-duration-200 ${isMobileProfileExpanded ? 'ap-rotate-180' : ''}`} />
                                </Button>
                                {/* Profile Dropdown Options */}
                                {isMobileProfileExpanded && (
                                    <div className="ap-px-3 ap-pb-3 ap-space-y-1">
                                        <a 
                                            onClick={() => { onNavigate('myProfile'); setIsMobileMenuOpen(false); setIsMobileProfileExpanded(false); }} 
                                            className="ap-flex ap-items-center ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-text-gray-700 hover:ap-bg-blue-50 hover:ap-text-blue-600 ap-cursor-pointer ap-transition-colors"
                                        >
                                            <HiOutlineUserCircle className="ap-h-5 ap-w-5 ap-mr-3" />
                                            My Profile
                                        </a>
                                        <a 
                                            onClick={() => { onNavigate('settings'); setIsMobileMenuOpen(false); setIsMobileProfileExpanded(false); }} 
                                            className="ap-flex ap-items-center ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-text-gray-700 hover:ap-bg-blue-50 hover:ap-text-blue-600 ap-cursor-pointer ap-transition-colors"
                                        >
                                            <HiOutlineCog6Tooth className="ap-h-5 ap-w-5 ap-mr-3" />
                                            Settings
                                        </a>
                                        <a 
                                            onClick={handleLogout} 
                                            className="ap-flex ap-items-center ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-text-red-600 hover:ap-bg-red-50 ap-cursor-pointer ap-transition-colors"
                                        >
                                            <HiArrowRightOnRectangle className="ap-h-5 ap-w-5 ap-mr-3" />
                                            Logout
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Navigation Links */}
                        <a onClick={() => { onNavigate('directory'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer ap-border-2 ap-border-black ap-transition-all ap-duration-150 ap-ease-out ${currentView === 'directory' ? 'ap-bg-blue-50 ap-text-blue-600 ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'ap-text-gray-700 ap-bg-purple-100 hover:ap-bg-blue-50 hover:-ap-translate-x-0.5 hover:-ap-translate-y-0.5 hover:ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]'} active:ap-translate-x-0 active:ap-translate-y-0 active:ap-shadow-none`}>
                            Mentor Directory
                        </a>
                        {currentUser && (
                            <>
                                <a onClick={() => { onNavigate('myMentees'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer ap-border-2 ap-border-black ap-transition-all ap-duration-150 ap-ease-out ${currentView === 'myMentees' ? 'ap-bg-blue-50 ap-text-blue-600 ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'ap-text-gray-700 ap-bg-purple-100 hover:ap-bg-blue-50 hover:-ap-translate-x-0.5 hover:-ap-translate-y-0.5 hover:ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]'} active:ap-translate-x-0 active:ap-translate-y-0 active:ap-shadow-none`}>
                                    My Mentorships
                                </a>
                                <a onClick={() => { onNavigate('dailyLogs'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer ap-border-2 ap-border-black ap-transition-all ap-duration-150 ap-ease-out ${currentView === 'dailyLogs' ? 'ap-bg-blue-50 ap-text-blue-600 ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'ap-text-gray-700 ap-bg-purple-100 hover:ap-bg-blue-50 hover:-ap-translate-x-0.5 hover:-ap-translate-y-0.5 hover:ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]'} active:ap-translate-x-0 active:ap-translate-y-0 active:ap-shadow-none`}>
                                    Daily Logs
                                </a>
                                <a onClick={() => { onNavigate('careerDevelopment'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer ap-border-2 ap-border-black ap-transition-all ap-duration-150 ap-ease-out ${currentView === 'careerDevelopment' ? 'ap-bg-blue-50 ap-text-blue-600 ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'ap-text-gray-700 ap-bg-purple-100 hover:ap-bg-blue-50 hover:-ap-translate-x-0.5 hover:-ap-translate-y-0.5 hover:ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]'} active:ap-translate-x-0 active:ap-translate-y-0 active:ap-shadow-none`}>
                                    Career Development
                                </a>
                                <a onClick={() => { onNavigate('reports'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer ap-border-2 ap-border-black ap-transition-all ap-duration-150 ap-ease-out ${currentView === 'reports' ? 'ap-bg-blue-50 ap-text-blue-600 ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'ap-text-gray-700 ap-bg-purple-100 hover:ap-bg-blue-50 hover:-ap-translate-x-0.5 hover:-ap-translate-y-0.5 hover:ap-shadow-[2px_2px_0_0_rgba(0,0,0,1)]'} active:ap-translate-x-0 active:ap-translate-y-0 active:ap-shadow-none`}>
                                    Reports
                                </a>
                            </>
                        )}
                        {isAdmin && currentUser && (
                            <>
                                <a onClick={() => { onNavigate('userManagement'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer hover:ap-bg-gray-100 ${currentView === 'userManagement' ? 'ap-bg-gray-100 ap-text-blue-600' : 'ap-text-gray-700'}`}>
                                    User Management
                                </a>
                                <a onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }} className={`ap-block ap-px-3 ap-py-2 ap-rounded-md ap-text-base ap-font-medium ap-cursor-pointer hover:ap-bg-gray-100 ${currentView === 'admin' ? 'ap-bg-gray-100 ap-text-yellow-500' : 'ap-text-yellow-500'}`}>
                                    Admin
                                </a>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;