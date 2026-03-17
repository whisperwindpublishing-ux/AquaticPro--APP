<?php
/**
 * Admin Settings Page for Mentorship Platform
 * Handles LearnDash group-based access restrictions
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Handle export early before any output (must run on admin_init)
 */
function aquaticpro_handle_early_export() {
    // Only on our settings page with export action
    if ( ! isset( $_POST['aquaticpro_action'] ) || $_POST['aquaticpro_action'] !== 'export_configuration' ) {
        return;
    }
    
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    
    // Verify nonce
    if ( ! isset( $_POST['aquaticpro_setup_nonce'] ) || ! wp_verify_nonce( $_POST['aquaticpro_setup_nonce'], 'aquaticpro_setup_template' ) ) {
        return;
    }
    
    // Do the export now, before any output
    if ( function_exists( 'aquaticpro_export_configuration' ) ) {
        aquaticpro_export_configuration();
    }
}
add_action( 'admin_init', 'aquaticpro_handle_early_export', 1 );

/**
 * Handle non-export setup actions on admin_init with redirect-after-POST
 */
function aquaticpro_handle_setup_actions_early() {
    if ( ! isset( $_POST['aquaticpro_action'] ) ) {
        return;
    }

    $action = sanitize_text_field( $_POST['aquaticpro_action'] );

    // Export is handled separately (needs to stream output before headers)
    if ( $action === 'export_configuration' ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    if ( ! isset( $_POST['aquaticpro_setup_nonce'] ) || ! wp_verify_nonce( $_POST['aquaticpro_setup_nonce'], 'aquaticpro_setup_template' ) ) {
        wp_safe_redirect( add_query_arg( array(
            'post_type' => 'mp_request',
            'page'      => 'aquaticpro-settings',
            'ap_msg'    => 'nonce_fail',
            'ap_type'   => 'error',
        ), admin_url( 'edit.php' ) ) );
        exit;
    }

    $redirect_args = array( 'post_type' => 'mp_request', 'page' => 'aquaticpro-settings' );

    switch ( $action ) {
        case 'apply_default_template':
            $result = aquaticpro_apply_default_template_silent();
            $redirect_args['ap_msg']  = $result['msg_key'];
            $redirect_args['ap_type'] = $result['type'];
            if ( ! empty( $result['count'] ) ) {
                $redirect_args['ap_count'] = $result['count'];
            }
            break;

        case 'import_configuration':
            $result = aquaticpro_import_configuration_silent();
            $redirect_args['ap_msg']   = $result['msg_key'];
            $redirect_args['ap_type']  = $result['type'];
            if ( ! empty( $result['count'] ) ) {
                $redirect_args['ap_count'] = $result['count'];
            }
            if ( ! empty( $result['perm_count'] ) ) {
                $redirect_args['ap_perm_count'] = $result['perm_count'];
            }
            break;
    }

    wp_safe_redirect( add_query_arg( $redirect_args, admin_url( 'edit.php' ) ) );
    exit;
}
add_action( 'admin_init', 'aquaticpro_handle_setup_actions_early', 5 );

/**
 * Register settings page in WordPress admin
 */
function aquaticpro_add_settings_page() {
    add_submenu_page(
        'edit.php?post_type=mp_request',
        __( 'AquaticPro Settings', 'aquaticpro' ),
        __( 'Settings', 'aquaticpro' ),
        'manage_options',
        'aquaticpro-settings',
        'aquaticpro_render_settings_page'
    );
}
add_action( 'admin_menu', 'aquaticpro_add_settings_page' );

/**
 * Register settings
 */
function aquaticpro_register_settings() {
    register_setting(
        'aquaticpro_settings',
        'aquaticpro_learndash_groups',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'aquaticpro_sanitize_groups',
            'default'           => array(),
        )
    );
    
    // Register App Admin Tier setting - which tier gets admin-like privileges
    register_setting(
        'aquaticpro_settings',
        'aquaticpro_app_admin_tier',
        array(
            'type'              => 'integer',
            'sanitize_callback' => 'absint',
            'default'           => 0, // 0 = disabled, 6 = tier 6 only, etc.
        )
    );

    // ==========================================
    // MODULE ENABLEMENT SETTINGS
    // ==========================================
    
    // Core Modules
    $modules = [
        'mentorship' => true,
        'daily_logs' => true,
        'professional_growth' => false,
        'lms' => false, // Learning
        'taskdeck' => false,
        'awesome_awards' => false,
        'lesson_management' => false,
        'seasonal_returns' => true,
        'mileage' => false,
        'new_hires' => false,
        'certificates' => true,
        'reports' => true,
        'foia_export' => false,
        'pwa' => false
    ];

    foreach ($modules as $slug => $default) {
        register_setting(
            'aquaticpro_settings',
            'aquaticpro_enable_' . $slug,
            array(
                'type'              => 'boolean',
                'sanitize_callback' => 'rest_sanitize_boolean',
                'default'           => $default,
            )
        );
    }

    // Register Camp Roster Password setting
    register_setting(
        'aquaticpro_settings',
        'aquaticpro_camp_roster_password',
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        )
    );

    // Register Default Home View setting
    register_setting(
        'aquaticpro_settings',
        'aquaticpro_default_home_view',
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => 'myMentees',
        )
    );

    // Register Dashboard Settings
    register_setting(
        'aquaticpro_settings',
        'aquaticpro_dashboard_goal',
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_textarea_field',
            'default'           => '',
        )
    );

    register_setting(
        'aquaticpro_settings',
        'aquaticpro_dashboard_mission',
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_textarea_field',
            'default'           => '',
        )
    );

    register_setting(
        'aquaticpro_settings',
        'aquaticpro_dashboard_zipcode',
        array(
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => '',
        )
    );
}
add_action( 'admin_init', 'aquaticpro_register_settings' );

/**
 * Sanitize group IDs
 */
function aquaticpro_sanitize_groups( $input ) {
    if ( ! is_array( $input ) ) {
        return array();
    }
    return array_map( 'absint', $input );
}

/**
 * Sanitize Lesson Management setting - enforces Professional Growth dependency
 */
function aquaticpro_sanitize_lesson_management( $input ) {
    // If Professional Growth is not enabled, force Lesson Management to be disabled
    $professional_growth_enabled = get_option( 'aquaticpro_enable_professional_growth', false );
    if ( ! $professional_growth_enabled ) {
        return false;
    }
    return rest_sanitize_boolean( $input );
}

/**
 * Render the settings page
 */
function aquaticpro_render_settings_page() {
    // Check user capabilities
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    // Get saved settings
    $selected_groups = get_option( 'aquaticpro_learndash_groups', array() );
    
    // Module settings
    $modules = array(
        'mentorship' => array(
            'label' => 'Mentorship',
            'desc' => 'Enable Mentorship program, requests, and timeline.',
            'default' => true
        ),
        'daily_logs' => array(
            'label' => 'Daily Logs',
            'desc' => 'Enable Daily Log submission and dashboard.',
            'default' => true
        ),
        'professional_growth' => array(
            'label' => 'Professional Growth',
            'desc' => 'Enable Career Development, promotion tracking, in-service logs, and audit tracking.',
            'default' => false
        ),
        'lms' => array(
            'label' => 'Learning (LMS)',
            'desc' => 'Enable Learning Management System with Courses and Quizzes.',
            'default' => false
        ),
        'taskdeck' => array(
            'label' => 'TaskDeck',
            'desc' => 'Enable TaskDeck - Kanban board task management system.',
            'default' => false
        ),
        'awesome_awards' => array(
            'label' => 'Awesome Awards',
            'desc' => 'Enable Employee recognition and nomination system.',
            'default' => false
        ),
        'lesson_management' => array(
            'label' => 'Lesson Management',
            'desc' => 'Enable swimming lesson management, evaluations, and camp rosters.',
            'default' => false
        ),
        'seasonal_returns' => array(
            'label' => 'Seasonal Returns',
            'desc' => 'Enable Seasonal Return Intent forms and management.',
            'default' => true
        ),
        'mileage' => array(
            'label' => 'Mileage Reimbursement',
            'desc' => 'Enable Mileage tracking and reimbursement forms.',
            'default' => false
        ),
        'new_hires' => array(
            'label' => 'New Hire Onboarding',
            'desc' => 'Enable New Hire application forms and management.',
            'default' => false
        ),
        'certificates' => array(
            'label' => 'Certificate Tracking',
            'desc' => 'Enable Certificate Tracking for managing and monitoring employee certifications, expiration dates, and renewal workflows.',
            'default' => true
        ),
        'reports' => array(
            'label' => 'Reports',
            'desc' => 'Enable Reporting dashboard.',
            'default' => true
        ),
        'foia_export' => array(
            'label' => 'FOIA Export',
            'desc' => 'Enable FOIA Record export tools for Admins.',
            'default' => false
        ),
        'bento_grid' => array(
            'label' => 'Bento Media Grid',
            'desc' => 'Enable the Bento Media Grid shortcode for displaying posts.',
            'default' => false
        ),
        'pwa' => array(
            'label' => 'Progressive Web App (PWA)',
            'desc' => 'Allow users to install AquaticPro as a standalone app on their device (adds manifest &amp; service worker).',
            'default' => false
        ),
    );

    $camp_roster_password = get_option( 'aquaticpro_camp_roster_password', '' );
    $default_home_view = get_option( 'aquaticpro_default_home_view', 'myMentees' );
    $dashboard_goal = get_option( 'aquaticpro_dashboard_goal', '' );
    $dashboard_mission = get_option( 'aquaticpro_dashboard_mission', '' );
    $dashboard_zipcode = get_option( 'aquaticpro_dashboard_zipcode', '' );
    $app_admin_tier = get_option( 'aquaticpro_app_admin_tier', 0 );
    
    // Check if LearnDash is active
    $learndash_active = function_exists( 'learndash_get_groups' );
    
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <?php
        // Display redirect-based notices from setup actions
        if ( ! empty( $_GET['ap_msg'] ) ) {
            $msg_key    = sanitize_key( $_GET['ap_msg'] );
            $msg_type   = in_array( $_GET['ap_type'] ?? '', array( 'success', 'error', 'warning' ), true ) ? $_GET['ap_type'] : 'success';
            $msg_count  = isset( $_GET['ap_count'] ) ? intval( $_GET['ap_count'] ) : 0;
            $perm_count = isset( $_GET['ap_perm_count'] ) ? intval( $_GET['ap_perm_count'] ) : 0;
            $ls_levels   = isset( $_GET['ap_ls_levels'] )  ? intval( $_GET['ap_ls_levels'] )  : 0;
            $ls_skills   = isset( $_GET['ap_ls_skills'] )  ? intval( $_GET['ap_ls_skills'] )  : 0;
            $ls_types    = isset( $_GET['ap_ls_types'] )   ? intval( $_GET['ap_ls_types'] )   : 0;
            $promo_count = isset( $_GET['ap_promo_count'] ) ? intval( $_GET['ap_promo_count'] ) : 0;

            $messages = array(
                'template_applied'    => sprintf( __( 'Default template applied successfully! Created %d job roles with permissions for all modules.', 'aquaticpro' ), $msg_count ),
                'import_roles'        => sprintf( __( 'Configuration imported successfully! Imported %d job roles with permissions. Note: your promotion criteria were also cleared — re-import them now using the Promotion Criteria section below.', 'aquaticpro' ), $msg_count ),
                'import_perms'        => sprintf( __( 'Permissions imported successfully! (%d permission records restored). Job roles were not included in this file — existing roles were preserved.', 'aquaticpro' ), $perm_count ),
                'import_empty'        => __( 'No job roles or permissions found in the import file.', 'aquaticpro' ),
                'import_invalid'      => __( 'Invalid JSON file. Please check the file format.', 'aquaticpro' ),
                'import_upload'       => __( 'Failed to upload file. Please try again.', 'aquaticpro' ),
                'nonce_fail'          => __( 'Security check failed. Please try again.', 'aquaticpro' ),
                // Lesson setup messages
                'lesson_setup_applied'  => sprintf( __( 'Lesson setup applied! Created %d level(s), %d skill(s), and %d lesson type(s).', 'aquaticpro' ), $ls_levels, $ls_skills, $ls_types ),
                'lesson_default_empty'  => __( 'No built-in lesson default is configured yet. Export your current setup and share it with your developer.', 'aquaticpro' ),
                'lesson_import_upload'  => __( 'Failed to upload lesson setup file. Please try again.', 'aquaticpro' ),
                'lesson_import_invalid' => __( 'Invalid lesson setup JSON file. Please check the file format.', 'aquaticpro' ),
                'lesson_import_empty'   => __( 'No levels, skills, or lesson types found in the import file.', 'aquaticpro' ),
                // Promotion criteria messages
                'promo_setup_applied'  => sprintf( _n( 'Promotion criteria applied! %d criterion inserted.', 'Promotion criteria applied! %d criteria inserted.', $promo_count, 'aquaticpro' ), $promo_count ),
                'promo_default_empty'  => __( 'No built-in promotion criteria default is configured yet. Export your current criteria and share them with your developer.', 'aquaticpro' ),
                'promo_import_upload'  => __( 'Failed to upload promotion criteria file. Please try again.', 'aquaticpro' ),
                'promo_import_invalid' => __( 'Invalid promotion criteria JSON file. Please check the file format.', 'aquaticpro' ),
                'promo_import_empty'   => __( 'No promotion criteria found in the import file.', 'aquaticpro' ),
                'promo_import_no_roles_matched' => __( '⚠️ No criteria were imported — the role titles in the file did not match any existing job roles. You must import Job Roles first, then import Promotion Criteria.', 'aquaticpro' ),
            );

            $text = isset( $messages[ $msg_key ] ) ? $messages[ $msg_key ] : esc_html( $msg_key );
            echo '<div class="notice notice-' . esc_attr( $msg_type ) . ' is-dismissible"><p>' . wp_kses_post( $text ) . '</p></div>';
        }
        ?>
        
        <?php if ( ! $learndash_active ) : ?>
            <div class="notice notice-warning">
                <p><strong><?php _e( 'LearnDash is not active.', 'aquaticpro' ); ?></strong></p>
                <p><?php _e( 'To use group-based access restrictions, please install and activate the LearnDash LMS plugin.', 'aquaticpro' ); ?></p>
            </div>
        <?php endif; ?>
        
        <form action="options.php" method="post">
            <?php settings_fields( 'aquaticpro_settings' ); ?>
            
            <h2><?php _e( 'Module Configuration', 'aquaticpro' ); ?></h2>
            <p class="description"><?php _e( 'Enable or disable specific modules for the platform. This controls visibility for all users.', 'aquaticpro' ); ?></p>
            <table class="form-table" role="presentation">
                <?php foreach ($modules as $slug => $info): 
                    $enabled = get_option('aquaticpro_enable_' . $slug, $info['default']);
                ?>
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_enable_<?php echo $slug; ?>">
                            <?php echo esc_html($info['label']); ?>
                        </label>
                    </th>
                    <td>
                        <fieldset>
                            <label>
                                <input 
                                    type="checkbox" 
                                    id="aquaticpro_enable_<?php echo $slug; ?>"
                                    name="aquaticpro_enable_<?php echo $slug; ?>" 
                                    value="1"
                                    <?php checked( $enabled, true ); ?>
                                />
                                <?php echo esc_html($info['desc']); ?>
                            </label>
                        </fieldset>
                    </td>
                </tr>
                <?php endforeach; ?>

                <tr>
                    <th scope="row">
                        <label for="aquaticpro_camp_roster_password">
                            <?php _e( 'Camp Roster Password', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <input 
                            type="text" 
                            id="aquaticpro_camp_roster_password"
                            name="aquaticpro_camp_roster_password" 
                            value="<?php echo esc_attr( $camp_roster_password ); ?>"
                            class="regular-text"
                        />
                        <p class="description">
                            <?php _e( 'Password required for public (non-logged-in) access to Camp Rosters (Requires Lesson Management).', 'aquaticpro' ); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <h2><?php _e( 'App Administrator Role', 'aquaticpro' ); ?></h2>
            <p class="description" style="margin-bottom: 15px;">
                <?php _e( 'Grant full admin-like privileges within AquaticPro to users with a specific job role tier, without giving them WordPress admin (manage_options) access. This allows business owners/managers to fully administer the app while preventing access to WordPress backend settings.', 'aquaticpro' ); ?>
            </p>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_app_admin_tier">
                            <?php _e( 'App Admin Tier', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <fieldset>
                            <select 
                                id="aquaticpro_app_admin_tier"
                                name="aquaticpro_app_admin_tier"
                            >
                                <option value="0" <?php selected( $app_admin_tier, 0 ); ?>><?php _e( 'Disabled - Only WordPress admins have full access', 'aquaticpro' ); ?></option>
                                <option value="6" <?php selected( $app_admin_tier, 6 ); ?>><?php _e( 'Tier 6 - Executive/Director Level', 'aquaticpro' ); ?></option>
                                <option value="5" <?php selected( $app_admin_tier, 5 ); ?>><?php _e( 'Tier 5+ - Manager Level and above', 'aquaticpro' ); ?></option>
                                <option value="4" <?php selected( $app_admin_tier, 4 ); ?>><?php _e( 'Tier 4+ - Supervisor Level and above', 'aquaticpro' ); ?></option>
                            </select>
                            <p class="description">
                                <?php _e( 'Users at or above this tier will have full App Admin access within AquaticPro, including:', 'aquaticpro' ); ?>
                            </p>
                            <ul style="margin-left: 20px; list-style-type: disc; color: #666;">
                                <li><?php _e( 'User Management - Add/edit/remove users and job roles', 'aquaticpro' ); ?></li>
                                <li><?php _e( 'Role Permissions - Configure all module permissions', 'aquaticpro' ); ?></li>
                                <li><?php _e( 'Reports - Access all reporting features', 'aquaticpro' ); ?></li>
                                <li><?php _e( 'All Modules - Full access to all enabled modules', 'aquaticpro' ); ?></li>
                            </ul>
                            <p class="description" style="margin-top: 10px; color: #d63638;">
                                <strong><?php _e( '⚠️ Security Note:', 'aquaticpro' ); ?></strong> 
                                <?php _e( 'App Admins cannot access WordPress admin pages, install plugins, or modify site settings. Only WordPress administrators retain full system access.', 'aquaticpro' ); ?>
                            </p>
                        </fieldset>
                    </td>
                </tr>
            </table>

            <h2><?php _e( 'General Settings', 'aquaticpro' ); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_default_home_view">
                            <?php _e( 'Default Home Page', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <fieldset>
                            <select 
                                id="aquaticpro_default_home_view"
                                name="aquaticpro_default_home_view"
                            >
                                <option value="homeDashboard" <?php selected( $default_home_view, 'homeDashboard' ); ?>><?php _e( 'Dashboard (Home)', 'aquaticpro' ); ?></option>
                                <option value="myMentees" <?php selected( $default_home_view, 'myMentees' ); ?>><?php _e( 'My Mentorships', 'aquaticpro' ); ?></option>
                                <option value="directory" <?php selected( $default_home_view, 'directory' ); ?>><?php _e( 'Mentor Directory', 'aquaticpro' ); ?></option>
                                <option value="dailyLogs" <?php selected( $default_home_view, 'dailyLogs' ); ?>><?php _e( 'Daily Logs', 'aquaticpro' ); ?></option>
                                <option value="careerDevelopment" <?php selected( $default_home_view, 'careerDevelopment' ); ?>><?php _e( 'Career Development', 'aquaticpro' ); ?></option>
                                <option value="taskdeck" <?php selected( $default_home_view, 'taskdeck' ); ?>><?php _e( 'TaskDeck (Requires TaskDeck Module)', 'aquaticpro' ); ?></option>
                                <option value="reports" <?php selected( $default_home_view, 'reports' ); ?>><?php _e( 'Reports', 'aquaticpro' ); ?></option>
                            </select>
                            <p class="description">
                                <?php _e( 'Choose which page users see when they first log in to AquaticPro.', 'aquaticpro' ); ?>
                            </p>
                        </fieldset>
                    </td>
                </tr>
                
            </table>

            <h2><?php _e( 'Dashboard Settings', 'aquaticpro' ); ?></h2>
            <p class="description" style="margin-bottom: 15px;">
                <?php _e( 'Configure the Dashboard home page widgets. These settings are displayed on the Dashboard view.', 'aquaticpro' ); ?>
            </p>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_dashboard_goal">
                            <?php _e( 'Goal Statement', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <textarea 
                            id="aquaticpro_dashboard_goal"
                            name="aquaticpro_dashboard_goal"
                            rows="3"
                            class="large-text"
                        ><?php echo esc_textarea( $dashboard_goal ); ?></textarea>
                        <p class="description">
                            <?php _e( 'Enter the organization goal statement to display on the dashboard.', 'aquaticpro' ); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="aquaticpro_dashboard_mission">
                            <?php _e( 'Mission Statement', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <textarea 
                            id="aquaticpro_dashboard_mission"
                            name="aquaticpro_dashboard_mission"
                            rows="3"
                            class="large-text"
                        ><?php echo esc_textarea( $dashboard_mission ); ?></textarea>
                        <p class="description">
                            <?php _e( 'Enter the organization mission statement to display on the dashboard.', 'aquaticpro' ); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="aquaticpro_dashboard_zipcode">
                            <?php _e( 'Weather Location (Zip Code)', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <input 
                            type="text" 
                            id="aquaticpro_dashboard_zipcode"
                            name="aquaticpro_dashboard_zipcode"
                            value="<?php echo esc_attr( $dashboard_zipcode ); ?>"
                            class="regular-text"
                            placeholder="e.g., 90210"
                        />
                        <p class="description">
                            <?php _e( 'Enter a US zip code to show weather conditions on the dashboard. Leave empty to hide weather widget.', 'aquaticpro' ); ?>
                        </p>
                    </td>
                </tr>
            </table>
            
            <h2><?php _e( 'Access Restriction', 'aquaticpro' ); ?></h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label><?php _e( 'LearnDash Group Access', 'aquaticpro' ); ?></label>
                    </th>
                    <td>
                        <fieldset>
                            <legend class="screen-reader-text">
                                <span><?php _e( 'LearnDash Group Access', 'aquaticpro' ); ?></span>
                            </legend>
                            
                            <?php if ( $learndash_active ) : ?>
                                <?php
                                // Get all LearnDash groups using get_posts
                                $groups = get_posts( array(
                                    'post_type'      => 'groups',
                                    'posts_per_page' => -1,
                                    'orderby'        => 'title',
                                    'order'          => 'ASC',
                                    'post_status'    => 'publish'
                                ) );
                                ?>
                                
                                <?php if ( ! empty( $groups ) ) : ?>
                                    <p class="description" style="margin-bottom: 15px;">
                                        <?php _e( 'Select LearnDash groups that should have access to mentorship features. Users must be enrolled in at least one selected group to request mentorships, become mentors, or edit their profiles.', 'aquaticpro' ); ?>
                                    </p>
                                    <p class="description" style="margin-bottom: 15px;">
                                        <strong><?php _e( 'If no groups are selected:', 'aquaticpro' ); ?></strong> 
                                        <?php _e( 'All logged-in users will have access (default behavior).', 'aquaticpro' ); ?>
                                    </p>
                                    <p class="description" style="margin-bottom: 15px;">
                                        <strong><?php _e( 'If groups are selected:', 'aquaticpro' ); ?></strong> 
                                        <?php _e( 'Only users enrolled in the selected groups will have access. Other users will be treated as non-logged-in visitors.', 'aquaticpro' ); ?>
                                    </p>
                                    
                                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; background: #fff;">
                                        <?php foreach ( $groups as $group ) : ?>
                                            <label style="display: block; margin-bottom: 8px;">
                                                <input 
                                                    type="checkbox" 
                                                    name="aquaticpro_learndash_groups[]" 
                                                    value="<?php echo esc_attr( $group->ID ); ?>"
                                                    <?php checked( in_array( $group->ID, $selected_groups ) ); ?>
                                                />
                                                <?php echo esc_html( $group->post_title ); ?>
                                                <span style="color: #666; font-size: 12px;">
                                                    (ID: <?php echo esc_html( $group->ID ); ?>)
                                                </span>
                                            </label>
                                        <?php endforeach; ?>
                                    </div>
                                <?php else : ?>
                                    <p class="description">
                                        <?php _e( 'No LearnDash groups found. Please create groups in LearnDash first.', 'aquaticpro' ); ?>
                                    </p>
                                <?php endif; ?>
                                
                            <?php else : ?>
                                <p class="description">
                                    <?php _e( 'LearnDash plugin is required for group-based access restrictions.', 'aquaticpro' ); ?>
                                </p>
                            <?php endif; ?>
                        </fieldset>
                    </td>
                </tr>
            </table>

            <?php
            // Bento Media Grid Settings Section
            $bento_enabled = get_option('aquaticpro_enable_bento_grid', false);
            if ($bento_enabled) :
                $bento_categories = get_option('aquaticpro_bento_categories', []);
                $bento_accent_color = get_option('aquaticpro_bento_accent_color', '#0ea5e9');
                $bento_show_author = get_option('aquaticpro_bento_show_author', true);
                $bento_show_date = get_option('aquaticpro_bento_show_date', true);
                $bento_show_tags = get_option('aquaticpro_bento_show_tags', true);
                $bento_layout_type = get_option('aquaticpro_bento_layout_type', 'bento');
                $bento_grid_title = get_option('aquaticpro_bento_grid_title', 'Media Gallery');
                $all_categories = get_categories(['hide_empty' => false]);
            ?>
            <h2><?php _e( 'Bento Media Grid Settings', 'aquaticpro' ); ?></h2>
            <div class="notice notice-info inline" style="margin: 0 0 20px 0;">
                <p>
                    <strong><?php _e( 'How to use:', 'aquaticpro' ); ?></strong>
                    <?php _e( 'Add the shortcode', 'aquaticpro' ); ?> <code>[bento_media_grid]</code> <?php _e( 'to any page or post.', 'aquaticpro' ); ?>
                </p>
                <p>
                    <strong><?php _e( 'Optional parameters:', 'aquaticpro' ); ?></strong>
                    <code>[bento_media_grid posts_per_page="20" columns="4"]</code>
                </p>
            </div>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_bento_grid_title">
                            <?php _e( 'Grid Title', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <input type="text" id="aquaticpro_bento_grid_title" name="aquaticpro_bento_grid_title" value="<?php echo esc_attr($bento_grid_title); ?>" class="regular-text" placeholder="Media Gallery" />
                        <p class="description"><?php _e( 'The heading displayed above the grid. Leave empty to hide the title.', 'aquaticpro' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_bento_layout_type">
                            <?php _e( 'Grid Layout', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <fieldset>
                            <label style="display: block; margin-bottom: 8px;">
                                <input type="radio" name="aquaticpro_bento_layout_type" value="bento" <?php checked($bento_layout_type, 'bento'); ?> />
                                <strong><?php _e( 'Bento Grid', 'aquaticpro' ); ?></strong> — <?php _e( 'Mixed card sizes for visual interest (large, medium, small, wide, tall)', 'aquaticpro' ); ?>
                            </label>
                            <label style="display: block; margin-bottom: 8px;">
                                <input type="radio" name="aquaticpro_bento_layout_type" value="standard" <?php checked($bento_layout_type, 'standard'); ?> />
                                <strong><?php _e( 'Standard Grid', 'aquaticpro' ); ?></strong> — <?php _e( 'Uniform card sizes in rows (responsive columns based on screen width)', 'aquaticpro' ); ?>
                            </label>
                        </fieldset>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_bento_categories">
                            <?php _e( 'Categories to Include', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <fieldset style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fff;">
                            <?php if (!empty($all_categories)) : ?>
                                <?php foreach ($all_categories as $category) : ?>
                                    <label style="display: block; margin-bottom: 6px;">
                                        <input type="checkbox" name="aquaticpro_bento_categories[]" value="<?php echo esc_attr($category->term_id); ?>" <?php checked(in_array($category->term_id, $bento_categories)); ?> />
                                        <?php echo esc_html($category->name); ?>
                                        <span style="color: #666;">(<?php echo $category->count; ?> posts)</span>
                                    </label>
                                <?php endforeach; ?>
                            <?php else : ?>
                                <p><?php _e( 'No categories found.', 'aquaticpro' ); ?></p>
                            <?php endif; ?>
                        </fieldset>
                        <p class="description"><?php _e( 'Leave all unchecked to show posts from all categories.', 'aquaticpro' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="aquaticpro_bento_accent_color">
                            <?php _e( 'Accent Color', 'aquaticpro' ); ?>
                        </label>
                    </th>
                    <td>
                        <input type="color" id="aquaticpro_bento_accent_color" name="aquaticpro_bento_accent_color" value="<?php echo esc_attr($bento_accent_color); ?>" style="width: 60px; height: 40px; padding: 0; border: 1px solid #ddd; border-radius: 4px;" />
                        <span style="margin-left: 10px; font-family: monospace;"><?php echo esc_html($bento_accent_color); ?></span>
                        <p class="description"><?php _e( 'Primary accent color for the grid (pool-inspired blue recommended).', 'aquaticpro' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <?php _e( 'Display Options', 'aquaticpro' ); ?>
                    </th>
                    <td>
                        <fieldset>
                            <label style="display: block; margin-bottom: 8px;">
                                <input type="checkbox" name="aquaticpro_bento_show_author" value="1" <?php checked($bento_show_author); ?> />
                                <?php _e( 'Show post author', 'aquaticpro' ); ?>
                            </label>
                            <label style="display: block; margin-bottom: 8px;">
                                <input type="checkbox" name="aquaticpro_bento_show_date" value="1" <?php checked($bento_show_date); ?> />
                                <?php _e( 'Show post date', 'aquaticpro' ); ?>
                            </label>
                            <label style="display: block; margin-bottom: 8px;">
                                <input type="checkbox" name="aquaticpro_bento_show_tags" value="1" <?php checked($bento_show_tags); ?> />
                                <?php _e( 'Show post tags', 'aquaticpro' ); ?>
                            </label>
                        </fieldset>
                    </td>
                </tr>
            </table>
            
            <!-- Shortcode Builder -->
            <h3 style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;"><?php _e( 'Shortcode Builder', 'aquaticpro' ); ?></h3>
            <p class="description" style="margin-bottom: 20px;">
                <?php _e( 'Create custom shortcodes with specific settings. Each shortcode can have different categories, access restrictions, and display options.', 'aquaticpro' ); ?>
            </p>
            
            <div id="bento-shortcode-builder" style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; max-width: 800px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- Left Column -->
                    <div>
                        <h4 style="margin-top: 0;"><?php _e( 'Content Settings', 'aquaticpro' ); ?></h4>
                        
                        <!-- Title -->
                        <p>
                            <label for="builder_title"><strong><?php _e( 'Grid Title', 'aquaticpro' ); ?></strong></label><br>
                            <input type="text" id="builder_title" style="width: 100%;" placeholder="<?php echo esc_attr($bento_grid_title); ?>" />
                            <span class="description"><?php _e( 'Leave empty to use global default, or enter "" to hide title.', 'aquaticpro' ); ?></span>
                        </p>
                        
                        <!-- Categories -->
                        <p>
                            <label><strong><?php _e( 'Categories', 'aquaticpro' ); ?></strong></label><br>
                            <span class="description"><?php _e( 'Select specific categories for this instance (leave unchecked for global default).', 'aquaticpro' ); ?></span>
                        </p>
                        <fieldset id="builder_categories" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fafafa;">
                            <?php foreach ($all_categories as $category) : ?>
                                <label style="display: block; margin-bottom: 4px;">
                                    <input type="checkbox" class="builder-category" value="<?php echo esc_attr($category->term_id); ?>" />
                                    <?php echo esc_html($category->name); ?>
                                    <span style="color: #666; font-size: 11px;">(<?php echo $category->count; ?>)</span>
                                </label>
                            <?php endforeach; ?>
                        </fieldset>
                        
                        <!-- Posts Per Page -->
                        <p style="margin-top: 15px;">
                            <label for="builder_posts_per_page"><strong><?php _e( 'Posts Per Page', 'aquaticpro' ); ?></strong></label><br>
                            <input type="number" id="builder_posts_per_page" style="width: 100px;" placeholder="-1" min="-1" />
                            <span class="description"><?php _e( '-1 for all posts', 'aquaticpro' ); ?></span>
                        </p>
                    </div>
                    
                    <!-- Right Column -->
                    <div>
                        <h4 style="margin-top: 0;"><?php _e( 'Access & Display', 'aquaticpro' ); ?></h4>
                        
                        <!-- LearnDash Groups -->
                        <?php if ( function_exists('learndash_get_groups') ) : 
                            $ld_groups = get_posts([
                                'post_type' => 'groups',
                                'posts_per_page' => -1,
                                'orderby' => 'title',
                                'order' => 'ASC',
                                'post_status' => 'publish'
                            ]);
                        ?>
                        <p>
                            <label><strong><?php _e( 'Restrict to LearnDash Groups', 'aquaticpro' ); ?></strong></label><br>
                            <span class="description"><?php _e( 'Only users in selected groups can view this grid. Leave unchecked for public access.', 'aquaticpro' ); ?></span>
                        </p>
                        <fieldset id="builder_groups" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fafafa;">
                            <?php if (!empty($ld_groups)) : ?>
                                <?php foreach ($ld_groups as $group) : ?>
                                    <label style="display: block; margin-bottom: 4px;">
                                        <input type="checkbox" class="builder-group" value="<?php echo esc_attr($group->ID); ?>" />
                                        <?php echo esc_html($group->post_title); ?>
                                        <span style="color: #666; font-size: 11px;">(ID: <?php echo $group->ID; ?>)</span>
                                    </label>
                                <?php endforeach; ?>
                            <?php else : ?>
                                <p style="color: #666; margin: 0;"><?php _e( 'No LearnDash groups found.', 'aquaticpro' ); ?></p>
                            <?php endif; ?>
                        </fieldset>
                        <?php else : ?>
                        <p style="color: #666; background: #f1f5f9; padding: 10px; border-radius: 4px;">
                            <strong><?php _e( 'LearnDash not active', 'aquaticpro' ); ?></strong><br>
                            <?php _e( 'Install LearnDash to enable group-based access restrictions.', 'aquaticpro' ); ?>
                        </p>
                        <?php endif; ?>
                        
                        <!-- Layout -->
                        <p style="margin-top: 15px;">
                            <label for="builder_layout"><strong><?php _e( 'Layout Type', 'aquaticpro' ); ?></strong></label><br>
                            <select id="builder_layout" style="width: 100%;">
                                <option value=""><?php _e( '— Use Global Default —', 'aquaticpro' ); ?></option>
                                <option value="bento"><?php _e( 'Bento Grid (mixed sizes)', 'aquaticpro' ); ?></option>
                                <option value="standard"><?php _e( 'Standard Grid (uniform)', 'aquaticpro' ); ?></option>
                            </select>
                        </p>
                        
                        <!-- Display Options Override -->
                        <p style="margin-top: 15px;">
                            <label><strong><?php _e( 'Override Display Options', 'aquaticpro' ); ?></strong></label>
                        </p>
                        <fieldset style="background: #fafafa; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
                            <label style="display: block; margin-bottom: 4px;">
                                <select id="builder_show_author" style="width: 140px;">
                                    <option value=""><?php _e( 'Use Global', 'aquaticpro' ); ?></option>
                                    <option value="1"><?php _e( 'Show Author', 'aquaticpro' ); ?></option>
                                    <option value="0"><?php _e( 'Hide Author', 'aquaticpro' ); ?></option>
                                </select>
                            </label>
                            <label style="display: block; margin-bottom: 4px;">
                                <select id="builder_show_date" style="width: 140px;">
                                    <option value=""><?php _e( 'Use Global', 'aquaticpro' ); ?></option>
                                    <option value="1"><?php _e( 'Show Date', 'aquaticpro' ); ?></option>
                                    <option value="0"><?php _e( 'Hide Date', 'aquaticpro' ); ?></option>
                                </select>
                            </label>
                            <label style="display: block;">
                                <select id="builder_show_tags" style="width: 140px;">
                                    <option value=""><?php _e( 'Use Global', 'aquaticpro' ); ?></option>
                                    <option value="1"><?php _e( 'Show Tags', 'aquaticpro' ); ?></option>
                                    <option value="0"><?php _e( 'Hide Tags', 'aquaticpro' ); ?></option>
                                </select>
                            </label>
                        </fieldset>
                        
                        <!-- Accent Color -->
                        <p style="margin-top: 15px;">
                            <label for="builder_accent_color"><strong><?php _e( 'Accent Color Override', 'aquaticpro' ); ?></strong></label><br>
                            <input type="color" id="builder_accent_color" value="<?php echo esc_attr($bento_accent_color); ?>" style="width: 50px; height: 30px; padding: 0; border: 1px solid #ddd; border-radius: 4px; vertical-align: middle;" />
                            <label style="margin-left: 10px;">
                                <input type="checkbox" id="builder_use_custom_color" /> <?php _e( 'Use custom color', 'aquaticpro' ); ?>
                            </label>
                        </p>
                    </div>
                </div>
                
                <!-- Generated Shortcode -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <label for="builder_output"><strong><?php _e( 'Generated Shortcode', 'aquaticpro' ); ?></strong></label>
                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                        <input type="text" id="builder_output" readonly style="flex: 1; font-family: monospace; background: #f8fafc; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" value="[bento_media_grid]" />
                        <button type="button" id="builder_copy" class="button" style="white-space: nowrap;">
                            <?php _e( 'Copy Shortcode', 'aquaticpro' ); ?>
                        </button>
                    </div>
                    <p class="description" style="margin-top: 8px;">
                        <?php _e( 'Copy this shortcode and paste it into any page or post.', 'aquaticpro' ); ?>
                    </p>
                </div>
            </div>
            
            <script>
            (function() {
                function updateShortcode() {
                    var parts = ['[bento_media_grid'];
                    
                    // Title
                    var title = document.getElementById('builder_title').value;
                    if (title !== '') {
                        parts.push('title="' + title.replace(/"/g, '\\"') + '"');
                    }
                    
                    // Categories
                    var categories = [];
                    document.querySelectorAll('.builder-category:checked').forEach(function(cb) {
                        categories.push(cb.value);
                    });
                    if (categories.length > 0) {
                        parts.push('categories="' + categories.join(',') + '"');
                    }
                    
                    // Groups
                    var groups = [];
                    document.querySelectorAll('.builder-group:checked').forEach(function(cb) {
                        groups.push(cb.value);
                    });
                    if (groups.length > 0) {
                        parts.push('groups="' + groups.join(',') + '"');
                    }
                    
                    // Posts per page
                    var ppp = document.getElementById('builder_posts_per_page').value;
                    if (ppp !== '' && ppp !== '-1') {
                        parts.push('posts_per_page="' + ppp + '"');
                    }
                    
                    // Layout
                    var layout = document.getElementById('builder_layout').value;
                    if (layout !== '') {
                        parts.push('layout="' + layout + '"');
                    }
                    
                    // Show author
                    var showAuthor = document.getElementById('builder_show_author').value;
                    if (showAuthor !== '') {
                        parts.push('show_author="' + showAuthor + '"');
                    }
                    
                    // Show date
                    var showDate = document.getElementById('builder_show_date').value;
                    if (showDate !== '') {
                        parts.push('show_date="' + showDate + '"');
                    }
                    
                    // Show tags
                    var showTags = document.getElementById('builder_show_tags').value;
                    if (showTags !== '') {
                        parts.push('show_tags="' + showTags + '"');
                    }
                    
                    // Accent color
                    if (document.getElementById('builder_use_custom_color').checked) {
                        var color = document.getElementById('builder_accent_color').value;
                        parts.push('accent_color="' + color + '"');
                    }
                    
                    var shortcode = parts.join(' ') + ']';
                    document.getElementById('builder_output').value = shortcode;
                }
                
                // Bind events
                document.querySelectorAll('#bento-shortcode-builder input, #bento-shortcode-builder select').forEach(function(el) {
                    el.addEventListener('change', updateShortcode);
                    el.addEventListener('input', updateShortcode);
                });
                
                // Copy button
                document.getElementById('builder_copy').addEventListener('click', function() {
                    var output = document.getElementById('builder_output');
                    output.select();
                    document.execCommand('copy');
                    
                    var btn = this;
                    var originalText = btn.textContent;
                    btn.textContent = '<?php _e( 'Copied!', 'aquaticpro' ); ?>';
                    btn.classList.add('button-primary');
                    setTimeout(function() {
                        btn.textContent = originalText;
                        btn.classList.remove('button-primary');
                    }, 2000);
                });
                
                // Initial update
                updateShortcode();
            })();
            </script>
            
            <?php endif; ?>
            
            <?php submit_button( __( 'Save Settings', 'aquaticpro' ) ); ?>
        </form>
        
        <?php if ( ! empty( $selected_groups ) && $learndash_active ) : ?>
            <hr>
            <h2><?php _e( 'Current Access Status', 'aquaticpro' ); ?></h2>
            <table class="widefat" style="max-width: 600px;">
                <thead>
                    <tr>
                        <th><?php _e( 'Group Name', 'aquaticpro' ); ?></th>
                        <th><?php _e( 'Members', 'aquaticpro' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $selected_groups as $group_id ) : ?>
                        <?php
                        $group = get_post( $group_id );
                        if ( $group ) :
                            $members = learndash_get_groups_user_ids( $group_id );
                            $member_count = is_array( $members ) ? count( $members ) : 0;
                        ?>
                            <tr>
                                <td><?php echo esc_html( $group->post_title ); ?></td>
                                <td><?php echo esc_html( $member_count ); ?> <?php _e( 'users', 'aquaticpro' ); ?></td>
                            </tr>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
        
        <hr style="margin: 30px 0;">
        
        <h2><?php _e( 'Setup Template & Default Roles', 'aquaticpro' ); ?></h2>
        <p class="description" style="margin-bottom: 15px;">
            <?php _e( 'For new installations, you can apply a default set of job roles and permissions. You can also export your current configuration to use as a template for other sites.', 'aquaticpro' ); ?>
        </p>
        
        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px;">
            <!-- One-Click Setup -->
            <div style="flex: 1; min-width: 300px; background: #f0f7ff; border: 1px solid #2196f3; border-radius: 8px; padding: 20px;">
                <h3 style="margin-top: 0; color: #1565c0;">
                    <span class="dashicons dashicons-admin-plugins" style="vertical-align: middle;"></span>
                    <?php _e( 'One-Click Setup', 'aquaticpro' ); ?>
                </h3>
                <p style="color: #555;">
                    <?php _e( 'Install the default AquaticPro job roles and permissions template. This will create standard roles (Lifeguard, Head Guard, Supervisor, etc.) with appropriate permissions for all modules.', 'aquaticpro' ); ?>
                </p>
                <?php
                global $wpdb;
                $roles_count = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}pg_job_roles" );
                ?>
                <?php if ( $roles_count > 0 ) : ?>
                    <p style="background: #fff3cd; padding: 10px; border-radius: 4px; color: #856404;">
                        <strong><?php _e( '⚠️ Warning:', 'aquaticpro' ); ?></strong>
                        <?php printf( __( 'You already have %d job roles configured. Running setup will replace them.', 'aquaticpro' ), $roles_count ); ?>
                    </p>
                    <form method="post" style="display: inline;" onsubmit="return confirm('<?php echo esc_js( __( 'This will DELETE all existing job roles and permissions and replace them with defaults. This cannot be undone. Are you sure?', 'aquaticpro' ) ); ?>');">
                        <?php wp_nonce_field( 'aquaticpro_setup_template', 'aquaticpro_setup_nonce' ); ?>
                        <input type="hidden" name="aquaticpro_action" value="apply_default_template" />
                        <button type="submit" class="button button-secondary">
                            <?php _e( 'Reset to Default Template', 'aquaticpro' ); ?>
                        </button>
                    </form>
                <?php else : ?>
                    <form method="post" style="display: inline;">
                        <?php wp_nonce_field( 'aquaticpro_setup_template', 'aquaticpro_setup_nonce' ); ?>
                        <input type="hidden" name="aquaticpro_action" value="apply_default_template" />
                        <button type="submit" class="button button-primary button-hero">
                            <span class="dashicons dashicons-yes" style="vertical-align: middle;"></span>
                            <?php _e( 'Apply Default Setup', 'aquaticpro' ); ?>
                        </button>
                    </form>
                <?php endif; ?>
            </div>
            
            <!-- Export Configuration -->
            <div style="flex: 1; min-width: 300px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 8px; padding: 20px;">
                <h3 style="margin-top: 0; color: #333;">
                    <span class="dashicons dashicons-download" style="vertical-align: middle;"></span>
                    <?php _e( 'Export Configuration', 'aquaticpro' ); ?>
                </h3>
                <p style="color: #555;">
                    <?php _e( 'Download your current job roles and permissions as a JSON file. Use this to backup your configuration or share it with other installations.', 'aquaticpro' ); ?>
                </p>
                <form method="post" style="display: inline;">
                    <?php wp_nonce_field( 'aquaticpro_setup_template', 'aquaticpro_setup_nonce' ); ?>
                    <input type="hidden" name="aquaticpro_action" value="export_configuration" />
                    <button type="submit" class="button button-secondary">
                        <span class="dashicons dashicons-download" style="vertical-align: middle;"></span>
                        <?php _e( 'Export to JSON', 'aquaticpro' ); ?>
                    </button>
                </form>
            </div>
            
            <!-- Import Configuration -->
            <div style="flex: 1; min-width: 300px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 8px; padding: 20px;">
                <h3 style="margin-top: 0; color: #333;">
                    <span class="dashicons dashicons-upload" style="vertical-align: middle;"></span>
                    <?php _e( 'Import Configuration', 'aquaticpro' ); ?>
                </h3>
                <p style="color: #555;">
                    <?php _e( 'Upload a previously exported JSON configuration file to restore or apply roles and permissions.', 'aquaticpro' ); ?>
                </p>
                <form method="post" enctype="multipart/form-data" style="display: inline;" onsubmit="return confirm('<?php echo esc_js( __( 'This will replace all existing job roles and permissions. Are you sure?', 'aquaticpro' ) ); ?>');">
                    <?php wp_nonce_field( 'aquaticpro_setup_template', 'aquaticpro_setup_nonce' ); ?>
                    <input type="hidden" name="aquaticpro_action" value="import_configuration" />
                    <input type="file" name="aquaticpro_import_file" accept=".json" required style="margin-bottom: 10px;" />
                    <br>
                    <button type="submit" class="button button-secondary">
                        <span class="dashicons dashicons-upload" style="vertical-align: middle;"></span>
                        <?php _e( 'Import from JSON', 'aquaticpro' ); ?>
                    </button>
                </form>
            </div>
        </div>
        
        <hr style="margin: 30px 0;">

        <?php aquaticpro_render_lesson_setup_section(); ?>

        <?php aquaticpro_render_promotion_setup_section(); ?>

        <hr style="margin: 30px 0;">
        
                <h2><?php _e( 'Using AquaticPro', 'aquaticpro' ); ?></h2>\n        <div style="max-width: 800px;">\n            <h3><?php _e( 'Shortcode', 'aquaticpro' ); ?></h3>\n            <p><?php _e( 'To display AquaticPro on any page or post, use the following shortcode:', 'aquaticpro' ); ?></p>
            <div style="background: #f5f5f5; border: 1px solid #ddd; padding: 15px; border-radius: 4px; margin: 15px 0; font-family: monospace; font-size: 14px;">
                [aquaticpro_app]
            </div>
            
            <h4><?php _e( 'Default View Attribute', 'aquaticpro' ); ?></h4>
            <p><?php _e( 'You can specify which page should be displayed by default when the platform loads using the <code>default_view</code> attribute. This allows you to create multiple entry points to different sections of the platform:', 'aquaticpro' ); ?></p>
            
            <table class="widefat" style="margin: 15px 0; max-width: 700px;">
                <thead>
                    <tr>
                        <th style="padding: 10px;"><?php _e( 'Shortcode Example', 'aquaticpro' ); ?></th>
                        <th style="padding: 10px;"><?php _e( 'Default Page', 'aquaticpro' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app]</td>
                        <td style="padding: 8px;"><?php _e( 'My Mentees (logged in) / Portfolio Directory (logged out)', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="careerDevelopment"]</td>
                        <td style="padding: 8px;"><?php _e( 'Career Development / My Promotion Progress', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="myMentees"]</td>
                        <td style="padding: 8px;"><?php _e( 'My Mentorships', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="directory"]</td>
                        <td style="padding: 8px;"><?php _e( 'Mentor Directory', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="portfolioDirectory"]</td>
                        <td style="padding: 8px;"><?php _e( 'Public Portfolio Directory', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="userManagement"]</td>
                        <td style="padding: 8px;"><?php _e( 'User Management (admins only)', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="admin"]</td>
                        <td style="padding: 8px;"><?php _e( 'Admin Panel (admins only)', 'aquaticpro' ); ?></td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 8px; font-family: monospace; background: #f9f9f9;">[aquaticpro_app default_view="reports"]</td>
                        <td style="padding: 8px;"><?php _e( 'Compliance Reports (admins only)', 'aquaticpro' ); ?></td>
                    </tr>
                </tbody>
            </table>
            
            <div style="background: #e7f3ff; border: 1px solid #2196f3; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <strong>💡 <?php _e( 'Use Case Example:', 'aquaticpro' ); ?></strong>
                <p style="margin: 10px 0 5px 0;">
                    <?php _e( 'Create two separate pages:', 'aquaticpro' ); ?>
                </p>
                <ul style="margin: 5px 0;">
                    <li><strong><?php _e( 'Page 1 - "Mentorship Portal":', 'aquaticpro' ); ?></strong> <?php _e( 'Use <code>[aquaticpro_app]</code> to show mentorship features by default', 'aquaticpro' ); ?></li>
                    <li><strong><?php _e( 'Page 2 - "Career Development":', 'aquaticpro' ); ?></strong> <?php _e( 'Use <code>[aquaticpro_app default_view="careerDevelopment"]</code> to show promotion progress by default', 'aquaticpro' ); ?></li>
                </ul>
                <p style="margin: 5px 0 0 0;">
                    <?php _e( 'Users can still navigate between all sections using the header menu, but each page will start at your chosen default view.', 'aquaticpro' ); ?>
                </p>
            </div>
            
            <h3><?php _e( 'Setup Instructions', 'aquaticpro' ); ?></h3>
            <ol style="line-height: 1.8;">
                <li>
                    <strong><?php _e( 'Create a new page:', 'aquaticpro' ); ?></strong>
                    <?php _e( 'Go to Pages → Add New in your WordPress admin.', 'aquaticpro' ); ?>
                </li>
                <li>
                    <strong><?php _e( 'Add the shortcode:', 'aquaticpro' ); ?></strong>
                    <?php _e( 'In the page editor, add the shortcode [aquaticpro_app] where you want the platform to appear.', 'aquaticpro' ); ?>
                </li>
                <li>\n                    <strong><?php _e( 'Publish the page:', 'aquaticpro' ); ?></strong>\n                    <?php _e( 'Save and publish your page. AquaticPro will now be available at that URL.', 'aquaticpro' ); ?>\n                </li>
                <li>
                    <strong><?php _e( 'Recommended:', 'aquaticpro' ); ?></strong>
                    <?php _e( 'Use a full-width page template if your theme supports it for the best experience.', 'aquaticpro' ); ?>
                </li>
            </ol>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <strong>📝 <?php _e( 'Note:', 'aquaticpro' ); ?></strong>
                <p style="margin: 5px 0 0 0;">
                    <?php _e( 'The platform will hide the page title by default to avoid duplicate headers. If you want to customize the page further, consider using a page builder or custom template.', 'aquaticpro' ); ?>
                </p>
            </div>
            
            <h3><?php _e( 'Features', 'aquaticpro' ); ?></h3>
            <ul style="line-height: 1.8;">
                <li><?php _e( 'Browse mentor directory and view mentor profiles', 'aquaticpro' ); ?></li>
                <li><?php _e( 'Request mentorship from available mentors', 'aquaticpro' ); ?></li>
                <li><?php _e( 'Manage active mentorships and collaborate on goals', 'aquaticpro' ); ?></li>
                <li><?php _e( 'Track tasks, initiatives, meetings, and progress updates', 'aquaticpro' ); ?></li>
                <li><?php _e( 'Create and share public portfolios', 'aquaticpro' ); ?></li>
                <li><?php _e( 'Receive email notifications for mentorship activities', 'aquaticpro' ); ?></li>
            </ul>
        </div>
    </div>
    
    <script>
    jQuery(document).ready(function($) {
        // Toggle Lesson Management settings visibility based on Professional Growth checkbox
        var $professionalGrowth = $('#aquaticpro_enable_professional_growth');
        var $lessonManagement = $('#aquaticpro_enable_lesson_management');
        var $lmSettings = $('.lm-setting');
        
        // Handle Professional Growth toggle - controls Lesson Management availability
        $professionalGrowth.on('change', function() {
            if (!this.checked) {
                $lessonManagement.prop('checked', false).prop('disabled', true);
                $lmSettings.hide();
            } else {
                $lessonManagement.prop('disabled', false);
            }
        });
        
        // Handle Lesson Management toggle - controls Camp Roster Password visibility
        $lessonManagement.on('change', function() {
            if (this.checked) {
                $lmSettings.show();
            } else {
                $lmSettings.hide();
            }
        });
    });
    </script>
    <?php
}

/**
 * Check if a user has access to mentorship features
 * 
 * @param int $user_id User ID to check (defaults to current user)
 * @return bool True if user has access, false otherwise
 */
function aquaticpro_user_has_access( $user_id = null ) {
    // Default to current user
    if ( $user_id === null ) {
        $user_id = get_current_user_id();
    }
    
    // Not logged in = no access
    if ( ! $user_id ) {
        return false;
    }
    
    // Admins always have access
    if ( user_can( $user_id, 'manage_options' ) ) {
        error_log("Access check for user $user_id: Admin user, granting access");
        return true;
    }
    
    // Get restricted groups setting
    $restricted_groups = get_option( 'aquaticpro_learndash_groups', array() );
    
    // If no groups are selected, all logged-in users have access
    if ( empty( $restricted_groups ) ) {
        error_log("Access check for user $user_id: No groups restriction, granting access");
        return true;
    }
    
    // Check if LearnDash is active
    if ( ! function_exists( 'learndash_get_users_group_ids' ) ) {
        // LearnDash not active - grant access to all logged-in users
        error_log("Access check for user $user_id: LearnDash not active, granting access to logged-in user");
        return true;
    }
    
    // Get user's LearnDash groups
    $user_groups = learndash_get_users_group_ids( $user_id );
    
    if ( empty( $user_groups ) ) {
        error_log("Access check for user $user_id: User has no groups, denying");
        return false;
    }
    
    // Check if user is in any of the restricted groups
    $has_access = ! empty( array_intersect( $restricted_groups, $user_groups ) );
    error_log("Access check for user $user_id: Restricted groups=" . json_encode($restricted_groups) . ", User groups=" . json_encode($user_groups) . ", Has access=" . ($has_access ? 'YES' : 'NO'));
    
    return $has_access;
}

/**
 * Permission callback for REST API endpoints that require mentorship access
 */
function aquaticpro_check_access_permission() {
    $user_id = get_current_user_id();
    
    // User must be logged in
    if ( ! $user_id ) {
        error_log("Permission check FAILED: User not logged in");
        return false;
    }
    // Check if user has AquaticPro access
    $has_access = aquaticpro_user_has_access( $user_id );
    error_log("Permission check for user $user_id: " . ($has_access ? 'ALLOWED' : 'DENIED'));
    return $has_access;
}

/**
 * Backward compatibility wrapper for renamed permission check function.
 * Maps old function name to new one so existing API routes don't break.
 */
if ( ! function_exists( 'mentorship_platform_check_access_permission' ) ) {
    function mentorship_platform_check_access_permission() {
        return aquaticpro_check_access_permission();
    }
}

/**
 * Backward compatibility wrapper for renamed user access function.
 * Maps old function name to new one so existing code doesn't break.
 */
if ( ! function_exists( 'mentorship_platform_user_has_access' ) ) {
    function mentorship_platform_user_has_access( $user_id = null ) {
        return aquaticpro_user_has_access( $user_id );
    }
}

/**
 * Check if a user is an App Admin (has admin-like privileges within AquaticPro).
 * 
 * App Admins are users who have a job role at or above the configured App Admin tier.
 * They get full admin access within the AquaticPro app without WordPress manage_options.
 * 
 * @param int|null $user_id User ID to check (defaults to current user)
 * @return bool True if user is an App Admin, false otherwise
 */
function aquaticpro_is_app_admin( $user_id = null ) {
    if ( $user_id === null ) {
        $user_id = get_current_user_id();
    }
    
    if ( ! $user_id ) {
        return false;
    }
    
    // WordPress admins are always app admins
    if ( user_can( $user_id, 'manage_options' ) ) {
        return true;
    }
    
    // Check if App Admin tier is configured
    $app_admin_tier = (int) get_option( 'aquaticpro_app_admin_tier', 0 );
    if ( $app_admin_tier < 1 ) {
        return false; // Feature disabled
    }
    
    // Get user's highest tier from their job roles
    $user_tier = aquaticpro_get_user_highest_tier( $user_id );
    
    return $user_tier >= $app_admin_tier;
}

/**
 * Get the highest job role tier for a user.
 * 
 * @param int $user_id User ID
 * @return int The user's highest tier (0 if none found)
 */
function aquaticpro_get_user_highest_tier( $user_id ) {
    global $wpdb;
    
    $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    
    // Check if tables exist
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" ) !== $assignments_table ) {
        return 0;
    }
    
    // Get highest tier from active assignments
    $tier = $wpdb->get_var( $wpdb->prepare(
        "SELECT MAX(r.tier) 
         FROM $assignments_table a 
         INNER JOIN $roles_table r ON a.job_role_id = r.id 
         WHERE a.user_id = %d 
         AND (a.end_date IS NULL OR a.end_date >= CURDATE())",
        $user_id
    ) );
    
    if ( $tier ) {
        return (int) $tier;
    }
    
    // Fallback: Check user meta for legacy pg_job_roles
    $job_roles_meta = get_user_meta( $user_id, 'pg_job_roles', true );
    if ( ! empty( $job_roles_meta ) && is_array( $job_roles_meta ) ) {
        $role_ids = array_map( 'intval', $job_roles_meta );
        $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
        
        $tier = $wpdb->get_var( $wpdb->prepare(
            "SELECT MAX(tier) FROM $roles_table WHERE id IN ($placeholders)",
            ...$role_ids
        ) );
        
        return $tier ? (int) $tier : 0;
    }
    
    return 0;
}

/**
 * Apply the default roles and permissions template.
 * Returns a result array instead of calling add_settings_error.
 */
function aquaticpro_apply_default_template_silent() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    
    // Table names
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $daily_log_perms = $wpdb->prefix . 'mp_daily_log_permissions';
    $scan_audit_perms = $wpdb->prefix . 'pg_scan_audit_permissions';
    $live_drill_perms = $wpdb->prefix . 'pg_live_drill_permissions';
    $inservice_perms = $wpdb->prefix . 'pg_inservice_permissions';
    $cashier_audit_perms = $wpdb->prefix . 'pg_cashier_audit_permissions';
    $taskdeck_perms = $wpdb->prefix . 'pg_taskdeck_permissions';
    $reports_perms = $wpdb->prefix . 'pg_reports_permissions';
    $lesson_mgmt_perms = $wpdb->prefix . 'pg_lesson_management_permissions';
    $awesome_awards_perms = $wpdb->prefix . 'awesome_awards_permissions';
    
    // Clear existing data
    $wpdb->query( "TRUNCATE TABLE $roles_table" );
    $wpdb->query( "TRUNCATE TABLE $daily_log_perms" );
    $wpdb->query( "TRUNCATE TABLE $scan_audit_perms" );
    $wpdb->query( "TRUNCATE TABLE $live_drill_perms" );
    $wpdb->query( "TRUNCATE TABLE $inservice_perms" );
    $wpdb->query( "TRUNCATE TABLE $cashier_audit_perms" );
    $wpdb->query( "TRUNCATE TABLE $taskdeck_perms" );
    $wpdb->query( "TRUNCATE TABLE $reports_perms" );
    $wpdb->query( "TRUNCATE TABLE $lesson_mgmt_perms" );
    $wpdb->query( "TRUNCATE TABLE $awesome_awards_perms" );
    
    // Default Job Roles — matches the standard AquaticPro role structure.
    // title, tier, inservice_hours (hrs/month)
    $default_roles = array(
        // Tier 1 - Entry Level
        array( 'name' => 'Cashier & Concessions',    'tier' => 1, 'inservice_hours' => 4.00 ),
        array( 'name' => 'Lifeguard',                'tier' => 1, 'inservice_hours' => 4.00 ),
        array( 'name' => 'Swim Instructor',          'tier' => 1, 'inservice_hours' => 2.00 ),

        // Tier 2 - Coordinator/Lead
        array( 'name' => 'Concessions Coordinator',  'tier' => 2, 'inservice_hours' => 4.00 ),
        array( 'name' => 'Head Guard',               'tier' => 2, 'inservice_hours' => 4.00 ),
        array( 'name' => 'Lesson Coordinator',       'tier' => 2, 'inservice_hours' => 4.00 ),

        // Tier 3 - Manager
        array( 'name' => 'Pool Manager',             'tier' => 3, 'inservice_hours' => 4.00 ),

        // Tier 4 - Aquatic Coordinator
        array( 'name' => 'Aquatic Coordinator',      'tier' => 4, 'inservice_hours' => 4.00 ),

        // Tier 6 - Plugin Admin (Full Access)
        array( 'name' => 'Aquatic Manager',          'tier' => 6, 'inservice_hours' => 4.00 ),
    );
    
    // Insert job roles
    $role_ids = array();
    foreach ( $default_roles as $role ) {
        $wpdb->insert(
            $roles_table,
            array(
                'title'           => $role['name'],
                'tier'            => $role['tier'],
                'inservice_hours' => $role['inservice_hours'],
            ),
            array( '%s', '%d', '%f' )
        );
        $role_ids[ $role['name'] ] = $wpdb->insert_id;
    }
    
    // Default permissions by tier
    // Format: tier => [can_view, can_create, can_edit, can_delete, can_moderate_all]
    $tier_permissions = array(
        1 => array( 1, 1, 1, 0, 0 ), // Entry: view + create + edit own
        2 => array( 1, 1, 1, 1, 0 ), // Coordinator/Lead: full own access
        3 => array( 1, 1, 1, 1, 1 ), // Manager: moderate all
        4 => array( 1, 1, 1, 1, 1 ), // Aquatic Coordinator: full access
        5 => array( 1, 1, 1, 1, 1 ), // (unused tier)
        6 => array( 1, 1, 1, 1, 1 ), // Plugin Admin: full access
    );
    
    // Insert permissions for each role
    foreach ( $default_roles as $role ) {
        $perms = $tier_permissions[ $role['tier'] ];
        $role_id = $role_ids[ $role['name'] ];
        
        // Daily Logs
        $wpdb->insert( $daily_log_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // Scan Audits
        $wpdb->insert( $scan_audit_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // Live Drills
        $wpdb->insert( $live_drill_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // In-Service
        $wpdb->insert( $inservice_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // Cashier Audits
        $wpdb->insert( $cashier_audit_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // TaskDeck - special permissions
        $taskdeck_data = array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_view_only_assigned' => ($role['tier'] <= 2) ? 1 : 0,
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
            'can_manage_primary_deck' => ($role['tier'] >= 4) ? 1 : 0,
            'can_create_public_decks' => ($role['tier'] >= 3) ? 1 : 0,
        );
        $wpdb->insert( $taskdeck_perms, $taskdeck_data );
        
        // Reports - only tier 4+ can view all records
        $wpdb->insert( $reports_perms, array(
            'job_role_id' => $role_id,
            'can_view_all_records' => ($role['tier'] >= 4) ? 1 : 0,
        ) );
        
        // Lesson Management
        $wpdb->insert( $lesson_mgmt_perms, array(
            'job_role_id' => $role_id,
            'can_view' => $perms[0],
            'can_create' => $perms[1],
            'can_edit' => $perms[2],
            'can_delete' => $perms[3],
            'can_moderate_all' => $perms[4],
        ) );
        
        // Awesome Awards - special permissions
        $aa_data = array(
            'job_role_id' => $role_id,
            'can_nominate' => 1, // Everyone can nominate
            'can_vote' => ($role['tier'] >= 2) ? 1 : 0, // Tier 2+ can vote
            'can_approve' => ($role['tier'] >= 4) ? 1 : 0, // Tier 4+ can approve
            'can_direct_assign' => ($role['tier'] >= 5) ? 1 : 0, // Tier 5+ can direct assign
            'can_manage_periods' => ($role['tier'] >= 5) ? 1 : 0, // Tier 5+ can manage periods
            'can_view_nominations' => 1,
            'can_view_winners' => 1,
            'can_view_archives' => 1,
            'can_archive' => ($role['tier'] >= 5) ? 1 : 0,
        );
        $wpdb->insert( $awesome_awards_perms, $aa_data );
    }
    
    return array(
        'type'    => 'success',
        'msg_key' => 'template_applied',
        'count'   => count( $default_roles ),
    );
}

/**
 * Export current configuration to JSON
 */
function aquaticpro_export_configuration() {
    global $wpdb;
    
    // Gather all data
    $export_data = array(
        'version' => '1.0',
        'exported_at' => current_time( 'mysql' ),
        'site_url' => get_site_url(),
        'job_roles' => $wpdb->get_results( "SELECT id, title, tier, description, inservice_hours FROM {$wpdb->prefix}pg_job_roles ORDER BY tier, id", ARRAY_A ),
        'permissions' => array(
            'daily_logs' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}mp_daily_log_permissions", ARRAY_A ),
            'scan_audits' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_scan_audit_permissions", ARRAY_A ),
            'live_drills' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_live_drill_permissions", ARRAY_A ),
            'inservice' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_inservice_permissions", ARRAY_A ),
            'cashier_audits' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_cashier_audit_permissions", ARRAY_A ),
            'taskdeck' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_taskdeck_permissions", ARRAY_A ),
            'reports' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_reports_permissions", ARRAY_A ),
            'lesson_management' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pg_lesson_management_permissions", ARRAY_A ),
            'awesome_awards' => $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}awesome_awards_permissions", ARRAY_A ),
        ),
    );
    
    // Send as download
    $filename = 'aquaticpro-config-' . date( 'Y-m-d-His' ) . '.json';
    header( 'Content-Type: application/json' );
    header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
    header( 'Cache-Control: no-cache, no-store, must-revalidate' );
    
    echo json_encode( $export_data, JSON_PRETTY_PRINT );
    exit;
}

/**
 * Import configuration from JSON file.
 * Returns a result array instead of calling add_settings_error.
 */
function aquaticpro_import_configuration_silent() {
    global $wpdb;

    if ( ! isset( $_FILES['aquaticpro_import_file'] ) || $_FILES['aquaticpro_import_file']['error'] !== UPLOAD_ERR_OK ) {
        return array( 'type' => 'error', 'msg_key' => 'import_upload' );
    }

    $file_content = file_get_contents( $_FILES['aquaticpro_import_file']['tmp_name'] );
    $import_data  = json_decode( $file_content, true );

    if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $import_data ) ) {
        return array( 'type' => 'error', 'msg_key' => 'import_invalid' );
    }
    
    // Table names
    $roles_table = $wpdb->prefix . 'pg_job_roles';
    $perm_tables = array(
        'daily_logs'        => $wpdb->prefix . 'mp_daily_log_permissions',
        'scan_audits'       => $wpdb->prefix . 'pg_scan_audit_permissions',
        'live_drills'       => $wpdb->prefix . 'pg_live_drill_permissions',
        'inservice'         => $wpdb->prefix . 'pg_inservice_permissions',
        'cashier_audits'    => $wpdb->prefix . 'pg_cashier_audit_permissions',
        'taskdeck'          => $wpdb->prefix . 'pg_taskdeck_permissions',
        'reports'           => $wpdb->prefix . 'pg_reports_permissions',
        'lesson_management' => $wpdb->prefix . 'pg_lesson_management_permissions',
        'awesome_awards'    => $wpdb->prefix . 'awesome_awards_permissions',
    );

    $has_roles = ! empty( $import_data['job_roles'] );

    // Clear existing data.
    // Use DELETE + AUTO_INCREMENT reset instead of TRUNCATE — TRUNCATE requires
    // the DROP privilege which many shared hosts don't grant to the WP DB user.
    // Only wipe the roles table when the import file actually contains role definitions.
    if ( $has_roles ) {
        $wpdb->query( "DELETE FROM {$roles_table}" );
        $wpdb->query( "ALTER TABLE {$roles_table} AUTO_INCREMENT = 1" );
        // Wipe promotion criteria too — their job_role_id values become orphaned
        // after roles are cleared and re-inserted with new auto-increment IDs.
        // The user should re-import promotion criteria separately after this.
        $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
        $wpdb->query( "DELETE FROM {$criteria_table}" );
        $wpdb->query( "ALTER TABLE {$criteria_table} AUTO_INCREMENT = 1" );
    }
    foreach ( $perm_tables as $table ) {
        $wpdb->query( "DELETE FROM {$table}" );
        $wpdb->query( "ALTER TABLE {$table} AUTO_INCREMENT = 1" );
    }

    // Map old IDs to new IDs (used when job roles are included in the import).
    $id_map = array();

    if ( $has_roles ) {
        foreach ( $import_data['job_roles'] as $role ) {
            $old_id = $role['id'];
            unset( $role['id'], $role['created_at'], $role['updated_at'] );

            $wpdb->insert( $roles_table, $role );
            $id_map[ $old_id ] = $wpdb->insert_id;
        }
    }

    // Import permissions.
    // When job_roles was empty (permissions-only export), the original job_role_id
    // values are used as-is so they map to existing roles in the database.
    $perm_count = 0;
    if ( isset( $import_data['permissions'] ) && is_array( $import_data['permissions'] ) ) {
        foreach ( $import_data['permissions'] as $perm_type => $permissions ) {
            if ( ! isset( $perm_tables[ $perm_type ] ) || ! is_array( $permissions ) ) {
                continue;
            }

            $table = $perm_tables[ $perm_type ];

            foreach ( $permissions as $perm ) {
                $old_role_id = intval( $perm['job_role_id'] );

                if ( $has_roles ) {
                    // Remap to the newly inserted role ID.
                    if ( ! isset( $id_map[ $old_role_id ] ) ) {
                        continue;
                    }
                    $perm['job_role_id'] = $id_map[ $old_role_id ];
                } else {
                    // Preserve original ID — assumes matching roles already exist.
                    $perm['job_role_id'] = $old_role_id;
                }

                unset( $perm['id'], $perm['created_at'], $perm['updated_at'] );
                if ( $wpdb->insert( $table, $perm ) ) {
                    $perm_count++;
                }
            }
        }
    }

    if ( ! $has_roles && $perm_count === 0 ) {
        return array( 'type' => 'error', 'msg_key' => 'import_empty' );
    }

    if ( $has_roles ) {
        return array(
            'type'    => 'success',
            'msg_key' => 'import_roles',
            'count'   => count( $import_data['job_roles'] ),
        );
    }

    return array(
        'type'       => 'success',
        'msg_key'    => 'import_perms',
        'perm_count' => $perm_count,
    );
}
