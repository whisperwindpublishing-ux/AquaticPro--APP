import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineChevronUp,
    HiOutlineChevronDown,
    HiOutlineFolder,
} from 'react-icons/hi2';
import lmsApi, { CourseCategory } from '../../services/api-lms';

interface CategoryManagerProps {
    onClose: () => void;
    onChanged: () => void; // called after any save so parent reloads
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onClose, onChanged }) => {
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [error, setError] = useState('');
    const newInputRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await lmsApi.getCategories();
            setCategories(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        setError('');
        setSaving(true);
        try {
            const created = await lmsApi.createCategory(name);
            setCategories(prev => [...prev, created]);
            setNewName('');
            newInputRef.current?.focus();
            onChanged();
        } catch (e: any) {
            setError(e.message || 'Could not create category');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (cat: CourseCategory) => {
        setEditingId(cat.id);
        setEditingName(cat.name);
        setError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    const saveEdit = async (id: number) => {
        const name = editingName.trim();
        if (!name) return;
        setError('');
        setSaving(true);
        try {
            await lmsApi.updateCategory(id, name);
            setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
            setEditingId(null);
            onChanged();
        } catch (e: any) {
            setError(e.message || 'Could not rename category');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (cat: CourseCategory) => {
        if (!confirm(`Delete category "${cat.name}"?\n\nCourses in this category will become Uncategorized. This cannot be undone.`)) return;
        setSaving(true);
        setError('');
        try {
            await lmsApi.deleteCategory(cat.id);
            setCategories(prev => prev.filter(c => c.id !== cat.id));
            onChanged();
        } catch (e: any) {
            setError(e.message || 'Could not delete category');
        } finally {
            setSaving(false);
        }
    };

    const move = async (index: number, direction: 'up' | 'down') => {
        const newCats = [...categories];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCats.length) return;
        [newCats[index], newCats[targetIndex]] = [newCats[targetIndex], newCats[index]];
        // Assign new display orders
        const reindexed = newCats.map((c, i) => ({ ...c, displayOrder: i }));
        setCategories(reindexed);
        // Persist
        try {
            await lmsApi.reorderCategories(reindexed.map(c => ({ id: c.id, displayOrder: c.displayOrder })));
            onChanged();
        } catch (e: any) {
            setError(e.message || 'Could not reorder categories');
        }
    };

    return (
        <div className="ap-fixed ap-inset-0 ap-z-50 ap-flex ap-items-center ap-justify-center ap-bg-black/40 ap-backdrop-blur-sm">
            <div className="ap-bg-white ap-rounded-xl ap-shadow-2xl ap-w-full ap-max-w-md ap-mx-4 ap-flex ap-flex-col ap-max-h-[90vh]">
                {/* Header */}
                <div className="ap-flex ap-items-center ap-justify-between ap-p-5 ap-border-b ap-border-gray-200 ap-flex-shrink-0">
                    <div className="ap-flex ap-items-center ap-gap-2">
                        <HiOutlineFolder className="ap-w-5 ap-h-5 ap-text-amber-500" />
                        <h2 className="ap-text-lg ap-font-bold ap-text-gray-900">Manage Categories</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="!ap-p-1.5">
                        <HiOutlineXMark className="ap-w-5 ap-h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="ap-overflow-y-auto ap-flex-1 ap-p-5 ap-space-y-2">
                    {loading ? (
                        <div className="ap-text-center ap-py-8">
                            <div className="ap-animate-spin ap-rounded-full ap-h-8 ap-w-8 ap-border-b-2 ap-border-blue-600 ap-mx-auto" />
                        </div>
                    ) : categories.length === 0 ? (
                        <p className="ap-text-sm ap-text-gray-500 ap-text-center ap-py-6">No categories yet — add one below.</p>
                    ) : (
                        categories.map((cat, idx) => (
                            <div key={cat.id} className="ap-flex ap-items-center ap-gap-2 ap-group ap-bg-gray-50 ap-rounded-lg ap-px-3 ap-py-2 hover:ap-bg-gray-100 ap-transition-colors">
                                {/* Reorder arrows */}
                                <div className="ap-flex ap-flex-col ap-gap-0.5 ap-flex-shrink-0">
                                    <button
                                        onClick={() => move(idx, 'up')}
                                        disabled={idx === 0 || saving}
                                        className="ap-p-0.5 ap-rounded ap-text-gray-400 hover:ap-text-gray-700 disabled:ap-opacity-20"
                                        title="Move up"
                                    >
                                        <HiOutlineChevronUp className="ap-w-3.5 ap-h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => move(idx, 'down')}
                                        disabled={idx === categories.length - 1 || saving}
                                        className="ap-p-0.5 ap-rounded ap-text-gray-400 hover:ap-text-gray-700 disabled:ap-opacity-20"
                                        title="Move down"
                                    >
                                        <HiOutlineChevronDown className="ap-w-3.5 ap-h-3.5" />
                                    </button>
                                </div>

                                {/* Name / inline edit */}
                                {editingId === cat.id ? (
                                    <input
                                        className="ap-flex-1 ap-border ap-border-blue-400 ap-rounded ap-px-2 ap-py-1 ap-text-sm ap-outline-none focus:ap-ring-2 focus:ap-ring-blue-300"
                                        value={editingName}
                                        autoFocus
                                        onChange={e => setEditingName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEdit(cat.id);
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                    />
                                ) : (
                                    <span className="ap-flex-1 ap-text-sm ap-font-medium ap-text-gray-800">{cat.name}</span>
                                )}

                                {/* Actions */}
                                <div className="ap-flex ap-items-center ap-gap-1 ap-flex-shrink-0">
                                    {editingId === cat.id ? (
                                        <>
                                            <Button variant="ghost" size="xs" onClick={() => saveEdit(cat.id)} disabled={saving} title="Save" className="!ap-p-1 !ap-text-green-600 hover:!ap-bg-green-50">
                                                <HiOutlineCheck className="ap-w-4 ap-h-4" />
                                            </Button>
                                            <Button variant="ghost" size="xs" onClick={cancelEdit} title="Cancel" className="!ap-p-1">
                                                <HiOutlineXMark className="ap-w-4 ap-h-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="ghost" size="xs" onClick={() => startEdit(cat)} title="Rename" className="!ap-p-1 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity">
                                                <HiOutlinePencilSquare className="ap-w-4 ap-h-4 ap-text-gray-500" />
                                            </Button>
                                            <Button variant="ghost" size="xs" onClick={() => handleDelete(cat)} title="Delete" className="!ap-p-1 ap-opacity-0 group-hover:ap-opacity-100 ap-transition-opacity !ap-text-red-500 hover:!ap-bg-red-50">
                                                <HiOutlineTrash className="ap-w-4 ap-h-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="ap-mx-5 ap-mb-2 ap-p-2 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded ap-text-sm ap-text-red-700">
                        {error}
                    </div>
                )}

                {/* Add new */}
                <div className="ap-p-4 ap-border-t ap-border-gray-200 ap-flex-shrink-0">
                    <div className="ap-flex ap-gap-2">
                        <input
                            ref={newInputRef}
                            type="text"
                            placeholder="New category name…"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            className="ap-flex-1 ap-border ap-border-gray-200 ap-rounded-lg ap-px-3 ap-py-2 ap-text-sm focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent ap-outline-none"
                        />
                        <Button variant="primary" onClick={handleCreate} disabled={!newName.trim() || saving}>
                            <HiOutlinePlus className="ap-w-4 ap-h-4" />
                            Add
                        </Button>
                    </div>
                    <p className="ap-mt-2 ap-text-xs ap-text-gray-400">
                        Deleting a category moves its courses to Uncategorized.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;
