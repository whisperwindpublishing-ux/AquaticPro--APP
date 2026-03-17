/**
 * CertificateBanner — Dashboard banner for certificate alerts
 *
 * Shows a coloured gradient banner when the current user has:
 *   - Red: expired or missing certificates
 *   - Yellow: certificates expiring within 2 months
 *   - Blue: certificates pending review (for approvers)
 *
 * Auto-dismisses for 24 hours when the user clicks the X.
 */

import React, { useState, useEffect } from 'react';
import { View } from '@/App';
import {
    HiOutlineXMark,
    HiOutlineChevronRight,
    HiOutlineExclamationTriangle,
    HiOutlineXCircle,
} from 'react-icons/hi2';
import { Button } from '../ui/Button';
import type { CertAlerts } from '@/services/certificateService';
import { getMyAlerts } from '@/services/certificateService';

const DISMISS_KEY = 'certBannerDismissed';

interface CertificateBannerProps {
    onNavigate: (view: View) => void;
}

const CertificateBanner: React.FC<CertificateBannerProps> = ({ onNavigate }) => {
    const [alerts, setAlerts] = useState<CertAlerts | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        (async () => {
            // Check local dismissal
            const ts = localStorage.getItem(DISMISS_KEY);
            if (ts) {
                const elapsed = Date.now() - parseInt(ts, 10);
                if (elapsed < 24 * 60 * 60 * 1000) {
                    setIsDismissed(true);
                    setIsLoading(false);
                    return;
                }
                localStorage.removeItem(DISMISS_KEY);
            }

            try {
                const data = await getMyAlerts();
                setAlerts(data);
            } catch (err) {
                console.error('CertificateBanner: failed to load alerts', err);
            }
            setIsLoading(false);
        })();
    }, []);

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
    };

    if (isDismissed || isLoading || !alerts) return null;

    const hasExpired = (alerts.expired?.length ?? 0) > 0;
    const hasExpiring = (alerts.expiringSoon?.length ?? 0) > 0;
    const hasMissing = (alerts.missing?.length ?? 0) > 0;

    if (!hasExpired && !hasExpiring && !hasMissing) return null;

    // Priority: red if expired or missing, else yellow if expiring
    const isRed = hasExpired || hasMissing;

    const gradientClasses = isRed
        ? 'ap-from-red-500 ap-to-rose-600'
        : 'ap-from-amber-500 ap-to-yellow-600';

    const totalIssues = (alerts.expired?.length ?? 0) + (alerts.expiringSoon?.length ?? 0) + (alerts.missing?.length ?? 0);

    return (
        <div className={`ap-bg-gradient-to-r ${gradientClasses} ap-text-white ap-rounded-lg ap-shadow-lg ap-mb-6 ap-overflow-hidden`}>
            <div className="ap-px-4 ap-py-3 ap-flex ap-items-center ap-justify-between">
                <div className="ap-flex ap-items-center ap-gap-3">
                    <div className="ap-bg-white/20 ap-rounded-full ap-p-2">
                        {isRed ? (
                            <HiOutlineXCircle className="ap-w-6 ap-h-6" />
                        ) : (
                            <HiOutlineExclamationTriangle className="ap-w-6 ap-h-6" />
                        )}
                    </div>
                    <div>
                        <h3 className="ap-font-semibold ap-text-lg">
                            {totalIssues} certificate{totalIssues !== 1 ? 's' : ''} need{totalIssues === 1 ? 's' : ''} attention
                        </h3>
                        <p className="ap-text-white/80 ap-text-sm">
                            {hasMissing && (
                                <span className="ap-font-medium">
                                    {alerts.missing?.length ?? 0} missing
                                </span>
                            )}
                            {hasMissing && hasExpired && ' • '}
                            {hasExpired && (
                                <span className="ap-font-medium">
                                    {alerts.expired?.length ?? 0} expired
                                </span>
                            )}
                            {(hasMissing || hasExpired) && hasExpiring && ' • '}
                            {hasExpiring && (
                                <span>
                                    {alerts.expiringSoon?.length ?? 0} expiring soon
                                </span>
                            )}
                            {' — '}Click to view your certificates
                        </p>
                    </div>
                </div>
                <div className="ap-flex ap-items-center ap-gap-2">
                    <Button
                        onClick={() => onNavigate('certificates')}
                        variant="secondary"
                        className="!ap-bg-white !ap-text-gray-700 hover:!ap-bg-gray-100"
                        rightIcon={<HiOutlineChevronRight className="ap-w-4 ap-h-4" />}
                    >
                        View Certificates
                    </Button>
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        size="sm"
                        className="!ap-text-white hover:!ap-bg-white/20"
                        aria-label="Dismiss notification"
                    >
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>
            </div>

            {/* Show names of expired/expiring certs */}
            {totalIssues <= 6 && (
                <div className="ap-bg-black/10 ap-px-4 ap-py-2 ap-border-t ap-border-white/10">
                    <div className="ap-flex ap-flex-wrap ap-gap-2">
                        {alerts.missing.map(c => (
                            <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-sm">
                                <span className="ap-text-red-200 ap-font-medium">MISSING</span> {c.certificateName}
                            </span>
                        ))}
                        {alerts.expired.map(c => (
                            <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-sm">
                                <span className="ap-text-red-200 ap-font-medium">EXPIRED</span> {c.certificateName}
                            </span>
                        ))}
                        {alerts.expiringSoon.map(c => (
                            <span key={c.id} className="ap-bg-white/20 ap-px-2 ap-py-1 ap-rounded ap-text-sm">
                                <span className="ap-text-yellow-200">Expiring</span> {c.certificateName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CertificateBanner;
