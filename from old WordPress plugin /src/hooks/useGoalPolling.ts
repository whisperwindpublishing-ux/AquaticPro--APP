import { useEffect, useRef, useCallback, useState } from 'react';
import { Goal, Update, Meeting } from '@/types';
import { pluginGet } from '@/services/api-service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseGoalPollingOptions {
    /** Goal ID to poll changes for */
    goalId: number;
    /** Current user ID (to filter out own changes from toasts) */
    currentUserId: number;
    /** Master enable/disable flag */
    enabled: boolean;
    /** Polling interval in milliseconds (default: 15000 = 15s) */
    intervalMs?: number;
    /** Whether the user has unsaved local changes (pauses polling) */
    hasUnsavedChanges?: boolean;
}

export interface GoalChanges {
    newUpdates: Update[];
    changedMeetings: Meeting[];
    goalChanged: boolean;
    changedGoal?: Goal;
    newComments: PollComment[];
    serverTimestamp: string;
}

export interface PollComment {
    id: number;
    postId: number;
    author: {
        id: number;
        name: string;
        avatarUrl: string;
    };
    content: string;
    date: string;
    parentId: number | null;
}

/** Toast-worthy notification for the UI */
export interface ChangeNotification {
    id: string;
    type: 'update' | 'meeting' | 'comment';
    message: string;
    actorName: string;
    itemId: number;
    timestamp: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Polls the backend for goal changes and returns actionable data.
 *
 * Behavior:
 * - Polls every `intervalMs` (default 15s) when enabled + tab is visible
 * - Pauses when `hasUnsavedChanges` is true
 * - Returns `notifications` array for toast display
 * - Calls `onNewUpdates` / `onChangedMeetings` / `onGoalChanged` callbacks
 *   so the parent can merge changes into local state
 */
export function useGoalPolling({
    goalId,
    currentUserId,
    enabled,
    intervalMs = 15000,
    hasUnsavedChanges = false,
}: UseGoalPollingOptions) {
    // Track the last poll timestamp (server-provided for clock consistency)
    const lastPollRef = useRef<string>(new Date().toISOString());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Incoming changes for consumers
    const [notifications, setNotifications] = useState<ChangeNotification[]>([]);
    const [latestChanges, setLatestChanges] = useState<GoalChanges | null>(null);

    // ── Dismiss a notification ──────────────────────────────────────────────
    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // ── Core poll function ──────────────────────────────────────────────────
    const poll = useCallback(async () => {
        try {
            const since = encodeURIComponent(lastPollRef.current);
            const data: GoalChanges = await pluginGet(
                `goals/${goalId}/changes?since=${since}`
            );

            // Update the poll cursor to server time
            if (data.serverTimestamp) {
                lastPollRef.current = data.serverTimestamp;
            }

            // Skip if nothing changed
            const hasChanges =
                data.newUpdates.length > 0 ||
                data.changedMeetings.length > 0 ||
                data.goalChanged ||
                data.newComments.length > 0;

            if (!hasChanges) return;

            // Store the latest batch for consumers
            setLatestChanges(data);

            // Build toast notifications (skip own changes)
            const newNotifs: ChangeNotification[] = [];

            for (const update of data.newUpdates) {
                if (update.author.id !== currentUserId) {
                    newNotifs.push({
                        id: `update-${update.id}-${Date.now()}`,
                        type: 'update',
                        message: `${update.author.firstName} posted an update`,
                        actorName: `${update.author.firstName} ${update.author.lastName}`,
                        itemId: update.id,
                        timestamp: Date.now(),
                    });
                }
            }

            for (const meeting of data.changedMeetings) {
                if (meeting.author.id !== currentUserId) {
                    newNotifs.push({
                        id: `meeting-${meeting.id}-${Date.now()}`,
                        type: 'meeting',
                        message: `${meeting.author.firstName} updated "${meeting.topic}"`,
                        actorName: `${meeting.author.firstName} ${meeting.author.lastName}`,
                        itemId: meeting.id,
                        timestamp: Date.now(),
                    });
                }
            }

            for (const comment of data.newComments) {
                if (comment.author.id !== currentUserId) {
                    newNotifs.push({
                        id: `comment-${comment.id}-${Date.now()}`,
                        type: 'comment',
                        message: `${comment.author.name} left a comment`,
                        actorName: comment.author.name,
                        itemId: comment.postId,
                        timestamp: Date.now(),
                    });
                }
            }

            if (newNotifs.length > 0) {
                setNotifications(prev => [...newNotifs, ...prev].slice(0, 10));
            }
        } catch (err) {
            // Silently swallow poll errors — don't interrupt the user
            console.warn('[useGoalPolling] Poll failed:', err);
        }
    }, [goalId, currentUserId]);

    // ── Start/stop polling based on conditions ──────────────────────────────
    useEffect(() => {
        if (!enabled || hasUnsavedChanges || !goalId) {
            // Clear any running interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Visibility-gated polling: only poll when tab is visible
        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    poll();
                }
            }, intervalMs);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                // Poll immediately when tab becomes visible again
                poll();
                startPolling();
            } else {
                // Stop polling when tab is hidden
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        };

        // Initial start
        startPolling();
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, hasUnsavedChanges, goalId, intervalMs, poll]);

    return {
        /** Latest batch of changes from the server (null until first poll with changes) */
        latestChanges,
        /** Toast-worthy notifications (auto-built, excludes own changes) */
        notifications,
        /** Dismiss a specific notification by id */
        dismissNotification,
        /** Manually trigger a poll (e.g., after saving) */
        pollNow: poll,
    };
}
