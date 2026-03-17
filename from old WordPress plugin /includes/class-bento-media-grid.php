<?php
/**
 * Bento Media Grid Module
 * 
 * A beautiful bento-style media grid with Framer Motion animations and category filtering.
 * This is a standalone shortcode module that renders outside the main dashboard.
 *
 * @package AquaticPro
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Bento Media Grid Class
 */
class AquaticPro_Bento_Media_Grid {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', [$this, 'register_shortcode']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
    }
    
    /**
     * Register the shortcode
     */
    public function register_shortcode() {
        add_shortcode('bento_media_grid', [$this, 'render_shortcode']);
    }
    
    /**
     * Render the shortcode output
     * 
     * Shortcode attributes:
     * - posts_per_page: Number of posts to show (-1 for all)
     * - columns: Number of columns (default 4)
     * - categories: Comma-separated category IDs (overrides global setting)
     * - groups: Comma-separated LearnDash group IDs for access restriction
     * - layout: 'bento' or 'standard' (overrides global setting)
     * - title: Custom title (overrides global setting, use "" to hide)
     * - show_author: '1' or '0' (overrides global setting)
     * - show_date: '1' or '0' (overrides global setting)
     * - show_tags: '1' or '0' (overrides global setting)
     * - accent_color: Hex color (overrides global setting)
     * - id: Unique ID for multiple instances on same page
     */
    public function render_shortcode($atts) {
        $atts = shortcode_atts([
            'posts_per_page' => -1,
            'columns' => 4,
            'categories' => '',
            'groups' => '',
            'layout' => '',
            'title' => null, // null means use global, '' means hide
            'show_author' => null,
            'show_date' => null,
            'show_tags' => null,
            'accent_color' => '',
            'id' => '',
        ], $atts, 'bento_media_grid');
        
        // Check LearnDash group restriction if groups are specified
        if (!empty($atts['groups'])) {
            $allowed_groups = array_map('intval', array_filter(explode(',', $atts['groups'])));
            
            if (!empty($allowed_groups)) {
                // Check if user is logged in
                if (!is_user_logged_in()) {
                    return $this->render_access_denied('Please log in to view this content.');
                }
                
                // Check if LearnDash is active
                if (!function_exists('learndash_get_users_group_ids')) {
                    return $this->render_access_denied('Access restricted.');
                }
                
                // Get user's groups
                $user_id = get_current_user_id();
                $user_groups = learndash_get_users_group_ids($user_id);
                
                // Check if user is in any of the allowed groups
                $has_access = !empty(array_intersect($allowed_groups, $user_groups));
                
                // Also allow WordPress admins
                if (!$has_access && !current_user_can('manage_options')) {
                    return $this->render_access_denied('You do not have access to this content.');
                }
            }
        }
        
        // Get global settings as defaults
        $global_categories = get_option('aquaticpro_bento_categories', []);
        $global_accent_color = get_option('aquaticpro_bento_accent_color', '#0ea5e9');
        $global_show_author = get_option('aquaticpro_bento_show_author', true);
        $global_show_date = get_option('aquaticpro_bento_show_date', true);
        $global_show_tags = get_option('aquaticpro_bento_show_tags', true);
        $global_layout_type = get_option('aquaticpro_bento_layout_type', 'bento');
        $global_grid_title = get_option('aquaticpro_bento_grid_title', 'Media Gallery');
        
        // Determine categories (shortcode overrides global)
        if (!empty($atts['categories'])) {
            $selected_categories = array_map('intval', array_filter(explode(',', $atts['categories'])));
        } else {
            $selected_categories = $global_categories;
        }
        
        // Determine other settings (shortcode overrides global if specified)
        $accent_color = !empty($atts['accent_color']) ? sanitize_hex_color($atts['accent_color']) : $global_accent_color;
        $layout_type = !empty($atts['layout']) ? sanitize_text_field($atts['layout']) : $global_layout_type;
        $grid_title = $atts['title'] !== null ? $atts['title'] : $global_grid_title;
        $show_author = $atts['show_author'] !== null ? ($atts['show_author'] === '1' || $atts['show_author'] === 'true') : $global_show_author;
        $show_date = $atts['show_date'] !== null ? ($atts['show_date'] === '1' || $atts['show_date'] === 'true') : $global_show_date;
        $show_tags = $atts['show_tags'] !== null ? ($atts['show_tags'] === '1' || $atts['show_tags'] === 'true') : $global_show_tags;
        
        // Generate unique ID for multiple instances
        $instance_id = !empty($atts['id']) ? sanitize_html_class($atts['id']) : 'bento-' . wp_rand(1000, 9999);
        
        // Prepare data for React
        $config = [
            'rest_url' => rest_url('aquaticpro/v1/bento/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'posts_per_page' => intval($atts['posts_per_page']),
            'columns' => intval($atts['columns']),
            'selected_categories' => $selected_categories,
            'accent_color' => $accent_color,
            'show_author' => (bool) $show_author,
            'show_date' => (bool) $show_date,
            'show_tags' => (bool) $show_tags,
            'layout_type' => $layout_type,
            'grid_title' => $grid_title,
            'instance_id' => $instance_id,
        ];
        
        ob_start();
        ?>
        <div id="bento-media-grid-root-<?php echo esc_attr($instance_id); ?>" class="bento-media-grid-instance" data-config='<?php echo esc_attr(json_encode($config)); ?>'></div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Render access denied message
     */
    private function render_access_denied($message) {
        ob_start();
        ?>
        <div class="bento-access-denied" style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 16px; margin: 20px 0;">
            <svg style="width: 48px; height: 48px; color: #94a3b8; margin-bottom: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p style="color: #64748b; font-size: 16px; margin: 0;"><?php echo esc_html($message); ?></p>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_scripts() {
        global $post;
        
        // Only load on pages/posts with the shortcode
        if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'bento_media_grid')) {
            return;
        }
        
        // Check if the module is enabled
        $enabled = get_option('aquaticpro_enable_bento_grid', false);
        if (!$enabled) {
            return;
        }
        
        $plugin_dir = plugin_dir_path(dirname(__FILE__));
        $plugin_url = plugin_dir_url(dirname(__FILE__));
        $version = '1.0.0';
        
        // Add type="module" to our script tags
        add_filter('script_loader_tag', function($tag, $handle) {
            if ($handle === 'bento-media-grid-vite' || $handle === 'bento-media-grid-script') {
                return str_replace(' src', ' type="module" src', $tag);
            }
            return $tag;
        }, 10, 2);
        
        // Check if we're in development or production
        $manifest_path = $plugin_dir . 'bento-grid/build/.vite/manifest.json';
        
        if (file_exists($manifest_path)) {
            // Production: Load from build folder
            $manifest = json_decode(file_get_contents($manifest_path), true);
            
            if (isset($manifest['src/main.tsx'])) {
                $entry = $manifest['src/main.tsx'];
                
                // Enqueue CSS
                if (isset($entry['css'])) {
                    foreach ($entry['css'] as $css_file) {
                        wp_enqueue_style(
                            'bento-media-grid-style',
                            $plugin_url . 'bento-grid/build/' . $css_file,
                            [],
                            $version
                        );
                    }
                }
                
                // Enqueue JS
                wp_enqueue_script(
                    'bento-media-grid-script',
                    $plugin_url . 'bento-grid/build/' . $entry['file'],
                    [],
                    $version,
                    true
                );
            }
        } else {
            // Development: Load from Vite dev server
            wp_enqueue_script(
                'bento-media-grid-vite',
                'http://localhost:5174/@vite/client',
                [],
                null,
                true
            );
        }
    }
    
    /**
     * Register settings - adds to existing AquaticPro settings page
     */
    public function register_settings() {
        // Register settings
        register_setting('aquaticpro_settings', 'aquaticpro_bento_categories', [
            'type' => 'array',
            'sanitize_callback' => [$this, 'sanitize_categories'],
            'default' => [],
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_accent_color', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_hex_color',
            'default' => '#0ea5e9',
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_show_author', [
            'type' => 'boolean',
            'default' => true,
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_show_date', [
            'type' => 'boolean',
            'default' => true,
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_show_tags', [
            'type' => 'boolean',
            'default' => true,
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_layout_type', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => 'bento',
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_bento_grid_title', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => 'Media Gallery',
        ]);
        
        register_setting('aquaticpro_settings', 'aquaticpro_enable_bento_grid', [
            'type' => 'boolean',
            'default' => false,
        ]);
        
        // Add settings section
        add_settings_section(
            'aquaticpro_bento_section',
            'Bento Media Grid',
            [$this, 'render_section_description'],
            'aquaticpro_settings'
        );
        
        // Add settings fields
        add_settings_field(
            'aquaticpro_enable_bento_grid',
            'Enable Bento Media Grid',
            [$this, 'render_enable_field'],
            'aquaticpro_settings',
            'aquaticpro_bento_section'
        );
        
        add_settings_field(
            'aquaticpro_bento_categories',
            'Categories to Include',
            [$this, 'render_categories_field'],
            'aquaticpro_settings',
            'aquaticpro_bento_section'
        );
        
        add_settings_field(
            'aquaticpro_bento_accent_color',
            'Accent Color',
            [$this, 'render_accent_color_field'],
            'aquaticpro_settings',
            'aquaticpro_bento_section'
        );
        
        add_settings_field(
            'aquaticpro_bento_display_options',
            'Display Options',
            [$this, 'render_display_options_field'],
            'aquaticpro_settings',
            'aquaticpro_bento_section'
        );
    }
    
    /**
     * Sanitize categories array
     */
    public function sanitize_categories($input) {
        if (!is_array($input)) {
            return [];
        }
        return array_map('intval', $input);
    }
    
    /**
     * Render section description
     */
    public function render_section_description() {
        echo '<p>Configure the Bento Media Grid module. Use the shortcode <code>[bento_media_grid]</code> on any page.</p>';
        echo '<p>Optional parameters: <code>[bento_media_grid posts_per_page="20" columns="4"]</code></p>';
    }
    
    /**
     * Render enable field
     */
    public function render_enable_field() {
        $enabled = get_option('aquaticpro_enable_bento_grid', false);
        ?>
        <label>
            <input type="checkbox" name="aquaticpro_enable_bento_grid" value="1" <?php checked($enabled); ?> />
            Enable the Bento Media Grid shortcode
        </label>
        <?php
    }
    
    /**
     * Render categories field
     */
    public function render_categories_field() {
        $categories = get_categories(['hide_empty' => false]);
        $selected = get_option('aquaticpro_bento_categories', []);
        
        echo '<fieldset style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">';
        foreach ($categories as $category) {
            printf(
                '<label style="display: block; margin-bottom: 6px;"><input type="checkbox" name="aquaticpro_bento_categories[]" value="%d" %s /> %s <span style="color: #666;">(%d posts)</span></label>',
                $category->term_id,
                checked(in_array($category->term_id, $selected), true, false),
                esc_html($category->name),
                $category->count
            );
        }
        if (empty($categories)) {
            echo '<p>No categories found.</p>';
        }
        echo '</fieldset>';
        echo '<p class="description">Leave all unchecked to show posts from all categories.</p>';
    }
    
    /**
     * Render accent color field
     */
    public function render_accent_color_field() {
        $color = get_option('aquaticpro_bento_accent_color', '#0ea5e9');
        ?>
        <input type="color" name="aquaticpro_bento_accent_color" value="<?php echo esc_attr($color); ?>" style="width: 60px; height: 40px; padding: 0; border: 1px solid #ddd; border-radius: 4px;" />
        <span style="margin-left: 10px; font-family: monospace;"><?php echo esc_html($color); ?></span>
        <p class="description">Primary accent color for the grid (pool-inspired blue recommended).</p>
        <?php
    }
    
    /**
     * Render display options field
     */
    public function render_display_options_field() {
        $show_author = get_option('aquaticpro_bento_show_author', true);
        $show_date = get_option('aquaticpro_bento_show_date', true);
        $show_tags = get_option('aquaticpro_bento_show_tags', true);
        ?>
        <fieldset>
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" name="aquaticpro_bento_show_author" value="1" <?php checked($show_author); ?> />
                Show post author
            </label>
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" name="aquaticpro_bento_show_date" value="1" <?php checked($show_date); ?> />
                Show post date
            </label>
            <label style="display: block; margin-bottom: 8px;">
                <input type="checkbox" name="aquaticpro_bento_show_tags" value="1" <?php checked($show_tags); ?> />
                Show post tags
            </label>
        </fieldset>
        <?php
    }
    
    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('aquaticpro/v1', '/bento/posts', [
            'methods' => 'GET',
            'callback' => [$this, 'get_posts'],
            'permission_callback' => '__return_true',
        ]);
        
        register_rest_route('aquaticpro/v1', '/bento/categories', [
            'methods' => 'GET',
            'callback' => [$this, 'get_categories'],
            'permission_callback' => '__return_true',
        ]);
    }
    
    /**
     * Get posts for the grid
     */
    public function get_posts($request) {
        // Get selected categories from request (shortcode-specified) or fall back to global option
        $selected_categories_param = $request->get_param('selected_categories');
        if (!empty($selected_categories_param)) {
            $selected_categories = array_map('intval', array_filter(explode(',', $selected_categories_param)));
        } else {
            $selected_categories = get_option('aquaticpro_bento_categories', []);
        }
        
        $args = [
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => $request->get_param('per_page') ?: -1,
            'paged' => $request->get_param('page') ?: 1,
            'orderby' => 'date',
            'order' => 'DESC',
        ];
        
        // Filter by selected categories if set
        $category = $request->get_param('category');
        if ($category) {
            // User clicked a category filter - show only that category
            // But if we have restricted categories, ensure the clicked one is allowed
            $clicked_cat = intval($category);
            if (!empty($selected_categories) && !in_array($clicked_cat, $selected_categories)) {
                // Clicked category is not in allowed list, show nothing
                return [
                    'posts' => [],
                    'total' => 0,
                    'pages' => 0,
                ];
            }
            $args['cat'] = $clicked_cat;
        } elseif (!empty($selected_categories)) {
            // No specific filter clicked, restrict to allowed categories
            $args['category__in'] = $selected_categories;
        }
        
        $query = new WP_Query($args);
        $posts = [];
        
        foreach ($query->posts as $post) {
            $posts[] = $this->format_post($post);
        }
        
        return [
            'posts' => $posts,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
        ];
    }
    
    /**
     * Format a single post for the API response
     */
    private function format_post($post) {
        $categories = wp_get_post_categories($post->ID, ['fields' => 'all']);
        $tags = wp_get_post_tags($post->ID, ['fields' => 'all']);
        $author = get_userdata($post->post_author);
        
        // Get featured image
        $featured_image = null;
        if (has_post_thumbnail($post->ID)) {
            $featured_image = [
                'url' => get_the_post_thumbnail_url($post->ID, 'large'),
                'alt' => get_post_meta(get_post_thumbnail_id($post->ID), '_wp_attachment_image_alt', true),
            ];
        }
        
        // Get first image from content if no featured image
        if (!$featured_image) {
            preg_match('/<img[^>]+src=[\'"]([^\'"]+)[\'"][^>]*>/i', $post->post_content, $matches);
            if (!empty($matches[1])) {
                $featured_image = [
                    'url' => $matches[1],
                    'alt' => '',
                ];
            }
        }
        
        // Clean content - remove footers, like buttons, share buttons, etc.
        $content = $post->post_content;
        $content = preg_replace('/<footer[^>]*>.*?<\/footer>/is', '', $content);
        $content = preg_replace('/<div[^>]*class=["\'][^"\']*like[^"\']*["\'][^>]*>.*?<\/div>/is', '', $content);
        $content = preg_replace('/<div[^>]*class=["\'][^"\']*share[^"\']*["\'][^>]*>.*?<\/div>/is', '', $content);
        $content = preg_replace('/<div[^>]*class=["\'][^"\']*social[^"\']*["\'][^>]*>.*?<\/div>/is', '', $content);
        $content = preg_replace('/<div[^>]*class=["\'][^"\']*reactions[^"\']*["\'][^>]*>.*?<\/div>/is', '', $content);
        $content = wp_kses_post($content);
        
        return [
            'id' => $post->ID,
            'title' => $post->post_title,
            'slug' => $post->post_name,
            'excerpt' => wp_trim_words(wp_strip_all_tags($content), 30, '...'),
            'content' => $content,
            'date' => get_the_date('F j, Y', $post),
            'date_iso' => get_the_date('c', $post),
            'author' => [
                'name' => $author ? $author->display_name : 'Unknown',
                'avatar' => get_avatar_url($post->post_author, ['size' => 48]),
            ],
            'categories' => array_map(function($cat) {
                return [
                    'id' => $cat->term_id,
                    'name' => $cat->name,
                    'slug' => $cat->slug,
                ];
            }, $categories),
            'tags' => array_map(function($tag) {
                return [
                    'id' => $tag->term_id,
                    'name' => $tag->name,
                    'slug' => $tag->slug,
                ];
            }, $tags),
            'featured_image' => $featured_image,
            'permalink' => get_permalink($post->ID),
        ];
    }
    
    /**
     * Get categories for filtering
     */
    public function get_categories($request) {
        // Get selected categories from request (shortcode-specified) or fall back to global option
        $selected_categories_param = $request->get_param('selected_categories');
        if (!empty($selected_categories_param)) {
            $selected_categories = array_map('intval', array_filter(explode(',', $selected_categories_param)));
        } else {
            $selected_categories = get_option('aquaticpro_bento_categories', []);
        }
        
        $args = [
            'hide_empty' => true,
        ];
        
        // If specific categories are selected, only return those
        if (!empty($selected_categories)) {
            $args['include'] = $selected_categories;
        }
        
        $categories = get_categories($args);
        
        return array_map(function($cat) {
            return [
                'id' => $cat->term_id,
                'name' => $cat->name,
                'slug' => $cat->slug,
                'count' => $cat->count,
            ];
        }, $categories);
    }
}

// Initialize the module
AquaticPro_Bento_Media_Grid::get_instance();
