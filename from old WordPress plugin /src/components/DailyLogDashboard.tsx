import React, { useState } from 'react';
import { UserProfile, DailyLog } from '@/types';
import DailyLogList from './DailyLogList';
import DailyLogForm from './DailyLogForm';

export type DailyLogView = 'read-all' | 'my-logs' | 'create-edit';

interface DailyLogDashboardProps {
    currentUser: UserProfile;
    onBack: () => void;
    subView: DailyLogView;
    onSubViewChange: (view: DailyLogView) => void;
}

/**
 * DailyLogDashboard - Display daily logs based on external subview state
 * 
 * Views:
 * - Read All: Blog-style view of all team logs (read-only)
 * - My Logs: User's own logs (manage/edit)
 * - Create/Edit: Inline form for creating or editing a log
 */
const DailyLogDashboard: React.FC<DailyLogDashboardProps> = ({ 
    currentUser, 
    onBack: _onBack,
    subView,
    onSubViewChange
}) => {
    const [editingLog, setEditingLog] = useState<DailyLog | null>(null);

    const handleCreateNew = () => {
        setEditingLog(null);
        onSubViewChange('create-edit');
    };

    const handleEditLog = (log: DailyLog) => {
        setEditingLog(log);
        onSubViewChange('create-edit');
    };

    const handleFormSuccess = () => {
        setEditingLog(null);
        onSubViewChange('my-logs');
    };

    const handleFormCancel = () => {
        setEditingLog(null);
        onSubViewChange(subView === 'create-edit' ? 'my-logs' : subView);
    };

    const renderContent = () => {
        switch (subView) {
            case 'read-all':
                return (
                    <div className="ap-w-full">
                        <DailyLogList 
                            currentUser={currentUser} 
                            filterByCurrentUser={false}
                            showCreateButton={true}
                            readOnlyMode={false}
                            onCreateNew={handleCreateNew}
                            onEditLog={handleEditLog}
                        />
                    </div>
                );
            case 'my-logs':
                return (
                    <div className="ap-w-full">
                        <DailyLogList 
                            currentUser={currentUser} 
                            filterByCurrentUser={true}
                            showCreateButton={true}
                            onCreateNew={handleCreateNew}
                            onEditLog={handleEditLog}
                        />
                    </div>
                );
            case 'create-edit':
                return (
                    <div className="ap-w-full md:ap-bg-white md:ap-rounded-lg md:ap-shadow-sm md:ap-border md:ap-border-gray-200 md:ap-p-6">
                        <DailyLogForm
                            currentUser={currentUser}
                            editingLog={editingLog}
                            onSuccess={handleFormSuccess}
                            onCancel={handleFormCancel}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="ap-w-full">
            {renderContent()}
        </div>
    );
};

export default DailyLogDashboard;
