/** App-wide constants — replaces hardcoded strings scattered through the PHP plugin */

export const APP_NAME = "AquaticPro";
export const APP_VERSION = "14.0.0"; // First Vercel release

/** Module feature flag keys (replaces get_option('aquaticpro_enable_*')) */
export const MODULE_KEYS = {
  professionalGrowth: "aquaticpro_enable_professional_growth",
  lessonManagement: "aquaticpro_enable_lesson_management",
  taskdeck: "aquaticpro_enable_taskdeck",
  awesomeAwards: "aquaticpro_enable_awesome_awards",
  seasonalReturns: "aquaticpro_enable_seasonal_returns",
  mileage: "aquaticpro_enable_mileage",
  certificates: "aquaticpro_enable_certificates",
  lms: "aquaticpro_enable_lms",
  whiteboard: "aquaticpro_enable_whiteboard",
  newHires: "aquaticpro_enable_new_hires",
  emailComposer: "aquaticpro_enable_email_composer",
  foiaExport: "aquaticpro_enable_foia_export",
} as const;

/** Supabase Storage bucket names */
export const STORAGE_BUCKETS = {
  uploads: "uploads",
  avatars: "avatars",
  courseMaterials: "course-materials",
  certificates: "certificates",
  whiteboard: "whiteboard-snapshots",
} as const;

/** Cache TTLs in seconds */
export const CACHE_TTL = {
  short: 60,         // 1 minute
  medium: 300,       // 5 minutes
  long: 3600,        // 1 hour
  day: 86400,        // 24 hours
} as const;
