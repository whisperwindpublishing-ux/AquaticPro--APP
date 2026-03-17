import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDraftPersistenceOptions {
    /** Unique key for this draft (e.g., `goal_42_update_draft`) */
    storageKey: string;
    /** Debounce delay for writing to localStorage (default: 1000ms) */
    saveDelay?: number;
    /** Whether persistence is enabled */
    enabled?: boolean;
}

interface UseDraftPersistenceReturn {
    /** The current draft value (initialized from localStorage or empty string) */
    draft: string;
    /** Update the draft value (persists to localStorage after debounce) */
    setDraft: (value: string) => void;
    /** Clear the draft from state and localStorage */
    clearDraft: () => void;
    /** Whether a saved draft was loaded on mount */
    hadSavedDraft: boolean;
}

/**
 * Persists draft text to localStorage so users don't lose unposted content.
 * 
 * On mount: loads any existing draft from localStorage.
 * On changes: debounces writes to localStorage (1s default).
 * On clear: removes from both state and localStorage.
 */
export function useDraftPersistence({
    storageKey,
    saveDelay = 1000,
    enabled = true,
}: UseDraftPersistenceOptions): UseDraftPersistenceReturn {
    const [hadSavedDraft, setHadSavedDraft] = useState(false);

    // Initialize from localStorage
    const [draft, setDraftState] = useState<string>(() => {
        if (!enabled) return '';
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved && saved.trim()) {
                setHadSavedDraft(true);
                return saved;
            }
        } catch {
            // localStorage may be unavailable (privacy mode, storage full)
        }
        return '';
    });

    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const storageKeyRef = useRef(storageKey);
    useEffect(() => { storageKeyRef.current = storageKey; }, [storageKey]);

    // Debounced write to localStorage
    useEffect(() => {
        if (!enabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            try {
                if (draft.trim()) {
                    localStorage.setItem(storageKeyRef.current, draft);
                } else {
                    localStorage.removeItem(storageKeyRef.current);
                }
            } catch {
                // Silently fail if localStorage is full or unavailable
            }
        }, saveDelay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [draft, saveDelay, enabled]);

    // Flush to localStorage on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (enabled) {
                try {
                    const currentDraft = draft;
                    if (currentDraft.trim()) {
                        localStorage.setItem(storageKeyRef.current, currentDraft);
                    }
                } catch {
                    // Silently fail
                }
            }
        };
    }, [enabled, draft]);

    const setDraft = useCallback((value: string) => {
        setDraftState(value);
    }, []);

    const clearDraft = useCallback(() => {
        setDraftState('');
        try {
            localStorage.removeItem(storageKeyRef.current);
        } catch {
            // Silently fail
        }
    }, []);

    // Handle storageKey change (e.g., switching goals)
    useEffect(() => {
        if (!enabled) return;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved && saved.trim()) {
                setDraftState(saved);
                setHadSavedDraft(true);
            } else {
                setDraftState('');
                setHadSavedDraft(false);
            }
        } catch {
            setDraftState('');
            setHadSavedDraft(false);
        }
    }, [storageKey, enabled]);

    return { draft, setDraft, clearDraft, hadSavedDraft };
}
