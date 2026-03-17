/**
 * Section Color Picker
 * 
 * Dropdown for selecting section theme color
 */
import React, { useState, useRef, useEffect } from 'react';
import { HiOutlinePaintBrush, HiCheck } from 'react-icons/hi2';
import { SectionColor, SECTION_COLOR_CONFIG } from './types';

interface ColorPickerProps {
    currentColor: SectionColor | null;
    onColorSelect: (color: SectionColor | null) => void;
}

const COLOR_OPTIONS: { value: SectionColor | null; label: string; class: string }[] = [
    { value: null, label: 'Default', class: 'bg-gray-200' },
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
    { value: 'green', label: 'Green', class: 'bg-emerald-500' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
    { value: 'red', label: 'Red', class: 'bg-red-500' },
    { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
    { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
];

const SectionColorPicker: React.FC<ColorPickerProps> = ({
    currentColor,
    onColorSelect
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentOption = COLOR_OPTIONS.find(o => o.value === currentColor) || COLOR_OPTIONS[0];

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
            >
                <HiOutlinePaintBrush className="w-4 h-4" />
                <span className="flex-1 text-left">Theme Color</span>
                <div className={`w-4 h-4 rounded-full ${currentOption.class}`} />
            </button>

            {isOpen && (
                <div className="absolute left-full top-0 ml-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                        Select Color
                    </div>
                    <div className="mt-1">
                        {COLOR_OPTIONS.map((option) => (
                            <button
                                key={option.value ?? 'default'}
                                onClick={() => {
                                    onColorSelect(option.value);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-sm"
                            >
                                <div className={`w-5 h-5 rounded-full ${option.class} flex items-center justify-center`}>
                                    {currentColor === option.value && (
                                        <HiCheck className="w-3 h-3 text-white" />
                                    )}
                                </div>
                                <span className="text-gray-700">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectionColorPicker;
