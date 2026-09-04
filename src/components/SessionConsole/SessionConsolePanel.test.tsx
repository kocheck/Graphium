import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

import ConfirmDialog from '../ConfirmDialog';
import { useGameStore } from '../../store/gameStore';
import {
  emptySessionConsoleCatalog,
  emptySessionConsoleRuntime,
  type SessionConsoleCatalog,
  type StageImage,
  type Track,
} from '../../types/sessionConsole';
import { toMediaProtocol } from '../../utils/mediaProtocol';
import { SessionConsoleEscapeStop } from './SessionConsoleEscapeStop';
import { SessionConsolePanel } from './SessionConsolePanel';

const mockProcessImage = vi.fn();
const mockSaveLocalAudioFile = vi.fn();
const mockImportPack = vi.fn();
const mockExportPack = vi.fn();

vi.mock('../../utils/AssetProcessor', () => ({
  processImage: (...args: unknown[]) => mockProcessImage(...args),
}));

vi.mock('../../utils/localAudioAsset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/localAudioAsset')>();
  return {
    ...actual,
    saveLocalAudioFile: (...args: unknown[]) => mockSaveLocalAudioFile(...args),
  };
});

vi.mock('../../services/storage', () => ({
  getStorage: () => ({
    importSessionConsolePack: () => mockImportPack(),
    exportSessionConsolePack: (...args: unknown[]) => mockExportPack(...args),
  }),
}));

const plate: StageImage = {
  id: 'img-keep',
  name: 'Keep dawn',
  cue: 'DM-only statue cue',
  src: 'file:///full/keep.webp',
  thumbnailSrc: 'file:///thumb/keep.webp',
  alt: 'Dawn over the keep',
};

const bedTrack: Track = {
  id: 'track-tavern',
  title: 'Tavern bed',
  cue: 'after the riddle',
  tag: 'bed',
  source: 'youtube',
  youtubeId: 'bLZApMsorjA',
  volumeOffset: 0,
  loop: true,
  recommendedImageId: 'img-keep',
};

function catalogWithBoard(): SessionConsoleCatalog {
  const catalog = emptySessionConsoleCatalog('Ash Crown');
  return {
    ...catalog,
    imageSets: [
      {
        id: 'set-1',
        title: 'Session 3',
        note: '',
        images: [plate],
      },
    ],
    trackGroups: [
      {
        id: 'g1',
        title: 'Beds',
        note: '',
        accent: 'bed',
        tracks: [bedTrack],
      },
    ],
  };
}

function seedEmptyBoard(): void {
  const catalog = emptySessionConsoleCatalog('Ash Crown');
  useGameStore.setState({
    sessionConsole: catalog,
    campaign: {
      ...useGameStore.getState().campaign,
      name: 'Ash Crown',
      sessionConsole: catalog,
    },
    sessionConsoleRuntime: emptySessionConsoleRuntime(),
    toast: null,
    confirmDialog: null,
    isCommandPaletteOpen: false,
  });
}

function seedBoard(runtimePlaying = false): void {
  const catalog = catalogWithBoard();
  useGameStore.setState({
    sessionConsole: catalog,
    campaign: {
      ...useGameStore.getState().campaign,
      name: 'Ash Crown',
      sessionConsole: catalog,
    },
    sessionConsoleRuntime: {
      ...emptySessionConsoleRuntime(),
      ...(runtimePlaying
        ? {
            audio: {
              trackId: bedTrack.id,
              title: bedTrack.title,
              source: 'youtube',
              youtubeId: bedTrack.youtubeId ?? null,
              src: null,
              status: 'playing' as const,
              loop: true,
              restartSeq: 0,
              volumeOffset: 0,
            },
          }
        : {}),
    },
    toast: null,
    confirmDialog: null,
    isCommandPaletteOpen: false,
  });
}

function renderPanel(): void {
  render(
    <>
      <SessionConsolePanel />
      <ConfirmDialog />
    </>,
  );
}

function dropFiles(target: Element, files: File[]): void {
  fireEvent.drop(target, {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      types: ['Files'],
    },
  });
}

describe('SessionConsolePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessImage.mockImplementation((_file: File, type: string) => ({
      promise: Promise.resolve(
        type === 'THUMB' ? 'file:///thumb/dropped.webp' : 'file:///full/dropped.webp',
      ),
      cancel: vi.fn(),
    }));
    mockSaveLocalAudioFile.mockResolvedValue('file:///audio/bed.mp3');
    mockImportPack.mockResolvedValue(null);
    mockExportPack.mockResolvedValue({ ok: true, skipped: [] });
  });

  it('shows empty board copy without opening Settings', () => {
    seedEmptyBoard();
    renderPanel();

    expect(screen.getByText('Drop images or paste a YouTube link.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Session Console settings' }),
    ).not.toBeInTheDocument();
  });

  it('adds a dropped image to the board without opening Settings', async () => {
    seedEmptyBoard();
    renderPanel();

    const zone = screen.getByTestId('session-console-dropzone');
    const file = new File(['img'], 'keep.png', { type: 'image/png' });
    dropFiles(zone, [file]);

    await waitFor(() => {
      const images = useGameStore.getState().sessionConsole.imageSets.flatMap((set) => set.images);
      expect(images).toHaveLength(1);
      expect(images[0]?.src).toBe('file:///full/dropped.webp');
      expect(images[0]?.thumbnailSrc).toBe('file:///thumb/dropped.webp');
    });

    expect(mockProcessImage).toHaveBeenCalledWith(file, 'MAP');
    expect(
      screen.queryByRole('heading', { name: 'Session Console settings' }),
    ).not.toBeInTheDocument();
  });

  it('adds a pasted YouTube URL as a track without opening Settings', async () => {
    seedEmptyBoard();
    renderPanel();

    const input = screen.getByLabelText('Paste YouTube URL');
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    });

    await waitFor(() => {
      const tracks = useGameStore.getState().sessionConsole.trackGroups.flatMap((g) => g.tracks);
      expect(tracks).toHaveLength(1);
      expect(tracks[0]?.youtubeId).toBe('dQw4w9WgXcQ');
      expect(tracks[0]?.source).toBe('youtube');
    });

    expect(
      screen.queryByRole('heading', { name: 'Session Console settings' }),
    ).not.toBeInTheDocument();
  });

  it('shows a toast and does not add a track for an invalid YouTube paste', async () => {
    seedEmptyBoard();
    renderPanel();

    fireEvent.paste(screen.getByLabelText('Paste YouTube URL'), {
      clipboardData: {
        getData: () => 'https://example.com/not-youtube',
      },
    });

    await waitFor(() => {
      expect(useGameStore.getState().toast?.type).toBe('error');
    });
    expect(useGameStore.getState().sessionConsole.trackGroups).toHaveLength(0);
  });

  it('renders grid images from thumbnailSrc not the full plate src', () => {
    seedBoard();
    renderPanel();

    const img = screen.getByRole('img', { name: plate.alt });
    expect(img).toHaveAttribute('src', toMediaProtocol(plate.thumbnailSrc));
    expect(img.getAttribute('src')).not.toBe(plate.src);
    expect(img.getAttribute('src')).not.toBe(toMediaProtocol(plate.src));
  });

  it('clicking a plate shows it without changing audio', async () => {
    seedBoard(true);
    const audioBefore = useGameStore.getState().sessionConsoleRuntime.audio;
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: `Show plate ${plate.name}` }));

    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.activeImage?.id).toBe(plate.id);
    expect(runtime.stageVisible).toBe(true);
    expect(runtime.audio.status).toBe(audioBefore.status);
    expect(runtime.audio.trackId).toBe(audioBefore.trackId);
  });

  it('clicking a track plays it without showing the recommended plate', async () => {
    seedBoard();
    renderPanel();

    expect(screen.getByText(`Recommended: ${plate.name}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Play ${bedTrack.title}` }));

    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.audio.trackId).toBe(bedTrack.id);
    expect(runtime.audio.status).toBe('playing');
    expect(runtime.stageVisible).toBe(false);
    expect(runtime.activeImage).toBeNull();
  });

  it('Return to map keeps audio status', async () => {
    seedBoard(true);
    useGameStore.getState().dispatchSessionConsole({ type: 'SHOW_PLATE', imageId: plate.id });
    expect(useGameStore.getState().sessionConsoleRuntime.stageVisible).toBe(true);

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Return to map' }));

    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.stageVisible).toBe(false);
    expect(runtime.audio.status).toBe('playing');
    expect(runtime.audio.trackId).toBe(bedTrack.id);
  });

  it('Settings import Replace confirms before REPLACE_CATALOG', async () => {
    seedBoard(true);
    useGameStore.getState().dispatchSessionConsole({ type: 'SHOW_PLATE', imageId: plate.id });
    useGameStore.getState().setSessionConsoleWorldArmed(true);
    const incoming = emptySessionConsoleCatalog('Imported Board');
    incoming.stage.title = 'Imported Board';
    mockImportPack.mockResolvedValue({ catalog: incoming, skipped: [] });

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Session Console settings' }));
    await userEvent.click(screen.getByRole('button', { name: /Advanced: board pack/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Import replace' }));

    await waitFor(() => {
      expect(useGameStore.getState().confirmDialog).not.toBeNull();
    });
    expect(useGameStore.getState().sessionConsole.stage.title).toBe('Ash Crown');

    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(useGameStore.getState().sessionConsole.stage.title).toBe('Imported Board');
    });
    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.activeImage).toBeNull();
    expect(runtime.audio.status).toBe('stopped');
    expect(runtime.audio.trackId).toBeNull();
    expect(runtime.stage.title).toBe('Imported Board');
    expect(runtime.worldArmed).toBe(true);
  });

  it('plays the first flattened track when 1 is pressed with focus inside the panel', async () => {
    seedBoard();
    renderPanel();

    const panel = screen.getByTestId('session-console-panel');
    panel.focus();
    expect(panel).toHaveFocus();

    await userEvent.keyboard('1');

    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.audio.trackId).toBe(bedTrack.id);
    expect(runtime.audio.status).toBe('playing');
  });

  it('toasts a generic 8MB warning when a dropped audio file is oversized', async () => {
    seedEmptyBoard();
    renderPanel();

    const zone = screen.getByTestId('session-console-dropzone');
    const file = new File(['x'], 'secret-bed.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: 8 * 1024 * 1024 + 1 });
    dropFiles(zone, [file]);

    await waitFor(() => {
      expect(useGameStore.getState().toast?.type).toBe('info');
    });
    expect(useGameStore.getState().toast?.message).toMatch(/8\s*MB/i);
    expect(useGameStore.getState().toast?.message).not.toContain('secret-bed');
    expect(mockSaveLocalAudioFile).toHaveBeenCalled();
  });

  it('toasts a generic 8MB warning when pack import ingests oversized audio', async () => {
    seedBoard();
    const incoming = emptySessionConsoleCatalog('Imported Board');
    mockImportPack.mockResolvedValue({
      catalog: incoming,
      skipped: [],
      warnings: ['This audio file is larger than 8MB and will bloat the campaign zip.'],
    });

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Session Console settings' }));
    await userEvent.click(screen.getByRole('button', { name: /Advanced: board pack/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Import merge' }));

    await waitFor(() => {
      expect(useGameStore.getState().toast?.type).toBe('info');
    });
    expect(useGameStore.getState().toast?.message).toMatch(/8\s*MB/i);
    expect(useGameStore.getState().toast?.message).not.toContain('secret-bed');
    expect(useGameStore.getState().toast?.message).not.toMatch(/\/Users\//);
  });

  it('does not dispatch SET_DUCKED or stopImmediatePropagation when D is pressed outside the panel', () => {
    seedBoard();
    render(
      <>
        <button type="button">Outside canvas</button>
        <SessionConsolePanel />
        <ConfirmDialog />
      </>,
    );

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    act(() => {
      useGameStore.setState({ dispatchSessionConsole: dispatchSpy });
    });

    const outside = screen.getByRole('button', { name: 'Outside canvas' });
    outside.focus();
    expect(outside).toHaveFocus();

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(outside, { key: 'd' });
      fireEvent.keyDown(window, { key: 'd' });
    });

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_DUCKED' }));
    expect(useGameStore.getState().sessionConsoleRuntime.ducked).toBe(false);
    expect(stopSpy).not.toHaveBeenCalled();
    stopSpy.mockRestore();
  });

  it('stops playback when Escape is pressed outside the panel', () => {
    seedBoard(true);
    render(
      <>
        <button type="button">Outside canvas</button>
        <SessionConsoleEscapeStop />
        <SessionConsolePanel />
        <ConfirmDialog />
      </>,
    );

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    act(() => {
      useGameStore.setState({ dispatchSessionConsole: dispatchSpy });
    });

    const outside = screen.getByRole('button', { name: 'Outside canvas' });
    outside.focus();
    expect(outside).toHaveFocus();

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(outside, { key: 'Escape' });
    });

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'STOP' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('stopped');
    expect(stopSpy).toHaveBeenCalled();
    stopSpy.mockRestore();
  });

  it('stops playback from SessionConsoleEscapeStop when the panel is not mounted', () => {
    seedBoard(true);
    render(<SessionConsoleEscapeStop />);

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    act(() => {
      useGameStore.setState({ dispatchSessionConsole: dispatchSpy });
    });

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'STOP' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('stopped');
    expect(stopSpy).toHaveBeenCalled();
    stopSpy.mockRestore();
  });

  it('does not swallow Esc when playback is already stopped', () => {
    seedBoard();
    render(
      <>
        <button type="button">Outside canvas</button>
        <SessionConsoleEscapeStop />
        <SessionConsolePanel />
      </>,
    );
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('stopped');

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(stopSpy).not.toHaveBeenCalled();
    stopSpy.mockRestore();
  });

  it('still STOPs when a role=dialog nav drawer is open without data-esc-owns', () => {
    seedBoard(true);
    render(
      <>
        <div role="dialog" aria-modal="true" aria-label="Sidebar">
          Mobile drawer
        </div>
        <SessionConsoleEscapeStop />
      </>,
    );

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    act(() => {
      useGameStore.setState({ dispatchSessionConsole: dispatchSpy });
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'STOP' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('stopped');
  });

  it('does not STOP when Escape is pressed while a confirm dialog is open', () => {
    seedBoard(true);
    render(
      <>
        <button type="button">Outside canvas</button>
        <SessionConsoleEscapeStop />
        <SessionConsolePanel />
        <ConfirmDialog />
      </>,
    );

    act(() => {
      useGameStore.getState().showConfirmDialog('Replace the catalog?', () => undefined);
    });
    expect(useGameStore.getState().confirmDialog).not.toBeNull();
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('playing');

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    act(() => {
      useGameStore.setState({ dispatchSessionConsole: dispatchSpy });
    });

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(dispatchSpy).not.toHaveBeenCalledWith({ type: 'STOP' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('playing');
    expect(useGameStore.getState().confirmDialog).toBeNull();
    stopSpy.mockRestore();
  });

  it('stops D and 1-5 from bubbling when handled inside the panel', () => {
    seedBoard();
    renderPanel();
    const panel = screen.getByTestId('session-console-panel');
    panel.focus();

    const stopSpy = vi.spyOn(Event.prototype, 'stopImmediatePropagation');
    act(() => {
      fireEvent.keyDown(panel, { key: 'd' });
      fireEvent.keyDown(panel, { key: '1' });
    });

    expect(stopSpy).toHaveBeenCalled();
    expect(useGameStore.getState().sessionConsoleRuntime.ducked).toBe(true);
    expect(useGameStore.getState().sessionConsoleRuntime.audio.trackId).toBe(bedTrack.id);
    stopSpy.mockRestore();
  });

  it('saves recommended plate via UPDATE_TRACK without changing activeImage', async () => {
    seedBoard();
    const extraPlate: StageImage = {
      id: 'img-hall',
      name: 'Hall',
      cue: 'secret hall cue',
      src: 'file:///full/hall.webp',
      thumbnailSrc: 'file:///thumb/hall.webp',
      alt: 'The hall',
    };
    const catalog = useGameStore.getState().sessionConsole;
    useGameStore.setState({
      sessionConsole: {
        ...catalog,
        imageSets: [
          {
            ...catalog.imageSets[0]!,
            images: [...catalog.imageSets[0]!.images, extraPlate],
          },
        ],
      },
    });
    useGameStore.getState().dispatchSessionConsole({ type: 'SHOW_PLATE', imageId: plate.id });
    expect(useGameStore.getState().sessionConsoleRuntime.activeImage?.id).toBe(plate.id);

    const originalDispatch = useGameStore.getState().dispatchSessionConsole;
    const dispatchSpy = vi.fn((command: Parameters<typeof originalDispatch>[0]) =>
      originalDispatch(command),
    );
    useGameStore.setState({ dispatchSessionConsole: dispatchSpy });

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: `Edit track ${bedTrack.title}` }));
    expect(screen.getByRole('heading', { name: 'Edit track' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Recommended plate'), extraPlate.id);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        useGameStore.getState().sessionConsole.trackGroups[0]?.tracks[0]?.recommendedImageId,
      ).toBe(extraPlate.id);
    });
    expect(useGameStore.getState().sessionConsoleRuntime.activeImage?.id).toBe(plate.id);
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SHOW_PLATE' }));
  });

  it('opens the editor sheet from a plate Edit button', async () => {
    seedBoard();
    renderPanel();

    await userEvent.click(screen.getByRole('button', { name: `Edit plate ${plate.name}` }));
    expect(screen.getByRole('heading', { name: 'Edit plate' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Renamed keep');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useGameStore.getState().sessionConsole.imageSets[0]?.images[0]?.name).toBe(
        'Renamed keep',
      );
    });
  });

  it('sanitizes skipped pack paths in the import summary', async () => {
    seedBoard();
    const incoming = emptySessionConsoleCatalog('Imported Board');
    mockImportPack.mockResolvedValue({
      catalog: incoming,
      skipped: ['Failed /Users/janedoe/Music/bed.mp3'],
    });

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Session Console settings' }));
    await userEvent.click(screen.getByRole('button', { name: /Advanced: board pack/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Import replace' }));

    await waitFor(() => {
      expect(useGameStore.getState().confirmDialog).not.toBeNull();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(screen.getByText(/Skipped 1:/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Skipped 1:/).textContent).not.toContain('janedoe');
    expect(screen.getByText(/Skipped 1:/).textContent).toContain('<USER>');
  });

  it('processes imported pack plates through MAP+thumb before REPLACE', async () => {
    seedBoard();
    const incoming = emptySessionConsoleCatalog('Imported Board');
    incoming.imageSets = [
      {
        id: 'set-import',
        title: 'Imported',
        note: '',
        images: [
          {
            id: 'img-4k',
            name: 'Hall',
            cue: 'secret',
            src: 'file:///full/4k.webp',
            thumbnailSrc: 'file:///full/4k.webp',
            alt: 'Hall',
          },
        ],
      },
    ];
    mockImportPack.mockResolvedValue({ catalog: incoming, skipped: [] });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['img'], { type: 'image/webp' }),
      }),
    );

    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Session Console settings' }));
    await userEvent.click(screen.getByRole('button', { name: /Advanced: board pack/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Import replace' }));

    await waitFor(() => {
      expect(useGameStore.getState().confirmDialog).not.toBeNull();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      const image = useGameStore.getState().sessionConsole.imageSets[0]?.images[0];
      expect(image?.src).toBe('file:///full/dropped.webp');
      expect(image?.thumbnailSrc).toBe('file:///thumb/dropped.webp');
      expect(image?.thumbnailSrc).not.toBe(image?.src);
    });
    expect(mockProcessImage).toHaveBeenCalledWith(expect.any(File), 'MAP');
    expect(mockProcessImage).toHaveBeenCalledWith(expect.any(File), 'THUMB');
    vi.unstubAllGlobals();
  });
});
