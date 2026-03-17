import React, { useState, useRef } from 'react';
import { UserProfile } from '@/types'; // Corrected import
import { uploadFile } from '@/services/api'; // Corrected import
import { configureApiService } from '@/services/api-service';
import Card from './ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from './ui';
import { 
    HiOutlineArrowLeft as ArrowLeftIcon,
    HiOutlineIdentification as IdentificationIcon,
    HiOutlineShieldCheck as ShieldCheckIcon,
    HiOutlineCamera as CameraIcon,
    HiOutlineTrash as TrashIcon,
    HiOutlineLink as LinkIcon
} from 'react-icons/hi2';
import ToggleSwitch from '@/components/ToggleSwitch';
import RichTextEditor from '@/components/RichTextEditor';

interface UserSettingsProps {
    user: UserProfile;
    onBack: () => void;
    onSave: (updatedUser: UserProfile) => Promise<void>;
    onViewDashboard: (mentorshipId: number) => void;
    defaultAvatar: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ user, onBack, onSave, defaultAvatar }) => {
    const [formData, setFormData] = useState<UserProfile>({ ...user, customLinks: user.customLinks || [] });
    const [skillsInput, setSkillsInput] = useState((user.skills || []).join(', '));
    const [isSaving, setIsSaving] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSkillsInput(e.target.value);
    };

    const handleCustomLinkChange = (index: number, field: 'label' | 'url', value: string) => {
        const newLinks = [...formData.customLinks];
        newLinks[index][field] = value;
        setFormData(prev => ({ ...prev, customLinks: newLinks }));
    };

    const addCustomLink = () => {
        setFormData(prev => ({ ...prev, customLinks: [...prev.customLinks, { label: '', url: '' }] }));
    };

    const removeCustomLink = (index: number) => {
        const newLinks = formData.customLinks.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, customLinks: newLinks }));
    };

    const handleSkillsBlur = () => {
        const skillsArray = skillsInput.split(',').map(skill => skill.trim()).filter(Boolean);
        setFormData(prev => ({ ...prev, skills: skillsArray }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
        } catch (error) {
            console.error('Failed to save profile:', error);
            alert('Failed to save profile. Please try again.');
        }
        setIsSaving(false);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const wpData = (window as any).mentorshipPlatformData;
            if (wpData && wpData.api_url) {
                configureApiService(wpData.api_url, wpData.nonce);
            } else {
                console.error('AquaticPro data not found, API calls will fail.');
                alert('Plugin is not configured correctly. Missing API data.');
                return;
            }

            try {
                const attachment = await uploadFile(file);
                setFormData(prev => ({ ...prev, avatarUrl: attachment.url }));
            } catch (error) {
                console.error("Avatar upload failed", error);
                alert("Avatar upload failed.");
            }
        }
    };

    return (
        <div className="ap-animate-fade-in-up">
            <Button onClick={onBack} variant="ghost" size="sm" className="!ap-flex !ap-items-center !ap-mb-6 !ap-p-0">
                <ArrowLeftIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                Back to Profile
            </Button>
            <h1 className="ap-text-2xl ap-font-bold ap-text-gray-900 ap-mb-8">Settings</h1>

            <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-3 ap-gap-8">
                {/* Main Settings Form */}
                <div className="lg:ap-col-span-2 ap-space-y-8">
                    {/* Profile Information */}
                    <Card>
                        <Card.Body>
                            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4 ap-flex ap-items-center"><IdentificationIcon className="ap-h-5 ap-w-5 ap-mr-2" /> Profile Information</h3>
                            <div className="ap-space-y-4">
                                <div className="ap-flex ap-items-center ap-space-x-4">
                                    <div className="ap-relative"> 
                                        <img src={formData.avatarUrl || defaultAvatar} alt="Avatar" className="ap-h-20 ap-w-20 ap-rounded-full ap-object-cover" />
                                        <Button onClick={() => avatarInputRef.current?.click()} variant="ghost" size="xs" className="!ap-absolute !ap-bottom-0 !ap-right-0 !ap-bg-gray-700 !ap-text-white !ap-rounded-full !ap-p-1 hover:!ap-bg-gray-600 !ap-min-h-0">
                                            <CameraIcon className="ap-h-4 ap-w-4" />
                                        </Button>
                                        <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="ap-hidden" />
                                    </div>
                                    <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 ap-gap-4 ap-flex-grow">
                                        <div>
                                            <Label>First Name</Label>
                                            <Input type="text" name="firstName" value={formData.firstName} onChange={handleChange} />
                                        </div>
                                        <div>
                                            <Label>Last Name</Label>
                                            <Input type="text" name="lastName" value={formData.lastName} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label>Tagline</Label>
                                <Input type="text" name="tagline" value={formData.tagline} onChange={handleChange} placeholder="e.g., Senior Software Engineer @ Google" />
                            </div>
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Bio</label>
                                <RichTextEditor 
                                    value={formData.bioDetails}
                                    onChange={(value) => setFormData(prev => ({ ...prev, bioDetails: value }))}
                                    placeholder="Tell us about yourself..."
                                />
                            </div>
                            <div>
                                <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700">Experience</label>
                                <RichTextEditor 
                                    value={formData.experience}
                                    onChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}
                                    placeholder="Describe your professional experience..."
                                />
                            </div>
                            <div>
                                <Label>Skills (comma-separated)</Label>
                                <Input type="text" value={skillsInput} onChange={handleSkillsChange} onBlur={handleSkillsBlur} placeholder="React, TypeScript, Node.js..." />
                            </div>
                             <div>
                                <Label>LinkedIn Profile URL</Label>
                                <Input type="url" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} />
                            </div>
                            {/* --- Google Calendar Booking Link --- */}
                            <div>
                                <Label htmlFor="booking-link">Google Calendar Booking Link</Label>
                                <Input
                                    type="url"
                                    name="bookingLink"
                                    id="booking-link"
                                    value={formData.bookingLink || ''}
                                    onChange={handleChange}
                                    placeholder="https://calendar.google.com/..."
                                />
                            </div>

                            {/* --- Contact/Messaging Methods --- */}
                            <div className="ap-border-t ap-border-gray-200 ap-pt-4 ap-mt-4">
                                <h4 className="ap-text-sm ap-font-medium ap-text-gray-900 ap-mb-3">Messaging & Contact</h4>
                                <p className="ap-text-xs ap-text-gray-500 ap-mb-4">
                                    Add your contact info to make it easier for your mentor or mentee to connect with you.
                                </p>
                                
                                {/* Contact Email */}
                                <div className="ap-mb-4">
                                    <Label>Contact Email</Label>
                                    <Input
                                        type="email"
                                        name="contactEmail"
                                        value={formData.contactEmail || ''}
                                        onChange={handleChange}
                                        placeholder={formData.email || 'Leave blank to use your account email'}
                                    />
                                    <p className="ap-text-xs ap-text-gray-500 ap-mt-1">
                                        {formData.contactEmail 
                                            ? 'Mentors/mentees will see this email instead of your account email.' 
                                            : `Leave blank to use your account email (${formData.email || 'not set'})`
                                        }
                                    </p>
                                </div>

                                <div className="ap-grid ap-grid-cols-1 sm:ap-grid-cols-2 ap-gap-4">
                                    <div>
                                        <Label>GroupMe Username</Label>
                                        <Input
                                            type="text"
                                            name="groupmeUsername"
                                            value={formData.groupmeUsername || ''}
                                            onChange={handleChange}
                                            placeholder="@username"
                                        />
                                    </div>
                                    <div>
                                        <Label>Signal Username</Label>
                                        <Input
                                            type="text"
                                            name="signalUsername"
                                            value={formData.signalUsername || ''}
                                            onChange={handleChange}
                                            placeholder="@username or phone"
                                        />
                                    </div>
                                    <div>
                                        <Label>Telegram Username</Label>
                                        <Input
                                            type="text"
                                            name="telegramUsername"
                                            value={formData.telegramUsername || ''}
                                            onChange={handleChange}
                                            placeholder="@username"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label className="ap-mb-2">Custom Links</Label>
                                {formData.customLinks && formData.customLinks.map((link, index) => (
                                    <div key={index} className="ap-flex ap-items-center ap-space-x-2 ap-mb-2">
                                        <Input type="text" value={link.label} onChange={(e) => handleCustomLinkChange(index, 'label', e.target.value)} placeholder="Label (e.g., Portfolio)" className="ap-w-1/3" />
                                        <Input type="url" value={link.url} onChange={(e) => handleCustomLinkChange(index, 'url', e.target.value)} placeholder="URL" className="ap-flex-grow" />
                                        <Button onClick={() => removeCustomLink(index)} variant="ghost" size="xs" className="!ap-p-2 !ap-text-gray-500 hover:!ap-text-red-600 !ap-min-h-0"><TrashIcon className="ap-h-5 ap-w-5" /></Button>
                                    </div>
                                ))}
                                <Button onClick={addCustomLink} variant="ghost" size="sm" className="!ap-flex !ap-items-center !ap-p-0"><LinkIcon className="ap-h-4 ap-w-4 ap-mr-1" /> Add Link</Button>
                            </div>
                        </Card.Body>
                    </Card>

                    {/* Mentorship Settings */}
                    <Card>
                        <Card.Body>
                            <h3 className="ap-text-lg ap-font-medium ap-text-gray-900 ap-mb-4 ap-flex ap-items-center"><ShieldCheckIcon className="ap-h-5 ap-w-5 ap-mr-2" /> Mentorship Settings</h3>
                            <div className="ap-space-y-0 ap-divide-y ap-divide-gray-200">
                                <ToggleSwitch
                                    label="Available as a mentor"
                                    enabled={formData.mentorOptIn}
                                    onChange={(enabled) => setFormData(prev => ({ ...prev, mentorOptIn: enabled }))}
                                    description="Allow other users to find you in the directory and request mentorship."
                                />
                                <ToggleSwitch
                                    label="Email Notifications"
                                    enabled={formData.notifyByEmail || false}
                                    onChange={(enabled) => setFormData(prev => ({ ...prev, notifyByEmail: enabled }))}
                                    description="Receive email notifications about activity on the platform."
                                />
                            </div>
                        </Card.Body>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="lg:ap-col-span-1 ap-space-y-8">
                    <Card>
                        <Card.Body>
                            <Button variant="primary" onClick={handleSave} loading={isSaving} fullWidth>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default UserSettings;