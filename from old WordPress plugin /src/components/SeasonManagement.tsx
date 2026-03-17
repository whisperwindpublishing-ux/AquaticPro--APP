import React, { useState, useEffect } from 'react';
import { 
    Season, 
    RetentionStats,
    SRMPermissions 
} from '@/types';
import { 
    getSeasons, 
    createSeason, 
    updateSeason, 
    deleteSeason,
    getSeasonStats,
    getMyPermissions
} from '@/services/seasonalReturnsService';
import { 
    HiOutlinePlus, 
    HiOutlinePencil, 
    HiOutlineTrash,
    HiOutlineChartBar,
    HiOutlineCalendar,
    HiOutlineXMark
} from 'react-icons/hi2';
import { formatLocalDate } from '@/utils/dateUtils';
import { Modal, Button, Input, Select, Checkbox, Label } from './ui';

interface SeasonManagementProps {
    onNavigateToPayRates?: (seasonId: number) => void;
}

const SeasonManagement: React.FC<SeasonManagementProps> = () => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingSeason, setEditingSeason] = useState<Season | null>(null);
    const [selectedSeasonStats, setSelectedSeasonStats] = useState<RetentionStats | null>(null);
    const [permissions, setPermissions] = useState<SRMPermissions>({
        srm_view_own_pay: false,
        srm_view_all_pay: false,
        srm_manage_pay_config: false,
        srm_send_invites: false,
        srm_view_responses: false,
        srm_manage_status: false,
        srm_manage_templates: false,
        srm_view_retention: false,
        srm_bulk_actions: false
    });

    // Form state
    const [formData, setFormData] = useState<Partial<Season>>({
        name: '',
        year: new Date().getFullYear() + 1,
        season_type: 'summer',
        start_date: '',
        end_date: '',
        is_active: true,
        is_current: false
    });

    useEffect(() => {
        const initialize = async () => {
            try {
                await loadPermissions();
                await loadSeasons();
            } catch (err) {
                console.error('Failed to initialize SeasonManagement:', err);
                setError('Failed to load seasonal returns data. Please refresh the page.');
                setLoading(false);
            }
        };
        initialize();
    }, []);

    const loadPermissions = async () => {
        try {
            const perms = await getMyPermissions();
            console.log('🔐 SRM Permissions loaded:', perms);
            // Ensure all permission keys exist with default false values
            setPermissions({
                srm_view_own_pay: perms?.srm_view_own_pay ?? false,
                srm_view_all_pay: perms?.srm_view_all_pay ?? false,
                srm_manage_pay_config: perms?.srm_manage_pay_config ?? false,
                srm_send_invites: perms?.srm_send_invites ?? false,
                srm_view_responses: perms?.srm_view_responses ?? false,
                srm_manage_status: perms?.srm_manage_status ?? false,
                srm_manage_templates: perms?.srm_manage_templates ?? false,
                srm_view_retention: perms?.srm_view_retention ?? false,
                srm_bulk_actions: perms?.srm_bulk_actions ?? false
            });
        } catch (err: any) {
            console.error('❌ Failed to load SRM permissions:', err);
            
            // Check if it's a 404 or module disabled error
            if (err.message && (err.message.includes('404') || err.message.includes('Failed to fetch'))) {
                setError('Seasonal Returns module is disabled or API endpoints not registered. Please enable the module in WordPress admin.');
            }
            
            // Set default permissions on error
            setPermissions({
                srm_view_own_pay: false,
                srm_view_all_pay: false,
                srm_manage_pay_config: false,
                srm_send_invites: false,
                srm_view_responses: false,
                srm_manage_status: false,
                srm_manage_templates: false,
                srm_view_retention: false,
                srm_bulk_actions: false
            });
        }
    };

    const loadSeasons = async () => {
        try {
            setLoading(true);
            const data = await getSeasons();
            setSeasons(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load seasons');
        } finally {
            setLoading(false);
        }
    };

    const loadSeasonStats = async (seasonId: number) => {
        try {
            const stats = await getSeasonStats(seasonId);
            setSelectedSeasonStats(stats);
        } catch (err) {
            console.error('Failed to load season stats:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            if (editingSeason) {
                await updateSeason(editingSeason.id, formData);
            } else {
                await createSeason(formData);
            }
            
            await loadSeasons();
            handleCloseForm();
        } catch (err: any) {
            setError(err.message || 'Failed to save season');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this season? This will also delete all associated employee season data.')) {
            return;
        }

        try {
            await deleteSeason(id);
            await loadSeasons();
        } catch (err: any) {
            setError(err.message || 'Failed to delete season');
        }
    };

    const handleEdit = (season: Season) => {
        setEditingSeason(season);
        setFormData({
            name: season.name,
            year: season.year,
            season_type: season.season_type,
            start_date: season.start_date,
            end_date: season.end_date,
            is_active: season.is_active,
            is_current: season.is_current
        });
        setShowCreateForm(false); // Close add form if open
    };

    const handleCloseForm = () => {
        setShowCreateForm(false);
        setEditingSeason(null);
        setFormData({
            name: '',
            year: new Date().getFullYear() + 1,
            season_type: 'summer',
            start_date: '',
            end_date: '',
            is_active: true,
            is_current: false
        });
    };

    const handleOpenAddForm = () => {
        setEditingSeason(null);
        setFormData({
            name: '',
            year: new Date().getFullYear() + 1,
            season_type: 'summer',
            start_date: '',
            end_date: '',
            is_active: true,
            is_current: false
        });
        setShowCreateForm(true);
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600"></div>
            </div>
        );
    }

    if (error && error.includes('disabled')) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-6">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-yellow-900 ap-mb-2">Module Not Enabled</h3>
                    <p className="ap-text-yellow-800">The Seasonal Returns module is not enabled. Please enable it in the plugin settings.</p>
                </div>
            </div>
        );
    }

    if (!permissions?.srm_manage_status && !loading) {
        return (
            <div className="ap-p-8">
                <div className="ap-bg-yellow-50 ap-border ap-border-yellow-200 ap-rounded-lg ap-p-4 ap-space-y-3">
                    <p className="ap-text-yellow-800 ap-font-semibold">You don't have permission to manage seasons.</p>
                    <div className="ap-text-sm ap-text-yellow-700 ap-space-y-1">
                        <p>You need the "Manage Season Status" permission.</p>
                        <p className="ap-font-mono ap-text-xs ap-bg-yellow-100 ap-p-2 ap-rounded">
                            Current permissions: {JSON.stringify(permissions, null, 2)}
                        </p>
                        <p className="ap-mt-2">If you're a WordPress admin, this should work automatically. Check:</p>
                        <ul className="ap-list-disc ap-list-inside ap-ml-4">
                            <li>Is the Seasonal Returns module enabled in Settings?</li>
                            <li>Check your browser console for API errors</li>
                            <li>You may need to create a SRM Permissions management page</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // Inline form for creating/editing seasons
    const seasonForm = (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-md ap-border ap-border-blue-200 ap-p-6 ap-mb-6">
            <div className="ap-flex ap-items-center ap-justify-between ap-mb-4">
                <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
                    {editingSeason ? `Edit: ${editingSeason.name || editingSeason.year}` : 'Create New Season'}
                </h3>
                <Button
                    onClick={handleCloseForm}
                    variant="ghost"
                    size="xs"
                    className="!ap-p-1 !ap-text-gray-400 hover:!ap-text-gray-600 !ap-min-h-0"
                    aria-label="Close form"
                >
                    <HiOutlineXMark className="ap-w-5 ap-h-5" />
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="ap-space-y-4">
                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4">
                    <div>
                        <Label htmlFor="season-name">Season Name</Label>
                        <Input
                            id="season-name"
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Summer 2026"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="season-year">Year</Label>
                        <Input
                            id="season-year"
                            type="number"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                            required
                            min={2020}
                            max={2100}
                        />
                    </div>

                    <div>
                        <Label htmlFor="season-type">Season Type</Label>
                        <Select
                            id="season-type"
                            value={formData.season_type || 'summer'}
                            onChange={(e) => setFormData({ ...formData, season_type: e.target.value as any })}
                            required
                        >
                            <option value="summer">Summer</option>
                            <option value="winter">Winter</option>
                            <option value="year-round">Year-Round</option>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="end-date">End Date</Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                            required
                        />
                    </div>

                    <div className="ap-flex ap-flex-col ap-justify-end ap-space-y-2">
                        <Checkbox
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            label="Active (Recruiting)"
                        />
                        <Checkbox
                            id="is_current"
                            checked={formData.is_current}
                            onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                            label="Current (Operating)"
                        />
                    </div>
                </div>

                <div className="ap-flex ap-justify-end ap-gap-3 ap-pt-4 ap-border-t ap-border-gray-200">
                    <Button type="button" onClick={handleCloseForm} variant="secondary">
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                        {editingSeason ? 'Update Season' : 'Create Season'}
                    </Button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="ap-p-8">
            <div className="ap-mb-6 ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
                <div>
                    <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900">Season Management</h1>
                    <p className="ap-text-gray-600 ap-mt-1">Create and manage seasonal employment periods</p>
                </div>
                {!showCreateForm && !editingSeason && (
                    <Button
                        onClick={handleOpenAddForm}
                        variant="primary"
                        leftIcon={<HiOutlinePlus className="ap-w-5 ap-h-5" />}
                    >
                        Create Season
                    </Button>
                )}
            </div>

            {error && (
                <div className="ap-mb-6 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4">
                    <p className="ap-text-red-800">{error}</p>
                </div>
            )}

            {/* Inline form for adding new season (shows at top) */}
            {showCreateForm && !editingSeason && seasonForm}

            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-6">
                {seasons.map((season) => (
                    <React.Fragment key={season.id}>
                        <div
                            className={`ap-bg-white ap-rounded-lg ap-shadow-md ap-p-6 ap-border-2 ${
                                season.is_active ? 'ap-border-green-500' : 'ap-border-gray-200'
                            } ${editingSeason?.id === season.id ? 'ap-ring-2 ap-ring-blue-500' : ''}`}
                        >
                            <div className="ap-flex ap-items-start ap-justify-between ap-mb-4">
                                <div className="ap-flex ap-items-center ap-gap-2">
                                    <HiOutlineCalendar className="ap-w-6 ap-h-6 ap-text-blue-600" />
                                    <h3 className="ap-text-xl ap-font-bold ap-text-gray-900">{season.year}</h3>
                                </div>
                                {season.is_active && (
                                    <span className="ap-px-2 ap-py-1 ap-bg-green-100 ap-text-green-800 ap-text-xs ap-font-semibold ap-rounded">
                                        Active
                                    </span>
                                )}
                            </div>

                            <p className="ap-text-lg ap-font-medium ap-text-gray-800 ap-mb-2">{season.name}</p>

                            <div className="ap-space-y-2 ap-mb-4">
                                <p className="ap-text-sm ap-text-gray-600">
                                    <span className="ap-font-medium">Start:</span> {formatLocalDate(season.start_date)}
                                </p>
                                <p className="ap-text-sm ap-text-gray-600">
                                    <span className="ap-font-medium">End:</span> {formatLocalDate(season.end_date)}
                                </p>
                            </div>

                            <div className="ap-flex ap-items-center ap-gap-2 ap-mt-4 ap-pt-4 ap-border-t ap-border-gray-200">
                                <Button
                                    onClick={() => loadSeasonStats(season.id)}
                                    variant="secondary"
                                    size="sm"
                                    className="!ap-flex-1 !ap-flex !ap-items-center !ap-justify-center !ap-gap-2 !ap-bg-blue-50 !ap-text-blue-700 hover:!ap-bg-blue-100"
                                >
                                    <HiOutlineChartBar className="ap-w-4 ap-h-4" />
                                    <span className="ap-text-sm ap-font-medium">Stats</span>
                                </Button>
                                <Button
                                    onClick={() => handleEdit(season)}
                                    variant="ghost"
                                    size="sm"
                                    className={`!ap-flex !ap-items-center !ap-justify-center !ap-p-2 ${
                                        editingSeason?.id === season.id 
                                            ? '!ap-bg-blue-100 !ap-text-blue-700' : '!ap-bg-gray-50 !ap-text-gray-700 hover:!ap-bg-gray-100'
                                    }`}
                                >
                                    <HiOutlinePencil className="ap-w-4 ap-h-4" />
                                </Button>
                                <Button
                                    onClick={() => handleDelete(season.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="!ap-flex !ap-items-center !ap-justify-center !ap-p-2 !ap-bg-red-50 !ap-text-red-700 hover:!ap-bg-red-100"
                                >
                                    <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                </Button>
                            </div>
                        </div>
                        {/* Inline edit form below the season card */}
                        {editingSeason?.id === season.id && (
                            <div className="ap-col-span-full">{seasonForm}</div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {seasons.length === 0 && !showCreateForm && (
                <div className="ap-text-center ap-py-12">
                    <HiOutlineCalendar className="ap-w-16 ap-h-16 ap-text-gray-400 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-2">No seasons yet</h3>
                    <p className="ap-text-gray-600 ap-mb-4">Create your first season to start managing seasonal returns</p>
                    <Button
                        onClick={handleOpenAddForm}
                        variant="primary"
                        leftIcon={<HiOutlinePlus className="ap-w-5 ap-h-5" />}
                    >
                        Create Season
                    </Button>
                </div>
            )}

            {/* Stats Modal */}
            <Modal 
                isOpen={!!selectedSeasonStats} 
                onClose={() => setSelectedSeasonStats(null)}
                size="lg"
            >
                <Modal.Header showCloseButton onClose={() => setSelectedSeasonStats(null)}>
                    <Modal.Title>
                        Season {selectedSeasonStats?.year || selectedSeasonStats?.season_name} - Retention Statistics
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    {selectedSeasonStats && (
                        <>
                            <div className="ap-grid ap-grid-cols-2 ap-gap-4 ap-mb-6">
                                <div className="ap-bg-blue-50 ap-rounded-lg ap-p-4">
                                    <p className="ap-text-sm ap-text-blue-600 ap-font-medium ap-mb-1">Total Invited</p>
                                    <p className="ap-text-3xl ap-font-bold ap-text-blue-900">{selectedSeasonStats.total_invited}</p>
                                </div>
                                <div className="ap-bg-green-50 ap-rounded-lg ap-p-4">
                                    <p className="ap-text-sm ap-text-green-600 ap-font-medium ap-mb-1">Returning</p>
                                    <p className="ap-text-3xl ap-font-bold ap-text-green-900">{selectedSeasonStats.total_returning}</p>
                                </div>
                                <div className="ap-bg-red-50 ap-rounded-lg ap-p-4">
                                    <p className="ap-text-sm ap-text-red-600 ap-font-medium ap-mb-1">Not Returning</p>
                                    <p className="ap-text-3xl ap-font-bold ap-text-red-900">{selectedSeasonStats.total_not_returning}</p>
                                </div>
                                <div className="ap-bg-yellow-50 ap-rounded-lg ap-p-4">
                                    <p className="ap-text-sm ap-text-yellow-600 ap-font-medium ap-mb-1">Pending Response</p>
                                    <p className="ap-text-3xl ap-font-bold ap-text-yellow-900">{selectedSeasonStats.total_pending}</p>
                                </div>
                            </div>

                            <div className="ap-bg-gray-50 ap-rounded-lg ap-p-4">
                                <p className="ap-text-sm ap-text-gray-600 ap-font-medium ap-mb-2">Retention Rate</p>
                                <div className="ap-flex ap-items-center ap-gap-3">
                                    <div className="ap-flex-1 ap-bg-gray-200 ap-rounded-full ap-h-4">
                                        <div
                                            className="ap-bg-green-500 ap-h-4 ap-rounded-full ap-transition-all"
                                            style={{ width: `${selectedSeasonStats.retention_rate}%` }}
                                        ></div>
                                    </div>
                                    <span className="ap-text-2xl ap-font-bold ap-text-gray-900">
                                        {selectedSeasonStats.retention_rate.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default SeasonManagement;
