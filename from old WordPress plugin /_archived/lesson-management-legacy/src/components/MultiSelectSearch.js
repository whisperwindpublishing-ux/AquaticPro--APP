/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef } from 'react';

const decodeEntities = (str) => {
    if (typeof str !== 'string') return str;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
};

const getObjectProperty = (obj, path) => {
    if (typeof path !== 'string') return obj[path];
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const MultiSelect = ({
    options,
    selectedValues,
    onChange,
    label,
    placeholder,
    itemLabelKey = 'name',
    itemValueKey = 'id',
    multiple = true,
    renderOptionLabel,
    onSearchChange, // New prop for async search
    isLoading = false, // New prop for loading state
    selectedItems = [],
    onLoadMore, // New prop for lazy loading
    hasMore = false, // New prop to indicate if there are more items
    disabled = false, // New prop for disabled state
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const listRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, [wrapperRef]);

    // Trigger initial load when dropdown opens
    useEffect(() => {
        if (isOpen && onSearchChange && options.length === 0) {
            onSearchChange(''); // Trigger with empty string to load initial options
        }
    }, [isOpen, onSearchChange]);

    // Debounce search input
    useEffect(() => {
        if (onSearchChange && searchTerm !== '') {
            const handler = setTimeout(() => {
                onSearchChange(searchTerm);
            }, 300); // 300ms debounce
            return () => clearTimeout(handler);
        }
    }, [searchTerm, onSearchChange]);

    // Handle scroll for lazy loading
    const handleScroll = (e) => {
        if (!onLoadMore || !hasMore || isLoading) return;
        
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // Load more when scrolled to bottom (with 10px buffer)
        if (scrollHeight - scrollTop <= clientHeight + 10) {
            onLoadMore();
        }
    };

    const handleSelect = (value) => {
        if (multiple) {
            const newValues = selectedValues.includes(String(value))
                ? selectedValues.filter(v => v !== String(value))
                : [...selectedValues, String(value)];
            onChange(newValues);
        } else {
            onChange(selectedValues.includes(String(value)) ? [] : [String(value)]);
            setIsOpen(false);
        }
    };

    // If not async, filter options locally
    const filteredOptions = onSearchChange
        ? options
        : options.filter(option =>
            decodeEntities(getObjectProperty(option, itemLabelKey) || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <div className="relative">
                <button 
                    type="button" 
                    onClick={() => !disabled && setIsOpen(!isOpen)} 
                    disabled={disabled}
                    className="relative w-full cursor-default rounded-md border border-slate-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm min-h-[2.5rem] flex items-center disabled:bg-slate-100 disabled:cursor-not-allowed">
                    <span className="flex flex-wrap gap-2">
                        {selectedItems.length > 0 && multiple ? (
                            selectedItems.map(option => (
                                <span key={option[itemValueKey]} className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                                    {decodeEntities(getObjectProperty(option, itemLabelKey))}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleSelect(option[itemValueKey]); }} className="h-3.5 w-3.5 rounded-sm text-indigo-500 hover:bg-indigo-200">×</button>
                                </span>
                            ))
                        ) : selectedItems.length > 0 && !multiple ? (
                            <span className="block truncate">{decodeEntities(getObjectProperty(selectedItems[0], itemLabelKey))}</span>
                        ) : (
                            <span className="text-slate-400">{placeholder || 'Select...'}</span>
                        )}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 3a.75.75 0 01.53.22l3.5 3.5a.75.75 0 01-1.06 1.06L10 4.81 6.53 8.28a.75.75 0 01-1.06-1.06l3.5-3.5A.75.75 0 0110 3zm-3.72 9.28a.75.75 0 011.06 0L10 15.19l3.47-3.47a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                    </span>
                </button>

                {isOpen && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {(onSearchChange || options.length > 10) && (
                            <div className="p-2">
                                <label htmlFor="multiselect-search" className="sr-only">Search</label>
                                <input id="multiselect-search" type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded-md" />
                            </div>
                        )}
                        {isLoading && options.length === 0 ? (
                            <div className="text-center text-slate-500 py-2">Loading...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="text-center text-slate-500 py-2 px-3 text-sm">
                                {searchTerm ? 'No results found' : 'Start typing to search...'}
                            </div>
                        ) : (
                            <ul className="max-h-40 overflow-y-auto" ref={listRef} onScroll={handleScroll}>
                                {filteredOptions.map(option => (
                                    <li key={option[itemValueKey]} onClick={() => handleSelect(option[itemValueKey])} className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-indigo-600 hover:text-white">
                                        {renderOptionLabel ? renderOptionLabel(option) : <span className="block truncate">{decodeEntities(getObjectProperty(option, itemLabelKey))}</span>}
                                        {selectedValues.includes(String(option[itemValueKey])) && (
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
                                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" /></svg>
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {isLoading && options.length > 0 && (
                                    <li className="text-center text-slate-500 py-2 text-sm">Loading more...</li>
                                )}
                                {!isLoading && hasMore && (
                                    <li className="text-center text-slate-400 py-2 text-xs">Scroll for more</li>
                                )}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiSelect;