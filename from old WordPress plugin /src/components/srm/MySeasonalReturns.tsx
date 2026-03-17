import React, { useEffect, useState } from 'react';
import {
    HiOutlineCalendarDays,
    HiOutlineCurrencyDollar,
    HiOutlineBriefcase,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import { getMyReturns, MyReturnSeason, MyReturnsData } from '@/services/seasonalReturnsService';
import { PayBreakdown } from '@/types';

const MySeasonalReturns: React.FC = () => {
    const [data, setData] = useState<MyReturnsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getMyReturns();
            setData(result);
            // Auto-expand the most recent season
            if (result.seasons.length > 0) {
                setExpandedSeason(result.seasons[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load seasonal return data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="ap-animate-pulse ap-space-y-3">
                <div className="ap-h-6 ap-bg-gray-200 ap-rounded ap-w-48"></div>
                <div className="ap-h-24 ap-bg-gray-200 ap-rounded"></div>
                <div className="ap-h-24 ap-bg-gray-200 ap-rounded"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-500 ap-flex-shrink-0 ap-mt-0.5" />
                <div>
                    <p className="ap-text-sm ap-font-medium ap-text-red-800">Unable to load return data</p>
                    <p className="ap-text-xs ap-text-red-600 ap-mt-1">{error}</p>
                </div>
            </div>
        );
    }

    if (!data || data.seasons.length === 0) {
        return (
            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-6 ap-text-center">
                <HiOutlineCalendarDays className="ap-w-10 ap-h-10 ap-text-gray-300 ap-mx-auto ap-mb-2" />
                <p className="ap-text-sm ap-text-gray-500">No seasonal return invitations yet.</p>
            </div>
        );
    }

    return (
        <div className="ap-space-y-4">
            {/* Current Pay Summary — only show if we have pay data */}
            {data.pay_breakdown && (
                <PaySummaryCard pay={data.pay_breakdown} jobRoles={data.job_roles} />
            )}

            {/* Season Cards */}
            <div className="ap-space-y-3">
                {data.seasons.map((season) => (
                    <SeasonCard
                        key={season.id}
                        season={season}
                        isExpanded={expandedSeason === season.id}
                        onToggle={() => setExpandedSeason(expandedSeason === season.id ? null : season.id)}
                    />
                ))}
            </div>
        </div>
    );
};

// ============================================
// Pay Summary Card
// ============================================

const PaySummaryCard: React.FC<{
    pay: PayBreakdown;
    jobRoles: Array<{ id: number; title: string; tier: number }>;
}> = ({ pay, jobRoles }) => {
    return (
        <div className="ap-bg-gradient-to-r ap-from-emerald-50 ap-to-teal-50 ap-border ap-border-emerald-200 ap-rounded-lg ap-p-4">
            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-3">
                <HiOutlineCurrencyDollar className="ap-w-5 ap-h-5 ap-text-emerald-600" />
                <h4 className="ap-text-sm ap-font-semibold ap-text-emerald-900">Current Pay Rate</h4>
            </div>

            <div className="ap-grid ap-grid-cols-2 sm:ap-grid-cols-4 ap-gap-3">
                <div className="ap-text-center">
                    <p className="ap-text-xs ap-text-gray-500">Base Rate</p>
                    <p className="ap-text-lg ap-font-bold ap-text-gray-900">${pay.base_rate.toFixed(2)}</p>
                </div>
                {pay.role_bonus?.amount > 0 && (
                    <div className="ap-text-center">
                        <p className="ap-text-xs ap-text-gray-500">Role Bonus</p>
                        <p className="ap-text-lg ap-font-bold ap-text-purple-700">+${pay.role_bonus.amount.toFixed(2)}</p>
                        <p className="ap-text-xs ap-text-purple-500">{pay.role_bonus.role_name}</p>
                    </div>
                )}
                {pay.longevity?.bonus > 0 && (
                    <div className="ap-text-center">
                        <p className="ap-text-xs ap-text-gray-500">Longevity</p>
                        <p className="ap-text-lg ap-font-bold ap-text-blue-700">+${pay.longevity.bonus.toFixed(2)}</p>
                        <p className="ap-text-xs ap-text-blue-500">{pay.longevity.years} yr{pay.longevity.years !== 1 ? 's' : ''}</p>
                    </div>
                )}
                <div className="ap-text-center">
                    <p className="ap-text-xs ap-text-gray-500">Total</p>
                    <p className="ap-text-lg ap-font-bold ap-text-emerald-700">${pay.total.toFixed(2)}/hr</p>
                    {pay.is_capped && (
                        <p className="ap-text-xs ap-text-amber-600 ap-font-medium">Capped</p>
                    )}
                </div>
            </div>

            {/* Time bonuses */}
            {pay.time_bonuses && pay.time_bonuses.length > 0 && (
                <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-emerald-200">
                    <p className="ap-text-xs ap-text-gray-500 ap-mb-1">Time Bonuses</p>
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        {pay.time_bonuses.map((tb) => (
                            <span key={tb.id} className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-bg-emerald-100 ap-text-emerald-700">
                                {tb.name}: +${tb.amount.toFixed(2)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Job Roles */}
            {jobRoles.length > 0 && (
                <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-emerald-200">
                    <div className="ap-flex ap-items-center ap-gap-1.5 ap-mb-1">
                        <HiOutlineBriefcase className="ap-w-3.5 ap-h-3.5 ap-text-gray-500" />
                        <p className="ap-text-xs ap-text-gray-500">Job Roles</p>
                    </div>
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        {jobRoles.map((role) => (
                            <span key={role.id} className="ap-inline-flex ap-items-center ap-px-2 ap-py-0.5 ap-rounded ap-text-xs ap-bg-purple-100 ap-text-purple-700">
                                {role.title}
                                <span className="ap-ml-1 ap-text-purple-400">T{role.tier}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// Season Card
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { icon: React.ReactNode; label: string; classes: string }> = {
        returning: {
            icon: <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />,
            label: 'Returning',
            classes: 'ap-bg-green-100 ap-text-green-800',
        },
        not_returning: {
            icon: <HiOutlineXCircle className="ap-w-4 ap-h-4" />,
            label: 'Not Returning',
            classes: 'ap-bg-red-100 ap-text-red-800',
        },
        pending: {
            icon: <HiOutlineClock className="ap-w-4 ap-h-4" />,
            label: 'Pending',
            classes: 'ap-bg-yellow-100 ap-text-yellow-800',
        },
        ineligible: {
            icon: <HiOutlineExclamationTriangle className="ap-w-4 ap-h-4" />,
            label: 'Ineligible',
            classes: 'ap-bg-gray-100 ap-text-gray-600',
        },
    };

    const c = config[status] || config.pending;

    return (
        <span className={`ap-inline-flex ap-items-center ap-gap-1 ap-px-2.5 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ${c.classes}`}>
            {c.icon}
            {c.label}
        </span>
    );
};

const SeasonCard: React.FC<{
    season: MyReturnSeason;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ season, isExpanded, onToggle }) => {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
            {/* Header — always visible */}
            <button
                onClick={onToggle}
                className="ap-w-full ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-3 ap-bg-white hover:ap-bg-gray-50 ap-transition-colors ap-text-left"
            >
                <div className="ap-flex ap-items-center ap-gap-3">
                    <HiOutlineCalendarDays className="ap-w-5 ap-h-5 ap-text-gray-400" />
                    <div>
                        <p className="ap-text-sm ap-font-semibold ap-text-gray-900">
                            {season.season_name}
                            {season.is_current && (
                                <span className="ap-ml-2 ap-text-xs ap-font-normal ap-text-blue-600">(Current)</span>
                            )}
                        </p>
                        <p className="ap-text-xs ap-text-gray-500">
                            {formatDate(season.start_date)} — {formatDate(season.end_date)}
                        </p>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-3">
                    <StatusBadge status={season.status} />
                    {isExpanded ? (
                        <HiOutlineChevronUp className="ap-w-4 ap-h-4 ap-text-gray-400" />
                    ) : (
                        <HiOutlineChevronDown className="ap-w-4 ap-h-4 ap-text-gray-400" />
                    )}
                </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
                <div className="ap-border-t ap-border-gray-200 ap-px-4 ap-py-3 ap-bg-gray-50">
                    <dl className="ap-grid ap-grid-cols-2 ap-gap-x-6 ap-gap-y-3 ap-text-sm">
                        <div>
                            <dt className="ap-text-xs ap-text-gray-500">Status</dt>
                            <dd className="ap-font-medium ap-text-gray-900 ap-capitalize">
                                {season.status.replace('_', ' ')}
                            </dd>
                        </div>
                        <div>
                            <dt className="ap-text-xs ap-text-gray-500">Response Date</dt>
                            <dd className="ap-font-medium ap-text-gray-900">
                                {season.response_date
                                    ? formatDate(season.response_date)
                                    : <span className="ap-text-gray-400 ap-italic">Not yet responded</span>
                                }
                            </dd>
                        </div>
                        <div>
                            <dt className="ap-text-xs ap-text-gray-500">Eligible for Rehire</dt>
                            <dd className="ap-font-medium ap-text-gray-900">
                                {season.eligible_for_rehire ? 'Yes' : 'No'}
                            </dd>
                        </div>
                        <div>
                            <dt className="ap-text-xs ap-text-gray-500">Longevity</dt>
                            <dd className="ap-font-medium ap-text-gray-900">
                                {season.longevity_years} year{season.longevity_years !== 1 ? 's' : ''}
                            </dd>
                        </div>
                        {season.comments && (
                            <div className="ap-col-span-2">
                                <dt className="ap-text-xs ap-text-gray-500">Your Comments</dt>
                                <dd className="ap-text-gray-700 ap-mt-0.5">{season.comments}</dd>
                            </div>
                        )}
                        <div className="ap-col-span-2">
                            <dt className="ap-text-xs ap-text-gray-500">Invited On</dt>
                            <dd className="ap-font-medium ap-text-gray-900">{formatDate(season.created_at)}</dd>
                        </div>
                    </dl>
                </div>
            )}
        </div>
    );
};

export default MySeasonalReturns;
