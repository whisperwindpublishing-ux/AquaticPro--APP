<?php
/**
 * Admin Menu and Dashboard Page Setup
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

add_action( 'admin_menu', 'lm_add_admin_menu_and_submenus' );

/**
 * Adds the main menu and all submenu pages for the Lesson Management plugin.
 */
function lm_add_admin_menu_and_submenus() {
    // 1. Add the main "Lessons" parent menu page.
    add_menu_page(
        __( 'Lesson Dashboard', 'lesson-management' ),
        __( 'Lessons', 'lesson-management' ),
        'view_lesson_dashboard',
        'lesson-dashboard', // This is the parent slug
        'lm_render_admin_app_page',
        'dashicons-welcome-learn-more',
        20
    );

    // 2. Add the "Email Evaluations" submenu page.
    // The rendering function 'lm_render_bulk_email_page' is defined in 'includes/email-handler.php'.
    add_submenu_page(
        'lesson-dashboard', // Parent slug
        __( 'Email Evaluations', 'lesson-management' ),
        __( 'Email Evaluations', 'lesson-management' ),
        'view_bulk_email_page',
        'lm-bulk-email',
        'lm_render_bulk_email_page'
    );
    
    // 3. Add the "Email Settings" submenu page.
    // The rendering function 'lm_render_email_settings_page' is defined in 'admin/email-settings-page.php'.
    add_submenu_page(
        'lesson-dashboard', // Parent slug
        __( 'Email Settings', 'lesson-management' ),
        __( 'Email Settings', 'lesson-management' ),
        'manage_options',
        'lm-email-settings',
        'lm_render_email_settings_page'
    );
    
    // 4. Add the original "Settings" submenu page.
    $settings_hook = add_submenu_page(
        'lesson-dashboard',
        __( 'Settings', 'lesson-management' ),
        __( 'Settings', 'lesson-management' ),
        'manage_options',
        'lm-settings',
        'lm_render_settings_page'
    );

    // Hook the form handlers for the original settings page.
    add_action( "load-{$settings_hook}", 'lm_handle_import_submission' );
    add_action( "load-{$settings_hook}", 'lm_handle_permissions_submission' );
}

/**
 * Renders the main React application container.
 */
function lm_render_admin_app_page() {
    echo '<div id="lm-admin-app" class="wrap"></div>';
}

/**
 * Renders the original settings/import page.
 * NOTE: The content of this function remains unchanged.
 */
function lm_render_settings_page() {
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        
        <div id="poststuff">
            <div id="post-body" class="metabox-holder columns-2">
                <div id="post-body-content">
                    <div class="meta-box-sortables ui-sortable">
                        <div class="postbox">
                            <h2 class="hndle"><span><?php esc_html_e( 'Permissions', 'lesson-management' ); ?></span></h2>
                            <div class="inside">
                                <p><?php esc_html_e( 'Select the user roles that should have access to the main Lesson Management dashboard.', 'lesson-management' ); ?></p>
                                <form method="post" action="admin.php?page=lm-settings">
                                    <?php wp_nonce_field( 'lm_permissions_nonce_action', 'lm_permissions_nonce' ); ?>
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row"><?php esc_html_e( 'Allowed Roles', 'lesson-management' ); ?></th>
                                            <td>
                                                <?php
                                                $allowed_roles = get_option( 'lm_allowed_roles', array( 'administrator' ) );
                                                foreach ( get_editable_roles() as $role_slug => $role_info ) {
                                                    // Administrator always has access and cannot be disabled.
                                                    $is_admin      = ( 'administrator' === $role_slug );
                                                    $is_checked    = $is_admin || in_array( $role_slug, $allowed_roles, true );
                                                    printf( '<label><input type="checkbox" name="lm_allowed_roles[]" value="%s" %s %s/> %s</label><br>', esc_attr( $role_slug ), checked( $is_checked, true, false ), disabled( $is_admin, true, false ), esc_html( $role_info['name'] ) );
                                                }
                                                ?>
                                            </td>
                                        </tr>
                                    </table>
                                    <?php submit_button( __( 'Save Permissions', 'lesson-management' ), 'primary', 'lm_permissions_submit' ); ?>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="postbox-container-1" class="postbox-container">
                <div class="meta-box-sortables">
                    <div class="postbox">
                        <h2 class="hndle"><span><?php esc_html_e( 'Frontend Shortcodes', 'lesson-management' ); ?></span></h2>
                        <div class="inside">
                            <h3 style="margin-top: 0;"><?php esc_html_e( 'Lesson Management App', 'lesson-management' ); ?></h3>
                            <p><?php esc_html_e( 'Display the full Lesson Management application on any page. Users need the "view_lesson_dashboard" permission (configured above).', 'lesson-management' ); ?></p>
                            <p>
                                <strong><?php esc_html_e( 'Shortcode:', 'lesson-management' ); ?></strong>
                                <input type="text" readonly value="[lesson_management_app]" class="regular-text" onclick="this.select();" style="cursor: copy; width: 100%; margin-top: 5px;">
                            </p>
                            
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                            
                            <h3><?php esc_html_e( 'Email Evaluations', 'lesson-management' ); ?></h3>
                            <p><?php esc_html_e( 'Display the Email Evaluations page on the frontend. Users need the "view_bulk_email_page" permission (configure in Email Settings).', 'lesson-management' ); ?></p>
                            <p>
                                <strong><?php esc_html_e( 'Shortcode:', 'lesson-management' ); ?></strong>
                                <input type="text" readonly value="[lesson_email_evaluations]" class="regular-text" onclick="this.select();" style="cursor: copy; width: 100%; margin-top: 5px;">
                            </p>
                            
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                            
                            <h3><?php esc_html_e( 'Camp Rosters (Public)', 'lesson-management' ); ?></h3>
                            <p><?php esc_html_e( 'Display a public, read-only view of camp rosters on any page. Includes a dropdown to filter by camp. No login required.', 'lesson-management' ); ?></p>
                            <p>
                                <strong><?php esc_html_e( 'Shortcode:', 'lesson-management' ); ?></strong>
                                <input type="text" readonly value="[lm_camp_rosters]" class="regular-text" onclick="this.select();" style="cursor: copy; width: 100%; margin-top: 5px;">
                            </p>
                            
                            <p class="description" style="margin-top: 15px;">
                                <?php esc_html_e( 'Copy any shortcode above and paste it into the content editor of a page or post. For detailed setup instructions, see the FRONTEND_USAGE.md file in the plugin folder.', 'lesson-management' ); ?>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <br class="clear">
    </div>
    <?php
}

/**
 * Handles the submission of the main dashboard permissions form.
 *
 * This function is hooked into the 'load-{$settings_hook}' action.
 */
function lm_handle_permissions_submission() {
    if ( isset( $_POST['lm_permissions_submit'] ) && check_admin_referer( 'lm_permissions_nonce_action', 'lm_permissions_nonce' ) ) {
        $submitted_roles = isset( $_POST['lm_allowed_roles'] ) && is_array( $_POST['lm_allowed_roles'] )
            ? array_map( 'sanitize_text_field', $_POST['lm_allowed_roles'] )
            : [];

        // Ensure administrator is always included.
        if ( ! in_array( 'administrator', $submitted_roles, true ) ) {
            $submitted_roles[] = 'administrator';
        }

        update_option( 'lm_allowed_roles', $submitted_roles );
        lm_update_dashboard_capabilities( $submitted_roles );

        // Redirect to avoid form resubmission.
        wp_redirect( admin_url( 'admin.php?page=lm-settings&settings-updated=true' ) );
        exit;
    }
}

/**
 * Updates user roles with the 'view_lesson_dashboard' capability.
 *
 * @param array $allowed_roles The list of role slugs that should have the capability.
 */
function lm_update_dashboard_capabilities( $allowed_roles ) {
    $capability = 'view_lesson_dashboard';
    foreach ( get_editable_roles() as $role_slug => $role_info ) {
        $role = get_role( $role_slug );
        if ( $role ) {
            if ( in_array( $role_slug, $allowed_roles, true ) ) {
                $role->add_cap( $capability );
            } else {
                $role->remove_cap( $capability );
            }
        }
    }
}

/**
 * Placeholder for handling CSV import submission.
 */
function lm_handle_import_submission() {
    // CSV import logic will be added here in the future.
}