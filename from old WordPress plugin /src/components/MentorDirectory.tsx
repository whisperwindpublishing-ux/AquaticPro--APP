import React, { useState, useEffect } from 'react';
import { getMentorDirectory, PaginationInfo } from '@/services/api'; // This is now correct
import { configureApiService } from '@/services/api-service';
import { UserProfile } from '@/types';
import MentorCard from '@/components/MentorCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from './ui/Button';

interface MentorDirectoryProps {
    onSelectMentor: (mentor: UserProfile) => void;
}

const MentorDirectory: React.FC<MentorDirectoryProps> = ({ onSelectMentor }) => {
    const [mentors, setMentors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchMentors = async (page: number = 1) => {
        try {
            setIsLoading(true);
            const wpData = (window as any).mentorshipPlatformData;

            // Visitor Mode Bypass
            if (wpData?.visitor_mode) {
                setMentors([]);
                setPagination({ page: 1, per_page: 50, total: 0, total_pages: 1 });
                setIsLoading(false);
                return;
            }

            if (wpData && wpData.api_url) {
                configureApiService(wpData.api_url, wpData.nonce);
            } else {
                console.error('AquaticPro data not found, API calls will fail.');
                setError('Plugin is not configured correctly. Missing API data.');
                setIsLoading(false);
                return;
            }

            const response = await getMentorDirectory(page);
            setMentors(response.mentors);
            setPagination(response.pagination);
            setCurrentPage(page);
        } catch (error) {
            console.error("Failed to fetch mentors", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMentors();
    }, []);

    const filteredMentors = mentors.filter(mentor =>
        `${mentor.firstName} ${mentor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mentor.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedMentors = filteredMentors.sort((a, b) => {
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    });

    if (isLoading) return <div className="ap-flex ap-justify-center ap-items-center ap-h-64"><LoadingSpinner /></div>;
    if (error) return <div className="ap-text-red-500 ap-text-center">{error}</div>;

    return (
        <div className="ap-animate-fade-in">
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-2">Mentor Directory</h1>
            <p className="ap-text-lg ap-text-gray-600 ap-mb-6">Find a mentor to help you achieve your goals.</p>
            <input type="text" placeholder="Search by name or skill..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="ap-w-full ap-p-3 ap-mb-8 ap-bg-white ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-blue-500 focus:ap-border-blue-500" />
            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-8">
                {sortedMentors.map(mentor => (
                    <MentorCard key={mentor.id} mentor={mentor} onSelect={onSelectMentor} />
                ))}
            </div>
            {pagination && pagination.total_pages > 1 && (
                <div className="ap-flex ap-justify-center ap-items-center ap-gap-4 ap-mt-8">
                    <Button
                        onClick={() => fetchMentors(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="primary"
                    >
                        Previous
                    </Button>
                    <span className="ap-text-gray-600">
                        Page {currentPage} of {pagination.total_pages}
                    </span>
                    <Button
                        onClick={() => fetchMentors(currentPage + 1)}
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

export default MentorDirectory;