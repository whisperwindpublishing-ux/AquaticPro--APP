import React, { useState, useEffect } from 'react';
import { pluginGet, pluginPost } from '@/services/api-service';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';

interface PostType {
    name: string;
    label: string;
    count: number;
}

interface PostPreview {
    id: number;
    title: string;
    excerpt: string;
    postDate: string;
    author: {
        id: number;
        name: string;
        firstName: string;
        lastName: string;
    } | null;
    status: string;
    alreadyImported: boolean;
}

interface Location {
    id: number;
    name: string;
}

interface TimeSlot {
    id: number;
    label: string;
    slug: string;
}

interface JobRole {
    id: number;
    title: string;
}

interface ImportResult {
    success: boolean;
    imported: Array<{ originalId: number; newId: number; title: string }>;
    importedCount: number;
    skipped: Array<{ id: number; reason: string }>;
    skippedCount: number;
    errors: Array<{ id: number; reason: string }>;
    errorCount: number;
}

const DailyLogImport: React.FC = () => {
    // Step management
    const [step, setStep] = useState<'config' | 'preview' | 'importing' | 'results'>('config');
    
    // Configuration state
    const [postTypes, setPostTypes] = useState<PostType[]>([]);
    const [selectedPostType, setSelectedPostType] = useState<string>('post');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    
    // Mapping options
    const [locations, setLocations] = useState<Location[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [defaultLocationId, setDefaultLocationId] = useState<number>(0);
    const [defaultTimeSlotIds, setDefaultTimeSlotIds] = useState<number[]>([]);
    const [defaultJobRoleId, setDefaultJobRoleId] = useState<number>(0);
    const [preserveAuthor, setPreserveAuthor] = useState<boolean>(true);
    const [preserveDate, setPreserveDate] = useState<boolean>(true);
    const [skipAlreadyImported, setSkipAlreadyImported] = useState<boolean>(true);
    
    // Preview state
    const [posts, setPosts] = useState<PostPreview[]>([]);
    const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
    
    // Loading/Error state
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // Results state
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    
    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const [postTypesData, locationsData, timeSlotsData, jobRolesData] = await Promise.all([
                    pluginGet('daily-logs/import/post-types'),
                    pluginGet('pg/locations'),
                    pluginGet('time-slots'),
                    pluginGet('pg/job-roles')
                ]);
                
                setPostTypes(postTypesData || []);
                setLocations(locationsData || []);
                setTimeSlots(timeSlotsData || []);
                setJobRoles(jobRolesData || []);
                
                // Set defaults
                if (locationsData?.length > 0) {
                    setDefaultLocationId(locationsData[0].id);
                }
            } catch (err) {
                console.error('Failed to load initial data:', err);
                setError('Failed to load configuration data');
            } finally {
                setIsLoading(false);
            }
        };
        
        loadInitialData();
        
        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }, []);
    
    // Preview posts
    const handlePreview = async () => {
        if (!startDate || !endDate) {
            setError('Please select both start and end dates');
            return;
        }
        
        if (!defaultLocationId) {
            setError('Please select a default location');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await pluginGet(
                `daily-logs/import/preview?startDate=${startDate}&endDate=${endDate}&postType=${selectedPostType}`
            );
            
            setPosts(result.posts || []);
            
            // Pre-select all non-imported posts
            const selectable = (result.posts || [])
                .filter((p: PostPreview) => !p.alreadyImported)
                .map((p: PostPreview) => p.id);
            setSelectedPosts(new Set(selectable));
            
            setStep('preview');
        } catch (err: any) {
            console.error('Preview failed:', err);
            setError(err.message || 'Failed to preview posts');
        } finally {
            setIsLoading(false);
        }
    };
    
    // Toggle post selection
    const togglePostSelection = (postId: number) => {
        setSelectedPosts(prev => {
            const next = new Set(prev);
            if (next.has(postId)) {
                next.delete(postId);
            } else {
                next.add(postId);
            }
            return next;
        });
    };
    
    // Select/deselect all
    const selectAll = () => {
        const selectable = posts.filter(p => !p.alreadyImported).map(p => p.id);
        setSelectedPosts(new Set(selectable));
    };
    
    const deselectAll = () => {
        setSelectedPosts(new Set());
    };
    
    // Run import
    const handleImport = async () => {
        if (selectedPosts.size === 0) {
            setError('Please select at least one post to import');
            return;
        }
        
        setStep('importing');
        setError(null);
        
        try {
            const result = await pluginPost('daily-logs/import', {
                postIds: Array.from(selectedPosts),
                defaultLocationId,
                defaultTimeSlotIds,
                defaultJobRoleId,
                preserveAuthor,
                preserveDate,
                skipAlreadyImported
            });
            
            setImportResult(result);
            setStep('results');
        } catch (err: any) {
            console.error('Import failed:', err);
            setError(err.message || 'Import failed');
            setStep('preview');
        }
    };
    
    // Reset to start
    const handleReset = () => {
        setStep('config');
        setPosts([]);
        setSelectedPosts(new Set());
        setImportResult(null);
        setError(null);
    };
    
    // Toggle time slot
    const toggleTimeSlot = (slotId: number) => {
        setDefaultTimeSlotIds(prev => {
            if (prev.includes(slotId)) {
                return prev.filter(id => id !== slotId);
            } else {
                return [...prev, slotId];
            }
        });
    };
    
    if (isLoading && step === 'config') {
        return (
            <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
                <LoadingSpinner />
            </div>
        );
    }
    
    return (
        <div className="ap-space-y-6">
            <div className="ap-flex ap-items-center ap-justify-between">
                <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Import WordPress Posts to Daily Logs</h2>
                {step !== 'config' && step !== 'importing' && (
                    <Button
                        variant="link"
                        onClick={handleReset}
                        className="!ap-flex !ap-items-center !ap-gap-1"
                    >
                        ← Start Over
                    </Button>
                )}
            </div>
            
            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}
            
            {/* Step 1: Configuration */}
            {step === 'config' && (
                <div className="ap-space-y-6">
                    {/* Date Range */}
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-6">
                        <h3 className="ap-text-lg ap-font-semibold ap-mb-4">1. Select Date Range & Post Type</h3>
                        
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-3 ap-gap-4">
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Post Type
                                </label>
                                <select
                                    value={selectedPostType}
                                    onChange={(e) => setSelectedPostType(e.target.value)}
                                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2"
                                >
                                    {postTypes.map(pt => (
                                        <option key={pt.name} value={pt.name}>
                                            {pt.label} ({pt.count} published)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2"
                                />
                            </div>
                            
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Default Mappings */}
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-6">
                        <h3 className="ap-text-lg ap-font-semibold ap-mb-4">2. Set Default Mappings</h3>
                        <p className="ap-text-sm ap-text-gray-600 ap-mb-4">
                            These values will be applied to all imported posts.
                        </p>
                        
                        <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 ap-gap-4">
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Location <span className="ap-text-red-500">*</span>
                                </label>
                                <select
                                    value={defaultLocationId}
                                    onChange={(e) => setDefaultLocationId(Number(e.target.value))}
                                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2"
                                    required
                                >
                                    <option value={0}>-- Select Location --</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                    Job Role (Optional)
                                </label>
                                <select
                                    value={defaultJobRoleId}
                                    onChange={(e) => setDefaultJobRoleId(Number(e.target.value))}
                                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-md ap-px-3 ap-py-2"
                                >
                                    <option value={0}>-- No Job Role --</option>
                                    {jobRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.title}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="ap-mt-4">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                Time Slots (Optional)
                            </label>
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                {timeSlots.map(slot => (
                                    <Button
                                        key={slot.id}
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleTimeSlot(slot.id)}
                                        className={`!ap-rounded-full !ap-border !ap-transition ${
                                            defaultTimeSlotIds.includes(slot.id)
                                                ? '!ap-bg-blue-500 !ap-text-white !ap-border-blue-500' : '!ap-bg-white !ap-text-gray-700 !ap-border-gray-300 hover:!ap-border-blue-500'
                                        }`}
                                    >
                                        {slot.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Import Options */}
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-6">
                        <h3 className="ap-text-lg ap-font-semibold ap-mb-4">3. Import Options</h3>
                        
                        <div className="ap-space-y-3">
                            <label className="ap-flex ap-items-center ap-gap-3">
                                <input
                                    type="checkbox"
                                    checked={preserveAuthor}
                                    onChange={(e) => setPreserveAuthor(e.target.checked)}
                                    className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded"
                                />
                                <div>
                                    <span className="ap-font-medium">Preserve original author</span>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Keep the original post author. If unchecked, you will be set as the author.
                                    </p>
                                </div>
                            </label>
                            
                            <label className="ap-flex ap-items-center ap-gap-3">
                                <input
                                    type="checkbox"
                                    checked={preserveDate}
                                    onChange={(e) => setPreserveDate(e.target.checked)}
                                    className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded"
                                />
                                <div>
                                    <span className="ap-font-medium">Preserve original date</span>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Use the original post date as the log date. If unchecked, today's date will be used.
                                    </p>
                                </div>
                            </label>
                            
                            <label className="ap-flex ap-items-center ap-gap-3">
                                <input
                                    type="checkbox"
                                    checked={skipAlreadyImported}
                                    onChange={(e) => setSkipAlreadyImported(e.target.checked)}
                                    className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded"
                                />
                                <div>
                                    <span className="ap-font-medium">Skip already imported posts</span>
                                    <p className="ap-text-sm ap-text-gray-500">
                                        Don't re-import posts that have already been converted to daily logs.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <div className="ap-flex ap-justify-end">
                        <Button
                            variant="primary"
                            onClick={handlePreview}
                            disabled={isLoading || !defaultLocationId}
                        >
                            {isLoading ? 'Loading...' : 'Preview Posts →'}
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Step 2: Preview */}
            {step === 'preview' && (
                <div className="ap-space-y-4">
                    <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                        <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                            <div>
                                <h3 className="ap-text-lg ap-font-semibold">
                                    Found {posts.length} posts
                                </h3>
                                <p className="ap-text-sm ap-text-gray-600">
                                    {selectedPosts.size} selected for import
                                    {posts.filter(p => p.alreadyImported).length > 0 && (
                                        <span className="ap-text-amber-600 ap-ml-2">
                                            ({posts.filter(p => p.alreadyImported).length} already imported)
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="ap-flex ap-gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAll}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={deselectAll}
                                >
                                    Deselect All
                                </Button>
                            </div>
                        </div>
                        
                        {posts.length === 0 ? (
                            <div className="ap-text-center ap-py-8 ap-text-gray-500">
                                No posts found in the selected date range.
                            </div>
                        ) : (
                            <div className="ap-max-h-96 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-lg">
                                <table className="ap-w-full">
                                    <thead className="ap-bg-gray-50 ap-sticky ap-top-0">
                                        <tr>
                                            <th className="ap-w-10 ap-px-3 ap-py-2 ap-text-left"></th>
                                            <th className="ap-px-3 ap-py-2 ap-text-left ap-text-sm ap-font-medium ap-text-gray-700">Title</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-left ap-text-sm ap-font-medium ap-text-gray-700">Author</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-left ap-text-sm ap-font-medium ap-text-gray-700">Date</th>
                                            <th className="ap-px-3 ap-py-2 ap-text-left ap-text-sm ap-font-medium ap-text-gray-700">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="ap-divide-y ap-divide-gray-100">
                                        {posts.map(post => (
                                            <tr 
                                                key={post.id}
                                                className={`${post.alreadyImported ? 'ap-bg-gray-50 ap-opacity-60' : 'hover:ap-bg-gray-50'}`}
                                            >
                                                <td className="ap-px-3 ap-py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPosts.has(post.id)}
                                                        onChange={() => togglePostSelection(post.id)}
                                                        disabled={post.alreadyImported}
                                                        className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded"
                                                    />
                                                </td>
                                                <td className="ap-px-3 ap-py-2">
                                                    <div className="ap-font-medium ap-text-gray-900 ap-text-sm">
                                                        {post.title || '(No title)'}
                                                    </div>
                                                    <div className="ap-text-xs ap-text-gray-500 ap-truncate ap-max-w-md">
                                                        {post.excerpt}
                                                    </div>
                                                    {post.alreadyImported && (
                                                        <span className="ap-inline-block ap-mt-1 ap-px-2 ap-py-0.5 ap-bg-amber-100 ap-text-amber-700 ap-text-xs ap-rounded">
                                                            Already imported
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-600">
                                                    {post.author ? `${post.author.firstName} ${post.author.lastName}`.trim() || post.author.name : 'Unknown'}
                                                </td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-gray-600">
                                                    {new Date(post.postDate).toLocaleDateString()}
                                                </td>
                                                <td className="ap-px-3 ap-py-2">
                                                    <span className={`ap-inline-block ap-px-2 ap-py-0.5 ap-text-xs ap-rounded ${
                                                        post.status === 'publish' 
                                                            ? 'ap-bg-green-100 ap-text-green-700' : 'ap-bg-gray-100 ap-text-gray-700'
                                                    }`}>
                                                        {post.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    
                    <div className="ap-flex ap-justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setStep('config')}
                        >
                            ← Back to Configuration
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleImport}
                            disabled={selectedPosts.size === 0}
                            className="!ap-bg-green-600 hover:!ap-bg-green-700"
                        >
                            Import {selectedPosts.size} Posts →
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Step 3: Importing */}
            {step === 'importing' && (
                <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-12 ap-text-center">
                    <LoadingSpinner />
                    <p className="ap-mt-4 ap-text-lg ap-font-medium ap-text-gray-700">
                        Importing {selectedPosts.size} posts...
                    </p>
                    <p className="ap-text-sm ap-text-gray-500 ap-mt-2">
                        Please wait while we convert your posts to daily logs.
                    </p>
                </div>
            )}
            
            {/* Step 4: Results */}
            {step === 'results' && importResult && (
                <div className="ap-space-y-4">
                    {/* Summary */}
                    <div className={`ap-rounded-lg ap-border ap-p-6 ${
                        importResult.errorCount > 0 
                            ? 'ap-bg-amber-50 ap-border-amber-200' : 'ap-bg-green-50 ap-border-green-200'
                    }`}>
                        <h3 className={`ap-text-xl ap-font-semibold ${
                            importResult.errorCount > 0 ? 'ap-text-amber-800' : 'ap-text-green-800'
                        }`}>
                            {importResult.errorCount > 0 ? '⚠️ Import Completed with Issues' : '✅ Import Successful!'}
                        </h3>
                        <div className="ap-mt-4 ap-grid ap-grid-cols-3 ap-gap-4">
                            <div className="ap-text-center">
                                <div className="ap-text-3xl ap-font-bold ap-text-green-600">
                                    {importResult.importedCount}
                                </div>
                                <div className="ap-text-sm ap-text-gray-600">Imported</div>
                            </div>
                            <div className="ap-text-center">
                                <div className="ap-text-3xl ap-font-bold ap-text-amber-600">
                                    {importResult.skippedCount}
                                </div>
                                <div className="ap-text-sm ap-text-gray-600">Skipped</div>
                            </div>
                            <div className="ap-text-center">
                                <div className="ap-text-3xl ap-font-bold ap-text-red-600">
                                    {importResult.errorCount}
                                </div>
                                <div className="ap-text-sm ap-text-gray-600">Errors</div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Imported posts */}
                    {importResult.imported.length > 0 && (
                        <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                            <h4 className="ap-font-semibold ap-text-green-700 ap-mb-2">
                                ✓ Successfully Imported ({importResult.imported.length})
                            </h4>
                            <ul className="ap-text-sm ap-space-y-1 ap-max-h-40 ap-overflow-y-auto">
                                {importResult.imported.map(item => (
                                    <li key={item.originalId} className="ap-text-gray-600">
                                        "{item.title}" → Daily Log #{item.newId}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {/* Skipped posts */}
                    {importResult.skipped.length > 0 && (
                        <div className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-p-4">
                            <h4 className="ap-font-semibold ap-text-amber-700 ap-mb-2">
                                ⏭ Skipped ({importResult.skipped.length})
                            </h4>
                            <ul className="ap-text-sm ap-space-y-1 ap-max-h-40 ap-overflow-y-auto">
                                {importResult.skipped.map(item => (
                                    <li key={item.id} className="ap-text-gray-600">
                                        Post #{item.id}: {item.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {/* Errors */}
                    {importResult.errors.length > 0 && (
                        <div className="ap-bg-white ap-rounded-lg ap-border ap-border-red-200 ap-p-4">
                            <h4 className="ap-font-semibold ap-text-red-700 ap-mb-2">
                                ✗ Errors ({importResult.errors.length})
                            </h4>
                            <ul className="ap-text-sm ap-space-y-1 ap-max-h-40 ap-overflow-y-auto">
                                {importResult.errors.map(item => (
                                    <li key={item.id} className="ap-text-red-600">
                                        Post #{item.id}: {item.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <div className="ap-flex ap-justify-center ap-gap-4">
                        <Button
                            variant="primary"
                            onClick={handleReset}
                        >
                            Import More Posts
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyLogImport;
