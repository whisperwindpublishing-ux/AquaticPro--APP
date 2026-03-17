<?php
/**
 * Shortcodes for the Lesson Management plugin.
 *
 * @package LessonManagement
 */

defined('ABSPATH') || die;

/**
 * Shortcode to render the main Lesson Management React app on the frontend.
 * Uses the same permission system as the admin dashboard.
 * Usage: [lesson_management_app]
 */
add_shortcode('lesson_management_app', 'lm_render_frontend_app_shortcode');

function lm_render_frontend_app_shortcode() {
    // Check if user has permission to view the lesson dashboard
    if (!current_user_can('view_lesson_dashboard')) {
        return '<div class="lm-access-denied" style="padding: 2rem; background-color: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00; font-family: sans-serif;">' .
               '<h2 style="margin-top: 0;">Access Denied</h2>' .
               '<p>You do not have permission to access the Lesson Management system. Please contact an administrator if you believe this is an error.</p>' .
               '</div>';
    }

    // Enqueue the same assets as admin page
    lm_enqueue_frontend_app_assets();

    // Return the React app container
    return '<div id="lm-admin-app" class="lm-frontend-app wrap"></div>';
}

/**
 * Shortcode to render the Email Evaluations page on the frontend.
 * Uses the same permission system as the admin Email Evaluations page.
 * Usage: [lesson_email_evaluations]
 */
add_shortcode('lesson_email_evaluations', 'lm_render_frontend_email_evaluations_shortcode');

function lm_render_frontend_email_evaluations_shortcode() {
    // Check if user has permission to view bulk email page
    if (!current_user_can('view_bulk_email_page')) {
        return '<div class="lm-access-denied" style="padding: 2rem; background-color: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00; font-family: sans-serif;">' .
               '<h2 style="margin-top: 0;">Access Denied</h2>' .
               '<p>You do not have permission to access the Email Evaluations page. Please contact an administrator if you believe this is an error.</p>' .
               '</div>';
    }

    // Get unsent evaluations for frontend display
    $unsent_evaluations = get_posts([
        'post_type' => 'lm-evaluation',
        'posts_per_page' => -1,
        'meta_query' => [
            'relation' => 'OR',
            [
                'key' => 'emailed',
                'value' => '1',
                'compare' => '!='
            ],
            [
                'key' => 'emailed',
                'compare' => 'NOT EXISTS'
            ]
        ]
    ]);

    // Ensure jQuery is loaded
    wp_enqueue_script('jquery');

    // Build the HTML output directly
    ob_start();
    ?>
    <div class="wrap lm-frontend-email-page">
        <h1><?php esc_html_e( 'Bulk Email Unsent Evaluations', 'lesson-management' ); ?></h1>
        <p><?php esc_html_e( 'This page lists all evaluations that have not been marked as "Emailed to Parent". Click the button to send them all. You can use the "Dismiss" button to temporarily remove an evaluation from this batch.', 'lesson-management' ); ?></p>

        <div id="lm-bulk-email-controls" style="margin: 20px 0;">
            <button id="lm-send-bulk-email-btn" class="button button-primary" style="padding: 10px 20px; background: #2271b1; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
                <?php esc_html_e( 'Email All Unsent Evaluations', 'lesson-management' ); ?>
            </button>
            <span class="spinner" style="visibility: hidden; display: inline-block; margin: 0 0 0 8px; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #2271b1; border-radius: 50%; animation: spin 1s linear infinite;"></span>
            <button id="lm-refresh-btn" class="button button-secondary" style="display: none; margin-left: 10px; padding: 8px 16px; background: #f0f0f1; border: 1px solid #ddd; border-radius: 3px; cursor: pointer;"><?php esc_html_e( 'Refresh Page', 'lesson-management' ); ?></button>
        </div>

        <div id="lm-bulk-email-log" style="background-color: #f6f7f7; border: 1px solid #ccc; padding: 10px; margin-top: 20px; max-height: 400px; overflow-y: auto; display: none;">
            <h3><?php esc_html_e( 'Sending Log:', 'lesson-management' ); ?></h3>
            <ul id="lm-log-list" style="list-style-type: disc; padding-left: 20px;"></ul>
        </div>

        <h2 style="margin-top: 20px;"><?php esc_html_e( 'Unsent Evaluations', 'lesson-management' ); ?> (<span id="unsent-count"><?php echo count($unsent_evaluations); ?></span>)</h2>
        <table id="unsent-evaluations-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; background: white; border: 1px solid #ddd;">
            <thead>
                <tr style="background-color: #f9f9f9; border-bottom: 2px solid #ddd;">
                    <th style="width: 40%; padding: 10px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd;"><?php esc_html_e( 'Evaluation Title', 'lesson-management' ); ?></th>
                    <th style="padding: 10px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd;"><?php esc_html_e( 'Swimmer', 'lesson-management' ); ?></th>
                    <th style="padding: 10px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd;"><?php esc_html_e( 'Date', 'lesson-management' ); ?></th>
                    <th style="width: 15%; padding: 10px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd;"><?php esc_html_e( 'Actions', 'lesson-management' ); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php if ( empty( $unsent_evaluations ) ) : ?>
                    <tr>
                        <td colspan="4" style="padding: 15px; text-align: center; color: #666;"><?php esc_html_e( 'No unsent evaluations found.', 'lesson-management' ); ?></td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $unsent_evaluations as $evaluation ) : ?>
                        <?php
                        $swimmer_id = get_post_meta( $evaluation->ID, 'swimmer', true );
                        $swimmer = $swimmer_id ? get_post( $swimmer_id ) : null;
                        ?>
                        <tr data-evaluation-id="<?php echo esc_attr( $evaluation->ID ); ?>" style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px; border-bottom: 1px solid #eee;"><?php echo esc_html( $evaluation->post_title ); ?></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eee;"><?php echo $swimmer ? esc_html( $swimmer->post_title ) : 'N/A'; ?></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eee;"><?php echo esc_html( get_the_date( '', $evaluation->ID ) ); ?></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eee;">
                                <button class="button button-secondary lm-dismiss-btn" style="padding: 6px 12px; background: #f0f0f1; border: 1px solid #ddd; border-radius: 3px; cursor: pointer;"><?php esc_html_e( 'Dismiss', 'lesson-management' ); ?></button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
        
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            var table = $('#unsent-evaluations-table');
            var tableBody = table.find('tbody');
            var countSpan = $('#unsent-count');
            var sendButton = $('#lm-send-bulk-email-btn');
            var refreshButton = $('#lm-refresh-btn');
            var logContainer = $('#lm-bulk-email-log');
            var logList = $('#lm-log-list');
            var spinner = $('#lm-bulk-email-controls .spinner');

            table.on('click', '.lm-dismiss-btn', function() {
                var row = $(this).closest('tr');
                row.hide();
                row.attr('data-dismissed', 'true');
                var currentCount = parseInt(countSpan.text(), 10);
                countSpan.text(Math.max(0, currentCount - 1));
            });

            refreshButton.on('click', function() { location.reload(); });

            sendButton.on('click', function() {
                var rowsToSend = tableBody.find('tr:not([data-dismissed]):visible');
                var evaluationIds = rowsToSend.map(function() {
                    return $(this).data('evaluation-id');
                }).get().filter(Boolean);

                if (evaluationIds.length === 0) {
                    alert('No evaluations to send.');
                    return;
                }
                
                if (!confirm('Are you sure you want to email the ' + evaluationIds.length + ' visible evaluations?')) {
                    return;
                }

                sendButton.prop('disabled', true);
                spinner.css('visibility', 'visible');
                logContainer.show();
                logList.html('<li>Starting process...</li>');

                $.ajax({
                    url: '<?php echo esc_url_raw( rest_url( 'lm/v1/send-unsent-evaluations' ) ); ?>',
                    method: 'POST',
                    beforeSend: function(xhr) {
                        xhr.setRequestHeader('X-WP-Nonce', '<?php echo wp_create_nonce( 'wp_rest' ); ?>');
                    },
                    contentType: 'application/json',
                    data: JSON.stringify({ ids: evaluationIds }),
                    success: function(data) {
                        if (data.logs) {
                            logList.html('');
                            data.logs.forEach(function(log) {
                                var li = $('<li>').text(log);
                                if (log.indexOf('--> Error:') === 0) {
                                    li.css('color', 'red');
                                }
                                logList.append(li);
                            });
                        }

                        if (data.sent_ids) {
                            data.sent_ids.forEach(function(id) {
                                tableBody.find('tr[data-evaluation-id="' + id + '"]').remove();
                            });
                            countSpan.text(tableBody.find('tr').length);
                        }
                        
                        alert(data.message || 'Process completed!');
                    },
                    error: function(xhr, status, error) {
                        console.error('Error:', error);
                        var li = $('<li>').text('Fatal Error: ' + error).css('color', 'red');
                        logList.append(li);
                        alert('A fatal error occurred. Please check the log on this page and the browser console.');
                    },
                    complete: function() {
                        sendButton.prop('disabled', false);
                        spinner.css('visibility', 'hidden');
                        logList.append('<li>Process finished.</li>');
                        refreshButton.show();
                    }
                });
            });
        });
        </script>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('swimmer_evaluation_view', 'lm_render_swimmer_evaluation_view');

/**
 * Renders the public-facing view for a swimmer's evaluations.
 * Redirects to the React app with the token parameter.
 *
 * @return string The HTML output for the page.
 */
function lm_render_swimmer_evaluation_view() {
    $token = isset($_GET['token']) ? sanitize_text_field($_GET['token']) : '';

    if (empty($token)) {
        return '<p style="color: #c00; font-family: sans-serif;">Invalid or missing evaluation link.</p>';
    }

    $swimmers = get_posts([
        'post_type' => 'lm-swimmer',
        'posts_per_page' => 1,
        'meta_query' => [['key' => 'lm_evaluation_token', 'value' => $token]],
        'post_status' => 'any',
    ]);

    if (empty($swimmers)) {
        return '<p style="color: #c00; font-family: sans-serif;">This evaluation link is invalid. No swimmer found for this token.</p>';
    }

    $swimmer = $swimmers[0];
    $token_expires = get_post_meta($swimmer->ID, 'lm_evaluation_token_expires', true);

    // If token_expires is set and the current time is past it, show expiration message
    // If token_expires is empty, the token is permanent (no expiration)
    if (!empty($token_expires) && time() > (int)$token_expires) {
        return '<p style="color: #c00; font-family: sans-serif;">This evaluation link has expired. Please request a new one.</p>';
    }

    // Redirect to React app page with token parameter
    // Find the page that has the [aquaticpro_app] shortcode
    $app_pages = get_posts([
        'post_type' => 'page',
        'posts_per_page' => 1,
        's' => '[aquaticpro_app]',
        'post_status' => 'publish',
    ]);

    if (!empty($app_pages)) {
        $app_url = get_permalink($app_pages[0]->ID);
        $redirect_url = add_query_arg('token', $token, $app_url);
        wp_redirect($redirect_url);
        exit;
    }

    // Fallback: if no React app page found, continue with original shortcode rendering

    // --- Data Fetching ---
    $current_level_id = get_post_meta($swimmer->ID, 'current_level', true);
    $current_level = $current_level_id ? get_post($current_level_id) : null;
    $skills_mastered_data = get_post_meta($swimmer->ID, 'skills_mastered', true) ?: [];
    $levels_mastered_ids = get_post_meta($swimmer->ID, 'levels_mastered', true) ?: [];

    // Fetch all levels and skills for grouping
    $all_levels = get_posts(['post_type' => 'lm-level', 'posts_per_page' => -1, 'meta_key' => 'sort_order', 'orderby' => 'meta_value_num', 'order' => 'ASC']);
    $all_skills = get_posts(['post_type' => 'lm-skill', 'posts_per_page' => -1]);

    // Group skills by level ID
    $skills_by_level = [];
    foreach ($all_skills as $skill) {
        $level_id = get_post_meta($skill->ID, 'level_associated', true) ?: 'uncategorized';
        if (!isset($skills_by_level[$level_id])) {
            $skills_by_level[$level_id] = [];
        }
        $skills_by_level[$level_id][] = $skill;
    }

    // Create a lookup for mastered skills for faster access
    $mastered_skills_lookup = [];
    if (is_array($skills_mastered_data)) {
        foreach ($skills_mastered_data as $mastered) {
            if (isset($mastered['skill_id'])) {
                $mastered_skills_lookup[$mastered['skill_id']] = $mastered['date'] ?? '';
            }
        }
    }
    
    $evaluations = get_posts(['post_type' => 'lm-evaluation', 'posts_per_page' => -1, 'meta_query' => [['key' => 'swimmer', 'value' => $swimmer->ID]], 'orderby' => 'date', 'order' => 'DESC']);

    // Get the reply-to email setting for the "questions" link
    $reply_to_email = get_option('lm_evaluation_reply_to_email', '');

    // --- Start HTML Output ---
    ob_start();
    ?>
    <div class="swimmer-evaluation-wrapper" style="font-family: sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
        <header style="border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <h1 style="font-size: 2.5em; margin-bottom: 0;"><?php echo esc_html($swimmer->post_title); ?></h1>
            <?php if ($current_level) : ?>
                <p style="font-size: 1.2em; color: #555; margin-top: 0.5rem;">
                    <strong>Current Level:</strong> <?php echo esc_html($current_level->post_title); ?>
                </p>
            <?php endif; ?>
        </header>

        <section id="evaluations" style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem;">Evaluation History</h2>
            <?php if (!empty($reply_to_email)) : ?>
                <p style="margin: 1rem 0; font-size: 1em;">
                    <a href="mailto:<?php echo esc_attr($reply_to_email); ?>" style="color: #2563eb; text-decoration: underline;">For questions about evaluations, click here!</a>
                </p>
            <?php endif; ?>
            <?php if (!empty($evaluations)) : ?>
                <?php foreach ($evaluations as $evaluation) :
                    $level_eval_id = get_post_meta($evaluation->ID, 'level_evaluated', true);
                    $level_evaluated = $level_eval_id ? get_post($level_eval_id) : null;
                    $author_id = $evaluation->post_author;
                    $author_name = $author_id ? get_the_author_meta('display_name', $author_id) : '';
                ?>
                    <div class="evaluation-entry" style="border: 1px solid #ddd; border-radius: 5px; margin-bottom: 1.5rem; overflow: hidden;">
                        <div style="background: #f6f7f7; padding: 1rem; border-bottom: 1px solid #ddd;">
                            <h3 style="margin: 0; font-size: 1.5em;"><?php echo esc_html($evaluation->post_title); ?></h3>
                            <p style="margin: 0.25rem 0 0; color: #666;">
                                <?php echo esc_html(get_the_date('F j, Y', $evaluation->ID)); ?>
                                <?php if ($author_name) : ?>
                                    | <strong>By:</strong> <?php echo esc_html($author_name); ?>
                                <?php endif; ?>
                                <?php if ($level_evaluated) : ?>
                                    | <strong>Level Evaluated:</strong> <?php echo esc_html($level_evaluated->post_title); ?>
                                <?php endif; ?>
                            </p>
                        </div>
                        <div style="padding: 1rem; line-height: 1.6;">
                            <?php echo wpautop(apply_filters('the_content', $evaluation->post_content)); ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php else : ?>
                <p>No evaluations have been recorded for this swimmer.</p>
            <?php endif; ?>
        </section>

        <section id="progress-tracking" style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; margin-bottom: 1.5rem;">Progress Tracking</h2>
            <div class="levels-container" style="space-y: 1.5rem;">
                <?php foreach ($all_levels as $level) :
                    $skills_in_level = $skills_by_level[$level->ID] ?? [];
                    if (empty($skills_in_level)) continue;
                ?>
                    <div class="level-group" style="margin-bottom: 2rem;">
                        <h3 style="font-size: 1.5em; font-weight: bold; margin-bottom: 1rem;"><?php echo esc_html($level->post_title); ?></h3>
                        <?php if (!empty($levels_mastered_ids) && in_array($level->ID, $levels_mastered_ids)) : ?>
                            <p style="background: #dbeafe; color: #1e40af; padding: 0.5rem 1rem; border-radius: 4px; margin-bottom: 1rem; display: inline-block;"><strong>Level Mastered!</strong></p>
                        <?php endif; ?>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <?php foreach ($skills_in_level as $skill) :
                                $is_mastered = isset($mastered_skills_lookup[$skill->ID]);
                                $completion_date = $is_mastered ? $mastered_skills_lookup[$skill->ID] : '';
                                
                                $li_style = 'display: flex; align-items: center; padding: 12px; border-radius: 8px; margin-bottom: 8px; transition: all 0.3s;';
                                if ($is_mastered) {
                                    $li_style .= ' background-color: #22c55e; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1);';
                                } else {
                                    $li_style .= ' background-color: #f8f9fa; border: 1px solid #e5e7eb;';
                                }
                            ?>
                                <li style="<?php echo $li_style; ?>">
                                    <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center; height: 44px; width: 44px; border-radius: 9999px; margin-right: 1rem; <?php echo $is_mastered ? 'background-color: #16a34a;' : 'background-color: #e5e7eb; color: #4b5563;'; ?>">
                                        <?php if ($is_mastered) : ?>
                                            <svg xmlns="http://www.w3.org/2000/svg" style="height: 28px; width: 28px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        <?php else : ?>
                                            <span style="font-size: 1.5em; color: #9ca3af;">&#9744;</span>
                                        <?php endif; ?>
                                    </div>
                                    <div style="flex-grow: 1;">
                                        <p style="font-weight: 500; margin: 0; <?php echo $is_mastered ? 'text-decoration: none;' : ''; ?>">
                                            <?php echo esc_html($skill->post_title); ?>
                                        </p>
                                        <?php if ($is_mastered && !empty($completion_date)) : ?>
                                            <span style="font-size: 0.875rem; color: rgba(255,255,255,0.8);">Completed on <?php echo esc_html(date('F j, Y', strtotime($completion_date))); ?></span>
                                        <?php endif; ?>
                                    </div>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Calculates age based on a birthdate string.
 *
 * @param string $birthdate The birthdate in YYYY-MM-DD format.
 * @return int|null The age in years, or null if the date is invalid.
 */
function lm_calculate_age( $birthdate ) {
    if ( ! $birthdate ) {
        return null;
    }
    try {
        $birthDate = new DateTime($birthdate);
        $today = new DateTime('today');
        $age = $birthDate->diff($today)->y;
        return $age;
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Renders the public-facing view for camp rosters with enhanced details.
 * Shortcode: [lm_camp_rosters]
 *
 * @return string The HTML output for the page.
 */
function lm_render_camp_rosters_shortcode() {
    ob_start();

    // --- 1. Data Fetching and Preparation ---
    $camp_lesson_type = get_term_by('slug', 'camp', 'lm_lesson_type');
    if (!$camp_lesson_type) {
        return '<p>Error: The "Camp" lesson type could not be found.</p>';
    }

    $all_camps = get_terms([
        'taxonomy' => 'lm_camp',
        'hide_empty' => false,
        'orderby' => 'name',
        'order' => 'ASC',
    ]);

    $selected_camp_slug = isset($_GET['camp_filter']) ? sanitize_text_field($_GET['camp_filter']) : '';

    $args = [
        'post_type' => 'lm-group',
        'posts_per_page' => -1,
        'meta_query' => [
            ['key' => 'archived', 'value' => '1', 'compare' => '!='],
        ],
        'tax_query' => [
            'relation' => 'AND',
            ['taxonomy' => 'lm_lesson_type', 'field' => 'term_id', 'terms' => $camp_lesson_type->term_id],
        ],
        'orderby' => 'title',
        'order' => 'ASC',
    ];
    
    if (!empty($selected_camp_slug)) {
        $args['tax_query'][] = [
            'taxonomy' => 'lm_camp',
            'field'    => 'slug',
            'terms'    => $selected_camp_slug,
        ];
    }

    $groups_query = new WP_Query($args);
    $rosters_data = [];
    $all_levels = []; // Cache levels to reduce queries

    if ($groups_query->have_posts()) {
        while ($groups_query->have_posts()) {
            $groups_query->the_post();
            $group_id = get_the_ID();
            $group_title = get_the_title($group_id);
            $instructor_ids = get_post_meta($group_id, 'instructor', true);
            $instructors_string = '';
            if (!empty($instructor_ids) && is_array($instructor_ids)) {
                $instructor_users = get_users(['include' => $instructor_ids, 'fields' => ['display_name']]);
                $instructor_names = array_map(function($user) { return $user->display_name; }, $instructor_users);
                $instructors_string = implode(', ', $instructor_names);
            }
            
            $camp_terms = get_the_terms($group_id, 'lm_camp');
            $animal_terms = get_the_terms($group_id, 'lm_animal');
            $group_level_id = get_post_meta($group_id, 'level', true);

            // Get Group Level Name
            if ($group_level_id && !isset($all_levels[$group_level_id])) {
                $all_levels[$group_level_id] = get_the_title($group_level_id);
            }
            $group_level_name = $all_levels[$group_level_id] ?? null;
            
            $swimmer_ids = get_post_meta($group_id, 'swimmers', true);
            $swimmers_list = [];

            if (!empty($swimmer_ids) && is_array($swimmer_ids)) {
                $swimmer_args = [
                    'post_type' => 'lm-swimmer',
                    'posts_per_page' => -1,
                    'post__in' => $swimmer_ids,
                    'orderby' => 'title',
                    'order' => 'ASC',
                ];
                $swimmers_query = new WP_Query($swimmer_args);
                if ($swimmers_query->have_posts()) {
                    while ($swimmers_query->have_posts()) {
                        $swimmers_query->the_post();
                        $swimmer_id = get_the_ID();
                        $swimmer_level_id = get_post_meta($swimmer_id, 'current_level', true);
                        $swimmer_dob = get_post_meta($swimmer_id, 'date_of_birth', true);

                        if ($swimmer_level_id && !isset($all_levels[$swimmer_level_id])) {
                            $all_levels[$swimmer_level_id] = get_the_title($swimmer_level_id);
                        }
                        
                        $swimmers_list[] = [
                            'name' => get_the_title(),
                            'level' => $all_levels[$swimmer_level_id] ?? 'N/A',
                            'age' => lm_calculate_age($swimmer_dob),
                        ];
                    }
                }
                wp_reset_postdata();
            }

            $group_data = [
                'group_title' => $group_title,
                'group_level' => $group_level_name,
                'instructors_string' => $instructors_string,
                'swimmers' => $swimmers_list,
            ];
    
            $camps = !is_wp_error($camp_terms) && !empty($camp_terms) ? $camp_terms : [ (object)['name' => 'Uncategorized Camp'] ];
            $animals = !is_wp_error($animal_terms) && !empty($animal_terms) ? $animal_terms : [ (object)['name' => 'Uncategorized Animal'] ];
    
            foreach ($camps as $camp) {
                foreach ($animals as $animal) {
                    if (!isset($rosters_data[$camp->name])) {
                        $rosters_data[$camp->name] = [];
                    }
                    if (!isset($rosters_data[$camp->name][$animal->name])) {
                        $rosters_data[$camp->name][$animal->name] = [];
                    }
                    $rosters_data[$camp->name][$animal->name][] = $group_data;
                }
            }
        }
    }
    wp_reset_postdata();

    ksort($rosters_data);
    foreach ($rosters_data as &$animals) {
        ksort($animals);
    }

    // --- 2. HTML Output ---
    ?>
    <div class="lm-camp-rosters-container">
        <form method="get" action="" class="lm-roster-filters" style="margin-bottom: 2rem; padding: 1rem; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 8px;">
            <label for="camp-filter-select" style="font-weight: bold; margin-right: 10px;">Filter by Camp:</label>
            <select id="camp-filter-select" name="camp_filter" onchange="this.form.submit()">
                <option value="">All Camps</option>
                <?php foreach ($all_camps as $camp) : ?>
                    <option value="<?php echo esc_attr($camp->slug); ?>" <?php selected($selected_camp_slug, $camp->slug); ?>>
                        <?php echo esc_html($camp->name); ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <noscript><button type="submit">Filter</button></noscript>
        </form>

        <?php if (empty($rosters_data)) : ?>
            <p>No camp rosters found matching the selected criteria.</p>
        <?php else : ?>
            <?php foreach ($rosters_data as $camp_name => $animals) : ?>
                <div class="roster-camp-section" style="margin-bottom: 2.5rem;">
                    <h2 style="font-size: 2em; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;">
                        <?php echo esc_html($camp_name); ?>
                    </h2>
                    <?php foreach ($animals as $animal_name => $groups) : ?>
                        <div class="roster-animal-section" style="margin-bottom: 2rem; padding-left: 20px;">
                             <h3 style="font-size: 1.5em; color: #4a5568; margin-bottom: 1rem;">
                                <?php echo esc_html($animal_name); ?>
                            </h3>
                            <?php foreach ($groups as $group) : ?>
                                <div class="roster-group" style="margin-bottom: 1.5rem; padding-left: 20px;">
                                    <h4 style="font-size: 1.2em; font-weight: bold; color: #718096; margin-bottom: 0.5rem;">
                                        <?php echo esc_html($group['group_title']); ?>
                                        <?php if (!empty($group['instructors_string'])) : ?>
                                            <span style="font-weight: normal; color: #4a5568;"> - <?php echo esc_html($group['instructors_string']); ?></span>
                                        <?php endif; ?>
                                        <?php if ($group['group_level']) : ?>
                                            <span style="font-size: 0.85em; font-weight: normal; color: #a0aec0;">(Level: <?php echo esc_html($group['group_level']); ?>)</span>
                                        <?php endif; ?>
                                    </h4>
                                    <?php if (!empty($group['swimmers'])) : ?>
                                        <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
                                            <?php foreach ($group['swimmers'] as $swimmer) : ?>
                                                <li style="padding-bottom: 0.25rem;">
                                                    <?php echo esc_html($swimmer['name']); ?>
                                                    <span style="color: #718096; font-size: 0.9em;">
                                                        - Age: <?php echo $swimmer['age'] !== null ? esc_html($swimmer['age']) : 'N/A'; ?>,
                                                        Level: <?php echo esc_html($swimmer['level']); ?>
                                                    </span>
                                                </li>
                                            <?php endforeach; ?>
                                        </ul>
                                    <?php else : ?>
                                        <p style="padding-left: 20px; font-style: italic; color: #a0aec0;">No swimmers in this group.</p>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('lm_camp_rosters', 'lm_render_camp_rosters_shortcode');