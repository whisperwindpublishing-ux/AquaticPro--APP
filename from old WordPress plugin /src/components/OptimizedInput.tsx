import React, { useState, useEffect, useCallback, useRef } from 'react';

interface OptimizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    debounceMs?: number;
}

/**
 * Optimized input component that uses local state for immediate updates
 * and debounces the parent state update to prevent lag
 */
export const OptimizedInput: React.FC<OptimizedInputProps> = ({ 
    value, 
    onChange, 
    debounceMs = 0,
    ...inputProps 
}) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const isMountedRef = useRef(true);
    
    // Sync local value when external value changes (but not from our own update)
    useEffect(() => {
        if (value !== localValue && document.activeElement !== inputRef.current) {
            setLocalValue(value);
        }
    }, [value]);
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    
    const inputRef = useRef<HTMLInputElement>(null);
    
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        
        // Update local state immediately for responsive UI
        setLocalValue(newValue);
        
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Debounce parent update
        if (debounceMs > 0) {
            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    onChange(newValue);
                }
            }, debounceMs);
        } else {
            onChange(newValue);
        }
    }, [onChange, debounceMs]);
    
    return (
        <input
            {...inputProps}
            ref={inputRef}
            value={localValue}
            onChange={handleChange}
        />
    );
};

interface OptimizedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
    debounceMs?: number;
}

/**
 * Optimized textarea component with same debouncing logic
 */
export const OptimizedTextarea: React.FC<OptimizedTextareaProps> = ({ 
    value, 
    onChange, 
    debounceMs = 0,
    ...textareaProps 
}) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const isMountedRef = useRef(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Sync local value when external value changes
    useEffect(() => {
        if (value !== localValue && document.activeElement !== textareaRef.current) {
            setLocalValue(value);
        }
    }, [value]);
    
    // Cleanup
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        
        // Update local state immediately
        setLocalValue(newValue);
        
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Debounce parent update
        if (debounceMs > 0) {
            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    onChange(newValue);
                }
            }, debounceMs);
        } else {
            onChange(newValue);
        }
    }, [onChange, debounceMs]);
    
    return (
        <textarea
            {...textareaProps}
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
        />
    );
};
