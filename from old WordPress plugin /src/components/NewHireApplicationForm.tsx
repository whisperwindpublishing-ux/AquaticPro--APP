/**
 * New Hire Application Form
 * 
 * Public-facing form for new hires to accept job offers
 * and provide onboarding information.
 * 
 * Features:
 * - Simple, friendly form design
 * - Bot protection (honeypot)
 * - Work permit indicator for LOI generation
 * 
 * Note: Job roles are assigned after user approval via Admin → Users List
 */

import React, { useState, useEffect } from 'react';
import { NewHireApplicationData } from '../types';
import { submitApplication, getOrganizationInfo, OrganizationInfo } from '../services/newHiresService';
import { 
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineUser,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineMapPin
} from 'react-icons/hi2';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { Button } from './ui/Button';

interface Props {
    /** Optional callback after successful submission */
    onSuccess?: () => void;
}

export default function NewHireApplicationForm({ onSuccess }: Props) {
    const [formData, setFormData] = useState<NewHireApplicationData>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        address: '',
        position: '', // Job roles assigned after approval via Admin → Users List
        is_accepting: false,
        needs_work_permit: false,
        honeypot: '', // Bot trap
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);

    // Fetch organization info on mount
    useEffect(() => {
        async function fetchOrgInfo() {
            try {
                const data = await getOrganizationInfo();
                setOrgInfo(data.organization);
            } catch (err) {
                console.error('Failed to load organization info:', err);
            }
        }
        fetchOrgInfo();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Bot check - honeypot should be empty
        if (formData.honeypot) {
            // Silently fail for bots
            setSubmitted(true);
            return;
        }

        // Validation
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            setError('Please enter your first and last name.');
            return;
        }
        if (!formData.email.trim() || !formData.email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!formData.date_of_birth) {
            setError('Please enter your date of birth.');
            return;
        }
        if (!formData.is_accepting) {
            setError('Please confirm that you are accepting this position.');
            return;
        }

        setIsLoading(true);

        try {
            await submitApplication(formData);
            setSubmitted(true);
            onSuccess?.();
        } catch (err) {
            console.error('Submission failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit application. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Success state
    if (submitted) {
        return (
            <div className="ap-max-w-lg ap-mx-auto ap-p-8 ap-bg-white ap-rounded-2xl ap-shadow-lg ap-text-center">
                <div className="ap-w-16 ap-h-16 ap-bg-green-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mx-auto ap-mb-4">
                    <HiOutlineCheckCircle className="ap-w-8 ap-h-8 ap-text-green-600" />
                </div>
                <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-2">Application Submitted!</h2>
                <p className="ap-text-gray-600 ap-mb-6">
                    Thank you for accepting your position. We've received your information 
                    and will be in touch soon with next steps.
                </p>
                <div className="ap-text-sm ap-text-gray-500">
                    Check your email for a confirmation message.
                </div>
            </div>
        );
    }

    return (
        <div className="ap-max-w-lg ap-mx-auto">
            <div className="ap-bg-white ap-rounded-2xl ap-shadow-lg ap-overflow-hidden">
                {/* Organization Header */}
                {orgInfo?.header_image && (
                    <div className="ap-px-8 ap-pt-6">
                        <img 
                            src={orgInfo.header_image} 
                            alt={orgInfo.name || 'Organization'} 
                            className="ap-max-h-20 ap-mx-auto ap-object-contain"
                        />
                    </div>
                )}
                
                {/* Header */}
                <div className="ap-bg-gradient-to-r ap-from-blue-600 ap-to-blue-700 ap-px-8 ap-py-6 ap-text-white">
                    <h1 className="ap-text-2xl ap-font-bold">
                        {orgInfo?.name ? `Welcome to ${orgInfo.name}!` : 'Welcome to the Team!'}
                    </h1>
                    <p className="ap-text-blue-100 ap-mt-1">
                        Please complete this form to accept your position.
                    </p>
                    {orgInfo && (orgInfo.address || orgInfo.phone || orgInfo.email) && (
                        <div className="ap-mt-3 ap-pt-3 ap-border-t ap-border-blue-500/30 ap-text-sm ap-text-blue-100 ap-space-y-1">
                            {orgInfo.address && <div>{orgInfo.address}</div>}
                            <div className="ap-flex ap-flex-wrap ap-gap-x-4 ap-gap-y-1">
                                {orgInfo.phone && <span>{orgInfo.phone}</span>}
                                {orgInfo.email && <span>{orgInfo.email}</span>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="ap-p-8 ap-space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="ap-flex ap-items-start ap-gap-3 ap-p-4 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-text-red-800">
                            <HiOutlineExclamationCircle className="ap-w-5 ap-h-5 ap-flex-shrink-0 ap-mt-0.5" />
                            <span className="ap-text-sm">{error}</span>
                        </div>
                    )}

                    {/* Honeypot - Hidden from users, visible to bots */}
                    <div className="ap-hidden" aria-hidden="true">
                        <label htmlFor="website">Website</label>
                        <input
                            type="text"
                            id="website"
                            name="honeypot"
                            value={formData.honeypot}
                            onChange={handleChange}
                            tabIndex={-1}
                            autoComplete="off"
                        />
                    </div>

                    {/* Name Fields */}
                    <div className="ap-grid ap-grid-cols-2 ap-gap-4">
                        <div>
                            <label htmlFor="first_name" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                First Name *
                            </label>
                            <div className="ap-relative">
                                <HiOutlineUser className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                                <input
                                    type="text"
                                    id="first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                    className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                    placeholder="John"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="last_name" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                                Last Name *
                            </label>
                            <input
                                type="text"
                                id="last_name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                                className="ap-w-full ap-px-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                placeholder="Smith"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Email Address *
                        </label>
                        <div className="ap-relative">
                            <HiOutlineEnvelope className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                placeholder="john.smith@example.com"
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label htmlFor="phone" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Phone Number
                        </label>
                        <div className="ap-relative">
                            <HiOutlinePhone className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-5 ap-h-5 ap-text-gray-400" />
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                placeholder="(555) 123-4567"
                            />
                        </div>
                    </div>

                    {/* Date of Birth */}
                    <div>
                        <label htmlFor="date_of_birth" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Date of Birth *
                        </label>
                        <div className="ap-relative">
                            <input
                                type="date"
                                id="date_of_birth"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                required
                                className="ap-w-full ap-px-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <label htmlFor="address" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            Home Address
                        </label>
                        <div className="ap-relative">
                            <HiOutlineMapPin className="ap-absolute ap-left-3 ap-top-3 ap-w-5 ap-h-5 ap-text-gray-400" />
                            <textarea
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={2}
                                className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2.5 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-resize-none"
                                placeholder="123 Main St, City, State 12345"
                            />
                        </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="ap-space-y-4 ap-pt-4 ap-border-t">
                        {/* Accept Position */}
                        <label className="ap-flex ap-items-start ap-gap-3 ap-cursor-pointer">
                            <input
                                type="checkbox"
                                name="is_accepting"
                                checked={formData.is_accepting}
                                onChange={handleChange}
                                className="ap-mt-1 ap-w-5 ap-h-5 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                            />
                            <span className="ap-text-gray-700">
                                <strong>I am accepting this position</strong> and understand that I will be 
                                contacted with further onboarding information.
                            </span>
                        </label>

                        {/* Work Permit */}
                        <label className="ap-flex ap-items-start ap-gap-3 ap-cursor-pointer">
                            <input
                                type="checkbox"
                                name="needs_work_permit"
                                checked={formData.needs_work_permit}
                                onChange={handleChange}
                                className="ap-mt-1 ap-w-5 ap-h-5 ap-text-blue-600 ap-border-gray-300 ap-rounded focus:ap-ring-blue-500"
                            />
                            <span className="ap-text-gray-700">
                                <strong>I need a work permit</strong> (required for minors under 16)
                            </span>
                        </label>
                    </div>

                    {/* Work Permit Notice */}
                    {formData.needs_work_permit && (
                        <div className="ap-p-4 ap-bg-amber-50 ap-border ap-border-amber-200 ap-rounded-lg">
                            <p className="ap-text-amber-800 ap-text-sm">
                                <strong>Note:</strong> Since you need a work permit, we will send you a 
                                Letter of Intent after your application is approved. This letter can be 
                                used to obtain your work permit from your school.
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isLoading || !formData.is_accepting}
                        className="!ap-w-full !ap-py-3 !ap-px-6"
                    >
                        {isLoading ? (
                            <>
                                <AiOutlineLoading3Quarters className="ap-w-5 ap-h-5 ap-animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Application'
                        )}
                    </Button>

                    {/* Sender Info Footer */}
                    {orgInfo && (orgInfo.sender_name || orgInfo.sender_title) && (
                        <div className="ap-pt-4 ap-border-t ap-text-center ap-text-sm ap-text-gray-500">
                            <div>Questions? Contact:</div>
                            {orgInfo.sender_name && (
                                <div className="ap-font-medium ap-text-gray-700">{orgInfo.sender_name}</div>
                            )}
                            {orgInfo.sender_title && (
                                <div>{orgInfo.sender_title}</div>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
