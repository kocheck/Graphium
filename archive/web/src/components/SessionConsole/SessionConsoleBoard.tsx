import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';

import { RiAddLine } from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ImageSetBoard } from './ImageSetBoard';
import { TrackGroupList } from './TrackGroupList';
import { useGameStore } from '../../store/gameStore';
import {
  addNewImageSet,
  addNewTrackGroup,
  addYouTubeFromText,
  ingestDroppedFiles,
} from '../../utils/sessionConsoleBoard';
import { sanitizeSessionConsoleErrorMessage } from '../../utils/syncUtils';

import type { StageImage, Track } from '../../types/sessionConsole';

function filesFromDrop(event: DragEvent): File[] {
  return Array.from(event.dataTransfer?.files ?? []);
}

interface SessionConsoleBoardProps {
  onEditImage: (image: StageImage) => void;
  onEditTrack: (track: Track) => void;
}

export function SessionConsoleBoard({
  onEditImage,
  onEditTrack,
}: SessionConsoleBoardProps): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const runtime = useGameStore((state) => state.sessionConsoleRuntime);
  const dispatchSessionConsole = useGameStore((state) => state.dispatchSessionConsole);
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);
  const showToast = useGameStore((state) => state.showToast);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const allImages = catalog.imageSets.flatMap((set) => set.images);
  const isEmpty = catalog.imageSets.length === 0 && catalog.trackGroups.length === 0;

  const handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    void ingestDroppedFiles(useGameStore.getState(), filesFromDrop(event)).catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to add files';
        showToast(sanitizeSessionConsoleErrorMessage(message), 'error');
      },
    );
  };

  const handleYoutubePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text') || event.clipboardData.getData('text/plain');
    if (addYouTubeFromText(useGameStore.getState(), text)) {
      event.preventDefault();
      setYoutubeDraft('');
    }
  };

  const handleYoutubeKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    if (addYouTubeFromText(useGameStore.getState(), youtubeDraft)) {
      setYoutubeDraft('');
    }
  };

  return (
    <div
      data-testid="session-console-dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="rounded-sm border-2 border-dashed border-[var(--app-border-default)] p-2 space-y-2"
    >
      {isEmpty && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--app-text-secondary)' }}>
          Drop images or paste a YouTube link.
        </p>
      )}

      <Input
        aria-label="Paste YouTube URL"
        placeholder="Paste a YouTube link"
        value={youtubeDraft}
        onChange={(event) => setYoutubeDraft(event.target.value)}
        onPaste={handleYoutubePaste}
        onKeyDown={handleYoutubeKeyDown}
        className="w-full rounded-sm px-2 py-1 text-sm"
      />

      <input
        ref={(node) => {
          imageInputRef.current = node;
          if (node) {
            node.setAttribute('webkitdirectory', '');
            node.setAttribute('directory', '');
          }
        }}
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
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 py-1 text-xs flex items-center justify-center gap-1"
          onClick={() => imageInputRef.current?.click()}
        >
          <RiAddLine className="w-4 h-4" /> Add from folder
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="py-1 text-xs"
          onClick={() => addNewImageSet(useGameStore.getState())}
        >
          New plate set
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="py-1 text-xs"
          onClick={() => addNewTrackGroup(useGameStore.getState())}
        >
          New track group
        </Button>
      </div>

      {catalog.imageSets.map((set) => (
        <ImageSetBoard
          key={set.id}
          title={set.title}
          images={set.images}
          activeImageId={runtime.activeImage?.id ?? null}
          onShowPlate={(imageId) => dispatchSessionConsole({ type: 'SHOW_PLATE', imageId })}
          onEdit={onEditImage}
          onReorder={(orderedIds) =>
            updateSessionConsole({ type: 'REORDER_IMAGES', setId: set.id, orderedIds })
          }
          onDropFiles={(files) => {
            void ingestDroppedFiles(useGameStore.getState(), files, { setId: set.id });
          }}
        />
      ))}

      {catalog.trackGroups.map((group) => (
        <TrackGroupList
          key={group.id}
          group={group}
          images={allImages}
          activeTrackId={runtime.audio.trackId}
          onPlayTrack={(trackId) => dispatchSessionConsole({ type: 'PLAY_TRACK', trackId })}
          onEdit={onEditTrack}
          onReorder={(orderedIds) =>
            updateSessionConsole({ type: 'REORDER_TRACKS', groupId: group.id, orderedIds })
          }
          onDropFiles={(files) => {
            void ingestDroppedFiles(useGameStore.getState(), files, { groupId: group.id });
          }}
        />
      ))}
    </div>
  );
}
