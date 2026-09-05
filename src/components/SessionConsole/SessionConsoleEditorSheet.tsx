import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
      <label className="block text-xs uppercase font-semibold text-[var(--app-text-secondary)]">
        Tag
        <select value={tag} onChange={(event) => onTag(event.target.value)} className="mt-2 w-full">
          {tagOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <ToggleSwitch checked={loop} onChange={onLoop} label="Loop" />
      <label className="block text-xs uppercase font-semibold text-[var(--app-text-secondary)]">
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
      <label className="block text-xs uppercase font-semibold text-[var(--app-text-secondary)]">
        Recommended plate
        <select
          value={recommendedImageId}
          onChange={(event) => onRecommendedImageId(event.target.value)}
          className="mt-2 w-full"
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
    <label className="block text-xs uppercase font-semibold text-[var(--app-text-secondary)]">
      {label}
      <Input
        className="mt-2 w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface EditorDraft {
  name: string;
  setName: (value: string) => void;
  cue: string;
  setCue: (value: string) => void;
  alt: string;
  setAlt: (value: string) => void;
  tag: string;
  setTag: (value: string) => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
  volumeOffset: number;
  setVolumeOffset: (value: number) => void;
  recommendedImageId: string;
  setRecommendedImageId: (value: string) => void;
}

function useEditorDraft(
  image: StageImage | null | undefined,
  track: Track | null | undefined,
  isOpen: boolean,
): EditorDraft {
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
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:w-96 sm:max-w-none p-0 overflow-y-auto"
        data-testid="sheet-session-console-editor-root"
      >
        <SheetHeader className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4">
          <SheetTitle className="text-lg font-bold">
            {image ? 'Edit plate' : 'Edit track'}
          </SheetTitle>
        </SheetHeader>
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
        <SheetFooter className="sticky bottom-0 bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)] p-4 flex flex-row gap-2">
          <Button type="button" variant="ghost" className="flex-1 py-2" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="default" className="flex-1 py-2" onClick={handleSave}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
