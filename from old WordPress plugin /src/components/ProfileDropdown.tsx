import React, { useState, useRef, useEffect } from 'react';
import { 
    HiOutlineUserCircle as UserCircleIcon,
    HiOutlineCog6Tooth as Cog6ToothIcon,
    HiArrowRightOnRectangle as LogoutIcon
} from 'react-icons/hi2';
import { Button } from './ui';
import { UserProfile } from '@/types';
import { View } from '@/App';

interface ProfileDropdownProps {
    user: UserProfile;
    onNavigate: (view: View) => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        // Use the logout URL provided by WordPress
        const logoutUrl = window.mentorshipPlatformData?.logout_url;
        if (logoutUrl) {
            window.location.href = logoutUrl;
        } else {
            // Fallback: redirect to wp-login.php logout
            window.location.href = '/wp-login.php?action=logout';
        }
    };

    return (
        <div className="ap-relative ap-z-[999999]" ref={dropdownRef}>
            <Button variant="ghost" size="xs" onClick={() => setIsOpen(!isOpen)} className="!ap-p-0 !ap-min-h-0 !ap-rounded-full hover:ap-opacity-80 ap-transition-opacity">
                <img className="ap-h-8 ap-w-8 ap-rounded-full ap-object-cover ap-border-2 ap-border-white ap-shadow-sm" src={user.avatarUrl} alt={user.firstName} />
            </Button>
            {isOpen && (
                <div role="menu" className="ap-origin-top-right ap-fixed ap-right-4 ap-mt-2 ap-w-48 ap-rounded-lg ap-shadow-2xl ap-bg-white ap-border-2 ap-border-gray-200 ap-z-[999999] ap-animate-fade-in-down" style={{position: 'fixed', zIndex: 999999, visibility: 'visible', opacity: 1, display: 'block'}}>
                    <div className="ap-py-1.5" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        <a onClick={() => { onNavigate('myProfile'); setIsOpen(false); }} className="ap-flex ap-items-center ap-px-4 ap-py-2.5 ap-text-sm ap-font-medium ap-text-gray-700 hover:ap-bg-blue-50 hover:ap-text-blue-600 ap-cursor-pointer ap-transition-colors" role="menuitem" style={{color: '#374151', textDecoration: 'none'}}><UserCircleIcon className="ap-h-5 ap-w-5 ap-mr-3" /> My Profile</a>
                        <a onClick={() => { onNavigate('settings'); setIsOpen(false); }} className="ap-flex ap-items-center ap-px-4 ap-py-2.5 ap-text-sm ap-font-medium ap-text-gray-700 hover:ap-bg-blue-50 hover:ap-text-blue-600 ap-cursor-pointer ap-transition-colors" role="menuitem" style={{color: '#374151', textDecoration: 'none'}}><Cog6ToothIcon className="ap-h-5 ap-w-5 ap-mr-3" /> Settings</a>
                        <div className="ap-border-t ap-border-gray-200 ap-my-1"></div>
                        <a onClick={handleLogout} className="ap-flex ap-items-center ap-px-4 ap-py-2.5 ap-text-sm ap-font-medium ap-text-red-600 hover:ap-bg-red-50 ap-cursor-pointer ap-transition-colors" role="menuitem" style={{color: '#dc2626', textDecoration: 'none'}}><LogoutIcon className="ap-h-5 ap-w-5 ap-mr-3" /> Logout</a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileDropdown;