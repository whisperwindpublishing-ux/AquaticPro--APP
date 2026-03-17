import React from 'react';
import { UserProfile } from '@/types';

interface UserCardProps {
    user: UserProfile;
    onSelect: (user: UserProfile) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => {
    return (
        <div 
            className="ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6 ap-cursor-pointer hover:ap-shadow-xl hover:-ap-translate-y-1 ap-transition-all ap-duration-300 ap-flex ap-flex-col ap-h-full"
            onClick={() => onSelect(user)}
        >
            <div className="ap-flex ap-items-center ap-mb-4">
                <img className="ap-h-16 ap-w-16 ap-rounded-full ap-object-cover ap-flex-shrink-0" src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
                <div className="ap-ml-4 ap-min-w-0 ap-flex-1">
                    <h3 className="ap-text-lg ap-font-bold ap-text-gray-900 ap-break-words">{user.firstName} {user.lastName}</h3>
                    <p className="ap-text-sm ap-text-gray-600 ap-break-words">{user.tagline}</p>
                </div>
            </div>
            
            {/* Bio Section - Limited height */}
            {user.bioDetails && (
                <div className="ap-flex-grow">
                    <div className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700 ap-break-words line-clamp-4" dangerouslySetInnerHTML={{
                        __html: user.bioDetails || '',
                    }} />
                </div>
            )}
        </div>
    );
};

export default UserCard;