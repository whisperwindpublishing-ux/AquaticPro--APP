import React from 'react';
import { HiOutlineStar as StarIcon } from 'react-icons/hi2';

interface SkillBadgeProps {
    skill: string;
}

const SkillBadge: React.FC<SkillBadgeProps> = ({ skill }) => {
    return <span className="ap-inline-flex ap-items-center ap-px-2.5 ap-py-0.5 ap-rounded-full ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-800"><StarIcon className="ap-h-3 ap-w-3 ap-mr-1" /> {skill}</span>;
};

export default SkillBadge;