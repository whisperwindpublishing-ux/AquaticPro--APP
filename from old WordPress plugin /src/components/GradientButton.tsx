import React from 'react';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outlined';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

const GradientButton: React.FC<GradientButtonProps> = ({
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    disabled,
    ...props
}) => {
    // Ensure proper centering and consistent sizing
    const baseStyles = 'ap-inline-flex ap-items-center ap-justify-center ap-font-semibold ap-rounded-lg ap-transition-all ap-duration-200 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-offset-2 focus:ap-ring-blue-500 ap-min-h-[44px]';
    
    const sizeStyles = {
        sm: 'ap-px-3 ap-py-2 ap-text-sm ap-gap-2',
        md: 'ap-px-4 ap-py-2.5 ap-text-sm ap-gap-2',
        lg: 'ap-px-6 ap-py-3 ap-text-base ap-gap-2.5',
    };
    
    const variantStyles = {
        primary: disabled
            ? 'ap-bg-gray-300 ap-text-gray-500 ap-cursor-not-allowed' : 'ap-bg-blue-500 ap-text-white hover:ap-bg-blue-600 hover:ap-shadow-lg active:ap-scale-95',
        secondary: disabled
            ? 'ap-bg-gray-200 ap-text-gray-400 ap-cursor-not-allowed' : 'ap-bg-gray-200 ap-text-gray-700 ap-border-2 ap-border-gray-300 hover:ap-bg-gray-300 hover:ap-border-gray-400 active:ap-scale-95',
        outlined: disabled
            ? 'ap-border-2 ap-border-gray-300 ap-bg-transparent ap-text-gray-400 ap-cursor-not-allowed' : 'ap-border-2 ap-border-blue-500 ap-bg-white ap-text-blue-500 hover:ap-bg-blue-500 hover:ap-text-white active:ap-scale-95',
    };
    
    if (variant === 'outlined' && !disabled) {
        return (
            <button
                className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
                disabled={disabled}
                {...props}
            >
                {children}
            </button>
        );
    }
    
    return (
        <button
            className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
};

export default GradientButton;
