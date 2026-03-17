/**
 * Utility functions for sorting users by name
 */

/**
 * Parse a display name into last name and first name
 * Handles formats like "Last, First" or "First Last"
 */
export const parseDisplayName = (displayName: string): { lastName: string; firstName: string } => {
    if (displayName.includes(',')) {
        // Format: "Last, First"
        const [lastName, firstName] = displayName.split(',').map(s => s.trim());
        return { lastName: lastName || '', firstName: firstName || '' };
    } else {
        // Format: "First Last" - split on last space
        const parts = displayName.trim().split(' ');
        if (parts.length === 1) {
            return { lastName: parts[0], firstName: '' };
        }
        const firstName = parts.slice(0, -1).join(' ');
        const lastName = parts[parts.length - 1];
        return { lastName, firstName };
    }
};

/**
 * Sort users by last name, then first name
 */
export const sortUsersByName = <T extends { display_name: string }>(users: T[]): T[] => {
    return [...users].sort((a, b) => {
        const parsedA = parseDisplayName(a.display_name);
        const parsedB = parseDisplayName(b.display_name);
        
        // Compare last names first
        const lastNameCompare = parsedA.lastName.localeCompare(parsedB.lastName, undefined, { sensitivity: 'base' });
        if (lastNameCompare !== 0) {
            return lastNameCompare;
        }
        
        // If last names are equal, compare first names
        return parsedA.firstName.localeCompare(parsedB.firstName, undefined, { sensitivity: 'base' });
    });
};

/**
 * Sort simple user objects with name property by last name, then first name
 */
export const sortSimpleUsersByName = <T extends { name: string }>(users: T[]): T[] => {
    return [...users].sort((a, b) => {
        const parsedA = parseDisplayName(a.name);
        const parsedB = parseDisplayName(b.name);
        
        // Compare last names first
        const lastNameCompare = parsedA.lastName.localeCompare(parsedB.lastName, undefined, { sensitivity: 'base' });
        if (lastNameCompare !== 0) {
            return lastNameCompare;
        }
        
        // If last names are equal, compare first names
        return parsedA.firstName.localeCompare(parsedB.firstName, undefined, { sensitivity: 'base' });
    });
};
