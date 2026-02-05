"use client";

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { SCENE_CONFIG, calculateSceneTiming } from '../compositions/constants';
import type { SceneConfig } from '../compositions/MasterComposition';

interface RemixableTimelineProps {
  scenes: SceneConfig[];
  onScenesChange: (scenes: SceneConfig[]) => void;
  currentFrame?: number;
  totalDuration: number;
}

/**
 * Remixable Timeline Component
 * Shows a timeline of all scenes with drag-and-drop reordering
 */
export const RemixableTimeline: React.FC<RemixableTimelineProps> = ({
  scenes,
  onScenesChange,
  currentFrame = 0,
  totalDuration,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { sceneLength, transitionLength, fps } = SCENE_CONFIG;

  // Calculate time in seconds
  const formatTime = (frame: number): string => {
    const seconds = frame / fps;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds}`;
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newScenes = [...scenes];
    const [removed] = newScenes.splice(draggedIndex, 1);
    newScenes.splice(dropIndex, 0, removed);

    onScenesChange(newScenes);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Move scene up
  const moveSceneUp = (index: number) => {
    if (index === 0) return;
    const newScenes = [...scenes];
    [newScenes[index - 1], newScenes[index]] = [newScenes[index], newScenes[index - 1]];
    onScenesChange(newScenes);
  };

  // Move scene down
  const moveSceneDown = (index: number) => {
    if (index === scenes.length - 1) return;
    const newScenes = [...scenes];
    [newScenes[index], newScenes[index + 1]] = [newScenes[index + 1], newScenes[index]];
    onScenesChange(newScenes);
  };

  // Remove scene
  const removeScene = (index: number) => {
    const newScenes = scenes.filter((_, i) => i !== index);
    onScenesChange(newScenes);
  };

  return (
    <div className="space-y-4">
      {/* Timeline Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Film" size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold">Timeline</h3>
          <span className="text-xs text-muted-foreground">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''} • {formatTime(totalDuration)} total
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Current: {formatTime(currentFrame)}
        </div>
      </div>

      {/* Timeline Scenes */}
      <div className="space-y-2">
        {scenes.map((scene, index) => {
          const timing = calculateSceneTiming(index);
          const isCurrentScene = currentFrame >= timing.start && currentFrame < timing.end;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const sceneStartTime = formatTime(timing.start);
          const sceneEndTime = formatTime(timing.end);

          return (
            <div
              key={`${scene.id}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                group relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move
                ${isCurrentScene ? 'bg-primary/10 border-primary' : 'bg-muted/30 border-border hover:border-primary/50'}
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver && !isDragging ? 'border-primary border-2' : ''}
              `}
            >
              {/* Drag Handle */}
              <div className="text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
                <Icon name="GripVertical" size={16} />
              </div>

              {/* Scene Index */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-bold">
                {index + 1}
              </div>

              {/* Scene Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{scene.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                    {scene.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{sceneStartTime} - {sceneEndTime}</span>
                  <span>•</span>
                  <span>{sceneLength / fps}s</span>
                  {index < scenes.length - 1 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Icon name="Zap" size={12} />
                        {(transitionLength / fps).toFixed(2)}s transition
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Current Playhead Indicator */}
              {isCurrentScene && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
              )}

              {/* Scene Controls */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSceneUp(index)}
                  disabled={index === 0}
                  className="h-8 w-8 p-0"
                  title="Move up"
                >
                  <Icon name="ChevronUp" size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSceneDown(index)}
                  disabled={index === scenes.length - 1}
                  className="h-8 w-8 p-0"
                  title="Move down"
                >
                  <Icon name="ChevronDown" size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScene(index)}
                  disabled={scenes.length === 1}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="Remove scene"
                >
                  <Icon name="X" size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline Visualization */}
      <div className="p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>0:00.0</span>
          {scenes.length > 1 && <span>{formatTime(totalDuration / 2)}</span>}
          <span>{formatTime(totalDuration)}</span>
        </div>
        <div className="relative h-3 bg-background rounded-full overflow-hidden">
          {/* Scene blocks */}
          {scenes.map((scene, index) => {
            const timing = calculateSceneTiming(index);
            const widthPercent = ((sceneLength / totalDuration) * 100);
            const leftPercent = ((timing.start / totalDuration) * 100);
            const isCurrentScene = currentFrame >= timing.start && currentFrame < timing.end;

            return (
              <div
                key={`timeline-${scene.id}-${index}`}
                className={`absolute top-0 h-full transition-all ${
                  isCurrentScene ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                }}
                title={`${scene.name} (${formatTime(timing.start)} - ${formatTime(timing.end)})`}
              />
            );
          })}

          {/* Current playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-primary z-10"
            style={{
              left: `${(currentFrame / totalDuration) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3">
        <p className="font-medium mb-1">Timeline Instructions:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Drag and drop scenes to reorder them</li>
          <li>Use arrow buttons to move scenes up or down</li>
          <li>Click X to remove a scene from the timeline</li>
          <li>The blue bar indicates the current playhead position</li>
        </ul>
      </div>
    </div>
  );
};
