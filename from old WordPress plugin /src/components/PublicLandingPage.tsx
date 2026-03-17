import React, { useState } from 'react';
import { HiOutlineSparkles, HiOutlineUsers, HiArrowLeft, HiOutlineClipboardDocumentList, HiArrowRight } from 'react-icons/hi2';
import { Button } from './ui';
import LoginForm from './LoginForm';
import PortfolioDirectory from './PortfolioDirectory';
import PortfolioPage from './PortfolioPage';
import MentorProfile from './MentorProfile';
import { UserProfile } from '@/types';

interface PublicButton {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface PublicLandingPageProps {
    onLoginSuccess?: () => void;
    onEnterGuestMode?: () => void;
}

type PublicView = 'landing' | 'portfolios' | 'portfolio-detail' | 'mentor-profile';

const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onEnterGuestMode }) => {
    const [currentPublicView, setCurrentPublicView] = useState<PublicView>('landing');
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    
    // Public navigation buttons - can be configured
    const publicButtons: PublicButton[] = [
        {
            id: 'portfolios',
            label: 'Mentorship Profiles',
            description: 'View public goals and achievements',
            icon: <HiOutlineUsers className="ap-w-8 ap-h-8" />,
        },
        {
            id: 'camp-rosters',
            label: 'Camp Rosters',
            description: 'View swim lesson schedules',
            icon: <HiOutlineClipboardDocumentList className="ap-w-8 ap-h-8" />,
        },
    ];

    const handlePublicButtonClick = (buttonId: string) => {
        switch (buttonId) {
            case 'portfolios':
                setCurrentPublicView('portfolios');
                break;
            case 'camp-rosters':
                // Navigate to camp rosters page
                window.location.href = window.location.origin + window.location.pathname.replace(/\/$/, '') + '?camp_rosters';
                break;
            default:
                break;
        }
    };

    const handleSelectUser = (user: UserProfile) => {
        setSelectedUser(user);
        setCurrentPublicView('portfolio-detail');
    };

    const handleViewMentorProfile = (user: UserProfile) => {
        setSelectedUser(user);
        setCurrentPublicView('mentor-profile');
    };

    const handleBackToLanding = () => {
        setCurrentPublicView('landing');
        setSelectedUser(null);
    };

    const handleBackToPortfolios = () => {
        setCurrentPublicView('portfolios');
        setSelectedUser(null);
    };

    // Render portfolio detail view
    if (currentPublicView === 'portfolio-detail' && selectedUser) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-gray-50 ap-via-white ap-to-blue-50">
                {/* Header with back button and logo */}
                <header className="ap-bg-white ap-shadow-sm ap-border-b ap-border-gray-200">
                    <div className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-4">
                        <div className="ap-flex ap-items-center ap-justify-between">
                            <Button
                                variant="link"
                                onClick={handleBackToPortfolios}
                                className="!ap-text-gray-600 hover:!ap-text-blue-600"
                            >
                                <HiArrowLeft className="ap-w-5 ap-h-5" />
                                <span>Back to Profiles</span>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleBackToLanding}
                                className="!ap-gap-2"
                            >
                                <HiOutlineSparkles className="ap-h-8 ap-w-8 ap-text-blue-600" />
                                <span className="ap-text-xl ap-font-bold ap-text-gray-900">
                                    AquaticPro
                                </span>
                            </Button>
                        </div>
                    </div>
                </header>
                <main className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-8">
                    <PortfolioPage 
                        user={selectedUser} 
                        onBack={handleBackToPortfolios} 
                        currentUser={null} 
                    />
                </main>
            </div>
        );
    }

    // Render mentor profile view
    if (currentPublicView === 'mentor-profile' && selectedUser) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-gray-50 ap-via-white ap-to-blue-50">
                <header className="ap-bg-white ap-shadow-sm ap-border-b ap-border-gray-200">
                    <div className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-4">
                        <div className="ap-flex ap-items-center ap-justify-between">
                            <Button
                                variant="link"
                                onClick={handleBackToPortfolios}
                                className="!ap-text-gray-600 hover:!ap-text-blue-600"
                            >
                                <HiArrowLeft className="ap-w-5 ap-h-5" />
                                <span>Back</span>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleBackToLanding}
                                className="!ap-gap-2"
                            >
                                <HiOutlineSparkles className="ap-h-8 ap-w-8 ap-text-blue-600" />
                                <span className="ap-text-xl ap-font-bold ap-text-gray-900">
                                    AquaticPro
                                </span>
                            </Button>
                        </div>
                    </div>
                </header>
                <main className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-8">
                    <MentorProfile 
                        mentor={selectedUser} 
                        onBack={handleBackToPortfolios} 
                        isPublicView={true} 
                        currentUser={null} 
                        onViewPortfolio={handleViewMentorProfile}
                    />
                </main>
            </div>
        );
    }

    // Render portfolios directory view
    if (currentPublicView === 'portfolios') {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-gray-50 ap-via-white ap-to-blue-50">
                {/* Header with back button and logo */}
                <header className="ap-bg-white ap-shadow-sm ap-border-b ap-border-gray-200">
                    <div className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-4">
                        <div className="ap-flex ap-items-center ap-justify-between">
                            <Button
                                variant="link"
                                onClick={handleBackToLanding}
                                className="!ap-text-gray-600 hover:!ap-text-blue-600"
                            >
                                <HiArrowLeft className="ap-w-5 ap-h-5" />
                                <span>Back to Home</span>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleBackToLanding}
                                className="!ap-gap-2"
                            >
                                <HiOutlineSparkles className="ap-h-8 ap-w-8 ap-text-blue-600" />
                                <span className="ap-text-xl ap-font-bold ap-text-gray-900">
                                    AquaticPro
                                </span>
                            </Button>
                        </div>
                    </div>
                </header>
                <main className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-8">
                    <PortfolioDirectory onSelectUser={handleSelectUser} />
                </main>
            </div>
        );
    }

    // Main landing page with buttons and login form
    return (
        <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-gray-50 ap-via-white ap-to-blue-50">
            {/* Header */}
            <header className="ap-bg-white ap-shadow-sm ap-border-b ap-border-gray-200">
                <div className="ap-max-w-7xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-4">
                    <div className="ap-flex ap-items-center ap-justify-center">
                        <div className="ap-flex ap-items-center ap-gap-3">
                            <HiOutlineSparkles className="ap-h-10 ap-w-10 ap-text-blue-600" />
                            <span className="ap-text-2xl ap-font-bold ap-text-gray-900">
                                AquaticPro
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="ap-max-w-4xl ap-mx-auto ap-px-4 sm:ap-px-6 lg:ap-px-8 ap-py-12">
                {/* Welcome Section */}
                <div className="ap-text-center ap-mb-12">
                    <h1 className="ap-text-4xl ap-font-bold ap-text-gray-900 ap-mb-4">
                        Welcome to AquaticPro
                    </h1>
                </div>

                {/* Login Form Section */}
                <div className="ap-flex ap-justify-center ap-mb-12">
                    <LoginForm currentUrl={window.location.href} embedded={true} />
                </div>

                {/* Public Navigation Buttons */}
                {publicButtons.length > 0 && (
                    <div className="ap-mb-8">
                        <div className="ap-flex ap-flex-wrap ap-justify-center ap-gap-4">
                            {publicButtons.map((button) => (
                                <Button
                                    key={button.id}
                                    variant="outline"
                                    onClick={() => handlePublicButtonClick(button.id)}
                                    className="!ap-flex !ap-items-center !ap-gap-4 !ap-px-8 !ap-py-6 !ap-bg-white !ap-rounded-xl !ap-shadow-md !ap-border-gray-200 hover:!ap-shadow-lg hover:!ap-border-gray-300 !ap-transition-all !ap-min-w-[280px] !ap-h-auto"
                                >
                                    <div className="ap-p-3 ap-bg-blue-50 ap-rounded-lg ap-text-blue-600">
                                        {button.icon}
                                    </div>
                                    <div className="ap-text-left">
                                        <h3 className="ap-text-lg ap-font-bold ap-text-gray-900">{button.label}</h3>
                                        <p className="ap-text-sm ap-text-gray-600">{button.description}</p>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Visitor Mode Button */}
                <div className="ap-flex ap-justify-center ap-mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => onEnterGuestMode ? onEnterGuestMode() : setCurrentPublicView('portfolios')}
                        className="!ap-text-gray-500 hover:!ap-text-gray-700 !ap-font-medium"
                    >
                        <span>Enter Visitor Mode</span>
                        <HiArrowRight className="ap-w-4 ap-h-4 ap-ml-1" />
                    </Button>
                </div>

                <div className="ap-text-center">
                    <p className="ap-text-lg ap-text-gray-600 ap-max-w-2xl ap-mx-auto">
                        AquaticPro is the comprehensive staff management solution for aquatic professionals. Track Daily Logs, manage Mileage Reimbursement, oversee Lesson Management, and foster Professional Growth through Mentorship. Log in to access your dashboard or view public resources.
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="ap-bg-white ap-mt-auto ap-py-6 ap-text-center ap-text-sm ap-text-gray-500 ap-border-t ap-border-gray-200">
                <p>&copy; {new Date().getFullYear()} Swimming Ideas, LLC. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default PublicLandingPage;
