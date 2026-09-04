import { useEffect, useState } from 'react';

import { useGameStore } from '../../store/gameStore';
import {
  TRACK_ACCENTS,
  clampVolumeOffset,
  type StageImage,
  type Track,
} from '../../types/sessionConsole';
import ToggleSwitch from '../ToggleSwitch';

interface SessionConsoleEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  image?: StageImage | null;
  track?: Track | null;
}

interface TrackFieldsProps {
  tag: string;
  loop: boolean;
  volumeOffset: number;
  recommendedImageId: string;
  plates: StageImage[];
  onTag: (value: string) => void;
  onLoop: (value: boolean) => void;
  onVolumeOffset: (value: number) => void;
  onRecommendedImageId: (value: string) => void;
}

function TrackFields({
  tag,
  loop,
  volumeOffset,
  recommendedImageId,
  plates,
  onTag,
  onLoop,
  onVolumeOffset,
  onRecommendedImageId,
}: TrackFieldsProps): JSX.Element {
  const tagOptions = TRACK_ACCENTS.some((option) => option === tag)
    ? TRACK_ACCENTS
    : [tag, ...TRACK_ACCENTS];
  return (
    <>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Tag
        <select
          value={tag}
          onChange={(event) => onTag(event.target.value)}
          className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
        >
          {tagOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <ToggleSwitch checked={loop} onChange={onLoop} label="Loop" />
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Volume offset
        <input
          type="range"
          min={-30}
          max={30}
          value={volumeOffset}
          onChange={(event) => onVolumeOffset(Number(event.target.value))}
          className="w-full mt-2"
        />
      </label>
      <label
        className="block text-xs uppercase font-semibold"
        style={{ color: 'var(--app-text-secondary)' }}
      >
        Recommended plate
        <select
          value={recommendedImageId}
          onChange={(event) => onRecommendedImageId(event.target.value)}
          className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
        >
          <option value="">None</option>
          {plates.map((plate) => (
            <option key={plate.id} value={plate.id}>
              {plate.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function EditorTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label
      className="block text-xs uppercase font-semibold"
      style={{ color: 'var(--app-text-secondary)' }}
    >
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sidebar-input mt-2 w-full rounded px-3 py-2 text-sm"
      />
    </label>
  );
}

function useEditorDraft(
  image: StageImage | null | undefined,
  track: Track | null | undefined,
  isOpen: boolean,
) {
  const [name, setName] = useState(image?.name ?? track?.title ?? '');
  const [cue, setCue] = useState(image?.cue ?? track?.cue ?? '');
  const [alt, setAlt] = useState(image?.alt ?? '');
  const [tag, setTag] = useState(track?.tag ?? 'bed');
  const [loop, setLoop] = useState(track?.loop ?? true);
  const [volumeOffset, setVolumeOffset] = useState(track?.volumeOffset ?? 0);
  const [recommendedImageId, setRecommendedImageId] = useState(track?.recommendedImageId ?? '');

  useEffect(() => {
    setName(image?.name ?? track?.title ?? '');
    setCue(image?.cue ?? track?.cue ?? '');
    setAlt(image?.alt ?? '');
    setTag(track?.tag ?? 'bed');
    setLoop(track?.loop ?? true);
    setVolumeOffset(track?.volumeOffset ?? 0);
    setRecommendedImageId(track?.recommendedImageId ?? '');
  }, [image, track, isOpen]);

  return {
    name,
    setName,
    cue,
    setCue,
    alt,
    setAlt,
    tag,
    setTag,
    loop,
    setLoop,
    volumeOffset,
    setVolumeOffset,
    recommendedImageId,
    setRecommendedImageId,
  };
}

export function SessionConsoleEditorSheet({
  isOpen,
  onClose,
  image,
  track,
}: SessionConsoleEditorSheetProps): JSX.Element | null {
  const imageSets = useGameStore((state) => state.sessionConsole.imageSets);
  const catalogImages = imageSets.flatMap((set) => set.images);
  const draft = useEditorDraft(image, track, isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || (!image && !track)) {
    return null;
  }

  const handleSave = (): void => {
    const { updateSessionConsole } = useGameStore.getState();
    if (image) {
      updateSessionConsole({
        type: 'UPDATE_IMAGE',
        imageId: image.id,
        patch: { name: draft.name, cue: draft.cue, alt: draft.alt },
      });
    }
    if (track) {
      updateSessionConsole({
        type: 'UPDATE_TRACK',
        trackId: track.id,
        patch: {
          title: draft.name,
          cue: draft.cue,
          tag: draft.tag,
          loop: draft.loop,
          volumeOffset: clampVolumeOffset(draft.volumeOffset),
          recommendedImageId: draft.recommendedImageId || undefined,
        },
      });
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        data-esc-owns="true"
        className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-[var(--app-bg-surface)] shadow-2xl z-50 overflow-y-auto"
      >
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
          <EditorTextField
            label={image ? 'Name' : 'Title'}
            value={draft.name}
            onChange={draft.setName}
          />
          <EditorTextField label="Cue" value={draft.cue} onChange={draft.setCue} />
          {image ? (
            <EditorTextField label="Alt text" value={draft.alt} onChange={draft.setAlt} />
          ) : null}
          {track ? (
            <TrackFields
              tag={draft.tag}
              loop={draft.loop}
              volumeOffset={draft.volumeOffset}
              recommendedImageId={draft.recommendedImageId}
              plates={catalogImages}
              onTag={draft.setTag}
              onLoop={draft.setLoop}
              onVolumeOffset={draft.setVolumeOffset}
              onRecommendedImageId={draft.setRecommendedImageId}
            />
          ) : null}
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
