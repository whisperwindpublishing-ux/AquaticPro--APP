import React from 'react';
import { UserProfile } from '@/types';
import PromotionProgress from './PromotionProgress';
import TeamView from './TeamView';
import InServiceLog from './InServiceLog';
import ScanAuditsView from './ScanAuditsView';
import LiveDrillsView from './LiveDrillsView';
import CashierAuditsView from './CashierAuditsView';
import InstructorEvaluationsView from './InstructorEvaluationsView';

export type CareerDevView = 'promotion-progress' | 'team-view' | 'inservice-log' | 'scan-audits' | 'live-drills' | 'cashier-audits' | 'instructor-evaluations';

interface CareerDevelopmentProps {
    currentUser: UserProfile;
    onBack: () => void;
    isAdmin: boolean;
    subView: CareerDevView;
    onSubViewChange: (view: CareerDevView) => void;
}

const CareerDevelopment: React.FC<CareerDevelopmentProps> = ({ 
    currentUser, 
    onBack: _onBack, 
    isAdmin,
    subView,
    onSubViewChange: _onSubViewChange
}) => {

    const renderContent = () => {
        switch (subView) {
            case 'promotion-progress':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6">
                        <PromotionProgress currentUser={currentUser} />
                    </div>
                );
            case 'team-view':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6">
                        <TeamView />
                    </div>
                );
            case 'inservice-log':
                return (
                    <div className="ap-bg-white ap-rounded-lg ap-shadow ap-p-6">
                        <InServiceLog currentUser={currentUser} />
                    </div>
                );
            case 'scan-audits':
                return (
                    <ScanAuditsView currentUser={{ 
                        id: currentUser.id, 
                        name: `${currentUser.firstName} ${currentUser.lastName}`, 
                        isAdmin 
                    }} />
                );
            case 'live-drills':
                return (
                    <LiveDrillsView currentUser={{ 
                        id: currentUser.id, 
                        name: `${currentUser.firstName} ${currentUser.lastName}`, 
                        isAdmin 
                    }} />
                );
            case 'cashier-audits':
                return (
                    <CashierAuditsView currentUser={{ 
                        id: currentUser.id, 
                        name: `${currentUser.firstName} ${currentUser.lastName}`, 
                        isAdmin 
                    }} />
                );
            case 'instructor-evaluations':
                return (
                    <InstructorEvaluationsView currentUser={{ 
                        id: currentUser.id, 
                        name: `${currentUser.firstName} ${currentUser.lastName}`, 
                        isAdmin 
                    }} />
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

export default CareerDevelopment;
