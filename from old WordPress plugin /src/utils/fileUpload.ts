/**
 * Shared file-upload constants / helpers.
 *
 * The MIME whitelist here MUST stay in sync with the `$upload_overrides['mimes']`
 * array in includes/api-routes.php → `mentorship_platform_upload_file()`.
 */

/** Browser `accept` attribute value that mirrors the PHP MIME whitelist. */
export const ACCEPTED_FILE_TYPES = [
    // Images
    'image/jpeg',
    'image/gif',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/heic',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
    'video/3gpp2',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
].join(',');

/** Human-readable label for UI hints. */
export const ACCEPTED_FILE_LABEL = 'Images, videos, PDFs, Office documents, CSV, TXT, ZIP';
