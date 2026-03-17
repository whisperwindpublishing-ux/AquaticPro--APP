import React from 'react';
import { motion } from 'framer-motion';

const LoadingGrid: React.FC = () => {
  // Generate varied card sizes for loading skeleton
  const skeletonCards = [
    { size: 'col-span-2 row-span-2', delay: 0 },
    { size: 'col-span-1 row-span-1', delay: 0.05 },
    { size: 'col-span-1 row-span-1', delay: 0.1 },
    { size: 'col-span-1 row-span-2', delay: 0.15 },
    { size: 'col-span-2 row-span-1', delay: 0.2 },
    { size: 'col-span-1 row-span-1', delay: 0.25 },
    { size: 'col-span-1 row-span-1', delay: 0.3 },
    { size: 'col-span-1 row-span-2', delay: 0.35 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(180px,auto)]">
      {skeletonCards.map((card, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: card.delay }}
          className={`${card.size} rounded-3xl overflow-hidden`}
        >
          <div className="w-full h-full shimmer relative">
            {/* Fake content structure */}
            <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
              {/* Category badge skeleton */}
              <div className="w-16 h-5 bg-gray-300/50 rounded-full" />
              
              {/* Title skeleton */}
              <div className="space-y-2">
                <div className="w-3/4 h-4 bg-gray-300/50 rounded" />
                <div className="w-1/2 h-4 bg-gray-300/50 rounded" />
              </div>
              
              {/* Meta skeleton for larger cards */}
              {(card.size.includes('col-span-2') || card.size.includes('row-span-2')) && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-6 h-6 bg-gray-300/50 rounded-full" />
                  <div className="w-20 h-3 bg-gray-300/50 rounded" />
                </div>
              )}
            </div>

            {/* Animated wave overlay */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ width: '50%' }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default LoadingGrid;
