import React, { memo } from 'react';

interface MemoizedHtmlProps {
    html: string;
    className?: string;
}

/**
 * Memoized component to prevent re-parsing HTML on every render
 * Significantly improves performance when displaying rich text in tables/lists
 */
const MemoizedHtml: React.FC<MemoizedHtmlProps> = memo(({ html, className = '' }) => {
    return (
        <div 
            className={className}
            dangerouslySetInnerHTML={{ __html: html }} 
        />
    );
}, (prevProps, nextProps) => {
    // Only re-render if HTML content actually changed
    return prevProps.html === nextProps.html && prevProps.className === nextProps.className;
});

MemoizedHtml.displayName = 'MemoizedHtml';

export default MemoizedHtml;
