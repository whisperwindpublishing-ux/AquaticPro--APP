import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { View } from '@/App';
import TaskDeck from '@/components/TaskDeck';
import Card from './ui/Card';
import {
    HiOutlineSun,
    HiOutlineCloud,
    HiOutlineCloudArrowDown,
    HiOutlineBolt,
    HiOutlineRocketLaunch,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineViewColumns,
} from 'react-icons/hi2';

interface ActionButton {
    id: number;
    title: string;
    url: string;
    color: string;
    thumbnail_url?: string;
    visible_to_roles?: number[] | null;
    sort_order: number;
}

interface DashboardSettings {
    goal_statement: string;
    mission_statement: string;
    weather_zip_code: string;
    action_buttons: ActionButton[];
}

interface WeatherData {
    temp: number;
    description: string;
    icon: string;
    city: string;
    humidity: number;
    wind_speed: number;
}

interface DashboardProps {
    currentUser: UserProfile;
    onNavigate: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
    const [settings, setSettings] = useState<DashboardSettings>({
        goal_statement: '',
        mission_statement: '',
        weather_zip_code: '',
        action_buttons: [],
    });
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';
    const taskDeckEnabled = window.mentorshipPlatformData?.enable_taskdeck ?? false;

    useEffect(() => {
        fetchDashboardSettings();
    }, []);

    useEffect(() => {
        if (settings.weather_zip_code) {
            fetchWeather(settings.weather_zip_code);
        }
    }, [settings.weather_zip_code]);

    const fetchDashboardSettings = async () => {
        try {
            const response = await fetch(`${apiUrl}/dashboard/settings`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWeather = async (zipCode: string) => {
        setLoadingWeather(true);
        setWeatherError(null);
        try {
            const response = await fetch(`${apiUrl}/dashboard/weather?zip=${encodeURIComponent(zipCode)}`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            if (response.ok) {
                const data = await response.json();
                setWeather(data);
            } else {
                setWeatherError('Unable to fetch weather');
            }
        } catch (err) {
            console.error('Failed to fetch weather:', err);
            setWeatherError('Weather service unavailable');
        } finally {
            setLoadingWeather(false);
        }
    };

    const getWeatherIcon = (iconCode: string) => {
        if (iconCode?.includes('rain') || iconCode?.includes('shower')) {
            return <HiOutlineCloudArrowDown className="ap-w-12 ap-h-12 ap-text-blue-500" />;
        } else if (iconCode?.includes('cloud')) {
            return <HiOutlineCloud className="ap-w-12 ap-h-12 ap-text-gray-500" />;
        } else if (iconCode?.includes('thunder') || iconCode?.includes('storm')) {
            return <HiOutlineBolt className="ap-w-12 ap-h-12 ap-text-yellow-500" />;
        } else {
            return <HiOutlineSun className="ap-w-12 ap-h-12 ap-text-yellow-400" />;
        }
    };

    const getButtonStyle = (color: string) => {
        // Return INLINE STYLES to override WordPress theme link styling
        const colorMap: Record<string, React.CSSProperties> = {
            blue: { backgroundColor: '#465fff', color: '#ffffff' },
            green: { backgroundColor: '#12b76a', color: '#ffffff' },
            red: { backgroundColor: '#f04438', color: '#ffffff' },
            yellow: { backgroundColor: '#f79009', color: '#ffffff' },
            purple: { backgroundColor: '#9333ea', color: '#ffffff' },
            orange: { backgroundColor: '#f97316', color: '#ffffff' },
            pink: { backgroundColor: '#ec4899', color: '#ffffff' },
            teal: { backgroundColor: '#0d9488', color: '#ffffff' },
            indigo: { backgroundColor: '#4f46e5', color: '#ffffff' },
            gray: { backgroundColor: '#4b5563', color: '#ffffff' },
            cyan: { backgroundColor: '#0891b2', color: '#ffffff' },
        };
        return colorMap[color] || colorMap.blue;
    };
    
    // Base inline styles for action buttons - overrides ALL theme link styling
    const actionButtonBaseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        border: 'none',
        cursor: 'pointer',
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-h-64">
                <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-brand-500"></div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-3 md:ap-space-y-6">
            {/* Goal/Mission and Weather Row */}
            {(settings.goal_statement || settings.mission_statement || settings.weather_zip_code) && (
                <div className="ap-grid ap-grid-cols-1 lg:ap-grid-cols-2 ap-gap-3 md:ap-gap-6">
                    {/* Goal and Mission Statement */}
                    {(settings.goal_statement || settings.mission_statement) && (
                        <div className="ap-bg-gradient-to-br ap-from-brand-50 ap-to-blue-50 md:ap-rounded-xl ap-p-3 md:ap-p-6 md:ap-shadow-sm md:ap-border md:ap-border-brand-200">
                            <div className="ap-flex ap-items-start ap-gap-4">
                                <div className="ap-p-3 ap-bg-white ap-rounded-xl ap-shadow-xs ap-border ap-border-brand-200">
                                    <HiOutlineRocketLaunch className="ap-w-8 ap-h-8 ap-text-brand-500" />
                                </div>
                                <div className="ap-flex-1 ap-space-y-4">
                                    {settings.goal_statement && (
                                        <div>
                                            <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">
                                                Our Goal
                                            </h2>
                                            <p className="ap-text-gray-700 ap-mt-1 ap-text-base ap-leading-relaxed">{settings.goal_statement}</p>
                                        </div>
                                    )}
                                    {settings.mission_statement && (
                                        <div>
                                            <h2 className="ap-text-xl ap-font-bold ap-text-gray-900">
                                                Our Mission
                                            </h2>
                                            <p className="ap-text-gray-700 ap-mt-1 ap-text-base ap-leading-relaxed">{settings.mission_statement}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Weather Widget */}
                    {settings.weather_zip_code && (
                        <Card>
                            <Card.Body>
                                <h3 className="ap-text-base ap-font-semibold ap-text-gray-900 ap-mb-4">Current Weather</h3>
                                {loadingWeather ? (
                                    <div className="ap-flex ap-items-center ap-justify-center ap-h-24">
                                        <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-brand-500"></div>
                                    </div>
                                ) : weatherError ? (
                                    <div className="ap-text-center ap-text-gray-500 ap-py-4">
                                        <HiOutlineCloud className="ap-w-12 ap-h-12 ap-mx-auto ap-mb-2 ap-text-gray-300" />
                                        <p>{weatherError}</p>
                                    </div>
                                ) : weather ? (
                                    <div className="ap-flex ap-items-center ap-gap-4">
                                        {getWeatherIcon(weather.icon)}
                                        <div>
                                            <div className="ap-text-3xl ap-font-bold ap-text-gray-900">{Math.round(weather.temp)}°F</div>
                                            <div className="ap-text-gray-600 ap-capitalize">{weather.description}</div>
                                            <div className="ap-text-sm ap-text-gray-500">{weather.city}</div>
                                        </div>
                                        <div className="ap-ml-auto ap-text-right ap-text-sm ap-text-gray-500">
                                            <div>Humidity: {weather.humidity}%</div>
                                            <div>Wind: {Math.round(weather.wind_speed)} mph</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ap-text-center ap-text-gray-500 ap-py-4">
                                        <p>No weather data available</p>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    )}
                </div>
            )}

            {/* Action Buttons Row */}
            {settings.action_buttons && settings.action_buttons.length > 0 && (() => {
                // Get current user's job role IDs
                const userRoleIds = currentUser.jobRoles?.map(r => r.id) || [];
                
                // Filter buttons based on role visibility
                const visibleButtons = settings.action_buttons.filter(button => {
                    // If no role restriction (null or empty), show to everyone
                    if (!button.visible_to_roles || button.visible_to_roles.length === 0) {
                        return true;
                    }
                    // Check if user has any of the allowed roles
                    return button.visible_to_roles.some(roleId => userRoleIds.includes(roleId));
                });
                
                if (visibleButtons.length === 0) return null;
                
                return (
                    <Card>
                        <Card.Body>
                            <h3 className="ap-text-base ap-font-semibold ap-text-gray-900 ap-mb-4">Quick Actions</h3>
                            <div className="ap-flex ap-flex-wrap ap-gap-3">
                                {visibleButtons
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((button) => (
                                        <button
                                            key={button.id}
                                            type="button"
                                            onClick={() => window.open(button.url, '_blank', 'noopener,noreferrer')}
                                            style={{
                                                ...actionButtonBaseStyle,
                                                ...getButtonStyle(button.color),
                                            }}
                                        >
                                            {button.thumbnail_url && (
                                                <img 
                                                    src={button.thumbnail_url} 
                                                    alt="" 
                                                    style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', objectFit: 'cover' }}
                                                />
                                            )}
                                            <span style={{ color: '#ffffff', textDecoration: 'none' }}>{button.title}</span>
                                            <HiOutlineArrowTopRightOnSquare style={{ width: '1rem', height: '1rem', opacity: 0.7, color: '#ffffff' }} />
                                        </button>
                                    ))}
                            </div>
                        </Card.Body>
                    </Card>
                );
            })()}

            {/* Embedded TaskDeck */}
            {taskDeckEnabled && (
                <Card>
                    <Card.Header className="ap-bg-gray-50">
                        <div className="ap-flex ap-items-center ap-gap-2">
                            <HiOutlineViewColumns className="ap-w-5 ap-h-5 ap-text-brand-500" />
                            <Card.Title>TaskDeck</Card.Title>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <TaskDeck currentUser={currentUser} />
                    </Card.Body>
                </Card>
            )}
        </div>
    );
};

export default Dashboard;
