import { useState, useCallback, useRef } from 'react';

/**
 * Optimized form hook that prevents unnecessary re-renders
 * Uses useCallback to memoize handlers and prevents object recreation on every keystroke
 */
export function useOptimizedForm<T extends Record<string, any>>(initialState: T) {
    const [formData, setFormData] = useState<T>(initialState);
    
    // Store form data in a ref to avoid closure issues
    const formDataRef = useRef<T>(formData);
    formDataRef.current = formData;
    
    /**
     * Update a single field - memoized to prevent recreation
     */
    const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setFormData((prev) => {
            // Only update if value actually changed
            if (prev[field] === value) {
                return prev;
            }
            return {
                ...prev,
                [field]: value
            };
        });
    }, []);
    
    /**
     * Create a memoized onChange handler for a specific field
     */
    const createChangeHandler = useCallback(<K extends keyof T>(field: K) => {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const value = e.target.value as T[K];
            updateField(field, value);
        };
    }, [updateField]);
    
    /**
     * Create a memoized onChange handler for number inputs
     */
    const createNumberChangeHandler = useCallback(<K extends keyof T>(field: K) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseFloat(e.target.value) as T[K];
            updateField(field, value);
        };
    }, [updateField]);
    
    /**
     * Create a memoized onChange handler for checkbox inputs
     */
    const createCheckboxChangeHandler = useCallback(<K extends keyof T>(field: K) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.checked as T[K];
            updateField(field, value);
        };
    }, [updateField]);
    
    /**
     * Reset form to initial state
     */
    const resetForm = useCallback(() => {
        setFormData(initialState);
    }, [initialState]);
    
    /**
     * Set multiple fields at once
     */
    const setMultipleFields = useCallback((updates: Partial<T>) => {
        setFormData((prev) => ({
            ...prev,
            ...updates
        }));
    }, []);
    
    /**
     * Replace entire form data
     */
    const setForm = useCallback((newData: T) => {
        setFormData(newData);
    }, []);
    
    return {
        formData,
        updateField,
        createChangeHandler,
        createNumberChangeHandler,
        createCheckboxChangeHandler,
        resetForm,
        setMultipleFields,
        setForm
    };
}
