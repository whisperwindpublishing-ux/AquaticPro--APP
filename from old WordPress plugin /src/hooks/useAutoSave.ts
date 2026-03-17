import { useEffect, useRef, useCallback, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
    /** The data to auto-save */
    data: T;
    /** Async function that performs the save */
    onSave: (data: T) => Promise<void>;
    /** Debounce delay in ms (default: 3000) */
    delay?: number;
    /** Whether auto-save is enabled (disable for read-only mode) */
    enabled?: boolean;
    /** Optional comparison function. Defaults to JSON.stringify equality. */
    isEqual?: (a: T, b: T) => boolean;
}

interface UseAutoSaveReturn {
    /** Current save status */
    status: AutoSaveStatus;
    /** Whether there are unsaved changes */
    isDirty: boolean;
    /** Manually trigger a save (bypasses debounce) */
    saveNow: () => Promise<void>;
    /** Reset dirty state without saving (e.g., after external save) */
    resetDirty: () => void;
    /** Last error if status is 'error' */
    lastError: Error | null;
    /** Retry the last failed save */
    retry: () => Promise<void>;
}

/**
 * Generic auto-save hook with configurable debounce.
 * 
 * Tracks changes to `data` by comparing against the last saved snapshot.
 * When data changes, starts a debounce timer. After the timer expires,
 * calls `onSave` and tracks the save status.
 * 
 * The hook does NOT cause typing lag — React state updates are instant,
 * only the background API call is debounced.
 */
export function useAutoSave<T>({
    data,
    onSave,
    delay = 3000,
    enabled = true,
    isEqual,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
    const [status, setStatus] = useState<AutoSaveStatus>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [lastError, setLastError] = useState<Error | null>(null);

    // Refs to avoid stale closures
    const dataRef = useRef<T>(data);
    const savedDataRef = useRef<T>(data);
    const onSaveRef = useRef(onSave);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const isSavingRef = useRef(false);
    const isEqualRef = useRef(isEqual);

    // Keep refs current
    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
    useEffect(() => { isEqualRef.current = isEqual; }, [isEqual]);

    // Compare data to determine if dirty
    const checkEqual = useCallback((a: T, b: T): boolean => {
        if (isEqualRef.current) return isEqualRef.current(a, b);
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return a === b;
        }
    }, []);

    // Core save function
    const performSave = useCallback(async () => {
        if (isSavingRef.current) return;

        const currentData = dataRef.current;

        // Double-check still dirty before saving
        if (checkEqual(currentData, savedDataRef.current)) {
            setIsDirty(false);
            setStatus('idle');
            return;
        }

        isSavingRef.current = true;
        setStatus('saving');
        setLastError(null);

        try {
            await onSaveRef.current(currentData);

            // Only update saved snapshot if data hasn't changed during save
            // This prevents overwriting newer edits
            if (checkEqual(dataRef.current, currentData)) {
                savedDataRef.current = currentData;
                setIsDirty(false);
                setStatus('saved');

                // Transition back to idle after 2 seconds
                setTimeout(() => {
                    setStatus(prev => prev === 'saved' ? 'idle' : prev);
                }, 2000);
            } else {
                // Data changed during save — still dirty, restart debounce
                savedDataRef.current = currentData;
                setIsDirty(true);
                setStatus('pending');
            }
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
            setStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [checkEqual]);

    // Watch for data changes and start debounce timer
    useEffect(() => {
        if (!enabled) return;

        const isCurrentlyEqual = checkEqual(data, savedDataRef.current);

        if (isCurrentlyEqual) {
            // Data matches saved state — clear any pending save
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
            if (!isSavingRef.current) {
                setIsDirty(false);
                // Don't override 'saved' or 'error' status
                setStatus(prev => prev === 'pending' ? 'idle' : prev);
            }
            return;
        }

        // Data is dirty — start/restart debounce
        setIsDirty(true);
        setStatus('pending');

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            performSave();
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, enabled, delay, checkEqual, performSave]);

    // Flush pending save on unmount (save before navigating away)
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            // If dirty on unmount, try a synchronous-ish save
            if (!checkEqual(dataRef.current, savedDataRef.current) && !isSavingRef.current) {
                onSaveRef.current(dataRef.current).catch(console.error);
            }
        };
    }, [checkEqual]);

    // Save now (bypass debounce)
    const saveNow = useCallback(async () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = undefined;
        }
        await performSave();
    }, [performSave]);

    // Reset dirty state without saving
    const resetDirty = useCallback(() => {
        savedDataRef.current = dataRef.current;
        setIsDirty(false);
        setStatus('idle');
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = undefined;
        }
    }, []);

    // Retry failed save
    const retry = useCallback(async () => {
        if (status === 'error') {
            await performSave();
        }
    }, [status, performSave]);

    return { status, isDirty, saveNow, resetDirty, lastError, retry };
}
