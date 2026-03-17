import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import {
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineExclamationTriangle,
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineUser,
    HiOutlinePencilSquare
} from 'react-icons/hi2';

/**
 * PublicReturnForm - Public-facing form for employees to submit return intent
 * 
 * This form is accessed via a secure token link (no login required).
 * Shows the employee their current pay, projected pay, and allows them
 * to indicate if they're returning for the next season.
 */

interface LongevityBreakdownItem {
    year: number;
    rate: number;
    note?: string | null;
    is_first_year: boolean;
}

interface ReturnFormData {
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        display_name: string;
    };
    season: {
        id: number;
        name: string;
        year: number;
        start_date: string;
        end_date: string;
    };
    job_roles?: Array<{ id: number; title: string }>;
    pay_breakdown: {
        base_rate: number;
        role_bonus: { amount: number; role_name: string } | null;
        longevity: { 
            bonus: number; 
            years: number;
            breakdown?: LongevityBreakdownItem[];
        } | null;
        time_bonuses?: Array<{ id: number; name: string; amount: number }>;
        time_bonus_total: number;
        total: number;
    };
    projected_pay: {
        base_rate: number;
        role_bonus: { amount: number; role_name: string } | null;
        longevity: { 
            bonus: number; 
            years: number;
            projected_years?: number;
            breakdown?: LongevityBreakdownItem[];
        } | null;
        time_bonuses?: Array<{ id: number; name: string; amount: number }>;
        time_bonus_total?: number;
        total: number;
    };
    already_submitted?: boolean;
    current_status?: string;
}

interface PublicReturnFormProps {
    token?: string; // Can be passed as prop or read from URL
}

// Use the API URL from WordPress localized data if available, falling back to hardcoded default.
// This ensures the URL is correct even if WordPress is installed in a subdirectory.
const API_BASE = ((window as any).mentorshipPlatformData?.api_url
    ? `${(window as any).mentorshipPlatformData.api_url}/srm`
    : '/wp-json/mentorship-platform/v1/srm');

const PublicReturnForm: React.FC<PublicReturnFormProps> = ({ token: propToken }) => {
    // Get token from URL if not passed as prop
    // Supports both:
    //   /return-form/TOKEN (path-based, preferred)
    //   /return-form/?token=TOKEN (query string, legacy)
    const urlToken = new URLSearchParams(window.location.search).get('token');
    const dataToken = document.getElementById('root')?.getAttribute('data-token');
    const wpToken = (window as any).mentorshipPlatformData?.return_form_token;
    
    // Extract token from path: /return-form/abc123... -> abc123...
    let pathToken = '';
    const pathMatch = window.location.pathname.match(/\/return-form\/([a-f0-9]+)\/?$/i);
    if (pathMatch) {
        pathToken = pathMatch[1];
    }
    
    const token = propToken || pathToken || urlToken || dataToken || wpToken || '';
    
    // Debug: log token sources so we can diagnose empty-token issues
    if (!token) {
        console.warn('SRM PublicReturnForm: No token found.', {
            propToken,
            pathToken,
            urlToken,
            dataToken,
            wpToken,
            href: window.location.href,
        });
    } else {
        const source = propToken ? 'prop' : pathToken ? 'path' : urlToken ? 'query' : dataToken ? 'data-attr' : 'wp-data';
        console.log('SRM PublicReturnForm: token resolved', { source, length: token.length });
    }
    
    const [formData, setFormData] = useState<ReturnFormData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [submittedStatus, setSubmittedStatus] = useState<'returning' | 'not_returning' | null>(null);
    
    // Form fields
    const [comments, setComments] = useState('');
    const [signature, setSignature] = useState('');
    
    useEffect(() => {
        if (token) {
            loadFormData();
        } else {
            setError('Invalid or missing access token');
            setLoading(false);
        }
    }, [token]);
    
    const loadFormData = async () => {
        try {
            setLoading(true);
            
            // CRITICAL: Use credentials: 'omit' to prevent WordPress auth cookies from
            // being sent. This endpoint is public (__return_true permission). Sending cookies
            // when a logged-in admin tests the link can trigger WordPress cookie nonce checks
            // or security plugin interference, causing intermittent 403 errors.
            const response = await fetch(`${API_BASE}/return-form/${token}`, {
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            // Handle non-JSON responses (e.g., HTML error pages from server/proxy)
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.error(`SRM: Non-JSON response (${response.status}): content-type=${contentType}`);
                if (response.status === 404) {
                    throw new Error('The REST API endpoint was not found. The plugin may need to be reactivated.');
                } else if (response.status === 403) {
                    throw new Error('Access was blocked (403). A security plugin or server firewall may be interfering.');
                } else if (response.status >= 500) {
                    throw new Error(`Server error (${response.status}). Please try again in a few minutes.`);
                }
                throw new Error(`Unexpected server response (HTTP ${response.status}). Please contact your supervisor.`);
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                // Show specific error from the API with the HTTP status for diagnostics
                const apiMessage = result.message || result.data?.message;
                const errorCode = result.code || 'unknown';
                console.error(`SRM: API error - status=${response.status}, code=${errorCode}, message=${apiMessage}`);
                
                // Handle specific error codes from the API
                if (errorCode === 'token_not_found') {
                    throw new Error('This link is not recognized. If a new email was sent, please use the link from the most recent one.');
                } else if (errorCode === 'token_expired') {
                    throw new Error('This link has expired. Please contact your supervisor to request a new one.');
                } else if (errorCode === 'user_not_found') {
                    throw new Error('Your user account could not be found. Please contact your supervisor.');
                } else if (errorCode === 'data_load_error') {
                    throw new Error('Unable to load form data. Please try again in a few minutes.');
                } else if (response.status === 403) {
                    throw new Error('Access denied. A security plugin may be blocking this request. (Error 403)');
                } else if (response.status === 401) {
                    throw new Error('Authentication error. This form should not require login. (Error 401)');
                }
                // Fall back to API message or generic error
                throw new Error(apiMessage || `Request failed (HTTP ${response.status})`);
            }
            
            // API returns { success, data: {...}, already_submitted }
            // Transform flat data structure to expected nested format
            const apiData = result.data;
            
            if (!apiData || !apiData.user) {
                console.error('Invalid data structure received:', apiData);
                throw new Error('Invalid data received from server');
            }

            const formDataFromApi: ReturnFormData = {
                user: apiData.user,
                season: {
                    id: apiData.season_id,
                    name: apiData.season_name,
                    year: new Date(apiData.season_start).getFullYear(),
                    start_date: apiData.season_start,
                    end_date: apiData.season_end
                },
                job_roles: apiData.job_roles || [],
                pay_breakdown: apiData.pay_breakdown,
                projected_pay: apiData.projected_pay,
                already_submitted: result.already_submitted,
                current_status: apiData.return_status
            };
            
            setFormData(formDataFromApi);
            
            // Pre-fill previous response data if already submitted
            if (result.already_submitted) {
                setComments(apiData.comments || '');
                setSignature(apiData.signature_text || '');
            }
        } catch (err: any) {
            // Distinguish network errors from API errors
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setError('Network error: Could not reach the server. Check your internet connection.');
            } else {
                setError(err.message || 'Failed to load form');
            }
        } finally {
            setLoading(false);
        }
    };
    
    const handleSubmit = async (returning: boolean) => {
        if (!signature.trim()) {
            setError('Please sign with your name to confirm');
            return;
        }
        
        setSubmitting(true);
        setError(null);
        
        try {
            // CRITICAL: credentials: 'omit' — same rationale as loadFormData
            const response = await fetch(`${API_BASE}/return-form/${token}`, {
                method: 'POST',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    is_returning: returning,
                    comments: comments.trim(),
                    signature: signature.trim()
                })
            });
            
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Server returned an unexpected response (HTTP ${response.status}). Please try again.`);
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `Failed to submit response (HTTP ${response.status})`);
            }
            
            setSubmitted(true);
            setSubmittedStatus(returning ? 'returning' : 'not_returning');
        } catch (err: any) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setError('Network error: Could not reach the server. Check your internet connection.');
            } else {
                setError(err.message || 'Failed to submit your response');
            }
        } finally {
            setSubmitting(false);
        }
    };
    
    const formatCurrency = (amount: number | undefined | null): string => {
        if (amount === undefined || amount === null) return '$0.00';
        return `$${amount.toFixed(2)}`;
    };
    
    if (loading) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-600/10 ap-to-white ap-flex ap-items-center ap-justify-center ap-p-4">
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-xl ap-p-8 ap-max-w-md ap-w-full ap-text-center">
                    <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500 ap-mx-auto ap-mb-4"></div>
                    <p className="ap-text-gray-600">Loading your return form...</p>
                </div>
            </div>
        );
    }
    
    if (error && !formData) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-red-50 ap-to-white ap-flex ap-items-center ap-justify-center ap-p-4">
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-xl ap-p-8 ap-max-w-md ap-w-full ap-text-center">
                    <div className="ap-w-16 ap-h-16 ap-bg-red-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                        <HiOutlineExclamationTriangle className="ap-w-8 ap-h-8 ap-text-red-600" />
                    </div>
                    <h1 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-2">Unable to Load Form</h1>
                    <p className="ap-text-gray-600 ap-mb-4">{error}</p>
                    <button
                        onClick={() => { setError(null); setLoading(true); loadFormData(); }}
                        className="ap-inline-flex ap-items-center ap-px-4 ap-py-2 ap-bg-blue-600 ap-text-white ap-rounded-lg ap-text-sm ap-font-medium hover:ap-bg-blue-700 ap-transition-colors ap-mb-4"
                    >
                        Try Again
                    </button>
                    <p className="ap-text-sm ap-text-gray-500">
                        If you believe this is an error, please contact your supervisor.
                    </p>
                    <p className="ap-text-xs ap-text-gray-400 ap-mt-2">
                        Token: {token ? `${token.substring(0, 8)}...` : 'none'} | API: {API_BASE}
                    </p>
                </div>
            </div>
        );
    }
    
    if (submitted) {
        return (
            <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-green-50 ap-to-white ap-flex ap-items-center ap-justify-center ap-p-4">
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-xl ap-p-8 ap-max-w-md ap-w-full ap-text-center">
                    <div className={`ap-w-16 ap-h-16 ${submittedStatus === 'returning' ? 'ap-bg-green-100' : 'ap-bg-orange-100'} ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4`}>
                        {submittedStatus === 'returning' ? (
                            <HiOutlineCheckCircle className="ap-w-8 ap-h-8 ap-text-green-600" />
                        ) : (
                            <HiOutlineXCircle className="ap-w-8 ap-h-8 ap-text-orange-600" />
                        )}
                    </div>
                    <h1 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-2">
                        {submittedStatus === 'returning' 
                            ? 'Thank You for Your Response!' : 'Response Received'
                        }
                    </h1>
                    <p className="ap-text-gray-600 ap-mb-4">
                        {submittedStatus === 'returning'
                            ? "We're excited ap-to have you back next season! You'll receive a confirmation email shortly." : "Thank you for letting us know. We wish you all the best in your future endeavors."
                        }
                    </p>
                    {formData && (
                        <div className="ap-mt-6 ap-p-4 ap-bg-gray-50 ap-rounded-lg ap-text-left">
                            <p className="ap-text-sm ap-text-gray-500 ap-mb-1">Response submitted for:</p>
                            <p className="ap-font-medium ap-text-gray-900">{formData.season.name}</p>
                        </div>
                    )}
                    {/* Option to update response */}
                    <Button
                        onClick={() => setSubmitted(false)}
                        variant="ghost"
                        className="!ap-mt-6 !ap-text-blue-600 hover:!ap-text-blue-700 hover:!ap-underline"
                    >
                        Need to change your response? Click here to update.
                    </Button>
                </div>
            </div>
        );
    }
    
    if (!formData) return null;
    
    return (
        <div className="ap-min-h-screen ap-bg-gradient-to-br ap-from-blue-600/5 ap-to-white ap-py-8 ap-px-4">
            <div className="ap-max-w-2xl ap-mx-auto">
                {/* Header */}
                <div className="ap-text-center ap-mb-8">
                    <h1 className="ap-text-3xl ap-font-bold ap-text-gray-900 ap-mb-2">
                        Seasonal Return Intent Form
                    </h1>
                    <p className="ap-text-gray-600">
                        Please review the information below and let us know if you plan to return
                    </p>
                </div>
                
                {/* Previous Response Banner */}
                {formData.already_submitted && formData.current_status && (
                    <div className={`ap-mb-6 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3 ${
                        formData.current_status === 'returning' 
                            ? 'ap-bg-green-50 ap-border ap-border-green-200' : 'ap-bg-orange-50 ap-border ap-border-orange-200'
                    }`}>
                        {formData.current_status === 'returning' ? (
                            <HiOutlineCheckCircle className="ap-w-5 ap-h-5 ap-text-green-600 ap-flex-shrink-0 ap-mt-0.5" />
                        ) : (
                            <HiOutlineXCircle className="ap-w-5 ap-h-5 ap-text-orange-600 ap-flex-shrink-0 ap-mt-0.5" />
                        )}
                        <div>
                            <p className={`ap-font-medium ${formData.current_status === 'returning' ? 'ap-text-green-800' : 'ap-text-orange-800'}`}>
                                You previously responded: {formData.current_status === 'returning' ? "Yes, I'm returning" : "No, I'm not returning"}
                            </p>
                            <p className={`ap-text-sm ${formData.current_status === 'returning' ? 'ap-text-green-700' : 'ap-text-orange-700'}`}>
                                You can update your response below if you've changed your mind.
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Error Alert */}
                {error && (
                    <div className="ap-mb-6 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-start ap-gap-3">
                        <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-600 ap-flex-shrink-0 ap-mt-0.5" />
                        <p className="ap-text-red-800">{error}</p>
                    </div>
                )}
                
                {/* Employee Info Card */}
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-p-6 ap-mb-6">
                    <div className="ap-flex ap-items-center ap-gap-4 ap-mb-4">
                        <div className="ap-w-14 ap-h-14 ap-bg-blue-50 ap-rounded-full ap-flex ap-items-center ap-justify-center">
                            <HiOutlineUser className="ap-w-7 ap-h-7 ap-text-blue-600" />
                        </div>
                        <div>
                            <h2 className="ap-text-xl ap-font-semibold ap-text-gray-900">
                                {formData.user.display_name}
                            </h2>
                            <p className="ap-text-gray-500">{formData.user.email}</p>
                        </div>
                    </div>
                    
                    {/* Job Roles */}
                    {formData.job_roles && formData.job_roles.length > 0 ? (
                        <div className="ap-mb-4">
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                {formData.job_roles.map(role => (
                                    <span key={role.id} className="ap-inline-flex ap-px-3 ap-py-1 ap-text-sm ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                        {role.title}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : formData.pay_breakdown.role_bonus?.role_name ? (
                        <div className="ap-mb-4">
                            <div className="ap-flex ap-flex-wrap ap-gap-2">
                                <span className="ap-inline-flex ap-px-3 ap-py-1 ap-text-sm ap-font-medium ap-rounded-full ap-bg-blue-100 ap-text-blue-800">
                                    {formData.pay_breakdown.role_bonus.role_name}
                                </span>
                            </div>
                        </div>
                    ) : null}
                    
                    <div className="ap-flex ap-items-center ap-gap-2 ap-text-gray-600 ap-bg-gray-50 ap-rounded-lg ap-p-3">
                        <HiOutlineCalendar className="ap-w-5 ap-h-5" />
                        <span className="ap-font-medium">{formData.season.name}</span>
                        <span className="ap-text-gray-400">|</span>
                        <span className="ap-text-sm">
                            {new Date(formData.season.start_date).toLocaleDateString()} - {new Date(formData.season.end_date).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                
                {/* Pay Information */}
                <div className="ap-grid md:ap-grid-cols-2 ap-gap-6 ap-mb-6">
                    {/* Current Pay */}
                    <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-p-6">
                        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
                            <HiOutlineCurrencyDollar className="ap-w-6 ap-h-6 ap-text-blue-600" />
                            <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Current Pay Rate</h3>
                        </div>
                        
                        <div className="ap-space-y-3">
                            <div className="ap-flex ap-justify-between">
                                <span className="ap-text-gray-600">Base Rate</span>
                                <span className="ap-font-medium">{formatCurrency(formData.pay_breakdown.base_rate)}</span>
                            </div>
                            
                            {(formData.pay_breakdown.role_bonus?.amount ?? 0) > 0 && (
                                <div className="ap-flex ap-justify-between">
                                    <div>
                                        <span className="ap-text-gray-600">Role Bonus</span>
                                        {formData.job_roles && formData.job_roles.length > 0 ? (
                                            <p className="ap-text-xs ap-text-gray-500">
                                                {formData.job_roles.map(r => r.title).join(', ')}
                                            </p>
                                        ) : formData.pay_breakdown.role_bonus?.role_name && (
                                            <p className="ap-text-xs ap-text-gray-500">
                                                {formData.pay_breakdown.role_bonus.role_name}
                                            </p>
                                        )}
                                    </div>
                                    <span className="ap-font-medium ap-text-green-600">
                                        +{formatCurrency(formData.pay_breakdown.role_bonus?.amount)}
                                    </span>
                                </div>
                            )}
                            
                            {/* Longevity with breakdown */}
                            <div>
                                <div className="ap-flex ap-justify-between">
                                    <span className="ap-text-gray-600">
                                        Longevity ({formData.pay_breakdown.longevity?.years ?? 1} yrs)
                                    </span>
                                    <span className="ap-font-medium ap-text-purple-600">
                                        {(formData.pay_breakdown.longevity?.bonus ?? 0) > 0 ? '+' : ''}{formatCurrency(formData.pay_breakdown.longevity?.bonus ?? 0)}
                                    </span>
                                </div>
                                {/* Year-by-year breakdown */}
                                {formData.pay_breakdown.longevity?.breakdown && formData.pay_breakdown.longevity.breakdown.length > 0 && (
                                    <div className="ap-mt-2 ap-pl-4 ap-border-l-2 ap-border-purple-200 ap-space-y-1">
                                        {formData.pay_breakdown.longevity.breakdown.map((item) => (
                                            <div key={item.year} className="ap-flex ap-justify-between ap-text-xs">
                                                <span className={item.is_first_year ? 'ap-text-gray-500 ap-italic' : 'ap-text-gray-600'}>
                                                    {item.year} {item.is_first_year ? '- Began working - no return bonus' : ''}
                                                </span>
                                                {!item.is_first_year && (
                                                    <span className="ap-text-purple-600 ap-font-medium">
                                                        {formatCurrency(item.rate)}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Time Bonuses */}
                            {formData.pay_breakdown.time_bonuses && formData.pay_breakdown.time_bonuses.length > 0 && (
                                <>
                                    {formData.pay_breakdown.time_bonuses.map(tb => (
                                        <div key={tb.id} className="ap-flex ap-justify-between">
                                            <span className="ap-text-gray-600">{tb.name}</span>
                                            <span className="ap-font-medium ap-text-orange-600">
                                                +{formatCurrency(tb.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                            
                            <div className="ap-pt-3 ap-border-t ap-border-gray-200 ap-flex ap-justify-between">
                                <span className="ap-font-semibold ap-text-gray-900">Total</span>
                                <span className="ap-text-xl ap-font-bold ap-text-gray-900">
                                    {formatCurrency(formData.pay_breakdown.total)}/hr
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Projected Pay */}
                    <div className="ap-bg-gradient-to-br ap-from-blue-600/10 ap-to-blue-50 ap-rounded-2xl ap-shadow-lg ap-p-6">
                        <div className="ap-flex ap-items-center ap-gap-2 ap-mb-4">
                            <HiOutlineArrowTrendingUp className="ap-w-6 ap-h-6 ap-text-blue-600" />
                            <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900">Projected Pay Rate</h3>
                        </div>
                        
                        <div className="ap-space-y-3">
                            <div className="ap-flex ap-justify-between">
                                <span className="ap-text-gray-600">Base Rate</span>
                                <span className="ap-font-medium">{formatCurrency(formData.projected_pay.base_rate)}</span>
                            </div>
                            
                            {(formData.projected_pay.role_bonus?.amount ?? 0) > 0 && (
                                <div className="ap-flex ap-justify-between">
                                    <div>
                                        <span className="ap-text-gray-600">Role Bonus</span>
                                        {formData.job_roles && formData.job_roles.length > 0 ? (
                                            <p className="ap-text-xs ap-text-gray-500">
                                                {formData.job_roles.map(r => r.title).join(', ')}
                                            </p>
                                        ) : formData.projected_pay.role_bonus?.role_name && (
                                            <p className="ap-text-xs ap-text-gray-500">
                                                {formData.projected_pay.role_bonus.role_name}
                                            </p>
                                        )}
                                    </div>
                                    <span className="ap-font-medium ap-text-green-600">
                                        +{formatCurrency(formData.projected_pay.role_bonus?.amount)}
                                    </span>
                                </div>
                            )}
                            
                            {/* Longevity with breakdown */}
                            <div>
                                <div className="ap-flex ap-justify-between">
                                    <span className="ap-text-gray-600">
                                        Longevity ({formData.projected_pay.longevity?.projected_years ?? formData.projected_pay.longevity?.years ?? 0} yrs)
                                    </span>
                                    <span className="ap-font-medium ap-text-purple-600">
                                        {(formData.projected_pay.longevity?.bonus ?? 0) > 0 ? '+' : ''}{formatCurrency(formData.projected_pay.longevity?.bonus ?? 0)}
                                    </span>
                                </div>
                                {/* Year-by-year breakdown */}
                                {formData.projected_pay.longevity?.breakdown && formData.projected_pay.longevity.breakdown.length > 0 && (
                                    <div className="ap-mt-2 ap-pl-4 ap-border-l-2 ap-border-purple-200 ap-space-y-1">
                                        {formData.projected_pay.longevity.breakdown.map((item) => (
                                            <div key={item.year} className="ap-flex ap-justify-between ap-text-xs">
                                                <span className={item.is_first_year ? 'ap-text-gray-500 ap-italic' : 'ap-text-gray-600'}>
                                                    {item.year} {item.is_first_year ? '- Began working - no return bonus' : ''}
                                                </span>
                                                {!item.is_first_year && (
                                                    <span className="ap-text-purple-600 ap-font-medium">
                                                        {formatCurrency(item.rate)}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="ap-pt-3 ap-border-t ap-border-blue-500/20 ap-flex ap-justify-between">
                                <span className="ap-font-semibold ap-text-gray-900">Total</span>
                                <div className="ap-text-right">
                                    <span className="ap-text-xl ap-font-bold ap-text-blue-600">
                                        {formatCurrency(formData.projected_pay.total)}/hr
                                    </span>
                                    {formData.projected_pay.total > formData.pay_breakdown.total && (
                                        <div className="ap-text-xs ap-text-green-600">
                                            +{formatCurrency(formData.projected_pay.total - formData.pay_breakdown.total)} increase
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Response Form */}
                <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-p-6 ap-mb-6">
                    <h3 className="ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-4">Your Response</h3>
                    
                    {/* Comments */}
                    <div className="ap-mb-4">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            Comments (Optional)
                        </label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            rows={3}
                            placeholder="Any additional information you'd like to share..."
                            className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-resize-none"
                        />
                    </div>
                    
                    {/* Signature */}
                    <div className="ap-mb-6">
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                            <HiOutlinePencilSquare className="ap-inline ap-w-4 ap-h-4 ap-mr-1" />
                            Sign Your Name <span className="ap-text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={signature}
                            onChange={(e) => setSignature(e.target.value)}
                            placeholder="Type your full name to sign"
                            className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        />
                        <p className="ap-mt-1 ap-text-xs ap-text-gray-500">
                            By signing, you confirm this response is accurate
                        </p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="ap-grid md:ap-grid-cols-2 ap-gap-4">
                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                            variant="secondary"
                            className="!ap-flex !ap-items-center !ap-justify-center !ap-gap-2 !ap-px-6 !ap-py-4 !ap-bg-gray-100 !ap-text-gray-700 !ap-rounded-xl hover:!ap-bg-gray-200 !ap-border !ap-border-gray-200"
                        >
                            {submitting ? (
                                <div className="ap-animate-spin ap-rounded-full ap-h-5 ap-w-5 ap-border-b-2 ap-border-gray-600"></div>
                            ) : (
                                <>
                                    <HiOutlineXCircle className="ap-w-6 ap-h-6" />
                                    {formData?.already_submitted ? "Update: I'm Not Returning" : "No, I'm Not Returning"}
                                </>
                            )}
                        </Button>
                        
                        <Button
                            onClick={() => handleSubmit(true)}
                            disabled={submitting}
                            variant="primary"
                            className="!ap-flex !ap-items-center !ap-justify-center !ap-gap-2 !ap-px-6 !ap-py-4 !ap-bg-green-600 hover:!ap-bg-green-700 !ap-rounded-xl"
                        >
                            {submitting ? (
                                <div className="ap-animate-spin ap-rounded-full ap-h-5 ap-w-5 ap-border-b-2 ap-border-white"></div>
                            ) : (
                                <>
                                    <HiOutlineCheckCircle className="ap-w-6 ap-h-6" />
                                    {formData?.already_submitted ? "Update: I'm Returning" : "Yes, I'm Returning"}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
                
                {/* Footer */}
                <p className="ap-text-center ap-text-sm ap-text-gray-500">
                    Questions? Contact your supervisor or HR department.
                </p>
            </div>
        </div>
    );
};

export default PublicReturnForm;
