import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import { Button } from './ui';
import {
    HiOutlineSparkles,
    HiOutlineRocketLaunch,
    HiOutlineSun,
    HiOutlineCheck,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';

interface DashboardSettingsData {
    goal_statement: string;
    mission_statement: string;
    weather_zip_code: string;
}

const DashboardSettings: React.FC = () => {
    const [settings, setSettings] = useState<DashboardSettingsData>({
        goal_statement: '',
        mission_statement: '',
        weather_zip_code: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch(`${apiUrl}/dashboard/settings`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    goal_statement: data.goal_statement || '',
                    mission_statement: data.mission_statement || '',
                    weather_zip_code: data.weather_zip_code || '',
                });
            }
        } catch (err) {
            console.error('Failed to fetch dashboard settings:', err);
            setError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`${apiUrl}/dashboard/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': nonce,
                },
                body: JSON.stringify(settings),
            });

            if (response.ok) {
                setSuccess('Settings saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
            setError('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-6">
            <div className="ap-flex ap-items-center ap-justify-between">
                <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Dashboard Settings</h2>
            </div>

            <p className="ap-text-gray-600">
                Configure the widgets and content displayed on the Dashboard home page.
            </p>

            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg ap-p-4 ap-flex ap-items-center ap-gap-3">
                    <HiOutlineExclamationTriangle className="ap-w-5 ap-h-5 ap-text-red-500 ap-flex-shrink-0" />
                    <span className="ap-text-red-700">{error}</span>
                </div>
            )}

            {success && (
                <div className="ap-bg-green-50 ap-border ap-border-green-200 ap-rounded-lg ap-p-4 ap-flex ap-items-center ap-gap-3">
                    <HiOutlineCheck className="ap-w-5 ap-h-5 ap-text-green-500 ap-flex-shrink-0" />
                    <span className="ap-text-green-700">{success}</span>
                </div>
            )}

            <Card padding="none" className="ap-divide-y ap-divide-gray-200">
                {/* Goal Statement */}
                <div className="ap-p-6">
                    <div className="ap-flex ap-items-start ap-gap-4">
                        <div className="ap-p-2 ap-bg-blue-50 ap-rounded-lg">
                            <HiOutlineSparkles className="ap-w-6 ap-h-6 ap-text-blue-600" />
                        </div>
                        <div className="ap-flex-1">
                            <label htmlFor="goal_statement" className="ap-block ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">
                                Goal Statement
                            </label>
                            <p className="ap-text-sm ap-text-gray-500 ap-mb-3">
                                Enter your organization's goal statement to display prominently on the dashboard.
                            </p>
                            <textarea
                                id="goal_statement"
                                value={settings.goal_statement}
                                onChange={(e) => setSettings(prev => ({ ...prev, goal_statement: e.target.value }))}
                                rows={3}
                                className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-resize-none"
                                placeholder="e.g., To provide the safest aquatic environment for our community..."
                            />
                        </div>
                    </div>
                </div>

                {/* Mission Statement */}
                <div className="ap-p-6">
                    <div className="ap-flex ap-items-start ap-gap-4">
                        <div className="ap-p-2 ap-bg-purple-100 ap-rounded-lg">
                            <HiOutlineRocketLaunch className="ap-w-6 ap-h-6 ap-text-purple-600" />
                        </div>
                        <div className="ap-flex-1">
                            <label htmlFor="mission_statement" className="ap-block ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">
                                Mission Statement
                            </label>
                            <p className="ap-text-sm ap-text-gray-500 ap-mb-3">
                                Enter your organization's mission statement to inspire and guide your team.
                            </p>
                            <textarea
                                id="mission_statement"
                                value={settings.mission_statement}
                                onChange={(e) => setSettings(prev => ({ ...prev, mission_statement: e.target.value }))}
                                rows={3}
                                className="ap-w-full ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500 ap-resize-none"
                                placeholder="e.g., We are committed to excellence in aquatic safety through continuous training..."
                            />
                        </div>
                    </div>
                </div>

                {/* Weather Zip Code */}
                <div className="ap-p-6">
                    <div className="ap-flex ap-items-start ap-gap-4">
                        <div className="ap-p-2 ap-bg-yellow-100 ap-rounded-lg">
                            <HiOutlineSun className="ap-w-6 ap-h-6 ap-text-yellow-600" />
                        </div>
                        <div className="ap-flex-1">
                            <label htmlFor="weather_zip_code" className="ap-block ap-text-lg ap-font-semibold ap-text-gray-900 ap-mb-2">
                                Weather Location
                            </label>
                            <p className="ap-text-sm ap-text-gray-500 ap-mb-3">
                                Enter a US zip code to display current weather conditions on the dashboard. Leave empty to hide the weather widget.
                            </p>
                            <input
                                type="text"
                                id="weather_zip_code"
                                value={settings.weather_zip_code}
                                onChange={(e) => setSettings(prev => ({ ...prev, weather_zip_code: e.target.value }))}
                                className="ap-w-full ap-max-w-xs ap-px-4 ap-py-3 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-blue-500"
                                placeholder="e.g., 90210"
                                maxLength={10}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Save Button */}
            <div className="ap-flex ap-justify-end">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    loading={saving}
                    leftIcon={!saving ? <HiOutlineCheck className="ap-w-5 ap-h-5" /> : undefined}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
};

export default DashboardSettings;
