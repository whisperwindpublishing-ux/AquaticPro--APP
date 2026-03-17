<?php
/**
 * Promotion Criteria Setup: Export / Import / Apply Default
 *
 * Handles exporting and restoring promotion criteria for all job roles
 * (stored in the {prefix}pg_promotion_criteria custom table).
 *
 * WORKFLOW FOR UPDATING BUILT-IN DEFAULTS
 * ----------------------------------------
 * 1. Configure promotion criteria on your site via the Professional Growth module.
 * 2. Click "Export Promotion Criteria" — download the JSON file.
 * 3. Share the JSON with your developer.
 * 4. Developer updates the array inside aquaticpro_get_default_promotion_criteria()
 *    below.
 * 5. Ship the updated plugin — any site can now click "Apply Default Promotion
 *    Criteria" to get that exact configuration.
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// ─────────────────────────────────────────────────────────────────────────────
// EARLY EXPORT HOOK  (must run before any output is sent)
// ─────────────────────────────────────────────────────────────────────────────

add_action( 'admin_init', 'aquaticpro_handle_early_promotion_export', 3 );
function aquaticpro_handle_early_promotion_export() {
    if (
        ! isset( $_POST['aquaticpro_promotion_action'] ) ||
        $_POST['aquaticpro_promotion_action'] !== 'export_promotion_criteria'
    ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    if (
        ! isset( $_POST['aquaticpro_promotion_nonce'] ) ||
        ! wp_verify_nonce( $_POST['aquaticpro_promotion_nonce'], 'aquaticpro_promotion_setup' )
    ) {
        return;
    }

    aquaticpro_export_promotion_criteria();
}


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN_INIT HANDLER  (import + apply default — redirect-after-POST)
// ─────────────────────────────────────────────────────────────────────────────

add_action( 'admin_init', 'aquaticpro_handle_promotion_setup_actions_early', 7 );
function aquaticpro_handle_promotion_setup_actions_early() {
    if ( ! isset( $_POST['aquaticpro_promotion_action'] ) ) {
        return;
    }

    $action = sanitize_text_field( $_POST['aquaticpro_promotion_action'] );

    // Export handled separately above
    if ( $action === 'export_promotion_criteria' ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    if (
        ! isset( $_POST['aquaticpro_promotion_nonce'] ) ||
        ! wp_verify_nonce( $_POST['aquaticpro_promotion_nonce'], 'aquaticpro_promotion_setup' )
    ) {
        wp_safe_redirect( add_query_arg( array(
            'post_type' => 'mp_request',
            'page'      => 'aquaticpro-settings',
            'ap_msg'    => 'nonce_fail',
            'ap_type'   => 'error',
        ), admin_url( 'edit.php' ) ) );
        exit;
    }

    $redirect_args = array(
        'post_type' => 'mp_request',
        'page'      => 'aquaticpro-settings',
    );

    switch ( $action ) {
        case 'apply_default_promotion_criteria':
            $result = aquaticpro_apply_default_promotion_criteria_silent();
            break;

        case 'import_promotion_criteria':
            $result = aquaticpro_import_promotion_criteria_silent();
            break;

        default:
            return;
    }

    $redirect_args['ap_msg']         = $result['msg_key'];
    $redirect_args['ap_type']        = $result['type'];
    $redirect_args['ap_promo_count'] = $result['count'] ?? 0;

    wp_safe_redirect( add_query_arg( $redirect_args, admin_url( 'edit.php' ) ) );
    exit;
}


// ─────────────────────────────────────────────────────────────────────────────
// RENDER SETTINGS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function aquaticpro_render_promotion_setup_section() {
    global $wpdb;

    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $existing_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $criteria_table" );

    $default_data = aquaticpro_get_default_promotion_criteria();
    $has_default  = ! empty( $default_data );

    ?>
    <hr style="margin: 30px 0;">

    <h2><?php _e( 'Promotion Criteria Setup', 'aquaticpro' ); ?></h2>
    <p class="description" style="margin-bottom: 15px;">
        <?php _e( 'Manage promotion criteria for all job roles. Export your current criteria to share with a developer who can set them as the built-in default, or import a previously exported file to restore a configuration.', 'aquaticpro' ); ?>
    </p>
    <p style="background:#fff3cd;padding:10px 14px;border-radius:4px;color:#856404;margin-bottom:15px;">
        <strong><?php _e( '⚠️ Import order matters:', 'aquaticpro' ); ?></strong>
        <?php _e( 'If you are importing both job roles and promotion criteria, always import Job Roles first, then import Promotion Criteria. Criteria are matched to roles by title — if the roles don\'t exist yet, all criteria will be skipped.', 'aquaticpro' ); ?>
    </p>

    <?php if ( $existing_count > 0 ) : ?>
        <p style="background:#fff3cd;padding:10px 14px;border-radius:4px;color:#856404;margin-bottom:15px;">
            <strong><?php _e( '⚠️ Existing data detected:', 'aquaticpro' ); ?></strong>
            <?php printf(
                _n( '%d promotion criterion exists.', '%d promotion criteria exist.', $existing_count, 'aquaticpro' ),
                $existing_count
            ); ?>
            <?php _e( 'Applying defaults or importing will replace this data.', 'aquaticpro' ); ?>
        </p>
    <?php endif; ?>

    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:20px;">

        <!-- Apply Default -->
        <div style="flex:1;min-width:280px;background:<?php echo $has_default ? '#f0f7ff' : '#f9f9f9'; ?>;border:1px solid <?php echo $has_default ? '#2196f3' : '#ccc'; ?>;border-radius:8px;padding:20px;">
            <h3 style="margin-top:0;color:<?php echo $has_default ? '#1565c0' : '#777'; ?>;">
                <span class="dashicons dashicons-admin-plugins" style="vertical-align:middle;"></span>
                <?php _e( 'Apply Built-In Default', 'aquaticpro' ); ?>
            </h3>
            <?php if ( $has_default ) : ?>
                <p style="color:#555;">
                    <?php printf(
                        _n( 'Restore the pre-configured promotion criteria: %d criterion.', 'Restore the pre-configured promotion criteria: %d criteria.', count( $default_data ), 'aquaticpro' ),
                        count( $default_data )
                    ); ?>
                </p>
                <form method="post" onsubmit="return confirm('<?php echo esc_js( __( 'This will DELETE all existing promotion criteria and replace them with the built-in defaults. This cannot be undone. Continue?', 'aquaticpro' ) ); ?>');">
                    <?php wp_nonce_field( 'aquaticpro_promotion_setup', 'aquaticpro_promotion_nonce' ); ?>
                    <input type="hidden" name="aquaticpro_promotion_action" value="apply_default_promotion_criteria">
                    <button type="submit" class="button button-primary">
                        <span class="dashicons dashicons-yes" style="vertical-align:middle;"></span>
                        <?php _e( 'Apply Default Criteria', 'aquaticpro' ); ?>
                    </button>
                </form>
            <?php else : ?>
                <p style="color:#777;font-style:italic;">
                    <?php _e( 'No built-in default is configured yet. Export your current criteria, share the JSON with your developer, and they will build it into the plugin.', 'aquaticpro' ); ?>
                </p>
                <button class="button" disabled><?php _e( 'No Default Available', 'aquaticpro' ); ?></button>
            <?php endif; ?>
        </div>

        <!-- Export -->
        <div style="flex:1;min-width:280px;background:#f5f5f5;border:1px solid #ccc;border-radius:8px;padding:20px;">
            <h3 style="margin-top:0;color:#333;">
                <span class="dashicons dashicons-download" style="vertical-align:middle;"></span>
                <?php _e( 'Export Promotion Criteria', 'aquaticpro' ); ?>
            </h3>
            <p style="color:#555;">
                <?php _e( 'Download all current promotion criteria as a JSON file. Share this with your developer to update the built-in default, or use it to restore this configuration later.', 'aquaticpro' ); ?>
            </p>
            <form method="post">
                <?php wp_nonce_field( 'aquaticpro_promotion_setup', 'aquaticpro_promotion_nonce' ); ?>
                <input type="hidden" name="aquaticpro_promotion_action" value="export_promotion_criteria">
                <button type="submit" class="button button-secondary">
                    <span class="dashicons dashicons-download" style="vertical-align:middle;"></span>
                    <?php _e( 'Export to JSON', 'aquaticpro' ); ?>
                </button>
            </form>
        </div>

        <!-- Import -->
        <div style="flex:1;min-width:280px;background:#f5f5f5;border:1px solid #ccc;border-radius:8px;padding:20px;">
            <h3 style="margin-top:0;color:#333;">
                <span class="dashicons dashicons-upload" style="vertical-align:middle;"></span>
                <?php _e( 'Import Promotion Criteria', 'aquaticpro' ); ?>
            </h3>
            <p style="color:#555;">
                <?php _e( 'Upload a previously exported JSON file to restore promotion criteria.', 'aquaticpro' ); ?>
            </p>
            <form method="post" enctype="multipart/form-data" onsubmit="return confirm('<?php echo esc_js( __( 'This will replace all existing promotion criteria. Continue?', 'aquaticpro' ) ); ?>');">
                <?php wp_nonce_field( 'aquaticpro_promotion_setup', 'aquaticpro_promotion_nonce' ); ?>
                <input type="hidden" name="aquaticpro_promotion_action" value="import_promotion_criteria">
                <input type="file" name="aquaticpro_promotion_import_file" accept=".json" required style="display:block;margin-bottom:10px;">
                <button type="submit" class="button button-secondary">
                    <span class="dashicons dashicons-upload" style="vertical-align:middle;"></span>
                    <?php _e( 'Import from JSON', 'aquaticpro' ); ?>
                </button>
            </form>
        </div>

    </div>
    <?php
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function aquaticpro_export_promotion_criteria() {
    global $wpdb;

    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $roles_table    = $wpdb->prefix . 'pg_job_roles';

    // Join criteria with role title so the export is portable across sites
    $rows = $wpdb->get_results(
        "SELECT c.title, c.description, c.criterion_type, c.target_value,
                c.linked_module, c.sort_order, c.is_required,
                r.title AS role_title
         FROM {$criteria_table} c
         LEFT JOIN {$roles_table} r ON r.id = c.job_role_id
         ORDER BY r.title ASC, c.sort_order ASC, c.id ASC",
        ARRAY_A
    );

    $criteria = array();
    if ( $rows ) {
        foreach ( $rows as $row ) {
            $criteria[] = array(
                'role_title'     => $row['role_title'] ?? '',
                'title'          => $row['title'],
                'description'    => $row['description'] ?? '',
                'criterion_type' => $row['criterion_type'],
                'target_value'   => (int) $row['target_value'],
                'linked_module'  => $row['linked_module'] ?? '',
                'sort_order'     => (int) $row['sort_order'],
                'is_required'    => (bool) $row['is_required'],
            );
        }
    }

    $export = array(
        'version'            => '1.0',
        'exported_at'        => current_time( 'mysql' ),
        'site_url'           => get_site_url(),
        'promotion_criteria' => $criteria,
    );

    $filename = 'aquaticpro-promotion-criteria-' . date( 'Y-m-d-His' ) . '.json';
    header( 'Content-Type: application/json' );
    header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
    header( 'Cache-Control: no-cache, no-store, must-revalidate' );

    echo json_encode( $export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
    exit;
}


// ─────────────────────────────────────────────────────────────────────────────
// SHARED APPLY LOGIC  (used by both "apply default" and "import")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a flat array of criteria (each with a 'role_title' key), delete all
 * existing criteria and re-insert from the provided data, remapping role titles
 * to current job_role_id values.
 *
 * Data format:
 *   [
 *     ['role_title'=>'Lifeguard', 'title'=>'...', 'criterion_type'=>'...', ...],
 *     ...
 *   ]
 *
 * Returns: ['type'=>'success'|'error', 'msg_key'=>'...', 'count'=>N]
 */
function aquaticpro_apply_promotion_criteria_data( array $criteria ) {
    global $wpdb;

    $criteria_table = $wpdb->prefix . 'pg_promotion_criteria';
    $roles_table    = $wpdb->prefix . 'pg_job_roles';

    // ── 1. Build role-title → role-id map ─────────────────────────────────────
    $roles = $wpdb->get_results( "SELECT id, title FROM {$roles_table}", ARRAY_A );
    $role_title_to_id = array();
    foreach ( $roles as $role ) {
        $role_title_to_id[ $role['title'] ] = (int) $role['id'];
    }

    // ── 2. Wipe existing criteria ─────────────────────────────────────────────
    $wpdb->query( "DELETE FROM {$criteria_table}" );
    // Reset auto-increment so IDs stay predictable
    $wpdb->query( "ALTER TABLE {$criteria_table} AUTO_INCREMENT = 1" );

    // ── 3. Insert new criteria ────────────────────────────────────────────────
    $inserted = 0;

    foreach ( $criteria as $criterion ) {
        $role_title = $criterion['role_title'] ?? '';

        if ( $role_title === '' ) {
            continue; // Skip criteria with no role association
        }

        if ( ! isset( $role_title_to_id[ $role_title ] ) ) {
            // Role doesn't exist on this site — skip silently
            continue;
        }

        $job_role_id = $role_title_to_id[ $role_title ];

        $result = $wpdb->insert(
            $criteria_table,
            array(
                'job_role_id'    => $job_role_id,
                'title'          => sanitize_text_field( $criterion['title'] ?? '' ),
                'description'    => sanitize_textarea_field( $criterion['description'] ?? '' ),
                'criterion_type' => sanitize_text_field( $criterion['criterion_type'] ?? '' ),
                'target_value'   => max( 1, intval( $criterion['target_value'] ?? 1 ) ),
                'linked_module'  => sanitize_text_field( $criterion['linked_module'] ?? '' ),
                'sort_order'     => intval( $criterion['sort_order'] ?? 0 ),
                'is_required'    => empty( $criterion['is_required'] ) ? 0 : 1,
            ),
            array( '%d', '%s', '%s', '%s', '%d', '%s', '%d', '%d' )
        );

        if ( $result !== false ) {
            $inserted++;
        }
    }

    // If every criterion was skipped because its role_title didn't match any
    // existing job role, return a warning instead of a silent success.
    if ( $inserted === 0 && count( $criteria ) > 0 ) {
        return array(
            'type'    => 'warning',
            'msg_key' => 'promo_import_no_roles_matched',
            'count'   => 0,
        );
    }

    return array(
        'type'    => 'success',
        'msg_key' => 'promo_setup_applied',
        'count'   => $inserted,
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// APPLY DEFAULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the hardcoded default promotion criteria.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HOW TO UPDATE THIS DEFAULT                                  ║
 * ║  1. Configure promotion criteria on the live site.           ║
 * ║  2. Click "Export Promotion Criteria" on the settings page.  ║
 * ║  3. Share the downloaded JSON with your developer.           ║
 * ║  4. Developer replaces the array below with the JSON data.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Each item must have:
 *   role_title     — must exactly match a job role title
 *   title          — criterion display name
 *   description    — optional detail
 *   criterion_type — e.g. "module", "manual", etc.
 *   target_value   — integer (e.g. how many completions required)
 *   linked_module  — module slug, or empty string
 *   sort_order     — integer
 *   is_required    — boolean
 */
function aquaticpro_get_default_promotion_criteria() {
    return array(
        // ── Example (comment out or remove when real data is added) ───────────
        // array(
        //     'role_title'     => 'Lifeguard',
        //     'title'          => 'Complete In-Service training',
        //     'description'    => 'Attend at least one in-service session as an attendee.',
        //     'criterion_type' => 'module',
        //     'target_value'   => 1,
        //     'linked_module'  => 'inservice_attendee',
        //     'sort_order'     => 0,
        //     'is_required'    => true,
        // ),
    );
}

function aquaticpro_apply_default_promotion_criteria_silent() {
    $data = aquaticpro_get_default_promotion_criteria();

    if ( empty( $data ) ) {
        return array( 'type' => 'error', 'msg_key' => 'promo_default_empty', 'count' => 0 );
    }

    return aquaticpro_apply_promotion_criteria_data( $data );
}


// ─────────────────────────────────────────────────────────────────────────────
// IMPORT FROM UPLOADED FILE
// ─────────────────────────────────────────────────────────────────────────────

function aquaticpro_import_promotion_criteria_silent() {

    if (
        ! isset( $_FILES['aquaticpro_promotion_import_file'] ) ||
        $_FILES['aquaticpro_promotion_import_file']['error'] !== UPLOAD_ERR_OK
    ) {
        return array( 'type' => 'error', 'msg_key' => 'promo_import_upload', 'count' => 0 );
    }

    $file_content = file_get_contents( $_FILES['aquaticpro_promotion_import_file']['tmp_name'] );
    $import_data  = json_decode( $file_content, true );

    if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $import_data ) ) {
        return array( 'type' => 'error', 'msg_key' => 'promo_import_invalid', 'count' => 0 );
    }

    $criteria = $import_data['promotion_criteria'] ?? array();

    if ( empty( $criteria ) ) {
        return array( 'type' => 'error', 'msg_key' => 'promo_import_empty', 'count' => 0 );
    }

    return aquaticpro_apply_promotion_criteria_data( $criteria );
}
