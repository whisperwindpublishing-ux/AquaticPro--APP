// WordPress Media Library types
interface WPMediaAttachment {
    id: number;
    url: string;
    filename: string;
    title: string;
    alt: string;
    description: string;
    caption: string;
    name: string;
    width: number;
    height: number;
    type: string;
    subtype: string;
    icon: string;
    dateFormatted: string;
    filesizeInBytes: number;
    filesizeHumanReadable: string;
    sizes: {
        [key: string]: {
            url: string;
            width: number;
            height: number;
            orientation: string;
        };
    };
}

interface WPMediaState {
    get(key: string): {
        first(): {
            toJSON(): WPMediaAttachment;
        };
    };
}

interface WPMediaFrame {
    on(event: string, callback: () => void): void;
    state(): WPMediaState;
    open(): void;
    close(): void;
}

interface WPMedia {
    (options: {
        title?: string;
        button?: { text: string };
        multiple?: boolean;
        library?: { type: string };
    }): WPMediaFrame;
}

interface AquaticProSettings {
    nonce: string;
    ajaxUrl: string;
    restUrl: string;
    site_name: string;
    pluginUrl: string;
    excalidrawAssetPath: string;
    userId?: number;
    isAdmin?: boolean;
}

// WordPress data passed from PHP - comprehensive interface
interface MentorshipPlatformData {
    api_url: string;
    restUrl: string;
    nonce: string;
    isLoggedIn: boolean;
    is_admin: boolean;
    current_user: import('./types').UserProfile | null;
    default_avatar_url?: string;
    enable_mentorship?: boolean;
    enable_daily_logs?: boolean;
    enable_professional_growth?: boolean;
    enable_taskdeck?: boolean;
    enable_awesome_awards?: boolean;
    enable_lesson_management?: boolean;
    enable_lms?: boolean;
    enable_mileage?: boolean;
    enable_seasonal_returns?: boolean;
    enable_new_hires?: boolean;
    enable_reports?: boolean;
    enable_foia_export?: boolean;
    camp_roster_password_set?: boolean;
    default_home_view?: string;
    logout_url?: string;
    currentUrl?: string;
    visitor_mode?: boolean;
    read_only_mode?: boolean;
    account_status?: 'active' | 'archived';
    site_name?: string;
    [key: string]: unknown;
}

interface Window {
    wp?: {
        media?: WPMedia;
    };
    aquaticProSettings?: AquaticProSettings;
    mentorshipPlatformData?: MentorshipPlatformData;
    EXCALIDRAW_ASSET_PATH?: string;
}

// Vite CSS inline imports
declare module '*.css?inline' {
    const content: string;
    export default content;
}
