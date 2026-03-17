/**
 * Draggable Hierarchy List
 * 
 * Wrapper component that enables drag & drop reordering for hierarchy items
 * Uses @dnd-kit for smooth, accessible drag and drop
 */
import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Course, Section, Lesson, SectionColor } from './types';
import HierarchyCard from './HierarchyCard';

interface DraggableItemProps {
    item: Course | Section | Lesson;
    type: 'course' | 'section' | 'lesson';
    isEditMode: boolean;
    childLabel: string;
    onClick: () => void;
    onUpdate: (data: Record<string, unknown>) => void;
    onDelete: () => void;
    onOpenNotion?: () => void;
    sectionColor?: SectionColor | null;
}

const DraggableItem: React.FC<DraggableItemProps> = ({
    item,
    type,
    isEditMode,
    childLabel,
    onClick,
    onUpdate,
    onDelete,
    onOpenNotion,
    sectionColor,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <HierarchyCard
                item={item}
                type={type}
                isEditMode={isEditMode}
                childLabel={childLabel}
                onClick={onClick}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onOpenNotion={onOpenNotion}
                sectionColor={sectionColor}
                dragHandleProps={isEditMode ? { ...attributes, ...listeners } : undefined}
                isDragging={isDragging}
            />
        </div>
    );
};

interface DraggableHierarchyListProps<T extends Course | Section | Lesson> {
    items: T[];
    type: 'course' | 'section' | 'lesson';
    isEditMode: boolean;
    childLabel: string;
    onItemClick: (item: T) => void;
    onItemUpdate: (id: number, data: Record<string, unknown>) => void;
    onItemDelete: (id: number) => void;
    onReorder: (newOrder: number[]) => void;
    /** Open in Notion mode callback (for courses) */
    onOpenNotion?: (item: T) => void;
    /** For lessons: the parent section's color */
    sectionColor?: SectionColor | null;
    /** Grid layout or list layout */
    layout?: 'grid' | 'list';
}

function DraggableHierarchyList<T extends Course | Section | Lesson>({
    items,
    type,
    isEditMode,
    childLabel,
    onItemClick,
    onItemUpdate,
    onItemDelete,
    onReorder,
    onOpenNotion,
    sectionColor,
    layout = 'grid',
}: DraggableHierarchyListProps<T>) {
    const [activeId, setActiveId] = React.useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement before drag starts
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);
            
            const newOrder = arrayMove(items, oldIndex, newIndex).map(item => item.id);
            onReorder(newOrder);
        }
    };

    const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

    // Determine section color for each item if type is 'section'
    const getSectionColorForItem = (item: T): SectionColor | null | undefined => {
        if (type === 'section') {
            return (item as Section).theme_color;
        }
        return sectionColor;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
                <div className={
                    layout === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                        : 'flex flex-col gap-3'
                }>
                    {items.map((item) => (
                        <DraggableItem
                            key={item.id}
                            item={item}
                            type={type}
                            isEditMode={isEditMode}
                            childLabel={childLabel}
                            onClick={() => onItemClick(item)}
                            onUpdate={(data) => onItemUpdate(item.id, data)}
                            onDelete={() => onItemDelete(item.id)}
                            onOpenNotion={onOpenNotion ? () => onOpenNotion(item) : undefined}
                            sectionColor={getSectionColorForItem(item)}
                        />
                    ))}
                </div>
            </SortableContext>

            {/* Drag overlay for visual feedback */}
            <DragOverlay>
                {activeItem ? (
                    <div className="opacity-80">
                        <HierarchyCard
                            item={activeItem}
                            type={type}
                            isEditMode={false}
                            childLabel={childLabel}
                            onClick={() => {}}
                            onUpdate={() => {}}
                            onDelete={() => {}}
                            sectionColor={getSectionColorForItem(activeItem)}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default DraggableHierarchyList;
