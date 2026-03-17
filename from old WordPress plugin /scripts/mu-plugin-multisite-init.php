<?php
/**
 * AquaticPro Multisite Initialization — Must-Use Plugin
 *
 * PURPOSE:
 *   When a new sub-site is created in the Multisite network, this plugin
 *   automatically copies key settings (MailPoet, AquaticPro options) from
 *   a designated template site so each new client site starts pre-configured.
 *
 * INSTALLATION:
 *   Upload this file to: wp-content/mu-plugins/aquaticpro-multisite-init.php
 *   MU-plugins load automatically on every site — no activation needed.
 *
 * CONFIGURATION:
 *   Set AQUATICPRO_TEMPLATE_SITE_ID below to the blog_id of your template site
 *   (the site you've already configured with MailPoet sending settings, etc.)
 *   Default: 2 (the first sub-site created after the main site)
 *
 * WHAT GETS COPIED:
 *   - All MailPoet settings (SMTP sender, reply-to, etc.) — option: mailpoet_settings
 *   - All AquaticPro module enable/disable flags     — options: aquaticpro_enable_*
 *   - AquaticPro default home view setting
 *
 * WHAT DOES NOT GET COPIED (intentionally):
 *   - MailPoet subscriber lists, segments, forms (client-specific data)
 *   - MailPoet email campaigns and stats
 *   - AquaticPro users, daily logs, goals, seasons — all empty on new site
 *   - WordPress users (handled by network user management)
 */

defined( 'ABSPATH' ) || exit;

// -----------------------------------------------------------------------
// CONFIGURATION — Change this to the blog_id of your template site
// -----------------------------------------------------------------------
define( 'AQUATICPRO_TEMPLATE_SITE_ID', 2 );
// -----------------------------------------------------------------------

/**
 * After a new site is initialized, copy settings from the template site.
 * Runs after the plugin's own mp_initialize_new_multisite() (priority 20 vs 10).
 */
add_action( 'wp_initialize_site', 'aquaticpro_copy_template_settings_to_new_site', 20, 1 );

function aquaticpro_copy_template_settings_to_new_site( WP_Site $new_site ) {
    if ( ! is_multisite() ) {
        return;
    }

    $template_id = (int) AQUATICPRO_TEMPLATE_SITE_ID;
    $new_id      = (int) $new_site->blog_id;

    // Don't copy to the template site itself
    if ( $new_id === $template_id ) {
        return;
    }

    // -----------------------------------------------------------------------
    // Options to copy verbatim from the template site
    // -----------------------------------------------------------------------
    $options_to_copy = array(

        // MailPoet sending configuration
        'mailpoet_settings',

        // MailPoet signup confirmation (optional, remove if you want fresh)
        'mailpoet_db_version',

        // AquaticPro module flags
        'aquaticpro_enable_mentorship',
        'aquaticpro_enable_daily_logs',
        'aquaticpro_enable_professional_growth',
        'aquaticpro_enable_taskdeck',
        'aquaticpro_enable_awesome_awards',
        'aquaticpro_enable_seasonal_returns',
        'aquaticpro_enable_lesson_management',
        'aquaticpro_enable_lms',
        'aquaticpro_enable_mileage',
        'aquaticpro_enable_new_hires',
        'aquaticpro_enable_reports',
        'aquaticpro_enable_foia_export',
        'aquaticpro_enable_certificates',
        'aquaticpro_enable_pwa',

        // AquaticPro UX defaults
        'aquaticpro_default_home_view',
    );

    // Read from template, write to new site
    switch_to_blog( $template_id );
    $values = array();
    foreach ( $options_to_copy as $option_name ) {
        $values[ $option_name ] = get_option( $option_name );
    }
    restore_current_blog();

    switch_to_blog( $new_id );
    foreach ( $values as $option_name => $value ) {
        // Only write if template had a value (don't overwrite with false/null)
        if ( $value !== false ) {
            update_option( $option_name, $value );
        }
    }
    restore_current_blog();

    error_log( "[AquaticPro] New site {$new_id} initialized with settings copied from template site {$template_id}." );
}
