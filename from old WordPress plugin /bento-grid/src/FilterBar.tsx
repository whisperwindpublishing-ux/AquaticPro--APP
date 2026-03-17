import React from 'react';
import { motion } from 'framer-motion';
import type { Category } from './types';
import { decodeHTMLEntities } from './utils';

interface FilterBarProps {
  categories: Category[];
  activeCategory: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  accentColor: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  accentColor,
  searchQuery,
  onSearchChange,
}) => {
  if (categories.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-8"
    >
      {/* Search Input */}
      <div className="mb-4 flex justify-center">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {/* All button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange(null)}
          className={`filter-pill ${
            activeCategory === null ? 'filter-pill-active' : 'filter-pill-inactive'
          }`}
          style={
            activeCategory === null
              ? { background: `linear-gradient(135deg, ${accentColor}, #06b6d4)` }
              : undefined
          }
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            All
          </span>
        </motion.button>

        {/* Category buttons */}
        {categories.map((category) => (
          <motion.button
            key={category.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryChange(category.id)}
            className={`filter-pill ${
              activeCategory === category.id ? 'filter-pill-active' : 'filter-pill-inactive'
            }`}
            style={
              activeCategory === category.id
                ? { background: `linear-gradient(135deg, ${accentColor}, #06b6d4)` }
                : undefined
            }
          >
            <span className="flex items-center gap-2">
              {decodeHTMLEntities(category.name)}
              {category.count !== undefined && (
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${activeCategory === category.id
                    ? 'bg-white/20'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {category.count}
                </span>
              )}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Active filter indicator */}
      {(activeCategory !== null || searchQuery) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center"
        >
          <button
            onClick={() => {
              onCategoryChange(null);
              onSearchChange('');
            }}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear {activeCategory !== null && searchQuery ? 'filters' : 'filter'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default FilterBar;
