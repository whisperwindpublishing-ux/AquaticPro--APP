import React, { useState, useEffect } from 'react';
import { getPortfolioDirectory, PaginationInfo } from '@/services/api';
import { configureApiService } from '@/services/api-service';
import { UserProfile } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from './ui/Button';

interface PortfolioDirectoryProps {
    onSelectUser: (user: UserProfile) => void;
}

const PortfolioUserCard: React.FC<{ user: UserProfile, onSelect: (user: UserProfile) => void }> = ({ user, onSelect }) => (
    <div className="ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6 ap-cursor-pointer hover:ap-shadow-xl hover:-ap-translate-y-1 ap-transition-all ap-duration-300 ap-flex ap-flex-col" onClick={() => onSelect(user)}>
        <div className="ap-flex ap-items-center ap-mb-4">
            <img className="ap-h-16 ap-w-16 ap-rounded-full ap-object-cover" src={user.avatarUrl || ''} alt={`${user.firstName || ''} ${user.lastName || ''}`} />
            <div className="ap-ml-4">
                <h3 className="ap-text-lg ap-font-bold ap-text-gray-900">{user.firstName} {user.lastName}</h3>
                <p className="ap-text-sm ap-text-gray-600">{user.tagline || ''}</p>
            </div>
        </div>
        {user.bioDetails && (
            <div className="ap-flex-grow">
                <p className="ap-text-sm ap-text-gray-700 ap-mb-4" dangerouslySetInnerHTML={{ __html: (user.bioDetails || '').substring(0, 100) + (user.bioDetails && user.bioDetails.length > 100 ? '...' : '') }} />
            </div>
        )}
    </div>
);

const PortfolioDirectory: React.FC<PortfolioDirectoryProps> = ({ onSelectUser }) => {
    const [portfolios, setPortfolios] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchPortfolios = async (page: number = 1) => {
        try {
            setIsLoading(true);
            setError(null);
            const wpData = window.mentorshipPlatformData;
            if (wpData && wpData.api_url) {
                configureApiService(wpData.api_url, wpData.nonce || '');
            } else {
                console.error('Mentorship App data not found, API calls will fail.');
                // Even if it fails, try to configure a fallback
                configureApiService('/wp-json/', ''); 
            }

            const response = await getPortfolioDirectory(page);
            // Handle both old (array) and new (object) response formats
            if (Array.isArray(response)) {
                // Old format: direct array
                setPortfolios(response);
                setPagination(null);
            } else {
                // New format: { users, pagination }
                setPortfolios(response.users || []);
                setPagination(response.pagination || null);
            }
            setCurrentPage(page);
        } catch (err) {
            console.error('Failed to fetch portfolio directory:', err);
            setError('Could not load portfolios.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const filteredPortfolios = (portfolios || []).filter(user =>
        `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.skills && Array.isArray(user.skills) && user.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    if (isLoading) return <div className="ap-flex ap-justify-center ap-items-center ap-h-64"><LoadingSpinner /></div>;
    if (error) return <div className="ap-text-red-500 ap-text-center">{error}</div>;

    return (
        <div className="ap-animate-fade-in">
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-2">Public Portfolios</h1>
            <p className="ap-text-lg ap-text-gray-600 ap-mb-6">Explore the public goals and achievements of our members.</p>
            <input type="text" placeholder="Search by name or skill..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="ap-w-full ap-p-3 ap-mb-8 ap-bg-white ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-blue-500 focus:ap-border-blue-500" />
            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-8">
                {filteredPortfolios.map(user => (
                    <PortfolioUserCard key={user.id} user={user} onSelect={onSelectUser} />
                ))}
            </div>
            {pagination && pagination.total_pages > 1 && (
                <div className="ap-flex ap-justify-center ap-items-center ap-gap-4 ap-mt-8">
                    <Button
                        onClick={() => fetchPortfolios(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="primary"
                    >
                        Previous
                    </Button>
                    <span className="ap-text-gray-600">
                        Page {currentPage} of {pagination.total_pages}
                    </span>
                    <Button
                        onClick={() => fetchPortfolios(currentPage + 1)}
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

export default PortfolioDirectory;