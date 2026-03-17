import React from 'react';

interface ToggleSwitchProps {
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, enabled, onChange, description }) => {
    return (
        <div className="ap-flex ap-items-start ap-justify-between ap-gap-4 ap-py-3">
            <div className="ap-flex-1 ap-min-w-0">
                <span className="ap-text-sm ap-font-medium ap-text-gray-900">{label}</span>
                {description && <p className="ap-text-sm ap-text-gray-500 ap-mt-1">{description}</p>}
            </div>
            <label className="ap-relative ap-inline-block ap-w-11 ap-h-6 ap-flex-shrink-0 ap-cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked)}
                    className="ap-absolute ap-opacity-0 ap-w-0 ap-h-0"
                />
                <span className={`ap-block ap-w-11 ap-h-6 ap-rounded-full ap-transition-colors ap-duration-200 ap-relative ${enabled ? 'ap-bg-blue-600' : 'ap-bg-gray-300'}`}>
                    <span className={`ap-absolute ap-top-0.5 ap-left-0.5 ap-w-5 ap-h-5 ap-bg-white ap-rounded-full ap-shadow-sm ap-transition-transform ap-duration-200 ${enabled ? 'ap-translate-x-5' : 'ap-translate-x-0'}`}></span>
                </span>
            </label>
        </div>
    );
};

export default ToggleSwitch;