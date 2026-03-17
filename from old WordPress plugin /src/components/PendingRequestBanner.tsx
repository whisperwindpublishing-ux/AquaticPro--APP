import React, { useState } from 'react';
import { MentorshipRequest, UserProfile } from '@/types';
import { updateMentorshipRequestStatus } from '@/services/api';
import { AiOutlineLoading3Quarters as SpinnerIcon } from 'react-icons/ai';
import { Button } from '@/components/ui/Button';

interface PendingRequestBannerProps {
    request: MentorshipRequest;
    currentUser: UserProfile;
    onStatusChange: (updatedRequest: MentorshipRequest) => void;
}

const PendingRequestBanner: React.FC<PendingRequestBannerProps> = ({ request, currentUser, onStatusChange }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (currentUser.id !== request.receiver.id || request.status !== 'Pending') {
        return null;
    }

    const handleUpdateStatus = async (status: 'Accepted' | 'Rejected') => {
        setIsLoading(true);
        setError(null);
        try {
            const updatedRequest = await updateMentorshipRequestStatus(request.id, status);
            onStatusChange(updatedRequest); // Pass the updated request back up
        } catch (err: unknown) {
            console.error(err);
            if (err instanceof Error) {
                setError(err.message || 'Failed to update request. Please try again.');
            } else {
                setError(String(err) || 'Failed to update request. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const mentee = request.sender;

    return (
        <div className="ap-bg-yellow-100 ap-border-l-4 ap-border-yellow-500 ap-text-yellow-800 ap-p-6 ap-rounded-lg ap-shadow ap-mb-8">
            <div className="ap-flex ap-flex-col md:ap-flex-row ap-justify-between ap-items-center ap-gap-4">
                <div className="ap-flex-1">
                    <h2 className="ap-text-xl ap-font-bold">New Mentorship Request</h2>
                    <div className="ap-flex ap-items-center ap-gap-3 ap-mt-2">
                        <img src={mentee.avatarUrl} alt={`${mentee.firstName} avatar`} className="ap-h-10 ap-w-10 ap-rounded-full" />
                        <div>
                            <p className="ap-font-semibold">{mentee.firstName} {mentee.lastName} wants to be your mentee.</p>
                            <p className="ap-text-sm">"{request.message ?? ''}"</p>
                        </div>
                    </div>
                </div>
                
                <div className="ap-flex-shrink-0 ap-flex ap-items-center ap-gap-4">
                    {isLoading ? (
                        <SpinnerIcon className="ap-animate-spin ap-h-5 ap-w-5" />
                    ) : (
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => handleUpdateStatus('Rejected')}
                                aria-label="Deny mentorship request"
                                disabled={isLoading}
                            >
                                Deny
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => handleUpdateStatus('Accepted')}
                                aria-label="Accept mentorship request"
                                disabled={isLoading}
                            >
                                Accept Request
                            </Button>
                        </>
                    )}
                </div>
            </div>
            {error && <p className="ap-text-red-500 ap-text-sm ap-mt-2" role="alert">{error}</p>}
        </div>
    );
};

export default PendingRequestBanner;