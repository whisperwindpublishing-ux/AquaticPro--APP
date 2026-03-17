<?php
/**
 * TaskDeck Module - Self-hosted Kanban board functionality
 *
 * @package AquaticPro
 * @subpackage TaskDeck
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

/**
 * Class AquaticPro_TaskDeck
 *
 * Main class for the TaskDeck module providing Kanban board functionality
 */
class AquaticPro_TaskDeck {

    /**
     * Database table names
     */
    private $table_decks;
    private $table_lists;
    private $table_cards;
    private $table_comments;
    private $table_comment_reactions;
    private $table_attachments;
    private $table_checklists;
    private $table_activity_log;

    /**
     * Constructor
     */
    public function __construct() {
        global $wpdb;
        
        // Initialize table names with plugin prefix
        $this->table_decks = $wpdb->prefix . 'aqp_taskdecks';
        $this->table_lists = $wpdb->prefix . 'aqp_tasklists';
        $this->table_cards = $wpdb->prefix . 'aqp_taskcards';
        $this->table_comments = $wpdb->prefix . 'aqp_card_comments';
        $this->table_comment_reactions = $wpdb->prefix . 'aqp_unified_reactions';
        $this->table_attachments = $wpdb->prefix . 'aqp_card_attachments';
        $this->table_checklists = $wpdb->prefix . 'aqp_card_checklists';
        $this->table_activity_log = $wpdb->prefix . 'aqp_activity_log';

        // Register hooks
        $this->register_hooks();
    }

    /**
     * Register WordPress hooks
     */
    private function register_hooks() {
        // Only initialize if module is enabled
        if ( ! $this->is_module_enabled() ) {
            return;
        }

        // Admin menu
        add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );

        // AJAX hooks for legacy admin-ajax.php support
        add_action( 'wp_ajax_aqp_taskdeck_action', array( $this, 'handle_ajax_request' ) );
    }

    /**
     * Check if TaskDeck module is enabled
     *
     * @return bool
     */
    public function is_module_enabled() {
        return (bool) get_option( 'aquaticpro_enable_taskdeck', false );
    }

    /**
     * Create database tables
     * Called during plugin activation or when module is enabled
     */
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );

        // Task Decks Table
        $table_decks = $wpdb->prefix . 'aqp_taskdecks';
        $sql_decks = "CREATE TABLE $table_decks (
            deck_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            deck_name varchar(255) NOT NULL,
            deck_description text,
            created_by bigint(20) UNSIGNED NOT NULL,
            is_public tinyint(1) NOT NULL DEFAULT 0,
            is_primary tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_archived tinyint(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (deck_id),
            KEY created_by (created_by),
            KEY is_archived (is_archived),
            KEY is_public (is_public),
            KEY is_primary (is_primary)
        ) $charset_collate;";

        // Task Lists Table (Columns)
        $table_lists = $wpdb->prefix . 'aqp_tasklists';
        $sql_lists = "CREATE TABLE $table_lists (
            list_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            deck_id bigint(20) UNSIGNED NOT NULL,
            list_name varchar(255) NOT NULL,
            sort_order int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (list_id),
            KEY deck_id (deck_id),
            KEY sort_order (sort_order)
        ) $charset_collate;";

        // Task Cards Table
        $table_cards = $wpdb->prefix . 'aqp_taskcards';
        $sql_cards = "CREATE TABLE $table_cards (
            card_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            list_id bigint(20) UNSIGNED NOT NULL,
            title varchar(500) NOT NULL,
            description text,
            created_by bigint(20) UNSIGNED NOT NULL,
            assigned_to bigint(20) UNSIGNED DEFAULT NULL,
            assigned_to_role_id bigint(20) UNSIGNED DEFAULT NULL,
            location_id bigint(20) UNSIGNED DEFAULT NULL,
            due_date datetime DEFAULT NULL,
            category_tag varchar(100) DEFAULT NULL,
            accent_color varchar(7) DEFAULT NULL,
            is_complete tinyint(1) NOT NULL DEFAULT 0,
            sort_order int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (card_id),
            KEY list_id (list_id),
            KEY created_by (created_by),
            KEY assigned_to (assigned_to),
            KEY assigned_to_role_id (assigned_to_role_id),
            KEY location_id (location_id),
            KEY sort_order (sort_order),
            KEY is_complete (is_complete)
        ) $charset_collate;";

        // Card Comments Table
        $table_comments = $wpdb->prefix . 'aqp_card_comments';
        $sql_comments = "CREATE TABLE $table_comments (
            comment_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            card_id bigint(20) UNSIGNED NOT NULL,
            user_id bigint(20) UNSIGNED NOT NULL,
            comment_text text NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (comment_id),
            KEY card_id (card_id),
            KEY user_id (user_id)
        ) $charset_collate;";

        // Card Comment Reactions Table
        $table_comment_reactions = $wpdb->prefix . 'aqp_card_comment_reactions';
        $sql_comment_reactions = "CREATE TABLE $table_comment_reactions (
            id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            comment_id bigint(20) UNSIGNED NOT NULL,
            user_id bigint(20) UNSIGNED NOT NULL,
            reaction_type varchar(20) NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY unique_user_comment (user_id, comment_id),
            KEY idx_comment (comment_id),
            KEY idx_user (user_id)
        ) $charset_collate;";

        // Card Attachments Table
        $table_attachments = $wpdb->prefix . 'aqp_card_attachments';
        $sql_attachments = "CREATE TABLE $table_attachments (
            attachment_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            card_id bigint(20) UNSIGNED NOT NULL,
            user_id bigint(20) UNSIGNED NOT NULL,
            file_name varchar(255) NOT NULL,
            wp_attachment_id bigint(20) UNSIGNED NOT NULL,
            uploaded_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (attachment_id),
            KEY card_id (card_id),
            KEY user_id (user_id),
            KEY wp_attachment_id (wp_attachment_id)
        ) $charset_collate;";

        // Card Checklists Table
        $table_checklists = $wpdb->prefix . 'aqp_card_checklists';
        $sql_checklists = "CREATE TABLE $table_checklists (
            checklist_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            card_id bigint(20) UNSIGNED NOT NULL,
            item_text varchar(500) NOT NULL,
            is_complete tinyint(1) NOT NULL DEFAULT 0,
            sort_order int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (checklist_id),
            KEY card_id (card_id),
            KEY sort_order (sort_order)
        ) $charset_collate;";

        // Activity Log Table
        $table_activity_log = $wpdb->prefix . 'aqp_activity_log';
        $sql_activity = "CREATE TABLE $table_activity_log (
            log_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            card_id bigint(20) UNSIGNED NOT NULL,
            user_id bigint(20) UNSIGNED NOT NULL,
            action varchar(500) NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (log_id),
            KEY card_id (card_id),
            KEY user_id (user_id),
            KEY created_at (created_at)
        ) $charset_collate;";

        // Execute table creation
        dbDelta( $sql_decks );
        dbDelta( $sql_lists );
        dbDelta( $sql_cards );
        dbDelta( $sql_comments );
        dbDelta( $sql_comment_reactions );
        dbDelta( $sql_attachments );
        dbDelta( $sql_checklists );
        dbDelta( $sql_activity );
    }

    /**
     * Register admin menu
     */
    public function register_admin_menu() {
        // Create top-level "Operations" menu
        add_menu_page(
            __( 'Operations', 'aquaticpro' ),
            __( 'Operations', 'aquaticpro' ),
            'read', // Minimal capability - actual permissions checked in submenu
            'aquaticpro-operations',
            array( $this, 'render_operations_redirect' ),
            'dashicons-portfolio',
            30
        );

        // Add TaskDeck as first submenu item under Operations
        add_submenu_page(
            'aquaticpro-operations',
            __( 'TaskDeck', 'aquaticpro' ),
            __( 'TaskDeck', 'aquaticpro' ),
            'read', // Minimal capability - actual permissions checked in render function
            'aquaticpro-taskdeck',
            array( $this, 'render_taskdeck_page' )
        );

        // Remove the duplicate "Operations" submenu item
        remove_submenu_page( 'aquaticpro-operations', 'aquaticpro-operations' );
    }

    /**
     * Redirect function for Operations parent menu
     */
    public function render_operations_redirect() {
        wp_redirect( admin_url( 'admin.php?page=aquaticpro-taskdeck' ) );
        exit;
    }

    /**
     * Render TaskDeck page
     */
    public function render_taskdeck_page() {
        if ( ! current_user_can( 'aqp_view_own_drills' ) && ! current_user_can( 'manage_options' ) ) {
            wp_die( __( 'You do not have sufficient permissions to access this page.', 'aquaticpro' ) );
        }

        // This page will be handled by the React app via shortcode
        echo '<div id="aquaticpro-taskdeck-root"></div>';
        echo do_shortcode( '[aquaticpro_app]' );
    }

    /**
     * Handle AJAX requests (legacy support)
     */
    public function handle_ajax_request() {
        check_ajax_referer( 'wp_rest', 'nonce' );

        if ( ! current_user_can( 'aqp_view_own_drills' ) ) {
            wp_send_json_error( array( 'message' => 'Insufficient permissions' ) );
        }

        $action = isset( $_POST['taskdeck_action'] ) ? sanitize_text_field( $_POST['taskdeck_action'] ) : '';

        // Route to appropriate handler
        switch ( $action ) {
            case 'move_card':
                $this->ajax_move_card();
                break;
            default:
                wp_send_json_error( array( 'message' => 'Invalid action' ) );
        }
    }

    /**
     * AJAX handler for moving cards
     */
    private function ajax_move_card() {
        global $wpdb;

        if ( ! current_user_can( 'aqp_edit_inservices' ) ) {
            wp_send_json_error( array( 'message' => 'Insufficient permissions to move cards' ) );
        }

        $card_id = isset( $_POST['card_id'] ) ? absint( $_POST['card_id'] ) : 0;
        $new_list_id = isset( $_POST['list_id'] ) ? absint( $_POST['list_id'] ) : 0;
        $new_sort_order = isset( $_POST['sort_order'] ) ? absint( $_POST['sort_order'] ) : 0;

        if ( ! $card_id || ! $new_list_id ) {
            wp_send_json_error( array( 'message' => 'Invalid card or list ID' ) );
        }

        // Get card info for activity log
        $card = $wpdb->get_row( $wpdb->prepare(
            "SELECT c.*, l.list_name as old_list_name FROM {$this->table_cards} c 
             LEFT JOIN {$this->table_lists} l ON c.list_id = l.list_id 
             WHERE c.card_id = %d",
            $card_id
        ) );

        if ( ! $card ) {
            wp_send_json_error( array( 'message' => 'Card not found' ) );
        }

        // Get new list name
        $new_list = $wpdb->get_row( $wpdb->prepare(
            "SELECT list_name FROM {$this->table_lists} WHERE list_id = %d",
            $new_list_id
        ) );

        // Update card
        $updated = $wpdb->update(
            $this->table_cards,
            array(
                'list_id' => $new_list_id,
                'sort_order' => $new_sort_order
            ),
            array( 'card_id' => $card_id ),
            array( '%d', '%d' ),
            array( '%d' )
        );

        if ( $updated === false ) {
            wp_send_json_error( array( 'message' => 'Failed to update card' ) );
        }

        // Log activity if list changed
        if ( $card->list_id != $new_list_id && $new_list ) {
            $this->log_activity(
                $card_id,
                get_current_user_id(),
                sprintf( 'Card moved from "%s" to "%s"', $card->old_list_name, $new_list->list_name )
            );
        }

        wp_send_json_success( array( 'message' => 'Card moved successfully' ) );
    }

    /**
     * Log activity for a card
     *
     * @param int $card_id Card ID
     * @param int $user_id User ID
     * @param string $action Action description
     * @return bool|int Insert ID on success, false on failure
     */
    public function log_activity( $card_id, $user_id, $action ) {
        global $wpdb;

        return $wpdb->insert(
            $this->table_activity_log,
            array(
                'card_id' => $card_id,
                'user_id' => $user_id,
                'action' => $action,
                'created_at' => current_time( 'mysql' )
            ),
            array( '%d', '%d', '%s', '%s' )
        );
    }

    /**
     * Check if user can view deck
     *
     * @param int $deck_id Deck ID
     * @param int $user_id User ID
     * @return bool
     */
    public function user_can_view_deck( $deck_id, $user_id ) {
        global $wpdb;

        // Admins and those with view_all_audits can see everything
        if ( current_user_can( 'aqp_view_all_audits' ) || current_user_can( 'manage_options' ) ) {
            return true;
        }

        // Check if user created the deck
        $deck = $wpdb->get_row( $wpdb->prepare(
            "SELECT created_by FROM {$this->table_decks} WHERE deck_id = %d",
            $deck_id
        ) );

        if ( $deck && $deck->created_by == $user_id ) {
            return true;
        }

        // Check if user has any cards assigned in this deck
        $assigned_count = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->table_cards} c
             INNER JOIN {$this->table_lists} l ON c.list_id = l.list_id
             WHERE l.deck_id = %d AND c.assigned_to = %d",
            $deck_id,
            $user_id
        ) );

        return $assigned_count > 0;
    }

    /**
     * Get table name for a specific table type
     *
     * @param string $table_type Type of table (decks, lists, cards, etc.)
     * @return string
     */
    public function get_table_name( $table_type ) {
        $tables = array(
            'decks' => $this->table_decks,
            'lists' => $this->table_lists,
            'cards' => $this->table_cards,
            'comments' => $this->table_comments,
            'attachments' => $this->table_attachments,
            'checklists' => $this->table_checklists,
            'activity_log' => $this->table_activity_log,
        );

        return isset( $tables[ $table_type ] ) ? $tables[ $table_type ] : '';
    }
}

// Initialize the TaskDeck module
function aquaticpro_taskdeck_init() {
    global $aquaticpro_taskdeck;
    $aquaticpro_taskdeck = new AquaticPro_TaskDeck();
}
add_action( 'plugins_loaded', 'aquaticpro_taskdeck_init' );
