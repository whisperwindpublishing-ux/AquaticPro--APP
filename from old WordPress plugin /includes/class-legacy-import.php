<?php
/**
 * Legacy Pods Mentorship Import
 * 
 * Imports data from the old Pods-based mentorship system into the new system.
 * 
 * Mapping:
 * - leadership_goal → mp_goal (with _is_portfolio = true by default)
 * - leadershiptask → mp_initiative
 * - leadership_meeting → mp_meeting
 * - leadership_update → mp_update
 * 
 * @package AquaticPro
 * @since 11.3.0
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

class AquaticPro_Legacy_Import {
    
    /**
     * Track mapping of old IDs to new IDs
     */
    private static $goal_map = array();      // old leadership_goal ID => new mp_goal ID
    private static $mentorship_map = array(); // mentor_id:mentee_id => mp_request ID
    private static $initiative_map = array(); // old leadershiptask ID => new mp_initiative ID
    private static $meeting_map = array();    // old leadership_meeting ID => new mp_meeting ID
    
    /**
     * Import results tracking
     */
    private static $results = array(
        'mentorships_created' => 0,
        'mentorships_existing' => 0,
        'goals_imported' => 0,
        'goals_skipped' => 0,
        'initiatives_imported' => 0,
        'initiatives_skipped' => 0,
        'meetings_imported' => 0,
        'meetings_skipped' => 0,
        'updates_imported' => 0,
        'updates_skipped' => 0,
        'errors' => array(),
        'preview_data' => array(
            'goals' => array(),
            'initiatives' => array(),
            'meetings' => array(),
            'updates' => array(),
        ),
    );
    
    /**
     * Run the full import
     * 
     * @param bool $dry_run If true, don't actually create posts
     * @return array Import results
     */
    public static function run_import( $dry_run = false ) {
        self::reset_results();
        
        error_log( '=== LEGACY IMPORT: Starting import (dry_run=' . ( $dry_run ? 'true' : 'false' ) . ') ===' );
        
        // Step 1: Import goals (this also creates mentorships)
        self::import_goals( $dry_run );
        
        // Step 2: Import initiatives (tasks)
        self::import_initiatives( $dry_run );
        
        // Step 3: Import meetings
        self::import_meetings( $dry_run );
        
        // Step 4: Import updates
        self::import_updates( $dry_run );
        
        error_log( '=== LEGACY IMPORT: Complete ===' );
        error_log( 'Results: ' . print_r( self::$results, true ) );
        
        return self::$results;
    }
    
    /**
     * Reset results array
     */
    private static function reset_results() {
        self::$results = array(
            'mentorships_created' => 0,
            'mentorships_existing' => 0,
            'goals_imported' => 0,
            'goals_skipped' => 0,
            'initiatives_imported' => 0,
            'initiatives_skipped' => 0,
            'meetings_imported' => 0,
            'meetings_skipped' => 0,
            'updates_imported' => 0,
            'updates_skipped' => 0,
            'errors' => array(),
            'preview_data' => array(
                'goals' => array(),
                'initiatives' => array(),
                'meetings' => array(),
                'updates' => array(),
            ),
        );
        self::$goal_map = array();
        self::$mentorship_map = array();
        self::$initiative_map = array();
        self::$meeting_map = array();
    }
    
    /**
     * Import leadership_goal posts → mp_goal
     */
    private static function import_goals( $dry_run ) {
        error_log( 'LEGACY IMPORT: Importing goals...' );
        
        // Get all leadership_goal posts
        $old_goals = get_posts( array(
            'post_type'      => 'leadership_goal',
            'posts_per_page' => -1,
            'post_status'    => array( 'publish', 'draft', 'private' ),
        ) );
        
        error_log( 'LEGACY IMPORT: Found ' . count( $old_goals ) . ' leadership_goal posts' );
        
        foreach ( $old_goals as $old_goal ) {
            // Check if already imported (by checking for meta reference)
            $existing = self::find_imported_post( 'mp_goal', $old_goal->ID, 'leadership_goal' );
            if ( $existing ) {
                self::$goal_map[ $old_goal->ID ] = $existing->ID;
                self::$results['goals_skipped']++;
                continue;
            }
            
            // Get Pods meta fields - try multiple approaches to find mentor
            $mentor_id = self::get_pods_user_id( $old_goal->ID, 'mentor' );
            if ( ! $mentor_id ) {
                $mentor_id = self::get_pods_user_id( $old_goal->ID, 'mentor_id' );
            }
            if ( ! $mentor_id ) {
                $mentor_id = self::get_pods_user_id( $old_goal->ID, '_mentor' );
            }
            
            // Try multiple approaches to find mentee
            $mentee_id = self::get_pods_user_id( $old_goal->ID, 'leadership_candidate' );
            if ( ! $mentee_id ) {
                $mentee_id = self::get_pods_user_id( $old_goal->ID, 'candidate' );
            }
            if ( ! $mentee_id ) {
                $mentee_id = self::get_pods_user_id( $old_goal->ID, 'mentee' );
            }
            if ( ! $mentee_id ) {
                $mentee_id = self::get_pods_user_id( $old_goal->ID, 'mentee_id' );
            }
            
            // Fallback: if no mentee set, use post_author
            if ( ! $mentee_id ) {
                $mentee_id = $old_goal->post_author;
            }
            
            // Get additional meta fields
            $goal_approved = get_post_meta( $old_goal->ID, 'goal_approved', true );
            $goal_evaluation = get_post_meta( $old_goal->ID, 'goal_evaluation', true );
            $brainstorm_ideas = get_post_meta( $old_goal->ID, 'goal_brainstorm_ideas', true );
            
            // Get user names for preview
            $mentor_user = $mentor_id ? get_user_by( 'id', $mentor_id ) : null;
            $mentee_user = $mentee_id ? get_user_by( 'id', $mentee_id ) : null;
            $author_user = get_user_by( 'id', $old_goal->post_author );
            
            // Build preview data
            $preview_item = array(
                'old_id'        => $old_goal->ID,
                'title'         => $old_goal->post_title,
                'status'        => $old_goal->post_status,
                'date'          => $old_goal->post_date,
                'author_id'     => $old_goal->post_author,
                'author_name'   => $author_user ? $author_user->display_name : 'Unknown',
                'mentor_id'     => $mentor_id,
                'mentor_name'   => $mentor_user ? $mentor_user->display_name : ($mentor_id ? "User #{$mentor_id}" : 'NOT SET'),
                'mentee_id'     => $mentee_id,
                'mentee_name'   => $mentee_user ? $mentee_user->display_name : ($mentee_id ? "User #{$mentee_id}" : 'NOT SET'),
                'will_import'   => true,
                'error'         => null,
            );
            
            if ( ! $mentor_id || ! $mentee_id ) {
                $preview_item['will_import'] = false;
                $preview_item['error'] = 'Missing ' . ( ! $mentor_id ? 'mentor' : '' ) . ( ! $mentor_id && ! $mentee_id ? ' and ' : '' ) . ( ! $mentee_id ? 'mentee' : '' );
                
                self::$results['errors'][] = "Goal #{$old_goal->ID} ({$old_goal->post_title}): Missing " . ( ! $mentor_id ? 'mentor' : '' ) . ( ! $mentor_id && ! $mentee_id ? ' and ' : '' ) . ( ! $mentee_id ? 'mentee' : '' );
                self::$results['goals_skipped']++;
                
                if ( $dry_run ) {
                    self::$results['preview_data']['goals'][] = $preview_item;
                }
                continue;
            }
            
            // Get or create mentorship (mp_request)
            $mentorship_id = self::get_or_create_mentorship( $mentor_id, $mentee_id, $dry_run );
            
            if ( ! $mentorship_id ) {
                $preview_item['will_import'] = false;
                $preview_item['error'] = 'Failed to create mentorship';
                
                self::$results['errors'][] = "Goal #{$old_goal->ID}: Failed to create mentorship";
                self::$results['goals_skipped']++;
                
                if ( $dry_run ) {
                    self::$results['preview_data']['goals'][] = $preview_item;
                }
                continue;
            }
            
            // Add to preview data
            if ( $dry_run ) {
                self::$results['preview_data']['goals'][] = $preview_item;
            }
            
            // Determine status
            $status = 'In Progress';
            if ( $goal_approved ) {
                $status = 'Completed';
            }
            
            // Build content (append brainstorm ideas and evaluation if present)
            $content = $old_goal->post_content;
            if ( $brainstorm_ideas ) {
                $ideas = is_array( $brainstorm_ideas ) ? implode( "\n", $brainstorm_ideas ) : $brainstorm_ideas;
                $content .= "\n\n<h3>Brainstorm Ideas</h3>\n" . $ideas;
            }
            if ( $goal_evaluation ) {
                $content .= "\n\n<h3>Goal Evaluation</h3>\n" . $goal_evaluation;
            }
            
            if ( $dry_run ) {
                // For dry run, still track in goal_map with fake IDs
                self::$goal_map[ $old_goal->ID ] = 'preview_' . $old_goal->ID;
                error_log( "LEGACY IMPORT [DRY RUN]: Would create mp_goal from #{$old_goal->ID}: {$old_goal->post_title}" );
                self::$results['goals_imported']++;
                continue;
            }
            
            // Create new mp_goal
            $new_goal_id = wp_insert_post( array(
                'post_type'    => 'mp_goal',
                'post_title'   => $old_goal->post_title,
                'post_content' => $content,
                'post_status'  => $old_goal->post_status,
                'post_author'  => $mentee_id, // Mentee owns the goal
                'post_date'    => $old_goal->post_date,
            ) );
            
            if ( is_wp_error( $new_goal_id ) ) {
                self::$results['errors'][] = "Goal #{$old_goal->ID}: " . $new_goal_id->get_error_message();
                self::$results['goals_skipped']++;
                continue;
            }
            
            // Set meta fields
            update_post_meta( $new_goal_id, '_mentorship_id', $mentorship_id );
            update_post_meta( $new_goal_id, '_status', $status );
            update_post_meta( $new_goal_id, '_is_portfolio', true ); // PUBLIC BY DEFAULT
            
            // Store import reference for idempotency
            update_post_meta( $new_goal_id, '_legacy_import_type', 'leadership_goal' );
            update_post_meta( $new_goal_id, '_legacy_import_id', $old_goal->ID );
            
            self::$goal_map[ $old_goal->ID ] = $new_goal_id;
            self::$results['goals_imported']++;
            
            error_log( "LEGACY IMPORT: Created mp_goal #{$new_goal_id} from leadership_goal #{$old_goal->ID}" );
        }
    }
    
    /**
     * Import leadershiptask posts → mp_initiative
     */
    private static function import_initiatives( $dry_run ) {
        error_log( 'LEGACY IMPORT: Importing initiatives (tasks)...' );
        
        $old_tasks = get_posts( array(
            'post_type'      => 'leadershiptask',
            'posts_per_page' => -1,
            'post_status'    => array( 'publish', 'draft', 'private' ),
        ) );
        
        error_log( 'LEGACY IMPORT: Found ' . count( $old_tasks ) . ' leadershiptask posts' );
        
        foreach ( $old_tasks as $old_task ) {
            // Check if already imported
            $existing = self::find_imported_post( 'mp_initiative', $old_task->ID, 'leadershiptask' );
            if ( $existing ) {
                self::$initiative_map[ $old_task->ID ] = $existing->ID;
                self::$results['initiatives_skipped']++;
                continue;
            }
            
            // Get related goal - try multiple field names
            $old_goal_id = self::get_pods_post_id( $old_task->ID, 'related_goal' );
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_task->ID, 'goal' );
            }
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_task->ID, 'leadership_goal' );
            }
            
            $new_goal_id = isset( self::$goal_map[ $old_goal_id ] ) ? self::$goal_map[ $old_goal_id ] : null;
            
            if ( ! $new_goal_id ) {
                // Try to find it if it was imported previously
                $imported_goal = self::find_imported_post( 'mp_goal', $old_goal_id, 'leadership_goal' );
                if ( $imported_goal ) {
                    $new_goal_id = $imported_goal->ID;
                    self::$goal_map[ $old_goal_id ] = $new_goal_id;
                }
            }
            
            // Get task meta
            $task_completed = get_post_meta( $old_task->ID, 'task_completed', true );
            $task_evaluation = get_post_meta( $old_task->ID, 'task_evaluation', true );
            $candidate_id = self::get_pods_user_id( $old_task->ID, 'candidate' );
            
            // Get author info
            $author_user = get_user_by( 'id', $old_task->post_author );
            
            // Get goal title for preview
            $goal_title = $old_goal_id ? get_the_title( $old_goal_id ) : 'Unknown';
            
            // Build preview data
            $preview_item = array(
                'old_id'        => $old_task->ID,
                'title'         => $old_task->post_title,
                'status'        => $old_task->post_status,
                'date'          => $old_task->post_date,
                'author_id'     => $old_task->post_author,
                'author_name'   => $author_user ? $author_user->display_name : 'Unknown',
                'old_goal_id'   => $old_goal_id,
                'goal_title'    => $goal_title,
                'will_import'   => true,
                'error'         => null,
            );
            
            // Check for fake preview ID (from dry run goal import)
            $is_preview_goal = is_string( $new_goal_id ) && strpos( $new_goal_id, 'preview_' ) === 0;
            
            if ( ! $new_goal_id && ! $is_preview_goal ) {
                $preview_item['will_import'] = false;
                $preview_item['error'] = "No matching goal found (old goal: {$old_goal_id})";
                
                self::$results['errors'][] = "Task #{$old_task->ID} ({$old_task->post_title}): No matching goal found (old goal: {$old_goal_id}, title: {$goal_title})";
                self::$results['initiatives_skipped']++;
                
                if ( $dry_run ) {
                    self::$results['preview_data']['initiatives'][] = $preview_item;
                }
                continue;
            }
            
            // Add to preview data
            if ( $dry_run ) {
                self::$results['preview_data']['initiatives'][] = $preview_item;
            }
            
            // Determine status
            $status = $task_completed ? 'Completed' : 'In Progress';
            
            // Build content
            $content = $old_task->post_content;
            if ( $task_evaluation ) {
                $content .= "\n\n<h3>Task Evaluation</h3>\n" . $task_evaluation;
            }
            
            if ( $dry_run ) {
                self::$initiative_map[ $old_task->ID ] = 'preview_' . $old_task->ID;
                error_log( "LEGACY IMPORT [DRY RUN]: Would create mp_initiative from #{$old_task->ID}: {$old_task->post_title}" );
                self::$results['initiatives_imported']++;
                continue;
            }
            
            // Create new mp_initiative
            $new_initiative_id = wp_insert_post( array(
                'post_type'    => 'mp_initiative',
                'post_title'   => $old_task->post_title,
                'post_content' => $content,
                'post_status'  => $old_task->post_status,
                'post_author'  => $candidate_id ?: $old_task->post_author,
                'post_date'    => $old_task->post_date,
            ) );
            
            if ( is_wp_error( $new_initiative_id ) ) {
                self::$results['errors'][] = "Task #{$old_task->ID}: " . $new_initiative_id->get_error_message();
                self::$results['initiatives_skipped']++;
                continue;
            }
            
            // Set meta fields
            update_post_meta( $new_initiative_id, '_goal_id', $new_goal_id );
            update_post_meta( $new_initiative_id, '_status', $status );
            
            // Store import reference
            update_post_meta( $new_initiative_id, '_legacy_import_type', 'leadershiptask' );
            update_post_meta( $new_initiative_id, '_legacy_import_id', $old_task->ID );
            
            self::$initiative_map[ $old_task->ID ] = $new_initiative_id;
            self::$results['initiatives_imported']++;
            
            error_log( "LEGACY IMPORT: Created mp_initiative #{$new_initiative_id} from leadershiptask #{$old_task->ID}" );
        }
    }
    
    /**
     * Import leadership_meeting posts → mp_meeting
     */
    private static function import_meetings( $dry_run ) {
        error_log( 'LEGACY IMPORT: Importing meetings...' );
        
        $old_meetings = get_posts( array(
            'post_type'      => 'leadership_meeting',
            'posts_per_page' => -1,
            'post_status'    => array( 'publish', 'draft', 'private' ),
        ) );
        
        error_log( 'LEGACY IMPORT: Found ' . count( $old_meetings ) . ' leadership_meeting posts' );
        
        foreach ( $old_meetings as $old_meeting ) {
            // Check if already imported
            $existing = self::find_imported_post( 'mp_meeting', $old_meeting->ID, 'leadership_meeting' );
            if ( $existing ) {
                self::$meeting_map[ $old_meeting->ID ] = $existing->ID;
                self::$results['meetings_skipped']++;
                continue;
            }
            
            // Get related goal - try multiple field names
            $old_goal_id = self::get_pods_post_id( $old_meeting->ID, 'related_goal' );
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_meeting->ID, 'goal' );
            }
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_meeting->ID, 'leadership_goal' );
            }
            
            $new_goal_id = isset( self::$goal_map[ $old_goal_id ] ) ? self::$goal_map[ $old_goal_id ] : null;
            
            if ( ! $new_goal_id ) {
                $imported_goal = self::find_imported_post( 'mp_goal', $old_goal_id, 'leadership_goal' );
                if ( $imported_goal ) {
                    $new_goal_id = $imported_goal->ID;
                    self::$goal_map[ $old_goal_id ] = $new_goal_id;
                }
            }
            
            // Get meeting meta
            $action_items = get_post_meta( $old_meeting->ID, 'action_items_for_next_meeting', true );
            $candidate_id = self::get_pods_user_id( $old_meeting->ID, 'candidate' );
            
            // Get related initiative (task) if any
            $old_task_id = self::get_pods_post_id( $old_meeting->ID, 'related_task' );
            $new_initiative_id = isset( self::$initiative_map[ $old_task_id ] ) ? self::$initiative_map[ $old_task_id ] : null;
            
            // Get author info
            $author_user = get_user_by( 'id', $old_meeting->post_author );
            
            // Get goal title for preview
            $goal_title = $old_goal_id ? get_the_title( $old_goal_id ) : 'Unknown';
            
            // Build preview data
            $preview_item = array(
                'old_id'        => $old_meeting->ID,
                'title'         => $old_meeting->post_title,
                'status'        => $old_meeting->post_status,
                'date'          => $old_meeting->post_date,
                'author_id'     => $old_meeting->post_author,
                'author_name'   => $author_user ? $author_user->display_name : 'Unknown',
                'old_goal_id'   => $old_goal_id,
                'goal_title'    => $goal_title,
                'will_import'   => true,
                'error'         => null,
            );
            
            // Check for fake preview ID (from dry run goal import)
            $is_preview_goal = is_string( $new_goal_id ) && strpos( $new_goal_id, 'preview_' ) === 0;
            
            if ( ! $new_goal_id && ! $is_preview_goal ) {
                $preview_item['will_import'] = false;
                $preview_item['error'] = "No matching goal found (old goal: {$old_goal_id})";
                
                self::$results['errors'][] = "Meeting #{$old_meeting->ID} ({$old_meeting->post_title}): No matching goal found (old goal: {$old_goal_id}, title: {$goal_title})";
                self::$results['meetings_skipped']++;
                
                if ( $dry_run ) {
                    self::$results['preview_data']['meetings'][] = $preview_item;
                }
                continue;
            }
            
            // Add to preview data
            if ( $dry_run ) {
                self::$results['preview_data']['meetings'][] = $preview_item;
            }
            
            // Build content
            $content = $old_meeting->post_content;
            if ( $action_items ) {
                $content .= "\n\n<h3>Action Items for Next Meeting</h3>\n" . $action_items;
            }
            
            if ( $dry_run ) {
                self::$meeting_map[ $old_meeting->ID ] = 'preview_' . $old_meeting->ID;
                error_log( "LEGACY IMPORT [DRY RUN]: Would create mp_meeting from #{$old_meeting->ID}: {$old_meeting->post_title}" );
                self::$results['meetings_imported']++;
                continue;
            }
            
            // Create new mp_meeting
            $new_meeting_id = wp_insert_post( array(
                'post_type'    => 'mp_meeting',
                'post_title'   => $old_meeting->post_title,
                'post_content' => $content,
                'post_status'  => $old_meeting->post_status,
                'post_author'  => $candidate_id ?: $old_meeting->post_author,
                'post_date'    => $old_meeting->post_date,
            ) );
            
            if ( is_wp_error( $new_meeting_id ) ) {
                self::$results['errors'][] = "Meeting #{$old_meeting->ID}: " . $new_meeting_id->get_error_message();
                self::$results['meetings_skipped']++;
                continue;
            }
            
            // Set meta fields
            update_post_meta( $new_meeting_id, '_goal_id', $new_goal_id );
            update_post_meta( $new_meeting_id, '_meeting_date', $old_meeting->post_date ); // Use post date as meeting date
            
            if ( $new_initiative_id ) {
                update_post_meta( $new_meeting_id, '_initiative_id', $new_initiative_id );
            }
            
            // Store import reference
            update_post_meta( $new_meeting_id, '_legacy_import_type', 'leadership_meeting' );
            update_post_meta( $new_meeting_id, '_legacy_import_id', $old_meeting->ID );
            
            self::$meeting_map[ $old_meeting->ID ] = $new_meeting_id;
            self::$results['meetings_imported']++;
            
            error_log( "LEGACY IMPORT: Created mp_meeting #{$new_meeting_id} from leadership_meeting #{$old_meeting->ID}" );
        }
    }
    
    /**
     * Import leadership_update posts → mp_update
     */
    private static function import_updates( $dry_run ) {
        error_log( 'LEGACY IMPORT: Importing updates...' );
        
        $old_updates = get_posts( array(
            'post_type'      => 'leadership_update',
            'posts_per_page' => -1,
            'post_status'    => array( 'publish', 'draft', 'private' ),
        ) );
        
        error_log( 'LEGACY IMPORT: Found ' . count( $old_updates ) . ' leadership_update posts' );
        
        foreach ( $old_updates as $old_update ) {
            // Check if already imported
            $existing = self::find_imported_post( 'mp_update', $old_update->ID, 'leadership_update' );
            if ( $existing ) {
                self::$results['updates_skipped']++;
                continue;
            }
            
            // Get related goal - try multiple field names
            $old_goal_id = self::get_pods_post_id( $old_update->ID, 'related_goal' );
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_update->ID, 'goal' );
            }
            if ( ! $old_goal_id ) {
                $old_goal_id = self::get_pods_post_id( $old_update->ID, 'leadership_goal' );
            }
            
            $new_goal_id = isset( self::$goal_map[ $old_goal_id ] ) ? self::$goal_map[ $old_goal_id ] : null;
            
            if ( ! $new_goal_id ) {
                $imported_goal = self::find_imported_post( 'mp_goal', $old_goal_id, 'leadership_goal' );
                if ( $imported_goal ) {
                    $new_goal_id = $imported_goal->ID;
                    self::$goal_map[ $old_goal_id ] = $new_goal_id;
                }
            }
            
            // Get author info
            $author_user = get_user_by( 'id', $old_update->post_author );
            
            // Get goal title for preview
            $goal_title = $old_goal_id ? get_the_title( $old_goal_id ) : 'Unknown';
            
            // Build preview data
            $preview_item = array(
                'old_id'        => $old_update->ID,
                'title'         => $old_update->post_title,
                'status'        => $old_update->post_status,
                'date'          => $old_update->post_date,
                'author_id'     => $old_update->post_author,
                'author_name'   => $author_user ? $author_user->display_name : 'Unknown',
                'old_goal_id'   => $old_goal_id,
                'goal_title'    => $goal_title,
                'will_import'   => true,
                'error'         => null,
            );
            
            // Check for fake preview ID (from dry run goal import)
            $is_preview_goal = is_string( $new_goal_id ) && strpos( $new_goal_id, 'preview_' ) === 0;
            
            if ( ! $new_goal_id && ! $is_preview_goal ) {
                $preview_item['will_import'] = false;
                $preview_item['error'] = "No matching goal found (old goal: {$old_goal_id})";
                
                self::$results['errors'][] = "Update #{$old_update->ID} ({$old_update->post_title}): No matching goal found (old goal: {$old_goal_id}, title: {$goal_title})";
                self::$results['updates_skipped']++;
                
                if ( $dry_run ) {
                    self::$results['preview_data']['updates'][] = $preview_item;
                }
                continue;
            }
            
            // Add to preview data
            if ( $dry_run ) {
                self::$results['preview_data']['updates'][] = $preview_item;
            }
            
            if ( $dry_run ) {
                error_log( "LEGACY IMPORT [DRY RUN]: Would create mp_update from #{$old_update->ID}: {$old_update->post_title}" );
                self::$results['updates_imported']++;
                continue;
            }
            
            // Create new mp_update
            $new_update_id = wp_insert_post( array(
                'post_type'    => 'mp_update',
                'post_title'   => $old_update->post_title,
                'post_content' => $old_update->post_content,
                'post_status'  => $old_update->post_status,
                'post_author'  => $old_update->post_author,
                'post_date'    => $old_update->post_date,
            ) );
            
            if ( is_wp_error( $new_update_id ) ) {
                self::$results['errors'][] = "Update #{$old_update->ID}: " . $new_update_id->get_error_message();
                self::$results['updates_skipped']++;
                continue;
            }
            
            // Set meta fields
            update_post_meta( $new_update_id, '_goal_id', $new_goal_id );
            
            // Store import reference
            update_post_meta( $new_update_id, '_legacy_import_type', 'leadership_update' );
            update_post_meta( $new_update_id, '_legacy_import_id', $old_update->ID );
            
            self::$results['updates_imported']++;
            
            error_log( "LEGACY IMPORT: Created mp_update #{$new_update_id} from leadership_update #{$old_update->ID}" );
        }
    }
    
    /**
     * Get or create a mentorship (mp_request) for mentor/mentee pair
     */
    private static function get_or_create_mentorship( $mentor_id, $mentee_id, $dry_run ) {
        $key = "{$mentor_id}:{$mentee_id}";
        
        // Check cache
        if ( isset( self::$mentorship_map[ $key ] ) ) {
            return self::$mentorship_map[ $key ];
        }
        
        // Check if mentorship already exists
        $existing = get_posts( array(
            'post_type'      => 'mp_request',
            'post_status'    => array( 'publish', 'draft', 'private' ),
            'posts_per_page' => 1,
            'author'         => $mentee_id,
            'meta_query'     => array(
                array(
                    'key'   => '_receiver_id',
                    'value' => $mentor_id,
                ),
            ),
        ) );
        
        if ( ! empty( $existing ) ) {
            self::$mentorship_map[ $key ] = $existing[0]->ID;
            self::$results['mentorships_existing']++;
            return $existing[0]->ID;
        }
        
        if ( $dry_run ) {
            // Return a fake ID for dry run
            self::$results['mentorships_created']++;
            return 99999;
        }
        
        // Create new mentorship
        $mentor = get_user_by( 'id', $mentor_id );
        $mentee = get_user_by( 'id', $mentee_id );
        
        $mentor_name = $mentor ? $mentor->display_name : "User #{$mentor_id}";
        $mentee_name = $mentee ? $mentee->display_name : "User #{$mentee_id}";
        
        $mentorship_id = wp_insert_post( array(
            'post_type'    => 'mp_request',
            'post_title'   => "{$mentee_name} mentored by {$mentor_name}",
            'post_content' => "Imported from legacy leadership program.",
            'post_status'  => 'publish',
            'post_author'  => $mentee_id,
        ) );
        
        if ( is_wp_error( $mentorship_id ) ) {
            self::$results['errors'][] = "Mentorship creation failed: " . $mentorship_id->get_error_message();
            return null;
        }
        
        // Set mentor as receiver
        update_post_meta( $mentorship_id, '_receiver_id', $mentor_id );
        update_post_meta( $mentorship_id, '_status', 'Accepted' );
        update_post_meta( $mentorship_id, '_legacy_import', true );
        
        self::$mentorship_map[ $key ] = $mentorship_id;
        self::$results['mentorships_created']++;
        
        error_log( "LEGACY IMPORT: Created mp_request #{$mentorship_id} for mentor #{$mentor_id} / mentee #{$mentee_id}" );
        
        return $mentorship_id;
    }
    
    /**
     * Find an already-imported post by legacy ID
     */
    private static function find_imported_post( $post_type, $legacy_id, $legacy_type ) {
        if ( ! $legacy_id ) {
            return null;
        }
        
        $posts = get_posts( array(
            'post_type'      => $post_type,
            'posts_per_page' => 1,
            'post_status'    => 'any',
            'meta_query'     => array(
                'relation' => 'AND',
                array(
                    'key'   => '_legacy_import_type',
                    'value' => $legacy_type,
                ),
                array(
                    'key'   => '_legacy_import_id',
                    'value' => $legacy_id,
                ),
            ),
        ) );
        
        return ! empty( $posts ) ? $posts[0] : null;
    }
    
    /**
     * Get user ID from Pods relationship field
     */
    private static function get_pods_user_id( $post_id, $field_name ) {
        $value = get_post_meta( $post_id, $field_name, true );
        
        // Pods can store this as ID, array, or object
        if ( is_array( $value ) ) {
            // Could be array of IDs or array with 'ID' key
            if ( isset( $value['ID'] ) ) {
                return intval( $value['ID'] );
            }
            if ( isset( $value[0] ) ) {
                if ( is_array( $value[0] ) && isset( $value[0]['ID'] ) ) {
                    return intval( $value[0]['ID'] );
                }
                return intval( $value[0] );
            }
        }
        
        if ( is_object( $value ) && isset( $value->ID ) ) {
            return intval( $value->ID );
        }
        
        return intval( $value );
    }
    
    /**
     * Get post ID from Pods relationship field
     */
    private static function get_pods_post_id( $post_id, $field_name ) {
        $value = get_post_meta( $post_id, $field_name, true );
        
        // Pods can store this as ID, array, or object
        if ( is_array( $value ) ) {
            if ( isset( $value['ID'] ) ) {
                return intval( $value['ID'] );
            }
            if ( isset( $value[0] ) ) {
                if ( is_array( $value[0] ) && isset( $value[0]['ID'] ) ) {
                    return intval( $value[0]['ID'] );
                }
                return intval( $value[0] );
            }
        }
        
        if ( is_object( $value ) && isset( $value->ID ) ) {
            return intval( $value->ID );
        }
        
        return intval( $value );
    }
    
    /**
     * Get summary of legacy data before import
     */
    public static function get_legacy_summary() {
        $summary = array(
            'leadership_goal' => 0,
            'leadershiptask' => 0,
            'leadership_meeting' => 0,
            'leadership_update' => 0,
            'already_imported' => array(
                'mp_goal' => 0,
                'mp_initiative' => 0,
                'mp_meeting' => 0,
                'mp_update' => 0,
            ),
        );
        
        // Count legacy posts
        foreach ( array( 'leadership_goal', 'leadershiptask', 'leadership_meeting', 'leadership_update' ) as $post_type ) {
            $count = wp_count_posts( $post_type );
            if ( $count ) {
                $summary[ $post_type ] = $count->publish + $count->draft + $count->private;
            }
        }
        
        // Count already imported
        global $wpdb;
        foreach ( array( 'mp_goal', 'mp_initiative', 'mp_meeting', 'mp_update' ) as $post_type ) {
            $summary['already_imported'][ $post_type ] = $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} p 
                 INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id 
                 WHERE p.post_type = %s AND pm.meta_key = '_legacy_import_type'",
                $post_type
            ) );
        }
        
        return $summary;
    }
    
    /**
     * Rollback imported data (for testing)
     */
    public static function rollback_import() {
        global $wpdb;
        
        $deleted = array(
            'mp_request' => 0,
            'mp_goal' => 0,
            'mp_initiative' => 0,
            'mp_meeting' => 0,
            'mp_update' => 0,
        );
        
        foreach ( array_keys( $deleted ) as $post_type ) {
            $meta_key = $post_type === 'mp_request' ? '_legacy_import' : '_legacy_import_type';
            
            $posts = get_posts( array(
                'post_type'      => $post_type,
                'posts_per_page' => -1,
                'post_status'    => 'any',
                'meta_query'     => array(
                    array(
                        'key'     => $meta_key,
                        'compare' => 'EXISTS',
                    ),
                ),
            ) );
            
            foreach ( $posts as $post ) {
                wp_delete_post( $post->ID, true );
                $deleted[ $post_type ]++;
            }
        }
        
        error_log( 'LEGACY IMPORT: Rollback complete - ' . print_r( $deleted, true ) );
        
        return $deleted;
    }
    
    /**
     * Get detailed sample data from legacy posts for debugging
     * Shows raw meta fields to help identify the correct field names
     */
    public static function get_sample_data( $limit = 5 ) {
        $samples = array(
            'leadership_goal' => array(),
            'leadershiptask' => array(),
            'leadership_meeting' => array(),
            'leadership_update' => array(),
        );
        
        foreach ( array_keys( $samples ) as $post_type ) {
            $posts = get_posts( array(
                'post_type'      => $post_type,
                'posts_per_page' => $limit,
                'post_status'    => array( 'publish', 'draft', 'private' ),
            ) );
            
            foreach ( $posts as $post ) {
                $all_meta = get_post_meta( $post->ID );
                $author = get_user_by( 'id', $post->post_author );
                
                // Filter out internal meta
                $relevant_meta = array();
                foreach ( $all_meta as $key => $values ) {
                    // Skip internal WordPress meta
                    if ( strpos( $key, '_edit' ) === 0 || $key === '_encloseme' ) {
                        continue;
                    }
                    // Unserialize values
                    $relevant_meta[ $key ] = array_map( function( $v ) {
                        $unserialized = maybe_unserialize( $v );
                        return $unserialized;
                    }, $values );
                }
                
                $samples[ $post_type ][] = array(
                    'id'          => $post->ID,
                    'title'       => $post->post_title,
                    'status'      => $post->post_status,
                    'date'        => $post->post_date,
                    'author_id'   => $post->post_author,
                    'author_name' => $author ? $author->display_name : 'Unknown',
                    'meta_fields' => $relevant_meta,
                );
            }
        }
        
        return $samples;
    }
    
    /**
     * Get all unique meta keys used by legacy post types
     * Helps identify the correct field names for import
     */
    public static function get_meta_keys() {
        global $wpdb;
        
        $meta_keys = array();
        
        foreach ( array( 'leadership_goal', 'leadershiptask', 'leadership_meeting', 'leadership_update' ) as $post_type ) {
            $keys = $wpdb->get_col( $wpdb->prepare(
                "SELECT DISTINCT pm.meta_key 
                 FROM {$wpdb->postmeta} pm
                 INNER JOIN {$wpdb->posts} p ON pm.post_id = p.ID
                 WHERE p.post_type = %s
                 AND pm.meta_key NOT LIKE '\\_%%'
                 ORDER BY pm.meta_key",
                $post_type
            ) );
            
            $meta_keys[ $post_type ] = $keys;
        }
        
        return $meta_keys;
    }
}
