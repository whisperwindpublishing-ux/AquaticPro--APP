import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MentorshipRequest, UserProfile, Goal, Update, Meeting } from '@/types';
import { getMentorshipDetails, addGoal, updateGoal, getMentorshipDetailsAdmin, createMeeting, updateMeeting, deleteMeeting, createUpdate, updateUpdate, deleteUpdate } from '@/services/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
    HiOutlineArrowLeft as ArrowLeftIcon,
    HiOutlineFlag as FlagIcon,
    HiOutlinePlusCircle as PlusCircleIcon,
    HiOutlineCalendarDays as CalendarDaysIcon,
} from 'react-icons/hi2';
import RichTextEditor from '@/components/RichTextEditor';
import GoalWorkspace from '@/components/GoalWorkspace';
import PendingRequestBanner from './PendingRequestBanner';
import SaveStatusIndicator from '@/components/SaveStatusIndicator';
import { useSaveStatus } from '@/hooks/useSaveStatus';
import { Modal, Button, Input, Label } from './ui';

interface MentorshipDashboardProps {
    mentorshipId: number;
    currentUser: UserProfile;
    onBack: () => void;
    isAdmin: boolean;
}

const MentorshipDashboard: React.FC<MentorshipDashboardProps> = ({ mentorshipId, currentUser, onBack, isAdmin }) => {
    const [mentorship, setMentorship] = useState<MentorshipRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
    const [showAddGoalModal, setShowAddGoalModal] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- Auto-save status aggregation ---
    const { updateStatus: updateSaveStatus, aggregatedStatus: saveStatus, hasUnsavedChanges, firstError: _saveError } = useSaveStatus();

    // Track pending meeting auto-saves: meetingId -> debounce timeout
    const meetingAutoSaveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    const meetingDirtyFlags = useRef<Map<number, boolean>>(new Map());

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges || isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges, isDirty]);

    const otherUser = useMemo(() => {
        if (!mentorship) return null;
        return mentorship.sender.id === currentUser.id ? mentorship.receiver : mentorship.sender;
    }, [mentorship, currentUser]);

    // Cleanup all meeting/update auto-save timers on unmount or goal switch
    useEffect(() => {
        return () => {
            meetingAutoSaveTimers.current.forEach(timer => clearTimeout(timer));
            meetingAutoSaveTimers.current.clear();
            updateAutoSaveTimers.current.forEach(timer => clearTimeout(timer));
            updateAutoSaveTimers.current.clear();
        };
    }, [selectedGoalId]);

    const fetchMentorshipDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            
            // Choose the correct fetch function based on admin status
            const fetchFunction = isAdmin ? getMentorshipDetailsAdmin : getMentorshipDetails;
            const details = await fetchFunction(mentorshipId);

            setMentorship(details);
            if (details.goals.length > 0 && !selectedGoalId) {
                setSelectedGoalId(details.goals[0].id);
            }
        } catch (err) {
            setError('Failed to load mentorship details.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [mentorshipId, selectedGoalId, isAdmin]);

    useEffect(() => {
        fetchMentorshipDetails();
    }, [fetchMentorshipDetails]);

    const handleAddGoal = async (title: string, description: string) => {
        if (!mentorship) return;
        try {
            const newGoal = await addGoal(mentorship.id, title, description);
            setMentorship(prev => prev ? { ...prev, goals: [...prev.goals, newGoal] } : null);
            setSelectedGoalId(newGoal.id);
            setShowAddGoalModal(false);
            setIsDirty(true);
        } catch (error) {
            console.error("Failed to add goal", error);
        }
    };

    const selectedGoal = useMemo(() => {
        return mentorship?.goals.find(g => g.id === selectedGoalId) || null;
    }, [mentorship, selectedGoalId]);

    const isParticipant = useMemo(() => {
        if (!mentorship || !currentUser) return false;
        return mentorship.sender.id === currentUser.id || mentorship.receiver.id === currentUser.id;
    }, [mentorship, currentUser]);

    const handleSaveChanges = async () => {
        if (!mentorship || !selectedGoal) return;

        const goalToSave = selectedGoal;
        setIsSaving(true);
        updateSaveStatus('goal', 'saving');
        
        try {
            const savedGoal = await updateGoal(goalToSave);
            
            setMentorship(prev => {
                if (!prev) return null;

                const currentGoalInState = prev.goals.find(g => g.id === savedGoal.id);

                if (currentGoalInState === goalToSave) {
                    const updatedGoals = prev.goals.map(g => g.id === savedGoal.id ? savedGoal : g);
                    setIsDirty(false);
                    return { ...prev, goals: updatedGoals };
                }
                return prev;
            });

            updateSaveStatus('goal', 'saved');
            // Transition saved → idle after 2s
            setTimeout(() => updateSaveStatus('goal', 'idle'), 2000);

        } catch (error) {
            console.error("Error saving goal:", error);
            updateSaveStatus('goal', 'error', error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!isDirty || isSaving) return;

        updateSaveStatus('goal', 'pending');

        const handler = setTimeout(() => {
            handleSaveChanges();
        }, 3000);

        return () => {
            clearTimeout(handler);
        };
    }, [mentorship, isDirty, isSaving]);

    const handleUpdateGoal = (updatedGoal: Goal) => {
        if (!mentorship) return;

        const goalWithRealIds = {
            ...updatedGoal,
            tasks: updatedGoal.tasks.map(t => t.id < 0 ? { ...t, id: 0 } : t),
        };

        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => g.id === goalWithRealIds.id ? goalWithRealIds : g);
            return { ...prev, goals: updatedGoals };
        });
        setIsDirty(true);
    };

    // --- NEW: CRUD Handlers for Meetings and Updates ---

    const handleAddMeeting = async (newMeeting: Omit<Meeting, 'id' | 'comments' | 'commentCount'>) => {
        if (!selectedGoalId) return;
        const createdMeeting = await createMeeting({ ...newMeeting, goalId: selectedGoalId });
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => g.id === selectedGoalId ? { ...g, meetings: [...g.meetings, createdMeeting] } : g);
            return { ...prev, goals: updatedGoals };
        });
    };

    // Auto-save meeting: update local state immediately, debounce API call
    const handleUpdateMeetingLocal = useCallback((updatedMeeting: Meeting) => {
        // Update local state instantly (no lag)
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => {
                if (g.id === selectedGoalId) {
                    const newMeetings = g.meetings.map(m => m.id === updatedMeeting.id ? updatedMeeting : m);
                    return { ...g, meetings: newMeetings };
                }
                return g;
            });
            return { ...prev, goals: updatedGoals };
        });

        // Mark dirty and start debounce timer
        const meetingKey = `meeting-${updatedMeeting.id}`;
        meetingDirtyFlags.current.set(updatedMeeting.id, true);
        updateSaveStatus(meetingKey, 'pending');

        // Clear existing timer for this meeting
        const existingTimer = meetingAutoSaveTimers.current.get(updatedMeeting.id);
        if (existingTimer) clearTimeout(existingTimer);

        // Set new 3s debounce timer
        const timer = setTimeout(async () => {
            updateSaveStatus(meetingKey, 'saving');
            try {
                const savedMeeting = await updateMeeting(updatedMeeting);
                meetingDirtyFlags.current.set(updatedMeeting.id, false);

                // Only apply server response if meeting hasn't been edited again
                setMentorship(prev => {
                    if (!prev) return null;
                    const updatedGoals = prev.goals.map(g => {
                        if (g.id === selectedGoalId) {
                            const currentMeeting = g.meetings.find(m => m.id === savedMeeting.id);
                            // Only apply server response if local state matches what we sent
                            if (currentMeeting === updatedMeeting) {
                                const newMeetings = g.meetings.map(m => m.id === savedMeeting.id ? savedMeeting : m);
                                return { ...g, meetings: newMeetings };
                            }
                        }
                        return g;
                    });
                    return { ...prev, goals: updatedGoals };
                });

                updateSaveStatus(meetingKey, 'saved');
                setTimeout(() => updateSaveStatus(meetingKey, 'idle'), 2000);
            } catch (error) {
                console.error('Error auto-saving meeting:', error);
                updateSaveStatus(meetingKey, 'error', error instanceof Error ? error : new Error(String(error)));
            }
        }, 3000);

        meetingAutoSaveTimers.current.set(updatedMeeting.id, timer);
    }, [selectedGoalId, updateSaveStatus]);

    // Legacy immediate save (kept for explicit save actions like Ctrl+S)
    const handleUpdateMeeting = async (updatedMeeting: Meeting) => {
        const meetingKey = `meeting-${updatedMeeting.id}`;
        // Clear any pending auto-save for this meeting
        const existingTimer = meetingAutoSaveTimers.current.get(updatedMeeting.id);
        if (existingTimer) clearTimeout(existingTimer);

        updateSaveStatus(meetingKey, 'saving');
        try {
            const savedMeeting = await updateMeeting(updatedMeeting);
            setMentorship(prev => {
                if (!prev) return null;
                const updatedGoals = prev.goals.map(g => {
                    if (g.id === selectedGoalId) {
                        const newMeetings = g.meetings.map(m => m.id === savedMeeting.id ? savedMeeting : m);
                        return { ...g, meetings: newMeetings };
                    }
                    return g;
                });
                return { ...prev, goals: updatedGoals };
            });
            meetingDirtyFlags.current.set(updatedMeeting.id, false);
            updateSaveStatus(meetingKey, 'saved');
            setTimeout(() => updateSaveStatus(meetingKey, 'idle'), 2000);
        } catch (error) {
            console.error('Error saving meeting:', error);
            updateSaveStatus(meetingKey, 'error', error instanceof Error ? error : new Error(String(error)));
        }
    };

    const handleDeleteMeeting = async (meetingId: number) => {
        await deleteMeeting(meetingId);
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => {
                if (g.id === selectedGoalId) {
                    return { ...g, meetings: g.meetings.filter(m => m.id !== meetingId) };
                }
                return g;
            });
            return { ...prev, goals: updatedGoals };
        });
    };

    const handleAddUpdate = async (newUpdate: Omit<Update, 'id' | 'author' | 'date'>) => {
        if (!selectedGoalId) return;
        const createdUpdate = await createUpdate({ ...newUpdate, goalId: selectedGoalId });
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => g.id === selectedGoalId ? { ...g, updates: [createdUpdate, ...g.updates] } : g);
            return { ...prev, goals: updatedGoals };
        });
    };

    // Auto-save for update edits (3s debounce, same pattern as meetings)
    const updateAutoSaveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const handleUpdateUpdateLocal = useCallback((updatedUpdateData: Update) => {
        // Update local state instantly
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => {
                if (g.id === selectedGoalId) {
                    return { ...g, updates: g.updates.map(u => u.id === updatedUpdateData.id ? updatedUpdateData : u) };
                }
                return g;
            });
            return { ...prev, goals: updatedGoals };
        });

        const updateKey = `update-${updatedUpdateData.id}`;
        updateSaveStatus(updateKey, 'pending');

        // Clear existing timer
        const existingTimer = updateAutoSaveTimers.current.get(updatedUpdateData.id);
        if (existingTimer) clearTimeout(existingTimer);

        // 3s debounce
        const timer = setTimeout(async () => {
            updateSaveStatus(updateKey, 'saving');
            try {
                const savedUpdate = await updateUpdate(updatedUpdateData);
                setMentorship(prev => {
                    if (!prev) return null;
                    const updatedGoals = prev.goals.map(g => {
                        if (g.id === selectedGoalId) {
                            const currentUpdate = g.updates.find(u => u.id === savedUpdate.id);
                            if (currentUpdate === updatedUpdateData) {
                                return { ...g, updates: g.updates.map(u => u.id === savedUpdate.id ? savedUpdate : u) };
                            }
                        }
                        return g;
                    });
                    return { ...prev, goals: updatedGoals };
                });
                updateSaveStatus(updateKey, 'saved');
                setTimeout(() => updateSaveStatus(updateKey, 'idle'), 2000);
            } catch (error) {
                console.error('Error auto-saving update:', error);
                updateSaveStatus(updateKey, 'error', error instanceof Error ? error : new Error(String(error)));
            }
        }, 3000);

        updateAutoSaveTimers.current.set(updatedUpdateData.id, timer);
    }, [selectedGoalId, updateSaveStatus]);

    const handleUpdateUpdate = async (updatedUpdate: Update) => {
        const updateKey = `update-${updatedUpdate.id}`;
        const existingTimer = updateAutoSaveTimers.current.get(updatedUpdate.id);
        if (existingTimer) clearTimeout(existingTimer);

        updateSaveStatus(updateKey, 'saving');
        try {
            const saved = await updateUpdate(updatedUpdate);
            setMentorship(prev => {
                if (!prev) return null;
                const updatedGoals = prev.goals.map(g => {
                    if (g.id === selectedGoalId) {
                        return { ...g, updates: g.updates.map(u => u.id === saved.id ? saved : u) };
                    }
                    return g;
                });
                return { ...prev, goals: updatedGoals };
            });
            updateSaveStatus(updateKey, 'saved');
            setTimeout(() => updateSaveStatus(updateKey, 'idle'), 2000);
        } catch (error) {
            console.error('Error saving update:', error);
            updateSaveStatus(updateKey, 'error', error instanceof Error ? error : new Error(String(error)));
        }
    };

    const handleDeleteUpdate = async (updateId: number) => {
        await deleteUpdate(updateId);
        setMentorship(prev => {
            if (!prev) return null;
            const updatedGoals = prev.goals.map(g => {
                if (g.id === selectedGoalId) {
                    return { ...g, updates: g.updates.filter(u => u.id !== updateId) };
                }
                return g;
            });
            return { ...prev, goals: updatedGoals };
        });
    };

    if (isLoading) return <div className="ap-flex ap-justify-center ap-items-center ap-h-96"><LoadingSpinner /></div>;
    if (error) return <div className="ap-text-red-500 ap-text-center">{error}</div>;
    if (!mentorship || !otherUser) return <div className="ap-text-center">Mentorship not found.</div>;

    return (
        <div className="ap-animate-fade-in-up">
            <Button onClick={onBack} variant="ghost" size="sm" className="!ap-flex !ap-items-center !ap-mb-6 !ap-text-teal-600 hover:!ap-text-teal-700 !ap-font-medium !ap-p-0">
                <ArrowLeftIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                Back to My Mentorships
            </Button>

            {/* Save Status Indicator */}
            <div className="ap-flex ap-justify-end ap-mb-2">
                <SaveStatusIndicator
                    status={saveStatus}
                    onRetry={() => {
                        // Retry: re-trigger dirty state to restart auto-save
                        if (isDirty) handleSaveChanges();
                    }}
                />
            </div>

            {mentorship.status === 'Pending' && (
                <PendingRequestBanner
                    request={mentorship}
                    currentUser={currentUser}
                    onStatusChange={(updatedRequest) => {
                        setMentorship(updatedRequest);
                    }}
                />
            )}

            <header className="ap-mb-8">
                <div className="ap-flex ap-items-center ap-space-x-4">
                    <div className="ap-flex -ap-space-x-2">
                        <img className="ap-h-12 ap-w-12 ap-rounded-full ap-object-cover ap-ring-2 ap-ring-white" src={currentUser.avatarUrl} alt={currentUser.firstName} />
                        <img className="ap-h-12 ap-w-12 ap-rounded-full ap-object-cover ap-ring-2 ap-ring-white" src={otherUser.avatarUrl} alt={otherUser.firstName} />
                    </div>
                    <div>
                        <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Mentorship with {otherUser.firstName} {otherUser.lastName}</h1>
                        <p className="ap-text-gray-600 ap-mb-2">Tracking progress and collaboration</p>

                        {(() => {
                            // Logic to determine which link to show
                            const isMentor = currentUser.id === mentorship.receiver.id;
                            const bookingLinkToShow = isMentor ? mentorship.sender.bookingLink : mentorship.receiver.bookingLink;
                            const bookingLinkText = isMentor ? "View Mentee's Availability" : "Book a Meeting with Mentor";

                            if (bookingLinkToShow) {
                                return (
                                    <a 
                                        href={bookingLinkToShow} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="ap-inline-flex ap-items-center ap-gap-1 ap-text-sm ap-text-blue-600 hover:ap-underline"
                                    >
                                        <CalendarDaysIcon className="ap-h-4 ap-w-4" />
                                        {bookingLinkText}
                                    </a>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            </header>

            <div className="ap-flex ap-flex-col ap-gap-3">
                {/* Goal selector — card table with Add button */}
                <div className="ap-bg-white ap-rounded-lg ap-shadow ap-overflow-hidden">
                    <div className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2.5 ap-border-b ap-border-gray-100">
                        <h2 className="ap-text-sm ap-font-semibold ap-text-gray-700">Goals</h2>
                        <button
                            onClick={() => setShowAddGoalModal(true)}
                            disabled={mentorship.status === 'Pending'}
                            className="ap-inline-flex ap-items-center ap-gap-1 ap-px-3 ap-py-1 ap-rounded-md ap-text-xs ap-font-medium ap-text-white ap-bg-gradient-to-r ap-from-teal-500 ap-to-emerald-500 hover:ap-from-teal-600 hover:ap-to-emerald-600 ap-transition-colors ap-shadow-sm disabled:ap-opacity-50 disabled:ap-cursor-not-allowed"
                        >
                            <PlusCircleIcon className="ap-h-3.5 ap-w-3.5" />
                            Add Goal
                        </button>
                    </div>
                    <table className="ap-w-full ap-text-sm">
                        <tbody>
                            {mentorship.goals.map(goal => (
                                <tr
                                    key={goal.id}
                                    onClick={() => setSelectedGoalId(goal.id)}
                                    className={`ap-cursor-pointer ap-transition-colors ${
                                        selectedGoalId === goal.id
                                            ? 'ap-bg-gradient-to-r ap-from-teal-50 ap-to-cyan-50 ap-border-l-4 ap-border-l-teal-500'
                                            : 'hover:ap-bg-gray-50 ap-border-l-4 ap-border-l-transparent'
                                    }`}
                                >
                                    <td className="ap-px-4 ap-py-2.5">
                                        <div className="ap-flex ap-items-center ap-gap-2">
                                            <FlagIcon className={`ap-h-4 ap-w-4 ap-flex-shrink-0 ${selectedGoalId === goal.id ? 'ap-text-teal-600' : 'ap-text-gray-400'}`} />
                                            <span className={`ap-font-medium ${selectedGoalId === goal.id ? 'ap-text-teal-800' : 'ap-text-gray-700'}`}>
                                                {goal.title}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="ap-px-4 ap-py-2.5 ap-text-right ap-text-xs ap-text-gray-400 ap-whitespace-nowrap">
                                        {goal.status || ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {mentorship.goals.length === 0 && (
                        <p className="ap-text-center ap-text-sm ap-text-gray-400 ap-py-4">No goals yet. Add one to get started.</p>
                    )}
                </div>

                {/* Main Content — full width */}
                <main className="ap-min-w-0">
                    {selectedGoal ? (
                        <GoalWorkspace
                            key={selectedGoal.id}
                            goal={selectedGoal}
                            onUpdate={handleUpdateGoal}
                            currentUser={currentUser}
                            isReadOnly={!isAdmin && !isParticipant}
                            // Pass down the new handlers
                            onAddMeeting={handleAddMeeting}
                            onUpdateMeeting={handleUpdateMeeting}
                            onUpdateMeetingLocal={handleUpdateMeetingLocal}
                            onDeleteMeeting={handleDeleteMeeting}
                            onAddUpdate={handleAddUpdate}
                            onUpdateUpdate={handleUpdateUpdate}
                            onUpdateUpdateLocal={handleUpdateUpdateLocal}
                            onDeleteUpdate={handleDeleteUpdate}
                            saveStatus={saveStatus}
                        />
                    ) : (
                        <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-8 ap-text-center">
                            <h2 className="ap-text-xl ap-font-semibold ap-text-gray-800">Select a goal</h2>
                            <p className="ap-text-gray-600 ap-mt-2">Choose a goal above to see its details, or add a new one to get started.</p>
                        </div>
                    )}
                </main>
            </div>

            <AddGoalModal
                isOpen={showAddGoalModal}
                onClose={() => setShowAddGoalModal(false)}
                onAddGoal={handleAddGoal}
            />

        </div>
    );
};


interface AddGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddGoal: (title: string, description: string) => Promise<void>;
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ isOpen, onClose, onAddGoal }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setIsSaving(true);
        await onAddGoal(title, description || '');
        setIsSaving(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <Modal.Header>
                <Modal.Title>Add a New Goal</Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
                <Modal.Body>
                    <div className="ap-space-y-4">
                        <div>
                            <Label htmlFor="goal-title">Goal Title</Label>
                            <Input
                                id="goal-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Master React State Management"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="goal-description">Description</Label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                            />
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        type="button" 
                        onClick={onClose} 
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={isSaving || !title.trim()}
                        loading={isSaving}
                    >
                        {isSaving ? 'Adding...' : 'Add Goal'}
                    </Button>
                </Modal.Footer>
            </form>
        </Modal>
    );
};

export default MentorshipDashboard;