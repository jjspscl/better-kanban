import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { ColumnItem } from './ColumnItem';
import type { ColumnConfig } from '@/lib/storage';

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
}

export function ColumnManager({ columns, onChange }: ColumnManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedColumns.findIndex((c) => c.id === active.id);
    const newIndex = sortedColumns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(sortedColumns, oldIndex, newIndex);

    onChange(
      reordered.map((col, index) => ({
        ...col,
        order: index,
      }))
    );
  }

  function toggleVisible(id: string) {
    onChange(
      columns.map((col) =>
        col.id === id ? { ...col, visible: !col.visible } : col
      )
    );
  }

  function toggleCollapsed(id: string) {
    onChange(
      columns.map((col) =>
        col.id === id ? { ...col, collapsed: !col.collapsed } : col
      )
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedColumns.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {sortedColumns.map((column) => (
            <ColumnItem
              key={column.id}
              column={column}
              onToggleVisible={toggleVisible}
              onToggleCollapsed={toggleCollapsed}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
