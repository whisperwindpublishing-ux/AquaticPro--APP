import React from 'react';
import { MentorshipRequest, MentorshipRequestStatus, UserProfile } from '@/types';
import { Button } from '@/components/ui/Button';
import { 
    HiOutlinePaperAirplane as PaperAirplaneIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlineXMark as XMarkIcon
} from 'react-icons/hi2';

interface MentorshipHistoryProps {
    requests: MentorshipRequest[];
    currentUser: UserProfile;
    onApprove: (requestId: number) => void;
    onReject: (requestId: number) => void;
}

const StatusBadge: React.FC<{ status: MentorshipRequestStatus }> = ({ status }) => {
    const statusStyles: Record<MentorshipRequestStatus, string> = {
        Pending: 'ap-bg-yellow-100 ap-text-yellow-800',
        Accepted: 'ap-bg-green-100 ap-text-green-800',
        Rejected: 'ap-bg-red-100 ap-text-red-800',
    };
    return <span className={`ap-px-2 ap-inline-flex ap-text-xs ap-leading-5 ap-font-semibold ap-rounded-full ${statusStyles[status]}`}>{status}</span>;
};

const MentorshipHistory: React.FC<MentorshipHistoryProps> = ({ requests, currentUser, onApprove, onReject }) => {
    if (requests.length === 0) {
        return <p className="ap-text-center ap-text-gray-500">No mentorship requests sent or received yet.</p>;
    }

    return (
        <div className="ap-bg-white ap-shadow-sm ap-rounded-lg ap-p-6">
            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4 ap-flex ap-items-center"><PaperAirplaneIcon className="ap-h-5 ap-w-5 ap-mr-2" /> Request History</h3>
            <ul className="ap-divide-y ap-divide-gray-200">
                {requests.map(req => {
                    const isReceived = req.receiver.id === currentUser.id;
                    const otherUser = isReceived ? req.sender : req.receiver;

                    return (
                        <li key={req.id} className="ap-py-3 ap-flex ap-justify-between ap-items-center">
                            <div>
                                <p className="ap-text-sm ap-text-gray-800">
                                    {isReceived ? 'Request ap-from ' : 'Request ap-to '}
                                    <span className="ap-font-semibold">{otherUser.firstName} {otherUser.lastName}</span>
                                </p>
                                <p className="ap-text-xs ap-text-gray-500 ap-mt-1 ap-italic">"{req.message}"</p>
                            </div>
                            <div className="ap-flex ap-items-center ap-gap-4">
                                {isReceived && req.status === 'Pending' ? (
                                    <div className="ap-flex ap-items-center ap-gap-2">
                                        <Button variant="success" size="sm" onClick={() => onApprove(req.id)}>
                                            <CheckIcon className="ap-h-4 ap-w-4" />
                                        </Button>
                                        <Button variant="danger" size="sm" onClick={() => onReject(req.id)}>
                                            <XMarkIcon className="ap-h-4 ap-w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <StatusBadge status={req.status} />
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default MentorshipHistory;