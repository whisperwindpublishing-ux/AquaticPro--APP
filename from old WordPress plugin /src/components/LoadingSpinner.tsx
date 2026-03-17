
import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'ap-w-6 ap-h-6 ap-border-2',
        md: 'ap-w-16 ap-h-16 ap-border-4',
        lg: 'ap-w-24 ap-h-24 ap-border-4'
    };
    
    return (
        <div className="ap-flex ap-items-center ap-justify-center">
            <div className={`${sizeClasses[size]} ap-border-blue-400 ap-border-t-transparent ap-rounded-full ap-animate-spin`}></div>
        </div>
    );
};

export default LoadingSpinner;
