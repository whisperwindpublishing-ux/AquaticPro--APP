import React, { useState, useEffect, useCallback } from 'react';
import { 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineTrash, 
  HiOutlineArchiveBox,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCalendar,
  HiOutlineTrophy,
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlineClock,
  HiOutlineClipboardDocumentList
} from 'react-icons/hi2';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui';
import { parseLocalDate } from '@/utils/dateUtils';
import { getJobRoles } from '@/services/api-professional-growth';
import { 
  AwardPeriod, 
  PeriodType, 
  PeriodStatus,
  PeriodFormState
} from '@/types/awesome-awards';

/**
 * AwardPeriodManagement Component
 * 
 * Admin interface for managing Awesome Awards periods and categories.
 * Allows creating, editing, and managing award periods with their categories.
 * 
 * Features:
 * - Create/edit/delete award periods
 * - Add/edit/delete categories within periods
 * - Status transitions (draft → nominations_open → pending_approval → winner_declared)
 * - Archive management
 */

interface AwardPeriodManagementProps {
  onNavigateToApprovals?: (periodId: number) => void;
}

// API Base URL from WordPress
const API_BASE = (window as any).mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
const NONCE = (window as any).mentorshipPlatformData?.nonce || '';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': NONCE,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// API Functions
async function getAwardPeriods(filters?: { status?: string; archived?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.archived !== undefined) params.append('archived', String(filters.archived));
  const query = params.toString() ? `?${params}` : '';
  return apiFetch<AwardPeriod[]>(`/awesome-awards/periods${query}`);
}

async function createAwardPeriod(data: {
  name?: string;
  period_type: PeriodType;
  nomination_start: string;
  nomination_end: string;
  voting_start: string;
  voting_end: string;
  categories?: { name: string; description?: string }[];
  taskdeck_enabled?: boolean;
  nomination_task_roles?: number[];
  voting_task_roles?: number[];
  max_winners?: number;
  allow_pre_voting?: boolean;
}) {
  return apiFetch<AwardPeriod>('/awesome-awards/periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateAwardPeriod(id: number, data: Partial<AwardPeriod>) {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function getNominationsForPeriod(periodId: number) {
  return apiFetch<any[]>(`/awesome-awards/nominations?period_id=${periodId}&status=approved`);
}

async function selectWinner(nominationId: number) {
  return apiFetch(`/awesome-awards/nominations/${nominationId}/winner`, {
    method: 'POST',
  });
}

async function deleteAwardPeriod(id: number) {
  return apiFetch<{ deleted: boolean; archived?: boolean }>(`/awesome-awards/periods/${id}`, {
    method: 'DELETE',
  });
}

async function updatePeriodStatus(id: number, status: PeriodStatus) {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

async function togglePeriodArchive(id: number, archived: boolean) {
  return apiFetch<AwardPeriod>(`/awesome-awards/periods/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify({ archived }),
  });
}

// Note: deleteCategory kept for potential cleanup operations
async function deleteCategory(id: number) {
  return apiFetch<{ deleted: boolean }>(`/awesome-awards/categories/${id}`, {
    method: 'DELETE',
  });
}

// Helper functions
function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endDate.getFullYear()}`;
  }
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function getStatusBadge(status: PeriodStatus, archived: boolean) {
  if (archived) {
    return { label: 'Archived', className: 'ap-bg-gray-100 ap-text-gray-600' };
  }
  
  const badges: Record<PeriodStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'ap-bg-gray-100 ap-text-gray-700' },
    nominations_open: { label: 'Nominations Open', className: 'ap-bg-green-100 ap-text-green-700' },
    voting_open: { label: 'Voting Open', className: 'ap-bg-purple-100 ap-text-purple-700' },
    pending_approval: { label: 'Pending Approval', className: 'ap-bg-yellow-100 ap-text-yellow-700' },
    winner_declared: { label: 'Winner Declared', className: 'ap-bg-blue-100 ap-text-blue-700' },
    closed: { label: 'Closed', className: 'ap-bg-gray-100 ap-text-gray-600' },
    completed: { label: 'Completed', className: 'ap-bg-teal-100 ap-text-teal-700' },
  };
  
  return badges[status] || { label: status, className: 'ap-bg-gray-100 ap-text-gray-700' };
}

// Helper to generate period display name
function getPeriodDisplayName(period: AwardPeriod): string {
  // If custom name exists, use it
  if (period.name) return period.name;
  
  // Generate a friendly name based on dates
  const startDate = new Date(period.start_date);
  
  if (period.period_type === 'week') {
    // Get week number
    const startOfYear = new Date(startDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((startDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `Week ${weekNumber} Award (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
  } else {
    // Monthly - use month name
    return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Award`;
  }
}

// Initial form state
const getInitialFormState = (): PeriodFormState => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return {
    name: '',
    period_type: 'week', // Kept for backwards compatibility but not shown in UI
    nomination_start: today,
    nomination_end: nextWeek,
    voting_start: nextWeek,
    voting_end: twoWeeks,
    max_winners: 1,        // Default to single winner
    allow_pre_voting: false,
    winner_id: null,       // Selected winner nomination ID
    categories: [], // Categories deprecated - award name defines the award
    taskdeck_enabled: false,
    nomination_task_roles: [],
    voting_task_roles: [],
  };
};

// Job role type for dropdown
interface JobRoleOption {
  id: number;
  title: string;
}

const AwardPeriodManagement: React.FC<AwardPeriodManagementProps> = ({ onNavigateToApprovals }) => {
  const [periods, setPeriods] = useState<AwardPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Job roles for TaskDeck assignment
  const [jobRoles, setJobRoles] = useState<JobRoleOption[]>([]);
  const [isTaskDeckEnabled, setIsTaskDeckEnabled] = useState(false);
  
  // Filter state
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PeriodStatus | ''>('');
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AwardPeriod | null>(null);
  const [formData, setFormData] = useState<PeriodFormState>(getInitialFormState());
  const [isSaving, setIsSaving] = useState(false);
  const [periodNominations, setPeriodNominations] = useState<any[]>([]);
  
  // Expanded periods (for viewing categories)
  const [_expandedPeriods, _setExpandedPeriods] = useState<Set<number>>(new Set());
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'period' | 'category'; id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Multiselect state
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Fetch periods
  const fetchPeriods = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAwardPeriods({ 
        archived: showArchived ? undefined : false, // Hide archived by default
        status: statusFilter || undefined 
      });
      setPeriods(data);
    } catch (err) {
      console.error('Failed to fetch periods:', err);
      setError(err instanceof Error ? err.message : 'Failed to load award periods');
    } finally {
      setIsLoading(false);
    }
  }, [showArchived, statusFilter]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // Fetch job roles for TaskDeck assignment and check if TaskDeck is enabled
  useEffect(() => {
    const fetchJobRoles = async () => {
      try {
        const roles = await getJobRoles();
        setJobRoles(roles.map(r => ({ id: r.id, title: r.title })));
      } catch (err) {
        console.error('Failed to fetch job roles:', err);
      }
    };
    
    // Check if TaskDeck module is enabled - use mentorshipPlatformData from wp_localize_script
    const taskdeckEnabled = (window as any).mentorshipPlatformData?.enable_taskdeck ?? false;
    setIsTaskDeckEnabled(taskdeckEnabled);
    
    if (taskdeckEnabled) {
      fetchJobRoles();
    }
  }, []);

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };
  
  // Multiselect handlers
  const handleToggleSelect = (id: number) => {
    setSelectedPeriods(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedPeriods.length === periods.length) {
      setSelectedPeriods([]);
    } else {
      setSelectedPeriods(periods.map(p => p.id));
    }
  };
  
  const handleBulkArchive = async () => {
    if (selectedPeriods.length === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const targetArchiveState = !showArchived; // Archive if viewing active, unarchive if viewing archived
      
      await Promise.all(
        selectedPeriods.map(id => togglePeriodArchive(id, targetArchiveState))
      );
      
      showSuccess(
        `${selectedPeriods.length} period(s) ${targetArchiveState ? 'archived' : 'restored'} successfully`
      );
      setSelectedPeriods([]);
      fetchPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process bulk action');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Open form for new period
  const handleCreateNew = () => {
    setEditingPeriod(null);
    setFormData(getInitialFormState());
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleEdit = async (period: AwardPeriod) => {
    setEditingPeriod(period);
    
    // Debug logging to see what we're receiving
    console.log('Editing period:', period);
    console.log('nomination_end:', period.nomination_end);
    console.log('nomination_deadline:', period.nomination_deadline);
    
    // Fetch nominations for this period to show in winner selector
    let currentWinnerId = null;
    try {
      const noms = await getNominationsForPeriod(period.id);
      setPeriodNominations(noms);
      const winner = noms.find(n => n.is_winner || n.status === 'winner');
      if (winner) currentWinnerId = winner.id;
    } catch (err) {
      console.error('Failed to load nominations:', err);
      setPeriodNominations([]);
    }
    
    // Extract just the date portion from nomination_deadline if it contains time
    const extractDate = (dateString: string | null | undefined): string => {
      if (!dateString) return '';
      // If it contains a space (has time component), take only the date part
      return dateString.split(' ')[0];
    };
    
    setFormData({
      name: period.name || '',
      period_type: period.period_type,
      // Map from stored fields - use new fields if available, fallback to legacy
      nomination_start: extractDate(period.nomination_start || period.start_date),
      nomination_end: extractDate(period.nomination_end || period.nomination_deadline) || extractDate(period.start_date),
      voting_start: extractDate(period.voting_start || period.nomination_deadline) || extractDate(period.start_date),
      voting_end: extractDate(period.voting_end || period.end_date),
      categories: period.categories?.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        prize_description: c.prize_description,
      })) || [],
      taskdeck_enabled: period.taskdeck_enabled || false,
      nomination_task_roles: period.nomination_task_roles || [],
      voting_task_roles: period.voting_task_roles || [],
      max_winners: period.max_winners || 1,
      allow_pre_voting: period.allow_pre_voting || false,
      winner_id: currentWinnerId,
    });
    setIsFormOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Validate award name
      if (!formData.name.trim()) {
        throw new Error('Award name is required');
      }
      // Validate nomination and voting windows
      if (!formData.nomination_start || !formData.nomination_end) {
        throw new Error('Nomination window dates are required');
      }
      if (!formData.voting_start || !formData.voting_end) {
        throw new Error('Voting window dates are required');
      }
      if (formData.nomination_end > formData.voting_end) {
        throw new Error('Nomination window must end before or when voting window ends');
      }
      
      if (editingPeriod) {
        // Update existing award
        await updateAwardPeriod(editingPeriod.id, {
          name: formData.name,
          period_type: formData.period_type,
          nomination_start: formData.nomination_start,
          nomination_end: formData.nomination_end,
          voting_start: formData.voting_start,
          voting_end: formData.voting_end,
          // Legacy fields for backwards compatibility
          start_date: formData.nomination_start,
          end_date: formData.voting_end,
          nomination_deadline: formData.nomination_end,
          taskdeck_enabled: formData.taskdeck_enabled,
          nomination_task_roles: formData.nomination_task_roles,
          voting_task_roles: formData.voting_task_roles,
          max_winners: formData.max_winners,
          allow_pre_voting: formData.allow_pre_voting,
        });
        
        // If single winner mode and winner selected, update it
        if (formData.max_winners === 1 && formData.winner_id) {
          await selectWinner(formData.winner_id);
        }
        // Note: Multiple winners are selected via checkboxes directly, not on form save

        showSuccess('Award updated successfully');
      } else {
        // Create new award
        await createAwardPeriod({
          name: formData.name,
          period_type: formData.period_type,
          nomination_start: formData.nomination_start,
          nomination_end: formData.nomination_end,
          voting_start: formData.voting_start,
          voting_end: formData.voting_end,
          categories: [], // Categories deprecated
          taskdeck_enabled: formData.taskdeck_enabled,
          nomination_task_roles: formData.nomination_task_roles,
          voting_task_roles: formData.voting_task_roles,
          max_winners: formData.max_winners,
          allow_pre_voting: formData.allow_pre_voting,
        });
        showSuccess('Award created successfully');
      }

      setIsFormOpen(false);
      setEditingPeriod(null);
      fetchPeriods();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Status transitions
  const handleStatusChange = async (period: AwardPeriod, newStatus: PeriodStatus) => {
    try {
      await updatePeriodStatus(period.id, newStatus);
      showSuccess(`Award status changed to ${newStatus.replace('_', ' ')}`);
      fetchPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Archive toggle
  const handleArchiveToggle = async (period: AwardPeriod) => {
    try {
      await togglePeriodArchive(period.id, !period.archived);
      showSuccess(period.archived ? 'Period restored' : 'Period archived');
      fetchPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle archive');
    }
  };

  // Delete confirmation
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'period') {
        const result = await deleteAwardPeriod(deleteTarget.id);
        if (result.archived) {
          showSuccess('Period had nominations and was archived instead of deleted');
        } else {
          showSuccess('Period deleted successfully');
        }
      } else {
        await deleteCategory(deleteTarget.id);
        showSuccess('Category deleted successfully');
      }
      setDeleteTarget(null);
      fetchPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  // Render status action buttons
  const renderStatusActions = (period: AwardPeriod) => {
    if (period.archived) {
      return (
        <Button
          onClick={() => handleArchiveToggle(period)}
          variant="link"
          size="xs"
          leftIcon={<HiOutlineArchiveBox className="ap-h-4 ap-w-4" />}
        >
          Restore
        </Button>
      );
    }

    const actions: React.ReactNode[] = [];

    switch (period.status) {
      case 'draft':
        actions.push(
          <Button
            key="open"
            onClick={() => handleStatusChange(period, 'nominations_open')}
            variant="success-outline"
            size="xs"
            leftIcon={<HiOutlinePlay className="ap-h-4 ap-w-4" />}
            title="Open for nominations"
          >
            Open Nominations
          </Button>
        );
        break;
      case 'nominations_open':
        actions.push(
          <Button
            key="close"
            onClick={() => handleStatusChange(period, 'voting_open')}
            variant="outline"
            size="xs"
            leftIcon={<HiOutlinePause className="ap-h-4 ap-w-4" />}
            className="!ap-bg-purple-100 !ap-text-purple-700 !ap-border-purple-200 hover:!ap-bg-purple-200"
            title="Open voting"
          >
            Open Voting
          </Button>
        );
        actions.push(
          <Button
            key="back"
            onClick={() => handleStatusChange(period, 'draft')}
            variant="ghost"
            size="xs"
            title="Back to draft"
          >
            Back to Draft
          </Button>
        );
        break;
      case 'voting_open':
        actions.push(
          <Button
            key="close-voting"
            onClick={() => handleStatusChange(period, 'pending_approval')}
            variant="warning-outline"
            size="xs"
            leftIcon={<HiOutlinePause className="ap-h-4 ap-w-4" />}
            title="Close voting"
          >
            Close Voting
          </Button>
        );
        actions.push(
          <Button
            key="back"
            onClick={() => handleStatusChange(period, 'nominations_open')}
            variant="ghost"
            size="xs"
            title="Back to nominations"
          >
            Reopen Nominations
          </Button>
        );
        break;
      case 'pending_approval':
        if (onNavigateToApprovals) {
          actions.push(
            <Button
              key="approve"
              onClick={() => onNavigateToApprovals(period.id)}
              variant="outline"
              size="xs"
              leftIcon={<HiOutlineTrophy className="ap-h-4 ap-w-4" />}
              className="!ap-bg-blue-100 !ap-text-blue-700 !ap-border-blue-200 hover:!ap-bg-blue-200"
            >
              Select Winners
            </Button>
          );
        }
        actions.push(
          <Button
            key="reopen"
            onClick={() => handleStatusChange(period, 'voting_open')}
            variant="ghost"
            size="xs"
            title="Reopen voting"
          >
            Reopen Voting
          </Button>
        );
        break;
      case 'winner_declared':
      case 'completed':
        // Final states - only archive is available
        break;
    }

    if (period.status !== 'winner_declared' && period.status !== 'completed') {
      actions.push(
        <Button
          key="archive"
          onClick={() => handleArchiveToggle(period)}
          variant="ghost"
          size="xs"
          className="!ap-text-gray-500 hover:!ap-text-gray-700"
          title="Archive"
        >
          <HiOutlineArchiveBox className="ap-h-4 ap-w-4" />
        </Button>
      );
      actions.push(
        <Button
          key="delete"
          onClick={() => setDeleteTarget({ type: 'period', id: period.id, name: period.name || 'this award' })}
          variant="ghost"
          size="xs"
          className="!ap-text-red-500 hover:!ap-text-red-700"
          title="Delete"
        >
          <HiOutlineTrash className="ap-h-4 ap-w-4" />
        </Button>
      );
    }

    return <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">{actions}</div>;
  };

  if (isLoading && periods.length === 0) {
    return (
      <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  // Inline form component - used for both add and edit
  const periodForm = (
    <form onSubmit={handleSubmit} className="ap-bg-white ap-rounded-xl ap-shadow-lg ap-overflow-hidden ap-border ap-border-gray-200">
      {/* Header */}
      <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-border-gray-200 ap-bg-gray-50">
        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">
          {editingPeriod ? 'Edit Award' : 'Create Award'}
        </h3>
        <Button
          type="button"
          onClick={() => {
            setIsFormOpen(false);
            setEditingPeriod(null);
          }}
          variant="ghost"
          size="xs"
          className="!ap-p-2 !ap-rounded-full !ap-text-gray-400 hover:!ap-bg-gray-200 hover:!ap-text-gray-500"
        >
          <svg className="ap-w-5 ap-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Form Body */}
      <div className="ap-p-6 ap-space-y-4">
        {/* Award Name */}
        <div>
          <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
            Award Name <span className="ap-text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Best Team Player, Customer Champion, December Excellence"
            className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2"
            required
          />
          <p className="ap-text-xs ap-text-gray-500 ap-mt-1">This name will identify the award throughout the nomination and voting process.</p>
        </div>

        {/* Nomination Window */}
        <div className="ap-border ap-border-blue-200 ap-rounded-lg ap-p-4 ap-bg-blue-50/50">
          <h4 className="ap-text-sm ap-font-medium ap-text-blue-800 ap-mb-3 ap-flex ap-items-center ap-gap-2">
            <HiOutlineCalendar className="ap-h-4 ap-w-4" />
            Nomination Window
          </h4>
          <p className="ap-text-xs ap-text-blue-600 ap-mb-3">
            When team members can submit nominations for this award period.
          </p>
          <div className="ap-grid ap-grid-cols-2 ap-gap-4">
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Opens</label>
              <input
                type="date"
                value={formData.nomination_start}
                onChange={(e) => setFormData(prev => ({ ...prev, nomination_start: e.target.value }))}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
                required
              />
            </div>
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Closes</label>
              <input
                type="date"
                value={formData.nomination_end}
                onChange={(e) => setFormData(prev => ({ ...prev, nomination_end: e.target.value }))}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Voting Window */}
        <div className="ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-bg-green-50/50">
          <h4 className="ap-text-sm ap-font-medium ap-text-green-800 ap-mb-3 ap-flex ap-items-center ap-gap-2">
            <HiOutlineCheckCircle className="ap-h-4 ap-w-4" />
            Voting Window
          </h4>
          <p className="ap-text-xs ap-text-green-600 ap-mb-3">
            When team members can vote on approved nominations.
          </p>
          <div className="ap-grid ap-grid-cols-2 ap-gap-4">
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Opens</label>
              <input
                type="date"
                value={formData.voting_start}
                onChange={(e) => setFormData(prev => ({ ...prev, voting_start: e.target.value }))}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
                required
              />
            </div>
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Closes</label>
              <input
                type="date"
                value={formData.voting_end}
                onChange={(e) => setFormData(prev => ({ ...prev, voting_end: e.target.value }))}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Winner Settings */}
        <div className="ap-pt-4 ap-border-t">
          <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
            <HiOutlineTrophy className="ap-h-5 ap-w-5 ap-text-amber-600" />
            <h4 className="ap-text-sm ap-font-medium ap-text-gray-900">Winner Settings</h4>
          </div>
          
          <div className="ap-space-y-4">
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">Maximum Winners</label>
              <select
                value={formData.max_winners}
                onChange={(e) => setFormData(prev => ({ ...prev, max_winners: parseInt(e.target.value) }))}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>{num} winner{num > 1 ? 's' : ''}</option>
                ))}
              </select>
              <p className="ap-mt-1 ap-text-xs ap-text-gray-500">How many winners can be selected for this award</p>
            </div>

            <label className="ap-flex ap-items-center ap-gap-3">
              <input
                type="checkbox"
                checked={formData.allow_pre_voting}
                onChange={(e) => setFormData(prev => ({ ...prev, allow_pre_voting: e.target.checked }))}
                className="ap-rounded ap-border-gray-300 ap-text-amber-600 focus:ap-ring-amber-500"
              />
              <span className="ap-text-sm ap-text-gray-700">
                Allow pre-voting (votes cast before window opens will be registered when it opens)
              </span>
            </label>
            
            {/* Winner Selection - only show when editing and there are nominations */}
            {editingPeriod && periodNominations.length > 0 && (
              <div className="ap-pt-4 ap-border-t ap-border-amber-200">
                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                  Assign Winner{formData.max_winners > 1 ? 's' : ''}
                  {formData.max_winners > 1 && (
                    <span className="ap-ml-2 ap-text-xs ap-font-normal ap-text-amber-600">
                      (Select up to {formData.max_winners})
                    </span>
                  )}
                </label>
                
                {formData.max_winners === 1 ? (
                  /* Single winner - use dropdown */
                  <select
                    value={formData.winner_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, winner_id: e.target.value ? parseInt(e.target.value) : null }))}
                    className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-bg-white"
                  >
                    <option value="">No winner selected</option>
                    {periodNominations.map((nom) => (
                      <option key={nom.id} value={nom.id}>
                        {nom.nominee?.display_name} - {nom.reason?.substring(0, 60)}{nom.reason?.length > 60 ? '...' : ''}
                        {nom.vote_count > 0 ? ` (${nom.vote_count} votes)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  /* Multiple winners - use checkboxes */
                  <div className="ap-space-y-2 ap-max-h-60 ap-overflow-y-auto ap-border ap-border-gray-200 ap-rounded-lg ap-p-3">
                    {periodNominations.map((nom) => {
                      const isWinner = nom.is_winner || nom.status === 'winner';
                      const selectedWinners = periodNominations.filter(n => n.is_winner || n.status === 'winner');
                      const canSelect = selectedWinners.length < formData.max_winners || isWinner;
                      
                      return (
                        <label
                          key={nom.id}
                          className={`ap-flex ap-items-start ap-gap-3 ap-p-2 ap-rounded hover:ap-bg-amber-50 ${
                            !canSelect ? 'ap-opacity-50 ap-cursor-not-allowed' : 'ap-cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isWinner}
                            disabled={!canSelect}
                            onChange={async (e) => {
                              if (e.target.checked) {
                                // Select as winner
                                try {
                                  await selectWinner(nom.id);
                                  // Refresh nominations to update UI
                                  const noms = await getNominationsForPeriod(editingPeriod.id);
                                  setPeriodNominations(noms);
                                } catch (err) {
                                  alert('Failed to select winner: ' + (err instanceof Error ? err.message : 'Unknown error'));
                                }
                              } else {
                                // Deselect winner - would need a new API endpoint
                                alert('To remove a winner, please use the Approvals tab or select a different winner.');
                              }
                            }}
                            className="ap-mt-0.5 ap-rounded ap-border-gray-300 ap-text-amber-600 focus:ap-ring-amber-500"
                          />
                          <div className="ap-flex-1 ap-min-w-0">
                            <div className="ap-font-medium ap-text-gray-900">
                              {nom.nominee?.display_name}
                              {nom.vote_count > 0 && (
                                <span className="ap-ml-2 ap-text-xs ap-text-gray-500">({nom.vote_count} votes)</span>
                              )}
                            </div>
                            <p className="ap-text-sm ap-text-gray-600 ap-truncate">{nom.reason}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                
                <p className="ap-mt-2 ap-text-xs ap-text-amber-700">
                  💡 {formData.max_winners === 1 ? 'Select a winner' : 'Select winners'} from approved nominations. They will be notified via email.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* TaskDeck Integration */}
        {isTaskDeckEnabled && (
          <div className="ap-pt-4 ap-border-t">
            <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
              <HiOutlineClipboardDocumentList className="ap-h-5 ap-w-5 ap-text-purple-600" />
              <h4 className="ap-text-sm ap-font-medium ap-text-gray-900">TaskDeck Reminders</h4>
            </div>
            
            <label className="ap-flex ap-items-center ap-gap-3 ap-mb-4">
              <input
                type="checkbox"
                checked={formData.taskdeck_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, taskdeck_enabled: e.target.checked }))}
                className="ap-rounded ap-border-gray-300 ap-text-purple-600 focus:ap-ring-purple-500"
              />
              <span className="ap-text-sm ap-text-gray-700">
                Create TaskDeck reminder cards for this award period
              </span>
            </label>

            {formData.taskdeck_enabled && (
              <div className="ap-space-y-4 ap-ml-7 ap-bg-purple-50 ap-rounded-lg ap-p-4">
                <p className="ap-text-xs ap-text-purple-700 ap-mb-3">
                  Reminder cards will be automatically created and assigned to selected roles when the period status changes.
                </p>
                
                {/* Nomination Reminder Roles */}
                <div>
                  <div className="ap-flex ap-items-center ap-justify-between ap-mb-1">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Nomination Reminder - Assign to Roles</label>
                    <Button
                      type="button"
                      onClick={() => {
                        if (formData.nomination_task_roles.length === jobRoles.length) {
                          setFormData(prev => ({ ...prev, nomination_task_roles: [] }));
                        } else {
                          setFormData(prev => ({ ...prev, nomination_task_roles: jobRoles.map(r => r.id) }));
                        }
                      }}
                      variant="link"
                      size="xs"
                    >
                      {formData.nomination_task_roles.length === jobRoles.length ? 'Unselect All' : 'Select All'}
                    </Button>
                  </div>
                  <p className="ap-text-xs ap-text-gray-500 ap-mb-2">A reminder card will be created when nominations open, assigned to these roles.</p>
                  <div className="ap-flex ap-flex-wrap ap-gap-2">
                    {jobRoles.map(role => (
                      <label key={role.id} className="ap-flex ap-items-center ap-gap-1.5 ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-border">
                        <input
                          type="checkbox"
                          checked={formData.nomination_task_roles.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, nomination_task_roles: [...prev.nomination_task_roles, role.id] }));
                            } else {
                              setFormData(prev => ({ ...prev, nomination_task_roles: prev.nomination_task_roles.filter(id => id !== role.id) }));
                            }
                          }}
                          className="ap-rounded ap-border-gray-300 ap-text-amber-600 focus:ap-ring-amber-500"
                        />
                        <span className="ap-text-sm">{role.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Voting Reminder Roles */}
                <div>
                  <div className="ap-flex ap-items-center ap-justify-between ap-mb-1">
                    <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Voting Reminder - Assign to Roles</label>
                    <Button
                      type="button"
                      onClick={() => {
                        if (formData.voting_task_roles.length === jobRoles.length) {
                          setFormData(prev => ({ ...prev, voting_task_roles: [] }));
                        } else {
                          setFormData(prev => ({ ...prev, voting_task_roles: jobRoles.map(r => r.id) }));
                        }
                      }}
                      variant="link"
                      size="xs"
                    >
                      {formData.voting_task_roles.length === jobRoles.length ? 'Unselect All' : 'Select All'}
                    </Button>
                  </div>
                  <p className="ap-text-xs ap-text-gray-500 ap-mb-2">A reminder card will be created when voting opens, assigned to these roles.</p>
                  <div className="ap-flex ap-flex-wrap ap-gap-2">
                    {jobRoles.map(role => (
                      <label key={role.id} className="ap-flex ap-items-center ap-gap-1.5 ap-bg-white ap-px-2 ap-py-1 ap-rounded ap-border">
                        <input
                          type="checkbox"
                          checked={formData.voting_task_roles.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, voting_task_roles: [...prev.voting_task_roles, role.id] }));
                            } else {
                              setFormData(prev => ({ ...prev, voting_task_roles: prev.voting_task_roles.filter(id => id !== role.id) }));
                            }
                          }}
                          className="ap-rounded ap-border-gray-300 ap-text-purple-600 focus:ap-ring-purple-500"
                        />
                        <span className="ap-text-sm">{role.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Show existing card status when editing */}
                {editingPeriod?.taskdeck_cards && (
                  <div className="ap-mt-4 ap-pt-4 ap-border-t ap-border-purple-200">
                    <p className="ap-text-xs ap-font-medium ap-text-purple-700 ap-mb-2">Current Card Status:</p>
                    <div className="ap-space-y-1 ap-text-xs">
                      {editingPeriod.taskdeck_cards.nomination && (
                        <div className="ap-flex ap-items-center ap-gap-2">
                          <span className={`ap-inline-flex ap-items-center ap-gap-1 ${editingPeriod.taskdeck_cards.nomination.is_completed ? 'ap-text-green-600' : 'ap-text-amber-600'}`}>
                            {editingPeriod.taskdeck_cards.nomination.is_completed ? (
                              <><HiOutlineCheckCircle className="ap-h-4 ap-w-4" /> Nomination card completed</>
                            ) : (
                              <><HiOutlineClock className="ap-h-4 ap-w-4" /> Nomination card active</>
                            )}
                          </span>
                        </div>
                      )}
                      {editingPeriod.taskdeck_cards.voting && (
                        <div className="ap-flex ap-items-center ap-gap-2">
                          <span className={`ap-inline-flex ap-items-center ap-gap-1 ${editingPeriod.taskdeck_cards.voting.is_completed ? 'ap-text-green-600' : 'ap-text-purple-600'}`}>
                            {editingPeriod.taskdeck_cards.voting.is_completed ? (
                              <><HiOutlineCheckCircle className="ap-h-4 ap-w-4" /> Voting card completed</>
                            ) : (
                              <><HiOutlineClock className="ap-h-4 ap-w-4" /> Voting card active</>
                            )}
                          </span>
                        </div>
                      )}
                      {!editingPeriod.taskdeck_cards.nomination && !editingPeriod.taskdeck_cards.voting && (
                        <p className="ap-text-gray-500">No cards created yet - cards will be created when the period status changes.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ap-px-6 ap-py-4 ap-border-t ap-bg-gray-50 ap-flex ap-justify-end ap-gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setIsFormOpen(false);
            setEditingPeriod(null);
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSaving}
          loading={isSaving}
        >
          {editingPeriod ? 'Save Changes' : 'Create Award'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="ap-space-y-6">
      {/* Header */}
      <div className="ap-flex ap-flex-col sm:ap-flex-row sm:ap-items-center sm:ap-justify-between ap-gap-4">
        <div>
          <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-flex ap-items-center ap-gap-2">
            <HiOutlineTrophy className="ap-h-7 ap-w-7 ap-text-yellow-500" />
            Awards
          </h2>
          <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
            Create and manage awards for employee recognition.
          </p>
        </div>
        <Button
          onClick={handleCreateNew}
          variant="primary"
          leftIcon={<HiOutlinePlus className="ap-h-5 ap-w-5" />}
        >
          New Period
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
          <HiOutlineXCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
          <span>{error}</span>
          <Button onClick={() => setError(null)} variant="ghost" size="xs" className="ap-ml-auto !ap-text-red-500 hover:!ap-text-red-700 !ap-p-0.5 !ap-min-h-0">×</Button>
        </div>
      )}

      {successMessage && (
        <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-text-green-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
          <HiOutlineCheckCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Inline Add Form - shows at top when creating new */}
      {isFormOpen && !editingPeriod && (
        <div className="ap-animate-fade-in-down">
          {periodForm}
        </div>
      )}

      {/* Filters */}
      <div className="ap-flex ap-items-center ap-gap-4 ap-flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PeriodStatus | '')}
          className="ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2 ap-text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="nominations_open">Nominations Open</option>
          <option value="voting_open">Voting Open</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="winner_declared">Winner Declared</option>
          <option value="completed">Completed</option>
        </select>
        
        <label className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-text-gray-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="ap-rounded ap-border-gray-300"
          />
          Show Archived
        </label>
      </div>
      
      {/* Bulk Actions */}
      {periods.length > 0 && (
        <div className="ap-flex ap-items-center ap-gap-3 ap-bg-gray-50 ap-px-4 ap-py-3 ap-rounded-lg ap-border ap-border-gray-200">
          <Button
            onClick={handleSelectAll}
            variant="link"
            size="xs"
            className="ap-flex ap-items-center ap-gap-2"
          >
            <input
              type="checkbox"
              checked={selectedPeriods.length === periods.length && periods.length > 0}
              onChange={handleSelectAll}
              className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
            />
            {selectedPeriods.length === periods.length && periods.length > 0 ? 'Deselect All' : 'Select All'}
          </Button>
          
          {selectedPeriods.length > 0 && (
            <>
              <span className="ap-text-sm ap-text-gray-600">
                {selectedPeriods.length} selected
              </span>
              <Button
                onClick={handleBulkArchive}
                disabled={isBulkProcessing}
                variant="warning-outline"
                size="xs"
                leftIcon={<HiOutlineArchiveBox className="ap-h-4 ap-w-4" />}
              >
                <span>{showArchived ? 'Restore Selected' : 'Archive Selected'}</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Periods List */}
      <div className="ap-space-y-4">
        {periods.length === 0 ? (
          <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg">
            <HiOutlineCalendar className="ap-h-12 ap-w-12 ap-mx-auto ap-text-gray-400 ap-mb-3" />
            <p className="ap-text-gray-500">No award periods found.</p>
            <Button
              onClick={handleCreateNew}
              variant="link"
              className="ap-mt-4"
            >
              Create your first award period
            </Button>
          </div>
        ) : (
          periods.map(period => {
            const badge = getStatusBadge(period.status, period.archived);
            const isEditingThisPeriod = isFormOpen && editingPeriod?.id === period.id;

            return (
              <React.Fragment key={period.id}>
                <div
                  className={`ap-bg-white ap-rounded-lg ap-shadow ap-border ${
                    period.archived ? 'ap-opacity-75' : ''
                  } ${isEditingThisPeriod ? 'ap-ring-2 ap-ring-blue-500' : ''}`}
                >
                  {/* Period Header */}
                  <div className="ap-p-4 ap-flex ap-items-center ap-justify-between">
                    <div className="ap-flex ap-items-center ap-gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPeriods.includes(period.id)}
                        onChange={() => handleToggleSelect(period.id)}
                        className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded ap-cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div>
                        <div className="ap-flex ap-items-center ap-gap-2">
                          <span className="ap-font-semibold ap-text-gray-900">
                            {getPeriodDisplayName(period)}
                          </span>
                          <span className={`ap-text-xs ap-px-2 ap-py-0.5 ap-rounded-full ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="ap-text-sm ap-text-gray-500 ap-flex ap-items-center ap-gap-2 ap-mt-0.5">
                          {(period.nomination_end || period.nomination_deadline) && (
                            <>
                              <HiOutlineClock className="ap-h-4 ap-w-4" />
                              Nominations close: {formatDate(period.nomination_end || period.nomination_deadline)}
                            </>
                          )}
                          {!period.nomination_end && !period.nomination_deadline && (
                            <>
                              <HiOutlineCalendar className="ap-h-4 ap-w-4" />
                              {formatDateRange(period.start_date, period.end_date)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ap-flex ap-items-center ap-gap-3">
                      {renderStatusActions(period)}
                      
                      {/* Edit is available for all non-archived periods */}
                      {!period.archived && (
                        <Button
                          onClick={() => handleEdit(period)}
                          variant="ghost"
                          size="xs"
                          className="!ap-text-gray-500 hover:!ap-text-gray-700 !ap-p-1 !ap-min-h-0"
                          title="Edit"
                        >
                          <HiOutlinePencil className="ap-h-5 ap-w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Inline Edit Form - shows under the row being edited */}
                {isEditingThisPeriod && (
                  <div className="ap-ml-6 ap-border-l-4 ap-border-blue-500 ap-pl-4 ap-animate-fade-in-down">
                    {periodForm}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal - keeping as small modal */}
      {deleteTarget && (
        <div className="ap-fixed ap-inset-0 ap-bg-black ap-bg-opacity-50 ap-flex ap-items-center ap-justify-center ap-p-4 ap-z-50">
          <div className="ap-bg-white ap-rounded-lg ap-shadow-xl ap-max-w-md ap-w-full ap-p-6">
            <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">
              Confirm Delete
            </h3>
            <p className="ap-text-gray-600 ap-mb-4">
              Are you sure you want to delete {deleteTarget.name}? This action cannot be undone.
            </p>
            <div className="ap-flex ap-justify-end ap-gap-3">
              <Button
                onClick={() => setDeleteTarget(null)}
                variant="ghost"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                variant="danger"
                loading={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwardPeriodManagement;
