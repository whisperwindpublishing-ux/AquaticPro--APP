/**
 * Utility functions for exporting data to CSV
 */

/**
 * Converts data to CSV format and triggers download
 */
export const downloadCSV = (data: any[], filename: string, headers?: string[]) => {
    if (data.length === 0) {
        alert('No data to export');
        return;
    }

    // Get headers from first object if not provided
    const csvHeaders = headers || Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
        // Header row
        csvHeaders.join(','),
        // Data rows
        ...data.map(row => 
            csvHeaders.map(header => {
                const value = row[header];
                
                // Handle different value types
                if (value === null || value === undefined) {
                    return '';
                }
                
                // Convert to string and escape quotes
                let stringValue = String(value);
                
                // Remove HTML tags if present
                stringValue = stringValue.replace(/<[^>]*>/g, '');
                
                // Escape quotes and wrap in quotes if contains comma, newline, or quote
                if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
                    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                }
                
                return stringValue;
            }).join(',')
        )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Format a date string for CSV export
 */
export const formatDateForCSV = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Convert boolean or number to readable string
 */
export const formatBooleanForCSV = (value: boolean | number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value === 1 ? 'Yes' : 'No';
    return String(value);
};
