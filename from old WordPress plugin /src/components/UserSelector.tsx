import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HiChevronDown, HiSearch } from 'react-icons/hi';
import { parseDisplayName } from '../utils/userSorting';
import { Button } from './ui';

export interface UserOption {
    id: number;
    name: string;
    email?: string;
    job_role?: string;
    tier?: number;
    avatar_url?: string;
}

interface UserSelectorProps {
    users: UserOption[];
    selectedUserId: number;
    onChange: (userId: number) => void;
    label?: string;
    placeholder?: string;
    isLoading?: boolean;
}

type SortOption = 'name' | 'tier' | 'role';

const UserSelector: React.FC<UserSelectorProps> = ({
    users,
    selectedUserId,
    onChange,
    label = 'View Progress For',
    placeholder = 'Select a user...',
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Focus search input when dropdown opens
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Filter and sort users
    const filteredAndSortedUsers = useMemo(() => {
        let filtered = users;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = users.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email?.toLowerCase().includes(query) ||
                user.job_role?.toLowerCase().includes(query)
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'name': {
                    // Sort by last name, then first name using consistent parsing
                    const parsedA = parseDisplayName(a.name);
                    const parsedB = parseDisplayName(b.name);
                    
                    const lastNameCompare = parsedA.lastName.localeCompare(parsedB.lastName, undefined, { sensitivity: 'base' });
                    if (lastNameCompare !== 0) return lastNameCompare;
                    return parsedA.firstName.localeCompare(parsedB.firstName, undefined, { sensitivity: 'base' });
                }
                case 'tier':
                    return (b.tier || 0) - (a.tier || 0); // Higher tier first
                case 'role': {
                    if (!a.job_role && !b.job_role) {
                        // If no roles, sort by last name
                        const parsedA = parseDisplayName(a.name);
                        const parsedB = parseDisplayName(b.name);
                        return parsedA.lastName.localeCompare(parsedB.lastName, undefined, { sensitivity: 'base' });
                    }
                    if (!a.job_role) return 1;
                    if (!b.job_role) return -1;
                    return a.job_role.localeCompare(b.job_role);
                }
                default:
                    return 0;
            }
        });

        return sorted;
    }, [users, searchQuery, sortBy]);

    const selectedUser = users.find(u => u.id === selectedUserId);

    const handleSelectUser = (userId: number) => {
        console.log('=== UserSelector handleSelectUser ===');
        console.log('Selected userId:', userId, 'type:', typeof userId);
        onChange(userId);
        setIsOpen(false);
        setSearchQuery('');
    };

    const getUserInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <div className="ap-relative" ref={dropdownRef}>
            {label && (
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                    {label}
                </label>
            )}
            
            {/* Selected User Display / Trigger Button */}
            <Button
                variant="outline"
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
                className="!ap-w-full !ap-bg-white !ap-border-gray-300 !ap-rounded-lg !ap-px-4 !ap-py-3 !ap-flex !ap-items-center !ap-justify-between hover:!ap-border-blue-500 focus:!ap-ring-2 focus:!ap-ring-blue-500 focus:!ap-border-blue-500 !ap-transition-colors !ap-h-auto"
            >
                {selectedUser ? (
                    <div className="ap-flex ap-items-center ap-space-x-3 ap-flex-1 ap-min-w-0">
                        {/* Avatar */}
                        <div className="ap-flex-shrink-0 ap-w-10 ap-h-10 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-purple-600 ap-flex ap-items-center ap-justify-center ap-text-white ap-font-semibold ap-shadow-sm">
                            {selectedUser.avatar_url ? (
                                <img
                                    src={selectedUser.avatar_url}
                                    alt={selectedUser.name}
                                    className="ap-w-full ap-h-full ap-rounded-full ap-object-cover"
                                />
                            ) : (
                                getUserInitials(selectedUser.name)
                            )}
                        </div>
                        
                        {/* User Info */}
                        <div className="ap-flex-1 ap-min-w-0 ap-text-left">
                            <div className="ap-font-medium ap-text-gray-900 ap-truncate">
                                {selectedUser.name}
                            </div>
                            {selectedUser.job_role && (
                                <div className="ap-text-sm ap-text-gray-500 ap-truncate">
                                    {selectedUser.job_role}
                                    {selectedUser.tier && ` (Tier ${selectedUser.tier})`}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <span className="ap-text-gray-500">{placeholder}</span>
                )}
                
                <HiChevronDown
                    className={`ap-w-5 ap-h-5 ap-text-gray-400 ap-ml-2 ap-flex-shrink-0 ap-transition-transform ${
                        isOpen ? 'ap-transform ap-rotate-180' : ''
                    }`}
                />
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="ap-absolute ap-z-50 ap-mt-2 ap-w-full ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-xl ap-max-h-[500px] ap-flex ap-flex-col">
                    {/* Search and Sort Header */}
                    <div className="ap-p-3 ap-border-b ap-border-gray-200 ap-space-y-2 ap-flex-shrink-0">
                        {/* Search Input */}
                        <div className="ap-relative">
                            <HiSearch className="ap-absolute ap-left-3 ap-top-1/2 ap-transform -ap-translate-y-1/2 ap-text-gray-400 ap-w-5 ap-h-5" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users..."
                                className="ap-w-full ap-pl-10 ap-pr-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-md focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-text-sm"
                            />
                        </div>
                        
                        {/* Sort Options */}
                        <div className="ap-flex ap-items-center ap-space-x-2 ap-text-sm">
                            <span className="ap-text-gray-600 ap-font-medium">Sort by:</span>
                            <Button
                                variant="ghost"
                                size="xs"
                                type="button"
                                onClick={() => setSortBy('name')}
                                className={`!ap-px-2 !ap-py-1 !ap-min-h-0 !ap-rounded ap-transition-colors ${
                                    sortBy === 'name'
                                        ? '!ap-bg-blue-100 !ap-text-blue-700 !ap-font-medium' : '!ap-text-gray-600 hover:!ap-bg-gray-100'
                                }`}
                            >
                                Name
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                type="button"
                                onClick={() => setSortBy('role')}
                                className={`!ap-px-2 !ap-py-1 !ap-min-h-0 !ap-rounded ap-transition-colors ${
                                    sortBy === 'role'
                                        ? '!ap-bg-blue-100 !ap-text-blue-700 !ap-font-medium' : '!ap-text-gray-600 hover:!ap-bg-gray-100'
                                }`}
                            >
                                Role
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                type="button"
                                onClick={() => setSortBy('tier')}
                                className={`!ap-px-2 !ap-py-1 !ap-min-h-0 !ap-rounded ap-transition-colors ${
                                    sortBy === 'tier'
                                        ? '!ap-bg-blue-100 !ap-text-blue-700 !ap-font-medium' : '!ap-text-gray-600 hover:!ap-bg-gray-100'
                                }`}
                            >
                                Tier
                            </Button>
                        </div>
                    </div>

                    {/* User List with Virtual Scrolling */}
                    <div className="ap-overflow-y-auto ap-flex-1 ap-py-1">
                        {filteredAndSortedUsers.length === 0 ? (
                            <div className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-500 ap-text-sm">
                                {searchQuery ? 'No users found matching your search' : 'No users available'}
                            </div>
                        ) : (
                            filteredAndSortedUsers.map((user) => (
                                <Button
                                    key={user.id}
                                    variant="ghost"
                                    type="button"
                                    onClick={() => handleSelectUser(user.id)}
                                    className={`!ap-w-full !ap-px-4 !ap-py-3 !ap-flex !ap-items-center !ap-space-x-3 hover:!ap-bg-blue-50 !ap-transition-colors !ap-text-left !ap-justify-start !ap-h-auto !ap-rounded-none ${
                                        user.id === selectedUserId ? '!ap-bg-blue-50' : ''
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="ap-flex-shrink-0 ap-w-9 ap-h-9 ap-rounded-full ap-bg-gradient-to-br ap-from-blue-500 ap-to-purple-600 ap-flex ap-items-center ap-justify-center ap-text-white ap-text-sm ap-font-semibold ap-shadow-sm">
                                        {user.avatar_url ? (
                                            <img
                                                src={user.avatar_url}
                                                alt={user.name}
                                                className="ap-w-full ap-h-full ap-rounded-full ap-object-cover"
                                            />
                                        ) : (
                                            getUserInitials(user.name)
                                        )}
                                    </div>
                                    
                                    {/* User Info */}
                                    <div className="ap-flex-1 ap-min-w-0">
                                        <div className={`ap-font-medium ap-truncate ${
                                            user.id === selectedUserId ? 'ap-text-blue-700' : 'ap-text-gray-900'
                                        }`}>
                                            {user.name}
                                        </div>
                                        {user.job_role ? (
                                            <div className="ap-text-sm ap-text-gray-500 ap-truncate">
                                                {user.job_role}
                                                {user.tier && ` • Tier ${user.tier}`}
                                            </div>
                                        ) : (
                                            <div className="ap-text-sm ap-text-gray-400 ap-italic">No role assigned</div>
                                        )}
                                    </div>
                                    
                                    {/* Selected Indicator */}
                                    {user.id === selectedUserId && (
                                        <div className="ap-flex-shrink-0">
                                            <svg
                                                className="ap-w-5 ap-h-5 ap-text-blue-600"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </Button>
                            ))
                        )}
                    </div>

                    {/* Footer with count */}
                    <div className="ap-px-4 ap-py-2 ap-border-t ap-border-gray-200 ap-text-xs ap-text-gray-500 ap-flex-shrink-0">
                        Showing {filteredAndSortedUsers.length} of {users.length} users
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserSelector;
