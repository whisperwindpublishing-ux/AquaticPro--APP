import React, { useState, useCallback } from 'react';
import { Initiative, InitiativeStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import RichTextEditor from '@/components/RichTextEditor';
import {
    HiOutlinePlusCircle as PlusCircleIcon,
    HiOutlinePencil as PencilIcon,
    HiOutlineCheck as CheckIcon,
    HiOutlineXMark as XMarkIcon,
    HiOutlineTrash as TrashIcon,
    HiOutlineRocketLaunch as RocketLaunchIcon,
} from 'react-icons/hi2';

interface InitiativesStripProps {
    initiatives: Initiative[];
    isReadOnly: boolean;
    onAddInitiative: () => void;
    onUpdateInitiative: (initiative: Initiative) => void;
    onDeleteInitiative: (id: number) => void;
    /** Currently selected initiative for filtering (null = show all) */
    selectedInitiativeId?: number | null;
    /** Called when user clicks an initiative chip to filter the workspace */
    onSelectInitiative?: (id: number | null) => void;
}

/**
 * Horizontal strip of initiative chips that sits between the GoalHeaderCard
 * and the WorkspaceColumns. Always visible so users can see the roadmap
 * and filter workspace content by initiative.
 *
 * - Chips show title + status color dot
 * - Clicking a chip selects it as a filter (click again to deselect)
 * - Expand arrow opens inline editing for an initiative
 * - "+New" button appends a new initiative
 */
const InitiativesStrip: React.FC<InitiativesStripProps> = ({
    initiatives,
    isReadOnly,
    onAddInitiative,
    onUpdateInitiative,
    onDeleteInitiative,
    selectedInitiativeId = null,
    onSelectInitiative,
}) => {
    // Track which initiative (if any) has its edit form expanded inline
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const handleChipClick = useCallback((id: number) => {
        if (onSelectInitiative) {
            onSelectInitiative(selectedInitiativeId === id ? null : id);
        }
    }, [selectedInitiativeId, onSelectInitiative]);

    const statusColors: Record<InitiativeStatus, string> = {
        'Not Started': 'ap-bg-gray-400',
        'In Progress': 'ap-bg-yellow-400',
        'Completed': 'ap-bg-green-500',
    };

    return (
        <div className="ap-bg-white ap-rounded-lg ap-shadow-sm ap-border ap-border-gray-200">
            {/* Header row */}
            <div className="ap-flex ap-items-center ap-justify-between ap-px-4 ap-py-2.5 ap-border-b ap-border-gray-100">
                <div className="ap-flex ap-items-center ap-gap-2">
                    <RocketLaunchIcon className="ap-h-4 ap-w-4 ap-text-purple-600" />
                    <span className="ap-text-xs ap-font-semibold ap-text-gray-500 ap-uppercase ap-tracking-wider">
                        Initiatives
                    </span>
                    <span className="ap-text-xs ap-text-gray-400">({initiatives.length})</span>
                </div>
                {!isReadOnly && (
                    <Button onClick={onAddInitiative} variant="link" size="xs" leftIcon={<PlusCircleIcon className="ap-h-4 ap-w-4" />}>
                        Add
                    </Button>
                )}
            </div>

            {/* Initiative table */}
            {initiatives.length > 0 ? (
                <table className="ap-w-full ap-text-sm">
                    <tbody>
                        {initiatives.map(initiative => (
                            <tr
                                key={initiative.id}
                                onClick={() => handleChipClick(initiative.id)}
                                className={`ap-cursor-pointer ap-transition-colors ap-border-b ap-border-gray-50 last:ap-border-b-0 ${
                                    selectedInitiativeId === initiative.id
                                        ? 'ap-bg-purple-50'
                                        : 'hover:ap-bg-gray-50'
                                }`}
                            >
                                {/* Title */}
                                <td className="ap-px-4 ap-py-2">
                                    <div className="ap-flex ap-items-center ap-gap-2">
                                        <span className={`ap-inline-block ap-w-2 ap-h-2 ap-rounded-full ap-flex-shrink-0 ${statusColors[initiative.status]}`} />
                                        <span className={`ap-font-medium ${selectedInitiativeId === initiative.id ? 'ap-text-purple-800' : 'ap-text-gray-700'}`}>
                                            {initiative.title}
                                        </span>
                                    </div>
                                </td>
                                {/* Status */}
                                <td className="ap-px-2 ap-py-2 ap-w-[160px]" onClick={e => e.stopPropagation()}>
                                    {!isReadOnly ? (
                                        <select
                                            value={initiative.status}
                                            onChange={(e) => {
                                                onUpdateInitiative({ ...initiative, status: e.target.value as InitiativeStatus });
                                            }}
                                            className="ap-text-sm ap-w-full ap-bg-white ap-border ap-border-gray-200 ap-rounded-md ap-px-2.5 ap-py-1.5 focus:ap-ring-1 focus:ap-ring-purple-400 focus:ap-border-purple-400"
                                        >
                                            <option>Not Started</option>
                                            <option>In Progress</option>
                                            <option>Completed</option>
                                        </select>
                                    ) : (
                                        <span className="ap-text-xs ap-text-gray-500">{initiative.status}</span>
                                    )}
                                </td>
                                {/* Edit */}
                                {!isReadOnly && (
                                    <td className="ap-px-2 ap-py-2 ap-w-[40px] ap-text-center" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setExpandedId(prev => prev === initiative.id ? null : initiative.id)}
                                            className={`ap-p-1 ap-rounded ap-transition-colors ${
                                                expandedId === initiative.id
                                                    ? 'ap-bg-purple-100 ap-text-purple-600'
                                                    : 'ap-text-gray-400 hover:ap-text-purple-600 hover:ap-bg-gray-100'
                                            }`}
                                            title="Edit initiative details"
                                        >
                                            <PencilIcon className="ap-h-3.5 ap-w-3.5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="ap-text-xs ap-text-gray-400 ap-text-center ap-py-3">
                    No initiatives yet. Add one to break down this goal.
                </p>
            )}

            {/* Expanded inline edit form */}
            {expandedId !== null && (
                <div className="ap-border-t ap-border-gray-100 ap-p-4">
                    <InitiativeEditPanel
                        initiative={initiatives.find(i => i.id === expandedId)!}
                        isReadOnly={isReadOnly}
                        onUpdate={(updated) => {
                            onUpdateInitiative(updated);
                            setExpandedId(null);
                        }}
                        onCancel={() => setExpandedId(null)}
                        onDelete={(id) => {
                            onDeleteInitiative(id);
                            setExpandedId(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default InitiativesStrip;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface InitiativeEditPanelProps {
    initiative: Initiative;
    isReadOnly: boolean;
    onUpdate: (initiative: Initiative) => void;
    onCancel: () => void;
    onDelete: (id: number) => void;
}

const InitiativeEditPanel: React.FC<InitiativeEditPanelProps> = ({
    initiative,
    isReadOnly,
    onUpdate,
    onCancel,
    onDelete,
}) => {
    const [title, setTitle] = useState(initiative.title);
    const [description, setDescription] = useState(initiative.description);

    if (!initiative) return null;

    const handleSave = () => {
        if (title.trim()) {
            onUpdate({ ...initiative, title, description });
        }
    };

    return (
        <div className="ap-space-y-2">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="ap-w-full ap-p-2 ap-font-semibold ap-bg-white ap-border ap-border-gray-300 ap-rounded-md focus:ap-outline-none focus:ap-ring-1 focus:ap-ring-blue-500"
                placeholder="Initiative Title"
                disabled={isReadOnly}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSave();
                    }
                    if (e.key === 'Escape') onCancel();
                }}
            />
            <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Initiative Description"
            />
            <div className="ap-flex ap-justify-between ap-items-center">
                <Button
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this initiative? Tasks linked to it will be unassigned.')) {
                            onDelete(initiative.id);
                        }
                    }}
                    variant="ghost"
                    size="xs"
                    className="ap-text-red-500 hover:ap-text-red-700"
                >
                    <TrashIcon className="ap-h-4 ap-w-4 ap-mr-1" />
                    Delete
                </Button>
                <div className="ap-flex ap-gap-2">
                    <Button onClick={onCancel} variant="secondary" size="xs" leftIcon={<XMarkIcon className="ap-h-4 ap-w-4" />}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} variant="primary" size="xs" leftIcon={<CheckIcon className="ap-h-4 ap-w-4" />}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
};
