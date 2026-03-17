import React, { useState, useEffect } from 'react';
import { View } from '@/App';
import { HiOutlineClipboardDocumentList, HiOutlineXMark, HiOutlineChevronRight } from 'react-icons/hi2';
import { Button } from './ui/Button';

interface AssignedCard {
    card_id: number;
    title: string;
    deck_name: string;
    list_name: string;
    due_date: string | null;
}

interface AssignedCardsBannerProps {
    onNavigate: (view: View) => void;
    apiUrl: string;
    nonce: string;
}

const AssignedCardsBanner: React.FC<AssignedCardsBannerProps> = ({ onNavigate, apiUrl, nonce }) => {
    const [assignedCards, setAssignedCards] = useState<AssignedCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssignedCards = async () => {
            // Check if user has dismissed the banner within the last 24 hours
            const dismissedTimestamp = localStorage.getItem('assignedCardsBannerDismissed');
            if (dismissedTimestamp) {
                const dismissedTime = parseInt(dismissedTimestamp, 10);
                const now = Date.now();
                const oneDayInMs = 24 * 60 * 60 * 1000;
                
                if (now - dismissedTime < oneDayInMs) {
                    // Still within 24 hours, keep it dismissed
                    setIsDismissed(true);
                    setIsLoading(false);
                    return;
                }
                // More than 24 hours have passed, clear the dismissal
                localStorage.removeItem('assignedCardsBannerDismissed');
            }

            try {
                const response = await fetch(`${apiUrl}/taskcards/my-assigned`, {
                    headers: {
                        'X-WP-Nonce': nonce,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch assigned cards');
                }

                const data = await response.json();
                setAssignedCards(data.cards || []);
            } catch (err) {
                console.error('Error fetching assigned cards:', err);
                setError('Could not check for assigned cards');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssignedCards();
    }, [apiUrl, nonce]);

    const handleDismiss = () => {
        setIsDismissed(true);
        // Store current timestamp instead of just 'true'
        localStorage.setItem('assignedCardsBannerDismissed', Date.now().toString());
    };

    const handleNavigateToTaskDeck = () => {
        onNavigate('taskdeck');
    };

    // Don't render if dismissed, loading, error, or no assigned cards
    if (isDismissed || isLoading || error || assignedCards.length === 0) {
        return null;
    }

    // Count cards with upcoming due dates (within 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingCards = assignedCards.filter(card => {
        if (!card.due_date) return false;
        const dueDate = new Date(card.due_date);
        return dueDate <= weekFromNow && dueDate >= now;
    });

    const overdueCards = assignedCards.filter(card => {
        if (!card.due_date) return false;
        const dueDate = new Date(card.due_date);
        return dueDate < now;
    });

    return (
        <div className="ap-bg-gradient-to-r ap-from-cyan-500 ap-to-blue-600 ap-text-white ap-rounded-lg ap-shadow-lg ap-mb-6 ap-overflow-hidden">
            <div className="ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between">
                <div className="ap-flex ap-items-center ap-gap-3">
                    <div className="ap-bg-white/20 ap-rounded-full ap-p-2">
                        <HiOutlineClipboardDocumentList className="ap-w-6 ap-h-6" />
                    </div>
                    <div>
                        <h3 className="ap-font-semibold ap-text-lg">
                            You have {assignedCards.length} task{assignedCards.length !== 1 ? 's' : ''} assigned to you
                        </h3>
                        <p className="ap-text-white/80 ap-text-sm">
                            {overdueCards.length > 0 && (
                                <span className="ap-text-red-200 ap-font-medium">
                                    {overdueCards.length} overdue • 
                                </span>
                            )}
                            {upcomingCards.length > 0 && (
                                <span className="ap-text-yellow-200">
                                    {' '}{upcomingCards.length} due soon • 
                                </span>
                            )}
                            {' '}Click to view your tasks in TaskDeck
                        </p>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-2">
                    <Button
                        onClick={handleNavigateToTaskDeck}
                        variant="secondary"
                        className="!ap-bg-white !ap-text-cyan-600 hover:!ap-bg-cyan-50"
                        rightIcon={<HiOutlineChevronRight className="ap-w-4 ap-h-4" />}
                    >
                        View Tasks
                    </Button>
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        size="sm"
                        className="!ap-text-white hover:!ap-bg-white/20"
                        aria-label="Dismiss notification"
                    >
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            </div>
            
            {/* Preview of first few cards */}
            {assignedCards.length > 0 && assignedCards.length <= 5 && (
                <div className="ap-bg-black/10 ap-px-4 ap-py-2 ap-border-t ap-border-white/10">
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        {assignedCards.slice(0, 3).map(card => (
                            <span 
                                key={card.card_id}
                                className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-sm ap-truncate ap-max-w-[200px]"
                                title={`${card.title} - ${card.deck_name}`}
                            >
                                {card.title}
                            </span>
                        ))}
                        {assignedCards.length > 3 && (
                            <span className="ap-text-white/70 ap-text-sm ap-py-1">
                                +{assignedCards.length - 3} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignedCardsBanner;
