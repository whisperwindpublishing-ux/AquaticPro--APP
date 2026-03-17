import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/Button';
import { MentorshipRequest, UserProfile } from '@/types';
import { getAllMentorshipsAdmin, PaginationInfo } from '@/services/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface MyMenteesProps {
    currentUser: UserProfile;
    isAdmin: boolean;
    onSelectMentorship: (id: number) => void;
    initialMentorships: MentorshipRequest[];
}

const MyMentees: React.FC<MyMenteesProps> = ({ currentUser, isAdmin, onSelectMentorship, initialMentorships }) => {
    const [mentorships, setMentorships] = useState<MentorshipRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchAdminMentorships = async (page: number = 1) => {
        setIsLoading(true);
        try {
            const response = await getAllMentorshipsAdmin(page);
            setMentorships(response.mentorships);
            setPagination(response.pagination);
            setCurrentPage(page);
        } catch (err) {
            console.error("Failed to fetch admin mentorships", err);
            setError("Failed to load admin mentorship list.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // If the user is an admin, refetch ALL mentorships
        if (isAdmin) {
            fetchAdminMentorships();
        } else {
            // If not admin, just use the mentorships passed from App.tsx
            setMentorships(initialMentorships);
        }
    }, [isAdmin, initialMentorships]);

    // Filter out any malformed mentorship records (null sender/receiver from bad imports)
    const validMentorships = useMemo(() => {
        return mentorships.filter(m => m && m.status && m.sender && m.receiver);
    }, [mentorships]);

    const activeMentees = useMemo(() => {
        return validMentorships
            .filter(m => m.status === 'Accepted' && m.sender.id !== currentUser.id)
            .sort((a, b) => (a.sender.lastName || '').localeCompare(b.sender.lastName || '') || (a.sender.firstName || '').localeCompare(b.sender.firstName || ''));
    }, [validMentorships, currentUser]);

    const activeMentors = useMemo(() => {
        return validMentorships
            .filter(m => m.status === 'Accepted' && m.sender.id === currentUser.id)
            .sort((a, b) => (a.receiver.lastName || '').localeCompare(b.receiver.lastName || '') || (a.receiver.firstName || '').localeCompare(b.receiver.firstName || ''));
    }, [validMentorships, currentUser]);

    const pendingRequests = useMemo(() => {
        // If admin, show all pending. If not, show only received.
        return validMentorships
            .filter(m => 
                m.status === 'Pending' && (isAdmin || m.receiver.id === currentUser.id)
            )
            .sort((a, b) => {
                const userA = a.sender;
                const userB = b.sender;
                return (userA.lastName || '').localeCompare(userB.lastName || '') || (userA.firstName || '').localeCompare(userB.firstName || '');
            });
    }, [validMentorships, currentUser, isAdmin]);

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <p className="ap-text-red-500">{error}</p>;
    }

    return (
        <div className="ap-space-y-8">
            {isAdmin && (
                <div className="ap-p-4 ap-bg-yellow-100 ap-border-l-4 ap-border-yellow-500 ap-text-yellow-700">
                    <p className="ap-font-bold">Administrator View</p>
                    <p>You are seeing all mentorships across the platform.</p>
                </div>
            )}
            
            {/* My Mentors */}
            {!isAdmin && (
                <section>
                    <h2 className="ap-text-2xl ap-font-bold ap-mb-4">My Mentors</h2>
                    {activeMentors.length > 0 ? (
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-6">
                            {activeMentors.map(req => (
                                <MentorshipCard key={req.id} request={req} perspective="mentee" onClick={() => onSelectMentorship(req.id)} />
                            ))}
                        </div>
                    ) : (
                        <p>You are not currently mentoring with anyone.</p>
                    )}
                </section>
            )}

            {/* My Mentees */}
            <section>
                <h2 className="ap-text-2xl ap-font-bold ap-mb-4">{isAdmin ? 'All Active Mentees' : 'My Mentees'}</h2>
                {activeMentees.length > 0 ? (
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-6">
                        {activeMentees.map(req => (
                            <MentorshipCard key={req.id} request={req} perspective="mentor" onClick={() => onSelectMentorship(req.id)} />
                        ))}
                    </div>
                ) : (
                    <p>{isAdmin ? 'There are no active mentees.' : 'You are not currently mentoring any mentees.'}</p>
                )}
            </section>

            {/* Pending Requests */}
            <section>
                <h2 className="ap-text-2xl ap-font-bold ap-mb-4">{isAdmin ? 'All Pending Requests' : 'Pending Mentee Requests'}</h2>
                {pendingRequests.length > 0 ? (
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-6">
                        {pendingRequests.map(req => (
                            <MentorshipCard key={req.id} request={req} perspective="mentor" onClick={() => onSelectMentorship(req.id)} />
                        ))}
                    </div>
                ) : (
                    <p>There are no pending requests.</p>
                )}
            </section>

            {/* Pagination for admin view */}
            {isAdmin && pagination && pagination.total_pages > 1 && (
                <div className="ap-flex ap-justify-center ap-items-center ap-gap-4 ap-mt-8">
                    <Button
                        onClick={() => fetchAdminMentorships(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="primary"
                    >
                        Previous
                    </Button>
                    <span className="ap-text-gray-600">
                        Page {currentPage} of {pagination.total_pages}
                    </span>
                    <Button
                        onClick={() => fetchAdminMentorships(currentPage + 1)}
                        disabled={currentPage === pagination.total_pages}
                        variant="primary"
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};

const MentorshipCard: React.FC<{ request: MentorshipRequest; perspective: 'mentor' | 'mentee'; onClick: () => void; }> = ({ request, perspective, onClick }) => {
    const user = perspective === 'mentor' ? request.sender : request.receiver;
    return (
        <Button onClick={onClick} variant="ghost" className="!ap-bg-white !ap-shadow !ap-rounded-lg !ap-p-4 !ap-text-left !ap-w-full hover:!ap-shadow-lg !ap-h-auto !ap-justify-start">
            <div className="ap-flex ap-items-center ap-space-x-4">
                <img src={user.avatarUrl} alt={user.firstName} className="ap-h-12 ap-w-12 ap-rounded-full" />
                <div>
                    <p className="ap-font-semibold">{user.firstName} {user.lastName}</p>
                    <p className="ap-text-sm ap-text-gray-500">{user.tagline}</p>
                </div>
            </div>
        </Button>
    );
};

export default MyMentees;