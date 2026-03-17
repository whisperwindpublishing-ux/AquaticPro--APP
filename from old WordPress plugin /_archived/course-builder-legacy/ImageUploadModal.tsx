/**
 * Image Upload Modal
 * 
 * Simple modal for uploading or selecting images via URL
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineXMark, HiOutlinePhoto, HiOutlineLink } from 'react-icons/hi2';

interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentImage?: string;
    onImageSelect: (url: string) => void;
    title?: string;
    recommendedWidth?: number;
    recommendedHeight?: number;
    aspectRatio?: string;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
    isOpen,
    onClose,
    currentImage,
    onImageSelect,
    title = 'Select Image',
    recommendedWidth = 800,
    recommendedHeight = 450,
    aspectRatio = '16:9',
}) => {
    const [imageUrl, setImageUrl] = useState(currentImage || '');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (imageUrl.trim()) {
            onImageSelect(imageUrl.trim());
            onClose();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Create form data for WordPress media upload
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/wp-json/wp/v2/media', {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': window.mentorshipPlatformData?.nonce || '',
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            const url = data.source_url || data.guid?.rendered;
            
            if (url) {
                setImageUrl(url);
                onImageSelect(url);
                onClose();
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload image. Try using a URL instead.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-xl shadow-xl max-w-md w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 rounded-lg"
                        >
                            <HiOutlineXMark className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Current/Preview Image */}
                        {(imageUrl || currentImage) && (
                            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                    src={imageUrl || currentImage}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                    onError={() => setError('Invalid image URL')}
                                />
                            </div>
                        )}

                        {/* Upload Button */}
                        <div>
                            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
                                <HiOutlinePhoto className="w-5 h-5 text-gray-500" />
                                <span className="text-sm text-gray-600">
                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span>or</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* URL Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Image URL
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <HiOutlineLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="url"
                                        value={imageUrl}
                                        onChange={(e) => {
                                            setImageUrl(e.target.value);
                                            setError(null);
                                        }}
                                        placeholder="https://..."
                                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Recommended size hint */}
                        <p className="text-xs text-gray-500">
                            Recommended: {recommendedWidth}×{recommendedHeight}px ({aspectRatio})
                        </p>

                        {/* Error */}
                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!imageUrl.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
                        >
                            Save
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ImageUploadModal;
