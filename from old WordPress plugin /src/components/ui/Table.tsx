import React from 'react';

interface TableProps {
    children: React.ReactNode;
    className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
    return (
        <div className="ap-overflow-x-auto">
            <table className={`ap-min-w-full ap-divide-y ap-divide-gray-200 ${className}`}>
                {children}
            </table>
        </div>
    );
};

interface TableHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
    return (
        <thead className={`ap-bg-gray-50 ${className}`}>
            {children}
        </thead>
    );
};

interface TableBodyProps {
    children: React.ReactNode;
    className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
    return (
        <tbody className={`ap-bg-white ap-divide-y ap-divide-gray-200 ${className}`}>
            {children}
        </tbody>
    );
};

interface TableRowProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
    return (
        <tr 
            className={`hover:ap-bg-gray-50 ap-transition-colors ${onClick ? 'ap-cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </tr>
    );
};

interface TableCellProps {
    children: React.ReactNode;
    isHeader?: boolean;
    className?: string;
    align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({ 
    children, 
    isHeader = false, 
    className = '',
    align = 'left'
}) => {
    const alignClasses = {
        left: 'ap-text-left',
        center: 'ap-text-center',
        right: 'ap-text-right',
    };

    // Reduced padding for more compact rows (py-3 instead of py-4)
    const baseClasses = `ap-px-4 ap-py-3 ${alignClasses[align]}`;
    
    if (isHeader) {
        return (
            <th className={`${baseClasses} ap-text-xs ap-font-medium ap-text-gray-700 ap-uppercase ap-tracking-wider ${className}`}>
                {children}
            </th>
        );
    }

    return (
        <td className={`${baseClasses} ap-text-sm ap-text-gray-900 ${className}`}>
            {children}
        </td>
    );
};
