<?php
/**
 * Handles generating tokens and sending evaluation emails.
 *
 * @package LessonManagement
 */

defined( 'ABSPATH' ) || die;

// --- Admin Page for Bulk Emailing ---

/**
 * Renders the HTML for the Bulk Email page.
 */
function lm_render_bulk_email_page() {
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
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Bulk Email Unsent Evaluations', 'lesson-management' ); ?></h1>
        <p><?php esc_html_e( 'This page lists all evaluations that have not been marked as "Emailed to Parent". Click the button to send them all. You can use the "Dismiss" button to temporarily remove an evaluation from this batch.', 'lesson-management' ); ?></p>

        <div id="lm-bulk-email-controls">
            <button id="lm-send-bulk-email-btn" class="button button-primary">
                <?php esc_html_e( 'Email All Unsent Evaluations', 'lesson-management' ); ?>
            </button>
            <span class="spinner" style="visibility: hidden; float: none; margin: 0 0 0 8px;"></span>
            <button id="lm-refresh-btn" class="button button-secondary" style="display: none; margin-left: 10px;"><?php esc_html_e( 'Refresh Page', 'lesson-management' ); ?></button>
        </div>

        <div id="lm-bulk-email-log" style="background-color: #f6f7f7; border: 1px solid #ccc; padding: 10px; margin-top: 20px; max-height: 400px; overflow-y: auto; display: none;">
            <h3><?php esc_html_e( 'Sending Log:', 'lesson-management' ); ?></h3>
            <ul id="lm-log-list" style="list-style-type: disc; padding-left: 20px;"></ul>
        </div>

        <h2 style="margin-top: 20px;"><?php esc_html_e( 'Unsent Evaluations', 'lesson-management' ); ?> (<span id="unsent-count"><?php echo count($unsent_evaluations); ?></span>)</h2>
        <table class="wp-list-table widefat fixed striped" id="unsent-evaluations-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; background: white; border: 1px solid #ddd;">
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
    </div>
    <script type="text/javascript">
        document.addEventListener('DOMContentLoaded', function() {
            const table = document.getElementById('unsent-evaluations-table');
            const tableBody = table.querySelector('tbody');
            const countSpan = document.getElementById('unsent-count');
            const sendButton = document.getElementById('lm-send-bulk-email-btn');
            const refreshButton = document.getElementById('lm-refresh-btn');
            const logContainer = document.getElementById('lm-bulk-email-log');
            const logList = document.getElementById('lm-log-list');
            const spinner = document.querySelector('#lm-bulk-email-controls .spinner');

            table.addEventListener('click', function(e) {
                if (e.target && e.target.classList.contains('lm-dismiss-btn')) {
                    const row = e.target.closest('tr');
                    if (row) {
                        row.style.display = 'none';
                        row.dataset.dismissed = 'true';
                        let currentCount = parseInt(countSpan.textContent, 10);
                        countSpan.textContent = Math.max(0, currentCount - 1);
                    }
                }
            });

            refreshButton.addEventListener('click', () => location.reload());

            sendButton.addEventListener('click', function() {
                const rowsToSend = Array.from(tableBody.querySelectorAll('tr:not([data-dismissed])'));
                const evaluationIds = rowsToSend.map(row => row.dataset.evaluationId).filter(Boolean);

                if (evaluationIds.length === 0) {
                    alert('No evaluations to send.');
                    return;
                }
                
                if (!confirm(`Are you sure you want to email the ${evaluationIds.length} visible evaluations?`)) {
                    return;
                }

                sendButton.disabled = true;
                spinner.style.visibility = 'visible';
                logContainer.style.display = 'block';
                logList.innerHTML = '<li>Starting process...</li>';

                fetch('<?php echo esc_url_raw( rest_url( 'lm/v1/send-unsent-evaluations' ) ); ?>', {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': '<?php echo esc_js( wp_create_nonce( 'wp_rest' ) ); ?>',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ids: evaluationIds })
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw new Error(err.message || 'Server error') });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.logs) {
                        logList.innerHTML = ''; // Clear "Starting..." message
                        data.logs.forEach(log => {
                            const li = document.createElement('li');
                            if(log.startsWith('--> Error:')) {
                                li.style.color = 'red';
                            }
                            li.textContent = log;
                            logList.appendChild(li);
                        });
                    }

                    if (data.sent_ids) {
                        data.sent_ids.forEach(id => {
                            const row = tableBody.querySelector(`tr[data-evaluation-id="${id}"]`);
                            if (row) {
                                row.remove();
                            }
                        });
                        countSpan.textContent = tableBody.querySelectorAll('tr').length;
                    }
                    
                    alert(data.message || 'Process completed!');
                })
                .catch(error => {
                    console.error('Error:', error);
                    const li = document.createElement('li');
                    li.style.color = 'red';
                    li.textContent = 'Fatal Error: ' + error.message;
                    logList.appendChild(li);
                    alert('A fatal error occurred. Please check the log on this page and the browser console.');
                })
                .finally(() => {
                    sendButton.disabled = false;
                    spinner.style.visibility = 'hidden';
                    logList.insertAdjacentHTML('beforeend', '<li>Process finished.</li>');
                    refreshButton.style.display = 'inline-block';
                });
            });
        });
    </script>
    <?php
}


// --- REST API Endpoint for Bulk Emailing ---

add_action( 'rest_api_init', 'lm_register_bulk_email_route' );

/**
 * Registers the custom REST API route.
 */
function lm_register_bulk_email_route() {
    register_rest_route( 'lm/v1', '/send-unsent-evaluations', [
        'methods'             => 'POST',
        'callback'            => 'lm_handle_bulk_email_request',
        'permission_callback' => function () {
			// Priority 1: Super admins and users who can manage options always have access.
			if ( current_user_can( 'manage_options' ) ) {
				return true;
			}

			// Priority 2: Check against the custom roles saved in the settings.
			$user = wp_get_current_user();
			if ( ! $user || ! $user->ID ) {
				return false;
			}
			$user_roles = (array) $user->roles;

			// Get the roles allowed to access the bulk email page. Default to just 'administrator'.
			$allowed_roles = get_option( 'lm_bulk_email_allowed_roles', [ 'administrator' ] );

			// Check if any of the user's roles are in the allowed list.
			$has_permission = ! empty( array_intersect( $user_roles, $allowed_roles ) );
			return $has_permission;
        },
    ] );
}

/**
 * Handles the REST API request to send emails.
 */
function lm_handle_bulk_email_request() {
    $body = json_decode( file_get_contents( 'php://input' ), true );
    $evaluation_ids_to_send = isset( $body['ids'] ) ? array_map( 'absint', $body['ids'] ) : [];
    if ( empty( $evaluation_ids_to_send ) ) {
        return new WP_REST_Response( [ 'message' => 'No evaluations were selected to send.' ], 400 );
    }

    $logs = [];
    $sent_ids = [];
    $unsent_evaluations = get_posts([
        'post_type'      => 'lm-evaluation',
        'post__in' => $evaluation_ids_to_send,
        'posts_per_page' => -1,
    ]);

    if ( empty( $unsent_evaluations ) ) {
        return new WP_REST_Response( [
            'message' => 'No unsent evaluations found to email.',
            'logs'    => [ 'Process finished: No evaluations to send.' ],
            'sent_ids' => [],
        ], 200 );
    }

    foreach ( $unsent_evaluations as $evaluation ) {
        $logs[] = "Processing evaluation: \"{$evaluation->post_title}\" (ID: {$evaluation->ID})";
        $result = lm_send_single_evaluation_email( $evaluation->ID );
        if ( is_wp_error( $result ) ) {
            $logs[] = "--> Error: " . $result->get_error_message();
        } else {
            $recipient_email = isset( $result['email'] ) ? $result['email'] : 'unknown';
            $logs[] = "--> Success: Email sent to {$recipient_email} and evaluation marked as complete.";
            // Mark as sent
            update_post_meta( $evaluation->ID, 'emailed', true );
            $sent_ids[] = $evaluation->ID;
        }
        // Wait for 2 seconds before the next email to avoid server overload
        sleep( 2 );
    }

    return new WP_REST_Response( [
        'message' => 'Bulk email process completed.',
        'logs'    => $logs,
        'sent_ids' => $sent_ids,
    ], 200 );
}


/**
 * Sends a single evaluation email.
 *
 * @param int $evaluation_id The ID of the evaluation post.
 * @return array|WP_Error An array with the recipient's email on success, WP_Error on failure.
 */
function lm_send_single_evaluation_email( $evaluation_id ) {
    $swimmer_id = get_post_meta( $evaluation_id, 'swimmer', true );
    if ( ! $swimmer_id ) {
        return new WP_Error( 'no_swimmer', 'No swimmer associated with this evaluation.' );
    }

    $parent_email = get_post_meta( $swimmer_id, 'parent_email', true );
    if ( ! is_email( $parent_email ) ) {
        return new WP_Error( 'no_parent_email', 'Parent email is missing or invalid for swimmer ID ' . $swimmer_id );
    }

    // Get the swimmer's persistent evaluation token. If it doesn't exist, create one.
    $token = get_post_meta( $swimmer_id, 'lm_evaluation_token', true );
    if ( empty( $token ) ) {
        $token = bin2hex( random_bytes( 32 ) );
        update_post_meta( $swimmer_id, 'lm_evaluation_token', $token );
        // We are intentionally not setting an expiration here to make the token persistent.
        // The expiration is only set when a link is generated from the admin dashboard for a limited time share.
    }

    // Ensure the token used for email notifications is persistent (no expiration)
    // This prevents issues where a previously generated temporary share link causes the email link to appear expired.
    delete_post_meta( $swimmer_id, 'lm_evaluation_token_expires' );

    // Find the React app page (page with [aquaticpro_app] shortcode)
    $app_pages = get_posts([
        'post_type' => 'page',
        'posts_per_page' => 1,
        's' => '[aquaticpro_app]',
        'post_status' => 'publish',
    ]);

    if ( empty( $app_pages ) ) {
        return new WP_Error( 'no_react_page', 'No page found with [aquaticpro_app] shortcode. Please create a page with this shortcode for evaluation links.' );
    }

    $page_url = get_permalink( $app_pages[0]->ID );
    $subject_template = get_option( 'lm_evaluation_email_subject', 'Evaluation Results for [swimmer_name]' );
    $body_template    = get_option( 'lm_evaluation_email_body', "Hello [parent_name],\n\nWe've just completed a new evaluation for [swimmer_name].\n\nYou can view their progress tracking, skills mastered, and all evaluation history here:\n[evaluation_link]" );

    $separator = strpos($page_url, '?') === false ? '?' : '&';
    $evaluation_link = $page_url . $separator . 'token=' . $token;
    $swimmer         = get_post( $swimmer_id );
    $parent_name     = get_post_meta( $swimmer_id, 'parent_name', true ) ?: 'Parent';

    $replacements = [
        '[swimmer_name]'    => $swimmer->post_title,
        '[parent_name]'     => $parent_name,
        '[evaluation_link]' => '<a href="' . esc_url( $evaluation_link ) . '">' . esc_url( $evaluation_link ) . '</a>',
    ];

    $subject = str_replace( array_keys( $replacements ), array_values( $replacements ), $subject_template );
    $body    = wpautop( str_replace( array_keys( $replacements ), array_values( $replacements ), $body_template ) );
    $headers = [ 'Content-Type: text/html; charset=UTF-8' ];

    $sent = wp_mail( $parent_email, $subject, $body, $headers );

    if ( ! $sent ) {
        return new WP_Error( 'email_failed', 'The wp_mail() function failed to send the email.' );
    }

    return [ 'email' => $parent_email ];
}