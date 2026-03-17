import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui';
import { 
    HiOutlineEnvelope,
    HiOutlineMagnifyingGlass,
    HiOutlinePaperAirplane,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineDocumentText,
    HiOutlineArrowPath,
    HiOutlineXMark,
    HiOutlineArrowUturnLeft,
} from 'react-icons/hi2';
import LoadingSpinner from '../LoadingSpinner';
import { Evaluation, Level } from '@/types/lessons';
import { fetchSwimmersByIds, CachedSwimmer } from '@/services/swimmerCache';

interface EmailEvaluationsProps {
    apiUrl: string;
    nonce: string;
}

interface PaginatedData<T> {
    items: T[];
    page: number;
    totalPages: number;
}

interface BatchSendResult {
    success: number;
    failed: { id: number; name: string; error: string }[];
}

const EmailEvaluations: React.FC<EmailEvaluationsProps> = ({ apiUrl, nonce }) => {
    const [evaluations, setEvaluations] = useState<PaginatedData<Evaluation>>({ items: [], page: 0, totalPages: 1 });
    const [swimmers, setSwimmers] = useState<Map<number, CachedSwimmer>>(new Map());
    const [levels, setLevels] = useState<Level[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'sent'>('pending');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Batch send state
    const [isBatchSending, setIsBatchSending] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);
    const [batchTotal, setBatchTotal] = useState(0);
    const [showBatchResults, setShowBatchResults] = useState(false);
    const [batchResults, setBatchResults] = useState<BatchSendResult | null>(null);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // Load levels for display
    useEffect(() => {
        const loadLevels = async () => {
            try {
                const response = await fetch(`${apiUrl}wp/v2/lm-level?per_page=100`, {
                    headers: {
                        'X-WP-Nonce': nonce,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setLevels(data);
                }
            } catch (err) {
                console.error('Error loading levels:', err);
            }
        };
        loadLevels();
    }, [apiUrl, nonce]);

    // Load evaluations
    const loadEvaluations = useCallback(async (reset = false) => {
        if (isLoading) return;
        
        const isNewSearch = reset || (evaluations.page === 0 && evaluations.items.length === 0);
        const nextPage = isNewSearch ? 1 : evaluations.page + 1;

        if (!isNewSearch && evaluations.page >= evaluations.totalPages) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let path = `${apiUrl}wp/v2/lm-evaluation?context=edit&per_page=20&page=${nextPage}`;
            if (searchTerm) {
                path += `&search=${encodeURIComponent(searchTerm)}`;
            }
            // Note: Filter by emailed status would need custom meta query support in REST API
            // For now, we'll filter client-side

            const response = await fetch(path, {
                headers: {
                    'X-WP-Nonce': nonce,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load evaluations');
            }

            const data: Evaluation[] = await response.json();
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

            setEvaluations(prev => ({
                items: isNewSearch ? data : [...prev.items, ...data],
                page: nextPage,
                totalPages,
            }));

            // Load swimmer details for evaluations using batch fetch
            const swimmerIds = data
                .map(e => e.meta?.swimmer)
                .filter((id): id is number => !!id && !swimmers.has(id));

            if (swimmerIds.length > 0) {
                const uniqueIds = [...new Set(swimmerIds)];
                try {
                    const swimmerData = await fetchSwimmersByIds(uniqueIds);
                    setSwimmers(prev => {
                        const next = new Map(prev);
                        swimmerData.forEach(s => next.set(s.id, s));
                        return next;
                    });
                } catch (swimmerErr) {
                    console.error('Error loading swimmers:', swimmerErr);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, nonce, evaluations, searchTerm, isLoading, swimmers]);

    // Load initial data
    useEffect(() => {
        if (evaluations.items.length === 0 && !isLoading) {
            loadEvaluations(true);
        }
    }, []);

    // Handle search and filter changes
    useEffect(() => {
        const handler = setTimeout(() => {
            setEvaluations({ items: [], page: 0, totalPages: 1 });
            setSelectedIds(new Set());
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Reload when evaluations reset
    useEffect(() => {
        if (evaluations.items.length === 0 && !isLoading && evaluations.page === 0) {
            loadEvaluations(true);
        }
    }, [evaluations.items.length]);

    const getLevelName = (levelId: number): string => {
        const level = levels.find(l => l.id === levelId);
        return level?.title?.rendered || 'Unknown Level';
    };

    const getSwimmer = (swimmerId: number): CachedSwimmer | undefined => {
        return swimmers.get(swimmerId);
    };

    const formatDate = (dateString: string): string => {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const sendEmail = async (evaluationId: number) => {
        const evaluation = evaluations.items.find(e => e.id === evaluationId);
        if (!evaluation) return;

        const swimmer = evaluation.meta?.swimmer ? getSwimmer(evaluation.meta.swimmer) : null;
        if (!swimmer?.meta?.parent_email) {
            setError('No parent email found for this swimmer');
            return;
        }

        setIsSending(evaluationId);
        setError(null);

        try {
            // Call the email endpoint
            const response = await fetch(`${apiUrl}lm/v1/evaluations/${evaluationId}/send-email`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send email');
            }

            // Update the evaluation in the list
            setEvaluations(prev => ({
                ...prev,
                items: prev.items.map(e => 
                    e.id === evaluationId 
                        ? { ...e, meta: { ...e.meta, emailed: true } }
                        : e
                ),
            }));

            setSuccessMessage('Email sent successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send email');
        } finally {
            setIsSending(null);
        }
    };

    // Send all pending emails
    const sendAllEmails = async () => {
        // Get all pending evaluations that have valid parent emails
        const pendingEvaluations = evaluations.items.filter(e => {
            if (e.meta?.emailed) return false;
            const swimmer = e.meta?.swimmer ? getSwimmer(e.meta.swimmer) : null;
            return swimmer?.meta?.parent_email;
        });

        if (pendingEvaluations.length === 0) {
            setError('No pending evaluations with valid parent emails');
            return;
        }

        setIsBatchSending(true);
        setBatchProgress(0);
        setBatchTotal(pendingEvaluations.length);
        setError(null);

        const results: BatchSendResult = { success: 0, failed: [] };

        for (let i = 0; i < pendingEvaluations.length; i++) {
            const evaluation = pendingEvaluations[i];
            const swimmer = evaluation.meta?.swimmer ? getSwimmer(evaluation.meta.swimmer) : null;
            const swimmerName = swimmer?.title?.rendered || `Evaluation #${evaluation.id}`;

            try {
                const response = await fetch(`${apiUrl}lm/v1/evaluations/${evaluation.id}/send-email`, {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': nonce,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    results.failed.push({
                        id: evaluation.id,
                        name: swimmerName,
                        error: errorData.message || 'Failed to send',
                    });
                } else {
                    results.success++;
                    // Update the evaluation in the list
                    setEvaluations(prev => ({
                        ...prev,
                        items: prev.items.map(e => 
                            e.id === evaluation.id 
                                ? { ...e, meta: { ...e.meta, emailed: true } }
                                : e
                        ),
                    }));
                }
            } catch (err) {
                results.failed.push({
                    id: evaluation.id,
                    name: swimmerName,
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }

            setBatchProgress(i + 1);
            
            // Small delay between emails to avoid rate limiting
            if (i < pendingEvaluations.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        setIsBatchSending(false);
        setBatchResults(results);
        setShowBatchResults(true);
    };

    // Retry failed emails
    const retryFailedEmails = async () => {
        if (!batchResults || batchResults.failed.length === 0) return;
        
        setShowBatchResults(false);
        setBatchResults(null);
        
        // Re-run batch send - the failed ones will be picked up since they weren't marked as sent
        sendAllEmails();
    };

    // Multi-select helpers
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEvaluations.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEvaluations.map(e => e.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    // Bulk update emailed flag
    const bulkUpdateEmailed = async (emailed: boolean) => {
        if (selectedIds.size === 0) return;

        const visitorMode = (window as any).mentorshipPlatformData?.visitor_mode;
        if (visitorMode) {
            alert('This feature is disabled in Visitor Mode.');
            return;
        }

        setIsBulkUpdating(true);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}lm/v1/evaluations/bulk-update-emailed`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ids: [...selectedIds],
                    emailed,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update evaluations');
            }

            const data = await response.json();

            // Update local state
            setEvaluations(prev => ({
                ...prev,
                items: prev.items.map(e =>
                    selectedIds.has(e.id)
                        ? { ...e, meta: { ...e.meta, emailed } }
                        : e
                ),
            }));

            setSelectedIds(new Set());
            const action = emailed ? 'marked as sent' : 'moved back to queue';
            setSuccessMessage(`${data.updated} evaluation(s) ${action}`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update evaluations');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    // Resend a single evaluation (mark as unsent, then send)
    const resendEmail = async (evaluationId: number) => {
        const evaluation = evaluations.items.find(e => e.id === evaluationId);
        if (!evaluation) return;

        const swimmer = evaluation.meta?.swimmer ? getSwimmer(evaluation.meta.swimmer) : null;
        if (!swimmer?.meta?.parent_email) {
            setError('No parent email found for this swimmer');
            return;
        }

        setIsSending(evaluationId);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}lm/v1/evaluations/${evaluationId}/send-email`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to resend email');
            }

            setEvaluations(prev => ({
                ...prev,
                items: prev.items.map(e =>
                    e.id === evaluationId
                        ? { ...e, meta: { ...e.meta, emailed: true } }
                        : e
                ),
            }));

            setSuccessMessage('Email resent successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend email');
        } finally {
            setIsSending(null);
        }
    };

    // Filter evaluations based on status
    const filteredEvaluations = evaluations.items.filter(e => {
        if (filterStatus === 'pending') return !e.meta?.emailed;
        if (filterStatus === 'sent') return e.meta?.emailed;
        return true;
    });

    const pendingCount = evaluations.items.filter(e => !e.meta?.emailed).length;
    const sentCount = evaluations.items.filter(e => e.meta?.emailed).length;

    return (
        <div className="ap-space-y-6">
            {/* Batch Send Progress Overlay */}
            {isBatchSending && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-bg-black/50">
                    <div className="ap-bg-white ap-rounded-2xl ap-shadow-xl ap-p-6 ap-w-full ap-max-w-md">
                        <div className="ap-flex ap-items-center ap-gap-3 ap-mb-4">
                            <div className="ap-p-2 ap-bg-blue-100 ap-rounded-lg ap-animate-pulse">
                                <HiOutlineEnvelope className="ap-w-6 ap-h-6 ap-text-blue-600" />
                            </div>
                            <div>
                                <h3 className="ap-font-semibold ap-text-gray-900">Sending Emails</h3>
                                <p className="ap-text-sm ap-text-gray-500">Please wait while emails are sent...</p>
                            </div>
                        </div>
                        
                        <div className="ap-mb-2">
                            <div className="ap-flex ap-items-center ap-justify-between ap-text-sm ap-mb-1">
                                <span className="ap-text-gray-600">Progress</span>
                                <span className="ap-font-medium ap-text-gray-900">{batchProgress} / {batchTotal}</span>
                            </div>
                            <div className="ap-h-3 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden">
                                <div 
                                    className="ap-h-full ap-bg-gradient-to-r ap-from-blue-500 ap-to-cyan-500 ap-rounded-full ap-transition-all ap-duration-300"
                                    style={{ width: `${batchTotal > 0 ? (batchProgress / batchTotal) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        
                        <p className="ap-text-xs ap-text-gray-400 ap-text-center">
                            Do not close this window
                        </p>
                    </div>
                </div>
            )}

            {/* Batch Results Modal */}
            {showBatchResults && batchResults && (
                <div className="ap-fixed ap-inset-0 ap-z-50 ap-overflow-y-auto">
                    <div className="ap-flex ap-min-h-full ap-items-center ap-justify-center ap-p-4">
                        <div className="ap-fixed ap-inset-0 ap-bg-black/50" onClick={() => setShowBatchResults(false)} />
                        
                        <div className="ap-relative ap-bg-white ap-rounded-2xl ap-shadow-xl ap-p-6 ap-w-full ap-max-w-md">
                            <div className="ap-flex ap-items-center ap-gap-3 ap-mb-4">
                                <div className={`ap-p-2 ap-rounded-lg ${batchResults.failed.length === 0 ? 'ap-bg-green-100' : 'ap-bg-yellow-100'}`}>
                                    {batchResults.failed.length === 0 ? (
                                        <HiOutlineCheckCircle className="ap-w-6 ap-h-6 ap-text-green-600" />
                                    ) : (
                                        <HiOutlineExclamationTriangle className="ap-w-6 ap-h-6 ap-text-yellow-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="ap-font-semibold ap-text-gray-900">Batch Send Complete</h3>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        {batchResults.success} sent, {batchResults.failed.length} failed
                                    </p>
                                </div>
                            </div>
                            
                            {batchResults.failed.length > 0 && (
                                <div className="ap-mb-4">
                                    <p className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Failed:</p>
                                    <div className="ap-bg-red-50 ap-rounded-lg ap-p-3 ap-max-h-40 ap-overflow-y-auto">
                                        {batchResults.failed.map(f => (
                                            <div key={f.id} className="ap-text-sm ap-text-red-700 ap-py-1">
                                                <span className="ap-font-medium">{f.name}</span>
                                                <span className="ap-text-red-500"> - {f.error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <div className="ap-flex ap-justify-end ap-gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowBatchResults(false)}
                                >
                                    Close
                                </Button>
                                {batchResults.failed.length > 0 && (
                                    <Button
                                        variant="lesson-evaluations"
                                        onClick={retryFailedEmails}
                                        className="!ap-flex !ap-items-center !ap-gap-2"
                                    >
                                        <HiOutlineArrowPath className="ap-w-4 ap-h-4" />
                                        Retry Failed
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h1 className="ap-text-2xl sm:ap-text-3xl ap-font-bold ap-text-gray-900">Email Evaluations</h1>
                    <p className="ap-text-gray-500 ap-mt-1">Send evaluation reports to parents</p>
                </div>
                {pendingCount > 0 && (
                    <Button
                        variant="lesson-evaluations"
                        onClick={sendAllEmails}
                        disabled={isBatchSending}
                        className="!ap-flex !ap-items-center !ap-gap-2 !ap-bg-gradient-to-r !ap-from-blue-500 !ap-to-cyan-500 hover:!ap-shadow-lg"
                    >
                        <HiOutlinePaperAirplane className="ap-w-5 ap-h-5" />
                        <span>Send All ({pendingCount})</span>
                    </Button>
                )}
            </div>

            {/* Stats cards */}
            <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-3 ap-gap-4">
                <div className="ap-bg-white ap-rounded-xl ap-p-4 ap-border ap-border-gray-200 ap-shadow-sm">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-yellow-100 ap-rounded-lg">
                            <HiOutlineClock className="ap-w-5 ap-h-5 ap-text-yellow-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Pending</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{pendingCount}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-xl ap-p-4 ap-border ap-border-gray-200 ap-shadow-sm">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-green-100 ap-rounded-lg">
                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Sent</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{sentCount}</p>
                        </div>
                    </div>
                </div>
                <div className="ap-bg-white ap-rounded-xl ap-p-4 ap-border ap-border-gray-200 ap-shadow-sm">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <div className="ap-p-2 ap-bg-blue-100 ap-rounded-lg">
                            <HiOutlineDocumentText className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        </div>
                        <div>
                            <p className="ap-text-sm ap-text-gray-500">Total</p>
                            <p className="ap-text-2xl ap-font-bold ap-text-gray-900">{evaluations.items.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and search */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200 ap-p-4">
                <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center ap-gap-4">
                    {/* Search */}
                    <div className="ap-relative ap-flex-1 ap-max-w-md">
                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search evaluations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-rounded-lg ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-2 focus:ap-ring-blue-500/20 ap-transition-colors"
                        />
                    </div>

                    {/* Filter buttons */}
                    <div className="ap-flex ap-gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setFilterStatus('all')}
                            className={filterStatus === 'all'
                                ? '!ap-bg-gray-900 !ap-text-white'
                                : '!ap-bg-gray-100 !ap-text-gray-600 hover:!ap-bg-gray-200'
                            }
                        >
                            All
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setFilterStatus('pending')}
                            className={filterStatus === 'pending'
                                ? '!ap-bg-yellow-500 !ap-text-white'
                                : '!ap-bg-yellow-50 !ap-text-yellow-600 hover:!ap-bg-yellow-100'
                            }
                        >
                            Pending ({pendingCount})
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setFilterStatus('sent')}
                            className={filterStatus === 'sent'
                                ? '!ap-bg-green-500 !ap-text-white'
                                : '!ap-bg-green-50 !ap-text-green-600 hover:!ap-bg-green-100'
                            }
                        >
                            Sent ({sentCount})
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="ap-bg-indigo-50 ap-border ap-border-indigo-200 ap-rounded-xl ap-p-4 ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-3">
                    <div className="ap-flex ap-items-center ap-gap-3">
                        <span className="ap-text-sm ap-font-medium ap-text-indigo-900">
                            {selectedIds.size} evaluation{selectedIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            className="!ap-text-indigo-600 hover:!ap-text-indigo-800 !ap-p-1"
                        >
                            <HiOutlineXMark className="ap-w-4 ap-h-4" />
                        </Button>
                    </div>
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => bulkUpdateEmailed(false)}
                            disabled={isBulkUpdating}
                            className="!ap-flex !ap-items-center !ap-gap-2 !ap-bg-yellow-100 !ap-text-yellow-800 hover:!ap-bg-yellow-200"
                        >
                            {isBulkUpdating ? <LoadingSpinner /> : <HiOutlineArrowUturnLeft className="ap-w-4 ap-h-4" />}
                            <span>Mark Unsent</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => bulkUpdateEmailed(true)}
                            disabled={isBulkUpdating}
                            className="!ap-flex !ap-items-center !ap-gap-2 !ap-bg-green-100 !ap-text-green-800 hover:!ap-bg-green-200"
                        >
                            {isBulkUpdating ? <LoadingSpinner /> : <HiOutlineCheckCircle className="ap-w-4 ap-h-4" />}
                            <span>Mark Sent</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Messages */}
            {error && (
                <div className="ap-bg-red-50 ap-text-red-600 ap-p-4 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="ap-bg-green-50 ap-text-green-600 ap-p-4 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
                    <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Evaluations list */}
            <div className="ap-bg-white ap-rounded-xl ap-shadow-sm ap-border ap-border-gray-200">
                {/* Select all header */}
                {filteredEvaluations.length > 0 && (
                    <div className="ap-flex ap-items-center ap-gap-3 ap-px-4 ap-py-3 ap-border-b ap-border-gray-200 ap-bg-gray-50/50">
                        <input
                            type="checkbox"
                            checked={selectedIds.size === filteredEvaluations.length && filteredEvaluations.length > 0}
                            onChange={toggleSelectAll}
                            className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-indigo-600 focus:ap-ring-indigo-500"
                        />
                        <span className="ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-tracking-wider">
                            {selectedIds.size > 0
                                ? `${selectedIds.size} of ${filteredEvaluations.length} selected`
                                : 'Select all'}
                        </span>
                    </div>
                )}

                <div className="ap-divide-y ap-divide-gray-200">
                    {filteredEvaluations.map((evaluation) => {
                        const swimmer = evaluation.meta?.swimmer ? getSwimmer(evaluation.meta.swimmer) : null;
                        const hasEmail = !!swimmer?.meta?.parent_email;
                        const isSelected = selectedIds.has(evaluation.id);

                        return (
                            <div
                                key={evaluation.id}
                                className={`ap-p-4 hover:ap-bg-gray-50 ap-transition-colors ${isSelected ? 'ap-bg-indigo-50/50' : ''}`}
                            >
                                <div className="ap-flex ap-items-start ap-gap-3">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelect(evaluation.id)}
                                        className="ap-w-4 ap-h-4 ap-mt-0.5 ap-rounded ap-border-gray-300 ap-text-indigo-600 focus:ap-ring-indigo-500 ap-flex-shrink-0"
                                    />
                                    <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-3 ap-flex-1 ap-min-w-0">
                                        <div className="ap-flex-1">
                                            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-1">
                                                <h3 className="ap-text-sm ap-font-medium ap-text-gray-900">
                                                    {swimmer?.title?.rendered || 'Unknown Swimmer'}
                                                </h3>
                                                {evaluation.meta?.emailed ? (
                                                    <span className="ap-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-700 ap-rounded-full">
                                                        <HiOutlineCheckCircle className="ap-w-3 ap-h-3" />
                                                        Sent
                                                    </span>
                                                ) : (
                                                    <span className="ap-flex ap-items-center ap-gap-1 ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-bg-yellow-100 ap-text-yellow-700 ap-rounded-full">
                                                        <HiOutlineClock className="ap-w-3 ap-h-3" />
                                                        Pending
                                                    </span>
                                                )}
                                            </div>

                                            <div className="ap-flex ap-flex-wrap ap-gap-x-4 ap-gap-y-1 ap-text-sm ap-text-gray-600">
                                                {evaluation.meta?.level_evaluated && (
                                                    <span>Level: {getLevelName(evaluation.meta.level_evaluated)}</span>
                                                )}
                                                <span>Created: {formatDate(evaluation.date || '')}</span>
                                                {swimmer?.meta?.parent_email && (
                                                    <span className="ap-flex ap-items-center ap-gap-1">
                                                        <HiOutlineEnvelope className="ap-w-4 ap-h-4" />
                                                        {swimmer.meta.parent_email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ap-flex ap-items-center ap-gap-2 ap-flex-shrink-0">
                                            {evaluation.meta?.emailed ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => resendEmail(evaluation.id)}
                                                    disabled={!hasEmail || isSending === evaluation.id}
                                                    className="!ap-flex !ap-items-center !ap-gap-2 !ap-text-blue-600 hover:!ap-bg-blue-50"
                                                    title={!hasEmail ? 'No parent email on file' : 'Resend evaluation email'}
                                                >
                                                    {isSending === evaluation.id ? (
                                                        <>
                                                            <LoadingSpinner />
                                                            <span>Sending...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <HiOutlineArrowPath className="ap-w-4 ap-h-4" />
                                                            <span>Resend</span>
                                                        </>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="lesson-evaluations"
                                                    size="sm"
                                                    onClick={() => sendEmail(evaluation.id)}
                                                    disabled={!hasEmail || isSending === evaluation.id}
                                                    className={`!ap-flex !ap-items-center !ap-gap-2 ${hasEmail
                                                        ? '!ap-bg-gradient-to-r !ap-from-blue-600 !ap-to-purple-600 hover:!ap-shadow-lg'
                                                        : '!ap-bg-gray-100 !ap-text-gray-400 !ap-cursor-not-allowed'
                                                    }`}
                                                    title={!hasEmail ? 'No parent email on file' : 'Send evaluation email'}
                                                >
                                                    {isSending === evaluation.id ? (
                                                        <>
                                                            <LoadingSpinner />
                                                            <span>Sending...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <HiOutlinePaperAirplane className="ap-w-4 ap-h-4" />
                                                            <span>Send Email</span>
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Loading state */}
                {isLoading && (
                    <div className="ap-flex ap-justify-center ap-py-8">
                        <LoadingSpinner />
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && filteredEvaluations.length === 0 && (
                    <div className="ap-text-center ap-py-12">
                        <HiOutlineEnvelope className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                        <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-1">
                            {filterStatus === 'pending' 
                                ? 'No pending evaluations'
                                : filterStatus === 'sent'
                                    ? 'No sent evaluations' : 'No evaluations found'
                            }
                        </h3>
                        <p className="ap-text-gray-500">
                            {filterStatus === 'pending' 
                                ? 'All evaluations have been sent!' : 'Try adjusting your search or filter'
                            }
                        </p>
                    </div>
                )}

                {/* Load more button */}
                {!isLoading && evaluations.page < evaluations.totalPages && filteredEvaluations.length > 0 && (
                    <div className="ap-flex ap-justify-center ap-py-4 ap-border-t ap-border-gray-200">
                        <Button
                            variant="link"
                            onClick={() => loadEvaluations()}
                        >
                            Load More
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmailEvaluations;
