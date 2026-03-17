import { useState, useCallback, useMemo } from 'react';

/**
 * Card identifiers for the workspace card stack.
 * 'tasks' and 'meetings' are the two expandable cards in the center column.
 */
export type CardId = 'tasks' | 'meetings';

/**
 * Visual state for each card:
 * - collapsed: header-only, minimal height (used when the OTHER card is expanded)
 * - default:   both cards share equal space
 * - expanded:  this card takes majority of available space
 */
export type CardState = 'collapsed' | 'default' | 'expanded';

export interface ExpandableCardConfig {
    state: CardState;
    /** CSS flex-grow value for controlling space distribution */
    flexGrow: number;
    /** Whether content body (below header) is visible */
    showBody: boolean;
}

interface UseExpandableCardsReturn {
    /** Current expanded card id, or null if both are in default state */
    expandedCard: CardId | null;
    /** Get config for a specific card */
    getCardConfig: (id: CardId) => ExpandableCardConfig;
    /** Toggle a card between expanded and default */
    toggleCard: (id: CardId) => void;
    /** Expand a specific card (will collapse the other) */
    expandCard: (id: CardId) => void;
    /** Reset both cards to default state */
    resetCards: () => void;
}

/**
 * Manages the expand/collapse state of the task and meeting cards
 * in the workspace center column.
 *
 * Push & Compress behavior:
 * - When one card expands, the other compresses to header-only
 * - When the expanded card is clicked again, both return to default
 * - Clicking the compressed card swaps which is expanded
 */
export function useExpandableCards(): UseExpandableCardsReturn {
    const [expandedCard, setExpandedCard] = useState<CardId | null>(null);

    const toggleCard = useCallback((id: CardId) => {
        setExpandedCard(prev => (prev === id ? null : id));
    }, []);

    const expandCard = useCallback((id: CardId) => {
        setExpandedCard(id);
    }, []);

    const resetCards = useCallback(() => {
        setExpandedCard(null);
    }, []);

    const getCardConfig = useCallback((id: CardId): ExpandableCardConfig => {
        if (expandedCard === null) {
            // Both cards in default state — equal space
            return { state: 'default', flexGrow: 1, showBody: true };
        }
        if (expandedCard === id) {
            // This card is expanded — takes majority space
            return { state: 'expanded', flexGrow: 3, showBody: true };
        }
        // The other card is expanded — this one is collapsed (header only)
        return { state: 'collapsed', flexGrow: 0, showBody: false };
    }, [expandedCard]);

    return useMemo(() => ({
        expandedCard,
        getCardConfig,
        toggleCard,
        expandCard,
        resetCards,
    }), [expandedCard, getCardConfig, toggleCard, expandCard, resetCards]);
}
