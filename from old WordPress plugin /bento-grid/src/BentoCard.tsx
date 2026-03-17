import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Post, BentoConfig } from './types';
import { decodeHTMLEntities } from './utils';

interface BentoCardProps {
  post: Post;
  size: 'small' | 'medium' | 'large' | 'wide' | 'tall' | 'standard';
  isExpanded: boolean;
  onToggleExpand: () => void;
  config: BentoConfig;
  index: number;
  onRefChange?: (postId: number, element: HTMLElement | null) => void;
}

// Grid span classes for collapsed state (bento layout)
const collapsedSizeClasses: Record<string, string> = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-1 row-span-2',
  large: 'col-span-2 row-span-2',
  wide: 'col-span-2 row-span-1',
  tall: 'col-span-1 row-span-2',
  standard: 'col-span-1', // Standard grid - all cards same size
};

const BentoCard: React.FC<BentoCardProps> = ({
  post,
  size,
  isExpanded,
  onToggleExpand,
  config,
  index,
  onRefChange,
}) => {
  const hasImage = !!post.featured_image?.url;
  const isLargeSize = size === 'large' || size === 'wide';
  const isStandardLayout = size === 'standard' || config.layout_type === 'standard';
  
  // Ref callback to register this card's DOM element
  const refCallback = useCallback((element: HTMLDivElement | null) => {
    if (onRefChange) {
      onRefChange(post.id, element);
    }
  }, [onRefChange, post.id]);

  // When expanded, limit to 2 columns max for better readability
  const expandedClass = 'col-span-1 sm:col-span-2';
  
  const gridClass = isExpanded ? expandedClass : collapsedSizeClasses[size];

  return (
    <motion.article
      ref={refCallback}
      layout
      layoutId={`card-container-${post.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        layout: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        delay: isExpanded ? 0 : index * 0.03,
      }}
      onClick={onToggleExpand}
      className={`
        ${gridClass}
        relative overflow-hidden rounded-3xl cursor-pointer
        bg-white shadow-card hover:shadow-card-hover
        transition-shadow duration-300
        ${isExpanded ? 'z-10' : ''}
        ${isStandardLayout && !isExpanded ? 'aspect-[4/3]' : ''}
      `}
      style={{ 
        minHeight: isExpanded ? 'auto' : isStandardLayout ? undefined : undefined,
        order: index, // Keep cards in their original position
      }}
    >
      {/* Collapsed View */}
      {!isExpanded && (
        <motion.div
          layoutId={`card-visual-${post.id}`}
          className="absolute inset-0"
        >
          {/* Background Image or Gradient */}
          {hasImage ? (
            <div className="absolute inset-0">
              <motion.img
                layoutId={`card-image-${post.id}`}
                src={post.featured_image!.url}
                alt={post.featured_image!.alt || post.title}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
            </div>
          ) : (
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${config.accent_color}dd, ${config.accent_color}99, #06b6d4aa)`,
              }}
            >
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,50 Q25,30 50,50 T100,50 V100 H0 Z" fill="white" />
              </svg>
            </div>
          )}

          {/* Content Overlay */}
          <div className="absolute inset-0 p-4 md:p-5 flex flex-col justify-end text-white">
            {/* Categories */}
            {post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {post.categories.slice(0, 2).map((cat) => (
                  <span key={cat.id} className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 backdrop-blur-sm">
                    {decodeHTMLEntities(cat.name)}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <motion.h2
              layoutId={`card-title-${post.id}`}
              className={`font-bold leading-tight drop-shadow-lg ${
                isStandardLayout 
                  ? 'text-base md:text-lg line-clamp-2' 
                  : isLargeSize 
                    ? 'text-xl md:text-2xl' 
                    : 'text-base md:text-lg'
              }`}
            >
              {decodeHTMLEntities(post.title)}
            </motion.h2>

            {/* Meta info for larger cards or standard layout */}
            {(isLargeSize || isStandardLayout) && (
              <div className="mt-2 flex items-center gap-3 text-sm text-white/80">
                {config.show_author && (
                  <div className="flex items-center gap-2">
                    <img src={post.author.avatar} alt={post.author.name} className="w-6 h-6 rounded-full border-2 border-white/30" />
                    <span className="truncate max-w-[100px]">{post.author.name}</span>
                  </div>
                )}
                {config.show_date && <span className="opacity-70 whitespace-nowrap">{post.date}</span>}
              </div>
            )}

            {(isLargeSize && !isStandardLayout) && (
              <p className="mt-2 text-sm line-clamp-2 text-white/80">{post.excerpt}</p>
            )}
          </div>

          {/* Expand indicator */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
          </div>
        </motion.div>
      )}

      {/* Expanded View - Inline content that pushes other cards */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="flex flex-col w-full md:w-[80%] md:mx-auto"
        >
          {/* Header with image */}
          <div className="relative h-48 md:h-64 flex-shrink-0">
            {hasImage ? (
              <>
                <motion.img
                  layoutId={`card-image-${post.id}`}
                  src={post.featured_image!.url}
                  alt={post.featured_image!.alt || post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </>
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${config.accent_color}, #06b6d4)` }}>
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,30 Q25,10 50,30 T100,30 V100 H0 Z" fill="white" />
                  <path d="M0,50 Q25,30 50,50 T100,50 V100 H0 Z" fill="white" opacity="0.5" />
                </svg>
              </div>
            )}

            {/* Collapse indicator */}
            <div
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors flex items-center justify-center z-10"
              aria-label="Click anywhere to close"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <motion.h1
                layoutId={`card-title-${post.id}`}
                className="text-2xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg"
              >
                {decodeHTMLEntities(post.title)}
              </motion.h1>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-10 lg:p-12">
            {/* Meta information */}
            <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6 md:mb-8 pb-6 md:pb-8 border-b border-gray-100">
              {config.show_author && (
                <div className="flex items-center gap-3">
                  <img src={post.author.avatar} alt={post.author.name} className="w-12 h-12 rounded-full border-2" style={{ borderColor: `${config.accent_color}40` }} />
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">{post.author.name}</p>
                    <p className="text-sm text-gray-500">Author</p>
                  </div>
                </div>
              )}
              {config.show_date && (
                <div className="flex items-center gap-2 text-gray-500 text-base">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <time dateTime={post.date_iso}>{post.date}</time>
                </div>
              )}
            </div>

            {/* Categories */}
            {post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.categories.map((cat) => (
                  <span key={cat.id} className="px-4 py-1.5 text-base font-medium rounded-full" style={{ backgroundColor: `${config.accent_color}20`, color: config.accent_color }}>
                    {decodeHTMLEntities(cat.name)}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            {config.show_tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {post.tags.map((tag) => (
                  <span key={tag.id} className="px-3 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-600">
                    #{decodeHTMLEntities(tag.name)}
                  </span>
                ))}
              </div>
            )}

            {/* Content - uses theme paragraph styling */}
            <div className="bento-content text-gray-700" dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>

          {/* Footer */}
          <div className="px-6 md:px-10 lg:px-12 py-5 bg-gray-50 border-t border-gray-100">
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-lg font-medium transition-colors hover:opacity-80"
              style={{ color: config.accent_color }}
            >
              <span>View Original Post</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </motion.div>
      )}
    </motion.article>
  );
};

export default BentoCard;
