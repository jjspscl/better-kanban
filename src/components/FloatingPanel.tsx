import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion, useDragControls } from 'framer-motion';
import {
  X,
  Minus,
  Save,
  RotateCcw,
  GripVertical,
  Eye,
  EyeOff,
  Columns3,
  LayoutGrid,
  AlertTriangle,
  Search,
  Rows3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ColumnConfig } from '@/lib/storage';
import type { BoardContext } from '@/lib/sharepoint';

interface FloatingPanelProps {
  context: BoardContext;
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
  onSave: () => void;
  onReset: () => void;
  onMinimize: () => void;
  onClose: () => void;
  counts?: Record<string, number>;
  compactMode?: boolean;
  onToggleCompact?: () => void;
  onFilter?: (query: string) => void;
}

function SortableColumnItem({
  column,
  count,
  onToggleVisible,
  onToggleCollapsed,
  onWipLimitChange,
}: {
  column: ColumnConfig;
  count?: number;
  onToggleVisible: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onWipLimitChange?: (id: string, limit: number | undefined) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overWipLimit =
    column.visible &&
    column.wipLimit !== undefined &&
    column.wipLimit > 0 &&
    count !== undefined &&
    count > column.wipLimit;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border p-2 shadow-sm',
        isDragging &&
          'relative z-50 scale-[1.02] border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200',
        overWipLimit
          ? 'border-red-300 bg-red-50'
          : 'bg-white'
      )}
    >
      <div
        className="cursor-grab touch-none rounded p-1 text-gray-700 hover:bg-gray-200 hover:text-gray-900 active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {column.visible ? (
          column.collapsed ? (
            <Columns3 className="h-4 w-4 shrink-0 text-gray-600" />
          ) : (
            <Eye className="h-4 w-4 shrink-0 text-blue-600" />
          )
        ) : (
          <EyeOff className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <span className="truncate text-sm font-medium text-gray-900">
          {column.label}
        </span>
        {count !== undefined && (
          <span
            className={cn(
              'ml-auto text-xs tabular-nums',
              overWipLimit ? 'font-semibold text-red-600' : 'text-gray-400'
            )}
          >
            {count}
          </span>
        )}
        {overWipLimit && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        )}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <input
            type="number"
            min={0}
            placeholder="∞"
            value={column.wipLimit ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                onWipLimitChange?.(column.id, undefined);
              } else {
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 0) {
                  onWipLimitChange?.(column.id, n);
                }
              }
            }}
            className="h-6 w-10 rounded border border-gray-200 px-1 text-center text-[10px] text-gray-500 outline-none focus:border-blue-400"
            title="WIP limit"
          />
        </div>
        <Switch
          id={`fp-visible-${column.id}`}
          checked={column.visible}
          onCheckedChange={() => onToggleVisible(column.id)}
        />
        <Switch
          id={`fp-collapse-${column.id}`}
          checked={column.visible && column.collapsed}
          disabled={!column.visible}
          onCheckedChange={() => onToggleCollapsed(column.id)}
        />
      </div>
    </div>
  );
}

export function FloatingPanel({
  context,
  columns,
  onChange,
  onSave,
  onReset,
  onMinimize,
  onClose,
  counts,
  compactMode,
  onToggleCompact,
  onFilter,
}: FloatingPanelProps) {
  const [saved, setSaved] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workingColumns, setWorkingColumns] = useState<ColumnConfig[]>(columns);
  const [filterText, setFilterText] = useState('');
  const dragControls = useDragControls();

  useEffect(() => {
    if (!activeId) {
      setWorkingColumns(columns);
    }
  }, [columns, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedColumns = useMemo(
    () => [...workingColumns].sort((a, b) => a.order - b.order),
    [workingColumns]
  );

  function reorder(
    items: ColumnConfig[],
    activeId: string,
    overId: string
  ): ColumnConfig[] {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const oldIndex = sorted.findIndex((c) => c.id === activeId);
    const newIndex = sorted.findIndex((c) => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return items;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    return reordered.map((col, index) => ({ ...col, order: index }));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) {
      onChange(workingColumns);
      return;
    }
    const final = reorder(workingColumns, String(active.id), String(over.id));
    setWorkingColumns(final);
    onChange(final);
  }

  function toggleVisible(id: string) {
    const updated = workingColumns.map((col) =>
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    setWorkingColumns(updated);
    onChange(updated);
  }

  function toggleCollapsed(id: string) {
    const updated = workingColumns.map((col) =>
      col.id === id ? { ...col, collapsed: !col.collapsed } : col
    );
    setWorkingColumns(updated);
    onChange(updated);
  }

  function handleWipLimitChange(id: string, limit: number | undefined) {
    const updated = workingColumns.map((col) =>
      col.id === id ? { ...col, wipLimit: limit } : col
    );
    setWorkingColumns(updated);
    onChange(updated);
  }

  function handleClose() {
    setFilterText('');
    onFilter?.('');
    onClose();
  }

  function handleMinimize() {
    setFilterText('');
    onFilter?.('');
    onMinimize();
  }

  async function handleSave() {
    await onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const boundsRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boundsRef}
      className="sp-kanban-sorter-bounds pointer-events-none fixed"
      style={{ inset: 32 }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={boundsRef}
        whileDrag={{ scale: 1.02 }}
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          pointerEvents: 'auto',
          position: 'absolute',
          top: 48,
          right: 0,
        }}
        className="w-[360px] select-none overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl"
      >
        <div
          className="flex cursor-grab items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold">{context.listName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCompact}
              className={cn(
                'rounded-md p-1.5 transition-colors hover:bg-gray-200',
                compactMode
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-900'
              )}
              title={compactMode ? 'Standard view' : 'Compact view'}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              onClick={handleMinimize}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="text-xs text-gray-500">
            View:{' '}
            <span className="font-medium text-gray-900">
              {context.viewName}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Drag to reorder</span>
            <div className="flex gap-3">
              <span>Show</span>
              <span>Collapse</span>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter cards..."
              value={filterText}
              onChange={(e) => {
                const val = e.target.value;
                setFilterText(val);
                onFilter?.(val);
              }}
              className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
            />
          </div>

          <ScrollArea className="h-[280px] pr-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedColumns.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {sortedColumns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      count={counts?.[column.id]}
                      onToggleVisible={toggleVisible}
                      onToggleCollapsed={toggleCollapsed}
                      onWipLimitChange={handleWipLimitChange}
                    />
                  ))}
                </div>
              </SortableContext>

            </DndContext>
          </ScrollArea>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={saved}>
              <Save className="mr-2 h-4 w-4" />
              {saved ? 'Saved!' : 'Save'}
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
