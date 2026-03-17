import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  HiOutlineTrophy, 
  HiOutlineUser, 
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineEyeSlash,
  HiOutlineCalendar
} from 'react-icons/hi2';
import LoadingSpinner from './LoadingSpinner';
import BlockEditor from './BlockEditor';
import { AwardPeriod } from '@/types/awesome-awards';
import { Button } from './ui';

/**
 * NominationForm Component
 * 
 * Form for creating new nominations. Features:
 * - Period and category selection
 * - User search/selection for nominee
 * - BlockNote rich text editor for reason
 * - Anonymous nomination toggle
 */

interface SimpleUser {
  id: number;
  display_name: string;
  email?: string;
  avatar_url?: string;
}

interface NominationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preselectedPeriodId?: number;
  preselectedCategoryId?: number;
}

// Helper to generate period display name
function getPeriodDisplayName(period: AwardPeriod): string {
  // If custom name exists, use it
  if (period.name) {
    return period.name;
  }
  
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

// API helpers
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

async function getActivePeriods() {
  return apiFetch<AwardPeriod[]>('/awesome-awards/active-periods');
}

async function getSimpleUsers(): Promise<SimpleUser[]> {
  // Use the awards-specific users endpoint which excludes current user
  return apiFetch<SimpleUser[]>('/awesome-awards/users/simple');
}

async function createNomination(data: {
  period_id: number;
  category_id?: number | null; // Optional - categories deprecated
  nominee_id: number;
  reason_text: string;
  reason_json: string;
  is_anonymous: boolean;
}) {
  return apiFetch(`/awesome-awards/periods/${data.period_id}/nominations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

const NominationForm: React.FC<NominationFormProps> = ({
  onSuccess,
  onCancel,
  preselectedPeriodId,
}) => {
  // Data state
  const [periods, setPeriods] = useState<AwardPeriod[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(preselectedPeriodId || null);
  const [selectedNomineeId, setSelectedNomineeId] = useState<number | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonJson, setReasonJson] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // User search
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [periodsData, usersData] = await Promise.all([
          getActivePeriods(),
          getSimpleUsers(),
        ]);
        setPeriods(periodsData);
        setUsers(usersData);

        // Auto-select if only one period
        if (periodsData.length === 1 && !preselectedPeriodId) {
          setSelectedPeriodId(periodsData[0].id);
        }
      } catch (err) {
        console.error('Failed to load form data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [preselectedPeriodId]);

  // Get selected period
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  // Filter users for search
  const filteredUsers = users.filter(user => 
    user.display_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Get selected nominee
  const selectedNominee = users.find(u => u.id === selectedNomineeId);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPeriodId || !selectedNomineeId) {
      setError('Please select an award and a nominee');
      return;
    }

    if (reasonText.trim().length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createNomination({
        period_id: selectedPeriodId,
        category_id: null, // Categories deprecated - award name defines the award
        nominee_id: selectedNomineeId,
        reason_text: reasonText,
        reason_json: reasonJson,
        is_anonymous: isAnonymous,
      });

      setSuccessMessage('Nomination submitted successfully!');
      
      // Reset form
      setSelectedNomineeId(null);
      setReasonText('');
      setReasonJson('');
      setIsAnonymous(false);
      setUserSearch('');

      // Callback
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error('Nomination error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit nomination');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle editor change - BlockEditor returns block content
  const handleEditorChange = useCallback((blocks: any) => {
    // Store the JSON blocks
    const jsonStr = JSON.stringify(blocks);
    setReasonJson(jsonStr);
    
    // Extract plain text from blocks for validation/display
    const extractText = (blockArray: any[]): string => {
      if (!Array.isArray(blockArray)) return '';
      return blockArray.map((block: any) => {
        if (block.content) {
          if (typeof block.content === 'string') return block.content;
          if (Array.isArray(block.content)) {
            return block.content.map((c: any) => c.text || '').join('');
          }
        }
        if (block.children) return extractText(block.children);
        return '';
      }).join('\n').trim();
    };
    
    const text = extractText(blocks);
    setReasonText(text);
  }, []);

  if (isLoading) {
    return (
      <div className="ap-flex ap-justify-center ap-items-center ap-py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="ap-text-center ap-py-12 ap-bg-gray-50 ap-rounded-lg">
        <HiOutlineCalendar className="ap-h-12 ap-w-12 ap-mx-auto ap-text-gray-400 ap-mb-3" />
        <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-2">No Active Award Periods</h3>
        <p className="ap-text-gray-500">
          There are no award periods currently accepting nominations.
        </p>
      </div>
    );
  }

  return (
    <div className="ap-max-w-2xl ap-mx-auto">
      <div className="ap-bg-white ap-rounded-lg ap-shadow-lg ap-overflow-hidden">
        {/* Header */}
        <div className="ap-bg-gradient-to-r ap-from-yellow-500 ap-to-orange-500 ap-px-6 ap-py-4">
          <h2 className="ap-text-xl ap-font-bold ap-text-white ap-flex ap-items-center ap-gap-2">
            <HiOutlineTrophy className="ap-h-6 ap-w-6" />
            Nominate Someone
          </h2>
          <p className="ap-text-yellow-100 ap-text-sm ap-mt-1">
            Recognize a colleague's outstanding contributions
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="ap-mx-6 ap-mt-4 ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
            <HiOutlineXCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="ap-mx-6 ap-mt-4 ap-bg-green-50 ap-border ap-border-green-200 ap-text-green-700 ap-px-4 ap-py-3 ap-rounded-lg ap-flex ap-items-center ap-gap-2">
            <HiOutlineCheckCircle className="ap-h-5 ap-w-5 ap-flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="ap-p-6 ap-space-y-6">
          {/* Award Selection */}
          {periods.length > 1 ? (
            <div>
              <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                Award <span className="ap-text-red-500">*</span>
              </label>
              <select
                value={selectedPeriodId || ''}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value ? Number(e.target.value) : null);
                }}
                className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2"
                required
              >
                <option value="">Select an award...</option>
                {periods.map(period => (
                  <option key={period.id} value={period.id}>
                    {getPeriodDisplayName(period)}
                  </option>
                ))}
              </select>
            </div>
          ) : selectedPeriod && (
            <div className="ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg ap-px-4 ap-py-3">
              <p className="ap-text-sm ap-text-amber-800">
                <span className="ap-font-medium">Nominating for:</span> {getPeriodDisplayName(selectedPeriod)}
              </p>
            </div>
          )}

          {/* Nominee Selection */}
          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
              Who are you nominating? <span className="ap-text-red-500">*</span>
            </label>
            
            {selectedNominee ? (
              <div className="ap-flex ap-items-center ap-justify-between ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-px-4 ap-py-3">
                <div className="ap-flex ap-items-center ap-gap-3">
                  {selectedNominee.avatar_url ? (
                    <img 
                      src={selectedNominee.avatar_url} 
                      alt="" 
                      className="ap-h-10 ap-w-10 ap-rounded-full"
                    />
                  ) : (
                    <div className="ap-h-10 ap-w-10 ap-rounded-full ap-bg-blue-200 ap-flex ap-items-center ap-justify-center">
                      <HiOutlineUser className="ap-h-5 ap-w-5 ap-text-blue-600" />
                    </div>
                  )}
                  <span className="ap-font-medium ap-text-gray-900">{selectedNominee.display_name}</span>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedNomineeId(null);
                    setUserSearch('');
                  }}
                  variant="link"
                  size="sm"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="ap-relative" ref={userDropdownRef}>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search for a colleague..."
                  className="ap-w-full ap-border ap-border-gray-300 ap-rounded-lg ap-px-3 ap-py-2"
                />
                
                {showUserDropdown && userSearch && (
                  <div className="ap-absolute ap-z-10 ap-w-full ap-mt-1 ap-bg-white ap-border ap-border-gray-200 ap-rounded-lg ap-shadow-lg ap-max-h-60 ap-overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="ap-px-4 ap-py-3 ap-text-gray-500 ap-text-sm">No users found</div>
                    ) : (
                      filteredUsers.slice(0, 10).map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedNomineeId(user.id);
                            setUserSearch('');
                            setShowUserDropdown(false);
                          }}
                          className="ap-w-full ap-px-4 ap-py-2 ap-text-left hover:ap-bg-gray-50 ap-flex ap-items-center ap-gap-3"
                        >
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="ap-h-8 ap-w-8 ap-rounded-full" />
                          ) : (
                            <div className="ap-h-8 ap-w-8 ap-rounded-full ap-bg-gray-200 ap-flex ap-items-center ap-justify-center">
                              <HiOutlineUser className="ap-h-4 ap-w-4 ap-text-gray-500" />
                            </div>
                          )}
                          <span>{user.display_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
              Why are you nominating them? <span className="ap-text-red-500">*</span>
            </label>
            <p className="ap-text-xs ap-text-gray-500 ap-mb-2">
              Describe their contributions, achievements, or behaviors that deserve recognition.
            </p>
            <div className="ap-border ap-border-gray-300 ap-rounded-lg ap-overflow-hidden">
              <BlockEditor
                initialContent={reasonJson}
                onChange={handleEditorChange}
              />
            </div>
            <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
              {reasonText.length}/5000 characters (minimum 10)
            </p>
          </div>

          {/* Anonymous Toggle */}
          <div className="ap-flex ap-items-start ap-gap-3 ap-bg-gray-50 ap-rounded-lg ap-p-4">
            <div className="ap-flex ap-items-center ap-h-5 ap-mt-0.5">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="ap-h-4 ap-w-4 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="anonymous" className="ap-flex ap-items-center ap-gap-2 ap-text-sm ap-font-medium ap-text-gray-700">
                <HiOutlineEyeSlash className="ap-h-4 ap-w-4" />
                Submit anonymously
              </label>
              <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                Your name will not be shown to others (admins can still see it for moderation purposes)
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="ap-flex ap-justify-end ap-gap-3 ap-pt-4 ap-border-t">
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="ghost"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !selectedPeriodId || !selectedNomineeId || reasonText.length < 10}
              variant="primary"
              loading={isSubmitting}
              leftIcon={!isSubmitting ? <HiOutlineSparkles className="ap-h-5 ap-w-5" /> : undefined}
              className="!ap-bg-gradient-to-r !ap-from-yellow-500 !ap-to-orange-500 hover:!ap-from-yellow-600 hover:!ap-to-orange-600"
            >
              Submit Nomination
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NominationForm;
