import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import MileageEntryForm from './MileageEntryForm';
import MileageEntryList from './MileageEntryList';
import MileageSettings from './MileageSettings';
import MileageReportGenerator from './MileageReportGenerator';
import { Button } from '../ui/Button';
import { 
    HiOutlineTruck, 
    HiOutlineCog6Tooth, 
    HiOutlineDocumentText,
    HiOutlinePlusCircle,
    HiOutlineExclamationTriangle,
    HiOutlineClipboardDocumentList
} from 'react-icons/hi2';

interface MileageAccess {
    has_access: boolean;
    can_submit: boolean;
    can_view_all: boolean;
    can_manage: boolean;
}

interface MileageModuleProps {
    currentUser: UserProfile;
}

type Tab = 'my-trips' | 'new-entry' | 'reports' | 'settings';

const MileageModule: React.FC<MileageModuleProps> = () => {
    const [access, setAccess] = useState<MileageAccess | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('my-trips');
    const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        checkAccess();
    }, []);

    const checkAccess = async () => {
        try {
            const response = await fetch(`${apiUrl}/mileage/access`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            if (response.ok) {
                const data = await response.json();
                setAccess(data);
            } else {
                setAccess({ has_access: false, can_submit: false, can_view_all: false, can_manage: false });
            }
        } catch (err) {
            console.error('Failed to check mileage access:', err);
            setAccess({ has_access: false, can_submit: false, can_view_all: false, can_manage: false });
        } finally {
            setLoading(false);
        }
    };

    const handleEntryCreated = useCallback(() => {
        setActiveTab('my-trips');
        setRefreshKey(k => k + 1);
    }, []);

    const handleEditEntry = useCallback((entryId: number) => {
        setEditingEntryId(entryId);
        setActiveTab('new-entry');
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingEntryId(null);
    }, []);

    if (loading) {
        return (
            <div className="ap-p-8 ap-flex ap-items-center ap-justify-center">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    if (!access?.has_access) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineExclamationTriangle className="ap-w-12 ap-h-12 ap-text-amber-500 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-amber-800 ap-mb-2">Access Restricted</h3>
                    <p className="ap-text-amber-600">
                        You don't have permission to access the Mileage Reimbursement module.
                        Please contact an administrator if you need access.
                    </p>
                </div>
            </div>
        );
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
        { 
            id: 'my-trips', 
            label: 'My Trips', 
            icon: <HiOutlineClipboardDocumentList className="ap-w-5 ap-h-5" />,
            show: access.can_submit
        },
        { 
            id: 'new-entry', 
            label: editingEntryId ? 'Edit Entry' : 'Log New Trip', 
            icon: <HiOutlinePlusCircle className="ap-w-5 ap-h-5" />,
            show: access.can_submit
        },
        { 
            id: 'reports', 
            label: 'Reports', 
            icon: <HiOutlineDocumentText className="ap-w-5 ap-h-5" />,
            show: access.can_view_all || access.can_submit
        },
        { 
            id: 'settings', 
            label: 'Settings', 
            icon: <HiOutlineCog6Tooth className="ap-w-5 ap-h-5" />,
            show: access.can_manage
        }
    ];

    return (
        <div className="ap-p-6">
            {/* Header */}
            <div className="ap-mb-6">
                <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-flex ap-items-center ap-gap-3">
                    <HiOutlineTruck className="ap-w-8 ap-h-8 ap-text-blue-600" />
                    Mileage Reimbursement
                </h1>
                <p className="ap-mt-1 ap-text-gray-600">
                    Track your business travel and submit mileage reimbursement requests.
                </p>
            </div>

            {/* Tabs */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-2 ap-mb-6">
                <nav className="ap-flex ap-flex-wrap ap-gap-2" aria-label="Tabs">
                    {tabs.filter(t => t.show).map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? 'tab-active' : 'tab'}
                            onClick={() => {
                                if (tab.id !== 'new-entry') {
                                    setEditingEntryId(null);
                                }
                                setActiveTab(tab.id);
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </Button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'my-trips' && (
                    <MileageEntryList 
                        key={refreshKey}
                        canViewAll={access.can_view_all}
                        canManage={access.can_manage}
                        onEdit={handleEditEntry}
                        onNewEntry={() => setActiveTab('new-entry')}
                    />
                )}
                
                {activeTab === 'new-entry' && (
                    <MileageEntryForm 
                        entryId={editingEntryId}
                        canManage={access.can_manage}
                        onSuccess={handleEntryCreated}
                        onCancel={handleCancelEdit}
                    />
                )}
                
                {activeTab === 'reports' && (
                    <MileageReportGenerator 
                        canViewAll={access.can_view_all}
                    />
                )}
                
                {activeTab === 'settings' && access.can_manage && (
                    <MileageSettings />
                )}
            </div>
        </div>
    );
};

export default MileageModule;
