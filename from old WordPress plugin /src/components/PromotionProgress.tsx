import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '@/utils/dateUtils';
import { UserProfile } from '@/types';
import {
    HiOutlineCheckCircle as CheckIcon,
    HiOutlineClock as ClockIcon,
    HiOutlineChartBar as ProgressIcon,
} from 'react-icons/hi2';
import {
    JobRole,
    UserProgress,
    InServiceSummary,
    getJobRoles,
    getUserProgress,
    getInServiceSummary,
    getScanAudits,
    getLiveDrills,
} from '@/services/api-professional-growth';
import LoadingSpinner from './LoadingSpinner';
import CriterionActivity from './CriterionActivity';

interface PromotionProgressProps {
    currentUser: UserProfile;
}

const PromotionProgress: React.FC<PromotionProgressProps> = ({ currentUser }) => {
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [progress, setProgress] = useState<UserProgress[]>([]);
    const [inServiceSummary, setInServiceSummary] = useState<InServiceSummary | null>(null);
    const [recentAudits, setRecentAudits] = useState<any[]>([]);
    const [recentDrills, setRecentDrills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadInitialData();
    }, [currentUser.id]);

    useEffect(() => {
        if (selectedRoleId) {
            loadProgressForRole(selectedRoleId);
        }
    }, [selectedRoleId, currentUser.id]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            
            // Load job roles
            const rolesData = await getJobRoles();
            console.log('Job roles loaded:', rolesData);
            setJobRoles(rolesData);
            
            // Auto-select first role if available
            if (rolesData.length > 0 && !selectedRoleId) {
                console.log('Auto-selecting first role:', rolesData[0]);
                setSelectedRoleId(Number(rolesData[0].id));
            }
            
            // Load in-service summary
            const summary = await getInServiceSummary(currentUser.id);
            setInServiceSummary(summary);
            
            // Load recent audits (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const audits = await getScanAudits({
                audited_user_id: currentUser.id,
                start_date: thirtyDaysAgo.toISOString().split('T')[0],
            });
            setRecentAudits(audits.slice(0, 3)); // Latest 3
            
            const drills = await getLiveDrills({
                drilled_user_id: currentUser.id,
                start_date: thirtyDaysAgo.toISOString().split('T')[0],
            });
            setRecentDrills(drills.slice(0, 3)); // Latest 3
            
            setError(null);
        } catch (err) {
            setError('Failed to load promotion data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadProgressForRole = async (roleId: number) => {
        try {
            console.log('Loading progress for role:', roleId, 'user:', currentUser.id);
            const progressData = await getUserProgress(currentUser.id, roleId);
            console.log('Progress data received:', progressData);
            setProgress(progressData);
        } catch (err) {
            console.error('Failed to load progress:', err);
            setError('Failed to load progress data. Please check console for details.');
        }
    };

    const calculateCompletionPercentage = () => {
        if (progress.length === 0) return 0;
        const completed = progress.filter(p => {
            // Only count as completed if is_completed is explicitly true/1/'1'
            return !!(p.is_completed && (p.is_completed === true || p.is_completed === 1 || p.is_completed === '1'));
        }).length;
        return Math.round((completed / progress.length) * 100);
    };

    const getCompletionColor = (percentage: number) => {
        if (percentage < 30) return 'ap-text-red-600 ap-bg-red-50';
        if (percentage < 80) return 'ap-text-yellow-600 ap-bg-yellow-50';
        if (percentage < 100) return 'ap-text-orange-600 ap-bg-orange-50';
        return 'ap-text-green-600 ap-bg-green-50';
    };

    const renderCriterionItem = (item: UserProgress) => {
        const isCompleted = !!(item.is_completed && (item.is_completed === true || item.is_completed === 1 || item.is_completed === '1'));
        const isCounter = item.criterion_type === 'counter';
        const isLinkedModule = item.criterion_type === 'linked_module';
        const hasTargetValue = item.target_value && item.target_value > 1;
        const showProgressBar = (isCounter || (isLinkedModule && hasTargetValue));
        const currentValue = item.current_value ? parseInt(String(item.current_value)) : 0;
        const targetValue = item.target_value ? parseInt(String(item.target_value)) : 1;

        return (
            <div
                key={item.criterion_id}
                className={`ap-p-4 ap-rounded-lg ap-border-2 ap-transition-all ${
                    isCompleted
                        ? 'ap-bg-green-50 ap-border-green-200' : 'ap-bg-white ap-border-gray-200 hover:ap-border-gray-300'
                }`}
            >
                <div className="ap-flex ap-items-start ap-justify-between">
                    <div className="ap-flex-1">
                        <div className="ap-flex ap-items-center">
                            {isCompleted ? (
                                <CheckIcon className="ap-h-5 ap-w-5 ap-text-green-600 ap-mr-2 ap-flex-shrink-0" />
                            ) : (
                                <ClockIcon className="ap-h-5 ap-w-5 ap-text-gray-400 ap-mr-2 ap-flex-shrink-0" />
                            )}
                            <h4 className={`ap-font-medium ${isCompleted ? 'ap-text-green-900' : 'ap-text-gray-900'}`}> 
                                {item.title}
                            </h4>
                        </div>
                        {item.description && (
                            <p className="ap-text-sm ap-text-gray-600 ap-mt-1 ap-ml-7">{item.description}</p>
                        )}
                        {showProgressBar && (
                            <div className="ap-mt-2 ap-ml-7">
                                <div className="ap-flex ap-items-center">
                                    <div className="ap-flex-1 ap-bg-gray-200 ap-rounded-full ap-h-2 ap-mr-3">
                                        <div
                                            className={`ap-h-2 ap-rounded-full ap-transition-all ${
                                                isCompleted ? 'ap-bg-green-600' : 'ap-bg-blue-600'
                                            }`}
                                            style={{ width: `${Math.min((currentValue / targetValue) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="ap-text-sm ap-font-medium ap-text-gray-700 ap-whitespace-nowrap">
                                        {currentValue} / {targetValue}
                                    </span>
                                </div>
                            </div>
                        )}
                        {item.completion_date && (
                            <p className="ap-text-xs ap-text-gray-500 ap-mt-2 ap-ml-7">
                                Completed: {formatLocalDate(item.completion_date)}
                            </p>
                        )}
                        
                        {/* Activity Log Component - Users can add notes, supervisors can approve */}
                        <div className="ap-mt-3 ap-ml-7">
                            <CriterionActivity
                                criterionId={item.criterion_id}
                                affectedUserId={currentUser.id}
                                criterionType={item.criterion_type || 'checkbox'}
                                currentValue={item.current_value}
                                targetValue={item.target_value}
                                isCompleted={isCompleted}
                                canEdit={true}
                                onRefresh={() => loadProgressForRole(selectedRoleId!)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                {error}
            </div>
        );
    }

    const completionPercentage = calculateCompletionPercentage();
    const selectedRole = jobRoles.find(r => Number(r.id) === Number(selectedRoleId));

    return (
        <div className="ap-space-y-6">
            {/* Header with Role Selector */}
            <div>
                <h2 className="ap-text-xl ap-font-bold ap-text-blue-600 ap-mb-4">My Promotion Progress</h2>
                
                <div className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-4">
                    <div className="ap-flex-1">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Track Progress For:
                        </label>
                        <select
                            value={selectedRoleId || ''}
                            onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                            className="ap-w-full ap-min-w-0 ap-px-4 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        >
                            {jobRoles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.title}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {selectedRole && (
                        <div className={`ap-flex ap-items-center ap-px-6 ap-py-4 ap-rounded-lg ${getCompletionColor(completionPercentage)}`}>
                            <ProgressIcon className="ap-h-8 ap-w-8 ap-mr-3" />
                            <div>
                                <div className="ap-text-sm ap-font-medium">Overall Progress</div>
                                <div className="ap-text-2xl ap-font-bold ap-text-blue-600 ap-font-bold">{completionPercentage}%</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* In-Service Training Summary */}
            {inServiceSummary && (
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                    <div className={`ap-p-4 ap-rounded-lg ap-border-2 ${
                        inServiceSummary.previous_meets_requirement
                            ? 'ap-bg-green-50 ap-border-green-200' : 'ap-bg-red-50 ap-border-red-200'
                    }`}>
                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Previous Month Training</h3>
                        <div className="ap-flex ap-items-baseline">
                            <span className="ap-text-3xl ap-font-bold">
                                {inServiceSummary.previous_month_hours}
                            </span>
                            <span className="ap-text-gray-600 ap-ml-2">/ {inServiceSummary.required_hours} hrs</span>
                        </div>
                        <p className={`ap-text-sm ap-mt-1 ${
                            inServiceSummary.previous_meets_requirement ? 'ap-text-green-700' : 'ap-text-red-700'
                        }`}>
                            {inServiceSummary.previous_meets_requirement ? '✓ Eligible ap-to work this month' : '✗ Did not meet requirement'}
                        </p>
                    </div>
                    
                    <div className={`ap-p-4 ap-rounded-lg ap-border-2 ${
                        inServiceSummary.current_meets_requirement
                            ? 'ap-bg-green-50 ap-border-green-200' : 'ap-bg-gray-50 ap-border-gray-200'
                    }`}>
                        <h3 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Current Month Progress</h3>
                        <div className="ap-flex ap-items-baseline">
                            <span className="ap-text-3xl ap-font-bold">
                                {inServiceSummary.current_month_hours}
                            </span>
                            <span className="ap-text-gray-600 ap-ml-2">/ {inServiceSummary.required_hours} hrs</span>
                        </div>
                        <p className={`ap-text-sm ap-mt-1 ${
                            inServiceSummary.current_meets_requirement ? 'ap-text-green-700' : 'ap-text-gray-600'
                        }`}>
                            {inServiceSummary.current_meets_requirement ? '✓ On track for next month' : 'Keep going!'}
                        </p>
                    </div>
                </div>
            )}

            {/* Recent Audits & Drills */}
            {(recentAudits.length > 0 || recentDrills.length > 0) && (
                <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                    <h3 className="ap-font-medium ap-text-blue-900 ap-mb-3">Recent Activity (Last 30 Days)</h3>
                    <div className="ap-space-y-2">
                        {recentAudits.map((audit, idx) => (
                            <div key={`audit-${idx}`} className="ap-text-sm">
                                <span className="ap-text-blue-800">📋 Scan Audit:</span>{' '}
                                <span className={audit.result.toLowerCase() === 'pass' || audit.result.toLowerCase() === 'passed' ? 'ap-text-green-700 ap-font-medium' : 'ap-text-gray-700'}>
                                    {audit.result}
                                </span>
                                <span className="ap-text-gray-600 ap-ml-2">
                                    ({new Date(audit.audit_date).toLocaleDateString()})
                                </span>
                            </div>
                        ))}
                        {recentDrills.map((drill, idx) => {
                            const resultLower = drill.result.toLowerCase();
                            const isPass = resultLower === 'pass' || resultLower === 'passed';
                            const isRemediation = resultLower.includes('remediation');
                            return (
                                <div key={`drill-${idx}`} className="ap-text-sm">
                                    <span className="ap-text-blue-800">🚨 Live Recognition Drill:</span>{' '}
                                    <span className={
                                        isPass ? 'text-green-700 font-medium' : 
                                        isRemediation ? 'ap-text-amber-700 ap-font-medium' : 'ap-text-red-700 ap-font-medium'
                                    }>
                                        {drill.result}
                                    </span>
                                    <span className="ap-text-gray-600 ap-ml-2">
                                        ({new Date(drill.drill_date).toLocaleDateString()})
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Promotion Criteria Checklist */}
            {selectedRole && (
                <div>
                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">
                        Requirements for {selectedRole.title}
                    </h3>
                    
                    {progress.length === 0 ? (
                        <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-8 ap-text-center">
                            <p className="ap-text-gray-600">
                                No promotion criteria defined yet for this role.
                            </p>
                        </div>
                    ) : (
                        <div className="ap-space-y-3">
                            {progress.map(renderCriterionItem)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PromotionProgress;
