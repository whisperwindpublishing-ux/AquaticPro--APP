import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { 
    HiOutlineDocumentArrowDown, 
    HiOutlineArrowDownTray,
    HiOutlineClipboardDocumentList,
    HiOutlineAcademicCap,
    HiOutlineCheckBadge,
    HiOutlineCalendar,
    HiOutlineSparkles,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import { FaSwimmer, FaLayerGroup } from 'react-icons/fa';
import { Button } from './ui/Button';

interface ExportType {
    id: string;
    name: string;
    description: string;
    count: number;
    endpoint: string;
}

interface LessonManagementExportProps {
    currentUser: UserProfile;
}

const LessonManagementExport: React.FC<LessonManagementExportProps> = () => {
    const [exportTypes, setExportTypes] = useState<ExportType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    // Check access on mount
    useEffect(() => {
        const checkAccess = async () => {
            // Admin always has access
            if (window.mentorshipPlatformData?.is_admin) {
                setHasAccess(true);
                return;
            }
            
            // Check lesson management permission
            try {
                const response = await fetch(`${apiUrl}/lesson-exports/types`, {
                    headers: { 'X-WP-Nonce': nonce },
                });
                setHasAccess(response.ok);
            } catch {
                setHasAccess(false);
            }
        };
        checkAccess();
    }, []);

    // Fetch export types
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const response = await fetch(`${apiUrl}/lesson-exports/types`, {
                    headers: { 'X-WP-Nonce': nonce },
                });
                if (response.ok) {
                    const data = await response.json();
                    setExportTypes(data);
                }
            } catch (err) {
                console.error('Failed to fetch export types:', err);
            } finally {
                setLoadingTypes(false);
            }
        };
        
        if (hasAccess !== false) {
            fetchTypes();
        } else {
            setLoadingTypes(false);
        }
    }, [hasAccess]);

    const handleDownload = async (exportType: ExportType) => {
        setDownloadingId(exportType.id);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(`${apiUrl}${exportType.endpoint}`, {
                headers: { 'X-WP-Nonce': nonce },
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.csv && data.filename) {
                // Create and download the CSV file
                const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', data.filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                setSuccessMessage(`Downloaded ${exportType.name} (${data.record_count} records)`);
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Download error:', err);
            setError(err instanceof Error ? err.message : 'Download failed');
        } finally {
            setDownloadingId(null);
        }
    };

    const getIcon = (typeId: string) => {
        switch (typeId) {
            case 'groups':
                return <FaLayerGroup className="ap-w-6 ap-h-6" />;
            case 'swimmers':
                return <FaSwimmer className="ap-w-6 ap-h-6" />;
            case 'evaluations':
                return <HiOutlineClipboardDocumentList className="ap-w-6 ap-h-6" />;
            case 'levels':
                return <HiOutlineAcademicCap className="ap-w-6 ap-h-6" />;
            case 'skills':
                return <HiOutlineCheckBadge className="ap-w-6 ap-h-6" />;
            case 'camps':
                return <HiOutlineCalendar className="ap-w-6 ap-h-6" />;
            case 'lesson-types':
                return <HiOutlineSparkles className="ap-w-6 ap-h-6" />;
            default:
                return <HiOutlineDocumentArrowDown className="ap-w-6 ap-h-6" />;
        }
    };

    const getColorClasses = (typeId: string) => {
        switch (typeId) {
            case 'groups':
                return 'ap-bg-blue-50 ap-border-blue-200 hover:ap-bg-blue-100';
            case 'swimmers':
                return 'ap-bg-cyan-50 ap-border-cyan-200 hover:ap-bg-cyan-100';
            case 'evaluations':
                return 'ap-bg-green-50 ap-border-green-200 hover:ap-bg-green-100';
            case 'levels':
                return 'ap-bg-purple-50 ap-border-purple-200 hover:ap-bg-purple-100';
            case 'skills':
                return 'ap-bg-amber-50 ap-border-amber-200 hover:ap-bg-amber-100';
            case 'camps':
                return 'ap-bg-rose-50 ap-border-rose-200 hover:ap-bg-rose-100';
            case 'lesson-types':
                return 'ap-bg-indigo-50 ap-border-indigo-200 hover:ap-bg-indigo-100';
            default:
                return 'ap-bg-gray-50 ap-border-gray-200 hover:ap-bg-gray-100';
        }
    };

    const getIconColorClass = (typeId: string) => {
        switch (typeId) {
            case 'groups':
                return 'ap-text-blue-600';
            case 'swimmers':
                return 'ap-text-cyan-600';
            case 'evaluations':
                return 'ap-text-green-600';
            case 'levels':
                return 'ap-text-purple-600';
            case 'skills':
                return 'ap-text-amber-600';
            case 'camps':
                return 'ap-text-rose-600';
            case 'lesson-types':
                return 'ap-text-indigo-600';
            default:
                return 'ap-text-gray-600';
        }
    };

    // Loading state
    if (hasAccess === null || loadingTypes) {
        return (
            <div className="ap-p-8">
                <div className="ap-animate-pulse ap-flex ap-space-x-4">
                    <div className="ap-flex-1 ap-space-y-4 ap-py-1">
                        <div className="ap-h-4 ap-bg-gray-200 ap-rounded ap-w-3/4"></div>
                        <div className="ap-space-y-2">
                            <div className="ap-h-4 ap-bg-gray-200 ap-rounded"></div>
                            <div className="ap-h-4 ap-bg-gray-200 ap-rounded ap-w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No access
    if (hasAccess === false) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineExclamationTriangle className="ap-w-12 ap-h-12 ap-text-amber-500 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-amber-800 ap-mb-2">Access Restricted</h3>
                    <p className="ap-text-amber-600">
                        You don't have permission to export Lesson Management data.
                        Please contact an administrator if you need access.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-p-4 sm:ap-p-6">
            {/* Header */}
            <div className="ap-mb-6">
                <h2 className="ap-text-xl sm:ap-text-2xl ap-font-bold ap-text-gray-900 ap-flex ap-flex-wrap ap-items-center ap-gap-2 sm:ap-gap-3">
                    <HiOutlineDocumentArrowDown className="ap-w-6 ap-h-6 sm:ap-w-7 sm:ap-h-7 ap-text-blue-600 ap-flex-shrink-0" />
                    <span>Lesson Management Exports</span>
                </h2>
                <p className="ap-mt-2 ap-text-sm sm:ap-text-base ap-text-gray-600">
                    Download complete CSV exports of your Lesson Management data. Click any card below for a one-click download.
                </p>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
                <div className="ap-mb-4 ap-p-3 ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-text-green-700 ap-flex ap-items-center ap-gap-2">
                    <HiOutlineDocumentArrowDown className="ap-w-5 ap-h-5" />
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="ap-mb-4 ap-p-3 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-text-red-700 ap-flex ap-items-center ap-gap-2">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5" />
                    {error}
                </div>
            )}

            {/* Export Cards Grid */}
            <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 lg:ap-grid-cols-3 xl:ap-grid-cols-4 ap-gap-4">
                {exportTypes.map((exportType) => (
                    <Button
                        key={exportType.id}
                        variant="ghost"
                        onClick={() => handleDownload(exportType)}
                        disabled={downloadingId !== null || exportType.count === 0}
                        className={`!ap-relative !ap-p-4 sm:!ap-p-5 !ap-rounded-lg !ap-border-2 !ap-transition-all !ap-duration-200 !ap-text-left !ap-cursor-pointer !ap-w-full !ap-flex !ap-flex-col !ap-h-auto !ap-min-h-0 ${getColorClasses(exportType.id)} ${downloadingId === exportType.id ? 'ap-ring-2 ap-ring-blue-400' : ''} ${exportType.count === 0 ? '!ap-opacity-50 !ap-cursor-not-allowed' : ''}`}
                    >
                        {/* Icon and Count Badge */}
                        <div className="ap-flex ap-flex-wrap ap-items-start ap-justify-between ap-gap-2 ap-mb-3">
                            <div className={`ap-flex-shrink-0 ${getIconColorClass(exportType.id)}`}>
                                {getIcon(exportType.id)}
                            </div>
                            <span className={` ap-px-2 ap-py-1 ap-text-xs ap-font-semibold ap-rounded-full ap-whitespace-nowrap ${exportType.count > 0 ? 'ap-bg-white ap-shadow-sm' : 'ap-bg-gray-100'} `}>
                                {exportType.count.toLocaleString()} records
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className="ap-text-base sm:ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-1 ap-break-words">
                            {exportType.name}
                        </h3>

                        {/* Description */}
                        <p className="ap-text-sm ap-text-gray-600 ap-mb-3 ap-flex-grow">
                            {exportType.description}
                        </p>

                        {/* Download Indicator */}
                        <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-2 ap-text-sm ap-font-medium ap-mt-auto">
                            {downloadingId === exportType.id ? (
                                <>
                                    <svg className="ap-animate-spin ap-w-4 ap-h-4 ap-text-blue-600 ap-flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="ap-text-blue-600">Downloading...</span>
                                </>
                            ) : exportType.count === 0 ? (
                                <span className="ap-text-gray-400">No data to export</span>
                            ) : (
                                <>
                                    <HiOutlineArrowDownTray className="ap-w-4 ap-h-4 ap-text-gray-500 ap-flex-shrink-0" />
                                    <span className="ap-text-gray-500">Click to download CSV</span>
                                </>
                            )}
                        </div>
                    </Button>
                ))}
            </div>

            {/* Empty State */}
            {exportTypes.length === 0 && !loadingTypes && (
                <div className="ap-text-center ap-py-12">
                    <HiOutlineDocumentArrowDown className="ap-w-16 ap-h-16 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-600 ap-mb-2">No Export Types Available</h3>
                    <p className="ap-text-gray-500">
                        No Lesson Management data types are configured for export.
                    </p>
                </div>
            )}

            {/* Info Footer */}
            <div className="ap-mt-8 ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-border ap-border-gray-200">
                <h4 className="ap-text-sm ap-font-semibold ap-text-gray-700 ap-mb-2">Export Information</h4>
                <ul className="ap-text-sm ap-text-gray-600 ap-space-y-2">
                    <li className="ap-flex ap-gap-2"><span className="ap-flex-shrink-0">•</span><span>All exports are in CSV format, compatible with Excel and Google Sheets</span></li>
                    <li className="ap-flex ap-gap-2"><span className="ap-flex-shrink-0">•</span><span>Exports include all published records - archived items may be excluded</span></li>
                    <li className="ap-flex ap-gap-2"><span className="ap-flex-shrink-0">•</span><span>Related data (like level names for swimmers) is resolved to display names</span></li>
                    <li className="ap-flex ap-gap-2"><span className="ap-flex-shrink-0">•</span><span>Large exports may take a few moments to generate</span></li>
                </ul>
            </div>
        </div>
    );
};

export default LessonManagementExport;
