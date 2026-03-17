import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { BlockEditor } from '../BlockEditor';
import { HiOutlineXMark, HiOutlineArrowLeft, HiOutlineArrowRight } from 'react-icons/hi2';

interface FocusReaderProps {
    content: any[]; // BlockNote JSON blocks
    onClose: () => void;
    title?: string;
}

export const FocusReader: React.FC<FocusReaderProps> = ({ content, onClose, title }) => {
    const [slides, setSlides] = useState<any[][]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Split content by divider blocks
        // BlockNote uses 'divider' as the type name (not 'horizontalRule')
        const newSlides: any[][] = [];
        let currentSlide: any[] = [];
        
        content.forEach(block => {
            if (block.type === 'divider') {
                if (currentSlide.length > 0) {
                    newSlides.push(currentSlide);
                    currentSlide = [];
                }
            } else {
                currentSlide.push(block);
            }
        });
        
        if (currentSlide.length > 0) {
            newSlides.push(currentSlide);
        }

        // If no dividers found, just show all content as one slide
        if (newSlides.length === 0 && content.length > 0) {
            newSlides.push(content);
        } else if (newSlides.length === 0) {
            newSlides.push([]); // Empty content
        }

        setSlides(newSlides);
    }, [content]);

    const scrollToSlide = (index: number) => {
        if (index < 0 || index >= slides.length) return;
        setCurrentSlideIndex(index);
        const element = document.getElementById(`slide-${index}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Handle intersection observer to update current index on scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.getAttribute('data-index'));
                        if (!isNaN(index)) {
                            setCurrentSlideIndex(index);
                        }
                    }
                });
            },
            {
                root: containerRef.current,
                threshold: 0.5 // Update when 50% visible
            }
        );

        slides.forEach((_, index) => {
            const el = document.getElementById(`slide-${index}`);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [slides]);

    return (
        <div className="ap-fixed ap-inset-0 ap-bg-white ap-z-50 ap-flex ap-flex-col ap-animate-fadeIn">
            {/* Header / Toolbar */}
            <div className="ap-flex ap-items-center ap-justify-between ap-px-6 ap-py-4 ap-border-b ap-border-gray-100 ap-bg-white ap-bg-opacity-90 ap-backdrop-blur-sm ap-sticky ap-top-0 ap-z-10 ap-transition-all hover:ap-opacity-100">
                <div className="ap-flex ap-items-center ap-gap-4">
                    <Button 
                        onClick={onClose}
                        variant="ghost"
                        size="sm"
                        className="!ap-p-2 hover:!ap-bg-gray-100 !ap-rounded-full !ap-text-gray-500 hover:!ap-text-gray-900"
                        title="Exit Focus Mode"
                    >
                        <HiOutlineXMark className="ap-w-6 ap-h-6" />
                    </Button>
                    {title && (
                        <h2 className="ap-text-lg ap-font-medium ap-text-gray-900 line-clamp-1">{title}</h2>
                    )}
                </div>
                
                {slides.length > 1 && (
                    <div className="ap-flex ap-items-center ap-gap-2 ap-bg-gray-100 ap-rounded-full ap-px-3 ap-py-1.5">
                        <Button 
                            onClick={() => scrollToSlide(currentSlideIndex - 1)}
                            disabled={currentSlideIndex === 0}
                            variant="ghost"
                            size="xs"
                            className="!ap-p-1 hover:!ap-text-blue-600 !ap-min-h-0"
                        >
                            <HiOutlineArrowLeft className="ap-w-4 ap-h-4" />
                        </Button>
                        <span className="ap-text-sm ap-font-medium ap-text-gray-600 ap-min-w-[3rem] ap-text-center">
                            {currentSlideIndex + 1} / {slides.length}
                        </span>
                        <Button 
                            onClick={() => scrollToSlide(currentSlideIndex + 1)}
                            disabled={currentSlideIndex === slides.length - 1}
                            variant="ghost"
                            size="xs"
                            className="!ap-p-1 hover:!ap-text-blue-600 !ap-min-h-0"
                        >
                            <HiOutlineArrowRight className="ap-w-4 ap-h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div 
                ref={containerRef}
                className="ap-flex-1 ap-overflow-y-auto ap-scroll-smooth ap-snap-y ap-snap-mandatory"
                style={{ scrollBehavior: 'smooth' }}
            >
                {slides.map((slideBlocks, index) => (
                    <div 
                        key={index}
                        id={`slide-${index}`}
                        data-index={index}
                        className="ap-min-h-screen ap-w-full ap-flex ap-flex-col ap-items-center ap-justify-center ap-snap-start ap-py-20 ap-px-4 md:ap-px-8"
                    >
                        <div className="ap-w-full ap-max-w-4xl ap-bg-white ap-rounded-2xl ap-p-8 md:ap-p-12 ap-shadow-sm ap-border ap-border-gray-100">
                            <BlockEditor 
                                initialContent={slideBlocks}
                                editable={false}
                            />
                        </div>
                    </div>
                ))}
                
                {/* Extra space at bottom to allow convenient scrolling of last slide */}
                <div className="ap-h-[20vh]" />
            </div>
            
            {/* Progress Bar */}
            <div className="ap-h-1 ap-bg-gray-100 ap-mt-auto">
                <div 
                    className="ap-h-full ap-bg-blue-600 ap-transition-all ap-duration-300"
                    style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
                />
            </div>
        </div>
    );
};

export default FocusReader;
