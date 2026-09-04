import type { StageImage, Track, TrackGroup } from '../../types/sessionConsole';

interface TrackGroupListProps {
  group: TrackGroup;
  images: StageImage[];
  activeTrackId: string | null;
  onPlayTrack: (trackId: string) => void;
  onReorder: (orderedIds: string[]) => void;
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
  onReorder,
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

  return (
    <div className="space-y-2">
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
            <li key={track.id}>
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
                  event.preventDefault();
                  handleDropOn(track.id, event.dataTransfer.getData('text/plain'));
                }}
                onClick={() => onPlayTrack(track.id)}
                aria-label={`Play ${track.title}`}
                aria-pressed={isActive}
                className={`w-full rounded px-2 py-1.5 text-left transition ${
                  isActive
                    ? 'bg-[var(--app-accent-bg)] border border-[var(--app-accent-border)]'
                    : 'bg-[var(--app-bg-subtle)]'
                }`}
              >
                <span className="block text-sm font-medium truncate">{track.title}</span>
                {recommended && (
                  <span className="block text-[11px] truncate" style={{ color: '#c4a35a' }}>
                    {recommended}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
