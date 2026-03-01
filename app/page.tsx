'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { ParticleBeam } from '@/components/visualizations/particle-beam';
import { EmptyState } from '@/components/monitor/empty-state';
import { MonitorColumn } from '@/components/monitor/monitor-column';
import { SortableMonitorColumn } from '@/components/monitor/sortable-monitor-column';
import { AddMonitorModal } from '@/components/monitor/add-monitor-modal';
import { DetailPanel } from '@/components/detail/detail-panel';
import { useMonitors } from '@/components/providers/monitors-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { DatasetItem, MonitorConfig } from '@/lib/tiled/types';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { monitors, addMonitor, removeMonitor, reorderMonitors } = useMonitors();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DatasetItem | null>(null);
  const [anyConnected, setAnyConnected] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Track if any column is connected
  useEffect(() => {
    setAnyConnected(monitors.length > 0);
  }, [monitors]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const monitor = monitors.find((m) => m.id === active.id);
    setActiveMonitor(monitor || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMonitor(null);

    if (over && active.id !== over.id) {
      reorderMonitors(active.id as string, over.id as string);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-beam-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-void scan-lines grain">
      <ParticleBeam />

      <Header isConnected={anyConnected} />

      <main className="flex-1 relative z-10">
        {monitors.length === 0 ? (
          <EmptyState onAddMonitor={() => setIsAddModalOpen(true)} />
        ) : (
          <div className="p-6 h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={monitors.map((m) => m.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex gap-4 overflow-x-auto h-[calc(100vh-120px)]">
                  <AnimatePresence mode="popLayout">
                    {monitors.map((monitor) => (
                      <SortableMonitorColumn
                        key={monitor.id}
                        id={monitor.id}
                        path={monitor.path}
                        label={monitor.label}
                        onRemove={() => removeMonitor(monitor.id)}
                        onSelectItem={setSelectedItem}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Add Column Button */}
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    variant="outline"
                    className="flex-shrink-0 h-full w-16 border-dashed border-border-subtle hover:border-beam-cyan hover:bg-beam-cyan/5 transition-colors"
                  >
                    <Plus className="h-6 w-6 text-text-dim" />
                  </Button>
                </div>
              </SortableContext>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeMonitor ? (
                  <div className="opacity-80">
                    <MonitorColumn
                      id={activeMonitor.id}
                      path={activeMonitor.path}
                      label={activeMonitor.label}
                      onRemove={() => {}}
                      onSelectItem={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </main>

      {/* Add Monitor Modal */}
      <AddMonitorModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAdd={addMonitor}
      />

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
