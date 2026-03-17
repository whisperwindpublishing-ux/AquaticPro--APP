import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { configureApiService } from '@/services/api-service';
import SkillBadge from '@/components/SkillBadge';
import { 
    HiOutlineArrowLeft as ArrowLeftIcon,
    HiOutlineAcademicCap as AcademicCapIcon,
    HiOutlineBriefcase as BriefcaseIcon,
    HiOutlinePencilSquare as PencilSquareIcon,
    HiOutlinePaperAirplane as PaperAirplaneIcon,
    HiOutlineCheckCircle as CheckCircleIcon,
    HiOutlineBookmarkSquare as BookmarkSquareIcon,
    HiOutlineLink as LinkIcon
} from 'react-icons/hi2';
import { FaLinkedin as LinkedInIcon } from 'react-icons/fa';
import RichTextEditor from '@/components/RichTextEditor';
import { requestMentorship } from '@/services/api'; // This is now correct
import { Modal, Button } from './ui';
import MySeasonalReturns from '@/components/srm/MySeasonalReturns';

interface MentorProfileProps {
    mentor: UserProfile;
    currentUser: UserProfile | null;
    onBack: () => void;
    isCurrentUser?: boolean;
    onEditProfile?: () => void;
    isPublicView?: boolean;
    onViewPortfolio?: (user: UserProfile) => void;
}

const MentorProfile: React.FC<MentorProfileProps> = ({ mentor, currentUser, onBack, isCurrentUser = false, onEditProfile, onViewPortfolio }) => {
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [requestError, setRequestError] = useState<string | null>(null);

    const handleSendRequest = async () => {
        setRequestStatus('sending');
        const wpData = (window as any).mentorshipPlatformData;
        if (wpData && wpData.api_url) {
            configureApiService(wpData.api_url, wpData.nonce);
        } else {
            console.error('AquaticPro data not found, API calls will fail.');
            setRequestError('Plugin is not configured correctly. Missing API data.');
            setRequestStatus('error');
            return;
        }

        try {
            await requestMentorship(mentor.id, requestMessage); // This is now correct
            setRequestStatus('sent');
            setTimeout(() => {
                setShowRequestModal(false);
                setRequestStatus('idle');
            }, 2000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setRequestStatus('error');
            setRequestError(errorMessage);
        }
    };

    const renderModal = () => (
        <Modal 
            isOpen={showRequestModal} 
            onClose={() => setShowRequestModal(false)}
            size="md"
        >
            <Modal.Header>
                <Modal.Title>Request Mentorship</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {requestStatus === 'sent' ? (
                    <div className="ap-text-center ap-py-8">
                        <CheckCircleIcon className="ap-h-16 ap-w-16 ap-text-green-500 ap-mx-auto ap-mb-4" />
                        <p className="ap-text-lg ap-text-gray-700">Your request has been sent!</p>
                    </div>
                ) : (
                    <>
                        <p className="ap-text-gray-600 ap-mb-4">Send a message to {mentor.firstName} to introduce yourself and explain what you're looking for in a mentorship.</p>                        
                        <RichTextEditor
                            value={requestMessage}
                            onChange={setRequestMessage}
                            placeholder={`Hi ${mentor.firstName}, I'm interested in...`}
                        />
                        {requestStatus === 'error' && <p className="ap-text-red-500 ap-text-sm ap-mt-2">{requestError || 'Failed to send request. Please try again.'}</p>}
                    </>
                )}
            </Modal.Body>
            {requestStatus !== 'sent' && (
                <Modal.Footer>
                    <Button onClick={() => setShowRequestModal(false)} variant="secondary">Cancel</Button>
                    <Button 
                        onClick={handleSendRequest} 
                        disabled={requestStatus === 'sending' || !requestMessage}
                        loading={requestStatus === 'sending'}
                    >
                        Send Request
                    </Button>
                </Modal.Footer>
            )}
        </Modal>
    );

    return (
        <div className="ap-animate-fade-in-up">
            {renderModal()}
            <Button onClick={onBack} variant="ghost" size="sm" leftIcon={<ArrowLeftIcon className="ap-h-4 ap-w-4" />} className="ap-mb-6">
                Back to Directory
            </Button>

            <div className="ap-bg-white ap-rounded-lg ap-shadow-lg ap-overflow-hidden">
                <div className="ap-p-8">
                    <div className="ap-flex ap-flex-col sm:ap-flex-row ap-items-start">
                        <img className="ap-h-24 ap-w-24 ap-rounded-full ap-object-cover ap-mb-4 sm:ap-mb-0 sm:ap-mr-8" src={mentor.avatarUrl} alt={`${mentor.firstName} ${mentor.lastName}`} />
                        <div className="ap-flex-grow">
                            <div className="ap-flex ap-justify-between ap-items-start">
                                <div>
                                    <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">{mentor.firstName} {mentor.lastName}</h1>
                                    <p className="ap-text-lg ap-text-gray-600 ap-mt-1">{mentor.tagline}</p>
                                </div>
                                {isCurrentUser ? (
                                    <Button variant="secondary" onClick={onEditProfile} leftIcon={<PencilSquareIcon className="ap-h-5 ap-w-5" />}>
                                        Edit Profile
                                    </Button>
                                ) : (currentUser && currentUser.id !== mentor.id) ? (
                                    <Button variant="primary" onClick={() => setShowRequestModal(true)} leftIcon={<PaperAirplaneIcon className="ap-h-5 ap-w-5" />}>
                                        Request Mentorship
                                    </Button>
                                ) : null}
                            </div>
                            <div className="ap-mt-4 ap-flex ap-flex-wrap ap-gap-2">
                                {mentor.skills && mentor.skills.map(skill => <SkillBadge key={skill} skill={skill} />)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ap-border-t ap-border-gray-200 ap-p-8 ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-8">
                    <div className="md:ap-col-span-2">
                        <div className="ap-mb-8">
                            <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-3 ap-flex ap-items-center"><AcademicCapIcon className="ap-h-6 ap-w-6 ap-mr-2"/> About Me</h2>
                            <div className="ap-prose ap-max-w-none ap-text-gray-700 ap-break-words ap-overflow-wrap-anywhere" dangerouslySetInnerHTML={{ __html: mentor.bioDetails }} />
                        </div>
                        {isCurrentUser && mentor.jobRoles && mentor.jobRoles.length > 0 && (
                            <div className="ap-mb-8">
                                <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-3 ap-flex ap-items-center">
                                    <BriefcaseIcon className="ap-h-6 ap-w-6 ap-mr-2"/> 
                                    Job Role{mentor.jobRoles.length > 1 ? 's' : ''}
                                </h2>
                                <div className="ap-space-y-2">
                                    {mentor.jobRoles.map((role) => (
                                        <div 
                                            key={role.id} 
                                            className="ap-flex ap-items-center ap-justify-between ap-p-3 ap-bg-gray-50 ap-rounded-lg"
                                        >
                                            <span className="ap-font-medium ap-text-gray-900">{role.title}</span>
                                            <span className="ap-text-sm ap-text-gray-500">Tier {role.tier}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isCurrentUser && (
                            <div className="ap-mb-8">
                                <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-3 ap-flex ap-items-center">
                                    <BriefcaseIcon className="ap-h-6 ap-w-6 ap-mr-2"/> 
                                    Seasonal Returns
                                </h2>
                                <MySeasonalReturns />
                            </div>
                        )}
                        <div>
                            <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-3 ap-flex ap-items-center"><BriefcaseIcon className="ap-h-6 ap-w-6 ap-mr-2"/> Experience</h2>
                            <div className="ap-prose ap-max-w-none ap-text-gray-700 ap-break-words ap-overflow-wrap-anywhere" dangerouslySetInnerHTML={{ __html: mentor.experience }} />
                        </div>
                    </div>
                    <div className="md:ap-col-span-1">
                        <div className="ap-bg-gray-50 ap-rounded-lg ap-p-6">
                            <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-4">Links</h2>
                            <ul className="ap-space-y-3">
                                {mentor.linkedinUrl && (
                                    <li>
                                        <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ap-flex ap-items-center ap-text-sm">
                                            <LinkedInIcon className="ap-h-5 ap-w-5 ap-mr-2" />
                                            LinkedIn Profile
                                        </a>
                                    </li>
                                )}
                                {mentor.customLinks && mentor.customLinks.map((link, index) => (
                                    <li key={index}>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="ap-flex ap-items-center ap-text-sm">
                                            <LinkIcon className="ap-h-5 ap-w-5 ap-mr-2" />
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                                {onViewPortfolio && (
                                     <li>
                                        <Button onClick={() => onViewPortfolio(mentor)} variant="ghost" size="sm" leftIcon={<BookmarkSquareIcon className="ap-h-5 ap-w-5" />}>
                                            View Portfolio
                                        </Button>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MentorProfile;