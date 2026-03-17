import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { BentoConfig, Post, Category } from './types';
import BentoCard from './BentoCard';
import FilterBar from './FilterBar';
import LoadingGrid from './LoadingGrid';

interface BentoGridProps {
  config: BentoConfig;
}

const BentoGrid: React.FC<BentoGridProps> = ({ config }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs for scroll behavior
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  const scrollPositionRef = useRef<number>(0);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const url = new URL(`${config.rest_url}categories`);
        // Pass shortcode-specified categories to only show those
        if (config.selected_categories && config.selected_categories.length > 0) {
          url.searchParams.append('selected_categories', config.selected_categories.join(','));
        }
        
        const response = await fetch(url.toString(), {
          headers: {
            'X-WP-Nonce': config.nonce,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };

    fetchCategories();
  }, [config.rest_url, config.nonce, config.selected_categories]);

  // Fetch posts
  const fetchPosts = useCallback(async (categoryId: number | null = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(`${config.rest_url}posts`);
      if (categoryId) {
        url.searchParams.append('category', categoryId.toString());
      }
      if (config.posts_per_page > 0) {
        url.searchParams.append('per_page', config.posts_per_page.toString());
      }
      // Pass shortcode-specified categories to restrict posts
      if (config.selected_categories && config.selected_categories.length > 0) {
        url.searchParams.append('selected_categories', config.selected_categories.join(','));
      }

      const response = await fetch(url.toString(), {
        headers: {
          'X-WP-Nonce': config.nonce,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch posts');
      
      const data = await response.json();
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [config.rest_url, config.nonce, config.posts_per_page, config.selected_categories]);

  // Initial fetch
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Handle category filter change
  const handleCategoryChange = (categoryId: number | null) => {
    setActiveCategory(categoryId);
    setExpandedId(null);
    fetchPosts(categoryId);
  };

  // Handle card expansion - toggle inline expansion with scroll behavior
  const handleToggleExpand = (postId: number) => {
    setExpandedId(prev => {
      const isClosing = prev === postId;
      const isSwitching = prev !== null && prev !== postId;
      
      if (isClosing) {
        // Closing the card - scroll to center the card in viewport after animation
        setTimeout(() => {
          const closedCard = cardRefs.current.get(postId);
          if (closedCard) {
            const rect = closedCard.getBoundingClientRect();
            const cardCenter = rect.top + window.scrollY + rect.height / 2;
            const viewportCenter = window.innerHeight / 2;
            window.scrollTo({
              top: Math.max(0, cardCenter - viewportCenter),
              behavior: 'smooth'
            });
          }
        }, 350); // Wait for Framer Motion animation to complete
        return null;
      } else {
        // Opening a new card (or switching cards)
        // Store current scroll position
        scrollPositionRef.current = window.scrollY;
        
        // Scroll to put the expanded card at top of viewport after animation
        // Use longer delay when switching cards since layout needs to fully settle
        const scrollDelay = isSwitching ? 400 : 150;
        
        setTimeout(() => {
          const expandedCard = cardRefs.current.get(postId);
          if (expandedCard) {
            const rect = expandedCard.getBoundingClientRect();
            const headerOffset = 20; // Small padding from top
            window.scrollTo({
              top: Math.max(0, rect.top + window.scrollY - headerOffset),
              behavior: 'smooth'
            });
          }
        }, scrollDelay);
        
        return postId;
      }
    });
  };
  
  // Register card ref callback
  const setCardRef = useCallback((postId: number, element: HTMLElement | null) => {
    if (element) {
      cardRefs.current.set(postId, element);
    } else {
      cardRefs.current.delete(postId);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    // Close any expanded card when searching
    if (query && expandedId) {
      setExpandedId(null);
    }
  }, [expandedId]);

  // Filter posts based on search query (client-side for instant results)
  const filteredPosts = React.useMemo(() => {
    if (!searchQuery.trim()) return posts;
    
    const query = searchQuery.toLowerCase().trim();
    return posts.filter(post => {
      // Search in title
      if (post.title.toLowerCase().includes(query)) return true;
      // Search in excerpt
      if (post.excerpt?.toLowerCase().includes(query)) return true;
      // Search in author name
      if (post.author?.name?.toLowerCase().includes(query)) return true;
      // Search in categories
      if (post.categories?.some(cat => cat.name.toLowerCase().includes(query))) return true;
      // Search in tags
      if (post.tags?.some(tag => tag.name.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [posts, searchQuery]);

  // Calculate bento sizes based on post index for visual variety
  const getBentoSize = (index: number): 'small' | 'medium' | 'large' | 'wide' | 'tall' => {
    const patterns = [
      'large', 'small', 'small', 'medium',
      'wide', 'small', 'tall', 'small',
      'small', 'medium', 'small', 'large',
      'small', 'tall', 'wide', 'small',
    ];
    return patterns[index % patterns.length] as 'small' | 'medium' | 'large' | 'wide' | 'tall';
  };

  if (error) {
    return (
      <div className="bento-grid-container p-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium">Error loading posts</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchPosts(activeCategory)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-grid-container min-h-screen bg-gradient-to-br from-pool-50 via-white to-aqua-50 p-4 md:p-8">
      {/* Header with wave effect - only show if title is set */}
      {config.grid_title && (
        <div className="mb-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(90deg, ${config.accent_color}, #06b6d4)`, WebkitBackgroundClip: 'text' }}
          >
            {config.grid_title}
          </motion.h1>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="h-1 w-24 mx-auto mt-3 rounded-full"
            style={{ background: `linear-gradient(90deg, ${config.accent_color}, #06b6d4)` }}
          />
        </div>
      )}

      {/* Category Filters */}
      <FilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        accentColor={config.accent_color}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />

      {/* Grid - Bento or Standard layout */}
      <LayoutGroup>
        {isLoading ? (
          <LoadingGrid />
        ) : filteredPosts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pool-100 mb-4">
              <svg className="w-8 h-8 text-pool-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">
              {searchQuery ? `No posts matching "${searchQuery}"` : 'No posts found'}
            </p>
            {(activeCategory || searchQuery) && (
              <button
                onClick={() => {
                  handleCategoryChange(null);
                  setSearchQuery('');
                }}
                className="mt-4 font-medium hover:opacity-80 transition-opacity"
                style={{ color: config.accent_color }}
              >
                {searchQuery ? 'Clear search' : 'View all posts'}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            layout
            className={
              config.layout_type === 'standard'
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(220px,auto)] sm:auto-rows-[minmax(180px,auto)]'
            }
          >
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, index) => (
                <BentoCard
                  key={post.id}
                  post={post}
                  size={config.layout_type === 'standard' ? 'standard' : getBentoSize(index)}
                  isExpanded={expandedId === post.id}
                  onToggleExpand={() => handleToggleExpand(post.id)}
                  config={config}
                  index={index}
                  onRefChange={setCardRef}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </LayoutGroup>
    </div>
  );
};

export default BentoGrid;
