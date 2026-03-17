<?php
/**
 * New Hires Management Class
 * 
 * Handles new hire applications, approval workflow, and Letter of Intent generation
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AquaticPro_New_Hires {

    /**
     * Initialize the class
     */
    public static function init() {
        add_action( 'init', array( __CLASS__, 'create_tables' ) );
        add_action( 'init', array( __CLASS__, 'register_shortcode' ) );
    }

    /**
     * Create database tables
     */
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        $table_name = $wpdb->prefix . 'aquaticpro_new_hires';
        
        // Check if table exists
        if ( $wpdb->get_var( "SHOW TABLES LIKE '$table_name'" ) !== $table_name ) {
            $sql = "CREATE TABLE $table_name (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                first_name varchar(100) NOT NULL,
                last_name varchar(100) NOT NULL,
                email varchar(255) NOT NULL,
                phone varchar(50) DEFAULT '',
                date_of_birth date DEFAULT NULL,
                address text DEFAULT '',
                position varchar(100) NOT NULL,
                is_accepting tinyint(1) NOT NULL DEFAULT 1,
                needs_work_permit tinyint(1) NOT NULL DEFAULT 0,
                status varchar(20) NOT NULL DEFAULT 'pending',
                wp_user_id bigint(20) unsigned DEFAULT NULL,
                loi_sent tinyint(1) NOT NULL DEFAULT 0,
                loi_sent_date datetime DEFAULT NULL,
                notes text DEFAULT '',
                created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY email (email),
                KEY status (status),
                KEY needs_work_permit (needs_work_permit),
                KEY position (position)
            ) $charset_collate;";
            
            require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
            dbDelta( $sql );
        } else {
            // Migration: Add date_of_birth column if it doesn't exist
            $column_exists = $wpdb->get_results( "SHOW COLUMNS FROM $table_name LIKE 'date_of_birth'" );
            if ( empty( $column_exists ) ) {
                $wpdb->query( "ALTER TABLE $table_name ADD COLUMN date_of_birth date DEFAULT NULL AFTER phone" );
            }
            
            // Migration: Add is_archived column if it doesn't exist
            $archived_exists = $wpdb->get_results( "SHOW COLUMNS FROM $table_name LIKE 'is_archived'" );
            if ( empty( $archived_exists ) ) {
                $wpdb->query( "ALTER TABLE $table_name ADD COLUMN is_archived tinyint(1) NOT NULL DEFAULT 0 AFTER notes" );
                $wpdb->query( "ALTER TABLE $table_name ADD KEY is_archived (is_archived)" );
            }
            
            // Migration: Add loi_download_token column if it doesn't exist
            $token_exists = $wpdb->get_results( "SHOW COLUMNS FROM $table_name LIKE 'loi_download_token'" );
            if ( empty( $token_exists ) ) {
                $wpdb->query( "ALTER TABLE $table_name ADD COLUMN loi_download_token varchar(64) DEFAULT NULL AFTER loi_sent_date" );
            }
        }
    }

    /**
     * Register shortcode for public form
     */
    public static function register_shortcode() {
        add_shortcode( 'aquaticpro_new_hire_form', array( __CLASS__, 'render_shortcode' ) );
    }

    /**
     * Render shortcode - redirects to React app
     */
    public static function render_shortcode( $atts ) {
        return '<div id="aquaticpro-new-hire-form" data-form-type="new-hire"></div>';
    }

    /**
     * Submit a new hire application (public)
     */
    public static function submit_application( $data ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        
        // Validate required fields (position is now optional - assigned after approval)
        $required = array( 'first_name', 'last_name', 'email' );
        foreach ( $required as $field ) {
            if ( empty( $data[ $field ] ) ) {
                return new WP_Error( 'missing_field', "Missing required field: $field", array( 'status' => 400 ) );
            }
        }
        
        // Validate email
        if ( ! is_email( $data['email'] ) ) {
            return new WP_Error( 'invalid_email', 'Invalid email address', array( 'status' => 400 ) );
        }
        
        // Check for duplicate email in pending applications
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE email = %s AND status = 'pending'",
            sanitize_email( $data['email'] )
        ) );
        
        if ( $existing ) {
            return new WP_Error( 'duplicate', 'An application with this email is already pending', array( 'status' => 409 ) );
        }
        
        // Insert application
        $inserted = $wpdb->insert(
            $table,
            array(
                'first_name' => sanitize_text_field( $data['first_name'] ),
                'last_name' => sanitize_text_field( $data['last_name'] ),
                'email' => sanitize_email( $data['email'] ),
                'phone' => sanitize_text_field( $data['phone'] ?? '' ),
                'date_of_birth' => ! empty( $data['date_of_birth'] ) ? sanitize_text_field( $data['date_of_birth'] ) : null,
                'address' => sanitize_textarea_field( $data['address'] ?? '' ),
                'position' => sanitize_text_field( $data['position'] ?? '' ), // Optional - assigned after approval
                'is_accepting' => ! empty( $data['is_accepting'] ) ? 1 : 0,
                'needs_work_permit' => ! empty( $data['needs_work_permit'] ) ? 1 : 0,
                'status' => 'pending'
            ),
            array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s' )
        );
        
        if ( ! $inserted ) {
            return new WP_Error( 'db_error', 'Failed to save application', array( 'status' => 500 ) );
        }
        
        $id = $wpdb->insert_id;
        
        // Send notification email to admin
        self::send_admin_notification( $id );
        
        return array(
            'success' => true,
            'id' => $id,
            'message' => 'Application submitted successfully'
        );
    }

    /**
     * Get all new hire applications
     */
    public static function get_applications( $filters = array() ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        
        $where = array( '1=1' );
        $params = array();
        
        // Filter by status
        if ( ! empty( $filters['status'] ) ) {
            $where[] = 'status = %s';
            $params[] = $filters['status'];
        }
        
        // Filter by needs_work_permit
        if ( isset( $filters['needs_work_permit'] ) && $filters['needs_work_permit'] !== '' ) {
            $where[] = 'needs_work_permit = %d';
            $params[] = (int) $filters['needs_work_permit'];
        }
        
        // Filter by position
        if ( ! empty( $filters['position'] ) ) {
            $where[] = 'position = %s';
            $params[] = $filters['position'];
        }
        
        // Filter by LOI sent
        if ( isset( $filters['loi_sent'] ) && $filters['loi_sent'] !== '' ) {
            $where[] = 'loi_sent = %d';
            $params[] = (int) $filters['loi_sent'];
        }
        
        // Filter by archived status (default: show non-archived only)
        if ( isset( $filters['is_archived'] ) ) {
            if ( $filters['is_archived'] === 'all' ) {
                // Show all - no filter applied
            } else {
                $where[] = 'is_archived = %d';
                $params[] = (int) $filters['is_archived'];
            }
        } else {
            // Default: hide archived applications
            $where[] = 'is_archived = 0';
        }
        
        // Search
        if ( ! empty( $filters['search'] ) ) {
            $search = '%' . $wpdb->esc_like( $filters['search'] ) . '%';
            $where[] = '(first_name LIKE %s OR last_name LIKE %s OR email LIKE %s)';
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }
        
        $where_sql = implode( ' AND ', $where );
        $order = ! empty( $filters['order'] ) && strtoupper( $filters['order'] ) === 'ASC' ? 'ASC' : 'DESC';
        $orderby = ! empty( $filters['orderby'] ) ? sanitize_key( $filters['orderby'] ) : 'created_at';
        
        // Validate orderby column
        $allowed_orderby = array( 'id', 'first_name', 'last_name', 'email', 'position', 'status', 'created_at' );
        if ( ! in_array( $orderby, $allowed_orderby ) ) {
            $orderby = 'created_at';
        }
        
        $sql = "SELECT * FROM $table WHERE $where_sql ORDER BY $orderby $order";
        
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, $params );
        }
        
        $results = $wpdb->get_results( $sql, ARRAY_A );
        
        // Cast types
        foreach ( $results as &$row ) {
            $row['id'] = (int) $row['id'];
            $row['is_accepting'] = (bool) $row['is_accepting'];
            $row['needs_work_permit'] = (bool) $row['needs_work_permit'];
            $row['loi_sent'] = (bool) $row['loi_sent'];
            $row['is_archived'] = isset( $row['is_archived'] ) ? (bool) $row['is_archived'] : false;
            $row['wp_user_id'] = $row['wp_user_id'] ? (int) $row['wp_user_id'] : null;
        }
        
        return $results;
    }

    /**
     * Get a single application
     */
    public static function get_application( $id ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM $table WHERE id = %d",
            $id
        ), ARRAY_A );
        
        if ( ! $row ) {
            return null;
        }
        
        $row['id'] = (int) $row['id'];
        $row['is_accepting'] = (bool) $row['is_accepting'];
        $row['needs_work_permit'] = (bool) $row['needs_work_permit'];
        $row['loi_sent'] = (bool) $row['loi_sent'];
        $row['wp_user_id'] = $row['wp_user_id'] ? (int) $row['wp_user_id'] : null;
        
        return $row;
    }

    /**
     * Update application status
     * 
     * @param int $id Application ID
     * @param string $status New status (pending, approved, rejected)
     * @param string|null $notes Optional notes
     * @param bool $add_as_member Whether to add the user as a member when approved (default true)
     */
    public static function update_status( $id, $status, $notes = null, $add_as_member = true ) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        
        $valid_statuses = array( 'pending', 'approved', 'rejected' );
        if ( ! in_array( $status, $valid_statuses ) ) {
            return new WP_Error( 'invalid_status', 'Invalid status', array( 'status' => 400 ) );
        }
        
        $update_data = array( 'status' => $status );
        $update_format = array( '%s' );
        
        if ( $notes !== null ) {
            $update_data['notes'] = sanitize_textarea_field( $notes );
            $update_format[] = '%s';
        }
        
        $updated = $wpdb->update(
            $table,
            $update_data,
            array( 'id' => $id ),
            $update_format,
            array( '%d' )
        );
        
        if ( $updated === false ) {
            return new WP_Error( 'db_error', 'Failed to update status', array( 'status' => 500 ) );
        }
        
        // If approved, create WordPress user
        if ( $status === 'approved' ) {
            self::create_wp_user( $id, $add_as_member );
        }
        
        return array(
            'success' => true,
            'message' => "Application $status successfully"
        );
    }

    /**
     * Archive or unarchive applications
     */
    public static function archive_applications( $ids, $archive = true ) {
        global $wpdb;
        
        if ( empty( $ids ) || ! is_array( $ids ) ) {
            return new WP_Error( 'invalid_ids', 'No applications provided', array( 'status' => 400 ) );
        }
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
        $archive_value = $archive ? 1 : 0;
        
        $sql = $wpdb->prepare(
            "UPDATE $table SET is_archived = %d WHERE id IN ($placeholders)",
            array_merge( array( $archive_value ), $ids )
        );
        
        $updated = $wpdb->query( $sql );
        
        if ( $updated === false ) {
            return new WP_Error( 'db_error', 'Failed to update applications', array( 'status' => 500 ) );
        }
        
        $action = $archive ? 'archived' : 'unarchived';
        return array(
            'success' => true,
            'message' => "$updated application(s) $action successfully",
            'count' => $updated
        );
    }

    /**
     * Create WordPress user from approved application
     * 
     * @param int $application_id Application ID
     * @param bool $add_as_member Whether to add the user as a member (default true)
     */
    public static function create_wp_user( $application_id, $add_as_member = true ) {
        global $wpdb;
        
        $app = self::get_application( $application_id );
        if ( ! $app ) {
            return new WP_Error( 'not_found', 'Application not found' );
        }
        
        // Check if user already exists
        $existing_user = get_user_by( 'email', $app['email'] );
        if ( $existing_user ) {
            // Link existing user
            $wpdb->update(
                $wpdb->prefix . 'aquaticpro_new_hires',
                array( 'wp_user_id' => $existing_user->ID ),
                array( 'id' => $application_id ),
                array( '%d' ),
                array( '%d' )
            );
            
            // Add new hire meta
            update_user_meta( $existing_user->ID, 'aquaticpro_is_new_hire', 1 );
            update_user_meta( $existing_user->ID, 'aquaticpro_new_hire_date', current_time( 'mysql' ) );
            update_user_meta( $existing_user->ID, 'aquaticpro_needs_work_permit', $app['needs_work_permit'] );
            update_user_meta( $existing_user->ID, 'aquaticpro_position', $app['position'] );
            
            // Set member status in pg_user_metadata
            if ( $add_as_member ) {
                $metadata_table = $wpdb->prefix . 'pg_user_metadata';
                $existing_meta = $wpdb->get_row( $wpdb->prepare(
                    "SELECT id FROM $metadata_table WHERE user_id = %d",
                    $existing_user->ID
                ) );
                
                if ( $existing_meta ) {
                    $wpdb->update(
                        $metadata_table,
                        array( 'is_member' => 1 ),
                        array( 'user_id' => $existing_user->ID ),
                        array( '%d' ),
                        array( '%d' )
                    );
                } else {
                    $wpdb->insert(
                        $metadata_table,
                        array(
                            'user_id' => $existing_user->ID,
                            'is_member' => 1
                        ),
                        array( '%d', '%d' )
                    );
                }
            }
            
            return $existing_user->ID;
        }
        
        // Generate username from email
        $username = sanitize_user( current( explode( '@', $app['email'] ) ), true );
        
        // Ensure unique username
        $base_username = $username;
        $counter = 1;
        while ( username_exists( $username ) ) {
            $username = $base_username . $counter;
            $counter++;
        }
        
        // Generate password
        $password = wp_generate_password( 12, true );
        
        // Create user
        $user_id = wp_insert_user( array(
            'user_login' => $username,
            'user_pass' => $password,
            'user_email' => $app['email'],
            'first_name' => $app['first_name'],
            'last_name' => $app['last_name'],
            'display_name' => $app['first_name'] . ' ' . $app['last_name'],
            'role' => 'subscriber'
        ) );
        
        if ( is_wp_error( $user_id ) ) {
            return $user_id;
        }
        
        // Update application with user ID
        $wpdb->update(
            $wpdb->prefix . 'aquaticpro_new_hires',
            array( 'wp_user_id' => $user_id ),
            array( 'id' => $application_id ),
            array( '%d' ),
            array( '%d' )
        );
        
        // Add user meta
        update_user_meta( $user_id, 'aquaticpro_is_new_hire', 1 );
        update_user_meta( $user_id, 'aquaticpro_new_hire_date', current_time( 'mysql' ) );
        update_user_meta( $user_id, 'aquaticpro_needs_work_permit', $app['needs_work_permit'] );
        update_user_meta( $user_id, 'aquaticpro_position', $app['position'] );
        update_user_meta( $user_id, 'phone', $app['phone'] );
        update_user_meta( $user_id, 'address', $app['address'] );
        
        // Set member status in pg_user_metadata
        if ( $add_as_member ) {
            $metadata_table = $wpdb->prefix . 'pg_user_metadata';
            $wpdb->insert(
                $metadata_table,
                array(
                    'user_id' => $user_id,
                    'is_member' => 1
                ),
                array( '%d', '%d' )
            );
        }
        
        // Send welcome email with credentials
        self::send_welcome_email( $user_id, $username, $password );
        
        return $user_id;
    }

    /**
     * Send admin notification for new application
     * Sends to: admin email, users with selected roles, and specifically selected users
     */
    private static function send_admin_notification( $application_id ) {
        global $wpdb;
        
        $app = self::get_application( $application_id );
        if ( ! $app ) {
            error_log('[New Hires] send_admin_notification: Could not find application ' . $application_id);
            return;
        }
        
        $site_name = get_bloginfo( 'name' );
        $notification_roles = get_option( 'aquaticpro_new_hire_notification_roles', array() );
        $notification_users = get_option( 'aquaticpro_new_hire_notification_users', array() );
        
        // Build recipient list
        $recipients = array();
        
        // Always include admin email as primary fallback
        $admin_email = get_option( 'admin_email' );
        if ( ! empty( $admin_email ) ) {
            $recipients[] = $admin_email;
        }
        
        // Get users by plugin job role (from pg_user_job_assignments table)
        if ( ! empty( $notification_roles ) && is_array( $notification_roles ) ) {
            error_log('[New Hires] Notification roles from settings: ' . print_r($notification_roles, true));
            
            $assignments_table = $wpdb->prefix . 'pg_user_job_assignments';
            $users_table = $wpdb->base_prefix . 'users';
            
            // Check if table exists
            $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" );
            error_log('[New Hires] Assignments table exists: ' . ($table_exists ? 'yes' : 'no'));
            
            if ( $table_exists ) {
                // Convert role IDs to integers (they're stored as strings in the option)
                $role_ids = array_map( 'intval', $notification_roles );
                $role_ids = array_filter( $role_ids ); // Remove any zeros
                
                error_log('[New Hires] Converted role IDs: ' . print_r($role_ids, true));
                
                if ( ! empty( $role_ids ) ) {
                    $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
                    
                    // Get all users who have any of the selected job roles
                    $query = $wpdb->prepare(
                        "SELECT DISTINCT u.user_email 
                         FROM $assignments_table a 
                         INNER JOIN $users_table u ON a.user_id = u.ID 
                         WHERE a.job_role_id IN ($placeholders) 
                         AND u.user_email != ''",
                        ...$role_ids
                    );
                    
                    error_log('[New Hires] User query: ' . $query);
                    
                    $emails = $wpdb->get_col( $query );
                    error_log('[New Hires] Found ' . count($emails) . ' users by role: ' . implode(', ', $emails));
                    
                    if ( ! empty( $emails ) ) {
                        $recipients = array_merge( $recipients, $emails );
                    }
                    
                    if ( $wpdb->last_error ) {
                        error_log('[New Hires] Error fetching users by role: ' . $wpdb->last_error);
                    }
                } else {
                    error_log('[New Hires] No valid role IDs after conversion');
                }
            } else {
                error_log('[New Hires] pg_user_job_assignments table does not exist');
            }
        } else {
            error_log('[New Hires] No notification_roles configured or not an array');
        }
        
        // Add specifically selected users
        if ( ! empty( $notification_users ) && is_array( $notification_users ) ) {
            foreach ( $notification_users as $user_id ) {
                $user = get_userdata( $user_id );
                if ( $user && ! empty( $user->user_email ) ) {
                    $recipients[] = $user->user_email;
                }
            }
        }
        
        // Remove duplicates
        $recipients = array_unique( $recipients );
        
        if ( empty( $recipients ) ) {
            error_log('[New Hires] send_admin_notification: No recipients found for application ' . $application_id);
            return;
        }
        
        error_log('[New Hires] Sending notification for application ' . $application_id . ' to: ' . implode(', ', $recipients));
        
        $subject = "[{$site_name}] New Hire Application: {$app['first_name']} {$app['last_name']}";
        
        // Build formatted HTML email
        $headers = array( 'Content-Type: text/html; charset=UTF-8' );
        
        $date_of_birth = ! empty( $app['date_of_birth'] ) ? date( 'F j, Y', strtotime( $app['date_of_birth'] ) ) : 'Not provided';
        $submitted_date = date( 'F j, Y \a\t g:i A', strtotime( $app['created_at'] ) );
        
        $message = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333;">';
        $message .= '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">';
        
        // Header
        $message .= '<div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px 25px; border-radius: 10px 10px 0 0;">';
        $message .= '<h1 style="margin: 0; font-size: 22px; font-weight: 600;">📋 New Hire Application</h1>';
        $message .= '<p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Submitted on ' . esc_html( $submitted_date ) . '</p>';
        $message .= '</div>';
        
        // Body
        $message .= '<div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 25px; border-radius: 0 0 10px 10px;">';
        
        // Applicant name highlight
        $message .= '<div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">';
        $message .= '<h2 style="margin: 0; color: #1e40af; font-size: 20px;">' . esc_html( $app['first_name'] . ' ' . $app['last_name'] ) . '</h2>';
        $message .= '<p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">' . esc_html( $app['position'] ?: 'Position not specified' ) . '</p>';
        $message .= '</div>';
        
        // Details table
        $message .= '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
        
        $rows = array(
            array( '📧', 'Email', $app['email'] ),
            array( '📱', 'Phone', $app['phone'] ?: 'Not provided' ),
            array( '🎂', 'Date of Birth', $date_of_birth ),
            array( '📍', 'Address', $app['address'] ?: 'Not provided' ),
            array( '💼', 'Position', $app['position'] ?: 'Not specified' ),
            array( '✅', 'Accepting Employment', $app['is_accepting'] ? 'Yes' : 'No' ),
            array( '📋', 'Needs Work Permit', $app['needs_work_permit'] ? 'Yes' : 'No' ),
        );
        
        foreach ( $rows as $row ) {
            $message .= '<tr>';
            $message .= '<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 30px; vertical-align: top;">' . $row[0] . '</td>';
            $message .= '<td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 120px; vertical-align: top;">' . esc_html( $row[1] ) . '</td>';
            $message .= '<td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: #1e293b;">' . esc_html( $row[2] ) . '</td>';
            $message .= '</tr>';
        }
        
        $message .= '</table>';
        
        // Work permit alert
        if ( $app['needs_work_permit'] ) {
            $message .= '<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin-top: 20px;">';
            $message .= '<p style="margin: 0; color: #92400e; font-size: 14px;"><strong>⚠️ Work Permit Required</strong><br>This applicant needs a work permit. Consider sending them a Letter of Intent early so they can obtain their permit.</p>';
            $message .= '</div>';
        }
        
        // Action button
        $message .= '<div style="text-align: center; margin-top: 25px;">';
        $message .= '<a href="' . esc_url( admin_url( 'admin.php?page=mentorship-platform' ) ) . '" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Review Application</a>';
        $message .= '</div>';
        
        $message .= '</div>'; // End body
        $message .= '</div>'; // End container
        $message .= '</body></html>';
        
        // Send to each recipient
        foreach ( $recipients as $recipient ) {
            $sent = wp_mail( $recipient, $subject, $message, $headers );
            if ( ! $sent ) {
                error_log('[New Hires] Failed to send email to: ' . $recipient);
            }
        }
    }

    /**
     * Send welcome email to approved user
     */
    private static function send_welcome_email( $user_id, $username, $password ) {
        $user = get_userdata( $user_id );
        if ( ! $user ) return;
        
        $site_name = get_bloginfo( 'name' );
        $login_url = wp_login_url();
        
        $subject = "Welcome to {$site_name}!";
        
        $message = "Hello {$user->first_name},\n\n";
        $message .= "Your application has been approved! Welcome to the team.\n\n";
        $message .= "Your login credentials:\n";
        $message .= "Username: {$username}\n";
        $message .= "Password: {$password}\n\n";
        $message .= "Login here: {$login_url}\n\n";
        $message .= "Please change your password after logging in.\n\n";
        $message .= "Best regards,\n{$site_name}";
        
        wp_mail( $user->user_email, $subject, $message );
    }

    // =============================================
    // LETTER OF INTENT FUNCTIONS
    // =============================================

    /**
     * Get LOI settings
     */
    public static function get_loi_settings() {
        return array(
            'header_image' => get_option( 'aquaticpro_loi_header_image', '' ),
            'footer_image' => get_option( 'aquaticpro_loi_footer_image', '' ),
            'signature_image' => get_option( 'aquaticpro_loi_signature_image', '' ),
            'sender_name' => get_option( 'aquaticpro_loi_sender_name', '' ),
            'sender_title' => get_option( 'aquaticpro_loi_sender_title', '' ),
            'organization_name' => get_option( 'aquaticpro_loi_organization_name', get_bloginfo( 'name' ) ),
            'organization_address' => get_option( 'aquaticpro_loi_organization_address', '' ),
            'organization_phone' => get_option( 'aquaticpro_loi_organization_phone', '' ),
            'organization_email' => get_option( 'aquaticpro_loi_organization_email', get_option( 'admin_email' ) ),
            'template_body' => get_option( 'aquaticpro_loi_template_body', self::get_default_loi_template() ),
            'email_subject' => get_option( 'aquaticpro_loi_email_subject', 'Letter of Intent - {{job_roles}}' ),
            'email_body' => get_option( 'aquaticpro_loi_email_body', self::get_default_email_template() ),
            'notification_roles' => get_option( 'aquaticpro_new_hire_notification_roles', array() ),
            'notification_users' => get_option( 'aquaticpro_new_hire_notification_users', array() ),
        );
    }

    /**
     * Update LOI settings
     */
    public static function update_loi_settings( $settings ) {
        $allowed_keys = array(
            'header_image', 'footer_image', 'signature_image',
            'sender_name', 'sender_title',
            'organization_name', 'organization_address', 'organization_phone', 'organization_email',
            'template_body', 'email_subject', 'email_body'
        );
        
        foreach ( $allowed_keys as $key ) {
            if ( isset( $settings[ $key ] ) ) {
                update_option( 'aquaticpro_loi_' . $key, $settings[ $key ] );
            }
        }
        
        // Handle notification settings separately (they use different option names)
        if ( isset( $settings['notification_roles'] ) ) {
            $roles = is_array( $settings['notification_roles'] ) ? $settings['notification_roles'] : array();
            $roles = array_map( 'sanitize_text_field', $roles );
            update_option( 'aquaticpro_new_hire_notification_roles', $roles );
        }
        
        if ( isset( $settings['notification_users'] ) ) {
            $users = is_array( $settings['notification_users'] ) ? $settings['notification_users'] : array();
            $users = array_map( 'intval', $users );
            $users = array_filter( $users ); // Remove zeros
            update_option( 'aquaticpro_new_hire_notification_users', $users );
        }
        
        return self::get_loi_settings();
    }

    /**
     * Default LOI template
     */
    private static function get_default_loi_template() {
        return '{{current_date}}

{{employee_first_name}} {{employee_last_name}}
{{employee_address}}

Dear {{employee_first_name}},

This letter serves as a formal Letter of Intent to employ you in the following role(s): {{job_roles}} at {{organization_name}}.

Your employment is contingent upon the completion of all required paperwork, including but not limited to:
• Work permit (if applicable)
• Background check clearance
• Required certifications

We are excited to welcome you to our team and look forward to working with you.

If you have any questions, please contact us at {{organization_phone}} or {{organization_email}}.

Sincerely,

{{signature}}

{{sender_name}}
{{sender_title}}
{{organization_name}}';
    }

    /**
     * Default email template
     */
    private static function get_default_email_template() {
        return 'Hello {{employee_first_name}},

Please find attached your Letter of Intent for the {{job_roles}} position(s) at {{organization_name}}.

{{pay_breakdown}}

Please review the letter and keep it for your records. If you need a work permit, please provide this letter to your school counselor.

If you have any questions, please don\'t hesitate to reach out.

Best regards,
{{sender_name}}
{{organization_name}}';
    }

    /**
     * Get user's job roles as a formatted string
     */
    private static function get_user_job_roles_string( $user_id ) {
        if ( ! $user_id ) {
            return 'New Hire';
        }
        
        // Use the same method as seasonal returns to get job roles
        if ( class_exists( 'AquaticPro_Seasonal_Returns' ) ) {
            $roles = AquaticPro_Seasonal_Returns::get_user_job_roles( $user_id );
            if ( ! empty( $roles ) ) {
                return implode( ', ', array_column( $roles, 'title' ) );
            }
        }
        
        // Fallback: check user meta directly
        global $wpdb;
        $roles_table = $wpdb->prefix . 'pg_job_roles';
        
        // Check pg_job_roles meta (array of role IDs)
        $role_ids = get_user_meta( $user_id, 'pg_job_roles', true );
        if ( ! empty( $role_ids ) && is_array( $role_ids ) ) {
            $placeholders = implode( ',', array_fill( 0, count( $role_ids ), '%d' ) );
            $query = $wpdb->prepare(
                "SELECT title FROM $roles_table WHERE id IN ($placeholders) ORDER BY tier DESC",
                ...$role_ids
            );
            $titles = $wpdb->get_col( $query );
            if ( ! empty( $titles ) ) {
                return implode( ', ', $titles );
            }
        }
        
        return 'New Hire';
    }

    /**
     * Generate LOI content with placeholders replaced
     */
    public static function generate_loi_content( $application_id ) {
        $app = self::get_application( $application_id );
        if ( ! $app ) {
            return new WP_Error( 'not_found', 'Application not found' );
        }
        
        $settings = self::get_loi_settings();
        
        // Get job roles from WordPress user if they have been created
        $job_roles_string = 'New Hire (pending job role assignment)';
        if ( ! empty( $app['wp_user_id'] ) ) {
            $job_roles_string = self::get_user_job_roles_string( $app['wp_user_id'] );
        }
        
        // Get pay breakdown if user exists and seasonal returns class is available
        $pay_breakdown = null;
        if ( ! empty( $app['wp_user_id'] ) && class_exists( 'AquaticPro_Seasonal_Returns' ) ) {
            $pay_breakdown = AquaticPro_Seasonal_Returns::calculate_pay_rate( $app['wp_user_id'] );
        }
        
        // Format pay values
        $total_pay = isset( $pay_breakdown['total'] ) ? '$' . number_format( $pay_breakdown['total'], 2 ) : 'TBD';
        $base_rate = isset( $pay_breakdown['base_rate'] ) ? '$' . number_format( $pay_breakdown['base_rate'], 2 ) : 'TBD';
        $role_bonus = isset( $pay_breakdown['role_bonus']['amount'] ) && $pay_breakdown['role_bonus']['amount'] > 0 
            ? '$' . number_format( $pay_breakdown['role_bonus']['amount'], 2 ) . '/hr (' . $pay_breakdown['role_bonus']['role_name'] . ')' 
            : 'None';
        
        // Calculate additional bonuses (longevity + time bonuses)
        $additional_bonuses_amount = 0;
        $additional_bonuses_details = array();
        
        if ( isset( $pay_breakdown['longevity']['bonus'] ) && $pay_breakdown['longevity']['bonus'] > 0 ) {
            $additional_bonuses_amount += $pay_breakdown['longevity']['bonus'];
            $additional_bonuses_details[] = 'Longevity: $' . number_format( $pay_breakdown['longevity']['bonus'], 2 ) . '/hr (' . $pay_breakdown['longevity']['years'] . ' years)';
        }
        
        if ( isset( $pay_breakdown['time_bonus_total'] ) && $pay_breakdown['time_bonus_total'] > 0 ) {
            $additional_bonuses_amount += $pay_breakdown['time_bonus_total'];
            if ( ! empty( $pay_breakdown['time_bonuses'] ) ) {
                foreach ( $pay_breakdown['time_bonuses'] as $bonus ) {
                    $additional_bonuses_details[] = $bonus['name'] . ': $' . number_format( $bonus['amount'], 2 ) . '/hr';
                }
            } else {
                $additional_bonuses_details[] = 'Time Bonuses: $' . number_format( $pay_breakdown['time_bonus_total'], 2 ) . '/hr';
            }
        }
        
        $additional_bonuses = ! empty( $additional_bonuses_details ) 
            ? implode( ', ', $additional_bonuses_details ) 
            : 'None';
        
        // Build complete pay breakdown HTML
        $pay_breakdown_html = '<p><strong>Your Projected Pay Rate: ' . $total_pay . '/hr</strong></p>';
        
        if ( $pay_breakdown ) {
            $pay_breakdown_html .= '<p><strong>Pay Breakdown:</strong></p><ul>';
            $pay_breakdown_html .= '<li>Base Rate: ' . $base_rate . '/hr</li>';
            
            if ( isset( $pay_breakdown['role_bonus']['amount'] ) && $pay_breakdown['role_bonus']['amount'] > 0 ) {
                $pay_breakdown_html .= '<li>Job Role Bonus: ' . $role_bonus . '</li>';
            }
            
            if ( isset( $pay_breakdown['longevity']['bonus'] ) && $pay_breakdown['longevity']['bonus'] > 0 ) {
                $pay_breakdown_html .= '<li>Longevity Bonus: $' . number_format( $pay_breakdown['longevity']['bonus'], 2 ) . '/hr (' . $pay_breakdown['longevity']['years'] . ' years)</li>';
            }
            
            if ( ! empty( $pay_breakdown['time_bonuses'] ) ) {
                foreach ( $pay_breakdown['time_bonuses'] as $bonus ) {
                    $pay_breakdown_html .= '<li>' . htmlspecialchars( $bonus['name'] ) . ': $' . number_format( $bonus['amount'], 2 ) . '/hr</li>';
                }
            }
            
            $pay_breakdown_html .= '</ul>';
        } else {
            $pay_breakdown_html .= '<p><em>Pay rate details will be provided after job role assignment.</em></p>';
        }
        
        $placeholders = array(
            '{{current_date}}' => date( 'F j, Y' ),
            '{{employee_first_name}}' => $app['first_name'],
            '{{employee_last_name}}' => $app['last_name'],
            '{{employee_full_name}}' => $app['first_name'] . ' ' . $app['last_name'],
            '{{employee_email}}' => $app['email'],
            '{{employee_phone}}' => $app['phone'],
            '{{employee_dob}}' => ! empty( $app['date_of_birth'] ) ? date( 'F j, Y', strtotime( $app['date_of_birth'] ) ) : '',
            '{{employee_address}}' => $app['address'],
            '{{job_roles}}' => $job_roles_string,
            '{{position}}' => $job_roles_string, // Alias for backwards compatibility
            '{{organization_name}}' => $settings['organization_name'],
            '{{organization_address}}' => $settings['organization_address'],
            '{{organization_phone}}' => $settings['organization_phone'],
            '{{organization_email}}' => $settings['organization_email'],
            '{{sender_name}}' => $settings['sender_name'],
            '{{sender_title}}' => $settings['sender_title'],
            '{{signature}}' => '{{signature}}', // Keep placeholder - will be replaced with image in PDF/preview
            '{{total_pay_rate}}' => $total_pay,
            '{{base_rate}}' => $base_rate,
            '{{role_bonus}}' => $role_bonus,
            '{{additional_bonuses}}' => $additional_bonuses,
            '{{pay_breakdown}}' => $pay_breakdown_html
        );
        
        $content = str_replace( array_keys( $placeholders ), array_values( $placeholders ), $settings['template_body'] );
        
        return array(
            'content' => $content,
            'settings' => $settings,
            'application' => $app,
            'placeholders' => $placeholders,
            'pay_breakdown' => $pay_breakdown
        );
    }

    /**
     * Generate PDF of Letter of Intent
     * Returns HTML and generates PDF file
     */
    public static function generate_loi_pdf( $application_id ) {
        $loi_data = self::generate_loi_content( $application_id );
        
        if ( is_wp_error( $loi_data ) ) {
            return $loi_data;
        }
        
        $settings = $loi_data['settings'];
        $app = $loi_data['application'];
        $content = $loi_data['content'];
        
        // Build HTML for PDF with embedded images
        // Using normal document flow (not fixed positioning) to avoid overlap
        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        /* Page setup */
        @page {
            margin: 0;
            size: letter;
        }
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            margin: 0;
            padding: 0;
        }
        /* Header - constrained to standard letterhead height (about 1 inch) */
        .header {
            text-align: center;
            max-height: 1in;
            overflow: hidden;
            margin-bottom: 0.25in;
        }
        .header img {
            max-width: 100%;
            max-height: 1in;
            height: auto;
            display: inline-block;
        }
        /* Content area - main letter body with proper margins */
        .content {
            padding: 0 0.75in;
            min-height: 8in;
        }
        .content p {
            margin: 0 0 0.8em 0;
        }
        .content br {
            display: block;
            content: "";
            margin-top: 0;
        }
        .signature {
            margin: 20px 0;
        }
        .signature img {
            max-height: 80px;
            max-width: 300px;
            display: block;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
        }
        /* Footer - constrained to standard footer height (about 1 inch) */
        .footer {
            text-align: center;
            max-height: 1in;
            overflow: hidden;
            margin-top: 0.25in;
        }
        .footer img {
            max-width: 100%;
            max-height: 1in;
            height: auto;
            display: inline-block;
        }
    </style>
</head>
<body>';

        // Header - at top, constrained height
        if ( ! empty( $settings['header_image'] ) ) {
            $html .= '<div class="header"><img src="' . esc_url( $settings['header_image'] ) . '" alt="Header"></div>';
        }
        
        // Content - DON'T escape HTML since pay_breakdown contains HTML formatting
        // Instead, we need to be selective about what we escape
        $content_html = $content;
        
        // Normalize line breaks
        $content_html = str_replace( "\r\n", "\n", $content_html );
        $content_html = str_replace( "\r", "\n", $content_html );
        
        // Only add nl2br if the content doesn't already have HTML tags
        if ( strpos( $content_html, '<p>' ) === false && strpos( $content_html, '<ul>' ) === false ) {
            // Escape HTML first, then convert newlines to <br>
            $content_html = esc_html( $content_html );
            // Convert double newlines to paragraph breaks
            $content_html = preg_replace( '/\n\n+/', '</p><p>', $content_html );
            // Convert single newlines to <br>
            $content_html = nl2br( $content_html );
            // Wrap in paragraph tags
            $content_html = '<p>' . $content_html . '</p>';
            // Clean up any empty paragraphs
            $content_html = str_replace( '<p></p>', '', $content_html );
            $content_html = str_replace( '<p><br />', '<p>', $content_html );
        }
        
        if ( ! empty( $settings['signature_image'] ) ) {
            $signature_html = '<div class="signature"><img src="' . esc_url( $settings['signature_image'] ) . '" alt="Signature" style="max-height: 80px; max-width: 300px; display: block;"></div>';
            $content_html = str_replace( '{{signature}}', $signature_html, $content_html );
            $content_html = str_replace( esc_html( '{{signature}}' ), $signature_html, $content_html );
        }
        
        $html .= '<div class="content">' . $content_html . '</div>';
        
        // Footer
        if ( ! empty( $settings['footer_image'] ) ) {
            $html .= '<div class="footer"><img src="' . esc_url( $settings['footer_image'] ) . '" alt="Footer"></div>';
        }
        
        $html .= '</body></html>';
        
        return array(
            'html' => $html,
            'filename' => 'LOI_' . sanitize_file_name( $app['last_name'] . '_' . $app['first_name'] ) . '.html',
            'application' => $app
        );
    }

    /**
     * Send LOI email
     */
    public static function send_loi_email( $application_id ) {
        global $wpdb;
        
        $loi_data = self::generate_loi_content( $application_id );
        
        if ( is_wp_error( $loi_data ) ) {
            return $loi_data;
        }
        
        $settings = $loi_data['settings'];
        $app = $loi_data['application'];
        $placeholders = $loi_data['placeholders'];
        
        // Generate email content
        $subject = str_replace( array_keys( $placeholders ), array_values( $placeholders ), $settings['email_subject'] );
        $body = str_replace( array_keys( $placeholders ), array_values( $placeholders ), $settings['email_body'] );
        
        // Generate secure download token and save the LOI HTML
        $token = self::generate_loi_download_token( $application_id );
        
        if ( is_wp_error( $token ) ) {
            return $token;
        }
        
        // Build the download URL
        $download_url = add_query_arg( array(
            'loi_download' => $token,
            'app_id' => $application_id,
        ), home_url( '/' ) );
        
        // Set content type for HTML email
        $headers = array( 'Content-Type: text/html; charset=UTF-8' );
        
        // Format email body as HTML with download link
        $body_html = '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">';
        $body_html .= nl2br( $body ); // Don't escape - body may contain HTML from pay_breakdown
        $body_html .= '<br><br>';
        $body_html .= '<div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">';
        $body_html .= '<p style="margin: 0 0 15px 0; font-size: 16px;"><strong>📄 Your Letter of Intent</strong></p>';
        $body_html .= '<a href="' . esc_url( $download_url ) . '" style="display: inline-block; background: #0073aa; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View & Download Your Letter</a>';
        $body_html .= '<p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">Click the button above to view your Letter of Intent. You can print it or save it as a PDF from your browser.</p>';
        $body_html .= '</div>';
        $body_html .= '</body></html>';
        
        // Debug logging
        error_log( 'LOI Email - To: ' . $app['email'] );
        error_log( 'LOI Email - Subject: ' . $subject );
        error_log( 'LOI Email - Download URL: ' . $download_url );
        
        // Add action to catch phpmailer errors
        add_action( 'wp_mail_failed', function( $wp_error ) {
            error_log( 'LOI Email - PHPMailer Error: ' . $wp_error->get_error_message() );
        } );
        
        $sent = wp_mail( $app['email'], $subject, $body_html, $headers );
        
        // Log email result
        error_log( 'LOI Email - Send result: ' . ( $sent ? 'SUCCESS' : 'FAILED' ) );
        
        if ( $sent ) {
            // Update application record
            $wpdb->update(
                $wpdb->prefix . 'aquaticpro_new_hires',
                array(
                    'loi_sent' => 1,
                    'loi_sent_date' => current_time( 'mysql' ),
                    'loi_download_token' => $token,
                ),
                array( 'id' => $application_id ),
                array( '%d', '%s', '%s' ),
                array( '%d' )
            );
            
            return array(
                'success' => true,
                'message' => 'Letter of Intent sent successfully with download link',
                'download_url' => $download_url,
            );
        } else {
            return new WP_Error( 'email_failed', 'Failed to send email', array( 'status' => 500 ) );
        }
    }
    
    /**
     * Generate a secure download token for LOI
     */
    private static function generate_loi_download_token( $application_id ) {
        // Generate a secure random token
        $token = wp_generate_password( 32, false );
        
        // Store the token with expiration (30 days)
        set_transient( 'loi_download_' . $token, array(
            'application_id' => $application_id,
            'created' => time(),
        ), 30 * DAY_IN_SECONDS );
        
        return $token;
    }
    
    /**
     * Validate and serve LOI download
     */
    public static function serve_loi_download( $token, $app_id ) {
        // Validate token
        $token_data = get_transient( 'loi_download_' . $token );
        
        if ( ! $token_data || $token_data['application_id'] != $app_id ) {
            return new WP_Error( 'invalid_token', 'Invalid or expired download link', array( 'status' => 403 ) );
        }
        
        // Generate the LOI HTML
        $pdf_data = self::generate_loi_pdf( $app_id );
        
        if ( is_wp_error( $pdf_data ) ) {
            return $pdf_data;
        }
        
        return array(
            'html' => $pdf_data['html'],
            'filename' => $pdf_data['filename'],
            'application' => $pdf_data['application'],
        );
    }

    /**
     * Get statistics
     */
    public static function get_stats() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'aquaticpro_new_hires';
        
        return array(
            'total' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" ),
            'pending' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE status = 'pending'" ),
            'approved' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE status = 'approved'" ),
            'rejected' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE status = 'rejected'" ),
            'needs_work_permit' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE needs_work_permit = 1" ),
            'loi_pending' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE needs_work_permit = 1 AND loi_sent = 0" ),
            'positions' => $wpdb->get_results( 
                "SELECT position, COUNT(*) as count FROM $table GROUP BY position ORDER BY count DESC", 
                ARRAY_A 
            )
        );
    }
}

// Initialize
AquaticPro_New_Hires::init();
