import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HiOutlineMapPin } from 'react-icons/hi2';

interface AddressSuggestion {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChange,
    placeholder = 'Enter address...',
    disabled = false,
    className = ''
}) => {
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced search function
    const searchAddresses = useCallback(async (query: string) => {
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        
        try {
            // Use Nominatim (OpenStreetMap) for free address lookup
            // Limit to US addresses for better results
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&` +
                `q=${encodeURIComponent(query)}&` +
                `countrycodes=us&` +
                `addressdetails=1&` +
                `limit=5`,
                {
                    headers: {
                        'Accept': 'application/json',
                        // Nominatim requires a User-Agent
                        'User-Agent': 'MentorshipPlatform/1.0'
                    }
                }
            );

            if (response.ok) {
                const data: AddressSuggestion[] = await response.json();
                setSuggestions(data);
                setIsOpen(data.length > 0);
            }
        } catch (error) {
            console.error('Address search failed:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Handle input change with debounce
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        setHighlightedIndex(-1);

        // Clear previous timeout
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce the search
        debounceRef.current = setTimeout(() => {
            searchAddresses(newValue);
        }, 300);
    };

    // Handle suggestion selection
    const selectSuggestion = (suggestion: AddressSuggestion) => {
        onChange(suggestion.display_name);
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => 
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                    selectSuggestion(suggestions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return (
        <div className="ap-relative">
            <div className="ap-relative">
                <HiOutlineMapPin className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 disabled:ap-bg-gray-100 ${className}`}
                    autoComplete="off"
                />
                {isLoading && (
                    <div className="ap-absolute ap-right-3 ap-top-1/2 -ap-translate-y-1/2">
                        <div className="ap-w-4 ap-h-4 ap-border-2 ap-border-blue-500 ap-border-t-transparent ap-rounded-full ap-animate-spin" />
                    </div>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div 
                    ref={dropdownRef}
                    className="ap-absolute ap-z-50 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-60 ap-overflow-y-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.place_id}
                            type="button"
                            onClick={() => selectSuggestion(suggestion)}
                            className={`ap-w-full ap-text-left ap-px-4 ap-py-3 ap-text-sm hover:ap-bg-blue-50 ap-flex ap-items-start ap-gap-3 ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                index === highlightedIndex ? 'ap-bg-blue-50' : ''
                            }`}
                        >
                            <HiOutlineMapPin className="ap-w-4 ap-h-4 ap-text-gray-400 ap-mt-0.5 ap-flex-shrink-0" />
                            <span className="ap-text-gray-700">{suggestion.display_name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* No results message */}
            {isOpen && !isLoading && suggestions.length === 0 && value.length >= 3 && (
                <div className="ap-absolute ap-z-50 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                    No addresses found. Try a more specific search.
                </div>
            )}
        </div>
    );
};

export default AddressAutocomplete;
