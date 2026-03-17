<?php
/**
 * Goal Changes API — Real-time polling endpoint
 *
 * Returns updates, meetings, and comments modified since a given timestamp.
 * Designed for 15-second polling from the GoalWorkspace frontend.
 *
 * @package MentorshipPlatform
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

if ( ! function_exists( 'mentorship_platform_register_goal_changes_routes' ) ) {
    /**
     * Register the goal changes REST API route.
     */
    function mentorship_platform_register_goal_changes_routes() {
        $namespace = 'mentorship-platform/v1';

        // GET /mentorship-platform/v1/goals/{id}/changes?since={ISO 8601}
        register_rest_route( $namespace, '/goals/(?P<id>\d+)/changes', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'mentorship_platform_get_goal_changes',
            'permission_callback' => 'mentorship_platform_goal_permission_check',
            'args'                => array(
                'id'    => array(
                    'required'          => true,
                    'type'              => 'integer',
                    'sanitize_callback' => 'absint',
                ),
                'since' => array(
                    'required'          => true,
                    'type'              => 'string',
                    'description'       => 'ISO 8601 timestamp. Only items modified after this time are returned.',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => function ( $value ) {
                        // Validate ISO 8601 date
                        $dt = DateTime::createFromFormat( DateTime::ATOM, $value );
                        if ( ! $dt ) {
                            // Try fallback Y-m-d H:i:s format
                            $dt = DateTime::createFromFormat( 'Y-m-d H:i:s', $value );
                        }
                        return $dt !== false;
                    },
                ),
            ),
        ) );
    }

    add_action( 'rest_api_init', 'mentorship_platform_register_goal_changes_routes' );
}

if ( ! function_exists( 'mentorship_platform_get_goal_changes' ) ) {
    /**
     * API Callback: Get changes to a goal since a given timestamp.
     *
     * Returns:
     * - newUpdates: updates posted after $since
     * - changedMeetings: meetings modified after $since
     * - changedGoal: goal meta if the goal itself was modified (title, description, status, tasks, initiatives)
     * - serverTimestamp: current server time (for next poll's `since` param)
     *
     * Performance: Uses `post_modified_gmt` index and limits results.
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    function mentorship_platform_get_goal_changes( $request ) {
        $goal_id = (int) $request['id'];
        $since   = sanitize_text_field( $request['since'] );

        // Normalize the since timestamp to MySQL format (UTC)
        $dt = DateTime::createFromFormat( DateTime::ATOM, $since );
        if ( ! $dt ) {
            $dt = DateTime::createFromFormat( 'Y-m-d H:i:s', $since );
        }
        if ( ! $dt ) {
            return new WP_Error(
                'invalid_timestamp',
                'Could not parse the `since` parameter as ISO 8601.',
                array( 'status' => 400 )
            );
        }
        $since_mysql = $dt->format( 'Y-m-d H:i:s' );

        // Current server time for the response (client uses this as next `since`)
        $server_now = gmdate( 'c' ); // ISO 8601 UTC

        // ── 1. New/changed updates ──────────────────────────────────────────
        $new_updates = get_posts( array(
            'post_type'      => 'mp_update',
            'posts_per_page' => 50,
            'meta_key'       => '_goal_id',
            'meta_value'     => $goal_id,
            'date_query'     => array(
                array(
                    'column' => 'post_modified_gmt',
                    'after'  => $since_mysql,
                ),
            ),
            'orderby'        => 'modified',
            'order'          => 'DESC',
        ) );

        $formatted_updates = array();
        foreach ( $new_updates as $update_post ) {
            $formatted_updates[] = mentorship_platform_prepare_update_for_api( $update_post );
        }

        // ── 2. Changed meetings ─────────────────────────────────────────────
        $changed_meetings = get_posts( array(
            'post_type'      => 'mp_meeting',
            'posts_per_page' => 50,
            'meta_key'       => '_goal_id',
            'meta_value'     => $goal_id,
            'date_query'     => array(
                array(
                    'column' => 'post_modified_gmt',
                    'after'  => $since_mysql,
                ),
            ),
            'orderby'        => 'modified',
            'order'          => 'DESC',
        ) );

        $formatted_meetings = array();
        foreach ( $changed_meetings as $meeting_post ) {
            $formatted_meetings[] = mentorship_platform_prepare_meeting_for_api( $meeting_post );
        }

        // ── 3. Goal-level changes (title, description, status, tasks, initiatives) ──
        $goal_post = get_post( $goal_id );
        $goal_changed = false;

        if ( $goal_post && strtotime( $goal_post->post_modified_gmt ) > strtotime( $since_mysql ) ) {
            $goal_changed = true;
        }

        // ── 4. New comments on goal/meetings/updates ────────────────────────
        // Collect all post IDs associated with this goal
        $post_ids = array( $goal_id );
        $all_meetings = get_posts( array(
            'post_type'      => 'mp_meeting',
            'posts_per_page' => 100,
            'meta_key'       => '_goal_id',
            'meta_value'     => $goal_id,
            'fields'         => 'ids',
        ) );
        $all_updates = get_posts( array(
            'post_type'      => 'mp_update',
            'posts_per_page' => 100,
            'meta_key'       => '_goal_id',
            'meta_value'     => $goal_id,
            'fields'         => 'ids',
        ) );
        $post_ids = array_merge( $post_ids, $all_meetings, $all_updates );

        $new_comments = get_comments( array(
            'post__in'   => $post_ids,
            'date_query' => array(
                array(
                    'after' => $since_mysql,
                ),
            ),
            'number'     => 50,
            'orderby'    => 'comment_date_gmt',
            'order'      => 'DESC',
        ) );

        $formatted_comments = array();
        foreach ( $new_comments as $comment ) {
            $formatted_comments[] = array(
                'id'       => (int) $comment->comment_ID,
                'postId'   => (int) $comment->comment_post_ID,
                'author'   => array(
                    'id'        => (int) $comment->user_id,
                    'name'      => $comment->comment_author,
                    'avatarUrl' => get_avatar_url( $comment->user_id, array( 'size' => 48 ) ),
                ),
                'content'  => $comment->comment_content,
                'date'     => get_comment_date( 'c', $comment ),
                'parentId' => (int) $comment->comment_parent ?: null,
            );
        }

        // ── Build response ──────────────────────────────────────────────────
        $response = array(
            'newUpdates'      => $formatted_updates,
            'changedMeetings' => $formatted_meetings,
            'goalChanged'     => $goal_changed,
            'newComments'     => $formatted_comments,
            'serverTimestamp' => $server_now,
        );

        // If the goal itself changed, include the full refreshed goal data
        if ( $goal_changed ) {
            $response['changedGoal'] = mentorship_platform_prepare_goal_for_api( $goal_post );
        }

        return rest_ensure_response( $response );
    }
}
