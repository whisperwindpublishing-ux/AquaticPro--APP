import React from 'react';
import { UserProfile } from '@/types';
import SkillBadge from '@/components/SkillBadge';

interface MentorCardProps {
    mentor: UserProfile;
    onSelect: (mentor: UserProfile) => void;
}

const MentorCard: React.FC<MentorCardProps> = ({ mentor, onSelect }) => {
    return (
        <div 
            className="ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6 ap-cursor-pointer hover:ap-shadow-xl hover:ap-shadow-purple-600/30 hover:-ap-translate-y-1 ap-border-l-4 ap-border-purple-600/30 hover:ap-border-purple-600 ap-transition-all ap-duration-300 ap-flex ap-flex-col ap-h-full"
            onClick={() => onSelect(mentor)}
        >
            <div className="ap-flex ap-items-center ap-mb-4">
                <img className="ap-h-16 ap-w-16 ap-rounded-full ap-object-cover ap-flex-shrink-0" src={mentor.avatarUrl} alt={`${mentor.firstName} ${mentor.lastName}`} />
                <div className="ap-ml-4 ap-min-w-0 ap-flex-1">
                    <h3 className="ap-text-lg ap-font-bold ap-text-gray-900 ap-break-words">{mentor.firstName} {mentor.lastName}</h3>
                    <p className="ap-text-sm ap-text-gray-600 ap-break-words">{mentor.tagline}</p>
                </div>
            </div>
            
            {/* Experience Section - Prioritized */}
            {mentor.experience && (
                <div className="ap-mb-3">
                    <h4 className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-mb-1">Experience</h4>
                    <div className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700 ap-break-words line-clamp-3" dangerouslySetInnerHTML={{
                        __html: mentor.experience || '',
                    }} />
                </div>
            )}
            
            {/* Bio Section - Limited height */}
            {mentor.bioDetails && (
                <div className="ap-mb-3 ap-flex-grow">
                    <h4 className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-mb-1">About</h4>
                    <div className="ap-prose ap-prose-sm ap-max-w-none ap-text-gray-700 ap-break-words line-clamp-2" dangerouslySetInnerHTML={{
                        __html: mentor.bioDetails || '',
                    }} />
                </div>
            )}
            
            {/* Skills Section - Prioritized */}
            <div className="ap-flex ap-flex-wrap ap-gap-2 ap-mt-auto">
                {mentor.skills.slice(0, 3).map(skill => <SkillBadge key={skill} skill={skill} />)}
                {mentor.skills.length > 3 && <span className="ap-text-xs ap-text-gray-500 ap-self-center">+{mentor.skills.length - 3} more</span>}
            </div>
        </div>
    );
};

export default MentorCard;