/**
 * Inline Video Player Component
 * 
 * Plays YouTube, Vimeo, and direct video URLs inline.
 * Can be used standalone or embedded in Excalidraw whiteboard.
 */
import React, { useState, useRef, useEffect } from 'react';
import { HiOutlinePlay, HiOutlinePause, HiOutlineSpeakerWave, HiOutlineSpeakerXMark, HiOutlineArrowsPointingOut } from 'react-icons/hi2';

export interface VideoPlayerProps {
    url: string;
    title?: string;
    autoPlay?: boolean;
    muted?: boolean;
    width?: number | string;
    height?: number | string;
    className?: string;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
}

type VideoType = 'youtube' | 'vimeo' | 'direct' | 'unknown';

/**
 * Parse video URL and extract type and embed URL
 */
function parseVideoUrl(url: string): { type: VideoType; embedUrl: string; videoId?: string } {
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
        return {
            type: 'youtube',
            videoId: youtubeMatch[1],
            embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1&autoplay=0`,
        };
    }

    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
        return {
            type: 'vimeo',
            videoId: vimeoMatch[1],
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0`,
        };
    }

    // Direct video URL (mp4, webm, etc.)
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
        return {
            type: 'direct',
            embedUrl: url,
        };
    }

    return { type: 'unknown', embedUrl: url };
}

export const InlineVideoPlayer: React.FC<VideoPlayerProps> = ({
    url,
    title,
    autoPlay = false,
    muted = false,
    width = '100%',
    height = 'auto',
    className = '',
    onPlay,
    onPause,
    onEnded,
}) => {
    const { type, embedUrl } = parseVideoUrl(url);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [isLoaded, setIsLoaded] = useState(false);

    // For direct videos, we can control playback
    useEffect(() => {
        if (type === 'direct' && videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(console.error);
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, type]);

    useEffect(() => {
        if (type === 'direct' && videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted, type]);

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
        if (!isPlaying) {
            onPlay?.();
        } else {
            onPause?.();
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    // YouTube/Vimeo - use iframe
    if (type === 'youtube' || type === 'vimeo') {
        return (
            <div 
                className={`relative overflow-hidden rounded-lg shadow-lg bg-black ${className}`}
                style={{ width, aspectRatio: '16/9' }}
            >
                <iframe
                    src={embedUrl}
                    title={title || 'Video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                />
            </div>
        );
    }

    // Direct video - use native video element with controls
    if (type === 'direct') {
        return (
            <div 
                className={`relative overflow-hidden rounded-lg shadow-lg bg-black group ${className}`}
                style={{ width, height: height === 'auto' ? undefined : height }}
            >
                <video
                    ref={videoRef}
                    src={embedUrl}
                    autoPlay={autoPlay}
                    muted={muted}
                    loop={false}
                    playsInline
                    onLoadedData={() => setIsLoaded(true)}
                    onEnded={() => {
                        setIsPlaying(false);
                        onEnded?.();
                    }}
                    className="w-full h-full object-contain"
                />
                
                {/* Custom controls overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handlePlayPause}
                        className="p-4 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                        {isPlaying ? (
                            <HiOutlinePause className="w-8 h-8" />
                        ) : (
                            <HiOutlinePlay className="w-8 h-8" />
                        )}
                    </button>
                </div>

                {/* Bottom controls */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <button
                        onClick={handlePlayPause}
                        className="p-1.5 text-white hover:text-gray-300 transition-colors"
                    >
                        {isPlaying ? (
                            <HiOutlinePause className="w-5 h-5" />
                        ) : (
                            <HiOutlinePlay className="w-5 h-5" />
                        )}
                    </button>
                    <button
                        onClick={toggleMute}
                        className="p-1.5 text-white hover:text-gray-300 transition-colors"
                    >
                        {isMuted ? (
                            <HiOutlineSpeakerXMark className="w-5 h-5" />
                        ) : (
                            <HiOutlineSpeakerWave className="w-5 h-5" />
                        )}
                    </button>
                    {title && (
                        <span className="text-white text-sm truncate flex-1">{title}</span>
                    )}
                    <button
                        onClick={() => videoRef.current?.requestFullscreen()}
                        className="p-1.5 text-white hover:text-gray-300 transition-colors"
                    >
                        <HiOutlineArrowsPointingOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    // Unknown - just show a link
    return (
        <div className={`p-4 bg-gray-100 rounded-lg ${className}`}>
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
            >
                {title || 'Open Video'}
            </a>
        </div>
    );
};

export default InlineVideoPlayer;
