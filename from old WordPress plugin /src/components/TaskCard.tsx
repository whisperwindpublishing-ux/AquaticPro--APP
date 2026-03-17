import React, { useState, useCallback, useMemo } from 'react';
import { Task, Initiative } from '@/types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { TaskList } from '@/components/GoalDisplay';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskCardProps {
    tasks: Task[];
    initiatives: Initiative[];
    isReadOnly: boolean;
    goalTitle: string;
    participants: { id: number; name: string }[];
    /** Currently applied initiative filter (null = show all) */
    selectedInitiativeId: number | null;
    /** Focused task id from timeline click */
    focusedTaskId: number | null;
    /** Callback to add a new task to the goal */
    onAddTask: () => void;
    /** Callback to update a single task */
    onUpdateTask: (task: Task) => void;
    /** Callback to delete a task by id */
    onDeleteTask: (taskId: number) => void;
    /** Callback to persist reordered/moved tasks array */
    onReorderTasks: (tasks: Task[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * TaskCard content component — renders inside ExpandableCard.
 *
 * Responsibilities:
 * - Full DnD with @dnd-kit (cross-initiative drag, reorder within)
 * - Initiative filter dimming (opacity 0.4 for non-matching groups)
 * - Drag overlay portal
 * - Delegates task CRUD up to parent via callbacks
 */
const TaskCard: React.FC<TaskCardProps> = ({
    tasks,
    initiatives,
    isReadOnly,
    goalTitle,
    participants,
    selectedInitiativeId: _selectedInitiativeId,
    focusedTaskId,
    onAddTask,
    onUpdateTask,
    onDeleteTask,
    onReorderTasks,
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ── DnD handlers ────────────────────────────────────────────────────────

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            if (isReadOnly) return;
            setActiveId(event.active.id.toString());
        },
        [isReadOnly]
    );

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            if (isReadOnly) return;
            setActiveId(null);

            const { active, over } = event;
            if (!over) return;

            const activeTask = tasks.find(t => t.id.toString() === active.id);
            if (!activeTask) return;

            const activeContainer = active.data.current?.sortable.containerId;
            const overIsInitiative = over.data.current?.type === 'initiative-container';
            const overContainer = overIsInitiative
                ? over.id.toString()
                : over.data.current?.sortable.containerId.toString();

            if (!overContainer) return;

            const oldIndex = tasks.findIndex(t => t.id.toString() === active.id);

            if (activeContainer === overContainer) {
                if (active.id === over.id) return;
                const newIndex = tasks.findIndex(t => t.id.toString() === over.id);
                if (oldIndex !== -1 && newIndex !== -1) {
                    onReorderTasks(arrayMove(tasks, oldIndex, newIndex));
                }
            } else {
                const newInitiativeId = overContainer === 'no-initiative' ? null : Number(overContainer);
                let newIndex: number;

                if (overIsInitiative) {
                    const tasksInNewContainer = tasks.filter(
                        t => (t.initiativeId?.toString() ?? 'no-initiative') === overContainer
                    );
                    const lastTask = tasksInNewContainer[tasksInNewContainer.length - 1];
                    newIndex = lastTask ? tasks.indexOf(lastTask) : tasks.length - 1;
                } else {
                    newIndex = tasks.findIndex(t => t.id.toString() === over.id);
                }

                if (oldIndex !== -1) {
                    const newTasks = tasks.map(t =>
                        t.id.toString() === active.id
                            ? { ...t, initiativeId: newInitiativeId }
                            : t
                    );
                    const movedTask = newTasks[oldIndex];
                    newTasks.splice(oldIndex, 1);
                    const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
                    newTasks.splice(adjustedNewIndex, 0, movedTask);
                    onReorderTasks(newTasks);
                }
            }
        },
        [isReadOnly, tasks, onReorderTasks]
    );

    // ── Drag overlay content ────────────────────────────────────────────────

    const dragOverlayContent = useMemo(() => {
        if (!activeId) return null;
        const task = tasks.find(t => t.id.toString() === activeId);
        if (!task) return null;

        return (
            <div
                style={{
                    backgroundColor: 'white',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6',
                    outline: '4px solid rgba(59, 130, 246, 0.3)',
                    transform: 'rotate(2deg) scale(1.05)',
                    pointerEvents: 'none',
                    minWidth: '300px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', color: '#3b82f6' }}>
                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }} />
                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }} />
                        <span style={{ display: 'block', width: '16px', height: '2px', backgroundColor: 'currentColor', borderRadius: '2px' }} />
                    </div>
                    <input
                        type="checkbox"
                        checked={task.isCompleted}
                        readOnly
                        style={{ width: '20px', height: '20px', borderRadius: '4px', border: '2px solid #9ca3af', accentColor: '#3b82f6' }}
                    />
                    <span
                        style={{
                            fontSize: '14px',
                            color: task.isCompleted ? '#6b7280' : '#111827',
                            textDecoration: task.isCompleted ? 'line-through' : 'none',
                            flex: 1,
                        }}
                    >
                        {task.text}
                    </span>
                </div>
            </div>
        );
    }, [activeId, tasks]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            {/* Initiative filter dimming wrapper */}
            <div
                className="ap-transition-opacity ap-duration-200"
            >
                <TaskList
                    tasks={tasks}
                    initiatives={initiatives}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    onAddTask={onAddTask}
                    activeId={activeId}
                    isReadOnly={isReadOnly}
                    goalTitle={goalTitle}
                    participants={participants}
                    focusedTaskId={focusedTaskId}
                />
            </div>
            {createPortal(
                <DragOverlay
                    dropAnimation={{
                        duration: 250,
                        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    }}
                >
                    {dragOverlayContent}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};

export default TaskCard;
