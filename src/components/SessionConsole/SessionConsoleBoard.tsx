import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';

import { RiAddLine } from '@remixicon/react';

import { ImageSetBoard } from './ImageSetBoard';
import { TrackGroupList } from './TrackGroupList';
import { useGameStore } from '../../store/gameStore';
import { addYouTubeFromText, ingestDroppedFiles } from '../../utils/sessionConsoleBoard';

function filesFromDrop(event: DragEvent): File[] {
  return Array.from(event.dataTransfer?.files ?? []);
}

export function SessionConsoleBoard(): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const runtime = useGameStore((state) => state.sessionConsoleRuntime);
  const dispatchSessionConsole = useGameStore((state) => state.dispatchSessionConsole);
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);
  const showToast = useGameStore((state) => state.showToast);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const allImages = catalog.imageSets.flatMap((set) => set.images);
  const isEmpty = catalog.imageSets.length === 0 && catalog.trackGroups.length === 0;

  const handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    void ingestDroppedFiles(useGameStore.getState(), filesFromDrop(event)).catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to add files';
        showToast(message, 'error');
      },
    );
  };

  const handleYoutubePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text') || event.clipboardData.getData('text/plain');
    addYouTubeFromText(useGameStore.getState(), text);
    setYoutubeDraft('');
  };

  return (
    <div
      data-testid="session-console-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="rounded border-2 border-dashed border-[var(--app-border-default)] p-2 space-y-2"
    >
      {isEmpty && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--app-text-secondary)' }}>
          Drop images or paste a YouTube link.
        </p>
      )}

      <input
        aria-label="Paste YouTube URL"
        placeholder="Paste a YouTube link"
        value={youtubeDraft}
        onChange={(event) => setYoutubeDraft(event.target.value)}
        onPaste={handleYoutubePaste}
        className="sidebar-input w-full rounded px-2 py-1 text-sm"
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void ingestDroppedFiles(useGameStore.getState(), files);
        }}
      />
      <button
        type="button"
        className="btn btn-secondary w-full py-1 text-xs flex items-center justify-center gap-1"
        onClick={() => imageInputRef.current?.click()}
      >
        <RiAddLine className="w-4 h-4" /> Add from folder
      </button>

      {catalog.imageSets.map((set) => (
        <ImageSetBoard
          key={set.id}
          title={set.title}
          images={set.images}
          activeImageId={runtime.activeImage?.id ?? null}
          onShowPlate={(imageId) => dispatchSessionConsole({ type: 'SHOW_PLATE', imageId })}
          onReorder={(orderedIds) =>
            updateSessionConsole({ type: 'REORDER_IMAGES', setId: set.id, orderedIds })
          }
        />
      ))}

      {catalog.trackGroups.map((group) => (
        <TrackGroupList
          key={group.id}
          group={group}
          images={allImages}
          activeTrackId={runtime.audio.trackId}
          onPlayTrack={(trackId) => dispatchSessionConsole({ type: 'PLAY_TRACK', trackId })}
          onReorder={(orderedIds) =>
            updateSessionConsole({ type: 'REORDER_TRACKS', groupId: group.id, orderedIds })
          }
        />
      ))}
    </div>
  );
}
