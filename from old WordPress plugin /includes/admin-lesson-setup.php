<?php
/**
 * Lesson Setup: Export / Import / Apply Default
 *
 * Handles exporting and restoring lesson levels, skills, and lesson types
 * (lm-level CPTs, lm-skill CPTs, lm_lesson_type taxonomy terms).
 *
 * WORKFLOW FOR UPDATING BUILT-IN DEFAULTS
 * ----------------------------------------
 * 1. Configure levels, skills, and lesson types on your site.
 * 2. Click "Export Lesson Setup" — download the JSON file.
 * 3. Share the JSON with your developer.
 * 4. Developer updates the $default_data array inside
 *    aquaticpro_apply_default_lesson_setup_silent() below.
 * 5. Ship the updated plugin — any site can now click "Apply Default Lesson
 *    Setup" to get that exact configuration.
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

// ─────────────────────────────────────────────────────────────────────────────
// EARLY EXPORT HOOK  (must run before any output is sent)
// ─────────────────────────────────────────────────────────────────────────────

add_action( 'admin_init', 'aquaticpro_handle_early_lesson_export', 2 );
function aquaticpro_handle_early_lesson_export() {
    if (
        ! isset( $_POST['aquaticpro_lesson_action'] ) ||
        $_POST['aquaticpro_lesson_action'] !== 'export_lesson_setup'
    ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    if (
        ! isset( $_POST['aquaticpro_lesson_nonce'] ) ||
        ! wp_verify_nonce( $_POST['aquaticpro_lesson_nonce'], 'aquaticpro_lesson_setup' )
    ) {
        return;
    }

    aquaticpro_export_lesson_setup();
}


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN_INIT HANDLER  (import + apply default — redirect-after-POST)
// ─────────────────────────────────────────────────────────────────────────────

add_action( 'admin_init', 'aquaticpro_handle_lesson_setup_actions_early', 6 );
function aquaticpro_handle_lesson_setup_actions_early() {
    if ( ! isset( $_POST['aquaticpro_lesson_action'] ) ) {
        return;
    }

    $action = sanitize_text_field( $_POST['aquaticpro_lesson_action'] );

    // Export handled separately above
    if ( $action === 'export_lesson_setup' ) {
        return;
    }

    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    if (
        ! isset( $_POST['aquaticpro_lesson_nonce'] ) ||
        ! wp_verify_nonce( $_POST['aquaticpro_lesson_nonce'], 'aquaticpro_lesson_setup' )
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
        case 'apply_default_lesson_setup':
            $result = aquaticpro_apply_default_lesson_setup_silent();
            break;

        case 'import_lesson_setup':
            $result = aquaticpro_import_lesson_setup_silent();
            break;

        default:
            return;
    }

    $redirect_args['ap_msg']  = $result['msg_key'];
    $redirect_args['ap_type'] = $result['type'];
    if ( ! empty( $result['counts'] ) ) {
        $redirect_args['ap_ls_levels']  = $result['counts']['levels']  ?? 0;
        $redirect_args['ap_ls_skills']  = $result['counts']['skills']  ?? 0;
        $redirect_args['ap_ls_types']   = $result['counts']['types']   ?? 0;
    }

    wp_safe_redirect( add_query_arg( $redirect_args, admin_url( 'edit.php' ) ) );
    exit;
}


// ─────────────────────────────────────────────────────────────────────────────
// RENDER SETTINGS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function aquaticpro_render_lesson_setup_section() {
    // Check whether any levels/skills/types already exist
    $levels_count = wp_count_posts( 'lm-level' );
    $skills_count = wp_count_posts( 'lm-skill' );
    $types_count  = wp_count_terms( 'lm_lesson_type' );

    $existing_levels = isset( $levels_count->publish ) ? (int) $levels_count->publish : 0;
    $existing_skills = isset( $skills_count->publish ) ? (int) $skills_count->publish : 0;
    $existing_types  = is_wp_error( $types_count ) ? 0 : (int) $types_count;

    $has_existing = ( $existing_levels + $existing_skills + $existing_types ) > 0;

    // Check if a built-in default is available
    $default_data   = aquaticpro_get_default_lesson_data();
    $has_default    = ! empty( $default_data['levels'] ) || ! empty( $default_data['skills'] ) || ! empty( $default_data['lesson_types'] );

    ?>
    <hr style="margin: 30px 0;">

    <h2><?php _e( 'Lesson Setup (Levels, Skills &amp; Types)', 'aquaticpro' ); ?></h2>
    <p class="description" style="margin-bottom: 15px;">
        <?php _e( 'Manage your lesson levels, skills, and lesson types. Export your current configuration to share with a developer who can set it as the built-in default, or import a previously exported file to restore a configuration.', 'aquaticpro' ); ?>
    </p>

    <?php if ( $has_existing ) : ?>
        <p style="background:#fff3cd;padding:10px 14px;border-radius:4px;color:#856404;margin-bottom:15px;">
            <strong><?php _e( '⚠️ Existing data detected:', 'aquaticpro' ); ?></strong>
            <?php printf(
                __( '%d level(s), %d skill(s), %d lesson type(s). Applying defaults or importing will replace this data.', 'aquaticpro' ),
                $existing_levels, $existing_skills, $existing_types
            ); ?>
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
                        __( 'Restore the pre-configured lesson setup: %d level(s), %d skill(s), %d lesson type(s).', 'aquaticpro' ),
                        count( $default_data['levels'] ),
                        count( $default_data['skills'] ),
                        count( $default_data['lesson_types'] )
                    ); ?>
                </p>
                <form method="post" onsubmit="return confirm('<?php echo esc_js( __( 'This will DELETE existing levels, skills, and lesson types and replace them with the built-in defaults. This cannot be undone. Continue?', 'aquaticpro' ) ); ?>');">
                    <?php wp_nonce_field( 'aquaticpro_lesson_setup', 'aquaticpro_lesson_nonce' ); ?>
                    <input type="hidden" name="aquaticpro_lesson_action" value="apply_default_lesson_setup">
                    <button type="submit" class="button button-primary">
                        <span class="dashicons dashicons-yes" style="vertical-align:middle;"></span>
                        <?php _e( 'Apply Default Lesson Setup', 'aquaticpro' ); ?>
                    </button>
                </form>
            <?php else : ?>
                <p style="color:#777;font-style:italic;">
                    <?php _e( 'No built-in default is configured yet. Export your current setup, share the JSON with your developer, and they will build it into the plugin.', 'aquaticpro' ); ?>
                </p>
                <button class="button" disabled><?php _e( 'No Default Available', 'aquaticpro' ); ?></button>
            <?php endif; ?>
        </div>

        <!-- Export -->
        <div style="flex:1;min-width:280px;background:#f5f5f5;border:1px solid #ccc;border-radius:8px;padding:20px;">
            <h3 style="margin-top:0;color:#333;">
                <span class="dashicons dashicons-download" style="vertical-align:middle;"></span>
                <?php _e( 'Export Lesson Setup', 'aquaticpro' ); ?>
            </h3>
            <p style="color:#555;">
                <?php _e( 'Download your current levels, skills, and lesson types as a JSON file. Share this with your developer to update the built-in default, or use it to restore this configuration later.', 'aquaticpro' ); ?>
            </p>
            <form method="post">
                <?php wp_nonce_field( 'aquaticpro_lesson_setup', 'aquaticpro_lesson_nonce' ); ?>
                <input type="hidden" name="aquaticpro_lesson_action" value="export_lesson_setup">
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
                <?php _e( 'Import Lesson Setup', 'aquaticpro' ); ?>
            </h3>
            <p style="color:#555;">
                <?php _e( 'Upload a previously exported JSON file to restore levels, skills, and lesson types.', 'aquaticpro' ); ?>
            </p>
            <form method="post" enctype="multipart/form-data" onsubmit="return confirm('<?php echo esc_js( __( 'This will replace existing levels, skills, and lesson types. Continue?', 'aquaticpro' ) ); ?>');">
                <?php wp_nonce_field( 'aquaticpro_lesson_setup', 'aquaticpro_lesson_nonce' ); ?>
                <input type="hidden" name="aquaticpro_lesson_action" value="import_lesson_setup">
                <input type="file" name="aquaticpro_lesson_import_file" accept=".json" required style="display:block;margin-bottom:10px;">
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

function aquaticpro_export_lesson_setup() {

    // --- Levels ---
    $level_posts = get_posts( array(
        'post_type'      => 'lm-level',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'sort_order',
        'order'          => 'ASC',
    ) );

    $levels = array();
    foreach ( $level_posts as $post ) {
        $levels[] = array(
            '_original_id' => $post->ID,
            'title'        => $post->post_title,
            'sort_order'   => (int) get_post_meta( $post->ID, 'sort_order', true ),
        );
    }

    // Build a map: level post ID → level title (for skill export)
    $level_id_to_title = array();
    foreach ( $level_posts as $post ) {
        $level_id_to_title[ $post->ID ] = $post->post_title;
    }

    // --- Skills ---
    $skill_posts = get_posts( array(
        'post_type'      => 'lm-skill',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'sort_order',
        'order'          => 'ASC',
    ) );

    $skills = array();
    foreach ( $skill_posts as $post ) {
        $level_id    = (int) get_post_meta( $post->ID, 'level_associated', true );
        $level_title = isset( $level_id_to_title[ $level_id ] ) ? $level_id_to_title[ $level_id ] : '';

        $skills[] = array(
            '_original_id' => $post->ID,
            'title'        => $post->post_title,
            'sort_order'   => (int) get_post_meta( $post->ID, 'sort_order', true ),
            'level_title'  => $level_title,   // human-readable; used when re-importing
        );
    }

    // --- Lesson Types ---
    $terms = get_terms( array(
        'taxonomy'   => 'lm_lesson_type',
        'hide_empty' => false,
    ) );

    $lesson_types = array();
    if ( ! is_wp_error( $terms ) ) {
        foreach ( $terms as $term ) {
            $lesson_types[] = array(
                'name'        => $term->name,
                'slug'        => $term->slug,
                'description' => $term->description,
            );
        }
    }

    // --- Build export payload ---
    $export = array(
        'version'      => '1.0',
        'exported_at'  => current_time( 'mysql' ),
        'site_url'     => get_site_url(),
        'levels'       => $levels,
        'skills'       => $skills,
        'lesson_types' => $lesson_types,
    );

    $filename = 'aquaticpro-lesson-setup-' . date( 'Y-m-d-His' ) . '.json';
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
 * Given a structured data array, delete existing lm-level / lm-skill posts
 * and lm_lesson_type terms, then recreate everything from the data.
 *
 * Data format:
 *   levels       => [ ['title' => '...', 'sort_order' => N], ... ]
 *   skills       => [ ['title' => '...', 'sort_order' => N, 'level_title' => '...'], ... ]
 *   lesson_types => [ ['name' => '...', 'slug' => '...', 'description' => '...'], ... ]
 *
 * Returns: ['type'=>'success'|'error', 'msg_key'=>'...', 'counts'=>['levels'=>N,...]]
 */
function aquaticpro_apply_lesson_data( array $data ) {

    // ── 1. Wipe existing content ──────────────────────────────────────────────

    foreach ( array( 'lm-level', 'lm-skill' ) as $cpt ) {
        $posts = get_posts( array(
            'post_type'      => $cpt,
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ) );
        foreach ( $posts as $id ) {
            wp_delete_post( $id, true ); // true = force delete (bypass trash)
        }
    }

    $existing_terms = get_terms( array( 'taxonomy' => 'lm_lesson_type', 'hide_empty' => false ) );
    if ( ! is_wp_error( $existing_terms ) ) {
        foreach ( $existing_terms as $term ) {
            wp_delete_term( $term->term_id, 'lm_lesson_type' );
        }
    }

    // ── 2. Create Levels  ─────────────────────────────────────────────────────

    $level_title_to_id = array(); // title → new post ID
    $levels_created    = 0;

    foreach ( $data['levels'] as $level ) {
        $post_id = wp_insert_post( array(
            'post_type'   => 'lm-level',
            'post_title'  => sanitize_text_field( $level['title'] ),
            'post_status' => 'publish',
        ) );

        if ( is_wp_error( $post_id ) ) {
            continue;
        }

        update_post_meta( $post_id, 'sort_order', absint( $level['sort_order'] ?? 0 ) );

        $level_title_to_id[ $level['title'] ] = $post_id;
        $levels_created++;
    }

    // ── 3. Create Skills  ─────────────────────────────────────────────────────

    // Group skill IDs by the level they belong to, so we can update
    // the level's `related_skills` meta after all skills are created.
    $level_skills_map = array(); // level post ID → [ skill post ID, ... ]
    $skills_created   = 0;

    foreach ( $data['skills'] as $idx => $skill ) {
        $post_id = wp_insert_post( array(
            'post_type'   => 'lm-skill',
            'post_title'  => sanitize_text_field( $skill['title'] ),
            'post_status' => 'publish',
        ) );

        if ( is_wp_error( $post_id ) ) {
            continue;
        }

        update_post_meta( $post_id, 'sort_order', absint( $skill['sort_order'] ?? $idx ) );

        // Link skill → level
        $level_title = $skill['level_title'] ?? '';
        if ( $level_title !== '' && isset( $level_title_to_id[ $level_title ] ) ) {
            $level_post_id = $level_title_to_id[ $level_title ];
            update_post_meta( $post_id, 'level_associated', $level_post_id );
            $level_skills_map[ $level_post_id ][] = $post_id;
        }

        $skills_created++;
    }

    // ── 4. Update Levels' related_skills meta ────────────────────────────────

    foreach ( $level_skills_map as $level_post_id => $skill_ids ) {
        update_post_meta( $level_post_id, 'related_skills', array_map( 'intval', $skill_ids ) );
    }

    // ── 5. Create Lesson Types ────────────────────────────────────────────────

    $types_created = 0;

    foreach ( $data['lesson_types'] as $type ) {
        $result = wp_insert_term(
            sanitize_text_field( $type['name'] ),
            'lm_lesson_type',
            array(
                'slug'        => sanitize_title( $type['slug'] ?? $type['name'] ),
                'description' => sanitize_text_field( $type['description'] ?? '' ),
            )
        );
        if ( ! is_wp_error( $result ) ) {
            $types_created++;
        }
    }

    return array(
        'type'    => 'success',
        'msg_key' => 'lesson_setup_applied',
        'counts'  => array(
            'levels' => $levels_created,
            'skills' => $skills_created,
            'types'  => $types_created,
        ),
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// APPLY DEFAULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the hardcoded default lesson setup data.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HOW TO UPDATE THIS DEFAULT                                  ║
 * ║  1. Configure your levels/skills/types on the live site.     ║
 * ║  2. Click "Export Lesson Setup" on the settings page.        ║
 * ║  3. Share the downloaded JSON with your developer.           ║
 * ║  4. Developer replaces the arrays below with the JSON data.  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
function aquaticpro_get_default_lesson_data() {
    return array(

        // ── LEVELS ────────────────────────────────────────────────────────────
        'levels' => array(
            array( 'title' => 'Adult & Infant',       'sort_order' => 1 ),
            array( 'title' => 'Guppies',              'sort_order' => 2 ),
            array( 'title' => 'Level 1',              'sort_order' => 3 ),
            array( 'title' => 'Level 2',              'sort_order' => 4 ),
            array( 'title' => 'Level 3',              'sort_order' => 5 ),
            array( 'title' => 'Level 4',              'sort_order' => 6 ),
            // Note: "Needs to be tested" is intentionally removed.
            // Swimmers without a level are represented by current_level = null (empty).
            // Use the swimmer form's blank "Select a level..." option instead.
        ),

        // ── SKILLS ────────────────────────────────────────────────────────────
        // level_title must exactly match a title in the levels array above.
        'skills' => array(
            // Adult & Infant
            array( 'title' => 'PT: Water Comfort',                                             'sort_order' => 1,  'level_title' => 'Adult & Infant' ),
            array( 'title' => 'PT: Supported Front Glides (with parent)',                      'sort_order' => 2,  'level_title' => 'Adult & Infant' ),
            array( 'title' => 'PT: Supported Back Glides (with parent)',                       'sort_order' => 3,  'level_title' => 'Adult & Infant' ),
            array( 'title' => 'PT: Scooping',                                                  'sort_order' => 4,  'level_title' => 'Adult & Infant' ),
            array( 'title' => 'PT: Games, Songs, Splashing',                                   'sort_order' => 5,  'level_title' => 'Adult & Infant' ),
            // Guppies
            array( 'title' => 'G: Alligator Walk',                                             'sort_order' => 1,  'level_title' => 'Guppies' ),
            array( 'title' => 'G: Lay flat on your back in zero-depth water with ears underwater.', 'sort_order' => 2, 'level_title' => 'Guppies' ),
            array( 'title' => 'G: Follow instructions and play a three step game like "Treasure Hunt."', 'sort_order' => 3, 'level_title' => 'Guppies' ),
            array( 'title' => 'G: Be a part of a group activity like Bake a Cake',             'sort_order' => 4,  'level_title' => 'Guppies' ),
            array( 'title' => 'G: Independent water exploration in chest deep water with supervision', 'sort_order' => 5, 'level_title' => 'Guppies' ),
            // Level 1
            array( 'title' => 'L1: Going Underwater Unassisted',                               'sort_order' => 1,  'level_title' => 'Level 1' ),
            array( 'title' => 'L1: Supported Front Glide',                                     'sort_order' => 2,  'level_title' => 'Level 1' ),
            array( 'title' => 'L1: Supported Back Glide',                                      'sort_order' => 3,  'level_title' => 'Level 1' ),
            array( 'title' => 'L1: Go underwater & recover to standing',                       'sort_order' => 4,  'level_title' => 'Level 1' ),
            // Level 2
            array( 'title' => 'L2: Streamline 3 body lengths on front',                        'sort_order' => 1,  'level_title' => 'Level 2' ),
            array( 'title' => 'L2: Streamline and then front crawl arms for 5 body lengths (total)', 'sort_order' => 2, 'level_title' => 'Level 2' ),
            array( 'title' => 'L2: Streamline and then back crawl arms for 5 body lengths',    'sort_order' => 3,  'level_title' => 'Level 2' ),
            array( 'title' => 'L2: Introduced to fly kick',                                    'sort_order' => 4,  'level_title' => 'Level 2' ),
            array( 'title' => 'L2: Streamline 3 body lengths back (can be in soldier)',         'sort_order' => 5,  'level_title' => 'Level 2' ),
            // Level 3
            array( 'title' => 'L3 Front crawl 8 meters with breathing',                        'sort_order' => 1,  'level_title' => 'Level 3' ),
            array( 'title' => 'L3: Back crawl 8 meters with body at surface',                  'sort_order' => 2,  'level_title' => 'Level 3' ),
            array( 'title' => 'L3: Demonstrate "11, Eat, 11"',                                 'sort_order' => 3,  'level_title' => 'Level 3' ),
            array( 'title' => 'L3: Demonstrate Breaststroke Kick on edge',                     'sort_order' => 4,  'level_title' => 'Level 3' ),
            array( 'title' => 'L3: Demonstrate Butterfly Arms',                                'sort_order' => 5,  'level_title' => 'Level 3' ),
            // Level 4
            array( 'title' => 'L4: Front crawl 20 meters with bilateral breaths',              'sort_order' => 1,  'level_title' => 'Level 4' ),
            array( 'title' => 'L4: Back crawl 20 meters with body in soldier',                 'sort_order' => 2,  'level_title' => 'Level 4' ),
            array( 'title' => 'L4: 3 times, streamline with no kick, then do 1x (11, Eat, and 11), then 1x (BR kick in position 11).', 'sort_order' => 3, 'level_title' => 'Level 4' ),
            array( 'title' => 'L4: Streamline + 2 strokes Fly w/ breath on #2',               'sort_order' => 4,  'level_title' => 'Level 4' ),
            array( 'title' => 'L4: Swim 50 meters Front or Back Crawl',                        'sort_order' => 5,  'level_title' => 'Level 4' ),
        ),

        // ── LESSON TYPES ──────────────────────────────────────────────────────
        'lesson_types' => array(
            array( 'name' => 'Public',  'slug' => 'public',  'description' => '' ),
            array( 'name' => 'Private', 'slug' => 'private', 'description' => '' ),
            array( 'name' => 'Camp',    'slug' => 'camp',    'description' => '' ),
        ),

    );
}

function aquaticpro_apply_default_lesson_setup_silent() {
    $data = aquaticpro_get_default_lesson_data();

    if ( empty( $data['levels'] ) && empty( $data['skills'] ) && empty( $data['lesson_types'] ) ) {
        return array( 'type' => 'error', 'msg_key' => 'lesson_default_empty' );
    }

    return aquaticpro_apply_lesson_data( $data );
}


// ─────────────────────────────────────────────────────────────────────────────
// IMPORT FROM UPLOADED FILE
// ─────────────────────────────────────────────────────────────────────────────

function aquaticpro_import_lesson_setup_silent() {

    if (
        ! isset( $_FILES['aquaticpro_lesson_import_file'] ) ||
        $_FILES['aquaticpro_lesson_import_file']['error'] !== UPLOAD_ERR_OK
    ) {
        return array( 'type' => 'error', 'msg_key' => 'lesson_import_upload' );
    }

    $file_content = file_get_contents( $_FILES['aquaticpro_lesson_import_file']['tmp_name'] );
    $import_data  = json_decode( $file_content, true );

    if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $import_data ) ) {
        return array( 'type' => 'error', 'msg_key' => 'lesson_import_invalid' );
    }

    $data = array(
        'levels'       => $import_data['levels']       ?? array(),
        'skills'       => $import_data['skills']       ?? array(),
        'lesson_types' => $import_data['lesson_types'] ?? array(),
    );

    if ( empty( $data['levels'] ) && empty( $data['skills'] ) && empty( $data['lesson_types'] ) ) {
        return array( 'type' => 'error', 'msg_key' => 'lesson_import_empty' );
    }

    return aquaticpro_apply_lesson_data( $data );
}
