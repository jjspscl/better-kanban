import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Columns3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ColumnConfig } from '@/lib/storage';

interface ColumnItemProps {
  column: ColumnConfig;
  onToggleVisible: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
}

export function ColumnItem({
  column,
  onToggleVisible,
  onToggleCollapsed,
}: ColumnItemProps) {
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
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card p-2 shadow-sm',
        isDragging && 'opacity-80 shadow-md',
        !column.visible && 'opacity-60'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {column.visible ? (
          column.collapsed ? (
            <Columns3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 shrink-0 text-primary" />
          )
        ) : (
          <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-medium">{column.label}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Switch
            id={`visible-${column.id}`}
            checked={column.visible}
            onCheckedChange={() => onToggleVisible(column.id)}
            aria-label={`Toggle visibility for ${column.label}`}
          />
          <Label
            htmlFor={`visible-${column.id}`}
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Show
          </Label>
        </div>

        {column.visible && (
          <div className="flex items-center gap-1.5">
            <Switch
              id={`collapse-${column.id}`}
              checked={column.collapsed}
              onCheckedChange={() => onToggleCollapsed(column.id)}
              aria-label={`Toggle collapse for ${column.label}`}
            />
            <Label
              htmlFor={`collapse-${column.id}`}
              className="cursor-pointer text-xs text-muted-foreground"
            >
              Collapse
            </Label>
          </div>
        )}
      </div>
    </div>
  );
}
