import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Goal } from '@/types';
import { getUserPortfolio } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { configureApiService } from '@/services/api-service';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
    HiOutlineFlag as FlagIcon,
    HiOutlineAcademicCap as AcademicCapIcon,
    HiOutlineShare as ShareIcon
} from 'react-icons/hi2';
import { FaLinkedin as LinkedInIcon } from 'react-icons/fa';
import GoalWorkspace from '@/components/GoalWorkspace';

interface PortfolioPageProps {
    user: UserProfile;
    currentUser: UserProfile | null;
    onBack: () => void;
    initialGoalId?: number | null; // For deep linking to a specific goal
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ user, currentUser, onBack, initialGoalId }) => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

    useEffect(() => {
        const fetchPortfolio = async () => {
            const wpData = (window as any).mentorshipPlatformData;

            // Configure the API service on component load
            if (wpData && wpData.api_url) {
                configureApiService(wpData.api_url, wpData.nonce);
            } else {
                console.error('AquaticPro data not found, API calls will fail.');
                setError('Plugin is not configured correctly. Missing API data.');
                setIsLoading(false);
                return;
            }

            if (!user || !user.id) {
                setError("User not specified.");
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const portfolioData = await getUserPortfolio(user.id); // This now returns { user, goals }
                setGoals(portfolioData.goals || []); // The user is already passed in as a prop
                if (portfolioData.goals && portfolioData.goals.length > 0) {
                    // If initialGoalId is provided and exists in goals, use it; otherwise use first goal
                    const targetGoalId = initialGoalId && portfolioData.goals.some(g => g.id === initialGoalId)
                        ? initialGoalId
                        : portfolioData.goals[0].id;
                    setSelectedGoalId(targetGoalId);
                }
            } catch (err) {
                setError("Failed to load portfolio.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPortfolio();
    }, [user]);

    const selectedGoal = useMemo(() => {
        return goals.find(g => g.id === selectedGoalId) || null;
    }, [goals, selectedGoalId]);

    // Group goals by role (mentor vs mentee)
    const groupedGoals = useMemo(() => {
        const asGoalOwner: Goal[] = [];
        const asMentor: Goal[] = [];

        goals.forEach(goal => {
            // Check if this user is the mentee (goal owner)
            if (goal.mentee && goal.mentee.id === user.id) {
                asGoalOwner.push(goal);
            }
            // Check if this user is the mentor
            else if (goal.mentor && goal.mentor.id === user.id) {
                asMentor.push(goal);
            }
        });

        return { asGoalOwner, asMentor };
    }, [goals, user.id]);

    const handleUpdateGoal = (_updatedGoal: Goal) => {
        // Read-only mode — goal updates from polling are handled
        // inside GoalWorkspace itself. This callback is a no-op.
    };

    // Share the entire portfolio
    const handleShare = () => {
        const portfolioUrl = `${window.location.origin}${window.location.pathname}?view=portfolio&user_id=${user.id}`;
        navigator.clipboard.writeText(portfolioUrl).then(() => {
            setCopyStatus('copied');
            setTimeout(() => {
                setCopyStatus('idle');
            }, 2000); // Reset after 2 seconds
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
        });
    };

    // Share a direct link to the current goal
    const handleShareGoal = () => {
        if (!selectedGoalId) return;
        const goalUrl = `${window.location.origin}${window.location.pathname}?view=portfolio&user_id=${user.id}&goal_id=${selectedGoalId}`;
        navigator.clipboard.writeText(goalUrl).then(() => {
            setCopyStatus('copied');
            setTimeout(() => {
                setCopyStatus('idle');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
        });
    };

    // Check if current user can share (is owner, admin, or tier 6+)
    const wpData = (window as any).mentorshipPlatformData;
    const isAdmin = wpData?.is_admin || false;
    const canShare = currentUser && (
        currentUser.id === user.id ||  // Is the portfolio owner
        isAdmin ||                      // Is WordPress admin
        (currentUser.tier && currentUser.tier >= 6)  // Is Tier 6+
    );

    if (isLoading) return <div className="ap-flex ap-justify-center ap-items-center ap-h-96"><LoadingSpinner /></div>;
    if (error) return <div className="ap-text-red-500 ap-text-center">{error}</div>;
    if (!user) return <div className="ap-text-center">User not found.</div>;

    return (
        <div className="ap-animate-fade-in-up">
            {/* Top bar with back button */}
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                <Button onClick={onBack} variant="ghost" size="sm" className="!ap-flex !ap-items-center !ap-p-0">
                    <AcademicCapIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                    Back to Profiles
                </Button>
                {canShare && (
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button variant="secondary" size="sm" onClick={handleShare} leftIcon={<ShareIcon className="ap-h-4 ap-w-4" />}>
                            {copyStatus === 'copied' ? 'Copied!' : 'Share Portfolio'}
                        </Button>
                        {selectedGoalId && (
                            <Button variant="secondary" size="sm" onClick={handleShareGoal} leftIcon={<FlagIcon className="ap-h-4 ap-w-4" />}>
                                {copyStatus === 'copied' ? 'Copied!' : 'Share Goal'}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Portfolio header card — compact */}
            <header className="ap-mb-4 ap-bg-white ap-shadow-sm ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                <div className="ap-flex ap-items-center ap-gap-4">
                    <img className="ap-h-14 ap-w-14 ap-rounded-full ap-object-cover ap-flex-shrink-0" src={user.avatarUrl} alt={user.firstName} />
                    <div className="ap-min-w-0 ap-flex-grow">
                        <div className="ap-flex ap-items-center ap-gap-3 ap-flex-wrap">
                            <h1 className="ap-text-lg ap-font-bold ap-text-gray-900">{user.firstName} {user.lastName}</h1>
                            {user.linkedinUrl && (
                                <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ap-flex ap-items-center ap-gap-1 ap-text-xs ap-text-gray-400 hover:ap-text-blue-600 ap-transition-colors">
                                    <LinkedInIcon className="ap-h-3.5 ap-w-3.5" /> LinkedIn
                                </a>
                            )}
                        </div>
                        {user.tagline && <p className="ap-text-sm ap-text-gray-500 ap-truncate">{user.tagline}</p>}
                    </div>
                </div>
                {user.bioDetails && (
                    <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-gray-100">
                        <p className="ap-text-sm ap-text-gray-600 ap-break-words ap-line-clamp-3" dangerouslySetInnerHTML={{ __html: user.bioDetails }} />
                    </div>
                )}
            </header>

            <div className="ap-flex ap-flex-col ap-gap-3">
                {/* Goal selector — table layout matching MentorshipDashboard */}
                <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-overflow-hidden">
                    <div className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2.5 ap-border-b ap-border-gray-100">
                        <h2 className="ap-text-sm ap-font-semibold ap-text-gray-700">Public Goals</h2>
                    </div>
                    {goals.length > 0 ? (
                        <table className="ap-w-full ap-text-sm">
                            <tbody>
                                {groupedGoals.asGoalOwner.map(goal => (
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
                                {groupedGoals.asMentor.map(goal => (
                                    <tr
                                        key={goal.id}
                                        onClick={() => setSelectedGoalId(goal.id)}
                                        className={`ap-cursor-pointer ap-transition-colors ${
                                            selectedGoalId === goal.id
                                                ? 'ap-bg-gradient-to-r ap-from-blue-50 ap-to-indigo-50 ap-border-l-4 ap-border-l-blue-500'
                                                : 'hover:ap-bg-gray-50 ap-border-l-4 ap-border-l-transparent'
                                        }`}
                                    >
                                        <td className="ap-px-4 ap-py-2.5">
                                            <div className="ap-flex ap-items-center ap-gap-2">
                                                <AcademicCapIcon className={`ap-h-4 ap-w-4 ap-flex-shrink-0 ${selectedGoalId === goal.id ? 'ap-text-blue-600' : 'ap-text-gray-400'}`} />
                                                <span className={`ap-font-medium ${selectedGoalId === goal.id ? 'ap-text-blue-800' : 'ap-text-gray-700'}`}>
                                                    {goal.title}
                                                </span>
                                                <span className="ap-text-[10px] ap-uppercase ap-font-semibold ap-text-blue-500 ap-bg-blue-50 ap-px-1.5 ap-py-0.5 ap-rounded">Mentor</span>
                                            </div>
                                        </td>
                                        <td className="ap-px-4 ap-py-2.5 ap-text-right ap-text-xs ap-text-gray-400 ap-whitespace-nowrap">
                                            {goal.status || ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="ap-text-center ap-text-sm ap-text-gray-400 ap-py-4">This user has not made any goals public.</p>
                    )}
                </div>

                {/* Main Content — full width GoalWorkspace (read-only) */}
                <main className="ap-min-w-0">
                    {selectedGoal ? (
                        <GoalWorkspace
                            key={selectedGoal.id}
                            goal={selectedGoal}
                            onUpdate={handleUpdateGoal}
                            currentUser={currentUser}
                            isReadOnly={true}
                        />
                    ) : (
                        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-8 ap-text-center">
                            <h2 className="ap-text-xl ap-font-semibold ap-text-gray-800">Select a goal</h2>
                            <p className="ap-text-gray-600 ap-mt-2">Choose a goal above to view its details.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default PortfolioPage;