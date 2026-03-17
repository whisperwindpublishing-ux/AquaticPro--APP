<?php
/**
 * Admin Settings Page for Email Customization
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

/**
 * Renders the HTML for the Email Settings page.
 * This function is now called directly by the submenu registration in admin-page.php.
 */
function lm_render_email_settings_page() {
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Evaluation Email Settings', 'lesson-management' ); ?></h1>
        <p><?php esc_html_e( 'Customize the email that gets sent to parents after a swimmer\'s evaluation. You can use the following placeholders in the subject and body:', 'lesson-management' ); ?></p>
        <ul>
            <li><code>[swimmer_name]</code> - The name of the swimmer.</li>
            <li><code>[parent_name]</code> - The name of the parent.</li>
            <li><code>[evaluation_link]</code> - The unique link to the swimmer's personal evaluation page (shows their progress tracking and all evaluations).</li>
        </ul>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'lm_email_options_group' );
            do_settings_sections( 'lm_email_options_group' );
            ?>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">
                        <label for="lm_evaluation_page_url"><?php esc_html_e( 'Swimmer Evaluation Page URL', 'lesson-management' ); ?></label>
                    </th>
                    <td>
                        <input type="url" id="lm_evaluation_page_url" name="lm_evaluation_page_url" value="<?php echo esc_attr( get_option( 'lm_evaluation_page_url' ) ); ?>" class="regular-text" placeholder="https://yoursite.com/swimmer-evaluations/" />
                        <p class="description"><?php esc_html_e( 'Create a page with the shortcode [swimmer_evaluation_view] and paste the URL here. This page displays the swimmer\'s progress tracking and evaluation history using their unique token.', 'lesson-management' ); ?></p>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row">
                        <label for="lm_evaluation_email_subject"><?php esc_html_e( 'Email Subject', 'lesson-management' ); ?></label>
                    </th>
                    <td>
                        <input type="text" id="lm_evaluation_email_subject" name="lm_evaluation_email_subject" value="<?php echo esc_attr( get_option( 'lm_evaluation_email_subject', 'Evaluation Results for [swimmer_name]' ) ); ?>" class="regular-text" />
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row">
                        <label for="lm_evaluation_email_body"><?php esc_html_e( 'Email Body', 'lesson-management' ); ?></label>
                    </th>
                    <td>
                        <textarea id="lm_evaluation_email_body" name="lm_evaluation_email_body" rows="10" class="large-text"><?php echo esc_textarea( get_option( 'lm_evaluation_email_body', "Hello [parent_name],\n\nWe've just completed a new evaluation for [swimmer_name].\n\nYou can view their progress tracking, skills mastered, and all evaluation history here:\n[evaluation_link]" ) ); ?></textarea>
                    </td>
                </tr>
                <tr valign="top">
                    <th scope="row">
                        <label for="lm_evaluation_reply_to_email"><?php esc_html_e( 'Reply-To Email Address', 'lesson-management' ); ?></label>
                    </th>
                    <td>
                        <input type="email" id="lm_evaluation_reply_to_email" name="lm_evaluation_reply_to_email" value="<?php echo esc_attr( get_option( 'lm_evaluation_reply_to_email' ) ); ?>" class="regular-text" placeholder="questions@yoursite.com" />
                        <p class="description"><?php esc_html_e( 'This email address will be shown on the swimmer evaluation page with a "For questions about evaluations, click here!" link. Leave blank to hide this link.', 'lesson-management' ); ?></p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <div class="postbox" style="margin-top: 20px;">
            <h2 class="hndle" style="padding: 8px 12px; margin: 0;"><span><?php esc_html_e( 'Bulk Email Page Permissions', 'lesson-management' ); ?></span></h2>
            <div class="inside">
                <p><?php esc_html_e( 'Select the user roles that should have access to the "Email Evaluations" page.', 'lesson-management' ); ?></p>
                <form method="post" action="">
                    <?php wp_nonce_field( 'lm_bulk_email_permissions_nonce_action', 'lm_bulk_email_permissions_nonce' ); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e( 'Allowed Roles', 'lesson-management' ); ?></th>
                            <td>
                                <?php
                                $allowed_roles = get_option( 'lm_bulk_email_allowed_roles', array( 'administrator' ) );
                                foreach ( get_editable_roles() as $role_slug => $role_info ) {
                                    // Administrator always has access and cannot be disabled.
                                    $is_admin      = ( 'administrator' === $role_slug );
                                    $is_checked    = $is_admin || in_array( $role_slug, $allowed_roles, true );
                                    printf(
                                        '<label><input type="checkbox" name="lm_bulk_email_allowed_roles[]" value="%s" %s %s/> %s</label><br>',
                                        esc_attr( $role_slug ),
                                        checked( $is_checked, true, false ),
                                        disabled( $is_admin, true, false ),
                                        esc_html( $role_info['name'] )
                                    );
                                }
                                ?>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( __( 'Save Bulk Email Permissions', 'lesson-management' ), 'primary', 'lm_bulk_email_permissions_submit' ); ?>
                </form>
            </div>
        </div>

    </div>
    <?php
}

add_action( 'admin_init', 'lm_register_and_handle_email_settings' );

/**
 * Registers the settings fields with WordPress and handles form submissions.
 */
function lm_register_and_handle_email_settings() {
    // Handle the bulk email permissions form submission.
    if ( isset( $_POST['lm_bulk_email_permissions_submit'] ) && check_admin_referer( 'lm_bulk_email_permissions_nonce_action', 'lm_bulk_email_permissions_nonce' ) ) {
        $submitted_roles = isset( $_POST['lm_bulk_email_allowed_roles'] ) && is_array( $_POST['lm_bulk_email_allowed_roles'] )
            ? array_map( 'sanitize_text_field', $_POST['lm_bulk_email_allowed_roles'] )
            : [];

        // Ensure administrator is always included.
        if ( ! in_array( 'administrator', $submitted_roles, true ) ) {
            $submitted_roles[] = 'administrator';
        }

        update_option( 'lm_bulk_email_allowed_roles', $submitted_roles );
        lm_update_bulk_email_capabilities( $submitted_roles );

        // Redirect to avoid form resubmission.
        wp_redirect( admin_url( 'admin.php?page=lm-email-settings&settings-updated=true' ) );
        exit;
    }

    // Register settings for the main email template form.
    register_setting( 'lm_email_options_group', 'lm_evaluation_email_subject' );
    register_setting( 'lm_email_options_group', 'lm_evaluation_email_body' );
    register_setting( 'lm_email_options_group', 'lm_evaluation_page_url' );
    register_setting( 'lm_email_options_group', 'lm_evaluation_reply_to_email', array( 'sanitize_callback' => 'sanitize_email' ) );
}

/**
 * Updates user roles with the 'view_bulk_email_page' capability.
 *
 * @param array $allowed_roles The list of role slugs that should have the capability.
 */
function lm_update_bulk_email_capabilities( $allowed_roles ) {
    $capability = 'view_bulk_email_page';
    foreach ( get_editable_roles() as $role_slug => $role_info ) {
        $role = get_role( $role_slug );
        if ( in_array( $role_slug, $allowed_roles, true ) ) {
            $role->add_cap( $capability );
        } else {
            $role->remove_cap( $capability );
        }
    }
}