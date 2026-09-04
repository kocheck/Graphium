import { useEffect, useState } from 'react';

import { useGameStore } from '../../store/gameStore';

import type { StageImage, Track } from '../../types/sessionConsole';

interface SessionConsoleEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  image?: StageImage | null;
  track?: Track | null;
}

export function SessionConsoleEditorSheet({
  isOpen,
  onClose,
  image,
  track,
}: SessionConsoleEditorSheetProps): JSX.Element | null {
  const updateSessionConsole = useGameStore((state) => state.updateSessionConsole);
  const [name, setName] = useState(image?.name ?? track?.title ?? '');
  const [cue, setCue] = useState(image?.cue ?? track?.cue ?? '');
  const [alt, setAlt] = useState(image?.alt ?? '');

  useEffect(() => {
    setName(image?.name ?? track?.title ?? '');
    setCue(image?.cue ?? track?.cue ?? '');
    setAlt(image?.alt ?? '');
  }, [image, track, isOpen]);

  if (!isOpen || (!image && !track)) {
    return null;
  }

  const handleSave = (): void => {
    if (image) {
      updateSessionConsole({
        type: 'UPDATE_IMAGE',
        imageId: image.id,
        patch: { name, cue, alt },
      });
    }
    if (track) {
      updateSessionConsole({
        type: 'UPDATE_TRACK',
        trackId: track.id,
        patch: { title: name, cue },
      });
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-[var(--app-bg-surface)] shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{image ? 'Edit plate' : 'Edit track'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[var(--app-bg-subtle)] rounded transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <label
            className="block text-xs uppercase font-semibold"
            style={{ color: 'var(--app-text-secondary)' }}
          >
            {image ? 'Name' : 'Title'}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
            />
          </label>
          <label
            className="block text-xs uppercase font-semibold"
            style={{ color: 'var(--app-text-secondary)' }}
          >
            Cue
            <input
              value={cue}
              onChange={(event) => setCue(event.target.value)}
              className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
            />
          </label>
          {image && (
            <label
              className="block text-xs uppercase font-semibold"
              style={{ color: 'var(--app-text-secondary)' }}
            >
              Alt text
              <input
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
        <div className="sticky bottom-0 bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)] p-4 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 py-2 rounded">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary flex-1 py-2 rounded"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
