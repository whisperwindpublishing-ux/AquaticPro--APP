import React, { useState, useEffect } from 'react';
import { createMentorshipAdmin, getAllMentorshipsAdmin, deleteMentorship, PaginationInfo } from '@/services/api';
import { getCachedSimpleUsers } from '@/services/userCache';
import { MentorshipRequest } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import { Button, Modal } from './ui';

interface SimpleUser {
    id: number;
    name: string;
}

interface AdminPanelProps {
    onSelectMentorship: (id: number) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onSelectMentorship }) => {
    const [users, setUsers] = useState<SimpleUser[]>([]);
    const [allMentorships, setAllMentorships] = useState<MentorshipRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedMentor, setSelectedMentor] = useState<string>('');
    const [selectedMentee, setSelectedMentee] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    
    // Delete confirmation state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [mentorshipToDelete, setMentorshipToDelete] = useState<MentorshipRequest | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchMentorships = async (page: number = 1) => {
        try {
            const response = await getAllMentorshipsAdmin(page);
            setAllMentorships(response.mentorships || []);
            setPagination(response.pagination);
            setCurrentPage(page);
        } catch (err) {
            console.error('Failed to fetch mentorships:', err);
            setAllMentorships([]);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const usersData = await getCachedSimpleUsers();
                // Users are already sorted by centralized cache
                setUsers(usersData || []);
                await fetchMentorships();
            } catch (err) {
                console.error('Admin panel load error:', err);
                setError('Failed to load admin data. Please ensure you have admin permissions.');
                setUsers([]);
                setAllMentorships([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCreateMentorship = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMentor || !selectedMentee) {
            alert('Please select both a mentor and a mentee.');
            return;
        }
        
        setIsCreating(true);
        try {
            const newMentorship = await createMentorshipAdmin(Number(selectedMentor), Number(selectedMentee));
            setAllMentorships(prev => [newMentorship, ...prev]);
            setSelectedMentor('');
            setSelectedMentee('');
        } catch (err) {
            console.error(err);
            alert('Failed to create mentorship.');
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleDeleteClick = (mentorship: MentorshipRequest) => {
        setMentorshipToDelete(mentorship);
        setDeleteConfirmOpen(true);
        setDeleteConfirmText('');
    };
    
    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
        setMentorshipToDelete(null);
        setDeleteConfirmText('');
    };
    
    const handleDeleteConfirm = async () => {
        if (!mentorshipToDelete) return;
        
        const expectedText = 'DELETE';
        if (deleteConfirmText !== expectedText) {
            alert('Please type DELETE to confirm');
            return;
        }
        
        setIsDeleting(true);
        try {
            await deleteMentorship(mentorshipToDelete.id);
            setAllMentorships(prev => prev.filter(m => m.id !== mentorshipToDelete.id));
            setDeleteConfirmOpen(false);
            setMentorshipToDelete(null);
            setDeleteConfirmText('');
        } catch (err) {
            console.error(err);
            alert('Failed to delete mentorship. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <p className="ap-text-red-500">{error}</p>;
    }

    return (
        <div className="ap-space-y-8">
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Aquatic Pro</h1>

            {/* Section 1: Create New Mentorship */}
            <section className="ap-bg-white ap-shadow ap-rounded-lg ap-p-6">
                <h2 className="ap-text-xl ap-font-semibold ap-mb-4">Create New Mentorship</h2>
                <form onSubmit={handleCreateMentorship} className="ap-space-y-4">
                    <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                        <div>
                            <label htmlFor="mentor-select" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Select Mentor</label>
                            <select
                                id="mentor-select"
                                value={selectedMentor}
                                onChange={(e) => setSelectedMentor(e.target.value)}
                                className="ap-mt-1 ap-block ap-w-full ap-p-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm"
                            >
                                <option value="">Choose a mentor...</option>
                                {users && users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="mentee-select" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Select Mentee</label>
                            <select
                                id="mentee-select"
                                value={selectedMentee}
                                onChange={(e) => setSelectedMentee(e.target.value)}
                                className="ap-mt-1 ap-block ap-w-full ap-p-2 ap-border ap-border-gray-300 ap-rounded-md ap-shadow-sm"
                            >
                                <option value="">Choose a mentee...</option>
                                {users && users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="ap-text-right">
                        <Button type="submit" variant="primary" loading={isCreating}>
                            {isCreating ? 'Creating...' : 'Create Relationship'}
                        </Button>
                    </div>
                </form>
            </section>

            {/* Section 2: View All Mentorships */}
            <section className="ap-bg-white ap-shadow ap-rounded-lg ap-p-6">
                <h2 className="ap-text-xl ap-font-semibold ap-mb-4">All Mentorships ({allMentorships?.length || 0})</h2>
                {allMentorships && allMentorships.length > 0 ? (
                    <div className="ap-space-y-2">
                        {allMentorships.map(req => (
                        <div key={req.id} className="ap-p-3 ap-border ap-rounded-md ap-flex ap-justify-between ap-items-center">
                            <div>
                                <p className="ap-font-semibold">
                                    <span className="ap-font-normal">Mentor:</span> {req.receiver.firstName} {req.receiver.lastName}
                                </p>
                                <p className="ap-font-semibold">
                                    <span className="ap-font-normal">Mentee:</span> {req.sender.firstName} {req.sender.lastName}
                                </p>
                                <p className="ap-text-sm ap-text-gray-500">Status: <span className="ap-font-medium">{req.status}</span></p>
                            </div>
                            <div className="ap-flex ap-gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => onSelectMentorship(req.id)}
                                >
                                    View/Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDeleteClick(req)}
                                    title="Delete mentorship"
                                >
                                    🗑️ Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : (
                    <p className="ap-text-gray-500 ap-text-center ap-py-4">No mentorships found.</p>
                )}
                
                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                    <div className="ap-flex ap-justify-center ap-items-center ap-gap-4 ap-mt-6">
                        <Button
                            onClick={() => fetchMentorships(currentPage - 1)}
                            disabled={currentPage === 1}
                            variant="primary"
                        >
                            Previous
                        </Button>
                        <span className="ap-text-gray-600">
                            Page {currentPage} of {pagination.total_pages}
                        </span>
                        <Button
                            onClick={() => fetchMentorships(currentPage + 1)}
                            disabled={currentPage === pagination.total_pages}
                            variant="primary"
                        >
                            Next
                        </Button>
                    </div>
                )}
            </section>
            
            {/* Delete Confirmation Dialog */}
            <Modal 
                isOpen={deleteConfirmOpen && !!mentorshipToDelete} 
                onClose={handleDeleteCancel}
                size="md"
            >
                <Modal.Header>
                    <Modal.Title className="ap-text-red-600">⚠️ Delete Mentorship - PERMANENT ACTION</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="ap-space-y-3">
                        <p className="ap-text-sm">
                            You are about to permanently delete the mentorship between:
                        </p>
                        {mentorshipToDelete && (
                            <div className="ap-bg-gray-100 ap-p-3 ap-rounded">
                                <p className="ap-font-semibold">Mentor: {mentorshipToDelete.receiver.firstName} {mentorshipToDelete.receiver.lastName}</p>
                                <p className="ap-font-semibold">Mentee: {mentorshipToDelete.sender.firstName} {mentorshipToDelete.sender.lastName}</p>
                            </div>
                        )}
                        <div className="ap-bg-red-50 ap-border ap-border-red-300 ap-rounded ap-p-3">
                            <p className="ap-text-sm ap-font-semibold ap-text-red-800 ap-mb-2">
                                This will permanently delete:
                            </p>
                            <ul className="ap-text-sm ap-text-red-700 ap-list-disc ap-list-inside ap-space-y-1">
                                <li>All goals and their progress</li>
                                <li>All initiatives and tasks</li>
                                <li>All meetings and notes</li>
                                <li>All updates and comments</li>
                                <li>The entire mentorship relationship</li>
                            </ul>
                        </div>
                        <p className="ap-text-sm ap-font-bold ap-text-red-600">
                            THIS ACTION CANNOT BE UNDONE!
                        </p>
                        <div className="ap-mt-4">
                            <label className="ap-block ap-text-sm ap-font-medium ap-mb-2">
                                Type <span className="ap-font-mono ap-bg-gray-200 ap-px-2 ap-py-1 ap-rounded">DELETE</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="ap-w-full ap-p-2 ap-border ap-border-gray-300 ap-rounded"
                                placeholder="Type DELETE"
                                autoFocus
                            />
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={handleDeleteCancel}
                        variant="secondary"
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        variant="danger"
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        loading={isDeleting}
                    >
                        Permanently Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AdminPanel;