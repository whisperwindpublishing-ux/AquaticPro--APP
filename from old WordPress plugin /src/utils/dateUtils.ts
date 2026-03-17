/**
 * Date Utilities
 *
 * Fixes the common timezone-offset bug where `new Date('2026-05-01')`
 * is parsed as UTC midnight, which shifts back one day in US timezones.
 *
 * All date-only strings (YYYY-MM-DD) should be parsed through these
 * helpers so they are treated as local midnight instead of UTC midnight.
 */

/**
 * Parse a date string into a local Date object.
 *
 * For date-only strings (YYYY-MM-DD) this appends T00:00:00 so the
 * browser interprets them in the user's local timezone rather than UTC.
 * Full ISO-8601 datetime strings (containing "T" or a space separator)
 * are passed through to native parsing unchanged.
 */
export function parseLocalDate(dateStr: string): Date {
    if (!dateStr) return new Date(NaN);

    // Date-only pattern: exactly YYYY-MM-DD (no time component)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr + 'T00:00:00');
    }

    return new Date(dateStr);
}

/**
 * Format a date string for display using the user's locale.
 *
 * Returns '' for null/undefined/invalid values.
 * Safely handles date-only strings by routing through parseLocalDate.
 */
export function formatLocalDate(
    dateStr: string | null | undefined,
    options?: Intl.DateTimeFormatOptions,
): string {
    if (!dateStr) return '';

    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString(
        'en-US',
        options ?? { month: 'short', day: 'numeric', year: 'numeric' },
    );
}

/**
 * Format a datetime string for display (includes time).
 */
export function formatLocalDateTime(
    dateStr: string | null | undefined,
): string {
    if (!dateStr) return '';

    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
