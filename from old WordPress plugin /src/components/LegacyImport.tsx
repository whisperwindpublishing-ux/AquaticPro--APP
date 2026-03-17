import React, { useState, useEffect } from 'react';
import { formatLocalDate } from '../utils/dateUtils';
import { HiOutlineCloudArrowUp, HiOutlineTrash, HiOutlineExclamationTriangle, HiOutlineCheckCircle, HiOutlineArrowPath, HiOutlineEye, HiOutlineDocumentMagnifyingGlass } from 'react-icons/hi2';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { Button } from './ui';

interface LegacySummary {
    leadership_goal: number;
    leadershiptask: number;
    leadership_meeting: number;
    leadership_update: number;
    already_imported: {
        mp_goal: number;
        mp_initiative: number;
        mp_meeting: number;
        mp_update: number;
    };
}

interface PreviewItem {
    old_id: number;
    title: string;
    status: string;
    date: string;
    author_id: number;
    author_name: string;
    mentor_id?: number;
    mentor_name?: string;
    mentee_id?: number;
    mentee_name?: string;
    old_goal_id?: number;
    goal_title?: string;
    will_import: boolean;
    error?: string;
}

interface ImportResults {
    mentorships_created: number;
    mentorships_existing: number;
    goals_imported: number;
    goals_skipped: number;
    initiatives_imported: number;
    initiatives_skipped: number;
    meetings_imported: number;
    meetings_skipped: number;
    updates_imported: number;
    updates_skipped: number;
    errors: string[];
    preview_data?: {
        goals: PreviewItem[];
        initiatives: PreviewItem[];
        meetings: PreviewItem[];
        updates: PreviewItem[];
    };
}

interface SamplePost {
    id: number;
    title: string;
    status: string;
    date: string;
    author_id: number;
    author_name: string;
    meta_fields: Record<string, any[]>;
}

interface SampleData {
    leadership_goal: SamplePost[];
    leadershiptask: SamplePost[];
    leadership_meeting: SamplePost[];
    leadership_update: SamplePost[];
}

interface MetaKeys {
    leadership_goal: string[];
    leadershiptask: string[];
    leadership_meeting: string[];
    leadership_update: string[];
}

const LegacyImport: React.FC = () => {
    const [summary, setSummary] = useState<LegacySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const [importResults, setImportResults] = useState<ImportResults | null>(null);
    const [rollbackResults, setRollbackResults] = useState<Record<string, number> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDryRun, setIsDryRun] = useState(true);
    const [activeTab, setActiveTab] = useState<'import' | 'preview' | 'debug'>('import');
    const [sampleData, setSampleData] = useState<SampleData | null>(null);
    const [metaKeys, setMetaKeys] = useState<MetaKeys | null>(null);
    const [isLoadingSample, setIsLoadingSample] = useState(false);
    const [previewTab, setPreviewTab] = useState<'goals' | 'initiatives' | 'meetings' | 'updates'>('goals');

    const fetchSummary = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await fetch('/wp-json/mentorship-platform/v1/legacy-import/summary', {
                headers: {
                    'X-WP-Nonce': (window as any).wpApiSettings?.nonce || '',
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch summary');
            }
            
            const data = await response.json();
            setSummary(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load summary');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSampleData = async () => {
        try {
            setIsLoadingSample(true);
            
            const [sampleResponse, metaResponse] = await Promise.all([
                fetch('/wp-json/mentorship-platform/v1/legacy-import/sample-data?limit=10', {
                    headers: { 'X-WP-Nonce': (window as any).wpApiSettings?.nonce || '' },
                }),
                fetch('/wp-json/mentorship-platform/v1/legacy-import/meta-keys', {
                    headers: { 'X-WP-Nonce': (window as any).wpApiSettings?.nonce || '' },
                }),
            ]);
            
            if (sampleResponse.ok) {
                const data = await sampleResponse.json();
                setSampleData(data.data);
            }
            
            if (metaResponse.ok) {
                const data = await metaResponse.json();
                setMetaKeys(data.data);
            }
        } catch (err) {
            console.error('Failed to load sample data:', err);
        } finally {
            setIsLoadingSample(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    useEffect(() => {
        if (activeTab === 'debug' && !sampleData) {
            fetchSampleData();
        }
    }, [activeTab]);

    const handleImport = async () => {
        if (!isDryRun && !confirm('This will import all legacy data. This action cannot be easily undone. Continue?')) {
            return;
        }

        try {
            setIsImporting(true);
            setImportResults(null);
            setError(null);

            const response = await fetch('/wp-json/mentorship-platform/v1/legacy-import/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': (window as any).wpApiSettings?.nonce || '',
                },
                body: JSON.stringify({ dry_run: isDryRun }),
            });

            if (!response.ok) {
                throw new Error('Import failed');
            }

            const data = await response.json();
            setImportResults(data.results);
            
            // Refresh summary after import
            if (!isDryRun) {
                await fetchSummary();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    const handleRollback = async () => {
        if (!confirm('This will DELETE all imported data. This cannot be undone. Are you absolutely sure?')) {
            return;
        }

        try {
            setIsRollingBack(true);
            setRollbackResults(null);
            setError(null);

            const response = await fetch('/wp-json/mentorship-platform/v1/legacy-import/rollback', {
                method: 'DELETE',
                headers: {
                    'X-WP-Nonce': (window as any).wpApiSettings?.nonce || '',
                },
            });

            if (!response.ok) {
                throw new Error('Rollback failed');
            }

            const data = await response.json();
            setRollbackResults(data.deleted);
            setImportResults(null);
            
            // Refresh summary after rollback
            await fetchSummary();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Rollback failed');
        } finally {
            setIsRollingBack(false);
        }
    };

    if (isLoading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-p-12">
                <AiOutlineLoading3Quarters className="ap-w-8 ap-h-8 ap-text-blue-600 ap-animate-spin" />
                <span className="ap-ml-3 ap-text-gray-600">Loading legacy data summary...</span>
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            {/* Header */}
            <div className="ap-bg-gradient-to-r ap-from-purple-600 ap-to-indigo-600 ap-rounded-xl ap-p-6 ap-text-white">
                <h2 className="ap-text-2xl ap-font-bold ap-flex ap-items-center ap-gap-2">
                    <HiOutlineCloudArrowUp className="ap-w-7 ap-h-7" />
                    Legacy Mentorship Import
                </h2>
                <p className="ap-mt-2 ap-text-purple-100">
                    Import data from the old Pods-based Leadership Program into the new Mentorship system.
                </p>
            </div>

            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-600 ap-flex-shrink-0 ap-mt-0.5" />
                    <div>
                        <h3 className="ap-font-medium ap-text-red-800">Error</h3>
                        <p className="ap-text-sm ap-text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="ap-border-b ap-border-gray-200">
                <nav className="ap-flex ap-gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => setActiveTab('import')}
                        className={`!ap-py-3 !ap-px-1 !ap-rounded-none ap-border-b-2 ap-font-medium ap-text-sm ap-transition-colors ${
                            activeTab === 'import'
                                ? 'ap-border-purple-500 ap-text-purple-600' : 'ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700'
                        }`}
                    >
                        <HiOutlineCloudArrowUp className="ap-w-4 ap-h-4 ap-inline ap-mr-2" />
                        Import
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setActiveTab('preview')}
                        className={`!ap-py-3 !ap-px-1 !ap-rounded-none ap-border-b-2 ap-font-medium ap-text-sm ap-transition-colors ${
                            activeTab === 'preview'
                                ? 'ap-border-purple-500 ap-text-purple-600' : 'ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700'
                        }`}
                        disabled={!importResults?.preview_data}
                    >
                        <HiOutlineEye className="ap-w-4 ap-h-4 ap-inline ap-mr-2" />
                        Preview Data {importResults?.preview_data && `(${
                            (importResults.preview_data.goals?.length || 0) +
                            (importResults.preview_data.initiatives?.length || 0) +
                            (importResults.preview_data.meetings?.length || 0) +
                            (importResults.preview_data.updates?.length || 0)
                        })`}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setActiveTab('debug')}
                        className={`!ap-py-3 !ap-px-1 !ap-rounded-none ap-border-b-2 ap-font-medium ap-text-sm ap-transition-colors ${
                            activeTab === 'debug'
                                ? 'ap-border-purple-500 ap-text-purple-600' : 'ap-border-transparent ap-text-gray-500 hover:ap-text-gray-700'
                        }`}
                    >
                        <HiOutlineDocumentMagnifyingGlass className="ap-w-4 ap-h-4 ap-inline ap-mr-2" />
                        Debug Data
                    </Button>
                </nav>
            </div>

            {activeTab === 'import' && (
                <>
                    {/* Mapping Reference */}
                    <div className="ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-4">
                        <h3 className="ap-font-medium ap-text-blue-900 ap-mb-2">Data Mapping</h3>
                        <div className="ap-grid ap-grid-cols-2 ap-gap-2 ap-text-sm">
                            <div className="ap-text-blue-700">Leadership: Goals</div>
                            <div className="ap-text-blue-900 ap-font-medium">→ Mentorship Goals (public by default)</div>
                            <div className="ap-text-blue-700">Leadership: Tasks</div>
                            <div className="ap-text-blue-900 ap-font-medium">→ Initiatives</div>
                            <div className="ap-text-blue-700">Leadership: Meetings</div>
                            <div className="ap-text-blue-900 ap-font-medium">→ Mentorship Meetings</div>
                            <div className="ap-text-blue-700">Leadership: Updates</div>
                            <div className="ap-text-blue-900 ap-font-medium">→ Updates</div>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-4 ap-gap-4">
                            <div className="ap-bg-white ap-rounded-lg ap-border ap-p-4">
                                <div className="ap-text-3xl ap-font-bold ap-text-purple-600">{summary.leadership_goal}</div>
                                <div className="ap-text-sm ap-text-gray-600">Leadership Goals</div>
                                <div className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                    {summary.already_imported.mp_goal} already imported
                                </div>
                            </div>
                            <div className="ap-bg-white ap-rounded-lg ap-border ap-p-4">
                                <div className="ap-text-3xl ap-font-bold ap-text-blue-600">{summary.leadershiptask}</div>
                                <div className="ap-text-sm ap-text-gray-600">Leadership Tasks</div>
                                <div className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                    {summary.already_imported.mp_initiative} already imported
                                </div>
                            </div>
                            <div className="ap-bg-white ap-rounded-lg ap-border ap-p-4">
                                <div className="ap-text-3xl ap-font-bold ap-text-green-600">{summary.leadership_meeting}</div>
                                <div className="ap-text-sm ap-text-gray-600">Meetings</div>
                                <div className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                    {summary.already_imported.mp_meeting} already imported
                                </div>
                            </div>
                            <div className="ap-bg-white ap-rounded-lg ap-border ap-p-4">
                                <div className="ap-text-3xl ap-font-bold ap-text-orange-600">{summary.leadership_update}</div>
                                <div className="ap-text-sm ap-text-gray-600">Updates</div>
                                <div className="ap-text-xs ap-text-gray-400 ap-mt-1">
                                    {summary.already_imported.mp_update} already imported
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Import Controls */}
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-p-6">
                        <h3 className="ap-font-semibold ap-text-gray-900 ap-mb-4">Import Options</h3>
                        
                        <div className="ap-space-y-4">
                            <label className="ap-flex ap-items-center ap-gap-3">
                                <input
                                    type="checkbox"
                                    checked={isDryRun}
                                    onChange={(e) => setIsDryRun(e.target.checked)}
                                    className="ap-w-5 ap-h-5 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                                />
                                <div>
                                    <span className="ap-font-medium ap-text-gray-900">Dry Run Mode</span>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Preview what will be imported without making any changes
                                    </p>
                                </div>
                            </label>

                            <div className="ap-flex ap-gap-3">
                                <Button
                                    variant={isDryRun ? 'primary' : 'primary'}
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className={`!ap-px-6 !ap-py-3 ${
                                        isDryRun
                                            ? '' : '!ap-bg-purple-600 hover:!ap-bg-purple-700'
                                    }`}
                                >
                                    {isImporting ? (
                                        <AiOutlineLoading3Quarters className="ap-w-5 ap-h-5 ap-animate-spin" />
                                    ) : (
                                        <HiOutlineCloudArrowUp className="ap-w-5 ap-h-5" />
                                    )}
                                    {isDryRun ? 'Preview Import' : 'Run Import'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={fetchSummary}
                                    disabled={isLoading}
                                    className="!ap-px-4 !ap-py-3"
                                >
                                    <HiOutlineArrowPath className={`ap-w-5 ap-h-5 ${isLoading ? 'ap-animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Import Results Summary */}
                    {importResults && (
                        <div className={`ap-rounded-lg ap-border ap-p-6 ${isDryRun ? 'ap-bg-blue-50 ap-border-blue-200' : 'ap-bg-green-50 ap-border-green-200'}`}>
                            <h3 className="ap-font-semibold ap-text-gray-900 ap-mb-4 ap-flex ap-items-center ap-gap-2">
                                <HiOutlineCheckCircle className={`ap-w-5 ap-h-5 ${isDryRun ? 'ap-text-blue-600' : 'ap-text-green-600'}`} />
                                {isDryRun ? 'Preview Results' : 'Import Complete'}
                            </h3>
                            
                            <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-5 ap-gap-4 ap-mb-4">
                                <div className="ap-bg-white ap-rounded ap-p-3">
                                    <div className="ap-text-2xl ap-font-bold ap-text-purple-600">
                                        {importResults.mentorships_created}
                                    </div>
                                    <div className="ap-text-xs ap-text-gray-600">Mentorships Created</div>
                                    <div className="ap-text-xs ap-text-gray-400">
                                        {importResults.mentorships_existing} existing
                                    </div>
                                </div>
                                <div className="ap-bg-white ap-rounded ap-p-3">
                                    <div className="ap-text-2xl ap-font-bold ap-text-blue-600">
                                        {importResults.goals_imported}
                                    </div>
                                    <div className="ap-text-xs ap-text-gray-600">Goals</div>
                                    <div className="ap-text-xs ap-text-gray-400">
                                        {importResults.goals_skipped} skipped
                                    </div>
                                </div>
                                <div className="ap-bg-white ap-rounded ap-p-3">
                                    <div className="ap-text-2xl ap-font-bold ap-text-green-600">
                                        {importResults.initiatives_imported}
                                    </div>
                                    <div className="ap-text-xs ap-text-gray-600">Initiatives</div>
                                    <div className="ap-text-xs ap-text-gray-400">
                                        {importResults.initiatives_skipped} skipped
                                    </div>
                                </div>
                                <div className="ap-bg-white ap-rounded ap-p-3">
                                    <div className="ap-text-2xl ap-font-bold ap-text-orange-600">
                                        {importResults.meetings_imported}
                                    </div>
                                    <div className="ap-text-xs ap-text-gray-600">Meetings</div>
                                    <div className="ap-text-xs ap-text-gray-400">
                                        {importResults.meetings_skipped} skipped
                                    </div>
                                </div>
                                <div className="ap-bg-white ap-rounded ap-p-3">
                                    <div className="ap-text-2xl ap-font-bold ap-text-amber-600">
                                        {importResults.updates_imported}
                                    </div>
                                    <div className="ap-text-xs ap-text-gray-600">Updates</div>
                                    <div className="ap-text-xs ap-text-gray-400">
                                        {importResults.updates_skipped} skipped
                                    </div>
                                </div>
                            </div>

                            {importResults.errors.length > 0 && (
                                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded ap-p-3">
                                    <h4 className="ap-font-medium ap-text-red-800 ap-mb-2">Errors ({importResults.errors.length})</h4>
                                    <ul className="ap-text-sm ap-text-red-700 ap-space-y-1 ap-max-h-60 ap-overflow-y-auto">
                                        {importResults.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {isDryRun && importResults.preview_data && (
                                <div className="ap-mt-4 ap-p-3 ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded">
                                    <p className="ap-text-sm ap-text-yellow-800">
                                        <strong>Tip:</strong> Click the "Preview Data" tab above to see the actual records that will be imported.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rollback Section */}
                    <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-6">
                        <h3 className="ap-font-semibold ap-text-red-900 ap-mb-2 ap-flex ap-items-center ap-gap-2">
                            <HiOutlineTrash className="ap-w-5 ap-h-5" />
                            Danger Zone
                        </h3>
                        <p className="ap-text-sm ap-text-red-700 ap-mb-4">
                            Remove all data that was imported from the legacy system. This cannot be undone.
                        </p>
                        
                        <Button
                            variant="danger"
                            onClick={handleRollback}
                            disabled={isRollingBack}
                        >
                            {isRollingBack ? (
                                <AiOutlineLoading3Quarters className="ap-w-5 ap-h-5 ap-animate-spin" />
                            ) : (
                                <HiOutlineTrash className="ap-w-5 ap-h-5" />
                            )}
                            Rollback Import
                        </Button>

                        {rollbackResults && (
                            <div className="ap-mt-4 ap-bg-white ap-rounded ap-p-4">
                                <h4 className="ap-font-medium ap-text-gray-900 ap-mb-2">Deleted Items</h4>
                                <div className="ap-grid ap-grid-cols-2 ap-gap-2 ap-text-sm">
                                    {Object.entries(rollbackResults).map(([key, count]) => (
                                        <div key={key} className="ap-flex ap-justify-between">
                                            <span className="ap-text-gray-600">{key}</span>
                                            <span className="ap-font-medium">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'preview' && importResults?.preview_data && (
                <div className="ap-space-y-4">
                    {/* Preview Sub-tabs */}
                    <div className="ap-flex ap-gap-2 ap-flex-wrap">
                        {(['goals', 'initiatives', 'meetings', 'updates'] as const).map((tab) => (
                            <Button
                                key={tab}
                                variant={previewTab === tab ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setPreviewTab(tab)}
                                className={previewTab === tab ? '!ap-bg-purple-600 hover:!ap-bg-purple-700' : ''}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({importResults.preview_data?.[tab]?.length || 0})
                            </Button>
                        ))}
                    </div>

                    {/* Preview Table */}
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-overflow-hidden">
                        <div className="ap-overflow-x-auto ap-max-h-[600px] ap-overflow-y-auto">
                            <table className="ap-w-full ap-text-sm">
                                <thead className="ap-bg-gray-50 ap-sticky ap-top-0">
                                    <tr>
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Status</th>
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">ID</th>
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Title</th>
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Author</th>
                                        {previewTab === 'goals' && (
                                            <>
                                                <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Mentor</th>
                                                <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Mentee</th>
                                            </>
                                        )}
                                        {previewTab !== 'goals' && (
                                            <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Linked Goal</th>
                                        )}
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Date</th>
                                        <th className="ap-px-4 ap-py-3 ap-text-left ap-font-medium ap-text-gray-600">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="ap-divide-y ap-divide-gray-100">
                                    {importResults.preview_data[previewTab]?.map((item) => (
                                        <tr key={item.old_id} className={item.will_import ? '' : 'bg-red-50'}>
                                            <td className="ap-px-4 ap-py-3">
                                                {item.will_import ? (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-800">
                                                        ✓ Will Import
                                                    </span>
                                                ) : (
                                                    <span className="ap-inline-flex ap-items-center ap-px-2 ap-py-1 ap-rounded-full ap-text-xs ap-font-medium ap-bg-red-100 ap-text-red-800">
                                                        ✗ Skipped
                                                    </span>
                                                )}
                                            </td>
                                            <td className="ap-px-4 ap-py-3 ap-font-mono ap-text-gray-600">#{item.old_id}</td>
                                            <td className="ap-px-4 ap-py-3 ap-font-medium ap-text-gray-900 ap-max-w-xs ap-truncate" title={item.title}>
                                                {item.title}
                                            </td>
                                            <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                                {item.author_name}
                                                <span className="ap-text-gray-400 ap-text-xs ap-ml-1">(#{item.author_id})</span>
                                            </td>
                                            {previewTab === 'goals' && (
                                                <>
                                                    <td className="ap-px-4 ap-py-3">
                                                        {item.mentor_name ? (
                                                            <span className={item.mentor_id ? 'ap-text-gray-900' : 'ap-text-red-600 ap-font-medium'}>
                                                                {item.mentor_name}
                                                                {item.mentor_id && <span className="ap-text-gray-400 ap-text-xs ap-ml-1">(#{item.mentor_id})</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="ap-text-red-600">NOT SET</span>
                                                        )}
                                                    </td>
                                                    <td className="ap-px-4 ap-py-3">
                                                        {item.mentee_name ? (
                                                            <span className={item.mentee_id ? 'ap-text-gray-900' : 'ap-text-red-600 ap-font-medium'}>
                                                                {item.mentee_name}
                                                                {item.mentee_id && <span className="ap-text-gray-400 ap-text-xs ap-ml-1">(#{item.mentee_id})</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="ap-text-red-600">NOT SET</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            {previewTab !== 'goals' && (
                                                <td className="ap-px-4 ap-py-3 ap-text-gray-600">
                                                    {item.goal_title || 'Unknown'}
                                                    {item.old_goal_id && <span className="ap-text-gray-400 ap-text-xs ap-ml-1">(#{item.old_goal_id})</span>}
                                                </td>
                                            )}
                                            <td className="ap-px-4 ap-py-3 ap-text-gray-500 ap-text-xs">
                                                {formatLocalDate(item.date)}
                                            </td>
                                            <td className="ap-px-4 ap-py-3 ap-text-red-600 ap-text-xs ap-max-w-xs ap-truncate" title={item.error || ''}>
                                                {item.error || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!importResults.preview_data[previewTab] || importResults.preview_data[previewTab].length === 0) && (
                                        <tr>
                                            <td colSpan={previewTab === 'goals' ? 8 : 7} className="ap-px-4 ap-py-8 ap-text-center ap-text-gray-500">
                                                No {previewTab} to preview
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'preview' && !importResults?.preview_data && (
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-6 ap-text-center">
                    <HiOutlineEye className="ap-w-12 ap-h-12 ap-text-yellow-600 ap-mx-auto ap-mb-3" />
                    <h3 className="ap-font-medium ap-text-yellow-900 ap-mb-2">No Preview Data</h3>
                    <p className="ap-text-sm ap-text-yellow-700">
                        Run a preview import first to see the data that will be imported.
                    </p>
                </div>
            )}

            {activeTab === 'debug' && (
                <div className="ap-space-y-6">
                    {isLoadingSample ? (
                        <div className="ap-flex ap-items-center ap-justify-center ap-p-12">
                            <AiOutlineLoading3Quarters className="ap-w-8 ap-h-8 ap-text-blue-600 ap-animate-spin" />
                            <span className="ap-ml-3 ap-text-gray-600">Loading sample data...</span>
                        </div>
                    ) : (
                        <>
                            {/* Meta Keys Reference */}
                            {metaKeys && (
                                <div className="ap-bg-white ap-rounded-lg ap-border ap-p-6">
                                    <h3 className="ap-font-semibold ap-text-gray-900 ap-mb-4">Meta Field Keys Found</h3>
                                    <div className="ap-grid md:ap-grid-cols-2 ap-gap-4">
                                        {Object.entries(metaKeys).map(([postType, keys]) => (
                                            <div key={postType} className="ap-bg-gray-50 ap-rounded ap-p-3">
                                                <h4 className="ap-font-medium ap-text-gray-800 ap-mb-2">{postType}</h4>
                                                <div className="ap-flex ap-flex-wrap ap-gap-1">
                                                    {keys.length > 0 ? keys.map((key: string) => (
                                                        <span key={key} className="ap-px-2 ap-py-1 ap-bg-white ap-rounded ap-text-xs ap-font-mono ap-text-gray-600 ap-border">
                                                            {key}
                                                        </span>
                                                    )) : (
                                                        <span className="ap-text-gray-400 ap-text-sm">No meta keys found</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sample Data */}
                            {sampleData && Object.entries(sampleData).map(([postType, posts]) => (
                                <div key={postType} className="ap-bg-white ap-rounded-lg ap-border ap-overflow-hidden">
                                    <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-b">
                                        <h3 className="ap-font-semibold ap-text-gray-900">{postType} (sample of {posts.length})</h3>
                                    </div>
                                    <div className="ap-divide-y ap-divide-gray-100 ap-max-h-[400px] ap-overflow-y-auto">
                                        {posts.length > 0 ? posts.map((post: SamplePost) => (
                                            <div key={post.id} className="ap-p-4">
                                                <div className="ap-flex ap-items-start ap-justify-between ap-mb-2">
                                                    <div>
                                                        <span className="ap-font-medium ap-text-gray-900">{post.title}</span>
                                                        <span className="ap-text-gray-400 ap-text-sm ap-ml-2">#{post.id}</span>
                                                    </div>
                                                    <div className="ap-text-sm ap-text-gray-500">
                                                        by {post.author_name} ({post.author_id})
                                                    </div>
                                                </div>
                                                <div className="ap-bg-gray-50 ap-rounded ap-p-3 ap-text-xs">
                                                    <div className="ap-font-medium ap-text-gray-600 ap-mb-2">Meta Fields:</div>
                                                    <div className="ap-space-y-1">
                                                        {Object.entries(post.meta_fields).map(([key, values]) => (
                                                            <div key={key} className="ap-flex">
                                                                <span className="ap-font-mono ap-text-purple-600 ap-w-48 ap-flex-shrink-0">{key}:</span>
                                                                <span className="ap-text-gray-700 ap-break-all">
                                                                    {JSON.stringify((values as any[]).length === 1 ? (values as any[])[0] : values)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {Object.keys(post.meta_fields).length === 0 && (
                                                            <span className="ap-text-gray-400">No meta fields</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="ap-p-4 ap-text-center ap-text-gray-500">
                                                No posts found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <Button
                                variant="secondary"
                                onClick={fetchSampleData}
                            >
                                <HiOutlineArrowPath className="ap-w-5 ap-h-5" />
                                Refresh Sample Data
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default LegacyImport;
