import { useState, useCallback, useMemo } from 'react';
import { AutoSaveStatus } from './useAutoSave';

type SaveSource = string; // e.g. 'goal', 'meeting-42', 'update-15'

interface SaveStatusEntry {
    source: SaveSource;
    status: AutoSaveStatus;
    error?: Error | null;
}

interface UseSaveStatusReturn {
    /** Register or update the status for a specific save source */
    updateStatus: (source: SaveSource, status: AutoSaveStatus, error?: Error | null) => void;
    /** Remove a save source (e.g., when a meeting card is closed) */
    removeSource: (source: SaveSource) => void;
    /** Aggregated status across all sources */
    aggregatedStatus: AutoSaveStatus;
    /** Whether any source has unsaved changes */
    hasUnsavedChanges: boolean;
    /** All individual source statuses (for debugging or detailed UI) */
    sources: SaveStatusEntry[];
    /** The first error found, if any */
    firstError: Error | null;
}

/**
 * Aggregates save status from multiple useAutoSave instances.
 * 
 * Priority order for aggregated status:
 * 1. 'error'   — if ANY source has an error
 * 2. 'saving'  — if ANY source is currently saving
 * 3. 'pending' — if ANY source has pending changes
 * 4. 'saved'   — if ANY source recently saved (and none are pending/saving/error)
 * 5. 'idle'    — everything is clean
 */
export function useSaveStatus(): UseSaveStatusReturn {
    const [statusMap, setStatusMap] = useState<Map<SaveSource, SaveStatusEntry>>(new Map());

    const updateStatus = useCallback((source: SaveSource, status: AutoSaveStatus, error?: Error | null) => {
        setStatusMap(prev => {
            const next = new Map(prev);
            next.set(source, { source, status, error: error ?? null });
            return next;
        });
    }, []);

    const removeSource = useCallback((source: SaveSource) => {
        setStatusMap(prev => {
            const next = new Map(prev);
            next.delete(source);
            return next;
        });
    }, []);

    const sources = useMemo(() => Array.from(statusMap.values()), [statusMap]);

    const aggregatedStatus = useMemo((): AutoSaveStatus => {
        if (sources.length === 0) return 'idle';

        const statuses = sources.map(s => s.status);

        if (statuses.includes('error')) return 'error';
        if (statuses.includes('saving')) return 'saving';
        if (statuses.includes('pending')) return 'pending';
        if (statuses.includes('saved')) return 'saved';
        return 'idle';
    }, [sources]);

    const hasUnsavedChanges = useMemo(() => {
        return sources.some(s => s.status === 'pending' || s.status === 'saving');
    }, [sources]);

    const firstError = useMemo(() => {
        const errorEntry = sources.find(s => s.status === 'error' && s.error);
        return errorEntry?.error ?? null;
    }, [sources]);

    return {
        updateStatus,
        removeSource,
        aggregatedStatus,
        hasUnsavedChanges,
        sources,
        firstError,
    };
}
