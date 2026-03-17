import React, { useState, useRef } from 'react';
import { Button } from '../ui';
import { 
    HiOutlineBookOpen, 
    HiOutlinePencilSquare, 
    HiOutlineTrash, 
    HiOutlineMagnifyingGlass, 
    HiOutlinePlus, 
    HiOutlineEllipsisVertical,
    HiOutlineArrowDownTray,
    HiOutlineArrowUpTray,
    HiOutlineBarsArrowDown,
    HiOutlineFolder,
    HiOutlineCog6Tooth
} from 'react-icons/hi2';
import { Course, CourseCategory } from '../../services/api-lms';

interface LMSPermissions {
    canViewCourses: boolean;
    canViewLessons: boolean;
    canCreateCourses: boolean;
    canEditCourses: boolean;
    canDeleteCourses: boolean;
    canCreateLessons: boolean;
    canEditLessons: boolean;
    canDeleteLessons: boolean;
    canManageExcalidraw: boolean;
    canModerateAll: boolean;
}

interface CourseListProps {
    courses: Course[];
    loading: boolean;
    permissions: LMSPermissions;
    categories?: CourseCategory[];
    onSelect: (course: Course) => void;
    onEdit: (course: Course) => void;
    onDelete: (course: Course) => void;
    onNew: () => void;
    onRefresh: () => void;
    onManageCategories?: () => void;
    onSetCategory?: (courseId: number, category: string) => void;
    onExport?: (course: Course) => void;
    onImport?: (file: File) => void;
    onImportLearnDash?: () => void;
}

const CourseList: React.FC<CourseListProps> = ({
    courses,
    loading,
    permissions,
    categories = [],
    onSelect,
    onEdit,
    onDelete,
    onNew,
    onRefresh: _onRefresh,
    onManageCategories,
    onSetCategory,
    onExport,
    onImport,
    onImportLearnDash,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed' | 'not-started'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'manual'>('name');
    const [menuOpen, setMenuOpen] = useState<number | null>(null);
    const [categoryMenuOpen, setCategoryMenuOpen] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canEdit = permissions.canEditCourses || permissions.canModerateAll;
    const canCreate = permissions.canCreateCourses || permissions.canModerateAll;
    const canDelete = permissions.canDeleteCourses || permissions.canModerateAll;

    const handleImportClick = () => { fileInputRef.current?.click(); };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onImport) onImport(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Filter then sort
    const processedCourses = courses
        .filter(course => {
            if (searchTerm && !course.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            const progress = course.progress || 0;
            switch (filter) {
                case 'not-started': return progress === 0;
                case 'in-progress': return progress > 0 && progress < 100;
                case 'completed': return progress === 100;
                default: return true;
            }
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.title.localeCompare(b.title);
            if (sortBy === 'date') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            // manual: display_order
            return (a.displayOrder || 0) - (b.displayOrder || 0);
        });

    // Group by category — order follows the categories prop display_order,
    // then alphabetical for any category not in the managed list, uncategorized last
    const categoryGroups: { label: string; courses: Course[] }[] = [];
    const seen = new Set<string>();
    const categorized: Record<string, Course[]> = {};
    const uncategorized: Course[] = [];
    processedCourses.forEach(c => {
        const cat = c.category?.trim() || '';
        if (!cat) { uncategorized.push(c); return; }
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(c);
        seen.add(cat);
    });
    // Sort by managed displayOrder first, then alphabetically for unmanaged
    const managedOrder = categories.slice().sort((a, b) => a.displayOrder - b.displayOrder).map(c => c.name);
    const allCatNames = Object.keys(categorized);
    const sortedCatNames = [
        ...managedOrder.filter(n => allCatNames.includes(n)),
        ...allCatNames.filter(n => !managedOrder.includes(n)).sort((a, b) => a.localeCompare(b)),
    ];
    sortedCatNames.forEach(cat => {
        categoryGroups.push({ label: cat, courses: categorized[cat] });
    });
    if (uncategorized.length > 0) {
        categoryGroups.push({ label: '', courses: uncategorized });
    }
    const hasCategoryGroups = seen.size > 0;


    const getProgressColor = (progress: number) => {
        if (progress === 100) return 'bg-green-500';
        if (progress > 50) return 'bg-blue-500';
        if (progress > 0) return 'bg-yellow-500';
        return 'bg-gray-300';
    };

    const getStatusBadge = (progress: number) => {
        if (progress === 100) {
            return <span className="ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-bg-green-100 ap-text-green-700 ap-rounded-full">Completed</span>;
        }
        if (progress > 0) {
            return <span className="ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-bg-blue-100 ap-text-blue-700 ap-rounded-full">In Progress</span>;
        }
        return <span className="ap-px-2 ap-py-1 ap-text-xs ap-font-medium ap-bg-gray-100 ap-text-gray-600 ap-rounded-full">Not Started</span>;
    };

    if (loading) {
        return (
            <div className="ap-flex ap-items-center ap-justify-center ap-py-12">
                <div className="ap-text-center">
                    <div className="ap-animate-spin ap-rounded-full ap-h-12 ap-w-12 ap-border-b-2 ap-border-blue-600 ap-mx-auto"></div>
                    <p className="ap-mt-4 ap-text-gray-500">Loading courses...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ap-space-y-4">
            {/* Toolbar — Row 1: search + status filter */}
            <div className="ap-flex ap-flex-col sm:ap-flex-row ap-gap-2 ap-items-start sm:ap-items-center">
                <div className="ap-relative ap-flex-1 ap-min-w-0 ap-max-w-sm">
                    <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search courses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="ap-w-full ap-pl-10 ap-pr-4 ap-py-2 ap-border ap-border-gray-200 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                    />
                </div>
                <div className="ap-flex ap-items-center ap-gap-1 ap-bg-gray-100 ap-rounded-lg ap-p-1">
                    {(['all', 'not-started', 'in-progress', 'completed'] as const).map((f) => (
                        <Button key={f} variant="ghost" size="sm"
                            onClick={() => setFilter(f)}
                            className={`!ap-px-3 !ap-py-1.5 !ap-rounded-md ${
                                filter === f ? '!ap-bg-white !ap-text-gray-900 !ap-shadow-sm' : '!ap-text-gray-600 hover:!ap-text-gray-900'
                            }`}
                        >
                            {f === 'all' ? 'All' : f.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Toolbar — Row 2: sort + action buttons */}
            <div className="ap-flex ap-items-center ap-gap-2 ap-flex-wrap">
                <div className="ap-flex ap-items-center ap-gap-1.5">
                    <HiOutlineBarsArrowDown className="ap-w-4 ap-h-4 ap-text-gray-400 ap-flex-shrink-0" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'manual')}
                        className="ap-text-sm ap-border ap-border-gray-200 ap-rounded-lg ap-px-2 ap-py-1.5 ap-bg-white ap-text-gray-700 focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                    >
                        <option value="name">Name A→Z</option>
                        <option value="date">Newest First</option>
                        <option value="manual">Manual Order</option>
                    </select>
                </div>

                {canCreate && (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="ap-hidden" accept=".zip" />
                        {onImport && (
                            <Button variant="outline" onClick={handleImportClick} title="Import Course (ZIP)">
                                <HiOutlineArrowUpTray className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">Import</span>
                            </Button>
                        )}
                        {onImportLearnDash && (
                            <Button variant="outline" onClick={onImportLearnDash} title="Import from LearnDash">
                                <HiOutlineBookOpen className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">LD Import</span>
                            </Button>
                        )}
                        {onManageCategories && (
                            <Button variant="outline" onClick={onManageCategories} title="Manage Categories">
                                <HiOutlineCog6Tooth className="ap-w-4 ap-h-4" />
                                <span className="ap-hidden sm:ap-inline">Categories</span>
                            </Button>
                        )}
                        <Button variant="primary" onClick={onNew}>
                            <HiOutlinePlus className="ap-w-4 ap-h-4" />
                            New
                        </Button>
                    </>
                )}
            </div>

            {/* Course Grid — grouped by category */}
            {processedCourses.length === 0 ? (
                <div className="ap-text-center ap-py-12 ap-bg-white ap-rounded-lg ap-border ap-border-gray-200">
                    <HiOutlineBookOpen className="ap-w-12 ap-h-12 ap-text-gray-300 ap-mx-auto ap-mb-3" />
                    <p className="ap-text-gray-500">
                        {searchTerm || filter !== 'all' ? 'No courses match your search' : 'No courses available'}
                    </p>
                </div>
            ) : (
                <div className="ap-space-y-8">
                    {categoryGroups.map(({ label, courses: groupCourses }) => (
                        <div key={label || '__uncategorized__'}>
                            {hasCategoryGroups && (
                                <div className="ap-flex ap-items-center ap-gap-2 ap-mb-3">
                                    <HiOutlineFolder className="ap-w-5 ap-h-5 ap-text-amber-500" />
                                    <h3 className="ap-text-base ap-font-semibold ap-text-gray-700">
                                        {label || 'Uncategorized'}
                                    </h3>
                                    <span className="ap-text-sm ap-text-gray-400">({groupCourses.length})</span>
                                    <div className="ap-flex-1 ap-h-px ap-bg-gray-200" />
                                </div>
                            )}
                            <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-3 ap-gap-4">
                                {groupCourses.map((course) => (
                                <div
                                    key={course.id}
                                    className="ap-bg-white ap-rounded-lg ap-border ap-border-gray-200 ap-overflow-hidden hover:ap-shadow-md ap-transition-shadow group"
                                >
                                    {/* Course Header/Image */}
                                    <div
                                        className="ap-h-32 ap-bg-gradient-to-br ap-from-blue-500 ap-to-blue-600 ap-relative ap-cursor-pointer"
                                        onClick={() => onSelect(course)}
                                    >
                                        <div className="ap-absolute ap-inset-0 ap-flex ap-items-center ap-justify-center">
                                            <HiOutlineBookOpen className="ap-w-12 ap-h-12 ap-text-white/50" />
                                        </div>
                                        {course.category && (
                                            <span className="ap-absolute ap-top-2 ap-left-2 ap-px-2 ap-py-0.5 ap-text-xs ap-font-medium ap-bg-white/25 ap-text-white ap-rounded-full">
                                                {course.category}
                                            </span>
                                        )}
                                        {(canEdit || canDelete) && (
                                            <div className="ap-absolute ap-top-2 ap-right-2">
                                                <Button
                                                    variant="ghost" size="xs"
                                                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === course.id ? null : course.id); setCategoryMenuOpen(null); }}
                                                    className="!ap-p-1.5 !ap-min-h-0 !ap-bg-white/20 hover:!ap-bg-white/30"
                                                >
                                                    <HiOutlineEllipsisVertical className="ap-w-4 ap-h-4 ap-text-white" />
                                                </Button>
                                                {menuOpen === course.id && (
                                                    <div className="ap-absolute ap-right-0 ap-mt-1 ap-w-40 ap-bg-white ap-rounded-lg ap-shadow-lg ap-border ap-border-gray-200 ap-py-1 ap-z-10">
                                                        {canEdit && (
                                                            <Button variant="ghost" size="sm"
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onEdit(course); }}
                                                                className="!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none"
                                                            >
                                                                <HiOutlinePencilSquare className="ap-w-4 ap-h-4" /> Edit
                                                            </Button>
                                                        )}
                                                        {canEdit && onSetCategory && categories.length > 0 && (
                                                            <Button variant="ghost" size="sm"
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpen(null); setCategoryMenuOpen(course.id); }}
                                                                className="!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none"
                                                            >
                                                                <HiOutlineFolder className="ap-w-4 ap-h-4" /> Set Category
                                                            </Button>
                                                        )}
                                                        {canEdit && onExport && (
                                                            <Button variant="ghost" size="sm"
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onExport(course); }}
                                                                className="!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none"
                                                            >
                                                                <HiOutlineArrowDownTray className="ap-w-4 ap-h-4" /> Export
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button variant="ghost" size="sm"
                                                                onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onDelete(course); }}
                                                                className="!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none !ap-text-red-600 hover:!ap-bg-red-50"
                                                            >
                                                                <HiOutlineTrash className="ap-w-4 ap-h-4" /> Delete
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {categoryMenuOpen === course.id && (
                                                    <div className="ap-absolute ap-right-0 ap-mt-1 ap-w-44 ap-bg-white ap-rounded-lg ap-shadow-lg ap-border ap-border-gray-200 ap-py-1 ap-z-10">
                                                        <p className="ap-px-3 ap-py-1.5 ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wide ap-border-b ap-border-gray-100">Assign Category</p>
                                                        <Button variant="ghost" size="sm"
                                                            onClick={(e) => { e.stopPropagation(); setCategoryMenuOpen(null); onSetCategory!(course.id, ''); }}
                                                            className={`!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none !ap-text-gray-500 ${
                                                                !course.category ? '!ap-bg-indigo-50 !ap-text-indigo-700' : ''
                                                            }`}
                                                        >
                                                            — Uncategorized —
                                                        </Button>
                                                        {categories
                                                            .slice()
                                                            .sort((a, b) => a.displayOrder - b.displayOrder)
                                                            .map(cat => (
                                                                <Button key={cat.id} variant="ghost" size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); setCategoryMenuOpen(null); onSetCategory!(course.id, cat.name); }}
                                                                    className={`!ap-w-full !ap-px-3 !ap-py-2 !ap-justify-start !ap-rounded-none ${
                                                                        course.category === cat.name ? '!ap-bg-indigo-50 !ap-text-indigo-700' : ''
                                                                    }`}
                                                                >
                                                                    <HiOutlineFolder className="ap-w-4 ap-h-4 ap-text-amber-500" />
                                                                    {cat.name}
                                                                </Button>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Course Content */}
                                    <div className="ap-p-4">
                                        <div className="ap-flex ap-items-start ap-justify-between ap-gap-2 ap-mb-2">
                                            <h3
                                                className="ap-font-semibold ap-text-gray-900 ap-cursor-pointer hover:ap-text-blue-600 ap-transition-colors"
                                                onClick={() => onSelect(course)}
                                            >
                                                {course.title}
                                            </h3>
                                            {getStatusBadge(course.progress || 0)}
                                        </div>
                                        {course.description && (
                                            <p className="ap-text-sm ap-text-gray-500 ap-mb-3 line-clamp-2">{course.description}</p>
                                        )}
                                        <div className="ap-flex ap-items-center ap-gap-4 ap-text-sm ap-text-gray-500 ap-mb-3">
                                            <div className="ap-flex ap-items-center ap-gap-1">
                                                <HiOutlineBookOpen className="ap-w-4 ap-h-4" />
                                                <span>{course.lessonCount || 0} lessons</span>
                                            </div>
                                        </div>
                                        <div className="ap-space-y-1">
                                            <div className="ap-flex ap-justify-between ap-text-xs ap-text-gray-500">
                                                <span>Progress</span>
                                                <span>{course.progress || 0}%</span>
                                            </div>
                                            <div className="ap-h-2 ap-bg-gray-100 ap-rounded-full ap-overflow-hidden">
                                                <div
                                                    className={`ap-h-full ${getProgressColor(course.progress || 0)} ap-rounded-full ap-transition-all ap-duration-300`}
                                                    style={{ width: `${course.progress || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CourseList;
