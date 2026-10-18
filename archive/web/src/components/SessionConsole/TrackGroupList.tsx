import { Button } from '@/components/ui/button';

import type { StageImage, Track, TrackGroup } from '../../types/sessionConsole';

interface TrackGroupListProps {
  group: TrackGroup;
  images: StageImage[];
  activeTrackId: string | null;
  onPlayTrack: (trackId: string) => void;
  onEdit: (track: Track) => void;
  onReorder: (orderedIds: string[]) => void;
  onDropFiles?: (files: File[]) => void;
}

function recommendedLabel(track: Track, images: StageImage[]): string | null {
  if (!track.recommendedImageId) {
    return null;
  }
  const plate = images.find((image) => image.id === track.recommendedImageId);
  return plate ? `Recommended: ${plate.name}` : null;
}

export function TrackGroupList({
  group,
  images,
  activeTrackId,
  onPlayTrack,
  onEdit,
  onReorder,
  onDropFiles,
}: TrackGroupListProps): JSX.Element {
  const handleDropOn = (targetId: string, draggedId: string): void => {
    if (draggedId === targetId) {
      return;
    }
    const ids = group.tracks.map((track) => track.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    onReorder(ids);
  };

  const acceptFileDrop = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    dataTransfer: DataTransfer;
  }): boolean => {
    if (event.dataTransfer.files.length === 0) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropFiles?.(Array.from(event.dataTransfer.files));
    return true;
  };

  return (
    <div
      className="space-y-2"
      data-testid="session-console-track-group"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        acceptFileDrop(event);
      }}
    >
      <h4
        className="text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        {group.title}
      </h4>
      <ul className="space-y-1">
        {group.tracks.map((track) => {
          const isActive = track.id === activeTrackId;
          const recommended = recommendedLabel(track, images);
          return (
            <li key={track.id} className="space-y-1">
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', track.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (acceptFileDrop(event)) {
                    return;
                  }
                  event.preventDefault();
                  handleDropOn(track.id, event.dataTransfer.getData('text/plain'));
                }}
                onClick={() => onPlayTrack(track.id)}
                aria-label={`Play ${track.title}`}
                aria-pressed={isActive}
                className={`w-full rounded-sm px-2 py-1.5 text-left transition ${
                  isActive
                    ? 'bg-[var(--app-accent-bg)] border border-[var(--app-border-hover)] shadow-[var(--app-elevation-active)]'
                    : 'bg-[var(--app-bg-subtle)]'
                }`}
              >
                <span className="block text-sm font-medium truncate">{track.title}</span>
                {recommended && (
                  <span className="block text-[11px] truncate text-[var(--app-accent-text)]">
                    {recommended}
                  </span>
                )}
              </button>
              <Button
                type="button"
                variant="ghost"
                className="w-full py-0.5 text-[11px]"
                aria-label={`Edit track ${track.title}`}
                onClick={() => onEdit(track)}
              >
                Edit
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
