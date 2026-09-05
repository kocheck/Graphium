import { useEffect, useState } from 'react';

import { RiFileCopyLine, RiSettings4Line } from '@remixicon/react';

import { Button } from '@/components/ui/button';

import { SessionConsoleBoard } from './SessionConsoleBoard';
import { SessionConsoleEditorSheet } from './SessionConsoleEditorSheet';
import { SessionConsoleMasterBar } from './SessionConsoleMasterBar';
import { SessionConsoleSettingsSheet } from './SessionConsoleSettingsSheet';
import { useSessionConsoleHotkeys } from './useSessionConsoleHotkeys';
import { useGameStore } from '../../store/gameStore';
import {
  flattenTracks,
  formatSessionConsoleFallbackLinks,
  formatTrackFallbackLine,
} from '../../utils/sessionConsoleBoard';
import { OPEN_SESSION_CONSOLE_SETTINGS_EVENT } from '../../utils/sessionConsoleEvents';

import type { StageImage, Track } from '../../types/sessionConsole';

type EditorTarget = { image: StageImage } | { track: Track };

export function SessionConsolePanel(): JSX.Element {
  const catalog = useGameStore((state) => state.sessionConsole);
  const runtime = useGameStore((state) => state.sessionConsoleRuntime);
  const dispatchSessionConsole = useGameStore((state) => state.dispatchSessionConsole);
  const showToast = useGameStore((state) => state.showToast);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  useSessionConsoleHotkeys();

  useEffect(() => {
    const open = (): void => {
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_SESSION_CONSOLE_SETTINGS_EVENT, open);
    return () => {
      window.removeEventListener(OPEN_SESSION_CONSOLE_SETTINGS_EVENT, open);
    };
  }, []);

  const handleCopyAll = (): void => {
    void navigator.clipboard.writeText(formatSessionConsoleFallbackLinks(catalog)).then(
      () => showToast('Copied track links', 'success'),
      () => showToast('Failed to copy track links', 'error'),
    );
  };

  const handleCopyCurrent = (): void => {
    const tracks = flattenTracks(catalog);
    const current = tracks.find((track) => track.id === runtime.audio.trackId);
    const index = current ? tracks.indexOf(current) + 1 : 0;
    const text = current
      ? formatTrackFallbackLine(index, current)
      : formatSessionConsoleFallbackLinks(catalog);
    void navigator.clipboard.writeText(text).then(
      () => showToast('Copied current track link', 'success'),
      () => showToast('Failed to copy track link', 'error'),
    );
  };

  return (
    <div
      className="space-y-3"
      data-testid="session-console-panel"
      data-session-console="panel"
      tabIndex={0}
    >
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          className="p-1"
          aria-label="Session Console settings"
          onClick={() => setSettingsOpen(true)}
        >
          <RiSettings4Line className="w-4 h-4" />
        </Button>
      </div>

      <SessionConsoleMasterBar />

      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 py-1 text-xs"
          onClick={handleCopyCurrent}
        >
          <RiFileCopyLine className="w-3.5 h-3.5 inline" /> Copy current
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="flex-1 py-1 text-xs"
          onClick={handleCopyAll}
        >
          Copy all links
        </Button>
      </div>

      <SessionConsoleBoard
        onEditImage={(image) => setEditor({ image })}
        onEditTrack={(track) => setEditor({ track })}
      />

      <div className="flex flex-wrap gap-1">
        {catalog.sfx.map((sfx) => (
          <Button
            key={sfx.id}
            type="button"
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => dispatchSessionConsole({ type: 'FIRE_SFX', sfxId: sfx.id })}
          >
            {sfx.label}
          </Button>
        ))}
      </div>

      <SessionConsoleSettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SessionConsoleEditorSheet
        isOpen={editor !== null}
        onClose={() => setEditor(null)}
        image={editor && 'image' in editor ? editor.image : null}
        track={editor && 'track' in editor ? editor.track : null}
      />
    </div>
  );
}
