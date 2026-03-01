'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MonitorColumn } from './monitor-column';
import { DatasetItem } from '@/lib/tiled/types';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableMonitorColumnProps {
  id: string;
  path: string;
  label: string;
  onRemove: () => void;
  onSelectItem: (item: DatasetItem) => void;
}

export function SortableMonitorColumn({
  id,
  path,
  label,
  onRemove,
  onSelectItem,
}: SortableMonitorColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
        'relative flex-shrink-0',
        isDragging && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute top-0 left-0 right-10 h-12 z-10 cursor-grab active:cursor-grabbing',
          'flex items-center justify-center',
          'opacity-0 hover:opacity-100 transition-opacity',
          'bg-gradient-to-b from-surface-raised/80 to-transparent rounded-t-2xl'
        )}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-overlay border border-border-medium shadow-lg">
          <GripVertical className="h-3 w-3 text-beam" />
          <span className="text-[10px] font-medium text-text-secondary">
            Drag to reorder
          </span>
        </div>
      </div>

      <MonitorColumn
        id={id}
        path={path}
        label={label}
        onRemove={onRemove}
        onSelectItem={onSelectItem}
      />
    </div>
  );
}
