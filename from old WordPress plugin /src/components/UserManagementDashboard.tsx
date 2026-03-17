import React from 'react';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import CriteriaManagement from './CriteriaManagement';
import TimeSlotManagement from './TimeSlotManagement';
import LocationManagement from './LocationManagement';
import DailyLogImport from './DailyLogImport';

export type UserMgmtView = 'users-list' | 'role-management' | 'criteria-management' | 'time-slot-management' | 'location-management' | 'daily-log-import';

interface UserManagementDashboardProps {
    onBack: () => void;
    isAdmin: boolean;
    subView: UserMgmtView;
    onSubViewChange: (view: UserMgmtView) => void;
    initialSearch?: string;
    returnToPage?: string | null;
    onClearReturn?: () => void;
    enableSeasonalReturns?: boolean;
}

const UserManagementDashboard: React.FC<UserManagementDashboardProps> = ({ 
    onBack: _onBack, 
    isAdmin: _isAdmin,
    subView,
    onSubViewChange: _onSubViewChange,
    initialSearch = '',
    returnToPage = null,
    onClearReturn,
    enableSeasonalReturns = true
}) => {

    const renderContent = () => {
        switch (subView) {
            case 'users-list':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <UserManagement 
                            initialSearch={initialSearch}
                            returnToPage={returnToPage}
                            onClearReturn={onClearReturn}
                            enableSeasonalReturns={enableSeasonalReturns}
                        />
                    </div>
                );
            case 'role-management':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <RoleManagement />
                    </div>
                );
            case 'criteria-management':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <CriteriaManagement />
                    </div>
                );
            case 'location-management':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <LocationManagement />
                    </div>
                );
            case 'time-slot-management':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <TimeSlotManagement />
                    </div>
                );
            case 'daily-log-import':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200 ap-p-6 ap-w-full">
                        <DailyLogImport />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="ap-flex-1 ap-min-w-0">
            {renderContent()}
        </div>
    );
};

export default UserManagementDashboard;
